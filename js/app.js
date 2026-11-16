(function () {
  "use strict";

  const D = window.CC_DATA;
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

  const PATHS = {
    home: "", bikes: "bikes/", parts: "parts/", sale: "sale/", favourites: "favourites/", rewards: "rewards/", finder: "bike-finder/",
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
  const productImage = (p) => (p.image ? absAsset(p.image) : absUrl(`og/products/${p.slug}.png`));

  function setMeta({ title, description, image, imageAlt, type = "website", noindex = false, crumbs = [], product = null }) {
    document.title = title ? `${title} | ${D.site.name}` : `${D.site.name} | ${D.site.tagline}`;
    if (MODE === "hash") return; // the preview build has no public address to describe
    const head = document.head;
    const find = (sel, make) => { let el = head.querySelector(sel); if (!el) { el = make(); head.appendChild(el); } return el; };
    const named = (n, v) => { find(`meta[name="${n}"]`, () => { const m = document.createElement("meta"); m.setAttribute("name", n); return m; }).setAttribute("content", v); };
    const prop = (n, v) => { find(`meta[property="${n}"]`, () => { const m = document.createElement("meta"); m.setAttribute("property", n); return m; }).setAttribute("content", v); };

    const path = currentPath();
    const canonical = absUrl(path);
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
    prop("og:url", canonical);
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
      prop("product:price:amount", String(product.price));
      prop("product:price:currency", D.site.currency);
      prop("product:availability", product.stock === 0 ? "out of stock" : "in stock");
    }

    // Structured data for Google (schema.org)
    const org = {
      "@type": "OnlineStore", "@id": SITE + BASE + "#organization", name: D.site.name, url: absUrl(),
      logo: { "@type": "ImageObject", url: absAsset("assets/logo-512.png"), width: 512, height: 512 },
      description: D.site.description
    };
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
      const p = product, cat = catOf(p.category);
      const offer = {
        "@type": "Offer", url: canonical, priceCurrency: D.site.currency, price: p.price,
        availability: p.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", // stock left blank = in stock
        itemCondition: "https://schema.org/NewCondition", seller: { "@id": org["@id"] }
      };
      if (p.compareAt) {
        offer.priceSpecification = [
          { "@type": "UnitPriceSpecification", price: p.price, priceCurrency: D.site.currency },
          { "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice", price: p.compareAt, priceCurrency: D.site.currency }
        ];
      }
      graph.push({
        "@type": "Product", "@id": canonical + "#product", name: p.name, description: productDescription(p),
        sku: p.id, image: [productImage(p)], category: cat ? cat.singular || cat.label : undefined,
        url: canonical, offers: offer
      });
    }
    find("#ld-json", () => { const sc = document.createElement("script"); sc.type = "application/ld+json"; sc.id = "ld-json"; return sc; })
      .textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }

  function productDescription(p) {
    if (p.description) return p.description;
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
    lastSpin: null, codes: [], appliedCode: null, orders: 0,
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
    { id: "podium",      icon: "🥇", name: "Podium Finish",  desc: "Complete a checkout",            xp: 150 }
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

  const onSale = (p) => !!p.compareAt && p.compareAt > p.price;
  const soldOut = (p) => p.stock === 0;
  const weightOf = (p) => { const m = /([\d.]+)\s*kg/i.exec((p.specs || {}).Weight || ""); return m ? +m[1] : null; };
  const frameOf = (p) => ((p.specs || {}).Frame || "").split(/[ ,]/)[0];
  const metaLine = (p) => { const c = catOf(p.category); return [c ? c.singular || c.label : "", isBike(p) && p.fit ? LEVEL_LABEL[p.fit.level] : ""].filter(Boolean).join(" · "); };
  const metaHTML = (p) => { const c = catOf(p.category); return `${esc(c ? c.singular || c.label : "")}${isBike(p) && p.fit ? `<span class="lvl"> · ${esc(LEVEL_LABEL[p.fit.level])}</span>` : ""}`; };
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
    if (p.image) return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`;
    if (!isBike(p)) return partSVG(p.icon, "#3c78c6", label ? p.name : "");
    const s = p.specs || {};
    return bikeSVG((p.colors || ["#3c78c6"])[colorIdx] || p.colors[0], p.category, {
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
    return `<span class="price">${peso(p.price)}${onSale(p) ? `<s>${peso(p.compareAt)}</s>` : ""}</span>${onSale(p) && withSave ? `<span class="save">Save ${peso(p.compareAt - p.price)}</span>` : ""}`;
  }
  function tagsHTML(p) {
    const tags = [];
    if (soldOut(p)) tags.push(`<span class="tag">Sold out</span>`);
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
        ${o.reasons ? `<ul class="reasons">${o.reasons.map((r) => `<li>${icon("check", 15)}<span>${esc(r)}</span></li>`).join("")}</ul>` : (p.bestFor ? `<p class="card-best">Best for ${esc(lcFirst(p.bestFor))}</p>` : "")}
        ${bike ? chipsHTML(p) : ""}
        <div class="price-row">${priceHTML(p)}${stars(p)}</div>
        ${(p.colors && p.colors.length > 1) || (p.stock > 0 && p.stock <= 5) ? `<div class="card-row">
          ${p.colors && p.colors.length > 1 ? `<div class="swatches">${p.colors.map((c, i) => `<button class="swatch ${i === 0 ? "active" : ""}" style="background:${c}" data-action="swatch" data-id="${p.id}" data-i="${i}" aria-label="Show colour ${i + 1}"></button>`).join("")}</div>` : "<span></span>"}
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

      <section class="section tight">
        <div class="wrap">
          <div class="section-head"><div><h2>Parts and gear</h2><p>Upgrade your ride or replace what's worn out.</p></div><a class="text-link" href="${url(PATHS.parts)}">Shop parts ${icon("arrow", 16)}</a></div>
          <div class="rail">${parts.map((p) => card(p)).join("")}</div>
        </div>
      </section>

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

  // Colour and size pickers, shared by the product page and quick view
  function optionsHTML(p, sel) {
    return `${p.colors && p.colors.length > 1 ? `<div class="pdp-block"><h4>Colour</h4><div class="swatches lg">${p.colors.map((col, i) => `<button class="swatch ${i === sel.color ? "active" : ""}" style="background:${col}" data-action="opt-color" data-i="${i}" aria-label="Colour ${i + 1}" aria-pressed="${i === sel.color}"></button>`).join("")}</div></div>` : ""}
      ${isBike(p) ? `<div class="pdp-block"><h4>Frame size<b class="size-picked">${sel.size || ""}</b></h4>
        <div class="size-grid">${D.sizes.map((z) => `<button class="size-btn ${sel.size === z.s ? "on" : ""}" data-action="opt-size" data-s="${z.s}" aria-pressed="${sel.size === z.s}" aria-label="Size ${z.s}, for riders ${z.min} to ${z.max} cm">${z.s}<small>${z.min}–${z.max} cm</small></button>`).join("")}</div>
        <div class="size-helper"><label for="${sel.key}Height">${icon("ruler", 16)} Not sure? Enter your height</label><input type="number" id="${sel.key}Height" inputmode="numeric" placeholder="cm" min="120" max="220" data-height><span class="size-msg" aria-live="polite"></span></div>
      </div>` : ""}`;
  }

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
          <tr><th scope="row">Price</th>${cols.map((x, i) => `<td class="${i ? "" : "this"}">${peso(x.price)}${i ? `<span class="diff">${diff(x)}</span>` : ""}</td>`).join("")}</tr>
          <tr><th scope="row">Best for</th>${cols.map((x, i) => `<td class="${i ? "" : "this"}">${esc(x.bestFor || "—")}</td>`).join("")}</tr>
          ${keys.map((k) => `<tr><th scope="row">${esc(k)}</th>${cols.map((x, i) => `<td class="${i ? "" : "this"}">${esc((x.specs || {})[k] || "—")}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table></div>
      <p style="margin-top:14px"><button class="btn btn-ghost btn-sm" data-action="compare-set" data-ids="${cols.map((x) => x.id).join(",")}">${icon("compare", 16)}Compare all specs</button></p>`;
  }

  function viewProduct(id) {
    const p = byId(id);
    if (!p) return viewNotFound();
    Object.assign(PDP, { id, size: null, color: 0, qty: 1 });
    markViewed(p);
    const c = catOf(p.category);
    const bike = isBike(p);
    const top = bike ? { name: "Bikes", path: PATHS.bikes } : { name: "Parts & Gear", path: PATHS.parts };
    const catTitle = c.type === "bike" ? `${c.label} Bikes` : c.label;
    const lvl = levelIndex();
    const related = bike
      ? D.products.filter((x) => !isBike(x)).slice(0, 6)
      : D.products.filter((x) => x.id !== p.id && x.category === p.category).concat(D.products.filter((x) => !isBike(x) && x.category !== p.category)).slice(0, 6);
    const xp = Math.max(1, Math.floor(p.price / 1000));
    const specs = p.specs ? specEntries(p) : [];

    app.innerHTML = `
      <div class="wrap">
        ${crumbsHTML([top, { name: catTitle, path: PATHS.cat(c) }, { name: p.name }], "padding-top:20px")}
        <div class="pdp">
          <div class="pdp-media" id="pdpArt">${art(p)}</div>
          <div class="pdp-buy">
            <div>
              ${tagsHTML(p)}
              <span class="card-meta" style="display:block;margin-top:${onSale(p) || p.tag ? 12 : 0}px">${esc(metaLine(p))}</span>
              <h1>${esc(p.name)}</h1>
            </div>
            <div class="price-row">${priceHTML(p)}${stars(p)}</div>
            <p class="pdp-desc">${esc(productDescription(p))}</p>
            ${glanceHTML(p)}
            ${optionsHTML(p, PDP)}
            ${p.stock > 0 && p.stock <= 5 ? `<p class="stock-low">Only ${p.stock} left in stock</p>` : ""}
            <div class="buy-row">
              <div class="qty"><button data-action="qty" data-d="-1" aria-label="Decrease quantity">${icon("minus", 16)}</button><span id="qtyVal" aria-live="polite">1</span><button data-action="qty" data-d="1" aria-label="Increase quantity">${icon("plus", 16)}</button></div>
              <button class="btn btn-brand" data-action="add-sel" ${soldOut(p) ? "disabled" : ""}>${soldOut(p) ? "Sold out" : "Add to cart"}</button>
              ${favBtn(p, "btn btn-ghost")}
            </div>
            ${bike ? `<div>${compareBtn(p, "text-link")}</div>` : ""}
            <ul class="assure">
              <li>${icon("truck")}${p.price >= D.freeShippingThreshold ? "Free shipping on this item" : `Free shipping on orders over ${peso(D.freeShippingThreshold)}`}</li>
              <li>${icon("returns")}30-day returns</li>
              <li>${icon("bolt")}${LEVEL_PERKS[lvl] ? `${D.levels[lvl].name} price at checkout: ${peso(p.price * (1 - LEVEL_PERKS[lvl] / 100))} (${LEVEL_PERKS[lvl]}% off)` : `Earn ${xp} XP in the Rider Club with this order`}</li>
            </ul>
          </div>
        </div>
        ${specs.length || bike ? `<div class="pdp-sections">
          <section>${specs.length ? `<h2>Specifications</h2><table class="spec-table"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : ""}</section>
          <section>${bike ? versusHTML(p) : ""}</section>
        </div>` : ""}
        ${related.length ? `<section class="section tight"><div class="section-head"><h2>${bike ? "Complete your build" : "You may also like"}</h2></div><div class="rail">${related.map((x) => card(x)).join("")}</div></section>` : ""}
      </div>`;
    setupBuyBar(p);
    setMeta({
      title: `${p.name} – ${c.singular || c.label}`,
      description: `${productDescription(p)} ${peso(p.price)} at ${D.site.name}.`,
      type: "product",
      image: productImage(p),
      imageAlt: p.name,
      crumbs: [top, { name: catTitle, path: PATHS.cat(c) }, { name: p.name, path: PATHS.product(p) }],
      product: p
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
  function buyLabel() { const p = byId(PDP.id); return !p ? "" : soldOut(p) ? "Sold out" : isBike(p) && !PDP.size ? "Choose size" : isBike(p) ? `Add to cart · ${PDP.size}` : "Add to cart"; }
  function setupBuyBar(p) {
    const bar = $("#buyBar");
    bar.innerHTML = `<div class="buy-bar-inner"><div class="info"><strong>${esc(p.name)}</strong><span class="price">${peso(p.price)}</span>${onSale(p) ? `<small><s>${peso(p.compareAt)}</s></small>` : ""}</div><button class="btn btn-brand" data-action="add-sel" id="buyBarBtn" ${soldOut(p) ? "disabled" : ""}>${buyLabel()}</button></div>`;
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
    Object.assign(QV, { id, size: null, color: 0, qty: 1 });
    const specs = p.specs ? specEntries(p) : [];
    $("#quickCard").innerHTML = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">${icon("close")}</button>
      <div class="quick">
        <div class="quick-media" id="quickArt">${art(p)}</div>
        <div class="quick-info">
          <div><span class="card-meta">${esc(metaLine(p))}</span><h2>${esc(p.name)}</h2></div>
          <div class="price-row">${priceHTML(p)}${stars(p)}</div>
          ${p.bestFor ? `<p class="card-best">Best for ${esc(lcFirst(p.bestFor))}</p>` : ""}
          ${glanceHTML(p)}
          ${optionsHTML(p, QV)}
          <div class="buy-row"><button class="btn btn-brand" data-action="add-sel" ${soldOut(p) ? "disabled" : ""}>${soldOut(p) ? "Sold out" : "Add to cart"}</button>${favBtn(p, "btn btn-ghost")}</div>
          <div style="display:flex;gap:8px 20px;flex-wrap:wrap"><a class="text-link" href="${url(PATHS.product(p))}" data-action="close-all">Full details ${icon("arrow", 16)}</a>${isBike(p) ? compareBtn(p, "text-link") : ""}</div>
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
              <div><b>${S.orders}</b>Orders</div>
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
          <p class="muted" style="font-size:13px;margin-top:12px">Earn XP by exploring the shop, completing missions, spinning the daily wheel, and with every purchase (1 XP per ₱1,000 spent).</p>
          ${S.codes.length ? `<div class="section-head" style="margin-top:32px"><h2>Your codes</h2></div><div class="chip-list">${S.codes.map((c) => `<span class="code-pill">${c}</span>`).join("")}</div>` : ""}
          <p style="margin-top:28px"><button class="btn btn-ghost btn-sm" data-action="reset">Reset my progress</button></p>
        </section>
      </div>`;
    setMeta({ title: D.pages.rewards.seoTitle, description: D.pages.rewards.metaDescription, crumbs: [{ name: "Rewards", path: PATHS.rewards }] });
  }

  function viewNotFound() {
    app.innerHTML = `<div class="wrap empty" style="padding-top:110px;padding-bottom:110px"><div class="big">🛞</div><h1>Flat tyre! Page not found.</h1><p>The page you're looking for doesn't exist or has moved.</p><div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn btn-brand" href="${url()}">Back to home</a><a class="btn btn-ghost" href="${url(PATHS.bikes)}">Browse bikes</a></div></div>`;
    setMeta({ title: "Page not found", noindex: true });
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
    const sub = S.cart.reduce((s, l) => s + byId(l.id).price * l.qty, 0);
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
      const p = byId(l.id);
      return `<div class="cart-line">
        <div class="thumb">${art(p, l.color, false)}</div>
        <div><strong>${esc(p.name)}</strong><small>${l.size ? "Size " + l.size + " · " : ""}${peso(p.price)}</small>
          <div style="display:flex;gap:10px;align-items:center;margin-top:6px">
            <div class="qty"><button data-action="line-qty" data-key="${l.key}" data-d="-1" aria-label="Decrease">−</button><span>${l.qty}</span><button data-action="line-qty" data-key="${l.key}" data-d="1" aria-label="Increase">+</button></div>
            <button class="remove" data-action="line-remove" data-key="${l.key}">Remove</button>
          </div></div>
        <b>${peso(p.price * l.qty)}</b>
      </div>`;
    }).join("") + (upsell.length ? `<div class="upsell"><h5>Quick adds${t.freeShip ? "" : " to unlock free shipping"}</h5>${upsell.map((p) => `<div class="upsell-item"><span>${esc(p.name)} · <b>${peso(p.price)}</b></span><button class="btn btn-sm btn-ghost" data-action="add" data-id="${p.id}">+ Add</button></div>`).join("")}</div>` : "");

    $("#cartFoot").innerHTML = `
      <div class="code-row"><input id="codeIn" placeholder="Discount code" value="${S.appliedCode || ""}" aria-label="Discount code"><button class="btn btn-sm" data-action="apply-code">Apply</button></div>
      <div class="sum-row"><span>Subtotal</span><span>${peso(t.sub)}</span></div>
      ${t.lvlPct ? `<div class="sum-row discount"><span>${LEVEL_ICONS[levelIndex()]} ${D.levels[levelIndex()].name} discount (${t.lvlPct}%)</span><span>−${peso(t.sub * t.lvlPct / 100)}</span></div>` : ""}
      ${t.codePct ? `<div class="sum-row discount"><span>Code ${S.appliedCode} (${t.codePct}%)</span><span>−${peso(t.sub * t.codePct / 100)}</span></div>` : ""}
      <div class="sum-row"><span>Shipping</span><span>${t.ship ? peso(t.ship) : "FREE"}</span></div>
      <div class="sum-row total"><span>Total</span><span>${peso(t.total)}</span></div>
      <div class="xp-hint">You'll earn ${Math.max(1, Math.floor(t.total / 1000))} XP with this order</div>
      <button class="btn btn-brand btn-block" data-action="checkout">Checkout</button>`;
  }

  function checkout() {
    const t = cartTotals();
    const xp = Math.max(1, Math.floor(t.total / 1000));
    S.cart = []; S.appliedCode = null; S.orders += 1; save();
    renderCartCount(); closeAll();
    app.innerHTML = `<div class="wrap empty" style="padding-top:90px;padding-bottom:90px">
      <div class="big">🏁</div><h1>Order placed!</h1>
      <p>Thanks for riding with Cycle Central. See you on the road. Total paid: <b>${peso(t.total)}</b></p>
      <p class="muted">(This is a demo checkout. Payment integration comes next.)</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px"><a class="btn btn-brand" href="${url(PATHS.rewards)}">See your rewards</a><a class="btn btn-ghost" href="${url()}">Keep shopping</a></div></div>`;
    window.scrollTo(0, 0);
    confetti();
    addXP(xp, "Order XP");
    setTimeout(() => award("podium"), 700);
  }

  /* =======================================================
     BIKE FINDER (budget first, then where and how you ride)
     ======================================================= */
  const budgetPct = (b) => Math.max(0, Math.min(100, ((b - D.finder.budgetMin) / (D.finder.budgetMax - D.finder.budgetMin)) * 100));
  const terrainOf = (v) => TERRAINS.find((t) => t.v === v);

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
    const ride = `<span class="field-label">Where will you ride?</span>${chips("terrain", TERRAINS, "Anywhere")}`;
    if (mode === "compact") return `${budget}<div>${ride}<p class="finder-more"><a class="text-link" href="${url(PATHS.finder)}">${icon("sliders", 16)}More options in the Bike Finder</a></p></div>`;
    return `${budget}
      <div>${ride}</div>
      <div><span class="field-label">What matters most?</span>${chips("goal", GOALS, "No preference")}</div>
      <div><span class="field-label">Your experience</span>${chips("level", LEVELS, "Any")}</div>
      <div><span class="field-label">Electric assist</span>${chips("assist", [{ v: "only", label: "E-bikes only" }, { v: "none", label: "No e-bikes" }], "Either", "any")}</div>
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
        const goal = !f.goal || fit.goal === f.goal ? 25 : 8;
        const level = f.level ? [15, 8, 0][Math.abs(order.indexOf(fit.level) - order.indexOf(f.level))] ?? 0 : 15;
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
    if (f.level ? fit.level === f.level : fit.level === "beginner") out.push(LEVEL_LABEL[fit.level]);
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
    const listing = (t ? PATHS.cat(catOf(t.cat)) : PATHS.bikes);
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
    f.terrain = pick("ride", TERRAINS.map((t) => t.v), f.terrain);
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
          ${row("Best for", items.map((p) => p.bestFor))}
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
      const hay = [p.name, c.label, c.singular, p.bestFor, p.description, Object.entries(p.specs || {}).map((e) => e.join(" ")).join(" "), p.fit ? Object.values(p.fit).join(" ") : ""].join(" ").toLowerCase();
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
    $$(".size-btn", root).forEach((b) => { const on = b.dataset.s === size; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
    const grid = $(".size-grid", root); if (grid) grid.classList.remove("need");
    const picked = $(".size-picked", root); if (picked) picked.textContent = size || "";
    const barBtn = $("#buyBarBtn"); if (barBtn && sel === PDP) barBtn.textContent = buyLabel();
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
        const sel = selOf(el), root = rootOf(el);
        sel.color = +el.dataset.i;
        (sel === QV ? $("#quickArt") : $("#pdpArt")).innerHTML = art(byId(sel.id), sel.color);
        $$('[data-action="opt-color"]', root).forEach((s, k) => { s.classList.toggle("active", k === sel.color); s.setAttribute("aria-pressed", k === sel.color); });
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
        if (isBike(p) && !sel.size) {
          const grid = $(".size-grid", rootOf(el));
          grid.classList.remove("need"); void grid.offsetWidth; grid.classList.add("need");
          grid.scrollIntoView({ behavior: "smooth", block: "center" });
          toast("Choose a frame size first");
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
      case "checkout": checkout(); break;
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
      const sizes = D.sizes;
      const z = sizes.find((x) => h >= x.min && h < x.max) || (h === sizes[sizes.length - 1].max ? sizes[sizes.length - 1] : null);
      if (z) { pickSize(t, z.s); msg.textContent = `Size ${z.s} fits ${h} cm`; }
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
    else if ((a === "bikes" || a === "parts") && segs.length === 1) viewShop(a);
    else if ((a === "bikes" || a === "parts") && segs.length === 2 && catOf(b) && catOf(b).type === a.slice(0, -1)) viewShop(b);
    else if ((a === "sale" || a === "favourites") && segs.length === 1) viewShop(a);
    else if (a === "bike-finder" && segs.length === 1) viewFinder();
    else if (a === "rewards" && segs.length === 1) viewRewards();
    else if (a === "products" && segs.length === 2 && bySlug(b)) viewProduct(bySlug(b).id);
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
    $("#megaParts").innerHTML = `<div class="mega-inner">${D.categories.filter((c) => c.type === "part").map(tile).join("")}</div>`;
  }

  // Header and footer: draw icons, and point links at the right base address
  $$("[data-icon]").forEach((el) => { el.outerHTML = icon(el.dataset.icon, +el.dataset.size || 20); });
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
        { path: PATHS.bikes, priority: "0.9" }, { path: PATHS.parts, priority: "0.9" },
        { path: PATHS.finder, priority: "0.9" },
        ...D.categories.map((c) => ({ path: PATHS.cat(c), priority: "0.8" })),
        { path: PATHS.sale, priority: "0.7" },
        ...D.products.map((p) => ({ path: PATHS.product(p), priority: "0.7" })),
        { path: PATHS.rewards, priority: "0.4" },
        { path: PATHS.favourites, noindex: true }
      ],
      brandArt: bikeSVG("#3c78c6", "road"),
      products: D.products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: peso(p.price), compareAt: onSale(p) ? peso(p.compareAt) : "", category: (catOf(p.category) || {}).singular || "", hasImage: !!p.image, art: art(p, 0, false) }))
    };
  }
})();
