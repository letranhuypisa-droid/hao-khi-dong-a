// battle/director-b20.js — luật trận B20 Bạch Đằng (9/4/1288), đợt 9 pha D2 (phần 1 D2a: pha 1–3; phần 2 D2b: pha 4–6, boss, cảnh kết).
//
// Giao diện Director như battle/director.js (danh sách móc ở đầu battles/b15.js): phase, time, over, result, msgs, events,
// keSach{hud,trigger}, pickups, M, retries, order, tryTPC, fillActors, restoreCheckpoint, lose, update(dt), on* của tướng/lính/
// sĩ quan, cộng các móc H31 (onArmyBuff, onMark, pickMarkTarget, onUlt, onUltEnd). Luật khúc sông ở sim/river.js (ctx.sim là
// trạng thái createRiver — Con nước, Nghi binh, mốc cọc, Thoát vây, cánh thủy quân, Kế Sách); director tick nó 1 Hz, áp sự
// kiện, đặt thuyền theo số của mô phỏng (đầu hạm đội st.fleet.headX, đoàn thuyền nhẹ st.nghi.flotX, nội suy giữa hai tick).
// Lớp thủy chiến: battle/naval.js (ctx.naval). HUD riêng: battle/hud-b20.js (HudB20 + riverHud → director.hudState()).
//
// Pha (canon, B20-GAMEPLAY §D2):
//   P1 Dụ địch lúc triều lên — tướng trên thuyền chỉ huy nhẹ giữa 8 thuyền nhẹ; hạm đội (24 thuyền) đuổi sau theo headX. Mệnh
//      Lệnh cho cánh "flotilla" = thế đứng (mô phỏng). Cứ 14 s một thuyền tiên phong rời đầu hạm đội áp mạn một thuyền nhẹ (lần
//      đầu thuyền của tướng), lính tràn sang; KO → provoke "ko", Đội trưởng vỡ thế / ngã → provoke "officer"; thuyền nhẹ bị
//      áp mạn không dọn trong 25 s thì mất (flotillaLoss). Đầu hạm đội qua Khúc cọc (sự kiện khucCoc) → P2.
//   P2 Đánh hộ vệ hạm đội — hạm đội vào khúc cọc tới x 800 rồi neo; 6 thuyền hộ vệ tách đội đi tuần hai mép sông; mỗi thuyền là
//      Cứ Điểm động (10 thủy thủ + trấn thủ Đội trưởng, dựng khi tướng tới gần), hạ trấn thủ rồi giữ X 3 s để chiếm (cờ 陳,
//      dừng, thành nơi đến đò). Sự kiện scout → thuyền dò luồng (4 + Đội trưởng) từ thuyền Phàn Tiếp tới bè cỏ của mốc; tới
//      ≤ 8 m mà Đội trưởng còn sống thì mốc lộ. Nguyễn Khoái (H40) đứng thuyền ở phao chặn luồng x 840. ≥ 4 hộ vệ hạ (hoặc hết
//      180 s) → P3.
//   P3 Kích hoạt bãi cọc — ba toán dò luồng (Đội trưởng dò luồng + 6) tới bè cỏ ở +14 / +40 / +66 s; mỗi giây báo
//      setMarkerOfficer (Đội trưởng sống, đứng trên bè, tướng xa hơn 8 m). Giữ X 5 s trên bè → mở mốc (bè trôi đi, mời đò chuyển);
//      Lệnh Kế Sách (G) khi Sẵn sàng. Nước về 50% (tide50) → P4.
//   P4 Thủy triều rút — 8 thuyền hộ vệ đợt hai (E7…E14) lần lượt tách khối hạm đội chạy ra cửa sông theo làn (né bãi đã lộ, né cụm
//      Phàn Tiếp); hộ vệ đợt một còn sót bỏ vòng tuần chạy theo. Chiếm được thì onEscortDown (Thoát vây −15), tới cửa sông thì thoát
//      ra biển (bỏ khỏi trận). Giữ vững cho cánh thuyền phục ở cửa nhánh sông (mô phỏng ×0,7; thuyền phục chèo ra cửa lạch). Báo trước
//      T−30. Phàn Tiếp gom thuyền: J8 dạt sát mạn thuyền chỉ huy, J12 tiến lên thế chỗ (cụm Liên Hoàn). strandAt (30%): thuyền có tâm
//      trong bãi đã mở thì "mắc cọc" (dừng, chưa nghiêng); cọc nhô dần (cảnh setTide). tideZero → P5.
//   P5 Chiến thuyền mắc cạn — thuyền trong bãi nằm cạn nghiêng theo strandShare (1 → mọi thuyền trong bãi; 0,5 → một nửa xác định,
//      luôn gồm cụm Phàn Tiếp), ván dốc xuống bùn; kỳ hạm chỉ "mắc" (chưa nghiêng, chưa lên được). Thuyền phục ba nhánh sông xuất
//      kích, cập mạn thuyền mắc cạn, quân ta lên boong. Tướng lội bãi bùn giữa các thân thuyền. Phàn Tiếp (X24) đánh trên thuyền chỉ
//      huy; dưới 50% Sinh lực "Liên Hoàn Thuyền" (ván + xích nối ba boong, cả cụm đứng vững); Sinh lực khóa 25% — Vỡ Thế rồi Đòn Quyết
//      "Bắt sống" (defeatMeans "bị bắt"): đứng thẳng, vũ khí đặt xuống, quân ta hạ giáo vây quanh; setCmdShips(1). Kỳ hạm lún, nghiêng
//      4 s (rung màn, băng chữ "Kỳ hạm mắc cạn") → P6.
//   P6 Bạch Đằng Quyết Chiến — Hào Khí đặt 100 và khóa tới khi kích Tổng Phản Công (nhắc bấm F; Tuyệt Kỹ đầu tiên trong Tổng Phản
//      Công là bản Hào Khí, không tốn Khí Lực — canon). Kỳ hạm có ván dốc từ bùn. Ô Mã Nhi (X20, Đại tướng): boong dưới 100 → 50% cùng
//      các nhóm tinh nhuệ; tới 50% lui lên lầu chỉ huy qua cầu thang (không nhận đòn), Đội trưởng + 4 tinh nhuệ giữ cầu thang; lầu
//      chỉ huy 50 → 10% (khóa, viền vàng; thêm Kích xuyên), Vỡ Thế → Đòn Quyết "Bắt sống" → bị bắt → cảnh kết (máy quay kéo lên nhìn
//      cả khúc sông) → thắng. Đỗ Hành (người bắt Ô Mã Nhi theo Toàn thư) chỉ là tên trong lời kết.
// Thua duy nhất khi tướng gục hết Gượng dậy (canon; không hết giờ).
//
// Checkpoint đầu mỗi pha: { phase, river (snapshotRiver), hk, tướng, hộ vệ đã hạ, … }; restoreCheckpoint → setupPhase(i, snap)
// dựng lại pha tất định (thuyền theo kịch bản pha, thủy thủ dựng lại, tướng ở chỗ đầu pha). ?debug&battle=B20&phase=N (1..6):
// dựng trạng thái hợp lý của đầu pha N (fastForward) rồi setupPhase.
// API cho bot / kịch bản: ferryTo(id), ferryItems(), hold(sec) (giữ Tương tác), openFerry(), keSachTrigger(), goPhase(i),
// ships (id → Boat), flot (thuyền nhẹ; [0] thuyền chỉ huy), esc (id → hộ vệ; wave 1|2, patrol / flee / stuck / down / gone), vg (tiên
// phong), scouts, squads, bosses { X24, X20 } (BigUnit), x20 { st: "deck"|"retreat"|"wait"|"tower", phase }, sorties, hulls, stranded.
// Hàm thuần xuất kèm: fleeDz, fleeZonesFor, fleePath (làn thoát ra cửa sông), clusterSlot (chỗ áp mạn trong cụm Liên Hoàn).
// Mọi số không nguồn là ĐỀ XUẤT BẢN THỬ (khối FORMATION… cuối data/battle-b20.js).

import { MAP, PHASES, STAKES, FLEET, LIGHT_BOATS, KE_SACH, KS_ORDER, WINGS, WING_ORDERS, ALLY_GENERALS, TIDE, FORMATION, FLOTILLA,
  VANGUARD, ESCORT_OPS, SCOUT_OPS, SQUADS, FERRY, HK_B20, BOSSES, EBB_OPS, CLUSTER, SORTIE, HULL_CREW, BOSS_OPS } from "../data/battle-b20.js";
import { riverTick, setPhase, tideAt, tidePct, provoke, flotillaLoss, onEscortDown, markerAction, setMarkerOfficer, keSachTrigger,
  order as riverOrder, strandShare, riverResult, snapshotRiver, activeMarkers, KS_STATE_WORD, setCmdShips } from "../sim/river.js";
import { gain, tick as hkTick, activate as hkActivate, tpcReady, milestone, raiseTo } from "../sim/haokhi.js";
import { HAO_KHI, HERO, MODES } from "../data/tuning.js";
import { HudB20, riverHud } from "./hud-b20.js";
import { strandSelect } from "./naval.js";
import { BOAT, HULLS } from "./boats.js";
import { BigUnit } from "./units.js";
import { zc, hw, TIDE_Y } from "../data/river-b20.js";
import { TRIBS, tribPoint } from "../data/terrain-b20.js";
import { makeRng } from "../core/rng.js";
import { collide } from "./ground.js";

export const PAR_B20 = 780;                                         // par Trận nhanh 13 phút (canon B20)
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clone = (o) => JSON.parse(JSON.stringify(o));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const LC = { "Chính sử": "cs", "Tương truyền": "tt", "Hư cấu": "hc" };
const lbl = (l) => `<span class="label ${LC[l]}">${l}</span>`;
const DOWN = Math.PI / 2;                                           // hướng xuôi dòng (+x)
const PHASE_NOTES = [
  ["Chính sử", "Triều lên. Thuyền nhẹ quân Trần ra khiêu chiến rồi giả thua, dụ thủy quân Nguyên vào khúc sông đã đóng cọc."],
  ["Hư cấu", "Thuyền hộ vệ tuần quanh hạm đội và thuyền dò luồng của Phàn Tiếp là chi tiết của game."],
  ["Chính sử", "Cọc gỗ lớn vạt nhọn đã đóng sẵn thành bãi dưới lòng sông; triều lên thì cọc chìm khuất."],
  ["Chính sử", "Nước triều rút. Thuyền Nguyên quay mũi ra biển thì vướng bãi cọc."],
  ["Chính sử", "Nước ròng, thuyền Nguyên mắc cọc giữa bãi; quân Trần đánh ra."],
  ["Chính sử", "Trong trận này Ô Mã Nhi, Phàn Tiếp, Tích Lệ Cơ Ngọc đều bị bắt sống."],
];
const STANCE_SAY = { tiencong: "Tiến công: áp sát đầu hạm đội mà khiêu chiến (≈ 16 m)", giuvung: "Giữ vững: giữ cách đầu hạm đội ≈ 28 m",
  theota: "Theo ta: lui nhanh xuôi dòng (≈ 46 m)" };

// ---- đường làn dọc sông: điểm mỗi 20 m ở lệch dz khỏi tâm dòng; Catmull-Rom qua điểm cách đều x nên x(u) tuyến tính ----------
const LANE = { x0: -320, x1: 1260, step: 20, sub: 10 };
export function lanePath(dz) { const P = []; for (let x = LANE.x0; x <= LANE.x1; x += LANE.step) P.push({ x, z: zc(x) + dz }); return P; }
// độ dài cung trên làn ứng với hoành độ x (tra bảng S của Track, nội suy)
export function laneS(track, x) {
  const u = clamp((x - LANE.x0) / LANE.step, 0, track.n), k = u * LANE.sub, S = track.S;
  const i = Math.min(Math.floor(k), S.length - 2), f = k - i;
  return S[i] + (S[i + 1] - S[i]) * f;
}
// vòng tuần của thuyền hộ vệ: chữ nhật bo góc ở mép sông side (±1), x0..x1, |dz| 48..58
export function patrolLoop([x0, x1, side], [d0, d1] = ESCORT_OPS.dz) {
  const xm = (x0 + x1) / 2, dm = (d0 + d1) / 2, P = (x, d) => ({ x, z: zc(x) + side * d });
  return [P(x0, d0), P(xm, d0), P(x1, d0), P(x1 + 9, dm), P(x1, d1), P(xm, d1), P(x0, d1), P(x0 - 9, dm)];
}
// Pha 4: lệch ngang làn thoát ra cửa sông ở hoành độ x, phía side (±1): |dz| = EBB_OPS.lane; trong vùng né zones [[x0, x1, phía
// 0 = cả hai | ±1], …] (bãi cọc đã lộ, cụm thuyền Phàn Tiếp) thì laneOut, hoà dần trong blend m (smoothstep).
export function fleeDz(x, side, zones = [], O = EBB_OPS) {
  let w = 0;
  for (const [a, b, sd] of zones) {
    if (sd && sd !== side) continue;
    const k = x < a ? 1 - (a - x) / O.blend : x > b ? 1 - (x - b) / O.blend : 1;
    if (k > w) w = k;
  }
  return side * lerp(O.lane, O.laneOut, smooth01(w));
}
// Vùng né thực cho một thuyền xuất phát ở x0, phía side: đổi làn giữa lane và laneOut phải cắt ngang làn ±36 của khối hạm đội neo —
// nên vùng né nào chạm khối (x < EBB_OPS.block) thì kéo dài thành laneOut suốt từ chỗ xuất phát tới hết khối, đổi làn sau khối.
export function fleeZonesFor(x0, side, zones = [], O = EBB_OPS) {
  const Z = zones.filter((z) => !z[2] || z[2] === side), hit = Z.filter((z) => z[0] < O.block && z[1] > x0 - O.blend);
  if (!hit.length) return Z;
  return [[x0 - O.blend - 1, Math.max(O.block, ...hit.map((z) => z[1])), side], ...Z.filter((z) => !hit.includes(z))];
}
// Làn thoát từ (x0, z0): điểm mỗi 10 m theo fleeDz (vùng né thực fleeZonesFor) tới quá cửa sông 20 m. out: làn ngoài suốt (hộ vệ
// đợt một bỏ vòng tuần — vốn ở ngoài khối hạm đội).
export function fleePath(x0, z0, side, zones = [], out = false, O = EBB_OPS) {
  const P = [{ x: x0, z: z0 }], Z = fleeZonesFor(x0, side, zones, O);
  for (let x = Math.ceil((x0 + 8) / 10) * 10; x <= MAP.exitX + 20; x += 10) P.push({ x, z: zc(x) + (out ? side * O.laneOut : fleeDz(x, side, Z, O)) });
  return P;
}
// Chỗ áp mạn của thuyền n trong cụm Liên Hoàn: sát mạn thuyền chỉ huy pt (phía n đang đứng), khe CLUSTER.gap, cùng hướng. Thuần
// (pt, n: { x, z, yaw?, beam }).
export function clusterSlot(pt, n, gap = CLUSTER.gap) {
  const c = Math.cos(pt.yaw), s = Math.sin(pt.yaw), sg = (n.x - pt.x) * c - (n.z - pt.z) * s >= 0 ? 1 : -1;
  const off = sg * (pt.beam / 2 + n.beam / 2 + gap);
  return { x: pt.x + off * c, z: pt.z - off * s, yaw: pt.yaw };
}

export class DirectorB20 {
  constructor(ctx) {
    this.ctx = ctx; ctx.director = this;
    this.st = ctx.sim; this.nav = ctx.naval;
    this.mode = ctx.mode || "nhanh"; this.M = { ...MODES[this.mode], par: PAR_B20, timeout: Infinity };
    this.phase = 0; this.phaseStart = 0; this.time = 0; this.simAcc = 0;
    this.ko = 0; this.koMs = 0; this.msgs = []; this.over = false; this.result = null; this.checkpoint = null;
    this.events = {}; this.pickups = []; this.flags = []; this.keepers = {}; this.generals = {}; this.followers = null;
    this.retries = 0; this.lastFront = "flotilla"; this.baseHint = null; this.orders = 0; this.counterBoss = 0;
    this.main = [false, false, false, false, false, false]; this.phaseTimes = [0, 0, 0, 0, 0, 0];
    this.scoutsStopped = 0; this.escaped = 0; this.captured = {}; this.bossesMet = [];
    this.skSum = 0; this.skN = 0; this.hkLock = false; this.lastMs = 0;
    this.ships = {}; this.flot = []; this.ambush = []; this.esc = {}; this.vg = []; this.scouts = []; this.squads = [];
    this.vgN = 0; this.vgNext = 0; this.scoutN = 0; this.opsT = 0; this.tideShown = -1;
    this.interact = null; this.ferryPick = null; this.holdT = 0; this.needRelease = false; this.guardDue = [];
    this.buffs = [];                                     // Hịch Tướng Sĩ: [{ a, id, k, until }] Công quân ta tạm tăng (id: lính trong bể dùng lại)
    this.playTime = 0;                                   // giây đã chơi, cộng dồn qua các lần tải lại checkpoint (time thì tua về đầu pha)
    this.safeUntil = -1;                                 // tướng không nhận đòn tới giây này (sau khi bắt sống: chờ chuyển pha / thắng)
    this.cine = null;                                    // cảnh máy quay ngắn trong trận: bắt sống, kỳ hạm mắc cạn
    this.bosses = {}; this.x20 = null; this.chained = null; this.cl = null; this.sorties = []; this.hulls = {}; this.hullT = 0;
    this.outro = null; this.rallyAt = 0; this.stairGuard = null; this.stranded = [];
    this.bq = []; this.bqT = 0;                          // hàng đợi băng chữ
    this.headPrev = this.headCur = this.st.fleet.headX; this.flotPrev = this.flotCur = this.st.nghi.flotX;
    this.headS = this.headCur; this.flotS = this.flotCur;
    // Kế Sách B20: sim/river.js giữ trạng thái, HudB20 vẽ cả 3 mục (hud() rỗng để hud.js không vẽ trùng)
    this.keSach = {
      list: [], boats: [], bundles: [], hud: () => [], trigger: () => this.keSachTrigger(), update() {}, get: () => null,
      snapshot: () => null, restore() {},
      ratio: () => { let g = 0, h = 0; for (const id in this.st.ks) { g += this.st.ks[id].got; h += KE_SACH[id].hk; } return h ? g / h : 0; },
      successCount: () => riverResult(this.st).keSachOk,
    };
    // móc lớp thủy chiến: chiếm thuyền, mở mốc, gọi đò, vớt tướng
    const nav = this.nav;
    nav.on = {
      capture: (b) => this.captureEscort(b),
      marker: (id) => this.openMarker(id),
      ferry: () => this.openFerry("interact"),
      rescue: () => { this.ferryPick = null; this.say("Tướng rơi xuống sông — thân binh vớt lên (−5% Sinh lực).", 3, "bad"); },
      relanded: (o) => { if (o === this.hero) { this.ferryPick = null; this.say("Thuyền dưới chân rời trận — tướng sang thuyền quân ta gần nhất.", 3); } },
      ferryRetarget: (f) => this.say(`Nơi đến không còn — đò cập ${f.dest.deck.label ? f.dest.deck.label.toLowerCase() : "thuyền quân ta gần nhất"}.`, 3),
    };
    nav.canMarker = (id) => this.phase === 2 && this.st.markers[id]?.state === "hidden";
    ctx.fx.noBlood = true;                               // B20: không máu (R-spec §6) — tia trúng đòn đổi màu bụi gỗ / tia lửa (fx.js)
    ctx.poiseAbs = true;                                 // Phá Thế địch không nhân S(R) (canon: Đội trưởng 100, Tướng 600, Đại tướng 1000 mỗi tầng)
    this.hudB20 = new HudB20(ctx);
    // ?debug&phase=N: dựng trạng thái hợp lý đầu pha N
    const m = typeof location !== "undefined" && /[?&]debug\b/.test(location.search) ? location.search.match(/[?&]phase=(\d)/) : null;
    const want = m ? clamp(Number(m[1]) - 1, 0, 5) : 0;
    if (want > 0) this.fastForward(want);
    else { this.setupPhase(0, null); this.introP1(); }
    this.saveCheckpoint();
  }

  // ---- tiện ích ------------------------------------------------------------------------------------------------------------
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }   // chữ phím ({Act:cmd}, {tpc}…) đổi lúc vẽ, hud.js update
  // Băng chữ giữa màn qua hàng đợi (fx.banner không xếp hàng: hai băng liền nhau đè chữ lên nhau) — cách nhau ≥ T + 0,6 s,
  // bỏ băng trùng, giữ tối đa 3.
  banner(text, color = "#f1d98a", T = 1.2) {
    const q = this.bq; if (q.some((b) => b.text === text) || q.length >= 3) return;
    q.push({ text, color, T });
  }
  note(i) { const [l, t] = PHASE_NOTES[i]; this.say(`${lbl(l)}${t}`, 8); }
  hk(amount, src, optional = false) { const g = gain(this.ctx.hk, amount, src, { optional }); if (g && Math.abs(g) >= 0.5) this.ctx.hud?.hkPulse(g); return g; }
  get hero() { return this.ctx.hero; }
  basePos() { return null; }
  heroBoat() { return this.hero.deck?.boat || null; }
  lead() { return this.flot[0] || null; }
  env() { return this.nav._envNow(); }
  // mở màn: ba dòng cách nhau 4 s (trước đây hiện cùng lúc — 4 tin, ~230 px chữ che trận ở điện thoại; review B20)
  introP1() {
    this.say(PHASES[0].tip, 9);
    this.later(4, () => { if (this.phase === 0) this.note(0); });
    this.later(8, () => { if (this.phase === 0) this.say("{Act:cmd} để mở vòng Mệnh Lệnh → cánh Thuyền nhẹ: Tiến công khiêu chiến, Giữ vững giữ khoảng cách, Theo ta lui nhanh.", 9); });
  }

  // ---- vòng lặp --------------------------------------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, st = this.st, hk = ctx.hk;
    if (this.over) return;
    this.time += dt; this.playTime += dt;
    // mô phỏng khúc sông 1 Hz
    this.simAcc += dt;
    while (this.simAcc >= 1) { this.simAcc -= 1; this.tick1(); }
    const f = Math.min(1, this.simAcc);
    this.headS = this.headPrev + (this.headCur - this.headPrev) * f;
    this.flotS = this.flotPrev + (this.flotCur - this.flotPrev) * f;
    const pct = tideAt(st, dt);
    if (Math.abs(pct - this.tideShown) > 0.004) { this.tideShown = pct; ctx.world.setTide(pct); }
    // Hào Khí
    if (hkTick(hk, dt)) this.onTpcEnd();
    if (this.hkLock && !hk.tpc && hk.value < 100) raiseTo(hk, 100, "kịch bản: pha 6");
    const ms = milestone(hk);
    if (ms > this.lastMs && ms < 100) { this.banner(`HÀO KHÍ ${ms}`, "#f1d98a", 1); ctx.audio.play("drum"); }
    if (ms === 100 && this.lastMs !== 100) { this.banner("TỔNG PHẢN CÔNG SẴN SÀNG · {TPC}", "#ffd27a", 1.8); ctx.audio.play("drums3"); }
    this.lastMs = ms;
    st.heroFront = this.heroWing();
    // từng pha
    if (this.phase === 0) this.updateLure(dt);
    this.updateFleetVis();
    if (this.phase >= 1) this.updateEscorts(dt);
    if (this.phase === 1 || this.phase === 2) this.updateScouts(dt);
    if (this.phase === 2) this.updateSquads(dt);
    if (this.phase >= 3) this.updateEbb(dt);
    if (this.phase >= 4) { this.updateHulls(dt); this.updateSortie(dt); }
    this.updateBosses(dt);
    this.separate();
    this.updateInteract(dt);
    this.updateGuards();
    if (this.timers?.length) { let n = 0; for (const T of this.timers) if (!T.done && this.time >= T.at) { T.done = true; T.fn(); n++; } if (n) this.timers = this.timers.filter((T) => !T.done); }
    // hết Hịch Tướng Sĩ: trả Công — chỉ khi đúng người ấy (lính trong bể dùng lại có id mới: người mới không bị chia Công)
    for (let i = this.buffs.length - 1; i >= 0; i--) { const b = this.buffs[i]; if (this.time >= b.until) { if (b.a.id === b.id && b.a.alive) b.a.cong /= b.k; this.buffs.splice(i, 1); } }
    let old = 0; for (const m of this.msgs) { m.t += dt; if (m.t >= m.T) old++; }
    if (old) this.msgs = this.msgs.filter((m) => m.t < m.T);
  }
  // mỗi khung (BattleDef.frameVisuals): HUD riêng của trận
  frame(dt) {
    const cam = this.ctx.cam;
    if (cam && !this.camSet) { this.camSet = true; cam.dist = 12; }         // khúc sông rộng: cần camera dài hơn B15 một chút
    this.pickerFrame();
    // vòng mốc cọc (world.addBase "moc") chỉ có nghĩa tới P3; từ P4 (nước rút, bãi bùn) và lúc cảnh kết thì ẩn — trước đây vòng
    // trắng còn nằm trên bùn trong cảnh kết (review B20)
    const showMk = this.phase <= 2 && !this.outro;
    if (showMk !== this.mkShown) { this.mkShown = showMk; for (const s of STAKES) { const v = this.ctx.world.bases?.[s.id]; if (v?.ring) v.ring.visible = showMk; if (v?.prog) v.prog.visible = showMk; } }
    this.bqT -= dt;
    if (this.bqT <= 0 && this.bq.length) { const b = this.bq.shift(); this.ctx.fx.banner(b.text, b.color, b.T); this.bqT = b.T + 0.6; }   // fx gỡ băng sau T + 0,4 s
    // trạng thái HUD dựng lại 20 lần/s (HudB20 chỉ đọc nhắc giữ phím, bảng đò mỗi khung — hai trường ấy cập nhật mỗi khung)
    this.hudAcc = (this.hudAcc || 0) + dt;
    if (!this._hs || this.hudAcc >= 0.05) { this._hs = this.hudState(); this.hudAcc = 0; }
    else { this._hs.interact = this.cine || this.outro ? null : this.interact; this._hs.ferry = this.ferryPick; }
    this.hudB20?.update(this._hs, dt);
    if (this.outro) this.outroCamera(dt); else if (this.cine) this.cineCamera(dt);
  }
  // Đóng bảng Đò chuyển — đọc phím mỗi KHUNG (trước input.endFrame), không trong bước mô phỏng: bảng mở thì đồng hồ trận ×0,2 nên
  // phần lớn khung không có bước nào, cú bấm X / Space bị endFrame xoá mất (review B20: 10/20 lần bấm không đóng được). Tướng đổi
  // boong (bị vớt, sang thuyền khác, bè trôi mất) thì bảng tự đóng — không để trận chạy ×0,2 mãi.
  pickerFrame() {
    const P = this.ferryPick; if (!P) return;
    const h = this.hero, inp = this.ctx.input;
    const press = !!(inp?.pressed?.interact || inp?.pressed?.dodge);
    if (press || h.deck !== P.deck || !h.alive || h.state === "down" || h.state === "climb" || h.state === "ride" || this.over) {
      this.ferryPick = null; this.needRelease = !!inp?.held?.interact || this.holdT > 0;
      if (inp?.pressed) { inp.pressed.interact = false; inp.pressed.dodge = false; }
    }
  }
  // Điểm máy quay cần thấy (naval.render → FleetRenderer: thân thuyền, buồm, lầu chỉ huy chắn giữa thì mờ chấm): ngực tướng; cảnh
  // bắt sống: người bị bắt; cảnh kỳ hạm mắc cạn, cảnh kết: không (nhìn cả thân thuyền — không đục lỗ chấm giữa kỳ hạm). Thay sailCamera cũ (xoay máy quay song song
  // tấm buồm, kéo sát tướng còn ~6 m — review B20: vẫn bị che, máy quay dí vào lính, mạn thuyền).
  seeTarget() {
    if (this.outro || this.cine?.kind === "flagship") return null;
    if (this.cine?.see) return this.cine.see();
    const h = this.hero; return h ? { x: h.x, y: h.y + 1.3, z: h.z } : null;
  }

  tick1() {
    const st = this.st, ev = [];
    if (this.phase === 2) for (const q of this.squads) if (q.raft) {
      const o = q.officer, h = this.hero;
      setMarkerOfficer(st, q.id, !!o && o.alive && !o.dead && o.deck === q.raft && dist(o, h) > SQUADS.heroR);
    }
    this.headPrev = this.headS; this.flotPrev = this.flotS;
    riverTick(st, ev);
    this.headCur = st.fleet.headX; this.flotCur = st.nghi.flotX;
    let sk = 0, n = 0; for (const id in st.wings) { sk += st.wings[id].sk; n++; } this.skSum += sk / n; this.skN++;
    this.handle(ev);
    if (this.phase === 0 && st.nghi.stance === "tiencong" && st.nghi.gap <= LIGHT_BOATS.provokeR) this.tauntVolley();
  }
  // Khiêu chiến (Tiến công, cách ≤ provokeR m): nỏ thủ trên thuyền nhẹ bắn tên sang boong đầu hạm đội — chỉ là hình (Khiêu khích do
  // mô phỏng cộng), không sát thương.
  tauntVolley() {
    const crowd = this.ctx.crowd, head = Object.values(this.ships).filter((b) => b.ctl?.row === 0 && b.visible);
    if (!head.length) return;
    let n = 0;
    for (const a of crowd.agents) {
      if (n >= 4 || !a.flot || !a.K.ranged || !crowd.hittable(a)) continue;
      const tgt = head.reduce((p, q) => (dist(q, a) < dist(p, a) ? q : p));
      const W = tgt.deck.toWorld((this.ctx.rng.next() - 0.5) * 3, (this.ctx.rng.next() - 0.5) * 8, {});
      crowd.fireArrow(a, { x: W.x, z: W.z, boatY: W.y }, true); n++;
    }
  }

  // Sự kiện của sim/river.js → Hào Khí, tin nhắn, chuyển pha, thuyền.
  handle(evs) {
    const ctx = this.ctx, st = this.st;
    for (const e of evs) {
      switch (e.type) {
        case "hk": this.hk(e.amount, e.source); break;
        case "hkSet": raiseTo(ctx.hk, e.value, "kịch bản: pha 6"); ctx.hud?.hkPulse(100); this.hkLock = !!e.lock; break;
        case "ksOpen": { const K = KE_SACH[e.id]; this.banner(`KẾ SÁCH LỚN · ${K.name.toUpperCase()}`, "#f1d98a", 1.6);
          this.say(`Kế Sách Lớn "${K.name}" khả dụng${e.window ? ` (${e.window} s)` : ""}: ${K.text}`, 8, "good"); break; }   // luật chơi: không nhãn (nhãn sử ở dòng thành công)
        case "ksResult": { const K = KE_SACH[e.id];
          this.banner(`${K.name.toUpperCase()} · ${e.ok ? "THÀNH CÔNG" : "THẤT BẠI"}`, e.ok ? "#f1d98a" : "#ff8a6a", 1.8);
          ctx.audio.play(e.ok ? "capture" : "horn");
          this.say(e.ok ? `Kế Sách "${K.name}" thành công. ${lbl(K.label)}${K.lore}` : `Kế Sách "${K.name}" thất bại: ${e.why}`, 7, e.ok ? "good" : "bad"); break; }
        case "baited": this.say("Khiêu khích đầy: hạm đội Nguyên đã mắc mồi. Lui qua mốc Khúc cọc, giữ cách 15–40 m.", 6, "good"); ctx.audio.play("drum"); break;
        case "stance": break;
        case "boatLost": this.onBoatLost(e); break;
        case "flotillaCrossed": this.say("Đoàn thuyền nhẹ đã qua mốc Khúc cọc — giữ khoảng cách tới khi đầu hạm đội theo qua.", 5, "good"); break;
        case "khucCoc": if (this.phase === 0) this.goPhase(1); break;
        case "escorts": if (e.wave === 1) this.say(`Phàn Tiếp tung ${e.n} thuyền hộ vệ đi tuần quanh hạm đội.`, 5, "bad"); break;
        case "escortDown": this.say(`Đã hạ ${st.fleet.escortsDown}${this.phase === 1 ? "/4" : ""} thuyền hộ vệ · còn ${e.left} chiếc.`, 4, "good"); break;
        case "escortsReady": if (this.phase === 1) { this.say("Đã hạ 4 thuyền hộ vệ: hạm đội hở sườn, tới các mốc cọc!", 5, "good"); this.goPhase(2); } break;
        case "p2Timeout": if (this.phase === 1) { this.say("Hết giờ đánh hộ vệ — hộ vệ còn lại sẽ nhập đợt hai ở pha 4.", 5, "bad"); this.goPhase(2); } break;
        case "scoutWarn": this.say(`${lbl("Hư cấu")}Tình báo sớm: thuyền dò luồng sắp rời hạm đội, nhắm mốc ${e.target} (${e.in} s).`, 5, "bad"); break;
        case "scout": this.spawnScout(e.target); break;
        case "markerExposed": this.onMarkerExposed(e); break;
        case "markerActive": this.say(`Đã mở mốc ${e.id} (${e.active}/${KE_SACH.kichCoc.need}).`, 4, "good"); break;
        case "ksReady": this.banner("KẾ SÁCH SẴN SÀNG · BẤM {KESACH}", "#ffd27a", 1.8); ctx.audio.play("drums3");
          this.say(`Đủ ${KE_SACH.kichCoc.need} mốc: bấm {kesach} (Lệnh Kế Sách) để kích hoạt bãi cọc — hoặc mở nốt mốc thứ ba.`, 7, "good"); break;
        case "tideDrop": this.say(`Kế Sách bãi cọc đã chốt: nước bắt đầu rút về 50% trong ${e.sec} s.`, 5); break;
        case "tide50": if (this.phase === 2) this.goPhase(3); break;
        case "tideWarn": this.banner(e.at === "strand" ? "30 S NỮA · CỌC NHÔ" : "30 S NỮA · NƯỚC RÒNG", "#ffd27a", 1.4);
          this.say(e.at === "strand" ? "30 s nữa nước xuống 30%: cọc nhô, thuyền trong bãi cọc đã mở sẽ mắc cọc." : "30 s nữa nước ròng: thuyền Nguyên mắc cạn giữa bãi cọc.", 5, "bad"); break;
        case "strandAt": this.onStrandAt(e); break;
        case "escapeFull": this.say("Thanh Thoát vây đã đầy: hạm đội thoát khỏi vòng vây — Kế Sách Con nước hỏng.", 6, "bad"); break;
        case "tideZero": if (this.phase === 3) this.goPhase(4); break;
        case "sortie": this.say(`${lbl("Chính sử")}Thuyền phục sông Chanh, sông Rút, sông Giá xuất kích, đánh vào thuyền Nguyên mắc cạn!`, 6, "good"); break;
        case "order": break;
        case "orderEnd": if (e.wing !== "flotilla") this.say(`${WINGS[e.wing].name}: hết lệnh ${WING_ORDERS[e.order].name}.`, 2.5); break;
        case "reinfArrived": this.say(`Tiếp viện ${e.amount} quân tới ${WINGS[e.wing].name}.`, 4, "good"); break;
        default: break;
      }
    }
  }

  // ---- chuyển pha ------------------------------------------------------------------------------------------------------------
  goPhase(i) {
    if (i <= this.phase || this.over) return;
    const ctx = this.ctx, prev = this.phase, ev = [];
    this.phaseTimes[prev] = Math.round(this.time - this.phaseStart);
    this.main[prev] = this.phaseDone(prev);
    setPhase(this.st, i, ev);
    this.phase = i; this.phaseStart = this.time;
    this.enterPhase(i);
    this.handle(ev);
    const P = PHASES[i];
    this.bq.length = 0; this.bqT = 0;
    this.banner(`${P.id} · ${P.name.toUpperCase()}`, "#e6dcc3", 2.2); ctx.audio.play("drums3");
    this.frameCamera(i);
    if (i === 1 || i === 4) ctx.audio.play("horn");
    this.say(P.tip, 8);
    this.note(i);
    this.saveCheckpoint();
  }
  // Nhiệm vụ chính của pha i đạt chưa — theo kết quả thật lúc rời pha (trước đây rời pha là tích: P1–P4 tích cả khi Kế Sách hỏng).
  // P1 Nghi binh thành công; P2 hạ ≥ 4 hộ vệ (hết giờ thì chưa); P3 Kích hoạt bãi cọc thành công; P4 Con nước thành công; P5 bắt sống
  // Phàn Tiếp (pha 5 chỉ kết thúc như thế — kỳ hạm mắc cạn ngay sau); P6 bắt sống Ô Mã Nhi.
  phaseDone(i) {
    const ks = (id) => this.st.ks[id]?.state === "thanhcong";
    return [ks("nghiBinh"), this.st.fleet.escortsDown >= 4, ks("kichCoc"), ks("conNuoc"), !!this.captured.X24, !!this.captured.X20][i] ?? false;
  }
  // Camera đầu pha: quay về phía việc của pha (P1 hạm đội phía thượng lưu, P2 khúc cọc hạ lưu, P3 bè cỏ ẩn gần nhất, P5–P6 thuyền
  // mắc cạn cần lên).
  frameCamera(i) {
    const cam = this.ctx.cam, h = this.hero; if (!cam) return;
    let tgt = null;
    if (i === 2) {
      const at = (r) => ({ x: r.deck.m[9], z: r.deck.m[11] });
      const R = this.nav.rafts.filter((r) => this.st.markers[r.id]?.state === "hidden").sort((a, b) => dist(at(a), h) - dist(at(b), h))[0];
      if (R) tgt = at(R);
    }
    else if (i === 3) {                        // P4: thuyền hộ vệ đợt hai gần nhất (đang tách khỏi hạm đội)
      let bd = Infinity; for (const id in this.esc) { const e = this.esc[id]; if (e.wave === 2 && !e.gone && dist(e.boat, h) < bd) { bd = dist(e.boat, h); tgt = e.boat; } }
    }
    else if (i === 4) tgt = this.ships.PT; else if (i === 5) tgt = this.ships.FS;
    // thuyền mắc cạn to và gần: lệch camera sang một bên cho thân thuyền không che cả khung
    cam.yaw = tgt ? Math.atan2(tgt.x - h.x, tgt.z - h.z) + (i >= 4 ? 0.75 : 0) : i === 0 ? -DOWN : DOWN;
    cam.idle = 0; cam.pitch = Math.max(cam.pitch, 0.4);
  }
  // Việc làm ngay khi sang pha (đang chơi; tải lại checkpoint thì setupPhase dựng thẳng trạng thái đầu pha).
  enterPhase(i) {
    const ctx = this.ctx;
    if (i === 1) {
      for (const v of [...this.vg]) this.vgDrift(v);
      this.flotToHold(false);
      for (const id in this.esc) if (!this.esc[id].down) this.setPatrol(this.esc[id], false);
      ctx.world.boom?.show();
      this.spawnKhoai();
    }
    if (i === 2) this.planSquads();
    if (i === 3) {
      this.startEbb();
      this.say("Hộ vệ đợt hai tách khỏi hạm đội chạy ra cửa sông: chặn, chiếm từng thuyền (đò chuyển: giữ Tương tác) — mỗi thuyền hạ kéo Thoát vây −15.", 8, "bad");
      this.say("{Act:cmd} để mở Mệnh Lệnh → cánh thuyền phục gần nhất: Giữ vững chặn cửa nhánh sông, thanh Thoát vây chậm lại ×0,7.", 8);
    }
    if (i === 4) {
      this.stopFleeing();
      this.strandFleet(false);
      for (const b of this.ambush) b.hidden = false;
      this.spawnX24(); this.startSortie();
      this.say("Nước ròng: lội bãi bùn, leo ván dốc lên thuyền chỉ huy Phàn Tiếp. Đánh tới Vỡ Thế rồi Đòn Quyết để bắt sống.", 8);
    }
    if (i === 5) {
      this.strandFlagship(false); this.spawnX20(); this.sortieToFS();
      this.rallyAt = this.time + 2.5;                   // băng chữ nhắc F sau băng chữ đầu pha (goPhase xoá hàng đợi băng chữ)
      this.say("Hào Khí đặt 100 và khóa tới khi kích Tổng Phản Công ({tpc}). Tuyệt Kỹ đầu tiên trong Tổng Phản Công là bản Hào Khí, không tốn Khí Lực.", 8, "good");
      this.say("Lên kỳ hạm theo ván dốc từ bãi bùn. Ô Mã Nhi đánh ở boong dưới rồi lui lên lầu chỉ huy.", 8);
    }
  }

  // ---- dựng pha (đầu trận, tải lại checkpoint, ?debug&phase=N) -----------------------------------------------------------------
  setupPhase(i, snap) {
    const ctx = this.ctx, st = this.st, nav = this.nav, h = this.hero;
    this.clearAll();
    if (snap) {
      for (const k in st) delete st[k];
      Object.assign(st, clone(snap.river));
      Object.assign(ctx.hk, clone(snap.hk));
      this.time = snap.time; this.phaseStart = snap.time; this.ko = snap.ko; this.koMs = snap.koMs;
      this.main = [...snap.main]; this.phaseTimes = [...snap.phaseTimes]; this.scoutsStopped = snap.scoutsStopped; this.escaped = snap.escaped;
      this.captured = { ...snap.captured }; this.bossesMet = [...snap.bossesMet]; this.orders = snap.orders; this.counterBoss = snap.counterBoss;
      this.hkLock = snap.hkLock; this.vgN = snap.vgN || 0; this.scoutN = snap.scoutN || 0; this.tpcLog = clone(snap.tpcLog || []);
    }
    this.phase = i; this.simAcc = 0; this.tideShown = -1;
    this.headPrev = this.headCur = this.headS = st.fleet.headX;
    this.flotPrev = this.flotCur = this.flotS = st.nghi.flotX;
    this.vgNext = this.time + VANGUARD.first;
    ctx.world.setTide(tidePct(st)); this.tideShown = tidePct(st);
    // mốc cọc: cảnh theo trạng thái mô phỏng (bè đã cắt thì trôi hết)
    const S = ctx.world.scenery;
    for (const s of STAKES) {
      const state = st.markers[s.id].state;
      S?.stakes?.setState(s.id, state);
      if (state === "active") { const r = S?.rafts?.list?.find((q) => q.id === s.id); if (r) { r.t = 20; r.gone = true; } }
    }
    if (i >= 1) ctx.world.boom?.show(); else ctx.world.boom?.hide();
    this.buildFleet(i, snap);
    if (i >= 3) this.buildEbb(i, snap);
    this.buildFlotilla(i);
    this.buildAmbush();
    if (i >= 1) this.spawnKhoai();
    if (i === 2) this.planSquads();
    if (i >= 4) this.strandFleet(true);
    if (i >= 5) this.strandFlagship(true);
    nav.update(0);
    if (i === 4) { this.spawnX24(); this.startSortie(); }
    if (i === 5) { this.spawnX20(); this.startSortie({ fs: true }); this.rallyAt = this.time + 12; }
    // tướng: chỗ đầu pha
    h.alive = true; h.state = "free"; h.lock = null; h.invuln = 2;
    // tải lại: Sinh lực ≥ retryHp[i] (pha 5–6 đầy — B20 không có đồ hồi máu; trước đây 50% mà vào trận boss Tướng quân là tường)
    if (snap) { h.hp = Math.max(snap.hero.hp, h.maxHp * (BOSS_OPS.retryHp[i] ?? HERO.retryHp)); h.ki = snap.hero.ki; h.revives = snap.hero.revives; }
    this.placeHeroForPhase(i);
    this.spawnGuards(true);
    this.frameCamera(i);
  }
  // Dọn mọi thứ của pha trước: đò, leo, người trên boong, thuyền, lính, đơn vị lớn, bảng chọn.
  clearAll() {
    const ctx = this.ctx, nav = this.nav;
    nav.restore({ t: nav.t, boats: [], links: [], rafts: [] });
    for (const a of [...ctx.crowd.agents]) ctx.crowd.release(a);
    for (const u of ctx.units) if (u.alive) u.dispose();
    ctx.units.length = 0;
    this.ships = {}; this.flot = []; this.ambush = []; this.esc = {}; this.vg = []; this.scouts = []; this.squads = [];
    this.generals = {}; this.khoai = null; this.guardDue = []; this.buffs = [];
    this.ferryPick = null; this.interact = null; this.holdT = 0; this.needRelease = false; this.timers = []; this.stranded = [];
    this.bosses = {}; this.x20 = null; this.chained = null; this.cl = null; this.sorties = []; this.hulls = {}; this.stairGuard = null; this.outro = null;
  }
  placeHeroForPhase(i) {
    const h = this.hero, L = this.lead();
    if (i <= 1) { this.placeOn(L.deck, 0, -1.8, i === 0 ? -DOWN : 0); return; }
    if (i <= 3) {
      const cap = Object.values(this.esc).find((e) => e.down && e.boat);
      if (cap) this.placeOn(cap.boat.deck, 0, -1.5, 0); else this.placeOn(L.deck, 0, -1.8, 0);
      return;
    }
    const b = i === 4 ? this.ships.PT : this.ships.FS, R = b?.ramp || (b && this.nav.addRamp(b));
    if (R) {
      this.nav.leave(h);
      const W = b.deck.toWorld(R.xe + R.sg * 3.5, R.lz, {});
      h.x = W.x; h.z = W.z; h.yaw = Math.atan2(b.x - h.x, b.z - h.z); h.place(0);
      if (this.ctx.cam) this.ctx.cam.yaw = h.yaw;
    } else this.placeOn(L.deck, 0, -1.8, 0);
  }
  // đặt tướng lên boong D ở toạ độ cục bộ (lx, lz), mặt quay yaw (thế giới) — gỡ khỏi boong cũ trước (naval: không kéo về)
  placeOn(D, lx, lz, yaw = null) {
    const h = this.hero, nav = this.nav;
    nav.leave(h);
    const W = D.toWorld(lx, lz, {});
    h.x = W.x; h.z = W.z; h.state = "free"; nav.board(h, D);
    h.yaw = yaw ?? D.yaw; h.dyaw = wrap(h.yaw - D.yaw); h.place(0);
  }

  // ---- hạm đội -------------------------------------------------------------------------------------------------------------
  buildFleet(i, snap) {
    const nav = this.nav, F = FORMATION;
    for (const [id, type, row, lane] of F.ships) {
      const dz = F.lanes[lane], b = nav.addBoat({ type, side: "dich", id, flag: F.flags[id] || "元", path: lanePath(dz), speed: 0,
        label: F.labels[id] || (type === "escort" ? `Thuyền hộ vệ ${id}` : "Chiến thuyền Nguyên") });
      b.ctl = { src: "head", dx: -F.rowGap * row, dz, row };
      if (type !== "escort") b.capturable = false;       // chỉ thuyền hộ vệ là Cứ Điểm động chiếm được (kỳ hạm, thuyền chỉ huy: bắt tướng)
      this.ships[id] = b;
      if (type === "escort") {
        const down = snap ? !!snap.esc?.[id]?.down : false;
        this.esc[id] = { id, boat: b, down, crewLeft: snap?.esc?.[id]?.crewLeft ?? ESCORT_OPS.crew, officerAlive: snap?.esc?.[id]?.officerAlive ?? true,
          spawned: false, agents: [], officer: null, v: 0, s: 0, engaged: false, patrol: false };
        b.capturable = false;
      }
      b.drive = () => laneS(b.track, this.slotX(b));
      b.update(0, this.env());
    }
    // pha 2+: hộ vệ tách đội (đã hạ thì đậu ở vòng tuần, cờ 陳)
    if (i >= 1) for (const id in this.esc) {
      const e = this.esc[id];
      if (e.down) this.parkCaptured(e); else this.setPatrol(e, true);
    }
    this.updateFleetVis();
  }
  slotX(b) { const c = b.ctl; return (c.src === "head" ? this.headS : c.src === "flot" ? this.flotS : c.x0) + c.dx; }
  // đuôi hạm đội còn ngoài bản đồ (mở màn) thì giấu
  updateFleetVis() { for (const id in this.ships) { const b = this.ships[id]; if (b.ctl?.src === "head") b.visible = b.x > FORMATION.hideX; } }

  // Thuyền hộ vệ đi tuần: đường = chỗ đang đứng → vòng tuần (lặp); now = đặt thẳng vào vòng (tải lại checkpoint).
  setPatrol(e, now) {
    const b = e.boat, loop = patrolLoop(ESCORT_OPS.stations[e.id]);
    const path = now ? [...loop, loop[0]] : [{ x: b.x, z: b.z }, ...loop, loop[0]];
    b.ctl = null; b.drive = null; b.setPath(path, 0);
    e.a0 = now ? 0 : b.track.S[LANE.sub]; e.s = 0; e.v = now ? ESCORT_OPS.speed : b.speed; e.patrol = true;
    b.drive = (dt) => {
      const tgt = e.down ? 0 : e.engaged ? 0 : e.s < e.a0 ? ESCORT_OPS.transit : ESCORT_OPS.speed;
      e.v += clamp(tgt - e.v, -1.2 * dt, 0.8 * dt);
      e.s += e.v * dt;
      const L = b.track.len;
      if (e.s > L) e.s = e.a0 + (e.s - L) % Math.max(1, L - e.a0);
      return e.s;
    };
    b.update(0, this.env());
  }
  // at: { x, z, yaw } chỗ đã chiếm (tải lại checkpoint pha 5–6); không có thì đậu ở vòng tuần (đợt một) hoặc chỗ đang đứng
  parkCaptured(e, at = null) {
    const b = e.boat, sta = ESCORT_OPS.stations[e.id];
    if (at || !sta) this.placeBoat(b, at ? at.x : b.x, at ? at.z : b.z, at?.yaw ?? b.yaw);
    else { const loop = patrolLoop(sta); b.ctl = null; b.drive = null; b.setPath([loop[0], loop[1]], 0); b.targetSpeed = 0; b.speed = 0; b.stop(); }
    b.captured = true; b.side = "ta"; b.flag = "陳"; b.label = `${b.hull.name} (đã chiếm)`; b.deck.label = b.label;
    b.update(0, this.env());
  }
  // Thuyền hộ vệ: dừng nghênh chiến khi tướng tới gần / đò nhắm tới; thủy thủ dựng khi tướng trong spawnR, cất khi xa.
  updateEscorts(dt) {
    const h = this.hero, O = ESCORT_OPS;
    this.opsT -= dt;
    const ops = this.opsT <= 0; if (ops) this.opsT = 0.25;
    let want = null;
    for (const id in this.esc) {
      const e = this.esc[id], b = e.boat;
      if (e.down || e.gone || !(e.patrol || e.flee || e.stuck)) continue;
      const d = dist(b, h), onIt = h.deck === b.deck;
      e.engaged = onIt || (e.patrol && d < O.engage) || (e.ferryT > 0 && (e.ferryT -= dt) > 0);
      if (!ops) continue;
      if (e.spawned && d > O.despawnR && !onIt) this.stowEscortCrew(e);
      else if (!e.spawned && (d < O.spawnR || onIt) && (!want || d < want.d)) want = { e, d };
    }
    // dựng thủy thủ thuyền gần nhất trong tầm; đủ maxSpawned thuyền thì cất thuyền xa nhất (không có tướng trên boong) nhường chỗ
    if (want) {
      const on = Object.values(this.esc).filter((q) => q.spawned);
      if (on.length >= O.maxSpawned) {
        const far = on.filter((q) => h.deck !== q.boat.deck).sort((a, b) => dist(b.boat, h) - dist(a.boat, h))[0];
        if (far && dist(far.boat, h) > want.d + 10) this.stowEscortCrew(far);
      }
      if (Object.values(this.esc).filter((q) => q.spawned).length < O.maxSpawned) this.spawnEscortCrew(want.e);
    }
  }
  spawnEscortCrew(e) {
    const b = e.boat;
    b.crew = []; b.officer = null;
    const crew = this.nav.spawnCrew(b, { n: e.crewLeft, officer: e.officerAlive, name: `Trấn thủ thuyền hộ vệ ${e.id}`, role: "garrison", aggro: 18 });
    for (const a of crew) a.escort = e.id;
    e.agents = crew; e.officer = crew.officer; if (e.officer) e.officer.escort = e.id;
    e.spawned = true; b.capturable = true;
  }
  stowEscortCrew(e) {
    const crowd = this.ctx.crowd, b = e.boat;
    e.crewLeft = e.agents.filter((a) => crowd.hittable(a) && a.deck === b.deck).length;
    e.officerAlive = !!e.officer && e.officer.alive && !e.officer.dead;
    for (const a of e.agents) if (a.alive && a.role !== "free" && a.role !== "swim") crowd.release(a);
    if (e.officer?.alive) e.officer.dispose();
    e.agents = []; e.officer = null; b.crew = []; b.officer = null; e.spawned = false; b.capturable = false;
  }
  // naval.on.capture: tướng giữ X 3 s trên boong hộ vệ (trấn thủ đã ngã, ≤ 2 lính địch)
  captureEscort(b) {
    const ctx = this.ctx, e = this.esc[b.id];
    if (!e || e.down) { this.nav.captureShip(b); return; }
    this.nav.captureShip(b);
    e.down = true; e.engaged = false; b.drive = null; b.stop();
    const ev = []; onEscortDown(this.st, "capture", ev); this.handle(ev);
    this.hero.heal(0.15);
    ctx.audio.play("capture");
    this.say(`Chiếm thuyền hộ vệ ${e.id}: cờ 陳 kéo lên, thuyền thành bến đò cho quân ta (+15% Sinh lực).`, 5, "good");
    // vài quân ta lên giữ thuyền
    const g = this.nav.spawnCrew(b, { side: "ta", n: 3, role: "zone", kitMix: ["DV_GIAO", "DV_NO", "DV_DAO"] });
    for (const a of g) a.escort = e.id;
    for (const a of e.agents) if (a.side === "dich" && ctx.crowd.hittable(a)) this.nav.toSwim(a);
  }

  // ---- đoàn thuyền nhẹ -----------------------------------------------------------------------------------------------------
  buildFlotilla(i) {
    const nav = this.nav, sl = FLOTILLA.slots;
    const lost = new Set(), n = LIGHT_BOATS.n - 1, left = this.st.wings.flotilla.boats;
    // thuyền đã mất (mô phỏng: boats còn lại) không dựng lại — bỏ từ thuyền sau cùng
    for (let k = n; k >= 1 && lost.size < Math.max(0, LIGHT_BOATS.n - left); k--) lost.add(k);
    for (let k = 0; k <= n; k++) {
      if (lost.has(k)) continue;
      const [dx, dz] = k === 0 ? [0, 0] : sl[k - 1];
      const b = nav.addBoat({ type: k === 0 ? "lead" : "light", side: "ta", id: "L" + k, flag: "陳", path: lanePath(dz), speed: 0,
        label: k === 0 ? "Thuyền chỉ huy nhẹ" : `Thuyền nhẹ ${k}` });
      b.slot = k; b.ctl = { src: "flot", dx, dz };
      b.drive = () => laneS(b.track, this.slotX(b));
      b.update(0, this.env());
      this.flot.push(b);
      if (k > 0 && i === 0) { const c = nav.spawnCrew(b, { side: "ta", n: FLOTILLA.crew, role: "zone", kitMix: ["DV_NO", "DV_GIAO", "DV_DAO"] }); for (const a of c) a.flot = k; }
    }
    if (i >= 1) this.flotToHold(true);
  }
  // Pha 2+: đoàn thuyền nhẹ rời đường hạm đội, đậu ven hai bờ gần bến (now: đặt thẳng).
  flotToHold(now) {
    const H = FLOTILLA.hold;
    this.flot.forEach((b) => {
      if (b.lost) return;
      const [x, dz] = b.slot === 0 ? H.lead : H.boats[(b.slot - 1) % H.boats.length], z = zc(x) + dz;
      b.ctl = null; b.drive = null;
      // mũi ngược dòng (-x) khi đậu: nhìn về phía hạm đội đang vào khúc cọc
      if (now) { b.setPath([{ x: x + 3, z: zc(x + 3) + dz }, { x, z }], 99); b.targetSpeed = 0; b.speed = 0; b.stop(); }
      else {
        // tránh xuôi dòng ra sát bờ (cùng phía nơi đậu) rồi ngược lên dọc bờ tới chỗ đậu
        const sx = b.x + FLOTILLA.sidestep, sz = zc(sx) + dz, mx = (sx + x) / 2;
        b.setPath([{ x: b.x, z: b.z }, { x: b.x + FLOTILLA.sidestep * 0.6, z: (b.z + sz) / 2 }, { x: sx, z: sz }, { x: mx, z: zc(mx) + dz }, { x, z }], 0);
        b.go(b.slot === 0 ? 5 : 6);
      }
      b.update(0, this.env());
    });
  }
  // Thuyền phục ở ba nhánh sông (4 mỗi nhánh, 60–120 m trong lạch, mũi hướng ra sông cái): đứng im tới pha 5 (D2b xuất kích).
  buildAmbush() {
    let n = 0;
    for (const tr of TRIBS) for (let k = 0; k < 4; k++) {
      const s = 62 + k * 18, p = tribPoint(tr, s, (k % 2 ? 1 : -1) * 3.5), q = tribPoint(tr, s - 6, (k % 2 ? 1 : -1) * 3.5);
      const b = this.nav.addBoat({ type: "light", side: "ta", id: `A_${tr.id}${k}`, flag: "陳", label: `Thuyền phục ${tr.name}` });
      b.x = p.x; b.z = p.z; b.yaw = Math.atan2(q.x - p.x, q.z - p.z); b.speed = 0; b.ambush = tr.id; b.deck.noBoard = true;
      b.hidden = this.phase < 4;                         // bản đồ nhỏ: thuyền phục chỉ hiện từ pha 5 (hud-b20 bỏ b.hidden)
      b.update(0, this.env()); this.ambush.push(b); n++;
    }
    return n;
  }
  // Nguyễn Khoái (H40, AI, cung) trên thuyền ở phao chặn luồng x 840 (pha 2+; vai chặn luồng là Hư cấu).
  spawnKhoai() {
    if (this.khoai) return;
    const G = ALLY_GENERALS.H40, x = G.post.x + 12, z = zc(x) + 6;
    const b = this.nav.addBoat({ type: "light", side: "ta", id: "K1", flag: "陳", label: "Thuyền Nguyễn Khoái", path: [{ x, z: z - 3 }, { x, z }] });
    b.speed = 0; b.targetSpeed = 0; b.stop(); b.update(0, this.env());
    const W = b.deck.toWorld(0, 1, {});
    const u = new BigUnit(this.ctx, { kind: "general", side: "ta", tier: "ally", rigKey: "H40", name: G.name, id: "H40", hp: G.hp, x: W.x, z: W.z, yaw: -DOWN });
    this.ctx.units.push(u); this.nav.board(u, b.deck); this.generals.H40 = u;
    this.khoai = b;
  }

  // ---- P1: mồi nhử, thuyền tiên phong ----------------------------------------------------------------------------------------
  updateLure(dt) {
    if (this.time >= this.vgNext && this.vg.filter((v) => v.state !== "drift").length < VANGUARD.max && this.flot.some((b) => !b.lost)) {
      this.vgNext = this.time + VANGUARD.every; this.spawnVanguard();
    }
    for (const v of [...this.vg]) this.updateVanguard(v, dt);
  }
  pickVgTarget() {
    const hb = this.heroBoat(), busy = new Set(this.vg.filter((v) => v.state !== "drift").map((v) => v.target));
    const ours = this.flot.filter((b) => !b.lost && !busy.has(b));
    if (!this.vgN || !ours.length) return hb && this.flot.includes(hb) && !busy.has(hb) ? hb : ours[0] || null;
    // sau lần đầu: thuyền nhẹ khác (gần hạm đội nhất), không phải thuyền đang chở tướng nếu còn chọn được
    const pool = ours.filter((b) => b !== hb && b.slot !== 0);
    const list = pool.length ? pool : ours;
    return list.reduce((a, b) => (b.x < a.x ? b : a));
  }
  spawnVanguard() {
    const T = this.pickVgTarget(); if (!T) return;
    // áp mạn phía ngoài (xa tâm đoàn), đi tới theo làn kề bên thuyền đích (làn áp mạn dzA) — không xuyên qua thuyền khác
    const n = ++this.vgN, nav = this.nav, dz0 = T.ctl?.dz ?? 0, sg = dz0 > 0 ? -1 : 1;
    const dzA = dz0 - sg * (T.hull.beam / 2 + 1.1 + VANGUARD.gap);
    const x = this.headS + 6, z = zc(x) + dzA;
    const b = nav.addBoat({ type: "scout", side: "dich", id: "V" + n, flag: "元", label: "Thuyền tiên phong" });
    b.x = x; b.z = z; b.yaw = DOWN; b.speed = 0; b.capturable = false; b.update(0, this.env());   // chỉ hộ vệ chiếm được (thuyền tiên phong lui, chìm)
    const off = n % VANGUARD.officerEvery === 0;
    const crew = nav.spawnCrew(b, { n: VANGUARD.crew, officer: off, name: "Đội trưởng tiên phong", role: "garrison", aggro: 20,
      kitMix: ["NG_DAO", "NG_GIAO", "NG_DAO", "NG_CUNG"] });
    const v = { n, boat: b, target: T, sg, state: "chase", t: 0, lossT: 0, crew, officer: crew.officer, link: null, provoked: false };
    for (const a of crew) a.vg = v;
    if (v.officer) v.officer.vg = v;
    this.vg.push(v);
    this.say(`Thuyền tiên phong Nguyên rời đầu hạm đội, đuổi ${T === this.heroBoat() ? "thuyền của tướng" : T.label.toLowerCase()}!`, 4, "bad");
    this.ctx.audio.play("horn", x, z);
  }
  vgCleared(v) {
    const crowd = this.ctx.crowd;
    for (const a of v.crew) if (crowd.hittable(a)) return false;
    const o = v.officer; return !o || !o.alive || o.dead > 0;
  }
  updateVanguard(v, dt) {
    const b = v.boat, T = v.target, nav = this.nav;
    v.t += dt;
    if (v.state === "chase") {
      if (!T || T.lost || T.state === "sunk") { this.vgDrift(v); return; }
      const off = v.sg * (T.hull.beam / 2 + b.hull.beam / 2 + VANGUARD.gap), c = Math.cos(T.yaw), s = Math.sin(T.yaw);
      const px = T.x + off * c, pz = T.z - off * s, dx = px - b.x, dz = pz - b.z, d = Math.hypot(dx, dz);
      const sp = Math.min(VANGUARD.speedMax, (T.speed || 0) + VANGUARD.chase), step = sp * dt;
      if (d <= Math.max(0.6, step)) {
        b.x = px; b.z = pz; b.yaw = T.yaw; b.speed = T.speed;
        v.link = nav.grapple(T, b); v.state = "grappled"; v.t = 0;
        const onHero = this.hero.deck === T.deck;
        for (const a of v.crew) if (this.ctx.crowd.hittable(a)) { a.role = onHero ? "zone" : "squad"; a.anchor = onHero ? null : T.anchor; }
        if (v.officer) v.officer.awake = true;
        this.say(`Thuyền tiên phong áp mạn ${onHero ? "thuyền của tướng" : T.label.toLowerCase()} — lính Nguyên tràn sang!`, 4, "bad");
        this.ctx.audio.play("horn", b.x, b.z);
        return;
      }
      b.x += dx / d * step; b.z += dz / d * step; b.speed = sp;
      const want = d > 10 ? Math.atan2(dx, dz) : T.yaw;
      b.yaw = wrap(b.yaw + wrap(want - b.yaw) * Math.min(1, dt * 2.5));
      return;
    }
    if (v.state === "grappled") {
      // còn lính địch nào trên thuyền bị áp mạn / ván bắc? hết repel s thì thuyền tiên phong cắt ván lui (đẩy lui được)
      const crowd = this.ctx.crowd, P = v.link?.plank, o = v.officer;
      let aboard = 0;
      for (const a of v.crew) if (crowd.hittable(a) && (a.deck === T.deck || a.deck === P)) aboard++;
      if (o && o.alive && !o.dead && (o.deck === T.deck || o.deck === P)) aboard++;
      v.clearT = aboard || v.t < 3 ? 0 : (v.clearT || 0) + dt;
      if (this.vgCleared(v) || v.clearT >= VANGUARD.repel) {
        this.say(this.vgCleared(v) ? "Dọn sạch thuyền tiên phong — nó trôi lại phía hạm đội." : "Đẩy lui thuyền tiên phong: nó cắt ván bắc, lùi về phía hạm đội.", 3, "good");
        this.vgDrift(v); return;
      }
      const heroThere = this.hero.deck === T.deck || this.hero.deck === b.deck || this.hero.deck === P;
      if (T.slot !== 0 && !heroThere && aboard) {
        v.lossT += dt;
        if (v.lossT >= VANGUARD.lose) { this.lossBoat = T; const ev = []; flotillaLoss(this.st, 1, ev); this.handle(ev); this.lossBoat = null; this.vgDrift(v); }
      }
      return;
    }
    // drift: tách ván, trôi chậm lại phía sau, chìm dần (xác không trôi: lính trên boong rơi nước thì bơi vào bờ). Tướng / quân ta
    // còn trên boong (vd đã chiếm, nhảy sang đánh) sang thuyền ta trước khi chìm — không chìm theo thuyền (review B20).
    b.x += 0.8 * dt; b.speed = 0.8;
    if (v.t > 3 && b.state !== "sunk") { nav.evacuate(b); b.sink(); }
    if (v.t > 3 && this.hero.deck === b.deck) nav.evacuate(b);
    if (v.t > 10) {
      for (const a of v.crew) if (a.alive && a.deck === b.deck && a.role !== "free") this.ctx.crowd.release(a);
      if (v.officer?.alive && !v.officer.dead) v.officer.dispose();      // Đội trưởng còn đứng trên thuyền: rời trận theo thuyền (không đứng dưới lòng sông)
      nav.removeBoat(b); this.vg.splice(this.vg.indexOf(v), 1);
    }
  }
  vgDrift(v) {
    if (v.state === "drift") return;
    if (v.link) { this.nav.release(v.link); v.link = null; }
    v.boat.follow = null; v.state = "drift"; v.t = 0; v.boat.deck.noBoard = true;   // thuyền đang lui, chìm: không mời "lên boong"
    const crowd = this.ctx.crowd;
    for (const a of v.crew) if (crowd.hittable(a) && a.deck === v.boat.deck) { a.role = "garrison"; a.anchor = v.boat.anchor; }
  }
  // Mô phỏng báo mất thuyền nhẹ: thuyền vừa bị áp mạn (flotillaLoss) hoặc thuyền sau cùng (sát hạm đội) chìm; người rơi nước bơi.
  onBoatLost(e) {
    let T = this.lossBoat;
    if (!T) { const c = this.flot.filter((b) => !b.lost && b.slot !== 0); T = c.length ? c.reduce((a, b) => (b.x < a.x ? b : a)) : null; }
    this.say(`Mất một thuyền nhẹ (${e.why}): còn ${e.left}/${LIGHT_BOATS.n}.`, 4, "bad");
    this.ctx.audio.play("warn");
    if (!T || T.lost) return;
    T.lost = true;
    for (const v of this.vg) if (v.target === T && v.state !== "drift") this.vgDrift(v);
    for (const [o, D] of [...this.nav.riders]) if (D === T.deck && o.K && this.ctx.crowd.hittable(o)) this.nav.toSwim(o);
    if (this.hero.deck === T.deck) this.placeOn(this.lead().deck, 0, -1.8);
    T.drive = null; T.sink();
    const b = T; this.later(8, () => { if (this.flot.includes(b)) { this.nav.removeBoat(b); this.flot.splice(this.flot.indexOf(b), 1); } });
  }
  later(sec, fn) { (this.timers ||= []).push({ at: this.time + sec, fn }); }

  // ---- P2–P3: thuyền dò luồng --------------------------------------------------------------------------------------------------
  raftOf(id) { return this.nav.rafts.find((r) => r.id === id) || null; }
  spawnScout(target) {
    const R = this.raftOf(target), src = this.ships.PT || this.ships.FS; if (!R || !src) return;
    const n = ++this.scoutN, nav = this.nav, rx = R.deck.m[9], rz = R.deck.m[11];
    const sx = src.x + 10, sz = src.z + (rz > src.z ? 8 : -8), ex = rx + (sx < rx ? -7 : 7);
    const b = nav.addBoat({ type: "scout", side: "dich", id: "S" + n, flag: "元", label: `Thuyền dò luồng → ${target}`,
      path: [{ x: sx, z: sz }, { x: (sx + ex) / 2, z: (sz + rz) / 2 + 6 }, { x: ex, z: rz }], speed: SCOUT_OPS.speed });
    b.capturable = false;
    const crew = nav.spawnCrew(b, { n: SCOUT_OPS.crew, officer: true, name: "Đội trưởng dò luồng", role: "garrison", aggro: 16, kitMix: ["NG_CUNG", "NG_DAO"] });
    const s = { n, target, boat: b, crew, officer: crew.officer, state: "go", t: 0 };
    for (const a of crew) a.scout = s;
    if (s.officer) s.officer.scout = s;
    this.scouts.push(s);
    this.say(`Phàn Tiếp cử thuyền dò luồng tới mốc ${target} — chặn nó trước khi chạm bè cỏ (đò chuyển: giữ Tương tác).`, 6, "bad");
    this.ctx.audio.play("horn", sx, sz);
  }
  updateScouts(dt) {
    const st = this.st;
    for (const s of [...this.scouts]) {
      const b = s.boat, o = s.officer, R = this.raftOf(s.target);
      s.t += dt;
      const alive = o && o.alive && !o.dead;
      if (s.state === "go") {
        if (s.ferryT > 0) { s.ferryT -= dt; b.stop(); } else if (b.state === "hold" && !b.arrived) b.go(SCOUT_OPS.speed);
        if (!alive) {
          s.state = "stopped"; b.stop(); this.scoutsStopped++;
          this.say(`Chặn được thuyền dò luồng tới mốc ${s.target}.`, 4, "good"); this.ctx.audio.play("cheer"); continue;
        }
        if (st.markers[s.target]?.state !== "hidden") { s.state = "back"; this.scoutHome(s); continue; }
        if (R && Math.hypot(b.x - R.deck.m[9], b.z - R.deck.m[11]) <= SCOUT_OPS.exposeR) {
          const ev = []; markerAction(st, s.target, "expose", ev); this.handle(ev);
          s.state = "back"; this.scoutHome(s);
        }
      } else if (s.state === "back" && (s.t > 40 || b.arrived)) this.removeScout(s);
      else if (s.state === "stopped" && s.t > 60 && dist(b, this.hero) > 60) this.removeScout(s);
    }
  }
  scoutHome(s) {
    const b = s.boat, src = this.ships.PT || this.ships.FS; s.t = 0;
    b.setPath([{ x: b.x, z: b.z }, { x: src.x - 12, z: src.z }], 0); b.go(SCOUT_OPS.speed);
  }
  removeScout(s) {
    const crowd = this.ctx.crowd;
    for (const a of s.crew) if (a.alive && a.role !== "free" && a.role !== "swim") crowd.release(a);
    if (s.officer?.alive) s.officer.dispose();
    this.nav.removeBoat(s.boat); this.scouts.splice(this.scouts.indexOf(s), 1);
  }
  onMarkerExposed(e) {
    this.ctx.world.scenery?.stakes?.setState(e.id, "exposed");
    this.banner(`MỐC ${e.id} BỊ LỘ`, "#ff8a6a", 1.6); this.ctx.audio.play("horn");
    this.say(`Mốc ${e.id} bị lộ (${e.by === "scout" ? "thuyền dò chạm bè cỏ" : "tướng địch đứng mốc quá 10 s"}): hạm đội sẽ né bãi này.`, 6, "bad");
  }

  // ---- P3: đội dò luồng lên bè, mở mốc ----------------------------------------------------------------------------------------
  // Ba toán tới ba mốc còn ẩn, theo thứ tự gần khối hạm đội nhất (tâm khối = kỳ hạm), tới nơi ở phaseStart + arrive[k].
  planSquads() {
    const st = this.st, cx = this.ships.FS?.x ?? 656;
    const ids = STAKES.filter((s) => st.markers[s.id].state === "hidden").sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx) || (a.x - b.x)).map((s) => s.id);
    this.squads = ids.slice(0, SQUADS.arrive.length).map((id, k) => ({ id, k, at: this.phaseStart + SQUADS.arrive[k], state: "wait", raft: null, crew: [], officer: null }));
  }
  updateSquads(dt) {
    const nav = this.nav, crowd = this.ctx.crowd, st = this.st;
    for (const q of this.squads) {
      const R = this.raftOf(q.id); if (!R) continue;
      if (q.state === "wait" && this.time >= q.at - SQUADS.lead) {
        if (st.markers[q.id].state !== "hidden") { q.state = "skip"; continue; }
        const rx = R.deck.m[9], rz = R.deck.m[11], dx = SQUADS.speed * SQUADS.lead, sx = rx + (q.k % 2 ? dx : -dx), ex = rx + (q.k % 2 ? 7.5 : -7.5);
        const b = nav.addBoat({ type: "scout", side: "dich", id: "Q" + q.id, flag: "元", label: `Đội dò luồng → ${q.id}`,
          path: [{ x: sx, z: rz + 3 }, { x: ex, z: rz }], speed: SQUADS.speed });
        b.capturable = false;
        const crew = nav.spawnCrew(b, { n: SQUADS.crew, officer: true, name: "Đội trưởng dò luồng", role: "garrison", aggro: 14, kitMix: ["NG_DAO", "NG_GIAO", "NG_CUNG"] });
        q.boat = b; q.crew = crew; q.officer = crew.officer; q.state = "go";
        for (const a of crew) a.squad = q;
        if (q.officer) q.officer.squad = q;
        this.say(`Đội dò luồng Nguyên chèo tới bè cỏ ${q.id}: không để Đội trưởng đứng mốc quá 10 s!`, 5, "bad");
      } else if (q.state === "go" && (q.boat.arrived || Math.hypot(q.boat.x - R.deck.m[9], q.boat.z - R.deck.m[11]) < 8.5)) {
        // lên bè: Đội trưởng leo lên giữa bè, lính đứng rải trên bè
        q.boat.stop(); q.state = "on"; q.raft = R.deck;
        const spots = nav.deckSpots(R.deck, q.crew.length, makeRng(17 + q.k));
        q.crew.forEach((a, i) => {
          if (!crowd.hittable(a)) return;
          const s = spots[i]; R.deck.toWorld(s.x, s.z, _W, s.i); nav.leave(a); a.x = _W.x; a.z = _W.z; nav.board(a, R.deck);
          a.anchor = { x: R.deck.m[9], z: R.deck.m[11], r: 3 }; a.sx = a.x; a.sz = a.z; a._pins = null;
        });
        if (q.officer?.alive && !q.officer.dead) nav.climbTo(q.officer, R.deck, { x: 0, z: 0 });
        // thuyền toán dò lùi ra khỏi bè (không chắn Tương tác "Mở bãi cọc" bằng "lên boong"), rồi rời trận
        const b = q.boat, back = q.k % 2 ? 1 : -1; b.deck.noBoard = true; q.leaveT = this.time;
        b.setPath([{ x: b.x, z: b.z }, { x: b.x + back * 14, z: b.z + 10 }, { x: b.x + back * 40, z: b.z + 18 }], 0); b.go(3);
      } else if (q.state === "on" && st.markers[q.id].state !== "hidden") q.state = "done";
      if (q.boat && q.leaveT !== undefined && this.time - q.leaveT > 25 && q.boat.visible) {
        for (const a of q.crew) if (a.alive && a.deck === q.boat.deck && a.role !== "free") crowd.release(a);
        nav.removeBoat(q.boat); q.boat.visible = false;
      }
    }
  }
  // naval.on.marker: giữ X 5 s trên bè cỏ (pha 3, mốc ẩn, không địch trong 6 m)
  openMarker(id) {
    const ctx = this.ctx, ev = [], r = markerAction(this.st, id, "activate", ev);
    if (!r.ok) { this.say(`Chưa mở được mốc ${id} (${r.why}).`, 3, "bad"); return; }
    ctx.world.scenery?.stakes?.setState(id, "active");
    this.banner(`MỞ BÃI CỌC ${id}`, "#f1d98a", 1.6); ctx.audio.play("capture");
    this.say(`${lbl("Hư cấu")}Chặt dây bè cỏ ${id}: bè trôi đi, bãi cọc vẫn chìm dưới nước triều. Gọi đò rời bè!`, 6, "good");
    this.handle(ev);
    this.openFerry("auto");
  }
  // Lệnh Kế Sách (G)
  keSachTrigger() {
    const st = this.st, k = st.ks.kichCoc;
    if (k?.state === "sansang") { const ev = []; const r = keSachTrigger(st, "kichCoc", ev); this.handle(ev); return r.ok; }
    const ready = KS_ORDER.find((id) => st.ks[id]?.state === "sansang");
    if (ready === "nghiBinh") this.say("Nghi binh tự chốt khi đoàn thuyền nhẹ đã qua Khúc cọc và giữ đúng khoảng cách.", 3);
    else this.say(this.phase === 2 ? `Kế Sách bãi cọc chưa Sẵn sàng: mở ít nhất ${KE_SACH.kichCoc.need} mốc.` : "Chưa có Kế Sách Sẵn sàng.", 2.5);
    return false;
  }

  // ---- P4: nước rút — hộ vệ đợt hai chạy ra cửa sông, Phàn Tiếp gom thuyền, cọc nhô ---------------------------------------------
  // Vùng né của làn thoát (theo trạng thái lúc gọi): bãi cọc đã lộ (cả hai phía — hạm đội né mốc lộ), cụm thuyền Phàn Tiếp (phía +).
  fleeZones() {
    const Z = [], O = EBB_OPS, pt = this.ships.PT;
    for (const s of STAKES) if (this.st.markers[s.id].state === "exposed") Z.push([s.x - s.along / 2 - O.avoid, s.x + s.along / 2 + O.avoid, 0]);
    if (pt) Z.push([pt.x - pt.hull.len / 2 - O.avoid, pt.x + pt.hull.len / 2 + O.avoid, 1]);
    return Z;
  }
  // Thuyền hộ vệ mới (đợt hai) — đăng ký như E1…E6 (esc, ships)
  addEscort(id, wave) {
    const b = this.nav.addBoat({ type: "escort", side: "dich", id, flag: "元", label: `Thuyền hộ vệ ${id}` });
    b.capturable = false; this.ships[id] = b;
    return (this.esc[id] = { id, boat: b, wave, down: false, gone: false, stuck: false, flee: false, patrol: false, crewLeft: ESCORT_OPS.crew,
      officerAlive: true, spawned: false, agents: [], officer: null, v: 0, s: 0, engaged: false, side: 1, dep: 0 });
  }
  // Chạy ra cửa sông theo làn thoát từ (x, z); đứng chờ tới giờ dep; dừng khi tướng đứng trên boong / đò ta nhắm tới / mắc cọc.
  setFlee(e, { x, z, side, dep, zones = null, out = false }) {
    const b = e.boat, O = EBB_OPS;
    b.ctl = null; b.drive = null; b.setPath(fleePath(x, z, side, zones || this.fleeZones(), out), 0);
    Object.assign(e, { flee: true, patrol: false, stuck: false, side, dep, s: 0, v: 0, out, p4: true });
    b.drive = (dt) => {
      const tgt = e.down || e.stuck || e.engaged || this.time < e.dep ? 0 : O.speed;
      e.v += clamp(tgt - e.v, -1.5 * dt, 0.6 * dt);
      e.s = Math.min(b.track.len, e.s + e.v * dt);
      return e.s;
    };
    b.update(0, this.env());
  }
  // đặt thuyền đứng yên ở (x, z) hướng yaw (tải lại checkpoint)
  placeBoat(b, x, z, yaw) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    b.ctl = null; b.drive = null; b.setPath([{ x: x - fx * 2, z: z - fz * 2 }, { x, z }], 99); b.targetSpeed = 0; b.speed = 0; b.stop();
    b.update(0, this.env());
  }
  // Đầu pha 4: 8 hộ vệ đợt hai ở chỗ xuất phát, rời đi lần lượt; hộ vệ đợt một còn sót bỏ vòng tuần chạy theo làn ngoài; cụm Phàn Tiếp.
  startEbb() {
    const O = EBB_OPS, zones = this.fleeZones();
    O.starts.forEach(([x, side], k) => {
      const e = this.addEscort("E" + (FLEET.escorts[0] + 1 + k), 2);
      this.setFlee(e, { x, z: zc(x) + fleeDz(x, side, fleeZonesFor(x, side, zones)), side, dep: this.phaseStart + O.first + O.every * k, zones });
    });
    for (const id in this.esc) {
      const e = this.esc[id], b = e.boat;
      if (e.wave !== 2 && !e.down && !e.gone) this.setFlee(e, { x: b.x, z: b.z, side: Math.sign(b.z - zc(b.x)) || 1, dep: this.time + 2, out: true });
    }
    this.startCluster();
  }
  // Tải lại checkpoint pha 4–6: pha 4 dựng lại từ đầu (tất định); pha 5–6 theo ảnh chụp (chỗ đứng, đã hạ / thoát / mắc).
  buildEbb(i, snap) {
    if (i === 3) { this.startEbb(); return; }         // hộ vệ đợt một còn sót đã về vòng tuần (buildFleet) — chạy từ đó
    this.placeCluster();
    for (const id in snap?.esc || {}) {
      const s = snap.esc[id]; if (s.x === undefined) continue;
      const e = this.esc[id] || this.addEscort(id, s.wave || 2), b = e.boat;
      e.patrol = false; e.p4 = !!s.p4;
      if (s.gone) { this.nav.removeBoat(b); delete this.ships[id]; Object.assign(e, { gone: true, flee: false, stuck: false }); continue; }
      if (s.down) { e.down = true; this.parkCaptured(e, s); continue; }
      if (s.stuck) { this.placeBoat(b, s.x, s.z, s.yaw); Object.assign(e, { stuck: true, flee: false, side: s.side || 1 }); continue; }
      this.setFlee(e, { x: s.x, z: s.z, side: s.side || 1, dep: this.time, out: !!s.out });
    }
  }
  updateEbb(dt) {
    const O = EBB_OPS;
    for (const id in this.esc) {
      const e = this.esc[id]; if (!e.flee || e.down || e.gone) continue;
      if (e.boat.x >= MAP.exitX - O.exitR || e.s >= e.boat.track.len - 0.5) this.escortEscaped(e);
    }
    if (this.phase === 3) { this.updateCluster(dt); this.ambushHold(); }
  }
  escortEscaped(e) {
    if (e.spawned) this.stowEscortCrew(e);
    e.gone = true; e.flee = false; this.escaped++;
    this.nav.removeBoat(e.boat); delete this.ships[e.id];
    this.say(`Thuyền hộ vệ ${e.id} thoát ra cửa sông (${this.escaped} thuyền đã thoát).`, 4, "bad"); this.ctx.audio.play("horn");
  }
  // Giữ vững cho cánh thuyền phục (pha 4): 4 thuyền của nhánh ấy chèo ra cửa lạch, chắn ngang (mô phỏng: Thoát vây ×0,7).
  ambushHold() {
    for (const id of ["chanh", "rut", "gia"]) {
      if (this.st.wings[id]?.order?.id !== "giuvung") continue;
      const tr = TRIBS.find((q) => q.id === id), boats = this.ambush.filter((b) => b.ambush === id && !b.guarding);
      boats.forEach((b) => {
        const k = this.ambush.filter((q) => q.ambush === id).indexOf(b), p = tribPoint(tr, 6 + k * 2, (k - 1.5) * 6.5), q = tribPoint(tr, 34, 0);
        b.guarding = true; b.hidden = false; b.setPath([{ x: b.x, z: b.z }, q, p], 0); b.go(4);
      });
    }
  }
  // Phàn Tiếp gom thuyền (canon Liên Hoàn Thuyền): J8 dạt ngang sát mạn thuyền chỉ huy, J12 tiến lên thế chỗ J8 (theo làn).
  startCluster() {
    const pt = this.ships.PT, [n1, n2] = CLUSTER.ids.map((id) => this.ships[id]); if (!pt || !n1 || !n2) return;
    const to = clusterSlot({ x: pt.x, z: pt.z, yaw: pt.yaw, beam: pt.hull.beam }, { x: n1.x, z: n1.z, beam: n1.hull.beam });
    this.cl = { t: 0, from: { x: n1.x, z: n1.z, yaw: n1.yaw }, to, dx0: n2.ctl.dx, dx1: pt.ctl.dx, done: false };
    n1.ctl = null; n1.drive = null; n1.track = null;
    this.say(`${lbl("Hư cấu")}Phàn Tiếp cho hai chiến thuyền áp sát mạn thuyền chỉ huy — sẵn xích Liên Hoàn Thuyền.`, 5, "bad");
  }
  updateCluster(dt) {
    const c = this.cl; if (!c || c.done) return;
    const n1 = this.ships[CLUSTER.ids[0]], n2 = this.ships[CLUSTER.ids[1]];
    c.t += dt;
    if (n1.state === "sail" || n1.state === "hold") {
      const k = smooth01(c.t / CLUSTER.slideSec), x0 = n1.x, z0 = n1.z;
      n1.x = lerp(c.from.x, c.to.x, k); n1.z = lerp(c.from.z, c.to.z, k); n1.yaw = wrap(c.from.yaw + wrap(c.to.yaw - c.from.yaw) * k);
      n1.speed = dt > 0 ? Math.hypot(n1.x - x0, n1.z - z0) / dt : 0;
    }
    if (n2.ctl) n2.ctl.dx = lerp(c.dx0, c.dx1, smooth01((c.t - CLUSTER.sailDelay) / CLUSTER.sailSec));
    if (c.t >= Math.max(CLUSTER.slideSec, CLUSTER.sailDelay + CLUSTER.sailSec)) { c.done = true; n1.speed = 0; }
  }
  // chỗ cuối của cụm (tải lại checkpoint pha 5–6)
  placeCluster() {
    const pt = this.ships.PT, [n1, n2] = CLUSTER.ids.map((id) => this.ships[id]); if (!pt || !n1 || !n2) return;
    const to = clusterSlot({ x: pt.x, z: pt.z, yaw: pt.yaw, beam: pt.hull.beam }, { x: n1.x, z: n1.z, beam: n1.hull.beam });
    n1.ctl = null; n1.drive = null; n1.track = null; n1.x = to.x; n1.z = to.z; n1.yaw = to.yaw; n1.speed = 0; n1.update(0, this.env());
    if (n2.ctl) { n2.ctl.dx = pt.ctl.dx; n2.update(0, this.env()); }
    this.cl = { done: true };
  }
  // strandAt (30%): thuyền có tâm trong bãi cọc đã mở thì mắc cọc (dừng, chưa nghiêng) — cả hộ vệ đang chạy qua bãi.
  onStrandAt() {
    const st = this.st, inActive = (b) => STAKES.some((s) => st.markers[s.id].state === "active" && Math.abs(b.x - s.x) <= s.along / 2 && Math.abs(b.z - zc(b.x)) <= s.across / 2);
    let n = 0, ne = 0;
    for (const id in this.ships) {
      const b = this.ships[id], e = this.esc[id];
      if ((e && (e.down || e.gone)) || !inActive(b)) continue;
      if (e) { e.stuck = true; e.flee = false; ne++; } else b.drive = null;
      b.catch(); n++;
    }
    if (!activeMarkers(st)) {                // không mốc nào mở: cọc vẫn ngụy trang dưới bè, không thuyền nào mắc
      this.banner("NƯỚC 30% · CỌC CHƯA MỞ", "#ff8a6a", 1.6);
      this.say("Nước xuống 30% nhưng chưa mở mốc cọc nào: hạm đội Nguyên không vướng cọc.", 6, "bad");
      return;
    }
    this.banner("CỌC NHÔ · THUYỀN NGUYÊN MẮC CỌC", "#f1d98a", 1.6);
    this.say(`Nước xuống 30%: cọc nhô khỏi mặt nước — ${n} thuyền Nguyên mắc cọc${ne ? ` (${ne} thuyền hộ vệ đang chạy)` : ""}.`, 6, "good");
    this.ctx.audio.play("drums3");
  }

  // ---- P5: nước ròng — mắc cạn, thuyền phục xuất kích, Phàn Tiếp ------------------------------------------------------------------
  // Nước ròng (vào pha 5): hộ vệ còn đang chạy ra cửa sông dừng hẳn (nằm cạn nếu chỗ cạn, không thì đứng giữa dòng — mất nước, mất
  // lối). Trước đây vẫn chạy tiếp và thoát trong lúc tướng bị giữ ở trận boss, làm hỏng nhiệm vụ phụ "Không để thuyền nào ra cửa sông".
  stopFleeing() {
    for (const id in this.esc) {
      const e = this.esc[id]; if (!e.flee || e.down || e.gone) continue;
      Object.assign(e, { flee: false, stuck: true }); e.boat.drive = null; e.boat.stop(); e.boat.catch();
    }
  }
  // Mắc cạn theo strandShare (1 → mọi thuyền trong bãi cọc; 0,5 → một nửa xác định, luôn có cụm Phàn Tiếp). Kỳ hạm chỉ "mắc" (đứng trên
  // bùn, chưa nghiêng, chưa lên được) tới cảnh kỳ hạm mắc cạn. Hộ vệ chưa hạ còn trong bãi cạn nằm lại, đã ra lòng sông sâu thì chạy tiếp.
  strandFleet(now) {
    const env = this.env(), gy = this.ctx.world.groundY, y0 = TIDE_Y(0), settle = (b) => { if (now) b.update(BOAT.settle + 0.01, env); };
    const shoal = (b) => y0 - gy(b.x, b.z) < b.hull.draft + 0.25;
    const inField = (b) => STAKES.some((s) => Math.abs(b.x - s.x) <= s.along / 2 + 8 && Math.abs(b.z - zc(b.x)) <= s.across / 2 + 8);
    for (const id in this.esc) {
      const e = this.esc[id], b = e.boat;
      if (e.down || e.gone || !(e.patrol || e.flee || e.stuck) || !shoal(b)) continue;
      Object.assign(e, { stuck: true, flee: false, patrol: false }); b.drive = null; b.strand(); settle(b);
    }
    // cụm Liên Hoàn: cùng độ nghiêng, mạn thấp quay về phía kỳ hạm (−dz: roll < 0 hạ mạn +x cục bộ); J8, J12 không bắc ván dốc (ván
    // xích nối từ thuyền chỉ huy)
    const pt = this.ships.PT, keep = ["PT", ...CLUSTER.ids].filter((id) => this.ships[id]);
    if (pt) { pt.tiltRoll = -Math.abs(pt.tiltRoll); for (const id of CLUSTER.ids) { const b = this.ships[id]; if (b) { b.tiltPitch = pt.tiltPitch; b.tiltRoll = pt.tiltRoll; b.rampOk = false; } } }
    const ids = Object.keys(this.ships).filter((id) => id !== "FS" && !this.esc[id] && (inField(this.ships[id]) || this.ships[id].state === "caught" || keep.includes(id)));
    const pick = strandSelect(ids, this.strandPart(), keep);
    for (const id of pick) { const b = this.ships[id]; b.drive = null; b.strand(); settle(b); }
    // thuyền trong bãi đã mở mà không nằm cạn (strandShare 0,5) vẫn mắc cọc, đứng yên (cả khi tải lại checkpoint)
    const st = this.st, inActive = (b) => STAKES.some((s) => st.markers[s.id].state === "active" && Math.abs(b.x - s.x) <= s.along / 2 && Math.abs(b.z - zc(b.x)) <= s.across / 2);
    for (const id of ids) { const b = this.ships[id]; if (!pick.includes(id) && inActive(b)) { b.drive = null; b.catch(); } }
    const fs = this.ships.FS;
    if (fs && fs.state !== "stranded" && fs.state !== "settle") { fs.drive = null; fs.catch(); fs.rampOk = false; fs.deck.noBoard = true; fs.update(0, env); }
    this.stranded = pick;
    if (!now) this.say(`Nước ròng: ${pick.length} thuyền Nguyên mắc cạn, nghiêng trên bãi bùn${strandShare(this.st) < 1 ? " (chỉ một nửa — mất điểm Kế Sách)" : ""}.`, 6, "good");
  }
  // Phần hạm đội nằm cạn trong số thuyền ở bãi cọc: strandShare (1 / 0,5 theo Kích hoạt bãi cọc + Con nước) × phần hạm đội đã vào khúc
  // cọc so với khi Nghi binh thành công (reachShare 0,8 / 0,5 — canon "≥ 70% hạm đội vào khúc cọc"; ĐỀ XUẤT BẢN THỬ cách nhân).
  strandPart() {
    const r = this.st.fleet.reachShare ?? KE_SACH.nghiBinh.effect.reachShare, full = KE_SACH.nghiBinh.effect.reachShare;
    return strandShare(this.st) * Math.min(1, r / full);
  }
  // Kích hoạt bãi cọc thành công: thủy binh Nguyên trên thuyền mắc cạn trong bãi đã mở đánh ×navalC (canon c ×0,3).
  crewWeak(b, agents) {
    if (this.st.ks.kichCoc?.state !== "thanhcong") return;
    const st = this.st, inActive = STAKES.some((s) => st.markers[s.id].state === "active" && Math.abs(b.x - s.x) <= s.along / 2 + 8 && Math.abs(b.z - zc(b.x)) <= s.across / 2 + 8);
    if (!inActive) return;
    const k = KE_SACH.kichCoc.effect.navalC;
    for (const a of agents) if (a.side === "dich") a.cong *= k;
  }
  // Kỳ hạm nằm cạn hẳn (ván dốc tự bắc — naval.update): now = đặt thẳng (tải lại checkpoint pha 6)
  // kỳ hạm nằm nghiêng đúng canon 12° (tổng chúi mũi + nghiêng mạn: cos T = cos p · cos r — như boats.js)
  fsTilt(b) { b.tiltRoll = (b.tiltRoll < 0 ? -1 : 1) * Math.acos(clamp(Math.cos(BOSS_OPS.fsTilt) / Math.cos(b.tiltPitch), -1, 1)); }
  strandFlagship(now) {
    const b = this.ships.FS; if (!b) return;
    b.rampOk = true; b.deck.noBoard = false;
    if (b.state !== "stranded" && b.state !== "settle") { b.drive = null; this.fsTilt(b); b.strand(); }
    if (now && b.state === "settle") b.update(BOAT.settle + 0.01, this.env());
    if (!this.stranded.includes("FS")) this.stranded.push("FS");
  }
  // Cảnh kỳ hạm mắc cạn (sau khi bắt Phàn Tiếp): lún, nghiêng 4 s, rung màn, băng chữ → pha 6.
  groundFlagship() {
    const ctx = this.ctx, b = this.ships.FS; if (!b || this.phase !== 4) return;
    b.drive = null; this.fsTilt(b); b.strand();
    this.banner("KỲ HẠM MẮC CẠN", "#f1d98a", 2.2); ctx.fx.shake(0.6); ctx.audio.play("horn"); ctx.audio.play("drums3");
    this.say(`${lbl("Hư cấu")}Nước ròng, kỳ hạm Ô Mã Nhi mắc cạn giữa bãi cọc.`, 6, "good");
    const cam = ctx.cam, h = this.hero; if (cam) { cam.yaw = Math.atan2(b.x - h.x, b.z - h.z); cam.idle = 0; cam.pitch = Math.max(cam.pitch, 0.42); }
    // cảnh: máy quay đứng ngang mạn kỳ hạm 35 m, cao 14 m, phía tướng đang đứng — thấy thân thuyền lún, nghiêng (review B20)
    // bên nào ít thân thuyền khác chắn (gần chỗ đặt máy quay, gần giữa đường nhìn) thì đứng bên ấy; bằng nhau: phía tướng
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw), sh = (h.x - b.x) * c - (h.z - b.z) * s >= 0 ? 1 : -1;
    const busy = (k) => { const px = b.x + k * 38 * c + 6 * s, pz = b.z - k * 38 * s + 6 * c; let n = 0;
      for (const q of this.nav.boats) if (q !== b && q.visible && (Math.hypot(q.x - px, q.z - pz) < 20 || Math.hypot(q.x - (px + b.x) / 2, q.z - (pz + b.z) / 2) < 14)) n++;
      return n; };
    const sd = busy(-sh) < busy(sh) ? -sh : sh;
    // (cao 20 m, cách 38 m: nhìn qua mạn thuyền chỉ huy Phàn Tiếp đang nằm cạnh)
    this.cine = { kind: "flagship", t: 0, T: BOSS_OPS.fsSettle, p0: null,
      pos: () => ({ x: b.x + sd * 38 * c + 6 * s, y: b.y + 20, z: b.z - sd * 38 * s + 6 * c }), look: () => ({ x: b.x, y: b.y + 2.5, z: b.z }) };
    for (const t of [1.1, 2.3, 3.5]) this.later(t, () => ctx.fx.shake(0.3 + t * 0.12));
    this.later(BOSS_OPS.fsSettle + 0.3, () => { if (this.phase === 4) this.goPhase(5); });
  }
  // Thủy thủ Nguyên trên thuyền mắc cạn (trừ thuyền chỉ huy, kỳ hạm, hộ vệ): dựng khi tướng tới gần, cất khi xa (giữ số còn sống).
  updateHulls(dt) {
    this.hullT -= dt; if (this.hullT > 0) return; this.hullT = 0.25;
    const h = this.hero, O = HULL_CREW, crowd = this.ctx.crowd;
    let want = null, on = 0;
    for (const id of this.stranded) {
      if (id === "FS" || id === "PT" || this.esc[id] || !this.ships[id]) continue;
      const q = this.hulls[id] || (this.hulls[id] = { id, boat: this.ships[id], left: O.n, spawned: false, agents: [], force: false });
      const d = dist(q.boat, h), onIt = h.deck === q.boat.deck;
      if (q.spawned) {
        on++;
        if (d > O.despawnR && !onIt && !q.force) {
          q.left = q.agents.filter((a) => crowd.hittable(a) && a.deck === q.boat.deck).length;
          for (const a of q.agents) if (a.alive && a.role !== "free" && a.role !== "swim") crowd.release(a);
          q.agents = []; q.spawned = false; on--;
        }
      } else if (q.left > 0 && (d < O.spawnR || onIt || q.force) && (!want || q.force || d < want.d)) want = { q, d };
    }
    if (want && (on < O.maxSpawned || want.q.force)) {
      const q = want.q; q.agents = this.nav.spawnCrew(q.boat, { n: q.left, role: "garrison", aggro: 16 }); q.spawned = true; this.crewWeak(q.boat, q.agents);
    }
  }
  // Thuyền phục xuất kích (pha 5): mỗi thuyền chở SORTIE.crew quân ta, chèo từ lạch ra, cập mạn thấp một thuyền mắc cạn (sông Rút:
  // hai thuyền đầu vào thuyền chỉ huy Phàn Tiếp; còn lại: thuyền mắc cạn gần cửa lạch nhất, hai thuyền phục mỗi thân), quân ta lên
  // boong. fs: pha 6 (tải lại) — SORTIE.fsBoats thuyền đầu cập kỳ hạm.
  startSortie({ fs = false } = {}) {
    const nav = this.nav, cand = this.stranded.filter((id) => id !== "FS" && id !== "PT" && !CLUSTER.ids.includes(id) && !this.esc[id] && this.ships[id]);
    this.sorties = [];
    let nfs = fs ? SORTIE.fsBoats : 0;
    for (const tr of TRIBS) {
      const mouth = tribPoint(tr, 0), list = cand.map((id) => this.ships[id]).sort((a, b) => dist(a, mouth) - dist(b, mouth));
      if (tr.id === "rut" && this.ships.PT) list.unshift(this.ships.PT);
      this.ambush.filter((b) => b.ambush === tr.id).forEach((b, k) => {
        let T = list[k >> 1] || list[0];
        if (nfs > 0 && tr.id === "rut" && this.ships.FS) { T = this.ships.FS; nfs--; }
        if (!T) return;
        const crew = nav.spawnCrew(b, { side: "ta", n: SORTIE.crew, role: "zone", kitMix: ["DV_GIAO", "DV_DAO", "DV_GIAO", "DV_NO"] });
        for (const a of crew) a.stun = 1e9;            // ngồi thuyền tới nơi mới đánh
        const S = { boat: b, target: T, crew, k, done: false, at: this.time + (this.sorties.length % 4) * SORTIE.stagger };
        this.sortieRoute(S, tr);
        this.sorties.push(S);
      });
    }
  }
  // Đường chèo: vị trí hiện tại → trong lạch → cửa lạch → ngoài mạn thấp của thuyền đích → cập song song (mũi hay đuôi tuỳ k).
  sortieRoute(S, tr = null) {
    const b = S.boat, T = S.target, c = Math.cos(T.yaw), s = Math.sin(T.yaw), sg = T.tiltRoll > 0 ? -1 : 1;
    const lz = (S.k % 2 ? 1 : -1) * (T.type === "flagship" ? 10 : 8) + (T.type === "flagship" ? 3 : 0), lx = sg * (T.hull.beam / 2 + HULLS.light.beam / 2 + 1.3);
    const W = (x, zz) => ({ x: T.x + x * c + zz * s, z: T.z - x * s + zz * c });
    const land = W(lx, lz), appr = W(lx + sg * 2, lz + Math.sign(lz) * 13), pre = W(lx + sg * 12, lz + Math.sign(lz) * 18);
    const P = [{ x: b.x, z: b.z }];
    if (tr) { if (!b.guarding) P.push(tribPoint(tr, 30)); P.push(tribPoint(tr, 0)); }
    P.push(pre, appr, land);
    S.land = land; S.done = false;
    b.setPath(P, 0); b.speed = 0; b.targetSpeed = 0; b.stop(); b.update(0, this.env());
  }
  updateSortie() {
    const nav = this.nav, crowd = this.ctx.crowd;
    for (const S of this.sorties) {
      const b = S.boat;
      if (S.done) continue;
      if (b.state === "hold" && !b.arrived && this.time >= S.at) b.go(SORTIE.speed);
      if (!b.arrived && dist(b, S.land) > 1.5) continue;
      S.done = true; b.stop();
      // quân ta lên boong thuyền đích (quanh mạn cập, trên mặt boong phẳng)
      // (kỳ hạm: chỉ boong dưới — mặt lầu chỉ huy là của Ô Mã Nhi)
      const D = S.target.deck, n = S.crew.length, all = nav.deckSpots(D, n * 3, makeRng(31 + S.k * 7 + this.sorties.indexOf(S)));
      const low = all.filter((q) => D.rects[q.i].y < 4.5), spots = (low.length >= n ? low : all).slice(0, n);
      S.crew.forEach((a, i) => {
        if (!crowd.hittable(a)) return;
        const p = spots[i]; D.toWorld(p.x, p.z, _W, p.i); nav.leave(a);
        a.x = _W.x; a.z = _W.z; a.sx = a.x; a.sz = a.z; a._pins = null; a.stun = 0.3 + i * 0.25; nav.board(a, D);
      });
      if (S.target === this.ships.PT && this.phase === 4 && !this.ptLanded) {          // một lần, tên nhánh sông của chính thuyền phục
        this.ptLanded = true; const tr = TRIBS.find((q) => q.id === b.ambush);
        this.say(`Thuyền phục ${tr ? tr.name.toLowerCase() : "nhánh sông"} cập mạn thuyền chỉ huy Phàn Tiếp — quân ta tràn lên boong!`, 4, "good");
      }
    }
  }
  // Pha 6 (đang chơi): hai thuyền phục đã cập bến gần kỳ hạm nhất chèo sang kỳ hạm, chở thêm quân ta lên boong dưới.
  sortieToFS() {
    const fs = this.ships.FS; if (!fs) return;
    const pick = this.sorties.filter((S) => S.done && S.target !== fs).sort((a, b) => dist(a.boat, fs) - dist(b.boat, fs)).slice(0, SORTIE.fsBoats);
    pick.forEach((S, k) => {
      S.target = fs; S.k = k; S.at = this.time + k * SORTIE.stagger;
      S.crew = this.nav.spawnCrew(S.boat, { side: "ta", n: SORTIE.crew, role: "zone", kitMix: ["DV_GIAO", "DV_DAO", "DV_GIAO", "DV_NO"] });
      for (const a of S.crew) a.stun = 1e9;
      this.sortieRoute(S);
    });
  }

  // ---- boss: Phàn Tiếp (P5), Ô Mã Nhi (P6) -----------------------------------------------------------------------------------------
  // (Phàn Tiếp không có Tuyệt Kỹ — canon không cho; Ô Mã Nhi một lần, dưới 50% Sinh lực tức là ở lầu chỉ huy: T.ultMax 1)
  spawnX24() {
    const b = this.ships.PT; if (!b || this.bosses.X24) return null;
    const ctx = this.ctx, B = BOSSES.X24, O = BOSS_OPS.X24, D = b.deck, W = D.toWorld(0, 3, {});
    const u = new BigUnit(ctx, { kind: "boss", side: "dich", tier: B.tier, rigKey: "X24", name: B.name, id: "X24", x: W.x, z: W.z, yaw: wrap(D.yaw + Math.PI),
      T: { poise: B.poise * (O.poiseMult ?? 1), ult: null }, defeatMeans: B.defeatMeans, hpLockPct: O.lockPct, captureAtPct: O.lockPct, leash: O.leash, awake: false, aggro: O.awakeR,
      stay: (h) => this.onCluster(h) });
    ctx.units.push(u); this.nav.board(u, D); u.boat = b; this.bosses.X24 = u;
    this.ptCrew = this.nav.spawnCrew(b, { n: O.crew, role: "garrison", aggro: 16 }); this.crewWeak(b, this.ptCrew);
    if (!this.bossesMet.includes("X24")) this.bossesMet.push("X24");
    return u;
  }
  spawnX20() {
    const b = this.ships.FS; if (!b || this.bosses.X20) return null;
    const ctx = this.ctx, B = BOSSES.X20, O = BOSS_OPS.X20, D = b.deck, W = D.toWorld(0, 10, {});
    const u = new BigUnit(ctx, { kind: "boss", side: "dich", tier: "tuong", rigKey: "X20", name: B.name, id: "X20", x: W.x, z: W.z, yaw: wrap(D.yaw + Math.PI),
      T: { hp: B.hp, poise: B.poise, cong: B.cong, giap: B.giap, lunge: O.lunge, ultMax: 1, name: "Đại tướng" }, defeatMeans: B.defeatMeans, hpLockPct: O.deckLockPct, captureAtPct: B.hpLockPct,
      leash: O.leash, awake: false, aggro: O.awakeR, stay: (h) => this.x20Stay(h) });
    ctx.units.push(u); this.nav.board(u, D); u.boat = b; this.bosses.X20 = u; this.x20 = { st: "deck", phase: 1 };
    // các nhóm tinh nhuệ trên boong dưới (canon "nhóm 3–5"): đầu ván dốc, mũi thuyền, hai bên chân cầu thang
    const G = [[0, 6.5, "garrison"], [0, 13.5, "squad"], [0, -2, "squad"]];
    O.guards.forEach((n, g) => { const [lx, lz, role] = G[g % G.length]; this.spawnGroup(D, lx, lz, n, { role, r: g === 2 ? 2.6 : 1.4 }); });
    if (!this.bossesMet.includes("X20")) this.bossesMet.push("X20");
    return u;
  }
  // n lính (tinh nhuệ Nguyên mặc định) quanh điểm cục bộ (lx, lz) của boong D, neo tại đó
  spawnGroup(D, lx, lz, n, { role = "garrison", tier = "tinhnhue", side = "dich", r = 1.4, kitMix = ["NG_DAO", "NG_GIAO", "NG_DAO", "NG_CUNG", "NG_GIAO"] } = {}) {
    const out = [], c0 = D.toWorld(lx, lz, {}), anchor = { x: c0.x, z: c0.z, r: 2.5 };
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996 + 0.6, rr = r * (k ? 0.55 + 0.45 * ((k * 0.618) % 1) : 0.2);
      let px = lx + Math.sin(a) * rr, pz = lz + Math.cos(a) * rr;
      const w = D.toWorld(px, pz, {}); if (!D.contains(w.x, w.z, -0.3)) { px = lx; pz = lz + (k - n / 2) * 0.7; }
      D.toWorld(px, pz, _W);
      const s = this.ctx.crowd.spawn({ side, unit: side === "dich" ? "KHIEN_NG" : "GIAO_DV", kit: kitMix[k % kitMix.length], tier, role, x: _W.x, z: _W.z,
        yaw: wrap(D.yaw + Math.PI), anchor });
      s.boat = D.boat; this.nav.board(s, D); out.push(s);
    }
    return out;
  }
  updateBosses(dt) {
    // tướng đứng ngoài boong của boss (bùn dưới mạn): boss lùi về chỗ đứng phía mạn bên kia, không đứng sát lan can ngay trên đầu tướng
    const h = this.hero;
    for (const id of ["X24", "X20"]) {
      const u = this.bosses[id]; if (!u || !u.alive || u.captured || u.script || !u.deck || !u.stay || (id === "X20" && this.x20?.st !== "deck")) continue;
      const away = !u.stay(h), side = away ? (u.deck.toLocal(h.x, h.z, _A).x >= 0 ? -1 : 1) : 0;
      if (away === !!u._away && side === (u._side || 0)) continue;
      u._away = away; u._side = side;
      const [lx, lz] = id === "X24" ? [side * 1.8, 3] : [side * 2.6, 10];
      this.homeLocal(u, lx, lz);
    }
    const u24 = this.bosses.X24;
    if (u24 && u24.alive && !u24.captured && !this.chained && u24.hp <= u24.maxHp * BOSSES.X24.chainAtPct / 100) this.chainCluster();
    const u20 = this.bosses.X20;
    if (u20 && u20.alive && !u20.captured) this.updateX20(u20, dt);
    if (this.phase === 5 && this.hkLock && !this.ctx.hk.tpc && this.time >= this.rallyAt) {
      this.rallyAt = this.time + 20; this.banner("HÀO KHÍ 100 · BẤM {TPC}: TỔNG PHẢN CÔNG", "#ffd27a", 1.6);
    }
  }
  // Tướng và đơn vị lớn (boss, sĩ quan, người bị bắt, tướng đồng minh) không chồng hình: cùng boong (hay cùng dưới đất), cùng tầng,
  // gần hơn bán kính đơn vị + 0,45 m thì đẩy ra — tướng 65%, đơn vị 35% (người bị bắt / đang theo kịch bản đứng yên: tướng chịu
  // cả); rồi va chạm lại (lan can boong, thân thuyền). Review B20: mũ Phàn Tiếp xuyên qua người tướng, tướng đứng lẫn trong người bị
  // bắt (units.js chỉ lùi khi < 1,8 m). Chỉ B20 (B15 giữ từng byte).
  separate() {
    const h = this.hero, w = this.ctx.world, gates = this.ctx.openGates;
    if (!h.alive || h.state === "climb" || h.state === "ride" || h.state === "down") return;
    for (const u of this.ctx.units) {
      if (!u.alive || u.dead > 0 || u.climbY !== undefined || u.deck !== h.deck || Math.abs((u.y ?? h.y) - h.y) > 1.2) continue;
      const R = u.radius + 0.45, dx = h.x - u.x, dz = h.z - u.z, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2), nx = d > 1e-4 ? dx / d : -Math.sin(h.yaw), nz = d > 1e-4 ? dz / d : -Math.cos(h.yaw), push = R - d;
      const fixed = !!(u.captured || u.script), kh = fixed ? 1 : 0.65;
      h.x += nx * push * kh; h.z += nz * push * kh; [h.x, h.z] = collide(w, h.x, h.z, 0.5, gates, h);
      if (!fixed) { u.x -= nx * push * (1 - kh); u.z -= nz * push * (1 - kh); [u.x, u.z] = collide(w, u.x, u.z, 0.7, gates, u); }
    }
  }
  // đặt chỗ đứng (nhà, trạm) của đơn vị lớn ở toạ độ cục bộ (lx, lz) trên boong nó đang đứng — sửa luôn ghim theo boong của naval
  homeLocal(u, lx, lz) {
    const D = u.deck; if (!D) return;
    const W = D.toWorld(lx, lz, _W);
    for (const o of [u.home, u.post]) { o.x = W.x; o.z = W.z; }
    for (const p of u._pins || []) if (p[0] === u.home || p[0] === u.post) { p[3] = lx; p[4] = lz; p[5] = D; }
  }
  // tướng đứng trên cụm thuyền Phàn Tiếp (thuyền chỉ huy, ván dốc của nó; sau khi xích: hai thuyền kề và ván xích)
  onCluster(h) {
    const D = h.deck; if (!D) return false;
    if (D === this.ships.PT?.deck) return true;
    return !!this.chained && (CLUSTER.ids.some((id) => this.ships[id]?.deck === D) || this.chained.some((L) => L?.plank === D));
  }
  // Liên Hoàn Thuyền (Phàn Tiếp dưới 50% Sinh lực): ván + xích nối thuyền chỉ huy – J8 – J12, cả cụm không dập dềnh; thủy thủ hai thuyền
  // kề dựng ngay và tràn sang.
  chainCluster() {
    const pt = this.ships.PT, [n1, n2] = CLUSTER.ids.map((id) => this.ships[id]); if (!pt || !n1 || !n2 || this.chained) return;
    this.chained = [this.nav.grapple(pt, n1, { chain: true }), this.nav.grapple(n1, n2, { chain: true })];
    for (const b of [pt, n1, n2]) b.calm = true;
    for (const id of CLUSTER.ids) { const q = this.hulls[id] || (this.hulls[id] = { id, boat: this.ships[id], left: HULL_CREW.n, spawned: false, agents: [] }); q.force = true; }
    this.hullT = 0;
    this.banner("LIÊN HOÀN THUYỀN", "#ff8a6a", 1.8); this.ctx.audio.play("horn"); this.ctx.fx.shake(0.35);
    this.say(`${lbl("Hư cấu")}Phàn Tiếp xích ba thuyền làm một bệ đứng vững — thủy thủ hai thuyền kề tràn sang qua ván xích.`, 6, "bad");
    this.say(`${lbl("Hư cấu")}Phàn Tiếp: "${BOSSES.X24.line.text}"`, 4);
  }
  // Ô Mã Nhi: boong dưới (khóa tạm deckLockPct) → lui lên lầu (kịch bản, không nhận đòn) → chờ toán giữ cầu thang → lầu chỉ huy.
  updateX20(u, dt) {
    const X = this.x20, h = this.hero, fs = this.ships.FS, D = fs.deck, O = BOSS_OPS.X20;
    if (X.st === "deck" && u.hpLocked) {
      X.st = "retreat"; X.phase = 2;
      // đường lui: vòng qua cột buồm chính (tim thuyền, z 4,5) về chân cầu thang, lên thang, vào giữa lầu
      const L0 = D.toLocal(u.x, u.z, {}), sg = L0.x < 0 ? -1 : 1;
      const P = [...(L0.z > 3.6 ? [[sg * 1.6, Math.min(L0.z, 6)], [sg * 1.6, 3.4]] : []), [0, 2.4], [0, -1.5], [0, -6.4], [0, -10.8]]
        .map(([lx, lz]) => { const w = D.toWorld(lx, lz, {}); return { x: w.x, z: w.z }; });
      u.script = { pts: P, k: O.retreatK, i: 0, onDone: () => { if (X.st === "retreat") X.st = "wait"; } };
      u.poise = u.poiseMax; u.broken = 0; if (h.lock === u) h.lock = null;
      const top = P[P.length - 1]; u.home = { x: top.x, z: top.z }; u.post = { x: top.x, z: top.z };
      this.nav.leave(u); u._pins = null; this.nav.board(u, D);          // ghim nhà mới (lầu chỉ huy) theo boong
      this.stairGuard = this.spawnStairGuard();
      this.banner("Ô MÃ NHI LUI LÊN LẦU CHỈ HUY", "#ff8a6a", 1.8); this.ctx.audio.play("horn");
      this.say(`Ô Mã Nhi lui lên lầu chỉ huy. Hạ toán giữ cầu thang (Đội trưởng + ${O.stairElites} tinh nhuệ) rồi lên lầu: Sinh lực khóa ở ${BOSSES.X20.hpLockPct}% — Vỡ Thế rồi Đòn Quyết để bắt sống.`, 7, "bad");
      return;
    }
    // lui kẹt (đợt 9 D4: bot đo được ông ta đứng mãi ở "retreat" — đường lui bị chặn giữa boong dưới và chân thang): quá retreatMax s
    // thì đặt thẳng lên giữa lầu, kịch bản xong (X.snap đếm số lần, để kiểm thử)
    if (X.st === "retreat") {
      X.retreatT = (X.retreatT || 0) + dt;
      const S = u.script;
      if (S && X.retreatT > O.retreatMax && (S.i || 0) < S.pts.length) {
        const top = S.pts[S.pts.length - 1];
        u.x = top.x; u.z = top.z; this.nav.board(u, D); S.i = S.pts.length; X.snap = (X.snap || 0) + 1;
      }
    }
    if (X.st === "wait") {
      const g = this.stairGuard, crowd = this.ctx.crowd, off = g?.officer;
      const cleared = (!off || !off.alive || off.dead > 0) && (g?.agents || []).filter((a) => crowd.hittable(a)).length <= 1;
      // (tướng đã đứng trên lầu quá towerWait s mà toán giữ cầu thang còn sót — lính kẹt đâu đó: Ô Mã Nhi vẫn ra đánh)
      const onTower = h.deck === D && h.y > D.toWorld(0, -10.8, _W).y - 0.8;
      X.towerT = onTower ? (X.towerT || 0) + dt : 0;
      if (cleared || X.towerT > O.towerWait) {
        X.st = "tower"; u.script = null; u.hpLockPct = BOSSES.X20.hpLockPct; u.captureAtPct = BOSSES.X20.hpLockPct;
        u.poise = u.poiseMax; u.lungeOn = true; u.lungeCd = 2.5; u.awake = true; u.atkCd = 1; u.leash = O.towerLeash;
        this.banner("LẦU CHỈ HUY · BẮT SỐNG Ô MÃ NHI", "#f1d98a", 1.8); this.ctx.audio.play("drums3");
        this.say("Lầu chỉ huy: Ô Mã Nhi dùng Kích xuyên (lao đâm — né ngang). Đánh tới khi Sinh lực khóa, tới Vỡ Thế rồi Đòn Quyết.", 6);
      }
    }
  }
  // Ô Mã Nhi đánh tướng khi tướng ở trên kỳ hạm; tầng 2 chỉ trên lầu chỉ huy (và nửa trên cầu thang) — tướng lui xuống boong dưới thì
  // ông ta đứng lại trên lầu, không đuổi, không bị chém từ dưới.
  x20Stay(h) {
    const D = this.ships.FS?.deck; if (!D || h.deck !== D) return false;
    return this.x20?.st !== "tower" || h.y >= D.toWorld(0, -10.8, _W).y - 1.6;
  }
  // Toán giữ cầu thang: Đội trưởng ở chân cầu thang + tinh nhuệ quanh đó (neo, không rời xa)
  spawnStairGuard() {
    const ctx = this.ctx, D = this.ships.FS.deck, W = D.toWorld(0, 3.2, {});
    const off = new BigUnit(ctx, { kind: "officer", side: "dich", tier: "doitruong", name: "Đội trưởng giữ cầu thang", id: "FS:stair", x: W.x, z: W.z, yaw: D.yaw,
      awake: true, aggro: 14, leash: 7, stay: (h) => h.deck === D });
    ctx.units.push(off); this.nav.board(off, D); off.boat = this.ships.FS;
    return { officer: off, agents: this.spawnGroup(D, 0, 3.4, BOSS_OPS.X20.stairElites, { role: "garrison", r: 2.2 }) };
  }
  // Quân ta cầm giáo đứng vây người bị bắt (giáo hạ, không trói, không quỳ — R-spec §6)
  // (vòng hở phía trước mặt người bị bắt ±62° — chỗ tướng đứng, máy quay cảnh bắt sống nhìn vào; review B20: lính vây chắn kín người
  // bị bắt trong cảnh bắt sống)
  ringGuards(u, n = BOSS_OPS.capturedGuards, r = 2.4) {
    const crowd = this.ctx.crowd, D = u.deck, out = [], gap = 2.16;
    for (let k = 0; k < n; k++) {
      const a = u.yaw + gap / 2 + (k + 0.5) * (2 * Math.PI - gap) / n;
      let rr = r, x = u.x + Math.sin(a) * rr, z = u.z + Math.cos(a) * rr;
      for (let t = 0; t < 3 && D && !D.contains(x, z, -0.25); t++) { rr *= 0.72; x = u.x + Math.sin(a) * rr; z = u.z + Math.cos(a) * rr; }
      const g = crowd.spawn({ side: "ta", unit: "GIAO_DV", kit: "DV_GIAO", role: "captor", x, z, yaw: Math.atan2(u.x - x, u.z - z) });
      g.stun = 1e9; g.ready = true; if (D) this.nav.board(g, D); out.push(g);
    }
    return out;
  }
  onX24Captured(u) {
    const ctx = this.ctx, O = BOSS_OPS;
    setCmdShips(this.st, 1);
    this.ringGuards(u);
    ctx.crowd.rout(u.x, u.z, 30);
    this.hk(HAO_KHI.src.mainMission, "bắt sống Phàn Tiếp");
    if (O.X24.heal) this.hero.heal(O.X24.heal);   // như chiếm hộ vệ: thắng thế, thân binh băng bó (ĐỀ XUẤT BẢN THỬ)
    // tướng không nhận đòn tới khi sang pha 6 (bắt sống rồi mà gục thì mất công bắt — review B20)
    this.safeUntil = this.time + O.captureShot + O.fsSettle + 2;
    this.bq.length = 0; this.bqT = Math.max(this.bqT, 1.4);   // units.capture đã hiện băng "BẮT SỐNG": nhường chỗ
    this.banner("BẮT SỐNG PHÀN TIẾP", "#f1d98a", 1.6);
    ctx.audio.play("capture"); ctx.audio.play("cheer"); ctx.slowmo?.(0.8, 0.35);
    this.say(`${lbl("Chính sử")}Phàn Tiếp bị bắt sống.`, 7, "good");
    this.say(`Thuyền chỉ huy của ông im cờ, hạm đội Nguyên rối loạn.${O.X24.heal ? ` (+${Math.round(O.X24.heal * 100)}% Sinh lực)` : ""}`, 7, "good");
    this.captureShot(u);
    this.later(O.captureShot, () => this.groundFlagship());
  }
  onX20Captured(u) {
    const ctx = this.ctx, O = BOSS_OPS;
    this.main[5] = true;
    this.ringGuards(u, O.capturedGuards, 2.1);
    ctx.crowd.rout(u.x, u.z, 45);
    this.safeUntil = this.time + O.afterCapture + 2;
    this.bq.length = 0; this.bqT = Math.max(this.bqT, 1.4);
    this.banner("BẮT SỐNG Ô MÃ NHI", "#f1d98a", 1.8);
    ctx.audio.play("capture"); ctx.audio.play("cheer"); ctx.slowmo?.(1.0, 0.3);
    this.say(`${lbl("Chính sử")}Ô Mã Nhi bị bắt sống trên kỳ hạm. Theo Toàn thư, Nội minh tự Đỗ Hành bắt được Ô Mã Nhi và Tích Lệ Cơ Ngọc.`, 9, "good");
    this.captureShot(u);
    this.later(O.afterCapture, () => {
      this.win("Ô Mã Nhi bị bắt sống, thủy quân Nguyên tan vỡ trên sông Bạch Đằng (Chính sử: Đỗ Hành bắt được Ô Mã Nhi).");
      this.startOutro();
    });
  }
  heroImmune() { return this.time < this.safeUntil; }
  // Cảnh bắt sống (BOSS_OPS.captureShot s): tướng bước sang bên người bị bắt, khói / vệt chém tắt nhanh, máy quay đứng trước mặt
  // người bị bắt (cách 7 m, ngẩng 0,3) nhìn cả hai — không còn chỉ thấy lưng tướng giữa khói (review B20).
  captureShot(u) {
    const h = this.hero, D = u.deck, fx = this.ctx.fx;
    for (const sp of fx.sprites || []) sp.t = Math.max(sp.t, sp.T * 0.92);
    if (fx.parts) fx.parts.length = 0;
    if (D && h.deck === D && h.alive) {
      const c = Math.cos(u.yaw), s = Math.sin(u.yaw), sd = (h.x - u.x) * c - (h.z - u.z) * s >= 0 ? 1 : -1;
      for (const k of [sd, -sd]) {
        const x = u.x + k * 1.9 * c + 1.2 * s, z = u.z - k * 1.9 * s + 1.2 * c;
        if (!D.contains(x, z, -0.3)) continue;
        this.nav.leave(h); h.x = x; h.z = z; this.nav.board(h, D); h.yaw = Math.atan2(u.x - x, u.z - z); h.dyaw = wrap(h.yaw - D.yaw); h.state = "free"; break;
      }
    }
    h.lock = null;
    // máy quay trước mặt người bị bắt, cách 8 m, ngẩng 0,6 (nhìn qua đầu quân ta đứng vây), nhìn vào giữa người bị bắt và tướng
    const fy = u.yaw, R = 8, P = 0.6, mid = () => ({ x: (u.x * 2 + h.x) / 3, y: u.y + 1.2, z: (u.z * 2 + h.z) / 3 });
    this.cine = { kind: "capture", t: 0, T: BOSS_OPS.captureShot, p0: null,
      pos: () => ({ x: u.x + Math.sin(fy) * R * Math.cos(P), y: u.y + 1.5 + R * Math.sin(P), z: u.z + Math.cos(fy) * R * Math.cos(P) }),
      look: mid, see: () => ({ x: u.x, y: u.y + 1.3, z: u.z }) };
  }
  // Máy quay cảnh ngắn (đè máy quay của battle.js, chạy sau nó): vào cảnh 0,5 s, giữ tới hết T rồi trả máy quay cho người chơi.
  cineCamera(dt) {
    const C = this.cine, cam = this.ctx.camera; if (!cam) return;
    C.t += dt;
    if (C.t >= C.T) { this.cine = null; if (this.ctx.cam) { this.ctx.cam.idle = 0; this.ctx.cam.yaw = Math.atan2(this.hero.x - cam.position.x, this.hero.z - cam.position.z); } return; }
    if (!C.p0) C.p0 = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    const p = C.pos(), l = C.look(), k = smooth01(C.t / 0.5);
    const gy = Math.max(this.ctx.world.groundY(p.x, p.z), this.ctx.world.tideY) + 1.2;
    cam.position.set(lerp(C.p0.x, p.x, k), Math.max(lerp(C.p0.y, p.y, k), gy), lerp(C.p0.z, p.z, k));
    cam.lookAt(l.x, l.y, l.z);
  }
  // Cảnh kết (≤ 10 s cả lúc bắt sống): máy quay rời tướng, kéo lên cao nhìn toàn khúc cọc — thuyền Nguyên nằm nghiêng, thuyền ta vây.
  startOutro() {
    const cx = (STAKES[0].x + STAKES[STAKES.length - 1].x) / 2, h = this.hero;
    const fs = this.ships.FS, top = fs ? fs.deck.toWorld(0, -10.8, {}).y + 10 : -Infinity;
    this.cine = null;
    this.outro = { t: 0, T: BOSS_OPS.outroSec, p0: null, l0: null, minY: top,
      p1: { x: cx - 190, y: 118, z: zc(cx - 190) + 175 }, l1: { x: cx + 25, y: -1, z: zc(cx + 25) + 4 }, hx: h.x, hy: h.y + 1.6, hz: h.z };
  }
  outroCamera(dt) {
    const O = this.outro, cam = this.ctx.camera; if (!cam) return;
    if (!O.p0) O.p0 = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    O.t += dt;
    const k = smooth01(O.t / (O.T - 1.2)), kl = smooth01(O.t / (O.T - 2.2));
    // lên thẳng quá mái lầu chỉ huy trước rồi mới kéo xa (không xuyên mái lầu — review B20)
    const yUp = lerp(O.p0.y, Math.max(O.p0.y, O.minY), smooth01(O.t / 1.2));
    cam.position.set(lerp(O.p0.x, O.p1.x, k), Math.max(lerp(O.p0.y, O.p1.y, k), yUp), lerp(O.p0.z, O.p1.z, k));
    cam.lookAt(lerp(O.hx, O.l1.x, kl), lerp(O.hy, O.l1.y, kl), lerp(O.hz, O.l1.z, kl));
  }

  // ---- Tương tác, đò chuyển ------------------------------------------------------------------------------------------------
  hold(sec = 1.2) { this.holdT = sec; }
  updateInteract(dt) {
    const h = this.hero, inp = this.ctx.input;
    if (this.holdT > 0) this.holdT -= dt;
    const held = !!inp?.held?.interact || this.holdT > 0;
    if (this.ferryPick) { this.interact = null; return; }     // đóng bảng: pickerFrame (mỗi khung)
    if (this.needRelease) { if (!held) this.needRelease = false; this.interact = null; return; }
    const r = this.nav.interactStep(h, held, dt);
    // "Gọi đò chuyển" khi đang giao chiến (địch trong 8 m, đang khoá mục tiêu, thanh boss đang hiện) và chưa giữ phím: nhắc nhỏ ở góc
    // (quiet), không chiếm giữa màn trên đầu tướng (review B20: nhắc đò hiện ~30/35 ảnh, cả lúc đánh boss)
    if (r.item?.kind === "ferry" && r.p === 0) { this.busyT -= dt; if (!(this.busyT > 0)) { this.busyT = 0.25; this.busy = this.fighting(); } }
    this.interact = r.item ? { text: r.item.label, p: r.p, kind: r.item.kind, quiet: r.item.kind === "ferry" && r.p === 0 && this.busy } : null;
    if (r.done) this.needRelease = true;
  }
  // tướng đang giao chiến: địch (lính đánh được, sĩ quan, boss) trong 8 m, đang khoá mục tiêu, hay boss đang thức trên cùng boong
  fighting() {
    const h = this.hero, crowd = this.ctx.crowd;
    if (h.lock?.alive && !h.lock.dead) return true;
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.captured && u.awake && (u.x - h.x) ** 2 + (u.z - h.z) ** 2 < 144) return true;
    for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && (a.x - h.x) ** 2 + (a.z - h.z) ** 2 < 64) return true;
    for (const id in this.bosses) { const u = this.bosses[id]; if (u.alive && !u.captured && u.awake && u.deck && u.deck === h.deck) return true; }
    return false;
  }
  // Bảng chọn nơi đến (≤ 4, gần trước theo mức ưu tiên của pha). src: "interact" | "order" | "auto".
  openFerry(src = "interact") {
    const items = this.ferryItems();
    if (!items.length) { this.say("Không có nơi đến đò trong tầm.", 2.5); return false; }
    this.ferryPick = { items, deck: this.hero.deck, onPick: (it) => { this.ferryPick = null; this.ferryTo(it.id); }, title: src === "auto" ? "Bè đang trôi · gọi đò rời bè" : "Đò chuyển · chọn nơi đến" };
    return true;
  }
  ferryItems() {
    const h = this.hero, nav = this.nav, st = this.st, out = [], cur = h.deck, ph = this.phase;
    const add = (id, label, kind, D, pri, sub = "") => {
      if (!D || D === cur || D.off) return;
      const x = D.m[9], z = D.m[11], d = Math.hypot(x - h.x, z - h.z);
      if (d < 6 || d > FERRY.maxDist) return;
      out.push({ id, label, kind, pri, d, sub: sub ? `${sub} · ${Math.round(d)} m` : `${Math.round(d)} m` });
    };
    if (ph === 2) for (const R of nav.rafts) if (st.markers[R.id]?.state === "hidden") add("raft:" + R.id, `Bè cỏ ${R.id}`, "raft", R.deck, 0, "chưa mở");
    if (ph === 1 || ph === 2) {
      for (const s of this.scouts) if (s.state === "go") add(s.boat.id, `Chặn thuyền dò → ${s.target}`, "escort", s.boat.deck, 0, "địch");
      for (const q of this.squads) if (q.state === "go" && q.boat) add(q.boat.id, `Chặn đội dò luồng → ${q.id}`, "escort", q.boat.deck, 0, "địch");
    }
    if (ph >= 1) for (const id in this.esc) {
      const e = this.esc[id]; if (e.down || e.gone || !(e.patrol || e.flee || e.stuck)) continue;
      add(id, e.flee ? `Chặn thuyền hộ vệ ${id}` : `Áp mạn thuyền hộ vệ ${id}`, "escort", e.boat.deck, ph === 3 ? 0 : 1, e.flee ? "đang chạy" : e.stuck ? "mắc cọc" : "địch");
    }
    for (const id in this.esc) { const e = this.esc[id]; if (e.down && !e.gone) add(id, `Thuyền hộ vệ ${id} (đã chiếm)`, "captured", e.boat.deck, 2); }
    if (ph >= 4) for (const id of this.stranded || []) {
      const b = this.ships[id]; if (!b) continue;
      add(id, b.label, b.type === "flagship" ? "flagship" : "ship", b.deck, (id === "PT" && ph === 4) || id === "FS" ? -1 : 0, "mắc cạn");
    }
    const L = this.lead(); if (L && !L.lost) add(L.id, "Thuyền chỉ huy nhẹ", "light", L.deck, 2);
    if (ph === 0) for (const b of this.flot) if (b.slot !== 0 && !b.lost) add(b.id, b.label, "light", b.deck, 1);
    for (const d of this.ctx.world.pierDecks || []) add("pier:" + d.pier, d.label, "pier", d, 3);
    out.sort((a, b) => a.pri - b.pri || a.d - b.d);
    return out.slice(0, 4).map(({ id, label, kind, sub }) => ({ id, label, kind, sub }));
  }
  // Gọi đò tới nơi id (bot / kịch bản dùng thẳng). Thuyền địch bị nhắm thì dừng lại (đò ta chặn đầu).
  ferryTo(id) {
    const h = this.nav.ferry(this.hero, id, { onDone: () => this.onFerryDone(id) });
    if (!h) { this.say("Chưa gọi được đò (đang có chuyến, hoặc tướng đang leo).", 2.5); return null; }
    const e = this.esc[id]; if (e) e.ferryT = 12;
    const s = this.scouts.find((q) => q.boat.id === id); if (s) s.ferryT = 12;
    this.ctx.audio.play("drum");
    return h;
  }
  onFerryDone(id) { if (this.ctx.cam) this.ctx.cam.idle = 0; }

  // ---- thân binh -----------------------------------------------------------------------------------------------------------
  spawnGuards(now) {
    const ctx = this.ctx, h = this.hero, D = h.deck;
    const have = ctx.crowd.agents.filter((a) => a.role === "guard" && ctx.crowd.hittable(a)).length;
    const want = Math.min(FLOTILLA.guards, ctx.stats.guardBase ?? FLOTILLA.guards) - have;
    if (want <= 0) return;
    if (D?.boat && now) { this.nav.spawnCrew(D.boat, { side: "ta", n: want, role: "guard", kitMix: ["DV_GIAO", "DV_DAO", "DV_GIAO"] }); return; }
    for (let i = 0; i < want; i++) {
      const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", kit: i % 2 ? "DV_DAO" : "DV_GIAO", role: "guard", x: h.x - 1 - i * 0.4, z: h.z + (i % 2 ? 1 : -1), legionMult: ctx.stats.legionMult });
      if (D) this.nav.board(a, D);
    }
  }
  updateGuards() {
    if (this.guardDue.length && this.time >= this.guardDue[0] && this.hero.alive && this.hero.state !== "ride" && this.hero.state !== "climb") {
      this.guardDue.shift(); this.spawnGuards(false);
    }
  }

  // ---- móc của tướng, lính, sĩ quan ------------------------------------------------------------------------------------------
  onSoldierKilled(a, opt = {}) {
    const byHero = opt.by === "hero";
    if (a.side === "dich") {
      if (byHero) {
        this.ko++;
        if (this.ko % HAO_KHI.src.koMilestoneEvery === 0 && this.koMs < HAO_KHI.src.koMilestoneCap) { this.koMs++; this.hk(HAO_KHI.src.koMilestone, "mốc KO"); }
      }
      if (a.vg && this.phase === 0) { const ev = []; provoke(this.st, "ko", 1, ev); this.handle(ev); }
    } else if (a.role === "guard") this.guardDue.push(this.time + 20);   // thân binh bổ sung sau 20 s
  }
  onOfficerAwake() {}
  onOfficerKilled(u) {
    const ctx = this.ctx;
    this.ko++;
    if (u.tier === "doitruong") this.hk(HAO_KHI.src.killCaptain, "hạ đội trưởng");
    this.provokeOfficer(u);
    this.banner(u.escort ? "ĐÃ HẠ TRẤN THỦ" : u.squad ? "ĐÃ HẠ ĐỘI TRƯỞNG DÒ LUỒNG" : u.id === "FS:stair" ? "ĐÃ HẠ TOÁN GIỮ CẦU THANG" : "ĐÃ HẠ ĐỘI TRƯỞNG", "#e6dcc3", 1.2);
    ctx.slowmo?.(0.55, 0.28); ctx.fx.flash(0.4); ctx.audio.play("finisher", u.x, u.z); ctx.audio.play("cheer");
    if (u.escort) this.say(`Trấn thủ thuyền hộ vệ ${u.escort} đã ngã — hạ bớt thủy thủ rồi giữ Tương tác 3 s trên boong để chiếm.`, 5, "good");
    if (u.squad) this.say(`Đội trưởng dò luồng ở ${u.squad.id} đã ngã: mốc thôi bị dò.`, 4, "good");
    if (u.id === "FS:stair") this.say("Đội trưởng giữ cầu thang đã ngã — lên lầu chỉ huy!", 4, "good");
  }
  provokeOfficer(u) { if (u.vg && !u.vg.provoked && this.phase === 0) { u.vg.provoked = true; const ev = []; provoke(this.st, "officer", 1, ev); this.handle(ev); } }
  onBreak(u) { this.provokeOfficer(u); this.banner("VỠ THẾ · ĐÒN MẠNH ĐỂ RA ĐÒN QUYẾT", "#ffd27a", 1.2); this.ctx.audio.play("parry", u.x, u.z); }
  onBossDefeated() {}
  onCaptured(u) {
    if (u.id) this.captured[u.id] = true;
    if (u.id === "X24") return this.onX24Captured(u);
    if (u.id === "X20") return this.onX20Captured(u);
    this.say(`Bắt sống ${u.name}.`, 5, "good");
  }
  onHeroHit() {}
  onRevive() { this.hk(HAO_KHI.src.reviveUsed, "gượng dậy"); }
  onHeroDead() { this.lose("Trần Hưng Đạo gục ngã.", true); }
  onCounterBoss() { if (this.counterBoss < HAO_KHI.src.counterBossMax) { this.counterBoss++; this.hk(HAO_KHI.src.counterBoss, "phản đòn tướng Nguyên"); } }
  onAllyGeneralDown(u) { this.say(`${u.name} bị thương, lui về.`, 4, "bad"); }
  onUlt() {}
  ultQ() {}
  fillActors() {}
  killActor() {}
  damageGate() {}
  plantFlag(x, z, r) { this.ctx.fx.ring(x, z, r, 0xf1d98a, 0.8); }
  // H31 Hịch Tướng Sĩ: mọi cánh thủy quân +Sĩ Khí, quân ta (lính thật) Công +congPct trong sec s
  onArmyBuff({ skAll = 15, congPct = 0.1, sec = 20 } = {}) {
    for (const id in this.st.wings) { const w = this.st.wings[id]; w.sk = clamp(w.sk + skAll, 0, 100); }
    const k = 1 + congPct;
    for (const a of this.ctx.crowd.agents) if (a.side === "ta" && this.ctx.crowd.hittable(a) && !this.buffs.some((b) => b.a === a && b.id === a.id)) { a.cong *= k; this.buffs.push({ a, id: a.id, k, until: this.time + sec }); }
    this.say(`Hịch Tướng Sĩ: mọi cánh thủy quân +${skAll} Sĩ Khí, quân ta Công +${Math.round(congPct * 100)}% trong ${sec} s.`, 4, "good");
    this.ctx.audio.play("drums3");
  }
  // H31 Bạch Đằng Quyết Chiến kết thúc: Sĩ Khí +siKhi; cánh được phép thì Tiến công (thuyền phục chỉ từ pha 5)
  onUltEnd({ siKhi = 15 } = {}) {
    for (const id in this.st.wings) {
      const w = this.st.wings[id]; w.sk = clamp(w.sk + siKhi, 0, 100);
      if (id !== "flotilla" ? this.phase >= 4 : this.phase >= 1) w.order = { id: "tiencong", left: WING_ORDERS.tiencong.dur };
    }
  }
  onMark(t) { if (t?.name) this.say(`Binh Thư Yếu Lược: ${t.name} bị đánh dấu — quân ta đánh +40% trong 20 s.`, 3, "good"); }
  pickMarkTarget(h, range) {
    let best = null, bd = (range * 1.5) ** 2;
    for (const u of this.ctx.units) { if (u.side !== "dich" || !u.alive || u.dead || u.captured) continue; const q = (u.x - h.x) ** 2 + (u.z - h.z) ** 2; if (q < bd) { bd = q; best = u; } }
    return best;
  }

  // ---- lệnh, Tổng Phản Công ----------------------------------------------------------------------------------------------------
  heroWing() {
    if (this.phase === 0) return "flotilla";
    // P4: luôn cánh thuyền phục có cửa lạch gần nhất (Giữ vững chặn cửa nhánh — trước đây xa > 160 m thì rơi về cánh thuyền nhẹ, mất
    // lượt lệnh); P5–P6: trong 160 m; P2–P3: cánh thuyền nhẹ (đò chuyển).
    const h = this.hero; let best = "flotilla", bd = this.phase === 3 ? Infinity : this.phase >= 4 ? 160 : 0;
    for (const id of ["chanh", "rut", "gia"]) { const d = Math.abs(h.x - WINGS[id].mouthX); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  order(wing, id) {
    const st = this.st, ctx = this.ctx;
    if (!WINGS[wing]) wing = this.heroWing();
    const ev = [], r = riverOrder(st, wing, id, ev);
    if (r.ok) {
      this.orders++; ctx.audio.play("drum");
      if (r.stance) this.say(`Thuyền nhẹ — ${STANCE_SAY[r.stance]}.`, 4, "good");
      else if (r.ferry) this.openFerry("order");
      else this.say(`${WING_ORDERS[id].name} → ${WINGS[wing].name}${id === "tiepvien" ? ` (tới sau ${WING_ORDERS.tiepvien.delay} s)` : ""}.`, 3.5, "good");
    } else {
      const why = { cd: `${WING_ORDERS[id]?.name ?? id} đang hồi (${Math.ceil(r.cd || 0)} s).`, phuc: "Thuyền phục phải ẩn trong nhánh sông tới pha 5.",
        phase: "Lệnh này chưa dùng được ở pha này.", charges: "Hết lượt tiếp viện.", id: "Không có cánh quân này." }[r.why] || "Lệnh chưa thực hiện được.";
      this.say(why, 2.5);
    }
    this.handle(ev);
    return r;
  }
  tryTPC() {
    const ctx = this.ctx, hk = ctx.hk;
    if (hk.tpc) return false;
    if (!tpcReady(hk)) { this.say(`Hào Khí ${Math.floor(hk.value)}/100 — chưa đủ để kích Tổng Phản Công.`, 2); return false; }
    const dur = hkActivate(hk);
    this.hkLock = false;
    for (const id in this.st.wings) if (id !== "flotilla" ? this.phase >= 4 : this.phase >= 1) this.st.wings[id].order = { id: "tiencong", left: Math.round(dur) };
    this.hero.hkUltReady = true;
    this.tpcLog = this.tpcLog || []; this.tpcLog.push({ at: Math.round(this.time), phase: this.phase });
    ctx.cinematic("TỔNG PHẢN CÔNG", this.hero, true);
    this.say("Tổng Phản Công: Tuyệt Kỹ đầu tiên ({ult}) là bản Hào Khí — không tốn Khí Lực, vòng chém rộng hơn.", 5, "good");
    ctx.audio.play("drums3"); ctx.audio.play("horn");
    return true;
  }
  onTpcEnd() { this.say("Tổng Phản Công kết thúc.", 3); }

  // ---- HUD ------------------------------------------------------------------------------------------------------------------
  hudState() {
    const scout = this.scoutHud(), f = this.st.fleet;
    const extra = { bosses: this.bossHud(), interact: this.cine || this.outro ? null : this.interact, ferry: this.ferryPick, scout, hkLock: this.hkLock && !this.ctx.hk.tpc, escaped: this.escaped };
    if (this.phase === 3) {                 // P4: hộ vệ trong đợt chạy ra cửa sông (8 đợt hai + đợt một còn sót)
      let tot = 0; for (const id in this.esc) if (this.esc[id].p4) tot++;
      extra.escorts = { down: f.escortsDown, need: 0, total: f.escortsTotal, wave: 2, downWave: f.downP4, waveTotal: tot || FLEET.escorts[1], escaped: this.escaped };
    }
    return riverHud(this.st, extra);
  }
  // Thanh boss (hud-b20): Phàn Tiếp (P5), Ô Mã Nhi (P6, 2 tầng: boong dưới, lầu chỉ huy); khóa hiển thị = mức bắt sống
  bossHud() {
    const out = [];
    for (const id of ["X24", "X20"]) {
      const u = this.bosses[id]; if (!u) continue;
      const B = BOSSES[id], O = BOSS_OPS[id];
      out.push({ id, name: B.name, nameHan: B.nameHan, title: O.title, hp: u.hp, maxHp: u.maxHp, hpLock: id === "X20" ? B.hpLockPct : O.lockPct,
        poise: u.poise, poiseMax: u.poiseMax, phases: id === "X20" ? 2 : 1, phase: id === "X20" ? this.x20?.phase ?? 1 : 1,
        broken: u.broken > 0, captured: !!u.captured, unit: u });
    }
    return out;
  }
  scoutHud() {
    let best = null;
    for (const s of this.scouts) if (s.state === "go") {
      const R = this.raftOf(s.target); if (!R) continue;
      const sec = Math.max(0, Math.hypot(s.boat.x - R.deck.m[9], s.boat.z - R.deck.m[11]) - SCOUT_OPS.exposeR) / SCOUT_OPS.speed;
      if (!best || sec < best.sec) best = { target: s.target, sec, warn: false };
    }
    const f = this.st.fleet;
    if (!best && this.st.intel && (this.phase === 1 || this.phase === 2)) {
      const left = f.scoutNext - this.st.t - this.simAcc;
      if (left > 0 && left <= FLEET.scoutWarn) {
        const tg = STAKES.map((s, i) => STAKES[(f.scoutN + i) % STAKES.length]).find((s) => this.st.markers[s.id].state === "hidden");
        if (tg) best = { target: tg.id, sec: left, warn: true };
      }
    }
    return best;
  }

  // ---- checkpoint, thắng thua ---------------------------------------------------------------------------------------------
  saveCheckpoint() {
    const h = this.hero;
    const esc = {};
    for (const id in this.esc) {
      const e = this.esc[id], b = e.boat;
      esc[id] = { down: e.down, crewLeft: e.down ? 0 : ESCORT_OPS.crew, officerAlive: !e.down, wave: e.wave || 1 };
      if (this.phase >= 4) Object.assign(esc[id], { gone: !!e.gone, stuck: !!e.stuck, flee: !!e.flee, out: !!e.out, p4: !!e.p4, side: e.side, x: b.x, z: b.z, yaw: b.yaw });
    }
    this.checkpoint = {
      phase: this.phase, time: this.time, river: snapshotRiver(this.st), hk: clone(this.ctx.hk),
      hero: { hp: h.hp, ki: h.ki, revives: h.revives }, ko: this.ko, koMs: this.koMs, main: [...this.main], phaseTimes: [...this.phaseTimes],
      esc, scoutsStopped: this.scoutsStopped, escaped: this.escaped, captured: { ...this.captured }, bossesMet: [...this.bossesMet],
      orders: this.orders, counterBoss: this.counterBoss, hkLock: this.hkLock, vgN: this.vgN, scoutN: this.scoutN, tpcLog: clone(this.tpcLog || []),
    };
  }
  restoreCheckpoint() {
    const c = this.checkpoint; if (!c) return;
    this.over = false; this.result = null; this.retries++;
    // tin nhắn, băng chữ, cảnh máy quay của lần thử trước không mang sang (review B20: dòng Liên Hoàn còn hiện sau khi tải lại pha 5)
    this.msgs.length = 0; this.bq.length = 0; this.bqT = 0; this.cine = null; this.outro = null; this.safeUntil = -1;
    for (const el of this.ctx.fx?.overlay?.querySelectorAll?.(".fx-banner") || []) el.remove();
    this.setupPhase(c.phase, c);
    this.say(`Tải lại đầu pha ${PHASES[this.phase].id}.`, 3);
  }
  // ?debug&phase=N: trạng thái hợp lý ở đầu pha n (0..5) — Kế Sách các pha trước coi như thành công, 4 hộ vệ đã chiếm, M1 M2 mở.
  fastForward(n) {
    const st = this.st, ev = [];
    const ok = (id) => { const k = st.ks[id]; if (k) { k.state = "thanhcong"; k.got = KE_SACH[id].hk; k.left = 0; } };
    for (let i = 1; i <= n; i++) {
      if (i === 1) { st.fleet.headX = MAP.khucCoc; st.nghi.flotX = MAP.khucCoc + 28; st.nghi.gap = 28; st.nghi.kk = 100; st.nghi.stance = "giuvung"; ok("nghiBinh"); st.fleet.reachShare = KE_SACH.nghiBinh.effect.reachShare; }
      if (i === 2) { st.fleet.headX = FLEET.stopX; st.fleet.escortsDown = 4; st.fleet.captured = 4; }
      if (i === 3) { st.markers.M1.state = "active"; st.markers.M2.state = "active"; ok("kichCoc"); }
      if (i === 4) { st.escape.value = 45; }
      if (i === 5) setCmdShips(st, 1);
      setPhase(st, i, ev);
      this.main[i - 1] = i - 1 === 4 ? true : this.phaseDone(i - 1);
    }
    this.hkLock = ev.some((e) => e.type === "hkSet");
    const hk = this.ctx.hk; hk.value = HK_B20.debugAt[n]; hk.floor = Math.min(75, Math.floor(hk.value / 25) * 25);
    const snapEsc = {}; for (const id of ["E1", "E2", "E3", "E4"]) if (n >= 2) snapEsc[id] = { down: true, crewLeft: 0, officerAlive: false };
    if (n >= 4) EBB_OPS.starts.forEach(([x, side], k) => {
      const down = k < 5, z = zc(x) + side * (EBB_OPS.lane + (x > 620 && x < 700 && side > 0 ? EBB_OPS.laneOut - EBB_OPS.lane : 0));
      snapEsc["E" + (FLEET.escorts[0] + 1 + k)] = { down, stuck: !down, wave: 2, p4: true, side, x, z, yaw: DOWN, crewLeft: down ? 0 : ESCORT_OPS.crew, officerAlive: !down };
      if (down) { st.fleet.escortsDown++; st.fleet.captured++; st.fleet.downP4++; }
    });
    this.time = this.phaseStart = 0;
    this.setupPhase(n, { river: snapshotRiver(st), hk: clone(hk), time: 0, ko: 0, koMs: 0, main: [...this.main], phaseTimes: [...this.phaseTimes],
      scoutsStopped: 0, escaped: 0, captured: n >= 5 ? { X24: true } : {}, bossesMet: [], orders: 0, counterBoss: 0, hkLock: this.hkLock,
      hero: { hp: this.hero.maxHp, ki: this.hero.kiMax * 0.5, revives: this.hero.revives }, esc: snapEsc });
    this.say(`?debug: vào thẳng đầu pha ${PHASES[n].id} (trạng thái dựng sẵn).`, 5);
    this.note(n);
  }
  win(why) {
    if (this.over) return;
    this.over = true; this.main[5] = true; this.phaseTimes[this.phase] = Math.round(this.time - this.phaseStart);
    this.result = this.buildResult(true, why);
    this.ctx.audio.play("victory");
  }
  lose(why, canRetry = true) {
    if (this.over) return;
    this.over = true;
    this.result = this.buildResult(false, why); this.result.canRetry = canRetry && !!this.checkpoint;
    this.ctx.audio.play("defeat");
  }
  buildResult(won, why) {
    const ctx = this.ctx, st = this.st, hk = ctx.hk, rr = riverResult(st);
    let q = 0, q0 = 0; for (const id in st.wings) { q += st.wings[id].q; q0 += st.wings[id].q0; }
    const side = { S_SCOUT: this.scoutsStopped > 0 && rr.markersExposed === 0, S_STAKES3: rr.markersActive === STAKES.length,
      S_X24: !!this.captured.X24, S_NOEXIT: this.phase >= 4 && this.escaped === 0 };
    const mainDone = this.main.filter(Boolean).length, sideDone = Object.values(side).filter(Boolean).length;
    const keSachList = KS_ORDER.filter((id) => st.ks[id]).map((id) => { const k = st.ks[id]; return { id, state: k.state, name: KE_SACH[id].name, word: KS_STATE_WORD[k.state], got: k.got, hk: KE_SACH[id].hk, why: k.why }; });
    return {
      // timeSec: giây đã chơi cộng dồn qua các lần thử lại (time tua về đầu pha khi tải lại — trước đây ghi kỷ lục nhanh hơn thật)
      won, why, battle: "B20", R: ctx.R, difficulty: ctx.diff.id, mode: this.mode, timeSec: this.playTime, clockSec: this.time, parSec: PAR_B20,
      missions: (mainDone / 6) * 0.8 + (sideDone / 4) * 0.2, missionsTotal: 6, sideTotal: 4, eventNames: {},
      qRatio: q0 ? q / q0 : 1, baseRatio: (Math.min(1, rr.escorts.down / FLEET.escorts[0]) + rr.markersActive / STAKES.length) / 2, ko: this.ko,
      hkRaw: hk.rawTotal, hkOptional: hk.optional,
      hkLog: { ...hk.log, ...Object.fromEntries(Object.entries(hk.script || {}).map(([k, v]) => [`${k} (đặt thẳng, điểm thanh)`, v])) },
      avgSK: this.skN ? this.skSum / this.skN : 50, bossDefeated: !!this.captured.X20, tpcCount: hk.tpcCount, chestCoins: 0, extraTT: 0,
      events: {}, orders: this.orders, items: 0, mainDone, sideDone, main: [...this.main], side,
      keSach: this.keSach.ratio(), keSachOk: rr.keSachOk, keSachList, river: rr,
      bossesMet: [...this.bossesMet], bossMet: this.bossesMet.includes("X20"), captured: { ...this.captured }, phaseTimes: [...this.phaseTimes],
      tpcLog: this.tpcLog || [],
    };
  }
}
const _W = { x: 0, y: 0, z: 0 }, _A = { x: 0, y: 0, z: 0 }, _B = { x: 0, y: 0, z: 0 };
