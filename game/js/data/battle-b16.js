// data/battle-b16.js — B16 Chương Dương và giải phóng Thăng Long (tháng 5 năm Ất Dậu, khoảng tháng 6/1285), bản thử đợt 1 (greybox).
//
// Canon: design/canon.json battles B16. Bản thử dựng trên đất Hàm Tử của B15 (world.js buildWorld, như chế độ Tự do): bờ sông bắc là
// bến Chương Dương, khu có tường phía đông ("Hàm Tử quan" của B15) đứng thay cho kinh thành Thăng Long — cổng B3 là cổng nam, A3 là
// cổng đông (id cổng giữ như B15 vì world.js dựng cổng theo BASES của B15). Bố cục là Hư cấu, chỉ để thử lối chơi; bản đồ "Đồng bằng
// + module cổng thành" của canon chưa dựng. Toạ độ mét: x 0 → 600 (tây → đông), z −200 → 200 (bắc → nam), sông ở z < −168 và x > 588.
// Mọi con số là ĐỀ XUẤT BẢN THỬ.
//
// Luật trận thuần ở sim/b16.js (kiểm trong Node), phần dựng / sinh lính ở battle/director-b16.js.

// Ba làng dân binh (pha 1): đứng trong vòng `hold` giây khi không có địch trong vòng thì dân binh tập hợp (ra khỏi vòng thì tiến độ giữ nguyên);
// canon ghi 30 s, người chơi thử thấy quá lâu (2026-10-10) → 12 s. Mỗi làng +hk Hào Khí và
// `militia` dân binh theo tướng. Mỗi làng có một toán lính Nguyên đi lùng (`foes`).
export const VILLAGES = [
  { id: "V1", name: "Làng Đông Kết", x: 96, z: -128, r: 11, hold: 12, hk: 4, militia: 6, foes: 5 },
  { id: "V2", name: "Làng ven bãi", x: 172, z: 144, r: 12, hold: 12, hk: 4, militia: 6, foes: 6 },
  { id: "V3", name: "Làng Thường Tín", x: 262, z: 148, r: 11, hold: 12, hk: 4, militia: 6, foes: 7 },
];
export const VILLAGES_TO_ADVANCE = 2;          // canon: pha 2 mở khi đã có ≥ 2 làng (làng thứ ba vẫn gọi được tới khi chiếm bến)

// Bến Chương Dương (pha 2): 12 thuyền Nguyên neo sát bờ bắc. Đứng sát thuyền `burnSec` giây (không địch trong `clearR`) thì châm lửa.
// Bến chiếm được khi đủ 12 thuyền đã vô hiệu và đứng trong vòng bến `capSec` giây không có địch.
export const LANDING = { x: 345, z: -146, r: 16, capSec: 6, garrison: 28, officers: ["photuong", "photuong"] };
export const BOATS = Array.from({ length: 12 }, (_, i) => ({ id: `T${i + 1}`, x: 262 + i * 15, z: -173.5, yaw: Math.PI / 2 + (i % 2 ? 0.12 : -0.1) }));
export const BOAT_RULE = { burnSec: 2.5, reach: 6, clearR: 4.5, hk: 1 };

// Lối tiếp cận bến (đợt 2, canon Kế Sách "tiếp cận bến từ hướng lau sậy, không qua đê"). Hình chữ nhật [x0, x1] × [z0, z1].
// Báo động khi: tướng bước lên đê; hoặc lính Nguyên thấy tướng ở gần bến (seeR m — trong lau sậy chỉ reedSeeR m); hoặc thuyền đầu tiên bốc cháy.
// near: chỉ xét "bị thấy" khi tướng trong near m quanh bến (toán lùng ở làng không báo động bến).
export const REEDS = [{ x0: 232, x1: 330, z0: -172, z1: -155 }, { x0: 362, x1: 446, z0: -172, z1: -155 }];   // dải bờ hai bên cầu bến (chỗ thuyền neo)
export const DYKE = { x0: 300, x1: 396, z0: -126, z1: -118, h: 1.1 };
export const ALARM = { seeR: 14, reedSeeR: 3.5, near: 100 };
export const inRect = (R, x, z) => x >= R.x0 && x <= R.x1 && z >= R.z0 && z <= R.z1;

// Hai kho quân nhu trên bến (nhiệm vụ phụ canon "không để kho quân nhu trên bến bị địch tự đốt"): torchDelay giây sau báo động, mỗi kho
// `torches` lính cầm đuốc chạy tới; đứng sát kho (r) đủ burnSec giây thì kho cháy. Hạ lính cầm đuốc là giữ được kho.
export const DEPOTS = [{ id: "K1", name: "Kho quân nhu tây", x: 316, z: -134 }, { id: "K2", name: "Kho quân nhu đông", x: 376, z: -134 }];
export const DEPOT_RULE = { torchDelay: 12, torches: 2, r: 3, burnSec: 10 };

// Đoạt Giáo (nhiệm vụ phụ canon "tước vũ khí 10 đội lính giữ bến"): quân giữ bến chia đội; đội nào bị hạ hết người là bị tước (bản thử —
// kỹ năng "Đoạt Giáo Chương Dương" của Trần Quang Khải chưa có).
export const SQUADS = { landing: 7, size: 4, sentryPairs: 4, need: 10 };

// Phản công vào bến (pha 3, canon "Mất bến Chương Dương sau khi đã chiếm" là thua): `at` giây sau khi chiếm bến, n lính Nguyên đổ bộ.
// Sức giữ bến 100 → 0: mỗi giây trừ drainPer × min(địch trong vòng − người giữ, cap) (người giữ: lính ta trong vòng, tướng tính 2; bến trống
// cũng theo công thức này) — tối đa drainPer × cap mỗi giây, tức ≥ 100 / (drainPer × cap) giây để mất bến (đủ thời gian quay về).
// keepMilitia dân binh tự ở lại giữ bến lúc chiếm. Đo bot lần đầu (0,9 / s mỗi lính, không trần): mất bến sau 24 s khi đang hộ tống xe húc.
export const COUNTER = { at: 60, n: 12, dur: 90, from: { x: 345, z: -171 }, drainPer: 0.25, cap: 6, keepMilitia: 8, hk: 6 };   // dur: giữ được bến chừng ấy giây thì quân phản công rút

// Vương Kỳ Trấn Nam (đợt 3, canon X18): 3 cờ quanh sân điện. Còn cờ đứng thì Thoát Hoan không xuống dưới floorPct% Sinh lực (khiên
// vương giả); phá đủ 3 cờ thì đánh lui được. Cờ bị chém bằng đòn của tướng (hp gốc × S(R)). Lần đầu chạm sàn: gọi hộ vệ (Hộ Vệ Hoàng Tử).
export const BANNERS = [{ id: "VK1", x: 486, z: -70 }, { id: "VK2", x: 566, z: -62 }, { id: "VK3", x: 500, z: 6 }];   // rìa sân, 39–58 m quanh Thoát Hoan
export const BANNER_RULE = { hp: 1500, r: 1.6, floorPct: 50, guards: 8, hk: 3 };

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
  id: "X18", name: "Thoát Hoan", nameHan: "脫歡", tier: "tuong", rigKey: "X18", defeatMeans: "rút chạy",
  at: { x: 516, z: -30 }, retreatTo: { x: 540, z: -175 }, aggro: 40,
  intro: "Trấn Nam vương Thoát Hoan, con Hốt Tất Liệt, tổng chỉ huy quân Nguyên đang đóng ở kinh thành.",
};

// Pha. target: mục tiêu cho HUD chỉ đường (director-b16.js objectives). par: giây — ĐỀ XUẤT BẢN THỬ theo đo bot 2026-10-10 (Quân sĩ seed 1001 / 2002:
// 554 / 594 s, Tướng quân 3003: 622 s + 2 lần tải lại; pha 3 tốn nhất 190–295 s, pha 5 chỉ 4–9 s vì quân giữ điện đã bị dọn lúc đánh Thoát Hoan).
// Câu tip viết {Act:cmd}… để data/controls.js đổi sang phím của thiết bị.
export const PHASES = [
  { id: "P1", name: "Hiệu triệu dân binh", goal: "Gọi dân binh ở 2 làng", par: 120, target: { villages: true },
    tip: "Tới làng có vòng vàng, dẹp toán lính Nguyên đi lùng rồi đứng trong vòng 12 giây để dân binh tập hợp (vòng vàng trên đất đầy dần, ra khỏi vòng thì giữ nguyên tiến độ). Có 2 làng là đủ đánh bến; gọi cả 3 làng trước khi chiếm bến thì có thêm dân binh." },
  { id: "P2", name: "Đánh úp bến", goal: "Đốt 12 thuyền neo, chiếm bến Chương Dương", par: 210, target: { boats: true },
    tip: "Đi trong lau sậy ven sông để lính canh khó thấy; bước lên đê là bến báo động. Đứng sát thuyền neo (không có địch kề bên) để châm lửa. Báo động rồi thì quân Nguyên chạy đi đốt kho: hạ lính cầm đuốc. Đủ 12 thuyền thì đứng trong vòng bến để chiếm." },
  { id: "P3", name: "Cổng nam", goal: "Hộ tống xe húc, phá Cổng nam", par: 240, target: { gate: "B3" },
    tip: "Xe húc chỉ chạy khi không có địch kề bên. Tới cổng xe tự húc; đòn của bạn cũng phá được cổng. Quân Nguyên sẽ phản công bến: sức giữ bến về 0 là thua. Cánh Trần Quang Khải đánh cổng đông." },
  { id: "P4", name: "Trấn Nam vương", goal: "Đánh lui Thoát Hoan", par: 90, target: { boss: true },
    tip: "Ba lá Vương Kỳ quanh sân điện giữ khiên cho Thoát Hoan: còn cờ đứng thì ông không núng quá nửa Sinh lực. Chém đổ cả ba cờ rồi đánh lui ông." },
  { id: "P5", name: "Tụng giá hoàn kinh", goal: "Chiếm điện chính", par: 30, target: { palace: true },
    tip: "Dẹp quân giữ điện, đứng trong vòng điện chính để cắm cờ." },
];
export const PAR_B16 = PHASES.reduce((s, p) => s + p.par, 0);
export const TIMEOUT_B16 = 1800;               // canon: 30 phút chưa mở cổng nam thì thua

// Kế Sách (canon B16). Trận nhanh: cửa sổ ×0,75 như B15 (kesach.js). Báo động bến: xem ALARM, REEDS, DYKE ở trên (đợt 2: lối lau sậy /
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
  { id: "S_DISARM", name: "Tước vũ khí 10 đội lính giữ bến" },
  { id: "S_DEPOTS", name: "Giữ được cả hai kho quân nhu trên bến" },
];
export const EVENTS = { counter: { name: "Quân Nguyên phản công bến" } };
export const FRONTS = {};
export const STORY_INSERTS = {};

export const HISTORY_NOTES = [
  { label: "Chính sử", text: "Tháng 5 năm Ất Dậu (1285), Thượng tướng Thái sư Trần Quang Khải cùng Hoài Văn hầu Trần Quốc Toản, Trần Thông, Nguyễn Khả Lạp và em là Nguyễn Truyền đem dân binh các lộ đánh quân Nguyên ở bến Chương Dương và ở kinh thành." },
  { label: "Chính sử", text: "Phần lớn thuyền Nguyên ở bến Chương Dương bị đốt hoặc đánh chìm; quân Trần thu hồi Thăng Long." },
  { label: "Chính sử", text: "Trần Quang Khải làm bài \"Tụng giá hoàn kinh sư\" mừng thắng, mở đầu bằng câu nói về trận Chương Dương." },
  { label: "Hư cấu", text: "Việc Thoát Hoan đích thân giữ kinh thành và ra trận ở sân điện là của game: ông đóng ở Thăng Long và rút ra sau đó, sử không chép ông đánh ở Chương Dương." },
  { label: "Hư cấu", text: "Bản thử dựng trên đất Hàm Tử: tên ba làng, chỗ bến, xe húc, cổng và điện chính đặt để thử lối chơi, không phải bố cục thật của Chương Dương và Thăng Long." },
];
