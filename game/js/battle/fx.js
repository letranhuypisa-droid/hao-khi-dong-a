// battle/fx.js — hiệu ứng: tia lửa, vệt chém, sóng xung kích, vòng báo đòn, rung màn, chữ nổi.
// VFX ưu tiên lưới opaque / alpha thấp để không ăn fill-rate trên điện thoại (mục 15.7, 17).

import * as THREE from "three";
import { heightAt } from "./world.js";

const MAXP = 360;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

// Ảnh hiệu ứng sinh bằng Higgsfield (assets/SOURCES.md). Nạp một lần, dùng chung mọi trận.
const TEX = {};
const loader = new THREE.TextureLoader();
function tex(name) {
  if (!TEX[name]) { const t = loader.load(`./assets/fx/${name}.webp`); t.colorSpace = THREE.SRGBColorSpace; TEX[name] = t; }
  return TEX[name];
}
export function preloadFx() { for (const n of ["slash", "spark", "smoke", "ring", "redring", "fire", "embers"]) tex(n); }

export class FX {
  constructor(scene, camera, overlay) {
    this.scene = scene; this.camera = camera; this.overlay = overlay;
    this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0;
    // hạt nhỏ (tàn lửa vụn) — instanced
    this.pm = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP);
    this.pm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.pm.frustumCulled = false; this.pm.count = 0; scene.add(this.pm);
    this.parts = [];
    this.sprites = []; this.pool = {};
    this.teles = [];
    this.ghosts = [];
    this.texts = [];
    this.planeGeo = new THREE.PlaneGeometry(1, 1); this.planeGeo.rotateX(-Math.PI / 2);
    preloadFx();
  }

  // Sprite (luôn quay về camera) hoặc tấm phẳng nằm trên đất, lấy từ pool theo ảnh.
  sprite(name, x, y, z, { size = 1, T = 0.3, grow = 1, rise = 0, rot = 0, spin = 0, opacity = 1, flat = false, additive = false, follow = null, flicker = 0 } = {}) {
    const key = name + (flat ? ":flat" : "") + (additive ? ":add" : "");
    const list = this.pool[key] || (this.pool[key] = []);
    let o = list.pop();
    if (!o) {
      const blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      o = flat
        ? new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: tex(name), transparent: true, depthWrite: false, blending, side: THREE.DoubleSide }))
        : new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(name), transparent: true, depthWrite: false, blending }));
      o.userData.key = key; this.scene.add(o);
    }
    o.visible = true; o.position.set(x, y, z);
    if (flat) o.rotation.set(0, rot, 0); else o.material.rotation = rot;
    this.sprites.push({ o, t: 0, T, size, grow, rise, spin, opacity, flat, follow, flicker, rot });
    return o;
  }

  spark(x, y, z, heavy = false, color = heavy ? 0xffc36a : 0xfff0c8) {
    this.sprite("spark", x, y, z, { size: heavy ? 2.6 : 1.4, T: heavy ? 0.18 : 0.12, grow: 1.3, rot: Math.random() * 6.28 });
    const n = heavy ? 6 : 3, c = new THREE.Color(color);
    for (let i = 0; i < n && this.parts.length < MAXP; i++) {
      const a = Math.random() * 6.28, up = Math.random() * 4 + 2, sp = Math.random() * 5 + 2;
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, t: 0, T: 0.25 + Math.random() * 0.2, c, s: heavy ? 1.4 : 1 });
    }
    if (heavy) for (let i = 0; i < 3 && this.parts.length < MAXP; i++) {
      this.parts.push({ x, y: y - 0.4, z, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, t: 0, T: 0.5, c: new THREE.Color(0x8a1d12), s: 1.2 });
    }
  }
  dust(x, z, s = 1) {
    const y = heightAt(x, z) + 0.5 * s;
    const n = s >= 1 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      this.sprite("smoke", x + (Math.random() - 0.5) * 2 * s, y, z + (Math.random() - 0.5) * 2 * s,
        { size: 1.6 * s + Math.random(), T: 0.7 + Math.random() * 0.3, grow: 1.9, rise: 0.7, rot: Math.random() * 6.28, opacity: 0.75 });
    }
  }
  trail(h) { if (Math.random() < 0.35) this.dust(h.x, h.z, 0.45); }

  shake(a) { this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, a)); }

  // Vòng lan trên đất: vàng (sóng xung kích) hoặc son (cảnh báo).
  ring(x, z, r, color, T, width = 0.5, y = null) {
    const red = color === 0xd8321e || color === 0xff5a3a;
    this.sprite(red ? "redring" : "ring", x, (y ?? heightAt(x, z)) + 0.25, z, { size: r * 2.2, T, grow: 1, flat: true, rot: Math.random() * 6.28, opacity: 0.95, ringGrow: true });
    this.sprites[this.sprites.length - 1].ring = r;
  }
  shockwave(x, z, r) { this.ring(x, z, r, 0xf1d98a, 0.3); }

  // Vệt chém: nét cọ vàng trước mặt tướng; đòn tay trái lật ngược vệt.
  slashArc(h, key, m) {
    const f = m.shape === "line" ? 0.6 : 1.4, size = Math.max(3.8, Math.min(9, m.range * 1.45)) * (key[0] === "C" || key === "DQ" ? 1.15 : 1);
    const left = key.startsWith("N") && Number(key[1]) % 2 === 0;
    const rot = left ? Math.PI - 0.35 + Math.random() * 0.2 : -0.35 + Math.random() * 0.2;
    this.sprite("slash", h.x + Math.sin(h.yaw) * f, h.y + 1.25, h.z + Math.cos(h.yaw) * f, { size, T: 0.19, grow: 1.12, rot, opacity: 1 });
    if (m.shape === "ring") this.sprite("ring", h.x, h.y + 0.3, h.z, { size: m.range * 2.1, T: 0.22, grow: 1.1, flat: true, rot: Math.random() * 6.28, opacity: 0.7 });
  }

  // Vòng đỏ dưới chân địch: đòn viền đỏ (nhỏ) hoặc Tuyệt Kỹ boss (lớn).
  telegraph(unit, r, T, big) {
    const outer = new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: tex("redring"), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xd8321e, transparent: true, opacity: big ? 0.26 : 0.2, side: THREE.DoubleSide, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    outer.scale.setScalar(r * 2.25);
    for (const m of [outer, fill]) this.scene.add(m);
    this.teles.push({ unit, r, T, t: 0, outer, fill, big });
    if (big) this.banner("TUYỆT KỸ · NÉ RA KHỎI VÒNG", "#ff8a6a", 0.9);
  }

  // Tàn lửa bay quanh tướng (Tổng Phản Công) và lửa cháy (cổng vỡ).
  embers(x, z) {
    const a = Math.random() * 6.28, r = 1.6 + Math.random() * 2.4;     // vòng quanh tướng, không đè lên người
    this.sprite("embers", x + Math.cos(a) * r, heightAt(x, z) + 0.4 + Math.random() * 0.8, z + Math.sin(a) * r,
      { size: 0.7 + Math.random() * 0.6, T: 1.2, grow: 1.1, rise: 2.4, rot: (Math.random() - 0.5) * 0.4, opacity: 0.7, additive: true });
  }
  fire(x, y, z, T = 20, size = 3) { this.sprite("fire", x, y + size * 0.45, z, { size, T, grow: 1, opacity: 0.95, flicker: 1 }); }

  afterimage(x, z, cb) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 1.1, 3, 6), new THREE.MeshBasicMaterial({ color: 0xf1d98a, transparent: true, opacity: 0.45 }));
    g.position.set(x, heightAt(x, z) + 0.95, z); this.scene.add(g);
    this.ghosts.push({ g, t: 0, T: 0.5, cb, x, z });
  }

  text(x, z, s, color = "#fff") {
    const el = document.createElement("div");
    el.className = "fx-text"; el.textContent = s; el.style.color = color;
    this.overlay.appendChild(el);
    this.texts.push({ el, x, y: heightAt(x, z) + 2.4, z, t: 0, T: 0.9 });
  }

  banner(s, color = "#f1d98a", T = 1.1) {
    const el = document.createElement("div");
    el.className = "fx-banner"; el.textContent = s; el.style.color = color;
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), T * 1000 + 400);
  }

  hurt() {
    const v = this.overlay.querySelector(".fx-hurt");
    if (!v) return;
    v.style.transition = "none"; v.style.opacity = "0.55";
    requestAnimationFrame(() => { v.style.transition = "opacity .45s"; v.style.opacity = "0"; });
  }

  update(dt, width, height) {
    // hạt
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.T) { this.parts.splice(i, 1); continue; }
      p.vy -= (p.grav ?? 1) * 14 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (const p of this.parts) {
      const k = 1 - p.t / p.T;
      _p.set(p.x, p.y, p.z); _s.setScalar(p.s * (0.4 + k)); _q.setFromEuler(_e.set(p.t * 9, p.t * 7, 0));
      _m.compose(_p, _q, _s); this.pm.setMatrixAt(n, _m);
      this.pm.instanceColor.setXYZ(n, p.c.r, p.c.g, p.c.b); n++;
    }
    this.pm.count = n; this.pm.instanceMatrix.needsUpdate = true; this.pm.instanceColor.needsUpdate = true;

    // sprite và tấm phẳng từ ảnh Higgsfield
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]; s.t += dt; const u = s.t / s.T;
      if (u >= 1) {
        s.o.visible = false; (this.pool[s.o.userData.key] || (this.pool[s.o.userData.key] = [])).push(s.o);
        this.sprites[i] = this.sprites[this.sprites.length - 1]; this.sprites.pop(); continue;
      }
      let sc = s.ring ? s.size * (0.3 + 0.7 * u) : s.size * (1 + (s.grow - 1) * u);
      if (s.flicker) sc *= 0.92 + 0.08 * Math.sin(s.t * 13 + s.o.position.x);
      if (s.flat) s.o.scale.set(sc, 1, sc); else s.o.scale.set(sc, sc, 1);
      s.o.position.y += s.rise * dt;
      if (s.spin) { if (s.flat) s.o.rotation.y += s.spin * dt; else s.o.material.rotation += s.spin * dt; }
      const fade = s.flicker ? (u > 0.9 ? (1 - u) * 10 : 1) : (s.ring ? 1 - u : u < 0.15 ? 1 : 1 - (u - 0.15) / 0.85);
      s.o.material.opacity = s.opacity * Math.max(0, fade);
    }
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const t = this.teles[i]; t.t += dt; const u = t.t / t.T;
      const un = t.unit, y = heightAt(un.x, un.z) + 0.15;
      if (u >= 1.08 || !un.alive || un.dead || un.broken > 0) {
        this.scene.remove(t.outer); t.outer.material.dispose(); this.scene.remove(t.fill); t.fill.geometry.dispose(); t.fill.material.dispose();
        un.rig?.root.traverse((o) => { if (o.material?.emissive) o.material.emissive.setHex(0); });
        this.teles.splice(i, 1); continue;
      }
      const cx = t.big ? un.x : un.x + Math.sin(un.yaw) * t.r * 0.45, cz = t.big ? un.z : un.z + Math.cos(un.yaw) * t.r * 0.45;
      t.outer.position.set(cx, y + 0.02, cz); t.outer.rotation.y += dt * 0.6; t.fill.position.set(cx, y + 0.01, cz);
      t.fill.scale.setScalar(Math.max(0.01, Math.min(1, u)) * t.r);
      if (un.rig) { const blink = Math.floor(t.t * 16) % 2 ? 1 : 0; un.rig.root.traverse((o) => { if (o.material?.emissive) o.material.emissive.setHex(blink ? 0x551008 : 0); }); }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]; g.t += dt;
      g.g.material.opacity = 0.45 * (1 - g.t / g.T);
      if (g.t >= g.T) { this.scene.remove(g.g); g.cb?.(); this.shockwave(g.x, g.z, 3); this.ghosts.splice(i, 1); }
    }
    // chữ nổi
    const v = new THREE.Vector3();
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t += dt;
      if (t.t >= t.T) { t.el.remove(); this.texts.splice(i, 1); continue; }
      v.set(t.x, t.y + t.t * 1.2, t.z).project(this.camera);
      t.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * width}px, ${(-v.y * 0.5 + 0.5) * height}px) translate(-50%,-50%)`;
      t.el.style.opacity = String(1 - t.t / t.T);
      t.el.style.display = v.z < 1 ? "" : "none";
    }
    // rung màn
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.8);
    const a = this.shakeAmt * this.shakeAmt * 0.6;
    this.shakeX = (Math.random() - 0.5) * a; this.shakeY = (Math.random() - 0.5) * a;
  }
}
