// battle/trail.js — vệt lưỡi đao: dải tam giác nối các vị trí chuôi–mũi lưỡi của vài khung gần
// nhất, cộng sáng (additive) và nhạt dần theo tuổi. Mỗi mẫu mới được chèn thêm điểm giữa theo cung
// tròn quanh vai để vệt cong mượt dù lưỡi quét 90° trong một khung.

import * as THREE from "three";

const N = 24;          // số mẫu giữ lại (kể cả điểm chèn)

export class BladeTrail {
  constructor(scene, color = 0xffe2a0, life = 0.16) {
    this.life = life; this.col = new THREE.Color(color);
    this.base = []; this.tip = []; this.age = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 2 * 3); this.colA = new Float32Array(N * 2 * 3);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.colA, 3));
    const idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5; this.mesh.visible = false;
    scene.add(this.mesh);
    this.lastB = null; this.lastT = null;
  }

  // Thêm mẫu (vị trí thế giới của chuôi và mũi lưỡi). pivot: tâm cung để chèn điểm giữa (vai).
  push(b, t, pivot) {
    if (this.lastB && pivot) {
      const steps = Math.min(4, Math.floor(this.lastT.distanceTo(t) / 0.35));
      for (let s = 1; s <= steps; s++) {
        const k = s / (steps + 1);
        this.add(arc(this.lastB, b, pivot, k), arc(this.lastT, t, pivot, k), 0);
      }
    }
    this.add(b.clone(), t.clone(), 0);
    this.lastB = b.clone(); this.lastT = t.clone();
  }
  add(b, t, age) {
    this.base.unshift(b); this.tip.unshift(t); this.age.unshift(age);
    if (this.base.length > N) { this.base.pop(); this.tip.pop(); this.age.pop(); }
  }
  cut() { this.lastB = this.lastT = null; }

  update(dt) {
    for (let i = this.age.length - 1; i >= 0; i--) {
      this.age[i] += dt;
      if (this.age[i] > this.life) { this.base.splice(i, 1); this.tip.splice(i, 1); this.age.splice(i, 1); }
    }
    const n = this.base.length;
    this.mesh.visible = n >= 2;
    if (n < 2) { this.cut(); return; }
    for (let i = 0; i < N; i++) {
      const j = Math.min(i, n - 1), b = this.base[j], t = this.tip[j];
      // mép chuôi mờ hơn mép mũi; nhạt dần theo tuổi, mẫu cũ nhất tắt hẳn
      const f = i < n ? Math.max(0, 1 - this.age[j] / this.life) ** 1.4 * (1 - i / N) : 0;
      this.pos.set([b.x, b.y, b.z], i * 6); this.pos.set([t.x, t.y, t.z], i * 6 + 3);
      this.colA.set([this.col.r * f * 0.25, this.col.g * f * 0.25, this.col.b * f * 0.25], i * 6);
      this.colA.set([this.col.r * f, this.col.g * f, this.col.b * f], i * 6 + 3);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }

  dispose(scene) { scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

// Điểm trên cung từ a tới b quanh tâm c (nội suy hướng + nội suy bán kính).
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function arc(a, b, c, k) {
  _a.subVectors(a, c); _b.subVectors(b, c);
  const ra = _a.length(), rb = _b.length();
  if (ra < 1e-4 || rb < 1e-4) return a.clone().lerp(b, k);
  _a.divideScalar(ra); _b.divideScalar(rb);
  const d = Math.min(1, Math.max(-1, _a.dot(_b))), ang = Math.acos(d);
  if (ang < 1e-3) return a.clone().lerp(b, k);
  const s = Math.sin(ang), wa = Math.sin((1 - k) * ang) / s, wb = Math.sin(k * ang) / s;
  return new THREE.Vector3().addScaledVector(_a, wa).addScaledVector(_b, wb).multiplyScalar(ra + (rb - ra) * k).add(c);
}
