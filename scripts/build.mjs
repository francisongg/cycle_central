// Builds the public site into dist/:
//  - one finished HTML file per page (so search engines see full content without running JavaScript)
//  - sitemap.xml (with photos, and lastmod dates that only change when a page changes),
//    robots.txt, 404.html, site.webmanifest
//  - resized product photos (img/p/) and social share images (og/), app icons
//  - feeds/products.xml for Google Merchant Center, Bing and Facebook/Instagram shops
//  - js/town.js: Bike Town (3D) bundled with three.js
//  - the blog from content/blog/*.md (scripts/blog.mjs): pages, blog-data/*.json, blog/feed.xml
//
// Usage: npm run build
// Env:   SITE_URL   public address, default from js/data.js (site.url)
//        BASE_PATH  folder the site lives in, default "/" (use "/cycle_central/" without a custom domain)
//        CHROMIUM_PATH  optional path to a Chromium binary
//        CATALOG_FEED_KEY  Cycle Beast feed key; when set, the bikes come from Cycle Beast (see scripts/catalog.mjs)
import { chromium } from "playwright";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";
import { loadCatalog } from "./catalog.mjs";
import { processPhotos } from "./images.mjs";
import { productFeed } from "./feeds.mjs";
import { INDEXNOW_KEY } from "./indexnow.mjs";
import { loadBlog, rssFeed } from "./blog.mjs";
import crypto from "node:crypto";
import { build as bundle } from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
// Kept between builds (GitHub caches it): resized photos and each page's last-changed date
const CACHE = path.join(ROOT, ".cache");

const data = (() => {
  const ctx = { window: {} };
  vm.runInNewContext(fsSync.readFileSync(path.join(ROOT, "js/data.js"), "utf8"), ctx);
  return ctx.window.CC_DATA;
})();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Always publish https:// addresses. GitHub reports http:// until "Enforce HTTPS" is on,
// but search engines should only ever see the secure address.
const SITE_URL = (process.env.SITE_URL || data.site.url).replace(/\/$/, "").replace(/^http:\/\/(?!127\.0\.0\.1|localhost)/, "https://");
const BASE = ("/" + (process.env.BASE_PATH || "/").replace(/^\/+|\/+$/g, "") + "/").replace(/^\/\/$/, "/");
const today = new Date().toISOString().slice(0, 10);

const write = async (rel, content) => {
  const file = path.join(DIST, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
};

async function main() {
  console.log(`Building ${SITE_URL}${BASE}`);
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
  for (const dir of ["css", "js", "assets"]) await fs.cp(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true });
  // Bike Town: js/town.js + three.js in one minified file, loaded only on /town/
  await bundle({ entryPoints: [path.join(ROOT, "js/town.js")], bundle: true, minify: true, format: "esm", target: "es2020", outfile: path.join(DIST, "js/town.js"), legalComments: "eof", logLevel: "warning" });

  // Bikes from Cycle Beast. If the key is set but the feed can't be read, stop here so the
  // site that is already live stays up instead of being replaced.
  const catalog = await loadCatalog({ categories: data.categories });
  if (catalog) {
    const { images, stats } = await processPhotos(catalog.products, { cacheDir: path.join(CACHE, "img"), distDir: DIST });
    console.log(`Photos: ${stats.photos} (${stats.downloaded} downloaded, ${stats.cached} from cache${stats.failed.length ? `, ${stats.failed.length} failed` : ""})`);
    if (stats.failed.length) catalog.warnings.push(`${stats.failed.length} photo${stats.failed.length === 1 ? "" : "s"} couldn't be downloaded, so the original address is used: ${stats.failed.slice(0, 10).join("; ")}`);
    await write("js/catalog.js", `/* Bikes from Cycle Beast, ${new Date().toISOString()} */\nwindow.CC_CATALOG = ${JSON.stringify({ source: "Cycle Beast", fetchedAt: new Date().toISOString(), products: catalog.products, images })};\n`);
    const bikeCount = catalog.products.filter((p) => p.type === "bike").length;
    console.log(`Catalog: ${catalog.products.length} models (${bikeCount} bikes, ${catalog.products.length - bikeCount} part${catalog.products.length - bikeCount === 1 ? "" : "s"}), ${catalog.products.reduce((n, p) => n + p.variants.length, 0)} SKUs from Cycle Beast`);
    const typeLabel = (r) => (r.type === "part" ? `part: ${r.category}` : r.category);
    for (const r of catalog.summary) console.log(`  ${r.name.padEnd(34)} ${typeLabel(r).padEnd(15)} ${String(r.variants).padStart(2)} SKU  ${String(r.inStock).padStart(2)} in stock  ${r.photos} photos  (type from ${r.how})`);
    for (const w of catalog.warnings) console.log(`  ! ${w}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const rows = catalog.summary.map((r) => `| ${r.name} | ${typeLabel(r)} (${r.how}) | ₱${r.price.toLocaleString("en-PH")} | ${r.variants} | ${r.inStock} | ${r.photos} |`).join("\n");
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `## Products imported from Cycle Beast\n\n| Model | Type | From | SKUs | In stock | Photos |\n|---|---|---|---|---|---|\n${rows}\n\n${catalog.warnings.length ? "### Check these\n\n" + catalog.warnings.map((w) => `- ${w}`).join("\n") + "\n" : ""}`);
    }
  } else {
    console.log("Catalog: CATALOG_FEED_KEY is not set, so the placeholder bikes in js/data.js are used.");
  }

  // Blog posts (content/blog/*.md): the list for every page, and each post's text on its own
  const blog = await loadBlog(path.join(ROOT, "content/blog"));
  await write("js/blog.js", `/* Blog posts from content/blog/ */\nwindow.CC_BLOG = ${JSON.stringify({ posts: blog.posts.map(({ html, ...meta }) => meta) })};\n`);
  for (const p of blog.posts) await write(`blog-data/${p.slug}.json`, JSON.stringify({ html: p.html }));
  console.log(`Blog: ${blog.posts.length} post${blog.posts.length === 1 ? "" : "s"}`);
  for (const w of blog.warnings) console.log(`  ! ${w}`);

  // Page template: index.html with every relative URL pointed at BASE
  let template = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  template = template.replace(/(href|src)="(?!https?:|\/|#|data:|mailto:|tel:)([^"]*)"/g, (_, attr, val) =>
    `${attr}="${val === "./" ? BASE : BASE + val.replace(/^\.\//, "")}"`);
  const verify = data.site.verification || {};
  template = template.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />
  <meta name="cc-base" content="${BASE}" />
  <meta name="cc-site" content="${SITE_URL}" />${verify.google ? `
  <meta name="google-site-verification" content="${esc(verify.google)}" />` : ""}${verify.bing ? `
  <meta name="msvalidate.01" content="${esc(verify.bing)}" />` : ""}`);
  await write("index.html", template);

  await write("site.webmanifest", JSON.stringify({
    name: data.site.name, short_name: data.site.name, description: data.site.description,
    start_url: BASE, scope: BASE, display: "standalone", background_color: "#f7f6f2", theme_color: "#3c78c6",
    icons: [
      { src: `${BASE}assets/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${BASE}assets/icon-512.png`, sizes: "512x512", type: "image/png" }
    ]
  }, null, 2));
  await write(".nojekyll", "");

  // Serve dist/ and answer every page address with the template, so the app renders it
  const server = await startServer(DIST, BASE, async (rel) => (rel === "__blank/" ? "<!doctype html><title>blank</title>" : template));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => { window.__CC_PRERENDER__ = true; });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(origin + BASE);
  await page.waitForFunction(() => window.__CC__);
  const { routes, products, brandArt, posts } = await page.evaluate(() => window.__CC__);

  const snapshot = async (pagePath, { notFound = false, post = false } = {}) => {
    await page.goto(origin + BASE + pagePath);
    await page.waitForFunction((p) => document.documentElement.dataset.route === p, pagePath);
    if (post) await page.waitForSelector('.post-body[data-full="1"]', { timeout: 15000 });
    return page.evaluate((nf) => {
      const d = document.documentElement;
      delete d.dataset.route;
      document.getElementById("toasts").innerHTML = "";
      if (nf) document.querySelectorAll('link[rel="canonical"], meta[property="og:url"]').forEach((el) => el.remove());
      return "<!doctype html>\n" + d.outerHTML + "\n";
    }, notFound);
  };

  const report = [];
  for (const r of routes) {
    const html = await snapshot(r.path, { post: !!r.post });
    await write(path.join(r.path, "index.html"), html);
    report.push({ ...r, html });
  }
  await write("404.html", await snapshot("page-not-found/", { notFound: true }));
  if (errors.length) throw new Error("Page errors while rendering:\n" + errors.join("\n"));

  // Social share images (1200x630) and icons
  const shot = await context.newPage();
  await shot.goto(origin + BASE + "__blank/"); // same-origin blank page so fonts load
  const fontCss = `
    @font-face { font-family: Inter; font-weight: 800; font-style: italic; src: url(${BASE}assets/fonts/inter-latin-800-italic.woff2); }
    @font-face { font-family: Inter; font-weight: 800; src: url(${BASE}assets/fonts/inter-latin-800-normal.woff2); }
    @font-face { font-family: OS; font-weight: 400; src: url(${BASE}assets/fonts/open-sauce-sans-latin-400-normal.woff); }
    @font-face { font-family: OS; font-weight: 700; src: url(${BASE}assets/fonts/open-sauce-sans-latin-700-normal.woff2); }
    * { box-sizing: border-box; } body { margin: 0; }`;
  const tri = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='52' viewBox='0 0 60 52'%3E%3Cg fill='%233c78c6'%3E%3Cpath d='M15 1 L28 25 L2 25Z'/%3E%3Cpath d='M30 25 L43 1 L56 25Z' opacity='.55'/%3E%3Cpath d='M2 27 L28 27 L15 51Z' opacity='.35'/%3E%3Cpath d='M45 27 L58 51 L32 51Z' opacity='.75'/%3E%3C/g%3E%3C/svg%3E")`;
  const card = (left, right) => `<!doctype html><html><head><style>${fontCss}
    .og { width: 1200px; height: 630px; background: #eeebe3; color: #1c2126; font-family: OS, "DejaVu Sans", sans-serif; position: relative; overflow: hidden; display: grid; grid-template-columns: 600px 1fr; gap: 48px; padding: 56px; }
    .og::after { content: ""; position: absolute; right: 0; top: 0; width: 420px; height: 260px; background: ${tri}; background-size: 60px 52px; opacity: .22;
      -webkit-mask-image: linear-gradient(225deg, #000 10%, transparent 75%); }
    .panel { background: #fff; border-radius: 18px; display: grid; place-items: center; padding: 28px; }
    .panel svg { width: 100%; height: auto; }
    .info { display: flex; flex-direction: column; position: relative; z-index: 1; padding-top: 12px; }
    .eyebrow { font-weight: 700; font-size: 20px; letter-spacing: .14em; text-transform: uppercase; color: #3c78c6; }
    h1 { font: italic 800 64px/0.98 Inter, sans-serif; text-transform: uppercase; letter-spacing: -.02em; margin: 16px 0 0; }
    .price { font: 800 46px Inter, "DejaVu Sans", sans-serif; margin-top: 22px; }
    .price s { font: 400 26px OS, "DejaVu Sans", sans-serif; color: #7c8287; margin-left: 12px; }
    .sub { font-size: 26px; line-height: 1.35; margin-top: 22px; color: #4b5258; }
    .logo { margin-top: auto; height: 70px; width: auto; align-self: flex-start; }
    </style></head><body><div class="og"><div class="panel">${left}</div><div class="info">${right}<img class="logo" src="${BASE}assets/logo.svg"></div></div></body></html>`;

  const render = async (html, file, size = { width: 1200, height: 630 }, transparent = false) => {
    await shot.setViewportSize(size);
    await shot.setContent(html, { waitUntil: "load" });
    await shot.evaluate(() => document.fonts.ready);
    const buf = await shot.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, ...size } });
    await write(file, buf);
  };

  await render(card(brandArt, `<div class="eyebrow">cyclecentral.ph</div>
    <h1>Online bike shop in the Philippines</h1>
    <div class="sub">Road, gravel, mountain, city and electric bikes, plus parts and gear.</div>`), "assets/og-image.png");
  for (const p of products) {
    if (p.hasImage) continue; // real product photos are used directly
    await render(card(p.art, `<div class="eyebrow">${esc(p.category)}</div><h1>${esc(p.name)}</h1>
      <div class="price">${p.price}${p.compareAt ? `<s>${p.compareAt}</s>` : ""}</div>`), `og/products/${p.slug}.png`);
  }

  for (const p of posts || []) {
    const size = p.title.length > 70 ? 40 : p.title.length > 48 ? 48 : 58;
    await render(card(p.art, `<div class="eyebrow">${esc(data.site.name)} Blog</div><h1 style="font-size:${size}px">${esc(p.title)}</h1>`), `og/blog/${p.slug}.png`);
  }

  const favicon = await fs.readFile(path.join(ROOT, "assets/favicon.svg"), "utf8");
  const mark = (await fs.readFile(path.join(ROOT, "assets/mark.svg"), "utf8")).replace(/#3c78c6/g, "#eeebe3");
  const iconPage = (inner, bg = "transparent") => `<!doctype html><html><head><style>html,body{margin:0;background:${bg}}
    .i{width:100vw;height:100vh;display:grid;place-items:center} .i svg{width:var(--s,100%);height:auto;display:block}</style></head>
    <body><div class="i">${inner}</div></body></html>`;
  for (const s of [48, 192, 512]) await render(iconPage(favicon), s === 48 ? "assets/favicon-48.png" : `assets/icon-${s}.png`, { width: s, height: s }, true);
  await render(iconPage(`<div style="--s:68%;width:100%;display:grid;place-items:center">${mark}</div>`, "#3c78c6"), "assets/apple-touch-icon.png", { width: 180, height: 180 });
  await render(iconPage(`<div style="--s:88%;width:100%;display:grid;place-items:center">${favicon}</div>`, "#ffffff"), "assets/logo-512.png", { width: 512, height: 512 });

  await browser.close();
  server.close();

  // Sitemap and robots.txt
  // SKU pages point search engines at their model page, so only model pages go in the sitemap.
  // lastmod is the day a page's content last changed (kept in .cache/seo-state.json), not the
  // build date: search engines ignore lastmod on sites where it changes every hour.
  const indexable = report.filter((r) => !r.noindex && !r.variant);
  const stateFile = path.join(CACHE, "seo-state.json");
  let prev = null;
  try { prev = JSON.parse(await fs.readFile(stateFile, "utf8")); } catch { /* first build */ }
  if (prev && prev.site !== SITE_URL + BASE) prev = null;
  const pagesBefore = (prev && prev.pages) || {};
  const pagesNow = {};
  const changed = [];
  for (const r of indexable) {
    const h = r.html;
    const main = h.slice(h.indexOf("<main"), h.indexOf("</main>"));
    const head = [/<title>[\s\S]*?<\/title>/, /<meta name="description"[^>]*>/, /<script type="application\/ld\+json"[\s\S]*?<\/script>/].map((re) => (h.match(re) || [""])[0]).join("");
    const hash = crypto.createHash("sha1").update(head + main).digest("hex");
    const old = pagesBefore[r.path];
    pagesNow[r.path] = { hash, lastmod: old && old.hash === hash ? old.lastmod : today };
    if (!old || old.hash !== hash) changed.push(r.path);
  }
  const removed = Object.keys(pagesBefore).filter((k) => !pagesNow[k]);
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify({ site: SITE_URL + BASE, pages: pagesNow }));
  const abs = (rel) => (/^https?:/.test(rel) ? rel : `${SITE_URL}${BASE}${rel.replace(/^\.?\//, "")}`);
  await fs.writeFile(path.join(CACHE, "indexnow.json"), JSON.stringify({ host: new URL(SITE_URL).host, urls: [...changed, ...removed].map(abs) }));
  const xmlEsc = (t) => String(t).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${indexable.map((r) => `  <url><loc>${xmlEsc(abs(r.path))}</loc><lastmod>${pagesNow[r.path].lastmod}</lastmod>${(r.images || []).map((u) => `<image:image><image:loc>${xmlEsc(abs(u))}</image:loc></image:image>`).join("")}</url>`).join("\n")}
</urlset>
`);
  await write("robots.txt", `# ${data.site.name}: every page may be crawled\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}${BASE}sitemap.xml\n`);
  if (blog.posts.length) await write("blog/feed.xml", rssFeed(blog.posts, { site: data.site, abs }));
  // IndexNow key file (see scripts/indexnow.mjs)
  await write(`${INDEXNOW_KEY}.txt`, INDEXNOW_KEY);
  // Shopping feed for Google Merchant Center, Bing and Facebook/Instagram shops
  if (catalog) {
    const feed = productFeed(catalog.products, { site: data.site, abs, categories: data.categories, policies: data.policies || {} });
    await write("feeds/products.xml", feed.xml);
    console.log(`Feed: ${feed.count} SKUs in feeds/products.xml`);
  }

  // Basic checks so a broken page never ships
  const problems = [];
  const titles = new Map();
  for (const r of report) {
    const h = r.html;
    const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
    const h1s = (h.match(/<h1[\s>]/g) || []).length;
    if (!title) problems.push(`${r.path || "/"}: missing <title>`);
    if (!/<meta name="description" content="[^"]{50,}"/.test(h)) problems.push(`${r.path || "/"}: missing or short meta description`);
    if (!r.noindex && !h.includes('rel="canonical"')) problems.push(`${r.path || "/"}: missing canonical link`);
    if (h1s !== 1) problems.push(`${r.path || "/"}: has ${h1s} <h1> headings`);
    const ld = h.match(/<script type="application\/ld\+json" id="ld-json">([\s\S]*?)<\/script>/);
    try { JSON.parse(ld[1]); } catch { problems.push(`${r.path || "/"}: structured data is missing or invalid`); }
    if (title && !r.noindex && !r.variant) {
      if (titles.has(title)) problems.push(`${r.path || "/"}: same title as ${titles.get(title) || "/"}`);
      titles.set(title, r.path);
    }
    if (/src="https?:\/\/127\.0\.0\.1/.test(h)) problems.push(`${r.path || "/"}: links to the build's local server`);
  }
  if (problems.length) throw new Error("SEO checks failed:\n  " + problems.join("\n  "));

  console.log(`Done: ${report.length} pages (${report.filter((r) => r.variant).length} SKU pages), ${indexable.length} in sitemap (${changed.length} new or changed${prev ? "" : ", first build"}${removed.length ? `, ${removed.length} removed` : ""}), ${products.filter((p) => !p.hasImage).length} drawn share images.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
