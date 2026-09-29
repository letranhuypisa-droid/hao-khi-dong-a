// data/progression.js — cây kỹ năng H35, binh khí, quân đoàn, doanh trại (GDD mục 12).
//
// Cây: 3 nhánh × (4 tầng × 2 nút) + 1 đỉnh mỗi nhánh = 27 nút; giá tầng = số tầng, đỉnh 5.
// H35 thay 5 nút thư viện (12.6). Hai nút riêng của H35 cần Cờ Sáu Chữ và Quả Cam Bóp Nát,
// mà hai kỹ năng này là nội dung VS (21.2), nên bản này giữ nút thư viện ở hai chỗ đó.
// Nút Kế Sách hiện đủ nhưng có cờ `inert`: bản thử tắt Kế Sách (keSachEnabled = false).

export const TREE = {
  vo:   { name: "Võ",   title: "Song Đao Hoài Văn",   blurb: "Chiến đấu cá nhân" },
  thong:{ name: "Thống",title: "Gia Binh Theo Cờ",    blurb: "Quân ta" },
  muu:  { name: "Mưu",  title: "Thiếu Niên Bình Than",blurb: "Kế Sách và Hào Khí" },
};

// fx: khoá hiệu ứng mà engine đọc (xem meta/progress.js heroMods()).
export const NODES = [
  { id: "V1a", b: "vo", t: 1, name: "Lưỡi Kép",        text: "Công +5%",                             fx: { atkPct: 0.05 } },
  { id: "V1b", b: "vo", t: 1, name: "Thế Lốc",          text: "Phá Thế gây ra +15%",                  fx: { poisePct: 0.15 } },
  { id: "V2a", b: "vo", t: 2, name: "Lướt Liên Hoàn",   text: "Thưởng tốc Liên hoàn tính mỗi 8 đòn trúng thay vì 10", fx: { comboEvery: 8 }, kind: "lớp WC03" },
  { id: "V2b", b: "vo", t: 2, name: "Đọc Đòn",          text: "Cửa sổ phản đòn +0,05 s",              fx: { parryWin: 0.05 } },
  { id: "V3a", b: "vo", t: 3, name: "Chém Vỡ Thế",      text: "Mỗi lần làm Vỡ Thế: +15 Khí Lực",       fx: { breakKi: 15 } },
  { id: "V3b", b: "vo", t: 3, name: "Uy Quyết Chiến",   text: "Sát thương Tuyệt Kỹ +10%",             fx: { ultPct: 0.10 } },
  { id: "V4a", b: "vo", t: 4, name: "Xuyên Trận",       text: "Phá Trận lao 22 m thay vì 18 m",       fx: { phaTranLen: 22 }, kind: "tướng" },
  { id: "V4b", b: "vo", t: 4, name: "Tàn Ảnh",          text: "Né để lại tàn ảnh, nổ sau 0,5 s (MV 0,5, r 3 m)", fx: { afterimage: true } },
  { id: "VD",  b: "vo", t: 5, name: "Quyết Chiến Bất Tận", text: "Tuyệt Kỹ tiêu 1 vạch: 25% hoàn 50 Khí Lực", fx: { ultRefund: 0.25 }, apex: true },

  { id: "T1a", b: "thong", t: 1, name: "Thân Binh Hoài Văn", text: "Thân binh +2",                    fx: { bodyguards: 2 } },
  { id: "T1b", b: "thong", t: 1, name: "Cờ Sáu Chữ Phấp Phới", text: "Hào quang +3 m",                 fx: { aura: 3 } },
  { id: "T2a", b: "thong", t: 2, name: "Truyền Lệnh Nhanh", text: "CD Mệnh Lệnh ×0,9",                fx: { cmdCdMult: 0.9 } },
  { id: "T2b", b: "thong", t: 2, name: "Hương Binh Tiếp Ứng", text: "Mỗi lượt tiếp viện +100 quân",   fx: { reinfAmt: 100 } },
  { id: "T3a", b: "thong", t: 3, name: "Giữ Tướng",         text: "Tướng đồng minh AI +15% Sinh lực",  fx: { allyHpPct: 0.15 } },
  { id: "T3b", b: "thong", t: 3, name: "Một Lòng Theo Cờ",  text: "Cánh có tướng: Sĩ Khí thêm +1 mỗi 5 s", fx: { skPer5: 1 } },
  { id: "T4a", b: "thong", t: 4, name: "Thế Đứng Vững",     text: "Giữ vững: tổn thất quân thêm −10%", fx: { holdThu: 0.1 } },
  { id: "T4b", b: "thong", t: 4, name: "Tiếp Viện Các Lộ",  text: "Lượt tiếp viện +1 (tồn tối đa vẫn 4)", fx: { reinfCharges: 1 } },
  { id: "TD",  b: "thong", t: 5, name: "Trống Trận Hai Bờ", text: "Tổng Phản Công +5 s (trần +10 s)",  fx: { tpcExt: 5 }, apex: true },

  { id: "M1a", b: "muu", t: 1, name: "Khí Thế Đông A",     text: "Hào Khí nhận +5%",                   fx: { hkPct: 0.05 } },
  { id: "M1b", b: "muu", t: 1, name: "Trinh Sát Hai Bờ",   text: "Hiện Đội trưởng, Phó tướng địch trên bản đồ nhỏ", fx: { revealOfficers: true } },
  { id: "M2a", b: "muu", t: 2, name: "Tiên Liệu",          text: "Cửa sổ Kế Sách +10%",                fx: {}, inert: true },
  { id: "M2b", b: "muu", t: 2, name: "Lửa Kho Giặc",       text: "Đốt kho nhanh 40%",                  fx: {}, inert: true },
  { id: "M3a", b: "muu", t: 3, name: "Đoạt Trại",          text: "Chiếm Cứ Điểm nhanh 30%",            fx: { capSpeed: 0.3 } },
  { id: "M3b", b: "muu", t: 3, name: "Dấy Khí",            text: "Mốc Hào Khí 25: Công quân ta +7% thay vì +5%", fx: { m25: 0.07 } },
  { id: "M4a", b: "muu", t: 4, name: "Kế Lớn Dài Hơi",     text: "Kế Sách lớn: hiệu ứng kéo dài +20%", fx: {}, inert: true },
  { id: "M4b", b: "muu", t: 4, name: "Giữ Lửa",            text: "Suy giảm Hào Khí chậm 50%",          fx: { hkDecay: 0.5 } },
  { id: "MD",  b: "muu", t: 5, name: "Thiếu Niên Bình Than", text: "Bắt đầu mỗi trận với Hào Khí +15", fx: { hkStart: 15 }, apex: true },
];
export const TREE_RULES = { apexMinBranch: 15, apexMinLevel: 20, apexCost: 5, maxApex: 1 };

// ---- Binh khí lớp WC03 Song đao (12.7) ----------------------------------------------------
export const WEAPON_TIERS = [
  { tier: 1, name: "Thường",     pct: 0.00, slots: 0 },
  { tier: 2, name: "Tinh",       pct: 0.10, slots: 0, up: { tt: 10, tien: 1000 } },
  { tier: 3, name: "Bảo",        pct: 0.20, slots: 1, up: { tt: 30, tien: 3000 } },
  { tier: 4, name: "Danh",       pct: 0.35, slots: 1 },               // chỉ rơi, không rèn ra
  { tier: 5, name: "Truyền thế", pct: 0.50, slots: 2 },               // nhiệm vụ riêng, cấp 30
];
export const WEAPON_NAMES = { 1: "Song đao sắt", 2: "Song đao thép tôi", 3: "Song đao Bảo", 4: "Song đao Danh · Chiến lợi Hàm Tử", 5: "Song đao Hoài Văn" };
export const FORGE = {
  maxLevel: 5, atkPerLevel: 0.06, capMult: 1.8,
  cost: (n) => ({ tien: 400 * n * n, tt: 5 * n }),       // mức n: 400n² Tiền + 5n Tinh thiết
  smelt: { tien: 400, tt: 1 },                           // Đúc thép
  rerollKhac: (tier) => 500 * tier,                      // tẩy Khắc
};
export const KHAC = [
  { id: "phagiap", name: "Phá giáp",   text: "Bỏ qua 10% giáp",                 fx: { armorPen: 0.10 } },
  { id: "chimang", name: "Chí mạng",   text: "Chí mạng +5%",                    fx: { crit: 0.05 } },
  { id: "hoisuc",  name: "Hồi sức",    text: "Hồi 1% Sinh lực mỗi 20 KO",       fx: { koHeal: 20 } },
  { id: "chan",    name: "Chấn",       text: "Đòn C: 10% gây choáng",           fx: { cStun: 0.10 } },
  { id: "tocdanh", name: "Tốc đánh",   text: "Tốc đánh +5%",                    fx: { atkSpeed: 0.05 } },
  { id: "nuoisk",  name: "Nuôi Sĩ Khí",text: "+1 Sĩ Khí cánh mỗi 30 KO",        fx: { koSk: 30 } },
  { id: "khiluc",  name: "Khí Lực",    text: "Khí Lực nạp +10%",                fx: { kiPct: 0.10 } },
];

// ---- Quân đoàn (12.8) — trận này quân ta chỉ có giáo binh -------------------------------------
export const LEGION = {
  unitMax: 5, unitCost: (n) => 150 * n * n, unitHpAtk: 0.08, unitSimC: 0.03,
  guardMax: 5, guardCost: (n) => 500 * n,
  guardPerks: ["Khiên", "+1 đòn phối hợp", "Tinh nhuệ", "+1 đòn phối hợp", "Tinh nhuệ hoặc Kỵ"],
};

// ---- Doanh trại (12.9) --------------------------------------------------------------------
export const CAMP = {
  maxLevel: 3, cost: (n) => 2000 * n,
  buildings: [
    { id: "truongsoai", name: "Trướng soái", lv: 1, text: "Chọn trận, cây kỹ năng, tẩy điểm miễn phí" },
    { id: "loren",      name: "Lò rèn",      lv: 2, text: "Nâng bậc, rèn, Khắc, Đúc thép" },
    { id: "luyenbinh",  name: "Luyện binh trường", lv: 2, text: "Nâng giáo binh và thân binh" },
    { id: "votruong",   name: "Võ trường",   lv: 3, text: "Luyện tập với sóng lính, không thưởng" },
  ],
};

// ---- Vật phẩm trong trận ----------------------------------------------------------------------
// GDD có "vật phẩm hồi Sinh lực" (4.4) và thử thách "không dùng vật phẩm hồi" (13.5). Nguồn rơi
// dưới đây là ĐỀ XUẤT BẢN THỬ, cố định theo điều kiện, không ngẫu nhiên. Tên vật phẩm là Hư cấu.
export const PICKUPS = {
  comnam:   { name: "Cơm nắm",       text: "+25% Sinh lực", heal: 0.25, color: 0xf2ead3 },
  ruouthuoc:{ name: "Rượu thuốc",    text: "+50% Sinh lực", heal: 0.50, color: 0x9a4a2a },
  colenh:   { name: "Cờ lệnh",       text: "Công +20% trong 30 s", atkBuff: 0.20, dur: 30, color: 0xc0392b },
  tuiten:   { name: "Túi quân lương", text: "+60 Khí Lực", ki: 60, color: 0xc8a24a },
  ruong:    { name: "Rương Cứ Điểm", text: "Tiền", coin: 300, color: 0x6b3f1d },
};
export const DROPS = { doitruong: ["comnam"], photuong: ["ruouthuoc", "tuiten"], gate: ["colenh"], base: ["ruong"] };

// Cấp trận R mở dần (R1: B12 = 1, +3 mỗi trận … B20 = 25; 12.1).
export const R_LADDER = [1, 4, 7, 10, 13, 16, 19, 22, 25];
