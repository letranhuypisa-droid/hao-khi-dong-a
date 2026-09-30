// battle/models.js — hình khối low poly dựng bằng code (chưa có asset thật).
//
// Phối màu sơn mài (quyết định L1): son đỏ, đen then, vàng thếp, trứng sáo. Phe Nguyên dùng
// xám thép + chàm để hai phe tách nhau bằng cả sắc độ lẫn hình dáng (mũ nhọn, khiên tròn) —
// không chỉ bằng màu, vì PT-A chấm cả qua bộ lọc mù màu (21.9).

import * as THREE from "three";

export const PAL = {
  son: 0x9b2d20, sonDam: 0x6e1d15, then: 0x1d1a17, vang: 0xc9a14a, trung: 0xe6dcc3,
  vai: 0xb9a37a, da: 0xc48f63, toc: 0x141210, go: 0x6b4a2b, sat: 0x8d9296,
  thep: 0x5f6f7c, cham: 0x2c3a4a, long: 0x5a4632, xam: 0xb8bdbf, nau: 0x4a3524,
  ngua: 0x6a4e36, nguaDen: 0x2a211b,
};

// ---- ghép hình: mỗi mảnh là geometry + màu, gộp thành một BufferGeometry có vertex color ----
export function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
  return g;
}
export function merge(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);

export const lambert = (opts = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts });

export function blobGeometry() {
  const g = new THREE.CircleGeometry(0.55, 10);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---- Rig khớp nối cho tướng, sĩ quan, boss ----------------------------------------------------
// Trả về { root, p, scale, dyn, skeleton, mats, meshes } với p là các khớp. Hoạt ảnh thủ tục đặt rotation trên từng
// khớp; dyn mô tả phần chuyển động phụ do rig-motion.js điều khiển (chân bám đất, vạt áo, dây treo, áo choàng, cờ, mũi
// lưỡi vũ khí). Bỏ rig thì gọi disposeRig().
//
// Chân: hông → gối 0,45; gối → cổ chân 0,40; đế giày thấp hơn cổ chân 0,08 (cổ chân 0 = dáng cũ).
export const LEG = { L1: 0.45, L2: 0.40, sole: 0.08, toe: 0.17, heel: -0.09, footZ: 0.04 };
// Vạt áo: 4 mảnh treo dưới hông (không theo thân xoắn), mỗi mảnh là một góc phần tư mặt nón cụt.
// yaw: hướng mảnh quanh thân (0 = trước, +π/2 = phải); r0/r1 bán kính mép trên/dưới, h dài.
const FLAPS = [
  { key: "F", yaw: 0, r0: 0.25, r1: 0.33, h: 0.40 },
  { key: "B", yaw: Math.PI, r0: 0.25, r1: 0.34, h: 0.42 },
  { key: "R", yaw: Math.PI / 2, r0: 0.244, r1: 0.31, h: 0.36 },
  { key: "L", yaw: -Math.PI / 2, r0: 0.244, r1: 0.31, h: 0.36 },
];
export const FLAP_Y = -0.01;
// Dây treo (dải khăn, tua): n đốt dài seg (đơn vị rig), neo ở điểm a trong khung khớp.
const TAILS = { n: 3, seg: 0.09, w: 0.05 };
const TASSEL = { n: 3, seg: 0.07 };

// Mảnh cung nón cụt mở hai đầu (dùng hai mặt), mép trên chính giữa ở gốc, buông theo −y, mặt ngoài hướng +z.
const arc = (r0, r1, h, tl) => new THREE.CylinderGeometry(r0, r1, h, 2, 1, true, -tl / 2, tl);
// Áo choàng sĩ quan: treo sau lưng ở (0, y, z) khung thân, 3 khúc dài h (đơn vị rig), rộng w ở mép trên từng khúc
// và gấu (w có h.length + 1 phần tử), dày t, viền gấu cao hem. rig-motion.js cho mỗi khúc một lò xo, khúc dưới trễ
// theo khúc trên.
export const CAPE = { y: 0.6, z: -0.185, h: [0.3, 0.32, 0.33], w: [0.48, 0.52, 0.56, 0.6], t: 0.04, hem: 0.05 };
// Lưới áo choàng: một dải hộp mỏng (hình thang loe dần) bọc da vào chuỗi xương khúc. Mỗi hàng đỉnh ở bản lề thuộc
// xương khúc dưới (đỉnh nằm ngay gốc xương đó nên gập bản lề không làm hở), hai khúc gập, lệch ngang thì mặt vải
// nối liền (không khấc như ghép hộp cứng). Viền gấu: nhân đôi hàng đỉnh ở mép viền để đổi màu gọn. Toạ độ đỉnh tính
// trong khung xương của nó (xương khúc b có gốc ở mép trên khúc b), skinIndex là số khúc 0..2.
function capeGeometry(color, trimColor) {
  const C = CAPE, H = C.h.reduce((a, b) => a + b, 0), last = C.h.length - 1;
  const rows = [], top = [0];                              // [y, rộng, xương, màu]; top[b] = mép trên khúc b
  let y = 0;
  for (let i = 0; i <= last; i++) { rows.push([y, C.w[i], i, color]); y -= C.h[i]; top.push(y); }
  const yh = -H + C.hem, wh = C.w[last] + (C.w[last + 1] - C.w[last]) * (1 - C.hem / C.h[last]);
  rows.push([yh, wh, last, color], [yh, wh, last, trimColor], [-H, C.w[last + 1], last, trimColor]);
  const pos = [], col = [], si = [], sw = [], idx = [], c = new THREE.Color();
  for (const [ry, w, b, hex] of rows) {
    c.set(hex);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {          // 0 trước trái, 1 trước phải, 2 sau trái, 3 sau phải
      pos.push(sx * w / 2, ry - top[b], sz * C.t / 2); col.push(c.r, c.g, c.b); si.push(b, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
  }
  const quad = (a, b, cc, d) => idx.push(a, b, cc, a, cc, d);
  for (let r = 0; r + 1 < rows.length; r++) {
    if (rows[r][0] === rows[r + 1][0]) continue;          // hai hàng trùng nhau ở mép viền: chỉ đổi màu
    const t = r * 4, u = t + 4;
    quad(t, u, u + 1, t + 1); quad(t + 3, u + 3, u + 2, t + 2);             // mặt trong (+z), mặt ngoài (−z)
    quad(t + 1, u + 1, u + 3, t + 3); quad(t + 2, u + 2, u, t);             // mép phải, mép trái
  }
  const e = (rows.length - 1) * 4;
  quad(0, 1, 3, 2); quad(e, e + 2, e + 3, e + 1);                          // mép trên, gấu
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

// Gộp các mảnh thành một lưới da: parts = [[geometry (toạ độ khung xương), số xương | bảng đổi skinIndex]]. Mảnh
// cứng: mọi đỉnh thuộc một xương, trọng số 1. Mảnh có skinIndex riêng (áo choàng): đổi số xương cục bộ qua bảng.
function skinMerge(parts) {
  let n = 0; for (const [g] of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  let o = 0;
  for (const [g, b] of parts) {
    const c = g.attributes.position.count, gi = g.attributes.skinIndex;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    for (let i = 0; i < c; i++) { si[(o + i) * 4] = typeof b === "number" ? b : b[gi.getX(i)]; sw[(o + i) * 4] = 1; }
    o += c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  return g;
}

// Hình học rig đệm theo cấu hình (chỉ phụ thuộc RIGS: màu, mũ, vũ khí, áo choàng, cờ), dùng chung giữa các thể hiện
// như kitGeometry của lính. Đệm có hạn (vài cấu hình), không giải phóng; battle.js dọn khi thoát trận thì lần sau
// three tự nạp lại lên GPU.
const RIG_GEO = new Map();
const I4 = new THREE.Matrix4();

// Rig dựng thành lưới da (SkinnedMesh), mỗi vật liệu một lưới: mọi mảnh gắn cứng vào một khớp (thân, đầu, tay, chân,
// vũ khí, vạt áo, đốt dây, cán cờ) gộp chung một BufferGeometry, đỉnh thuộc đúng một xương (trọng số 1) là khớp đó —
// Group làm xương được vì Skeleton chỉ đọc matrixWorld. Xương có ma trận nghịch đảo đơn vị và bindMatrix đơn vị nên
// toạ độ mảnh giữ nguyên khung khớp của nó (đỉnh thế giới = khớp.matrixWorld · đỉnh). Áo choàng (3 xương, liền mặt)
// chung lưới hai mặt với vạt áo. Trước đây mỗi mảnh một Mesh: tướng 27 lưới (47 lượt vẽ kể cả bóng), Phó tướng,
// Toa Đô 22 (41), nay 2 lưới + lá cờ (tướng): 4–6 lượt vẽ mỗi rig. Hộp bao: cầu cố định đủ rộng cho mọi tư thế (vũ
// khí dài, lộn né, nằm) nên vẫn bị loại khi ngoài khung nhìn, ngoài hộp bóng (áo choàng trước đây tắt loại bỏ).
export function makeRig(cfg = {}) {
  const { scale = 1, cloth = PAL.son, armor = PAL.then, trim = PAL.vang, skin = PAL.da,
    hat = "tocbui", weapon = "songdao", cape = null, flag = null, shield = false } = cfg;
  const root = new THREE.Group(), p = {};
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const dyn = { flaps: [], ropes: [], cape: null, flag: null, blades: [] };
  // Mảnh: add(khớp, () => geometry, hai mặt?). Hàm dựng chỉ chạy khi cấu hình chưa có trong đệm; thứ tự xương luôn
  // như nhau với cùng cấu hình nên hình học đệm khớp mọi thể hiện.
  const bones = [], parts = [[], []];
  const boneOf = (j) => { let i = bones.indexOf(j); if (i < 0) { i = bones.length; bones.push(j); } return i; };
  const add = (j, fn, two = false) => parts[two ? 1 : 0].push([fn, boneOf(j)]);

  p.hips = joint(root, 0, 0.92, 0);
  p.torso = joint(p.hips, 0, 0.04, 0);
  add(p.torso, () => merge([
    part(box(0.48, 0.52, 0.3), cloth, { y: 0.3 }),
    part(box(0.52, 0.36, 0.33), armor, { y: 0.38 }),
    part(box(0.54, 0.08, 0.34), trim, { y: 0.1 }),
    part(box(0.5, 0.08, 0.32), trim, { y: 0.56 }),
  ]));
  // Cạp áo gắn vào hông (thân xoắn không kéo vạt theo), 4 vạt treo dưới cạp, viền vàng ở gấu.
  add(p.hips, () => merge([part(cyl(0.245, 0.255, 0.14, 8), cloth, { y: 0.045 })]));
  for (const f of FLAPS) {
    const j = joint(p.hips, Math.sin(f.yaw) * f.r0, FLAP_Y, Math.cos(f.yaw) * f.r0);
    j.rotation.order = "YXZ"; j.rotation.y = f.yaw;           // Ry đặt quanh thân, Rx xoè ra ngoài (−), Rz đưa ngang
    const tl = Math.PI / 2 + 0.16, hr = f.r1 - (f.r1 - f.r0) * (0.05 / f.h);
    add(j, () => merge([
      part(arc(f.r0, f.r1, f.h, tl), cloth, { y: -f.h / 2, z: -f.r0 }),
      part(arc(hr + 0.006, f.r1 + 0.006, 0.05, tl), trim, { y: -f.h + 0.025, z: -f.r0 }),
    ]), true);
    p["flap" + f.key] = j;
    dyn.flaps.push({ j, yaw: f.yaw, r0: f.r0, r1: f.r1, h: f.h });
  }
  p.head = joint(p.torso, 0, 0.68, 0);
  add(p.head, () => {
    const headParts = [part(ico(0.16, 1), skin, { y: 0.1 })];
    if (hat === "tocbui") headParts.push(part(ico(0.1, 0), PAL.toc, { y: 0.28, z: -0.03 }), part(box(0.34, 0.06, 0.3), PAL.son, { y: 0.16 }),
      part(box(0.1, 0.07, 0.05), PAL.son, { y: 0.155, z: -0.16 }));          // nút buộc khăn sau gáy
    if (hat === "mutuong") headParts.push(part(cyl(0.18, 0.2, 0.14, 8), trim, { y: 0.22 }), part(cone(0.06, 0.26, 5), PAL.son, { y: 0.4 }));
    if (hat === "munguyen") headParts.push(part(cone(0.2, 0.38, 7), PAL.xam, { y: 0.34 }), part(cyl(0.22, 0.24, 0.08, 8), PAL.long, { y: 0.2 }));
    if (hat === "mulong") headParts.push(part(cyl(0.2, 0.24, 0.26, 8), PAL.long, { y: 0.28 }), part(cone(0.05, 0.22, 4), trim, { y: 0.5 }));
    return merge(headParts);
  });

  for (const s of [-1, 1]) {
    const side = s < 0 ? "L" : "R";
    const sh = joint(p.torso, 0.3 * s, 0.52, 0);
    sh.rotation.order = "YXZ";          // quay cánh tay sang ngang sau khi giơ (xem anim.js)
    add(sh, () => merge([part(box(0.15, 0.36, 0.16), armor, { y: -0.16 }), part(box(0.2, 0.12, 0.2), trim, { y: 0.02 })]));
    const el = joint(sh, 0, -0.34, 0);
    add(el, () => merge([part(box(0.13, 0.32, 0.14), cloth, { y: -0.15 }), part(ico(0.07, 0), skin, { y: -0.34 })]));
    const hand = joint(el, 0, -0.36, 0.02);
    p["sh" + side] = sh; p["el" + side] = el; p["hand" + side] = hand;

    const hip = joint(p.hips, 0.12 * s, -0.02, 0);
    add(hip, () => merge([part(box(0.17, 0.46, 0.19), cloth, { y: -0.22 })]));
    const knee = joint(hip, 0, -LEG.L1, 0);
    add(knee, () => merge([part(box(0.15, 0.44, 0.17), PAL.then, { y: -0.2 })]));
    // cổ chân: bàn giày quay quanh đây để đế nằm theo mặt dốc (rig-motion.js)
    const ankle = joint(knee, 0, -LEG.L2, 0);
    add(ankle, () => merge([part(box(0.16, LEG.sole, 0.26), PAL.then, { y: -LEG.sole / 2, z: LEG.footZ })]));
    p["hip" + side] = hip; p["knee" + side] = knee; p["ankle" + side] = ankle;
  }

  const blade = (len, w, col) => merge([
    part(box(0.05, 0.05, 0.22), PAL.then, { z: 0.02 }),
    part(box(0.16, 0.04, 0.05), trim, { z: 0.13 }),
    part(box(0.03, w, len), col, { z: 0.16 + len / 2, y: 0.02 }),
  ]);
  // Điểm mũi lưỡi, đuôi cán (khung bàn tay) rig-motion.js giữ trên mặt đất bằng cách gập cổ tay (key: góc cổ tay
  // trong pose).
  const edge = (hand, key, ...pts) => dyn.blades.push({ j: hand, key, pts: new Float32Array(pts) });
  // Dây treo: mỗi đốt là một xương con của root (không theo khớp nào), rig-motion.js đặt vị trí, hướng mỗi lượt
  // theo điểm dây mô phỏng trong không gian thế giới. Ẩn (scale 0) tới lượt cập nhật đầu (khỏi bay từ gốc vào).
  // col: cầu va chạm [x, y, z, r] trong khung khớp neo.
  const segBones = [];
  const rope = (j, ax, ay, az, n, seg, fns, flat, damp, col = null) => {
    const segs = fns.map((fn) => { const b = new THREE.Bone(); root.add(b); add(b, fn); segBones.push(b); return b; });
    dyn.ropes.push({ j, a: new THREE.Vector3(ax, ay, az), n, seg, segs, flat, damp, col, pts: new Float32Array(n * 6) });
  };
  const hang = (geo, len) => geo.translate(0, -len / 2, 0);
  const tassel = (j, ax, ay, az) => {
    const s = TASSEL.seg;
    rope(j, ax, ay, az, TASSEL.n, s, [
      () => merge([part(hang(cyl(0.02, 0.032, s, 5), s), PAL.son)]),
      () => merge([part(hang(cyl(0.032, 0.045, s, 5), s), PAL.son)]),
      () => merge([part(hang(cyl(0.045, 0.012, s * 1.2, 5), s * 1.2), PAL.sonDam)]),
    ], false, 3.2);
  };
  // hai dải khăn buông sau gáy: cản 5,5/s (trước 2,4: dừng chạy, lộn né xong đầu dải còn đung đưa 1–1,5 m/s gần 2 s),
  // cầu va chạm quanh đầu (cầu đầu 0,16 + khe 0,02)
  if (hat === "tocbui") for (const s of [-1, 1]) {
    const T = TAILS;
    rope(p.head, 0.045 * s, 0.155, -0.175, T.n, T.seg, [0, 1, 2].map((k) => () =>
      merge([part(hang(box(T.w * (1 - 0.12 * k), T.seg + 0.012, 0.014), T.seg + 0.012), k === 2 ? PAL.sonDam : PAL.son)])), true, 5.5, [0, 0.1, 0, 0.18]);
  }

  let reach = 1.2;                                        // tầm vũ khí tính từ bàn tay (cầu bao)
  if (weapon === "songdao") {
    add(p.handR, () => blade(0.9, 0.08, PAL.sat));
    add(p.handL, () => blade(0.9, 0.08, PAL.sat));
    edge(p.handR, "handRx", 0, 0.02, 1.06); edge(p.handL, "handLx", 0, 0.02, 1.06);
  } else if (weapon === "giao") {
    add(p.handR, () => merge([part(cyl(0.03, 0.03, 3.0, 5), PAL.go, { z: 0.6, rx: Math.PI / 2 }), part(cone(0.07, 0.4, 4), PAL.sat, { z: 2.25, rx: Math.PI / 2 }), part(box(0.1, 0.1, 0.06), PAL.son, { z: 1.98 })]));
    tassel(p.handR, 0, -0.03, 1.98);                     // tua lông ngựa đỏ dưới mũi giáo
    edge(p.handR, "handRx", 0, 0, 2.45, 0, 0, -0.9); reach = 2.5;
  } else if (weapon === "cung") {
    add(p.handL, () => merge([part(box(0.05, 1.5, 0.06), PAL.go, { z: 0.1 }), part(box(0.015, 1.4, 0.015), PAL.trung, { z: -0.05 })]));
  } else if (weapon === "dadao") {
    add(p.handR, () => merge([part(cyl(0.035, 0.035, 2.2, 5), PAL.go, { z: 0.4, rx: Math.PI / 2 }), part(box(0.05, 0.28, 0.8), PAL.sat, { z: 1.7, y: 0.1 }), part(box(0.2, 0.08, 0.08), trim, { z: 1.3 })]));
    tassel(p.handR, 0, -0.04, 1.3);                      // tua ở chân lưỡi đại đao
    edge(p.handR, "handRx", 0, -0.04, 2.1, 0, 0.24, 2.1, 0, 0, -0.7); reach = 2.2;
  } else if (weapon === "dao") {
    add(p.handR, () => blade(1.0, 0.1, PAL.sat));
    edge(p.handR, "handRx", 0, 0.02, 1.16);
  }
  if (shield) add(p.elL, () => merge([part(cyl(0.38, 0.38, 0.06, 10), PAL.nau, { y: -0.2, z: 0.16, rx: Math.PI / 2 }), part(cyl(0.1, 0.1, 0.08, 6), trim, { y: -0.2, z: 0.2, rx: Math.PI / 2 })]));
  if (cape) {
    // CAPE.h.length xương nối bản lề (xương dưới là con xương trên, gốc ở mép trên khúc), bọc da liền mặt (capeGeometry).
    const joints = [];
    let par = p.torso;
    for (let i = 0; i < CAPE.h.length; i++) {
      const b = new THREE.Bone(); b.position.set(0, i ? -CAPE.h[i - 1] : CAPE.y, i ? 0 : CAPE.z);
      par.add(b); joints.push(b); par = b;
    }
    parts[1].push([() => capeGeometry(cape, trim), joints.map(boneOf)]);
    p.cape = joints[0];
    dyn.cape = { joints, h: CAPE.h };
  }
  let flagMat = null;
  if (flag) {
    p.flag = joint(p.torso, 0, 0.3, -0.2);
    add(p.flag, () => merge([part(cyl(0.02, 0.02, 1.9, 4), PAL.then, { y: 0.9 })]));
    // Vải cờ: mép dọc gắn vào cán, buông về sau (−z) quanh bản lề flagCloth trên trục cán; rig-motion.js xoay bản lề
    // quanh cán (rotation.y). Mặt có chữ (+x khi chưa xoay) nhìn sang phải.
    p.flagCloth = joint(p.flag, 0, 1.3, 0);
    flagMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    p.flagCloth.add(new THREE.Mesh(undefined, flagMat));
    dyn.flag = p.flag;
  }

  // ---- lưới da ----
  const key = JSON.stringify(cfg);
  let G = RIG_GEO.get(key);
  if (!G) {
    const build = (list) => (list.length ? skinMerge(list.map(([fn, b]) => [fn(), b])) : null);
    G = { solid: build(parts[0]), dbl: build(parts[1]), flagGeo: null, flagTex: null };
    if (flag) {
      G.flagGeo = new THREE.PlaneGeometry(0.46, 1.1, 1, 4).rotateY(Math.PI / 2).translate(0, 0, -0.245);
      G.flagTex = flagTexture(flag.text, flag.bg, flag.fg);
    }
    RIG_GEO.set(key, G);
  }
  const skeleton = new THREE.Skeleton(bones, bones.map(() => I4));
  const R = 0.75 + Math.max(1.44 + reach, flag ? 2.6 : 0) + 0.1;
  const mats = [], meshes = [];
  for (const [geo, two] of [[G.solid, false], [G.dbl, true]]) {
    if (!geo) continue;
    const m = new THREE.SkinnedMesh(geo, lambert(two ? { side: THREE.DoubleSide } : {}));
    m.castShadow = true;
    m.bind(skeleton, I4);
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.92, 0), R);
    root.add(m); mats.push(m.material); meshes.push(m);
  }
  if (flag) {
    const cm = p.flagCloth.children[0];
    cm.geometry = G.flagGeo; flagMat.map = G.flagTex; mats.push(flagMat);
  }
  for (const b of segBones) b.scale.setScalar(0);
  root.scale.setScalar(scale);
  return { root, p, scale, dyn, skeleton, mats, meshes };
}

// Giải phóng phần riêng của một thể hiện rig: gỡ khỏi cảnh, texture xương của khung xương, vật liệu. Hình học dùng
// chung (đệm theo cấu hình) giữ lại. Gọi lại nhiều lần không sao.
export function disposeRig(rig) {
  rig.root.parent?.remove(rig.root);
  if (rig.disposed) return;
  rig.disposed = true;
  rig.skeleton?.dispose();
  for (const m of rig.mats || []) m.dispose();
}

// Cấu hình rig theo vai (tướng người chơi, sĩ quan, boss, tướng đồng minh). units.js, hero.js, lab.js dùng chung.
export const RIGS = {
  hero:      { scale: 1.08, cloth: PAL.son, armor: PAL.then, trim: PAL.vang, hat: "tocbui", weapon: "songdao",
    flag: { text: "破強敵報皇恩", bg: "#9b2d20", fg: "#f1d98a" } },
  doitruong: { scale: 1.12, cloth: PAL.cham, armor: PAL.thep, trim: PAL.xam, hat: "munguyen", weapon: "dao", shield: true },
  photuong:  { scale: 1.22, cloth: PAL.cham, armor: PAL.then, trim: PAL.xam, hat: "mulong", weapon: "dadao", cape: 0x3b4a5a },
  tuong:     { scale: 1.38, cloth: 0x3a2f3a, armor: PAL.then, trim: PAL.vang, hat: "mulong", weapon: "dadao", cape: 0x4a2f2a },
  H33:       { scale: 1.15, cloth: 0x2f4a6a, armor: PAL.then, trim: PAL.vang, hat: "mutuong", weapon: "giao", cape: PAL.son },
  H40:       { scale: 1.15, cloth: 0x4a5a2a, armor: PAL.then, trim: PAL.vang, hat: "mutuong", weapon: "cung", cape: PAL.sonDam },
};

// Lá cờ viết chữ dọc (Cờ sáu chữ của Trần Quốc Toản là Chính sử theo canon).
export function flagTexture(text, bg = "#9b2d20", fg = "#f1d98a") {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, 64, 256);
  x.strokeStyle = fg; x.lineWidth = 3; x.strokeRect(4, 4, 56, 248);
  x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle";
  const chars = [...text];
  const step = 236 / chars.length;
  x.font = `bold ${Math.min(40, step * 0.8)}px serif`;
  chars.forEach((ch, i) => x.fillText(ch, 32, 14 + step * (i + 0.5)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Vật phẩm rơi: khối nhỏ xoay + vòng sáng.
export function pickupMesh(color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35, flatShading: true }));
  m.position.y = 0.8; g.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 16), new THREE.MeshBasicMaterial({ color: 0xf1d98a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.gem = m;
  return g;
}
