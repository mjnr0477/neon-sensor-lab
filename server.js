const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.resolve(__dirname, 'public');
const PUBLIC_PREFIX = `${PUBLIC}${path.sep}`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function safePath(requestUrl) {
  let pathname;

  try {
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }

  const requested = pathname === '/' ? '/index.html' : pathname;
  const resolved = path.resolve(PUBLIC, `.${requested}`);

  if (resolved !== PUBLIC && !resolved.startsWith(PUBLIC_PREFIX)) {
    return null;
  }

  return resolved;
}

const server = http.createServer((req, res) => {
  const file = safePath(req.url || '/');

  if (!file) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      return res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
    }

    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });

    res.end(data);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Port ${PORT} is already in use. Stop the existing Neon Sensor Lab server or start this server with another PORT.`
    );
    process.exitCode = 1;
    return;
  }

  if (error.code === 'EACCES') {
    console.error(
      `Permission denied while trying to use port ${PORT}. Try another PORT value.`
    );
    process.exitCode = 1;
    return;
  }

  console.error('Neon Sensor Lab server error:', error);
  process.exitCode = 1;
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Neon Sensor Lab running on port ${PORT}`);
});
