// Tells Bing (which also feeds ChatGPT search and Copilot), Yandex, Naver and Seznam about pages
// that are new or changed since the last deploy, so they're recrawled within minutes instead
// of days. Google doesn't use IndexNow; it reads the sitemap's lastmod dates instead.
//
// Run by the GitHub workflow after each deploy: node scripts/indexnow.mjs
// The build writes the list of changed addresses to .cache/indexnow.json. The key is public
// by design: search engines check it against https://<site>/<key>.txt, which the build publishes.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INDEXNOW_KEY = "6f1c2b9e8a4d4f7b9c3e5a1d2b7f8e60";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  let job;
  try { job = JSON.parse(await fs.readFile(path.join(ROOT, ".cache/indexnow.json"), "utf8")); }
  catch { console.log("IndexNow: nothing to send (no list from the build)."); return; }
  const { host, urls } = job;
  if (!host || /^(localhost|127\.)/.test(host) || host.endsWith("github.io") && !process.env.INDEXNOW_ALLOW_GITHUB_IO) { console.log(`IndexNow: skipped for ${host || "unknown host"}.`); return; }
  if (!urls.length) { console.log("IndexNow: no pages changed."); return; }
  const body = { host, key: INDEXNOW_KEY, keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`, urlList: urls.slice(0, 10000) };
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    // 200/202 = accepted. 422/403 usually mean the key file isn't live yet (first deploy) and is harmless.
    console.log(`IndexNow: sent ${body.urlList.length} changed page${body.urlList.length === 1 ? "" : "s"}, reply HTTP ${res.status}.`);
  } catch (e) {
    console.log(`IndexNow: couldn't send (${e.message}). The sitemap still lists every page.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
