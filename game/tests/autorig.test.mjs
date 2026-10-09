// tests/autorig.test.mjs — gắn xương tự động (riglab/autorig.js) trên một hình người tổng hợp đứng tay chữ A, biết trước vị
// trí khớp: dò hướng (mô hình quay ngang, quay ngược), dò khớp (nách, vai, cổ, hông, chân), bộ xương (nghỉ tay chân buông
// thẳng như rig game, gắn trùng tay chữ A), trọng số (tay không ăn vào thân, chân trái không ăn sang chân phải, tổng 1),
// và đặt mọi góc về 0 thì tay buông xuống đúng như rig game. Chạy trong Node:
//   node game/tests/autorig.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const THREE = await import("three");
const AR = await import("../js/riglab/autorig.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(3)} ≉ ${b.toFixed(3)} (±${tol})`);

// ---- hình người tổng hợp (cao 1,9 như rig game, mặt nhìn +z, tay chữ A 40°) --------------------------------------------------
// Trụ nối hai điểm (bán kính r), hộp, cầu; gộp thành một lưới có chỉ mục. Ghi lại khớp thật để so.
const A_DEG = 40, a = (A_DEG * Math.PI) / 180;
const TRUE = { hips: 0.92, neck: 1.62, shY: 1.46, shX: 0.2, legX: 0.1, armLen: 0.72 };
function limb(from, to, r) {
  const d = new THREE.Vector3().subVectors(to, from), L = d.length();
  const g = new THREE.CylinderGeometry(r, r * 0.9, L, 12, 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
  return g;
}
function humanoid() {
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z), parts = [];
  parts.push(new THREE.BoxGeometry(0.42, 0.62, 0.24, 4, 8, 3).translate(0, 1.2, 0));          // ngực–bụng 0,89–1,51
  parts.push(new THREE.BoxGeometry(0.36, 0.14, 0.24, 4, 2, 3).translate(0, 0.86, 0));         // chậu 0,79–0,93
  parts.push(new THREE.CylinderGeometry(0.05, 0.06, 0.14, 10, 2).translate(0, 1.58, 0));      // cổ
  parts.push(new THREE.SphereGeometry(0.12, 14, 10).translate(0, 1.76, 0));                   // đầu 1,64–1,88 (+ tóc)
  parts.push(new THREE.BoxGeometry(0.1, 0.04, 0.1).translate(0, 1.89, 0));
  for (const s of [-1, 1]) {
    const sh = V(s * TRUE.shX, TRUE.shY), dir = V(s * Math.sin(a), -Math.cos(a)), hand = sh.clone().addScaledVector(dir, TRUE.armLen);
    parts.push(new THREE.SphereGeometry(0.07, 10, 8).translate(sh.x, sh.y, 0));               // bắp vai
    parts.push(limb(sh, sh.clone().addScaledVector(dir, 0.32), 0.05), limb(sh.clone().addScaledVector(dir, 0.32), hand, 0.042));
    parts.push(new THREE.SphereGeometry(0.05, 8, 6).translate(hand.x, hand.y, 0));
    const hip = V(s * TRUE.legX, 0.88), knee = V(s * TRUE.legX, 0.48, 0.01), ankle = V(s * TRUE.legX, 0.08);
    parts.push(limb(hip, knee, 0.075), limb(knee, ankle, 0.06));
    parts.push(new THREE.BoxGeometry(0.1, 0.08, 0.26, 2, 2, 4).translate(s * TRUE.legX, 0.04, 0.07));   // bàn chân thò ra trước
  }
  const pos = [], idx = []; let base = 0;
  for (const g0 of parts) {
    const g = g0.index ? g0 : g0.toNonIndexed();
    const p = g.attributes.position.array; for (let i = 0; i < p.length; i++) pos.push(p[i]);
    const ix = g.index ? g.index.array : Array.from({ length: p.length / 3 }, (_, i) => i);
    for (const i of ix) idx.push(i + base); base += p.length / 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setIndex(idx);
  return geo;
}
const rotated = (geo, yaw) => { const g = geo.clone(); g.rotateY(yaw); return g; };
const pts = (geo) => AR.surfacePoints([{ pos: geo.attributes.position.array, index: geo.index.array }], 30000);

const G = humanoid();

console.log("Hướng mặt");
t("đứng đúng hướng (+z) thì không xoay", () => assert.equal(AR.guessYaw(pts(G)), 0));
t("mô hình quay ngang 90° thì xoay lại cho tay dang theo x", () => {
  const y = AR.guessYaw(pts(rotated(G, Math.PI / 2)));
  const back = ((y + Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  assert.ok(Math.abs(back) < 1e-6 || Math.abs(back - 2 * Math.PI) < 1e-6, `yaw ${y}`);
});
t("mô hình quay lưng (bàn chân chĩa −z) thì xoay 180°", () => {
  const y = AR.guessYaw(pts(rotated(G, Math.PI)));
  near(((y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), Math.PI, 1e-6, "yaw");
});

console.log("Dò khớp");
const P = AR.transformPositions(pts(G), AR.normalize(pts(G), 0));
const lm = AR.landmarks(P);
t("không cảnh báo trên hình người tay chữ A rõ ràng", () => assert.deepEqual(lm.warnings, []));
t("hông, cổ, vai đúng chỗ (sai ≤ 0,07)", () => {
  near(lm.j.hips[1], TRUE.hips, 0.07, "hông y");
  near(lm.j.head[1], TRUE.neck, 0.07, "cổ y");
  near(lm.j.shR[1], TRUE.shY, 0.07, "vai y"); near(lm.j.shR[0], TRUE.shX, 0.07, "vai x");
  near(lm.j.shL[0], -TRUE.shX, 0.07, "vai trái x");
});
t("L ở phía −x, R ở phía +x (quy ước rig game)", () => {
  for (const k of ["sh", "el", "hand", "hip", "knee", "ankle"]) { assert.ok(lm.j[k + "L"][0] < 0, k + "L"); assert.ok(lm.j[k + "R"][0] > 0, k + "R"); }
});
t("khuỷu, cổ tay nằm trên trục tay chữ A (góc ~40°)", () => {
  for (const s of ["L", "R"]) {
    const sh = lm.j["sh" + s], el = lm.j["el" + s], hd = lm.j["hand" + s];
    const ang = Math.atan2(Math.abs(hd[0] - sh[0]), sh[1] - hd[1]) * 180 / Math.PI;
    near(ang, A_DEG, 8, "góc tay " + s); assert.ok(el[1] < sh[1] && hd[1] < el[1], "khuỷu dưới vai, cổ tay dưới khuỷu");
  }
});
t("chân: hai bên tách nhau, gối giữa hông và cổ chân", () => {
  near(lm.j.hipR[0], TRUE.legX, 0.05, "chân x");
  for (const s of ["L", "R"]) assert.ok(lm.j["hip" + s][1] > lm.j["knee" + s][1] && lm.j["knee" + s][1] > lm.j["ankle" + s][1]);
});

console.log("Bộ xương");
const sk = AR.buildSkeleton(lm);
const wpos = (b) => { b.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); };
t("đủ 15 xương, tên và cha đúng như rig game", () => {
  assert.deepEqual(sk.bones.map((b) => b.name), AR.JOINTS);
  for (const b of sk.bones) assert.equal(b.parent?.name ?? null, AR.PARENT[b.name] ?? null, b.name);
});
t("tư thế gắn: khớp nằm đúng điểm dò được (tay chữ A)", () => {
  for (const k of AR.JOINTS) { const w = wpos(sk.byName[k]); for (let i = 0; i < 3; i++) near(w.getComponent(i), lm.j[k][i], 1e-4, k + "[" + i + "]"); }
});
t("tư thế nghỉ (mọi góc 0): tay chân buông thẳng xuống như rig game", () => {
  for (const b of sk.bones) b.quaternion.identity();
  for (const s of ["L", "R"]) {
    const sh = wpos(sk.byName["sh" + s]), hd = wpos(sk.byName["hand" + s]), hip = wpos(sk.byName["hip" + s]), an = wpos(sk.byName["ankle" + s]);
    near(hd.x, sh.x, 1e-6, "tay " + s + " thẳng dưới vai"); assert.ok(hd.y < sh.y);
    near(an.x, hip.x, 1e-6, "chân " + s + " thẳng dưới hông");
  }
  for (const b of sk.bones) b.quaternion.copy(sk.bind[b.name]);
});

console.log("Trọng số da");
const geo = G.clone(); geo.setAttribute("position", new THREE.BufferAttribute(AR.transformPositions(G.attributes.position.array, AR.normalize(pts(G), 0)), 3));
const W = AR.computeWeights(geo.attributes.position.array, geo.index.array, lm);
const n = geo.attributes.position.count, J = (name) => AR.JOINTS.indexOf(name);
const wOf = (v, names) => { let s = 0; for (let q = 0; q < 4; q++) if (names.includes(AR.JOINTS[W.skinIndex[v * 4 + q]])) s += W.skinWeight[v * 4 + q]; return s; };
const pv = (v) => [geo.attributes.position.getX(v), geo.attributes.position.getY(v), geo.attributes.position.getZ(v)];
t("mỗi đỉnh 4 trọng số, tổng 1", () => {
  for (let v = 0; v < n; v += 7) { let s = 0; for (let q = 0; q < 4; q++) s += W.skinWeight[v * 4 + q]; near(s, 1, 1e-4, "tổng " + v); }
});
t("cẳng tay, bàn tay theo xương tay cùng bên (≥ 0,85)", () => {
  let checked = 0;
  for (let v = 0; v < n; v++) {
    const [x, y] = pv(v); if (Math.abs(x) < 0.5 || y > 1.2) continue;          // xa thân: cẳng tay, bàn tay
    const s = x < 0 ? "L" : "R"; assert.ok(wOf(v, ["el" + s, "hand" + s]) >= 0.85, `đỉnh ${v} (${x.toFixed(2)}, ${y.toFixed(2)})`); checked++;
  }
  assert.ok(checked > 50, "đủ đỉnh để kiểm");
});
t("sườn, bụng không bị tay kéo (trọng số tay ≤ 0,05)", () => {
  for (let v = 0; v < n; v++) {
    const [x, y, z] = pv(v); if (Math.abs(x) > 0.15 || y < 0.95 || y > 1.3 || Math.abs(z) > 0.13) continue;
    assert.ok(wOf(v, ["shL", "elL", "handL", "shR", "elR", "handR"]) <= 0.05, `đỉnh ${v} (${x.toFixed(2)}, ${y.toFixed(2)})`);
  }
});
t("ống chân trái không ăn trọng số chân phải và ngược lại", () => {
  for (let v = 0; v < n; v++) {
    const [x, y] = pv(v); if (y > 0.7 || Math.abs(x) < 0.04) continue;
    const other = x < 0 ? ["hipR", "kneeR", "ankleR"] : ["hipL", "kneeL", "ankleL"];
    assert.ok(wOf(v, other) <= 0.01, `đỉnh ${v} (${x.toFixed(2)}, ${y.toFixed(2)})`);
  }
});
t("đầu theo xương đầu (≥ 0,9)", () => {
  for (let v = 0; v < n; v++) { const [, y] = pv(v); if (y > 1.72) assert.ok(wOf(v, ["head"]) >= 0.9, `đỉnh ${v} y ${y.toFixed(2)}`); }
});

console.log("Ghép lại");
t("rigMeshes: SkinnedMesh dùng chung một bộ xương, tư thế gắn giữ nguyên hình (sai ≤ 1e-4)", () => {
  const r = AR.rigMeshes([{ geometry: G, material: new THREE.MeshBasicMaterial() }], { yaw: 0 });
  const m = r.root.children.find((o) => o.isSkinnedMesh), v = new THREE.Vector3();
  assert.equal(m.skeleton.bones.length, 15);
  r.root.updateMatrixWorld(true); m.skeleton.update();
  const p0 = m.geometry.attributes.position;
  for (let i = 0; i < p0.count; i += 97) { m.getVertexPosition(i, v); near(v.distanceTo(new THREE.Vector3().fromBufferAttribute(p0, i)), 0, 1e-4, "đỉnh " + i); }
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
