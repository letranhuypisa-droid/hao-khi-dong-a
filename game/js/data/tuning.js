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
export const BROKEN_MULT = 1.5;        // mục tiêu Vỡ Thế
export const TPC_HERO_MULT = 1.2;      // tướng người chơi trong Tổng Phản Công
export const GATE_DIV = 3;             // tướng đánh cổng = Cong * MV / 3, bỏ qua giáp

// ---- Độ khó (mục 10/§10; thẻ tấn công 21.6) ---------------------------------------------
// tokens: số lính được đánh cùng lúc. dmg: hệ số doKho cho đòn của địch (ĐỀ XUẤT BẢN THỬ).
// reward: hệ số EXP/Tiền (12.1 "Dân binh 0,8 … Truyền Kỳ 2,0"; bậc giữa là ĐỀ XUẤT).
// qc: hệ số Quân công (12.10). revive: số lần Gượng dậy.
export const DIFFICULTY = [
  { id: "danbinh",   name: "Dân binh",   tokens: 2, dmg: 0.7, reward: 0.8,  qc: 0.8, revive: 2 },
  { id: "quansi",    name: "Quân sĩ",    tokens: 3, dmg: 1.0, reward: 1.0,  qc: 1.0, revive: 1 },
  { id: "tuongquan", name: "Tướng quân", tokens: 4, dmg: 1.3, reward: 1.3,  qc: 1.1, revive: 1 },
  { id: "nguyensoai",name: "Nguyên soái",tokens: 6, dmg: 1.6, reward: 1.6,  qc: 1.2, revive: 0 },
  { id: "truyenky",  name: "Truyền Kỳ",  tokens: 8, dmg: 2.0, reward: 2.0,  qc: 1.3, revive: 0 },
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
  phaTran: { cd: 20, dashes: 3, window: 6, len: 18, mv: 1.2, stun: 1 },  // PROTO ghi đè CD 20 s
  tuyetKy: { cost: 100, invuln: 10, hits: 24, mvTotal: 20, qCost: 20, flagR: 20, flagAtk: 0.25, flagDur: 15 },
};

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
export const TIERS = {
  thuong:    { name: "Lính",       hp: 120,  cong: 40,  giap: 20, poise: 0,   mv: 1.0, every: 2.5, red: 0, q: 1,  scale: 1.0 },
  tinhnhue:  { name: "Tinh nhuệ",  hp: 360,  cong: 60,  giap: 30, poise: 0,   mv: 1.2, every: 2.0, red: 0, q: 1,  scale: 1.05 },
  doitruong: { name: "Đội trưởng", hp: 720,  cong: 80,  giap: 40, poise: 100, mv: 1.5, every: 2.0, red: 3, q: 10, scale: 1.2 },
  photuong:  { name: "Phó tướng",  hp: 1440, cong: 120, giap: 60, poise: 300, mv: 1.2, every: 1.6, red: 4, q: 30, scale: 1.3 },
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
  NG_KY:   { unit: "CUNGKY_NG", name: "Cung kỵ",    w: 1.00, hp: 1.0, cong: 1.0, giap: 1.0, speed: 1.0,  ranged: true, range: 20, windup: 0.7, mounted: true },
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
  charge: { minD: 5, maxD: 11, speed: 2.6, dur: 0.9, cd: 8, dmg: 1.25 },   // dmg: hệ số sát thương cú húc, húc trúng thì tướng ngã
  rout: { officerR: 22, ultR: 12, kills: 6, window: 4, nearR: 10, dur: [2.5, 4.5] },
  slotSep: 0.9,        // hệ số giãn góc giữa các lính vây tướng (1 = chia đều vòng tròn)
};
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
export const ZONE = { radius: 25, enemies: 30, allies: 20, bodyguardsShown: 8, theoTaShown: 12, countR: 45 };   // countR: trần vùng chiến đấu chỉ đếm lính trong 45 m quanh tướng (ĐỀ XUẤT BẢN THỬ)
