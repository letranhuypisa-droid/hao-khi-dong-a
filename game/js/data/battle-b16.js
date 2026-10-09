// data/battle-b16.js — B16 Chương Dương và giải phóng Thăng Long (tháng 5 năm Ất Dậu, khoảng tháng 6/1285), bản thử đợt 1 (greybox).
//
// Canon: design/canon.json battles B16. Bản thử dựng trên đất Hàm Tử của B15 (world.js buildWorld, như chế độ Tự do): bờ sông bắc là
// bến Chương Dương, khu có tường phía đông ("Hàm Tử quan" của B15) đứng thay cho kinh thành Thăng Long — cổng B3 là cổng nam, A3 là
// cổng đông (id cổng giữ như B15 vì world.js dựng cổng theo BASES của B15). Bố cục là Hư cấu, chỉ để thử lối chơi; bản đồ "Đồng bằng
// + module cổng thành" của canon chưa dựng. Toạ độ mét: x 0 → 600 (tây → đông), z −200 → 200 (bắc → nam), sông ở z < −168 và x > 588.
// Mọi con số là ĐỀ XUẤT BẢN THỬ.
//
// Luật trận thuần ở sim/b16.js (kiểm trong Node), phần dựng / sinh lính ở battle/director-b16.js.

// Ba làng dân binh (pha 1): đứng trong vòng `hold` giây khi không có địch trong vòng thì dân binh tập hợp; mỗi làng +hk Hào Khí và
// `militia` dân binh theo tướng. Mỗi làng có một toán lính Nguyên đi lùng (`foes`).
export const VILLAGES = [
  { id: "V1", name: "Làng Đông Kết", x: 96, z: -128, r: 11, hold: 30, hk: 4, militia: 6, foes: 5 },
  { id: "V2", name: "Làng ven bãi", x: 172, z: 144, r: 12, hold: 30, hk: 4, militia: 6, foes: 6 },
  { id: "V3", name: "Làng Thường Tín", x: 262, z: 148, r: 11, hold: 30, hk: 4, militia: 6, foes: 7 },
];
export const VILLAGES_TO_ADVANCE = 2;          // canon: pha 2 mở khi đã có ≥ 2 làng (làng thứ ba vẫn gọi được tới khi chiếm bến)

// Bến Chương Dương (pha 2): 12 thuyền Nguyên neo sát bờ bắc. Đứng sát thuyền `burnSec` giây (không địch trong `clearR`) thì châm lửa.
// Bến chiếm được khi đủ 12 thuyền đã vô hiệu và đứng trong vòng bến `capSec` giây không có địch.
export const LANDING = { x: 345, z: -146, r: 16, capSec: 6, garrison: 26, officers: ["photuong", "photuong"] };
export const BOATS = Array.from({ length: 12 }, (_, i) => ({ id: `T${i + 1}`, x: 262 + i * 15, z: -173.5, yaw: Math.PI / 2 + (i % 2 ? 0.12 : -0.1) }));
export const BOAT_RULE = { burnSec: 2.5, reach: 6, clearR: 4.5, hk: 1 };

// Xe húc (pha 3): theo đường từ bến tới cổng nam. Chạy khi người đẩy còn sống, không có địch trong `stopR`; tới cổng thì húc `dps`
// độ bền cổng mỗi giây. Địch phục kích theo quãng đã đi (`ambush` atU 0..1).
export const RAM = {
  route: [{ x: 345, z: -132 }, { x: 388, z: -60 }, { x: 408, z: 40 }, { x: 438, z: 75 }, { x: 456, z: 75 }],
  speed: 3.2, stopR: 5, dps: 0.012, pushers: 4,
  ambush: [{ atU: 0.3, n: 8, from: { x: 440, z: -40 } }, { atU: 0.7, n: 10, from: { x: 445, z: 120 } }],
};

// Cổng kinh thành (id cổng của world.js). hp: độ bền gốc × S(R) như B15 (sim/front.js); cổng đông do cánh Trần Quang Khải đánh
// (mô phỏng: trừ dần `wingDps` × hp gốc mỗi giây từ khi vào pha 3).
export const GATES = {
  B3: { id: "B3", name: "Cổng nam", hp: 9000, guards: 14 },
  A3: { id: "A3", name: "Cổng đông", hp: 9000, guards: 10, wingDps: 0.006 },
};
export const GATE_SOUTH = "B3", GATE_EAST = "A3";

// Điện chính trong thành (pha 4 đánh lui Thoát Hoan ở sân trước điện, pha 5 chiếm điện).
export const PALACE = { x: 530, z: -42, r: 12, capSec: 8, guards: 18 };
export const BOSS_B16 = {
  id: "X18", name: "Thoát Hoan", nameHan: "脫歡", tier: "tuong", rigKey: "tuong", defeatMeans: "rút chạy",
  at: { x: 516, z: -30 }, retreatTo: { x: 540, z: -175 }, aggro: 40,
  intro: "Trấn Nam vương Thoát Hoan, con Hốt Tất Liệt, tổng chỉ huy quân Nguyên đang đóng ở kinh thành.",
};

// Pha. target: mục tiêu cho HUD chỉ đường (director-b16.js objectives). par: giây (ĐỀ XUẤT BẢN THỬ, chưa đo bot).
// Câu tip viết {Act:cmd}… để data/controls.js đổi sang phím của thiết bị.
export const PHASES = [
  { id: "P1", name: "Hiệu triệu dân binh", goal: "Gọi dân binh ở 2 làng", par: 150, target: { villages: true },
    tip: "Tới làng có vòng vàng, dẹp toán lính Nguyên đi lùng rồi đứng trong vòng 30 giây để dân binh tập hợp. Có 2 làng là đủ đánh bến; gọi cả 3 làng trước khi chiếm bến thì có thêm dân binh." },
  { id: "P2", name: "Đánh úp bến", goal: "Đốt 12 thuyền neo, chiếm bến Chương Dương", par: 210, target: { boats: true },
    tip: "Men theo bờ sông tới bến. Đứng sát thuyền neo (không có địch kề bên) để châm lửa. Đủ 12 thuyền thì đứng trong vòng bến để chiếm." },
  { id: "P3", name: "Cổng nam", goal: "Hộ tống xe húc, phá Cổng nam", par: 180, target: { gate: "B3" },
    tip: "Xe húc chỉ chạy khi không có địch kề bên. Tới cổng xe tự húc; đòn của bạn cũng phá được cổng. Cánh Trần Quang Khải đánh cổng đông." },
  { id: "P4", name: "Trấn Nam vương", goal: "Đánh lui Thoát Hoan", par: 120, target: { boss: true },
    tip: "Thoát Hoan đứng ở sân trước điện chính. Đánh cạn Phá Thế rồi ra Đòn Quyết; Hào Khí đầy thì kích Tổng Phản Công." },
  { id: "P5", name: "Tụng giá hoàn kinh", goal: "Chiếm điện chính", par: 60, target: { palace: true },
    tip: "Dẹp quân giữ điện, đứng trong vòng điện chính để cắm cờ." },
];
export const PAR_B16 = PHASES.reduce((s, p) => s + p.par, 0);
export const TIMEOUT_B16 = 1800;               // canon: 30 phút chưa mở cổng nam thì thua

// Kế Sách (canon B16). Trận nhanh: cửa sổ ×0,75 như B15 (kesach.js). Bản thử đợt 1: báo động khi tướng tới gần bến (chưa tách lối lau sậy /
// đường đê). danhUp: vô hiệu ≥ need thuyền trong `window` giây kể từ báo động → +hk, cổng nam mất gateCut độ bền. danBinh: đủ 3 làng trước
// khi chiếm bến → +hk, thêm `charges` lượt Gọi tiếp viện dân binh.
export const KE_SACH = {
  danhUp: { id: "danhUp", name: "Đánh úp bến thuyền", quyMo: "lon", hk: 20, label: "Chính sử", need: 9, window: 150, gateCut: 0.3,
    text: "Báo động rồi thì đốt ít nhất 9 thuyền neo trước khi hết giờ.",
    lore: "Toàn thư chép phần lớn thuyền Nguyên ở bến Chương Dương bị đốt hoặc đánh chìm." },
  danBinh: { id: "danBinh", name: "Dân binh các lộ", quyMo: "nho", hk: 10, label: "Chính sử", charges: 1,
    text: "Gọi dân binh đủ 3 làng trước khi chiếm bến.",
    lore: "Quang Khải, Quốc Toản đem dân binh các lộ đánh ở Chương Dương và kinh thành." },
};
export const KS_ORDER = ["danhUp", "danBinh"];
export const REINF = { charges: 1, n: 10, cd: 60 };             // Gọi tiếp viện dân binh: lượt gốc, số người mỗi lượt, hồi (giây)

export const SIDE_MISSIONS = [
  { id: "S_VILLAGES", name: "Gọi dân binh đủ 3 làng" },
  { id: "S_EAST", name: "Cổng đông cũng mở" },
  { id: "S_NOREVIVE", name: "Không gục lần nào" },
];
export const EVENTS = {};
export const FRONTS = {};
export const STORY_INSERTS = {};

export const HISTORY_NOTES = [
  { label: "Chính sử", text: "Tháng 5 năm Ất Dậu (1285), Thượng tướng Thái sư Trần Quang Khải cùng Hoài Văn hầu Trần Quốc Toản, Trần Thông, Nguyễn Khả Lạp và em là Nguyễn Truyền đem dân binh các lộ đánh quân Nguyên ở bến Chương Dương và ở kinh thành." },
  { label: "Chính sử", text: "Phần lớn thuyền Nguyên ở bến Chương Dương bị đốt hoặc đánh chìm; quân Trần thu hồi Thăng Long." },
  { label: "Chính sử", text: "Trần Quang Khải làm bài \"Tụng giá hoàn kinh sư\" mừng thắng, mở đầu bằng câu nói về trận Chương Dương." },
  { label: "Hư cấu", text: "Việc Thoát Hoan đích thân giữ kinh thành và ra trận ở sân điện là của game: ông đóng ở Thăng Long và rút ra sau đó, sử không chép ông đánh ở Chương Dương." },
  { label: "Hư cấu", text: "Bản thử dựng trên đất Hàm Tử: tên ba làng, chỗ bến, xe húc, cổng và điện chính đặt để thử lối chơi, không phải bố cục thật của Chương Dương và Thăng Long." },
];
