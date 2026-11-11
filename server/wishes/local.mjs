// Run the Petition Bee's server on this PC (no Cloudflare needed): the same worker code, with Node's
// built-in SQLite standing in for D1. For testing the game and the pipeline locally.
//   node server/wishes/local.mjs [--port 8787] [--db path.sqlite] [--admin TOKEN]
// DEV mode is on: the game's local build signs in with "dev:<id>" tokens.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { handle } from './src/worker.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// a D1-shaped wrapper over node:sqlite
export function makeD1(file) {
  const db = new DatabaseSync(file);
  db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async (col) => { const r = db.prepare(sql).get(...args); if (!r) return null; return col ? r[col] : { ...r }; },
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })), success: true }),
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
  });
  return { prepare: (sql) => stmt(sql), close: () => db.close() };
}

export function startLocal({ port = 8787, db = ':memory:', admin = 'local-admin-token-0123456789abcdef', quiet = false } = {}) {
  const env = { DB: makeD1(db), DEV: '1', ADMIN_TOKEN: admin };
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const url = `http://localhost:${port}${req.url}`;
    const init = { method: req.method, headers: req.headers };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) init.body = Buffer.concat(chunks);
    const out = await handle(new Request(url, init), env);
    const headers = Object.fromEntries(out.headers);
    // the game's dev server is cross-origin isolated (COEP require-corp): CORS covers fetch()
    res.writeHead(out.status, headers);
    res.end(Buffer.from(await out.arrayBuffer()));
  });
  return new Promise((resolve) => server.listen(port, () => {
    if (!quiet) console.log(`Petition Bee (local, DEV) on http://localhost:${port}  admin token: ${admin}`);
    resolve({ server, env, close: () => new Promise((r) => { server.close(() => { env.DB.close(); r(); }); }) });
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  startLocal({ port: Number(arg('--port', 8787)), db: arg('--db', path.join(here, '.local.sqlite')), admin: arg('--admin', undefined) });
}
