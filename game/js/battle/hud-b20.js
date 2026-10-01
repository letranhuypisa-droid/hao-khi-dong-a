// battle/hud-b20.js — HUD riêng của B20 Bạch Đằng: đồng hồ Con nước, bảng Nghi binh (P1), hộ vệ, mốc cọc, Thoát vây (P4),
// Kế Sách (3 Kế Sách Lớn), thanh boss (khóa Sinh lực, "Bắt sống"), nhắc Tương tác, bảng Đò chuyển, bản đồ nhỏ khúc sông,
// tiếng báo của HUD. Dựng trên các ô chung của hud.js (đợt 9 lõi): setTopWidget (dưới thanh Hào Khí), setPanel (cột phải),
// prompt (nhắc giữ phím có vòng), picker (chọn ≤ 4 nơi đến); thanh boss là khối riêng gắn vào gốc HUD. Kiểu: css/b20.css.
//
// ==== CÁCH NỐI (D2 — director-b20.js, battles/b20.js) ====
//   BattleDef:   import { HUD_B20 } from "../battle/hud-b20.js";   def.hud = HUD_B20   (bản đồ nhỏ + ẩn bảng mặt trận)
//                hoặc wireHudB20(def). Director: keSach.hud = () => [] (Kế Sách B20 do HudB20 vẽ, đủ 3 mục kể cả mục khóa).
//   Director:    constructor: this.hudB20 = new HudB20(ctx)       (HUD dựng trước Director — ctx.hud đã có)
//                mỗi khung (BattleDef.frameVisuals(ctx, dt) hoặc cuối director.update): ctx.hudB20.update(director.hudState(), dt)
//                restoreCheckpoint / hết trận: không cần gì; rời trận: BattleDef.dispose(ctx) → ctx.hudB20?.dispose()
//   hudState:    riverHud(riverSt, extra) dựng sẵn tide / lure / escorts / markers / escape / ks / intel từ sim/river.js; director
//                chỉ cần thêm extra = { bosses, interact, ferry, boats?, scout?, hkLock?, escaped? } (hình dưới).
//
// ==== HÌNH hudState (mọi khối có thể null / thiếu = ẩn) ====
//   phase        0..5 (P1..P6)
//   tide         { pct, rate /*điểm/s, âm = rút*/, next: { pct, sec, label } | null, warn /*T−30 trước mốc*/ }
//   lure         { gap /*m, đoàn thuyền nhẹ trước đầu hạm đội*/, band: [15, 40], max: 60, kk /*0..100*/, boats, boatsMax,
//                  lostMax, stance: "tiencong"|"giuvung"|"theota"|null, stanceCd, toLine /*m đầu hạm đội còn tới Khúc cọc*/ }
//   escorts      { down, need, total, wave /*1|2*/, downWave, waveTotal, escaped }
//   markers      [{ id, state: "hidden"|"active"|"exposed", officerOn, officerT /*s tướng địch đứng mốc*/, exposeSec }] — mọi pha
//                  (bản đồ nhỏ luôn vẽ mốc cho người chơi); bảng mốc cọc chỉ hiện ở P2–P3
//   scout        { target, sec, warn /*Tình báo sớm*/ } | null      — thuyền dò đang tới mốc nào, còn bao giây
//   escape       { value, full, holding, holdLeft, rate }
//   ks           [{ id, name, quyMo, state: "khoa"|"khadung"|"sansang"|"thanhcong"|"thatbai", word, detail, left, got, hk, label, phase }]
//   bosses       [{ id, name, nameHan, title, hp, maxHp, hpLock /*% khóa, 0 = không*/, poise, poiseMax, phases, phase /*1..*/,
//                  broken /*Vỡ Thế*/, captured, unit? /*đơn vị để ẩn khung mục tiêu trùng*/ }]   — chỉ hiện boss đầu tiên chưa bị bắt
//                  (hoặc vừa bị bắt ≤ 4 s: dấu "Đã bắt sống")
//   interact     { text /*"Chiếm thuyền hộ vệ"*/, p /*0..1*/, kind, key? } | null
//   ferry        { items: [{ id, label, sub, kind: "ship"|"escort"|"raft"|"pier"|"flagship"|"bank"|"light" }], onPick(item), title? } | null
//                  — mở bảng khi ĐỐI TƯỢNG ferry đổi (director tạo object mới mỗi lần mở); null thì đóng
//   boats        [{ x, z, yaw, side: "ta"|"dich", type, state, captured, lead }] (không có thì đọc ctx.naval.boats)
//   hkLock       true ở P6 (Hào Khí khóa 100 tới khi dùng Tổng Phản Công)
//   intel        Quyết sách đúng: "Kế đã định" trên bản đồ nhỏ + đường hạm đội
//
// Tiếng báo (ctx.audio.play) do HudB20 phát — director đừng phát trùng: "warn" khi đồng hồ Con nước vào T−30, khi tướng địch
// bắt đầu đứng một mốc cọc ẩn, khi đoàn thuyền nhẹ sát quá 15 m (≤ 1 lần / 4 s), khi Thoát vây vượt 80; "ui" khi mở Đò chuyển.
// Mọi số ở đây là ĐỀ XUẤT BẢN THỬ (bố cục, màu, ngưỡng báo).

import { MAP, RIVER, STAKES, TIDE, LIGHT_BOATS, KE_SACH, KS_ORDER, ESCAPE, FLEET } from "../data/battle-b20.js";
import { zc, hw, TRIBS, tribPoint, tribHalfW } from "../data/terrain-b20.js";
import { tidePct, secondsTo, activeMarkers, KS_STATE_WORD } from "../sim/river.js";
import { ICON } from "../data/moves-info.js";

const fmtS = (s) => (s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : `${Math.ceil(s)} s`);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pct = (v) => `${(clamp01(v) * 100).toFixed(1)}%`;
const PHASE_NAMES = ["P1", "P2", "P3", "P4", "P5", "P6"];
const STANCE = { tiencong: { name: "Tiến công", sub: "khiêu chiến" }, giuvung: { name: "Giữ vững", sub: "giữ khoảng cách" }, theota: { name: "Theo ta", sub: "lui nhanh" } };
const MARK_GLYPH = { hidden: "✦", active: "◆", exposed: "✖" };
const MARK_WORD = { hidden: "chưa mở", active: "đã mở", exposed: "bị lộ" };
const TRIB_WINGS = ["chanh", "rut", "gia"];

// ---- hudState từ sim/river.js (thuần, kiểm thử được trong Node) -----------------------------------------------------------
// st: trạng thái createRiver. extra: phần director thêm (bosses, interact, ferry, boats, scout, hkLock, escaped…), gộp đè lên.
export function riverHud(st, extra = {}) {
  const ph = st.phase, L = LIGHT_BOATS, v = tidePct(st), rate = st.tideRate;
  let next = null;
  if (ph === 0 && rate > 0) next = { pct: TIDE.p1.to, sec: (TIDE.p1.to - v) / rate, label: "Đỉnh triều" };
  else if (ph === 1 && rate < 0) next = { pct: TIDE.p2Floor, sec: secondsTo(st, TIDE.p2Floor), label: "Triều rút (sàn)" };
  else if (ph === 2 && st.drop && rate < 0) next = { pct: TIDE.p3HoldTo, sec: secondsTo(st, TIDE.p3HoldTo), label: "Triều rút" };
  else if (ph === 3) next = v > TIDE.strandAt + 1e-6 ? { pct: TIDE.strandAt, sec: secondsTo(st, TIDE.strandAt), label: "Cọc nhô" }
    : v > 1e-6 ? { pct: 0, sec: secondsTo(st, 0), label: "Nước ròng" } : null;
  const tide = { pct: v, rate, next, warn: ph === 3 && !!next && next.sec <= TIDE.warn, hold: ph === 2 && !st.drop };
  const out = { phase: ph, tide, intel: !!st.intel, lure: null, escorts: null, markers: null, escape: null, ks: [] };
  if (ph === 0) {
    const n = st.nghi, fl = st.wings.flotilla;
    // gap < 0: đầu hạm đội đã vượt đoàn thuyền nhẹ (không ra thế đứng nào) — thanh hiện 0, không số âm (review B20: "−184 m")
    out.lure = { gap: Math.max(0, n.gap), overrun: n.gap < 0, band: [L.gap.min, L.gap.max], max: 60, kk: n.kk, boats: fl.boats, boatsMax: L.n, lostMax: L.lossMax,
      stance: n.stance, stanceCd: n.stanceCd, toLine: Math.max(0, MAP.khucCoc - st.fleet.headX), crossed: n.crossedAt >= 0 };
  }
  if (ph === 1 || ph === 3) {                                    // P2: hộ vệ đợt 1 (cần hạ 4); P4: đợt 2 (mỗi chiếc −15 Thoát vây)
    const f = st.fleet, w1 = FLEET.escorts[0];
    out.escorts = ph === 3
      ? { down: f.escortsDown, need: 0, total: f.escortsTotal, wave: 2, downWave: f.downP4, waveTotal: FLEET.escorts[1], escaped: 0 }
      : { down: f.escortsDown, need: 4, total: f.escortsTotal || w1, wave: 1, downWave: f.escortsDown, waveTotal: f.escortsTotal || w1, escaped: 0 };
  }
  out.markers = STAKES.map((s) => { const m = st.markers[s.id]; return { id: s.id, state: m.state, officerOn: m.officerOn, officerT: m.officerOnT, exposeSec: s.exposeSec }; });
  if (ph === 3) {
    let holding = false, holdLeft = 0;
    for (const id of TRIB_WINGS) { const o = st.wings[id].order; if (o?.id === "giuvung") { holding = true; holdLeft = Math.max(holdLeft, o.left); } }
    out.escape = { value: st.escape.value, full: st.escape.full, holding, holdLeft,
      rate: st.escape.full ? 0 : ESCAPE.perCmdShip * st.fleet.cmdActive * (holding ? ESCAPE.holdMult : 1) };
  }
  for (const id of KS_ORDER) {
    const k = st.ks[id]; if (!k) continue;
    const K = KE_SACH[id];
    let detail = "";
    if (id === "nghiBinh") detail = k.state === "khadung" || k.state === "sansang" ? `Khiêu khích ${Math.floor(st.nghi.kk)}/100 · mất ${st.nghi.lost}/${L.lossMax}` : "";
    if (id === "kichCoc") detail = k.state === "khadung" || k.state === "sansang" ? `mốc đã mở ${activeMarkers(st)}/${K.need}` : "";
    // Con nước còn cần ≥ 2 mốc cọc đã mở: thiếu mốc thì báo hỏng ngay (trước đây chỉ biết lúc nước ròng)
    if (id === "conNuoc") detail = k.state === "khadung" ? (activeMarkers(st) < K.need ? "đã hỏng (thiếu mốc cọc)" : `Thoát vây ${Math.floor(st.escape.value)}/100`) : "";
    out.ks.push({ id, name: K.name, quyMo: K.quyMo === "lon" ? "Lớn" : "Nhỏ", state: k.state, word: KS_STATE_WORD[k.state], detail,
      left: k.state === "khadung" || k.state === "sansang" ? k.left : 0, got: k.got, hk: K.hk, label: K.label, labelAction: K.labelAction || null, phase: K.phase, why: k.why });
  }
  return Object.assign(out, extra);
}

// ---- hình vẽ cho bảng Đò chuyển (không có ảnh icon thuyền / bè / bến: vẽ nét SVG, tông vàng thếp) -----------------------
const SV = (d) => `<svg viewBox="0 0 32 32" aria-hidden="true">${d}</svg>`;
export const FERRY_SVG = {
  ship: SV(`<path d="M3 20h26l-4 6H8z" class="f"/><path d="M15 5v15M15 6l9 4-9 4" class="s"/><path d="M8 11v9M8 12l-5 3 5 2" class="s"/>`),
  escort: SV(`<path d="M4 20h24l-3 5H8z" class="f"/><path d="M16 7v13M16 8l7 4-7 3" class="s"/>`),
  flagship: SV(`<path d="M2 21h28l-4 6H6z" class="f"/><rect x="9" y="13" width="12" height="8" class="f2"/><path d="M11 13V8h8v5M15 8V3l6 2-6 2" class="s"/>`),
  raft: SV(`<path d="M5 19h22l-1 4H6z" class="f"/><path d="M7 19l2-5M12 19l1-6M17 19l1-6M22 19l2-5" class="s"/><path d="M3 25c3 2 6-2 9 0s6-2 9 0 6-2 9 0" class="w"/>`),
  pier: SV(`<path d="M3 14h20v3H3z" class="f"/><path d="M6 17v10M12 17v10M18 17v10M22 14l7-6" class="s"/><path d="M1 25c3 2 6-2 9 0s6-2 9 0 6-2 9 0" class="w"/>`),
  light: SV(`<path d="M3 20h26l-3 4H7z" class="f"/><path d="M8 20l-3 6M13 20l-2 6M19 20l2 6M24 20l3 6" class="s"/><path d="M16 11v9M16 12l5 2-5 2" class="s"/>`),
  bank: SV(`<path d="M2 24c6-10 12-12 28-12v15H2z" class="f"/><path d="M9 18l1-6M14 15l1-6M19 14l1-5" class="s"/>`),
};
FERRY_SVG.captured = FERRY_SVG.escort;

// ---- bản đồ nhỏ (BattleDef.hud) ----------------------------------------------------------------------------------------
// Khung khúc sông chơi được (bỏ bớt lề của MAP): 1320 × 460 m trên canvas 240 × 84.
export const MAP_BOUNDS = { x0: -70, x1: 1250, z0: -230, z1: 230 };
export const MAP_CANVAS = { w: 240, h: 84 };
const HULL_LB = { junk: [24, 7], flagship: [36, 9], escort: [16, 4.5], scout: [9, 2.2], light: [12, 2.6], lead: [16, 3.5] };
const COL = { land: "#bca77a", land2: "#a8916a", water: "#2f5d62", water2: "#3f7672", mud: "#7a6a48", bank: "#8d7a55", ta: "#f1d98a", dich: "#d8321e",
  hq: "#c0392b", pier: "#e0a24a", mark: "#b58cff", gold: "#f1d98a", ink: "#1d1a17" };
let baseCache = null;                    // { cv, W, H } — lớp đất + sông tĩnh, vẽ một lần mỗi cỡ canvas

function riverPoly(c, X, Z, x0, x1, step, off = 0) {
  c.beginPath();
  for (let x = x0; x <= x1; x += step) c.lineTo(X(x), Z(zc(x) - hw(x) - off));
  for (let x = x1; x >= x0; x -= step) c.lineTo(X(x), Z(zc(x) + hw(x) + off));
  c.closePath();
}
function tribPoly(c, X, Z, tr, off = 0) {
  c.beginPath();
  for (let s = -4; s <= tr.len; s += 10) { const w = tribHalfW(tr, s / tr.len) + off, p = tribPoint(tr, s, -w); c.lineTo(X(p.x), Z(p.z)); }
  for (let s = tr.len; s >= -4; s -= 10) { const w = tribHalfW(tr, s / tr.len) + off, p = tribPoint(tr, s, w); c.lineTo(X(p.x), Z(p.z)); }
  c.closePath();
}
function buildBase(W, H, X, Z) {
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = COL.land; c.fillRect(0, 0, W, H);
  // đồi rừng xa bờ (sậm dần ra hai mép)
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, COL.land2); g.addColorStop(0.28, COL.land); g.addColorStop(0.72, COL.land); g.addColorStop(1, COL.land2);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // bờ bùn (vành 10 m quanh lòng sông), lòng sông, nhánh sông
  c.fillStyle = COL.bank; riverPoly(c, X, Z, MAP_BOUNDS.x0 - 20, MAP_BOUNDS.x1 + 20, 20, 10); c.fill();
  for (const tr of TRIBS) { tribPoly(c, X, Z, tr, 6); c.fill(); }
  c.fillStyle = COL.water; riverPoly(c, X, Z, MAP_BOUNDS.x0 - 20, MAP_BOUNDS.x1 + 20, 20); c.fill();
  for (const tr of TRIBS) { tribPoly(c, X, Z, tr); c.fill(); }
  // bản doanh (ô đỏ viền vàng), bến (ô cam)
  c.fillStyle = COL.hq; c.fillRect(X(MAP.hq.x) - 3.5, Z(MAP.hq.z) - 3.5, 7, 7);
  c.strokeStyle = COL.gold; c.lineWidth = 1; c.strokeRect(X(MAP.hq.x) - 3.5, Z(MAP.hq.z) - 3.5, 7, 7);
  for (const p of MAP.piers) { c.fillStyle = COL.pier; c.fillRect(X(p.x) - 2, Z(p.z) - 2, 4, 4); }
  return { cv, W, H };
}
// Lớp nền: đất, sông, nhánh sông, bản doanh, bến (ảnh đệm) + khúc cọc tô theo Con nước (triều ròng thành bãi bùn), mốc Khúc
// cọc (P1–P2), cửa sông (P4: lối thoát của hạm đội).
function drawBaseB20(M, ctx) {
  const { c, W, H, X, Z } = M, st = ctx.hudB20?.state, ph = st?.phase ?? ctx.director?.phase ?? 0;
  if (!baseCache || baseCache.W !== W || baseCache.H !== H) baseCache = buildBase(W, H, X, Z);
  c.drawImage(baseCache.cv, 0, 0);
  const tp = st?.tide?.pct ?? 100, dry = clamp01((45 - tp) / 45);
  const R = RIVER.reach;
  c.globalAlpha = 0.25 + 0.65 * dry; c.fillStyle = dry > 0.02 ? COL.mud : COL.water2;
  riverPoly(c, X, Z, R.x0, R.x1, 17, -12); c.fill(); c.globalAlpha = 1;
  // cọc nhô dưới 30% (chấm cọc ở bãi đã kích hoạt)
  if (tp < TIDE.strandAt && st?.markers !== undefined) {
    c.fillStyle = "rgba(29,26,23,.75)";
    for (const s of STAKES) {
      const m = st.markers?.find((q) => q.id === s.id), on = !m || m.state === "active";
      if (!on) continue;
      for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) c.fillRect(X(s.x + i * 10) - 0.5, Z(s.z + j * 12) - 0.5, 1, 1);
    }
  }
  if (ph <= 1) {                                                   // mốc Khúc cọc: nét vàng đứt quãng
    c.strokeStyle = "rgba(241,217,138,.85)"; c.lineWidth = 1; c.setLineDash([2, 2]);
    c.beginPath(); c.moveTo(X(MAP.khucCoc), Z(zc(MAP.khucCoc) - hw(MAP.khucCoc) - 6)); c.lineTo(X(MAP.khucCoc), Z(zc(MAP.khucCoc) + hw(MAP.khucCoc) + 6)); c.stroke();
    c.setLineDash([]);
  }
  if (ph === 3) {                                                  // lối thoát ra biển: vạch đỏ nhấp nháy
    c.strokeStyle = Math.floor(M.t * 3) % 2 ? "#ff5a3a" : "rgba(255,90,58,.45)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(X(MAP.exitX), Z(zc(MAP.exitX) - hw(MAP.exitX))); c.lineTo(X(MAP.exitX), Z(zc(MAP.exitX) + hw(MAP.exitX))); c.stroke();
  }
}
// Một thuyền: hình thoi dài theo hướng mũi (yaw: +z cục bộ là mũi, hướng thế giới (sin yaw, cos yaw)).
function boatMark(c, X, Z, sx, b) {
  const lb = HULL_LB[b.lead ? "lead" : b.type] || HULL_LB.junk, L = Math.max(3, lb[0] * sx), B = Math.max(1.8, lb[1] * sx * 1.4);
  c.save(); c.translate(X(b.x), Z(b.z)); c.rotate(Math.atan2(Math.cos(b.yaw || 0), Math.sin(b.yaw || 0)));
  c.beginPath(); c.moveTo(L / 2, 0); c.lineTo(L * 0.2, -B / 2); c.lineTo(-L / 2, -B / 2); c.lineTo(-L / 2, B / 2); c.lineTo(L * 0.2, B / 2); c.closePath();
  const ours = b.side === "ta" || b.captured;
  c.fillStyle = b.state === "sunk" ? "rgba(29,26,23,.4)" : ours ? COL.ta : COL.dich; c.fill();
  c.lineWidth = b.type === "flagship" || b.lead ? 1.2 : 0.8; c.strokeStyle = b.captured ? COL.dich : b.type === "flagship" ? COL.gold : COL.ink; c.stroke();
  if (b.state === "stranded" || b.state === "caught") { c.fillStyle = COL.ink; c.fillRect(-1, -0.6, 2, 1.2); }
  c.restore();
}
// Lớp trên: thuyền (đỏ = Nguyên, vàng = ta / đã chiếm; kỳ hạm viền vàng), mốc cọc ✦ (chỉ người chơi thấy; ◆ đã mở, ✖ lộ),
// tướng địch đứng mốc (vòng đỏ nhấp nháy), thuyền dò đang nhắm mốc, "Kế đã định" khi Quyết sách đúng.
function drawTopB20(M, ctx) {
  const { c, X, Z, sx, t } = M, st = ctx.hudB20?.state;
  const boats = st?.boats || ctx.naval?.boats || [];
  for (const b of boats) if (!b.hidden && b.state !== "gone") boatMark(c, X, Z, sx, b);
  const ph = st?.phase ?? 0;
  if (st?.intel) {                                                // Kế đã định: đường hạm đội dự kiến (đỏ đứt) + vòng vàng các điểm Kế Sách
    c.strokeStyle = "rgba(216,50,30,.55)"; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath();
    for (let x = MAP.fleetHead.x; x <= MAP.exitX; x += 40) c.lineTo(X(x), Z(zc(x)));
    c.stroke(); c.setLineDash([]);
  }
  const marks = st?.markers || (ph >= 1 && ph <= 2 ? STAKES.map((s) => ({ id: s.id, state: "hidden" })) : null);
  if (marks || st?.intel) {
    c.font = "bold 9px sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    for (const s of STAKES) {
      const m = marks?.find((q) => q.id === s.id), state = m?.state ?? "hidden", x = X(s.x), z = Z(s.z);
      if (st?.intel) { c.strokeStyle = "rgba(241,217,138,.9)"; c.lineWidth = 1; c.beginPath(); c.arc(x, z, 6, 0, 7); c.stroke(); }
      if (!marks) continue;
      if (m?.officerOn && state === "hidden" && Math.floor(t * 4) % 2) { c.strokeStyle = "#ff5a3a"; c.lineWidth = 2; c.beginPath(); c.arc(x, z, 7.5, 0, 7); c.stroke(); }
      c.fillStyle = COL.ink; c.fillText(MARK_GLYPH[state], x + 0.6, z + 0.8);
      c.fillStyle = state === "hidden" ? COL.mark : state === "active" ? COL.gold : "#ff7a5c"; c.fillText(MARK_GLYPH[state], x, z);
    }
    if (st?.scout?.target) {                                      // thuyền dò → mốc: mũi tên đỏ từ bờ nam giữa hạm đội
      const s = STAKES.find((q) => q.id === st.scout.target);
      if (s && Math.floor(t * 3) % 2) { c.strokeStyle = "#ff5a3a"; c.lineWidth = 1; c.beginPath(); c.arc(X(s.x), Z(s.z), 9, 0, 7); c.stroke(); }
    }
  }
}
export const HUD_B20 = { bounds: MAP_BOUNDS, canvas: MAP_CANVAS, drawBase: drawBaseB20, drawTop: drawTopB20, frontsHTML: () => "" };
export function wireHudB20(def) { def.hud = HUD_B20; return def; }

// ---- khối HTML của cột phải (chuỗi cho hud.setPanel; hud.js chỉ vẽ lại khi chuỗi đổi) --------------------------------------
function lureHTML(L, t) {
  const [lo, hi] = L.band, g = Math.round(L.gap * 2) / 2, near = L.gap < lo, far = L.gap > hi;
  const cls = near ? "near" : far ? "far" : "in", word = near ? "Quá sát!" : far ? "Quá xa" : "Trong dải";
  const why = near ? `Sát dưới ${lo} m: cứ ${LIGHT_BOATS.lossEvery} s mất 1 thuyền` : far ? `Xa quá ${hi} m: hạm đội chần chừ, Khiêu khích tụt` : null;
  const S = L.stance && STANCE[L.stance];
  const chip = S ? `<span class="b20-chip stance"><img src="${ICON(L.stance)}" alt="">${S.name}${L.stanceCd > 0 ? ` <small>${L.stanceCd}s</small>` : ""}</span>`
    : `<span class="b20-chip stance none">chưa lệnh</span>`;
  const pips = Array.from({ length: L.boatsMax }, (_, i) => `<i class="${i < L.boats ? "ok" : "lost"}"></i>`).join("");
  const lostTooMany = L.boatsMax - L.boats > L.lostMax;
  return `<section class="b20-sec lure ${cls}"${near ? ` style="--pulse:${(0.55 + 0.45 * Math.sin(t * 9)).toFixed(2)}"` : ""}>
    <header><b>NGHI BINH</b>${chip}</header>
    <div class="row"><span>Khoảng cách</span><b class="gapv">${g} m</b><em class="gs">${word}</em></div>
    <div class="gapbar"><i class="zn" style="width:${pct(lo / L.max)}"></i><i class="zb" style="left:${pct(lo / L.max)};width:${pct((hi - lo) / L.max)}"></i>
      <u style="left:${pct(L.gap / L.max)}"></u><s style="left:${pct(lo / L.max)}">${lo}</s><s style="left:${pct(hi / L.max)}">${hi}</s></div>
    <div class="row"><span>Khiêu khích</span><div class="bar kk${L.kk >= 100 ? " full" : ""}"><div style="width:${pct(L.kk / 100)}"></div></div><b>${Math.floor(L.kk)}</b></div>
    <div class="row"><span>Thuyền nhẹ</span><span class="pips${lostTooMany ? " bad" : ""}">${pips}</span><b>${L.boats}/${L.boatsMax}</b></div>
    <div class="sub${why ? " warn" : ""}">${why ?? (L.crossed ? "Đã qua mốc Khúc cọc — giữ dải tới khi đầu hạm đội theo qua" : `Đầu hạm đội còn ${Math.round(L.toLine)} m tới Khúc cọc · mất tối đa ${L.lostMax}`)}</div>
  </section>`;
}
function escortsHTML(E, phase) {
  const tot = E.wave === 2 ? E.waveTotal : E.total, down = E.wave === 2 ? E.downWave : E.down;
  const pips = Array.from({ length: tot }, (_, i) => `<i class="${i < down ? "down" : ""}"></i>`).join("");
  const head = E.wave === 2 ? `đã hạ ${down}/${tot}${E.escaped ? ` · thoát ${E.escaped}` : ""}` : `đã hạ <b>${down}</b>/${E.need} · còn ${Math.max(0, tot - down)}`;
  const sub = phase === 3 ? "Mỗi thuyền hộ vệ bị hạ: Thoát vây −15" : phase === 1 ? "Hạ trấn thủ, giữ Tương tác 3 s trên boong để chiếm" : "Còn hộ vệ thì kỳ hạm chưa áp mạn được";
  return `<section class="b20-sec esc"><header><b>HỘ VỆ${E.wave === 2 ? " · ĐỢT 2" : ""}</b><span>${head}</span></header>
    <div class="ships">${pips}</div><div class="sub">${sub}</div></section>`;
}
function markersHTML(M, scout, phase) {
  const act = M.filter((m) => m.state === "active").length;
  const chips = M.map((m) => {
    const danger = m.state === "hidden" && m.officerOn, left = Math.max(0, (m.exposeSec ?? 10) - (m.officerT ?? 0));
    const p = m.state === "hidden" ? clamp01((m.officerT ?? 0) / (m.exposeSec ?? 10)) : 0;
    const sub = danger ? `lộ sau ${Math.ceil(left)} s` : MARK_WORD[m.state];
    return `<div class="mchip ${m.state}${danger ? " danger" : ""}"><div class="mring" style="--p:${p.toFixed(3)}"><span>${MARK_GLYPH[m.state]}</span></div><b>${m.id}</b><small>${sub}</small></div>`;
  }).join("");
  const need = KE_SACH.kichCoc.need;
  const sub = scout?.target ? `<div class="sub warn">${scout.warn ? "Tình báo sớm: " : ""}thuyền dò → ${scout.target} · ${fmtS(scout.sec)}</div>`
    : `<div class="sub">${phase === 2 ? "Đứng trên bè cỏ, giữ Tương tác 5 s để chặt dây — không để tướng địch đứng mốc 10 s" : "Chặn thuyền dò luồng trước khi chạm mốc"}</div>`;
  return `<section class="b20-sec mk"><header><b>MỐC CỌC</b><span>đã mở <b>${act}</b>/${need}</span></header><div class="mchips">${chips}</div>${sub}</section>`;
}
function escapeHTML(X, t) {
  const v = Math.floor(X.value), hot = v >= 80 && !X.full;
  const hold = X.holding ? `<span class="b20-chip hold on"><img src="${ICON("giuvung")}" alt="">Giữ vững ×0,7${X.holdLeft ? ` · ${Math.ceil(X.holdLeft)} s` : ""}</span>`
    : `<span class="b20-chip hold"><img src="${ICON("giuvung")}" alt="">Chưa Giữ vững · Mệnh Lệnh → Giữ vững</span>`;
  return `<section class="b20-sec escape${X.full ? " full" : hot ? " hot" : ""}"${hot ? ` style="--pulse:${(0.6 + 0.4 * Math.sin(t * 7)).toFixed(2)}"` : ""}>
    <header><b>THOÁT VÂY</b><b class="v">${v}<small>/100</small></b></header>
    <div class="bar esc"><div style="width:${pct(X.value / 100)}"></div></div>
    <div class="row">${hold}<span class="rate">${X.full ? "Hạm đội đã thoát vây" : `+${X.rate.toFixed(1).replace(".", ",")}/s`}</span></div></section>`;
}
function ksHTML(list, phase, fmt = (s) => s) {
  return `<section class="b20-sec ksl">` + list.map((k) => {
    const cur = k.phase === phase || k.state === "sansang";
    const left = k.left > 0 ? ` · ${fmtS(k.left)}` : "";
    if (!cur) {
      const w = k.state === "khoa" ? `mở ở ${PHASE_NAMES[k.phase] ?? ""}` : k.word;
      return `<div class="ks mini ${k.state}"><b>${k.name}</b><span>${w}</span><em>${Math.round(k.got)}/${k.hk}</em></div>`;
    }
    return `<div class="ks ${k.state}"><b>Kế Sách ${k.quyMo} · ${k.name}</b><span>${k.word}${left}${k.detail ? " · " + k.detail : ""}${k.state === "sansang" && k.id === "kichCoc" ? " · bấm " + fmt("{kesach}") : ""}</span>
      <i>Hào Khí ${Math.round(k.got)}/${k.hk} · <em>${k.label}${k.labelAction ? ` · thao tác ${k.labelAction}` : ""}</em></i></div>`;
  }).join("") + `</section>`;
}
function rallyHTML(fmt = (s) => s) {
  return `<section class="b20-sec rally"><header><b>HÀO KHÍ KHÓA 100</b></header><div class="sub">Bấm <kbd>${fmt("{tpc}")}</kbd> — Tổng Phản Công: lên kỳ hạm, bắt sống Ô Mã Nhi</div></section>`;
}

// ---- HUD của trận ------------------------------------------------------------------------------------------------------
const TIDE_HTML = `<div class="b20-tide" data-b="tide">
  <div class="bt-l"><b>CON NƯỚC</b><span class="bt-v" data-b="tv">0%</span><i class="bt-a" data-b="ta"></i><span class="bt-n" data-b="tn"></span></div>
  <div class="bt-bar"><div class="bt-f" data-b="tf"></div><i class="bt-k" style="left:30%" title="cọc nhô"></i><i class="bt-k k50" style="left:50%"></i><u class="bt-m" data-b="tm"></u></div>
</div>`;
const BOSS_HTML = `<div class="bn"><b data-b="bname"></b><span data-b="bhan"></span><small data-b="btitle"></small></div>
  <div class="bhp"><div class="bf" data-b="bhp"></div><i class="block" data-b="block"></i><span data-b="bhpt"></span></div>
  <div class="bpo"><div data-b="bpo"></div></div><div class="bpips" data-b="bpips"></div>
  <div class="bhint" data-b="bhint"></div>`;

export class HudB20 {
  constructor(ctx, { cues = true } = {}) {
    this.ctx = ctx; this.hud = ctx.hud; ctx.hudB20 = this; this.cues = cues;
    const root = this.root = this.hud.root;
    root.classList.add("hud-b20"); root.parentElement?.classList.add("b20");
    this.hud.setTopWidget(TIDE_HTML);
    const q = (el, k) => el.querySelector(`[data-b="${k}"]`);
    const tw = this.hud.el.topw;
    this.tw = { box: q(tw, "tide"), tv: q(tw, "tv"), ta: q(tw, "ta"), tn: q(tw, "tn"), tf: q(tw, "tf"), tm: q(tw, "tm") };
    const boss = this.bossEl = document.createElement("div");
    boss.className = "b20-boss"; boss.hidden = true; boss.innerHTML = BOSS_HTML; root.appendChild(boss);
    this.bw = {}; for (const k of ["bname", "bhan", "btitle", "bhp", "block", "bhpt", "bpo", "bpips", "bhint"]) this.bw[k] = q(boss, k);
    this.state = null; this.t = 0; this.acc = 1; this.ferryRef = null; this.bossId = null; this.capT = 0;
    this.cue = { tideWarn: false, officer: {}, near: -99, esc80: false };
    this.cache = {};
  }

  // Gọi mỗi khung với hudState (hình ở đầu file). Nhắc Tương tác cập nhật mỗi lần gọi (vòng giữ phím mượt); phần còn lại ≤ 20 lần/s.
  update(st, dt = 0) {
    if (!st) return;
    this.state = st; this.t += dt; this.acc += dt; this.acc0 = (this.acc0 || 0) + dt;
    this.prompt(st.interact);
    this.ferry(st.ferry);
    if (this.acc < 0.05) return;
    this.acc = 0;
    const acc = this.acc0; this.acc0 = 0;
    this.tide(st.tide, st.phase);
    this.panels(st);
    this.boss(st.bosses, acc);
    this.targetVis();
    if (this.cues) this.sounds(st);
  }

  // Tên phím Tương tác theo thiết bị đang dùng: cảm ứng ✋ (giữ nút Tương tác — cả lúc chưa chạm lần nào khi đã dựng nút cảm ứng),
  // tay cầm D-pad xuống ⬇, bàn phím X.
  keyName() {
    const inp = this.ctx.input;
    if (inp?.pad) return "⬇";
    if (this.ctx.touch || (this.root.parentElement?.classList.contains("touchmode") && !inp?.keyUsed)) return "✋";
    return "X";
  }
  prompt(it) {
    const h = this.hud;
    if (!it) { h.prompt(null); return; }
    const k = it.key ?? this.keyName(), touch = k === "✋";
    h.prompt(touch ? it.text : `Giữ ${k === "⬇" ? "D-pad ⬇" : k} · ${it.text}`, it.p ?? 0);          // cảm ứng: ✋ trong vòng đã là "giữ nút Tương tác"
    const e = h.el.prompt; e.dataset.key = k; e.dataset.kind = it.kind || "";
    e.classList.toggle("quiet", !!it.quiet);          // gọi đò lúc đang giao chiến: nhắc nhỏ ở góc, không giữa màn
  }
  ferry(f) {
    if (f === this.ferryRef) return;
    this.ferryRef = f;
    if (!f?.items?.length) { if (this.hud.pickerOpen) this.hud.picker(null); return; }
    const items = f.items.slice(0, 4).map((it) => ({ ...it, svg: it.svg ?? FERRY_SVG[it.kind] ?? FERRY_SVG.ship }));
    this.hud.picker(items, (it) => f.onPick?.(it), f.title ?? "Đò chuyển · chọn nơi đến");
    this.hud.el.picker.classList.add("b20-ferry");
    if (this.cues) this.ctx.audio?.play?.("ui");
  }

  // Đồng hồ Con nước dưới thanh Hào Khí: %, mũi tên lên/xuống, mốc kế (cọc nhô 30%, nước ròng 0%), nhấp nháy từ T−30.
  tide(T, phase) {
    const w = this.tw; if (!T) { this.hud.setTopWidget(null); return; }
    const v = Math.round(T.pct), dir = T.rate > 0.001 ? "up" : T.rate < -0.001 ? "down" : "flat";
    const nx = T.next ? `${T.next.label} ${T.next.pct}% · ${fmtS(T.next.sec)}` : T.hold ? "Triều đứng · chờ Kế Sách bãi cọc" : phase >= 4 ? "Nước ròng · thuyền mắc cạn" : "";
    const key = `${v}|${dir}|${nx}|${T.warn ? 1 : 0}`;
    if (key === this.cache.tide) return;
    this.cache.tide = key;
    w.tv.textContent = `${v}%`; w.ta.className = "bt-a " + dir; w.ta.textContent = dir === "up" ? "▲" : dir === "down" ? "▼" : "■";
    w.tn.textContent = nx; w.tf.style.width = `${Math.max(0, Math.min(100, T.pct))}%`;
    w.tm.style.left = T.next ? `${T.next.pct}%` : "-10px"; w.tm.hidden = !T.next;
    w.box.classList.toggle("warn", !!T.warn); w.box.classList.toggle("low", T.pct <= TIDE.strandAt);
  }

  // Cột phải: bảng của pha (Nghi binh / hộ vệ + mốc cọc / Thoát vây + hộ vệ đợt 2 / Hào Khí khóa) rồi Kế Sách.
  panels(st) {
    const t = this.t, ph = st.phase;
    let html = "";
    if (st.lure) html += lureHTML(st.lure, t);
    if (st.escape) html += escapeHTML(st.escape, t);
    if (st.escorts) html += escortsHTML(st.escorts, ph);
    if (st.markers && (ph === 1 || ph === 2)) html += markersHTML(st.markers, st.scout, ph);
    if (st.hkLock && !this.ctx.hk?.tpc) html += rallyHTML(this.ctx.fmt);
    if (st.ks?.length) html += ksHTML(st.ks, ph, this.ctx.fmt);
    this.hud.setPanel("b20", html || null);
  }

  // Thanh boss (giữa trên, dưới hàng Hào Khí): Sinh lực có vạch khóa (vàng khi đã chạm khóa), Phá Thế theo tầng, gợi ý
  // "Bắt sống" khi Vỡ Thế. Bị bắt: dấu "Đã bắt sống" 4 s rồi ẩn.
  boss(list, dt) {
    const e = this.bossEl, w = this.bw;
    const b = list?.find((x) => !x.captured) || list?.find((x) => x.captured && (x.id === this.bossId || this.bossId === null));
    if (b?.captured) this.capT += dt; else this.capT = 0;               // dt: thời gian từ lần vẽ trước (≈ 0,05 s)
    if (!b || this.capT > 4) { if (!e.hidden) { e.hidden = true; this.root.classList.remove("b20-bossing"); } this.bossId = null; return; }
    if (b.id !== this.bossId) {
      this.bossId = b.id; w.bname.textContent = b.name; w.bhan.textContent = b.nameHan ?? ""; w.btitle.textContent = b.title ?? "";
      const n = b.phases ?? 1; w.bpips.innerHTML = n > 1 ? Array.from({ length: n }, () => "<i></i>").join("") : "";
    }
    e.hidden = false; this.root.classList.add("b20-bossing");
    const hp = clamp01(b.hp / b.maxHp), lock = (b.hpLock ?? 0) / 100, locked = lock > 0 && hp <= lock + 1e-4;
    w.bhp.style.width = pct(hp); w.block.style.left = pct(lock); w.block.hidden = !(lock > 0);
    w.bhpt.textContent = b.captured ? "" : `${Math.ceil(b.hp)} / ${Math.round(b.maxHp)}`;
    w.bpo.style.width = b.poiseMax ? pct(b.poise / b.poiseMax) : "0";
    [...w.bpips.children].forEach((p, i) => p.classList.toggle("done", i < (b.phase ?? 1) - 1));
    e.classList.toggle("locked", locked); e.classList.toggle("broken", !!b.broken && !b.captured); e.classList.toggle("captured", !!b.captured);
    w.bhint.textContent = b.captured ? "ĐÃ BẮT SỐNG" : b.broken ? (this.ctx.fmt ? this.ctx.fmt("VỠ THẾ · bấm {c}: ĐÒN QUYẾT — BẮT SỐNG") : "VỠ THẾ · bấm C: ĐÒN QUYẾT — BẮT SỐNG")
      : locked ? `Sinh lực khóa ở ${b.hpLock}% — đánh cạn Phá Thế để bắt sống` : lock > 0 ? `Bắt sống: đánh tới ${b.hpLock}% rồi cạn Phá Thế` : "Vỡ Thế rồi Đòn Quyết để bắt sống";
    // khung mục tiêu của hud.js trùng boss thì ẩn (thanh boss đã đủ)
    const h = this.ctx.hero, tgt = h?.lock?.alive && !h.lock.dead ? h.lock : this.hud.nearestOfficer?.();
    this.root.classList.toggle("b20-boss-target", !!b.unit && tgt === b.unit);
  }
  // khung mục tiêu (hud.js) ẩn khi tướng ngồi đò / đang leo, hoặc mục tiêu xa quá 25 m (review B20: thanh mục tiêu xa vẫn hiện)
  targetVis() {
    const h = this.ctx.hero; if (!h) return;
    const t = h.lock?.alive && !h.lock.dead ? h.lock : null;
    const far = !!t && (t.x - h.x) ** 2 + (t.z - h.z) ** 2 > 625;
    this.root.classList.toggle("b20-notarget", h.state === "ride" || h.state === "climb" || far);
  }

  sounds(st) {
    const au = this.ctx.audio, C = this.cue;
    if (!au?.play) return;
    const tw = !!st.tide?.warn; if (tw && !C.tideWarn) au.play("warn"); C.tideWarn = tw;
    for (const m of st.markers || []) { const on = m.state === "hidden" && !!m.officerOn; if (on && !C.officer[m.id]) au.play("warn"); C.officer[m.id] = on; }
    if (st.lure && st.lure.gap < st.lure.band[0] && this.t - C.near > 4) { au.play("warn"); C.near = this.t; }
    const e80 = !!st.escape && st.escape.value >= 80 && !st.escape.full; if (e80 && !C.esc80) au.play("warn"); C.esc80 = e80;
  }

  dispose() {
    const h = this.hud;
    h.setTopWidget(null); h.setPanel("b20", null); h.prompt(null); if (h.pickerOpen) h.picker(null);
    h.el.picker?.classList.remove("b20-ferry");
    this.bossEl.remove(); this.root.classList.remove("hud-b20", "b20-bossing", "b20-boss-target", "b20-notarget"); this.root.parentElement?.classList.remove("b20");
    if (this.ctx.hudB20 === this) this.ctx.hudB20 = null;
  }
}
