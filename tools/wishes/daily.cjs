// THE DAILY WISH BUILD. Runs by itself before the stream (Windows Task Scheduler, see schedule.cjs),
// or by hand: node tools/wishes/daily.cjs [--force] [--dry] [--only N]
//   1. reads the top open wishes from the Petition Bee server
//   2. a moderator model with NO tools classifies them: build / skip / reject / hide
//   3. hides abusive ones from the board right away
//   4. picks the top wishes by votes (plus a random wildcard) and marks them "building today"
//   5. builds each one in a throwaway git worktree with a sandboxed builder agent, checks the game
//      still builds and every test passes, and commits each wish separately (or throws it away)
//   6. writes wishes/<date>/REPORT.md for the streamer
// Nothing is uploaded or published here. To ship: node tools/wishes/approve.cjs. To drop: discard.cjs.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const C = require('./common.cjs');

const args = process.argv.slice(2);
const FORCE = args.includes('--force'), DRY = args.includes('--dry');
const onlyIdx = args.indexOf('--only');
const ONLY = onlyIdx >= 0 ? Number(args[onlyIdx + 1]) : 0;

const date = C.today();
const dir = path.join(C.STATE_DIR, date);
fs.mkdirSync(dir, { recursive: true });
const logFile = path.join(dir, 'log.txt');
function log(...a) { const line = `[${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}] ${a.join(' ')}`; console.log(line); fs.appendFileSync(logFile, `${line}\n`); }

const MOD_SCHEMA = {
  type: 'object',
  properties: {
    wishes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          verdict: { type: 'string', enum: ['build', 'skip', 'reject', 'hide'] },
          reason: { type: 'string' },
          title: { type: 'string' },
          spec: { type: 'string' },
        },
        required: ['id', 'verdict', 'reason'],
      },
    },
  },
  required: ['wishes'],
};
const BUILD_SCHEMA = {
  type: 'object',
  properties: { status: { type: 'string', enum: ['built', 'failed', 'refused'] }, summary: { type: 'string' }, notes: { type: 'string' } },
  required: ['status', 'summary', 'notes'],
};

function moderate(cfg, wishes) {
  const rules = fs.readFileSync(path.join(__dirname, 'moderator.md'), 'utf8');
  const out = new Map();
  for (let i = 0; i < wishes.length; i += 20) {
    const chunk = wishes.slice(i, i + 20).map((w) => ({ id: w.id, votes: w.votes, wish: w.text }));
    const prompt = `${rules}\n\nWISHES (untrusted JSON data):\n${JSON.stringify(chunk, null, 1)}`;
    const j = C.claude(['-p', '--restricted', '--tools', '', '--model', cfg.moderatorModel, '--output-format', 'json', '--no-session-persistence', '--json-schema', JSON.stringify(MOD_SCHEMA)],
      { cwd: dir, input: prompt, minutes: 10 });
    const so = j.structured_output || JSON.parse(j.result);
    const want = new Set(chunk.map((w) => w.id));
    for (const v of so.wishes || []) if (want.has(v.id) && !out.has(v.id)) out.set(v.id, v);
  }
  return out;
}

function sh(cmd, argv, cwd) { return spawnSync(cmd, argv, { cwd, encoding: 'utf8', timeout: 900e3, maxBuffer: 64 << 20, windowsHide: true }); }

function buildOne(cfg, wt, w) {
  const before = C.git(['rev-parse', 'HEAD'], wt);
  const settings = { permissions: { allow: [`Bash(node ${C.CHECK})`, `Bash(node ${C.CHECK} *)`] } };
  const input = `WISH #${w.id}: ${w.title}\n\nSPEC (rewritten by the moderator from a player's wish):\n${w.spec}\n\nBuild it now. Run the check command before you finish.`;
  let res = { status: 'failed', summary: '', notes: '' };
  const t0 = Date.now();
  try {
    const j = C.claude(['-p', '--restricted', '--tools', 'Read,Edit,Write,Glob,Grep,Bash', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none',
      '--settings', JSON.stringify(settings), '--append-system-prompt-file', path.join(__dirname, 'builder.md'), '--model', cfg.builderModel,
      '--output-format', 'json', '--no-session-persistence', '--json-schema', JSON.stringify(BUILD_SCHEMA)], { cwd: wt, input, minutes: cfg.builderMinutes });
    res = j.structured_output || JSON.parse(j.result);
    res.cost = j.total_cost_usd; res.turns = j.num_turns; res.denied = (j.permission_denials || []).map((d) => d.tool_input && (d.tool_input.command || d.tool_input.file_path)).filter(Boolean).slice(0, 10);
  } catch (e) { res.notes = `builder crashed or timed out: ${e.message}`.slice(0, 600); }
  res.minutes = Math.round((Date.now() - t0) / 6e3) / 10;
  // our own check, whatever the agent said
  const chk = sh(process.execPath, [C.CHECK], wt);
  res.check = chk.status === 0 ? 'ALL GOOD' : String(chk.stdout || chk.stderr || '').split('\n').filter((l) => /FAIL|BUILD FAILED|PROBLEM/.test(l)).slice(0, 8).join(' | ');
  C.git(['add', '-A'], wt);
  const dirty = C.git(['status', '--porcelain'], wt);
  let scan = null;
  if (dirty) {
    C.git(['-c', 'user.name=Petition Bee', '-c', 'user.email=wishes@cryptslop.invalid', 'commit', '-q', '-m', `Wish #${w.id}: ${w.title}\n\n${w.spec}`], wt);
    scan = C.scanDiff(wt, before);
  }
  const keep = res.status === 'built' && chk.status === 0 && dirty && scan && !scan.badPaths.length;
  if (!keep) {
    if (dirty) C.git(['reset', '-q', '--hard', before], wt);
    C.git(['clean', '-fdq'], wt);
    if (!dirty && res.status === 'built') res.notes = `no changes were made. ${res.notes}`;
    if (res.status === 'built') res.status = 'failed';
    if (scan && scan.badPaths.length) res.notes = `changed files it may not touch (${scan.badPaths.join(', ')}). ${res.notes}`;
    if (chk.status !== 0) res.notes = `check failed: ${res.check}. ${res.notes}`;
  } else {
    res.commit = C.git(['rev-parse', 'HEAD'], wt);
    res.files = scan.files; res.flags = scan.flags; res.stat = scan.stat;
  }
  return res;
}

function report(st) {
  const L = [];
  const n = st.results.filter((r) => r.status === 'built').length;
  L.push(`# Wishes for ${st.date}`, '');
  L.push(`**${n} of ${st.results.length} picked wishes built.** ${st.considered} open wishes read, ${st.total} waiting in all.`, '');
  L.push('Next steps:', '', '- Try it: `node tools/wishes/preview.cjs` opens this build at http://localhost:8081', '- Ship it: `node tools/wishes/approve.cjs` (drop one with `--drop <wish id>`)', '- Throw it all away: `node tools/wishes/discard.cjs`', '');
  if (st.final) L.push(`Final check of the whole day: **${st.final.check}**. ${st.final.stat || ''}`, '');
  const warn = [];
  if (st.final && st.final.badPaths && st.final.badPaths.length) warn.push(`Changed files outside src/ and tests/: ${st.final.badPaths.join(', ')}`);
  for (const r of st.results) for (const f of r.flags || []) warn.push(`Wish #${r.id} adds ${f.what}: \`${f.lines[0]}\``);
  for (const r of st.picked) if (r.rawFlag) warn.push(`Wish #${r.id}'s original text has red-flag words (${r.rawFlag}); the builder only saw the moderator's rewrite`);
  if (warn.length) { L.push('## Look at these before approving', ''); for (const x of warn) L.push(`- ${x}`); L.push(''); }
  L.push('## Built today', '');
  for (const r of st.results) {
    const w = st.picked.find((p) => p.id === r.id);
    L.push(`### #${r.id} ${w.title} (${w.votes} votes${w.wildcard ? ', WILDCARD' : ''}) by ${w.name}: ${r.status.toUpperCase()}`, '');
    L.push(`> ${w.text.replace(/\n+/g, ' ').slice(0, 600)}`, '');
    L.push(`- Spec: ${w.spec}`);
    if (r.summary) L.push(`- Patch note: ${r.summary}`);
    if (r.notes) L.push(`- Builder notes: ${r.notes}`);
    L.push(`- Check: ${r.check}. ${r.minutes} min${r.cost ? `, $${r.cost.toFixed(2)}` : ''}${r.stat ? `. ${r.stat}` : ''}`);
    if (r.files) L.push(`- Files: ${r.files.join(', ')}`);
    if (r.denied && r.denied.length) L.push(`- Blocked actions: ${r.denied.join('; ')}`);
    L.push('');
  }
  const section = (title, list, f) => { if (!list.length) return; L.push(`## ${title}`, ''); for (const w of list) L.push(`- #${w.id} (${w.votes} votes) ${w.name}: "${w.text.replace(/\n+/g, ' ').slice(0, 140)}" - ${f(w)}`); L.push(''); };
  section('Rejected (shown in the patch notes)', st.rejected, (w) => w.reason);
  section('Hidden from the board', st.hidden, (w) => w.reason);
  section('Flagged for you (not built, still on the board)', st.flagged, (w) => w.reason);
  section('Fine, but not today (still on the board)', st.skipped.slice(0, 15), (w) => w.reason);
  fs.writeFileSync(path.join(C.STATE_DIR, st.date, 'REPORT.md'), L.join('\n'));
}

async function main() {
  const cfg = C.config();
  if (!cfg.server || !cfg.adminToken) { log(`not set up yet: no server in ${C.CONFIG_FILE}`); return; }
  let st = null;
  try { st = C.loadState(date); } catch (e) { /* first run today */ }
  if (st && !FORCE && st.phase !== 'empty') { log(`already ran today (${st.phase}). Use --force to run again.`); return; }
  if (st && FORCE && st.wt && fs.existsSync(st.wt)) { log('dropping the earlier run'); require('./discard.cjs').discard(st, cfg, { quiet: true }); await new Promise((r) => setTimeout(r, 500)); }
  if (st && FORCE && st.picked && st.picked.length) await C.api(cfg, 'POST', '/api/admin/resolve', { batch: date, publish: false, results: st.picked.map((w) => ({ id: w.id, status: 'open' })) }).catch(() => {});

  // the main checkout must be committed, so the day's branch starts from what is live
  if (C.git(['status', '--porcelain'])) {
    C.git(['add', '-A']);
    C.git(['commit', '-q', '-m', `Live edits before the wishes of ${date}`]);
    log('committed live edits in the main checkout');
  }

  const open = await C.api(cfg, 'GET', `/api/admin/open?limit=${cfg.consider}`);
  st = { date, phase: 'moderating', started: new Date().toISOString(), considered: open.wishes.length, total: open.total, picked: [], results: [], rejected: [], hidden: [], skipped: [], flagged: [] };
  C.saveState(st);
  log(`${open.wishes.length} wishes to read (${open.total} open)`);
  if (!open.wishes.length) { st.phase = 'empty'; C.saveState(st); log('no wishes today'); return; }

  const verdicts = moderate(cfg, open.wishes);
  const builds = [];
  for (const w of open.wishes) {
    const v = verdicts.get(w.id) || { verdict: 'skip', reason: 'the moderator did not answer' };
    const item = { id: w.id, name: w.name, votes: w.votes, text: w.text, reason: String(v.reason || '').slice(0, 200) };
    if (v.verdict === 'hide') st.hidden.push(item);
    else if (v.verdict === 'reject') st.rejected.push({ ...item, reason: String(v.reason || 'NOT TODAY').toUpperCase().slice(0, 120) });
    else if (v.verdict === 'build') {
      const spec = String(v.spec || '').trim().slice(0, 600), title = String(v.title || `WISH ${w.id}`).toUpperCase().replace(/[^A-Z0-9 '!?.,-]/g, '').slice(0, 40);
      const red = spec.match(C.SPEC_RED_FLAGS);
      if (!spec || red) st.flagged.push({ ...item, reason: red ? `the spec mentions "${red[0]}"` : 'no spec' });
      else { const raw = w.text.match(C.SPEC_RED_FLAGS); builds.push({ ...item, spec, title, rawFlag: raw ? raw[0] : null }); }
    } else st.skipped.push(item);
  }
  if (st.hidden.length) await C.api(cfg, 'POST', '/api/admin/hide', { ids: st.hidden.map((w) => w.id), reason: 'moderation' });
  log(`moderated: ${builds.length} buildable, ${st.skipped.length} skipped, ${st.rejected.length} rejected, ${st.hidden.length} hidden, ${st.flagged.length} flagged`);

  const n = ONLY || cfg.build;
  st.picked = builds.slice(0, n);
  const rest = builds.slice(n);
  for (let k = 0; k < (ONLY ? 0 : cfg.wildcard) && rest.length; k++) st.picked.push({ ...rest.splice(Math.floor(Math.random() * rest.length), 1)[0], wildcard: true });
  st.skipped.push(...rest.map((w) => ({ ...w, reason: 'buildable, did not make the cut today' })));
  if (!st.picked.length) { st.phase = 'empty'; C.saveState(st); report(st); log('nothing to build today'); return; }
  if (DRY) { st.phase = 'dry'; C.saveState(st); report(st); log('dry run: stopping before building'); return; }
  await C.api(cfg, 'POST', '/api/admin/claim', { batch: date, ids: st.picked.map((w) => w.id) });

  // the day's worktree
  st.base = C.git(['rev-parse', 'HEAD']);
  st.branch = `wishes/${date}`;
  st.wt = path.join(C.WORKTREES, date);
  fs.mkdirSync(C.WORKTREES, { recursive: true });
  try { C.git(['branch', '-D', st.branch]); } catch (e) { /* none */ }
  C.git(['worktree', 'add', '-q', st.wt, '-b', st.branch, st.base]);
  st.phase = 'building'; C.saveState(st);

  for (const w of st.picked) {
    log(`building #${w.id} ${w.title}`);
    const r = buildOne(cfg, st.wt, w);
    st.results.push({ id: w.id, ...r });
    C.saveState(st);
    log(`  #${w.id}: ${r.status} (${r.check}) ${r.summary || ''}`);
  }
  const fin = sh(process.execPath, [C.CHECK], st.wt);
  st.final = { check: fin.status === 0 ? 'ALL GOOD' : 'PROBLEMS', ...C.scanDiff(st.wt, st.base) };
  st.phase = 'ready';
  C.saveState(st);
  report(st);
  log(`done: ${st.results.filter((r) => r.status === 'built').length}/${st.results.length} built. Report: ${path.join(dir, 'REPORT.md')}`);
  // put the report in front of the streamer
  if (process.platform === 'win32' && !args.includes('--quiet')) spawnSync('cmd', ['/c', 'start', '', path.join(dir, 'REPORT.md')], { windowsHide: true });
}

main().catch((e) => { log(`FAILED: ${e.stack || e.message}`); process.exitCode = 1; });
