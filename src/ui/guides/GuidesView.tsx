import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Menu, Search, X } from 'lucide-react';
import { closeModal, useStore } from '../../state/store';
import { keyCapture } from '../keys/keymap';
import { ALL_LESSONS, CHAPTERS, findLesson, searchLessons, type LessonRef } from './index';
import { stopExample } from './audio';
import type { Chapter } from './types';
import './guides.css';

const READ_KEY = 'bf.guides.read';
const LAST_KEY = 'bf.guides.last';

function loadRead(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveRead(s: Set<string>): void {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...s]));
  } catch {
    /* storage unavailable */
  }
}
function loadLast(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
function saveLast(k: string): void {
  try {
    localStorage.setItem(LAST_KEY, k);
  } catch {
    /* storage unavailable */
  }
}

const chapterMinutes = (c: Chapter) => c.lessons.reduce((a, l) => a + l.minutes, 0);

export default function GuidesView() {
  const initial = (useStore.getState().modal?.data as { lesson?: string } | undefined)?.lesson ?? null;
  const [current, setCurrent] = useState<string | null>(findLesson(initial) ? initial : null);
  const [query, setQuery] = useState('');
  const [read, setRead] = useState(loadRead);
  const [drawer, setDrawer] = useState(false);
  const [openCh, setOpenCh] = useState<string | null>(() => findLesson(initial)?.chapter.id ?? null);
  const scroller = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const ref = findLesson(current);
  const results = useMemo(() => searchLessons(query), [query]);
  const last = findLesson(loadLast());

  const go = (key: string | null) => {
    stopExample();
    setCurrent(key);
    setQuery('');
    setDrawer(false);
    const r = findLesson(key);
    if (r) {
      setOpenCh(r.chapter.id);
      saveLast(r.key);
    }
    scroller.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || keyCapture.active) return;
      e.stopPropagation();
      if (drawer) setDrawer(false);
      else if (query) setQuery('');
      else closeModal();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drawer, query]);

  useEffect(() => () => stopExample(), []);

  // Reaching the end of a lesson marks it read.
  useEffect(() => {
    const el = endRef.current;
    if (!el || !ref) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting))
          setRead((s) => {
            if (s.has(ref.key)) return s;
            const next = new Set(s).add(ref.key);
            saveRead(next);
            return next;
          });
      },
      { root: scroller.current, threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  const done = ALL_LESSONS.filter((r) => read.has(r.key)).length;

  return (
    <div className="guides" role="dialog" aria-label="Guides">
      <aside className={'g-side' + (drawer ? ' open' : '')}>
        <div className="g-side-head">
          <button className="g-brand" onClick={() => go(null)}>
            <BookOpen size={17} />
            <span>Guides</span>
          </button>
          <button className="btn ghost icon sm g-only-narrow" onClick={() => setDrawer(false)} aria-label="Close contents">
            <X size={16} />
          </button>
        </div>
        <div className="g-search">
          <Search size={14} />
          <input type="search" placeholder="Search guides" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="g-progress" title={`${done} of ${ALL_LESSONS.length} lessons read`}>
          <div className="g-progress-bar">
            <i style={{ width: `${ALL_LESSONS.length ? (done / ALL_LESSONS.length) * 100 : 0}%` }} />
          </div>
          <span>
            {done}/{ALL_LESSONS.length} read
          </span>
        </div>
        <nav className="g-toc">
          {CHAPTERS.map((c, ci) => {
            const open = openCh === c.id;
            const cDone = c.lessons.filter((l) => read.has(c.id + '/' + l.id)).length;
            return (
              <div key={c.id} className={'g-toc-ch' + (open ? ' open' : '')} style={{ ['--ch' as string]: c.color }}>
                <button className="g-toc-chbtn" onClick={() => setOpenCh(open ? null : c.id)}>
                  <span className="g-toc-num">{ci + 1}</span>
                  <span className="g-toc-title">{c.title}</span>
                  <span className="g-toc-count">{cDone === c.lessons.length && c.lessons.length ? <Check size={12} /> : `${cDone}/${c.lessons.length}`}</span>
                </button>
                {open && (
                  <div className="g-toc-lessons">
                    {c.lessons.map((l) => {
                      const key = c.id + '/' + l.id;
                      return (
                        <button key={l.id} className={'g-toc-lesson' + (current === key ? ' on' : '') + (read.has(key) ? ' read' : '')} onClick={() => go(key)}>
                          <span className="g-toc-dot">{read.has(key) && <Check size={9} strokeWidth={3} />}</span>
                          {l.title}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      {drawer && <div className="g-scrim" onClick={() => setDrawer(false)} />}

      <div className="g-main">
        <header className="g-top">
          <button className="btn ghost sm g-only-narrow" onClick={() => setDrawer(true)}>
            <Menu size={15} /> Contents
          </button>
          {ref ? (
            <div className="g-crumbs">
              <button onClick={() => go(null)}>Guides</button>
              <ChevronRight size={12} />
              <button onClick={() => go(ref.chapter.id + '/' + ref.chapter.lessons[0].id)}>{ref.chapter.title}</button>
            </div>
          ) : (
            <div className="g-crumbs">
              <span>Guides</span>
            </div>
          )}
          <div className="spacer" />
          <button className="btn ghost icon" onClick={closeModal} aria-label="Close guides" title="Close (Esc)">
            <X size={18} />
          </button>
        </header>
        <div className="g-scroll" ref={scroller}>
          {query ? (
            <SearchResults results={results} query={query} onOpen={go} />
          ) : ref ? (
            <LessonPage key={ref.key} r={ref} onGo={go} endRef={endRef} />
          ) : (
            <GuidesHome read={read} last={last} onGo={go} />
          )}
        </div>
      </div>
    </div>
  );
}

function GuidesHome({ read, last, onGo }: { read: Set<string>; last?: LessonRef; onGo: (k: string) => void }) {
  const first = ALL_LESSONS[0];
  const total = ALL_LESSONS.reduce((a, r) => a + r.lesson.minutes, 0);
  return (
    <div className="g-home">
      <section className="g-hero">
        <div className="g-hero-kicker">BandForge Guides</div>
        <h1>Write your own music, from the first note to a finished song.</h1>
        <p>
          Everything a beginner needs and nothing padded: how harmony, melody and rhythm actually work, why the classic moves sound the way they do, and exactly where to click in BandForge to try each one. Every example plays, and you can mute each part to hear what it adds.
        </p>
        <div className="g-hero-btns">
          {last && last.key !== first?.key ? (
            <>
              <button className="btn primary lg" onClick={() => onGo(last.key)}>
                Continue: {last.lesson.title} <ArrowRight size={15} />
              </button>
              {first && (
                <button className="btn lg" onClick={() => onGo(first.key)}>
                  Start from the beginning
                </button>
              )}
            </>
          ) : (
            first && (
              <button className="btn primary lg" onClick={() => onGo(first.key)}>
                Start with lesson 1 <ArrowRight size={15} />
              </button>
            )
          )}
        </div>
        <div className="g-hero-stats">
          <span>
            <b>{CHAPTERS.length}</b> chapters
          </span>
          <span>
            <b>{ALL_LESSONS.length}</b> lessons
          </span>
          <span>
            <b>{Math.round(total / 6) / 10}</b> hours of reading
          </span>
        </div>
      </section>
      <div className="g-ch-grid">
        {CHAPTERS.map((c, i) => {
          const Icon = c.icon;
          const cDone = c.lessons.filter((l) => read.has(c.id + '/' + l.id)).length;
          return (
            <button key={c.id} className="g-ch-card" style={{ ['--ch' as string]: c.color }} onClick={() => c.lessons[0] && onGo(c.id + '/' + c.lessons[0].id)} disabled={!c.lessons.length}>
              <div className="g-ch-top">
                <span className="g-ch-icon">
                  <Icon size={18} />
                </span>
                <span className="g-ch-num">Chapter {i + 1}</span>
              </div>
              <div className="g-ch-title">{c.title}</div>
              <div className="g-ch-blurb">{c.blurb}</div>
              <div className="g-ch-lessons">
                {c.lessons.slice(0, 4).map((l) => (
                  <span key={l.id}>{l.title}</span>
                ))}
                {c.lessons.length > 4 && <span className="more">+{c.lessons.length - 4} more</span>}
              </div>
              <div className="g-ch-foot">
                <span>
                  {c.lessons.length} lessons · {chapterMinutes(c)} min
                </span>
                <span className="g-ch-bar">
                  <i style={{ width: `${c.lessons.length ? (cDone / c.lessons.length) * 100 : 0}%` }} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LessonPage({ r, onGo, endRef }: { r: LessonRef; onGo: (k: string) => void; endRef: React.RefObject<HTMLDivElement | null> }) {
  const prev = ALL_LESSONS[r.index - 1];
  const next = ALL_LESSONS[r.index + 1];
  const pos = r.chapter.lessons.indexOf(r.lesson);
  const Icon = r.chapter.icon;
  return (
    <article className="g-lesson" style={{ ['--ch' as string]: r.chapter.color }}>
      <header className="g-lesson-head">
        <div className="g-lesson-kicker">
          <Icon size={14} /> {r.chapter.title} · Lesson {pos + 1} of {r.chapter.lessons.length}
        </div>
        <h1>{r.lesson.title}</h1>
        <p className="g-lesson-sum">{r.lesson.summary}</p>
        <div className="g-lesson-meta">
          <Clock size={12} /> {r.lesson.minutes} min read
        </div>
      </header>
      <div className="g-body">{r.lesson.body()}</div>
      <div ref={endRef} className="g-end" />
      <nav className="g-pager">
        {prev ? (
          <button className="g-pager-btn prev" onClick={() => onGo(prev.key)}>
            <span className="g-pager-dir">
              <ChevronLeft size={13} /> Previous
            </span>
            <span className="g-pager-title">{prev.lesson.title}</span>
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button className="g-pager-btn next" style={{ ['--ch' as string]: next.chapter.color }} onClick={() => onGo(next.key)}>
            <span className="g-pager-dir">
              {next.chapter !== r.chapter ? `Next chapter: ${next.chapter.title}` : 'Next lesson'} <ChevronRight size={13} />
            </span>
            <span className="g-pager-title">{next.lesson.title}</span>
          </button>
        )}
      </nav>
    </article>
  );
}

function SearchResults({ results, query, onOpen }: { results: LessonRef[]; query: string; onOpen: (k: string) => void }) {
  return (
    <div className="g-results">
      <h2>
        {results.length ? `${results.length} lesson${results.length > 1 ? 's' : ''}` : 'Nothing found'} for “{query}”
      </h2>
      {results.map((r) => (
        <button key={r.key} className="g-result" style={{ ['--ch' as string]: r.chapter.color }} onClick={() => onOpen(r.key)}>
          <span className="g-result-ch">{r.chapter.title}</span>
          <span className="g-result-title">{r.lesson.title}</span>
          <span className="g-result-sum">{r.lesson.summary}</span>
        </button>
      ))}
    </div>
  );
}
