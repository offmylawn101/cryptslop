// Where the Petition Bee's server lives. tools/wishes/deploy.cjs fills this in after the first deploy.
// The local build (localhost) talks to the local server (node server/wishes/local.mjs) instead.
export const WISH_SERVER = '';
// when the stream builds the day's top wishes (Eastern time, 24h clock)
export const WISH_HOUR_ET = 15;

export function wishServer() {
  try {
    const q = new URLSearchParams(location.search).get('wishes');
    if (q) return q.replace(/\/+$/, '');
    if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return 'http://localhost:8787';
  } catch (e) { /* not in a browser */ }
  return WISH_SERVER.replace(/\/+$/, '');
}
