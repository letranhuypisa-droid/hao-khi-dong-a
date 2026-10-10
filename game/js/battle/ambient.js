// battle/ambient.js — sự sống quanh bến Hàm Tử: đàn cò trắng kiếm ăn ở ô ruộng ngập và đầm ven sông
// bắc, đàn cò bay cao hình chữ V ngang trời, trâu gặm cỏ ở ruộng gốc rạ và bờ cỏ ven ruộng, trâu đằm
// trong ô ruộng ngập, trẻ chăn trâu đội nón lá ngồi lưng trâu thổi sáo, quạ nhảy quanh xác ngựa trên
// làn đánh. Toàn bộ Hư cấu, chỉ để nhìn: không va chạm, không trúng đòn, không ăn vào rng của trận (rng
// riêng, seed cố định). Chỉ có ở bản đồ Hàm Tử (Võ trường không dựng).
//
// Phản ứng với trận: tướng, lính vùng chiến đấu (vai trúng được đòn), tướng/sĩ quan (ctx.units) tới gần
// thì cò cất cánh so le, vỗ cánh lên cao, lượn một vòng rồi liệng xuống chỗ kiếm ăn khác cách mọi mối đe
// doạ ≥ 80 m; trâu chạy nước kiệu tránh (không bao giờ vào làn đánh, |z − làn| > 30 m); quạ bay vòng trên
// xác ngựa, yên thì đáp lại, bị quấy lâu thì sang xác ngựa khác. Đòn nặng làm rung màn (đòn C, Đòn Quyết,
// phá cổng, boss) doạ cò quanh tướng 45 m. Mọi chuyển động theo đồng hồ trận: hit-stop thì đứng hình,
// vòng Mệnh Lệnh thì chậm ×0,2.
//
// Vẽ: 7 lượt (thân chim, cổ + đầu cò, cánh, thân trâu, đầu trâu, "chi" — chân, tai, đuôi trâu, đầu + mỏ
// quạ, trẻ chăn trâu) + 1 lượt bóng (thân trâu). Ma trận instance tính trên CPU bằng affine 3×4 tự viết,
// ghi thẳng vào mảng instanceMatrix: không cấp phát trong vòng lặp khung.

import * as THREE from "three";
import { part, merge, lambert } from "./models.js";
import { heightAt, waterDist, paddyAt, ZONES, laneFeaturesOn } from "./world.js";
import { FRONTS, MAP, VILLAGE } from "../data/battle-b15.js";
import { LANE_TERRAIN } from "../data/terrain-b15.js";
import { rope } from "./ik.js";
import { makeRng } from "../core/rng.js";
import { envPart } from "./glb.js";

const TAU = Math.PI * 2, HALF_PI = Math.PI / 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// Math.hypot chậm (~50 ns, cấp phát) — cả file dùng hai hàm này (đợt 19c: cò, trâu, quạ trước đây gọi Math.hypot mỗi khung). Chỉ để nhìn.
const hyp = (x, z) => Math.sqrt(x * x + z * z), hyp3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const wrapA = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const LANES = Object.values(FRONTS).map((f) => f.laneZ);
const PZ = ZONES.paddy;

// ---- hằng số hình ảnh (không đổi lối chơi) --------------------------------------------------------
const ALARM = { egret: 22, buf: 25, crow: 11, bigHit: 45, bigHitBuf: 30, bigHitCrow: 30 };  // m
const REFUGE = 80;                                  // cò đáp chỗ cách mọi mối đe doạ ≥ 80 m
const VIEW_FAR = 330, SKY_FAR = 560;                // xa hơn thì không vẽ (sương dày, chỉ còn một chấm)
const CAP = { bird: 112, neck: 96, wing: 460, limb: 380, buf: 8, boy: 3 };
const EGRET_H = 0.58, CROW_H = 0.14;               // tâm thân trên mặt đất (m)
const EGRET_WALK = 0.32, EGRET_STEP = 0.2;          // cò lội: m/s, m mỗi bước
const BUF_SINK = 0.7;                              // trâu đằm: thân lún xuống bùn (m)
const FLEE_ANG = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7];
// pha bước 4 chân trâu (sau trái, trước trái, sau phải, trước phải): đi 4 nhịp; nước kiệu chéo cặp
const GAIT_WALK = [0, 0.25, 0.5, 0.75], GAIT_TROT = [0.5, 0, 0, 0.5];
// hạt giống vị trí: [x, z, 0 ruộng ngập | 1 đầm]
const FLOCK_SEEDS = [[218, 150, 0], [105, 130, 0], [336, 170, 0], [150, -152, 1], [345, -152, 1]];
// chỉ số trong LANE_TERRAIN.horses: tránh xác ngựa nằm giữa khối lính diễn lúc mở trận (tuyến B ở x ≈ 260)
const CROW_HORSES = [0, 2, 13, 14, 6];
const HERD = [
  { at: [205, 110], boy: true }, { at: [214, 162], wallow: true }, { at: [236, 111] }, { at: [352, 140], wallow: true },
  { at: [80, 150] }, { at: [336, 147] }, { at: [292, -142], boy: true }, { at: [334, -148] },
];

// trạng thái
const K_EGRET = 0, K_CROW = 1;                                         // loài
const G_FLOCK = 0, G_CROWS = 1, G_BUF = 2;                             // nhóm quét đe doạ
const B_GROUND = 0, B_WAIT = 1, B_FLY = 2, B_LAND = 3;                 // từng con chim
const F_GROUND = 0, F_CLIMB = 1, F_CIRCLE = 2, F_CRUISE = 3, F_GLIDE = 4, F_LAND = 5, F_SKY = 6, F_OFF = 7;  // cả đàn
const A_STAND = 0, A_WALK = 1, A_STALK = 2, A_STRIKE = 3, A_SWALLOW = 4, A_HOP = 5, A_PECK = 6;
const M_GRAZE = 0, M_WALK = 1, M_WALLOW = 2, M_RISE = 3, M_TROT = 4;   // trâu

const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const C_EGRET = [1.22, 1.2, 1.12], C_CROW = rgb(0x1e1d20), C_ELEG = rgb(0x2b2a25), C_CLEG = rgb(0x2a2723), C_CBEAK = rgb(0x34302b);
const C_BLEG = rgb(0x596068), C_EAR = rgb(0x687078), C_TAIL = rgb(0x50565d), C_TUFT = rgb(0x1f1e1d);

// ---- ma trận affine 3×4 theo hàng [r00 r01 r02 tx | r10 r11 r12 ty | r20 r21 r22 tz] ---------------
// Xoay R = Ry(yaw)·Rx(pitch)·Rz(roll); pitch dương = chúi mũi (+z) xuống, roll dương = +x lên.
const _L = new Float64Array(12), _pt = new Float64Array(3), _dir = new THREE.Vector3();
function rotInto(o, yaw, pitch, roll) {
  const ca = Math.cos(yaw), sa = Math.sin(yaw), cb = Math.cos(pitch), sb = Math.sin(pitch), cc = Math.cos(roll), sc = Math.sin(roll);
  o[0] = ca * cc + sa * sb * sc; o[1] = sa * sb * cc - ca * sc; o[2] = sa * cb;
  o[4] = cb * sc; o[5] = cb * cc; o[6] = -sb;
  o[8] = ca * sb * sc - sa * cc; o[9] = sa * sc + ca * sb * cc; o[10] = ca * cb;
}
function frame(M, x, y, z, yaw, pitch, roll) { rotInto(M, yaw, pitch, roll); M[3] = x; M[7] = y; M[11] = z; }
// out = P · T(ox, oy, oz) · R(yaw, pitch, roll)  (out ≠ P)
function sub(out, P, ox, oy, oz, yaw, pitch, roll) {
  rotInto(_L, yaw, pitch, roll);
  for (let r = 0; r < 12; r += 4) {
    const a = P[r], b = P[r + 1], c = P[r + 2];
    out[r] = a * _L[0] + b * _L[4] + c * _L[8];
    out[r + 1] = a * _L[1] + b * _L[5] + c * _L[9];
    out[r + 2] = a * _L[2] + b * _L[6] + c * _L[10];
    out[r + 3] = a * ox + b * oy + c * oz + P[r + 3];
  }
}
// soi gương qua mặt yz của khung cha (cánh trái = cánh phải lật x; vật liệu cánh hai mặt)
function mirrorX(out, P) { for (let i = 0; i < 12; i++) out[i] = P[i]; out[0] = -P[0]; out[4] = -P[4]; out[8] = -P[8]; }
function pt(M, x, y, z) {
  _pt[0] = M[0] * x + M[1] * y + M[2] * z + M[3]; _pt[1] = M[4] * x + M[5] * y + M[6] * z + M[7]; _pt[2] = M[8] * x + M[9] * y + M[10] * z + M[11];
  return _pt;
}
// khung cho một "chi" treo từ a tới b (lưới chi mọc dọc −y từ gốc). Trả về độ dài.
function limbTo(M, ax, ay, az, bx, by, bz) {
  let yx = ax - bx, yy = ay - by, yz = az - bz; const L = hyp3(yx, yy, yz) || 1e-6;
  yx /= L; yy /= L; yz /= L;
  let xx, xy, xz;
  if (Math.abs(yz) < 0.9) { xx = yy; xy = -yx; xz = 0; } else { xx = 0; xy = yz; xz = -yy; }
  const n = hyp3(xx, xy, xz) || 1; xx /= n; xy /= n; xz /= n;
  M[0] = xx; M[4] = xy; M[8] = xz;
  M[1] = yx; M[5] = yy; M[9] = yz;
  M[2] = xy * yz - xz * yy; M[6] = xz * yx - xx * yz; M[10] = xx * yy - xy * yx;
  M[3] = ax; M[7] = ay; M[11] = az;
  return L;
}
function put(im, i, M, sx, sy, sz) {
  const e = im.instanceMatrix.array, o = i * 16;
  e[o] = M[0] * sx; e[o + 1] = M[4] * sx; e[o + 2] = M[8] * sx; e[o + 3] = 0;
  e[o + 4] = M[1] * sy; e[o + 5] = M[5] * sy; e[o + 6] = M[9] * sy; e[o + 7] = 0;
  e[o + 8] = M[2] * sz; e[o + 9] = M[6] * sz; e[o + 10] = M[10] * sz; e[o + 11] = 0;
  e[o + 12] = M[3]; e[o + 13] = M[7]; e[o + 14] = M[11]; e[o + 15] = 1;
}
// khoảng cách từ (x, z) tới đoạn a → b trên mặt đất
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
  const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
  return hyp(x - ax - dx * t, z - az - dz * t);
}
function tint(im, i, c) { const a = im.instanceColor.array, o = i * 3; a[o] = c[0]; a[o + 1] = c[1]; a[o + 2] = c[2]; }
const MB = new Float64Array(12), MN = new Float64Array(12), MM = new Float64Array(12), MW = new Float64Array(12), MW2 = new Float64Array(12);
const MX = new Float64Array(12), MH = new Float64Array(12);

// ---- lưới low poly --------------------------------------------------------------------------------
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ico = (r = 1, d = 0) => new THREE.IcosahedronGeometry(r, d);
function seg(a, b, r0, r1, color, sides = 5) {                  // khúc trụ a → b (bán kính r0 ở a, r1 ở b)
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = hyp3(dx, dy, dz);
  const g = new THREE.CylinderGeometry(r1, r0, L, sides);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return part(g, color);
}
// thân chim (cò; quạ dùng chung, nhuộm đen bằng màu instance): tâm thân ở gốc, mặt hướng +z
function birdBodyGeo() {
  return merge([
    part(ico(), 0xffffff, { sx: 0.12, sy: 0.13, sz: 0.28 }),
    part(ico(), 0xffffff, { y: 0.035, z: 0.13, sx: 0.105, sy: 0.11, sz: 0.13 }),            // ức
    part(new THREE.ConeGeometry(0.07, 0.22, 4), 0xffffff, { y: 0.02, z: -0.31, rx: -HALF_PI, sz: 0.45 }),   // đuôi dẹt
  ]);
}
// cổ chữ S + đầu + mỏ vàng; gốc ở chân cổ
function egretNeckGeo() {
  const W = 0xf4f1e8, Y = 0xe2b43a;
  const p0 = [0, 0, 0], p1 = [0, 0.15, -0.035], p2 = [0, 0.28, 0.045], p3 = [0, 0.38, 0.03];
  return merge([
    seg(p0, p1, 0.042, 0.028, W), seg(p1, p2, 0.028, 0.025, W), seg(p2, p3, 0.025, 0.026, W),
    part(ico(), W, { y: 0.39, z: 0.045, sx: 0.036, sy: 0.04, sz: 0.06 }),
    part(new THREE.ConeGeometry(0.016, 0.15, 4), Y, { y: 0.383, z: 0.17, rx: HALF_PI }),
    part(box(0.075, 0.012, 0.012), 0x1c1b18, { y: 0.4, z: 0.07 }),                          // mắt
  ]);
}
// chi đơn vị: lăng trụ 5 cạnh thuôn, gốc ở y = 0, dài 1 dọc −y (chân cò, chân trâu, tai, đuôi, đầu quạ)
function limbGeo() { const g = new THREE.CylinderGeometry(0.5, 0.38, 1, 5); g.translate(0, -0.5, 0); return part(g, 0xffffff); }
// tấm cánh đơn vị: gốc x = 0 (dây cánh z 0,5 → −0,5), mút x = 1 (z 0,18 → −0,42), gờ giữa hơi nhô
function wingGeo() {
  const rL = [0, 0, 0.5], rT = [0, 0, -0.5], tL = [1, 0, 0.18], tT = [1, 0, -0.42], c = [0.42, 0.05, 0.02];
  const tri = [rL, c, rT, rT, c, tT, tT, c, tL, tL, c, rL], pos = new Float32Array(tri.length * 3);
  tri.forEach((p, i) => pos.set(p, i * 3));
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals();
  return part(g, 0xffffff);
}
// trâu đầm: xám đá, gốc ở mặt đất dưới tâm thân, mặt hướng +z
function buffaloBodyGeo() {
  const G = 0x687078, D = 0x5c636a, L = 0x747c84;
  const p = [
    part(new THREE.CylinderGeometry(0.5, 0.48, 1.5, 7), G, { y: 1.0, z: -0.02, rx: HALF_PI, sx: 0.95 }),   // bụng
    part(ico(), G, { y: 1.08, z: 0.62, sx: 0.47, sy: 0.52, sz: 0.5 }),                                   // ức, vai
    part(ico(), L, { y: 1.36, z: 0.4, sx: 0.36, sy: 0.24, sz: 0.52 }),                                   // u vai
    part(ico(), G, { y: 1.07, z: -0.66, sx: 0.47, sy: 0.46, sz: 0.47 }),                                 // mông
    part(box(0.1, 0.12, 0.14), G, { y: 1.24, z: -1.02 }),                                                  // gốc đuôi
  ];
  for (const s of [-1, 1]) p.push(part(box(0.22, 0.42, 0.34), D, { x: 0.27 * s, y: 0.84, z: 0.66 }), part(box(0.24, 0.46, 0.42), D, { x: 0.27 * s, y: 0.86, z: -0.66 }));
  return merge(p);
}
// cổ + đầu + sừng cánh cung vểnh ra sau; gốc ở chân cổ (khung thân: 0, 1,1, 0,95)
function buffaloHeadGeo() {
  const G = 0x687078, M = 0x7c7a74, P = 0xc2bca9, H = 0x948a78, T = 0x3d3833;
  const p = [
    part(box(0.42, 0.5, 0.62), G, { y: -0.02, z: 0.2, rx: 0.35 }),              // cổ
    part(box(0.44, 0.07, 0.26), P, { y: -0.3, z: 0.24, rx: 0.35 }),             // vạt trắng dưới cổ
    part(box(0.34, 0.34, 0.46), G, { y: -0.1, z: 0.66, rx: 0.55 }),             // sọ
    part(box(0.3, 0.26, 0.24), M, { y: -0.3, z: 0.9, rx: 0.55 }),               // mõm
    part(box(0.36, 0.03, 0.03), 0x151413, { y: -0.03, z: 0.74, rx: 0.55 }),     // mắt
  ];
  const arc = [[0.12, 0.1, 0.58], [0.34, 0.14, 0.56], [0.54, 0.18, 0.42], [0.65, 0.23, 0.2], [0.61, 0.3, -0.04], [0.46, 0.37, -0.17]];
  const rad = [0.09, 0.082, 0.07, 0.055, 0.04, 0.02];
  for (const s of [1, -1]) for (let k = 0; k < arc.length - 1; k++)
    p.push(seg([arc[k][0] * s, arc[k][1], arc[k][2]], [arc[k + 1][0] * s, arc[k + 1][1], arc[k + 1][2]], rad[k], rad[k + 1], k < 3 ? H : T, 5));
  return merge(p);
}
// trâu từ mẫu MOUNT_trau (dài 2,9 m cả đầu, lưng 1,5 m; mặt +z) ×1,05, tách như khối code: thân (bỏ bốn chân dưới bụng và đuôi — chân, đuôi vẫn là "chi"
// code bước, quất theo nhịp) và cổ + đầu + sừng (z mẫu > 0,66) xoay quanh chân cổ. Chân cổ mẫu (0, 1,15, 0,68) đặt đúng khớp đầu code (khung thân 0, 1,1,
// 0,95): chân code rơi dưới vai, mông mẫu, lưng mẫu ở 1,45 m (trẻ chăn trâu ngồi 1,5), gốc đuôi code ở mông mẫu. Tai có sẵn trên đầu mẫu (không vẽ tai code).
// Chưa nạp mẫu → null (khối code)
const BUF_S = 1.05, BUF_NECK_Y = 1.15, BUF_NECK_Z = 0.68;
function buffaloModel() {
  const s = BUF_S, cut = 0.66;
  const body = envPart("MOUNT_trau", { y: 1.1 - BUF_NECK_Y * s, z: 0.95 - BUF_NECK_Z * s, s, drop: [[1, -2, cut, -1, 0.5], [1, cut, 3, -1, 3], [1, -3, -1.29, -1, 3]] });
  const head = envPart("MOUNT_trau", { y: -BUF_NECK_Y * s, z: -BUF_NECK_Z * s, s, drop: [[1, -3, cut, -1, 3]] });
  return body && head ? { body, head } : null;
}
// trẻ chăn trâu: ngồi dạng chân trên lưng trâu, nón lá, thổi sáo ngang; gốc ở chỗ ngồi
function boyGeo() {
  const S = 0xc48f63, A = 0x5b4632, Q = 0x2b2926, N = 0xd8c48e, F = 0xb89a58;
  const p = [
    part(box(0.26, 0.12, 0.22), Q, { y: 0.02 }),
    part(box(0.26, 0.34, 0.16), A, { y: 0.24 }),
    part(ico(0.095, 1), S, { y: 0.5 }),
    part(new THREE.ConeGeometry(0.3, 0.17, 12), N, { y: 0.64 }),
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 4), F, { x: 0.1, y: 0.47, z: 0.19, rz: 1.35, ry: -0.35 }),
  ];
  for (const s of [-1, 1]) p.push(
    part(box(0.1, 0.3, 0.11), Q, { x: 0.19 * s, y: -0.07, z: 0.05, rz: 0.8 * s }),        // đùi ôm lưng trâu
    part(box(0.08, 0.3, 0.09), S, { x: 0.33 * s, y: -0.3, z: 0.08, rz: 0.12 * s }),      // cẳng chân buông
    part(box(0.07, 0.25, 0.07), A, { x: 0.15 * s, y: 0.3, z: 0.09, rx: -1.15, rz: -0.35 * s }),   // tay đưa sáo lên miệng
  );
  return merge(p);
}

export class Ambient {
  constructor(scene, ctx) {
    this.ctx = ctx; this.rng = makeRng(0x5a11); this.t = 0; this.last = ctx.clock; this.ms = 0; this.lastShake = 0; this.lastHs = 0; this.rr = 0;
    this.spX = 0; this.spZ = 0; this.camX = 0; this.camZ = 0; this.camFX = 0; this.camFZ = 1; this.camK = 1; this.thX = 0; this.thZ = 0;
    const mat = lambert(), wmat = lambert({ side: THREE.DoubleSide });
    const inst = (geo, n, m, colors) => {
      const im = new THREE.InstancedMesh(geo, m, n);
      im.frustumCulled = false; im.count = 0; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      if (colors) { im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      scene.add(im); return im;
    };
    this.mBird = inst(birdBodyGeo(), CAP.bird, mat, true);
    this.mNeck = inst(egretNeckGeo(), CAP.neck, mat, true);
    this.mWing = inst(wingGeo(), CAP.wing, wmat, true);
    const bm = buffaloModel(); this.bufModel = !!bm;
    this.mBuf = inst(bm ? bm.body : buffaloBodyGeo(), CAP.buf, mat, true); this.mBuf.castShadow = true; this.mBuf.receiveShadow = true;
    this.mHead = inst(bm ? bm.head : buffaloHeadGeo(), CAP.buf, mat, true); this.mHead.receiveShadow = true;
    this.mLimb = inst(limbGeo(), CAP.limb, mat, true);
    this.mBoy = inst(boyGeo(), CAP.boy, mat, false); this.mBoy.receiveShadow = true;
    this.meshes = [this.mBird, this.mNeck, this.mWing, this.mBuf, this.mHead, this.mLimb, this.mBoy];
    this.n = { bird: 0, neck: 0, wing: 0, buf: 0, head: 0, limb: 0, boy: 0 };

    this.buildSpots();
    const rng = this.rng;
    this.flocks = []; this.crows = []; this.herd = [];
    for (const [x, z, kind] of FLOCK_SEEDS) { const s = this.freeSpot(x, z, kind, 60); if (s) this.flocks.push(this.makeFlock(K_EGRET, rng.int(8, 14), s)); }
    this.sky = this.makeFlock(K_EGRET, rng.int(7, 11), null); this.sky.mode = F_OFF; this.sky.next = rng.range(6, 12);
    this.horses = LANE_TERRAIN.horses;
    // xác ngựa chỉ dựng khi bật công trình làn (scenery.js addLaneProps); ?nolanes thì không có quạ
    if (laneFeaturesOn()) for (const hi of CROW_HORSES) this.crows.push(this.makeCrows(hi, rng.int(3, 5)));
    const wallowUsed = new Set();
    for (const s of HERD) { const B = this.makeBuffalo(s, wallowUsed); if (B) this.herd.push(B); }
    this.groups = [...this.flocks, ...this.crows, ...this.herd];     // quét mối đe doạ lần lượt, vài nhóm mỗi khung
    this.vill = new Villagers(scene, ctx, this);                     // dân làng chạy loạn (lớp Villagers, cuối file)
  }

  // ---- chỗ kiếm ăn của cò ---------------------------------------------------------------------------
  // Ô ruộng ngập có mặt nước vẽ được (cùng điều kiện với scenery.js: cả ô nằm trọn trong vùng ruộng);
  // bãi đầm dọc bờ sông bắc (cách mép nước 5–26 m, phía tây tường Hàm Tử quan).
  buildSpots() {
    this.flooded = new Set(); this.spots = [];
    for (let i = 0; i * PZ.plotW < PZ.x1 - PZ.x0; i++) for (let j = 0; j * PZ.plotD < PZ.z1 - PZ.z0; j++) {
      const x0 = PZ.x0 + i * PZ.plotW, z0 = PZ.z0 + j * PZ.plotD, x1 = x0 + PZ.plotW, z1 = z0 + PZ.plotD;
      const p = paddyAt((x0 + x1) / 2, (z0 + z1) / 2);
      if (!p || p.kind !== 0 || z1 > 196) continue;
      if (!paddyAt(x0 + 0.5, z0 + 0.5) || !paddyAt(x1 - 0.5, z0 + 0.5) || !paddyAt(x0 + 0.5, z1 - 0.5) || !paddyAt(x1 - 0.5, z1 - 0.5)) continue;
      this.flooded.add(i * 64 + j);
      this.spots.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, kind: 0, r: 10, flock: null });
    }
    for (let x = 80; x <= 440; x += 24) {
      const z = MAP.riverNorthZ + 12 + this.rng.range(-2, 6);
      if (this.forageOk(x, z, 1)) this.spots.push({ x, z, kind: 1, r: 11, flock: null });
    }
  }
  forageOk(x, z, kind) {
    if (kind === 0) {
      if (x < PZ.x0 || x > PZ.x1 || z < PZ.z0 || z > PZ.z1) return false;
      const i = Math.floor((x - PZ.x0) / PZ.plotW), j = Math.floor((z - PZ.z0) / PZ.plotD);
      if (!this.flooded.has(i * 64 + j)) return false;
      const u = x - PZ.x0 - i * PZ.plotW, v = z - PZ.z0 - j * PZ.plotD;
      return u > 1 && u < PZ.plotW - 1 && v > 1 && v < PZ.plotD - 1;      // không đứng trên bờ ruộng
    }
    const d = waterDist(x, z);
    return d > 5 && d < 26 && x > 70 && x < 450 && z < 0;
  }
  freeSpot(x, z, kind, minSep) {
    let best = null, bd = Infinity;
    for (const s of this.spots) {
      if (s.kind !== kind || s.flock) continue;
      let ok = true; for (const o of this.spots) if (o.flock && hyp(o.x - s.x, o.z - s.z) < minSep) ok = false;
      const d = hyp(s.x - x, s.z - z);
      if (ok && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  // ---- chỗ của trâu -----------------------------------------------------------------------------------
  // Trâu ở dải nam (bờ cỏ ven ruộng, ruộng, bãi cỏ tây ruộng) hoặc dải đầm bắc; không vào làn đánh, dải
  // giữa hai làn (gò đá, hành lang xuất quân), sông, làng (sau lũy tre).
  bufOk(x, z) {
    if (z > 192 || x < 70 || x > 445 || Math.abs(z) < 45) return false;
    for (let i = 0; i < LANES.length; i++) if (Math.abs(z - LANES[i]) < 31) return false;
    const wd = waterDist(x, z);
    if (wd < 8 || (z < 0 && wd > 58)) return false;
    return hyp(x - VILLAGE.x, z - VILLAGE.z) > VILLAGE.r + 13;
  }
  pathOk(x0, z0, x1, z1) {
    const n = Math.ceil(hyp(x1 - x0, z1 - z0) / 4);
    for (let k = 1; k <= n; k++) if (!this.bufOk(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n)) return false;
    return true;
  }
  grazeOk(x, z) { if (!this.bufOk(x, z)) return false; const p = paddyAt(x, z); return !p || p.kind === 3; }   // gốc rạ hoặc cỏ, không giẫm lúa

  // ---- dựng đàn -------------------------------------------------------------------------------------
  bird(kind, F, x, z) {
    const rng = this.rng, gy = heightAt(x, z);
    return { kind, F, x, y: gy + (kind === K_EGRET ? EGRET_H : CROW_H), z, gy, gyT: gy, yaw: rng.range(0, TAU), pitch: -0.2, roll: 0,
      vx: 0, vy: 0, vz: 0, st: B_GROUND, act: A_STAND, actT: rng.range(0.2, 4), tx: x, tz: z, neck: 0.1, ns: 1, step: rng.next() * 4, walkA: 0,
      flapPh: rng.range(0, TAU), flapA: 0, flapR: 0, delay: 0, age: 0, ox: 0, oy: 0, oz: 0, sx: x, sz: z, sgy: gy, hop: 0, hx0: x, hz0: z,
      wob: rng.range(0, TAU), yawV: 0, hgT: 0 };
  }
  makeFlock(kind, n, spot) {
    const F = { type: G_FLOCK, kind, birds: [], spot, dest: null, mode: F_GROUND, x: spot ? spot.x : 0, z: spot ? spot.z : 0,
      lx: 0, ly: 0, lz: 0, lvx: 0, lvy: 0, lvz: 0, hd: 0, sp: 0, alt: 0, fleeHd: 0, modeT: 0, cx: 0, cz: 0, cr: 15, cdir: 1, cang: 0, turned: 0,
      calmT: 0, busyT: 0, next: 0, skyT: 0, skyAlt: 30, skySp: 11, glideT: 0 };
    if (spot) spot.flock = F;
    for (let k = 0; k < n; k++) {
      let x = F.x, z = F.z;
      if (spot) for (let t = 0; t < 30; t++) {
        const a = this.rng.range(0, TAU), r = Math.sqrt(this.rng.next()) * spot.r, xx = spot.x + Math.sin(a) * r, zz = spot.z + Math.cos(a) * r;
        if (this.forageOk(xx, zz, spot.kind)) { x = xx; z = zz; break; }
      }
      F.birds.push(this.bird(kind, F, x, z));
    }
    return F;
  }
  makeCrows(hi, n) {
    const h = this.horses[hi];
    const F = this.makeFlock(K_CROW, 0, null);
    F.type = G_CROWS; F.horse = hi; F.x = h.x; F.z = h.z;
    for (let k = 0; k < n; k++) {
      this.crowSpot(h, 0, Math.PI);
      const b = this.bird(K_CROW, F, this.spX, this.spZ);
      b.yaw = Math.atan2(h.x - b.x, h.z - b.z); F.birds.push(b);
    }
    return F;
  }
  // Chỗ đứng quanh xác ngựa (ghi vào spX, spZ): vòng 1,5–3,2 m quanh tâm, hướng a0 ± spread, tránh thân
  // ngựa — đoạn dọc thân lệch về phía chân, bán kính ~1 m (cùng số với va chạm xác ngựa ở scenery.js).
  crowSpot(h, a0, spread) {
    const rng = this.rng, fx = Math.sin(h.ry), fz = Math.cos(h.ry), lx = -fz * 0.3, lz = fx * 0.3;
    const ax = h.x - fx * 0.55 + lx, az = h.z - fz * 0.55 + lz, bx = h.x + fx * 0.75 + lx, bz = h.z + fz * 0.75 + lz;
    for (let k = 0; k < 8; k++) {
      const a = a0 + rng.range(-spread, spread), r = k < 7 ? rng.range(1.5, 3.2) : 3.2, x = h.x + Math.sin(a) * r, z = h.z + Math.cos(a) * r;
      if (k === 7 || segDist(x, z, ax, az, bx, bz) > 1.3) { this.spX = x; this.spZ = z; return; }
    }
  }
  makeBuffalo(s, wallowUsed) {
    const rng = this.rng; let x = s.at[0], z = s.at[1];
    if (s.wallow) {
      let best = null, bd = Infinity;
      for (const sp of this.spots) { const d = hyp(sp.x - x, sp.z - z); if (sp.kind === 0 && !wallowUsed.has(sp) && d < bd) { bd = d; best = sp; } }
      if (!best) return null;
      wallowUsed.add(best); x = best.x + rng.range(-3.5, 3.5); z = best.z + rng.range(-2, 2);
    } else {
      let ok = false;
      for (let t = 0; t < 240 && !ok; t++) {                              // quanh hạt giống 12 m, không được thì nới ra 35 m
        const R = t < 120 ? 12 : 35, xx = s.at[0] + rng.range(-R, R), zz = s.at[1] + rng.range(-R, R);
        if (this.grazeOk(xx, zz)) { x = xx; z = zz; ok = true; }
      }
      if (!ok) return null;
    }
    const gy = heightAt(x, z);
    return { type: G_BUF, x, z, gy, yaw: rng.range(0, TAU), pitch: 0, roll: 0, sx: Infinity, sz: 0, sink: s.wallow ? BUF_SINK : 0,
      mode: s.wallow ? M_WALLOW : M_GRAZE, t: rng.range(15, 45), tx: x, tz: z, sp: 0, ph: rng.next(), walkA: 0, bob: 0, trotK: 0,
      headP: s.wallow ? -0.1 : 0.98, headY: 0, headYT: 0, biteT: rng.range(0, 1.5), bite: 0, lookT: rng.range(4, 14), look: 0, shuffleT: rng.range(2, 6),
      earL: 0, earR: 0, earT: rng.range(1, 5), swishT: rng.range(1, 5), swish: 0, tail: new Float32Array(18),
      ropeOpt: { damp: 2.4, wind: [0, 0], floor: 0, reset: true, maxV: 14 }, tint: rgb(s.wallow ? 0xd4d6d8 : [0xffffff, 0xeef0f2, 0xf7f2ec][rng.int(0, 2)]),
      boy: !!s.boy, home: { x, z, wallow: !!s.wallow }, calmT: 99, alarmT: -9, threatX: 0, threatZ: 0, pitchT: 0, rollT: 0 };
  }

  // ---- mối đe doạ: tướng, tướng/sĩ quan, lính trúng được đòn (quạ: cả lính diễn ở tuyến) ----------------
  // Trả về khoảng cách tới mối gần nhất trong bán kính R (Infinity nếu không có); vị trí ở this.thX/thZ.
  scan(x, z, R, actors = false) {
    const ctx = this.ctx, crowd = ctx.crowd;
    let best = R * R, found = false, bx = 0, bz = 0;
    const h = ctx.hero;
    let dx = h.x - x, dz = h.z - z, d2 = dx * dx + dz * dz;
    if (d2 < best) { best = d2; bx = h.x; bz = h.z; found = true; }
    const U = ctx.units;
    for (let i = 0; i < U.length; i++) {
      const u = U[i]; if (!u.alive || u.dead) continue;
      dx = u.x - x; dz = u.z - z; d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bx = u.x; bz = u.z; found = true; }
    }
    const A = crowd.agents;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      dx = a.x - x; if (dx > R || dx < -R) continue;
      dz = a.z - z; if (dz > R || dz < -R) continue;
      if (!(crowd.hittable(a) || (actors && a.role === "actor" && a.state !== "dead"))) continue;
      d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bx = a.x; bz = a.z; found = true; }
    }
    this.thX = bx; this.thZ = bz;
    return found ? Math.sqrt(best) : Infinity;
  }
  // Đòn nặng (rung màn): cò quanh tướng 45 m, trâu và quạ 30 m giật mình.
  bigHit(x, z) {
    for (const F of this.flocks) if (F.mode === F_GROUND && hyp(F.x - x, F.z - z) < ALARM.bigHit) this.alarmEgrets(F, x, z);
    for (const F of this.crows) if (F.mode === F_GROUND && hyp(F.x - x, F.z - z) < ALARM.bigHitCrow) this.alarmCrows(F);
    for (const B of this.herd) if (hyp(B.x - x, B.z - z) < ALARM.bigHitBuf) this.alarmBuffalo(B, x, z);
    this.vill.bigHit(x, z);                                          // dân làng trong 45 m hoảng chạy
  }
  // Mỗi khung kiểm tra vài nhóm (≈ 10 lần/s mỗi nhóm ở 60 khung/s).
  watch(dt) {
    const G = this.groups; if (!G.length) return;
    const per = Math.ceil(G.length / 6);
    for (let k = 0; k < per; k++) {
      const g = G[this.rr = (this.rr + 1) % G.length];
      const since = this.t - (g.scanAt ?? this.t); g.scanAt = this.t;
      if (g.type === G_BUF) {
        const d = this.scan(g.x, g.z, ALARM.buf);
        if (d < ALARM.buf) { g.calmT = 0; this.alarmBuffalo(g, this.thX, this.thZ); } else g.calmT += since;
      } else if (g.type === G_FLOCK) {
        if (g.mode === F_GROUND) { if (this.scan(g.x, g.z, ALARM.egret + g.spot.r * 0.6) < Infinity) this.alarmEgrets(g, this.thX, this.thZ); }
        else if ((g.mode === F_CRUISE || g.mode === F_GLIDE) && g.dest && this.scan(g.dest.x, g.dest.z, 45) < Infinity) {
          const D = this.pickRefuge(g, g.dest); if (D && D !== g.dest) { g.dest.flock = null; g.dest = D; D.flock = g; g.mode = F_CRUISE; }
        }
      } else {
        const h = this.horses[g.horse];
        const d = this.scan(h.x, h.z, ALARM.crow + 5, true);
        if (g.mode === F_GROUND) { if (d < ALARM.crow + 2) this.alarmCrows(g); }
        else if (d < ALARM.crow + 5) { g.calmT = 0; g.busyT += since; } else g.calmT += since;
      }
    }
  }

  // ---- cò: cất cánh, tìm chỗ đáp ------------------------------------------------------------------------
  alarmEgrets(F, tx, tz) {
    if (F.mode !== F_GROUND) return;
    const rng = this.rng, D = this.pickRefuge(F, null);
    if (F.spot) F.spot.flock = null;
    F.dest = D; if (D) D.flock = F;
    F.fleeHd = Math.atan2(F.x - tx, F.z - tz) + rng.range(-0.35, 0.35);
    F.mode = F_CLIMB; F.modeT = 0; F.lx = F.x; F.lz = F.z; F.alt = 1; F.ly = heightAt(F.x, F.z) + 1; F.hd = F.fleeHd; F.sp = 2.5; F.turned = 0;
    let dMin = Infinity; for (const b of F.birds) dMin = Math.min(dMin, hyp(b.x - tx, b.z - tz));
    for (const b of F.birds) {
      b.st = B_WAIT; b.delay = clamp((hyp(b.x - tx, b.z - tz) - dMin) * 0.09, 0, 0.9) + rng.range(0, 0.45);
      b.ox = rng.range(-5, 5); b.oz = rng.range(-6, 3); b.oy = rng.range(-1.5, 1.5);
    }
  }
  // Chỗ kiếm ăn còn trống, không có mối đe doạ trong 80 m; ưu tiên cách chỗ cũ ~140 m.
  pickRefuge(F, cur) {
    let best = null, bs = Infinity, far = null, fd = -1;
    for (const s of this.spots) {
      if ((s.flock && s.flock !== F) || s === F.spot || s === cur) continue;
      const d = this.scan(s.x, s.z, REFUGE), dist = hyp(s.x - F.x, s.z - F.z);
      if (d === Infinity) { const sc = Math.abs(dist - 140) + this.rng.range(0, 50); if (sc < bs) { bs = sc; best = s; } }
      else if (d > fd) { fd = d; far = s; }
    }
    return best || far || cur;
  }
  startCircle(F, dir, r) {
    F.mode = F_CIRCLE; F.cdir = dir; F.cr = r; F.turned = 0;
    F.cx = F.lx + dir * r * Math.cos(F.hd); F.cz = F.lz - dir * r * Math.sin(F.hd);
    F.cang = F.hd - dir * HALF_PI;
  }
  startLanding(F) {
    const D = F.dest || F.spot, rng = this.rng; F.mode = F_LAND;
    if (F.type === G_CROWS) { const h = this.horses[F.horse]; F.x = h.x; F.z = h.z; }
    else { F.spot = D; F.x = D.x; F.z = D.z; F.dest = null; }
    for (const b of F.birds) {
      if (b.st !== B_FLY && b.st !== B_WAIT) continue;
      let sx = F.x, sz = F.z;
      for (let t = 0; t < 30; t++) {
        const a = rng.range(0, TAU);
        if (F.type === G_CROWS) { this.crowSpot(this.horses[F.horse], a, 0.3); sx = this.spX; sz = this.spZ; break; }
        const r = Math.sqrt(rng.next()) * D.r, xx = D.x + Math.sin(a) * r, zz = D.z + Math.cos(a) * r;
        if (this.forageOk(xx, zz, D.kind)) { sx = xx; sz = zz; break; }
      }
      b.sx = sx; b.sz = sz; b.sgy = heightAt(sx, sz); b.st = B_LAND;
    }
  }

  // ---- quạ ----------------------------------------------------------------------------------------------
  alarmCrows(F) {
    if (F.mode !== F_GROUND) return;
    F.mode = F_CLIMB; F.modeT = 0; F.lx = F.x; F.lz = F.z; F.alt = 1; F.ly = heightAt(F.x, F.z) + 1; F.hd = this.rng.range(0, TAU); F.fleeHd = F.hd; F.sp = 2;
    F.calmT = 0; F.busyT = 0; F.dest = null;
    for (const b of F.birds) { b.st = B_WAIT; b.delay = this.rng.range(0, 0.35); b.ox = this.rng.range(-3, 3); b.oz = this.rng.range(-3, 3); b.oy = this.rng.range(-1, 1.5); }
  }
  // Bay vòng trên xác ngựa tới khi yên 3 s thì đáp lại; bị quấy quá 14 s thì sang xác ngựa gần nhất còn yên.
  crowLeaderDecide(F) {
    if (F.calmT > 3) { F.mode = F_CRUISE; F.dest = F; return; }
    if (F.busyT > 14) {
      let best = -1, bd = Infinity; const h0 = this.horses[F.horse];
      for (let i = 0; i < this.horses.length; i++) {
        if (i === F.horse) continue;
        const h = this.horses[i], d = hyp(h.x - h0.x, h.z - h0.z);
        if (d < bd && this.scan(h.x, h.z, 22, true) === Infinity) { bd = d; best = i; }
      }
      F.busyT = 0;
      if (best >= 0) { F.horse = best; F.mode = F_CRUISE; F.dest = F; }
    }
  }

  // ---- vòng lặp -------------------------------------------------------------------------------------------
  update(clock) {
    const t0 = performance.now(), ctx = this.ctx;
    // Đòn nặng: rung màn vọt lên (≥ 0,2) hoặc hit-stop dài (> 80 ms, vd phản đòn). Xét cả khi đồng hồ đứng
    // (hit-stop), vì rung màn tắt theo giờ thật — chờ đồng hồ chạy lại thì đã lỡ; chim bay khi trận chạy tiếp.
    const sh = ctx.fx.shakeAmt, hs = ctx.hitstopT || 0;
    if ((sh >= 0.2 && sh > this.lastShake + 0.04) || (hs > 0.08 && !(this.lastHs > 0.08))) this.bigHit(ctx.hero.x, ctx.hero.z);
    this.lastShake = sh; this.lastHs = hs;
    let dt = clock - this.last; this.last = clock;
    if (!(dt > 0)) return;                          // hit-stop, trận đã xong: đứng hình, ma trận giữ nguyên
    if (dt > 0.1) dt = 0.1;
    this.t += dt;
    this.watch(dt);

    const n = this.n; n.bird = n.neck = n.wing = n.buf = n.head = n.limb = n.boy = 0;
    const C = ctx.camera, cam = C.position;
    C.getWorldDirection(_dir);
    const fl = hyp(_dir.x, _dir.z) || 1;
    this.camX = cam.x; this.camZ = cam.z; this.camFX = _dir.x / fl; this.camFZ = _dir.z / fl;
    this.camK = Math.tan(C.fov * Math.PI / 360) * C.aspect * 1.2 + 0.08;     // nửa góc nhìn ngang, nới 20%
    for (let i = 0; i < this.flocks.length; i++) this.updateFlock(this.flocks[i], dt, cam);
    for (let i = 0; i < this.crows.length; i++) this.updateFlock(this.crows[i], dt, cam);
    this.updateSky(dt, cam);
    for (let i = 0; i < this.herd.length; i++) this.updateBuffalo(this.herd[i], dt, cam);

    this.mBird.count = n.bird; this.mNeck.count = n.neck; this.mWing.count = n.wing; this.mBuf.count = n.buf;
    this.mHead.count = n.head; this.mLimb.count = n.limb; this.mBoy.count = n.boy;
    for (let i = 0; i < this.meshes.length; i++) { const m = this.meshes[i]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.ms += (performance.now() - t0 - this.ms) * 0.05;
    this.vill.update(dt);                                            // dân làng: đo JS riêng (vill.ms)
  }

  // ---- đàn chim: con đầu đàn ảo bay theo lộ trình, từng con bám theo chỗ của mình trong đội hình -------------
  updateLeader(F, dt) {
    const egret = F.kind === K_EGRET, D = F.dest;
    let bear = F.hd, dist = 0;
    if (D) { const dx = D.x - F.lx, dz = D.z - F.lz; dist = hyp(dx, dz); bear = Math.atan2(dx, dz); }
    let spT = 0, altT = 0;
    F.modeT += dt;
    switch (F.mode) {
      case F_CLIMB:
        F.hd += clamp(wrapA(F.fleeHd - F.hd), -dt, dt);
        spT = egret ? 7.5 : 5.5; altT = egret ? 12 : 7;
        if (F.modeT > (egret ? 3.2 : 1.3)) {
          if (egret) this.startCircle(F, Math.sign(wrapA(bear - F.hd)) || 1, 15);
          else { const h = this.horses[F.horse]; F.mode = F_CIRCLE; F.cx = h.x; F.cz = h.z; F.cr = 9; F.cdir = this.rng.chance(0.5) ? 1 : -1; F.cang = Math.atan2(F.lx - h.x, F.lz - h.z); F.turned = 0; }
        }
        break;
      case F_CIRCLE: {
        spT = egret ? 8.5 : 6; altT = egret ? 17 : 9;
        const w = F.cdir * Math.max(2, F.sp) / F.cr * dt; F.cang += w; F.turned += Math.abs(w);
        F.hd = F.cang + F.cdir * HALF_PI;
        const nx = F.cx + Math.sin(F.cang) * F.cr, nz = F.cz + Math.cos(F.cang) * F.cr;
        F.lvx = (nx - F.lx) / dt; F.lvz = (nz - F.lz) / dt; F.lx = nx; F.lz = nz;
        if (egret) { if ((F.turned > 5 && Math.abs(wrapA(bear - F.hd)) < 0.5) || F.turned > 9.5) F.mode = F_CRUISE; }
        else this.crowLeaderDecide(F);
        break;
      }
      case F_CRUISE:
        F.hd += clamp(wrapA(bear - F.hd), -0.8 * dt, 0.8 * dt);
        spT = egret ? 9.5 : 7; altT = egret ? 17 : 9;
        if (dist < (egret ? 60 : 24)) F.mode = F_GLIDE;
        break;
      case F_GLIDE: {
        const G = egret ? 60 : 24;
        F.hd += clamp(wrapA(bear - F.hd), -1.3 * dt, 1.3 * dt);
        spT = 2.5 + 6 * clamp(dist / G, 0, 1); altT = 1.2 + (egret ? 15 : 8) * clamp((dist - 6) / G, 0, 1);
        if (dist < (egret ? 10 : 5)) this.startLanding(F);
        break;
      }
      case F_LAND: spT = 0; altT = 0.5; break;
      case F_SKY: spT = F.skySp; altT = F.skyAlt; break;
    }
    // quạ: dest = chính đàn (F.x, F.z là xác ngựa đang nhắm)
    if (F.type === G_CROWS && F.dest === F) { const h = this.horses[F.horse]; F.x = h.x; F.z = h.z; }
    F.sp += (spT - F.sp) * Math.min(1, dt * 1.2);
    if (F.mode !== F_CIRCLE) { F.lvx = Math.sin(F.hd) * F.sp; F.lvz = Math.cos(F.hd) * F.sp; F.lx += F.lvx * dt; F.lz += F.lvz * dt; }
    F.alt += clamp(altT - F.alt, -3 * dt, 3.5 * dt);
    const ny = F.mode === F_SKY ? F.alt : heightAt(F.lx, F.lz) + F.alt;
    F.lvy = (ny - F.ly) / dt; F.ly = ny;
  }

  updateFlock(F, dt, cam) {
    if (F.mode !== F_GROUND) this.updateLeader(F, dt);
    let grounded = 0;
    const B = F.birds;
    for (let i = 0; i < B.length; i++) {
      const b = B[i];
      if (b.st === B_GROUND) { if (b.kind === K_EGRET) this.egretGround(b, F, dt); else this.crowGround(b, F, dt); grounded++; }
      else if (b.st === B_WAIT) this.birdWait(b, F, dt);
      else if (b.st === B_FLY) this.flyBird(b, F, dt);
      else this.landBird(b, dt);
      this.drawBird(b, cam, VIEW_FAR);
    }
    if (F.mode === F_LAND && grounded === B.length) { F.mode = F_GROUND; F.calmT = 0; F.busyT = 0; }
  }

  // Đàn cò bay cao ngang trời hình chữ V lỏng, lâu lâu một lượt (40–75 s), cắt ngang tầm nhìn phía trước.
  skyPass(px, pz, hd) {
    const F = this.sky, rng = this.rng, cam = this.ctx.camera.position, h = this.ctx.hero;
    if (px === undefined) {
      let fx = h.x - cam.x, fz = h.z - cam.z; const L = hyp(fx, fz) || 1; fx /= L; fz /= L;
      const d = rng.range(110, 190), side = rng.range(-50, 50);
      px = h.x + fx * d - fz * side; pz = h.z + fz * d + fx * side;
      hd = Math.atan2(fx, fz) + (rng.chance(0.5) ? 1 : -1) * rng.range(1.1, 2.0);
    }
    F.skySp = rng.range(10, 12.5); F.skyAlt = rng.range(26, 38); F.alt = F.skyAlt;
    F.hd = hd; F.lx = px - Math.sin(hd) * 380; F.lz = pz - Math.cos(hd) * 380; F.ly = F.alt; F.sp = F.skySp;
    F.lvx = Math.sin(hd) * F.sp; F.lvz = Math.cos(hd) * F.sp; F.lvy = 0;
    F.mode = F_SKY; F.skyT = 780 / F.sp; F.glideT = rng.range(2, 5);
    const ch = Math.cos(hd), sh = Math.sin(hd);
    F.birds.forEach((b, k) => {
      const rank = Math.ceil(k / 2), side = k % 2 ? 1 : -1;
      b.ox = side * rank * 2.3 + rng.range(-0.5, 0.5); b.oz = -rank * 1.9 + rng.range(-0.6, 0.6); b.oy = rng.range(-0.8, 0.8);
      b.x = F.lx + b.ox * ch + b.oz * sh; b.z = F.lz - b.ox * sh + b.oz * ch; b.y = F.ly + b.oy;
      b.vx = F.lvx; b.vy = 0; b.vz = F.lvz; b.yaw = hd; b.st = B_FLY; b.age = 9; b.flapA = 0.6; b.neck = -0.25; b.ns = 0.62;
    });
  }
  updateSky(dt, cam) {
    const F = this.sky;
    if (F.mode === F_OFF) { if (this.t > F.next) this.skyPass(); return; }
    F.skyT -= dt; F.glideT -= dt;
    if (F.glideT < -2.4) F.glideT = this.rng.range(3, 6);         // vỗ 3–6 s rồi liệng 2,4 s
    this.updateLeader(F, dt);
    for (let i = 0; i < F.birds.length; i++) { const b = F.birds[i]; this.flyBird(b, F, dt); this.drawBird(b, cam, SKY_FAR); }
    if (F.skyT <= 0) { F.mode = F_OFF; F.next = this.t + this.rng.range(40, 75); }
  }

  // ---- từng con chim ----------------------------------------------------------------------------------------
  egretGround(b, F, dt) {
    const rng = this.rng;
    b.actT -= dt;
    let neckT = 0.08, bodyT = -0.28, nsT = 1, rate = 3.5;
    switch (b.act) {
      case A_STAND: if (b.actT <= 0) this.egretNext(b, F); break;
      case A_WALK: {
        neckT = 0.32; bodyT = -0.12;
        const dx = b.tx - b.x, dz = b.tz - b.z, d = hyp(dx, dz);
        if (d < 0.05 || b.actT <= 0) { b.act = rng.chance(0.65) ? A_STALK : A_STAND; b.actT = rng.range(0.8, 2.8); break; }
        const dy = wrapA(Math.atan2(dx, dz) - b.yaw);
        b.yaw += clamp(dy, -2.5 * dt, 2.5 * dt);
        if (Math.abs(dy) < 0.6) { const s = Math.min(d, EGRET_WALK * dt); b.x += dx / d * s; b.z += dz / d * s; b.step += s / EGRET_STEP; }
        b.gy += (b.gyT - b.gy) * Math.min(1, dt * 1.5);
        break;
      }
      case A_STALK: neckT = 0.85; bodyT = 0.12; rate = 2;
        if (b.actT <= 0) { if (rng.chance(0.7)) { b.act = A_STRIKE; b.actT = 0.2; } else this.egretNext(b, F); }
        break;
      case A_STRIKE: neckT = 1.6; bodyT = 0.42; nsT = 1.28; rate = 26; if (b.actT <= 0) { b.act = A_SWALLOW; b.actT = 0.7; } break;
      case A_SWALLOW: neckT = 0.1 + 0.14 * Math.sin(b.actT * 22); bodyT = -0.2; rate = 9; if (b.actT <= 0) this.egretNext(b, F); break;
    }
    const k = Math.min(1, dt * rate);
    b.neck += (neckT - b.neck) * k; b.ns += (nsT - b.ns) * k; b.pitch += (bodyT - b.pitch) * Math.min(1, dt * (rate > 10 ? 14 : 3));
    b.walkA += ((b.act === A_WALK ? 1 : 0) - b.walkA) * Math.min(1, dt * 4);
    b.roll += (0 - b.roll) * Math.min(1, dt * 4);
    b.y = b.gy + EGRET_H;
  }
  egretNext(b, F) {
    const rng = this.rng;
    if (rng.chance(0.55)) {                          // lội vài bước sang chỗ khác trong ô
      for (let k = 0; k < 6; k++) {
        const a = b.yaw + rng.range(-1.7, 1.7), d = rng.range(0.8, 3.5), x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d;
        if (hyp(x - F.x, z - F.z) < F.spot.r && this.forageOk(x, z, F.spot.kind)) { b.tx = x; b.tz = z; b.gyT = heightAt(x, z); b.act = A_WALK; b.actT = 14; return; }
      }
    }
    b.act = rng.chance(0.5) ? A_STALK : A_STAND; b.actT = b.act === A_STALK ? rng.range(0.8, 2.5) : rng.range(1, 4);
  }
  crowGround(b, F, dt) {
    const rng = this.rng, h = this.horses[F.horse];
    b.actT -= dt;
    let bodyT = -0.12;
    if (b.act === A_HOP) {
      const u = clamp(1 - b.actT / 0.26, 0, 1);
      b.x = b.hx0 + (b.tx - b.hx0) * u; b.z = b.hz0 + (b.tz - b.hz0) * u; b.hop = 0.1 * Math.sin(Math.PI * u);
      b.gy = b.sgy + (b.gyT - b.sgy) * u; bodyT = -0.3;
      if (b.actT <= 0) { b.hop = 0; b.act = rng.chance(0.4) ? A_HOP : rng.chance(0.6) ? A_PECK : A_STAND; b.actT = b.act === A_PECK ? 0.9 : rng.range(0.4, 1.8); if (b.act === A_HOP) this.crowHop(b, h); }
    } else if (b.act === A_PECK) {
      b.yaw += clamp(wrapA(Math.atan2(h.x - b.x, h.z - b.z) - b.yaw), -6 * dt, 6 * dt);
      bodyT = Math.sin(b.actT * 21) > 0.2 ? 0.65 : 0.1;
      if (b.actT <= 0) { b.act = A_STAND; b.actT = rng.range(0.5, 2); }
    } else {
      if (rng.next() < dt * 0.8) b.yaw += rng.range(-0.8, 0.8);        // ngó quanh
      if (b.actT <= 0) { b.act = rng.chance(0.6) ? A_HOP : A_PECK; b.actT = b.act === A_PECK ? 0.9 : 0.26; if (b.act === A_HOP) this.crowHop(b, h); }
    }
    b.pitch += (bodyT - b.pitch) * Math.min(1, dt * 16);
    b.neck = 0; b.roll = 0;
    b.y = b.gy + CROW_H + b.hop;
  }
  crowHop(b, h) {
    this.crowSpot(h, Math.atan2(b.x - h.x, b.z - h.z), 0.7);
    b.hx0 = b.x; b.hz0 = b.z; b.tx = this.spX; b.tz = this.spZ; b.sgy = b.gy; b.gyT = heightAt(b.tx, b.tz);
    b.yaw = Math.atan2(b.tx - b.x, b.tz - b.z); b.actT = 0.26;
  }
  birdWait(b, F, dt) {
    // giật mình: vươn cổ, khom người, rồi bật lên
    b.delay -= dt;
    if (b.kind === K_EGRET) { b.neck += (-0.12 - b.neck) * Math.min(1, dt * 8); b.ns += (1.1 - b.ns) * Math.min(1, dt * 8); b.pitch += (-0.4 - b.pitch) * Math.min(1, dt * 8); b.y = b.gy + EGRET_H - (b.delay < 0.12 ? 0.07 : 0); }
    if (b.delay <= 0) {
      const ax = Math.sin(F.hd), az = Math.cos(F.hd);
      b.st = B_FLY; b.age = 0; b.vx = ax * 1.8; b.vz = az * 1.8; b.vy = b.kind === K_EGRET ? 3 : 3.6; b.flapA = 1; b.hop = 0;
    }
  }
  flyBird(b, F, dt) {
    const ch = Math.cos(F.hd), sh = Math.sin(F.hd), egret = b.kind === K_EGRET;
    const wob = F.mode === F_SKY ? 0.5 * Math.sin(this.t * 0.4 + b.wob) : 0;
    const tx = F.lx + (b.ox + wob) * ch + b.oz * sh, tz = F.lz - (b.ox + wob) * sh + b.oz * ch, ty = F.ly + b.oy;
    let vdx = F.lvx + (tx - b.x) * 0.9, vdy = F.lvy + (ty - b.y) * 1.2, vdz = F.lvz + (tz - b.z) * 0.9;
    const L = hyp3(vdx, vdy, vdz), vmax = egret ? 13 : 10;
    if (L > vmax) { vdx *= vmax / L; vdy *= vmax / L; vdz *= vmax / L; }
    const k = Math.min(1, dt * 2.2);
    b.vx += (vdx - b.vx) * k; b.vy += (vdy - b.vy) * k; b.vz += (vdz - b.vz) * k;
    if (b.age < 0.6) b.vy = Math.max(b.vy, egret ? 2.4 : 3);           // bật khỏi mặt nước, không lướt sát đất
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.age += dt;
    if ((b.hgT -= dt) <= 0) { b.gy = heightAt(b.x, b.z); b.hgT = 0.25; }
    const floor = b.gy + (egret ? EGRET_H : CROW_H) + 0.15;
    if (b.y < floor) { b.y = floor; if (b.vy < 0) b.vy = 0; }
    this.orient(b, dt);
    // vỗ cánh: mạnh khi vừa cất cánh, lên cao; đều khi bay bằng; liệng khi hạ độ cao, khi đàn V nghỉ cánh
    const glide = F.mode === F_GLIDE || (F.mode === F_SKY && F.glideT < 0 && b.age > 1) || (F.mode === F_CIRCLE && egret && b.vy < -0.3);
    const strong = b.age < 1.2 || b.vy > 0.9;
    const aT = glide ? 0.05 : strong ? 1 : 0.68, rT = egret ? (strong ? 3.1 : 2.3) : (strong ? 5.6 : 4.4);
    b.flapA += (aT - b.flapA) * Math.min(1, dt * 4); b.flapR = rT;
    b.flapPh += TAU * rT * dt * (glide ? 0.3 : 1);
    // cò rụt cổ, duỗi chân ra sau khi bay
    if (egret) { b.neck += (-0.25 - b.neck) * Math.min(1, dt * 3); b.ns += (0.62 - b.ns) * Math.min(1, dt * 3); }
  }
  landBird(b, dt) {
    const egret = b.kind === K_EGRET, H = egret ? EGRET_H : CROW_H;
    const dx = b.sx - b.x, dz = b.sz - b.z, d = hyp(dx, dz);
    const sp = Math.min(egret ? 7 : 5, d * 0.9 + 0.25), k = Math.min(1, dt * 3);
    b.vx += ((d > 1e-3 ? dx / d * sp : 0) - b.vx) * k; b.vz += ((d > 1e-3 ? dz / d * sp : 0) - b.vz) * k;
    b.vy = clamp((b.sgy + H + Math.min(12, d * 0.42) - b.y) * 2.2, -4.5, 3);
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.age += dt;
    this.orient(b, dt);
    const flare = d < 3.5;
    b.flapA += ((flare ? 1 : 0.35) - b.flapA) * Math.min(1, dt * 5); b.flapR = egret ? (flare ? 3.6 : 2.2) : (flare ? 6 : 4.4);
    b.flapPh += TAU * b.flapR * dt;
    if (flare) { b.pitch += (-0.55 - b.pitch) * Math.min(1, dt * 6); if (egret) b.neck += (0.05 - b.neck) * Math.min(1, dt * 4); }
    if (d < 0.25 && b.y - (b.sgy + H) < 0.12) {
      b.x = b.sx; b.z = b.sz; b.gy = b.gyT = b.sgy; b.y = b.sgy + H; b.vx = b.vy = b.vz = 0; b.st = B_GROUND; b.roll = 0;
      b.act = A_STAND; b.actT = this.rng.range(0.6, 2.5); b.hop = 0;
    }
  }
  // hướng thân theo vận tốc: nghiêng cánh khi rẽ, ngóc mũi khi lên
  orient(b, dt) {
    const hs = hyp(b.vx, b.vz);
    if (hs > 0.4) { const dy = wrapA(Math.atan2(b.vx, b.vz) - b.yaw), turn = clamp(dy, -3 * dt, 3 * dt); b.yaw += turn; b.yawV += (turn / dt - b.yawV) * Math.min(1, dt * 4); }
    b.roll += (clamp(-b.yawV * 0.45, -0.7, 0.7) - b.roll) * Math.min(1, dt * 4);
    if (b.st === B_FLY) b.pitch += (clamp(-Math.atan2(b.vy, Math.max(hs, 1)) * 0.7, -0.6, 0.45) - b.pitch) * Math.min(1, dt * 4);
  }

  // Trong tầm nhìn? Trả về khoảng cách tới camera, −1 nếu xa quá / sau lưng / ngoài góc nhìn ngang.
  // Con khuất góc không ghi ma trận (việc ghi ma trận là phần tốn nhất); logic vẫn chạy.
  vis(x, z, far) {
    const dx = x - this.camX, dz = z - this.camZ, d2 = dx * dx + dz * dz;
    if (d2 > far * far) return -1;
    if (d2 > 49) { const along = dx * this.camFX + dz * this.camFZ; if (along < 0 || Math.abs(dx * this.camFZ - dz * this.camFX) > along * this.camK + 4) return -1; }
    return Math.sqrt(d2);
  }
  drawBird(b, cam, far) {
    const n = this.n, dist = this.vis(b.x, b.z, far);
    if (dist < 0 || n.bird >= CAP.bird) return;
    const egret = b.kind === K_EGRET;
    frame(MB, b.x, b.y, b.z, b.yaw, b.pitch, b.roll);
    // quạ dùng chung thân cò, bóp lại cho mập, ngắn
    put(this.mBird, n.bird, MB, egret ? 1 : 0.76, egret ? 1 : 0.74, egret ? 1 : 0.56); tint(this.mBird, n.bird++, egret ? C_EGRET : C_CROW);
    const air = b.st === B_FLY || b.st === B_LAND, L = this.mLimb;
    if (egret) {
      if (n.neck < CAP.neck && dist < 240) { sub(MN, MB, 0, 0.07, 0.2, 0, b.neck, 0); put(this.mNeck, n.neck, MN, 1, b.ns, 1); tint(this.mNeck, n.neck++, C_EGRET); }
    } else if (n.limb + 2 <= CAP.limb && dist < 90) {                   // đầu, mỏ quạ
      sub(MN, MB, 0, 0.075, 0.13, 0, -HALF_PI, 0); put(L, n.limb, MN, 0.085, 0.1, 0.08); tint(L, n.limb++, C_CROW);
      sub(MN, MB, 0, 0.07, 0.225, 0, -HALF_PI + 0.12, 0); put(L, n.limb, MN, 0.028, 0.07, 0.022); tint(L, n.limb++, C_CBEAK);
    }
    // chân (mảnh 2 cm: xa quá 110 m thì dưới một điểm ảnh, bỏ)
    if (n.limb + 2 <= CAP.limb && dist < (egret ? 110 : 60)) {
      const hx = egret ? 0.045 : 0.03, hy = egret ? -0.07 : -0.045, th = egret ? 0.022 : 0.018, col = egret ? C_ELEG : C_CLEG;
      for (let s = -1; s <= 1; s += 2) {
        if (air) {
          if (!egret) continue;                                        // quạ co chân khi bay
          const trail = b.st === B_LAND && hyp(b.sx - b.x, b.sz - b.z) < 3 ? -0.35 : clamp(b.age * 1.2, 0.2, 1.35);
          sub(MX, MB, hx * s, hy, -0.03, 0, trail + 0.06 * s, 0); put(L, n.limb, MX, th, 0.5, th);
        } else {
          const sw = b.walkA * 0.34 * Math.sin(b.step * Math.PI) * s, lift = b.walkA * Math.max(0, -Math.cos(b.step * Math.PI) * s) * 0.1;
          const p = pt(MB, hx * s, hy, 0.01), hy0 = p[1];
          frame(MX, p[0], hy0, p[2], b.yaw, sw, 0);
          const len = clamp((hy0 - b.gy - lift) / Math.cos(sw), 0.05, 0.8);
          put(L, n.limb, MX, th, len, th);
        }
        tint(L, n.limb++, col);
      }
    }
    // cánh: hai khúc mỗi bên, bên trái soi gương
    if (air && n.wing + 4 <= CAP.wing) {
      const ph = b.flapPh, A = b.flapA;
      const flap = A * Math.sin(ph) + 0.1, bend = A * 0.7 * Math.sin(ph - 0.9) - 0.06, sweep = 0.14 + A * 0.12 * Math.cos(ph);
      const shx = egret ? 0.065 : 0.045, shy = egret ? 0.07 : 0.045, shz = egret ? 0.07 : 0.04;
      const s1 = egret ? 0.34 : 0.21, c1 = egret ? 0.3 : 0.19, s2 = egret ? 0.45 : 0.27, c2 = egret ? 0.25 : 0.16, col = egret ? C_EGRET : C_CROW;
      for (let side = 0; side < 2; side++) {
        const P = side ? (mirrorX(MM, MB), MM) : MB;
        sub(MW, P, shx, shy, shz, sweep, 0, flap); put(this.mWing, n.wing, MW, s1, 1, c1); tint(this.mWing, n.wing++, col);
        sub(MW2, MW, s1 * 0.94, 0, 0, sweep * 0.6, 0, bend); put(this.mWing, n.wing, MW2, s2, 1, c2); tint(this.mWing, n.wing++, col);
      }
    }
  }

  // ---- trâu ---------------------------------------------------------------------------------------------------
  alarmBuffalo(B, tx, tz) {
    B.threatX = tx; B.threatZ = tz; B.calmT = 0;
    // đang chạy thì chỉ đổi hướng khi bị áp sát; tìm chỗ tránh không được thì 2,5 s sau mới tìm lại
    if (B.mode === M_RISE || this.t - B.alarmT < 2.5) return;
    if (B.mode === M_TROT && hyp(tx - B.x, tz - B.z) > 12) return;
    B.alarmT = this.t;
    if (!this.pickFlee(B, tx, tz)) { B.look = 3; B.headYT = clamp(wrapA(Math.atan2(tx - B.x, tz - B.z) - B.yaw), -0.7, 0.7); return; }
    B.mode = B.sink > 0.1 ? M_RISE : M_TROT; B.t = 25;
  }
  pickFlee(B, tx, tz) {
    const base = Math.atan2(B.x - tx, B.z - tz);
    for (let i = 0; i < FLEE_ANG.length; i++) for (let r = 48; r >= 30; r -= 18) {
      const a = base + FLEE_ANG[i], x = B.x + Math.sin(a) * r, z = B.z + Math.cos(a) * r;
      if (!this.bufOk(x, z) || !this.pathOk(B.x, B.z, x, z) || this.scan(x, z, ALARM.buf) < Infinity) continue;
      B.tx = x; B.tz = z; return true;
    }
    return false;
  }
  // chỗ gặm mới quanh nhà (hoặc về nhà khi đã yên lâu)
  pickGraze(B) {
    const rng = this.rng, H = B.home;
    if (B.calmT > 30 && hyp(H.x - B.x, H.z - B.z) > 6 && this.pathOk(B.x, B.z, H.x, H.z)) { B.tx = H.x; B.tz = H.z; return true; }
    for (let k = 0; k < 10; k++) {
      const a = B.yaw + rng.range(-1.4, 1.4), d = rng.range(4, 12), x = B.x + Math.sin(a) * d, z = B.z + Math.cos(a) * d;
      if (hyp(x - H.x, z - H.z) > 22 && B.calmT > 30) continue;
      if (this.grazeOk(x, z) && this.pathOk(B.x, B.z, x, z)) { B.tx = x; B.tz = z; return true; }
    }
    return false;
  }
  updateBuffalo(B, dt, cam) {
    const rng = this.rng;
    B.t -= dt;
    let spT = 0, headT = 0.35, turnR = 1.1;
    switch (B.mode) {
      case M_GRAZE: {
        // cúi gặm, giật cỏ từng miếng, lâu lâu nhích vài bước, ngẩng lên nhìn quanh
        B.biteT -= dt; if (B.biteT <= 0) { B.biteT = rng.range(0.9, 1.8); B.bite = 1; }
        B.bite = Math.max(0, B.bite - dt * 4);
        B.lookT -= dt; if (B.lookT <= 0) { B.lookT = rng.range(9, 20); B.look = rng.range(1.8, 3.2); B.headYT = rng.range(-0.5, 0.5); }
        if (B.look > 0) { B.look -= dt; headT = 0.28; } else { headT = 0.98 + 0.08 * B.bite; if (rng.next() < dt * 0.3) B.headYT = rng.range(-0.3, 0.3); }
        B.shuffleT -= dt;
        if (B.shuffleT <= 0 && B.look <= 0) {
          B.shuffleT = rng.range(4, 9);
          const a = B.yaw + rng.range(-0.6, 0.6), d = rng.range(0.7, 1.6), x = B.x + Math.sin(a) * d, z = B.z + Math.cos(a) * d;
          if (this.bufOk(x, z)) { B.tx = x; B.tz = z; }
        }
        spT = 0.3;
        if (B.t <= 0) { B.t = rng.range(25, 50); if (this.pickGraze(B)) B.mode = M_WALK; }
        break;
      }
      case M_WALK:
        spT = 0.85; headT = 0.4;
        if (hyp(B.tx - B.x, B.tz - B.z) < 0.4) {
          const H = B.home;
          if (H.wallow && hyp(H.x - B.x, H.z - B.z) < 1) { B.mode = M_WALLOW; } else { B.mode = M_GRAZE; B.t = rng.range(20, 45); }
        }
        break;
      case M_WALLOW:
        // đằm: lún dần, ngóc mũi trên mặt nước, lắc đầu đuổi ruồi
        B.sink += (BUF_SINK - B.sink) * Math.min(1, dt * 0.5); headT = -0.1 + 0.05 * Math.sin(this.t * 0.7 + B.x);
        if (rng.next() < dt * 0.12) B.headYT = rng.range(-0.45, 0.45);
        break;
      case M_RISE:                                  // đứng dậy khỏi bùn rồi mới chạy
        B.sink = Math.max(0, B.sink - dt * 0.75); headT = 0.1;
        if (B.sink <= 0.02) { B.sink = 0; B.mode = M_TROT; }
        break;
      case M_TROT:
        spT = 2.6; headT = 0.12; turnR = 2.2;
        if (hyp(B.tx - B.x, B.tz - B.z) < 0.8 || B.t <= 0) { B.mode = M_GRAZE; B.t = rng.range(20, 40); B.look = 2; }
        break;
    }
    // đi tới (tx, tz): quay đầu trước, gần đúng hướng mới bước
    const dx = B.tx - B.x, dz = B.tz - B.z, d = hyp(dx, dz);
    let moved = 0;
    if (d > 0.15 && B.mode !== M_WALLOW && B.mode !== M_RISE) {
      const dy = wrapA(Math.atan2(dx, dz) - B.yaw);
      B.yaw += clamp(dy, -turnR * dt, turnR * dt);
      B.sp += ((Math.abs(dy) < 0.9 ? spT : spT * 0.25) - B.sp) * Math.min(1, dt * 2);
      moved = Math.min(d, B.sp * dt);
      B.x += Math.sin(B.yaw) * moved; B.z += Math.cos(B.yaw) * moved;
    } else B.sp += (0 - B.sp) * Math.min(1, dt * 3);
    const trot = B.mode === M_TROT;
    B.trotK += ((trot ? 1 : 0) - B.trotK) * Math.min(1, dt * 3);
    B.ph += moved / (trot ? 1.9 : 1.3);
    B.walkA += ((B.sp > 0.08 ? 1 : 0) - B.walkA) * Math.min(1, dt * 4);
    // bám dốc: tính lại khi đã đi quá 0,5 m
    if (Math.abs(B.x - B.sx) + Math.abs(B.z - B.sz) > 0.5) {
      B.sx = B.x; B.sz = B.z; B.gy = heightAt(B.x, B.z);
      const fx = Math.sin(B.yaw) * 0.9, fz = Math.cos(B.yaw) * 0.9;
      B.pitchT = -Math.atan((heightAt(B.x + fx, B.z + fz) - heightAt(B.x - fx, B.z - fz)) / 1.8) * (1 - B.sink / BUF_SINK);
      B.rollT = Math.atan((heightAt(B.x + fz * 0.5, B.z - fx * 0.5) - heightAt(B.x - fz * 0.5, B.z + fx * 0.5)) / 0.9) * 0.6;
    }
    B.pitch += ((B.pitchT || 0) - B.pitch) * Math.min(1, dt * 3); B.roll += ((B.rollT || 0) - B.roll) * Math.min(1, dt * 3);
    // đầu, tai, đuôi
    B.headP += (headT + 0.05 * B.walkA * Math.sin(B.ph * TAU * 2) - B.headP) * Math.min(1, dt * (trot ? 4 : 2.2));
    B.headY += ((B.mode === M_TROT ? 0 : B.headYT) - B.headY) * Math.min(1, dt * 1.5);
    B.earT -= dt; if (B.earT <= 0) { B.earT = rng.range(1.5, 6); if (rng.chance(0.5)) B.earL = 1; else B.earR = 1; }
    B.earL = Math.max(0, B.earL - dt * 5); B.earR = Math.max(0, B.earR - dt * 5);
    B.swishT -= dt; if (B.swishT <= 0) { B.swishT = rng.range(2.5, 7); B.swish = 1.3; }
    B.swish = Math.max(0, B.swish - dt);
    this.drawBuffalo(B, dt, cam);
  }
  drawBuffalo(B, dt, cam) {
    const n = this.n, dist = this.vis(B.x, B.z, VIEW_FAR);
    if (dist < 0 || n.buf >= CAP.buf) { B.ropeOpt.reset = true; return; }
    const walk = B.walkA, trot = B.trotK, cyc = B.ph * TAU, near = dist < 90 && n.limb + 9 <= CAP.limb;
    const bob = walk * ((1 - trot) * 0.025 * Math.sin(cyc * 2) + trot * 0.07 * Math.abs(Math.sin(cyc)));
    frame(MB, B.x, B.gy - B.sink + bob, B.z, B.yaw, B.pitch + walk * 0.015 * Math.sin(cyc * 2), B.roll + walk * (0.025 + 0.02 * trot) * Math.sin(cyc));
    put(this.mBuf, n.buf, MB, 1, 1, 1); tint(this.mBuf, n.buf++, B.tint);
    sub(MH, MB, 0, 1.1, 0.95, B.headY, B.headP, 0); put(this.mHead, n.head, MH, 1, 1, 1); tint(this.mHead, n.head++, B.tint);
    const L = this.mLimb;
    // tai: vẫy nhanh rồi rủ lại (tai, đuôi chỉ vẽ trong 90 m; đầu mẫu MOUNT_trau có tai sẵn)
    if (near && !this.bufModel) for (let s = -1; s <= 1; s += 2) {
      const f = s < 0 ? B.earL : B.earR;
      sub(MX, MH, 0.2 * s, -0.01, 0.6, 0, 0.5 * f * Math.sin(f * 14), s * (HALF_PI - 0.3 + 0.35 * f));
      put(L, n.limb, MX, 0.12, 0.21, 0.05); tint(L, n.limb++, C_EAR);
    }
    // chân: đi 4 nhịp (sau trái, trước trái, sau phải, trước phải); nước kiệu thì chéo cặp
    if (B.sink < 0.45 && n.limb + 4 <= CAP.limb) {
      for (let k = 0; k < 4; k++) {
        const front = k & 1, s = k < 2 ? -1 : 1;
        const off = (1 - trot) * GAIT_WALK[k] + trot * GAIT_TROT[k];
        const th = (B.ph + off) * TAU, amp = walk * (0.3 + 0.2 * trot);
        const sw = amp * Math.sin(th), lift = walk * Math.max(0, -Math.cos(th));
        sub(MX, MB, 0.27 * s, 0.82, front ? 0.68 : -0.66, 0, sw, 0);
        put(L, n.limb, MX, 0.21, 0.84 - 0.12 * lift, 0.23); tint(L, n.limb++, C_BLEG);
      }
    }
    // đuôi: dây 3 đốt treo ở mông, quất sang hai bên theo nhịp (gió ngang trong hệ thân trâu)
    if (B.sink < 0.3 && near && n.limb + 3 <= CAP.limb) {
      const a = pt(MB, 0, 1.2, -1.04), ax = a[0], ay = a[1], az = a[2];
      const o = B.ropeOpt, sw = B.swish > 0 ? 22 * Math.sin(B.swish * 11) * Math.min(1, B.swish) : 0;
      o.wind[0] = Math.cos(B.yaw) * sw - Math.sin(B.yaw) * 2 * trot; o.wind[1] = -Math.sin(B.yaw) * sw - Math.cos(B.yaw) * 2 * trot;
      o.floor = B.gy + 0.05;
      rope(B.tail, 3, ax, ay, az, 0.27, dt, o); o.reset = false;
      const P = B.tail;
      let px = ax, py = ay, pz = az;
      for (let k = 0; k < 3; k++) {
        const qx = P[k * 6], qy = P[k * 6 + 1], qz = P[k * 6 + 2], len = limbTo(MX, px, py, pz, qx, qy, qz);
        put(L, n.limb, MX, k === 2 ? 0.09 : 0.05, len, k === 2 ? 0.09 : 0.05); tint(L, n.limb++, k === 2 ? C_TUFT : C_TAIL);
        px = qx; py = qy; pz = qz;
      }
    } else B.ropeOpt.reset = true;
    // trẻ chăn trâu
    if (B.boy && B.sink < 0.2 && n.boy < CAP.boy) {
      sub(MX, MB, 0, 1.5 + bob * 0.5, -0.12, 0, -B.pitch * 0.6 - trot * 0.12, 0);
      put(this.mBoy, n.boy++, MX, 1, 1, 1);
    }
  }

  // Thông tin cho script kiểm thử (?debug): số lượt vẽ, số con, JS ms mỗi khung (trung bình trượt).
  info() {
    const n = this.n;
    return { draws: this.meshes.filter((m) => m.count > 0).length, shadowDraws: this.mBuf.count > 0 ? 1 : 0, ms: +this.ms.toFixed(3),
      birds: n.bird, wings: n.wing, limbs: n.limb, buffalo: n.buf, boys: n.boy,
      flocks: this.flocks.map((F) => ({ mode: F.mode, x: +F.x.toFixed(1), z: +F.z.toFixed(1), n: F.birds.length, lx: +F.lx.toFixed(1), lz: +F.lz.toFixed(1), ly: +F.ly.toFixed(1) })),
      crows: this.crows.map((F) => ({ mode: F.mode, horse: F.horse, n: F.birds.length })),
      herd: this.herd.map((B) => ({ mode: B.mode, x: +B.x.toFixed(1), z: +B.z.toFixed(1), boy: B.boy })), sky: this.sky.mode,
      vill: this.vill ? this.vill.info() : null };
  }
}

// =========================================================================================================
// ==== DÂN LÀNG CHẠY LOẠN (lớp Villagers; Ambient chỉ gọi qua this.vill: dựng, update, bigHit, info) ==========
// =========================================================================================================
// Chính sử: năm 1285 nhà Trần cho dân "vườn không nhà trống" — bỏ làng, mang lương ăn lánh đi trước khi quân
// Nguyên tràn tới. Hư cấu: những gia đình, lộ trình, giờ đi dưới đây.
//
// Từng nhà 2–6 người rời làng (từ cửa nhà ra cổng làng hướng bắc, vòng tây ngoài bờ ruộng, tới góc tây nam
// bản đồ) và rời bến cá ven sông (đi dọc bờ về tây) lúc mở trận và trong P1–P2: đàn ông gánh quang gánh (đòn
// trên vai, hai thúng đung đưa, nhún theo bước), đàn bà đội tay nải, ôm tay nải bên hông hoặc bế con ngồi hông,
// cụ già chống gậy lom khom, trẻ con xách bọc nhỏ. Đi nhanh, lâu lâu ngoái lại phía trận. Đánh nhau tới trong
// ~30 m (quét kiểu Ambient.scan, nhưng chỉ tính địch, quân đang ra đòn, tướng khi đang giao chiến — dân không
// sợ tướng nhà mình đi ngang) hay đòn nặng rung màn trong 45 m thì cả nhà hoảng chạy (giữ chặt đồ, che đầu,
// trẻ con vung tay), rẽ tránh, yên 4 s mới về lộ trình; lúc đi thường, đoạn đường phía trước có đánh nhau thì
// đi vòng. Không vào dải làn đánh (|z − làn| > 25 m), bản doanh, sông; không xuyên lũy tre, nhà, khóm tre.
// Tới mép bản đồ thì mờ dần (dither theo điểm ảnh) rồi mất. Lượt đi thưa dần: P1 dày, P2 thưa rồi thôi; từ
// P3 làng đã trống — ai còn trên đường thì vội đi, khuất tầm nhìn thì mờ ngay. Đầu P1 còn một nhà ngồi xổm
// trước cửa (vợ buộc tay nải, chồng ngồi dưới đòn gánh) rồi mới đứng dậy đi.
//
// Chỉ để nhìn: không phải tác tử của Crowd (không trúng đòn, không chặn đường, địch không thấy), không ăn vào
// rng của trận (rng của Ambient). Mọi số dưới đây là số hình ảnh, không đổi lối chơi.
// Vẽ: lưới skinned của lính (soldiers.js: DAN_NAM, DAN_NU, DAN_TRE) + đường ống soldierFrame (bước chân đặt
// đất, IK chân, vạt váy lò xo) với heightAt; đòn gánh, thúng, gậy, tay nải là khúc mượn (vạt, "tas") mà ma
// trận tính lại ở đây. 3 lượt vẽ + 1 lượt bóng tròn; đối tượng dân lấy từ pool, không cấp phát trong vòng khung.

import { skinnedKit, poseFor, soldierFrame, smoothPose, legRate, resetMotion, CH, NCH, BONE_FLOATS, BONE_TEX_W, JOINT_NAMES } from "./soldiers.js";
import { HAND, cycleLen } from "./soldier-motion.js";
import { blobGeometry } from "./models.js";

// Pha bước của dân: bản sao từng phép tính của advanceStride (soldier-motion.js) — hàm riêng (đợt 19c) để chỗ gọi trong soldier-motion chỉ
// gặp lính (class Agent của crowd.js, một kiểu đối tượng): dùng chung với dân (kiểu khác) thì V8 đọc trường số qua đường đa hình, mỗi lần
// đọc phải đóng hộp số thực (đo: 302 B mỗi lần gọi so với 24 B; ≈ 2,7 MB rác mỗi giây trận B15). Sửa advanceStride thì sửa cả ở đây.
function strideV(a, px, pz, dt) {
  const dx = a.x - px, dz = a.z - pz, moved = Math.sqrt(dx * dx + dz * dz);
  a.spd += (moved / dt - a.spd) * Math.min(1, dt * 10);
  const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw), horse = !!a.K.mounted;
  if (a.mvz === undefined) { a.mvx = 0; a.mvz = 1; }
  if (moved > 1e-6) {
    const k = Math.min(1, dt * 8);
    a.mvx += ((dx * cy - dz * sy) / moved - a.mvx) * k; a.mvz += ((dx * sy + dz * cy) / moved - a.mvz) * k;
  }
  const amp = Math.min(1, a.spd / (horse ? 5 : 3.2)), ml = Math.sqrt(a.mvx * a.mvx + a.mvz * a.mvz);
  const d = moved * TAU / (cycleLen(amp, ml > 0.2 ? a.mvx / ml : 0, horse) * a.scale);
  a.walk += horse && dx * sy + dz * cy < 0 ? -d : d;
}

const VJ = (n) => JOINT_NAMES.indexOf(n) * 12;
const J_PEL = VJ("pelvis"), J_TOR = VJ("torso"), J_FAR = VJ("faR"), J_FLF = VJ("flF"), J_FLB = VJ("flB"), J_TAS = VJ("tas");
const V_KITS = ["DAN_NAM", "DAN_NU", "DAN_TRE"];
const V_CAP = 20, V_MAX = 40;                      // chỗ mỗi lưới / tổng số dân còn trên bản đồ (kể cả con bế)
if (V_CAP * BONE_FLOATS / 4 > BONE_TEX_W) throw new Error("dân: texture khớp quá một hàng");
const V_LANE = 25 + 3;                            // |z − làn| > 25 m, cộng 3 m bề ngang đoàn
const V_ALARM = 30, V_CALM = 4, V_BIG = 45;        // hoảng khi đánh nhau trong 30 m / yên 4 s mới đi tiếp / đòn nặng 45 m
// không vẽ xa hơn V_DRAW; LOD theo khoảng cách camera (xem draw): gần ≤ V_LOD (tự co khi quá V_NEAR người gần)
const V_DRAW = 230, V_LOD = 28, V_MID = 80, V_NEAR = 6;
const V_FADE_IN = 0.8, V_FADE_OUT = 1.6, V_FADE_P3 = 0.6;
// từ P3: nhà nào không còn trong tầm nhìn (khuất góc hoặc xa hơn 90 m) thì mờ ngay; trong tầm thì vội đi, quá 30 s mờ
const V_SEEN = 90, V_P3_MAX = 30;
const V_STALL = 25;                                // s không tiến thêm trên lộ trình thì mờ đi (chỉ hình ảnh, xem moveGroup)
// lượt đi (giây đồng hồ trận giữa hai nhà): P1 dày, P2 thưa và thôi hẳn sau 150 s; từ P3 không còn ai
const V_WAVE = { first: 12, p1: [18, 30], p2: [32, 50], p2End: 150, p1Size: [3, 6], p2Size: [2, 4] };
const V_PACK = [34, 48];                           // nhà sửa soạn trước cửa đứng dậy đi sau 34–48 s
// làng → cổng bắc → vòng tây ngoài bờ ruộng → góc tây nam (điểm cuối ngoài mép bản đồ, mờ dần trên đường tới)
const V_ROUTE = [[173, 121], [174, 112], [176, 103], [150, 107], [86, 107], [40, 150], [16, 186], [-8, 208]];
const V_RIVER = [[60, -148], [12, -142], [-12, -140]];      // bến cá → dọc bờ về tây
const V_HUTS = [[-14, -8], [0, -14], [13, -6], [-10, 9], [9, 10], [22, 4]];   // nhà trong làng (world.js), so với tâm làng
const V_PIERS = [214, 318, 402];                   // bến gỗ (scenery.js)
// chỗ trong đoàn (m, [ngang phải, dọc trước] so với người dẫn): người gánh đi đầu, cụ già đi cuối
const V_SLOTS = [[0, 0], [0.85, -1.7], [-0.75, -2.1], [0.55, -3.7], [-0.6, -4.2], [0.2, -5.8], [-0.35, -7.1]];
// ngồi xổm, bàn chân phẳng: hông cao 0,36 thân (legIK tới bàn chân lệch trước 0,08)
const V_SQUAT = { hipY: -0.52, th: -1.23, kn: 2.45 };
const V_POLE = 1.72, V_STICK = 1.08, V_BASKET = 1.02;       // đòn gánh, gậy chống (thân); đáy thúng dưới đầu đòn
const V_K = { stable: false, windup: 1, heavy: false, mounted: false };

// vai trò: lưới, kit tư thế (soldier-motion.js), tốc đi / chạy (m/s), vóc, cúi người [đi, hoảng], ngoái tối đa (rad)
const R_GANH = 0, R_GIA = 1, R_DOI = 2, R_OM = 3, R_BE = 4, R_TRE = 5, R_BEBE = 6;
const ROLE = [
  { mesh: 0, pk: "DAN_NAM", walk: 1.45, run: 2.7, sc: [0.95, 1.02], lean: [0.1, 0.24], look: 0.32 },
  { mesh: 0, pk: "DAN_NAM_GAY", walk: 1.05, run: 1.75, sc: [0.88, 0.93], lean: [0.36, 0.46], look: 0.7 },
  { mesh: 1, pk: "DAN_NU", walk: 1.4, run: 2.8, sc: [0.9, 0.95], lean: [0.02, 0.12], look: 0.45 },
  { mesh: 1, pk: "DAN_NU_OM", walk: 1.3, run: 2.5, sc: [0.88, 0.94], lean: [0.08, 0.26], look: 0.75 },
  { mesh: 1, pk: "DAN_NU_BE", walk: 1.3, run: 2.4, sc: [0.9, 0.95], lean: [0.04, 0.18], look: 0.6 },
  { mesh: 2, pk: "DAN_TRE", walk: 1.4, run: 2.8, sc: [0.56, 0.66], lean: [0.04, 0.26], look: 0.9 },
  { mesh: 2, pk: "DAN_TRE_BE", walk: 0, run: 0, sc: [0.5, 0.54], lean: [0, 0], look: 0.8 },
];
const V_ORDER = [0, 9, 1, 1, 1, 2, 9];            // thứ tự trong đoàn theo vai trò
const VG_PACK = 0, VG_RISE = 1, VG_WALK = 2, VG_PANIC = 3, VG_EXIT = 4, VG_GONE = 5;

const _vp = new Float32Array(NCH), _VR = new Float64Array(12);
const mixCh = (P, c, v, e) => { P[c] += (v - P[c]) * e; };
function hideBone(mc, o) {
  for (let r = 0; r < 12; r += 4) { mc[o + r] = 0; mc[o + r + 1] = 0; mc[o + r + 2] = 0; }
  mc[o + 3] = mc[J_PEL + 3]; mc[o + 7] = mc[J_PEL + 7]; mc[o + 11] = mc[J_PEL + 11];
}
// khúc t = khung khúc o (đã gồm vóc) dời tới điểm (lx, ly, lz) của khung đó
function boneAt(mc, t, o, lx, ly, lz) {
  for (let r = 0; r < 12; r += 4) {
    mc[t + r] = mc[o + r]; mc[t + r + 1] = mc[o + r + 1]; mc[t + r + 2] = mc[o + r + 2];
    mc[t + r + 3] = mc[o + r] * lx + mc[o + r + 1] * ly + mc[o + r + 2] * lz + mc[o + r + 3];
  }
}
// con lắc tắt nhẹ (góc s[i], vận tốc góc s[i+1]) dài L, kéo bởi gia tốc ngang a của điểm treo
function pendulum(s, i, a, L, dt) {
  const n = Math.min(8, Math.ceil(dt * 60)), h = dt / n, w2 = 9.8 / L, c = 0.24 * Math.sqrt(w2);
  let th = s[i], om = s[i + 1];
  for (let k = 0; k < n; k++) { om += (-w2 * Math.sin(th) - c * om - a / L * Math.cos(th)) * h; th += om * h; }
  s[i] = clamp(th, -0.7, 0.7); s[i + 1] = om;
}
// Mờ theo điểm ảnh (Bayer 4 × 4) cho từng instance: aFade 0 = rõ, 1 = mất. Bọc onBeforeCompile của skinnedKit.
function ditherFade(m) {
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base(sh, r);
    sh.vertexShader = sh.vertexShader.replace("void main() {", "attribute float aFade;\nvarying float vFade;\nvoid main() {\n  vFade = aFade;");
    sh.fragmentShader = sh.fragmentShader.replace("void main() {", `varying float vFade;
float danBayer(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[q.x + q.y * 4] + 0.5) / 16.0;
}
void main() {
  if (vFade > 0.0 && danBayer(gl_FragCoord.xy) < vFade) discard;`);
  };
  m.customProgramCacheKey = () => "skinnedKitDanFade" + BONE_FLOATS;
}
function newPerson() {
  return { id: 0, rl: 0, kit: "", pk: "", mesh: 0, K: V_K, g: null, sx: 0, sz: 0, role: "villager", state: "move", st: 0,
    x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, scale: 1, spd: 0, walk: 0, mvx: 0, mvz: 1,
    ready: false, windup: 0, windupT: 1, atkT: 9, flinch: 0, blockT: 0, evadeT: 0, chargeT: 0, fleeT: 0, panicT: 0, cheer: 0,
    hitFront: 1, dieT: 0, launchDeath: false, sm: null, gx: NaN, gz: NaN, gy: 0, poseInit: false,
    pose: new Float32Array(NCH), mc: new Float32Array(BONE_FLOATS), tint: new Float32Array(3),
    bk: new Float64Array(16), stk: new Float64Array(6),
    fade: 1, fadeV: 0, pan: 0, look: 0, lookA: 0, lookT: 0, kneel: 0, lift: 1, bag: false, child: null, mother: null, dist: -1 };
}

class Villagers {
  constructor(scene, ctx, amb) {
    this.ctx = ctx; this.amb = amb; this.rng = amb.rng; this.t = 0; this.ms = 0; this.frame = 0; this.nextId = 1;
    this.groups = []; this.people = []; this.pool = []; this.rr = 0; this.nPersons = 0; this.flip = false; this.nb = 0;
    this.nextAt = V_WAVE.first; this.lastTime = 0; this.heroFight = false; this.heroT = 0; this.thX = 0; this.thZ = 0;
    this.lodR = V_LOD; this.nNear = 0;
    const mat = lambert();
    this.kits = V_KITS.map((k) => {
      const S = skinnedKit(k, V_CAP, mat);
      S.color = S.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(V_CAP * 3).fill(1), 3);
      S.color.setUsage(THREE.DynamicDrawUsage);
      S.fade = new THREE.InstancedBufferAttribute(new Float32Array(V_CAP), 1); S.fade.setUsage(THREE.DynamicDrawUsage);
      S.mesh.geometry.setAttribute("aFade", S.fade);
      ditherFade(S.mesh.material);
      S.mesh.visible = false; S.n = 0; scene.add(S.mesh);
      return S;
    });
    this.blob = new THREE.InstancedMesh(blobGeometry(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), V_MAX);
    this.blob.frustumCulled = false; this.blob.count = 0; this.blob.visible = false; this.blob.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.blob);
    this.buildColliders(ctx.world);
    this.opening();
  }

  // ---- vật cản: khóm tre, cây đa, xe (điểm trong world.colliders) + nhà trong làng; lưới ô 8 m ----------
  buildColliders(world) {
    const X0 = -48, Z0 = -200, C = 8, NX = 66, NZ = 55, list = [];
    for (const c of world.colliders) if (Math.abs(c.x1 - c.x0) + Math.abs(c.z1 - c.z0) < 0.05 && c.r < 2.5) list.push([c.x0, c.z0, c.r]);
    for (const [dx, dz] of V_HUTS) list.push([VILLAGE.x + dx, VILLAGE.z + dz, 2.4]);
    const cells = Array.from({ length: NX * NZ }, () => []);
    list.forEach(([x, z, r], k) => {
      for (let i = Math.floor((x - r - X0) / C); i <= Math.floor((x + r - X0) / C); i++) for (let j = Math.floor((z - r - Z0) / C); j <= Math.floor((z + r - Z0) / C); j++)
        if (i >= 0 && j >= 0 && i < NX && j < NZ) cells[j * NX + i].push(k);
    });
    const start = new Int32Array(NX * NZ + 1); let n = 0;
    cells.forEach((c, k) => { start[k] = n; n += c.length; }); start[NX * NZ] = n;
    const idx = new Int32Array(n); cells.forEach((c, k) => idx.set(c, start[k]));
    this.col = { X0, Z0, C, NX, NZ, start, idx, x: Float32Array.from(list, (c) => c[0]), z: Float32Array.from(list, (c) => c[1]), r: Float32Array.from(list, (c) => c[2]) };
  }
  pushOut(v) {
    const C = this.col, i = Math.floor((v.x - C.X0) / C.C), j = Math.floor((v.z - C.Z0) / C.C);
    if (i >= 0 && j >= 0 && i < C.NX && j < C.NZ) {
      const k = j * C.NX + i;
      for (let q = C.start[k]; q < C.start[k + 1]; q++) {
        const c = C.idx[q], dx = v.x - C.x[c], dz = v.z - C.z[c], m = C.r[c] + 0.3 * v.scale, d2 = dx * dx + dz * dz;
        if (d2 < m * m) { const d = Math.sqrt(d2) || 1e-3; v.x = C.x[c] + dx / d * m; v.z = C.z[c] + dz / d * m; }
      }
    }
    // lũy tre quanh làng: chỉ qua được ở cổng (lưới va chạm chỉ có một nửa số khóm)
    const dx = v.x - VILLAGE.x, dz = v.z - VILLAGE.z, d = hyp(dx, dz), r0 = VILLAGE.r + 3, r1 = VILLAGE.r + 11;
    if (d > r0 && d < r1 && !this.inGate(dx, dz)) { const r = d - r0 < r1 - d ? r0 : r1; v.x = VILLAGE.x + dx / d * r; v.z = VILLAGE.z + dz / d * r; }
  }
  inGate(dx, dz) { return Math.abs(wrapA(Math.atan2(dz, dx) + HALF_PI)) < 0.3; }
  // chỗ đoàn được đi: ngoài dải làn đánh, bản doanh, sông, trong bản đồ (điểm cuối lộ trình được ra ngoài mép), qua
  // lũy tre chỉ ở cổng
  okAt(x, z) {
    if (x < -30 || x > MAP.fortWallX - 14 || z > 226 || waterDist(x, z) < 5) return false;
    for (let i = 0; i < LANES.length; i++) if (Math.abs(z - LANES[i]) < V_LANE) return false;
    if (hyp(x - 34, z) < 36) return false;
    const dx = x - VILLAGE.x, dz = z - VILLAGE.z, d = hyp(dx, dz);
    return d <= VILLAGE.r + 2 || d >= VILLAGE.r + 12 || this.inGate(dx, dz);
  }

  // ---- mối đe doạ với dân: địch trúng được đòn, sĩ quan/boss địch, quân ta đang ra đòn / trúng đòn, tướng khi
  // đang giao chiến (cùng cách duyệt như Ambient.scan). Trả khoảng cách gần nhất trong R, vị trí ở thX/thZ.
  threat(x, z, R) {
    const ctx = this.ctx, crowd = ctx.crowd, h = ctx.hero;
    let best = R * R, found = false, bx = 0, bz = 0, dx, dz, d2;
    if (this.heroFight) { dx = h.x - x; dz = h.z - z; d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bx = h.x; bz = h.z; found = true; } }
    const U = ctx.units;
    for (let i = 0; i < U.length; i++) {
      const u = U[i]; if (!u.alive || u.dead || u.side !== "dich") continue;
      dx = u.x - x; dz = u.z - z; d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bx = u.x; bz = u.z; found = true; }
    }
    const A = crowd.agents;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      dx = a.x - x; if (dx > R || dx < -R) continue;
      dz = a.z - z; if (dz > R || dz < -R) continue;
      if (!crowd.hittable(a) || (a.side !== "dich" && !(a.windup > 0 || a.atkT < 0.5 || a.state === "hit"))) continue;
      d2 = dx * dx + dz * dz;
      if (d2 < best) { best = d2; bx = a.x; bz = a.z; found = true; }
    }
    this.thX = bx; this.thZ = bz;
    return found ? Math.sqrt(best) : Infinity;
  }
  // tướng đang giao chiến: đang ra đòn/né/đỡ/trúng đòn, hoặc có địch trong 12 m
  heroBusy() {
    const h = this.ctx.hero; if (!h.alive) return false;
    if (h.state !== "free") return true;
    const crowd = this.ctx.crowd, A = crowd.agents;
    for (let i = 0; i < A.length; i++) {
      const a = A[i]; if (a.side !== "dich") continue;
      const dx = a.x - h.x, dz = a.z - h.z;
      if (dx * dx + dz * dz < 144 && crowd.hittable(a)) return true;
    }
    return false;
  }
  // đòn nặng rung màn (Ambient.bigHit): nhà nào trong 45 m cũng hoảng
  bigHit(x, z) { for (let i = 0; i < this.groups.length; i++) { const g = this.groups[i]; if (hyp(g.x - x, g.z - z) < V_BIG) this.alarm(g, x, z); } }
  alarm(g, x, z) {
    g.thX = x; g.thZ = z; g.calmT = 0;
    if (g.mode === VG_PACK || g.mode === VG_RISE) { g.alarmed = true; this.standUp(g, true); return; }
    if (g.mode === VG_WALK) { g.mode = VG_PANIC; g.navT = 0; }
  }
  watch() {
    const G = this.groups; if (!G.length) return;
    const per = Math.ceil(G.length / 5);
    for (let k = 0; k < per; k++) {
      const g = G[this.rr = (this.rr + 1) % G.length];
      const since = this.t - g.scanAt; g.scanAt = this.t;
      if (g.mode === VG_EXIT || g.mode === VG_GONE) continue;
      if (this.threat(g.x, g.z, V_ALARM + 4) < V_ALARM + 4) this.alarm(g, this.thX, this.thZ);
      else if (g.mode === VG_PANIC && (g.calmT += since) > V_CALM) { g.mode = VG_WALK; g.navT = 0; }
    }
  }

  // ---- dựng nhà, lượt đi ---------------------------------------------------------------------------------
  person(rl, g, slot) {
    const v = this.pool.pop() || newPerson(), R = ROLE[rl], rng = this.rng, s = V_SLOTS[Math.min(slot, V_SLOTS.length - 1)];
    v.id = this.nextId++; v.rl = rl; v.kit = V_KITS[R.mesh]; v.pk = R.pk; v.mesh = R.mesh; v.g = g;
    v.sx = s[0] + rng.range(-0.25, 0.25); v.sz = s[1] + rng.range(-0.3, 0.3); v.scale = rng.range(R.sc[0], R.sc[1]);
    v.y = rl === R_BEBE ? 0.5 : 0; v.vx = v.vz = 0; v.spd = 0; v.walk = rng.range(0, TAU); v.mvx = 0; v.mvz = 1;
    v.ready = false; v.fleeT = 0; v.state = "move"; v.gx = NaN; v.poseInit = false;
    v.fade = 1; v.fadeV = -1 / V_FADE_IN; v.pan = 0; v.look = 0; v.lookA = 0; v.lookT = rng.range(1.5, 6); v.kneel = 0; v.lift = 1;
    v.bag = rl === R_TRE && rng.chance(0.5); v.child = null; v.mother = null; v.dist = -1;
    const k = rng.range(0.9, 1.12) * (rl === R_BEBE ? 1.3 : 1);     // con bế sáng hơn cho khỏi lẫn vào áo mẹ
    v.tint[0] = k; v.tint[1] = k * rng.range(0.94, 1.04); v.tint[2] = k * rng.range(0.9, 1.08);
    v.bk.fill(NaN); v.stk.fill(NaN);
    if (v.sm) resetMotion(v);
    this.nPersons++;
    if (rl === R_BE) { const c = this.person(R_BEBE, g, 0); v.child = c; c.mother = v; }
    return v;
  }
  family(n) {
    const rng = this.rng, out = [R_GANH]; let left = n - 1, gia = false;
    if (left >= 2 && rng.chance(0.5)) { out.push(R_BE); left -= 2; } else if (left > 0) { out.push(rng.chance(0.7) ? R_DOI : R_OM); left--; }
    while (left > 0) {
      const r = rng.next(); let k = r < 0.5 ? R_TRE : r < 0.68 ? R_DOI : r < 0.82 ? R_OM : R_GIA;
      if (k === R_GIA) { if (gia) k = R_TRE; gia = true; }
      out.push(k); left--;
    }
    return out.sort((a, b) => V_ORDER[a] - V_ORDER[b]);
  }
  // Nhà mới: người dẫn ở (x, z) hướng tới route[wi]; mọi người đứng theo chỗ trong đoàn (spread: rải quanh
  // người dẫn thay vì xếp hàng — vừa bước ra cửa). fade0 = 1: hiện dần.
  makeGroup(src, roles, x, z, route, wi, mode, spread, fade0) {
    const rng = this.rng, r = route[Math.min(wi, route.length - 1)], hd = Math.atan2(r[0] - x, r[1] - z);
    const g = { src, mode, x, z, hd, navHd: hd, sp: 0, vx: 0, vz: 0, route, wi, members: [], thX: 0, thZ: 0, calmT: 0, scanAt: this.t,
      navT: 0, blocked: false, packT: 0, alarmed: false, fast: false, hurry: false, p3T: 0, walkSp: 9, runSp: 9, lag: 0,
      stallWi: -1, best: Infinity, stallT: 0 };
    const ch = Math.cos(hd), sh = Math.sin(hd);
    roles.forEach((rl, k) => {
      const v = this.person(rl, g, k), R = ROLE[rl];
      if (spread > 0) { const a = rng.range(0, TAU), d = rng.range(0.6, spread); v.x = x + Math.sin(a) * d; v.z = z + Math.cos(a) * d; }
      else { v.x = x + v.sx * ch + v.sz * sh; v.z = z - v.sx * sh + v.sz * ch; }
      v.yaw = hd + rng.range(-0.4, 0.4); v.fade = fade0; v.fadeV = fade0 > 0 ? -1 / V_FADE_IN : 0;
      if (v.child) { v.child.fade = fade0; v.child.fadeV = v.fadeV; }
      g.walkSp = Math.min(g.walkSp, R.walk); g.runSp = Math.min(g.runSp, R.run);
      g.members.push(v); this.people.push(v);
    });
    this.groups.push(g);
    return g;
  }
  spawnVillage(n, hut = this.rng.int(0, V_HUTS.length - 1)) {
    const [hx, hz] = V_HUTS[hut];
    const L = hyp(hx, hz), x = VILLAGE.x + hx - hx / L * 3, z = VILLAGE.z + hz - hz / L * 3;     // trước cửa, phía sân làng
    return this.makeGroup(0, this.family(n), x, z, V_ROUTE, 0, VG_WALK, 1.6, 1);
  }
  // Chỉ lên ở bến mà điểm đầu lộ trình không có đánh nhau trong V_ALARM + 8 m. Bến 214 cách chốt giữ bờ Kế Sách
  // (192, −163) ~18 m: từ khi chiếm A1, toán giữ bờ đứng đó thì nhà lên bến này quanh quẩn mãi (navigate chặn mọi
  // hướng có địch trong 30 m, hoảng → yên → lại bị chặn). Bến nào cũng vướng thì cho nhà rời làng.
  spawnRiver(n) {
    const ok = V_PIERS.filter((px) => this.threat(px - 8, -151, V_ALARM + 8) === Infinity);    // vài lần mỗi phút: cấp phát không sao
    if (!ok.length) return this.spawnVillage(n);
    const px = ok[this.rng.int(0, ok.length - 1)];
    return this.makeGroup(1, this.family(n), px, -160, [[px - 8, -151], ...V_RIVER], 0, VG_WALK, 1.8, 1);
  }
  // Lúc mở trận: hai nhà đang trên đường làng, hai nhà ven sông, một nhà còn ngồi sửa soạn trước cửa.
  opening() {
    const rng = this.rng;
    this.makeGroup(0, [R_GANH, R_BE, R_TRE, R_GIA], 128, 107, V_ROUTE, 4, VG_WALK, 0, 0);
    this.makeGroup(0, [R_GANH, R_DOI, R_TRE], 174, 115, V_ROUTE, 2, VG_WALK, 0, 0);
    this.makeGroup(1, [R_GANH, R_DOI, R_OM, R_TRE], 300, -151, V_RIVER, 0, VG_WALK, 0, 0);
    this.makeGroup(1, [R_GANH, R_BE], 176, -150, V_RIVER, 0, VG_WALK, 0, 0);
    // nhà sửa soạn: chồng ngồi xổm dưới đòn gánh, vợ ngồi buộc tay nải, đứa con đứng ngó
    const [hx, hz] = V_HUTS[3], L = hyp(hx, hz), x = VILLAGE.x + hx - hx / L * 3.2, z = VILLAGE.z + hz - hz / L * 3.2;
    const g = this.makeGroup(0, [R_GANH, R_DOI, R_TRE], x, z, V_ROUTE, 0, VG_PACK, 0, 0);
    g.packT = rng.range(V_PACK[0], V_PACK[1]);
    const face = Math.atan2(-hx, -hz), fx = Math.sin(face), fz = Math.cos(face);
    g.members.forEach((v, k) => {
      v.x = x + fz * (k - 1) * 1.6 + fx * (k === 2 ? 1.2 : 0); v.z = z - fx * (k - 1) * 1.6 + fz * (k === 2 ? 1.2 : 0);
      v.yaw = face + (k === 2 ? 2.2 : k ? 0.5 : -0.4); v.kneel = k < 2 ? 1 : 0; v.lift = k === 1 ? 0 : 1;
    });
    this.nextAt = V_WAVE.first;
  }
  schedule(d) {
    const now = d.time, ph = d.phase;
    if (now < this.lastTime - 0.5) this.nextAt = now + 6;          // tải lại đầu pha: đồng hồ trận lùi
    this.lastTime = now;
    if (ph >= 2 || now < this.nextAt) return;
    const p2 = ph === 1;
    if (p2 && now - d.phaseStart > V_WAVE.p2End) return;
    const W = p2 ? V_WAVE.p2 : V_WAVE.p1, N = p2 ? V_WAVE.p2Size : V_WAVE.p1Size;
    this.nextAt = now + this.rng.range(W[0], W[1]);
    const n = this.rng.int(N[0], N[1]);
    if (this.nPersons + n + 1 > V_MAX) return;
    this.flip = !this.flip;
    if (this.flip) this.spawnVillage(n); else this.spawnRiver(Math.min(n, 5));
  }
  standUp(g, fast) { if (g.mode === VG_PACK || g.mode === VG_RISE) { g.mode = VG_RISE; g.fast = !!fast; } }
  fadeGroup(g, T) {
    for (let i = 0; i < g.members.length; i++) { const v = g.members[i]; if (v.fadeV <= 0) v.fadeV = 1 / T; if (v.child) v.child.fadeV = v.fadeV; }
    if (g.mode !== VG_EXIT) g.mode = VG_EXIT;
  }
  seen(g) { const M = g.members; for (let i = 0; i < M.length; i++) if (M[i].dist >= 0 && M[i].dist < V_SEEN) return true; return false; }

  // ---- vòng lặp -------------------------------------------------------------------------------------------
  update(dt) {
    const t0 = performance.now(), ctx = this.ctx, d = ctx.director;
    this.t += dt; this.frame++;
    if (d) this.schedule(d);
    if ((this.heroT -= dt) <= 0) { this.heroT = 0.25; this.heroFight = this.heroBusy(); }
    this.watch();
    const ph = d ? d.phase : 0;
    for (let i = 0; i < this.groups.length; i++) this.moveGroup(this.groups[i], dt, ph);
    for (let i = 0; i < this.people.length; i++) this.step(this.people[i], dt);

    // vẽ
    const K = this.kits, clk = ctx.clock, kSoft = 1 - Math.exp(-dt * 18);
    K[0].n = K[1].n = K[2].n = 0; this.nb = 0; this.nNear = 0;
    for (let i = 0; i < this.people.length; i++) this.draw(this.people[i], dt, clk, kSoft);
    // quá V_NEAR người trong vòng gần thì co vòng lại (người gần camera nhất vẫn giữ IK), ít thì nới dần ra V_LOD
    this.lodR = this.nNear > V_NEAR ? Math.max(8, this.lodR * 0.85) : Math.min(V_LOD, this.lodR * 1.02 + 0.05);
    for (let k = 0; k < 3; k++) {
      const S = K[k], n = S.n;
      S.mesh.count = n; S.mesh.visible = n > 0;
      // texture khớp của V_CAP người chỉ có một hàng (kiểm ở đầu phần này): tải cả, khỏi dựng khoảng cập nhật mỗi khung
      if (n) { S.tex.needsUpdate = true; S.color.needsUpdate = true; S.fade.needsUpdate = true; }
    }
    this.blob.count = this.nb; this.blob.visible = this.nb > 0; this.blob.instanceMatrix.needsUpdate = true;

    // dọn nhà đã đi hết (đổi chỗ với phần tử cuối, không cấp phát)
    for (let i = this.people.length - 1; i >= 0; i--) {
      const v = this.people[i];
      if (!(v.fade >= 1 && v.fadeV > 0)) continue;
      if (v.child) { this.pool.push(v.child); v.child.g = null; this.nPersons--; v.child = null; }
      v.g = null; this.pool.push(v); this.nPersons--;
      this.people[i] = this.people[this.people.length - 1]; this.people.pop();
    }
    for (let i = this.groups.length - 1; i >= 0; i--) {
      const g = this.groups[i]; let alive = 0;
      for (let k = 0; k < g.members.length; k++) if (g.members[k].g === g) alive++;
      if (alive) continue;
      g.mode = VG_GONE; this.groups[i] = this.groups[this.groups.length - 1]; this.groups.pop();
    }
    this.ms += (performance.now() - t0 - this.ms) * 0.05;
  }

  // Người dẫn (điểm ảo) đi theo lộ trình hoặc chạy tránh; mọi người bám chỗ của mình quanh điểm đó.
  moveGroup(g, dt, ph) {
    if (g.mode === VG_GONE) return;
    if (ph >= 2 && !g.hurry) { g.hurry = true; this.standUp(g, true); }
    if (g.hurry && g.mode !== VG_EXIT) { g.p3T += dt; if (g.p3T > V_P3_MAX || (g.p3T > 0.5 && !this.seen(g))) this.fadeGroup(g, V_FADE_P3); }
    if (g.mode === VG_PACK) { if ((g.packT -= dt) <= 0) this.standUp(g, false); g.vx = g.vz = 0; return; }
    if (g.mode === VG_RISE) {
      let done = true;
      for (let i = 0; i < g.members.length; i++) if (g.members[i].kneel > 0 || g.members[i].lift < 1) done = false;
      g.vx = g.vz = 0;
      if (done) { g.mode = g.alarmed ? VG_PANIC : VG_WALK; g.navT = 0; }
      return;
    }
    const panic = g.mode === VG_PANIC, R = g.route;
    // điểm lộ trình: tới gần 4 m thì sang điểm sau; đã vượt qua (bị dồn chạy tắt) thì bỏ qua
    while (g.wi < R.length) {
      const p = R[g.wi], dd = hyp(p[0] - g.x, p[1] - g.z);
      if (dd < 4) { g.wi++; continue; }
      if (g.wi + 1 < R.length) { const q = R[g.wi + 1]; if (hyp(q[0] - g.x, q[1] - g.z) < hyp(q[0] - p[0], q[1] - p[1]) - 2) { g.wi++; continue; } }
      break;
    }
    // tới mép bản đồ (mép tây x 0, mép nam z 200): mờ dần trong lúc vẫn bước tiếp ra ngoài
    if (g.mode !== VG_EXIT && (g.wi >= R.length || g.x < 4 || g.z > 195)) this.fadeGroup(g, V_FADE_OUT);
    // kẹt: quá V_STALL s không tới gần điểm lộ trình thêm 1 m (bị đánh nhau chặn, hoảng rồi lại bị chặn) thì mờ đi
    // — người đã tìm đường khác; khỏi đi vòng quẩn trước mắt người chơi và giữ chỗ V_MAX
    if (g.mode === VG_WALK || g.mode === VG_PANIC) {
      const q = R[Math.min(g.wi, R.length - 1)], dq = hyp(q[0] - g.x, q[1] - g.z);
      if (g.wi !== g.stallWi || dq < g.best - 1) { g.stallWi = g.wi; g.best = dq; g.stallT = 0; }
      else if ((g.stallT += dt) > V_STALL) this.fadeGroup(g, this.seen(g) ? V_FADE_OUT : V_FADE_P3);
    }
    if ((g.navT -= dt) <= 0) { g.navT = panic ? 0.25 : 0.45; this.navigate(g); }
    let tgt = g.blocked ? 0 : panic || g.hurry ? g.runSp : g.walkSp;
    if (g.lag > 2.5) tgt *= clamp(1 - (g.lag - 2.5) / 4, 0.25, 1);          // chờ người chậm (cụ già, trẻ con)
    g.sp += (tgt - g.sp) * Math.min(1, dt * (panic ? 3 : 1.5));
    const tr = (panic ? 2.6 : 1.3) * dt;
    g.hd += clamp(wrapA(g.navHd - g.hd), -tr, tr);
    const nx = g.x + Math.sin(g.hd) * g.sp * dt, nz = g.z + Math.cos(g.hd) * g.sp * dt;
    if (g.mode === VG_EXIT || this.okAt(nx, nz)) { g.vx = (nx - g.x) / dt; g.vz = (nz - g.z) / dt; g.x = nx; g.z = nz; }
    else { g.vx = g.vz = 0; g.sp *= 0.5; g.navT = 0; }
  }
  // Chọn hướng: hoảng thì chạy xa mối đe doạ (nghiêng về phía lối ra nếu được); đi thường thì thẳng tới điểm lộ
  // trình, đoạn trước mặt vướng ô cấm hay có đánh nhau thì lệch dần (như trâu tránh, FLEE_ANG); hết cách thì đứng chờ.
  navigate(g) {
    const R = g.route, p = R[Math.min(g.wi, R.length - 1)];
    let tdx = p[0] - g.x, tdz = p[1] - g.z; const td = hyp(tdx, tdz) || 1; tdx /= td; tdz /= td;
    g.blocked = false;
    if (g.mode === VG_EXIT) { if (g.wi < R.length) g.navHd = Math.atan2(tdx, tdz); return; }
    if (g.mode === VG_PANIC) {
      let ax = g.x - g.thX, az = g.z - g.thZ; const ad = hyp(ax, az) || 1; ax /= ad; az /= ad;
      const base = Math.atan2(ax, az); let best = -Infinity, bh = base;
      for (let i = 0; i < FLEE_ANG.length; i++) {
        const h = base + FLEE_ANG[i], s = Math.sin(h), c = Math.cos(h);
        if (!this.okAt(g.x + s * 5, g.z + c * 5) || !this.okAt(g.x + s * 14, g.z + c * 14)) continue;
        const sc = s * ax + c * az + 0.5 * (s * tdx + c * tdz);
        if (sc > best) { best = sc; bh = h; }
      }
      if (best === -Infinity) g.blocked = true; else g.navHd = bh;
      return;
    }
    const base = Math.atan2(tdx, tdz), far = clamp(td, 6, 18);
    for (let i = 0; i < FLEE_ANG.length; i++) {
      const h = base + FLEE_ANG[i], s = Math.sin(h), c = Math.cos(h);
      if (!this.okAt(g.x + s * 5, g.z + c * 5) || !this.okAt(g.x + s * far, g.z + c * far)) continue;
      if (this.threat(g.x + s * far, g.z + c * far, V_ALARM) < Infinity || this.threat(g.x + s * 6, g.z + c * 6, V_ALARM) < Infinity) continue;
      g.navHd = h; return;
    }
    g.blocked = true;
  }

  // Một người: bám chỗ trong đoàn, tránh vật cản, pha bước theo quãng đi, ngoái lại, ngồi xổm / đứng dậy.
  step(v, dt) {
    const g = v.g, R = ROLE[v.rl], rng = this.rng, panic = g.mode === VG_PANIC;
    v.pan += ((panic ? 1 : 0) - v.pan) * Math.min(1, dt * (panic ? 5 : 0.8));
    v.ready = v.pan > 0.5; v.fleeT = v.rl === R_TRE && v.ready ? 1 : 0;
    if (v.fadeV) { v.fade = clamp(v.fade + v.fadeV * dt, 0, 1); if (v.fade <= 0 && v.fadeV < 0) v.fadeV = 0; if (v.child) { v.child.fade = v.fade; v.child.fadeV = v.fadeV; } }
    const px = v.x, pz = v.z;
    if (g.mode !== VG_PACK && (v.kneel > 0 || v.lift < 1)) {            // đứng dậy, nhấc tay nải lên đầu
      const f = g.fast || g.hurry ? 2.8 : 1.1;
      v.kneel = Math.max(0, v.kneel - dt * f);
      if (v.kneel < 0.5) v.lift = Math.min(1, v.lift + dt * f * 1.2);
    }
    if (g.mode === VG_PACK || g.mode === VG_RISE) v.vx = v.vz = 0;
    else {
      const ch = Math.cos(g.hd), sh = Math.sin(g.hd);
      let sx = v.sx; if (panic) sx += Math.sin(this.t * 1.7 + v.id) * 0.6;
      const tx = g.x + sx * ch + v.sz * sh, tz = g.z - sx * sh + v.sz * ch;
      const vmax = (panic || g.hurry ? R.run : R.walk) * 1.25 * (this.amb.forageOk(v.x, v.z, 0) ? 0.6 : 1);   // lội ruộng ngập thì chậm
      let dvx = g.vx + (tx - v.x) * 1.5, dvz = g.vz + (tz - v.z) * 1.5;
      const dl = hyp(dvx, dvz); if (dl > vmax) { dvx *= vmax / dl; dvz *= vmax / dl; }
      const acc = (panic ? 6 : 2.5) * dt; let ex = dvx - v.vx, ez = dvz - v.vz; const el = hyp(ex, ez);
      if (el > acc) { ex *= acc / el; ez *= acc / el; }
      v.vx += ex; v.vz += ez;
      if (hyp(v.vx, v.vz) < 0.06 && dl < 0.1) v.vx = v.vz = 0;
      v.x += v.vx * dt; v.z += v.vz * dt;
      this.pushOut(v);
      const lag = hyp(tx - v.x, tz - v.z); if (v === g.members[0]) g.lag = lag; else if (lag > g.lag) g.lag = lag;
      const sp = hyp(v.vx, v.vz);
      if (sp > 0.2) { const tr = (panic ? 9 : 4.5) * dt; v.yaw += clamp(wrapA(Math.atan2(v.vx, v.vz) - v.yaw), -tr, tr); }
    }
    strideV(v, px, pz, dt);
    this.glance(v, dt, panic);
  }
  // ngoái lại: về phía trận (điểm gần nhất trên làn gần nhất) hoặc về phía mối đe doạ khi đang hoảng
  glance(v, dt, panic) {
    const R = ROLE[v.rl];
    if ((v.lookT -= dt) <= 0) {
      if (v.lookA !== 0) { v.lookA = 0; v.lookT = panic ? this.rng.range(0.6, 1.6) : this.rng.range(3, 8); }
      else {
        let lx, lz;
        if (panic && v.g) { lx = v.g.thX; lz = v.g.thZ; }
        else { lx = clamp(v.x, 60, 460); lz = Math.abs(v.z - LANES[0]) < Math.abs(v.z - LANES[1]) ? LANES[0] : LANES[1]; }
        v.lookA = clamp(wrapA(Math.atan2(lx - v.x, lz - v.z) - v.yaw), -1.3, 1.3) / 1.3 * R.look;
        v.lookT = this.rng.range(0.7, 1.5);
      }
    }
    v.look += (v.lookA - v.look) * Math.min(1, dt * 4);
  }

  // ---- vẽ ---------------------------------------------------------------------------------------------------
  draw(v, dt, clk, kSoft) {
    const dist = v.dist = this.amb.vis(v.x, v.z, V_DRAW);
    if (dist < 0 || v.fade >= 1) { v.poseInit = false; if (v.child) v.child.poseInit = false; return; }
    const S = this.kits[v.mesh]; if (S.n >= V_CAP) return;
    if (v.gx !== v.x || v.gz !== v.z) { v.gy = heightAt(v.x, v.z); v.gx = v.x; v.gz = v.z; }
    // LOD theo khoảng cách camera: gần — mỗi khung, IK chân, lò xo váy, con lắc thúng; vừa — 2 khung một lần;
    // xa — 4 khung một lần (hai mức sau không IK, không mô phỏng)
    const far = dist > this.lodR, every = far ? (dist < V_MID ? 2 : 4) : 1;
    if (!far) this.nNear++;
    const redo = !v.poseInit || every === 1 || (this.frame + v.id) % every === 0;
    if (redo) {
      poseFor(v, v.pk, V_K, clk, _vp); this.post(v, _vp);
      if (!v.poseInit || far) { v.pose.set(_vp); v.poseInit = true; }
      else smoothPose(v.pose, _vp, kSoft, Math.max(kSoft, 1 - Math.exp(-dt * legRate(v))));
      soldierFrame(v, "human", v.x, v.gy + v.y, v.z, v.gy, v.pose, dt, heightAt, !far, v.mc);
      this.props(v, dt, far);
    }
    this.emit(S, v);
    // bóng tròn dưới chân (con bế không có)
    if (this.nb < V_MAX) {
      const e = this.blob.instanceMatrix.array, o = this.nb++ * 16, s = v.scale * (v.rl === R_GANH ? 1.05 : 0.85) * (1 - v.fade);
      e[o] = s; e[o + 1] = 0; e[o + 2] = 0; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = 1; e[o + 6] = 0; e[o + 7] = 0;
      e[o + 8] = 0; e[o + 9] = 0; e[o + 10] = s; e[o + 11] = 0; e[o + 12] = v.x; e[o + 13] = v.gy + 0.06; e[o + 14] = v.z; e[o + 15] = 1;
    }
    if (v.child) this.drawChild(v.child, v, dt, clk, redo);
  }
  emit(S, v) {
    const i = S.n++;
    S.data.set(v.mc, i * BONE_FLOATS);
    const c = S.color.array; c[i * 3] = v.tint[0]; c[i * 3 + 1] = v.tint[1]; c[i * 3 + 2] = v.tint[2];
    S.fade.array[i] = v.fade;
  }
  // Đứa bé ngồi hông trái mẹ, mặt quay vào người mẹ (hướng mẹ + 90°), hai chân quặp quanh eo mẹ.
  drawChild(c, m, dt, clk, redo) {
    const S = this.kits[2]; if (S.n >= V_CAP) return;
    if (redo || !c.poseInit) {
      c.yaw = m.yaw + HALF_PI;
      this.glance(c, dt, m.g && m.g.mode === VG_PANIC);
      poseFor(c, c.pk, V_K, clk, _vp); this.post(c, _vp); c.pose.set(_vp); c.poseInit = true;
      const mc = m.mc, o = J_PEL, lx = -0.25, ly = 0.1, lz = 0.02;
      const hx = mc[o] * lx + mc[o + 1] * ly + mc[o + 2] * lz + mc[o + 3];
      const hy = mc[o + 4] * lx + mc[o + 5] * ly + mc[o + 6] * lz + mc[o + 7];
      const hz = mc[o + 8] * lx + mc[o + 9] * ly + mc[o + 10] * lz + mc[o + 11];
      const y0 = hy - (0.9 + c.pose[CH.hipY]) * c.scale;
      c.x = hx; c.z = hz;
      soldierFrame(c, "human", hx, y0, hz, y0, c.pose, dt, heightAt, false, c.mc);
      hideBone(c.mc, J_TAS);
    }
    this.emit(S, c);
  }
  // Tư thế cộng thêm sau poseFor: cúi người, ngoái lại, ngồi xổm (V_SQUAT), chân đứa bé được bế.
  post(v, P) {
    if (v.rl === R_BEBE) {
      P[CH.hipY] = -0.1; P[CH.ltx] = -1.3; P[CH.ltz] = -0.8; P[CH.lsx] = 1.75; P[CH.rtx] = -1.2; P[CH.rtz] = 0.8; P[CH.rsx] = 1.7;
      P[CH.lkx] = 0.5; P[CH.rkx] = 0.5; P[CH.tx] = -0.08; P[CH.ty] = v.look; P[CH.pelY] = 0; P[CH.pitch] = 0; P[CH.roll] = 0;
      return;
    }
    const R = ROLE[v.rl], k = v.kneel;
    P[CH.tx] += R.lean[0] + (R.lean[1] - R.lean[0]) * v.pan;
    P[CH.ty] += v.look;
    if (k > 0) {
      const e = k * k * (3 - 2 * k);
      mixCh(P, CH.hipY, V_SQUAT.hipY, e); mixCh(P, CH.ltx, V_SQUAT.th, e); mixCh(P, CH.rtx, V_SQUAT.th, e);
      mixCh(P, CH.lsx, V_SQUAT.kn, e); mixCh(P, CH.rsx, V_SQUAT.kn, e); mixCh(P, CH.ltz, -0.14, e); mixCh(P, CH.rtz, 0.14, e);
      mixCh(P, CH.pelY, 0, e); mixCh(P, CH.lkx, 0, e); mixCh(P, CH.rkx, 0, e);
      P[CH.tx] += (v.rl === R_GANH ? 0.2 : 0.55) * e;
      if (v.rl === R_DOI) {                         // buộc tay nải dưới đất: hai tay với xuống, cử động nhỏ
        const w = Math.sin(this.t * 5.5 + v.id) * 0.12;
        mixCh(P, CH.lax, -1.1 + w, e); mixCh(P, CH.laz, 0.25, e); mixCh(P, CH.lfx, -0.6, e);
        mixCh(P, CH.rax, -1.1 - w, e); mixCh(P, CH.raz, -0.25, e); mixCh(P, CH.ray, 0, e); mixCh(P, CH.rfx, -0.6, e);
      } else if (v.rl === R_GANH) { mixCh(P, CH.lax, -0.9, e); mixCh(P, CH.lfx, -0.5, e); }
    }
  }

  // ---- đồ mang: ghi đè ma trận các khúc mượn sau soldierFrame ------------------------------------------------
  props(v, dt, far) {
    const mc = v.mc;
    switch (v.rl) {
      case R_GANH: this.pole(v, dt, far); break;
      case R_GIA: this.stick(v, dt); hideBone(mc, J_FLF); hideBone(mc, J_FLB); break;
      case R_DOI: this.headBundle(v); break;
      case R_OM: boneAt(mc, J_TAS, J_PEL, -0.3, -0.16, 0.06); break;      // tay nải kẹp bên hông trái
      case R_BE: hideBone(mc, J_TAS); break;
      case R_TRE: if (!v.bag) hideBone(mc, J_TAS); break;                // bọc nhỏ: gốc "tas" mặc định ở bàn tay phải
    }
  }
  // Đòn gánh nằm ngang trên vai phải (theo hướng thân, không chúi theo người cúi); hai thúng treo ở hai đầu: con lắc
  // trước/sau và ngang theo gia tốc điểm vai (tăng tốc thì thúng lùi lại, dừng thì đưa tới), nhún lên xuống theo
  // bước (lò xo đòn tre); chạm đất (người ngồi xổm) thì thúng đặt trên đất, dây chùng.
  pole(v, dt, far) {
    const mc = v.mc, sc = v.scale, o = J_TOR, bk = v.bk, lx = 0.13, ly = 0.535;
    const Sx = mc[o] * lx + mc[o + 1] * ly + mc[o + 3], Sy = mc[o + 4] * lx + mc[o + 5] * ly + mc[o + 7], Sz = mc[o + 8] * lx + mc[o + 9] * ly + mc[o + 11];
    let px = mc[o + 2], pz = mc[o + 10]; const pl = hyp(px, pz) || 1; px /= pl; pz /= pl;
    const L = V_POLE * sc, t = J_TAS;
    mc[t] = pz * sc; mc[t + 1] = 0; mc[t + 2] = px * L; mc[t + 3] = Sx;
    mc[t + 4] = 0; mc[t + 5] = sc; mc[t + 6] = 0; mc[t + 7] = Sy;
    mc[t + 8] = -px * sc; mc[t + 9] = 0; mc[t + 10] = pz * L; mc[t + 11] = Sz;
    if (far || !(dt > 0) || bk[10] !== bk[10]) {
      for (let i = 0; i < 10; i++) bk[i] = 0;
      bk[10] = Sx; bk[11] = Sy; bk[12] = Sz; bk[13] = bk[14] = bk[15] = 0;
    } else {
      const k = Math.min(1, dt * 12);
      const nvx = bk[13] + ((Sx - bk[10]) / dt - bk[13]) * k, nvy = bk[14] + ((Sy - bk[11]) / dt - bk[14]) * k, nvz = bk[15] + ((Sz - bk[12]) / dt - bk[15]) * k;
      const ax = clamp((nvx - bk[13]) / dt, -25, 25), ay = clamp((nvy - bk[14]) / dt, -25, 25), az = clamp((nvz - bk[15]) / dt, -25, 25);
      bk[10] = Sx; bk[11] = Sy; bk[12] = Sz; bk[13] = nvx; bk[14] = nvy; bk[15] = nvz;
      const af = ax * px + az * pz, al = ax * pz - az * px;
      pendulum(bk, 0, af, 0.78 * sc, dt); pendulum(bk, 2, al, 0.78 * sc, dt);
      pendulum(bk, 4, af, 0.86 * sc, dt); pendulum(bk, 6, al, 0.86 * sc, dt);
      // nhún: lò xo tần số ~1,9 Hz, kéo bởi gia tốc đứng của vai
      const n = Math.min(8, Math.ceil(dt * 60)), h = dt / n;
      for (let q = 0; q < n; q++) { bk[9] += (-142 * bk[8] - 4.2 * bk[9] - ay * 0.4) * h; bk[8] += bk[9] * h; }
      bk[8] = clamp(bk[8], -0.09 * sc, 0.06 * sc);
    }
    const e = (V_POLE / 2 - 0.04) * sc, yawP = Math.atan2(px, pz);
    for (let s = 0; s < 2; s++) {
      const sg = s ? -1 : 1, j = s ? J_FLB : J_FLF, i = s * 4;
      let hx = Sx + px * e * sg, hy = Sy + bk[8], hz = Sz + pz * e * sg;
      if (!far) { const gy = heightAt(hx, hz) + V_BASKET * sc + 0.01; if (hy < gy) { hy = gy; bk[i] *= 0.85; bk[i + 1] *= 0.5; bk[i + 2] *= 0.85; bk[i + 3] *= 0.5; } }
      rotInto(_VR, yawP, -bk[i], bk[i + 2]);
      for (let r = 0; r < 12; r += 4) { mc[j + r] = _VR[r] * sc; mc[j + r + 1] = _VR[r + 1] * sc; mc[j + r + 2] = _VR[r + 2] * sc; }
      mc[j + 3] = hx; mc[j + 7] = hy; mc[j + 11] = hz;
    }
  }
  // Gậy chống: mũi gậy cắm đất đứng yên trong khi bàn tay đi tới; tụt sau bàn tay quá 0,22 m thì nhấc lên đưa tới
  // trước (0,32 s, vòng cung thấp). Gậy đi từ mũi qua bàn tay, dài V_STICK.
  stick(v, dt) {
    const mc = v.mc, sc = v.scale, o = J_FAR, st = v.stk, hy0 = HAND, hz0 = 0.02;
    const Hx = mc[o + 1] * hy0 + mc[o + 2] * hz0 + mc[o + 3], Hy = mc[o + 5] * hy0 + mc[o + 6] * hz0 + mc[o + 7], Hz = mc[o + 9] * hy0 + mc[o + 10] * hz0 + mc[o + 11];
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    if (st[0] !== st[0]) { st[0] = Hx + fx * 0.25 * sc; st[1] = Hz + fz * 0.25 * sc; st[4] = 1; }
    const ahead = (st[0] - Hx) * fx + (st[1] - Hz) * fz, side = (st[0] - Hx) * fz - (st[1] - Hz) * fx;
    if (st[4] >= 1 && (ahead < -0.22 * sc || Math.abs(side) > 0.4 || ahead > 0.9)) { st[2] = st[0]; st[3] = st[1]; st[4] = 0; }
    if (st[4] < 1 && dt > 0) {
      st[4] = Math.min(1, st[4] + dt / 0.32);
      const lead = (0.26 + v.spd * 0.3) * sc, u = st[4];
      st[0] = st[2] + (Hx + fx * lead - st[2]) * u; st[1] = st[3] + (Hz + fz * lead - st[3]) * u;
    }
    const Tx = st[0], Tz = st[1], Ty = heightAt(Tx, Tz) + (st[4] < 1 ? 0.1 * Math.sin(Math.PI * st[4]) : 0);
    let dx = Hx - Tx, dy = Hy - Ty, dz = Hz - Tz; const dl = hyp3(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    const Ls = Math.max(V_STICK * sc, dl + 0.06), w = 0.7 * sc;
    let rx = dz, rz = -dx; const rl = hyp(rx, rz) || 1; rx /= rl; rz /= rl;
    const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx;
    const t = J_TAS, cx = Tx + dx * Ls / 2, cy = Ty + dy * Ls / 2, cz = Tz + dz * Ls / 2;
    mc[t] = rx * w; mc[t + 1] = ux * w; mc[t + 2] = dx * Ls; mc[t + 3] = cx;
    mc[t + 4] = 0; mc[t + 5] = uy * w; mc[t + 6] = dy * Ls; mc[t + 7] = cy;
    mc[t + 8] = rz * w; mc[t + 9] = uz * w; mc[t + 10] = dz * Ls; mc[t + 11] = cz;
  }
  // Tay nải đội đầu (khung thân dời lên đỉnh khăn vấn); lúc đang buộc dưới đất thì nằm trước mặt, đứng dậy thì
  // nhấc lên đầu theo vòng cung (lift 0 → 1).
  headBundle(v) {
    const mc = v.mc, t = J_TAS;
    boneAt(mc, t, J_TOR, 0, 0.765, 0);
    if (v.lift >= 1) return;
    const sc = v.scale, e = v.lift * v.lift * (3 - 2 * v.lift), fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    const gx = v.x + fx * 0.55 * sc, gz = v.z + fz * 0.55 * sc, gy = heightAt(gx, gz);
    rotInto(_VR, v.yaw, 0, 0);
    for (let r = 0; r < 12; r += 4) for (let c = 0; c < 3; c++) mc[t + r + c] = _VR[r + c] * sc + (mc[t + r + c] - _VR[r + c] * sc) * e;
    mc[t + 3] = gx + (mc[t + 3] - gx) * e; mc[t + 7] = gy + (mc[t + 7] - gy) * e + 0.25 * Math.sin(Math.PI * e); mc[t + 11] = gz + (mc[t + 11] - gz) * e;
  }

  info() {
    const K = this.kits;
    return { ms: +this.ms.toFixed(3), persons: this.nPersons, drawn: K[0].mesh.count + K[1].mesh.count + K[2].mesh.count,
      draws: K.filter((S) => S.mesh.visible).length + (this.blob.visible ? 1 : 0), heroFight: this.heroFight,
      groups: this.groups.map((g) => ({ src: g.src, mode: g.mode, x: +g.x.toFixed(1), z: +g.z.toFixed(1), wi: g.wi, n: g.members.length, blocked: g.blocked, hurry: g.hurry })) };
  }
}
