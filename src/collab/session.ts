// Jam Session networking & sync (lazy-loaded).
//
// Topology: every peer connects to every other peer over WebRTC (Trystero, Nostr signalling).
// One peer is the HOST and owns the canonical order of edits:
//   client edit → applied locally at once → sent to host as an "op"
//   host        → applies it, gives it a sequence number, broadcasts it to everyone
//   clients     → apply host messages strictly in sequence order (reorder buffer, gap → resync)
// Local edits not yet acknowledged by the host are protected: remote changes to the same
// entity are skipped until the host echoes our op back (it was sequenced after theirs).
// The host broadcasts a hash of its state every few seconds; anyone who differs re-downloads
// the song, re-applying their own unacknowledged edits on top. If the host leaves, the
// remaining synced peer with the lowest id takes over.
import { joinRoom, selfId, getRelaySockets, type Room } from 'trystero/nostr';
import type { Project } from '../model/types';
import { useStore, toast, pruneSelection } from '../state/store';
import { openProject, migrate } from '../state/actions';
import { getEngine } from '../audio/engine';
import { addClip, getBuffer, getClipBlob, ensureClips } from '../audio/audioStore';
import { flushSave, projectAudioIds, saveProject } from '../state/persistence';
import { applyDelta, computeDelta, deltaKeys, filterDelta, hashProject, type Delta } from './sync';
import { useCollab, loadIdentity, type Peer } from './state';

const APP_ID = 'bandforge-music-sequencer';
const FLUSH_MS = 50;
const HASH_MS = 3000;
const PRESENCE_MS = 150;
const ALONE_HOST_MS = 9000;
const ACK_TIMEOUT_MS = 8000;
const GAP_TIMEOUT_MS = 4000;
const SESSION_KEY = 'bf.jam.session';

type SyncMsg =
  | { t: 'hello'; name: string; color: string; synced: boolean; isHost: boolean; hostId: string | null; seq: number; projectId: string | null; reply?: boolean }
  | { t: 'op'; opId: string; d: Delta }
  | { t: 'seq'; seq: number; from: string; opId: string; d: Delta }
  | { t: 'ack'; opId: string }
  | { t: 'hash'; seq: number; hash: string }
  | { t: 'snapReq' }
  | { t: 'clipReq'; id: string }
  | { t: 'clipNo'; id: string }
  | { t: 'bye' }
  | { t: 'byeAck' };

interface PresenceMsg {
  sel: string | null;
  reg: string | null;
  playing: boolean;
  pos: number;
  bpm: number;
}

interface TransportMsg {
  cmd: 'play' | 'stop' | 'seek';
  pos: number;
}

interface ChatMsg {
  id: string;
  text: string;
  name: string;
  color: string;
}

interface SnapshotMsg {
  seq: number;
  project: Project;
}

// ------------------------------------------------------------------ session state

let room: Room | null = null;
/** Incremented on every connect/leave; callbacks from an older session are ignored. */
let gen = 0;
let code: string | null = null;
let projectId: string | null = null;
let isHost = false;
let hostId: string | null = null;
let synced = false;
let seq = 0; // host: last assigned; client: last applied
let baseline: Project | null = null;
let applyingRemote = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hashTimer: ReturnType<typeof setInterval> | null = null;
let presenceTimer: ReturnType<typeof setTimeout> | null = null;
let aloneTimer: ReturnType<typeof setTimeout> | null = null;
let statusTimer: ReturnType<typeof setInterval> | null = null;
let unsubStore: (() => void) | null = null;
let identity = loadIdentity();
let opCounter = 0;
let awaitingSnapshot = false;
let lastSnapReq = 0;
/** Last time snapshot data arrived (progress), to detect a stalled download. */
let lastSnapProgress = 0;
/** When a collaborator disappeared without saying goodbye (connection dropped), and who. */
let lostPeerAt: number | null = null;
let lostPeerName = '';
let lastReconnectAt = 0;
let reconnectBackoff = 8000;
/** When we started trying to join (to retry if nobody has answered yet). */
let joinStartedAt = 0;
let lastHashSent: { project: Project | null; hash: string } = { project: null, hash: '' };
let ignoreTransportUntil = 0;
let gapTimer: ReturnType<typeof setTimeout> | null = null;
/** Set after a host hand-over: resend unacknowledged edits once the new host says hello. */
let hostChanged = false;

/** Unacknowledged local ops (client only), in send order. */
let pendingOps: { opId: string; d: Delta; sentAt: number }[] = [];
const pendingKeyCount = new Map<string, number>();
/** Out-of-order host messages waiting for earlier sequence numbers. */
const reorder = new Map<number, Extract<SyncMsg, { t: 'seq' }>>();
/** Host: recently sequenced op ids → seq (dedupe resends). */
const seenOps = new Map<string, number>();
/**
 * Host: every delta it sequenced since it last lost a peer unexpectedly (not via "bye").
 * If the network splits and heals with two hosts, the one that steps down replays this log
 * to the winner so edits made on its side of the split aren't lost.
 */
let splitLog: { opId: string; d: Delta }[] = [];
const SPLIT_LOG_MAX = 3000;
function logSequenced(opId: string, d: Delta): void {
  splitLog.push({ opId, d });
  if (splitLog.length > SPLIT_LOG_MAX) splitLog.splice(0, splitLog.length - SPLIT_LOG_MAX);
}
/** Audio clips requested from peers: id → when, who we asked, and who already said no. */
const clipRequests = new Map<string, { at: number; asked: string; tried: Set<string> }>();
/** Peer that most recently introduced each audio id (best source to ask). */
const clipOrigin = new Map<string, string>();
const latency = new Map<string, number>();

// Actions
let syncSend: ((m: SyncMsg, target?: string | string[] | null) => Promise<void>) | null = null;
let snapSend: ((m: SnapshotMsg, target: string) => Promise<void>) | null = null;
let presSend: ((m: PresenceMsg) => Promise<void>) | null = null;
let xportSend: ((m: TransportMsg) => Promise<void>) | null = null;
let chatSend: ((m: ChatMsg) => Promise<void>) | null = null;
let clipSend: ((data: Blob, target: string, meta: { id: string; name: string; type: string }) => Promise<void>) | null = null;

// Outgoing sync messages are serialised so large (chunked) messages can't be overtaken.
let sendChain: Promise<unknown> = Promise.resolve();
function send(m: SyncMsg, target?: string | string[] | null): void {
  if (!syncSend) return;
  const fn = syncSend;
  sendChain = sendChain.then(() => fn(m, target).catch((e) => console.warn('[jam] send failed', e)));
}
function sendSnapshot(target: string): void {
  const p = useStore.getState().project;
  if (!snapSend || !p) return;
  const fn = snapSend;
  const msg: SnapshotMsg = { seq, project: p };
  sendChain = sendChain.then(() => fn(msg, target).catch((e) => console.warn('[jam] snapshot failed', e)));
}

function setStatus(status: ReturnType<typeof useCollab.getState>['status'], message = ''): void {
  useCollab.setState({ status, message });
}

function peersState(): Record<string, Peer> {
  return useCollab.getState().peers;
}

function updatePeer(id: string, patch: Partial<Peer>): void {
  const peers = peersState();
  const cur: Peer = peers[id] ?? {
    id,
    name: 'Someone',
    color: '#888',
    isHost: false,
    synced: false,
    selectedTrackId: null,
    editingRegionId: null,
    playing: false,
    position: 0,
    posAt: 0,
    bpm: 120,
  };
  useCollab.setState({ peers: { ...peers, [id]: { ...cur, ...patch } } });
}

function refreshConnectedStatus(): void {
  if (!room) return;
  const n = Object.keys(peersState()).length;
  const s = useCollab.getState().status;
  if (!synced) return;
  if (n === 0)
    setStatus(
      'waiting',
      lostPeerAt
        ? `Lost the connection to ${lostPeerName || 'your collaborator'} — reconnecting automatically. Keep working; your changes will merge.`
        : 'Waiting for others to join. Share the link or code.',
    );
  else if (s !== 'error' || n > 0) setStatus('connected', `Connected with ${n} other ${n === 1 ? 'person' : 'people'}`);
}

function persistSession(): void {
  try {
    if (code && projectId) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code, projectId }));
  } catch {
    /* ignore */
  }
}

export function rememberedSession(): { code: string; projectId: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setUrlCode(c: string | null): void {
  const u = new URL(window.location.href);
  u.hash = c ? 'jam=' + c : '';
  history.replaceState(null, '', u.toString().replace(/#$/, ''));
}

// ------------------------------------------------------------------ applying remote changes

function pendingSkip(): Set<string> {
  return new Set([...pendingKeyCount.keys()]);
}

function applyRemote(d: Delta): void {
  const s = useStore.getState();
  if (!s.project) return;
  const filtered = filterDelta(d, pendingSkip());
  if (!filtered) return;
  applyingRemote = true;
  try {
    const project = applyDelta(s.project, filtered);
    useStore.setState({
      project,
      past: s.past.map((p) => applyDelta(p, filtered)),
      future: s.future.map((p) => applyDelta(p, filtered)),
    });
    baseline = project;
  } finally {
    applyingRemote = false;
  }
  if (filtered.removedTracks?.length || filtered.removedRegions?.length) pruneSelection();
  void fetchMissingAudio();
}

function addPending(opId: string, d: Delta): void {
  pendingOps.push({ opId, d, sentAt: Date.now() });
  for (const k of deltaKeys(d)) pendingKeyCount.set(k, (pendingKeyCount.get(k) ?? 0) + 1);
}

function ackPending(opId: string): void {
  const i = pendingOps.findIndex((p) => p.opId === opId);
  if (i < 0) return;
  // Ops are sequenced in send order, so everything before this one is acknowledged too.
  const done = pendingOps.splice(0, i + 1);
  for (const op of done)
    for (const k of deltaKeys(op.d)) {
      const n = (pendingKeyCount.get(k) ?? 1) - 1;
      if (n <= 0) pendingKeyCount.delete(k);
      else pendingKeyCount.set(k, n);
    }
}

function clearPending(): void {
  pendingOps = [];
  pendingKeyCount.clear();
}

// ------------------------------------------------------------------ local changes → network

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_MS);
}

/** Send whatever changed locally since the last flush. `from` overrides the current song
 * (used when leaving: the song may already have been closed when we get here). */
function flush(from?: Project | null): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  const p = from ?? useStore.getState().project;
  if (!room || !p || !baseline || p.id !== projectId || !synced) return;
  const d = computeDelta(baseline, p);
  baseline = p;
  if (!d) return;
  const opId = selfId + ':' + ++opCounter;
  if (isHost) {
    seq++;
    seenOps.set(opId, seq);
    logSequenced(opId, d);
    send({ t: 'seq', seq, from: selfId, opId, d });
  } else if (hostId) {
    addPending(opId, d);
    send({ t: 'op', opId, d }, hostId);
  } else {
    // No host known right now (mid-election): keep it pending; it is resent to the new host.
    addPending(opId, d);
  }
}

function hostApplyOp(from: string, opId: string, d: Delta): void {
  const done = seenOps.get(opId);
  if (done !== undefined) {
    send({ t: 'ack', opId }, from);
    return;
  }
  flush(); // our own edits come first
  noteClipOrigins(d, from);
  applyRemote(d);
  seq++;
  seenOps.set(opId, seq);
  logSequenced(opId, d);
  if (seenOps.size > 3000) {
    const first = seenOps.keys().next().value;
    if (first !== undefined) seenOps.delete(first);
  }
  send({ t: 'seq', seq, from, opId, d });
}

function handleSeq(m: Extract<SyncMsg, { t: 'seq' }>, from: string): void {
  if (isHost || from !== hostId) return;
  if (awaitingSnapshot) {
    reorder.set(m.seq, m);
    return;
  }
  if (m.seq <= seq) return; // duplicate
  reorder.set(m.seq, m);
  drainReorder();
  if (reorder.size && !gapTimer) {
    gapTimer = setTimeout(() => {
      gapTimer = null;
      if (reorder.size) requestSnapshot('missing updates');
    }, GAP_TIMEOUT_MS);
  }
}

function drainReorder(): void {
  for (;;) {
    const next = reorder.get(seq + 1);
    if (!next) break;
    reorder.delete(seq + 1);
    seq = next.seq;
    if (next.from === selfId) ackPending(next.opId);
    else {
      flush();
      noteClipOrigins(next.d, next.from);
      applyRemote(next.d);
    }
  }
  if (!reorder.size && gapTimer) {
    clearTimeout(gapTimer);
    gapTimer = null;
  }
}

function requestSnapshot(reason: string): void {
  if (!hostId || isHost) return;
  const now = Date.now();
  if (awaitingSnapshot && now - lastSnapReq < 6000) return;
  lastSnapReq = now;
  awaitingSnapshot = true;
  console.info('[jam] requesting snapshot:', reason);
  send({ t: 'snapReq' }, hostId);
}

async function receiveSnapshot(msg: SnapshotMsg, from: string): Promise<void> {
  if (from !== hostId && hostId !== null) return;
  if (!hostId) hostId = from;
  flush();
  const incoming = migrate(msg.project);
  // Re-apply our unacknowledged edits on top of the host's copy.
  let project = incoming;
  for (const op of pendingOps) project = applyDelta(project, op.d);
  const first = !synced;
  projectId = incoming.id;
  if (code) joinedHere.set(code, incoming.id);
  seq = msg.seq;
  awaitingSnapshot = false;
  synced = true;
  persistSession();
  const s = useStore.getState();
  if (first || s.project?.id !== incoming.id || s.screen !== 'project') {
    applyingRemote = true;
    try {
      await saveProject(project);
      await openProject(project);
    } finally {
      applyingRemote = false;
    }
  } else {
    applyingRemote = true;
    try {
      useStore.setState({ project, past: [], future: [] });
    } finally {
      applyingRemote = false;
    }
  }
  baseline = useStore.getState().project;
  useCollab.setState({ joinProgress: null });
  // Apply any host messages that arrived while the snapshot was in flight.
  for (const [k, m] of [...reorder.entries()])
    if (k <= seq) {
      reorder.delete(k);
      if (m.from === selfId) ackPending(m.opId);
    }
  drainReorder();
  sayHello(null);
  refreshConnectedStatus();
  if (first) toast(`Joined the jam session — you're editing “${incoming.name}” together`, 'success');
  void fetchMissingAudio();
}

// ------------------------------------------------------------------ hosting

function becomeHost(reason: string): void {
  console.info('[jam] becoming host:', reason);
  flush();
  // Our unacknowledged edits are already applied locally — they're canonical now.
  clearPending();
  isHost = true;
  hostId = selfId;
  synced = true;
  awaitingSnapshot = false;
  reorder.clear();
  splitLog = [];
  baseline = useStore.getState().project;
  useCollab.setState({ hostId: selfId });
  sayHello(null);
  startHashTimer();
  refreshConnectedStatus();
}

function startHashTimer(): void {
  if (hashTimer) clearInterval(hashTimer);
  hashTimer = setInterval(() => {
    if (!isHost || !room) return;
    flush();
    const p = useStore.getState().project;
    if (!p || !Object.keys(peersState()).length) return;
    if (lastHashSent.project !== p) lastHashSent = { project: p, hash: hashProject(p) };
    send({ t: 'hash', seq, hash: lastHashSent.hash });
  }, HASH_MS);
}

function electHost(): void {
  const candidates = [selfId, ...Object.values(peersState()).filter((p) => p.synced).map((p) => p.id)];
  if (!synced) return; // we can't lead without the song
  const next = candidates.sort()[0];
  if (next === selfId) becomeHost('previous host left');
  else {
    hostId = next;
    hostChanged = true;
    awaitingSnapshot = false;
    useCollab.setState({ hostId: next });
    // Wait for the new host's hello before resending pending edits.
  }
}

// ------------------------------------------------------------------ hello / membership

function sayHello(target: string | null, reply = false): void {
  identity = loadIdentity();
  send(
    {
      t: 'hello',
      name: identity.name,
      color: identity.color,
      synced,
      isHost,
      hostId,
      seq,
      projectId,
      reply,
    },
    target,
  );
}

function onHello(m: Extract<SyncMsg, { t: 'hello' }>, from: string): void {
  const known = !!peersState()[from];
  const name = String(m.name ?? '').trim().slice(0, 24) || 'Someone';
  const color = /^#[0-9a-f]{3,8}$/i.test(String(m.color)) ? m.color : '#888';
  updatePeer(from, { name, color, isHost: m.isHost, synced: m.synced });
  if (!known) {
    lostPeerAt = null;
    reconnectBackoff = 8000;
  }
  if (!known) refreshConnectedStatus();
  if (!known) {
    if (synced) toast(`${name} joined the session`);
    if (!m.reply) sayHello(from, true);
  }
  if (m.isHost) {
    if (isHost && from !== selfId) {
      // Two hosts (e.g. both thought they were alone). Lowest id keeps hosting.
      if (selfId > from) {
        isHost = false;
        hostId = from;
        useCollab.setState({ hostId: from });
        if (hashTimer) clearInterval(hashTimer);
        // Edits sequenced on our side of the split: hand them to the winning host as ordinary
        // client ops (kept pending so they're re-applied on top of its snapshot).
        flush();
        clearPending();
        for (const op of splitLog) {
          addPending(op.opId, op.d);
          send({ t: 'op', opId: op.opId, d: op.d }, from);
        }
        splitLog = [];
        awaitingSnapshot = false;
        requestSnapshot('two hosts — merging with the other copy');
        setStatus('syncing', 'Reconnected — merging your changes…');
      }
      return;
    }
    const changedHost = hostId !== from;
    hostId = from;
    useCollab.setState({ hostId: from });
    if (aloneTimer) {
      clearTimeout(aloneTimer);
      aloneTimer = null;
    }
    if (!synced) {
      if (!awaitingSnapshot) {
        setStatus('syncing', `Downloading the song from ${m.name}…`);
        useCollab.setState({ joinProgress: 0 });
        requestSnapshot('joining');
      }
    } else if (changedHost || hostChanged) {
      // New host after a hand-over: resend our unacknowledged edits, then re-sync from its copy
      // (sequence numbers restart from the new host's position).
      hostChanged = false;
      for (const op of pendingOps) send({ t: 'op', opId: op.opId, d: op.d }, from);
      awaitingSnapshot = false;
      requestSnapshot('new host');
    }
  } else if (!hostId && m.hostId && m.hostId !== selfId) {
    hostId = m.hostId;
    useCollab.setState({ hostId: m.hostId });
  }
}

function onPeerLeave(id: string, deliberate = false): void {
  const p = peersState()[id];
  // An unexpected disconnect may be a network split: only keep what we sequence from now on.
  if (!deliberate && p && isHost) splitLog = [];
  if (!deliberate && p) {
    lostPeerAt ??= Date.now();
    lostPeerName = p.name;
  }
  const peers = { ...peersState() };
  delete peers[id];
  useCollab.setState({ peers });
  latency.delete(id);
  if (p) toast(`${p.name} left the session`);
  if (id === hostId) {
    if (!synced) {
      // We were still downloading from them; wait for whoever takes over.
      awaitingSnapshot = false;
      hostId = null;
      useCollab.setState({ hostId: null, joinProgress: null });
      setStatus('connecting', 'The host left — waiting for the session to continue…');
    } else electHost();
  }
  refreshConnectedStatus();
}

// ------------------------------------------------------------------ audio clips

async function fetchMissingAudio(): Promise<void> {
  const p = useStore.getState().project;
  if (!p || !room) return;
  const ids = projectAudioIds(p).filter((id) => !getBuffer(id));
  if (!ids.length) return;
  await ensureClips(ids);
  const now = Date.now();
  for (const id of ids) {
    if (getBuffer(id)) continue;
    const req = clipRequests.get(id);
    if (req && now - req.at < 12000) continue; // still waiting on an answer
    askForClip(id, req?.tried ?? new Set());
  }
}

/** Ask the most likely peer for a clip: whoever introduced it, then the host, then everyone else. */
function askForClip(id: string, tried: Set<string>): void {
  const peerIds = Object.keys(peersState());
  const origin = clipOrigin.get(id);
  const order = [origin, hostId, ...peerIds].filter((x, i, a): x is string => !!x && x !== selfId && peerIds.includes(x) && a.indexOf(x) === i);
  let target = order.find((x) => !tried.has(x));
  if (!target) {
    tried.clear(); // everyone said no — start over later (someone may have finished receiving it)
    target = order[0];
  }
  if (!target) return;
  tried.add(target);
  clipRequests.set(id, { at: Date.now(), asked: target, tried });
  send({ t: 'clipReq', id }, target);
}

function noteClipOrigins(d: Delta, from: string): void {
  for (const { region } of d.regions ?? [])
    if (region.kind === 'audio') {
      clipOrigin.set(region.audioId, from);
      for (const k of region.takes ?? []) clipOrigin.set(k.audioId, from);
    }
  for (const t of d.tracks ?? []) if (t.samplerAudioId) clipOrigin.set(t.samplerAudioId, from);
}

async function onClipReq(id: string, from: string): Promise<void> {
  const rec = await getClipBlob(id);
  if (!clipSend) return;
  if (!rec) {
    send({ t: 'clipNo', id }, from);
    return;
  }
  useCollab.setState((s) => ({ transfers: { ...s.transfers, ['out:' + id]: { id, name: rec.name, progress: 0, direction: 'out' } } }));
  try {
    await clipSend(rec.blob, from, { id, name: rec.name, type: rec.blob.type });
  } finally {
    useCollab.setState((s) => {
      const t = { ...s.transfers };
      delete t['out:' + id];
      return { transfers: t };
    });
  }
}

async function onClip(data: ArrayBuffer, meta: { id: string; name: string; type: string }): Promise<void> {
  useCollab.setState((s) => {
    const t = { ...s.transfers };
    delete t['in:' + meta.id];
    return { transfers: t };
  });
  if (getBuffer(meta.id)) return;
  try {
    await addClip(meta.id, new Blob([data], { type: meta.type }), meta.name);
    clipRequests.delete(meta.id);
    const p = useStore.getState().project;
    if (p) await getEngine().loadProjectAudio(p);
  } catch (e) {
    console.warn('[jam] clip decode failed', e);
  }
}

// ------------------------------------------------------------------ presence & transport

function schedulePresence(): void {
  if (presenceTimer) return;
  presenceTimer = setTimeout(() => {
    presenceTimer = null;
    const s = useStore.getState();
    const engine = getEngine();
    presSend?.({
      sel: s.selectedTrackId,
      reg: s.dockTab === 'editor' ? s.editingRegionId ?? s.selectedRegionIds[0] ?? null : s.selectedRegionIds[0] ?? null,
      playing: s.playing,
      pos: engine.position,
      bpm: s.project?.bpm ?? 120,
    }).catch(() => {});
  }, PRESENCE_MS);
}

function onTransport(m: TransportMsg, from: string): void {
  if (!useCollab.getState().playTogether) return;
  // Never let someone else's play/stop/seek cut into your own recording take.
  if (useStore.getState().recording) return;
  const engine = getEngine();
  const bpm = useStore.getState().project?.bpm ?? 120;
  const oneWay = (latency.get(from) ?? 60) / 2000; // seconds
  ignoreTransportUntil = performance.now() + 600;
  if (m.cmd === 'stop') engine.stop(false);
  else void engine.play(Math.max(0, m.pos + (m.cmd === 'play' || engine.isPlaying ? (oneWay * bpm) / 60 : 0)));
}

// ------------------------------------------------------------------ store subscription

function subscribeStore(): void {
  unsubStore?.();
  unsubStore = useStore.subscribe((s, prev) => {
    if (!room) return;
    // Leaving the song (back to My Songs or opening another song) ends participation.
    if (synced && projectId && (s.screen !== 'project' || (s.project && s.project.id !== projectId)) && !applyingRemote) {
      // Edits made just before navigating away may still be waiting in the 50ms batch:
      // send them from the song as it was, before it was closed.
      if (prev.project?.id === projectId) flush(prev.project);
      const others = Object.keys(peersState()).length;
      void leaveSession(
        true,
        s.screen !== 'project'
          ? `You left the jam session${others ? ' — the others can keep jamming' : ''}. Your copy of the song is saved.`
          : `You left the jam session to open another song${others ? ' — the others can keep jamming' : ''}.`,
      );
      return;
    }
    if (s.project !== prev.project && !applyingRemote && s.project?.id === projectId) {
      if (!baseline) baseline = s.project;
      else scheduleFlush();
    }
    if (
      s.selectedTrackId !== prev.selectedTrackId ||
      s.editingRegionId !== prev.editingRegionId ||
      s.selectedRegionIds !== prev.selectedRegionIds ||
      s.playing !== prev.playing ||
      s.dockTab !== prev.dockTab
    )
      schedulePresence();
    // Play together
    if (useCollab.getState().playTogether && performance.now() > ignoreTransportUntil) {
      const engine = getEngine();
      if (s.playing !== prev.playing) xportSend?.({ cmd: s.playing ? 'play' : 'stop', pos: s.playing ? engine.position : s.cursor }).catch(() => {});
      else if (s.playing && s.cursor !== prev.cursor) xportSend?.({ cmd: 'seek', pos: s.cursor }).catch(() => {});
    }
  });
}

// ------------------------------------------------------------------ connect / leave

function onPageHide(): void {
  if (!room || !syncSend) return;
  // Send edits still waiting in the 50ms batch before the page goes away.
  flush();
  // Best effort, sent directly (not queued) so it goes out before the page is gone.
  void syncSend({ t: 'bye' }, null).catch(() => {});
}

function connect(roomCode: string, reconnecting = false): void {
  const myGen = ++gen;
  // While leaving (draining) only the sync channel stays live, for goodbye acknowledgements.
  const live = () => myGen === gen && !draining;
  const liveSync = () => myGen === gen;
  window.removeEventListener('pagehide', onPageHide);
  window.addEventListener('pagehide', onPageHide);
  code = roomCode;
  if (reconnecting) useCollab.setState({ peers: {}, transfers: {} });
  else useCollab.setState({ code: roomCode, selfId, peers: {}, chat: [], unread: 0, transfers: {} });
  room = joinRoom(
    {
      appId: APP_ID,
      password: roomCode,
      relayConfig: { redundancy: 8, warnOnRelayFailure: false },
      rtcConfig: {
        iceServers: [
          { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      },
    },
    'jam-' + roomCode,
    {
      onJoinError: (e) => {
        if (!live()) return;
        console.warn('[jam] join error', e);
        const msg = /password/i.test(e.error)
          ? 'That code does not match this session.'
          : "Couldn't connect directly to a collaborator — their network or firewall may block peer-to-peer connections. Still trying…";
        if (!Object.keys(peersState()).length) setStatus(synced ? 'waiting' : 'error', msg);
        else toast(msg, 'error');
      },
    },
  );

  const sync = room.makeAction('sync');
  syncSend = (m, target) => sync.send(m as never, { target: target ?? null });
  sync.onMessage = (m, { peerId }) => {
    if (liveSync()) onSyncMessage(m as unknown as SyncMsg, peerId);
  };

  const snap = room.makeAction('snap');
  snapSend = (m, target) => snap.send(m as never, { target });
  snap.onMessage = (m, { peerId }) => void (live() && receiveSnapshot(m as unknown as SnapshotMsg, peerId));
  snap.onReceiveProgress = (p) => {
    if (!live()) return;
    lastSnapProgress = Date.now();
    if (!synced) useCollab.setState({ joinProgress: p });
  };

  const pres = room.makeAction('pres');
  presSend = (m) => pres.send(m as never);
  pres.onMessage = (raw, { peerId }) => {
    if (!live()) return;
    const m = raw as unknown as PresenceMsg;
    updatePeer(peerId, { selectedTrackId: m.sel, editingRegionId: m.reg, playing: m.playing, position: m.pos, posAt: performance.now() - (latency.get(peerId) ?? 60) / 2, bpm: m.bpm });
  };

  const xport = room.makeAction('xport');
  xportSend = (m) => xport.send(m as never);
  xport.onMessage = (m, { peerId }) => {
    if (live()) onTransport(m as unknown as TransportMsg, peerId);
  };

  const chat = room.makeAction('chat');
  chatSend = (m) => chat.send(m as never);
  chat.onMessage = (raw, { peerId }) => {
    if (!live()) return;
    const m = raw as unknown as ChatMsg;
    useCollab.setState((s) => ({
      chat: [...s.chat.slice(-199), { id: String(m.id), from: peerId, name: String(m.name ?? '').slice(0, 24), color: /^#[0-9a-f]{3,8}$/i.test(String(m.color)) ? m.color : '#888', text: String(m.text ?? '').slice(0, 500), at: Date.now() }],
      unread: s.chatOpen ? 0 : s.unread + 1,
    }));
  };

  const clip = room.makeAction('clip');
  clipSend = (data, target, meta) =>
    clip.send(data, {
      target,
      metadata: meta,
      onProgress: (p) =>
        useCollab.setState((s) => (s.transfers['out:' + meta.id] ? { transfers: { ...s.transfers, ['out:' + meta.id]: { ...s.transfers['out:' + meta.id], progress: p } } } : {})),
    });
  clip.onMessage = (data, { metadata }) => void (live() && onClip(data as ArrayBuffer, metadata as { id: string; name: string; type: string }));
  clip.onReceiveProgress = (p, { metadata }) => {
    if (!live()) return;
    const m = metadata as { id: string; name: string } | undefined;
    if (!m) return;
    useCollab.setState((s) => ({ transfers: { ...s.transfers, ['in:' + m.id]: { id: m.id, name: m.name, progress: p, direction: 'in' } } }));
  };

  room.onPeerJoin = (id) => {
    if (!live()) return;
    sayHello(id);
    if (synced) {
      // Bring them up to date on where we are.
      schedulePresence();
    }
    void room?.ping(id).then((ms) => latency.set(id, ms)).catch(() => {});
  };
  room.onPeerLeave = (id) => {
    if (live()) onPeerLeave(id);
  };

  subscribeStore();

  // Status watchdog: relay connectivity, ack timeouts, latency refresh.
  if (statusTimer) clearInterval(statusTimer);
  let ticks = 0;
  statusTimer = setInterval(() => {
    if (!live()) return;
    ticks++;
    const st = useCollab.getState().status;
    const sockets = Object.values((getRelaySockets() ?? {}) as Record<string, WebSocket>);
    const anyOpen = sockets.some((w) => w && w.readyState === WebSocket.OPEN);
    if (!anyOpen && ticks > 5 && !Object.keys(peersState()).length) {
      setStatus(synced ? 'waiting' : 'error', "Can't reach the matchmaking servers. Check your internet connection — still trying…");
    } else if (anyOpen && st === 'error' && /matchmaking/.test(useCollab.getState().message)) {
      if (synced) refreshConnectedStatus();
      else setStatus('connecting', 'Looking for the session…');
    }
    // A collaborator vanished without a goodbye and nobody is connected: re-enter the room so
    // fresh announcements go out right away (otherwise reconnection can take a minute).
    if (lostPeerAt && !Object.keys(peersState()).length && synced) {
      const now = Date.now();
      if (now - lostPeerAt > 5000 && now - lastReconnectAt > reconnectBackoff) {
        lastReconnectAt = now;
        reconnectBackoff = Math.min(60000, reconnectBackoff * 2);
        void reconnectRoom();
        return;
      }
    }
    // Still trying to join and nobody has answered: re-enter the room so fresh announcements go
    // out (the host may have still been tearing down an old connection to us, after which the
    // relays only re-announce once a minute).
    if (!synced && !hostId && !Object.keys(peersState()).length && joinStartedAt) {
      const now = Date.now();
      if (now - joinStartedAt > 7000 && now - lastReconnectAt > reconnectBackoff) {
        lastReconnectAt = now;
        reconnectBackoff = Math.min(60000, reconnectBackoff * 2);
        void reconnectRoom();
        return;
      }
    }
    // A snapshot download that stalled (e.g. the connection hiccupped mid-transfer): ask again.
    if (awaitingSnapshot && hostId && !isHost) {
      const now = Date.now();
      if (now - lastSnapReq > 15000 && now - lastSnapProgress > 8000) requestSnapshot('snapshot download stalled');
    }
    // Resend edits the host never acknowledged.
    if (!isHost && hostId && pendingOps.length) {
      const now = Date.now();
      for (const op of pendingOps)
        if (now - op.sentAt > ACK_TIMEOUT_MS) {
          op.sentAt = now;
          send({ t: 'op', opId: op.opId, d: op.d }, hostId);
        }
    }
    if (ticks % 10 === 0) for (const id of Object.keys(peersState())) void room?.ping(id).then((ms) => latency.set(id, ms)).catch(() => {});
    if (ticks % 5 === 0) void fetchMissingAudio();
  }, 1000);
}

/** Leave and re-enter the same room without touching the session/sync state. */
async function reconnectRoom(): Promise<void> {
  const r = room;
  const c = code;
  if (!r || !c) return;
  const myGen = gen;
  console.info('[jam] reconnecting to the room');
  try {
    for (const pc of Object.values(r.getPeers())) pc.close();
  } catch {
    /* ignore */
  }
  await r.leave().catch(() => {});
  // Someone left the session (or another reconnect started) while we were waiting.
  if (myGen !== gen || room !== r) return;
  room = null;
  connect(c, true);
  if (isHost) startHashTimer();
  refreshConnectedStatus();
}

function onSyncMessage(m: SyncMsg, from: string): void {
  if (draining) {
    if (m.t === 'byeAck' && byeWaiting) {
      byeWaiting.delete(from);
      if (!byeWaiting.size) byeAllAcked?.();
    }
    return;
  }
  switch (m.t) {
    case 'hello':
      onHello(m, from);
      break;
    case 'op':
      if (isHost) hostApplyOp(from, m.opId, m.d);
      break;
    case 'seq':
      handleSeq(m, from);
      break;
    case 'ack':
      ackPending(m.opId);
      break;
    case 'hash': {
      if (isHost || from !== hostId || !synced || awaitingSnapshot) break;
      const p = useStore.getState().project;
      if (!p || m.seq !== seq || pendingOps.length || reorder.size || p !== baseline || flushTimer) break;
      if (hashProject(p) !== m.hash) requestSnapshot('state differs from host');
      break;
    }
    case 'snapReq':
      if (isHost) {
        flush();
        sendSnapshot(from);
      }
      break;
    case 'clipReq':
      void onClipReq(m.id, from);
      break;
    case 'clipNo': {
      const req = clipRequests.get(m.id);
      if (req && req.asked === from && !getBuffer(m.id)) askForClip(m.id, req.tried);
      break;
    }
    case 'byeAck':
      break;
    case 'bye': {
      // Acknowledge first: it tells them everything they sent before reached us.
      void syncSend?.({ t: 'byeAck' }, from).catch(() => {});
      // The peer is closing their tab: treat as left right away instead of waiting for a timeout,
      // and drop our side of the connection so a later rejoin gets a clean handshake.
      if (peersState()[from]) onPeerLeave(from, true);
      const r = room;
      setTimeout(() => {
        try {
          if (r && r === room) r.getPeers()[from]?.close();
        } catch {
          /* ignore */
        }
      }, 500);
      break;
    }
  }
}

/** Start a new session hosting the open song. Returns the room code. */
export async function startSession(roomCode: string): Promise<void> {
  // Finish leaving any previous room first: re-joining a room that is still closing would
  // hand back the old, half-closed room.
  if (room) await leaveSession(true);
  const p = useStore.getState().project;
  if (!p) return;
  projectId = p.id;
  joinedHere.set(roomCode, p.id);
  isHost = true;
  hostId = selfId;
  synced = true;
  seq = 0;
  baseline = p;
  clearPending();
  reorder.clear();
  seenOps.clear();
  useCollab.setState({ hostId: selfId, joinProgress: null });
  setStatus('waiting', 'Waiting for others to join. Share the link or code.');
  connect(roomCode);
  startHashTimer();
  persistSession();
  setUrlCode(roomCode);
}

/**
 * Join an existing session. If nobody answers and we already have this session's song
 * locally (e.g. after a page reload), we continue the session as host.
 */
/**
 * Sessions this tab has already been part of, with the song id we had for each.
 * Trystero's peer id is fixed for the life of the page, and the other peers keep handshake
 * state about that id for a while after we leave — so re-entering the same room from this tab
 * can stall for 20s+. Rejoining instead reloads the page (fresh identity) and resumes through
 * the normal reload-rejoin path, which reopens our saved copy of the song.
 */
const joinedHere = new Map<string, string>();

async function rejoinViaReload(roomCode: string, songId: string): Promise<void> {
  await flushSave();
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: roomCode, projectId: songId }));
  } catch {
    /* ignore */
  }
  setStatus('connecting', 'Rejoining the session…');
  location.hash = 'jam=' + roomCode;
  location.reload();
}

export async function joinSession(roomCode: string, localProjectId?: string): Promise<void> {
  if (room && code === roomCode && !draining) return; // already in this session
  if (room) await leaveSession(true);
  const previous = joinedHere.get(roomCode);
  if (previous !== undefined) {
    await rejoinViaReload(roomCode, localProjectId ?? previous);
    return;
  }
  joinedHere.set(roomCode, localProjectId ?? '');
  isHost = false;
  hostId = null;
  synced = false;
  seq = 0;
  baseline = null;
  projectId = localProjectId ?? null;
  clearPending();
  reorder.clear();
  awaitingSnapshot = false;
  useCollab.setState({ hostId: null, joinProgress: null });
  setStatus('connecting', 'Looking for the session…');
  joinStartedAt = Date.now();
  lastReconnectAt = 0;
  reconnectBackoff = 7000;
  connect(roomCode);
  setUrlCode(roomCode);
  if (aloneTimer) clearTimeout(aloneTimer);
  aloneTimer = setTimeout(() => {
    aloneTimer = null;
    if (synced || hostId) return;
    const s = useStore.getState();
    if (localProjectId && s.project?.id === localProjectId) {
      synced = true;
      projectId = localProjectId;
      persistSession();
      becomeHost('nobody else is here and we have the song');
      return;
    }
    if (useCollab.getState().status === 'connecting')
      setStatus('waiting', "Nobody from this session is online yet. Make sure the person who invited you still has the song open — we'll connect automatically when they are.");
  }, ALONE_HOST_MS);
}

/** Peers that still have to acknowledge our goodbye while we leave, and who to tell when they all have. */
let byeWaiting: Set<string> | null = null;
let byeAllAcked: (() => void) | null = null;
/** True while leaving: only goodbye acknowledgements are processed. */
let draining = false;
let leavingPromise: Promise<void> | null = null;

export function leaveSession(silent = false, why?: string): Promise<void> {
  leavingPromise ??= doLeave(silent, why).finally(() => {
    leavingPromise = null;
  });
  return leavingPromise;
}

async function doLeave(silent: boolean, why?: string): Promise<void> {
  flush();
  const r = room;
  // Who must acknowledge our goodbye (read before the UI state below is cleared).
  const peerIds = Object.keys(peersState());
  // Stop reacting to the song and tell the user straight away; the network goodbye below
  // happens in the background.
  unsubStore?.();
  unsubStore = null;
  draining = true;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  setUrlCode(null);
  useCollab.setState({ status: 'idle', message: '', code: null, hostId: null, peers: {}, transfers: {}, joinProgress: null, chatOpen: false, unread: 0 });
  if (why) toast(why);
  else if (!silent) toast('You left the jam session');

  // Goodbye handshake. The data channel is ordered, so once a peer acknowledges our goodbye it
  // has also received every edit we sent before it. Connections can stall for a few seconds
  // (e.g. while the network path changes) — closing too early would silently drop our last
  // edits and leave us "online" on everyone else's screen until their connection timed out.
  if (r && syncSend && peerIds.length) {
    const fn = syncSend;
    await new Promise<void>((res) => {
      byeWaiting = new Set(peerIds);
      byeAllAcked = res;
      // Generous: this runs in the background and a stalled path can take several seconds
      // (retransmission backoff) to recover.
      setTimeout(res, 10000);
      void fn({ t: 'bye' }, null).catch(() => res());
    });
    byeWaiting = null;
    byeAllAcked = null;
  }

  room = null;
  gen++;
  draining = false;
  if (flushTimer) clearTimeout(flushTimer);
  if (hashTimer) clearInterval(hashTimer);
  if (statusTimer) clearInterval(statusTimer);
  if (aloneTimer) clearTimeout(aloneTimer);
  if (gapTimer) clearTimeout(gapTimer);
  if (presenceTimer) clearTimeout(presenceTimer);
  flushTimer = hashTimer = statusTimer = aloneTimer = gapTimer = presenceTimer = null;
  window.removeEventListener('pagehide', onPageHide);
  syncSend = snapSend = presSend = xportSend = chatSend = null;
  clipSend = null;
  sendChain = Promise.resolve();
  clearPending();
  reorder.clear();
  seenOps.clear();
  clipRequests.clear();
  splitLog = [];
  lostPeerAt = null;
  reconnectBackoff = 8000;
  joinStartedAt = 0;
  isHost = false;
  hostId = null;
  hostChanged = false;
  synced = false;
  code = null;
  projectId = null;
  baseline = null;
  awaitingSnapshot = false;
  if (r) {
    let pcs: RTCPeerConnection[] = [];
    try {
      pcs = Object.values(r.getPeers());
    } catch {
      /* ignore */
    }
    await r.leave().catch(() => {});
    // Close the WebRTC connections outright. Trystero otherwise keeps them alive for reuse,
    // and the other side would keep treating us as connected until they timed out.
    for (const pc of pcs) {
      try {
        pc.close();
      } catch {
        /* already closed */
      }
    }
  }
}

export function sendChat(text: string): void {
  const t = text.trim();
  if (!t || !chatSend) return;
  identity = loadIdentity();
  const m: ChatMsg = { id: selfId + ':' + Date.now(), text: t.slice(0, 500), name: identity.name, color: identity.color };
  void chatSend(m).catch(() => {});
  useCollab.setState((s) => ({ chat: [...s.chat.slice(-199), { id: m.id, from: selfId, name: m.name, color: m.color, text: m.text, at: Date.now() }] }));
}

/** Re-announce our name/colour after the user changes them. */
export function announceIdentity(): void {
  if (room) sayHello(null);
}

/** Debug/test hook: internal sync state. */
export function debugState() {
  const p = useStore.getState().project;
  return {
    selfId,
    isHost,
    hostId,
    synced,
    seq,
    pending: pendingOps.length,
    reorder: reorder.size,
    awaitingSnapshot,
    hash: p ? hashProject(p) : null,
    peers: Object.keys(peersState()),
  };
}
