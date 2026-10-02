// design/tools/bake/catalog.mjs — tệp nào nướng thế nào: ngân sách tam giác (design/systems.md §13.3: tướng người chơi ≤ 10 nghìn,
// tướng khác ≤ 6 nghìn, boss ≤ 8 nghìn), cỡ texture (người chơi 1024², còn lại 512²), khớp ghi tay khi bộ dò sai.

// Tướng Nguyên chung: hai tay buông dính vạt áo (đường đo dọc mặt lưới đi tắt qua áo) — khớp tay đọc từ ảnh lưới (cao 1,9).
const FIX_OFF_TUONG = {
  shL: [-0.25, 1.42, 0.0], elL: [-0.31, 1.16, 0.02], handL: [-0.31, 0.95, 0.06],
  shR: [0.25, 1.42, 0.0], elR: [0.31, 1.16, 0.02], handR: [0.31, 0.95, 0.06],
};
export const CHARS = {
  H35: { tris: 9000, tex: 1024 },
  H31: { tris: 9000, tex: 1024, wc01: true },
  LINH_r01: { tris: 9000, tex: 1024 },
  LINH_r24: { tris: 9000, tex: 1024 },
  H33: { tris: 6000, tex: 512 },
  H40: { tris: 6000, tex: 512 },
  X19: { tris: 7500, tex: 512 },
  X20: { tris: 7500, tex: 512 },
  X24: { tris: 7500, tex: 512 },
  OFF_tuong: { tris: 6000, tex: 512, fix: FIX_OFF_TUONG },
  OFF_photuong: { tris: 6000, tex: 512 },
  OFF_doitruong: { tris: 5000, tex: 512 },
  CV_khien: { tris: 5000, tex: 512 },
  CV_giao: { tris: 5000, tex: 512 },
  CV_cung: { tris: 5000, tex: 512 },
  CV_songdao: { tris: 5000, tex: 512 },
  CV_daidao: { tris: 5000, tex: 512 },
};

// Vũ khí: len = dài thật (m), grip = chỗ nắm tính từ đuôi (m) — design/glb-prompts.md mục G. tris theo bảng mục 1.
export const WEAPONS = {
  songdao: { src: "WPN_songdao", type: "blade", len: 1.05, grip: 0.09, tris: 1200 },
  daikiem: { src: "WPN_daikiem", type: "blade", len: 1.55, grip: 0.29, tris: 1500 },
  dadao: { src: "WPN_dadao", type: "blade", len: 2.6, grip: 0.65, side: true, flip: true, tris: 1500 },
  dao: { src: "WPN_dao", type: "blade", len: 1.2, grip: 0.1, tris: 1000 },
  dao_linh: { src: "WPN_dao_linh", type: "blade", len: 0.95, grip: 0.1, tris: 500 },
  giao_dv: { src: "WPN_giao_dv", type: "blade", len: 3.0, grip: 0.8, tris: 600 },
  giao_ng: { src: "WPN_giao_ng", type: "blade", len: 2.8, grip: 0.8, tris: 500 },
  chuy: { src: "WPN_chuy", type: "blade", len: 1.7, grip: 0.27, tris: 800 },
  cung_viet: { src: "WPN_cung_viet", type: "bow", len: 1.45, tris: 800 },
  cung_ng: { src: "WPN_cung_ng", type: "bow", len: 1.3, tris: 500 },
  khien_tron: { src: "WPN_khien_tron_ng", type: "shield", h: 0.74, tris: 500 },
  khien_nhat: { src: "WPN_khien_nhat_dv", type: "shield", h: 0.75, tris: 500 },
  no: { src: "WPN_no", type: "crossbow", len: 0.8, grip: 0.14, tris: 700 },
  mui_ten: { src: "PROP_mui_ten", type: "arrow", len: 0.85, tris: 120 },
};

// Lính đám đông: lods = tam giác thân mỗi mức (LOD0 < 18 m, LOD1 < 40 m, LOD2 xa hơn; ngân sách design/systems.md §13.3 — lính
// LOD0 ≤ 600 điện thoại, ≤ 1.000 PC: cả người lẫn vũ khí ~550–640); vũ khí đặt trong khung cẳng tay như soldiers.js (W.*,
// SHIELD.*): p = điểm nắm, wl = tam giác vũ khí mỗi mức. Giáo dời +z cho chân mũi trùng neo tua (soldier-motion.js TAS: dài giáo
// − 0,79). res: cạnh texture nướng của LOD0 (mặc định 512; kỵ binh 1024).
const HAND = -0.29;
export const KIT_LIST = {
  NG_DAO: { lods: [470, 220, 90], weapons: [{ id: "dao_linh", bone: "faR", p: [0, HAND, 0], wl: [80, 40, 12] }, { id: "khien_tron", bone: "faL", p: [0, -0.16, 0.14], wl: [70, 28, 10] }] },
  NG_GIAO: { lods: [470, 220, 90], tassel: "long", weapons: [{ id: "giao_ng", bone: "faR", p: [0, HAND, 0.09], wl: [70, 30, 12] }, { id: "khien_tron", bone: "faL", p: [0, -0.16, 0.12], s: 0.72, wl: [70, 28, 10] }] },
  NG_CUNG: { lods: [470, 220, 90], weapons: [{ id: "cung_ng", bone: "faL", p: [0, HAND, 0], wl: [80, 30, 12] }] },
  NG_TANK: { lods: [500, 240, 100], weapons: [{ id: "chuy", bone: "faR", p: [0, HAND, 0], wl: [90, 40, 14] }] },
  DV_GIAO: { lods: [470, 220, 90], tassel: "son", weapons: [{ id: "giao_dv", bone: "faR", p: [0, HAND, 0.11], wl: [70, 30, 12] }] },
  DV_DAO: { lods: [470, 220, 90], weapons: [{ id: "dao_linh", bone: "faR", p: [0, HAND, 0], wl: [80, 40, 12] }, { id: "khien_nhat", bone: "faL", p: [0, -0.14, 0.14], wl: [70, 28, 10] }] },
  DV_NO: { lods: [470, 220, 90], weapons: [{ id: "no", bone: "faR", p: [0, HAND, 0], wl: [90, 40, 14] }] },
  // kỵ binh: [tam giác ngựa, tam giác người cưỡi] mỗi mức; cung ở cẳng tay trái như BUILD.NG_KY (HAND + 0,02 của khung ngựa: −0,27)
  NG_KY: { horse: "MOUNT_ngua_nguyen", lods: [[440, 360], [170, 140], [70, 60]], weapons: [{ id: "cung_ng", bone: "faL", p: [0, -0.27, 0], wl: [80, 30, 12] }] },
};
