import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { BANNER_H, BANNER_W, fileToBanner } from '../lib/image';

/** Course banner: choose an image (auto-cropped to 960 x 320) or paste an https image link. */
export function BannerPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const isData = value.startsWith('data:');
  const pick = async (f?: File) => {
    if (!f) return;
    setErr(''); setBusy(true);
    try { onChange(await fileToBanner(f)); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not use this image'); } finally { setBusy(false); }
  };
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-sm font-medium">Banner image (optional)</legend>
      <div className="relative mb-2 aspect-[3/1] w-full overflow-hidden rounded-lg bg-subtle">
        {value ? <img src={value} alt="Banner preview" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted">No banner: a colour is used</div>}
      </div>
      <p className="mb-2 text-xs text-muted">Best size: <b>{BANNER_W} × {BANNER_H} px</b> (wide, 3:1). Any bigger image is cropped from the centre automatically. Keep the main text or face in the middle.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-outline !min-h-[40px] cursor-pointer"><ImagePlus className="h-4 w-4" /> {busy ? 'Processing...' : 'Choose image'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} /></label>
        {value && <button type="button" className="inline-flex min-h-[40px] items-center gap-1 text-sm font-medium text-red-600" onClick={() => onChange('')}><Trash2 className="h-4 w-4" /> Remove</button>}
      </div>
      <input className="input mt-2" placeholder="or paste an image link (https://...)" aria-label="Banner image link" value={isData ? '' : value} onChange={(e) => onChange(e.target.value)} />
      {value && !isData && !/^https:\/\//i.test(value) && <p className="mt-1 text-xs text-red-600">The link must start with https://</p>}
      {err && <p role="alert" className="mt-1 text-xs text-red-600">{err}</p>}
    </fieldset>
  );
}
