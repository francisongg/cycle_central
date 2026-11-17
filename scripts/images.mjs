// Product photos for the website build.
//
// Cycle Beast's photos are full-size originals on another server. For speed and for Google
// Images, the build downloads each one once and serves resized copies from this site:
//  - WebP at 480, 960 and 1600 px wide (never larger than the original), so phones load small
//    files and the page reserves the right space before the photo arrives
//  - a 1200x630 share image per colour (Facebook, Messenger, Viber link previews)
//  - a 1200 px JPEG of each colour's first photo, for shopping feeds that don't take WebP
// Everything is kept in a cache folder (.cache/img, saved between GitHub runs), so an hourly
// rebuild only downloads photos that are new. A photo that can't be downloaded keeps its
// original address, so nothing breaks.
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

const WIDTHS = [480, 960, 1600];
const slug = (t) => String(t || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "photo";
const hashOf = (u) => crypto.createHash("sha1").update(u).digest("hex").slice(0, 16);

async function download(url) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) throw new Error("empty file");
      return buf;
    } catch (e) {
      last = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw last;
}

// Makes (or reuses) every size of one photo in the cache; returns { w, h, widths }
async function prepare(url, cacheDir) {
  const h = hashOf(url);
  const metaFile = path.join(cacheDir, `${h}.json`);
  try {
    const meta = JSON.parse(await fs.readFile(metaFile, "utf8"));
    if (meta.widths.every((w) => fsSync.existsSync(path.join(cacheDir, `${h}-${w}.webp`))) && fsSync.existsSync(path.join(cacheDir, `${h}-og.jpg`)) && fsSync.existsSync(path.join(cacheDir, `${h}-1200.jpg`))) return { ...meta, hash: h, cached: true };
  } catch { /* not cached yet */ }
  const buf = await download(url);
  const base = () => sharp(buf, { failOn: "none" }).rotate();
  const info = await base().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const W = info.width, H = info.height;
  if (!W || !H) throw new Error("not an image");
  const widths = WIDTHS.filter((w) => w < W);
  if (!widths.length || widths[widths.length - 1] < Math.min(W, 1600)) widths.push(Math.min(W, 1600));
  for (const w of widths) await base().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toFile(path.join(cacheDir, `${h}-${w}.webp`));
  await base().flatten({ background: "#ffffff" }).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(cacheDir, `${h}-1200.jpg`));
  await base().flatten({ background: "#ffffff" }).resize(1120, 560, { fit: "contain", background: "#ffffff" })
    .extend({ top: 35, bottom: 35, left: 40, right: 40, background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(cacheDir, `${h}-og.jpg`));
  const meta = { w: W, h: H, widths };
  await fs.writeFile(metaFile, JSON.stringify(meta));
  return { ...meta, hash: h, cached: false };
}

/**
 * Rewrites every product's photo addresses to local resized copies (in place).
 * @returns {{ images: object, stats: { photos: number, downloaded: number, cached: number, failed: string[] } }}
 */
export async function processPhotos(products, { cacheDir, distDir, concurrency = 6 }) {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(path.join(distDir, "img/p"), { recursive: true });
  await fs.mkdir(path.join(distDir, "og/products"), { recursive: true });

  // Each photo gets a readable file name from its product and colour: trek-marlin-5-gen-3-black-1-960.webp
  const names = new Map();
  const taken = new Set();
  for (const p of products) {
    const add = (u, label) => {
      if (!u || names.has(u) || !/^https?:\/\//i.test(u)) return;
      let n = label, k = 2;
      while (taken.has(n)) n = `${label}-${k++}`;
      taken.add(n); names.set(u, n);
    };
    (p.colors || []).forEach((c) => (c.photos || []).forEach((u, i) => add(u, `${p.slug}-${slug(c.name)}-${i + 1}`)));
    (p.photos || []).forEach((u, i) => add(u, `${p.slug}-${i + 1}`));
  }

  const done = new Map(); // url -> { name, w, h, widths, hash }
  const stats = { photos: names.size, downloaded: 0, cached: 0, failed: [] };
  const queue = [...names.entries()];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const [u, name] = queue.shift();
      try {
        const r = await prepare(u, cacheDir);
        r.cached ? stats.cached++ : stats.downloaded++;
        for (const w of r.widths) await fs.copyFile(path.join(cacheDir, `${r.hash}-${w}.webp`), path.join(distDir, `img/p/${name}-${w}.webp`));
        done.set(u, { name, ...r });
      } catch (e) {
        stats.failed.push(`${name}: ${e.message}`);
      }
    }
  }));

  // Photo list -> local addresses, and the size table the pages use for srcset
  const images = {};
  const local = (u) => {
    const d = done.get(u);
    if (!d) return u;
    const main = d.widths.includes(960) ? 960 : d.widths[d.widths.length - 1];
    const src = `img/p/${d.name}-${main}.webp`;
    images[src] = { w: main, h: Math.round((main * d.h) / d.w), set: d.widths.map((w) => [w, `img/p/${d.name}-${w}.webp`]) };
    return src;
  };
  for (const p of products) {
    // Share image and feed image per colour, from that colour's first photo (or the model's)
    const firsts = (p.colors || []).map((c) => (c.photos && c.photos[0]) || (p.photos && p.photos[0]));
    for (const [ci, u] of firsts.entries()) {
      const d = u && done.get(u);
      if (!d) continue;
      const og = `og/products/${p.slug}${ci ? `-${ci}` : ""}.jpg`;
      const feed = `img/p/${d.name}-1200.jpg`;
      await fs.copyFile(path.join(cacheDir, `${d.hash}-og.jpg`), path.join(distDir, og));
      await fs.copyFile(path.join(cacheDir, `${d.hash}-1200.jpg`), path.join(distDir, feed));
      p.colors[ci].og = og;
      p.colors[ci].feedImage = feed;
      if (ci === 0) { p.og = og; p.feedImage = feed; }
    }
    if (p.photos) p.photos = p.photos.map(local);
    for (const c of p.colors || []) if (c.photos) c.photos = c.photos.map(local);
  }

  // Forget photos that are no longer in the catalog, so the cache doesn't keep growing
  const keep = new Set([...done.values()].map((d) => d.hash));
  for (const f of await fs.readdir(cacheDir)) {
    const h = f.slice(0, 16);
    if (/^[0-9a-f]{16}[-.]/.test(f) && !keep.has(h)) await fs.rm(path.join(cacheDir, f), { force: true });
  }
  return { images, stats };
}
