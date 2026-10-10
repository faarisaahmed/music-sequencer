// Jam Session UI: the Collaborate dialog, join prompt, top-bar participants strip,
// connection status pill and chat panel.
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Crown, Link2, LogOut, MessageSquare, Radio, Send, Users, X, Loader2, AlertTriangle } from 'lucide-react';
import { closeModal, openModal, toast, useStore } from '../../state/store';
import { useCollab, loadIdentity, saveIdentity, makeRoomCode, normalizeCode, shareLink, initials, peerList, PEER_COLORS, loadSession, type CollabStatus } from '../../collab/state';
import Modal from '../modals/Modal';
import { Toggle } from '../common/controls';
import './collab.css';

// ------------------------------------------------------------------ identity editor

function IdentityFields({ name, color, onName, onColor }: { name: string; color: string; onName: (v: string) => void; onColor: (v: string) => void }) {
  return (
    <div className="jam-identity">
      <div className="jam-avatar lg" style={{ background: color }}>
        {initials(name || '?')}
      </div>
      <div className="col" style={{ gap: 6, flex: 1 }}>
        <label className="label">Your name</label>
        <input type="text" value={name} maxLength={24} onChange={(e) => onName(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        <div className="jam-colors">
          {PEER_COLORS.map((c) => (
            <button key={c} className={'jam-color' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => onColor(c)} title="Pick your colour" />
          ))}
        </div>
      </div>
    </div>
  );
}

function useIdentity() {
  const [id, setId] = useState(loadIdentity);
  const update = (patch: Partial<typeof id>) => {
    const next = { ...id, ...patch };
    setId(next);
    if (next.name.trim()) saveIdentity(next.name.trim(), next.color);
  };
  return [id, update] as const;
}

function CopyButton({ text, label, icon }: { text: string; label: string; icon: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // Fallback for browsers without clipboard permission.
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check size={14} /> : icon} {done ? 'Copied' : label}
    </button>
  );
}

const STATUS_COLOR: Record<CollabStatus, string> = {
  idle: 'var(--text-faint)',
  connecting: 'var(--orange)',
  waiting: 'var(--yellow)',
  syncing: 'var(--orange)',
  connected: 'var(--green)',
  error: 'var(--record)',
};

export function StatusLine() {
  const status = useCollab((s) => s.status);
  const message = useCollab((s) => s.message);
  return (
    <div className="jam-status">
      {status === 'connecting' || status === 'syncing' ? <Loader2 size={14} className="spin" /> : status === 'error' ? <AlertTriangle size={14} color="var(--record)" /> : <span className="jam-dot" style={{ background: STATUS_COLOR[status] }} />}
      <span>{message}</span>
    </div>
  );
}

// ------------------------------------------------------------------ main dialog

export function CollabDialog() {
  const status = useCollab((s) => s.status);
  const code = useCollab((s) => s.code);
  const peers = useCollab((s) => s.peers);
  const hostId = useCollab((s) => s.hostId);
  const selfId = useCollab((s) => s.selfId);
  const playTogether = useCollab((s) => s.playTogether);
  const project = useStore((s) => s.project);
  const [identity, setIdentity] = useIdentity();
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  // Guards against double-clicks firing twice before React re-renders the disabled button.
  const starting = useRef(false);
  const active = status !== 'idle' && code;

  const start = async () => {
    if (starting.current) return;
    if (!identity.name.trim()) return toast('Pick a name first', 'error');
    starting.current = true;
    setBusy(true);
    try {
      const s = await loadSession();
      await s.startSession(makeRoomCode());
    } finally {
      starting.current = false;
      setBusy(false);
    }
  };
  const join = async () => {
    if (starting.current) return;
    const c = normalizeCode(joinCode);
    if (!c) return toast('That code looks wrong — it should be 8 letters/numbers like ABCD-EFGH', 'error');
    if (!identity.name.trim()) return toast('Pick a name first', 'error');
    starting.current = true;
    closeModal();
    const s = await loadSession();
    await s.joinSession(c);
  };

  if (active) {
    const link = shareLink(code);
    const list = peerList(peers);
    return (
      <Modal
        title={
          <span className="row">
            <Radio size={17} color="var(--green)" /> Jam Session
          </span>
        }
        width={520}
        footer={
          <>
            <button
              className="btn danger"
              onClick={async () => {
                closeModal();
                (await loadSession()).leaveSession();
              }}
            >
              <LogOut size={14} /> Leave Session
            </button>
            <div className="spacer" />
            <button className="btn primary" onClick={closeModal}>
              Done
            </button>
          </>
        }
      >
        <div className="col" style={{ gap: 16 }}>
          <StatusLine />
          <div className="jam-code-box">
            <div className="label">Session code</div>
            <div className="jam-code mono">{code}</div>
            <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
              <CopyButton text={link} label="Copy Invite Link" icon={<Link2 size={14} />} />
              <CopyButton text={code} label="Copy Code" icon={<Copy size={14} />} />
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              Send the link to friends. They open it, type their name, and they're in — no account needed.
            </div>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              In this session
            </div>
            <div className="jam-people">
              <PersonRow name={identity.name + ' (you)'} color={identity.color} host={hostId === selfId} />
              {list.map((p) => (
                <PersonRow key={p.id} name={p.name} color={p.color} host={p.id === hostId} pending={!p.synced} />
              ))}
            </div>
          </div>
          <label className="row jam-toggle-row">
            <Toggle on={playTogether} onChange={(v) => useCollab.setState({ playTogether: v })} />
            <div>
              <div>Play together</div>
              <div className="faint" style={{ fontSize: 12 }}>
                When anyone presses play, stop or moves the playhead, everyone follows.
              </div>
            </div>
          </label>
          <IdentityEditorInline identity={identity} setIdentity={setIdentity} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <span className="row">
          <Users size={17} /> Make music together
        </span>
      }
      width={560}
    >
      <div className="col" style={{ gap: 18 }}>
        <IdentityFields name={identity.name} color={identity.color} onName={(name) => setIdentity({ name })} onColor={(color) => setIdentity({ color })} />
        <div className="jam-choices">
          <div className="jam-card">
            <div className="jam-card-title">
              <Radio size={16} /> Start a session
            </div>
            <div className="faint jam-card-desc">
              {project ? (
                <>
                  Invite people to edit <b>“{project.name}”</b> with you in real time. Everyone hears and sees changes instantly.
                </>
              ) : (
                'Open a song first, then start a session from its Collaborate button.'
              )}
            </div>
            <button className="btn primary" disabled={!project || busy} onClick={() => void start()}>
              {busy ? <Loader2 size={14} className="spin" /> : <Radio size={14} />} Start Session
            </button>
          </div>
          <div className="jam-card">
            <div className="jam-card-title">
              <Users size={16} /> Join a session
            </div>
            <div className="faint jam-card-desc">Got a code or link from a friend? Paste it here.</div>
            <input
              type="text"
              className="mono"
              placeholder="ABCD-EFGH"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') void join();
              }}
            />
            <button className="btn" disabled={!joinCode.trim()} onClick={() => void join()}>
              Join
            </button>
          </div>
        </div>
        <div className="faint" style={{ fontSize: 12 }}>
          Sessions connect browsers directly to each other. Everyone keeps their own saved copy of the song.
        </div>
      </div>
    </Modal>
  );
}

function IdentityEditorInline({ identity, setIdentity }: { identity: { name: string; color: string }; setIdentity: (p: Partial<{ name: string; color: string }>) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
        Change your name or colour
      </button>
    );
  return (
    <div className="col" style={{ gap: 8 }}>
      <IdentityFields name={identity.name} color={identity.color} onName={(name) => setIdentity({ name })} onColor={(color) => setIdentity({ color })} />
      <button
        className="btn sm"
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          (await loadSession()).announceIdentity();
          setOpen(false);
        }}
      >
        Save
      </button>
    </div>
  );
}

function PersonRow({ name, color, host, pending }: { name: string; color: string; host?: boolean; pending?: boolean }) {
  return (
    <div className="jam-person">
      <div className="jam-avatar" style={{ background: color }}>
        {initials(name)}
      </div>
      <span>{name}</span>
      {host && (
        <span className="chip" title="Host — keeps everyone in sync. If they leave, someone else takes over automatically.">
          <Crown size={11} /> Host
        </span>
      )}
      {pending && (
        <span className="chip">
          <Loader2 size={11} className="spin" /> joining
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ join prompt (from a link)

export function JoinDialog() {
  const modal = useStore((s) => s.modal);
  const project = useStore((s) => s.project);
  const code = (modal?.data as { code: string } | undefined)?.code ?? '';
  const [identity, setIdentity] = useIdentity();
  const join = async () => {
    if (!identity.name.trim()) return toast('Pick a name first', 'error');
    closeModal();
    (await loadSession()).joinSession(code);
  };
  return (
    <Modal
      title={
        <span className="row">
          <Users size={17} /> Join jam session
        </span>
      }
      width={480}
      onClose={() => {
        closeModal();
        history.replaceState(null, '', location.pathname + location.search);
      }}
      footer={
        <>
          <button
            className="btn"
            onClick={() => {
              closeModal();
              history.replaceState(null, '', location.pathname + location.search);
            }}
          >
            Not now
          </button>
          <button className="btn primary" onClick={() => void join()}>
            Join Session
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div>
          You've been invited to a session: <b className="mono">{code}</b>
        </div>
        <IdentityFields name={identity.name} color={identity.color} onName={(name) => setIdentity({ name })} onColor={(color) => setIdentity({ color })} />
        {project && (
          <div className="faint" style={{ fontSize: 12 }}>
            You'll switch from “{project.name}” to the shared song. Your song is saved.
          </div>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ top bar strip

export function CollabBar() {
  const status = useCollab((s) => s.status);
  const peers = useCollab((s) => s.peers);
  const hostId = useCollab((s) => s.hostId);
  const unread = useCollab((s) => s.unread);
  const chatOpen = useCollab((s) => s.chatOpen);
  const message = useCollab((s) => s.message);
  const transfers = useCollab((s) => s.transfers);
  if (status === 'idle')
    return (
      <button className="btn tb jam-open" title="Collaborate — make music together in real time" onClick={() => openModal('collab')}>
        <Users size={17} />
        <span className="tb-jam-label">Jam</span>
      </button>
    );
  const list = peerList(peers);
  const incoming = Object.values(transfers).filter((t) => t.direction === 'in');
  return (
    <div className="jam-bar">
      <button className="jam-bar-main" onClick={() => openModal('collab')} title={message}>
        <span className="jam-dot" style={{ background: STATUS_COLOR[status] }} />
        {list.length === 0 ? (
          <span className="jam-bar-label">{status === 'connecting' || status === 'syncing' ? 'Connecting' : 'Invite'}</span>
        ) : (
          <div className="jam-stack">
            {list.slice(0, 4).map((p) => (
              <div key={p.id} className="jam-avatar sm" style={{ background: p.color }} title={p.name + (p.id === hostId ? ' (host)' : '')}>
                {initials(p.name)}
                {p.id === hostId && <Crown size={8} className="jam-crown" />}
              </div>
            ))}
            {list.length > 4 && <div className="jam-avatar sm more">+{list.length - 4}</div>}
          </div>
        )}
      </button>
      {incoming.length > 0 && (
        <span className="chip" title="Receiving audio from collaborators">
          <Loader2 size={11} className="spin" /> audio {Math.round((incoming[0].progress ?? 0) * 100)}%
        </span>
      )}
      <button className={'btn icon tb' + (chatOpen ? ' active' : '')} title="Chat" onClick={() => useCollab.setState({ chatOpen: !chatOpen, unread: 0 })}>
        <MessageSquare size={16} />
        {unread > 0 && <span className="jam-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ chat

export function ChatPanel() {
  const open = useCollab((s) => s.chatOpen);
  const chat = useCollab((s) => s.chat);
  const selfId = useCollab((s) => s.selfId);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chat, open]);
  if (!open) return null;
  const sendIt = async () => {
    if (!text.trim()) return;
    (await loadSession()).sendChat(text);
    setText('');
  };
  return (
    <div className="jam-chat">
      <div className="jam-chat-head">
        <MessageSquare size={14} /> Chat
        <div className="spacer" />
        <button className="btn ghost icon sm" onClick={() => useCollab.setState({ chatOpen: false })}>
          <X size={14} />
        </button>
      </div>
      <div className="jam-chat-list" ref={listRef}>
        {chat.length === 0 && <div className="faint" style={{ padding: 12, fontSize: 12 }}>Say hi to your bandmates.</div>}
        {chat.map((m) => (
          <div key={m.id} className={'jam-msg' + (m.from === selfId ? ' me' : '')}>
            <span className="jam-msg-name" style={{ color: m.color }}>
              {m.from === selfId ? 'You' : m.name}
            </span>
            <span className="jam-msg-text">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="jam-chat-input">
        <input
          type="text"
          placeholder="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') void sendIt();
          }}
        />
        <button className="btn icon" onClick={() => void sendIt()} title="Send">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ global status pill (joining)

/** Shown while joining (on any screen) so people always know what's happening. */
export function JamStatusPill() {
  const status = useCollab((s) => s.status);
  const message = useCollab((s) => s.message);
  const joinProgress = useCollab((s) => s.joinProgress);
  const screen = useStore((s) => s.screen);
  const show = status === 'connecting' || status === 'syncing' || (status === 'error' && screen === 'home') || (status === 'waiting' && screen === 'home');
  if (!show) return null;
  return (
    <div className="jam-pill">
      {status === 'error' ? <AlertTriangle size={15} color="var(--record)" /> : <Loader2 size={15} className="spin" />}
      <span>
        {message}
        {joinProgress !== null && joinProgress > 0 && joinProgress < 1 ? ` ${Math.round(joinProgress * 100)}%` : ''}
      </span>
      <button
        className="btn sm"
        onClick={async () => {
          (await loadSession()).leaveSession(true);
        }}
      >
        Cancel
      </button>
    </div>
  );
}

