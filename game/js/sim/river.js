// sim/river.js — luật sông của B20 Bạch Đằng: Con nước, Nghi binh, mốc cọc, Thoát vây, cánh thủy quân, Kế Sách.
//
// Luật cứng (như sim/front.js): thuần, xác định; không Math.random, không hàm Math siêu việt, không đọc đồ họa.
// Trạng thái là MỘT object JSON thuần (checkpoint được). Tầng trận (director B20) gọi riverTick 1 Hz và tideAt mỗi
// khung để vẽ mượt. Hào Khí không ở đây: mọi khoản Hào Khí đi ra dưới dạng sự kiện {type:"hk", amount, source, ks?}
// (điểm GỐC, trước ×1,3 Trận nhanh) — director cộng qua sim/haokhi.js gain(). Hàm đổi trạng thái trả {ok, hk}
// với hk là tổng các sự kiện hk nó vừa đẩy (chỉ để tiện, KHÔNG cộng lần hai).
//
// Pha (chỉ số 0..5 = P1..P6), director gọi setPhase khi chuyển; sim chỉ phát sự kiện gợi ý chuyển:
//   P1 → P2: "khucCoc" (đầu hạm đội qua mốc Khúc cọc)       P2 → P3: "escortsReady" (≥ 4 hộ vệ bị hạ) | "p2Timeout"
//   P3 → P4: "tide50" (Kế Sách cọc xong, nước về 50%)        P4 → P5: "tideZero"
//   P5 → P6: director (kỳ hạm mắc cạn)
//
// Con nước theo pha (tính giải tích theo st.phaseT để không trôi số):
//   P1: 85 → 100 trong cửa sổ Nghi binh     P2: → sàn 55, 45 điểm trong p2Sec     P3: giữ; Kế Sách cọc xong → 50 trong 10 s
//   P4: 50 → 0 trong p4Sec (135 / 180 s)     P5–P6: 0

import { TIDE, FLEET, LIGHT_BOATS, KE_SACH, KS_ORDER, ESCAPE, STAKES, WINGS, WING_SK, WING_ORDERS, MAP } from "../data/battle-b20.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const TRIB_WINGS = ["chanh", "rut", "gia"];
export const KS_STATE_WORD = { khoa: "Khóa", khadung: "Khả dụng", sansang: "Sẵn sàng", thanhcong: "Thành công", thatbai: "Thất bại" };
export const PHASE = { P1: 0, P2: 1, P3: 2, P4: 3, P5: 4, P6: 5 };

// mods: ksWindow (cửa sổ Kế Sách +%, gồm nội tại Tiết Chế của H31 +0,15), wingSk (Sĩ Khí mở màn các cánh, H31
// +20), cmdCd (nhân CD Mệnh Lệnh). quyetSachOk: Quyết sách chọn đúng → "Tình báo sớm" (báo trước thuyền dò).
export function createRiver({ mode = "nhanh", R = 25, diff = 3, mods = {}, quyetSachOk = false } = {}) {
  const m = { ksWindow: 0, wingSk: 0, cmdCd: 1, ...mods };
  const st = {
    t: 0, phase: -1, phaseT: 0, mode, R, diff, intel: !!quyetSachOk, mods: m,
    winMult: 1 + m.ksWindow,
    tide: TIDE.p1.from, tide0: TIDE.p1.from, tideRate: 0, tideT: 0,
    drop: null,                                      // { from, left } — P3 rút 10 s về 50
    flags: {},                                       // sự kiện một lần (khucCoc, tide50, strandAt…)
    fleet: {
      headX: MAP.fleetHead.x, speed: 0, cmdActive: FLEET.cmdShips,
      escortsTotal: 0, escortsDown: 0, captured: 0, sunk: 0, downP4: 0,
      scoutN: 0, scoutNext: 0, reachShare: KE_SACH.nghiBinh.effect.failShare,
      x20NoTide: 0, sk: 50,
    },
    nghi: { flotX: MAP.challenge.x, gap: MAP.challenge.x - MAP.fleetHead.x, stance: null, stanceCd: 0,
            kk: 0, lost: 0, lossT: 0, crossedAt: -1 },
    markers: {},
    escape: { value: 0, full: false },
    wings: {},
    cooldowns: { tiencong: 0, giuvung: 0, theota: 0, tiepvien: 0 },
    reinf: { charges: WING_ORDERS.tiepvien.charges, pending: [] },
    ks: {},
    hkPaid: 0, hkLog: {},                           // tổng điểm gốc đã phát (telemetry, kiểm thử)
  };
  for (const s of STAKES) st.markers[s.id] = { id: s.id, state: "hidden", officerOn: false, officerOnT: 0, at: -1, by: null };
  for (const id in WINGS) {
    const w = WINGS[id];
    st.wings[id] = { id, q: w.q, q0: w.q, boats: w.boats, sk: clamp(WING_SK + m.wingSk, 0, 100), order: null, sortie: false };
  }
  for (const id of KS_ORDER) {
    if (!KE_SACH[id].modes.includes(mode)) continue;
    st.ks[id] = { id, state: "khoa", got: 0, left: 0, window: 0, at: -1, why: null };
  }
  setPhase(st, 0);
  return st;
}

// ---- tiện ích nội bộ ------------------------------------------------------------------------
function payHk(st, amount, source, events, ks) {
  if (!(amount > 0)) return 0;
  st.hkPaid += amount; st.hkLog[source] = (st.hkLog[source] || 0) + amount;
  events.push(ks ? { type: "hk", amount, source, ks } : { type: "hk", amount, source });
  return amount;
}
// Thưởng Kế Sách: cộng không vượt khung (trần cả trận).
function ksReward(st, id, amount, events) {
  const k = st.ks[id]; if (!k) return 0;
  const add = Math.max(0, Math.min(amount, KE_SACH[id].hk - k.got));
  if (add > 0) { k.got += add; payHk(st, add, "kế sách:" + KE_SACH[id].name, events, id); }
  return add;
}
function ksOpen(st, id, events) {
  const k = st.ks[id]; if (!k || k.state !== "khoa") return;
  const w = KE_SACH[id].window;
  k.state = "khadung"; k.at = st.t;
  k.window = k.left = w ? Math.round(w[st.mode] * st.winMult) : 0;
  events.push({ type: "ksOpen", id, window: k.window });
}
function ksSucceed(st, id, events) {
  const k = st.ks[id]; if (!k || k.state === "thanhcong" || k.state === "thatbai") return 0;
  k.state = "thanhcong"; k.left = 0; k.at = st.t;
  const hk = ksReward(st, id, KE_SACH[id].hk, events);
  events.push({ type: "ksResult", id, ok: true });
  return hk;
}
function ksFail(st, id, why, events) {
  const k = st.ks[id]; if (!k || k.state === "thanhcong" || k.state === "thatbai") return;
  k.state = "thatbai"; k.left = 0; k.at = st.t; k.why = why;
  events.push({ type: "ksResult", id, ok: false, why });
}
const ksDone = (k) => !k || k.state === "thanhcong" || k.state === "thatbai";
const ksOk = (st, id) => st.ks[id]?.state === "thanhcong";
function once(st, key, events, ev) { if (st.flags[key]) return false; st.flags[key] = true; events.push(ev); return true; }

export const activeMarkers = (st) => { let n = 0; for (const id in st.markers) if (st.markers[id].state === "active") n++; return n; };
export const exposedMarkers = (st) => { let n = 0; for (const id in st.markers) if (st.markers[id].state === "exposed") n++; return n; };
const hiddenMarkers = (st) => { let n = 0; for (const id in st.markers) if (st.markers[id].state === "hidden") n++; return n; };
export const escortsLeft = (st) => st.fleet.escortsTotal - st.fleet.escortsDown;

// ---- Con nước ---------------------------------------------------------------------------------
function p1Window(st) { return st.ks.nghiBinh ? Math.round(KE_SACH.nghiBinh.window[st.mode] * st.winMult) : 90; }

// Mức nước giải tích của pha hiện tại tại giây phaseT. Đặt st.tideRate (điểm/s) cho nội suy khung hình.
function tideNow(st) {
  const T = TIDE, pt = st.phaseT;
  switch (st.phase) {
    case 0: {
      const W = p1Window(st), v = T.p1.from + (T.p1.to - T.p1.from) * pt / W;
      st.tideRate = v < T.p1.to ? (T.p1.to - T.p1.from) / W : 0;
      return Math.min(T.p1.to, v);
    }
    case 1: {
      const rate = (T.p1.to - T.p2Floor) / T.p2Sec[st.mode], v = st.tide0 - rate * pt;
      st.tideRate = v > T.p2Floor ? -rate : 0;
      return Math.max(Math.min(st.tide0, T.p2Floor), v);
    }
    case 2: {
      if (!st.drop) { st.tideRate = 0; return st.tide0; }
      const d = st.drop, rate = (d.from - T.p3HoldTo) / T.p3DropSec, v = d.from - rate * d.t;
      st.tideRate = v > T.p3HoldTo ? -rate : 0;
      return Math.max(T.p3HoldTo, v);
    }
    case 3: {
      const S = T.p4Sec[st.mode], v = st.tide0 - st.tide0 * pt / S;
      st.tideRate = v > 0 ? -st.tide0 / S : 0;
      return Math.max(0, v);
    }
    default: st.tideRate = 0; return 0;
  }
}

// Con nước 0..100 hiện tại, nội suy trong giây (st.tideT ∈ [0,1) do tideAt tích).
export function tidePct(st) {
  const v = st.tide + st.tideRate * st.tideT;
  return clamp(v, 0, 100);
}
// Gọi mỗi khung với dt (giây): tích phần lẻ giây từ tick 1 Hz gần nhất rồi trả Con nước nội suy.
export function tideAt(st, dt) {
  st.tideT = Math.min(0.999, st.tideT + Math.max(0, dt));
  return tidePct(st);
}
// Giây còn lại tới khi nước về mức pct (Infinity nếu không đang rút tới đó).
export function secondsTo(st, pct) {
  if (st.tide <= pct) return 0;
  return st.tideRate < 0 ? (st.tide - pct) / -st.tideRate : Infinity;
}

// ---- Chuyển pha --------------------------------------------------------------------------------
export function setPhase(st, i, events = []) {
  if (i === st.phase) return st;
  const prev = st.phase;
  // chốt các Kế Sách còn dở của pha trước
  if (prev === 0 && i > 0) {
    if (!ksDone(st.ks.nghiBinh)) ksFail(st, "nghiBinh", "Hạm đội đã qua Khúc cọc khi mồi nhử chưa xong.", events);
  }
  if (prev <= 2 && i > 2 && !ksDone(st.ks.kichCoc)) resolveStakes(st, events);
  if (prev <= 3 && i > 3 && !ksDone(st.ks.conNuoc)) resolveTide(st, events);
  st.phase = i; st.phaseT = 0; st.tideT = 0;
  st.tide0 = st.tide;
  if (i === 0) { ksOpen(st, "nghiBinh", events); }
  if (i === 1) {
    st.fleet.escortsTotal += FLEET.escorts[0];
    st.fleet.scoutNext = st.t + FLEET.scoutFirst;           // theo st.t (đồng hồ trận) — qua pha 3 vẫn liền nhịp
    events.push({ type: "escorts", wave: 1, n: FLEET.escorts[0] });
  }
  if (i === 2) {
    st.drop = null;
    ksOpen(st, "kichCoc", events);
    if (st.ks.kichCoc && hiddenMarkers(st) === 0) resolveStakes(st, events);   // mọi mốc đã lộ từ pha 2
  }
  if (i === 3) {
    st.tide0 = TIDE.p3HoldTo; st.tide = TIDE.p3HoldTo; st.drop = null;
    ksOpen(st, "conNuoc", events);
    st.fleet.escortsTotal += FLEET.escorts[1];
    events.push({ type: "escorts", wave: 2, n: FLEET.escorts[1] });
  }
  if (i === 4) {
    st.tide0 = 0; st.tide = 0;
    for (const id of TRIB_WINGS) { st.wings[id].sortie = true; st.wings[id].sk = clamp(st.wings[id].sk + WING_ORDERS.tiencong.sk, 0, 100); }
    events.push({ type: "sortie", wings: TRIB_WINGS.slice(), share: strandShare(st) });
  }
  if (i === 5) {
    st.tide0 = 0; st.tide = 0;
    events.push({ type: "hkSet", value: 100, lock: true });   // canon pha 6: kịch bản đặt Hào Khí = 100 và khóa
  }
  st.tide = tideNow(st);
  events.push({ type: "phase", index: i, from: prev });
  return st;
}

// ---- Kế Sách cọc / Con nước: chốt kết quả ----------------------------------------------------------
function resolveStakes(st, events) {
  const k = st.ks.kichCoc;
  if (k && !ksDone(k)) {
    const n = activeMarkers(st);
    if (n >= KE_SACH.kichCoc.need) ksSucceed(st, "kichCoc", events);
    else ksFail(st, "kichCoc", `Chỉ mở được ${n}/3 mốc cọc.`, events);
  }
  // Nước bắt đầu rút về 50% trong 10 s (P3 → P4)
  if (st.phase === 2 && !st.drop) { st.drop = { from: st.tide, t: 0 }; events.push({ type: "tideDrop", sec: TIDE.p3DropSec }); }
}
function resolveTide(st, events) {
  const k = st.ks.conNuoc; if (ksDone(k)) return;
  const n = activeMarkers(st);
  if (!st.escape.full && n >= KE_SACH.conNuoc.need) ksSucceed(st, "conNuoc", events);
  else ksFail(st, "conNuoc", st.escape.full ? "Thanh Thoát vây đã đầy." : `Cọc chỉ giữ ${n}/3 hạm đội.`, events);
}

// Lệnh Kế Sách (nút G): Kế Sách cọc ở trạng thái Sẵn sàng thì chốt thành công ngay.
export function keSachTrigger(st, id, events = []) {
  const k = st.ks[id];
  if (!k || k.state !== "sansang") return { ok: false, why: k ? k.state : "none", hk: 0 };
  let hk = 0;
  if (id === "kichCoc") { const n0 = st.hkPaid; resolveStakes(st, events); hk = st.hkPaid - n0; }
  else return { ok: false, why: "auto", hk: 0 };
  return { ok: true, hk };
}

// ---- Một tick 1 s -------------------------------------------------------------------------------
export function riverTick(st, events = []) {
  st.t++; st.phaseT++; st.tideT = 0;
  for (const k in st.cooldowns) st.cooldowns[k] = Math.max(0, st.cooldowns[k] - 1);
  if (st.nghi.stanceCd > 0) st.nghi.stanceCd--;
  if (st.fleet.x20NoTide > 0) st.fleet.x20NoTide--;
  if (st.drop) st.drop.t++;

  // tiếp viện thủy quân tới nơi
  st.reinf.pending = st.reinf.pending.filter((p) => {
    if (st.t < p.at) return true;
    const w = st.wings[p.wing]; w.q += p.amount; w.sk = clamp(w.sk + 5, 0, 100);
    events.push({ type: "reinfArrived", wing: p.wing, amount: p.amount });
    return false;
  });

  st.tide = tideNow(st);

  if (st.phase === 0) tickLure(st, events);
  if (st.phase === 1 || st.phase === 2) tickScouts(st, events);
  // Pha 2–3: đầu hạm đội tiếp tục vào khúc cọc tới FLEET.stopX rồi neo (hạ đủ hộ vệ sớm thì hạm đội vẫn đi nốt, khối thuyền
  // luôn neo trong bãi cọc ở pha 4 — director-b20 đặt thuyền theo headX)
  if (st.phase === 1 || st.phase === 2) {
    const f = st.fleet;
    if (f.headX < FLEET.stopX) { f.speed = FLEET.p1Speed; f.headX = Math.min(FLEET.stopX, f.headX + f.speed); } else f.speed = 0;
  }
  if (st.phase === 1) {
    const f = st.fleet;
    if (f.escortsDown >= 4) once(st, "escortsReady", events, { type: "escortsReady", down: f.escortsDown });
    if (st.phaseT >= TIDE.p2Sec[st.mode]) once(st, "p2Timeout", events, { type: "p2Timeout" });
  }
  if (st.phase === 2) tickStakes(st, events);
  if (st.phase === 3) tickEbb(st, events);
  if (st.phase >= 4) {
    // thuyền mắc cạn: quân trên thuyền mất 1 Sĩ Khí/s (systems §5.8), theo tỉ lệ mắc cạn
    st.fleet.sk = Math.max(0, st.fleet.sk - FLEET.strandSkPerSec * strandShare(st));
  }
  tickWings(st, events);
  return st;
}

// P1: mồi nhử. Đầu hạm đội đi theo sức kéo; đoàn thuyền nhẹ về khoảng cách đích của thế đứng.
function tickLure(st, events) {
  const f = st.fleet, n = st.nghi, L = LIGHT_BOATS, k = st.ks.nghiBinh, P = FLEET.pull;
  const open = k && !ksDone(k);
  // sức kéo: mồi còn dở thì tùy khoảng cách và Khiêu khích; xong (thành hay hỏng) thì hạm đội cứ đi
  const pull = !open ? 1 : n.gap > L.gap.max ? P.lost : P.base + P.kk * n.kk / 100;
  f.speed = FLEET.p1Speed * pull;
  f.headX += f.speed;
  // đoàn thuyền nhẹ
  let v = 0;
  const target = n.stance ? L.stance[n.stance] : null;
  if (target != null) {
    const err = n.gap - target;                              // dương: xa hơn đích → giảm tốc tương đối
    v = f.speed - clamp(err, -L.approach, L.approach);
    v = clamp(v, -L.back, L.speed);
  }
  n.flotX += v;
  n.gap = n.flotX - f.headX;
  // sát quá: mất thuyền
  const fl = st.wings.flotilla;
  if (n.gap < L.gap.min && fl.boats > 0) {
    n.lossT++;
    if (n.lossT >= L.lossEvery) { n.lossT = 0; loseBoat(st, events, "sát hạm đội"); }
  } else n.lossT = 0;
  // Khiêu khích: thuyền nhẹ bắn tên khi áp sát; xa quá dải thì hạm đội nguội dần
  if (open) {
    if (n.stance === "tiencong" && n.gap <= L.provokeR) addProvoke(st, L.arrows, events);
    else if (n.gap > L.gap.max) n.kk = Math.max(0, n.kk - L.decay);
  }
  if (n.crossedAt < 0 && n.flotX >= MAP.khucCoc) { n.crossedAt = st.t; events.push({ type: "flotillaCrossed", gap: n.gap }); }
  if (open) {
    k.left--;
    const inBand = n.gap >= L.gap.min && n.gap <= L.gap.max;
    if (k.state === "sansang" && n.flotX >= MAP.khucCoc && inBand && n.lost <= L.lossMax) {
      ksSucceed(st, "nghiBinh", events);
      const E = KE_SACH.nghiBinh.effect;
      f.reachShare = E.reachShare; f.x20NoTide = E.x20NoTide;
    } else if (k.left <= 0) ksFail(st, "nghiBinh", "Hết thời gian mồi nhử.", events);
  }
  if (f.headX >= MAP.khucCoc) once(st, "khucCoc", events, { type: "khucCoc", headX: f.headX });
}

function addProvoke(st, amount, events) {
  const n = st.nghi, k = st.ks.nghiBinh, max = KE_SACH.nghiBinh.provoke.max;
  n.kk = Math.min(max, n.kk + amount);
  if (k && k.state === "khadung" && n.kk >= max) {
    k.state = "sansang";
    events.push({ type: "baited" });
    ksReward(st, "nghiBinh", KE_SACH.nghiBinh.partial.baited, events);
  }
}
function loseBoat(st, events, why) {
  const fl = st.wings.flotilla, n = st.nghi;
  if (fl.boats <= 0) return;
  fl.boats--; fl.q = Math.max(0, fl.q - LIGHT_BOATS.carry); n.lost++;
  events.push({ type: "boatLost", lost: n.lost, left: fl.boats, why });
  const k = st.ks.nghiBinh;
  if (st.phase === 0 && k && !ksDone(k) && n.lost > LIGHT_BOATS.lossMax) ksFail(st, "nghiBinh", "Mất quá 30% thuyền nhẹ.", events);
}

// Tầng trận báo: KO tiên phong ("ko") hay phá thế sĩ quan ("officer") trong pha 1.
export function provoke(st, kind, count = 1, events = []) {
  if (st.phase !== 0 || ksDone(st.ks.nghiBinh)) return { ok: false, hk: 0 };
  const P = KE_SACH.nghiBinh.provoke, n0 = st.hkPaid;
  addProvoke(st, (kind === "officer" ? P.officer : P.ko) * count, events);
  return { ok: true, kk: st.nghi.kk, hk: st.hkPaid - n0 };
}
// Tầng trận báo thuyền nhẹ bị đánh chìm thật (ngoài mô hình khoảng cách).
export function flotillaLoss(st, count = 1, events = []) {
  const n0 = st.hkPaid;
  for (let i = 0; i < count; i++) loseBoat(st, events, "bị đánh chìm");
  return { ok: true, lost: st.nghi.lost, hk: st.hkPaid - n0 };
}

// P2–P3: Trinh Sát Lòng Sông — mỗi 40 s một thuyền dò nhắm mốc kế tiếp chưa kích hoạt, chưa lộ.
function tickScouts(st, events) {
  const f = st.fleet;
  const tgt = () => {
    for (let i = 0; i < STAKES.length; i++) {
      const s = STAKES[(f.scoutN + i) % STAKES.length];
      if (st.markers[s.id].state === "hidden") return s.id;
    }
    return null;
  };
  if (st.intel && f.scoutNext - st.t === FLEET.scoutWarn) {
    const target = tgt(); if (target) events.push({ type: "scoutWarn", target, in: FLEET.scoutWarn });
  }
  if (st.t >= f.scoutNext) {
    const target = tgt();
    f.scoutNext = st.t + FLEET.scoutEvery;
    if (target) { f.scoutN++; events.push({ type: "scout", n: f.scoutN, target }); }
  }
}

// P3: tướng địch đứng ở mốc > 10 s → mốc lộ; hết cửa sổ thì chốt; nước rút về 50. Kế Sách cọc đã chốt (10 s nước rút về 50) thì mốc
// còn ẩn thôi bị dò — kế đã định, không còn gì để lộ (đợt 9 D4: trước đây toán dò đứng mốc thứ ba trong 10 s ấy làm lộ mốc, mất
// nhiệm vụ phụ "không để lộ mốc" dù Kế Sách đã thành).
function tickStakes(st, events) {
  const kc = st.ks.kichCoc, open = !kc || !ksDone(kc);
  for (const s of STAKES) {
    const m = st.markers[s.id];
    if (m.state !== "hidden" || !open) { m.officerOnT = 0; continue; }
    if (m.officerOn) {
      m.officerOnT++;
      if (m.officerOnT > s.exposeSec) exposeMarker(st, s.id, "officer", events);
    } else m.officerOnT = 0;
  }
  const k = st.ks.kichCoc;
  if (k && !ksDone(k)) { k.left--; if (k.left <= 0) resolveStakes(st, events); }
  else if (!k && !st.drop) resolveStakes(st, events);
  if (st.drop && st.tide <= TIDE.p3HoldTo) once(st, "tide50", events, { type: "tide50" });
}

// P4: Thoát vây; báo trước; cọc nhô ở 30%; nước ròng.
function tickEbb(st, events) {
  const E = ESCAPE, esc = st.escape, k = st.ks.conNuoc;
  if (!esc.full) {
    let holding = false;
    for (const id of TRIB_WINGS) if (st.wings[id].order?.id === "giuvung") holding = true;
    const rate = E.perCmdShip * st.fleet.cmdActive * (holding ? E.holdMult : 1);
    esc.value = Math.min(E.max, esc.value + rate);
    if (esc.value >= E.max) {
      esc.full = true;
      events.push({ type: "escapeFull" });
      ksFail(st, "conNuoc", "Thanh Thoát vây đã đầy.", events);
    }
  }
  if (secondsTo(st, TIDE.strandAt) <= TIDE.warn + 1e-6) once(st, "warnStrand", events, { type: "tideWarn", at: "strand", pct: TIDE.strandAt });
  if (st.tide <= TIDE.strandAt && once(st, "strandAt", events, { type: "strandAt", active: activeMarkers(st) })) {
    // cọc nhô giữ thuyền (+5): chỉ khi có bãi đã mở — không mốc nào mở thì cọc vẫn ngụy trang dưới bè, không giữ được ai (review B20)
    if (k && !ksDone(k) && !esc.full && activeMarkers(st) > 0) ksReward(st, "conNuoc", KE_SACH.conNuoc.partial.stakesUp, events);
  }
  if (secondsTo(st, 0) <= TIDE.warn + 1e-6) once(st, "warnEbb", events, { type: "tideWarn", at: "ebb", pct: 0 });
  if (st.tide <= 0 && once(st, "tideZero", events, { type: "tideZero" })) resolveTide(st, events);
}

// Cánh thủy quân: lệnh hết hạn, Sĩ Khí trôi về 50 (1 điểm mỗi 10 s, như front.js).
function tickWings(st, events) {
  for (const id in st.wings) {
    const w = st.wings[id];
    if (w.order && w.order.left > 0) { w.order.left--; if (w.order.left <= 0) { events.push({ type: "orderEnd", wing: id, order: w.order.id }); w.order = null; } }
    if (st.t % 10 === 0) w.sk += Math.sign(WING_SK - w.sk) * Math.min(1, Math.abs(WING_SK - w.sk));
    w.sk = clamp(w.sk, 0, 100);
  }
}

// ---- Tầng trận báo ----------------------------------------------------------------------------
// Một thuyền hộ vệ bị hạ (chiếm: "capture", đục chìm/đốt: "sink"). +3 Hào Khí như chiếm Đồn (systems §5.8);
// ở pha 4 kéo thanh Thoát vây −15.
export function onEscortDown(st, how = "capture", events = []) {
  const f = st.fleet;
  if (f.escortsDown >= f.escortsTotal) return { ok: false, why: "none", hk: 0 };
  f.escortsDown++;
  if (how === "sink") f.sunk++; else f.captured++;
  const hk = payHk(st, 3, "thuyền hộ vệ", events);
  if (st.phase === 3) {
    f.downP4++;
    if (!st.escape.full) st.escape.value = Math.max(0, st.escape.value - ESCAPE.perEscortDown);
  }
  events.push({ type: "escortDown", how, down: f.escortsDown, left: escortsLeft(st), escape: st.escape.value });
  return { ok: true, hk, escape: st.escape.value, left: escortsLeft(st) };
}

// Số thuyền chỉ huy còn hoạt động (Phàn Tiếp bị bắt → 1).
export function setCmdShips(st, n) { st.fleet.cmdActive = clamp(n | 0, 0, FLEET.cmdShips); }

// Tầng trận báo mỗi giây: có tướng / sĩ quan địch đứng trong vòng mốc hay không.
export function setMarkerOfficer(st, id, on) { const m = st.markers[id]; if (m) m.officerOn = !!on; }

function exposeMarker(st, id, by, events) {
  const m = st.markers[id];
  m.state = "exposed"; m.at = st.t; m.by = by; m.officerOnT = 0;
  events.push({ type: "markerExposed", id, by });
  checkStakesDone(st, events);
}
function checkStakesDone(st, events) {
  const k = st.ks.kichCoc;
  if (st.phase === 2 && k && !ksDone(k) && hiddenMarkers(st) === 0) resolveStakes(st, events);
}

// "activate": Tương tác 5 s xong ở mốc (chỉ pha 3). "expose": thuyền/đội dò chạm mốc mà không bị chặn (pha 2–3).
export function markerAction(st, id, what, events = []) {
  const m = st.markers[id];
  if (!m) return { ok: false, why: "id", hk: 0 };
  if (m.state !== "hidden") return { ok: false, why: m.state, hk: 0 };
  const n0 = st.hkPaid;
  if (what === "activate") {
    const k = st.ks.kichCoc;
    if (st.phase !== 2 || !k || ksDone(k)) return { ok: false, why: "phase", hk: 0 };
    m.state = "active"; m.at = st.t; m.by = "hero"; m.officerOnT = 0;
    events.push({ type: "markerActive", id, active: activeMarkers(st) });
    ksReward(st, "kichCoc", KE_SACH.kichCoc.partial.perMarker, events);
    if (k.state === "khadung" && activeMarkers(st) >= KE_SACH.kichCoc.need) { k.state = "sansang"; events.push({ type: "ksReady", id: "kichCoc" }); }
    checkStakesDone(st, events);
  } else if (what === "expose") {
    if (st.phase !== 1 && st.phase !== 2) return { ok: false, why: "phase", hk: 0 };
    if (st.phase === 2 && st.ks.kichCoc && ksDone(st.ks.kichCoc)) return { ok: false, why: "done", hk: 0 };   // kế cọc đã chốt
    exposeMarker(st, id, "scout", events);
  } else return { ok: false, why: "what", hk: 0 };
  return { ok: true, hk: st.hkPaid - n0, state: m.state };
}

// ---- Mệnh Lệnh cho cánh thủy quân (ý nghĩa B20, xem WING_ORDERS) -------------------------------------
export function order(st, wingId, orderId, events = []) {
  const w = st.wings[wingId], O = WING_ORDERS[orderId];
  if (!w || !O || orderId === "stanceCd") return { ok: false, why: "id" };
  // Pha 1, đoàn thuyền nhẹ: đổi thế đứng (giữ tới khi đổi), CD riêng ngắn.
  if (wingId === "flotilla" && st.phase === 0 && orderId !== "tiepvien") {
    if (st.nghi.stanceCd > 0) return { ok: false, why: "cd", cd: st.nghi.stanceCd };
    st.nghi.stance = orderId; st.nghi.stanceCd = WING_ORDERS.stanceCd;
    events.push({ type: "stance", stance: orderId });
    return { ok: true, stance: orderId, cd: WING_ORDERS.stanceCd };
  }
  if (st.cooldowns[orderId] > 0) return { ok: false, why: "cd", cd: st.cooldowns[orderId] };
  const cd = Math.max(O.cd * 0.5, O.cd * st.mods.cmdCd);
  const isTrib = TRIB_WINGS.includes(wingId);
  let extra = {};
  if (orderId === "tiencong") {
    if (isTrib && st.phase < 4) return { ok: false, why: "phuc" };          // thuyền phục phải ẩn tới pha 5
    w.order = { id: "tiencong", left: O.dur }; w.sortie = true;
    w.sk = clamp(w.sk + O.sk, 0, 100);
  } else if (orderId === "giuvung") {
    if (st.phase < 1) return { ok: false, why: "phase" };
    w.order = { id: "giuvung", left: O.dur };
  } else if (orderId === "theota") {
    if (st.phase < 1) return { ok: false, why: "phase" };
    extra = { ferry: true, sec: w.id === "flotilla" ? 5 : 8 };              // đò chuyển: gần 5 s, từ nhánh sông 8 s
  } else if (orderId === "tiepvien") {
    if (st.reinf.charges <= 0) return { ok: false, why: "charges" };
    st.reinf.charges--;
    st.reinf.pending.push({ wing: wingId, at: st.t + O.delay, amount: O.amount });
  }
  st.cooldowns[orderId] = cd;
  events.push({ type: "order", wing: wingId, order: orderId });
  return { ok: true, cd, ...extra };
}

// ---- Kết quả -----------------------------------------------------------------------------------
// Tỉ lệ thuyền trong vùng cọc mắc cạn ở pha 5 (systems §7): P3 và P4 đều thành công → 100%, không thì 50%.
export function strandShare(st) { return ksOk(st, "kichCoc") && ksOk(st, "conNuoc") ? 1 : 0.5; }

export function riverResult(st) {
  const keSach = {};
  let ok = 0;
  for (const id in st.ks) {
    const k = st.ks[id];
    keSach[id] = { id, name: KE_SACH[id].name, state: k.state, word: KS_STATE_WORD[k.state], got: k.got, hk: KE_SACH[id].hk, why: k.why };
    if (k.state === "thanhcong") ok++;
  }
  const markers = {};
  for (const id in st.markers) markers[id] = st.markers[id].state;
  return {
    keSach, keSachOk: ok, keSachN: Object.keys(st.ks).length,
    markers, markersActive: activeMarkers(st), markersExposed: exposedMarkers(st),
    escape: Math.round(st.escape.value * 10) / 10, escapeFull: st.escape.full,
    escorts: { total: st.fleet.escortsTotal, down: st.fleet.escortsDown, captured: st.fleet.captured, sunk: st.fleet.sunk },
    flotillaLost: st.nghi.lost, reachShare: st.fleet.reachShare, strandShare: strandShare(st),
    kRank: strandShare(st) === 1,                  // mất thành phần K của xếp hạng khi chỉ 50% mắc cạn (systems §7)
    hkRaw: st.hkPaid, intel: st.intel, timeSec: st.t,
  };
}

// Ảnh chụp để checkpoint (JSON thuần).
export const snapshotRiver = (st) => JSON.parse(JSON.stringify(st));
