#!/usr/bin/env node
/**
 * Zero-dependency static server.
 *
 * ES modules will not load over file://, so the app needs an HTTP origin. This
 * exists so `npm start` works without pulling a dependency tree into a project
 * that otherwise has none.
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
};

function resolveSafe(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(join(ROOT, normalize(decoded)));
  // Refuse anything that escapes the project root.
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null;
  return candidate;
}

const server = createServer(async (request, response) => {
  const target = resolveSafe(request.url === '/' ? '/index.html' : request.url);

  if (!target) {
    response.writeHead(403, { 'content-type': 'text/plain' });
    response.end('Forbidden');
    return;
  }

  let filePath = target;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
    await stat(filePath);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Placement Engine running at http://${HOST}:${PORT}\n`);
});
