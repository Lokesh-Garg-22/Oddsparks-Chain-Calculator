// @ts-check
/**
 * Tiny zero-dependency static server for local development.
 * Serves ./site at http://localhost:8080 (override with PORT=xxxx).
 * The site loads ES modules and fetches JSON, so file:// won't work — use this.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import { SITE_ROOT } from './paths.mjs';

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Map a URL path to a file inside `root`, or null if it can't be mapped safely.
 * Each URL segment is decoded on its own and must be a plain file or folder name,
 * so the result is the same on every OS.
 * @param {string} root absolute directory
 * @param {string} urlPath e.g. "/js/main.js?x=1"
 * @returns {string | null}
 */
export function resolveSafePath(root, urlPath) {
  const segments = [];
  for (const raw of new URL(urlPath, 'http://localhost').pathname.split('/').slice(1)) {
    let segment;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return null;
    }
    if (/[/\\\0]/.test(segment) || segment === '..' || segment === '.') return null;
    segments.push(segment);
  }
  if (segments.length === 0 || segments.at(-1) === '') segments.splice(-1, 1, 'index.html');
  const full = join(root, ...segments);
  return full.startsWith(root + sep) ? full : null;
}

/** @param {number} port */
function startServer(port) {
  createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const file = resolveSafePath(SITE_ROOT, req.url ?? '/');
    let body;
    try {
      if (!file) throw new Error('unmappable path');
      body = await readFile(file);
    } catch {
      // Like GitHub Pages: missing paths get site/404.html, with status 404.
      const page = await readFile(join(SITE_ROOT, '404.html')).catch(() => null);
      res.writeHead(404, { 'Content-Type': page ? MIME['.html'] : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
        .end(req.method === 'HEAD' ? undefined : page ?? 'Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  }).listen(port, '127.0.0.1', () => {
    console.log(`Serving site/ at http://localhost:${port}  (Ctrl+C to stop)`);
  });
}

if (process.argv[1] === import.meta.filename) {
  startServer(Number(process.env.PORT) || 8080);
}
