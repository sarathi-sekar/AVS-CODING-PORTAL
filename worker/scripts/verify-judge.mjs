// Run on YOUR computer (the key never leaves it):
//   Windows PowerShell:  $env:ONLINECOMPILER_API_KEY="your-key"; node worker/scripts/verify-judge.mjs
//   Mac/Linux:           ONLINECOMPILER_API_KEY=your-key node worker/scripts/verify-judge.mjs
// Runs real programs for every language and tells you which ones are safe to enable.
const key = process.env.ONLINECOMPILER_API_KEY;
if (!key) { console.error('Set ONLINECOMPILER_API_KEY first.'); process.exit(1); }
const base = (process.env.ONLINECOMPILER_URL || 'https://api.onlinecompiler.io').replace(/\/$/, '');
const ids = { c: 'gcc-15', cpp: 'g++-15', java: 'openjdk-25', python: 'python-3.14', sql: 'sqlite-3', ...(process.env.ONLINECOMPILER_IDS ? JSON.parse(process.env.ONLINECOMPILER_IDS) : {}) };

async function run(lang, code, input = '', limit = 3) {
  const res = await fetch(`${base}/api/run-code-sync/`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ compiler: ids[lang], code, input, time_limit: limit, memory_limit: 256 }),
  });
  const text = await res.text(); let j = {}; try { j = JSON.parse(text); } catch { /* not json */ }
  return { http: res.status, j, text };
}
const P = {
  c: { ok: '#include <stdio.h>\nint main(){int a,b;scanf("%d %d",&a,&b);printf("%d\\n",a+b);return 0;}', ce: 'int main( {', re: '#include <stdlib.h>\nint main(){int*p=0;*p=1;return 0;}', tle: 'int main(){for(;;){}}' },
  cpp: { ok: '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}', ce: 'int main( {', re: 'int main(){int*p=0;*p=1;return 0;}', tle: 'int main(){for(;;){}}' },
  java: { ok: 'import java.util.*;\npublic class Main{public static void main(String[] x){Scanner s=new Scanner(System.in);System.out.println(s.nextInt()+s.nextInt());}}', ce: 'public class Main{ void }', re: 'public class Main{public static void main(String[] x){throw new RuntimeException("x");}}', tle: 'public class Main{public static void main(String[] x){while(true){}}}' },
  python: { ok: 'a,b=map(int,input().split())\nprint(a+b)', ce: 'def f(:\n  pass', re: 'raise Exception("x")', tle: 'while True: pass' },
};
const enabled = [];
for (const lang of ['c', 'cpp', 'java', 'python']) {
  const checks = []; const p = P[lang]; let fatal = '';
  try {
    const ok = await run(lang, p.ok, '2 3');
    if (ok.http === 401) fatal = 'API key rejected (401). Check the key.';
    else if (ok.http === 400) fatal = `Compiler id "${ids[lang]}" not accepted. Check https://onlinecompiler.io/docs/compilers and set ONLINECOMPILER_IDS. Reply: ${ok.text.slice(0, 120)}`;
    else if (ok.http === 429) fatal = 'Rate limited (429). Wait a minute and run again.';
    else {
      checks.push(['sum program', Number(ok.j.exit_code) === 0 && String(ok.j.output).trim() === '5']);
      const ce = await run(lang, p.ce); checks.push(['compile error reported', Number(ce.j.exit_code) !== 0 && String(ce.j.error || '').length > 0]);
      const re = await run(lang, p.re); checks.push(['runtime error reported', Number(re.j.exit_code) !== 0]);
      const t = await run(lang, p.tle, '', 1); checks.push(['infinite loop stopped', Number(t.j.exit_code) !== 0 || Number(t.j.time) >= 0.9]);
      if (process.env.VERBOSE) console.log(lang, { ok: ok.j, ce: ce.j, re: re.j, tle: t.j });
    }
  } catch (e) { fatal = `request failed: ${e.message}`; }
  const pass = !fatal && checks.every(([, v]) => v);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${lang} (${ids[lang]})  ${fatal || checks.map(([n, v]) => `${v ? '✓' : '✗'} ${n}`).join(' | ')}`);
  if (pass) enabled.push(lang);
}
try {
  const r = await run('sql', 'CREATE TABLE t(a INT);\nINSERT INTO t VALUES (1),(2);\nSELECT SUM(a) FROM t;');
  const pass = r.http === 200 && /3/.test(String(r.j.output));
  console.log(`${pass ? 'PASS' : 'FAIL'}  sql (${ids.sql})  ${pass ? '✓ query output' : `✗ http ${r.http}: ${r.text.slice(0, 120)}`}`);
  if (pass) enabled.push('sql');
} catch (e) { console.log(`FAIL  sql  request failed: ${e.message}`); }
console.log(`\nPut this in worker/wrangler.toml:\nENABLED_LANGUAGES = "${enabled.join(',')}"`);
