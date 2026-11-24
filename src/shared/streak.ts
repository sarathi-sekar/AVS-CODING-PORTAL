export const DAILY_GOAL_MINUTES = 10;

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  /** Last IST date (YYYY-MM-DD) on which the daily goal was met. */
  lastGoalDate: string | null;
}

export const EMPTY_STREAK: StreakState = { currentStreak: 0, longestStreak: 0, activeDays: 0, lastGoalDate: null };

/** YYYY-MM-DD for a Date in Asia/Kolkata. Server-side callers pass the server clock, never a client value. */
export function istDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return t.toISOString().slice(0, 10);
}

/**
 * Call when a day's total qualifying minutes change. `minutesBefore`/`minutesAfter` are that day's totals.
 * The streak only moves the moment the day crosses the goal, so repeated calls cannot double count.
 */
export function applyDailyMinutes(state: StreakState, dayKey: string, minutesBefore: number, minutesAfter: number): StreakState {
  const crossed = minutesBefore < DAILY_GOAL_MINUTES && minutesAfter >= DAILY_GOAL_MINUTES;
  if (!crossed || state.lastGoalDate === dayKey) return state;
  const continues = state.lastGoalDate === addDays(dayKey, -1);
  const currentStreak = continues ? state.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(state.longestStreak, currentStreak),
    activeDays: state.activeDays + 1,
    lastGoalDate: dayKey,
  };
}

/** What to display today: a streak is alive only if the goal was met today or yesterday. */
export function effectiveStreak(state: StreakState, todayKey: string): number {
  if (!state.lastGoalDate) return 0;
  return state.lastGoalDate === todayKey || state.lastGoalDate === addDays(todayKey, -1) ? state.currentStreak : 0;
}

/** Monday (IST calendar) of the week containing `key`, as YYYY-MM-DD. */
export function mondayOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}
