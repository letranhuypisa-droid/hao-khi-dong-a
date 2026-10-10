// data/moves-wc09.js — bộ đòn WC09 Cung (H40 Nguyễn Khoái; sau này H32 Trần Quang Khải, H48 Lưu Nhân Chú — systems §4.4).
// File này chỉ import controls.js (thuần, nhãn phím theo thiết bị), nên chạy được trong Node để kiểm thử.
//
// Cùng dạng mục với MOVES_WC01 (mv ĐÃ nhân hệ số lớp 0,68; dur là giây ở Tốc đánh ×1,0; hits là tỉ lệ thời điểm buông dây /
// trúng trong clip), cộng các hình trúng đòn tầm xa (battle/hero.js shoot, đợt B17-B1):
//   shape "ray"   mũi tên bay thật từ tay tướng theo hướng ngắm, tốc speed m/s (mặc định arrowSpeed của lớp), tầm range m
//                 (KHÔNG nhân Tầm của tướng, §2.1), trúng người đầu tiên trên đường bay rồi xuyên thêm tới pierce người;
//                 trúng trễ theo quãng bay (mục tiêu chạy khỏi đường tên thì trượt). fan: [[lệch góc rad, hệ số MV], …] một
//                 lần buông nhiều tên (N6 tỏa 3 tên); mỗi tên một mv × hệ số.
//   shape "rain"  mưa tên: bắn vút lên, delay giây sau tên rơi xuống vòng r m (× Tầm của tướng) quanh mình (at "self") hay
//                 quanh mục tiêu / điểm ngắm (at "target", tối đa range m); mọi địch trong vòng trúng một lần.
//   shape "cone"  đòn cận chiến như các lớp khác (C2 đạp, CT quất cung).
//   back          lùi chừng này m sau nhát trúng (C2 đạp rồi lùi, DN lộn lùi bắn) — thay cho step / dash.
//   moveShoot     được đi chậm trong lúc bắn (weapon-classes.js WC09.traits.ranged.moveShoot).
//   charge        giữ C để kéo căng dây (C1): clip dừng ở khung căng dây chargeU, ngắm chính xác theo tâm màn, thả là bắn.
//   hold          C3: giữ C để bắn liên thanh tới hold.maxHits tên, mỗi hold.every giây một tên.
//
// ĐỀ XUẤT BẢN THỬ (toàn bảng): MV = §4.2 × 0,68. Chuỗi N tính theo nhịp thật của lõi: bấm dồn thì đòn N kế ra ngay sau lúc
// buông + 0,05 (hero.js updateAttack), nên thời gian hiệu dụng của N1–N5 là (hits + 0,05) × dur, N6 (kết chuỗi) trọn dur.
// Chọn dur để thời gian hiệu dụng mỗi phát = MV chuẩn / 1,92 → ΣMV 4,21 / 3,23 s ≈ 1,3 MV/s ở Tốc đánh ×1,0 (§2.2 tầm xa;
// tests/wc09.test.mjs đo bằng lõi thật, tính cả bay). Hit-stop như §2.5 nhưng mũi tên thường chỉ khựng khi chí mạng / hạ
// người / tên nặng (bắn liên tục mà khựng mỗi phát thì giật màn).
import { guideKeys } from "./controls.js";

export const MOVES_WC09 = {
  // N1–N5 bắn đơn nhanh (cánh tay kéo dây dài dần theo chuỗi), N6 tỏa 3 tên (đòn kết chuỗi)
  N1: { mv: 0.54, dur: 0.62, hits: [0.62], stop: 33, shape: "ray", range: 25, pierce: 1, knock: 1.4, moveShoot: true },
  N2: { mv: 0.54, dur: 0.62, hits: [0.62], stop: 33, shape: "ray", range: 25, pierce: 1, knock: 1.4, moveShoot: true },
  N3: { mv: 0.61, dur: 0.70, hits: [0.62], stop: 33, shape: "ray", range: 25, pierce: 1, knock: 1.6, moveShoot: true },
  N4: { mv: 0.68, dur: 0.78, hits: [0.62], stop: 33, shape: "ray", range: 25, pierce: 1, knock: 1.8, moveShoot: true },
  N5: { mv: 0.75, dur: 0.855, hits: [0.62], stop: 33, shape: "ray", range: 25, pierce: 1, knock: 2, moveShoot: true },
  N6: { mv: 1.09, dur: 0.83, hits: [0.6], stop: 67, shape: "ray", range: 25, pierce: 1, knock: 3, moveShoot: true,
    fan: [[0, 1], [-0.16, 0.5], [0.16, 0.5]], endsChain: true },
  // C1 tên nặng phá khiên (giữ để kéo căng, ngắm chính xác) · C2 đạp hất tung rồi lùi · C3 liên thanh (giữ để kéo dài) ·
  // C4 mưa tên quanh mình r 5 m · C5 tên xuyên hàng (cấp 5) · C6 mưa tên vùng r 6 m tại mục tiêu (cấp 10)
  C1: { mv: 1.22, dur: 1.0, hits: [0.6], stop: 67, shape: "ray", range: 30, pierce: 2, knock: 5, speed: 55, guardBreak: true,
    charge: true, chargeU: 0.45, heavy: true, kiai: true },
  C2: { mv: 0.82, dur: 0.75, hits: [0.35], stop: 67, shape: "cone", range: 2.6, arc: 120, launch: true, back: 3, heavyTell: true, kiai: true },
  C3: { mv: 0.34, dur: 1.25, hits: [0.22, 0.38, 0.54, 0.7, 0.86], stop: 17, stopLast: 33, shape: "ray", range: 25, pierce: 1, knock: 1.2,
    hold: { maxHits: 10, every: 0.16 }, moveShoot: true },
  C4: { mv: 2.04, dur: 1.1, hits: [0.45], stop: 67, shape: "rain", at: "self", r: 5, delay: 0.5, knock: 5, heavy: true, kiai: true },
  C5: { mv: 2.18, dur: 1.15, hits: [0.62], stop: 67, shape: "ray", range: 30, pierce: 8, width: 0.5, knock: 5, speed: 60, unlockLv: 5,
    heavy: true, kiai: true },
  C6: { mv: 3.06, dur: 1.4, hits: [0.5], stop: 100, shape: "rain", at: "target", range: 25, r: 6, delay: 0.8, knock: 6, launch: true,
    unlockLv: 10, heavy: true, kiai: true },
  // Lướt N: lộn lùi bắn · Lướt C: né rồi tên nặng xuyên 3 · Đòn Quyết: bắn sát mặt kẻ Vỡ Thế (§2.4: MV 8 × 0,68) · phản đòn:
  // quất cung gạt đòn rồi chém trả bằng cánh cung (tỉ lệ như WC03: 1,5 / 0,7 × 0,68)
  DN: { mv: 0.68, dur: 0.6, hits: [0.55], stop: 33, shape: "ray", range: 25, pierce: 1, knock: 2, back: 3 },
  DC: { mv: 1.36, dur: 0.8, hits: [0.55], stop: 67, shape: "ray", range: 30, pierce: 3, knock: 5, speed: 55, heavy: true, kiai: true },
  DQ: { mv: 5.44, dur: 1.0, hits: [0.55], stop: 167, shape: "ray", range: 10, pierce: 1, crit: true, speed: 70, heavy: true, kiai: true },
  CT: { mv: 1.46, dur: 0.65, hits: [0.35], stop: 100, shape: "cone", range: 3.2, arc: 140, crit: true, poiseMult: 3, step: 0.4 },
};
// Mọi đòn không có cờ thì cờ = false (hero.js đọc thẳng m.heavy …). Lính né đòn nặng (heavyTell) chỉ khi bị đạp (C2): nhảy
// lùi không tránh được mũi tên nên tên không báo né.
for (const k in MOVES_WC09) {
  const m = MOVES_WC09[k];
  for (const f of ["heavy", "heavyTell", "slam", "ringFx", "kiai", "mirrorArc", "charge", "endsChain"]) m[f] = !!m[f];
  m.armorPen ??= 0;
}

export const CHAIN_N = ["N1", "N2", "N3", "N4", "N5", "N6"];
export const RANGED_SHAPES = new Set(["ray", "rain"]);

// Tên, icon, lời giải thích (cùng khoá với MOVE_INFO của moves-info.js). Tên đòn là Hư cấu của game; icon dùng lại bộ có sẵn.
// Kỹ năng H40 theo canon (Tên Xuyên Hàng, Chặn Dòng Dụ Địch, Tuyệt Kỹ Móc Tên Trói Thuyền).
export const MOVE_INFO_WC09 = {
  N:  { icon: "n",  name: "Thánh Dực xạ pháp", label: "Hư cấu", keys: guideKeys("n"),
        text: "Chuỗi 6 phát N1–N6, tự nhắm người gần tâm ngắm trong nón ±30°, tầm 25 m; vừa đi vừa bắn được. N6 tỏa 3 tên." },
  C1: { icon: "c1", name: "Tên Phá Khiên", label: "Hư cấu", seq: "C (giữ để ngắm)", text: "Tên nặng phá khiên, xuyên 2 người. Giữ C để kéo căng dây và ngắm chính xác theo tâm màn; thả ra là bắn." },
  C2: { icon: "c2", name: "Đạp Lùi", label: "Hư cấu", seq: "N → C", text: "Đạp hất kẻ áp sát lên không rồi nhảy lùi 3 m giữ tầm." },
  C3: { icon: "c3", name: "Liên Châu Tiễn", label: "Hư cấu", seq: "N N → C (giữ)", text: "Bắn liên thanh 5 tên; giữ C để bắn tiếp, tới 10 tên." },
  C4: { icon: "c4", name: "Mưa Tên Hộ Thân", label: "Hư cấu", seq: "N N N → C", text: "Bắn vút lên trời, tên rơi xuống vòng 5 m quanh mình, đẩy lùi kẻ vây." },
  C5: { icon: "c5", name: "Xuyên Vân Tiễn", label: "Hư cấu", seq: "N N N N → C", text: "Một mũi tên xuyên cả hàng lính dài 30 m. Mở ở cấp 5." },
  C6: { icon: "c6", name: "Vạn Tiễn", label: "Hư cấu", seq: "N N N N N → C", text: "Mưa tên vòng 6 m rơi xuống chỗ ngắm, hất tung tất cả. Mở ở cấp 10." },
  D:  { icon: "dash", name: "Lộn lùi bắn", label: "Hư cấu", seq: "Né → N / C", text: "Vừa né xong bấm N: lộn lùi mà bắn; bấm C: tên nặng xuyên 3 người." },
  DQ: { icon: "dq", name: "Đòn Quyết", seq: "C cạnh kẻ Vỡ Thế", text: "Sĩ quan cạn thanh Phá Thế thì Vỡ Thế: tới gần bấm C để bắn sát mặt — hạ đội trưởng; với tướng Nguyên là bắt sống." },
  CT: { icon: "ct", name: "Phản đòn", seq: "Đỡ đúng lúc", text: "Bấm Đỡ đúng lúc đòn viền đỏ sắp trúng: gạt bằng cánh cung rồi quất trả." },
  skill: { icon: "c5", name: "Tên Xuyên Hàng", label: "Hư cấu", keys: guideKeys("skill", { touch: "nút Xuyên Hàng" }),
           text: "5 mũi tên nặng tầm 30 m, mỗi mũi xuyên 4 người; người thứ 4 trên đường tên bị ghim 1,5 s. Hồi 12 s." },
  skill2: { icon: "giuvung", name: "Chặn Dòng Dụ Địch", label: "Chính sử + Hư cấu", keys: guideKeys("skill2"),
            text: "Thả chuỗi phao chặn 15 m trên sông trong 15 s: thuyền địch không vượt được. Trên đất: hàng cọc chặn, lính địch phải đi vòng. Hồi 35 s." },
  ult: { icon: "ult", name: "Móc Tên Trói Thuyền", label: "Hư cấu", keys: guideKeys("ult"),
         text: "Tốn một vạch Khí Lực: bắn móc dây vào một tướng địch (hoặc thuyền chỉ huy) trong 35 m, kéo lại 10 m, trói 4 s; tướng mất 50% Phá Thế." },
};
