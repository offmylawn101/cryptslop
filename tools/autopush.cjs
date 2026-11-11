// Claude Code Stop hook: after every turn, if the game changed since the last push,
// build it, run the tests, and upload a new build to Wavedash. Prints a one-line status for the UI.
// Publishing (making a build live) still happens in the Wavedash Developer Portal.
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STATE = path.join(ROOT, '.claude', 'last-push.json');
const CLI = process.env.WAVEDASH_CLI || path.join(process.env.USERPROFILE || process.env.HOME || '', '.cargo', 'bin', process.platform === 'win32' ? 'wavedash.exe' : 'wavedash');

function say(msg) { process.stdout.write(JSON.stringify({ systemMessage: `[wavedash] ${msg}` }) + '\n'); }

function hashTree() {
  const h = crypto.createHash('sha256');
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else files.push(p); } };
  walk(path.join(ROOT, 'src'));
  for (const extra of ['web/index.html', 'wavedash.toml', 'package.json']) files.push(path.join(ROOT, extra));
  for (const f of files.sort()) { if (!fs.existsSync(f)) continue; h.update(path.relative(ROOT, f)); h.update(fs.readFileSync(f)); }
  return h.digest('hex');
}

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: false, timeout: 240000 });
}

try {
  const hash = hashTree();
  let last = {};
  try { last = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { /* first run */ }
  if (last.hash === hash) process.exit(0); // nothing changed this turn: stay quiet
  if (!fs.existsSync(CLI)) { say(`CLI not found at ${CLI}; skipped upload`); process.exit(0); }
  const node = process.execPath;
  const esbuild = path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild');
  try {
    run(node, [esbuild, 'src/main.js', '--bundle', '--format=esm', '--target=es2022', '--minify', '--outfile=web/main.bundle.js']);
  } catch (e) { say(`build failed, not uploading: ${String(e.stderr || e.message).split('\n').filter(Boolean).slice(-1)[0]}`); process.exit(0); }
  for (const t of ['tests/logic.test.mjs', 'tests/features.test.mjs', 'tests/fister.test.mjs', 'tests/classes2.test.mjs', 'tests/wishes.test.mjs', 'tests/bugs.test.mjs', 'tests/bestiary.test.mjs', 'tests/rooftops.test.mjs']) {
    try { run(node, [t]); } catch (e) {
      const fails = String(e.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 2).join('; ');
      say(`${t} failed, not uploading: ${fails || e.message}`); process.exit(0);
    }
  }
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  let out;
  try {
    out = run(CLI, ['build', 'push', '-m', `auto ${stamp}`]);
  } catch (e) {
    const err = String(e.stderr || e.stdout || e.message);
    if (/not authenticated/i.test(err)) say('not logged in. Run: ! "%USERPROFILE%\\.cargo\\bin\\wavedash.exe" auth login');
    else say(`upload failed: ${err.split('\n').filter(Boolean).slice(-1)[0]}`);
    process.exit(0);
  }
  const id = (out.match(/\b[a-z0-9]{32}\b/) || [])[0];
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ hash, build: id || null, at: stamp }, null, 2));
  // keep git in step with what was uploaded (the daily wish build branches from main)
  try {
    if (fs.existsSync(path.join(ROOT, '.git')) && run('git', ['status', '--porcelain']).trim()) {
      run('git', ['add', '-A']);
      run('git', ['commit', '-q', '-m', `Uploaded build ${id || stamp}`]);
    }
  } catch (e) { /* the upload still happened */ }
  say(`uploaded build ${id || '(see CLI output)'}. Publish it in the Developer Portal.`);
} catch (e) {
  say(`hook error: ${e.message}`);
}
process.exit(0);
