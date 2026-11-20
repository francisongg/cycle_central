// Bike Town: Cycle Central as a small 3D town. You ride a bike around, and every building is a
// shop: bike types, brand showrooms, parts, the sale stall, the Budget Bank (Bike Finder), the Fit
// Studio (sizing), the Post Office (your cart), the Rider Club and a Ferris wheel for the Daily Spin.
//
// Loaded only on /town/ by js/app.js (startTown), which passes in the shop data and actions (api).
// The build bundles this file with three.js (scripts/build.mjs, esbuild), so the rest of the site
// never downloads the 3D engine.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const UP = new THREE.Vector3(0, 1, 0);
const BX = 104, BZ0 = -84, BZ1 = 90;   // playable area: x in [-BX, BX], z in [BZ0, BZ1]
const SEA_Z = 76;                      // the bay (south); only the pier goes further
const PIER_X = 2.4;
const C = { ink: "#1c2126", cream: "#eeebe3", blue: "#3c78c6", brown: "#92694b", road: "#4b5058", grass: "#a8cd86", sand: "#ead9b0", sea: "#4b9bd0", white: "#f7f6f2", glass: "#b7d5ee", wood: "#a9764f", gold: "#e3b23c", skin: "#b07a52" };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const seeded = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const escHTML = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function mount(stage, api) {
  const q = (s) => stage.querySelector(s);
  const loading = q(".town-loading");
  const lowEnd = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency || 8) <= 4
    || (matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 500);
  const calm = api.reducedMotion;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: "high-performance" });
  } catch (e) {
    stage.classList.add("no-webgl");
    if (loading) loading.innerHTML = "<p>Your browser can't show the 3D town, so here's every shop as a list below.</p>";
    return { destroy() {} };
  }
  let dead = false;
  const cleanups = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  const canvas = renderer.domElement;
  canvas.className = "town-canvas";
  canvas.setAttribute("aria-hidden", "true");
  stage.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.75));
  renderer.shadowMap.enabled = !lowEnd;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const SKY = new THREE.Color("#c4e2f4");
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 120, 260);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 520);
  scene.add(new THREE.HemisphereLight("#eef6ff", "#8b7d58", 1.25));
  const sun = new THREE.DirectionalLight("#fff3dc", 2.3);
  sun.castShadow = !lowEnd;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 170 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  /* ---------- building blocks ---------- */
  const mats = new Map();
  const extraMats = [];
  const M = (color, o = {}) => {
    const k = color + JSON.stringify(o);
    let m = mats.get(k);
    if (!m) { m = new THREE.MeshLambertMaterial({ color, ...o }); mats.set(k, m); }
    return m;
  };
  const textures = [];
  function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, cast = true) {
    const m = new THREE.Mesh(geo, typeof mat === "string" ? M(mat) : mat);
    m.position.set(x, y, z);
    m.castShadow = cast && !lowEnd;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  // A box standing on y (its bottom), centred on x/z
  const blk = (w, h, d, mat, x, y, z, parent, cast) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, parent, cast);
  const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 18, cast) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z, parent, cast);
  const ROD = new THREE.CylinderGeometry(1, 1, 1, 7);
  function rod(a, b, r, mat, parent) {
    const m = mesh(ROD, mat, 0, 0, 0, parent);
    setRod(m, a, b, r);
    return m;
  }
  const _d = new THREE.Vector3();
  function setRod(m, a, b, r = m.scale.x) {
    _d.subVectors(b, a);
    const len = _d.length() || 0.001;
    m.position.copy(a).addScaledVector(_d, 0.5);
    m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
    m.scale.set(r, len, r);
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function roundRect(x, l, t, w, h, r) {
    x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
  }
  // Painted sign: big italic caps like the site's headings, optional second line
  function signTexture(text, { bg = C.ink, fg = "#fff", w = 512, h = 128, sub = "", border = "" } = {}) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = bg; roundRect(x, 0, 0, w, h, Math.min(24, h / 4)); x.fill();
    if (border) { x.strokeStyle = border; x.lineWidth = 8; roundRect(x, 6, 6, w - 12, h - 12, Math.min(18, h / 5)); x.stroke(); }
    x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle";
    const t = String(text).toUpperCase();
    let size = Math.round(h * (sub ? 0.46 : 0.6));
    do { x.font = `italic 800 ${size}px Inter, "Arial Black", sans-serif`; size -= 2; } while (x.measureText(t).width > w - 44 && size > 14);
    x.fillText(t, w / 2, sub ? h * 0.4 : h * 0.53);
    if (sub) { x.globalAlpha = 0.9; x.font = `700 ${Math.round(h * 0.2)}px Inter, Arial, sans-serif`; x.fillText(sub, w / 2, h * 0.78); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    textures.push(tex);
    return tex;
  }
  function board(text, opts, w, h, parent, x, y, z, ry = 0, double = false) {
    const tex = signTexture(text, { ...opts, w: 512, h: Math.max(64, Math.round((512 * h) / w)) });
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.35 });
    extraMats.push(mat);
    const geo = new THREE.PlaneGeometry(w, h);
    const front = new THREE.Mesh(geo, mat);
    front.position.set(x, y, z); front.rotation.y = ry;
    parent.add(front);
    if (double) {
      // a board with the sign painted on both faces
      front.translateZ(0.09);
      const back = new THREE.Mesh(geo, mat);
      back.position.set(x, y, z); back.rotation.y = ry + Math.PI;
      back.translateZ(0.09);
      parent.add(back);
      blk(w + 0.3, h + 0.3, 0.14, C.ink, x, y - h / 2 - 0.15, z, parent).rotation.y = ry;
    }
    return front;
  }
  function stripes(a, b, n = 8, w = 256, h = 64) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d");
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect((i * w) / n, 0, w / n + 1, h); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; textures.push(tex);
    const m = new THREE.MeshLambertMaterial({ map: tex }); extraMats.push(m);
    return m;
  }

  // Everything that never moves is merged into one mesh per material, so a phone draws a few
  // dozen big meshes instead of thousands of small ones. Moving parts are marked userData.keep.
  const SHARED = new Set();
  function mergeInto(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const buckets = new Map(), victims = [];
    const walk = (o) => {
      for (const c of o.children) {
        if (c.userData.keep || c.isInstancedMesh) continue;
        if (c.isMesh) {
          const geo = (c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld));
          for (const k of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(k)) geo.deleteAttribute(k);
          if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
          geo.clearGroups();
          const key = c.material.uuid + (c.castShadow ? "1" : "0");
          if (!buckets.has(key)) buckets.set(key, { mat: c.material, cast: c.castShadow, geos: [] });
          buckets.get(key).geos.push(geo);
          victims.push(c);
        }
        walk(c);
      }
    };
    walk(root);
    for (const v of victims) { v.removeFromParent(); if (!SHARED.has(v.geometry)) v.geometry.dispose(); }
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.geos, false);
      if (!merged) { for (const g of b.geos) { const m = new THREE.Mesh(g, b.mat); m.castShadow = b.cast; m.receiveShadow = true; m.userData.keep = true; root.add(m); } continue; }
      b.geos.forEach((g) => g.dispose());
      const m = new THREE.Mesh(merged, b.mat);
      m.castShadow = b.cast; m.receiveShadow = true; m.userData.keep = true;
      root.add(m);
    }
  }

  /* ---------- bikes and riders ---------- */
  const WHEEL = new THREE.TorusGeometry(0.62, 0.075, 8, 28);
  const SPOKE = new THREE.BoxGeometry(0.035, 1.18, 0.035);
  const PEDAL = new THREE.BoxGeometry(0.2, 0.05, 0.1);
  [ROD, WHEEL, SPOKE, PEDAL].forEach((g) => SHARED.add(g));
  // A bicycle facing +z; with a rider when `jersey` is given. `live` bikes move: their wheels,
  // cranks and legs stay separate and the rest is merged; parked bikes are merged with the town.
  function makeBike(color, jersey = null, helmet = C.blue, live = false) {
    const root = new THREE.Group(); // turns (yaw)
    const g = new THREE.Group();    // leans (roll)
    root.add(g);
    const tyre = M("#25292e"), frame = M(color), metal = M("#a3a9ae"), ink = M(C.ink);
    const wheels = [];
    for (const z of [-0.95, 0.95]) {
      const w = new THREE.Group();
      w.position.set(0, 0.69, z);
      mesh(WHEEL, tyre, 0, 0, 0, w).rotation.y = Math.PI / 2;
      mesh(SPOKE, metal, 0, 0, 0, w, false);
      mesh(SPOKE, metal, 0, 0, 0, w, false).rotation.x = Math.PI / 2;
      g.add(w); wheels.push(w);
    }
    const R = V(0, 0.69, -0.95), B = V(0, 0.44, -0.12), S = V(0, 1.42, -0.42), H = V(0, 1.38, 0.6), Hb = V(0, 1.14, 0.7), F = V(0, 0.69, 0.95);
    rod(B, S, 0.06, frame, g); rod(S, H, 0.055, frame, g); rod(B, Hb, 0.065, frame, g);
    rod(R, B, 0.04, frame, g); rod(R, S, 0.038, frame, g); rod(Hb, F, 0.045, frame, g); rod(H, Hb, 0.06, frame, g);
    rod(H, V(0, 1.52, 0.66), 0.035, ink, g);
    rod(V(-0.3, 1.52, 0.68), V(0.3, 1.52, 0.68), 0.032, ink, g);
    blk(0.18, 0.06, 0.38, ink, 0, 1.44, -0.44, g);
    const crank = new THREE.Group();
    crank.position.copy(B);
    blk(0.04, 0.36, 0.04, metal, 0.11, -0.18, 0, crank).position.y = 0;
    blk(0.04, 0.36, 0.04, metal, -0.11, -0.18, 0, crank).position.y = 0;
    const pedals = [mesh(PEDAL, ink, 0.17, -0.18, 0, crank, false), mesh(PEDAL, ink, -0.17, 0.18, 0, crank, false)];
    g.add(crank);
    const bike = { root, lean: g, wheels, crank, pedals, legs: [], spin: 0 };
    if (live) { root.userData.keep = true; }
    if (jersey) {
      const shirt = M(jersey), skin = M(C.skin), shorts = M(C.ink);
      const hip = V(0, 1.6, -0.36), sh = V(0, 2.18, 0.2);
      rod(hip, sh, 0.21, shirt, g);
      mesh(new THREE.SphereGeometry(0.21, 12, 10), shirt, sh.x, sh.y, sh.z, g);
      mesh(new THREE.SphereGeometry(0.22, 12, 10), shorts, hip.x, hip.y, hip.z, g);
      mesh(new THREE.SphereGeometry(0.19, 14, 12), skin, 0, 2.43, 0.36, g);
      const hel = mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmet, 0, 2.47, 0.33, g);
      hel.scale.set(1, 0.9, 1.15);
      for (const s of [-1, 1]) {
        rod(V(s * 0.2, 2.14, 0.2), V(s * 0.29, 1.54, 0.68), 0.065, shirt, g);
        const thigh = mesh(ROD, shorts, 0, 0, 0, g), shin = mesh(ROD, skin, 0, 0, 0, g);
        thigh.userData.keep = shin.userData.keep = true;
        bike.legs.push({ s, thigh, shin });
      }
    }
    if (live) {
      wheels.forEach((w) => (w.userData.keep = true));
      crank.userData.keep = true;
      root.userData.keep = false;
      mergeInto(g);
      root.userData.keep = true;
    }
    return bike;
  }
  // Wheels roll with the distance travelled; legs follow the pedals
  const _hip = new THREE.Vector3(), _foot = new THREE.Vector3(), _knee = new THREE.Vector3();
  function animateBike(b, dist, dt) {
    for (const w of b.wheels) w.rotation.x += dist / 0.69;
    b.spin += dist * 1.25;
    b.crank.rotation.x = b.spin;
    for (const p of b.pedals) p.rotation.x = -b.spin;
    for (const L of b.legs) {
      const a = b.spin + (L.s > 0 ? 0 : Math.PI);
      _hip.set(L.s * 0.13, 1.56, -0.34);
      _foot.set(L.s * 0.17, 0.44 - Math.cos(a) * 0.18, -0.12 + Math.sin(a) * 0.18);
      // two-bone leg, knee bends forward
      const d = _foot.distanceTo(_hip), l1 = 0.62, l2 = 0.6;
      const dd = Math.min(d, l1 + l2 - 0.01);
      const along = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
      const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
      const dy = (_foot.y - _hip.y) / d, dz = (_foot.z - _hip.z) / d;
      _knee.set((_hip.x + _foot.x) / 2, _hip.y + dy * along - dz * h, _hip.z + dz * along + dy * h);
      if (_knee.z < _hip.z + 0.05) _knee.set((_hip.x + _foot.x) / 2, _hip.y + dy * along + dz * h, _hip.z + dz * along - dy * h);
      setRod(L.thigh, _hip, _knee, 0.085);
      setRod(L.shin, _knee, _foot, 0.065);
    }
  }

  /* ---------- the town ---------- */
  const places = api.places;
  const buildings = [];
  const rects = [];   // solid footprints {x0, z0, x1, z1}
  const circles = []; // solid round things {x, z, r}
  const clickable = [];
  const animated = []; // (t, dt) => void

  function ground() {
    mesh(new THREE.PlaneGeometry(460, 460), C.grass, 0, 0, 0).rotation.x = -Math.PI / 2;
    // main street (east-west) and the avenue (north-south)
    blk(170, 0.06, 10, C.road, 0, 0, 0, scene, false);
    blk(10, 0.06, 146, C.road, 0, 0, -3, scene, false);
    for (const s of [-1, 1]) {
      blk(170, 0.12, 3, C.cream, 0, 0, s * 6.5, scene, false);
      blk(3, 0.12, 146, C.cream, s * 6.5, 0, -3, scene, false);
      blk(166, 0.075, 1.2, C.blue, 0, 0, s * 3.9, scene, false);     // bike lanes
      blk(1.2, 0.075, 140, C.blue, s * 3.9, 0, -3, scene, false);
    }
    // centre dashes
    const dash = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.03, 0.25), M("#ffffff"), 80);
    let n = 0;
    const m4 = new THREE.Matrix4();
    for (let x = -78; x <= 78; x += 5) if (Math.abs(x) > 14) { m4.makeTranslation(x, 0.08, 0); dash.setMatrixAt(n++, m4); }
    for (let z = -70; z <= 66; z += 5) if (Math.abs(z) > 14) { m4.makeRotationY(Math.PI / 2).setPosition(0, 0.08, z); dash.setMatrixAt(n++, m4); }
    dash.count = n;
    scene.add(dash);
    // plaza
    const plaza = mesh(new THREE.CircleGeometry(13, 48), C.cream, 0, 0.14, 0, scene, false);
    plaza.rotation.x = -Math.PI / 2;
    const ring = mesh(new THREE.RingGeometry(9.2, 10.2, 48), C.blue, 0, 0.15, 0, scene, false);
    ring.rotation.x = -Math.PI / 2;
    // fountain with a giant bike on top
    cyl(4, 4.2, 0.9, C.white, 0, 0.12, 0);
    const water = mesh(new THREE.CircleGeometry(3.6, 32), new THREE.MeshLambertMaterial({ color: "#6bb3e0", emissive: "#2a5f86", emissiveIntensity: 0.4 }), 0, 0.95, 0, scene, false);
    extraMats.push(water.material);
    water.rotation.x = -Math.PI / 2;
    cyl(1.1, 1.4, 2.4, C.white, 0, 0.9, 0);
    const statue = makeBike(C.blue, null, C.blue, true);
    statue.root.scale.setScalar(2.1);
    statue.root.position.set(0, 3.3, 0);
    scene.add(statue.root);
    animated.push((t, dt) => { statue.root.rotation.y += dt * (calm ? 0.05 : 0.25); animateBike(statue, dt * (calm ? 0.1 : 0.6), dt); });
    circles.push({ x: 0, z: 0, r: 4.4 });
    // crosswalks
    for (const [x, z, rot] of [[0, -14.5, 0], [0, 14.5, 0], [-14.5, 0, 1], [14.5, 0, 1]]) {
      for (let i = -3; i <= 3; i++) {
        const s = blk(rot ? 0.6 : 1.1, 0.03, rot ? 1.1 : 0.6, "#ffffff", x + (rot ? 0 : i * 1.35), 0.07, z + (rot ? i * 1.35 : 0), scene, false);
        if (rot) s.scale.set(1, 1, 1);
      }
    }
    // beach, bay and pier
    blk(320, 0.1, 12, C.sand, 0, 0, SEA_Z - 6, scene, false);
    const sea = mesh(new THREE.PlaneGeometry(460, 200), new THREE.MeshLambertMaterial({ color: C.sea, emissive: "#174f7a", emissiveIntensity: 0.25 }), 0, 0.02, SEA_Z + 100, scene, false);
    extraMats.push(sea.material);
    sea.rotation.x = -Math.PI / 2;
    blk(PIER_X * 2, 0.35, 22, C.wood, 0, 0.05, SEA_Z + 9, scene);
    for (let z = SEA_Z + 1; z <= SEA_Z + 19; z += 4.5) for (const s of [-1, 1]) cyl(0.25, 0.25, 1.6, "#6d4c33", s * (PIER_X - 0.2), -1.2, z);
    // bancas (outrigger boats) bobbing in the bay
    for (const [x, z, c] of [[-26, SEA_Z + 22, C.blue], [34, SEA_Z + 30, "#d64545"], [-60, SEA_Z + 40, C.gold]]) {
      const b = new THREE.Group();
      blk(1.6, 0.8, 7, c, 0, 0, 0, b); blk(1.2, 0.12, 6, C.white, 0, 0.8, 0, b);
      for (const s of [-1, 1]) { blk(0.2, 0.2, 6, C.white, s * 3, 0.1, 0, b); for (const zz of [-1.6, 1.6]) rod(V(0, 0.8, zz), V(s * 3, 0.25, zz), 0.07, M(C.white), b); }
      b.position.set(x, 0, z); b.rotation.y = x * 0.03;
      b.userData.keep = true;
      scene.add(b);
      animated.push((t) => { b.position.y = Math.sin(t * 1.3 + x) * 0.12; b.rotation.z = Math.sin(t + x) * 0.04; });
    }
    // hills to the north
    for (const [x, z, r, h, c] of [[-70, -118, 34, 30, "#7fae6b"], [-20, -130, 40, 38, "#8bb874"], [40, -122, 36, 32, "#79a865"], [92, -112, 30, 26, "#86b46f"], [10, -150, 50, 60, "#93ad9b"]]) {
      const hill = mesh(new THREE.ConeGeometry(r, h, 10), c, x, h / 2 - 1, z, scene, false);
      hill.receiveShadow = false;
    }
  }

  const freeSpot = (x, z) => Math.abs(x) > 9.5 && Math.abs(z) > 9.5 && z < SEA_Z - 13 && !solidAt(x, z, 1.6) && x * x + z * z > 300;
  function tree(x, z, s = 1) {
    if (!freeSpot(x, z)) return;
    cyl(0.25 * s, 0.35 * s, 2.2 * s, "#7a5a3c", x, 0, z, scene, 7);
    mesh(new THREE.IcosahedronGeometry(1.7 * s, 0), ["#5e9e4f", "#6aa857", "#538f47"][Math.floor(Math.abs(x * z)) % 3], x, 3.2 * s, z);
    circles.push({ x, z, r: 0.8 * s });
  }
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    let top = V(0, 0, 0);
    for (let i = 0; i < 4; i++) { const next = V(Math.sin(i * 0.5) * 0.4 * s, (i + 1) * 1.6 * s, i * 0.18 * s); rod(top, next, 0.22 * s - i * 0.02, M("#9c7a52"), g); top = next; }
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(new THREE.ConeGeometry(0.5 * s, 3.4 * s, 4), "#4e9a46", top.x, top.y, top.z, g);
      leaf.rotation.set(Math.PI / 2 - 0.5, (i / 6) * Math.PI * 2, 0, "YXZ");
      leaf.translateY(1.5 * s);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    circles.push({ x, z, r: 0.7 });
  }
  function lamps() {
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 5, 6), M(C.ink), 80);
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshLambertMaterial({ color: "#fff6d8", emissive: "#ffe9a8", emissiveIntensity: 0.8 }), 80);
    extraMats.push(bulb.material);
    const m4 = new THREE.Matrix4();
    let n = 0;
    const add = (x, z) => { m4.makeTranslation(x, 2.5, z); pole.setMatrixAt(n, m4); m4.makeTranslation(x, 5.1, z); bulb.setMatrixAt(n, m4); n++; };
    for (let x = -76; x <= 76; x += 16) if (Math.abs(x) > 16) for (const s of [-1, 1]) add(x, s * 7.6);
    for (let z = -64; z <= 64; z += 16) if (Math.abs(z) > 16) for (const s of [-1, 1]) add(s * 7.6, z);
    pole.count = bulb.count = n;
    pole.castShadow = !lowEnd;
    scene.add(pole, bulb);
  }

  /* ---------- shops ---------- */
  const W = 12, D = 10; // standard lot: 12 wide along the street, 10 deep
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  extraMats.push(hitMat);
  // Main street lots: north side faces south (+z), south side faces north
  const mainLots = [];
  for (const x of [22, 38, 54, 70]) for (const sx of [-1, 1]) for (const sz of [-1, 1]) mainLots.push({ x: sx * x, z: sz * 14, ry: sz < 0 ? 0 : Math.PI });
  const aveLots = (sz) => { const out = []; for (const z of [28, 44, 60]) for (const sx of [-1, 1]) out.push({ x: sx * 14, z: sz * z, ry: sx < 0 ? Math.PI / 2 : -Math.PI / 2 }); return out; };
  const lots = { main: mainLots, brands: aveLots(-1), parts: aveLots(1) };
  const spare = [];

  function assign() {
    const pending = [];
    for (const p of places) {
      if (p.group === "landmark-east") placeAt(p, { x: 92, z: 0, ry: -Math.PI / 2 }, 16, 10);
      else if (p.group === "landmark-west") placeAt(p, { x: -92, z: 0, ry: Math.PI / 2 }, 12, 12);
      else { const lot = (lots[p.group] || lots.main).shift(); if (lot) placeAt(p, lot); else pending.push(p); }
    }
    for (const k of ["main", "parts", "brands"]) spare.push(...lots[k]);
    for (const p of pending) { const lot = spare.shift(); if (lot) placeAt(p, lot); }
  }

  function placeAt(place, lot, w = W, d = D) {
    const g = new THREE.Group();
    g.position.set(lot.x, 0, lot.z);
    g.rotation.y = lot.ry;
    scene.add(g);
    const doorMat = new THREE.MeshLambertMaterial({ color: "#2b3542", emissive: place.color, emissiveIntensity: 0 });
    extraMats.push(doorMat);
    const info = { place, group: g, x: lot.x, z: lot.z, ry: lot.ry, w, d, doorMat, height: 8 };
    STYLES[place.style] ? STYLES[place.style](g, place, info) : STYLES.shop(g, place, info);
    // footprint (rotations are multiples of 90°)
    const side = Math.abs(Math.sin(lot.ry)) > 0.5;
    const hw = (side ? d : w) / 2, hd = (side ? w : d) / 2;
    rects.push({ x0: lot.x - hw, x1: lot.x + hw, z0: lot.z - hd, z1: lot.z + hd });
    const front = V(Math.sin(lot.ry), 0, Math.cos(lot.ry));
    info.front = front;
    info.door = V(lot.x, 0, lot.z).addScaledVector(front, d / 2 + 2.6);
    info.anchor = V(lot.x, info.height + 2.2, lot.z);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 1, info.height + 1, hd * 2 + 1), hitMat);
    hit.position.set(lot.x, (info.height + 1) / 2, lot.z);
    hit.userData = { keep: true, building: info };
    scene.add(hit);
    clickable.push(hit);
    buildings.push(info);
  }

  // Shared parts of a shop front (local +z is the street side)
  function doorway(g, info, z) {
    blk(3, 3.9, 0.3, C.white, 0, 0, z, g);
    mesh(new THREE.BoxGeometry(2.3, 3.3, 0.34), info.doorMat, 0, 1.65, z + 0.02, g);
    blk(3.4, 0.18, 1.2, "#cfcac0", 0, 0, z + 0.6, g, false);
  }
  function windowsRow(g, w, y, z, color = "#cfe3f4") {
    for (const x of [-w / 2 + 2, w / 2 - 2]) { blk(2.2, 1.7, 0.2, C.white, x, y - 0.1, z, g); blk(1.8, 1.4, 0.24, color, x, y, z, g); }
  }
  function fronting(g, place, info, { z = info.d / 2, signY = 5.6, signW = info.w * 0.8, awning = true, bikes = true } = {}) {
    doorway(g, info, z);
    windowsRow(g, info.w, 1.4, z);
    board(place.sign || place.name, { bg: place.color }, signW, 1.5, g, 0, signY, z + 0.2);
    if (awning) { const a = blk(info.w * 0.62, 0.22, 1.8, place.color, 0, 4.15, z + 0.8, g); a.rotation.x = 0.3; }
    if (bikes) displayBikes(g, place, info, z);
  }
  function roofSign(g, place, info, y) {
    board(place.sign || place.name, { bg: place.color, sub: place.count || "" }, Math.min(info.w * 0.95, 11), 2.6, g, 0, y + 1.9, 0, 0, true);
    for (const x of [-3, 3]) cyl(0.08, 0.08, 1.6, C.ink, x, y, 0, g, 6);
    info.height = Math.max(info.height, y + 3.3);
  }
  const BIKE_COLORS = ["#3c78c6", "#d64545", "#1c2126", "#e8742a", "#2a9d8f", "#eeebe3"];
  function displayBikes(g, place, info, z) {
    const cols = (place.colors && place.colors.length ? place.colors : [place.color, BIKE_COLORS[hashStr(place.id) % BIKE_COLORS.length]]);
    [-1, 1].forEach((s, i) => {
      const b = makeBike(cols[i % cols.length]);
      b.root.position.set(s * (info.w / 2 - 1.7), 0, z + 2.2);
      b.root.rotation.y = s * Math.PI / 2;
      g.add(b.root);
    });
  }
  function gable(g, w, d, rise, color, y) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2 - 0.6, 0); s.lineTo(d / 2 + 0.6, 0); s.lineTo(0, rise); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: w + 1, bevelEnabled: false });
    geo.translate(0, 0, -(w + 1) / 2);
    const m = mesh(geo, color, 0, y, 0, g);
    m.rotation.y = Math.PI / 2;
    return m;
  }

  const STYLES = {
    shop(g, p, info) { blk(info.w, 6.6, info.d, C.cream, 0, 0, 0, g); blk(info.w + 0.6, 0.5, info.d + 0.6, p.color, 0, 6.6, 0, g); fronting(g, p, info); roofSign(g, p, info, 7.1); },
    velodrome(g, p, info) {
      cyl(5.6, 5.8, 6.4, C.cream, 0, 0, -0.4, g, 28);
      const bank = mesh(new THREE.CylinderGeometry(6.3, 5.6, 1.4, 28, 1, true), new THREE.MeshLambertMaterial({ color: p.color, side: THREE.DoubleSide }), 0, 6.9, -0.4, g);
      extraMats.push(bank.material);
      mesh(new THREE.TorusGeometry(6.2, 0.22, 6, 32), C.white, 0, 7.6, -0.4, g).rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; blk(0.4, 6.4, 0.4, C.white, Math.sin(a) * 5.75, 0, -0.4 + Math.cos(a) * 5.75, g); }
      fronting(g, p, info, { z: 5.3, signY: 5.2, signW: 8 });
      roofSign(g, p, info, 7.4);
    },
    lodge(g, p, info) {
      blk(info.w, 5.4, info.d, "#c79a6b", 0, 0, 0, g);
      for (let y = 0.6; y < 5.4; y += 0.9) blk(info.w + 0.1, 0.12, info.d + 0.1, "#a87a52", 0, y, 0, g, false);
      gable(g, info.w, info.d, 3.4, p.color, 5.4);
      blk(1.2, 3, 1.2, "#8a8178", info.w / 2 - 2, 6.3, -1.5, g);
      fronting(g, p, info, { signY: 4.6, signW: 7, awning: false });
      roofSign(g, p, info, 8.8);
    },
    basecamp(g, p, info) {
      mesh(new THREE.ConeGeometry(6, 10, 7), "#7f9a74", -info.w / 2 + 2, 5, -info.d / 2 + 1, g);
      mesh(new THREE.ConeGeometry(2.2, 2.6, 7), C.white, -info.w / 2 + 2, 8.75, -info.d / 2 + 1, g);
      blk(info.w, 5.6, info.d, "#d9cfbf", 0, 0, 0, g);
      gable(g, info.w, info.d, 4.4, p.color, 5.6);
      fronting(g, p, info, { signY: 4.7, signW: 7.5 });
      roofSign(g, p, info, 10);
    },
    station(g, p, info) {
      blk(info.w, 6, info.d, C.cream, 0, 0, 0, g);
      blk(info.w + 2, 0.4, info.d + 1, p.color, 0, 6, 0, g);
      blk(3, 6.5, 3, p.color, info.w / 2 - 1.5, 6.4, -info.d / 2 + 1.5, g);
      const clock = mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.2, 24), C.white, info.w / 2 - 1.5, 10.6, -info.d / 2 + 3.05, g);
      clock.rotation.x = Math.PI / 2;
      const hand = blk(0.12, 0.9, 0.1, C.ink, info.w / 2 - 1.5, 10.6, -info.d / 2 + 3.2, g, false);
      hand.userData.keep = true;
      animated.push((t) => { hand.rotation.z = -t * 0.4; });
      const canopy = blk(info.w * 0.8, 0.25, 2.6, C.ink, 0, 4.1, info.d / 2 + 1.2, g);
      canopy.castShadow = true;
      fronting(g, p, info, { awning: false, signY: 5.15 });
      roofSign(g, p, info, 6.4);
      info.height = 13;
    },
    power(g, p, info) {
      blk(info.w, 6.2, info.d, "#f2f0ea", 0, 0, 0, g);
      blk(info.w + 0.6, 0.4, info.d + 0.6, C.ink, 0, 6.2, 0, g);
      for (let i = -1; i <= 1; i++) { const s = blk(3.2, 0.12, 4.4, "#26457a", i * 3.6, 6.9, -1.6, g); s.rotation.x = 0.35; }
      const glow = blk(info.w + 0.1, 0.35, info.d + 0.1, new THREE.MeshLambertMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.8 }), 0, 5.4, 0, g, false);
      extraMats.push(glow.material);
      animated.push((t) => { glow.material.emissiveIntensity = 0.55 + Math.sin(t * 3) * 0.3; });
      const bolt = new THREE.Shape();
      bolt.moveTo(0.2, 1.6); bolt.lineTo(-0.7, -0.1); bolt.lineTo(0, -0.1); bolt.lineTo(-0.3, -1.6); bolt.lineTo(0.8, 0.3); bolt.lineTo(0.05, 0.3); bolt.closePath();
      const bm = mesh(new THREE.ExtrudeGeometry(bolt, { depth: 0.3, bevelEnabled: false }), new THREE.MeshLambertMaterial({ color: C.gold, emissive: "#b8860b", emissiveIntensity: 0.6 }), -info.w / 2 + 1.6, 4.4, info.d / 2 + 0.1, g);
      extraMats.push(bm.material);
      fronting(g, p, info, { signY: 5.6, signW: 7.6 });
      roofSign(g, p, info, 7.4);
    },
    kiosk(g, p, info) {
      cyl(3.6, 3.8, 4.6, C.cream, 0, 0, 0, g, 16);
      mesh(new THREE.ConeGeometry(4.6, 2.8, 16), p.color, 0, 6, 0, g);
      fronting(g, p, info, { z: 3.4, signY: 3.9, signW: 5.5, awning: false });
      roofSign(g, p, info, 7.4);
    },
    barn(g, p, info) { blk(info.w, 5.2, info.d, "#b5523b", 0, 0, 0, g); gable(g, info.w, info.d, 3.6, C.white, 5.2); fronting(g, p, info, { signY: 4.5, signW: 7 }); roofSign(g, p, info, 8.8); },
    workshop(g, p, info) {
      blk(info.w, 6.2, info.d, "#8f969c", 0, 0, 0, g);
      for (let i = -1; i <= 1; i++) { const r = blk(info.w / 3, 0.3, info.d * 0.9, p.color === C.ink ? "#3a4048" : p.color, i * (info.w / 3), 6.8, 0, g); r.rotation.z = 0.42; }
      const door = blk(5.4, 4, 0.3, stripes("#e9c46a", C.ink, 10), 0, 0, info.d / 2 + 0.05, g);
      door.material.map.center.set(0.5, 0.5);
      door.material.map.rotation = Math.PI / 2;
      const gear = new THREE.Group();
      mesh(new THREE.CylinderGeometry(1, 1, 0.3, 16), C.gold, 0, 0, 0, gear).rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) { const tooth = blk(0.4, 0.5, 0.3, C.gold, 0, 0, 0, gear); tooth.position.set(Math.sin(i * Math.PI / 4) * 1.15, Math.cos(i * Math.PI / 4) * 1.15, 0); tooth.rotation.z = -i * Math.PI / 4; }
      gear.position.set(-info.w / 2 + 1.6, 5.1, info.d / 2 + 0.3);
      gear.userData.keep = true;
      g.add(gear);
      animated.push((t, dt) => { gear.rotation.z -= dt * 0.8; });
      board(p.sign || p.name, { bg: C.ink }, 6.4, 1.2, g, 1.4, 5.1, info.d / 2 + 0.2);
      displayBikes(g, p, info, info.d / 2);
      roofSign(g, p, info, 7.6);
    },
    tires(g, p, info) {
      blk(info.w, 6, info.d, C.cream, 0, 0, 0, g);
      blk(info.w + 0.6, 0.4, info.d + 0.6, C.ink, 0, 6, 0, g);
      const tyre = mesh(new THREE.TorusGeometry(2.6, 0.95, 12, 32), "#2a2e33", 0, 9.4, -1, g);
      tyre.userData.keep = true;
      mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 32), "#c3c7cc", 0, 9.4, -1, g);
      animated.push((t, dt) => { tyre.rotation.z -= dt * 0.6; });
      for (const [x, z] of [[-info.w / 2 - 1.3, info.d / 2 - 1], [info.w / 2 + 1.3, info.d / 2 - 1]]) for (let i = 0; i < 3; i++) mesh(new THREE.TorusGeometry(0.75, 0.32, 8, 18), "#2a2e33", x, 0.3 + i * 0.62, z, g).rotation.x = Math.PI / 2;
      fronting(g, p, info, { bikes: false, signY: 5.1 });
      info.height = 12;
      roofSign(g, p, info, 12.4);
    },
    gear(g, p, info) {
      blk(info.w, 6, info.d, C.cream, 0, 0, 0, g);
      blk(info.w + 0.6, 0.4, info.d + 0.6, p.color, 0, 6, 0, g);
      const helmet = mesh(new THREE.SphereGeometry(2.6, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), p.color, 0, 6.4, -1, g);
      helmet.scale.set(1, 0.9, 1.3);
      for (const x of [-0.8, 0, 0.8]) blk(0.35, 0.3, 4.8, C.ink, x, 8.5, -1, g, false);
      fronting(g, p, info, { signY: 5.1 });
      roofSign(g, p, info, 9.4);
    },
    frames(g, p, info) {
      blk(info.w, 6, info.d, "#f2f0ea", 0, 0, 0, g);
      blk(info.w + 0.6, 0.4, info.d + 0.6, p.color, 0, 6, 0, g);
      const f = new THREE.Group(), m = M(p.color);
      rod(V(0, 0, 0), V(0, 2.4, -0.9), 0.18, m, f); rod(V(0, 2.4, -0.9), V(0, 2.3, 1.9), 0.17, m, f); rod(V(0, 0, 0), V(0, 1.7, 2.2), 0.2, m, f);
      rod(V(0, 1.7, 2.2), V(0, 2.3, 1.9), 0.2, m, f); rod(V(0, 0, 0), V(0, 0.2, -2.2), 0.12, m, f); rod(V(0, 0.2, -2.2), V(0, 2.4, -0.9), 0.11, m, f);
      f.position.set(0, 7.2, -1); f.rotation.y = Math.PI / 2;
      f.userData.keep = true;
      g.add(f);
      animated.push((t, dt) => { f.rotation.y += dt * 0.4; });
      fronting(g, p, info, { signY: 5.1 });
      roofSign(g, p, info, 10.4);
    },
    showroom(g, p, info) {
      blk(info.w, 0.3, info.d, "#dcd8cf", 0, 0, 0, g);
      const glass = new THREE.MeshLambertMaterial({ color: C.glass, transparent: true, opacity: 0.38, depthWrite: false });
      extraMats.push(glass);
      blk(info.w - 0.4, 6.2, info.d - 0.4, glass, 0, 0.3, 0, g, false).renderOrder = 2;
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) blk(0.45, 6.6, 0.45, C.white, x * (info.w / 2 - 0.25), 0, z * (info.d / 2 - 0.25), g);
      blk(info.w + 0.4, 0.5, info.d + 0.4, C.ink, 0, 6.5, 0, g);
      blk(info.w - 1.6, 0.12, info.d - 1.6, "#f2f0ea", 0, 7, 0, g, false);
      blk(info.w * 0.6, 0.5, 3, "#f2f0ea", 0, 0.3, -0.5, g);
      const cols = p.colors && p.colors.length ? p.colors : BIKE_COLORS;
      [-1.8, 1.8].forEach((x, i) => { const b = makeBike(cols[i % cols.length]); b.root.position.set(x, 0.8, -0.5); b.root.rotation.y = i ? 0.5 : -0.5; g.add(b.root); });
      doorway(g, info, info.d / 2 - 0.1);
      board(p.sign || p.name, { bg: C.ink, border: C.white }, info.w * 0.85, 1.6, g, 0, 5.3, info.d / 2 + 0.3);
      roofSign(g, { ...p, color: C.ink }, info, 7.2);
    },
    market(g, p, info) {
      blk(info.w * 0.8, 1.2, 3.2, C.wood, 0, 0, 1, g);
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(0.15, 0.15, 4.6, C.wood, x * (info.w * 0.4), 0, 1 + z * 1.8, g, 6);
      const awn = blk(info.w * 0.9, 0.25, 5, stripes("#d64545", "#fff8ec", 12), 0, 4.6, 1, g);
      awn.rotation.x = 0.12;
      blk(info.w, 4.4, 3.4, C.cream, 0, 0, -info.d / 2 + 1.7, g);
      for (let i = 0; i < 5; i++) { blk(1.2, 0.8, 1, "#b8895a", -4 + i * 2, 1.2, 0.9, g); mesh(new THREE.SphereGeometry(0.28, 8, 6), ["#e9c46a", "#d64545", "#e8742a", "#6aa857", "#e9c46a"][i], -4 + i * 2, 2.25, 0.9, g); }
      board(p.sign || "SALE", { bg: "#d64545" }, 6, 1.6, g, 0, 5.9, 3.3);
      doorway(g, info, -info.d / 2 + 3.5);
      info.height = 6;
      roofSign(g, p, info, 6.4);
    },
    bank(g, p, info) {
      blk(info.w, 0.7, info.d + 1, "#d9d4c8", 0, 0, 0, g);
      blk(info.w - 1, 6, info.d - 2, C.cream, 0, 0.7, -0.8, g);
      for (let i = 0; i < 4; i++) cyl(0.42, 0.48, 5.4, C.white, -4.2 + i * 2.8, 0.7, info.d / 2 - 0.6, g, 12);
      blk(info.w, 0.6, info.d + 1, C.white, 0, 6.1, 0, g);
      gable(g, info.w, info.d + 1, 2.2, p.color, 6.7);
      const coin = mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.25, 28).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: C.gold, emissive: "#8a6a10", emissiveIntensity: 0.5 }), 0, 9.9, 0, g);
      extraMats.push(coin.material);
      coin.userData.keep = true;
      animated.push((t, dt) => { coin.rotation.y += dt * 1.5; });
      doorway(g, info, info.d / 2 - 2);
      board(p.sign || p.name, { bg: p.color }, 7.2, 1.2, g, 0, 6.4, info.d / 2 + 0.55);
      info.height = 11.5;
    },
    post(g, p, info) {
      blk(info.w, 6, info.d, p.color, 0, 0, 0, g);
      blk(info.w + 0.2, 0.6, info.d + 0.2, C.white, 0, 4.8, 0, g, false);
      blk(info.w + 0.6, 0.4, info.d + 0.6, C.ink, 0, 6, 0, g);
      const box = new THREE.Group();
      blk(1.1, 1.6, 0.9, C.blue, 0, 0.6, 0, box); cyl(0.55, 0.55, 1.1, C.blue, 0, 2.2, 0, box).rotation.z = Math.PI / 2;
      cyl(0.08, 0.08, 0.6, C.ink, 0, 0, 0, box);
      box.position.set(info.w / 2 + 1, 0, info.d / 2 + 1.4);
      g.add(box);
      cyl(0.1, 0.1, 5, C.white, -info.w / 2 + 0.6, 6.4, 0, g, 6);
      const flag = blk(2, 1.2, 0.05, p.color, -info.w / 2 + 1.6, 10.2, 0, g, false);
      flag.userData.keep = true;
      animated.push((t) => { flag.rotation.y = Math.sin(t * 3) * 0.25; });
      fronting(g, p, info, { signY: 5.4, bikes: false, awning: false });
      info.height = 10;
    },
    fit(g, p, info) {
      blk(info.w, 6, info.d, "#f2f0ea", 0, 0, 0, g);
      blk(info.w + 0.6, 0.4, info.d + 0.6, p.color, 0, 6, 0, g);
      const c = document.createElement("canvas"); c.width = 64; c.height = 512;
      const x = c.getContext("2d"); x.fillStyle = C.gold; x.fillRect(0, 0, 64, 512); x.fillStyle = C.ink;
      for (let i = 0; i < 512; i += 16) x.fillRect(0, i, i % 64 ? 22 : 44, 3);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; textures.push(tex);
      const rm = new THREE.MeshLambertMaterial({ map: tex }); extraMats.push(rm);
      blk(0.9, 9, 0.3, rm, info.w / 2 - 0.9, 0, info.d / 2 + 0.3, g);
      fronting(g, p, info, { signY: 5.1, signW: 8 });
      roofSign(g, p, info, 6.4);
    },
    club(g, p, info) {
      blk(8, 16, 8, p.color, 0, 0, 0, g);
      for (let y = 2; y < 15; y += 3) blk(8.2, 0.3, 8.2, C.white, 0, y, 0, g, false);
      blk(9, 0.6, 9, C.ink, 0, 16, 0, g);
      const trophy = new THREE.Group(), gold = new THREE.MeshLambertMaterial({ color: C.gold, emissive: "#8a6a10", emissiveIntensity: 0.45 });
      extraMats.push(gold);
      cyl(0.9, 1.2, 0.6, gold, 0, 0, 0, trophy); cyl(0.25, 0.25, 1.2, gold, 0, 0.6, 0, trophy); cyl(1.4, 0.6, 1.8, gold, 0, 1.8, 0, trophy);
      for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.5, 0.12, 6, 14), gold, s * 1.35, 2.8, 0, trophy);
      trophy.position.y = 16.6;
      trophy.userData.keep = true;
      g.add(trophy);
      animated.push((t, dt) => { trophy.rotation.y += dt * 0.6; });
      doorway(g, info, 4.05);
      board(p.sign || p.name, { bg: C.ink }, 7, 1.4, g, 0, 5.2, 4.25);
      info.w = 8; info.d = 8; info.height = 21;
    },
    ferris(g, p, info) {
      const wheel = new THREE.Group();
      wheel.position.set(0, 10.5, -1);
      const rim = M(p.color), white = M(C.white);
      mesh(new THREE.TorusGeometry(7.5, 0.25, 8, 48), rim, 0, 0, 0, wheel);
      mesh(new THREE.TorusGeometry(7.5, 0.2, 8, 48), white, 0, 0, 0.9, wheel);
      mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12), C.ink, 0, 0, 0.45, wheel).rotation.x = Math.PI / 2;
      const cabins = [];
      const cols = ["#3c78c6", "#d64545", "#e9c46a", "#2a9d8f", "#e8742a", "#7b5ea7", "#3f8a5a", "#eeebe3"];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        rod(V(0, 0, 0.45), V(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0.45), 0.08, white, wheel);
        const cab = new THREE.Group();
        blk(1.6, 1.3, 1.4, cols[i], 0, -1.5, 0, cab);
        blk(1.8, 0.2, 1.6, C.white, 0, -0.25, 0, cab);
        cab.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0.45);
        wheel.add(cab); cabins.push(cab);
      }
      for (const s of [-1, 1]) for (const zz of [-1.6, 1.6]) rod(V(s * 4.5, 0, -1 + zz), V(0, 10.5, -1 + zz * 0.3), 0.22, M(C.ink), g);
      wheel.userData.keep = true;
      g.add(wheel);
      animated.push((t, dt) => { wheel.rotation.z += dt * (calm ? 0.03 : 0.15); for (const c of cabins) c.rotation.z = -wheel.rotation.z; });
      blk(5, 3.2, 3, C.cream, 0, 0, 3.6, g);
      blk(5.6, 0.4, 3.6, p.color, 0, 3.2, 3.6, g);
      doorway(g, info, 5.15);
      board(p.sign || "DAILY SPIN", { bg: p.color }, 5, 1.1, g, 0, 4.2, 5.4);
      info.height = 19;
    }
  };

  function decorate() {
    // trees behind the shops, palms on the beach and around the plaza
    const r = seeded(7);
    for (let x = -84; x <= 84; x += 8.5) for (const s of [-1, 1]) tree(x + r() * 2, s * (24 + r() * 7), 0.9 + r() * 0.4);
    for (let z = -70; z <= 62; z += 9) for (const s of [-1, 1]) tree(s * (26 + r() * 6), z + r() * 3, 0.9 + r() * 0.3);
    for (let i = 0; i < 40; i++) tree(-96 + r() * 192, -80 + r() * 18, 1 + r() * 0.5);
    for (let x = -96; x <= 96; x += 11) if (Math.abs(x) > 8) palm(x + r() * 3, SEA_Z - 4 - r() * 4, 0.9 + r() * 0.3);
    for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) palm(x, z, 0.85);
    lamps();
    // clouds
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) mesh(new THREE.IcosahedronGeometry(3 + r() * 3, 1), "#ffffff", k * 4 - 6, r() * 2, r() * 3, c, false);
      c.position.set(-150 + i * 38 + r() * 20, 42 + r() * 14, -90 + r() * 120);
      c.userData.keep = true;
      scene.add(c);
      animated.push((t, dt) => { c.position.x += dt * 1.6; if (c.position.x > 190) c.position.x = -190; });
    }
  }

  /* ---------- people riding around ---------- */
  const npcs = [];
  function addNPCs() {
    const loops = [
      [[16, 2.6], [78, 2.6], [78, -2.6], [16, -2.6]],
      [[-16, -2.6], [-78, -2.6], [-78, 2.6], [-16, 2.6]],
      [[2.6, -16], [2.6, -68], [-2.6, -68], [-2.6, -16]],
      [[-2.6, 16], [-2.6, 66], [2.6, 66], [2.6, 16]],
      ...[0, 1].map((k) => Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2 * (k ? -1 : 1) + k; return [Math.cos(a) * 7.4, Math.sin(a) * 7.4]; }))
    ];
    const jerseys = ["#d64545", "#2a9d8f", "#e9c46a", "#7b5ea7", "#e8742a", "#3f8a5a"];
    loops.forEach((pts, i) => {
      const b = makeBike(BIKE_COLORS[(i + 2) % BIKE_COLORS.length], jerseys[i % jerseys.length], [C.white, C.ink, "#d64545"][i % 3], true);
      scene.add(b.root);
      npcs.push({ b, pts: pts.map(([x, z]) => V(x, 0, z)), i: 0, pos: V(pts[0][0], 0, pts[0][1]), speed: 6 + (i % 3) * 1.5 });
    });
  }
  function updateNPCs(dt) {
    for (const n of npcs) {
      const target = n.pts[(n.i + 1) % n.pts.length];
      const dx = target.x - n.pos.x, dz = target.z - n.pos.z, d = Math.hypot(dx, dz);
      const step = Math.min(d, n.speed * dt);
      if (d < 0.3) { n.i = (n.i + 1) % n.pts.length; continue; }
      n.pos.x += (dx / d) * step; n.pos.z += (dz / d) * step;
      const want = Math.atan2(dx, dz);
      n.b.root.rotation.y += angDiff(n.b.root.rotation.y, want) * Math.min(1, dt * 6);
      n.b.root.position.copy(n.pos);
      animateBike(n.b, step, dt);
    }
  }

  /* ---------- you ---------- */
  const me = makeBike(C.blue, C.blue, C.ink, true);
  scene.add(me.root);
  const blob = mesh(new THREE.CircleGeometry(1.4, 20), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.18, depthWrite: false }), 0, 0.2, 0, scene, false);
  extraMats.push(blob.material);
  blob.userData.keep = true;
  blob.visible = lowEnd;
  blob.rotation.x = -Math.PI / 2;
  blob.scale.set(0.7, 1.4, 1);
  const P = { pos: V(0, 0, 11), vel: V(0, 0, 0), heading: Math.PI, lean: 0 };

  /* ---------- coins (XP) ---------- */
  const COINS_PER_DAY = 20;
  const coins = [];
  const st = api.state;
  if (st.coinDay !== api.today) { st.coinDay = api.today; st.coins = []; api.save(); }
  function addCoins() {
    const r = seeded(hashStr(api.today));
    const geo = new THREE.CylinderGeometry(0.6, 0.6, 0.14, 24).rotateX(Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: C.gold, emissive: "#a67c00", emissiveIntensity: 0.55 });
    extraMats.push(mat);
    for (let i = 0; i < COINS_PER_DAY; i++) {
      let x, z;
      const kind = i % 3;
      if (kind === 0) { x = (r() < 0.5 ? -1 : 1) * (16 + r() * 60); z = (r() - 0.5) * 6; }
      else if (kind === 1) { z = (r() < 0.5 ? -1 : 1) * (16 + r() * 50); x = (r() - 0.5) * 6; }
      else { const a = r() * Math.PI * 2, d = 6 + r() * 4; x = Math.cos(a) * d; z = Math.sin(a) * d; }
      const m = mesh(geo, mat, x, 1.3, z, scene, false);
      m.userData.keep = true;
      m.visible = !st.coins.includes(i);
      coins.push({ m, i, x, z });
    }
  }

  /* ---------- walking grid and routes (tap to ride) ---------- */
  const CELL = 2, COLS = Math.ceil((BX * 2) / CELL), ROWS = Math.ceil((BZ1 - BZ0) / CELL);
  let blocked;
  const cellOf = (x, z) => [clamp(Math.floor((x + BX) / CELL), 0, COLS - 1), clamp(Math.floor((z - BZ0) / CELL), 0, ROWS - 1)];
  const cellCenter = (c, r) => V(-BX + (c + 0.5) * CELL, 0, BZ0 + (r + 0.5) * CELL);
  const solidAt = (x, z, pad = 1.1) => {
    if (z > SEA_Z - 1 && Math.abs(x) > PIER_X - 0.6) return true;
    for (const b of rects) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return true;
    for (const c of circles) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2) return true;
    return false;
  };
  function buildGrid() {
    blocked = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = cellCenter(c, r); blocked[r * COLS + c] = solidAt(p.x, p.z) ? 1 : 0; }
  }
  function nearestOpen(c, r) {
    for (let rad = 0; rad < 12; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc >= 0 && rr >= 0 && cc < COLS && rr < ROWS && !blocked[rr * COLS + cc]) return [cc, rr];
    }
    return [c, r];
  }
  function clearLine(a, b) {
    const d = a.distanceTo(b), n = Math.ceil(d / 0.8);
    for (let i = 1; i < n; i++) { const t = i / n; if (solidAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.9)) return false; }
    return true;
  }
  function findPath(from, to) {
    if (clearLine(from, to)) return [to.clone()];
    const [sc, sr] = nearestOpen(...cellOf(from.x, from.z)), [gc, gr] = nearestOpen(...cellOf(to.x, to.z));
    const N = COLS * ROWS, start = sr * COLS + sc, goal = gr * COLS + gc;
    const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = [];
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    const h = (i) => { const dc = Math.abs((i % COLS) - gc), dr = Math.abs(Math.floor(i / COLS) - gr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr); };
    gs[start] = 0; push(start, h(start));
    let found = false;
    while (heap.length) {
      const i = pop();
      if (i === goal) { found = true; break; }
      if (closed[i]) continue;
      closed[i] = 1;
      const c = i % COLS, r = Math.floor(i / COLS);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        const j = rr * COLS + cc;
        if (blocked[j] || closed[j]) continue;
        if (dr && dc && (blocked[r * COLS + cc] || blocked[rr * COLS + c])) continue;
        const g2 = gs[i] + (dr && dc ? 1.414 : 1);
        if (g2 < gs[j]) { gs[j] = g2; came[j] = i; push(j, g2 + h(j)); }
      }
    }
    if (!found) return [to.clone()];
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(cellCenter(i % COLS, Math.floor(i / COLS)));
    cells.reverse();
    cells.push(to.clone());
    // keep only the corners you can't see past
    const out = [];
    let anchor = from.clone();
    for (let k = 1; k < cells.length; k++) if (!clearLine(anchor, cells[k])) { out.push(cells[k - 1]); anchor = cells[k - 1]; }
    out.push(cells[cells.length - 1]);
    return out;
  }

  /* ---------- screen: labels, prompt, map, sheets ---------- */
  const labelsEl = document.createElement("div");
  labelsEl.className = "town-labels";
  stage.appendChild(labelsEl);
  const prompt = q(".town-prompt"), passEl = q("[data-town-pass]"), coinEl = q("[data-town-coins]");
  const joy = q(".town-joy"), knob = joy && joy.querySelector("span");
  const mapCanvas = document.createElement("canvas");
  mapCanvas.className = "town-map";
  mapCanvas.setAttribute("aria-hidden", "true");
  stage.appendChild(mapCanvas);
  const sheetWrap = document.createElement("div");
  sheetWrap.className = "town-sheet-wrap";
  sheetWrap.hidden = true;
  sheetWrap.innerHTML = `<div class="town-sheet" role="dialog" aria-modal="true" aria-labelledby="townSheetTitle"></div>`;
  stage.appendChild(sheetWrap);
  const sheet = sheetWrap.firstElementChild;

  function hud() {
    const total = places.length, got = places.filter((p) => st.stamps.includes(p.id)).length;
    if (passEl) passEl.textContent = `${got}/${total}`;
    if (coinEl) coinEl.textContent = `${st.coins.length}/${COINS_PER_DAY}`;
  }

  function makeLabels() {
    for (const b of buildings) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "town-label";
      el.style.setProperty("--c", b.place.color);
      el.innerHTML = `<span aria-hidden="true">${b.place.icon}</span><b>${escHTML(b.place.name)}</b>${b.place.count ? `<small>${escHTML(b.place.count)}</small>` : ""}`;
      el.setAttribute("aria-label", `Ride to ${b.place.name}`);
      el.addEventListener("click", () => rideTo(b, true));
      labelsEl.appendChild(el);
      b.label = el;
    }
  }
  const _v = new THREE.Vector3();
  function placeLabels(w, h) {
    for (const b of buildings) {
      _v.copy(b.anchor).project(camera);
      const dist = camera.position.distanceTo(b.anchor);
      const hide = _v.z > 1 || _v.x < -1.2 || _v.x > 1.2 || _v.y < -1.2 || _v.y > 1.3 || dist > 150;
      if (hide) { if (!b.label.hidden) b.label.hidden = true; continue; }
      b.label.hidden = false;
      const s = clamp(46 / dist, 0.55, 1.05);
      b.label.style.transform = `translate3d(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px, 0) translate(-50%, -100%) scale(${s.toFixed(3)})`;
      b.label.style.opacity = dist > 110 ? String(clamp((150 - dist) / 40, 0, 1)) : "";
      b.label.style.zIndex = String(1000 - Math.round(dist));
    }
  }

  // Mini map: roads, shops, you
  let mapBase = null;
  const MAP_W = 168, MAP_H = 140;
  const mapX = (x) => ((x + BX) / (BX * 2)) * MAP_W, mapZ = (z) => ((z - BZ0) / (BZ1 - BZ0)) * MAP_H;
  function drawMapBase() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    mapCanvas.width = MAP_W * dpr; mapCanvas.height = MAP_H * dpr;
    mapBase = document.createElement("canvas");
    mapBase.width = mapCanvas.width; mapBase.height = mapCanvas.height;
    const x = mapBase.getContext("2d");
    x.scale(dpr, dpr);
    x.fillStyle = C.grass; x.fillRect(0, 0, MAP_W, MAP_H);
    x.fillStyle = C.sea; x.fillRect(0, mapZ(SEA_Z), MAP_W, MAP_H);
    x.fillStyle = C.sand; x.fillRect(0, mapZ(SEA_Z - 12), MAP_W, mapZ(SEA_Z) - mapZ(SEA_Z - 12));
    x.fillStyle = C.road; x.fillRect(mapX(-85), mapZ(-5), mapX(85) - mapX(-85), mapZ(5) - mapZ(-5)); x.fillRect(mapX(-5), mapZ(-76), mapX(5) - mapX(-5), mapZ(SEA_Z + 18) - mapZ(-76));
    x.fillStyle = C.cream; x.beginPath(); x.arc(mapX(0), mapZ(0), (13 / (BX * 2)) * MAP_W, 0, Math.PI * 2); x.fill();
    for (const b of buildings) { const r = rects[buildings.indexOf(b)]; x.fillStyle = b.place.color; x.fillRect(mapX(r.x0), mapZ(r.z0), mapX(r.x1) - mapX(r.x0), mapZ(r.z1) - mapZ(r.z0)); }
  }
  function drawMap() {
    const x = mapCanvas.getContext("2d");
    const dpr = mapCanvas.width / MAP_W;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(mapBase, 0, 0);
    x.scale(dpr, dpr);
    x.fillStyle = "#ffffff"; x.strokeStyle = C.ink; x.lineWidth = 2;
    x.save(); x.translate(mapX(P.pos.x), mapZ(P.pos.z)); x.rotate(-P.heading + Math.PI);
    x.beginPath(); x.moveTo(0, -6); x.lineTo(4.5, 4.5); x.lineTo(0, 2.2); x.lineTo(-4.5, 4.5); x.closePath(); x.fill(); x.stroke();
    x.restore();
  }

  let sheetPlace = null, sheetOpener = null;
  function openSheet({ color = C.blue, kicker = "", title, intro = "", body = "", foot = "" }) {
    sheetOpener = document.activeElement;
    sheet.style.setProperty("--c", color);
    sheet.innerHTML = `<header class="town-sheet-head"><button class="icon-btn town-close" type="button" aria-label="Close">${api.icon("close")}</button>
        ${kicker ? `<p class="town-kicker">${kicker}</p>` : ""}<h2 id="townSheetTitle">${escHTML(title)}</h2>${intro ? `<p>${intro}</p>` : ""}</header>
      <div class="town-sheet-body">${body}</div>${foot ? `<footer class="town-sheet-foot">${foot}</footer>` : ""}`;
    sheetWrap.hidden = false;
    keys.clear();
    sheet.querySelector(".town-close").addEventListener("click", closeSheet);
    setTimeout(() => sheet.querySelector(".town-close").focus({ preventScroll: true }), 30);
  }
  function closeSheet() {
    if (sheetWrap.hidden) return;
    sheetWrap.hidden = true;
    sheet.innerHTML = "";
    sheetPlace = null;
    if (sheetOpener && sheetOpener.isConnected && stage.contains(sheetOpener)) sheetOpener.focus({ preventScroll: true });
  }
  const link = (path, label, cls = "btn btn-ghost") => `<a class="${cls}" href="${api.url(path)}">${escHTML(label)}</a>`;

  function enter(b) {
    const p = b.place;
    sheetPlace = p;
    const fresh = api.stamp(p.id, p.name);
    hud();
    const stampNote = fresh ? `<span class="town-stamp">🏷️ Town Pass stamp collected</span>` : "";
    if (p.kind === "spin") { closeSheet(); api.openSpin(); return; }
    if (p.kind === "shop") return shopSheet(p, stampNote);
    if (p.kind === "bank") return bankSheet(p, stampNote);
    if (p.kind === "fit") return fitSheet(p, stampNote);
    if (p.kind === "post") return postSheet(p, stampNote);
    if (p.kind === "club") return clubSheet(p, stampNote);
  }
  function shopSheet(p, note, max = null, showAll = false) {
    const all = p.items.filter((x) => max == null || x.price <= max);
    const list = showAll ? all : all.slice(0, 12);
    const bands = api.bands(p.items).filter((b) => p.items.some((x) => x.price <= b));
    openSheet({
      color: p.color, kicker: `${p.icon} ${escHTML(p.count || "")}`, title: p.name, intro: `${escHTML(p.blurb || "")} ${note}`,
      body: `${bands.length ? `<div class="chip-list town-chips"><button class="chip ${max == null ? "on" : ""}" data-max="">Any price</button>${bands.map((b) => `<button class="chip ${max === b ? "on" : ""}" data-max="${b}">Up to ${api.pesoK(b)}</button>`).join("")}</div>` : ""}
        <div class="product-grid town-grid">${list.map((x) => api.card(x)).join("") || `<p class="muted">Nothing up to that price here yet.</p>`}</div>
        ${!showAll && all.length > list.length ? `<p class="town-more"><button class="btn btn-ghost" data-all>Show all ${all.length}</button></p>` : ""}`,
      foot: p.href ? link(p.href, `Open the ${p.hrefLabel || p.name}`, "text-link") : ""
    });
    sheet.querySelectorAll("[data-max]").forEach((el) => el.addEventListener("click", () => shopSheet(p, "", el.dataset.max ? +el.dataset.max : null)));
    const more = sheet.querySelector("[data-all]");
    if (more) more.addEventListener("click", () => shopSheet(p, "", max, true));
  }
  function bankSheet(p, note, budget = null) {
    const quick = api.finderQuick;
    const pick = budget == null ? [] : api.bikesUpTo(budget).slice(0, 6);
    openSheet({
      color: p.color, kicker: "💰 Bike Finder", title: p.name,
      intro: `Tell the teller your budget and we'll show the best-equipped bikes for it. ${note}`,
      body: `<div class="chip-list town-chips">${quick.map((b) => `<button class="chip ${budget === b ? "on" : ""}" data-budget="${b}">${api.pesoK(b)}</button>`).join("")}</div>
        ${budget == null ? `<p class="muted">Pick a budget to see your bikes.</p>` : pick.length ? `<div class="product-grid town-grid">${pick.map((x) => api.card(x)).join("")}</div>` : `<p class="muted">No bikes up to ${api.peso(budget)} yet. Try a higher budget.</p>`}`,
      foot: `${link(api.finderPath + (budget ? `?max=${budget}` : ""), "Open the full Bike Finder", "text-link")}`
    });
    sheet.querySelectorAll("[data-budget]").forEach((el) => el.addEventListener("click", () => bankSheet(p, "", +el.dataset.budget)));
  }
  function fitSheet(p, note) {
    openSheet({
      color: p.color, kicker: "📏 Sizing", title: p.name, intro: `Enter your height and we'll tell you your frame size. ${note}`,
      body: `<form class="town-fit"><label for="townHeight">Your height</label><div><input id="townHeight" type="number" inputmode="numeric" min="120" max="220" placeholder="cm"> <span>cm</span> <button class="btn btn-brand" type="submit">Find my size</button></div><p class="town-fit-out" aria-live="polite"></p></form>`,
      foot: link(p.href, "Read the full bike size guide", "text-link")
    });
    sheet.querySelector(".town-fit").addEventListener("submit", (e) => {
      e.preventDefault();
      const cm = +sheet.querySelector("#townHeight").value;
      const z = api.sizeFor(cm);
      sheet.querySelector(".town-fit-out").innerHTML = !cm ? "Enter your height in centimetres." : z ? `You're most likely a <b>size ${z.s}</b> (riders ${z.min}–${z.max} cm). Every bike's page also suggests a size for your height.` : "That's outside our usual size chart. Ask us in the chat and we'll help you choose.";
    });
  }
  function postSheet(p, note) {
    const c = api.cart();
    openSheet({
      color: p.color, kicker: "📮 Ordering", title: p.name, intro: `${escHTML(p.blurb)} ${note}`,
      body: `<div class="town-post"><p><b>${c.count ? `${c.count} item${c.count === 1 ? "" : "s"} in your cart · ${api.peso(c.total)}` : "Your cart is empty."}</b></p>
        <ol class="steps-list"><li>Add bikes, parts and gear to your cart.</li><li>Tap <b>Send order request</b> in your cart.</li><li>A sales rep confirms stock, size, price and delivery by chat.</li><li>Pay once it's confirmed. No online payment needed.</li></ol>
        <p>${c.count ? `<button class="btn btn-brand" data-open-cart>Open my cart</button>` : `<button class="btn btn-brand" data-close>Keep shopping</button>`}</p></div>`,
      foot: link(p.href, "How ordering works", "text-link")
    });
    const oc = sheet.querySelector("[data-open-cart]");
    if (oc) oc.addEventListener("click", () => { closeSheet(); api.openCart(); });
    const cl = sheet.querySelector("[data-close]");
    if (cl) cl.addEventListener("click", closeSheet);
  }
  function clubSheet(p, note) {
    const L = api.level();
    openSheet({
      color: p.color, kicker: "🏆 Rider Club", title: p.name, intro: `${escHTML(p.blurb)} ${note}`,
      body: `<div class="town-club"><p class="town-level">${L.icon} <b>${escHTML(L.name)}</b> · ${L.xp} XP${L.next ? ` · ${L.toNext} XP to ${escHTML(L.next.name)}` : ""}</p>
        <div class="meter"><span style="width:${L.pct}%"></span></div>
        <h3>Town Pass</h3><p class="muted">Visit every shop for a stamp (+5 XP each) and the Town Explorer badge. Coins on the streets are worth 2 XP each, ${COINS_PER_DAY} a day.</p>
        <ul class="town-pass">${places.map((x) => `<li class="${st.stamps.includes(x.id) ? "got" : ""}" style="--c:${x.color}"><span aria-hidden="true">${x.icon}</span>${escHTML(x.name)}${st.stamps.includes(x.id) ? '<b aria-label="stamped">✓</b>' : ""}</li>`).join("")}</ul></div>`,
      foot: link(p.href, "See all badges and rewards", "text-link")
    });
  }
  function placesSheet() {
    openSheet({
      color: C.ink, kicker: "🗺️ Bike Town", title: "Places", intro: "Pick a shop and we'll ride you there.",
      body: `<ul class="town-places-list">${buildings.map((b, i) => `<li><button type="button" data-go="${i}" style="--c:${b.place.color}"><span aria-hidden="true">${b.place.icon}</span><b>${escHTML(b.place.name)}</b><small>${escHTML(b.place.count || b.place.blurb || "")}</small>${st.stamps.includes(b.place.id) ? '<em aria-label="visited">✓</em>' : ""}</button></li>`).join("")}</ul>`
    });
    sheet.querySelectorAll("[data-go]").forEach((el) => el.addEventListener("click", () => { closeSheet(); rideTo(buildings[+el.dataset.go], true); }));
  }
  function helpSheet(first = false) {
    const touch = matchMedia("(pointer: coarse)").matches;
    openSheet({
      color: C.blue, kicker: "🚲 Welcome", title: first ? "Welcome to Bike Town" : "How to ride",
      intro: "Every building is a shop. Ride up to a door to go in.",
      body: `<ul class="steps-list town-help">
        <li>${touch ? "<b>Tap</b> anywhere to ride there, or tap a shop's sign. Use the <b>joystick</b> to steer yourself." : "<b>Arrow keys or WASD</b> to ride, <b>Enter</b> to go into a shop. Or <b>click</b> anywhere, or a shop's sign, to ride there."}</li>
        <li><b>Places</b> lists every shop; the map in the corner shows where you are.</li>
        ${api.rewards !== false ? `<li>Collect a <b>Town Pass stamp</b> in every shop and grab the <b>gold coins</b> for Rider Club XP.</li>
        <li>Spin the <b>Ferris wheel</b> once a day for discount codes. Your cart works everywhere in town.</li>` : `<li>Your cart works everywhere in town; send your order from the <b>Post Office</b>.</li>`}</ul>`,
      foot: `<button class="btn btn-brand" type="button" data-start>Start riding</button>`
    });
    sheet.querySelector("[data-start]").addEventListener("click", closeSheet);
    if (first) { st.welcomed = true; api.save(); }
  }

  /* ---------- input ---------- */
  const keys = new Set();
  const KEYMAP = { ArrowUp: "u", KeyW: "u", ArrowDown: "d", KeyS: "d", ArrowLeft: "l", KeyA: "l", ArrowRight: "r", KeyD: "r" };
  let route = [], routeTarget = null, inView = true, near = null;
  const joyV = { x: 0, y: 0, on: false };
  const editable = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  on(window, "keydown", (e) => {
    if (dead || editable(e.target) || api.modalOpen()) return;
    if (e.defaultPrevented) return;
    if (!sheetWrap.hidden) { if (e.key === "Escape" && !modalAtKeydown) { e.preventDefault(); closeSheet(); } return; }
    if (!inView) return;
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); route = []; routeTarget = null; e.preventDefault(); return; }
    if ((e.key === "Enter" || e.code === "KeyE") && near && !(e.target.closest && e.target.closest("button, a"))) { e.preventDefault(); enter(near); }
  });
  // Checked before the shop's own key handlers run, so Escape on the cart closes only the cart
  let modalAtKeydown = false;
  on(window, "keydown", () => { modalAtKeydown = api.modalOpen(); }, true);
  on(window, "keyup", (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
  on(window, "blur", () => keys.clear());
  const io = new IntersectionObserver(([en]) => { inView = en.intersectionRatio > 0.45; if (!inView) keys.clear(); }, { threshold: [0, 0.45, 1] });
  io.observe(stage);
  cleanups.push(() => io.disconnect());

  if (joy) {
    const move = (e) => {
      const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
      let x = (e.clientX - cx) / R, y = (e.clientY - cy) / R;
      const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      joyV.x = x; joyV.y = y;
      if (knob) knob.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
    };
    on(joy, "pointerdown", (e) => { joyV.on = true; route = []; routeTarget = null; joy.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
    on(joy, "pointermove", (e) => { if (joyV.on) move(e); });
    const stop = () => { joyV.on = false; joyV.x = joyV.y = 0; if (knob) knob.style.transform = ""; };
    on(joy, "pointerup", stop); on(joy, "pointercancel", stop);
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(UP, 0);
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(clickable, false)[0];
    if (hit && hit.object.userData.building) return { building: hit.object.userData.building };
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(groundPlane, p) ? { point: p } : null;
  }
  let down = null, hover = null;
  on(canvas, "pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  on(canvas, "pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 12 || !quick || !sheetWrap.hidden) return;
    const hit = pick(e);
    if (!hit) return;
    if (hit.building) rideTo(hit.building, true);
    else rideToPoint(hit.point);
  });
  let lastHover = 0;
  on(canvas, "pointermove", (e) => {
    if (e.pointerType !== "mouse" || performance.now() - lastHover < 60) return;
    lastHover = performance.now();
    const hit = pick(e);
    const b = hit && hit.building;
    if (b !== hover) { if (hover) hover.label.classList.remove("hover"); hover = b || null; if (hover) hover.label.classList.add("hover"); canvas.style.cursor = hover ? "pointer" : ""; }
  });
  on(mapCanvas, "click", (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * BX * 2 - BX, z = ((e.clientY - r.top) / r.height) * (BZ1 - BZ0) + BZ0;
    const b = buildings.find((bb) => Math.hypot(bb.x - x, bb.z - z) < 8);
    b ? rideTo(b, true) : rideToPoint(V(x, 0, z));
  });

  function rideTo(b, enterOnArrival) {
    route = findPath(P.pos, b.door);
    routeTarget = { building: b, enter: enterOnArrival };
    if (P.pos.distanceTo(b.door) < 2.5 && enterOnArrival) { route = []; routeTarget = null; enter(b); }
  }
  function rideToPoint(p) {
    p.x = clamp(p.x, -BX + 2, BX - 2); p.z = clamp(p.z, BZ0 + 2, BZ1 - 2);
    if (solidAt(p.x, p.z, 0.6)) { const [c, r] = nearestOpen(...cellOf(p.x, p.z)); p.copy(cellCenter(c, r)); }
    route = findPath(P.pos, p);
    routeTarget = null;
    marker.position.set(p.x, 0.2, p.z);
    marker.visible = true;
  }
  const marker = mesh(new THREE.RingGeometry(0.6, 0.9, 24), new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.85 }), 0, 0.2, 0, scene, false);
  extraMats.push(marker.material);
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  marker.userData.keep = true;

  stage.querySelectorAll("[data-town]").forEach((el) => {
    const fn = { places: placesSheet, help: () => helpSheet(false), pass: () => { const club = buildings.find((b) => b.place.kind === "club"); club ? clubSheet(club.place, "") : placesSheet(); } }[el.dataset.town];
    if (fn) { el.addEventListener("click", fn); cleanups.push(() => el.removeEventListener("click", fn)); }
  });
  if (prompt) { const fn = () => near && enter(near); prompt.addEventListener("click", fn); cleanups.push(() => prompt.removeEventListener("click", fn)); }
  // "Ride there" buttons in the list under the town
  const rideBtns = document.querySelectorAll("[data-town-ride]");
  rideBtns.forEach((el) => {
    const fn = (e) => {
      const b = buildings.find((x) => x.place.id === el.dataset.townRide);
      if (!b) return;
      e.preventDefault();
      stage.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      rideTo(b, true);
    };
    el.addEventListener("click", fn);
    cleanups.push(() => el.removeEventListener("click", fn));
  });

  /* ---------- each frame ---------- */
  const MAX = 13;
  const camOffset = V(0, 34, 29);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let zoom = matchMedia("(max-width: 640px)").matches ? 1.2 : 1;
  stage.querySelectorAll("[data-zoom]").forEach((el) => {
    const fn = () => { zoom = clamp(zoom * (el.dataset.zoom === "in" ? 0.82 : 1.22), 0.55, 1.8); };
    el.addEventListener("click", fn);
    cleanups.push(() => el.removeEventListener("click", fn));
  });
  const want = new THREE.Vector3();
  function update(dt, t) {
    // where you want to go
    let ix = 0, iz = 0;
    if (keys.has("l")) ix -= 1; if (keys.has("r")) ix += 1; if (keys.has("u")) iz -= 1; if (keys.has("d")) iz += 1;
    if (joyV.on) { ix = joyV.x; iz = joyV.y; }
    want.set(0, 0, 0);
    if (ix || iz) {
      const l = Math.hypot(ix, iz);
      want.set(ix / Math.max(1, l), 0, iz / Math.max(1, l)).multiplyScalar(MAX);
      marker.visible = false;
    } else if (route.length) {
      const target = route[0];
      const dx = target.x - P.pos.x, dz = target.z - P.pos.z, d = Math.hypot(dx, dz);
      const last = route.length === 1;
      if (d < (last ? 0.7 : 1.6)) {
        route.shift();
        if (!route.length) {
          marker.visible = false;
          if (routeTarget && routeTarget.enter) { const b = routeTarget.building; routeTarget = null; P.heading = Math.atan2(-b.front.x, -b.front.z); enter(b); }
        }
      } else want.set(dx / d, 0, dz / d).multiplyScalar(last ? Math.min(MAX, 2.5 + d * 1.6) : MAX);
    }
    P.vel.x = damp(P.vel.x, want.x, want.lengthSq() ? 4 : 3, dt);
    P.vel.z = damp(P.vel.z, want.z, want.lengthSq() ? 4 : 3, dt);
    const before = P.pos.clone();
    P.pos.addScaledVector(P.vel, dt);
    collide(P.pos);
    const moved = P.pos.distanceTo(before);
    const speed = moved / Math.max(dt, 1e-4);
    if (speed > 0.4) {
      const h = Math.atan2(P.pos.x - before.x, P.pos.z - before.z);
      const turn = angDiff(P.heading, h);
      P.heading += turn * Math.min(1, dt * 9);
      P.lean = damp(P.lean, clamp(-turn * speed * 0.08, -0.45, 0.45), 6, dt);
    } else P.lean = damp(P.lean, 0, 6, dt);
    me.root.position.copy(P.pos);
    me.root.rotation.y = P.heading;
    me.lean.rotation.z = P.lean;
    animateBike(me, moved, dt);
    blob.position.set(P.pos.x, 0.2, P.pos.z);
    blob.rotation.z = -P.heading;

    // coins
    for (const c of coins) {
      if (!c.m.visible) continue;
      c.m.rotation.y += dt * 3;
      if (!calm) c.m.position.y = 1.3 + Math.sin(t * 3 + c.i) * 0.2;
      if ((c.x - P.pos.x) ** 2 + (c.z - P.pos.z) ** 2 < 2.6) {
        c.m.visible = false;
        st.coins.push(c.i);
        api.coin();
        hud();
        floatText("+2 XP", c);
      }
    }
    // the shop you're next to
    let best = null, bd = 4.6;
    for (const b of buildings) { const d = Math.hypot(b.door.x - P.pos.x, b.door.z - P.pos.z); if (d < bd) { bd = d; best = b; } }
    if (best !== near) {
      if (near) near.doorMat.emissiveIntensity = 0;
      near = best;
      if (prompt) {
        prompt.hidden = !near;
        if (near) prompt.innerHTML = `${near.place.icon} ${near.place.kind === "spin" ? "Spin the" : "Go into"} <b>${escHTML(near.place.name)}</b><kbd>Enter</kbd>`;
      }
      buildings.forEach((b) => b.label.classList.toggle("near", b === near));
    }
    if (near) near.doorMat.emissiveIntensity = 0.45 + Math.sin(t * 5) * 0.25;

    updateNPCs(dt);
    for (const f of animated) f(t, dt);
    if (marker.visible) marker.scale.setScalar(1 + Math.sin(t * 6) * 0.12);

    // camera follows you
    camLook.lerp(V(P.pos.x, 1.6, P.pos.z), 1 - Math.exp(-6 * dt));
    camPos.copy(camLook).addScaledVector(camOffset, zoom);
    camera.position.lerp(camPos, 1 - Math.exp(-5 * dt));
    camera.lookAt(camLook);
    sun.position.set(camLook.x + 26, 52, camLook.z + 30);
    sun.target.position.copy(camLook);
  }
  function collide(p) {
    for (const r of rects) {
      const x0 = r.x0 - 0.9, x1 = r.x1 + 0.9, z0 = r.z0 - 0.9, z1 = r.z1 + 0.9;
      if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
        const m = Math.min(p.x - x0, x1 - p.x, p.z - z0, z1 - p.z);
        if (m === p.x - x0) p.x = x0; else if (m === x1 - p.x) p.x = x1; else if (m === p.z - z0) p.z = z0; else p.z = z1;
      }
    }
    for (const c of circles) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), r = c.r + 0.8;
      if (d < r && d > 0.0001) { p.x = c.x + (dx / d) * r; p.z = c.z + (dz / d) * r; }
    }
    if (p.z > SEA_Z - 1.2 && Math.abs(p.x) > PIER_X - 0.6) p.z = SEA_Z - 1.2;
    if (p.z > SEA_Z - 1.2) p.x = clamp(p.x, -PIER_X + 0.6, PIER_X - 0.6);
    p.x = clamp(p.x, -BX, BX); p.z = clamp(p.z, BZ0, BZ1);
  }
  const floats = [];
  function floatText(text, at) {
    const el = document.createElement("span");
    el.className = "town-float";
    el.textContent = text;
    labelsEl.appendChild(el);
    floats.push({ el, pos: V(at.x, 2.4, at.z), t: 0 });
  }
  function updateFloats(dt, w, h) {
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt; f.pos.y += dt * 2;
      _v.copy(f.pos).project(camera);
      f.el.style.transform = `translate3d(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px, 0) translate(-50%, -50%)`;
      f.el.style.opacity = String(clamp(1.4 - f.t, 0, 1));
      if (f.t > 1.4) { f.el.remove(); floats.splice(i, 1); }
    }
  }

  let width = 0, height = 0;
  function resize() {
    const r = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 640 ? 52 : 45;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  cleanups.push(() => ro.disconnect());

  /* ---------- start ---------- */
  const clock = new THREE.Clock();
  let frame = 0;
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    update(dt, t);
    renderer.render(scene, camera);
    if (frame++ % 2 === 0) placeLabels(width, height);
    updateFloats(dt, width, height);
    if (frame % 3 === 0) drawMap();
  }
  const fontsReady = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('italic 800 40px "Inter"'), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  const timing = {};
  fontsReady.then(() => {
    if (dead) return;
    const t0 = performance.now();
    ground();
    assign();
    decorate();
    addNPCs();
    if (api.rewards !== false) addCoins();
    timing.scene = performance.now() - t0;
    mergeInto(scene);
    timing.merge = performance.now() - t0 - timing.scene;
    buildGrid();
    timing.total = performance.now() - t0;
    makeLabels();
    drawMapBase();
    hud();
    resize();
    camLook.set(P.pos.x, 1.6, P.pos.z);
    camera.position.copy(camLook).addScaledVector(camOffset, zoom);
    camera.lookAt(camLook);
    me.root.position.copy(P.pos);
    me.root.rotation.y = P.heading;
    clock.start();
    renderer.setAnimationLoop(tick);
    stage.classList.add("ready");
    if (loading) loading.hidden = true;
    if (!st.welcomed) helpSheet(true);
  }).catch((e) => {
    console.error(e);
    stage.classList.add("no-webgl");
    if (loading) loading.innerHTML = "<p>Bike Town couldn't start here, so here's every shop as a list below.</p>";
  });

  // For tests and support: where you are and what's around
  stage.__town = { timing, draws: () => renderer.info.render.calls, debug: () => buildings.slice(0, 3).map((b) => { const v = b.anchor.clone().project(camera); return { id: b.place.id, v: [v.x, v.y, v.z].map((n) => +n.toFixed(2)), dist: +camera.position.distanceTo(b.anchor).toFixed(1), cam: camera.position.toArray().map((n) => +n.toFixed(1)), w: width, h: height }; }), get pos() { return P.pos.clone(); }, get near() { return near && near.place.id; }, rideTo: (id) => { const b = buildings.find((x) => x.place.id === id); if (b) rideTo(b, true); }, buildings: () => buildings.map((b) => ({ id: b.place.id, x: b.x, z: b.z })) };

  return {
    destroy() {
      dead = true;
      renderer.setAnimationLoop(null);
      cleanups.forEach((f) => f());
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      mats.forEach((m) => m.dispose());
      extraMats.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      ROD.dispose(); WHEEL.dispose(); SPOKE.dispose(); PEDAL.dispose();
      renderer.dispose();
      canvas.remove(); labelsEl.remove(); mapCanvas.remove(); sheetWrap.remove();
      delete stage.__town;
    }
  };
}
