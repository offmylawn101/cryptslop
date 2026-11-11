// Add an entry to the in-game CHANGELOG (src/changelog.js):
//   node tools/changelog.cjs "TITLE" --by "user1,user2" --item "what changed" --item "another thing"
// The version goes up by one step. "by" is who asked for it (chat usernames, THE STREAMER, CHAT).
const { addChangelog } = require('./wishes/common.cjs');
const args = process.argv.slice(2);
const title = args[0];
if (!title || title.startsWith('--')) { console.log('usage: node tools/changelog.cjs "TITLE" --by "a,b" --item "..." [--item "..."]'); process.exit(1); }
const by = [], items = [];
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--by') by.push(...String(args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean));
  else if (args[i] === '--item') items.push(String(args[++i] || ''));
}
const e = addChangelog({ title, by: by.length ? by : ['THE STREAMER'], items });
console.log(`changelog V${e.v}: ${e.title} (by ${e.by.join(', ')})`);
