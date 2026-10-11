// YouTube publishing: Google sign-in (Google Identity Services token flow, all in the
// browser), channel and playlist lookup, resumable video upload, thumbnail and playlist.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3';
const CLIENT_KEY = 'bf.googleClientId';

/**
 * BandForge's own Google OAuth client (Web application). It identifies the app, not a user,
 * and isn't secret: everyone signs in to their own channel through it.
 */
export const BUILT_IN_CLIENT_ID = '';

export const SCOPE_UPLOAD = 'https://www.googleapis.com/auth/youtube.upload';
export const SCOPE_READ = 'https://www.googleapis.com/auth/youtube.readonly';
/** Needed only to add the video to a playlist (asked for when you pick one). */
export const SCOPE_MANAGE = 'https://www.googleapis.com/auth/youtube.force-ssl';

// ---------------------------------------------------------------- client id

/** The Google OAuth client id: a developer override from Settings, the build env, or the built-in one. */
export function googleClientId(): string {
  try {
    const own = localStorage.getItem(CLIENT_KEY)?.trim();
    if (own) return own;
  } catch {
    /* private mode */
  }
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || BUILT_IN_CLIENT_ID;
}

export function setGoogleClientId(id: string): void {
  try {
    if (id.trim()) localStorage.setItem(CLIENT_KEY, id.trim());
    else localStorage.removeItem(CLIENT_KEY);
  } catch {
    /* private mode */
  }
  session = null;
}

export function looksLikeClientId(id: string): boolean {
  return /^[\w-]+\.apps\.googleusercontent\.com$/.test(id.trim());
}

// ---------------------------------------------------------------- sign-in

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken(o?: { prompt?: string; scope?: string; hint?: string }): void;
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(cfg: {
        client_id: string;
        scope: string;
        include_granted_scopes?: boolean;
        callback: (r: TokenResponse) => void;
        error_callback?: (e: { type: string; message?: string }) => void;
      }): TokenClient;
      revoke(token: string, done?: () => void): void;
    };
  };
}

let gisLoad: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis };
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google);
  gisLoad ??= new Promise<Gis>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => (w.google?.accounts?.oauth2 ? resolve(w.google) : reject(new Error('Google sign-in did not load')));
    s.onerror = () => {
      gisLoad = null;
      reject(new Error("Couldn't reach Google. Check your internet connection"));
    };
    document.head.appendChild(s);
  });
  return gisLoad;
}

interface Session {
  token: string;
  expires: number;
  scopes: Set<string>;
}
let session: Session | null = null;

export class YouTubeError extends Error {
  readonly reason?: string;
  readonly status?: number;
  constructor(message: string, reason?: string, status?: number) {
    super(message);
    this.reason = reason;
    this.status = status;
  }
}

/**
 * Get an access token with `scopes`, showing Google's sign-in (and channel chooser) when
 * needed. `pick` forces the account/channel chooser.
 */
export async function signIn(scopes: string[], pick = false): Promise<string> {
  const clientId = googleClientId();
  if (!clientId) throw new YouTubeError('YouTube publishing isn’t set up yet', 'noClientId');
  const have = session && session.expires > Date.now() + 60_000 && scopes.every((s) => session!.scopes.has(s));
  if (have && !pick) return session!.token;
  const gis = await loadGis();
  return new Promise<string>((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(' '),
      include_granted_scopes: true,
      callback: (r) => {
        if (r.error || !r.access_token) {
          reject(new YouTubeError(r.error === 'access_denied' ? 'You didn’t give BandForge permission' : r.error_description || r.error || 'Sign-in failed', r.error));
          return;
        }
        const granted = new Set((r.scope ?? '').split(/\s+/).filter(Boolean));
        if (!scopes.every((s) => granted.has(s))) {
          reject(new YouTubeError('Please tick every permission box on Google’s screen so BandForge can upload', 'scopes'));
          return;
        }
        session = { token: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000, scopes: granted };
        resolve(r.access_token);
      },
      error_callback: (e) =>
        reject(new YouTubeError(e.type === 'popup_closed' ? 'Sign-in window was closed' : e.type === 'popup_failed_to_open' ? 'Your browser blocked the Google sign-in window' : e.message || 'Sign-in failed', e.type)),
    });
    client.requestAccessToken({ prompt: pick ? 'select_account consent' : session ? '' : 'select_account' });
  });
}

export function isSignedIn(): boolean {
  return !!session && session.expires > Date.now();
}

export async function signOut(): Promise<void> {
  const s = session;
  session = null;
  if (!s) return;
  try {
    (await loadGis()).accounts.oauth2.revoke(s.token);
  } catch {
    /* offline: the token expires on its own */
  }
}

// ---------------------------------------------------------------- API

async function call<T>(method: string, url: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw await apiError(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function apiError(res: Response | { status: number; text: string }): Promise<YouTubeError> {
  let text = '';
  try {
    text = 'text' in res && typeof res.text === 'string' ? res.text : await (res as Response).text();
  } catch {
    /* ignore */
  }
  let reason = '';
  let msg = '';
  try {
    const j = JSON.parse(text);
    reason = j.error?.errors?.[0]?.reason ?? j.error?.status ?? '';
    msg = j.error?.message ?? '';
  } catch {
    msg = text.slice(0, 200);
  }
  const friendly: Record<string, string> = {
    youtubeSignupRequired: 'This Google account doesn’t have a YouTube channel yet. Create one on youtube.com, then try again',
    quotaExceeded: 'The daily YouTube upload limit for this app has been reached. Try again tomorrow',
    uploadLimitExceeded: 'Your channel has reached its upload limit for now. Try again later',
    forbidden: 'YouTube didn’t allow this. Your channel may need to be verified',
    invalidTitle: 'YouTube didn’t accept the title',
    invalidDescription: 'YouTube didn’t accept the description',
    invalidTags: 'YouTube didn’t accept the tags',
    invalidPublishAt: 'Pick a release time in the future',
    mediaBodyRequired: 'The video file was empty',
  };
  if (res.status === 401) session = null;
  return new YouTubeError(friendly[reason] ?? (res.status === 401 ? 'Your Google sign-in expired. Sign in again' : msg || `YouTube error ${res.status}`), reason, res.status);
}

export interface Channel {
  id: string;
  title: string;
  handle?: string;
  thumb?: string;
}

export async function myChannel(token: string): Promise<Channel | null> {
  const r = await call<{ items?: { id: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } } }[] }>(
    'GET',
    `${API}/channels?part=snippet&mine=true`,
    token,
  );
  const c = r.items?.[0];
  return c ? { id: c.id, title: c.snippet.title, handle: c.snippet.customUrl, thumb: c.snippet.thumbnails?.default?.url } : null;
}

export interface Playlist {
  id: string;
  title: string;
}

export async function myPlaylists(token: string): Promise<Playlist[]> {
  const out: Playlist[] = [];
  let page = '';
  for (let i = 0; i < 5; i++) {
    const r = await call<{ items?: { id: string; snippet: { title: string } }[]; nextPageToken?: string }>(
      'GET',
      `${API}/playlists?part=snippet&mine=true&maxResults=50${page ? `&pageToken=${page}` : ''}`,
      token,
    );
    for (const p of r.items ?? []) out.push({ id: p.id, title: p.snippet.title });
    if (!r.nextPageToken) break;
    page = r.nextPageToken;
  }
  return out;
}

export interface VideoResource {
  snippet: { title: string; description: string; tags: string[]; categoryId: string; defaultLanguage?: string; defaultAudioLanguage?: string };
  status: {
    privacyStatus: 'private' | 'unlisted' | 'public';
    publishAt?: string;
    selfDeclaredMadeForKids: boolean;
    containsSyntheticMedia: boolean;
    license: 'youtube' | 'creativeCommon';
    embeddable: boolean;
    publicStatsViewable: boolean;
  };
  recordingDetails?: { recordingDate?: string };
}

/**
 * Resumable upload (survives brief network drops). Returns the new video id.
 * `signal` cancels it.
 */
export async function uploadVideo(
  token: string,
  file: Blob,
  video: VideoResource,
  opts: { notifySubscribers: boolean; onProgress?: (f: number) => void; signal?: AbortSignal },
): Promise<string> {
  const parts = 'snippet,status' + (video.recordingDetails ? ',recordingDetails' : '');
  const start = await fetch(`${UPLOAD}/videos?uploadType=resumable&part=${parts}&notifySubscribers=${opts.notifySubscribers}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(file.size),
      'X-Upload-Content-Type': file.type || 'video/mp4',
    },
    body: JSON.stringify(video),
    signal: opts.signal,
  });
  if (!start.ok) throw await apiError(start);
  const location = start.headers.get('Location');
  if (!location) throw new YouTubeError('YouTube didn’t start the upload');

  let sent = 0;
  for (let attempt = 0, rounds = 0; ; rounds++) {
    if (rounds > 40) throw new YouTubeError('The upload kept failing. Check your connection and try again');
    const r = await putChunk(location, file, sent, opts);
    if (r.status === 200 || r.status === 201) {
      const id = (JSON.parse(r.text) as { id?: string }).id;
      if (!id) throw new YouTubeError('YouTube didn’t return the video');
      opts.onProgress?.(1);
      return id;
    }
    if (r.status === 308 || r.status === 0 || r.status >= 500) {
      if (opts.signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
      if (r.status !== 308 && ++attempt > 6) throw new YouTubeError('The upload kept failing. Check your connection and try again');
      if (r.status !== 308) await new Promise((res) => setTimeout(res, Math.min(30_000, 1000 * 2 ** attempt)));
      // Ask where to resume from.
      const q = await fetch(location, { method: 'PUT', headers: { 'Content-Range': `bytes */${file.size}` }, signal: opts.signal }).catch(() => null);
      if (q && (q.status === 200 || q.status === 201)) {
        const id = ((await q.json()) as { id?: string }).id;
        if (id) return id;
      }
      const range = q?.headers.get('Range');
      sent = range ? Number(range.split('-')[1]) + 1 : q?.status === 308 ? 0 : sent;
      continue;
    }
    throw await apiError({ status: r.status, text: r.text });
  }
}

/** XHR so upload progress can be shown. */
function putChunk(
  location: string,
  file: Blob,
  from: number,
  opts: { onProgress?: (f: number) => void; signal?: AbortSignal },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', location);
    if (from > 0) xhr.setRequestHeader('Content-Range', `bytes ${from}-${file.size - 1}/${file.size}`);
    xhr.upload.onprogress = (e) => opts.onProgress?.(Math.min(0.999, (from + e.loaded) / file.size));
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => resolve({ status: 0, text: '' });
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    opts.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(from > 0 ? file.slice(from) : file);
  });
}

export async function setThumbnail(token: string, videoId: string, image: Blob): Promise<void> {
  const res = await fetch(`${UPLOAD}/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': image.type || 'image/jpeg' },
    body: image,
  });
  if (!res.ok) {
    const e = await apiError(res);
    if (e.status === 403) throw new YouTubeError('Custom thumbnails need a verified channel (youtube.com/verify). The video is up; YouTube picked a thumbnail for now', 'thumbnail');
    throw e;
  }
}

export async function addToPlaylist(token: string, playlistId: string, videoId: string): Promise<void> {
  await call('POST', `${API}/playlistItems?part=snippet`, token, { snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } });
}
