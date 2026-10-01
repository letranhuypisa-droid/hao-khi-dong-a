// data/river-b20.js — hình học khúc sông Bạch Đằng của B20 (bản thử), nguồn duy nhất cho địa hình, nước,
// cảnh, hạm đội và mô phỏng. Thuần số, không import three, chạy được trong Node.
//
// Bố cục là Hư cấu, nén từ ~2 km hạ lưu (canon B20 mapNotes) còn 1,2 km cho vừa Trận nhanh.
// Trục: x 0 thượng lưu (tây) → x 1200 cửa sông (đông, ra biển); z âm = bờ bắc, z dương = bờ nam. Đơn vị mét.
// Mọi số dưới đây là ĐỀ XUẤT BẢN THỬ trừ khi có ghi nguồn.

const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// Con nước: mặt nước theo phần trăm đồng hồ "Con nước" (systems §5.8, §7). Biên độ ~3 m khớp cọc dài 1,5–3 m (canon).
export const TIDE = { low: -1.6, high: 1.4 };
export const TIDE_Y = (pct) => TIDE.low + (TIDE.high - TIDE.low) * Math.min(100, Math.max(0, pct)) / 100;

// Tâm dòng uốn nhẹ; bề rộng nửa dòng: 85 m thượng lưu, thắt 72 m ở khúc cọc, loe ra cửa sông.
export const zc = (x) => 18 * Math.sin(x / 210) + 10 * Math.sin(x / 97 + 1.3);
export function hw(x) {
  let w = 85 + (72 - 85) * sstep(380, 470, x);                 // thắt vào khúc cọc
  w += (120 - 72) * sstep(830, 1050, x);                       // loe dần
  w += (200 - 120) * sstep(1050, 1200, x);                     // cửa sông
  return w;
}

export const RIVER = {
  reach: { x0: 480, x1: 820, blend: 40 },                      // "Khúc cọc": bãi cạn rộng, đáy ≈ −2,1 m
  bedDeep: -4.6, bedShoal: -2.1, bankY: 2.2, bankW: 14,
  khucCoc: 470,                                                 // mốc Khúc cọc (pha 1 → pha 2)
  exitX: 1180,                                                  // cửa sông: lối thoát của hạm đội
  // Ba nhánh sông có thuyền phục (canon mapNotes: sông Chanh, sông Rút, sông Giá). side −1 bờ bắc, +1 bờ nam.
  tribs: [
    { id: "chanh", name: "Sông Chanh", mouthX: 430, side: -1, dir: { x: -0.55, z: -0.83 }, len: 150, hw: 16, bed: -2.6 },
    { id: "rut",   name: "Sông Rút",   mouthX: 620, side: 1,  dir: { x: 0.5, z: 0.87 },    len: 150, hw: 16, bed: -2.6 },
    { id: "gia",   name: "Sông Giá",   mouthX: 820, side: -1, dir: { x: 0.6, z: -0.8 },    len: 150, hw: 16, bed: -2.6 },
  ],
};

// Mốc cọc (canon: 3 mốc). Vị trí dọc sông; nằm trên tâm dòng. Bãi cọc 70 m dọc × 60 m ngang.
export const STAKE_FIELDS = [
  { id: "M1", x: 545, along: 70, across: 60 },
  { id: "M2", x: 655, along: 70, across: 60 },
  { id: "M3", x: 765, along: 70, across: 60 },
];
// Đỉnh cọc cao hơn đáy (m) — MỘT bộ số cho cảnh (scenery-b20 dựng cọc), thuyền (boats.js BOAT.stakeCatch: ky chạm đỉnh cọc
// thấp nhất) và kiểm thử. Đáy khúc cọc ≈ −2,1 ± 0,25 nên đỉnh ≈ −1,15 … −0,05: cọc chỉ ló khỏi mặt nước khi con nước dưới
// ≈ 30–45% (hợp đồng gameplay B20), vẫn chìm ở sàn pha 2 (55%). Canon: cọc dài 1,5–3 m kể cả phần chôn. ĐỀ XUẤT BẢN THỬ.
export const STAKE_TOP = { min: 1.2, max: 1.8 };
// Bè cỏ ngụy trang ở tâm mỗi mốc (m): rộng w (ngang thân bè, trục x cục bộ) × dài d, mặt sàn cao y trên mặt nước.
export const RAFT = { w: 10, d: 6, y: 0.25 };

// Điểm trên bờ: điểm cách tâm dòng một khoảng theo hướng bờ (side −1 bắc, +1 nam).
export const bankPoint = (x, side, off) => ({ x, z: zc(x) + side * (hw(x) + off) });
// Điểm giữa dòng.
export const midPoint = (x, dz = 0) => ({ x, z: zc(x) + dz });
