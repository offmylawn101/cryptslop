// RUN THE DAILY WISH BUILD BY ITSELF: node tools/wishes/schedule.cjs [HH:MM]   (default 13:00)
// Adds a Windows scheduled task "Cryptslop Wishes" that runs daily.cjs every day at that local time
// (this PC is on Eastern time). It runs while you are logged in. The build takes up to ~2 hours for a
// full day of wishes, so 13:00 leaves time before the 3 PM stream.
// Remove it with:  schtasks /Delete /TN "Cryptslop Wishes" /F
const path = require('path');
const { spawnSync } = require('child_process');

const at = process.argv[2] || '13:00';
if (!/^\d{2}:\d{2}$/.test(at)) { console.log('give the time as HH:MM, e.g. 13:00'); process.exit(1); }
const daily = path.join(__dirname, 'daily.cjs');
const tr = `"${process.execPath}" "${daily}"`;
const r = spawnSync('schtasks', ['/Create', '/TN', 'Cryptslop Wishes', '/TR', tr, '/SC', 'DAILY', '/ST', at, '/F'], { encoding: 'utf8' });
console.log((r.stdout || r.stderr || '').trim());
process.exit(r.status || 0);
