// battle/guard.js — cận vệ của người lính trong trận Tự do (đợt 15c): đơn vị lớn phe ta (lớp con của BigUnit — rig, chân bám đất, đi lại,
// chạm tường dùng lại units.js), có tên trên đầu, theo lệnh của vòng Mệnh Lệnh (director-td.js order), chiêu riêng theo lớp, gục khi hết
// Sinh lực (đỡ dậy được, không chết hẳn). Số, lớp, luật thuần ở data/guards.js.
//
// Lệnh: Theo ta (mặc định) — đứng chỗ của mình trong đội hình sau lưng người lính, chỉ đánh địch trong 8 m quanh người lính (đuổi tối đa 10 m
// khỏi chỗ đứng); Xung trận — đánh địch trong 15 m quanh người lính, ưu tiên mục tiêu đang khóa, tự tung chiêu khi có dịp (data/guards.js
// wantsSkill); Giữ chỗ — giữ điểm lúc nhận lệnh, đánh ai tới trong 5 m. Xa người lính quá GUARD_ORDER.leash m thì bỏ đánh, chạy về; kẹt xa
// quá warp.d m trong warp.sec giây thì dịch về sau lưng người lính (kẹt sau tường, bờ nước).
// Bị đánh: lính địch đánh cận vệ như đánh tướng đồng minh (crowd.js strike — × GUARD_HIT.melee thay vì × 0,2; tên × GUARD_HIT.arrow); sĩ
// quan địch vẫn nhắm người lính. Đòn của cận vệ lên sĩ quan đi qua takeHeroHit (trừ Phá Thế như đòn của người chơi, director nhận lời báo hạ).

import * as THREE from "three";
import { BigUnit } from "./units.js";
import { RIGS, PAL } from "./models.js";
import * as A from "./anim.js";
import { heightAt, collide } from "./world.js";
import { turn } from "./crowd.js";
import { heSoGiap, hitPad } from "../data/tuning.js";
import { GUARD_CLASSES, GUARD_ORDER, GUARD_HIT, formationSlot, wantsSkill } from "../data/guards.js";

const POISE_PER_MV = 14;              // Phá Thế mỗi MV của đòn cận vệ (bằng Song đao của người lính, weapon-classes.js WC03)

// ---- dáng cận vệ theo lớp (đăng ký vào RIGS như battle/soldier.js) ----------------------------------------------------------------
export function guardRigKey(clsId) {
  const C = GUARD_CLASSES[clsId] || GUARD_CLASSES.khien, key = `cv_${C.id}`;
  if (!RIGS[key]) RIGS[key] = { scale: 1.04, cloth: 0x7a2418, armor: 0x4a3a2a, trim: PAL.vang, hat: C.hat, weapon: C.weapon, shield: !!C.shield, skirt: 0x5a2014 };
  return key;
}

// Tên trên đầu: chữ vàng viền đen, dòng nhỏ là lớp; gục thì chữ đỏ "gục". Vẽ lại chỉ khi đổi trạng thái.
function labelTexture(name, sub, down) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 72;
  const x = c.getContext("2d");
  x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
  x.font = "bold 30px sans-serif"; x.lineWidth = 6; x.strokeStyle = "rgba(20,14,10,.9)"; x.fillStyle = down ? "#ff8a6a" : "#f1d98a";
  x.strokeText(name, 128, 24, 248); x.fillText(name, 128, 24, 248);
  x.font = "bold 20px sans-serif"; x.lineWidth = 5; x.fillStyle = down ? "#ffb09a" : "#e6dcc3";
  x.strokeText(sub, 128, 56, 248); x.fillText(sub, 128, 56, 248);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Guard extends BigUnit {
  // g: cận vệ trong lưu ({ id, name, cls }); st: data/guards.js guardStats; idx: thứ tự trong đội (chỗ đứng đội hình)
  constructor(ctx, g, st, idx, x, z, yaw) {
    const C = GUARD_CLASSES[g.cls] || GUARD_CLASSES.khien;
    super(ctx, { kind: "guard", side: "ta", tier: "ally", rigKey: guardRigKey(C.id), name: g.name, id: "CV" + g.id, hp: 1, x, z, yaw, awake: true });
    this.isGuard = true; this.gid = g.id; this.idx = idx; this.C = C; this.cls = C.id;
    this.maxHp = st.hp; this.hp = st.hp; this.cong = st.cong; this.giap = st.giap; this.speed = st.move;
    this.meleeMult = GUARD_HIT.melee; this.arrowMult = GUARD_HIT.arrow * heSoGiap(st.giap, ctx.R);     // crowd.js đọc khi lính địch đánh / bắn trúng
    this.order = GUARD_ORDER.start; this.hold = null;
    this.down = false; this.downT = 0; this.rev = { p: 0, used: false };
    this.skillCd = C.skill.cd * 0.35; this.sk = null; this.ko = 0;
    this.foe = null; this.retT = 0; this.atkCd = 0.4 + idx * 0.2; this.evalT = idx * 0.1; this.farT = 0; this.guardT = 0;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    this.label.scale.set(2.3, 0.65, 1); this.label.renderOrder = 5; ctx.scene.add(this.label);
    this.labelKey = ""; this.setLabel();
  }
  get radius() { return 0.6 * this.rig.scale; }
  setLabel() {
    const key = this.down ? (this.rev.used ? "x" : "d") : "u";
    if (key === this.labelKey) return;
    this.labelKey = key;
    this.label.material.map?.dispose();
    this.label.material.map = labelTexture(this.name, this.down ? (this.rev.used ? "gục · hết trận mới lành" : "gục · đứng cạnh để đỡ dậy") : this.C.name, this.down);
    this.label.material.needsUpdate = true;
  }
  dispose() {
    super.dispose();
    if (this.label) { this.ctx.scene.remove(this.label); this.label.material.map?.dispose(); this.label.material.dispose(); this.label = null; }
  }
  place(dt = 0) {
    super.place(dt);
    if (this.label) this.label.position.set(this.x, this.y + (this.down ? 1.4 : 2.75) * this.rig.scale, this.z);
  }

  // ---- bị đánh, gục, đỡ dậy -------------------------------------------------------------------------------------------------------
  receiveHit({ dmg }) {
    if (!this.alive || this.down || this.side !== "ta") return;
    const ctx = this.ctx;
    let d = dmg * (ctx.diff?.dmg ?? 1);
    if (this.guardT > ctx.clock) d *= this.C.skill.taken ?? 1;           // Hộ chủ: nhận ít đi
    this.hp -= d; this.flash = 0.1;
    if (this.hp <= 0) this.fall();
  }
  fall() {
    const ctx = this.ctx;
    this.hp = 0; this.down = true; this.downT = 0; this.sk = null; this.state = "idle"; this.foe = null; this.guardT = 0;
    this.rev.p = 0; this.setLabel();
    ctx.audio.play("hurt", this.x, this.z);
    ctx.director?.onGuardDown?.(this);
  }
  standUp(frac) {
    this.down = false; this.hp = Math.max(1, this.maxHp * frac); this.downT = 0; this.atkCd = 0.6; this.setLabel();
    this.ctx.fx.ring(this.x, this.z, 1.6, 0xdff0c8, 0.6);
  }

  // ---- mỗi bước ----------------------------------------------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx;
    this.animT += dt; this.flash = Math.max(0, this.flash - dt);
    if (!this.alive) return;
    if (this.down) { this.downT += dt; this.setPose(A.knockdown(this.downT), 0.3); this.place(dt); return; }
    this.skillCd = Math.max(0, this.skillCd - dt);
    if (this.sk) { this.updateSkill(dt); this.place(dt); return; }
    this.think(dt);
    this.place(dt);
  }

  // khu được phép đánh theo lệnh: { x, z, r } (tâm, bán kính)
  area() {
    const h = this.ctx.hero, O = GUARD_ORDER;
    if (this.order === "giucho" && this.hold) return { x: this.hold.x, z: this.hold.z, r: O.giucho.r };
    if (this.order === "xungtran") return { x: h.x, z: h.z, r: O.xungtran.r };
    return { x: h.x, z: h.z, r: O.theota.r };
  }
  // chỗ đứng khi không đánh ai
  restPoint() {
    const h = this.ctx.hero;
    if (this.order === "giucho" && this.hold) return this.hold;
    const s = formationSlot(this.idx, h.yaw);
    return { x: h.x + s.x, z: h.z + s.z };
  }
  validTarget(t) {
    if (!t) return false;
    if (t.isBig) return t.side === "dich" && t.alive && !t.dead && !t.retreating && !t.captured;
    return t.side === "dich" && this.ctx.crowd.hittable(t);
  }
  // sĩ quan địch cận vệ được đánh (kể cả chiêu diện rộng): đã thức, hoặc người lính đang khóa — không lặng lẽ đánh thức sĩ quan đang ngủ
  foeUnit(u) { return u.side === "dich" && this.validTarget(u) && (u.awake || u === this.ctx.hero.lock); }
  // chọn đối thủ trong khu: gần trước; ưu tiên kẻ đang đánh người lính, mục tiêu người lính khóa; tránh dồn cả đội vào một người
  pickFoe() {
    const ctx = this.ctx, h = ctx.hero, ar = this.area(), r2 = ar.r * ar.r;
    const guards = ctx.director?.guards || [];
    let best = null, bs = Infinity;
    const consider = (t, big) => {
      const da2 = (t.x - ar.x) ** 2 + (t.z - ar.z) ** 2;
      if (da2 > (ar.r + (big ? t.radius : 0)) ** 2) return;
      if (this.order === "theota" && Math.hypot(t.x - this.x, t.z - this.z) > GUARD_ORDER.theota.chase + ar.r) return;
      let eng = 0; for (const o of guards) if (o !== this && o.foe === t && !o.down) eng++;
      let s = Math.hypot(t.x - this.x, t.z - this.z) + eng * 2.5;
      if (t === h.lock) s -= 6;
      if (!big && (t.token || (t.windup > 0 && t.target === h))) s -= 3;
      if (t === this.foe) s -= 1.5;
      if (s < bs) { bs = s; best = t; }
    };
    if (r2 > 0) {
      for (const a of ctx.crowd.agents) if (a.side === "dich" && ctx.crowd.hittable(a)) consider(a, false);
      for (const u of ctx.units) if (this.foeUnit(u)) consider(u, true);
    }
    return best;
  }

  think(dt) {
    const ctx = this.ctx, h = ctx.hero, O = GUARD_ORDER, C = this.C;
    this.atkCd -= dt; this.retT -= dt; this.evalT -= dt;
    // đang vung đòn thường
    if (this.state === "atk") { this.updateSwing(dt); return; }
    // xa người lính quá: bỏ đánh, chạy về. Giữ chỗ thì giữ điểm của mình dù người lính đi xa; chỉ dịch về điểm giữ khi kẹt quá xa chính điểm đó
    const dh = Math.hypot(h.x - this.x, h.z - this.z), anchor = this.order === "giucho" && this.hold ? this.hold : h;
    this.farT = Math.hypot(anchor.x - this.x, anchor.z - this.z) > O.warp.d ? this.farT + dt : 0;
    if (this.farT > O.warp.sec) { this.warpHome(); return; }
    const leashed = this.order !== "giucho" && dh > O.leash;
    if (leashed) this.foe = null;
    else if (this.retT <= 0 || !this.validTarget(this.foe)) { this.retT = 0.5 + ctx.rng.next() * 0.4; this.foe = this.pickFoe(); }
    // tự tung chiêu (chỉ ở Xung trận, data/guards.js wantsSkill), xét mỗi 0,4 s
    if (this.evalT <= 0) {
      this.evalT = 0.4;
      if (this.skillCd <= 0 && this.order === "xungtran" && wantsSkill(this.cls, this.senses())) this.startSkill(false);
      if (this.sk) return;
    }
    const f = this.foe;
    if (f && !leashed) {
      const dx = f.x - this.x, dz = f.z - this.z, d = Math.hypot(dx, dz), fr = f.isBig ? f.radius : 0;
      const want = C.ranged ? C.range * 0.85 : C.reach * 0.85 + fr;
      this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 7);
      if (d > want) { this.moveToward(f.x, f.z, dt, 1); this.separate(dt); return; }
      if (C.ranged && d < 3.5) { const k = 0.6; this.moveToward(this.x - dx / (d || 1) * 3, this.z - dz / (d || 1) * 3, dt, k); this.yaw = turn(this.yaw, Math.atan2(dx, dz), dt * 9); return; }   // cung bị áp sát: lùi
      if (this.atkCd <= 0) { this.state = "atk"; this.st = 0; this.hitDone = false; this.atkTarget = f; this.swingN = (this.swingN || 0) + 1; return; }
      this.setPose(A.idle(this.animT), 0.15); this.separate(dt); return;
    }
    // không có ai để đánh: về chỗ đứng
    const p = this.restPoint(), pd = Math.hypot(p.x - this.x, p.z - this.z);
    if (pd > 0.8) { this.moveToward(p.x, p.z, dt, leashed ? 1.2 : pd > 6 ? 1.1 : Math.min(1, 0.35 + pd * 0.25)); this.separate(dt); return; }
    this.yaw = turn(this.yaw, this.order === "giucho" ? this.yaw : h.yaw, dt * 3);
    this.setPose(A.idle(this.animT), 0.1); this.separate(dt);
  }
  // không đứng chồng lên người lính, lên nhau
  separate(dt) {
    const ctx = this.ctx, h = ctx.hero;
    let sx = 0, sz = 0;
    const push = (o, R, k) => { const ox = this.x - o.x, oz = this.z - o.z, d = Math.hypot(ox, oz); if (d < R && d > 1e-4) { sx += ox / d * (R - d) * k; sz += oz / d * (R - d) * k; } };
    if (h.alive) push(h, 1.2, 3);
    for (const o of ctx.director?.guards || []) if (o !== this && !o.down && o.alive) push(o, 1.1, 2);
    if (sx || sz) { this.x += sx * dt * 4; this.z += sz * dt * 4; [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.6, ctx.openGates, this); }
  }
  warpHome() {
    const ctx = this.ctx, h = ctx.hero, s = formationSlot(this.idx, h.yaw);
    if (this.order === "giucho" && this.hold) { this.x = this.hold.x; this.z = this.hold.z; }
    else { this.x = h.x + s.x * 1.4; this.z = h.z + s.z * 1.4; }
    this.farT = 0; this.foe = null;
    [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.6, ctx.openGates, this);
    ctx.fx.dust(this.x, this.z, 0.8);
  }

  // ---- đòn thường ---------------------------------------------------------------------------------------------------------------------
  swingPose(u) {
    const C = this.C, n = this.swingN || 0;
    if (C.ranged) return A.shoot(u);
    if (C.id === "songdao") return n % 2 ? A.doubleChop(u) : A.scissor(u);
    if (C.id === "daidao") return n % 2 ? A.sweep(u) : A.heavyChop(u, 0.45, true);
    if (C.id === "giao") return A.slash(u, n % 2 ? 1 : -1, 0);
    return A.slash(u, n % 2 ? 1 : -1, 0.3);
  }
  updateSwing(dt) {
    const ctx = this.ctx, C = this.C, f = this.atkTarget;
    this.st += dt; const u = this.st / C.swing;
    this.setPose(this.swingPose(Math.min(1, u)), 0.5);
    if (this.validTarget(f)) this.yaw = turn(this.yaw, Math.atan2(f.x - this.x, f.z - this.z), dt * 8);
    if (!this.hitDone && u >= 0.55) {
      this.hitDone = true;
      if (this.validTarget(f)) {
        const d = Math.hypot(f.x - this.x, f.z - this.z), fr = f.isBig ? f.radius : 0;
        if (C.ranged) { if (d <= C.range + 2) this.shoot(f, C.mv); }
        else if (d <= C.reach + 0.6 + fr) { this.strike(f, C.mv, { knock: C.id === "daidao" ? 3.5 : 2.2 }); ctx.audio.play(C.id === "daidao" ? "swingHeavy" : "swingSoft", this.x, this.z); }
      }
    }
    if (u >= 1) { this.state = "idle"; this.atkCd = Math.max(0, C.every - C.swing) * (0.85 + 0.3 * ctx.rng.next()); }
  }
  // một đòn của cận vệ lên một địch (lính hoặc sĩ quan). mv × Công, trừ theo giáp như mọi đòn.
  strike(t, mv, { knock = 2.2, launch = false, poiseMult = 1 } = {}) {
    const ctx = this.ctx, dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz) || 1;
    mv *= this.flagMult();
    if (t.isBig) {
      const r = t.takeHeroHit(this.cong * mv * heSoGiap(t.giap, ctx.R), POISE_PER_MV * mv * poiseMult, { by: "guard", guard: this, knock: knock >= 5, launch: false });
      if (r?.killed) this.ko++;
      ctx.fx.impact(t.x - dx / d * t.radius * 0.6, t.y + 1.5 * t.rig.scale, t.z - dz / d * t.radius * 0.6, dx / d, dz / d, { heavy: mv >= 2, full: false });
      return;
    }
    const died = ctx.crowd.damage(t, this.cong * mv * heSoGiap(t.giap, ctx.R), { by: "ally", guard: this, kx: dx / d, kz: dz / d, knock, launch });
    if (died) this.ko++;
  }
  // cờ của director (Hô quân, Tổng Phản Công — director-td addFlag): đứng trong bán kính cờ thì Công +atk, như crowd.flagMult của lính ta
  flagMult() {
    const fl = this.ctx.director?.flags;
    if (!fl?.length) return 1;
    for (const f of fl) if (Math.hypot(this.x - f.x, this.z - f.z) < f.r) return 1 + f.atk;
    return 1;
  }
  // tên của cung thủ: bay thật (vệt trong crowd.arrows, không tự trúng ai), trúng khi tới nơi nếu đích còn đó
  shoot(t, mv) {
    const ctx = this.ctx, T = this.arrowFx(t.x, t.z, t.isBig ? t.y + 1.6 : heightAt(t.x, t.z) + 1.2);
    ctx.audio.play("bow", this.x, this.z);
    (this.pending ||= []).push({ at: ctx.clock + T, fn: () => { if (this.validTarget(t) && Math.hypot(t.x - this.x, t.z - this.z) <= this.C.range + 6) this.strike(t, mv, { knock: 1.2 }); } });
  }
  arrowFx(tx, tz, ty) {
    const crowd = this.ctx.crowd, g0 = heightAt(this.x, this.z), y0 = g0 + 1.5 * this.rig.scale;
    const d = Math.hypot(tx - this.x, tz - this.z), T = Math.max(0.35, d / 26);
    if (crowd.arrows.length < 190) crowd.arrows.push({ x: this.x, y: y0, z: this.z, vx: (tx - this.x) / T, vz: (tz - this.z) / T, vy: (ty - y0) / T + 4.9 * T,
      t: 0, T: T + 0.4, T0: T, src: null, side: "fx", tgt: null, g0, duel: false, heroMult: 0 });
    return T;
  }
  // việc hẹn giờ (tên đang bay, loạt tên) — director-td gọi mỗi bước kể cả khi cận vệ đang gục (tên đã bắn vẫn tới)
  tickPending() {
    const P = this.pending; if (!P?.length) return;
    const now = this.ctx.clock;
    for (let i = P.length - 1; i >= 0; i--) if (now >= P[i].at) { const f = P[i].fn; P.splice(i, 1); f(); }
  }

  // ---- chiêu riêng ---------------------------------------------------------------------------------------------------------------------
  // Nhìn quanh để quyết có tung chiêu không (data/guards.js wantsSkill).
  senses() {
    const ctx = this.ctx, h = ctx.hero, S = this.C.skill;
    let foesNearHero = 0, foesNear = 0, foesInLine = 0, cluster = 0, officerD = Infinity;
    const list = [];
    for (const a of ctx.crowd.agents) {
      if (a.side !== "dich" || !ctx.crowd.hittable(a)) continue;
      if ((a.x - h.x) ** 2 + (a.z - h.z) ** 2 < 36) foesNearHero++;
      const d2 = (a.x - this.x) ** 2 + (a.z - this.z) ** 2;
      if (d2 < 3.5 * 3.5) foesNear++;
      if (d2 < 22 * 22) list.push(a);
    }
    for (const u of ctx.units) if (this.foeUnit(u)) officerD = Math.min(officerD, Math.hypot(u.x - this.x, u.z - this.z) - u.radius);
    if (this.cls === "giao" && this.validTarget(this.foe)) foesInLine = this.lineHits(this.foe, S.len, S.width).length;
    if (this.cls === "cung") cluster = this.bestCluster(list, S.r).n;
    return { order: this.order, foesNearHero, foesNear, foesInLine, cluster, officerD, heroHp: h.alive ? h.hp / h.maxHp : 1 };
  }
  lineHits(t, len, width) {
    const ctx = this.ctx, dx = t.x - this.x, dz = t.z - this.z, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d, out = [];
    for (const a of ctx.crowd.agents) {
      if (a.side !== "dich" || !ctx.crowd.hittable(a)) continue;
      const px = a.x - this.x, pz = a.z - this.z, along = px * fx + pz * fz, perp = Math.abs(px * fz - pz * fx);
      if (along > 0 && along <= len && perp <= width / 2 + hitPad(a)) out.push(a);
    }
    return out;
  }
  bestCluster(list, r) {
    let best = { n: 0, x: 0, z: 0 };
    for (const a of list) {
      let n = 0; for (const b of list) if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r) n++;
      if (n > best.n) best = { n, x: a.x, z: a.z };
    }
    return best;
  }
  // force: người chơi bấm Tung chiêu. Trả true nếu tung được.
  startSkill(force) {
    const ctx = this.ctx, h = ctx.hero, S = this.C.skill;
    if (this.down || this.sk || this.skillCd > 0) return false;
    // đích: tự tung (force false) thì đúng đích đã làm bật chiêu (data/guards.js wantsSkill — giáo: đường tới đối thủ đang đánh; đại đao: địch
    // sát người; cung: cụm / sĩ quan trong tầm); bấm Tung chiêu thì ưu tiên mục tiêu người lính khóa. Mọi đích đều trong tầm chiêu.
    const R = this.cls === "cung" ? S.range : 12, inR = (t) => (t && this.validTarget(t) && Math.hypot(t.x - this.x, t.z - this.z) <= R + (t.isBig ? t.radius : 0) ? t : null);
    const lockOk = inR(h.lock), foeOk = inR(this.foe);
    let tgt;
    if (!force && this.cls === "giao") tgt = foeOk;
    else if (!force && this.cls === "daidao") tgt = this.nearestFoe(4.5);
    else tgt = (force ? lockOk || foeOk : foeOk || lockOk) || this.nearestFoe(R);
    const sk = { id: S.id, t: 0, done: false, tgt };
    if (this.cls === "khien") { sk.phase = "run"; }
    else if (!tgt) { if (force) ctx.fx.text(this.x, this.z, `${this.name}: không có địch trong tầm`, "#c9bfae"); return false; }
    if (this.cls === "cung") {
      const near = []; for (const a of ctx.crowd.agents) if (a.side === "dich" && ctx.crowd.hittable(a) && (a.x - this.x) ** 2 + (a.z - this.z) ** 2 < S.range * S.range) near.push(a);
      const c = tgt.isBig ? { x: tgt.x, z: tgt.z } : this.bestCluster(near, S.r);
      sk.cx = c.n ? c.x : tgt.x; sk.cz = c.n ? c.z : tgt.z; sk.k = 0;
    }
    if (this.cls === "giao") { const d = Math.hypot(tgt.x - this.x, tgt.z - this.z) || 1; sk.fx = (tgt.x - this.x) / d; sk.fz = (tgt.z - this.z) / d; sk.hit = new Set(); this.yaw = Math.atan2(sk.fx, sk.fz); }
    if (this.cls === "songdao") sk.k = 0;
    this.sk = sk; this.state = "skill"; this.skillCd = S.cd;
    ctx.fx.text(this.x, this.z, S.name, "#ffd27a");
    ctx.audio.play(this.cls === "khien" ? "roar" : this.cls === "cung" ? "volley" : "kiai", this.x, this.z);
    ctx.director?.onGuardSkill?.(this);
    return true;
  }
  nearestFoe(r) {
    const ctx = this.ctx; let best = null, bd = r * r;
    for (const a of ctx.crowd.agents) { if (a.side !== "dich" || !ctx.crowd.hittable(a)) continue; const d2 = (a.x - this.x) ** 2 + (a.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = a; } }
    for (const u of ctx.units) { if (!this.foeUnit(u)) continue; const d2 = (u.x - this.x) ** 2 + (u.z - this.z) ** 2; if (d2 < bd) { bd = d2; best = u; } }
    return best;
  }
  endSkill() { this.sk = null; this.state = "idle"; this.atkCd = 0.3; }
  updateSkill(dt) {
    const ctx = this.ctx, h = ctx.hero, S = this.C.skill, sk = this.sk;
    sk.t += dt;
    switch (sk.id) {
      case "hoChu": {                      // chạy tới cạnh người lính (≤ 1,2 s), gầm, kéo lính địch quanh mình
        if (sk.phase === "run") {
          const d = Math.hypot(h.x - this.x, h.z - this.z);
          if (d > 2.2 && sk.t < 1.2) { this.moveToward(h.x, h.z, dt, 1.35); return; }
          sk.phase = "roar"; sk.t = 0;
          this.guardT = ctx.clock + S.dur;
          let n = 0;
          for (const a of ctx.crowd.agents) {
            if (a.side !== "dich" || !ctx.crowd.hittable(a) || (a.x - this.x) ** 2 + (a.z - this.z) ** 2 > S.r * S.r) continue;
            a.tauntBy = this; a.tauntT = ctx.clock + S.dur; a.foe = this; a.token = false; a.retT = S.dur; n++;
          }
          ctx.fx.ring(this.x, this.z, S.r, 0xf1d98a, 0.7); ctx.fx.shake?.(0.15);
          if (n) ctx.fx.text(this.x, this.z, `kéo ${n} địch`, "#f1d98a");
        }
        this.setPose(A.roar(Math.min(1, sk.t / 0.6)), 0.4);
        if (sk.t >= 0.6) this.endSkill();
        return;
      }
      case "damXuyen": {                   // lấy đà 0,25 s, lao len m trong dur s, trúng mọi địch trên đường một lần
        const wind = 0.25;
        if (sk.t < wind) { this.setPose(A.heavyChop(sk.t / wind * 0.45, 0.9, true), 0.5); return; }
        const u = (sk.t - wind) / S.dur;
        if (u <= 1) {
          const sp = S.len / S.dur, ox = this.x, oz = this.z;
          this.x += sk.fx * sp * dt; this.z += sk.fz * sp * dt;
          [this.x, this.z] = collide(ctx.world, this.x, this.z, 0.6, ctx.openGates, this);
          if (Math.hypot(this.x - ox, this.z - oz) < sp * dt * 0.3) sk.t = wind + S.dur;      // vướng tường: dừng lao
          this.setPose(A.dash(0.2 + u * 0.5), 0.7);
          for (const a of ctx.crowd.agents) {
            if (a.side !== "dich" || !ctx.crowd.hittable(a) || sk.hit.has(a)) continue;
            if (Math.hypot(a.x - this.x, a.z - this.z) > S.width / 2 + hitPad(a) + 0.4) continue;
            sk.hit.add(a); this.strike(a, S.mv, { knock: S.knock, launch: a.tier === "thuong" });
          }
          for (const t of ctx.units) {
            if (!this.foeUnit(t) || sk.hit.has(t)) continue;
            if (Math.hypot(t.x - this.x, t.z - this.z) > S.width / 2 + t.radius) continue;
            sk.hit.add(t); this.strike(t, S.mv, { knock: S.knock });
          }
          return;
        }
        this.setPose(A.idle(this.animT), 0.3);
        if (sk.t >= wind + S.dur + 0.25) this.endSkill();
        return;
      }
      case "muaTen": {                     // volleys loạt, cách nhau gap s, mỗi loạt 6 mũi xuống vòng r quanh (cx, cz)
        this.yaw = turn(this.yaw, Math.atan2(sk.cx - this.x, sk.cz - this.z), dt * 8);
        const k = Math.floor(sk.t / S.gap);
        if (k > sk.k - 1 && sk.k < S.volleys) {
          sk.k++;
          let T = 0.5;
          for (let i = 0; i < 6; i++) { const a = ctx.rng.next() * Math.PI * 2, r = Math.sqrt(ctx.rng.next()) * S.r; T = this.arrowFx(sk.cx + Math.cos(a) * r, sk.cz + Math.sin(a) * r, heightAt(sk.cx, sk.cz)); }
          ctx.audio.play("volley", this.x, this.z);
          const cx = sk.cx, cz = sk.cz;
          (this.pending ||= []).push({ at: ctx.clock + T, fn: () => {
            for (const a of [...ctx.crowd.agents]) if (a.side === "dich" && ctx.crowd.hittable(a) && Math.hypot(a.x - cx, a.z - cz) <= S.r + hitPad(a)) this.strike(a, S.mv, { knock: 1.2 });
            for (const t of ctx.units) if (this.foeUnit(t) && Math.hypot(t.x - cx, t.z - cz) <= S.r + t.radius) this.strike(t, S.mv * 0.5, { knock: 1 });
          } });
        }
        this.setPose(A.shoot(Math.min(1, (sk.t % S.gap) / S.gap)), 0.5);
        if (sk.t >= S.gap * S.volleys) this.endSkill();
        return;
      }
      case "locDao": {                     // xoay dur s, ticks nhát chém vòng r
        const u = sk.t / S.dur;
        this.setPose(A.spin(Math.min(1, u), 2), 0.6);
        while (sk.k < S.ticks && u >= (sk.k + 0.5) / S.ticks) {
          sk.k++;
          for (const a of [...ctx.crowd.agents]) if (a.side === "dich" && ctx.crowd.hittable(a) && Math.hypot(a.x - this.x, a.z - this.z) <= S.r + hitPad(a)) this.strike(a, S.mv, { knock: 2.5 });
          for (const t of ctx.units) if (this.foeUnit(t) && Math.hypot(t.x - this.x, t.z - this.z) <= S.r + t.radius) this.strike(t, S.mv, { knock: 2 });
          ctx.audio.play("swingSoft", this.x, this.z);
        }
        if (u >= 1) this.endSkill();
        return;
      }
      case "phaThe": {                     // giơ đao windup s rồi bổ: mục tiêu × mv (Phá Thế × poiseMult), lính quanh r m bị hất ngã
        const t = sk.tgt, tot = S.windup + 0.4;
        if (this.validTarget(t)) {
          const d = Math.hypot(t.x - this.x, t.z - this.z), fr = t.isBig ? t.radius : 0;
          this.yaw = turn(this.yaw, Math.atan2(t.x - this.x, t.z - this.z), dt * 8);
          if (!sk.done && sk.t < S.windup && d > this.C.reach + fr) {
            sk.chase = (sk.chase || 0) + dt;
            if (sk.chase > 2) { this.endSkill(); this.skillCd = S.cd * 0.5; return; }        // đuổi 2 s không tới: thôi, hồi nửa chiêu
            this.moveToward(t.x, t.z, dt, 1.2); sk.t = Math.min(sk.t, S.windup * 0.4); return;
          }
        }
        this.setPose(A.heavyChop(Math.min(1, sk.t / tot), S.windup / tot, true), 0.6);
        if (!sk.done && sk.t >= S.windup) {
          sk.done = true;
          const px = this.x + Math.sin(this.yaw) * 1.6, pz = this.z + Math.cos(this.yaw) * 1.6;
          if (this.validTarget(t) && Math.hypot(t.x - this.x, t.z - this.z) <= this.C.reach + 1 + (t.isBig ? t.radius : 0)) this.strike(t, S.mv, { knock: 5, poiseMult: S.poiseMult });
          for (const a of [...ctx.crowd.agents]) if (a !== t && a.side === "dich" && ctx.crowd.hittable(a) && Math.hypot(a.x - px, a.z - pz) <= S.r + hitPad(a)) this.strike(a, S.mv * 0.5, { knock: 4, launch: a.tier === "thuong" });
          ctx.fx.shockwave(px, pz, S.r); ctx.fx.dust(px, pz, 1.2); ctx.audio.play("slam", px, pz);
        }
        if (sk.t >= tot) this.endSkill();
        return;
      }
      default: this.endSkill();
    }
  }
}
