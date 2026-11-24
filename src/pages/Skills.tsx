import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { friendlyError } from '../lib/errors';
import { CURRICULUM, EMPTY_TOPIC, SKILL_LABEL, recommendTopic, skillLevel, topicSlug, type SkillLevel, type TopicStats } from '../shared/skills';
import { ErrorNote, PageHeader, Spinner } from '../components/ui';

const LEVEL_STYLE: Record<SkillLevel, string> = {
  not_started: 'bg-subtle text-muted', needs_improvement: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  beginner: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300', intermediate: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  strong: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
};

export default function Skills() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<Record<string, TopicStats> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (!profile) return;
    getDoc(doc(db, 'skills', profile.uid)).then((s) => setStats(((s.data()?.topics ?? {}) as Record<string, TopicStats>))).catch((e) => setErr(friendlyError(e)));
  }, [profile]);
  if (err) return <ErrorNote message={err} />;
  if (!stats) return <Spinner />;
  const rec = recommendTopic(stats, CURRICULUM.map(topicSlug));
  const recLabel = rec ? (CURRICULUM.find((t) => topicSlug(t) === rec) ?? rec.replace(/_/g, ' ')) : null;
  const rows = CURRICULUM.map((label) => { const s = { ...EMPTY_TOPIC, ...(stats[topicSlug(label)] ?? {}) }; return { label, s, level: skillLevel(s) }; });
  const extras = Object.keys(stats).filter((k) => !CURRICULUM.some((t) => topicSlug(t) === k));
  extras.forEach((k) => { const s = { ...EMPTY_TOPIC, ...stats[k] }; rows.push({ label: k.replace(/_/g, ' '), s, level: skillLevel(s) }); });

  return (
    <>
      <PageHeader title="Skill profile" subtitle="Levels come from your real submissions: difficulty of solved problems, solve rate and accuracy." />
      {recLabel && <div className="card mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-muted">Recommended next topic</p><p className="text-base font-semibold capitalize">{recLabel}</p></div><Link className="btn-primary" to={`/practice?topic=${encodeURIComponent(recLabel)}`}>Practise now</Link></div>}
      <div className="card !p-0"><ul>
        {rows.map((r) => (
          <li key={r.label} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <span className="min-w-[8rem] flex-1 text-sm font-medium capitalize">{r.label}</span>
            <span className="text-xs text-muted">{r.s.solved}/{r.s.attempted} solved · {r.s.accepted}/{r.s.submissions} accepted</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLE[r.level]}`}>{SKILL_LABEL[r.level]}</span>
          </li>
        ))}
      </ul></div>
    </>
  );
}
