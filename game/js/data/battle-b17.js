// data/battle-b17.js — B17 Tây Kết (20 tháng 5 năm Ất Dậu, khoảng 24/6/1285), bản thử đợt A1 (greybox).
//
// Canon: design/canon.json battles B17 (H30, H40, X19, X20). Bản thử dựng trên đất Hàm Tử của B15 như B16 (Tây Kết và Hàm Tử cùng vùng
// Khoái Châu): cánh Toa Đô hành quân dọc đường A của B15 qua đồn A1, doanh trại A2 (có tường), cổng bắc A3 của Hàm Tử quan (quân Nguyên giữ, mở
// sẵn), rồi băng qua đầm trong tường ra mốc cửa sông ở góc đông bắc. Hai bãi lau (tây: hai bên đường trước cổng; đông: trong tường) là chỗ đặt
// phục binh. Lớp phủ bùn, gò (battle/ground.js setOverlay) chỉ bật ở B17. Bố cục là Hư cấu, chỉ để thử lối chơi; bản đồ "Sông, biến thể lầy" của
// canon chưa dựng. Toạ độ mét: x 0 → 600 (tây → đông), z −200 → 200 (bắc → nam), sông ở z < −168 và x > 588. Mọi con số là ĐỀ XUẤT BẢN THỬ.
//
// Luật thuần ở sim/b17.js (kiểm trong Node), phần dựng / sinh lính ở battle/director-b17.js. Đợt A2: Toa Đô tử trận, Chí Tử Chiến, Sĩ Khí cánh giảm theo
// giờ, Phá Trận Thủy Bộ (LANDING), Ô Mã Nhi và bến tàn quân (OMA, PIER), sứ giả của Kế Sách Nhỏ (ENVOY), vua Nhân Tông AI (KING), Yết Kiêu (YET_KIEU).
// Đợt A5: tướng chơi là H40 Nguyễn Khoái (lớp Cung WC09); Toa Đô chỉ "đứng lại" vì nửa Sinh lực từ P3 (xem COLUMN.floorPct).

// Bản doanh ta (HQ_TA của B15) và Hưng Đạo vương (H31, tướng AI đứng ở bản doanh: giao việc ở P1).
export const HQ = { x: 34, z: 0, r: 16 };
export const HUNG_DAO = { id: "H31", name: "Hưng Đạo vương", x: 50, z: -13, hp: 2600 };

// Lộ trình cánh Toa Đô: đường A (z −75) → qua đồn A1, A2 → cổng A3 → chéo qua đầm trong tường → mốc cửa sông (góc đông bắc). ~485 m.
export const ROUTE = [{ x: 120, z: -75 }, { x: 470, z: -75 }, { x: 525, z: -120 }, { x: 578, z: -156 }];
export const MOUTH = { x: 578, z: -156, r: 7 };                      // mốc cửa sông: đầu cánh tới đây là thua

// Cánh hành quân. speed m/s (không bị cản ~5:20 tới cửa sông), × slowPer mỗi đồn ta hạ (canon: chậm 20%). Kế hoạch đề xuất 1,1 m/s; đo bot lần đầu
// (2026-10-10): hạ đủ 3 đồn lúc ~100 s thì cánh chỉ còn 0,56 m/s, tới bãi lau tây ở phút 7, bot đứng chờ ~5 phút → 1,8. Đợt A5 (đo bot H40, có sứ giả,
// vua AI): 1,8 thì cánh vào bãi tây lúc ~140 s khi bot vừa xong sứ giả và mới hạ một đồn → 1,5. Toa Đô giao chiến với tướng (tướng trong
// engageR m quanh ông): cánh dừng, ông đánh — tối đa engageMax giây cộng dồn, rồi engageCd giây cánh đẩy tiếp dù đang bị đánh (người chơi không giam
// cánh mãi được). floorPct: Sinh lực Toa Đô không xuống dưới mức này khi cánh còn đi (khóa, viền vàng ở HUD). Chạm mức đó thì ông "đứng lại" (cánh thôi
// đi, sang P4) — nhưng chỉ từ P3 (cánh đã vào bãi lau có phục binh) và khi cửa sổ Kế Sách không đang mở (đợt A5: trước đó bot H40 bắn Toa Đô từ đồn đầu,
// ông đứng lại ở P2 và trận xong trong 94 s; ở P2 bắn ông chỉ khóa ông ở nửa Sinh lực, cánh vẫn đi — giữ đúng thứ tự pha).
// standSeek: đứng lại thì lên gò gần nhất trong bấy nhiêu mét (không có thì giữ chỗ). escorts: lính hộ tống đi theo cánh; officers: 2 Đội trưởng.
// Quân Viễn Chinh (canon X19, đợt A2): từ P2, cứ moraleEvery giây cánh Sĩ Khí −moraleDrop; dưới weakBelow thì lính hộ tống Công × weakMult; về 0 thì
// đội hình vỡ như khi phục kích thành công (Toa Đô đứng lại).
export const COLUMN = { speed: 1.5, slowPer: 0.8, engageR: 12, engageMax: 20, engageCd: 30, floorPct: 50, standSeek: 90, standLeash: 16, escorts: 24, officers: 2, morale: 100,
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

// ---- đợt A2 ---------------------------------------------------------------------------------------------------------------------
// Phá Trận Thủy Bộ (canon X19): từ P2 tới khi Toa Đô bị hạ, cứ every giây boats thuyền Nguyên đổ bộ ở điểm bờ bắc gần tướng nhất (bankPoint: dải z bank.z,
// x trong [x0, x1]), mỗi thuyền perBoat lính (canon 15 lính mô phỏng mỗi thuyền; game theo trần crowd). Tướng xa bờ quá maxD m thì lượt đó không đổ bộ;
// lính đổ bộ còn sống tối đa cap. Mất khi phục kích thành công. Thuyền: từ from m ngoài sông lao vào bờ speed m/s, cách nhau gap m, đậu stay s rồi rút.
export const LANDING = { every: 30, boats: 2, perBoat: 5, cap: 20, bank: { z: -164, x0: 90, x1: 570 }, maxD: 100, from: 28, gap: 14, speed: 6, stay: 6 };
export const bankPoint = (p) => ({ x: Math.min(LANDING.bank.x1, Math.max(LANDING.bank.x0, p.x)), z: LANDING.bank.z });
// Bến tàn quân (canon X20): cầu gỗ ở (x, z) chìa ra sông, 4 thuyền neo (docks, theo thứ tự rời bến). Từ P2, cứ every giây (lần đầu sau first giây) một
// thuyền rời bến ra luồng laneZ rồi chạy speed m/s về mốc cửa sông mark — qua mốc là hỏng nhiệm vụ phụ "không thuyền nào qua mốc". Độ bền hp × g(R)
// (tên vào thuyền × 0,3 như vào cổng). Thuyền còn neo: tướng đứng cách thuyền ≤ burnR m, không địch trong clearR m quanh mình, đủ burnSec giây thì cháy
// (như B16). Móc Tên trúng thuyền thì kéo dạt vào bờ (mắc cạn, không chạy nữa); Chặn Dòng thả trên sông chặn thuyền đang chạy (hết giờ thì đi tiếp).
export const PIER = { x: 530, z: -166, len: 11, troops: 12, r: 9,
  docks: [{ x: 545, z: -173 }, { x: 515, z: -173 }, { x: 560, z: -173 }, { x: 500, z: -173 }],
  laneZ: -178, mark: { x: 597, z: -184 }, first: 60, every: 60, speed: 1.8, hp: 600, burnR: 7, clearR: 6, burnSec: 2.5, hk: 2 };
// Ô Mã Nhi (X20) giữ bến (bậc tướng, Sinh lực riêng hp thay cho bậc — nhẹ hơn Toa Đô; dây leash m quanh bến). Về 0 Sinh lực thì rút xuống thuyền theo
// nhánh rút sẵn có của BigUnit (bị đuổi): bến thôi xuất thuyền. Nhiệm vụ phụ: đuổi ông trước deadline giây (Trận nhanh; canon phút 20 ở Trận chuẩn).
// Vào P4 mà chưa bị đuổi thì ông bỏ bến ra biển (bến cũng thôi xuất thuyền).
export const OMA = { id: "X20", name: "Ô Mã Nhi", nameHan: "烏馬兒", x: 530, z: -158, hp: 1700, leash: 16, aggro: 22, deadline: 480 };
// Sứ giả của Hưng Đạo vương (Kế Sách Nhỏ "Hỏi kế Quốc công"): đi từ làng về bản doanh theo route, speed m/s, chỉ khi tướng trong near m (như xe húc B16).
// Qua các mốc squads[].at (phần lộ trình) thì một toán n lính Nguyên từ bên đường (side m) lao ra chặn. hp: Sinh lực gốc (× g(R)); meleeMult: lính
// đánh sứ giả × bấy nhiêu (tướng đồng minh × 0,2). Về bản doanh trước khi phục kích nổ: +10 Hào Khí, bãi lau còn lại có thêm 2 cánh phục binh.
export const ENVOY = { name: "Sứ giả", route: [{ x: 160, z: 128 }, { x: 118, z: 78 }, { x: 72, z: 22 }, { x: 54, z: -4 }], speed: 2.2, near: 15, hp: 700, meleeMult: 0.35,
  squads: [{ at: 0.2, n: 6, side: 24 }, { at: 0.55, n: 6, side: -24 }] };
// Vua Trần Nhân Tông (H30) là tướng AI khi chơi Nguyễn Khoái (canon): dẫn cánh chính wing lính, tự đánh đồn chưa chiếm gần nhất (đứng trong vòng thì
// chiếm như tướng ta). Dưới fallPct% Sinh lực thì lui về bản doanh (home), tới nơi hồi healSec giây (+heal × Sinh lực tối đa) rồi quay lại. Vua gục là
// thua. Mô hình H30h (đợt năm; trước đó mượn Phó tướng nhuộm vàng), cỡ giữ như cũ: director-b17.js B17_H30.
export const KING = { id: "H30", name: "Vua Trần Nhân Tông", short: "Vua", x: 62, z: -26, hp: 2400, wing: 16, fallPct: 30, healSec: 40, heal: 0.7,
  home: { x: 42, z: -8 }, homeR: 7 };
// Yết Kiêu (H38, Tương truyền): hai lần trồi lên từ lạch đầm bên sườn cánh Toa Đô (at: giây kể từ đầu P2), cách đầu cánh side m về phía sông, hạ kills
// lính hộ tống, đục thủng một thuyền của lượt đổ bộ kế tiếp, đánh dur giây rồi lặn mất.
export const YET_KIEU = { id: "H38", name: "Yết Kiêu", at: [70, 160], side: 20, kills: 3, dur: 14, hp: 1400 };

// Lớp phủ bùn (vùng đầm): dải bờ bắc, hai bãi lau; mép mềm edge m. Mặt đường A (|z − road.z| < road.half, x trong [x0, x1]) và gò không lầy.
// level 0,625 × TERRAIN.mud 0,4 = chậm 25% (canon); kỵ binh × 2 = chậm 50%.
export const MUD = { level: 0.625, edge: 4, bank: { x0: 60, x1: 590, z0: -180, z1: -140 }, road: { z: -75, half: 5, x0: 60, x1: 470 } };

// Vật đầm (đợt A4, phần rẻ): bụi đước ở góc hai bãi lau, bè cỏ trên bãi lầy bờ bắc, lùm cây ven sông gần cửa sông — mẫu ENV nướng (assets/models/env)
// gộp một lưới ở battles/b17.js, không va chạm; chưa nạp mô hình thì bỏ (lau, gò vẫn dựng bằng code). ENV_B17: mã nạp trước thêm vào đất Hàm Tử.
export const MARSH_PROPS = [
  { id: "ENV_duoc", x: 373, z: -96, ry: 0.4, s: 1 }, { id: "ENV_duoc", x: 443, z: -99, ry: 1.9, s: 0.9 },
  { id: "ENV_duoc", x: 372, z: -54, ry: 2.8, s: 0.85 }, { id: "ENV_duoc", x: 440, z: -52, ry: 4.1, s: 1 },
  { id: "ENV_duoc", x: 497, z: -148, ry: 0.9, s: 1 }, { id: "ENV_duoc", x: 556, z: -122, ry: 3.3, s: 0.9 },
  { id: "ENV_be_co", x: 300, z: -161, ry: 1.57, s: 1 }, { id: "ENV_be_co", x: 360, z: -162, ry: 1.4, s: 1 },
  { id: "ENV_be_co", x: 420, z: -161, ry: 1.7, s: 0.9 }, { id: "ENV_be_co", x: 520, z: -162, ry: 1.5, s: 1 },
  { id: "ENV_lum_cay_ven_song", x: 562, z: -160, ry: 0.5, s: 1 }, { id: "ENV_lum_cay_ven_song", x: 548, z: -163, ry: 2.2, s: 0.9 },
];
// Bến tàn quân, thuyền: ENV_ben_go, ENV_thuyen_song_nguyen (thuyền neo, thuyền rời bến), ENV_thuyen_mui (thuyền đổ bộ) đã có trong đất Hàm Tử; thêm tời
// neo cạnh bến và phao (chuỗi Chặn Dòng thả trên sông).
export const ENV_B17 = [...new Set([...MARSH_PROPS.map((p) => p.id), "ENV_toi_neo", "ENV_phao_moc"])];

// Pha. target: mục tiêu cho HUD chỉ đường (director-b17.js objectives). {Act:…} đổi theo thiết bị. par giây — ĐỀ XUẤT BẢN THỬ theo đo bot đợt A5 (2026-10-10,
// H40 dựng sẵn cấp 16, Trận nhanh, seed 1001 / 2002 / 3003): Quân sĩ thắng 252 / 246 / 252 s, Tướng quân 249 / 292 / 281 s, không tải lại, cả hai Kế Sách thành
// công. Bot chọn bãi ngay (P1 5 s), cánh vào bãi tây lúc ~178 s (P2 do tốc cánh quyết), phục kích nổ ngay khi mở cửa sổ, Toa Đô đổ trong 47–96 s, P5 3–20 s.
export const PHASES = [
  { id: "P1", name: "Bàn kế ở bản doanh", goal: "Chọn bãi lau đặt phục binh", par: 20, target: { pick: true },
    tip: "Hưng Đạo vương hỏi nên đặt phục binh ở đâu: bấm 1 (Bãi lau tây, hai bên đường trước cổng) hoặc 2 (Bãi lau đông, trong tường gần cửa sông). Hết 60 giây chưa chọn thì đặt ở bãi tây." },
  { id: "P2", name: "Đường ra biển", goal: "Hạ 3 đồn, cầm chân cánh Toa Đô", par: 180, target: { outposts: true },
    tip: "Toa Đô kéo cánh quân dọc đường đê ra cửa sông. Mỗi đồn ta hạ làm cánh chậm 20%; hạ đồn trước khi cánh tới thì đồn chặn cánh 15 giây. Đánh vào Toa Đô thì cánh dừng, tối đa 20 giây rồi lại đẩy đi; trước khi ông vào bãi lau, đánh ông chỉ tới nửa Sinh lực. Vua Nhân Tông dẫn cánh chính tự đánh đồn: vua gục là thua. Sứ giả chờ ở làng phía nam: đi cạnh để đưa về bản doanh (Kế Sách Nhỏ). Khi Toa Đô tới gần bãi lau đã chọn, đứng xa ông ngoài 40 m kẻo lộ phục binh." },
  { id: "P3", name: "Bãi lau", goal: "Phục kích bãi lau", par: 20, target: { boss: true },
    tip: "Toa Đô đã vào bãi lau. Phục binh còn Giữ vững thì {act:kesach} trong 30 giây để đánh úp: đội hình Nguyên vỡ, Toa Đô đứng lại cố thủ. Lỡ thời cơ thì đánh Toa Đô xuống nửa Sinh lực để chặn cánh." },
  { id: "P4", name: "Chí tử chiến", goal: "Hạ Toa Đô", par: 80, target: { boss: true },
    tip: "Toa Đô từ chối rút, lên gò gần nhất cố thủ. Đứng trên gò thì đánh xuống mạnh hơn; đầm quanh gò làm chậm bước. Ô Mã Nhi bỏ bến ra biển." },
  { id: "P5", name: "Áo ngự", goal: "Dẹp tàn quân", par: 20, target: { remnants: true },
    tip: "Dẹp tàn quân quanh gò, hoặc giữ chỗ 20 giây." },
];
export const PAR_B17 = PHASES.reduce((s, p) => s + p.par, 0);
export const TIMEOUT_B17 = 1800;               // an toàn: 30 phút chưa xong thì thua (canon: Toa Đô tới cửa sông là thua — luật chính)
export const REMNANTS = { r: 26, sec: 20, minSec: 2 };   // P5: không còn địch trong r m quanh gò (sau minSec giây), hoặc giữ sec giây

// Kế Sách (canon B17). Trận nhanh: cửa sổ ×0,75 như B15, B16. Lớn: Phục kích bãi lau. Nhỏ (đợt A2): Hỏi kế Quốc công — hộ tống sứ giả về bản doanh trước khi
// phục kích nổ (ENVOY); thành công thì bãi còn lại có thêm 2 cánh phục binh: phục kích lần đầu hỏng thì còn lần thứ hai (thành công tối đa một lần).
export const KE_SACH = {
  phucKich: { id: "phucKich", name: "Phục kích bãi lau", quyMo: "lon", hk: 20, label: "Hư cấu", window: 30, morale: 40,
    text: "Cho 2 cánh phục binh Giữ vững trong bãi lau đã chọn, đứng ngoài 40 m quanh Toa Đô tới khi ông vào bãi, rồi bấm Lệnh Kế Sách trong 30 giây.",
    lore: "Toàn thư chép quân Trần đánh bại quân Nguyên ở Tây Kết, Toa Đô tử trận; phục binh trong bãi lau là cách game dựng trận đó." },
  hoiKe: { id: "hoiKe", name: "Hỏi kế Quốc công", quyMo: "nho", hk: 10, label: "Hư cấu",
    text: "Đi cạnh sứ giả (trong 15 m) từ làng phía nam về bản doanh, trước khi phục kích nổ. Thành công: bãi lau còn lại có thêm 2 cánh phục binh.",
    lore: "Việc vua hỏi kế Hưng Đạo vương có thật nhưng sử ghi năm 1287; đặt ở Tây Kết là Hư cấu về bối cảnh." },
};
export const KS_ORDER = ["phucKich", "hoiKe"];
export const REINF = { charges: 1, n: 8, cd: 60 };              // Gọi tiếp viện cho phục binh: lượt, số người, hồi (giây)

export const SIDE_MISSIONS = [
  { id: "S_AMBUSH", name: "Phục kích thành công ở một bãi lau" },
  { id: "S_OMA", name: "Đuổi Ô Mã Nhi khỏi bến trước 8:00" },
  { id: "S_BOATS", name: "Không thuyền tàn quân nào qua mốc cửa sông" },
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
  { label: "Hư cấu", text: "Bản thử dựng trên đất Hàm Tử: ba đồn, hai bãi lau, gò, bến tàn quân và mốc cửa sông đặt để thử lối chơi, không phải bố cục thật của Tây Kết." },
  { label: "Hư cấu", text: "Vua Nhân Tông tự dẫn cánh chính đánh đồn là cách game dựng khi người chơi cầm Nguyễn Khoái; chưa có mô hình vua nên mượn tạm hình một tướng mặc áo vàng." },
  { label: "Hư cấu", text: "Sứ giả đi hỏi kế Hưng Đạo vương ngay trước trận là Hư cấu về bối cảnh: việc hỏi kế được ghi năm 1287." },
  { label: "Tương truyền", text: "Yết Kiêu lặn giỏi, đục thuyền giặc là chuyện dân gian truyền lại; game cho ông trồi lên từ lạch đầm hai lần." },
];
