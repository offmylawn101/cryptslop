// Shared bits for the wish pipeline (daily.cjs, check.cjs, approve.cjs, discard.cjs, preview.cjs).
//
// SAFETY MODEL (why the pieces are split the way they are):
//  - Wishes are written by strangers. Their raw text only ever reaches a MODERATOR model that has no
//    tools at all (claude --restricted --tools ""), which answers in a fixed JSON shape.
//  - The BUILDER model only sees the moderator's neutral rewrite (the "spec"), never the raw wish. It
//    runs with `claude --restricted` inside a throwaway git worktree: file tools confined to that
//    worktree, no network, no shell except one command (check.cjs, which lives outside the worktree so
//    it cannot be edited), and nothing that needs a permission prompt is ever approved.
//  - check.cjs runs the game's tests under Node's permission model (reads/writes only the worktree, a
//    scrubbed environment), so code written from a wish cannot read your files or your Wavedash login.
//  - The admin token lives in %USERPROFILE%\.cryptslop\wishes.json, outside every worktree.
//  - Nothing is uploaded until a human runs approve.cjs, and nothing goes live until you press Publish.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');                          // the main checkout
const WORKTREES = path.resolve(ROOT, '..', 'crypthop-wishes');             // one throwaway worktree per day
const STATE_DIR = path.join(ROOT, 'wishes');                               // reports and state (git-ignored)
const CONFIG_FILE = path.join(os.homedir(), '.cryptslop', 'wishes.json');
const CHECK = path.join(__dirname, 'check.cjs').replace(/\\/g, '/');

const DEFAULTS = {
  server: '',               // the Petition Bee server, e.g. https://cryptslop-wishes.<you>.workers.dev
  adminToken: '',
  consider: 200,            // how many open wishes the moderator reads each day (most-voted first)
  build: 0,                 // how many get built: 0 = EVERY wish that passes, most-voted first
  wildcard: 0,              // with a cap above: this many more picked at random from the rest
  stopAt: '14:40',          // Eastern: no new wish is started after this (the stream is at 3). Left over: first tomorrow
  moderatorModel: 'sonnet',
  builderModel: 'fable',
  builderMinutes: 25,       // per wish
};

function config() {
  let c = {};
  try { c = JSON.parse(fs.readFileSync(process.env.WISH_CONFIG || CONFIG_FILE, 'utf8')); } catch (e) { /* none yet */ }
  return { ...DEFAULTS, ...c };
}
function saveConfig(c) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2));
}

// today's date in New York (the stream's clock): 2026-11-11
function today(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

async function api(cfg, method, p, body) {
  if (!cfg.server || !cfg.adminToken) throw new Error(`no server configured: put {"server": "...", "adminToken": "..."} in ${CONFIG_FILE}`);
  let res = null;
  for (let attempt = 1; ; attempt++) { // networks blink: retry a few times
    try {
      res = await fetch(`${cfg.server.replace(/\/+$/, '')}${p}`, {
        method, headers: { Authorization: `Bearer ${cfg.adminToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status < 500 || attempt >= 4) break;
    } catch (e) { if (attempt >= 4) throw new Error(`server ${method} ${p}: ${e.message} (${(e.cause && e.cause.code) || 'network'})`); }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.ok === false) throw new Error(`server ${method} ${p}: ${res.status} ${(j && j.error) || ''}`);
  return j;
}

function git(args, cwd = ROOT, opts = {}) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function statePath(date) { return path.join(STATE_DIR, date, 'state.json'); }
function loadState(date) { return JSON.parse(fs.readFileSync(statePath(date), 'utf8')); }
function saveState(st) { fs.mkdirSync(path.dirname(statePath(st.date)), { recursive: true }); fs.writeFileSync(statePath(st.date), JSON.stringify(st, null, 2)); }
function latestPending() {
  if (!fs.existsSync(STATE_DIR)) return null;
  const days = fs.readdirSync(STATE_DIR).filter((d) => fs.existsSync(statePath(d))).sort().reverse();
  for (const d of days) { const st = loadState(d); if (['ready', 'building', 'merged'].includes(st.phase)) return st; }
  return null;
}

// Things that should never be in a wish's spec, or in code built from one. A hit does not prove
// anything, it just means a human looks before it goes anywhere.
const SPEC_RED_FLAGS = /(https?:\/\/|www\.|\.exe\b|powershell|cmd\.exe|\bcurl\b|\bwget\b|\btoken\b|api.?key|password|secret.?key|client.?secret|credential|\.env\b|\bssh\b|wavedash\.toml|autopush|tools[\\/]|server[\\/]|\.claude|ignore (all|any|previous|prior|your)|system prompt|you are now|jailbreak|exfiltrat|keylog|crypto ?min|bitcoin|wallet)/i;
const CODE_RED_FLAGS = [
  [/\bfetch\s*\(/, 'network call (fetch)'], [/XMLHttpRequest/, 'network call (XMLHttpRequest)'], [/new\s+WebSocket/, 'WebSocket'],
  [/sendBeacon/, 'sendBeacon'], [/\beval\s*\(/, 'eval'], [/new\s+Function\s*\(/, 'new Function'], [/\bimport\s*\(/, 'dynamic import'],
  [/getUserJwt/, 'reads the Wavedash login token'], [/document\.cookie/, 'cookies'], [/https?:\/\//, 'a URL'],
  [/\.(innerHTML|outerHTML)\s*=/, 'innerHTML (injection risk)'], [/insertAdjacentHTML|document\.write/, 'raw HTML'],
  [/window\.open|location\.(href|assign|replace)\s*=/, 'navigates the page'], [/\bWorker\s*\(|importScripts/, 'web worker'],
  [/WebAssembly/, 'WebAssembly'], [/child_process|\bspawn\(|\bexecSync|\bexecFile/, 'starts programs'], [/process\.env/, 'reads environment variables'],
  [/writeFile|appendFile|createWriteStream|unlink|rmSync|mkdirSync/, 'writes or deletes files'], [/homedir|USERPROFILE|APPDATA|\.ssh|\.cargo|\.cryptslop/, 'looks in your home folder'], [/atob\s*\(|String\.fromCharCode\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+/, 'encoded strings'],
];
// what a day's wishes may change. Anything else needs a human to say so.
const ALLOWED_PATHS = [/^src\//, /^tests\/[\w-]+\.test\.mjs$/, /^web\/models\//, /^web\/audio\//];

function scanDiff(cwd, base) {
  const files = git(['diff', '--name-only', `${base}..HEAD`], cwd).split('\n').filter(Boolean);
  const badPaths = files.filter((f) => !ALLOWED_PATHS.some((re) => re.test(f)));
  // the game code and the tests (tests also run on this PC when the day is uploaded)
  const added = git(['diff', '-U0', `${base}..HEAD`, '--', 'src', 'tests', 'web/index.html'], cwd, { maxBuffer: 64 << 20 }).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  const flags = [];
  for (const [re, what] of CODE_RED_FLAGS) {
    const hits = added.filter((l) => re.test(l));
    if (hits.length) flags.push({ what, lines: hits.slice(0, 3).map((l) => l.slice(1).trim().slice(0, 160)) });
  }
  const stat = git(['diff', '--shortstat', `${base}..HEAD`], cwd);
  return { files, badPaths, flags, stat };
}

// the claude executable itself (not the .cmd shim: no shell, so prompts and JSON pass through untouched)
function claudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const exe = path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
  return fs.existsSync(exe) ? exe : 'claude';
}
// run the claude CLI, return its parsed JSON result
function claude(args, { cwd, input, minutes = 10, env } = {}) {
  const r = spawnSync(claudeBin(), args, { cwd, input, encoding: 'utf8', timeout: minutes * 60e3, maxBuffer: 64 << 20, shell: false, env: env || process.env, windowsHide: true });
  if (r.error) throw new Error(`claude: ${r.error.message}`);
  let j = null;
  try { j = JSON.parse(r.stdout); } catch (e) { throw new Error(`claude gave no JSON (exit ${r.status}): ${(r.stderr || r.stdout || '').slice(0, 400)}`); }
  if (j.is_error) throw new Error(`claude error: ${j.result || j.subtype}`);
  return j;
}

// the in-game CHANGELOG (src/changelog.js): its data sits between two markers as plain JSON
const CHANGELOG_FILE = path.join(ROOT, 'src', 'changelog.js');
const CL_START = '/* CHANGELOG-JSON-START */', CL_END = '/* CHANGELOG-JSON-END */';
function readChangelog() {
  const src = fs.readFileSync(CHANGELOG_FILE, 'utf8');
  const a = src.indexOf(CL_START), b = src.indexOf(CL_END);
  if (a < 0 || b < 0) throw new Error('changelog markers not found');
  const block = src.slice(a + CL_START.length, b);
  const json = block.slice(block.indexOf('['), block.lastIndexOf(']') + 1);
  return { src, list: JSON.parse(json), a, b: b + CL_END.length };
}
function addChangelog({ title, by = [], items = [], at }) {
  const { src, list, a, b } = readChangelog();
  const last = list[list.length - 1];
  const [maj, min] = String(last ? last.v : '0.0').split('.').map((n) => Number(n) || 0);
  const e = { v: `${maj}.${min + 1}`, at: at || new Date().toISOString().replace(/\.\d+Z$/, 'Z'), title: String(title).toUpperCase(), by: [...new Set(by.map(String).filter(Boolean))], items: items.map((s) => String(s).toUpperCase()) };
  list.push(e);
  const body = `${CL_START}\nexport const CHANGELOG = [\n${list.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n];\n${CL_END}`;
  fs.writeFileSync(CHANGELOG_FILE, src.slice(0, a) + body + src.slice(b));
  return e;
}

module.exports = { readChangelog, addChangelog, ROOT, WORKTREES, STATE_DIR, CONFIG_FILE, CHECK, DEFAULTS, config, saveConfig, today, api, git, loadState, saveState, statePath, latestPending, SPEC_RED_FLAGS, scanDiff, claude, ALLOWED_PATHS };
