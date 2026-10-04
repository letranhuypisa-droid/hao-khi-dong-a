// design/tools/bake/catalog.mjs — tệp nào nướng thế nào: ngân sách tam giác (design/systems.md §13.3: tướng người chơi ≤ 10 nghìn,
// tướng khác ≤ 6 nghìn, boss ≤ 8 nghìn), cỡ texture (người chơi 1024², còn lại 512²), khớp ghi tay khi bộ dò sai, hộp cắt phần thừa,
// chiều và chỗ cầm vũ khí.

// Khớp ghi tay (toạ độ chuẩn hoá thô cao 1,9, đọc từ ảnh lưới; human.mjs fitHuman — trọng số tay theo chuỗi xương ghi tay) cho mẫu
// bộ dò không dựng được. Tướng Nguyên chung: hai tay buông dính vạt áo (đường đo dọc mặt lưới đi tắt qua áo).
const FIX_OFF_TUONG = {
  shL: [-0.25, 1.42, 0.0], elL: [-0.31, 1.16, 0.02], handL: [-0.31, 0.95, 0.06],
  shR: [0.25, 1.42, 0.0], elR: [0.31, 1.16, 0.02], handR: [0.31, 0.95, 0.06],
};
// Cận vệ đại đao: cánh tay áp sườn, khuỷu gập nhọn (cẳng tay giơ lên) — tâm vòng quanh khuỷu cắt góc, khuỷu dò rơi giữa cẳng tay.
// Khuỷu ở đáy chỗ gập (1,275), vai trong giáp vai (1,45), "hand" giữa lòng bàn tay như bộ dò.
const FIX_CV_DAIDAO = {
  shL: [-0.235, 1.45, -0.1], elL: [-0.28, 1.275, -0.04], handL: [-0.378, 1.431, 0.213],
  shR: [0.232, 1.45, -0.1], elR: [0.285, 1.275, -0.04], handR: [0.383, 1.438, 0.206],
};
// Nỏ binh Đại Việt (lính đám đông): cánh tay áp hẳn vào sườn — vòng đẳng mức nhập thân từ khuỷu, vai dò rơi ở khuỷu. Khuỷu ở đầu sau
// cẳng tay (1,19), vai 1,37.
const FIX_DV_NO = {
  shL: [-0.24, 1.37, -0.09], elL: [-0.27, 1.19, -0.09], handL: [-0.349, 1.175, 0.272],
  shR: [0.24, 1.37, -0.09], elR: [0.27, 1.19, -0.09], handR: [0.358, 1.175, 0.273],
};
// Phần thừa của mẫu Meshy cắt trước khi dò khớp, tính trọng số (human.mjs cutBoxes): tam giác có trọng tâm trong hộp { lo, hi }
// (khung chuẩn hoá thô cao 1,9 của lưới chưa cắt, như FIX_OFF_TUONG). Sừng mũ H33: phần trên 1,81 là sừng (núm mũ thấp hơn), hai bên
// |x| ≥ 0,04 trên vòm mũ (≥ 1,765), gốc sừng |x| ≥ 0,085 từ 1,715 (vòm mũ ở đó thấp hơn); X19: hai sừng |x| 0,055–0,14 trên 1,765
// (núm giữa |x| < 0,04 giữ). Bao đao DV_DAO: đoạn dưới thò ra ngoài hông trái (+x; đoạn trên áp sát mép áo, cắt thì thủng áo — giữ).
const CUT_H33 = [{ lo: [-0.16, 1.81, -0.2], hi: [0.16, 2, 0.2] }, { lo: [-0.16, 1.765, -0.2], hi: [-0.04, 1.81, 0.2] }, { lo: [0.04, 1.765, -0.2], hi: [0.16, 1.81, 0.2] },
  { lo: [-0.16, 1.715, -0.2], hi: [-0.085, 1.765, 0.2] }, { lo: [0.085, 1.715, -0.2], hi: [0.16, 1.765, 0.2] }];
const CUT_X19 = [{ lo: [-0.14, 1.765, -0.2], hi: [-0.055, 2, 0.2] }, { lo: [0.055, 1.765, -0.2], hi: [0.14, 2, 0.2] }];
const CUT_DV_DAO = [{ lo: [0.255, 0.55, -0.36], hi: [0.36, 0.85, 0.1] }];
export const CHARS = {
  H35: { tris: 9000, tex: 1024 },
  H31: { tris: 9000, tex: 1024, wc01: true },
  LINH_r01: { tris: 9000, tex: 1024 },
  LINH_r24: { tris: 9000, tex: 1024 },
  H33: { tris: 6000, tex: 512, cut: CUT_H33 },
  H40: { tris: 6000, tex: 512 },
  X19: { tris: 7500, tex: 512, cut: CUT_X19 },
  X20: { tris: 7500, tex: 512 },
  X24: { tris: 7500, tex: 512 },
  OFF_tuong: { tris: 6000, tex: 512, fix: FIX_OFF_TUONG },
  OFF_photuong: { tris: 6000, tex: 512 },
  OFF_doitruong: { tris: 5000, tex: 512 },
  CV_khien: { tris: 5000, tex: 512 },
  CV_giao: { tris: 5000, tex: 512 },
  CV_cung: { tris: 5000, tex: 512 },
  CV_songdao: { tris: 5000, tex: 512 },
  CV_daidao: { tris: 5000, tex: 512, fix: FIX_CV_DAIDAO },
};

// Vũ khí: len = dài thật (m), grip = chỗ nắm tính từ đuôi (m) — design/glb-prompts.md mục G. tris theo bảng mục 1. flip: mẫu Meshy
// dựng ngược (mũi xuống) — đầu dưới là mũi. Bốn thanh kiếm, đao Meshy đều dựng mũi xuống: trước đây nướng không flip nên gốc nắm
// nằm ở mũi lưỡi, chuôi chĩa ra trước. grip đo từ núm chuôi, tay nắm ngay dưới chắn tay (mặt cắt sau flip — chuôi / chắn tay:
// songdao 0,04–0,30 / 0,32; dao 0,04–0,24 / 0,26; dao_linh 0,04–0,27 / 0,30; daikiem 0,08–0,46 / 0,48, tay trái 0,2 dưới tay
// phải vẫn trên chuôi). Đại đao: lưỡi chạy dọc nửa trên cán (0,66–2,32 tính từ đuôi, đĩa chắn tay 0,52), tay phải nắm cán dưới đĩa
// (0,40), còn 0,4 m cán sau tay. head: ghi chân đầu (giáo: chân mũi, đại đao: chân lưỡi) vào meta.head — tua treo ở đó.
export const WEAPONS = {
  songdao: { src: "WPN_songdao", type: "blade", len: 1.05, grip: 0.25, flip: true, tris: 1200 },
  daikiem: { src: "WPN_daikiem", type: "blade", len: 1.55, grip: 0.41, flip: true, tris: 1500 },
  dadao: { src: "WPN_dadao", type: "blade", len: 2.6, grip: 0.4, side: true, flip: true, head: true, tris: 1500 },
  dao: { src: "WPN_dao", type: "blade", len: 1.2, grip: 0.19, flip: true, tris: 1000 },
  dao_linh: { src: "WPN_dao_linh", type: "blade", len: 0.95, grip: 0.22, flip: true, tris: 500 },
  giao_dv: { src: "WPN_giao_dv", type: "blade", len: 3.0, grip: 0.8, head: true, tris: 600 },
  giao_ng: { src: "WPN_giao_ng", type: "blade", len: 2.8, grip: 0.8, head: true, tris: 500 },
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
// SHIELD.*): p = điểm nắm, wl = tam giác vũ khí mỗi mức. Neo tua giáo = p + chân mũi đo lúc nướng (kit meta.tas → soldier-motion.js
// TAS; trước đây giáo chỉ dời +z mong chân mũi trùng neo "dài giáo − 0,79" của giáo dựng bằng code, nhưng mũi Meshy dài hơn nên tua
// treo giữa lưỡi). res: cạnh texture nướng của LOD0 (mặc định 512; kỵ binh 1024). LOD2 của vũ khí dài: giảm lưới gộp cán / lưỡi mảnh
// thành đường thẳng trước (sai số chỉ bằng bề dày) — giáo Đại Việt 12 tam giác còn 4 (mất cán, tua treo giữa trời), đao lính 12 chỉ
// còn chắn tay + chuôi: giáo 24, đao 20 (đo phủ trục dài: 87%, 99%).
const HAND = -0.29;
export const KIT_LIST = {
  NG_DAO: { lods: [470, 220, 90], weapons: [{ id: "dao_linh", bone: "faR", p: [0, HAND, 0], wl: [80, 40, 20] }, { id: "khien_tron", bone: "faL", p: [0, -0.16, 0.14], wl: [70, 28, 10] }] },
  NG_GIAO: { lods: [470, 220, 90], tassel: "long", weapons: [{ id: "giao_ng", bone: "faR", p: [0, HAND, 0.09], wl: [70, 30, 12] }, { id: "khien_tron", bone: "faL", p: [0, -0.16, 0.12], s: 0.72, wl: [70, 28, 10] }] },
  NG_CUNG: { lods: [470, 220, 90], weapons: [{ id: "cung_ng", bone: "faL", p: [0, HAND, 0], wl: [80, 30, 12] }] },
  NG_TANK: { lods: [500, 240, 100], weapons: [{ id: "chuy", bone: "faR", p: [0, HAND, 0], wl: [90, 40, 14] }] },
  DV_GIAO: { lods: [470, 220, 90], tassel: "son", weapons: [{ id: "giao_dv", bone: "faR", p: [0, HAND, 0.11], wl: [70, 30, 24] }] },
  DV_DAO: { lods: [470, 220, 90], cut: CUT_DV_DAO, weapons: [{ id: "dao_linh", bone: "faR", p: [0, HAND, 0], wl: [80, 40, 20] }, { id: "khien_nhat", bone: "faL", p: [0, -0.14, 0.14], wl: [70, 28, 10] }] },
  DV_NO: { lods: [470, 220, 90], fix: FIX_DV_NO, weapons: [{ id: "no", bone: "faR", p: [0, HAND, 0], wl: [90, 40, 14] }] },
  // kỵ binh: [tam giác ngựa, tam giác người cưỡi] mỗi mức; cung ở cẳng tay trái như BUILD.NG_KY (HAND + 0,02 của khung ngựa: −0,27)
  NG_KY: { horse: "MOUNT_ngua_nguyen", lods: [[440, 360], [170, 140], [70, 60]], weapons: [{ id: "cung_ng", bone: "faL", p: [0, -0.27, 0], wl: [80, 30, 12] }] },
};
