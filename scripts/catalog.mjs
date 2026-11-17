// Loads the bike catalog from Cycle Beast for the website build.
//
// Cycle Beast publishes every bike switched on for Cycle Central at
//   GET https://cycle-beast.vercel.app/api/feed/cycle-central?key=<CATALOG_FEED_KEY>
// with one row per SKU: sku, brand, model, year, color, size, price, srp,
// discountPercent, specs, description, highlights, photos, availability.
//
// This turns those rows into the website's product list:
//  - one product (one page) per brand + model (+ year when a model has several years)
//  - its colours and sizes as variants, each keeping its own SKU, price and availability
//  - a page address for every SKU: /products/<sku in lowercase>/
// Only the fields listed above are copied, so anything else the feed might carry
// never reaches the public site.
//
// Env:
//   CATALOG_FEED_KEY   the feed key (a GitHub repository secret). Without it the
//                      build keeps the placeholder bikes from js/data.js.
//   CATALOG_FEED_URL   optional, overrides the feed address
//   CATALOG_FEED_FILE  optional, read the feed from a local JSON file instead (for testing)

import fs from "node:fs/promises";

export const DEFAULT_FEED_URL = "https://cycle-beast.vercel.app/api/feed/cycle-central";

/** @returns {Promise<{products: object[], warnings: string[], summary: object[], source: string} | null>} */
export async function loadCatalog({ categories, env = process.env }) {
  let raw, source;
  if (env.CATALOG_FEED_FILE) {
    raw = JSON.parse(await fs.readFile(env.CATALOG_FEED_FILE, "utf8"));
    source = `file ${env.CATALOG_FEED_FILE}`;
  } else if (env.CATALOG_FEED_KEY) {
    const base = env.CATALOG_FEED_URL || DEFAULT_FEED_URL;
    const { key, shape } = cleanKey(env.CATALOG_FEED_KEY);
    raw = await fetchFeed(base, key, shape);
    source = base;
  } else {
    return null;
  }
  const rows = extractRows(raw);
  if (!rows.length) throw new Error("The Cycle Beast feed returned no bikes. Check that bikes are switched on for Cycle Central.");
  return { ...normalize(rows, categories, source.startsWith("http") ? new URL(source).origin : null), source };
}

// The secret should be just the key. Accept the common paste mistakes too: spaces, line breaks
// or quotes around it, "CATALOG_FEED_KEY=...", or the whole feed address with ?key=...
export function cleanKey(raw) {
  let k = String(raw ?? "").trim().replace(/^(["'])(.*)\1$/s, "$2").trim();
  let shape = "plain key";
  if (/^https?:\/\//i.test(k)) {
    try { const v = new URL(k).searchParams.get("key"); if (v) { k = v.trim(); shape = "feed address, key taken from ?key="; } else shape = "an address without ?key="; } catch { shape = "an address that couldn't be read"; }
  } else if (/^[A-Z][A-Z0-9_]*\s*=/.test(k)) {
    k = k.replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, "").trim().replace(/^(["'])(.*)\1$/s, "$2").trim();
    shape = "NAME=value, value used";
  } else if (/^key=/i.test(k)) {
    k = k.slice(4).trim(); shape = "key=value, value used";
  }
  if (/\s/.test(k)) shape += ", contains spaces or line breaks inside";
  return { key: k, shape };
}

async function fetchFeed(base, key, shape = "plain key") {
  const u = new URL(base);
  u.searchParams.set("key", key);
  const shown = `${u.origin}${u.pathname}?key=***`; // never print the key
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(u, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (res.status === 401 || res.status === 403) {
        // Show the start of the reply (never the key) so it's clear who refused: Cycle Beast, or Vercel's login wall
        const body = (await res.text().catch(() => "")).replaceAll(key, "***");
        const vercelWall = /vercel\.com\/(sso|login)|vercel authentication|_vercel_sso|deployment protection/i.test(body) || res.headers.get("set-cookie")?.includes("_vercel_sso");
        const said = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
        const hint = vercelWall
          ? "Vercel's Deployment Protection is blocking the request before it reaches Cycle Beast. Turn protection off for the production domain, or allow this path, in the Vercel project settings."
          : "Check that the CATALOG_FEED_KEY secret on GitHub exactly matches CATALOG_FEED_KEY in Cycle Beast's Vercel environment variables, and that Cycle Beast was redeployed after the key was set.";
        throw Object.assign(new Error(`Cycle Beast refused the feed key (HTTP ${res.status}) at ${shown} (secret read as: ${shape}; key length ${key.length}). Reply: "${said || "(empty)"}". ${hint}`), { final: true });
      }
      if (!res.ok) throw new Error(`Cycle Beast feed returned HTTP ${res.status} at ${shown}`);
      const text = await res.text();
      try { return JSON.parse(text); } catch { throw new Error(`Cycle Beast feed at ${shown} did not return JSON (starts with: ${text.slice(0, 60).replace(/\s+/g, " ")})`); }
    } catch (err) {
      lastError = err;
      if (err.final) break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
  throw new Error(String(lastError && lastError.message ? lastError.message : lastError).replaceAll(key, "***"));
}

// The rows may come as a list, or wrapped in an object
function extractRows(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const k of ["bikes", "products", "items", "data", "results", "feed"]) if (Array.isArray(raw[k])) return raw[k];
  }
  throw new Error("The Cycle Beast feed is not a list of bikes (expected an array, or an object with a 'bikes' or 'products' list).");
}

/* ---------- small helpers ---------- */
const str = (v) => (v == null ? "" : String(v).trim());
const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = str(v).replace(/[^\d.-]/g, "");
  return s ? (Number.isFinite(+s) ? +s : null) : null;
};
const slugify = (t) => t.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const titleCase = (k) => k.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
const uniq = (a) => [...new Set(a)];

// Specs: accept { Frame: "..." }, [{ label, value }], or ["Frame: ..."]
const SPEC_ALIASES = {
  frameset: "Frame", "frame material": "Frame", frame: "Frame", fork: "Fork", suspension: "Suspension", "rear shock": "Suspension",
  groupset: "Groupset", drivetrain: "Groupset", "rear derailleur": "Rear derailleur", shifters: "Shifters", gears: "Gearing", gearing: "Gearing", speeds: "Gearing",
  brakes: "Brakes", brake: "Brakes", brakeset: "Brakes", wheels: "Wheels", wheelset: "Wheels", rims: "Wheels",
  tires: "Tires", tyres: "Tires", tire: "Tires", tyre: "Tires", weight: "Weight", motor: "Motor", battery: "Battery", range: "Range"
};
function normSpecs(specs, warn, label) {
  const out = {};
  const put = (k, v) => {
    const key = SPEC_ALIASES[str(k).toLowerCase()] || titleCase(str(k));
    let val = typeof v === "number" ? String(v) : Array.isArray(v) ? v.map(str).filter(Boolean).join(", ") : str(v);
    if (key === "Weight" && /^\d+(\.\d+)?$/.test(val)) val += " kg";
    if (key && val && !(key in out)) out[key] = val;
  };
  if (!specs) return out;
  if (Array.isArray(specs)) {
    for (const s of specs) {
      if (typeof s === "string") { const m = /^([^:]+):\s*(.+)$/.exec(s); if (m) put(m[1], m[2]); }
      else if (s && typeof s === "object") put(s.label ?? s.name ?? s.key ?? s.title, s.value ?? s.val ?? s.text);
    }
  } else if (typeof specs === "object") {
    for (const [k, v] of Object.entries(specs)) if (v != null && typeof v !== "object") put(k, v); else if (Array.isArray(v)) put(k, v);
  } else warn(`${label}: specs were not a list or object, so they were skipped`);
  return out;
}
function normList(v) {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x && (x.text ?? x.label ?? x.title))).map(str).filter(Boolean);
  return str(v).split(/\r?\n|•/).map((x) => x.replace(/^[-*\s]+/, "").trim()).filter(Boolean);
}
function normPhotos(v, origin) {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return uniq(list.map((x) => str(typeof x === "string" ? x : x && (x.url ?? x.src ?? x.href))).filter(Boolean).map((u) => {
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("//")) return "https:" + u;
    return origin ? new URL(u, origin).href : "";
  }).filter(Boolean));
}
// "in_stock", "out_of_stock", "available_for_order", 3, true, { status, quantity } ...
function normAvailability(a) {
  if (a == null || a === "") return { inStock: false, qty: null, known: false };
  if (typeof a === "boolean") return { inStock: a, qty: null, known: true };
  if (typeof a === "number") return { inStock: a > 0, qty: Math.max(0, Math.floor(a)), known: true };
  if (typeof a === "object") {
    const qty = num(a.quantity ?? a.qty ?? a.count ?? a.onHand ?? a.available ?? a.stock);
    const st = a.status ?? a.state ?? a.availability;
    if (st != null) { const r = normAvailability(st); return { ...r, qty: qty ?? r.qty, inStock: qty != null ? qty > 0 : r.inStock }; }
    if (a.inStock != null) return { inStock: !!a.inStock, qty, known: true };
    if (qty != null) return { inStock: qty > 0, qty, known: true };
    return { inStock: false, qty: null, known: false };
  }
  const s = str(a).toLowerCase().replace(/[\s-]+/g, "_");
  const n = /(\d+)/.exec(s);
  if (/(out|sold|unavail|no_stock|zero|order|pre_?order|back_?order|incoming)/.test(s)) return { inStock: false, qty: 0, known: true };
  if (/(in_stock|instock|available|yes|ready|on_hand|stock)/.test(s)) return { inStock: true, qty: n ? +n[1] : null, known: true };
  return { inStock: false, qty: null, known: false };
}

// Colour swatches from colour names ("Dark Oath Black Waves" -> black)
const COLOR_WORDS = [
  ["black", "#1c2126"], ["charcoal", "#2b3036"], ["onyx", "#1c2126"], ["white", "#f2f1ec"], ["pearl", "#eeece4"], ["ivory", "#efe9d8"],
  ["grey", "#8a9097"], ["gray", "#8a9097"], ["gunmetal", "#53585e"], ["graphite", "#4a4f55"], ["silver", "#c3c7cc"], ["chrome", "#c3c7cc"], ["mirror", "#c3c7cc"],
  ["titanium", "#8c8d8f"], ["red", "#d64545"], ["crimson", "#a8323b"], ["orange", "#e8742a"], ["yellow", "#e9c46a"], ["gold", "#c9a227"],
  ["olive", "#6b705c"], ["army", "#5b6145"], ["khaki", "#a39d7e"], ["mint", "#9cc5a1"], ["sage", "#9caf88"], ["green", "#3f8a5a"],
  ["teal", "#2a9d8f"], ["turquoise", "#2fb3a7"], ["navy", "#1d3557"], ["sky", "#7fb3e0"], ["cobalt", "#2f5fb3"], ["blue", "#3c78c6"],
  ["purple", "#7b5ea7"], ["violet", "#7b5ea7"], ["lavender", "#b8a6d9"], ["pink", "#e58fa8"], ["rose", "#d97a8f"],
  ["brown", "#92694b"], ["bronze", "#9c6b3f"], ["copper", "#b5653a"], ["beige", "#d8ccb4"], ["sand", "#ddbea9"], ["cream", "#eeebe3"]
];
function colorHex(name) {
  const n = name.toLowerCase();
  let best = null;
  for (const [w, hex] of COLOR_WORDS) { const i = n.search(new RegExp(`\\b${w}`)); if (i >= 0 && (!best || i < best.i)) best = { i, hex }; }
  if (best) return best.hex;
  let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ["#3c78c6", "#92694b", "#6b705c", "#457b9d", "#8a9097"][h % 5];
}

// Size order: XXS < XS < S < M < L < XL, then numbers
const SIZE_ORDER = ["XXS", "XS", "S", "SM", "S/M", "M", "ML", "M/L", "L", "XL", "XXL"];
function sortSizes(sizes) {
  const rank = (s) => { const i = SIZE_ORDER.indexOf(s.toUpperCase()); if (i >= 0) return i; const n = parseFloat(s); return Number.isFinite(n) ? 100 + n : 1000; };
  return [...sizes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// ---------- What each model is ----------
// A `category` (or `type`) field in the feed always wins. Otherwise, in this order:
//  1. tires, tubes and other parts go to Parts & Gear (known parts brands, part names, tire specs)
//  2. e-bikes: a real motor or e-bike battery in the specs, or an e-bike model name (Rail+, Moterra Neo ...)
//  3. well-known model families (Domane is road, Marlin is mountain ...), from the name only
//  4. otherwise the words in the name, description and highlights; most mentions wins
const plain = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const count = (t, re) => (t.match(re) || []).length;

// A feed category, in whatever words Cycle Beast uses
const FEED_CATEGORY = [
  ["wheels", /tire|tyre|tube|wheel|rim\b/], ["gear", /helmet|apparel|cloth|accessor|gear|light|computer|shoe|eyewear/],
  ["components", /component|\bparts?\b|groupset|drivetrain|brake|cockpit|saddle|pedal/],
  ["electric", /e-?bike|electric|e-?mtb|pedelec/], ["folding", /fold/], ["gravel", /gravel|cyclo|\bcx\b|all-?road/],
  ["mountain", /mountain|mtb|trail|enduro|\bxc\b|downhill/], ["road", /road|race|aero|endurance|triathlon|\btt\b/],
  ["city", /city|urban|hybrid|commut|comfort|cruiser|fitness|trekking/]
];

// Brands that make parts, not bikes
const PART_BRANDS = [
  ["wheels", /^(michelin|continental|schwalbe|maxxis|pirelli|vittoria|panaracer|kenda|hutchinson|challenge|goodyear|irc|tufo|cst|chaoyang|zipp|enve|dt swiss|mavic|fulcrum|hunt|roval|stan'?s( no ?tubes)?|orange seal)$/],
  ["gear", /^(giro|kask|poc|met|abus|lazer|oakley|rudy project|rapha|castelli|assos|sportful|garmin|wahoo|hammerhead|bryton|igpsport|magicshine|lezyne|topeak|elite|tacx|camelbak|ortlieb|apidura|restrap)$/],
  ["components", /^(shimano|sram|campagnolo|fsa|praxis|fizik|prologo|selle italia|selle smp|thomson|deda|crankbrothers|wolf tooth|kmc|fox|rockshox|ohlins|magura|hope|trp|tektro|chris king|ceramicspeed|absoluteblack)$/]
];
// Part words in a product's own name
const PART_NAMES = [
  ["wheels", /\b(tires?|tyres?|inner tubes?|tubes?|tubeless|clinchers?|tubulars?|wheelsets?|rims?|hubs?|sealant|rim tape)\b/],
  ["gear", /\b(helmets?|shoes?|jerseys?|bibs?|jackets?|gloves?|socks|sunglasses|eyewear|lights?|bike computers?|gps|bottles?|bottle cages?|bags?|pumps?|locks?|multi-?tools?|bells?|racks?|fenders?|mudguards?|kickstands?|trainers?)\b/],
  ["components", /\b(groupsets?|derailleurs?|cranksets?|cassettes?|chains?|chainrings?|brakes?|calipers?|rotors?|shifters?|handlebars?|stems?|saddles?|seat ?posts?|pedals?|headsets?|bottom brackets?|grips?|bar tape)\b/]
];
const TIRE_SPEC = /^(tpi|bead|casing|compound|etrto|tread( pattern)?|(max(imum)? )?(tire )?pressure|tubeless( ready)?|puncture protection|rubber)$/i;
// Specs that only a bike (or a frameset) has
const looksLikeBike = (specs) => !!specs.Frame && ["Fork", "Groupset", "Rear derailleur", "Shifters", "Gearing", "Suspension", "Brakes", "Wheels", "Tires", "Motor", "Headset"].some((k) => specs[k]);

// E-bikes. Electronic shifting has a battery too (SRAM AXS, Shimano Di2), so a battery or motor
// only counts when it's really an e-bike system.
const NO_VALUE = /^(n\/?a|none|no|nil|null|-+|—|0|not applicable|not included)$/i;
const SHIFT_POWER = /\b(axs|di2|e-?tap|eps|derailleurs?|shift\w*|wireless|coin|cr\d{4}|lights?|computer|radar)\b/i;
const EBIKE_SYSTEM = /\b(\d{3,4}\s*wh|bosch|power ?tube|steps|ep\s?\d+|e\d{4}|fazua|tq|yamaha|brose|mahle|bafang|ananda|energypak|range extender|\d+\s*nm|\d{3}\s*w|watts?|hub motor|mid[- ]?drive|drive unit|pedal[- ]assist)\b/i;
const realEbikeSpec = (v) => !!v && !NO_VALUE.test(v.trim()) && !SHIFT_POWER.test(v) && EBIKE_SYSTEM.test(v);
const EBIKE_NAME = /[a-z]\+(?=\s|\d|$)|\be\+|\be-?(bike|mtb)s?\b|\bpowerfly\b|\bexe\b|\bturbo (levo|vado|creo|kenevo|como|tero)\b|\bmoterra\b|^cannondale\b.*\bneo\b/;

// Model families whose type is well known (matched against the name only)
const KNOWN_MODELS = [
  ["gravel", /\b(revolt|devote|grail|grizl|checkpoint|checkmate|topstone|diverge|crux|aspero|silex|warbird|superx|super x|boone|crockett|g3x|g4x)\b/],
  ["road", /\b(tcr|defy|propel|contend|avail|langma|envie|fuoco|tarmac|allez|aethos|roubaix|venge|emonda|domane|madone|speed concept|aeroad|ultimate|endurace|caad ?\d*|supersix|systemsix|synapse|lab71|c\d{2}|v\d ?rs|steelnovo|master|arabesque|dogma|addict|foil|caledonia|soloist|oltre|specialissima|scultura|reacto)\b/],
  ["mountain", /\b(talon|trance|reign|fathom|stance|anthem|tempt|xtc|marlin|procaliber|supercaliber|fuel ex|top fuel|slash|remedy|session|roscoe|x-?caliber|820|habit|trail|scalpel|jekyll|f-?si|rockhopper|stumpjumper|epic|chisel|fuse|enduro|spectral|neuron|lux|grand canyon|exceed|spark|genius|ransom)\b/],
  ["city", /\b(escape|roam|fastroad|sirrus|fx|verve|dual sport|district|allant|quick|treadwell|adventure|bad boy|townie|crossrip)\b/],
  ["folding", /\b(brompton|dahon|tern|birdy|neo)\b/]
];
// Words in the name, description and highlights; the type with the most mentions wins (ties go to the earlier one)
const TYPE_WORDS = [
  ["electric", /\b(e-?bikes?|e-?mtbs?|electric (bike|bicycle|mountain bike|road bike|gravel bike|hybrid|assist)s?|pedal[- ]assist\w*|pedelec)\b/g],
  ["folding", /\b(folding (bike|bicycle|frame)s?|foldable|folds? (up|down|away|flat|in half|small|in seconds))\b/g],
  ["gravel", /\b(gravel|all-?road|adventure (road|bike|riding)|cyclo-?cross|cx|bikepacking)\b/g],
  ["mountain", /\b(mountain|mtb|trails?|singletrack|enduro|cross-?country|xc|downhill|hardtail|full[- ]suspension|dropper)\b/g],
  ["road", /(?<![\w-])(road|race|racing|aero|endurance|criterium|crit|peloton|climbing)\b/g],
  ["city", /\b(city|urban|commut\w*|hybrid|comfort|cruiser|trekking|fitness|errands)\b/g]
];
const FRAMESET = /\b(frame ?set|frame only|frame kit|frame and fork)\b/;

// -> { type: "bike" | "part", id, how, frameset }
function classify({ brand, name, description, highlights, specs, explicit }, categories) {
  const typeOf = new Map(categories.map((c) => [c.id, c.type]));
  const has = (id) => typeOf.has(id);
  const out = (id, how) => ({ type: typeOf.get(id) === "part" ? "part" : "bike", id, how, frameset: typeOf.get(id) !== "part" && FRAMESET.test(nm) });
  const nm = plain(name), br = plain(brand), prose = plain([description, ...highlights].join(" ")), specText = plain(Object.values(specs).join(" "));
  const bikeSpecs = looksLikeBike(specs);

  if (explicit) {
    const e = plain(explicit);
    if (has(e)) return out(e, "feed category");
    for (const [id, re] of FEED_CATEGORY) if (has(id) && re.test(e)) return out(id, "feed category");
  }
  if (!bikeSpecs) {
    for (const [id, re] of PART_BRANDS) if (has(id) && re.test(br)) return out(id, `${brand} makes parts`);
    for (const [id, re] of PART_NAMES) if (has(id) && re.test(nm)) return out(id, "part name");
    if (has("wheels") && Object.keys(specs).filter((k) => TIRE_SPEC.test(k)).length >= 2) return out("wheels", "tire specs");
    const tires = count(prose, /\b(tires?|tyres?)\b/g);
    if (has("wheels") && tires >= 3 && tires > count(prose, /\b(bikes?|bicycles?|frames?)\b/g)) return out("wheels", "tire description");
  }
  if (has("electric")) {
    if (realEbikeSpec(specs.Motor) || realEbikeSpec(specs.Battery)) return out("electric", "motor in specs");
    if (EBIKE_NAME.test(nm)) return out("electric", "e-bike name");
  }
  for (const [id, re] of KNOWN_MODELS) if (has(id) && re.test(nm)) return out(id, "model name");
  let best = null;
  for (const [id, re] of TYPE_WORDS) {
    if (!has(id)) continue;
    const score = count(nm, re) * 4 + count(prose, re) + count(specText, re) * 0.5;
    if (score > 0 && (!best || score > best.score)) best = { id, score };
  }
  if (best) return out(best.id, "description");
  const bikes = categories.filter((c) => c.type === "bike").map((c) => c.id);
  return out(has("other") ? "other" : bikes[0], "not recognised");
}
// Drawing for a part without photos
function partIcon(id, name) {
  const n = plain(name);
  for (const [icon, re] of [["tire", /tire|tyre|tube|michelin|continental|schwalbe|maxxis|pirelli|vittoria/], ["wheel", /wheel|rim|hub/], ["helmet", /helmet/], ["computer", /computer|gps/], ["light", /light/], ["bottle", /bottle|cage/], ["brake", /brake|rotor|caliper/], ["bar", /bar|stem|post|saddle/]]) if (re.test(n)) return icon;
  return { wheels: "tire", gear: "helmet", components: "gear" }[id] || "gear";
}
const TERRAIN_FOR = { road: "road", gravel: "mixed", mountain: "trail", city: "city", folding: "city", electric: "city", other: null };

// Safe page address for a SKU: lowercase, and only letters, digits, dot, dash and underscore
function skuPath(sku, warn) {
  const lower = sku.toLowerCase().trim();
  const safe = lower.replace(/\s+/g, "-").replace(/[^a-z0-9._~-]/g, "-");
  if (safe !== lower) warn(`SKU "${sku}" has characters that can't be in a web address; its page is /products/${safe}/`);
  return safe;
}

/* ---------- main ---------- */
export function normalize(rows, categories, origin) {
  const warnings = [];
  const warn = (m) => warnings.push(m);
  const seenSku = new Set();
  const groups = new Map();

  rows.forEach((r, i) => {
    const sku = str(r.sku);
    const brand = str(typeof r.brand === "object" && r.brand ? r.brand.name : r.brand);
    const model = str(r.model ?? r.modelName ?? r.name);
    const label = sku || `row ${i + 1}`;
    if (!sku) return warn(`Row ${i + 1} (${brand} ${model}) has no SKU, so it was skipped`);
    if (seenSku.has(sku.toLowerCase())) return warn(`SKU ${sku} appears twice; only the first row was used`);
    if (!model) return warn(`${label} has no model name, so it was skipped`);
    const srp = num(r.srp);
    let price = num(r.price);
    const pct = num(r.discountPercent);
    if (price == null && srp != null) price = pct > 0 ? Math.round(srp * (1 - pct / 100)) : srp;
    if (price == null || price <= 0) return warn(`${label} has no price, so it was skipped`);
    seenSku.add(sku.toLowerCase());
    const year = num(r.year);
    const key = [brand.toLowerCase(), model.toLowerCase(), year ?? ""].join("|");
    if (!groups.has(key)) groups.set(key, { brand, model, year, rows: [] });
    groups.get(key).rows.push({
      r, sku, price, srp: srp && srp > price ? srp : null,
      color: str(r.color) || "Standard", size: str(r.size),
      avail: normAvailability(r.availability), photos: normPhotos(r.photos, origin), label
    });
  });

  // Models sold in more than one year get the year in their name
  const yearsByModel = new Map();
  for (const g of groups.values()) { const k = `${g.brand}|${g.model}`.toLowerCase(); yearsByModel.set(k, (yearsByModel.get(k) || 0) + 1); }

  const products = [];
  const summary = [];
  const noPhotos = [];
  const skuPaths = new Set();
  for (const g of groups.values()) {
    const first = g.rows[0].r;
    const showYear = yearsByModel.get(`${g.brand}|${g.model}`.toLowerCase()) > 1 && g.year;
    const base = g.brand && !g.model.toLowerCase().startsWith(g.brand.toLowerCase()) ? `${g.brand} ${g.model}` : g.model;
    const name = showYear ? `${base} (${g.year})` : base;
    const pick = (f) => { for (const x of g.rows) { const v = f(x.r); if (v && (!Array.isArray(v) || v.length) && (typeof v !== "object" || Array.isArray(v) || Object.keys(v).length)) return v; } return null; };
    const specs = normSpecs(pick((r) => r.specs), warn, name);
    const description = (() => { const d = pick((r) => r.description); return Array.isArray(d) ? d.map(str).filter(Boolean).join("\n\n") : str(d); })();
    const highlights = normList(pick((r) => r.highlights) || []);
    const explicit = str(pick((r) => r.category ?? r.type ?? r.bikeType) || specs.Type || specs.Category || specs["Bike Type"] || "");
    const cat = classify({ brand: g.brand, name, description, highlights, specs, explicit }, categories);

    // Colours keep the order they first appear in; each gets its own photos
    const colorNames = uniq(g.rows.map((x) => x.color));
    const colors = colorNames.map((cn) => ({ name: cn, hex: colorHex(cn), photos: uniq(g.rows.filter((x) => x.color === cn).flatMap((x) => x.photos)) }));
    const sizes = sortSizes(uniq(g.rows.map((x) => x.size)));
    const variants = [];
    for (const x of g.rows) {
      const color = colorNames.indexOf(x.color);
      if (variants.some((v) => v.color === color && v.size === x.size)) warn(`${name}: SKUs share colour "${x.color}" and size "${x.size || "none"}" (${x.sku}); shoppers pick the first one, but its own page still works`);
      const path = skuPath(x.sku, warn);
      if (skuPaths.has(path)) { warn(`SKU ${x.sku} gives the same page address as another SKU (/products/${path}/); it was skipped`); continue; }
      skuPaths.add(path);
      variants.push({ sku: x.sku, path, color, size: x.size, price: x.price, compareAt: x.srp || undefined, inStock: x.avail.inStock, qty: x.avail.qty });
      if (!x.avail.known) warn(`${x.sku}: availability "${str(x.r.availability)}" wasn't recognised, so it's shown as available to order`);
    }
    if (!variants.length) continue;
    const prices = variants.map((v) => v.price);
    const cheapest = variants.reduce((a, b) => (b.price < a.price ? b : a));
    const known = variants.filter((v) => v.inStock && v.qty != null);
    const photos = uniq(colors.flatMap((c) => c.photos));
    products.push({
      id: "", slug: slugify(name), type: cat.type, category: cat.id, frameset: cat.frameset || undefined, icon: cat.type === "part" ? partIcon(cat.id, name) : undefined, name, brand: g.brand, model: g.model, year: g.year ?? undefined,
      price: Math.min(...prices), priceFrom: new Set(prices).size > 1 || undefined, compareAt: cheapest.compareAt,
      description: description || undefined, highlights: highlights.length ? highlights : undefined,
      specs, photos, colors, sizes, variants,
      stock: known.length ? known.reduce((s, v) => s + v.qty, 0) : undefined,
      orderOnly: variants.every((v) => !v.inStock) || undefined,
      fit: cat.type === "bike" ? { terrain: TERRAIN_FOR[cat.id] ?? null, goal: null, level: null } : undefined,
      source: "cycle-beast"
    });
    if (cat.how === "not recognised") warn(`${name}: bike type not recognised, listed under "${cat.id}". Add a category to this bike in Cycle Beast to fix it.`);
    if (!photos.length) noPhotos.push(name);
    summary.push({ name, type: cat.type, category: cat.id + (cat.frameset ? " frameset" : ""), how: cat.how, price: Math.min(...prices), variants: variants.length, inStock: variants.filter((v) => v.inStock).length, photos: photos.length });
  }

  if (noPhotos.length) warn(`${noPhotos.length} model${noPhotos.length === 1 ? " has" : "s have"} no photos yet, so a drawing is shown: ${noPhotos.join(", ")}`);

  // Each model's own page address must not clash with a SKU page or another model
  const taken = new Set(skuPaths);
  for (const p of products) {
    let s = p.slug || "bike", n = 2;
    if (taken.has(s)) s = `${p.slug}-bike`;
    while (taken.has(s)) s = `${p.slug}-${n++}`;
    taken.add(s); p.slug = s; p.id = s;
  }
  return { products, warnings, summary };
}
