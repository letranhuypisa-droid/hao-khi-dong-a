// sim/river.js — luật sông của B20 Bạch Đằng: Con nước, Nghi binh, bãi cọc, cánh thủy quân, Kế Sách.
//
// Luật cứng (như sim/front.js): thuần, xác định; không Math.random, không hàm Math siêu việt, không đọc đồ họa.
// Trạng thái là MỘT object JSON thuần (checkpoint được). Tầng trận (director B20) gọi riverTick 1 Hz (mô phỏng, không phải giây
// thật: cảnh tua chạy nhanh TUA.rate lần) và tideAt mỗi khung để vẽ mượt. Hào Khí không ở đây: mọi khoản Hào Khí đi ra dưới dạng
// sự kiện {type:"hk", amount, source, ks?} (điểm GỐC, trước ×1,3 Trận nhanh) — director cộng qua sim/haokhi.js gain(). Hàm đổi
// trạng thái trả {ok, hk} với hk là tổng các sự kiện hk nó vừa đẩy (chỉ để tiện, KHÔNG cộng lần hai).
//
// Pha (chỉ số 0..5 = P1..P6), director gọi setPhase khi chuyển; sim chỉ phát sự kiện gợi ý chuyển:
//   P1 → P2: "khucCoc" (đầu hạm đội qua mốc Khúc cọc)     P2 → P3: "fleetIn" (đầu hạm đội tới FLEET.stopX)
//   P3 → P4: "tide50" (nước về 50%)                        P4 → P5: "tideZero" (nước ròng)      P5 → P6: director (kỳ hạm mắc cạn)
// Người chơi chỉ làm việc ở P1 (MỘT lệnh launch = "Ra khiêu chiến", rồi đánh lính Nguyên đổ bộ lên thuyền chỉ huy) và P5–P6 (boss).
// P2–P4 là cảnh tua tự chạy: hạm đội vào bãi cọc, nước rút, cọc nhô, thuyền Nguyên mắc cọc.
//
// Con nước theo pha (tính giải tích theo st.phaseT để không trôi số):
//   P1: 85 → 100 trong cửa sổ Nghi binh, chỉ tính từ lúc ra lệnh   P2: giữ    P3: → 50 trong TIDE.tua.p3Sec
//   P4: 50 → 0 trong TIDE.tua.p4Sec (cọc nhô ở 30%)                P5–P6: 0

import { TIDE, FLEET, LIGHT_BOATS, KE_SACH, KS_ORDER, WINGS, WING_SK, WING_ORDERS, MAP } from "../data/battle-b20.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const TRIB_WINGS = ["chanh", "rut", "gia"];
export const KS_STATE_WORD = { khoa: "Khóa", khadung: "Khả dụng", sansang: "Sẵn sàng", thanhcong: "Thành công", thatbai: "Thất bại" };
export const PHASE = { P1: 0, P2: 1, P3: 2, P4: 3, P5: 4, P6: 5 };

// mods: ksWindow (cửa sổ Kế Sách +%, gồm nội tại Tiết Chế của H31 +0,15), wingSk (Sĩ Khí mở màn các cánh, H31
// +20), cmdCd (nhân CD Mệnh Lệnh). quyetSachOk: Quyết sách chọn đúng → "Kế đã định" (bản đồ nhỏ hiện đường hạm đội, bãi cọc).
export function createRiver({ mode = "nhanh", R = 25, diff = 3, mods = {}, quyetSachOk = false } = {}) {
  const m = { ksWindow: 0, wingSk: 0, cmdCd: 1, ...mods };
  const st = {
    t: 0, phase: -1, phaseT: 0, mode, R, diff, intel: !!quyetSachOk, mods: m,
    winMult: 1 + m.ksWindow,
    tide: TIDE.p1.from, tide0: TIDE.p1.from, tideRate: 0, tideT: 0,
    flags: {},                                       // sự kiện một lần (khucCoc, fleetIn, tide50, strandAt…)
    fleet: {
      headX: MAP.fleetHead.x, speed: 0, reachShare: KE_SACH.nghiBinh.effect.failShare,
      x20NoTide: 0, sk: 50,
    },
    // launched: đã ra lệnh khiêu chiến (trước đó hạm đội và đoàn thuyền nhẹ đứng yên, đồng hồ pha 1 chưa chạy);
    // stance: thế đứng đoàn thuyền tự chọn ("tiencong" tới khi Khiêu khích đầy, rồi "giuvung")
    nghi: { flotX: MAP.challenge.x, gap: MAP.challenge.x - MAP.fleetHead.x, launched: false, stance: null, kk: 0, crossedAt: -1 },
    wings: {},
    cooldowns: { tiencong: 0, giuvung: 0, theota: 0, tiepvien: 0 },
    reinf: { charges: WING_ORDERS.tiepvien.charges, pending: [] },
    ks: {},
    hkPaid: 0, hkLog: {},                           // tổng điểm gốc đã phát (telemetry, kiểm thử)
  };
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

// ---- Con nước ---------------------------------------------------------------------------------
function p1Window(st) { return st.ks.nghiBinh ? Math.round(KE_SACH.nghiBinh.window[st.mode] * st.winMult) : 90; }

// Mức nước giải tích của pha hiện tại tại giây phaseT. Đặt st.tideRate (điểm/s) cho nội suy khung hình.
function tideNow(st) {
  const T = TIDE, pt = st.phaseT;
  switch (st.phase) {
    case 0: {
      const W = p1Window(st), v = T.p1.from + (T.p1.to - T.p1.from) * pt / W;
      st.tideRate = st.nghi.launched && v < T.p1.to ? (T.p1.to - T.p1.from) / W : 0;   // chưa ra lệnh: nước đứng
      return Math.min(T.p1.to, v);
    }
    case 1: st.tideRate = 0; return st.tide0;
    case 2: {
      const S = T.tua.p3Sec, top = Math.max(st.tide0, T.p3HoldTo), rate = (top - T.p3HoldTo) / S, v = top - rate * pt;
      st.tideRate = v > T.p3HoldTo ? -rate : 0;
      return Math.max(T.p3HoldTo, v);
    }
    case 3: {
      const S = T.tua.p4Sec, v = st.tide0 - st.tide0 * pt / S;
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
// Gọi mỗi khung với dt (giây MÔ PHỎNG, = giây thật × tốc độ tua): tích phần lẻ giây từ tick 1 Hz gần nhất rồi trả Con nước nội suy.
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
  if (prev <= 2 && i > 2) resolveStakes(st, events);
  if (prev <= 3 && i > 3) resolveTide(st, events);
  st.phase = i; st.phaseT = 0; st.tideT = 0;
  st.tide0 = st.tide;
  if (i === 0) { ksOpen(st, "nghiBinh", events); }
  if (i === 2) { ksOpen(st, "kichCoc", events); resolveStakes(st, events); }   // bãi cọc tự xét ngay khi hạm đội đã vào
  if (i === 3) { st.tide0 = TIDE.p3HoldTo; st.tide = TIDE.p3HoldTo; ksOpen(st, "conNuoc", events); }
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

// ---- Kế Sách bãi cọc / Con nước: tự xét ----------------------------------------------------------
// Cọc đóng sẵn: bãi cọc giữ được hạm đội khi mồi nhử thành công (≥ 70% hạm đội vào khúc cọc — canon Nghi binh).
function resolveStakes(st, events) {
  const k = st.ks.kichCoc; if (ksDone(k)) return;
  if (ksOk(st, "nghiBinh")) ksSucceed(st, "kichCoc", events);
  else ksFail(st, "kichCoc", "Mồi nhử chưa thành: chỉ một nửa hạm đội vào bãi cọc.", events);
}
// Nước ròng: Con nước thành công khi bãi cọc đã giữ được hạm đội.
function resolveTide(st, events) {
  const k = st.ks.conNuoc; if (ksDone(k)) return;
  if (ksOk(st, "kichCoc")) ksSucceed(st, "conNuoc", events);
  else ksFail(st, "conNuoc", "Bãi cọc chỉ giữ được một nửa hạm đội.", events);
}

// ---- Một tick 1 s -------------------------------------------------------------------------------
export function riverTick(st, events = []) {
  st.t++; st.tideT = 0;
  if (!(st.phase === 0 && !st.nghi.launched)) st.phaseT++;       // chờ lệnh khiêu chiến: đồng hồ pha 1 và Con nước chưa chạy
  for (const k in st.cooldowns) st.cooldowns[k] = Math.max(0, st.cooldowns[k] - 1);
  if (st.fleet.x20NoTide > 0) st.fleet.x20NoTide--;

  // tiếp viện thủy quân tới nơi
  st.reinf.pending = st.reinf.pending.filter((p) => {
    if (st.t < p.at) return true;
    const w = st.wings[p.wing]; w.q += p.amount; w.sk = clamp(w.sk + 5, 0, 100);
    events.push({ type: "reinfArrived", wing: p.wing, amount: p.amount });
    return false;
  });

  st.tide = tideNow(st);

  if (st.phase === 0) tickLure(st, events);
  if (st.phase === 1) tickFleetIn(st, events);
  if (st.phase === 2 && st.tide <= TIDE.p3HoldTo + 1e-9) once(st, "tide50", events, { type: "tide50" });
  if (st.phase === 3) tickEbb(st, events);
  if (st.phase >= 4) {
    // thuyền mắc cạn: quân trên thuyền mất 1 Sĩ Khí/s (systems §5.8), theo tỉ lệ mắc cạn
    st.fleet.sk = Math.max(0, st.fleet.sk - FLEET.strandSkPerSec * strandShare(st));
  }
  tickWings(st, events);
  return st;
}

// Ra lệnh khiêu chiến (nút Ra khiêu chiến / Lệnh Kế Sách / Mệnh Lệnh Tiến công ở pha 1): từ đây đoàn thuyền nhẹ tự lái.
export function launch(st, events = []) {
  if (st.phase !== 0) return { ok: false, why: "phase" };
  if (st.nghi.launched) return { ok: false, why: "done" };
  st.nghi.launched = true;
  events.push({ type: "launched" });
  return { ok: true };
}

// P1: mồi nhử. Chưa ra lệnh: hạm đội và đoàn thuyền nhẹ đứng yên. Đã ra lệnh: đầu hạm đội đi theo sức kéo; đoàn thuyền nhẹ tự chọn
// thế đứng — áp sát khiêu chiến (≈ 20 m) cho tới khi Khiêu khích đầy, rồi lui dụ giữ ≈ 28 m — và về khoảng cách đích.
function tickLure(st, events) {
  const f = st.fleet, n = st.nghi, L = LIGHT_BOATS, k = st.ks.nghiBinh, P = FLEET.pull;
  if (!n.launched) { f.speed = 0; return; }
  const open = k && !ksDone(k);
  n.stance = open && k.state === "khadung" ? "tiencong" : "giuvung";
  // sức kéo: mồi còn dở thì tùy khoảng cách và Khiêu khích; xong (thành hay hỏng) thì hạm đội cứ đi
  const pull = !open ? 1 : n.gap > L.gap.max ? P.lost : P.base + P.kk * n.kk / 100;
  f.speed = FLEET.p1Speed * pull;
  f.headX += f.speed;
  // đoàn thuyền nhẹ
  const err = n.gap - L.stance[n.stance];                  // dương: xa hơn đích → giảm tốc tương đối
  const v = clamp(f.speed - clamp(err, -L.approach, L.approach), -L.back, L.speed);
  n.flotX += v;
  n.gap = n.flotX - f.headX;
  // Khiêu khích: thuyền nhẹ bắn tên khi áp sát; xa quá dải thì hạm đội nguội dần
  if (open) {
    if (n.stance === "tiencong" && n.gap <= L.provokeR) addProvoke(st, L.arrows, events);
    else if (n.gap > L.gap.max) n.kk = Math.max(0, n.kk - L.decay);
  }
  if (n.crossedAt < 0 && n.flotX >= MAP.khucCoc) { n.crossedAt = st.t; events.push({ type: "flotillaCrossed", gap: n.gap }); }
  if (open) {
    k.left--;
    const inBand = n.gap >= L.gap.min && n.gap <= L.gap.max;
    if (k.state === "sansang" && n.flotX >= MAP.khucCoc && inBand) {
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

// Tầng trận báo: KO tiên phong ("ko") hay phá thế sĩ quan ("officer") trong pha 1.
export function provoke(st, kind, count = 1, events = []) {
  if (st.phase !== 0 || ksDone(st.ks.nghiBinh)) return { ok: false, hk: 0 };
  const P = KE_SACH.nghiBinh.provoke, n0 = st.hkPaid;
  addProvoke(st, (kind === "officer" ? P.officer : P.ko) * count, events);
  return { ok: true, kk: st.nghi.kk, hk: st.hkPaid - n0 };
}

// P2: cảnh tua — hạm đội theo mồi vào bãi cọc tới FLEET.stopX rồi neo, nước đứng ở đỉnh.
function tickFleetIn(st, events) {
  const f = st.fleet;
  if (f.headX < FLEET.stopX) { f.speed = FLEET.tuaSpeed; f.headX = Math.min(FLEET.stopX, f.headX + f.speed); } else f.speed = 0;
  if (f.headX >= FLEET.stopX) once(st, "fleetIn", events, { type: "fleetIn" });
}

// P4: cọc nhô ở 30%, nước ròng.
function tickEbb(st, events) {
  if (st.tide <= TIDE.strandAt) once(st, "strandAt", events, { type: "strandAt" });
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

// ---- Mệnh Lệnh cho cánh thủy quân (ý nghĩa B20, xem WING_ORDERS) -------------------------------------
export function order(st, wingId, orderId, events = []) {
  const w = st.wings[wingId], O = WING_ORDERS[orderId];
  if (!w || !O) return { ok: false, why: "id" };
  // Pha 1, đoàn thuyền nhẹ: mọi lệnh (trừ tiếp viện) là "Ra khiêu chiến" — đoàn tự lái từ đó.
  if (wingId === "flotilla" && st.phase === 0 && orderId !== "tiepvien") return launch(st, events);
  if (orderId === "giuvung") return { ok: false, why: "nouse" };            // không còn việc cho Giữ vững
  if (st.cooldowns[orderId] > 0) return { ok: false, why: "cd", cd: st.cooldowns[orderId] };
  const cd = Math.max(O.cd * 0.5, O.cd * st.mods.cmdCd);
  const isTrib = TRIB_WINGS.includes(wingId);
  let extra = {};
  if (orderId === "tiencong") {
    if (isTrib && st.phase < 4) return { ok: false, why: "phuc" };          // thuyền phục phải ẩn tới pha 5
    w.order = { id: "tiencong", left: O.dur }; w.sortie = true;
    w.sk = clamp(w.sk + O.sk, 0, 100);
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
// Tỉ lệ thuyền trong vùng cọc mắc cạn ở pha 5 (systems §7): bãi cọc VÀ Con nước thành công → 100%, không thì 50%.
export function strandShare(st) { return ksOk(st, "kichCoc") && ksOk(st, "conNuoc") ? 1 : 0.5; }

export function riverResult(st) {
  const keSach = {};
  let ok = 0;
  for (const id in st.ks) {
    const k = st.ks[id];
    keSach[id] = { id, name: KE_SACH[id].name, state: k.state, word: KS_STATE_WORD[k.state], got: k.got, hk: KE_SACH[id].hk, why: k.why };
    if (k.state === "thanhcong") ok++;
  }
  return {
    keSach, keSachOk: ok, keSachN: Object.keys(st.ks).length,
    reachShare: st.fleet.reachShare, strandShare: strandShare(st),
    kRank: strandShare(st) === 1,                  // mất thành phần K của xếp hạng khi chỉ 50% mắc cạn (systems §7)
    intel: st.intel, hkRaw: st.hkPaid, timeSec: st.t,
  };
}

// Ảnh chụp để checkpoint (JSON thuần).
export const snapshotRiver = (st) => JSON.parse(JSON.stringify(st));
