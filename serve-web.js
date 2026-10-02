const fs = require('fs');
const http = require('http');
const path = require('path');

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const root = path.resolve(valueAfter('--root', path.join(__dirname, 'dist')));
const port = Number(valueAfter('--port', '8081'));

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const sendFile = (response, filePath) => {
  response.setHeader('Content-Type', contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  response.setHeader('Cache-Control', filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=3600');
  fs.createReadStream(filePath)
    .on('error', () => {
      if (!response.headersSent) response.writeHead(500);
      response.end('Could not read the requested file.');
    })
    .pipe(response);
};

const server = http.createServer((request, response) => {
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Invalid URL.');
    return;
  }

  const requestedPath = path.resolve(root, `.${pathname}`);
  if (requestedPath !== root && !requestedPath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden.');
    return;
  }

  fs.stat(requestedPath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(response, requestedPath);
      return;
    }
    if (!error && stats.isDirectory()) {
      sendFile(response, path.join(requestedPath, 'index.html'));
      return;
    }
    sendFile(response, path.join(root, 'index.html'));
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`SoilBot Desktop is running at http://localhost:${port}`);
  console.log('Press Ctrl+C to stop it.');
});
