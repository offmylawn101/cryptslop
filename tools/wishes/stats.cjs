// HOW MANY PLAYERS HAVE TRIED THE PETITION BEE: node tools/wishes/stats.cjs
const C = require('./common.cjs');
C.api(C.config(), 'GET', '/api/admin/stats').then((s) => {
  console.log(`${s.wishers} players have made a wish (${s.wishers24h} in the last 24h), ${s.voters} have voted.`);
  console.log(`${s.wishes} wishes in all (${s.wishes24h} in the last 24h), ${s.votes} votes. ${s.open} waiting, ${s.built} built.`);
}).catch((e) => { console.log(e.message); process.exit(1); });
