import { useState } from 'react';
import { SuccessNote } from '../../components/ui';

/** JSON file / paste import with a caller-supplied handler. Handler returns a success message or throws. */
export function ImportBox({ label, template, onImport }: { label: string; template: string; onImport: (json: unknown) => Promise<string> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new Error('That is not valid JSON. Check commas and quotes.'); }
      setMsg({ ok: true, text: await onImport(parsed) });
      setText('');
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'Import failed' }); } finally { setBusy(false); }
  };
  return (
    <details className="card mb-4">
      <summary className="min-h-[40px] cursor-pointer text-sm font-semibold">{label}</summary>
      <div className="mt-3 space-y-3">
        <input type="file" accept=".json,application/json" aria-label="Choose a JSON file" className="block w-full text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setText); }} />
        <textarea className="input min-h-[140px] py-2 font-mono text-xs" aria-label="JSON" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste JSON here" />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={() => void run()}>{busy ? 'Importing...' : 'Import'}</button>
          <button type="button" className="btn-outline" onClick={() => setText(template)}>Insert template</button>
        </div>
        {msg && (msg.ok ? <SuccessNote message={msg.text} /> : <p role="alert" className="whitespace-pre-line rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{msg.text}</p>)}
      </div>
    </details>
  );
}
