// data/battle-b17.js — B17 Tây Kết (20 tháng 5 năm Ất Dậu, khoảng 24/6/1285), bản thử đợt A1 (greybox).
//
// Canon: design/canon.json battles B17 (H30, H40, X19, X20). Bản thử dựng trên đất Hàm Tử của B15 như B16 (Tây Kết và Hàm Tử cùng vùng
// Khoái Châu): cánh Toa Đô hành quân dọc đường A của B15 qua đồn A1, doanh trại A2 (có tường), cổng bắc A3 của Hàm Tử quan (quân Nguyên giữ, mở
// sẵn), rồi băng qua đầm trong tường ra mốc cửa sông ở góc đông bắc. Hai bãi lau (tây: hai bên đường trước cổng; đông: trong tường) là chỗ đặt
// phục binh. Lớp phủ bùn, gò (battle/ground.js setOverlay) chỉ bật ở B17. Bố cục là Hư cấu, chỉ để thử lối chơi; bản đồ "Sông, biến thể lầy" của
// canon chưa dựng. Toạ độ mét: x 0 → 600 (tây → đông), z −200 → 200 (bắc → nam), sông ở z < −168 và x > 588. Mọi con số là ĐỀ XUẤT BẢN THỬ.
//
// Luật thuần ở sim/b17.js (kiểm trong Node), phần dựng / sinh lính ở battle/director-b17.js. Đợt A2 (chưa làm): Toa Đô "bị giết" bằng clip riêng,
// Chí Tử Chiến, Phá Trận Thủy Bộ, Sĩ Khí cánh giảm theo giờ, Ô Mã Nhi và bến tàn quân, sứ giả (Kế Sách Nhỏ), vua Nhân Tông AI, Yết Kiêu.

// Bản doanh ta (HQ_TA của B15) và Hưng Đạo vương (H31, tướng AI đứng ở bản doanh: giao việc ở P1).
export const HQ = { x: 34, z: 0, r: 16 };
export const HUNG_DAO = { id: "H31", name: "Hưng Đạo vương", x: 50, z: -13, hp: 2600 };

// Lộ trình cánh Toa Đô: đường A (z −75) → qua đồn A1, A2 → cổng A3 → chéo qua đầm trong tường → mốc cửa sông (góc đông bắc). ~485 m.
export const ROUTE = [{ x: 120, z: -75 }, { x: 470, z: -75 }, { x: 525, z: -120 }, { x: 578, z: -156 }];
export const MOUTH = { x: 578, z: -156, r: 7 };                      // mốc cửa sông: đầu cánh tới đây là thua

// Cánh hành quân. speed m/s (không bị cản ~4:30 tới cửa sông), × slowPer mỗi đồn ta hạ (canon: chậm 20%). Kế hoạch đề xuất 1,1 m/s; đo bot lần đầu
// (2026-10-10): hạ đủ 3 đồn lúc ~100 s thì cánh chỉ còn 0,56 m/s, tới bãi lau tây ở phút 7, bot đứng chờ ~5 phút → 1,8. Toa Đô giao chiến với tướng (tướng trong
// engageR m quanh ông): cánh dừng, ông đánh — tối đa engageMax giây cộng dồn, rồi engageCd giây cánh đẩy tiếp dù đang bị đánh (người chơi không giam
// cánh mãi được). floorPct: Sinh lực Toa Đô không xuống dưới mức này khi cánh còn đi; chạm mức đó thì ông "đứng lại" (cánh thôi đi, sang P4).
// standSeek: đứng lại thì lên gò gần nhất trong bấy nhiêu mét (không có thì giữ chỗ). escorts: lính hộ tống đi theo cánh; officers: 2 Đội trưởng.
// Quân Viễn Chinh (canon X19, đợt A2): từ P2, cứ moraleEvery giây cánh Sĩ Khí −moraleDrop; dưới weakBelow thì lính hộ tống Công × weakMult; về 0 thì
// đội hình vỡ như khi phục kích thành công (Toa Đô đứng lại).
export const COLUMN = { speed: 1.8, slowPer: 0.8, engageR: 12, engageMax: 20, engageCd: 30, floorPct: 50, standSeek: 90, standLeash: 16, escorts: 24, officers: 2, morale: 100,
  moraleEvery: 180, moraleDrop: 10, weakBelow: 40, weakMult: 0.85 };
// Toa Đô (canon X19, đợt A2): tử trận (BigUnit fate "killed": ngã, nằm lại, không rút) và Chí Tử Chiến dưới 25% Sinh lực — Công +30%, cứ 8 s một đòn
// bổ đất sóng chấn r 6 m, báo trước 1 s, không đỡ được (BigUnit lastStand). mv: hệ số đòn (Tuyệt Kỹ tướng Nguyên là 8). first: giây tới cú bổ đầu.
export const LAST_STAND = { below: 0.25, atk: 0.3, every: 8, r: 6, mv: 4, tele: 1, first: 2 };

// Ba đồn dọc đường (đồn A1, doanh trại A2 có tường của B15; đồn 3 là vòng ở cổng A3). Chiếm: đứng trong vòng r capSec giây không có địch. Hạ trước khi
// cánh tới thì đồn chặn cánh block.sec giây ở cách tâm đồn stop m (ngoài cổng tây). hk: Hào Khí khi chiếm.
export const OUTPOSTS = [
  { id: "A1", name: "Đồn thứ nhất", x: 210, z: -75, r: 10, capSec: 5, garrison: 12, keeper: "doitruong", hk: 4, stop: 15 },
  { id: "A2", name: "Đồn thứ hai", x: 335, z: -75, r: 13, capSec: 6, garrison: 16, keeper: "photuong", hk: 6, stop: 19 },
  { id: "A3", name: "Đồn cổng", x: 462, z: -75, r: 7, capSec: 5, garrison: 10, keeper: "doitruong", hk: 4, stop: 9 },
];
export const OUTPOST_BLOCK = { sec: 15 };

// Hai bãi lau phục kích (hình chữ nhật [x0, x1] × [z0, z1]): wings — chỗ hai cánh phục binh (cách đường cánh đi ~18 m), mounds — ba gò thấp
// (đấu trường "nước ngang gối, 3 gò" của canon; gò cao h m, bán kính r m — cung thủ trên gò được thêm tầm theo luật thế đất có sẵn).
export const BEDS = [
  { id: "W", name: "Bãi lau tây", sub: "hai bên đường, trước cổng Hàm Tử quan", x0: 370, x1: 440, z0: -97, z1: -53,
    wings: [{ x: 404, z: -94 }, { x: 404, z: -56 }],
    mounds: [{ x: 382, z: -89, r: 6, h: 1.5 }, { x: 420, z: -61, r: 6, h: 1.4 }, { x: 432, z: -91, r: 7, h: 1.8 }] },
  { id: "E", name: "Bãi lau đông", sub: "trong tường, gần cửa sông", x0: 495, x1: 555, z0: -150, z1: -95,
    wings: [{ x: 536, z: -105 }, { x: 514, z: -135 }],
    mounds: [{ x: 498, z: -112, r: 6, h: 1.4 }, { x: 538, z: -148, r: 6, h: 1.6 }, { x: 547, z: -103, r: 5.5, h: 1.3 }] },
];
export const inRect = (R, x, z) => x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1;

// Phục kích: wingN lính mỗi cánh, giữ vững khi lệnh "Giữ vững" và còn ≥ holdMin người trong bãi (nới pad m). revealR: tướng trong bấy nhiêu mét quanh
// Toa Đô lúc ông vào bãi là lộ phục binh. pickSec: P1 hết giờ chưa chọn thì đặt ở defaultBed.
export const AMBUSH = { wingN: 10, holdMin: 3, pad: 6, revealR: 40, pickSec: 60, defaultBed: "W", scatter: 0.5 };

// Lớp phủ bùn (vùng đầm): dải bờ bắc, hai bãi lau; mép mềm edge m. Mặt đường A (|z − road.z| < road.half, x trong [x0, x1]) và gò không lầy.
// level 0,625 × TERRAIN.mud 0,4 = chậm 25% (canon); kỵ binh × 2 = chậm 50%.
export const MUD = { level: 0.625, edge: 4, bank: { x0: 60, x1: 590, z0: -180, z1: -140 }, road: { z: -75, half: 5, x0: 60, x1: 470 } };

// Pha. target: mục tiêu cho HUD chỉ đường (director-b17.js objectives). par giây — ĐỀ XUẤT BẢN THỬ (chưa đo bot nhiều seed). {Act:…} đổi theo thiết bị.
export const PHASES = [
  { id: "P1", name: "Bàn kế ở bản doanh", goal: "Chọn bãi lau đặt phục binh", par: 60, target: { pick: true },
    tip: "Hưng Đạo vương hỏi nên đặt phục binh ở đâu: bấm 1 (Bãi lau tây, hai bên đường trước cổng) hoặc 2 (Bãi lau đông, trong tường gần cửa sông). Hết 60 giây chưa chọn thì đặt ở bãi tây." },
  { id: "P2", name: "Đường ra biển", goal: "Hạ 3 đồn, cầm chân cánh Toa Đô", par: 240, target: { outposts: true },
    tip: "Toa Đô kéo cánh quân dọc đường đê ra cửa sông. Mỗi đồn ta hạ làm cánh chậm 20%; hạ đồn trước khi cánh tới thì đồn chặn cánh 15 giây. Đánh vào Toa Đô thì cánh dừng, tối đa 20 giây rồi lại đẩy đi. Khi Toa Đô tới gần bãi lau đã chọn, đứng xa ông ngoài 40 m kẻo lộ phục binh." },
  { id: "P3", name: "Bãi lau", goal: "Phục kích bãi lau", par: 90, target: { boss: true },
    tip: "Toa Đô đã vào bãi lau. Phục binh còn Giữ vững thì {act:kesach} trong 30 giây để đánh úp: đội hình Nguyên vỡ, Toa Đô đứng lại cố thủ. Lỡ thời cơ thì đánh Toa Đô xuống nửa Sinh lực để chặn cánh." },
  { id: "P4", name: "Chí tử chiến", goal: "Hạ Toa Đô", par: 180, target: { boss: true },
    tip: "Toa Đô từ chối rút, lên gò gần nhất cố thủ. Đứng trên gò thì đánh xuống mạnh hơn; đầm quanh gò làm chậm bước." },
  { id: "P5", name: "Áo ngự", goal: "Dẹp tàn quân", par: 30, target: { remnants: true },
    tip: "Dẹp tàn quân quanh gò, hoặc giữ chỗ 20 giây." },
];
export const PAR_B17 = PHASES.reduce((s, p) => s + p.par, 0);
export const TIMEOUT_B17 = 1800;               // an toàn: 30 phút chưa xong thì thua (canon: Toa Đô tới cửa sông là thua — luật chính)
export const REMNANTS = { r: 26, sec: 20, minSec: 2 };   // P5: không còn địch trong r m quanh gò (sau minSec giây), hoặc giữ sec giây

// Kế Sách (canon B17). Trận nhanh: cửa sổ ×0,75 như B15, B16. Đợt A1 chỉ có Phục kích bãi lau (Lớn); Hỏi kế Quốc công (Nhỏ: sứ giả, bãi thứ hai) là đợt A2.
export const KE_SACH = {
  phucKich: { id: "phucKich", name: "Phục kích bãi lau", quyMo: "lon", hk: 20, label: "Hư cấu", window: 30, morale: 40,
    text: "Cho 2 cánh phục binh Giữ vững trong bãi lau đã chọn, đứng ngoài 40 m quanh Toa Đô tới khi ông vào bãi, rồi bấm Lệnh Kế Sách trong 30 giây.",
    lore: "Toàn thư chép quân Trần đánh bại quân Nguyên ở Tây Kết, Toa Đô tử trận; phục binh trong bãi lau là cách game dựng trận đó." },
};
export const KS_ORDER = ["phucKich"];
export const REINF = { charges: 1, n: 8, cd: 60 };              // Gọi tiếp viện cho phục binh: lượt, số người, hồi (giây)

export const SIDE_MISSIONS = [
  { id: "S_AMBUSH", name: "Phục kích thành công ở một bãi lau" },
];
export const EVENTS = {};
export const FRONTS = {};
export const STORY_INSERTS = {};

export const BOSS_B17 = {
  id: "X19", name: "Toa Đô", nameHan: "唆都", tier: "tuong", rigKey: "X19", defeatMeans: "bị giết", aggro: 30,
  intro: "Toa Đô, tướng Nguyên đánh từ Chiêm Thành ra, chưa biết Thoát Hoan đã rút, kéo quân về Tây Kết định ra biển.",
};

export const HISTORY_NOTES = [
  { label: "Chính sử", text: "Toa Đô không biết Thoát Hoan đã rút, kéo quân về Tây Kết (Khoái Châu) định ra biển. Toàn thư chép quân Trần đánh bại quân Nguyên ở Tây Kết, Toa Đô tử trận; Ô Mã Nhi và tàn quân chạy ra biển." },
  { label: "Chính sử", text: "Vua Nhân Tông thương Toa Đô làm bề tôi hết lòng, cởi áo ngự sai khâm liệm ông." },
  { label: "Chính sử", text: "Sử không ghi rõ ai trực tiếp giết Toa Đô (có bài viết nói Nguyễn Khoái bắn, có tài liệu nói Hưng Đạo vương chỉ huy); game không gán công cho ai." },
  { label: "Hư cấu", text: "Bản thử dựng trên đất Hàm Tử: ba đồn, hai bãi lau, gò và mốc cửa sông đặt để thử lối chơi, không phải bố cục thật của Tây Kết. Trần Quốc Toản đứng tạm thay Nguyễn Khoái tới khi có lớp Cung." },
];
