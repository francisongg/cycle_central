(function () {
  "use strict";

  const D = window.CC_DATA;
  // Bikes from Cycle Beast (js/catalog.js, written by the build). Until it's set up, the
  // placeholder products in js/data.js are shown.
  const CATALOG = window.CC_CATALOG;
  if (CATALOG && Array.isArray(CATALOG.products) && CATALOG.products.length) D.products = CATALOG.products;
  // Only show categories that have something in them
  D.categories = D.categories.filter((c) => D.products.some((p) => p.category === c.id));
  const HAS_PARTS = D.products.some((p) => p.type !== "bike");
  const { icon, bikeSVG, partSVG } = window.CC_ART;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const peso = (n) => "₱" + Math.round(n).toLocaleString("en-PH");
  const pesoK = (n) => (n >= 1000 ? "₱" + (n / 1000).toLocaleString("en-PH", { maximumFractionDigits: 1 }) + "k" : peso(n));
  const byId = (id) => D.products.find((p) => p.id === id);
  const catOf = (id) => D.categories.find((c) => c.id === id);
  const isBike = (p) => p.type === "bike";
  const lcFirst = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* =======================================================
     ADDRESSES (real page URLs; "hash" mode for the Claude preview)
     ======================================================= */
  const metaContent = (n) => { const m = document.querySelector(`meta[name="${n}"]`); return m ? m.content : null; };
  const MODE = metaContent("cc-router") === "hash" ? "hash" : "path";
  const BASE = metaContent("cc-base") || "/";
  const SITE = (metaContent("cc-site") || D.site.url).replace(/\/$/, "");
  const PRERENDER = !!window.__CC_PRERENDER__; // set by the build while it saves each page

  const slugify = (t) => t.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  (function assignSlugs() {
    const used = new Set();
    D.products.forEach((p) => {
      const base = p.slug || slugify(p.name);
      let s = base, n = 2;
      while (used.has(s)) s = `${base}-${n++}`;
      used.add(s); p.slug = s;
    });
  })();
  const bySlug = (s) => D.products.find((p) => p.slug === s);
  // Every SKU has its own page, /products/<sku in lowercase>/, showing its model with that colour and size picked
  const skuIndex = new Map();
  D.products.forEach((p) => (p.variants || []).forEach((v) => { if (v.path && v.path !== p.slug) skuIndex.set(v.path, { p, v }); }));

  const PATHS = {
    home: "", bikes: "bikes/", parts: "parts/", sale: "sale/", favourites: "favourites/", rewards: "rewards/", finder: "bike-finder/", order: "how-to-order/",
    cat: (c) => `${c.type === "bike" ? "bikes" : "parts"}/${c.id}/`,
    product: (p) => `products/${p.slug}/`
  };
  const shopPath = (scope) => { const c = catOf(scope); return c ? PATHS.cat(c) : (PATHS[scope] ?? PATHS.bikes); };
  const url = (path = "") => (MODE === "hash" ? "#/" + path : BASE + path);
  const absUrl = (path = "") => SITE + BASE + path;
  const absAsset = (src) => (/^https?:/.test(src) ? src : SITE + BASE + src.replace(/^\.?\//, ""));

  function currentPath() {
    if (MODE === "hash") return location.hash.replace(/^#\/?/, "").split("?")[0];
    let p = location.pathname;
    p = p.startsWith(BASE) ? p.slice(BASE.length) : p.replace(/^\//, "");
    return p.replace(/index\.html$/, "");
  }
  // Filters and Bike Finder answers live in the address (?max=50000), so a page can be shared or reloaded
  function currentQuery() {
    return new URLSearchParams(MODE === "hash" ? (location.hash.split("?")[1] || "") : location.search.slice(1));
  }
  function setQuery(values) {
    if (PRERENDER) return;
    const q = new URLSearchParams();
    Object.entries(values).forEach(([k, v]) => { if (v !== "" && v != null && v !== false) q.set(k, v); });
    const qs = q.toString();
    try { history.replaceState(history.state, "", url(currentPath()) + (qs ? "?" + qs : "")); } catch (e) { /* not allowed in this frame */ }
  }
  const saveScroll = () => { try { history.replaceState({ y: window.scrollY }, "", location.href); } catch (e) { /* ignore */ } };
  function navigate(path, qs = "") {
    if (MODE === "hash") { location.hash = "#/" + path + qs; return; }
    saveScroll();
    history.pushState(null, "", url(path) + qs);
    go();
  }
  // Links shared from the first version of the site looked like /#/shop/road
  function legacyHashPath() {
    if (MODE !== "path" || !location.hash.startsWith("#/")) return null;
    const [, page, arg] = location.hash.split("/");
    if (page === "shop") return shopPath(arg || "bikes");
    if (page === "product") { const p = byId(arg); return p ? PATHS.product(p) : PATHS.home; }
    if (page === "rewards") return PATHS.rewards;
    return PATHS.home;
  }

  /* =======================================================
     SEARCH ENGINE TAGS (title, description, social cards, structured data)
     ======================================================= */
  const clip = (t, n = 158) => (t.length <= n ? t : t.slice(0, t.lastIndexOf(" ", n - 1)).replace(/[,.;:]$/, "") + "…");
  const DEFAULT_IMAGE = "assets/og-image.png";
  const productImage = (p, ci = 0) => { const ph = photoOf(p, ci); return ph ? absAsset(ph) : absUrl(`og/products/${p.slug}.png`); };
  // Out-of-stock bikes from Cycle Beast can still be ordered: "back order", never sold out
  function availabilityOf(p, v) {
    if (v) return v.inStock ? "InStock" : "BackOrder";
    if (p.variants && p.variants.length) return p.variants.some((x) => x.inStock) ? "InStock" : "BackOrder";
    return p.stock === 0 ? "OutOfStock" : "InStock";
  }
  const OG_AVAIL = { InStock: "in stock", BackOrder: "available for order", OutOfStock: "out of stock" };

  // canonicalPath: a SKU page names its model page as the main version for search engines,
  // while its own address stays the share link (og:url) so Facebook posts keep the colour and size
  function setMeta({ title, description, image, imageAlt, type = "website", noindex = false, crumbs = [], product = null, variant = null, canonicalPath = null }) {
    document.title = title ? `${title} | ${D.site.name}` : `${D.site.name} | ${D.site.tagline}`;
    if (MODE === "hash") return; // the preview build has no public address to describe
    const head = document.head;
    const find = (sel, make) => { let el = head.querySelector(sel); if (!el) { el = make(); head.appendChild(el); } return el; };
    const named = (n, v) => { find(`meta[name="${n}"]`, () => { const m = document.createElement("meta"); m.setAttribute("name", n); return m; }).setAttribute("content", v); };
    const prop = (n, v) => { find(`meta[property="${n}"]`, () => { const m = document.createElement("meta"); m.setAttribute("property", n); return m; }).setAttribute("content", v); };

    const path = currentPath();
    const canonical = absUrl(canonicalPath ?? path);
    const img = image || absAsset(DEFAULT_IMAGE);
    const desc = clip(description || D.site.description);
    named("description", desc);
    named("robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large");
    find('link[rel="canonical"]', () => { const l = document.createElement("link"); l.rel = "canonical"; return l; }).href = canonical;
    prop("og:site_name", D.site.name);
    prop("og:locale", D.site.locale);
    prop("og:type", type);
    prop("og:title", document.title);
    prop("og:description", desc);
    prop("og:url", absUrl(path));
    prop("og:image", img);
    prop("og:image:width", "1200");
    prop("og:image:height", "630");
    prop("og:image:alt", imageAlt || `${D.site.name} – ${D.site.tagline}`);
    named("twitter:card", "summary_large_image");
    named("twitter:title", document.title);
    named("twitter:description", desc);
    named("twitter:image", img);
    head.querySelectorAll('meta[property^="product:"]').forEach((m) => m.remove());
    if (product) {
      prop("product:price:amount", String(variant ? variant.price : product.price));
      prop("product:price:currency", D.site.currency);
      prop("product:availability", OG_AVAIL[availabilityOf(product, variant)]);
      if (variant) prop("product:retailer_item_id", variant.sku);
    }

    // Structured data for Google (schema.org)
    const org = {
      "@type": "OnlineStore", "@id": SITE + BASE + "#organization", name: D.site.name, url: absUrl(),
      logo: { "@type": "ImageObject", url: absAsset("assets/logo-512.png"), width: 512, height: 512 },
      description: D.site.description
    };
    const tel = (D.contact || {}).phone || (D.contact || {}).viber;
    if (tel) org.contactPoint = { "@type": "ContactPoint", telephone: tel.replace(/[^\d+]/g, ""), contactType: "sales", areaServed: "PH" };
    const graph = [org, {
      "@type": "WebSite", "@id": SITE + BASE + "#website", name: D.site.name, url: absUrl(),
      inLanguage: D.site.language, publisher: { "@id": org["@id"] }
    }];
    if (crumbs.length) {
      graph.push({
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Home", path: "" }, ...crumbs].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absUrl(c.path) }))
      });
    }
    if (product) {
      const p = product, cat = catOf(p.category), v = variant;
      const variants = p.variants || [];
      const single = v || (variants.length === 1 ? variants[0] : null);
      const schemaAvail = (a) => "https://schema.org/" + a;
      let offer;
      if (!single && variants.length > 1) {
        const prices = variants.map((x) => x.price);
        offer = { "@type": "AggregateOffer", priceCurrency: D.site.currency, lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: variants.length, availability: schemaAvail(availabilityOf(p)), seller: { "@id": org["@id"] } };
      } else {
        const src = single || p;
        offer = {
          "@type": "Offer", url: absUrl(path), priceCurrency: D.site.currency, price: src.price,
          availability: schemaAvail(availabilityOf(p, single)), // stock left blank = in stock
          itemCondition: "https://schema.org/NewCondition", seller: { "@id": org["@id"] }
        };
        if (single) offer.sku = single.sku;
        if (src.compareAt && src.compareAt > src.price) {
          offer.priceSpecification = [
            { "@type": "UnitPriceSpecification", price: src.price, priceCurrency: D.site.currency },
            { "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice", price: src.compareAt, priceCurrency: D.site.currency }
          ];
        }
      }
      const ci = v ? v.color : 0;
      graph.push({
        "@type": "Product", "@id": canonical + "#product", name: p.name, description: productDescription(p),
        sku: single ? single.sku : p.variants ? undefined : p.id, brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
        color: v && colorsOf(p).length > 1 ? colorName(p, ci) : undefined, size: v && v.size ? v.size : undefined,
        image: photosOf(p, ci).length ? photosOf(p, ci).slice(0, 4).map(absAsset) : [productImage(p, ci)],
        category: cat ? cat.singular || cat.label : undefined, url: canonical, offers: offer
      });
    }
    find("#ld-json", () => { const sc = document.createElement("script"); sc.type = "application/ld+json"; sc.id = "ld-json"; return sc; })
      .textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }

  function productDescription(p) {
    if (p.description) return p.description.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
    const cat = catOf(p.category);
    const specs = p.specs ? " " + Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(", ") + "." : "";
    return `${p.name}, ${(cat && (cat.singular || cat.label) || "").toLowerCase()} from ${D.site.name}.${specs}`;
  }

  /* =======================================================
     STATE (saved in this browser)
     ======================================================= */
  const KEY = "cc_state_v1";
  const defaults = {
    xp: 0, cart: [], compare: [], favs: [], badges: [], viewed: [], catsSeen: [],
    lastSpin: null, codes: [], appliedCode: null, orders: 0, requests: [], customer: { name: "", mobile: "", area: "" },
    finder: { budget: D.finder.defaultBudget, terrain: "", goal: "", level: "", assist: "any" }
  };
  const fresh = () => JSON.parse(JSON.stringify(defaults));
  let S = load();
  function load() {
    const base = fresh();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY)) || {};
      const s = Object.assign(base, saved);
      s.finder = Object.assign(fresh().finder, saved.finder || {});
      s.customer = Object.assign(fresh().customer, saved.customer || {});
      // Forget products that are no longer in the inventory
      const known = (id) => !!byId(id);
      s.cart = s.cart.filter((l) => known(l.id));
      s.compare = s.compare.filter(known); s.favs = s.favs.filter(known); s.viewed = s.viewed.filter(known);
      return s;
    } catch (e) { return base; }
  }
  function save() { if (PRERENDER) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }

  /* =======================================================
     GAMIFICATION: XP, levels, badges
     ======================================================= */
  const LEVEL_PERKS = [0, 2, 4, 6, 8]; // % member discount per level
  const LEVEL_ICONS = ["🚲", "🧢", "⛰️", "⚡", "🏆"];

  const BADGES = [
    { id: "first-look",  icon: "👀", name: "First Look",     desc: "View a product",                xp: 10 },
    { id: "window",      icon: "🛍️", name: "Window Shopper", desc: "View 5 different products",     xp: 30 },
    { id: "explorer",    icon: "🧭", name: "Explorer",       desc: "Browse all 5 bike categories",  xp: 60 },
    { id: "matchmaker",  icon: "💘", name: "Matchmaker",     desc: "Get picks from the Bike Finder", xp: 75 },
    { id: "lucky",       icon: "🎡", name: "Lucky Spinner",  desc: "Spin the daily wheel",           xp: 20 },
    { id: "collector",   icon: "❤️", name: "Collector",      desc: "Save 3 items to favourites",     xp: 25 },
    { id: "analyst",     icon: "📊", name: "Analyst",        desc: "Compare 2 or more bikes",        xp: 30 },
    { id: "first-gear",  icon: "⚙️", name: "First Gear",     desc: "Add something to your cart",     xp: 20 },
    { id: "full-build",  icon: "🔧", name: "Full Build",     desc: "Cart has a bike and 2+ parts",   xp: 80 },
    { id: "free-ship",   icon: "📦", name: "Free Rider",     desc: "Unlock free shipping",           xp: 40 },
    { id: "podium",      icon: "🥇", name: "Podium Finish",  desc: "Send an order request",          xp: 150 }
  ];

  function levelIndex(xp = S.xp) {
    let i = 0;
    D.levels.forEach((l, idx) => { if (xp >= l.min) i = idx; });
    return i;
  }
  function levelProgress(xp = S.xp) {
    const i = levelIndex(xp);
    const cur = D.levels[i], next = D.levels[i + 1];
    if (!next) return { pct: 100, toNext: 0, next: null };
    return { pct: ((xp - cur.min) / (next.min - cur.min)) * 100, toNext: next.min - xp, next };
  }

  function addXP(amount, reason) {
    const before = levelIndex();
    S.xp += amount;
    save();
    toast(`${reason}`, `+${amount} XP`);
    const after = levelIndex();
    renderXP(true);
    if (after > before) {
      setTimeout(() => {
        toast(`${LEVEL_ICONS[after]} Level up! You're now a ${D.levels[after].name} — ${LEVEL_PERKS[after]}% member discount unlocked`, null, "levelup");
        confetti();
      }, 500);
    }
  }

  function award(badgeId) {
    if (PRERENDER || S.badges.includes(badgeId)) return;
    const b = BADGES.find((x) => x.id === badgeId);
    if (!b) return;
    S.badges.push(badgeId);
    save();
    addXP(b.xp, `${b.icon} Badge unlocked: ${b.name}`);
    if (currentPath().startsWith(PATHS.rewards)) route();
  }

  function renderXP(pulse) {
    const i = levelIndex();
    $("#xpLevel").textContent = `${LEVEL_ICONS[i]} ${D.levels[i].name}`;
    $("#xpNum").textContent = `${S.xp} XP`;
    $("#xpBarFill").style.width = levelProgress().pct + "%";
    if (pulse) { const p = $(".xp-pill"); p.classList.remove("pulse"); void p.offsetWidth; p.classList.add("pulse"); }
  }

  /* =======================================================
     PRODUCT FACTS
     ======================================================= */
  const LEVEL_LABEL = { beginner: "Beginner friendly", intermediate: "For regular riders", advanced: "For experienced riders" };
  const TERRAINS = [
    { v: "road", label: "Road", desc: "paved roads", kind: "road", cat: "road" },
    { v: "mixed", label: "Gravel & mixed", desc: "mixed roads and gravel", kind: "gravel", cat: "gravel" },
    { v: "trail", label: "Trails", desc: "mountain trails", kind: "trail", cat: "mountain" },
    { v: "city", label: "City", desc: "city streets", kind: "city", cat: "city" }
  ];
  const GOALS = [
    { v: "speed", label: "Speed", why: "Built for speed" },
    { v: "fitness", label: "Fitness", why: "Great for fitness rides" },
    { v: "adventure", label: "Adventure", why: "Ready for adventure" },
    { v: "commute", label: "Getting around", why: "Practical for getting around" }
  ];
  const LEVELS = [
    { v: "beginner", label: "New to cycling" },
    { v: "intermediate", label: "Ride regularly" },
    { v: "advanced", label: "Experienced" }
  ];
  const SPEC_ORDER = ["Motor", "Battery", "Range", "Frame", "Fork", "Suspension", "Groupset", "Gearing", "Brakes", "Wheels", "Tires", "Weight", "Extras"];
  const SPEC_ICON = { Motor: "bolt", Battery: "battery", Range: "route", Frame: "frame", Fork: "frame", Suspension: "spring", Groupset: "gears", Gearing: "gears", Brakes: "brake", Wheels: "wheel", Tires: "wheel", Weight: "weight", Extras: "box" };

  // Colours are { name, hex } (a plain "#hex" string also works)
  const colorsOf = (p) => (p.colors || []).map((c, i) => (typeof c === "string" ? { hex: c, name: `Colour ${i + 1}` } : c));
  const colorHex = (p, i = 0) => { const cs = colorsOf(p); return (cs[i] || cs[0] || { hex: "#3c78c6" }).hex; };
  const colorName = (p, i = 0) => { const cs = colorsOf(p); return (cs[i] || cs[0] || {}).name || ""; };
  // Photos: a colour's own photos first, then the model's
  const photosOf = (p, ci = 0) => { const c = (p.colors || [])[ci]; const own = c && typeof c === "object" && c.photos && c.photos.length ? c.photos : null; return own || (p.photos && p.photos.length ? p.photos : p.image ? [p.image] : []); };
  const photoOf = (p, ci = 0) => photosOf(p, ci)[0] || "";
  const onSale = (p) => !!p.compareAt && p.compareAt > p.price;
  const soldOut = (p) => p.stock === 0;
  const weightOf = (p) => { const m = /([\d.]+)\s*kg/i.exec((p.specs || {}).Weight || ""); return m ? +m[1] : null; };
  const frameOf = (p) => {
    const f = (p.specs || {}).Frame || "";
    if (/carbon|composite/i.test(f)) return "Carbon";
    if (/alu|alloy|aluxx/i.test(f)) return "Aluminium";
    if (/steel|cr-?mo|chromoly/i.test(f)) return "Steel";
    if (/titanium/i.test(f)) return "Titanium";
    return f.split(/[ ,]/)[0];
  };
  const levelOf = (p) => (isBike(p) && p.fit && p.fit.level ? LEVEL_LABEL[p.fit.level] : "");
  const metaLine = (p) => { const c = catOf(p.category); return [c ? c.singular || c.label : "", p.year, levelOf(p)].filter(Boolean).join(" · "); };
  const metaHTML = (p) => { const c = catOf(p.category); return `${esc(c ? c.singular || c.label : "")}${p.year ? ` · ${esc(p.year)}` : ""}${levelOf(p) ? `<span class="lvl"> · ${esc(levelOf(p))}</span>` : ""}`; };
  // A short line about the bike: "Best for ..." from the placeholders, or its first highlight
  const taglineOf = (p) => (p.bestFor ? `Best for ${lcFirst(p.bestFor)}` : p.highlights && p.highlights[0] ? p.highlights[0] : "");

  /* ---------- Variants (colour + size → SKU, price, availability) ---------- */
  const hasVariants = (p) => Array.isArray(p.variants) && p.variants.length > 0;
  const sizeLabel = (s) => (s === "" ? "One size" : s);
  const heightFor = (s) => D.sizes.find((z) => z.s === String(s).toUpperCase());
  // Sizes offered in a colour (placeholder bikes use the standard frame sizes)
  const sizeOptions = (p, ci) => (hasVariants(p) ? p.sizes.filter((sz) => p.variants.some((v) => v.color === ci && v.size === sz)) : isBike(p) ? D.sizes.map((z) => z.s) : []);
  function variantOf(p, ci, size) {
    if (!p || !hasVariants(p)) return null;
    const vs = p.variants.filter((v) => v.color === ci);
    if (size != null) return vs.find((v) => v.size === size) || null;
    return vs.length === 1 ? vs[0] : null;
  }
  const defaultColor = (p) => (hasVariants(p) ? (p.variants.find((v) => v.inStock) || p.variants[0]).color : 0);
  // Price for what's picked: the exact SKU once known, otherwise the lowest in that colour
  function priceOf(p, ci, size) {
    const v = variantOf(p, ci, size);
    if (v) return { price: v.price, compareAt: v.compareAt };
    if (!hasVariants(p)) return p;
    const vs = p.variants.filter((x) => x.color === ci);
    if (!vs.length) return p;
    const min = vs.reduce((a, b) => (b.price < a.price ? b : a));
    return { price: min.price, compareAt: min.compareAt, priceFrom: new Set(vs.map((x) => x.price)).size > 1 };
  }
  const linePrice = (l) => { const p = byId(l.id); const v = variantOf(p, l.color, l.size); return v ? v.price : p.price; };
  // Specs in a fixed order, so every bike lists them the same way
  const specKeys = (list) => { const all = [...new Set(list.flatMap((p) => Object.keys(p.specs || {})))]; return [...SPEC_ORDER.filter((k) => all.includes(k)), ...all.filter((k) => !SPEC_ORDER.includes(k))]; };
  const specEntries = (p) => specKeys([p]).map((k) => [k, p.specs[k]]);
  // The few facts shoppers compare first
  function keySpecs(p, count = 4) {
    const s = p.specs || {};
    const first = s.Motor ? ["Motor", "Range", "Weight", "Battery"] : ["Frame", "Gearing", "Weight", "Brakes"];
    return [...new Set([...first, ...Object.keys(s)])].filter((k) => s[k]).slice(0, count).map((k) => ({ k, v: s[k], icon: SPEC_ICON[k] || "dot" }));
  }
  const shortSpec = (v) => v.replace(/^Up to /, "").replace(/ speed$/, "").replace(/,.*$/, "");

  function art(p, colorIdx = 0, label = true) {
    const ph = photoOf(p, colorIdx);
    if (ph) return `<img src="${esc(ph)}" alt="${label ? esc(p.name + (colorsOf(p).length > 1 ? `, ${colorName(p, colorIdx)}` : "")) : ""}" loading="lazy" decoding="async">`;
    if (!isBike(p)) return partSVG(p.icon, "#3c78c6", label ? p.name : "");
    const s = p.specs || {};
    return bikeSVG(colorHex(p, colorIdx), p.category === "other" ? "city" : p.category, {
      label: label ? p.name : "",
      deepRims: /deep/i.test(s.Wheels || ""),
      fullSus: /rear/i.test(s.Suspension || ""),
      ebase: p.fit && p.fit.terrain === "trail" ? "mountain" : "city",
      hubMotor: /hub/i.test(s.Motor || "")
    });
  }

  /* =======================================================
     UI HELPERS
     ======================================================= */
  function toast(msg, xp, cls = "") {
    if (PRERENDER) return;
    const t = document.createElement("div");
    t.className = "toast " + cls;
    t.innerHTML = `<span>${msg}</span>${xp ? `<span class="xp">${xp}</span>` : ""}`;
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  // Star ratings only appear for products with real reviews (a `reviews` count in the data)
  function stars(p) {
    if (!p.reviews || !p.rating) return "";
    const full = Math.round(p.rating);
    return `<span class="stars" aria-label="Rated ${p.rating.toFixed(1)} out of 5 from ${p.reviews} reviews">${"★".repeat(full)}${"☆".repeat(5 - full)}<em>${p.rating.toFixed(1)} (${p.reviews})</em></span>`;
  }

  function priceHTML(p, withSave = true) {
    return `<span class="price">${p.priceFrom ? `<small class="from">From</small> ` : ""}${peso(p.price)}${onSale(p) ? `<s>${peso(p.compareAt)}</s>` : ""}</span>${onSale(p) && withSave ? `<span class="save">Save ${peso(p.compareAt - p.price)}</span>` : ""}`;
  }
  function tagsHTML(p) {
    const tags = [];
    if (soldOut(p)) tags.push(`<span class="tag">Sold out</span>`);
    if (p.orderOnly) tags.push(`<span class="tag order">Available to order</span>`);
    if (onSale(p)) tags.push(`<span class="tag sale">-${Math.round((1 - p.price / p.compareAt) * 100)}%</span>`);
    if (p.tag) tags.push(`<span class="tag ${esc(p.tag.toLowerCase())}">${esc(p.tag)}</span>`);
    return tags.length ? `<span class="tags">${tags.join("")}</span>` : "";
  }
  const chipsHTML = (p, count = 3) => { const ks = keySpecs(p, count); return ks.length ? `<ul class="spec-chips" aria-label="Key specs">${ks.map((s) => `<li title="${esc(s.k)}">${icon(s.icon, 14)}${esc(shortSpec(s.v))}</li>`).join("")}</ul>` : ""; };
  const glanceHTML = (p) => { const ks = keySpecs(p, 4); return ks.length ? `<div class="glance">${ks.map((s) => `<div>${icon(s.icon, 22)}<small>${esc(s.k)}</small><b>${esc(s.v)}</b></div>`).join("")}</div>` : ""; };
  const favBtn = (p, cls = "icon-btn card-fav") => { const on = S.favs.includes(p.id); return `<button class="${cls} ${on ? "on" : ""}" data-action="fav" data-id="${p.id}" aria-label="Save ${esc(p.name)} to favourites" aria-pressed="${on}">${icon("heart", 20)}</button>`; };
  const compareBtn = (p, cls = "btn btn-ghost") => { const on = S.compare.includes(p.id); return `<button class="${cls} ${on ? "on" : ""}" data-action="compare" data-id="${p.id}" aria-pressed="${on}">${icon(on ? "check" : "compare", 16)}<span>${on ? "Comparing" : "Compare"}</span></button>`; };

  let lastFocus = null;
  function openPanel(sel) {
    const opener = document.activeElement;
    closeAll(true);
    lastFocus = opener;
    $("#overlay").classList.add("show");
    const el = $(sel);
    el.classList.add("open");
    document.body.style.overflow = "hidden";
    renderCompareTray();
    const target = el.querySelector("input[type=search], .modal-close, button, a[href]");
    if (target && !PRERENDER) setTimeout(() => target.focus({ preventScroll: true }), 80);
  }
  function closeAll(silent) {
    $("#overlay").classList.remove("show");
    $$(".drawer.open, .modal.open, .search-panel.open, .filters.open").forEach((el) => el.classList.remove("open"));
    $("#mainNav").classList.remove("open");
    document.body.classList.remove("menu-open");
    document.body.style.overflow = "";
    if (silent === true) return;
    renderCompareTray();
    if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
    lastFocus = null;
  }

  /* =======================================================
     PRODUCT CARD
     ======================================================= */
  // o.label / o.note / o.best / o.reasons turn the card into a Bike Finder pick
  function card(p, o = {}) {
    const href = url(PATHS.product(p));
    const bike = isBike(p);
    return `<article class="card ${o.label ? "pick" : ""} ${o.best ? "best" : ""}" data-id="${p.id}">
      ${o.label ? `<div class="pick-label">${o.best ? icon("check", 16) : ""}${esc(o.label)}${o.note ? `<small>${esc(o.note)}</small>` : ""}</div>` : ""}
      <a class="card-media" href="${href}" tabindex="-1" aria-hidden="true">${tagsHTML(p)}<span class="art">${art(p, 0, false)}</span></a>
      ${favBtn(p)}
      <div class="card-body">
        <span class="card-meta">${metaHTML(p)}</span>
        <h3 class="card-title"><a href="${href}">${esc(p.name)}</a></h3>
        ${o.reasons ? `<ul class="reasons">${o.reasons.map((r) => `<li>${icon("check", 15)}<span>${esc(r)}</span></li>`).join("")}</ul>` : (taglineOf(p) ? `<p class="card-best">${esc(taglineOf(p))}</p>` : "")}
        ${bike ? chipsHTML(p) : ""}
        <div class="price-row">${priceHTML(p)}${stars(p)}</div>
        ${(p.colors && p.colors.length > 1) || (p.stock > 0 && p.stock <= 5) ? `<div class="card-row">
          ${p.colors && p.colors.length > 1 ? `<div class="swatches">${colorsOf(p).map((c, i) => `<button class="swatch ${i === 0 ? "active" : ""}" style="background:${c.hex}" data-action="swatch" data-id="${p.id}" data-i="${i}" aria-label="Show ${esc(c.name)}" title="${esc(c.name)}"></button>`).join("")}</div>` : "<span></span>"}
          ${p.stock > 0 && p.stock <= 5 ? `<span class="stock-low">Only ${p.stock} left</span>` : ""}
        </div>` : ""}
        <div class="card-actions">
          ${bike
            ? `<button class="btn btn-ghost" data-action="quick" data-id="${p.id}">${icon("eye", 16)}Quick view</button>${compareBtn(p)}`
            : `<button class="btn btn-brand" data-action="add" data-id="${p.id}" ${soldOut(p) ? "disabled" : ""}>${soldOut(p) ? "Sold out" : "Add to cart"}</button>`}
        </div>
      </div>
    </article>`;
  }

  /* =======================================================
     VIEWS
     ======================================================= */
  const app = $("#app");
  const crumbsHTML = (items, style = "") => `<nav class="crumbs" aria-label="Breadcrumb" ${style ? `style="${style}"` : ""}><a href="${url()}">Home</a>${items.map((c, i) => (i === items.length - 1 ? ` / <span aria-current="page">${esc(c.name)}</span>` : ` / <a href="${url(c.path)}">${esc(c.name)}</a>`)).join("")}</nav>`;

  function viewHome() {
    const bikes = D.products.filter(isBike);
    const parts = D.products.filter((p) => !isBike(p));
    const bikeCats = D.categories.filter((c) => c.type === "bike");
    const spinReady = S.lastSpin !== today();
    const fromPrice = Math.min(...bikes.map((p) => p.price));
    const deals = bikes.filter((p) => onSale(p) || p.tag);
    const featured = [...deals, ...bikes.filter((p) => !deals.includes(p))].slice(0, 8);
    const recent = S.viewed.slice(-6).reverse().map(byId).filter(Boolean);
    app.innerHTML = `
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <span class="eyebrow">Online bike shop · Philippines</span>
            <h1 class="hero-title">Find the right bike for your budget.</h1>
            <p>Set what you want to spend and where you ride. We'll show the best bikes for you, with the specs that matter side by side.</p>
            <ul class="hero-points">
              <li>${icon("check", 16)}${bikes.length} bikes from ${peso(fromPrice)}</li>
              <li>${icon("compare", 16)}Compare specs side by side</li>
              <li>${icon("truck", 16)}Free shipping over ${peso(D.freeShippingThreshold)}</li>
            </ul>
          </div>
          <div class="hero-art">${bikeSVG("#3c78c6", "road", { light: true })}</div>
        </div>
      </section>

      <section class="finder-band" id="finder" aria-label="Bike Finder">
        <div class="wrap">
          <div class="finder-card">${finderControls("compact")}</div>
          <div id="finderResults" data-mode="picks" aria-live="polite">${finderPicksHTML()}</div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          <div class="section-head"><div><h2>Shop by type</h2><p>Not sure which type suits you? Each one is built for a different kind of riding.</p></div><a class="text-link" href="${url(PATHS.bikes)}">All bikes ${icon("arrow", 16)}</a></div>
          <div class="cat-grid">
            ${bikeCats.map((c) => {
              const inCat = bikes.filter((b) => b.category === c.id);
              const sample = inCat[0];
              return `<a class="cat-card" href="${url(PATHS.cat(c))}">
                <h3>${esc(c.label)}</h3><p>${esc(c.blurb)}</p>
                ${inCat.length ? `<span class="from">From ${peso(Math.min(...inCat.map((b) => b.price)))}</span>` : ""}
                ${sample ? art(sample, 0, false) : ""}
              </a>`;
            }).join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head"><div><h2>New arrivals and deals</h2></div><a class="text-link" href="${url(PATHS.bikes)}">View all bikes ${icon("arrow", 16)}</a></div>
          <div class="rail">${featured.map((p) => card(p)).join("")}</div>
        </div>
      </section>

      ${HAS_PARTS ? `<section class="section tight">
        <div class="wrap">
          <div class="section-head"><div><h2>Parts and gear</h2><p>Upgrade your ride or replace what's worn out.</p></div><a class="text-link" href="${url(PATHS.parts)}">Shop parts ${icon("arrow", 16)}</a></div>
          <div class="rail">${parts.map((p) => card(p)).join("")}</div>
        </div>
      </section>` : ""}

      ${recent.length ? `<section class="section tight">
        <div class="wrap">
          <div class="section-head"><div><h2>Recently viewed</h2></div></div>
          <div class="rail">${recent.map((p) => card(p)).join("")}</div>
        </div>
      </section>` : ""}

      <section class="section alt">
        <div class="wrap">
          <div class="section-head"><div><h2>Rider Club</h2><p>Earn XP as you shop. Higher levels unlock bigger member discounts.</p></div><a class="text-link" href="${url(PATHS.rewards)}">How it works ${icon("arrow", 16)}</a></div>
          <div class="game-strip">
            <div class="game-card brand">
              <span class="big-emoji">🏆</span>
              <div><h3>Your level</h3><p>You're a <b>${D.levels[levelIndex()].name}</b>. ${levelProgress().next ? `${levelProgress().toNext} XP until ${levelProgress().next.name}.` : "That's the top level."}</p></div>
              <div><a class="btn" href="${url(PATHS.rewards)}">View badges</a></div>
            </div>
            <div class="game-card earth">
              <span class="big-emoji">🎡</span>
              <div><h3>Daily Spin</h3><p>${spinReady ? "Spin once a day for discount codes, free shipping or bonus XP." : "You've already spun today. Come back tomorrow for another try."}</p></div>
              <div><button class="btn" data-action="open-spin" ${spinReady ? "" : "disabled"}>${spinReady ? "Spin now" : "Back tomorrow"}</button></div>
            </div>
            <div class="game-card">
              <span class="big-emoji">🎯</span>
              <div><h3>Missions</h3><p>${S.badges.length} of ${BADGES.length} done. Explore the shop, compare bikes and build your cart to earn XP.</p></div>
              <div><a class="btn btn-brand" href="${url(PATHS.rewards)}">See missions</a></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap about-grid">
          <div class="about-copy">
            <h2>${esc(D.pages.home.aboutTitle)}</h2>
            <p>${esc(D.pages.home.about)}</p>
          </div>
          <nav class="about-links" aria-label="Shop by category">
            <h3>Shop by type</h3>
            <ul>${D.categories.map((c) => `<li><a href="${url(PATHS.cat(c))}">${esc(c.seoTitle ? c.seoTitle.replace(/ for Sale in the Philippines$/, "") : c.label)}</a></li>`).join("")}
              <li><a href="${url(PATHS.sale)}">Bikes and parts on sale</a></li>
              <li><a href="${url(PATHS.finder)}">Bike Finder</a></li></ul>
          </nav>
        </div>
      </section>`;
    setMeta({});
  }

  function trackCategory(id) {
    const c = catOf(id);
    if (!c || c.type !== "bike" || S.catsSeen.includes(id)) return;
    S.catsSeen.push(id); save();
    const all = D.categories.filter((x) => x.type === "bike").map((x) => x.id);
    if (all.every((x) => S.catsSeen.includes(x))) award("explorer");
  }

  /* ---------- Listing pages ---------- */
  const F = { cats: [], min: 0, max: null, frame: [], level: [], sale: false, sort: "featured" };
  let shop = null; // controls for the listing that is on screen

  function viewShop(scope) {
    let base, title, crumb, seo;
    const pg = D.pages;
    if (scope === "bikes") { base = isBike; title = "Bikes"; seo = pg.bikes; }
    else if (scope === "parts") { base = (p) => !isBike(p); title = "Parts & Gear"; seo = pg.parts; }
    else if (scope === "sale") { base = onSale; title = "Sale"; seo = pg.sale; }
    else if (scope === "favourites") { base = (p) => S.favs.includes(p.id); title = "Favourites"; seo = { seoTitle: "Your Favourites", noindex: true }; }
    else {
      const c = catOf(scope);
      if (!c) return viewNotFound();
      base = (p) => p.category === scope;
      title = c.type === "bike" ? `${c.label} Bikes` : c.label;
      crumb = { name: c.type === "bike" ? "Bikes" : "Parts & Gear", path: c.type === "bike" ? PATHS.bikes : PATHS.parts };
      seo = { seoTitle: c.seoTitle || title, intro: c.intro, metaDescription: c.metaDescription };
      trackCategory(scope);
    }
    const pool = D.products.filter(base);
    const allBikes = pool.length > 0 && pool.every(isBike);
    const noun = allBikes ? "bike" : "item";
    const bands = D.priceBands[pool.some(isBike) ? "bike" : "part"];
    const cats = [...new Set(pool.map((p) => p.category))];
    const frames = allBikes ? [...new Set(pool.map(frameOf).filter(Boolean))] : [];
    const levels = allBikes ? LEVELS.map((l) => l.v).filter((l) => pool.some((p) => p.fit && p.fit.level === l)) : [];
    const step = pool.some(isBike) ? 1000 : 500;
    const top = Math.ceil(Math.max(...pool.map((p) => p.price), step) / step) * step;

    // Address -> filters
    const q = currentQuery();
    const list = (k, allowed) => (q.get(k) || "").split(",").filter((v) => allowed.includes(v));
    Object.assign(F, {
      cats: list("type", cats), frame: list("frame", frames), level: list("level", levels),
      min: Math.max(0, +q.get("min") || 0), max: +q.get("max") > 0 ? +q.get("max") : null,
      sale: q.get("sale") === "1", sort: q.get("sort") || "featured"
    });

    const matches = (p, ignorePrice) => (!F.cats.length || F.cats.includes(p.category))
      && (!F.frame.length || F.frame.includes(frameOf(p)))
      && (!F.level.length || (p.fit && F.level.includes(p.fit.level)))
      && (!F.sale || onSale(p))
      && (ignorePrice || (p.price >= F.min && (F.max == null || p.price <= F.max)));
    const bandLabel = ([a, b]) => (!a ? `Under ${pesoK(b)}` : b == null ? `${pesoK(a)}+` : `${pesoK(a)} – ${pesoK(b)}`);
    const budgetLabel = () => (F.min && F.max != null ? `${pesoK(F.min)} – ${pesoK(F.max)}` : F.max != null ? `Up to ${peso(F.max)}` : `From ${peso(F.min)}`);
    const chip = (k, v, label) => { const on = F[k].includes(v); return `<button class="chip ${on ? "on" : ""}" data-action="filter-toggle" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label)}</button>`; };

    const groupsHTML = () => `
      <div class="filter-group"><h4>Budget</h4>
        <div class="chip-list">${bands.filter(([a]) => a < top).map((b) => { const on = F.min === b[0] && F.max === b[1]; return `<button class="chip ${on ? "on" : ""}" data-action="filter-band" data-min="${b[0]}" data-max="${b[1] ?? ""}" aria-pressed="${on}">${bandLabel(b)}</button>`; }).join("")}</div>
        <input class="range" type="range" id="priceRange" min="0" max="${top}" step="${step}" value="${F.max == null ? top : Math.min(F.max, top)}" aria-label="Maximum price" style="--fill:${((F.max == null ? top : Math.min(F.max, top)) / top) * 100}%">
        <p class="filter-note" id="priceLabel">${F.max == null && !F.min ? "Any price" : budgetLabel()}</p>
      </div>
      ${cats.length > 1 ? `<div class="filter-group"><h4>${allBikes ? "Bike type" : "Category"}</h4><div class="chip-list">${cats.map((c) => chip("cats", c, catOf(c).label)).join("")}</div></div>` : ""}
      ${frames.length > 1 ? `<div class="filter-group"><h4>Frame</h4><div class="chip-list">${frames.map((f) => chip("frame", f, f)).join("")}</div></div>` : ""}
      ${levels.length > 1 ? `<div class="filter-group"><h4>Rider level</h4><div class="chip-list">${levels.map((l) => chip("level", l, LEVELS.find((x) => x.v === l).label)).join("")}</div></div>` : ""}
      ${scope !== "sale" && pool.some(onSale) ? `<div class="filter-group"><label class="check"><input type="checkbox" id="fSale" ${F.sale ? "checked" : ""}> On sale only</label></div>` : ""}
      ${allBikes ? `<div class="filter-group"><a class="text-link" href="${url(PATHS.finder)}">${icon("target", 16)}Help me choose</a></div>` : ""}`;

    const sorts = [["featured", "Recommended"], ["low", "Price: low to high"], ["high", "Price: high to low"]];
    if (allBikes) sorts.push(["light", "Lightest first"]);
    if (pool.some(onSale)) sorts.push(["save", "Biggest saving"]);
    if (!sorts.some(([v]) => v === F.sort)) F.sort = "featured";

    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          ${crumbsHTML([...(crumb ? [crumb] : []), { name: title }])}
          <h1>${esc(title)}</h1>
          ${seo.intro ? `<p class="page-intro">${esc(seo.intro)}</p>` : ""}
        </div>
        <div class="shop-layout">
          <aside class="filters" id="filters" aria-label="Filters">
            <div class="sheet-head"><strong>Filters</strong><button class="icon-btn" data-action="close-filters" aria-label="Close filters">${icon("close")}</button></div>
            <div class="filter-scroll" id="filterGroups"></div>
            <div class="sheet-foot"><button class="btn btn-ghost" data-action="clear-filters">Clear</button><button class="btn btn-brand" data-action="close-filters" id="sheetShow">Show results</button></div>
          </aside>
          <section aria-label="Results">
            <div class="toolbar">
              <button class="btn btn-ghost btn-sm filter-btn" data-action="open-filters">${icon("sliders", 16)}Filters<span id="filterCount"></span></button>
              <span class="result-count" id="resultCount" aria-live="polite"></span>
              <label class="sort">Sort<select id="sortSel">${sorts.map(([v, l]) => `<option value="${v}" ${F.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            </div>
            <div class="active-filters" id="activeFilters"></div>
            <div class="product-grid" id="grid"></div>
          </section>
        </div>
      </div>`;

    const draw = (keepControls) => {
      const found = pool.filter((p) => matches(p));
      const sorted = [...found];
      if (F.sort === "low") sorted.sort((a, b) => a.price - b.price);
      if (F.sort === "high") sorted.sort((a, b) => b.price - a.price);
      if (F.sort === "light") sorted.sort((a, b) => (weightOf(a) ?? 99) - (weightOf(b) ?? 99));
      if (F.sort === "save") sorted.sort((a, b) => ((b.compareAt || b.price) - b.price) - ((a.compareAt || a.price) - a.price));

      const pills = [];
      const pill = (k, v, label) => `<button class="pill" data-action="filter-remove" data-k="${k}" data-v="${esc(v)}" aria-label="Remove filter: ${esc(label)}">${esc(label)}${icon("close", 16)}</button>`;
      if (F.min || F.max != null) pills.push(pill("budget", "", budgetLabel()));
      F.cats.forEach((c) => pills.push(pill("cats", c, catOf(c).label)));
      F.frame.forEach((f) => pills.push(pill("frame", f, f + " frame")));
      F.level.forEach((l) => pills.push(pill("level", l, LEVELS.find((x) => x.v === l).label)));
      if (F.sale) pills.push(pill("sale", "", "On sale"));

      let empty = "";
      if (!sorted.length) {
        const cheapest = pool.filter((p) => matches(p, true)).sort((a, b) => a.price - b.price)[0];
        if (scope === "favourites" && !pool.length) empty = `<div class="empty"><div class="big">${icon("heart", 44)}</div><h2>No favourites yet</h2><p>Tap the heart on any bike or part to save it here.</p><a class="btn btn-brand" href="${url(PATHS.bikes)}">Browse bikes</a></div>`;
        else if (cheapest && F.max != null && cheapest.price > F.max) empty = `<div class="empty"><h2>Nothing up to ${peso(F.max)} here</h2><p>The lowest price that matches is the ${esc(cheapest.name)} at ${peso(cheapest.price)}.</p><button class="btn btn-brand" data-action="filter-band" data-min="0" data-max="${Math.ceil(cheapest.price / step) * step}">Show up to ${peso(Math.ceil(cheapest.price / step) * step)}</button></div>`;
        else empty = `<div class="empty"><h2>No matches</h2><p>Try removing a filter.</p><button class="btn btn-brand" data-action="clear-filters">Clear all filters</button></div>`;
      }
      $("#grid").innerHTML = sorted.length ? sorted.map((p) => card(p)).join("") : empty;
      $("#resultCount").textContent = `${sorted.length} ${noun}${sorted.length === 1 ? "" : "s"}`;
      $("#sheetShow").textContent = `Show ${sorted.length} ${noun}${sorted.length === 1 ? "" : "s"}`;
      $("#activeFilters").innerHTML = pills.length ? pills.join("") + `<button class="text-link" data-action="clear-filters">Clear all</button>` : "";
      $("#filterCount").textContent = pills.length ? ` (${pills.length})` : "";
      if (!keepControls) $("#filterGroups").innerHTML = groupsHTML();
      else { $("#priceLabel").textContent = F.max == null && !F.min ? "Any price" : budgetLabel(); $("#priceRange").style.setProperty("--fill", ($("#priceRange").value / top) * 100 + "%"); }
      setQuery({ type: F.cats.join(","), min: F.min || "", max: F.max ?? "", frame: F.frame.join(","), level: F.level.join(","), sale: F.sale ? "1" : "", sort: F.sort === "featured" ? "" : F.sort });
    };

    shop = {
      toggle(k, v) { const i = F[k].indexOf(v); if (i >= 0) F[k].splice(i, 1); else F[k].push(v); draw(); },
      band(min, max) { const same = F.min === min && F.max === max; F.min = same ? 0 : min; F.max = same ? null : max; draw(); },
      slide(v, done) { F.min = 0; F.max = v >= top ? null : v; draw(!done); },
      remove(k, v) { if (k === "budget") { F.min = 0; F.max = null; } else if (k === "sale") F.sale = false; else F[k] = F[k].filter((x) => x !== v); draw(); },
      clear() { Object.assign(F, { cats: [], frame: [], level: [], min: 0, max: null, sale: false }); draw(); },
      sale(on) { F.sale = on; draw(); },
      sort(v) { F.sort = v; draw(); }
    };
    draw();
    setMeta({
      title: seo.seoTitle || title,
      description: seo.metaDescription || seo.intro || `${title} at ${D.site.name}. Prices in Philippine pesos.`,
      noindex: !!seo.noindex,
      crumbs: [...(crumb ? [crumb] : []), { name: title, path: currentPath() }]
    });
  }

  /* ---------- Product page ---------- */
  const PDP = { key: "pdp", id: null, size: null, color: 0, qty: 1 };
  const QV = { key: "qv", id: null, size: null, color: 0, qty: 1 };
  const selOf = (el) => (el.closest("#quickCard") ? QV : PDP);
  const rootOf = (el) => el.closest("#quickCard") || $(".pdp") || app;

  // Colour, size and availability, shared by the product page and quick view
  function initSel(sel, p, v) {
    Object.assign(sel, { id: p.id, qty: 1, color: v ? v.color : defaultColor(p), size: v ? v.size : null });
    autoSize(p, sel);
  }
  // Keep the size only if it exists in the chosen colour; pick it for the shopper when there's just one
  function autoSize(p, sel) {
    const sizes = sizeOptions(p, sel.color);
    if (sel.size != null && !sizes.includes(sel.size)) sel.size = null;
    if (sel.size == null && hasVariants(p) && sizes.length === 1) sel.size = sizes[0];
  }
  const needsSize = (p, sel) => isBike(p) && sel.size == null && sizeOptions(p, sel.color).length > 0;

  function availHTML(p, sel) {
    if (!hasVariants(p)) return p.stock > 0 && p.stock <= 5 ? `<span class="stock-low">Only ${p.stock} left in stock</span>` : "";
    const v = variantOf(p, sel.color, sel.size);
    const sku = v ? `<small class="sku">SKU ${esc(v.sku)}</small>` : "";
    if (v && v.inStock) return `${icon("check", 18)}<span><b>In stock</b>${v.qty > 0 && v.qty <= 3 ? `, only ${v.qty} left` : ""}${sku}</span>`;
    if (v) return `${icon("truck", 18)}<span><b>Available to order.</b> We'll confirm the delivery time when you send your order.${sku}</span>`;
    const vs = p.variants.filter((x) => x.color === sel.color);
    if (vs.length && vs.every((x) => !x.inStock)) return `${icon("truck", 18)}<span><b>Available to order</b> in this colour.</span>`;
    return "";
  }

  function optsInnerHTML(p, sel) {
    const cs = colorsOf(p), sizes = sizeOptions(p, sel.color);
    const showSizes = isBike(p) && (sizes.length > 1 || (sizes.length === 1 && sizes[0] !== ""));
    const colourBlock = cs.length > 1
      ? `<div class="pdp-block"><h4>Colour<b class="color-picked">${esc(colorName(p, sel.color))}</b></h4><div class="swatches lg">${cs.map((c, i) => `<button class="swatch ${i === sel.color ? "active" : ""}" style="background:${c.hex}" data-action="opt-color" data-i="${i}" aria-label="${esc(c.name)}" title="${esc(c.name)}" aria-pressed="${i === sel.color}"></button>`).join("")}</div></div>`
      : cs.length === 1 && hasVariants(p) && cs[0].name !== "Standard" ? `<p class="one-colour">Colour <b>${esc(cs[0].name)}</b></p>` : "";
    const lettered = sizes.some(heightFor);
    const sizeBlock = showSizes ? `<div class="pdp-block"><h4>${lettered || !hasVariants(p) ? "Frame size" : "Size"}<b class="size-picked">${sel.size != null && sizes.length > 1 ? esc(sizeLabel(sel.size)) : ""}</b></h4>
        <div class="size-grid">${sizes.map((sz) => {
          const z = heightFor(sz), v = variantOf(p, sel.color, sz), on = sel.size === sz;
          const sub = z ? `${z.min}–${z.max} cm` : v ? (v.inStock ? "In stock" : "To order") : "";
          return `<button class="size-btn ${on ? "on" : ""} ${v && !v.inStock ? "to-order" : ""}" data-action="opt-size" data-s="${esc(sz)}" aria-pressed="${on}" aria-label="Size ${esc(sizeLabel(sz))}${z ? `, for riders ${z.min} to ${z.max} cm` : ""}${v && !v.inStock ? ", available to order" : ""}">${esc(sizeLabel(sz))}${sub ? `<small>${sub}</small>` : ""}</button>`;
        }).join("")}</div></div>` : "";
    return colourBlock + sizeBlock + `<p class="avail" aria-live="polite">${availHTML(p, sel)}</p>`;
  }
  function optionsHTML(p, sel) {
    const helper = isBike(p) && sizeOptions(p, sel.color).some(heightFor)
      ? `<div class="size-helper"><label for="${sel.key}Height">${icon("ruler", 16)} Not sure? Enter your height</label><input type="number" id="${sel.key}Height" inputmode="numeric" placeholder="cm" min="120" max="220" data-height><span class="size-msg" aria-live="polite"></span></div>` : "";
    return `<div class="opts">${optsInnerHTML(p, sel)}</div>${helper}`;
  }
  function galleryHTML(p, ci) {
    const ph = photosOf(p, ci);
    return ph.length > 1 ? `<div class="thumbs" role="group" aria-label="More photos">${ph.map((u, i) => `<button class="thumb ${i === 0 ? "on" : ""}" data-action="photo" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>` : "";
  }
  // Redraw what depends on the selection: options, price, buy bar, and (on the product page) the address
  function refreshSelection(root, sel) {
    const p = byId(sel.id);
    if (!p) return;
    const opts = $(".opts", root); if (opts) opts.innerHTML = optsInnerHTML(p, sel);
    const pr = $(".sel-price", root); if (pr) pr.innerHTML = priceHTML(priceOf(p, sel.color, sel.size)) + stars(p);
    if (sel !== PDP) return;
    const barBtn = $("#buyBarBtn"); if (barBtn) barBtn.textContent = buyLabel();
    const barPrice = $("#buyBar .price"); if (barPrice) barPrice.textContent = peso(priceOf(p, sel.color, sel.size).price);
    const v = variantOf(p, sel.color, sel.size);
    if (v && MODE === "path" && !PRERENDER) { try { history.replaceState(history.state, "", url(`products/${v.path}/`)); } catch (e) { /* not allowed in this frame */ } }
  }
  function showColour(root, sel) {
    const p = byId(sel.id);
    const media = sel === QV ? $("#quickArt") : $("#pdpArt");
    if (media) media.innerHTML = art(p, sel.color);
    const thumbs = $("#pdpThumbs"); if (thumbs && sel === PDP) thumbs.innerHTML = galleryHTML(p, sel.color);
  }
  const descHTML = (p) => (p.description ? p.description.split(/\n\s*\n/).map((para) => `<p class="pdp-desc">${esc(para.trim())}</p>`).join("") : `<p class="pdp-desc">${esc(productDescription(p))}</p>`);
  const highlightsHTML = (p) => (p.highlights && p.highlights.length ? `<ul class="highlights">${p.highlights.map((h) => `<li>${icon("check", 16)}<span>${esc(h)}</span></li>`).join("")}</ul>` : "");
  // Brand and model year sit at the top of the spec table for bikes from Cycle Beast
  const fullSpecs = (p) => [...(p.brand ? [["Brand", p.brand]] : []), ...(p.year ? [["Model year", String(p.year)]] : []), ...(p.specs ? specEntries(p) : [])];

  // The closest alternatives, for the side-by-side table on a bike's page
  function alternatives(p, count = 2) {
    const rank = (x) => (x.category === p.category ? 0 : x.fit && p.fit && x.fit.terrain === p.fit.terrain ? 1 : 2) * 10 + Math.abs(x.price - p.price) / p.price;
    return D.products.filter((x) => isBike(x) && x.id !== p.id && !soldOut(x)).sort((a, b) => rank(a) - rank(b)).slice(0, count).sort((a, b) => a.price - b.price);
  }
  function versusHTML(p) {
    const alts = alternatives(p);
    if (!alts.length) return "";
    const cols = [p, ...alts];
    const keys = [...new Set(cols.flatMap((x) => keySpecs(x, 4).map((s) => s.k)))];
    const diff = (x) => (x.price === p.price ? "Same price" : `${peso(Math.abs(x.price - p.price))} ${x.price < p.price ? "less" : "more"}`);
    return `<h2>How it compares</h2>
      <div class="table-scroll"><table class="vs-table">
        <thead><tr><th scope="row"><span class="sr-only">Spec</span></th>${cols.map((x, i) => `<th scope="col" class="${i ? "" : "this"}">${i ? `<a href="${url(PATHS.product(x))}">${esc(x.name)}</a>` : `<small>This bike</small>${esc(x.name)}`}</th>`).join("")}</tr></thead>
        <tbody>
          <tr><th scope="row">Price</th>${cols.map((x, i) => `<td class="${i ? "" : "this"}">${x.priceFrom ? "From " : ""}${peso(x.price)}${i ? `<span class="diff">${diff(x)}</span>` : ""}</td>`).join("")}</tr>
          <tr><th scope="row">${cols.some((x) => x.bestFor) ? "Best for" : "Highlight"}</th>${cols.map((x, i) => `<td class="${i ? "" : "this"}">${esc(x.bestFor || (x.highlights || [])[0] || "—")}</td>`).join("")}</tr>
          ${keys.map((k) => `<tr><th scope="row">${esc(k)}</th>${cols.map((x, i) => `<td class="${i ? "" : "this"}">${esc((x.specs || {})[k] || "—")}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-action="compare-set" data-ids="${cols.map((x) => x.id).join(",")}">${icon("compare", 16)}Compare all specs</button></p>`;
  }

  function viewProduct(id, variant) {
    const p = byId(id);
    if (!p) return viewNotFound();
    initSel(PDP, p, variant);
    markViewed(p);
    const c = catOf(p.category);
    const bike = isBike(p);
    const top = bike ? { name: "Bikes", path: PATHS.bikes } : { name: "Parts & Gear", path: PATHS.parts };
    const catTitle = c.type === "bike" ? `${c.label} Bikes` : c.label;
    const lvl = levelIndex();
    const related = bike
      ? (HAS_PARTS ? D.products.filter((x) => !isBike(x)).slice(0, 6) : alternatives(p, 6))
      : D.products.filter((x) => x.id !== p.id && x.category === p.category).concat(D.products.filter((x) => !isBike(x) && x.category !== p.category)).slice(0, 6);
    const shown = priceOf(p, PDP.color, PDP.size);
    const xp = Math.max(1, Math.floor(shown.price / 1000));
    const specs = fullSpecs(p);

    app.innerHTML = `
      <div class="wrap">
        ${crumbsHTML([top, { name: catTitle, path: PATHS.cat(c) }, { name: p.name }], "padding-top:20px")}
        <div class="pdp">
          <div class="pdp-visual">
            <div class="pdp-media" id="pdpArt">${art(p, PDP.color)}</div>
            <div id="pdpThumbs">${galleryHTML(p, PDP.color)}</div>
          </div>
          <div class="pdp-buy">
            <div>
              ${tagsHTML(p)}
              <span class="card-meta" style="display:block;margin-top:${onSale(p) || p.tag || p.orderOnly ? 12 : 0}px">${esc(metaLine(p))}</span>
              <h1>${esc(p.name)}</h1>
            </div>
            <div class="price-row sel-price">${priceHTML(shown)}${stars(p)}</div>
            <div>${descHTML(p)}</div>
            ${highlightsHTML(p)}
            ${glanceHTML(p)}
            ${optionsHTML(p, PDP)}
            <div class="buy-row">
              <div class="qty"><button data-action="qty" data-d="-1" aria-label="Decrease quantity">${icon("minus", 16)}</button><span id="qtyVal" aria-live="polite">1</span><button data-action="qty" data-d="1" aria-label="Increase quantity">${icon("plus", 16)}</button></div>
              <button class="btn btn-brand" data-action="add-sel" ${soldOut(p) ? "disabled" : ""}>${soldOut(p) ? "Sold out" : "Add to cart"}</button>
              ${favBtn(p, "btn btn-ghost")}
            </div>
            <div class="pdp-links">${bike ? compareBtn(p, "text-link") : ""}${askBtn(p)}</div>
            <ul class="assure">
              <li>${icon("truck")}${shown.price >= D.freeShippingThreshold ? "Free shipping on this item" : `Free shipping on orders over ${peso(D.freeShippingThreshold)}`}</li>
              <li>${icon("returns")}30-day returns</li>
              <li>${icon("bolt")}${LEVEL_PERKS[lvl] ? `${D.levels[lvl].name} member price: ${peso(shown.price * (1 - LEVEL_PERKS[lvl] / 100))} (${LEVEL_PERKS[lvl]}% off)` : `Earn ${xp} XP in the Rider Club with this order`}</li>
            </ul>
          </div>
        </div>
        ${specs.length || bike ? `<div class="pdp-sections">
          <section>${specs.length ? `<h2>Specifications</h2><table class="spec-table"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : ""}</section>
          <section>${bike ? versusHTML(p) : ""}</section>
        </div>` : ""}
        ${related.length ? `<section class="section tight"><div class="section-head"><h2>${bike ? (HAS_PARTS ? "Complete your build" : "Similar bikes") : "You may also like"}</h2></div><div class="rail">${related.map((x) => card(x)).join("")}</div></section>` : ""}
      </div>`;
    setupBuyBar(p);
    const v = variant || null;
    const what = v ? [colorsOf(p).length > 1 ? colorName(p, v.color) : "", v.size ? `size ${v.size}` : ""].filter(Boolean).join(", ") : "";
    setMeta({
      title: `${p.name}${what ? ` (${what})` : ""} – ${c.singular || c.label}`,
      description: `${productDescription(p)} ${what ? `${what[0].toUpperCase() + what.slice(1)}, ` : ""}${peso(v ? v.price : p.price)}${!v && p.priceFrom ? " and up" : ""} at ${D.site.name}.`,
      type: "product",
      image: productImage(p, v ? v.color : 0),
      imageAlt: p.name,
      crumbs: [top, { name: catTitle, path: PATHS.cat(c) }, { name: p.name, path: PATHS.product(p) }],
      product: p, variant: v,
      canonicalPath: v ? PATHS.product(p) : null
    });
  }

  function markViewed(p) {
    if (S.viewed.includes(p.id)) { S.viewed = S.viewed.filter((x) => x !== p.id); S.viewed.push(p.id); save(); }
    else {
      S.viewed.push(p.id); save();
      award("first-look");
      if (S.viewed.length >= 5) award("window");
    }
    trackCategory(p.category);
  }

  // A buy button that stays on screen whenever the main one is out of view
  let buyObserver = null;
  function buyLabel() {
    const p = byId(PDP.id);
    if (!p) return "";
    if (soldOut(p)) return "Sold out";
    if (needsSize(p, PDP)) return "Choose size";
    return isBike(p) && PDP.size && sizeOptions(p, PDP.color).length > 1 ? `Add to cart · ${sizeLabel(PDP.size)}` : "Add to cart";
  }
  function setupBuyBar(p) {
    const bar = $("#buyBar");
    const pr = priceOf(p, PDP.color, PDP.size);
    bar.innerHTML = `<div class="buy-bar-inner"><div class="info"><strong>${esc(p.name)}</strong><span class="price">${peso(pr.price)}</span>${onSale(pr) ? `<small><s>${peso(pr.compareAt)}</s></small>` : ""}</div><button class="btn btn-brand" data-action="add-sel" id="buyBarBtn" ${soldOut(p) ? "disabled" : ""}>${buyLabel()}</button></div>`;
    const row = $(".pdp .buy-row");
    if (PRERENDER || !row || !("IntersectionObserver" in window)) return;
    buyObserver = new IntersectionObserver(([e]) => {
      const show = !e.isIntersecting;
      bar.classList.toggle("show", show);
      document.documentElement.style.setProperty("--bottom-bar", show ? bar.offsetHeight + "px" : "0px");
    });
    buyObserver.observe(row);
  }
  function clearBuyBar() {
    if (buyObserver) { buyObserver.disconnect(); buyObserver = null; }
    const bar = $("#buyBar");
    bar.classList.remove("show"); bar.innerHTML = "";
    document.documentElement.style.setProperty("--bottom-bar", "0px");
  }

  /* ---------- Quick view ---------- */
  function openQuick(id) {
    const p = byId(id);
    if (!p) return;
    initSel(QV, p);
    const specs = fullSpecs(p);
    $("#quickCard").innerHTML = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">${icon("close")}</button>
      <div class="quick">
        <div class="quick-media" id="quickArt">${art(p, QV.color)}</div>
        <div class="quick-info">
          <div><span class="card-meta">${esc(metaLine(p))}</span><h2>${esc(p.name)}</h2></div>
          <div class="price-row sel-price">${priceHTML(priceOf(p, QV.color, QV.size))}${stars(p)}</div>
          ${taglineOf(p) ? `<p class="card-best">${esc(taglineOf(p))}</p>` : ""}
          ${glanceHTML(p)}
          ${optionsHTML(p, QV)}
          <div class="buy-row"><button class="btn btn-brand" data-action="add-sel" ${soldOut(p) ? "disabled" : ""}>${soldOut(p) ? "Sold out" : "Add to cart"}</button>${favBtn(p, "btn btn-ghost")}</div>
          <div class="pdp-links"><a class="text-link" href="${url(PATHS.product(p))}" data-action="close-all">Full details ${icon("arrow", 16)}</a>${isBike(p) ? compareBtn(p, "text-link") : ""}${askBtn(p)}</div>
        </div>
      </div>
      ${specs.length ? `<div class="quick-specs"><span class="field-label">All specs</span><dl>${specs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>` : ""}`;
    openPanel("#quickModal");
    markViewed(p);
  }

  function viewRewards() {
    const i = levelIndex(), prog = levelProgress();
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head"><nav class="crumbs" aria-label="Breadcrumb"><a href="${url()}">Home</a> / <span aria-current="page">Rewards</span></nav><h1>Rider Club</h1></div>
        <section class="section" style="padding-top:32px">
          <div class="rider-card">
            <div class="rider-avatar">${LEVEL_ICONS[i]}</div>
            <div>
              <div class="muted" style="text-transform:uppercase;letter-spacing:.1em;font-size:12px">Your level</div>
              <h2>${D.levels[i].name}</h2>
              <div>${prog.next ? `<b>${prog.toNext} XP</b> to ${prog.next.name}` : "Top level reached. You're a legend."}</div>
              <div class="level-track">${D.levels.map((l, k) => `<div class="level-step ${k <= i ? "reached" : ""}"><i></i>${l.name}</div>`).join("")}</div>
            </div>
            <div class="rider-stats">
              <div><b>${S.xp}</b>Total XP</div>
              <div><b>${S.badges.length}/${BADGES.length}</b>Badges</div>
              <div><b>${LEVEL_PERKS[i]}%</b>Member discount</div>
              <div><b>${S.orders}</b>Order requests</div>
            </div>
          </div>
        </section>
        <section class="section" style="padding-top:0">
          <div class="section-head"><h2>Badges</h2></div>
          <div class="badge-grid">${BADGES.map((b) => `<div class="badge-tile ${S.badges.includes(b.id) ? "earned" : ""}"><div class="medal">${b.icon}</div><strong>${b.name}</strong><small>${b.desc}</small><div class="xp-hint">+${b.xp} XP</div></div>`).join("")}</div>
        </section>
        <section class="section" style="padding-top:0">
          <div class="section-head"><h2>Level perks</h2></div>
          <table class="perk-table">
            <tr><th>Level</th><th>XP needed</th><th>Member discount</th></tr>
            ${D.levels.map((l, k) => `<tr class="${k === i ? "current" : ""}"><td>${LEVEL_ICONS[k]} ${l.name}${k === i ? " (you)" : ""}</td><td>${l.min}</td><td>${LEVEL_PERKS[k]}%</td></tr>`).join("")}
          </table>
          <p class="muted" style="font-size:13px;margin-top:12px">Earn XP by exploring the shop, completing missions, spinning the daily wheel, and with every order request (1 XP per ₱1,000).</p>
          ${S.codes.length ? `<div class="section-head" style="margin-top:32px"><h2>Your codes</h2></div><div class="chip-list">${S.codes.map((c) => `<span class="code-pill">${c}</span>`).join("")}</div>` : ""}
          <p style="margin-top:28px"><button class="btn btn-ghost btn-sm" data-action="reset">Reset my progress</button></p>
        </section>
      </div>`;
    setMeta({ title: D.pages.rewards.seoTitle, description: D.pages.rewards.metaDescription, crumbs: [{ name: "Rewards", path: PATHS.rewards }] });
  }

  function viewNotFound() {
    const gone = currentPath().startsWith("products/");
    app.innerHTML = gone
      ? `<div class="wrap empty" style="padding-top:110px;padding-bottom:110px"><div class="big">🚲</div><h1>This bike isn't listed right now</h1><p>It may have sold out or been replaced by a newer model.</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn btn-brand" href="${url(PATHS.bikes)}">See all bikes</a><a class="btn btn-ghost" href="${url(PATHS.finder)}">Find a similar bike</a>${C.viber ? `<a class="btn btn-ghost" href="${viberLink(`Hi ${D.site.name}! I saw a bike at ${location.href} but it isn't listed anymore. Is it still available?`)}">Ask us about it</a>` : ""}</div></div>`
      : `<div class="wrap empty" style="padding-top:110px;padding-bottom:110px"><div class="big">🛞</div><h1>Flat tyre! Page not found.</h1><p>The page you're looking for doesn't exist or has moved.</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn btn-brand" href="${url()}">Back to home</a><a class="btn btn-ghost" href="${url(PATHS.bikes)}">Browse bikes</a></div></div>`;
    setMeta({ title: gone ? "Bike not listed" : "Page not found", noindex: true });
  }


  /* =======================================================
     CART
     ======================================================= */
  function addToCart(id, qty = 1, extra = {}) {
    const p = byId(id);
    if (!p) return;
    const key = id + "|" + (extra.size || "") + "|" + (extra.color ?? "");
    const line = S.cart.find((l) => l.key === key);
    if (line) line.qty += qty; else S.cart.push({ key, id, qty, size: extra.size || null, color: extra.color ?? 0 });
    save();
    renderCartCount(true);
    if (!extra.quiet) toast(`Added ${esc(p.name)} to cart`);
    award("first-gear");
    checkCartBadges();
  }

  function cartTotals() {
    const sub = S.cart.reduce((s, l) => s + linePrice(l) * l.qty, 0);
    const lvlPct = LEVEL_PERKS[levelIndex()];
    const code = S.appliedCode ? D.spinPrizes.find((x) => x.code === S.appliedCode) : null;
    const codePct = code && code.pct ? code.pct : 0;
    const discount = sub * ((lvlPct + codePct) / 100);
    const freeShip = sub >= D.freeShippingThreshold || (code && code.ship);
    const ship = sub === 0 || freeShip ? 0 : D.shippingFee;
    return { sub, lvlPct, codePct, discount, ship, total: sub - discount + ship, freeShip };
  }

  function checkCartBadges() {
    const items = S.cart.map((l) => byId(l.id));
    const bikes = items.filter((p) => p.type === "bike").length;
    const parts = S.cart.filter((l) => byId(l.id).type === "part").reduce((s, l) => s + l.qty, 0);
    if (bikes >= 1 && parts >= 2) award("full-build");
    if (cartTotals().sub >= D.freeShippingThreshold) award("free-ship");
  }

  function renderCartCount(animate) {
    const n = S.cart.reduce((s, l) => s + l.qty, 0);
    const b = $("#cartCount");
    b.hidden = !n; b.textContent = n;
    if (animate) bump(b);
    const f = $("#favCount");
    f.hidden = !S.favs.length; f.textContent = S.favs.length;
  }

  function renderCart() {
    const t = cartTotals();
    const left = D.freeShippingThreshold - t.sub;
    $("#shipMeter").innerHTML = t.freeShip
      ? `${icon("check", 16)} <b>You've unlocked free shipping!</b><div class="meter"><span style="width:100%"></span></div>`
      : `${icon("truck", 16)} Add <b>${peso(left)}</b> more for <b>free shipping</b><div class="meter"><span style="width:${Math.min(100, (t.sub / D.freeShippingThreshold) * 100)}%"></span></div>`;

    if (!S.cart.length) {
      $("#cartBody").innerHTML = `<div class="empty"><div class="big">${icon("cart", 44)}</div><p>Your cart is empty.</p><a class="btn btn-brand" href="${url(PATHS.bikes)}" data-action="close-all">Start shopping</a></div>`;
      $("#cartFoot").innerHTML = "";
      return;
    }
    const inCart = new Set(S.cart.map((l) => l.id));
    const upsell = D.products.filter((p) => p.type === "part" && !inCart.has(p.id) && p.price <= Math.max(left, 3000)).slice(0, 3);
    $("#cartBody").innerHTML = S.cart.map((l) => {
      const p = byId(l.id), v = variantOf(p, l.color, l.size), each = linePrice(l);
      const opts = [colorsOf(p).length > 1 ? colorName(p, l.color) : "", l.size ? `Size ${sizeLabel(l.size)}` : "", peso(each)].filter(Boolean).join(" · ");
      return `<div class="cart-line">
        <div class="thumb">${art(p, l.color, false)}</div>
        <div><strong>${esc(p.name)}</strong><small>${esc(opts)}</small>${v && !v.inStock ? `<small class="to-order-note">Available to order</small>` : ""}
          <div style="display:flex;gap:10px;align-items:center;margin-top:6px">
            <div class="qty"><button data-action="line-qty" data-key="${l.key}" data-d="-1" aria-label="Decrease">−</button><span>${l.qty}</span><button data-action="line-qty" data-key="${l.key}" data-d="1" aria-label="Increase">+</button></div>
            <button class="remove" data-action="line-remove" data-key="${l.key}">Remove</button>
          </div></div>
        <b>${peso(each * l.qty)}</b>
      </div>`;
    }).join("") + (upsell.length ? `<div class="upsell"><h5>Quick adds${t.freeShip ? "" : " to unlock free shipping"}</h5>${upsell.map((p) => `<div class="upsell-item"><span>${esc(p.name)} · <b>${peso(p.price)}</b></span><button class="btn btn-sm btn-ghost" data-action="add" data-id="${p.id}">+ Add</button></div>`).join("")}</div>` : "");

    $("#cartFoot").innerHTML = `
      <div class="code-row"><input id="codeIn" placeholder="Discount code" value="${S.appliedCode || ""}" aria-label="Discount code"><button class="btn btn-sm" data-action="apply-code">Apply</button></div>
      <div class="sum-row"><span>Subtotal</span><span>${peso(t.sub)}</span></div>
      ${t.lvlPct ? `<div class="sum-row discount"><span>${LEVEL_ICONS[levelIndex()]} ${D.levels[levelIndex()].name} discount (${t.lvlPct}%)</span><span>−${peso(t.sub * t.lvlPct / 100)}</span></div>` : ""}
      ${t.codePct ? `<div class="sum-row discount"><span>Code ${S.appliedCode} (${t.codePct}%)</span><span>−${peso(t.sub * t.codePct / 100)}</span></div>` : ""}
      <div class="sum-row"><span>Shipping</span><span>${t.ship ? peso(t.ship) : "FREE"}</span></div>
      <div class="sum-row total"><span>Estimated total</span><span>${peso(t.total)}</span></div>
      <button class="btn btn-brand btn-block" data-action="order-open">${icon("arrow", 18)}Send order request</button>
      <p class="order-note">No payment on the website. A sales rep confirms stock, size, final price and delivery with you. <a href="${url(PATHS.order)}" data-action="close-all">How ordering works</a></p>`;
  }

  /* =======================================================
     ORDERING BY CHAT (until online payment is set up)
     ======================================================= */
  const C = D.contact || {};
  const telDigits = (n) => { const d = String(n || "").replace(/[^\d+]/g, ""); return d.startsWith("+") ? d : "+" + d.replace(/^0/, "63"); };
  const viberLink = (text) => (C.viber ? `viber://chat?number=${encodeURIComponent(telDigits(C.viber))}${text ? `&draft=${encodeURIComponent(text)}` : ""}` : "");
  const chatChannel = () => (C.viber ? "viber" : C.messenger ? "messenger" : null);
  let order = null; // the request being prepared or just sent: { ref, text, via }

  function newRef() {
    const d = new Date(), chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const rand = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `CC-${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${rand}`;
  }

  // The message the customer sends us: items, options, prices, discounts and their details
  function orderText(ref, who) {
    const t = cartTotals();
    const items = S.cart.map((l) => {
      const p = byId(l.id), v = variantOf(p, l.color, l.size);
      const opts = [colorsOf(p).length > 1 && colorName(p, l.color), l.size && `size ${sizeLabel(l.size)}`].filter(Boolean).join(", ");
      const extra = v ? `\n  SKU ${v.sku}${v.inStock ? "" : " (available to order)"}` : "";
      return `• ${l.qty} × ${p.name}${opts ? ` (${opts})` : ""} – ${peso(linePrice(l) * l.qty)}${extra}`;
    });
    const money = [`Subtotal: ${peso(t.sub)}`];
    if (t.lvlPct) money.push(`Rider Club ${D.levels[levelIndex()].name} discount: ${t.lvlPct}%`);
    if (S.appliedCode) money.push(`Discount code: ${S.appliedCode}`);
    money.push(`Estimated total: ${peso(t.total)}${t.ship ? ` (incl. ${peso(t.ship)} delivery)` : ""}`);
    const details = [`Order ref: ${ref}`, `Name: ${who.name}`];
    if (who.mobile) details.push(`Mobile: ${who.mobile}`);
    if (who.area) details.push(`Deliver to: ${who.area}`);
    if (who.notes) details.push(`Notes: ${who.notes}`);
    return [`Hi ${D.site.name}! I'd like to order:`, items.join("\n"), money.join("\n"), details.join("\n")].join("\n\n");
  }

  function contactListHTML() {
    const rows = [];
    if (C.viber) rows.push(`<li>${icon("chat", 20)}<span>Viber <b class="selectable">${esc(C.viber)}</b></span><a class="btn btn-sm btn-brand" href="${viberLink("")}">Chat on Viber</a></li>`);
    if (C.messenger) rows.push(`<li>${icon("chat", 20)}<span>Facebook Messenger</span><a class="btn btn-sm btn-ghost" href="${esc(C.messenger)}" target="_blank" rel="noopener">Open Messenger</a></li>`);
    if (C.phone) rows.push(`<li>${icon("phone", 20)}<span>Call or text <b class="selectable">${esc(C.phone)}</b></span><a class="btn btn-sm btn-ghost" href="tel:${telDigits(C.phone)}">Call</a></li>`);
    if (C.email) rows.push(`<li>${icon("mail", 20)}<span>Email <b class="selectable">${esc(C.email)}</b></span></li>`);
    return rows.length ? `<ul class="contact-list">${rows.join("")}</ul>` : "";
  }
  const communityHTML = () => (C.viberCommunity ? `<a class="community" href="${esc(C.viberCommunity)}" target="_blank" rel="noopener">${icon("users", 22)}<span><b>Join our Viber community</b><small>New arrivals, group rides and members-only deals</small></span>${icon("arrow", 18)}</a>` : "");

  function openOrder() {
    if (!S.cart.length) return;
    order = null;
    renderOrderForm();
    openPanel("#orderModal");
  }

  function renderOrderForm() {
    const t = cartTotals(), who = S.customer, ch = chatChannel();
    const lines = S.cart.map((l) => { const p = byId(l.id); return `<li><span>${l.qty} × ${esc(p.name)}${colorsOf(p).length > 1 ? ` · ${esc(colorName(p, l.color))}` : ""}${l.size ? ` · ${esc(sizeLabel(l.size))}` : ""}</span><b>${peso(linePrice(l) * l.qty)}</b></li>`; }).join("");
    $("#orderCard").innerHTML = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">${icon("close")}</button>
      <h2>Send order request</h2>
      <p class="muted" style="margin-top:8px">No payment is taken on the website. A sales rep confirms stock, size, final price and delivery with you, then sends payment details.</p>
      <ul class="order-items">${lines}<li class="total"><span>Estimated total</span><b>${peso(t.total)}</b></li></ul>
      <form id="orderForm" class="order-form" novalidate>
        <label for="oName">Your name</label><input id="oName" autocomplete="name" required value="${esc(who.name)}">
        <label for="oMobile">Mobile number <span class="muted">(optional)</span></label><input id="oMobile" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xx xxx xxxx" value="${esc(who.mobile)}">
        <label for="oArea">Deliver to <span class="muted">(city or area)</span></label><input id="oArea" autocomplete="address-level2" placeholder="e.g. Quezon City" value="${esc(who.area)}">
        <label for="oNotes">Notes <span class="muted">(optional)</span></label><textarea id="oNotes" rows="2" placeholder="Questions about sizing, preferred delivery date..."></textarea>
        <p class="form-error" id="orderError" role="alert"></p>
        ${ch ? "" : `<p class="notice">${icon("chat", 18)}<span>Our Viber ordering line opens soon. You can copy your order details now so they're ready to send.</span></p>`}
        <div class="order-actions">
          ${C.viber ? `<button class="btn btn-brand" data-action="order-send" data-via="viber">${icon("send", 18)}Send on Viber</button>` : ""}
          ${C.messenger ? `<button class="btn ${C.viber ? "btn-ghost" : "btn-brand"}" data-action="order-send" data-via="messenger">Send on Messenger</button>` : ""}
          <button class="btn ${ch ? "btn-ghost" : "btn-brand"}" data-action="order-send" data-via="copy">${icon("copy", 18)}Copy order details</button>
        </div>
      </form>`;
  }

  async function copyText(text, area) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      if (area) { area.focus(); area.select(); try { return document.execCommand("copy"); } catch (x) { return false; } }
      return false;
    }
  }

  function sendOrder(via) {
    const who = { name: $("#oName").value.trim(), mobile: $("#oMobile").value.trim(), area: $("#oArea").value.trim(), notes: $("#oNotes").value.trim() };
    if (!who.name) { $("#orderError").textContent = "Enter your name so our sales team knows who the order is for."; $("#oName").focus(); return; }
    S.customer = { name: who.name, mobile: who.mobile, area: who.area };
    const ref = newRef(), text = orderText(ref, who), t = cartTotals();
    order = { ref, text, via };
    const copied = copyText(text); // start the copy inside the click, as browsers require
    S.orders += 1;
    S.requests = [{ ref, at: new Date().toISOString(), total: t.total, items: S.cart.length }, ...S.requests].slice(0, 10);
    save();
    if (via === "viber") window.location.href = viberLink(text);
    if (via === "messenger") window.open(C.messenger, "_blank", "noopener");
    copied.then((ok) => renderOrderSent(ok));
    addXP(Math.max(1, Math.floor(t.total / 1000)), "Order request XP");
    setTimeout(() => award("podium"), 700);
  }

  function renderOrderSent(copied) {
    const { ref, text, via } = order;
    const lead = via === "viber" ? "We opened Viber with your order filled in. Press send in Viber to finish."
      : via === "messenger" ? `Your order details are ${copied ? "copied" : "below"}. Paste them into the Messenger chat and send.`
      : chatChannel() ? `Your order details are ${copied ? "copied" : "below"}. Send them to us on one of the channels below.`
      : `Your order details are ${copied ? "copied" : "below"}. Our Viber ordering line opens soon. Keep this reference so you can send it then.`;
    $("#orderCard").innerHTML = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">${icon("close")}</button>
      <div class="order-done">
        <span class="done-icon">${icon("check", 30)}</span>
        <h2>Order request ready</h2>
        <p class="ref">Reference <b class="selectable">${ref}</b></p>
        <p>${lead}</p>
      </div>
      <label class="field-label" for="orderText">Your order message</label>
      <textarea id="orderText" class="order-text" readonly rows="8">${esc(text)}</textarea>
      <div class="order-actions">
        <button class="btn btn-ghost" data-action="order-copy">${icon(copied ? "check" : "copy", 16)}${copied ? "Copied" : "Copy order details"}</button>
        ${via !== "viber" && C.viber ? `<a class="btn btn-brand" href="${viberLink(text)}">Open Viber</a>` : ""}
      </div>
      ${contactListHTML()}
      <h4 class="field-label" style="margin-top:20px">What happens next</h4>
      <ol class="next-steps">
        <li>Our sales team confirms stock, size and the final price.</li>
        <li>You agree on delivery or pickup and any delivery fee.</li>
        <li>We send payment details and arrange your delivery.</li>
      </ol>
      ${communityHTML()}
      <div class="order-actions" style="margin-top:18px">
        <button class="btn btn-ghost" data-action="order-clear">Clear my cart</button>
        <button class="btn" data-action="close-all">Keep browsing</button>
      </div>`;
  }

  // "Ask about this bike": opens a chat with the product already named
  function askAbout(id) {
    const p = byId(id);
    if (!p) return;
    const sel = $("#quickModal").classList.contains("open") ? QV : PDP;
    const size = sel.id === id && sel.size ? ` in size ${sel.size}` : "";
    const text = `Hi ${D.site.name}! I'm interested in the ${p.name}${size} (${peso(p.price)}). Is it available?\n${absUrl(PATHS.product(p))}`;
    if (C.viber) window.location.href = viberLink(text);
    else if (C.messenger) { copyText(text); window.open(C.messenger, "_blank", "noopener"); toast("Message copied. Paste it in Messenger."); }
  }
  const askBtn = (p, cls = "text-link") => (chatChannel() ? `<button class="${cls}" data-action="ask" data-id="${p.id}">${icon("chat", 16)}Ask about this ${isBike(p) ? "bike" : "item"}</button>` : "");

  function viewHowToOrder() {
    const pg = D.pages.order;
    const steps = [
      { icon: "target", title: "Choose your bike", text: "Use the Bike Finder or compare bikes side by side. Add your bike to the cart with its size and colour, plus any parts or gear." },
      { icon: "cart", title: "Send an order request", text: "In your cart, tap Send order request. We prepare a message with your items, sizes, prices and a reference number for you to send us." },
      { icon: "check", title: "We confirm the details", text: "A sales rep confirms stock, sizing and the final price, and agrees delivery or pickup with you." },
      { icon: "truck", title: "Pay and get riding", text: "Once your order is confirmed, we send payment details in the chat and arrange your delivery." }
    ];
    const contacts = contactListHTML();
    const st = C.store;
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          ${crumbsHTML([{ name: "How to order" }])}
          <h1>How to order</h1>
          <p class="page-intro">${esc(pg.intro)}</p>
        </div>
        <ol class="order-steps">${steps.map((x) => `<li><span class="step-icon">${icon(x.icon, 24)}</span><h2>${esc(x.title)}</h2><p>${esc(x.text)}</p></li>`).join("")}</ol>
        <div class="order-help">
          <section>
            <h2>Talk to us</h2>
            ${contacts || `<p class="notice">${icon("chat", 18)}<span>Our Viber ordering line opens soon. You can already build your cart and copy your order details from it.</span></p>`}
            ${C.hours ? `<p class="muted" style="margin-top:10px">${esc(C.hours)}</p>` : ""}
            ${communityHTML()}
            ${st && st.address ? `<div class="store-card"><h3>Visit us</h3><p><b>${esc(st.name || D.site.name)}</b><br>${esc(st.address)}</p>${st.hours ? `<p class="muted">${esc(st.hours)}</p>` : ""}${st.mapUrl ? `<a class="text-link" href="${esc(st.mapUrl)}" target="_blank" rel="noopener">Open in Maps ${icon("arrow", 16)}</a>` : ""}</div>` : ""}
          </section>
          <section>
            <h2>Good to know</h2>
            <dl class="faq">
              <div><dt>Can I pay on the website?</dt><dd>Not yet. Payment details are sent in the chat once your order is confirmed.</dd></div>
              <div><dt>Is my bike reserved when I send a request?</dt><dd>Our sales team checks stock and confirms it when they reply.</dd></div>
              <div><dt>Not sure about the size?</dt><dd>Enter your height on any bike's page to see the size we suggest, or ask us in the chat.</dd></div>
              <div><dt>Do Rider Club discounts count?</dt><dd>Your member discount and any Daily Spin code are included in your order message.</dd></div>
            </dl>
          </section>
        </div>
        <p style="margin:8px 0 64px"><a class="btn btn-brand" href="${url(PATHS.finder)}">Find your bike</a></p>
      </div>`;
    setMeta({ title: pg.seoTitle, description: pg.metaDescription, crumbs: [{ name: "How to order", path: PATHS.order }] });
  }

  /* =======================================================
     BIKE FINDER (budget first, then where and how you ride)
     ======================================================= */
  const budgetPct = (b) => Math.max(0, Math.min(100, ((b - D.finder.budgetMin) / (D.finder.budgetMax - D.finder.budgetMin)) * 100));
  const terrainOf = (v) => TERRAINS.find((t) => t.v === v);
  // Only offer riding types, goals and levels that the bikes for sale actually have
  const terrainsOffered = () => TERRAINS.filter((t) => D.products.some((p) => isBike(p) && p.fit && p.fit.terrain === t.v));
  const hasFit = (k) => D.products.some((p) => isBike(p) && p.fit && p.fit[k]);
  const catLink = (t) => { const c = t && catOf(t.cat); return c ? PATHS.cat(c) : PATHS.bikes; };

  function finderControls(mode) {
    const f = S.finder, cfg = D.finder;
    const chips = (key, list, anyLabel, anyValue = "") => `<div class="chip-list" role="group">${[{ v: anyValue, label: anyLabel }, ...list].map((o) => `<button class="chip ${f[key] === o.v ? "on" : ""}" data-action="finder-set" data-k="${key}" data-v="${o.v}" aria-pressed="${f[key] === o.v}">${o.label}</button>`).join("")}</div>`;
    const budget = `<div>
        <label class="field-label" for="budgetInput">Your budget</label>
        <div class="budget-amount"><span aria-hidden="true">₱</span><input id="budgetInput" inputmode="numeric" autocomplete="off" value="${f.budget.toLocaleString("en-PH")}" aria-label="Budget in pesos"></div>
        <input class="range" type="range" id="budgetRange" min="${cfg.budgetMin}" max="${cfg.budgetMax}" step="${cfg.step}" value="${Math.max(cfg.budgetMin, Math.min(cfg.budgetMax, f.budget))}" aria-label="Budget slider" style="--fill:${budgetPct(f.budget)}%">
        <div class="range-ends"><span>${pesoK(cfg.budgetMin)}</span><span>${pesoK(cfg.budgetMax)}</span></div>
        <div class="chip-list" style="margin-top:10px">${cfg.quick.map((q) => `<button class="chip ${f.budget === q ? "on" : ""}" data-action="finder-budget" data-v="${q}">${pesoK(q)}</button>`).join("")}</div>
      </div>`;
    const ride = `<span class="field-label">Where will you ride?</span>${chips("terrain", terrainsOffered(), "Anywhere")}`;
    if (mode === "compact") return `${budget}<div>${ride}<p class="finder-more"><a class="text-link" href="${url(PATHS.finder)}">${icon("sliders", 16)}More options in the Bike Finder</a></p></div>`;
    return `${budget}
      <div>${ride}</div>
      ${hasFit("goal") ? `<div><span class="field-label">What matters most?</span>${chips("goal", GOALS, "No preference")}</div>` : ""}
      ${hasFit("level") ? `<div><span class="field-label">Your experience</span>${chips("level", LEVELS, "Any")}</div>` : ""}
      ${catOf("electric") ? `<div><span class="field-label">Electric assist</span>${chips("assist", [{ v: "only", label: "E-bikes only" }, { v: "none", label: "No e-bikes" }], "Either", "any")}</div>` : ""}
      <button class="text-link" data-action="finder-reset">Start over</button>`;
  }

  // Scores every bike out of 100 for this shopper: riding type 45, goal 25, experience 15, use of budget 15
  function finderRank(f = S.finder) {
    const near = { road: ["mixed", "city"], mixed: ["road", "trail"], trail: ["mixed"], city: ["road", "mixed"] };
    const order = ["beginner", "intermediate", "advanced"];
    return D.products.filter((p) => isBike(p) && !soldOut(p))
      .filter((p) => (f.assist === "only" ? p.category === "electric" : f.assist === "none" ? p.category !== "electric" : true))
      .map((p) => {
        const fit = p.fit || {};
        const over = p.price - f.budget;
        const terrain = !f.terrain || fit.terrain === f.terrain ? 45 : (near[f.terrain] || []).includes(fit.terrain) ? 18 : 0;
        // A bike with no goal or level information scores in the middle rather than losing out
        const goal = !f.goal ? 25 : !fit.goal ? 15 : fit.goal === f.goal ? 25 : 8;
        const level = !f.level ? 15 : !fit.level ? 10 : [15, 8, 0][Math.abs(order.indexOf(fit.level) - order.indexOf(f.level))] ?? 0;
        const money = over <= 0 ? 15 * Math.max(0.4, p.price / f.budget) : Math.max(0, 15 - (over / (f.budget * D.finder.stretch)) * 15);
        return {
          p, over, score: Math.round(terrain + goal + level + money),
          inBudget: over <= 0, stretch: over > 0 && over <= f.budget * D.finder.stretch,
          terrainMatch: !f.terrain || fit.terrain === f.terrain, related: terrain > 0
        };
      })
      .sort((a, b) => b.score - a.score || b.p.price - a.p.price);
  }

  function finderPicks(f = S.finder) {
    const ranked = finderRank(f);
    const fits = ranked.filter((r) => r.inBudget && r.terrainMatch);
    const picks = [];
    const best = fits[0];
    if (best) {
      picks.push({ ...best, label: "Best match", best: true, note: `${best.score}% match` });
      const value = fits.filter((r) => r !== best && r.p.price <= best.p.price * 0.9 && r.score >= best.score - 25).sort((a, b) => a.p.price - b.p.price)[0];
      if (value) picks.push({ ...value, label: "Best value", note: `${peso(best.p.price - value.p.price)} less` });
    }
    const stretch = ranked.find((r) => r.stretch && r.terrainMatch);
    if (stretch) picks.push({ ...stretch, label: "Worth the stretch", note: `${peso(stretch.over)} more` });
    for (const r of fits) {
      if (picks.length >= 3) break;
      if (!picks.some((x) => x.p === r.p)) picks.push({ ...r, label: "Also a good fit", note: `${r.score}% match` });
    }
    // Still short? Suggest bikes built for similar riding
    for (const r of ranked) {
      if (picks.length >= 3) break;
      if (r.inBudget && r.related && !picks.some((x) => x.p === r.p)) picks.push({ ...r, label: "Close alternative", note: `${r.score}% match` });
    }
    return { picks: picks.slice(0, 3), fits, ranked };
  }

  function reasonsFor(r, f = S.finder) {
    const p = r.p, fit = p.fit || {}, out = [];
    const t = terrainOf(fit.terrain);
    if (f.terrain && r.terrainMatch && t) out.push(`Made for ${t.desc}`);
    else if (p.bestFor) out.push(`Best for ${lcFirst(p.bestFor)}`);
    if (r.over > 0) out.push(`${peso(r.over)} over your budget`);
    else if (-r.over >= 1000) out.push(`${peso(-r.over)} under your budget`);
    else out.push("Right on your budget");
    const g = GOALS.find((x) => x.v === f.goal);
    if (g && fit.goal === f.goal) out.push(g.why);
    if (fit.level && (f.level ? fit.level === f.level : fit.level === "beginner")) out.push(LEVEL_LABEL[fit.level]);
    if (hasVariants(p)) out.push(p.variants.some((v) => v.inStock) ? "In stock" : "Available to order");
    if (onSale(p)) out.push(`On sale, ${peso(p.compareAt - p.price)} off`);
    if (frameOf(p) === "Carbon") out.push("Carbon frame");
    return out.slice(0, 3);
  }

  const pickCards = (picks, f) => `<div class="picks-grid">${picks.map((r) => card(r.p, { label: r.label, best: r.best, note: r.note, reasons: reasonsFor(r, f) })).join("")}</div>`;

  function finderEmptyHTML(f, kind) {
    const t = terrainOf(f.terrain);
    const cheapest = D.products.filter((p) => isBike(p) && !soldOut(p) && (!t || (p.fit && p.fit.terrain === t.v))
      && (f.assist === "only" ? p.category === "electric" : f.assist === "none" ? p.category !== "electric" : true)).sort((a, b) => a.price - b.price)[0];
    if (!cheapest) return `<div class="empty"><h2>No bikes match yet</h2><p>Try a different riding type or include e-bikes.</p><button class="btn btn-brand" data-action="finder-reset">Start over</button></div>`;
    const need = Math.ceil(cheapest.price / D.finder.step) * D.finder.step;
    return `<div class="empty"><h2>No ${kind}bikes at ${peso(f.budget)} yet</h2><p>The lowest-priced match is the <a class="link-btn" href="${url(PATHS.product(cheapest))}">${esc(cheapest.name)}</a> at ${peso(cheapest.price)}.</p><button class="btn btn-brand" data-action="finder-budget" data-v="${need}">Show picks for ${peso(need)}</button></div>`;
  }

  // The home page only asks for budget and riding type, so it ignores the extra answers from the Bike Finder page
  const homeFinder = () => ({ ...S.finder, goal: "", level: "", assist: "any" });

  // Home page: the three picks under the budget control
  function finderPicksHTML() {
    const f = homeFinder(), { picks, fits } = finderPicks(f);
    const t = terrainOf(f.terrain);
    const kind = t ? t.kind + " " : "";
    const listing = catLink(t);
    if (!picks.length) return finderEmptyHTML(f, kind);
    return `<div class="picks-head">
        <div><h2>Top ${kind}picks for ${peso(f.budget)}</h2>
          <p>${fits.length ? `${fits.length} ${kind}bike${fits.length === 1 ? " fits" : "s fit"} this budget.` : `No ${kind}bikes at this budget yet. These are the closest.`}${t ? "" : " Choose where you ride for sharper picks."}</p></div>
        <div class="picks-actions">
          ${picks.length > 1 ? `<button class="btn btn-ghost btn-sm" data-action="compare-picks">${icon("compare", 16)}Compare these ${picks.length}</button>` : ""}
          <a class="btn btn-sm" href="${url(listing)}?max=${f.budget}">All ${kind}bikes up to ${pesoK(f.budget)}${icon("arrow", 16)}</a>
        </div>
      </div>
      ${pickCards(picks, f)}`;
  }

  // Bike Finder page: picks plus the full ranked list
  function finderFullHTML() {
    const f = S.finder, { picks, ranked } = finderPicks(f);
    const t = terrainOf(f.terrain);
    const kind = t ? t.kind + " " : "";
    const fits = ranked.filter((r) => r.inBudget && r.terrainMatch);
    const alts = ranked.filter((r) => r.inBudget && r.related && !r.terrainMatch);
    const over = ranked.filter((r) => r.stretch && r.terrainMatch);
    const row = (r, i) => {
      const p = r.p, href = url(PATHS.product(p));
      return `<article class="match-row ${r.inBudget ? "" : "over"}" data-id="${p.id}">
        <a class="thumb" href="${href}" tabindex="-1" aria-hidden="true">${art(p, 0, false)}</a>
        <div><span class="card-meta">${i != null ? `#${i + 1} · ` : ""}${esc(metaLine(p))}</span><h3><a href="${href}">${esc(p.name)}</a></h3>
          <p class="why">${reasonsFor(r, f).map(esc).join(" · ")}</p>
          <div class="match-meter"><i><b style="width:${r.score}%"></b></i>${r.score}% match</div></div>
        <div class="side"><span class="price">${peso(p.price)}</span><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" data-action="quick" data-id="${p.id}">${icon("eye", 16)}Quick view</button>${compareBtn(p, "btn btn-ghost btn-sm")}</div></div>
      </article>`;
    };
    if (!picks.length) return finderEmptyHTML(f, kind);
    return `<div class="picks-head" style="margin-top:0">
        <div><h2>Your top picks</h2><p>${fits.length ? `${fits.length} ${kind}bike${fits.length === 1 ? "" : "s"} within ${peso(f.budget)}.` : `No ${kind}bikes within ${peso(f.budget)} yet. These are the closest.`}</p></div>
        ${picks.length > 1 ? `<div class="picks-actions"><button class="btn btn-sm" data-action="compare-picks">${icon("compare", 16)}Compare these ${picks.length}</button></div>` : ""}
      </div>
      ${pickCards(picks, f)}
      ${fits.length ? `<h3 class="subhead">All matches, best first</h3><div class="match-list">${fits.map(row).join("")}</div>` : ""}
      ${over.length ? `<h3 class="subhead">A little over budget</h3><div class="match-list">${over.map((r) => row(r)).join("")}</div>` : ""}
      ${alts.length ? `<h3 class="subhead">Close alternatives in your budget</h3><div class="match-list">${alts.map((r) => row(r)).join("")}</div>` : ""}`;
  }

  function viewFinder() {
    // Address -> answers, so a set of picks can be shared as a link
    const q = currentQuery(), f = S.finder;
    const pick = (k, list, fallback) => (q.has(k) && list.includes(q.get(k)) ? q.get(k) : fallback);
    if (+q.get("budget") >= 1000) f.budget = Math.round(+q.get("budget"));
    f.terrain = pick("ride", terrainsOffered().map((t) => t.v), f.terrain);
    if (f.terrain && !terrainsOffered().some((t) => t.v === f.terrain)) f.terrain = "";
    f.goal = pick("goal", GOALS.map((g) => g.v), f.goal);
    f.level = pick("level", LEVELS.map((l) => l.v), f.level);
    f.assist = pick("assist", ["any", "only", "none"], f.assist);
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          ${crumbsHTML([{ name: "Bike Finder" }])}
          <h1>Bike Finder</h1>
          <p class="page-intro">${esc(D.pages.finder.intro)}</p>
        </div>
        <div class="finder-layout">
          <aside class="finder-panel" aria-label="Your preferences">${finderControls("full")}</aside>
          <section id="finderResults" data-mode="full" aria-live="polite" aria-label="Your picks">${finderFullHTML()}</section>
        </div>
      </div>`;
    setMeta({ title: D.pages.finder.seoTitle, description: D.pages.finder.metaDescription, crumbs: [{ name: "Bike Finder", path: PATHS.finder }] });
  }

  // Re-draws the picks after any change, without rebuilding the controls (keeps the slider in hand)
  function refreshFinder(from) {
    const f = S.finder;
    save();
    $$('[data-action="finder-set"]').forEach((b) => { const on = f[b.dataset.k] === b.dataset.v; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    $$('[data-action="finder-budget"]').forEach((b) => b.classList.toggle("on", +b.dataset.v === f.budget));
    const range = $("#budgetRange"), input = $("#budgetInput");
    if (range) { if (from !== "range") range.value = f.budget; range.style.setProperty("--fill", budgetPct(f.budget) + "%"); }
    if (input && from !== "input") input.value = f.budget.toLocaleString("en-PH");
    const box = $("#finderResults");
    if (!box) return;
    const full = box.dataset.mode === "full";
    box.innerHTML = full ? finderFullHTML() : finderPicksHTML();
    if (full) setQuery({ budget: f.budget, ride: f.terrain, goal: f.goal, level: f.level, assist: f.assist === "any" ? "" : f.assist });
    award("matchmaker");
  }

  /* =======================================================
     DAILY SPIN
     ======================================================= */
  function today() { return new Date().toISOString().slice(0, 10); }
  let spinning = false, spinRot = 0;

  function wheelSVG() {
    const n = D.spinPrizes.length, seg = 360 / n, r = 150, c = 160;
    const palette = ["#3c78c6", "#1c2126", "#92694b", "#eeebe3"];
    const ink = ["#fff", "#eeebe3", "#fff", "#1c2126"];
    return `<svg viewBox="0 0 320 320" id="wheelSvg">
      ${D.spinPrizes.map((pr, i) => {
        const a0 = ((i * seg - 90 - seg / 2) * Math.PI) / 180, a1 = (((i + 1) * seg - 90 - seg / 2) * Math.PI) / 180;
        const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0), x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
        const mid = i * seg;
        return `<path d="M${c} ${c} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z" fill="${palette[i % 4]}" stroke="#fff" stroke-width="2"/>
          <text x="${c}" y="${c - r + 34}" transform="rotate(${mid} ${c} ${c})" text-anchor="middle" font-family="Inter, sans-serif" font-style="italic" font-weight="800" font-size="15" fill="${ink[i % 4]}">${pr.label}</text>`;
      }).join("")}
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#1c2126" stroke-width="6"/>
    </svg>`;
  }

  function renderSpin() {
    const done = S.lastSpin === today();
    $("#spinCard").innerHTML = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">${icon("close")}</button>
      <div class="spin-wrap">
        <h2>Daily Spin</h2>
        <p class="muted">One spin a day. Win discount codes, free shipping or bonus XP.</p>
        <div class="wheel-box"><div class="wheel-pointer"></div>${wheelSVG()}<div class="wheel-hub">SPIN</div></div>
        <div class="spin-result" id="spinResult">${done ? "You've already spun today. Come back tomorrow! 🌅" : ""}</div>
        <button class="btn btn-brand" data-action="do-spin" ${done ? "disabled" : ""}>${done ? "Come back tomorrow" : "Spin the wheel"}</button>
      </div>`;
    $("#wheelSvg").style.transform = `rotate(${spinRot}deg)`;
  }

  function doSpin() {
    if (spinning || S.lastSpin === today()) return;
    spinning = true;
    const n = D.spinPrizes.length, seg = 360 / n;
    const idx = Math.floor(Math.random() * n);
    // Rotate so that segment idx lands under the top pointer
    const target = 360 * 6 + (360 - idx * seg);
    spinRot = spinRot - (spinRot % 360) + target;
    $("#wheelSvg").style.transform = `rotate(${spinRot}deg)`;
    $("[data-action=do-spin]").disabled = true;
    setTimeout(() => {
      spinning = false;
      const pr = D.spinPrizes[idx];
      S.lastSpin = today(); save();
      let msg;
      if (pr.code) {
        if (!S.codes.includes(pr.code)) S.codes.push(pr.code);
        S.appliedCode = pr.code; save();
        msg = `🎉 You won <b>${pr.label}</b>! Code applied to your cart:<br><span class="code-pill">${pr.code}</span>`;
        confetti();
      } else if (pr.xp) {
        msg = `⭐ Bonus <b>${pr.xp} XP</b> added!`;
        addXP(pr.xp, "Spin bonus");
        confetti();
      } else {
        msg = "So close! Come back tomorrow for another spin. 🚴";
      }
      $("#spinResult").innerHTML = msg;
      $("[data-action=do-spin]").textContent = "Come back tomorrow";
      award("lucky");
    }, 4600);
  }

  /* =======================================================
     COMPARE
     ======================================================= */
  const COMPARE_MAX = 3;
  let cmpDiffOnly = false;

  function toggleCompare(id) {
    const i = S.compare.indexOf(id);
    if (i >= 0) S.compare.splice(i, 1);
    else {
      if (S.compare.length >= COMPARE_MAX) { toast(`You can compare ${COMPARE_MAX} bikes at a time. Remove one first.`); return; }
      S.compare.push(id);
    }
    save();
    syncCompare();
    if (S.compare.length >= 2) award("analyst");
  }
  function setCompare(ids) {
    S.compare = ids.filter((id) => byId(id)).slice(0, COMPARE_MAX);
    save();
    syncCompare();
    renderCompare();
    openPanel("#compareModal");
    if (S.compare.length >= 2) award("analyst");
  }
  function syncCompare() {
    $$('[data-action="compare"]').forEach((b) => {
      const on = S.compare.includes(b.dataset.id);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on);
      const label = b.querySelector("span"), ic = b.querySelector(".i");
      if (label) label.textContent = on ? "Comparing" : "Compare";
      if (ic) ic.outerHTML = icon(on ? "check" : "compare", 16);
    });
    renderCompareTray();
  }

  // The bar at the bottom of the screen that collects bikes to compare
  function renderCompareTray() {
    const tray = $("#compareTray");
    const items = S.compare.map(byId).filter(Boolean);
    tray.hidden = !items.length || !!$(".modal.open, .drawer.open, .search-panel.open, .filters.open, .main-nav.open");
    if (tray.hidden) return;
    tray.innerHTML = `<span class="label">${icon("compare", 16)} Compare</span>
      <div class="slots">${items.map((p) => `<button class="tray-item" data-action="compare-remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)} from compare"><span>${esc(p.name)}</span>${icon("close", 14)}</button>`).join("")}</div>
      <button class="btn btn-brand btn-sm" data-action="open-compare" ${items.length < 2 ? "disabled" : ""}>${items.length < 2 ? "Add 1 more" : `Compare ${items.length}`}</button>
      <button class="clear" data-action="compare-clear">Clear</button>`;
  }

  function renderCompare() {
    const items = S.compare.map(byId).filter(Boolean);
    const box = $("#compareCard");
    const close = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">${icon("close")}</button>`;
    if (!items.length) {
      box.innerHTML = `${close}<div class="empty"><div class="big">${icon("compare", 44)}</div><h2>Nothing to compare yet</h2><p>Tap Compare on up to ${COMPARE_MAX} bikes to see their specs side by side.</p><a class="btn btn-brand" href="${url(PATHS.bikes)}" data-action="close-all">Browse bikes</a></div>`;
      return;
    }
    const many = items.length > 1;
    const lowest = Math.min(...items.map((p) => p.price));
    const weights = items.map(weightOf);
    const lightest = Math.min(...weights.filter((w) => w != null));
    const row = (label, vals, best = () => false) => {
      const same = new Set(vals.map((v) => v || "—")).size === 1;
      return `<tr class="${many && same ? "same" : ""}"><th scope="row">${esc(label)}</th>${vals.map((v, i) => `<td data-label="${esc(label)}" class="${many && !same && best(i) ? "best" : ""}">${esc(v || "—")}</td>`).join("")}</tr>`;
    };
    box.innerHTML = `${close}
      <div class="cmp-head"><h2>Compare bikes</h2>${many ? `<label class="check"><input type="checkbox" id="cmpDiff" ${cmpDiffOnly ? "checked" : ""}> Show differences only</label>` : `<p class="muted">Add another bike to compare.</p>`}</div>
      <div style="overflow-x:auto"><table class="cmp-table ${cmpDiffOnly && many ? "diff-only" : ""}" id="cmpTable">
        <thead><tr><th scope="row"><span class="sr-only">Spec</span></th>${items.map((p) => `<td><a class="thumb" href="${url(PATHS.product(p))}" data-action="close-all" tabindex="-1" aria-hidden="true">${art(p, 0, false)}</a><a href="${url(PATHS.product(p))}" data-action="close-all"><b>${esc(p.name)}</b></a><span class="card-meta">${esc(metaLine(p))}</span></td>`).join("")}</tr></thead>
        <tbody>
          ${row("Price", items.map((p) => peso(p.price) + (onSale(p) ? ` (was ${peso(p.compareAt)})` : "")), (i) => items[i].price === lowest)}
          ${items.some((p) => p.brand) ? row("Brand", items.map((p) => p.brand)) : ""}
          ${row(items.some((p) => p.bestFor) ? "Best for" : "Highlight", items.map((p) => p.bestFor || (p.highlights || [])[0]))}
          ${specKeys(items).map((k) => row(k, items.map((p) => (p.specs || {})[k]), k === "Weight" ? (i) => weights[i] === lightest : undefined)).join("")}
        </tbody>
        <tfoot><tr><th scope="row"></th>${items.map((p) => `<td><button class="btn btn-brand btn-sm" data-action="quick" data-id="${p.id}">${isBike(p) ? "Choose size" : "View"}</button> <button class="link-btn muted" data-action="compare-remove" data-id="${p.id}" style="margin-left:8px">Remove</button></td>`).join("")}</tr></tfoot>
      </table></div>`;
  }

  /* =======================================================
     SEARCH
     ======================================================= */
  // "road 50k", "mtb under 40000": words match products, a number is read as a budget
  function parseSearch(text) {
    let budget = null;
    const words = text.toLowerCase().replace(/[₱,]/g, "").split(/\s+/).filter(Boolean).filter((w) => {
      const m = /^(\d+(?:\.\d+)?)(k)?$/.exec(w);
      if (m) { const n = +m[1] * (m[2] ? 1000 : 1); if (n >= 3000) { budget = n; return false; } }
      return !["under", "below", "budget", "php", "pesos", "bike", "bikes", "for", "the", "a", "up", "to"].includes(w);
    }).map((w) => ({ mtb: "mountain", ebike: "electric", "e-bike": "electric", commuter: "city" }[w] || w));
    return { words, budget };
  }
  function searchHits(text) {
    const { words, budget } = parseSearch(text);
    if (!words.length && budget == null) return { hits: [], budget };
    const hits = D.products.map((p) => {
      const c = catOf(p.category) || {};
      const name = p.name.toLowerCase();
      const hay = [p.name, p.brand, p.model, p.year, c.label, c.singular, p.bestFor, p.description, (p.highlights || []).join(" "), (p.variants || []).map((v) => v.sku).join(" "), colorsOf(p).map((x) => x.name).join(" "), Object.entries(p.specs || {}).map((e) => e.join(" ")).join(" "), p.fit ? Object.values(p.fit).filter(Boolean).join(" ") : ""].join(" ").toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      if (budget != null && (!isBike(p) || p.price > budget * (1 + D.finder.stretch))) return null;
      const kind = `${c.label || ""} ${c.singular || ""}`.toLowerCase();
      return { p, score: words.reduce((s, w) => s + (name.startsWith(w) ? 3 : name.includes(w) ? 2 : 1) + (kind.includes(w) ? 3 : 0), 0) + (budget != null && p.price <= budget ? 1 : 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score || (budget != null ? b.p.price - a.p.price : 0)).slice(0, 8).map((x) => x.p);
    return { hits, budget };
  }
  function renderSearch(text = "") {
    const box = $("#searchResults");
    const hitRow = (p) => `<a class="search-hit" href="${url(PATHS.product(p))}" data-action="close-all"><span class="thumb">${art(p, 0, false)}</span><span><strong>${esc(p.name)}</strong><small>${esc(metaLine(p))}</small></span><span class="price">${peso(p.price)}</span></a>`;
    const browse = `<div class="chip-list">${D.categories.map((c) => `<a class="chip" href="${url(PATHS.cat(c))}" data-action="close-all">${esc(c.type === "bike" ? c.label + " bikes" : c.label)}</a>`).join("")}<a class="chip" href="${url(PATHS.sale)}" data-action="close-all">Sale</a></div>`;
    if (!text.trim()) {
      box.innerHTML = `<h4>Browse</h4>${browse}<h4>Shopping on a budget?</h4><p class="muted">Type an amount, like <b>50k</b> or <b>road 80000</b>, to see what fits.</p>`;
      return;
    }
    const { hits, budget } = searchHits(text);
    const budgetLinks = budget != null ? `<div class="chip-list" style="margin:6px 0 4px">
        <a class="chip on" href="${url(PATHS.finder)}?budget=${budget}" data-action="close-all">${icon("target", 16)}Best picks for ${peso(budget)}</a>
        <a class="chip" href="${url(PATHS.bikes)}?max=${budget}" data-action="close-all">All bikes up to ${peso(budget)}</a></div>` : "";
    box.innerHTML = hits.length
      ? `${budgetLinks}<h4>${hits.length} result${hits.length === 1 ? "" : "s"}</h4>${hits.map(hitRow).join("")}`
      : `${budgetLinks}<h4>No results for "${esc(text.trim())}"</h4><p class="muted" style="margin-bottom:10px">Check the spelling, or browse a category.</p>${browse}`;
  }
  function openSearch() {
    const input = $("#searchInput");
    input.value = "";
    renderSearch("");
    openPanel("#searchPanel");
  }

  /* =======================================================
     CONFETTI
     ======================================================= */
  function confetti() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = $("#confetti"), ctx = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#3c78c6";
    const colors = [brand, "#1c2126", "#92694b", "#eeebe3", "#6e9fde"];
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight / 2,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4, s: Math.random() * 8 + 4,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[(Math.random() * colors.length) | 0]
    }));
    let frame = 0;
    (function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => {
        p.vy += 0.45; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      });
      if (++frame < 150) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* =======================================================
     EVENTS
     ======================================================= */
  function pickSize(el, size) {
    const sel = selOf(el), root = rootOf(el);
    sel.size = size;
    refreshSelection(root, sel);
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const a = el.dataset.action, id = el.dataset.id;
    switch (a) {
      case "toggle-menu": {
        const open = !$("#mainNav").classList.contains("open");
        closeAll(true);
        if (open) { $("#mainNav").classList.add("open"); document.body.classList.add("menu-open"); $("#overlay").classList.add("show"); document.body.style.overflow = "hidden"; }
        renderCompareTray();
        break;
      }
      case "close-all": closeAll(); break;
      case "open-cart": renderCart(); openPanel("#cartDrawer"); break;
      case "open-spin": renderSpin(); openPanel("#spinModal"); break;
      case "open-search": openSearch(); break;
      case "open-compare": renderCompare(); openPanel("#compareModal"); break;
      case "go-rewards": navigate(PATHS.rewards); break;

      case "add":
        e.preventDefault();
        addToCart(id);
        if ($("#cartDrawer").classList.contains("open")) renderCart();
        break;
      case "fav": {
        const i = S.favs.indexOf(id);
        if (i >= 0) S.favs.splice(i, 1); else { S.favs.push(id); toast("Saved to favourites"); }
        save();
        $$(`[data-action="fav"][data-id="${id}"]`).forEach((b) => { const on = S.favs.includes(id); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
        renderCartCount();
        if (S.favs.length >= 3) award("collector");
        break;
      }
      case "quick": openQuick(id); break;
      case "compare": toggleCompare(id); break;
      case "compare-remove": toggleCompare(id); if ($("#compareModal").classList.contains("open")) renderCompare(); break;
      case "compare-clear": S.compare = []; save(); syncCompare(); break;
      case "compare-picks": { const box = el.closest("#finderResults"); setCompare(finderPicks(box && box.dataset.mode === "full" ? S.finder : homeFinder()).picks.map((r) => r.p.id)); break; }
      case "compare-set": setCompare(el.dataset.ids.split(",")); break;
      case "swatch": {
        const p = byId(id), i = +el.dataset.i;
        const cardEl = el.closest(".card");
        $(".art", cardEl).innerHTML = art(p, i, false);
        $$(".swatch", cardEl).forEach((s, k) => s.classList.toggle("active", k === i));
        break;
      }

      case "opt-color": {
        const sel = selOf(el), root = rootOf(el), p = byId(sel.id);
        sel.color = +el.dataset.i;
        autoSize(p, sel);
        showColour(root, sel);
        refreshSelection(root, sel);
        break;
      }
      case "photo": {
        const sel = selOf(el), p = byId(sel.id), u = photosOf(p, sel.color)[+el.dataset.i];
        if (u) $("#pdpArt").innerHTML = `<img src="${esc(u)}" alt="${esc(p.name)}" decoding="async">`;
        $$(".thumb", el.parentElement).forEach((b) => b.classList.toggle("on", b === el));
        break;
      }
      case "opt-size": pickSize(el, el.dataset.s); break;
      case "qty":
        PDP.qty = Math.max(1, Math.min(10, PDP.qty + +el.dataset.d));
        $("#qtyVal").textContent = PDP.qty;
        break;
      case "add-sel": {
        const sel = selOf(el), p = byId(sel.id);
        if (!p || soldOut(p)) break;
        if (needsSize(p, sel)) {
          const grid = $(".size-grid", rootOf(el));
          if (grid) { grid.classList.remove("need"); void grid.offsetWidth; grid.classList.add("need"); grid.scrollIntoView({ behavior: "smooth", block: "center" }); }
          toast("Choose a size first");
          break;
        }
        addToCart(sel.id, sel.qty, { size: sel.size, color: sel.color, quiet: true });
        renderCart(); openPanel("#cartDrawer");
        break;
      }

      case "line-qty": {
        const l = S.cart.find((x) => x.key === el.dataset.key);
        if (!l) break;
        l.qty += +el.dataset.d;
        if (l.qty <= 0) S.cart = S.cart.filter((x) => x !== l);
        save(); renderCartCount(); renderCart(); checkCartBadges();
        break;
      }
      case "line-remove":
        S.cart = S.cart.filter((x) => x.key !== el.dataset.key);
        save(); renderCartCount(); renderCart();
        break;
      case "apply-code": {
        const v = $("#codeIn").value.trim().toUpperCase();
        const ok = D.spinPrizes.find((x) => x.code === v) && S.codes.includes(v);
        if (!v) { S.appliedCode = null; save(); renderCart(); break; }
        if (ok) { S.appliedCode = v; save(); toast(`Code ${v} applied`); }
        else toast("That code isn't valid. You can win codes from the Daily Spin.");
        renderCart();
        break;
      }
      case "order-open": openOrder(); break;
      case "order-send": e.preventDefault(); sendOrder(el.dataset.via); break;
      case "order-copy": copyText(order ? order.text : "", $("#orderText")).then((ok) => { el.innerHTML = icon("check", 16) + (ok ? "Copied" : "Select the text above to copy"); }); break;
      case "order-clear": S.cart = []; S.appliedCode = null; save(); renderCartCount(); closeAll(); toast("Cart cleared"); break;
      case "ask": askAbout(id); break;
      case "do-spin": doSpin(); break;

      case "finder-set": S.finder[el.dataset.k] = el.dataset.v; refreshFinder(); break;
      case "finder-budget": S.finder.budget = +el.dataset.v; refreshFinder(); break;
      case "finder-reset": S.finder = fresh().finder; refreshFinder(); break;

      case "open-filters": closeAll(true); $("#filters").classList.add("open"); $("#overlay").classList.add("show"); document.body.style.overflow = "hidden"; renderCompareTray(); break;
      case "close-filters": closeAll(); break;
      case "filter-toggle": if (shop) shop.toggle(el.dataset.k, el.dataset.v); break;
      case "filter-band": if (shop) shop.band(+el.dataset.min, el.dataset.max === "" ? null : +el.dataset.max); break;
      case "filter-remove": if (shop) shop.remove(el.dataset.k, el.dataset.v); break;
      case "clear-filters": if (shop) shop.clear(); break;

      case "reset":
        // Two-step confirm in the page itself (no browser dialogs)
        if (el.dataset.armed !== "1") {
          el.dataset.armed = "1";
          el.textContent = "Tap again to erase XP, badges, cart and favourites";
          setTimeout(() => { if (el.isConnected) { el.dataset.armed = ""; el.textContent = "Reset my progress"; } }, 4000);
          break;
        }
        S = fresh();
        save(); renderXP(); renderCartCount(); route();
        toast("Progress reset");
        break;
    }
  });

  // Typing and sliders
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "budgetRange") { S.finder.budget = +t.value; refreshFinder("range"); }
    else if (t.id === "budgetInput") {
      const n = +t.value.replace(/[^\d]/g, "");
      if (n >= 1000 && n <= 5000000) { S.finder.budget = n; refreshFinder("input"); }
    }
    else if (t.id === "priceRange") { if (shop) shop.slide(+t.value, false); }
    else if (t.id === "searchInput") renderSearch(t.value);
    else if (t.matches("[data-height]")) {
      const h = +t.value, msg = $(".size-msg", rootOf(t));
      if (!h) { msg.textContent = ""; return; }
      if (h < 100) return; // still typing
      const sizes = D.sizes, sel = selOf(t), p = byId(sel.id);
      const z = sizes.find((x) => h >= x.min && h < x.max) || (h === sizes[sizes.length - 1].max ? sizes[sizes.length - 1] : null);
      const offered = sizeOptions(p, sel.color);
      if (z && offered.includes(z.s)) { pickSize(t, z.s); msg.textContent = `Size ${z.s} fits ${h} cm`; }
      else if (z) msg.textContent = `We'd suggest size ${z.s} for ${h} cm. Ask us about it.`;
      else msg.textContent = `Our sizes fit riders ${sizes[0].min}–${sizes[sizes.length - 1].max} cm`;
    }
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "budgetInput") t.value = S.finder.budget.toLocaleString("en-PH");
    else if (t.id === "priceRange") { if (shop) shop.slide(+t.value, true); }
    else if (t.id === "sortSel") { if (shop) shop.sort(t.value); }
    else if (t.id === "fSale") { if (shop) shop.sale(t.checked); }
    else if (t.id === "cmpDiff") { cmpDiffOnly = t.checked; $("#cmpTable").classList.toggle("diff-only", cmpDiffOnly); }
  });

  document.addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (e.key === "Escape") closeAll();
    else if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) { e.preventDefault(); openSearch(); }
    else if (e.key === "Enter" && e.target.id === "searchInput") { const first = $("#searchResults .search-hit"); if (first) first.click(); }
    else if (e.key === "Enter" && e.target.id === "codeIn") { const b = $('[data-action="apply-code"]'); if (b) b.click(); }
    else if (e.key === "Enter" && e.target.id === "budgetInput") e.target.blur();
    else if (e.key === "Enter" && e.target.closest && e.target.closest("#orderForm") && e.target.tagName === "INPUT") { e.preventDefault(); const b = $('#orderForm [data-action="order-send"]'); if (b) b.click(); }
  });

  // Scroll "ride" progress bar
  function onScroll() {
    const h = document.documentElement.scrollHeight - innerHeight;
    const pct = h > 0 ? (scrollY / h) * 100 : 0;
    $(".ride-fill").style.width = pct + "%";
    const bike = $(".ride-bike");
    bike.style.left = pct + "%";
    bike.style.opacity = scrollY > 40 ? 1 : 0;
  }
  addEventListener("scroll", onScroll, { passive: true });

  /* =======================================================
     ROUTER
     ======================================================= */
  function route(opts = {}) {
    const path = currentPath();
    const segs = path.split("/").filter(Boolean);
    const [a, b] = segs;
    clearBuyBar();
    closeAll(true);
    lastFocus = null;
    shop = null;
    if (!a) viewHome();
    else if ((a === "bikes" || (a === "parts" && HAS_PARTS)) && segs.length === 1) viewShop(a);
    else if ((a === "bikes" || a === "parts") && segs.length === 2 && catOf(b) && catOf(b).type === a.slice(0, -1)) viewShop(b);
    else if ((a === "sale" || a === "favourites") && segs.length === 1) viewShop(a);
    else if (a === "bike-finder" && segs.length === 1) viewFinder();
    else if (a === "rewards" && segs.length === 1) viewRewards();
    else if (a === "how-to-order" && segs.length === 1) viewHowToOrder();
    else if (a === "products" && segs.length === 2 && bySlug(b)) viewProduct(bySlug(b).id);
    else if (a === "products" && segs.length === 2 && skuIndex.has(b)) viewProduct(skuIndex.get(b).p.id, skuIndex.get(b).v);
    else viewNotFound();
    $$(".main-nav a[data-path]").forEach((l) => { if (a && l.dataset.path === a + "/") l.setAttribute("aria-current", "page"); else l.removeAttribute("aria-current"); });
    window.scrollTo(0, opts.y || 0);
    onScroll();
    renderCompareTray();
    document.documentElement.dataset.route = path; // lets the build know the page has rendered
  }
  // Page changes cross-fade where the browser supports it
  function go(opts) {
    const run = () => route(opts);
    if (!PRERENDER && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(run);
    else run();
  }

  if (MODE === "hash") addEventListener("hashchange", () => { if (!location.hash || location.hash.startsWith("#/")) go(); });
  else {
    try { history.scrollRestoration = "manual"; } catch (e) { /* ignore */ }
    addEventListener("popstate", () => go({ y: (history.state || {}).y || 0 }));
    addEventListener("hashchange", () => { const lp = legacyHashPath(); if (lp !== null) { history.replaceState(null, "", url(lp)); go(); } });
    // Internal links change the page without a full reload
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest("a[href]");
      if (!a || a.target || a.hasAttribute("download")) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || !u.pathname.startsWith(BASE) || u.hash) return;
      e.preventDefault();
      if (u.pathname + u.search !== location.pathname + location.search) { saveScroll(); history.pushState(null, "", u.pathname + u.search); go(); }
      else { closeAll(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
    });
  }

  /* =======================================================
     INIT
     ======================================================= */
  function buildMega() {
    const tile = (c) => {
      const sample = D.products.find((p) => p.category === c.id);
      return `<a class="mega-tile" href="${url(PATHS.cat(c))}">${sample ? art(sample, 0, false) : ""}<strong>${esc(c.label)}</strong><span>${esc(c.blurb)}</span></a>`;
    };
    $("#megaBikes").innerHTML = `<div class="mega-inner">${D.categories.filter((c) => c.type === "bike").map(tile).join("")}
      <a class="mega-tile finder-tile" href="${url(PATHS.finder)}"><strong>Not sure which?</strong><span>Tell us your budget and we'll pick for you.</span></a></div>`;
    const parts = $("#megaParts");
    if (parts) parts.innerHTML = `<div class="mega-inner">${D.categories.filter((c) => c.type === "part").map(tile).join("")}</div>`;
  }

  // Header and footer: draw icons, and point links at the right base address
  $$("[data-icon]").forEach((el) => { el.outerHTML = icon(el.dataset.icon, +el.dataset.size || 20); });
  // No parts in the catalog yet: hide the Parts & Gear links
  if (!HAS_PARTS) $$('[data-path="parts/"]').forEach((a) => (a.closest(".nav-item") || a).remove());
  $$("[data-path]").forEach((a) => a.setAttribute("href", url(a.dataset.path)));
  if (MODE === "path") { const lp = legacyHashPath(); if (lp !== null) history.replaceState(null, "", url(lp)); }

  $("#promoThreshold").textContent = peso(D.freeShippingThreshold);
  $("#year").textContent = new Date().getFullYear();
  buildMega();
  renderXP();
  renderCartCount();
  route();

  // Used by the build script to list every page and draw social images
  if (PRERENDER) {
    window.__CC__ = {
      routes: [
        { path: PATHS.home, priority: "1.0" },
        { path: PATHS.bikes, priority: "0.9" }, ...(HAS_PARTS ? [{ path: PATHS.parts, priority: "0.9" }] : []),
        { path: PATHS.finder, priority: "0.9" },
        ...D.categories.map((c) => ({ path: PATHS.cat(c), priority: "0.8" })),
        { path: PATHS.sale, priority: "0.7" },
        ...D.products.map((p) => ({ path: PATHS.product(p), priority: "0.7" })),
        // One page per SKU (shared on Facebook); they point search engines at their model page
        ...[...skuIndex.keys()].map((k) => ({ path: `products/${k}/`, variant: true })),
        { path: PATHS.order, priority: "0.6" },
        { path: PATHS.rewards, priority: "0.4" },
        { path: PATHS.favourites, noindex: true }
      ],
      brandArt: bikeSVG("#3c78c6", "road"),
      products: D.products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: (p.priceFrom ? "From " : "") + peso(p.price), compareAt: onSale(p) ? peso(p.compareAt) : "", category: (catOf(p.category) || {}).singular || "", hasImage: !!photoOf(p), art: art(p, 0, false) }))
    };
  }
})();
