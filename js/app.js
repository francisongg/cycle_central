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
  // Complete bikes only: framesets aren't suggested by the Bike Finder, as alternatives or on budget pages
  const isComplete = (p) => isBike(p) && !p.frameset;
  // Photo sizes made by the build (js/catalog.js): { "img/p/x-960.webp": { w, h, set: [[480, path], ...] } }
  const IMG = (CATALOG && CATALOG.images) || {};
  const POL = D.policies || {};
  const YEAR = new Date().getFullYear();
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

  // Brand pages (/brands/trek/): every brand, most models first
  const BRANDS = (() => {
    const m = new Map();
    D.products.forEach((p) => {
      if (!p.brand) return;
      const k = slugify(p.brand);
      if (!m.has(k)) m.set(k, { name: p.brand, slug: k, items: [] });
      m.get(k).items.push(p);
    });
    return [...m.values()].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  })();
  const brandOf = (slug) => BRANDS.find((b) => b.slug === slug);
  const brandFor = (p) => (p.brand ? brandOf(slugify(p.brand)) : null);
  // Budget pages (/bikes/under-50k/): each limit with at least 3 complete bikes, more than the
  // limit below it, and fewer than all bikes (so no page repeats another)
  const BUDGETS = (() => {
    const complete = D.products.filter(isComplete);
    const out = [];
    let prev = 0;
    for (const k of [20, 30, 40, 50, 75, 100, 150, 200, 300, 500]) {
      const n = complete.filter((p) => p.price <= k * 1000).length;
      if (n >= 3 && n > prev && n < complete.length) { out.push({ k, max: k * 1000, slug: `under-${k}k`, count: n }); prev = n; }
    }
    return out;
  })();
  const budgetOf = (slug) => BUDGETS.find((b) => b.slug === slug);
  const budgetFor = (price) => BUDGETS.find((b) => b.max >= price);
  const HAS_FRAMESETS = D.products.filter((p) => p.frameset).length >= 2;

  const PATHS = {
    home: "", bikes: "bikes/", parts: "parts/", sale: "sale/", favourites: "favourites/", rewards: "rewards/", finder: "bike-finder/", order: "how-to-order/",
    brands: "brands/", framesets: "bikes/framesets/", about: "about/", town: "town/", blog: "blog/", privacy: "privacy/",
    post: (p) => `blog/${p.slug}/`, sizeGuide: "guides/bike-size-guide/", chooseGuide: "guides/how-to-choose-a-bike/",
    cat: (c) => `${c.type === "bike" ? "bikes" : "parts"}/${c.id}/`,
    brand: (b) => `brands/${b.slug}/`,
    budget: (b) => `bikes/${b.slug}/`,
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
  const SCHEMA = "https://schema.org/";
  const ORG_ID = () => SITE + BASE + "#organization";
  // Largest copy of a photo, as a full address (for Google and share previews)
  const bigPhoto = (src) => { const m = IMG[src]; return absAsset(m ? m.set[m.set.length - 1][1] : src); };
  // Share image: the build makes a 1200x630 picture per colour from its photo, or draws one
  function productImage(p, ci = 0) {
    const c = (p.colors || [])[ci];
    const og = (c && typeof c === "object" && c.og) || p.og;
    if (og) return absUrl(og);
    const ph = photoOf(p, ci);
    return ph ? bigPhoto(ph) : absUrl(`og/products/${p.slug}.png`);
  }
  // Out-of-stock bikes from Cycle Beast can still be ordered: "back order", never sold out
  function availabilityOf(p, v) {
    if (v) return v.inStock ? "InStock" : "BackOrder";
    if (p.variants && p.variants.length) return p.variants.some((x) => x.inStock) ? "InStock" : "BackOrder";
    return p.stock === 0 ? "OutOfStock" : "InStock";
  }
  const OG_AVAIL = { InStock: "in stock", BackOrder: "available for order", OutOfStock: "out of stock" };

  // Page titles: "<title> | Cycle Central" when it fits in Google's ~65 characters, otherwise just the title
  const fullTitle = (t) => (t.length + D.site.name.length + 3 <= 65 ? `${t} | ${D.site.name}` : t);
  const andList = (list) => (list.length > 1 ? `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}` : list[0] || "");
  // Home page title names the main bike brands: "Cycle Central | Trek, Cannondale & Colnago Bikes Philippines"
  function homeTitle() {
    const names = BRANDS.filter((b) => b.items.some(isBike)).slice(0, 3).map((b) => b.name);
    for (let k = names.length; k >= 2; k--) {
      for (const tail of [" Bikes in the Philippines", " Bikes Philippines"]) {
        const t = `${D.site.name} | ${andList(names.slice(0, k))}${tail}`;
        if (t.length <= 65) return t;
      }
    }
    return `${D.site.name} | ${D.site.tagline}`;
  }

  // Store policies for Google, only when they're filled in (js/data.js, policies)
  function returnPolicyLD() {
    if (POL.returnDays == null || POL.returnDays === "") return null;
    if (+POL.returnDays === 0) return { "@type": "MerchantReturnPolicy", applicableCountry: "PH", returnPolicyCategory: SCHEMA + "MerchantReturnNotPermitted" };
    return {
      "@type": "MerchantReturnPolicy", applicableCountry: "PH", returnPolicyCategory: SCHEMA + "MerchantReturnFiniteReturnWindow",
      merchantReturnDays: +POL.returnDays, returnMethod: SCHEMA + "ReturnByMail",
      returnFees: SCHEMA + (POL.returnFees === "free" ? "FreeReturn" : "ReturnFeesCustomerResponsibility")
    };
  }
  function shippingLD(price) {
    const d = POL.deliveryDays;
    if (!Array.isArray(d) || d.length !== 2) return null;
    const days = (a, b) => ({ "@type": "QuantitativeValue", minValue: a, maxValue: b, unitCode: "DAY" });
    return {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: price >= D.freeShippingThreshold ? 0 : D.shippingFee, currency: D.site.currency },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "PH" },
      deliveryTime: { "@type": "ShippingDeliveryTime", handlingTime: days(0, 0), transitTime: days(+d[0], +d[1]) }
    };
  }
  function offerLD(p, v, pageUrl) {
    const src = v || p;
    const o = {
      "@type": "Offer", url: pageUrl, priceCurrency: D.site.currency, price: src.price,
      availability: SCHEMA + availabilityOf(p, v), itemCondition: SCHEMA + "NewCondition", seller: { "@id": ORG_ID() }
    };
    if (v) o.sku = v.sku;
    if (src.compareAt && src.compareAt > src.price) {
      o.priceSpecification = [
        { "@type": "UnitPriceSpecification", price: src.price, priceCurrency: D.site.currency },
        { "@type": "UnitPriceSpecification", priceType: SCHEMA + "StrikethroughPrice", price: src.compareAt, priceCurrency: D.site.currency }
      ];
    }
    const ship = shippingLD(src.price);
    if (ship) o.shippingDetails = ship;
    return o;
  }
  // A model with several SKUs is a ProductGroup: one variant per SKU, each with its own page and offer
  function productLD(p, canonical) {
    const cat = catOf(p.category);
    const variants = p.variants || [];
    const images = (ci, n = 4) => { const ph = photosOf(p, ci); return ph.length ? ph.slice(0, n).map(bigPhoto) : [productImage(p, ci)]; };
    const shownColour = (ci) => { const n = colorName(p, ci); return n && n !== "Standard" ? n : undefined; };
    const base = {
      name: p.name, description: productDescription(p),
      brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
      category: cat ? (p.frameset ? `${cat.label} frameset` : cat.singular || cat.label) : undefined
    };
    if (variants.length > 1) {
      const colours = new Set(variants.map((x) => x.color)).size > 1, sizes = new Set(variants.map((x) => x.size)).size > 1;
      return {
        "@type": "ProductGroup", "@id": canonical + "#product", ...base, url: canonical, productGroupID: p.slug, image: images(defaultColor(p)),
        variesBy: [colours && SCHEMA + "color", sizes && SCHEMA + "size"].filter(Boolean),
        hasVariant: variants.map((x) => {
          const vu = absUrl(`products/${x.path}/`);
          const label = [colours ? shownColour(x.color) : "", x.size].filter(Boolean).join(", ");
          return {
            "@type": "Product", name: label ? `${p.name} – ${label}` : p.name, sku: x.sku,
            color: shownColour(x.color), size: x.size || undefined, image: images(x.color, 2), url: vu, offers: offerLD(p, x, vu)
          };
        })
      };
    }
    const v = variants[0] || null;
    return {
      "@type": "Product", "@id": canonical + "#product", ...base, sku: v ? v.sku : p.id,
      color: v ? shownColour(v.color) : undefined, size: v && v.size ? v.size : undefined,
      image: images(v ? v.color : 0), url: canonical, offers: offerLD(p, v, canonical)
    };
  }
  const faqLD = (items) => ({ "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.text || f.a } })) });
  const listLD = (name, items) => ({
    "@type": "CollectionPage", name, url: absUrl(currentPath()), isPartOf: { "@id": SITE + BASE + "#website" },
    mainEntity: { "@type": "ItemList", numberOfItems: items.length, itemListElement: items.slice(0, 60).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(PATHS.product(p)), name: p.name })) }
  });

  // canonicalPath: a SKU page names its model page as the main version for search engines,
  // while its own address stays the share link (og:url) so Facebook posts keep the colour and size
  function setMeta({ title, description, image, imageAlt, type = "website", noindex = false, crumbs = [], product = null, variant = null, canonicalPath = null, schema = [] }) {
    document.title = title ? fullTitle(title) : homeTitle();
    if (MODE === "hash") return; // the preview build has no public address to describe
    const head = document.head;
    const find = (sel, make) => { let el = head.querySelector(sel); if (!el) { el = make(); head.appendChild(el); } return el; };
    const named = (n, v) => { find(`meta[name="${n}"]`, () => { const m = document.createElement("meta"); m.setAttribute("name", n); return m; }).setAttribute("content", v); };
    const prop = (n, v) => { find(`meta[property="${n}"]`, () => { const m = document.createElement("meta"); m.setAttribute("property", n); return m; }).setAttribute("content", v); };

    const path = currentPath();
    const canonical = absUrl(canonicalPath ?? path);
    const img = image || absAsset(DEFAULT_IMAGE);
    const desc = clip(description || D.site.description, 160);
    named("description", desc);
    named("robots", noindex ? "noindex, follow" : "index, follow, max-image-preview:large, max-snippet:-1");
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
      prop("product:condition", "new");
      if (product.brand) prop("product:brand", product.brand);
      if (variant) prop("product:retailer_item_id", variant.sku);
    }

    // Structured data for Google (schema.org)
    const C0 = D.contact || {};
    const tel = (C0.phone || C0.viber || "").replace(/[^\d+]/g, "");
    const org = {
      "@type": "OnlineStore", "@id": ORG_ID(), name: D.site.name, alternateName: D.site.alternateName || undefined, url: absUrl(),
      logo: { "@type": "ImageObject", url: absAsset("assets/logo-512.png"), width: 512, height: 512 },
      image: absAsset(DEFAULT_IMAGE), description: D.site.description,
      areaServed: { "@type": "Country", name: "Philippines" },
      sameAs: (D.site.social || []).length ? D.site.social : undefined,
      email: C0.email || undefined, telephone: tel || undefined
    };
    if (tel || C0.email) org.contactPoint = { "@type": "ContactPoint", contactType: "sales", telephone: tel || undefined, email: C0.email || undefined, areaServed: "PH", availableLanguage: ["English", "Filipino"] };
    const rp = returnPolicyLD();
    if (rp) org.hasMerchantReturnPolicy = rp;
    const graph = [org, {
      "@type": "WebSite", "@id": SITE + BASE + "#website", name: D.site.name, alternateName: D.site.alternateName || undefined, url: absUrl(),
      inLanguage: D.site.language, publisher: { "@id": org["@id"] }
    }];
    if (crumbs.length) {
      graph.push({
        "@type": "BreadcrumbList",
        itemListElement: [{ name: "Home", path: "" }, ...crumbs].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absUrl(c.path) }))
      });
    }
    if (product) graph.push(productLD(product, canonical));
    graph.push(...schema.filter(Boolean));
    find("#ld-json", () => { const sc = document.createElement("script"); sc.type = "application/ld+json"; sc.id = "ld-json"; return sc; })
      .textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }

  // The first paragraph of the description; a short one gets the type and key specs added
  function productDescription(p) {
    const first = p.description ? p.description.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim() : "";
    if (first.length >= 90) return first;
    const cat = catOf(p.category);
    const kind = ((cat && (cat.singular || cat.label)) || "").toLowerCase();
    const what = p.frameset ? `${cat && cat.type === "bike" ? cat.label.toLowerCase() + " " : ""}frameset` : kind;
    const specs = p.specs ? Object.entries(p.specs).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
    return [first, `${p.name}${what ? `, ${what}` : ""} from ${D.site.name}.`, specs && specs + "."].filter(Boolean).join(" ");
  }

  /* =======================================================
     STATE (saved in this browser)
     ======================================================= */
  const KEY = "cc_state_v1";
  const defaults = {
    xp: 0, cart: [], compare: [], favs: [], badges: [], viewed: [], catsSeen: [],
    town: { stamps: [], coinDay: "", coins: [], welcomed: false },
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
      s.town = Object.assign(fresh().town, saved.town || {});
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
    { id: "podium",      icon: "🥇", name: "Podium Finish",  desc: "Send an order request",          xp: 150 },
    { id: "town",        icon: "🏙️", name: "Town Explorer",  desc: "Visit every shop in Bike Town",  xp: 100 },
    { id: "insider",     icon: "📬", name: "Insider",        desc: "Join the mailing list",          xp: 30 }
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

  function addXP(amount, reason, quiet = false) {
    const before = levelIndex();
    S.xp += amount;
    save();
    if (!quiet) toast(`${reason}`, `+${amount} XP`);
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

  // Image sizes the browser picks from, per place a photo is shown
  const SIZES = {
    card: "(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 300px",
    hero: "(max-width: 900px) 100vw, 640px",
    quick: "(max-width: 900px) 100vw, 480px",
    tile: "180px",
    thumb: "120px"
  };
  const assetUrl = (src) => (/^(https?:|data:)/.test(src) ? src : BASE + src.replace(/^\.?\//, ""));
  // <img> for a product photo. Photos the build has resized get srcset, width and height (no layout shift);
  // the main photo on a product page loads first (fetchpriority), everything else lazily
  function photoTag(src, alt, { sizes = SIZES.card, eager = false } = {}) {
    const m = IMG[src];
    const set = m ? ` srcset="${m.set.map(([w, u]) => `${esc(assetUrl(u))} ${w}w`).join(", ")}" sizes="${sizes}" width="${m.w}" height="${m.h}"` : "";
    return `<img src="${esc(assetUrl(src))}"${set} alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
  }
  function art(p, colorIdx = 0, label = true, opts = {}) {
    const ph = photoOf(p, colorIdx);
    if (ph) return photoTag(ph, label ? p.name + (colorsOf(p).length > 1 ? `, ${colorName(p, colorIdx)}` : "") : "", opts);
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
      <a class="card-media" href="${href}" tabindex="-1" aria-hidden="true">${tagsHTML(p)}<span class="art">${art(p, 0, false, { eager: !!o.eager })}</span></a>
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
            : needsChoice(p) ? `<button class="btn btn-brand" data-action="quick" data-id="${p.id}">${sizeOptions(p, defaultColor(p)).length > 1 ? "Choose size" : "Choose colour"}</button>`
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

  /* ---------- Content for search: price lists, answers to common questions, links ---------- */
  const ucFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const stripTags = (h) => h.replace(/<[^>]+>/g, "");
  const LETTER_SIZES = ["XXS", "XS", "S", "SM", "S/M", "M", "ML", "M/L", "L", "XL", "XXL"];
  const inStockAny = (p) => (hasVariants(p) ? p.variants.some((v) => v.inStock) : !soldOut(p));
  const stockLabel = (p) => (hasVariants(p) ? (inStockAny(p) ? "In stock" : "Available to order") : soldOut(p) ? "Sold out" : "In stock");
  const priceText = (p) => `${p.priceFrom ? "from " : ""}${peso(p.price)}`;
  const kindOf = (p) => {
    const c = catOf(p.category);
    if (p.frameset) return `${c && c.type === "bike" && c.id !== "other" ? c.label.toLowerCase() + " " : ""}frameset`;
    return ((c && (c.singular || c.label)) || "").toLowerCase();
  };
  function sizesText(p) {
    const sz = (p.sizes || []).filter(Boolean);
    if (!sz.length) return "";
    if (sz.length === 1) return `size ${sz[0]}`;
    if (sz.length > 2 && sz.every((z) => LETTER_SIZES.includes(z.toUpperCase()))) return `sizes ${sz[0]}–${sz[sz.length - 1]}`;
    return sz.length <= 4 ? `sizes ${andList(sz)}` : `${sz.length} sizes`;
  }
  // "bike"/"bikes", "tire"/"tires" or "product"/"products", for headings and answers
  function nounFor(items) {
    if (items.every(isBike)) return items.every((p) => p.frameset) ? { one: "frameset", many: "framesets" } : { one: "bike", many: "bikes" };
    if (items.every((p) => p.icon === "tire")) return { one: "tire", many: "tires" };
    return { one: "product", many: "products" };
  }
  const cheapestOf = (items) => [...items].sort((a, b) => a.price - b.price)[0];
  const dearestOf = (items) => [...items].sort((a, b) => b.price - a.price)[0];
  const named = (p) => `${p.name} (${priceText(p)})`;
  const ORDER_A = "Choose your size and colour, add it to your cart and send your order request by chat. A sales rep confirms stock, the final price, delivery and payment with you. No online payment is needed.";
  const orderFaq = (q = "How do I order?") => ({ q, a: ORDER_A, html: `${esc(ORDER_A)} <a href="${url(PATHS.order)}">How ordering works</a>.` });
  const sizeFaq = () => {
    const a = "Most brands size their bikes by rider height. Enter your height on any bike's page to see the size we suggest, or check our bike size guide. A sales rep double-checks your size before you pay.";
    return { q: "Which frame size do I need?", a, html: esc(a).replace("bike size guide", `<a href="${url(PATHS.sizeGuide)}">bike size guide</a>`) };
  };
  function stockFaq(items, noun, q) {
    const inStock = items.filter(inStockAny);
    const a = !inStock.length
      ? `All of them are available to order. Send your order request and we'll confirm stock and the delivery time with you.`
      : inStock.length === items.length ? `All ${items.length} are in stock.`
      : `In stock now: ${andList(inStock.slice(0, 6).map((p) => p.name))}${inStock.length > 6 ? ` and ${inStock.length - 6} more` : ""}. The other ${noun.many} are available to order; we confirm the delivery time when you send your order.`;
    return { q, a };
  }
  const faqHTML = (items) => `<dl class="faq">${items.map((f) => `<div><dt>${esc(f.q)}</dt><dd>${f.html || esc(f.a)}</dd></div>`).join("")}</dl>`;
  const linkChips = (title, links) => (links.length ? `<div class="link-block"><h2>${esc(title)}</h2><div class="chip-list">${links.map(([href, label]) => `<a class="chip" href="${url(href)}">${esc(label)}</a>`).join("")}</div></div>` : "");
  function priceTableHTML(items, caption, typeCol = true) {
    const rows = [...items].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    return `<div class="table-wrap"><table class="price-table"><caption class="sr-only">${esc(caption)}</caption>
      <thead><tr><th scope="col">Model</th>${typeCol ? '<th scope="col">Type</th>' : ""}<th scope="col">Sizes</th><th scope="col" class="num">Price</th><th scope="col">Availability</th></tr></thead>
      <tbody>${rows.map((p) => `<tr><th scope="row"><a href="${url(PATHS.product(p))}">${esc(p.name)}</a></th>${typeCol ? `<td>${esc(ucFirst(kindOf(p)))}</td>` : ""}<td>${esc((p.sizes || []).filter(Boolean).join(", ") || "One size")}</td><td class="num">${ucFirst(priceText(p))}${onSale(p) ? ` <s>${peso(p.compareAt)}</s>` : ""}</td><td>${stockLabel(p)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  // Links to the other ways of browsing what's on this page (brands, budgets, types)
  function exploreHTML(pool, here) {
    const bikes = pool.filter(isBike);
    const brands = BRANDS.filter((b) => b.items.some((p) => pool.includes(p)) && PATHS.brand(b) !== here);
    const cats = D.categories.filter((c) => pool.some((p) => p.category === c.id) && PATHS.cat(c) !== here);
    return linkChips("Shop by brand", brands.map((b) => [PATHS.brand(b), b.name]))
      + (bikes.length ? linkChips("Shop by budget", BUDGETS.filter((b) => PATHS.budget(b) !== here).map((b) => [PATHS.budget(b), `Bikes under ${pesoK(b.max)}`])) : "")
      + linkChips(bikes.length ? "Shop by type" : "Shop by category", cats.map((c) => [PATHS.cat(c), c.type === "bike" ? `${c.label} bikes` : c.label]).concat(HAS_FRAMESETS && bikes.length && here !== PATHS.framesets ? [[PATHS.framesets, "Framesets"]] : []));
  }
  function listingSeoHTML(pool, seo) {
    if (!pool.length || !seo.tableTitle) return "";
    return `<section class="seo-block" aria-label="${esc(seo.tableTitle)}">
      <h2>${esc(seo.tableTitle)}</h2>
      <p class="muted">Prices in Philippine pesos, updated every hour. Tap a model for full specs, sizes and colours.</p>
      ${priceTableHTML(pool, seo.tableTitle, seo.typeCol !== false)}
      ${exploreHTML(pool, currentPath())}
      ${seo.faq && seo.faq.length ? `<h2>${esc(seo.faqTitle || "Frequently asked questions")}</h2>${faqHTML(seo.faq)}` : ""}
    </section>`;
  }

  // Answers for a bike type page
  function categoryFaq(c, items) {
    if (c.type !== "bike") {
      const lo = cheapestOf(items), hi = dearestOf(items), n = nounFor(items);
      return [
        { q: `How much do ${c.label.toLowerCase()} cost?`, a: items.length > 1 ? `Our ${c.label.toLowerCase()} cost from ${peso(lo.price)} (${lo.name}) to ${peso(hi.price)} (${hi.name}).` : `The ${lo.name} is ${priceText(lo)}.` },
        stockFaq(items, n, `Which ${n.many} are in stock?`),
        orderFaq()
      ];
    }
    const one = `${c.label.toLowerCase()} bike`, many = `${c.label.toLowerCase()} bikes`;
    const complete = items.filter(isComplete);
    const lo = cheapestOf(complete.length ? complete : items), hi = dearestOf(items);
    const out = [{ q: `How much is a ${one} in the Philippines?`, a: items.length > 1 ? `At ${D.site.name}, ${many} cost from ${peso(lo.price)} to ${peso(hi.price)}. The most affordable is the ${lo.name} at ${peso(lo.price)}.` : `The ${lo.name} is ${priceText(lo)} at ${D.site.name}.` }];
    const bd = BUDGETS.find((b) => { const n = complete.filter((p) => p.price <= b.max).length; return n >= 1 && n < complete.length && b.max >= 50000; }) || BUDGETS.find((b) => complete.some((p) => p.price <= b.max) && complete.some((p) => p.price > b.max));
    if (bd) {
      const under = complete.filter((p) => p.price <= bd.max).sort((a, b) => b.price - a.price).slice(0, 3);
      out.push({ q: `What's the best ${one} under ${peso(bd.max)}?`, a: `Our ${many} at ${peso(bd.max)} or less are the ${andList(under.map(named))}. The closer a bike is to your budget, the better its frame and parts usually are.` });
    }
    const brands = [...new Set(items.map((p) => p.brand).filter(Boolean))];
    if (brands.length) out.push({ q: `Which ${one} brands do you sell?`, a: `${andList(brands)}. Every model has its full specs, sizes and colours on its own page.` });
    out.push(stockFaq(items, { one, many }, `Which ${many} are in stock?`), sizeFaq(), orderFaq());
    return out;
  }
  function brandFaq(b) {
    const n = nounFor(b.items), lo = cheapestOf(b.items), hi = dearestOf(b.items);
    const out = [{ q: `How much are ${b.name} ${n.many} in the Philippines?`, a: b.items.length > 1 ? `${b.name} ${n.many} at ${D.site.name} cost from ${peso(lo.price)} (${lo.name}) to ${peso(hi.price)} (${hi.name}).` : `The ${lo.name} is ${priceText(lo)} at ${D.site.name}.` }];
    const types = D.categories.map((c) => [c, b.items.filter((p) => p.category === c.id && !p.frameset).length]).filter(([, k]) => k);
    const fs = b.items.filter((p) => p.frameset).length;
    if (b.items.some(isBike) && (types.length > 1 || fs)) out.push({ q: `What types of ${b.name} bikes do you have?`, a: `${ucFirst(andList(types.map(([c, k]) => `${k} ${c.type === "bike" ? c.label.toLowerCase() : c.label} ${c.type === "bike" ? (k === 1 ? "bike" : "bikes") : ""}`.trim()).concat(fs ? [`${fs} frameset${fs === 1 ? "" : "s"}`] : [])))}.` });
    out.push(stockFaq(b.items, n, `Which ${b.name} ${n.many} are in stock?`));
    if (b.items.some(isBike)) out.push(sizeFaq());
    out.push(orderFaq(`How do I order a ${b.name} ${n.one}?`));
    return out;
  }
  function budgetFaq(bd, items) {
    const picks = D.categories.filter((c) => c.type === "bike").map((c) => [c, items.filter((p) => p.category === c.id).sort((a, b) => b.price - a.price)[0]]).filter(([, p]) => p);
    const lo = cheapestOf(D.products.filter(isComplete));
    const a = `It depends on where you ride. At ${peso(bd.max)} or less, the best-equipped bike we have of each type is: ${picks.map(([c, p]) => `${c.label.toLowerCase()}, the ${named(p)}`).join("; ")}. The closer a bike is to your budget, the better its frame and parts usually are.`;
    return [
      { q: `What's the best bike under ${peso(bd.max)}?`, a, html: `${esc(a)} <a href="${url(PATHS.finder)}?max=${bd.max}">Let the Bike Finder rank them for you</a>.` },
      { q: "What's the cheapest bike you sell?", a: `The ${lo.name} at ${peso(lo.price)}.` },
      stockFaq(items, { one: "bike", many: "bikes" }, "Are these bikes in stock?"),
      sizeFaq(),
      orderFaq()
    ];
  }
  // Answers for one product's page
  function productFaq(p) {
    const cs = colorsOf(p).filter((c) => c.name && c.name !== "Standard");
    const sz = (p.sizes || []).filter(Boolean);
    const out = [{ q: `How much is the ${p.name} in the Philippines?`, a: `The ${p.name} is ${priceText(p)} at ${D.site.name}${p.priceFrom ? ", depending on size and colour" : ""}${onSale(p) ? `, down from ${peso(p.compareAt)}` : ""}. Prices are in Philippine pesos.` }];
    if (sz.length > 1 || cs.length > 1) {
      const a = [sz.length ? `Sizes: ${sz.join(", ")}.` : "", cs.length ? `Colours: ${cs.map((c) => c.name).join(", ")}.` : ""].filter(Boolean).join(" ");
      const sizeTip = isBike(p) && sz.some((z) => LETTER_SIZES.includes(z.toUpperCase())) ? " Not sure which size? Enter your height above or see our bike size guide." : "";
      out.push({ q: `What sizes and colours does the ${p.name} come in?`, a: a + sizeTip, html: esc(a + sizeTip).replace("bike size guide", `<a href="${url(PATHS.sizeGuide)}">bike size guide</a>`) });
    }
    if (hasVariants(p)) {
      const inStock = p.variants.filter((v) => v.inStock);
      const label = (v) => [cs.length > 1 ? colorName(p, v.color) : "", v.size ? `size ${v.size}` : ""].filter(Boolean).join(", ") || "it";
      const a = !inStock.length ? `It's available to order. Send your order request and we'll confirm stock and the delivery time with you.`
        : inStock.length === p.variants.length ? "Yes, it's in stock."
        : `Yes: ${andList(inStock.slice(0, 4).map(label))} ${inStock.length === 1 ? "is" : "are"} in stock. Other sizes and colours are available to order; we confirm the delivery time when you send your order.`;
      out.push({ q: `Is the ${p.name} in stock?`, a });
    }
    if (POL.returnDays != null && POL.returnDays !== "") out.push({ q: `Can I return the ${p.name}?`, a: +POL.returnDays === 0 ? "We don't accept returns, so please check the size and specs with our sales rep before you pay." : `Yes, within ${POL.returnDays} days${POL.returnFees === "free" ? ", and return shipping is free" : ""}.` });
    if (POL.warranty) out.push({ q: `Does the ${p.name} have a warranty?`, a: POL.warranty });
    out.push(orderFaq(`How do I order the ${p.name}?`));
    return out;
  }
  // A unique description for Google: price, type, sizes, colours and stock
  function productMetaDesc(p, v) {
    const cs = colorsOf(p).filter((c) => c.name && c.name !== "Standard");
    const what = v ? [cs.length > 1 ? colorName(p, v.color) : "", v.size ? `size ${v.size}` : ""].filter(Boolean).join(", ") : "";
    const price = v ? peso(v.price) : priceText(p);
    const was = v ? (v.compareAt > v.price ? ` (was ${peso(v.compareAt)})` : "") : onSale(p) ? ` (was ${peso(p.compareAt)})` : "";
    const range = [v ? "" : sizesText(p), !v && cs.length > 1 ? `${cs.length} colours` : ""].filter(Boolean).join(" and ");
    const stock = v ? (v.inStock ? "In stock" : "Available to order") : stockLabel(p);
    const parts = [
      `${p.name}${what ? ` (${what})` : ""} price in the Philippines: ${price}${was}.`,
      `${ucFirst(kindOf(p))}${p.brand && !p.name.startsWith(p.brand) ? ` by ${p.brand}` : ""}${range ? ` in ${range}` : ""}.`,
      `${stock}.`,
      "See full specs and order by chat at Cycle Central."
    ];
    if (parts.join(" ").length > 160) parts[3] = "Full specs; order by chat.";
    while (parts.join(" ").length > 160 && parts.length > 1) parts.splice(parts.length - 1, 1);
    return parts.join(" ");
  }

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
            <span class="eyebrow">Find the right bike for your budget</span>
            <h1 class="hero-title">Your go-to bike shop in the Philippines</h1>
            <p>Set what you want to spend and where you ride. We'll show the best bikes for you, with the specs that matter side by side.</p>
            <ul class="hero-points">
              <li>${icon("check", 16)}${bikes.length} bikes from ${peso(fromPrice)}</li>
              <li>${icon("compare", 16)}Compare specs side by side</li>
              ${BRANDS.length ? `<li>${icon("tag", 16)}${esc(andList(BRANDS.filter((b) => b.items.some(isBike)).slice(0, 3).map((b) => b.name)))}${BRANDS.length > 3 ? " and more" : ""}</li>` : `<li>${icon("truck", 16)}Free shipping over ${peso(D.freeShippingThreshold)}</li>`}
            </ul>
            <a class="town-cta" href="${url(PATHS.town)}"><span class="town-cta-icon" aria-hidden="true">🏙️</span><span class="town-cta-text"><b>New: Bike Town</b><small>Ride around a 3D town where every building is a shop</small></span>${icon("arrow", 18)}</a>
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
                ${sample ? art(sample, 0, false, { sizes: SIZES.tile }) : ""}
              </a>`;
            }).join("")}
          </div>
        </div>
      </section>

      ${BRANDS.length || BUDGETS.length ? `<section class="section tight">
        <div class="wrap shop-by">
          ${BRANDS.length ? `<div><div class="section-head"><div><h2>Shop by brand</h2></div><a class="text-link" href="${url(PATHS.brands)}">All brands ${icon("arrow", 16)}</a></div>
            <div class="brand-grid">${BRANDS.slice(0, 6).map((b) => `<a class="brand-card" href="${url(PATHS.brand(b))}"><span class="art">${art(b.items[0], 0, false, { sizes: SIZES.tile })}</span><strong>${esc(b.name)}</strong><span>${b.items.length} model${b.items.length === 1 ? "" : "s"} · from ${pesoK(cheapestOf(b.items).price)}</span></a>`).join("")}</div></div>` : ""}
          ${BUDGETS.length ? `<div class="link-block"><h2>Shop by budget</h2><div class="chip-list">${BUDGETS.map((b) => `<a class="chip" href="${url(PATHS.budget(b))}">Bikes under ${pesoK(b.max)} <small>${b.count}</small></a>`).join("")}${HAS_FRAMESETS ? `<a class="chip" href="${url(PATHS.framesets)}">Framesets</a>` : ""}</div></div>` : ""}
        </div>
      </section>` : ""}

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

      ${BLOG.length ? `<section class="section tight">
        <div class="wrap">
          <div class="section-head"><div><h2>From the blog</h2><p>Buying guides, bike care and riding tips.</p></div><a class="text-link" href="${url(PATHS.blog)}">All posts ${icon("arrow", 16)}</a></div>
          <div class="post-list three">${BLOG.slice(0, 3).map((p) => postCard(p)).join("")}</div>
        </div>
      </section>` : ""}
      ${NL.action ? `<section class="section tight"><div class="wrap">${newsletterHTML("home")}</div></section>` : ""}

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
              ${BRANDS.slice(0, 6).map((b) => `<li><a href="${url(PATHS.brand(b))}">${esc(b.name)} ${nounFor(b.items).many} price list</a></li>`).join("")}
              <li><a href="${url(PATHS.chooseGuide)}">How to choose a bike</a></li>
              <li><a href="${url(PATHS.sizeGuide)}">Bike size guide</a></li>
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
    else if (scope.startsWith("brand:")) {
      const b = brandOf(scope.slice(6));
      if (!b) return viewNotFound();
      const n = nounFor(b.items), lo = cheapestOf(b.items), hi = dearestOf(b.items);
      const inStock = b.items.filter(inStockAny).length;
      base = (p) => brandFor(p) === b;
      title = `${b.name} ${ucFirst(n.many)}`;
      crumb = { name: "Brands", path: PATHS.brands };
      seo = {
        seoTitle: `${title} Price List Philippines ${YEAR}`,
        intro: `${brandInfo(b) ? brandInfo(b) + " " : ""}Every ${b.name} ${n.one} we sell, with prices in Philippine pesos: ${b.items.length} model${b.items.length === 1 ? "" : "s"} from ${peso(lo.price)}${hi.price > lo.price ? ` to ${peso(hi.price)}` : ""}. ${inStock ? `${inStock} in stock now, the rest available to order.` : "All available to order."} Compare specs, choose your size and colour, and order by chat.`,
        metaDescription: `${b.name} price list in the Philippines (${YEAR}): ${b.items.length} ${b.items.length === 1 ? n.one : n.many} from ${peso(lo.price)}, including the ${andList(b.items.slice(0, 2).map((p) => p.name.replace(b.name + " ", "")))}. Specs, sizes and colours.`,
        tableTitle: `${b.name} price list (${YEAR})`, faq: brandFaq(b), faqTitle: `${b.name} ${n.many}: questions and answers`
      };
    }
    else if (scope.startsWith("budget:")) {
      const bd = budgetOf(scope.slice(7));
      if (!bd) return viewNotFound();
      base = (p) => isComplete(p) && p.price <= bd.max;
      const items = D.products.filter(base);
      const types = D.categories.filter((c) => c.type === "bike").map((c) => [c, items.filter((p) => p.category === c.id).length]).filter(([, k]) => k);
      title = `Bikes Under ${peso(bd.max)}`;
      crumb = { name: "Bikes", path: PATHS.bikes };
      seo = {
        seoTitle: `Best Bikes Under ${peso(bd.max)} in the Philippines (${YEAR})`, defaultSort: "high",
        intro: `${items.length} complete bikes at ${peso(bd.max)} or less: ${andList(types.map(([c, k]) => `${k} ${c.label.toLowerCase()}`))}. The best-equipped bikes, closest to your budget, are listed first. Compare them side by side, or let the Bike Finder rank them for how you ride.`,
        metaDescription: `The best bikes under ${peso(bd.max)} in the Philippines: ${items.length} road, gravel, mountain and city bikes with prices, specs and sizes, best-equipped first. Order by chat.`,
        tableTitle: `Bikes under ${peso(bd.max)}: price list (${YEAR})`, faq: budgetFaq(bd, items), faqTitle: `Choosing a bike under ${peso(bd.max)}`
      };
      if (types.length < 3) seo.metaDescription = `The best bikes under ${peso(bd.max)} in the Philippines: ${items.length} ${andList(types.map(([c]) => c.label.toLowerCase()))} bikes with prices, specs and sizes, best-equipped first. Order by chat.`;
    }
    else if (scope === "framesets") {
      base = (p) => !!p.frameset;
      const items = D.products.filter(base), lo = cheapestOf(items);
      title = "Framesets";
      crumb = { name: "Bikes", path: PATHS.bikes };
      seo = {
        seoTitle: `Bike Framesets Price List Philippines ${YEAR}`,
        intro: `Frame and fork sets to build your own bike: ${items.length} framesets from ${andList([...new Set(items.map((p) => p.brand).filter(Boolean))])}, from ${peso(lo.price)}. Ask us about a full build with the parts you want.`,
        metaDescription: `Bike framesets in the Philippines: ${items.length} road and gravel frame and fork sets from ${peso(lo.price)}, with sizes, colours and prices in pesos. Order by chat at Cycle Central.`,
        tableTitle: `Frameset price list (${YEAR})`, faq: [stockFaq(items, { one: "frameset", many: "framesets" }, "Which framesets are in stock?"), sizeFaq(), orderFaq()], faqTitle: "Framesets: questions and answers"
      };
    }
    else {
      const c = catOf(scope);
      if (!c) return viewNotFound();
      base = (p) => p.category === scope;
      title = c.type === "bike" ? `${c.label} Bikes` : c.label;
      crumb = { name: c.type === "bike" ? "Bikes" : "Parts & Gear", path: c.type === "bike" ? PATHS.bikes : PATHS.parts };
      const items = D.products.filter((p) => p.category === scope);
      seo = {
        seoTitle: c.seoTitle || title, intro: c.intro, metaDescription: c.metaDescription,
        tableTitle: `${c.type === "bike" ? `${c.label} bike` : c.label} prices (${YEAR})`, faq: categoryFaq(c, items), faqTitle: `${title}: questions and answers`
      };
      // A short description gets the number of models and the starting price
      const extra = ` ${items.length} model${items.length === 1 ? "" : "s"} from ${peso(cheapestOf(items).price)}.`;
      const md = seo.metaDescription || seo.intro || "";
      if (md.length < 120 && md.length + extra.length <= 160) seo.metaDescription = md + extra;
      trackCategory(scope);
    }
    if (scope === "bikes") Object.assign(seo, { tableTitle: `Bike price list (${YEAR})` });
    if (scope === "parts") Object.assign(seo, { tableTitle: `Parts price list (${YEAR})` });
    if (scope === "sale") Object.assign(seo, { tableTitle: "Sale prices", typeCol: true });
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
      sale: q.get("sale") === "1", sort: q.get("sort") || seo.defaultSort || "featured"
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
      <div class="filter-group"><h2>Budget</h2>
        <div class="chip-list">${bands.filter(([a]) => a < top).map((b) => { const on = F.min === b[0] && F.max === b[1]; return `<button class="chip ${on ? "on" : ""}" data-action="filter-band" data-min="${b[0]}" data-max="${b[1] ?? ""}" aria-pressed="${on}">${bandLabel(b)}</button>`; }).join("")}</div>
        <input class="range" type="range" id="priceRange" min="0" max="${top}" step="${step}" value="${F.max == null ? top : Math.min(F.max, top)}" aria-label="Maximum price" style="--fill:${((F.max == null ? top : Math.min(F.max, top)) / top) * 100}%">
        <p class="filter-note" id="priceLabel">${F.max == null && !F.min ? "Any price" : budgetLabel()}</p>
      </div>
      ${cats.length > 1 ? `<div class="filter-group"><h2>${allBikes ? "Bike type" : "Category"}</h2><div class="chip-list">${cats.map((c) => chip("cats", c, catOf(c).label)).join("")}</div></div>` : ""}
      ${frames.length > 1 ? `<div class="filter-group"><h2>Frame</h2><div class="chip-list">${frames.map((f) => chip("frame", f, f)).join("")}</div></div>` : ""}
      ${levels.length > 1 ? `<div class="filter-group"><h2>Rider level</h2><div class="chip-list">${levels.map((l) => chip("level", l, LEVELS.find((x) => x.v === l).label)).join("")}</div></div>` : ""}
      ${scope !== "sale" && pool.some(onSale) ? `<div class="filter-group"><label class="check"><input type="checkbox" id="fSale" ${F.sale ? "checked" : ""}> On sale only</label></div>` : ""}
      ${allBikes ? `<div class="filter-group"><a class="text-link" href="${url(PATHS.finder)}">${icon("target", 16)}Help me choose</a></div>` : ""}`;

    const sorts = [["featured", "Recommended"], ["low", "Price: low to high"], ["high", "Price: high to low"]];
    if (allBikes) sorts.push(["light", "Lightest first"]);
    if (pool.some(onSale)) sorts.push(["save", "Biggest saving"]);
    if (!sorts.some(([v]) => v === F.sort)) F.sort = seo.defaultSort || "featured";

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
        ${listingSeoHTML(pool, seo)}
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
      $("#grid").innerHTML = sorted.length ? sorted.map((p, i) => card(p, { eager: i < 4 })).join("") : empty;
      $("#resultCount").textContent = `${sorted.length} ${noun}${sorted.length === 1 ? "" : "s"}`;
      $("#sheetShow").textContent = `Show ${sorted.length} ${noun}${sorted.length === 1 ? "" : "s"}`;
      $("#activeFilters").innerHTML = pills.length ? pills.join("") + `<button class="text-link" data-action="clear-filters">Clear all</button>` : "";
      $("#filterCount").textContent = pills.length ? ` (${pills.length})` : "";
      if (!keepControls) $("#filterGroups").innerHTML = groupsHTML();
      else { $("#priceLabel").textContent = F.max == null && !F.min ? "Any price" : budgetLabel(); $("#priceRange").style.setProperty("--fill", ($("#priceRange").value / top) * 100 + "%"); }
      setQuery({ type: F.cats.join(","), min: F.min || "", max: F.max ?? "", frame: F.frame.join(","), level: F.level.join(","), sale: F.sale ? "1" : "", sort: F.sort === (seo.defaultSort || "featured") ? "" : F.sort });
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
      crumbs: [...(crumb ? [crumb] : []), { name: title, path: currentPath() }],
      schema: seo.noindex ? [] : [listLD(seo.seoTitle || title, pool), seo.faq && seo.faq.length ? faqLD(seo.faq.map((f) => ({ q: f.q, text: f.a }))) : null]
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
  const needsSize = (p, sel) => (isBike(p) || hasVariants(p)) && sel.size == null && sizeOptions(p, sel.color).length > 0;
  // A part with more than one SKU (tire sizes, colours) is chosen in the quick view, not added straight from a card
  const needsChoice = (p) => hasVariants(p) && p.variants.length > 1;

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
    const showSizes = (isBike(p) || hasVariants(p)) && (sizes.length > 1 || (sizes.length === 1 && sizes[0] !== ""));
    const colourBlock = cs.length > 1
      ? `<div class="pdp-block"><h2>Colour<b class="color-picked">${esc(colorName(p, sel.color))}</b></h2><div class="swatches lg">${cs.map((c, i) => `<button class="swatch ${i === sel.color ? "active" : ""}" style="background:${c.hex}" data-action="opt-color" data-i="${i}" aria-label="${esc(c.name)}" title="${esc(c.name)}" aria-pressed="${i === sel.color}"></button>`).join("")}</div></div>`
      : cs.length === 1 && hasVariants(p) && cs[0].name !== "Standard" ? `<p class="one-colour">Colour <b>${esc(cs[0].name)}</b></p>` : "";
    const lettered = sizes.some(heightFor);
    const sizeBlock = showSizes ? `<div class="pdp-block"><h2>${lettered || !hasVariants(p) ? "Frame size" : "Size"}<b class="size-picked">${sel.size != null && sizes.length > 1 ? esc(sizeLabel(sel.size)) : ""}</b></h2>
        <div class="size-grid">${sizes.map((sz) => {
          const z = heightFor(sz), v = variantOf(p, sel.color, sz), on = sel.size === sz;
          const sub = z ? `${z.min}–${z.max} cm` : v ? (v.inStock ? "In stock" : "To order") : "";
          return `<button class="size-btn ${on ? "on" : ""} ${v && !v.inStock ? "to-order" : ""}" data-action="opt-size" data-s="${esc(sz)}" aria-pressed="${on}"><span class="sr-only">Size </span>${esc(sizeLabel(sz))}${sub ? `<small>${sub}</small>` : ""}${v && !v.inStock && z ? `<span class="sr-only">, available to order</span>` : ""}</button>`;
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
    return ph.length > 1 ? `<div class="thumbs" role="group" aria-label="More photos">${ph.map((u, i) => `<button class="thumb ${i === 0 ? "on" : ""}" data-action="photo" data-i="${i}" aria-label="Photo ${i + 1}">${photoTag(u, "", { sizes: "96px" })}</button>`).join("")}</div>` : "";
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
    if (media) media.innerHTML = art(p, sel.color, true, { sizes: sel === QV ? SIZES.quick : SIZES.hero, eager: true });
    const thumbs = $("#pdpThumbs"); if (thumbs && sel === PDP) thumbs.innerHTML = galleryHTML(p, sel.color);
  }
  const descHTML = (p) => (p.description ? p.description.split(/\n\s*\n/).map((para) => `<p class="pdp-desc">${esc(para.trim())}</p>`).join("") : `<p class="pdp-desc">${esc(productDescription(p))}</p>`);
  const highlightsHTML = (p) => (p.highlights && p.highlights.length ? `<ul class="highlights">${p.highlights.map((h) => `<li>${icon("check", 16)}<span>${esc(h)}</span></li>`).join("")}</ul>` : "");
  // Brand and model year sit at the top of the spec table for bikes from Cycle Beast
  const fullSpecs = (p) => [...(p.brand ? [["Brand", p.brand]] : []), ...(p.year ? [["Model year", String(p.year)]] : []), ...(p.specs ? specEntries(p) : [])];

  // The closest alternatives, for the side-by-side table on a bike's page
  function alternatives(p, count = 2) {
    const rank = (x) => (x.category === p.category ? 0 : x.fit && p.fit && x.fit.terrain === p.fit.terrain ? 1 : 2) * 10 + Math.abs(x.price - p.price) / p.price;
    return D.products.filter((x) => isComplete(x) && x.id !== p.id && !soldOut(x)).sort((a, b) => rank(a) - rank(b)).slice(0, count).sort((a, b) => a.price - b.price);
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
    const faq = productFaq(p);

    app.innerHTML = `
      <div class="wrap">
        ${crumbsHTML([top, { name: catTitle, path: PATHS.cat(c) }, { name: p.name }], "padding-top:20px")}
        <div class="pdp">
          <div class="pdp-visual">
            <div class="pdp-media" id="pdpArt">${art(p, PDP.color, true, { sizes: SIZES.hero, eager: true })}</div>
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
              <li>${icon("chat")}Order by chat: a sales rep confirms size, stock and delivery</li>
              ${POL.returnDays ? `<li>${icon("returns")}${POL.returnDays}-day returns</li>` : ""}
              <li>${icon("bolt")}${LEVEL_PERKS[lvl] ? `${D.levels[lvl].name} member price: ${peso(shown.price * (1 - LEVEL_PERKS[lvl] / 100))} (${LEVEL_PERKS[lvl]}% off)` : `Earn ${xp} XP in the Rider Club with this order`}</li>
            </ul>
          </div>
        </div>
        ${specs.length || bike ? `<div class="pdp-sections">
          <section>${specs.length ? `<h2>Specifications</h2><table class="spec-table"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : ""}</section>
          <section>${bike ? versusHTML(p) : ""}</section>
        </div>` : ""}
        ${related.length ? `<section class="section tight"><div class="section-head"><h2>${bike ? (HAS_PARTS ? "Complete your build" : "Similar bikes") : "You may also like"}</h2></div><div class="rail">${related.map((x) => card(x)).join("")}</div></section>` : ""}
        <section class="seo-block pdp-faq">
          <h2>${esc(p.name)}: questions and answers</h2>
          ${faqHTML(faq)}
          ${linkChips("More to explore", [
            ...(brandFor(p) ? [[PATHS.brand(brandFor(p)), `All ${brandFor(p).name} ${nounFor(brandFor(p).items).many}`]] : []),
            [PATHS.cat(c), `All ${catTitle.toLowerCase()}`],
            ...(p.frameset && HAS_FRAMESETS ? [[PATHS.framesets, "All framesets"]] : []),
            ...(isComplete(p) && budgetFor(p.price) ? [[PATHS.budget(budgetFor(p.price)), `Bikes under ${pesoK(budgetFor(p.price).max)}`]] : []),
            ...(bike ? [[PATHS.sizeGuide, "Bike size guide"], [PATHS.chooseGuide, "How to choose a bike"]] : [])
          ])}
        </section>
      </div>`;
    setupBuyBar(p);
    const v = variant || null;
    const what = v ? [colorsOf(p).length > 1 ? colorName(p, v.color) : "", v.size ? `size ${v.size}` : ""].filter(Boolean).join(", ") : "";
    setMeta({
      title: `${p.name}${what ? ` (${what})` : ""} ${`${p.name} Price in the Philippines`.length > 65 ? "Price Philippines" : "Price in the Philippines"}`,
      description: productMetaDesc(p, v),
      type: "product",
      image: productImage(p, v ? v.color : 0),
      imageAlt: p.name + (what ? `, ${what}` : ""),
      crumbs: [top, { name: catTitle, path: PATHS.cat(c) }, { name: p.name, path: PATHS.product(p) }],
      product: p, variant: v,
      canonicalPath: v ? PATHS.product(p) : null,
      schema: [faqLD(faq.map((f) => ({ q: f.q, text: f.a })))]
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
    return (isBike(p) || hasVariants(p)) && PDP.size && sizeOptions(p, PDP.color).length > 1 ? `Add to cart · ${sizeLabel(PDP.size)}` : "Add to cart";
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
        <div class="quick-media" id="quickArt">${art(p, QV.color, true, { sizes: SIZES.quick, eager: true })}</div>
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
    setMeta({ title: D.pages.rewards.seoTitle, description: D.pages.rewards.metaDescription, noindex: true, crumbs: [{ name: "Rewards", path: PATHS.rewards }] });
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
        <div class="thumb">${art(p, l.color, false, { sizes: SIZES.thumb })}</div>
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

  /* ---------- Mailing list ---------- */
  // Signups go to Cycle Beast (newsletter.cors: true, see docs/mailing-list.md), or to any email
  // service's signup form (Brevo, MailerLite, Kit, Buttondown, Mailchimp...). Set it in js/data.js
  // (newsletter). Hidden until then.
  const NL = D.newsletter || {};
  function newsletterHTML(where) {
    if (!NL.action) return "";
    const id = `nl-${where}`;
    const hidden = Object.entries(NL.hidden || {}).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join("")
      // Cycle Beast also records the page the signup came from, and ignores bots that fill in the hidden "website" box
      + (NL.cors ? `<input type="hidden" name="source" value="${esc(where)}"><label class="nl-trap" aria-hidden="true">Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>` : "");
    return `<section class="newsletter newsletter-${where}" aria-labelledby="${id}">
      <div class="nl-copy"><span class="nl-icon" aria-hidden="true">📬</span><div><h2 id="${id}">${esc(NL.title || "Get new arrivals and deals by email")}</h2><p>${esc(NL.text || "Unsubscribe anytime.")}</p></div></div>
      <form class="nl-form" action="${esc(NL.action)}" method="post" target="_blank" data-nl>
        <div class="nl-row"><label class="sr-only" for="${id}-email">Email address</label>
          <input id="${id}-email" type="email" name="${esc(NL.emailField || "email")}" required autocomplete="email" placeholder="Your email address">${hidden}
          <button class="btn btn-brand" type="submit">Subscribe</button></div>
        <p class="nl-note">By subscribing you agree to get emails from ${esc(D.site.name)}. Unsubscribe anytime. <a href="${url(PATHS.privacy)}">Privacy notice</a></p>
        <p class="nl-msg" aria-live="polite"></p>
      </form>
    </section>`;
  }
  document.addEventListener("submit", (e) => {
    const form = e.target.closest && e.target.closest("form[data-nl]");
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('input[type="email"]'), msg = form.querySelector(".nl-msg");
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = "Please enter a valid email address."; input.focus(); return; }
    const btn = form.querySelector("button");
    btn.disabled = true;
    msg.textContent = "Subscribing…";
    const body = new FormData(form);
    const src = body.get("source");
    if (src != null) body.set("source", `${location.pathname} (${src})`);
    const done = (text) => {
      msg.textContent = text;
      form.classList.add("done");
      S.newsletter = true; save();
      award("insider");
    };
    if (NL.cors) {
      // Cycle Beast answers { ok, error }, so a problem can be shown and fixed
      fetch(form.action, { method: "POST", body })
        .then((r) => r.json().catch(() => ({})).then((j) => ({ status: r.status, ...j })))
        .then((j) => {
          if (j.ok) return done(NL.thanks || "You're on the list. Thanks for subscribing!");
          btn.disabled = false;
          msg.textContent = j.error || "Sorry, that didn't work. Please try again in a moment.";
        })
        .catch(() => { btn.disabled = false; msg.textContent = "We couldn't reach our server. Please check your connection and try again."; });
      return;
    }
    // Email services don't let other sites read their reply, so a sent form counts as success
    fetch(form.action, { method: "POST", mode: "no-cors", body })
      .then(() => done(NL.thanks || "Thanks! Check your inbox to confirm your subscription."))
      .catch(() => { btn.disabled = false; msg.textContent = ""; form.submit(); });
  });

  /* ---------- Blog ---------- */
  // Posts are Markdown files in content/blog/ (see scripts/blog.mjs). js/blog.js lists them; each
  // post's text is in blog-data/<address>.json, and already in the page when it's opened directly.
  const BLOG = (window.CC_BLOG && window.CC_BLOG.posts) || [];
  const postOf = (slug) => BLOG.find((p) => p.slug === slug);
  const POST_HTML = new Map();
  const POST_COLORS = { road: "#3c78c6", gravel: "#92694b", mountain: "#3f8a5a", city: "#e8742a", electric: "#d99a1e", folding: "#2a9d8f" };
  const postArt = (p, light = false) => bikeSVG(POST_COLORS[p.category] || "#3c78c6", ["road", "gravel", "mountain", "city", "folding"].includes(p.category) ? p.category : "road", { light });
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  const postMeta = (p) => `<time datetime="${p.date}">${fmtDate(p.date)}</time> · ${p.readMins} min read`;
  function postCard(p, big = false) {
    const href = url(PATHS.post(p));
    return `<article class="post-card ${big ? "big" : ""}" style="--c:${POST_COLORS[p.category] || "#3c78c6"}">
      <a class="post-card-art" href="${href}" tabindex="-1" aria-hidden="true">${postArt(p)}</a>
      <div class="post-card-body">
        ${p.tags.length ? `<p class="post-tags">${p.tags.map(esc).join(" · ")}</p>` : ""}
        <h2><a href="${href}">${esc(p.title)}</a></h2>
        <p>${esc(p.description)}</p>
        <p class="post-meta">${postMeta(p)}</p>
      </div>
    </article>`;
  }
  function viewBlog() {
    app.innerHTML = `
      <div class="wrap blog">
        <div class="page-head">
          ${crumbsHTML([{ name: "Blog" }])}
          <h1>Bike Blog</h1>
          <p class="page-intro">Buying guides, bike care and riding tips for the Philippines, from the ${esc(D.site.name)} team.</p>
        </div>
        ${BLOG.length ? `<div class="post-list">${BLOG.map((p, i) => postCard(p, i === 0)).join("")}</div>` : `<p class="empty">The first posts are on their way.</p>`}
        ${newsletterHTML("blog")}
        <p class="blog-rss"><a class="text-link" href="${url("blog/feed.xml")}">${icon("send", 16)}Follow with RSS</a></p>
      </div>`;
    setMeta({
      title: "Bike Blog: Buying Guides, Bike Care & Riding Tips",
      description: `Bike buying guides, rainy-season care, tubeless tires and riding tips for the Philippines, from the ${D.site.name} team.`,
      crumbs: [{ name: "Blog", path: PATHS.blog }],
      schema: [{ "@type": "Blog", "@id": absUrl(PATHS.blog) + "#blog", name: `${D.site.name} Blog`, url: absUrl(PATHS.blog), publisher: { "@id": ORG_ID() },
        blogPost: BLOG.slice(0, 20).map((p) => ({ "@type": "BlogPosting", headline: p.title, url: absUrl(PATHS.post(p)), datePublished: p.date, dateModified: p.updated })) }]
    });
  }
  // {{products ...}} in a post: live product cards with today's prices
  function fillPostProducts(root) {
    $$(".post-products", root).forEach((el) => {
      const d = el.dataset;
      let items = D.products.filter((p) => !p.frameset || d.category === "framesets");
      if (d.category) items = items.filter((p) => p.category === d.category);
      if (d.brand) items = items.filter((p) => (p.brand || "").toLowerCase() === d.brand.toLowerCase());
      if (d.max) items = items.filter((p) => p.price <= +d.max);
      if (d.min) items = items.filter((p) => p.price >= +d.min);
      if (d.sort === "low") items.sort((a, b) => a.price - b.price);
      if (d.sort === "high") items.sort((a, b) => b.price - a.price);
      items = items.slice(0, +d.limit || 4);
      el.innerHTML = items.length
        ? `<div class="product-grid post-grid">${items.map((p) => card(p)).join("")}</div>`
        : `<p class="muted">Nothing in stock for this list right now. <a href="${url(PATHS.bikes)}">See all bikes</a>.</p>`;
    });
  }
  function viewPost(slug) {
    const p = postOf(slug);
    if (!p) return viewNotFound();
    let body = POST_HTML.get(slug);
    if (body == null) {
      // opened directly: the text is already in the page
      const saved = document.querySelector(`.post[data-post="${slug}"] .post-body[data-full="1"]`);
      if (saved) { body = saved.innerHTML; POST_HTML.set(slug, body); }
    }
    if (body == null) {
      fetch(`${BASE}blog-data/${slug}.json`).then((r) => r.json()).then((d) => {
        POST_HTML.set(slug, d.html);
        if (currentPath() === PATHS.post(p)) { viewPost(slug); window.scrollTo(0, 0); }
      }).catch(() => { const b = $(".post-body"); if (b) b.innerHTML = `<p>This post couldn't load. <a href="${url(PATHS.post(p))}">Try again</a>.</p>`; });
    }
    const pageUrl = absUrl(PATHS.post(p));
    const share = encodeURIComponent(pageUrl), shareText = encodeURIComponent(`${p.title} ${pageUrl}`);
    const others = BLOG.filter((x) => x !== p).slice(0, 2);
    app.innerHTML = `
      <article class="post" data-post="${esc(slug)}" style="--c:${POST_COLORS[p.category] || "#3c78c6"}">
        <div class="wrap">
          ${crumbsHTML([{ name: "Blog", path: PATHS.blog }, { name: p.title }], "padding-top:20px")}
          <header class="post-head">
            ${p.tags.length ? `<p class="post-tags">${p.tags.map(esc).join(" · ")}</p>` : ""}
            <h1>${esc(p.title)}</h1>
            <p class="post-lead">${esc(p.description)}</p>
            <p class="post-meta">By ${esc(p.author)} · ${postMeta(p)}${p.updated !== p.date ? ` · Updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time>` : ""}</p>
          </header>
          <div class="post-art" aria-hidden="true">${postArt(p, true)}</div>
          <div class="post-body prose" data-full="${body != null ? 1 : 0}">${body != null ? body : `<p class="muted">Loading…</p>`}</div>
          <div class="post-share"><span>Share this post</span>
            <a class="btn btn-ghost btn-sm" href="https://www.facebook.com/sharer/sharer.php?u=${share}" target="_blank" rel="noopener">Facebook</a>
            <a class="btn btn-ghost btn-sm" href="viber://forward?text=${shareText}">Viber</a>
            <button class="btn btn-ghost btn-sm" data-action="copy-link">${icon("copy", 16)}Copy link</button>
          </div>
          ${newsletterHTML("post")}
          ${others.length ? `<section class="post-more"><h2>More from the blog</h2><div class="post-list">${others.map((x) => postCard(x)).join("")}</div></section>` : ""}
        </div>
      </article>`;
    if (body != null) fillPostProducts(app);
    setMeta({
      title: p.title, description: p.description, type: "article",
      image: absUrl(`og/blog/${p.slug}.png`), imageAlt: p.title,
      crumbs: [{ name: "Blog", path: PATHS.blog }, { name: p.title, path: PATHS.post(p) }],
      schema: [{
        "@type": "BlogPosting", "@id": pageUrl + "#post", headline: p.title, description: p.description, url: pageUrl, mainEntityOfPage: pageUrl,
        image: absUrl(`og/blog/${p.slug}.png`), datePublished: p.date, dateModified: p.updated, inLanguage: D.site.language,
        author: p.author === "Cycle Central team" || p.author === `${D.site.name} team` ? { "@id": ORG_ID() } : { "@type": "Person", name: p.author },
        publisher: { "@id": ORG_ID() }, keywords: p.tags.join(", ") || undefined,
        isPartOf: { "@id": absUrl(PATHS.blog) + "#blog" }
      }]
    });
  }

  /* ---------- Privacy ---------- */
  function viewPrivacy() {
    const C0 = D.contact || {};
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">${crumbsHTML([{ name: "Privacy notice" }])}<h1>Privacy notice</h1><p class="page-intro muted">Updated ${fmtDate("2026-11-18")}</p></div>
        <article class="guide">
          <p class="lead">${esc(D.site.name)} collects as little about you as possible. Here's what we keep, why, and how to reach us.</p>
          <h2>Stored only in your browser</h2>
          <p>Your cart, favourites, comparisons, Bike Finder answers, Rider Club XP and badges, and Bike Town progress are saved in your own browser so they're there when you come back. They aren't sent to us. Clearing this site's data in your browser removes them.</p>
          <h2>When you send an order request</h2>
          <p>Your order request is sent by you through your chat app (such as Viber) and includes what you typed in: your name, mobile number, area and the items in your cart. We use it only to confirm and deliver your order, and keep it only as long as we need to for that and for our records.</p>
          <h2>Mailing list</h2>
          <p>If you subscribe, your email address is kept by our email service so we can send you updates. Every email has an unsubscribe link, and you can ask us to delete your address at any time.</p>
          <h2>No advertising trackers</h2>
          <p>This site doesn't use advertising cookies or third-party analytics. Our web host keeps standard server logs, such as IP addresses, for security.</p>
          <h2>Your rights</h2>
          <p>Under the Data Privacy Act of 2012 (Republic Act No. 10173), you can ask what personal data we hold about you, have it corrected, or have it deleted. Contact us${C0.email ? ` at <a href="mailto:${esc(C0.email)}">${esc(C0.email)}</a>` : ""} through any of the channels on our <a href="${url(PATHS.order)}">How to order</a> page.</p>
        </article>
      </div>`;
    setMeta({ title: "Privacy Notice", description: `How ${D.site.name} handles your data: what's stored in your browser, order requests by chat, the mailing list, and your rights under the Data Privacy Act.`, crumbs: [{ name: "Privacy notice", path: PATHS.privacy }] });
  }

  /* ---------- Bike Town (3D) ---------- */
  // js/town.js draws the town; this builds its list of places from the catalog and hands it the
  // shop's actions (cart, XP, spin). The page also lists every place as plain links, for search
  // engines and for browsers without 3D.
  const TOWN_SHOPS = {
    road: ["Road Bike Velodrome", "velodrome", "🚴", "#3c78c6"], gravel: ["Gravel Lodge", "lodge", "🏕️", "#92694b"],
    mountain: ["MTB Basecamp", "basecamp", "⛰️", "#3f8a5a"], city: ["Commuter Station", "station", "🚉", "#e8742a"],
    electric: ["E-Bike Power Station", "power", "⚡", "#d99a1e"], folding: ["Folding Bike Kiosk", "kiosk", "🧳", "#2a9d8f"],
    other: ["Bike Barn", "barn", "🚲", "#7b5ea7"], components: ["Parts Workshop", "workshop", "🔧", "#3a4048"],
    wheels: ["Tire & Wheel Shop", "tires", "🛞", "#4a5058"], gear: ["Gear Shop", "gear", "⛑️", "#d64545"]
  };
  function townPlaces() {
    const out = [];
    const count = (items) => { const n = nounFor(items); return `${items.length} ${items.length === 1 ? n.one : n.many} from ${pesoK(cheapestOf(items).price)}`; };
    const coloursOf = (items) => [...new Set(items.flatMap((p) => colorsOf(p).map((c) => c.hex)))].slice(0, 4);
    for (const c of D.categories) {
      const t = TOWN_SHOPS[c.id], items = D.products.filter((p) => p.category === c.id && !p.frameset);
      if (!t || !items.length) continue;
      out.push({ id: c.id, kind: "shop", group: c.type === "bike" ? "main" : "parts", name: t[0], style: t[1], icon: t[2], color: t[3], colors: coloursOf(items),
        blurb: c.intro || c.blurb, items, count: count(items), href: PATHS.cat(c), hrefLabel: c.type === "bike" ? `${c.label.toLowerCase()} bikes page` : `${c.label} page` });
    }
    const frames = D.products.filter((p) => p.frameset);
    if (HAS_FRAMESETS) out.push({ id: "framesets", kind: "shop", group: "main", name: "Frame Studio", style: "frames", icon: "📐", color: "#a8323b", colors: coloursOf(frames), blurb: "Frame and fork sets to build your dream bike.", items: frames, count: count(frames), href: PATHS.framesets, hrefLabel: "framesets page" });
    const sale = D.products.filter(onSale);
    if (sale.length) out.push({ id: "sale", kind: "shop", group: "main", name: "Sari-sari Sale Stall", sign: "Sale", style: "market", icon: "🏷️", color: "#d64545", blurb: "Bikes, parts and gear with reduced prices.", items: sale, count: count(sale), href: PATHS.sale, hrefLabel: "sale page" });
    out.push({ id: "bank", kind: "bank", group: "main", name: "Budget Bank", style: "bank", icon: "💰", color: "#b8891a", blurb: "Tell the teller your budget and see the best bikes for it.", href: PATHS.finder, hrefLabel: "Bike Finder" });
    out.push({ id: "post", kind: "post", group: "main", name: "Order Post Office", sign: "Post Office", style: "post", icon: "📮", color: "#c4392f", blurb: "Send your order request by chat. No online payment needed.", href: PATHS.order, hrefLabel: "How to order" });
    out.push({ id: "fit", kind: "fit", group: "main", name: "Fit Studio", style: "fit", icon: "📏", color: "#2a9d8f", blurb: "Find your frame size from your height.", href: PATHS.sizeGuide, hrefLabel: "bike size guide" });
    BRANDS.slice(0, 6).forEach((b) => out.push({ id: "brand-" + b.slug, kind: "shop", group: "brands", name: `${b.name} Showroom`, sign: b.name, style: "showroom", icon: "🏬", color: "#1c2126", colors: coloursOf(b.items),
      blurb: brandInfo(b) || `Every ${b.name} model we sell.`, items: b.items, count: count(b.items), href: PATHS.brand(b), hrefLabel: `${b.name} price list` }));
    out.push({ id: "club", kind: "club", group: "landmark-west", name: "Rider Club HQ", sign: "Rider Club", style: "club", icon: "🏆", color: "#3c78c6", blurb: "Your level, badges and Town Pass.", href: PATHS.rewards, hrefLabel: "Rider Club" });
    out.push({ id: "spin", kind: "spin", group: "landmark-east", name: "Daily Spin Wheel", sign: "Daily Spin", style: "ferris", icon: "🎡", color: "#e8742a", blurb: "Spin once a day for discount codes, free shipping or bonus XP." });
    return out;
  }
  let town = null; // the running 3D town, stopped when you leave the page
  function townApi(places) {
    return {
      places, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      url, peso, pesoK, icon, card: (p) => card(p),
      bands: (items) => D.priceBands[items.some(isBike) ? "bike" : "part"].map(([, b]) => b).filter((b) => b != null),
      finderQuick: D.finder.quick, finderPath: PATHS.finder,
      bikesUpTo: (max) => D.products.filter((p) => isComplete(p) && !soldOut(p) && p.price <= max).sort((a, b) => b.price - a.price),
      sizeFor: (cm) => sizeForHeight(cm),
      level: () => { const i = levelIndex(); return { icon: LEVEL_ICONS[i], name: D.levels[i].name, xp: S.xp, ...levelProgress() }; },
      cart: () => ({ count: S.cart.reduce((n, l) => n + l.qty, 0), total: cartTotals().total }),
      openCart: () => { renderCart(); openPanel("#cartDrawer"); },
      openSpin: () => { renderSpin(); openPanel("#spinModal"); },
      modalOpen: () => $("#overlay").classList.contains("show"),
      state: S.town, save, today: today(),
      stamp(id, name) {
        if (S.town.stamps.includes(id)) return false;
        S.town.stamps.push(id);
        save();
        addXP(5, `🏷️ Town Pass stamp: ${esc(name)}`);
        if (places.every((x) => S.town.stamps.includes(x.id))) award("town");
        return true;
      },
      coin: () => addXP(2, "", true)
    };
  }
  function viewTown() {
    const places = townPlaces();
    const touchHint = "Tap anywhere to ride there · use the joystick to steer";
    app.innerHTML = `
      <section class="town" aria-labelledby="townTitle">
        <div class="town-stage" id="townStage">
          <div class="town-loading"><span class="town-spinner" aria-hidden="true"></span><p>Loading Bike Town…</p></div>
          <div class="town-hud">
            <div class="town-title"><h1 id="townTitle">Bike Town</h1><p>Ride around. Every building is a shop.</p></div>
            <div class="town-actions">
              <button class="town-btn" type="button" data-town="places">${icon("pin", 16)}Places</button>
              <button class="town-btn" type="button" data-town="pass"><span aria-hidden="true">🏷️</span><span class="sr-only">Town Pass stamps</span> <b data-town-pass>0/${places.length}</b></button>
              <span class="town-btn town-coin" title="Coins collected today"><span aria-hidden="true">🪙</span><span class="sr-only">Coins today</span> <b data-town-coins>0/20</b></span>
              <button class="town-btn icon" type="button" data-town="help" aria-label="How to ride">?</button>
            </div>
            <div class="town-zoom"><button class="town-btn icon" type="button" data-zoom="in" aria-label="Zoom in">${icon("plus", 16)}</button><button class="town-btn icon" type="button" data-zoom="out" aria-label="Zoom out">${icon("minus", 16)}</button></div>
            <button class="town-prompt" type="button" hidden></button>
            <div class="town-joy" aria-hidden="true"><span></span></div>
            <p class="town-hint"><span class="pointer-fine">Arrow keys or WASD to ride · Enter to go in · click anywhere to ride there</span><span class="pointer-coarse">${touchHint}</span></p>
          </div>
        </div>
        <div class="wrap town-info">
          <h2>Shops in Bike Town</h2>
          <p class="page-intro">Bike Town is ${esc(D.site.name)} as a little 3D town. Ride your bike from shop to shop, browse every bike and part, stamp your Town Pass and collect coins for Rider Club XP. Prefer a list? Every shop is here too.</p>
          <ul class="town-place-cards">${places.map((p) => `<li style="--c:${p.color}">
            <span class="town-place-icon" aria-hidden="true">${p.icon}</span>
            <div><h3>${esc(p.name)}</h3><p>${esc(p.count || p.blurb || "")}</p>
            <div class="town-place-links">${p.href ? `<a class="text-link" href="${url(p.href)}">Open the ${esc(p.hrefLabel || p.name)}</a>` : `<button class="text-link" data-action="open-spin">Spin the wheel</button>`}<button class="text-link town-ride" type="button" data-town-ride="${esc(p.id)}">Ride there ${icon("arrow", 14)}</button></div></div>
          </li>`).join("")}</ul>
          <h2>How to play</h2>
          <ul class="steps-list">
            <li>Ride with the arrow keys or WASD, or tap anywhere (or on a shop's sign) and your rider goes there.</li>
            <li>Ride up to a door and press Enter, or tap the button that appears, to go in and shop. Your cart works everywhere.</li>
            <li>Every shop stamps your Town Pass (+5 XP); visit them all for the Town Explorer badge. ${20} gold coins appear on the streets every day, worth 2 XP each.</li>
            <li>Spin the Ferris wheel once a day for discount codes, and drop by the Post Office to send your order.</li>
          </ul>
        </div>
      </section>`;
    document.body.classList.add("in-town");
    setMeta({
      title: "Bike Town: Shop Bikes in a 3D Town",
      description: `Ride a bike around ${D.site.name}'s 3D Bike Town: every building is a shop for road, gravel, mountain and e-bikes, parts and gear. Collect coins and earn XP.`,
      crumbs: [{ name: "Bike Town", path: PATHS.town }],
      schema: [{ "@type": "CollectionPage", name: "Bike Town", url: absUrl(PATHS.town), mainEntity: { "@type": "ItemList", itemListElement: places.filter((p) => p.href).map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: absUrl(p.href) })) } }]
    });
    if (PRERENDER || MODE !== "path") return;
    const stage = $("#townStage");
    import(`${BASE}js/town.js`)
      .then((m) => { if (stage.isConnected) town = m.mount(stage, townApi(places)); })
      .catch(() => { stage.classList.add("no-webgl"); const l = $(".town-loading", stage); if (l) l.innerHTML = "<p>Bike Town couldn't load, so here's every shop as a list below.</p>"; });
  }

  /* ---------- Brands ---------- */
  const BRAND_INFO = {
    trek: "Trek is an American bike brand, founded in 1976 in Waterloo, Wisconsin. Its range runs from Marlin hardtails and FX hybrids to Domane endurance, Madone aero and Checkpoint gravel bikes.",
    cannondale: "Cannondale is an American bike brand, founded in 1971, best known for its aluminium CAAD frames and its SuperSix EVO, Synapse, Topstone and Trail models.",
    colnago: "Colnago is an Italian bike maker, founded by Ernesto Colnago in 1954 in Cambiago, near Milan. Its race frames have won the Tour de France and the world championships.",
    giant: "Giant is a Taiwanese bike brand, founded in 1972 and one of the world's largest bicycle makers, known for its TCR, Defy, Propel and Revolt road and gravel bikes.",
    specialized: "Specialized is an American bike brand, founded in 1974 in California, known for the Tarmac, Roubaix, Allez, Diverge and Stumpjumper.",
    michelin: "Michelin is a French tire maker, founded in 1889, that made the first quick-to-repair removable bicycle tire in 1891. Its cycling tires cover road racing, gravel and mountain biking.",
    shimano: "Shimano is a Japanese maker of bike components, founded in 1921 in Sakai, Osaka, and the most common choice of gears and brakes on bikes worldwide.",
    sram: "SRAM is an American maker of bike components, founded in 1987 in Chicago, known for its wireless AXS electronic shifting and Eagle mountain bike groupsets."
  };
  const brandInfo = (b) => BRAND_INFO[b.slug] || "";
  function viewBrands() {
    const types = (b) => andList(D.categories.filter((c) => b.items.some((p) => p.category === c.id)).map((c) => (c.type === "bike" ? c.label.toLowerCase() : c.label.toLowerCase())));
    const total = D.products.length;
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          ${crumbsHTML([{ name: "Brands" }])}
          <h1>Bike brands</h1>
          <p class="page-intro">${BRANDS.length} brands at ${D.site.name}: ${esc(andList(BRANDS.map((b) => b.name)))}. ${total} models in all, each with its price in Philippine pesos, full specs, sizes and colours.</p>
        </div>
        <div class="brand-grid">${BRANDS.map((b) => `<a class="brand-card" href="${url(PATHS.brand(b))}">
          <span class="art">${art(b.items[0], 0, false, { sizes: SIZES.tile })}</span>
          <strong>${esc(b.name)}</strong><span>${b.items.length} model${b.items.length === 1 ? "" : "s"} · from ${peso(cheapestOf(b.items).price)}</span></a>`).join("")}</div>
        <section class="seo-block">
          <h2>Brands at a glance</h2>
          <div class="table-wrap"><table class="price-table"><thead><tr><th scope="col">Brand</th><th scope="col">What we sell</th><th scope="col" class="num">Models</th><th scope="col" class="num">Prices</th></tr></thead>
          <tbody>${BRANDS.map((b) => `<tr><th scope="row"><a href="${url(PATHS.brand(b))}">${esc(b.name)}</a></th><td>${esc(ucFirst(types(b)))}</td><td class="num">${b.items.length}</td><td class="num">${peso(cheapestOf(b.items).price)}${dearestOf(b.items).price > cheapestOf(b.items).price ? ` – ${peso(dearestOf(b.items).price)}` : ""}</td></tr>`).join("")}</tbody></table></div>
          ${BRANDS.some(brandInfo) ? `<h2>About the brands</h2>${BRANDS.filter(brandInfo).map((b) => `<h3><a href="${url(PATHS.brand(b))}">${esc(b.name)}</a></h3><p>${esc(brandInfo(b))}</p>`).join("")}` : ""}
        </section>
      </div>`;
    setMeta({
      title: `Bike Brands: ${andList(BRANDS.slice(0, 3).map((b) => b.name))} & More`,
      description: `Shop ${andList(BRANDS.map((b) => b.name))} at ${D.site.name}. Price lists in Philippine pesos with full specs, sizes and colours for every model.`,
      crumbs: [{ name: "Brands", path: PATHS.brands }],
      schema: [{ "@type": "CollectionPage", name: "Bike brands", url: absUrl(PATHS.brands), mainEntity: { "@type": "ItemList", itemListElement: BRANDS.map((b, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(PATHS.brand(b)), name: b.name })) } }]
    });
  }

  /* ---------- Guides ---------- */
  const GUIDE_DATE = "2026-11-17"; // change when a guide is rewritten
  const ftIn = (cm) => { let inch = Math.round(cm / 2.54); return `${Math.floor(inch / 12)}′${inch % 12}″`; };
  const sizeForHeight = (cm) => D.sizes.find((z) => cm >= z.min && cm < z.max);
  const TYPE_GUIDE = {
    road: "For paved roads, group rides and fitness. Drop handlebars, narrow tires (about 25–32 mm) and light frames make road bikes the fastest bikes on tarmac. Endurance models have a more upright position for long days; race and aero models are lower and stiffer.",
    gravel: "For mixed roads: tarmac, dirt and rough backroads on one bike. Drop handlebars with wide tires (about 38–50 mm), stable handling and mounts for bags and racks. A good choice if you want one bike for almost everything.",
    mountain: "For trails. Flat handlebars, wide knobby tires and suspension. Hardtails (front suspension only) are lighter, simpler and more affordable; full-suspension bikes are more comfortable and capable on rough descents.",
    city: "For commuting and everyday rides. An upright position, flat handlebars and comfortable tires, often with mounts for fenders and a rack. Fitness hybrids are lighter and quicker, for riders who want exercise as well as transport.",
    electric: "A motor assists you as you pedal, so hills, heat and long distances get easier. E-bikes are heavier and cost more, and the battery needs charging; range depends on battery size (Wh), terrain and the assist level you use.",
    folding: "Folds down to fit in a car, a condo or on the train. Small wheels make it nimble in town, though it's less suited to long, fast rides."
  };
  const GUIDES = {
    "bike-size-guide": {
      title: "Bike size guide", seoTitle: "Bike Size Chart by Height (cm & ft): Which Size Do I Need?",
      description: "Find your bike size by height in cm and feet: a simple chart for road, gravel, mountain and city bikes, road frame sizes in cm, and how to measure your inseam.",
      body() {
        const road = [[152, 160, "47–50"], [160, 168, "50–52"], [168, 175, "53–54"], [175, 183, "55–56"], [183, 190, "57–58"], [190, 200, "59–61"]];
        const hasML = D.products.some((p) => (p.sizes || []).includes("ML"));
        const asks = [152, 160, 165, 170, 175, 180, 185].map((cm) => [cm, sizeForHeight(cm)]).filter(([, z]) => z);
        const faq = asks.map(([cm, z]) => ({ q: `What size bike do I need if I'm ${ftIn(cm)} (${cm} cm)?`, a: `Size ${z.s} in most brands, which fits riders about ${z.min}–${z.max} cm tall. Check the size we suggest on each bike's page, as every brand's chart is a little different.` }));
        return {
          faq,
          html: `
          <p class="lead">The right size matters more than almost any spec: a bike that fits is comfortable, efficient and easier to control. Use these charts as a starting point, then enter your height on any bike's page to see the size we suggest for that model. A sales rep double-checks your size before you pay.</p>
          <h2>Bike size chart by height</h2>
          <p>Most road, gravel, mountain and city bikes come in letter sizes. Find your height without shoes:</p>
          <div class="table-wrap"><table class="price-table"><thead><tr><th scope="col">Size</th><th scope="col">Rider height (cm)</th><th scope="col">Rider height (ft)</th></tr></thead>
          <tbody>${D.sizes.map((z) => `<tr><th scope="row">${esc(z.s)}</th><td>${z.min}–${z.max} cm</td><td>${ftIn(z.min)} – ${ftIn(z.max)}</td></tr>`).join("")}</tbody></table></div>
          ${hasML ? `<p>Some brands, such as Trek, also make an <b>ML</b> size between M and L, for riders at the top of M or the bottom of L.</p>` : ""}
          <h2>Road and gravel frame sizes in centimetres</h2>
          <p>Road and gravel frames are often sized by the length of the seat tube in centimetres:</p>
          <div class="table-wrap"><table class="price-table"><thead><tr><th scope="col">Rider height</th><th scope="col">Frame size</th></tr></thead>
          <tbody>${road.map(([a, b, f]) => `<tr><th scope="row">${a}–${b} cm (${ftIn(a)} – ${ftIn(b)})</th><td>${f} cm</td></tr>`).join("")}</tbody></table></div>
          <h2>How to measure yourself</h2>
          <ol class="steps-list">
            <li><b>Height:</b> stand against a wall without shoes, put a book flat on your head and mark the wall under it. Measure from the floor to the mark.</li>
            <li><b>Inseam:</b> stand with your feet about 15 cm apart and pull a book up firmly between your legs, spine against the wall. Measure from the floor to the top of the book.</li>
          </ol>
          <h2>Quick inseam formulas</h2>
          <ul class="steps-list">
            <li><b>Road and gravel:</b> inseam (cm) × 0.67 = frame size in cm. An 80 cm inseam suggests a 54 cm frame.</li>
            <li><b>Mountain:</b> inseam (cm) × 0.226 = frame size in inches. An 80 cm inseam suggests an 18″ frame (size M).</li>
            <li><b>City and hybrid:</b> inseam (cm) × 0.685 = frame size in cm.</li>
          </ul>
          <h2>Between two sizes?</h2>
          <p>Pick the smaller size if you like a more upright, nimble ride or have shorter arms; pick the larger one if you want a more stretched-out position or have long arms. Saddle height, stem length and handlebar position fine-tune the fit, and our sales rep can help you choose.</p>
          <h2>Mountain bike wheel sizes</h2>
          <p>Most mountain bikes use 29″ wheels, which roll over obstacles more easily. Some small frames use 27.5″ wheels so shorter riders get a better fit; the product page lists the wheels for each size.</p>`
        };
      }
    },
    "how-to-choose-a-bike": {
      title: "How to choose a bike", seoTitle: "How to Choose a Bike: Types, Budgets & Groupsets Explained",
      description: "Road, gravel, mountain, city or electric? How to choose the right bike for where you ride and your budget, what frame materials and groupsets mean, and how to get the size right.",
      body() {
        const bikeCats = D.categories.filter((c) => c.type === "bike" && TYPE_GUIDE[c.id]);
        const complete = D.products.filter(isComplete);
        return {
          faq: [
            { q: "Which type of bike should I buy?", a: "Choose by where you'll ride most: road bikes for paved roads, gravel bikes for mixed roads and dirt, mountain bikes for trails, and city bikes for commuting. If you want one bike for almost everything, a gravel bike is the most versatile." },
            { q: "Is a carbon frame worth it?", a: "Carbon is lighter and absorbs more road buzz than aluminium, which you notice on long rides and climbs. A good aluminium bike with better parts is often better value than a carbon frame with basic parts." },
            { q: "What does more money buy?", a: "A lighter frame, more gears, hydraulic disc brakes, better wheels and, at the top, electronic shifting. The biggest jump in ride quality usually comes from the frame, wheels and tires." },
            sizeFaq()
          ],
          html: `
          <p class="lead">Three questions narrow it down fast: where you'll ride, what you want to spend, and how you like to ride. Here's how to answer each one, with the bikes we have for every option.</p>
          <h2>1. Where will you ride?</h2>
          ${bikeCats.map((c) => { const items = D.products.filter((p) => p.category === c.id && isComplete(p)); return `<h3>${esc(c.label)} bikes</h3><p>${esc(TYPE_GUIDE[c.id])}</p>${items.length ? `<p><a class="text-link" href="${url(PATHS.cat(c))}">${items.length} ${c.label.toLowerCase()} bike${items.length === 1 ? "" : "s"} from ${peso(cheapestOf(items).price)} ${icon("arrow", 16)}</a></p>` : ""}`; }).join("")}
          <h2>2. Set your budget</h2>
          <p>Decide what you want to spend, including a helmet, lights and a lock if you need them. What more money usually buys: a lighter frame, more gears, stronger hydraulic disc brakes, better wheels and, at the top end, electronic shifting.</p>
          ${BUDGETS.length ? `<ul class="steps-list">${BUDGETS.map((b) => { const n = complete.filter((p) => p.price <= b.max).length; return `<li><a href="${url(PATHS.budget(b))}">Bikes under ${peso(b.max)}</a>: ${n} bike${n === 1 ? "" : "s"}</li>`; }).join("")}</ul>` : ""}
          <p>The <a href="${url(PATHS.finder)}">Bike Finder</a> ranks every bike for your budget and riding, and explains each pick.</p>
          <h2>3. Frame materials</h2>
          <ul class="steps-list">
            <li><b>Aluminium:</b> light, stiff and affordable. Most entry and mid-level bikes use it.</li>
            <li><b>Carbon:</b> the lightest, and it absorbs road buzz; it can be shaped for aerodynamics. It costs more.</li>
            <li><b>Steel:</b> smooth, durable and easy to repair, though heavier. Classic and touring bikes use it.</li>
            <li><b>Titanium:</b> light, springy and doesn't corrode. A premium choice.</li>
          </ul>
          <h2>4. Groupsets explained</h2>
          <p>The groupset is the bike's gears and brakes. Higher levels shift more smoothly, weigh less and have more gears.</p>
          <ul class="steps-list">
            <li><b>Shimano road</b>, from entry to top: Claris (8-speed), Sora (9), Tiagra (10), 105 (12), Ultegra (12), Dura-Ace (12). 105, Ultegra and Dura-Ace also come with electronic Di2 shifting. GRX is Shimano's gravel range.</li>
            <li><b>Shimano mountain:</b> Cues, Deore, SLX, XT and XTR.</li>
            <li><b>SRAM road and gravel:</b> Apex, Rival, Force and Red, most of them with wireless AXS electronic shifting.</li>
            <li><b>SRAM mountain:</b> the Eagle 12-speed range, from SX, NX and GX up to X0 and XX.</li>
          </ul>
          <h2>5. Get the right size</h2>
          <p>A bike that fits matters more than any upgrade. See our <a href="${url(PATHS.sizeGuide)}">bike size guide</a>, or enter your height on any bike's page.</p>`
        };
      }
    }
  };
  function viewGuide(id) {
    const g = GUIDES[id], body = g.body(), path = `guides/${id}/`;
    const other = Object.entries(GUIDES).filter(([k]) => k !== id);
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          ${crumbsHTML([{ name: "Guides", path: PATHS.chooseGuide }, { name: g.title }])}
          <h1>${esc(g.title)}</h1>
          <p class="page-intro muted">By the ${esc(D.site.name)} team · Updated ${new Date(GUIDE_DATE).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <article class="guide">
          ${body.html}
          ${body.faq.length ? `<h2>Questions and answers</h2>${faqHTML(body.faq)}` : ""}
          <p class="guide-cta"><a class="btn btn-brand" href="${url(PATHS.finder)}">Find your bike</a> <a class="btn btn-ghost" href="${url(PATHS.bikes)}">Browse all bikes</a></p>
          ${linkChips("More guides", other.map(([k, x]) => [`guides/${k}/`, x.title]).concat([[PATHS.order, "How to order"]]))}
        </article>
      </div>`;
    setMeta({
      title: g.seoTitle, description: g.description, type: "article",
      crumbs: [{ name: "Guides", path: PATHS.chooseGuide }, { name: g.title, path }],
      schema: [
        { "@type": "Article", headline: g.seoTitle, description: g.description, url: absUrl(path), mainEntityOfPage: absUrl(path), image: absAsset(DEFAULT_IMAGE),
          datePublished: GUIDE_DATE, dateModified: GUIDE_DATE, inLanguage: D.site.language, author: { "@id": ORG_ID() }, publisher: { "@id": ORG_ID() } },
        body.faq.length ? faqLD(body.faq.map((f) => ({ q: f.q, text: f.a }))) : null
      ]
    });
  }

  /* ---------- About ---------- */
  function viewAbout() {
    const bikeBrands = BRANDS.filter((b) => b.items.some(isBike)).map((b) => b.name);
    const partBrands = BRANDS.filter((b) => !b.items.some(isBike)).map((b) => b.name);
    const contacts = contactListHTML();
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          ${crumbsHTML([{ name: "About us" }])}
          <h1>About ${esc(D.site.name)}</h1>
        </div>
        <article class="guide">
          <p class="lead">${esc(D.site.name)} is an online bike shop in the Philippines${bikeBrands.length ? `, selling ${esc(andList(bikeBrands))} bikes${partBrands.length ? ` and ${esc(andList(partBrands))} parts` : ""}` : ""}. Every model has its price in Philippine pesos, full specs, sizes and colours on its own page, so you can compare properly before you buy.</p>
          <h2>Built around your budget</h2>
          <p>Tell the <a href="${url(PATHS.finder)}">Bike Finder</a> what you want to spend and where you ride, and it ranks every bike for you and explains why. You can also compare up to three bikes side by side, or browse by <a href="${url(PATHS.bikes)}">type</a>${BRANDS.length ? `, <a href="${url(PATHS.brands)}">brand</a>` : ""} and budget.</p>
          <h2>How ordering works</h2>
          <p>There's no online payment. Build your cart and send your order request by chat; a sales rep confirms stock, size, the final price, delivery and payment with you. <a href="${url(PATHS.order)}">See how to order</a>.</p>
          <h2>Talk to us</h2>
          ${contacts || `<p>Our Viber ordering line opens soon. You can already build your cart and copy your order details from it.</p>`}
          ${linkChips("Start shopping", [[PATHS.bikes, "All bikes"], ...(BRANDS.length ? [[PATHS.brands, "Brands"]] : []), [PATHS.chooseGuide, "How to choose a bike"], [PATHS.sizeGuide, "Bike size guide"]])}
        </article>
      </div>`;
    setMeta({
      title: `About Us: Online Bike Shop in the Philippines`,
      description: `${D.site.name} is an online bike shop in the Philippines${bikeBrands.length ? ` selling ${andList(bikeBrands.slice(0, 4))} bikes` : ""}. Prices in pesos, full specs, a Bike Finder for your budget, and ordering by chat.`,
      crumbs: [{ name: "About us", path: PATHS.about }],
      schema: [{ "@type": "AboutPage", url: absUrl(PATHS.about), name: `About ${D.site.name}`, mainEntity: { "@id": ORG_ID() } }]
    });
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
    return D.products.filter((p) => isComplete(p) && !soldOut(p))
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
    const cheapest = D.products.filter((p) => isComplete(p) && !soldOut(p) && (!t || (p.fit && p.fit.terrain === t.v))
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
        <a class="thumb" href="${href}" tabindex="-1" aria-hidden="true">${art(p, 0, false, { sizes: SIZES.thumb })}</a>
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
        <thead><tr><th scope="row"><span class="sr-only">Spec</span></th>${items.map((p) => `<td><a class="thumb" href="${url(PATHS.product(p))}" data-action="close-all" tabindex="-1" aria-hidden="true">${art(p, 0, false, { sizes: SIZES.thumb })}</a><a href="${url(PATHS.product(p))}" data-action="close-all"><b>${esc(p.name)}</b></a><span class="card-meta">${esc(metaLine(p))}</span></td>`).join("")}</tr></thead>
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
      if (budget != null && (!isComplete(p) || p.price > budget * (1 + D.finder.stretch))) return null;
      const kind = `${c.label || ""} ${c.singular || ""}`.toLowerCase();
      return { p, score: words.reduce((s, w) => s + (name.startsWith(w) ? 3 : name.includes(w) ? 2 : 1) + (kind.includes(w) ? 3 : 0), 0) + (budget != null && p.price <= budget ? 1 : 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score || (budget != null ? b.p.price - a.p.price : 0)).slice(0, 8).map((x) => x.p);
    return { hits, budget };
  }
  function renderSearch(text = "") {
    const box = $("#searchResults");
    const hitRow = (p) => `<a class="search-hit" href="${url(PATHS.product(p))}" data-action="close-all"><span class="thumb">${art(p, 0, false, { sizes: SIZES.thumb })}</span><span><strong>${esc(p.name)}</strong><small>${esc(metaLine(p))}</small></span><span class="price">${peso(p.price)}</span></a>`;
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
        if (needsChoice(byId(id))) { openQuick(id); break; }
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
      case "copy-link":
        (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(() => toast("Link copied")).catch(() => toast("Copy the address from your browser's address bar"));
        break;
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
        if (u) $("#pdpArt").innerHTML = photoTag(u, `${p.name}, photo ${+el.dataset.i + 1}`, { sizes: SIZES.hero, eager: true });
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
    if (town) { try { town.destroy(); } catch (e) { /* already gone */ } town = null; }
    document.body.classList.remove("in-town");
    if (!a) viewHome();
    else if ((a === "bikes" || (a === "parts" && HAS_PARTS)) && segs.length === 1) viewShop(a);
    else if ((a === "bikes" || a === "parts") && segs.length === 2 && catOf(b) && catOf(b).type === a.slice(0, -1)) viewShop(b);
    else if (a === "bikes" && segs.length === 2 && budgetOf(b)) viewShop("budget:" + b);
    else if (a === "bikes" && segs.length === 2 && b === "framesets" && HAS_FRAMESETS) viewShop("framesets");
    else if (a === "brands" && segs.length === 1 && BRANDS.length) viewBrands();
    else if (a === "brands" && segs.length === 2 && brandOf(b)) viewShop("brand:" + b);
    else if (a === "guides" && segs.length === 2 && GUIDES[b]) viewGuide(b);
    else if (a === "about" && segs.length === 1) viewAbout();
    else if (a === "town" && segs.length === 1) viewTown();
    else if (a === "blog" && segs.length === 1) viewBlog();
    else if (a === "blog" && segs.length === 2 && postOf(b)) viewPost(b);
    else if (a === "privacy" && segs.length === 1) viewPrivacy();
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
      return `<a class="mega-tile" href="${url(PATHS.cat(c))}">${sample ? art(sample, 0, false, { sizes: SIZES.tile }) : ""}<strong>${esc(c.label)}</strong><span>${esc(c.blurb)}</span></a>`;
    };
    const bikeBrands = BRANDS.filter((b) => b.items.some(isBike));
    $("#megaBikes").innerHTML = `<div class="mega-inner">${D.categories.filter((c) => c.type === "bike").map(tile).join("")}
      <a class="mega-tile finder-tile" href="${url(PATHS.finder)}"><strong>Not sure which?</strong><span>Tell us your budget and we'll pick for you.</span></a></div>
      ${bikeBrands.length || BUDGETS.length ? `<div class="mega-links">
        ${bikeBrands.length ? `<div><strong>Brands</strong>${bikeBrands.map((b) => `<a href="${url(PATHS.brand(b))}">${esc(b.name)}</a>`).join("")}</div>` : ""}
        ${BUDGETS.length ? `<div><strong>By budget</strong>${BUDGETS.map((b) => `<a href="${url(PATHS.budget(b))}">Under ${pesoK(b.max)}</a>`).join("")}${HAS_FRAMESETS ? `<a href="${url(PATHS.framesets)}">Framesets</a>` : ""}</div>` : ""}
      </div>` : ""}`;
    const parts = $("#megaParts");
    if (parts) parts.innerHTML = `<div class="mega-inner">${D.categories.filter((c) => c.type === "part").map(tile).join("")}</div>`;
  }

  function buildFooter() {
    const link = (path, label) => `<a href="${url(path)}">${esc(label)}</a>`;
    const shop = $("#footShop");
    if (shop) shop.innerHTML = `<h2>Shop</h2>${link(PATHS.bikes, "All bikes")}${D.categories.filter((c) => c.type === "bike").map((c) => link(PATHS.cat(c), `${c.label} bikes`)).join("")}${HAS_FRAMESETS ? link(PATHS.framesets, "Framesets") : ""}${HAS_PARTS ? link(PATHS.parts, "Parts & Gear") : ""}${link(PATHS.sale, "Sale")}${link(PATHS.finder, "Bike Finder")}${link(PATHS.town, "Bike Town (3D)")}`;
    const brands = $("#footBrands");
    if (brands) {
      if (BRANDS.length) brands.innerHTML = `<h2>Brands</h2>${BRANDS.slice(0, 8).map((b) => link(PATHS.brand(b), b.name)).join("")}${BRANDS.length > 1 ? link(PATHS.brands, "All brands") : ""}${BUDGETS.slice(0, 4).map((b) => link(PATHS.budget(b), `Bikes under ${pesoK(b.max)}`)).join("")}`;
      else brands.remove();
    }
    const help = $("#footHelp");
    if (help) help.innerHTML = `<h2>Help</h2>${link(PATHS.order, "How to order")}${link(PATHS.sizeGuide, "Bike size guide")}${link(PATHS.chooseGuide, "How to choose a bike")}${BLOG.length ? link(PATHS.blog, "Blog") : ""}${link(PATHS.about, "About us")}${link(PATHS.privacy, "Privacy notice")}`;
    const nl = $("#footNewsletter");
    if (nl) nl.innerHTML = newsletterHTML("footer");
    const legal = $(".footer-legal");
    if (legal) legal.innerHTML = `© <span id="year">${YEAR}</span> ${esc(D.site.name)}. ${CATALOG ? "Prices in Philippine pesos. Product names and logos belong to their brands." : "Product images and inventory are placeholders."}`;
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
  buildFooter();
  renderXP();
  renderCartCount();
  // The first render keeps the elements the build already saved in the page and only changes
  // what differs (cart, XP, favourites...). Redrawing everything would make the browser paint the
  // main photo a second time once the scripts arrive, which is what Google times as the page's
  // load (LCP). Later page changes redraw normally.
  function patchChildren(a, b) {
    const olds = [...a.childNodes], news = [...b.childNodes];
    for (let i = 0; i < Math.max(olds.length, news.length); i++) {
      const x = olds[i], y = news[i];
      if (!y) { x.remove(); continue; }
      if (!x) { a.appendChild(y); continue; }
      if (x.isEqualNode(y)) continue;
      if (x.nodeType === 1 && y.nodeType === 1 && x.tagName === y.tagName && x.tagName !== "SVG" && x.namespaceURI === y.namespaceURI) {
        for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
        for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
        patchChildren(x, y);
      } else a.replaceChild(y, x);
    }
  }
  function hydrate(run) {
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
    if (PRERENDER || MODE !== "path" || !desc || !app.firstElementChild) return run();
    Object.defineProperty(Element.prototype, "innerHTML", {
      configurable: true, get: desc.get,
      set(html) {
        if (!app.contains(this)) return desc.set.call(this, html);
        const t = document.createElement("template");
        t.innerHTML = html;
        patchChildren(this, t.content);
      }
    });
    try { run(); } finally { Object.defineProperty(Element.prototype, "innerHTML", desc); }
  }
  hydrate(route);

  // Used by the build script to list every page and draw social images
  if (PRERENDER) {
    window.__CC__ = {
      routes: [
        { path: PATHS.home, priority: "1.0" },
        { path: PATHS.bikes, priority: "0.9" }, ...(HAS_PARTS ? [{ path: PATHS.parts, priority: "0.9" }] : []),
        { path: PATHS.finder, priority: "0.9" },
        ...D.categories.map((c) => ({ path: PATHS.cat(c), priority: "0.8" })),
        { path: PATHS.sale, priority: "0.7" },
        ...(BRANDS.length ? [{ path: PATHS.brands, priority: "0.7" }] : []),
        ...BRANDS.map((b) => ({ path: PATHS.brand(b), priority: "0.8" })),
        ...BUDGETS.map((b) => ({ path: PATHS.budget(b), priority: "0.8" })),
        ...(HAS_FRAMESETS ? [{ path: PATHS.framesets, priority: "0.7" }] : []),
        ...Object.keys(GUIDES).map((k) => ({ path: `guides/${k}/`, priority: "0.6" })),
        { path: PATHS.about, priority: "0.5" },
        { path: PATHS.town, priority: "0.7" },
        ...(BLOG.length ? [{ path: PATHS.blog, priority: "0.7" }] : []),
        ...BLOG.map((p) => ({ path: PATHS.post(p), priority: "0.6", post: true })),
        { path: PATHS.privacy, priority: "0.3" },
        ...D.products.map((p) => ({ path: PATHS.product(p), priority: "0.7", images: [...new Set(colorsOf(p).flatMap((c, i) => photosOf(p, i)).concat(photosOf(p, 0)))].slice(0, 10).map(bigPhoto), title: p.name })),
        // One page per SKU (shared on Facebook); they point search engines at their model page
        ...[...skuIndex.keys()].map((k) => ({ path: `products/${k}/`, variant: true })),
        { path: PATHS.order, priority: "0.6" },
        { path: PATHS.rewards, noindex: true },
        { path: PATHS.favourites, noindex: true }
      ],
      brandArt: bikeSVG("#3c78c6", "road"),
      posts: BLOG.map((p) => ({ slug: p.slug, title: p.title, art: postArt(p) })),
      products: D.products.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: (p.priceFrom ? "From " : "") + peso(p.price), compareAt: onSale(p) ? peso(p.compareAt) : "", category: (catOf(p.category) || {}).singular || "", hasImage: !!photoOf(p), art: art(p, 0, false) }))
    };
  }
})();
