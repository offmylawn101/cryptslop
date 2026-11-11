// PLAY THE DAY'S BUILD BEFORE SHIPPING IT: node tools/wishes/preview.cjs [date] [--port 8081]
// Serves the day's worktree (built by check.cjs) with the main checkout's dev server.
const path = require('path');
const { spawn } = require('child_process');
const C = require('./common.cjs');

const args = process.argv.slice(2);
const dateArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const port = Number(args[args.indexOf('--port') + 1]) || 8081;
const st = dateArg ? C.loadState(dateArg) : C.latestPending();
if (!st || !st.wt) { console.log('no day to preview'); process.exit(1); }
console.log(`Previewing ${st.date} at http://localhost:${port} (Ctrl+C to stop)`);
spawn(process.execPath, [path.join(C.ROOT, 'tools', 'serve.cjs')], { stdio: 'inherit', env: { ...process.env, PORT: String(port), WEB_ROOT: path.join(st.wt, 'web') } });
