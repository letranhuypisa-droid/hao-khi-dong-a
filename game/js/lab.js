// lab.js — phòng thử hoạt ảnh (lab.html, chỉ dùng khi phát triển).
//   ?view=kit&kit=NG_DAO   một kiểu lính, mọi trạng thái
//   ?view=state&s=strike   mọi kiểu lính, một trạng thái
//   ?view=hero&m=N1        tướng: dải khung hình của một đòn
//   &play                  chạy thời gian thật thay vì khung đứng
// window.__lab.set(opts) đổi cảnh không cần tải lại (dùng khi chụp màn bằng script).

import * as THREE from "three";
import { kitGeometry, poseFor, jointMatrices, NCH, JOINT_NAMES } from "./battle/soldiers.js";
import { makeRig, PAL, lambert } from "./battle/models.js";
import * as A from "./battle/anim.js";
import { KITS } from "./data/tuning.js";
import { HERO_ANIM, HERO_MOVE_LIST } from "./battle/hero-anim.js";

const canvas = document.querySelector("canvas"), bar = document.querySelector(".bar");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a4a3a);
scene.add(new THREE.HemisphereLight(0xfff4dc, 0x5a5040, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(-6, 12, -8); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x6b7a4a }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500);

const STATES = {
  idle: { label: "đứng", a: {} },
  ready: { label: "thủ thế", a: { ready: true } },
  walk: { label: "đi", a: { spd: 1.8, walk: 0.9 }, anim: (a, t) => { a.walk = 0.9 + t * 5; } },
  run: { label: "chạy", a: { spd: 3.4, walk: 2.2, ready: true }, anim: (a, t) => { a.walk = 2.2 + t * 9; } },
  windup: { label: "báo trước", a: { ready: true, windup: 0.001 } },
  strike: { label: "đánh", a: { ready: true, atkT: 0.1 } },
  recover: { label: "hồi thế", a: { ready: true, atkT: 0.3 } },
  hit: { label: "trúng đòn", a: { state: "hit", st: 0.18 } },
  flinch: { label: "khựng", a: { ready: true, flinch: 0.15 } },
  launch: { label: "hất tung", a: { state: "launch", st: 0.2 } },
  down: { label: "nằm", a: { state: "down", st: 0.6 } },
  getup: { label: "dậy", a: { state: "down", st: 0.12 } },
  dead0: { label: "chết ngửa", a: { state: "dead", dieT: 1.2, id: 4 } },
  dead1: { label: "chết sấp", a: { state: "dead", dieT: 1.2, id: 5 } },
  dead2: { label: "quỵ gối", a: { state: "dead", dieT: 0.4, id: 6 } },
  dead2b: { label: "quỵ rồi đổ", a: { state: "dead", dieT: 1.2, id: 6 } },
  dead3: { label: "đổ nghiêng", a: { state: "dead", dieT: 1.2, id: 7 } },
};
// Chu kỳ đòn chạy liền: báo trước → đánh → hồi, lặp 2,2 s.
function attackCycle(a, K, t) {
  const T = K.windup, u = t % 2.2;
  a.ready = true;
  if (u < T) { a.windup = T - u; a.windupT = T; a.atkT = 9; }
  else { a.windup = 0; a.atkT = u - T; }
}

const params = new URLSearchParams(location.search);
let opts = { view: params.get("view") || "kit", kit: params.get("kit") || "NG_DAO", s: params.get("s") || "strike", m: params.get("m") || "N1",
  play: params.has("play"), only: params.get("only"), us: params.get("us"), kits: params.get("kits"), yaw: Number(params.get("yaw") ?? 0.6), t: Number(params.get("t") ?? 0) };

let items = [], labels = [];
const mats = lambert();
const meshCache = {};
function kitMeshes(kit) {
  if (meshCache[kit]) return meshCache[kit];
  const g = kitGeometry(kit), parts = {};
  for (const j of JOINT_NAMES) { const m = new THREE.InstancedMesh(g.parts[j], mats, 32); m.count = 0; m.frustumCulled = false; scene.add(m); parts[j] = m; }
  return (meshCache[kit] = { parts, skel: g.skel });
}

function build() {
  for (const it of items) if (it.rig) scene.remove(it.rig.root);
  for (const k in meshCache) for (const j of JOINT_NAMES) meshCache[k].parts[j].count = 0;
  labels.forEach((l) => l.remove()); labels = []; items = [];
  let list = [];
  if (opts.view === "kit") list = (opts.only ? opts.only.split(",") : Object.keys(STATES)).map((s) => ({ kit: opts.kit, s }));
  else if (opts.view === "state") list = (opts.kits ? opts.kits.split(",") : Object.keys(KITS)).map((k) => ({ kit: k, s: opts.s }));
  else if (opts.view === "cycle") list = Object.keys(KITS).map((k) => ({ kit: k, s: "cycle" }));
  else if (opts.view === "hero") {
    const us = opts.us ? String(opts.us).split(",").map(Number) : [0, 0.15, 0.3, 0.36, 0.42, 0.5, 0.62, 0.8];
    for (const u of us) list.push({ hero: true, m: opts.m, u });
  }
  const cols = opts.view === "hero" ? Math.min(4, list.length) : list.length > 12 ? 5 : list.length > 4 ? 4 : list.length;
  const sp = opts.view === "hero" ? 3.0 : 2.6;
  list.forEach((o, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const it = { ...o, x: -(c - (cols - 1) / 2) * sp, z: r * sp * 1.25 };
    if (o.hero) {
      it.rig = makeRig({ scale: 1.08, cloth: PAL.son, armor: PAL.then, trim: PAL.vang, hat: "tocbui", weapon: "songdao" });
      scene.add(it.rig.root); it.rig.root.position.set(it.x, 0, it.z); it.rig.root.rotation.y = Math.PI - opts.yaw;
      it.pose = A.idle(0);
    } else {
      const K = KITS[o.kit];
      it.K = K; it.pose = new Float32Array(NCH);
      it.a = { id: 1, state: "move", st: 0, windup: 0, windupT: K.windup, atkT: 9, spd: 0, walk: 0, ready: false, flinch: 0, hitFront: 1, dieT: 0, panicT: 0,
        ...(STATES[o.s]?.a || {}) };
      if (o.s === "windup") it.a.windup = 0.001;
    }
    const el = document.createElement("div"); el.className = "lbl";
    el.textContent = o.hero ? `${o.m} u=${o.u.toFixed(2)}` : `${KITS[o.kit].name} · ${STATES[o.s]?.label || o.s}`;
    document.body.appendChild(el); it.el = el; labels.push(el);
    items.push(it);
  });
  const rows = Math.ceil(list.length / cols);
  const w = cols * sp, d = rows * sp * 1.25;
  const aspect = innerWidth / innerHeight, hf = Math.tan(THREE.MathUtils.degToRad(16)) * aspect;
  const dist = Math.max((w / 2 + 0.6) / hf, d * 1.2) + d * 0.5;
  camera.position.set(0, dist * 0.42, -dist * 0.95 + d * 0.15);
  camera.lookAt(0, 0.4, d * 0.45 - sp * 0.4);
  drawBar();
}

function drawBar() {
  const b = (label, on, fn) => { const x = document.createElement("button"); x.textContent = label; if (on) x.className = "on"; x.onclick = fn; bar.appendChild(x); };
  bar.innerHTML = "";
  for (const k of Object.keys(KITS)) b(KITS[k].name, opts.view === "kit" && opts.kit === k, () => set({ view: "kit", kit: k }));
  b("chu kỳ đòn", opts.view === "cycle", () => set({ view: "cycle", play: true }));
  for (const s of ["strike", "windup", "hit", "dead2b"]) b(STATES[s].label, opts.view === "state" && opts.s === s, () => set({ view: "state", s }));
  for (const m of HERO_MOVE_LIST) b(m, opts.view === "hero" && opts.m === m, () => set({ view: "hero", m }));
  b(opts.play ? "dừng" : "chạy", opts.play, () => set({ play: !opts.play }));
}

function set(o) { opts = { ...opts, ...o }; build(); }
window.__lab = { set, get opts() { return opts; } };

const _v = new THREE.Vector3();
let t0 = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  render(opts.play ? (now - t0) / 1000 : opts.t);
}
function render(t) {
  const W = innerWidth, H = innerHeight;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  const counts = {};
  for (const it of items) {
    if (it.rig) {
      const HA = HERO_ANIM[it.m];
      const u = opts.play ? (t / 0.9 + it.u * 0) % 1 : it.u;
      A.applyPose(it.rig, HA ? HA(u) : A.idle(t));
      continue;
    }
    const a = it.a, K = it.K;
    if (it.s === "cycle") attackCycle(a, K, t);
    else if (opts.play && STATES[it.s]?.anim) STATES[it.s].anim(a, t);
    else if (opts.play && it.s === "strike") attackCycle(a, K, t);
    else if (opts.play && it.s.startsWith("dead")) { a.dieT = t % 2.5; }
    else if (opts.play && it.s === "hit") { a.st = 0.32 - (t % 0.8) * 0.4; if (a.st < 0) a.st = 0.001; }
    poseFor(a, it.kit, K, t, it.pose);
    const M = kitMeshes(it.kit), i = counts[it.kit] = (counts[it.kit] ?? -1) + 1;
    jointMatrices(M.skel, it.x, 0, it.z, Math.PI - opts.yaw, K.scale || 1, it.pose, (name, m) => M.parts[name].setMatrixAt(i, m));
  }
  for (const k in meshCache) for (const j of JOINT_NAMES) { const m = meshCache[k].parts[j]; m.count = (counts[k] ?? -1) + 1; m.instanceMatrix.needsUpdate = true; }
  renderer.render(scene, camera);
  for (const it of items) {
    _v.set(it.x, -0.25, it.z).project(camera);
    it.el.style.left = ((_v.x * 0.5 + 0.5) * W) + "px"; it.el.style.top = ((-_v.y * 0.5 + 0.5) * H) + "px";
  }
}
window.__lab.render = render;
build();
requestAnimationFrame(frame);
