// battle/atmosphere.js — trời, nắng, sương, khói lửa đổi theo pha trận B15 (Hư cấu, chỉ để nhìn; không đổi luật).
//
// P1 buổi sáng: nắng ấm, trong, mặt trời cao, ít sương. P2 gần trưa: sáng nhất, nắng trắng, bóng ngắn.
// P3 buổi chiều: nắng thấp và cam hơn; khói bốc trên trại Nguyên cháy và trong Hàm Tử quan; sương dày hơn.
// P4 xế chiều sang hoàng hôn: nắng đỏ vàng sát chân trời, bóng dài, ánh trời tối và ấm, sương gần lẫn khói,
// thuyền chiến Nguyên bốc cháy, tàn lửa bay. Cổng vỡ thì cháy và bốc khói tới hết trận. Tổng Phản Công phủ
// một lớp nắng vàng ngắn lên trên.
//
// Đổi pha: chuyển dần LERP_T giây (giờ thật, để vẫn chuyển khi trận đã hết). Vào trận và tải lại checkpoint
// (pha có thể lùi): đặt ngay. Khói, lửa, đèn lửa chạy theo đồng hồ trận (hit-stop thì đứng hình).
//
// Không import three (phần thuần kiểm thử được trong Node): chỉ chỉnh vật three đã có qua API của chúng —
// world.sun, HemisphereLight, vòm trời (lưới BackSide có màu đỉnh), núi xa + mây (MeshBasic không sương),
// scene.fog, scene.background, renderer.toneMappingExposure. Đèn lửa PointLight do battle.js tạo rồi đưa vào.
// Khói lửa vẽ bằng trường instanced của fx.js (mỗi ảnh một lượt vẽ).
// Nhiều trận (đợt 9 lõi): bảng pha và nguồn cháy lấy từ ctx.battle.atmo = { presets, tpc?, buildSources(world, smokes),
// sourceWant(s, phase, cols, openGates, anyOpen), glowFrom? } — B15 (battles/b15.js) đưa đúng ATMO / buildSources /
// sourceWant dưới đây; không có ctx.battle (lab, kiểm thử) thì dùng luôn bộ của B15. Chỉ số pha kẹp trong bảng (trận 6 pha
// với bảng ngắn hơn không vỡ). World có world.hemi / world.far (B20) thì dùng thẳng, không thì dò cảnh như cũ.
// Nguồn có fs ≤ 0 chỉ bốc khói, không lưỡi lửa (B20: data/atmo-b20.js, cột khói giao chiến — không có thuyền cháy).

import { heightAt, ZONES } from "./ground.js";

export const LERP_T = 8;                        // giây chuyển giữa hai pha

// Thông số từng pha. Màu: hex sRGB. el, az: độ; az đo từ đông (+x) sang nam (+z): 90 chính nam, 180 chính tây.
// sky/ground/hemiI: ánh trời (HemisphereLight) · top/mid/hor: vòm trời đỉnh/giữa/chân trời · far: nhuộm núi xa
// và mây · haze: ánh lên khói (khói không nhận đèn) · smoke: hệ số khói đống lửa tàn · cols: cường độ cột khói
// lớn trên trại Nguyên · embers: tàn lửa quanh đám cháy.
export const ATMO = [
  { id: "P1", sun: 0xffdcaa, sunI: 2.2, el: 52, az: 80, sky: 0xffe8c8, ground: 0x3d3222, hemiI: 1.12,
    fog: 0xd3b690, fogNear: 150, fogFar: 520, bg: 0xdcc096, top: 0x2f4a58, mid: 0xa47c56, hor: 0xecd0a0,
    exposure: 1.05, far: 0xffffff, haze: 0xf2e6d6, smoke: 1, cols: 0, embers: 0 },
  { id: "P2", sun: 0xfff0dc, sunI: 2.6, el: 68, az: 100, sky: 0xfff2e0, ground: 0x44392a, hemiI: 1.2,
    fog: 0xd9c3a2, fogNear: 160, fogFar: 540, bg: 0xe2cca6, top: 0x3e6276, mid: 0xb4946c, hor: 0xf2ddb6,
    exposure: 1.1, far: 0xfff8f0, haze: 0xfaf2e8, smoke: 1.4, cols: 0, embers: 0 },
  { id: "P3", sun: 0xffc484, sunI: 2.2, el: 34, az: 135, sky: 0xf2cea0, ground: 0x3a2c1e, hemiI: 1.02,
    fog: 0xc59d70, fogNear: 115, fogFar: 430, bg: 0xcfa575, top: 0x2b3640, mid: 0x98623e, hor: 0xe2b27a,
    exposure: 1.05, far: 0xffe2c4, haze: 0xe8caa8, smoke: 2.2, cols: 0.8, embers: 0 },
  { id: "P4", sun: 0xff9a58, sunI: 2.8, el: 13, az: 168, sky: 0xe2aa88, ground: 0x36261e, hemiI: 1.15,
    fog: 0xa87458, fogNear: 80, fogFar: 370, bg: 0xb07a58, top: 0x222a40, mid: 0x8a4a3a, hor: 0xf29658,
    exposure: 1.05, far: 0xffb898, haze: 0xd09c80, smoke: 3, cols: 1, embers: 1 },
];
// Tổng Phản Công: màu kéo về vàng theo trọng số w (tpcWeight); cường độ, tầm sương cộng thêm add × w.
export const ATMO_TPC = { sun: 0xffcf70, sky: 0xffd898, fog: 0xe0b068, bg: 0xe8bc78, top: 0x5a4a30, mid: 0xd09a48, hor: 0xffd488,
  far: 0xffe0a0, haze: 0xffe0b0, add: { sunI: 0.6, hemiI: 0.35, exposure: 0.12, fogNear: 20, fogFar: 80 } };

// ---- vectơ thông số (phẳng, để trộn không cấp phát) ------------------------------------------------------
const LAYOUT = [["sun", 3], ["sunI", 1], ["el", 1], ["az", 1], ["sky", 3], ["ground", 3], ["hemiI", 1], ["fog", 3], ["fogNear", 1], ["fogFar", 1],
  ["bg", 3], ["top", 3], ["mid", 3], ["hor", 3], ["exposure", 1], ["far", 3], ["haze", 3], ["smoke", 1], ["cols", 1], ["embers", 1]];
export const O = {};
export const NV = LAYOUT.reduce((o, [k, n]) => { O[k] = o; return o + n; }, 0);

export const srgbToLinear = (c) => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
// hex sRGB → 3 số tuyến tính (không gian màu làm việc của three) ghi vào out[o..o+2].
export function hexLin(hex, out, o = 0) {
  out[o] = srgbToLinear(((hex >> 16) & 255) / 255); out[o + 1] = srgbToLinear(((hex >> 8) & 255) / 255); out[o + 2] = srgbToLinear((hex & 255) / 255);
  return out;
}
// Bộ thông số → vectơ NV số (màu tuyến tính). Trường thiếu → NaN (lớp TPC dùng NaN nghĩa là "giữ nguyên").
export function presetVec(p, out = new Float32Array(NV)) {
  for (const [k, n] of LAYOUT) {
    if (p[k] === undefined) out.fill(NaN, O[k], O[k] + n);
    else if (n === 3) hexLin(p[k], out, O[k]); else out[O[k]] = p[k];
  }
  return out;
}
export function mixVec(out, a, b, t) { for (let i = 0; i < out.length; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; }
export const smooth01 = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// Hướng từ đất lên mặt trời (vectơ đơn vị).
export function sunDir(elDeg, azDeg, out = { x: 0, y: 0, z: 0 }) {
  const e = elDeg * Math.PI / 180, a = azDeg * Math.PI / 180;
  out.x = Math.cos(e) * Math.cos(a); out.y = Math.sin(e); out.z = Math.cos(e) * Math.sin(a);
  return out;
}
// Nửa chiều cao khung bóng (trục đứng của camera bóng). Khung ±45 m chiếu xuống đất trải 45/sin(el) m theo
// hướng nắng: mặt trời thấp thì mỗi texel bóng giãn dài, bóng nhoè. Giữ ~60 m đất theo hướng nắng như cũ
// (el 49° → ±45) và thu khung khi nắng thấp; vật đổ bóng nằm trên cùng tia sáng nên không bị cắt.
export const shadowHalf = (elDeg) => Math.max(14, Math.min(45, 60 * Math.sin(elDeg * Math.PI / 180)));
// Trọng số lớp vàng Tổng Phản Công theo giây kể từ lúc kích: loé lên 0,5 s, giữ tới 3 s, tan về 0,16 (nền còn
// lại tới hết TPC); tắt TPC thì Atmosphere tự hạ dần về 0. Tối đa 0,5 để không xoá mất sắc của pha.
export function tpcWeight(s) {
  const pulse = s < 0.5 ? s / 0.5 : s < 3 ? 1 : Math.max(0, 1 - (s - 3) / 3.5);
  return Math.max(0.16, 0.5 * pulse);
}

// ---- nguồn cháy lớn ---------------------------------------------------------------------------------------
// Mức chi tiết theo khoảng cách tới tướng: 0 gần (nhiều cụm khói nhỏ), 1 vừa, 2 xa (ít cụm mà to, đọc được
// từ đầu kia bản đồ).
export const columnLOD = (d) => (d < 70 ? 0 : d < 170 ? 1 : 2);
export const COL_EVERY = [0.42, 0.9, 1.9];      // giây giữa hai cụm khói của một cột
export const FIRE_EVERY = [0.16, 0.45, 0.9];    // giây giữa hai lưỡi lửa
export const FIRE_BIG = [1, 1.25, 1.8];         // đốm lửa xa vẽ to hơn cho dễ thấy
export const COL_CAP = 112, PIT_CAP = 48;       // trần hạt khói: cột lớn (kênh 1), đống lửa tàn (kênh 0); tổng ≤ 160
export const WIND = { x: 1.5, z: -0.55 };       // gió nhẹ tây tây nam → đông đông bắc, m/s: khói trại trôi qua thành
export const GLOW_R = 30, GLOW_I = 36;          // đèn lửa: bán kính tìm đám cháy quanh tướng (m), cường độ (cd)

// Đám cháy có cột khói. kind: scorch (lều cháy ở trại Nguyên ngoài thành, từ P3), fort1 (trong thành, từ P3),
// fort2 (trong thành, từ P4 hoặc khi một cổng đã vỡ), gate (cổng vỡ), boat (thuyền chiến Nguyên, P4).
// h: độ cao chân cột khói trên nền · fs: cỡ lửa · fw: bề rộng đám lửa.
export function buildSources(world, smokes = []) {
  const src = [];
  const add = (kind, id, x, z, h, fs, fw, boat = null) => src.push({ kind, id, x, z, y: boat ? 0 : heightAt(x, z), h, fs, fw, boat, k: 0,
    acc: Math.random(), facc: Math.random() * 0.2, eacc: Math.random() * 0.2 });
  // trại Nguyên: 3 đống lửa trải theo z (lấy từ world.smokes nếu có), không thì 3 chỗ mặc định trong dải cháy
  const S = ZONES.scorch, used = new Set();
  for (const zt of [-100, 0, 100]) {
    let best = null, bd = 45;
    for (const s of smokes) { const d = Math.abs(s.z - zt); if (d < bd && !used.has(s)) { bd = d; best = s; } }
    if (best) used.add(best);
    const x = best ? best.x : (S.x0 + S.x1) / 2 + zt * 0.1, z = best ? best.z : zt + 8;
    add("scorch", "S" + zt, x, z, 1.5, 3.2, 2.5);
  }
  add("fort1", "F1", 517, 24, 3.5, 4, 4);
  add("fort2", "F2", 547, 96, 3.5, 4, 4);
  for (const id in world.gates) { const g = world.gates[id]; add("gate", id, g.x + 1.5, g.z, 6.5, 3.2, 9); }
  for (const i of [1, 3, 5]) if (world.boats[i]) add("boat", "boat" + i, 0, 0, 3, 3, 3, world.boats[i]);
  return src;
}
// Cổng vỡ cháy ở hai bên lối, không trên nền lối đi: lối cổng (z ±4,4 quanh tâm) là đường duy nhất vào thành ở P4,
// lửa trải khắp nền thì thành bức tường lửa che tướng và sân trong suốt trận. Nguồn cổng đặt ở x cổng + 1,5 (s.x).
// Nửa số lưỡi lửa liếm lên hai cánh cửa đã lật vào trong (nằm ở z ≈ ±4,2, từ chân tường tới x + 4,4), nửa kia trên
// mặt tây hai tháp cổng (ngoài tường, tháp ở z ±4,6..7,8, mặt tây x − 1,6). Giữa lối chừa ~5 m không có lửa.
export const GATE_LEAF_Z = 4.2;
function gateFlame(fx, s, size) {
  const side = Math.random() < 0.5 ? -1 : 1;
  let x, z, up;
  if (Math.random() < 0.5) { x = s.x - 1.1 + Math.random() * 3.8; z = s.z + side * (GATE_LEAF_Z + (Math.random() - 0.5) * 0.5); up = 1.6; }
  else { x = s.x - 3.4 - Math.random() * 0.3; z = s.z + side * (4.9 + Math.random() * 2.6); up = 2.4; }
  fx.flame(x, heightAt(x, z) + Math.random() * up, z, size, s.k);
}
// Cường độ mong muốn của một nguồn (0..1) theo pha, cột khói của pha, cổng đã vỡ.
export function sourceWant(s, phase, cols, openGates, anyOpen) {
  switch (s.kind) {
    case "scorch": case "fort1": return cols;
    case "fort2": return phase >= 3 || anyOpen ? 1 : 0;
    case "gate": return openGates[s.id] ? 1 : 0;
    case "boat": return phase >= 3 ? 1 : 0;
  }
  return 0;
}

// ---- khí quyển của một trận B15 ----------------------------------------------------------------------------
export const ATMO_B15 = { presets: ATMO, tpc: ATMO_TPC, buildSources, sourceWant, glowFrom: 2 };
export class Atmosphere {
  constructor(ctx, glow = null) {
    this.ctx = ctx;
    const scene = ctx.scene, world = ctx.world, A = this.A = ctx.battle?.atmo || ATMO_B15;
    this.sun = world.sun; this.hemi = null; this.dome = null; this.far = [];
    scene.traverse((o) => {
      if (o.isHemisphereLight) { this.hemi = o; return; }
      const m = o.material;
      if (!o.isMesh || !m || !m.isMeshBasicMaterial || m.fog !== false) return;
      if (m.side === 1 && o.geometry.attributes.color) { this.dome = o; return; }      // 1 = THREE.BackSide
      // núi xa, mây (lưới lớn): nhuộm qua material.color; vật tự sáng nhỏ (lửa vạc, đuốc) thì bỏ qua
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (o.geometry.boundingSphere.radius > 20 && !this.far.includes(m)) this.far.push(m);
    });
    if (world.hemi) this.hemi = world.hemi;
    if (Array.isArray(world.far)) this.far = world.far.slice();
    if (this.dome) {
      const pos = this.dome.geometry.attributes.position, r = this.dome.geometry.parameters?.radius || 900;
      this.domeY = new Float32Array(pos.count);
      for (let i = 0; i < pos.count; i++) this.domeY[i] = pos.getY(i) / r;
      this.domeCol = this.dome.geometry.attributes.color;
    }
    this.P = A.presets.map((p) => presetVec(p));
    this.tpcA = A.tpc || ATMO_TPC; this.tpcV = presetVec(this.tpcA);
    this.want = A.sourceWant || (() => 0); this.glowFrom = A.glowFrom ?? 2;
    this.cur = new Float32Array(NV); this.from = new Float32Array(NV); this.fin = new Float32Array(NV);
    this.sunDir = { x: 0, y: 1, z: 0 };
    this.tpcS = 0; this.tpcW = 0; this.dirty = true;
    this.pits = (world.smokes || []).map((s) => ({ x: s.x, z: s.z, y: heightAt(s.x, s.z) + 1 }));
    this.pitT = 0; this.pitTick = 0;
    this.srcs = A.buildSources ? A.buildSources(world, world.smokes || []) : [];
    this.glow = glow; this.glowI = 0; this.glowSrc = null;
    if (glow) { glow.intensity = 0; scene.add(glow); }
    for (const k of ["smoke", "fire", "embers"]) { const f = ctx.fx.field(k); f.windX = WIND.x; f.windZ = WIND.z; }
    this.clock = ctx.clock;
    this.retries = ctx.director.retries || 0;
    this.snap();
    this.apply();
  }

  // Đặt ngay thông số của pha hiện tại (vào trận, tải lại checkpoint). Tải lại cùng pha thì giữ khói đang
  // bốc (không để cột khói biến rồi mọc lại); nguồn nào tắt (cổng đóng lại) thì khói của nó tự tan.
  snap() {
    const ph = this.ctx.director.phase, same = ph === this.phase;
    this.phase = ph;
    this.cur.set(this.preset(ph)); this.lerpT = 1; this.dirty = true;
    if (!same) this.ctx.fx.clearFields();
    this.snapK = true; this.glowI = 0; this.glowSrc = null;
  }

  // bảng của pha ph, kẹp trong số pha của bảng
  preset(ph) { const P = this.P; return P[ph < 0 ? 0 : ph >= P.length ? P.length - 1 : ph]; }

  // dt: giờ thật của khung (chuyển pha, lớp TPC). Khói lửa lấy bước của đồng hồ trận (ctx.clock).
  update(dt) {
    const ctx = this.ctx, d = ctx.director;
    const bdt = Math.min(0.25, Math.max(0, ctx.clock - this.clock)); this.clock = ctx.clock;
    if ((d.retries || 0) !== this.retries || d.phase < this.phase) { this.retries = d.retries || 0; this.snap(); }
    else if (d.phase !== this.phase) { this.phase = d.phase; this.from.set(this.cur); this.lerpT = 0; }
    if (this.lerpT < 1) { this.lerpT = Math.min(1, this.lerpT + dt / LERP_T); mixVec(this.cur, this.from, this.preset(this.phase), smooth01(this.lerpT)); this.dirty = true; }
    const w0 = this.tpcW;
    if (ctx.hk.tpc) { this.tpcS += dt; this.tpcW = tpcWeight(this.tpcS); } else { this.tpcS = 0; this.tpcW = Math.max(0, this.tpcW - dt * 0.5); }
    if (this.tpcW !== w0) this.dirty = true;
    if (this.dirty) this.apply();
    this.fires(bdt);
    ctx.fx.stepFields(bdt);
  }

  apply() {
    const c = this.cur, f = this.fin, T = this.tpcV, w = this.tpcW, A = this.tpcA.add;
    for (let i = 0; i < NV; i++) f[i] = T[i] === T[i] ? c[i] + (T[i] - c[i]) * w : c[i];      // T[i] NaN: giữ nguyên
    f[O.sunI] += A.sunI * w; f[O.hemiI] += A.hemiI * w; f[O.exposure] += A.exposure * w; f[O.fogNear] += A.fogNear * w; f[O.fogFar] += A.fogFar * w;
    const sun = this.sun, scene = this.ctx.scene;
    sun.color.setRGB(f[O.sun], f[O.sun + 1], f[O.sun + 2]); sun.intensity = f[O.sunI];
    sunDir(f[O.el], f[O.az], this.sunDir);
    // mép trên khung bóng (phía xa mặt trời, lên cao) chừa thêm chỗ khi khung thu lại, cho vật cao (cổng, tường) sau tướng
    const half = shadowHalf(f[O.el]), top = half + (45 - half) * 0.25, sc = sun.shadow.camera;
    if (Math.abs(sc.top - top) > 0.2 || Math.abs(sc.bottom + half) > 0.2) { sc.top = top; sc.bottom = -half; sc.updateProjectionMatrix(); }
    if (this.hemi) {
      this.hemi.color.setRGB(f[O.sky], f[O.sky + 1], f[O.sky + 2]); this.hemi.groundColor.setRGB(f[O.ground], f[O.ground + 1], f[O.ground + 2]);
      this.hemi.intensity = f[O.hemiI];
    }
    if (scene.fog) { scene.fog.color.setRGB(f[O.fog], f[O.fog + 1], f[O.fog + 2]); scene.fog.near = f[O.fogNear]; scene.fog.far = f[O.fogFar]; }
    if (scene.background?.isColor) scene.background.setRGB(f[O.bg], f[O.bg + 1], f[O.bg + 2]);
    this.ctx.renderer.toneMappingExposure = f[O.exposure];
    for (const m of this.far) m.color.setRGB(f[O.far], f[O.far + 1], f[O.far + 2]);
    this.ctx.fx.field("smoke").light.setRGB(f[O.haze], f[O.haze + 1], f[O.haze + 2]);
    if (this.dome) {
      const a = this.domeCol.array, Y = this.domeY;
      for (let i = 0; i < Y.length; i++) {
        const y = Y[i], hi = y > 0.25, u = hi ? (y - 0.25) / 0.75 : Math.max(0, y) / 0.25, o = hi ? O.mid : O.hor, t = hi ? O.top : O.mid;
        a[i * 3] = f[o] + (f[t] - f[o]) * u; a[i * 3 + 1] = f[o + 1] + (f[t + 1] - f[o + 1]) * u; a[i * 3 + 2] = f[o + 2] + (f[t + 2] - f[o + 2]) * u;
      }
      this.domeCol.needsUpdate = true;
    }
    this.dirty = false;
  }

  // Khói đống lửa tàn, cột khói lớn, lửa, tàn lửa, đèn lửa. bdt: bước đồng hồ trận.
  fires(bdt) {
    const ctx = this.ctx, fx = ctx.fx, h = ctx.hero, c = this.cur, og = ctx.openGates;
    const cols = c[O.cols], emb = c[O.embers], sm = c[O.smoke], smokeF = fx.field("smoke");
    let anyOpen = false; for (const id in og) if (og[id]) anyOpen = true;
    let best = null, bd = GLOW_R;
    for (const s of this.srcs) {
      const want = this.want(s, this.phase, cols, og, anyOpen);
      s.k = this.snapK ? want : s.k + Math.max(-bdt * 0.25, Math.min(bdt * 0.25, want - s.k));   // bén lửa dần trong ~4 s
      if (s.boat) { s.x = s.boat.position.x; s.z = s.boat.position.z; s.y = s.boat.position.y + 1.7; }
      if (s.k < 0.05 || bdt <= 0) continue;
      const dist = Math.hypot(s.x - h.x, s.z - h.z), lod = columnLOD(dist);
      if ((s.acc -= bdt * s.k) <= 0) { s.acc += COL_EVERY[lod] * (0.8 + 0.4 * Math.random()); if (smokeF.chan[1] < COL_CAP) fx.column(s.x, s.y + s.h, s.z, lod, s.k, s.col); }
      const gate = s.kind === "gate";
      if (s.fs > 0 && (s.facc -= bdt) <= 0) {                // fs ≤ 0: nguồn chỉ có khói (cột khói giao chiến B20)
        s.facc += FIRE_EVERY[lod] * (0.8 + 0.4 * Math.random());
        if (gate) gateFlame(fx, s, s.fs * FIRE_BIG[lod]);
        else fx.flame(s.x + (Math.random() - 0.5) * s.fw, s.y + 0.3, s.z + (Math.random() - 0.5) * s.fw, s.fs * FIRE_BIG[lod], s.k);
      }
      if (emb > 0.05 && dist < 45 && (s.eacc -= bdt * emb) <= 0) {
        s.eacc += 0.14;
        fx.ember(s.x, s.y + 1, gate ? s.z + (Math.random() < 0.5 ? -GATE_LEAF_Z : GATE_LEAF_Z) : s.z);   // cổng: tàn lửa bên cánh cửa, giữa lối trống
      }
      if (this.phase >= this.glowFrom && s.k > 0.3 && dist < bd) { bd = dist; best = s; }
    }
    this.snapK = false;
    // đống lửa tàn ở trại Nguyên (chỉ những đống trong 150 m; xa hơn 70 m thì thưa gấp đôi). Pha càng về sau
    // càng dày: nhịp ×(1 + (smoke − 1)/2), cụm to và đậm hơn (fx.pitSmoke) → P4 ≈ 3 lần khói của P1.
    this.pitT -= bdt;
    if (this.pits.length && this.pitT <= 0) {
      this.pitT += 0.6 / (1 + (sm - 1) * 0.5); this.pitTick++;
      const n = this.pits.length;
      for (let i = 0; i < n && smokeF.chan[0] < PIT_CAP; i++) {
        const p = this.pits[(i + this.pitTick) % n], dx = Math.abs(p.x - h.x), dz = Math.abs(p.z - h.z);   // xoay vòng điểm bắt đầu: chạm trần thì đống nào cũng có phần
        if (dx > 150 || dz > 150 || ((dx > 70 || dz > 70) && (this.pitTick & 1))) continue;
        fx.pitSmoke(p.x, p.y, p.z, sm);
        if (sm > 2 && dx < 60 && dz < 60) fx.flame(p.x, p.y - 1, p.z, 1.3, Math.min(1, sm - 2));   // từ P3 đống lửa bùng lại
      }
    }
    // đèn lửa: một PointLight bám đám cháy gần nhất trong GLOW_R m (P3, P4); đổi đám cháy thì tắt dần rồi dời
    const g = this.glow;
    if (g) {
      if (best !== this.glowSrc) { this.glowI = Math.max(0, this.glowI - bdt * GLOW_I * 2); if (this.glowI === 0) this.glowSrc = best; }
      else if (best) this.glowI += (GLOW_I * best.k - this.glowI) * Math.min(1, bdt * 2);
      const s = this.glowSrc, t = ctx.clock;
      if (s) g.position.set(s.x, s.y + 2.5, s.z);
      g.intensity = s ? this.glowI * (0.8 + 0.2 * Math.sin(t * 11.3 + 0.7) * Math.sin(t * 6.1 + 1.3)) : 0;
    }
  }
}
