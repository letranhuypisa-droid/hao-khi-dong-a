// battle/units.js — đơn vị lớn có rig riêng: Đội trưởng, Phó tướng, Toa Đô, tướng đồng minh.
//
// Bậc có thanh Phá Thế dùng HP = 120 × hệ số bậc × S(R) (11.1). Phá Thế về 0 → Vỡ Thế: đứng
// khựng, nhận sát thương ×1,5, mở Đòn Quyết (3.7). Đòn viền đỏ báo trước 0,6 s và chỉ phản đòn
// được, không đỡ được (3.6).
//
// Bắt sống (B20, defeatMeans "bị bắt" — Ô Mã Nhi, Phàn Tiếp): hpLockPct > 0 thì Sinh lực không xuống dưới ngưỡng đó (khóa, viền
// vàng ở HUD — this.hpLocked); Đòn Quyết trúng lúc Vỡ Thế khi Sinh lực ≤ captureAtPct% (mặc định = hpLockPct), hoặc Sinh lực về
// 0, thì bị bắt: đứng thẳng, vũ khí đặt dưới chân, không đánh nữa (không trói, không quỳ — R-spec §6). director.onCaptured(u)
// (không có thì onBossDefeated). Thủy chiến (naval.js): this.deck, toạ độ trên boong do naval chở; this.climbY khi đang leo.
// Boss B20 (director-b20.js): o.T đè số của bậc (Ô Mã Nhi: bậc "tuong" nhưng HP 12000, Phá Thế 1000 — Đại tướng), o.leash (m quanh
// nhà), o.stay(tướng) (boss giữ boong của mình: tướng ở ngoài thì về chỗ đứng), this.script = { pts, k, onDone } đi theo kịch bản (lui lên lầu kỳ hạm — không nhận đòn), T.lunge
// "Kích xuyên" (lao đâm: báo trước rồi lướt tới) khi this.lungeOn.
// B15 không có các trường này nên mọi nhánh mới không chạy.

import { makeRig, disposeRig, RIGS } from "./models.js";
import { RigMotion } from "./rig-motion.js";
import * as A from "./anim.js";
import * as THREE from "three";
import { heightAt, collide } from "./world.js";
import { TIERS, S, g, heSoGiap, DEFENSE, AI, BROKEN_SEC } from "../data/tuning.js";
import { turn } from "./crowd.js";
import { speedFactor, hitMult } from "../sim/terrain-rules.js";   // dốc, bùn, thế đất cao

const STRAFE_SPEED = 1.5;     // m/s, đi vòng thăm dò quanh tướng
const NO_IK = { ik: false };  // đang leo boong: chân không bám đất

// Vũ khí đặt dưới chân người bị bắt (đạo cụ đơn giản, nằm ngang trước mũi chân, trục x cục bộ): đại đao, giáo, đao, cung.
function weaponProp(kind, s = 1) {
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x6a4a2e }), steel = new THREE.MeshLambertMaterial({ color: 0xb8bcc0 });
  const bar = (len, r, mat, x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat); m.rotation.z = Math.PI / 2; m.position.x = x; m.castShadow = true; g.add(m); };
  const blade = (len, w, x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, w), steel); m.position.x = x; m.castShadow = true; g.add(m); };
  if (kind === "dadao") { bar(2.0, 0.035, wood, -0.35); blade(0.8, 0.26, 1.0); }
  else if (kind === "giao") { bar(2.6, 0.03, wood, -0.2); blade(0.4, 0.08, 1.3); }
  else if (kind === "cung") { bar(1.4, 0.03, wood, 0); }
  else { bar(0.25, 0.03, wood, -0.55); blade(1.0, 0.09, 0.1); }
  g.scale.setScalar(s); g.name = "captured-weapon";
  return g;
}

export class BigUnit {
  constructor(ctx, o) {
    this.ctx = ctx; this.isBig = true; this.alive = true;
    Object.assign(this, { kind: o.kind, side: o.side, tier: o.tier, name: o.name, id: o.id, base: o.base || null });
    this.rigKey = o.rigKey || o.tier;
    const R = ctx.R;
    if (o.side === "dich") {
      const T = o.T ? { ...TIERS[o.tier], ...o.T } : TIERS[o.tier];
      // HP địch ×, Phá Thế địch × theo độ khó (§10)
      this.maxHp = T.hp * S(R) * (ctx.diff?.hp ?? 1); this.cong = T.cong * g(R); this.giap = T.giap * g(R);
      // ctx.poiseAbs (B20): Phá Thế theo số tuyệt đối của canon (Đội trưởng 100, Tướng 600, Đại tướng 1000 mỗi tầng) — không nhân
      // S(R) như Sinh lực (đòn của tướng bào Phá Thế theo MV, không theo cấp). B15 (R1, S = 1) không đặt cờ này.
      this.poiseMax = T.poise * (ctx.poiseAbs ? 1 : S(R)) * (ctx.diff?.poise ?? 1); this.T = T;
    } else {
      this.maxHp = o.hp * g(R) * (1 + (ctx.stats?.mods.allyHpPct || 0)); this.cong = 110 * g(R); this.giap = 60 * g(R); this.poiseMax = 0;
      this.T = { mv: 1.5, every: 1.4, red: 0 };
    }
    this.hp = this.maxHp * (o.hpFrac ?? 1); this.poise = this.poiseMax;
    const cfg = RIGS[o.rigKey || o.tier];
    this.weaponKind = cfg.weapon;
    this.defeatMeans = o.defeatMeans || null; this.hpLockPct = o.hpLockPct || 0; this.captureAtPct = o.captureAtPct ?? this.hpLockPct;
    this.captured = false; this.hpLocked = false; this.leash = o.leash; this.stay = o.stay || null; this.script = null; this.lungeOn = false; this.lungeCd = 3;
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

  get y() {
    if (this.climbY !== undefined) return this.climbY;                   // đang leo boong (naval.js)
    if (this.deck) { const h = this.deck.heightAt(this.x, this.z, 0.8); if (h === h) return h; }   // trên boong xa tướng
    return heightAt(this.x, this.z);
  }
  get radius() { return 0.9 * this.rig.scale; }

  // Gỡ rig khỏi cảnh, giải phóng khung xương (texture xương), vật liệu riêng của đơn vị (hình học dùng chung, đệm theo
  // cấu hình trong models.js). Trước đây chỉ gỡ khỏi cảnh: mỗi lần sinh/xoá (Luyện tập sinh lại sĩ quan mỗi 3 s, thử
  // lại checkpoint, tướng đồng minh ngã rồi dậy) rò 22 geometry + 1 texture trên GPU.
  dispose() {
    disposeRig(this.rig); this.alive = false;
    if (this.prop) { this.ctx.scene.remove(this.prop); this.prop.traverse((m) => { m.geometry?.dispose(); m.material?.dispose(); }); this.prop = null; }
  }

  // Bắt sống: dừng mọi hành động, giấu vũ khí trong tay, đặt vũ khí nằm ngang dưới chân (đạo cụ riêng); thẻ "retreating"
  // để mọi vòng chọn mục tiêu cũ (tướng, khoá mục tiêu, Đòn Quyết) bỏ qua người đã bị bắt.
  capture(opt = {}) {
    if (this.captured) return;
    const ctx = this.ctx;
    this.captured = true; this.state = "captured"; this.st = 0; this.broken = 0; this.retreating = true; this.hp = Math.max(this.hp, 1);
    this.rig.p.handR.scale.setScalar(0.001);
    if (this.weaponKind === "cung") this.rig.p.handL.scale.setScalar(0.001);
    this.prop = weaponProp(this.weaponKind, this.rig.scale); ctx.scene.add(this.prop);
    if (ctx.hero?.lock === this) ctx.hero.lock = null;
    ctx.fx?.banner?.("BẮT SỐNG", "#f1d98a");
    if (ctx.director?.onCaptured) ctx.director.onCaptured(this, opt); else ctx.director?.onBossDefeated?.(this);
  }

  update(dt) {
    const ctx = this.ctx, hero = ctx.hero;
    this.animT += dt; this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    if (this.captured) { this.setPose(A.captured(this.animT), 0.12); this.place(dt); return; }   // bị bắt: đứng yên
    if (this.dead > 0) { this.dead += dt; this.setPose(A.knockdown(this.dead), 0.3); if (this.dead > 3.5) this.dispose(); this.place(dt); return; }
    if (this.script) { this.updateScript(dt); this.place(dt); return; }   // đi theo kịch bản (B20: lui lên lầu kỳ hạm)
    if (this.retreating) { this.updateRetreat(dt); return; }

    if (this.poiseMax > 0) {
      this.noHit += dt;
      if (this.broken > 0) {
        this.broken -= dt;
        this.setPose(A.stagger(BROKEN_SEC - this.broken, this.longWeapon), 0.25);     // Vỡ Thế: loạng choạng rồi khuỵu, gục
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
      [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.7, ctx.openGates, this);
      this.setPose(A.backstep(1 - this.st / 0.4), 0.5); if (this.st <= 0) { this.state = "idle"; this.atkCd = Math.min(this.atkCd, 0.4); }
      return;
    }
    if (this.state === "hit") { this.st -= dt; this.setPose(A.hitReact(1 - this.st / 0.3), 0.4); if (this.st <= 0) this.state = "idle"; return; }
    if (this.state === "stagger") { this.st -= dt; this.setPose(A.hitReact(0.5), 0.3); if (this.st <= 0) this.state = "idle"; return; }

    if (this.state === "atk" || this.state === "red" || this.state === "ult" || this.state === "lunge") { this.updateAttack(dt, hero, d); return; }

    if (!this.awake || !hero.alive) {
      const hd = Math.hypot(this.home.x - this.x, this.home.z - this.z);
      if (hd > 2) this.moveToward(this.home.x, this.home.z, dt, 0.5); else this.setPose(A.idle(this.animT), 0.1);
      return;
    }
    // Boss giữ boong (B20, o.stay(tướng) → false khi tướng không đứng trên boong cho phép): về chỗ, đứng nhìn — không xuống bùn đuổi.
    if (this.stay && !this.stay(hero)) {
      if (Math.hypot(this.home.x - this.x, this.home.z - this.z) > 1.5) this.moveToward(this.home.x, this.home.z, dt, 0.8);
      else { this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 4); this.setPose(A.idle(this.animT), 0.15); }
      return;
    }
    // Đội trưởng, Phó tướng bị giữ quanh Cứ Điểm; Toa Đô đuổi khắp bãi.
    const leash = this.leash ?? (this.tier === "tuong" ? 999 : 40);
    if (Math.hypot(this.x - this.home.x, this.z - this.home.z) > leash && d > 8) { this.moveToward(this.home.x, this.home.z, dt, 1); return; }

    this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 6);
    this.atkCd -= dt; this.redCd -= dt; this.ultCd -= dt;
    const T = this.T;
    if (T.lunge && this.lungeOn) {                 // Kích xuyên (B20 Ô Mã Nhi ở lầu chỉ huy): tướng cách 3,5–7,5 m thì lao đâm
      this.lungeCd -= dt;
      if (this.lungeCd <= 0 && d > 3.5 && d < 7.5) {
        this.state = "lunge"; this.st = 0; this.hitDone = false; this.lungeCd = T.lunge.cd; this.lungeYaw = Math.atan2(dx, dz);
        ctx.fx.telegraph(this, 3, T.lunge.tele, false); ctx.audio.play("warn", this.x, this.z); return;
      }
    }
    // T.ultMax (B20 Ô Mã Nhi: 1 — canon một Tuyệt Kỹ trên lầu chỉ huy): số lần tối đa; thiếu = không giới hạn (B15 Toa Đô như cũ)
    if (this.tier === "tuong" && T.ult && this.hp < this.maxHp * 0.5 && this.ultCd <= 0 && d < 9 && !(T.ultMax !== undefined && (this.ultN || 0) >= T.ultMax)) {
      this.state = "ult"; this.st = 0; this.hitDone = false; this.ultCd = 16;
      if (T.ultMax !== undefined) this.ultN = (this.ultN || 0) + 1;
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
    [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.7, ctx.openGates, this);
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
    } else if (this.state === "lunge") {
      // Kích xuyên: báo trước tele s (thế chém nặng lấy đà), rồi lướt tới dist m trong 0,3 s theo hướng đã nhắm, trúng tướng
      // trong 2,8 m quanh mũi đòn (đòn nặng, đỡ / né được)
      const L = T.lunge, tele = L.tele, dash = 0.3, dur = tele + dash + 0.4;
      if (this.st < tele) { this.yaw = turn(this.yaw, this.lungeYaw, dt * 6); this.setPose(A.heavyChop(this.st / tele * 0.45, 0.9, this.longWeapon), 0.5); }
      else if (this.st < tele + dash) {
        const sp = L.dist / dash; this.yaw = this.lungeYaw;
        this.x += Math.sin(this.yaw) * sp * dt; this.z += Math.cos(this.yaw) * sp * dt;
        [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.7, ctx.openGates, this);
        this.setPose(A.dash(0.2 + (this.st - tele) / dash * 0.45), 0.7);
        if (!this.hitDone && Math.hypot(hero.x - this.x, hero.z - this.z) < 2.8) {
          this.hitDone = true;
          hero.receiveHit({ dmg: this.cong * L.mv * heSoGiap(hero.giap, ctx.R) * ctx.diff.dmg * hitMult(this, hero), x: this.x, z: this.z, red: false, src: this, heavy: true });
        }
      } else this.setPose(A.dash(0.65 + (this.st - tele - dash) / 0.4 * 0.35), 0.4);
      if (this.st >= dur) { this.state = "idle"; this.atkCd = 0.9; }
    }
  }

  // Đi theo kịch bản (this.script: { pts: [{x, z}], k, i, onDone }): tới từng điểm, không nhận đòn; tới nơi thì đứng thủ thế nhìn
  // tướng tới khi director gỡ kịch bản.
  updateScript(dt) {
    const S = this.script, p = S.pts[S.i || 0], h = this.ctx.hero;
    this.state = "idle"; this.broken = 0;
    if (p) {
      if (Math.hypot(p.x - this.x, p.z - this.z) < 0.6) S.i = (S.i || 0) + 1;       // tới điểm: bước sau đi điểm kế
      else this.moveToward(p.x, p.z, dt, S.k ?? 1, true);
      return;
    }
    this.yaw = turn(this.yaw, Math.atan2(h.x - this.x, h.z - this.z), dt * 4); this.setPose(A.idle(this.animT), 0.15);
    if (!S.done) { S.done = true; S.onDone?.(this); }
  }

  hitCrowd(r, mv) {
    const ctx = this.ctx;
    for (const a of ctx.crowd.agents) {
      if (a.side !== (this.side === "dich" ? "ta" : "dich") || !ctx.crowd.hittable(a)) continue;
      const dx = a.x - this.x, dz = a.z - this.z, d = Math.hypot(dx, dz);
      if (d > r) continue;
      ctx.crowd.damage(a, this.cong * mv * heSoGiap(a.giap, ctx.R), { kx: dx / (d || 1), kz: dz / (d || 1), knock: 4, by: this.side === "ta" ? "ally" : "enemy" });
    }
    // cận vệ Tự do (battle/guard.js, đợt 15c) đứng trong tầm quét của sĩ quan địch cũng trúng, × meleeMult như lính địch chém (B15/B20 không có)
    if (this.side === "dich") for (const u of ctx.units) {
      if (!u.isGuard || !u.alive || u.down || Math.hypot(u.x - this.x, u.z - this.z) > r + u.radius) continue;
      u.receiveHit({ dmg: this.cong * mv * heSoGiap(u.giap, ctx.R) * u.meleeMult, x: this.x, z: this.z, src: this });
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
    // thủy chiến: đích ở boong khác thì đi qua ván bắc / ván dốc (naval.route)
    const nav = this.ctx.naval;
    if (nav && (this.deck || this.ctx.hero?.deck)) { const w = nav.route(this, null, tx, tz); if (w) { tx = w.x; tz = w.z; } }
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz) || 1;
    const sp = this.speed * k * (free ? 1 : speedFactor(this.x, this.z, dx, dz));   // dốc, bùn (terrain-rules.js)
    this.x += dx / d * sp * dt; this.z += dz / d * sp * dt;
    [this.x, this.z] = collide(this.ctx.world, this.x, this.z, 0.7, this.ctx.openGates, this);
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
    if (this.alive) this.motion.update(dt, this.pose, heightAt, this.climbY !== undefined ? NO_IK : undefined);
    if (this.prop) {             // vũ khí đặt nằm ngang trước mũi chân (bị bắt), theo người (người đứng trên boong trôi theo boong)
      const f = 0.75 * this.rig.scale, px = this.x + Math.sin(this.yaw) * f, pz = this.z + Math.cos(this.yaw) * f;
      this.prop.position.set(px, (this.deck ? this.y : heightAt(px, pz)) + 0.05, pz); this.prop.rotation.y = this.yaw;
    }
  }

  // Đòn của tướng người chơi. Trả về { killed, broke }.
  takeHeroHit(dmg, poiseDmg, opt = {}) {
    if (!this.alive || this.dead || this.retreating || this.script || this.side !== "dich") return {};
    const ctx = this.ctx;
    if (this.stay && !this.stay(ctx.hero)) return {};          // boss giữ boong: tướng đứng ngoài (bùn dưới mạn) không chém tới
    let mult = this.broken > 0 ? 1.5 : 1;
    if (this.markT > ctx.clock) mult *= this.markMult;       // dấu Binh Thư Yếu Lược (hero-skills.js): +40% tới giờ markT
    const wasBroken = this.broken > 0;
    this.hp -= dmg * mult; this.flash = 0.12; this.noHit = 0; this.awake = true;
    if (this.defeatMeans === "bị bắt") {                 // bắt sống (B20): khóa Sinh lực, Đòn Quyết lúc Vỡ Thế thì bị bắt
      const lock = this.maxHp * this.hpLockPct / 100;
      if (lock > 0 && this.hp < lock) this.hp = lock;
      this.hpLocked = lock > 0 && this.hp <= lock + 1e-6;
      if (this.hp <= 0 || (opt.finisher && wasBroken && this.hp <= this.maxHp * this.captureAtPct / 100 + 1e-6)) {
        this.capture(opt); return { killed: true, broke: false, captured: true };
      }
    }
    let broke = false;
    if (this.poiseMax > 0 && this.broken <= 0) {
      this.poise -= poiseDmg;
      if (this.poise <= 0) { this.poise = 0; this.broken = BROKEN_SEC; this.state = "idle"; broke = true; ctx.director?.onBreak(this); }
    }
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.tier === "tuong") { this.retreating = true; this.retreatT = 0; ctx.director?.onBossDefeated(this, opt); }
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
