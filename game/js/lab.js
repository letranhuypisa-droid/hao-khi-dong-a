// lab.js — phòng thử hoạt ảnh (lab.html, chỉ dùng khi phát triển).
//   ?view=kit&kit=NG_DAO   một kiểu lính, mọi trạng thái
//   ?view=state&s=strike   mọi kiểu lính, một trạng thái
//   ?view=hero&m=N1        tướng: dải khung hình của một đòn (m còn nhận idle, run, strafe, block, hit, dodge, down,
//                          blockwalk = bước khi đỡ, &dir=90 hướng đi theo độ: 0 trước, 90 phải, 180 lùi)
//   ?view=rigs&m=run&us=.3 tướng, sĩ quan, boss, tướng đồng minh cạnh nhau (&rigs=tuong,H33 để lọc); m như trên
//                          cộng sweep, heavy, roar, shoot, ult (Tuyệt Kỹ boss), broken (Vỡ Thế 3,5 s); nhiều u
//                          (&us=0,.25,.5) = mỗi rig một dải
//   &hero=H31              tướng H31 (rig RIGS.H31, bộ đòn WC01 anim-wc01.js) thay H35 ở view=hero; m nhận thêm hich, binhThu,
//                          ult; ở view=rigs thì H31 chỉ hiện khi ghi rõ (&rigs=H31) và dùng tư thế WC01
//   &play                  chạy thời gian thật thay vì khung đứng
//   &noglb                 không nạp mô hình GLB (glb.js): khối hình dựng bằng code như trước
//   &lod=1                 lính GLB: xem mức chi tiết 0 (gần, mặc định), 1, 2 (xa)
//   &cols=8&sp=1.8         số cột, khoảng cách hình (m): dải khung hình một hàng khi xem chu kỳ bước
// window.__lab.set(opts) đổi cảnh không cần tải lại (dùng khi chụp màn bằng script).

import * as THREE from "three";
import { kitGeometry, glbKit, poseFor, soldierFrame, cycleLen, affineToMatrix, NCH, NJ, JOINT_NAMES, BONE_FLOATS } from "./battle/soldiers.js";
import { makeRig, disposeRig, PAL, lambert } from "./battle/models.js";
import * as A from "./battle/anim.js";
import { KITS } from "./data/tuning.js";
import { HERO_ANIM, HERO_MOVE_LIST } from "./battle/hero-anim.js";
import { RIGS, useMeshy, kitOf } from "./battle/models.js";
import { soldierRigKey } from "./battle/soldier.js";
import { guardRigKey } from "./battle/guard.js";
import { GUARD_CLASSES } from "./data/guards.js";
import { RigMotion } from "./battle/rig-motion.js";
import { preloadModels, model } from "./battle/glb.js";
import { loadClips, sampleU as clipSampleU, clipDur, info as clipInfo } from "./battle/clips.js";
import { MOVES } from "./data/tuning.js";
import { ANIMS } from "./battle/hero-anim.js";
import * as W1 from "./battle/anim-wc01.js";
import { MOVES_WC01 } from "./data/moves-wc01.js";

if (new URLSearchParams(location.search).has("meshy")) useMeshy();      // &meshy: mọi mô hình Hunyuan3D về bản Meshy (tướng, sĩ quan, lính Tự do, cận vệ, lính đám đông) để so
// Lính Tự do (bậc 0, 2; song đao WC03) và cận vệ dựng RIGS lúc chạy (soldier.js, guard.js): đăng ký sẵn để &rigs=linh_WC03_0,linh_WC03_2,cv_khien,cv_giao… xem được; không nằm trong danh sách mặc định.
for (const r of [0, 2]) soldierRigKey("WC03", r);
for (const id of Object.keys(GUARD_CLASSES)) guardRigKey(id);
const DYN_RIG = /^(linh_|cv_)/;

// Tướng dùng lớp WC01 (đại kiếm): bảng đòn, tư thế ngoài đòn, thời lượng clip
const WC01_RIGS = { H31: 1, H31m: 1 };
const WC01_POSE = { idle: (u, t) => W1.idle(t), block: () => W1.block(), hit: (u) => W1.hitReact(u), dodge: (u) => W1.dodgeRoll(u), down: (u) => W1.knockdown(u) };
const WC01_DUR = { hich: 3, binhThu: 0.9, ult: 4.4 };

const canvas = document.querySelector("canvas"), bar = document.querySelector(".bar");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x3a4a3a);
scene.add(new THREE.HemisphereLight(0xfff4dc, 0x5a5040, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8); sun.position.set(-6, 12, -8); scene.add(sun);
// Mặt đất thử (?ground=flat|slope|bumps|ledge) để xem chân bám đất (ik.js). labGround(x, z) là hàm độ cao
// dùng chung cho mesh đất, gốc lính, gốc tướng — giống heightAt trong trận.
const GROUNDS = {
  flat: () => 0,
  slope: (x, z) => 0.3 * z - 0.12 * x,
  bumps: (x, z) => 0.28 * Math.sin(x * 1.7 + 0.4) * Math.cos(z * 1.3),
  // bậc đất cao 0,28 m chạy dọc ngay dưới tâm mỗi hình (chân trái, chân phải đứng hai mức khác nhau)
  ledge: (x) => 0.14 * Math.tanh(6 * Math.sin(Math.PI * (x / ledgeK.sp - ledgeK.off))),
};
const ledgeK = { sp: 2.6, off: 0 };
export let labGround = GROUNDS.flat;
const groundGeo = new THREE.PlaneGeometry(40, 40, 160, 160).toNonIndexed(); groundGeo.rotateX(-Math.PI / 2);
const groundBase = Float32Array.from(groundGeo.attributes.position.array);
const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ color: 0x6b7a4a, flatShading: true }));
scene.add(ground);
function shapeGround(kind) {
  labGround = GROUNDS[kind] || GROUNDS.flat;
  const a = groundGeo.attributes.position.array;
  for (let i = 0; i < a.length; i += 3) a[i + 1] = labGround(groundBase[i], groundBase[i + 2]);
  groundGeo.attributes.position.needsUpdate = true; groundGeo.computeVertexNormals();
}
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
  block: { label: "đỡ khiên", a: { ready: true, blockT: 0.16 } },
  evade: { label: "nhảy lùi", a: { ready: true, evadeT: 0.15 } },
  flee: { label: "tháo chạy", a: { fleeT: 2, spd: 3.6, walk: 1.2 }, anim: (a, t) => { a.walk = 1.2 + t * 10; } },
  charge: { label: "lao húc", a: { chargeT: 0.5, spd: 6, walk: 2, ready: true }, anim: (a, t) => { a.walk = 2 + t * 12; } },
  // đứng xoay 180° qua lại như lính quay mặt theo tướng (crowd: turn dt·8) — xem bước bù của turnFeet (&play)
  turn: { label: "xoay tại chỗ", a: { ready: true }, anim: (a, t) => {
    a.yaw0 ??= a.yaw; const u = t % 3.2;
    a.yaw = a.yaw0 + Math.PI * (u < 1.6 ? 1 - Math.exp(-8 * u) : Math.exp(-8 * (u - 1.6)));
  } },
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
  play: params.has("play"), only: params.get("only"), us: params.get("us"), kits: params.get("kits"), yaw: Number(params.get("yaw") ?? 0.6), t: Number(params.get("t") ?? 0),
  ground: params.get("ground") || "flat", cols: Number(params.get("cols")) || 0, sp: Number(params.get("sp")) || 0,
  dir: params.has("dir") ? Number(params.get("dir")) : 90, hero: params.get("hero") || null, lod: Number(params.get("lod") || 0),
  hb: Number(params.get("hb") ?? 1.2) };

let items = [], labels = [];
const mats = lambert();
const meshCache = {};
const _mc = new Float64Array(BONE_FLOATS), _m4 = new THREE.Matrix4();     // ma trận khớp một lính (affine 3 × 4)
function kitMeshes(kit) {
  if (meshCache[kit]) return meshCache[kit];
  const G = model("kit/" + (params.get("kitfile") || kitOf(kit)));          // &kitfile=DV_AOTONGh: xem tệp nướng chưa có trong game (kèm &kit=DV_NO cho bộ tư thế)
  if (G) { const S = glbKit(kit, G, 64); S.meshes.forEach((m) => scene.add(m)); return (meshCache[kit] = { glb: S, skel: S.skel }); }
  const g = kitGeometry(kit), parts = {};
  for (const j of JOINT_NAMES) { const m = new THREE.InstancedMesh(g.parts[j], mats, 32); m.count = 0; m.frustumCulled = false; scene.add(m); parts[j] = m; }
  return (meshCache[kit] = { parts, skel: g.skel });
}

function build() {
  for (const it of items) if (it.rig) disposeRig(it.rig);          // gỡ khỏi cảnh, giải phóng khung xương, vật liệu
  for (const k in meshCache) if (meshCache[k].glb) meshCache[k].glb.meshes.forEach((m) => (m.count = 0)); else for (const j of JOINT_NAMES) meshCache[k].parts[j].count = 0;
  labels.forEach((l) => l.remove()); labels = []; items = [];
  let list = [];
  if (opts.view === "kit") list = (opts.only ? opts.only.split(",") : Object.keys(STATES)).map((s) => ({ kit: opts.kit, s }));
  else if (opts.view === "state") list = (opts.kits ? opts.kits.split(",") : Object.keys(KITS)).map((k) => ({ kit: k, s: opts.s }));
  else if (opts.view === "cycle") list = Object.keys(KITS).map((k) => ({ kit: k, s: "cycle" }));
  else if (opts.view === "hero") {
    const us = opts.us ? String(opts.us).split(",").map(Number) : [0, 0.15, 0.3, 0.36, 0.42, 0.5, 0.62, 0.8];
    const key = opts.hero && RIGS[opts.hero] ? opts.hero : "hero";
    for (const u of us) list.push({ hero: true, key, m: opts.m, u });
  } else if (opts.view === "rigs") {
    const us = opts.us ? String(opts.us).split(",").map(Number) : [0.3];      // nhiều u: mỗi rig một dải khung
    for (const key of String(opts.rigs ?? params.get("rigs") ?? Object.keys(RIGS).filter((k) => !WC01_RIGS[k] && !DYN_RIG.test(k)).join(",")).split(","))
      if (RIGS[key]) for (const u of us) list.push({ hero: true, key, m: opts.m, u });
  }
  const rigView = opts.view === "hero" || opts.view === "rigs";
  const cols = opts.cols ? Math.min(opts.cols, list.length)
    : rigView ? Math.min(opts.view === "rigs" ? 6 : 4, list.length) : list.length > 12 ? 5 : list.length > 4 ? 4 : list.length;
  const sp = opts.sp || (rigView ? 3.0 : 2.6);
  ledgeK.sp = sp; ledgeK.off = (cols - 1) / 2; shapeGround(opts.ground);
  list.forEach((o, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const it = { ...o, x: -(c - (cols - 1) / 2) * sp, z: r * sp * 1.25 };
    if (o.hero) {
      it.rig = makeRig(RIGS[o.key]); it.motion = new RigMotion(it.rig); it.yaw = Math.PI - opts.yaw;
      scene.add(it.rig.root); it.rig.root.position.set(it.x, labGround(it.x, it.z), it.z); it.rig.root.rotation.y = it.yaw;
      it.pose = WC01_RIGS[o.key] ? W1.idle(0) : A.idle(0); it.phase = 0; it.dist = 0; it.settled = false;
    } else {
      const K = KITS[o.kit];
      it.K = K; it.pose = new Float32Array(NCH); it.settled = false;
      it.a = { id: 1, kit: o.kit, K, role: "lab", y: 0, yaw: Math.PI - opts.yaw, scale: K.scale || 1,
        state: "move", st: 0, windup: 0, windupT: K.windup, atkT: 9, spd: 0, walk: 0, ready: false, flinch: 0, hitFront: 1, dieT: 0, panicT: 0,
        blockT: 0, evadeT: 0, fleeT: 0, chargeT: 0,
        ...(STATES[o.s]?.a || {}) };
      if (o.s === "windup") it.a.windup = 0.001;
    }
    const el = document.createElement("div"); el.className = "lbl";
    el.textContent = o.hero ? `${o.key === "hero" ? "" : o.key + " · "}${o.m} u=${o.u.toFixed(2)}` : `${KITS[o.kit].name} · ${STATES[o.s]?.label || o.s}`;
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
  const heroMoves = opts.hero && WC01_RIGS[opts.hero] ? [...Object.keys(ANIMS.WC01), "idle", "run", "block", "blockwalk", "hit", "dodge", "down"] : HERO_MOVE_LIST;
  for (const m of heroMoves) b(m, opts.view === "hero" && opts.m === m, () => set({ view: "hero", m }));
  for (const m of ["idle", "run", "strafe", "blockwalk", "sweep", "heavy", "broken", "ult"]) b("tướng/sĩ quan: " + m, opts.view === "rigs" && opts.m === m, () => set({ view: "rigs", m }));
  for (const g of Object.keys(GROUNDS)) b("đất: " + g, opts.ground === g, () => set({ ground: g }));
  b(opts.play ? "dừng" : "chạy", opts.play, () => set({ play: !opts.play }));
}

function set(o) { opts = { ...opts, ...o }; build(); }
window.__lab = { set, get opts() { return opts; } };

// ---- rig khớp nối (tướng, sĩ quan, boss): tư thế theo m, trộn như trong trận, RigMotion trên labGround ----
const RIG_ANIM = {
  fall: (u) => A.downPose(u * 1.1, 1.1) ?? A.knockdown(u),                                   // hero bị đánh ngã: ngã, nằm, đứng dậy (hero.js state "down")
  idle: (u, t) => A.idle(t), block: () => A.block(), hit: (u) => A.hitReact(u), dodge: (u) => A.dodgeRoll(u), down: (u) => A.knockdown(u),
  sweep: (u) => A.sweep(u), heavy: (u, t, it) => A.heavyChop(u, 0.4, longWpn(it)), roar: (u) => A.roar(u), shoot: (u) => A.shoot(u),
  broken: (u, t, it) => A.stagger(u * 3.5, longWpn(it)),                                      // Vỡ Thế (BigUnit.broken)
  ult: (u) => (u < 0.45 ? A.heavyChop(u / 0.45 * 0.5, 0.9) : A.spin((u - 0.45) / 0.55, 2)),     // Tuyệt Kỹ Toa Đô
};
// m = "clip:tênClip": xem thẳng một clip đã nướng (clips.json) trên rig, tay lấy nguyên từ clip, cổ tay cộng &hb (mặc định 1,2: lưỡi nối dài cánh tay)
const labClip = (m) => (m.startsWith("clip:") ? m.slice(5) : null);
const clipLabPose = (name, u) => {
  const p = clipSampleU(name, u, A.zeroPose()), sword = !!clipInfo(name)?.sword;     // gươm hai tay: tay đã giải theo gươm (không cộng lệch cổ tay), tay trái nắm chuôi
  if (sword) p.grip = 1; else { p.handRx += opts.hb; p.handLx += opts.hb; }
  return p;
};
const rigDur = (m, it) => (labClip(m) ? clipDur(labClip(m)) : null) ?? (it && WC01_RIGS[it.key] ? MOVES_WC01[m]?.dur ?? WC01_DUR[m] : null)
  ?? MOVES[m]?.dur ?? (m === "ult" ? 1.9 : m === "dodge" ? 0.32 : m === "fall" ? 1.1 : m === "broken" ? 3.5 : 0.95);
const longWpn = (it) => ["giao", "dadao"].includes(RIGS[it.key].weapon);          // như BigUnit.longWeapon
window.__lab.camera = camera;          // kịch bản chụp màn đặt camera cận cảnh (bàn chân, vạt áo)
window.__lab.items = () => items;
const WALKS = { run: 1, strafe: 1, blockwalk: 1 };
const rigSpeed = (it) => (it.m === "strafe" ? 1.5 : it.m === "blockwalk" ? 2 : it.key === "hero" ? 6.75 : it.key === "H31" ? 6.0 : 4.2);
// Nhịp bước theo kiểu đi: chạy (gait), đi ngang thăm dò (strafeGait), bước khi đỡ (stepGait, như Hero.updateBlock).
const walkGait = (it, sp) => (it.m === "run" ? A.gait : it.m === "strafe" ? A.strafeGait : A.stepGait)(sp, it.rig.scale);
// Một bước mô phỏng (dt giây): đi/chạy thì dời root theo hướng đi (run: trước mặt, strafe: sang phải, blockwalk:
// hướng opts.dir độ, 0 = trước, 90 = phải), pha bước từ walkGait().
function rigStep(it, dt, u, t) {
  const root = it.rig.root, m = it.m;
  let target, k, px = it.x, pz = it.z;
  if (WALKS[m]) {
    const sp = rigSpeed(it), g = walkGait(it, sp);
    it.phase += dt * g.rate; it.dist += dt * sp;
    const dr = (opts.dir ?? 90) * Math.PI / 180, dx = m === "run" ? 0 : m === "strafe" ? 1 : Math.sin(dr), dz = m === "run" ? 1 : m === "strafe" ? 0 : Math.cos(dr);
    const wc01 = WC01_RIGS[it.key];
    if (m === "run") target = wc01 ? W1.run(it.phase, 1, g.stride) : A.run(it.phase, 1, g.stride);
    else if (m === "strafe") target = A.strafe(it.phase, 1, g.stride);
    else target = A.guardStep(wc01 ? W1.BLOCK : A.BLOCK, it.phase, dx, dz, g.stride);
    const wpn = RIGS[it.key].weapon;
    if (m === "run" && (wpn === "giao" || wpn === "dadao")) A.carryLong(target, it.phase);    // như BigUnit.moveToward
    k = m === "run" ? 0.35 : m === "blockwalk" ? 0.8 : 0.5;          // như Hero (chạy, đỡ), BigUnit (đi ngang)
    const off = opts.play ? (it.dist % 4) - 2 : it.dist;          // khung đứng: đi tới đúng ô của hình
    const cy = Math.cos(it.yaw), sy = Math.sin(it.yaw);
    px += (dx * cy + dz * sy) * off; pz += (dz * cy - dx * sy) * off;
  } else {
    const tbl = WC01_RIGS[it.key] ? ANIMS.WC01 : HERO_ANIM, pz0 = WC01_RIGS[it.key] ? WC01_POSE : RIG_ANIM;
    target = (labClip(m) ? (uu) => clipLabPose(labClip(m), uu) : (tbl[m] || pz0[m] || RIG_ANIM[m] || pz0.idle))(u, t, it); k = m === "idle" ? 0.15 : m === "broken" ? 0.25 : 0.8;
  }
  it.pose = A.blendPose(it.pose, target, k); A.applyPose(it.rig, it.pose);
  root.position.set(px, labGround(px, pz), pz); root.rotation.y = it.yaw;
  it.motion.update(dt, it.pose, labGround);
}
function rigFrame(it, t) {
  if (opts.play) {
    const dt = Math.min(0.1, Math.max(0, t - (it.lastT ?? t))); it.lastT = t;
    rigStep(it, dt, (t / rigDur(it.m, it)) % 1, t);
    return;
  }
  if (it.settled) return;
  // khung đứng: mô phỏng trước (đi 1,5 s tới ô, hoặc đứng ở đầu đòn rồi ra đòn tới u) để vạt áo, dây, lò xo
  // ở đúng trạng thái của khung đó như trong trận
  const h = 1 / 60;
  if (WALKS[it.m]) {
    const sp = rigSpeed(it), g = walkGait(it, sp);
    it.phase = it.u * Math.PI * 2 - g.rate * 1.5; it.dist = -sp * 1.5;
    for (let n = 0; n < 90; n++) rigStep(it, h, 0, t);
  } else {
    for (let n = 0; n < 40; n++) rigStep(it, h, 0, t);
    const steps = Math.max(1, Math.round(it.u * rigDur(it.m, it) / h));
    for (let n = 1; n <= steps; n++) rigStep(it, h, it.u * n / steps, t + n * h);
  }
  it.settled = true;
}

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
    if (it.rig) { rigFrame(it, t); continue; }
    const a = it.a, K = it.K;
    if (it.s === "cycle") attackCycle(a, K, t);
    else if (opts.play && STATES[it.s]?.anim) STATES[it.s].anim(a, t);
    else if (opts.play && it.s === "strike") attackCycle(a, K, t);
    else if (opts.play && it.s.startsWith("dead")) { a.dieT = t % 2.5; }
    else if (opts.play && it.s === "hit") { a.st = 0.32 - (t % 0.8) * 0.4; if (a.st < 0) a.st = 0.001; }
    // chạy thời gian thật: trạng thái có tốc độ thì đi thật theo hướng mặt (quay vòng mỗi 6 m), pha bước lấy
    // từ quãng đi như trong trận → thấy bàn chân chống đứng yên trên đất, vạt áo, tua giáo theo đà
    let px = it.x, pz = it.z;
    const moving = a.spd > 0.3 && !!STATES[it.s]?.anim, horse = !!K.mounted;
    const cyc = moving ? cycleLen(Math.min(1, a.spd / (horse ? 5 : 3.2)), 0, horse) * a.scale : 1;
    if (opts.play && moving) {
      const d = t * a.spd, off = (d % 6) - 3;
      px += Math.sin(a.yaw) * off; pz += Math.cos(a.yaw) * off;
      a.walk = 0.9 + d * 2 * Math.PI / cyc;
    }
    poseFor(a, it.kit, K, t, it.pose);
    const M = kitMeshes(it.kit), i = counts[it.kit] = (counts[it.kit] ?? -1) + 1, g0 = labGround(px, pz);
    const dt = opts.play ? Math.min(0.1, Math.max(0, t - (it.lastT ?? t))) : 0;
    it.lastT = t;
    // khung đứng: mô phỏng trước 2,5 s cho vạt áo, tua giáo yên vị (trạng thái có tốc độ thì đi tới đúng ô
    // của hình, nên vạt, tua ở thế đang chạy) rồi mới chụp
    if (!opts.play && !it.settled) {
      const w0 = a.walk;
      for (let n = -150; n < 0; n++) {
        let qx = px, qz = pz;
        if (moving) {
          const d = (n / 60) * a.spd; qx += Math.sin(a.yaw) * d; qz += Math.cos(a.yaw) * d;
          a.walk = w0 + d * 2 * Math.PI / cyc; poseFor(a, it.kit, K, t, it.pose);
        }
        const q0 = labGround(qx, qz);
        soldierFrame(a, M.skel, qx, q0, qz, q0, it.pose, 1 / 60, labGround, true, _mc);
      }
      a.walk = w0; poseFor(a, it.kit, K, t, it.pose); it.settled = true;
    }
    soldierFrame(a, M.skel, px, g0, pz, g0, it.pose, dt, labGround, true, _mc);
    if (M.glb) M.glb.data.set(_mc, i * BONE_FLOATS);
    else for (let j = 0; j < NJ; j++) M.parts[JOINT_NAMES[j]].setMatrixAt(i, affineToMatrix(_mc, j * 12, _m4));
  }
  for (const k in meshCache) {
    const n = (counts[k] ?? -1) + 1, C = meshCache[k];
    if (C.glb) { const L = Math.min(opts.lod, C.glb.meshes.length - 1); C.glb.meshes.forEach((m, l) => (m.count = l === L ? n : 0)); C.glb.tex.needsUpdate = true; continue; }
    for (const j of JOINT_NAMES) { const m = C.parts[j]; m.count = n; m.instanceMatrix.needsUpdate = true; }
  }
  renderer.render(scene, camera);
  for (const it of items) {
    _v.set(it.x, -0.25, it.z).project(camera);
    it.el.style.left = ((_v.x * 0.5 + 0.5) * W) + "px"; it.el.style.top = ((-_v.y * 0.5 + 0.5) * H) + "px";
  }
}
window.__lab.render = render;
// mô hình GLB (glb.js) nạp trước khi dựng; &noglb để xem khối hình dựng bằng code như cũ
if (!params.has("noglb")) await preloadModels();
await loadClips();                                    // clip xương người (clips.js); &noclips để xem hoạt ảnh thủ tục như cũ
window.__lab.ready = true;
build();
requestAnimationFrame(frame);
