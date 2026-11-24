import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Flame, Trophy, Megaphone, Target, CalendarCheck, CheckCircle2, Code2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { currentYearIST, greeting, istDateKey } from '../lib/date';
import { friendlyError } from '../lib/errors';
import { addDays, effectiveStreak, DAILY_GOAL_MINUTES } from '../shared/streak';
import { VERDICT_LABEL, type Verdict } from '../shared/verdict';
import { CURRICULUM, recommendTopic, topicSlug, type TopicStats } from '../shared/skills';
import type { Announcement, DailyActivity, LeaderboardEntry, StreakDoc, SubmissionDoc } from '../types';
import { Heatmap } from '../components/Heatmap';
import { ChallengeCards } from '../components/ChallengeCards';
import { MyLearning } from '../components/MyLearning';
import { Podium } from '../components/Podium';
import { Avatar, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

const GOAL = DAILY_GOAL_MINUTES;

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="card flex items-center gap-3 !p-3 sm:!p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">{icon}</span>
      <div className="min-w-0">
        <p className="text-xl font-semibold leading-tight sm:text-2xl">{value}</p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const [year, setYear] = useState(currentYearIST());
  const [streak, setStreak] = useState<(StreakDoc & { lastGoalDate?: string | null }) | null>(null);
  const [recent, setRecent] = useState<Record<string, DailyActivity>>({});
  const [subs, setSubs] = useState<SubmissionDoc[]>([]);
  const [skills, setSkills] = useState<Record<string, TopicStats>>({});
  const [activity, setActivity] = useState<Record<string, DailyActivity>>({});
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [news, setNews] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [actLoading, setActLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const thisYear = currentYearIST();
        const [s, lb, an, rc, sb, sk] = await Promise.all([
          getDoc(doc(db, 'streaks', uid)),
          getDocs(query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(10))),
          getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(3))),
          getDocs(query(collection(db, 'dailyActivity'), where('uid', '==', uid), where('year', 'in', [thisYear, thisYear - 1]))),
          getDocs(query(collection(db, 'submissions'), where('uid', '==', uid), limit(5))), // ids are newest-first
          getDoc(doc(db, 'skills', uid)),
        ]);
        if (cancelled) return;
        setStreak(s.exists() ? (s.data() as StreakDoc & { lastGoalDate?: string | null }) : null);
        const rm: Record<string, DailyActivity> = {};
        rc.docs.forEach((d) => { const a = d.data() as DailyActivity; rm[a.date] = a; });
        setRecent(rm);
        setSubs(sb.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SubmissionDoc, 'id'>) })));
        setSkills((sk.data()?.topics ?? {}) as Record<string, TopicStats>);
        setBoard(lb.docs.map((d) => ({ ...(d.data() as Omit<LeaderboardEntry, 'uid'>), uid: d.id })));
        setNews(an.docs.map((d) => ({ ...(d.data() as Omit<Announcement, 'id'>), id: d.id })));
      } catch (e) {
        if (!cancelled) setError(friendlyError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setActLoading(true);
    getDocs(query(collection(db, 'dailyActivity'), where('uid', '==', uid), where('year', '==', year)))
      .then((snap) => {
        if (cancelled) return;
        const map: Record<string, DailyActivity> = {};
        snap.docs.forEach((d) => {
          const a = d.data() as DailyActivity;
          map[a.date] = a;
        });
        setActivity(map);
      })
      .catch((e) => !cancelled && setError(friendlyError(e)))
      .finally(() => !cancelled && setActLoading(false));
    return () => {
      cancelled = true;
    };
  }, [uid, year]);

  if (!profile) return null;
  const today = istDateKey();
  const todayMinutes = recent[today]?.minutes ?? 0;
  const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, -i));
  const week = days(7).map((d) => recent[d]);
  const monthKey = today.slice(0, 7);
  const monthDays = Object.values(recent).filter((a) => a.date.startsWith(monthKey));
  const weekActive = week.filter((a) => (a?.minutes ?? 0) >= GOAL).length;
  const monthActive = monthDays.filter((a) => a.minutes >= GOAL).length;
  const currentStreak = streak ? effectiveStreak({ currentStreak: streak.currentStreak, longestStreak: streak.longestStreak, activeDays: streak.activeDays, lastGoalDate: streak.lastGoalDate ?? null }, today) : 0;
  const rec = recommendTopic(skills, CURRICULUM.map(topicSlug));
  const recLabel = rec ? (CURRICULUM.find((t) => topicSlug(t) === rec) ?? rec.replace(/_/g, ' ')) : null;
  const rank = board.findIndex((b) => b.uid === uid) + 1;
  const goalPct = Math.min(100, Math.round((todayMinutes / GOAL) * 100));
  const firstName = profile.displayName.split(' ')[0];

  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName}`} subtitle={`${profile.department} · ${profile.academicYear} · Section ${profile.section}`} />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            <MyLearning solved={streak?.totalSolved ?? 0} />

            <section className="card" aria-labelledby="goal">
              <div className="flex items-center justify-between gap-3">
                <h2 id="goal" className="h-section flex items-center gap-2"><Target className="h-4 w-4 text-brand-ink" /> Today&apos;s learning goal</h2>
                <span className="text-sm text-muted">{todayMinutes} / {GOAL} min</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuenow={goalPct} aria-valuemin={0} aria-valuemax={100} aria-label="Daily goal progress">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${goalPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {todayMinutes >= GOAL ? 'Daily goal completed. Great work!' : 'Only lessons, solved problems and assessments count towards your goal (Asia/Kolkata time).'}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<Flame className="h-5 w-5" />} label="Current streak" value={currentStreak} />
              <Stat icon={<Trophy className="h-5 w-5" />} label="Longest streak" value={streak?.longestStreak ?? 0} />
              <Stat icon={<CheckCircle2 className="h-5 w-5" />} label="Problems solved" value={streak?.totalSolved ?? 0} />
              <Stat icon={<CalendarCheck className="h-5 w-5" />} label="Active days" value={streak?.activeDays ?? 0} />
            </div>

            <ChallengeCards />

            {recLabel && <section className="card flex flex-wrap items-center justify-between gap-3 !p-4" aria-label="Recommended topic"><div><p className="text-xs text-muted">Recommended next topic</p><p className="text-base font-semibold capitalize">{recLabel}</p></div><Link className="btn-outline" to={`/practice?topic=${encodeURIComponent(recLabel)}`}>Practise</Link></section>}

            <section className="grid gap-3 sm:grid-cols-2" aria-label="Progress summary">
              <div className="card !p-4"><p className="text-xs text-muted">This week (last 7 days)</p><p className="text-lg font-semibold">{weekActive}/7 goal days</p><p className="text-xs text-muted">{week.reduce((n, a) => n + (a?.minutes ?? 0), 0)} min · {week.reduce((n, a) => n + (a?.solved ?? 0), 0)} solved</p></div>
              <div className="card !p-4"><p className="text-xs text-muted">This month</p><p className="text-lg font-semibold">{monthActive} goal day{monthActive === 1 ? '' : 's'}</p><p className="text-xs text-muted">{monthDays.reduce((n, a) => n + a.minutes, 0)} min · {monthDays.reduce((n, a) => n + a.solved, 0)} solved</p></div>
            </section>

            <section className="card" aria-labelledby="heat">
              <h2 id="heat" className="h-section">Practice activity</h2>
              <p className="mb-2 text-xs text-muted">Colour shows how many problems you solved each day.</p>
              <Heatmap year={year} onYearChange={setYear} activity={activity} loading={actLoading} />
              <details className="mt-3 text-sm"><summary className="min-h-[36px] cursor-pointer font-medium text-brand-ink">How is my streak counted?</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted"><li>A day counts when you complete {GOAL} minutes of real activity: finished lessons, accepted or partly-correct submissions, and tests.</li><li>Consecutive goal days build your streak; missing a day resets the current streak.</li><li>Your longest streak is kept. Days use Asia/Kolkata time and are recorded by the server, so changing your phone clock does nothing.</li></ul></details>
            </section>

            <section className="card" aria-labelledby="recent">
              <h2 id="recent" className="h-section flex items-center gap-2"><Code2 className="h-4 w-4 text-brand-ink" /> Recent submissions</h2>
              {subs.length === 0 ? <EmptyState title="No submissions yet" hint="Solve a problem in Practice and it shows up here." /> : (
                <ul className="mt-2">{subs.map((x) => <li key={x.id} className="flex items-center justify-between gap-2 border-b border-line py-2 text-sm last:border-0"><Link className="min-w-0 truncate hover:underline" to={`/practice/${x.questionId}`}>{x.questionTitle}</Link><span className={`shrink-0 text-xs font-medium ${x.verdict === 'accepted' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted'}`}>{VERDICT_LABEL[x.verdict as Verdict] ?? x.verdict} · {x.passed}/{x.total}</span></li>)}</ul>
              )}
            </section>

            
          </div>

          <div className="min-w-0 space-y-4">
            <section className="card" aria-labelledby="lb">
              <h2 id="lb" className="h-section flex items-center gap-2"><Trophy className="h-4 w-4 text-brand-ink" /> Leaderboard</h2>
              {board.length > 0 && <p className="text-xs text-muted">{rank > 0 ? `You are #${rank} in the top 10.` : 'Keep solving to enter the top 10.'} <Link to="/leaderboard" className="text-brand-ink">View all</Link></p>}
              {board.length === 0 ? (
                <EmptyState title="No rankings yet" hint="Points are awarded for verified solved problems." />
              ) : (
                <><Podium top={board.slice(0, 3)} /><ol className="mt-3 space-y-1">
                  {board.slice(3).map((b, j) => { const i = j + 3; return (
                    <li key={b.uid} className={`flex items-center gap-3 rounded-xl px-2 py-2 ${b.uid === uid ? 'bg-brand-soft' : ''}`}>
                      <span className="w-5 text-center text-sm font-semibold text-muted">{i + 1}</span>
                      <Avatar name={b.displayName} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm">{b.displayName}</span>
                      <span className="text-sm font-medium">{b.points}</span>
                    </li>
                  ); })}
                </ol></>
              )}
            </section>

            <section className="card" aria-labelledby="news">
              <h2 id="news" className="h-section flex items-center gap-2"><Megaphone className="h-4 w-4 text-brand-ink" /> Announcements</h2>
              {news.length === 0 ? (
                <EmptyState title="No announcements" />
              ) : (
                <ul className="mt-3 space-y-3">
                  {news.map((n) => (
                    <li key={n.id}>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 whitespace-pre-line break-words text-sm text-muted">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
