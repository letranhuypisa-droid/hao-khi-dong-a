// tests/rig-glb.test.mjs — đợt 19a: rig khớp nối mang thân GLB (models.js makeRig + rig-motion.js) theo số đo của chính mô hình:
// tay trái nắm chuôi (gripIK) giải IK theo độ dài tay của rig (khớp lúc chạy = khung gắn của mô hình, không còn tay mặc định
// 0,34 + 0,36 của tư thế WC01), đế giày theo rig.foot (thân GLB: meta.foot — trước đây lưới lơ lửng 3–5 cm vì IK đặt đế khối
// 0,08 dưới cổ chân). Rig khối (không mô hình) giữ đúng như cũ.
//   node game/tests/rig-glb.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const THREE = await import("three");
const { makeRig, LEG } = await import("../js/battle/models.js");
const { RigMotion } = await import("../js/battle/rig-motion.js");
const A = await import("../js/battle/anim.js");
const W1 = await import("../js/battle/anim-wc01.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}
const flat = () => 0;
const wpos = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

// Một khung: đặt tư thế, chạy chuyển động phụ (lượt đầu: dựng tức thời), cập nhật ma trận.
function step(rig, motion, pose) {
  A.applyPose(rig, pose);
  rig.root.updateMatrixWorld(true);
  motion.update(1 / 60, pose, flat);
  rig.root.updateMatrixWorld(true);
}
// Sai số tay trái → điểm nắm chuôi (dyn.grip), đơn vị rig; kèm tỉ lệ khoảng cách vai trái → điểm nắm / dài tay.
function gripErr(rig) {
  const g = rig.dyn.grip.local.clone().applyMatrix4(rig.dyn.grip.j.matrixWorld), h = wpos(rig.p.handL), sh = wpos(rig.p.shL);
  const L = (rig.p.elL.position.length() + rig.p.handL.position.length()) * rig.scale;
  return { err: h.distanceTo(g) / rig.scale, reach: sh.distanceTo(g) / L };
}

console.log("Tay trái nắm chuôi (rig-motion.js gripIK)");
t("rig khối (tay 0,34 + 0,36): tay trái tới điểm nắm như trước (≤ 1 mm) ở thế thủ WC01", () => {
  const rig = makeRig({ weapon: "daikiem" }), m = new RigMotion(rig);
  step(rig, m, W1.GUARD);
  const e = gripErr(rig);
  assert.ok(e.err < 1e-3, `sai ${e.err.toFixed(4)} (tầm ${e.reach.toFixed(2)})`);
});
t("thân GLB tay ngắn (khớp lúc chạy theo mô hình, hai tay 0,27–0,31): tay trái vẫn tới điểm nắm (≤ 1 mm)", () => {
  for (const [L1, L2, sx] of [[0.29, 0.28, 0.24], [0.27, 0.3, 0.22], [0.31, 0.27, 0.28]]) {
    const rig = makeRig({ weapon: "daikiem" });
    for (const [s, sg] of [["L", -1], ["R", 1]]) {
      rig.p["sh" + s].position.set(sx * sg, 0.52, -0.02); rig.p["el" + s].position.set(0, -L1, 0); rig.p["hand" + s].position.set(0, -L2, 0);
    }
    const m = new RigMotion(rig);
    step(rig, m, W1.GUARD);
    const e = gripErr(rig);
    assert.ok(e.reach < 0.98, `điểm nắm ngoài tầm với (${e.reach.toFixed(2)}) — đổi số thử`);
    assert.ok(e.err < 1e-3, `tay ${L1}/${L2}: sai ${e.err.toFixed(4)} m (tầm ${e.reach.toFixed(2)})`);
  }
});

console.log("Đế giày (rig-motion.js legIK theo rig.foot)");
t("đứng (hông hạ 0,08) trên đất phẳng: cổ chân cao đúng rig.foot.sole (rig khối 0,08; thân GLB theo meta.foot, vd 0,05)", () => {
  for (const sole of [LEG.sole, 0.05, 0.045]) {
    const rig = makeRig({});
    rig.foot = { ...LEG, sole, toe: 0.15, heel: -0.08, footZ: 0.035 };
    const m = new RigMotion(rig);
    step(rig, m, A.P({ hipsY: -0.08 }));
    for (const s of ["L", "R"]) {
      const y = wpos(rig.p["ankle" + s]).y / rig.scale;
      assert.ok(Math.abs(y - sole) < 3e-3, `đế ${sole}: cổ chân ${s} cao ${y.toFixed(4)}`);
    }
  }
});
t("rig khối không có rig.foot riêng: dùng LEG như cũ", () => {
  const rig = makeRig({});
  assert.deepEqual(rig.foot, LEG);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
