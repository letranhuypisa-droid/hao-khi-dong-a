// lab-b20.js — phòng thử thế giới B20 Bạch Đằng (lab-b20.html, chỉ dùng khi phát triển): địa hình, nước theo Con nước,
// cảnh, hạm đội Nguyên mẫu (kỳ hạm, thuyền chỉ huy Phàn Tiếp, 6 hộ vệ, 16 chiến thuyền) xuôi dòng theo ba làn, 8 thuyền
// nhẹ quân Trần đi trước, mắc cạn ở khúc cọc, người đứng thử trên boong (DeckSet.heightAt).
//   ?tide=85        Con nước (%) lúc mở
//   &t=120          thời gian hạm đội (s) — thanh trượt "t" tua đi lại; đầu hạm đội ở x = head + 4,4·t
//   &head=40        x đầu hạm đội lúc t = 0 (MAP.fleetHead)
//   &strand         thuyền trong khúc cọc (x 480–820) mắc cạn, nằm nghiêng (thuyền ở chỗ cạn cũng tự mắc khi triều ròng)
//   &cam=reach      góc máy dựng sẵn (overview, start, reach, strand, flag, tower, walker, hq, estuary, rut, low)
//   &cap=40         trần thuyền LOD1 (24/40/60) · &noshadow · &nofleet · &hide (ẩn bảng) · &play (chạy thời gian)
//   &stakes=active  trạng thái cả ba mốc cọc (hidden/active/exposed) · &boom (hiện phao chặn luồng)
//   &still          không chạy vòng khung (chỉ vẽ khi gọi __labb20: chụp màn tất định)
//   &noenv          không nạp mô hình môi trường nướng (scenery-b20.js B20_ENV: thuyền K1–K5, tháp canh, bến, bè, cây) — xem khối code
// Chuột: kéo trái xoay, kéo phải / Shift+kéo dời, lăn thu phóng; bật "Người" rồi nhấp để đặt người thử (đứng trên boong
// nếu trúng boong, theo boong khi thuyền dập dềnh). Phím I J K L đi, U/O xoay người.
// window.__labb20: API cho kịch bản chụp màn (tools/shot.mjs) — xem cuối file.

import * as THREE from "three";
import { buildWorldB20 } from "./battle/world-b20.js";
import { Boat, FleetRenderer, HULLS } from "./battle/boats.js";
import { zc, hw, bedHeight, inReach, stakeFieldAt, TIDE_Y } from "./data/terrain-b20.js";
import { MAP, FLEET, LIGHT_BOATS } from "./data/battle-b20.js";
import { STAKE_FIELDS } from "./data/river-b20.js";
import { makeRig, RIGS } from "./battle/models.js";
import { preloadModels } from "./battle/glb.js";
import { B20_ENV } from "./battle/scenery-b20.js";

const Q = new URLSearchParams(location.search);
if (!Q.has("noenv")) await preloadModels(B20_ENV.map((id) => "env/" + id), 15000);   // như màn tải của trận (main.js loadModels)
const num = (k, d) => (Q.has(k) && Q.get(k) !== "" ? Number(Q.get(k)) : d);
if (Q.has("hide")) document.body.classList.add("hide");

// ---- renderer, cảnh (giống battle.js) ----------------------------------------------------------------------------------
const canvas = document.querySelector("canvas"), bar = document.querySelector(".bar"), infoEl = document.querySelector(".info");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const SHADOWS = !Q.has("noshadow");
renderer.shadowMap.enabled = SHADOWS; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 4000);
const t0 = performance.now();
const world = buildWorldB20(scene, { shadows: true, tide: num("tide", 100) });
const buildMs = Math.round(performance.now() - t0);

// ---- hạm đội mẫu ---------------------------------------------------------------------------------------------------------
// Ba làn song song tâm dòng (FLEET.formation: 3 hàng ngang, cách 34 m dọc), 8 hàng. Thứ tự từ đầu hạm đội (Hư cấu, ĐỀ XUẤT
// BẢN THỬ): hộ vệ mở đường, kỳ hạm giữa đội hình có hộ vệ hai bên, thuyền chỉ huy Phàn Tiếp phía sau.
const LANE = 26, SP = FLEET.formation.spacing, V = FLEET.p1Speed;
const ROWS = [
  ["escort", "junk", "escort"], ["junk", "junk", "junk"], ["junk", "escort", "junk"], ["escort", "flagship", "escort"],
  ["junk", "junk", "junk"], ["junk", "command", "junk"], ["junk", "junk", "junk"], ["junk", "escort", "junk"],
];
const lanePath = (off) => { const P = []; for (let x = -300; x <= 1340; x += 30) P.push({ x, z: zc(x) + off }); return P; };
let rs = 1288; const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
const boats = [], fleet = [], light = [];
const headX0 = num("head", MAP.fleetHead.x);
// quãng s trên đường ứng với x (chia đôi)
const sOfX = (tr, x) => { let lo = 0, hi = tr.len; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (tr.at(m).x < x) lo = m; else hi = m; } return lo; };
if (!Q.has("nofleet")) {
  ROWS.forEach((row, r) => row.forEach((kind, l) => {
    const type = kind === "command" ? "junk" : kind, off = (l - 1) * LANE + (rnd() - 0.5) * 6;
    const b = new Boat({ type, side: "dich", id: `${kind}${r}${l}`, path: lanePath(off), speed: V,
      flag: kind === "flagship" ? "元帥" : kind === "command" ? "樊" : kind === "junk" ? "元" : "" });
    b.s0 = sOfX(b.track, headX0) - r * SP + (rnd() - 0.5) * 8; b.kind = kind;
    boats.push(b); fleet.push(b);
  }));
  // thuyền nhẹ ta: hai hàng bốn chiếc, đi trước đầu hạm đội trong dải khoảng cách LIGHT_BOATS.gap
  for (let k = 0; k < LIGHT_BOATS.n; k++) {
    const off = [-21, -7, 7, 21][k % 4] + (rnd() - 0.5) * 3, b = new Boat({ type: "light", side: "ta", id: "light" + k, path: lanePath(off), speed: V, flag: "陳" });
    b.s0 = sOfX(b.track, headX0) + LIGHT_BOATS.gap.min + 10 + Math.floor(k / 4) * 14 + (rnd() - 0.5) * 4; b.kind = "light";
    boats.push(b); light.push(b);
  }
}
for (const b of boats) world.decks.add(b.deck);
const flagship = fleet.find((b) => b.kind === "flagship");
const fleetR = new FleetRenderer(scene, { shadows: true, cap: num("cap", 40) });

let T = num("t", 0), wt = 3, strandOn = Q.has("strand"), play = Q.has("play");
const env = { tideY: world.tideY, t: 0, bedHeight, stakeActive: (x, z) => { const id = stakeFieldAt(x, z); return !!id && world.scenery.stakes.state[id] === "active"; } };
const syncEnv = () => { env.tideY = world.tideY; env.t = wt; };
// Đặt hạm đội đúng thời điểm T (tất định: tua đi tua lại ra cùng cảnh). Mắc cạn: thuyền trong khúc cọc (bật strand) hoặc
// thuyền tự chạm đáy khi triều ròng — cho lún/nghiêng hết 6 s để thấy tư thế nằm cạn cuối.
function placeFleet() {
  syncEnv();
  for (const b of boats) {
    b.state = "sail"; b.restY = -Infinity; b.settleT = 0; b.speed = b.targetSpeed = V; b.visible = true;
    b.s = Math.max(0, Math.min(b.track.len, b.s0 + V * T));
    const p = b.track.at(b.s); b.x = p.x; b.z = p.z; b.yaw = Math.atan2(p.tx, p.tz);
    b.update(0, env);
    if (strandOn && b.side === "dich" && inReach(b.x) > 0.5) b.strand();
    if (b.state === "settle") { b.speed = 0; for (let k = 0; k < 13; k++) b.update(0.5, env); }
  }
}
placeFleet();

// ---- người đứng thử ---------------------------------------------------------------------------------------------------------
const walker = { x: 0, z: 0, y: 0, yaw: 0, on: false, deck: null, dver: -1, rig: makeRig(RIGS.H31) };
walker.rig.root.visible = false; scene.add(walker.rig.root);
const marker = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: 0xf1d98a, side: THREE.DoubleSide, depthWrite: false, transparent: true }));
marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker);
// boong cao nhất tại (x, z) trong mọi boong (thuyền + cầu bến), pad nới mép cho chân thò qua mạn
function deckAt(x, z, pad = 0) { let best = null, bh = -Infinity; for (const d of world.decks.all) { const h = d.heightAt(x, z, pad); if (h > bh) { bh = h; best = d; } } return best ? { d: best, h: bh } : null; }
function placeWalker(x, z) {
  walker.on = true; walker.x = x; walker.z = z;
  const hit = deckAt(x, z, 0.2);
  walker.deck = hit ? hit.d : null; if (walker.deck) walker.dver = walker.deck.ver;
  walker.rig.root.visible = marker.visible = true;
  updateWalker(0);
}
function updateWalker(dt, mv = null) {
  if (!walker.on) return;
  const d = walker.deck;
  if (d) {
    d.carry(walker);
    if (mv) { walker.x += mv.x; walker.z += mv.z; }
    const lp = d.toLocal(walker.x, walker.z);
    const pt = d.portals.some((p) => (lp.x - p.lx) ** 2 + (lp.z - p.lz) ** 2 < p.r * p.r);
    if (!pt) d.clampInside(walker, 0.35);
    const h = d.heightAt(walker.x, walker.z, 0.4);
    if (h === h) walker.y = h; else { walker.deck = null; walker.y = world.groundY(walker.x, walker.z); }
  } else {
    if (mv) { walker.x += mv.x; walker.z += mv.z; }
    const hit = deckAt(walker.x, walker.z, 0);
    if (hit && hit.h > world.groundY(walker.x, walker.z) - 0.3 && hit.h - walker.y < 0.8) { walker.deck = hit.d; walker.dver = hit.d.ver; walker.y = hit.h; }
    else walker.y = world.groundY(walker.x, walker.z);
  }
  walker.rig.root.position.set(walker.x, walker.y, walker.z); walker.rig.root.rotation.y = walker.yaw;
  marker.position.set(walker.x, walker.y + 0.04, walker.z);
}
// điểm chạm của tia từ camera: mặt đất (lưới vẽ) hoặc boong, bước dò to dần theo khoảng cách rồi chia đôi
const ray = new THREE.Raycaster();
function pick(nx, ny) {
  ray.setFromCamera({ x: nx, y: ny }, camera);
  const o = ray.ray.origin, dv = ray.ray.direction;
  const surf = (x, z) => { const g = world.groundY(x, z), h = deckAt(x, z); return h && h.h > g ? h.h : g; };
  let prev = 0;
  for (let t = 0.5; t < 3000; t += Math.max(0.25, t * 0.004)) {
    const x = o.x + dv.x * t, y = o.y + dv.y * t, z = o.z + dv.z * t;
    if (y <= surf(x, z)) {
      let a = prev, b = t;
      for (let k = 0; k < 24; k++) { const m = (a + b) / 2; if (o.y + dv.y * m <= surf(o.x + dv.x * m, o.z + dv.z * m)) b = m; else a = m; }
      return { x: o.x + dv.x * b, y: o.y + dv.y * b, z: o.z + dv.z * b };
    }
    prev = t;
  }
  return null;
}

// ---- camera quay quanh ------------------------------------------------------------------------------------------------------
const cam = { tx: 600, ty: 0, tz: zc(600), yaw: 0.6, pitch: 0.45, dist: 260, follow: null };
const CAMS = {
  overview: () => ({ tx: 560, tz: 0, ty: 0, yaw: -0.55, pitch: 0.62, dist: 1150 }),
  start: () => ({ tx: 30, tz: zc(30), ty: 0, yaw: -2.3, pitch: 0.3, dist: 190 }),
  reach: () => ({ tx: 655, tz: zc(655), ty: 0, yaw: 0.25, pitch: 0.36, dist: 250 }),
  strand: () => ({ tx: 655, tz: zc(655) + 10, ty: -1, yaw: 0.95, pitch: 0.24, dist: 105 }),
  low: () => ({ tx: 640, tz: zc(640) + 20, ty: -1, yaw: 1.3, pitch: 0.12, dist: 60 }),
  flag: () => ({ follow: flagship, yaw: 2.3, pitch: 0.28, dist: 62, off: 4 }),
  tower: () => ({ follow: flagship, local: [0, -10], yaw: 2.6, pitch: 0.42, dist: 20, off: 1 }),
  walker: () => ({ follow: walker, yaw: 2.2, pitch: 0.35, dist: 12, off: 1.2 }),
  hq: () => ({ tx: 600, tz: zc(600) - 118, ty: 6, yaw: 0.45, pitch: 0.4, dist: 95 }),
  estuary: () => ({ tx: 1120, tz: zc(1120), ty: 0, yaw: -1.4, pitch: 0.3, dist: 420 }),
  rut: () => ({ tx: 660, tz: zc(660) + 110, ty: 0, yaw: -0.4, pitch: 0.4, dist: 160 }),
};
function setCam(name, extra = {}) {
  const c = (CAMS[name] || CAMS.reach)();
  cam.follow = null; cam.local = null; cam.off = 0;
  Object.assign(cam, c, extra);
  camName = name;
  if (camSel) camSel.value = name;
}
let camName = "reach", camSel = null;
function applyCam() {
  if (cam.follow) {
    const f = cam.follow;
    if (cam.local && f.deck) { const p = f.deck.toWorld(cam.local[0], cam.local[1], {}); cam.tx = p.x; cam.tz = p.z; cam.ty = p.y + cam.off; }
    else { cam.tx = f.x; cam.tz = f.z; cam.ty = (f.y ?? 0) + cam.off; }
  }
  const cp = Math.cos(cam.pitch);
  let x = cam.tx + cam.dist * cp * Math.sin(cam.yaw), z = cam.tz + cam.dist * cp * Math.cos(cam.yaw), y = cam.ty + cam.dist * Math.sin(cam.pitch);
  y = Math.max(y, world.surfaceY(x, z) + 1.2);                          // camera luôn trên mặt đất, mặt nước
  camera.position.set(x, y, z); camera.lookAt(cam.tx, cam.ty, cam.tz);
  // sương theo khoảng cách camera (chỉ trong lab: nhìn toàn cảnh từ xa không chìm hẳn trong sương; gần thì như trận)
  const F = world.fogBase, k = Math.max(1, cam.dist / 280);
  scene.fog.near = F.near * k; scene.fog.far = F.far * k;
  // bóng đổ quanh điểm nhìn: khung to dần khi kéo xa (bản đồ lớn — trong trận là ±45 m quanh tướng)
  world.fitShadow(cam.tx, cam.tz, Math.min(220, Math.max(40, cam.dist * 0.75)));
}
setCam(Q.get("cam") || "reach");

// ---- UI --------------------------------------------------------------------------------------------------------------------
const btn = (label, fn, on) => { const b = document.createElement("button"); b.textContent = label; b.onclick = () => { fn(b); render(); }; if (on) b.classList.add("on"); bar.appendChild(b); return b; };
const slider = (label, min, max, step, val, fn) => {
  const l = document.createElement("label"), s = document.createElement("input"), v = document.createElement("span");
  s.type = "range"; s.min = min; s.max = max; s.step = step; s.value = val; v.textContent = val;
  s.oninput = () => { v.textContent = s.value; fn(Number(s.value)); render(); };
  l.append(label, s, v); bar.appendChild(l); return { s, v, set: (x) => { s.value = x; v.textContent = Math.round(x); } };
};
const tideS = slider("Con nước", 0, 100, 1, world.tidePct, (p) => setTide(p));
const timeS = slider("t", 0, 260, 1, T, (x) => { T = x; placeFleet(); });
camSel = document.createElement("select");
for (const k of Object.keys(CAMS)) { const o = document.createElement("option"); o.value = o.textContent = k; camSel.appendChild(o); }
camSel.value = camName; camSel.onchange = () => { setCam(camSel.value); render(); }; bar.appendChild(camSel);
btn("Mắc cạn", (b) => { strandOn = !strandOn; b.classList.toggle("on", strandOn); placeFleet(); }, strandOn);
btn("Chạy", (b) => { play = !play; b.classList.toggle("on", play); }, play);
for (const f of STAKE_FIELDS) btn(f.id, (b) => { const S = ["hidden", "active", "exposed"], s = S[(S.indexOf(world.scenery.stakes.state[f.id]) + 1) % 3]; setStake(f.id, s); b.textContent = `${f.id}:${s[0]}`; });
btn("Phao chặn", (b) => { const w = world.boom; w.visible ? w.hide() : w.show(); b.classList.toggle("on", w.visible); });
let walkMode = false;
btn("Người", (b) => { walkMode = !walkMode; b.classList.toggle("on", walkMode); });

function setTide(p) { world.setTide(p); tideS.set(p); placeFleet(); }
function setStake(id, s) { world.scenery.stakes.setState(id, s); world.setBaseOwner(id, s === "active" ? "ta" : s === "exposed" ? "dich" : "none"); }
if (Q.has("stakes")) for (const f of STAKE_FIELDS) setStake(f.id, Q.get("stakes"));
if (Q.has("boom")) world.boom.show();

// chuột: kéo xoay / dời, lăn thu phóng, nhấp đặt người
let drag = null;
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, b: e.button === 2 || e.shiftKey, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  if (drag.b) {
    if (cam.follow) { cam.tx = cam.follow.x; cam.tz = cam.follow.z; cam.follow = null; }
    const k = cam.dist * 0.0016, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    cam.tx += (-dx * c - dy * s) * k; cam.tz += (dx * s - dy * c) * k; cam.ty = world.surfaceY(cam.tx, cam.tz);
  } else { cam.yaw -= dx * 0.005; cam.pitch = Math.max(0.03, Math.min(1.5, cam.pitch + dy * 0.004)); }
});
canvas.addEventListener("pointerup", (e) => {
  if (drag && drag.moved < 4 && walkMode && e.button === 0) {
    const r = canvas.getBoundingClientRect(), p = pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (p) placeWalker(p.x, p.z);
  }
  drag = null;
});
canvas.addEventListener("wheel", (e) => { e.preventDefault(); cam.dist = Math.max(3, Math.min(2500, cam.dist * Math.pow(1.0015, e.deltaY))); }, { passive: false });
const keys = new Set();
addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ---- vẽ, số liệu --------------------------------------------------------------------------------------------------------
const stat = { calls: 0, tris: 0, main: 0, mainTris: 0 };
function resize() {
  const W = innerWidth, H = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
  camera.aspect = W / H; camera.updateProjectionMatrix();
}
addEventListener("resize", () => { resize(); render(); }); resize();
function frameUpdate(dt) {
  syncEnv();
  if (play) { T += dt; timeS.set(T); for (const b of boats) b.update(dt, env); }
  else for (const b of boats) if (b.state === "sail" || b.state === "hold") b.update(0, env);   // dập dềnh tại chỗ
  world.update(wt);
  const mv = { x: 0, z: 0 }, sp = 3.2 * dt;
  if (keys.has("i")) { mv.x += Math.sin(walker.yaw) * sp; mv.z += Math.cos(walker.yaw) * sp; }
  if (keys.has("k")) { mv.x -= Math.sin(walker.yaw) * sp; mv.z -= Math.cos(walker.yaw) * sp; }
  if (keys.has("j")) { mv.x += Math.cos(walker.yaw) * sp; mv.z -= Math.sin(walker.yaw) * sp; }
  if (keys.has("l")) { mv.x -= Math.cos(walker.yaw) * sp; mv.z += Math.sin(walker.yaw) * sp; }
  if (keys.has("u")) walker.yaw += dt * 2; if (keys.has("o")) walker.yaw -= dt * 2;
  updateWalker(dt, mv.x || mv.z ? mv : null);
}
function render() {
  applyCam();
  fleetR.sync(boats, camera, wt);
  // lượt vẽ, tam giác: cả khung (có lượt bóng) và riêng lượt chính (vẽ lại không cập nhật bóng)
  renderer.shadowMap.autoUpdate = true; renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  stat.calls = renderer.info.render.calls; stat.tris = renderer.info.render.triangles;
  showInfo();
}
function measure() {
  applyCam(); fleetR.sync(boats, camera, wt);
  renderer.shadowMap.autoUpdate = true; renderer.render(scene, camera);
  const all = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  renderer.shadowMap.autoUpdate = false; renderer.render(scene, camera);
  const main = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  renderer.shadowMap.autoUpdate = true;
  Object.assign(stat, { calls: all.calls, tris: all.tris, main: main.calls, mainTris: main.tris });
  showInfo();
  return { calls: all.calls, tris: all.tris, mainCalls: main.calls, mainTris: main.tris, shadowCalls: all.calls - main.calls, shadowTris: all.tris - main.tris, fleet: fleetR.info };
}
function walkerInfo() {
  if (!walker.on) return "người: (bật Người rồi nhấp)";
  const d = walker.deck, g = world.groundY(walker.x, walker.z);
  return `người (${walker.x.toFixed(1)}, ${walker.z.toFixed(1)}) y ${walker.y.toFixed(2)} · ${d ? (d.boat ? `boong ${d.boat.id} ${d.boat.state} nghiêng ${(d.boat.tilt * 57.3).toFixed(1)}°` : `cầu ${d.pier}`) : `đất, nước sâu ${(world.tideY - g).toFixed(2)} m`}`;
}
function showInfo() {
  const f = fleetR.info, st = {}; for (const b of fleet) st[b.state] = (st[b.state] || 0) + 1;
  infoEl.textContent = `lượt vẽ ${stat.calls} · tam giác ${(stat.tris / 1000).toFixed(0)}k${stat.main ? ` (lượt chính ${stat.main} · ${(stat.mainTris / 1000).toFixed(0)}k)` : ""}\n` +
    `hạm đội: ${f.draws} lượt · ${(f.tris / 1000).toFixed(1)}k · ${JSON.stringify(st)}\n` +
    `Con nước ${world.tidePct.toFixed(0)}% (y ${world.tideY.toFixed(2)}) · t ${T.toFixed(0)} s · dựng ${buildMs} ms · cam ${camName}\n` + walkerInfo();
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now; wt += dt;
  frameUpdate(dt); render();
  requestAnimationFrame(loop);
}
frameUpdate(0); render();
if (!Q.has("still")) requestAnimationFrame(loop);        // &still: chỉ vẽ khi gọi API (kịch bản chụp màn)

// ---- API cho kịch bản -----------------------------------------------------------------------------------------------------
window.__labb20 = {
  ready: true, world, boats, fleet, light, flagship, walker, scene, renderer, camera, HULLS,
  tide: (p) => { setTide(p); render(); return world.tideY; },
  time: (t) => { T = t; timeS.set(t); placeFleet(); render(); return T; },
  strand: (on = true) => { strandOn = on; placeFleet(); render(); return fleet.filter((b) => b.state === "stranded").length; },
  cam: (name, extra) => { setCam(name, extra); render(); return { ...cam, follow: !!cam.follow }; },
  orbit: (o) => { cam.follow = null; Object.assign(cam, o); render(); },
  stakes: (id, s) => { setStake(id, s); render(); },
  boom: (on = true) => { on ? world.boom.show() : world.boom.hide(); render(); },
  // tua đồng hồ cảnh (sóng, bè trôi, phao) thêm sec giây theo bước 0,1 s; boats: true thì hạm đội cũng chạy
  advance: (sec, withBoats = false) => { const p0 = play; play = withBoats; for (let k = 0; k < sec / 0.1; k++) { wt += 0.1; frameUpdate(0.1); } play = p0; render(); },
  place: (x, z) => { placeWalker(x, z); render(); return walkerInfo(); },
  // đặt người lên boong thuyền i ở điểm cục bộ (lx, lz)
  placeOn: (i, lx, lz) => { const b = boats[i]; const p = b.deck.toWorld(lx, lz, {}); placeWalker(p.x, p.z); render(); return walkerInfo(); },
  walk: (dx, dz) => { updateWalker(0, { x: dx, z: dz }); render(); return walkerInfo(); },
  pick: (nx, ny) => pick(nx, ny),
  render, measure, info: () => ({ ...stat, fleet: fleetR.info, world: world.info(), walker: walkerInfo(), buildMs }),
  pause: () => { play = false; },
};
