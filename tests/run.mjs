// npm test  -> bundles each *.test.ts(x) with esbuild and runs node:test
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
const files = readdirSync('tests').filter((f) => /\.test\.tsx?$/.test(f));
let failed = false;
for (const f of files) {
  const out = `/tmp/avs-${f}.cjs`;
  await build({ entryPoints: [`tests/${f}`], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: out, logLevel: 'error' });
  const r = spawnSync('node', ['--test', out], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
