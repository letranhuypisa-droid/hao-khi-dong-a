// battle/hero.js — H35 Trần Quốc Toản, lớp WC03 Song đao (GDD mục 3, Đặc tả 21.6).
//
// Máy trạng thái: free · attack · dodge · block · hit · down · skill · ult · dead.
// Bộ đệm input 0,15 s. Hủy đòn vào Né ở 30% cuối clip. Đòn thường của lính không ngắt được
// đòn đang ra (giáp đòn) — chỉ đòn nặng, đòn viền đỏ mới ngắt (ĐỀ XUẤT BẢN THỬ).

import { makeRig, RIGS } from "./models.js";
import { RigMotion } from "./rig-motion.js";
import * as A from "./anim.js";
import { heightAt, collide } from "./world.js";
import { HERO, MOVES, DEFENSE, POISE_PER_MV, C_POISE_MULT, heSoGiap, CRIT_MULT, GATE_DIV, HAO_KHI, AI, IMPACT, ultBigDamage, ultBigNote } from "../data/tuning.js";
import { turn } from "./crowd.js";
import { speedFactor, hitMult } from "../sim/terrain-rules.js";   // dốc, bùn, thế đất cao (chỉ chạy thường, sát thương)
import { HERO_ANIM as ANIM } from "./hero-anim.js";
import { BladeTrail } from "./trail.js";
import * as THREE from "three";

const BLADE_BASE = new THREE.Vector3(0, 0.02, 0.32), BLADE_TIP = new THREE.Vector3(0, 0.02, 1.06);
const _b = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();

const CHAIN_N = ["N1", "N2", "N3", "N4", "N5", "N6"];

export class Hero {
  constructor(ctx, stats) {
    this.ctx = ctx; this.stats = stats; this.mods = stats.mods;
    this.rig = makeRig(RIGS.hero);
    this.motion = new RigMotion(this.rig);        // chân bám đất, vạt áo, dải khăn, cờ (rig-motion.js)
    ctx.scene.add(this.rig.root);
    this.trails = [new BladeTrail(ctx.scene, 0xd9b36a, 0.14), new BladeTrail(ctx.scene, 0xd9b36a, 0.14)];
    this.x = 72; this.z = -32; this.yaw = Math.PI / 2;     // ngoài rào bản doanh, để camera không kẹt vào lều
    // vx/vz: vận tốc thật (m/s) đo mỗi bước — cung địch bắn đón theo đó (crowd.fireArrow). Trước đợt 9 dòng khởi tạo này
    // nằm lọt trong chú thích ở dòng trên, không ai gán vx/vz nên tên địch luôn bắn vào chỗ tướng đang đứng.
    this.vx = 0; this.vz = 0; this.y = 0;
    this.maxHp = stats.hp; this.hp = this.maxHp; this.giap = stats.giap;
    this.ki = 0; this.kiMax = HERO.kiLucBars * HERO.kiLucPerBar;
    this.revives = ctx.diff.revive; this.alive = true;
    this.state = "free"; this.st = 0; this.move = null; this.chain = 0; this.chainGrace = 0;
    this.buf = null; this.dodgeChain = 0; this.dodgeCd = 0; this.postDodge = 0;
    this.invuln = 0; this.parryAt = -9; this.parryLock = 0; this.blocking = false; this.blockT = 0;
    this.phaTran = { cd: 0, left: 0, window: 0 };
    this.buffs = { atk: 0, atkT: 0, flag: 0, flagT: 0 };
    this.combo = 0; this.comboT = 0; this.lienHoan = 0; this.lienHoanT = 0;
    this.pose = A.idle(0); this.animT = 0; this.runPhase = 0; this.swingId = 0;
    this.lock = null; this.hkUltReady = false;
    this.kiEngaged = 0; this.koHealAcc = 0; this.inTouch = false;
    A.applyPose(this.rig, this.pose);
    this.place(0);
  }

  get atkSpeed() { return HERO.atkSpeed * (1 + this.mods.atkSpeed + 0.04 * this.lienHoan); }
  get parryWindow() { return (this.inTouch ? DEFENSE.parryWindowTouch : DEFENSE.parryWindow) + this.mods.parryWin; }
  get inTPC() { return this.ctx.hk.tpc; }

  // Bộ đệm giữ phím bấm trong lúc đang ra đòn cho tới khi đòn kế được phép (bấm dồn), ngoài ra
  // giữ 0,15 s. swing ghi lại đòn đang ra lúc bấm để biết khi nào hết hạn.
  press(action) { this.buf = { a: action, t: this.ctx.clock, swing: this.state === "attack" ? this.swingId : -1 }; }

  // Nhận phím cạnh MỖI KHUNG HÌNH, kể cả khung không chạy bước mô phỏng nào (hit-stop, màn
  // 120/144 Hz, vòng Mệnh Lệnh ×0,2). Trước đây phím chỉ được đọc ở bước đầu tiên của khung, nên
  // khung 0 bước làm rơi mất phím: bấm dồn khi đang chém trúng (hit-stop) hầu như không ăn.
  intake(inp) {
    if (!this.alive) return;
    const P = inp.pressed;
    if (P.n) this.press("n");
    if (P.c) this.press("c");
    if (P.dodge) this.press("dodge");
    if (P.skill) this.press("skill");
    if (P.ult) this.press("ult");
    if (P.block && this.ctx.clock > this.parryLock) this.parryAt = this.ctx.clock;
  }

  update(dt, inp) {
    const ctx = this.ctx, px = this.x, pz = this.z;
    this.animT += dt; this.inTouch = inp.touch;
    for (const tr of this.trails) tr.update(dt);
    this.invuln = Math.max(0, this.invuln - dt); this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.postDodge = Math.max(0, this.postDodge - dt); this.chainGrace = Math.max(0, this.chainGrace - dt);
    this.phaTran.cd = Math.max(0, this.phaTran.cd - dt);
    if (this.phaTran.window > 0) { this.phaTran.window -= dt; if (this.phaTran.window <= 0) { this.phaTran.left = 0; this.phaTran.cd = HERO.phaTran.cd; } }
    for (const k of ["atk", "flag"]) if (this.buffs[k + "T"] > 0) { this.buffs[k + "T"] -= dt; if (this.buffs[k + "T"] <= 0) this.buffs[k] = 0; }
    if (this.lienHoanT > 0) { this.lienHoanT -= dt; if (this.lienHoanT <= 0) this.lienHoan = 0; }
    this.comboT -= dt; if (this.comboT <= 0) this.combo = 0;
    if (this.parryAt > 0 && ctx.clock - this.parryAt > this.parryWindow) { this.parryAt = -9; this.parryLock = ctx.clock + DEFENSE.counterLockout; }
    // phím N/C bấm giữa lúc lộn né được giữ tới khi né xong (ra Lướt chém) — trước đây hết hạn 0,15 s giữa chừng cú né 0,32 s
    if (this.buf && ctx.clock - this.buf.t > DEFENSE.inputBuffer && !(this.state === "attack" && this.buf.swing === this.swingId)
      && !(this.state === "dodge" && (this.buf.a === "n" || this.buf.a === "c"))) this.buf = null;

    // Khí Lực nạp khi giao chiến
    const engaged = this.nearestEnemy(12) !== null;
    if (engaged) this.kiEngaged = 3; else this.kiEngaged -= dt;
    if (this.kiEngaged > 0 && this.state !== "ult") this.addKi(HERO.kiLucRegen * dt * (this.inTPC ? HAO_KHI.tpc.kiLucRegen : 1));

    if (!this.alive) { this.vx = this.vz = 0; this.setPose(A.knockdown(this.st += dt), 0.3); this.place(dt); return; }

    this.blocking = inp.block;     // phím cạnh đã vào bộ đệm qua intake()

    // hướng input theo camera
    const cy = ctx.cam.yaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const mx = inp.moveX, my = inp.moveY, mag = Math.min(1, Math.hypot(mx, my));
    const wx = fx * my - fz * mx, wz = fz * my + fx * mx;   // phải = (−fz, fx) nhân −mx
    this.inputDir = mag > 0.15 ? Math.atan2(wx, wz) : null;
    this.inputMag = mag;

    switch (this.state) {
      case "free": this.updateFree(dt, wx, wz, mag); break;
      case "attack": this.updateAttack(dt); break;
      case "dodge": this.updateDodge(dt); break;
      case "block": this.updateBlock(dt, wx, wz, mag); break;
      case "hit": this.st -= dt; this.setPose(A.hitReact(1 - this.st / 0.3), 0.5); if (this.st <= 0) this.state = "free"; break;
      case "down": this.st -= dt; this.setPose(this.st > 0.5 ? A.knockdown(1) : A.idle(this.animT), this.st > 0.5 ? 0.4 : 0.12); if (this.st <= 0) this.state = "free"; break;
      case "skill": this.updateSkill(dt); break;
      case "ult": this.updateUlt(dt); break;
    }
    [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.5, ctx.openGates);
    if (dt > 0) { this.vx = (this.x - px) / dt; this.vz = (this.z - pz) / dt; }
    this.place(dt);
  }

  // ---- trạng thái tự do ------------------------------------------------------------------
  updateFree(dt, wx, wz, mag) {
    if (this.tryActions()) return;
    if (this.blocking) { this.state = "block"; this.blockT = 0; return; }
    if (mag > 0.15) {
      const sp = HERO.move * mag * (this.inTPC ? 1.1 : 1) * speedFactor(this.x, this.z, wx, wz);   // lên dốc, bùn chậm; xuống dốc nhanh
      this.x += (wx / mag) * sp * dt; this.z += (wz / mag) * sp * dt;
      this.yaw = turn(this.yaw, this.lock?.alive ? this.faceLock() : Math.atan2(wx, wz), dt * 12);
      const before = Math.floor(this.runPhase / Math.PI);
      const g = A.gait(sp, this.rig.scale);        // nhịp bước + biên độ đùi khớp tốc độ: chân trụ không trượt
      this.runPhase += dt * g.rate;
      if (mag > 0.6 && Math.floor(this.runPhase / Math.PI) !== before) this.ctx.fx.dust(this.x - Math.sin(this.yaw) * 0.4, this.z - Math.cos(this.yaw) * 0.4, 0.3);   // bụi bước chân
      this.setPose(A.run(this.runPhase, mag, g.stride), 0.35);
    } else this.setPose(A.idle(this.animT), 0.15);
  }

  tryActions() {
    const b = this.buf; if (!b) return false;
    if (b.a === "dodge") return this.startDodge();
    if (b.a === "skill") return this.startSkill();
    if (b.a === "ult") return this.startUlt();
    if (b.a === "c") {
      const broken = this.findBroken();
      if (broken) { this.buf = null; this.startMove("DQ", broken); return true; }
      if (this.postDodge > 0) { this.buf = null; this.startMove("DC"); return true; }
      const k = this.chainGrace > 0 ? this.chain + 1 : 1;
      this.buf = null; this.startMove(this.cKey(k)); return true;
    }
    if (b.a === "n") {
      if (this.postDodge > 0) { this.buf = null; this.startMove("DN"); return true; }
      const k = this.chainGrace > 0 && this.chain < 6 ? this.chain + 1 : 1;
      this.buf = null; this.startMove(CHAIN_N[k - 1]); this.chain = k; return true;
    }
    return false;
  }

  cKey(k) {
    // C5, C6 là nội dung VS: bản này mở theo cấp tướng (5 và 10). Chưa mở thì lùi về C4.
    let key = "C" + Math.min(6, k);
    while (MOVES[key].unlockLv && this.stats.level < MOVES[key].unlockLv) key = "C" + (Number(key[1]) - 1);
    return key;
  }

  startMove(key, target = null) {
    const m = MOVES[key];
    this.state = "attack"; this.move = key; this.st = 0; this.hitIdx = 0; this.swingId++;
    this.moveTarget = target;
    this.dur = m.dur / this.atkSpeed;
    this.ctx.director.onHeroAction?.("move", key);
    if (key[0] === "C" || key === "DQ" || key === "CT") this.chain = 0;
    // tự nhắm: xoay về địch gần nhất theo hướng input
    const t = target || (this.lock?.alive ? this.lock : this.autoTarget());
    if (t) this.yaw = Math.atan2(t.x - this.x, t.z - this.z);
    else if (this.inputDir !== null) this.yaw = this.inputDir;
    this.stepLeft = (m.dash || m.step || 0);
    this.ctx.audio.play(m.mv > 2 || key === "N6" || key[0] === "C" || key === "DC" ? "whooshHeavy" : "whoosh");
    // tiếng thét khi ra đòn mạnh (không phải lần nào cũng thét cho khỏi nhàm)
    if ((key[0] === "C" && key !== "CT") || key === "DQ" || key === "N6") { if (this.ctx.rng.chance(key === "DQ" ? 1 : 0.4)) this.ctx.audio.play("kiai"); }
  }

  updateAttack(dt) {
    const m = MOVES[this.move];
    this.st += dt; const u = this.st / this.dur;
    this.setPose(ANIM[this.move](Math.min(1, u)), 0.8);
    // bước tới / lao tới
    if (this.stepLeft > 0) {
      const rate = m.dash ? m.dash / (this.dur * 0.45) : (m.step / (this.dur * 0.5));
      const s = Math.min(this.stepLeft, rate * dt);
      const blocked = !m.dash && this.nearestEnemy(1.3, true);
      if (!blocked) { this.x += Math.sin(this.yaw) * s; this.z += Math.cos(this.yaw) * s; }
      this.stepLeft -= s;
    }
    while (this.hitIdx < m.hits.length && u >= m.hits[this.hitIdx]) {
      const last = this.hitIdx === m.hits.length - 1;
      this.applyHits(this.move, m, last);
      this.hitIdx++;
    }
    const lastHit = m.hits[m.hits.length - 1];
    // nối đòn: sau cú trúng cuối, bấm N/C thì ra đòn kế
    if (u > lastHit + 0.05 && this.buf && (this.buf.a === "n" || this.buf.a === "c")) {
      if (this.move[0] === "N" && this.move !== "N6") { this.chainGrace = 0.01; this.tryChain(); return; }
    }
    if (u >= 0.7 && this.buf?.a === "dodge") { this.state = "free"; this.startDodge(); return; }
    if (u >= 1) {
      this.state = "free";
      if (this.move[0] === "N" && this.move !== "N6") this.chainGrace = 0.28; else this.chain = 0;
      this.tryActions();
    }
  }

  tryChain() {
    const b = this.buf; this.buf = null;
    if (b.a === "n") { const k = this.chain + 1; this.chain = k; this.startMove(CHAIN_N[k - 1]); }
    else { const k = this.chain + 1; this.startMove(this.cKey(k)); }
  }

  // ---- trúng đòn ---------------------------------------------------------------------------
  applyHits(key, m, last) {
    const ctx = this.ctx, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const reach = m.shape === "line" ? m.range : m.range;
    let hitAny = false, heavy = m.mv >= 2 || key === "DQ";
    const isC = key[0] === "C" || key === "DC";
    const poiseMult = (m.poiseMult || (isC ? C_POISE_MULT : 1)) * (1 + this.mods.poisePct);
    const inShape = (tx, tz, rad) => {
      const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
      if (m.shape === "ring") return d <= reach + rad;
      if (m.shape === "cone") {
        if (d > reach + rad) return false;
        if (d < 0.8) return true;
        const cos = (dx * fx + dz * fz) / d;
        return cos >= Math.cos((m.arc / 2) * Math.PI / 180);
      }
      // line: đòn lao — dải từ 0,6 tầm sau lưng (quãng vừa lao qua) tới 0,4 tầm trước mặt
      const px = tx - (this.x - fx * reach * 0.6), pz = tz - (this.z - fz * reach * 0.6);
      const t = px * fx + pz * fz, perp = Math.abs(px * fz - pz * fx);
      return t >= -0.5 && t <= reach + rad && perp <= (m.width || 2) / 2 + rad;
    };
    const mv = m.mv;
    let nHit = 0, crit = false, kills = 0;
    // lính
    for (const a of [...ctx.crowd.agents]) {
      if (a.side !== "dich" || !ctx.crowd.hittable(a)) continue;
      if (!inShape(a.x, a.z, 0.4)) continue;
      const dx = a.x - this.x, dz = a.z - this.z, d = Math.hypot(dx, dz) || 1;
      const dmg = this.damageTo(a.giap, mv, m.crit, a);
      const stun = isC && this.mods.cStun && ctx.rng.chance(this.mods.cStun) ? 1.5 : 0;
      const died = ctx.crowd.damage(a, dmg, { by: "hero", swing: this.swingId, kx: dx / d, kz: dz / d, knock: m.knock || 2.2, launch: m.launch, stun, heavy });
      ctx.fx.impact(a.x - dx / d * 0.25, heightAt(a.x, a.z) + 1.15 * a.scale, a.z - dz / d * 0.25, dx / d, dz / d, { heavy, crit: this.lastCrit, kill: died, full: nHit < 5 });
      crit ||= this.lastCrit; if (died) kills++;
      hitAny = true; nHit++; this.onLanded();
    }
    // đơn vị lớn
    for (const u of ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      if (key === "DQ" && u !== this.moveTarget) continue;
      if (!inShape(u.x, u.z, u.radius)) continue;
      const dmg = this.damageTo(u.giap, mv, m.crit, u);
      const uc = this.lastCrit;
      const r = u.takeHeroHit(dmg, POISE_PER_MV * mv * poiseMult, { knock: m.knock, launch: m.launch, by: "hero", finisher: key === "DQ" });
      const ux = u.x - this.x, uz = u.z - this.z, ul = Math.hypot(ux, uz) || 1;
      ctx.fx.impact(u.x - ux / ul * u.radius * 0.6, u.y + 1.6 * u.rig.scale, u.z - uz / ul * u.radius * 0.6, ux / ul, uz / ul, { heavy: true, crit: uc || r.broke, kill: r.killed });
      if (r.broke && this.mods.breakKi) this.addKi(this.mods.breakKi);
      crit ||= uc || !!r.broke; if (r.killed) kills += 3;
      hitAny = true; nHit++; this.onLanded();
    }
    // cổng: Cong × MV / 3, bỏ qua giáp
    for (const id in ctx.world.gates) {
      const gt = ctx.world.gates[id];
      if (ctx.openGates[id] || !inShape(gt.x - 1.6, gt.z, 3.5)) continue;
      ctx.director.damageGate(id, this.effCong() * mv / GATE_DIV);
      ctx.fx.spark(gt.x - 1.8, heightAt(gt.x, gt.z) + 2, gt.z, true);
      hitAny = true;
    }
    if (hitAny) {
      // Hit-stop dài hơn bản cũ, cộng thêm theo số người trúng, chí mạng, người ngã — đòn trúng đông "khựng" rõ (IMPACT).
      const base = last && m.stopLast ? m.stopLast : m.stop, I = IMPACT;
      ctx.hitstop(Math.min(I.stopMax, base * I.stopMul + Math.min(I.stopCrowdCap, (nHit - 1) * I.stopPerExtra) + (crit ? I.stopCrit : 0) + (kills ? I.stopKill : 0)));
      ctx.audio.play(heavy ? "hitHeavy" : "hit", null, null, { gain: nHit > 2 ? 1.15 : 1 });
      if (crit) ctx.audio.play("crit");
      if (kills) ctx.audio.play("kill", this.x + fx * 2, this.z + fz * 2);
      // rung + giật camera theo hướng chém + thu FOV; đòn nặng chớp sáng cả màn
      const big = key === "DQ" || key === "CT";
      ctx.fx.shake(big ? I.shake.big : heavy ? I.shake.heavy : crit ? I.shake.crit : I.shake.light);
      ctx.fx.kick(fx, fz, big ? I.kick.big : heavy ? I.kick.heavy : I.kick.light);
      ctx.fx.punch(big ? I.fov.big : heavy ? I.fov.heavy : crit ? I.fov.crit : I.fov.light);
      if (big) ctx.fx.flash(0.55); else if (heavy && kills) ctx.fx.flash(0.28); else if (crit) ctx.fx.flash(0.16, "255,200,150");
      if (key === "DQ") { ctx.fx.banner("ĐÒN QUYẾT", "#f1d98a"); ctx.slowmo?.(0.45, 0.3); }
    }
    if (m.shape === "ring" && (heavy || key === "N6")) ctx.fx.shockwave(this.x, this.z, m.range);
    // bổ xuống đất: tung bụi ở chỗ lưỡi chạm đất
    if (last && (key === "C1" || key === "C4" || key === "C6" || key === "DQ")) {
      ctx.fx.dust(this.x + Math.sin(this.yaw) * 1.6, this.z + Math.cos(this.yaw) * 1.6, 1.1);
      if (key !== "C1") { ctx.audio.play("slam", this.x, this.z); ctx.fx.shake(0.3); }
    }
    ctx.fx.slashArc(this, key, m);
  }

  // big: đòn vào sĩ quan / Toa Đô — cờ Tuyệt Kỹ là cờ tập hợp quân (đợt 9): không cộng vào đòn của tướng lên đơn vị lớn
  effCong(big = false) {
    let c = this.stats.cong * (1 + this.buffs.atk + (big ? 0 : this.buffs.flag));
    if (this.inTPC) c *= 1 + HAO_KHI.tpc.heroAtk;
    return c;
  }

  // tgt: lính / đơn vị bị đánh — nhân thế đất cao thấp ở cuối (terrain-rules.js hitMult)
  damageTo(giap, mv, sureCrit, tgt = null) {
    const ctx = this.ctx;
    const g = giap * (1 - this.mods.armorPen);
    let d = this.effCong(!!tgt?.isBig) * mv * heSoGiap(g, this.stats.level);
    this.lastCrit = !!(sureCrit || ctx.rng.chance(this.stats.crit));
    if (this.lastCrit) d *= CRIT_MULT;      // Tổng Phản Công +20% đã nhân trong effCong (trước đợt 9 nhân thêm ×1,2 ở đây)
    return d * (0.95 + 0.1 * ctx.rng.next()) * (tgt ? hitMult(this, tgt) : 1);
  }

  onLanded() {
    this.addKi(0.35);          // kiPct nhân trong addKi (trước đợt 9 nhân hai lần: khắc "+10% Khí Lực" thành +21%)
    this.combo++; this.comboT = 2.2;
    // Liên hoàn (WC03): mỗi 10 đòn trúng liền mạch +4% tốc đánh 6 s, tối đa 3 tầng (ĐỀ XUẤT BẢN THỬ)
    if (this.combo % this.mods.comboEvery === 0) { this.lienHoan = Math.min(3, this.lienHoan + 1); this.lienHoanT = 6; }
  }

  addKi(v) { this.ki = Math.min(this.kiMax, this.ki + v * (1 + (this.mods.kiPct || 0))); }

  // ---- Né ------------------------------------------------------------------------------------
  startDodge() {
    this.buf = null;
    if (this.dodgeCd > 0) return false;
    this.state = "dodge"; this.st = 0; this.chain = 0;
    this.dodgeYaw = this.inputDir ?? this.yaw + Math.PI;
    this.yaw = this.inputDir ?? this.yaw;
    this.dodgeChain++;
    if (this.dodgeChain >= DEFENSE.dodgeChain) { this.dodgeCd = DEFENSE.dodgeDur + DEFENSE.dodgeRecover; this.dodgeChain = 0; }
    this.dodgeReset = 0.8;
    if (this.mods.afterimage) this.ctx.fx.afterimage(this.x, this.z, () => this.afterimageBurst(this._aiX, this._aiZ));
    this._aiX = this.x; this._aiZ = this.z;
    this.ctx.audio.play("dodge", this.x, this.z);
    this.ctx.director.onHeroAction?.("dodge");
    return true;
  }
  afterimageBurst(x, z) {
    for (const a of this.ctx.crowd.agents) {
      if (a.side !== "dich" || !this.ctx.crowd.hittable(a) || Math.hypot(a.x - x, a.z - z) > 3) continue;
      this.ctx.crowd.damage(a, this.damageTo(a.giap, 0.5, false, a), { by: "hero", swing: ++this.swingId, knock: 3 });
    }
  }
  updateDodge(dt) {
    this.st += dt; const u = this.st / DEFENSE.dodgeDur;
    const sp = DEFENSE.dodgeDist / DEFENSE.dodgeDur;
    this.x += Math.sin(this.dodgeYaw) * sp * dt; this.z += Math.cos(this.dodgeYaw) * sp * dt;
    this.setPose(A.dodgeRoll(Math.min(1, u)), 0.6);
    if (u >= 1) {
      this.state = "free"; this.postDodge = 0.35;
      if (this.buf && (this.buf.a === "n" || this.buf.a === "c")) this.buf.t = this.ctx.clock;   // phím bấm lúc lộn: làm mới hạn để ra Lướt chém
    }
  }

  // ---- Đỡ ------------------------------------------------------------------------------------
  updateBlock(dt, wx, wz, mag) {
    const walk = mag > 0.15 && this.blocking;
    if (!walk) this.setPose(A.BLOCK, 0.4);
    if (!this.blocking) { this.state = "free"; return; }
    if (this.buf && (this.buf.a === "dodge" || this.buf.a === "n" || this.buf.a === "c")) { this.state = "free"; this.tryActions(); return; }
    this.blockT += dt;
    if (walk) {
      // đi trong thế đỡ: bước ngắn, nhanh theo hướng đi so với mặt (A.guardStep), bàn chân trụ đứng yên trên đất.
      // Trộn tư thế nhanh (0,8) để nhịp ~4 bước/s không bị trễ pha làm lê chân; 0,2 s đầu trộn chậm cho khỏi giật.
      const vx = wx * 2, vz = wz * 2, sp = Math.hypot(vx, vz), cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      this.x += vx * dt; this.z += vz * dt;
      const g = A.stepGait(sp, this.rig.scale);
      this.runPhase += dt * g.rate;
      this.setPose(A.guardStep(A.BLOCK, this.runPhase, (vx * cy - vz * sy) / sp, (vx * sy + vz * cy) / sp, g.stride),
        this.blockT < 0.2 ? 0.4 : 0.8);
    }
    const t = this.lock?.alive ? this.lock : this.nearestEnemy(8);
    if (t) this.yaw = turn(this.yaw, Math.atan2(t.x - this.x, t.z - this.z), dt * 10);
  }

  // ---- nhận đòn -------------------------------------------------------------------------------
  receiveHit(h) {
    const ctx = this.ctx;
    if (!this.alive || this.invuln > 0 || this.state === "ult") return "immune";
    if (this.state === "dodge" && this.st < DEFENSE.dodgeIFrame) { ctx.fx.text(this.x, this.z, "Né", "#e6dcc3"); return "dodged"; }
    const angTo = Math.atan2(h.x - this.x, h.z - this.z);
    let da = angTo - this.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const front = Math.abs(da) <= (DEFENSE.blockArc / 2) * Math.PI / 180;
    if (h.red && this.parryAt > 0 && ctx.clock - this.parryAt <= this.parryWindow + 0.02) {
      this.parryAt = -9;
      ctx.fx.banner("PHẢN ĐÒN", "#f1d98a"); ctx.audio.play("parry", this.x, this.z); ctx.hitstop(120);
      this.yaw = angTo; this.state = "free"; this.startMove("CT", h.src);
      ctx.director.onHeroAction?.("parry");
      if (h.src?.tier === "tuong") ctx.director.onCounterBoss();
      return "parried";
    }
    if (this.state === "block" && front && !h.unblockable) {
      if (!h.red) {
        ctx.fx.spark(this.x + Math.sin(angTo), heightAt(this.x, this.z) + 1.3, this.z + Math.cos(angTo), false, 0xf1d98a);
        ctx.audio.play("block", this.x, this.z);
        this.x -= Math.sin(angTo) * 0.25; this.z -= Math.cos(angTo) * 0.25;
        ctx.director.onHeroAction?.("block");
        return "blocked";
      }
      h.dmg *= 0.6;   // đòn viền đỏ phá đỡ
    }
    this.hp -= h.dmg; this.addKi(2);
    ctx.fx.hurt(); ctx.audio.play(h.heavy ? "hurtHeavy" : "hurt");
    ctx.fx.blood(this.x, this.y + 1.2, this.z, -Math.sin(angTo), -Math.cos(angTo), h.heavy ? 0.8 : 0.4);
    if (h.heavy || h.red) { ctx.fx.shake(h.red ? 0.45 : 0.25); ctx.fx.kick(-Math.sin(angTo), -Math.cos(angTo), 0.3); ctx.hitstop(h.red ? 90 : 50); }
    ctx.director.onHeroHit(h);
    if (this.hp <= 0) { this.onZeroHp(); return "hit"; }
    const armored = (this.state === "attack" || this.state === "skill") && !h.heavy && !h.red;
    if (!armored) {
      if (h.red || h.knockdown) { this.state = "down"; this.st = 1.1; this.invuln = Math.max(this.invuln, 1.0); }
      else if (h.heavy || this.state !== "attack") { this.state = "hit"; this.st = 0.3; }
      this.chain = 0;
    }
    return "hit";
  }

  onZeroHp() {
    const ctx = this.ctx;
    if (this.revives > 0) {
      this.revives--; this.hp = this.maxHp * HERO.revive.hp; this.invuln = HERO.revive.invuln;
      this.state = "down"; this.st = 1.2;
      ctx.fx.banner("GƯỢNG DẬY", "#e6dcc3"); ctx.director.onRevive();
      return;
    }
    this.hp = 0; this.alive = false; this.state = "dead"; this.st = 0;
    ctx.director.onHeroDead();
  }

  // ---- Phá Trận: 3 lần lao 18 m trong 6 s, choáng lính 1 s ---------------------------------------
  startSkill() {
    this.buf = null;
    const P = this.phaTran;
    if (P.left <= 0) { if (P.cd > 0) return false; P.left = HERO.phaTran.dashes; P.window = HERO.phaTran.window; }
    P.left--;
    if (P.left <= 0) { P.window = 0; P.cd = HERO.phaTran.cd; }
    this.state = "skill"; this.st = 0; this.swingId++;
    const t = this.lock?.alive ? this.lock : null;
    this.yaw = t ? Math.atan2(t.x - this.x, t.z - this.z) : (this.inputDir ?? this.yaw);
    this.dashLen = this.mods.phaTranLen; this.dashHit = new Set();
    this.ctx.director.onHeroAction?.("skill");
    this.ctx.audio.play("dash"); this.ctx.fx.banner("PHÁ TRẬN", "#e6dcc3", 0.6); this.ctx.hud?.speedLines?.(0.5);
    return true;
  }
  updateSkill(dt) {
    const ctx = this.ctx, dur = 0.5;
    this.st += dt; const u = this.st / dur;
    this.setPose(A.dash(Math.min(1, u)), 0.6);
    const sp = this.dashLen / dur;
    this.x += Math.sin(this.yaw) * sp * dt; this.z += Math.cos(this.yaw) * sp * dt;
    let hit = false;
    for (const a of ctx.crowd.agents) {
      if (a.side !== "dich" || !ctx.crowd.hittable(a) || this.dashHit.has(a)) continue;
      if (Math.hypot(a.x - this.x, a.z - this.z) > 2.2) continue;
      this.dashHit.add(a);
      const kx = Math.cos(this.yaw), kz = -Math.sin(this.yaw), side = ((a.x - this.x) * kx + (a.z - this.z) * kz) >= 0 ? 1 : -1;
      const died = ctx.crowd.damage(a, this.damageTo(a.giap, HERO.phaTran.mv, false, a), { by: "hero", swing: this.swingId, kx: kx * side, kz: kz * side, knock: 4, stun: HERO.phaTran.stun });
      ctx.fx.impact(a.x, heightAt(a.x, a.z) + 1.15 * a.scale, a.z, kx * side, kz * side, { kill: died, full: this.dashHit.size < 6 });
      ctx.director.onHeroAction?.("skillHit", 1);
      hit = true; this.onLanded();
    }
    for (const un of ctx.units) {
      if (un.side !== "dich" || !un.alive || un.dead || un.retreating || this.dashHit.has(un)) continue;
      if (Math.hypot(un.x - this.x, un.z - this.z) > 2.2 + un.radius) continue;
      this.dashHit.add(un);
      un.takeHeroHit(this.damageTo(un.giap, HERO.phaTran.mv, false, un), POISE_PER_MV * HERO.phaTran.mv * C_POISE_MULT, { by: "hero" });
      hit = true;
    }
    if (hit) { ctx.hitstop(35); ctx.audio.play("hit"); ctx.fx.shake(0.12); ctx.fx.kick(Math.sin(this.yaw), Math.cos(this.yaw), 0.18); }
    ctx.fx.trail(this);
    if (u >= 1) { this.state = "free"; this.swingId++; }
  }

  // ---- Tuyệt Kỹ "Bóp Nát Quân Thù": 1 vạch, 10 s bất tử, 24 đòn tổng MV 20 -------------------------
  startUlt() {
    this.buf = null;
    if (this.ctx.crowd && (this.ki >= HERO.tuyetKy.cost || (this.inTPC && this.hkUltReady))) this.ctx.crowd.rout(this.x, this.z, AI.rout.ultR);
    const T = HERO.tuyetKy;
    const hkUlt = this.inTPC && this.hkUltReady;
    if (!hkUlt && this.ki < T.cost) return false;
    if (hkUlt) this.hkUltReady = false;
    else {
      this.ki -= T.cost;
      if (this.mods.ultRefund && this.ctx.rng.chance(this.mods.ultRefund)) { this.addKi(50); this.ctx.fx.text(this.x, this.z, "+50 Khí Lực", "#f1d98a"); }
    }
    this.state = "ult"; this.st = 0; this.ultHits = 0; this.invuln = T.invuln; this.ultId = (this.ultId || 0) + 1;
    this.ultHK = hkUlt;
    this.ultMv = hkUlt ? HAO_KHI.tpc.freeUlt.mv / T.hits : (T.mvTotal / T.hits) * (1 + this.mods.ultPct);
    this.ultR = hkUlt ? 3.5 * HAO_KHI.tpc.freeUlt.radius : 3.5;
    this.ctx.cinematic(hkUlt ? "TUYỆT KỸ HÀO KHÍ" : "BÓP NÁT QUÂN THÙ", this);
    this.ctx.audio.play("ult", this.x, this.z);
    this.ctx.director.onUlt(hkUlt); this.ctx.director.onHeroAction?.("ult"); this.ctx.hud?.speedLines?.(0.8);
    return true;
  }
  updateUlt(dt) {
    const ctx = this.ctx, T = HERO.tuyetKy, per = 4 / T.hits;
    this.st += dt;
    // một nhát chém dài 3 đòn (u chạy hết 0..1 qua 3 đòn), đổi tay mỗi chu kỳ 6 đòn (chém rồi xoay); nhát tay trái giữ
    // chân như tay phải cho nối liền với nhát xoay. Trước đây đổi tay theo từng đòn (k % 2): giữa nhát chém tư thế lật
    // trái ↔ phải, chân tay giật 70 lần trong 4,2 s. u tính từ cùng x với k (trước là st % (3·per): sai số dấu phẩy
    // động làm k sang nhát xoay mà u còn ≈ 1, giật một khung ở chỗ đổi chém ↔ xoay).
    const x = this.st / per, k = Math.floor(x), u = (x - 3 * Math.floor(k / 3)) / 3;
    this.setPose(k % 6 < 3 ? A.slash(u, Math.floor(k / 6) % 2 ? 1 : -1, 0.4, false) : A.spin(u, 1), 0.7);
    while (this.ultHits < Math.min(T.hits, k)) {
      this.ultHits++; this.swingId++;
      const tgt = this.nearestEnemy(this.ultR + 5);
      if (tgt) {
        const d = Math.hypot(tgt.x - this.x, tgt.z - this.z);
        this.yaw = Math.atan2(tgt.x - this.x, tgt.z - this.z);
        const step = this.ultHits % 5 === 0 ? 5 : Math.max(0, Math.min(1.2, d - 1.5));
        this.x += Math.sin(this.yaw) * step; this.z += Math.cos(this.yaw) * step;
      }
      for (const a of ctx.crowd.agents) {
        if (a.side !== "dich" || !ctx.crowd.hittable(a)) continue;
        const dx = a.x - this.x, dz = a.z - this.z, dd = Math.hypot(dx, dz);
        if (dd > this.ultR) continue;
        const died = ctx.crowd.damage(a, this.damageTo(a.giap, this.ultMv, false, a), { by: "hero", swing: this.swingId, kx: dx / (dd || 1), kz: dz / (dd || 1), knock: 3, launch: this.ultHits % 6 === 0 });
        if (Math.random() < 0.5) ctx.fx.impact(a.x, heightAt(a.x, a.z) + 1.15 * a.scale, a.z, dx / (dd || 1), dz / (dd || 1), { heavy: this.ultHits % 6 === 0, kill: died, full: Math.random() < 0.4 });
      }
      for (const un of ctx.units) {
        if (un.side !== "dich" || !un.alive || un.dead || un.retreating) continue;
        if (Math.hypot(un.x - this.x, un.z - this.z) > this.ultR + un.radius) continue;
        // sĩ quan / Toa Đô: × bigMult (sát thương và Phá Thế); Tuyệt Kỹ lấy tối đa bigCap × Sinh lực tối đa của mỗi đơn vị
        // trong bigCapWindow giây tính từ đòn Tuyệt Kỹ đầu tiên trúng nó (tính cả ×1,5 khi Vỡ Thế) — hai Tuyệt Kỹ thường liền
        // nhau (2 vạch Khí Lực) chung một trần; Tuyệt Kỹ Hào Khí có trần riêng bigCapHK. Hết trần thì đòn vẫn trúng (khựng,
        // Phá Thế) nhưng không trừ máu nữa — báo "trụ vững" một lần mỗi Tuyệt Kỹ trên đơn vị đó.
        const hp0 = un.hp, dmg = ultBigDamage(un, this.damageTo(un.giap, this.ultMv, false, un), ctx.clock, this.ultHK);
        un.takeHeroHit(dmg, POISE_PER_MV * this.ultMv * T.bigMult, { by: "hero" });
        ultBigNote(un, hp0 - un.hp, this.ultHK);
        if (dmg <= 0 && un.alive && un.ultCapSaid !== this.ultId) { un.ultCapSaid = this.ultId; ctx.fx.text(un.x, un.z, `${un.name || "Tướng địch"} trụ vững`, "#c9bfae"); }
      }
      ctx.fx.shockwave(this.x, this.z, this.ultR * 0.8); ctx.audio.play(this.ultHits % 6 === 0 ? "hitHeavy" : "hit");
      if (this.ultHits % 4 === 0) ctx.fx.shake(0.2);
      if (this.ultHits % 6 === 0) { ctx.fx.punch(3); ctx.fx.kick(Math.sin(this.yaw), Math.cos(this.yaw), 0.25); ctx.hitstop(45); }
    }
    if (this.st >= 4.2) {
      this.state = "free";
      // cắm cờ: quân ta trong 20 m Công +25% trong 15 s
      ctx.director.plantFlag(this.x, this.z, T.flagR, T.flagAtk, T.flagDur);
      if (!this.ultHK) ctx.director.ultQ(T.qCost);
    }
  }

  // ---- tiện ích -------------------------------------------------------------------------------
  nearestEnemy(maxD, crowdOnly = false) {
    let best = null, bd = maxD * maxD;
    for (const a of this.ctx.crowd.agents) {
      if (a.side !== "dich" || !this.ctx.crowd.hittable(a)) continue;
      const d2 = (a.x - this.x) ** 2 + (a.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = a; }
    }
    if (!crowdOnly) for (const u of this.ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      const d2 = (u.x - this.x) ** 2 + (u.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = u; }
    }
    return best;
  }
  autoTarget() {
    let best = null, bs = 1e9;
    const dir = this.inputDir ?? this.yaw;
    const consider = (t, bonus) => {
      const dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz);
      if (d > 6.5) return;
      let da = Math.atan2(dx, dz) - dir; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) > 1.2 && d > 2) return;
      const s = d + Math.abs(da) * 2 - bonus; if (s < bs) { bs = s; best = t; }
    };
    for (const a of this.ctx.crowd.agents) if (a.side === "dich" && this.ctx.crowd.hittable(a)) consider(a, 0);
    for (const u of this.ctx.units) if (u.side === "dich" && u.alive && !u.dead && !u.retreating) consider(u, 1.5);
    return best;
  }
  findBroken() {
    for (const u of this.ctx.units) if (u.side === "dich" && u.broken > 0 && u.alive && !u.dead && Math.hypot(u.x - this.x, u.z - this.z) < 4.5) return u;
    return null;
  }
  faceLock() { return Math.atan2(this.lock.x - this.x, this.lock.z - this.z); }
  toggleLock() {
    if (this.lock) { this.lock = null; return; }
    let best = null, bd = 30 * 30;
    for (const u of this.ctx.units) {
      if (u.side !== "dich" || !u.alive || u.dead || u.retreating) continue;
      const d2 = (u.x - this.x) ** 2 + (u.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = u; }
    }
    this.lock = best;
  }
  heal(frac) { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * frac); }

  setPose(p, k) { this.pose = A.blendPose(this.pose, p, Math.min(1, k)); A.applyPose(this.rig, this.pose); }
  // dt = bước mô phỏng vừa chạy (0 khi dựng lần đầu): chuyển động phụ chỉ chạy theo bước mô phỏng nên
  // hit-stop (0 bước) làm vải, dải khăn đứng yên cùng người.
  place(dt = 0) {
    this.y = heightAt(this.x, this.z);
    const r = this.rig.root; r.position.set(this.x, this.y, this.z); r.rotation.y = this.yaw;
    this.motion.update(dt, this.pose, heightAt);
    const vis = this.invuln > 0 && this.state !== "ult" ? (Math.floor(this.animT * 14) % 2 === 0) : true;
    r.visible = vis || !this.alive;
    // vệt lưỡi đao khi ra đòn, lao, Tuyệt Kỹ
    const swinging = this.state === "attack" || this.state === "skill" || this.state === "ult";
    if (swinging) {
      r.updateMatrixWorld(true);
      const P = this.rig.p;
      [[P.handR, P.shR], [P.handL, P.shL]].forEach(([hand, sh], i) => {
        _b.copy(BLADE_BASE); hand.localToWorld(_b); _t.copy(BLADE_TIP); hand.localToWorld(_t); sh.getWorldPosition(_s);
        this.trails[i].push(_b, _t, _s);
      });
    } else for (const tr of this.trails) tr.cut();
  }
}
