import type { Difficulty } from './gamification';

export interface TopicStats {
  attempted: number; // distinct questions attempted
  solved: number; // distinct questions solved
  easy: number;
  medium: number;
  hard: number; // solved counts by difficulty
  submissions: number;
  accepted: number;
}
export const EMPTY_TOPIC: TopicStats = { attempted: 0, solved: 0, easy: 0, medium: 0, hard: 0, submissions: 0, accepted: 0 };

export type SkillLevel = 'not_started' | 'needs_improvement' | 'beginner' | 'intermediate' | 'strong';
export const SKILL_LABEL: Record<SkillLevel, string> = {
  not_started: 'Not started',
  needs_improvement: 'Needs improvement',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  strong: 'Strong',
};

/** Level derived only from real results: difficulty-weighted solves, solve rate and submission accuracy. */
export function skillLevel(t: TopicStats): SkillLevel {
  if (t.attempted === 0) return 'not_started';
  const weighted = t.easy + 2 * t.medium + 3 * t.hard;
  const solveRate = t.solved / t.attempted;
  const accuracy = t.submissions > 0 ? t.accepted / t.submissions : 0;
  if (t.attempted >= 3 && solveRate < 0.4) return 'needs_improvement';
  if (weighted >= 15 && solveRate >= 0.7 && accuracy >= 0.4) return 'strong';
  if (weighted >= 6 && solveRate >= 0.5) return 'intermediate';
  return 'beginner';
}

export function recordSubmissionInTopic(t: TopicStats, o: { firstAttempt: boolean; accepted: boolean; firstSolve: boolean; difficulty: Difficulty }): TopicStats {
  const n = { ...t };
  n.submissions += 1;
  if (o.accepted) n.accepted += 1;
  if (o.firstAttempt) n.attempted += 1;
  if (o.firstSolve) {
    n.solved += 1;
    n[o.difficulty] += 1;
  }
  return n;
}

/** Recommend what to practise next: weakest attempted topic first, then topics not yet started in curriculum order. */
export function recommendTopic(stats: Record<string, TopicStats>, curriculum: string[]): string | null {
  const order: SkillLevel[] = ['needs_improvement', 'beginner', 'intermediate'];
  for (const lvl of order) {
    const hit = Object.entries(stats).filter(([, s]) => skillLevel(s) === lvl).sort((a, b) => a[1].solved / Math.max(1, a[1].attempted) - b[1].solved / Math.max(1, b[1].attempted))[0];
    if (hit) return hit[0];
  }
  return curriculum.find((t) => !stats[t] || stats[t].attempted === 0) ?? null;
}

export const topicSlug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general';
export const CURRICULUM = ['Basic Programming', 'Variables', 'Data Types', 'Operators', 'Conditions', 'Loops', 'Patterns', 'Arrays', 'Strings', 'Functions', 'Recursion', 'Searching', 'Sorting', 'OOP', 'Data Structures', 'Algorithms', 'SQL'];
