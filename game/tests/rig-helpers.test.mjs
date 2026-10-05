// tests/rig-helpers.test.mjs — đợt 19a A4: xương phụ của thân GLB (battle/rig-helpers.js, thuần): bảng xương phụ (lưng, cổ, xương đòn,
// xoắn cẳng tay — cha, khớp nguồn, cách quay, phần góc) và bộ dẫn driveQuat: quay một phần góc của quaternion cục bộ khớp nguồn (slerp
// từ đơn vị) cho lưng, cổ; phần xoắn quanh trục xương y cho xoắn cẳng tay; phần tay giơ quá ngang vai (quanh trục của vung) cho xương
// đòn. Bake (human.mjs: khung gắn) và glb.js (lúc chạy) dùng chung nên khung gắn của xương phụ khớp đúng lúc chạy.
//   node game/tests/rig-helpers.test.mjs
import assert from "node:assert/strict";

const { HELPERS, HELPER_NAMES, LIFT0, driveQuat } = await import("../js/battle/rig-helpers.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}
// quaternion [x, y, z, w] (quy ước three)
const axisAngle = (ax, a) => { const l = Math.hypot(...ax), s = Math.sin(a / 2); return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(a / 2)]; };
const mul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const conj = (q) => [-q[0], -q[1], -q[2], q[3]];
const rot = (q, v) => { const p = mul(mul(q, [v[0], v[1], v[2], 0]), conj(q)); return [p[0], p[1], p[2]]; };
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], DOWN = [0, -1, 0], I = [0, 0, 0, 1];
const drive = (kind, share, q) => driveQuat(kind, share, q[0], q[1], q[2], q[3], [0, 0, 0, 0]);
// cùng phép quay (q và −q như nhau)
function same(a, b, eps = 1e-9, msg = "") {
  const d = Math.min(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]), Math.hypot(a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]));
  assert.ok(d < eps, `${msg} [${a.map((x) => x.toFixed(5))}] ≠ [${b.map((x) => x.toFixed(5))}] (${d.toExponential(2)})`);
}
const unitLen = (q) => Math.hypot(...q);
const angleOf = (q) => 2 * Math.atan2(Math.hypot(q[0], q[1], q[2]), Math.abs(q[3]));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// vai như anim.js: Euler YXZ (shLy, shLx, shLz) → q = Ry · Rx · Rz
const shoulder = (rx, ry, rz) => mul(mul(axisAngle(Y, ry), axisAngle(X, rx)), axisAngle(Z, rz));

console.log("Bảng xương phụ (HELPERS)");
t("đủ 6 xương: lưng, cổ, xương đòn hai bên, xoắn cẳng tay hai bên; cha, khớp nguồn trong 15 khớp rig; phần góc theo đợt 19a A4", () => {
  const J15 = ["hips", "torso", "head", "shL", "elL", "handL", "shR", "elR", "handR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"];
  assert.deepEqual(HELPER_NAMES, ["spine", "neck", "clavL", "clavR", "twistL", "twistR"]);
  assert.deepEqual(Object.keys(HELPERS), HELPER_NAMES);
  for (const [n, h] of Object.entries(HELPERS)) {
    assert.ok(J15.includes(h.parent) && J15.includes(h.src), n);
    assert.ok(["all", "twist", "lift"].includes(h.kind), n);
    assert.ok(h.share > 0 && h.share < 1, n);
  }
  assert.equal(HELPERS.spine.src, "torso"); assert.equal(HELPERS.spine.parent, "hips"); assert.equal(HELPERS.spine.kind, "all");
  assert.equal(HELPERS.neck.src, "head"); assert.equal(HELPERS.neck.parent, "torso"); assert.equal(HELPERS.neck.kind, "all");
  for (const s of ["L", "R"]) {
    assert.equal(HELPERS["clav" + s].src, "sh" + s); assert.equal(HELPERS["clav" + s].parent, "torso"); assert.equal(HELPERS["clav" + s].kind, "lift");
    assert.ok(HELPERS["clav" + s].share >= 0.25 && HELPERS["clav" + s].share <= 0.35);
    assert.equal(HELPERS["twist" + s].src, "hand" + s); assert.equal(HELPERS["twist" + s].parent, "el" + s); assert.equal(HELPERS["twist" + s].kind, "twist");
  }
  for (const n of ["spine", "neck", "twistL", "twistR"]) assert.ok(Math.abs(HELPERS[n].share - 0.5) < 0.11, n);
  assert.ok(Math.abs(LIFT0 - Math.PI / 2) < 1e-12, "xương đòn nhấc từ ngang vai");
});

console.log("driveQuat — quay một phần góc (all: lưng, cổ)");
t("all: quay quanh cùng trục, góc × phần (0,5 → nửa góc), phần 0 → đơn vị, phần 1 → nguyên q; kết quả đơn vị", () => {
  for (const [ax, a] of [[X, 0.6], [Y, -1.1], [[0.3, -0.5, 0.8], 2.4], [Z, 3.0]]) {
    same(drive("all", 0.5, axisAngle(ax, a)), axisAngle(ax, a / 2), 1e-9, `trục ${ax} góc ${a}`);
    same(drive("all", 0.3, axisAngle(ax, a)), axisAngle(ax, 0.3 * a), 1e-9);
    same(drive("all", 0, axisAngle(ax, a)), I);
    same(drive("all", 1, axisAngle(ax, a)), axisAngle(ax, a));
    assert.ok(Math.abs(unitLen(drive("all", 0.37, axisAngle(ax, a))) - 1) < 1e-12);
  }
  same(drive("all", 0.5, I), I);
});
t("all: q và −q (cùng phép quay) cho cùng kết quả — đi đường ngắn (thân xoay 0,6 rad: lưng 0,3, không phải π − 0,3)", () => {
  const q = axisAngle([0.2, 1, -0.1], 0.6), nq = q.map((x) => -x);
  same(drive("all", 0.5, nq), axisAngle([0.2, 1, -0.1], 0.3));
});

console.log("driveQuat — phần xoắn quanh trục y (twist: xoắn cẳng tay theo bàn tay)");
t("twist: q = xoay quanh y → phần × góc; q gập thuần (quanh x, z) → đơn vị", () => {
  same(drive("twist", 0.5, axisAngle(Y, 1.2)), axisAngle(Y, 0.6));
  same(drive("twist", 0.5, axisAngle(Y, -2.0)), axisAngle(Y, -1.0));
  same(drive("twist", 0.5, axisAngle(X, 1.3)), I);
  same(drive("twist", 0.5, axisAngle([1, 0, -0.7], 0.9)), I);
});
t("twist: bàn tay gập (x) rồi xoắn (y) — Euler XYZ (gập, xoắn, 0) như anim.js → đúng nửa góc xoắn, không ăn phần gập", () => {
  for (const [bx, ay] of [[1.3, 0.8], [-0.5, -1.4], [0.9, 0]]) {
    const q = mul(axisAngle(X, bx), axisAngle(Y, ay));
    same(drive("twist", 0.5, q), axisAngle(Y, ay / 2), 1e-9, `gập ${bx} xoắn ${ay}`);
  }
});
t("twist: q bất kỳ = vung · xoắn — vung không có thành phần y, xoắn chỉ quanh y", () => {
  for (const q of [axisAngle([0.4, 0.7, -0.3], 1.7), mul(axisAngle(Z, 0.5), axisAngle(Y, 1.1)), axisAngle([1, 2, 3], -2.2)]) {
    const tw = drive("twist", 1, q), sw = mul(q, conj(tw));
    assert.ok(Math.abs(tw[0]) < 1e-12 && Math.abs(tw[2]) < 1e-12, "xoắn có x/z");
    assert.ok(Math.abs(sw[1]) < 1e-9, `vung có y ${sw[1]}`);
  }
});

console.log("driveQuat — tay giơ quá ngang vai (lift: xương đòn)");
t("lift: tay dưới ngang vai (buông, đưa ra trước, giơ ngang 80°, xoắn cánh tay) → đơn vị — đứng, chạy, chém ngang xương đòn yên", () => {
  for (const q of [I, axisAngle(Z, 1.2), axisAngle(X, -1.4), axisAngle(Y, 2.0), shoulder(-0.8, 2.0, 0), shoulder(-1.15, -0.35, 0.1), axisAngle(Z, LIFT0 - 1e-6)]) same(drive("lift", 0.25, q), I, 1e-9);
});
t("lift: giơ ngang (z) hay ra trước (x) quá ngang vai θ → quay cùng chiều tay quanh cùng trục, góc phần × (θ − π/2)", () => {
  same(drive("lift", 0.25, axisAngle(Z, 2.5)), axisAngle(Z, 0.25 * (2.5 - Math.PI / 2)));
  same(drive("lift", 0.25, axisAngle(Z, -2.2)), axisAngle(Z, -0.25 * (2.2 - Math.PI / 2)));
  same(drive("lift", 0.3, axisAngle(X, -2.6)), axisAngle(X, -0.3 * (2.6 - Math.PI / 2)));
});
t("lift: vai Euler YXZ như đòn bổ C1 (shRx −2,85, shRy 0,45, shRz 0,15) — trục nằm ngang, góc = phần × (góc tay so với buông − π/2), kéo (0, −1, 0) về phía tay; xoắn cánh tay thêm không đổi kết quả", () => {
  for (const [rx, ry, rz] of [[-2.85, 0.45, 0.15], [-2.55, 0.7, 0.25], [-1.9, -1.0, 0.3], [0.2, 0.3, 2.4]]) {
    const q = shoulder(rx, ry, rz), d = rot(q, DOWN), e = Math.acos(-d[1]), c = drive("lift", 0.25, q);
    assert.ok(e > Math.PI / 2, `tư thế thử phải quá ngang vai (${e})`);
    assert.ok(Math.abs(c[1]) < 1e-12, "trục có thành phần y");
    assert.ok(Math.abs(angleOf(c) - 0.25 * (e - Math.PI / 2)) < 1e-9, `góc ${angleOf(c)} ≠ ${0.25 * (e - Math.PI / 2)}`);
    assert.ok(dot(rot(c, DOWN), d) > dot(DOWN, d), "không kéo về phía tay");
    same(drive("lift", 0.25, mul(q, axisAngle(Y, 1.3))), c, 1e-9, "xoắn cánh tay");
  }
});
t("lift: liền ở ngang vai, tay thẳng lên trời (y = w = 0) không ra NaN — góc phần × π/2", () => {
  const a = drive("lift", 0.25, axisAngle(Z, LIFT0 + 1e-7));
  assert.ok(angleOf(a) < 1e-7);
  const up = drive("lift", 0.25, axisAngle(X, Math.PI));
  assert.ok(up.every(Number.isFinite));
  same(up, axisAngle(X, 0.25 * Math.PI / 2));
  for (const k of ["twist", "all"]) assert.ok(drive(k, 0.5, axisAngle(X, Math.PI)).every(Number.isFinite), k);
  same(drive("twist", 0.5, axisAngle(X, Math.PI)), I);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
