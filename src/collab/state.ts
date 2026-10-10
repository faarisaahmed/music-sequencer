// Lightweight collaboration UI state. The networking code (session.ts) is lazy-loaded;
// this module stays tiny so the rest of the app can read presence cheaply.
import { create } from 'zustand';

export type CollabStatus = 'idle' | 'connecting' | 'waiting' | 'syncing' | 'connected' | 'error';

export interface Peer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  synced: boolean;
  selectedTrackId: string | null;
  editingRegionId: string | null;
  playing: boolean;
  /** Song position (beats) at `posAt` (local performance.now()). */
  position: number;
  posAt: number;
  bpm: number;
}

export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  color: string;
  text: string;
  at: number;
}

export interface Transfer {
  id: string;
  name: string;
  progress: number; // 0..1
  direction: 'in' | 'out';
}

export interface CollabState {
  status: CollabStatus;
  /** Human-readable explanation of the current status / problem. */
  message: string;
  code: string | null;
  selfId: string | null;
  hostId: string | null;
  peers: Record<string, Peer>;
  chat: ChatMessage[];
  unread: number;
  chatOpen: boolean;
  transfers: Record<string, Transfer>;
  playTogether: boolean;
  /** 0..1 while downloading the song when joining. */
  joinProgress: number | null;
}

export const useCollab = create<CollabState>(() => ({
  status: 'idle',
  message: '',
  code: null,
  selfId: null,
  hostId: null,
  peers: {},
  chat: [],
  unread: 0,
  chatOpen: false,
  transfers: {},
  playTogether: true,
  joinProgress: null,
}));

export function inSession(): boolean {
  const s = useCollab.getState().status;
  return s !== 'idle';
}

// ------------------------------------------------------------------ identity

const ADJ = ['Funky', 'Mellow', 'Groovy', 'Bright', 'Smooth', 'Jazzy', 'Cosmic', 'Electric', 'Velvet', 'Golden', 'Lucky', 'Breezy'];
const NOUN = ['Bass', 'Drummer', 'Keys', 'Fiddle', 'Trumpet', 'Synth', 'Cello', 'Guitar', 'Harp', 'Banjo', 'Sax', 'Piano'];
export const PEER_COLORS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#a9e34b'];

export function loadIdentity(): { name: string; color: string } {
  let name = '';
  let color = '';
  try {
    name = localStorage.getItem('bf.jam.name') ?? '';
    color = localStorage.getItem('bf.jam.color') ?? '';
  } catch {
    /* storage unavailable */
  }
  if (!name) name = ADJ[Math.floor(Math.random() * ADJ.length)] + ' ' + NOUN[Math.floor(Math.random() * NOUN.length)];
  if (!PEER_COLORS.includes(color)) color = PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
  return { name, color };
}

export function saveIdentity(name: string, color: string): void {
  try {
    localStorage.setItem('bf.jam.name', name);
    localStorage.setItem('bf.jam.color', color);
  } catch {
    /* storage unavailable */
  }
}

// ------------------------------------------------------------------ room codes

// No 0/O, 1/I/L: easy to read aloud and type.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function makeRoomCode(): string {
  const pick = () => {
    const a = new Uint32Array(8);
    crypto.getRandomValues(a);
    return Array.from(a, (n) => CODE_CHARS[n % CODE_CHARS.length]).join('');
  };
  const s = pick();
  return s.slice(0, 4) + '-' + s.slice(4);
}

/** Normalise user input ("abcd efgh", "abcd-efgh", full links) to "ABCD-EFGH", or null if invalid. */
export function normalizeCode(input: string): string | null {
  const m = /#jam=([A-Za-z0-9-]+)/.exec(input);
  const raw = (m ? m[1] : input).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 8) return null;
  for (const c of raw) if (!CODE_CHARS.includes(c)) return null;
  return raw.slice(0, 4) + '-' + raw.slice(4);
}

export function shareLink(code: string): string {
  const u = new URL(window.location.href);
  u.hash = 'jam=' + code;
  u.search = '';
  return u.toString();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Peers sorted host-first, then by name. */
export function peerList(peers: Record<string, Peer>): Peer[] {
  return Object.values(peers).sort((a, b) => (a.isHost === b.isHost ? a.name.localeCompare(b.name) : a.isHost ? -1 : 1));
}

/** Lazy entry points (keeps trystero out of the initial bundle). */
export const loadSession = () => import('./session');
