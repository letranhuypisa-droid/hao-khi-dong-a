// data/battles.js — danh mục trận chơi được (đợt 9 lõi). Hub (main.js) dựng một thẻ Xuất trận cho mỗi mục theo
// BATTLE_ORDER; BattleDef (battles/<id>.js), comic và Sử quán của Chương nạp lười khi vào trận / mở Sử quán.
//
// Trường: chapter (khóa save.chapters), name / title / sub (thẻ hub), heroes (tướng của trận, theo canon), playable
// (tướng chọn được ở bản thử; còn lại hiện "sắp có"), ladder (dùng thang cấp trận R chung — chỉ B15), fixedR (cấp trận cố
// định), preset (tướng dựng sẵn: { level }), modes (chế độ chơi được), par (giây theo chế độ, thiếu thì MODES), wip (đang
// dựng — thẻ ghi "chơi thử").
// load() → module có default là BattleDef; comic() → module có COMIC_<id>; suquan() → module có CARDS, CARD_BY_ID,
// QUIZ_<id> (CARD_GROUPS nếu có, không thì dùng nhóm của B15); notes() → thẻ sử liệu ở màn nạp trận (dữ liệu thuần,
// không kéo three.js vào hub). loading.title: tiêu đề màn nạp. result: mặc định cho màn kết quả khi kết quả trận không tự
// ghi (res.missionsTotal, res.sideTotal, res.eventNames) — B15 giữ đúng chữ và số trước đợt 9.
// models (đợt 19c): mô hình nhân vật (assets/models/char/<id>) màn tải nạp trước ngoài tướng người chơi — tướng đồng minh, boss, kể cả khi
// ra giữa trận (main.js loadModels); rig của chúng làm nóng ở BattleDef.rigs. env(): danh sách mô hình môi trường (assets/models/env) màn tải
// nạp trước cho đất của trận — thiếu thì đất Hàm Tử (world.js WORLD_ENV).
// keSach: số Kế Sách theo chế độ (nhãn nút chế độ ở Xuất trận). Đợt 9 D5 (tùy chọn): result.cLabel (tên dòng thứ tư của
// bảng điểm — B15 "Cứ Điểm"), resultUI() → module dựng phần riêng của màn kết quả (ui/result-b20.js), marks() → tên các
// Kế Sách mang dấu "Kế đã định" khi Hiến kế chọn đúng (quyetSach.danhDau). ownHero (B16): trận R cố định mà tướng dùng chỉ số, cây kỹ năng của
// người chơi (không có preset) — chữ ở sảnh nói đúng như vậy. noComic (B16, B17): Chương chưa có comic.

export const BATTLES = {
  B15: {
    id: "B15", chapter: "B15", name: "Hàm Tử", title: "Trận Hàm Tử", date: "1285",
    sub: "Tháng 4 năm Ất Dậu · 1285 · bến Hàm Tử, sông Hồng",
    heroes: ["H35"], playable: ["H35"], ladder: true, modes: ["nhanh", "chuan"], keSach: { nhanh: 1, chuan: 2 },
    models: ["H33", "H40", "X19"],                        // Trần Nhật Duật, Nguyễn Khoái (đồng minh), Toa Đô (boss P4)
    loading: { title: "Bến Hàm Tử · 1285" },
    result: { title: "Thắng trận Hàm Tử", missionsTotal: 4, sideTotal: 2,
      eventNames: { counterA1: "Cứ Điểm bị phản công", surrounded: "Tướng ta bị vây" } },
    load: () => import("../battles/b15.js"), comic: () => import("./comic-b15.js"), suquan: () => import("./suquan-b15.js"),
    notes: () => import("./battle-b15.js").then((m) => m.HISTORY_NOTES),
  },
  // B16 (bản thử, dựng trên đất Hàm Tử): H35 Trần Quốc Toản dùng chỉ số của chính người chơi (heroStats nâng tối thiểu R − 2), R 13 cố định
  // (+3 sau B15 như thang R1), Trận nhanh. H32 Trần Quang Khải "sắp có" (chưa có mô hình, lớp cung WC09). Có thẻ Sử quán, Quiz; noComic: chưa có
  // comic (sảnh ẩn nút Comic, bảng Sử liệu nói đúng như vậy) — bỏ cờ này khi bake comic-b16.js.
  B16: {
    id: "B16", chapter: "B16", name: "Chương Dương", title: "Trận Chương Dương", date: "1285",
    sub: "Tháng 5 năm Ất Dậu · khoảng tháng 6/1285 · bến Chương Dương, kinh thành Thăng Long",
    heroes: ["H32", "H35"], playable: ["H35"], fixedR: 13, modes: ["nhanh"], wip: true, ownHero: true, noComic: true,
    models: [],                                           // Thoát Hoan mượn mô hình tướng Nguyên chung (OFF_tuong, luôn nạp)
    keSach: { nhanh: 2, chuan: 2 },                       // Đánh úp bến thuyền (Lớn), Dân binh các lộ (Nhỏ)
    par: { nhanh: 690 },                                  // = PAR_B16 của data/battle-b16.js (tổng par các pha, theo đo bot 2026-10-10)
    loading: { title: "Bến Chương Dương · 1285" },
    result: { title: "Giải phóng Thăng Long", missionsTotal: 5, sideTotal: 3, eventNames: {}, cLabel: "Thuyền, bến, cổng, điện" },
    marks: () => import("./battle-b16.js").then((m) => m.KS_ORDER.map((id) => m.KE_SACH[id].name)),
    load: () => import("../battles/b16.js"), comic: () => import("./comic-b16.js"), suquan: () => import("./suquan-b16.js"),
    notes: () => import("./battle-b16.js").then((m) => m.HISTORY_NOTES),
  },
  // B17 (bản thử, dựng trên đất Hàm Tử + lớp phủ đầm lầy): tướng của canon là H30 Trần Nhân Tông, H40 Nguyễn Khoái. Đợt A5: H40 chơi được (lớp Cung WC09),
  // dựng sẵn cấp 16 như B20 (preset — không dùng cây kỹ năng, Lò rèn của Trần Quốc Toản; H35 đứng tạm ở đợt A1–A2 đã bỏ, canon không có ông ở Tây Kết); H30
  // "sắp có" (chờ mô hình và lớp WC12) — trong trận là tướng AI dẫn cánh chính. R 16 cố định (+3 sau B16), Trận nhanh. Kế Sách Lớn Phục kích bãi lau, Nhỏ
  // Hỏi kế Quốc công (sứ giả). noComic: bỏ khi bake comic-b17.js.
  B17: {
    id: "B17", chapter: "B17", name: "Tây Kết", title: "Trận Tây Kết", date: "1285",
    sub: "20 tháng 5 năm Ất Dậu · khoảng 24/6/1285 · Tây Kết, Khoái Châu",
    heroes: ["H30", "H40"], playable: ["H40"], fixedR: 16, preset: { level: 16 }, modes: ["nhanh"], wip: true, noComic: true,
    models: ["X19", "X20", "H31", "H38"],                 // Toa Đô (boss), Ô Mã Nhi (bến tàn quân), Hưng Đạo vương (bản doanh), Yết Kiêu; vua mượn OFF_photuong (luôn nạp)
    env: () => Promise.all([import("../battle/world.js"), import("./battle-b17.js")]).then(([w, d]) => [...w.WORLD_ENV, ...d.ENV_B17]),   // đất Hàm Tử + vật đầm
    keSach: { nhanh: 2, chuan: 2 },                       // Phục kích bãi lau (Lớn), Hỏi kế Quốc công (Nhỏ)
    par: { nhanh: 320 },                                  // = PAR_B17 của data/battle-b17.js (tổng par các pha, theo đo bot H40 đợt A5 2026-10-10)
    loading: { title: "Tây Kết · 1285" },
    result: { title: "Thắng trận Tây Kết", missionsTotal: 3, sideTotal: 3, eventNames: {}, cLabel: "Đồn, bãi lau, cánh" },
    marks: () => import("./battle-b17.js").then((m) => m.KS_ORDER.map((id) => m.KE_SACH[id].name)),
    load: () => import("../battles/b17.js"), comic: () => import("./comic-b17.js"), suquan: () => import("./suquan-b17.js"),
    notes: () => import("./battle-b17.js").then((m) => m.HISTORY_NOTES),
  },
  B20: {
    id: "B20", chapter: "B20", name: "Bạch Đằng", title: "Trận Bạch Đằng", date: "9/4/1288",
    sub: "Ngày 8 tháng 3 năm Mậu Tý · 9/4/1288 · sông Bạch Đằng",
    heroes: ["H31", "H34", "H38"], playable: ["H31"], fixedR: 25, preset: { level: 25 }, modes: ["nhanh"], wip: true,
    models: ["H40", "X20", "X24"],                        // Nguyễn Khoái (vào từ pha 2), Ô Mã Nhi, Phàn Tiếp (boss)
    env: () => import("../battle/scenery-b20.js").then((m) => m.B20_ENV),     // thuyền K1–K5, tháp canh, bến, bè, cây ven sông
    keSach: { nhanh: 3, chuan: 3 },                       // 3 Kế Sách Lớn (Nội Bàng — Nhỏ, chỉ Trận chuẩn — chưa làm)
    par: { nhanh: 330 },                                  // par Trận nhanh (ĐỀ XUẤT BẢN THỬ: tổng par các pha; = PAR_B20 của director-b20.js — HUD và màn kết quả cùng số)
    loading: { title: "Sông Bạch Đằng · 1288" },
    result: { title: "Thắng trận Bạch Đằng", missionsTotal: 3, sideTotal: 2, eventNames: {}, cLabel: "Bãi cọc" },
    resultUI: () => import("../ui/result-b20.js"),
    marks: () => import("./battle-b20.js").then((m) => m.KS_ORDER.map((id) => m.KE_SACH[id].name)),
    load: () => import("../battles/b20.js"), comic: () => import("./comic-b20.js"), suquan: () => import("./suquan-b20.js"),
    notes: () => import("./battle-b20.js").then((m) => m.HISTORY_NOTES),
  },
};
export const BATTLE_ORDER = ["B15", "B16", "B17", "B20"];

// BattleDef của trận (default của module, không có thì export trùng id).
export async function loadBattleDef(id) {
  const m = await BATTLES[id].load();
  return m.default ?? m[id];
}

// Nội dung Chương: { comic, cards, cardById, quiz, groups } từ comic-<id>.js và suquan-<id>.js.
const pick = (m, prefix) => m[Object.keys(m).find((k) => k.startsWith(prefix))];
const META = {};
export async function loadChapterMeta(id) {
  if (META[id]) return META[id];
  const B = BATTLES[id], [c, s] = await Promise.all([B.comic(), B.suquan()]);
  let groups = s.CARD_GROUPS;
  if (!groups) groups = (await BATTLES.B15.suquan()).CARD_GROUPS;
  return (META[id] = { id, comic: pick(c, "COMIC_"), cards: s.CARDS, cardById: s.CARD_BY_ID, quiz: pick(s, "QUIZ_") || [], groups });
}
