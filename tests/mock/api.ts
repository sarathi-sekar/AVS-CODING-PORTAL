export const apiConfigured = true;
export const fetchEnabledLanguages = async () => ['python', 'c'];
export const callApi = async (path: string, body: Record<string, unknown>) => {
  await new Promise((r) => setTimeout(r, 300));
  if (path === '/submit') return { submissionId: 's', verdict: 'partial', passed: 4, total: 5, visible: [{ index: 1, status: 'passed', input: '1 2', expected: '3', actual: '3', stderr: '', timeMs: 10 }], hidden: [{ index: 1, status: 'passed', timeMs: 5 }, { index: 2, status: 'wrong_answer', timeMs: 5 }, { index: 3, status: 'passed', timeMs: 5 }, { index: 4, status: 'passed', timeMs: 5 }], compileOutput: '', timeMs: 20, memoryKb: 2048, xp: 0, firstSolve: false, newBadges: [], minutes: 1 };
  if (path === '/run' && typeof body.stdin === 'string') return { kind: 'custom', status: 'passed', stdout: '9\n', stderr: '', compileOutput: '', timeMs: 8, memoryKb: 1024 };
  if (path === '/run') return { kind: 'visible', verdict: 'accepted', passed: 1, total: 1, compileOutput: '', tests: [{ index: 1, status: 'passed', input: '1 2', expected: '3', actual: '3', stderr: '', timeMs: 10 }] };
  return { ok: true, attemptId: 't2', alreadyCompleted: false, minutes: 5, xp: 5 };
};
