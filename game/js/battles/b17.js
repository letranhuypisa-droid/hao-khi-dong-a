// battles/b17.js — BattleDef của B17 Tây Kết (1285), bản thử đợt A1 (greybox). Danh sách móc: đầu battles/b15.js.
//
// Dựng trên đất Hàm Tử của B15 như B16 (battles/b16.js): world.js buildWorld (đồn, doanh trại có tường, Hàm Tử quan) rồi tắt vòng Cứ Điểm, cờ tuyến của
// B15 (B17 bật lại vòng của 3 đồn A1, A2, A3). Thêm lớp phủ đầm lầy và gò (ground.js setOverlay — chỉ B17; dispose và runBattle gỡ), tô màu đầm lên mặt
// đất, dựng gò (một lưới) và lau sậy ở hai bãi (một InstancedMesh). Luật ở sim/b17.js (thuần) + battle/director-b17.js. Tướng: H40 Nguyễn Khoái (lớp Cung
// WC09, dựng sẵn cấp 16 — đợt A5; H30 Trần Nhân Tông "sắp có", trong trận là tướng AI). Toa Đô dùng mô hình X19, Ô Mã Nhi X20, Yết Kiêu H38.

import * as THREE from "three";
import { buildWorld } from "../battle/world.js";
import { setOverlay, heightAt } from "../battle/ground.js";
import { envPart } from "../battle/glb.js";
import { merge, lambert } from "../battle/models.js";
import { terrainMaterial } from "../battle/terrain-tex.js";
import { ATMO_B15 } from "../battle/atmosphere.js";
import { DirectorB17 } from "../battle/director-b17.js";
import { MAP } from "../data/battle-b15.js";
import B15 from "./b15.js";
import { overlayB17, mudB17, moundDh, along, columnHead, routeS, BED_S, bedOf, nextBed, armedBeds, envoyPos, boatPos, ENVOY_LEN } from "../sim/b17.js";
import { PHASES, FRONTS, EVENTS, STORY_INSERTS, HISTORY_NOTES, SIDE_MISSIONS, ROUTE, MOUTH, OUTPOSTS, BEDS, MUD, AMBUSH, PAR_B17, MARSH_PROPS, PIER, ENVOY, KING,
  COLUMN } from "../data/battle-b17.js";

const COL = { land: "#cdb888", water: "#2f5d62", city: "#b39a6a", wall: "#5a4632", gold: "#f1d98a", dich: "#3d5a78", ta: "#c0392b", ink: "#1d1a17", marsh: "rgba(86,96,52,.55)", reed: "rgba(110,128,62,.8)" };

// ---- cảnh của đầm: màu đất vùng bùn, gò, lau sậy ------------------------------------------------------------------------------------
// Tô màu đỉnh mặt đất (world.terrain: lưới tam giác rời, màu theo tam giác) trong vùng đầm về màu bùn đầm — mesh dựng mới mỗi trận nên không phải trả lại.
function tintMarsh(world) {
  const g = world.terrain?.geometry, pos = g?.attributes.position, col = g?.attributes.color;
  if (!pos || !col) return;
  const sp = g.attributes.aSplat?.array;          // hoa văn đất (terrain-tex.js): bùn đầm nhận lớp đất mịn đậm hơn cỏ
  const pa = pos.array, ca = col.array, wet = new THREE.Color(0x4a4a2c), c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    const o = i * 3, cx = (pa[o] + pa[o + 3] + pa[o + 6]) / 3, cz = (pa[o + 2] + pa[o + 5] + pa[o + 8]) / 3;
    const m = mudB17(cx, cz) / MUD.level; if (m <= 0.01) continue;
    c.setRGB(ca[o], ca[o + 1], ca[o + 2]).lerp(wet, 0.55 * m);
    for (let k = 0; k < 9; k += 3) { ca[o + k] = c.r; ca[o + k + 1] = c.g; ca[o + k + 2] = c.b; }
    if (sp) for (let k = 0; k < 3; k++) sp[(i + k) * 2] = Math.max(sp[(i + k) * 2], 0.6 * Math.min(1, m));
  }
  col.needsUpdate = true; if (sp) g.attributes.aSplat.needsUpdate = true;
}
// Gò: mỗi gò một đĩa lưới cực (vòng × tia) đặt đúng heightAt (đã có lớp phủ: đất + gò), nổi 3 cm và polygonOffset để không chớp với đất; gộp một lưới.
function buildMounds(scene) {
  const NR = 7, NS = 22, P = [], C = [], top = new THREE.Color(0x8a8450), foot = new THREE.Color(0x5a5a34), c = new THREE.Color();
  for (const B of BEDS) for (const m of B.mounds) {
    const R = m.r * 1.04, pt = (k, s) => { const r = R * k / NR, a = s / NS * Math.PI * 2, x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r; return [x, heightAt(x, z) + 0.03, z]; };
    const push = (p) => { P.push(...p); c.copy(foot).lerp(top, Math.min(1, moundDh(p[0], p[2]) / m.h)); C.push(c.r, c.g, c.b); };
    for (let k = 0; k < NR; k++) for (let s = 0; s < NS; s++) {
      const a = pt(k, s), b = pt(k + 1, s), d = pt(k + 1, s + 1), e = pt(k, s + 1);
      push(a); push(d); push(b);                                        // mặt quay lên (+y); vòng trong cùng (k = 0, a = e = tâm) chỉ một tam giác
      if (k > 0) { push(a); push(e); push(d); }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute("aSplat", new THREE.Float32BufferAttribute(Array.from({ length: P.length / 3 * 2 }, (_, i) => (i % 2 ? 0 : 0.55)), 2));      // gò đất: hoa văn đất vừa phải (terrain-tex.js)
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, terrainMaterial({ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  mesh.receiveShadow = true; scene.add(mesh);
  return mesh;
}
// Lau sậy dày trong hai bãi (InstancedMesh như lau B16): chừa mặt đường cánh đi (5 m quanh lộ trình) và đỉnh gò. Không dùng ctx.rng (vật trang trí).
function buildReeds(scene) {
  const nearRoute = (x, z) => { const s = routeS(ROUTE, { x, z }); let best = 1e9; for (const d of [-1, 0, 1]) { const p = alongPt(s + d); best = Math.min(best, Math.hypot(p.x - x, p.z - z)); } return best; };
  const pts = [];
  let seed = 1717;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const B of BEDS) for (let i = 0, n = Math.floor(((B.x1 - B.x0) * (B.z1 - B.z0)) / 2.4); i < n; i++) {
    const x = B.x0 + rnd() * (B.x1 - B.x0), z = B.z0 + rnd() * (B.z1 - B.z0), s = 0.8 + rnd() * 0.6, ry = rnd() * 6, tx = (rnd() - 0.5) * 0.25, tz = (rnd() - 0.5) * 0.25;
    if (nearRoute(x, z) < 5.5) continue;
    if (B.mounds.some((m) => Math.hypot(x - m.x, z - m.z) < m.r * 0.55)) continue;
    pts.push([x, z, s, ry, tx, tz]);
  }
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 2.6, 4), new THREE.MeshLambertMaterial({ color: 0x8a8a4a }), pts.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  pts.forEach(([x, z, s, ry, tx, tz], k) => { e.set(tx, ry, tz); q.setFromEuler(e); v.set(x, Math.max(heightAt(x, z), -0.2) + 1.2 * s, z); sc.set(s, s, s); m4.compose(v, q, sc); reeds.setMatrixAt(k, m4); });
  scene.add(reeds);
  return reeds;
}
const alongPt = (s) => along(ROUTE, s);
// Vật đầm (MARSH_PROPS: đước, bè cỏ, lùm cây ven sông) — mẫu ENV nướng gộp một lưới màu đỉnh (một lượt vẽ); chưa nạp mô hình thì null.
function buildMarshProps(scene) {
  const parts = [];
  for (const p of MARSH_PROPS) { const g = envPart(p.id, { x: p.x, y: heightAt(p.x, p.z) - 0.05, z: p.z, ry: p.ry, s: p.s }); if (g) parts.push(g); }
  if (!parts.length) return null;
  const m = new THREE.Mesh(merge(parts), lambert()); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  return m;
}

// ---- bản đồ nhỏ -------------------------------------------------------------------------------------------------------------------
function drawBase({ c, W, H, X, Z }) {
  c.fillStyle = COL.land; c.fillRect(0, 0, W, H);
  c.fillStyle = COL.water; c.fillRect(0, 0, W, Math.max(0, Z(MAP.riverNorthZ))); c.fillRect(X(MAP.riverEastX), 0, W, H);
  c.fillStyle = COL.city; c.fillRect(X(MAP.fortWallX), Z(MAP.riverNorthZ), X(MAP.riverEastX) - X(MAP.fortWallX), Z(MAP.fortSouthZ) - Z(MAP.riverNorthZ));
  c.strokeStyle = COL.wall; c.lineWidth = 2; c.beginPath();
  c.moveTo(X(MAP.fortWallX), Z(MAP.riverNorthZ)); c.lineTo(X(MAP.fortWallX), Z(MAP.fortSouthZ)); c.lineTo(X(MAP.riverEastX), Z(MAP.fortSouthZ)); c.stroke();
  c.fillStyle = COL.marsh; c.fillRect(X(MUD.bank.x0), Z(MUD.bank.z0), X(MUD.bank.x1) - X(MUD.bank.x0), Z(MUD.bank.z1) - Z(MUD.bank.z0));   // đầm ven sông
  c.fillStyle = COL.reed; for (const B of BEDS) c.fillRect(X(B.x0), Z(B.z0), X(B.x1) - X(B.x0), Z(B.z1) - Z(B.z0));                      // bãi lau
  c.strokeStyle = "rgba(29,26,23,.55)"; c.lineWidth = 1.2; c.setLineDash([4, 3]); c.beginPath();                                       // đường ra biển
  ROUTE.forEach((p, i) => (i ? c.lineTo(X(p.x), Z(p.z)) : c.moveTo(X(p.x), Z(p.z)))); c.stroke(); c.setLineDash([]);
  c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.lineJoin = "round"; c.lineWidth = 3;
  const label = (t, x, z) => { c.strokeStyle = "rgba(255,248,230,.9)"; c.strokeText(t, X(x), Z(z)); c.fillStyle = COL.ink; c.fillText(t, X(x), Z(z)); };
  for (const B of BEDS) label(B.name, (B.x0 + B.x1) / 2, B.z1 + 12);
  label("Cửa sông", MOUTH.x - 14, MOUTH.z + 16);
  c.strokeStyle = "rgba(29,26,23,.4)"; c.lineWidth = 1; c.setLineDash([2, 3]); c.beginPath();                                          // đường sứ giả
  ENVOY.route.forEach((p, i) => (i ? c.lineTo(X(p.x), Z(p.z)) : c.moveTo(X(p.x), Z(p.z)))); c.stroke(); c.setLineDash([]);
  c.fillStyle = "#6a4a2e"; c.fillRect(X(PIER.x) - 1.5, Z(PIER.z - PIER.len), 3, Z(PIER.z) - Z(PIER.z - PIER.len));                       // bến tàn quân
  label("Bến", PIER.x, PIER.z + 12);
  c.textAlign = "start";
}
const baseKey = () => "b17";
function drawTop({ c, X, Z, t, sx }, ctx) {
  const d = ctx.director, st = d.st, blink = Math.floor(t * 3) % 2 === 0;
  // bãi đã chọn: viền vàng
  const B = bedOf(st.bed); if (B && st.phase < 3) { c.strokeStyle = st.ks.phucKich.state === "sansang" && blink ? "#ffd27a" : COL.gold; c.lineWidth = 1.6; c.strokeRect(X(B.x0), Z(B.z0), X(B.x1) - X(B.x0), Z(B.z1) - Z(B.z0)); }
  // đồn
  OUTPOSTS.forEach((O, i) => { const o = st.outposts[i]; c.fillStyle = o.taken ? COL.ta : COL.dich; c.beginPath(); c.arc(X(O.x), Z(O.z), 4, 0, 7); c.fill(); if (!o.taken && o.blockedRing && blink) { c.strokeStyle = "#ff5a3a"; c.lineWidth = 1.4; c.beginPath(); c.arc(X(O.x), Z(O.z), Math.max(5, O.r * sx), 0, 7); c.stroke(); } });
  // mốc cửa sông
  c.fillStyle = "#ff5a3a"; c.beginPath(); c.moveTo(X(MOUTH.x), Z(MOUTH.z) - 5); c.lineTo(X(MOUTH.x) + 4, Z(MOUTH.z) + 3); c.lineTo(X(MOUTH.x) - 4, Z(MOUTH.z) + 3); c.fill();
  // phục binh
  for (const list of d.wings) for (const r of list) if (d.live(r)) { c.fillStyle = "#e8b04a"; c.fillRect(X(r.a.x) - 1, Z(r.a.z) - 1, 2, 2); }
  // bãi thứ hai (Kế Sách Nhỏ): viền nét đứt
  const B2 = bedOf(st.bed2); if (B2 && st.phase < 3) { c.strokeStyle = COL.gold; c.lineWidth = 1.2; c.setLineDash([3, 2]); c.strokeRect(X(B2.x0), Z(B2.z0), X(B2.x1) - X(B2.x0), Z(B2.z1) - Z(B2.z0)); c.setLineDash([]); }
  // thuyền tàn quân (neo, đang chạy), sứ giả
  st.pier.boats.forEach((b, i) => { if (b.state !== "dock" && b.state !== "sail") return; const p = boatPos(st, i); c.fillStyle = b.state === "sail" ? "#ff8a6a" : "#3d5a78"; c.fillRect(X(p.x) - 2.5, Z(p.z) - 1.5, 5, 3); });
  if (d.envoyTask?.()) { const p = d.envoy; c.fillStyle = "#7fd06a"; c.beginPath(); c.arc(X(p.x), Z(p.z), 3, 0, 7); c.fill(); }
  // đầu cánh, Toa Đô
  const h = columnHead(st); if (!st.col.stood) { c.strokeStyle = "#ff8a6a"; c.lineWidth = 1.5; c.beginPath(); c.arc(X(h.x), Z(h.z), 5, 0, 7); c.stroke(); }
  const u = d.boss; if (u && u.alive && !u.dead) { c.fillStyle = "#ff8a6a"; c.beginPath(); c.arc(X(u.x), Z(u.z), 3.5, 0, 7); c.fill(); }
  const objs = d.objectives?.() ?? [];
  if (objs.length) { c.strokeStyle = "#ffd27a"; c.lineWidth = 2.2; const k = 0.5 + 0.5 * Math.sin(t * 6); for (const o of objs.slice(0, 3)) { c.beginPath(); c.arc(X(o.x), Z(o.z), 8 + 2.5 * k, 0, 7); c.stroke(); } }
}
// bảng dưới bản đồ to: cánh Toa Đô, phục binh, tiếp viện
function frontsHTML(ctx) {
  const d = ctx.director, st = d.st, C = st.col, B = bedOf(st.bed);
  const halt = C.stood ? (C.standWhy === "half" ? "đứng lại cố thủ trên gò" : "đội hình vỡ, cố thủ trên gò") : C.halt === "engage" ? "dừng giao chiến" : C.halt === "outpost" ? "bị đồn ta chặn" : st.phase === 0 ? "chờ lệnh" : "đang đi";
  const rows = [`<div class="front here"><b>Cánh Toa Đô</b><span class="vs">${Math.round(C.s / C.len * 100)}% đường ra biển · ${halt} · tốc ×${C.mult.toFixed(2).replace(".", ",")} · Sĩ Khí ${C.morale}</span></div>`,
    `<div class="front"><b>Phục binh</b><span class="ta">${d.wingsUp()}</span><span class="vs">${B ? B.name : "chưa đặt"} · ${d.wingsHold() ? "Giữ vững" : d.wingOrder === "giucho" ? "chưa vào chỗ" : "đã xuất"}</span></div>`,
    `<div class="front reinf">Gọi tiếp viện: ${d.reinf.charges} lượt${d.reinf.cd > 0 ? ` · hồi ${Math.ceil(d.reinf.cd)}s` : ""}</div>`];
  const kg = d.king, kp = kg && kg.alive && !kg.dead ? Math.round(kg.hp / kg.maxHp * 100) : 0, km = st.king.mode;
  rows.push(`<div class="front"><b>Vua Nhân Tông</b><span class="ta">${kp}%</span><span class="vs">${km === "fall" ? "lui về bản doanh" : km === "heal" ? `hồi sức · ${Math.ceil(st.king.healT)} s` : "dẫn cánh chính đánh đồn"} · vua gục là thua</span></div>`);
  const E = st.envoy, H = st.ks.hoiKe;
  rows.push(`<div class="front"><b>Sứ giả</b><span class="vs">${H.state === "thanhcong" ? "đã về bản doanh" : H.state === "thatbai" ? (H.why === "chet" ? "đã gục" : "không kịp") : E.state === "walk" ? `đang về · ${Math.round(E.s / ENVOY_LEN * 100)}%` : "chờ ở làng phía nam"}</span></div>`);
  const P = st.pier, left = P.boats.filter((b) => b.state === "dock").length;
  rows.push(`<div class="front"><b>Bến tàn quân</b><span class="vs">${st.oma.state === "hold" ? "Ô Mã Nhi giữ bến" : st.oma.state === "driven" ? "Ô Mã Nhi đã bị đuổi" : "Ô Mã Nhi bỏ bến"} · ${left} thuyền neo · ${P.passed} thuyền qua mốc</span></div>`);
  return rows.join("");
}

// ---- bot (debug.js __objective) ------------------------------------------------------------------------------------------------------
// P1 chọn bãi tây; lính còn chặn vòng chiếm trước; phục kích còn treo mà Toa Đô sắp vào bãi kế thì giữ xa ông (flee: chỉ chạy — sau ông 55 m nếu đang ở
// sau, không thì ngoài chỗ ông vào bãi 62 m); hộ tống sứ giả (Kế Sách Nhỏ) khi còn kịp trước lúc cánh vào bãi; hạ đồn; đánh Toa Đô thì trả chính đơn vị
// (bot coi là boss). Bot không làm nhiệm vụ phụ bến tàn quân.
function botObjective(ctx) {
  const d = ctx.director, st = d.st, h = ctx.hero;
  if (st.phase === 0) { d.pickBed(AMBUSH.defaultBed); return { x: h.x, z: h.z }; }
  const b = d.blockers()[0]; if (b) return { x: b.x, z: b.z, ref: b.ref };
  const K = st.ks.phucKich, C = st.col, nb = nextBed(st);
  if (K.state === "khadung" && nb && !C.stood && BED_S[nb] - C.s < 85) {
    const entry = alongPt(BED_S[nb]), hs = routeS(ROUTE, h);
    if (Math.hypot(h.x - entry.x, h.z - entry.z) < 62 || d.inp.heroToBoss < 50) {
      const p = hs < C.s ? alongPt(Math.max(0, C.s - 55)) : alongPt(Math.max(hs, BED_S[nb] + 62));
      return { x: p.x, z: p.z, flee: true };
    }
  }
  // sứ giả: đi tới ông rồi đi trước ông vài mét trên đường về bản doanh (ông đi khi tướng trong 15 m). Chỉ nhận việc khi cánh còn xa bãi kế (≥ 70 s).
  if (d.envoyTask() && st.phase <= 1) {
    const E = st.envoy, eta = nb ? (BED_S[nb] - C.s) / Math.max(0.3, COLUMN.speed * C.mult) : 999, need = (ENVOY_LEN - E.s) / ENVOY.speed + Math.hypot(h.x - d.envoy.x, h.z - d.envoy.z) / 6;
    if (E.state === "walk" || eta > need + 10) {
      const p = along(ENVOY.route, Math.min(ENVOY_LEN, E.s + 6)), u = d.envoy;
      return Math.hypot(h.x - u.x, h.z - u.z) > 12 ? { x: u.x, z: u.z } : { x: p.x, z: p.z };
    }
  }
  const o = d.objectives().find((x) => x.id !== "SUGIA"); if (!o) return { x: h.x, z: h.z };
  if (o.id === "X19" && d.boss && d.boss.alive && !d.boss.dead) return d.boss;
  return { x: o.x, z: o.z };
}

export const B17 = {
  id: "B17", chapter: "B17", name: "Tây Kết",
  data: { PHASES, FRONTS, EVENTS, STORY_INSERTS, HISTORY_NOTES, SIDE_MISSIONS },
  camFar: 1400,
  openGates: () => ({ A3: true, B3: false }),               // cổng bắc Hàm Tử quan mở sẵn: cánh Toa Đô đi qua
  heroSpawn: { x: 58, z: -20, yaw: 1.9 },                  // bản doanh ta, cạnh Hưng Đạo vương, nhìn về đường A
  camYaw: 1.9,
  buildWorld(scene, opts) {
    const w = buildWorld(scene, { shadows: opts.shadows, forts: true });
    const keep = new Set(OUTPOSTS.map((O) => O.id));
    for (const [id, v] of Object.entries(w.bases)) { if (keep.has(id)) continue; if (v.ring) v.ring.visible = false; if (v.prog) v.prog.visible = false; }   // vòng Cứ Điểm B15 khác 3 đồn
    for (const f of Object.values(w.lineFlags)) { f.ta.group.visible = false; f.dich.group.visible = false; }                                         // cờ tuyến B15
    setOverlay(overlayB17());                                      // bùn đầm, gò: từ đây heightAt / mudAt có lớp phủ
    tintMarsh(w);
    w.b17 = { mounds: buildMounds(scene), reeds: buildReeds(scene), marsh: buildMarshProps(scene) };
    return w;
  },
  camBoxes: B15.camBoxes,
  sim: { create: () => ({ heroFront: null, fronts: {}, bases: {}, cooldowns: {}, reinf: { charges: 0, pending: [] }, t: 0 }) },
  Director: DirectorB17,
  atmo: ATMO_B15,
  ambient: null,
  bed: (ctx) => ({ dF: ctx.director.bedDist(), fire: 0 }),
  music: (d, hk) => (hk.tpc || d.phase >= 2 && d.phase <= 3 ? "boss" : "battle"),
  hud: { bounds: { x0: 0, x1: 600, z0: -200, z1: 200 }, drawBase, baseKey, drawTop, frontsHTML, pinTip: true },
  par: { nhanh: PAR_B17, chuan: PAR_B17 },
  preset: { level: 16 },                                   // H40 dựng sẵn cấp 16 (= R; data/battles.js preset — battle.js heroStats đọc của BattleDef)
  rigs: ["X19", "H31", "X20", "H38", "B17_H30", "B17_SUGIA"],           // Toa Đô, Hưng Đạo vương, Ô Mã Nhi, Yết Kiêu, vua (H30h), sứ giả (mô hình mượn)
  debug: { objective: botObjective, state: (ctx) => ({ ...ctx.director.st, hero: { x: ctx.hero.x, z: ctx.hero.z, hp: ctx.hero.hp }, boss: ctx.director.boss ? { x: ctx.director.boss.x, z: ctx.director.boss.z, hp: ctx.director.boss.hp } : null }) },
  dispose: (ctx) => { setOverlay(null); ctx.director?.dispose?.(); },
};
export default B17;
