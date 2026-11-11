// Build the game and run its tests inside a wish worktree, safely. The builder agent may run exactly
// this command (it lives in the main checkout, outside the worktree, so the agent cannot change it):
//   node C:/Users/npart/crypthop/tools/wishes/check.cjs
// - the bundle is built with the MAIN checkout's esbuild (the worktree's copy could have been edited)
// - every tests/*.test.mjs runs under Node's permission model: it can read and write only the
//   worktree, cannot start processes, and gets a scrubbed environment (no home folder, no logins)
// Exit 0 when the build and every test pass.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, WORKTREES } = require('./common.cjs');

const wt = fs.realpathSync(process.cwd());
const base = fs.realpathSync(fs.existsSync(WORKTREES) ? WORKTREES : path.dirname(wt));
if (!wt.toLowerCase().startsWith(base.toLowerCase() + path.sep)) {
  console.log(`check.cjs only runs inside a wish worktree (${WORKTREES}); this is ${wt}`);
  process.exit(2);
}

// the bundle needs three.js; give the worktree its own copy (never the main one)
const three = path.join(wt, 'node_modules', 'three');
if (!fs.existsSync(path.join(three, 'package.json'))) fs.cpSync(path.join(ROOT, 'node_modules', 'three'), three, { recursive: true });

let failed = 0;
const tail = (s, n = 30) => String(s || '').split(/\r?\n/).filter(Boolean).slice(-n).join('\n');

const esbuild = path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild');
const b = spawnSync(process.execPath, [esbuild, 'src/main.js', '--bundle', '--format=esm', '--target=es2022', '--minify', '--outfile=web/main.bundle.js', '--log-level=error'], { cwd: wt, encoding: 'utf8', timeout: 120e3, windowsHide: true });
if (b.status === 0) console.log('BUILD OK');
else { failed++; console.log(`BUILD FAILED\n${tail(b.stderr || b.stdout, 40)}`); }

const tmp = path.join(wt, '.tmp');
fs.mkdirSync(tmp, { recursive: true });
const env = { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || 'C:\\Windows', TEMP: tmp, TMP: tmp, NODE_NO_WARNINGS: '1' };
const only = process.argv[2];
const tests = fs.readdirSync(path.join(wt, 'tests')).filter((f) => /^[\w-]+\.test\.mjs$/.test(f) && (!only || f.includes(only))).sort();
for (const t of tests) {
  const r = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${wt}`, `--allow-fs-write=${wt}`, path.join('tests', t)], { cwd: wt, env, encoding: 'utf8', timeout: 300e3, maxBuffer: 32 << 20, windowsHide: true });
  if (r.status === 0) console.log(`PASS tests/${t}`);
  else {
    failed++;
    const why = r.error ? r.error.message : `exit ${r.status}`;
    const fails = String(r.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('FAIL')).slice(0, 15).join('\n');
    console.log(`FAIL tests/${t} (${why})\n${fails || tail(`${r.stdout}\n${r.stderr}`)}`);
  }
}
console.log(failed ? `${failed} PROBLEM(S). Fix them, then run the check again.` : 'ALL GOOD: the game builds and every test passes.');
process.exit(failed ? 1 : 0);
