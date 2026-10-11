import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, ImagePlus, LogOut, RefreshCw, Trash2, Upload, UserRound } from 'lucide-react';
import { closeModal, commit, toast, useStore } from '../../state/store';
import { normalize, renderProject } from '../../audio/export';
import type { Project, YouTubeInfo } from '../../model/types';
import { Toggle } from '../common/controls';
import Modal from './Modal';
import { makeCover } from './coverArt';
import { fitTags, trimBytes, videoDescription, videoTags, videoTitle } from '../../publish/description';
import {
  addToPlaylist,
  googleClientId,
  looksLikeClientId,
  myChannel,
  myPlaylists,
  SCOPE_MANAGE,
  SCOPE_READ,
  SCOPE_UPLOAD,
  setGoogleClientId,
  setThumbnail,
  signIn,
  signOut,
  uploadVideo,
  YouTubeError,
  type Channel,
  type Playlist,
} from '../../publish/youtube';
import type { VideoStyle } from '../../publish/video';
import '../mixer/mixer.css';
import './export.css';
import './youtube.css';

type Privacy = 'private' | 'unlisted' | 'public' | 'scheduled';

interface Prefs {
  style: VideoStyle;
  privacy: Privacy;
  kids: boolean | null;
  synthetic: boolean;
  license: 'youtube' | 'creativeCommon';
  embeddable: boolean;
  notify: boolean;
  category: string;
  credit: boolean;
}
const DEFAULTS: Prefs = { style: 'visualizer', privacy: 'private', kids: null, synthetic: false, license: 'youtube', embeddable: true, notify: true, category: '10', credit: true };
const PREFS_KEY = 'bf.youtube';
const CATEGORIES = [
  ['10', 'Music'],
  ['24', 'Entertainment'],
  ['22', 'People & Blogs'],
  ['27', 'Education'],
  ['20', 'Gaming'],
  ['1', 'Film & Animation'],
];

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* private mode */
  }
  return DEFAULTS;
}

function localInput(d: Date): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 16);
}

type Phase = { label: string; f: number } | null;

export default function YouTubeDialog() {
  const p = useStore((s) => s.project)!;
  const yt: YouTubeInfo = p.info?.youtube ?? {};
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [clientId, setClientId] = useState(googleClientId);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlist, setPlaylist] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [schedule, setSchedule] = useState(() => localInput(new Date(Date.now() + 24 * 3600_000)));
  const [phase, setPhase] = useState<Phase>(null);
  const [done, setDone] = useState<{ id: string; warning?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const update = (patch: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });

  const saveYt = (patch: Partial<YouTubeInfo>) =>
    commit((d) => {
      const info = (d.info ??= {});
      const next: YouTubeInfo = { ...(info.youtube ?? {}), ...patch };
      for (const k of Object.keys(next) as (keyof YouTubeInfo)[]) if (next[k] === undefined) delete next[k];
      info.youtube = next;
    });

  // Automatic text follows the song info until you edit it.
  const autoTitle = videoTitle(p);
  const autoDesc = useMemo(() => videoDescription(p, { credit: prefs.credit }), [p, prefs.credit]);
  const autoTags = useMemo(() => videoTags(p), [p]);
  const title = yt.title ?? autoTitle;
  const description = yt.description ?? autoDesc;
  const tags = yt.tags ?? autoTags;

  const connect = async (pick: boolean) => {
    setConnecting(true);
    setError(null);
    try {
      const token = await signIn([SCOPE_UPLOAD, SCOPE_READ], pick);
      const ch = await myChannel(token);
      if (!ch) throw new YouTubeError('This Google account doesn’t have a YouTube channel yet. Create one on youtube.com, then connect again');
      setChannel(ch);
      setPlaylist('');
      setPlaylists(await myPlaylists(token).catch(() => []));
    } catch (e) {
      setChannel(null);
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  // Reconnect quietly if this tab already signed in.
  useEffect(() => {
    if (clientId && !channel) {
      void (async () => {
        const { isSignedIn } = await import('../../publish/youtube');
        if (isSignedIn()) void connect(false);
      })();
    }
  }, [clientId]);

  const missing: string[] = [];
  if (!channel) missing.push('connect a channel');
  if (!title.trim()) missing.push('add a title');
  if (prefs.kids === null) missing.push('choose the audience');
  const scheduledAt = new Date(schedule);
  if (prefs.privacy === 'scheduled' && !(scheduledAt.getTime() > Date.now() + 60_000)) missing.push('pick a future release time');

  const publish = async () => {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setError(null);
    try {
      const project = useStore.getState().project as Project;
      setPhase({ label: 'Mixing your song…', f: 0 });
      const buf = await renderProject(project, { tail: 2.5, sampleRate: 48000, onProgress: (f) => setPhase({ label: 'Mixing your song…', f: f * 0.25 }) });
      normalize(buf);
      const vid = await import('../../publish/video');
      setPhase({ label: 'Making the video…', f: 0.25 });
      const video = await vid.renderVideo(project, buf, prefs.style, (f) => setPhase({ label: 'Making the video…', f: 0.25 + f * 0.3 }), ctrl.signal);
      const token = await signIn([SCOPE_UPLOAD, SCOPE_READ]);
      const mb = (n: number) => (n / 1e6).toFixed(1);
      setPhase({ label: `Uploading 0 of ${mb(video.size)} MB…`, f: 0.55 });
      const priv = prefs.privacy === 'scheduled' ? 'private' : prefs.privacy;
      const id = await uploadVideo(
        token,
        video,
        {
          snippet: { title: title.trim().slice(0, 100), description: trimBytes(description, 5000), tags: fitTags(tags), categoryId: prefs.category },
          status: {
            privacyStatus: priv,
            ...(prefs.privacy === 'scheduled' ? { publishAt: scheduledAt.toISOString() } : {}),
            selfDeclaredMadeForKids: !!prefs.kids,
            containsSyntheticMedia: prefs.synthetic,
            license: prefs.license,
            embeddable: prefs.embeddable,
            publicStatsViewable: true,
          },
          recordingDetails: { recordingDate: new Date(project.updatedAt || Date.now()).toISOString() },
        },
        {
          notifySubscribers: prefs.privacy === 'public' || prefs.privacy === 'scheduled' ? prefs.notify : false,
          signal: ctrl.signal,
          onProgress: (f) => setPhase({ label: `Uploading ${mb(f * video.size)} of ${mb(video.size)} MB…`, f: 0.55 + f * 0.4 }),
        },
      );
      saveYt({ videoId: id, channel: channel?.title, publishedAt: Date.now() });
      const warnings: string[] = [];
      setPhase({ label: 'Setting the thumbnail…', f: 0.96 });
      try {
        const thumb = yt.thumbnail ?? (await vid.defaultThumbnail(project));
        await setThumbnail(token, id, vid.dataUrlToBlob(thumb));
      } catch (e) {
        warnings.push((e as Error).message);
      }
      if (playlist) {
        setPhase({ label: 'Adding to your playlist…', f: 0.98 });
        try {
          await addToPlaylist(await signIn([SCOPE_UPLOAD, SCOPE_READ, SCOPE_MANAGE]), playlist, id);
        } catch (e) {
          warnings.push("Couldn't add it to the playlist: " + (e as Error).message);
        }
      }
      setPhase(null);
      setDone({ id, warning: warnings.join(' ') || undefined });
    } catch (e) {
      setPhase(null);
      if ((e as Error).name === 'AbortError') toast('Publishing cancelled', 'info');
      else {
        console.error(e);
        setError((e as Error).message);
      }
    } finally {
      abort.current = null;
    }
  };

  if (!clientId) return <SetupView onDone={(id) => setClientId(id)} />;

  if (done) return <DoneView id={done.id} warning={done.warning} privacy={prefs.privacy} channel={channel?.title} />;

  const busy = !!phase;
  return (
    <Modal
      title="Publish to YouTube"
      width={900}
      onClose={busy ? () => undefined : closeModal}
      footer={
        <>
          <span className="export-summary dim">{busy ? phase!.label : missing.length ? `To publish: ${missing.join(', ')}` : `Ready to publish${channel ? ` to ${channel.title}` : ''}`}</span>
          {busy ? (
            <button className="btn" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          ) : (
            <button className="btn" onClick={closeModal}>
              Close
            </button>
          )}
          <button className="btn primary yt-publish" disabled={busy || missing.length > 0} onClick={() => void publish()}>
            <Upload size={15} /> {prefs.privacy === 'scheduled' ? 'Schedule' : prefs.privacy === 'public' ? 'Publish' : 'Upload'}
          </button>
        </>
      }
    >
      {yt.videoId && (
        <div className="yt-banner">
          <Check size={14} />
          <span>
            Published {yt.publishedAt ? new Date(yt.publishedAt).toLocaleDateString() : ''}
            {yt.channel ? ` to ${yt.channel}` : ''}. Publishing again makes a new video.
          </span>
          <a href={`https://youtu.be/${yt.videoId}`} target="_blank" rel="noreferrer">
            Open <ExternalLink size={12} />
          </a>
        </div>
      )}
      {error && <div className="yt-error">{error}</div>}

      <section className="yt-section">
        <div className="yt-step">1</div>
        <div className="yt-sec-body">
          <div className="yt-sec-title">Channel</div>
          {channel ? (
            <div className="yt-channel">
              {channel.thumb ? <img src={channel.thumb} alt="" /> : <UserRound size={28} />}
              <div className="grow">
                <b>{channel.title}</b>
                {channel.handle && <span className="dim">{channel.handle}</span>}
              </div>
              <button className="btn sm" disabled={busy || connecting} onClick={() => void connect(true)} title="Pick another Google account or brand channel">
                <RefreshCw size={13} /> Switch channel
              </button>
              <button
                className="btn ghost sm"
                disabled={busy}
                onClick={() => {
                  void signOut();
                  setChannel(null);
                  setPlaylists([]);
                }}
                title="Sign out of Google in BandForge"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <div className="yt-connect">
              <button className="btn primary" disabled={connecting} onClick={() => void connect(true)}>
                <UserRound size={15} /> {connecting ? 'Waiting for Google…' : 'Connect YouTube channel'}
              </button>
              <span className="dim">Google asks which account and channel to use. BandForge only asks to upload videos and see your channel name and playlists.</span>
            </div>
          )}
        </div>
      </section>

      <section className="yt-section">
        <div className="yt-step">2</div>
        <div className="yt-sec-body">
          <div className="yt-sec-title">Video, cover and thumbnail</div>
          <ArtPicker style={prefs.style} onStyle={(style) => update({ style })} thumbnail={yt.thumbnail} onThumbnail={(thumbnail) => saveYt({ thumbnail })} disabled={busy} />
        </div>
      </section>

      <section className="yt-section">
        <div className="yt-step">3</div>
        <div className="yt-sec-body">
          <div className="yt-sec-title">Details</div>
          <div className="yt-details">
            <label className="info-field">
              <span>
                Title <Counter n={title.length} max={100} />
              </span>
              <input
                key={'t:' + title}
                type="text"
                defaultValue={title}
                maxLength={100}
                disabled={busy}
                onBlur={(e) => e.target.value !== title && saveYt({ title: e.target.value === autoTitle ? undefined : e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </label>
            <label className="info-field">
              <span>
                Description <Counter n={new TextEncoder().encode(description).length} max={5000} />
                {yt.description !== undefined && (
                  <button className="yt-link" onClick={(e) => (e.preventDefault(), saveYt({ description: undefined }))}>
                    Rebuild from song info
                  </button>
                )}
              </span>
              <textarea
                key={'d:' + description}
                defaultValue={description}
                rows={9}
                disabled={busy}
                onBlur={(e) => e.target.value !== description && saveYt({ description: e.target.value === autoDesc ? undefined : e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </label>
            <label className="info-field">
              <span>
                Tags <Counter n={tags.join(',').length} max={500} />
                {yt.tags !== undefined && (
                  <button className="yt-link" onClick={(e) => (e.preventDefault(), saveYt({ tags: undefined }))}>
                    Rebuild from song info
                  </button>
                )}
              </span>
              <input
                key={'g:' + tags.join(',')}
                type="text"
                defaultValue={tags.join(', ')}
                disabled={busy}
                placeholder="Separate tags with commas"
                onBlur={(e) => {
                  const next = fitTags(e.target.value.split(',').map((t) => t.replace(/[<>]/g, '').trim()).filter(Boolean));
                  if (next.join(',') !== tags.join(',')) saveYt({ tags: next.join(',') === autoTags.join(',') ? undefined : next });
                }}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </label>
            <div className="yt-row">
              <label className="info-field">
                <span>Category</span>
                <select value={prefs.category} disabled={busy} onChange={(e) => update({ category: e.target.value })}>
                  {CATEGORIES.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="info-field">
                <span>Playlist</span>
                <select value={playlist} disabled={busy || !channel} onChange={(e) => setPlaylist(e.target.value)}>
                  <option value="">None</option>
                  {playlists.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="yt-check">
                <Toggle on={prefs.credit} onChange={(credit) => update({ credit })} />
                <span>Say it was made in BandForge</span>
              </label>
            </div>
            <div className="faint yt-hint">Title, description and tags come from Song Info (in Export) until you change them here. Sections in your arrangement become YouTube chapters.</div>
          </div>
        </div>
      </section>

      <section className="yt-section">
        <div className="yt-step">4</div>
        <div className="yt-sec-body">
          <div className="yt-sec-title">Visibility and settings</div>
          <div className="yt-settings">
            <span className="label">Visibility</span>
            <div className="yt-vis">
              <div className="seg export-seg">
                {(
                  [
                    ['private', 'Private', 'Only you'],
                    ['unlisted', 'Unlisted', 'Anyone with the link'],
                    ['public', 'Public', 'Everyone'],
                    ['scheduled', 'Schedule', 'Private until the release time, then public'],
                  ] as const
                ).map(([v, label, tip]) => (
                  <button key={v} className={prefs.privacy === v ? 'on' : ''} disabled={busy} onClick={() => update({ privacy: v })} title={tip}>
                    {label}
                  </button>
                ))}
              </div>
              {prefs.privacy === 'scheduled' && <input type="datetime-local" value={schedule} min={localInput(new Date())} disabled={busy} onChange={(e) => setSchedule(e.target.value)} />}
            </div>
            {(prefs.privacy === 'public' || prefs.privacy === 'scheduled') && (
              <>
                <span className="label">Notify</span>
                <div className="row">
                  <Toggle on={prefs.notify} onChange={(notify) => update({ notify })} />
                  <span className="dim export-hint">Tell your subscribers</span>
                </div>
              </>
            )}
            <span className="label">Audience</span>
            <div className="yt-radios">
              <label>
                <input type="radio" name="kids" checked={prefs.kids === false} disabled={busy} onChange={() => update({ kids: false })} /> No, it's not made for kids
              </label>
              <label>
                <input type="radio" name="kids" checked={prefs.kids === true} disabled={busy} onChange={() => update({ kids: true })} /> Yes, it's made for kids
              </label>
              <span className="faint yt-hint">YouTube requires you to say. Made for kids turns off comments and personalized ads.</span>
            </div>
            <span className="label">Altered content</span>
            <div className="row">
              <Toggle on={prefs.synthetic} onChange={(synthetic) => update({ synthetic })} />
              <span className="dim export-hint">Contains realistic AI-generated or altered people, places or events</span>
            </div>
            <span className="label">License</span>
            <div className="seg export-seg">
              <button className={prefs.license === 'youtube' ? 'on' : ''} disabled={busy} onClick={() => update({ license: 'youtube' })}>
                Standard YouTube
              </button>
              <button className={prefs.license === 'creativeCommon' ? 'on' : ''} disabled={busy} onClick={() => update({ license: 'creativeCommon' })} title="Others may reuse it with credit">
                Creative Commons
              </button>
            </div>
            <span className="label">Embedding</span>
            <div className="row">
              <Toggle on={prefs.embeddable} onChange={(embeddable) => update({ embeddable })} />
              <span className="dim export-hint">Allow other sites to embed it</span>
            </div>
          </div>
        </div>
      </section>

      <div className="faint yt-terms">
        By publishing you agree to the{' '}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">
          YouTube Terms of Service
        </a>
        . BandForge uses YouTube API Services; see the{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
          Google Privacy Policy
        </a>{' '}
        and{' '}
        <a href="./privacy.html" target="_blank" rel="noreferrer">
          BandForge's privacy policy
        </a>
        . You can remove BandForge's access any time at{' '}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          myaccount.google.com/permissions
        </a>
        .
      </div>
      {busy && (
        <div className="progress" style={{ marginTop: 6 }}>
          <div style={{ width: `${Math.round(phase!.f * 100)}%` }} />
        </div>
      )}
    </Modal>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return <em className={'yt-count' + (n > max * 0.9 ? ' near' : '')}>{n}/{max}</em>;
}

/** Video style, the album cover shown in it, and the thumbnail. */
function ArtPicker({ style, onStyle, thumbnail, onThumbnail, disabled }: { style: VideoStyle; onStyle: (s: VideoStyle) => void; thumbnail?: string; onThumbnail: (t: string | undefined) => void; disabled: boolean }) {
  const p = useStore((s) => s.project)!;
  const [preview, setPreview] = useState<string | null>(null);
  const [autoThumb, setAutoThumb] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const key = `${p.name}|${p.info?.artist}|${p.info?.album}|${p.info?.cover?.length}|${style}`;
  useEffect(() => {
    let live = true;
    void import('../../publish/video').then(async (v) => {
      const [frame, thumb] = await Promise.all([v.previewFrame(p, style), v.defaultThumbnail(p)]);
      if (live) {
        setPreview(frame);
        setAutoThumb(thumb);
      }
    });
    return () => void (live = false);
  }, [key]);

  const setCover = async (f?: File) => {
    if (!f) return;
    try {
      const { cover, thumb, small } = await makeCover(f);
      commit((d) => {
        d.info = { ...(d.info ?? {}), cover, coverThumb: thumb };
      });
      if (small) toast('That image is small. Covers look best at 1000×1000 or larger', 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  const setThumb = async (f?: File) => {
    if (!f) return;
    try {
      onThumbnail(await (await import('../../publish/video')).thumbnailFromImage(f));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="yt-art">
      <div className="yt-art-video">
        <div className="yt-frame">{preview ? <img src={preview} alt="Video preview" /> : <div className="yt-frame-wait" />}</div>
        <div className="seg export-seg">
          <button className={style === 'visualizer' ? 'on' : ''} disabled={disabled} onClick={() => onStyle('visualizer')} title="Cover with a moving spectrum and progress bar">
            Visualizer
          </button>
          <button className={style === 'still' ? 'on' : ''} disabled={disabled} onClick={() => onStyle('still')} title="Just the cover and title. Smallest file, quickest upload">
            Still cover
          </button>
        </div>
      </div>
      <div className="yt-art-side">
        <div className="yt-art-item">
          <span className="yt-art-label">Cover</span>
          <div className="yt-cover" onClick={() => !disabled && coverRef.current?.click()} title="Change the album cover" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), void setCover(e.dataTransfer.files[0]))}>
            {p.info?.cover ? <img src={p.info.cover} alt="Album cover" /> : <ImagePlus size={20} />}
          </div>
          <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => (void setCover(e.target.files?.[0]), (e.target.value = ''))} />
        </div>
        <div className="yt-art-item">
          <span className="yt-art-label">
            Thumbnail
            {thumbnail && (
              <button className="yt-link" disabled={disabled} onClick={() => onThumbnail(undefined)} title="Go back to the one made from the cover">
                <Trash2 size={11} /> Use automatic
              </button>
            )}
          </span>
          <div className="yt-thumb" onClick={() => !disabled && thumbRef.current?.click()} title="Choose your own thumbnail (16:9)" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), void setThumb(e.dataTransfer.files[0]))}>
            {thumbnail || autoThumb ? <img src={thumbnail ?? autoThumb!} alt="Thumbnail" /> : <div className="yt-frame-wait" />}
            <span className="yt-thumb-tag">{thumbnail ? 'Your image' : 'Automatic'}</span>
          </div>
          <input ref={thumbRef} type="file" accept="image/*" hidden onChange={(e) => (void setThumb(e.target.files?.[0]), (e.target.value = ''))} />
        </div>
      </div>
    </div>
  );
}

function DoneView({ id, warning, privacy, channel }: { id: string; warning?: string; privacy: Privacy; channel?: string }) {
  const url = `https://youtu.be/${id}`;
  const what = privacy === 'public' ? 'is live' : privacy === 'scheduled' ? 'is scheduled' : privacy === 'unlisted' ? 'is up (unlisted)' : 'is up (private)';
  return (
    <Modal
      title="Published"
      width={520}
      footer={
        <button className="btn primary" onClick={closeModal}>
          Done
        </button>
      }
    >
      <div className="yt-done">
        <div className="yt-done-icon">
          <Check size={28} />
        </div>
        <b>Your song {what}{channel ? ` on ${channel}` : ''}.</b>
        <span className="dim">YouTube takes a few minutes to process it before it plays in HD.</span>
        <div className="yt-done-link">
          <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
          <button className="btn sm" onClick={() => void navigator.clipboard?.writeText(url).then(() => toast('Link copied', 'success'))} title="Copy link">
            <Copy size={13} />
          </button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Watch
          </a>
          <a className="btn" href={`https://studio.youtube.com/video/${id}/edit`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Open in YouTube Studio
          </a>
        </div>
        {warning && <div className="yt-warn">{warning}</div>}
      </div>
    </Modal>
  );
}

/**
 * Shown only when this copy of BandForge has no Google client built in (e.g. a self-hosted
 * fork). Regular users never see it; the developer steps are tucked away.
 */
function SetupView({ onDone }: { onDone: (id: string) => void }) {
  const [v, setV] = useState('');
  const [dev, setDev] = useState(false);
  const ok = looksLikeClientId(v);
  const origin = location.origin;
  return (
    <Modal
      title="Publish to YouTube"
      width={620}
      footer={
        dev ? (
          <>
            <button className="btn" onClick={closeModal}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!ok}
              onClick={() => {
                setGoogleClientId(v);
                onDone(v.trim());
              }}
            >
              Save
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={closeModal}>
            OK
          </button>
        )
      }
    >
      <div className="yt-setup">
        <p>YouTube publishing isn't switched on for this copy of BandForge yet. You can still export your song as an audio file and upload it yourself.</p>
        {!dev ? (
          <button className="yt-link" onClick={() => setDev(true)}>
            Running your own copy of BandForge? Set it up
          </button>
        ) : (
          <>
            <ol>
              <li>
                In the{' '}
                <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
                  Google Cloud console
                </a>
                , turn on the <b>YouTube Data API v3</b>.
              </li>
              <li>
                Under <b>Google Auth Platform</b>, set up the consent screen (External).
              </li>
              <li>
                Create an <b>OAuth client ID</b> of type <b>Web application</b> with this authorized JavaScript origin:
                <code>{origin}</code>
              </li>
              <li>Paste the client ID here, or build it in with the VITE_GOOGLE_CLIENT_ID setting.</li>
            </ol>
            <input type="text" placeholder="1234567890-abc123.apps.googleusercontent.com" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.stopPropagation()} autoFocus />
            {v && !ok && <span className="yt-error-inline">That doesn't look like a client ID. It ends in .apps.googleusercontent.com</span>}
          </>
        )}
      </div>
    </Modal>
  );
}
