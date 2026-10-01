// data/battle-b20.js — B20 Bạch Đằng (9/4/1288), bản thử đợt 9. Cùng lối với battle-b15.js.
//
// Bố cục khúc sông là Hư cấu, nén từ ~2 km hạ lưu (canon mapNotes) còn 1,2 km cho vừa Trận nhanh. Hình học
// (tâm dòng, bề rộng, bãi cạn, nhánh sông, mốc cọc) lấy từ data/river-b20.js — nguồn duy nhất, ở đây chỉ gom lại
// và thêm số luật chơi. Trục: x 0 thượng lưu (tây) → x 1200 cửa sông (đông); z âm = bờ bắc. Đơn vị mét.
// Nguồn số: canon B20 (canon-b20.json), systems.md §5.8, §7; số không có nguồn là ĐỀ XUẤT BẢN THỬ.

import { TIDE as TIDE_GEOM, TIDE_Y, zc, hw, RIVER as RIVER_GEOM, STAKE_FIELDS, RAFT, bankPoint, midPoint } from "./river-b20.js";

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
  ...f, z: zc(f.x), raft: { w: RAFT.w, d: RAFT.d }, interact: 5, exposeSec: 10,
}));

// ---- Hạm đội Nguyên (systems §5.8; canon specialMechanic) -------------------------------------------
// shipsShown: số thuyền lớn hiển thị theo mức đồ họa (canon). qPerShip, shipHp (× S(R)): systems §5.8.
// escorts: 6 ở pha 2 (canon X24) + 8 đợt hai ở pha 4 (ĐỀ XUẤT BẢN THỬ, GDD). scoutEvery: canon X24 (giữ 40 s cả
// Trận nhanh — là cơ chế boss). p1Speed: đầu hạm đội đi ~400 m trong ~90 s (ĐỀ XUẤT BẢN THỬ). stopX: đầu hạm đội
// dừng ở pha 2 trước phao Nguyễn Khoái (ĐỀ XUẤT BẢN THỬ). cmdShips: kỳ hạm Ô Mã Nhi + thuyền chỉ huy Phàn Tiếp.
export const FLEET = {
  shipsShown: { thap: 24, vua: 40, cao: 60 }, qPerShip: 40, shipHp: 5000, escorts: [6, 8], scoutEvery: 40,
  scoutFirst: 15,                                   // giây đầu pha 2 tới thuyền dò đầu tiên (ĐỀ XUẤT BẢN THỬ)
  scoutWarn: 10,                                    // "Tình báo sớm" (Quyết sách đúng): báo trước 10 s (hợp đồng gameplay B20)
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
    tip: "Ra lệnh cho 8 thuyền nhẹ: Tiến công để khiêu chiến, Giữ vững để giữ khoảng cách, Theo ta để lui nhanh. Áp sát dưới 15 m thì mất dần thuyền." },
  { id: "P2", name: "Đánh hộ vệ hạm đội", goal: "Hạ 4 trong 6 thuyền hộ vệ của Phàn Tiếp", par: 2.5,
    tip: "Áp mạn, hạ trấn thủ rồi giữ Tương tác 3 s để chiếm thuyền. Chặn thuyền dò luồng trước khi nó chạm mốc cọc." },
  { id: "P3", name: "Kích hoạt bãi cọc", goal: "Mở bãi cọc ở ít nhất 2 trong 3 mốc", par: 1.5,
    tip: "Dẹp đội dò luồng: không để tướng địch đứng ở mốc quá 10 s. Giữ Tương tác 5 s ở mốc để chặt dây bè cỏ." },
  { id: "P4", name: "Thủy triều rút", goal: "Giữ hạm đội trong vùng cọc tới khi nước ròng", par: 2.25,
    tip: "Ra lệnh Giữ vững cho thủy quân ở cửa các nhánh sông. Mỗi thuyền hộ vệ bị hạ kéo thanh Thoát vây xuống 15." },
  { id: "P5", name: "Chiến thuyền mắc cạn", goal: "Lên boong, bắt sống Phàn Tiếp", par: 2.5,
    tip: "Thuyền phục từ sông Chanh, sông Rút, sông Giá lao ra. Dùng đò chuyển để lên boong thuyền Nguyên đã mắc cọc." },
  { id: "P6", name: "Bạch Đằng Quyết Chiến", goal: "Lên kỳ hạm, bắt sống Ô Mã Nhi", par: 2.5,
    tip: "Hào Khí đầy: kích Tổng Phản Công. Dẹp toán giữ cầu thang để lên lầu chỉ huy." },
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
    text: "Giữ hạm đội trong vùng cọc tới khi nước ròng: thanh Thoát vây không được chạm 100, và cần ≥ 2 mốc cọc đã mở.",
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
    weaponClass: "EWC02", hp: 12000, poise: 1000, poisePhases: 2,        // Đại tướng (systems §8; HP × S(R), Phá Thế tuyệt đối)
    cong: 200, giap: 80,                                                  // Đại tướng ×5 / ×4 (systems §8; bậc Tướng 160 / 60)
    hpLockPct: 10,                                                        // lầu chỉ huy: Sinh lực khóa ở 10% → Đòn Quyết "Bắt sống"
    hook: { every: 25, soldiers: 20, cut: 2 },                            // Móc Câu Áp Mạn
    theoConNuocAt: 50,                                                    // Theo Con Nước: > 50% tiến, < 50% quay ra biển
    intro: "Ô Mã Nhi, vạn hộ thủy quân nhà Nguyên, chỉ huy chiến thuyền rút theo sông Bạch Đằng ra biển.",
    mechanics: [
      { name: "Kỳ Hạm Hai Tầng", text: "Đánh trên kỳ hạm mắc cạn: boong dưới rồi lầu chỉ huy; lên lầu phải dẹp toán lính giữ cầu thang." },
      { name: "Móc Câu Áp Mạn", text: "Cứ 25 s thả móc kéo 1 thuyền nhỏ của ta áp mạn, 20 lính địch tràn sang; Tương tác 2 s để cắt móc.", todo: true },   // chưa có trong bản thử
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
      { name: "Hộ Vệ Hạm Đội", text: "Chỉ huy 6 thuyền hộ vệ quanh kỳ hạm; còn thuyền hộ vệ thì kỳ hạm không thể bị áp mạn.", todo: true },   // bản thử chưa ràng buộc (kỳ hạm chỉ lên được ở P6)
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
// cửa nhánh sông lấy từ river-b20.js RIVER.tribs (một nguồn — review P2-2)
function TRIB(id) { const t = RIVER_GEOM.tribs.find((q) => q.id === id); return { trib: id, mouthX: t.mouthX, side: t.side }; }
export const WINGS = {
  flotilla: { id: "flotilla", name: "Thuyền nhẹ khiêu chiến", boats: 8, q: 80, trib: null },
  chanh: { id: "chanh", name: "Thuyền phục sông Chanh", boats: 4, q: 60, ...TRIB("chanh") },
  rut:   { id: "rut",   name: "Thuyền phục sông Rút",   boats: 4, q: 60, ...TRIB("rut") },
  gia:   { id: "gia",   name: "Thuyền phục sông Giá",   boats: 4, q: 60, ...TRIB("gia") },
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
  { label: "Chính sử", text: "Vì thiếu lương, ngày 8 tháng 3 năm Mậu Tý (9/4/1288) thủy quân Nguyên của Ô Mã Nhi, Phàn Tiếp rút theo sông Bạch Đằng ra biển; quân bộ Thoát Hoan rút theo đường Lạng Sơn." },
  { label: "Chính sử", text: "Hưng Đạo vương cho đóng cọc gỗ lớn vạt nhọn thành nhiều bãi dưới lòng sông từ trước, ngụy trang để lúc triều lên cọc chìm khuất. Thuyền nhẹ quân Trần khiêu chiến lúc triều lên rồi giả thua, dụ hạm đội vào bãi cọc; triều rút, thuyền Nguyên mắc cọc." },
  { label: "Chính sử", text: "Ô Mã Nhi, Phàn Tiếp, Tích Lệ Cơ Ngọc bị bắt sống; theo Toàn thư, Nội minh tự Đỗ Hành bắt được Ô Mã Nhi và Tích Lệ Cơ Ngọc. Hơn 400 chiến thuyền bị thu." },
  { label: "Chính sử", text: "Dấu tích bãi cọc tìm thấy ở Yên Giang, Đồng Má Ngựa, Đồng Vạn Muối, Cao Quỳ: cọc gỗ đường kính 10–30 cm, dài 1,5–3 m, không bịt sắt (cọc bịt sắt là chi tiết trận Bạch Đằng năm 938)." },
  { label: "Tương truyền", text: "Yết Kiêu có mặt ở trận này, lặn xuống đục thủng thuyền giặc." },
  { label: "Hư cấu", text: "Thao tác chặt dây bè cỏ \"Mở bãi cọc\", thuyền dò luồng, phao chặn luồng của Nguyễn Khoái và bố cục khúc sông nén còn 1,2 km là của game." },
  { label: "Hư cấu", text: "Việc người chơi tự tay khuất phục Ô Mã Nhi và thanh Gươm Tiết chế là chi tiết hư cấu của game." },
];

// B20 không có khung comic chèn giữa trận (comic B20 chỉ có mở và kết).
export const STORY_INSERTS = {};

// ---- Director B20 (battle/director-b20.js): bố trí hạm đội, đoàn thuyền nhẹ, nhịp các pha — ĐỀ XUẤT BẢN THỬ -------------------
// Hạm đội đi thành 6 hàng × 4 làn (làn = lệch khỏi tâm dòng, m; bỏ trống làn giữa để bè cỏ ở ba mốc không nằm dưới thân
// thuyền). Hàng 0 là đầu hạm đội (x = st.fleet.headX của mô phỏng), hàng r lùi rowGap·r m. Pha 2 đầu hạm đội dừng ở
// FLEET.stopX 800 → hàng 1–5 neo ở x 752 → 560 (bãi M3, M2, M1 dưới hàng 1, 3, 5). Kỳ hạm ở hàng 3 (x 656, cạnh M2),
// thuyền chỉ huy Phàn Tiếp bên kia làn giữa. Sáu thuyền hộ vệ đi đầu (hàng 0, hai mép hàng 1), sang pha 2 thì tách đội đi tuần.
export const FORMATION = {
  rowGap: 48, lanes: [-36, -16, 16, 36],
  ships: [   // [id, loại thân, hàng, chỉ số làn]
    ["E1", "escort", 0, 0], ["E2", "escort", 0, 1], ["E3", "escort", 0, 2], ["E4", "escort", 0, 3],
    ["E5", "escort", 1, 0], ["J1", "junk", 1, 1], ["J2", "junk", 1, 2], ["E6", "escort", 1, 3],
    ["J3", "junk", 2, 0], ["J4", "junk", 2, 1], ["J5", "junk", 2, 2], ["J6", "junk", 2, 3],
    ["J7", "junk", 3, 0], ["FS", "flagship", 3, 1], ["PT", "junk", 3, 2], ["J8", "junk", 3, 3],
    ["J9", "junk", 4, 0], ["J10", "junk", 4, 1], ["J11", "junk", 4, 2], ["J12", "junk", 4, 3],
    ["J13", "junk", 5, 0], ["J14", "junk", 5, 1], ["J15", "junk", 5, 2], ["J16", "junk", 5, 3],
  ],
  labels: { FS: "Kỳ hạm Ô Mã Nhi", PT: "Thuyền chỉ huy Phàn Tiếp" }, flags: { FS: "元帥", PT: "樊" },
  hideX: -205,                                       // đuôi hạm đội lúc mở màn còn ngoài bản đồ: giấu thuyền có x < hideX
};
// Đoàn thuyền nhẹ khiêu chiến (pha 1): thuyền chỉ huy nhẹ của tướng ở x = st.nghi.flotX, 7 thuyền nhẹ lệch [dx, dz] quanh đó
// (dx âm = phía hạm đội). crew: quân ta đứng trên mỗi thuyền nhẹ; guards: thân binh theo tướng trên thuyền chỉ huy.
// Làn giữa sau thuyền chỉ huy để trống (thuyền tiên phong áp mạn đi làn kề bên, không xuyên qua thuyền khác).
// hold: chỗ đậu từ pha 2 [x, lệch dz] (thuyền chỉ huy + 7 thuyền) — sát hai bờ (|dz| ≥ 62, ngoài vòng tuần của hộ vệ), vào bờ
// bằng một bước tránh xuôi dòng rồi ngược lên dọc bờ (sidestep m) để không cắt ngang đường hạm đội.
export const FLOTILLA = {
  slots: [[-4, -12], [-4, 12], [-9, -24], [-9, 24], [-14, -36], [-14, 36], [-18, -48]], crew: 4, guards: 6,
  hold: { lead: [450, 64], boats: [[430, 66], [470, -64], [410, -66], [490, 66], [390, -64], [450, -68], [410, 68]] }, sidestep: 26,
};
// Thuyền tiên phong Nguyên (pha 1): cứ every s một thuyền dò (thân "scout") rời đầu hạm đội đuổi kịp một thuyền nhẹ (lần đầu
// thuyền của tướng), áp mạn (ván bắc), crew lính (+ Đội trưởng mỗi thuyền thứ 2) tràn sang. Thuyền nhẹ bị áp mạn không dọn xong
// trong lose s thì mất (flotillaLoss); thuyền chỉ huy nhẹ của tướng không tính giờ (thân binh giữ). Đồng thời tối đa max thuyền.
// repel: không còn lính địch nào trên thuyền bị áp mạn (và ván bắc) repel s thì thuyền tiên phong cắt ván lui (cung thủ còn trên
// thuyền tiên phong không giữ nó lại).
export const VANGUARD = { every: 14, first: 8, max: 2, crew: 5, officerEvery: 2, chase: 4, speedMax: 11, lose: 30, gap: 2.6, repel: 4 };
// Thuyền hộ vệ (pha 2): tuần vòng quanh khối hạm đội ở hai mép sông (x0–x1, |dz| 46–55; mép cùng phía làn của nó — không cắt
// ngang sông) 2,5 m/s; tướng tới gần engage m (hoặc
// đò ta nhắm tới) thì dừng nghênh chiến. Thủy thủ (crew + trấn thủ Đội trưởng) chỉ dựng khi tướng trong spawnR m (tối đa maxSpawned
// thuyền cùng lúc, gần trước), cất đi khi xa quá despawnR (giữ số còn sống).
export const ESCORT_OPS = {
  speed: 2.5, transit: 5, engage: 40, spawnR: 60, despawnR: 110, maxSpawned: 2, crew: 12, dz: [46, 55],   // crew 10 → 12 (D4: bot chiếm 4 hộ vệ trong ~97 s, par pha 2,5 phút)
  stations: { E1: [480, 590, -1], E4: [480, 590, 1], E2: [600, 710, -1], E3: [600, 710, 1], E5: [720, 830, -1], E6: [720, 830, 1] },
};
// Thuyền dò luồng (sự kiện "scout" của mô phỏng, pha 2–3): rời thuyền Phàn Tiếp tới bè cỏ của mốc, 4 lính + Đội trưởng; tới
// cách bè ≤ exposeR m mà Đội trưởng còn sống thì mốc lộ. Đội trưởng ngã: thuyền bị chặn, trôi.
// Đội dò luồng (pha 3): ba toán (Trưởng đội dò luồng + crew) tới bè cỏ ở +arrive s, theo thứ tự mốc ẩn gần hạm đội nhất;
// thuyền xuất phát lead s trước khi tới, cách bè ~speed·lead m. Lên bè đứng; mô phỏng tính giờ tướng địch đứng mốc
// (setMarkerOfficer mỗi giây: sống, trên bè, tướng người chơi xa hơn heroR m).
export const SCOUT_OPS = { speed: 4, crew: 4, exposeR: 8 };
// arrive 12 / 35 / 58 → 14 / 40 / 66 (review B20): thuyền dò luồng của pha 2 còn chạy lúc vào pha 3 thì tướng chặn nó (~10 s) rồi đò tới bè
// đầu (~6 s) chậm 1 s — mốc lộ, Kích hoạt bãi cọc hỏng (bot Quân sĩ 1001). Toán ba vẫn tới trong cửa sổ 100 s.
export const SQUADS = { arrive: [14, 40, 66], crew: 6, lead: 12, speed: 4, heroR: 8 };
// Đò chuyển: tối đa maxDist m (đò 5–8 s: xa hơn thì chạy quá nhanh — báo cáo D1).
export const FERRY = { maxDist: 260 };
// Chỗ tướng ở đầu mỗi pha khi tải lại checkpoint (setupPhase): P1 thuyền chỉ huy nhẹ, P2 thuyền chỉ huy nhẹ gần x 450, P3–P4
// thuyền hộ vệ đã chiếm (không có thì thuyền chỉ huy nhẹ), P5 bãi bùn cạnh thuyền Phàn Tiếp, P6 bãi bùn cạnh ván dốc kỳ hạm.
// Hào Khí mở màn 30 (VS: trận Vân Đồn coi như đã thắng, R-spec §1), sàn 25 tới mốc đầu tiên.
export const HK_B20 = { start: 30, floor: 25, debugAt: [30, 50, 62, 75, 90, 100] };

// ---- Pha 4–6 (director-b20.js phần 2) — ĐỀ XUẤT BẢN THỬ -----------------------------------------------------------------------------------
// Hộ vệ đợt hai (pha 4, canon X24 + GDD "đợt hai 8 thuyền"): tách khỏi khối hạm đội ở starts [x, phía ±1], lần lượt rời đi (first +
// every·k s sau đầu pha), chạy speed m/s theo làn lệch |dz| = lane ra cửa sông (MAP.exitX); gần bãi cọc đã lộ (hạm đội né mốc lộ —
// canon Theo Con Nước) hoặc cụm thuyền Phàn Tiếp (phía +) thì vòng ra làn ngoài laneOut. Tới cách cửa sông exitR m thì thoát ra biển.
// Đổi làn cắt ngang làn ±36 của khối thuyền neo nên chỉ đổi sau mũi khối (x > block): vùng né chạm khối thì chạy làn ngoài từ chỗ
// xuất phát (blend: quãng hoà làn, dốc ngang ≤ ~1). Hộ vệ đợt một còn sót cũng bỏ vòng tuần, chạy ra cửa sông theo làn ngoài. Làn lane 26: giữa làn ±16 và ±36 của hạm đội, trong khuôn
// bãi cọc (|dz| ≤ 30) — thuyền hộ vệ đang chạy qua bãi đã mở lúc nước xuống 30% thì mắc cọc.
export const EBB_OPS = {
  speed: 3, first: 4, every: 9, lane: 26, laneOut: 50, avoid: 30, blend: 34, exitR: 12, block: 772,
  starts: [[790, 1], [776, -1], [742, 1], [712, -1], [690, -1], [636, 1], [602, -1], [566, 1]],
};
// Liên Hoàn Thuyền (canon X24: dưới 50% Sinh lực xích 3 thuyền làm bệ đứng vững, mắc cạn chung). Pha 4 Phàn Tiếp gom thuyền: J8 (cùng
// hàng, làn +36) dạt vào sát mạn thuyền chỉ huy (khe gap m) trong slideSec s; J12 (hàng sau, làn +36) tiến lên thế chỗ J8 (bắt đầu sau
// sailDelay s, đi trong sailSec s). Ba thuyền nằm cạn cùng một độ nghiêng; pha 5 dưới 50% Sinh lực thì bắc ván + xích nối ba boong.
export const CLUSTER = { ids: ["J8", "J12"], gap: 2.6, slideSec: 14, sailDelay: 4, sailSec: 24 };
// Thuyền phục xuất kích (pha 5, canon: thuyền phục ở ba nhánh sông): mỗi thuyền chở crew quân ta, chèo speed m/s ra khỏi lạch (lần lượt
// cách nhau stagger s), cập mạn một thuyền Nguyên mắc cạn (cụm Phàn Tiếp, rồi thuyền gần lạch), quân ta lên boong đánh cùng tướng.
// Pha 6: fsBoats thuyền phục gần nhất cập kỳ hạm, đưa quân ta lên boong dưới.
export const SORTIE = { crew: 4, speed: 6, stagger: 1.5, fsBoats: 2 };
// Thủy thủ Nguyên trên thuyền mắc cạn (pha 5–6; systems §5.8: boong thành bãi đánh trên bộ): n lính, dựng khi tướng trong spawnR m
// (tối đa maxSpawned thuyền cùng lúc), cất khi xa quá despawnR (giữ số còn sống).
export const HULL_CREW = { n: 8, spawnR: 55, despawnR: 110, maxSpawned: 3 };                // n 6 → 8 (D4)
// Boss (canon X24, X20; systems §8, GDD §11.4). Phàn Tiếp: bậc Tướng (HP 4200 × S(R), Phá Thế 600) trên thuyền chỉ huy, giữ cụm
// thuyền (leash m quanh chỗ đứng), cùng crew thủy thủ; Sinh lực khóa ở lockPct% — Vỡ Thế rồi Đòn Quyết "Bắt sống".
// Ô Mã Nhi: Đại tướng (HP 12000 × S(R), Phá Thế 1000 mỗi tầng, 2 tầng); boong dưới khóa tạm ở deckLockPct% rồi lui lên lầu chỉ huy
// (kịch bản đi qua cầu thang, retreatK × tốc độ; lui quá retreatMax s — bị chặn — thì đặt thẳng lên lầu), toán giữ cầu thang (Đội trưởng + stairElites tinh nhuệ — hạ xong ông ta mới ra
// đánh; tướng đứng trên lầu quá towerWait s thì thôi chờ), lầu chỉ huy khóa ở BOSSES.X20.hpLockPct (10%), chỉ đánh trong towerLeash m
// quanh giữa lầu. guards: các nhóm tinh nhuệ trên boong dưới (canon "nhóm 3–5"). lunge: Kích xuyên ở lầu chỉ huy.
// capturedGuards: quân ta cầm giáo đứng vây người bị bắt (giáo hạ, không trói). fsSettle: kỳ hạm lún, nghiêng (s) rồi sang pha 6.
// Đo bằng bot (đợt 9 pha D4, Quân sĩ, 3 seed): pha 5 chỉ ~48 s (par 2,5 phút) — Tuyệt Kỹ + dấu Binh Thư hạ Phàn Tiếp 100 → 25% trong
// ~15 s (trần Tuyệt Kỹ vào đơn vị lớn tính theo % Sinh lực nên thêm Sinh lực không kéo dài), phần dài là phá thế lúc khóa 25% — nên
// thủy thủ 6 → 8. (Đợt D4 từng đặt Phá Thế X24 ×1,4; review B20 bỏ: Phá Thế nay là số tuyệt đối của canon — ctx.poiseAbs, không nhân
// S(R) — Phàn Tiếp 600, Ô Mã Nhi 1000 mỗi tầng, Đội trưởng 100.) (Thử nhóm tinh nhuệ Ô Mã Nhi [5, 4, 5] + toán cầu thang 5: bot Tướng
// quân thua 3 lần ở pha 6 — giữ [4, 3, 5] / 4.) Bắt sống Phàn Tiếp hồi heal (25%) Sinh lực như chiếm hộ vệ (+15%): B20 không có đồ hồi
// máu, bot Tướng quân vào pha 6 còn ~30% Sinh lực và gục 2–4 lần trước Ô Mã Nhi.
// afterCapture: giây từ lúc bắt sống Ô Mã Nhi tới cảnh kết (bằng cảnh bắt sống captureShot); outroSec: cảnh kết kéo máy quay lên nhìn
// cả khúc sông (≤ 10 s tổng). captureShot: cảnh bắt sống (máy quay trước mặt người bị bắt) — với Phàn Tiếp, hết cảnh thì kỳ hạm mắc cạn.
// fsTilt: độ nghiêng kỳ hạm khi mắc cạn (canon 12°). retryHp: Sinh lực tối thiểu khi tải lại checkpoint theo pha (P5–P6 đầy).
export const BOSS_OPS = {
  X24: { crew: 8, heal: 0.25, leash: 13, lockPct: 25, awakeR: 18, title: "Tướng thủy quân Nguyên" },
  X20: { deckLockPct: 50, guards: [4, 3, 5], stairElites: 4, leash: 11, towerLeash: 5, towerWait: 6, retreatK: 0.9, retreatMax: 12, awakeR: 16, title: "Vạn hộ thủy quân · Đại tướng",
    lunge: { cd: 7, dist: 5.5, tele: 0.55, mv: 1.6 } },
  capturedGuards: 6, fsSettle: 4, captureShot: 2.8, afterCapture: 2.8, outroSec: 7.2, fsTilt: 12 * Math.PI / 180,
  retryHp: [0.5, 0.5, 0.5, 0.5, 1, 1],
};
