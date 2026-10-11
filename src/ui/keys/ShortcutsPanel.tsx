// Every shortcut in one list: search it, click a key to change it, add a second key,
// see clashes before they happen, and reset one or all.
import { useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Search, X } from 'lucide-react';
import { CATEGORIES, COMMANDS, FIXED_KEYS, COMMAND_BY_ID, comboOf, conflictsFor, formatCombo, isCustomized, keyCapture, keysFor, resetKeys, setKeys, useKeymap, type Command, type KeyContext } from './keymap';

const WHERE: Record<KeyContext, string> = { global: '', tracks: 'Tracks area', score: 'Score', pianoroll: 'Piano Roll', steps: 'Beat Sequencer' };

interface Capture {
  id: string;
  /** Which key to replace; null adds another key. */
  index: number | null;
}

interface Clash {
  id: string;
  index: number | null;
  combo: string;
  others: Command[];
}

function apply(id: string, index: number | null, combo: string): void {
  const ks = [...keysFor(id)];
  if (index === null) ks.push(combo);
  else ks[index] = combo;
  setKeys(id, [...new Set(ks)]);
}

export default function ShortcutsPanel() {
  useKeymap((s) => s.overrides);
  const [query, setQuery] = useState('');
  const [capture, setCapture] = useState<Capture | null>(null);
  const [clash, setClash] = useState<Clash | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Waiting for a key: the next key combination becomes the shortcut.
  useEffect(() => {
    keyCapture.active = !!capture;
    if (!capture) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        setCapture(null);
        return;
      }
      const combo = comboOf(e);
      if (!combo) return; // just a modifier so far
      const others = conflictsFor(capture.id, combo);
      if (others.length) setClash({ ...capture, combo, others });
      else apply(capture.id, capture.index, combo);
      setCapture(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      keyCapture.active = false;
    };
  }, [capture]);

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        cat,
        rows: COMMANDS.filter(
          (c) => c.category === cat && (!q || c.label.toLowerCase().includes(q) || cat.toLowerCase().includes(q) || keysFor(c.id).some((k) => formatCombo(k).toLowerCase().includes(q) || k.toLowerCase().includes(q))),
        ),
      })).filter((g) => g.rows.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, useKeymap.getState().overrides],
  );
  const anyCustom = COMMANDS.some((c) => isCustomized(c.id));

  return (
    <div className="sc-panel">
      <div className="sc-top">
        <div className="sc-search">
          <Search size={14} />
          <input type="search" placeholder="Search shortcuts (e.g. undo, mixer, ⌘D)" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        </div>
        {anyCustom &&
          (confirmReset ? (
            <button
              className="btn sm danger"
              onClick={() => {
                resetKeys();
                setConfirmReset(false);
              }}
            >
              Reset every shortcut?
            </button>
          ) : (
            <button className="btn sm" onClick={() => setConfirmReset(true)} onBlur={() => setConfirmReset(false)}>
              <RotateCcw size={13} /> Reset all
            </button>
          ))}
      </div>
      <div className="sc-hint faint">Click a key to change it, or + to add another. Shortcuts are saved in this browser.</div>
      {groups.map((g) => (
        <div key={g.cat} className="sc-group">
          <h4>{g.cat}</h4>
          {g.rows.map((c) => {
            const ks = keysFor(c.id);
            const where = c.contexts.includes('global') ? '' : c.contexts.map((x) => WHERE[x]).join(', ');
            return (
              <div key={c.id} className={'sc-row' + (isCustomized(c.id) ? ' custom' : '')} data-command={c.id}>
                <div className="sc-label">
                  {c.label}
                  {where && <span className="sc-where">{where}</span>}
                </div>
                <div className="sc-keys">
                  {ks.map((k, i) =>
                    capture?.id === c.id && capture.index === i ? (
                      <span key={k} className="sc-key capturing">Press keys… (Esc to cancel)</span>
                    ) : (
                      <span key={k} className="sc-key-wrap">
                        <button className="sc-key" title="Click, then press the new keys" onClick={() => setCapture({ id: c.id, index: i })}>
                          {formatCombo(k)}
                        </button>
                        <button className="sc-remove" title="Remove this key" onClick={() => setKeys(c.id, ks.filter((x) => x !== k))}>
                          <X size={10} />
                        </button>
                      </span>
                    ),
                  )}
                  {capture?.id === c.id && capture.index === null ? (
                    <span className="sc-key capturing">Press keys… (Esc to cancel)</span>
                  ) : (
                    ks.length < 3 && (
                      <button className="sc-add" title={ks.length ? 'Add another key' : 'Set a key'} onClick={() => setCapture({ id: c.id, index: null })}>
                        <Plus size={12} />
                        {!ks.length && 'Set key'}
                      </button>
                    )
                  )}
                  {isCustomized(c.id) && (
                    <button className="sc-reset" title={`Back to ${COMMAND_BY_ID.get(c.id)!.keys.map(formatCombo).join(' / ') || 'no key'}`} onClick={() => resetKeys(c.id)}>
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
                {clash?.id === c.id && (
                  <div className="sc-clash">
                    <b>{formatCombo(clash.combo)}</b> is already used for {clash.others.map((o) => `“${o.label}”`).join(', ')}.
                    <button
                      className="btn sm primary"
                      onClick={() => {
                        for (const o of clash.others) setKeys(o.id, keysFor(o.id).filter((k) => k !== clash.combo));
                        apply(clash.id, clash.index, clash.combo);
                        setClash(null);
                      }}
                    >
                      Use it here instead
                    </button>
                    <button className="btn sm" onClick={() => setClash(null)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {!q && (
        <div className="sc-group">
          <h4>Fixed keys</h4>
          {FIXED_KEYS.map((f) => (
            <div key={f.label} className="sc-row fixed">
              <div className="sc-label">
                {f.label}
                <span className="sc-where">{f.where}</span>
              </div>
              <div className="sc-keys">
                <kbd>{f.keys}</kbd>
              </div>
            </div>
          ))}
        </div>
      )}
      {q && !groups.length && <div className="empty-state">No shortcut matches “{query}”.</div>}
    </div>
  );
}
