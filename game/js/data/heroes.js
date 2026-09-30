// data/heroes.js — danh sách tướng chơi được và công thức quy đổi chỉ số (systems.md §2.1).
// Chỉ import file thuần (tuning.js, moves-wc01.js) nên chạy được trong Node để kiểm thử. Lõi (battle/hero.js) dựng lớp Hero
// theo HEROES[id] (H35 giữ nguyên từng số của B15, H31 dùng WC01); bảng đòn theo MOVESETS, cờ đòn theo moveFlags().
//
// Nguồn: canon (canon-b20.json: H31, H34, H38) cho tên, danh hiệu, chỉ số thang 1–5, kỹ năng; systems.md §2.1 (quy đổi),
// §4.1 (kỹ năng hiệu lệnh toàn quân), §4.5 (Tuyệt Kỹ toàn bản đồ). Số không có trong canon/systems ghi ĐỀ XUẤT BẢN THỬ.

import { HERO, MOVES } from "./tuning.js";
import { MOVES_WC01, CHAIN_N as CHAIN_N_WC01 } from "./moves-wc01.js";

// ---- §2.1 Quy đổi thang 1–5 → số thật (cấp 1; Công/Sinh lực/Giáp nhân g(L) ở progress.js) -----------------------------
//   Cong = 60 + 20s · HP = 1200 + 200s · Giap = 30 + 10s · TocDiChuyen = 5,5 + 0,25s · TocDanh = 0,90 + 0,05s ·
//   Tam = 0,90 + 0,05s · Thống Suất: bán kính 10 + 2s, buff Công 2%·s, hệ số Sĩ Khí 0,9 + 0,1s, CD lệnh 1,04 − 0,04s,
//   thân binh 4 + 2s. Làm tròn 1e-9 cho khỏi lệch số thực (0,9 + 0,05·5 = 1,1500000000000001).
const r9 = (v) => Math.round(v * 1e9) / 1e9;
export function deriveStats(s) {
  const th = s.thong ?? s.thongSuat;
  return {
    cong1: 60 + 20 * s.cong, hp1: 1200 + 200 * s.thu, giap1: 30 + 10 * s.thu,
    move: r9(5.5 + 0.25 * s.toc), atkSpeed: r9(0.9 + 0.05 * s.toc), rangeMul: r9(0.9 + 0.05 * s.tam),
    aura: 10 + 2 * th, auraAtk: r9(0.02 * th), skMult: r9(0.9 + 0.1 * th), cmdCd: r9(1.04 - 0.04 * th), bodyguards: 4 + 2 * th,
  };
}
// Vạch Khí Lực theo cấp (§1: 2 vạch, 3 ở cấp 12, 4 ở cấp 25). steps = [[cấp, số vạch], …] tăng dần.
export const KI_LUC_STEPS = [[1, 2], [12, 3], [25, 4]];
export function kiLucBarsAt(L, steps = KI_LUC_STEPS) {
  let n = steps[0][1];
  for (const [lv, b] of steps) if (L >= lv) n = b;
  return n;
}

// ---- Kỹ năng (theo id; lõi sẽ dựng hero-skills.js theo bảng này) ------------------------------------------------------
export const SKILLS = {
  // H35 (B15, đang chạy trong hero.js — số đọc thẳng từ HERO để không lệch)
  phaTran: { id: "phaTran", name: "Phá Trận", slot: 1, label: "Hư cấu", ...HERO.phaTran },
  bopNat: { id: "bopNat", name: "Bóp Nát Quân Thù", slot: "ult", label: "Chính sử + Hư cấu", ...HERO.tuyetKy },
  // H31 — ô 1: Hịch Tướng Sĩ (Chính sử: Hịch tướng sĩ soạn trước cuộc chiến 1285). Đọc hịch 3 s đứng yên (trạng thái
  // skill), bị ngắt bởi đòn nặng, đòn viền đỏ, đòn hất ngã. Hiệu ứng theo systems §4.1 (kỹ năng hiệu lệnh toàn quân:
  // +15 Sĩ Khí mọi cánh ta, Công quân ta +10% trong 20 s, CD 40 s).
  // MÂU THUẪN CANON: canon H31 ghi CD 90 s, Công +20% và Thủ +20% trong 25 s, Sĩ Khí không giảm trong thời gian đó. Bản
  // thử theo systems.md (luật chung mọi kỹ năng hiệu lệnh, §4.1); canon cần sửa theo — đã báo trong báo cáo đợt 9.
  hichTuongSi: { id: "hichTuongSi", name: "Hịch Tướng Sĩ", slot: 1, label: "Chính sử", channel: 3, interruptBy: ["heavy", "red", "knockdown"],
    siKhi: 15, allyAtk: 0.10, dur: 20, cd: 40, scope: "toànQuân",
    canon: { cd: 90, allyAtk: 0.20, allyDef: 0.20, dur: 25, siKhiLock: true } },
  // ô 2: Binh Thư Yếu Lược (Chính sử: tác phẩm Binh thư yếu lược; cơ chế Hư cấu). Đánh dấu mục tiêu đang khoá, không có
  // thì Cứ Điểm/đơn vị địch gần nhất trong range m (ĐỀ XUẤT BẢN THỬ 30 m); 20 s mọi đòn quân ta lên mục tiêu +40%,
  // đường đi hiện trên minimap, lộ đoàn nghi trang. Tư thế: chỉ gươm (anim-wc01 binhThu, 0,9 s).
  binhThu: { id: "binhThu", name: "Binh Thư Yếu Lược", slot: 2, label: "Chính sử + Hư cấu", mark: 20, dmgPct: 0.40, cd: 35, range: 30,
    targets: ["unit", "base"], castSec: 0.9, revealDecoy: true },
  // Nội tại Quốc Công Tiết Chế: cửa sổ Kế Sách +15%, hiệu ứng mô phỏng của Kế Sách thành công +15% (không thêm Hào Khí)
  // — khớp thẳng mods.ksWindow / mods.ksEffect của progress.js.
  tietChe: { id: "tietChe", name: "Quốc Công Tiết Chế", slot: "passive", label: "Chính sử", ksWindow: 0.15, ksEffect: 0.15 },
  // Tuyệt Kỹ Bạch Đằng Quyết Chiến (Chính sử thế trận 1288 + Hư cấu cơ chế): 12 s bất tử; 3 nhát bổ xuống đất ở 0,9 / 2,0 /
  // 3,2 s, sóng chấn r 15 m, MV 4,5 / 5 / 6,5 (tổng 16 = MV tướng Commander §4.1), nhát 3 phá mọi khiên; thân binh và
  // 20 lính hiển thị xung phong 4 s. Kết thúc (clip ≈ 4,4 s, tư thế cuối chỉ gươm về phía sông): mọi cánh ta chuyển Tiến
  // công (bỏ qua CD), Sĩ Khí +15, trừ 20 Q địch ở mặt trận đang đứng (§4.1). Trong Tổng Phản Công: r 25 m, tổng MV 35
  // (§4.1 Tuyệt Kỹ Hào Khí), thuyền nhẹ hai bờ cùng lao ra (chỉ VFX + spawn).
  // MÂU THUẪN CANON: canon ghi thêm "tốc tuyến mô phỏng +30% trong 20 s" cho mọi cánh; §4.5 cấm Tuyệt Kỹ toàn bản đồ đẩy
  // tuyến ở mặt trận khác → bản thử bỏ phần này (chỉ Sĩ Khí + lệnh Tiến công), canon cần sửa theo.
  bachDang: { id: "bachDang", name: "Bạch Đằng Quyết Chiến", slot: "ult", label: "Chính sử + Hư cấu", cost: 100, invuln: 12, clip: 4.4,
    chops: [{ t: 0.9, mv: 4.5 }, { t: 2.0, mv: 5 }, { t: 3.2, mv: 6.5, breakShields: true }], r: 15, qCost: 20,
    escort: { soldiers: 20, dur: 4 },
    tpc: { r: 25, mvTotal: 35, chops: [{ t: 0.9, mv: 10 }, { t: 2.0, mv: 11 }, { t: 3.2, mv: 14, breakShields: true }], lightBoats: true },
    end: { order: "tiencong", siKhi: 15 }, cinematic: "bespoke-≤6s", scope: "toàn bản đồ",
    canon: { lineSpeed: 0.30, lineSpeedDur: 20 } },
};
// Đặc tính chỉ huy (commandTrait)
export const TRAITS = {
  phuTu: { id: "phuTu", name: "Phụ Tử Chi Binh", label: "Hư cấu", siKhiStart: 20, allyOrderSpeed: 0.3 },
};

// ---- Tướng --------------------------------------------------------------------------------------------------------
// cls: lớp vũ khí (weapon-classes.js) · rig: khoá RIGS (models.js) · anim: khoá ANIMS (hero-anim.js) · moves: bảng đòn.
// Số cấp 1 (cong1, hp1, giap1, move, atkSpeed, aura, auraAtk, skMult, cmdCd, bodyguards) = deriveStats(stats); H35 lấy
// thẳng HERO của tuning.js (B15 đang chạy, phải giữ nguyên từng số — tests/wc01.test.mjs so deriveStats với HERO).
export const HEROES = {
  H35: { ...HERO, id: "H35", cls: "WC03", rig: "hero", anim: "WC03", moves: "WC03", portrait: "H35",
    skills: { sk1: "phaTran", ult: "bopNat" }, flag: { text: "破強敵報皇恩", label: "Chính sử" }, weaponName: "Song đao", weaponLabel: "Hư cấu" },
  H31: {
    id: "H31", name: "Trần Hưng Đạo", title: "Hưng Đạo Đại Vương · Quốc công Tiết chế", cls: "WC01", weaponClass: "WC01",
    rig: "H31", anim: "WC01", moves: "WC01", portrait: "H31",
    stats: { cong: 5, thu: 4, toc: 2, tam: 3, thong: 5 },                   // canon (tổng 19: Commander/Heavy, §2.1 L8)
    cong1: 160, hp1: 2000, giap1: 70, move: 6.0, atkSpeed: 1.0, rangeMul: 1.05,
    aura: 20, auraAtk: 0.10, skMult: 1.4, cmdCd: 0.84, bodyguards: 14,
    // Khí Lực: 4 vạch ở cấp 25 (bản VS đặt sẵn cấp 25 cho B20, systems §12); 2 → 3 ở cấp 12 → 4 ở cấp 25 (§1)
    kiLucBars: 4, kiLucSteps: KI_LUC_STEPS, kiLucPerBar: HERO.kiLucPerBar, kiLucRegen: HERO.kiLucRegen,
    vsLevel: 25,                                  // cấp đặt sẵn khi trận không cho preset (vd ?debug&hero=H31 ở B15) — progress.heroStats
    revive: { ...HERO.revive },
    skills: { sk1: "hichTuongSi", sk2: "binhThu", passive: "tietChe", ult: "bachDang" }, trait: "phuTu",
    flag: null,                                   // không cờ sau lưng; áo choàng son thay cờ (RIGS.H31)
    weaponName: "Gươm Tiết chế", weaponLabel: "Hư cấu",   // canon: thanh gươm cụ thể không có trong chính sử
    quote: { text: "Bệ hạ chém đầu tôi trước rồi hãy hàng.", label: "Chính sử" },
  },
  // Chưa làm (wip): chỉ chỉ số canon + lớp để màn chọn tướng liệt kê; kỹ năng, rig, hoạt ảnh riêng làm ở đợt sau.
  H34: { id: "H34", name: "Trần Khánh Dư", title: "Nhân Huệ vương · Phó tướng quân Vân Đồn", cls: "WC01", weaponClass: "WC01", wip: true,
    stats: { cong: 4, thu: 3, toc: 3, tam: 2, thong: 3 }, anim: "WC01", moves: "WC01", portrait: "H34",
    skills: { sk1: "khoiThan", sk2: "ducMan", passive: "layCong", ult: "vanDon" }, weaponName: "Đại kiếm Vân Đồn", weaponLabel: "Hư cấu" },
  H38: { id: "H38", name: "Yết Kiêu", title: "Gia tướng của Hưng Đạo vương", cls: "WC14", weaponClass: "WC14", wip: true,
    stats: { cong: 3, thu: 2, toc: 5, tam: 3, thong: 2 }, portrait: "H38",
    skills: { sk1: "lan", sk2: "ducThuyen", passive: "giuThuyen", ult: "dayNut" }, weaponName: "Dùi đục Sông Quát", weaponLabel: "Tương truyền" },
};
// Tướng wip: số cấp 1 suy từ thang (chưa tinh chỉnh riêng).
for (const id of ["H34", "H38"]) HEROES[id] = { ...deriveStats(HEROES[id].stats), ...HEROES[id] };

// ---- Bảng đòn theo lớp, cờ đòn -------------------------------------------------------------------------------------------
// WC03 = MOVES của tuning.js (cùng một đối tượng: B15 và các kiểm thử cũ đọc thẳng MOVES), WC01 = moves-wc01.js.
export const MOVESETS = { WC03: MOVES, WC01: MOVES_WC01 };
export const CHAINS = { WC03: ["N1", "N2", "N3", "N4", "N5", "N6"], WC01: CHAIN_N_WC01 };
export const movesetOf = (def) => MOVESETS[def.moves || def.cls || "WC03"];

// Cờ của một đòn cho lõi (hero.js), crowd.js (lính né đòn nặng), HUD. Bảng đòn ghi cờ tường minh (moves-wc01.js) thì dùng
// cờ đó; không ghi (MOVES của WC03) thì suy ĐÚNG như luật cũ theo tên đòn / MV của hero.js trước đợt 9 — H35 phải giống
// hệt từng nhánh (kiểm ở tests/hero-def.test.mjs):
//   heavy      MV ≥ 2 hoặc Đòn Quyết                 · heavyTell  N6, C1–C6, Lướt C, Đòn Quyết (HEAVY_MOVES cũ của crowd.js)
//   whooshHeavy MV > 2, N6, đòn C (kể cả phản đòn), Lướt C · kiai  C1–C6, Đòn Quyết, N6 (xác suất 0,4; Đòn Quyết 1)
//   slam       C1, C4, C6, Đòn Quyết (bụi ở nhát cuối) · slamSound  như slam trừ C1 (bảng WC01: mọi đòn slam đều chấn)
//   ringFx     đòn vòng và (nặng hoặc N6)            · endsChain  N6 · chainN  đòn N nối tiếp được (N và không kết chuỗi)
//   resetChain đòn C (kể cả phản đòn), Đòn Quyết     · isC  đòn C, Lướt C (Phá Thế ×1,5, choáng khắc C) · finisher  Đòn Quyết
//   big        Đòn Quyết, phản đòn (rung, chớp lớn)
//   armor [u0,u1] cửa sổ siêu giáp · charge, chargeU tụ lực · armorPen bỏ qua giáp · hold C3 giữ để kéo dài (chỉ WC01)
export function moveFlags(key, m) {
  const C = key[0] === "C", heavy = m.heavy ?? (m.mv >= 2 || key === "DQ");
  const slam = m.slam ?? (key === "C1" || key === "C4" || key === "C6" || key === "DQ");
  const endsChain = m.endsChain ?? key === "N6";
  return {
    heavy, slam, endsChain,
    heavyTell: m.heavyTell ?? (key === "N6" || (C && key !== "CT") || key === "DC" || key === "DQ"),
    whooshHeavy: m.whooshHeavy ?? (m.mv > 2 || key === "N6" || C || key === "DC"),
    kiai: m.kiai ?? ((C && key !== "CT") || key === "DQ" || key === "N6"), kiaiP: key === "DQ" ? 1 : 0.4,
    slamSound: m.slam !== undefined ? slam : slam && key !== "C1",
    ringFx: m.ringFx ?? (m.shape === "ring" && (heavy || key === "N6")),
    chainN: key[0] === "N" && !endsChain, resetChain: C || key === "DQ", isC: C || key === "DC",
    finisher: key === "DQ", big: key === "DQ" || key === "CT", mirrorArc: m.mirrorArc ?? false,
    armor: m.armor || null, charge: !!m.charge, chargeU: m.chargeU ?? 0.3, armorPen: m.armorPen || 0, hold: m.hold || null,
  };
}
