-- The Petition Bee's database (Cloudflare D1 / SQLite).
CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,             -- Wavedash user id (JWT sub)
  name TEXT NOT NULL,            -- display name at the time of the wish
  text TEXT NOT NULL,
  created INTEGER NOT NULL,      -- unix seconds
  status TEXT NOT NULL DEFAULT 'open', -- open | building | built | rejected | hidden
  votes INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',  -- what was built, or why not
  batch TEXT NOT NULL DEFAULT '', -- the day it was built in
  gcid TEXT NOT NULL DEFAULT ''   -- playtest vs production cloud
);
CREATE INDEX IF NOT EXISTS wishes_status_votes ON wishes (status, votes DESC, created);
CREATE INDEX IF NOT EXISTS wishes_status_created ON wishes (status, created DESC);
CREATE INDEX IF NOT EXISTS wishes_uid ON wishes (uid, created DESC);
CREATE TABLE IF NOT EXISTS votes (wid INTEGER NOT NULL, uid TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (wid, uid));
CREATE TABLE IF NOT EXISTS reports (wid INTEGER NOT NULL, uid TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (wid, uid));
CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, created INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL);
