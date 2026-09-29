// battle/fx.js — hiệu ứng: tia lửa, vệt chém, sóng xung kích, vòng báo đòn, rung màn, chữ nổi.
// VFX ưu tiên lưới opaque / alpha thấp để không ăn fill-rate trên điện thoại (mục 15.7, 17).

import * as THREE from "three";
import { heightAt } from "./world.js";

const MAXP = 360;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

export class FX {
  constructor(scene, camera, overlay) {
    this.scene = scene; this.camera = camera; this.overlay = overlay;
    this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0;
    // hạt
    this.pm = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP);
    this.pm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.pm.frustumCulled = false; this.pm.count = 0; scene.add(this.pm);
    this.parts = [];
    // vòng
    this.rings = [];
    this.arcs = [];
    this.teles = [];
    this.ghosts = [];
    this.texts = [];
    this.arcGeoCache = {};
  }

  spark(x, y, z, heavy = false, color = heavy ? 0xffc36a : 0xfff0c8) {
    const n = heavy ? 10 : 5, c = new THREE.Color(color);
    for (let i = 0; i < n && this.parts.length < MAXP; i++) {
      const a = Math.random() * 6.28, up = Math.random() * 4 + 2, sp = Math.random() * 5 + 2;
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, t: 0, T: 0.25 + Math.random() * 0.2, c, s: heavy ? 1.6 : 1 });
    }
    if (heavy) for (let i = 0; i < 4 && this.parts.length < MAXP; i++) {
      this.parts.push({ x, y: y - 0.4, z, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, t: 0, T: 0.5, c: new THREE.Color(0x8a1d12), s: 1.2 });
    }
  }
  dust(x, z, s = 1) {
    const y = heightAt(x, z) + 0.2, c = new THREE.Color(0xb59a70);
    for (let i = 0; i < 8 * s && this.parts.length < MAXP; i++) {
      const a = Math.random() * 6.28, sp = Math.random() * 3 * s;
      this.parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: Math.random() * 1.5, vz: Math.sin(a) * sp, t: 0, T: 0.6, c, s: 2.2 * s, grav: 0.2 });
    }
  }
  trail(h) { if (Math.random() < 0.6) this.dust(h.x, h.z, 0.4); }

  shake(a) { this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, a)); }

  ring(x, z, r, color, T, width = 0.5, y = null) {
    const geo = new THREE.RingGeometry(0.85, 1, 40);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, (y ?? heightAt(x, z)) + 0.2, z);
    this.scene.add(mesh);
    this.rings.push({ mesh, r, t: 0, T, width });
  }
  shockwave(x, z, r) { this.ring(x, z, r, 0xf1d98a, 0.28); }

  // Vệt chém: cung tròn mỏng quanh tướng theo hình học đòn.
  slashArc(h, key, m) {
    const arc = m.shape === "ring" ? Math.PI * 2 : m.shape === "cone" ? (m.arc * Math.PI / 180) : 0.6;
    const r = m.shape === "line" ? 2.2 : m.range * 0.8;
    const k = `${arc.toFixed(2)}_${r.toFixed(1)}`;
    if (!this.arcGeoCache[k]) this.arcGeoCache[k] = new THREE.RingGeometry(r * 0.55, r, 28, 1, -arc / 2, arc);
    const mesh = new THREE.Mesh(this.arcGeoCache[k], new THREE.MeshBasicMaterial({ color: key[0] === "C" || key === "DQ" ? 0xffd27a : 0xfff4dc, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    mesh.position.set(h.x, h.y + 1.15, h.z);
    // Vành nằm trong mặt XZ; góc 0 là +x, quay quanh trục đứng theo hướng mặt của tướng.
    mesh.rotation.set(-Math.PI / 2, 0, 0); mesh.rotateZ(h.yaw - Math.PI / 2);
    if (key.startsWith("N") && Number(key[1]) % 2 === 0) mesh.rotateX(0.35); else mesh.rotateX(-0.25);
    this.scene.add(mesh);
    this.arcs.push({ mesh, t: 0, T: 0.16 });
  }

  // Vòng đỏ dưới chân địch: đòn viền đỏ (nhỏ) hoặc Tuyệt Kỹ boss (lớn).
  telegraph(unit, r, T, big) {
    const outer = new THREE.Mesh(new THREE.RingGeometry(r - 0.25, r, 48), new THREE.MeshBasicMaterial({ color: 0xd8321e, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xd8321e, transparent: true, opacity: big ? 0.28 : 0.22, side: THREE.DoubleSide, depthWrite: false }));
    for (const m of [outer, fill]) { m.rotation.x = -Math.PI / 2; this.scene.add(m); }
    this.teles.push({ unit, r, T, t: 0, outer, fill, big });
    if (big) this.banner("TUYỆT KỸ · NÉ RA KHỎI VÒNG", "#ff8a6a", 0.9);
  }

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

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]; r.t += dt; const u = r.t / r.T;
      if (u >= 1) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); this.rings.splice(i, 1); continue; }
      r.mesh.scale.setScalar(0.3 * r.r + r.r * 0.7 * u); r.mesh.material.opacity = 0.8 * (1 - u);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      const a = this.arcs[i]; a.t += dt; const u = a.t / a.T;
      if (u >= 1) { this.scene.remove(a.mesh); a.mesh.material.dispose(); this.arcs.splice(i, 1); continue; }
      a.mesh.material.opacity = 0.55 * (1 - u);
    }
    for (let i = this.teles.length - 1; i >= 0; i--) {
      const t = this.teles[i]; t.t += dt; const u = t.t / t.T;
      const un = t.unit, y = heightAt(un.x, un.z) + 0.15;
      if (u >= 1.08 || !un.alive || un.dead || un.broken > 0) {
        for (const m of [t.outer, t.fill]) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
        un.rig?.root.traverse((o) => { if (o.material?.emissive) o.material.emissive.setHex(0); });
        this.teles.splice(i, 1); continue;
      }
      const cx = t.big ? un.x : un.x + Math.sin(un.yaw) * t.r * 0.45, cz = t.big ? un.z : un.z + Math.cos(un.yaw) * t.r * 0.45;
      t.outer.position.set(cx, y, cz); t.fill.position.set(cx, y + 0.01, cz);
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
