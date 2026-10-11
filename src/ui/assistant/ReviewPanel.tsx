// Check My Writing: the song's range problems, rubs and parallels, each with what to try.
// Clicking one shows the notes; nothing is changed for you.
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown, Eye, EyeOff, Music2, Play, Spline, Zap } from 'lucide-react';
import { create } from 'zustand';
import { findRegion, useStore } from '../../state/store';
import { flaggedNotes, reviewSong, type Issue, type IssueKind } from '../../model/review';
import { keyUsesFlats } from '../../model/music';
import { getEngine } from '../../audio/engine';
import { meterOf } from '../../model/timeline';
import './review.css';

/** Whether flagged notes are marked in the piano roll and score. */
export const useReviewUi = create<{ show: boolean }>(() => ({ show: true }));

const KINDS: { id: IssueKind; label: string; icon: React.ReactNode; blurb: string }[] = [
  { id: 'range', label: 'Range', icon: <ArrowUpDown size={13} />, blurb: 'Notes the instrument can’t play' },
  { id: 'clash', label: 'Rubs', icon: <Zap size={13} />, blurb: 'Half steps held between parts' },
  { id: 'chord', label: 'Chords', icon: <Music2 size={13} />, blurb: 'Held notes against the chord' },
  { id: 'parallel', label: 'Parallels', icon: <Spline size={13} />, blurb: 'Parallel fifths and octaves' },
];

/** Flags for the editors (empty when marking is off). */
export function useFlaggedNotes(): Map<string, 'range' | 'warn'> {
  const project = useStore((s) => s.project);
  const show = useReviewUi((s) => s.show);
  return useMemo(() => (project && show ? flaggedNotes(reviewSong(project)) : new Map()), [project, show]);
}

export default function ReviewPanel() {
  const project = useStore((s) => s.project)!;
  const show = useReviewUi((s) => s.show);
  const [filter, setFilter] = useState<IssueKind | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const issues = useMemo(() => reviewSong(project, { flats: keyUsesFlats(project.key) }), [project]);
  const counts = Object.fromEntries(KINDS.map((k) => [k.id, issues.filter((i) => i.kind === k.id).length])) as Record<IssueKind, number>;
  const list = filter ? issues.filter((i) => i.kind === filter) : issues;

  const reveal = (i: Issue) => {
    setOpen(i.id);
    const first = i.notes[0];
    const f = first ? findRegion(project, first.regionId) : undefined;
    // Select the notes, put the playhead there and open them in the editor.
    useStore.setState({
      cursor: Math.max(0, meterOf(project).floorBar(i.beat)),
      selectedNoteIds: i.notes.map((n) => n.noteId),
      ...(f ? { selectedTrackId: f.track.id, editingRegionId: f.region.id, selectedRegionIds: [f.region.id] } : {}),
    });
  };
  const play = (i: Issue) => {
    const at = Math.max(0, meterOf(project).floorBar(i.beat));
    getEngine().seek(at);
    if (!getEngine().isPlaying) void getEngine().togglePlay();
  };

  return (
    <div className="review">
      <div className="review-head">
        <div className="review-title">
          <AlertTriangle size={15} />
          <b>Check My Writing</b>
          <span className="dim">{issues.length ? `${issues.length} thing${issues.length === 1 ? '' : 's'} to look at` : 'Nothing to flag'}</span>
        </div>
        <button className={'btn sm' + (show ? ' active' : '')} onClick={() => useReviewUi.setState({ show: !show })} title="Mark these notes in the piano roll and score">
          {show ? <Eye size={13} /> : <EyeOff size={13} />} Mark notes
        </button>
      </div>
      <div className="review-chips">
        <button className={'review-chip' + (filter === null ? ' on' : '')} onClick={() => setFilter(null)}>
          All <em>{issues.length}</em>
        </button>
        {KINDS.map((k) => (
          <button key={k.id} className={'review-chip ' + k.id + (filter === k.id ? ' on' : '')} onClick={() => setFilter(filter === k.id ? null : k.id)} title={k.blurb}>
            {k.icon} {k.label} <em>{counts[k.id]}</em>
          </button>
        ))}
      </div>
      <div className="review-list">
        {list.length === 0 && (
          <div className="review-empty">
            <b>{issues.length ? 'Nothing of this kind.' : 'Looks good.'}</b>
            <span className="dim">These checks are a second pair of ears, not rules: if something sounds right to you, keep it.</span>
          </div>
        )}
        {list.map((i) => (
          <div key={i.id} className={'review-item ' + i.kind + (open === i.id ? ' open' : '')} onClick={() => reveal(i)}>
            <div className="review-row">
              <span className={'review-dot ' + i.kind} />
              <span className="review-bar">Bar {i.bar}</span>
              <span className="review-text">{i.title}</span>
              <button
                className="btn ghost icon sm"
                title="Play from this bar"
                onClick={(e) => {
                  e.stopPropagation();
                  play(i);
                }}
              >
                <Play size={13} />
              </button>
            </div>
            {open === i.id && <div className="review-hint">{i.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
