// sim/b16.js — luật trận B16 Chương Dương, phần thuần (không three.js, không DOM; kiểm trong Node: tests/b16-sim.test.mjs).
// battle/director-b16.js đọc trạng thái này mỗi bước, tự sinh lính / vẽ vật / phát tiếng theo các sự kiện tickB16 trả về.
//
// Pha (data/battle-b16.js PHASES): 0 Hiệu triệu dân binh → 1 Đánh úp bến → 2 Cổng nam → 3 Trấn Nam vương → 4 Tụng giá hoàn kinh.
// Đầu vào mỗi bước (inp): hero { x, z, alive }, foesAt(x, z, r) → số địch còn đánh được trong vòng, ramMoving (xe húc có người đẩy và
// không bị chặn — director quyết), bossDown (Thoát Hoan đã rút). Sự kiện trả về: { type, … } theo thứ tự xảy ra trong bước.

import { VILLAGES, VILLAGES_TO_ADVANCE, BOATS, BOAT_RULE, LANDING, RAM, GATES, GATE_SOUTH, GATE_EAST, PALACE, TIMEOUT_B16, KE_SACH } from "../data/battle-b16.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function routeLen(route) { let L = 0; for (let i = 0; i < route.length - 1; i++) L += dist(route[i], route[i + 1]); return L; }
// điểm ở quãng s (m) trên đường gấp khúc: { x, z, yaw, done }
export function along(route, s) {
  let left = Math.max(0, s);
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1], L = dist(a, b);
    if (left <= L) { const t = left / L; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z), done: false }; }
    left -= L;
  }
  const a = route[route.length - 2], b = route[route.length - 1];
  return { x: b.x, z: b.z, yaw: Math.atan2(b.x - a.x, b.z - a.z), done: true };
}

// S: hệ số độ bền theo cấp trận (data/tuning.js S(R)) — cổng như B15: hp gốc × S(R).
// ksWin: hệ số cửa sổ Kế Sách (Trận nhanh 0,75).
export function createB16({ S = 1, timeout = TIMEOUT_B16, ksWin = 1 } = {}) {
  const gate = (G) => ({ id: G.id, hp0: Math.round(G.hp * S), hp: Math.round(G.hp * S), open: false });
  return {
    t: 0, phase: 0, phaseT: 0, timeout, over: false, won: null, why: null,
    villages: VILLAGES.map((v) => ({ id: v.id, p: 0, done: false, blocked: false })), rallied: 0,
    boats: BOATS.map((b) => ({ id: b.id, p: 0, burnt: false })), burnt: 0, alarmT: null,
    landing: { p: 0, taken: false, takenT: null },
    ram: { s: 0, len: routeLen(RAM.route), arrived: false, ambush: RAM.ambush.map(() => false) },
    gates: { [GATE_SOUTH]: gate(GATES[GATE_SOUTH]), [GATE_EAST]: gate(GATES[GATE_EAST]) },
    bossDown: false, palace: { p: 0, taken: false },
    main: [false, false, false, false, false],
    allVillagesBeforeLanding: false,
    // Kế Sách: state "khadung" → "sansang" (danhUp: đang trong cửa sổ) → "thanhcong" | "thatbai"
    ks: { danhUp: { state: "khadung", left: null, window: KE_SACH.danhUp.window * ksWin }, danBinh: { state: "khadung" } },
    // nhắc tương tác của bước vừa chạy (director đưa lên ctx.hud.prompt): { text, p } | null
    prompt: null,
  };
}

// Vòng chiếm "đứng trong vòng, không địch thì tiến độ tăng": trả "done" | "blocked" | "in" | null (tướng ngoài vòng)
function holdRing(o, c, r, sec, inp, dt) {
  const h = inp.hero;
  if (!h.alive || dist(h, c) > r) return null;
  if (inp.foesAt(c.x, c.z, r) > 0) return "blocked";
  o.p = Math.min(1, o.p + dt / sec);
  return o.p >= 1 ? "done" : "in";
}

function setPhase(st, i, ev) { st.phase = i; st.phaseT = 0; ev.push({ type: "phase", phase: i }); }

export function tickB16(st, inp, dt) {
  const ev = [];
  if (st.over) return ev;
  st.t += dt; st.phaseT += dt; st.prompt = null;

  // ---- làng dân binh: pha 0, và pha 1 tới khi chiếm bến ----
  if (st.phase <= 1) {
    VILLAGES.forEach((V, i) => {
      const v = st.villages[i];
      if (v.done) return;
      const r = holdRing(v, V, V.r, V.hold, inp, dt);
      v.blocked = r === "blocked";
      if (r === "blocked") st.prompt = { text: `Lính Nguyên còn trong ${V.name} — dẹp chúng để dân binh tập hợp`, p: v.p };
      else if (r === "in") st.prompt = { text: `Dân binh ${V.name} đang tập hợp`, p: v.p };
      else if (r === "done") {
        v.done = true; st.rallied++;
        ev.push({ type: "villageRallied", id: V.id, n: st.rallied });
      }
    });
    if (st.phase === 0 && st.rallied >= VILLAGES_TO_ADVANCE) { st.main[0] = true; setPhase(st, 1, ev); }
  }

  // ---- bến: đốt thuyền neo, rồi chiếm vòng bến ----
  if (st.phase === 1) {
    const h = inp.hero;
    BOATS.forEach((B, i) => {
      const b = st.boats[i];
      if (b.burnt || !h.alive || dist(h, B) > BOAT_RULE.reach) return;
      if (st.alarmT == null) { st.alarmT = st.t; ev.push({ type: "alarm" }); }
      if (inp.foesAt(B.x, B.z, BOAT_RULE.clearR + 1.5) > 0) { st.prompt = { text: "Địch kề bên — dẹp chúng rồi châm lửa thuyền", p: b.p }; return; }
      b.p = Math.min(1, b.p + dt / BOAT_RULE.burnSec);
      st.prompt = { text: "Châm lửa thuyền neo", p: b.p };
      if (b.p >= 1) { b.burnt = true; st.burnt++; ev.push({ type: "boatBurnt", id: B.id, n: st.burnt }); }
    });
    const K = st.ks.danhUp;
    if (st.alarmT != null && K.state === "khadung") { K.state = "sansang"; K.left = K.window; }
    if (K.state === "sansang") {
      K.left = Math.max(0, K.window - (st.t - st.alarmT));
      if (st.burnt >= KE_SACH.danhUp.need) ksResult(st, "danhUp", true, ev);
      else if (K.left <= 0) ksResult(st, "danhUp", false, ev);
    }
    if (st.alarmT == null && h.alive && dist(h, LANDING) < LANDING.r + 30) { st.alarmT = st.t; ev.push({ type: "alarm" }); }
    if (st.burnt >= BOATS.length) {
      const r = holdRing(st.landing, LANDING, LANDING.r, LANDING.capSec, inp, dt);
      if (r === "blocked") st.prompt = { text: "Quân Nguyên còn trên bến — dẹp chúng để chiếm bến", p: st.landing.p };
      else if (r === "in") st.prompt = { text: "Chiếm bến Chương Dương", p: st.landing.p };
      else if (r === "done") {
        st.landing.taken = true; st.landing.takenT = st.t; st.main[1] = true;
        st.allVillagesBeforeLanding = st.rallied >= VILLAGES.length;
        ev.push({ type: "landingTaken", allVillages: st.allVillagesBeforeLanding });
        ksResult(st, "danBinh", st.allVillagesBeforeLanding, ev);
        setPhase(st, 2, ev);
      }
    }
  }

  // ---- cổng: xe húc tới cổng nam, cánh Trần Quang Khải ở cổng đông ----
  if (st.phase >= 2) {
    const E = st.gates[GATE_EAST];
    if (!E.open) { E.hp = Math.max(0, E.hp - GATES[GATE_EAST].wingDps * E.hp0 * dt); if (E.hp <= 0) openGate(st, GATE_EAST, ev); }
  }
  if (st.phase === 2) {
    const R = st.ram, G = st.gates[GATE_SOUTH];
    if (!R.arrived && inp.ramMoving) {
      R.s = Math.min(R.len, R.s + RAM.speed * dt);
      if (R.s >= R.len) { R.arrived = true; ev.push({ type: "ramArrived" }); }
    }
    const u = R.s / R.len;
    RAM.ambush.forEach((A, i) => { if (!R.ambush[i] && u >= A.atU) { R.ambush[i] = true; ev.push({ type: "ambush", i }); } });
    if (R.arrived && !G.open) { G.hp = Math.max(0, G.hp - RAM.dps * G.hp0 * dt); if (G.hp <= 0) openGate(st, GATE_SOUTH, ev); }
  }
  if (st.phase === 2 && st.gates[GATE_SOUTH].open) { st.main[2] = true; setPhase(st, 3, ev); }

  // ---- Thoát Hoan, điện chính ----
  if (st.phase === 3 && inp.bossDown) { st.bossDown = true; st.main[3] = true; setPhase(st, 4, ev); }
  if (st.phase === 4) {
    const r = holdRing(st.palace, PALACE, PALACE.r, PALACE.capSec, inp, dt);
    if (r === "blocked") st.prompt = { text: "Quân Nguyên còn giữ điện — dẹp chúng để cắm cờ", p: st.palace.p };
    else if (r === "in") st.prompt = { text: "Cắm cờ trên điện chính", p: st.palace.p };
    else if (r === "done") { st.palace.taken = true; st.main[4] = true; finish(st, true, "Quân Trần thu hồi kinh thành Thăng Long.", ev); }
  }

  // ---- thua theo giờ: 30 phút chưa mở cổng nam ----
  if (!st.over && st.t >= st.timeout && !st.gates[GATE_SOUTH].open) finish(st, false, "Quá 30 phút mà chưa mở được cổng nam kinh thành.", ev);
  return ev;
}

// Kế Sách có kết quả. danhUp thành công: cổng nam mất gateCut độ bền gốc ngay (canon "cổng nam giảm 30% HP").
function ksResult(st, id, ok, ev) {
  const K = st.ks[id];
  if (K.state === "thanhcong" || K.state === "thatbai") return;
  K.state = ok ? "thanhcong" : "thatbai";
  if (ok && id === "danhUp") { const G = st.gates[GATE_SOUTH]; G.hp = Math.max(1, G.hp - KE_SACH.danhUp.gateCut * G.hp0); }
  ev.push({ type: "keSach", id, ok });
}

function openGate(st, id, ev) { const g = st.gates[id]; if (g.open) return; g.open = true; g.hp = 0; ev.push({ type: "gateOpen", id }); }

// Đòn tướng (và Tuyệt Kỹ) vào cổng: chỉ từ pha 2 (Cổng nam). Trả lượng đã trừ.
export function damageGateB16(st, id, dmg, ev = []) {
  const g = st.gates[id];
  if (!g || g.open || st.phase < 2 || st.over) return 0;
  const d = Math.min(g.hp, dmg); g.hp -= d;
  if (g.hp <= 0) openGate(st, id, ev);
  return d;
}

export function finish(st, won, why, ev = []) {
  if (st.over) return ev;
  st.over = true; st.won = won; st.why = why;
  ev.push({ type: won ? "win" : "lose", why });
  return ev;
}

// Nhiệm vụ phụ (SIDE_MISSIONS): S_VILLAGES đủ 3 làng, S_EAST cổng đông mở; S_NOREVIVE director tự xét
export function sideB16(st, { revived = false } = {}) {
  return { S_VILLAGES: st.rallied >= VILLAGES.length, S_EAST: st.gates[GATE_EAST].open, S_NOREVIVE: !revived };
}

export const snapshotB16 = (st) => JSON.parse(JSON.stringify(st));
export function restoreB16(st, snap) { for (const k of Object.keys(st)) delete st[k]; Object.assign(st, JSON.parse(JSON.stringify(snap))); return st; }
