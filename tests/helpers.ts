import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Judge, RunRequest } from '../worker/src/judge';
import type { RawRun } from '../src/shared/verdict';
import type { Data, Store, Tx } from '../worker/src/store';

/** Real local execution (gcc / g++ / python3 / javac) standing in for Judge0 in tests. */
export class LocalJudge implements Judge {
  calls = 0;
  async run(req: RunRequest): Promise<RawRun> {
    this.calls++;
    const dir = mkdtempSync(join(tmpdir(), 'judge-'));
    const base: RawRun = { statusId: 3, stdout: '', stderr: '', compileOutput: '', timeMs: 0, memoryKb: 1000 };
    try {
      let compile: ReturnType<typeof spawnSync> | null = null;
      let runCmd: string[];
      if (req.language === 'python') { writeFileSync(join(dir, 'a.py'), req.code); runCmd = ['python3', 'a.py']; }
      else if (req.language === 'c') { writeFileSync(join(dir, 'a.c'), req.code); compile = spawnSync('gcc', ['a.c', '-o', 'a.out'], { cwd: dir, encoding: 'utf8' }); runCmd = ['./a.out']; }
      else if (req.language === 'cpp') { writeFileSync(join(dir, 'a.cpp'), req.code); compile = spawnSync('g++', ['a.cpp', '-o', 'a.out'], { cwd: dir, encoding: 'utf8' }); runCmd = ['./a.out']; }
      else if (req.language === 'java') { writeFileSync(join(dir, 'Main.java'), req.code); compile = spawnSync('javac', ['Main.java'], { cwd: dir, encoding: 'utf8' }); runCmd = ['java', 'Main']; }
      else return { ...base, statusId: 13, stderr: 'unsupported in test judge' };
      if (compile && compile.status !== 0) return { ...base, statusId: 6, compileOutput: String(compile.stderr) };
      const t0 = Date.now();
      const r = spawnSync(runCmd[0], runCmd.slice(1), { cwd: dir, input: req.stdin, encoding: 'utf8', timeout: req.timeLimitMs, maxBuffer: 1 << 20 });
      const timeMs = Date.now() - t0;
      if (r.error && (r.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') return { ...base, statusId: 5, timeMs };
      if (r.status !== 0) return { ...base, statusId: 11, stdout: String(r.stdout), stderr: String(r.stderr), timeMs };
      return { ...base, stdout: String(r.stdout), stderr: String(r.stderr), timeMs };
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
}

export class MemoryStore implements Store {
  docs = new Map<string, Data>();
  async get(path: string) { const d = this.docs.get(path); return d ? structuredClone(d) : null; }
  put(path: string, data: Data) { this.docs.set(path, structuredClone(data)); }
  async transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const writes = new Map<string, Data>();
    const tx: Tx = {
      get: (p) => this.get(p),
      getMany: (ps) => Promise.all(ps.map((p) => this.get(p))),
      set: (p, d) => { writes.set(p, structuredClone(d)); },
    };
    const out = await fn(tx);
    for (const [p, d] of writes) this.docs.set(p, d);
    return out;
  }
}
