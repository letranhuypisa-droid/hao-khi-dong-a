// battle/fx.js — hiệu ứng: tia lửa, vệt chém, sóng xung kích, vòng báo đòn, rung màn, chữ nổi.
// VFX ưu tiên lưới opaque / alpha thấp để không ăn fill-rate trên điện thoại (mục 15.7, 17).

import * as THREE from "three";
import { heightAt } from "./world.js";

const MAXP = 600;
const BLOOD_A = new THREE.Color(0x8a1d12), BLOOD_B = new THREE.Color(0xb3261a);
const DUST_A = new THREE.Color(0xc9a86a), DUST_B = new THREE.Color(0xe8d6a8);       // noBlood: vụn gỗ, bụi vàng nhạt
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

// Ảnh hiệu ứng sinh bằng Higgsfield (assets/SOURCES.md). Nạp một lần, dùng chung mọi trận.
const TEX = {};
const loader = new THREE.TextureLoader();
function tex(name) {
  if (!TEX[name]) { const t = loader.load(`./assets/fx/${name}.webp`); t.colorSpace = THREE.SRGBColorSpace; TEX[name] = t; }
  return TEX[name];
}
export function preloadFx() { for (const n of ["slash", "spark", "smoke", "ring", "redring", "fire", "embers"]) tex(n); }
// Rời trận / Võ trường (battle.js releaseGpu): bỏ bản GPU của ảnh dùng chung. Texture đã nạp lên GPU giữ listener
// "dispose" của renderer cũ → gl → canvas → cả trận cũ ở lại bộ nhớ. Ảnh gốc vẫn trong Texture: trận sau tự nạp lại.
export function releaseFxTextures() { for (const k in TEX) TEX[k].dispose(); }

// Hiệu ứng giao chiến (vệt chém, tia lửa, vòng báo đòn) vẽ sau khói lửa của trường (renderOrder cao hơn)
// để cột khói phía sau không phủ lên vòng đỏ, vệt đao.
const OVER = new Set(["slash", "spark", "ring", "redring", "seal"]);
const R_OVER = 5;

// ---- trường billboard instanced: khói cột, lửa, tàn lửa theo pha (atmosphere.js) ---------------------
// Mỗi ảnh một lượt vẽ cho mọi hạt (sprite thường thì mỗi hạt một lượt). Quay về camera trong vertex shader;
// xếp xa → gần bằng sắp xếp chèn (thứ tự gần như giữ nguyên giữa hai khung); hạt lấy từ pool cố định, không
// cấp phát mỗi khung. Sương tính riêng (fogK < 1) để cột khói, đốm lửa xa vẫn đọc được qua sương.
// Thứ tự vẽ: lửa (2) → khói (3) → tàn lửa (4) → hiệu ứng giao chiến (5); nước, mây, cờ (0) vẽ trước cả.
const FIELDS = {
  smoke: { tex: "smoke", cap: 160, order: 3, fogK: 0.32 },     // kênh 0: đống lửa tàn, kênh 1: cột khói lớn
  fire: { tex: "fire", cap: 48, order: 2, fogK: 0.25 },
  embers: { tex: "embers", cap: 64, order: 4, fogK: 0.4, additive: true },
};
const FIELD_VS = `
attribute vec3 iPos; attribute vec4 iSRA; attribute vec3 iCol;
varying vec2 vUv; varying vec4 vCol; varying float vDs;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vCol = vec4(iCol, iSRA.z); vDs = iSRA.w;
  vec4 mvPosition = modelViewMatrix * vec4(iPos, 1.0);
  float c = cos(iSRA.y), s = sin(iSRA.y);
  vec2 q = position.xy * iSRA.x;
  mvPosition.xy += vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FIELD_FS = `
uniform sampler2D map; uniform vec3 light; uniform float fogK;
varying vec2 vUv; varying vec4 vCol; varying float vDs;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, vUv);
  float a = t.a * vCol.a;
  if (a < 0.004) discard;
  vec3 c = mix(t.rgb, vec3(dot(t.rgb, vec3(0.2126, 0.7152, 0.0722))), vDs) * vCol.rgb * light;
  gl_FragColor = vec4(c, a);
  #ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, smoothstep(fogNear, fogFar, vFogDepth) * fogK);
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const _f = new THREE.Vector3();

class Field {
  constructor(scene, def) {
    const cap = this.cap = def.cap;
    const g = new THREE.InstancedBufferGeometry();
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    const ia = (n) => new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n).setUsage(THREE.DynamicDrawUsage);
    this.aPos = ia(3); this.aSRA = ia(4); this.aCol = ia(3); this.attrs = [this.aPos, this.aSRA, this.aCol];
    g.setAttribute("iPos", this.aPos); g.setAttribute("iSRA", this.aSRA); g.setAttribute("iCol", this.aCol);
    g.instanceCount = 0;
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { light: { value: new THREE.Color(1, 1, 1) }, fogK: { value: def.fogK } }]);
    uniforms.map = { value: tex(def.tex) };          // gán sau merge: merge nhân bản texture chưa nạp xong
    this.light = uniforms.light.value;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms, vertexShader: FIELD_VS, fragmentShader: FIELD_FS, fog: true,
      transparent: true, depthWrite: false, blending: def.additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = def.order; this.mesh.visible = false;
    scene.add(this.mesh);
    this.windX = 0; this.windZ = 0;
    this.chan = [0, 0];                                 // số hạt sống theo kênh (trần riêng cho từng nguồn)
    this.live = []; this.pool = [];
    for (let i = 0; i < cap; i++) this.pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, drag: 0, wind: 0, t: 0, T: 1, s: 1, grow: 1, rot: 0, spin: 0,
      a: 1, r: 1, g: 1, b: 1, lit: 0, ds: 0, fin: 0.12, fout: 0.55, flick: 0, seed: 0, ch: 0, d: 0 });
  }
  // Lấy một hạt với giá trị mặc định; người gọi tự gán thêm (không truyền object tuỳ chọn → không cấp phát).
  spawn(x, y, z, T, ch = 0) {
    const p = this.pool.pop(); if (!p) return null;
    p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.drag = 0; p.wind = 0; p.t = 0; p.T = T; p.s = 1; p.grow = 1; p.rot = 0; p.spin = 0;
    p.a = 1; p.r = p.g = p.b = 1; p.lit = 0; p.ds = 0; p.fin = 0.12; p.fout = 0.55; p.flick = 0; p.seed = Math.random() * 100; p.ch = ch;
    this.live.push(p); this.chan[ch]++;
    return p;
  }
  clear() { for (const p of this.live) { this.chan[p.ch]--; this.pool.push(p); } this.live.length = 0; this.mesh.visible = false; this.mesh.geometry.instanceCount = 0; }
  step(dt, cam) {
    const L = this.live;
    _f.set(0, 0, -1).applyQuaternion(cam.quaternion);
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t += dt;
      if (p.t >= p.T) { this.chan[p.ch]--; this.pool.push(p); L[i] = L[L.length - 1]; L.pop(); continue; }
      if (dt > 0) {
        const w = p.wind * (0.3 + p.t / p.T);            // lên cao gió thổi mạnh hơn: cột khói nghiêng dần
        p.vy /= 1 + p.drag * dt;
        p.x += (p.vx + this.windX * w) * dt; p.y += p.vy * dt; p.z += (p.vz + this.windZ * w) * dt; p.rot += p.spin * dt;
      }
      p.d = (p.x - cx) * _f.x + (p.y - cy) * _f.y + (p.z - cz) * _f.z;
    }
    for (let i = 1; i < L.length; i++) {                // xa trước gần sau
      const p = L[i]; let j = i - 1;
      while (j >= 0 && L[j].d < p.d) { L[j + 1] = L[j]; j--; }
      L[j + 1] = p;
    }
    const P = this.aPos.array, S = this.aSRA.array, C = this.aCol.array, n = L.length;
    for (let i = 0; i < n; i++) {
      const p = L[i], u = p.t / p.T, e = 1 - (1 - u) * (1 - u);
      let sc = p.s * (1 + (p.grow - 1) * e), al = p.a * (u < p.fin ? u / p.fin : u > p.fout ? (1 - u) / (1 - p.fout) : 1);
      if (p.flick) { const f = Math.sin(p.t * 13 + p.seed) * Math.sin(p.t * 7.7 + p.seed * 1.7); sc *= 1 + p.flick * f; al *= 1 - p.flick * 0.5 * (1 - f); }
      const k = 1 + p.lit * u;
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      S[i * 4] = sc; S[i * 4 + 1] = p.rot; S[i * 4 + 2] = al; S[i * 4 + 3] = p.ds;
      C[i * 3] = p.r * k; C[i * 3 + 1] = p.g * k; C[i * 3 + 2] = p.b * k;
    }
    for (const a of this.attrs) { a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; }
    this.mesh.geometry.instanceCount = n; this.mesh.visible = n > 0;
  }
}

// Cụm khói của cột khói lớn theo mức chi tiết: 0 gần (nhiều cụm nhỏ), 1 vừa, 2 xa (ít cụm mà to).
// Lên 25–60 m trong đời hạt (vy giảm dần theo drag), nở rộng, trôi theo gió của trường.
// Cụm xa đậm và sẫm hơn (lit: sáng dần theo tuổi) để cột khói còn nổi trên nền trời qua sương.
const COL_LOD = [
  { s: 4.2, grow: 3.4, T: 10, vy: 4.2, a: 0.62, lit: 1.3 },
  { s: 7, grow: 3.0, T: 12, vy: 4.3, a: 0.72, lit: 1.1 },
  { s: 11, grow: 2.6, T: 14, vy: 4.0, a: 0.85, lit: 0.8 },
];

export class FX {
  constructor(scene, camera, overlay) {
    this.scene = scene; this.camera = camera; this.overlay = overlay;
    this.shakeAmt = 0; this.shakeX = 0; this.shakeY = 0;
    this.kickX = 0; this.kickY = 0; this.kickZ = 0; this.fovPunch = 0;
    // hạt nhỏ (tàn lửa vụn) — instanced
    this.pm = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP);
    this.pm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXP * 3), 3);
    this.pm.frustumCulled = false; this.pm.count = 0; scene.add(this.pm);
    this.parts = [];
    this.sprites = []; this.pool = {};
    this.teles = [];
    this.ghosts = [];
    this.texts = [];
    this.fmt = (s) => s;                                // battle.js / arena.js đặt: đổi {tpc}, {c}… trong băng chữ sang phím của thiết bị
    this.planeGeo = new THREE.PlaneGeometry(1, 1); this.planeGeo.rotateX(-Math.PI / 2);
    this.fields = {};                                   // tạo khi dùng lần đầu (Võ trường không dùng)
    preloadFx();
  }

  // ---- trường instanced (atmosphere.js gọi; chạy theo đồng hồ trận) ---------------------------------------
  field(name) { return this.fields[name] || (this.fields[name] = new Field(this.scene, FIELDS[name])); }
  stepFields(dt) { for (const k in this.fields) this.fields[k].step(dt, this.camera); }
  clearFields() { for (const k in this.fields) this.fields[k].clear(); }
  fieldCounts() { const o = {}; for (const k in this.fields) o[k] = this.fields[k].live.length; return o; }   // chỉ để đo

  // Một cụm của cột khói lớn (kênh 1). k 0..1: cường độ nguồn (lửa mới bén thì cột mảnh, nhạt).
  // col: [r, g, b] màu khói riêng (B20: bụi vàng nhạt); thiếu thì khói sẫm như cũ
  column(x, y, z, lod, k = 1, col = null) {
    const L = COL_LOD[lod], j = 0.6 + lod * 0.8;
    const p = this.field("smoke").spawn(x + (Math.random() - 0.5) * j, y, z + (Math.random() - 0.5) * j, L.T * (0.9 + 0.2 * Math.random()), 1);
    if (!p) return null;
    p.s = L.s * (0.85 + 0.3 * Math.random()) * (0.6 + 0.4 * k); p.grow = L.grow;
    p.vy = L.vy * (0.9 + 0.2 * Math.random()); p.drag = 0.06; p.wind = 1;
    p.vx = (Math.random() - 0.5) * 0.4; p.vz = (Math.random() - 0.5) * 0.4;
    p.rot = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 0.12;
    p.a = L.a * (0.5 + 0.5 * k); p.ds = 0.85; p.r = col ? col[0] : 0.2; p.g = col ? col[1] : 0.18; p.b = col ? col[2] : 0.165; p.lit = L.lit; p.fin = 0.08; p.fout = 0.5;
    return p;
  }
  // Khói đống lửa tàn ở trại Nguyên (kênh 0; trước đây mỗi cụm một sprite). s: hệ số dày theo pha.
  pitSmoke(x, y, z, s = 1) {
    const p = this.field("smoke").spawn(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), 4.5 * (1 + 0.08 * (s - 1)), 0);
    if (!p) return null;
    p.s = 2.2 * (1 + 0.18 * (s - 1)); p.grow = 3.2; p.vy = 1.5; p.wind = 0.35;
    p.rot = Math.random() * 6.28; p.spin = 0.2;
    p.a = Math.min(0.62, 0.4 * (1 + 0.1 * (s - 1))); p.ds = 0.45; p.r = 0.92 - 0.05 * s; p.g = 0.86 - 0.05 * s; p.b = 0.8 - 0.05 * s; p.fin = 0.1; p.fout = 0.15;
    return p;
  }
  // Một lưỡi lửa (cháy liên tục thì gọi đều tay: lưỡi lửa mới đè lên lưỡi cũ đang tàn). big: đốm lửa xa cho dễ thấy.
  flame(x, y, z, size = 3, k = 1) {
    const p = this.field("fire").spawn(x, y + size * 0.4, z, 0.9 + Math.random() * 0.5, 0);
    if (!p) return null;
    p.s = size * (0.75 + 0.35 * Math.random()) * (0.5 + 0.5 * k); p.grow = 0.75; p.vy = 0.9 + Math.random() * 0.6; p.wind = 0.25;
    p.rot = (Math.random() - 0.5) * 0.3; p.a = 0.95; p.flick = 0.1; p.fin = 0.15; p.fout = 0.45;
    return p;
  }
  // Tàn lửa, tro bay lên theo gió quanh đám cháy.
  ember(x, y, z) {
    const p = this.field("embers").spawn(x + (Math.random() - 0.5) * 3, y + Math.random() * 2, z + (Math.random() - 0.5) * 3, 2 + Math.random() * 1.5, 0);
    if (!p) return null;
    p.s = 0.45 + Math.random() * 0.4; p.grow = 0.6; p.vy = 1.6 + Math.random() * 1.8; p.drag = 0.3; p.wind = 1.4;
    p.vx = (Math.random() - 0.5) * 1.5; p.vz = (Math.random() - 0.5) * 1.5;
    p.rot = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 3; p.a = 0.9; p.flick = 0.3; p.fin = 0.05; p.fout = 0.5;
    return p;
  }

  // Sprite (luôn quay về camera) hoặc tấm phẳng nằm trên đất, lấy từ pool theo ảnh.
  sprite(name, x, y, z, { size = 1, T = 0.3, grow = 1, rise = 0, rot = 0, spin = 0, opacity = 1, flat = false, additive = false, follow = null, flicker = 0, color = 0xffffff } = {}) {
    const key = name + (flat ? ":flat" : "") + (additive ? ":add" : "");
    const list = this.pool[key] || (this.pool[key] = []);
    let o = list.pop();
    if (!o) {
      const blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      o = flat
        ? new THREE.Mesh(this.planeGeo, new THREE.MeshBasicMaterial({ map: tex(name), transparent: true, depthWrite: false, blending, side: THREE.DoubleSide }))
        : new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(name), transparent: true, depthWrite: false, blending }));
      o.userData.key = key; if (OVER.has(name)) o.renderOrder = R_OVER; this.scene.add(o);
    }
    o.visible = true; o.position.set(x, y, z); o.material.color.setHex(color);
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
      this.parts.push({ x, y: y - 0.4, z, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, t: 0, T: 0.5, c: this.noBlood ? DUST_A : BLOOD_A, s: 1.2 });
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

  // ---- cảm giác trúng đòn (đợt 7) --------------------------------------------------------------------
  // Giật camera theo hướng chém (m, tắt dần nhanh), thu FOV chớp nhoáng (độ), chớp sáng cả màn (0..1). battle.js
  // cộng kick vào vị trí camera và fov vào camera.fov mỗi khung; chạy theo giờ thật nên vẫn giật trong hit-stop.
  kick(dx, dz, a) {
    const l = Math.hypot(dx, dz) || 1;
    this.kickX += dx / l * a; this.kickZ += dz / l * a; this.kickY -= a * 0.35;
    const m = Math.hypot(this.kickX, this.kickZ); if (m > 0.6) { this.kickX *= 0.6 / m; this.kickZ *= 0.6 / m; }
  }
  punch(deg) { this.fovPunch = Math.max(this.fovPunch, deg); }
  flash(k, color = "255,244,214") {
    const v = this.overlay.querySelector(".fx-flash");
    if (!v) return;
    v.style.background = `radial-gradient(ellipse at center, rgba(${color},${Math.min(0.9, k)}) 0%, rgba(${color},${Math.min(0.6, k * 0.5)}) 55%, transparent 100%)`;
    v.style.transition = "none"; v.style.opacity = "1";
    requestAnimationFrame(() => { v.style.transition = "opacity .18s ease-out"; v.style.opacity = "0"; });
  }
  // Tia máu kiểu mực son: giọt đỏ sẫm văng theo hướng đòn (kx, kz), rơi theo trọng lực. s: cỡ (lính chém lính 0,3–0,5).
  // noBlood (B20 — R-spec §6 "không máu"): cùng chuyển động nhưng màu vụn gỗ / bụi vàng nhạt (Math.random như cũ, không đụng rng trận).
  blood(x, y, z, kx, kz, s = 1) {
    const n = Math.round(3 + 7 * s), A = this.noBlood ? DUST_A : BLOOD_A, B = this.noBlood ? DUST_B : BLOOD_B;
    for (let i = 0; i < n && this.parts.length < MAXP; i++) {
      const sp = (2 + Math.random() * 4.5) * (0.6 + 0.4 * s), up = 1 + Math.random() * 3.2;
      const jx = (Math.random() - 0.5) * 1.6, jz = (Math.random() - 0.5) * 1.6;
      this.parts.push({ x, y, z, vx: (kx + jx) * sp, vy: up, vz: (kz + jz) * sp, t: 0, T: 0.35 + Math.random() * 0.35,
        c: Math.random() < 0.5 ? A : B, s: (0.9 + Math.random() * 0.8) * (0.7 + 0.5 * s), grav: 1.4 });
    }
  }
  // Nhát chém của tướng trúng một mục tiêu: chớp sáng tại chỗ trúng, vệt chém chéo ngắn, tia lửa, tia máu. full = false:
  // chỉ tia lửa (từ mục tiêu thứ 5 trong cùng một đòn trở đi, cho khỏi ngập hạt).
  impact(x, y, z, kx, kz, { heavy = false, crit = false, kill = false, full = true } = {}) {
    if (!full) { this.spark(x, y, z, heavy); return; }
    const hot = crit ? 0xffb070 : heavy ? 0xffd9a0 : 0xfff2d6;
    this.sprite("spark", x, y, z, { size: heavy ? 3.4 : crit ? 3 : 2, T: heavy ? 0.16 : 0.1, grow: 1.5, rot: Math.random() * 6.28, additive: true, color: hot });
    // vệt chém chéo: nét vàng ngắn cắt ngang người trúng đòn
    this.sprite("slash", x, y + 0.1, z, { size: heavy ? 2.8 : 2, T: 0.13, grow: 1.25, rot: Math.random() * 6.28, additive: true, opacity: 0.9, color: crit ? 0xffc080 : 0xfff0c8 });
    this.spark(x, y, z, heavy || crit);
    this.blood(x, y, z, kx, kz, kill ? 1.2 : heavy ? 0.9 : 0.6);
    if (kill && heavy) this.sprite("ring", x, heightAt(x, z) + 0.2, z, { size: 2.6, T: 0.25, grow: 1.6, flat: true, rot: Math.random() * 6.28, opacity: 0.6, additive: true });
  }

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
    for (const m of [outer, fill]) { m.renderOrder = R_OVER; this.scene.add(m); }
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
    g.position.set(x, heightAt(x, z) + 0.95, z); g.renderOrder = R_OVER; this.scene.add(g);
    this.ghosts.push({ g, t: 0, T: 0.5, cb, x, z });
  }

  text(x, z, s, color = "#fff") {
    const el = document.createElement("div");
    el.className = "fx-text"; el.textContent = s; el.style.color = color;
    this.overlay.appendChild(el);
    this.texts.push({ el, x, y: heightAt(x, z) + 2.4, z, t: 0, T: 0.9 });
  }

  // Một băng chữ một lúc: băng mới thay băng đang hiện (trước đây hai băng liền nhau đè chữ lên nhau — chỉ DOM, không đụng trận).
  banner(s, color = "#f1d98a", T = 1.1) {
    for (const old of this.overlay.querySelectorAll(".fx-banner")) old.remove();
    const el = document.createElement("div");
    el.className = "fx-banner"; el.textContent = this.fmt(s); el.style.color = color;
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
      if (g.t >= g.T) { this.scene.remove(g.g); g.g.geometry.dispose(); g.g.material.dispose(); g.cb?.(); this.shockwave(g.x, g.z, 3); this.ghosts.splice(i, 1); }   // bóng riêng mỗi lần né: giải phóng GPU
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
    // giật camera, thu FOV: tắt dần theo giờ thật (lò xo tắt nhanh ~80 ms)
    const kd = Math.exp(-dt * 16);
    this.kickX *= kd; this.kickY *= kd; this.kickZ *= kd; this.fovPunch *= Math.exp(-dt * 10);
    // rung màn
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.8);
    const a = this.shakeAmt * this.shakeAmt * 0.6;
    this.shakeX = (Math.random() - 0.5) * a; this.shakeY = (Math.random() - 0.5) * a;
  }
}
