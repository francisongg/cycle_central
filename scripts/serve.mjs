// Tiny static file server used by the build (to render pages) and by `npm run preview`.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon"
};

/**
 * @param {string} dir      folder to serve
 * @param {string} base     URL prefix the site lives under, e.g. "/" or "/cycle_central/"
 * @param {(urlPath: string) => Promise<string|null>} [page]  HTML to answer for page addresses
 *                          (no file extension). Return null to fall back to files on disk.
 */
export function startServer(dir, base, page) {
  const server = http.createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, "http://x");
      if (!pathname.startsWith(base)) { res.writeHead(404).end(); return; }
      const rel = decodeURIComponent(pathname.slice(base.length));
      if (page && !path.extname(rel)) {
        const html = await page(rel);
        if (html !== null) { res.writeHead(200, { "content-type": TYPES[".html"] }).end(html); return; }
      }
      let file = path.join(dir, rel);
      if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
      if (!path.extname(file)) file = path.join(file, "index.html");
      try {
        const body = await fs.readFile(file);
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
      } catch {
        const notFound = await fs.readFile(path.join(dir, "404.html")).catch(() => "Not found");
        res.writeHead(404, { "content-type": TYPES[".html"] }).end(notFound);
      }
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}
