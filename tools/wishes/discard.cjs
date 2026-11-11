// THROW THE DAY AWAY: node tools/wishes/discard.cjs [date]
// The picked wishes go back on the board with their votes; nothing is merged, uploaded or noted.
const fs = require('fs');
const { spawnSync } = require('child_process');
const C = require('./common.cjs');

function discard(st, cfg, { quiet = false } = {}) {
  if (st.wt && fs.existsSync(st.wt)) spawnSync('git', ['worktree', 'remove', '--force', st.wt], { cwd: C.ROOT });
  spawnSync('git', ['worktree', 'prune'], { cwd: C.ROOT });
  if (st.branch) spawnSync('git', ['branch', '-D', st.branch], { cwd: C.ROOT });
  st.phase = 'discarded';
  C.saveState(st);
  if (!quiet) console.log(`discarded ${st.date}`);
}

async function main() {
  const dateArg = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const st = dateArg ? C.loadState(dateArg) : C.latestPending();
  if (!st) { console.log('nothing to discard'); return; }
  const cfg = C.config();
  if (st.picked && st.picked.length) {
    await C.api(cfg, 'POST', '/api/admin/resolve', { batch: st.date, publish: false, results: st.picked.map((w) => ({ id: w.id, status: 'open' })) });
    console.log(`${st.picked.length} wish(es) back on the board`);
  }
  discard(st, cfg);
}

if (require.main === module) main().catch((e) => { console.log(`FAILED: ${e.message}`); process.exit(1); });
module.exports = { discard };
