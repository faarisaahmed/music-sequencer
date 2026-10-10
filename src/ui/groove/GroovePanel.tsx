// Swing / groove picker: presets, 8th or 16th swing, amount (MPC %), looseness.
// Used for the whole song (top bar) and for regions (Beat Sequencer, Piano Roll, region menu).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Shuffle } from "lucide-react";
import type { Groove } from "../../model/types";
import {
  GROOVE_PRESETS,
  grooveLabel,
  isStraight,
  presetFor,
  swingPercent,
  warpBeat,
} from "../../model/groove";
import {
  bakeGroove,
  setRegionGroove,
  setSongGroove,
} from "../../state/actions";
import { findRegion, toast, useStore } from "../../state/store";
import { HSlider } from "../common/controls";
import "./groove.css";

type Scope = { kind: "song" } | { kind: "regions"; ids: string[] };

/** Close a popover on any pointer-down outside it and outside `host` (whose toggle button handles itself). */
export function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  host: React.RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || host.current?.parentElement?.contains(t))
        return;
      onClose();
    };
    const t = setTimeout(
      () => window.addEventListener("pointerdown", close),
      0,
    );
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", close);
    };
  }, [ref, host, onClose]);
}

/** Two beats of straight grid ticks vs where the swung notes land. */
function GrooveViz({ g }: { g: Groove | null }) {
  const W = 264;
  const H = 30;
  const grid = g?.grid ?? 16;
  const step = grid === 8 ? 0.5 : 0.25;
  const xs: number[] = [];
  for (let b = 0; b < 2 - 1e-9; b += step) xs.push(b);
  const x = (b: number) => 8 + (b / 2) * (W - 16);
  return (
    <svg className="groove-viz" width={W} height={H}>
      <line x1={8} x2={W - 8} y1={H / 2} y2={H / 2} className="gv-line" />
      {xs.map((b) => (
        <line
          key={"t" + b}
          x1={x(b)}
          x2={x(b)}
          y1={6}
          y2={H - 6}
          className={"gv-tick" + (Math.abs(b % 1) < 1e-9 ? " beat" : "")}
        />
      ))}
      {xs.map((b) => {
        const s =
          g && !isStraight(g)
            ? warpBeat(b, g) +
              (g.loose ? g.loose * 0.025 * (Math.abs(b % 1) < 1e-9 ? 0 : 1) : 0)
            : b;
        const moved = Math.abs(s - b) > 1e-6;
        return (
          <circle
            key={"n" + b}
            cx={x(s)}
            cy={H / 2}
            r={moved ? 4.5 : 4}
            className={"gv-note" + (moved ? " moved" : "")}
          />
        );
      })}
    </svg>
  );
}

export default function GroovePanel({
  scope,
  onClose,
  placement = "down",
}: {
  scope: Scope;
  onClose: () => void;
  placement?: "down" | "up" | "down-left";
}) {
  const project = useStore((s) => s.project)!;
  const ref = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  useOutsideClose(ref, anchor, onClose);
  // Fixed position next to the button that opened it, kept inside the window.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const host = anchor.current?.parentElement;
    if (!el || !host) return;
    const place = () => {
      const a = host.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = placement === "down" ? a.left + a.width / 2 - w / 2 : a.left;
      left = Math.max(8, Math.min(vw - w - 8, left));
      const below = a.bottom + 8;
      const above = a.top - 8 - h;
      let top =
        placement === "up"
          ? above >= 8
            ? above
            : below
          : below + h <= vh - 8
            ? below
            : above >= 8
              ? above
              : below;
      top = Math.max(8, Math.min(vh - h - 8, top));
      setPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [placement]);

  const songG = project.groove ?? null;
  const first =
    scope.kind === "regions"
      ? findRegion(project, scope.ids[0] ?? null)?.region
      : undefined;
  const own = first?.kind === "midi" && first.groove !== undefined;
  const followsSong = scope.kind === "regions" && !own;
  const value: Groove | null =
    scope.kind === "song"
      ? songG
      : own && first?.kind === "midi"
        ? (first.groove ?? null)
        : songG;
  const active = presetFor(value);

  const set = (g: Groove | null) =>
    scope.kind === "song" ? setSongGroove(g) : setRegionGroove(scope.ids, g);
  const custom: Groove = value ? { ...value } : { grid: 16, amount: 0 };

  // The panel lives at the page root so no scrolling or transformed container can clip it.
  return (
    <span ref={anchor} style={{ display: "none" }}>
      {createPortal(panel(), document.body)}
    </span>
  );

  function panel() {
    return (
      <div
        ref={ref}
        className="popover groove-pop"
        style={
          pos ? { left: pos.left, top: pos.top } : { visibility: "hidden" }
        }
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="groove-head">
          <Shuffle size={15} />
          <b>
            {scope.kind === "song"
              ? "Song Swing"
              : scope.ids.length > 1
                ? `Swing for ${scope.ids.length} regions`
                : "Swing for this region"}
          </b>
          <span className="chip">{grooveLabel(value)}</span>
        </div>
        {scope.kind === "regions" && (
          <div className="seg groove-scope">
            <button
              className={followsSong ? "on" : ""}
              onClick={() => setRegionGroove(scope.ids, undefined)}
              title="Use the song's swing (set in the top bar)"
            >
              Follow song · {grooveLabel(songG)}
            </button>
            <button
              className={!followsSong ? "on" : ""}
              onClick={() => !own && setRegionGroove(scope.ids, songG ?? null)}
            >
              Own swing
            </button>
          </div>
        )}
        <GrooveViz g={value} />
        <div
          className={"groove-presets" + (followsSong ? " groove-follow" : "")}
        >
          {GROOVE_PRESETS.map((p) => (
            <button
              key={p.id}
              className={"groove-preset" + (active?.id === p.id ? " on" : "")}
              onClick={() => set(p.groove ? { ...p.groove } : null)}
              title={p.desc}
            >
              <b>
                {active?.id === p.id && <Check size={11} />} {p.name}
              </b>
              <span>{p.desc}</span>
            </button>
          ))}
        </div>
        <div
          className={"groove-custom" + (followsSong ? " groove-follow" : "")}
        >
          <div className="row">
            <span className="label">Swing</span>
            <div className="seg">
              {([16, 8] as const).map((gr) => (
                <button
                  key={gr}
                  className={custom.grid === gr ? "on" : ""}
                  onClick={() => set({ ...custom, grid: gr })}
                  title={
                    gr === 16
                      ? "Swing the in-between 16th notes (hi-hats, funk, hip-hop)"
                      : "Swing the in-between 8th notes (jazz, blues shuffle)"
                  }
                >
                  {gr}ths
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <span className="label">Amount</span>
            <HSlider
              value={custom.amount}
              min={0}
              max={1}
              width={150}
              defaultValue={0}
              onChange={(v) =>
                set({ ...custom, amount: Math.round(v * 100) / 100 })
              }
              title="50% straight · 66% triplet · 75% dotted"
            />
            <span className="mono groove-val">{swingPercent(custom)}%</span>
          </div>
          <div className="row">
            <span className="label">Loose</span>
            <HSlider
              value={custom.loose ?? 0}
              min={0}
              max={1}
              width={150}
              defaultValue={0}
              onChange={(v) =>
                set({
                  ...custom,
                  loose: Math.round(v * 100) / 100 || undefined,
                })
              }
              title="Let notes drift slightly late, like a relaxed human player"
            />
            <span className="mono groove-val">
              {Math.round((custom.loose ?? 0) * 100)}%
            </span>
          </div>
        </div>
        <div className="groove-foot faint">
          {scope.kind === "song"
            ? "Applies to every instrument and drum region that follows the song. Audio recordings are not changed."
            : "Swing is applied as it plays, so the notes stay on the grid here."}
          {scope.kind === "regions" && value && !isStraight(value) && (
            <button
              className="btn sm"
              title="Move the notes to their swung positions so you can see and edit them"
              onClick={() => {
                const n = bakeGroove(scope.ids);
                toast(n ? `Swing written into ${n} notes` : "Nothing to swing");
                onClose();
              }}
            >
              Write into notes
            </button>
          )}
        </div>
      </div>
    );
  }
}
