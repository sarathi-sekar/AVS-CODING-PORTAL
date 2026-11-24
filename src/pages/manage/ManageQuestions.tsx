import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { Copy, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { friendlyError } from '../../lib/errors';
import { clearQueryCache } from '../../lib/useDocs';
import { validateQuestion } from '../../lib/validate';
import { AI_CODING_PROMPT } from '../../lib/mcqParser';
import { LANGUAGE_IDS, LANGUAGES } from '../../shared/languages';
import type { Example, Question, TestCase } from '../../types';
import { EmptyState, PageHeader, Spinner, SuccessNote } from '../../components/ui';
import { ImportBox } from './ImportBox';

const TEMPLATE = JSON.stringify([{ title: 'Add Two Numbers', difficulty: 'easy', topic: 'Basic Programming', description: 'Read two integers and print their sum.', inputFormat: 'Two integers a and b on one line.', outputFormat: 'Print a + b.', constraints: '-1000 <= a, b <= 1000', languages: ['c', 'cpp', 'java', 'python'], timeLimitMs: 2000, memoryLimitKb: 262144, examples: [{ input: '1 2', output: '3', explanation: '1 + 2 = 3' }], visibleTests: [{ input: '1 2', expected: '3' }, { input: '10 20', expected: '30' }], hiddenTests: [{ input: '-5 5', expected: '0' }, { input: '100 200', expected: '300' }], hints: ['Read both numbers before adding.'], status: 'draft' }], null, 2);

interface Form { title: string; difficulty: string; topic: string; description: string; inputFormat: string; outputFormat: string; constraints: string; languages: string[]; timeLimitMs: number; memoryLimitKb: number; examples: Example[]; visible: TestCase[]; hidden: TestCase[]; hints: string; editorial: string; status: string }
const blankCase = (): TestCase => ({ input: '', expected: '' });
const EMPTY: Form = { title: '', difficulty: 'easy', topic: '', description: '', inputFormat: '', outputFormat: '', constraints: '', languages: ['python'], timeLimitMs: 2000, memoryLimitKb: 262144, examples: [{ input: '', output: '', explanation: '' }], visible: [blankCase()], hidden: [blankCase()], hints: '', editorial: '', status: 'draft' };

function CaseEditor({ title, note, cases, onChange, max }: { title: string; note: string; cases: TestCase[]; onChange: (c: TestCase[]) => void; max: number }) {
  return (
    <fieldset className="rounded-xl border border-line p-3 sm:col-span-2">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      <p className="mb-2 text-xs text-muted">{note}</p>
      <div className="space-y-2">{cases.map((c, i) => (
        <div key={i} className="grid gap-2 rounded-lg bg-subtle p-2 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs">Input (what the program reads)<textarea className="input mt-1 min-h-[60px] py-2 font-mono text-xs" value={c.input} onChange={(e) => onChange(cases.map((x, k) => (k === i ? { ...x, input: e.target.value } : x)))} /></label>
          <label className="text-xs">Expected output<textarea className="input mt-1 min-h-[60px] py-2 font-mono text-xs" value={c.expected} onChange={(e) => onChange(cases.map((x, k) => (k === i ? { ...x, expected: e.target.value } : x)))} /></label>
          <button type="button" aria-label={`Remove test case ${i + 1}`} disabled={cases.length <= 1} onClick={() => onChange(cases.filter((_, k) => k !== i))} className="flex h-10 w-10 items-center justify-center self-end rounded-lg text-muted hover:text-red-600 disabled:opacity-30"><X className="h-4 w-4" /></button>
        </div>))}</div>
      <button type="button" className="btn-outline mt-2 !min-h-[40px]" disabled={cases.length >= max} onClick={() => onChange([...cases, blankCase()])}><Plus className="h-4 w-4" /> Add test case</button>
    </fieldset>
  );
}

export default function ManageQuestions() {
  const { profile } = useAuth();
  const [list, setList] = useState<(Question & { hiddenCount: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [editing, setEditing] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [diff, setDiff] = useState('');
  const flash = (m: string) => { setOk(m); setTimeout(() => setOk(''), 3500); };

  const load = useCallback(async () => {
    try { const s = await getDocs(query(collection(db, 'questions'), orderBy('title'))); setList(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Question, 'id'>) }))); }
    catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => void load(), [load]);

  const save = async (raw: unknown, id?: string) => {
    const v = validateQuestion(raw);
    if (!v.ok) throw new Error(`Please fix:\n- ${v.errors.join('\n- ')}`);
    const ref = id ? doc(db, 'questions', id) : doc(collection(db, 'questions'));
    const batch = writeBatch(db);
    batch.set(ref, { ...v.value.question, hiddenCount: v.value.hidden.length, createdBy: profile?.uid, updatedAt: serverTimestamp(), ...(id ? {} : { createdAt: serverTimestamp() }) });
    batch.set(doc(db, 'questionTests', ref.id), { hidden: v.value.hidden, updatedAt: serverTimestamp() });
    await batch.commit();
    clearQueryCache();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(''); setOk('');
    try {
      await save({ ...f, hints: f.hints.split('\n').map((h) => h.trim()).filter(Boolean), visibleTests: f.visible, hiddenTests: f.hidden, examples: f.examples.filter((x) => x.input || x.output) }, editing || undefined);
      flash(editing ? 'Question updated.' : f.status === 'published' ? 'Question published. Students can practise it now.' : 'Question saved as a draft.');
      setEditing(''); setOpen(false); setF(EMPTY); await load();
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Failed'); } finally { setBusy(false); }
  };
  const edit = async (x: Question) => {
    setErr(''); setOk('');
    try {
      const t = await getDoc(doc(db, 'questionTests', x.id));
      const hidden = (t.data()?.hidden ?? []) as TestCase[];
      setF({ title: x.title, difficulty: x.difficulty, topic: x.topic, description: x.description, inputFormat: x.inputFormat ?? '', outputFormat: x.outputFormat ?? '', constraints: x.constraints ?? '', languages: x.languages, timeLimitMs: x.timeLimitMs, memoryLimitKb: x.memoryLimitKb, examples: x.examples?.length ? x.examples : EMPTY.examples, visible: x.visibleTests?.length ? x.visibleTests : [blankCase()], hidden: hidden.length ? hidden : [blankCase()], hints: (x.hints ?? []).join('\n'), editorial: x.editorial ?? '', status: x.status });
      setEditing(x.id); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setErr(friendlyError(e)); }
  };
  const toggle = async (x: Question) => { try { await updateDoc(doc(db, 'questions', x.id), { status: x.status === 'published' ? 'draft' : 'published' }); clearQueryCache(); await load(); } catch (e) { setErr(friendlyError(e)); } };
  const remove = async (x: Question) => {
    if (!window.confirm(`Delete "${x.title}" and its hidden test cases? Students' past submissions stay in their history.`)) return;
    try { const b = writeBatch(db); b.delete(doc(db, 'questions', x.id)); b.delete(doc(db, 'questionTests', x.id)); await b.commit(); clearQueryCache(); setList((l) => l.filter((y) => y.id !== x.id)); flash('Question deleted.'); } catch (e) { setErr(friendlyError(e)); }
  };
  const importQ = async (json: unknown): Promise<string> => {
    const items = Array.isArray(json) ? json : [json];
    const problems: string[] = [];
    items.forEach((it, i) => { const v = validateQuestion(it); if (!v.ok) problems.push(`Question ${i + 1}: ${v.errors.join('; ')}`); });
    if (problems.length) throw new Error(problems.join('\n'));
    for (const it of items) await save(it);
    await load();
    return `Imported ${items.length} question(s). Remember to publish them.`;
  };
  const copyPrompt = async () => { try { await navigator.clipboard.writeText(AI_CODING_PROMPT(f.topic || 'Arrays', f.difficulty)); flash('Prompt copied. Paste it in ChatGPT/Claude, then paste the JSON it returns into "Import from JSON" below.'); } catch { setErr('Could not copy.'); } };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleLang = (l: string) => set('languages', f.languages.includes(l) ? f.languages.filter((x) => x !== l) : [...f.languages, l]);
  const shown = useMemo(() => list.filter((x) => (!diff || x.difficulty === diff) && (!q || x.title.toLowerCase().includes(q.toLowerCase()) || x.topic.toLowerCase().includes(q.toLowerCase()))), [list, q, diff]);

  return (
    <>
      <PageHeader title="Programming questions" subtitle="Add practice problems with visible and hidden test cases. Hidden tests are never shown to students."
        action={<button type="button" className="btn-primary" onClick={() => { setEditing(''); setF(EMPTY); setOpen((o) => !o); }}><Plus className="h-4 w-4" /> {open && !editing ? 'Close form' : 'New question'}</button>} />
      {err && <p role="alert" className="mb-3 whitespace-pre-line rounded-xl border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
      {ok && <div className="mb-3"><SuccessNote message={ok} /></div>}

      {open && (
        <form onSubmit={onSubmit} className="card mb-4 grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2"><h2 className="h-section">{editing ? 'Edit question' : 'New question'}</h2><button type="button" className="btn-outline !min-h-[40px]" onClick={() => void copyPrompt()}><Copy className="h-4 w-4" /> Copy AI prompt</button></div>
          <input className="input sm:col-span-2" required placeholder="Title" aria-label="Title" value={f.title} onChange={(e) => set('title', e.target.value)} />
          <select className="input" aria-label="Difficulty" value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
          <input className="input" required placeholder="Topic (Arrays, Loops, Recursion...)" aria-label="Topic" value={f.topic} onChange={(e) => set('topic', e.target.value)} />
          <textarea className="input min-h-[110px] py-2 sm:col-span-2" required placeholder="Problem description (markdown allowed)" aria-label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
          <input className="input" placeholder="Input format" aria-label="Input format" value={f.inputFormat} onChange={(e) => set('inputFormat', e.target.value)} />
          <input className="input" placeholder="Output format" aria-label="Output format" value={f.outputFormat} onChange={(e) => set('outputFormat', e.target.value)} />
          <input className="input sm:col-span-2" placeholder="Constraints" aria-label="Constraints" value={f.constraints} onChange={(e) => set('constraints', e.target.value)} />
          <fieldset className="sm:col-span-2"><legend className="label">Allowed languages</legend><div className="flex flex-wrap gap-2">{LANGUAGE_IDS.map((l) => <label key={l} className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${f.languages.includes(l) ? 'border-brand-ink bg-brand-soft' : 'border-line'}`}><input type="checkbox" checked={f.languages.includes(l)} onChange={() => toggleLang(l)} />{LANGUAGES[l].label}</label>)}</div></fieldset>
          <label className="text-sm">Time limit (ms)<input type="number" className="input mt-1" min={500} max={10000} value={f.timeLimitMs} onChange={(e) => set('timeLimitMs', Number(e.target.value))} /></label>
          <label className="text-sm">Memory limit (KB)<input type="number" className="input mt-1" min={32768} max={512000} value={f.memoryLimitKb} onChange={(e) => set('memoryLimitKb', Number(e.target.value))} /></label>

          <fieldset className="rounded-xl border border-line p-3 sm:col-span-2"><legend className="px-1 text-sm font-medium">Examples shown in the problem statement</legend>
            <div className="space-y-2">{f.examples.map((x, i) => (
              <div key={i} className="grid gap-2 rounded-lg bg-subtle p-2 sm:grid-cols-[1fr_1fr_1.2fr_auto]">
                <textarea className="input min-h-[50px] py-2 font-mono text-xs" aria-label={`Example ${i + 1} input`} placeholder="Input" value={x.input} onChange={(e) => set('examples', f.examples.map((y, k) => (k === i ? { ...y, input: e.target.value } : y)))} />
                <textarea className="input min-h-[50px] py-2 font-mono text-xs" aria-label={`Example ${i + 1} output`} placeholder="Output" value={x.output} onChange={(e) => set('examples', f.examples.map((y, k) => (k === i ? { ...y, output: e.target.value } : y)))} />
                <textarea className="input min-h-[50px] py-2 text-xs" aria-label={`Example ${i + 1} explanation`} placeholder="Explanation (optional)" value={x.explanation ?? ''} onChange={(e) => set('examples', f.examples.map((y, k) => (k === i ? { ...y, explanation: e.target.value } : y)))} />
                <button type="button" aria-label="Remove example" onClick={() => set('examples', f.examples.filter((_, k) => k !== i))} className="flex h-10 w-10 items-center justify-center self-end rounded-lg text-muted hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>))}</div>
            <button type="button" className="btn-outline mt-2 !min-h-[40px]" onClick={() => set('examples', [...f.examples, { input: '', output: '', explanation: '' }])}><Plus className="h-4 w-4" /> Add example</button>
          </fieldset>
          <CaseEditor title="Visible test cases" note="Students see these inputs and expected outputs when they press Run. Up to 10. For SQL, put the CREATE/INSERT setup in the input." cases={f.visible} onChange={(c) => set('visible', c)} max={10} />
          <CaseEditor title="Hidden test cases" note="Only the judge sees these. Students only see passed/failed. Add edge cases. (visible + hidden: max 30)" cases={f.hidden} onChange={(c) => set('hidden', c)} max={30} />
          <label className="text-sm sm:col-span-2">Hints (one per line, shown one at a time)<textarea className="input mt-1 min-h-[60px] py-2" value={f.hints} onChange={(e) => set('hints', e.target.value)} /></label>
          <label className="text-sm sm:col-span-2">Solution explanation (shown after the student solves it)<textarea className="input mt-1 min-h-[60px] py-2" value={f.editorial} onChange={(e) => set('editorial', e.target.value)} /></label>
          <select className="input" aria-label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}><option value="draft">Draft (hidden from students)</option><option value="published">Published</option></select>
          <div className="flex gap-2"><button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving...' : editing ? 'Update question' : 'Save question'}</button><button type="button" className="btn-outline" onClick={() => { setOpen(false); setEditing(''); setF(EMPTY); }}>Cancel</button></div>
        </form>
      )}

      <ImportBox label="Import questions from JSON (paste from ChatGPT / Claude)" template={TEMPLATE} onImport={importQ} />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input className="input pl-9" placeholder="Search questions" aria-label="Search questions" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input !w-auto" aria-label="Difficulty" value={diff} onChange={(e) => setDiff(e.target.value)}><option value="">All difficulties</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
      </div>
      <div className="card !p-0">{loading ? <Spinner /> : shown.length === 0 ? <EmptyState title={list.length === 0 ? 'No questions yet' : 'No questions match'} /> : <ul>{shown.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 last:border-0">
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{x.title}</span><span className="block truncate text-xs text-muted capitalize">{x.difficulty} · {x.topic} · {x.visibleTests?.length ?? 0} visible / {x.hiddenCount ?? 0} hidden tests</span></span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${x.status === 'published' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>{x.status}</span>
          <button type="button" className="btn-outline !min-h-[40px] !px-3" onClick={() => void toggle(x)}>{x.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button type="button" aria-label={`Edit ${x.title}`} onClick={() => void edit(x)} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-subtle"><Pencil className="h-4 w-4" /></button>
          <button type="button" aria-label={`Delete ${x.title}`} onClick={() => void remove(x)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-subtle"><Trash2 className="h-4 w-4" /></button>
        </li>))}</ul>}</div>
    </>
  );
}
