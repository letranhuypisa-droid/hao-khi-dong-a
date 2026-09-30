// data/moves-wc01.js — bộ đòn WC01 Đại kiếm (H31 Trần Hưng Đạo; H34 Trần Khánh Dư dùng chung, systems §4.4).
// File này KHÔNG import gì (chạy được trong Node để kiểm thử).
//
// Cùng dạng mục với MOVES (tuning.js, WC03): { mv, dur, hits, stop, stopLast?, shape, range, arc?, width?, knock?, launch?,
// step?, dash?, crit?, poiseMult?, unlockLv? } — mv ĐÃ nhân hệ số lớp 1,35; dur là giây ở Tốc đánh ×1,0; hits là tỉ lệ
// thời điểm trúng trong clip. Cộng thêm cờ tường minh (hero.js hiện đoán theo tên đòn / MV ≥ 2 — lớp này MV lớn nên phải
// ghi rõ):
//   heavy      cảm giác trúng nặng (rung, giật camera, âm "hitHeavy", lính trúng coi là đòn nặng)
//   heavyTell  đòn đáng né: lính né khi thấy tướng gồng (thay HEAVY_MOVES của crowd.js)
//   slam       lưỡi bổ xuống đất ở nhát cuối: tung bụi, tiếng chấn
//   ringFx     vòng sóng xung kích trên đất khi trúng
//   kiai       có tiếng thét (xác suất như hero.js)
//   mirrorArc  vệt chém lật ngược (chém từ trái sang phải)
//   armor      [u0, u1] cửa sổ siêu giáp (§4.4 "siêu giáp khi vung"): đòn nặng, đòn hất ngã không ngắt; đòn viền đỏ vẫn ngắt
//              (ĐỀ XUẤT BẢN THỬ — giữ Né, Đỡ còn giá trị)
//   charge     giữ C để tụ lực (weapon-classes.js WC01.traits.charge); clip dừng ở khung gồng (chargeU) trong lúc giữ
//   armorPen   bỏ qua phần giáp (C6: 0,3 theo §4.4)
//   endsChain  đòn kết chuỗi N (không nối tiếp; các đòn không phải N vốn không nối)
//   hold       C3: giữ C để kéo dài tới hold.maxHits nhát (§4.1 "C3 đa đòn (giữ để kéo dài)")
//
// ĐỀ XUẤT BẢN THỬ (toàn bảng): MV = §4.2 × 1,35; thời lượng chuỗi N = (MV chuẩn / 1,6) / 0,75 → ΣMV/Σdur N1–N6 = 8,38 /
// 5,17 ≈ 1,62 MV/s (§2.2, ±10%); đòn C, lướt = thời lượng WC03 × 1,3 / 0,75; tầm code = tầm chuẩn + 1,2 m (cùng phần bù
// WC03 đang dùng), đòn vùng lớn giữ bán kính chuẩn. Hit-stop theo §2.5 (N 33, N6 và C1–C5 67, C6 100, Đòn Quyết 167).

export const MOVES_WC01 = {
  // N1 chém xéo phải → trái, N2 chém ngược trái → phải, N3 bổ thẳng qua đầu, N4 quét ngang rộng kèm bước, N5 đâm rồi
  // hất lên, N6 xoay hai tay một vòng rưỡi (đòn kết chuỗi)
  N1: { mv: 1.08, dur: 0.67, hits: [0.48], stop: 33, shape: "cone", range: 4.7, arc: 150, knock: 3, step: 0.7, armor: [0.15, 0.6] },
  N2: { mv: 1.08, dur: 0.67, hits: [0.48], stop: 33, shape: "cone", range: 4.7, arc: 150, knock: 3, step: 0.7, armor: [0.15, 0.6], mirrorArc: true },
  N3: { mv: 1.22, dur: 0.75, hits: [0.5], stop: 33, shape: "cone", range: 5.0, arc: 70, knock: 5, step: 0.8, armor: [0.15, 0.62], slam: true },
  N4: { mv: 1.35, dur: 0.83, hits: [0.5], stop: 33, shape: "cone", range: 4.8, arc: 180, knock: 3.5, step: 0.8, armor: [0.15, 0.62], mirrorArc: true },
  N5: { mv: 1.49, dur: 0.92, hits: [0.52], stop: 33, shape: "cone", range: 5.2, arc: 100, knock: 4, step: 1.0, armor: [0.15, 0.64] },
  N6: { mv: 2.16, dur: 1.33, hits: [0.58], stop: 67, shape: "ring", range: 5.2, knock: 7, step: 0.6, armor: [0.1, 0.7],
    heavy: true, heavyTell: true, ringFx: true, kiai: true, endsChain: true },
  // C1 bổ phá thế (phá đỡ, phá khiên) · C2 hất tung · C3 lốc kiếm giữ để kéo dài · C4 xoay rồi bổ đất (Trảm Giang) ·
  // C5 lao xuyên hàng (cấp 5) · C6 nhảy bổ phá giáp (cấp 10)
  C1: { mv: 2.43, dur: 1.21, hits: [0.55], stop: 67, shape: "cone", range: 5.0, arc: 100, knock: 7, step: 1.2, armor: [0.1, 0.65],
    heavy: true, heavyTell: true, slam: true, kiai: true, charge: true, chargeU: 0.3, guardBreak: true },
  C2: { mv: 1.62, dur: 1.14, hits: [0.5], stop: 67, shape: "cone", range: 4.8, arc: 140, launch: true, step: 0.6, armor: [0.1, 0.6],
    heavyTell: true, kiai: true },
  C3: { mv: 0.675, dur: 1.91, hits: [0.2, 0.35, 0.5, 0.65, 0.8], stop: 17, stopLast: 67, shape: "ring", range: 4.6, step: 0.3,
    armor: [0.05, 0.9], heavyTell: true, kiai: true, hold: { maxHits: 8 } },
  C4: { mv: 4.05, dur: 1.47, hits: [0.6], stop: 67, shape: "ring", range: 5.0, knock: 8, step: 0, armor: [0.05, 0.7],
    heavy: true, heavyTell: true, slam: true, ringFx: true, kiai: true, charge: true, chargeU: 0.42 },
  C5: { mv: 4.32, dur: 1.39, hits: [0.5], stop: 67, shape: "line", range: 8.0, width: 2.6, dash: 6, knock: 6, unlockLv: 5, armor: [0.05, 0.6],
    heavy: true, heavyTell: true, kiai: true },
  C6: { mv: 6.08, dur: 1.73, hits: [0.62], stop: 100, shape: "ring", range: 6.0, knock: 10, launch: true, step: 1.0, unlockLv: 10,
    armor: [0.05, 0.75], armorPen: 0.3, heavy: true, heavyTell: true, slam: true, ringFx: true, kiai: true, charge: true, chargeU: 0.3 },
  // Lướt N / Lướt C (né → N / C), Đòn Quyết (§2.4: MV 8 × 1,35, cảnh 1,2 s), phản đòn (tỉ lệ như WC03: 1,5 / 0,7 × 1,35)
  DN: { mv: 1.35, dur: 0.78, hits: [0.42], stop: 33, shape: "line", range: 5.0, width: 2.2, dash: 4, armor: [0.1, 0.5] },
  DC: { mv: 2.70, dur: 1.04, hits: [0.48], stop: 67, shape: "line", range: 6.0, width: 2.6, dash: 5, knock: 7, armor: [0.1, 0.55],
    heavy: true, heavyTell: true, kiai: true },
  DQ: { mv: 10.8, dur: 1.2, hits: [0.55], stop: 167, shape: "cone", range: 4.8, arc: 120, crit: true, step: 1.0, armor: [0.05, 0.75],
    heavy: true, heavyTell: true, slam: true, kiai: true },
  CT: { mv: 2.89, dur: 0.80, hits: [0.35], stop: 100, shape: "cone", range: 4.6, arc: 140, crit: true, poiseMult: 3, step: 0.8, armor: [0.05, 0.45] },
};
// Mọi đòn không có cờ thì cờ = false (hero.js đọc thẳng m.heavy …).
for (const k in MOVES_WC01) {
  const m = MOVES_WC01[k];
  for (const f of ["heavy", "heavyTell", "slam", "ringFx", "kiai", "mirrorArc", "charge", "endsChain"]) m[f] = !!m[f];
  m.armorPen ??= 0;
}

export const CHAIN_N = ["N1", "N2", "N3", "N4", "N5", "N6"];
export const HEAVY_MOVES = new Set(Object.keys(MOVES_WC01).filter((k) => MOVES_WC01[k].heavyTell));

// Tên, icon, lời giải thích (cùng khoá với MOVE_INFO của moves-info.js để HUD thay bộ). Tên đòn là Hư cấu của game;
// icon dùng lại bộ có sẵn (assets/icons).
export const MOVE_INFO_WC01 = {
  N:  { icon: "n",  name: "Tiết chế kiếm pháp", label: "Hư cấu", keys: ["J · chuột trái", "nút N", "X"],
        text: "Chuỗi 6 nhát N1–N6 bằng đại kiếm hai tay; khi vung không bị đòn thường ngắt. N6 xoay một vòng rưỡi đẩy lùi mọi kẻ quanh mình." },
  C1: { icon: "c1", name: "Phá Sơn", label: "Hư cấu", seq: "C (giữ để tụ lực)", text: "Giơ gươm qua đầu bổ thẳng, phá khiên, phá thế đỡ. Giữ C để tụ lực 3 cấp." },
  C2: { icon: "c2", name: "Kình Ba", label: "Hư cấu", seq: "N → C", text: "Kéo lưỡi sát đất rồi hất ngược lên, tung địch lên không." },
  C3: { icon: "c3", name: "Cuồng Lan", label: "Hư cấu", seq: "N N → C (giữ)", text: "Xoay đại kiếm liên hồi quanh mình; giữ C để xoay thêm, tới 8 nhát." },
  C4: { icon: "c4", name: "Trảm Giang", label: "Hư cấu", seq: "N N N → C (giữ)", text: "Xoay một vòng lấy đà rồi bổ xuống đất, sóng chấn tròn 5 m. Giữ C để tụ lực." },
  C5: { icon: "c5", name: "Xuyên Trận", label: "Hư cấu", seq: "N N N N → C", text: "Lao thẳng 8 m, mũi gươm xuyên hàng lính. Mở ở cấp 5." },
  C6: { icon: "c6", name: "Lôi Đình", label: "Hư cấu", seq: "N N N N N → C (giữ)", text: "Nhảy lên bổ xuống, vòng chấn 6 m hất tung tất cả, bỏ qua 30% giáp. Mở ở cấp 10." },
  D:  { icon: "dash", name: "Lướt kiếm", label: "Hư cấu", seq: "Né → N / C", text: "Vừa né xong bấm N (Lướt N) hoặc C (Lướt C): lao tới chém." },
  DQ: { icon: "dq", name: "Đòn Quyết", seq: "C cạnh kẻ Vỡ Thế", text: "Sĩ quan cạn thanh Phá Thế thì Vỡ Thế: bấm C cạnh hắn để kết liễu, chắc chắn chí mạng." },
  CT: { icon: "ct", name: "Phản đòn", seq: "Đỡ đúng lúc", text: "Bấm Đỡ đúng lúc đòn viền đỏ sắp trúng: gạt bằng bản gươm rồi chém trả." },
  skill: { icon: "skill", name: "Hịch Tướng Sĩ", label: "Chính sử", keys: ["E", "nút Hịch", "LB"],
           text: "Cắm gươm đọc hịch 3 s (bị ngắt nếu trúng đòn nặng): mọi cánh quân ta +15 Sĩ Khí, Công quân ta +10% trong 20 s. Hồi 40 s." },
  skill2: { icon: "lock", name: "Binh Thư Yếu Lược", label: "Chính sử", keys: ["T", "nút Binh Thư", "D-pad trái"],
            text: "Chỉ gươm đánh dấu một đơn vị địch hoặc Cứ Điểm: 20 s quân ta đánh mục tiêu +40%. Hồi 35 s." },
  ult: { icon: "ult", name: "Bạch Đằng Quyết Chiến", label: "Chính sử + Hư cấu", keys: ["R", "nút Tuyệt Kỹ", "B"],
         text: "Tốn một vạch Khí Lực: 12 s bất tử, 3 nhát bổ xuống đất tạo sóng chấn 15 m (nhát 3 phá mọi khiên); xong mọi cánh quân ta Tiến công, +15 Sĩ Khí." },
};
