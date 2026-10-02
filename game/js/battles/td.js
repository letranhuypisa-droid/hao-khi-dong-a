// battles/td.js — BattleDef của giao tranh chế độ Tự do (đợt 14b), dựng theo một giao tranh (data/skirmish.js makeSkirmish) và người lính
// (meta/career.js). Dùng lại đất, đồn, doanh trại, làng, Hàm Tử quan của B15 (world.js buildWorld) nhưng tắt vòng Cứ Điểm, cờ tuyến; luật
// trận ở battle/director-td.js, người lính ở battle/soldier.js (def.Hero). Danh sách móc BattleDef: đầu battles/b15.js.

import { buildWorld } from "../battle/world.js";
import { ATMO_B15 } from "../battle/atmosphere.js";
import { TDDirector } from "../battle/director-td.js";
import { SoldierHero } from "../battle/soldier.js";
import { MAP } from "../data/battle-b15.js";
import B15 from "./b15.js";
import { RANKS, nextRank, SQUAD } from "../data/career.js";
import { createHaoKhi } from "../sim/haokhi.js";

const COL = { land: "#cdb888", water: "#2f5d62", fort: "#b39a6a", wall: "#5a4632", don: "#8a7a5a", gold: "#f1d98a", dich: "#2c3e55", ta: "#c0392b", ink: "#1d1a17" };
const STATIC = [{ x: 210, z: -75, r: 10 }, { x: 210, z: 75, r: 10 }, { x: 335, z: -75, r: 13 }, { x: 335, z: 75, r: 13 }];

// khung bản đồ nhỏ ôm khu đánh, cửa vào, chỗ xuất phát (và đường xe), tỉ lệ 3 : 2 như canvas 240 × 160
function boundsOf(sk) {
  const pts = [sk.site, sk.entry, sk.spawn, ...(sk.convoy?.route || []), ...(sk.escort?.route || []), ...(sk.captives ? [sk.captives.rally] : [])];
  let x0 = Math.min(...pts.map((p) => p.x)) - 45, x1 = Math.max(...pts.map((p) => p.x)) + 45;
  let z0 = Math.min(...pts.map((p) => p.z)) - 35, z1 = Math.max(...pts.map((p) => p.z)) + 35;
  const w = x1 - x0, h = z1 - z0;
  if (w / h < 1.5) { const d = (h * 1.5 - w) / 2; x0 -= d; x1 += d; } else { const d = (w / 1.5 - h) / 2; z0 -= d; z1 += d; }
  return { x0, x1, z0, z1 };
}

export function makeTD(sk, career) {
  const facing = sk.type === "giudon" ? Math.atan2(sk.entry.x - sk.spawn.x, sk.entry.z - sk.spawn.z) : Math.atan2(sk.site.x - sk.spawn.x, sk.site.z - sk.spawn.z);
  const rank = sk.rank;

  function drawBase({ c, W, H, X, Z, sx }) {
    c.fillStyle = COL.land; c.fillRect(0, 0, W, H);
    c.fillStyle = COL.water; c.fillRect(0, 0, W, Math.max(0, Z(MAP.riverNorthZ))); c.fillRect(X(MAP.riverEastX), 0, W, H);
    c.fillStyle = COL.fort; c.fillRect(X(MAP.fortWallX), Z(MAP.riverNorthZ), X(MAP.riverEastX) - X(MAP.fortWallX), Z(MAP.fortSouthZ) - Z(MAP.riverNorthZ));
    c.strokeStyle = COL.wall; c.lineWidth = 2; c.beginPath(); c.moveTo(X(MAP.fortWallX), Z(MAP.riverNorthZ)); c.lineTo(X(MAP.fortWallX), Z(MAP.fortSouthZ)); c.lineTo(X(MAP.riverEastX), Z(MAP.fortSouthZ)); c.stroke();
    c.strokeStyle = COL.don; c.lineWidth = 1.5;
    for (const s of STATIC) { c.beginPath(); c.arc(X(s.x), Z(s.z), s.r * sx, 0, 7); c.stroke(); }
    c.fillStyle = COL.ta; c.fillRect(X(34) - 4, Z(0) - 4, 8, 8);                      // bản doanh ta
  }
  function drawTop({ c, X, Z, sx, t }, ctx) {
    const d = ctx.director;
    const ring = (p, r, col, w = 1.6) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.arc(X(p.x), Z(p.z), Math.max(4, r * sx), 0, 7); c.stroke(); };
    const flagAt = (p, col) => { c.strokeStyle = COL.ink; c.lineWidth = 1; c.beginPath(); c.moveTo(X(p.x), Z(p.z)); c.lineTo(X(p.x), Z(p.z) - 9); c.stroke();
      c.fillStyle = col; c.beginPath(); c.moveTo(X(p.x), Z(p.z) - 9); c.lineTo(X(p.x) + 7, Z(p.z) - 6.5); c.lineTo(X(p.x), Z(p.z) - 4); c.fill(); };
    const route = (r) => { c.strokeStyle = "rgba(29,26,23,.55)"; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); r.forEach((p, i) => (i ? c.lineTo(X(p.x), Z(p.z)) : c.moveTo(X(p.x), Z(p.z)))); c.stroke(); c.setLineDash([]); };
    const blink = Math.floor(t * 3) % 2 === 0;
    flagAt(sk.entry, COL.dich);
    if (sk.type === "giudon") ring(sk.site, sk.ring + 2, d.keep < 50 && blink ? "#ff5a3a" : COL.gold, 2);
    if (sk.type === "danhup") { ring(sk.camp.center, sk.camp.r, "rgba(44,62,85,.8)"); for (const tn of d.tents || []) { c.fillStyle = tn.burnt ? "#ff7a3a" : COL.gold; c.fillRect(X(tn.x) - 2.5, Z(tn.z) - 2.5, 5, 5); } }
    if (sk.convoy) { route(sk.convoy.route); ring(sk.site, 8, "rgba(44,62,85,.8)"); for (const ct of d.carts || []) if (ct.live) { c.fillStyle = ct.stopped ? "#5a4838" : "#e0a24a"; c.fillRect(X(ct.x) - 3, Z(ct.z) - 2, 6, 4); } }
    if (sk.escort) { route(sk.escort.route); flagAt(sk.escort.dest, COL.ta); const ct = d.cart; if (ct) { c.fillStyle = ct.stuck && blink ? "#ff5a3a" : COL.gold; c.fillRect(X(ct.x) - 3.5, Z(ct.z) - 2.5, 7, 5); } }
    if (sk.captives) { flagAt(sk.captives.rally, COL.ta); for (const cp of d.captives || []) { c.fillStyle = cp.freed ? "#9fcf7a" : "#fff"; c.beginPath(); c.arc(X(cp.a.x), Z(cp.a.z), 2.4, 0, 7); c.fill(); } }
    if (sk.duel) ring(sk.duel.at, sk.duel.r, d.duelOn ? "#ff5a3a" : COL.gold, 2);
  }
  // dải trên trái: dưới bậc Tướng là Danh tiếng (thanh = tiến độ lên bậc kế, tính cả danh tiếng tạm của trận này); Tướng thì Hào Khí như cũ
  function hkView(ctx) {
    if (rank >= 4) return null;
    const d = ctx.director, live = d.liveRep?.() ?? 0, rep = career.rep + live, nx = nextRank(rep);
    return { label: "DANH TIẾNG", value: `+${live}`, pct: nx ? Math.round(nx.pct * 100) : 100,
      state: nx ? `${RANKS[rank].name} · còn ${Math.max(0, nx.need)} tới ${nx.name}` : RANKS[rank].name };
  }
  // bảng dưới bản đồ to: lính theo, lệnh đang dùng, tiếp viện
  function frontsHTML(ctx) {
    const d = ctx.director;
    if (!SQUAD[rank]) return `<div class="front"><b>${RANKS[rank].name}</b><span class="vs">đánh lẻ · lên Đội trưởng để có lính theo</span></div>`;
    const ord = { theota: "Theo ta", giuvung: "Giữ vững", tiencong: "Tiến công" }[d.squadOrder] || "";
    return `<div class="front here"><b>Đội</b><span class="ta">${d.squadAlive()}</span><span class="vs">/ ${d.squadTotal} lính</span><em>${ord}</em></div>
      <div class="front reinf">Tiếp viện: ${d.reinfLeft} lượt${d.ks ? ` · Phục binh: ${d.ks.used ? "đã dùng" : "sẵn sàng"}` : ""}</div>`;
  }

  class Director extends TDDirector { constructor(ctx) { super(ctx, sk, career); } }

  return {
    id: "TD", chapter: null, name: sk.name, td: true, noRetry: true, skirmish: sk,
    data: {
      PHASES: [{ id: RANKS[rank].name, name: sk.name, goal: sk.goal, tip: sk.how }], FRONTS: { D: { id: "D", name: "Đội của bạn" } },
      EVENTS: { leave: { name: "Rời vòng thách đấu" } }, STORY_INSERTS: {}, HISTORY_NOTES: [],
    },
    camFar: 1400,
    openGates: () => ({ A3: false, B3: false }),
    heroSpawn: { x: sk.spawn.x, z: sk.spawn.z, yaw: facing },
    camYaw: facing,
    buildWorld(scene, opts) {
      const w = buildWorld(scene, { shadows: opts.shadows });
      for (const v of Object.values(w.bases)) { if (v.ring) v.ring.visible = false; if (v.prog) v.prog.visible = false; }   // vòng Cứ Điểm của B15
      for (const f of Object.values(w.lineFlags)) { f.ta.group.visible = false; f.dich.group.visible = false; }           // cờ tuyến mặt trận
      return w;
    },
    camBoxes: B15.camBoxes,
    sim: { create: () => ({ heroFront: "D", fronts: {}, bases: {}, cooldowns: {}, reinf: { charges: 0, pending: [] }, t: 0 }) },
    createHaoKhi: (ctx, stats, diff) => createHaoKhi({ quick: true, diffMult: diff.hk ?? 1 }),
    Director,
    Hero: SoldierHero,
    atmo: ATMO_B15,
    ambient: null,
    bed: (ctx) => ({ dF: ctx.director.bedDist(), fire: ctx.director.burnt ? 0.2 : 0 }),
    music: (d, hk) => (hk.tpc || d.duelOn || d.officerUnits?.some((u) => u.awake && u.alive && !u.dead && !u.retreating) ? "boss" : "battle"),
    hud: { bounds: boundsOf(sk), drawBase, drawTop, frontsHTML, hkView, pinTip: true },
    par: { nhanh: sk.timeLimit, chuan: sk.timeLimit },
    dispose: (ctx) => ctx.director?.dispose?.(),
  };
}
export default makeTD;
