// battle/soldiers.js — lính thường có khớp, vẽ instanced.
//
// Mỗi kiểu lính (KITS trong tuning) là một bộ lưới low poly chia theo khúc: hông (thắt lưng, eo),
// thân (kèm đầu, mũ), cánh tay trên, cẳng tay (kèm vũ khí, khiên), đùi, cẳng chân, bàn chân (xoay ở cổ
// chân), vạt trước, vạt sau (lò xo), tua giáo (dây treo). Các khúc gộp một lưới skinned; ma trận khúc =
// ma trận khúc cha × điểm xoay × góc khớp, tính trên CPU mỗi khung. Kỵ binh dùng bộ khớp ngựa: "đùi"/
// "cẳng" là bốn chân ngựa, "hông" là mình ngựa, "thân" là người cưỡi, vạt trước là chăn yên hai bên
// sườn, "tas" là đuôi ngựa.
//
// Kênh tư thế, bộ khớp, poseFor() và đường ống một lính mỗi khung (soldierFrame: IK chân bám đất, lò xo
// vạt áo, dây treo tua giáo) nằm ở soldier-motion.js (thuần, không three); file này dựng lưới và
// skinning, rồi xuất lại mọi thứ để crowd.js, lab.js import một chỗ.

import * as THREE from "three";
import { part, merge, PAL } from "./models.js";
import { JOINT_NAMES, NJ, BONE_FLOATS, HAND, SPEAR, TAS, jointsInto } from "./soldier-motion.js";

export { NCH, CH, SKELETONS, JOINT_NAMES, NJ, BONE_FLOATS, KIT_WEAPON, LEG, poseFor, soldierFrame, resetMotion,
  advanceStride, smoothPose, legRate, cycleLen, jointsInto } from "./soldier-motion.js";

// ---- hình khối ----------------------------------------------------------------------------------
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const EMPTY = () => merge([]);
// Tấm vạt: rộng trên wt, rộng dưới wb (loe hoặc thu), dài h, dày d; tâm tấm ở y = 0.
const slab = (wt, wb, h, d) => {
  const g = box(wt, h, d), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setX(i, p.getX(i) * wb / wt);
  return g;
};

// Vũ khí gắn ở bàn tay (khung cẳng tay). Đao, thương, chùy nằm dọc trục z (vuông góc cẳng tay): cẳng
// tay buông thì vũ khí chĩa ra trước. Nỏ nằm dọc cẳng tay: tay đưa ra trước thì nỏ chĩa ra trước.
const W = {
  dao: (blade = PAL.sat) => [
    part(box(0.045, 0.045, 0.2), PAL.then, { y: HAND, z: 0.0 }),
    part(box(0.14, 0.035, 0.045), PAL.vang, { y: HAND, z: 0.11 }),
    part(box(0.025, 0.075, 0.55), blade, { y: HAND + 0.01, z: 0.4 }),
    part(box(0.025, 0.06, 0.2), blade, { y: HAND + 0.04, z: 0.74, rx: -0.28 }),
  ],
  // tua lông ngựa không còn gắn cứng ở đây: treo ở khúc "tas" (TASSEL), chân mũi giáo z = len − 0,8
  giao: (len) => [
    part(cyl(0.022, 0.022, len, 5), PAL.go, { y: HAND, z: len / 2 - 0.8, rx: Math.PI / 2 }),
    part(cone(0.05, 0.28, 4), PAL.sat, { y: HAND, z: len - 0.66, rx: Math.PI / 2 }),
    part(cyl(0.03, 0.03, 0.05, 6), PAL.then, { y: HAND, z: len - 0.82, rx: Math.PI / 2 }),
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

// Tua lông ngựa ở chân mũi giáo, treo dọc −y từ điểm xoay (khúc "tas" luôn chĩa xuống theo dây treo):
// khâu buộc, chùm lông thon dài loe dần, túm nhọn ở đuôi. Dài ~0,33 m.
const TASSEL = (col) => merge([
  part(cyl(0.026, 0.028, 0.05, 6), PAL.then, { y: -0.015 }),
  part(cyl(0.028, 0.066, 0.24, 7), col, { y: -0.16 }),
  part(cone(0.066, 0.08, 7), col, { y: -0.32, rx: Math.PI }),
]);

// Vạt áo (khúc flF/flB, xoay ở eo trước/sau, tấm treo dọc −y). z0: đẩy tấm ra mặt ngoài eo (eo loe theo
// wide). Hai phe khác dáng, không chỉ màu (21.9):
//   dv    — Đại Việt: vạt trước hẹp, dài, thu nhọn xuống (như tấm yếm che), vạt sau rộng; viền gấu đen.
//   ng    — Nguyên: vạt trước xẻ đôi hai tấm loe, vạt sau một tấm loe; một hàng giáp lá ngang, viền da.
//   robe  — cung thủ Nguyên: áo dài vạt tới gối, xẻ đôi, không giáp lá.
//   plate — lực sĩ trọng giáp: phiến sắt dày, hai hàng đinh tán (lò xo cứng, ít đung đưa).
const FLAPS = {
  dv: (skirt, trim, armor, wide) => {
    const z0 = 0.185 * wide - 0.155;
    return {
      f: merge([
        part(slab(0.25 * wide, 0.17 * wide, 0.46, 0.03), skirt, { y: -0.23, z: z0 }),
        part(slab(0.18 * wide, 0.17 * wide, 0.05, 0.036), trim, { y: -0.44, z: z0 }),
      ]),
      b: merge([
        part(slab(0.36 * wide, 0.41 * wide, 0.42, 0.03), skirt, { y: -0.21, z: -z0 }),
        part(box(0.41 * wide, 0.05, 0.036), trim, { y: -0.4, z: -z0 }),
      ]),
    };
  },
  ng: (skirt, trim, armor, wide, len = 0.36, band = true) => {
    const z0 = 0.185 * wide - 0.155, w = 0.18 * wide, x = 0.1 * wide;
    const panel = (px, pz, wt, wb) => [
      part(slab(wt, wb, len, 0.035), skirt, { x: px, y: -len / 2, z: pz }),
      ...(band ? [part(box(wt * 1.08, 0.06, 0.042), armor, { x: px, y: -len * 0.45, z: pz })] : []),
      part(box(wb * 1.04, 0.04, 0.04), PAL.long, { x: px, y: -len + 0.02, z: pz }),
    ];
    return {
      f: merge([...panel(-x, z0, w, w * 1.18), ...panel(x, z0, w, w * 1.18)]),
      b: merge(panel(0, -z0, 0.38 * wide, 0.46 * wide)),
    };
  },
  robe: (skirt, trim, armor, wide) => FLAPS.ng(skirt, trim, armor, wide, 0.44, false),
  plate: (skirt, trim, armor, wide) => {
    const z0 = 0.185 * wide - 0.15, len = 0.3;
    const plate = (px, pz, wt, wb) => [
      part(slab(wt, wb, len, 0.05), armor, { x: px, y: -len / 2, z: pz }),
      part(box(wt * 0.8, 0.025, 0.056), PAL.then, { x: px, y: -0.09, z: pz }),
      part(box(wb * 0.8, 0.025, 0.056), PAL.then, { x: px, y: -0.2, z: pz }),
    ];
    return {
      f: merge([...plate(-0.105 * wide, z0, 0.19 * wide, 0.22 * wide), ...plate(0.105 * wide, z0, 0.19 * wide, 0.22 * wide)]),
      b: merge(plate(0, -z0, 0.42 * wide, 0.48 * wide)),
    };
  },
};

// Thân người: hông (thắt lưng + khúc eo ngắn), vạt trước, vạt sau, thân (ngực, giáp, cổ, đầu, mũ, đồ sau
// lưng), tay, chân, bàn chân (xoay ở cổ chân: cổ chân 0 thì trông y như trước khi tách).
function human(o) {
  const c = o.cloth, a = o.armor ?? c, pants = o.pants ?? PAL.then, boot = o.boot ?? PAL.nau, skin = PAL.da;
  const wide = o.wide ?? 1, skirt = o.skirt ?? c, belt = o.belt ?? PAL.then;
  const pelvis = merge([
    part(box(0.42 * wide, 0.11, 0.27 * wide), belt, { y: 0.07 }),
    part(cyl(0.2 * wide, 0.225 * wide, 0.15, 8), skirt, { y: -0.02, sz: 0.82 }),
    ...(o.pelvisExtra || []),
  ]);
  const flap = FLAPS[o.flap || "dv"](skirt, belt, a, wide);
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
    ...(o.wrap ? [part(box(0.15, 0.12, 0.17), o.wrap, { y: -0.08 })] : []),
  ]);
  // đế giày: trước ở khung cẳng chân (y −0,4); cổ chân ở cẳng chân y −0,36 → khung cổ chân y −0,04
  const ft = () => merge([part(box(0.15, 0.09, 0.27), boot, { y: -0.04, z: 0.05 })]);
  return {
    pelvis, torso, uaL: ua(-1), uaR: ua(1), faL: fa(o.left || []), faR: fa(o.right || []),
    thL: th(), thR: th(), shL: sh(), shR: sh(), ftL: ft(), ftR: ft(), flF: flap.f, flB: flap.b,
    tas: o.tassel !== undefined ? TASSEL(o.tassel) : EMPTY(),
  };
}

const quiver = (x = 0.12) => [
  part(cyl(0.07, 0.06, 0.52, 6), PAL.nau, { x, y: 0.28, z: -0.18, rz: 0.35 }),
  part(box(0.1, 0.1, 0.06), PAL.trung, { x: x - 0.1, y: 0.56, z: -0.18, rz: 0.35 }),
];
const beard = [part(box(0.12, 0.08, 0.05), PAL.toc, { y: 0.58, z: 0.13 })];

// ---- các kiểu lính ------------------------------------------------------------------------------
// Phe Nguyên: chàm + xám thép + lông thú, mũ nhọn. Phe Đại Việt: son + đen then + nón. Hai phe khác
// nhau cả dáng mũ, dáng vạt áo, không chỉ màu (21.9).
const BUILD = {
  NG_DAO: () => human({
    cloth: PAL.cham, armor: PAL.thep, pad: PAL.thep, face: beard, flap: "ng",
    hat: [
      part(cone(0.17, 0.32, 7), PAL.xam, { y: 0.9 }),
      part(cyl(0.2, 0.21, 0.07, 8), PAL.long, { y: 0.77 }),
      part(box(0.3, 0.2, 0.06), PAL.cham, { y: 0.66, z: -0.14 }),
    ],
    left: SHIELD.tron(), right: W.dao(),
  }),
  NG_GIAO: () => human({
    cloth: 0x34465a, armor: PAL.thep, pad: PAL.cham, boot: PAL.then, face: beard, flap: "ng",
    hat: [
      part(cyl(0.16, 0.18, 0.16, 8), PAL.thep, { y: 0.82 }),
      part(cone(0.04, 0.24, 4), PAL.sat, { y: 1.02 }),
      part(ico(0.05, 0), PAL.son, { y: 1.13 }),
      part(box(0.34, 0.16, 0.24), PAL.cham, { y: 0.66, z: -0.06 }),
    ],
    left: SHIELD.tron(PAL.long, PAL.then, PAL.xam).map((g) => g.scale(0.72, 0.72, 0.72)), right: W.giao(SPEAR.NG_GIAO), tassel: PAL.long,
  }),
  NG_CUNG: () => human({
    cloth: 0x4b5364, armor: PAL.long, skirt: PAL.long, face: beard, flap: "robe",
    hat: [
      part(cyl(0.21, 0.17, 0.12, 8), PAL.long, { y: 0.8 }),
      part(cone(0.14, 0.2, 7), PAL.cham, { y: 0.96 }),
    ],
    back: quiver(), left: W.cung(),
  }),
  NG_TANK: () => human({
    cloth: 0x2a2f38, armor: PAL.thep, pad: PAL.then, pants: PAL.cham, boot: PAL.then, wide: 1.28, flap: "plate",
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
    wrap: PAL.vai, right: W.giao(SPEAR.DV_GIAO), tassel: PAL.son,
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
      part(box(0.11, 0.13, 0.2), PAL.nguaDen, { y: 0.17, z: -0.73, rx: 0.55 }),           // gốc đuôi (đuôi treo ở "tas")
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
    // vạt chăn yên hai bên sườn, sau chân người cưỡi (xoay trước/sau theo nước phi)
    const cloth = (s) => [
      part(box(0.03, 0.3, 0.3), PAL.cham, { x: 0.29 * s, y: -0.15 }),
      part(box(0.036, 0.05, 0.31), PAL.long, { x: 0.29 * s, y: -0.3 }),
    ];
    // đuôi: treo dọc −y từ gốc đuôi, dẹt theo bề ngang ngựa
    const tail = merge([
      part(cyl(0.05, 0.085, 0.48, 5), PAL.nguaDen, { y: -0.26, sx: 0.75 }),
      part(cone(0.085, 0.16, 5), PAL.nguaDen, { y: -0.58, rx: Math.PI, sx: 0.75 }),
    ]);
    return { pelvis, torso, uaL: ua, uaR: ua.clone(), faL: fa(W.cung().map((g) => g.translate(0, 0.02, 0))), faR: fa([]),
      thL: leg, thR: leg.clone(), shL: leg.clone(), shR: leg.clone(), ftL: EMPTY(), ftR: EMPTY(),
      flF: merge([...cloth(-1), ...cloth(1)]), flB: EMPTY(), tas: tail };
  },

  // Cung thủ áo Tống (Cờ áo Tống): chỉ dùng khi chưa nạp được kit/DV_AOTONGh (thử trong Node, mô hình lỗi) — áo hổ phách, khăn xanh ngọc, cung Việt ở tay trái, ống tên sau lưng.
  DV_AOTONG: () => human({
    cloth: 0xb0752c, armor: PAL.nau, skirt: 0xb0752c, pants: PAL.then, boot: PAL.then,
    hat: [part(box(0.34, 0.06, 0.31), PAL.then, { y: 0.72 }), part(ico(0.085, 0), PAL.toc, { y: 0.84, z: -0.04 })],
    back: quiver(), wrap: 0x3f8f7a, left: W.cung(),
  }),

  // ==== DÂN LÀNG chạy loạn (Hư cấu) — chỉ ambient.js dựng; KHÔNG thêm vào KITS trong tuning.js (Crowd dựng
  // lưới cho mọi kiểu trong KITS và code đánh nhau duyệt tác tử đám đông; dân không phải tác tử). Hàm dựng
  // villager() ở cuối file. ==========================================================================
  DAN_NAM: () => villager("nam"),       // đàn ông gánh quang gánh / cụ già chống gậy
  DAN_NU: () => villager("nu"),         // đàn bà: tay nải đội đầu, ôm hông, bế con
  DAN_TRE: () => villager("tre"),       // trẻ con (đi bộ, hoặc được bế)
};

export function kitGeometry(kit) {
  const parts = BUILD[kit]();
  return { parts, skel: kit === "NG_KY" ? "horse" : "human" };
}

// ---- skinning instanced: một lượt vẽ cho cả kiểu lính -----------------------------------------------
// NJ khúc gộp thành một lưới, mỗi đỉnh mang số khúc (aBone). Ma trận thế giới của từng khúc (dạng
// affine 3 × 4, 3 texel RGBA) nằm trong texture float: lính i, khúc j ở texel (i·NJ + j)·3, xếp liền
// theo hàng rộng BONE_TEX_W. Vertex shader đọc bằng texelFetch(gl_InstanceID); instanceMatrix để
// nguyên đơn vị. Nhờ vậy 8 kiểu lính chỉ tốn 8 lượt vẽ thay vì 8 × NJ.
export const BONE_TEX_W = 1024;

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
  mat.customProgramCacheKey = () => "skinnedKit" + NJ;
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = false;
  return { mesh, data, tex, skel };
}

// ---- lính GLB (design/tools/bake/kit.mjs, glb.js): 3 mức chi tiết, mỗi đỉnh ≤ 2 khúc ---------------------------------------------
// Lưới ở tư thế nghỉ của bộ khúc (toạ độ khung gốc lính, khúc nghỉ chỉ tịnh tiến tới piv); aSkin = (khúc 0, khúc 1, trọng số khúc 0
// × 255, 0): p = w·M₀·(v − piv₀) + (1 − w)·M₁·(v − piv₁), M lấy từ cùng texture khớp như skinnedKit. Ba InstancedMesh (LOD0–2)
// chung một texture khớp: lính của mức l nằm liền nhau từ chỉ số uBase (Crowd.render xếp theo mức), mỗi mức một màu instance.
export function glbKit(kit, G, cap) {
  const skel = G.meta.skel;
  // neo tua giáo ở chân mũi giáo Meshy (design/tools/bake/kit.mjs meta.tas; neo của giáo dựng bằng code rơi giữa lưỡi giáo Meshy)
  if (G.meta.tas && TAS[kit]) TAS[kit].p = G.meta.tas;
  const rows = Math.ceil((cap * NJ * 3) / BONE_TEX_W);
  const data = new Float32Array(BONE_TEX_W * rows * 4);
  const tex = new THREE.DataTexture(data, BONE_TEX_W, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  const piv = G.meta.piv.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const meshes = [], colors = [], bases = [];
  for (let l = 0; G.geos["lod" + l]; l++) {
    // LOD0 dán texture atlas; LOD1–2 tô màu đỉnh (lấy mẫu từ atlas lúc nướng, UV bỏ đi)
    const geo = G.geos["lod" + l], vc = !!geo.attributes.color;
    const mat = new THREE.MeshLambertMaterial(vc ? { vertexColors: true } : { map: G.tex });
    const base = { value: 0 };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.boneTex = { value: tex }; sh.uniforms.uBase = base; sh.uniforms.uPiv = { value: piv };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>
attribute vec4 aSkin;
uniform highp sampler2D boneTex;
uniform int uBase;
uniform vec3 uPiv[${NJ}];
mat4 boneM(int b) {
  int t = ((gl_InstanceID + uBase) * ${NJ} + b) * 3;
  vec4 r0 = texelFetch(boneTex, ivec2(t % ${BONE_TEX_W}, t / ${BONE_TEX_W}), 0);
  vec4 r1 = texelFetch(boneTex, ivec2((t + 1) % ${BONE_TEX_W}, (t + 1) / ${BONE_TEX_W}), 0);
  vec4 r2 = texelFetch(boneTex, ivec2((t + 2) % ${BONE_TEX_W}, (t + 2) / ${BONE_TEX_W}), 0);
  return mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0);
}`)
        .replace("#include <beginnormal_vertex>", `int sb0 = int(aSkin.x + 0.5), sb1 = int(aSkin.y + 0.5);
float sw0 = aSkin.z / 255.0;
mat4 sm0 = boneM(sb0), sm1 = boneM(sb1);
vec3 objectNormal = normalize(mat3(sm0) * vec3(normal) * sw0 + mat3(sm1) * vec3(normal) * (1.0 - sw0));
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif`)
        .replace("#include <begin_vertex>", `vec3 transformed = (sm0 * vec4(position - uPiv[sb0], 1.0)).xyz * sw0 + (sm1 * vec4(position - uPiv[sb1], 1.0)).xyz * (1.0 - sw0);`);
    };
    mat.customProgramCacheKey = () => "glbKit" + NJ + (vc ? "c" : "t");
    const mesh = new THREE.InstancedMesh(geo, mat, cap);
    mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = false;
    const col = mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    meshes.push(mesh); colors.push(col); bases.push(base);
  }
  return { glb: true, meshes, colors, bases, data, tex, skel, mesh: meshes[0] };
}

// Chép ma trận khớp (Matrix4, cột chính) vào mảng affine 3 × 4 theo hàng tại vị trí o.
export function writeAffine(out, o, e) {
  out[o] = e[0]; out[o + 1] = e[4]; out[o + 2] = e[8]; out[o + 3] = e[12];
  out[o + 4] = e[1]; out[o + 5] = e[5]; out[o + 6] = e[9]; out[o + 7] = e[13];
  out[o + 8] = e[2]; out[o + 9] = e[6]; out[o + 10] = e[10]; out[o + 11] = e[14];
}
// Ngược lại: affine 3 × 4 theo hàng tại o → Matrix4 (dùng ở lab, nơi mỗi khúc là một InstancedMesh).
export function affineToMatrix(a, o, m) {
  return m.set(a[o], a[o + 1], a[o + 2], a[o + 3], a[o + 4], a[o + 5], a[o + 6], a[o + 7], a[o + 8], a[o + 9], a[o + 10], a[o + 11], 0, 0, 0, 1);
}

// Tương thích kiểu cũ: ma trận thế giới từng khúc theo tư thế thô (không IK, không vạt/tua), gọi
// cb(tên khúc, Matrix4). Đường ống đầy đủ là soldierFrame().
const _jm = new Float64Array(BONE_FLOATS), _m4 = new THREE.Matrix4();
export function jointMatrices(skel, x, y, z, yaw, scale, pose, cb) {
  jointsInto(skel, x, y, z, yaw, scale, pose, _jm);
  for (let j = 0; j < NJ; j++) cb(JOINT_NAMES[j], affineToMatrix(_jm, j * 12, _m4));
}

// ==== DÂN LÀNG chạy loạn (Hư cấu; "vườn không nhà trống" 1285 là Chính sử) — lưới cho BUILD.DAN_* =========
// Dân thường thời Trần: áo nâu (nhuộm củ nâu) ngắn qua hông, quần thâm xắn ống hoặc váy đen, nón lá, khăn
// vấn, chân đất. Cùng bộ khớp người như lính; khúc nào dân không cần thì mượn làm đồ mang, ambient.js tính
// lại ma trận của chúng sau soldierFrame:
//   DAN_NAM — vạt trước/sau là hai thúng quang gánh (dây quang từ gốc = đầu đòn, treo dọc −y), "tas" là
//             thanh tre dài 1 dọc z quanh gốc (kéo dài thành đòn gánh trên vai, hoặc gậy chống của cụ già);
//   DAN_NU  — vạt là hai tấm váy (lò xo như vạt áo lính), "tas" là tay nải, đáy ở gốc (đội đầu / ôm hông);
//   DAN_TRE — đầu to so với người (vóc ×0,6), quần cộc; "tas" là bọc nhỏ xách tay (gốc = nút buộc, nằm ở
//             bàn tay phải như gốc khúc "tas" mặc định).
// Đế bàn chân thấp hơn cổ chân đúng LEG.SOLE (0,085) như giày lính, để IK chân đặt đúng mặt đất.
const DAN = { ao: 0x5e4330, aoNu: 0x684832, aoTre: 0x6f5238, quan: 0x2b2825, vay: 0x221f1c, gau: 0x3a2f28, that: 0x8a7550,
  thatNu: 0x7a5a36, chan: 0xa8784e, non: 0xd8c48e, khan: 0x2e2622, tre: 0xb19a5c, thung: 0x8c7a52, vanh: 0x6f5f3e,
  quang: 0x6a5838, gao: 0xcdbd92, noi: 0x7a4a2e, chieu: 0xb8a070, boc: 0x3d4a5e, nut: 0x55627a };
// dây/thanh mảnh từ a tới b
function cord(a, b, col, w = 0.018) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const g = box(w, L, w);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L)));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return part(g, col);
}
// Thúng quang gánh: bốn dây quang chụm ở gốc (đầu đòn), vành thúng ở −0,74, đáy ở −1,02 (ambient.js dùng số
// này để thúng đặt lên đất khi người ngồi xổm). Thúng trước: gạo và nồi đất; thúng sau: bọc vải, chiếu cuộn.
function basket(front) {
  const p = [];
  for (let k = 0; k < 4; k++) { const a = (k + 0.5) * Math.PI / 2; p.push(cord([0, 0, 0], [Math.cos(a) * 0.21, -0.74, Math.sin(a) * 0.21], DAN.quang)); }
  p.push(part(cyl(0.25, 0.19, 0.28, 9), DAN.thung, { y: -0.88 }), part(cyl(0.265, 0.265, 0.045, 9), DAN.vanh, { y: -0.745 }));
  if (front) p.push(part(ico(0.23, 0), DAN.gao, { y: -0.74, sy: 0.45 }), part(ico(0.1, 0), DAN.noi, { x: 0.07, y: -0.65, z: 0.05 }),
    part(cyl(0.045, 0.065, 0.05, 6), DAN.noi, { x: 0.07, y: -0.56, z: 0.05 }));
  else p.push(part(box(0.3, 0.15, 0.24), DAN.boc, { y: -0.68, ry: 0.4 }), part(cyl(0.06, 0.06, 0.5, 6), DAN.chieu, { y: -0.6, z: -0.03, rz: Math.PI / 2, ry: -0.3 }));
  return merge(p);
}
function villager(kind) {
  const nam = kind === "nam", nu = kind === "nu", tre = kind === "tre", skin = PAL.da;
  const ao = nam ? DAN.ao : nu ? DAN.aoNu : DAN.aoTre;
  // hông: thắt lưng + vạt áo cánh (nam, trẻ; trẻ thêm cạp quần cộc) hoặc cạp váy (nữ)
  const pelvis = merge(nu ? [
    part(box(0.34, 0.06, 0.24), DAN.thatNu, { y: 0.07 }),
    part(cyl(0.2, 0.235, 0.22, 8), DAN.vay, { y: -0.04, sz: 0.85 }),
  ] : [
    part(box(0.36, 0.06, 0.24), DAN.that, { y: 0.07 }),
    part(cyl(0.195, 0.215, 0.17, 8), ao, { y: -0.01, sz: 0.82 }),
    ...(tre ? [part(cyl(0.2, 0.205, 0.08, 8), DAN.quan, { y: -0.1, sz: 0.85 })] : []),
  ]);
  // thân, đầu; nam: búi tó, khăn vấn dưới nón lá; nữ: khăn vấn quấn tóc; trẻ: đầu to, chỏm tóc trái đào
  const hy = tre ? 0.68 : 0.64;
  const torso = merge([
    part(box(nu ? 0.34 : 0.38, 0.44, 0.23), ao, { y: 0.25 }),
    part(box(0.13, 0.08, 0.13), skin, { y: 0.5 }),
    part(ico(tre ? 0.19 : nu ? 0.135 : 0.14, 1), skin, { y: hy }),
    ...(nam ? [
      part(ico(0.065, 0), PAL.toc, { y: hy + 0.05, z: -0.12 }),
      part(cyl(0.145, 0.15, 0.05, 8), DAN.khan, { y: hy + 0.07 }),
      part(cone(0.34, 0.18, 12), DAN.non, { y: hy + 0.17 }),
    ] : nu ? [
      part(cyl(0.148, 0.152, 0.08, 8), DAN.khan, { y: hy + 0.06 }),
      part(ico(0.125, 0), DAN.khan, { y: hy + 0.1, sy: 0.5 }),
    ] : [
      part(ico(0.075, 0), PAL.toc, { y: hy + 0.17, z: 0.06 }),
    ]),
  ]);
  const ua = () => merge(tre ? [part(box(0.12, 0.2, 0.13), ao, { y: -0.09 }), part(box(0.1, 0.12, 0.11), skin, { y: -0.23 })]
    : [part(box(0.12, 0.29, 0.13), ao, { y: -0.13 })]);
  // nữ: tay áo dài tới cổ tay; nam: xắn tay áo quá khuỷu; trẻ: cẳng tay trần
  const fa = () => merge(nu ? [part(box(0.105, 0.26, 0.115), ao, { y: -0.13 }), part(ico(0.058, 0), skin, { y: HAND })]
    : [...(nam ? [part(box(0.125, 0.06, 0.135), ao, { y: -0.03 })] : []), part(box(0.095, 0.25, 0.1), skin, { y: -0.14 }), part(ico(0.058, 0), skin, { y: HAND })]);
  // chân: nam quần thâm xắn giữa ống chân, nữ đùi màu váy (khe giữa hai tấm váy), trẻ quần cộc; chân đất
  const th = () => merge(tre ? [part(box(0.15, 0.2, 0.17), DAN.quan, { y: -0.1 }), part(box(0.12, 0.25, 0.13), skin, { y: -0.32 })]
    : [part(box(0.15, 0.44, 0.17), nu ? DAN.vay : DAN.quan, { y: -0.22 })]);
  const sh = () => merge(nam ? [part(box(0.15, 0.12, 0.17), DAN.quan, { y: -0.05 }), part(box(0.11, 0.27, 0.12), skin, { y: -0.23 })]
    : [part(box(0.11, 0.37, 0.12), skin, { y: -0.185 })]);
  const ft = () => merge([part(box(0.115, 0.07, 0.25), DAN.chan, { y: -0.05, z: 0.05 })]);
  // váy: hai tấm dài tới giữa ống chân, viền gấu sẫm (z: đẩy ra mặt ngoài cạp váy như vạt áo lính)
  const skirt = (wt, wb, len, z) => merge([part(slab(wt, wb, len, 0.03), DAN.vay, { y: -len / 2, z }), part(slab(wb * 0.99, wb, 0.05, 0.036), DAN.gau, { y: -len + 0.025, z })]);
  let tas;
  if (nam) tas = merge([part(box(0.06, 0.03, 1), DAN.tre, {}), part(box(0.07, 0.036, 0.04), DAN.quang, { z: 0.47 }), part(box(0.07, 0.036, 0.04), DAN.quang, { z: -0.47 })]);
  else if (nu) tas = merge([part(box(0.36, 0.19, 0.28), DAN.boc, { y: 0.095 }), part(ico(0.065, 0), DAN.nut, { y: 0.2, z: 0.03 }),
    part(cone(0.05, 0.12, 4), DAN.nut, { x: 0.05, y: 0.23, z: 0.05, rz: -0.6 }), part(cone(0.05, 0.12, 4), DAN.nut, { x: -0.05, y: 0.23, z: 0.05, rz: 0.6 })]);
  else tas = merge([part(ico(0.05, 0), DAN.nut, { y: -0.03 }), part(box(0.22, 0.17, 0.16), DAN.boc, { y: -0.15 })]);
  return {
    pelvis, torso, uaL: ua(), uaR: ua(), faL: fa(), faR: fa(), thL: th(), thR: th(), shL: sh(), shR: sh(), ftL: ft(), ftR: ft(),
    flF: nam ? basket(true) : nu ? skirt(0.3, 0.4, 0.68, 0.035) : EMPTY(),
    flB: nam ? basket(false) : nu ? skirt(0.34, 0.44, 0.66, -0.035) : EMPTY(),
    tas,
  };
}
