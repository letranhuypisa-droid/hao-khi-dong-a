// battle/models.js — hình khối low poly dựng bằng code (chưa có asset thật).
//
// Phối màu sơn mài (quyết định L1): son đỏ, đen then, vàng thếp, trứng sáo. Phe Nguyên dùng
// xám thép + chàm để hai phe tách nhau bằng cả sắc độ lẫn hình dáng (mũ nhọn, khiên tròn) —
// không chỉ bằng màu, vì PT-A chấm cả qua bộ lọc mù màu (21.9).

import * as THREE from "three";

export const PAL = {
  son: 0x9b2d20, sonDam: 0x6e1d15, then: 0x1d1a17, vang: 0xc9a14a, trung: 0xe6dcc3,
  vai: 0xb9a37a, da: 0xc48f63, toc: 0x141210, go: 0x6b4a2b, sat: 0x8d9296,
  thep: 0x5f6f7c, cham: 0x2c3a4a, long: 0x5a4632, xam: 0xb8bdbf, nau: 0x4a3524,
  ngua: 0x6a4e36, nguaDen: 0x2a211b,
};

// ---- ghép hình: mỗi mảnh là geometry + màu, gộp thành một BufferGeometry có vertex color ----
export function part(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
  return g;
}
export function merge(parts) {
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    col.set(p.attributes.color.array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);

export const lambert = (opts = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts });

export function blobGeometry() {
  const g = new THREE.CircleGeometry(0.55, 10);
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---- Rig khớp nối cho tướng, sĩ quan, boss ----------------------------------------------------
// Trả về { root, p } với p là các khớp. Hoạt ảnh thủ tục đặt rotation trên từng khớp.
export function makeRig({ scale = 1, cloth = PAL.son, armor = PAL.then, trim = PAL.vang, skin = PAL.da,
  hat = "tocbui", weapon = "songdao", cape = null, flag = null, shield = false } = {}) {
  const root = new THREE.Group(), p = {};
  const mat = lambert();
  const mesh = (geo) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

  p.hips = joint(root, 0, 0.92, 0);
  p.torso = joint(p.hips, 0, 0.04, 0);
  p.torso.add(mesh(merge([
    part(box(0.48, 0.52, 0.3), cloth, { y: 0.3 }),
    part(box(0.52, 0.36, 0.33), armor, { y: 0.38 }),
    part(box(0.54, 0.08, 0.34), trim, { y: 0.1 }),
    part(box(0.5, 0.08, 0.32), trim, { y: 0.56 }),
    part(cyl(0.22, 0.32, 0.42, 8), cloth, { y: -0.14 }),
  ])));
  p.head = joint(p.torso, 0, 0.68, 0);
  const headParts = [part(ico(0.16, 1), skin, { y: 0.1 })];
  if (hat === "tocbui") headParts.push(part(ico(0.1, 0), PAL.toc, { y: 0.28, z: -0.03 }), part(box(0.34, 0.06, 0.3), PAL.son, { y: 0.16 }));
  if (hat === "mutuong") headParts.push(part(cyl(0.18, 0.2, 0.14, 8), trim, { y: 0.22 }), part(cone(0.06, 0.26, 5), PAL.son, { y: 0.4 }));
  if (hat === "munguyen") headParts.push(part(cone(0.2, 0.38, 7), PAL.xam, { y: 0.34 }), part(cyl(0.22, 0.24, 0.08, 8), PAL.long, { y: 0.2 }));
  if (hat === "mulong") headParts.push(part(cyl(0.2, 0.24, 0.26, 8), PAL.long, { y: 0.28 }), part(cone(0.05, 0.22, 4), trim, { y: 0.5 }));
  p.head.add(mesh(merge(headParts)));

  for (const s of [-1, 1]) {
    const side = s < 0 ? "L" : "R";
    const sh = joint(p.torso, 0.3 * s, 0.52, 0);
    sh.rotation.order = "YXZ";          // quay cánh tay sang ngang sau khi giơ (xem anim.js)
    sh.add(mesh(merge([part(box(0.15, 0.36, 0.16), armor, { y: -0.16 }), part(box(0.2, 0.12, 0.2), trim, { y: 0.02 })])));
    const el = joint(sh, 0, -0.34, 0);
    el.add(mesh(merge([part(box(0.13, 0.32, 0.14), cloth, { y: -0.15 }), part(ico(0.07, 0), skin, { y: -0.34 })])));
    const hand = joint(el, 0, -0.36, 0.02);
    p["sh" + side] = sh; p["el" + side] = el; p["hand" + side] = hand;

    const hip = joint(p.hips, 0.12 * s, -0.02, 0);
    hip.add(mesh(merge([part(box(0.17, 0.46, 0.19), cloth, { y: -0.22 })])));
    const knee = joint(hip, 0, -0.45, 0);
    knee.add(mesh(merge([part(box(0.15, 0.44, 0.17), PAL.then, { y: -0.2 }), part(box(0.16, 0.08, 0.26), PAL.then, { y: -0.44, z: 0.04 })])));
    p["hip" + side] = hip; p["knee" + side] = knee;
  }

  const blade = (len, w, col) => merge([
    part(box(0.05, 0.05, 0.22), PAL.then, { z: 0.02 }),
    part(box(0.16, 0.04, 0.05), trim, { z: 0.13 }),
    part(box(0.03, w, len), col, { z: 0.16 + len / 2, y: 0.02 }),
  ]);
  if (weapon === "songdao") {
    p.handR.add(mesh(blade(0.9, 0.08, PAL.sat)));
    p.handL.add(mesh(blade(0.9, 0.08, PAL.sat)));
  } else if (weapon === "giao") {
    p.handR.add(mesh(merge([part(cyl(0.03, 0.03, 3.0, 5), PAL.go, { z: 0.6, rx: Math.PI / 2 }), part(cone(0.07, 0.4, 4), PAL.sat, { z: 2.25, rx: Math.PI / 2 }), part(box(0.1, 0.1, 0.06), PAL.son, { z: 1.98 })])));
  } else if (weapon === "cung") {
    p.handL.add(mesh(merge([part(box(0.05, 1.5, 0.06), PAL.go, { z: 0.1 }), part(box(0.015, 1.4, 0.015), PAL.trung, { z: -0.05 })])));
  } else if (weapon === "dadao") {
    p.handR.add(mesh(merge([part(cyl(0.035, 0.035, 2.2, 5), PAL.go, { z: 0.4, rx: Math.PI / 2 }), part(box(0.05, 0.28, 0.8), PAL.sat, { z: 1.7, y: 0.1 }), part(box(0.2, 0.08, 0.08), trim, { z: 1.3 })])));
  } else if (weapon === "dao") {
    p.handR.add(mesh(blade(1.0, 0.1, PAL.sat)));
  }
  if (shield) p.elL.add(mesh(merge([part(cyl(0.38, 0.38, 0.06, 10), PAL.nau, { y: -0.2, z: 0.16, rx: Math.PI / 2 }), part(cyl(0.1, 0.1, 0.08, 6), trim, { y: -0.2, z: 0.2, rx: Math.PI / 2 })])));
  if (cape) {
    p.cape = joint(p.torso, 0, 0.6, -0.17);
    p.cape.add(mesh(merge([part(box(0.5, 0.95, 0.04), cape, { y: -0.48 })])));
  }
  if (flag) {
    p.flag = joint(p.torso, 0, 0.3, -0.2);
    const pole = mesh(merge([part(cyl(0.02, 0.02, 1.9, 4), PAL.then, { y: 0.9 })]));
    p.flag.add(pole);
    const tex = flagTexture(flag.text, flag.bg, flag.fg);
    const cloth2 = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 1.1, 1, 4),
      new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
    cloth2.position.set(0.24, 1.3, 0); cloth2.rotation.y = Math.PI / 2;
    p.flagCloth = cloth2;
    p.flag.add(cloth2);
  }
  root.scale.setScalar(scale);
  return { root, p, scale };
}

// Lá cờ viết chữ dọc (Cờ sáu chữ của Trần Quốc Toản là Chính sử theo canon).
export function flagTexture(text, bg = "#9b2d20", fg = "#f1d98a") {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, 64, 256);
  x.strokeStyle = fg; x.lineWidth = 3; x.strokeRect(4, 4, 56, 248);
  x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle";
  const chars = [...text];
  const step = 236 / chars.length;
  x.font = `bold ${Math.min(40, step * 0.8)}px serif`;
  chars.forEach((ch, i) => x.fillText(ch, 32, 14 + step * (i + 0.5)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Vật phẩm rơi: khối nhỏ xoay + vòng sáng.
export function pickupMesh(color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.35, flatShading: true }));
  m.position.y = 0.8; g.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 16), new THREE.MeshBasicMaterial({ color: 0xf1d98a, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.gem = m;
  return g;
}
