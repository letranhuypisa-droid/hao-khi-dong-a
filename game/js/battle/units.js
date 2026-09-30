// battle/units.js — đơn vị lớn có rig riêng: Đội trưởng, Phó tướng, Toa Đô, tướng đồng minh.
//
// Bậc có thanh Phá Thế dùng HP = 120 × hệ số bậc × S(R) (11.1). Phá Thế về 0 → Vỡ Thế: đứng
// khựng, nhận sát thương ×1,5, mở Đòn Quyết (3.7). Đòn viền đỏ báo trước 0,6 s và chỉ phản đòn
// được, không đỡ được (3.6).

import { makeRig, disposeRig, RIGS } from "./models.js";
import { RigMotion } from "./rig-motion.js";
import * as A from "./anim.js";
import { heightAt, collide } from "./world.js";
import { TIERS, S, g, heSoGiap, DEFENSE, AI } from "../data/tuning.js";
import { turn } from "./crowd.js";
import { speedFactor, hitMult } from "../sim/terrain-rules.js";   // dốc, bùn, thế đất cao

const STRAFE_SPEED = 1.5;     // m/s, đi vòng thăm dò quanh tướng

export class BigUnit {
  constructor(ctx, o) {
    this.ctx = ctx; this.isBig = true; this.alive = true;
    Object.assign(this, { kind: o.kind, side: o.side, tier: o.tier, name: o.name, id: o.id, base: o.base || null });
    this.rigKey = o.rigKey || o.tier;
    const R = ctx.R;
    if (o.side === "dich") {
      const T = TIERS[o.tier];
      this.maxHp = T.hp * S(R); this.cong = T.cong * g(R); this.giap = T.giap * g(R);
      this.poiseMax = T.poise * S(R); this.T = T;
    } else {
      this.maxHp = o.hp * g(R) * (1 + (ctx.stats?.mods.allyHpPct || 0)); this.cong = 110 * g(R); this.giap = 60 * g(R); this.poiseMax = 0;
      this.T = { mv: 1.5, every: 1.4, red: 0 };
    }
    this.hp = this.maxHp * (o.hpFrac ?? 1); this.poise = this.poiseMax;
    const cfg = RIGS[o.rigKey || o.tier];
    this.rig = makeRig(cfg);
    this.motion = new RigMotion(this.rig);        // chân bám đất, vạt áo, áo choàng, tua giáo (rig-motion.js)
    this.longWeapon = cfg.weapon === "giao" || cfg.weapon === "dadao";
    ctx.scene.add(this.rig.root);
    this.x = o.x; this.z = o.z; this.yaw = o.yaw ?? -Math.PI / 2; this.home = { x: o.x, z: o.z };
    this.post = { x: o.x, z: o.z };
    this.state = "idle"; this.st = 0; this.atkCd = 1.5; this.redCd = 4 + ctx.rng.next() * 3; this.ultCd = 8;
    this.broken = 0; this.noHit = 0; this.flash = 0; this.animT = 0; this.runPhase = 0;
    this.pose = A.idle(0); this.awake = o.awake ?? (o.side === "ta"); this.aggro = o.aggro ?? 22;
    this.giapPen = 0; this.dead = 0; this.retreating = false; this.speed = o.side === "dich" ? 4.2 : 4.6;
    this.roarT = 0; this.strafeT = 0; this.strafeDir = 1; this.blockWatch = 0; this.hitTimes = []; this.backCd = 0;
    A.applyPose(this.rig, this.pose);
    this.place(0);       // đặt rig ngay chỗ xuất hiện, dây treo buông sẵn (khỏi bay từ gốc toạ độ vào)
  }

  get y() { return heightAt(this.x, this.z); }
  get radius() { return 0.9 * this.rig.scale; }

  // Gỡ rig khỏi cảnh, giải phóng khung xương (texture xương), vật liệu riêng của đơn vị (hình học dùng chung, đệm theo
  // cấu hình trong models.js). Trước đây chỉ gỡ khỏi cảnh: mỗi lần sinh/xoá (Luyện tập sinh lại sĩ quan mỗi 3 s, thử
  // lại checkpoint, tướng đồng minh ngã rồi dậy) rò 22 geometry + 1 texture trên GPU.
  dispose() { disposeRig(this.rig); this.alive = false; }

  update(dt) {
    const ctx = this.ctx, hero = ctx.hero;
    this.animT += dt; this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    if (this.dead > 0) { this.dead += dt; this.setPose(A.knockdown(this.dead), 0.3); if (this.dead > 3.5) this.dispose(); this.place(dt); return; }
    if (this.retreating) { this.updateRetreat(dt); return; }

    if (this.poiseMax > 0) {
      this.noHit += dt;
      if (this.broken > 0) {
        this.broken -= dt;
        this.setPose(A.stagger(3.5 - this.broken, this.longWeapon), 0.25);     // Vỡ Thế: loạng choạng rồi khuỵu, gục
        if (this.broken <= 0) this.poise = this.poiseMax;
        this.place(dt); return;
      }
      if (this.noHit > 3) this.poise = Math.min(this.poiseMax, this.poise + this.poiseMax * 0.2 * dt);
    }

    if (this.side === "dich") this.updateEnemy(dt, hero); else this.updateAlly(dt);
    this.place(dt);
  }

  updateEnemy(dt, hero) {
    const ctx = this.ctx;
    const dx = hero.x - this.x, dz = hero.z - this.z, d = Math.hypot(dx, dz);
    if (!this.awake && hero.alive && (d < 16 || Math.hypot(hero.x - this.home.x, hero.z - this.home.z) < this.aggro)) {
      this.awake = true; ctx.director?.onOfficerAwake(this);
      this.roarT = 0.9; ctx.audio.play("roar", this.x, this.z);          // gầm thị uy khi phát hiện tướng
    }
    this.backCd -= dt;
    if (this.roarT > 0) { this.roarT -= dt; this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 8); this.setPose(A.roar(1 - this.roarT / 0.9), 0.3); return; }
    if (this.state === "evade") {
      this.st -= dt; const sp = 3.2 / 0.4;
      this.x -= dx / (d || 1) * sp * dt; this.z -= dz / (d || 1) * sp * dt;
      [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.7, ctx.openGates);
      this.setPose(A.backstep(1 - this.st / 0.4), 0.5); if (this.st <= 0) { this.state = "idle"; this.atkCd = Math.min(this.atkCd, 0.4); }
      return;
    }
    if (this.state === "hit") { this.st -= dt; this.setPose(A.hitReact(1 - this.st / 0.3), 0.4); if (this.st <= 0) this.state = "idle"; return; }
    if (this.state === "stagger") { this.st -= dt; this.setPose(A.hitReact(0.5), 0.3); if (this.st <= 0) this.state = "idle"; return; }

    if (this.state === "atk" || this.state === "red" || this.state === "ult") { this.updateAttack(dt, hero, d); return; }

    if (!this.awake || !hero.alive) {
      const hd = Math.hypot(this.home.x - this.x, this.home.z - this.z);
      if (hd > 2) this.moveToward(this.home.x, this.home.z, dt, 0.5); else this.setPose(A.idle(this.animT), 0.1);
      return;
    }
    // Đội trưởng, Phó tướng bị giữ quanh Cứ Điểm; Toa Đô đuổi khắp bãi.
    const leash = this.tier === "tuong" ? 999 : 40;
    if (Math.hypot(this.x - this.home.x, this.z - this.home.z) > leash && d > 8) { this.moveToward(this.home.x, this.home.z, dt, 1); return; }

    this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 6);
    this.atkCd -= dt; this.redCd -= dt; this.ultCd -= dt;
    const T = this.T;
    if (this.tier === "tuong" && T.ult && this.hp < this.maxHp * 0.5 && this.ultCd <= 0 && d < 9) {
      this.state = "ult"; this.st = 0; this.hitDone = false; this.ultCd = 16;
      ctx.fx.telegraph(this, 7, T.ultTelegraph, true); ctx.audio.play("horn", this.x, this.z); return;
    }
    if (T.red && this.redCd <= 0 && d < 4.2) {
      this.state = "red"; this.st = 0; this.hitDone = false; this.redCd = 6 + ctx.rng.next() * 3;
      this.impactAt = ctx.clock + DEFENSE.redTelegraph;
      ctx.fx.telegraph(this, 3.4, DEFENSE.redTelegraph, false); ctx.audio.play("warn", this.x, this.z); return;
    }
    // tướng cứ đứng đỡ trước mặt → dùng đòn viền đỏ (không đỡ được, chỉ phản được)
    this.blockWatch = hero.state === "block" && d < 4.5 ? this.blockWatch + dt : Math.max(0, this.blockWatch - dt * 2);
    if (this.blockWatch > 1.2 && T.red) { this.redCd = Math.min(this.redCd, 0); this.blockWatch = 0; }
    // bắt lỗi: tướng đang hồi đòn, vừa trúng đòn, vừa né xong → ra đòn ngay
    const open = hero.state === "hit" || hero.state === "down" || (hero.state === "attack" && hero.st / hero.dur > 0.72) || (hero.state === "dodge" && hero.st > 0.22);
    if (open && d < 3.4 && this.atkCd < 0.9) this.atkCd = 0;
    if (d > 2.6) { this.moveToward(hero.x, hero.z, dt, 1); return; }
    if (this.atkCd <= 0) { this.state = "atk"; this.st = 0; this.hitDone = false; this.combo = (this.combo || 0) + 1; return; }
    // chờ đòn: đi vòng thăm dò quanh tướng, quá sát thì lùi lại
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeDir = ctx.rng.next() < 0.5 ? -1 : 1; this.strafeT = 1.2 + ctx.rng.next() * 1.6; }
    const nx = dx / (d || 1), nz = dz / (d || 1), back = d < 1.8 ? -1.2 : 0;
    const vx = -nz * this.strafeDir * STRAFE_SPEED + nx * back, vz = nx * this.strafeDir * STRAFE_SPEED + nz * back;
    const tf = speedFactor(this.x, this.z, vx, vz);          // dốc, bùn (terrain-rules.js)
    this.x += vx * tf * dt; this.z += vz * tf * dt;
    [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.7, ctx.openGates);
    // strafeDir = 1 đi về phía −x của rig (mặt hướng tướng) → hoạt ảnh bước theo −strafeDir
    const sg = A.strafeGait(STRAFE_SPEED * tf, this.rig.scale);
    this.runPhase += dt * sg.rate;
    this.setPose(A.strafe(this.runPhase, -this.strafeDir, sg.stride), 0.5);
  }

  updateAttack(dt, hero, d) {
    const ctx = this.ctx, T = this.T;
    this.st += dt;
    if (this.state === "atk") {
      const dur = 0.95, u = this.st / dur;
      this.setPose(this.combo % 2 ? A.sweep(u) : A.heavyChop(u, 0.4, this.longWeapon), 0.5);
      if (!this.hitDone && u > 0.5) {
        this.hitDone = true;
        if (d < 3.3 && facing(this, hero, 1.2)) hero.receiveHit({ dmg: this.cong * T.mv * heSoGiap(hero.giap, ctx.R) * ctx.diff.dmg * hitMult(this, hero), x: this.x, z: this.z, red: false, src: this, heavy: true });
        this.hitCrowd(3, T.mv * 0.6);
      }
      if (u >= 1) { this.state = "idle"; this.atkCd = T.every * (0.8 + 0.4 * ctx.rng.next()); }
    } else if (this.state === "red") {
      const tele = DEFENSE.redTelegraph, u = this.st / (tele + 0.35);
      this.setPose(A.heavyChop(u, tele / (tele + 0.35), this.longWeapon), 0.6);
      if (!this.hitDone && this.st >= tele) {
        this.hitDone = true;
        if (d < 3.8 && facing(this, hero, 1.3)) {
          const r = hero.receiveHit({ dmg: this.cong * T.red * heSoGiap(hero.giap, ctx.R) * ctx.diff.dmg * hitMult(this, hero), x: this.x, z: this.z, red: true, src: this, heavy: true });
          if (r === "parried") { this.state = "stagger"; this.st = 1.3; return; }
        }
        ctx.fx.shake(0.35); ctx.fx.dust(this.x + Math.sin(this.yaw) * 2, this.z + Math.cos(this.yaw) * 2, 1.4);
      }
      if (u >= 1) { this.state = "idle"; this.atkCd = 0.8; }
    } else if (this.state === "ult") {
      const tele = T.ultTelegraph, dur = tele + 1.1;
      this.setPose(this.st < tele ? A.heavyChop(this.st / tele * 0.5, 0.9) : A.spin((this.st - tele) / 1.1, 2), 0.6);
      if (!this.hitDone && this.st >= tele + 0.3) {
        this.hitDone = true;
        ctx.fx.shake(0.7); ctx.fx.shockwave(this.x, this.z, 7);
        if (d < 7) hero.receiveHit({ dmg: this.cong * T.ult * heSoGiap(hero.giap, ctx.R) * ctx.diff.dmg * hitMult(this, hero), x: this.x, z: this.z, red: false, unblockable: true, src: this, knockdown: true });
        this.hitCrowd(7, 3);
      }
      if (this.st >= dur) { this.state = "idle"; this.atkCd = 1.2; }
    }
  }

  hitCrowd(r, mv) {
    const ctx = this.ctx;
    for (const a of ctx.crowd.agents) {
      if (a.side !== (this.side === "dich" ? "ta" : "dich") || !ctx.crowd.hittable(a)) continue;
      const dx = a.x - this.x, dz = a.z - this.z, d = Math.hypot(dx, dz);
      if (d > r) continue;
      ctx.crowd.damage(a, this.cong * mv * heSoGiap(a.giap, ctx.R), { kx: dx / (d || 1), kz: dz / (d || 1), knock: 4, by: this.side === "ta" ? "ally" : "enemy" });
    }
  }

  updateAlly(dt) {
    const ctx = this.ctx;
    this.atkCd -= dt;
    let best = null, bd = 64;
    for (const a of ctx.crowd.agents) {
      if (a.side !== "dich" || !ctx.crowd.hittable(a)) continue;
      const d2 = (a.x - this.x) ** 2 + (a.z - this.z) ** 2;
      if (d2 < bd) { bd = d2; best = a; }
    }
    if (this.state === "atk") {
      this.st += dt; const u = this.st / 0.8;
      this.setPose(this.rigKey === "H40" ? A.shoot(u) : A.slash(u, 1, 0.3), 0.5);
      if (!this.hitDone && u > 0.55) {
        this.hitDone = true;
        if (this.atkTarget && ctx.crowd.hittable(this.atkTarget)) {
          const a = this.atkTarget, dx = a.x - this.x, dz = a.z - this.z, dd = Math.hypot(dx, dz) || 1;
          ctx.crowd.damage(a, this.cong * 1.5 * heSoGiap(a.giap, ctx.R), { kx: dx / dd, kz: dz / dd, knock: 4, by: "ally" });
          if (this.rigKey !== "H40") this.hitCrowd(2.6, 0.8);
        }
      }
      if (u >= 1) { this.state = "idle"; this.atkCd = this.T.every; }
      return;
    }
    const range = this.rigKey === "H40" ? 16 : 2.8;
    if (best && Math.sqrt(bd) < (this.rigKey === "H40" ? 18 : 10)) {
      const dx = best.x - this.x, dz = best.z - this.z, d = Math.hypot(dx, dz);
      this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 6);
      if (d > range) { this.moveToward(best.x, best.z, dt, 0.9); return; }
      if (this.atkCd <= 0) { this.state = "atk"; this.st = 0; this.hitDone = false; this.atkTarget = best; return; }
      this.setPose(A.idle(this.animT), 0.15); return;
    }
    const pd = Math.hypot(this.post.x - this.x, this.post.z - this.z);
    if (pd > 1.5) { this.moveToward(this.post.x, this.post.z, dt, pd > 10 ? 1 : 0.5); return; }
    this.yaw = turn(this.yaw, Math.PI / 2, dt * 3);
    // diễn: vung vũ khí về phía tuyến
    if (this.atkCd <= 0) { this.state = "atk"; this.st = 0; this.hitDone = true; this.atkTarget = null; this.atkCd = 2 + this.ctx.rng.next() * 2; return; }
    this.setPose(A.idle(this.animT), 0.1);
  }

  // free: chạy theo kịch bản (Toa Đô rút chạy) — không tính dốc, bùn
  moveToward(tx, tz, dt, k, free = false) {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1;
    const sp = this.speed * k * (free ? 1 : speedFactor(this.x, this.z, dx, dz));   // dốc, bùn (terrain-rules.js)
    this.x += dx / d * sp * dt; this.z += dz / d * sp * dt;
    [this.x, this.z] = collide(this.ctx.world, this.x, this.z, 0.7, this.ctx.openGates);
    this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 7);
    const gt = A.gait(sp, this.rig.scale);         // nhịp bước theo tốc độ và cỡ người: chân trụ không trượt
    this.runPhase += dt * gt.rate;
    const p = A.run(this.runPhase, Math.min(1, k + 0.2), gt.stride);
    if (this.longWeapon) A.carryLong(p, this.runPhase);   // giáo, đại đao dựng đứng khi chạy (không cắm đất)
    this.setPose(p, 0.3);
  }

  setPose(p, k) { this.pose = A.blendPose(this.pose, p, Math.min(1, k)); A.applyPose(this.rig, this.pose); }

  // dt = bước mô phỏng vừa chạy (0 khi dựng): chuyển động phụ theo bước mô phỏng, hit-stop thì đứng yên.
  place(dt = 0) {
    const r = this.rig.root;
    r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw;
    if (this.alive) this.motion.update(dt, this.pose, heightAt);
  }

  // Đòn của tướng người chơi. Trả về { killed, broke }.
  takeHeroHit(dmg, poiseDmg, opt = {}) {
    if (!this.alive || this.dead || this.retreating || this.side !== "dich") return {};
    const ctx = this.ctx;
    const mult = this.broken > 0 ? 1.5 : 1;
    this.hp -= dmg * mult; this.flash = 0.12; this.noHit = 0; this.awake = true;
    let broke = false;
    if (this.poiseMax > 0 && this.broken <= 0) {
      this.poise -= poiseDmg;
      if (this.poise <= 0) { this.poise = 0; this.broken = 3.5; this.state = "idle"; broke = true; ctx.director?.onBreak(this); }
    }
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.tier === "tuong") { this.retreating = true; this.retreatT = 0; ctx.director?.onBossDefeated(this); }
      else { this.dead = 0.001; ctx.director?.onOfficerKilled(this, opt); ctx.crowd?.rout(this.x, this.z, AI.rout.officerR); }
      return { killed: true, broke };
    }
    // bị dồn 3 đòn trong 1,5 s mà chưa vỡ thế: có thể lùi né thoát khỏi chuỗi đòn
    const now = ctx.clock; this.hitTimes.push(now);
    while (this.hitTimes.length && now - this.hitTimes[0] > 1.5) this.hitTimes.shift();
    if (!broke && this.broken <= 0 && this.hitTimes.length >= 3 && this.backCd <= 0 && this.state === "idle" && ctx.rng.next() < 0.4) {
      this.state = "evade"; this.st = 0.4; this.backCd = 5; this.hitTimes.length = 0;
      return { killed: false, broke };
    }
    const interrupt = (opt.knock || opt.launch) && this.state === "atk";
    if (!broke && (interrupt || (this.poiseMax > 0 && this.poise < this.poiseMax * 0.35 && this.state === "idle"))) { this.state = "hit"; this.st = 0.3; }
    return { killed: false, broke };
  }

  // Đòn của địch vào tướng đồng minh.
  receiveHit({ dmg }) {
    if (this.side !== "ta" || !this.alive || this.dead) return;
    this.hp -= dmg; this.flash = 0.1;
    if (this.hp <= 0) { this.hp = 0; this.dead = 0.001; this.ctx.director?.onAllyGeneralDown(this); }
  }

  updateRetreat(dt) {
    // defeatMeans = "rút chạy": chạy ra mép nước rồi lên thuyền.
    this.retreatT += dt;
    const tx = this.retreatTo?.x ?? 540, tz = this.retreatTo?.z ?? -175;
    if (this.retreatT < 1.2) { this.setPose(A.hitReact(this.retreatT / 1.2), 0.3); }
    else {
      this.moveToward(tx, tz, dt, 1.2, true);
      if (this.retreatT > 6) { this.rig.root.visible = Math.floor(this.retreatT * 8) % 2 === 0; }
      if (this.retreatT > 8) { this.dispose(); }
    }
    this.place(dt);
  }
}

function facing(u, t, halfArc) {
  const dx = t.x - u.x, dz = t.z - u.z, a = Math.atan2(dx, dz);
  let d = a - u.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d) <= halfArc;
}
