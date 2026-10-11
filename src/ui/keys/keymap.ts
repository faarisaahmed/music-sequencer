// One place for every keyboard shortcut: what each command is called, its default keys,
// where it applies, and the user's own key choices (saved in this browser).
import { create } from 'zustand';

/** Where a command listens. `global` works everywhere in a song. */
export type KeyContext = 'global' | 'tracks' | 'score' | 'pianoroll' | 'steps';

export interface Command {
  id: string;
  label: string;
  category: string;
  keys: string[];
  contexts: KeyContext[];
}

const C = (id: string, label: string, category: string, keys: string[], contexts: KeyContext[] = ['global']): Command => ({ id, label, category, keys, contexts });
const NOTES: KeyContext[] = ['pianoroll'];
const EDIT: KeyContext[] = ['tracks', 'score', 'pianoroll'];

export const COMMANDS: Command[] = [
  // Playback
  C('transport.play', 'Play / Stop', 'Playback', ['Space']),
  C('transport.record', 'Record', 'Playback', ['R']),
  C('transport.toStart', 'Go to beginning', 'Playback', ['Enter', 'Home']),
  C('transport.prevBar', 'Previous bar', 'Playback', [',']),
  C('transport.nextBar', 'Next bar', 'Playback', ['.']),
  C('transport.cycle', 'Loop (cycle) on / off', 'Playback', ['C']),
  C('transport.loopSelection', 'Loop the selected bars', 'Playback', ['Shift+C']),
  C('transport.metronome', 'Metronome on / off', 'Playback', ['K']),
  C('steps.playPattern', 'Play pattern on its own', 'Playback', ['Shift+Space'], ['steps']),
  // Song
  C('edit.undo', 'Undo', 'Song', ['Mod+Z']),
  C('edit.redo', 'Redo', 'Song', ['Mod+Shift+Z', 'Mod+Y']),
  C('song.save', 'Save', 'Song', ['Mod+S']),
  C('song.export', 'Export', 'Song', ['Mod+E']),
  C('song.newTrack', 'New track', 'Song', ['Mod+Alt+N']),
  C('track.prev', 'Select track above', 'Song', ['ArrowUp'], ['tracks']),
  C('track.next', 'Select track below', 'Song', ['ArrowDown'], ['tracks']),
  C('track.mute', 'Mute selected track', 'Song', ['M']),
  C('track.solo', 'Solo selected track', 'Song', ['S']),
  C('tracks.prevBar', 'Playhead back a bar', 'Song', ['ArrowLeft'], ['tracks']),
  C('tracks.nextBar', 'Playhead forward a bar', 'Song', ['ArrowRight'], ['tracks']),
  // Windows
  C('view.editor', 'Editor', 'Windows', ['E']),
  C('view.instrument', 'Instrument / keyboard', 'Windows', ['P']),
  C('view.mixer', 'Mixer', 'Windows', ['X']),
  C('view.fx', 'Smart Controls & FX', 'Windows', ['B']),
  C('view.chords', 'Chord Track', 'Windows', ['W']),
  C('view.sounds', 'Sounds library', 'Windows', ['Y']),
  C('view.fullScore', 'Full score (whole song as sheet music)', 'Windows', ['Alt+F']),
  C('view.musicalTyping', 'Musical typing on / off', 'Windows', ['Mod+Shift+K']),
  C('view.zoomIn', 'Zoom in', 'Windows', ['Mod+=']),
  C('view.zoomOut', 'Zoom out', 'Windows', ['Mod+-']),
  C('view.shortcuts', 'Keyboard shortcuts & help', 'Windows', ['?']),
  // Editing (regions in the tracks area, notes in the editors)
  C('edit.copy', 'Copy', 'Editing', ['Mod+C'], EDIT),
  C('edit.cut', 'Cut', 'Editing', ['Mod+X'], EDIT),
  C('edit.paste', 'Paste', 'Editing', ['Mod+V'], EDIT),
  C('edit.duplicate', 'Duplicate', 'Editing', ['Mod+D'], ['tracks', 'pianoroll']),
  C('edit.selectAll', 'Select all', 'Editing', ['Mod+A'], EDIT),
  C('edit.delete', 'Delete', 'Editing', ['Delete', 'Backspace'], EDIT),
  C('region.split', 'Split at playhead', 'Editing', ['Mod+T'], ['tracks']),
  C('region.join', 'Join regions', 'Editing', ['Mod+J'], ['tracks']),
  C('region.loop', 'Loop region on / off', 'Editing', ['L'], ['tracks']),
  C('notes.up', 'Note up a semitone', 'Editing', ['ArrowUp'], NOTES),
  C('notes.down', 'Note down a semitone', 'Editing', ['ArrowDown'], NOTES),
  C('notes.octaveUp', 'Note up an octave', 'Editing', ['Shift+ArrowUp', 'Mod+ArrowUp'], NOTES),
  C('notes.octaveDown', 'Note down an octave', 'Editing', ['Shift+ArrowDown', 'Mod+ArrowDown'], NOTES),
  C('pianoroll.left', 'Move notes earlier', 'Piano Roll', ['ArrowLeft'], ['pianoroll']),
  C('pianoroll.right', 'Move notes later', 'Piano Roll', ['ArrowRight'], ['pianoroll']),
  C('pianoroll.barLeft', 'Move notes a bar earlier', 'Piano Roll', ['Shift+ArrowLeft'], ['pianoroll']),
  C('pianoroll.barRight', 'Move notes a bar later', 'Piano Roll', ['Shift+ArrowRight'], ['pianoroll']),
  C('pianoroll.quantize', 'Quantize', 'Piano Roll', ['Q'], ['pianoroll']),
  // Score
  C('score.mode', 'Write / Select mode', 'Score', ['N'], ['score']),
  C('score.dur.0.125', '32nd note', 'Score', ['2'], ['score']),
  C('score.dur.0.25', '16th note', 'Score', ['3'], ['score']),
  C('score.dur.0.5', 'Eighth note', 'Score', ['4'], ['score']),
  C('score.dur.1', 'Quarter note', 'Score', ['5'], ['score']),
  C('score.dur.2', 'Half note', 'Score', ['6'], ['score']),
  C('score.dur.4', 'Whole note', 'Score', ['7'], ['score']),
  C('score.dot', 'Dot', 'Score', ['.'], ['score']),
  C('score.triplet', 'Triplets on / off', 'Score', ['Mod+3'], ['score']),
  C('score.rest', 'Turn note into a rest', 'Score', ['0'], ['score']),
  C('score.tie', 'Tie to next note', 'Score', ['=', '+'], ['score']),
  C('score.stepUp', 'Move note up (to the next note in the key)', 'Score', ['ArrowUp'], ['score']),
  C('score.stepDown', 'Move note down (to the next note in the key)', 'Score', ['ArrowDown'], ['score']),
  C('score.sharp', 'Sharp (raise a semitone)', 'Score', ['Shift+ArrowUp'], ['score']),
  C('score.flat', 'Flat (lower a semitone)', 'Score', ['Shift+ArrowDown'], ['score']),
  C('score.octaveUp', 'Up an octave', 'Score', ['Mod+ArrowUp'], ['score']),
  C('score.octaveDown', 'Down an octave', 'Score', ['Mod+ArrowDown'], ['score']),
  C('score.prev', 'Previous note or rest (plays it)', 'Score', ['ArrowLeft'], ['score']),
  C('score.next', 'Next note or rest (plays it)', 'Score', ['ArrowRight'], ['score']),
  C('score.prevExtend', 'Extend selection left', 'Score', ['Shift+ArrowLeft'], ['score']),
  C('score.nextExtend', 'Extend selection right', 'Score', ['Shift+ArrowRight'], ['score']),
  C('score.voice1', 'Voice 1', 'Score', ['Alt+1'], ['score']),
  C('score.voice2', 'Voice 2', 'Score', ['Alt+2'], ['score']),
  C('score.add3', 'Add a 3rd above', 'Score', ['Alt+3'], ['score']),
  C('score.add4', 'Add a 4th above', 'Score', ['Alt+4'], ['score']),
  C('score.add5', 'Add a 5th above', 'Score', ['Alt+5'], ['score']),
  C('score.add6', 'Add a 6th above', 'Score', ['Alt+6'], ['score']),
  C('score.add7', 'Add a 7th above', 'Score', ['Alt+7'], ['score']),
  C('score.add8', 'Add an octave above', 'Score', ['Alt+8'], ['score']),
  C('score.below3', 'Add a 3rd below', 'Score', ['Alt+Shift+3'], ['score']),
  C('score.staccato', 'Staccato', 'Score', ['Shift+S'], ['score']),
  C('score.tenuto', 'Tenuto', 'Score', ['Shift+N'], ['score']),
  C('score.accent', 'Accent', 'Score', ['Shift+V'], ['score']),
  C('score.marcato', 'Marcato', 'Score', ['Shift+O'], ['score']),
  C('score.lyrics', 'Lyrics', 'Score', ['Mod+L'], ['score']),
  C('score.chordSymbol', 'Chord symbol', 'Score', ['Mod+K'], ['score']),
];

export const COMMAND_BY_ID = new Map(COMMANDS.map((c) => [c.id, c]));
export const CATEGORIES = [...new Set(COMMANDS.map((c) => c.category))];

/** Keys that can't be changed, shown for reference. */
export const FIXED_KEYS: { label: string; keys: string; where: string }[] = [
  { label: 'Type a note name (in the score)', keys: 'A – G', where: 'Score' },
  { label: 'Add that note to the chord', keys: '⇧ A – G', where: 'Score' },
  { label: 'Musical typing: white keys', keys: 'A S D F G H J K L', where: 'While musical typing is on' },
  { label: 'Musical typing: black keys', keys: 'W E T Y U O P', where: 'While musical typing is on' },
  { label: 'Musical typing: octave down / up', keys: 'Z  X', where: 'While musical typing is on' },
  { label: 'Musical typing: velocity down / up', keys: 'C  V', where: 'While musical typing is on' },
  { label: 'Cancel / close', keys: 'Esc', where: 'Everywhere' },
];

// ------------------------------------------------------------------ user key choices

const STORE_KEY = 'bf.keymap';

function loadOverrides(): Record<string, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export const useKeymap = create<{ overrides: Record<string, string[]> }>(() => ({ overrides: loadOverrides() }));

function save(overrides: Record<string, string[]>): void {
  useKeymap.setState({ overrides });
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(overrides));
  } catch {
    /* private mode: keep for this session */
  }
}

export function keysFor(id: string): string[] {
  return useKeymap.getState().overrides[id] ?? COMMAND_BY_ID.get(id)?.keys ?? [];
}

export function isCustomized(id: string): boolean {
  return id in useKeymap.getState().overrides;
}

export function setKeys(id: string, keys: string[]): void {
  const def = COMMAND_BY_ID.get(id)?.keys ?? [];
  const next = { ...useKeymap.getState().overrides };
  if (keys.length === def.length && keys.every((k, i) => k === def[i])) delete next[id];
  else next[id] = keys;
  save(next);
}

export function resetKeys(id?: string): void {
  if (!id) return save({});
  const next = { ...useKeymap.getState().overrides };
  delete next[id];
  save(next);
}

/** Can these two commands be active at the same time? */
function overlaps(a: KeyContext[], b: KeyContext[]): boolean {
  return a.includes('global') || b.includes('global') || a.some((x) => b.includes(x));
}

/** Other commands already using `combo` where it would clash with `id`. */
export function conflictsFor(id: string, combo: string): Command[] {
  const me = COMMAND_BY_ID.get(id);
  if (!me) return [];
  return COMMANDS.filter((c) => c.id !== id && keysFor(c.id).includes(combo) && overlaps(me.contexts, c.contexts));
}

// ------------------------------------------------------------------ matching

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const NAMED: Record<string, string> = {
  ' ': 'Space',
  Enter: 'Enter',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
};
const PUNCT: Record<string, string> = { Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\' };
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Fn', 'OS']);

/** The key combination of a keyboard event, e.g. "Mod+Shift+Z", "Alt+3", "?", "Space". Null for a lone modifier. */
export function comboOf(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  let token: string | null = null;
  let shiftable = true;
  if (/^Key[A-Z]$/.test(e.code)) token = e.code.slice(3);
  else if (/^(Digit|Numpad)\d$/.test(e.code)) token = e.code.slice(-1);
  else if (NAMED[e.key]) token = NAMED[e.key];
  else if ((e.altKey || e.metaKey || e.ctrlKey) && PUNCT[e.code]) token = PUNCT[e.code];
  else if (e.key.length === 1) {
    // Printed characters (?, +, =, comma…) already include Shift.
    token = e.key;
    shiftable = false;
  }
  if (!token) return null;
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  const parts: string[] = [];
  if (mod) parts.push('Mod');
  if (IS_MAC && e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey && shiftable) parts.push('Shift');
  parts.push(token);
  return parts.join('+');
}

/** Does this event trigger the command? (Uses the user's keys.) */
export function isKey(e: KeyboardEvent, id: string, combo = comboOf(e)): boolean {
  return !!combo && keysFor(id).includes(combo);
}

// ------------------------------------------------------------------ display

const TOKEN_LABEL: Record<string, string> = {
  Space: 'Space',
  Enter: IS_MAC ? 'Return' : 'Enter',
  Escape: 'Esc',
  Backspace: IS_MAC ? '⌫' : 'Backspace',
  Delete: IS_MAC ? 'Delete' : 'Del',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
};

/** "Mod+Shift+Z" → "⇧⌘Z" on a Mac, "Ctrl+Shift+Z" elsewhere. */
export function formatCombo(combo: string): string {
  const parts = combo.split('+');
  // A literal "+" key splits into an empty last part.
  let token = parts.pop() ?? '';
  if (token === '' && combo.endsWith('+')) {
    parts.pop();
    token = '+';
  }
  const label = TOKEN_LABEL[token] ?? (token.length === 1 ? token.toUpperCase() : token);
  if (IS_MAC) {
    const sym: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Mod: '⌘' };
    const order = ['Ctrl', 'Alt', 'Shift', 'Mod'];
    return order.filter((m) => parts.includes(m)).map((m) => sym[m]).join('') + label;
  }
  const names: Record<string, string> = { Mod: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };
  return [...parts.map((m) => names[m] ?? m), label].join('+');
}

/** The keys of a command for tooltips and menus, e.g. "⌘Z" (first key only by default). */
export function shortcutLabel(id: string, all = false): string {
  const ks = keysFor(id);
  if (!ks.length) return '';
  return (all ? ks : ks.slice(0, 1)).map(formatCombo).join(' / ');
}

/** Re-render on key changes. */
export function useShortcut(id: string): string {
  useKeymap((s) => s.overrides[id]);
  return shortcutLabel(id);
}

/** True while the Shortcuts window is waiting for you to press a new key (other handlers stand aside). */
export const keyCapture = { active: false };
