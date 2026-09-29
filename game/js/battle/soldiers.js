// battle/soldiers.js — lính thường có khớp, vẽ instanced.
//
// Mỗi kiểu lính (KITS trong tuning) là một bộ lưới low poly chia theo khúc: hông, thân (kèm đầu,
// mũ), cánh tay trên, cẳng tay (kèm vũ khí, khiên), đùi, cẳng chân. Mỗi khúc là một InstancedMesh;
// ma trận của khúc = ma trận khúc cha × điểm xoay × góc khớp, tính trên CPU mỗi khung. Kỵ binh dùng
// bộ khớp ngựa: "đùi"/"cẳng" là bốn chân ngựa, "hông" là mình ngựa, "thân" là người cưỡi.
//
// Tư thế là mảng NCH kênh (xem CH). poseFor() dựng tư thế đích theo trạng thái lính; crowd trộn
// tư thế hiện tại về đích theo thời gian trận, nên hit-stop đóng băng cả hoạt ảnh lính.
//
// Quy ước góc (khớp nào cũng vậy): x âm = đưa ra trước / giơ lên; tay phải z dương = dang ra ngoài,
// tay trái z âm = dang ra ngoài; cẳng tay x âm = gập khuỷu; cẳng chân x dương = gập gối.
// "Phải" ở đây là phía +x của lưới, như rig của tướng.

import * as THREE from "three";
import { part, merge, PAL } from "./models.js";

// ---- kênh tư thế --------------------------------------------------------------------------------
const KEYS = ["pitch", "roll", "lift", "fwd", "hipY", "pelY", "tx", "ty", "tz",
  "lax", "lay", "laz", "lfx", "rax", "ray", "raz", "rfx", "ltx", "ltz", "lsx", "rtx", "rtz", "rsx"];
export const NCH = KEYS.length;
export const CH = Object.fromEntries(KEYS.map((k, i) => [k, i]));

// ---- bộ khớp ------------------------------------------------------------------------------------
// [tên, cha, điểm xoay trong khung cha, kênh x, kênh y, kênh z, thứ tự Euler]
const HUMAN = [
  ["pelvis", null, [0, 0.9, 0], null, "pelY", null, "YXZ"],
  ["torso", "pelvis", [0, 0.06, 0], "tx", "ty", "tz", "YXZ"],
  ["uaL", "torso", [-0.26, 0.47, 0], "lax", "lay", "laz", "YXZ"],
  ["faL", "uaL", [0, -0.29, 0], "lfx", null, null, "XYZ"],
  ["uaR", "torso", [0.26, 0.47, 0], "rax", "ray", "raz", "YXZ"],
  ["faR", "uaR", [0, -0.29, 0], "rfx", null, null, "XYZ"],
  ["thL", "pelvis", [-0.11, -0.02, 0], "ltx", null, "ltz", "XYZ"],
  ["shL", "thL", [0, -0.44, 0], "lsx", null, null, "XYZ"],
  ["thR", "pelvis", [0.11, -0.02, 0], "rtx", null, "rtz", "XYZ"],
  ["shR", "thR", [0, -0.44, 0], "rsx", null, null, "XYZ"],
];
const HORSE = [
  ["pelvis", null, [0, 1.12, 0], null, "pelY", null, "YXZ"],
  ["torso", "pelvis", [0, 0.34, -0.05], "tx", "ty", "tz", "YXZ"],
  ["uaL", "torso", [-0.23, 0.44, 0], "lax", "lay", "laz", "YXZ"],
  ["faL", "uaL", [0, -0.27, 0], "lfx", null, null, "XYZ"],
  ["uaR", "torso", [0.23, 0.44, 0], "rax", "ray", "raz", "YXZ"],
  ["faR", "uaR", [0, -0.27, 0], "rfx", null, null, "XYZ"],
  ["thL", "pelvis", [-0.17, -0.2, 0.5], "ltx", null, null, "XYZ"],     // chân trước trái
  ["shL", "pelvis", [-0.17, -0.2, -0.5], "lsx", null, null, "XYZ"],    // chân sau trái
  ["thR", "pelvis", [0.17, -0.2, 0.5], "rtx", null, null, "XYZ"],      // chân trước phải
  ["shR", "pelvis", [0.17, -0.2, -0.5], "rsx", null, null, "XYZ"],     // chân sau phải
];
export const SKELETONS = { human: HUMAN, horse: HORSE };
export const JOINT_NAMES = HUMAN.map((j) => j[0]);

// ---- hình khối ----------------------------------------------------------------------------------
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const HAND = -0.29;

// Vũ khí gắn ở bàn tay (khung cẳng tay). Đao, thương, chùy nằm dọc trục z (vuông góc cẳng tay): cẳng
// tay buông thì vũ khí chĩa ra trước. Nỏ nằm dọc cẳng tay: tay đưa ra trước thì nỏ chĩa ra trước.
const W = {
  dao: (blade = PAL.sat) => [
    part(box(0.045, 0.045, 0.2), PAL.then, { y: HAND, z: 0.0 }),
    part(box(0.14, 0.035, 0.045), PAL.vang, { y: HAND, z: 0.11 }),
    part(box(0.025, 0.075, 0.55), blade, { y: HAND + 0.01, z: 0.4 }),
    part(box(0.025, 0.06, 0.2), blade, { y: HAND + 0.04, z: 0.74, rx: -0.28 }),
  ],
  giao: (tassel = PAL.long, len = 2.6) => [
    part(cyl(0.022, 0.022, len, 5), PAL.go, { y: HAND, z: len / 2 - 0.8, rx: Math.PI / 2 }),
    part(cone(0.05, 0.28, 4), PAL.sat, { y: HAND, z: len - 0.66, rx: Math.PI / 2 }),
    part(cone(0.07, 0.16, 5), tassel, { y: HAND, z: len - 0.86, rx: -Math.PI / 2 }),
  ],
  cung: () => [
    part(box(0.045, 0.05, 0.16), PAL.then, { y: HAND }),
    part(box(0.035, 0.035, 0.52), PAL.go, { y: HAND + 0.07, z: 0.33, rx: -0.3 }),
    part(box(0.035, 0.035, 0.52), PAL.go, { y: HAND + 0.07, z: -0.33, rx: 0.3 }),
    part(box(0.03, 0.03, 0.12), PAL.then, { y: HAND + 0.1, z: 0.62, rx: 0.5 }),
    part(box(0.03, 0.03, 0.12), PAL.then, { y: HAND + 0.1, z: -0.62, rx: -0.5 }),
    part(box(0.008, 0.008, 1.2), PAL.trung, { y: HAND + 0.16 }),
  ],
  no: () => [
    part(box(0.07, 0.72, 0.08), PAL.go, { y: HAND - 0.22 }),
    part(box(0.78, 0.045, 0.05), PAL.nau, { y: HAND - 0.54, z: 0.02 }),
    part(box(0.2, 0.04, 0.05), PAL.nau, { x: -0.44, y: HAND - 0.5, z: 0.02, rz: 0.35 }),
    part(box(0.2, 0.04, 0.05), PAL.nau, { x: 0.44, y: HAND - 0.5, z: 0.02, rz: -0.35 }),
    part(box(0.03, 0.4, 0.03), PAL.sat, { y: HAND - 0.4, z: 0.05 }),
  ],
  chuy: () => [
    part(cyl(0.04, 0.035, 1.15, 5), PAL.go, { y: HAND, z: 0.33, rx: Math.PI / 2 }),
    part(box(0.08, 0.08, 0.08), PAL.then, { y: HAND, z: -0.27 }),
    part(cyl(0.16, 0.13, 0.42, 7), PAL.then, { y: HAND, z: 1.02, rx: Math.PI / 2 }),
    ...[0, 1, 2, 3, 4, 5].map((i) => {
      const a = (i / 6) * Math.PI * 2;
      return part(cone(0.05, 0.16, 4), PAL.sat, { x: Math.cos(a) * 0.17, y: HAND + Math.sin(a) * 0.17, z: 1.02, rz: a - Math.PI / 2 });
    }),
    part(cone(0.06, 0.18, 4), PAL.sat, { y: HAND, z: 1.3, rx: Math.PI / 2 }),
  ],
};
// Khiên gắn cẳng tay trái: mặt khiên hướng +z của cẳng tay (cẳng tay buông → khiên che trước bụng).
const SHIELD = {
  tron: (face = PAL.nau, rim = PAL.then, boss = PAL.sat) => [
    part(cyl(0.34, 0.34, 0.05, 10), face, { y: -0.16, z: 0.1, rx: Math.PI / 2 }),
    part(cyl(0.37, 0.37, 0.035, 10), rim, { y: -0.16, z: 0.075, rx: Math.PI / 2 }),
    part(cyl(0.09, 0.1, 0.07, 6), boss, { y: -0.16, z: 0.14, rx: Math.PI / 2 }),
  ],
  nhat: () => [
    part(box(0.5, 0.74, 0.05), PAL.sonDam, { y: -0.14, z: 0.1 }),
    part(box(0.54, 0.06, 0.06), PAL.then, { y: 0.22, z: 0.1 }),
    part(box(0.54, 0.06, 0.06), PAL.then, { y: -0.5, z: 0.1 }),
    part(ico(0.1, 0), PAL.vang, { y: -0.14, z: 0.15 }),
  ],
};

// Thân người: hông (thắt lưng + vạt áo), thân (ngực, giáp, cổ, đầu, mũ, đồ sau lưng), tay, chân.
function human(o) {
  const c = o.cloth, a = o.armor ?? c, pants = o.pants ?? PAL.then, boot = o.boot ?? PAL.nau, skin = PAL.da;
  const wide = o.wide ?? 1;
  const pelvis = merge([
    part(box(0.42 * wide, 0.11, 0.27 * wide), o.belt ?? PAL.then, { y: 0.07 }),
    part(cyl(0.22 * wide, 0.29 * wide, 0.34, 8), o.skirt ?? c, { y: -0.1 }),
    ...(o.pelvisExtra || []),
  ]);
  const torso = merge([
    part(box(0.42 * wide, 0.48, 0.26 * wide), c, { y: 0.26 }),
    part(box(0.46 * wide, 0.3, 0.3 * wide), a, { y: 0.3 }),
    part(box(0.2, 0.08, 0.2), c, { y: 0.52 }),
    part(ico(0.15, 1), skin, { y: 0.68 }),
    ...(o.face || []),
    ...o.hat,
    ...(o.back || []),
  ]);
  const ua = (s) => merge([
    part(box(0.13, 0.3, 0.14), c, { y: -0.13 }),
    ...(o.pad ? [part(box(0.2 * wide, 0.12, 0.2 * wide), o.pad, { y: 0.0, x: 0.02 * s })] : []),
  ]);
  const fa = (extra) => merge([
    part(box(0.11, 0.27, 0.12), o.sleeve ?? c, { y: -0.13 }),
    part(box(0.125, 0.07, 0.13), o.cuff ?? a, { y: -0.21 }),
    part(ico(0.065, 0), skin, { y: HAND }),
    ...extra,
  ]);
  const th = () => merge([part(box(0.16, 0.44, 0.18), pants, { y: -0.22 })]);
  const sh = () => merge([
    part(box(0.14, 0.38, 0.16), boot, { y: -0.19 }),
    part(box(0.15, 0.09, 0.27), boot, { y: -0.4, z: 0.05 }),
    ...(o.wrap ? [part(box(0.15, 0.12, 0.17), o.wrap, { y: -0.08 })] : []),
  ]);
  return {
    pelvis, torso, uaL: ua(-1), uaR: ua(1), faL: fa(o.left || []), faR: fa(o.right || []),
    thL: th(), thR: th(), shL: sh(), shR: sh(),
  };
}

const quiver = (x = 0.12) => [
  part(cyl(0.07, 0.06, 0.52, 6), PAL.nau, { x, y: 0.28, z: -0.18, rz: 0.35 }),
  part(box(0.1, 0.1, 0.06), PAL.trung, { x: x - 0.1, y: 0.56, z: -0.18, rz: 0.35 }),
];
const beard = [part(box(0.12, 0.08, 0.05), PAL.toc, { y: 0.58, z: 0.13 })];

// ---- các kiểu lính ------------------------------------------------------------------------------
// Phe Nguyên: chàm + xám thép + lông thú, mũ nhọn. Phe Đại Việt: son + đen then + nón. Hai phe khác
// nhau cả dáng mũ, không chỉ màu (21.9).
const BUILD = {
  NG_DAO: () => human({
    cloth: PAL.cham, armor: PAL.thep, pad: PAL.thep, face: beard,
    hat: [
      part(cone(0.17, 0.32, 7), PAL.xam, { y: 0.9 }),
      part(cyl(0.2, 0.21, 0.07, 8), PAL.long, { y: 0.77 }),
      part(box(0.3, 0.2, 0.06), PAL.cham, { y: 0.66, z: -0.14 }),
    ],
    left: SHIELD.tron(), right: W.dao(),
  }),
  NG_GIAO: () => human({
    cloth: 0x34465a, armor: PAL.thep, pad: PAL.cham, boot: PAL.then, face: beard,
    hat: [
      part(cyl(0.16, 0.18, 0.16, 8), PAL.thep, { y: 0.82 }),
      part(cone(0.04, 0.24, 4), PAL.sat, { y: 1.02 }),
      part(ico(0.05, 0), PAL.son, { y: 1.13 }),
      part(box(0.34, 0.16, 0.24), PAL.cham, { y: 0.66, z: -0.06 }),
    ],
    left: SHIELD.tron(PAL.long, PAL.then, PAL.xam).map((g) => g.scale(0.72, 0.72, 0.72)), right: W.giao(PAL.long),
  }),
  NG_CUNG: () => human({
    cloth: 0x4b5364, armor: PAL.long, skirt: PAL.long, face: beard,
    hat: [
      part(cyl(0.21, 0.17, 0.12, 8), PAL.long, { y: 0.8 }),
      part(cone(0.14, 0.2, 7), PAL.cham, { y: 0.96 }),
    ],
    back: quiver(), left: W.cung(),
  }),
  NG_TANK: () => human({
    cloth: 0x2a2f38, armor: PAL.thep, pad: PAL.then, pants: PAL.cham, boot: PAL.then, wide: 1.28,
    cuff: PAL.then, wrap: PAL.thep,
    face: [part(box(0.26, 0.17, 0.06), PAL.sat, { y: 0.65, z: 0.14 })],
    hat: [
      part(cyl(0.19, 0.2, 0.26, 8), PAL.then, { y: 0.8 }),
      part(cone(0.1, 0.22, 6), PAL.thep, { y: 1.04 }),
      part(cone(0.05, 0.2, 4), PAL.vang, { y: 1.2 }),
      part(box(0.44, 0.08, 0.34), PAL.long, { y: 0.52 }),
    ],
    back: [part(box(0.66, 0.34, 0.08), PAL.long, { y: 0.34, z: -0.2 })],
    pelvisExtra: [part(box(0.5, 0.16, 0.34), PAL.thep, { y: -0.03 })],
    right: W.chuy(),
  }),
  DV_GIAO: () => human({
    cloth: PAL.son, armor: PAL.then, sleeve: PAL.son, cuff: PAL.then, pants: PAL.then, boot: PAL.then,
    hat: [part(cone(0.32, 0.15, 8), PAL.vai, { y: 0.86 }), part(cyl(0.1, 0.12, 0.05, 6), PAL.then, { y: 0.8 })],
    wrap: PAL.vai, right: W.giao(PAL.son, 2.8),
  }),
  DV_DAO: () => human({
    cloth: PAL.sonDam, armor: PAL.then, pad: PAL.then, pants: PAL.then, boot: PAL.then,
    hat: [part(box(0.34, 0.06, 0.31), PAL.son, { y: 0.72 }), part(ico(0.085, 0), PAL.toc, { y: 0.84, z: -0.04 })],
    wrap: PAL.vai, left: SHIELD.nhat(), right: W.dao(),
  }),
  DV_NO: () => human({
    cloth: PAL.son, armor: PAL.vai, skirt: PAL.vai, pants: PAL.then, boot: PAL.then,
    hat: [part(cone(0.26, 0.24, 8), PAL.vai, { y: 0.9 }), part(cyl(0.2, 0.21, 0.04, 8), PAL.then, { y: 0.79 })],
    back: [part(box(0.16, 0.34, 0.1), PAL.nau, { x: -0.1, y: 0.3, z: -0.17 })], wrap: PAL.vai, right: W.no(),
  }),
  NG_KY: () => {
    const leg = merge([
      part(box(0.13, 0.5, 0.14), PAL.ngua, { y: -0.2 }),
      part(box(0.1, 0.42, 0.1), PAL.nguaDen, { y: -0.62 }),
      part(box(0.13, 0.08, 0.15), PAL.then, { y: -0.86, z: 0.01 }),
    ]);
    const pelvis = merge([
      part(box(0.5, 0.55, 1.35), PAL.ngua, { y: 0 }),
      part(box(0.26, 0.62, 0.3), PAL.ngua, { y: 0.4, z: 0.74, rx: -0.6 }),
      part(box(0.2, 0.22, 0.46), PAL.nguaDen, { y: 0.68, z: 0.98 }),
      part(box(0.06, 0.4, 0.34), PAL.nguaDen, { y: 0.52, z: 0.62, rx: -0.6 }),
      part(box(0.1, 0.5, 0.1), PAL.nguaDen, { y: 0.02, z: -0.76, rx: 0.5 }),
      part(box(0.56, 0.08, 0.62), PAL.cham, { y: 0.3 }),
      part(box(0.14, 0.4, 0.14), PAL.cham, { x: -0.22, y: 0.3, z: 0.05, rz: 0.4 }),
      part(box(0.14, 0.4, 0.14), PAL.cham, { x: 0.22, y: 0.3, z: 0.05, rz: -0.4 }),
      part(box(0.14, 0.1, 0.22), PAL.then, { x: -0.3, y: 0.08, z: 0.1 }),
      part(box(0.14, 0.1, 0.22), PAL.then, { x: 0.3, y: 0.08, z: 0.1 }),
    ]);
    const torso = merge([
      part(box(0.4, 0.46, 0.26), PAL.thep, { y: 0.24 }),
      part(box(0.44, 0.12, 0.3), PAL.cham, { y: 0.04 }),
      part(ico(0.14, 1), PAL.da, { y: 0.62 }),
      ...beard.map((g) => g.clone().translate(0, -0.05, 0)),
      part(cyl(0.1, 0.19, 0.22, 6), PAL.long, { y: 0.8 }),
      part(cone(0.06, 0.16, 5), PAL.thep, { y: 0.98 }),
      ...quiver(0.1),
    ]);
    const ua = merge([part(box(0.12, 0.28, 0.13), PAL.thep, { y: -0.12 })]);
    const fa = (extra) => merge([part(box(0.11, 0.25, 0.12), PAL.cham, { y: -0.12 }), part(ico(0.06, 0), PAL.da, { y: -0.27 }), ...extra]);
    return { pelvis, torso, uaL: ua, uaR: ua.clone(), faL: fa(W.cung().map((g) => g.translate(0, 0.02, 0))), faR: fa([]),
      thL: leg, thR: leg.clone(), shL: leg.clone(), shR: leg.clone() };
  },
};

export function kitGeometry(kit) {
  const parts = BUILD[kit]();
  return { parts, skel: kit === "NG_KY" ? "horse" : "human" };
}

// ---- skinning instanced: một lượt vẽ cho cả kiểu lính -----------------------------------------------
// 10 khúc gộp thành một lưới, mỗi đỉnh mang số khúc (aBone). Ma trận thế giới của từng khúc (dạng
// affine 3 × 4, 3 texel RGBA) nằm trong texture float: lính i, khúc j ở texel (i·10 + j)·3, xếp liền
// theo hàng rộng BONE_TEX_W. Vertex shader đọc bằng texelFetch(gl_InstanceID); instanceMatrix để
// nguyên đơn vị. Nhờ vậy 8 kiểu lính chỉ tốn 8 lượt vẽ thay vì 80.
export const NJ = JOINT_NAMES.length, BONE_TEX_W = 1024, BONE_FLOATS = NJ * 12;

export function skinnedKit(kit, cap, material) {
  const { parts, skel } = kitGeometry(kit);
  let n = 0; for (const j of JOINT_NAMES) n += parts[j].attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), bone = new Float32Array(n);
  let o = 0;
  JOINT_NAMES.forEach((j, bi) => {
    const g = parts[j], c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3);
    bone.fill(bi, o, o + c); o += c;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aBone", new THREE.BufferAttribute(bone, 1));
  const rows = Math.ceil((cap * NJ * 3) / BONE_TEX_W);
  const data = new Float32Array(BONE_TEX_W * rows * 4);
  const tex = new THREE.DataTexture(data, BONE_TEX_W, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const mat = material.clone();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.boneTex = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
attribute float aBone;
uniform highp sampler2D boneTex;
mat4 boneMatrix() {
  int t = (gl_InstanceID * ${NJ} + int(aBone + 0.5)) * 3;
  vec4 r0 = texelFetch(boneTex, ivec2(t % ${BONE_TEX_W}, t / ${BONE_TEX_W}), 0);
  vec4 r1 = texelFetch(boneTex, ivec2((t + 1) % ${BONE_TEX_W}, (t + 1) / ${BONE_TEX_W}), 0);
  vec4 r2 = texelFetch(boneTex, ivec2((t + 2) % ${BONE_TEX_W}, (t + 2) / ${BONE_TEX_W}), 0);
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}`)
      .replace("#include <beginnormal_vertex>", `mat4 bm = boneMatrix();
vec3 objectNormal = normalize(mat3(bm) * vec3(normal));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif`)
      .replace("#include <begin_vertex>", `vec3 transformed = (bm * vec4(position, 1.0)).xyz;`);
  };
  mat.customProgramCacheKey = () => "skinnedKit";
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = false;
  return { mesh, data, tex, skel };
}

// Chép ma trận khớp (Matrix4, cột chính) vào mảng affine 3 × 4 theo hàng tại vị trí o.
export function writeAffine(out, o, e) {
  out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = e[12];
  out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = e[13];
  out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = e[14];
}

// ---- tư thế -------------------------------------------------------------------------------------
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - (1 - t) * (1 - t);

// Thế đứng cầm vũ khí (ready = đang giao chiến). Chỉ ghi các kênh tay/thân; chân do bước chạy lo.
const STANCE = {
  dao: (P, ready) => {
    if (ready) { P.rax = -0.4; P.raz = 0.18; P.rfx = -1.05; P.lax = -0.55; P.laz = -0.12; P.lfx = -0.55; P.ty += 0.12; }
    else { P.rax = -0.05; P.raz = 0.1; P.rfx = -0.45; P.lax = -0.12; P.laz = -0.1; P.lfx = -0.3; }
  },
  giao: (P, ready) => {
    if (ready) { P.rax = 0.05; P.raz = 0.14; P.ray = -0.1; P.rfx = -0.12; P.lax = -0.95; P.laz = 0.38; P.lfx = -0.2; P.ty += 0.32; }
    else { P.rax = -0.08; P.raz = 0.08; P.rfx = -1.45; P.lax = -0.05; P.laz = -0.08; P.lfx = -0.2; }
  },
  cung: (P, ready) => {
    if (ready) { P.lax = -0.7; P.laz = -0.1; P.lfx = -0.35; P.rax = -0.35; P.raz = 0.1; P.rfx = -1.0; P.ty += 0.25; }
    else { P.lax = -0.2; P.laz = -0.1; P.lfx = -0.3; P.rax = 0; P.raz = 0.1; P.rfx = -0.2; }
  },
  chuy: (P) => { P.rax = -0.55; P.raz = 0.22; P.rfx = -2.15; P.lax = -0.25; P.laz = -0.3; P.lfx = -0.7; },
  no: (P, ready) => {
    if (ready) { P.rax = -0.95; P.raz = 0.05; P.rfx = -0.55; P.lax = -1.0; P.laz = 0.42; P.lfx = -0.55; P.ty += 0.1; }
    else { P.rax = -0.05; P.raz = 0.08; P.rfx = -1.45; P.lax = -0.1; P.laz = -0.1; P.lfx = -0.25; }
  },
  ky: (P) => { P.lax = -0.45; P.laz = -0.1; P.lfx = -0.55; P.rax = -0.5; P.raz = 0.1; P.rfx = -0.9; },
};

// Đòn: K1 = đỉnh báo trước, K2 = cuối cú đánh. Báo trước trộn thế đứng → K1 (easeOut), cú đánh
// trộn K1 → K2 trong 0,1 s (easeOut), hồi thế trộn K2 → thế đứng.
const ATTACK = {
  dao: [
    { ty: 0.6, tx: -0.1, rax: -2.7, raz: 0.5, ray: 0.2, rfx: -0.75, lax: -0.75, laz: -0.05, lfx: -0.45, rtx: 0.25, ltx: -0.25, lsx: 0.25 },
    { ty: -0.55, tx: 0.32, rax: -0.3, raz: -0.5, ray: -0.2, rfx: 0.0, lax: -0.15, lfx: -0.25, fwd: 0.28, ltx: -0.55, lsx: 0.45, rtx: 0.3, rsx: 0.2, hipY: -0.09 },
  ],
  giao: [
    { ty: 0.65, tx: -0.06, rax: 0.5, raz: 0.18, rfx: -0.55, lax: -0.55, laz: 0.42, lfx: -0.1, fwd: -0.12, rtx: 0.3, ltx: -0.2 },
    { ty: -0.3, tx: 0.28, rax: -0.5, raz: 0.05, rfx: 0.28, lax: -1.3, laz: 0.2, lfx: 0.0, fwd: 0.5, ltx: -0.65, lsx: 0.35, rtx: 0.4, rsx: 0.15, hipY: -0.1 },
  ],
  cung: [
    { ty: 0.75, lax: -1.57, lay: -0.75, laz: 0, lfx: 0, rax: -1.5, ray: -0.95, raz: 0, rfx: -2.45, tx: -0.02 },
    { ty: 0.75, lax: -1.55, lay: -0.75, lfx: 0, rax: -1.35, ray: -0.2, raz: 0.3, rfx: -1.5, tx: -0.08 },
  ],
  chuy: [
    { rax: -2.95, raz: 0.05, rfx: -0.45, lax: -2.8, laz: 0.35, lfx: -0.55, tx: -0.32, ty: 0.12, hipY: 0.02, rtx: 0.2, ltx: -0.15 },
    { rax: -0.05, raz: -0.12, rfx: 0.15, lax: -0.35, laz: 0.5, lfx: -0.15, tx: 0.6, ty: -0.1, hipY: -0.24, fwd: 0.35, ltx: -0.75, lsx: 0.85, rtx: 0.35, rsx: 0.45 },
  ],
  no: [
    { rax: -1.1, raz: 0.02, rfx: -0.45, lax: -1.12, laz: 0.44, lfx: -0.45, tx: 0.06, ty: 0.15 },
    { rax: -1.35, rfx: -0.45, lax: -1.3, laz: 0.44, lfx: -0.45, tx: -0.14, ty: 0.15, fwd: -0.1 },
  ],
  ky: [
    { ty: 0.85, lax: -1.57, lay: -0.85, lfx: 0, rax: -1.5, ray: -1.0, rfx: -2.45 },
    { ty: 0.85, lax: -1.55, lay: -0.85, lfx: 0, rax: -1.3, ray: -0.3, raz: 0.3, rfx: -1.5 },
  ],
};
export const KIT_WEAPON = { NG_DAO: "dao", NG_GIAO: "giao", NG_CUNG: "cung", NG_TANK: "chuy", NG_KY: "ky", DV_GIAO: "giao", DV_DAO: "dao", DV_NO: "no" };

const P = {};
for (const k of KEYS) P[k] = 0;
const BASE = {};
function reset() { for (const k of KEYS) P[k] = 0; }
function mixInto(from, to, t) {
  for (const k in to) P[k] = (k in from ? from[k] : P[k]) + (to[k] - (k in from ? from[k] : P[k])) * t;
}

// Độ vung tay khi chạy theo vũ khí [tay trái, tay phải]: tay cầm thương, nỏ, chùy gần như giữ yên.
const SWING = { dao: [0.25, 0.3], giao: [0.1, 0.06], cung: [0.25, 0.45], chuy: [0.45, 0.08], no: [0.45, 0.06], ky: [0, 0] };

// Bước chạy người: pha ph (rad), amp 0..1 theo tốc độ.
function walk(ph, amp, sw) {
  const s = Math.sin(ph), c = Math.cos(ph);
  P.ltx = -0.72 * amp * s - 0.05; P.rtx = 0.72 * amp * s - 0.05;
  P.lsx = 0.12 + 1.05 * amp * Math.max(0, c); P.rsx = 0.12 + 1.05 * amp * Math.max(0, -c);
  P.hipY = -0.02 - 0.07 * amp * Math.abs(s);
  P.tx = 0.14 * amp; P.ty = 0.1 * amp * s; P.pelY = -0.14 * amp * s;
  P.lax += sw[0] * amp * s; P.rax -= sw[1] * amp * s;
}
function idleLegs(t, id) {
  const b = Math.sin(t * 1.8 + id) * 0.02;
  P.ltx = -0.14; P.lsx = 0.24; P.rtx = 0.1; P.rsx = 0.18; P.ltz = -0.05; P.rtz = 0.05;
  P.hipY = -0.035 + b * 0.5; P.tx = 0.04 + b;
}
function gallop(ph, amp) {
  const f = (o) => Math.sin(ph + o) * 0.75 * amp;
  P.ltx = f(0); P.rtx = f(0.5); P.lsx = f(Math.PI); P.rsx = f(Math.PI + 0.5);
  P.hipY = -0.1 * amp * Math.abs(Math.cos(ph)); P.pitch = 0.07 * amp * Math.sin(ph);
  P.tx = -0.1 * amp * Math.sin(ph) + 0.1 * amp;
}

// Dựng tư thế đích của một lính vào out (Float32Array NCH). t: đồng hồ trận.
export function poseFor(a, kit, K, t, out) {
  reset();
  const w = KIT_WEAPON[kit], horse = kit === "NG_KY", id = a.id * 1.37;
  const amp = Math.min(1, (a.spd || 0) / (horse ? 5 : 3.2));
  const ready = a.ready || a.windup > 0 || a.atkT < 0.5;
  STANCE[w](P, ready);
  if (horse) { if (amp > 0.05) gallop(a.walk, amp); }
  else if (amp > 0.05) walk(a.walk, amp, SWING[w]); else idleLegs(t, id);
  if (!horse && K.stable) { P.ltz -= 0.08; P.rtz += 0.08; P.lsx += 0.12; P.rsx += 0.12; P.hipY -= 0.04; }

  // đòn: báo trước → đánh → hồi
  const A = ATTACK[w];
  if (a.windup > 0) {
    for (const k of KEYS) BASE[k] = P[k];
    mixInto(BASE, A[0], easeOut(clamp01(1 - a.windup / (a.windupT || K.windup))));
    if (K.heavy) { P.tx -= 0.05 * Math.sin(t * 40); }      // lực sĩ gồng rung trước khi nện
  } else if (a.atkT < 0.5) {
    for (const k of KEYS) BASE[k] = P[k];
    const K1 = { ...BASE, ...A[0] }, K2 = { ...K1, ...A[1] };
    if (a.atkT < 0.16) { const s = easeOut(clamp01(a.atkT / 0.1)); for (const k of KEYS) P[k] = K1[k] + (K2[k] - K1[k]) * s; }
    else { const r = ease(clamp01((a.atkT - 0.16) / 0.34)); for (const k of KEYS) P[k] = K2[k] + (BASE[k] - K2[k]) * r; }
  }
  if (a.flinch > 0) { const k = a.flinch / 0.18; P.tx -= 0.22 * k; P.hipY -= 0.03 * k; }
  // đỡ khiên: giơ khiên che mặt, hạ trọng tâm, vũ khí thu về
  if (a.blockT > 0) {
    const k = Math.sin(clamp01(a.blockT / 0.32) * Math.PI) ** 0.5;
    P.lax += (-1.35 - P.lax) * k; P.laz += (0.25 - P.laz) * k; P.lfx += (-0.95 - P.lfx) * k;
    P.tx -= 0.12 * k; P.hipY -= 0.08 * k; P.lsx += 0.3 * k; P.rsx += 0.3 * k; P.ty += 0.25 * k;
  }
  // nhảy lùi né đòn gồng của tướng
  if (a.evadeT > 0 && !horse) {
    const k = Math.sin(clamp01(1 - a.evadeT / 0.3) * Math.PI);
    P.tx -= 0.3 * k; P.hipY += -0.12 * k + 0.1 * Math.sin(clamp01(1 - a.evadeT / 0.3) * Math.PI); P.ltx += 0.6 * k; P.lsx += 0.5 * k; P.rtx -= 0.35 * k; P.rsx += 0.6 * k;
    P.lax -= 0.4 * k; P.rax -= 0.3 * k;
  }
  // lao húc (lực sĩ): chạy cúi người, chùy giơ cao
  if (a.chargeT > 0) {
    const K1 = ATTACK[w][0];
    for (const k in K1) if (k[0] === "r" || k[0] === "l") { if (k[1] === "a" || k[1] === "f") P[k] = K1[k]; }
    P.tx = 0.45; P.ty = 0.1;
  }
  // tháo chạy: chạy cúi, hai tay vung loạn, vũ khí buông thõng
  if (a.fleeT > 0 && a.state === "move") {
    P.rax = -2.2 + 0.5 * Math.sin(t * 11 + id); P.lax = -2.0 + 0.5 * Math.cos(t * 10 + id); P.raz = 0.4; P.laz = -0.4; P.rfx = -0.4; P.lfx = -0.4;
    P.tx += 0.2;
  }

  // phản ứng
  const st = a.state;
  if (st === "hit") {
    const k = Math.sin(clamp01(1 - a.st / 0.32) * Math.PI) ** 0.6, d = a.hitFront ?? 1;
    P.tx -= 0.6 * k * d; P.pitch -= 0.12 * k * d; P.hipY -= 0.06 * k;
    P.rax += 0.9 * k; P.lax += 0.9 * k; P.raz += 0.5 * k; P.laz -= 0.5 * k; P.rfx -= 0.3 * k; P.lfx -= 0.3 * k;
    P.ltx += 0.35 * k * d; P.lsx += 0.3 * k; P.rsx += 0.35 * k; P.ty += 0.3 * k * (a.id % 2 ? 1 : -1);
  } else if (st === "launch") {
    const k = clamp01(a.st * 4);
    P.pitch = -Math.min(2.4, a.st * 6.5); P.lift = 0.3 * k;
    P.rax = -2.6; P.lax = -2.4; P.raz = 0.6; P.laz = -0.6; P.rfx = -0.4; P.lfx = -0.4;
    P.ltx = -0.9; P.lsx = 1.2; P.rtx = -0.4; P.rsx = 0.7; P.tx = -0.3;
  } else if (st === "down") {
    const up = clamp01((0.3 - a.st) / 0.3);          // 0,3 s cuối: chống tay đứng dậy
    lying(1 - up, -1); if (up > 0) { P.tx += 0.9 * up; P.lsx += 1.6 * up; P.rsx += 1.6 * up; P.ltx -= 1.0 * up; P.rtx -= 1.0 * up; P.hipY -= 0.4 * up; }
  } else if (st === "dead") {
    dying(a, horse);
  }
  if (a.panicT > 0 && st === "move" && a.windup <= 0) { P.rax = -2.5 + 0.3 * Math.sin(t * 9 + id); P.lax = -2.3; P.rfx = -0.3; }
  for (let i = 0; i < NCH; i++) out[i] = P[KEYS[i]];
  return out;
}

function lying(k, dir) {
  // dir −1 = nằm ngửa, +1 = nằm sấp. Gốc lưới ở chân nên nhấc lên một chút cho khỏi lún đất.
  P.pitch = 1.48 * dir * k; P.lift = 0.14 * k;
  P.rax = -2.6 * k; P.lax = -2.3 * k; P.raz = 0.7 * k; P.laz = -0.9 * k; P.rfx = -0.3 * k; P.lfx = -0.5 * k;
  P.ltx = -0.2 * k; P.lsx = 0.35 * k; P.rtx = 0.05 * k; P.rsx = 0.1 * k; P.tx = 0.05 * k * -dir; P.hipY = -0.02 * k;
  P.ltz = -0.12 * k; P.rtz = 0.15 * k;
}

// Bốn kiểu ngã theo id: ngửa, sấp, quỵ gối rồi đổ, xoay nghiêng. Ngựa đổ nghiêng.
function dying(a, horse) {
  const T = a.dieT, style = a.launchDeath ? 0 : a.id % 4;
  if (horse) {
    const k = ease(clamp01(T / 0.7));
    P.roll = 1.35 * k * (a.id % 2 ? 1 : -1); P.lift = 0.1 * k; P.ltx = -0.6 * k; P.rtx = 0.4 * k; P.lsx = 0.5 * k; P.rsx = -0.5 * k;
    P.tx = -0.6 * k; P.rax = -2.4 * k; P.lax = -2.0 * k;
    return;
  }
  if (style === 0) { lying(ease(clamp01(T / 0.5)), -1); P.tx -= 0.3 * Math.sin(clamp01(T / 0.5) * Math.PI); }
  else if (style === 1) {
    const b = ease(clamp01(T / 0.16)), f = ease(clamp01((T - 0.12) / 0.45));
    P.lsx += 0.9 * b; P.rsx += 0.7 * b; P.hipY -= 0.18 * b; P.tx += 0.4 * b;
    if (f > 0) { lying(f, 1); P.rax = -2.8 * f; P.lax = -2.6 * f; }
  } else if (style === 2) {
    const kn = ease(clamp01(T / 0.3)), f = ease(clamp01((T - 0.55) / 0.4));
    P.ltx = -1.45 * kn; P.rtx = -1.4 * kn; P.lsx = 2.5 * kn; P.rsx = 2.45 * kn; P.hipY = -0.46 * kn;
    P.tx = 0.35 * kn; P.rax = 0.1; P.lax = 0.1; P.rfx = -0.3; P.lfx = -0.3; P.raz = 0.15; P.laz = -0.15;
    if (f > 0) { P.pitch = 1.1 * f; P.lift = 0.05 * f; P.tx += 0.5 * f; P.rax = -1.6 * f; P.lax = -1.4 * f; }
  } else {
    const k = ease(clamp01(T / 0.55)), s = a.id % 8 < 4 ? 1 : -1;
    P.roll = 1.45 * k * s; P.lift = 0.12 * k; P.ty = 0.6 * k * s; P.tz = -0.3 * k * s;
    P.raz = 1.2 * k; P.laz = -1.2 * k; P.rax = -0.6 * k; P.ltx = -0.5 * k; P.lsx = 0.8 * k; P.rtx = 0.3 * k;
  }
}

// ---- ma trận khúc thân --------------------------------------------------------------------------
const _mats = {};
for (const j of HUMAN) _mats[j[0]] = new THREE.Matrix4();
const _local = new THREE.Matrix4(), _e = new THREE.Euler(), _root = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _sc = new THREE.Vector3(), _re = new THREE.Euler(0, 0, 0, "YXZ");

// Tính ma trận thế giới của từng khúc; gọi cb(tên khúc, ma trận) cho mỗi khúc.
export function jointMatrices(skel, x, y, z, yaw, scale, pose, cb) {
  const J = SKELETONS[skel];
  // gốc: vị trí, hướng, nhấc/lao tới, rồi ngã quanh bàn chân (pitch, roll), rồi tỉ lệ
  const fwd = pose[CH.fwd] * scale, sy = Math.sin(yaw), cy = Math.cos(yaw);
  _v.set(x + sy * fwd, y + pose[CH.lift] * scale, z + cy * fwd);
  _re.set(pose[CH.pitch], yaw, pose[CH.roll]); _q.setFromEuler(_re);
  _root.compose(_v, _q, _sc.setScalar(scale));
  for (const [name, parent, pv, cx, cy2, cz, order] of J) {
    _e.set(cx ? pose[CH[cx]] : 0, cy2 ? pose[CH[cy2]] : 0, cz ? pose[CH[cz]] : 0, order);
    _local.makeRotationFromEuler(_e);
    _local.elements[12] = pv[0]; _local.elements[13] = pv[1] + (name === "pelvis" ? pose[CH.hipY] : 0); _local.elements[14] = pv[2];
    _mats[name].multiplyMatrices(parent ? _mats[parent] : _root, _local);
    cb(name, _mats[name]);
  }
}
