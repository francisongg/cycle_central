// Blog posts for the website build.
//
// Each post is a Markdown file in content/blog/, named YYYY-MM-DD-the-address.md, starting with:
//
//   ---
//   title: Rainy season bike care
//   description: One or two sentences for Google and the blog list.
//   date: 2026-11-18
//   updated: 2026-11-20          (optional)
//   author: Cycle Central team   (optional)
//   tags: [Maintenance, Tips]    (optional)
//   category: road               (optional: road, gravel, mountain, city, electric, folding;
//                                 sets the drawing at the top)
//   ---
//
// The rest is Markdown. To show live products with today's prices, put a line like this on its own:
//   {{products category="road" max="60000" limit="4"}}
//   {{products brand="Michelin" limit="3"}}
// (any of: category, brand, max, min, limit, sort="low" | "high")
//
// The build turns posts into /blog/ and /blog/<address>/ pages, an RSS feed and share images.
import fs from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

const str = (v) => (v == null ? "" : String(v).trim());
const unquote = (v) => str(v).replace(/^(["'])(.*)\1$/s, "$2");

function frontMatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src };
  const data = {};
  let listKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) { data[listKey].push(unquote(item[1])); continue; }
    const kv = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === "") { data[k] = []; listKey = k; continue; }
    listKey = null;
    data[k] = /^\[.*\]$/.test(v.trim()) ? v.trim().slice(1, -1).split(",").map(unquote).filter(Boolean) : unquote(v);
  }
  return { data, body: src.slice(m[0].length) };
}

// {{products category="road" max="60000"}} -> a placeholder the site fills with live product cards
function shortcodes(md) {
  return md.replace(/^\s*\{\{\s*products\s*([^}]*)\}\}\s*$/gm, (_, args) => {
    const attrs = {};
    for (const a of args.matchAll(/([a-z]+)\s*=\s*"([^"]*)"/gi)) attrs[a[1].toLowerCase()] = a[2];
    const data = Object.entries(attrs).filter(([k]) => ["category", "brand", "max", "min", "limit", "sort"].includes(k)).map(([k, v]) => `data-${k}="${v.replace(/"/g, "&quot;")}"`).join(" ");
    return `\n<div class="post-products" ${data}></div>\n`;
  });
}

const isoDate = (v) => { const s = str(v); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };

/** @returns {Promise<{ posts: object[], warnings: string[] }>} newest first */
export async function loadBlog(dir) {
  const warnings = [];
  let files = [];
  try { files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md") && !f.startsWith("_")); } catch { return { posts: [], warnings }; }
  const posts = [];
  const seen = new Set();
  for (const f of files.sort()) {
    const src = await fs.readFile(path.join(dir, f), "utf8");
    const { data, body } = frontMatter(src);
    const fromName = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/.exec(f);
    const slug = str(data.slug || (fromName ? fromName[2] : f.replace(/\.md$/, ""))).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    const date = isoDate(data.date) || (fromName ? fromName[1] : "");
    const title = str(data.title);
    if (!title || !date) { warnings.push(`${f}: needs a title and a date (YYYY-MM-DD), so it was skipped`); continue; }
    if (seen.has(slug)) { warnings.push(`${f}: another post already uses the address /blog/${slug}/, so it was skipped`); continue; }
    if (date > new Date().toISOString().slice(0, 10)) { warnings.push(`${f}: dated ${date}, so it stays hidden until then`); continue; }
    seen.add(slug);
    const html = marked.parse(shortcodes(body), { gfm: true, breaks: false })
      .replace(/<h1(\s|>)/g, "<h2$1").replace(/<\/h1>/g, "</h2>")      // the page title is the only h1
      .replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = text.split(" ").length;
    let description = str(data.description);
    if (!description) { description = text.slice(0, 155).replace(/\s+\S*$/, "") + "…"; warnings.push(`${f}: no description, so the first sentence is used. Add one for Google.`); }
    posts.push({
      slug, title, description, date, updated: isoDate(data.updated) || date,
      author: str(data.author) || "Cycle Central team",
      tags: Array.isArray(data.tags) ? data.tags : str(data.tags) ? str(data.tags).split(",").map(str) : [],
      category: str(data.category).toLowerCase(),
      readMins: Math.max(1, Math.round(words / 220)),
      html
    });
  }
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
  return { posts, warnings };
}

export function rssFeed(posts, { site, abs }) {
  const x = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${x(site.name)} Blog</title>
    <link>${x(abs("blog/"))}</link>
    <atom:link href="${x(abs("blog/feed.xml"))}" rel="self" type="application/rss+xml" />
    <description>${x(`Bike buying guides, care tips and riding in the Philippines from ${site.name}.`)}</description>
    <language>${x(site.language || "en")}</language>
${posts.slice(0, 30).map((p) => `    <item>
      <title>${x(p.title)}</title>
      <link>${x(abs(`blog/${p.slug}/`))}</link>
      <guid isPermaLink="true">${x(abs(`blog/${p.slug}/`))}</guid>
      <pubDate>${new Date(p.date + "T08:00:00+08:00").toUTCString()}</pubDate>
      <description>${x(p.description)}</description>
${p.tags.map((t) => `      <category>${x(t)}</category>`).join("\n")}
    </item>`).join("\n")}
  </channel>
</rss>
`;
}
