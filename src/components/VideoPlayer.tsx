import { ExternalLink, VideoOff } from 'lucide-react';
import { parseVideoUrl } from '../lib/video';

export function VideoPlayer({ url, title }: { url?: string; title: string }) {
  const v = parseVideoUrl(url ?? '');
  const frame = 'aspect-video w-full overflow-hidden rounded-xl bg-black';
  if (v.kind === 'none') {
    return <div className={`${frame} flex flex-col items-center justify-center gap-2 !bg-subtle text-sm text-muted`}><VideoOff className="h-8 w-8" />{url ? 'This video link is not valid.' : 'No video for this lesson.'}</div>;
  }
  if (v.kind === 'file') {
    return <div className={frame}><video key={v.src} className="h-full w-full" controls preload="metadata" controlsList="nodownload" playsInline src={v.src}>Your browser cannot play this video.</video></div>;
  }
  if (v.kind === 'link') {
    return (
      <div className={`${frame} flex flex-col items-center justify-center gap-3 !bg-subtle p-4 text-center`}>
        <p className="text-sm text-muted">This video is hosted on another site.</p>
        <a className="btn-primary" href={v.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open video</a>
      </div>
    );
  }
  return (
    <div className={frame}>
      <iframe key={v.embedUrl} src={v.embedUrl} title={title} className="h-full w-full border-0" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" />
    </div>
  );
}
