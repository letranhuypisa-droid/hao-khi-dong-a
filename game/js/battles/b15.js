// battles/b15.js — BattleDef của B15 Hàm Tử (1285): mọi thứ battle.js, hud.js, atmosphere.js cần mà riêng của trận này.
// Luật trận vẫn ở các module B15 cũ (director.js, kesach.js, world.js buildWorld, scenery.js, ambient.js,
// terrain-rules.js, data/battle-b15.js); file này chỉ gom lại sau các móc, giữ ĐÚNG thứ tự gọi và thứ tự rút ctx.rng như
// trước đợt 9 (vết bot xác định so từng byte).
//
// ==== DANH SÁCH MÓC CỦA BattleDef (battle.js runBattle đọc; trận mới — vd battles/b20.js — hiện thực đúng các móc này) ====
// Trường bắt buộc (*) và tùy chọn (?). ctx là ngữ cảnh trận (battle.js; có ctx.battle = BattleDef, ctx.heroDef = HEROES[id],
// ctx.quyetSach = { picked, historical } | null). Thứ tự dựng: openGates → buildWorld → sim.create → createHaoKhi → (Audio,
// FX, Crowd, Hero đọc heroSpawn) → HUD (data, hud, par) → Director → Atmosphere (atmo) → ambient → camBoxes. Mỗi khung:
// bước 1/60 (hero, crowd, units, director.update) → camera (camBoxes, waterLevel) → frameVisuals → atmo → bed (0,3 s) →
// world.update → ambient.update → HUD (0,05 s) → music.
//   * id, chapter, name                  "B15", "B15", "Hàm Tử"
//   * data                               { PHASES[{id,name,goal,tip}], FRONTS{id:{id,name,…}} ({} nếu không có mặt trận),
//                                          EVENTS{id:{name}}, STORY_INSERTS{sựKiện: idKhung}, HISTORY_NOTES[{label,text}], … }
//                                          — HUD đọc PHASES/FRONTS/EVENTS; storyEvent đọc STORY_INSERTS
//   ? camFar                             mặt phẳng xa của camera (m), mặc định 1400 (B20: 2200)
//   ? openGates()                        → { idCổng: false } trạng thái cổng mở ban đầu (mặc định {})
//   ? heroSpawn { x, z, yaw }            chỗ tướng xuất hiện (Hero đọc ctx.battle.heroSpawn); camYaw? góc camera đầu trận
//   ? par { nhanh, chuan }               par (giây) cho HUD; mặc định MODES[mode].par
//   * buildWorld(scene, { shadows, ctx }) → world (giao diện world.js: colliders, bases, gates, sun, update(t),
//                                          fadeOccluders, setBaseOwner/Progress, setLine, boats, smokes?). Trận có địa
//                                          hình riêng đặt ở đây: ground.setBattleTerrain(T), setDecks(deckSet),
//                                          setWaterLevel(fn) (runBattle trả cả ba về null lúc vào và lúc rời trận)
//   ? camBoxes(world)                    → [{ x0, x1, z0, z1, gate, open }] hộp 2D chặn cần camera (tường thành)
//   * sim.create(ctx, stats, mode)       → trạng thái mô phỏng 1 Hz (ctx.sim; tối thiểu { heroFront, fronts:{}, bases:{} })
//   ? createHaoKhi(ctx, stats, diff, mode) → ctx.hk (mặc định createHaoKhi theo MODES / mods / độ khó như B15)
//   * Director                           lớp điều phối: new Director(ctx) đặt ctx.director; giao diện như director.js
//                                          (phase, time, over, result, msgs, events, keSach{hud,trigger}, pickups, M, retries,
//                                          order, tryTPC, fillActors, restoreCheckpoint, lose, update(dt), on* của tướng/lính)
//   * atmo                               { presets[pha], tpc?, buildSources(world, smokes), sourceWant(s, phase, cols,
//                                          openGates, anyOpen), glowFrom? } — atmosphere.js; pha kẹp trong bảng
//   ? ambient(scene, ctx)                → { update(clock) } | null (cò, trâu, dân tản cư của B15)
//   ? frameVisuals(ctx, dt)              mỗi khung sau hoạt cảnh cổng: vòng Cứ Điểm, cờ tuyến (B15), mặt nước (B20)
//   * bed(ctx)                           → { dF, fire } — khoảng cách tới giao tranh (m) và mức lửa trại cho nền tiếng
//   * music(d, hk)                       → "battle" | "boss" (đổi nhạc khi chưa hết trận)
//   ? hud                                { bounds{x0,x1,z0,z1}, canvas?{w,h}, drawBase(M, ctx), drawTop(M, ctx),
//                                          frontsHTML?(ctx) } — bản đồ nhỏ, bảng mặt trận (hud.js). M = {c,W,H,X,Z,sx,sz,t}
//   ? touch                              { interact?: true } — thêm nút cảm ứng Tương tác (B15 không có)
//   ? debug                              { objective(ctx) → {x,z}, state(ctx) } — bot kiểm thử (debug.js). B15: null,
//                                          debug.js giữ __objective / __state của B15
//   ? dispose(ctx)                       dọn thêm lúc rời trận (sau khi đã trả địa hình về null)
//   ? preset { level }, fixedR           tướng dựng sẵn (heroStats(save, R, heroId, preset)), cấp trận cố định (B20: 25)
// Không nằm trong BattleDef (hub đọc mà không nạp three.js): data/battles.js giữ thẻ hub, loading.title, notes() cho màn
// nạp trận, result { title, missionsTotal, sideTotal, eventNames } mặc định cho màn kết quả (kết quả trận có thể tự ghi
// res.missionsTotal / res.sideTotal / res.eventNames / res.battle / res.stub).
// Kết quả trận (director.result): hình như director.js buildResult; thêm battle: "B20" để main.js biết trận nào.
// Ô HUD cho widget riêng của trận (hud.js): ctx.hud.setTopWidget(html|null), setPanel(id, html|null),
// prompt(text|null, tiến độ 0..1), picker(items|null, onPick) — picker mở thì phím 1–4 chọn và đồng hồ trận ×0,2.
// Mặt đất (ground.js): heightAt, collide(world, x, z, r, openGates, o), mudAt, waterDist là binding sống theo
// setBattleTerrain; waterLevel(), surfaceY(x, z). Camera không xuống dưới max(heightAt, waterLevel()) + 1,2.
// =====================================================================================================================

import { MAP, FRONTS, BASES, BASE_RING, PHASES, SIDE_MISSIONS, EVENTS, ALLY_GENERALS, BOSS, ENEMY_MIX, KE_SACH, VILLAGE,
  STORY_INSERTS, HISTORY_NOTES, lineToX } from "../data/battle-b15.js";
import { LANE_TERRAIN } from "../data/terrain-b15.js";
import { buildWorld } from "../battle/world.js";
import { laneFeaturesOn } from "../battle/ground.js";
import { Director } from "../battle/director.js";
import { Ambient } from "../battle/ambient.js";
import { ATMO_B15 } from "../battle/atmosphere.js";
import { createSim } from "../sim/front.js";

// ---- camera tránh tường Hàm Tử quan (chuyển nguyên từ battle.js) -------------------------------------------------
// Hộp 2D che camera, dựng theo world.js (tường tây x = MAP.fortWallX từ bờ sông tới góc nam, tường nam z =
// MAP.fortSouthZ; tháp cổng ±4,6..7,8 nằm trong đoạn tường). Mỗi cổng: nhịp cửa ±4,4 chỉ chắn khi cổng còn đóng
// (gate, open false); cổng vỡ thì hai cánh lật vào trong (world.js buildGate, battle.js quay 1,5 rad) nằm dọc
// z ≈ ±4,25 từ chân tường tới x + 4,4 (open true). hw: nửa bề dày hộp tường (lối đi trên tường rộng 3 m; tháp cổng
// 3,2 m thì pad của battle.js bù).
const WALL_HW = 1.5;
function wallBoxes(world) {
  const W = MAP.fortWallX, hw = WALL_HW, out = [];
  const gates = Object.entries(world.gates || {}).sort((a, b) => a[1].z - b[1].z);
  let z0 = MAP.riverNorthZ + 4 - hw;
  for (const [id, g] of gates) {
    out.push({ x0: W - hw, x1: W + hw, z0, z1: g.z - 4.4, gate: null, open: false });
    out.push({ x0: W - hw, x1: W + hw, z0: g.z - 4.4, z1: g.z + 4.4, gate: id, open: false });
    for (const s of [-1, 1]) out.push({ x0: W - 0.3, x1: W + 4.6, z0: g.z + s * 4.25 - 0.45, z1: g.z + s * 4.25 + 0.45, gate: id, open: true });
    z0 = g.z + 4.4;
  }
  out.push({ x0: W - hw, x1: W + hw, z0, z1: MAP.fortSouthZ + hw, gate: null, open: false });
  out.push({ x0: W - hw, x1: MAP.riverEastX, z0: MAP.fortSouthZ - hw, z1: MAP.fortSouthZ + hw, gate: null, open: false });
  return out;
}

// ---- bản đồ nhỏ (chuyển nguyên từ hud.js) ---------------------------------------------------------------------------
// Công sự làn đánh trên bản đồ nhỏ (chỉ khi bật công trình làn đánh): đoạn còn nguyên [x0, z0, x1, z1] của lũy
// Nguyên, ụ đất ta, hào (bỏ đoạn vỡ — lối đi đọc được trên bản đồ), tính một lần khi nạp module.
function solidPieces(f, out) {
  const at = (t) => [f.a[0] + (f.b[0] - f.a[0]) * t, f.a[1] + (f.b[1] - f.a[1]) * t];
  let t0 = 0;
  for (const [g0, g1] of [...f.gaps].sort((p, q) => p[0] - q[0])) { if (g0 > t0) out.push([...at(t0), ...at(g0)]); t0 = Math.max(t0, g1); }
  if (t0 < 1) out.push([...at(t0), ...at(1)]);
}
const MAP_LUY = [], MAP_UTA = [], MAP_HAO = [];
for (const b of LANE_TERRAIN.berms) solidPieces(b, b.kind === "luy_nguyen" ? MAP_LUY : MAP_UTA);
for (const d of LANE_TERRAIN.ditches) solidPieces(d, MAP_HAO);

// sông, Hàm Tử quan, tuyến hai mặt trận, công sự làn đánh, Cứ Điểm
function drawBase({ c, W, H, X, Z, sx }, ctx) {
  const sim = ctx.sim;
  c.fillStyle = "#cdb888"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#2f5d62"; c.fillRect(0, 0, W, Z(MAP.riverNorthZ)); c.fillRect(X(MAP.riverEastX), 0, W, H);
  c.fillStyle = "#b39a6a"; c.fillRect(X(MAP.fortWallX), Z(MAP.riverNorthZ), X(MAP.riverEastX) - X(MAP.fortWallX), Z(MAP.fortSouthZ) - Z(MAP.riverNorthZ));
  c.strokeStyle = "#5a4632"; c.lineWidth = 2; c.beginPath();
  c.moveTo(X(MAP.fortWallX), Z(MAP.riverNorthZ)); c.lineTo(X(MAP.fortWallX), Z(MAP.fortSouthZ)); c.lineTo(X(MAP.riverEastX), Z(MAP.fortSouthZ)); c.stroke();
  for (const F of Object.values(FRONTS)) {
    const f = sim.fronts[F.id], lx = lineToX(F, f.x);
    c.fillStyle = "rgba(155,45,32,.45)"; c.fillRect(X(F.x0), Z(F.laneZ - 22), X(lx) - X(F.x0), Z(F.laneZ + 22) - Z(F.laneZ - 22));
    c.fillStyle = "rgba(44,58,74,.45)"; c.fillRect(X(lx), Z(F.laneZ - 22), X(Math.min(F.x1, MAP.fortWallX)) - X(lx), Z(F.laneZ + 22) - Z(F.laneZ - 22));
    c.fillStyle = "#f1d98a"; c.fillRect(X(lx) - 1, Z(F.laneZ - 24), 2, Z(F.laneZ + 24) - Z(F.laneZ - 24));
    c.fillStyle = "#1d1a17"; c.font = "bold 10px sans-serif"; c.fillText(F.id, X(F.x0) - 12, Z(F.laneZ) + 4);
  }
  // công sự làn đánh: gò (vệt đất nhạt), hào và hào thành (nét nước), lũy Nguyên (nét đậm), ụ ta, hố (chấm)
  if (laneFeaturesOn()) {
    c.fillStyle = "rgba(122,96,58,.5)";
    for (const m of LANE_TERRAIN.mounds) { c.beginPath(); c.arc(X(m.x), Z(m.z), m.r * sx, 0, 7); c.fill(); }
    const seg = (list, color, w) => {
      c.strokeStyle = color; c.lineWidth = w; c.beginPath();
      for (const p of list) { c.moveTo(X(p[0]), Z(p[1])); c.lineTo(X(p[2]), Z(p[3])); }
      c.stroke();
    };
    seg(MAP_HAO, "#2f5d62", 1.6); seg(MAP_UTA, "#7a5230", 1.2); seg(MAP_LUY, "#3b2a1a", 1.8);
    for (const p of LANE_TERRAIN.pits) { c.fillStyle = p.kind === "ngap" ? "#2f5d62" : "#4a3a28"; c.beginPath(); c.arc(X(p.x), Z(p.z), 1.3, 0, 7); c.fill(); }
  }
  for (const b of BASES) {
    const v = ctx.world.bases[b.id], s = sim.bases[b.id];
    const sz2 = b.type === "doanh_trai" ? 9 : b.type === "cong" ? 6 : b.type === "ban_doanh" ? 11 : 7;
    c.fillStyle = s.owner === "ta" ? "#c0392b" : "#3d5a78";
    if (b.type === "cong") c.fillRect(X(v.x) - 2, Z(v.z) - sz2, 5, sz2 * 2);
    else c.fillRect(X(v.x) - sz2 / 2, Z(v.z) - sz2 / 2, sz2, sz2);
    c.strokeStyle = "#1d1a17"; c.lineWidth = 1; c.strokeRect(X(v.x) - sz2 / 2, Z(v.z) - sz2 / 2, sz2, sz2);
  }
}
// sự kiện nhấp nháy, làng và bó tên, thuyền Kế Sách, bến cập
function drawTop({ c, X, Z, t }, ctx) {
  const d = ctx.director;
  if (Math.floor(t * 3) % 2 === 0) {
    c.strokeStyle = "#ff5a3a"; c.lineWidth = 2;
    if (d.events.counterA1?.state === "run") { const v = ctx.world.bases.A1; c.beginPath(); c.arc(X(v.x), Z(v.z), 10, 0, 7); c.stroke(); }
    if (d.events.surrounded?.state === "run" && d.generals.H40) { const g = d.generals.H40; c.beginPath(); c.arc(X(g.x), Z(g.z), 10, 0, 7); c.stroke(); }
  }
  const ks = d.keSach;
  c.fillStyle = "#8a6a3a"; c.beginPath(); c.arc(X(VILLAGE.x), Z(VILLAGE.z), 5, 0, 7); c.fill();
  for (const b of ks.boats) { if (b.dead) continue; c.fillStyle = "#e0a24a"; c.fillRect(X(b.x) - 3, Z(b.z) - 1.5, 6, 3); }
  for (const b of ks.bundles) if (!b.taken) { c.fillStyle = "#f1d98a"; c.beginPath(); c.arc(X(b.x), Z(b.z), 2.5, 0, 7); c.fill(); }
  if (ks.list.some((k) => k.state === "sansang") && Math.floor(t * 4) % 2) { const L = KE_SACH.coAoTong.landing; c.strokeStyle = "#ffd27a"; c.lineWidth = 2; c.beginPath(); c.arc(X(L.x), Z(L.z), 8, 0, 7); c.stroke(); }
}

export const B15 = {
  id: "B15", chapter: "B15", name: "Hàm Tử",
  data: { MAP, FRONTS, BASES, BASE_RING, PHASES, SIDE_MISSIONS, EVENTS, ALLY_GENERALS, BOSS, ENEMY_MIX, KE_SACH, VILLAGE,
    STORY_INSERTS, HISTORY_NOTES, lineToX },
  camFar: 1400,
  openGates: () => ({ A3: false, B3: false }),
  heroSpawn: { x: 72, z: -32, yaw: Math.PI / 2 },        // ngoài rào bản doanh, để camera không kẹt vào lều
  camYaw: Math.PI / 2,
  // Vật đổ bóng (mặt trời, tường, cổng, thuyền, cảnh) luôn dựng như khi bật bóng; nút "Bóng" chỉ bật/tắt
  // renderer.shadowMap (tắt thì three bỏ hẳn lượt bóng, shader không lấy mẫu bóng: không tốn gì).
  buildWorld: (scene, opts) => buildWorld(scene, { shadows: opts.shadows }),
  camBoxes: wallBoxes,
  sim: {
    create: (ctx, stats) => createSim({ fronts: FRONTS, bases: BASES, enemyMix: ENEMY_MIX, R: ctx.R, mods: {
      unitSimC: stats.legionSimC, reinfAmt: stats.mods.reinfAmt, reinfCharges: stats.mods.reinfCharges,
      holdThu: stats.mods.holdThu, skPer5: stats.mods.skPer5, cmdCdMult: stats.mods.cmdCdMult, allyHpPct: stats.mods.allyHpPct } }),
  },
  Director,
  atmo: ATMO_B15,
  ambient: (scene, ctx) => new Ambient(scene, ctx),     // cò, trâu, trẻ chăn trâu, quạ, dân tản cư (ambient.js)
  // vòng Cứ Điểm (cổng đã mở thì tắt vòng), cờ tuyến hai mặt trận
  frameVisuals(ctx) {
    for (const [id, v] of Object.entries(ctx.world.bases)) if (v.ring) v.ring.visible = ctx.sim.bases[id].type !== "cong" || !ctx.openGates[id];
    for (const fid in FRONTS) ctx.world.setLine(fid, ctx.sim.fronts[fid].x);
  },
  // nền tiếng: khoảng cách tới tuyến gần nhất (dọc làn ±6 m, ngang làn ±20 m); lửa trại từ P3
  bed(ctx) {
    const h = ctx.hero, d = ctx.director;
    let dF = 999;
    for (const fid in FRONTS) { const F = FRONTS[fid], lx = F.x0 + ctx.sim.fronts[fid].x * (F.x1 - F.x0); dF = Math.min(dF, Math.hypot(Math.max(0, Math.abs(h.x - lx) - 6), Math.max(0, Math.abs(h.z - F.laneZ) - 20))); }
    return { dF, fire: d.phase >= 2 ? 0.25 + 0.15 * (d.phase - 2) : 0 };
  },
  // P4 và Tổng Phản Công đổi sang bài trận boss
  music: (d, hk) => (hk.tpc || d.phase === 3 ? "boss" : "battle"),
  hud: { bounds: { x0: 0, x1: 600, z0: -200, z1: 200 }, drawBase, drawTop },
  debug: null,
};
export default B15;
