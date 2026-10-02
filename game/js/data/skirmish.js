// data/skirmish.js — giao tranh sinh theo seed của chế độ Tự do (đợt 14): 6 loại nhiệm vụ trên đất Hàm Tử (dùng lại bản đồ B15),
// quy mô theo bậc người lính, bảng nhiệm vụ mỗi trận. Thuần (core/rng.js + data/career.js), kiểm trong Node: tests/skirmish.test.mjs.
// Bộ điều phối trận (battle/director-td.js) đọc đúng đối tượng makeSkirmish trả về. Khu đánh, số lính, giờ là ĐỀ XUẤT BẢN THỬ;
// nhiệm vụ và khu đánh là Hư cấu (đặt trên bố cục thử của B15).
//
// Luật chung: địch kéo tới từ MỘT cửa vào (entry, cắm cờ trên bản đồ và ngoài trận) cách khu ≥ 45 m — không bật ra cạnh người chơi;
// người lính xuất phát (spawn) cách cửa vào ≥ 40 m. Toạ độ: x 0 → 600 (tây → đông), z −200 → 200; sông ở bắc (z −168) và đông,
// tường tây Hàm Tử quan x 462 — mọi điểm ở trong x 20–450, z −160–185.

import { makeRng } from "../core/rng.js";
import { RANKS, PICKS } from "./career.js";

export const SITES = {
  donA:    { id: "donA", name: "Đồn bến trên", x: 210, z: -75, r: 10 },
  donB:    { id: "donB", name: "Đồn bến dưới", x: 210, z: 75, r: 10 },
  traiA:   { id: "traiA", name: "Doanh trại trên bãi", x: 335, z: -75, r: 13 },
  traiB:   { id: "traiB", name: "Doanh trại bến dưới", x: 335, z: 75, r: 13 },
  lang:    { id: "lang", name: "Làng ven sông", x: 172, z: 144, r: 26 },
  dong:    { id: "dong", name: "Đồng giữa hai bến", x: 270, z: 0, r: 20 },
  benSong: { id: "benSong", name: "Bãi bến sông", x: 150, z: -135, r: 18 },
};

// goal: một dòng mục tiêu (thẻ nhiệm vụ). how: câu "làm thế nào" (thẻ mở rộng). base: danh tiếng gốc khi thắng (× hệ số bậc).
export const MISSIONS = {
  giudon:     { id: "giudon", name: "Giữ đồn", minRank: 0, base: 60, goal: "Giữ đồn tới khi hết giờ",
    how: "Quân Nguyên kéo tới từng đợt từ cửa vào có cờ. Đứng trong vòng đồn: địch vào vòng mà không ai cản thì sức giữ đồn tụt; về 0 là mất đồn." },
  danhup:     { id: "danhup", name: "Đánh úp trại", minRank: 0, base: 70, goal: "Đốt 3 lều lương trong trại địch",
    how: "Lẻn vào trại, đứng sát lều vài giây để châm lửa (không có địch kề bên). Quân cứu viện sẽ kéo tới từ cửa vào." },
  chantiepte: { id: "chantiepte", name: "Chặn tiếp tế", minRank: 0, base: 65, goal: "Chặn đoàn xe lương trước khi vào trại",
    how: "Hạ người kéo xe thì xe dừng và cháy. Lính áp tải đi kèm từng xe. Xe nào vào tới trại là hỏng nhiệm vụ." },
  hotong:     { id: "hotong", name: "Hộ tống", minRank: 1, base: 65, goal: "Đưa xe lương về tới bản doanh",
    how: "Xe tự đi theo đường; địch phục kích từ phía đông. Địch kề bên thì xe dừng và bị phá — dẹp chúng để xe đi tiếp." },
  cuudongdoi: { id: "cuudongdoi", name: "Cứu đồng đội", minRank: 1, base: 75, goal: "Cởi trói cho đồng đội rồi đưa về chỗ hẹn",
    how: "Đồng đội bị trói giữa quân canh. Đứng cạnh từng người vài giây để cởi trói; người được cứu đi theo bạn. Về tới cờ hẹn là xong." },
  dautuong:   { id: "dautuong", name: "Đấu tướng", minRank: 2, base: 85, goal: "Thắng trận thách đấu giữa vòng quân",
    how: "Vào vòng quân để bắt đầu. Đánh cạn Phá Thế của đối thủ rồi ra Đòn Quyết. Quân hai bên đứng xem, không ai xen vào." },
};
export const MISSION_ORDER = ["giudon", "danhup", "chantiepte", "hotong", "cuudongdoi", "dautuong"];

const SIDE = {
  noRevive: { id: "noRevive", name: "Không gục lần nào" },
  holdHigh: { id: "holdHigh", name: "Đồn còn trên 60% sức giữ" },
  keeper:   { id: "keeper", name: "Hạ sĩ quan giữ trại" },
  escorts:  { id: "escorts", name: "Hạ hết lính áp tải" },
  cartHp:   { id: "cartHp", name: "Xe lương còn trên 70%" },
  allSaved: { id: "allSaved", name: "Cứu đủ mọi người" },
  parry:    { id: "parry", name: "Phản đòn 2 lần" },
};
const fast = (par) => ({ id: "fast", name: `Xong trong ${Math.floor(par / 60)}:${String(par % 60).padStart(2, "0")}`, par });
const P = (x, z) => ({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
const officersFor = (rank, { base = "doitruong", big = 3 } = {}) => [...(rank >= 1 ? [base] : []), ...(rank >= big ? ["photuong"] : []), ...(rank >= 4 ? ["doitruong"] : [])];

// Một giao tranh. Thứ tự rút rng giữ cố định cho mọi bậc (chọn khu trước, rồi số ngẫu nhiên của từng đợt) để bậc cao chỉ thêm, không
// xáo lại phần đã có (kiểm thử: quy mô không giảm khi lên bậc).
export function makeSkirmish(seed, rank, type) {
  const rng = makeRng((seed >>> 0) ^ 0x9e3779b9), M = MISSIONS[type];
  const out = { seed: seed >>> 0, type, name: M.name, goal: M.goal, how: M.how, base: M.base, rank, R: RANKS[rank].level,
    allies: 0, officers: [], enemyTotal: 0, side: [], points: [] };
  const rnd = [];                                       // 8 số ngẫu nhiên rút trước cho các đợt / toán
  const pickSite = (ids) => SITES[ids[Math.floor(rng.next() * ids.length)]];
  if (type === "giudon") {
    const S = pickSite(["donA", "donB"]), dz = rng.range(-15, 15);
    for (let i = 0; i < 8; i++) rnd.push(rng.int(0, 2));
    out.siteId = S.id; out.site = P(S.x, S.z); out.entry = P(S.x + 80, S.z + dz); out.spawn = P(S.x - 4, S.z);
    out.hold = Math.min(210, 150 + 15 * rank); out.timeLimit = out.hold + 60;
    const nW = 3 + (rank >= 2) + (rank >= 4), offs = officersFor(rank);
    out.waves = Array.from({ length: nW }, (_, i) => ({ at: Math.round(8 + (i * (out.hold - 40)) / nW), n: 6 + 2 * rank + rnd[i], archers: 0.3, elite: 0.05 + 0.05 * rank,
      officers: i === nW - 1 ? offs : [], from: P(out.entry.x + (i % 2 ? 4 : -4), out.entry.z + ((i * 7) % 9) - 4) }));
    out.allies = 4 + 2 * rank; out.ring = S.r;
    out.side = [SIDE.noRevive, SIDE.holdHigh];
  } else if (type === "danhup") {
    const S = pickSite(["traiA", "traiB"]), dz = rng.range(-12, 12), sz = rng.range(-20, 20), a0 = rng.range(0, Math.PI * 2);
    for (let i = 0; i < 8; i++) rnd.push(rng.int(0, 2));
    out.siteId = S.id; out.site = P(S.x, S.z); out.entry = P(S.x + 85, S.z + dz); out.spawn = P(S.x - 95, S.z + sz);
    const keeperTier = rank >= 3 ? "photuong" : rank >= 1 ? "doitruong" : null;
    out.camp = { center: out.site, r: S.r, tents: [0, 1, 2].map((k) => P(S.x + Math.cos(a0 + k * 2.1) * 8, S.z + Math.sin(a0 + k * 2.1) * 8)),
      garrison: 10 + 4 * rank + rnd[0], keeper: keeperTier };
    out.officers = [...(keeperTier ? [keeperTier] : []), ...(rank >= 4 ? ["doitruong"] : [])];
    out.reinf = { first: 60, every: 40, n: 4 + rank };
    out.timeLimit = Math.min(360, 300 + 15 * rank);
    out.waves = [0, 1, 2, 3].map((i) => ({ at: out.reinf.first + i * out.reinf.every, n: out.reinf.n + rnd[1 + i], archers: 0.3, elite: 0.1, officers: [], from: P(out.entry.x, out.entry.z + (i % 2 ? 5 : -5)) }));
    out.side = [keeperTier ? SIDE.keeper : fast(180), SIDE.noRevive];
  } else if (type === "chantiepte") {
    const z0 = rng.pick([-28, 0, 28]), sp = rng.range(-30, 30);
    for (let i = 0; i < 8; i++) rnd.push(rng.int(0, 1));
    const S = SITES.dong; out.siteId = S.id; out.site = P(S.x, S.z);
    out.entry = P(440, z0); out.spawn = P(205, z0 + sp);
    const carts = 2 + (rank >= 2) + (rank >= 4);
    out.convoy = { route: [P(440, z0), P(372, z0 * 0.6), P(S.x, S.z)], speed: 1.3, gap: 9, carts,
      escorts: Array.from({ length: carts }, (_, i) => 3 + rank + rnd[i]), lead: officersFor(rank) };
    out.officers = out.convoy.lead;
    out.timeLimit = Math.min(360, 240 + 15 * rank);
    out.side = [SIDE.escorts, fast(180)];
  } else if (type === "hotong") {
    const S = SITES.lang; out.siteId = S.id; out.site = P(S.x, S.z);
    const ez = rng.range(80, 105);
    for (let i = 0; i < 8; i++) rnd.push(rng.int(0, 2));
    out.entry = P(255, ez); out.spawn = P(146, 122);
    const route = [P(150, 118), P(112, 82), P(72, 42), P(46, 14)];
    const nA = 2 + (rank >= 2) + (rank >= 4), offs = officersFor(rank);
    out.escort = { route, speed: 1.25, cartHp: 100, start: route[0], dest: route[route.length - 1],
      ambush: Array.from({ length: nA }, (_, i) => ({ atU: 0.15 + (0.7 * i) / Math.max(1, nA - 1), n: 5 + 2 * rank + rnd[i], officers: i === nA - 1 ? offs : [] })) };
    out.waves = out.escort.ambush.map((a, i) => ({ at: null, atU: a.atU, n: a.n, archers: 0.35, elite: 0.1, officers: a.officers, from: P(out.entry.x + (i % 2 ? 4 : -4), out.entry.z + (i % 3) * 4 - 4) }));
    out.timeLimit = 300;
    out.side = [SIDE.cartHp, SIDE.noRevive];
  } else if (type === "cuudongdoi") {
    const S = pickSite(["benSong", "lang"]);
    for (let i = 0; i < 8; i++) rnd.push(rng.int(0, 2));
    out.siteId = S.id; out.site = P(S.x, S.z);
    out.entry = S.id === "benSong" ? P(240, -140) : P(255, 120);
    out.spawn = S.id === "benSong" ? P(70, -80) : P(80, 100);
    const nC = 3 + (rank >= 2), a0 = rng.range(0, Math.PI * 2);
    out.captives = { at: out.site, people: Array.from({ length: nC }, (_, k) => P(S.x + Math.cos(a0 + k * 1.6) * 4, S.z + Math.sin(a0 + k * 1.6) * 4)),
      guards: 8 + 3 * rank + rnd[0], rally: out.spawn, freeSec: 2.5 };
    out.officers = officersFor(rank);
    out.waves = [{ at: 75, n: 4 + rank + rnd[1], archers: 0.3, elite: 0.1, officers: [], from: out.entry }, { at: 150, n: 4 + rank + rnd[2], archers: 0.3, elite: 0.1, officers: [], from: out.entry }];
    out.timeLimit = Math.min(360, 300 + 15 * rank);
    out.side = [SIDE.allSaved, fast(200)];
  } else if (type === "dautuong") {
    const S = pickSite(["dong", "benSong"]);
    for (let i = 0; i < 8; i++) rnd.push(rng.int(0, 2));
    out.siteId = S.id; out.site = P(S.x, S.z); out.entry = P(S.x + 60, S.z); out.spawn = P(S.x - 55, S.z);
    const tier = rank >= 4 ? "tuong" : rank >= 3 ? "photuong" : "doitruong";
    out.duel = { at: out.site, r: 14, tier, ring: 14 + 2 * rank + rnd[0], name: tier === "tuong" ? "Tướng Nguyên" : tier === "photuong" ? "Phó tướng Nguyên" : "Đội trưởng Nguyên" };
    out.officers = [tier];
    out.timeLimit = 180 + 30 * Math.max(0, rank - 2);
    out.side = [SIDE.noRevive, SIDE.parry];
  }
  out.enemyTotal = (out.waves || []).reduce((s, w) => s + w.n, 0) + (out.camp?.garrison || 0) + (out.convoy ? out.convoy.escorts.reduce((s, n) => s + n + 1, 0) : 0) + (out.captives?.guards || 0);
  out.points.push(out.spawn);
  return out;
}

// Bảng nhiệm vụ trước trận: PICKS[bậc] giao tranh khác loại, chỉ loại đã mở; xác định theo (seed lính, số trận đã đánh).
export function missionBoard(seed, battleNo, rank) {
  const rng = makeRng(((seed >>> 0) * 2654435761 + battleNo * 7919 + 17) >>> 0);
  const open = MISSION_ORDER.filter((k) => MISSIONS[k].minRank <= rank);
  for (let i = open.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [open[i], open[j]] = [open[j], open[i]]; }
  return open.slice(0, Math.min(PICKS[rank], open.length)).map((type) => makeSkirmish(Math.floor(rng.next() * 1e9), rank, type));
}
