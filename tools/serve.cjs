// Static dev server with the same cross-origin isolation headers Wavedash uses.
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', 'web');
const port = Number(process.env.PORT || 8080);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.png': 'image/png', '.css': 'text/css', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg' };
http.createServer((req, res) => {
  // dev-only: save captured store media (cover art, trailer) into ./store
  if (req.method === 'POST' && req.url.startsWith('/__upload/')) {
    const name = path.basename(decodeURIComponent(req.url.slice('/__upload/'.length)));
    if (!/^[\w.-]+\.(png|webm|jpg)$/.test(name)) { res.writeHead(400); return res.end('bad name'); }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.mkdirSync(path.join(__dirname, '..', 'store'), { recursive: true });
      fs.writeFileSync(path.join(__dirname, '..', 'store', name), Buffer.concat(chunks));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = path.normalize(path.join(root, url === '/' ? 'index.html' : url));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    const headers = { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cache-Control': 'no-store' };
    if (err) { res.writeHead(404, headers); return res.end('not found'); }
    res.writeHead(200, { ...headers, 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log(`Cryptslop dev server: http://localhost:${port}`));
