import { applyDailyMinutes, EMPTY_STREAK, type StreakState } from '../../src/shared/streak';
import { levelFromXp, qualifiedBadges } from '../../src/shared/gamification';
import { arr, num, obj, type Data, type Tx } from './store';

export const MAX_MINUTES_PER_DAY = 180;
export const MAX_ATTEMPTED_IDS = 300;

export interface StreakDocFull extends StreakState { totalSolved: number; hardSolved: number }
export interface DailyDoc { uid: string; date: string; year: number; attemptedIds: string[]; attempted: number; solved: number; minutes: number }
export interface AchDoc { xp: number; level: number; badges: Record<string, Date> }
export interface Progress { daily: DailyDoc; streak: StreakDocFull; ach: AchDoc }

export const progressPaths = (uid: string, date: string) => ({
  daily: `dailyActivity/${uid}_${date}`,
  streak: `streaks/${uid}`,
  ach: `achievements/${uid}`,
  board: `leaderboard/${uid}`,
});

export function parseProgress(uid: string, date: string, d: Data | null, s: Data | null, a: Data | null): Progress {
  return {
    daily: {
      uid, date, year: Number(date.slice(0, 4)),
      attemptedIds: arr<string>(d?.attemptedIds), attempted: num(d?.attempted), solved: num(d?.solved), minutes: num(d?.minutes),
    },
    streak: {
      currentStreak: num(s?.currentStreak), longestStreak: num(s?.longestStreak), activeDays: num(s?.activeDays),
      lastGoalDate: typeof s?.lastGoalDate === 'string' ? s.lastGoalDate : EMPTY_STREAK.lastGoalDate,
      totalSolved: num(s?.totalSolved), hardSolved: num(s?.hardSolved),
    },
    ach: {
      xp: num(a?.xp), level: num(a?.level, 1),
      badges: Object.fromEntries(Object.entries(obj(a?.badges)).filter(([, v]) => v instanceof Date)) as Record<string, Date>,
    },
  };
}

export interface ProgressChange {
  now: Date;
  minutes?: number;
  xp?: number;
  attemptedId?: string;
  solvedDifficulty?: 'easy' | 'medium' | 'hard';
  perfectAssessment?: boolean;
}

/** Pure: returns the new progress and the badges earned by this change. */
export function applyProgress(p: Progress, c: ChangeWithDay): { next: Progress; newBadges: string[]; creditedMinutes: number } {
  const daily = { ...p.daily, attemptedIds: [...p.daily.attemptedIds] };
  const credited = Math.max(0, Math.min(c.minutes ?? 0, MAX_MINUTES_PER_DAY - daily.minutes));
  const minutesBefore = daily.minutes;
  daily.minutes += credited;
  if (c.attemptedId && !daily.attemptedIds.includes(c.attemptedId) && daily.attemptedIds.length < MAX_ATTEMPTED_IDS) daily.attemptedIds.push(c.attemptedId);
  daily.attempted = daily.attemptedIds.length;
  const streak: StreakDocFull = { ...p.streak, ...applyDailyMinutes(p.streak, c.day, minutesBefore, daily.minutes) };
  if (c.solvedDifficulty) {
    daily.solved += 1;
    streak.totalSolved += 1;
    if (c.solvedDifficulty === 'hard') streak.hardSolved += 1;
  }
  const xp = p.ach.xp + (c.xp ?? 0);
  const badges = { ...p.ach.badges };
  const earned = qualifiedBadges({ totalSolved: streak.totalSolved, hardSolved: streak.hardSolved, longestStreak: streak.longestStreak, perfectAssessment: Boolean(c.perfectAssessment) })
    .filter((b) => !(b in badges));
  for (const b of earned) badges[b] = c.now;
  return { next: { daily, streak, ach: { xp, level: levelFromXp(xp), badges } }, newBadges: earned, creditedMinutes: credited };
}
export interface ChangeWithDay extends ProgressChange { day: string }

export function saveProgress(tx: Tx, uid: string, date: string, p: Progress, who: { displayName: string; department: string }, now: Date): void {
  const paths = progressPaths(uid, date);
  tx.set(paths.daily, { ...p.daily });
  tx.set(paths.streak, { ...p.streak, updatedAt: now });
  tx.set(paths.ach, { ...p.ach, updatedAt: now });
  tx.set(paths.board, { uid, displayName: who.displayName, department: who.department, points: p.ach.xp, solved: p.streak.totalSolved, updatedAt: now });
}

