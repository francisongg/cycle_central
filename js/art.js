/*
 * Drawn artwork: interface icons and the placeholder product illustrations.
 * A product with an `image` in js/data.js uses its photo and skips the illustration.
 */
(function () {
  "use strict";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Icons (24px grid, drawn with the current text colour) ---------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    cart: '<path d="M3 4h2.2l2.3 11.1a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L19.8 8H6.3"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    heart: '<path d="M12 20.3S4.5 15.9 4.5 10.4A4.1 4.1 0 0 1 12 8.2a4.1 4.1 0 0 1 7.5 2.2c0 5.5-7.5 9.9-7.5 9.9z"/>',
    compare: '<path d="M8 20V5m0 0L4.5 8.5M8 5l3.5 3.5M16 4v15m0 0-3.5-3.5M16 19l3.5-3.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    arrow: '<path d="M5 12h14m0 0-5-5m5 5-5 5"/>',
    sliders: '<path d="M4 7h9m5 0h2M4 17h3m5 0h8"/><circle cx="15.5" cy="7" r="2.2"/><circle cx="9.5" cy="17" r="2.2"/>',
    truck: '<path d="M3 6.5h10.5V16H3zM13.5 10h4l3 3.2V16h-7"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    shield: '<path d="M12 3.5 5 6v5.5c0 4.3 2.9 7.4 7 9 4.1-1.6 7-4.7 7-9V6z"/><path d="m9 12 2.2 2.2L15 10.4"/>',
    returns: '<path d="M4 9h11a4.5 4.5 0 0 1 0 9H8M4 9l4-4M4 9l4 4"/>',
    ruler: '<path d="M3.5 15.5 15.5 3.5l5 5-12 12zM7.5 11.5l2 2M10.5 8.5l2 2M13.5 5.5l2 2"/>',
    bolt: '<path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z"/>',
    weight: '<path d="M6.5 8.5h11l2 11h-15z"/><circle cx="12" cy="6" r="2.4"/>',
    frame: '<path d="M4.5 17 9 7h8.5L12 17zM9 7l3 10M17.5 7l2 5"/>',
    gears: '<circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3v2.8M12 18.2V21M3 12h2.8M18.2 12H21M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"/>',
    brake: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/><path d="M12 5.8v2M12 16.2v2M5.8 12h2M16.2 12h2"/>',
    battery: '<rect x="3" y="8" width="16" height="9" rx="2"/><path d="M21.2 11v3M7 11v3M10.5 11v3"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16"/>',
    wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3.5v6.9M12 13.6v6.9M3.5 12h6.9M13.6 12h6.9"/>',
    spring: '<path d="M8 4h8M8 20h8M9 7l6 2-6 2 6 2-6 2 6 2"/>',
    box: '<path d="m4 8 8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    tag: '<path d="M3.5 12.5v-8h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    dot: '<circle cx="12" cy="12" r="3"/>'
  };
  function icon(name, size = 20) {
    return `<svg class="i" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.dot}</svg>`;
  }

  /* ---------- Bike illustration ---------- */
  // Side-view geometry per bike style. Points are [x, y] in a 400 x 250 drawing.
  const GEO = {
    road:     { R: 66, tire: 5,  rear: [102, 172], front: [302, 172], bb: [182, 186], seat: [153, 88], headTop: [262, 78], headBot: [270, 104], post: 30, ring: 16, bar: "drop" },
    gravel:   { R: 66, tire: 8,  rear: [100, 172], front: [304, 172], bb: [181, 185], seat: [153, 92], headTop: [262, 80], headBot: [270, 106], post: 27, ring: 14, bar: "drop" },
    mountain: { R: 67, tire: 11, rear: [94, 171],  front: [316, 171], bb: [178, 179], seat: [157, 98], headTop: [259, 64], headBot: [267, 82],  post: 30, ring: 12, bar: "flat", fork: "sus", knobs: true },
    city:     { R: 65, tire: 7,  rear: [100, 173], front: [300, 173], bb: [180, 185], seat: [151, 96], headTop: [254, 66], headBot: [264, 98],  post: 26, ring: 15, bar: "swept", fenders: true }
  };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; };
  const pol = (c, r, deg) => [c[0] + r * Math.cos((deg * Math.PI) / 180), c[1] + r * Math.sin((deg * Math.PI) / 180)];
  const n = (v) => Math.round(v * 10) / 10;
  const line = (a, b, w, c, extra = "") => `<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;

  /**
   * @param {string} color  frame colour
   * @param {string} style  road | gravel | mountain | city | electric
   * @param {object} o      light (for dark backgrounds), label (alt text), deepRims, fullSus,
   *                        ebase ("city" | "mountain", for electric), hubMotor
   */
  function bikeSVG(color = "#3c78c6", style = "road", o = {}) {
    const electric = style === "electric";
    const g = GEO[electric ? (o.ebase || "city") : style] || GEO.road;
    const ink = o.light ? "#eeebe3" : "#1c2126";
    const metal = o.light ? "#aeb6bf" : "#8f969d";
    const rimC = o.deepRims ? (o.light ? "#d8d4ca" : "#2a3037") : (o.light ? "#c9ced4" : "#b3b8be");
    const rimW = o.deepRims ? 15 : 4.5;
    const { R, tire, rear, front, bb, seat, headTop, headBot } = g;

    const wheel = (c) => {
      const spokeR = R - tire - rimW - 1;
      const spokes = Array.from({ length: 16 }, (_, k) => { const p = pol(c, spokeR, k * 22.5 + 7); return `<line x1="${c[0]}" y1="${c[1]}" x2="${n(p[0])}" y2="${n(p[1])}"/>`; }).join("");
      return `<circle cx="${c[0]}" cy="${c[1]}" r="${R - tire / 2}" fill="none" stroke="${ink}" stroke-width="${tire}"/>
        ${g.knobs ? `<circle cx="${c[0]}" cy="${c[1]}" r="${R - 1}" fill="none" stroke="${ink}" stroke-width="3.5" stroke-dasharray="3 4.5"/>` : ""}
        <circle cx="${c[0]}" cy="${c[1]}" r="${n(R - tire - rimW / 2 - 0.5)}" fill="none" stroke="${rimC}" stroke-width="${rimW}"/>
        <g stroke="${metal}" stroke-width=".9" opacity=".6">${spokes}</g>
        <circle cx="${c[0]}" cy="${c[1]}" r="13" fill="none" stroke="${metal}" stroke-width="2.2" stroke-dasharray="5 2.5"/>`;
    };

    // Frame joints
    const seatJoin = lerp(seat, bb, 0.08);
    const steer = unit(headBot, headTop);
    const headJoinTop = lerp(headTop, headBot, 0.22);
    const headJoinBot = lerp(headTop, headBot, 0.85);
    const pivot = lerp(bb, seat, 0.5);
    const stayTop = o.fullSus ? pivot : lerp(seat, bb, 0.14);
    const downW = electric && !o.hubMotor ? 15 : 9;
    const tubes = [
      [rear, bb, 5], [rear, stayTop, 4.5], [bb, seat, 8],
      [seatJoin, headJoinTop, 7], [bb, headJoinBot, downW], [headTop, headBot, 10]
    ];
    const outline = o.light ? "" : tubes.map(([a, b, w]) => line(a, b, w + 1.6, "#1c2126", 'opacity=".3"')).join("");
    const frame = tubes.map(([a, b, w]) => line(a, b, w, color)).join("");
    const shine = [tubes[3], tubes[4]].map(([a, b]) => line([a[0] + 3, a[1] - 1.8], [b[0] - 3, b[1] - 1.8], 1.6, "#ffffff", 'opacity=".28"')).join("");

    // Fork
    let fork;
    if (g.fork === "sus") {
      const mid = lerp(headBot, front, 0.5);
      fork = line(headBot, lerp(headBot, front, 0.62), 6, metal) + line(mid, front, 10, ink) + line(lerp(headBot, front, -0.04), lerp(headBot, front, 0.1), 12, ink);
    } else {
      const bend = [headBot[0] + (front[0] - headBot[0]) * 0.35, headBot[1] + (front[1] - headBot[1]) * 0.62];
      fork = `<path d="M${n(headBot[0])} ${n(headBot[1])} Q${n(bend[0])} ${n(bend[1])} ${front[0]} ${front[1]}" fill="none" stroke="${o.light ? "none" : "#1c2126"}" stroke-opacity=".3" stroke-width="7.6" stroke-linecap="round"/>
        <path d="M${n(headBot[0])} ${n(headBot[1])} Q${n(bend[0])} ${n(bend[1])} ${front[0]} ${front[1]}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
    }

    // Rear shock on full-suspension frames
    const shock = o.fullSus
      ? line(lerp(pivot, [pivot[0] + 30, pivot[1] - 22], 0.1), [pivot[0] + 34, pivot[1] - 26], 6, ink) + line([pivot[0] + 20, pivot[1] - 15], [pivot[0] + 40, pivot[1] - 31], 3.5, metal)
      : "";

    // Seatpost and saddle
    const up = unit(bb, seat);
    const postTop = [seat[0] + up[0] * g.post, seat[1] + up[1] * g.post];
    const [sx, sy] = postTop;
    const saddle = `<path d="M${n(sx - 25)} ${n(sy + 1)} Q${n(sx - 12)} ${n(sy - 6)} ${n(sx + 6)} ${n(sy - 4.5)} L${n(sx + 23)} ${n(sy - 5.5)} Q${n(sx + 27)} ${n(sy - 2)} ${n(sx + 21)} ${n(sy)} L${n(sx - 4)} ${n(sy + 3.5)} Q${n(sx - 20)} ${n(sy + 6)} ${n(sx - 25)} ${n(sy + 1)} Z" fill="${ink}"/>`;

    // Stem and handlebar
    const stemBase = [headTop[0] + steer[0] * 7, headTop[1] + steer[1] * 7];
    let cockpit;
    if (g.bar === "drop") {
      const e = [stemBase[0] + 22, stemBase[1] - 3];
      cockpit = line(headTop, stemBase, 7, ink) + line(stemBase, e, 5.5, ink)
        + `<path d="M${n(e[0])} ${n(e[1])} h9 q14 1 13 15 q-1 13 -15 12" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`
        + line([e[0] + 11, e[1] - 1], [e[0] + 18, e[1] - 10], 5.5, ink);
    } else if (g.bar === "flat") {
      const e = [stemBase[0] + 15, stemBase[1] - 6];
      cockpit = line(headTop, stemBase, 8, ink) + line(stemBase, e, 6, ink)
        + `<circle cx="${n(e[0])}" cy="${n(e[1])}" r="5" fill="${ink}"/>` + line([e[0] + 2, e[1] + 2], [e[0] + 12, e[1] + 9], 3, ink);
    } else {
      const e = [stemBase[0] + 3, stemBase[1] - 15];
      cockpit = line(headTop, e, 6, ink)
        + `<path d="M${n(e[0] + 8)} ${n(e[1] - 3)} Q${n(e[0] - 4)} ${n(e[1] - 6)} ${n(e[0] - 24)} ${n(e[1] + 1)}" fill="none" stroke="${ink}" stroke-width="5.5" stroke-linecap="round"/>`;
    }

    // Drivetrain
    const cr = g.ring;
    const pedal = [bb[0] + 27, bb[1] + 13];
    const farPedal = [bb[0] - 27, bb[1] - 13];
    const pulley = [rear[0] + 7, rear[1] + 21];
    const chain = `<g stroke="${ink}" stroke-width="1.7" fill="none" opacity=".85">
        <line x1="${bb[0]}" y1="${bb[1] - cr}" x2="${rear[0]}" y2="${rear[1] - 8}"/>
        <polyline points="${bb[0]},${bb[1] + cr} ${pulley[0]},${pulley[1] + 2} ${rear[0]},${rear[1] + 8}"/>
      </g>
      <circle cx="${rear[0]}" cy="${rear[1]}" r="8.5" fill="${ink}"/>
      ${line([rear[0] + 2, rear[1] + 7], pulley, 3.5, ink)}<circle cx="${pulley[0]}" cy="${pulley[1]}" r="3.2" fill="${ink}"/>`;
    const motor = electric && !o.hubMotor ? `<circle cx="${bb[0]}" cy="${bb[1]}" r="18" fill="${ink}"/>` : "";
    const hubMotor = electric && o.hubMotor ? `<circle cx="${rear[0]}" cy="${rear[1]}" r="15" fill="${ink}"/>` : "";
    const battery = electric
      ? (o.hubMotor
          ? line(lerp(bb, headJoinBot, 0.22), lerp(bb, headJoinBot, 0.72), 13, ink)
          : line(lerp(bb, headJoinBot, 0.2), lerp(bb, headJoinBot, 0.78), 7, ink, 'opacity=".85"'))
      : "";
    const crankset = `${line(bb, farPedal, 4.5, ink, 'opacity=".45"')}
      <circle cx="${bb[0]}" cy="${bb[1]}" r="${cr}" fill="none" stroke="${motor ? metal : ink}" stroke-width="3.2"/>
      <circle cx="${bb[0]}" cy="${bb[1]}" r="5" fill="${motor ? metal : ink}"/>
      ${line(bb, pedal, 4.8, motor ? metal : ink)}
      <rect x="${pedal[0] - 8}" y="${pedal[1] - 2.5}" width="16" height="5" rx="2" fill="${ink}"/>`;

    // City extras: fenders and a rear rack
    let extras = "";
    if (g.fenders) {
      const arc = (c, from, to) => { const a = pol(c, R + 5, from), b = pol(c, R + 5, to); return `<path d="M${n(a[0])} ${n(a[1])} A${R + 5} ${R + 5} 0 0 1 ${n(b[0])} ${n(b[1])}" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`; };
      const rackY = rear[1] - R - 12;
      extras = arc(rear, 172, 318) + arc(front, 222, 332)
        + line([rear[0] - 34, rackY], [seatJoin[0] - 4, rackY], 3.2, ink) + line(rear, [rear[0] - 26, rackY], 2.6, ink) + line(rear, [rear[0] + 16, rackY], 2.6, ink);
    }

    const shadow = o.light ? "" : `<ellipse cx="${(rear[0] + front[0]) / 2}" cy="${rear[1] + R + 3}" rx="${(front[0] - rear[0]) / 2 + R * 0.8}" ry="4.5" fill="#1c2126" opacity=".07"/>`;
    const label = o.label ? `role="img" aria-label="${esc(o.label)}"` : 'aria-hidden="true" focusable="false"';

    return `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" ${label}>
      ${shadow}${wheel(rear)}${wheel(front)}${hubMotor}${extras}${chain}
      ${outline}${frame}${battery}${shine}${fork}${shock}${motor}
      ${line(seat, postTop, 5, ink)}${saddle}${cockpit}${crankset}
      <circle cx="${rear[0]}" cy="${rear[1]}" r="4" fill="${metal}"/><circle cx="${front[0]}" cy="${front[1]}" r="4.5" fill="${ink}"/>
    </svg>`;
  }

  /* ---------- Part illustrations ---------- */
  function cog(cx, cy, r, teeth, fill) {
    const pts = [];
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i * Math.PI) / teeth, rr = i % 2 ? r : r * 0.82;
      pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
  }

  function partSVG(icon, color = "var(--brand)", label = "") {
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
    return `<svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"'}>${shapes[icon] || shapes.gear}</svg>`;
  }


  window.CC_ART = { icon, bikeSVG, partSVG };
})();
