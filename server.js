const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
  const requested = req.url === '/' ? '/index.html' : req.url;
  const file = path.join(PUBLIC, requested);

  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(file);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Neon Sensor Lab running at http://127.0.0.1:${PORT}`);
});
