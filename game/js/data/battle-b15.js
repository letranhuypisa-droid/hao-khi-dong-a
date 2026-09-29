// data/battle-b15.js — B15 Hàm Tử, biến thể PROTO (Đặc tả prototype 21.2).
//
// Bố cục Cứ Điểm là Hư cấu, phục vụ thử nghiệm, KHÔNG thay bố cục canon (canon B15: 2 bến
// thuyền, 1 doanh trại, 2 tháp canh, 1 làng). Toạ độ tính bằng mét.
//
// Trục bản đồ: x 0 → 600 (tây → đông, bản doanh ta → Hàm Tử quan), z −200 → 200 (bắc → nam).
// Sông Hồng chảy dọc mép bắc rồi vòng mép đông; Hàm Tử quan là đồn bến sông của quân Nguyên.
// Hai mặt trận cách nhau 150 m (~22 s đi bộ, 21.2).

export const MAP = {
  w: 600, h: 400, minX: 0, maxX: 600, minZ: -200, maxZ: 200,
  riverNorthZ: -168,        // bờ sông bắc
  riverEastX: 588,          // bờ sông đông
  fortWallX: 462,           // tường tây của Hàm Tử quan
  fortSouthZ: 150,          // tường nam
  beach: { x: 528, z: -40, r: 38 },   // bãi cát cho trận boss (S3.10)
  landing: [{ x: 510, z: -150 }, { x: 556, z: -128 }, { x: 574, z: -60 }],  // đổ bộ P4
};

// Mặt trận: tuyến x ∈ [0,1] đổi sang toạ độ thế giới theo lineToX.
export const FRONTS = {
  A: { id: "A", name: "Mặt trận A · bến trên", laneZ: -75, x0: 60, x1: 560, line0: 0.20,
       qTa: 1000, qDich: 1200, allyGeneral: "H33" },
  B: { id: "B", name: "Mặt trận B · bến dưới", laneZ: 75, x0: 60, x1: 560, line0: 0.40,
       qTa: 1000, qDich: 1200, allyGeneral: "H40" },
};
export const ENEMY_MIX = { KHIEN_NG: 0.6, CUNGKY_NG: 0.4 };   // 21.6
export const lineToX = (f, x) => f.x0 + x * (f.x1 - f.x0);
export const xToLine = (f, wx) => (wx - f.x0) / (f.x1 - f.x0);

// Cứ Điểm (21.2). lineX: vị trí trên tuyến. G: quân đồn trú. cap: giây chiếm.
// hk: [Hào Khí khi ta chiếm, khi mất]. gate: độ bền gốc (nhân S(R)).
// G của cổng là "quân giữ cổng" — ĐỀ XUẤT BẢN THỬ, GDD không đặt quân đồn trú cho cổng.
export const BASES = [
  { id: "HQ_TA", name: "Bản doanh ta", type: "ban_doanh", owner: "ta", front: null, x: 34, z: 0, r: 16 },
  { id: "A1", name: "Đồn bến trên", type: "don", owner: "dich", front: "A", lineX: 0.30, G: 40, keeper: "doitruong", cap: 3, hk: [3, -5] },
  { id: "A2", name: "Doanh trại trên bãi", type: "doanh_trai", owner: "dich", front: "A", lineX: 0.55, G: 80, keeper: "photuong", cap: 5, hk: [6, -10] },
  { id: "A3", name: "Cổng bắc Hàm Tử quan", type: "cong", owner: "dich", front: "A", lineX: 0.80, gate: 4000, G: 30, hk: [5, 0] },
  { id: "B1", name: "Đồn bến dưới", type: "don", owner: "ta", front: "B", lineX: 0.30, G: 40, keeper: "doitruong", cap: 3, hk: [3, -5] },
  { id: "B2", name: "Doanh trại bến dưới", type: "doanh_trai", owner: "dich", front: "B", lineX: 0.55, G: 80, keeper: "photuong", cap: 5, hk: [6, -10] },
  { id: "B3", name: "Cổng nam Hàm Tử quan", type: "cong", owner: "dich", front: "B", lineX: 0.80, gate: 4000, G: 30, hk: [5, 0] },
];
export const BASE_RING = { don: 10, doanh_trai: 13, cong: 7, ban_doanh: 16 };

// Pha (21.2). Par tính bằng phút (đề xuất trong GDD).
export const PHASES = [
  { id: "P1", name: "Chiếm bến trên", goal: "Chiếm Đồn bến trên (A1)", par: 2,
    tip: "Đi theo mặt trận A về phía đông. Hạ quân đồn trú và Đội trưởng, rồi đứng trong vòng để chiếm." },
  { id: "P2", name: "Hai cánh", goal: "Chiếm Doanh trại trên bãi (A2)", par: 3,
    tip: "Hai mặt trận cùng cần bạn. Mở vòng Mệnh Lệnh (Tab) để giao việc cho quân." },
  { id: "P3", name: "Hàm Tử quan", goal: "Phá Cổng bắc (A3) hoặc Cổng nam (B3)", par: 3,
    tip: "Cổng bắc gần hơn. Cổng nam xa hơn, nhưng mở được thì cánh B +15 Sĩ Khí." },
  { id: "P4", name: "Toa Đô", goal: "Đánh lui Toa Đô", par: 2,
    tip: "Quân Nguyên đổ bộ từ mép nước mỗi 30 giây. Đây là lúc hợp nhất để kích Tổng Phản Công." },
];

// Nhiệm vụ phụ (21.6): "chiếm B2" và "mở cả hai cổng".
export const SIDE_MISSIONS = [
  { id: "S_B2", name: "Chiếm Doanh trại bến dưới (B2)" },
  { id: "S_GATES", name: "Mở cả hai cổng Hàm Tử quan" },
];

// Sự kiện động (21.2, 21.6; hạn giờ Trận nhanh ×1,2 đã tính sẵn).
export const EVENTS = {
  counterA1: { name: "Cứ Điểm bị phản công", at: 30, limit: 72, base: "A1", squad: 22,
               win: { hk: 3 }, lose: { hk: -5 } },
  surrounded: { name: "Tướng ta bị vây", at: 75, limit: 90, general: "H40", base: "B2", squad: 24,
                win: { hk: 6, sk: 15 }, lose: { hk: -5, sk: -25 } },
};

export const ALLY_GENERALS = {
  H33: { id: "H33", name: "Trần Nhật Duật", title: "Chiêu Văn vương", weapon: "giao", front: "A", hp: 2600, color: 0x2f4a6a },
  H40: { id: "H40", name: "Nguyễn Khoái", title: "", weapon: "cung", front: "B", hp: 2400, color: 0x4a5a2a },
};

export const BOSS = {
  id: "X19", name: "Toa Đô", nameHan: "唆都", tier: "tuong", defeatMeans: "rút chạy",
  intro: "Toa Đô dẫn quân từ Chiêm Thành đánh ra, đóng ở bến Hàm Tử.",
};

// Thẻ sử liệu hiện ở màn nạp trận. Nhãn theo canon GDD (Trụ cột 2).
export const HISTORY_NOTES = [
  { label: "Chính sử", text: "Tháng 4 năm Ất Dậu (1285), quân Trần đánh quân Toa Đô ở bến Hàm Tử. Trần Nhật Duật cầm quân, có Trần Quốc Toản và Nguyễn Khoái cùng đánh." },
  { label: "Chính sử", text: "Trần Quốc Toản dựng cờ đề sáu chữ \"Phá cường địch, báo hoàng ân\", tập hợp gia binh hơn nghìn người đi đánh giặc." },
  { label: "Hư cấu", text: "Bố cục đồn, doanh trại, cổng của trận này dựng để thử lối chơi, không phải bố cục thật của bến Hàm Tử." },
  { label: "Hư cấu", text: "Song đao của Trần Quốc Toản là chi tiết hư cấu của game." },
];

// ---- Kế Sách B15 (GDD 5.6, 5.7; hồ sơ B15) --------------------------------------------------
// Máy trạng thái: Khóa → Khả dụng → Sẵn sàng (cửa sổ) → Kết quả. Không có hồi chiêu.
// Khung Hào Khí gốc: Lớn +20, Nhỏ +10; thưởng lẻ cộng dồn không vượt khung, trần cả trận.
// Trận nhanh: Kế Sách Lớn giữ nguyên, cửa sổ ×0,75; bỏ Kế Sách Nhỏ.
export const KE_SACH = {
  coAoTong: {
    id: "coAoTong", name: "Cờ áo Tống", quyMo: "lon", hk: 20, label: "Chính sử", modes: ["nhanh", "chuan"],
    text: "Hộ tống 2 thuyền quân Triệu Trung cập bến trên, rồi bấm Lệnh Kế Sách.",
    lore: "Quân Trần Nhật Duật có người Tống lưu vong (gia tướng Triệu Trung) mặc áo Tống ra trận khiến quân Nguyên hoảng hốt.",
    unlockBase: "A1", boats: 2, boatSpeed: 3, stopEnemyR: 8, boatHp: 1500, perBoat: 5,
    // đường thuyền dọc sông, cách bờ 8 m; bến trên ngay bắc A1 (vị trí là ĐỀ XUẤT BẢN THỬ)
    route: [{ x: 24, z: -177 }, { x: 214, z: -177 }, { x: 214, z: -171 }],
    landing: { x: 214, z: -160 },
    guards: [{ x: 95, z: -164, n: 9 }, { x: 148, z: -164, n: 9 }, { x: 192, z: -163, n: 10, officer: "doitruong" }],
    window: 40, retryAfter: 60,
    effect: { radius: 40, dur: 30, skPerSec: 2, miss: 0.3, qTa: 80, troops: 12 },
  },
  muiTenThu: {
    id: "muiTenThu", name: "Mũi tên thư", quyMo: "nho", hk: 10, label: "Tương truyền", modes: ["chuan"],
    text: "Nhặt 3 bó tên buộc thư ở làng, giao cho Nguyễn Khoái, rồi bấm Lệnh Kế Sách để bắn yểm trợ vào doanh trại Nguyên.",
    lore: "Thư trên mũi tên: chỉ đánh quân xâm lược, không đánh người bị bắt đi lính.",
    bundles: [{ x: 150, z: 138 }, { x: 176, z: 152 }, { x: 196, z: 134 }],
    deliverTo: "H40", deliverR: 7, targets: ["B2", "A2"], window: 60, retryAfter: 45,
    effect: { g: 24 },     // 2 đội lính phụ trợ buông vũ khí (ĐỀ XUẤT BẢN THỬ: 24 người)
  },
};
export const VILLAGE = { x: 172, z: 144, r: 26 };   // làng hư cấu cho "Mũi tên thư"
