// data/battle-b20.js — B20 Bạch Đằng (9/4/1288), bản thử đợt 9. Cùng lối với battle-b15.js.
//
// Bố cục khúc sông là Hư cấu, nén từ ~2 km hạ lưu (canon mapNotes) còn 1,2 km cho vừa Trận nhanh. Hình học
// (tâm dòng, bề rộng, bãi cạn, nhánh sông, mốc cọc) lấy từ data/river-b20.js — nguồn duy nhất, ở đây chỉ gom lại
// và thêm số luật chơi. Trục: x 0 thượng lưu (tây) → x 1200 cửa sông (đông); z âm = bờ bắc. Đơn vị mét.
// Nguồn số: canon B20 (canon-b20.json), systems.md §5.8, §7; số không có nguồn là ĐỀ XUẤT BẢN THỬ.

import { TIDE as TIDE_GEOM, TIDE_Y, zc, hw, RIVER as RIVER_GEOM, STAKE_FIELDS, bankPoint, midPoint } from "./river-b20.js";

export { TIDE_Y, zc, hw, bankPoint, midPoint };

// ---- Bản đồ -----------------------------------------------------------------------------------
const hqZ = Math.round(zc(600) - 125);
export const MAP = {
  w: 1520, h: 600, minX: -200, maxX: 1320, minZ: -300, maxZ: 300,
  clamp: { x0: -60, x1: 1240, z0: -240, z1: 240 },            // vùng người chơi đi được
  khucCoc: RIVER_GEOM.khucCoc, exitX: RIVER_GEOM.exitX,
  // Bản doanh Hưng Đạo vương trên gò cao bờ bắc (canon mapNotes: "bản doanh bờ bắc"). r: vòng Cứ Điểm (ĐỀ XUẤT BẢN THỬ).
  hq: { x: 600, z: hqZ, r: 16 },
  // Bến phục binh (canon: 2 bến; chủ "ta" là ĐỀ XUẤT BẢN THỬ — nút đò chuyển và điểm xuất thuyền). Mép nước + 6 m.
  piers: [
    { id: "P_N", name: "Bến phục binh bờ bắc", owner: "ta", side: -1, ...bankPoint(400, -1, 6) },
    { id: "P_S", name: "Bến phục binh bờ nam", owner: "ta", side: 1, ...bankPoint(700, 1, 6) },
  ],
  // Tháp canh (canon: 2 tháp canh bờ). Đợt này chỉ là cảnh; đứng trên dải bờ phẳng, cách mép dòng 30 m.
  towers: [
    { id: "T_N", name: "Tháp canh bờ bắc", side: -1, ...bankPoint(300, -1, 30) },
    { id: "T_S", name: "Tháp canh bờ nam", side: 1, ...bankPoint(900, 1, 30) },
  ],
  // Điểm mốc trên sông (Hư cấu, ĐỀ XUẤT BẢN THỬ)
  fleetHead: midPoint(40), fleetTailX: -180,                   // đầu hạm đội lúc mở màn; đuôi kéo ra ngoài bản đồ
  challenge: { x0: 75, x1: 110, x: 90, z: zc(90) },            // điểm khiêu chiến: đoàn thuyền nhẹ ta xuất phát
  khoaiBoom: { x: 840, z: zc(840), len: 15 },                  // Nguyễn Khoái chặn luồng ở pha 2 (phao gỗ + dây)
  exit: midPoint(RIVER_GEOM.exitX),                            // cửa sông: lối thoát của hạm đội Nguyên
};

// ---- Sông -------------------------------------------------------------------------------------
// Gộp hình học river-b20.js (reach, bedDeep, bedShoal, tribs…) cùng hai hàm zc/hw. Không chép lại công thức.
export const RIVER = { ...RIVER_GEOM, zc, hw };

// ---- Con nước (systems §5.8, §7; canon pha 1–4) -------------------------------------------------
// Mặt nước y = TIDE_Y(pct). p1: 85 → 100 trong cửa sổ pha 1 (canon). p2Floor: pha 2 rút chậm, sàn 55
// (ĐỀ XUẤT BẢN THỬ, theo R-spec). p3: giữ ≥ 55, Kế Sách cọc xong thì 10 s về 50 (canon: pha 4 bắt đầu ở 50%).
// p4Sec: 50 → 0; canon 180 s (Trận chuẩn), Trận nhanh ×0,75 = 135 s. strandAt: dưới 30% cọc nhô, thuyền mắc
// (ĐỀ XUẤT BẢN THỬ). warn: báo trước 30 s (canon). p2Sec: hạn pha 2 (R-spec: ≤ 240 / ≤ 180 s, ĐỀ XUẤT BẢN THỬ).
export const TIDE = {
  ...TIDE_GEOM, strandAt: 30, warn: 30,
  p1: { from: 85, to: 100 }, p2Floor: 55, p3HoldTo: 50, p3DropSec: 10,
  p2Sec: { nhanh: 180, chuan: 240 },
  p4Sec: { nhanh: 135, chuan: 180 },
};

// ---- Mốc cọc (canon: 3 mốc, bè cỏ ngụy trang neo dây; Tương tác 5 s — systems §7 hàng Cọc) -----------
// z trên tâm dòng. along × across: khuôn bãi cọc. raft: bè cỏ (m). exposeSec: tướng địch đứng ở mốc quá 10 s
// thì mốc lộ (canon X24 "Trinh Sát Lòng Sông").
export const STAKES = STAKE_FIELDS.map((f) => ({
  ...f, z: zc(f.x), raft: { w: 10, d: 6 }, interact: 5, exposeSec: 10,
}));

// ---- Hạm đội Nguyên (systems §5.8; canon specialMechanic) -------------------------------------------
// shipsShown: số thuyền lớn hiển thị theo mức đồ họa (canon). qPerShip, shipHp (× S(R)): systems §5.8.
// escorts: 6 ở pha 2 (canon X24) + 8 đợt hai ở pha 4 (ĐỀ XUẤT BẢN THỬ, GDD). scoutEvery: canon X24 (giữ 40 s cả
// Trận nhanh — là cơ chế boss). p1Speed: đầu hạm đội đi ~400 m trong ~90 s (ĐỀ XUẤT BẢN THỬ). stopX: đầu hạm đội
// dừng ở pha 2 trước phao Nguyễn Khoái (ĐỀ XUẤT BẢN THỬ). cmdShips: kỳ hạm Ô Mã Nhi + thuyền chỉ huy Phàn Tiếp.
export const FLEET = {
  shipsShown: { thap: 24, vua: 40, cao: 60 }, qPerShip: 40, shipHp: 5000, escorts: [6, 8], scoutEvery: 40,
  scoutFirst: 15,                                   // giây đầu pha 2 tới thuyền dò đầu tiên (ĐỀ XUẤT BẢN THỬ)
  scoutWarn: 5,                                     // "Tình báo sớm" (Quyết sách đúng): báo trước 5 s (ĐỀ XUẤT BẢN THỬ)
  p1Speed: 4.4, stopX: 800, cmdShips: 2,
  formation: { across: 3, spacing: 34 },
  composition: { flagship: 1, command: 1 /* Phàn Tiếp */, escort: 6, junk: 16 },
  // Kéo của mồi nhử (ĐỀ XUẤT BẢN THỬ): khoảng cách trong dải → tốc × (base + kk · Khiêu khích/100);
  // xa quá dải → tốc × lost (hạm đội chần chừ).
  pull: { base: 0.8, kk: 0.5, lost: 0.45 },
  strandSkPerSec: 1,                               // mắc cạn: quân trên thuyền mất 1 Sĩ Khí/s (systems §5.8)
};

// ---- Thuyền nhẹ ta (systems §5.8: 8 m/s, chở tướng + 10) -------------------------------------------
// gap: dải khoảng cách với thuyền dẫn đầu (canon 15–40 m). lossMax: mất tối đa 2/8 (canon ≤ 30%).
// Mô hình pha 1 (ĐỀ XUẤT BẢN THỬ): mỗi thế đứng có khoảng cách đích; đoàn đổi tốc tương đối ≤ approach m/s để về
// đích. Sát quá gap.min thì cứ lossEvery s mất 1 thuyền. Khiêu chiến trong provokeR m nạp Khiêu khích arrows/s;
// xa quá gap.max thì Khiêu khích tụt decay/s.
export const LIGHT_BOATS = {
  n: 8, speed: 8, carry: 10, gap: { min: 15, max: 40 }, lossMax: 2,
  stance: { tiencong: 16, giuvung: 28, theota: 46 }, approach: 3, back: 2,
  lossEvery: 4, provokeR: 25, arrows: 1.5, decay: 1,
};

// ---- Áp mạn, lên boong (systems §5.8; canon B19) --------------------------------------------------
export const BOARD = { range: 4, hold: 1, climb: 0.8, capture: 3, ferrySec: [5, 8] };

// ---- Pha (canon phases). par: phút, Trận nhanh (tổng ≈ par 13, ĐỀ XUẤT BẢN THỬ) --------------------
export const PHASES = [
  { id: "P1", name: "Dụ địch lúc triều lên", goal: "Khiêu chiến đầu hạm đội, giữ cách 15–40 m, lui qua mốc Khúc cọc", par: 1.5,
    tip: "Ra lệnh cho 8 thuyền nhẹ: Tiến công để khiêu chiến, Giữ vững để giữ khoảng cách, Theo ta để lui nhanh. Sát quá 15 m là mất thuyền." },
  { id: "P2", name: "Đánh hộ vệ hạm đội", goal: "Hạ 4 trong 6 thuyền hộ vệ của Phàn Tiếp", par: 2.5,
    tip: "Áp mạn, hạ trấn thủ rồi giữ Tương tác 3 s để chiếm thuyền. Chặn thuyền dò luồng trước khi nó chạm mốc cọc." },
  { id: "P3", name: "Kích hoạt bãi cọc", goal: "Mở bãi cọc ở ít nhất 2 trong 3 mốc", par: 1.5,
    tip: "Dẹp đội dò luồng: không để tướng địch đứng ở mốc quá 10 s. Giữ Tương tác 5 s ở mốc để chặt dây bè cỏ." },
  { id: "P4", name: "Thủy triều rút", goal: "Giữ hạm đội trong vùng cọc tới khi nước ròng", par: 2.25,
    tip: "Ra lệnh Giữ vững cho thủy quân ở cửa các nhánh sông. Mỗi thuyền hộ vệ bị hạ kéo thanh Thoát vây xuống 15." },
  { id: "P5", name: "Chiến thuyền mắc cạn", goal: "Lên boong, bắt sống Phàn Tiếp", par: 2.5,
    tip: "Thuyền phục từ sông Chanh, sông Rút, sông Giá lao ra. Dùng đò chuyển để lên boong thuyền Nguyên đã mắc cọc." },
  { id: "P6", name: "Bạch Đằng Quyết Chiến", goal: "Lên kỳ hạm, bắt sống Ô Mã Nhi", par: 2.5,
    tip: "Hào Khí đầy: kích Tổng Phản Công. Phá cầu thang lên lầu chỉ huy của kỳ hạm." },
];

// Nhiệm vụ phụ (canon objectives.secondary)
export const SIDE_MISSIONS = [
  { id: "S_SCOUT", name: "Hạ thuyền và đội dò luồng trước khi tới mốc cọc" },
  { id: "S_STAKES3", name: "Kích hoạt đủ 3/3 mốc cọc" },
  { id: "S_X24", name: "Bắt sống Phàn Tiếp" },
  { id: "S_NOEXIT", name: "Không để thuyền nào ra tới cửa sông" },
];

// ---- Kế Sách B20 (canon keSach; systems §7). B20 là trận duy nhất có 3 Kế Sách Lớn. ------------------
// Máy trạng thái (sim/river.js): khoa → khadung → sansang → thanhcong | thatbai. Không hồi chiêu, không thử lại
// (con nước không chờ ai). Khung Hào Khí gốc Lớn +20; thưởng lẻ cộng dồn không vượt khung, giữ khi thất bại.
// window: đã tính ×0,75 cho Trận nhanh (canon 120 s). Nội Bàng (Nhỏ, chỉ Trận chuẩn) chưa làm ở đợt này.
export const KE_SACH = {
  nghiBinh: {
    id: "nghiBinh", name: "Nghi binh lúc triều lên", quyMo: "lon", hk: 20, label: "Chính sử", modes: ["nhanh", "chuan"],
    phase: 0, window: { nhanh: 90, chuan: 120 },
    text: "Khiêu chiến đầu hạm đội cho đầy thanh Khiêu khích, rồi lui qua mốc Khúc cọc, giữ cách 15–40 m, mất không quá 2/8 thuyền nhẹ.",
    lore: "Thuyền nhẹ quân Trần khiêu chiến lúc triều lên rồi giả thua, dụ hạm đội Nguyên vào khúc sông đã đóng cọc.",
    // Khiêu khích (systems §7 hàng Nghi binh): +2 mỗi KO tiên phong, +15 mỗi sĩ quan bị phá thế; đầy 100.
    provoke: { ko: 2, officer: 15, max: 100 },
    partial: { baited: 5 },                          // thưởng lẻ khi đầy Khiêu khích (ĐỀ XUẤT BẢN THỬ)
    // Thành công (canon): ≥ 70% hạm đội vào khúc cọc; Ô Mã Nhi mất "Theo Con Nước" 30 s. Thất bại: hạm đội vẫn tới,
    // chỉ ~50% vào vùng (ĐỀ XUẤT BẢN THỬ, R-spec).
    effect: { reachShare: 0.8, failShare: 0.5, x20NoTide: 30 },
  },
  kichCoc: {
    id: "kichCoc", name: "Kích hoạt bãi cọc", quyMo: "lon", hk: 20, label: "Chính sử", modes: ["nhanh", "chuan"],
    phase: 2, window: { nhanh: 90, chuan: 120 }, need: 2,
    text: "Dẹp đội dò luồng, giữ Tương tác 5 s ở từng mốc cọc để chặt dây bè cỏ. Đủ 2 mốc thì bấm Lệnh Kế Sách (hoặc mở nốt mốc thứ ba).",
    lore: "Hưng Đạo vương cho đóng cọc gỗ lớn vạt nhọn dưới lòng sông từ trước, ngụy trang để lúc triều lên cọc chìm khuất.",
    labelAction: "Hư cấu",                           // thao tác "Mở bãi cọc" (chặt dây bè cỏ) là Hư cấu (canon caveats)
    // need: ≥ 2/3 mốc (GDD; 3/3 là nhiệm vụ phụ). Tương tác 5 s (systems §7; canon keSach.how ghi 3 s — lệch, theo §7).
    partial: { perMarker: 5 },                       // thưởng lẻ mỗi mốc mở được (ĐỀ XUẤT BẢN THỬ)
    // Canon: mỗi mốc giữ 1/3 hạm đội ở pha 4; nước ròng thì thuyền trong vùng bất động, thủy binh địch c ×0,3.
    effect: { holdPerMarker: 1 / 3, navalC: 0.3 },
  },
  conNuoc: {
    id: "conNuoc", name: "Con nước", quyMo: "lon", hk: 20, label: "Chính sử", modes: ["nhanh", "chuan"],
    phase: 3, window: null,                          // theo đồng hồ Con nước (TIDE.p4Sec), không phải cửa sổ
    text: "Giữ hạm đội trong vùng cọc tới khi nước ròng: thanh Thoát vây không được chạm 100.",
    lore: "Triều rút, thuyền Nguyên mắc cọc, nghiêng, không di chuyển; quân Trần đánh từ nhiều phía.",
    // Thành công = Thoát vây < 100 lúc Con nước về 0 VÀ ≥ 2 mốc cọc đã kích hoạt (canon "giữ ≥ 60% hạm đội trong
    // vùng cọc": 2 mốc × 1/3 ≈ 67%; R-spec). Thưởng lẻ khi cọc nhô (30%) mà thanh chưa đầy (ĐỀ XUẤT BẢN THỬ).
    need: 2, partial: { stakesUp: 5 },
  },
};
export const KS_ORDER = ["nghiBinh", "kichCoc", "conNuoc"];

// ---- Thoát vây (systems §7 hàng Thủy triều; canon pha 4) ---------------------------------------------
// +0,5/s mỗi thuyền chỉ huy còn hoạt động; −15 mỗi thuyền hộ vệ bị hạ (canon: đục chìm/đốt; R-spec: chiếm
// cũng tính). Chạm 100 = Kế Sách Con nước hỏng, không thua trận. holdMult/holdSec: thủy quân ta Giữ vững ở cửa
// nhánh sông làm chậm thanh (ĐỀ XUẤT BẢN THỬ).
export const ESCAPE = { perCmdShip: 0.5, perEscortDown: 15, max: 100, holdMult: 0.7, holdSec: 25 };

// ---- Boss (canon enemies X20, X24; systems §5.8, §8) ------------------------------------------------
export const BOSSES = {
  X20: {
    id: "X20", name: "Ô Mã Nhi", nameHan: "烏馬兒", tier: "daituong", defeatMeans: "bị bắt", label: "Chính sử",
    weaponClass: "EWC02", hp: 12000, poise: 1000, poisePhases: 2,        // Đại tướng (systems §8; × S(R))
    hpLockPct: 10,                                                        // lầu chỉ huy: Sinh lực khóa ở 10% → Đòn Quyết "Bắt sống"
    hook: { every: 25, soldiers: 20, cut: 2 },                            // Móc Câu Áp Mạn
    theoConNuocAt: 50,                                                    // Theo Con Nước: > 50% tiến, < 50% quay ra biển
    intro: "Ô Mã Nhi, vạn hộ thủy quân nhà Nguyên, chỉ huy chiến thuyền rút theo sông Bạch Đằng ra biển.",
    mechanics: [
      { name: "Kỳ Hạm Hai Tầng", text: "Đánh trên kỳ hạm mắc cạn: boong dưới rồi lầu chỉ huy; lên lầu phải phá cầu thang có lính giữ." },
      { name: "Móc Câu Áp Mạn", text: "Cứ 25 s thả móc kéo 1 thuyền nhỏ của ta áp mạn, 20 lính địch tràn sang; Tương tác 2 s để cắt móc." },
      { name: "Theo Con Nước", text: "Con nước trên 50% thì hạm đội tiến; dưới 50% thì quay mũi ra biển và né các mốc cọc đã lộ." },
      { name: "Pha cuối", text: "Kỳ hạm mắc cạn thì hết tiếp viện; Phá Thế về 0 ở lầu chỉ huy thì bị bắt sống." },
    ],
    // Bắt sống: đứng thẳng, gươm đặt dưới chân, giáo hạ quanh; không trói, không quỳ (systems §8; comic K2).
    dignity: "Thủy tướng lão luyện, liều lĩnh; bị bắt vẫn đứng thẳng trên boong.",
  },
  X24: {
    id: "X24", name: "Phàn Tiếp", nameHan: "樊楫", tier: "tuong", defeatMeans: "bị bắt", label: "Chính sử",
    weaponClass: "EWC02", hp: 4200, poise: 600,
    chainAtPct: 50, chainShips: 3,                                        // Liên Hoàn Thuyền
    scoutEvery: 40, exposeSec: 10,                                        // Trinh Sát Lòng Sông
    intro: "Phàn Tiếp, tướng thủy quân nhà Nguyên, chỉ huy các thuyền hộ vệ quanh kỳ hạm.",
    mechanics: [
      { name: "Hộ Vệ Hạm Đội", text: "Chỉ huy 6 thuyền hộ vệ quanh kỳ hạm; còn thuyền hộ vệ thì kỳ hạm không thể bị áp mạn." },
      { name: "Trinh Sát Lòng Sông", text: "Cứ 40 s cử 1 thuyền nhỏ và 1 đội đổ bộ dò luồng; đội dò chạm mốc cọc chưa kích hoạt, hoặc tướng địch đứng ở mốc quá 10 s, thì mốc lộ và hạm đội né mốc ấy." },
      { name: "Liên Hoàn Thuyền", text: "Dưới 50% Sinh lực, xích 3 thuyền làm bệ đứng vững; bệ không lắc khi triều rút nhưng mắc cạn chung." },
    ],
    line: { text: "Nước này quá lặng.", label: "Hư cấu" },
    dignity: "Tướng cẩn trọng, sớm nghi ngờ lòng sông; bị bắt vẫn trong tư thế chỉ huy.",
  },
};

// ---- Tướng đồng minh AI -------------------------------------------------------------------------
export const ALLY_GENERALS = {
  H40: {
    id: "H40", name: "Nguyễn Khoái", title: "Liệt hầu, tướng quân Thánh Dực", weapon: "cung", hp: 2400, color: 0x4a5a2a,
    // Pha 2 chặn luồng ở x 840 (vai chặn luồng: GDD ghi Hư cấu; canon ghi "theo tài liệu hiện đại" — theo Hư cấu).
    post: { phase: 1, ...MAP.khoaiBoom }, label: "Hư cấu",
    skill: { name: "Chặn Dòng Dụ Địch", len: 15, dur: 15, cd: 35 },
    passive: { strandR: 30, kiLucPerShip: 1 },
  },
};

// ---- Cánh thủy quân ta (mô phỏng sim/river.js) -------------------------------------------------------
// q: quân mô phỏng; boats: số thuyền. Ba cánh phục ở cửa nhánh sông (canon mapNotes) — 3 × 4 thuyền là
// ĐỀ XUẤT BẢN THỬ; mỗi nhánh giấu 4 thuyền phục 60–120 m trong nhánh, xuất kích ở pha 5.
export const WINGS = {
  flotilla: { id: "flotilla", name: "Thuyền nhẹ khiêu chiến", boats: 8, q: 80, trib: null },
  chanh: { id: "chanh", name: "Thuyền phục sông Chanh", boats: 4, q: 60, trib: "chanh", mouthX: 430, side: -1 },
  rut:   { id: "rut",   name: "Thuyền phục sông Rút",   boats: 4, q: 60, trib: "rut",   mouthX: 620, side: 1 },
  gia:   { id: "gia",   name: "Thuyền phục sông Giá",   boats: 4, q: 60, trib: "gia",   mouthX: 820, side: -1 },
};
export const WING_SK = 50;                          // Sĩ Khí gốc; Phụ Tử Chi Binh (H31) +20 lúc mở màn qua mods.wingSk

// Mệnh Lệnh ở B20 (ý nghĩa riêng cho thủy quân; CD như ORDERS tuning.js, ĐỀ XUẤT BẢN THỬ):
//  • Tiến công — thuyền nhẹ: áp sát khiêu chiến (pha 1). Thuyền phục: xuất kích (chỉ từ pha 5; trước đó phải ẩn).
//  • Giữ vững — thuyền nhẹ: giữ khoảng cách (pha 1). Thuyền phục: chặn cửa nhánh sông (làm chậm Thoát vây, pha 4).
//  • Theo ta  — thuyền nhẹ: lui nhanh (pha 1). Từ pha 2: gọi đò chuyển cho tướng (5–8 s).
//  • Gọi tiếp viện — +20 quân cho cánh sau 20 s, 2 lượt cả trận.
// stanceCd: đổi thế đứng của đoàn thuyền nhẹ ở pha 1 (không dùng CD chung, phải nhạy tay).
export const WING_ORDERS = {
  tiencong: { name: "Tiến công", b20: "Khiêu chiến / Xuất kích", cd: 20, dur: 20, sk: 10 },
  giuvung:  { name: "Giữ vững",  b20: "Giữ khoảng cách / Chặn cửa nhánh", cd: 20, dur: ESCAPE.holdSec },
  theota:   { name: "Theo ta",   b20: "Lui nhanh / Đò chuyển", cd: 10 },
  tiepvien: { name: "Gọi tiếp viện", b20: "Tiếp viện thủy quân", cd: 90, charges: 2, amount: 20, delay: 20 },
  stanceCd: 3,
};

// Thẻ sử liệu ở màn nạp trận. Nhãn theo canon (Trụ cột 2).
export const HISTORY_NOTES = [
  { label: "Chính sử", text: "Ngày 8 tháng 3 năm Mậu Tý (9/4/1288), thủy quân Nguyên của Ô Mã Nhi, Phàn Tiếp rút theo sông Bạch Đằng ra biển sau khi thiếu lương; quân bộ Thoát Hoan rút theo đường Lạng Sơn." },
  { label: "Chính sử", text: "Hưng Đạo vương cho đóng cọc gỗ lớn vạt nhọn thành nhiều bãi dưới lòng sông từ trước, ngụy trang để lúc triều lên cọc chìm khuất. Thuyền nhẹ quân Trần khiêu chiến lúc triều lên rồi giả thua, dụ hạm đội vào bãi cọc; triều rút, thuyền Nguyên mắc cọc." },
  { label: "Chính sử", text: "Ô Mã Nhi, Phàn Tiếp, Tích Lệ Cơ Ngọc bị bắt sống; theo Toàn thư, Nội minh tự Đỗ Hành bắt được Ô Mã Nhi và Tích Lệ Cơ Ngọc. Hơn 400 chiến thuyền bị thu." },
  { label: "Chính sử", text: "Dấu tích bãi cọc tìm thấy ở Yên Giang, Đồng Má Ngựa, Đồng Vạn Muối, Cao Quỳ: cọc gỗ đường kính 10–30 cm, dài 1,5–3 m, không bịt sắt (cọc bịt sắt là chi tiết trận Bạch Đằng năm 938)." },
  { label: "Tương truyền", text: "Yết Kiêu có mặt ở trận này, lặn xuống đục thủng thuyền giặc." },
  { label: "Hư cấu", text: "Thao tác chặt dây bè cỏ \"Mở bãi cọc\", thuyền dò luồng, phao chặn luồng của Nguyễn Khoái và bố cục khúc sông nén còn 1,2 km là của game." },
  { label: "Hư cấu", text: "Việc người chơi tự tay khuất phục Ô Mã Nhi và thanh Gươm Tiết chế là chi tiết hư cấu của game." },
];

// B20 không có khung comic chèn giữa trận (comic B20 chỉ có mở và kết).
export const STORY_INSERTS = {};
