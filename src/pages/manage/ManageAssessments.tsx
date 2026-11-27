import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { ClipboardPaste, Copy, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { clearQueryCache } from '../../lib/useDocs';
import { validateAssessment, type AssessmentInput } from '../../lib/validate';
import { AI_MCQ_PROMPT, parseMcqText } from '../../lib/mcqParser';
import { type Assessment } from '../../types';
import { categoryLabel, useAcademic } from '../../lib/academic';
import { EmptyState, PageHeader, Spinner, SuccessNote } from '../../components/ui';
import { ImportBox } from './ImportBox';

const TEMPLATE = JSON.stringify([{ title: 'Percentages - Set 1', category: 'quantitative', company: '', durationMinutes: 20, maxAttempts: 0, status: 'draft', questions: [{ text: 'What is 20% of 250?', options: ['40', '50', '60', '25'], answerIndex: 1, explanation: '250 x 20 / 100 = 50', topic: 'Percentages', marks: 1 }] }], null, 2);

export default function ManageAssessments() {
  const { profile } = useAuth();
  const cfg = useAcademic();
  const [list, setList] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  // paste form
  const [text, setText] = useState('');
  const [meta, setMeta] = useState({ title: '', category: '', company: '', topic: '', duration: 30, marks: 1, maxAttempts: 0, publish: true });
  const [fixed, setFixed] = useState<Record<number, number>>({});
  const parsed = useMemo(() => (text.trim() ? parseMcqText(text) : null), [text]);

  const load = useCallback(async () => {
    try { const s = await getDocs(query(collection(db, 'assessments'), orderBy('title'))); setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Assessment, 'id'>) }))); }
    catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => void load(), [load]);
  const flash = (m: string) => { setOk(m); setTimeout(() => setOk(''), 4000); };

  const save = async (a: AssessmentInput) => {
    const ref = doc(collection(db, 'assessments'));
    const batch = writeBatch(db);
    // The public document never contains answers; they go to assessmentKeys (staff only).
    batch.set(ref, { title: a.title, category: a.category, company: a.company, description: a.description, durationMinutes: a.durationMinutes, maxAttempts: a.maxAttempts, status: a.status, questions: a.questions, createdBy: profile?.uid, createdAt: serverTimestamp() });
    batch.set(doc(db, 'assessmentKeys', ref.id), { answers: a.answers, explanations: a.explanations });
    await batch.commit();
  };

  const createFromPaste = async () => {
    if (!parsed) return;
    setErr(''); setOk('');
    const qs = parsed.questions.map((q, i) => ({ text: q.text, options: q.options, answerIndex: fixed[i] ?? q.answerIndex, explanation: q.explanation, topic: q.topic || meta.topic || 'General', marks: meta.marks }));
    const v = validateAssessment({ title: meta.title, category: meta.category || cfg.categories[0]?.id, company: meta.company, durationMinutes: meta.duration, maxAttempts: meta.maxAttempts, status: meta.publish ? 'published' : 'draft', questions: qs });
    if (!v.ok) return setErr(`Please fix:\n- ${v.errors.join('\n- ')}`);
    setBusy(true);
    try { await save(v.value); setText(''); setFixed({}); setMeta({ ...meta, title: '' }); clearQueryCache(); await load(); flash(meta.publish ? `Test "${v.value.title}" published with ${v.value.questions.length} questions. Students can see it now.` : 'Test saved as a draft.'); }
    catch (e) { setErr(friendlyError(e)); } finally { setBusy(false); }
  };

  const importJson = async (json: unknown): Promise<string> => {
    const items = Array.isArray(json) ? json : [json];
    const res = items.map((it, i) => ({ i, v: validateAssessment(it) }));
    const problems = res.filter((p) => !p.v.ok).map((p) => `Assessment ${p.i + 1}: ${(p.v as { errors: string[] }).errors.join('; ')}`);
    if (problems.length) throw new Error(problems.join('\n'));
    for (const p of res) if (p.v.ok) await save(p.v.value);
    clearQueryCache(); await load();
    return `Imported ${res.length} assessment(s).`;
  };

  const toggle = async (a: Assessment) => { try { await updateDoc(doc(db, 'assessments', a.id), { status: a.status === 'published' ? 'draft' : 'published' }); clearQueryCache(); await load(); } catch (e) { setErr(friendlyError(e)); } };
  const remove = async (a: Assessment) => {
    if (!window.confirm(`Delete test "${a.title}"? Students' past results stay, but nobody can take it again.`)) return;
    try { const b = writeBatch(db); b.delete(doc(db, 'assessments', a.id)); b.delete(doc(db, 'assessmentKeys', a.id)); await b.commit(); clearQueryCache(); setList((l) => l.filter((x) => x.id !== a.id)); flash('Test deleted.'); } catch (e) { setErr(friendlyError(e)); }
  };
  const copyPrompt = async () => { try { await navigator.clipboard.writeText(AI_MCQ_PROMPT(meta.topic || 'Quantitative aptitude - percentages', 10)); flash('Prompt copied. Paste it into ChatGPT or Claude, then paste the answer below.'); } catch { setErr('Could not copy. Select and copy manually.'); } };
  const good = parsed ? parsed.questions.filter((q, i) => q.options.length >= 2 && (fixed[i] ?? q.answerIndex) !== null).length : 0;

  return (
    <>
      <PageHeader title="Tests & assessments" subtitle="Paste questions from ChatGPT, Claude, Word or a PDF and publish a test in one step." />
      {err && <p role="alert" className="mb-3 whitespace-pre-line rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}

      <section className="card mb-4 space-y-3" aria-label="Paste questions">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="h-section flex items-center gap-2"><ClipboardPaste className="h-4 w-4 text-brand-ink" /> Create a test by pasting questions</h2><button type="button" className="btn-outline !min-h-[40px]" onClick={() => void copyPrompt()}><Copy className="h-4 w-4" /> Copy AI prompt</button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className="input" placeholder="Test title *" aria-label="Test title" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          <select className="input" aria-label="Category" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>{cfg.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
          <input className="input" placeholder={meta.category === 'company' ? 'Company name (TCS, Infosys...)' : 'Company (optional)'} aria-label="Company" value={meta.company} onChange={(e) => setMeta({ ...meta, company: e.target.value })} />
          <input className="input" placeholder="Default topic (e.g. Percentages)" aria-label="Topic" value={meta.topic} onChange={(e) => setMeta({ ...meta, topic: e.target.value })} />
          <label className="text-sm">Time (minutes)<input type="number" min={1} max={240} className="input mt-1" value={meta.duration} onChange={(e) => setMeta({ ...meta, duration: Number(e.target.value) })} /></label>
          <label className="text-sm">Marks per question<input type="number" min={1} max={10} className="input mt-1" value={meta.marks} onChange={(e) => setMeta({ ...meta, marks: Number(e.target.value) })} /></label>
        </div>
        <textarea className="input min-h-[200px] py-2 font-mono text-xs" aria-label="Pasted questions" placeholder={'Paste here, e.g.\n\n1. What is 20% of 250?\nA) 40\nB) 50\nC) 60\nD) 25\nAnswer: B\nExplanation: 250 x 20 / 100 = 50'} value={text} onChange={(e) => { setText(e.target.value); setFixed({}); }} />
        {parsed && (
          <div className="rounded-xl border border-line">
            <p className="border-b border-line bg-subtle px-3 py-2 text-sm font-medium">Preview: {parsed.questions.length} question(s) found, {good} ready{parsed.questions.length - good > 0 ? `, ${parsed.questions.length - good} need attention` : ''}</p>
            <ol className="max-h-80 divide-y divide-line overflow-y-auto">
              {parsed.questions.map((q, i) => {
                const ans = fixed[i] ?? q.answerIndex;
                return (
                  <li key={i} className="p-3 text-sm">
                    <p className="whitespace-pre-line font-medium">{i + 1}. {q.text}</p>
                    <ul className="mt-1 space-y-0.5 text-xs">{q.options.map((o, oi) => <li key={oi} className={ans === oi ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted'}>{String.fromCharCode(65 + oi)}. {o}{ans === oi ? '  ✓' : ''}</li>)}</ul>
                    {q.options.length >= 2 && ans === null && <label className="mt-1 flex items-center gap-2 text-xs text-red-600">Correct answer: <select className="input !min-h-[36px] !w-auto" value="" onChange={(e) => setFixed({ ...fixed, [i]: Number(e.target.value) })}><option value="" disabled>Choose</option>{q.options.map((_, oi) => <option key={oi} value={oi}>{String.fromCharCode(65 + oi)}</option>)}</select></label>}
                    {q.options.length < 2 && <p className="mt-1 text-xs text-red-600">Needs at least 2 options.</p>}
                  </li>
                );
              })}
            </ol>
            {parsed.problems.length > 0 && <ul className="border-t border-line p-3 text-xs text-amber-700 dark:text-amber-400">{parsed.problems.map((p) => <li key={p}>{p}</li>)}</ul>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" checked={meta.publish} onChange={(e) => setMeta({ ...meta, publish: e.target.checked })} /> Publish immediately (students can take it now)</label>
          <button type="button" className="btn-primary ml-auto" disabled={busy || !parsed || good === 0 || good < (parsed?.questions.length ?? 0) || !meta.title.trim()} onClick={() => void createFromPaste()}>{busy ? 'Saving...' : meta.publish ? 'Create & publish test' : 'Save as draft'}</button>
        </div>
      </section>

      <ImportBox label="Advanced: import tests from JSON" template={TEMPLATE} onImport={importJson} />

      <div className="card !p-0">{loading ? <Spinner /> : list.length === 0 ? <EmptyState title="No tests yet" hint="Paste your first set of questions above." /> : <ul>{list.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 last:border-0">
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{a.title}</span><span className="block truncate text-xs text-muted">{categoryLabel(cfg, a.category)}{a.company ? ` · ${a.company}` : ''} · {a.questions.length} questions · {a.durationMinutes} min</span></span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${a.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>{a.status}</span>
          <button type="button" className="btn-outline !min-h-[40px] !px-3" onClick={() => void toggle(a)}>{a.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button type="button" aria-label={`Delete ${a.title}`} onClick={() => void remove(a)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-subtle"><Trash2 className="h-4 w-4" /></button>
        </li>))}</ul>}</div>
    </>
  );
}
