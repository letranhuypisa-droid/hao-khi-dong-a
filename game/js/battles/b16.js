// battles/b16.js — BattleDef của B16 Chương Dương và giải phóng Thăng Long (1285), bản thử đợt 1 (greybox). Danh sách móc: đầu battles/b15.js.
//
// Dựng trên đất Hàm Tử của B15 như chế độ Tự do (battles/td.js): world.js buildWorld (đồn, doanh trại có tường, Hàm Tử quan có hai cổng)
// rồi tắt vòng Cứ Điểm, cờ tuyến của B15. Bờ sông bắc là bến Chương Dương, khu có tường phía đông đứng thay kinh thành Thăng Long (B3 là
// cổng nam, A3 cổng đông). Luật ở sim/b16.js (thuần) + battle/director-b16.js. Tướng: H35 Trần Quốc Toản (H32 Trần Quang Khải chưa có
// mô hình và lớp cung WC09; cánh của ông đánh cổng đông chạy mô phỏng). Thoát Hoan mượn mô hình tướng Nguyên chung ("tuong").

import { buildWorld } from "../battle/world.js";
import { ATMO_B15 } from "../battle/atmosphere.js";
import { DirectorB16 } from "../battle/director-b16.js";
import { MAP } from "../data/battle-b15.js";
import B15 from "./b15.js";
import { PHASES, FRONTS, EVENTS, STORY_INSERTS, HISTORY_NOTES, SIDE_MISSIONS, VILLAGES, BOATS, LANDING, PALACE, RAM, GATE_SOUTH, GATE_EAST, PAR_B16,
  REEDS, DYKE, DEPOTS, BANNERS } from "../data/battle-b16.js";
import { gatePct } from "../battle/gatebar.js";

const COL = { land: "#cdb888", water: "#2f5d62", city: "#b39a6a", wall: "#5a4632", gold: "#f1d98a", dich: "#3d5a78", ta: "#c0392b", ink: "#1d1a17" };

function drawBase({ c, W, H, X, Z, sx }) {
  c.fillStyle = COL.land; c.fillRect(0, 0, W, H);
  c.fillStyle = COL.water; c.fillRect(0, 0, W, Math.max(0, Z(MAP.riverNorthZ))); c.fillRect(X(MAP.riverEastX), 0, W, H);
  c.fillStyle = COL.city; c.fillRect(X(MAP.fortWallX), Z(MAP.riverNorthZ), X(MAP.riverEastX) - X(MAP.fortWallX), Z(MAP.fortSouthZ) - Z(MAP.riverNorthZ));
  c.strokeStyle = COL.wall; c.lineWidth = 2; c.beginPath();
  c.moveTo(X(MAP.fortWallX), Z(MAP.riverNorthZ)); c.lineTo(X(MAP.fortWallX), Z(MAP.fortSouthZ)); c.lineTo(X(MAP.riverEastX), Z(MAP.fortSouthZ)); c.stroke();
  c.strokeStyle = "rgba(29,26,23,.45)"; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath();
  RAM.route.forEach((p, i) => (i ? c.lineTo(X(p.x), Z(p.z)) : c.moveTo(X(p.x), Z(p.z)))); c.stroke(); c.setLineDash([]);
  c.fillStyle = "#7a2a1e"; c.fillRect(X(PALACE.x) - 6, Z(PALACE.z - 10) - 4, 12, 8);                   // điện chính
  c.fillStyle = "rgba(110,128,62,.75)"; for (const R of REEDS) c.fillRect(X(R.x0), Z(R.z0), X(R.x1) - X(R.x0), Z(R.z1) - Z(R.z0));   // lau sậy: lối lẻn
  c.fillStyle = "#8a6a42"; c.fillRect(X(DYKE.x0), Z(DYKE.z0), X(DYKE.x1) - X(DYKE.x0), Math.max(2, Z(DYKE.z1) - Z(DYKE.z0)));          // đê
  c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.lineJoin = "round"; c.lineWidth = 3;
  const label = (t, x, z) => { c.strokeStyle = "rgba(255,248,230,.9)"; c.strokeText(t, X(x), Z(z)); c.fillStyle = COL.ink; c.fillText(t, X(x), Z(z)); };
  label("Thăng Long", (MAP.fortWallX + MAP.riverEastX) / 2, 120); label("Bến", LANDING.x, LANDING.z + 26);
  c.textAlign = "start";
  void sx;
}
// lớp nền vẽ lại khi cổng mở (màu cổng)
const baseKey = (M, ctx) => "b16" + (ctx.openGates[GATE_SOUTH] ? "s" : "") + (ctx.openGates[GATE_EAST] ? "e" : "");

function drawTop({ c, X, Z, t, sx }, ctx) {
  const d = ctx.director, st = d.st, blink = Math.floor(t * 3) % 2 === 0;
  // làng
  VILLAGES.forEach((V, i) => {
    const v = st.villages[i];
    c.fillStyle = v.done ? COL.ta : "#8a6a3a"; c.beginPath(); c.arc(X(V.x), Z(V.z), 4.5, 0, 7); c.fill();
    if (!v.done && st.phase <= 1) { c.strokeStyle = v.blocked && blink ? "#ff5a3a" : COL.gold; c.lineWidth = 1.6; c.beginPath(); c.arc(X(V.x), Z(V.z), Math.max(5, V.r * sx), 0, 7); c.stroke(); }
  });
  // thuyền neo
  BOATS.forEach((B, i) => { c.fillStyle = st.boats[i].burnt ? "#ff7a3a" : COL.dich; c.fillRect(X(B.x) - 3, Z(B.z) - 1.5, 6, 3); });
  // cổng
  for (const id of [GATE_SOUTH, GATE_EAST]) {
    const g = ctx.world.gates[id], s = st.gates[id];
    c.fillStyle = s.open ? COL.ta : COL.dich; c.fillRect(X(g.x) - 2, Z(g.z) - 6, 5, 12);
    if (!s.open && st.phase >= 2) { c.font = "bold 8px sans-serif"; c.fillStyle = COL.ink; c.fillText(`${gatePct(s.hp, s.hp0)}%`, X(g.x) - 22, Z(g.z) + 3); }
  }
  // kho quân nhu
  DEPOTS.forEach((D, i) => { const s = st.depots[i]; c.fillStyle = s.burnt ? "#ff7a3a" : "#e6d3a0"; c.fillRect(X(D.x) - 2.5, Z(D.z) - 2.5, 5, 5); c.strokeStyle = COL.ink; c.lineWidth = 1; c.strokeRect(X(D.x) - 2.5, Z(D.z) - 2.5, 5, 5); });
  // Vương Kỳ
  if (st.phase === 3) BANNERS.forEach((B, i) => { if (st.banners[i].down) return; c.fillStyle = "#ffd23a"; c.beginPath(); c.moveTo(X(B.x), Z(B.z) - 5); c.lineTo(X(B.x) + 4, Z(B.z) + 3); c.lineTo(X(B.x) - 4, Z(B.z) + 3); c.fill(); });
  // xe húc
  if (st.phase === 2) { const p = d.ramPos(); c.fillStyle = d.ramState === "bị chặn" && blink ? "#ff5a3a" : COL.gold; c.fillRect(X(p.x) - 3.5, Z(p.z) - 2.5, 7, 5); }
  // Thoát Hoan
  const u = d.boss; if (u && u.alive && !u.dead) { c.fillStyle = "#ff8a6a"; c.beginPath(); c.arc(X(u.x), Z(u.z), 3.5, 0, 7); c.fill(); }
  // mục tiêu chính: vòng vàng nhấp nháy
  const objs = d.objectives?.() ?? [];
  if (objs.length) { c.strokeStyle = "#ffd27a"; c.lineWidth = 2.2; const k = 0.5 + 0.5 * Math.sin(t * 6); for (const o of objs.slice(0, 3)) { c.beginPath(); c.arc(X(o.x), Z(o.z), 8 + 2.5 * k, 0, 7); c.stroke(); } }
}

// bảng dưới bản đồ to: dân binh, tiếp viện, xe húc, cổng đông
function frontsHTML(ctx) {
  const d = ctx.director, st = d.st;
  const rows = [`<div class="front here"><b>Dân binh</b><span class="ta">${d.militiaUp()}</span><span class="vs">theo tướng · ${st.rallied}/3 làng</span></div>`,
    `<div class="front reinf">Gọi tiếp viện: ${d.reinf.charges} lượt${d.reinf.cd > 0 ? ` · hồi ${Math.ceil(d.reinf.cd)}s` : ""}</div>`];
  if (st.counter.state === "run") rows.push(`<div class="front"><b>Bến</b><span class="vs">phản công · sức giữ ${Math.ceil(st.counter.keep)}%</span></div>`);
  if (st.phase === 2) rows.push(`<div class="front"><b>Xe húc</b><span class="vs">${d.ramState || ""} · ${Math.round((st.ram.s / st.ram.len) * 100)}% đường</span></div>`);
  if (st.phase >= 2) { const E = st.gates[GATE_EAST]; rows.push(`<div class="front"><b>Cổng đông</b><span class="vs">${E.open ? "cánh Trần Quang Khải đã phá" : `cánh Trần Quang Khải đang đánh · ${gatePct(E.hp, E.hp0)}%`}</span></div>`); }
  return rows.join("");
}

export const B16 = {
  id: "B16", chapter: "B16", name: "Chương Dương",
  data: { PHASES, FRONTS, EVENTS, STORY_INSERTS, HISTORY_NOTES, SIDE_MISSIONS },
  camFar: 1400,
  openGates: () => ({ A3: false, B3: false }),
  heroSpawn: { x: 60, z: -60, yaw: Math.PI * 0.85 },        // bản doanh ta phía tây, nhìn về làng thứ nhất (tây bắc)
  camYaw: Math.PI * 0.85,
  buildWorld(scene, opts) {
    const w = buildWorld(scene, { shadows: opts.shadows, forts: true });
    for (const v of Object.values(w.bases)) { if (v.ring) v.ring.visible = false; if (v.prog) v.prog.visible = false; }   // vòng Cứ Điểm của B15
    for (const f of Object.values(w.lineFlags)) { f.ta.group.visible = false; f.dich.group.visible = false; }           // cờ tuyến hai mặt trận B15
    return w;
  },
  camBoxes: B15.camBoxes,
  sim: { create: () => ({ heroFront: null, fronts: {}, bases: {}, cooldowns: {}, reinf: { charges: 0, pending: [] }, t: 0 }) },
  Director: DirectorB16,
  atmo: ATMO_B15,
  ambient: null,
  bed: (ctx) => ({ dF: ctx.director.bedDist(), fire: ctx.director.st.burnt ? 0.25 : 0 }),
  music: (d, hk) => (hk.tpc || d.phase === 3 ? "boss" : "battle"),
  hud: { bounds: { x0: 0, x1: 600, z0: -200, z1: 200 }, drawBase, baseKey, drawTop, frontsHTML, pinTip: true },
  par: { nhanh: PAR_B16, chuan: PAR_B16 },
  frameVisuals: (ctx) => ctx.director.frameBoats(),  // thuyền neo vẽ theo lô: xếp mức gần / xa theo camera của khung này (director-b16.js)
  rigs: ["tuong"],                                    // Thoát Hoan (mô hình tướng Nguyên chung) ra ở pha 4
  // bot (debug.js __objective): lính còn chặn vòng chiếm trước, rồi mục tiêu của pha
  debug: { objective: (ctx) => {
    const d = ctx.director, h = ctx.hero, b = d.blockers()[0]; if (b) return { x: b.x, z: b.z, ref: b.ref };
    const o = d.objectives()[0]; if (!o) return { x: h.x, z: h.z };
    // bot không tìm đường: đứng sau (phía bắc) thân điện chính mà mục tiêu ở trước điện thì đi vòng qua góc điện (đo: kẹt sau điện 240 s sau khi tải lại P5)
    const bz = PALACE.z - 10;                                      // tim thân điện (director-b16.js buildProps), dày 10 m, rộng 18 m
    if (h.z < bz + 6 && o.z > bz + 5 && Math.abs(h.x - PALACE.x) < 15 && h.x > MAP.fortWallX) return { x: PALACE.x + (h.x >= PALACE.x ? 16 : -16), z: bz + 7 };
    return o.label === "Vương Kỳ" ? { x: o.x, z: o.z, strike: true } : { x: o.x, z: o.z };
  }, state: (ctx) => ({ ...ctx.director.st, hero: { x: ctx.hero.x, z: ctx.hero.z, hp: ctx.hero.hp } }) },
  dispose: (ctx) => ctx.director?.dispose?.(),
};
export default B16;
