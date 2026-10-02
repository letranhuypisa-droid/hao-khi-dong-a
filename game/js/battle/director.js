// battle/director.js — luật trận B15 PROTO: pha, Cứ Điểm, sự kiện, Hào Khí, vùng chiến đấu,
// lính diễn, vật phẩm, checkpoint, thắng thua (Đặc tả prototype 21.2, 21.6).

import * as THREE from "three";
import { FRONTS, BASES, BASE_RING, PHASES, EVENTS, ALLY_GENERALS, MAP, lineToX, ENEMY_MIX } from "../data/battle-b15.js";
import { SIM, HAO_KHI, QUICK, ZONE, ORDERS, TIERS, MODES, HERO, GARRISON, KITS, SUPPLY } from "../data/tuning.js";
import { KeSachManager } from "./kesach.js";
import { PICKUPS, DROPS } from "../data/progression.js";
import { simTick, issueOrder, triggerTPC, totalQ, supplyOpen, snapshot as simSnapshot } from "../sim/front.js";
import { gain, tick as hkTick, activate as hkActivate, tpcReady, milestone, raiseTo as hkRaiseTo } from "../sim/haokhi.js";
import { BigUnit } from "./units.js";
import { pickPromotions } from "./promotion.js";
import { classifyGarrison, garrisonHint, nearestBlocker, isLast } from "./garrison.js";
import { doorSpawnPoint, planRefill, transitCap, tickCap, lineWant } from "./supply.js";
import { heightAt } from "./world.js";
import { pickupMesh, flagTexture } from "./models.js";
import { BannerQueue } from "./banner-queue.js";
import { gateTarget, gateGoal, gateGoalShort, GATE_PHASE } from "./gatebar.js";

const baseDef = (id) => BASES.find((b) => b.id === id);
// Đội hình lính diễn: 11 cột cách 4 m (rộng 40 m); hàng đầu cận chiến đứng cách tuyến 0,95 m nên hai hàng đầu cách
// nhau 1,9 m — vừa tầm đao, giáo. Trước đây 2,2 m mỗi bên: hai hàng cách 4,4 m, vung đòn vào không khí.
const ACTOR_COLS = 11, ACTOR_FRONT = 0.95;
const clone = (o) => JSON.parse(JSON.stringify(o));

export class Director {
  constructor(ctx) {
    this.ctx = ctx; ctx.director = this;
    this.phase = 0; this.phaseStart = 0; this.time = 0; this.simAcc = 0;
    this.ko = 0; this.koMs = 0; this.koHealAcc = 0; this.koSkAcc = 0;
    this.main = [false, false, false, false]; this.side = { S_B2: false, S_GATES: false };
    this.keepers = {}; this.capT = {}; this.capPause = 0;
    this.events = {}; this.pickups = []; this.flags = [];
    this.qBucket = SIM.heroQCap.perSec * SIM.heroQCap.window;
    this.swingQ = new Map();
    this.followers = null; this.chestCoins = 0; this.extraTT = 0;
    this.boss = null; this.landT = 0; this.bossSpawned = false;
    this.skSamples = 0; this.skSum = 0; this.counterBoss = 0;
    this.prevQ = {}; this.actorLossAcc = {};
    this.over = false; this.result = null; this.checkpoint = null; this.msgs = [];
    this.bq = new BannerQueue((text, color, T) => ctx.fx.banner(text, color, T));   // băng chữ giữa màn xếp hàng (banner-queue.js)
    this.lastFront = "A"; this.hqLostT = 0;
    this.selectedFront = "A";
    this.generals = {};
    this.mode = ctx.mode || "nhanh"; this.M = MODES[this.mode];
    this.keSach = new KeSachManager(ctx, this.mode);
    for (const id in ctx.sim.bases) ctx.world.setBaseOwner(id, ctx.sim.bases[id].owner);
    for (const fid in FRONTS) { this.prevQ[fid] = { ta: totalQ(ctx.sim.fronts[fid], "ta"), dich: totalQ(ctx.sim.fronts[fid], "dich") }; this.actorLossAcc[fid] = { ta: 0, dich: 0 }; }
    this.spawnGenerals();
    this.spawnGuards();
    this.fillActors(true);
    this.saveCheckpoint();
  }

  // ---- tiện ích ----------------------------------------------------------------------------
  say(text, T = 4, kind = "info") { this.msgs.push({ text, T, kind, t: 0 }); }     // chữ phím ({tpc}…) đổi lúc vẽ, hud.js update
  // Băng chữ giữa màn qua hàng đợi: chiếm Cứ Điểm, sang pha, Kế Sách cùng một nhịp thì lần lượt hiện (fx.banner thay băng cũ ngay).
  banner(text, color = "#f1d98a", T = 1.2, low = false) { this.bq.push(text, color, T, low); }
  heroFront() {
    const h = this.ctx.hero;
    if (h.x > MAP.fortWallX + 2) return null;
    let best = null, bd = 60;
    for (const f of Object.values(FRONTS)) { const d = Math.abs(h.z - f.laneZ); if (d < bd) { bd = d; best = f.id; } }
    if (best) this.lastFront = best;
    return best;
  }
  basePos(id) { const v = this.ctx.world.bases[id]; return { x: v.x, z: v.z, r: v.r }; }
  // Mục tiêu chính của pha hiện tại cho HUD (hud.js nhãn chỉ đường, b15.js bản đồ nhỏ): [{ id, label, x, y, z, r }]. Nhiều mục khi pha
  // cho chọn (P3: cổng bắc hoặc nam); cổng đã phá, Cứ Điểm đã chiếm thì bỏ; rỗng khi hết trận hoặc Toa Đô đã rút.
  objectives() {
    const P = PHASES[this.phase], T = P?.target, ctx = this.ctx;
    if (!T || this.over) return [];
    if (T.boss) {
      const u = this.boss, b = MAP.beach;
      if (!u) return [{ id: "X19", label: "Toa Đô", x: b.x, y: heightAt(b.x, b.z), z: b.z, r: b.r }];
      return u.alive && !u.dead && !u.retreating ? [{ id: "X19", label: "Toa Đô", x: u.x, y: u.y ?? heightAt(u.x, u.z), z: u.z, r: 6 }] : [];
    }
    const out = [];
    for (const id of [].concat(T.base)) {
      if (ctx.openGates[id] || ctx.sim.bases[id]?.owner === "ta") continue;
      const v = ctx.world.bases[id]; if (v) out.push({ id, label: `${id} · ${baseDef(id).name}`, x: v.x, y: heightAt(v.x, v.z), z: v.z, r: v.r });
    }
    return out;
  }
  hk(amount, src, optional = false) { const g = gain(this.ctx.hk, amount, src, { optional }); if (g && Math.abs(g) >= 0.5) this.ctx.hud?.hkPulse(g); return g; }
  gatesOpen() { return Object.keys(this.ctx.openGates).filter((k) => this.ctx.openGates[k]).length; }

  // ---- vòng lặp -----------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, sim = ctx.sim, hero = ctx.hero;
    if (this.over) return;
    this.bq.update(dt);
    this.time += dt;
    this.capPause = Math.max(0, this.capPause - dt);
    this.qBucket = Math.min(SIM.heroQCap.perSec * SIM.heroQCap.window, this.qBucket + SIM.heroQCap.perSec * dt);
    sim.heroFront = this.heroFront();

    // mô phỏng 1 Hz
    this.simAcc += dt;
    while (this.simAcc >= 1) { this.simAcc -= 1; this.onSimTick(simTick(sim)); }

    // Hào Khí
    if (hkTick(ctx.hk, dt)) this.onTpcEnd();
    const ms = milestone(ctx.hk);
    sim.hk.m25 = ms >= 25 ? ctx.stats.mods.m25 : 0; sim.hk.m50 = ms >= 50; sim.hk.m75 = ms >= 75;
    if (ms > (this.lastMs || 0) && ms < 100) { this.banner(`HÀO KHÍ ${ms}`, "#f1d98a", 1); ctx.audio.play("drum"); }
    if (ms === 100 && this.lastMs !== 100) { this.banner("TỔNG PHẢN CÔNG SẴN SÀNG · {TPC}", "#ffd27a", 1.8); ctx.audio.play("drums3"); }
    this.lastMs = ms;

    this.updateBases(dt);
    this.updateZone(dt);
    this.updateEvents(dt);
    this.updateGenerals(dt);
    this.updatePickups(dt);
    this.updateFlags(dt);
    if (this.phase === 3) this.updateBossPhase(dt);
    this.keSach.update(dt);
    if (this.winAt && this.time >= this.winAt) this.win();
    if (this.guardDue?.length && this.time >= this.guardDue[0]) { this.guardDue.shift(); this.spawnGuards(); }
    if (this.time >= this.M.timeout) this.lose("Quá 30 phút — quân Nguyên giữ được bến Hàm Tử.");
    for (const m of this.msgs) m.t += dt;
    this.msgs = this.msgs.filter((m) => m.t < m.T);
  }

  onSimTick(evs) {
    const ctx = this.ctx, sim = ctx.sim;
    for (const e of evs) {
      if (e.type === "baseFlip") {
        ctx.world.setBaseOwner(e.id, e.owner);
        const d = baseDef(e.id);
        if (e.owner === "dich") {
          this.hk(d.hk[1], "mất:" + e.id); this.say(`Mất ${d.name}!`, 4, "bad"); ctx.audio.play("horn");
          const F = Object.values(FRONTS).find((x) => x.door === e.id);       // doanh trại cửa ngõ về tay địch: viện binh chạy lại (đợt 12c)
          if (F) this.say(`Cửa ngõ ${F.id} mở lại: quân Nguyên lại có viện binh ở ${FRONTS[F.id].name}.`, 5, "bad");
        }
        else { this.onBaseTaken(e.id, "sim"); }
      } else if (e.type === "collapse") this.say(`${FRONTS[e.front].name}: cánh ${e.side === "ta" ? "ta" : "địch"} vỡ trận!`, 4, e.side === "ta" ? "bad" : "good");
      else if (e.type === "reinfArrived") this.say(`Tiếp viện ${e.amount} quân tới ${FRONTS[e.front].name}.`, 4, "good");
      else if (e.type === "enemyReinf") this.say(`Địch tiếp viện ${e.amount} quân ở ${FRONTS[e.front].name}.`, 3, "bad");
      else if (e.type === "generalDown") this.say(`${ALLY_GENERALS[e.id].name} phải rút lui!`, 4, "bad");
      else if (e.type === "generalBack") this.say(`${ALLY_GENERALS[e.id].name} trở lại trận.`, 3, "good");
      else if (e.type === "tpcEnd") { for (const f of Object.values(sim.fronts)) f.skBoost = HAO_KHI.tpc.after.skBonus; }
      else if (e.type === "hqLost") this.lose("Mất bản doanh — tuyến mặt trận bị đẩy về tận doanh trại ta.");
    }
    // lính diễn ngã theo tổn thất mô phỏng
    for (const fid in FRONTS) {
      const f = sim.fronts[fid];
      for (const side of ["ta", "dich"]) {
        const q = totalQ(f, side), d = this.prevQ[fid][side] - q;
        if (d > 0) this.actorLossAcc[fid][side] += d * this.visR();
        this.prevQ[fid][side] = q;
        while (this.actorLossAcc[fid][side] >= 1) { this.actorLossAcc[fid][side] -= 1; this.killActor(fid, side); }
      }
    }
    // Hào Khí thụ động: Sĩ Khí ≥ 80 ở cánh đang đứng
    const hf = sim.heroFront;
    if (hf && sim.fronts[hf].sk.ta >= 80 && sim.t % HAO_KHI.src.skPassiveEvery === 0) this.hk(HAO_KHI.src.skPassive, "sĩ khí", true);
    let s = 0; for (const f of Object.values(sim.fronts)) s += f.sk.ta; this.skSum += s / 2; this.skSamples++;
    this.fillActors(false);
  }

  // ---- lính diễn ở tuyến ----------------------------------------------------------------------
  visR() { return this.ctx.troops.r * (this.ctx.hk.tpc ? 2 : 1); }
  fillActors(instant) {
    const ctx = this.ctx, crowd = ctx.crowd, sim = ctx.sim, rng = ctx.rng;
    const budget = Math.max(0, ctx.troops.N - 50) * (ctx.hk.tpc ? 2 : 1);
    const hf = sim.heroFront || this.lastFront;
    for (const fid in FRONTS) {
      const F = FRONTS[fid], f = sim.fronts[fid], lx = lineToX(F, f.x);
      const w = fid === hf ? 0.34 : 0.16;
      const front = {};           // cột → lính hàng đầu cận chiến, để ghép cặp hai bên
      for (const side of ["ta", "dich"]) {
        const zoneN = crowd.agents.filter((a) => a.front === fid && a.side === side && a.role === "zone" && a.state !== "dead").length;
        const want0 = Math.max(0, Math.min(Math.round(budget * w), Math.max(6, Math.round(totalQ(f, side) * this.visR())) - zoneN));
        // Đợt 12c: cánh địch có tướng giữ tối thiểu SUPPLY.lineFloor lính ở tuyến ở MỌI mức Số lính (vùng chiến đấu lấy địch từ tuyến; mức Thấp chỉ 17 thì cạn ở 1 lính/s,
        // trong khi canon đòi kết quả không đổi theo mức); cánh đã kiệt Q thì không giữ sàn
        const want = side === "dich" ? lineWant(want0, fid === hf && totalQ(f, side) >= 2 * SUPPLY.lineFloor) : want0;
        let actors = crowd.agents.filter((a) => a.role === "actor" && a.front === fid && a.side === side && a.state !== "dead");
        // Đợt 12c: lính địch BÙ (không phải dựng tức thì) đi qua cửa ngõ của cánh — xuất ở chỗ xuất quân sau doanh trại rồi hành quân ra tuyến; cửa ngõ về
        // tay ta thì không bù. Lính đang đi đường không tính vào số lính ở tuyến (want), có trần riêng (SUPPLY.transitMax). Quân ta, và dựng tức thì (đầu trận,
        // tải lại điểm lưu), giữ cách cũ.
        const door = side === "dich" && !instant && F.door ? F.door : null;
        if (!door) {
          // bớt người thì bớt từ hàng sau cùng (chỗ số lớn), không bớt bừa
          if (actors.length > want) {
            actors.sort((p, q) => (q.slot ?? 1e9) - (p.slot ?? 1e9));
            for (let i = 0; i < actors.length - want; i++) crowd.release(actors[i]);
            actors = actors.slice(actors.length - want);
          }
          for (let i = actors.length; i < want; i++) {
            const unit = side === "ta" ? "GIAO_DV" : (rng.next() < ENEMY_MIX.KHIEN_NG ? "KHIEN_NG" : "CUNGKY_NG");
            const back = instant ? 0 : 18;
            const a = crowd.spawn({ side, unit, role: "actor", front: fid, x: lx + (side === "ta" ? -back : back), z: F.laneZ + rng.range(-20, 20),
              legionMult: ctx.stats.legionMult });
            actors.push(a);
          }
        } else {
          let line = actors.filter((a) => !a.march);
          if (line.length > want) {
            line.sort((p, q) => (q.slot ?? 1e9) - (p.slot ?? 1e9));
            const gone = new Set(line.slice(0, line.length - want));
            for (const a of gone) crowd.release(a);
            actors = actors.filter((a) => !gone.has(a)); line = line.filter((a) => !gone.has(a));
          }
          const p = this.basePos(door), S = doorSpawnPoint(F, p, lx), hero = ctx.hero, vr = this.visR();
          const n = planRefill({ open: supplyOpen(sim, fid), blocked: hero.alive && Math.hypot(hero.x - S.x, hero.z - S.z) < SUPPLY.minDist,
            want, arrived: line.length, moving: actors.length - line.length, transitMax: transitCap(vr), perTick: tickCap(vr) });
          for (let i = 0; i < n; i++) {
            const unit = rng.next() < ENEMY_MIX.KHIEN_NG ? "KHIEN_NG" : "CUNGKY_NG";
            const a = crowd.spawn({ side, unit, role: "actor", front: fid, x: S.x + (i % 3) * 1.5, z: S.z + rng.range(-14, 14), legionMult: ctx.stats.legionMult });
            a.march = true; actors.push(a);
          }
        }
        front[side] = this.layoutActors(actors, F, lx, side, instant);
      }
      // hàng đầu hai bên cùng cột thành một cặp đánh nhau
      for (let c = 0; c < ACTOR_COLS; c++) {
        const p = front.ta[c] || null, q = front.dich[c] || null;
        if (p) p.partner = q; if (q) q.partner = p;
      }
    }
  }

  // Đội hình một phe ở một mặt trận: ba khối từ tuyến ra sau — cận chiến, cung/nỏ, cung kỵ. Mỗi lính giữ chỗ (a.slot)
  // trong khối của mình qua các lần xếp. Trước đây chỗ đứng lấy theo thứ tự trong crowd.agents, mà mỗi lần có lính bị
  // trả về pool (chết, rời vùng chiến đấu) thứ tự đó bị xáo (xoá kiểu hoán cuối) → cả đội hình đổi chỗ, lính chạy qua
  // chạy lại mỗi giây. Giờ chỗ trống ở hàng trên thì người cùng cột ở hàng dưới bước lên lấp. Trả về hàng đầu cận
  // chiến theo cột (để ghép cặp).
  layoutActors(actors, F, lx, side, instant) {
    const cols = ACTOR_COLS, dir = side === "ta" ? -1 : 1, pools = { m: [], r: [], k: [] }, marching = [];
    for (const a of actors) {
      if (a.march) { marching.push(a); continue; }         // lính bù đang hành quân từ cửa ngõ (đợt 12c): chưa có chỗ trong đội hình, xem cuối hàm
      const pk = a.K.mounted ? "k" : a.K.ranged ? "r" : "m";
      if (a.pool !== pk) { a.pool = pk; a.slot = undefined; }
      pools[pk].push(a);
    }
    const frontCols = [];
    let depth = ACTOR_FRONT;                              // khoảng cách từ tuyến tới hàng đầu của khối
    for (const pk of ["m", "r", "k"]) {
      const list = pools[pk];
      if (!list.length) continue;
      const bySlot = new Map();
      for (const a of list) { if (a.slot !== undefined && !bySlot.has(a.slot)) bySlot.set(a.slot, a); else a.slot = undefined; }
      let free = 0;
      for (const a of list) if (a.slot === undefined) { while (bySlot.has(free)) free++; a.slot = free; bySlot.set(free, a); }
      // dồn lên: chỗ trống thì người cùng cột gần nhất ở hàng sau bước lên
      let maxS = 0; for (const s of bySlot.keys()) maxS = Math.max(maxS, s);
      for (let s = 0; s <= maxS; s++) {
        if (bySlot.has(s)) continue;
        for (let s2 = s + cols; s2 <= maxS; s2 += cols) if (bySlot.has(s2)) { const a = bySlot.get(s2); bySlot.delete(s2); a.slot = s; bySlot.set(s, a); break; }
      }
      const rowGap = pk === "k" ? 3.4 : 2.2;
      let rows = 0;
      for (const a of list) {
        const row = Math.floor(a.slot / cols), col = a.slot % cols;
        rows = Math.max(rows, row + 1);
        const jitter = ((a.id * 7919) % 100) / 100 - 0.5;
        a.sx = lx + dir * (depth + row * rowGap + (row ? jitter * 0.6 : 0));
        a.sz = F.laneZ - 20 + col * 4 + jitter * 1.2;
        a.frontRow = pk === "m" && row === 0;
        if (a.frontRow) frontCols[col] = a;
        if (instant) { a.x = a.sx; a.z = a.sz; }
      }
      depth += rows * rowGap + (pk === "m" ? 1.6 : 2.4);
    }
    // Lính đang hành quân không chiếm chỗ của khối nào (nếu có, chỗ trống ở hàng đầu bị giữ cả 20–30 s trong lúc họ đi): đứng chờ ở bãi tập kết sau cùng của
    // đội hình; tới nơi (crowd.updateActor, SUPPLY.arrive) thì hết cờ hành quân và lần xếp sau mới cho họ chỗ trống ở hàng đầu.
    for (const a of marching) {                        // ô theo id (không theo thứ tự mảng: một lính khác tới nơi / bị bỏ đi thì cả cột không đổi đích)
      a.slot = undefined; a.pool = null; a.frontRow = false;
      a.sx = lx + dir * (depth + 3 + (Math.floor(a.id / cols) % 6) * 2.2); a.sz = F.laneZ - 20 + (a.id % cols) * 4;
    }
    for (const a of actors) if (!a.frontRow) a.partner = null;
    return frontCols;
  }

  killActor(fid, side) {
    const crowd = this.ctx.crowd;
    const list = crowd.agents.filter((a) => a.role === "actor" && a.front === fid && a.side === side && a.state !== "dead" && a.frontRow);
    const a = list.length ? list[Math.floor(this.ctx.rng.next() * list.length)] : null;
    if (!a) return;
    // người ngã bị đối thủ trước mặt chém: đối thủ vung đòn, người ngã bật về sau
    const P = a.partner && a.partner.state !== "dead" ? a.partner : null;
    if (P) { P.windup = 0; P.atkT = 0; P.fakeCd = Math.max(P.fakeCd, 0.8); }
    a.state = "dead"; a.dieT = 0; a.vx = side === "ta" ? -1.8 : 1.8; a.vz = 0; a.partner = null;
    if (crowd.nearHero(a, 40)) this.ctx.audio.play("fall", a.x, a.z);
  }

  // ---- vùng chiến đấu quanh tướng -------------------------------------------------------------
  updateZone(dt) {
    const ctx = this.ctx, crowd = ctx.crowd, hero = ctx.hero, sim = ctx.sim, rng = ctx.rng;
    this.zoneT = (this.zoneT || 0) - dt;
    if (this.zoneT > 0) return;
    this.zoneT = 0.25;
    const R = ZONE.radius;
    // 1) lính thật xa 45 m → trả về lính diễn (hoặc bỏ nếu không thuộc mặt trận nào)
    for (const a of [...crowd.agents]) {
      if (a.state === "dead") continue;
      const d = Math.hypot(a.x - hero.x, a.z - hero.z);
      if (a.role === "zone" && d > 45 && a.front) { a.role = "actor"; a.token = false; a.forced = false; }
      else if (a.role === "zone" && d > 60 && !a.front) crowd.release(a);
      else if (a.role === "garrison" && d > 70) crowd.release(a);
    }
    if (!hero.alive) return;
    // Trần 30 địch / 20 ta là của vùng chiến đấu quanh tướng: chỉ đếm lính thật trong ZONE.countR m. Trước đây
    // đếm cả các toán ở xa (phản công A1, vây tướng, giữ bờ Kế Sách: 22–28 người) nên đứng trong vòng A2 mà
    // quân đồn trú đã hết thì không sinh thêm ai, G không giảm, P2 kẹt (gặp cả khi không bật làn).
    // Đợt 12a: lính địch "ép" thành thật (a.forced, xem dưới) KHÔNG tính vào enemies: chúng không chiếm chỗ trần mềm, nên không làm chậm
    // việc sinh quân đồn trú / khối quân ở tuyến ở các bước sau.
    let enemies = 0, allies = 0, forcedN = 0;
    const cR2 = ZONE.countR * ZONE.countR, kR2 = ZONE.forcedKeepR * ZONE.forcedKeepR;
    for (const a of crowd.agents) {
      if (!crowd.hittable(a)) continue;
      const d2 = (a.x - hero.x) ** 2 + (a.z - hero.z) ** 2;
      if (d2 >= cR2) continue;
      if (a.side !== "dich") allies++;
      else if (a.forced) { if (d2 < kR2) forcedN++; }      // lính ép đã lùi ra xa (cung kỵ giữ tầm) không giữ hạn mức của lính diễn sát tướng
      else enemies++;
    }
    // 2) lính diễn trong 25 m → lính thật, gần nhất trước, không vượt trần 30 địch / 20 ta; riêng lính địch sát tướng (ZONE.nearR) thì vẫn
    // thành lính thật khi trần đầy, tối đa ZONE.forcedMax người (promotion.js): lính diễn không trúng đòn, đứng cạnh tướng là chém xuyên qua
    const actors = crowd.agents.filter((a) => a.role === "actor" && a.state !== "dead");
    const pr = pickPromotions(actors, hero, { dich: enemies, ta: allies, forced: forcedN }, ZONE);
    for (const a of pr.promote) {
      a.role = "zone"; a.token = false; a.march = false;
      if (a.fake) { a.windup = 0; a.fake = false; }      // nhát chém GIẢ của lính diễn dở dang: bỏ, không thì thành đòn thật không thẻ, không báo trước
      if (a.side !== "dich") allies++; else if (pr.forced.includes(a)) a.forced = true; else enemies++;
    }

    // 2) quân đồn trú: Cứ Điểm địch có G > 0 trong 45 m
    for (const id in sim.bases) {
      const b = sim.bases[id];
      if (b.owner !== "dich" || b.type === "cong" || b.type === "ban_doanh") continue;
      const p = this.basePos(id), d = Math.hypot(p.x - hero.x, p.z - hero.z);
      if (d > 45) continue;
      const have = crowd.agents.filter((a) => a.role === "garrison" && a.src === id && a.state !== "dead").length;
      const want = Math.min(Math.floor(b.G), ZONE.enemies) - have;
      for (let i = 0; i < want && enemies < ZONE.enemies + 6; i++) {
        const ang = rng.range(0, Math.PI * 2), rr = rng.range(2, p.r + 3);
        crowd.spawn({ side: "dich", unit: rng.next() < 0.7 ? "KHIEN_NG" : "CUNGKY_NG", tier: rng.next() < 0.15 ? "tinhnhue" : "thuong",
          role: "garrison", src: id, front: null, x: p.x + Math.cos(ang) * rr, z: p.z + Math.sin(ang) * rr, anchor: { x: p.x, z: p.z, r: p.r, hard: p.r + GARRISON.hardLeash } });
        enemies++;
      }
      if (b.keeperAlive && !this.keepers[id]) this.spawnKeeper(id);
    }
    // 2b) quân giữ cổng Hàm Tử quan (ĐỀ XUẤT BẢN THỬ: cổng không có G trong GDD; thêm để P3 có người giữ)
    for (const id of ["A3", "B3"]) {
      const b = sim.bases[id];
      if (b.open || b.G < 1 || this.phase < 2) continue;
      const g = ctx.world.gates[id], d = Math.hypot(g.x - hero.x, g.z - hero.z);
      if (d > 50) continue;
      const have = crowd.agents.filter((a) => a.role === "garrison" && a.src === id && a.state !== "dead").length;
      const want = Math.min(Math.floor(b.G), 18) - have;
      for (let i = 0; i < want && enemies < ZONE.enemies + 6; i++) {
        // tinh nhuệ ở i % 6 === 1 (khiên binh): trước đợt 9 là i % 6 === 0 — mọi tinh nhuệ giữ cổng đều là cung kỵ (51,8 mỗi mũi tên)
        crowd.spawn({ side: "dich", unit: i % 3 === 0 ? "CUNGKY_NG" : "KHIEN_NG", tier: i % 6 === 1 ? "tinhnhue" : "thuong", role: "garrison", src: id,
          x: g.x - rng.range(4, 14), z: g.z + rng.range(-10, 10), anchor: { x: g.x - 6, z: g.z, r: 8 } });
        enemies++;
      }
    }
    // 3) khối quân TA ở tuyến: bổ sung lính thật từ mép vòng khi thiếu (đợt 12c bỏ phần của địch: lấy từ lính diễn ở tuyến qua cửa ngõ)
    const hf = sim.heroFront;
    if (hf) {
      const F = FRONTS[hf], f = sim.fronts[hf], lx = lineToX(F, f.x);
      const dMass = Math.hypot(Math.max(0, lx - hero.x, hero.x - (lx + 30)), Math.max(0, Math.abs(hero.z - F.laneZ) - 25));
      if (dMass < 22) {
        // Đợt 12c: bỏ khối quân địch mọc ở hero.x + 10…22 m, z ± 16 (pop-in sát tướng, 17–22 lính/phút, canon 13.1 "đúng 30 địch"): vùng chiến đấu giờ lấy địch
        // từ lính diễn ở tuyến (bước 2) — lính ấy xuất từ cửa ngõ (fillActors) — và quân đồn trú. Cửa ngõ đóng thì không còn gì bổ sung.
        const allyFront = crowd.agents.filter((a) => a.role === "zone" && a.front === hf && a.side === "ta" && a.state !== "dead").length;
        const wantA = Math.min(ZONE.allies - this.guardCount(), 12) - allyFront;
        for (let i = 0; i < wantA && allies < ZONE.allies; i++) {
          crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "zone", front: hf, x: hero.x - rng.range(6, 14), z: hero.z + rng.range(-10, 10), legionMult: ctx.stats.legionMult });
          allies++;
        }
      }
    }
  }
  guardCount() { return this.ctx.crowd.agents.filter((a) => (a.role === "guard" || a.role === "follow") && a.state !== "dead").length; }

  spawnGuards() {
    // Thân binh: min(thân binh, 8) hiển thị (21.6: Thống Suất 3 → 10 thân binh). Mốc 75: +50%.
    const ctx = this.ctx, total = ctx.stats.guardBase, shown = Math.min(ZONE.bodyguardsShown, total);
    const have = ctx.crowd.agents.filter((a) => a.role === "guard" && a.state !== "dead").length;
    for (let i = have; i < shown; i++) {
      const a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", tier: ctx.stats.guardLevel >= 3 ? "tinhnhue" : "thuong", role: "guard",
        x: ctx.hero.x - 2 - i * 0.5, z: ctx.hero.z + (i % 2 ? 1.5 : -1.5), legionMult: ctx.stats.legionMult * (1 + 0.1 * (ctx.stats.guardLevel - 1)) });
      a.maxHp *= 1.5; a.hp = a.maxHp;
    }
  }

  // ---- Cứ Điểm ----------------------------------------------------------------------------------
  spawnKeeper(id) {
    const ctx = this.ctx, d = baseDef(id), p = this.basePos(id);
    const u = new BigUnit(ctx, { kind: "officer", side: "dich", tier: d.keeper, name: TIERS[d.keeper].name + " · " + d.name, x: p.x + 2, z: p.z, base: id });
    ctx.units.push(u); this.keepers[id] = u;
  }

  updateBases(dt) {
    const ctx = this.ctx, sim = ctx.sim, hero = ctx.hero;
    // Dòng nhắc gom qua cả vòng lặp, gán một lần ở cuối. Trước đây gán trong vòng lặp: Cứ Điểm địch đứng sau (B2) ghi đè
    // null lên nhắc của A1/A2, nên "Hạ quân đồn trú: còn N" không bao giờ hiện ở hai pha đầu.
    let hint = null;
    for (const id in sim.bases) {
      const b = sim.bases[id], d = baseDef(id);
      if (b.type === "cong" || b.type === "ban_doanh") continue;
      if (b.owner !== "dich") { ctx.world.setBaseProgress(id, 0); this.capT[id] = 0; continue; }
      const p = this.basePos(id);
      const dHero = hero.alive ? Math.hypot(hero.x - p.x, hero.z - p.z) : Infinity, inRing = dHero < p.r;
      const garrison = [];
      for (const a of ctx.crowd.agents) if (a.role === "garrison" && a.src === id && ctx.crowd.hittable(a)) garrison.push(a);
      const garrisonAlive = garrison.length;
      const ready = b.G < 1 && !garrisonAlive && !b.keeperAlive;
      if (inRing && ready) {
        if (this.capPause <= 0) this.capT[id] = (this.capT[id] || 0) + dt * (1 + ctx.stats.mods.capSpeed);
        if (this.capT[id] >= d.cap) this.captureBase(id);
      } else if (!inRing) this.capT[id] = Math.max(0, (this.capT[id] || 0) - dt);
      ctx.world.setBaseProgress(id, (this.capT[id] || 0) / d.cap);
      // "còn N" lấy số lớn hơn giữa G và lính đồn trú còn đứng: mô phỏng bào mòn G về 0 mà lính còn sống thì trước đây ghi "còn 0".
      // Đợt 12b: hiện khi tướng cách đồn < GARRISON.hintR (không chỉ trong vòng — trước đây ẩn ~48% trận A1), kèm "a trong đồn · b ngoài đồn" (garrison.js)
      if (dHero < GARRISON.hintR && !ready) {
        const c = classifyGarrison(p, garrison);
        hint = garrisonHint({ G: b.G, keeperAlive: b.keeperAlive, keeperName: TIERS[d.keeper]?.name, inside: c.inside, outside: c.outside });
      }
    }
    this.baseHint = hint;
  }

  // Những con lính đồn trú cuối cùng còn chặn việc chiếm, cho HUD chỉ đường (hud.js frameBlocker: mũi tên mép màn hình, nhãn nổi trên đầu) — chỉ khi kho G không còn ai
  // ra thêm và còn ≤ GARRISON.pointLast người (garrison.js isLast), Cứ Điểm vẫn của địch; trả con gần tướng nhất [{ id, label, x, y, z, r }], không thì []. (Cổng không tính.)
  blockers() {
    const ctx = this.ctx, crowd = ctx.crowd, sim = ctx.sim, by = {};
    for (const a of crowd.agents) {
      if (a.role !== "garrison" || !a.src || !crowd.hittable(a)) continue;
      const b = sim.bases[a.src];
      if (!b || b.owner !== "dich" || b.type === "cong") continue;
      (by[a.src] = by[a.src] || []).push(a);
    }
    const list = [];
    for (const id in by) if (isLast(sim.bases[id].G, by[id].length)) list.push(...by[id]);       // con cuối của một Cứ Điểm: kho G không còn ai ra thêm (garrison.js isLast)
    if (!list.length) return [];
    const a = nearestBlocker(list, ctx.hero);
    return [{ id: "garrison", label: KITS[a.kit]?.name ?? "Quân đồn trú", x: a.x, y: heightAt(a.x, a.z), z: a.z, r: 2 }];
  }

  captureBase(id) {
    const ctx = this.ctx, b = ctx.sim.bases[id];
    b.owner = "ta"; b.G = b.G0; b.keeperAlive = false; this.capT[id] = 0;
    ctx.world.setBaseOwner(id, "ta");
    // lính đồn trú còn sót (đang ngã, bị hất tung) nhập vào khối quân của mặt trận
    for (const a of ctx.crowd.agents) if (a.role === "garrison" && a.src === id && a.state !== "dead") { a.role = "zone"; a.front = baseDef(id).front; a.anchor = null; }
    this.onBaseTaken(id, "hero");
  }

  onBaseTaken(id, by) {
    const ctx = this.ctx, d = baseDef(id), sim = ctx.sim;
    this.keSach.onBaseTaken(id);
    const optional = id === "B2";
    this.hk(d.hk[0], "chiếm:" + id, optional);
    this.banner(`CHIẾM ${d.name.toUpperCase()}`, "#f1d98a", 1.4); ctx.audio.play("capture");
    if (by === "hero") ctx.hero.heal(0.15);
    if (d.type === "doanh_trai") {
      const f = sim.fronts[d.front];
      f.q.ta.GIAO_DV += 50;
      sim.reinf.charges = Math.min(SIM.allyReinf.maxCharges, sim.reinf.charges + 1);
      const shut = f.door === id;       // cửa ngõ của cánh đóng (đợt 12c): hết hồi quân, hết đợt tiếp viện, hết bù lính ở tuyến
      this.say(shut ? `Doanh trại về tay ta: +50 quân, +1 lượt tiếp viện. Cánh ${d.front} hết viện binh — quân Nguyên còn lại chỉ vơi đi.` : "Doanh trại về tay ta: +50 quân, +1 lượt tiếp viện.", 5, "good");
      if (shut) this.banner(`CỬA NGÕ ${d.front} ĐÓNG · HẾT VIỆN BINH`, "#ffd27a", 1.6);
    }
    const p = this.basePos(id);
    this.drop("ruong", p.x, p.z + 2);
    if (id === "A1" && this.phase === 0) this.completeMain(0);
    if (id === "A2" && this.phase === 1) this.completeMain(1);
    if (id === "B2" && !this.side.S_B2) { this.side.S_B2 = true; this.hk(HAO_KHI.src.sideMission, "nhiệm vụ phụ", true); this.say("Nhiệm vụ phụ: đã chiếm Doanh trại bến dưới.", 4, "good"); }
  }

  damageGate(id, dmg) {
    const ctx = this.ctx, b = ctx.sim.bases[id];
    if (!b || b.open) return;
    this.gateHit = { id, t: this.time };            // lần trúng cuối, cả khi còn khóa: ô mục tiêu hiện cổng 3 s (gatebar.js) — khóa thì kèm vì sao
    if (this.phase < GATE_PHASE) { this.gateNag = (this.gateNag || 0) + 1; if (this.gateNag % 20 === 1) this.say("Cổng Hàm Tử quan chưa phá được — chiếm Doanh trại trên bãi (A2) trước.", 3); return; }
    b.gate = Math.max(0, b.gate - dmg);
    const g = ctx.world.gates[id]; g.shake = 0.25;
    ctx.audio.play("gate", g.x, g.z);
    // số độ bền mất bật lên ở mặt cổng (đợt 15a); ba chỗ lệch z xoay vòng để nhát liền nhau không đè chữ — không dùng ctx.rng (trận xác định)
    this.gateHits = (this.gateHits || 0) + 1;
    ctx.fx.text(g.x - 1.8, g.z + ((this.gateHits % 3) - 1) * 1.4, `−${Math.round(dmg)}`, "#ffd27a");
    if (b.gate <= 0) this.openGate(id);
  }
  // Cổng Hàm Tử quan cho gatebar.js: [{ id, name, x, z, hp, max, open }] (độ bền sim.bases b.gate / b.gate0, chỗ đứng world.gates).
  gateList() {
    const ctx = this.ctx, out = [];
    for (const id in ctx.world.gates) {
      const g = ctx.world.gates[id], b = ctx.sim.bases[id];
      if (b) out.push({ id, name: `${id} · ${baseDef(id).name}`, x: g.x, z: g.z, hp: b.gate, max: b.gate0, open: !!(b.open || ctx.openGates[id]) });
    }
    return out;
  }
  // Ô mục tiêu của HUD (hud.js): cổng vừa bị đánh (≤ 3 s) hoặc cổng chưa mở trong 25 m — tên, độ bền, khóa thì vì sao; null nếu không có.
  gateTarget() { return gateTarget({ gates: this.gateList(), hero: this.ctx.hero, phase: this.phase, now: this.time, lastHit: this.gateHit }); }
  // Thẻ nhiệm vụ P3: mục tiêu kèm phần trăm độ bền còn lại của từng cổng (gatebar.js gateGoal); pha khác null — hud.js dùng PHASES[].goal.
  // short: thẻ một dòng của HUD gọn đang gập → "Phá A3 64% hoặc B3 100%" (gateGoalShort), cho vừa cả hai phần trăm.
  goalText(short = false) {
    if (this.phase !== GATE_PHASE) return null;
    const gs = this.gateList();
    return (short && gateGoalShort(gs)) || gateGoal(PHASES[this.phase].goal, gs);
  }

  openGate(id) {
    const ctx = this.ctx, b = ctx.sim.bases[id], d = baseDef(id), g = ctx.world.gates[id];
    b.open = true; b.owner = "ta"; ctx.openGates[id] = true; g.broken = true;
    ctx.world.setBaseOwner(id, "ta");
    const first = this.gatesOpen() === 1;
    this.hk(d.hk[0], "cổng:" + id, !first);
    const f = ctx.sim.fronts[d.front]; f.sk.ta = Math.min(100, f.sk.ta + 15);
    this.banner(`PHÁ ${d.name.toUpperCase()}`, "#f1d98a", 1.5); ctx.audio.play("gateBreak"); ctx.fx.shake(0.8);
    ctx.fx.dust(g.x, g.z, 3);
    for (const dz of [-5, 0, 5]) ctx.fx.fire(g.x - 0.5, heightAt(g.x, g.z + dz), g.z + dz, 30, 3 + Math.abs(dz) * 0.1);
    this.drop("colenh", g.x - 4, g.z);
    if (first && this.phase === 2) this.completeMain(2);
    if (this.gatesOpen() === 2 && !this.side.S_GATES) { this.side.S_GATES = true; this.hk(HAO_KHI.src.sideMission, "nhiệm vụ phụ", true); this.say("Nhiệm vụ phụ: đã mở cả hai cổng.", 4, "good"); }
  }

  // ---- pha --------------------------------------------------------------------------------------
  completeMain(i) {
    const ctx = this.ctx;
    this.main[i] = true;
    this.hk(HAO_KHI.src.mainMission, "nhiệm vụ chính");
    if (i >= 3) return;
    this.phase = i + 1; this.phaseStart = this.time;
    const P = PHASES[this.phase];
    this.banner(`${P.id} · ${P.name.toUpperCase()}`, "#e6dcc3", 2); ctx.audio.play("drums3");
    if (this.phase === 1) { this.events = { counterA1: { state: "wait" }, surrounded: { state: "wait" } }; ctx.hints?.event("cuaNgo"); }
    if (this.phase === 3) this.startBossPhase();
    // kịch bản đảm bảo Hào Khí ở pha boss (P4 hkFloor = 90): đặt trước khi lưu checkpoint để tải lại P4 vẫn có
    const hkAdd = P.hkFloor ? hkRaiseTo(ctx.hk, P.hkFloor, "kịch bản: pha " + P.id) : 0;
    if (hkAdd > 0) ctx.hud?.hkPulse(hkAdd);
    this.saveCheckpoint();
  }

  // ---- sự kiện động (21.2) ---------------------------------------------------------------------
  updateEvents(dt) {
    if (this.phase < 1) return;
    const ctx = this.ctx, sim = ctx.sim, crowd = ctx.crowd, since = this.time - this.phaseStartP2();
    const E1 = this.events.counterA1, E2 = this.events.surrounded;
    // Cứ Điểm bị phản công (A1)
    if (E1 && E1.state === "wait" && since >= EVENTS.counterA1.at && sim.bases.A1.owner === "ta") this.startCounterA1();
    if (E1 && E1.state === "run") {
      E1.left -= dt;
      const p = this.basePos("A1"), b = sim.bases.A1;
      const squad = crowd.agents.filter((a) => a.role === "squad" && a.src === "counterA1" && crowd.hittable(a));
      const inRing = squad.filter((a) => Math.hypot(a.x - p.x, a.z - p.z) < p.r + 2).length;
      const order = sim.fronts.A.order;
      b.G = Math.max(0, b.G - inRing * EVENTS.counterA1.drain * b.G0 * dt * (order ? 0.5 : 1));   // theo G gốc (đợt 9)
      if (order && (E1.orderKill = (E1.orderKill || 0) + dt) > 2.5 && squad.length) { E1.orderKill = 0; crowd.kill(squad[0], { by: "ally" }); E1.delegated = true; }
      const offAlive = E1.officer && !E1.officer.dead && E1.officer.alive;
      if (b.owner !== "ta" || b.G <= 0) this.endEvent("counterA1", false);
      else if ((squad.length <= 3 && !offAlive) || E1.left <= 0) this.endEvent("counterA1", true);
    }
    // Tướng ta bị vây (H40 ở B2)
    if (E2 && E2.state === "wait" && since >= EVENTS.surrounded.at) this.startSurrounded();
    if (E2 && E2.state === "run") {
      E2.left -= dt;
      const gen = this.generals.H40;
      const squad = crowd.agents.filter((a) => a.role === "squad" && a.src === "surrounded" && crowd.hittable(a));
      const offAlive = E2.officer && !E2.officer.dead && E2.officer.alive;
      const order = sim.fronts.B.order;
      if (order && (E2.orderKill = (E2.orderKill || 0) + dt) > 2.5 && squad.length) { E2.orderKill = 0; crowd.kill(squad[0], { by: "ally" }); E2.delegated = true; }
      if (!gen || gen.dead || !gen.alive) this.endEvent("surrounded", false);
      else if (squad.length <= 4 && !offAlive) this.endEvent("surrounded", true);
      else if (E2.left <= 0) {
        const f = sim.fronts.B, ok = f.lastF.ta / Math.max(1, f.lastF.dich) >= 1.1;   // giao việc cho quân: F_ta/F_địch lúc hết giờ
        this.endEvent("surrounded", ok);
      }
    }
  }
  phaseStartP2() { return this.p2Start ?? (this.phase >= 1 ? (this.p2Start = this.phaseStart) : 0); }

  startCounterA1() {
    const ctx = this.ctx, E = EVENTS.counterA1, p = this.basePos("A1"), ev = this.events.counterA1;
    ev.state = "run"; ev.left = E.limit * this.M.eventMult;
    const sx = p.x + 50, sz = p.z;
    for (let i = 0; i < E.squad; i++) {
      ctx.crowd.spawn({ side: "dich", unit: i % 3 === 2 ? "CUNGKY_NG" : "KHIEN_NG", role: "squad", src: "counterA1",
        x: sx + ctx.rng.range(-6, 6), z: sz + ctx.rng.range(-8, 8), anchor: { x: p.x, z: p.z, r: 5 } });
    }
    const off = new BigUnit(ctx, { kind: "officer", side: "dich", tier: "doitruong", name: "Đội trưởng phản công", x: sx, z: sz, awake: true, aggro: 60 });
    off.home = { x: p.x, z: p.z }; ctx.units.push(off); ev.officer = off;
    this.banner("SỰ KIỆN · CỨ ĐIỂM BỊ PHẢN CÔNG", "#ff8a6a", 2); ctx.audio.play("horn");
    this.say(`Quân Nguyên phản công Đồn bến trên (A1)! Giữ đồn trong ${E.limit} s — tự đánh, hoặc ra lệnh cho mặt trận A.`, 6, "bad");
  }

  startSurrounded() {
    const ctx = this.ctx, E = EVENTS.surrounded, ev = this.events.surrounded, gen = this.generals.H40;
    if (!gen || !gen.alive || gen.dead) { ev.state = "skip"; return; }
    ev.state = "run"; ev.left = E.limit * this.M.eventMult;
    const p = this.basePos("B2"), gx = p.x - 16, gz = p.z + 6;
    gen.x = gx; gen.z = gz; gen.post = { x: gx, z: gz }; gen.inEvent = true;
    for (let i = 0; i < E.squad; i++) {
      const a = (i / E.squad) * Math.PI * 2, r = ctx.rng.range(5, 10);
      ctx.crowd.spawn({ side: "dich", unit: i % 4 === 3 ? "CUNGKY_NG" : "KHIEN_NG", role: "squad", src: "surrounded",
        x: gx + Math.cos(a) * r, z: gz + Math.sin(a) * r, anchor: { x: gx, z: gz, r: 1.8, target: gen } });
    }
    const off = new BigUnit(ctx, { kind: "officer", side: "dich", tier: "doitruong", name: "Đội trưởng vây tướng", x: gx + 7, z: gz, awake: true, aggro: 60 });
    off.home = { x: gx, z: gz }; ctx.units.push(off); ev.officer = off;
    this.banner("SỰ KIỆN · TƯỚNG TA BỊ VÂY", "#ff8a6a", 2); ctx.audio.play("horn");
    this.say(`Nguyễn Khoái bị vây gần Doanh trại bến dưới (B2)! ${E.limit} s — sang cứu, hoặc ra lệnh cho mặt trận B.`, 6, "bad");
  }

  endEvent(id, ok) {
    const ctx = this.ctx, E = EVENTS[id], ev = this.events[id];
    ev.state = ok ? "win" : "lose";
    const r = ok ? E.win : E.lose;
    if (r.hk) this.hk(r.hk, "sự kiện:" + id, true);
    if (r.sk) { const f = ctx.sim.fronts[id === "surrounded" ? "B" : "A"]; f.sk.ta = Math.max(0, Math.min(100, f.sk.ta + r.sk)); }
    ev.how = ok ? (ev.delegated ? "giao cho quân" : "tự làm") : "thất bại";
    if (!ok && id === "counterA1" && ctx.sim.bases.A1.owner === "ta") { ctx.sim.bases.A1.owner = "dich"; ctx.sim.bases.A1.G = Math.round(ctx.sim.bases.A1.G0 * 0.5); ctx.world.setBaseOwner("A1", "dich"); this.hk(baseDef("A1").hk[1], "mất:A1"); }
    // lính còn lại của toán rút đi
    for (const a of ctx.crowd.agents) if (a.role === "squad" && a.src === id && a.state !== "dead") { a.role = "zone"; a.anchor = null; a.front = id === "surrounded" ? "B" : "A"; }
    if (id === "surrounded" && this.generals.H40) { this.generals.H40.inEvent = false; }
    this.banner(ok ? `${E.name.toUpperCase()} · GIỮ ĐƯỢC` : `${E.name.toUpperCase()} · THẤT BẠI`, ok ? "#f1d98a" : "#ff8a6a", 1.8);
  }

  // ---- tướng đồng minh ---------------------------------------------------------------------------
  spawnGenerals() {
    const ctx = this.ctx;
    for (const id in ALLY_GENERALS) {
      const G = ALLY_GENERALS[id], F = FRONTS[G.front], f = ctx.sim.fronts[G.front];
      const x = lineToX(F, f.x) - 5, z = F.laneZ + (id === "H33" ? -5 : 5);
      const u = new BigUnit(ctx, { kind: "general", side: "ta", tier: "ally", rigKey: id, name: G.name, id, hp: G.hp, x, z, yaw: Math.PI / 2, hpFrac: f.general.hp });
      ctx.units.push(u); this.generals[id] = u;
    }
  }
  updateGenerals(dt) {
    const ctx = this.ctx, sim = ctx.sim;
    for (const id in ALLY_GENERALS) {
      const G = ALLY_GENERALS[id], f = sim.fronts[G.front], F = FRONTS[G.front];
      let u = this.generals[id];
      if ((!u || !u.alive) && f.general.alive) {
        // trở lại trận
        const x = lineToX(F, f.x) - 8, z = F.laneZ;
        u = new BigUnit(ctx, { kind: "general", side: "ta", tier: "ally", rigKey: id, name: G.name, id, hp: G.hp, x: Math.max(40, x - 30), z, yaw: Math.PI / 2, hpFrac: f.general.hp });
        ctx.units.push(u); this.generals[id] = u;
      }
      if (!u || !u.alive) continue;
      if (!f.general.alive && !u.dead) { u.dead = 0.001; continue; }
      if (!u.inEvent) u.post = { x: lineToX(F, f.x) - 5, z: F.laneZ + (id === "H33" ? -5 : 5) };
      const far = Math.hypot(u.x - ctx.hero.x, u.z - ctx.hero.z) > 60 && !u.inEvent;
      if (far) u.hp = u.maxHp * f.general.hp; else f.general.hp = u.hp / u.maxHp;
      if (ctx.hk.tpc) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.01 * dt);
    }
  }
  onAllyGeneralDown(u) {
    const f = this.ctx.sim.fronts[ALLY_GENERALS[u.id].front];
    f.general.alive = false; f.general.hp = 0; f.general.down = 90;
    this.say(`${u.name} bị thương nặng, phải rút lui!`, 4, "bad");
  }

  // ---- boss Toa Đô (P4) --------------------------------------------------------------------------
  startBossPhase() {
    const ctx = this.ctx, b = MAP.beach;
    const boss = new BigUnit(ctx, { kind: "boss", side: "dich", tier: "tuong", name: "Toa Đô", x: b.x + 10, z: b.z - 10, awake: false, aggro: 45 });
    boss.retreatTo = { x: 540, z: MAP.riverNorthZ - 6 };
    ctx.units.push(boss); this.boss = boss; this.bossSpawned = true; this.landT = 8;
    // "Toa Đô núng thế" (PHASES[3].hkBoss): nhớ số lần Tổng Phản Công lúc vào P4 (cả khi tải lại checkpoint P4); Tổng Phản
    // Công kích ở P3 còn chạy sang P4 thì coi như pha boss đã có Tổng Phản Công — kịch bản không bù lần hai
    this.bossHk = { tpc0: ctx.hk.tpcCount, done: !!ctx.hk.tpc };
    this.say("Toa Đô ở bãi cát trong Hàm Tử quan. Đánh lui hắn để thắng trận.", 6);
  }
  updateBossPhase(dt) {
    const ctx = this.ctx;
    if (!this.boss || this.boss.retreating) return;
    // kịch bản "Toa Đô núng thế": Toa Đô mất 30% Sinh lực lần đầu → Hào Khí lên 100 nếu từ đầu P4 chưa kích Tổng Phản Công
    const B = PHASES[3].hkBoss, bh = this.bossHk;
    if (B && bh && !bh.done && this.boss.hp < this.boss.maxHp * B.hpBelow) {
      bh.done = true;
      const add = !ctx.hk.tpc && ctx.hk.tpcCount === bh.tpc0 ? hkRaiseTo(ctx.hk, B.value, "kịch bản: Toa Đô núng thế") : 0;
      if (add > 0) {
        ctx.hud?.hkPulse(add); this.banner("TOA ĐÔ NÚNG THẾ · HÀO KHÍ DÂNG ĐẦY", "#f1d98a", 1.6); ctx.audio.play("cheer");
        this.say("Toa Đô núng thế! Hào Khí đã đầy — kích Tổng Phản Công.", 4, "good");
      }
    }
    this.landT -= dt;
    if (this.landT <= 0) {
      this.landT = 30;
      const L = MAP.landing[Math.floor(ctx.rng.next() * MAP.landing.length)];
      for (let i = 0; i < 30; i++) {
        ctx.crowd.spawn({ side: "dich", unit: i % 3 === 0 ? "CUNGKY_NG" : "KHIEN_NG", tier: i % 10 === 0 ? "tinhnhue" : "thuong", role: "landing",
          x: L.x + ctx.rng.range(-8, 8), z: L.z + ctx.rng.range(-4, 4) });
      }
      this.say("Quân Nguyên đổ bộ từ mép nước!", 3, "bad"); ctx.audio.play("horn", L.x, L.z);
    }
  }
  onBossDefeated(boss) {
    const ctx = this.ctx;
    this.bq.clear(); ctx.fx.banner("TOA ĐÔ RÚT CHẠY!", "#f1d98a", 2.5); ctx.audio.play("drums3");   // băng kết trận hiện ngay, không xếp hàng
    this.main[3] = true; this.hk(HAO_KHI.src.mainMission, "nhiệm vụ chính");
    this.bossDown = true; this.winAt = this.time + 2.5;     // đồng hồ trận, không dùng giờ thật
  }
  onCounterBoss() {
    if (this.counterBoss < HAO_KHI.src.counterBossMax) { this.counterBoss++; this.hk(HAO_KHI.src.counterBoss, "phản đòn Toa Đô"); }
  }

  // ---- hạ địch ---------------------------------------------------------------------------------
  onSoldierKilled(a, opt) {
    const ctx = this.ctx, sim = ctx.sim, byHero = opt.by === "hero";
    if (a.side === "dich") {
      if (a.role === "garrison" && a.src) { const b = sim.bases[a.src]; if (b) b.G = Math.max(0, b.G - 1); }
      else if (a.role === "zone" && a.front) {
        let take = !byHero;
        if (byHero) {
          const used = this.swingQ.get(opt.swing) || 0;
          if (used < SIM.heroQCap.perSwing && this.qBucket >= 1) { this.swingQ.set(opt.swing, used + 1); this.qBucket -= 1; take = true; }
          if (this.swingQ.size > 64) this.swingQ.clear();
        }
        if (take) sim.fronts[a.front].pendingKills.dich += 1;
      }
      if (byHero) {
        this.ko++;
        if (this.ko % HAO_KHI.src.koMilestoneEvery === 0 && this.koMs < HAO_KHI.src.koMilestoneCap) { this.koMs++; this.hk(HAO_KHI.src.koMilestone, "mốc KO"); }
        const m = ctx.stats.mods;
        if (m.koHeal && this.ko % m.koHeal === 0) ctx.hero.heal(0.01);
        if (m.koSk && this.ko % m.koSk === 0 && sim.heroFront) sim.fronts[sim.heroFront].sk.ta = Math.min(100, sim.fronts[sim.heroFront].sk.ta + 1);
      }
    } else {
      if (a.role === "zone" && a.front) sim.fronts[a.front].pendingKills.ta += 1;
      if (a.role === "follow" && this.followers) this.followers.q = Math.max(0, this.followers.q - 1);
      if (a.role === "guard") (this.guardDue = this.guardDue || []).push(this.time + 20);   // thân binh bổ sung sau 20 s
    }
  }
  onOfficerAwake(u) { if (u.tier === "tuong") { this.ctx.fx.banner("TOA ĐÔ", "#ff8a6a", 1.6); this.ctx.audio.play("horn"); } }
  onOfficerKilled(u) {
    const ctx = this.ctx;
    if (u.tier === "doitruong") this.hk(HAO_KHI.src.killCaptain, "hạ đội trưởng");
    if (u.tier === "photuong") this.hk(HAO_KHI.src.killVice, "hạ phó tướng");
    this.ko++;
    if (u.base) { ctx.sim.bases[u.base].keeperAlive = false; this.keepers[u.base] = null; }
    const pen = TIERS[u.tier].q;
    const hf = ctx.sim.heroFront; if (hf) ctx.sim.fronts[hf].pendingKills.dich += pen;
    ctx.fx.banner(`ĐÃ HẠ ${TIERS[u.tier].name.toUpperCase()}`, "#e6dcc3", 1.2);
    ctx.slowmo?.(0.55, 0.28); ctx.fx.flash(0.4); ctx.audio.play("finisher", u.x, u.z); ctx.audio.play("cheer");
    for (const k of DROPS[u.tier] || []) this.drop(k, u.x + ctx.rng.range(-1.5, 1.5), u.z + ctx.rng.range(-1.5, 1.5));
  }
  onBreak(u) { this.ctx.fx.banner("VỠ THẾ · ĐÒN MẠNH ĐỂ RA ĐÒN QUYẾT", "#ffd27a", 1.2); this.ctx.audio.play("parry", u.x, u.z); }
  onHeroHit(h) {
    this.capPause = 0.5;
    if (h.red) {          // đòn viền đỏ trúng: tiến độ chiếm về 0. Luật này trước đây không chỗ nào nói; gợi ý lần đầu nói đúng lúc nó cắn (hints.js)
      const capturing = Object.values(this.capT).some((v) => v > 0.5);
      for (const k in this.capT) this.capT[k] = 0;
      if (capturing) this.ctx.hints?.event("chiemNgat");
    }
  }
  onRevive() { this.hk(HAO_KHI.src.reviveUsed, "gượng dậy"); this.revived = true; }
  onUlt() { }
  ultQ(q) { const hf = this.ctx.sim.heroFront; if (hf) this.ctx.sim.fronts[hf].pendingKills.dich += q; }
  onHeroDead() { if (!this.bossDown) this.lose("Trần Quốc Toản gục ngã.", true); }

  plantFlag(x, z, r, atk, dur) {
    const ctx = this.ctx;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 5), new THREE.MeshLambertMaterial({ color: 0x1d1a17 }));
    pole.position.y = 2.5; g.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.2), new THREE.MeshLambertMaterial({ map: flagTexture("破強敵報皇恩"), side: THREE.DoubleSide }));
    cloth.position.set(0.4, 3.6, 0); g.add(cloth);
    g.position.set(x, heightAt(x, z), z); ctx.scene.add(g);
    this.flags.push({ x, z, r, atk, t: dur, g });
    ctx.fx.ring(x, z, r, 0xf1d98a, 0.8); ctx.audio.play("drum");
    this.say(`Cắm cờ: quân ta trong ${r} m Công +${Math.round(atk * 100)}% trong ${dur} s.`, 3, "good");
  }
  updateFlags(dt) {
    for (const f of this.flags) { f.t -= dt; if (f.t <= 0) this.ctx.scene.remove(f.g); }
    this.flags = this.flags.filter((f) => f.t > 0);
    const h = this.ctx.hero;
    h.buffs.flag = this.flags.some((f) => Math.hypot(h.x - f.x, h.z - f.z) < f.r) ? this.flags[0].atk : 0;
  }

  // ---- vật phẩm -----------------------------------------------------------------------------
  drop(kind, x, z) {
    const P = PICKUPS[kind]; if (!P) return;
    const m = pickupMesh(P.color); m.position.set(x, heightAt(x, z), z); this.ctx.scene.add(m);
    this.pickups.push({ kind, x, z, m, t: 60 });
  }
  updatePickups(dt) {
    const ctx = this.ctx, h = ctx.hero;
    for (const p of this.pickups) {
      p.t -= dt; p.m.userData.gem.rotation.y += dt * 2; p.m.userData.gem.position.y = 0.8 + Math.sin(p.t * 3) * 0.12;
      if (h.alive && Math.hypot(h.x - p.x, h.z - p.z) < 1.8) { this.applyPickup(p.kind); p.t = 0; }
      if (p.t <= 0) ctx.scene.remove(p.m);
    }
    this.pickups = this.pickups.filter((p) => p.t > 0);
  }
  applyPickup(kind) {
    const ctx = this.ctx, P = PICKUPS[kind], h = ctx.hero;
    if (P.heal) h.heal(P.heal);
    if (P.ki) h.addKi(P.ki);
    if (P.atkBuff) { h.buffs.atk = P.atkBuff; h.buffs.atkT = P.dur; }
    if (P.coin) { const c = Math.round(P.coin * (1 + 0.05 * (ctx.R - 1))); this.chestCoins += c; ctx.fx.text(h.x, h.z, `+${c} Tiền`, "#f1d98a"); }
    else ctx.fx.text(h.x, h.z, `${P.name}: ${P.text}`, "#e6dcc3");
    ctx.audio.play("pickup");
    this.itemsUsed = (this.itemsUsed || 0) + 1;
  }

  // ---- lệnh của người chơi ---------------------------------------------------------------------
  order(frontId, id) {
    const ctx = this.ctx, sim = ctx.sim;
    if (id === "theota") return this.toggleFollow();
    const r = issueOrder(sim, frontId, id);
    if (r.ok) {
      ctx.audio.play("drum");
      this.say(`${ORDERS[id].name} → ${FRONTS[frontId].name}${id === "tiepvien" ? " (tới sau 20 s)" : ""}`, 3, "good");
      this.orders = (this.orders || 0) + 1;
    } else this.say(r.why === "charges" ? "Hết lượt tiếp viện." : `${ORDERS[id].name} đang hồi (${Math.ceil(sim.cooldowns[id])} s).`, 2.5);
    return r;
  }
  toggleFollow() {
    const ctx = this.ctx, sim = ctx.sim;
    if (this.followers) {
      const f = sim.fronts[this.followers.front];
      f.q.ta.GIAO_DV += this.followers.q;
      for (const a of ctx.crowd.agents) if (a.role === "follow") ctx.crowd.release(a);
      this.followers = null; this.say("Đội theo tướng trở về mặt trận.", 2.5);
      return { ok: true };
    }
    if (sim.cooldowns.theota > 0) { this.say(`Theo ta đang hồi (${Math.ceil(sim.cooldowns.theota)} s).`, 2.5); return { ok: false }; }
    const fid = sim.heroFront || this.lastFront, f = sim.fronts[fid];
    const q = Math.min(ORDERS.theota.q, Math.floor(f.q.ta.GIAO_DV));
    f.q.ta.GIAO_DV -= q;
    this.followers = { front: fid, q };
    const n = Math.min(ORDERS.theota.show, q);
    for (let i = 0; i < n; i++) ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", role: "follow", x: ctx.hero.x - 4 - ctx.rng.range(0, 4), z: ctx.hero.z + ctx.rng.range(-4, 4), legionMult: ctx.stats.legionMult });
    issueOrder(sim, fid, "theota");
    this.say(`Theo ta: ${q} quân bám theo tướng (bấm lại để trả về mặt trận).`, 3, "good");
    ctx.audio.play("drum"); this.orders = (this.orders || 0) + 1;
    return { ok: true };
  }

  // ---- Tổng Phản Công ----------------------------------------------------------------------------
  tryTPC() {
    const ctx = this.ctx;
    if (ctx.hk.tpc) return false;
    if (!tpcReady(ctx.hk)) { this.say(`Hào Khí ${Math.floor(ctx.hk.value)}/100 — chưa đủ để kích Tổng Phản Công.`, 2); return false; }
    const dur = hkActivate(ctx.hk);
    const hf = ctx.sim.heroFront || this.lastFront;
    const flipped = triggerTPC(ctx.sim, hf, dur);
    for (const id of flipped) { ctx.world.setBaseOwner(id, "ta"); this.onBaseTaken(id, "tpc"); }
    for (const fid in FRONTS) ctx.sim.fronts[fid].order = { id: "tiencong", left: dur };
    ctx.hero.hkUltReady = true;
    this.tpcLog = this.tpcLog || []; this.tpcLog.push({ at: Math.round(this.time), front: hf, flipped: flipped.length });
    ctx.cinematic("TỔNG PHẢN CÔNG", ctx.hero, true);
    ctx.audio.play("drums3"); ctx.audio.play("horn");
    this.fillActors(false);
    return true;
  }
  onTpcEnd() { this.say("Tổng Phản Công kết thúc. Sĩ Khí quân ta còn được tiếp sức 30 s.", 3); this.fillActors(false); }

  // ---- checkpoint đầu pha, thắng thua -------------------------------------------------------------
  saveCheckpoint() {
    const ctx = this.ctx, h = ctx.hero;
    this.checkpoint = {
      phase: this.phase, phaseStart: this.phaseStart, time: this.time, p2Start: this.p2Start,
      sim: simSnapshot(ctx.sim), hk: clone(ctx.hk), main: [...this.main], side: { ...this.side },
      hero: { hp: h.hp, ki: h.ki, revives: h.revives, x: h.x, z: h.z }, ko: this.ko, koMs: this.koMs,
      openGates: { ...ctx.openGates }, events: clone(Object.fromEntries(Object.entries(this.events).map(([k, v]) => [k, { state: v.state === "run" ? "wait" : v.state }]))),
      chestCoins: this.chestCoins, counterBoss: this.counterBoss, keSach: this.keSach.snapshot(),
    };
  }
  restoreCheckpoint() {
    const ctx = this.ctx, c = this.checkpoint, h = ctx.hero;
    for (const a of [...ctx.crowd.agents]) ctx.crowd.release(a);
    for (const u of ctx.units) if (u.alive) u.dispose();
    ctx.units.length = 0; this.keepers = {}; this.generals = {}; this.boss = null;
    for (const p of this.pickups) ctx.scene.remove(p.m); this.pickups = [];
    for (const f of this.flags) ctx.scene.remove(f.g); this.flags = [];
    Object.assign(ctx.sim, clone(c.sim)); Object.assign(ctx.hk, clone(c.hk));
    this.phase = c.phase; this.phaseStart = c.phaseStart; this.time = c.time; this.p2Start = c.p2Start;
    this.main = [...c.main]; this.side = { ...c.side }; this.ko = c.ko; this.koMs = c.koMs; this.chestCoins = c.chestCoins; this.counterBoss = c.counterBoss;
    this.events = clone(c.events); this.followers = null; this.capT = {}; this.gateHit = null;
    for (const id in ctx.openGates) ctx.openGates[id] = !!c.openGates[id];
    for (const id in ctx.world.gates) ctx.world.gates[id].broken = !!c.openGates[id];
    for (const id in ctx.sim.bases) ctx.world.setBaseOwner(id, ctx.sim.bases[id].owner);
    // Sinh lực tải lại ≥ 50% (đợt 9): trước đây lấy đúng máu lúc vào pha — vào P4 với 18 HP, 0 Gượng dậy thì thử lại mãi vẫn gục
    h.alive = true; h.state = "free"; h.hp = Math.max(c.hero.hp, h.maxHp * HERO.retryHp); h.ki = c.hero.ki; h.revives = c.hero.revives; h.x = c.hero.x; h.z = c.hero.z; h.invuln = 2; h.lock = null;
    for (const fid in FRONTS) this.prevQ[fid] = { ta: totalQ(ctx.sim.fronts[fid], "ta"), dich: totalQ(ctx.sim.fronts[fid], "dich") };
    this.over = false; this.result = null; this.retries = (this.retries || 0) + 1;
    // checkpoint chỉ lưu trước khi Toa Đô xuất hiện nên luôn bossDown = false. Trước đây tải lại P4 trong 2,5 s sau khi Toa Đô
    // rút chạy giữ nguyên bossDown, winAt cũ: tướng không thể thua (onHeroDead bỏ qua) và trận tự thắng khi đồng hồ tua lại
    // chạm winAt dù Toa Đô mới còn đủ máu.
    this.bossDown = false; this.winAt = null;
    this.spawnGenerals(); this.spawnGuards(); this.fillActors(true);
    if (this.phase === 3) this.startBossPhase();
    this.keSach.restore(c.keSach);
    this.bq.clear();
    this.say(`Tải lại đầu pha ${PHASES[this.phase].id}.`, 3);
  }

  win() {
    if (this.over) return;
    this.over = true;
    this.result = this.buildResult(true, "Toa Đô rút chạy khỏi bến Hàm Tử.");
    this.ctx.audio.play("victory");
  }
  lose(why, canRetry = true) {
    if (this.over) return;
    this.over = true;
    this.result = this.buildResult(false, why); this.result.canRetry = canRetry && !!this.checkpoint;
    this.ctx.audio.play("defeat");
  }
  buildResult(won, why) {
    const ctx = this.ctx, sim = ctx.sim;
    let q = 0, q0 = 0; for (const f of Object.values(sim.fronts)) { q += totalQ(f, "ta"); q0 += f.q0.ta; }
    const nonHq = Object.values(sim.bases).filter((b) => b.type !== "ban_doanh");
    const owned = nonHq.filter((b) => b.owner === "ta").length;
    const mainDone = this.main.filter(Boolean).length, sideDone = Object.values(this.side).filter(Boolean).length;
    return {
      won, why, R: ctx.R, difficulty: ctx.diff.id, timeSec: this.time,
      missions: (mainDone / 4) * 0.8 + (sideDone / 2) * 0.2,
      qRatio: q / q0, baseRatio: owned / nonHq.length, ko: this.ko,
      // hkLog: điểm gốc theo nguồn; dòng kịch bản (raiseTo) là điểm thanh, ghi rõ đơn vị để bảng cuối trận khỏi lẫn
      hkRaw: ctx.hk.rawTotal, hkOptional: ctx.hk.optional,
      hkLog: { ...ctx.hk.log, ...Object.fromEntries(Object.entries(ctx.hk.script || {}).map(([k, v]) => [`${k} (đặt thẳng, điểm thanh)`, v])) },
      avgSK: this.skSamples ? this.skSum / this.skSamples : 50, bossDefeated: !!this.bossDown,
      tpcCount: ctx.hk.tpcCount, chestCoins: this.chestCoins, extraTT: this.extraTT,
      events: Object.fromEntries(Object.entries(this.events).map(([k, v]) => [k, v.how || v.state])),
      orders: this.orders || 0, items: this.itemsUsed || 0, mainDone, sideDone, mode: this.mode,
      keSach: this.keSach.ratio(), keSachOk: this.keSach.successCount(), keSachList: this.keSach.hud().map((k) => ({ id: k.id, state: k.state, name: k.name, word: k.word, got: k.got, hk: k.hk })),
      bossMet: !!this.bossSpawned,
    };
  }
}
