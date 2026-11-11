// SHIP THE DAY'S WISHES: node tools/wishes/approve.cjs [date] [--drop 12,40] [--yes] [--allow-paths]
//   - drops any wishes you name (reverts just that wish's commit)
//   - refuses if the day changed files outside src/ and tests/ (unless --allow-paths), and asks for
//     --yes if any built code looks like network calls, eval and the like (see the report)
//   - merges the day into main, then runs tools/autopush.cjs: build, every test, upload to Wavedash
//   - writes the outcome to the Petition Bee: built wishes and their patch notes, rejections, and
//     wishes that did not work out go back on the board
// It does not publish: press Publish in the Wavedash Developer Portal (or run `wavedash publish`).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const C = require('./common.cjs');

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const dropIdx = args.indexOf('--drop');
const DROP = new Set(dropIdx >= 0 ? String(args[dropIdx + 1] || '').split(',').map(Number).filter(Boolean) : []);
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

function fail(msg) { console.log(`NOT APPROVED: ${msg}`); process.exit(1); }

async function main() {
  const cfg = C.config();
  const st = dateArg ? C.loadState(dateArg) : C.latestPending();
  if (!st) fail('no day is waiting for approval');
  if (st.phase === 'merged') fail(`${st.date} is already merged; once the upload works, finish with: node tools/wishes/approve.cjs --notes-only`);
  if (st.phase !== 'ready') fail(`${st.date} is "${st.phase}", not ready`);

  // drop wishes the streamer does not want (newest first, so reverts apply cleanly)
  for (const r of [...st.results].reverse()) {
    if (!DROP.has(r.id) || r.status !== 'built') continue;
    const rv = spawnSync('git', ['-c', 'user.name=Petition Bee', '-c', 'user.email=wishes@cryptslop.invalid', 'revert', '--no-edit', r.commit], { cwd: st.wt, encoding: 'utf8' });
    if (rv.status !== 0) { spawnSync('git', ['revert', '--abort'], { cwd: st.wt }); fail(`could not drop wish #${r.id} cleanly: ${rv.stderr}`); }
    r.status = 'dropped'; console.log(`dropped wish #${r.id}`);
  }
  C.saveState(st); // the drops stick, even if a later step fails
  const built = st.results.filter((r) => r.status === 'built');

  const scan = C.scanDiff(st.wt, st.base);
  if (scan.badPaths.length && !flag('--allow-paths')) fail(`the day changes files outside src/ and tests/: ${scan.badPaths.join(', ')}. Look at them, then rerun with --allow-paths.`);
  if (scan.flags.length) {
    console.log('The built code contains things worth a look:');
    for (const f of scan.flags) console.log(`  - ${f.what}: ${f.lines.join('  |  ')}`);
    if (!flag('--yes')) fail('rerun with --yes once you have looked at them');
  }
  if (built.length) {
    const chk = spawnSync(process.execPath, [C.CHECK], { cwd: st.wt, encoding: 'utf8', timeout: 900e3 });
    if (chk.status !== 0) fail(`the day's build does not pass its checks:\n${chk.stdout}`);
  }

  // merge into main (live edits made since the run get committed first)
  if (C.git(['status', '--porcelain'])) { C.git(['add', '-A']); C.git(['commit', '-q', '-m', `Live edits before merging the wishes of ${st.date}`]); }
  if (built.length) {
    const titles = built.map((r) => { const w = st.picked.find((p) => p.id === r.id); return `- #${r.id} ${w.title} (${w.name})`; }).join('\n');
    const m = spawnSync('git', ['merge', '--no-ff', st.branch, '-m', `Chat wishes ${st.date}\n\n${titles}`], { cwd: C.ROOT, encoding: 'utf8' });
    if (m.status !== 0) { spawnSync('git', ['merge', '--abort'], { cwd: C.ROOT }); fail(`merge conflict with live edits; resolve by hand (git merge ${st.branch}):\n${m.stdout}${m.stderr}`); }
    console.log(`merged ${built.length} wish(es) into main`);
    st.phase = 'merged'; C.saveState(st);
    // the in-game CHANGELOG: one entry for the day, crediting every player whose wish was built
    try {
      const names = built.map((r) => st.picked.find((p) => p.id === r.id).name);
      const e = C.addChangelog({ title: `WISHES OF ${st.date}`, by: names, items: built.map((r) => r.summary || st.picked.find((p) => p.id === r.id).title) });
      console.log(`changelog V${e.v} added`);
    } catch (e) { console.log(`changelog not updated: ${e.message}`); }
    const ap = spawnSync(process.execPath, [path.join(C.ROOT, 'tools', 'autopush.cjs')], { cwd: C.ROOT, encoding: 'utf8', timeout: 900e3 });
    const msg = (String(ap.stdout).match(/"systemMessage":"([^"]*)"/) || [])[1] || ap.stdout || ap.stderr;
    console.log(`autopush: ${msg}`);
    if (!/uploaded build/.test(String(ap.stdout))) fail(`the upload did not happen, so the Petition Bee was not updated. Fix it, run tools/autopush.cjs, then rerun approve with --notes-only\n${msg}`);
  }

  await writeNotes(cfg, st);
  st.phase = 'approved'; st.approved = new Date().toISOString();
  C.saveState(st);
  removeWorktree(st);
  console.log(`APPROVED ${st.date}: ${built.length} built. Press Publish in the Wavedash Developer Portal to make it live.`);
}

async function writeNotes(cfg, st) {
  const results = [];
  for (const r of st.results) {
    if (r.status === 'built') results.push({ id: r.id, status: 'built', summary: r.summary || 'BUILT' });
    else if (r.status === 'refused') results.push({ id: r.id, status: 'rejected', reason: (r.summary || 'THE BUILDER BEE SAID NO').toUpperCase() });
    else results.push({ id: r.id, status: 'open' }); // failed or dropped: back on the board, votes kept
  }
  for (const w of st.rejected) results.push({ id: w.id, status: 'rejected', reason: w.reason });
  const n = st.results.filter((r) => r.status === 'built').length;
  const j = await C.api(cfg, 'POST', '/api/admin/resolve', { batch: st.date, title: `PATCH ${st.date}: CHAT BUILT ${n} WISH${n === 1 ? '' : 'ES'}`, results });
  console.log(`Petition Bee updated: ${j.built} built, ${j.rejected} rejected`);
}

function removeWorktree(st) {
  if (st.wt && fs.existsSync(st.wt)) spawnSync('git', ['worktree', 'remove', '--force', st.wt], { cwd: C.ROOT });
  spawnSync('git', ['worktree', 'prune'], { cwd: C.ROOT });
  if (st.branch) spawnSync('git', ['branch', '-D', st.branch], { cwd: C.ROOT });
}

if (require.main === module) {
  if (flag('--notes-only')) {
    (async () => {
      const st = dateArg ? C.loadState(dateArg) : C.latestPending();
      if (!st || st.phase !== 'merged') fail('--notes-only is for a day that was merged but not uploaded');
      await writeNotes(C.config(), st); st.phase = 'approved'; C.saveState(st); removeWorktree(st); })().catch((e) => fail(e.message));
  } else main().catch((e) => fail(e.stack || e.message));
}
module.exports = { removeWorktree };
