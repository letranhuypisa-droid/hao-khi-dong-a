// sim/b17.js — luật trận B17 Tây Kết, phần thuần (không three.js, không DOM; kiểm trong Node: tests/b17-sim.test.mjs).
// battle/director-b17.js đọc trạng thái này mỗi bước, tự sinh lính / vẽ vật / phát tiếng theo các sự kiện tickB17 trả về.
//
// Pha (data/battle-b17.js PHASES): 0 Bàn kế (chọn bãi lau) → 1 Đường ra biển (cánh Toa Đô hành quân, hạ 3 đồn) → 2 Bãi lau (Toa Đô vào bãi đã
// chọn: cửa sổ Kế Sách) → 3 Chí tử chiến (Toa Đô đứng lại: đội hình vỡ, hoặc Sinh lực chạm sàn) → 4 Áo ngự (Toa Đô bị hạ: dẹp tàn quân hoặc chờ).
// Đầu vào mỗi bước (inp): hero { x, z, alive }, foesAt(x, z, r) → số địch còn đánh được trong vòng; engaged (Toa Đô giáp mặt tướng: tướng trong
// COLUMN.engageR m — director quyết), bossHalf (Sinh lực Toa Đô chạm sàn COLUMN.floorPct), bossDown (Toa Đô đã bị hạ), wingsHold (hai cánh phục
// binh Giữ vững trong bãi), heroToBoss (m, tướng tới Toa Đô), ksPress (vừa bấm Lệnh Kế Sách), pick ("W" | "E": người chơi chọn bãi ở bảng). Thiếu
// trường nào thì coi là false / 0 / null. Sự kiện trả về: { type, … } theo thứ tự xảy ra trong bước.
//
// Cánh hành quân là trạng thái thuần col.s (m đã đi trên ROUTE, mẫu along / routeLen của xe húc B16): Toa Đô, sĩ quan, lính hộ tống trong trận chỉ
// đi theo điểm along(ROUTE, col.s). Tốc = COLUMN.speed × slowPer^(số đồn ta đã hạ). Dừng khi: đồn ta chặn (OUTPOST_BLOCK.sec, mỗi đồn một lần, ở
// cách tâm đồn O.stop m), Toa Đô giao chiến (tối đa engageMax giây cộng dồn rồi engageCd giây đẩy tiếp), hoặc đứng lại hẳn (P4).

import { along, routeLen } from "./b16.js";
import { ROUTE, MOUTH, COLUMN, OUTPOSTS, OUTPOST_BLOCK, BEDS, inRect, AMBUSH, MUD, KE_SACH, TIMEOUT_B17, REMNANTS } from "../data/battle-b17.js";

export { along, routeLen };
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const ROUTE_LEN = routeLen(ROUTE);

// quãng s (m) của điểm p chiếu lên lộ trình (đoạn gần nhất)
export function routeS(route, p) {
  let acc = 0, best = Infinity, bs = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
    let t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / (L * L); t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
    if (d < best) { best = d; bs = acc + t * L; }
    acc += L;
  }
  return bs;
}
// s của tâm từng đồn, chỗ cánh dừng khi đồn ta chặn (O.stop m trước tâm), chỗ đầu cánh bước vào từng bãi lau (dò từng 0,5 m)
export const OUT_S = OUTPOSTS.map((O) => routeS(ROUTE, O));
export const STOP_S = OUTPOSTS.map((O, i) => OUT_S[i] - O.stop);
export const BED_S = Object.fromEntries(BEDS.map((B) => {
  for (let s = 0; s <= ROUTE_LEN; s += 0.5) { const p = along(ROUTE, s); if (inRect(B, p.x, p.z)) return [B.id, s]; }
  return [B.id, null];
}));
export const bedOf = (id) => BEDS.find((B) => B.id === id) || null;

// S: hệ số độ bền theo cấp trận (chưa dùng ở A1: không có cổng phải phá). ksWin: hệ số cửa sổ Kế Sách (Trận nhanh 0,75).
export function createB17({ timeout = TIMEOUT_B17, ksWin = 1 } = {}) {
  return {
    t: 0, phase: 0, phaseT: 0, timeout, over: false, won: null, why: null,
    bed: null, bedAuto: false,                                        // bãi lau đã chọn: "W" | "E"
    col: { s: 0, len: ROUTE_LEN, mult: 1, halt: null, fight: false, engT: 0, cdT: 0, blockT: 0, blocked: OUTPOSTS.map(() => false),
      entered: false, stood: false, standWhy: null, standT: null, arrived: false, morale: COLUMN.morale, moraleT: 0 },
    outposts: OUTPOSTS.map((O) => ({ id: O.id, p: 0, taken: false, takenT: null, blockedRing: false })), taken: 0,
    arena: null,                                                      // chỗ Toa Đô cố thủ khi đứng lại: { x, z, mound } (mound: chỉ số gò trong bãi, null)
    bossDown: false, main: [false, false, false],
    // Kế Sách: state "khadung" → "sansang" (cửa sổ đang mở) → "thanhcong" | "thatbai" (why: "lo" lộ phục binh, "canh" cánh không giữ vững, "muon" hết cửa sổ)
    ks: { phucKich: { state: "khadung", left: null, window: KE_SACH.phucKich.window * ksWin, why: null } },
    prompt: null,                                                     // nhắc tương tác của bước vừa chạy (director đưa lên ctx.hud.prompt): { text, p } | null
  };
}

// tốc cánh hiện tại (m/s)
export const columnSpeed = (st) => COLUMN.speed * st.col.mult;
export const columnHead = (st) => along(ROUTE, st.col.s);

// Vòng chiếm "đứng trong vòng, không địch thì tiến độ tăng": "done" | "blocked" | "in" | null (tướng ngoài vòng)
function holdRing(o, c, r, sec, inp, dt) {
  const h = inp.hero;
  if (!h.alive || dist(h, c) > r) return null;
  if (inp.foesAt(c.x, c.z, r) > 0) return "blocked";
  o.p = Math.min(1, o.p + dt / sec);
  return o.p >= 1 ? "done" : "in";
}
export const secLeft = (o, sec) => Math.max(1, Math.ceil((1 - o.p) * sec - 1e-9));

function setPhase(st, i, ev) { st.phase = i; st.phaseT = 0; ev.push({ type: "phase", phase: i }); }

// gò gần p nhất trong COLUMN.standSeek m (mọi bãi) → { x, z, mound: { bed, i } } ; không có thì chính p
export function arenaFor(p) {
  let best = null, bd = COLUMN.standSeek;
  for (const B of BEDS) B.mounds.forEach((m, i) => { const d = dist(m, p); if (d < bd) { bd = d; best = { x: m.x, z: m.z, mound: { bed: B.id, i } }; } });
  return best || { x: p.x, z: p.z, mound: null };
}

export function tickB17(st, inp, dt) {
  const ev = [];
  if (st.over) return ev;
  st.t += dt; st.phaseT += dt; st.prompt = null;
  const C = st.col, K = st.ks.phucKich;

  // ---- P1: chọn bãi lau (bảng chọn ở bản doanh; hết pickSec giây thì bãi mặc định) ----
  if (st.phase === 0) {
    const pick = inp.pick && bedOf(inp.pick) ? inp.pick : null;
    if (pick || st.phaseT >= AMBUSH.pickSec) {
      st.bed = pick || AMBUSH.defaultBed; st.bedAuto = !pick;
      ev.push({ type: "bedPicked", bed: st.bed, auto: st.bedAuto });
      setPhase(st, 1, ev);
    }
  }

  // ---- ba đồn: chiếm được ở mọi pha ----
  OUTPOSTS.forEach((O, i) => {
    const o = st.outposts[i];
    if (o.taken) return;
    const r = holdRing(o, O, O.r, O.capSec, inp, dt);
    o.blockedRing = r === "blocked";
    if (r === "blocked") st.prompt = { text: `Quân Nguyên còn giữ ${O.name} — dẹp chúng để chiếm`, p: o.p };
    else if (r === "in") st.prompt = { text: `Chiếm ${O.name} · còn ${secLeft(o, O.capSec)} s`, p: o.p };
    else if (r === "done") {
      o.taken = true; o.takenT = st.t; st.taken++; C.mult *= COLUMN.slowPer;
      ev.push({ type: "outpostTaken", id: O.id, n: st.taken });
      if (st.taken >= OUTPOSTS.length) st.main[1] = true;
      // cánh đang ở giữa chỗ dừng và tâm đồn: đồn chặn ngay tại chỗ
      if (st.phase >= 1 && !C.stood && !C.blocked[i] && C.s > STOP_S[i] && C.s < OUT_S[i]) blockAt(st, i, ev);
    }
  });

  // ---- cánh Toa Đô hành quân (từ P2 tới khi đứng lại) ----
  if (st.phase >= 1 && !C.stood) {
    if (C.blockT > 0) C.blockT = Math.max(0, C.blockT - dt);
    if (C.cdT > 0) C.cdT = Math.max(0, C.cdT - dt);
    const fight = !!inp.engaged && C.cdT <= 0;
    if (fight) {
      if (!C.fight) ev.push({ type: "engage" });
      C.engT += dt;
      if (C.engT >= COLUMN.engageMax) { C.engT = 0; C.cdT = COLUMN.engageCd; ev.push({ type: "engageEnd" }); }
    }
    C.fight = fight && C.cdT <= 0;
    C.halt = C.blockT > 0 ? "outpost" : C.fight ? "engage" : null;
    if (!C.halt) {
      let next = Math.min(C.len, C.s + columnSpeed(st) * dt);
      for (let i = 0; i < OUTPOSTS.length; i++) {
        if (!st.outposts[i].taken || C.blocked[i] || C.s > STOP_S[i] || next < STOP_S[i]) continue;
        next = STOP_S[i]; blockAt(st, i, ev); break;
      }
      C.s = next;
    }
    // đầu cánh vào bãi lau đã chọn: mở cửa sổ Kế Sách (tướng đang trong revealR m quanh Toa Đô thì lộ phục binh)
    if (st.bed && !C.entered && BED_S[st.bed] != null && C.s >= BED_S[st.bed]) {
      C.entered = true;
      ev.push({ type: "bedEnter", bed: st.bed });
      if (K.state === "khadung") {
        if ((inp.heroToBoss ?? Infinity) < AMBUSH.revealR && inp.hero.alive) ksResult(st, false, "lo", ev);
        else { K.state = "sansang"; K.left = K.window; ev.push({ type: "ksOpen" }); }
      }
      if (st.phase === 1) setPhase(st, 2, ev);
    }
    if (C.s >= C.len - 1e-9) { C.arrived = true; finish(st, false, "Toa Đô ra tới cửa sông: cánh quân Nguyên thoát ra biển.", ev); return ev; }
    // Quân Viễn Chinh: Sĩ Khí cánh mòn dần; về 0 thì đội hình vỡ
    C.moraleT += dt;
    if (C.moraleT >= COLUMN.moraleEvery) {
      C.moraleT -= COLUMN.moraleEvery; C.morale = Math.max(0, C.morale - COLUMN.moraleDrop);
      ev.push({ type: "moraleDrop", morale: C.morale });
      if (C.morale <= 0) stand(st, "morale", ev);
    }
  }

  // ---- Kế Sách Phục kích bãi lau: G trong cửa sổ ----
  if (inp.ksPress) {
    if (K.state === "sansang") ksResult(st, !!inp.wingsHold, inp.wingsHold ? null : "canh", ev);
    else ev.push({ type: "ksIdle", state: K.state });
  }
  if (K.state === "sansang") {
    K.left = Math.max(0, K.left - dt);
    if (K.left <= 0) ksResult(st, false, "muon", ev);
  }

  // ---- Toa Đô chạm sàn Sinh lực khi cánh còn đi: đứng lại ----
  if (st.phase >= 1 && !C.stood && inp.bossHalf) stand(st, "half", ev);

  // ---- P4 → P5: Toa Đô bị hạ ----
  if (st.phase === 3 && inp.bossDown) { st.bossDown = true; st.main[2] = true; setPhase(st, 4, ev); }
  if (st.phase === 4) {
    const A = st.arena || columnHead(st), left = inp.foesAt(A.x, A.z, REMNANTS.r);
    if (st.phaseT >= REMNANTS.sec || (st.phaseT >= REMNANTS.minSec && left === 0)) finish(st, true, "Quân Trần thắng ở Tây Kết; cánh Toa Đô tan.", ev);
  }

  if (!st.over && st.t >= st.timeout) finish(st, false, "Quá 30 phút mà chưa dứt trận Tây Kết.", ev);
  return ev;
}

function blockAt(st, i, ev) {
  const C = st.col;
  C.blocked[i] = true; C.blockT = OUTPOST_BLOCK.sec; C.halt = "outpost";
  ev.push({ type: "outpostBlock", id: OUTPOSTS[i].id });
}

// Toa Đô đứng lại hẳn (why: "broken" phục kích làm vỡ đội hình, "morale" Sĩ Khí cánh về 0, "half" chạm sàn Sinh lực): cánh thôi đi, ông lên gò gần nhất cố thủ → P4
function stand(st, why, ev) {
  const C = st.col;
  if (C.stood) return;
  C.stood = true; C.standWhy = why; C.standT = st.t; C.halt = "stand"; C.fight = false;
  st.arena = arenaFor(columnHead(st));
  st.main[0] = true;
  ev.push({ type: "stand", why, arena: st.arena });
  if (st.phase < 3) setPhase(st, 3, ev);
}

// Kế Sách có kết quả. Thành công: đội hình vỡ (cánh Sĩ Khí −morale, Toa Đô đứng lại).
function ksResult(st, ok, why, ev) {
  const K = st.ks.phucKich;
  if (K.state === "thanhcong" || K.state === "thatbai") return;
  K.state = ok ? "thanhcong" : "thatbai"; K.why = why; K.left = null;
  ev.push({ type: "keSach", id: "phucKich", ok, why });
  if (ok) { st.col.morale = Math.max(0, st.col.morale - KE_SACH.phucKich.morale); stand(st, "broken", ev); }
}
// đội hình vỡ (một nửa lính hộ tống tán loạn): phục kích thành công hoặc Sĩ Khí cánh về 0
export const routed = (st) => st.col.standWhy === "broken" || st.col.standWhy === "morale";

export function finish(st, won, why, ev = []) {
  if (st.over) return ev;
  st.over = true; st.won = won; st.why = why;
  ev.push({ type: won ? "win" : "lose", why });
  return ev;
}

// Nhiệm vụ phụ (SIDE_MISSIONS; A1 chỉ có phục kích — đuổi Ô Mã Nhi, chặn thuyền qua mốc là đợt A2)
export function sideB17(st) { return { S_AMBUSH: st.ks.phucKich.state === "thanhcong" }; }

export const snapshotB17 = (st) => JSON.parse(JSON.stringify(st));
export function restoreB17(st, snap) { for (const k of Object.keys(st)) delete st[k]; Object.assign(st, JSON.parse(JSON.stringify(snap))); return st; }

// ---- lớp phủ đầm lầy, gò (ground.js setOverlay) ------------------------------------------------------------------------------------
const sm = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const MOUNDS = BEDS.flatMap((B) => B.mounds);
// độ cao gò cộng thêm (m): như gò làn đánh của B15 (ground.js featureHeight) — h × (1 − smooth(0,2, 1, d / r))
export function moundDh(x, z) {
  let h = 0;
  for (const m of MOUNDS) { const r = Math.hypot(x - m.x, z - m.z) / m.r; if (r < 1) h += m.h * (1 - sm(0.2, 1, r)); }
  return h;
}
// mức bùn 0..1: trong vùng đầm (dải bờ bắc, hai bãi lau; mép mềm MUD.edge m) = MUD.level, trừ mặt đường A và sườn gò
const rectK = (R, x, z, e) => sm(R.x0 - e, R.x0, x) * sm(R.x1 + e, R.x1, x) * sm(R.z0 - e, R.z0, z) * sm(R.z1 + e, R.z1, z);
export function mudB17(x, z) {
  const e = MUD.edge;
  let k = rectK(MUD.bank, x, z, e);
  for (const B of BEDS) { const b = rectK(B, x, z, e); if (b > k) k = b; }
  if (k <= 0) return 0;
  const R = MUD.road;
  if (x > R.x0 && x < R.x1) k *= sm(R.half, R.half + 2, Math.abs(z - R.z));
  for (const m of MOUNDS) { const r = Math.hypot(x - m.x, z - m.z) / m.r; if (r < 1.1) k *= sm(0.6, 1.1, r); }
  return k * MUD.level;
}
export const overlayB17 = () => ({ id: "B17", mud: mudB17, dh: moundDh, mounds: MOUNDS });
export { MOUTH };
