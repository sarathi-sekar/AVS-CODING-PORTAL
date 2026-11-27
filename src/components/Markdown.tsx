import { Fragment, type ReactNode } from 'react';

/** Small, safe markdown subset (no HTML injection): headings, lists, fenced code, bold, inline code, paragraphs. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith('`')
      ? <code key={i++} className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>
      : <strong key={i++}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={k++} className="my-3 whitespace-pre-wrap break-words rounded-xl border border-line bg-subtle p-3 text-[13px] leading-relaxed [overflow-wrap:anywhere]"><code className="font-mono">{buf.join('\n')}</code></pre>);
    } else if (/^#{1,3}\s/.test(line)) {
      const lvl = line.match(/^#+/)![0].length;
      const t = line.replace(/^#+\s*/, '');
      blocks.push(lvl === 1 ? <h2 key={k++} className="mb-2 mt-5 text-lg font-semibold">{inline(t)}</h2> : lvl === 2 ? <h3 key={k++} className="mb-2 mt-4 text-base font-semibold">{inline(t)}</h3> : <h4 key={k++} className="mb-1 mt-3 text-sm font-semibold">{inline(t)}</h4>);
      i++;
    } else if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push(<ul key={k++} className="my-2 list-disc space-y-1 pl-5 text-sm">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>);
    } else if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s+/, ''));
      blocks.push(<ol key={k++} className="my-2 list-decimal space-y-1 pl-5 text-sm">{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>);
    } else if (line.trim() === '') {
      i++;
    } else {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !/^#{1,3}\s/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) buf.push(lines[i++]);
      blocks.push(<p key={k++} className="my-2 break-words text-sm leading-relaxed">{buf.map((t, j) => <Fragment key={j}>{j > 0 && <br />}{inline(t)}</Fragment>)}</p>);
    }
  }
  return <div>{blocks}</div>;
}
