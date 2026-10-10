// battle/director-td.js — bộ điều phối giao tranh của chế độ Tự do (đợt 14b): đọc đúng đối tượng data/skirmish.js makeSkirmish, chạy một
// trong 6 nhiệm vụ trên đất Hàm Tử (world.js dựng như B15), không đụng director.js của B15. Giao diện như director.js (battle.js,
// hud.js, hero.js, crowd.js, units.js, hero-skills.js gọi): phase, time, over, result, msgs, events, keSach{hud,trigger}, pickups, M,
// flags, order, tryTPC, objectives, lose, restoreCheckpoint, fillActors, các móc on*.
//
// Luật chung: địch kéo tới từ cửa vào (cờ chàm) — không bật ra cạnh người chơi; thua khi gục hết lượt Gượng dậy, hết giờ, hoặc theo
// nhiệm vụ. Từ Tinh nhuệ có cận vệ (đợt 15c, thay "lính theo" và Gọi tiếp viện của đợt 14 — battle/guard.js, data/guards.js): 1 · 2 · 3 · 4
// người theo bậc, vòng Mệnh Lệnh ra lệnh cho cận vệ (Xung trận · Giữ chỗ · Theo ta · Tung chiêu; người nhận: cả đội hoặc từng người), cận vệ
// gục thì người lính đứng cạnh đỡ dậy. Phó tướng có Kế Sách nhỏ "Phục binh": 8 lính ta đánh úp từ sườn. Tướng có Hào Khí (hạ địch, xong
// mục tiêu) và Tổng Phản Công.
// Mọi số ở đây là ĐỀ XUẤT BẢN THỬ.

import * as THREE from "three";
import { BigUnit } from "./units.js";
import { Guard } from "./guard.js";
import { heightAt } from "./world.js";
import { BannerQueue } from "./banner-queue.js";
import { gain as hkGain, tick as hkTick, activate as hkActivate, tpcReady } from "../sim/haokhi.js";
import { TIERS } from "../data/tuning.js";
import { can, RANKS, KILL_REP, MISSION_MULT } from "../data/career.js";
import { GUARD_ORDERS, REVIVE, guardSlots, guardStats, formationSlot, reviveStep } from "../data/guards.js";
import { SITES } from "../data/skirmish.js";
import { envMesh, envPart } from "./glb.js";
import { lambert } from "./models.js";

const HOLD = { ringPad: 2, drainPer: 2.2, drainEmpty: 5 };       // Giữ đồn: %/s mỗi lính địch hơn số người giữ, %/s khi đồn trống
const BURN_SEC = 2.5, FREE_R = 2.4, CLEAR_R = 4.5;                // châm lều / cởi trói: giây, tầm, không địch trong tầm này
const CART = { hitch: 1.8, pullR: 2.6, stopR: 4.5, dps: 3.2, arriveR: 7 };
const DUEL_LEAVE = 8;                                             // Đấu tướng: ra ngoài vòng quá chừng này giây thì thua
const COL = { ta: 0x9b2d20, dich: 0x2c3e55, gold: 0xc9a14a };

export class TDDirector {
  constructor(ctx, sk, career) {
    this.ctx = ctx; ctx.director = this; this.sk = sk; this.career = career;
    this.rank = sk.rank; this.type = sk.type;
    this.phase = 0; this.time = 0; this.over = false; this.result = null; this.retries = 0;
    this.msgs = []; this.events = {}; this.pickups = []; this.generals = {}; this.flags = [];
    this.M = { par: sk.timeLimit }; this.lastFront = "D"; this.baseHint = null;
    this.ko = 0; this.kills = { thuong: 0, tinhnhue: 0, doitruong: 0, photuong: 0, tuong: 0 };
    this.revivesUsed = 0; this.parries = 0; this.flash = 0;
    this.bq = new BannerQueue((t, c, T) => ctx.fx.banner(t, c, T));
    this.keSach = { hud: () => this.ksHud(), trigger: () => this.ksTrigger(), boats: [], bundles: [], list: [] };
    this.ks = can(this.rank, "keSach") ? { used: false } : null;
    ctx.sim.reinf = { charges: 0, pending: [] }; ctx.sim.cooldowns = {};
    this.guards = []; this.ringTarget = "all"; this.prQ = null;
    this.props = new THREE.Group(); ctx.scene.add(this.props);
    this.waveQ = (sk.waves || []).map((w) => ({ ...w, done: false }));
    this.officerUnits = [];
    this.flag(sk.entry, COL.dich, 7);                                // cửa vào của địch: cờ chàm
    this.setup = { giudon: this.setupHold, danhup: this.setupRaid, chantiepte: this.setupConvoy, hotong: this.setupEscort, cuudongdoi: this.setupRescue, dautuong: this.setupDuel }[sk.type];
    this.setup.call(this);
    if (sk.type !== "dautuong") this.spawnGuards();                  // Đấu tướng: một chọi một — cận vệ ở lại doanh
    else if (career.guards?.length && guardSlots(this.rank)) this.say("Đấu tướng là một chọi một: cận vệ ở lại doanh.", 5);
    this.say(`${sk.name} · ${sk.goal}.`, 7);
    this.say(sk.how, 9);
    this.bq.push(sk.name.toUpperCase(), "#f1d98a", 1.4);
    ctx.audio.play("drum");
  }

  // ---- tiện ích ---------------------------------------------------------------------------------------------------------------
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }
  banner(text, color = "#f1d98a", T = 1.2) { this.bq.push(text, color, T); }
  get hero() { return this.ctx.hero; }
  alive(a) { return this.ctx.crowd.hittable(a); }
  dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
  enemiesNear(p, r) {
    let n = 0;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a) && Math.hypot(a.x - p.x, a.z - p.z) < r) n++;
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating && Math.hypot(u.x - p.x, u.z - p.z) < r + u.radius) n++;
    return n;
  }
  enemyUnit() { return this.ctx.rng.chance(0.12) ? "CUNGKY_NG" : "KHIEN_NG"; }
  spawnEnemy(x, z, { role = "squad", tx = x, tz = z, elite = 0.08, anchor = null, tier = null } = {}) {
    const ctx = this.ctx;
    return ctx.crowd.spawn({ side: "dich", unit: this.enemyUnit(), tier: tier || (ctx.rng.chance(elite) ? "tinhnhue" : "thuong"), role, front: null,
      x, z, sx: tx, sz: tz, yaw: Math.atan2(tx - x, tz - z), anchor });
  }
  spawnAlly(x, z, { role = "follow", tx = x, tz = z, unit = "GIAO_DV" } = {}) {
    return this.ctx.crowd.spawn({ side: "ta", unit, role, front: null, x, z, sx: tx, sz: tz, yaw: Math.atan2(tx - x, tz - z), legionMult: 1 + 0.06 * this.rank });
  }
  spawnOfficer(tier, x, z, { awake = false, aggro = 22, name = null } = {}) {
    const u = new BigUnit(this.ctx, { kind: tier === "tuong" ? "boss" : "officer", side: "dich", tier, name: name || `${TIERS[tier].name} Nguyên`, x, z, awake, aggro });
    u.home = { x, z }; u.retreatTo = { x: this.sk.entry.x + 30, z: this.sk.entry.z };
    this.ctx.units.push(u); this.officerUnits.push(u);
    return u;
  }
  // toán địch ra từ một điểm (cửa vào), tản trong vòng 7 m, đi về (tx, tz)
  spawnGroup(from, n, { tx, tz, elite = 0.08, officers = [] } = {}) {
    const rng = this.ctx.rng, out = [];
    for (let i = 0; i < n; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(0, 7); out.push(this.spawnEnemy(from.x + Math.cos(a) * r, from.z + Math.sin(a) * r, { tx, tz, elite })); }
    officers.forEach((t, k) => this.spawnOfficer(t, from.x + 3 + k * 2, from.z + (k % 2 ? 3 : -3), { awake: true, aggro: 80 }));
    return out;
  }
  // cột cờ đơn giản (cửa vào địch, chỗ hẹn); trả nhóm để gỡ / đổi màu
  flag(p, color, h = 6) {
    const g = new THREE.Group(), y = heightAt(p.x, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 6), new THREE.MeshLambertMaterial({ color: 0x4a3626 }));
    pole.position.y = h / 2; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    cloth.position.set(0.82, h - 0.6, 0); g.add(cloth);
    g.position.set(p.x, y, p.z); this.props.add(g); g.cloth = cloth;
    return g;
  }
  cartMesh(color = 0x6a4a2e) {
    const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color }), dark = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 2.4), wood); body.position.y = 0.85; g.add(body);
    const load = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 2.0), new THREE.MeshLambertMaterial({ color: 0xb59a68 })); load.position.y = 1.45; g.add(load);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 10), dark); w.rotation.z = Math.PI / 2; w.position.set(0.82 * s, 0.5, 0); g.add(w); }
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.6), wood); shaft.position.set(0, 0.7, 1.9); g.add(shaft);
    for (const m of g.children) m.castShadow = true;
    this.props.add(g); return g;
  }
  placeMesh(g, x, z, yaw) { g.position.set(x, heightAt(x, z), z); g.rotation.y = yaw; }
  // đường gấp khúc: điểm ở quãng s (m) tính từ đầu; trả { x, z, yaw, done }
  along(route, s) {
    let left = s;
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i], b = route[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (left <= L) { const t = left / L; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(b.x - a.x, b.z - a.z), done: false }; }
      left -= L;
    }
    const a = route[route.length - 2], b = route[route.length - 1];
    return { x: b.x, z: b.z, yaw: Math.atan2(b.x - a.x, b.z - a.z), done: true };
  }
  routeLen(route) { let L = 0; for (let i = 0; i < route.length - 1; i++) L += Math.hypot(route[i + 1].x - route[i].x, route[i + 1].z - route[i].z); return L; }

  // ---- cận vệ (đợt 15c) -----------------------------------------------------------------------------------------------------
  // Cận vệ trong lưu (career.guards, đủ số chỗ của bậc) ra trận ở chỗ đứng đội hình quanh người lính. Chỉ số = data/guards.js guardStats của chỉ
  // số người lính lúc vào trận (ctx.stats: bậc + quân nhu), tốc chạy bằng người lính.
  spawnGuards() {
    const ctx = this.ctx, h = this.hero, list = (this.career.guards || []).slice(0, guardSlots(this.rank));
    const base = { cong: ctx.stats.cong, hp: ctx.stats.hp, giap: ctx.stats.giap, move: h.def.move };
    list.forEach((g, i) => {
      const p = formationSlot(i, h.yaw), u = new Guard(ctx, g, guardStats(base, g.cls), i, h.x + p.x, h.z + p.z, h.yaw);
      ctx.units.push(u); this.guards.push(u);
    });
  }
  guardsUp() { return this.guards.filter((g) => g.alive && !g.down).length; }
  // người nhận lệnh: "all" hoặc "g<id>" (hud.js vòng qua ringTargets bằng Z / LB / chạm tên)
  ringTargets() {
    if (!this.guards.length) return [{ id: "all", name: this.type === "dautuong" ? "Cận vệ ở lại doanh" : "Chưa có cận vệ" }];
    return [{ id: "all", name: "Cả đội cận vệ" }, ...this.guards.map((g) => ({ id: "g" + g.gid, name: g.name }))];
  }
  ringItems() { return GUARD_ORDERS; }
  ringHint() { return this.guards.length > 1 ? "(Z / chạm tên để đổi người nhận)" : ""; }
  picked(target) { return target === "all" || !target ? this.guards : this.guards.filter((g) => "g" + g.gid === target); }
  // chữ nhỏ dưới mỗi ô lệnh: ai đang theo lệnh đó / mấy người có chiêu sẵn
  ringStatus(k, target) {
    const gs = this.picked(target).filter((g) => g.alive && !g.down);
    if (!gs.length) return "";
    if (k === "tungchieu") { const r = gs.filter((g) => g.skillCd <= 0).length; return gs.length === 1 ? (r ? "sẵn sàng" : `${Math.ceil(gs[0].skillCd)}s`) : `${r}/${gs.length} sẵn`; }
    const n = gs.filter((g) => g.order === k).length;
    return n === gs.length ? "đang theo" : n ? `${n}/${gs.length}` : "";
  }
  // vòng Mệnh Lệnh (hud.issue → order(người nhận, lệnh))
  order(target, k) {
    const ctx = this.ctx;
    if (!this.guards.length) {
      this.say(this.type === "dautuong" ? "Đấu tướng là một chọi một: cận vệ ở lại doanh." : can(this.rank, "squad") ? "Chưa có cận vệ — chiêu mộ ở trang Tự do." : `Lên ${RANKS[1].name} mới có cận vệ để ra lệnh.`, 4);
      return { ok: false };
    }
    const gs = this.picked(target).filter((g) => g.alive), up = gs.filter((g) => !g.down);
    const who = target === "all" || !target ? (this.guards.length > 1 ? "Cả đội" : this.guards[0].name) : gs[0]?.name ?? "";
    if (!up.length) { this.say(`${who}: đang gục, chưa nhận lệnh được.`, 2.5, "bad"); return { ok: false }; }
    if (k === "tungchieu") {
      let n = 0; for (const g of up) if (g.startSkill(true)) n++;
      const wait = up.filter((g) => !g.sk && g.skillCd > 0);
      if (n) this.say(`${who}: tung chiêu!`, 2, "good");
      else if (wait.length) this.say(`Chiêu chưa hồi (${Math.ceil(Math.min(...wait.map((g) => g.skillCd)))} s).`, 2.5);
      return { ok: n > 0 };
    }
    const O = GUARD_ORDERS.find((o) => o.k === k); if (!O) return { ok: false };
    for (const g of up) { g.order = k; g.hold = k === "giucho" ? { x: g.x, z: g.z } : null; g.foe = null; g.retT = 0; }
    this.say(`${who}: ${O.name}.`, 2.5, "good"); ctx.audio.play("drum");
    this.orders = (this.orders || 0) + 1;
    return { ok: true };
  }
  // khung cận vệ trên HUD (hud.js): mỗi người một dòng; sel: đang là người nhận lệnh của vòng Mệnh Lệnh
  guardHud(target) {
    if (!this.guards.length) return null;
    return this.guards.map((g) => ({ id: g.gid, name: g.name, cls: g.C.name, hp: g.hp, maxHp: g.maxHp, down: g.down, used: g.rev.used,
      order: GUARD_ORDERS.find((o) => o.k === g.order)?.name ?? "", skill: g.C.skill.name, cd: g.skillCd, sel: !target || target === "all" || target === "g" + g.gid }));
  }
  onGuardDown(g) { if (g.rev.used) { this.say(`${g.name} gục — đã được đỡ một lần, hết trận mới lành.`, 5, "bad"); return; } this.say(`${g.name} gục! Đứng cạnh ${String(REVIVE.sec).replace(".", ",")} s (không có địch kề bên) để đỡ dậy.`, 5, "bad"); }
  onGuardSkill() {}
  // gục / đỡ dậy (data/guards.js reviveStep); tên đã bắn vẫn bay tới
  updateGuards(dt) {
    const h = this.hero;
    for (const g of this.guards) {
      g.tickPending();
      if (!g.alive || !g.down) continue;
      const near = h.alive && this.dist(h, g) < REVIVE.r, blocked = near && this.enemiesNear(g, REVIVE.clear) > 0;
      const st = reviveStep(g.rev, dt, { near, blocked });
      g.rev.p = st.p;
      if (st.done) { g.rev.p = 0; g.rev.used = true; g.standUp(REVIVE.hpPct); this.banner(`${g.name.toUpperCase()} ĐỨNG DẬY`, "#dff0c8", 0.9); continue; }
      if (near) this.wantPrompt(g.rev.used ? `${g.name} đã được đỡ một lần — hết trận mới lành` : blocked ? `Địch kề bên — dẹp chúng rồi đỡ ${g.name} dậy` : `Đỡ ${g.name} dậy`, g.rev.used ? 0 : g.rev.p);
    }
  }
  // nhắc tương tác giữa đáy màn: việc của nhiệm vụ (châm lều, cởi trói) trước, đỡ cận vệ sau — gom trong một bước rồi mới vẽ
  wantPrompt(text, p) { if (!this.prQ) this.prQ = { text, p }; }
  addFlag(x, z, r, atk, dur) { this.flags.push({ x, z, r, atk, left: dur }); }
  plantFlag(x, z, r, atk, dur) { this.addFlag(x, z, r, atk, dur); this.ctx.fx.ring(x, z, r, 0xf1d98a, 0.8); }

  // ---- Kế Sách nhỏ "Phục binh" (Phó tướng trở lên) ------------------------------------------------------------------------------
  ksHud() {
    if (!this.ks) return [];
    return [{ state: this.ks.used ? "thanhcong" : "khadung", quyMo: "Nhỏ", name: "Phục binh", word: this.ks.used ? "Đã dùng" : "Sẵn sàng · bấm {kesach}",
      detail: this.ks.used ? "" : "8 lính ta đánh úp từ sườn", got: this.ks.used ? 10 : 0, hk: 10, label: "Hư cấu" }];
  }
  ksTrigger() {
    if (!this.ks) { this.say("Kế Sách nhỏ mở ở bậc Phó tướng.", 3); return; }
    if (this.ks.used) return;
    const h = this.hero, obj = this.objectivePoint() || h, ang = Math.atan2(obj.x - h.x, obj.z - h.z) + Math.PI / 2;
    const fx = obj.x + Math.sin(ang) * 22, fz = obj.z + Math.cos(ang) * 22;
    for (let i = 0; i < 8; i++) this.spawnAlly(fx + (i % 4) * 1.5, fz + Math.floor(i / 4) * 1.5, { role: "zone", tx: obj.x, tz: obj.z, unit: "GIAO_DV" });
    this.ks.used = true; this.banner("KẾ SÁCH · PHỤC BINH", "#ffd27a", 1.4); this.ctx.audio.play("horn");
    if (can(this.rank, "haoKhi")) hkGain(this.ctx.hk, 10, "Kế Sách");
  }

  // ---- Tổng Phản Công (Tướng) --------------------------------------------------------------------------------------------------
  tryTPC() {
    const ctx = this.ctx, h = this.hero;
    if (!can(this.rank, "haoKhi")) return;
    if (!tpcReady(ctx.hk)) return;
    const T = hkActivate(ctx.hk);
    h.hkUltReady = true; this.addFlag(h.x, h.z, 30, 0.3, T);
    ctx.cinematic?.("TỔNG PHẢN CÔNG", h, true); ctx.audio.play("horn");
    ctx.crowd.rout(h.x, h.z, 14, (e) => e.tier === "thuong");
  }
  hk(v, src) { if (can(this.rank, "haoKhi")) hkGain(this.ctx.hk, v, src); }

  // ---- mục tiêu cho HUD (nhãn chỉ đường, bản đồ nhỏ) -------------------------------------------------------------------------
  objectivePoint() { const o = this.objectives()[0]; return o ? { x: o.x, z: o.z } : null; }
  objectives() {
    const s = this.sk, h = this.hero, P = (id, label, p, r) => ({ id, label, x: p.x, y: heightAt(p.x, p.z), z: p.z, r });
    if (this.over) return [];
    if (this.type === "giudon") return [P("don", this.siteName, s.site, s.ring + 1)];
    if (this.type === "danhup") { const t = this.tents.filter((x) => !x.burnt).sort((a, b) => this.dist(a, h) - this.dist(b, h))[0]; return t ? [P("leu", "Lều lương", t, 2.4)] : []; }
    if (this.type === "chantiepte") {
      const c = this.carts.filter((x) => x.live && !x.stopped).sort((a, b) => this.dist(a, h) - this.dist(b, h))[0];
      if (!c) return [];
      // người kéo bỏ xe đi đánh nhau (xe đứng yên): chỉ thẳng vào người kéo — trước đây nhãn chỉ vào xe, người kéo đứng kẹt cách xe 10+ m thì
      // không ai hạ, hết giờ (đợt 15c đo: không còn 8 / 16 lính theo dọn hộ)
      const pl = c.puller, hitch = { x: c.x + Math.sin(c.yaw) * CART.hitch, z: c.z + Math.cos(c.yaw) * CART.hitch };
      if (pl && this.alive(pl) && this.dist(pl, hitch) > CART.pullR + 1.5) return [P("keo", "Người kéo xe địch", pl, 2)];
      return [P("xe", "Xe lương địch", c, 5)];
    }
    if (this.type === "hotong") return [P("xe", "Xe lương ta", this.cart, 7)];
    if (this.type === "cuudongdoi") {
      const c = this.captives.filter((x) => !x.freed).sort((a, b) => this.dist(a.a, h) - this.dist(b.a, h))[0];
      return c ? [P("tu", "Đồng đội bị trói", c.a, FREE_R)] : [P("hen", "Chỗ hẹn", s.captives.rally, 7)];
    }
    if (this.type === "dautuong") return this.duelOn ? [] : [P("vong", "Vòng thách đấu", s.duel.at, s.duel.r)];
    return [];
  }

  // ---- 6 nhiệm vụ: dựng ---------------------------------------------------------------------------------------------------------
  get siteName() { return SITES[this.sk.siteId]?.name || "Đồn"; }
  setupHold() {
    const s = this.sk, rng = this.ctx.rng;
    this.keep = 100; this.holdT = 0;
    for (let i = 0; i < s.allies; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(1, s.ring - 2); this.spawnAlly(s.site.x + Math.cos(a) * r, s.site.z + Math.sin(a) * r, { role: "squad" }); }
    this.flag({ x: s.site.x - 3, z: s.site.z + 3 }, COL.ta, 8);
  }
  // Lều lương (mục tiêu đốt): mẫu ENV_leu_luong (lều nóc 5 × 4 m, nóc 3 m, texture — người chơi tới sát), lưới riêng mỗi lều; không va chạm (như mọi lều).
  // Điểm mục tiêu (skirmish.js, cách tâm 8 m) giữ nguyên; hình đặt lệch ≤ 1,5 m quanh nó (điểm vẫn trong lều), nóc dọc vòng trại hoặc dọc bán kính —
  // chọn chỗ ít đè lên nhà, cọc tập, giá giáo, lều… trong sân doanh trại nhất (world.js L.yard), chân ở chỗ đất thấp nhất dưới lều. Cháy rồi thì thay khung
  // lều cháy ENV_khung_leu_chay giãn về chân lều (x ×1,25, z ×1,56). Chưa nạp mẫu thì không có hình như trước (ô trên bản đồ nhỏ, lửa khi cháy).
  grainTent(p, c) {
    const m = envMesh("ENV_leu_luong"); if (!m) return null;
    const yard = this.ctx?.world?.forts?.find((L) => Math.hypot(L.cx - c.x, L.cz - c.z) < 1)?.yard || [];
    const a = Math.atan2(p.x - c.x, p.z - c.z), ux = Math.sin(a), uz = Math.cos(a);
    const at = (x, z, ry, i, j) => [x + i * Math.cos(ry) + j * Math.sin(ry), z + j * Math.cos(ry) - i * Math.sin(ry)];
    let best = null;
    for (const ry of [a + Math.PI / 2, a]) for (const dr of [0, -0.75, 0.75, -1.5, 1.5]) for (const dt of [0, -0.75, 0.75, -1.5, 1.5]) {
      const x = p.x + ux * dr + uz * dt, z = p.z + uz * dr - ux * dt;
      let hit = 0;
      for (let i = -1.75; i <= 1.75; i += 0.5) for (let j = -2.25; j <= 2.25; j += 0.5) {
        const [qx, qz] = at(x, z, ry, i, j);
        if (yard.some(([x0, z0, x1, z1]) => qx > x0 && qx < x1 && qz > z0 && qz < z1)) hit++;
      }
      if (!best || hit < best.hit) best = { hit, x, z, ry };
    }
    const { x, z, ry } = best;
    let y = heightAt(x, z);
    for (const [i, j] of [[-2, -2.5], [2, -2.5], [-2, 2.5], [2, 2.5]]) y = Math.min(y, heightAt(...at(x, z, ry, i, j)));
    m.position.set(x, y - 0.05, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; this.props.add(m);
    return m;
  }
  burnTent(t) {
    if (!t.mesh) return;
    t.mesh.visible = false;
    const g = envPart("ENV_khung_leu_chay", { sx: 1.25, sz: 1.56 });
    if (!g) return;
    const f = new THREE.Mesh(g, (this.envMat ||= lambert())); f.position.copy(t.mesh.position); f.rotation.y = t.mesh.rotation.y; f.castShadow = true; this.props.add(f);
  }
  setupRaid() {
    const s = this.sk, c = s.camp, rng = this.ctx.rng;
    this.tents = c.tents.map((p) => ({ x: p.x, z: p.z, p: 0, burnt: false, mesh: this.grainTent(p, c.center) }));
    for (let i = 0; i < c.garrison; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(2, c.r - 1); this.spawnEnemy(c.center.x + Math.cos(a) * r, c.center.z + Math.sin(a) * r, { role: "garrison", anchor: { x: c.center.x, z: c.center.z, r: c.r }, elite: 0.1 + 0.03 * this.rank }); }
    this.keeper = c.keeper ? this.spawnOfficer(c.keeper, c.center.x + 2, c.center.z, { aggro: 18, name: `${TIERS[c.keeper].name} giữ trại` }) : null;
    if (this.rank >= 4) this.spawnOfficer("doitruong", c.center.x - 4, c.center.z + 3, { aggro: 18 });
    this.burnt = 0;
  }
  setupConvoy() {
    const s = this.sk, C = s.convoy;
    this.carts = Array.from({ length: C.carts }, (_, k) => ({ k, s: -k * C.gap, x: C.route[0].x, z: C.route[0].z, yaw: 0, live: false, stopped: false, arrived: false, puller: null, escorts: [], mesh: null }));
    this.convoyStart = 6; this.cartsStopped = 0; this.escortsKilled = 0; this.escortTotal = 0;
    this.leads = C.lead.map((t, k) => this.spawnOfficer(t, s.site.x + 4 + k * 3, s.site.z + (k % 2 ? 4 : -4), { aggro: 24, name: `${TIERS[t].name} giữ kho` }));
  }
  setupEscort() {
    const s = this.sk, E = s.escort;
    this.cart = { s: 0, x: E.start.x, z: E.start.z, yaw: 0, hp: E.cartHp, stuck: false, mesh: this.cartMesh(0x7a5634), puller: null, pullerT: 0 };
    this.cart.len = this.routeLen(E.route);
    this.ambushQ = this.waveQ;                       // waves của hộ tống: theo quãng xe đã đi (atU)
    this.flag(E.dest, COL.ta, 8);
    const p0 = this.along(E.route, 0); this.cart.yaw = p0.yaw;
    this.cart.puller = this.spawnAlly(p0.x + Math.sin(p0.yaw) * (CART.hitch + 0.6), p0.z + Math.cos(p0.yaw) * (CART.hitch + 0.6), { role: "squad" });   // người kéo xe có ngay từ đầu
    for (let i = 0; i < 2; i++) this.spawnAlly(E.start.x - 2 - i, E.start.z + 2, { role: "follow" });
  }
  setupRescue() {
    const s = this.sk, C = s.captives, rng = this.ctx.rng;
    this.captives = C.people.map((p) => {
      const a = this.ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "spectator", front: null, x: p.x, z: p.z, yaw: rng.range(0, 6.28) });
      return { a, x: p.x, z: p.z, p: 0, freed: false, lost: false };
    });
    for (let i = 0; i < C.guards; i++) { const a = rng.range(0, Math.PI * 2), r = rng.range(4, 12); this.spawnEnemy(C.at.x + Math.cos(a) * r, C.at.z + Math.sin(a) * r, { role: "garrison", anchor: { x: C.at.x, z: C.at.z, r: 12 }, elite: 0.1 + 0.03 * this.rank }); }
    s.officers.forEach((t, k) => this.spawnOfficer(t, C.at.x + 5 + k * 2, C.at.z - 3, { aggro: 16 }));
    this.flag(C.rally, COL.ta, 7);
  }
  setupDuel() {
    const s = this.sk, D = s.duel, n = D.ring, rng = this.ctx.rng;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, r = D.r + 2.5 + rng.range(0, 1.5), x = D.at.x + Math.cos(a) * r, z = D.at.z + Math.sin(a) * r;
      const side = Math.cos(a) > 0 ? "dich" : "ta";      // nửa đông quân Nguyên, nửa tây quân ta
      const sp = this.ctx.crowd.spawn({ side, unit: side === "ta" ? "GIAO_DV" : "KHIEN_NG", role: "spectator", front: null, x, z, yaw: Math.atan2(D.at.x - x, D.at.z - z) });
      sp.y = 0;
    }
    this.duelist = this.spawnOfficer(D.tier, D.at.x + 4, D.at.z, { aggro: 0, name: D.name });
    this.duelist.awake = false; this.duelOn = false; this.outT = 0;
  }

  // ---- 6 nhiệm vụ: mỗi bước ------------------------------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx;
    for (const m of this.msgs) m.t += dt; this.msgs = this.msgs.filter((m) => m.t < m.T);
    this.bq.update(dt);
    for (const k in ctx.sim.cooldowns) ctx.sim.cooldowns[k] = Math.max(0, ctx.sim.cooldowns[k] - dt);
    for (let i = this.flags.length - 1; i >= 0; i--) if ((this.flags[i].left -= dt) <= 0) this.flags.splice(i, 1);
    if (this.over) return;
    this.time += dt;
    if (can(this.rank, "haoKhi") && hkTick(ctx.hk, dt)) this.hero.hkUltReady = false;
    // đợt địch theo giờ (Giữ đồn, cứu viện của Đánh úp trại / Cứu đồng đội)
    for (const w of this.waveQ) if (!w.done && w.at != null && this.time >= w.at) {
      w.done = true;
      const tgt = this.type === "giudon" ? this.sk.site : this.type === "danhup" ? this.sk.camp.center : this.type === "cuudongdoi" ? this.sk.captives.at : this.sk.site;
      this.spawnGroup(w.from, w.n, { tx: tgt.x, tz: tgt.z, elite: w.elite, officers: w.officers });
      this.say(this.type === "giudon" ? "Một toán quân Nguyên kéo tới từ cửa vào." : "Quân cứu viện của địch kéo tới.", 3.5, "bad");
      ctx.audio.play("horn");
    }
    this.prQ = null;
    this["step_" + this.type](dt);
    this.updateGuards(dt);
    if (!this.over) this.ctx.hud.prompt(this.prQ ? this.prQ.text : null, this.prQ?.p ?? 0);
    this.updateEvents(dt);
    if (this.time >= this.sk.timeLimit && !this.over) this.timeUp();
  }
  timeUp() {
    if (this.type === "giudon" && this.keep > 0 && this.holdT >= this.sk.hold) return this.finish(true, "Giữ được đồn tới khi quân Nguyên rút.");
    this.finish(false, "Hết giờ.");
  }
  updateEvents() {}

  step_giudon(dt) {
    const s = this.sk, h = this.hero, R = s.ring + HOLD.ringPad;
    this.holdT += dt;
    const foes = this.enemiesNear(s.site, R);
    let def = 0; for (const a of this.ctx.crowd.agents) if (a.side === "ta" && this.alive(a) && this.dist(a, s.site) < R) def++;
    for (const g of this.guards) if (g.alive && !g.down && this.dist(g, s.site) < R) def += 2;     // cận vệ giữ đồn: mỗi người tính 2 (đợt 15c)
    if (h.alive && this.dist(h, s.site) < R) def += 2;
    if (foes > 0) this.keep = Math.max(0, this.keep - (def === 0 ? HOLD.drainEmpty : Math.max(0, foes - def) * HOLD.drainPer / 2) * dt);
    const left = Math.max(0, s.hold - this.holdT);
    this.baseHint = `Sức giữ đồn ${Math.ceil(this.keep)}% · còn ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
    if (this.keep <= 0) return this.finish(false, "Mất đồn: quân Nguyên chiếm vòng đồn.");
    if (this.holdT >= s.hold) return this.finish(true, "Giữ được đồn tới khi quân Nguyên rút.");
    if (foes > def && this.time - (this.warnT || -99) > 12) { this.warnT = this.time; this.say("Địch đang tràn vào vòng đồn — về giữ đồn!", 4, "bad"); }
  }
  step_danhup(dt) {
    const h = this.hero; let prompt = null;
    for (const t of this.tents) {
      if (t.burnt) continue;
      if (h.alive && this.dist(h, t) < FREE_R + 0.6) {
        const blocked = this.enemiesNear(t, CLEAR_R) > 0;
        if (!blocked) t.p += dt / BURN_SEC;
        prompt = { text: blocked ? "Địch kề bên — dẹp chúng rồi châm lửa" : "Châm lửa lều lương", p: t.p };
        if (t.p >= 1) {
          t.burnt = true; this.burnt++; this.burnTent(t); this.ctx.fx.fire(t.x, heightAt(t.x, t.z), t.z, 9999, 3.5); this.ctx.audio.play("fire", t.x, t.z);
          this.banner(`ĐỐT LỀU ${this.burnt}/${this.tents.length}`, "#ffb07a", 1.1); this.hk(8, "Đốt lều");
        }
      }
    }
    if (prompt) this.wantPrompt(prompt.text, prompt.p);
    this.baseHint = `Đã đốt ${this.burnt}/${this.tents.length} lều`;
    if (this.burnt >= this.tents.length) { this.ctx.hud.prompt(null); this.finish(true, "Trại lương của địch đã cháy."); }
  }
  step_chantiepte(dt) {
    const s = this.sk, C = s.convoy;
    if (this.time < this.convoyStart) return;
    for (const c of this.carts) {
      if (!c.live) {
        if (this.time >= this.convoyStart + c.k * (C.gap / C.speed)) {
          c.live = true; c.s = 0; const p = this.along(C.route, 0); c.x = p.x; c.z = p.z; c.yaw = p.yaw;
          c.mesh = this.cartMesh(0x5a4a3a);
          c.puller = this.spawnEnemy(c.x + Math.sin(c.yaw) * CART.hitch, c.z + Math.cos(c.yaw) * CART.hitch, { tier: "tinhnhue", role: "squad" });
          for (let i = 0; i < C.escorts[c.k]; i++) c.escorts.push(this.spawnEnemy(c.x + (i % 2 ? 2 : -2), c.z - 1 - i, { role: "squad", elite: 0.15 }));
          this.escortTotal += C.escorts[c.k];
          if (c.k === 0) { this.say("Đoàn xe lương địch đã ra khỏi cửa vào.", 4, "bad"); this.ctx.audio.play("horn"); }
        }
        continue;
      }
      if (c.stopped || c.arrived) continue;
      const pl = c.puller, hitch = { x: c.x + Math.sin(c.yaw) * CART.hitch, z: c.z + Math.cos(c.yaw) * CART.hitch };
      if (!pl || !this.alive(pl)) {
        c.stopped = true; this.cartsStopped++; this.ctx.fx.fire(c.x, heightAt(c.x, c.z), c.z, 9999, 2.6);
        this.banner(`CHẶN XE LƯƠNG ${this.cartsStopped}/${this.carts.length}`, "#ffb07a", 1.1); this.hk(10, "Chặn xe");
        for (const e of c.escorts) if (this.alive(e)) { e.role = "zone"; e.sx = e.x; e.sz = e.z; }
        continue;
      }
      pl.sx = hitch.x + Math.sin(c.yaw) * 0.6; pl.sz = hitch.z + Math.cos(c.yaw) * 0.6;
      if (this.dist(pl, hitch) < CART.pullR && !pl.foe && pl.target !== this.hero) {
        c.s += C.speed * dt; const p = this.along(C.route, c.s); c.x = p.x; c.z = p.z; c.yaw = p.yaw;
        if (p.done || this.dist(c, s.site) < CART.arriveR) { c.arrived = true; return this.finish(false, "Xe lương địch đã vào tới trại."); }
      }
      c.escorts.forEach((e, i) => { if (!this.alive(e) || e.role !== "squad") return; const side = i % 2 ? 1 : -1, back = 1 + Math.floor(i / 2) * 1.6;
        e.sx = c.x + Math.cos(c.yaw) * 2.2 * side - Math.sin(c.yaw) * back; e.sz = c.z - Math.sin(c.yaw) * 2.2 * side - Math.cos(c.yaw) * back; });
    }
    for (const c of this.carts) if (c.mesh) this.placeMesh(c.mesh, c.x, c.z, c.yaw);
    this.baseHint = `Đã chặn ${this.cartsStopped}/${this.carts.length} xe lương`;
    if (this.cartsStopped >= this.carts.length) this.finish(true, "Cả đoàn xe lương địch đã bị chặn.");
  }
  step_hotong(dt) {
    const s = this.sk, E = s.escort, c = this.cart, h = this.hero;
    // người kéo xe (lính ta); ngã thì 4 s sau người khác lên kéo
    if (!c.puller || !this.alive(c.puller)) { c.pullerT += dt; if (c.pullerT > 4) { c.pullerT = 0; c.puller = this.spawnAlly(c.x - Math.sin(c.yaw), c.z - Math.cos(c.yaw), { role: "squad" }); } }
    const hitch = { x: c.x + Math.sin(c.yaw) * CART.hitch, z: c.z + Math.cos(c.yaw) * CART.hitch };
    if (c.puller && this.alive(c.puller)) { c.puller.sx = hitch.x + Math.sin(c.yaw) * 0.6; c.puller.sz = hitch.z + Math.cos(c.yaw) * 0.6; }
    const near = this.enemiesNear(c, CART.stopR), pulling = c.puller && this.alive(c.puller) && this.dist(c.puller, hitch) < CART.pullR;
    c.stuck = near > 0 || !pulling;
    if (near > 0) {
      let n = 0; for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a) && this.dist(a, c) < 2.6) n++;
      c.hp = Math.max(0, c.hp - n * CART.dps * dt);
      if (this.time - (this.warnT || -99) > 10) { this.warnT = this.time; this.say("Địch đang phá xe lương!", 3.5, "bad"); }
    }
    if (!c.stuck) { c.s += E.speed * dt; const p = this.along(E.route, c.s); c.x = p.x; c.z = p.z; c.yaw = p.yaw; if (p.done) return this.finish(true, "Xe lương đã về tới bản doanh."); }
    this.placeMesh(c.mesh, c.x, c.z, c.yaw);
    const u = c.s / c.len;
    for (const w of this.ambushQ) if (!w.done && u >= w.atU) {
      w.done = true; this.spawnGroup(w.from, w.n, { tx: c.x, tz: c.z, elite: w.elite, officers: w.officers }).forEach((a) => (a.huntCart = true));
      this.say("Phục kích! Địch từ phía đông lao vào xe lương.", 4, "bad"); this.ctx.audio.play("horn");
    }
    for (const a of this.ctx.crowd.agents) if (a.huntCart && this.alive(a)) { a.sx = c.x; a.sz = c.z; }
    this.baseHint = `Xe lương ${Math.ceil(c.hp)}% · đi được ${Math.round(u * 100)}% đường${c.stuck ? " · đang bị chặn" : ""}`;
    if (c.hp <= 0) this.finish(false, "Xe lương bị địch phá.");
  }
  step_cuudongdoi(dt) {
    const s = this.sk, C = s.captives, h = this.hero; let prompt = null;
    for (const c of this.captives) {
      if (c.freed) { if (!this.alive(c.a)) c.lost = true; continue; }
      if (h.alive && this.dist(h, c.a) < FREE_R + 0.4) {
        const blocked = this.enemiesNear(c.a, CLEAR_R) > 0;
        if (!blocked) c.p += dt / C.freeSec;
        prompt = { text: blocked ? "Địch kề bên — dẹp chúng rồi cởi trói" : "Cởi trói cho đồng đội", p: c.p };
        if (c.p >= 1) { c.freed = true; c.a.role = "follow"; c.a.foe = null; this.banner("CỞI TRÓI", "#dff0c8", 0.9); this.hk(6, "Cứu đồng đội"); }
      }
    }
    if (prompt) this.wantPrompt(prompt.text, prompt.p);
    const freed = this.captives.filter((c) => c.freed && !c.lost && this.alive(c.a)).length, tied = this.captives.filter((c) => !c.freed).length;
    this.baseHint = tied ? `Đã cởi trói ${this.captives.length - tied}/${this.captives.length}` : `Đưa ${freed} người về chỗ hẹn`;
    if (!tied && freed === 0) return this.finish(false, "Không cứu được ai về.");
    // tới chỗ hẹn: chờ người đi sau theo kịp (đồng đội chạy chậm hơn người lính gần một nửa — đủ mọi người còn sống, hoặc tối đa 30 s)
    if (!tied && h.alive && this.dist(h, C.rally) < 8) {
      const back = this.captives.filter((c) => c.freed && this.alive(c.a) && this.dist(c.a, C.rally) < 16).length;
      this.rallyT = (this.rallyT || 0) + dt;
      if (back > 0 && (back >= freed || this.rallyT >= 30)) { this.saved = back; this.finish(true, `Đưa ${back} đồng đội về tới chỗ hẹn.`); }
      else this.baseHint = `Chờ đồng đội theo kịp · ${back}/${freed} đã tới`;
    } else this.rallyT = 0;
  }
  step_dautuong(dt) {
    const s = this.sk, D = s.duel, h = this.hero, u = this.duelist;
    const inRing = h.alive && this.dist(h, D.at) < D.r;
    if (!this.duelOn && inRing) {
      this.duelOn = true; u.awake = true; u.aggro = 200; this.ctx.audio.play("gong");
      this.bq.push("THÁCH ĐẤU", "#ffd27a", 1.6); this.say(`${D.name} nhận lời thách đấu. Đánh cạn Phá Thế rồi ra Đòn Quyết.`, 6);
      for (const a of this.ctx.crowd.agents) if (a.role === "spectator") a.cheer = 2;
    }
    if (this.duelOn) {
      if (u.alive && !u.dead && !u.retreating && this.dist(u, D.at) > D.r + 2) { u.x += (D.at.x - u.x) * 0.02; u.z += (D.at.z - u.z) * 0.02; }   // đối thủ không rời vòng
      if (!inRing && h.alive) { this.outT += dt; this.events.leave = { state: "run", left: Math.max(0, DUEL_LEAVE - this.outT) }; if (this.outT >= DUEL_LEAVE) return this.finish(false, "Bỏ vòng thách đấu."); }
      else { this.outT = 0; delete this.events.leave; }
    }
    this.baseHint = this.duelOn ? `Đối thủ: ${D.name}` : "Vào vòng quân để bắt đầu";
  }

  // ---- móc từ lính, sĩ quan, tướng -----------------------------------------------------------------------------------------------
  onSoldierKilled(a, opt) {
    if (a.side !== "dich") return;
    if (opt.by === "hero") { this.kills[a.tier === "tinhnhue" ? "tinhnhue" : "thuong"]++; this.ko++; this.hk(a.tier === "tinhnhue" ? 1.5 : 0.5, "Hạ địch"); }
    if (this.type === "chantiepte") for (const c of this.carts) if (c.escorts.includes(a)) this.escortsKilled++;
  }
  // Sĩ quan do cận vệ ra đòn cuối (opt.by "guard", đợt 15c): người lính được nửa phần (danh tiếng, Hào Khí) — công của cả đội, nhưng lính
  // thường do cận vệ hạ thì không tính cho người lính (như lính theo của đợt 14). ĐỀ XUẤT BẢN THỬ.
  onOfficerKilled(u, opt = {}) {
    const k = opt.by === "guard" ? 0.5 : 1;
    this.kills[u.tier] = (this.kills[u.tier] || 0) + k; this.ko++;
    this.ctx.fx.banner(`ĐÃ HẠ ${TIERS[u.tier].name.toUpperCase()}`, "#e6dcc3", 1.1); this.hk(8 * k, "Hạ sĩ quan");
    if (this.type === "dautuong" && u === this.duelist) this.finish(true, `Thắng trận thách đấu với ${u.name}.`);
    if (u === this.keeper) this.keeperDown = true;
  }
  onBossDefeated(u, opt = {}) {
    const k = opt.by === "guard" ? 0.5 : 1;
    this.kills.tuong += k; this.ko++; this.ctx.fx.banner("TƯỚNG NGUYÊN RÚT CHẠY", "#f1d98a", 1.4); this.hk(15 * k, "Đánh lui tướng");
    if (this.type === "dautuong" && u === this.duelist) this.finish(true, `${u.name} thua trận thách đấu, rút chạy.`);
  }
  onCaptured(u) { this.onBossDefeated(u); }
  onOfficerAwake(u) { if (u.kind === "officer" && this.type !== "dautuong") this.say(`${u.name} xông tới!`, 3, "bad"); }
  onBreak() { this.ctx.fx.banner(this.ctx.fmt ? this.ctx.fmt("VỠ THẾ · {C}: ĐÒN QUYẾT") : "VỠ THẾ", "#ffd27a", 1.1); }
  onHeroHit() {}
  onHeroAction(kind) { if (kind === "parry" && this.type === "dautuong" && this.duelOn) this.parries++; }
  onCounterBoss() {}
  onRevive() { this.revivesUsed++; this.say("Gượng dậy — còn sống là còn đánh.", 3); }
  onHeroDead() { this.finish(false, `${this.career.name} gục ngã, được đồng đội khiêng về doanh.`); }
  onUlt() {}
  onUltEnd() {}
  ultQ() {}
  onAllyGeneralDown() {}
  damageGate() { return 0; }
  killActor() {}
  fillActors() {}
  restoreCheckpoint() { this.say("Giao tranh không có điểm tải lại — đánh tiếp, hoặc rút quân.", 4); }
  lose(why, canRetry = false) { this.finish(false, why); }

  // ---- kết thúc ---------------------------------------------------------------------------------------------------------------
  finish(won, why) {
    if (this.over) return;
    this.over = true; this.ctx.hud?.prompt?.(null);
    const sideList = this.sk.side.map((x) => ({ ...x, ok: won && this.sideOk(x) }));
    this.result = {
      td: true, battle: "TD", won, why, canRetry: false, type: this.type, name: this.sk.name, base: this.sk.base, rank: this.rank,
      kills: { ...this.kills }, ko: this.ko, side: sideList.filter((x) => x.ok).length, sideList,
      guards: this.guards.map((g) => ({ id: g.gid, name: g.name, cls: g.C.name, ko: g.ko, up: g.alive && !g.down })), timeSec: this.time, mode: this.ctx.mode, R: this.ctx.R,
    };
    if (won) { this.bq.push("THẮNG TRẬN", "#f1d98a", 1.6); this.ctx.audio.play("victory"); }
  }
  sideOk(x) {
    if (x.id === "noRevive") return this.revivesUsed === 0;
    if (x.id === "holdHigh") return this.keep >= 60;
    if (x.id === "keeper") return !!this.keeperDown;
    if (x.id === "fast") return this.time <= x.par;
    if (x.id === "escorts") return this.escortTotal > 0 && this.escortsKilled >= this.escortTotal;
    if (x.id === "cartHp") return this.cart?.hp >= 70;
    if (x.id === "allSaved") return this.captives?.every((c) => c.freed && this.alive(c.a));
    if (x.id === "parry") return this.parries >= 2;
    return false;
  }
  // danh tiếng tạm tính trong trận (HUD): hạ địch + mục phụ đang đạt (chưa tính phần nhiệm vụ)
  liveRep() {
    let r = 0; for (const k in this.kills) r += this.kills[k] * KILL_REP[k];
    return Math.round(r);
  }
  missionRep() { return Math.round(this.sk.base * MISSION_MULT[this.rank]); }
  // nền tiếng, nhạc
  bedDist() {
    const h = this.hero; let d = 999;
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.alive(a)) d = Math.min(d, Math.hypot(a.x - h.x, a.z - h.z));
    return d;
  }
  dispose() { this.ctx.scene.remove(this.props); }
}
export { RANKS };
