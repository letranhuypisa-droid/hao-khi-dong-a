// battle/boats.js — thuyền B20 Bạch Đằng: hình khối low poly theo loại (chiến thuyền Nguyên, kỳ hạm Ô Mã Nhi, thuyền
// hộ vệ, thuyền dò luồng, thuyền nhẹ quân Trần), thuyền chạy theo đường cong + dập dềnh + mắc cạn, và bộ vẽ cả hạm đội
// bằng InstancedMesh theo loại × mức chi tiết (LOD).
//
// Hợp đồng B20 §5. Gốc toạ độ mỗi thuyền ở đường mớn nước giữa thân (+z mũi, y lên); đáy (ky) ở y = −draft, boong ở
// +deckY. Mặt đi được, tường, cửa của boong nằm trong HULLS[type].deck (xem battle/deck.js).
// Canon (canon-b20.json): hạm đội chỉ 3 loại mesh thuyền lớn (junk, kỳ hạm, hộ vệ); thuyền dò và thuyền nhẹ là thuyền
// nhỏ. Hình dáng (lầu đuôi cao, buồm có nẹp tre, mắt thuyền) là Hư cấu dựa trên thuyền buồm Trung Hoa thế kỷ 13;
// kích thước và số liệu dưới đây là ĐỀ XUẤT BẢN THỬ.

import * as THREE from "three";
import { PAL, lambert } from "./models.js";
import { Deck, poseMatrix } from "./deck.js";
import { makeRng } from "../core/rng.js";
import { waveY } from "../data/terrain-b20.js";
import { STAKE_TOP } from "../data/river-b20.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// sóng: dùng đúng hàm của mặt nước (terrain-b20 WAVES, water.js sinh GLSL từ cùng bảng) để thuyền nhấp nhô khớp nước
export { waveY };

// ---- số liệu thuyền (ĐỀ XUẤT BẢN THỬ) --------------------------------------------------------------------------------
// len × beam (m), deckY boong trên mớn nước, draft mớn nước, hp độ bền (FLEET.shipHp 5000 cho chiến thuyền — hợp đồng §2).
// deck: mặt đi được (cục bộ), tường (khối đặc), cửa (lên/xuống). flagAt: đỉnh cán cờ chữ (cục bộ), flagSize: lá cờ.
const R = (x0, x1, z0, z1, y, sz = 0, sx = 0) => ({ x0, x1, z0, z1, y, sx, sz });
const W = (x0, x1, z0, z1, h) => ({ x0, x1, z0, z1, h });
const mastW = (z, r = 0.35, x = 0) => W(x - r, x + r, z - r, z + r, 40);
export const HULLS = {
  junk: {
    name: "Chiến thuyền Nguyên", family: "yuan", len: 24, beam: 7, deckY: 2.6, draft: 1.4, hp: 5000,
    deck: {
      rects: [R(-2.8, 2.8, -6.0, 7.0, 2.6), R(-2.15, 2.15, 7.0, 10.0, 2.6)],
      walls: [W(-3.3, 3.3, -12.5, -6.2, 5.2), mastW(1), mastW(7.8, 0.3)],
      portals: [{ lx: 2.8, lz: 0, r: 1.5 }, { lx: -2.8, lz: 0, r: 1.5 }],
    },
    flagAt: [-2.3, 11.4, -11.2], flagSize: { w: 1.3, h: 3.4 },
  },
  // Kỳ hạm Ô Mã Nhi: boong dưới +3,0; lầu chỉ huy là khối đặc, mặt trên +6,0 chỉ lên được qua một cầu thang giữa
  // thân (mặt dốc z −6,05 → 2,0); đình nhỏ trên lầu (cột là tường).
  flagship: {
    name: "Kỳ hạm Nguyên", family: "yuan", len: 36, beam: 9, deckY: 3.0, topY: 6.0, draft: 1.9, hp: 15000,
    deck: {
      rects: [
        R(-3.7, 3.7, -15.5, -6.05, 6.0),                    // mặt lầu
        R(-1.1, 1.1, -6.05, 2.0, 6.0, -3 / 8.05),           // cầu thang: 6,0 ở z −6,05 xuống 3,0 ở z 2,0
        R(-3.85, -1.1, -5.9, 2.0, 3.0), R(1.1, 3.85, -5.9, 2.0, 3.0),   // boong dưới hai bên cầu thang
        R(-3.85, 3.85, 2.0, 8.5, 3.0), R(-3.4, 3.4, 8.5, 12.5, 3.0), R(-2.5, 2.5, 12.5, 16.0, 3.0),
      ],
      walls: [W(-4.6, 4.6, -18.5, -6.05, 6.0), mastW(4.5, 0.45), mastW(12.8, 0.4),
        ...[[-2.2, -15.0], [2.2, -15.0], [-2.2, -12.4], [2.2, -12.4]].map(([x, z]) => W(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 9.4))],
      portals: [{ lx: 3.85, lz: 5, r: 1.6 }, { lx: -3.85, lz: 5, r: 1.6 }],
    },
    flagAt: [0, 15.5, -13.7], flagSize: { w: 2.2, h: 5.0 },
  },
  escort: {
    name: "Thuyền hộ vệ", family: "yuan", len: 16, beam: 4.5, deckY: 1.8, draft: 0.9, hp: 2500,
    deck: {
      rects: [R(-1.85, 1.85, -4.0, 3.5, 1.8), R(-1.25, 1.25, 3.5, 6.8, 1.8)],
      walls: [W(-2.4, 2.4, -8.5, -4.2, 3.3), mastW(1, 0.3), mastW(5.6, 0.25)],
      portals: [{ lx: 1.85, lz: 0, r: 1.3 }, { lx: -1.85, lz: 0, r: 1.3 }],
    },
    flagAt: [-1.4, 7.4, -7.2], flagSize: { w: 1.0, h: 2.6 },
  },
  scout: {
    name: "Thuyền dò luồng", family: "yuan", len: 9, beam: 2.2, deckY: 0.8, draft: 0.5, hp: 900,
    deck: {
      rects: [R(-0.7, 0.7, -3.3, 3.2, 0.8)],
      walls: [mastW(0.8, 0.2)],
      portals: [{ lx: 0.7, lz: 0, r: 1.2 }, { lx: -0.7, lz: 0, r: 1.2 }],
    },
    flagAt: [0, 3.2, -3.8], flagSize: { w: 0.6, h: 1.4 },
  },
  // Thuyền nhẹ quân Trần (khiêu chiến, chở tướng + 10 quân): thon, sơn then, mạn son, viền vàng, 10 mái chèo.
  light: {
    name: "Thuyền nhẹ", family: "tran", len: 12, beam: 2.6, deckY: 0.7, draft: 0.36, hp: 1500,
    deck: {
      rects: [R(-0.85, 0.85, -4.3, 4.3, 0.7)],
      walls: [],
      portals: [{ lx: 0.85, lz: 0, r: 1.3 }, { lx: -0.85, lz: 0, r: 1.3 }, { lx: 0, lz: 4.3, r: 0.9 }],
    },
    flagAt: [0, 3.3, -5.3], flagSize: { w: 0.8, h: 1.9 },
  },
};
// Thuyền chỉ huy nhẹ của tướng ở pha 1 (hợp đồng gameplay B20: thân thuyền nhẹ phóng 1,35×, boong ~16 × 3,5 m): mọi số của
// thuyền nhẹ nhân k (boong, tường, cửa, cờ); hình vẽ là hình thuyền nhẹ phóng to (hullGeometry). ĐỀ XUẤT BẢN THỬ.
function scaledHull(base, k, over) {
  const B = HULLS[base], sc = (o) => Object.fromEntries(Object.entries(o).map(([n, v]) => [n, typeof v === "number" ? v * k : v]));
  return { ...B, len: B.len * k, beam: B.beam * k, deckY: B.deckY * k, draft: B.draft * k, base, scale: k,
    deck: { rects: B.deck.rects.map(sc), walls: B.deck.walls.map(sc), portals: B.deck.portals.map(sc) },
    flagAt: B.flagAt.map((v) => v * k), flagSize: { w: B.flagSize.w * k, h: B.flagSize.h * k }, ...over };
}
HULLS.lead = scaledHull("light", 1.35, { name: "Thuyền chỉ huy nhẹ", hp: 2200 });
// ngân sách tam giác (hợp đồng §5, systems §13)
export const TRI_BUDGET = { lod0: 3000, flagship0: 8000, lod1: 800, lod2: 60 };

// ---- dựng hình: tam giác phẳng + màu đỉnh, tự lật mặt theo điểm tham chiếu phía trong ---------------------------------
const COLS = new Map();
const rgb = (hex) => { let c = COLS.get(hex); if (!c) { const k = new THREE.Color(hex); c = [k.r, k.g, k.b]; COLS.set(hex, c); } return c; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rotM = (yaw, pitch = 0, roll = 0) => poseMatrix(new Array(12), 0, 0, 0, yaw, pitch, roll);

class Mk {
  constructor() { this.p = []; this.c = []; }
  get tris() { return this.p.length / 9; }
  // ref: điểm phía trong — pháp tuyến hướng ra xa ref. Tam giác suy biến bỏ qua.
  tri(a, b, c, col, ref) {
    const n = cross(sub(b, a), sub(c, a));
    if (n[0] * n[0] + n[1] * n[1] + n[2] * n[2] < 1e-10) return;
    if (ref) {
      const d = n[0] * ((a[0] + b[0] + c[0]) / 3 - ref[0]) + n[1] * ((a[1] + b[1] + c[1]) / 3 - ref[1]) + n[2] * ((a[2] + b[2] + c[2]) / 3 - ref[2]);
      if (d < 0) { const t = b; b = c; c = t; }
    }
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    const k = rgb(col); this.c.push(k[0], k[1], k[2], k[0], k[1], k[2], k[0], k[1], k[2]);
  }
  quad(a, b, c, d, col, ref) { this.tri(a, b, c, col, ref); this.tri(a, c, d, col, ref); }
  // hai mặt (buồm, cờ, lưỡi chèo): nhìn từ phía nào cũng thấy
  quad2(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, b, col); this.tri(a, c, d, col); this.tri(a, d, c, col); }
  tri2(a, b, c, col) { this.tri(a, b, c, col); this.tri(a, c, b, col); }
  // hộp tâm c, cỡ s, xoay M (rotM), bỏ các mặt trong skip ("-y+z"...)
  box(c, s, col, M = null, skip = "") {
    const hx = s[0] / 2, hy = s[1] / 2, hz = s[2] / 2;
    const P = (x, y, z) => M ? [c[0] + M[0] * x + M[3] * y + M[6] * z, c[1] + M[1] * x + M[4] * y + M[7] * z, c[2] + M[2] * x + M[5] * y + M[8] * z] : [c[0] + x, c[1] + y, c[2] + z];
    const v = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    const F = { "-z": [0, 1, 2, 3], "+z": [4, 5, 6, 7], "-x": [0, 3, 7, 4], "+x": [1, 2, 6, 5], "-y": [0, 1, 5, 4], "+y": [3, 2, 6, 7] };
    for (const k in F) if (!skip.includes(k)) { const f = F[k]; this.quad(v[f[0]], v[f[1]], v[f[2]], v[f[3]], col, c); }
  }
  // thanh tròn n cạnh từ a (bán kính ra) tới b (rb; 0 = mũi nhọn); cap: bịt hai đầu; rot: góc xoay vòng cạnh
  rod(a, b, ra, rb, n, col, cap = false, rot = 0) {
    const d = sub(b, a); if (Math.hypot(d[0], d[1], d[2]) < 1e-4) return;
    const dn = norm(d); let u = cross(dn, [0, 1, 0]); if (Math.hypot(u[0], u[1], u[2]) < 1e-3) u = cross(dn, [0, 0, 1]);
    u = norm(u); const v = cross(u, dn), mid = mix3(a, b, 0.5), A = [], B = [];
    for (let k = 0; k < n; k++) {
      const t = rot + k * 2 * Math.PI / n, cu = Math.cos(t), sv = Math.sin(t);
      A.push([a[0] + (u[0] * cu + v[0] * sv) * ra, a[1] + (u[1] * cu + v[1] * sv) * ra, a[2] + (u[2] * cu + v[2] * sv) * ra]);
      B.push([b[0] + (u[0] * cu + v[0] * sv) * rb, b[1] + (u[1] * cu + v[1] * sv) * rb, b[2] + (u[2] * cu + v[2] * sv) * rb]);
    }
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; this.quad(A[k], A[k1], B[k1], B[k], col, mid); }
    if (cap) for (let k = 1; k + 1 < n; k++) { this.tri(A[0], A[k], A[k + 1], col, b); if (rb > 0) this.tri(B[0], B[k], B[k + 1], col, a); }
  }
  // đĩa n cạnh tâm c, pháp tuyến nrm (một mặt)
  disc(c, nrm, r, n, col) {
    const dn = norm(nrm); let u = cross(dn, [0, 1, 0]); if (Math.hypot(u[0], u[1], u[2]) < 1e-3) u = cross(dn, [1, 0, 0]);
    u = norm(u); const v = cross(dn, u), P = [], ref = sub(c, dn);
    for (let k = 0; k < n; k++) { const t = k * 2 * Math.PI / n; P.push(add3(add3(c, u, Math.cos(t) * r), v, Math.sin(t) * r)); }
    for (let k = 1; k + 1 < n; k++) this.tri(P[0], P[k], P[k + 1], col, ref);
  }
  geometry() {
    const pos = new Float32Array(this.p), col = new Float32Array(this.c), nor = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 9) {
      const n = norm(cross([pos[i + 3] - pos[i], pos[i + 4] - pos[i + 1], pos[i + 5] - pos[i + 2]], [pos[i + 6] - pos[i], pos[i + 7] - pos[i + 1], pos[i + 8] - pos[i + 2]]));
      for (let k = 0; k < 9; k += 3) { nor[i + k] = n[0]; nor[i + k + 1] = n[1]; nor[i + k + 2] = n[2]; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
}

// ---- bảng màu (sơn mài: Nguyên gỗ sẫm + chàm; kỳ hạm thêm son viền; Trần then + son + vàng thếp) ----------------------
const YUAN = {
  bot: 0x3b2d22, hull: 0x6b4c34, wale: 0x3a2a1e, upper: 0x7d5a3b, trim: 0x35506d, rail: 0x9a7249, deck: 0xa98356, deck2: 0x98744a,
  inner: 0x80603f, castle: 0x86623f, dark: 0x2a211a, mast: 0x5c412a, sail: 0x5b77a3, sail2: 0x516c97, batten: 0x3a2d22,
  shield: 0x3d5a7a, boss: PAL.xam, gold: PAL.vang, red: PAL.son, rope: 0xa8966c, eye: PAL.trung, roof: 0x3a3531, pennant: 0x3d5a7a,
  oar: 0x9a7650, blade: 0x7d5a3b,
};
const FLAGSHIP = { ...YUAN, trim: PAL.son, rail: 0xa8382a, castle: 0x8a5a38 };
const TRAN = {
  ...YUAN, bot: 0x221d19, hull: 0x2a2420, upper: 0xa8321f, trim: PAL.vang, rail: 0x2a2420, inner: 0x7a2418, deck: 0xa07a4c,
  deck2: 0x8f6c42, oar: 0xa8845a, blade: PAL.son, mast: 0x4a3524,
};

// ---- vỏ thuyền dựng theo mặt cắt ngang (z đuôi → mũi) ------------------------------------------------------------
// sec: z, b nửa bề rộng mạn, bot đáy (ky), T đỉnh mạn, f sàn (boong, hoặc nóc lầu/lái ở các mặt cắt phía đuôi).
const sec = (z, b, bot, T, f) => ({ z, b, bot, T, f });
const SPECS = {
  junk: {
    prof: "yuan", D: 2.6, th: 0.2, cols: YUAN, secs: [
      sec(-12, 2.75, -0.9, 7.1, 5.2), sec(-10, 3.1, -1.2, 6.6, 5.2), sec(-8, 3.3, -1.35, 6.3, 5.2), sec(-6.2, 3.4, -1.4, 6.2, 5.2),
      sec(-6.2, 3.4, -1.4, 6.2, 2.6), sec(-5.2, 3.45, -1.4, 3.6, 2.6), sec(-2, 3.5, -1.4, 3.5, 2.6), sec(1, 3.5, -1.4, 3.5, 2.6),
      sec(4, 3.4, -1.35, 3.55, 2.6), sec(7, 3.1, -1.2, 3.7, 2.6), sec(9.5, 2.6, -0.9, 3.95, 2.6), sec(11, 2.2, -0.6, 4.2, 2.6),
      sec(12, 1.85, -0.35, 4.4, 2.6)],
  },
  flagship: {
    prof: "yuan", D: 3.0, th: 0.24, cols: FLAGSHIP, secs: [
      sec(-18, 3.6, -1.1, 7.8, 6.0), sec(-16.5, 4.0, -1.45, 7.4, 6.0), sec(-14, 4.3, -1.75, 7.1, 6.0), sec(-10, 4.5, -1.9, 7.0, 6.0),
      sec(-6.05, 4.5, -1.9, 7.0, 6.0), sec(-6.05, 4.5, -1.9, 7.0, 3.0), sec(-4.4, 4.5, -1.9, 4.1, 3.0), sec(0, 4.5, -1.9, 4.0, 3.0),
      sec(4, 4.45, -1.9, 4.0, 3.0), sec(8, 4.3, -1.8, 4.05, 3.0), sec(12, 3.9, -1.5, 4.25, 3.0), sec(15, 3.2, -1.0, 4.6, 3.0),
      sec(17, 2.6, -0.6, 5.0, 3.0), sec(18, 2.3, -0.4, 5.2, 3.0)],
  },
  escort: {
    prof: "yuan", D: 1.8, th: 0.16, cols: YUAN, secs: [
      sec(-8, 1.9, -0.55, 4.2, 3.3), sec(-6.5, 2.1, -0.8, 4.05, 3.3), sec(-4.2, 2.25, -0.9, 3.95, 3.3), sec(-4.2, 2.25, -0.9, 3.95, 1.8),
      sec(-3.4, 2.25, -0.9, 2.55, 1.8), sec(0, 2.25, -0.9, 2.45, 1.8), sec(3.5, 2.1, -0.85, 2.5, 1.8), sec(6, 1.7, -0.6, 2.7, 1.8),
      sec(7.2, 1.35, -0.35, 2.9, 1.8), sec(8, 1.1, -0.2, 3.05, 1.8)],
  },
  scout: {
    prof: "yuan", D: 0.8, th: 0.1, cols: YUAN, secs: [
      sec(-4.5, 0.75, -0.25, 1.5, 0.8), sec(-3.5, 1.0, -0.42, 1.3, 0.8), sec(-1.5, 1.1, -0.5, 1.2, 0.8), sec(1, 1.1, -0.5, 1.2, 0.8),
      sec(3, 0.9, -0.44, 1.3, 0.8), sec(4, 0.6, -0.3, 1.5, 0.8), sec(4.5, 0.35, -0.12, 1.7, 0.8)],
  },
  light: {
    prof: "tran", D: 0.7, th: 0.1, cols: TRAN, secs: [
      sec(-6, 0.22, 0.35, 1.95, 0.7), sec(-5.5, 0.65, -0.02, 1.6, 0.7), sec(-4.3, 1.08, -0.28, 1.25, 0.7), sec(-2.2, 1.3, -0.35, 1.13, 0.7),
      sec(0, 1.32, -0.36, 1.1, 0.7), sec(2.2, 1.28, -0.35, 1.13, 0.7), sec(4.3, 1.0, -0.28, 1.35, 0.7), sec(5.5, 0.55, -0.02, 1.85, 0.7),
      sec(6, 0.18, 0.45, 2.3, 0.7)],
  },
};
// nội suy tham số mặt cắt theo z (đặt khiên, mắt thuyền, mái chèo sát mạn)
function secAt(sp, z) {
  const S = sp.secs;
  if (z <= S[0].z) return S[0];
  for (let i = 0; i + 1 < S.length; i++) {
    const a = S[i], b = S[i + 1];
    if (z <= b.z && b.z > a.z) { const t = (z - a.z) / (b.z - a.z); return { z, b: lerp(a.b, b.b, t), bot: lerp(a.bot, b.bot, t), T: lerp(a.T, b.T, t), f: b.f }; }
  }
  return S[S.length - 1];
}
// nửa bề rộng phía trong mạn (mép sàn) của loại thuyền ở z cục bộ — kiểm mặt đi được nằm trong thân, đặt lính sát mạn
export function innerHalfBeam(type, z) {
  const H = HULLS[type]; if (H?.base) return innerHalfBeam(H.base, z / H.scale) * H.scale;      // thuyền phóng to (lead)
  const sp = SPECS[type], s = secAt(sp, z); return s.b * 0.975 - sp.th;
}
// mặt cắt nửa mạn +x từ ky lên đỉnh mạn: [x, y, màu đoạn tới điểm kế]
function profile(kind, s, D, lod) {
  const { b, bot, T } = s;
  let P;
  if (kind === "tran") P = lod ? [[0, bot, "bot"], [0.85 * b, bot * 0.5, "hull"], [0.995 * b, T - 0.42, "upper"], [0.985 * b, T - 0.14, "trim"], [0.97 * b, T, ""]]
    : [[0, bot, "bot"], [0.5 * b, bot * 0.9, "bot"], [0.85 * b, bot * 0.5, "bot"], [0.97 * b, 0.02, "hull"], [b, D - 0.1, "hull"], [0.995 * b, T - 0.42, "upper"], [0.985 * b, T - 0.14, "trim"], [0.97 * b, T, ""]];
  else P = lod ? [[0, bot, "bot"], [0.86 * b, bot * 0.45, "hull"], [b, D - 0.5, "wale"], [b, D + 0.05, "upper"], [0.985 * b, T - 0.3, "trim"], [0.975 * b, T, ""]]
    : [[0, bot, "bot"], [0.55 * b, bot * 0.94, "bot"], [0.86 * b, bot * 0.45, "bot"], [0.95 * b, 0.05, "hull"], [b, D - 0.5, "wale"], [b, D + 0.05, "upper"], [0.985 * b, T - 0.3, "trim"], [0.975 * b, T, ""]];
  for (let k = 1; k < P.length; k++) P[k][1] = Math.max(P[k][1], P[k - 1][1] + 0.02);
  return P;
}
// LOD1 bớt mặt cắt: giữ hai đầu, chỗ đổi sàn, và cách một
function pickSecs(S) {
  return S.filter((s, i) => i === 0 || i === S.length - 1 || i % 2 === 0 || S[i - 1].f !== s.f || (S[i + 1] && S[i + 1].f !== s.f));
}

function loft(mk, sp, lod) {
  const C = sp.cols, secs = lod ? pickSecs(sp.secs) : sp.secs, D = sp.D, th = sp.th;
  const P = secs.map((s) => profile(sp.prof, s, D, lod)), K = P[0].length, planks = lod ? 1 : 4;
  for (let i = 0; i + 1 < secs.length; i++) {
    const s0 = secs[i], s1 = secs[i + 1], A = P[i], B = P[i + 1], zm = (s0.z + s1.z) / 2;
    const yRef = (Math.min(s0.bot, s1.bot) + D) * 0.5;
    const xo0 = A[K - 1][0], xo1 = B[K - 1][0], xi0 = Math.max(0.02, xo0 - th), xi1 = Math.max(0.02, xo1 - th);
    for (const sg of [1, -1]) {
      for (let k = 0; k + 1 < K; k++) {
        mk.quad([sg * A[k][0], A[k][1], s0.z], [sg * A[k + 1][0], A[k + 1][1], s0.z], [sg * B[k + 1][0], B[k + 1][1], s1.z], [sg * B[k][0], B[k][1], s1.z],
          C[A[k][2]], [0, yRef, zm]);
      }
      // mặt trong mạn (từ sàn lên đỉnh) và nẹp đỉnh mạn
      mk.quad([sg * xi0, s0.f, s0.z], [sg * xi0, s0.T, s0.z], [sg * xi1, s1.T, s1.z], [sg * xi1, s1.f, s1.z], C.inner, [sg * (xo0 + 20), (s0.f + s0.T) / 2, zm]);
      mk.quad([sg * xo0, s0.T, s0.z], [sg * xi0, s0.T, s0.z], [sg * xi1, s1.T, s1.z], [sg * xo1, s1.T, s1.z], C.rail, [sg * xo0, s0.T - 5, zm]);
    }
    // sàn: ván dọc thân, hai sắc xen kẽ
    if (s0.f === s1.f) for (let j = 0; j < planks; j++) {
      const t0 = j / planks, t1 = (j + 1) / planks;
      mk.quad([lerp(-xi0, xi0, t0), s0.f, s0.z], [lerp(-xi0, xi0, t1), s0.f, s0.z], [lerp(-xi1, xi1, t1), s1.f, s1.z], [lerp(-xi1, xi1, t0), s1.f, s1.z],
        j % 2 ? C.deck2 : C.deck, [0, s0.f - 5, zm]);
    }
  }
  // bịt đuôi và mũi (vách phẳng kiểu thuyền buồm Trung Hoa), cộng mặt trong vách phía trên sàn
  for (const [i, dir] of [[0, 1], [secs.length - 1, -1]]) {
    const s = secs[i], Pp = P[i], poly = [...Pp.map((p) => [p[0], p[1], p[2]]), ...Pp.slice().reverse().map((p) => [-p[0], p[1], p[2]])];
    const cen = [0, (s.bot + s.T) / 2, s.z], ref = [0, (s.bot + s.T) / 2, s.z + dir * 5];
    for (let k = 0; k + 1 < poly.length; k++) {
      const a = poly[k], b = poly[k + 1], key = a[1] < b[1] ? a[2] : b[2];
      mk.tri(cen, [a[0], a[1], s.z], [b[0], b[1], s.z], key === "bot" ? C.bot : C.upper, ref);
    }
    const xi = Math.max(0.02, Pp[K - 1][0] - th), zi = s.z + dir * 0.01;
    mk.quad([-xi, s.f, zi], [xi, s.f, zi], [xi, s.T, zi], [-xi, s.T, zi], C.inner, [0, s.f, s.z - dir * 5]);
  }
}

// Buồm cánh dơi có nẹp tre (thuyền buồm Trung Hoa): mép trước thẳng, mép sau cong xoè, nóc (sào trên) dốc lên về
// đuôi. m: cột {x, y0, z, rake}; s: {base (độ cao sào dưới), H, W, n tấm, phi góc xoay quanh cột}.
function lugSail(mk, C, m, s, lod, deckY) {
  const V = [0, Math.cos(m.rake || 0), Math.sin(m.rake || 0)], U = [Math.sin(s.phi), 0, Math.cos(s.phi)], N = norm(cross(U, V));
  const n = lod ? Math.min(3, s.n) : s.n, vb = s.base - m.y0, root = [m.x, m.y0, m.z];
  const at = (u, v, bulge = 0) => add3(add3(add3(root, V, v), U, u), N, bulge);
  const Ls = [], Rs = [], Ms = [];
  for (let j = 0; j <= n; j++) {
    const t = j / n, vL = vb + 0.86 * s.H * t, vR = vb + s.H * Math.pow(t, 0.85), uR = -0.7 * s.W - 0.1 * s.W * Math.sin(Math.PI * t);
    Ls.push(at(0.3 * s.W, vL)); Rs.push(at(uR, vR));
    Ms.push(add3(mix3(Ls[j], Rs[j], 0.42), N, lod ? 0 : 0.05 * s.W * (j === 0 || j === n ? 0.4 : 1)));
  }
  for (let j = 0; j < n; j++) {
    const col = j % 2 ? C.sail2 : C.sail;
    if (lod) mk.quad2(Ls[j], Rs[j], Rs[j + 1], Ls[j + 1], col);
    else { mk.quad2(Ls[j], Ms[j], Ms[j + 1], Ls[j + 1], col); mk.quad2(Ms[j], Rs[j], Rs[j + 1], Ms[j + 1], col); }
  }
  // nẹp tre (LOD0), sào trên + sào dưới dày hơn
  for (let j = 0; j <= n; j++) {
    if (lod && j > 0 && j < n) continue;
    const r = (j === 0 || j === n ? 0.09 : 0.05) * Math.min(1.4, s.W / 6);
    if (lod) mk.rod(Ls[j], Rs[j], r, r, 3, C.batten);
    else { mk.rod(Ls[j], Ms[j], r, r, 3, C.batten); mk.rod(Ms[j], Rs[j], r, r, 3, C.batten); }
  }
  // dây lèo xoè từ mép sau xuống boong (dấu hiệu nhận ra buồm Trung Hoa)
  if (!lod) {
    const anchor = at(-0.75 * s.W, deckY - m.y0 + 0.4); anchor[1] = deckY + 0.4;
    for (let j = 1; j < n; j += 2) mk.rod(Rs[j], anchor, 0.025, 0.025, 3, C.rope);
  }
  return Rs[n];
}
function mastRod(mk, C, m, lod) {
  const top = [m.x, m.y0 + m.h * Math.cos(m.rake || 0), m.z + m.h * Math.sin(m.rake || 0)];
  mk.rod([m.x, m.y0, m.z], top, m.r, m.r * 0.55, lod ? 4 : 6, C.mast);
  return top;
}
function pennant(mk, top, len, col) {
  const a = top, b = [top[0], top[1] - len * 0.18, top[2]], c = [top[0] + len * 0.08, top[1] - len * 0.12, top[2] - len];
  mk.tri2(a, b, c, col);
}
// khiên tròn treo mạn, mắt thuyền
function shields(mk, C, sp, zs, dy, r = 0.36, lod = 0) {
  if (lod) return;
  for (const z of zs) {
    const s = secAt(sp, z);
    for (const sg of [1, -1]) {
      const c = [sg * (s.b + 0.05), sp.D + dy, z], n = [sg, 0, 0];
      mk.disc(c, n, r, 6, C.shield); mk.rod(add3(c, n, 0.01), add3(c, n, 0.13), r * 0.3, 0, 4, C.boss);
    }
  }
}
function eyes(mk, C, sp, z, y, r, lod, pupil = C.dark) {
  if (lod) return;
  const s = secAt(sp, z), s2 = secAt(sp, z + 0.5), slope = (s2.b - s.b) / 0.5;
  for (const sg of [1, -1]) {
    const n = norm([sg, 0, -slope * sg * sg]), c = [sg * (s.b + 0.03), y, z];
    mk.disc(c, n, r, 8, C.eye); mk.disc(add3(add3(c, n, 0.02), [0, 0, 1], r * 0.18), n, r * 0.52, 6, pupil);
  }
}
function oars(mk, C, sp, zs, len, lod) {
  for (const z of zs) {
    const s = secAt(sp, z);
    for (const sg of [1, -1]) {
      const a = [sg * (s.b * 0.97), s.T - 0.05, z], tip = [sg * (s.b + len * 0.86), -0.15, z - len * 0.22];
      if (lod) { mk.quad2(a, add3(a, [0, 0.08, 0]), add3(tip, [0, 0.08, 0]), tip, C.oar); continue; }
      mk.rod(a, tip, 0.045, 0.04, 4, C.oar);
      const d = norm(sub(tip, a)), side = norm(cross(d, [0, 1, 0])), bs = add3(tip, d, -0.95);
      mk.quad2(add3(bs, side, 0.13), add3(bs, side, -0.13), add3(tip, side, -0.15), add3(tip, side, 0.15), C.blade);
    }
  }
}

// ---- từng loại ------------------------------------------------------------------------------------------------------
const BUILD = {
  junk(mk, lod) {
    const sp = SPECS.junk, C = sp.cols, D = sp.D, roof = 5.2;
    loft(mk, sp, lod);
    const xi = secAt(sp, -6.2).b * 0.975 - sp.th;
    // lầu lái: vách trước có cửa, cửa sổ, dải chàm; lan can nóc
    mk.quad([-xi, D, -6.2], [xi, D, -6.2], [xi, roof, -6.2], [-xi, roof, -6.2], C.castle, [0, 3, -9]);
    mk.box([0, roof - 0.12, -6.14], [2 * xi, 0.24, 0.12], C.trim, null, "-y-z");
    if (!lod) {
      mk.box([0, D + 0.95, -6.14], [1.1, 1.9, 0.1], C.dark, null, "-z-y");
      for (const x of [-1.9, 1.9]) { mk.box([x, D + 1.35, -6.14], [0.9, 0.55, 0.1], C.dark, null, "-z"); mk.box([x, D + 1.66, -6.12], [1.05, 0.08, 0.14], C.gold, null, "-z"); }
      mk.box([0, roof + 0.85, -6.3], [2 * xi, 0.12, 0.14], C.rail);
      for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) mk.box([x, roof + 0.42, -6.3], [0.1, 0.84, 0.1], C.rail, null, "-y+y");
      // đuôi: bảng sơn chàm + đĩa vàng, bánh lái lớn
      mk.box([0, 4.9, -12.06], [3.4, 2.1, 0.1], C.trim, null, "+z"); mk.disc([0, 4.9, -12.12], [0, 0, -1], 0.62, 8, C.gold);
      // mũi: tời, neo đá gỗ
      mk.rod([-1.3, D + 0.45, 11.0], [1.3, D + 0.45, 11.0], 0.16, 0.16, 6, C.mast);
      mk.box([1.0, 2.2, 12.15], [0.16, 1.7, 0.16], C.dark); mk.box([1.0, 1.45, 12.2], [0.9, 0.16, 0.16], C.dark, rotM(0, 0, 0.3));
      // nắp hầm, thùng hàng
      mk.box([0, D + 0.16, 4.3], [1.7, 0.32, 1.4], C.castle, null, "-y"); mk.box([-1.9, D + 0.3, -3.8], [0.7, 0.6, 0.7], C.upper, rotM(0.3), "-y");
    }
    mk.box([0, 0.5, -12.5], [0.26, 3.4, 1.4], C.dark, rotM(0, -0.12, 0));
    shields(mk, C, sp, [-4.5, -2.5, -0.5, 1.5, 3.5, 5.5], 0.5, 0.36, lod);
    eyes(mk, C, sp, 10.4, 3.2, 0.42, lod);
    // ba cột buồm: chính, mũi (chúi trước), lái (lệch mạn)
    const main = { x: 0, y0: D, z: 1, h: 14.5, r: 0.24, rake: 0 }, fore = { x: 0, y0: D, z: 7.8, h: 10, r: 0.19, rake: 0.14 }, miz = { x: 0.9, y0: roof, z: -10, h: 6.5, r: 0.14, rake: -0.08 };
    const tm = mastRod(mk, C, main, lod), tf = mastRod(mk, C, fore, lod); mastRod(mk, C, miz, lod);
    lugSail(mk, C, main, { base: D + 2.3, H: 11.2, W: 8.2, n: 7, phi: 0.32 }, lod, D);
    lugSail(mk, C, fore, { base: D + 1.6, H: 7.6, W: 5.8, n: 5, phi: 0.38 }, lod, D);
    lugSail(mk, C, miz, { base: roof + 1.3, H: 4.6, W: 3.4, n: 4, phi: 0.28 }, lod, roof);
    if (!lod) { pennant(mk, tm, 3.4, C.pennant); pennant(mk, tf, 2.4, C.pennant); }
    mk.rod([-2.3, roof, -11.2], [-2.3, 11.6, -11.2], 0.07, 0.05, lod ? 3 : 5, C.mast);          // cán cờ chữ (lá cờ vẽ riêng)
  },

  flagship(mk, lod) {
    const sp = SPECS.flagship, C = sp.cols, D = sp.D, top = 6.0;
    loft(mk, sp, lod);
    const xi = secAt(sp, -6.05).b * 0.975 - sp.th;
    // mặt tiền lầu chỉ huy: vách gỗ, cột son, cửa sổ viền vàng, dải son + vàng dưới mái hiên
    mk.quad([-xi, D, -6.05], [xi, D, -6.05], [xi, top, -6.05], [-xi, top, -6.05], C.castle, [0, 4, -9]);
    mk.box([0, top - 0.15, -5.98], [2 * xi, 0.3, 0.16], C.red, null, "-z");
    mk.box([0, top - 0.36, -5.96], [2 * xi, 0.1, 0.12], C.gold, null, "-z-y+y");
    for (const x of [-3.9, -2.5, -1.25, 1.25, 2.5, 3.9]) mk.box([x, (D + top) / 2, -5.94], [0.28, top - D, 0.28], C.red, null, lod ? "-y+y-z" : "-y-z");
    if (!lod) {
      for (const x of [-1.9, 1.9, -3.2, 3.2]) {
        mk.box([x, D + 1.7, -5.99], [x * x > 4 ? 0.9 : 0.8, 1.1, 0.08], C.dark, null, "-z");
        mk.box([x, D + 2.3, -5.97], [x * x > 4 ? 1.0 : 0.9, 0.08, 0.1], C.gold, null, "-z"); mk.box([x, D + 1.1, -5.97], [x * x > 4 ? 1.0 : 0.9, 0.08, 0.1], C.gold, null, "-z");
      }
      // lan can trước mặt lầu (chừa lối cầu thang)
      for (const sg of [1, -1]) {
        mk.box([sg * (xi + 1.1) / 2, top + 0.8, -6.15], [xi - 1.1, 0.12, 0.14], C.red);
        for (let x = 1.3; x < xi; x += 0.75) mk.box([sg * x, top + 0.4, -6.15], [0.1, 0.8, 0.1], C.rail, null, "-y+y");
      }
    }
    // cầu thang: bậc gỗ khớp mặt dốc (6,0 ở z −6,05 → 3,0 ở z 2,0), hai thành, tay vịn son
    const nStep = lod ? 1 : 8, z0 = -6.05, z1 = 2.0, run = (z1 - z0) / 8;
    if (lod) mk.quad([-1.1, top, z0], [1.1, top, z0], [1.1, D, z1], [-1.1, D, z1], C.deck, [0, 0, z0]);
    else for (let i = 0; i < nStep; i++) {
      const zc = z0 + (i + 0.5) * run, yTop = top - (i + 0.5) * (3 / 8) + 0.19;
      mk.box([0, (yTop + D) / 2, zc], [2.2, yTop - D, run], i % 2 ? C.deck2 : C.deck, null, "-y-z");
    }
    const pitch = Math.atan2(3, z1 - z0);
    for (const sg of [1, -1]) {
      mk.box([sg * 1.18, (top + D) / 2 + 0.05, (z0 + z1) / 2], [0.16, 0.5, Math.hypot(3, z1 - z0)], C.dark, rotM(0, pitch, 0));
      if (!lod) mk.rod([sg * 1.18, D + 1.0, z1], [sg * 1.18, top + 1.0, z0], 0.05, 0.05, 4, C.red);
    }
    // đình trên lầu: 4 cột son, mái hai tầng ngói sẫm, đầu đao vàng
    const pz = -13.7, ph = 2.9, roofY = top + ph;
    for (const [x, z] of [[-2.2, -15.0], [2.2, -15.0], [-2.2, -12.4], [2.2, -12.4]]) mk.rod([x, top, z], [x, roofY, z], 0.16, 0.16, lod ? 4 : 6, C.red);
    mk.box([0, roofY - 0.12, pz], [4.8, 0.24, 3.0], C.red, null, "");
    mk.rod([0, roofY, pz], [0, roofY + 0.9, pz], 4.0, 2.2, 4, C.roof, true, Math.PI / 4);
    mk.rod([0, roofY + 0.9, pz], [0, roofY + 1.3, pz], 2.2, 2.0, 4, C.red, false, Math.PI / 4);
    mk.rod([0, roofY + 1.3, pz], [0, roofY + 2.3, pz], 2.5, 0.35, 4, C.roof, false, Math.PI / 4);
    if (!lod) for (const [x, z] of [[-2.83, -2.83], [2.83, -2.83], [-2.83, 2.83], [2.83, 2.83]])
      mk.rod([x, roofY + 0.05, pz + z], [x * 1.12, roofY + 0.75, pz + z * 1.12], 0.12, 0, 4, C.gold);
    mk.rod([0, roofY + 2.2, pz], [0, 15.7, pz], 0.09, 0.06, lod ? 3 : 5, C.mast);                // cán cờ soái (lá cờ vẽ riêng)
    // cờ chàm bốn góc lầu
    if (!lod) for (const [x, z] of [[-3.5, -6.6], [3.5, -6.6], [-3.3, -15.2], [3.3, -15.2]]) {
      const b = [x, top, z], t = [x, top + 4.2, z];
      mk.rod(b, t, 0.05, 0.04, 4, C.mast); mk.quad2(t, [x, top + 2.6, z], [x, top + 2.8, z - 1.2], [x, top + 4.1, z - 1.3], C.pennant);
    }
    // đuôi: bảng son viền vàng, đĩa vàng; bánh lái; mũi: tời, hai neo
    mk.box([0, 5.4, -18.06], [4.6, 2.6, 0.1], C.red, null, "+z"); mk.box([0, 5.4, -18.1], [3.6, 1.8, 0.08], C.trim === PAL.son ? PAL.cham : C.trim, null, "+z");
    mk.disc([0, 5.4, -18.16], [0, 0, -1], 0.75, lod ? 6 : 10, C.gold);
    mk.box([0, 0.6, -18.6], [0.3, 4.2, 1.9], C.dark, rotM(0, -0.12, 0));
    if (!lod) {
      mk.rod([-1.8, D + 0.5, 16.4], [1.8, D + 0.5, 16.4], 0.2, 0.2, 6, C.mast);
      for (const x of [-1.3, 1.3]) { mk.box([x, 2.6, 18.2], [0.18, 2.0, 0.18], C.dark); mk.box([x, 1.7, 18.25], [1.1, 0.18, 0.18], C.dark, rotM(0, 0, 0.3)); }
      mk.box([0, D + 0.2, 6.5], [2.2, 0.4, 1.8], C.castle, null, "-y"); mk.box([2.6, D + 0.35, 9.5], [0.8, 0.7, 0.8], C.upper, rotM(0.4), "-y");
      // trống trận trên lầu
      mk.rod([2.4, top + 0.4, -9.0], [2.4, top + 1.3, -9.0], 0.55, 0.55, 8, C.red, true);
    }
    shields(mk, C, sp, [-3.5, -1.5, 0.5, 2.5, 6.5, 8.5, 10.5], 0.55, 0.42, lod);
    eyes(mk, C, sp, 16.3, 3.6, 0.55, lod);
    const main = { x: 0, y0: D, z: 4.5, h: 19, r: 0.32, rake: 0 }, fore = { x: 0, y0: D, z: 12.8, h: 13, r: 0.24, rake: 0.12 };
    const tm = mastRod(mk, C, main, lod), tf = mastRod(mk, C, fore, lod);
    lugSail(mk, C, main, { base: D + 2.6, H: 14.5, W: 10.5, n: 8, phi: 0.3 }, lod, D);
    lugSail(mk, C, fore, { base: D + 1.8, H: 9.5, W: 7.0, n: 6, phi: 0.36 }, lod, D);
    if (!lod) { pennant(mk, tm, 4.5, C.red); pennant(mk, tf, 3.2, C.pennant); }
  },

  escort(mk, lod) {
    const sp = SPECS.escort, C = sp.cols, D = sp.D, roof = 3.3;
    loft(mk, sp, lod);
    const xi = secAt(sp, -4.2).b * 0.975 - sp.th;
    mk.quad([-xi, D, -4.2], [xi, D, -4.2], [xi, roof, -4.2], [-xi, roof, -4.2], C.castle, [0, 2, -6]);
    mk.box([0, roof - 0.1, -4.15], [2 * xi, 0.2, 0.1], C.trim, null, "-y-z");
    if (!lod) {
      mk.box([0, D + 0.7, -4.15], [0.9, 1.4, 0.08], C.dark, null, "-z-y");
      mk.box([0, roof + 0.6, -4.3], [2 * xi, 0.1, 0.12], C.rail);
      mk.box([0, 3.3, -8.05], [2.4, 1.1, 0.08], C.trim, null, "+z");
      mk.box([0, D + 0.14, 2.6], [1.2, 0.28, 1.0], C.castle, null, "-y");
    }
    mk.box([0, 0.3, -8.35], [0.2, 2.2, 0.9], C.dark, rotM(0, -0.12, 0));
    shields(mk, C, sp, [-2.8, -1, 0.8, 2.6], 0.35, 0.3, lod);
    eyes(mk, C, sp, 7.0, 2.1, 0.3, lod);
    const main = { x: 0, y0: D, z: 1, h: 10, r: 0.18, rake: 0 }, fore = { x: 0, y0: D, z: 5.6, h: 6.5, r: 0.13, rake: 0.12 };
    const tm = mastRod(mk, C, main, lod); mastRod(mk, C, fore, lod);
    lugSail(mk, C, main, { base: D + 1.7, H: 7.2, W: 5.2, n: 5, phi: 0.34 }, lod, D);
    lugSail(mk, C, fore, { base: D + 1.2, H: 4.4, W: 3.2, n: 4, phi: 0.4 }, lod, D);
    if (!lod) pennant(mk, tm, 2.4, C.pennant);
    mk.rod([-1.4, roof, -7.2], [-1.4, 7.5, -7.2], 0.05, 0.04, lod ? 3 : 4, C.mast);
  },

  scout(mk, lod) {
    const sp = SPECS.scout, C = sp.cols, D = sp.D;
    loft(mk, sp, lod);
    if (!lod) {
      for (const z of [-1.8, 2.0]) mk.box([0, sp.D + 0.25, z], [2.0, 0.08, 0.35], C.rail, null, "-y");
      mk.rod([0.5, D + 0.12, -3.0], [-0.3, D + 0.12, 3.6], 0.04, 0.04, 3, 0xa8925f);               // sào dò luồng
    }
    const m = { x: 0, y0: D, z: 0.8, h: 5.4, r: 0.09, rake: 0.05 };
    const tm = mastRod(mk, C, m, lod);
    lugSail(mk, C, m, { base: D + 0.9, H: 4.2, W: 3.0, n: 4, phi: 0.4 }, lod, D);
    if (!lod) pennant(mk, tm, 1.6, C.pennant);
    oars(mk, C, sp, [-1.5, 2.3], 2.6, lod);
    mk.rod([0, 1.2, -3.8], [0, 3.3, -3.8], 0.035, 0.03, 3, C.mast);
  },

  light(mk, lod) {
    const sp = SPECS.light, C = sp.cols, D = sp.D;
    loft(mk, sp, lod);
    if (!lod) {
      for (const z of [-3.1, -1.6, -0.1, 1.4, 2.9]) mk.box([0, D + 0.24, z], [2.3, 0.07, 0.3], C.deck2, null, "-y");
      // mũi cong đầu rồng cách điệu (vàng thếp), mắt thuyền son
      mk.rod([0, 2.25, 5.95], [0, 2.75, 6.3], 0.09, 0.02, 4, C.trim);
      mk.rod([0, 1.9, -5.95], [0, 2.3, -6.25], 0.08, 0.02, 4, C.trim);
    }
    eyes(mk, C, sp, 4.95, 1.25, 0.2, lod, C.red);
    oars(mk, C, sp, [-3.2, -1.7, -0.2, 1.3, 2.8], 2.6, lod);
    mk.rod([0, D, -5.3], [0, 3.4, -5.3], 0.045, 0.035, lod ? 3 : 5, C.mast);
  },
};

// Hình thay thế ở xa (~50 tam giác): vỏ 4 mặt cắt + sàn + buồm (Nguyên) hoặc dải mái chèo (Trần). Dựng theo kích thước
// chiến thuyền (yuan) / thuyền nhẹ (tran); loại khác co giãn qua ma trận instance (HULLS.*.imp).
function impostor(mk, fam) {
  const tran = fam === "tran", L = tran ? 12 : 24, Bm = tran ? 1.3 : 3.45, D = tran ? 0.7 : 2.6, bot = tran ? -0.36 : -1.4;
  const C = tran ? TRAN : YUAN, T = tran ? 1.2 : 3.7;
  const S = [[-L / 2, Bm * 0.75, bot * 0.6, T + (tran ? 0.6 : 2.4)], [-L * 0.2, Bm, bot, T], [L * 0.25, Bm, bot, T], [L / 2, Bm * 0.5, bot * 0.3, T + (tran ? 1 : 0.6)]];
  for (let i = 0; i + 1 < S.length; i++) {
    const [z0, b0, k0, t0] = S[i], [z1, b1, k1, t1] = S[i + 1], zm = (z0 + z1) / 2;
    for (const sg of [1, -1]) {
      mk.quad([0, k0, z0], [sg * b0, D - 0.3, z0], [sg * b1, D - 0.3, z1], [0, k1, z1], C.hull, [0, D, zm]);
      mk.quad([sg * b0, D - 0.3, z0], [sg * b0, t0, z0], [sg * b1, t1, z1], [sg * b1, D - 0.3, z1], tran ? C.upper : C.upper, [0, D, zm]);
    }
    mk.quad([-b0, t0 - 0.4, z0], [b0, t0 - 0.4, z0], [b1, t1 - 0.4, z1], [-b1, t1 - 0.4, z1], C.deck, [0, -5, zm]);
  }
  for (const [i, dir] of [[0, 1], [S.length - 1, -1]]) {
    const [z, b, k, t] = S[i], ref = [0, D, z + dir * 5];
    mk.tri([0, k, z], [b, D - 0.3, z], [-b, D - 0.3, z], C.hull, ref); mk.quad([-b, D - 0.3, z], [b, D - 0.3, z], [b, t, z], [-b, t, z], C.upper, ref);
  }
  if (tran) for (const sg of [1, -1]) mk.quad2([sg * Bm, T, -3.5], [sg * (Bm + 2.2), 0, -4.2], [sg * (Bm + 2.2), 0, 3.0], [sg * Bm, T, 3.6], TRAN.oar);
  else {
    // hai buồm xoay ~35° quanh cột (LOD0 ~20°) để nhìn từ ngang hay từ đuôi đều còn thấy mặt buồm
    const sl = (z, y0, u0, u1, h0, h1, col) => { const sx = Math.sin(0.6), cz = Math.cos(0.6);
      mk.quad2([u0 * sx, y0, z + u0 * cz], [u1 * sx, y0, z + u1 * cz], [u1 * sx, y0 + h1, z + u1 * cz], [u0 * sx, y0 + h0, z + u0 * cz], col); };
    sl(1, D + 2.3, 2.4, -5.7, 10.0, 11.2, YUAN.sail); sl(7.8, D + 1.6, 1.7, -4.0, 6.6, 7.6, YUAN.sail2);
  }
}
// tỉ lệ co giãn hình thay thế cho từng loại (ngang, cao, dọc)
for (const [k, H] of Object.entries(HULLS)) {
  const ref = H.family === "tran" ? HULLS.light : HULLS.junk;
  H.imp = [H.beam / ref.beam, H.deckY / ref.deckY, H.len / ref.len];
}

const GEO = new Map();
export function hullGeometry(type, lod = 0) {
  const key = type + ":" + lod;
  if (GEO.has(key)) return GEO.get(key);
  const H = HULLS[type]; if (!H) throw new Error("không có loại thuyền " + type);
  if (H.base && lod < 2) { const g = hullGeometry(H.base, lod).clone(); g.scale(H.scale, H.scale, H.scale); GEO.set(key, g); return g; }
  const mk = new Mk();
  if (lod >= 2) impostor(mk, H.family); else BUILD[type](mk, lod);
  const g = mk.geometry();
  if (lod >= 2) g.scale(H.imp[0], H.imp[1], H.imp[2]);
  GEO.set(key, g);
  return g;
}
// hình thay thế chưa co giãn của một họ (FleetRenderer co giãn theo instance)
export function impostorGeometry(fam) {
  const key = "imp:" + fam;
  if (!GEO.has(key)) { const mk = new Mk(); impostor(mk, fam); GEO.set(key, mk.geometry()); }
  return GEO.get(key);
}
export const triCount = (type, lod) => hullGeometry(type, lod).attributes.position.count / 3;
export function disposeHullGeometries() { for (const g of GEO.values()) g.dispose(); GEO.clear(); }

// ---- đường đi: Catmull-Rom qua các điểm, tra theo độ dài cung ----------------------------------------------------------
const _Q = { x: 0, z: 0, tx: 0, tz: 1 };
export class Track {
  constructor(path, sub = 10) {
    const P = path.map((p) => ({ x: p.x, z: p.z }));
    if (P.length < 2) P.push({ x: P[0].x, z: P[0].z + 1e-3 });
    this.P = P; this.n = P.length - 1;
    const U = [0], S = [0];
    let s = 0, px = P[0].x, pz = P[0].z;
    for (let i = 0; i < this.n; i++) for (let k = 1; k <= sub; k++) {
      const u = i + k / sub; this._eval(u, _Q);
      s += Math.hypot(_Q.x - px, _Q.z - pz); px = _Q.x; pz = _Q.z; U.push(u); S.push(s);
    }
    this.U = Float64Array.from(U); this.S = Float64Array.from(S); this.len = s;
  }
  _eval(u, out) {
    const P = this.P, n = this.n, i = Math.min(Math.floor(u), n - 1), f = u - i;
    const p1 = P[i], p2 = P[i + 1];
    const p0 = i > 0 ? P[i - 1] : { x: 2 * p1.x - p2.x, z: 2 * p1.z - p2.z };
    const p3 = i + 2 <= n ? P[i + 2] : { x: 2 * p2.x - p1.x, z: 2 * p2.z - p1.z };
    const f2 = f * f, f3 = f2 * f;
    const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f2 + (-a + 3 * b - 3 * cc + d) * f3);
    const dc = (a, b, cc, d) => 0.5 * ((-a + cc) + 2 * (2 * a - 5 * b + 4 * cc - d) * f + 3 * (-a + 3 * b - 3 * cc + d) * f2);
    out.x = c(p0.x, p1.x, p2.x, p3.x); out.z = c(p0.z, p1.z, p2.z, p3.z);
    out.tx = dc(p0.x, p1.x, p2.x, p3.x); out.tz = dc(p0.z, p1.z, p2.z, p3.z);
    return out;
  }
  // điểm và tiếp tuyến đơn vị ở độ dài cung s
  at(s, out = {}) {
    const S = this.S, U = this.U;
    s = clamp(s, 0, this.len);
    let lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
    const seg = S[hi] - S[lo], u = U[lo] + (U[hi] - U[lo]) * (seg > 1e-9 ? (s - S[lo]) / seg : 0);
    this._eval(u, out);
    const l = Math.hypot(out.tx, out.tz);
    if (l > 1e-9) { out.tx /= l; out.tz /= l; } else { out.tx = 0; out.tz = 1; }
    return out;
  }
}

// ---- thuyền: chạy theo đường, dập dềnh, mắc cạn, chìm ---------------------------------------------------------------
export const BOAT = {
  acc: 0.8,          // m/s² tăng/giảm tốc
  turn: 1.6,         // hệ số bám hướng tiếp tuyến (1/s)
  settle: 4,         // s từ lúc mắc tới lúc nằm nghiêng hẳn (R-world §4c)
  tilt: [8.5, 11.5], // độ nghiêng tổng khi mắc cạn, theo seed từng thuyền (hợp đồng: 8–12°)
  mudSink: 0.3,      // ky lún vào bùn (m)
  stakeCatch: STAKE_TOP.min,   // trên mốc cọc đã kích hoạt: mắc khi ky chạm đỉnh cọc thấp nhất (river-b20 STAKE_TOP; chỉ khi autoGround)
  sinkRate: 0.6, sinkRoll: 0.5, sinkHide: 6,   // chìm: m/s, độ nghiêng cuối (rad), giây rồi ẩn
};
const _P = { x: 0, z: 0, tx: 0, tz: 1 };

export class Boat {
  // sail: true = buồm giương (buồm gộp trong mesh loại thuyền ở đợt này; giữ để sau có mesh buồm hạ)
  // autoGround: tự mắc khi ky chạm đáy / đỉnh cọc đã kích hoạt (lab-b20 giữ). Trong trận (naval.js) = false: director quyết
  // lúc nào thuyền "caught" (dừng, chưa nghiêng) và lúc nào strand() (lún, nghiêng) — hợp đồng gameplay B20. Tắt tự mắc thì
  // thuyền vẫn không lún quá đáy: y ≥ đáy + mớn − lún bùn (nằm trên bùn, chưa nghiêng).
  // follow: { boat, dx, dz, dyaw } — áp mạn (naval.grapple): bám theo thuyền kia, vị trí trong hệ thuyền kia cố định.
  constructor({ type = "junk", side = "dich", id = "", path = null, speed = 0, flag = "", sail = true, s0 = 0, seed, autoGround = true } = {}) {
    const H = HULLS[type]; if (!H) throw new Error("không có loại thuyền " + type);
    this.type = type; this.hull = H; this.side = side; this.id = id; this.flag = flag; this.sail = sail;
    this.autoGround = autoGround; this.follow = null;
    this.drive = null;           // hàm (dt) → s: vị trí trên đường do ngoài điều khiển (đò chuyển của naval.js), bỏ qua tăng tốc
    this.calm = false;           // true: không dập dềnh (cụm Liên Hoàn Thuyền xích lại làm bệ đứng vững)
    this.deck = new Deck(H.deck); this.deck.boat = this;
    this.hpMax = H.hp; this.hp = H.hp;
    this.x = 0; this.z = 0; this.y = 0; this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.s = 0; this.speed = speed; this.targetSpeed = speed; this.state = "sail";
    this.visible = true; this.arrived = false; this.flash = 0; this.tint = 1;
    this.settleT = 0; this.restY = -Infinity; this.y0 = 0; this.p0 = 0; this.r0 = 0; this.sinkT = 0; this.ySink = 0;
    const rng = makeRng(seed ?? hash(type + ":" + id));
    this.phase = rng.range(0, 2 * Math.PI);
    // tư thế nằm cạn: tổng nghiêng T chia thành chúi mũi nhỏ p và nghiêng mạn r với cos T = cos p · cos r
    const T = rng.range(BOAT.tilt[0], BOAT.tilt[1]) * Math.PI / 180, p = (rng.chance(0.5) ? 1 : -1) * rng.range(1.5, 3) * Math.PI / 180;
    this.tiltPitch = p; this.tiltRoll = (rng.chance(0.5) ? 1 : -1) * Math.acos(clamp(Math.cos(T) / Math.cos(p), -1, 1));
    this.track = null;
    if (path) this.setPath(path, s0);
    this.deck.setPose(this.x, this.y, this.z, this.yaw, 0, 0);
  }
  get alive() { return this.state !== "sunk"; }
  get moving() { return this.state === "sail" && this.speed > 0.05; }

  setPath(path, s0 = 0) {
    this.track = new Track(path);
    this.s = clamp(s0, 0, this.track.len); this.arrived = false;
    this.track.at(this.s, _P); this.x = _P.x; this.z = _P.z; this.yaw = Math.atan2(_P.tx, _P.tz);
    if (this.state === "hold") this.state = "sail";
    return this;
  }
  stop() { if (this.state === "sail") this.state = "hold"; return this; }
  // mắc cọc (director, lúc con nước qua strandAt): dừng hẳn, nổi theo nước nhưng không lún quá đáy, CHƯA nghiêng; strand()
  // sau đó mới lún và nghiêng
  catch() { if (this.state === "sail" || this.state === "hold") { this.state = "caught"; this.restY = -Infinity; } return this; }
  go(speed) { if (speed !== undefined) this.targetSpeed = speed; if (this.state === "hold") this.state = "sail"; this.arrived = false; return this; }
  // mắc cạn / mắc cọc: bắt đầu lún và nghiêng (director gọi, hoặc tự xảy ra khi ky chạm đáy nếu autoGround)
  strand() { if (this.state === "sail" || this.state === "hold" || this.state === "caught") this._settle(null); return this; }
  sink() { if (this.state !== "sunk") { this.state = "sunk"; this.sinkT = 0; this.ySink = this.y; this.sinkSign = this.roll >= 0 ? 1 : -1; this.speed = 0; } return this; }
  _settle(env) {
    this.state = "settle"; this.settleT = 0; this.y0 = this.y; this.p0 = this.pitch; this.r0 = this.roll;
    this.restY = env && env.bedHeight ? env.bedHeight(this.x, this.z) + this.hull.draft - BOAT.mudSink : -Infinity;
  }

  // env: { tideY (m), t (s), bedHeight(x, z), stakeActive(x, z) → bool }
  update(dt, env = {}) {
    const H = this.hull, t = env.t ?? 0, tideY = env.tideY ?? 0;
    if ((this.state === "settle" || this.state === "stranded" || this.state === "caught") && this.restY === -Infinity && env.bedHeight)
      this.restY = env.bedHeight(this.x, this.z) + H.draft - BOAT.mudSink;
    // áp mạn: vị trí, hướng theo thuyền kia (đặt trước khi lấy mẫu sóng)
    const F = this.follow;
    if (F && this.state !== "stranded" && this.state !== "settle" && this.state !== "sunk") {
      const L = F.boat, c = Math.cos(L.yaw), sn = Math.sin(L.yaw);
      this.x = L.x + F.dx * c + F.dz * sn; this.z = L.z - F.dx * sn + F.dz * c; this.yaw = wrap(L.yaw + F.dyaw); this.speed = L.speed;
    }
    // chạy theo đường (mắc cạn thì trượt thêm một đoạn rồi dừng; bị mắc cọc thì hãm lại)
    else if (this.drive && this.track && this.state !== "stranded" && this.state !== "sunk") {
      const s0 = this.s; this.s = clamp(this.drive(dt), 0, this.track.len); this.speed = dt > 0 ? Math.abs(this.s - s0) / dt : 0;
      this.track.at(this.s, _P); this.x = _P.x; this.z = _P.z;
      if (this.speed > 0.05) this.yaw = wrap(this.yaw + wrap(Math.atan2(_P.tx, _P.tz) - this.yaw) * Math.min(1, dt * 4));
    }
    else if (this.track && this.state !== "stranded" && this.state !== "sunk") {
      const tgt = this.state === "sail" ? this.targetSpeed : 0, acc = this.state === "settle" || this.state === "caught" ? BOAT.acc * 3 : BOAT.acc;
      this.speed += clamp(tgt - this.speed, -acc * dt, acc * dt);
      if (this.speed > 0) {
        this.s += this.speed * dt;
        if (this.s >= this.track.len) { this.s = this.track.len; this.speed = 0; if (this.state === "sail") { this.state = "hold"; this.arrived = true; } }
        this.track.at(this.s, _P); this.x = _P.x; this.z = _P.z;
        this.yaw = wrap(this.yaw + wrap(Math.atan2(_P.tx, _P.tz) - this.yaw) * Math.min(1, dt * BOAT.turn));
      }
    }
    // dập dềnh: lấy mẫu sóng ở mũi, đuôi, hai mạn; thuyền lớn nhấp nhô ít hơn
    // (độ sâu lấy một lần ở tâm thuyền: nước nông thì sóng lặng như shader)
    const L = H.len, B = H.beam, amp = this.calm ? 0 : clamp(10 / L, 0.35, 1), fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const dep = env.bedHeight ? tideY - env.bedHeight(this.x, this.z) : 9;
    const yb = waveY(this.x + fx * L * 0.4, this.z + fz * L * 0.4, t, dep), ys = waveY(this.x - fx * L * 0.4, this.z - fz * L * 0.4, t, dep);
    const yp = waveY(this.x + fz * B * 0.5, this.z - fx * B * 0.5, t, dep), yq = waveY(this.x - fz * B * 0.5, this.z + fx * B * 0.5, t, dep);
    const floatY = tideY + amp * (yb + ys + yp + yq) / 4;
    const wp = amp * Math.atan2(ys - yb, L * 0.8), wr = amp * (Math.atan2(yp - yq, B) + 0.03 * Math.sin(t * 0.7 + this.phase));
    // tự mắc: ky chạm đáy (hoặc chạm cọc ở mốc đã kích hoạt)
    if (this.autoGround && (this.state === "sail" || this.state === "hold") && env.bedHeight) {
      const bed = env.bedHeight(this.x, this.z), catchH = env.stakeActive && env.stakeActive(this.x, this.z) ? BOAT.stakeCatch : 0;
      if (tideY - H.draft <= bed + catchH) this._settle(env);
    }
    switch (this.state) {
      case "sail": case "hold":
        // không tự mắc (naval.js): nước cạn thì ky tựa bùn, không chìm xuyên đáy
        this.y = !this.autoGround && env.bedHeight ? Math.max(floatY, env.bedHeight(this.x, this.z) + H.draft - BOAT.mudSink) : floatY;
        this.pitch = wp; this.roll = wr; break;
      case "caught": {                                  // mắc cọc: lắc rất ít, không lún quá đáy, chưa nghiêng
        const k = 0.35;
        this.y = Math.max(tideY + (floatY - tideY) * k, this.restY); this.pitch = wp * k; this.roll = wr * k; break;
      }
      case "settle": {
        this.settleT += dt;
        const k = smooth(0, BOAT.settle, this.settleT);
        this.y = lerp(this.y0, Math.max(this.restY, tideY), k);
        this.pitch = lerp(this.p0, this.tiltPitch, k); this.roll = lerp(this.r0, this.tiltRoll, k);
        if (this.settleT >= BOAT.settle) this.state = "stranded";
        break;
      }
      case "stranded": this.y = Math.max(this.restY, tideY); this.pitch = this.tiltPitch; this.roll = this.tiltRoll; break;
      case "sunk":
        this.sinkT += dt; this.y = this.ySink - BOAT.sinkRate * this.sinkT;
        this.roll += (BOAT.sinkRoll * this.sinkSign - this.roll) * Math.min(1, dt * 0.5);
        if (this.sinkT > BOAT.sinkHide) this.visible = false;
        break;
    }
    this.flash = Math.max(0, this.flash - dt * 4);
    this.deck.setPose(this.x, this.y, this.z, this.yaw, this.pitch, this.roll);
    return this;
  }
  // độ nghiêng tổng của boong (rad) — góc giữa pháp tuyến boong và phương thẳng đứng
  get tilt() { return Math.acos(clamp(Math.cos(this.pitch) * Math.cos(this.roll), -1, 1)); }
  // viên nang thân thuyền cho va chạm của người không ở trên boong: đoạn dọc ky, bán kính nửa bề rộng
  hullCapsule(out = {}) {
    const H = this.hull, r = H.beam / 2, h = Math.max(0, H.len / 2 - r), fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    out.x0 = this.x - fx * h; out.z0 = this.z - fz * h; out.x1 = this.x + fx * h; out.z1 = this.z + fz * h; out.r = r;
    return out;
  }
}

// ---- vẽ cả hạm đội -------------------------------------------------------------------------------------------------
// Mỗi (loại × LOD0/LOD1) một InstancedMesh, LOD2 một InstancedMesh cho mỗi họ (Nguyên, Trần), cờ chữ một InstancedMesh
// dùng chung atlas: thường 6–10 lượt vẽ. LOD0 cho tối đa 12 thuyền gần nhất trong `near`, LOD1 tới `far` và trong
// trần `cap` (24/40/60 theo mức đồ hoạ), còn lại hình thay thế. Chỉ LOD0 đổ bóng.
export const FLEET_LOD = { near: 110, nearBig: 170, far: 250, n0: 12, hyst: 0.08, flagCells: 16, lod2Cap: 256 };
const _m = new THREE.Matrix4(), _mf = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ");
const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export class FleetRenderer {
  constructor(scene, { shadows = true, cap = 40, mat = null } = {}) {
    this.scene = scene; this.cap = cap; this.shadows = shadows;
    this.mat = mat || lambert(); this._ownMat = !mat;
    this.meshes = new Map(); this._list = [];
    for (const type of Object.keys(HULLS)) {
      this._add(type + ":0", hullGeometry(type, 0), type === "flagship" ? 2 : FLEET_LOD.n0, shadows, 0);
      this._add(type + ":1", hullGeometry(type, 1), type === "flagship" ? 2 : cap, false, 1);
    }
    for (const fam of ["yuan", "tran"]) this._add(fam + ":2", impostorGeometry(fam), FLEET_LOD.lod2Cap, false, 2);
    this._flags();
    if (this._ownMat) this._seeThrough();
  }
  // Xuyên thấu hành lang máy quay → tướng (như seeThrough của scenery.js, cho lưới instance: toạ độ thế giới qua instanceMatrix):
  // mảnh thân thuyền, buồm, lầu chỉ huy cao hơn hông tướng nằm trong ống 1,2–2,6 m quanh đoạn máy quay → ngực tướng (chừa 0,6–1,6 m
  // cuối quanh tướng), hoặc cách ống kính < 2–3,5 m, bị loại theo mẫu chấm (tối đa 88%). Mặt boong dưới chân tướng không mờ. Bóng
  // đổ giữ nguyên. setSee(cam, x, y, z) mỗi khung (naval: world.fadeOccluders). Review B20: buồm / mạn / lầu che trận đánh 15–35%
  // khung ở P2, P4, P5; trước đây máy quay xoay song song buồm, kéo sát 6 m (sailCamera) — nay chỉ làm mờ.
  _seeThrough() {
    const uCam = this.uSeeCam = { value: new THREE.Vector3(0, -1e4, 0) }, uTgt = this.uSeeTgt = { value: new THREE.Vector3(0, -1e4, 1) };
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSeeCam = uCam; sh.uniforms.uSeeTgt = uTgt;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vSeeW;")
        .replace("#include <project_vertex>", "#include <project_vertex>\n vec4 sw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n sw = instanceMatrix * sw;\n#endif\n vSeeW = (modelMatrix * sw).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vSeeW;\nuniform vec3 uSeeCam, uSeeTgt;")
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
  {
    vec3 ax = uSeeTgt - uSeeCam; float L = max(length(ax), 1e-3); ax /= L;
    vec3 d = vSeeW - uSeeCam; float t = dot(d, ax), r = length(d - ax * t);
    float k = (1.0 - smoothstep(1.2, 2.6, r)) * step(0.0, t) * (1.0 - smoothstep(L - 1.6, L - 0.6, t)) * step(uSeeTgt.y - 0.5, vSeeW.y);
    k = max(k, 1.0 - smoothstep(2.0, 3.5, length(d)));
    if (k * 0.88 > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
  }`);
    };
    this.mat.customProgramCacheKey = () => "hk-see-fleet";
  }
  setSee(cam, x, y, z) { if (this.uSeeCam) { this.uSeeCam.value.copy(cam); this.uSeeTgt.value.set(x, y, z); } }
  _add(key, geo, capN, cast, lod) {
    const m = new THREE.InstancedMesh(geo, this.mat, capN);
    m.count = 0; m.visible = false; m.castShadow = cast; m.receiveShadow = lod < 2;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, _c.setRGB(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.userData.cap = capN; m.userData.tris = geo.attributes.position.count / 3; m.name = "boats:" + key;
    this.meshes.set(key, m); this.scene.add(m);
  }
  // cờ chữ: một lá cờ đơn vị (rộng 1 theo −z từ cán, dài 1 rủ theo −y), mỗi instance chọn ô atlas qua aCell; sóng vải trong shader
  _flags() {
    const N = FLEET_LOD.flagCells, cvs = document.createElement("canvas"); cvs.width = 64 * N; cvs.height = 256;
    this.flagCvs = cvs; this.flagCells = new Map();
    const tex = this.flagTex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
    const pos = [], uv = [], idx = [], SEG = 4;
    for (let i = 0; i <= SEG; i++) for (const v of [0, 1]) { const u = i / SEG; pos.push(0, -v, -u); uv.push(u, 1 - v); }
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const cell = new THREE.InstancedBufferAttribute(new Float32Array(this.cap + 8), 1); cell.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aCell", cell);
    const mat = this.flagMat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
    this.uTime = { value: 0 };
    // mặt sau lá cờ: lật u trong ô atlas (chữ không bị ngược khi nhìn từ phía kia — review B20: 帥 đọc thành "中白", 陳 thành 刺)
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.uTime;
      sh.vertexShader = "uniform float uTime;\nattribute float aCell;\nvarying float vCell;\n" + sh.vertexShader
        .replace("#include <uv_vertex>", `#include <uv_vertex>\n vCell = aCell;\n#ifdef USE_MAP\n vMapUv.x = (vMapUv.x + aCell) / ${N}.0;\n#endif`)
        .replace("#include <begin_vertex>", "#include <begin_vertex>\n float fw = -transformed.z;\n transformed.x += sin(uTime * 4.5 + fw * 2.4 + aCell * 1.7) * 0.16 * fw;");
      sh.fragmentShader = "varying float vCell;\n" + sh.fragmentShader.replace("#include <map_fragment>",
        `#ifdef USE_MAP\n vec2 fuv = vMapUv;\n if (!gl_FrontFacing) fuv.x = (2.0 * vCell + 1.0) / ${N}.0 - fuv.x;\n diffuseColor *= texture2D(map, fuv);\n#endif`);
    };
    const m = this.flagMesh = new THREE.InstancedMesh(g, mat, this.cap + 8);
    m.count = 0; m.visible = false; m.name = "boats:flags"; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(m);
  }
  _cell(text, side) {
    const key = side + ":" + text;
    let c = this.flagCells.get(key);
    if (c !== undefined) return c;
    c = Math.min(this.flagCells.size, FLEET_LOD.flagCells - 1);
    this.flagCells.set(key, c);
    const x = this.flagCvs.getContext("2d"), ox = c * 64, ta = side === "ta";
    const bg = ta ? "#9b2d20" : "#2c3a4a", fg = ta ? "#f1d98a" : "#e6dcc3";
    x.fillStyle = bg; x.fillRect(ox, 0, 64, 256);
    x.strokeStyle = fg; x.lineWidth = 3; x.strokeRect(ox + 4, 4, 56, 248);
    const chars = [...text], step = 236 / Math.max(1, chars.length);
    x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `bold ${Math.min(40, step * 0.8)}px serif`;
    chars.forEach((ch, i) => x.fillText(ch, ox + 32, 14 + step * (i + 0.5)));
    this.flagTex.needsUpdate = true;
    return c;
  }

  // Mỗi khung: chọn LOD theo khoảng cách tới camera, ghi ma trận instance. t: giây (sóng cờ). b.rv: tư thế vẽ nội suy giữa hai bước mô
  // phỏng (naval.render, đợt 19c); không có (lab-b20) thì tư thế thật.
  sync(boats, camera, t = performance.now() / 1000) {
    const cp = camera.position, list = this._list, L = FLEET_LOD, h = L.hyst;
    list.length = 0;
    for (const b of boats) if (b.visible) { b._d = Math.hypot(b.x - cp.x, b.z - cp.z); list.push(b); }
    list.sort((a, b) => a._d - b._d);
    for (const m of this.meshes.values()) m.count = 0;
    let n0 = 0, shown = 0, nf = 0;
    const fm = this.flagMesh, fcell = fm.geometry.attributes.aCell;
    for (const b of list) {
      const H = b.hull, prev = b._lod ?? 9;
      const near = (b.type === "flagship" ? L.nearBig : L.near) * (prev === 0 ? 1 + h : 1 - h), far = L.far * (prev <= 1 ? 1 + h : 1 - h);
      let lod = b._d < near && n0 < L.n0 ? 0 : b._d < far && shown < this.cap ? 1 : 2;
      let m = this.meshes.get(lod < 2 ? b.type + ":" + lod : H.family + ":2");
      if (lod === 0 && m.count >= m.userData.cap) { lod = 1; m = this.meshes.get(b.type + ":1"); }
      if (lod === 1 && m.count >= m.userData.cap) { lod = 2; m = this.meshes.get(H.family + ":2"); }
      if (m.count >= m.userData.cap) continue;
      if (lod === 0) n0++;
      if (lod < 2) shown++;
      b._lod = lod;
      const P = b.rv || b;
      _e.set(P.pitch, P.yaw, P.roll, "YXZ"); _q.setFromEuler(_e);
      if (lod === 2) _s.set(H.imp[0], H.imp[1], H.imp[2]); else _s.set(1, 1, 1);
      _m.compose(_v.set(P.x, P.y, P.z), _q, _s);
      const i = m.count++;
      m.setMatrixAt(i, _m);
      const k = b.tint * (1 + 0.8 * b.flash);
      m.setColorAt(i, _c.setRGB(k, k, k));
      if (lod < 2 && b.flag && nf < fm.instanceMatrix.count) {
        _mf.compose(_v.set(H.flagAt[0], H.flagAt[1], H.flagAt[2]), _q.identity(), _s.set(1, H.flagSize.h, H.flagSize.w));
        _mf.premultiply(_m);
        fm.setMatrixAt(nf, _mf); fcell.array[nf] = this._cell(b.flag, b.side); nf++;
      }
    }
    for (const m of this.meshes.values()) {
      m.visible = m.count > 0;
      if (!m.visible) continue;
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
    fm.count = nf; fm.visible = nf > 0;
    if (nf) { fm.instanceMatrix.needsUpdate = true; fcell.needsUpdate = true; fm.computeBoundingSphere(); }
    this.uTime.value = t;
  }
  // số lượt vẽ và tam giác của hạm đội (chưa tính bóng)
  get info() {
    let draws = 0, tris = 0;
    for (const m of this.meshes.values()) if (m.visible) { draws++; tris += m.count * m.userData.tris; }
    if (this.flagMesh.visible) { draws++; tris += this.flagMesh.count * 8; }
    return { draws, tris };
  }
  dispose() {
    for (const m of [...this.meshes.values(), this.flagMesh]) { this.scene.remove(m); m.dispose(); }
    this.flagMesh.geometry.dispose(); this.flagMat.dispose(); this.flagTex.dispose();
    if (this._ownMat) this.mat.dispose();
    this.meshes.clear();
  }
}
