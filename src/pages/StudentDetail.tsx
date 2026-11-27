import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { Download } from 'lucide-react';
import { db } from '../lib/firebase';
import { friendlyError } from '../lib/errors';
import { downloadCsv, toCsv } from '../lib/csv';
import { SKILL_LABEL, skillLevel, EMPTY_TOPIC, type TopicStats } from '../shared/skills';
import { VERDICT_LABEL, type Verdict } from '../shared/verdict';
import { effectiveStreak, istDateKey } from '../shared/streak';
import type { SubmissionDoc, UserProfile } from '../types';
import { ErrorNote, PageHeader, Spinner } from '../components/ui';

interface Attempt { id: string; title: string; score?: number; totalMarks?: number; status: string }
export default function StudentDetail() {
  const { uid = '' } = useParams();
  const [u, setU] = useState<UserProfile | null>(null);
  const [streak, setStreak] = useState<Record<string, unknown> | null>(null);
  const [xp, setXp] = useState(0);
  const [skills, setSkills] = useState<Record<string, TopicStats>>({});
  const [subs, setSubs] = useState<SubmissionDoc[]>([]);
  const [atts, setAtts] = useState<Attempt[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const [us, st, ac, sk, sb, at] = await Promise.all([
          getDoc(doc(db, 'users', uid)), getDoc(doc(db, 'streaks', uid)), getDoc(doc(db, 'achievements', uid)), getDoc(doc(db, 'skills', uid)),
          getDocs(query(collection(db, 'submissions'), where('uid', '==', uid), limit(15))),
          getDocs(query(collection(db, 'assessmentAttempts'), where('uid', '==', uid), limit(50))),
        ]);
        if (!us.exists()) return setErr('Student not found.');
        setU({ ...(us.data() as Omit<UserProfile, 'uid'>), uid: us.id });
        setStreak(st.data() ?? null); setXp((ac.data()?.xp as number | undefined) ?? 0); setSkills((sk.data()?.topics ?? {}) as Record<string, TopicStats>);
        setSubs(sb.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubmissionDoc, 'id'>) }))); setAtts(at.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Attempt, 'id'>) })));
      } catch (e) { setErr(friendlyError(e)); } finally { setLoading(false); }
    })();
  }, [uid]);
  if (loading) return <Spinner />;
  if (err || !u) return <ErrorNote message={err || 'Not found'} />;
  const cur = streak ? effectiveStreak({ currentStreak: Number(streak.currentStreak ?? 0), longestStreak: 0, activeDays: 0, lastGoalDate: (streak.lastGoalDate as string | null) ?? null }, istDateKey(new Date())) : 0;
  const weak = Object.entries(skills).filter(([, s]) => skillLevel({ ...EMPTY_TOPIC, ...s }) === 'needs_improvement');
  const exportReport = () => downloadCsv(`${u.registerNumber}-report.csv`, toCsv(['Time', 'Problem', 'Language', 'Verdict', 'Passed', 'Total'], subs.map((s) => [s.createdAt?.toDate().toISOString() ?? '', s.questionTitle, s.language, s.verdict, s.passed, s.total])));
  const stat = (label: string, v: string | number) => <div className="card !p-3"><p className="text-xl font-semibold">{v}</p><p className="text-xs text-muted">{label}</p></div>;
  return (
    <>
      <PageHeader title={u.displayName} subtitle={`${u.registerNumber} · ${u.department} · ${u.academicYear} · Section ${u.section}`} action={<div className="flex gap-2"><button type="button" className="btn-outline" onClick={exportReport}><Download className="h-4 w-4" /> Submissions CSV</button><Link to="/students" className="btn-outline">Back</Link></div>} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{stat('Current streak', cur)}{stat('Longest streak', Number(streak?.longestStreak ?? 0))}{stat('Problems solved', Number(streak?.totalSolved ?? 0))}{stat('XP', xp)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card min-w-0"><h2 className="h-section mb-2">Weak topics</h2>{weak.length === 0 ? <p className="text-sm text-muted">None flagged (needs at least 3 attempted problems with a low solve rate).</p> : <ul className="space-y-1 text-sm">{weak.map(([t, s]) => <li key={t} className="flex justify-between capitalize"><span>{t.replace(/_/g, ' ')}</span><span className="text-muted">{s.solved}/{s.attempted} solved · {SKILL_LABEL.needs_improvement}</span></li>)}</ul>}</section>
        <section className="card min-w-0"><h2 className="h-section mb-2">Assessments</h2>{atts.length === 0 ? <p className="text-sm text-muted">No attempts yet.</p> : <ul className="space-y-1 text-sm">{atts.map((a) => <li key={a.id} className="flex justify-between gap-2"><span className="truncate">{a.title}</span><span className="text-muted">{a.status === 'in_progress' ? 'In progress' : `${a.score}/${a.totalMarks}`}</span></li>)}</ul>}</section>
        <section className="card min-w-0 lg:col-span-2"><h2 className="h-section mb-2">Recent submissions</h2>{subs.length === 0 ? <p className="text-sm text-muted">No submissions yet.</p> : <><ul className="divide-y divide-line md:hidden">{subs.map((s) => <li key={s.id} className="py-2 text-sm"><p className="font-medium">{s.questionTitle}</p><p className="text-xs text-muted">{VERDICT_LABEL[s.verdict as Verdict] ?? s.verdict} · {s.passed}/{s.total} · {s.language}</p></li>)}</ul><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[520px] text-left text-sm"><thead className="text-xs uppercase text-muted"><tr><th className="py-2">Problem</th><th>Language</th><th>Verdict</th><th>Tests</th><th>When</th></tr></thead><tbody>{subs.map((s) => <tr key={s.id} className="border-t border-line"><td className="py-2">{s.questionTitle}</td><td>{s.language}</td><td>{VERDICT_LABEL[s.verdict as Verdict] ?? s.verdict}</td><td>{s.passed}/{s.total}</td><td className="text-xs text-muted">{s.createdAt?.toDate().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>)}</tbody></table></div></>}</section>
      </div>
    </>
  );
}
