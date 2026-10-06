// tests/rig-glb.test.mjs — đợt 19a: rig khớp nối mang thân GLB (models.js makeRig + rig-motion.js) theo số đo của chính mô hình:
// tay trái nắm chuôi (gripIK) giải IK theo độ dài tay của rig (khớp lúc chạy = khung gắn của mô hình, không còn tay mặc định
// 0,34 + 0,36 của tư thế WC01), tay phải đại kiếm giải lại mỗi khung theo số đo đó (anim-wc01.js fitArms: cổ tay trong tầm với,
// điểm nắm trong tầm tay trái, lưỡi không sượt sọ, không xuyên mũ (vỏ đầu headShell từ lưới thân) — kiểm trên số đo thật
// của H31, lính Tự do LINH_r01 / LINH_r24 đọc từ tệp nướng), đế giày theo rig.foot (thân GLB: meta.foot — trước đây lưới lơ lửng 3–5 cm vì IK đặt đế khối 0,08 dưới cổ chân). Rig
// khối (không mô hình) giữ đúng như cũ.
//   node game/tests/rig-glb.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const THREE = await import("three");
const { makeRig, LEG, shellOf } = await import("../js/battle/models.js");
const { parseHKM } = await import("../js/battle/glb.js");
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

console.log("Vỏ đầu (anim-wc01.js headShell, fitGeo)");
t("headShell: trung vị khoảng cách tâm sọ (khớp đầu + FIT.skull) → đỉnh có xương nặng nhất là đầu; đỉnh xương khác không tính", () => {
  const hp = [0, 1.6, 0], c = [hp[0] + W1.FIT.skull[0], hp[1] + W1.FIT.skull[1], hp[2] + W1.FIT.skull[2]], pos = [], si = [], sw = [];
  const put = (p, b, w = 255) => { pos.push(...p); si.push(b, 1, 0, 0); sw.push(w, 255 - w, 0, 0); };
  for (const r of [0.1, 0.12, 0.15, 0.2, 0.3]) put([c[0] + r, c[1], c[2]], 2);
  put([c[0], c[1] - 0.01, c[2]], 1);
  put([c[0] + 0.05, c[1], c[2]], 2, 100);
  const r = W1.headShell(Float32Array.from(pos), Uint8Array.from(si), Uint8Array.from(sw), 2, hp);
  assert.ok(Math.abs(r - 0.15) < 1e-6, `vỏ ${r}`);
  assert.equal(W1.headShell(new Float32Array(3), new Uint8Array(4), Uint8Array.from([255, 0, 0, 0]), 2, hp), 0);
});
t("fitGeo: vỏ đầu to (mũ GLB) nâng khoảng lưỡi cách tâm sọ lên vỏ + FIT.hm; đầu nhỏ giữ FIT.sr", () => {
  const rig = makeRig({ weapon: "daikiem" });
  rig.p.elR.position.set(0, -0.25, 0); rig.p.handR.position.set(0, -0.22, 0.01);
  assert.equal(W1.fitGeo(rig.p, null, 0).sr, W1.FIT.sr);
  assert.equal(W1.fitGeo(rig.p, null, W1.FIT.sr - W1.FIT.hm - 0.01).sr, W1.FIT.sr);
  assert.ok(Math.abs(W1.fitGeo(rig.p, null, 0.157).sr - (0.157 + W1.FIT.hm)) < 1e-9);
});

// Số đo thật của thân GLB (meta.rest trong tệp nướng: vai, khuỷu, cổ tay, cổ — khung cha) và gươm GLB (chắn tay, mũi).
const MD = new URL("../assets/models/", import.meta.url);
const metaOf = (rel) => { const b = readFileSync(new URL(rel, MD)); return JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + b.readUInt32LE(4)))); };
const DK = metaOf("wpn/daikiem.hkm"), BLADE = { guard: DK.guard ?? 0.07, tip: DK.hi[2] };
// Như makeRig với thân GLB: khớp theo meta.rest, lưỡi gươm GLB, vỏ đầu từ lưới thân (models.js shellOf).
function glbRig(id) {
  const b = readFileSync(new URL(`char/${id}.hkm`, MD)), M = parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const r = M.meta.rest, rig = makeRig({ weapon: "daikiem" });
  for (const k of ["shL", "elL", "handL", "shR", "elR", "handR", "head"]) rig.p[k].position.set(r[k][0], r[k][1], r[k][2]);
  rig.dyn.blade = BLADE; rig.dyn.shell = shellOf(M);
  return rig;
}
// Tâm sọ (khung đầu (0; 0,13; 0,03), như số đo của đợt soát 19a) → đoạn lưỡi (khung bàn tay phải z chắn tay … mũi), đơn vị rig.
function skullGap(rig, z0, z1) {
  const c = new THREE.Vector3(0, 0.13, 0.03).applyMatrix4(rig.p.head.matrixWorld), m = rig.p.handR.matrixWorld;
  const a = new THREE.Vector3(0, 0, z0).applyMatrix4(m), b = new THREE.Vector3(0, 0, z1).applyMatrix4(m), ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, c.clone().sub(a).dot(ab) / ab.lengthSq()));
  return a.addScaledVector(ab, t).distanceTo(c) / rig.scale;
}
// Khung chuyển giữa đòn hai tay và một tay (0,5 ≤ grip < 1, vd Binh Thư vào / ra): gripIK trộn tay trái với tay buông của tư thế theo
// kênh grip — rig khối cũng hụt chừng đó; thân GLB không hụt hơn rig khối quá 1 cm.
t("thân GLB thật (H31, lính Tự do LINH_r01 / LINH_r24): mọi đòn WC01, u = 0…0,95 — tay trái tới điểm nắm (≤ 1 cm) khi grip = 1 (khung chuyển ≤ rig khối + 1 cm), lưỡi cách tâm sọ ≥ 0,12 và ≥ vỏ đầu + 0,02 (mũ H31 vỏ 0,157: trước đây lưỡi qua đầu cách tâm sọ đúng 0,12, xuyên mũ ở C1, C4, C6, DQ, ult, N3)", () => {
  const bad = [], ref = makeRig({ weapon: "daikiem" }), mr = new RigMotion(ref), P = W1.POSES_WC01;
  const ALL = { ...W1.HERO_ANIM_WC01, idle: (u) => P.idle(u * 3), run: (u) => P.run(u * 2 * Math.PI, 1, 0.95), block: () => P.block,
    hit: (u) => P.hitReact(u), dodge: (u) => P.dodgeRoll(u), down: (u) => P.knockdown(u) };
  for (const id of ["H31", "LINH_r01", "LINH_r24"]) {
    const rig = glbRig(id), m = new RigMotion(rig);
    for (const [k, f] of Object.entries(ALL)) for (let i = 0; i < 20; i++) {
      const u = i * 0.05, pose = f(u);
      step(rig, m, pose);
      if (pose.grip >= 0.5) {
        const e = gripErr(rig).err;
        let lim = 0.01; if (pose.grip < 0.999) { step(ref, mr, pose); lim += gripErr(ref).err; }
        if (e > lim) bad.push(`${id} ${k}@${u.toFixed(2)} tay trái hụt ${e.toFixed(3)} (grip ${pose.grip.toFixed(2)})`);
      }
      const g = skullGap(rig, BLADE.guard, BLADE.tip);
      if (g < Math.max(0.12, rig.dyn.shell + 0.02)) bad.push(`${id} ${k}@${u.toFixed(2)} lưỡi cách sọ ${g.toFixed(3)} (vỏ đầu ${rig.dyn.shell.toFixed(3)})`);
    }
  }
  assert.ok(!bad.length, `${bad.length} khung: ${bad.slice(0, 14).join("; ")}`);
});
t("rig khối (tay đúng số tư thế 0,34 + 0,36, vai ±0,3): không giải lại tay phải — góc khớp đúng tư thế", () => {
  const rig = makeRig({ weapon: "daikiem" }), m = new RigMotion(rig);
  for (const [k, f] of Object.entries(W1.HERO_ANIM_WC01)) for (const u of [0.1, 0.3, 0.5]) {
    const pose = f(u);
    step(rig, m, pose);
    const s = rig.p.shR.rotation;
    assert.deepEqual([s.x, s.y, s.z, rig.p.elR.rotation.x], [pose.shRx, pose.shRy, pose.shRz, pose.elRx], `${k}@${u}`);
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
