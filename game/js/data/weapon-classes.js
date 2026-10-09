// data/weapon-classes.js — hệ số lớp vũ khí (systems.md §4.4) cho ba lớp P0 của VS: WC01 Đại kiếm, WC03 Song đao,
// WC14 Đoản đao & lặn. File này KHÔNG import gì (chạy được trong Node để kiểm thử).
//
// mv: hệ số MV (nhân vào bảng MV chuẩn §4.2) · speed: hệ số tốc animation · poise: hệ số Phá Thế · rangeN: tầm N chuẩn
// (m, trước khi cộng phần bù của code và nhân Tầm của tướng). Cận chiến: mv × speed ≈ 1,0 (1,6 MV/s).
// traits: đặc trưng lớp (một dòng ở §4.4); số trong traits là ĐỀ XUẤT BẢN THỬ trừ chỗ ghi nguồn.

export const WEAPON_CLASSES = {
  // Song đao: mỗi 10 đòn trúng liền mạch +4% tốc đánh 6 s, tối đa 3 tầng (đang chạy ở B15, hero.js onLanded)
  WC03: { id: "WC03", name: "Song đao", mv: 0.7, speed: 1.3, poise: 0.7, rangeN: 2.2, hands: 2, grip: "song",
    traits: { lienHoan: { every: 10, pct: 0.04, max: 3 } } },
  // Đại kiếm: giữ C tụ lực 3 cấp (mốc 0,4 s / 0,8 s, tự tung ở 1,2 s; MV ×1 / 1,3 / 1,7 — hoà vốn ở ×1,26 / ×1,53 nên
  // tụ lực được thưởng nhẹ cho rủi ro), siêu giáp khi vung (cửa sổ armor từng đòn, moves-wc01.js), C6 bỏ qua 30% giáp
  // (§4.4 Chính: "C6 phá giáp (bỏ qua 30% giáp)")
  WC01: { id: "WC01", name: "Đại kiếm", mv: 1.35, speed: 0.75, poise: 1.5, rangeN: 3.5, hands: 2, grip: "hai tay",
    traits: { charge: { levels: [0.4, 0.8], auto: 1.2, mult: [1, 1.3, 1.7] }, superArmor: true, armorPenC6: 0.3 } },
  // Đoản đao & lặn: đánh sau lưng ×2 (§2.2); lặn, đục thuyền là kỹ năng (chưa làm ở nền móng)
  WC14: { id: "WC14", name: "Đoản đao & lặn", mv: 0.75, speed: 1.33, poise: 0.8, rangeN: 2.0, hands: 1, grip: "một tay",
    traits: { backstab: 2 } },
};
export const { WC01, WC03, WC14 } = WEAPON_CLASSES;

// Phá Thế gây ra mỗi MV (§2.4: 20 × MV_sau_hệ_số_lớp × hệ số Phá Thế lớp): WC03 = 14 (khớp POISE_PER_MV của B15),
// WC01 = 30 → chuỗi N 1,62 MV/s ≈ 48 Phá Thế/s (§2.4 "Đại kiếm ~48/s").
export const poisePerMv = (cls) => 20 * cls.poise;

// Hệ số MV lúc tung đòn tụ lực theo thời gian giữ C (giây). Lớp không có tụ lực: 1.
export function chargeMult(cls, held) {
  const c = cls.traits?.charge;
  if (!c) return 1;
  let lv = 0;
  for (const t of c.levels) if (held >= t) lv++;
  return c.mult[lv];
}
// Cấp tụ lực 0..2 (để HUD, hiệu ứng tụ lực đổi màu theo cấp).
export function chargeLevel(cls, held) {
  const c = cls.traits?.charge;
  return c ? c.levels.filter((t) => held >= t).length : 0;
}
