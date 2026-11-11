// The in-game CHANGELOG (src/changelog.js, src/changelogUI.js, tools/wishes/common.cjs).
// Run with `node tests/changelog.test.mjs`
import { createRequire } from 'node:module';
import { CHANGELOG, VERSION, stampET, nextVersion } from '../src/changelog.js';
import { changelogLines } from '../src/changelogUI.js';

let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log(`FAIL: ${msg}`); } }

ok(CHANGELOG.length >= 30, `the changelog is backfilled (${CHANGELOG.length} entries)`);
let seq = true, time = true, shape = true;
for (let i = 0; i < CHANGELOG.length; i++) {
  const e = CHANGELOG[i], p = CHANGELOG[i - 1];
  if (p && e.v !== nextVersion(p.v)) seq = false;
  if (!Number.isFinite(Date.parse(e.at)) || (p && Date.parse(e.at) < Date.parse(p.at))) time = false;
  if (!e.title || !Array.isArray(e.by) || !e.by.length || !Array.isArray(e.items) || !e.items.length) shape = false;
}
ok(seq, 'every entry is one version step after the last');
ok(time, 'every entry has a date and time, in order');
ok(shape, 'every entry has a title, who asked for it, and what changed');
ok(VERSION === CHANGELOG[CHANGELOG.length - 1].v, `the current version is the newest entry's (V${VERSION})`);
ok(nextVersion('0.37') === '0.38' && nextVersion('1.9') === '1.10', 'versions count up');
ok(stampET('2026-11-11T19:16:20Z') === 'NOV 11 2026 2:16 PM ET', `times show on the stream's clock (${stampET('2026-11-11T19:16:20Z')})`);
ok(CHANGELOG.some((e) => e.by.includes('StoneHead')) && CHANGELOG.some((e) => e.by.includes('mobs2r')), 'chatters who asked for things are credited by name');
const lines = changelogLines(24);
ok(lines[0].t === `V${VERSION}` && lines.every((l) => l.t.length <= 24), 'the panel lists the newest first, wrapped to its width');
const req = createRequire(import.meta.url);
const { readChangelog } = req('../tools/wishes/common.cjs');
ok(JSON.stringify(readChangelog().list) === JSON.stringify(CHANGELOG), 'the tools read the same changelog the game shows');

console.log(`${fails ? `\n${fails} FAILURE(S)` : '\nALL CHANGELOG TESTS PASSED'} (${passes} checks)`);
process.exit(fails ? 1 : 0);
