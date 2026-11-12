// PUT THE PETITION BEE ONLINE (Cloudflare Workers + D1, free tier). Run once, and again after
// changing server/wishes/src/worker.js:   node tools/wishes/deploy.cjs
// First time only, log in to Cloudflare yourself:   cd server/wishes && npx wrangler login
// What it does: installs wrangler (server/wishes/node_modules), creates the database if needed and
// applies schema.sql, deploys the worker, sets a fresh ADMIN_TOKEN secret (kept in
// %USERPROFILE%\.cryptslop\wishes.json, never in the repo), and writes the server's URL into
// src/wishConfig.js so the game knows where to send wishes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const C = require('./common.cjs');

const SRV = path.join(C.ROOT, 'server', 'wishes');
const TOML = path.join(SRV, 'wrangler.toml');
const WIN = process.platform === 'win32';

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { cwd: SRV, encoding: 'utf8', input, shell: WIN, timeout: 600e3, maxBuffer: 32 << 20 });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
}
const wrangler = (args, input) => run('npx', ['--no-install', 'wrangler', ...args], input);
function die(msg) { console.log(msg); process.exit(1); }

if (!fs.existsSync(path.join(SRV, 'node_modules', 'wrangler'))) {
  console.log('installing wrangler...');
  const i = run('npm', ['install', '--no-audit', '--no-fund']);
  if (!i.ok) die(`npm install failed:\n${i.out}`);
}
const who = wrangler(['whoami']);
if (!who.ok || /not authenticated|You are not logged in/i.test(who.out)) die('Not logged in to Cloudflare. Run this yourself first:\n  cd server/wishes && npx wrangler login');

let toml = fs.readFileSync(TOML, 'utf8');
if (toml.includes('REPLACE_ME')) {
  const list = wrangler(['d1', 'list', '--json']);
  let id = null;
  try { id = (JSON.parse(list.out.slice(list.out.indexOf('['))).find((d) => d.name === 'cryptslop-wishes') || {}).uuid; } catch (e) { /* none */ }
  if (!id) {
    const mk = wrangler(['d1', 'create', 'cryptslop-wishes']);
    if (!mk.ok) die(`could not create the database:\n${mk.out}`);
    id = (mk.out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/) || mk.out.match(/"database_id"\s*:\s*"([0-9a-f-]{36})"/) || mk.out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/) || [])[1];
    if (!id) die(`created the database but could not read its id:\n${mk.out}`);
  }
  toml = toml.replace('REPLACE_ME', id);
  fs.writeFileSync(TOML, toml);
  console.log(`database: ${id}`);
}
const schema = wrangler(['d1', 'execute', 'cryptslop-wishes', '--remote', '--yes', '--file', 'schema.sql']);
if (!schema.ok) die(`schema failed:\n${schema.out}`);

const dep = wrangler(['deploy']);
if (!dep.ok) die(`deploy failed:\n${dep.out}`);
const url = (dep.out.match(/https:\/\/[\w.-]+\.workers\.dev/) || [])[0];
if (!url) die(`deployed, but no workers.dev URL in the output:\n${dep.out}`);

const cfg = C.config();
if (!cfg.adminToken || cfg.adminToken.startsWith('local-')) cfg.adminToken = crypto.randomBytes(32).toString('hex');
const sec = wrangler(['secret', 'put', 'ADMIN_TOKEN'], `${cfg.adminToken}\n`);
if (!sec.ok) die(`could not set the admin token:\n${sec.out}`);
cfg.server = url;
C.saveConfig({ server: url, adminToken: cfg.adminToken }); // only these: the defaults in common.cjs stay the defaults

const conf = path.join(C.ROOT, 'src', 'wishConfig.js');
const src = fs.readFileSync(conf, 'utf8').replace(/export const WISH_SERVER = '[^']*';/, `export const WISH_SERVER = '${url}';`);
fs.writeFileSync(conf, src);
console.log(`THE PETITION BEE IS ONLINE: ${url}\nadmin token saved in ${C.CONFIG_FILE}\nthe game now points at it (src/wishConfig.js); upload a build so players can reach it.`);
