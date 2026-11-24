export type TestStatus = 'passed' | 'wrong_answer' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'compile_error' | 'internal_error';
export type Verdict = 'accepted' | 'partial' | 'wrong_answer' | 'runtime_error' | 'time_limit' | 'memory_limit' | 'compile_error' | 'internal_error';

/** Output comparison: ignores CRLF vs LF, trailing spaces on each line and trailing blank lines. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n+$/g, '');
}
export function outputsMatch(actual: string, expected: string): boolean {
  return normalizeOutput(actual) === normalizeOutput(expected);
}

export interface RawRun {
  /** Judge0 status id */
  statusId: number;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeMs: number;
  memoryKb: number;
}

/** Map a raw sandbox result to one test status. memoryLimitKb is the question's limit. */
export function classifyRun(run: RawRun, expected: string, memoryLimitKb: number): TestStatus {
  switch (run.statusId) {
    case 3: // Accepted (ran to completion; we compare output ourselves)
    case 4: // Wrong answer (only if the judge compared)
      if (run.memoryKb > memoryLimitKb) return 'memory_limit';
      return outputsMatch(run.stdout, expected) ? 'passed' : 'wrong_answer';
    case 5: return 'time_limit';
    case 6: return 'compile_error';
    case 7: case 8: case 9: case 10: case 11: case 12:
      return run.memoryKb >= memoryLimitKb * 0.98 ? 'memory_limit' : 'runtime_error';
    default: return 'internal_error';
  }
}

export function aggregateVerdict(statuses: TestStatus[]): Verdict {
  if (statuses.length === 0) return 'internal_error';
  if (statuses.includes('internal_error')) return 'internal_error';
  if (statuses.includes('compile_error')) return 'compile_error';
  const passed = statuses.filter((s) => s === 'passed').length;
  if (passed === statuses.length) return 'accepted';
  if (passed > 0) return 'partial';
  // nothing passed: report the first failure kind
  const first = statuses.find((s) => s !== 'passed') as Exclude<TestStatus, 'passed' | 'compile_error' | 'internal_error'>;
  return first;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  accepted: 'Accepted',
  partial: 'Partial Accepted',
  wrong_answer: 'Wrong Answer',
  runtime_error: 'Runtime Error',
  time_limit: 'Time Limit Exceeded',
  memory_limit: 'Memory Limit Exceeded',
  compile_error: 'Compilation Error',
  internal_error: 'Judge Error',
};
