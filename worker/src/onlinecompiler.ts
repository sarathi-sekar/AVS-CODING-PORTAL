import type { LanguageId } from '../../src/shared/languages';
import type { RawRun } from '../../src/shared/verdict';
import type { Judge, RunRequest } from './judge';

/** Default compiler ids on OnlineCompiler.io (full list: https://onlinecompiler.io/docs/compilers). Override with ONLINECOMPILER_IDS. */
export const DEFAULT_COMPILER_IDS: Record<LanguageId, string> = {
  c: 'gcc-15', cpp: 'g++-15', java: 'openjdk-25', python: 'python-3.14', sql: 'sqlite-3',
};

export interface OnlineCompilerConfig { apiKey: string; baseUrl?: string; compilerIds?: Partial<Record<LanguageId, string>> }

interface ApiResult { output?: string | null; error?: string | null; status?: string | null; exit_code?: number | string | null; signal?: string | number | null; time?: string | number | null; memory?: string | number | null }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function looksLikeCompileError(lang: LanguageId, err: string): boolean {
  switch (lang) {
    case 'python': return /(SyntaxError|IndentationError|TabError)/.test(err);
    case 'c': case 'cpp': return /(error:|undefined reference to|ld returned \d+ exit status|fatal error:)/.test(err);
    case 'java': return /(\.java:\d+: error|error: |cannot find symbol|class, interface, enum, or record expected)/.test(err) && !/Exception in thread/.test(err);
    default: return false;
  }
}

/** Translates an OnlineCompiler.io result into the Judge0-style RawRun the rest of the judge understands. */
export function mapOnlineCompilerResult(req: RunRequest, j: ApiResult): RawRun {
  const exit = Number(j.exit_code ?? 0);
  const timeMs = Math.round(Number(j.time ?? 0) * 1000);
  const memoryKb = Math.round(Number(j.memory ?? 0));
  const stdout = String(j.output ?? '');
  const err = String(j.error ?? '');
  const status = String(j.status ?? '').toLowerCase();
  const memLimitKb = clamp(Math.ceil(req.memoryLimitKb / 1024), 16, 512) * 1024;
  const base = { stdout, stderr: err, compileOutput: '', timeMs, memoryKb };

  if (/time/.test(status) && /(out|limit|exceed)/.test(status)) return { ...base, statusId: 5 };
  if (exit === 0 && !j.signal) return { ...base, statusId: 3 };
  if (looksLikeCompileError(req.language, err)) return { ...base, statusId: 6, compileOutput: err, stderr: '' };
  if (exit === 137 && memoryKb >= memLimitKb * 0.9) return { ...base, statusId: 12, memoryKb: Math.max(memoryKb, memLimitKb) };
  if (exit === 124 || timeMs >= req.timeLimitMs * 0.95) return { ...base, statusId: 5 };
  return { ...base, statusId: 11 };
}

/** Hosted judge: https://onlinecompiler.io (free plan: 100,000 runs a month). The API key is a Worker secret and never reaches the browser. */
export class OnlineCompiler implements Judge {
  constructor(private readonly cfg: OnlineCompilerConfig, private readonly fetchFn: typeof fetch = fetch) {}

  async run(req: RunRequest): Promise<RawRun> {
    const internal = (msg: string): RawRun => ({ statusId: 13, stdout: '', stderr: msg, compileOutput: '', timeMs: 0, memoryKb: 0 });
    const compiler = this.cfg.compilerIds?.[req.language] ?? DEFAULT_COMPILER_IDS[req.language];
    let res: Response;
    try {
      res = await this.fetchFn(`${(this.cfg.baseUrl ?? 'https://api.onlinecompiler.io').replace(/\/$/, '')}/api/run-code-sync/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.cfg.apiKey}` },
        body: JSON.stringify({
          compiler, code: req.code, input: req.stdin,
          time_limit: clamp(req.timeLimitMs / 1000, 0.5, 30),
          memory_limit: clamp(Math.ceil(req.memoryLimitKb / 1024), 16, 512),
        }),
      });
    } catch { return internal('Judge unreachable'); }
    if (res.status === 401) return internal('Judge API key was rejected');
    if (res.status === 429) return internal('Judge is busy (rate limit). Try again in a minute');
    if (!res.ok) return internal(`Judge error (${res.status})`);
    return mapOnlineCompilerResult(req, (await res.json().catch(() => ({}))) as ApiResult);
  }
}
