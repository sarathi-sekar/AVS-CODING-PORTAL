const ts = (d: Date) => ({ toDate: () => d, __ts: true });
const today = new Date();
const dayKey = (n: number) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);
const role = () => localStorage.getItem('mockRole') ?? 'student';
const D: Record<string, Record<string, Record<string, unknown>>> = {
  users: {
    stu1: { displayName: 'Sarathi S', email: 'sarathi@avsec.edu', registerNumber: '922023104001', department: 'Artificial Intelligence and Data Science', academicYear: 'III Year', section: 'A', status: 'active' },
    u2: { displayName: 'Priya R', email: 'priya@avsec.edu', registerNumber: '922023104002', department: 'Information Technology', academicYear: 'II Year', section: 'B', role: 'student', status: 'pending', createdAt: ts(today) },
  },
  courses: { c1: { title: 'C Programming - Getting Started', description: 'Write, compile and understand your first C programs.', category: 'C', level: 'Beginner', status: 'published', order: 0, lessonCount: 2, moduleCount: 1, totalMinutes: 22 }, c2: { title: 'Java Programming', description: 'Core Java with videos.', category: 'Java', level: 'Beginner', status: 'draft', order: 1, lessonCount: 0 } },
  modules: { m1: { courseId: 'c1', title: 'Basics', order: 0, status: 'published' } },
  lessons: {
    l1: { courseId: 'c1', moduleId: 'm1', title: 'Your first C program', order: 0, level: 'Beginner', estimatedMinutes: 10, status: 'published', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', attachments: [{ name: 'Notes.pdf', url: 'https://example.com/n.pdf' }], content: '## Introduction\nA C program starts at `main`.\n\n```c\n#include <stdio.h>\nint main(void){ printf("Hi"); return 0; }\n```\n\n- point one\n- point **two**', relatedQuestionIds: ['q1'] },
    l2: { courseId: 'c1', moduleId: 'm1', title: 'Variables and data types', order: 1, level: 'Beginner', estimatedMinutes: 12, status: 'published', content: 'Variables store values.', prerequisiteId: 'l1' },
  },
  lessonProgress: { stu1_l1: { uid: 'stu1', courseId: 'c1', lessonId: 'l1', completed: false } },
  questions: {
    q1: { title: 'Add Two Numbers', difficulty: 'easy', topic: 'Basic Programming', status: 'published', languages: ['python', 'c'], description: 'Read two integers and print their sum.', inputFormat: 'Two integers.', outputFormat: 'Their sum.', constraints: '-1000 <= a, b <= 1000', examples: [{ input: '1 2', output: '3', explanation: '1 + 2 = 3' }], visibleTests: [{ input: '1 2', expected: '3' }], hiddenCount: 3, timeLimitMs: 2000, memoryLimitKb: 262144, hints: ['Read both numbers first.', 'Use +'], starter: {} },
    q2: { title: 'Reverse a String with a very long title that should wrap nicely on a 320px phone screen', difficulty: 'hard', topic: 'Strings', status: 'published', languages: ['python'], description: 'd', examples: [], visibleTests: [], hiddenCount: 0, timeLimitMs: 2000, memoryLimitKb: 262144, hints: [], starter: {} },
  },
  attempts: { stu1_q1: { uid: 'stu1', questionId: 'q1', solved: true } },
  submissions: { s1: { uid: 'stu1', questionId: 'q1', questionTitle: 'Add Two Numbers', language: 'python', verdict: 'accepted', passed: 5, total: 5, timeMs: 12, memoryKb: 900, code: 'print(1)', createdAt: ts(today) } },
  assessments: { a1: { title: 'Percentages - Set 1', category: 'quantitative', status: 'published', durationMinutes: 10, maxAttempts: 0, questions: [{ id: 'q1', text: 'What is 20% of 250?', options: ['40', '50', '60', '25'], topic: 'Percentages', marks: 1 }, { id: 'q2', text: 'Second?', options: ['a', 'b'], topic: 'Percentages', marks: 1 }] } },
  assessmentAttempts: {
    t1: { uid: 'stu1', assessmentId: 'a1', title: 'Percentages - Set 1', category: 'quantitative', attemptNo: 1, status: 'submitted', score: 1, totalMarks: 2, startedAt: ts(today), topicBreakdown: { percentages: { correct: 1, total: 2 } }, review: [{ questionId: 'q1', selected: 1, correctIndex: 1, correct: true, explanation: '250 x 20 / 100 = 50' }, { questionId: 'q2', selected: null, correctIndex: 0, correct: false, explanation: '' }] },
    t2: { uid: 'stu1', assessmentId: 'a1', title: 'Percentages - Set 1', category: 'quantitative', attemptNo: 2, status: 'in_progress', answers: {}, total: 2, startedAt: ts(today), endsAt: ts(new Date(Date.now() + 9 * 60000)) },
  },
  streaks: { stu1: { currentStreak: 4, longestStreak: 9, activeDays: 20, totalSolved: 12, hardSolved: 1, lastGoalDate: dayKey(0) } },
  achievements: { stu1: { xp: 160, level: 2, badges: { solved_1: ts(today), solved_10: ts(today) } } },
  skills: { stu1: { topics: { arrays: { attempted: 5, solved: 1, easy: 1, medium: 0, hard: 0, submissions: 9, accepted: 1 }, loops: { attempted: 10, solved: 9, easy: 4, medium: 3, hard: 2, submissions: 14, accepted: 9 } } } },
  leaderboard: { stu1: { displayName: 'Sarathi S', department: 'AI & DS', points: 160, solved: 12 }, x: { displayName: 'Priya Ramasamy', department: 'IT', points: 300, solved: 20 } },
  resources: { r1: { type: 'notes', title: 'C pointers cheat-sheet', subject: 'C', description: 'One-page revision', url: 'https://example.com/c.pdf', status: 'published' }, r2: { type: 'company', title: 'TCS NQT previous questions', company: 'TCS', body: '1. What is a pointer?\n2. Explain recursion.', status: 'published' } },
  jobs: { j1: { company: 'Zoho', role: 'Software Developer', location: 'Chennai', salary: '6 LPA', eligibility: 'CSE/IT', description: '## Rounds\n- Aptitude\n- Coding', lastDate: dayKey(-10), status: 'published' } },
  applications: {},
  events: { e1: { title: 'Java - Collections live class', date: dayKey(0), time: '10:00', program: 'Java', link: 'https://meet.example.com/x' } },
  announcements: { n1: { title: 'Weekly contest on Saturday', body: 'Solve 3 problems to earn bonus XP.', createdAt: ts(today) } },
  departments: { d1: { name: 'Information Technology' }, d2: { name: 'Artificial Intelligence and Data Science' }, d3: { name: 'Computer Science and Engineering' } },
  config: { academic: { years: ['I Year', 'II Year', 'III Year', 'IV Year'], sections: ['A', 'B'] } },
  system: localStorage.getItem('mockSetupOpen') ? {} : { bootstrap: { createdAt: ts(today) } },
  challenges: { [`daily_${dayKey(0)}`]: { type: 'daily', date: dayKey(0), questionIds: ['q1'], bonusXp: 20 } },
  bookmarks: { stu1_question_q1: { uid: 'stu1', kind: 'question', refId: 'q1', title: 'Add Two Numbers' } },
  studentNotes: { stu1_q1: { uid: 'stu1', questionId: 'q1', title: 'Add Two Numbers', text: 'Use int() on input.' } },
  dailyActivity: Object.fromEntries([0, 1, 2, 3, 5].map((n, i) => [`stu1_${dayKey(n)}`, { uid: 'stu1', date: dayKey(n), attempted: i + 1, solved: [1, 3, 6, 11, 2][i], minutes: [12, 15, 10, 30, 5][i] }])),
};
export const getFirestore = () => ({});
export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({}); export const persistentMultipleTabManager = () => ({});
const withRole = (path: string, d: Record<string, unknown> | undefined) => (path === 'users/stu1' && d ? { ...d, role: role() } : d);
const ref = (path: string) => ({ path, id: path.split('/').pop() as string, col: path.split('/')[0] });
export const doc = (a: unknown, c?: string, id?: string) => (c ? ref(`${c}/${id}`) : ref(`${(a as { name: string }).name}/${Math.random().toString(36).slice(2)}`));
export const collection = (_d: unknown, name: string) => ({ name });
export const serverTimestamp = () => ts(new Date());
export const where = (f: string, op: string, v: unknown) => ({ t: 'w', f, op, v });
export const orderBy = (f: string, dir = 'asc') => ({ t: 'o', f, dir });
export const limit = (n: number) => ({ t: 'l', n });
export const startAfter = () => ({ t: 's' });
export const query = (c: { name: string }, ...cs: Record<string, unknown>[]) => ({ name: c.name, cs });
const snap = (path: string) => { const [c, id] = path.split('/'); const d = withRole(path, D[c]?.[id]); return { id, exists: () => Boolean(d), data: () => (d ? { ...d } : undefined) }; };
export const getDoc = async (r: { path: string }) => snap(r.path);
export const onSnapshot = (r: { path?: string; name?: string }, cb: (s: unknown) => void) => { setTimeout(() => cb(r.path ? snap(r.path) : { docs: run(r as never).map(({ id, d }) => ({ id, data: () => ({ ...d }) })) }), 0); return () => undefined; };
const run = (q: { name: string; cs: Record<string, unknown>[] }) => {
  let rows = Object.entries(D[q.name] ?? {}).map(([id, d]) => ({ id, d: withRole(`${q.name}/${id}`, d) as Record<string, unknown> }));
  for (const c of q.cs) {
    if (c.t === 'w') rows = rows.filter(({ d }) => { const x = d[c.f as string] as never; return c.op === '==' ? x === c.v : c.op === 'in' ? (c.v as unknown[]).includes(x) : c.op === '>=' ? x >= (c.v as never) : c.op === '<=' ? x <= (c.v as never) : true; });
  }
  for (const c of q.cs) if (c.t === 'o') rows.sort((a, b) => { const x = a.d[c.f as string] as never; const y = b.d[c.f as string] as never; const r = x > y ? 1 : x < y ? -1 : 0; return c.dir === 'desc' ? -r : r; });
  const lim = q.cs.find((c) => c.t === 'l') as { n: number } | undefined;
  return lim ? rows.slice(0, lim.n) : rows;
};
export const getDocs = async (q: never) => ({ docs: run(q).map(({ id, d }) => ({ id, data: () => ({ ...d }) })) });
export const getCountFromServer = async (q: never) => ({ data: () => ({ count: run(q).length }) });
export const updateDoc = async () => undefined; export const setDoc = async () => undefined; export const addDoc = async () => ({ id: 'new' }); export const deleteDoc = async () => undefined;
export const writeBatch = () => ({ set() {}, update() {}, delete() {}, commit: async () => undefined });
export type Timestamp = ReturnType<typeof ts>; export type Query = unknown; export type DocumentSnapshot = unknown; export type QueryConstraint = unknown;
