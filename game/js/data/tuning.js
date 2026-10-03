// data/tuning.js — mọi con số của bản thử, gom một chỗ.
//
// Nguồn: GDD "Hào Khí Việt" (Claude Doc), tab Đặc tả prototype (mục 21) và mục 3, 4, 5, 12.
// Mỗi khối ghi mục nguồn. Chỗ nào GDD bỏ ngỏ và bản thử phải tự đặt số thì ghi "ĐỀ XUẤT BẢN THỬ"
// — những số đó chỉnh được, không phải số đã chốt.
//
// File này KHÔNG import gì: sim/ và meta/ chạy được trong Node để kiểm thử.

// ---- Công thức cấp (mục 3.12, mục 12.1) ------------------------------------------------
export const g = (L) => 1 + 0.1 * (L - 1);                 // hệ số Công/Sinh lực/Giáp theo cấp
export const E = (R) => 1 + 0.015 * (R - 1);               // hệ số binh khí kỳ vọng (12.7: E(10)=1,135 … E(50)=1,735)
export const S = (R) => g(R) * E(R);                       // HP bậc có Phá Thế đã nhân sẵn trang bị (11.1)
export const EXP_NEXT = (L) => 50 * L * L + 250;           // 12.1
export const LEVEL_CAP = 35;                               // trần R1

// ---- Sát thương (mục 3.12) --------------------------------------------------------------
// satThuong = Cong * MV * heSoGiap * chiMang * khacChe * doKho * rand(0.95, 1.05)
export const heSoGiap = (giapMucTieu, Lkecong) => 1 - giapMucTieu / (giapMucTieu + 120 * g(Lkecong));
export const CRIT_BASE = 0.05, CRIT_MULT = 1.5, CRIT_CAP = 0.30;
export const BROKEN_MULT = 1.5;        // mục tiêu Vỡ Thế: nhận sát thương ×
export const BROKEN_SEC = 3.5;         // Vỡ Thế kéo dài (s): loạng choạng, rồi thanh Phá Thế đầy lại (units.js)
// Tướng người chơi trong Tổng Phản Công: Công +20% (§6.4) — nhân một lần trong hero.effCong (HAO_KHI.tpc.heroAtk). Trước
// đợt 9 damageTo nhân thêm hằng số TPC_HERO_MULT 1,2 lần nữa (×1,44); hằng số đã bỏ.
// Tướng đánh cổng = Cong × MV × GATE_MULT, bỏ qua giáp. GDD (systems.md "Tướng tự phá") ghi Cong × MV / 3; ĐỀ XUẤT BẢN THỬ
// (2026-10-03, người chơi thử thấy đập cổng 11000 quá lâu, muốn ~30 s): ×4 → 4/3. Đo cấp 1, R1, chém liên tục: chuỗi N ~29 s
// (trước ~117 s), mỗi đòn ~120 (C4 ~390); bot 4 seed: P3 trung vị 112 → 49 s, cả trận 330 → 266 s, P1/P2/P4 không đổi.
export const GATE_MULT = 4 / 3;

// ---- Độ khó (mục 10/§10; thẻ tấn công 21.6) ---------------------------------------------
// tokens: số lính được đánh cùng lúc. dmg: hệ số doKho cho đòn của địch (ĐỀ XUẤT BẢN THỬ).
// reward: hệ số EXP/Tiền (12.1 "Dân binh 0,8 … Truyền Kỳ 2,0"; bậc giữa là ĐỀ XUẤT).
// qc: hệ số Quân công (12.10). revive: số lần Gượng dậy.
// hp / poise / hk (đợt 9, bảng §10 canon): HP địch × (lính, sĩ quan, Toa Đô; không nhân cổng, thuyền), Phá Thế địch ×
// (sĩ quan, Toa Đô — lính thường không có thanh Phá Thế),
// Hào Khí nhận × (nhân nguồn tăng, sau hệ số Trận nhanh). Chưa theo canon: dmg (canon 0,5/1,0/1,6/2,4/3,5), revive
// (canon Tướng quân 0 lần), cửa sổ phản đòn, báo trước viền đỏ, hạn giờ sự kiện, cấp địch R+3 — giữ như bản thử.
export const DIFFICULTY = [
  { id: "danbinh",   name: "Dân binh",   tokens: 2, dmg: 0.7, reward: 0.8,  qc: 0.8, revive: 2, hp: 0.7, poise: 0.7, hk: 1.3 },
  { id: "quansi",    name: "Quân sĩ",    tokens: 3, dmg: 1.0, reward: 1.0,  qc: 1.0, revive: 1, hp: 1.0, poise: 1.0, hk: 1.0 },
  { id: "tuongquan", name: "Tướng quân", tokens: 4, dmg: 1.3, reward: 1.3,  qc: 1.1, revive: 1, hp: 1.3, poise: 1.2, hk: 1.0 },
  { id: "nguyensoai",name: "Nguyên soái",tokens: 6, dmg: 1.6, reward: 1.6,  qc: 1.2, revive: 0, hp: 1.7, poise: 1.4, hk: 0.9 },
  { id: "truyenky",  name: "Truyền Kỳ",  tokens: 8, dmg: 2.0, reward: 2.0,  qc: 1.3, revive: 0, hp: 2.2, poise: 1.6, hk: 0.8 },
];

// ---- Tướng H35 Trần Quốc Toản (21.6) -----------------------------------------------------
export const HERO = {
  id: "H35", name: "Trần Quốc Toản", title: "Hoài Văn hầu", weaponClass: "WC03",
  stats: { cong: 4, thu: 2, toc: 5, tam: 2, thong: 3 },
  cong1: 140, hp1: 1600, giap1: 50,       // cấp 1; nhân g(L)
  move: 6.75,                             // m/s
  atkSpeed: 1.15, wcSpeed: 1.3,           // tốc đánh tướng × hệ số lớp WC03
  aura: 16, auraAtk: 0.06, skMult: 1.2, cmdCd: 0.92, bodyguards: 10,   // Thống Suất 3
  kiLucBars: 2, kiLucPerBar: 100, kiLucRegen: 1.4,                      // nạp khi giao chiến
  revive: { hp: 0.5, invuln: 3 },
  retryHp: 0.5,                           // tải lại checkpoint: Sinh lực ≥ 50% (ĐỀ XUẤT BẢN THỬ, đợt 9)
  phaTran: { cd: 20, dashes: 3, window: 6, len: 18, mv: 1.2, stun: 1 },  // PROTO ghi đè CD 20 s
  tuyetKy: { cost: 100, invuln: 10, hits: 24, mvTotal: 20, qCost: 20, flagR: 20, flagAtk: 0.25, flagDur: 15,
    // ĐỀ XUẤT BẢN THỬ (đợt 9): đòn Tuyệt Kỹ (cả Tuyệt Kỹ Hào Khí) vào sĩ quan / Toa Đô × bigMult (sát thương lẫn Phá Thế),
    // và lấy tối đa bigCap × Sinh lực tối đa của mỗi đơn vị trong bigCapWindow giây kể từ đòn Tuyệt Kỹ đầu tiên trúng nó
    // (hai Tuyệt Kỹ thường liền nhau chung một trần). Tuyệt Kỹ Hào Khí có trần riêng bigCapHK, cửa sổ riêng: trước đây chung
    // trần nên mở Tổng Phản Công bằng Tuyệt Kỹ Hào Khí là chạm 35% ngay, hai Tuyệt Kỹ thường (200 Khí Lực) sau đó 0 máu
    // lên Toa Đô suốt 15 s. Lính thường không đổi (dọn đám đông như cũ).
    // Trước: một Tuyệt Kỹ lấy 52–100% (trung vị ~87%) Sinh lực Phó tướng, 53–57% Toa Đô.
    bigMult: 0.4, bigCap: 0.35, bigCapWindow: 15, bigCapHK: 0.2 },
};

// Sát thương thật một đòn Tuyệt Kỹ gây lên đơn vị lớn u (sĩ quan, Toa Đô): raw × bigMult, cắt theo phần trần còn lại
// trong cửa sổ bigCapWindow. Tuyệt Kỹ thường: trần bigCap, u.ultCapT (lúc mở cửa sổ), u.ultCapDealt (máu đã mất trong cửa
// sổ); Tuyệt Kỹ Hào Khí (hk = true): trần bigCapHK, u.ultCapHKT, u.ultCapHKDealt. Tính cả ×BROKEN_MULT khi u đang Vỡ Thế
// (takeHeroHit nhân sau). Người gọi cộng máu thật đã mất bằng ultBigNote.
export function ultBigDamage(u, raw, clock, hk = false) {
  const T = HERO.tuyetKy, kT = hk ? "ultCapHKT" : "ultCapT", kD = hk ? "ultCapHKDealt" : "ultCapDealt";
  if (!(clock - (u[kT] ?? -1e9) < T.bigCapWindow)) { u[kT] = clock; u[kD] = 0; }
  const room = Math.max(0, (hk ? T.bigCapHK : T.bigCap) * u.maxHp - u[kD]);
  return Math.min(raw * T.bigMult, room / (u.broken > 0 ? BROKEN_MULT : 1));
}
export function ultBigNote(u, lost, hk = false) { u[hk ? "ultCapHKDealt" : "ultCapDealt"] += Math.max(0, lost); }

// ---- Bộ đòn WC03 (21.6: MV sau hệ số 0,7; hit-stop ms) ------------------------------------
// dur: thời lượng ở Tốc đánh ×1,0 (giây) — ĐỀ XUẤT BẢN THỬ, chọn để DPS đơn mục tiêu ≈ 1,6 MV/s
// ở ×1,0 (mục 3). hit: tỉ lệ thời điểm trúng trong clip. shape: hình học trúng đòn.
// C5, C6 là nội dung VS; bản này mở theo cấp tướng (ĐỀ XUẤT BẢN THỬ, xem unlockLv).
export const MOVES = {
  N1: { mv: 0.56, dur: 0.40, hits: [0.45], stop: 33, shape: "cone", range: 3.4, arc: 150, step: 0.6 },
  N2: { mv: 0.56, dur: 0.40, hits: [0.45], stop: 33, shape: "cone", range: 3.4, arc: 150, step: 0.6 },
  N3: { mv: 0.63, dur: 0.42, hits: [0.45], stop: 33, shape: "cone", range: 3.6, arc: 160, step: 0.7 },
  N4: { mv: 0.70, dur: 0.44, hits: [0.5],  stop: 33, shape: "cone", range: 3.6, arc: 170, step: 0.8 },
  N5: { mv: 0.77, dur: 0.46, hits: [0.5],  stop: 33, shape: "cone", range: 3.8, arc: 180, step: 0.9 },
  N6: { mv: 1.12, dur: 0.66, hits: [0.55], stop: 67, shape: "ring", range: 4.2, knock: 5,  step: 1.2 },
  C1: { mv: 1.26, dur: 0.70, hits: [0.5],  stop: 67, shape: "cone", range: 4.0, arc: 120, knock: 6, guardBreak: true, step: 1.5 },
  C2: { mv: 0.84, dur: 0.66, hits: [0.45], stop: 67, shape: "cone", range: 3.8, arc: 140, launch: true, step: 0.5 },
  C3: { mv: 0.35, dur: 1.10, hits: [0.2, 0.35, 0.5, 0.65, 0.8], stop: 17, stopLast: 67, shape: "ring", range: 3.8, step: 0.2 },
  C4: { mv: 2.10, dur: 0.85, hits: [0.55], stop: 67, shape: "ring", range: 5.0, knock: 8, step: 0 },
  C5: { mv: 2.24, dur: 0.80, hits: [0.5],  stop: 67, shape: "line", range: 8.0, width: 2.2, dash: 7, unlockLv: 5 },
  C6: { mv: 3.15, dur: 1.00, hits: [0.6],  stop: 100, shape: "ring", range: 6.0, knock: 10, launch: true, unlockLv: 10 },
  DN: { mv: 0.70, dur: 0.45, hits: [0.4],  stop: 33, shape: "line", range: 5.0, width: 2.0, dash: 4 },   // Lướt N
  DC: { mv: 1.40, dur: 0.60, hits: [0.45], stop: 67, shape: "line", range: 6.0, width: 2.4, dash: 5, knock: 6 }, // Lướt C
  DQ: { mv: 5.60, dur: 0.90, hits: [0.55], stop: 167, shape: "cone", range: 4.5, arc: 120, crit: true, step: 1.0 }, // Đòn Quyết (21.10: tạm 5,6)
  CT: { mv: 1.50, dur: 0.55, hits: [0.35], stop: 100, shape: "cone", range: 4.0, arc: 140, crit: true, poiseMult: 3, step: 0.8 }, // phản đòn
};
// ---- Cảm giác trúng đòn (ĐỀ XUẤT BẢN THỬ, đợt 7) ----------------------------------------------------------
// Hit-stop = stop của đòn × stopMul + stopPerExtra ms mỗi người trúng thêm (trần stopCrowdCap) + stopCrit nếu chí mạng +
// stopKill nếu hạ được ai, trần stopMax. shake: rung màn; kick: giật camera theo hướng chém (m); fov: thu góc nhìn (độ).
// big = Đòn Quyết, phản đòn; heavy = đòn MV ≥ 2 (C4, C5, C6). Xác bị tướng chém văng xa ×killKnock, bay lên killUp m/s
// (đòn nặng killUpHeavy).
export const IMPACT = {
  stopMul: 1.4, stopPerExtra: 6, stopCrowdCap: 30, stopCrit: 25, stopKill: 12, stopMax: 220,
  shake: { light: 0.09, crit: 0.18, heavy: 0.32, big: 0.7 },
  kick: { light: 0.13, heavy: 0.32, big: 0.55 },
  fov: { light: 0.8, crit: 2, heavy: 3.5, big: 6 },
  killKnock: 1.7, killUp: 1.6, killUpHeavy: 4.2,
};
export const POISE_PER_MV = 14;          // Phá Thế gây ra = 14 × MV × poiseMult (21.6: ~26/s ở H35)
export const C_POISE_MULT = 1.5;         // đòn C (§2.4)

// ---- Phòng thủ (21.6, Quân sĩ) ------------------------------------------------------------
export const DEFENSE = {
  dodgeIFrame: 0.25, dodgeChain: 2, dodgeRecover: 0.4, dodgeDist: 4.2, dodgeDur: 0.32,
  parryWindow: 0.15, parryWindowTouch: 0.20, redTelegraph: 0.6, blockArc: 120,
  counterLockout: 0.5,                    // khóa bấm lại khi đỡ hụt (ĐỀ XUẤT BẢN THỬ)
  inputBuffer: 0.15,                      // bộ đệm input 0,15 s (S1.5)
};

// ---- Bậc địch, cấp 1, Quân sĩ (21.6) ------------------------------------------------------
// hp/cong/giap ở R=1 cho giáo binh (rel 1,0). poise = thanh Phá Thế (0 = không có).
// mv/every: đòn thường. red: MV đòn viền đỏ. q: Q trừ khi hạ (21.6 "Tướng người chơi trừ Q").
// ĐỀ XUẤT BẢN THỬ (đợt 9, sau kiểm chứng): HP Phó tướng 1440 → 1584 (+10%; chuỗi N 8,4 → 9,2 s, canon ~10 s). Đo 10 seed
// Quân sĩ: bot hạ Phó tướng 7,2–7,9 s ở 5/10 seed (mục tiêu 8–12). Toa Đô giữ 4200: chuỗi N đơn thuần đã 24,4 s (canon
// 20–25 s); +14% thì 28 s.
export const TIERS = {
  thuong:    { name: "Lính",       hp: 120,  cong: 40,  giap: 20, poise: 0,   mv: 1.0, every: 2.5, red: 0, q: 1,  scale: 1.0 },
  tinhnhue:  { name: "Tinh nhuệ",  hp: 360,  cong: 60,  giap: 30, poise: 0,   mv: 1.2, every: 2.0, red: 0, q: 1,  scale: 1.05 },
  doitruong: { name: "Đội trưởng", hp: 720,  cong: 80,  giap: 40, poise: 100, mv: 1.5, every: 2.0, red: 3, q: 10, scale: 1.2 },
  photuong:  { name: "Phó tướng",  hp: 1584, cong: 120, giap: 60, poise: 300, mv: 1.2, every: 1.6, red: 4, q: 30, scale: 1.3 },
  tuong:     { name: "Tướng",      hp: 4200, cong: 160, giap: 60, poise: 600, mv: 1.2, every: 1.6, red: 4, q: 60, scale: 1.45, ult: 8, ultTelegraph: 1.0 },
};

// ---- Binh chủng (21.5, mục 6, §9) — hệ số tương đối so với giáo binh ----------------------
// rel = [hp, cong, giap, tốc, tầm]; simC = c mô phỏng. counters: khắc được; weakTo: bị khắc.
export const UNITS = {
  GIAO_DV:    { name: "Giáo binh",   side: "ta",   branch: "Giao", rel: [1.0, 1.0, 1.0, 1.0, 1.2], simC: 1.0, counters: ["Ky"], weakTo: ["Tuong"], attack: "melee" },
  KHIEN_NG:   { name: "Khiên binh",  side: "dich", branch: "Khien", rel: [1.3, 0.8, 1.0, 0.9, 1.5], simC: 1.0, counters: ["CungNo"], weakTo: ["Ky", "Tuong"], attack: "melee" },
  CUNGKY_NG:  { name: "Cung kỵ",     side: "dich", branch: "Ky", rel: [1.4, 1.2, 1.3, 1.8, 1.0], simC: 1.4, counters: ["Khien", "CungNo"], weakTo: ["Giao", "Tuong"], attack: "ranged", rangeM: 20 },
};
// ---- Kiểu lính trong một binh chủng (ĐỀ XUẤT BẢN THỬ) ---------------------------------------
// Mô phỏng 1 Hz chỉ biết binh chủng (UNITS). Vùng chiến đấu và lính diễn chia mỗi binh chủng thành
// vài kiểu lính khác vũ khí, để một toán Nguyên có người cầm đao, người cầm thương, người bắn cung
// và vài lực sĩ trọng giáp. w: tỉ lệ trong binh chủng (cộng lại = 1). hp/cong/giap/speed: hệ số nhân
// thêm trên UNITS.rel. reach: tầm chém (m). ranged + range: bắn tên. windup: thời gian báo trước
// đòn (s). heavy: đòn nặng (ngắt được đòn đang ra của tướng, như đòn của Đội trưởng). stable: đòn N
// không đẩy lùi, không hất tung được, chỉ đòn có knock ≥ 5 hoặc hất tung mới làm khựng.
export const KITS = {
  NG_DAO:  { unit: "KHIEN_NG", name: "Đao thuẫn",   w: 0.40, hp: 1.0, cong: 1.0, giap: 1.0, speed: 1.0,  reach: 1.7, windup: 0.45 },
  NG_GIAO: { unit: "KHIEN_NG", name: "Thương binh", w: 0.27, hp: 0.9, cong: 1.1, giap: 0.9, speed: 0.95, reach: 2.5, windup: 0.5 },
  NG_CUNG: { unit: "KHIEN_NG", name: "Cung thủ",    w: 0.20, hp: 0.7, cong: 0.8, giap: 0.7, speed: 1.0,  ranged: true, range: 16, windup: 0.8 },
  NG_TANK: { unit: "KHIEN_NG", name: "Lực sĩ trọng giáp", w: 0.13, hp: 3.0, cong: 1.6, giap: 1.4, speed: 0.72, reach: 2.3, windup: 0.85,
             heavy: true, stable: true, scale: 1.3 },
  // cong 1,0 → 0,6 (đợt 9): mũi tên cung kỵ 28,8 → 17,3 lên H35 cấp 1 (tinh nhuệ 51,8 → 31,1), ngang tên cung thủ bộ
  // (15,4); trước đây cung kỵ gây 57–90% sát thương tướng nhận. Đo: 0,75 → 38–69%, 0,65 → 35–62%, 0,55 → 21–52%.
  NG_KY:   { unit: "CUNGKY_NG", name: "Cung kỵ",    w: 1.00, hp: 1.0, cong: 0.6, giap: 1.0, speed: 1.0,  ranged: true, range: 20, windup: 0.7, mounted: true },
  DV_GIAO: { unit: "GIAO_DV", name: "Giáo binh",    w: 0.50, hp: 1.0, cong: 1.0, giap: 1.0, speed: 1.0,  reach: 2.4, windup: 0.5 },
  DV_DAO:  { unit: "GIAO_DV", name: "Đao khiên",    w: 0.30, hp: 1.15, cong: 0.95, giap: 1.1, speed: 1.0, reach: 1.7, windup: 0.42 },
  DV_NO:   { unit: "GIAO_DV", name: "Nỏ thủ",       w: 0.20, hp: 0.8, cong: 0.9, giap: 0.8, speed: 1.0,  ranged: true, range: 14, windup: 0.9 },
};
// ---- AI lính vùng chiến đấu (ĐỀ XUẤT BẢN THỬ) ------------------------------------------------
// block: tỉ lệ đỡ khiên đòn N trúng trước mặt (đòn C, đòn hất tung luôn phá được), đỡ xong nhận
// blockDmg sát thương, nghỉ blockCd giây mới đỡ lại. evade: tỉ lệ nhảy lùi khi tướng gồng đòn nặng
// (đòn C, đòn vòng). kite: cung thủ lùi khi tướng áp sát dưới kite × tầm bắn. charge: lực sĩ lao
// húc khi tướng cách 5–11 m. rout: vỡ trận — lính quanh sĩ quan vừa chết, quanh Tuyệt Kỹ, hoặc khi
// tướng hạ ≥ rout.kills lính trong rout.window giây gần đó thì bỏ chạy rout.dur giây.
export const AI = {
  block: { NG_DAO: 0.3, DV_DAO: 0.3, NG_GIAO: 0.15 }, blockDmg: 0.25, blockCd: 1.4,
  evade: { thuong: 0.2, tinhnhue: 0.45 }, evadeDist: 2.2,
  kite: 0.4,
  // Thẻ bắn tướng của lính bắn xa = max(1, round(thẻ cận chiến × rangedTok)) — Quân sĩ 1, Tướng quân 1, Nguyên soái 2
  // (trước × 0,67: 2 / 3 / 4). stray: tên nhắm người khác chỉ trúng tướng khi đích của nó đứng trong stray.r m quanh tướng
  // lúc buông tên, và chỉ gây stray.dmg sát thương (trước: mọi tên địch bay qua đều trúng đủ). ĐỀ XUẤT BẢN THỬ (đợt 9).
  rangedTok: 0.34, stray: { r: 3, dmg: 0.5 },
  // ĐỀ XUẤT BẢN THỬ: quân đồn trú bắn cung chỉ đứng bắn / lùi giữ tầm trong vòng Cứ Điểm + kiteLeash m quanh tâm (A2: 13 + 10 m);
  // bị dồn tới mép thì thôi lùi mà bắn trả. Trước đây thả diều không giới hạn: một cung kỵ sót lại giữ Cứ Điểm mãi.
  kiteLeash: 10,
  charge: { minD: 5, maxD: 11, speed: 2.6, dur: 0.9, cd: 8, dmg: 1.25 },   // dmg: hệ số sát thương cú húc, húc trúng thì tướng ngã
  rout: { officerR: 22, ultR: 12, kills: 6, window: 4, nearR: 10, dur: [2.5, 4.5] },
  slotSep: 0.9,        // hệ số giãn góc giữa các lính vây tướng (1 = chia đều vòng tròn)
  // Giáp lá cà giữa lính với lính (đợt 7). Trước đây lính địch trong vùng chiến đấu chỉ nhắm tướng người chơi (97% thời
  // gian, 0 nhát vào quân ta), quân ta đổi mục tiêu mỗi khung theo "người gần nhất" nên chạy qua chạy lại đuổi theo
  // đám địch đang lượn quanh tướng. Giờ mỗi lính giữ một đối thủ: chọn lại mỗi retarget giây, chỉ đổi khi người mới
  // gần hơn switchGain m; tối đa maxOn người đánh một lính (tướng đồng minh maxOnBig). Địch không có thẻ tấn công tướng
  // thì đánh quân ta trong engageR m; bị lính đánh thì quay lại đánh trả. Hai bên đứng giáp mặt (không lượn) mà chém;
  // nhịp chém giữa lính = tier.every × every, sát thương mỗi nhát × dmg[phe] (địch đông gấp rưỡi quân ta trong vùng chiến
// đấu: 30 / 20, nên nhát của địch nhẹ hơn để giáp lá cà không nuốt quân ta quá nhanh); lính có khiên đỡ nhát của lính block.
  duel: { engageR: 7, maxOn: 2, maxOnBig: 4, retarget: [0.6, 1.2], switchGain: 2, every: 0.6, dmg: { ta: 0.8, dich: 0.5 }, block: 0.3, lunge: 0.22,
    leash: 10 },   // leash: quân đồn trú chỉ giáp lá cà trong vòng Cứ Điểm + 10 m; thân binh trong 14 m quanh tướng
};
// Hệ số sát thương lên tướng của một mũi tên địch, quyết lúc buông tên (đợt 9): nhắm tướng 1; nhắm người khác đang đứng
// trong AI.stray.r m quanh tướng → AI.stray.dmg (tên lạc); còn lại 0 — bay qua người tướng cũng không trúng.
export function arrowHeroMult(aimedAtHero, tgtDistToHero) {
  if (aimedAtHero) return 1;
  return tgtDistToHero < AI.stray.r ? AI.stray.dmg : 0;
}
export const KITS_OF =Object.fromEntries(Object.keys(UNITS).map((u) => [u, Object.keys(KITS).filter((k) => KITS[k].unit === u)]));
// Chọn kiểu lính theo một số u ∈ [0,1) (thường là băm của id lính, để không ăn vào chuỗi rng).
export function pickKit(unit, u) {
  let acc = 0;
  for (const k of KITS_OF[unit]) { acc += KITS[k].w; if (u < acc) return k; }
  return KITS_OF[unit][KITS_OF[unit].length - 1];
}

// khắc chế trong mô phỏng: 1,5 nếu i khắc j, 0,75 nếu j khắc i, còn lại 1 (mục 3.12 khacChe)
export function khac(unitA, unitB) {
  const a = UNITS[unitA], b = UNITS[unitB];
  if (a.counters.includes(b.branch)) return 1.5;
  if (b.counters.includes(a.branch)) return 0.75;
  return 1;
}

// ---- Mô phỏng mặt trận (mục 4.2) ---------------------------------------------------------
export const SIM = {
  LOSS_K: 0.0005, REGEN: 0.0002, LINE_V: 0.006,
  // Sĩ Khí → m_SK theo 5 dải (mục 4.3 có 5 dải; hệ số từng dải là ĐỀ XUẤT BẢN THỬ)
  skBands: [[80, 1.2], [60, 1.1], [40, 1.0], [20, 0.85], [0, 0.7]],
  skDrift: 50,              // Sĩ Khí trôi về 50 (mốc Hào Khí 50: về 60)
  skDriftPer10: 1,          // tốc trôi mỗi 10 tick (ĐỀ XUẤT BẢN THỬ)
  collapseQ: 0.15, collapseSK: 10, collapseHold: 15, collapseLine: 0.1,
  enemyReinf: { every: 120, amount: 100, maxWaves: 4 },   // Trận nhanh
  allyReinf: { charges: 2, maxCharges: 4, amount: 300, delay: 20 },
  hqLoseHold: 30,           // tuyến về 0 và giữ 30 s → mất bản doanh
  heroQCap: { perSwing: 3, window: 10, perSec: 1.5 },
};

// ---- Địa hình ảnh hưởng trận: chỗ đất cao thấp, bùn, công sự (ĐỀ XUẤT BẢN THỬ, cả khối) --------------
// Công thức ở sim/terrain-rules.js. slope: tốc chạy theo độ dốc dọc hướng đi (dò mặt đất ±probe m); dốc
// < dead coi như phẳng; lên dốc −up mỗi đơn vị dốc (dốc 1 = 45°), sàn upFloor; xuống dốc +down mỗi đơn vị,
// trần downCap. mud: tốc × (1 − mud · mudAt) trong đáy hố, đáy hào, hào thành. minSpeed: sàn chung (dốc ×
// bùn). Không áp cho Né, lao (Phá Trận), lực sĩ húc, bị đẩy lùi, hất tung, bỏ chạy, Toa Đô rút chạy.
// height: sát thương × theo chênh độ cao chân kẻ đánh − chân mục tiêu Δh: |Δh| ≤ dead thì 1; cao hơn +perM
// mỗi mét vượt dead (trần +cap), thấp hơn −perM mỗi mét (sàn −floor). Kẻ bắn tên đứng cao hơn được tầm
// ×(1 + rangePerM mỗi mét vượt dead), trần +rangeCap. front: mô phỏng 1 Hz — tuyến trong dải trước lũy Nguyên
// [luy + luyBand[0], luy + luyBand[1]] khi doanh trại cánh đó còn trong tay địch: tổn thất Nguyên × luyLoss;
// tuyến bị đẩy về dải ụ đất quân ta [uTa ± uTaBand]: tổn thất quân ta × uTaLoss (vị trí lũy, ụ lấy từ
// data/terrain-b15.js). perch: cung thủ bộ Nguyên tìm gò trong seek m quanh mình, đỉnh gò cách tướng từ minD
// tới reach × tầm bắn, thì lên gò đứng bắn; lùi giữ tầm thì ngả về phía gò. tag: HUD chỉ hiện tag Thế đất
// khi |hệ số − 1| ≥ tag.min; tag Bùn lầy khi mudAt ≥ tag.mud; địch đang giáp mặt trong tag.r m (khóa: 2 × tag.r).
export const TERRAIN = {
  slope: { probe: 0.6, dead: 0.04, up: 0.45, upFloor: 0.6, down: 0.3, downCap: 1.12 },
  mud: 0.4, minSpeed: 0.4,
  height: { dead: 0.4, perM: 0.08, cap: 0.2, floor: 0.15, rangePerM: 0.12, rangeCap: 0.25 },
  front: { luyBand: [-0.04, 0.01], luyLoss: 0.75, uTaBand: 0.03, uTaLoss: 0.8 },
  perch: { seek: 14, minD: 7, reach: 0.9 },
  tag: { min: 0.01, mud: 0.1, r: 7 },
};

// ---- Mệnh Lệnh (21.6) — CD gốc; nhân CD Thống Suất 0,92 ----------------------------------
export const ORDERS = {
  tiencong: { name: "Tiến công", cd: 20, dur: 20, mLenh: 1.15, mThu: 1.1 },
  giuvung:  { name: "Giữ vững",  cd: 20, dur: 20, mLenh: 1.0,  mThu: 0.8, holdLine: true },
  theota:   { name: "Theo ta",   cd: 10, dur: 0,  q: 30, show: 12 },
  tiepvien: { name: "Gọi tiếp viện", cd: 90 },
};

// ---- Hào Khí (mục 5, 21.6) ---------------------------------------------------------------
export const HAO_KHI = {
  milestones: [25, 50, 75, 100],
  decayIdle: 45, decayEvery: 5, decayAmt: 1,
  overflowMax: 30, overflowHold: 90,
  quickMult: 1.3,                         // Trận nhanh nhân nguồn tăng
  tpc: { base: 25, perOverflow: 3, maxExt: 10, intro: 1.5,
         lineAll: 0.05, lineHere: 0.15, flipBaseG: 0.5, enemySK: -20,
         skFloor: 90, skLock: 80, mTPC: 1.4, lineSpeed: 3, heroAtk: 0.2, kiLucRegen: 2,
         freeUlt: { mv: 35, radius: 1.5 }, after: { value: 25, skBonus: 10, skDur: 30 } },
  // nguồn (điểm gốc, 21.6)
  src: { killCaptain: 1, killVice: 2, counterBoss: 1, counterBossMax: 3,
         mainMission: 8, sideMission: 4, reviveUsed: -15,
         skPassive: 1, skPassiveEvery: 20, koMilestone: 1, koMilestoneEvery: 40, koMilestoneCap: 10 },
};

// ---- Trận nhanh (21.2): par 10 phút, thua sau 30 phút --------------------------------------
export const QUICK = { par: 600, timeout: 1800, rewardMult: 0.6, koPar: 400 };
// Chế độ (13.7): Trận nhanh nhân nguồn Hào Khí ×1,3, thưởng ×0,6, cửa sổ Kế Sách ×0,75, bỏ Kế Sách Nhỏ;
// hạn giờ sự kiện ở Trận nhanh đã ×1,2 nên Trận chuẩn chia lại. Par/KO par Trận chuẩn là ĐỀ XUẤT BẢN THỬ.
export const MODES = {
  nhanh: { id: "nhanh", name: "Trận nhanh", par: 600, koPar: 400, timeout: 1800, hkQuick: true, reward: 0.6, eventMult: 1 },
  chuan: { id: "chuan", name: "Trận chuẩn", par: 900, koPar: 600, timeout: 1800, hkQuick: false, reward: 1, eventMult: 1 / 1.2 },
};

// ---- Xếp hạng (mục 2.3) Diem = 35M + 15T + 20Q + 20C + 10K; S ≥ 85, A 70–84, B 50–69 --------
export const RANKS = [
  { id: "S", min: 85, mult: 1.5 }, { id: "A", min: 70, mult: 1.25 },
  { id: "B", min: 50, mult: 1.0 }, { id: "C", min: 0, mult: 0.8 },
];

// ---- Số lính hiển thị (mục 15.5) ---------------------------------------------------------
export const TROOP_LEVELS = [
  { id: "thap", name: "Thấp", N: 100, r: 0.20 },
  { id: "vua",  name: "Vừa",  N: 200, r: 0.35 },
  { id: "cao",  name: "Cao",  N: 400, r: 0.60 },
  { id: "rc",   name: "Rất cao", N: 800, r: 1.00 },
];
// countR: trần vùng chiến đấu chỉ đếm lính trong 45 m quanh tướng (ĐỀ XUẤT BẢN THỬ).
// nearR, forcedMax (đợt 12a, ĐỀ XUẤT BẢN THỬ): lính địch diễn (không trúng đòn) cách tướng dưới nearR m vẫn thành lính thật khi trần
// enemies đã đầy, tối đa forcedMax người "bị ép" cùng lúc, kỵ binh trước (battle/promotion.js; chúng không tính vào trần enemies và không cản quân đồn trú).
// Đo trước đợt 12: trần 30 đầy ~57% trận, cung kỵ diễn đứng sát tướng (38–46% thời gian cung kỵ trong 12 m ở pha 1 là không đánh được). nearR 9 phủ
// tầm đòn xa của tướng (C4 vòng 5 m, C6 6 m + bán kính lính) cộng quãng tướng chạy giữa hai lần xét (0,25 s × 6,75 m/s ≈ 1,7 m); forcedMax 20: bản
// 14 vẫn hết hạn mức ở đầu tuyến pha 1 (tướng đứng giữa khối quân + quân đồn trú: 40 mềm + 14 ép), còn cung kỵ diễn trong 6 m ~4% thời gian. Tổng địch thật
// quanh tướng tăng thêm tối đa 20 người (baseline đã gặp tối đa 54; số lính có thẻ tấn công tướng không đổi).
// forcedKeepR: chỉ lính ép trong chừng này m quanh tướng mới tính vào forcedMax — lính ép đã lùi ra xa (cung kỵ giữ tầm vẫn là lính thật) giữ hạn mức thì lính diễn sát
// tướng không được chuyển thành thật (reviewer đo: 85–95% lính ép giữ chỗ là cung kỵ ở xa; cung kỵ diễn trong 6 m vẫn không đánh được lúc tướng đi xuyên tuyến).
export const ZONE = { radius: 25, enemies: 30, allies: 20, bodyguardsShown: 8, theoTaShown: 12, countR: 45, nearR: 9, forcedMax: 20, forcedKeepR: 14 };

// Quân đồn trú của Cứ Điểm (đợt 12b, ĐỀ XUẤT BẢN THỬ; battle/garrison.js). ringPad: lính đứng trong vòng + 3 m vẫn tính "trong đồn" (director.js sinh
// lính trong vòng + 3 m). hardLeash: dây cứng — lính đồn trú không rời tâm Cứ Điểm quá bán kính vòng + 12 m (dây mềm cũ AI.kiteLeash, AI.duel.leash 10 m
// chỉ lọc chọn đối thủ / cung thủ nhắm tướng nên lính vẫn tản 29–46 m khi sĩ quan trấn thủ ngã), và vỡ trận thì rút về đồn. hintR: thẻ nhiệm vụ hiện
// "còn N · a trong đồn · b ngoài đồn" khi tướng cách Cứ Điểm < 45 m (cùng tầm sinh quân đồn trú), không chỉ lúc đứng trong vòng (ẩn ~48% trận A1).
// pointLast: còn ≤ 6 lính thì bản đồ nhỏ nhấp nháy dấu và mũi tên mép màn hình chỉ con gần nhất (mấy con cuối hay là cung kỵ, đứng ngoài màn hình).
export const GARRISON = { ringPad: 3, hardLeash: 12, hintR: 45, pointLast: 6 };

// "Cửa ngõ" — nguồn viện binh của cánh (đợt 12c, ĐỀ XUẤT BẢN THỬ; battle/supply.js, director.js fillActors). Trước đợt 12 lính ở tuyến địch được bù NGAY tại
// 18 m sau tuyến (57–80% lượt sinh quân rơi trong 30 m quanh tướng) và khối quân thật mọc cách tướng 10–22 m; chiếm doanh trại chỉ giảm nửa hồi quân.
// Giờ, khi cửa ngõ còn của địch, lính bù xuất hiện ở chỗ xuất quân SAU doanh trại (r + behind m sau tâm), rồi hành quân ra tuyến: nhanh hơn đi bộ marchMult
// lần nhưng không quá marchMax m/s (tướng chạy 6,75; cung kỵ đi bộ đã 5,2). minDist: tướng đứng gần chỗ xuất quân hơn chừng này thì chờ — không xuất quân trong tầm nhìn của tướng (tướng đứng giữa doanh
// trại cũng chặn luôn đường viện binh: chỗ xuất quân cách tâm r + behind = 33 m). perTick: số lính xuất tối đa mỗi nhịp 1 s. transitMax: số lính đang trên đường tối đa (ở mức Số lính "Vừa" r 0,35, tỉ lệ theo r) — quân
// đang đi đường không tính vào số lính ở tuyến, để tuyến không mỏng đi vì quãng đường (đo: 1,3 lính/s bị tiêu × ~27 s đường ≈ 35 lính). arrive: cách chỗ đứng
// ≤ arrive m thì coi là đã tới (hết cờ hành quân).
// Số lính hiển thị: canon (systems.md §13.1, quyết định #8) đòi vùng chiến đấu và kết quả KHÔNG đổi theo mức; trước đợt 12 khối quân mọc cạnh tướng (30 địch, Q quyết)
// giữ điều đó, nay vùng chiến đấu lấy địch từ tuyến nên: lineFloor — cánh có tướng giữ ít nhất chừng này lính ở tuyến ở mọi mức (52 = số lính ở tuyến mức Vừa; mức Thấp chỉ có 17 → vùng chiến đấu chỉ
// còn ~17 và cạn ở 1 lính/s; kho 52 không đủ nối quãng hành quân ~35 s ở 1,4 lính/s nhưng bằng mức Vừa); transitMax, perTick không dưới mức Vừa (refR = r của mức Vừa), mức cao hơn thì tăng theo r (kể cả Tổng Phản Công, r × 2). lineGap: nếu tuyến bị
// đẩy vượt cửa ngõ (Tổng Phản Công khi doanh trại còn của địch) thì chỗ xuất quân lùi tới tuyến + lineGap m thay vì mọc sau lưng quân ta.
export const SUPPLY = { behind: 20, minDist: 45, perTick: 4, transitMax: 36, marchMult: 1.6, marchMax: 7, arrive: 6, lineFloor: 52, lineGap: 55, refR: 0.35 };

// Vòng trúng đòn quanh điểm (x, z) của một lính (tướng đánh: hero.js applyHits, hero-skills.js). Bộ binh 0,4 m như trước đợt 12. Kỵ binh
// 1,0 m: thân ngựa kéo từ ~0,8 m sau tới ~1,2 m trước điểm lính (soldiers.js), mà cung kỵ lùi giữ tầm quay mặt về phía tướng nên nhát chém
// ở mép tầm trượt qua mũi ngựa mà không trúng (đo: tướng không Né, không Phá Trận mất ~30 s hạ một cung kỵ đơn lẻ; vòng 1,0 → ~5 s).
export const HIT_R = { foot: 0.4, mounted: 1.0 };
export const hitRadius = (a) => (a && a.K && a.K.mounted ? HIT_R.mounted : HIT_R.foot);
export const hitPad = (a) => hitRadius(a) - HIT_R.foot;     // phần cộng thêm vào tầm so khoảng cách tới điểm lính (0 với bộ binh)
