// Servidor estático mínimo (sem dependências) para o Portal de Normas e Atos.
// Serve a pasta ./dist na porta definida por process.env.PORT (Cloud Run usa 8080).
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'dist');
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(ROOT, path.normalize(urlPath));

  // impede path traversal para fora de ROOT
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: rotas desconhecidas voltam ao index.html
      return fs.readFile(path.join(ROOT, 'index.html'), (e2, html) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(html);
      });
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // portal-data.json não deve ser cacheado (atualiza diariamente)
    if (filePath.endsWith('portal-data.json')) headers['Cache-Control'] = 'no-store';
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Portal servindo em http://0.0.0.0:${PORT}`));
