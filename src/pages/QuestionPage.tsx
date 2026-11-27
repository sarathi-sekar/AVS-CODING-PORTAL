import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { Loader2, Play, RotateCcw, Send } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiConfigured, callApi, fetchEnabledLanguages, type HiddenResult, type RunCustomResponse, type RunVisibleResponse, type SubmitResponse, type TestStatus, type VisibleResult } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { LANGUAGES, type LanguageId } from '../shared/languages';
import { VERDICT_LABEL, type Verdict } from '../shared/verdict';
import type { Question, SubmissionDoc } from '../types';
import { Markdown } from '../components/Markdown';
import { BookmarkButton, NotesBox } from '../components/SaveButtons';
import { ErrorNote, Spinner } from '../components/ui';

const STATUS_LABEL: Record<TestStatus, string> = { passed: 'Passed', wrong_answer: 'Wrong answer', runtime_error: 'Runtime error', time_limit: 'Time limit exceeded', memory_limit: 'Memory limit exceeded', compile_error: 'Compilation error', internal_error: 'Judge error' };
const okClass = 'text-emerald-700 dark:text-emerald-400';
const badClass = 'text-red-700 dark:text-red-400';
type Result =
  | { type: 'custom'; data: RunCustomResponse }
  | { type: 'run'; data: RunVisibleResponse }
  | { type: 'submit'; data: SubmitResponse };

function TestList({ tests, label }: { tests: VisibleResult[]; label: string }) {
  return (
    <ul className="space-y-2">
      {tests.map((t) => (
        <li key={t.index} className="rounded-xl border border-line">
          <details>
            <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 px-3 text-sm">
              <span>{label} {t.index}</span><span className={t.status === 'passed' ? okClass : badClass}>{STATUS_LABEL[t.status]}</span>
            </summary>
            <div className="space-y-2 border-t border-line p-3 text-xs">
              <div><p className="mb-1 font-medium text-muted">Input</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle p-2">{t.input}</pre></div>
              <div><p className="mb-1 font-medium text-muted">Expected output</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle p-2">{t.expected}</pre></div>
              <div><p className="mb-1 font-medium text-muted">Your output</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle p-2">{t.actual || '(empty)'}</pre></div>
              {t.stderr && <div><p className="mb-1 font-medium text-muted">Error output</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle p-2">{t.stderr}</pre></div>}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

function HiddenList({ tests }: { tests: HiddenResult[] }) {
  if (tests.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-2 text-sm font-medium">Hidden test cases</p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {tests.map((t) => <li key={t.index} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm"><span>Hidden {t.index}</span><span className={t.status === 'passed' ? okClass : badClass}>{STATUS_LABEL[t.status]}</span></li>)}
      </ul>
    </div>
  );
}

export default function QuestionPage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const { theme } = useTheme();
  const uid = profile?.uid ?? '';
  const [q, setQ] = useState<Question | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [enabled, setEnabled] = useState<LanguageId[] | null>(null);
  const [lang, setLang] = useState<LanguageId | null>(null);
  const [code, setCode] = useState('');
  const [stdin, setStdin] = useState('');
  const [tab, setTab] = useState<'problem' | 'code' | 'results'>('problem');
  const [leftTab, setLeftTab] = useState<'problem' | 'history'>('problem');
  const [busy, setBusy] = useState<'' | 'run' | 'custom' | 'submit'>('');
  const [result, setResult] = useState<Result | null>(null);
  const [apiErr, setApiErr] = useState('');
  const [history, setHistory] = useState<SubmissionDoc[]>([]);
  const [hintsShown, setHintsShown] = useState(0);
  const [leftPct, setLeftPct] = useState(() => Number(localStorage.getItem('avs-split') ?? 42));
  const dragging = useRef(false);

  useEffect(() => {
    getDoc(doc(db, 'questions', id)).then((s) => {
      if (!s.exists()) return setLoadErr('Problem not found.');
      setQ({ id: s.id, ...(s.data() as Omit<Question, 'id'>) });
    }).catch((e) => setLoadErr(friendlyError(e)));
    fetchEnabledLanguages().then(setEnabled);
    if (apiConfigured) callApi('/practice/start', { questionId: id }).catch(() => undefined);
  }, [id]);

  const usable = q && enabled ? q.languages.filter((l) => enabled.includes(l)) : [];
  useEffect(() => { if (usable.length && (!lang || !usable.includes(lang))) setLang(usable[0]); }, [usable.join(','), lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const draftKey = `avs-draft:${uid}:${id}:${lang}`;
  useEffect(() => {
    if (!q || !lang) return;
    setCode(localStorage.getItem(draftKey) ?? q.starter?.[lang] ?? LANGUAGES[lang].starter);
  }, [q, lang, draftKey]);
  useEffect(() => {
    if (!lang || !q) return;
    const t = setTimeout(() => { try { localStorage.setItem(draftKey, code); } catch { /* storage full */ } }, 500);
    return () => clearTimeout(t);
  }, [code, draftKey, lang, q]);

  const loadHistory = useCallback(async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(query(collection(db, 'submissions'), where('uid', '==', uid), where('questionId', '==', id), limit(20)));
      setHistory(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubmissionDoc, 'id'>) })));
    } catch { /* history is optional */ }
  }, [uid, id]);
  useEffect(() => void loadHistory(), [loadHistory]);

  const act = async (kind: 'run' | 'custom' | 'submit') => {
    if (!lang || busy) return;
    setBusy(kind); setApiErr(''); setTab('results');
    try {
      if (kind === 'submit') {
        const d = await callApi<SubmitResponse>('/submit', { questionId: id, language: lang, code });
        setResult({ type: 'submit', data: d }); void loadHistory();
      } else if (kind === 'custom') {
        setResult({ type: 'custom', data: await callApi<RunCustomResponse>('/run', { questionId: id, language: lang, code, stdin }) });
      } else {
        setResult({ type: 'run', data: await callApi<RunVisibleResponse>('/run', { questionId: id, language: lang, code }) });
      }
    } catch (e) { setApiErr(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(''); }
  };

  const onDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pct = Math.min(65, Math.max(28, (e.clientX / window.innerWidth) * 100));
    setLeftPct(pct); localStorage.setItem('avs-split', String(Math.round(pct)));
  };

  if (loadErr) return <ErrorNote message={loadErr} />;
  if (!q || enabled === null) return <Spinner />;
  const noLang = usable.length === 0;
  const tabBtn = (t: typeof tab, label: string) => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-[44px] flex-1 text-sm font-medium ${tab === t ? 'border-b-2 border-brand-ink text-brand-ink' : 'text-muted'}`}>{label}</button>;
  const verdictClass = (v: string) => (v === 'accepted' ? okClass : v === 'partial' ? 'text-amber-700 dark:text-amber-400' : badClass);

  return (
    <div className="-mx-3 sm:mx-0" onPointerMove={onDrag} onPointerUp={() => (dragging.current = false)}>
      <div role="tablist" className="sticky top-14 z-20 flex border-b border-line bg-surface lg:hidden">{tabBtn('problem', 'Problem')}{tabBtn('code', 'Code')}{tabBtn('results', 'Results')}</div>
      <div className="lg:flex lg:h-[calc(100vh-4rem)] lg:gap-0" style={{ ['--lw' as string]: `${leftPct}%` }}>
        {/* LEFT: problem */}
        <section className={`${tab === 'problem' ? 'block' : 'hidden'} min-w-0 px-3 py-4 sm:px-0 lg:block lg:w-[var(--lw)] lg:shrink-0 lg:overflow-y-auto lg:pr-4`}>
          <div className="mb-3 flex items-center gap-3">
            <h1 className="min-w-0 flex-1 text-lg font-semibold sm:text-xl">{q.title}</h1>
            <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium capitalize">{q.difficulty}</span>
            <BookmarkButton kind="question" refId={q.id} title={q.title} />
          </div>
          <div className="mb-3 flex gap-2 text-sm" role="tablist">
            {(['problem', 'history'] as const).map((t) => <button key={t} role="tab" aria-selected={leftTab === t} type="button" onClick={() => setLeftTab(t)} className={`min-h-[40px] rounded-lg px-3 ${leftTab === t ? 'bg-brand-soft font-medium text-brand-ink' : 'text-muted'}`}>{t === 'problem' ? 'Description' : `Submissions (${history.length})`}</button>)}
          </div>
          {leftTab === 'problem' ? (
            <div>
              <p className="mb-2 text-xs text-muted">Topic: {q.topic} · Time limit {q.timeLimitMs / 1000}s · Memory {Math.round(q.memoryLimitKb / 1024)} MB</p>
              <Markdown source={q.description} />
              {q.inputFormat && <><h3 className="mb-1 mt-4 text-sm font-semibold">Input format</h3><Markdown source={q.inputFormat} /></>}
              {q.outputFormat && <><h3 className="mb-1 mt-4 text-sm font-semibold">Output format</h3><Markdown source={q.outputFormat} /></>}
              {q.constraints && <><h3 className="mb-1 mt-4 text-sm font-semibold">Constraints</h3><Markdown source={q.constraints} /></>}
              {q.examples?.map((e, i) => (
                <div key={i} className="mt-4 rounded-xl border border-line p-3 text-xs">
                  <p className="mb-1 font-semibold">Example {i + 1}</p>
                  <p className="text-muted">Input</p><pre className="mb-2 whitespace-pre-wrap break-words rounded-lg bg-subtle p-2">{e.input}</pre>
                  <p className="text-muted">Output</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle p-2">{e.output}</pre>
                  {e.explanation && <p className="mt-2 text-sm">{e.explanation}</p>}
                </div>
              ))}
              {q.hints?.length > 0 && (
                <div className="mt-4">
                  {q.hints.slice(0, hintsShown).map((h, i) => <p key={i} className="mb-2 rounded-xl bg-brand-soft p-3 text-sm">Hint {i + 1}: {h}</p>)}
                  {hintsShown < q.hints.length && <button type="button" className="btn-outline !min-h-[40px]" onClick={() => setHintsShown((n) => n + 1)}>Show hint {hintsShown + 1} of {q.hints.length}</button>}
                </div>
              )}
              <NotesBox questionId={q.id} title={q.title} />
              {q.editorial && history.some((h) => h.verdict === 'accepted') && <div className="mt-4 border-t border-line pt-3"><h3 className="mb-1 text-sm font-semibold">Solution explanation</h3><Markdown source={q.editorial} /></div>}
            </div>
          ) : history.length === 0 ? <p className="text-sm text-muted">No submissions yet.</p> : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex items-center justify-between gap-2"><span className={`font-medium ${verdictClass(h.verdict)}`}>{VERDICT_LABEL[h.verdict as Verdict] ?? h.verdict}</span><span className="text-xs text-muted">{h.passed}/{h.total} · {LANGUAGES[h.language]?.label}</span></div>
                  <p className="text-xs text-muted">{h.createdAt?.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {h.timeMs} ms</p>
                  <button type="button" className="mt-1 text-xs font-medium text-brand-ink" onClick={() => { setLang(h.language); setCode(h.code); setTab('code'); }}>Load this code</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center lg:flex" onPointerDown={(e) => { dragging.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); }} role="separator" aria-orientation="vertical" aria-label="Resize panels"><span className="h-10 w-0.5 rounded bg-line" /></div>

        {/* RIGHT: editor + results */}
        <section className={`${tab === 'problem' ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col lg:flex lg:pl-2`}>
          <div className={`${tab === 'results' ? 'hidden' : 'flex'} flex-col lg:flex lg:min-h-0 lg:flex-[3]`}>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-0">
              <label className="sr-only" htmlFor="lang">Language</label>
              <select id="lang" className="input !min-h-[40px] !w-auto" value={lang ?? ''} onChange={(e) => setLang(e.target.value as LanguageId)} disabled={noLang}>
                {usable.map((l) => <option key={l} value={l}>{LANGUAGES[l].label}</option>)}
              </select>
              <button type="button" className="btn-outline !min-h-[40px]" disabled={!lang} onClick={() => { if (lang && window.confirm('Reset to the starter code? Your current code will be lost.')) { localStorage.removeItem(draftKey); setCode(q.starter?.[lang] ?? LANGUAGES[lang].starter); } }}><RotateCcw className="h-4 w-4" /> Reset</button>
              <div className="ml-auto hidden gap-2 lg:flex">
                <button type="button" className="btn-outline !min-h-[40px]" disabled={noLang || Boolean(busy)} onClick={() => void act('run')}>{busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run</button>
                <button type="button" className="btn-primary !min-h-[40px]" disabled={noLang || Boolean(busy)} onClick={() => void act('submit')}>{busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit</button>
              </div>
            </div>
            {noLang ? (
              <div className="m-3 rounded-xl border border-line p-4 text-sm text-muted sm:m-0">
                {!apiConfigured ? 'The code judge is not connected yet.' : 'No language is enabled for this problem yet. A language is only enabled after the admin verifies it on the judge server.'}
              </div>
            ) : (
              <div className="h-[55vh] min-h-[260px] border-y border-line lg:h-auto lg:min-h-0 lg:flex-1">
                <Editor height="100%" language={lang ? LANGUAGES[lang].monaco : 'plaintext'} value={code} onChange={(v) => setCode(v ?? '')} theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  loading={<Spinner label="Loading editor" />}
                  options={{ minimap: { enabled: false }, fontSize: 14, tabSize: 4, automaticLayout: true, wordWrap: 'on', scrollBeyondLastLine: false, bracketPairColorization: { enabled: true }, matchBrackets: 'always', autoIndent: 'full', lineNumbers: 'on', padding: { top: 8 }, accessibilitySupport: 'auto' }} />
              </div>
            )}
            <details className="px-3 py-2 sm:px-0"><summary className="min-h-[40px] cursor-pointer text-sm font-medium">Custom input</summary>
              <textarea className="input mt-2 min-h-[80px] py-2 font-mono text-xs" aria-label="Custom input" value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="Type input for your program" />
              <button type="button" className="btn-outline mt-2 !min-h-[40px]" disabled={noLang || Boolean(busy)} onClick={() => void act('custom')}>Run with this input</button>
              {lang === 'sql' && <p className="mt-1 text-xs text-muted">SQL problems run your query against the problem's own tables; custom input is ignored.</p>}
            </details>
          </div>

          <div className={`${tab === 'code' ? 'hidden' : 'block'} min-h-[200px] px-3 py-3 sm:px-0 lg:block lg:flex-[2] lg:overflow-y-auto`} aria-live="polite">
            <h2 className="mb-2 text-sm font-semibold">Results</h2>
            {busy && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> {busy === 'submit' ? 'Running all test cases...' : 'Running...'}</p>}
            {apiErr && <ErrorNote message={apiErr} />}
            {!busy && !apiErr && !result && <p className="text-sm text-muted">Run checks the visible examples. Submit judges every test, including hidden ones.</p>}
            {!busy && result?.type === 'custom' && (
              <div className="text-sm">
                <p className={result.data.status === 'passed' ? okClass : badClass}>{result.data.status === 'passed' ? 'Ran successfully' : STATUS_LABEL[result.data.status]} · {result.data.timeMs} ms · {Math.round(result.data.memoryKb / 1024)} MB</p>
                {result.data.compileOutput && <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-subtle p-2 text-xs">{result.data.compileOutput}</pre>}
                <p className="mt-2 text-xs text-muted">Output</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle p-2 text-xs">{result.data.stdout || '(empty)'}</pre>
                {result.data.stderr && <><p className="mt-2 text-xs text-muted">Error output</p><pre className="whitespace-pre-wrap break-words rounded-lg bg-subtle p-2 text-xs">{result.data.stderr}</pre></>}
              </div>
            )}
            {!busy && result?.type === 'run' && (
              <div>
                <p className={`mb-2 text-sm font-semibold ${verdictClass(result.data.verdict)}`}>{VERDICT_LABEL[result.data.verdict as Verdict]} · {result.data.passed}/{result.data.total} visible tests passed</p>
                {result.data.compileOutput && <pre className="mb-2 whitespace-pre-wrap break-words rounded-lg bg-subtle p-2 text-xs">{result.data.compileOutput}</pre>}
                <TestList tests={result.data.tests} label="Test case" />
                <p className="mt-3 text-xs text-muted">Run does not count as solved. Use Submit to be judged on all tests.</p>
              </div>
            )}
            {!busy && result?.type === 'submit' && (
              <div>
                <p className={`text-base font-semibold ${verdictClass(result.data.verdict)}`}>{VERDICT_LABEL[result.data.verdict as Verdict]}</p>
                <p className="mb-2 text-sm text-muted">{result.data.passed}/{result.data.total} passed · {result.data.timeMs} ms · {Math.round(result.data.memoryKb / 1024)} MB</p>
                {result.data.firstSolve && <p className="mb-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Solved! +{result.data.xp} XP{result.data.newBadges.length > 0 ? ` · New badge: ${result.data.newBadges.join(', ')}` : ''}</p>}
                {result.data.compileOutput && <pre className="mb-2 whitespace-pre-wrap break-words rounded-lg bg-subtle p-2 text-xs">{result.data.compileOutput}</pre>}
                {result.data.visible.length > 0 && <><p className="mb-2 text-sm font-medium">Visible test cases</p><TestList tests={result.data.visible} label="Test case" /></>}
                <HiddenList tests={result.data.hidden} />
              </div>
            )}
          </div>

          {/* Mobile action bar: Run / Submit always reachable */}
          <div className="sticky bottom-0 z-20 flex gap-2 border-t border-line bg-surface p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
            <button type="button" className="btn-outline flex-1" disabled={noLang || Boolean(busy)} onClick={() => void act('run')}>{busy === 'run' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run</button>
            <button type="button" className="btn-primary flex-1" disabled={noLang || Boolean(busy)} onClick={() => void act('submit')}>{busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit</button>
          </div>
        </section>
      </div>
    </div>
  );
}
