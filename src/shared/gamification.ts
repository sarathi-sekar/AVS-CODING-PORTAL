export type Difficulty = 'easy' | 'medium' | 'hard';
export const SOLVE_XP: Record<Difficulty, number> = { easy: 10, medium: 20, hard: 40 };
export const LESSON_XP = 5;

export function levelFromXp(xp: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50));
}
export function xpForLevel(level: number): number {
  return 50 * (level - 1) * (level - 1);
}

export interface BadgeDef { id: string; title: string; description: string }
export const BADGES: BadgeDef[] = [
  { id: 'solved_1', title: 'First Problem Solved', description: 'Solve your first coding problem.' },
  { id: 'solved_5', title: '5 Problems Solved', description: 'Solve 5 different problems.' },
  { id: 'solved_10', title: '10 Problems Solved', description: 'Solve 10 different problems.' },
  { id: 'solved_50', title: '50 Problems Solved', description: 'Solve 50 different problems.' },
  { id: 'solved_100', title: '100 Problems Solved', description: 'Solve 100 different problems.' },
  { id: 'streak_7', title: '7-Day Streak', description: 'Meet the daily goal 7 days in a row.' },
  { id: 'streak_30', title: '30-Day Streak', description: 'Meet the daily goal 30 days in a row.' },
  { id: 'perfect_assessment', title: 'Perfect Assessment', description: 'Score 100% in an assessment.' },
  { id: 'coding_champion', title: 'Coding Champion', description: 'Solve 50 problems including at least 10 hard ones.' },
];

export interface BadgeInput { totalSolved: number; hardSolved: number; longestStreak: number; perfectAssessment: boolean }

/** Badge ids the student currently qualifies for. Awarded once; callers keep the earned set. */
export function qualifiedBadges(i: BadgeInput): string[] {
  const out: string[] = [];
  for (const n of [1, 5, 10, 50, 100]) if (i.totalSolved >= n) out.push(`solved_${n}`);
  if (i.longestStreak >= 7) out.push('streak_7');
  if (i.longestStreak >= 30) out.push('streak_30');
  if (i.perfectAssessment) out.push('perfect_assessment');
  if (i.totalSolved >= 50 && i.hardSolved >= 10) out.push('coding_champion');
  return out;
}
