export type VideoKind = 'youtube' | 'vimeo' | 'drive' | 'file' | 'link' | 'none';
export interface ParsedVideo { kind: VideoKind; embedUrl?: string; src?: string; url: string }

const FILE_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i;

/** Turns a pasted video link into something the player can show. Only https links are accepted. */
export function parseVideoUrl(raw: string): ParsedVideo {
  const url = raw.trim();
  if (!url) return { kind: 'none', url };
  let u: URL;
  try { u = new URL(url); } catch { return { kind: 'none', url }; }
  if (u.protocol !== 'https:') return { kind: 'none', url };
  const host = u.hostname.replace(/^www\.|^m\./, '');

  if (host === 'youtu.be') { const id = u.pathname.slice(1).split('/')[0]; if (/^[\w-]{6,}$/.test(id)) return { kind: 'youtube', url, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0` }; }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = u.searchParams.get('v');
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
    const id = v ?? m?.[1];
    if (id && /^[\w-]{6,}$/.test(id)) return { kind: 'youtube', url, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    if (id) return { kind: 'vimeo', url, embedUrl: `https://player.vimeo.com/video/${id}` };
  }
  if (host === 'drive.google.com') {
    const id = u.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? u.searchParams.get('id');
    if (id) return { kind: 'drive', url, embedUrl: `https://drive.google.com/file/d/${id}/preview` };
  }
  if (FILE_EXT.test(u.pathname) || host.endsWith('firebasestorage.googleapis.com') || host.endsWith('firebasestorage.app')) return { kind: 'file', url, src: url };
  return { kind: 'link', url };
}

export const VIDEO_KIND_LABEL: Record<VideoKind, string> = { youtube: 'YouTube', vimeo: 'Vimeo', drive: 'Google Drive', file: 'Video file', link: 'External link', none: 'None' };
