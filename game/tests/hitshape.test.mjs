// tests/hitshape.test.mjs — đợt 15b: nón chém của tướng tính bề ngang thân người bị chém (battle/hitshape.js, thuần).
// Luật cũ (hero.js applyHits, shape "cone"): ngoài tầm + rad thì trượt; sát tướng (< 0,8 m) thì trúng; còn lại chỉ xét góc của TÂM người so với
// nửa độ mở nón — cung kỵ (vòng trúng 1 m) đứng lệch mép nón, thân ngựa nằm trong lưỡi chém, vẫn bị chém xuyên. Luật mới: nửa góc nới thêm
// atan2(rad, d); rad 0 phải ra đúng luật cũ.
//   node game/tests/hitshape.test.mjs
import assert from "node:assert/strict";

const { inCone } = await import("../js/battle/hitshape.js");
const { MOVES, HIT_R } = await import("../js/data/tuning.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}
const RAD = Math.PI / 180;
// luật cũ, chép từ hero.js trước đợt 15b
const oldCone = (dx, dz, fx, fz, reach, arc, rad) => {
  const d = Math.hypot(dx, dz);
  if (d > reach + rad) return false;
  if (d < 0.8) return true;
  return (dx * fx + dz * fz) / d >= Math.cos((arc / 2) * Math.PI / 180);
};
// điểm ở góc lệch deg (so với hướng mặt +z), cách d m
const at = (deg, d) => [Math.sin(deg * RAD) * d, Math.cos(deg * RAD) * d];

console.log("inCone — rad 0 ra đúng luật cũ");
t("lưới điểm × mọi nón của bảng đòn × 8 hướng mặt: rad 0 trùng luật cũ từng điểm", () => {
  const cones = Object.values(MOVES).filter((m) => m.shape === "cone");
  assert.ok(cones.length >= 8);
  let n = 0;
  for (const m of cones) for (let k = 0; k < 8; k++) {
    const yaw = k * Math.PI / 4 + 0.3, fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (let x = -6; x <= 6; x += 0.25) for (let z = -6; z <= 6; z += 0.25) {
      assert.equal(inCone(x, z, fx, fz, m.range, m.arc, 0), oldCone(x, z, fx, fz, m.range, m.arc, 0), `${x},${z} yaw ${yaw.toFixed(2)} arc ${m.arc}`);
      n++;
    }
  }
  assert.ok(n > 10000);
});
t("sĩ quan, cổng (không nới góc): inCone(reach + rad, arc, 0) trùng luật cũ với rad 0,9 / 1,2 / 3,5 từng điểm — hero.js applyHits đi đường này", () => {
  let n = 0;
  for (const rad of [0.9, 1.2, 3.5]) for (const m of [MOVES.N1, MOVES.C1]) for (let k = 0; k < 8; k++) {
    const yaw = k * Math.PI / 4 + 0.3, fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (let x = -8; x <= 8; x += 0.25) for (let z = -8; z <= 8; z += 0.25) {
      assert.equal(inCone(x, z, fx, fz, m.range + rad, m.arc, 0), oldCone(x, z, fx, fz, m.range, m.arc, rad), `${x},${z} rad ${rad}`);
      n++;
    }
  }
  assert.ok(n > 50000);
});
t("tham số rad bỏ trống = 0", () => {
  const [x, z] = at(80, 3);
  assert.equal(inCone(x, z, 0, 1, 3.4, 150), false);
  assert.equal(inCone(...at(70, 3), 0, 1, 3.4, 150), true);
});

console.log("inCone — bề ngang thân");
t("tâm ngoài nón nhưng thân chạm mép thì trúng: cung kỵ (1 m) lệch 85° ở 3 m, nón N1 150° (nửa 75°)", () => {
  const [x, z] = at(85, 3), N1 = MOVES.N1;
  assert.equal(oldCone(x, z, 0, 1, N1.range, N1.arc, HIT_R.mounted), false, "luật cũ: chém xuyên");
  assert.equal(inCone(x, z, 0, 1, N1.range, N1.arc, HIT_R.mounted), true);
});
t("bộ binh (0,4 m) cùng chỗ thì vẫn trượt: thân không chạm mép (cách mép 3·sin10° ≈ 0,52 m)", () => {
  const [x, z] = at(85, 3);
  assert.equal(inCone(x, z, 0, 1, MOVES.N1.range, MOVES.N1.arc, HIT_R.foot), false);
});
t("nới đúng nửa bề ngang thân: mép mới ở 75° + atan2(rad, d), hai bên đều", () => {
  const d = 3, edge = 75 + Math.atan2(HIT_R.mounted, d) / RAD;
  for (const s of [1, -1]) {
    assert.equal(inCone(...at(s * (edge - 0.2), d), 0, 1, 3.4, 150, HIT_R.mounted), true, "trong mép " + s);
    assert.equal(inCone(...at(s * (edge + 0.2), d), 0, 1, 3.4, 150, HIT_R.mounted), false, "ngoài mép " + s);
  }
});
t("người càng xa thì phần nới càng hẹp (cùng thân 1 m): 3 m nới ~18°, 4 m ~14°", () => {
  assert.equal(inCone(...at(90, 3), 0, 1, 4.5, 150, 1), true);
  assert.equal(inCone(...at(90, 4), 0, 1, 4.5, 150, 1), false);
});
t("theo hướng mặt bất kỳ (không chỉ +z)", () => {
  const yaw = 2.1, fx = Math.sin(yaw), fz = Math.cos(yaw), a = yaw + 85 * RAD;
  assert.equal(inCone(Math.sin(a) * 3, Math.cos(a) * 3, fx, fz, 3.4, 150, 1), true);
  assert.equal(inCone(Math.sin(a) * 3, Math.cos(a) * 3, fx, fz, 3.4, 150, 0.4), false);
});

console.log("inCone — sát tướng, tầm, nửa góc ≥ 180°");
t("d < 0,8 m: trúng mọi hướng (kể cả sau lưng), như cũ", () => {
  for (const deg of [0, 90, 180, -135]) assert.equal(inCone(...at(deg, 0.79), 0, 1, 3.4, 120, 0), true, String(deg));
  assert.equal(inCone(...at(180, 0.81), 0, 1, 3.4, 120, 0.4), false, "sau lưng ở 0,81 m, nón 120°: trượt");
});
t("tầm + rad: thẳng trước mặt trúng tới đúng reach + rad, quá là trượt", () => {
  for (const rad of [0, 0.4, 1]) {
    assert.equal(inCone(...at(0, 3.4 + rad - 0.01), 0, 1, 3.4, 150, rad), true, "trong " + rad);
    assert.equal(inCone(...at(0, 3.4 + rad + 0.01), 0, 1, 3.4, 150, rad), false, "ngoài " + rad);
  }
});
t("ở mép tầm, lệch góc thì phần nới vẫn tính (không trúng ngoài tầm vì nới góc)", () => {
  assert.equal(inCone(...at(80, 4.3), 0, 1, 3.4, 150, 1), true);
  assert.equal(inCone(...at(80, 4.5), 0, 1, 3.4, 150, 1), false);
});
t("nửa góc đã nới ≥ 180° thì trúng mọi hướng trong tầm (không quay vòng cos)", () => {
  // nón 300° (nửa 150°) + thân 1 m ở 1 m (atan2 = 45°) → 195°: người ngay sau lưng vẫn chạm
  assert.equal(inCone(...at(180, 1), 0, 1, 3, 300, 1), true);
  assert.equal(inCone(...at(180, 1), 0, 1, 3, 300, 0), false, "không có thân thì 150° < 180°");
  assert.equal(inCone(...at(180, 4.5), 0, 1, 3, 300, 1), false, "ngoài tầm vẫn trượt");
});
t("thuần: không đọc Math.random", () => { assert.ok(!/random/.test(inCone.toString())); });

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
