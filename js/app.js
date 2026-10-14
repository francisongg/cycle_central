(function () {
  "use strict";

  const D = window.CC_DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const peso = (n) => "₱" + Math.round(n).toLocaleString("en-PH");
  const byId = (id) => D.products.find((p) => p.id === id);
  const catOf = (id) => D.categories.find((c) => c.id === id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* =======================================================
     STATE (persisted per browser)
     ======================================================= */
  const KEY = "cc_state_v1";
  const defaults = {
    xp: 0, cart: [], compare: [], favs: [], badges: [], viewed: [], catsSeen: [],
    lastSpin: null, codes: [], appliedCode: null, orders: 0
  };
  let S = load();
  function load() {
    try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch (e) { return Object.assign({}, defaults); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }

  /* =======================================================
     GAMIFICATION: XP, levels, badges
     ======================================================= */
  const LEVEL_PERKS = [0, 2, 4, 6, 8]; // % member discount per level
  const LEVEL_ICONS = ["🚲", "🧢", "⛰️", "⚡", "🏆"];

  const BADGES = [
    { id: "first-look",  icon: "👀", name: "First Look",     desc: "View a product",                xp: 10 },
    { id: "window",      icon: "🛍️", name: "Window Shopper", desc: "View 5 different products",     xp: 30 },
    { id: "explorer",    icon: "🧭", name: "Explorer",       desc: "Browse all 5 bike categories",  xp: 60 },
    { id: "matchmaker",  icon: "💘", name: "Matchmaker",     desc: "Complete the Bike Finder",       xp: 75 },
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
    if (S.badges.includes(badgeId)) return;
    const b = BADGES.find((x) => x.id === badgeId);
    if (!b) return;
    S.badges.push(badgeId);
    save();
    addXP(b.xp, `${b.icon} Badge unlocked: ${b.name}`);
    if (location.hash.startsWith("#/rewards")) route();
  }

  function renderXP(pulse) {
    const i = levelIndex();
    $("#xpLevel").textContent = `${LEVEL_ICONS[i]} ${D.levels[i].name}`;
    $("#xpNum").textContent = `${S.xp} XP`;
    $("#xpBarFill").style.width = levelProgress().pct + "%";
    if (pulse) { const p = $(".xp-pill"); p.classList.remove("pulse"); void p.offsetWidth; p.classList.add("pulse"); }
  }

  /* =======================================================
     PLACEHOLDER ARTWORK (SVG) — replaced when product.image is set
     ======================================================= */
  function bikeSVG(color = "#111", category = "road", opts = {}) {
    const stroke = opts.light ? "#eeebe3" : "#1c2126";
    const tire = { road: 6, gravel: 9, mountain: 12, city: 8, electric: 9 }[category] || 7;
    const R = 60, rx = 95, fx = 305, wy = 170;
    const bb = [190, 175], st = [168, 88], ht = [272, 82], hb = [280, 108];
    const spokes = (cx) => Array.from({ length: 8 }, (_, k) => {
      const a = (k * Math.PI) / 4;
      return `<line x1="${cx}" y1="${wy}" x2="${cx + Math.cos(a) * (R - 4)}" y2="${wy + Math.sin(a) * (R - 4)}"/>`;
    }).join("");
    const wheel = (cx) => `
      <circle cx="${cx}" cy="${wy}" r="${R}" fill="none" stroke="${stroke}" stroke-width="${tire}"/>
      <circle cx="${cx}" cy="${wy}" r="${R - tire / 2 - 3}" fill="none" stroke="${stroke}" stroke-opacity=".35" stroke-width="2"/>
      <g stroke="${stroke}" stroke-opacity=".25" stroke-width="1.2">${spokes(cx)}</g>
      <circle cx="${cx}" cy="${wy}" r="5" fill="${stroke}"/>`;
    const tube = (a, b, w = 9) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;

    let bar = "";
    if (category === "road" || category === "gravel") {
      bar = `<path d="M${ht[0]} ${ht[1]} L292 76 Q308 74 309 88 Q310 104 296 106" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round"/>`;
    } else if (category === "city") {
      bar = `<path d="M${ht[0]} ${ht[1]} L274 64 Q262 58 250 62" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round"/>`;
    } else {
      bar = `<path d="M${ht[0]} ${ht[1]} L284 70 L300 68" fill="none" stroke="${stroke}" stroke-width="5" stroke-linecap="round"/>`;
    }
    const fork = category === "mountain" || (category === "electric" && opts.suspension)
      ? `${tube(hb, [292, 130], 11)}<line x1="292" y1="130" x2="${fx}" y2="${wy}" stroke="${stroke}" stroke-width="7" stroke-linecap="round"/>`
      : `<line x1="${hb[0]}" y1="${hb[1]}" x2="${fx}" y2="${wy}" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/>`;
    const extras = [];
    if (category === "electric") extras.push(`<rect x="0" y="-9" width="58" height="18" rx="5" fill="${stroke}" transform="translate(205 150) rotate(-38)"/>`);
    if (category === "city") {
      extras.push(`<path d="M${rx - 66} ${wy - 6} A66 66 0 0 1 ${rx + 40} ${wy - 52}" fill="none" stroke="${stroke}" stroke-width="4"/>`);
      extras.push(`<path d="M${fx - 40} ${wy - 52} A66 66 0 0 1 ${fx + 66} ${wy - 6}" fill="none" stroke="${stroke}" stroke-width="4"/>`);
      extras.push(`<path d="M120 96 L60 96 M70 96 L${rx} ${wy}" fill="none" stroke="${stroke}" stroke-width="4"/>`);
    }
    if (category === "mountain") extras.push(`<rect x="0" y="-5" width="34" height="10" rx="4" fill="${stroke}" transform="translate(150 128) rotate(-45)"/>`);
    return `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bike illustration">
      ${wheel(rx)}${wheel(fx)}
      ${tube(bb, [rx, wy], 7)}${tube(st, [rx, wy], 6)}
      ${tube(bb, st)}${tube(st, ht)}${tube(bb, hb, 11)}${tube(ht, hb, 11)}
      ${fork}${extras.join("")}
      <line x1="${st[0]}" y1="${st[1]}" x2="162" y2="70" stroke="${stroke}" stroke-width="5"/>
      <path d="M140 66 Q162 60 186 68 L180 72 Q160 68 144 72 Z" fill="${stroke}"/>
      ${bar}
      <circle cx="${bb[0]}" cy="${bb[1]}" r="14" fill="none" stroke="${stroke}" stroke-width="3"/>
      <line x1="${bb[0]}" y1="${bb[1]}" x2="${bb[0] + 12}" y2="${bb[1] + 20}" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
    </svg>`;
  }

  function cog(cx, cy, r, teeth, fill) {
    const pts = [];
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i * Math.PI) / teeth, rr = i % 2 ? r : r * 0.82;
      pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
  }

  function partSVG(icon, color = "var(--brand)") {
    const k = "#1c2126";
    const shapes = {
      gear: `${cog(140, 125, 80, 24, k)}<circle cx="140" cy="125" r="44" fill="${color}"/>${cog(275, 140, 46, 14, k)}<circle cx="275" cy="140" r="22" fill="#eeebe3"/><circle cx="140" cy="125" r="14" fill="#eeebe3"/>`,
      brake: `<circle cx="180" cy="125" r="85" fill="none" stroke="${k}" stroke-width="16"/>${[...Array(10)].map((_, i) => { const a = i * Math.PI / 5; return `<circle cx="${180 + Math.cos(a) * 60}" cy="${125 + Math.sin(a) * 60}" r="8" fill="${k}"/>`; }).join("")}<circle cx="180" cy="125" r="26" fill="${k}"/><path d="M240 40 h60 a14 14 0 0 1 14 14 v50 h-74z" fill="${color}"/>`,
      bar: `<path d="M60 120 Q60 90 110 92 L290 92 Q340 90 340 120 Q340 170 300 175" fill="none" stroke="${k}" stroke-width="16" stroke-linecap="round"/><path d="M60 120 Q60 170 100 175" fill="none" stroke="${k}" stroke-width="16" stroke-linecap="round"/><rect x="180" y="70" width="40" height="44" rx="6" fill="${color}"/>`,
      wheel: `<circle cx="200" cy="125" r="100" fill="none" stroke="${k}" stroke-width="10"/><circle cx="200" cy="125" r="88" fill="none" stroke="${color}" stroke-width="18"/>${[...Array(12)].map((_, i) => { const a = i * Math.PI / 6; return `<line x1="200" y1="125" x2="${200 + Math.cos(a) * 78}" y2="${125 + Math.sin(a) * 78}" stroke="${k}" stroke-width="2"/>`; }).join("")}<circle cx="200" cy="125" r="12" fill="${k}"/>`,
      tire: `<circle cx="200" cy="125" r="92" fill="none" stroke="${k}" stroke-width="30"/><circle cx="200" cy="125" r="92" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="6 10"/>`,
      helmet: `<path d="M80 170 Q80 50 210 50 Q330 50 330 160 L300 170 Q280 130 220 128 L120 140 Z" fill="${k}"/><path d="M120 90 L180 70 M200 66 L260 70 M280 82 L310 110" stroke="${color}" stroke-width="10" stroke-linecap="round"/><path d="M110 175 L300 175" stroke="${color}" stroke-width="6"/>`,
      computer: `<rect x="120" y="40" width="160" height="170" rx="22" fill="${k}"/><rect x="138" y="60" width="124" height="104" rx="8" fill="#eeebe3"/><polyline points="146,140 170,120 190,130 214,96 238,110 254,84" fill="none" stroke="${color}" stroke-width="5"/><circle cx="200" cy="188" r="8" fill="${color}"/>`,
      light: `<rect x="70" y="100" width="110" height="50" rx="20" fill="${k}"/><circle cx="180" cy="125" r="18" fill="#fff"/><path d="M200 105 L320 70 L320 180 L200 145 Z" fill="${color}" opacity=".35"/><rect x="230" y="200" width="70" height="26" rx="10" fill="#d0021b"/>`,
      bottle: `<rect x="160" y="70" width="80" height="150" rx="22" fill="${color}"/><rect x="180" y="40" width="40" height="34" rx="6" fill="${k}"/><rect x="190" y="22" width="20" height="20" rx="4" fill="${k}"/><path d="M150 120 h100 M150 170 h100" stroke="${k}" stroke-width="4"/>`
    };
    return `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Part illustration">${shapes[icon] || shapes.gear}</svg>`;
  }

  function art(p, colorIdx = 0) {
    if (p.image) return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`;
    return p.type === "bike"
      ? bikeSVG((p.colors || ["#111"])[colorIdx] || p.colors[0], p.category, { suspension: /trail/i.test(p.name) })
      : partSVG(p.icon);
  }

  /* =======================================================
     UI HELPERS
     ======================================================= */
  function toast(msg, xp, cls = "") {
    const t = document.createElement("div");
    t.className = "toast " + cls;
    t.innerHTML = `<span>${msg}</span>${xp ? `<span class="xp">${xp}</span>` : ""}`;
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function stars(r) {
    const full = Math.round(r);
    return `<span class="stars">${"★".repeat(full)}${"☆".repeat(5 - full)}<em>${r.toFixed(1)}</em></span>`;
  }

  function priceHTML(p) {
    return `<span class="price">${peso(p.price)}${p.compareAt ? `<s>${peso(p.compareAt)}</s>` : ""}</span>`;
  }

  function openPanel(id) {
    closeAll();
    $("#overlay").classList.add("show");
    $(id).classList.add(id === "#cartDrawer" ? "open" : "open");
    document.body.style.overflow = "hidden";
  }
  function closeAll() {
    $("#overlay").classList.remove("show");
    $$(".drawer.open, .modal.open").forEach((el) => el.classList.remove("open"));
    $("#mainNav").classList.remove("open");
    document.body.style.overflow = "";
  }

  /* =======================================================
     PRODUCT CARD
     ======================================================= */
  function card(p) {
    const tagCls = p.tag ? p.tag.toLowerCase() : "";
    const cat = catOf(p.category);
    const fav = S.favs.includes(p.id);
    const cmp = S.compare.includes(p.id);
    return `<article class="card" data-id="${p.id}">
      <a class="card-media" href="#/product/${p.id}">
        ${p.tag ? `<span class="tag ${tagCls}">${esc(p.tag)}</span>` : ""}
        <span class="art">${art(p)}</span>
      </a>
      <button class="icon-btn card-fav ${fav ? "on" : ""}" data-action="fav" data-id="${p.id}" aria-label="Save to favourites">${fav ? "♥" : "♡"}</button>
      <div class="card-body">
        <span class="card-cat">${esc(cat ? cat.label : "")}</span>
        <a class="card-title" href="#/product/${p.id}">${esc(p.name)}</a>
        <div class="card-row">${priceHTML(p)}${stars(p.rating || 0)}</div>
        <div class="card-row">
          ${p.colors ? `<div class="swatches">${p.colors.map((c, i) => `<button class="swatch ${i === 0 ? "active" : ""}" style="background:${c}" data-action="swatch" data-id="${p.id}" data-i="${i}" aria-label="Colour option ${i + 1}"></button>`).join("")}</div>` : "<span></span>"}
          ${p.stock && p.stock <= 5 ? `<span class="stock-low">🔥 Only ${p.stock} left</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn btn-brand" data-action="add" data-id="${p.id}">Add to cart</button>
          ${p.type === "bike" ? `<button class="btn btn-ghost cmp ${cmp ? "on" : ""}" data-action="compare" data-id="${p.id}" title="Compare" aria-label="Compare">⇄</button>` : ""}
        </div>
      </div>
    </article>`;
  }

  /* =======================================================
     VIEWS
     ======================================================= */
  const app = $("#app");

  function viewHome() {
    const bikes = D.products.filter((p) => p.type === "bike");
    const parts = D.products.filter((p) => p.type === "part");
    const bikeCats = D.categories.filter((c) => c.type === "bike");
    const spinReady = S.lastSpin !== today();
    const slides = [
      { cls: "hero-bg-1", color: "#3c78c6", eyebrow: "New season", title: "Ride further. Ride faster.", text: "Road, gravel, mountain, city and electric bikes, picked for Philippine roads and trails.", bike: bikes[0], cta: ["Shop bikes", "#/shop/bikes"] },
      { cls: "hero-bg-2", color: "#92694b", eyebrow: "Bike Finder", title: "Find your perfect match", text: "Answer 4 quick questions and we'll match you with a bike. You also earn 75 XP.", bike: bikes[2], cta: ["Take the quiz", "quiz"] },
      { cls: "hero-bg-3", color: "#3c78c6", eyebrow: "Rider Club", title: "Level up. Save more.", text: "Earn XP every time you shop. Higher levels unlock bigger member discounts.", bike: bikes[4], cta: ["See rewards", "#/rewards"] }
    ];
    app.innerHTML = `
      <section class="hero" id="hero">
        ${slides.map((s, i) => `
          <div class="hero-slide ${s.cls} ${i === 0 ? "active" : ""}">
            <div class="hero-art">${bikeSVG(s.color, s.bike.category, { light: true })}</div>
            <div class="hero-content">
              <span class="eyebrow">${s.eyebrow}</span>
              <h1>${s.title}</h1>
              <p>${s.text}</p>
              <div class="hero-ctas">
                ${s.cta[1] === "quiz" ? `<button class="btn btn-brand" data-action="open-quiz">${s.cta[0]}</button>` : `<a class="btn btn-brand" href="${s.cta[1]}">${s.cta[0]}</a>`}
                <a class="btn btn-ghost light" href="#/shop/parts">Parts & gear</a>
              </div>
            </div>
          </div>`).join("")}
        <div class="hero-dots">${slides.map((_, i) => `<button class="${i === 0 ? "active" : ""}" data-action="slide" data-i="${i}" aria-label="Slide ${i + 1}"></button>`).join("")}</div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head"><div><h2>Shop by category</h2><p>Browse all five bike categories to earn the 🧭 Explorer badge.</p></div><a class="btn btn-ghost btn-sm" href="#/shop/bikes">All bikes →</a></div>
          <div class="cat-grid">
            ${bikeCats.map((c) => {
              const sample = bikes.find((b) => b.category === c.id);
              const seen = S.catsSeen.includes(c.id);
              return `<a class="cat-card" href="#/shop/${c.id}">
                <span class="arrow">${seen ? "✓" : "→"}</span>
                <div><h3>${c.label}</h3><p>${c.blurb}</p></div>
                ${bikeSVG(sample ? sample.colors[0] : "#111", c.id)}
              </a>`;
            }).join("")}
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          <div class="game-strip">
            <div class="game-card brand">
              <span class="big-emoji">💘</span>
              <div><h3>Bike Finder</h3><p>Not sure where to start? Take the 30-second quiz and we'll match you with a bike.</p></div>
              <div><button class="btn" data-action="open-quiz">Find my bike · +75 XP</button></div>
            </div>
            <div class="game-card earth">
              <span class="big-emoji">🎡</span>
              <div><h3>Daily Spin</h3><p>${spinReady ? "Spin once a day for discount codes, free shipping or bonus XP." : "You've already spun today. Come back tomorrow for another try."}</p></div>
              <div><button class="btn btn-brand" data-action="open-spin" ${spinReady ? "" : "disabled"}>${spinReady ? "Spin now" : "Back tomorrow"}</button></div>
            </div>
            <div class="game-card">
              <span class="big-emoji">🏆</span>
              <div><h3>Rider Club</h3><p>You're a <b>${D.levels[levelIndex()].name}</b>. ${levelProgress().next ? `${levelProgress().toNext} XP until ${levelProgress().next.name}.` : "That's the top level."}</p></div>
              <div><a class="btn btn-brand" href="#/rewards">View badges</a></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head"><div><h2>Featured bikes</h2><p>Hand-picked for this season.</p></div><a class="btn btn-ghost btn-sm" href="#/shop/bikes">View all →</a></div>
          <div class="rail">${bikes.map(card).join("")}</div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          <div class="section-head"><div><h2>Your missions</h2><p>Finish missions to earn XP and level up.</p></div></div>
          <div class="mission-list">${missionsHTML()}</div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head"><div><h2>Parts & gear</h2><p>Upgrade your ride. Add a bike and 2 parts to your cart to earn 🔧 Full Build.</p></div><a class="btn btn-ghost btn-sm" href="#/shop/parts">Shop parts →</a></div>
          <div class="rail">${parts.map(card).join("")}</div>
        </div>
      </section>`;
    startHero();
  }

  function missionsHTML() {
    return BADGES.map((b) => {
      const done = S.badges.includes(b.id);
      return `<div class="mission ${done ? "done" : ""}"><span class="ico">${done ? "✓" : b.icon}</span><div><strong>${b.name}</strong><small>${b.desc}</small></div><span class="reward">+${b.xp} XP</span></div>`;
    }).join("");
  }

  let heroTimer = null;
  function startHero() {
    clearInterval(heroTimer);
    let i = 0;
    const go = (n) => {
      const slides = $$(".hero-slide"), dots = $$(".hero-dots button");
      if (!slides.length) return clearInterval(heroTimer);
      i = n % slides.length;
      slides.forEach((s, k) => s.classList.toggle("active", k === i));
      dots.forEach((d, k) => d.classList.toggle("active", k === i));
    };
    heroTimer = setInterval(() => go(i + 1), 6500);
    startHero.go = (n) => { go(n); clearInterval(heroTimer); heroTimer = setInterval(() => go(i + 1), 6500); };
  }

  // Shop filter state lives in memory per visit
  const F = { cats: [], max: null, sort: "featured", q: "" };

  function viewShop(scope) {
    let base, title, crumb;
    if (scope === "bikes") { base = (p) => p.type === "bike"; title = "Bikes"; }
    else if (scope === "parts") { base = (p) => p.type === "part"; title = "Parts & Gear"; }
    else if (scope === "sale") { base = (p) => !!p.compareAt; title = "Sale"; }
    else if (scope === "favourites") { base = (p) => S.favs.includes(p.id); title = "Favourites"; }
    else {
      const c = catOf(scope);
      if (!c) return viewNotFound();
      base = (p) => p.category === scope; title = c.label;
      crumb = c.type === "bike" ? `<a href="#/shop/bikes">Bikes</a> / ` : `<a href="#/shop/parts">Parts & Gear</a> / `;
      trackCategory(scope);
    }
    const pool = D.products.filter(base);
    const availCats = [...new Set(pool.map((p) => p.category))];
    const maxPrice = Math.max(...pool.map((p) => p.price), 0);
    if (F._scope !== scope) { F.cats = []; F.max = maxPrice; F.q = ""; F._scope = scope; }

    app.innerHTML = `
      <div class="wrap">
        <div class="page-head">
          <div class="crumbs"><a href="#/">Home</a> / ${crumb || ""}${title}</div>
          <h1>${title}</h1>
        </div>
        <div class="shop-layout">
          <aside class="filters">
            ${availCats.length > 1 ? `<h4>Category</h4><div class="chip-list">${availCats.map((c) => `<button class="chip ${F.cats.includes(c) ? "on" : ""}" data-action="filter-cat" data-c="${c}">${catOf(c).label}</button>`).join("")}</div>` : ""}
            <h4>Max price</h4>
            <input class="range" type="range" min="0" max="${maxPrice}" step="500" value="${F.max}" id="priceRange" aria-label="Maximum price">
            <div class="muted" id="priceLabel">Up to ${peso(F.max)}</div>
            <h4>Quick picks</h4>
            <div class="chip-list">
              <a class="chip" href="#/shop/sale">🏷️ On sale</a>
              <a class="chip" href="#/shop/favourites">♥ Favourites (${S.favs.length})</a>
              <button class="chip" data-action="open-quiz">💘 Bike Finder</button>
            </div>
          </aside>
          <section>
            <div class="toolbar">
              <input type="search" id="searchBox" placeholder="Search ${title.toLowerCase()}…" value="${esc(F.q)}" aria-label="Search">
              <span class="muted" id="resultCount"></span>
              <select id="sortSel" aria-label="Sort">
                <option value="featured">Featured</option>
                <option value="low">Price: low to high</option>
                <option value="high">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </div>
            <div class="product-grid" id="grid"></div>
          </section>
        </div>
      </div>`;
    $("#sortSel").value = F.sort;
    const draw = () => {
      let list = pool.filter((p) => (!F.cats.length || F.cats.includes(p.category)) && p.price <= F.max && p.name.toLowerCase().includes(F.q.toLowerCase()));
      if (F.sort === "low") list.sort((a, b) => a.price - b.price);
      if (F.sort === "high") list.sort((a, b) => b.price - a.price);
      if (F.sort === "rating") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      $("#grid").innerHTML = list.length ? list.map(card).join("") : `<div class="empty"><div class="big">🚲💨</div><p>Nothing matches yet. Try widening your filters.</p></div>`;
      $("#resultCount").textContent = `${list.length} item${list.length === 1 ? "" : "s"}`;
    };
    viewShop.draw = draw;
    draw();
    $("#priceRange").addEventListener("input", (e) => { F.max = +e.target.value; $("#priceLabel").textContent = `Up to ${peso(F.max)}`; draw(); });
    $("#searchBox").addEventListener("input", (e) => { F.q = e.target.value; draw(); });
    $("#sortSel").addEventListener("change", (e) => { F.sort = e.target.value; draw(); });
  }

  function trackCategory(id) {
    const c = catOf(id);
    if (!c || c.type !== "bike" || S.catsSeen.includes(id)) return;
    S.catsSeen.push(id); save();
    const all = D.categories.filter((x) => x.type === "bike").map((x) => x.id);
    if (all.every((x) => S.catsSeen.includes(x))) award("explorer");
  }

  const PDP = { size: null, color: 0, qty: 1 };
  const SIZES = [
    { s: "XS", min: 150, max: 160 }, { s: "S", min: 160, max: 168 }, { s: "M", min: 168, max: 176 },
    { s: "L", min: 176, max: 184 }, { s: "XL", min: 184, max: 200 }
  ];

  function viewProduct(id) {
    const p = byId(id);
    if (!p) return viewNotFound();
    PDP.size = null; PDP.color = 0; PDP.qty = 1;
    if (!S.viewed.includes(id)) {
      S.viewed.push(id); save();
      award("first-look");
      if (S.viewed.length >= 5) award("window");
    }
    trackCategory(p.category);
    const c = catOf(p.category);
    const related = D.products.filter((x) => x.id !== p.id && (x.category === p.category || (p.type === "bike" && x.type === "part"))).slice(0, 4);
    const lvl = levelIndex();

    app.innerHTML = `
      <div class="wrap">
        <div class="crumbs" style="padding-top:24px"><a href="#/">Home</a> / <a href="#/shop/${p.type === "bike" ? "bikes" : "parts"}">${p.type === "bike" ? "Bikes" : "Parts & Gear"}</a> / <a href="#/shop/${p.category}">${c.label}</a> / ${esc(p.name)}</div>
        <div class="pdp">
          <div class="pdp-media" id="pdpArt">${art(p)}</div>
          <div>
            ${p.tag ? `<span class="tag ${p.tag.toLowerCase()}" style="position:static;display:inline-block;margin-bottom:10px">${esc(p.tag)}</span>` : ""}
            <h1>${esc(p.name)}</h1>
            <div class="card-row" style="justify-content:flex-start;gap:16px">${priceHTML(p)}${stars(p.rating || 0)}</div>
            ${LEVEL_PERKS[lvl] ? `<p class="xp-hint">${LEVEL_ICONS[lvl]} As a ${D.levels[lvl].name}, you save ${LEVEL_PERKS[lvl]}% at checkout: ${peso(p.price * (1 - LEVEL_PERKS[lvl] / 100))}</p>` : `<p class="xp-hint">Earn ${Math.max(1, Math.floor(p.price / 1000))} XP with this purchase. Level up to unlock member discounts.</p>`}
            ${p.stock && p.stock <= 5 ? `<p class="stock-low">🔥 Only ${p.stock} left in stock</p>` : ""}

            ${p.colors ? `<div class="pdp-block"><h4>Colour</h4><div class="swatches">${p.colors.map((col, i) => `<button class="swatch ${i === 0 ? "active" : ""}" style="background:${col};width:30px;height:30px" data-action="pdp-color" data-i="${i}" aria-label="Colour ${i + 1}"></button>`).join("")}</div></div>` : ""}

            ${p.type === "bike" ? `<div class="pdp-block"><h4>Frame size</h4>
              <div class="size-grid">${SIZES.map((z) => `<button class="size-btn" data-action="pdp-size" data-s="${z.s}">${z.s}</button>`).join("")}</div>
              <div class="size-helper">📏 Not sure? Enter your height: <input type="number" id="heightIn" placeholder="cm" min="140" max="210"> <button class="btn btn-sm btn-ghost" data-action="size-suggest">Suggest size</button></div>
            </div>` : ""}

            <div class="pdp-block" style="display:flex;gap:12px;align-items:stretch">
              <div class="qty"><button data-action="qty" data-d="-1" aria-label="Decrease">−</button><span id="qtyVal">1</span><button data-action="qty" data-d="1" aria-label="Increase">+</button></div>
              <button class="btn btn-brand" style="flex:1" data-action="add-pdp" data-id="${p.id}">Add to cart</button>
              <button class="btn btn-ghost card-fav-pdp" data-action="fav" data-id="${p.id}" aria-label="Save">${S.favs.includes(p.id) ? "♥" : "♡"}</button>
            </div>

            <div class="pdp-perks">
              <div><b>🚚</b>Free shipping over ${peso(D.freeShippingThreshold)}</div>
              <div><b>↩️</b>30-day returns</div>
              <div><b>⭐</b>Earn XP on every order</div>
            </div>

            ${p.specs ? `<div class="pdp-block" style="margin-top:18px"><h4>Specifications</h4><table class="spec-table">${Object.entries(p.specs).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
              <button class="btn btn-ghost btn-sm" style="margin-top:12px" data-action="compare" data-id="${p.id}">⇄ ${S.compare.includes(p.id) ? "In compare" : "Add to compare"}</button></div>` : ""}
          </div>
        </div>
        ${related.length ? `<section class="section" style="padding-top:0"><div class="section-head"><h2>${p.type === "bike" ? "Complete your build" : "You may also like"}</h2></div><div class="rail">${related.map(card).join("")}</div></section>` : ""}
      </div>`;
  }

  function viewRewards() {
    const i = levelIndex(), prog = levelProgress();
    app.innerHTML = `
      <div class="wrap">
        <div class="page-head"><div class="crumbs"><a href="#/">Home</a> / Rewards</div><h1>Rider Club</h1></div>
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
  }

  function viewNotFound() {
    app.innerHTML = `<div class="wrap empty" style="padding:120px 20px"><div class="big">🛞</div><h2>Flat tyre! Page not found.</h2><a class="btn btn-brand" href="#/">Back to home</a></div>`;
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
    toast(`Added ${esc(p.name)} to cart`);
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
    const ship = sub === 0 || freeShip ? 0 : 350;
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
    const c = $("#compareCount");
    c.hidden = !S.compare.length; c.textContent = S.compare.length;
  }

  function renderCart() {
    const t = cartTotals();
    const left = D.freeShippingThreshold - t.sub;
    $("#shipMeter").innerHTML = t.freeShip
      ? `🎉 <b>You've unlocked free shipping!</b><div class="meter"><span style="width:100%"></span></div>`
      : `🚚 Add <b>${peso(left)}</b> more for <b>free shipping</b><div class="meter"><span style="width:${Math.min(100, (t.sub / D.freeShippingThreshold) * 100)}%"></span></div>`;

    if (!S.cart.length) {
      $("#cartBody").innerHTML = `<div class="empty"><div class="big">🛒</div><p>Your cart is empty.</p><a class="btn btn-brand" href="#/shop/bikes" data-action="close-all">Start shopping</a></div>`;
      $("#cartFoot").innerHTML = "";
      return;
    }
    const inCart = new Set(S.cart.map((l) => l.id));
    const upsell = D.products.filter((p) => p.type === "part" && !inCart.has(p.id) && p.price <= Math.max(left, 3000)).slice(0, 3);
    $("#cartBody").innerHTML = S.cart.map((l) => {
      const p = byId(l.id);
      return `<div class="cart-line">
        <div class="thumb">${art(p, l.color)}</div>
        <div><strong>${esc(p.name)}</strong><small>${l.size ? "Size " + l.size + " · " : ""}${peso(p.price)}</small>
          <div style="display:flex;gap:10px;align-items:center;margin-top:6px">
            <div class="qty"><button data-action="line-qty" data-key="${l.key}" data-d="-1" aria-label="Decrease">−</button><span>${l.qty}</span><button data-action="line-qty" data-key="${l.key}" data-d="1" aria-label="Increase">+</button></div>
            <button class="remove" data-action="line-remove" data-key="${l.key}">Remove</button>
          </div></div>
        <b>${peso(p.price * l.qty)}</b>
      </div>`;
    }).join("") + (upsell.length ? `<div class="upsell"><h5>⚡ Quick adds${t.freeShip ? "" : " to unlock free shipping"}</h5>${upsell.map((p) => `<div class="upsell-item"><span>${esc(p.name)} · <b>${peso(p.price)}</b></span><button class="btn btn-sm btn-ghost" data-action="add" data-id="${p.id}">+ Add</button></div>`).join("")}</div>` : "");

    $("#cartFoot").innerHTML = `
      <div class="code-row"><input id="codeIn" placeholder="Discount code" value="${S.appliedCode || ""}" aria-label="Discount code"><button class="btn btn-sm" data-action="apply-code">Apply</button></div>
      <div class="sum-row"><span>Subtotal</span><span>${peso(t.sub)}</span></div>
      ${t.lvlPct ? `<div class="sum-row discount"><span>${LEVEL_ICONS[levelIndex()]} ${D.levels[levelIndex()].name} discount (${t.lvlPct}%)</span><span>−${peso(t.sub * t.lvlPct / 100)}</span></div>` : ""}
      ${t.codePct ? `<div class="sum-row discount"><span>Code ${S.appliedCode} (${t.codePct}%)</span><span>−${peso(t.sub * t.codePct / 100)}</span></div>` : ""}
      <div class="sum-row"><span>Shipping</span><span>${t.ship ? peso(t.ship) : "FREE"}</span></div>
      <div class="sum-row total"><span>Total</span><span>${peso(t.total)}</span></div>
      <div class="xp-hint">⭐ You'll earn ${Math.max(1, Math.floor(t.total / 1000))} XP with this order</div>
      <button class="btn btn-brand btn-block" data-action="checkout">Checkout</button>`;
  }

  function checkout() {
    const t = cartTotals();
    const xp = Math.max(1, Math.floor(t.total / 1000));
    S.cart = []; S.appliedCode = null; S.orders += 1; save();
    renderCartCount(); closeAll();
    app.innerHTML = `<div class="wrap empty" style="padding:100px 20px;color:var(--ink)">
      <div class="big">🏁</div><h1 style="font-size:64px">Order placed!</h1>
      <p>Thanks for riding with Cycle Central. See you on the road. Total paid: <b>${peso(t.total)}</b></p>
      <p class="muted">(This is a demo checkout. Payment integration comes next.)</p>
      <div class="hero-ctas" style="justify-content:center;margin-top:20px"><a class="btn btn-brand" href="#/rewards">See your rewards</a><a class="btn btn-ghost" href="#/">Keep shopping</a></div></div>`;
    window.scrollTo(0, 0);
    confetti();
    addXP(xp, "Order XP");
    setTimeout(() => award("podium"), 700);
  }

  /* =======================================================
     QUIZ
     ======================================================= */
  const QUIZ = [
    { key: "terrain", q: "Where will you ride most?", opts: [
      { v: "road", e: "🛣️", t: "Smooth roads", s: "Tarmac, long rides" },
      { v: "mixed", e: "🌾", t: "A bit of everything", s: "Roads plus dirt and gravel" },
      { v: "trail", e: "🌲", t: "Mountain trails", s: "Roots, rocks, descents" },
      { v: "city", e: "🏙️", t: "Around the city", s: "Commutes and errands" } ] },
    { key: "goal", q: "What's your main goal?", opts: [
      { v: "speed", e: "⚡", t: "Speed", s: "Races, PRs, group rides" },
      { v: "fitness", e: "💪", t: "Fitness", s: "Stay active, ride often" },
      { v: "adventure", e: "🗺️", t: "Adventure", s: "Explore new places" },
      { v: "commute", e: "⏱️", t: "Getting around", s: "Practical and reliable" } ] },
    { key: "level", q: "How experienced are you?", opts: [
      { v: "beginner", e: "🌱", t: "Just starting", s: "New to cycling" },
      { v: "intermediate", e: "🚴", t: "Regular rider", s: "A few rides a week" },
      { v: "advanced", e: "🏆", t: "Seasoned", s: "I know what I want" },
      { v: "intermediate", e: "🤷", t: "Not sure", s: "Somewhere in between" } ] },
    { key: "budget", q: "What's your budget?", opts: [
      { v: 60000, e: "💵", t: "Under ₱60k", s: "Great value" },
      { v: 120000, e: "💳", t: "₱60k – ₱120k", s: "Sweet spot" },
      { v: 200000, e: "💎", t: "₱120k – ₱200k", s: "Premium" },
      { v: Infinity, e: "🚀", t: "No limit", s: "Best of the best" } ] }
  ];
  const quiz = { step: 0, a: {} };

  function renderQuiz() {
    const card = $("#quizCard");
    const close = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">✕</button>`;
    if (quiz.step < QUIZ.length) {
      const q = QUIZ[quiz.step];
      card.innerHTML = `${close}
        <div class="quiz-progress">${QUIZ.map((_, i) => `<i class="${i <= quiz.step ? "on" : ""}"></i>`).join("")}</div>
        <div class="muted" style="font-size:13px">Question ${quiz.step + 1} of ${QUIZ.length}</div>
        <h2 class="quiz-q">${q.q}</h2>
        <div class="quiz-opts">${q.opts.map((o, i) => `<button class="quiz-opt" data-action="quiz-answer" data-i="${i}"><span class="e">${o.e}</span><strong>${o.t}</strong><small>${o.s}</small></button>`).join("")}</div>
        ${quiz.step ? `<button class="link-btn" style="margin-top:16px" data-action="quiz-back">← Back</button>` : ""}`;
      return;
    }
    // Score bikes
    const scored = D.products.filter((p) => p.type === "bike").map((p) => {
      let s = 0;
      if (p.quiz.terrain === quiz.a.terrain) s += 4;
      if (p.quiz.goal === quiz.a.goal) s += 3;
      if (p.quiz.level === quiz.a.level) s += 2;
      if (p.price <= quiz.a.budget) s += 3; else s -= 2;
      return { p, s };
    }).sort((a, b) => b.s - a.s);
    const best = scored[0], alt = scored.slice(1, 3);
    const pct = Math.min(99, Math.round((best.s / 12) * 100));
    card.innerHTML = `${close}
      <div class="quiz-result">
        <span class="match">${pct}% match</span>
        <h2 class="quiz-q">Meet your match: ${esc(best.p.name)}</h2>
        ${art(best.p)}
        <p>${priceHTML(best.p)} · ${catOf(best.p.category).label}</p>
        <div class="hero-ctas" style="justify-content:center">
          <a class="btn btn-brand" href="#/product/${best.p.id}" data-action="close-all">View bike</a>
          <button class="btn btn-ghost" data-action="quiz-restart">Retake quiz</button>
        </div>
        <p class="muted" style="margin-top:18px;font-size:13px">Also worth a look: ${alt.map((x) => `<a href="#/product/${x.p.id}" data-action="close-all" style="text-decoration:underline">${esc(x.p.name)}</a>`).join(" · ")}</p>
      </div>`;
    confetti();
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
    $("#spinCard").innerHTML = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">✕</button>
      <div class="spin-wrap">
        <h2 style="font-size:40px">Daily Spin</h2>
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
  function toggleCompare(id) {
    const i = S.compare.indexOf(id);
    if (i >= 0) S.compare.splice(i, 1);
    else {
      if (S.compare.length >= 3) { toast("You can compare up to 3 bikes"); return; }
      S.compare.push(id);
      toast(`Added to compare (${S.compare.length}/3)`);
    }
    save(); renderCartCount();
    $$(`[data-action=compare][data-id="${id}"]`).forEach((b) => b.classList.toggle("on", S.compare.includes(id)));
    if (S.compare.length >= 2) award("analyst");
  }

  function renderCompare() {
    const items = S.compare.map(byId);
    const card = $("#compareCard");
    const close = `<button class="icon-btn modal-close" data-action="close-all" aria-label="Close">✕</button>`;
    if (!items.length) { card.innerHTML = `${close}<div class="empty"><div class="big">⇄</div><p>Tap ⇄ on any bike to compare up to 3 side by side.</p></div>`; return; }
    const keys = [...new Set(items.flatMap((p) => Object.keys(p.specs || {})))];
    const minPrice = Math.min(...items.map((p) => p.price));
    const maxRating = Math.max(...items.map((p) => p.rating || 0));
    card.innerHTML = `${close}<h2 style="font-size:40px">Compare bikes</h2>
      <div style="overflow-x:auto"><table class="cmp-table">
        <tr><th></th>${items.map((p) => `<td>${art(p)}<a href="#/product/${p.id}" data-action="close-all"><b>${esc(p.name)}</b></a><br><button class="link-btn muted" data-action="compare-remove" data-id="${p.id}">Remove</button></td>`).join("")}</tr>
        <tr><th>Price</th>${items.map((p) => `<td class="${p.price === minPrice && items.length > 1 ? "best" : ""}">${peso(p.price)}${p.price === minPrice && items.length > 1 ? " 💰" : ""}</td>`).join("")}</tr>
        <tr><th>Rating</th>${items.map((p) => `<td class="${p.rating === maxRating && items.length > 1 ? "best" : ""}">${(p.rating || 0).toFixed(1)} ★</td>`).join("")}</tr>
        <tr><th>Category</th>${items.map((p) => `<td>${catOf(p.category).label}</td>`).join("")}</tr>
        ${keys.map((k) => `<tr><th>${esc(k)}</th>${items.map((p) => `<td>${esc((p.specs || {})[k] || "—")}</td>`).join("")}</tr>`).join("")}
        <tr><th></th>${items.map((p) => `<td><button class="btn btn-brand btn-sm" data-action="add" data-id="${p.id}">Add to cart</button></td>`).join("")}</tr>
      </table></div>`;
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
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const a = el.dataset.action, id = el.dataset.id;
    switch (a) {
      case "toggle-menu": $("#mainNav").classList.toggle("open"); break;
      case "close-all": closeAll(); break;
      case "open-cart": renderCart(); openPanel("#cartDrawer"); break;
      case "open-quiz": quiz.step = 0; quiz.a = {}; renderQuiz(); openPanel("#quizModal"); break;
      case "open-spin": renderSpin(); openPanel("#spinModal"); break;
      case "open-compare": renderCompare(); openPanel("#compareModal"); break;
      case "go-rewards": location.hash = "#/rewards"; break;
      case "slide": startHero.go && startHero.go(+el.dataset.i); break;

      case "add":
        e.preventDefault();
        addToCart(id);
        if ($("#cartDrawer").classList.contains("open")) renderCart();
        break;
      case "fav": {
        const i = S.favs.indexOf(id);
        if (i >= 0) S.favs.splice(i, 1); else { S.favs.push(id); toast("Saved to favourites ♥"); }
        save();
        $$(`[data-action=fav][data-id="${id}"]`).forEach((b) => { b.textContent = S.favs.includes(id) ? "♥" : "♡"; b.classList.toggle("on", S.favs.includes(id)); });
        if (S.favs.length >= 3) award("collector");
        break;
      }
      case "compare": toggleCompare(id); if (el.textContent.includes("compare")) el.textContent = `⇄ ${S.compare.includes(id) ? "In compare" : "Add to compare"}`; break;
      case "compare-remove": toggleCompare(id); renderCompare(); break;
      case "swatch": {
        const p = byId(id), i = +el.dataset.i;
        const cardEl = el.closest(".card");
        $(".art", cardEl).innerHTML = art(p, i);
        $$(".swatch", cardEl).forEach((s, k) => s.classList.toggle("active", k === i));
        break;
      }

      case "pdp-color": {
        const p = byId(location.hash.split("/")[2]);
        PDP.color = +el.dataset.i;
        $("#pdpArt").innerHTML = art(p, PDP.color);
        $$("[data-action=pdp-color]").forEach((s, k) => s.classList.toggle("active", k === PDP.color));
        break;
      }
      case "pdp-size":
        PDP.size = el.dataset.s;
        $$(".size-btn").forEach((b) => b.classList.toggle("on", b.dataset.s === PDP.size));
        break;
      case "size-suggest": {
        const h = +$("#heightIn").value;
        const z = SIZES.find((x) => h >= x.min && h < x.max) || (h >= 200 ? SIZES[4] : null);
        if (!z) { toast("Enter a height between 150 and 210 cm"); break; }
        PDP.size = z.s;
        $$(".size-btn").forEach((b) => b.classList.toggle("on", b.dataset.s === z.s));
        toast(`📏 We recommend size ${z.s} for ${h} cm`);
        break;
      }
      case "qty":
        PDP.qty = Math.max(1, Math.min(10, PDP.qty + +el.dataset.d));
        $("#qtyVal").textContent = PDP.qty;
        break;
      case "add-pdp": {
        const p = byId(id);
        if (p.type === "bike" && !PDP.size) { toast("Please pick a frame size first 📏"); $(".size-grid").scrollIntoView({ behavior: "smooth", block: "center" }); break; }
        addToCart(id, PDP.qty, { size: PDP.size, color: PDP.color });
        renderCart(); openPanel("#cartDrawer");
        break;
      }

      case "line-qty": {
        const l = S.cart.find((x) => x.key === el.dataset.key);
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
        if (ok) { S.appliedCode = v; save(); toast(`Code ${v} applied 🎉`); }
        else toast("That code isn't valid. Win codes from the Daily Spin 🎡");
        renderCart();
        break;
      }
      case "checkout": checkout(); break;

      case "quiz-answer": {
        const q = QUIZ[quiz.step];
        quiz.a[q.key] = q.opts[+el.dataset.i].v;
        quiz.step++; renderQuiz();
        break;
      }
      case "quiz-back": quiz.step = Math.max(0, quiz.step - 1); renderQuiz(); break;
      case "quiz-restart": quiz.step = 0; quiz.a = {}; renderQuiz(); break;
      case "do-spin": doSpin(); break;

      case "filter-cat": {
        const c = el.dataset.c, i = F.cats.indexOf(c);
        if (i >= 0) F.cats.splice(i, 1); else F.cats.push(c);
        el.classList.toggle("on");
        viewShop.draw && viewShop.draw();
        break;
      }
      case "reset":
        if (confirm("Reset all XP, badges, cart and favourites?")) { S = Object.assign({}, defaults, { cart: [], compare: [], favs: [], badges: [], viewed: [], catsSeen: [], codes: [] }); save(); renderXP(); renderCartCount(); route(); }
        break;
    }
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

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
  function route() {
    const [, page, arg] = (location.hash || "#/").split("/");
    clearInterval(heroTimer);
    closeAll();
    if (!page) viewHome();
    else if (page === "shop") viewShop(arg || "bikes");
    else if (page === "product") viewProduct(arg);
    else if (page === "rewards") viewRewards();
    else viewNotFound();
    window.scrollTo(0, 0);
    onScroll();
  }
  addEventListener("hashchange", route);

  /* =======================================================
     INIT
     ======================================================= */
  function buildMega() {
    const tile = (c) => {
      const sample = D.products.find((p) => p.category === c.id);
      const pic = c.type === "bike" ? bikeSVG(sample ? sample.colors[0] : "#111", c.id) : partSVG(sample ? sample.icon : "gear");
      return `<a class="mega-tile" href="#/shop/${c.id}">${pic}<strong>${c.label}</strong><span>${c.blurb}</span></a>`;
    };
    $("#megaBikes").innerHTML = `<div class="mega-inner">${D.categories.filter((c) => c.type === "bike").map(tile).join("")}</div>`;
    $("#megaParts").innerHTML = `<div class="mega-inner">${D.categories.filter((c) => c.type === "part").map(tile).join("")}</div>`;
  }

  $("#promoThreshold").textContent = peso(D.freeShippingThreshold);
  $("#year").textContent = new Date().getFullYear();
  buildMega();
  renderXP();
  renderCartCount();
  route();
})();
