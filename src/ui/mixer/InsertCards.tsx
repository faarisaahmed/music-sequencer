// Smart-control cards for insert effects (amp, gate, phaser, …) with bypass & remove.
import { Plus, Power, X } from 'lucide-react';
import type { InsertFx, Track } from '../../model/types';
import { updateTrack } from '../../state/actions';
import { AMP_MODELS, INSERT_DEFAULTS, INSERT_LABELS, type InsertKey } from '../../audio/effects';
import { Knob } from '../common/controls';
import { showContextMenu } from '../common/menus';

const COLORS: Record<InsertKey, string> = {
  gate: '#939089',
  amp: '#d9693b',
  deesser: '#7fb8c4',
  autowah: '#e3c35a',
  phaser: '#a88cc2',
  flanger: '#d36d7f',
  tremolo: '#8fb573',
  lofi: '#e08a3c',
  widener: '#7fb8c4',
};

const ORDER: InsertKey[] = ['gate', 'amp', 'deesser', 'autowah', 'phaser', 'flanger', 'tremolo', 'lofi', 'widener'];

const pct = (v: number) => `${Math.round(v * 100)}%`;

type AnyParams = Record<string, number | string | boolean>;

function set(t: Track, key: InsertKey, patch: AnyParams): void {
  updateTrack(t.id, (x) => {
    const ins = (x.fx.inserts ??= {});
    const cur = (ins[key] ?? { ...INSERT_DEFAULTS[key] }) as AnyParams;
    (ins as Record<string, AnyParams>)[key] = { ...cur, ...patch };
  });
}

function remove(t: Track, key: InsertKey): void {
  updateTrack(t.id, (x) => {
    if (x.fx.inserts) delete x.fx.inserts[key];
  });
}

function InsertCard({ t, k }: { t: Track; k: InsertKey }) {
  const p = t.fx.inserts![k] as unknown as AnyParams;
  const on = !!p.on;
  const color = COLORS[k];
  const knob = (param: string, label: string, min = 0, max = 1, fmt: (v: number) => string = pct, step?: number) => (
    <Knob
      key={param}
      size={42}
      label={label}
      min={min}
      max={max}
      step={step}
      color={color}
      value={Number(p[param])}
      defaultValue={Number((INSERT_DEFAULTS[k] as unknown as AnyParams)[param])}
      format={fmt}
      onChange={(v) => set(t, k, { [param]: v })}
    />
  );
  return (
    <div className={'fx-card' + (on ? '' : ' off') + (k === 'amp' ? ' fx-wide' : '')}>
      <div className="fx-card-head">
        <span className="dot" style={{ background: on ? color : '#5a5753' }} />
        {INSERT_LABELS[k]}
        <div className="spacer" />
        <button className={'btn sm icon' + (on ? ' active' : ' ghost')} title={on ? 'Bypass' : 'Enable'} onClick={() => set(t, k, { on: !on })}>
          <Power size={13} />
        </button>
        <button className="btn sm icon ghost" title="Remove effect" onClick={() => remove(t, k)}>
          <X size={13} />
        </button>
      </div>
      {k === 'amp' && (
        <div className="amp-models">
          {AMP_MODELS.map((m) => (
            <button key={m.id} className={'amp-model' + (p.model === m.id ? ' on' : '')} onClick={() => set(t, k, { model: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      )}
      {k === 'autowah' && (
        <div className="seg" style={{ alignSelf: 'flex-start' }}>
          {(['envelope', 'lfo'] as const).map((m) => (
            <button key={m} className={p.mode === m ? 'on' : ''} onClick={() => set(t, k, { mode: m })}>
              {m === 'envelope' ? 'Envelope' : 'LFO'}
            </button>
          ))}
        </div>
      )}
      <div className="fx-card-body">
        {k === 'gate' && knob('threshold', 'Threshold', -80, 0, (v) => `${Math.round(v)} dB`, 1)}
        {k === 'amp' && (
          <>
            {knob('gain', 'Gain')}
            {knob('bass', 'Bass')}
            {knob('mid', 'Mid')}
            {knob('treble', 'Treble')}
            {knob('presence', 'Presence')}
            {knob('level', 'Master')}
          </>
        )}
        {k === 'deesser' && knob('amount', 'Amount')}
        {k === 'autowah' && (
          <>
            {knob('sensitivity', p.mode === 'envelope' ? 'Sens' : 'Depth')}
            {p.mode === 'lfo' && knob('rate', 'Rate', 0, 1, (v) => `${(0.1 + v * 8).toFixed(1)} Hz`)}
            {knob('base', 'Freq', 0, 1, (v) => `${Math.round(250 * Math.pow(12, v))} Hz`)}
            {knob('q', 'Reso')}
            {knob('mix', 'Mix')}
          </>
        )}
        {(k === 'phaser' || k === 'flanger') && (
          <>
            {knob('rate', 'Rate', 0, 1, (v) => `${(0.05 + v * (k === 'phaser' ? 4 : 3)).toFixed(2)} Hz`)}
            {knob('depth', 'Depth')}
            {knob('feedback', 'Feedback')}
            {knob('mix', 'Mix')}
          </>
        )}
        {k === 'tremolo' && (
          <>
            {knob('rate', 'Rate', 0, 1, (v) => `${(0.5 + v * 11.5).toFixed(1)} Hz`)}
            {knob('depth', 'Depth')}
          </>
        )}
        {k === 'lofi' && (
          <>
            {knob('bits', 'Bits', 2, 16, (v) => `${Math.round(v)}-bit`, 1)}
            {knob('tone', 'Tone', 0, 1, (v) => `${Math.round(1200 * Math.pow(12, v))} Hz`)}
            {knob('mix', 'Mix')}
          </>
        )}
        {k === 'widener' && (
          <>
            {knob('width', 'Width', 0, 1, (v) => `${Math.round(v * 200)}%`)}
            {knob('haas', 'Spread')}
          </>
        )}
      </div>
    </div>
  );
}

export function InsertCards({ t }: { t: Track }) {
  const ins: InsertFx = t.fx.inserts ?? {};
  const present = ORDER.filter((k) => ins[k]);
  return (
    <>
      {present.map((k) => (
        <InsertCard key={k} t={t} k={k} />
      ))}
      <button
        className="fx-card fx-add"
        onClick={(e) =>
          showContextMenu(
            e,
            ORDER.filter((k) => !ins[k]).map((k) => ({
              label: INSERT_LABELS[k],
              onClick: () => set(t, k, { ...INSERT_DEFAULTS[k] } as unknown as AnyParams),
            })),
          )
        }
        disabled={present.length === ORDER.length}
      >
        <Plus size={18} />
        Add Effect
        <span className="faint" style={{ fontSize: 11 }}>
          Amp, Phaser, Flanger, Tremolo, Wah, Gate…
        </span>
      </button>
    </>
  );
}
