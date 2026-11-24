import { LANGUAGES, type LanguageId } from '../../src/shared/languages';
import type { RawRun } from '../../src/shared/verdict';

export interface RunRequest {
  language: LanguageId;
  code: string;
  stdin: string;
  timeLimitMs: number;
  memoryLimitKb: number;
}
export interface Judge {
  run(req: RunRequest): Promise<RawRun>;
}

function b64enc(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64dec(s: string | null | undefined): string {
  if (!s) return '';
  return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, '')), (c) => c.charCodeAt(0)));
}

export interface Judge0Config {
  baseUrl: string;
  authToken?: string;
  languageIds?: Partial<Record<LanguageId, number>>;
}

/** Client for a Judge0 CE instance (self-hosted). */
export class Judge0 implements Judge {
  constructor(private readonly cfg: Judge0Config, private readonly fetchFn: typeof fetch = fetch) {}

  async run(req: RunRequest): Promise<RawRun> {
    const id = this.cfg.languageIds?.[req.language] ?? LANGUAGES[req.language].judge0Id;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.cfg.authToken) headers['X-Auth-Token'] = this.cfg.authToken;
    const res = await this.fetchFn(`${this.cfg.baseUrl.replace(/\/$/, '')}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        language_id: id,
        source_code: b64enc(req.code),
        stdin: b64enc(req.stdin),
        cpu_time_limit: req.timeLimitMs / 1000,
        wall_time_limit: Math.max(req.timeLimitMs / 1000 * 2, 5),
        memory_limit: req.memoryLimitKb,
      }),
    });
    if (!res.ok) return { statusId: 13, stdout: '', stderr: `Judge unavailable (${res.status})`, compileOutput: '', timeMs: 0, memoryKb: 0 };
    const j = (await res.json()) as {
      stdout?: string | null; stderr?: string | null; compile_output?: string | null; message?: string | null;
      status?: { id: number }; time?: string | null; memory?: number | null;
    };
    return {
      statusId: j.status?.id ?? 13,
      stdout: b64dec(j.stdout),
      stderr: b64dec(j.stderr) || b64dec(j.message),
      compileOutput: b64dec(j.compile_output),
      timeMs: Math.round(Number(j.time ?? 0) * 1000),
      memoryKb: j.memory ?? 0,
    };
  }
}
