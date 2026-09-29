// battle/crowd.js — lính thường: lính diễn (actor) và lính vùng chiến đấu (zone …).
//
// Hai tầng tác tử gần (mục 15.2):
//   - actor: lính diễn đứng theo đội hình ở tuyến mặt trận, chỉ diễn lại kết quả mô phỏng.
//     Không trúng đòn, không gây đòn.
//   - zone / garrison / squad / landing / guard / follow: lính thật trong vùng r 25 m quanh
//     tướng người chơi — trúng đòn, gây đòn, KO của chúng trừ Q hoặc G.
// Vẽ bằng InstancedMesh: mỗi binh chủng một lưới thân + một lưới tay vũ khí (tay vung được).

import * as THREE from "three";
import { soldierGeometries, blobGeometry, lambert } from "./models.js";
import { heightAt, collide } from "./world.js";
import { TIERS, UNITS, g, heSoGiap } from "../data/tuning.js";

const UNIT_IDS = ["GIAO_DV", "KHIEN_NG", "CUNGKY_NG"];
const CAP = { GIAO_DV: 700, KHIEN_NG: 700, CUNGKY_NG: 500 };
const HITTABLE = new Set(["zone", "garrison", "squad", "landing", "guard", "follow"]);

const _m = new THREE.Matrix4(), _a = new THREE.Matrix4(), _r = new THREE.Matrix4();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, "YXZ"), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color();

let NEXT_ID = 1;

export class Crowd {
  constructor(scene, ctx) {
    this.ctx = ctx; this.agents = []; this.free = [];
    this.meshes = {};
    const mat = lambert();
    for (const u of UNIT_IDS) {
      const geo = soldierGeometries(u);
      const body = new THREE.InstancedMesh(geo.body, mat, CAP[u]);
      const arm = new THREE.InstancedMesh(geo.arm, mat, CAP[u]);
      for (const m of [body, arm]) {
        m.frustumCulled = false; m.count = 0; m.castShadow = false;
        m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP[u] * 3).fill(1), 3);
        scene.add(m);
      }
      this.meshes[u] = { body, arm, shoulder: geo.shoulder };
    }
    this.blob = new THREE.InstancedMesh(blobGeometry(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 2200);
    this.blob.frustumCulled = false; this.blob.count = 0; scene.add(this.blob);
    this.arrows = [];
    const ag = new THREE.CylinderGeometry(0.02, 0.02, 1.1, 3); ag.rotateX(Math.PI / 2);
    this.arrowMesh = new THREE.InstancedMesh(ag, new THREE.MeshBasicMaterial({ color: 0x2a2018 }), 200);
    this.arrowMesh.frustumCulled = false; this.arrowMesh.count = 0; scene.add(this.arrowMesh);
  }

  spawn(o) {
    const a = this.free.pop() || {};
    const tier = TIERS[o.tier || "thuong"], U = UNITS[o.unit];
    const R = this.ctx.R;
    const lvl = o.side === "dich" ? g(R) : g(R) * (o.legionMult || 1);
    Object.assign(a, {
      id: NEXT_ID++, alive: true, side: o.side, unit: o.unit, tier: o.tier || "thuong", role: o.role || "zone",
      front: o.front ?? null, src: o.src ?? null,
      x: o.x, z: o.z, y: 0, vy: 0, yaw: o.yaw ?? (o.side === "ta" ? Math.PI / 2 : -Math.PI / 2), vx: 0, vz: 0,
      maxHp: tier.hp * U.rel[0] * lvl, cong: tier.cong * U.rel[1] * lvl, giap: tier.giap * U.rel[2] * lvl,
      speed: (o.unit === "CUNGKY_NG" ? 5.2 : 3.1) * (0.9 + 0.2 * this.ctx.rng.next()),
      state: "move", st: 0, atkCd: 1 + this.ctx.rng.next() * tier.every, windup: 0, swing: 0,
      token: false, target: null, sx: o.sx ?? o.x, sz: o.sz ?? o.z, anchor: o.anchor || null,
      flash: 0, stun: 0, dieT: 0, lean: 0, bob: this.ctx.rng.next() * 6.28, fakeCd: this.ctx.rng.next() * 3,
      hitBy: 0, scale: tier.scale, lvl: o.lvl || 1, fading: 0,
    });
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
    a.hp -= dmg; a.flash = 0.12;
    if (opt.stun) a.stun = Math.max(a.stun, opt.stun);
    const kx = opt.kx ?? 0, kz = opt.kz ?? 0;
    if (a.hp <= 0) { this.kill(a, opt); return true; }
    if (opt.launch && a.unit !== "CUNGKY_NG") { a.state = "launch"; a.vy = 6.5; a.st = 0; a.vx = kx * 2; a.vz = kz * 2; }
    else if (a.state !== "launch") { a.state = "hit"; a.st = 0.32; a.vx = kx * (opt.knock || 2.5); a.vz = kz * (opt.knock || 2.5); a.windup = 0; }
    return false;
  }

  kill(a, opt = {}) {
    a.state = "dead"; a.dieT = 0; a.hp = 0; a.token = false;
    a.vx = (opt.kx ?? 0) * (opt.knock || 3); a.vz = (opt.kz ?? 0) * (opt.knock || 3);
    if (opt.launch) a.vy = Math.max(a.vy, 5);
    this.ctx.director?.onSoldierKilled(a, opt);
  }

  // ---- AI --------------------------------------------------------------------------------
  update(dt) {
    const ctx = this.ctx, hero = ctx.hero, rng = ctx.rng;
    const enemies = [], allies = [];
    for (const a of this.agents) if (this.hittable(a)) (a.side === "dich" ? enemies : allies).push(a);
    this.assignTokens(enemies);

    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      a.flash = Math.max(0, a.flash - dt); a.bob += dt * 7;
      if (a.state === "dead") {
        a.dieT += dt;
        a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= 0.9; a.vz *= 0.9;
        if (a.vy > 0 || a.y > 0) { a.y += a.vy * dt; a.vy -= 16 * dt; if (a.y < 0) { a.y = 0; a.vy = 0; } }
        if (a.dieT > 2.8) this.release(a);
        continue;
      }
      if (a.state === "launch") {
        a.y += a.vy * dt; a.vy -= 16 * dt; a.x += a.vx * dt; a.z += a.vz * dt;
        if (a.y <= 0) { a.y = 0; a.state = "down"; a.st = 0.7; a.vx = a.vz = 0; }
        continue;
      }
      if (a.state === "down") { a.st -= dt; if (a.st <= 0) { a.state = "move"; } continue; }
      if (a.state === "hit") {
        a.st -= dt; a.x += a.vx * dt; a.z += a.vz * dt; a.vx *= 0.85; a.vz *= 0.85;
        if (a.st <= 0) a.state = "move";
        continue;
      }
      if (a.stun > 0) { a.stun -= dt; continue; }

      if (a.role === "actor") { this.updateActor(a, dt); continue; }

      // chọn mục tiêu
      let tx, tz, target = null, wantDist = 2.0;
      const ranged = UNITS[a.unit].attack === "ranged";
      if (a.side === "dich") {
        const toHero = Math.hypot(hero.x - a.x, hero.z - a.z);
        const aggro = a.role === "garrison" ? 20 : a.role === "squad" ? 14 : 60;
        if (hero.alive && toHero < aggro) {
          target = hero; tx = hero.x; tz = hero.z;
          wantDist = ranged ? 14 : a.token ? 1.7 : 4.2 + (a.id % 5) * 0.6;
        } else if (a.anchor) {
          const at = a.anchor.target && a.anchor.target.alive && !a.anchor.target.dead ? a.anchor.target : null;
          target = at; tx = at ? at.x : a.anchor.x; tz = at ? at.z : a.anchor.z; wantDist = a.anchor.r ?? 3;
        } else {
          const al = nearest(a, allies, 14);
          if (al) { target = al; tx = al.x; tz = al.z; wantDist = ranged ? 12 : 1.7; }
          else { tx = a.sx; tz = a.sz; wantDist = 1; }
        }
      } else {
        const en = nearest(a, enemies, a.role === "guard" || a.role === "follow" ? 9 : 16);
        if (en) { target = en; tx = en.x; tz = en.z; wantDist = 1.7; }
        else if (a.role === "guard" || a.role === "follow") {
          const k = a.id % 12, ang = hero.yaw + Math.PI + (k - 5.5) * 0.35, rr = a.role === "guard" ? 3 : 5.5;
          tx = hero.x + Math.sin(ang) * rr; tz = hero.z + Math.cos(ang) * rr; wantDist = 0.6;
        } else { tx = a.sx; tz = a.sz; wantDist = 1; }
      }
      a.target = target;

      // di chuyển
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz) || 1e-6;
      let mvx = 0, mvz = 0;
      if (target) a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 8);
      if (a.windup <= 0) {
        if (d > wantDist + 0.4) { mvx = dx / d; mvz = dz / d; if (!target) a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 6); }
        else if (d < wantDist - 0.6 && target === hero) { mvx = -dx / d * 0.6; mvz = -dz / d * 0.6; }
        else if (target === hero && !a.token) {        // lượn vòng quanh tướng
          const s = (a.id % 2 ? 1 : -1) * 0.45; mvx = -dz / d * s; mvz = dx / d * s;
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
      a.x += (mvx * a.speed + sx * 4) * dt; a.z += (mvz * a.speed + sz * 4) * dt;
      [a.x, a.z] = collide(ctx.world, a.x, a.z, 0.4, ctx.openGates);

      // đánh
      a.atkCd -= dt;
      if (a.windup > 0) {
        a.windup -= dt; a.swing = 1 - Math.max(0, a.windup) / 0.45;
        if (a.windup <= 0) { a.swing = 1.4; this.strike(a); a.atkCd = TIERS[a.tier].every * (0.85 + 0.3 * rng.next()); }
      } else {
        a.swing = Math.max(0, a.swing - dt * 4);
        const canHit = target && (target === hero ? a.token : true) && d <= (ranged ? 20 : wantDist + 0.9);
        if (canHit && a.atkCd <= 0) a.windup = ranged ? 0.7 : 0.45;
      }
    }
    this.updateArrows(dt);
  }

  updateActor(a, dt) {
    const dx = a.sx - a.x, dz = a.sz - a.z, d = Math.hypot(dx, dz);
    if (d > 0.3) {
      const sp = Math.min(a.speed * 0.8, d * 2);
      a.x += dx / d * sp * dt; a.z += dz / d * sp * dt;
      a.yaw = turn(a.yaw, Math.atan2(dx, dz), dt * 5);
    } else {
      a.yaw = turn(a.yaw, a.side === "ta" ? Math.PI / 2 : -Math.PI / 2, dt * 3);
      a.fakeCd -= dt;
      if (a.fakeCd <= 0 && a.frontRow) { a.swing = 1.4; a.fakeCd = 1.2 + this.ctx.rng.next() * 2.4; }
    }
    a.swing = Math.max(0, a.swing - dt * 3);
  }

  strike(a) {
    const ctx = this.ctx, t = a.target;
    if (!t) return;
    const tier = TIERS[a.tier];
    if (UNITS[a.unit].attack === "ranged") { this.fireArrow(a, t); return; }
    const dx = t.x - a.x, dz = t.z - a.z, d = Math.hypot(dx, dz);
    if (d > 2.6) return;
    if (t === ctx.hero) {
      const raw = a.cong * tier.mv * heSoGiap(ctx.hero.giap, ctx.R) * ctx.diff.dmg;
      ctx.hero.receiveHit({ dmg: raw * (0.95 + 0.1 * ctx.rng.next()), x: a.x, z: a.z, red: false, src: a });
    } else if (t.isBig) {
      // lính đánh tướng đồng minh ×0,2 (ĐỀ XUẤT BẢN THỬ): 24 lính vây Nguyễn Khoái thì ông trụ ~60 s
      t.receiveHit?.({ dmg: a.cong * tier.mv * heSoGiap(t.giap, ctx.R) * 0.2, x: a.x, z: a.z, src: a });
    } else if (t.alive) {
      const dmg = a.cong * tier.mv * heSoGiap(t.giap, ctx.R) * (a.side === "ta" ? 0.8 : 0.6);
      this.damage(t, dmg, { kx: dx / (d || 1), kz: dz / (d || 1), knock: 1.5, by: a.side === "ta" ? "ally" : "enemy" });
    }
  }

  fireArrow(a, t) {
    const y0 = heightAt(a.x, a.z) + 2.2;
    const tx = t.x + (t.vx || 0) * 0.3, tz = t.z + (t.vz || 0) * 0.3, ty = heightAt(tx, tz) + 1.2;
    const d = Math.hypot(tx - a.x, tz - a.z), T = Math.max(0.35, d / 26);
    this.arrows.push({ x: a.x, y: y0, z: a.z, vx: (tx - a.x) / T, vz: (tz - a.z) / T, vy: (ty - y0) / T + 4.9 * T, t: 0, T: T + 0.4, src: a, side: a.side });
    this.ctx.audio?.play("bow", a.x, a.z);
  }

  updateArrows(dt) {
    const ctx = this.ctx, hero = ctx.hero;
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const r = this.arrows[i];
      r.t += dt; r.x += r.vx * dt; r.z += r.vz * dt; r.y += r.vy * dt; r.vy -= 9.8 * dt;
      let done = r.t > r.T || r.y < heightAt(r.x, r.z);
      if (!done && r.side === "dich" && hero.alive && Math.hypot(hero.x - r.x, hero.z - r.z) < 0.9 && Math.abs(r.y - (hero.y + 1.1)) < 1.3) {
        const a = r.src, tier = TIERS[a.tier];
        hero.receiveHit({ dmg: a.cong * tier.mv * 0.85 * heSoGiap(hero.giap, ctx.R) * ctx.diff.dmg, x: r.x - r.vx * 0.1, z: r.z - r.vz * 0.1, red: false, src: a, arrow: true });
        done = true;
      }
      if (done) this.arrows.splice(i, 1);
    }
  }

  // Thẻ tấn công: tối đa N lính cận chiến đánh tướng cùng lúc (21.6: 3 ở Quân sĩ). Cung kỵ có
  // thẻ riêng ≈ 2/3 N (ĐỀ XUẤT BẢN THỬ) — không có thẻ thì 12 cung kỵ cùng bắn hạ tướng trong 12 s.
  assignTokens(enemies) {
    const hero = this.ctx.hero, N = this.ctx.diff.tokens, NR = Math.max(1, Math.round(N * 0.67));
    const isR = (e) => UNITS[e.unit].attack === "ranged";
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
  render(camX, camZ) {
    const counts = { GIAO_DV: 0, KHIEN_NG: 0, CUNGKY_NG: 0 };
    let nb = 0;
    for (const a of this.agents) {
      const M = this.meshes[a.unit], i = counts[a.unit];
      if (i >= CAP[a.unit]) continue;
      counts[a.unit]++;
      const gy = heightAt(a.x, a.z);
      let pitch = 0, sink = 0;
      if (a.state === "dead") { pitch = -Math.min(1, a.dieT / 0.45) * 1.45; if (a.dieT > 1.8) sink = (a.dieT - 1.8) * 1.0; }
      else if (a.state === "launch") pitch = -0.6;
      else if (a.state === "down") pitch = -1.3;
      else if (a.state === "hit") pitch = -0.25;
      const moving = a.role === "actor" ? Math.hypot(a.sx - a.x, a.sz - a.z) > 0.35 : true;
      const bob = a.state === "move" && moving ? Math.abs(Math.sin(a.bob)) * 0.08 : 0;
      _e.set(pitch, a.yaw, 0); _q.setFromEuler(_e);
      _p.set(a.x, gy + a.y + bob - sink, a.z); _s.setScalar(a.scale);
      _m.compose(_p, _q, _s);
      M.body.setMatrixAt(i, _m);
      // tay: nâng lên khi báo trước, chém xuống khi swing > 1
      const sw = a.swing, armX = sw <= 1 ? -sw * 1.7 : -1.7 + (sw - 1) * 5.5;
      _r.makeRotationX(armX);
      _a.makeTranslation(M.shoulder.x, M.shoulder.y, M.shoulder.z).multiply(_r);
      _a.premultiply(_m);
      M.arm.setMatrixAt(i, _a);
      let k = a.flash > 0 ? 2.6 : 1;
      if (a.tier === "tinhnhue") _c.setRGB(0.75 * k, 0.72 * k, 0.62 * k); else _c.setRGB(k, k, k);
      if (a.windup > 0 && a.target === this.ctx.hero) _c.setRGB(1.5, 0.9, 0.8);
      M.body.instanceColor.setXYZ(i, _c.r, _c.g, _c.b); M.arm.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
      if (nb < 2200 && sink < 0.5) {
        _p.set(a.x, gy + 0.06, a.z); _s.setScalar(a.unit === "CUNGKY_NG" ? 1.5 : 1);
        _m.compose(_p, _q.identity(), _s); this.blob.setMatrixAt(nb++, _m);
      }
    }
    for (const u of UNIT_IDS) {
      const M = this.meshes[u];
      M.body.count = M.arm.count = counts[u];
      M.body.instanceMatrix.needsUpdate = M.arm.instanceMatrix.needsUpdate = true;
      M.body.instanceColor.needsUpdate = M.arm.instanceColor.needsUpdate = true;
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
