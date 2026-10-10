// battle/director-b17.js — bộ điều phối B17 Tây Kết (bản thử đợt A1, greybox): luật thuần ở sim/b17.js, file này sinh lính, sĩ quan, Toa Đô, Hưng Đạo
// vương, hai cánh phục binh, dựng vật của trận (mốc cửa sông, vòng đấu trường), đổi sự kiện của luật thành băng chữ, Hào Khí, tiếng, và giữ giao diện
// director mà battle.js, hud.js, hero.js, hero-skills.js, crowd.js, units.js gọi (như director-b16.js): phase, time, over, result, msgs, events,
// keSach{list,hud,trigger}, pickups, flags, M, ko, objectives, blockers, damageGate, gateTarget, goalText, order / ringItems / ringTargets (phục binh),
// tryTPC, plantFlag, ultQ, lose, restoreCheckpoint, fillActors, các móc on*.
//
// Cánh Toa Đô: luật giữ quãng đã đi (col.s); Toa Đô và hai Đội trưởng đi theo điểm của mình bằng BigUnit.march (units.js, tùy chọn: đi cùng cánh, không ra
// đòn, vẫn nhận đòn), lính hộ tống (vai "squad") theo ô trong đội hình. Toa Đô giáp mặt tướng thì march = null (đánh như thường) tới khi luật thôi cho
// cánh dừng. Lệnh Kế Sách (G) chỉ đặt cờ inp.ksPress — luật quyết. Danh sách lính giữ { a, id } (crowd dùng lại lính chết, xem director-b16.js).
//
// Dựng trên đất Hàm Tử của B15 (battles/b17.js, cùng lớp phủ bùn, gò). Mọi số ở đây là ĐỀ XUẤT BẢN THỬ.

import * as THREE from "three";
import { BigUnit } from "./units.js";
import { heightAt } from "./world.js";
import { BannerQueue } from "./banner-queue.js";
import { flagTexture } from "./models.js";
import { gain, tick as hkTick, activate as hkActivate, tpcReady, milestone } from "../sim/haokhi.js";
import { HAO_KHI, TIERS, MODES, HERO } from "../data/tuning.js";
import { createB17, tickB17, sideB17, snapshotB17, restoreB17, along, routeS, columnHead, columnSpeed, secLeft, bedOf, BED_S, finish as simFinish } from "../sim/b17.js";
import { HUNG_DAO, ROUTE, MOUTH, COLUMN, OUTPOSTS, BEDS, AMBUSH, PHASES, KE_SACH, KS_ORDER, REINF, PAR_B17, BOSS_B17, REMNANTS, inRect } from "../data/battle-b17.js";

const COL = { ta: 0x9b2d20, dich: 0x2c3e55, gold: 0xf1d98a, ring: 0xffffff };
const RING_ITEMS = [
  { k: "theota", name: "Theo ta", icon: "theota" },
  { k: "xungtran", name: "Xung trận", icon: "tiencong" },
  { k: "giucho", name: "Giữ vững", icon: "giuvung" },
  { k: "tiepvien", name: "Gọi tiếp viện", icon: "tiepvien" },
];
// lính hộ tống: hàng dọc lộ trình so với đầu cánh (m, Toa Đô ở 0; âm là phía sau), 4 người mỗi hàng; kiểu lính cận chiến (không cung: phục binh
// nấp cách đường ~18 m, cung thủ tầm 16 m sẽ bắn lộ họ)
const ROWS = [4.5, -3.5, -6, -8.5, -11, -13.5];
const ESCORT_KITS = ["NG_DAO", "NG_GIAO", "NG_DAO", "NG_GIAO", "NG_DAO", "NG_TANK"];
const clone = (o) => JSON.parse(JSON.stringify(o));
const KS_WHY = { lo: "Toa Đô thấy bạn ở gần — phục binh bị lộ", canh: "phục binh không còn Giữ vững trong bãi", muon: "lỡ thời cơ" };

export class DirectorB17 {
  constructor(ctx) {
    this.ctx = ctx; ctx.director = this;
    this.mode = ctx.mode || "nhanh";
    this.st = createB17({ timeout: MODES[this.mode].timeout, ksWin: this.mode === "nhanh" ? 0.75 : 1 });
    this.phase = 0; this.time = 0; this.over = false; this.result = null; this.retries = 0;
    this.msgs = []; this.events = {}; this.pickups = []; this.flags = []; this.generals = {};
    this.M = { par: PAR_B17, timeout: this.st.timeout };
    this.ko = 0; this.koMs = 0; this.orders = 0; this.revived = false; this.counterBoss = 0;
    this.lastFront = null; this.baseHint = null; this.gateHit = null;
    this.bq = new BannerQueue((t, c, T) => ctx.fx.banner(t, c, T));
    const self = this;
    // Lệnh Kế Sách (G): chỉ đặt cờ, luật (sim/b17.js) xét trong bước kế. list: bot (debug.js) bấm G khi có mục "sansang".
    this.keSach = { get list() { return self.ksList(); }, hud: () => this.ksHud(), trigger: () => { this.inp.ksPress = true; } };
    this.reinf = { charges: REINF.charges, cd: 0 };
    ctx.sim.reinf = { charges: this.reinf.charges, pending: [] }; ctx.sim.cooldowns = {};
    this.ringTarget = "all"; this.wingOrder = "giucho";
    this.resetLists();
    // đầu vào luật mỗi bước (sim/b17.js tickB17): một đối tượng dùng lại, hàm gắn một lần
    this.inp = { hero: { x: 0, z: 0, alive: true }, engaged: false, bossHalf: false, bossDown: false, wingsHold: false, heroToBoss: 999, ksPress: false, pick: null,
      foesAt: (x, z, r) => this.foesAt(x, z, r) };
    this.props = new THREE.Group(); ctx.scene.add(this.props);
    this.buildProps();
    this.openGateA3();
    this.spawnHungDao();
    this.spawnPhase(0);
    this.say("Hưng Đạo vương ở bản doanh hỏi kế: đặt phục binh ở bãi lau nào?", 7);
    this.bq.push("TÂY KẾT", "#f1d98a", 1.6);
    ctx.audio.play("drum");
    this.saveCheckpoint();
  }

  // ---- tiện ích ---------------------------------------------------------------------------------------------------------------
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  banner(text, color = "#f1d98a", T = 1.2) { this.bq.push(text, color, T); }
  get hero() { return this.ctx.hero; }
  fmt(s) { return this.ctx.fmt ? this.ctx.fmt(s) : s; }
  hk(v, src, optional = false) { const g = gain(this.ctx.hk, v, src, { optional }); if (g && Math.abs(g) >= 0.5) this.ctx.hud?.hkPulse?.(g); return g; }
  alive(a) { return this.ctx.crowd.hittable(a); }
  ref(a, extra) { return { a, id: a.id, ...extra }; }
  live(r) { return r.a.id === r.id && this.alive(r.a); }
  liveCount(list) { let n = 0; for (const r of list) if (this.live(r)) n++; return n; }
  resetLists() {
    this.escorts = []; this.wings = [[], []]; this.outGuards = OUTPOSTS.map(() => []); this.scattered = []; this.keepers = OUTPOSTS.map(() => null);
    this.officers = []; this.boss = null;
  }
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  foesAt(x, z, r) {
    let n = 0;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a) && Math.hypot(a.x - x, a.z - z) < r) n++;
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && Math.hypot(u.x - x, u.z - z) < r + u.radius) n++;
    return n;
  }
  spawnEnemy(x, z, { role = "garrison", anchor = null, elite = 0.08, tx = x, tz = z, unit = null, kit = undefined } = {}) {
    const ctx = this.ctx;
    return ctx.crowd.spawn({ side: "dich", unit: unit || (ctx.rng.chance(0.25) ? "CUNGKY_NG" : "KHIEN_NG"), kit, tier: ctx.rng.chance(elite) ? "tinhnhue" : "thuong", role, front: null,
      x, z, sx: tx, sz: tz, yaw: Math.atan2(tx - x, tz - z), anchor });
  }
  // toán giữ chỗ: n lính quanh c trong vòng r, dây xích anchor r + pad
  spawnHold(c, n, r, { pad = 6, elite = 0.08 } = {}) {
    const rng = this.ctx.rng, out = [];
    for (let i = 0; i < n; i++) { const a = rng.range(0, Math.PI * 2), d = rng.range(1, r); out.push(this.spawnEnemy(c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, { anchor: { x: c.x, z: c.z, r: r + pad }, elite })); }
    return out;
  }
  spawnOfficer(tier, x, z, { awake = false, aggro = 22, name = null, kind = "officer", rigKey } = {}) {
    const u = new BigUnit(this.ctx, { kind, side: "dich", tier, name: name || `${TIERS[tier].name} Nguyên`, x, z, awake, aggro, ...(rigKey ? { rigKey } : {}) });
    u.home = { x, z }; u.retreatTo = { x: MOUTH.x, z: MOUTH.z };
    this.ctx.units.push(u);
    return u;
  }
  spawnHungDao() {
    const H = HUNG_DAO, ctx = this.ctx;
    const u = new BigUnit(ctx, { kind: "general", side: "ta", tier: "ally", rigKey: H.id, name: H.name, id: H.id, hp: H.hp, x: H.x, z: H.z, yaw: Math.PI * 0.6 });
    ctx.units.push(u); this.hungDao = u; this.generals[H.id] = u;
  }
  openGateA3() {
    const g = this.ctx.world.gates?.A3;                 // cổng bắc Hàm Tử quan: quân Nguyên giữ, mở sẵn cho cánh Toa Đô đi qua
    if (!g) return;
    this.ctx.openGates.A3 = true; g.broken = true;
  }

  // ---- vật của trận ----------------------------------------------------------------------------------------------------------
  ringMesh(c, r, color = COL.ring, op = 0.55) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 56), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(c.x, heightAt(c.x, c.z) + 0.14, c.z); this.props.add(m);
    return m;
  }
  flag(p, color, h = 7) {
    const g = new THREE.Group(), y = heightAt(p.x, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 6), new THREE.MeshLambertMaterial({ color: 0x4a3626 }));
    pole.position.y = h / 2; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    cloth.position.set(0.92, h - 0.7, 0); g.add(cloth);
    g.position.set(p.x, y, p.z); this.props.add(g); g.cloth = cloth;
    return g;
  }
  buildProps() {
    // mốc cửa sông: vòng đỏ, cờ Nguyên cao (đầu cánh tới đây là thua)
    this.mouthRing = this.ringMesh(MOUTH, MOUTH.r, 0xff5a3a, 0.6);
    this.mouthFlag = this.flag({ x: MOUTH.x + 2, z: MOUTH.z + 2 }, COL.dich, 10);
    // vòng đấu trường (P4: gò Toa Đô cố thủ), dựng khi đứng lại
    this.arenaRing = null;
    this.syncProps();
  }
  syncProps() {
    const st = this.st, w = this.ctx.world;
    OUTPOSTS.forEach((O, i) => {
      const o = st.outposts[i], v = w.bases?.[O.id];
      if (!v) return;
      if (v.ring) { v.ring.visible = !o.taken; v.ring.material.color.set(o.blockedRing ? 0xff5a3a : 0xffffff); }
      if (v.prog) { v.prog.visible = !o.taken && o.p > 0.005; w.setBaseProgress?.(O.id, o.p); }
      if (o.taken !== v._b17taken) { v._b17taken = o.taken; w.setBaseOwner?.(O.id, o.taken ? "ta" : "dich"); }
    });
    if (st.arena && !this.arenaRing) this.arenaRing = this.ringMesh(st.arena, 10, COL.gold, 0.5);
    if (this.arenaRing) this.arenaRing.visible = !!st.arena && st.phase >= 3 && !this.over;
  }

  // ---- sinh lính theo pha (cả khi tải lại điểm lưu) ----------------------------------------------------------------------------
  spawnPhase() {
    const st = this.st;
    OUTPOSTS.forEach((O, k) => { if (!st.outposts[k].taken) this.spawnOutpost(k); });
    if (!st.bossDown) this.spawnColumn();
    if (st.bed && st.phase < 4) this.spawnWings();
  }
  spawnOutpost(k) {
    const O = OUTPOSTS[k], gate = O.id === "A3", c = gate ? { x: O.x - 5, z: O.z } : O;   // đồn cổng: quân giữ đứng phía tây cổng (vòng chiếm vắt qua tường)
    this.outGuards[k] = this.spawnHold(c, O.garrison, gate ? 4 : O.r - 3, { pad: 8 }).map((a) => this.ref(a));
    this.keepers[k] = this.spawnOfficer(O.keeper, c.x - 2, c.z + 2, { aggro: 20, name: `${TIERS[O.keeper].name} giữ ${O.name.toLowerCase()}` });
  }
  spawnColumn() {
    const st = this.st, C = st.col, head = columnHead(st), at = C.stood && st.arena ? st.arena : head;
    const u = this.spawnOfficer("tuong", at.x, at.z, { kind: "boss", rigKey: BOSS_B17.rigKey, name: BOSS_B17.name, aggro: BOSS_B17.aggro });
    u.yaw = head.yaw; u.defeatMeans = null;
    this.boss = u; this.bossMet = true;
    this.officers = [];
    for (let k = 0; k < COLUMN.officers; k++) { const q = this.officerPoint(k); this.officers.push(this.spawnOfficer("doitruong", q.x, q.z, { aggro: 16, name: "Đội trưởng hộ tống" })); }
    const n = C.stood && C.standWhy === "broken" ? Math.ceil(COLUMN.escorts * (1 - AMBUSH.scatter)) : COLUMN.escorts;
    this.escorts = [];
    for (let k = 0; k < n; k++) {
      const q = this.slotPoint(k);
      this.escorts.push(this.ref(this.spawnEnemy(q.x, q.z, { role: "squad", unit: "KHIEN_NG", kit: ESCORT_KITS[k % ESCORT_KITS.length], elite: 0.12 }), { k }));
    }
    this.stepColumn();
  }
  // ô của lính hộ tống thứ k: theo lộ trình khi cánh đi; quanh gò khi đã đứng lại
  slotPoint(k) {
    const st = this.st;
    if (st.col.stood && st.arena) { const A = st.arena, ang = k * 2.39996, r = 5.5 + (k % 3) * 2.2; return { x: A.x + Math.cos(ang) * r, z: A.z + Math.sin(ang) * r }; }
    const row = Math.floor(k / 4), f = ROWS[row % ROWS.length] - Math.floor(row / ROWS.length) * 16, side = ((k % 4) - 1.5) * 2.4;
    const p = along(ROUTE, st.col.s + f);
    return { x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw: p.yaw };
  }
  officerPoint(k) {
    const st = this.st, side = k ? 3.8 : -3.8;
    if (st.col.stood && st.arena) return { x: st.arena.x + side, z: st.arena.z + 3 };
    const p = along(ROUTE, st.col.s - 1.5);
    return { x: p.x + Math.cos(p.yaw) * side, z: p.z - Math.sin(p.yaw) * side, yaw: p.yaw };
  }
  // phục binh: hai cánh trong bãi đã chọn, nấp ở chỗ (dây neo r 2: chỉ đánh kẻ tới gần chỗ nấp — crowd.js leashOk)
  spawnWings() {
    const st = this.st, B = bedOf(st.bed), ctx = this.ctx;
    if (!B) return;
    B.wings.forEach((w, i) => {
      if (this.liveCount(this.wings[i])) return;
      this.wings[i] = [];
      for (let k = 0; k < AMBUSH.wingN; k++) {
        const ang = k * 2.39996, rr = 0.8 + (k % 4) * 1.1, x = w.x + Math.cos(ang) * rr, z = w.z + Math.sin(ang) * rr;
        const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "squad", front: null, x, z, sx: x, sz: z, yaw: Math.atan2(B.x0 - x, -75 - z), legionMult: ctx.stats.legionMult ?? 1 });
        this.wings[i].push(this.ref(a, { w: i, post: { x, z } }));
      }
    });
    const K = st.ks.phucKich;
    if (K.state === "thanhcong" || K.state === "thatbai") this.setWingOrder("xungtran", true); else this.setWingOrder(this.wingOrder, true);
  }

  // ---- phục binh (vòng Mệnh Lệnh) ---------------------------------------------------------------------------------------------
  ringItems() { return RING_ITEMS; }
  ringTargets() { return [{ id: "all", name: this.wingsUp() ? `Phục binh · ${this.wingsUp()} người` : "Chưa có phục binh" }]; }
  ringHint() { return ""; }
  ringStatus(k) {
    if (k === "tiepvien") return `${this.reinf.charges} lượt${this.reinf.cd > 0 ? " · " + Math.ceil(this.reinf.cd) + "s" : ""}`;
    return this.wingOrder === k && this.wingsUp() ? "đang theo" : "";
  }
  wingsUp() { return this.liveCount(this.wings[0]) + this.liveCount(this.wings[1]); }
  pending() { const s = this.st.ks.phucKich.state; return s === "khadung" || s === "sansang"; }
  // đặt lệnh cho cả hai cánh. giucho: trước phục kích thì về chỗ nấp; sau đó giữ tại chỗ.
  setWingOrder(k, quiet = false) {
    this.wingOrder = k;
    const role = k === "theota" ? "follow" : k === "giucho" ? "squad" : "zone", B = bedOf(this.st.bed), o = k === "xungtran" ? this.chargePoint() : null;
    for (const list of this.wings) for (const r of list) {
      if (!this.live(r)) continue;
      const a = r.a; a.role = role; a.foe = null;
      if (k === "giucho" && this.pending() && B) { a.anchor = { x: B.wings[r.w].x, z: B.wings[r.w].z, r: 2 }; a.sx = r.post.x; a.sz = r.post.z; }
      else if (k === "giucho") { a.anchor = null; a.sx = a.x; a.sz = a.z; }
      else { a.anchor = null; if (o) { a.sx = o.x; a.sz = o.z; } }
    }
    if (!quiet) this.orders++;
  }
  chargePoint() { const u = this.boss; return u && u.alive && !u.dead ? { x: u.x, z: u.z } : this.st.arena || columnHead(this.st); }
  order(target, k) {
    const ctx = this.ctx;
    if (k === "tiepvien") {
      if (!this.st.bed) { this.say("Chưa đặt phục binh — chọn bãi lau ở bản doanh trước.", 3); return { ok: false }; }
      if (this.reinf.charges <= 0) { this.say("Hết lượt gọi tiếp viện.", 2.5); return { ok: false }; }
      if (this.reinf.cd > 0) { this.say(`Gọi tiếp viện đang hồi (${Math.ceil(this.reinf.cd)} s).`, 2.5); return { ok: false }; }
      this.reinf.charges--; this.reinf.cd = REINF.cd; ctx.sim.reinf.charges = this.reinf.charges;
      const B = bedOf(this.st.bed);
      for (let k2 = 0; k2 < REINF.n; k2++) {
        const i = k2 % 2, w = B.wings[i], ang = k2 * 2.39996, x = w.x + Math.cos(ang) * 4.5, z = w.z + Math.sin(ang) * 4.5;
        const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "squad", front: null, x, z, sx: x, sz: z, legionMult: ctx.stats.legionMult ?? 1 });
        this.wings[i].push(this.ref(a, { w: i, post: { x, z } }));
      }
      this.setWingOrder(this.wingOrder, true);
      this.say(`Thêm ${REINF.n} quân vào hai cánh phục binh.`, 3, "good"); ctx.audio.play("horn"); this.orders++;
      return { ok: true };
    }
    if (!this.wingsUp()) { this.say("Chưa có phục binh — chọn bãi lau ở bản doanh trước.", 3); return { ok: false }; }
    this.setWingOrder(k);
    const name = RING_ITEMS.find((o) => o.k === k).name;
    this.say(`Phục binh: ${name}.${k !== "giucho" && this.pending() ? " (Phục kích cần cả hai cánh Giữ vững trong bãi.)" : ""}`, 3, k === "giucho" || !this.pending() ? "good" : "bad");
    ctx.audio.play("drum");
    return { ok: true };
  }
  // hai cánh đang Giữ vững trong bãi (mỗi cánh ≥ holdMin người trong bãi nới pad m)
  wingsHold() {
    const B = bedOf(this.st.bed);
    if (!B || this.wingOrder !== "giucho") return false;
    const R = { x0: B.x0 - AMBUSH.pad, x1: B.x1 + AMBUSH.pad, z0: B.z0 - AMBUSH.pad, z1: B.z1 + AMBUSH.pad };
    return this.wings.every((list) => { let n = 0; for (const r of list) if (this.live(r) && inRect(R, r.a.x, r.a.z)) n++; return n >= AMBUSH.holdMin; });
  }

  // ---- Kế Sách (Phục kích bãi lau — sim/b17.js) ----------------------------------------------------------------------------------
  ksList() { const K = this.st.ks.phucKich; return [{ id: "phucKich", state: K.state }]; }
  ksHud() {
    const st = this.st;
    return KS_ORDER.map((id) => {
      const K = KE_SACH[id], s = st.ks[id], B = bedOf(st.bed);
      const word = s.state === "thanhcong" ? "Thành công" : s.state === "thatbai" ? `Thất bại · ${KS_WHY[s.why] || ""}`
        : s.state === "sansang" ? this.fmt(`Còn ${Math.ceil(s.left)} s · {kesach}`)
        : !B ? "Chọn bãi lau ở bản doanh" : st.col.stood ? "Không kịp dùng" : `Chờ ở ${B.name} · phục binh ${this.wingsHold() ? "giữ vững" : "chưa giữ vững"}`;
      return { id, state: s.state, quyMo: K.quyMo === "lon" ? "Lớn" : "Nhỏ", name: K.name, word, detail: K.text, got: s.state === "thanhcong" ? K.hk : 0, hk: K.hk, label: K.label };
    });
  }

  // ---- Tổng Phản Công, cờ, Tuyệt Kỹ -------------------------------------------------------------------------------------------
  tryTPC() {
    const ctx = this.ctx, h = this.hero;
    if (ctx.hk.tpc) return false;
    if (!tpcReady(ctx.hk)) { this.say(`Hào Khí ${Math.floor(ctx.hk.value)}/100 — chưa đủ để kích Tổng Phản Công.`, 2); return false; }
    const T = hkActivate(ctx.hk);
    h.hkUltReady = true; this.plantFlag(h.x, h.z, 30, 0.3, T, true);
    ctx.cinematic?.("TỔNG PHẢN CÔNG", h, true); ctx.audio.play("drums3"); ctx.audio.play("horn");
    ctx.crowd.rout(h.x, h.z, 14, (e) => e.tier === "thuong");
    return true;
  }
  plantFlag(x, z, r, atk, dur, quiet = false) {
    const g = new THREE.Group(), y = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 6), new THREE.MeshLambertMaterial({ color: 0x4a3626 })); pole.position.y = 2.5; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.4), new THREE.MeshLambertMaterial({ map: flagTexture("破強敵報皇恩"), side: THREE.DoubleSide }));
    cloth.position.set(0.45, 3.6, 0); g.add(cloth); g.position.set(x, y, z); this.props.add(g);
    this.flags.push({ x, z, r, atk, t: dur, g });
    this.ctx.fx.ring(x, z, r, COL.gold, 0.8);
    if (!quiet) { this.ctx.audio.play("drum"); this.say(`Cắm cờ: quân ta trong ${r} m Công +${Math.round(atk * 100)}% trong ${dur} s.`, 3, "good"); }
  }
  dropProp(g) {
    this.props.remove(g);
    g.traverse((m) => { m.geometry?.dispose(); const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : []; for (const x of mats) { x.map?.dispose(); x.dispose(); } });
  }
  updateFlags(dt) {
    for (const f of this.flags) { f.t -= dt; if (f.t <= 0) this.dropProp(f.g); }
    this.flags = this.flags.filter((f) => f.t > 0);
    const h = this.hero; h.buffs.flag = this.flags.find((f) => this.dist(h, f) < f.r)?.atk ?? 0;
  }
  ultQ() {}
  onUlt() {}
  onUltEnd() {}

  // ---- mục tiêu cho HUD --------------------------------------------------------------------------------------------------------
  objectivePoint() { const o = this.objectives()[0]; return o ? { x: o.x, z: o.z } : null; }
  // chỗ chờ khi phục kích còn treo: sau chỗ Toa Đô vào bãi 60 m dọc đường (ngoài 40 m lúc ông bước vào)
  waitPoint() { const B = bedOf(this.st.bed); if (!B || BED_S[B.id] == null) return null; const p = along(ROUTE, BED_S[B.id] + 60); return { x: p.x, z: p.z }; }
  objectives() {
    const st = this.st, P = (id, label, p, r) => ({ id, label, x: p.x, y: heightAt(p.x, p.z), z: p.z, r });
    if (this.over) return [];
    if (st.phase === 0) return [P("H31", "Hưng Đạo vương · chọn bãi lau", HUNG_DAO, 5)];
    const u = this.boss, bossP = u && u.alive && !u.dead ? P("X19", BOSS_B17.name, u, 6) : null;
    if (st.phase === 4) return [P("tan", "Tàn quân", st.arena || this.hero, REMNANTS.r * 0.4)];
    if (st.phase === 3) return bossP ? [bossP] : [];
    const K = st.ks.phucKich;
    if (K.state === "sansang") return bossP ? [{ ...bossP, label: this.fmt("Toa Đô trong bãi lau · {kesach}") }] : [];
    const k = st.outposts.findIndex((o) => !o.taken);
    if (k >= 0) return [P(OUTPOSTS[k].id, OUTPOSTS[k].name, OUTPOSTS[k], OUTPOSTS[k].r)];
    if (K.state === "khadung" && st.bed && !st.col.entered) { const w = this.waitPoint(); if (w) return [P("cho", "Chờ phục kích · đứng xa Toa Đô", w, 6)]; }
    return bossP ? [bossP] : [];
  }
  // vòng chiếm đang đứng trong (đồn chưa hạ) → { c, r } | null
  heldRing() {
    const st = this.st, h = this.hero;
    for (let i = 0; i < OUTPOSTS.length; i++) { const O = OUTPOSTS[i]; if (!st.outposts[i].taken && this.dist(h, O) <= O.r) return { c: O, r: O.r }; }
    return null;
  }
  // Nhãn thứ hai của HUD (như B16): còn ≤ 4 địch chặn vòng tướng đang đứng → con gần nhất
  blockers() {
    const R = this.heldRing(); if (!R) return [];
    const crowd = this.ctx.crowd, h = this.hero, list = [];
    for (const a of crowd.agents) if (a.side === "dich" && crowd.hittable(a) && this.dist(a, R.c) < R.r) list.push(a);
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && this.dist(u, R.c) < R.r + u.radius) list.push(u);
    if (!list.length || list.length > 4) return [];
    const a = list.sort((p, q) => this.dist(p, h) - this.dist(q, h))[0];
    const label = a.isBig ? `${a.name} còn chặn` : a.unit === "CUNGKY_NG" ? "Cung kỵ còn chặn" : "Lính Nguyên còn chặn";
    return [{ id: "chan", label, x: a.x, y: heightAt(a.x, a.z), z: a.z, r: 2, ref: a }];
  }

  // ---- cổng (B17 không phá cổng: cổng bắc mở sẵn, cổng nam không dùng) ------------------------------------------------------
  damageGate(id) {
    if (this.ctx.openGates[id]) return;
    this.gateNag = (this.gateNag || 0) + 1;
    if (this.gateNag % 20 === 1) this.say("Không cần phá cổng này — cánh Toa Đô đi qua cổng bắc đang mở.", 3);
  }
  gateTarget() { return null; }
  goalText(short = false) {
    const st = this.st;
    if (st.phase !== 1 && st.phase !== 2) return null;
    const pct = Math.round((st.col.s / st.col.len) * 100);
    return short ? `Cánh Toa Đô ${pct}% đường` : `Cánh Toa Đô đã đi ${pct}% đường ra biển · đồn ${st.taken}/3`;
  }

  // ---- vòng lặp ------------------------------------------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, st = this.st, h = this.hero;
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    this.bq.update(dt);
    if (this.over) return;
    this.time += dt;
    this.reinf.cd = Math.max(0, this.reinf.cd - dt);
    if (hkTick(ctx.hk, dt)) this.say("Tổng Phản Công kết thúc.", 3);
    const ms = milestone(ctx.hk);
    if (ms > (this.lastMs || 0) && ms < 100) { this.banner(`HÀO KHÍ ${ms}`, "#f1d98a", 1); ctx.audio.play("drum"); }
    if (ms === 100 && this.lastMs !== 100) { this.banner("TỔNG PHẢN CÔNG SẴN SÀNG · {TPC}", "#ffd27a", 1.8); ctx.audio.play("drums3"); }
    this.lastMs = ms;

    this.stepPicker();
    const I = this.inp, u = this.boss, bossUp = !!u && u.alive && !u.dead;
    I.hero.x = h.x; I.hero.z = h.z; I.hero.alive = h.alive;
    I.heroToBoss = bossUp ? this.dist(h, u) : this.dist(h, columnHead(st));
    I.engaged = bossUp && h.alive && I.heroToBoss < COLUMN.engageR;
    I.bossHalf = bossUp && !!u.hpLocked; I.bossDown = !!this.bossDown;
    I.wingsHold = st.bed ? this.wingsHold() : false;
    const ev = tickB17(st, I, dt);
    I.ksPress = false; I.pick = null;
    this.phase = st.phase;
    this.onEvents(ev);
    if (this.over) return;
    this.stepColumn();
    this.stepWings(dt);
    this.updateFlags(dt);
    ctx.hud?.prompt?.(st.prompt ? st.prompt.text : st.ks.phucKich.state === "sansang" ? this.fmt(`Phục kích! {Act:kesach} · còn ${Math.ceil(st.ks.phucKich.left)} s`) : null,
      st.prompt?.p ?? (st.ks.phucKich.state === "sansang" ? st.ks.phucKich.left / st.ks.phucKich.window : 0));
    this.baseHint = this.hint();
    this.syncProps();
    this.topWidget();
  }
  // P1: bảng chọn bãi lau mở khi tướng đứng gần Hưng Đạo vương (đồng hồ trận ×0,2 khi bảng mở — hud.js); đi xa thì đóng
  stepPicker() {
    const hud = this.ctx.hud, h = this.hero;
    if (!hud?.picker) return;
    const want = this.st.phase === 0 && h.alive && this.dist(h, HUNG_DAO) < 16;
    if (want && !hud.pickerOpen) {
      this.pickerMine = true;
      hud.picker(BEDS.map((B) => ({ id: B.id, label: B.name, sub: B.sub, icon: "giuvung" })), (it) => this.pickBed(it.id), "Hưng Đạo vương: đặt phục binh ở đâu?");
    } else if (!want && hud.pickerOpen && this.pickerMine) { this.pickerMine = false; hud.picker(null); }
  }
  // chọn bãi (bảng chọn, hoặc bot): luật nhận ở bước kế
  pickBed(id) {
    if (this.st.phase !== 0 || !bedOf(id)) return false;
    this.inp.pick = id;
    if (this.ctx.hud?.pickerOpen && this.pickerMine) { this.pickerMine = false; this.ctx.hud.picker(null); }
    return true;
  }
  // Toa Đô, sĩ quan, lính hộ tống theo cánh
  stepColumn() {
    const st = this.st, C = st.col, u = this.boss, head = columnHead(st), v = C.halt ? 0 : columnSpeed(st);
    if (u && u.alive && !u.dead) {
      if (!C.stood) {
        u.floorPct = COLUMN.floorPct; u.home = { x: head.x, z: head.z };
        u.march = C.fight ? null : { x: head.x, z: head.z, v, yaw: head.yaw };
      } else {
        u.floorPct = 0; u.march = null; u.awake = true;
        if (st.arena) { u.home = { x: st.arena.x, z: st.arena.z }; u.leash = COLUMN.standLeash; }
      }
    }
    const h = this.hero;
    this.officers.forEach((o, k) => {
      if (!o.alive || o.dead) return;
      const q = this.officerPoint(k);
      o.home = { x: q.x, z: q.z }; o.leash = C.stood ? COLUMN.standLeash : 25;
      if (C.stood) { o.march = null; o.awake = true; return; }
      o.march = h.alive && o.awake && this.dist(o, h) < 10 ? null : { x: q.x, z: q.z, v, yaw: q.yaw };
    });
    for (const r of this.escorts) {
      if (!this.live(r) || r.a.fleeT > 0) continue;
      const q = this.slotPoint(r.k); r.a.sx = q.x; r.a.sz = q.z;
    }
  }
  stepWings(dt) {
    if (this.wingOrder === "xungtran" && (this.aimT = (this.aimT || 0) - dt) <= 0) {
      this.aimT = 1; const o = this.chargePoint();
      for (const list of this.wings) for (const r of list) if (this.live(r)) { r.a.sx = o.x; r.a.sz = o.z; }
    }
    // lính hộ tống tán loạn: chạy xa rồi bỏ khỏi trận
    if (this.scattered.length) {
      const h = this.hero;
      this.scattered = this.scattered.filter((r) => {
        if (!this.live(r)) return false;
        if (this.dist(r.a, h) > 45 && Math.hypot(r.a.x - r.a.sx, r.a.z - r.a.sz) < 8) { this.ctx.crowd.release(r.a); return false; }
        return true;
      });
    }
  }
  hint() {
    const st = this.st, h = this.hero;
    const i = OUTPOSTS.findIndex((O, k) => !st.outposts[k].taken && this.dist(h, O) <= O.r);
    if (i >= 0) { const O = OUTPOSTS[i], o = st.outposts[i]; return o.blockedRing ? `${O.name}: dẹp quân giữ đồn trong vòng` : `${O.name}: chiếm đồn · còn ${secLeft(o, O.capSec)} s`; }
    if (st.phase === 0) return `Chọn bãi lau phục kích · còn ${Math.max(0, Math.ceil(AMBUSH.pickSec - st.phaseT))} s`;
    const K = st.ks.phucKich;
    if (K.state === "sansang") return this.fmt(`Phục kích: {kesach} · còn ${Math.ceil(K.left)} s`);
    if (st.phase === 1) {
      const B = bedOf(st.bed), near = K.state === "khadung" && B && BED_S[B.id] != null && BED_S[B.id] - st.col.s < 60;
      if (near && this.inp.heroToBoss < AMBUSH.revealR + 10) return `Toa Đô sắp vào ${B.name}: lùi xa ông ngoài 40 m`;
      return null;                                                            // goalText: % đường, số đồn
    }
    if (st.phase === 2) return "Đánh Toa Đô xuống nửa Sinh lực để chặn cánh";
    if (st.phase === 3) return st.col.standWhy === "broken" ? "Đội hình Nguyên vỡ — hạ Toa Đô trên gò" : "Toa Đô cố thủ trên gò — hạ ông";
    if (st.phase === 4) return `Dẹp tàn quân · còn ${Math.max(0, Math.ceil(REMNANTS.sec - st.phaseT))} s`;
    return null;
  }
  // thanh "Đường ra biển" dưới Hào Khí: % đường, vạch 3 đồn (đỏ khi ta đã hạ) và bãi lau đã chọn, trạng thái cánh
  topWidget() {
    const hud = this.ctx.hud, st = this.st, C = st.col;
    if (!hud?.setTopWidget) return;
    if (st.phase === 0 || C.stood || this.over) { hud.setTopWidget(null); return; }
    const pc = (s) => Math.max(0, Math.min(100, (s / C.len) * 100)).toFixed(1), B = bedOf(st.bed);
    const ticks = OUTPOSTS.map((O, i) => `<i style="position:absolute;left:${pc(routeS(ROUTE, O))}%;top:-3px;width:3px;height:14px;background:${st.outposts[i].taken ? "#c0392b" : "#3d5a78"}"></i>`).join("")
      + (B && BED_S[B.id] != null ? `<i style="position:absolute;left:${pc(BED_S[B.id])}%;top:-2px;height:12px;width:${(70 / C.len * 100).toFixed(1)}%;background:rgba(110,140,62,.55)"></i>` : "");
    const halt = C.halt === "engage" ? "dừng giao chiến" : C.halt === "outpost" ? "bị đồn ta chặn" : "đang đi";
    const html = `<div style="display:flex;align-items:center;gap:6px"><b>Đường ra biển</b><div style="position:relative;width:170px;height:8px;background:rgba(0,0,0,.45);border:1px solid rgba(241,217,138,.5);border-radius:4px">`
      + `<i style="position:absolute;left:0;top:0;bottom:0;width:${Math.round(C.s / C.len * 100)}%;background:#d0864a;border-radius:3px"></i>${ticks}</div><small>${halt} · tốc ×${C.mult.toFixed(2).replace(".", ",")}</small></div>`;
    hud.setTopWidget(html);
  }

  // ---- sự kiện luật → trận --------------------------------------------------------------------------------------------------
  onEvents(ev) {
    const ctx = this.ctx, st = this.st;
    for (const e of ev) {
      if (e.type === "bedPicked") {
        const B = bedOf(e.bed);
        this.say(e.auto ? `Hết giờ bàn kế: phục binh đặt ở ${B.name}.` : `Phục binh đặt ở ${B.name}. Giữ họ Giữ vững; khi Toa Đô tới gần bãi thì đứng xa ông ngoài 40 m.`, 6, "good");
        this.spawnWings();
      } else if (e.type === "phase") {
        const P = PHASES[e.phase];
        if (e.phase > 1) this.hk(HAO_KHI.src.mainMission, "nhiệm vụ chính");
        this.banner(`${P.id} · ${P.name.toUpperCase()}`, "#e6dcc3", 2); ctx.audio.play("drums3");
        if (e.phase === 1) this.say(`${BOSS_B17.name} kéo cánh quân dọc đường đê ra cửa sông. Hạ 3 đồn để làm chậm cánh.`, 6);
        if (e.phase === 2) this.say(this.fmt("Toa Đô đã vào bãi lau! {Act:kesach} để phục binh đánh úp."), 5);
        if (e.phase === 3) this.say("Toa Đô từ chối rút, lên gò cố thủ. Hạ ông!", 6);
        if (e.phase === 4) this.say("Toa Đô tử trận. Dẹp tàn quân quanh gò.", 6);
        this.phase = e.phase;
        this.saveCheckpoint();
      } else if (e.type === "outpostTaken") {
        const O = OUTPOSTS.find((o) => o.id === e.id);
        this.hk(O.hk, "hạ " + O.name); ctx.audio.play("cheer");
        this.banner(`HẠ ${O.name.toUpperCase()} · ${e.n}/3`, "#f1d98a", 1.4);
        this.say(`Cánh Toa Đô chậm lại: tốc ×${st.col.mult.toFixed(2).replace(".", ",")}.`, 4, "good");
      } else if (e.type === "outpostBlock") {
        const O = OUTPOSTS.find((o) => o.id === e.id);
        this.say(`${O.name} của ta chặn đường: cánh Toa Đô phải dừng 15 giây.`, 4, "good");
      } else if (e.type === "engage") {
        if (!this.engagedOnce) { this.engagedOnce = true; this.say("Toa Đô dừng cánh để đánh bạn — chỉ giữ được ông tối đa 20 giây mỗi lượt.", 5); }
      } else if (e.type === "engageEnd") {
        this.say("Toa Đô bỏ giao chiến, thúc cánh đi tiếp!", 3.5, "bad"); ctx.audio.play("horn", this.boss?.x, this.boss?.z);
      } else if (e.type === "bedEnter") {
        this.banner("TOA ĐÔ VÀO BÃI LAU", "#e6dcc3", 1.4);
      } else if (e.type === "ksOpen") {
        this.banner("PHỤC KÍCH · {KESACH}", "#ffd27a", 1.8); ctx.audio.play("horn");
      } else if (e.type === "ksIdle") {
        this.say(e.state === "khadung" ? "Lệnh Kế Sách: chờ Toa Đô vào bãi lau có phục binh." : "Kế Sách Phục kích bãi lau đã dùng.", 3);
      } else if (e.type === "keSach") {
        const K = KE_SACH[e.id];
        if (e.ok) {
          this.hk(K.hk, "Kế Sách " + K.name); this.banner(`KẾ SÁCH · ${K.name.toUpperCase()}`, "#ffd27a", 1.8); ctx.audio.play("horn"); ctx.audio.play("drums3");
          this.say("Phục binh đánh úp: đội hình Nguyên vỡ, một nửa lính hộ tống tán loạn!", 5, "good");
          this.scatterEscorts();
        } else this.say(`Kế Sách ${K.name}: không thành — ${KS_WHY[e.why] || "lỡ thời cơ"}. Phục binh vẫn xông ra đánh.`, 5, "bad");
        this.setWingOrder("xungtran", true);
      } else if (e.type === "stand") {
        this.banner(e.why === "broken" ? "ĐỘI HÌNH NGUYÊN VỠ" : "TOA ĐÔ ĐỨNG LẠI", "#ff8a6a", 1.6);
        if (e.why === "half") this.say("Toa Đô núng thế, thôi đẩy cánh: ông lên gò gần nhất cố thủ.", 5, "good");
      } else if (e.type === "win") this.win(e.why);
      else if (e.type === "lose") this.lose(e.why, true);
    }
  }
  // đội hình vỡ: một nửa lính hộ tống còn đứng bỏ chạy về phía sông rồi rời trận
  scatterEscorts() {
    const live = this.escorts.filter((r) => this.live(r)), ids = new Set(), keep = [];
    live.forEach((r, i) => {
      if (i % 2 === 0) { ids.add(r.id); r.a.role = "squad"; r.a.sx = r.a.x + (r.a.x < 462 ? -30 : 20); r.a.sz = -168; this.scattered.push(r); }
      else keep.push(r);
    });
    this.escorts = keep;
    if (live.length) this.ctx.crowd.rout(live[0].a.x, live[0].a.z, 60, (a) => ids.has(a.id));
  }

  // ---- móc từ lính, sĩ quan, tướng ---------------------------------------------------------------------------------------------
  onSoldierKilled(a, opt) {
    if (a.side !== "dich" || opt.by !== "hero") return;
    this.ko++;
    if (this.ko % HAO_KHI.src.koMilestoneEvery === 0 && this.koMs < HAO_KHI.src.koMilestoneCap) { this.koMs++; this.hk(HAO_KHI.src.koMilestone, "mốc KO"); }
  }
  onOfficerKilled(u) {
    const ctx = this.ctx;
    if (u.tier === "doitruong") this.hk(HAO_KHI.src.killCaptain, "hạ đội trưởng");
    if (u.tier === "photuong") this.hk(HAO_KHI.src.killVice, "hạ phó tướng");
    this.ko++;
    ctx.fx.banner(`ĐÃ HẠ ${TIERS[u.tier].name.toUpperCase()}`, "#e6dcc3", 1.2);
    ctx.slowmo?.(0.55, 0.28); ctx.fx.flash(0.4); ctx.audio.play("finisher", u.x, u.z); ctx.audio.play("cheer");
  }
  onOfficerAwake(u) { if (u === this.boss && !this.bossRoared) { this.bossRoared = true; this.ctx.fx.banner("TOA ĐÔ", "#ff8a6a", 1.4); this.ctx.audio.play("horn"); } }
  // Toa Đô về 0 Sinh lực: tử trận (canon "bị giết"). Bản thử A1 dùng nhánh ngã của sĩ quan (BigUnit.dead: khuỵu, gục, rồi gỡ) thay cho rút chạy;
  // clip death, camera lùi xa là đợt A2. Không máu me, không thủ cấp (canon B17.sensitivity).
  onBossDefeated(u) {
    if (u !== this.boss) return;
    u.retreating = false; u.dead = 0.001; u.march = null;
    if (this.hero.lock === u) this.hero.lock = null;
    this.bossDown = true; this.ko++;
    this.bq.clear(); this.ctx.fx.banner("TOA ĐÔ TỬ TRẬN", "#f1d98a", 2.4); this.ctx.audio.play("drums3");
    this.ctx.crowd.rout(u.x, u.z, 24);
    this.hk(15, "hạ Toa Đô");
  }
  onCaptured(u) { this.onBossDefeated(u); }
  onCounterBoss() { if (this.counterBoss < HAO_KHI.src.counterBossMax) { this.counterBoss++; this.hk(HAO_KHI.src.counterBoss, "phản đòn Toa Đô"); } }
  onBreak(u) { this.ctx.fx.banner("VỠ THẾ · ĐÒN MẠNH ĐỂ RA ĐÒN QUYẾT", "#ffd27a", 1.2); this.ctx.audio.play("parry", u.x, u.z); }
  onHeroHit() {}
  onHeroAction() {}
  onRevive() { this.hk(HAO_KHI.src.reviveUsed, "gượng dậy"); this.revived = true; }
  onHeroDead() { if (!this.over) this.lose("Trần Quốc Toản gục ngã.", true); }
  onAllyGeneralDown(u) { if (u === this.hungDao) this.say("Hưng Đạo vương bị thương, lui vào trong bản doanh.", 4, "bad"); }
  killActor() {}
  fillActors() {}

  // ---- điểm lưu đầu pha, thắng thua --------------------------------------------------------------------------------------------
  saveCheckpoint() {
    const ctx = this.ctx, h = this.hero;
    this.checkpoint = { st: snapshotB17(this.st), time: this.time, hk: clone(ctx.hk), ko: this.ko, koMs: this.koMs, revived: this.revived, counterBoss: this.counterBoss,
      reinf: { ...this.reinf }, wingOrder: this.wingOrder, hero: { hp: h.hp, ki: h.ki, revives: h.revives, x: h.x, z: h.z } };
  }
  restoreCheckpoint() {
    const ctx = this.ctx, c = this.checkpoint, h = this.hero;
    for (const a of [...ctx.crowd.agents]) ctx.crowd.release(a);
    for (const u of ctx.units) if (u.alive) u.dispose();
    ctx.units.length = 0; this.resetLists();
    for (const f of this.flags) this.dropProp(f.g); this.flags = [];
    restoreB17(this.st, c.st); Object.assign(ctx.hk, clone(c.hk));
    this.bossDown = this.st.bossDown; this.counterBoss = c.counterBoss ?? 0; this.wingOrder = c.wingOrder || "giucho";
    this.phase = this.st.phase; this.time = c.time; this.ko = c.ko; this.koMs = c.koMs; this.revived = c.revived; this.reinf = { ...c.reinf };
    ctx.sim.reinf.charges = this.reinf.charges;
    this.inp.ksPress = false; this.inp.pick = null;
    h.alive = true; h.state = "free"; h.hp = Math.max(c.hero.hp, h.maxHp * HERO.retryHp); h.ki = c.hero.ki; h.revives = c.hero.revives; h.x = c.hero.x; h.z = c.hero.z; h.invuln = 2; h.lock = null;
    this.over = false; this.result = null; this.retries++;
    this.openGateA3();
    this.spawnHungDao();
    this.spawnPhase(this.st.phase);
    this.syncProps(); this.bq.clear();
    this.say(`Tải lại đầu pha ${PHASES[this.st.phase].id}.`, 3);
  }
  win(why) {
    if (this.over) return;
    this.over = true; this.ctx.hud?.prompt?.(null); this.ctx.hud?.setTopWidget?.(null);
    this.result = this.buildResult(true, why || "Quân Trần thắng ở Tây Kết.");
    this.bq.push("THẮNG TRẬN TÂY KẾT", "#f1d98a", 2); this.ctx.audio.play("victory");
  }
  lose(why, canRetry = true) {
    if (this.over) return;
    if (!this.st.over) simFinish(this.st, false, why);
    this.over = true; this.ctx.hud?.prompt?.(null); this.ctx.hud?.setTopWidget?.(null);
    if (this.ctx.hud?.pickerOpen && this.pickerMine) { this.pickerMine = false; this.ctx.hud.picker(null); }
    this.result = this.buildResult(false, why); this.result.canRetry = canRetry && !!this.checkpoint;
    this.ctx.audio.play("defeat");
  }
  buildResult(won, why) {
    const ctx = this.ctx, st = this.st, side = sideB17(st);
    const mainDone = st.main.filter(Boolean).length, sideDone = Object.values(side).filter(Boolean).length;
    const ks = this.ksHud(), ksOk = ks.filter((k) => k.state === "thanhcong").length;
    const allies = this.wings[0].length + this.wings[1].length, alliesUp = this.wingsUp();
    return {
      battle: "B17", won, why, R: ctx.R, difficulty: ctx.diff.id, timeSec: this.time, mode: this.mode, parSec: PAR_B17,
      missions: (mainDone / 3) * 0.8 + (sideDone / 1) * 0.2, mainDone, sideDone, missionsTotal: 3, sideTotal: 1,
      qRatio: allies ? alliesUp / allies : 1, baseRatio: (st.taken / OUTPOSTS.length + (st.ks.phucKich.state === "thanhcong" ? 1 : 0) + (st.col.stood ? 1 : 0)) / 3,
      ko: this.ko, hkRaw: ctx.hk.rawTotal, hkOptional: ctx.hk.optional, hkLog: { ...ctx.hk.log },
      avgSK: 50, bossDefeated: !!this.bossDown, bossMet: !!this.bossMet, tpcCount: ctx.hk.tpcCount, chestCoins: 0, extraTT: 0,
      events: {}, eventNames: {}, orders: this.orders, items: 0,
      keSach: ks.reduce((s, k) => s + k.got, 0) / ks.reduce((s, k) => s + k.hk, 0), keSachOk: ksOk,
      keSachList: ks.map((k) => ({ id: k.id, state: k.state, name: k.name, word: k.word, got: k.got, hk: k.hk })),
      b17: { bed: st.bed, taken: st.taken, colPct: Math.round(st.col.s / st.col.len * 100), stood: st.col.standWhy, morale: st.col.morale, ks: st.ks.phucKich.state, ksWhy: st.ks.phucKich.why, side },
    };
  }
  bedDist() {
    const h = this.hero; let d = 999;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a)) d = Math.min(d, Math.hypot(a.x - h.x, a.z - h.z));
    return d;
  }
  // Vật của trận ở lại trong scene (battle.js releaseGpu duyệt scene và giải phóng). Lớp phủ bùn, gò do battles/b17.js dispose gỡ.
  dispose() { if (this.ctx.hud?.pickerOpen && this.pickerMine) this.ctx.hud.picker(null); }
}
