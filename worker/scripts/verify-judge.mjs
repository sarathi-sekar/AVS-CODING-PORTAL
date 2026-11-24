// Usage: JUDGE0_URL=https://judge.example.com [JUDGE0_AUTH_TOKEN=...] [JUDGE0_LANG_IDS='{"c":103}'] node worker/scripts/verify-judge.mjs
// Runs real programs through your Judge0 and prints which languages are safe to enable.
const base = (process.env.JUDGE0_URL || '').replace(/\/$/, '');
if (!base) { console.error('Set JUDGE0_URL'); process.exit(1); }
const ids = { c: 50, cpp: 54, java: 62, python: 71, sql: 82, ...(process.env.JUDGE0_LANG_IDS ? JSON.parse(process.env.JUDGE0_LANG_IDS) : {}) };
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s) => (s ? Buffer.from(s, 'base64').toString('utf8') : '');
const headers = { 'content-type': 'application/json', ...(process.env.JUDGE0_AUTH_TOKEN ? { 'X-Auth-Token': process.env.JUDGE0_AUTH_TOKEN } : {}) };

async function run(lang, code, stdin = '', cpu = 2) {
  const res = await fetch(`${base}/submissions?base64_encoded=true&wait=true`, {
    method: 'POST', headers,
    body: JSON.stringify({ language_id: ids[lang], source_code: b64(code), stdin: b64(stdin), cpu_time_limit: cpu, wall_time_limit: cpu * 2 + 3, memory_limit: 262144 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return { status: j.status?.id, stdout: unb64(j.stdout).trim(), compile: unb64(j.compile_output) };
}

const programs = {
  c: { ok: '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}', ce: 'int main( {', re: '#include <stdlib.h>\nint main(){int*p=0;*p=1;return 0;}', tle: 'int main(){for(;;){}}' },
  cpp: { ok: '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}', ce: 'int main( {', re: 'int main(){int*p=0;*p=1;return 0;}', tle: 'int main(){for(;;){}}' },
  java: { ok: 'import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}', ce: 'public class Main{ void }', re: 'public class Main{public static void main(String[] x){throw new RuntimeException("x");}}', tle: 'public class Main{public static void main(String[] x){while(true){}}}' },
  python: { ok: 'a,b=map(int,input().split())\nprint(a+b)', ce: null, re: 'raise Exception("x")', tle: 'while True: pass' },
};
const enabled = [];
for (const lang of ['c', 'cpp', 'java', 'python']) {
  const p = programs[lang];
  const checks = [];
  try {
    const ok = await run(lang, p.ok, '2 3'); checks.push(['hello/sum', ok.status === 3 && ok.stdout === '5']);
    if (p.ce) { const ce = await run(lang, p.ce); checks.push(['compile error detected', ce.status === 6]); }
    const re = await run(lang, p.re); checks.push(['runtime error detected', re.status >= 7 && re.status <= 12]);
    const tle = await run(lang, p.tle, '', 1); checks.push(['time limit detected', tle.status === 5]);
  } catch (e) { checks.push([`request failed: ${e.message}`, false]); }
  const pass = checks.every(([, ok]) => ok);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${lang}  ${checks.map(([n, ok]) => `${ok ? '✓' : '✗'} ${n}`).join(' | ')}`);
  if (pass) enabled.push(lang);
}
try {
  const sql = await run('sql', 'CREATE TABLE t(a INT);\nINSERT INTO t VALUES (1),(2);\nSELECT SUM(a) FROM t;');
  const pass = sql.status === 3 && sql.stdout === '3';
  console.log(`${pass ? 'PASS' : 'FAIL'}  sql (SQLite)  ${pass ? '✓ query output' : `✗ got status ${sql.status} output "${sql.stdout}"`}`);
  if (pass) enabled.push('sql');
} catch (e) { console.log(`FAIL  sql  request failed: ${e.message}`); }
console.log(`\nSet ENABLED_LANGUAGES = "${enabled.join(',')}" in worker/wrangler.toml`);
