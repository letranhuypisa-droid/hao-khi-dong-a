// battles/b20.js — BattleDef của B20 Bạch Đằng (9/4/1288), đợt 9 pha D: trận thật (battle/director-b20.js) trên lớp thủy chiến
// (battle/naval.js), HUD riêng (battle/hud-b20.js), trời 6 pha (data/atmo-b20.js). Các móc theo danh sách ở đầu battles/b15.js.
// Đợt 20: pha 1 một lệnh "Ra khiêu chiến", pha 2–4 cảnh tua triều rút, ra đánh từ pha 5 (xem battle/director-b20.js).
//
// Dựng: thế giới world-b20 (địa hình khúc sông, nước theo Con nước, cảnh, hai cầu bến là boong) + Naval.install (mặt đất trận:
// độ cao lưới đang vẽ, boong, nước sâu không lội được, thân thuyền) → mô phỏng sim/river.js (createRiver: Tiết Chế +15% cửa sổ
// Kế Sách, Phụ Tử Chi Binh +20 Sĩ Khí cánh, Quyết sách đúng → "Kế đã định" trên bản đồ nhỏ) → Hào Khí mở màn 30, sàn 25 tới mốc đầu (VS: Vân Đồn
// coi như đã thắng) → tướng H31 xuất hiện trên thuyền chỉ huy nhẹ (director đặt lên boong) → DirectorB20.
// Mỗi khung: frameVisuals vẽ hạm đội (naval.render) và HUD riêng (director.frame → HudB20.update(hudState)).
// par Trận nhanh PAR_B20 (director-b20.js). debug: { state } — ảnh chụp trạng thái cho kịch bản; bot B20 là window.__objectiveB20 (js/debug.js).
// ?debug&battle=B20&phase=N (1..6): vào thẳng đầu pha N (director fastForward). ?debug&battle=B20&sandbox: NavalSandbox — sân thử
// lớp thủy chiến của D1 (thuyền chỉ huy nhẹ chạy, hộ vệ áp mạn, thuyền dò, bè cỏ, chiến thuyền + kỳ hạm ở khúc cọc, ván dốc, lầu
// kỳ hạm; window.__hk.sandbox, __hk.naval, __hk.tide(pct)).

import { zc, hw } from "../data/terrain-b20.js";
import { MAP, PHASES, SIDE_MISSIONS, KE_SACH, KS_ORDER, BOSSES, ALLY_GENERALS, STORY_INSERTS, HISTORY_NOTES, TIDE } from "../data/battle-b20.js";
import { buildWorldB20 } from "../battle/world-b20.js";
import { MODES } from "../data/tuning.js";
import { Naval } from "../battle/naval.js";
import { HULLS, BOAT } from "../battle/boats.js";
import { BigUnit } from "../battle/units.js";
import { DirectorB20, PAR_B20 } from "../battle/director-b20.js";
import { createRiver } from "../sim/river.js";
import { createHaoKhi } from "../sim/haokhi.js";
import { wireAtmoB20 } from "../data/atmo-b20.js";
import { wireHudB20 } from "../battle/hud-b20.js";
import { SKILLS } from "../data/heroes.js";
import { WINGS, HK_B20, BOSS_OPS } from "../data/battle-b20.js";

const TIDE0 = TIDE.p1.from;                              // Con nước lúc mở màn P1 (85%)
const PAR = PAR_B20;
const SANDBOX = typeof location !== "undefined" && /[?&]sandbox\b/.test(location.search);
// Sân thử: tướng trên bờ bắc dưới gò bản doanh. Trận thật: thuyền chỉ huy nhẹ ở điểm khiêu chiến (director đặt lên boong), nhìn
// ngược dòng về phía hạm đội.
const SPAWN_X = SANDBOX ? 600 : MAP.challenge.x, SPAWN_Z = SANDBOX ? Math.round(zc(600) - hw(600) - 24) : zc(MAP.challenge.x);


// ---- điều phối tối giản (nền của sân thử thủy chiến) --------------------------------------------------------------------------------------------------
// Đủ giao diện Director mà tướng, lính, HUD, bầu trời, vòng trận gọi (như ArenaDirector); không sinh địch. Trận thật: DirectorB20.
class DirectorB20Stub {
  constructor(ctx) {
    this.ctx = ctx; ctx.director = this;
    this.phase = 0; this.phaseStart = 0; this.time = 0; this.ko = 0; this.msgs = []; this.over = false; this.result = null;
    this.events = {}; this.generals = {}; this.pickups = []; this.keepers = {}; this.flags = []; this.followers = null;
    this.retries = 0; this.lastFront = null; this.mode = ctx.mode || "nhanh"; this.M = { ...MODES[this.mode], par: PAR };
    this.baseHint = "Bản giữ chỗ: đi thử khúc sông · Esc → Rút quân để về Doanh trại";
    this.keSach = { list: [], boats: [], bundles: [], hud: () => [], trigger: () => this.say("Kế Sách B20 chưa có ở bản giữ chỗ.", 2), update() {} };
    this.say("Trận Bạch Đằng đang dựng: chưa có hạm đội, Con nước, Kế Sách. Bản này để đi thử bản đồ — bờ, bãi bùn, cầu bến.", 9);
  }
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  update(dt) {
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    if (!this.over) this.time += dt;
  }
  basePos(id) { const v = this.ctx.world.bases[id]; return v ? { x: v.x, z: v.z, r: v.r } : null; }
  order() { this.say("Chưa có cánh quân để ra lệnh ở bản giữ chỗ.", 2); }
  tryTPC() {}
  fillActors() {}
  killActor() {}
  restoreCheckpoint() {
    const h = this.ctx.hero; this.ctx.naval?.leave(h); h.x = SPAWN_X; h.z = SPAWN_Z; h.alive = true; h.state = "free"; h.hp = h.maxHp;
    this.over = false; this.result = null; this.retries++;
  }
  lose(why = "Rút quân khỏi trận.") {
    if (this.over) return;
    this.over = true;
    this.result = { stub: true, battle: "B20", won: false, why, canRetry: false, R: this.ctx.R, difficulty: this.ctx.diff.id, mode: this.mode,
      timeSec: Math.round(this.time), ko: this.ko };
  }
  // móc từ tướng, lính, sĩ quan (không làm gì ở bản giữ chỗ)
  onSoldierKilled(a, opt) { if (a.side === "dich" && opt?.by === "hero") this.ko++; }
  onOfficerKilled() { this.ko++; }
  onBossDefeated() {}
  onOfficerAwake() {}
  onBreak() {}
  onHeroHit() {}
  onRevive() {}
  onUlt() {}
  onUltEnd() {}
  onArmyBuff() { this.say("Hịch Tướng Sĩ: bản giữ chỗ chưa có cánh quân để nhận Sĩ Khí.", 2); }
  onCounterBoss() {}
  onAllyGeneralDown() {}
  onHeroAction() {}
  ultQ() {}
  plantFlag(x, z, r) { this.ctx.fx.ring(x, z, r, 0xf1d98a, 0.8); }
  damageGate() {}
  onHeroDead() { const h = this.ctx.hero; h.alive = true; h.state = "free"; h.hp = h.maxHp; h.invuln = 2; this.say("Bản giữ chỗ: tướng không gục.", 2); }
}

// ---- SÂN THỬ LỚP THỦY CHIẾN (?debug&battle=B20&sandbox) ------------------------------------------------------------------
// Dựng: thuyền chỉ huy nhẹ (tướng + 6 quân ta) xuôi dòng 2 m/s; thuyền hộ vệ Nguyên áp mạn trái (ván bắc, 6 thủy thủ + Đội trưởng);
// thuyền dò luồng (4 + Đội trưởng); chiến thuyền J1 và kỳ hạm FS neo ở khúc cọc (thử mắc cạn, ván dốc, lầu + cầu thang); bè cỏ ở
// ba mốc (cảnh). Giữ X (hoặc D-pad xuống) để Tương tác: lên boong, chiếm thuyền, mở mốc, gọi đò. Không có pha, không thua.
// window.__hk.sandbox (kịch bản chụp màn hình): strand(), mud(), tower(), stair(), raft(id), knock(n), volley(n), capture(),
// place(boat, lx, lz), hold(sec), ferry(id). __hk.tide(pct) đổi con nước.
const SB = { tide: 85, speed: 2.0, x0: 150, x1: 470 };                  // ĐỀ XUẤT BẢN THỬ
class NavalSandbox extends DirectorB20Stub {
  constructor(ctx) {
    super(ctx);
    this.msgs.length = 0;
    this.baseHint = "Sân thử thủy chiến · giữ X: lên boong / chiếm thuyền / gọi đò · __hk.tide(%) đổi con nước";
    const nav = ctx.naval, w = ctx.world;
    w.setTide(SB.tide);
    const path = []; for (let x = SB.x0; x <= SB.x1; x += 40) path.push({ x, z: zc(x) + 6 });
    this.lead = nav.addBoat({ type: "lead", side: "ta", id: "lead", flag: "陳", path, speed: SB.speed, label: "Thuyền chỉ huy nhẹ" });
    // hộ vệ Nguyên song song, mạn trái (−x cục bộ của thuyền chỉ huy), cách mạn 2,6 m
    const e = this.escort = nav.addBoat({ type: "escort", side: "dich", id: "E1", flag: "元", label: "Thuyền hộ vệ" });
    const L = this.lead, off = -(HULLS.lead.beam / 2 + HULLS.escort.beam / 2 + 2.6), c = Math.cos(L.yaw), sn = Math.sin(L.yaw);
    e.x = L.x + off * c + 1.0 * sn; e.z = L.z - off * sn + 1.0 * c; e.yaw = L.yaw;
    this.link = nav.grapple(L, e);
    this.crewE = nav.spawnCrew(e, { n: 6, officer: true });
    this.crewL = nav.spawnCrew(L, { side: "ta", n: 6, role: "guard" });
    this.scout = nav.addBoat({ type: "scout", side: "dich", id: "S1", flag: "元", path: [{ x: 240, z: zc(240) + 30 }, { x: 460, z: zc(460) + 26 }], speed: 1.2, label: "Thuyền dò luồng" });
    this.crewS = nav.spawnCrew(this.scout, { n: 4, officer: true, kitMix: ["NG_CUNG", "NG_DAO"] });
    this.junk = nav.addBoat({ type: "junk", side: "dich", id: "J1", flag: "元", path: [{ x: 588, z: zc(588) - 22 }, { x: 600, z: zc(600) - 22 }], speed: 0, label: "Chiến thuyền Nguyên" });
    this.flag = nav.addBoat({ type: "flagship", side: "dich", id: "FS", flag: "元帥", path: [{ x: 640, z: zc(640) + 8 }, { x: 660, z: zc(660) + 8 }], speed: 0, label: "Kỳ hạm Ô Mã Nhi" });
    this.place(this.lead, 0, -2.2);
    this.holdT = 0;
    ctx.sandbox = this;
    this.say("Sân thử thủy chiến: đánh trên boong đang chạy, qua ván bắc sang thuyền hộ vệ, giữ X để lên boong / gọi đò.", 8);
  }
  // đặt tướng lên boong thuyền b (hoặc boong) ở toạ độ cục bộ (lx, lz)
  place(b, lx, lz) {
    const h = this.ctx.hero, D = b.deck ?? b, W = D.toWorld(lx, lz, {});
    h.x = W.x; h.z = W.z; h.state = "free"; this.ctx.naval.board(h, D); h.yaw = D.yaw; h.place(0);
    if (this.ctx.cam) this.ctx.cam.yaw = D.yaw + 0.6;
  }
  // mắc cạn ngay (bỏ 4 s lún): chiến thuyền, kỳ hạm — ván dốc tự bắc ở bước kế
  strand() {
    const env = this.ctx.naval._envNow();
    for (const b of [this.junk, this.flag]) if (b.state !== "stranded") { b.strand(); b.update(BOAT.settle + 0.01, env); }
    this.ctx.naval.update(0);
  }
  mud() {
    this.ctx.tide(0); this.strand();
    const h = this.ctx.hero, R = this.junk.ramp; this.ctx.naval.leave(h);
    const W = this.junk.deck.toWorld(R.xe + R.sg * 5, R.lz, {}); h.x = W.x; h.z = W.z; h.state = "free"; h.place(0);
    if (this.ctx.cam) this.ctx.cam.yaw = Math.atan2(this.junk.x - h.x, this.junk.z - h.z);
  }
  tower() { this.ctx.tide(0); this.strand(); this.place(this.flag, 0.6, -11.5); }
  stair() { this.ctx.tide(0); this.strand(); this.place(this.flag, 0.1, -1.5); }
  raft(id = "M1") { const R = this.ctx.naval.rafts.find((q) => q.id === id); this.place(R.deck, 0, 0); }
  // n thủy thủ thuyền hộ vệ bị hất văng ra phía ngoài mạn (rơi xuống nước → bơi vào bờ)
  knock(n = 3, side = 0) {           // side −1 / 1: văng ra mạn −x / +x của thuyền hộ vệ; 0: mạn gần người đó
    const crowd = this.ctx.crowd, e = this.escort, out = [];
    for (const a of this.crewE) {
      if (out.length >= n || !crowd.hittable(a) || a.deck !== e.deck) continue;
      const L = e.deck.toLocal(a.x, a.z, {}), sg = side || (L.x >= 0 ? 1 : -1), c = Math.cos(e.yaw), sn = Math.sin(e.yaw);
      crowd.damage(a, 1, { by: "hero", launch: true, kx: sg * c * 1.6, kz: -sg * sn * 1.6, knock: 4 }); out.push(a);
    }
    return out.length;
  }
  // loạt tên của lính Nguyên gần tướng nhất (≤ 4 người) bắn xuống mặt sông quanh tướng (tên dừng ở mặt nước, bắn tung nước)
  volley(n = 8, at = null, spread = 1) {
    const crowd = this.ctx.crowd, h = this.ctx.hero, d2 = (a) => (a.x - h.x) ** 2 + (a.z - h.z) ** 2;
    const shooters = crowd.agents.filter((a) => a.side === "dich" && crowd.hittable(a)).sort((a, b) => d2(a) - d2(b)).slice(0, 4);
    for (let i = 0; i < n && shooters.length; i++) {
      const a = shooters[i % shooters.length], ang = i * 2.39996, r = (at ? 1 + (i % 4) * 1.2 : 6 + (i % 4) * 2.5) * spread, c = at || h;
      crowd.fireArrow(a, { x: c.x + Math.sin(ang) * r, z: c.z + Math.cos(ang) * r }, true);
    }
  }
  // bắt sống: một tướng Nguyên (dáng tướng) đứng trên boong dưới kỳ hạm, bị bắt; quân ta cầm giáo đứng vây quanh
  capture() {
    const ctx = this.ctx, nav = ctx.naval, D = this.flag.deck, W = D.toWorld(0, 6, {});
    const u = new BigUnit(ctx, { kind: "boss", side: "dich", tier: "tuong", rigKey: "X24", name: "Phàn Tiếp", id: "X24", x: W.x, z: W.z, yaw: D.yaw, defeatMeans: "bị bắt", hpLockPct: 10 });
    ctx.units.push(u); nav.board(u, D); u.capture({ finisher: true });
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3 + 0.3, P = D.toWorld(Math.sin(a) * 2.6, 6 + Math.cos(a) * 2.6, {});
      const g = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", kit: "DV_GIAO", role: "follow", x: P.x, z: P.z, yaw: Math.atan2(W.x - P.x, W.z - P.z) });
      g.stun = 9999; nav.board(g, D);
    }
    return u;
  }
  hold(sec = 1.2) { this.holdT = sec; }
  ferry(id) { return this.ctx.naval.ferry(this.ctx.hero, id); }
  update(dt) {
    super.update(dt);
    const ctx = this.ctx, nav = ctx.naval;
    if (this.holdT > 0) this.holdT -= dt;
    const r = nav.interactStep(ctx.hero, !!ctx.input?.held?.interact || this.holdT > 0, dt);
    ctx.hud.prompt?.(r.item ? `Giữ X · ${r.item.label}` : null, r.p);
  }
}

// Ảnh chụp gọn trạng thái trận B20 (như __state của B15) cho kịch bản kiểm thử.
function stateB20(ctx) {
  const d = ctx.director, st = ctx.sim, h = ctx.hero;
  return { t: Math.round(d.time), phase: d.phase, hp: Math.round(h.hp), ki: Math.round(h.ki), hk: +ctx.hk.value.toFixed(1), tpc: ctx.hk.tpc,
    pos: [Math.round(h.x), Math.round(h.z)], deck: h.deck?.label ?? null, st: h.state, tide: +ctx.world.tidePct.toFixed(1), head: Math.round(st.fleet.headX),
    flot: Math.round(st.nghi.flotX), gap: +st.nghi.gap.toFixed(1), kk: Math.round(st.nghi.kk), stance: st.nghi.stance, launched: st.nghi.launched,
    ks: Object.values(st.ks).map((k) => `${k.id}:${k.state}:${k.got}`).join(" "), ko: d.ko,
    vg: d.vg.map((v) => v.state).join(","), raids: `${d.raidsCleared}/${d.raidsRepelled}`, tua: !!d.tua,
    agents: ctx.crowd.agents.length, units: ctx.units.length, boats: ctx.naval.boats.length, msgs: d.msgs.map((m) => m.text.replace(/<[^>]+>/g, "")).slice(-3),
    bosses: Object.values(d.bosses || {}).map((u) => `${u.id}:${Math.round(u.hp / u.maxHp * 100)}%${u.captured ? ":bắt" : u.broken > 0 ? ":vỡ" : ""}`).join(" "),
    x20: d.x20?.st ?? null, chained: !!d.chained, stranded: (d.stranded || []).length,
    over: d.over, res: d.result?.why };
}

// Cánh thủy quân (mô phỏng sim/river.js) làm "mặt trận" cho vòng Mệnh Lệnh (hud.js đổi cánh bằng Z)
const FRONTS_B20 = Object.fromEntries(Object.values(WINGS).map((w) => [w.id, { id: w.id, name: w.name }]));

export const B20 = {
  id: "B20", chapter: "B20", name: "Bạch Đằng",
  data: { MAP, PHASES, SIDE_MISSIONS, KE_SACH, KS_ORDER, BOSSES, ALLY_GENERALS, FRONTS: FRONTS_B20, EVENTS: {}, STORY_INSERTS, HISTORY_NOTES },
  preset: { level: 25 }, fixedR: 25,
  camFar: 2200,                                           // núi đá vôi xa ở ~1,75 km (world-b20 addSkyKit)
  rigs: ["H40", "X20", "X24"],                            // Nguyễn Khoái (từ pha 2), Ô Mã Nhi, Phàn Tiếp: làm nóng trước khung đầu (battle/gfx.js)
  openGates: () => ({}),
  heroSpawn: { x: SPAWN_X, z: SPAWN_Z, yaw: SANDBOX ? 0 : -Math.PI / 2 },
  camYaw: SANDBOX ? 0 : -Math.PI / 2,                     // trận thật: nhìn ngược dòng — thuyền chỉ huy, đoàn thuyền nhẹ, hạm đội phía sau
  camDist: 12,                                            // khúc sông rộng: camera dài hơn B15 một chút — đặt từ đầu (trước đây director.frame
                                                          // đặt ở khung đầu: lượt làm nóng, khung đầu ở 10,5 m rồi khung 2 giật lùi 1,4 m)
  par: { nhanh: PAR, chuan: PAR },
  outroSec: BOSS_OPS.outroSec,                            // cảnh kết: director kéo máy quay lên nhìn cả khúc sông (battle.js giữ màn thắng chờ)
controlsNote: "pha 1: nút Ra khiêu chiến (hoặc phím Kế Sách) một lần, đoàn thuyền nhẹ tự lái; cạnh boong khác giữ 1 s để lên boong, 0,4 s để gọi đò chuyển (1–4 hoặc chạm để chọn nơi đến, bấm lại Tương tác hoặc Né để đóng)",
  buildWorld(scene, { shadows, ctx }) {
    const world = buildWorldB20(scene, { shadows, tide: TIDE0 });
    Naval.install(ctx, world, { cap: 40, shadows });   // ctx.naval; ground: địa hình B20, boong, mặt nước (naval.js terrainB20)
    world.decks.active(SPAWN_X, SPAWN_Z);
    if (typeof location !== "undefined" && location.search.includes("debug")) ctx.tide = (pct) => world.setTide(pct);   // __hk.tide(pct)
    return world;
  },
  sim: {
    create: (ctx, stats, mode) => SANDBOX ? { t: 0, heroFront: null, fronts: {}, bases: {}, cooldowns: {}, reinf: null }
      : createRiver({ mode: mode || "nhanh", R: ctx.R, diff: ctx.diff?.id, quyetSachOk: !!ctx.quyetSach?.ok, mods: {
        ksWindow: stats.mods?.ksWindow || 0,                                          // Quốc Công Tiết Chế: cửa sổ Kế Sách +15%
        wingSk: ctx.heroDef?.trait === "phuTu" ? SKILLS.phuTu?.siKhiStart ?? 20 : 0,   // Phụ Tử Chi Binh: cánh mở màn +20 Sĩ Khí
        cmdCd: (ctx.heroDef?.cmdCd ?? 1) * (stats.mods?.cmdCdMult ?? 1) } }),
  },
  // Hào Khí mở màn 30, sàn 25 tới mốc đầu (canon VS; Trận nhanh ×1,3 và hệ số độ khó như mọi trận)
  createHaoKhi: (ctx, stats, diff, mode) => createHaoKhi({ quick: MODES[mode].hkQuick, start: HK_B20.start + (stats.mods?.hkStart || 0), floor: HK_B20.floor,
    gainPct: stats.mods?.hkPct || 0, decayMult: stats.mods?.hkDecay ?? 1, tpcExt: stats.mods?.tpcExt || 0, diffMult: diff.hk ?? 1 }),
  Director: SANDBOX ? NavalSandbox : DirectorB20,
  ambient: null,
  // vẽ hạm đội, ván bắc, ván dốc (naval.update chạy đầu mỗi bước mô phỏng), rồi HUD riêng của trận
  // (director.frame trước: nó có thể đặt lại máy quay — cảnh bắt sống, cảnh kết — rồi mới chọn LOD, làm mờ thuyền chắn theo máy quay cuối)
  frameVisuals(ctx, dt) {
    const d = ctx.director, h = ctx.hero;
    d?.frame?.(dt);
    ctx.naval?.render(ctx.camera, d?.seeTarget ? d.seeTarget() : h ? { x: h.x, y: h.y + 1.3, z: h.z } : null);
  },
  dispose(ctx) { ctx.hudB20?.dispose?.(); ctx.naval?.dispose(); },
  touch: { interact: true },
  debug: { state: stateB20 },                              // state: __state() của debug.js
};
wireAtmoB20(B20);                                         // atmo (6 pha), music (boss ở P6 và Tổng Phản Công), bed (khoảng cách tới địch)
wireHudB20(B20);                                          // bản đồ nhỏ khúc sông, ẩn bảng mặt trận
export default B20;
