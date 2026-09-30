// battle/crowd.js — lính thường: lính diễn (actor) và lính vùng chiến đấu (zone …).
//
// Hai tầng tác tử gần (mục 15.2):
//   - actor: lính diễn đứng theo đội hình ở tuyến mặt trận, chỉ diễn lại kết quả mô phỏng.
//     Không trúng đòn, không gây đòn.
//   - zone / garrison / squad / landing / guard / follow: lính thật trong vùng r 25 m quanh
//     tướng người chơi — trúng đòn, gây đòn, KO của chúng trừ Q hoặc G.
// Mỗi binh chủng chia thành vài kiểu lính (KITS: đao, thương, cung, lực sĩ, nỏ…) khác vũ khí, tầm
// đánh và hoạt ảnh. Mỗi kiểu lính là một InstancedMesh skinned (soldiers.js): 15 khúc thân xoay
// được theo khớp, ma trận khớp đọc từ texture, nên lính bước chân, vung đòn, ngã theo nhiều kiểu
// mà cả đám đông chỉ tốn một lượt vẽ cho mỗi kiểu lính. Lính gần tướng (LOD gần) còn có chân bám
// đất, vạt áo đung đưa, tua giáo và đuôi ngựa treo theo trọng lực (soldierFrame, soldier-motion.js).

import * as THREE from "three";
import { blobGeometry, lambert } from "./models.js";
import { skinnedKit, poseFor, soldierFrame, resetMotion, advanceStride, smoothPose, legRate, NCH, BONE_FLOATS, BONE_TEX_W } from "./soldiers.js";
import { heightAt, collide } from "./world.js";
import { TIERS, UNITS, KITS, AI, MOVES, pickKit, g, heSoGiap } from "../data/tuning.js";
import { speedFactor, rangeMult, hitMult, heightDamageMult, perchNear } from "../sim/terrain-rules.js";   // dốc, bùn, thế đất cao

const KIT_IDS = Object.keys(KITS);
const CAP = 900;                 // mỗi kiểu lính; lính diễn tối đa ~800 + vùng chiến đấu
const TWO_PI = Math.PI * 2;
const HITTABLE = new Set(["zone", "garrison", "squad", "landing", "guard", "follow"]);
const HEAVY_MOVES = new Set(["N6", "C1", "C2", "C3", "C4", "C5", "C6", "DC", "DQ"]);     // đòn đáng né
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();
const _pose = new Float32Array(NCH);
const LOD_FAR2 = 40 * 40;        // xa hơn 40 m: tính lại tư thế mỗi 3 khung, khung khác chép ma trận cũ; không IK, không mô phỏng vạt/tua

let NEXT_ID = 1;

export class Crowd {
  constructor(scene, ctx) {
    this.ctx = ctx; this.agents = []; this.free = [];
    this.meshes = {};
    const mat = lambert();
    for (const k of KIT_IDS) {
      const S = skinnedKit(k, CAP, mat);
      // màu instance: chớp trắng khi trúng, ánh đỏ báo đòn, lệch sáng tối từng người
      S.color = S.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3).fill(1), 3);
      scene.add(S.mesh); this.meshes[k] = S;
    }
    this.frame = 0;
    this.blob = new THREE.InstancedMesh(blobGeometry(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 2200);
    this.blob.frustumCulled = false; this.blob.count = 0; scene.add(this.blob);
    this.arrows = []; this.heroKills = []; this.cheerT = 0;
    const ag = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 3); ag.rotateX(Math.PI / 2);
    this.arrowMesh = new THREE.InstancedMesh(ag, new THREE.MeshBasicMaterial({ color: 0x2a2018 }), 200);
    this.arrowMesh.frustumCulled = false; this.arrowMesh.count = 0; scene.add(this.arrowMesh);
  }

  spawn(o) {
    const a = this.free.pop() || {};
    const tier = TIERS[o.tier || "thuong"], U = UNITS[o.unit];
    const R = this.ctx.R;
    const lvl = o.side === "dich" ? g(R) : g(R) * (o.legionMult || 1);
    // Kiểu lính chọn theo băm id (dãy tỉ lệ vàng, phủ đều tỉ lệ w) — không ăn vào chuỗi rng của trận.
    const id = NEXT_ID++;
    const kit = o.kit || pickKit(o.unit, (id * 0.6180339887) % 1), K = KITS[kit];
    Object.assign(a, {
      id, alive: true, side: o.side, unit: o.unit, kit, K, tier: o.tier || "thuong", role: o.role || "zone",
      front: o.front ?? null, src: o.src ?? null,
      x: o.x, z: o.z, y: 0, vy: 0, yaw: o.yaw ?? (o.side === "ta" ? Math.PI / 2 : -Math.PI / 2), vx: 0, vz: 0,
      maxHp: tier.hp * U.rel[0] * K.hp * lvl, cong: tier.cong * U.rel[1] * K.cong * lvl, giap: tier.giap * U.rel[2] * K.giap * lvl,
      speed: (o.unit === "CUNGKY_NG" ? 5.2 : 3.1) * K.speed * (0.9 + 0.2 * this.ctx.rng.next()),
      state: "move", st: 0, atkCd: 1 + this.ctx.rng.next() * tier.every, windup: 0, windupT: K.windup, atkT: 9, fake: false,
      token: false, target: null, sx: o.sx ?? o.x, sz: o.sz ?? o.z, anchor: o.anchor || null,
      flash: 0, stun: 0, dieT: 0, flinch: 0, hitFront: 1, launchDeath: false, bob: this.ctx.rng.next() * 6.28, fakeCd: this.ctx.rng.next() * 3,
      walk: this.ctx.rng.next() * TWO_PI, spd: 0, mvx: 0, mvz: 1, gx: NaN, gz: NaN, gy: 0, ready: false, poseInit: false, frontRow: false,
      slotAng: undefined, blockT: 0, blockCd: 0, evadeT: 0, evadedSwing: -1, chargeT: 0, chargeCd: 2 + this.ctx.rng.next() * 4, chargeHit: false, fleeT: 0,
      hitBy: 0, scale: tier.scale * (K.scale || 1), lvl: o.lvl || 1, fading: 0, tint: o.tint || null, panicT: 0,
    });
    if (!a.pose) a.pose = new Float32Array(NCH);
    resetMotion(a);                  // lò xo vạt áo, dây tua, trọng số IK của lần dùng trước (pool)
    a.hp = a.maxHp;
    this.agents.push(a);
    return a;
  }

  release(a) {
    a.alive = false; a.role = "free";
    const i = this.agents.indexOf(a);
    if (i >= 0) { this.agents[i] = this.agents[this.agents.length - 1]; this.agents.pop(); }
    this.free.push(a);
  }

  hittable(a) { return a.alive && a.state !== "dead" && HITTABLE.has(a.role); }

  // Sát thương vào lính. src: 'hero' | agent | 'ally'. Trả về true nếu hạ.
  damage(a, dmg, opt = {}) {
    if (!this.hittable(a)) return false;
    const kx = opt.kx ?? 0, kz = opt.kz ?? 0;
    const hard = opt.launch || (opt.knock || 2.5) >= 5;
    a.hitFront = kx * Math.sin(a.yaw) + kz * Math.cos(a.yaw) <= 0 ? 1 : -1;   // bị đẩy về sau lưng = trúng trước mặt
    // đỡ khiên: đòn N của tướng trúng trước mặt, lính không đang gồng đòn, không đang chạy tán loạn
    const pb = AI.block[a.kit] || 0;
    if (pb && opt.by === "hero" && !hard && a.hitFront > 0 && a.windup <= 0 && a.blockCd <= 0 && a.fleeT <= 0 && this.ctx.rng.chance(pb)) {
      a.hp -= dmg * AI.blockDmg; a.blockT = 0.32; a.blockCd = AI.blockCd; a.flinch = 0.12;
      const fx = this.ctx.fx; fx?.spark(a.x - kx * 0.5, heightAt(a.x, a.z) + 1.3 * a.scale, a.z - kz * 0.5, false, 0xf1d98a);
      this.ctx.audio?.play("block", a.x, a.z);
      a.x += kx * 0.25; a.z += kz * 0.25;
      if (a.hp <= 0) { this.kill(a, opt); return true; }
      return false;
    }
    a.hp -= dmg; a.flash = 0.12; a.blockT = 0;
    if (opt.stun) a.stun = Math.max(a.stun, opt.stun);
    if (a.hp <= 0) { this.kill(a, opt); return true; }
    // lực sĩ trọng giáp: đòn thường chỉ làm khựng người, không cắt được đòn đang gồng
    if (a.K.stable && !hard) { a.flinch = 0.18; return false; }
    if (opt.launch && !a.K.mounted && !a.K.stable) { a.state = "launch"; a.vy = 6.5; a.st = 0; a.vx = kx * 2; a.vz = kz * 2; a.windup = 0; }
    else if (a.state !== "launch") { a.state = "hit"; a.st = 0.32; a.vx = kx * (opt.knock || 2.5); a.vz = kz * (opt.knock || 2.5); a.windup = 0; }
    return false;
  }

  kill(a, opt = {}) {
    a.launchDeath = a.state === "launch" || !!opt.launch;
    a.state = "dead"; a.dieT = 0; a.hp = 0; a.token = false;
    a.vx = (opt.kx ?? 0) * (opt.knock || 3); a.vz = (opt.kz ?? 0) * (opt.knock || 3);
    if (opt.launch) a.vy = Math.max(a.vy, 5);
    a.chargeT = 0; a.fleeT = 0;
    this.ctx.director?.onSoldierKilled(a, opt);
    // tướng chém ngã nhiều người trong chốc lát → lính yếu quanh đó hoảng, bỏ chạy
    if (opt.by === "hero" && a.side === "dich") {
      this.cheerT = Math.min(2.5, this.cheerT + 1.2);                   // khán đài reo hò (Võ trường)
      const t = this.ctx.clock, R = AI.rout, hero = this.ctx.hero;
      this.heroKills.push(t);
      while (this.heroKills.length && t - this.heroKills[0] > R.window) this.heroKills.shift();
      if (this.heroKills.length >= R.kills) {
        this.heroKills.length = 0;
        this.rout(hero.x, hero.z, R.nearR, (e) => e.tier === "thuong" && e.hp < e.maxHp * 0.6);
      }
    }
  }

  // Vỡ trận: lính địch trong bán kính r (trừ lực sĩ trọng giáp) bỏ chạy khỏi tướng vài giây.
  rout(x, z, r, filter = null) {
    const R = AI.rout, rng = this.ctx.rng;
    let n = 0;
    for (const e of this.agents) {
      if (e.side !== "dich" || !this.hittable(e) || e.K.stable || e.fleeT > 0) continue;
      if (Math.hypot(e.x - x, e.z - z) > r || (filter && !filter(e))) continue;
      e.fleeT = rng.range(R.dur[0], R.dur[1]); e.token = false; e.windup = 0; e.chargeT = 0; n++;
    }
    if (n >= 3) this.ctx.fx?.text(x, z, "Quân Nguyên núng thế!", "#f1d98a");
    return n;
  }

  // Lính cận chiến đang vây tướng tự giãn góc với nhau: lính có thẻ tấn công chia đều quanh tướng
  // (có người đánh vào sườn, vào lưng), lính chờ đứng thành vòng ngoài thưa đều thay vì dồn một cục.
  assignSlots(enemies) {
    const hero = this.ctx.hero, list = [];
    for (const e of enemies) if (e.target === hero && !e.K.ranged && e.fleeT <= 0) { e._ang = Math.atan2(e.x - hero.x, e.z - hero.z); list.push(e); }
    let nTok = 0; for (const e of list) if (e.token) nTok++;
    for (const e of list) {
      const sep = (e.token ? (Math.PI * 2) / Math.max(2, nTok) : 0.55) * AI.slotSep;
      let push = 0;
      for (const o of list) {
        if (o === e || o.token !== e.token) continue;
        const d = wrapA(e._ang - o._ang), ad = Math.abs(d);
        if (ad < sep) push += (d === 0 ? (e.id > o.id ? 1 : -1) : Math.sign(d)) * (sep - ad);
      }
      e.slotAng = e._ang + Math.max(-0.7, Math.min(0.7, push * 0.6));
    }
  }

  // Thân binh, quân theo tướng: ưu tiên kẻ đang đánh tướng.
  threatFor(a, enemies, maxD) {
    const hero = this.ctx.hero;
    let best = null, bs = maxD;
    for (const e of enemies) {
      const d = Math.hypot(e.x - a.x, e.z - a.z);
      if (d > maxD) continue;
      const s = d - (e.token || (e.windup > 0 && e.target === hero) ? 5 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  // ---- AI --------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, hero = ctx.hero, rng = ctx.rng;
    const enemies = [], allies = [];
    for (const a of this.agents) if (this.hittable(a)) (a.side === "dich" ? enemies : allies).push(a);
    this.assignTokens(enemies);
    this.assignSlots(enemies);
    // tướng đang gồng đòn nặng (trước cú trúng đầu): lính gần có thể nhảy lùi né
    const hm = hero.state === "attack" && HEAVY_MOVES.has(hero.move) ? MOVES[hero.move] : null;
    const heroHeavy = hm && hero.st / hero.dur < hm.hits[0] - 0.08 ? hm : null;

    this.cheerT = Math.max(0, this.cheerT - dt);
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      if (a.role === "spectator") { a.cheer = this.cheerT; a.atkT += dt; continue; }
      a.flash = Math.max(0, a.flash - dt); a.bob += dt * 7; a.atkT += dt; a.flinch = Math.max(0, a.flinch - dt);
      a.blockT = Math.max(0, a.blockT - dt); a.blockCd -= dt; a.chargeCd -= dt;
      if (a.panicT > 0) a.panicT -= dt;
      if (a.state === "dead") {
        a.dieT += dt;
        a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= 0.9; a.vz *= 0.9;
        if (a.vy > 0 || a.y > 0) { a.y += a.vy * dt; a.vy -= 16 * dt; if (a.y < 0) { a.y = 0; a.vy = 0; } }
        if (a.dieT > 2.8) this.release(a);
        continue;
      }
      if (a.state === "launch") {
        a.st += dt; a.y += a.vy * dt; a.vy -= 16 * dt; a.x += a.vx * dt; a.z += a.vz * dt;
        if (a.y <= 0) { a.y = 0; a.state = "down"; a.st = 0.9; a.vx = a.vz = 0; ctx.fx?.dust(a.x, a.z, 0.5); }
        continue;
      }
      if (a.state === "down") { a.st -= dt; if (a.st <= 0) { a.state = "move"; } continue; }
      if (a.state === "hit") {
        a.spd *= 0.8; a.st -= dt; a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= 0.85; a.vz *= 0.85;
        if (a.st <= 0) a.state = "move";
        continue;
      }
      // choáng: đứng im, tốc độ tắt dần như nhánh trúng đòn (bỏ qua stride nên a.spd không tự về 0 — lực sĩ trúng
      // Phá Trận đang chạy thì đứng co một chân giữa bước suốt 1–1,5 s)
      if (a.stun > 0) { a.stun -= dt; a.spd *= Math.exp(-dt * 13); continue; }

      if (a.role === "actor") { this.updateActor(a, dt); continue; }

      const K = a.K, ranged = !!K.ranged, reach = K.reach || 1.7;
      const px = a.x, pz = a.z;
      const hx = hero.x - a.x, hz = hero.z - a.z, dH = Math.hypot(hx, hz) || 1e-6;

      // ---- trạng thái đặc biệt: bỏ chạy, nhảy lùi, lao húc ----
      if (a.fleeT > 0) {
        a.fleeT -= dt; a.target = null; a.token = false; a.ready = false; a.windup = 0;
        const sp = a.speed * 1.2, ax = -hx / dH, az = -hz / dH;
        a.x += ax * sp * dt; a.z += az * sp * dt; a.yaw = turn(a.yaw, Math.atan2(ax, az), dt * 8);
        [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates); this.stride(a, px, pz, dt);
        continue;
      }
      if (a.evadeT > 0) {
        a.evadeT -= dt;
        const sp = AI.evadeDist / 0.3;
        a.x += a.evadeX * sp * dt; a.z += a.evadeZ * sp * dt; a.yaw = turn(a.yaw, Math.atan2(hx, hz), dt * 10);
        [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates); a.spd = 0;
        continue;
      }
      if (a.chargeT > 0) {
        a.chargeT -= dt;
        const sp = a.speed * AI.charge.speed;
        a.x += a.chargeX * sp * dt; a.z += a.chargeZ * sp * dt; a.yaw = turn(a.yaw, Math.atan2(a.chargeX, a.chargeZ), dt * 6);
        [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates); this.stride(a, px, pz, dt);
        if (hero.alive && dH <= reach + 0.4) { a.chargeT = 0; a.chargeHit = true; a.windup = a.windupT = 0.22; a.fake = false; a.target = hero; }
        else if (a.chargeT <= 0) a.atkCd = Math.max(a.atkCd, 0.8);
        continue;
      }
      if (heroHeavy && a.side === "dich" && !K.stable && !K.mounted && a.windup <= 0 && a.evadedSwing !== hero.swingId && dH < heroHeavy.range + 1.3) {
        a.evadedSwing = hero.swingId;
        if (rng.chance(AI.evade[a.tier] || 0)) { a.evadeT = 0.3; a.evadeX = -hx / dH; a.evadeZ = -hz / dH; continue; }
      }

      // tầm bắn theo thế đất (terrain-rules.js): đứng cao hơn mục tiêu (của bước trước) thì bắn xa hơn
      const rt = a.target || hero;
      const range = ranged ? K.range * rangeMult(heightAt(a.x, a.z) - heightAt(rt.x, rt.z)) : 0;

      // ---- chọn mục tiêu ----
      let tx, tz, target = null, wantDist = 2.0, slot = false, kiting = false, perch = null;
      if (a.side === "dich") {
        const aggro = a.role === "garrison" ? 20 : a.role === "squad" ? 14 : 60;
        if (hero.alive && dH < aggro) {
          target = hero; tx = hero.x; tz = hero.z;
          const ring = ranged ? range * 0.7 : a.token ? reach : 4.2 + (a.id % 5) * 0.6 + (reach - 1.7);
          // cung thủ bộ Nguyên ưa gò cao gần đó: lên đỉnh gò đứng bắn xuống, bị áp sát thì lùi ngả về phía gò
          if (ranged && !K.mounted) perch = perchNear(a.x, a.z, hero.x, hero.z, K.range);
          if (ranged && dH < K.range * AI.kite) { kiting = true; wantDist = range * 0.7; }
          else if (!ranged && a.slotAng !== undefined && dH < 14) {
            // tới vị trí vây của mình; lính chờ trôi chậm quanh vòng
            if (!a.token) a.slotAng += (a.id % 2 ? 1 : -1) * 0.12 * dt;
            tx = hero.x + Math.sin(a.slotAng) * ring; tz = hero.z + Math.cos(a.slotAng) * ring; wantDist = 0.3; slot = true;
          } else if (perch) {
            const ang = a.id * 2.39996;               // mỗi người một chỗ quanh đỉnh gò (góc vàng theo id)
            tx = perch.x + Math.sin(ang) * perch.r * 0.22; tz = perch.z + Math.cos(ang) * perch.r * 0.22; wantDist = 0.3; slot = true;
          } else wantDist = ring;
          // lực sĩ có thẻ tấn công, tướng cách 5–11 m: lao húc
          const C = AI.charge;
          if (K.heavy && a.token && a.chargeCd <= 0 && a.windup <= 0 && dH > C.minD && dH < C.maxD) {
            a.chargeT = C.dur; a.chargeCd = C.cd; a.chargeX = hx / dH; a.chargeZ = hz / dH;
            ctx.audio?.play("warn", a.x, a.z); continue;
          }
        } else if (a.anchor) {
          const at = a.anchor.target && a.anchor.target.alive && !a.anchor.target.dead ? a.anchor.target : null;
          target = at; tx = at ? at.x : a.anchor.x; tz = at ? at.z : a.anchor.z; wantDist = a.anchor.r ?? 3;
        } else {
          const al = nearest(a, allies, ranged ? range : 14);
          if (al) { target = al; tx = al.x; tz = al.z; wantDist = ranged ? range * 0.6 : reach; }
          else { tx = a.sx; tz = a.sz; wantDist = 1; }
        }
      } else {
        const guard = a.role === "guard" || a.role === "follow";
        const en = guard ? this.threatFor(a, enemies, 9) : nearest(a, enemies, ranged ? range + 2 : 16);
        if (en) { target = en; tx = en.x; tz = en.z; wantDist = ranged ? range * 0.7 : reach; }
        else if (guard) {
          const k = a.id % 12, ang = hero.yaw + Math.PI + (k - 5.5) * 0.35, rr = a.role === "guard" ? 3 : 5.5;
          tx = hero.x + Math.sin(ang) * rr; tz = hero.z + Math.cos(ang) * rr; wantDist = 0.6;
        } else { tx = a.sx; tz = a.sz; wantDist = 1; }
      }
      a.target = target;

      // ---- di chuyển ----
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz) || 1e-6;
      const dT = target === hero ? dH : target ? Math.hypot(target.x - a.x, target.z - a.z) : d;   // khoảng cách tới mục tiêu thật
      a.ready = !!target && dT < (ranged ? range + 4 : 8);
      let mvx = 0, mvz = 0;
      if (target) a.yaw = turn(a.yaw, target === hero ? Math.atan2(hx, hz) : Math.atan2(dx, dz), dt * 8);
      if (a.windup <= 0) {
        if (kiting) {                                                         // cung thủ lùi giữ tầm
          mvx = -hx / dH; mvz = -hz / dH;
          if (perch) {                                                        // gò ở phía lùi thì ngả về gò
            const ox = perch.x - a.x, oz = perch.z - a.z, ol = Math.hypot(ox, oz) || 1;
            if (ox * mvx + oz * mvz > 0) { mvx += ox / ol; mvz += oz / ol; const l = Math.hypot(mvx, mvz) || 1; mvx /= l; mvz /= l; }
          }
        }
        else if (slot) { const k = Math.min(1, d / 1.2); if (d > wantDist) { mvx = dx / d * k; mvz = dz / d * k; } }
        else if (d > wantDist + 0.4) { mvx = dx / d; mvz = dz / d; if (!target) a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 6); }
        else if (d < wantDist - 0.6 && target === hero) { mvx = -dx / d * 0.6; mvz = -dz / d * 0.6; }
        else if (target === hero && !a.token) {        // lượn vòng quanh tướng
          const s2 = (a.id % 2 ? 1 : -1) * 0.45; mvx = -dz / d * s2; mvz = dx / d * s2;
        }
      }
      // tách nhau
      let sx = 0, sz = 0;
      const pool = a.side === "dich" ? enemies : allies;
      for (const b of pool) {
        if (b === a) continue;
        const ox = a.x - b.x, oz = a.z - b.z, o2 = ox * ox + oz * oz;
        if (o2 < 1.1 && o2 > 1e-6) { const o = Math.sqrt(o2); sx += ox / o * (1.05 - o); sz += oz / o * (1.05 - o); }
      }
      if (hero.alive) {
        const ox = a.x - hero.x, oz = a.z - hero.z, o = Math.hypot(ox, oz);
        if (o < 1.1 && o > 1e-6) { sx += ox / o * (1.1 - o) * 2; sz += oz / o * (1.1 - o) * 2; }
      }
      const tf = mvx !== 0 || mvz !== 0 ? speedFactor(a.x, a.z, mvx, mvz) : 1;    // lên dốc chậm, xuống dốc nhanh, bùn lầy
      a.x += (mvx * a.speed * tf + sx * 4) * dt; a.z += (mvz * a.speed * tf + sz * 4) * dt;
      [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates);
      this.stride(a, px, pz, dt);

      // ---- đánh ----
      a.atkCd -= dt;
      if (a.windup > 0) {
        a.windup -= dt;
        if (a.windup <= 0) { a.atkT = 0; this.strike(a); a.atkCd = TIERS[a.tier].every * (0.85 + 0.3 * rng.next()); }
      } else if (!kiting) {
        const canHit = target && (target === hero ? a.token : true) && dT <= (ranged ? range : reach + 0.9);
        if (canHit && a.atkCd <= 0) { a.windup = a.windupT = K.windup; a.fake = false; }
      }
    }

    this.updateArrows(dt);
  }

  // Tốc độ thật, hướng đi và pha bước chân lấy từ quãng đã đi (không bước khi bị đẩy, khi đứng); độ dài
  // chu kỳ khớp dáng đi nên bàn chân chống không trượt (soldier-motion.js advanceStride).
  stride(a, px, pz, dt) { advanceStride(a, px, pz, dt); }

  updateActor(a, dt) {
    const dx = a.sx - a.x, dz = a.sz - a.z, d = Math.hypot(dx, dz), px = a.x, pz = a.z;
    const K = a.K, face = a.side === "ta" ? Math.PI / 2 : -Math.PI / 2;
    a.ready = a.frontRow || (K.ranged && d <= 0.3);
    if (d > 0.3) {
      const sp = Math.min(a.speed * 0.8, d * 2);
      a.x += dx / d * sp * dt; a.z += dz / d * sp * dt;
      a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 5);
    } else {
      a.yaw = turn(a.yaw, face, dt * 3);
      a.fakeCd -= dt;
      // hàng đầu diễn chém; cung, nỏ ở hàng sau bắn tên cảnh (không trúng ai)
      if (a.fakeCd <= 0 && a.windup <= 0 && (a.frontRow || K.ranged)) {
        a.windup = a.windupT = K.windup; a.fake = true;
        a.fakeCd = K.ranged ? 2.5 + this.ctx.rng.next() * 4 : 1.2 + this.ctx.rng.next() * 2.4;
      }
    }
    if (a.windup > 0) {
      a.windup -= dt;
      if (a.windup <= 0) {
        a.atkT = 0;
        if (K.ranged && this.arrows.length < 90) {
          const r = 14 + this.ctx.rng.next() * 12, s = this.ctx.rng.next() * 6 - 3;
          this.fireArrow(a, { x: a.x + Math.sin(face) * r + s, z: a.z + Math.cos(face) * r + s }, true);
        }
      }
    }
    this.stride(a, px, pz, dt);
  }

  strike(a) {
    const ctx = this.ctx, t = a.target;
    if (!t) return;
    const tier = TIERS[a.tier];
    // Hoang mang (Kế Sách "Cờ áo Tống"): chính xác −30%
    if (a.panicT > 0 && ctx.rng.next() < 0.3) { if (t === ctx.hero) ctx.fx.text(a.x, a.z, "trượt", "#b0a090"); return; }
    if (a.K.ranged) { this.fireArrow(a, t); return; }
    const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz);
    if (d > (a.K.reach || 1.7) + 0.9) return;
    if (a.K.heavy) { ctx.fx?.dust(a.x + Math.sin(a.yaw) * 1.6, a.z + Math.cos(a.yaw) * 1.6, 0.8); ctx.fx?.shake(0.12); }
    if (t === ctx.hero) {
      const raw = a.cong * tier.mv * heSoGiap(ctx.hero.giap, ctx.R) * ctx.diff.dmg;
      // đòn lực sĩ là đòn nặng: cắt được đòn đang ra của tướng, phải né hoặc đỡ
      ctx.hero.receiveHit({ dmg: raw * (a.chargeHit ? AI.charge.dmg : 1) * (0.95 + 0.1 * ctx.rng.next()) * hitMult(a, ctx.hero), x: a.x, z: a.z, red: false, src: a, heavy: !!a.K.heavy, knockdown: a.chargeHit });
      a.chargeHit = false;
    } else if (t.isBig) {
      // lính đánh tướng đồng minh ×0,2 (ĐỀ XUẤT BẢN THỬ): 24 lính vây Nguyễn Khoái thì ông trụ ~60 s
      t.receiveHit?.({ dmg: a.cong * tier.mv * heSoGiap(t.giap, ctx.R) * 0.2, x: a.x, z: a.z, src: a });
    } else if (t.alive) {
      const dmg = a.cong * tier.mv * heSoGiap(t.giap, ctx.R) * (a.side === "ta" ? 0.8 : 0.6) * hitMult(a, t);
      this.damage(t, dmg, { kx: dx / (d || 1), kz: dz / (d || 1), knock: 1.5, by: a.side === "ta" ? "ally" : "enemy" });
    }
  }

  // fake: tên cảnh của lính diễn — bay thật, không trúng ai, không phát tiếng.
  fireArrow(a, t, fake = false) {
    const g0 = heightAt(a.x, a.z), y0 = g0 + (a.K.mounted ? 2.2 : 1.45) * a.scale;
    const tx = t.x + (t.vx || 0) * 0.3, tz = t.z + (t.vz || 0) * 0.3, ty = (t.boatY ?? heightAt(tx, tz)) + (fake ? 0 : 1.2);
    const d = Math.hypot(tx - a.x, tz - a.z), T = Math.max(0.35, d / 26);
    this.arrows.push({ x: a.x, y: y0, z: a.z, vx: (tx - a.x) / T, vz: (tz - a.z) / T, vy: (ty - y0) / T + 4.9 * T, t: 0, T: T + 0.4, T0: T, src: a,
      side: fake ? "fx" : a.side, tgt: fake ? null : t, g0 });     // g0: chân người bắn lúc buông tên (thế đất cao)
    if (!fake) this.ctx.audio?.play("bow", a.x, a.z);
  }

  updateArrows(dt) {
    const ctx = this.ctx, hero = ctx.hero;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const r = this.arrows[i];
      r.t += dt; r.x += r.vx * dt; r.z += r.vz * dt; r.y += r.vy * dt; r.vy -= 9.8 * dt;
      let done = r.t > r.T || r.y < heightAt(r.x, r.z);
      // mục tiêu không phải tướng người chơi (thuyền, tướng đồng minh): tính trúng khi tên tới nơi
      if (!done && r.tgt && r.tgt !== hero && r.t >= r.T0) {
        const g = r.tgt, a = r.src;
        if (g.K) {      // lính thường: tính như đòn cận chiến giữa hai đám lính
          const d = Math.hypot(g.x - r.x, g.z - r.z), v = Math.hypot(r.vx, r.vz) || 1;
          if (d < 1.6 && this.hittable(g)) this.damage(g, a.cong * TIERS[a.tier].mv * heSoGiap(g.giap, ctx.R) * (r.side === "ta" ? 0.8 : 0.6) * heightDamageMult(r.g0 - heightAt(g.x, g.z)),
            { kx: r.vx / v, kz: r.vz / v, knock: 1.2, by: r.side === "ta" ? "ally" : "enemy" });
        } else if (g.alive !== false && Math.hypot(g.x - r.x, g.z - r.z) < 3) g.receiveHit?.({ dmg: a.cong * TIERS[a.tier].mv * 0.85 * (g.arrowMult ?? 0.2), x: a.x, z: a.z, src: a, arrow: true });
        done = true;
      }
      if (!done && r.side === "dich" && hero.alive && Math.hypot(hero.x - r.x, hero.z - r.z) < 0.9 && Math.abs(r.y - (hero.y + 1.1)) < 1.3) {
        const a = r.src, tier = TIERS[a.tier];
        hero.receiveHit({ dmg: a.cong * tier.mv * 0.85 * heSoGiap(hero.giap, ctx.R) * ctx.diff.dmg * heightDamageMult(r.g0 - hero.y), x: r.x - r.vx * 0.1, z: r.z - r.vz * 0.1, red: false, src: a, arrow: true });
        done = true;
      }
      if (done) this.arrows.splice(i, 1);
    }
  }

  // Thẻ tấn công: tối đa N lính cận chiến đánh tướng cùng lúc (21.6: 3 ở Quân sĩ). Cung kỵ có
  // thẻ riêng ≈ 2/3 N (ĐỀ XUẤT BẢN THỬ) — không có thẻ thì 12 cung kỵ cùng bắn hạ tướng trong 12 s.
  assignTokens(enemies) {
    const hero = this.ctx.hero, N = this.ctx.diff.tokens, NR = Math.max(1, Math.round(N * 0.67));
    const isR = (e) => !!e.K.ranged;
    let held = 0, heldR = 0;
    for (const e of enemies) {
      if (!e.token) continue;
      const d = Math.hypot(e.x - hero.x, e.z - hero.z);
      if (d > (isR(e) ? 24 : 9) || e.state === "dead" || !hero.alive) e.token = false;
      else if (isR(e)) heldR++; else held++;
    }
    if (!hero.alive) return;
    const cand = enemies.filter((e) => !e.token).map((e) => [e, (e.x - hero.x) ** 2 + (e.z - hero.z) ** 2]).sort((a, b) => a[1] - b[1]);
    for (const [e, d2] of cand) {
      if (isR(e)) { if (heldR < NR && d2 < 22 * 22) { e.token = true; heldR++; } }
      else if (held < N && d2 < 81) { e.token = true; held++; }
      if (held >= N && heldR >= NR) break;
    }
  }

  // ---- vẽ ----------------------------------------------------------------------------------
  // Hoạt ảnh chạy theo đồng hồ trận (ctx.clock), nên hit-stop đóng băng cả đám lính (kể cả lò xo vạt
  // áo, dây tua: dtA = 0).
  render() {
    const clk = this.ctx.clock, dtA = Math.min(0.1, Math.max(0, clk - (this.lastClock ?? clk)));
    this.lastClock = clk;
    const kSoft = 1 - Math.exp(-dtA * 18), kSnap = 1 - Math.exp(-dtA * 55);
    const counts = {}, hero = this.ctx.hero, frame = ++this.frame;
    for (const k of KIT_IDS) counts[k] = 0;
    let nb = 0;
    for (const a of this.agents) {
      const M = this.meshes[a.kit], i = counts[a.kit];
      if (i >= CAP) continue;
      counts[a.kit]++;
      if (a.gx !== a.x || a.gz !== a.z) { a.gy = heightAt(a.x, a.z); a.gx = a.x; a.gz = a.z; }   // đứng yên thì khỏi lấy lại
      const gy = a.gy;
      const sink = a.state === "dead" && a.dieT > 1.8 ? (a.dieT - 1.8) * 1.0 : 0;
      const far = (a.x - hero.x) ** 2 + (a.z - hero.z) ** 2 > LOD_FAR2;
      if (!a.mc) a.mc = new Float32Array(BONE_FLOATS);
      if (!(far && a.poseInit && (frame + a.id) % 3 !== 0)) {
        poseFor(a, a.kit, a.K, clk, _pose);
        const P = a.pose;
        if (!a.poseInit || far) { P.set(_pose); a.poseInit = true; }
        else {
          const k = a.atkT < 0.14 || a.state === "hit" ? kSnap : kSoft;
          smoothPose(P, _pose, k, Math.max(k, 1 - Math.exp(-dtA * legRate(a))));
        }
        // tư thế → IK chân (bản nháp) → lò xo vạt → ma trận khớp → tua giáo/đuôi ngựa, thẳng vào a.mc
        soldierFrame(a, M.skel, a.x, gy + a.y - sink, a.z, gy, P, dtA, heightAt, !far, a.mc);
      }
      M.data.set(a.mc, i * BONE_FLOATS);

      // màu: mỗi lính lệch sáng tối một chút cho đám đông khỏi đúc khuôn; chớp trắng khi trúng
      const k = a.flash > 0 ? 2.6 : 0.9 + 0.2 * ((a.id * 0.377) % 1);
      if (a.tint) _c.setRGB(a.tint[0] * k, a.tint[1] * k, a.tint[2] * k);
      else if (a.tier === "tinhnhue") _c.setRGB(0.8 * k, 0.76 * k, 0.64 * k); else _c.setRGB(k, k, k);
      if (a.panicT > 0 && Math.floor(a.bob) % 2) _c.multiplyScalar(1.35);
      if (a.chargeT > 0) { const f = 0.5 + 0.5 * Math.sin(clk * 34); _c.setRGB(1.7 + 0.6 * f, 0.5, 0.4); }
      else if (a.windup > 0 && !a.fake && a.target === this.ctx.hero) {
        if (a.K.heavy) { const f = 0.5 + 0.5 * Math.sin(clk * 30); _c.setRGB(1.5 + 0.7 * f, 0.55 + 0.2 * f, 0.45); }
        else _c.setRGB(1.5, 0.9, 0.8);
      }
      M.color.setXYZ(i, _c.r, _c.g, _c.b);
      if (nb < 2200 && sink < 0.5) {
        _p.set(a.x, gy + 0.06, a.z); _s.setScalar(a.K.mounted ? 1.5 : a.scale);
        _m.compose(_p, _q.identity(), _s); this.blob.setMatrixAt(nb++, _m);
      }
    }
    for (const k of KIT_IDS) {
      const M = this.meshes[k], n = counts[k];
      M.mesh.count = n;
      if (n > 0) {       // chỉ tải các hàng texture đang dùng (mỗi hàng một lần texSubImage2D)
        const rows = Math.ceil((n * BONE_FLOATS) / 4 / BONE_TEX_W);
        M.tex.clearUpdateRanges();
        for (let r = 0; r < rows; r++) M.tex.addUpdateRange(r * BONE_TEX_W * 4, BONE_TEX_W * 4);
        M.tex.needsUpdate = true;
      }
      M.color.clearUpdateRanges(); M.color.addUpdateRange(0, n * 3); M.color.needsUpdate = true;
    }
    this.blob.count = nb; this.blob.instanceMatrix.needsUpdate = true;
    let na = 0;
    for (const r of this.arrows) {
      if (na >= 200) break;
      _p.set(r.x, r.y, r.z);
      _e.set(-Math.atan2(r.vy, Math.hypot(r.vx, r.vz)), Math.atan2(r.vx, r.vz), 0); _q.setFromEuler(_e);
      _m.compose(_p, _q, _s.setScalar(1)); this.arrowMesh.setMatrixAt(na++, _m);
    }
    this.arrowMesh.count = na; this.arrowMesh.instanceMatrix.needsUpdate = true;
  }
}

function nearest(a, list, maxD) {
  let best = null, bd = maxD * maxD;
  for (const b of list) { const d2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2; if (d2 < bd) { bd = d2; best = b; } }
  return best;
}
export function turn(cur, target, k) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * Math.min(1, k);
}
