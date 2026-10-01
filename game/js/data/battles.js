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
// keSach: số Kế Sách theo chế độ (nhãn nút chế độ ở Xuất trận). Đợt 9 D5 (tùy chọn): result.cLabel (tên dòng thứ tư của
// bảng điểm — B15 "Cứ Điểm"), resultUI() → module dựng phần riêng của màn kết quả (ui/result-b20.js), marks() → tên các
// Kế Sách mang dấu "Kế đã định" khi Hiến kế chọn đúng (quyetSach.danhDau).

export const BATTLES = {
  B15: {
    id: "B15", chapter: "B15", name: "Hàm Tử", title: "Trận Hàm Tử", date: "1285",
    sub: "Tháng 4 năm Ất Dậu · 1285 · bến Hàm Tử, sông Hồng",
    heroes: ["H35"], playable: ["H35"], ladder: true, modes: ["nhanh", "chuan"], keSach: { nhanh: 1, chuan: 2 },
    loading: { title: "Bến Hàm Tử · 1285" },
    result: { title: "Thắng trận Hàm Tử", missionsTotal: 4, sideTotal: 2,
      eventNames: { counterA1: "Cứ Điểm bị phản công", surrounded: "Tướng ta bị vây" } },
    load: () => import("../battles/b15.js"), comic: () => import("./comic-b15.js"), suquan: () => import("./suquan-b15.js"),
    notes: () => import("./battle-b15.js").then((m) => m.HISTORY_NOTES),
  },
  B20: {
    id: "B20", chapter: "B20", name: "Bạch Đằng", title: "Trận Bạch Đằng", date: "9/4/1288",
    sub: "Ngày 8 tháng 3 năm Mậu Tý · 9/4/1288 · sông Bạch Đằng",
    heroes: ["H31", "H34", "H38"], playable: ["H31"], fixedR: 25, preset: { level: 25 }, modes: ["nhanh"], wip: true,
    keSach: { nhanh: 3, chuan: 3 },                       // 3 Kế Sách Lớn (Nội Bàng — Nhỏ, chỉ Trận chuẩn — chưa làm)
    par: { nhanh: 780 },                                  // par Trận nhanh 13 phút (canon B20; = PAR_B20 của director-b20.js — HUD và màn kết quả cùng số)
    loading: { title: "Sông Bạch Đằng · 1288" },
    result: { title: "Thắng trận Bạch Đằng", missionsTotal: 6, sideTotal: 4, eventNames: {}, cLabel: "Hộ vệ, mốc cọc" },
    resultUI: () => import("../ui/result-b20.js"),
    marks: () => import("./battle-b20.js").then((m) => m.KS_ORDER.map((id) => m.KE_SACH[id].name)),
    load: () => import("../battles/b20.js"), comic: () => import("./comic-b20.js"), suquan: () => import("./suquan-b20.js"),
    notes: () => import("./battle-b20.js").then((m) => m.HISTORY_NOTES),
  },
};
export const BATTLE_ORDER = ["B15", "B20"];

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
