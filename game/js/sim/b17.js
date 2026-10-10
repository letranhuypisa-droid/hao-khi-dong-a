// sim/b17.js — luật trận B17 Tây Kết, phần thuần (không three.js, không DOM; kiểm trong Node: tests/b17-sim.test.mjs).
// battle/director-b17.js đọc trạng thái này mỗi bước, tự sinh lính / vẽ vật / phát tiếng theo các sự kiện tickB17 trả về.
//
// Pha (data/battle-b17.js PHASES): 0 Bàn kế (chọn bãi lau) → 1 Đường ra biển (cánh Toa Đô hành quân, hạ 3 đồn) → 2 Bãi lau (Toa Đô vào bãi có phục
// binh: cửa sổ Kế Sách) → 3 Chí tử chiến (Toa Đô đứng lại: đội hình vỡ, hoặc Sinh lực chạm sàn từ P3) → 4 Áo ngự (Toa Đô bị hạ: dẹp tàn quân hoặc chờ).
// Đầu vào mỗi bước (inp): hero { x, z, alive }, foesAt(x, z, r) → số địch còn đánh được trong vòng; engaged (Toa Đô giáp mặt tướng: tướng trong
// COLUMN.engageR m — director quyết), bossHalf (Sinh lực Toa Đô chạm sàn COLUMN.floorPct), bossDown (Toa Đô đã bị hạ), wingsHold (các cánh phục binh của
// bãi đang mở cửa sổ Giữ vững trong bãi), heroToBoss (m, tướng tới Toa Đô), ksPress (vừa bấm Lệnh Kế Sách), pick ("W" | "E": người chơi chọn bãi ở bảng).
// Đợt A2 thêm: king { x, z, alive, hpPct } (vua Nhân Tông, tướng AI; thiếu = trận không có vua), landUp (lính đổ bộ còn sống), omaDown (Ô Mã Nhi bị
// đánh về 0 Sinh lực), envoyDown (sứ giả gục). Thiếu trường nào thì coi là false / 0 / null. Sự kiện trả về: { type, … } theo thứ tự xảy ra trong bước.
//
// Cánh hành quân là trạng thái thuần col.s (m đã đi trên ROUTE, mẫu along / routeLen của xe húc B16): Toa Đô, sĩ quan, lính hộ tống trong trận chỉ
// đi theo điểm along(ROUTE, col.s). Tốc = COLUMN.speed × slowPer^(số đồn ta đã hạ). Dừng khi: đồn ta chặn (OUTPOST_BLOCK.sec, mỗi đồn một lần, ở
// cách tâm đồn O.stop m), Toa Đô giao chiến (tối đa engageMax giây cộng dồn rồi engageCd giây đẩy tiếp), hoặc đứng lại hẳn (P4).
// Đợt A2: Phá Trận Thủy Bộ (land), bến tàn quân và Ô Mã Nhi (pier, oma), sứ giả và Kế Sách Nhỏ (envoy, ks.hoiKe, bãi thứ hai bed2), vua AI (king), Yết
// Kiêu (yk). Đợt A5: nửa Sinh lực chỉ làm Toa Đô đứng lại từ P3, khi cửa sổ Kế Sách không mở (ở P2 chỉ là khóa Sinh lực).

import { along, routeLen } from "./b16.js";
import { ROUTE, MOUTH, COLUMN, OUTPOSTS, OUTPOST_BLOCK, BEDS, inRect, AMBUSH, MUD, KE_SACH, TIMEOUT_B17, REMNANTS,
  LANDING, bankPoint, PIER, OMA, ENVOY, KING, YET_KIEU } from "../data/battle-b17.js";

export { along, routeLen, bankPoint };
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
export const otherBed = (id) => BEDS.find((B) => B.id !== id)?.id ?? null;
// đường thuyền rời bến: chỗ neo → ra luồng → dọc luồng → mốc cửa sông; đường sứ giả (làng → bản doanh)
export const PIER_ROUTES = PIER.docks.map((d) => [d, { x: d.x + 6, z: PIER.laneZ }, { x: PIER.mark.x - 17, z: PIER.laneZ }, PIER.mark]);
export const PIER_LEN = PIER_ROUTES.map((r) => routeLen(r));
export const ENVOY_LEN = routeLen(ENVOY.route);

// ksWin: hệ số cửa sổ Kế Sách (Trận nhanh 0,75). boatHp: độ bền thuyền tàn quân (PIER.hp × g(R) — director tính).
export function createB17({ timeout = TIMEOUT_B17, ksWin = 1, boatHp = PIER.hp } = {}) {
  return {
    t: 0, phase: 0, phaseT: 0, timeout, over: false, won: null, why: null, p2T: null,
    bed: null, bedAuto: false, bed2: null, entered: {},                // bãi lau đã chọn ("W" | "E"); bed2: bãi có phục binh nhờ Kế Sách Nhỏ
    col: { s: 0, len: ROUTE_LEN, mult: 1, halt: null, fight: false, engT: 0, cdT: 0, blockT: 0, blocked: OUTPOSTS.map(() => false),
      entered: false, stood: false, standWhy: null, standT: null, arrived: false, morale: COLUMN.morale, moraleT: 0 },
    outposts: OUTPOSTS.map((O) => ({ id: O.id, p: 0, taken: false, takenT: null, by: null, blockedRing: false })), taken: 0,
    arena: null,                                                      // chỗ Toa Đô cố thủ khi đứng lại: { x, z, mound } (mound: chỉ số gò trong bãi, null)
    bossDown: false, main: [false, false, false],
    // Kế Sách: state "khadung" → "sansang" (cửa sổ đang mở ở bãi K.bed) → "thanhcong" | "thatbai" (why: "lo" lộ phục binh, "canh" cánh không giữ vững,
    // "muon" hết cửa sổ). Hỏng mà còn bãi có phục binh phía trước (bed2) thì về "khadung" (tries + 1). Hỏi kế: "khadung" → "thanhcong" | "thatbai"
    // (why: "chet" sứ giả gục, "muon" phục kích đã nổ trước khi sứ giả tới).
    ks: { phucKich: { state: "khadung", left: null, window: KE_SACH.phucKich.window * ksWin, why: null, bed: null, tries: 0, done: false },
      hoiKe: { state: "khadung", why: null } },
    land: { t: LANDING.every, n: 0, off: false, skip: 0 },          // Phá Trận Thủy Bộ: đồng hồ lượt kế, số lượt, đã mất (phục kích), thuyền bị đục lượt kế
    pier: { boats: PIER.docks.map((d, i) => ({ i, state: "dock", s: 0, hp: boatHp, hp0: boatHp, burn: 0, holdT: 0, at: null })), nextT: PIER.first, passed: 0, lost: 0 },
    oma: { state: "hold", t: null },                                  // "hold" giữ bến | "driven" bị đuổi | "left" bỏ bến (P4)
    envoy: { s: 0, state: "wait", squads: 0, moving: false },         // "wait" ở làng | "walk" | "done" | "lost" (gục) | "late" (phục kích nổ trước)
    king: { mode: "fight", healT: 0, down: false },                   // "fight" | "fall" (lui về bản doanh) | "heal"
    yk: { n: 0 },
    prompt: null,                                                     // nhắc tương tác của bước vừa chạy (director đưa lên ctx.hud.prompt): { text, p } | null
  };
}

// tốc cánh hiện tại (m/s)
export const columnSpeed = (st) => COLUMN.speed * st.col.mult;
export const columnHead = (st) => along(ROUTE, st.col.s);
// các bãi có phục binh (bãi chọn, bãi thứ hai), theo thứ tự cánh đi qua
export const armedBeds = (st) => [st.bed, st.bed2].filter((id) => id && BED_S[id] != null).sort((a, b) => BED_S[a] - BED_S[b]);
// bãi có phục binh kế tiếp cánh sẽ vào (chưa vào) — null nếu hết
export const nextBed = (st) => armedBeds(st).find((id) => !st.entered[id]) ?? null;

// Vòng chiếm "đứng trong vòng, không địch thì tiến độ tăng" — tướng ta hoặc vua (inp.king) đứng trong vòng đều chiếm được:
// "done" | "blocked" (tướng trong vòng, còn địch) | "in" | "kblocked" / "kin" (chỉ vua trong vòng) | null (không ai trong vòng)
function holdRing(o, c, r, sec, inp, dt) {
  const h = inp.hero, k = inp.king;
  const hIn = h.alive && dist(h, c) <= r, kIn = !!k && k.alive && dist(k, c) <= r;
  if (!hIn && !kIn) return null;
  if (inp.foesAt(c.x, c.z, r) > 0) return hIn ? "blocked" : "kblocked";
  o.p = Math.min(1, o.p + dt / sec);
  return o.p >= 1 ? "done" : hIn ? "in" : "kin";
}
export const secLeft = (o, sec) => Math.max(1, Math.ceil((1 - o.p) * sec - 1e-9));

function setPhase(st, i, ev) { st.phase = i; st.phaseT = 0; if (i === 1 && st.p2T == null) st.p2T = st.t; ev.push({ type: "phase", phase: i }); }

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
  const C = st.col, K = st.ks.phucKich, h = inp.hero;

  // ---- vua Nhân Tông (tướng AI): gục là thua; dưới fallPct% lui về bản doanh, hồi healSec giây rồi quay lại ----
  if (inp.king) {
    const Kg = st.king, k = inp.king;
    if (!k.alive) { Kg.down = true; finish(st, false, "Vua Nhân Tông gục ngã giữa trận: quân Trần mất chủ soái.", ev); return ev; }
    if (Kg.mode === "fight" && k.hpPct < KING.fallPct) { Kg.mode = "fall"; ev.push({ type: "kingFall" }); }
    else if (Kg.mode === "fall" && dist(k, KING.home) <= KING.homeR) { Kg.mode = "heal"; Kg.healT = KING.healSec; ev.push({ type: "kingHeal" }); }
    else if (Kg.mode === "heal") { Kg.healT = Math.max(0, Kg.healT - dt); if (Kg.healT <= 0) { Kg.mode = "fight"; ev.push({ type: "kingBack" }); } }
  }

  // ---- P1: chọn bãi lau (bảng chọn ở bản doanh; hết pickSec giây thì bãi mặc định) ----
  if (st.phase === 0) {
    const pick = inp.pick && bedOf(inp.pick) ? inp.pick : null;
    if (pick || st.phaseT >= AMBUSH.pickSec) {
      st.bed = pick || AMBUSH.defaultBed; st.bedAuto = !pick;
      ev.push({ type: "bedPicked", bed: st.bed, auto: st.bedAuto });
      if (st.ks.hoiKe.state === "thanhcong" && !st.bed2) armBed2(st, ev);
      setPhase(st, 1, ev);
    }
  }

  // ---- ba đồn: chiếm được ở mọi pha (tướng hoặc vua đứng trong vòng) ----
  OUTPOSTS.forEach((O, i) => {
    const o = st.outposts[i];
    if (o.taken) return;
    const r = holdRing(o, O, O.r, O.capSec, inp, dt);
    o.blockedRing = r === "blocked" || r === "kblocked";
    if (r === "blocked") st.prompt = { text: `Quân Nguyên còn giữ ${O.name} — dẹp chúng để chiếm`, p: o.p };
    else if (r === "in") st.prompt = { text: `Chiếm ${O.name} · còn ${secLeft(o, O.capSec)} s`, p: o.p };
    else if (r === "done") {
      o.taken = true; o.takenT = st.t; o.by = h.alive && dist(h, O) <= O.r ? "hero" : "king"; st.taken++; C.mult *= COLUMN.slowPer;
      ev.push({ type: "outpostTaken", id: O.id, n: st.taken, by: o.by });
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
    // đầu cánh vào một bãi có phục binh: mở cửa sổ Kế Sách (tướng đang trong revealR m quanh Toa Đô thì lộ phục binh)
    for (const id of armedBeds(st)) {
      if (st.entered[id] || C.s < BED_S[id]) continue;
      st.entered[id] = true; C.entered = true;
      ev.push({ type: "bedEnter", bed: id });
      if (K.state === "khadung") {
        K.bed = id;
        if ((inp.heroToBoss ?? Infinity) < AMBUSH.revealR && h.alive) ksResult(st, false, "lo", ev);
        else { K.state = "sansang"; K.left = K.window; ev.push({ type: "ksOpen", bed: id }); }
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

  // ---- Toa Đô chạm sàn Sinh lực: đứng lại — chỉ từ P3 (cánh đã vào bãi có phục binh) và khi cửa sổ Kế Sách không mở (đợt A5) ----
  if (st.phase >= 2 && !C.stood && inp.bossHalf && K.state !== "sansang") stand(st, "half", ev);

  // ---- Kế Sách Nhỏ: sứ giả đi về bản doanh khi tướng ở gần; toán chặn đường lao ra ở các mốc ----
  stepEnvoy(st, inp, dt, ev);

  // ---- Phá Trận Thủy Bộ: cứ LANDING.every giây thuyền đổ bộ ở bờ gần tướng (P2 → P4, tới khi phục kích thành công) ----
  const L = st.land;
  if (!L.off && st.phase >= 1 && st.phase <= 3 && !st.bossDown) {
    L.t -= dt;
    if (L.t <= 0) {
      L.t += LANDING.every;
      const at = bankPoint(h), room = LANDING.cap - (inp.landUp || 0);
      if (h.alive && dist(h, at) <= LANDING.maxD && room > 0) {
        const sunk = Math.min(L.skip, LANDING.boats), troops = Math.min(room, (LANDING.boats - sunk) * LANDING.perBoat);
        L.skip = 0; L.n++;
        ev.push({ type: "landing", n: L.n, x: at.x, z: at.z, boats: LANDING.boats, sunk, troops });
      }
    }
  }

  // ---- Yết Kiêu (Tương truyền): hai lần trồi lên bên sườn cánh, đục một thuyền của lượt đổ bộ kế ----
  const Y = st.yk;
  if (st.p2T != null && Y.n < YET_KIEU.at.length && st.phase >= 1 && st.phase <= 2 && !C.stood && st.t - st.p2T >= YET_KIEU.at[Y.n]) {
    const p = columnHead(st);
    Y.n++; if (!L.off) L.skip = 1;
    ev.push({ type: "yetKieu", n: Y.n, x: p.x, z: Math.max(LANDING.bank.z + 4, p.z - YET_KIEU.side) });
  }

  // ---- bến tàn quân, Ô Mã Nhi ----
  stepPier(st, inp, dt, ev);

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

// Kế Sách Phục kích có kết quả. Thành công: đội hình vỡ (cánh Sĩ Khí −morale, Toa Đô đứng lại), mất Phá Trận Thủy Bộ. Hỏng mà còn bãi có phục binh phía
// trước (Kế Sách Nhỏ) và cánh còn đi: về "khadung" chờ bãi đó (rearm). Lần nổ đầu (thành hay hỏng) mà sứ giả chưa tới thì Kế Sách Nhỏ hỏng ("muon").
function ksResult(st, ok, why, ev) {
  const K = st.ks.phucKich;
  if (K.state === "thanhcong" || K.state === "thatbai") return;
  K.state = ok ? "thanhcong" : "thatbai"; K.why = why; K.left = null;
  const first = !K.done; K.done = true;
  const rearm = !ok && !st.col.stood && nextBed(st) != null;
  ev.push({ type: "keSach", id: "phucKich", ok, why, bed: K.bed, rearm });
  if (first && st.ks.hoiKe.state === "khadung") hoiKeResult(st, false, "muon", ev);
  if (ok) {
    st.col.morale = Math.max(0, st.col.morale - KE_SACH.phucKich.morale); stand(st, "broken", ev);
    if (!st.land.off) { st.land.off = true; ev.push({ type: "landingOff" }); }
  } else if (rearm) { K.state = "khadung"; K.tries++; K.bed = null; }
}
function hoiKeResult(st, ok, why, ev) {
  const H = st.ks.hoiKe;
  if (H.state !== "khadung") return;
  H.state = ok ? "thanhcong" : "thatbai"; H.why = why;
  if (!ok && (st.envoy.state === "wait" || st.envoy.state === "walk")) st.envoy.state = why === "chet" ? "lost" : "late";
  ev.push({ type: "keSach", id: "hoiKe", ok, why });
  if (ok && st.bed && !st.bed2) armBed2(st, ev);
}
function armBed2(st, ev) { st.bed2 = otherBed(st.bed); ev.push({ type: "bed2", bed: st.bed2 }); }

// điểm của sứ giả trên đường về bản doanh
export const envoyPos = (st) => along(ENVOY.route, st.envoy.s);
function stepEnvoy(st, inp, dt, ev) {
  const E = st.envoy, H = st.ks.hoiKe;
  E.moving = false;
  if (H.state !== "khadung" || (E.state !== "wait" && E.state !== "walk")) return;
  if (inp.envoyDown) { hoiKeResult(st, false, "chet", ev); return; }
  const h = inp.hero, p = along(ENVOY.route, E.s);
  if (h.alive && dist(h, p) <= ENVOY.near) {
    if (E.state === "wait") { E.state = "walk"; ev.push({ type: "envoyGo" }); }
    E.s = Math.min(ENVOY_LEN, E.s + ENVOY.speed * dt); E.moving = true;
    if (!st.prompt) st.prompt = { text: `Hộ tống sứ giả về bản doanh · còn ${Math.ceil(ENVOY_LEN - E.s)} m`, p: E.s / ENVOY_LEN };
  }
  while (E.squads < ENVOY.squads.length && E.s >= ENVOY.squads[E.squads].at * ENVOY_LEN) {
    const Q = ENVOY.squads[E.squads], a = along(ENVOY.route, Math.min(ENVOY_LEN, E.s + 0.12 * ENVOY_LEN));
    ev.push({ type: "intercept", i: E.squads, n: Q.n, x: a.x + Math.cos(a.yaw) * Q.side, z: a.z - Math.sin(a.yaw) * Q.side });
    E.squads++;
  }
  if (E.s >= ENVOY_LEN - 1e-9) { E.state = "done"; hoiKeResult(st, true, null, ev); }
}

// ---- bến tàn quân ----------------------------------------------------------------------------------------------------------
// chỗ của thuyền i: neo ở chỗ neo; đang chạy theo đường ra mốc; mắc cạn / chìm ở chỗ đã dừng
export function boatPos(st, i) {
  const b = st.pier.boats[i];
  if (b.at) return { x: b.at.x, z: b.at.z, yaw: b.at.yaw };
  if (b.state === "dock") return { ...PIER.docks[i], yaw: Math.PI / 2 };
  return along(PIER_ROUTES[i], b.s);
}
const pierLive = (b) => b.state === "dock" || b.state === "sail";
function sinkAt(st, b, state, ev, extra = {}) {
  const p = boatPos(st, b.i);
  b.state = state; b.at = { x: p.x, z: p.z, yaw: p.yaw }; b.holdT = 0; st.pier.lost++;
  ev.push({ type: state === "burnt" ? "boatBurnt" : state === "caught" ? "boatCaught" : "boatSunk", i: b.i, n: st.pier.lost, ...extra });
}
// đòn của tướng vào thuyền (tên × 0,3, chém như vào cổng): về 0 thì chìm. Trả về sát thương đã nhận.
export function damageBoat(st, i, dmg, ev = []) {
  const b = st.pier.boats[i];
  if (!b || !pierLive(b) || st.over) return 0;
  const d = Math.min(b.hp, dmg); b.hp -= d;
  if (b.hp <= 1e-9) sinkAt(st, b, "sunk", ev);
  return d;
}
// Chặn Dòng: thuyền đang chạy đứng lại sec giây (lấy giá trị lớn hơn)
export function holdBoat(st, i, sec) { const b = st.pier.boats[i]; if (b && b.state === "sail") b.holdT = Math.max(b.holdT, sec); }
// Móc Tên: thuyền (neo hay đang chạy) bị kéo dạt vào bờ, mắc cạn ở p (không chạy nữa)
export function catchBoat(st, i, p, ev = []) {
  const b = st.pier.boats[i];
  if (!b || !pierLive(b) || st.over) return false;
  sinkAt(st, b, "caught", ev); if (p) { b.at.x = p.x; b.at.z = p.z; }
  return true;
}
function stepPier(st, inp, dt, ev) {
  const Pq = st.pier, O = st.oma, h = inp.hero;
  if (O.state === "hold" && inp.omaDown) { O.state = "driven"; O.t = st.t; ev.push({ type: "omaDriven", inTime: st.t <= OMA.deadline }); }
  if (O.state === "hold" && st.phase >= 3) { O.state = "left"; O.t = st.t; ev.push({ type: "omaLeft" }); }
  // thuyền còn neo: đứng sát đủ burnSec giây, không địch quanh mình thì cháy
  for (const b of Pq.boats) {
    if (b.state !== "dock") continue;
    const D = PIER.docks[b.i];
    if (!h.alive || dist(h, D) > PIER.burnR) continue;
    if (inp.foesAt(h.x, h.z, PIER.clearR) > 0) { if (!st.prompt) st.prompt = { text: "Địch kề bên — dẹp chúng rồi châm lửa thuyền", p: b.burn }; continue; }
    b.burn = Math.min(1, b.burn + dt / PIER.burnSec);
    if (!st.prompt) st.prompt = { text: `Châm lửa thuyền tàn quân · còn ${Math.max(1, Math.ceil((1 - b.burn) * PIER.burnSec - 1e-9))} s`, p: b.burn };
    if (b.burn >= 1) sinkAt(st, b, "burnt", ev);
  }
  if (st.phase < 1) return;
  // rời bến: cứ PIER.every giây một thuyền, khi Ô Mã Nhi còn giữ bến
  if (O.state === "hold") {
    Pq.nextT -= dt;
    if (Pq.nextT <= 0) {
      Pq.nextT += PIER.every;
      const b = Pq.boats.find((x) => x.state === "dock");
      if (b) { b.state = "sail"; b.burn = 0; ev.push({ type: "boatLaunch", i: b.i }); }
    }
  }
  for (const b of Pq.boats) {
    if (b.state !== "sail") continue;
    if (b.holdT > 0) { b.holdT = Math.max(0, b.holdT - dt); continue; }
    b.s = Math.min(PIER_LEN[b.i], b.s + PIER.speed * dt);
    if (b.s >= PIER_LEN[b.i] - 1e-9) { b.state = "passed"; Pq.passed++; ev.push({ type: "boatPassed", i: b.i, n: Pq.passed }); }
  }
}

// ---- vua AI: đích đi ------------------------------------------------------------------------------------------------------
// fight: đồn chưa chiếm gần vua nhất (đứng giữa vòng, đồn cổng thì phía tây cổng); hết đồn thì P4 tới cạnh đấu trường, không thì giữ đồn ta hạ sau
// cùng. fall / heal: bản doanh. Trả { x, z, id }.
export function kingGoal(st, kp) {
  if (st.king.mode !== "fight") return { ...KING.home, id: "home" };
  let best = null, bd = Infinity;
  OUTPOSTS.forEach((O, i) => { if (st.outposts[i].taken) return; const d = dist(O, kp); if (d < bd) { bd = d; best = { x: O.id === "A3" ? O.x - 4 : O.x, z: O.z, id: O.id }; } });
  if (best) return best;
  if (st.phase >= 3 && st.arena) return { x: st.arena.x - 12, z: st.arena.z + 6, id: "arena" };
  let last = null; for (const [i, o] of st.outposts.entries()) if (!last || o.takenT > st.outposts[last.i].takenT) last = { i, O: OUTPOSTS[i] };
  return { x: last.O.x - 14, z: last.O.z + 8, id: "hold" };
}

export function finish(st, won, why, ev = []) {
  if (st.over) return ev;
  st.over = true; st.won = won; st.why = why;
  ev.push({ type: won ? "win" : "lose", why });
  return ev;
}
// đội hình vỡ (một nửa lính hộ tống tán loạn): phục kích thành công hoặc Sĩ Khí cánh về 0
export const routed = (st) => st.col.standWhy === "broken" || st.col.standWhy === "morale";

// Nhiệm vụ phụ (SIDE_MISSIONS): phục kích thành công; đuổi Ô Mã Nhi trước OMA.deadline; thắng mà không thuyền tàn quân nào qua mốc cửa sông
export function sideB17(st) {
  return { S_AMBUSH: st.ks.phucKich.state === "thanhcong", S_OMA: st.oma.state === "driven" && st.oma.t <= OMA.deadline, S_BOATS: st.won === true && st.pier.passed === 0 };
}

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
