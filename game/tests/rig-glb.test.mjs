// tests/rig-glb.test.mjs — đợt 19a: rig khớp nối mang thân GLB (models.js makeRig + rig-motion.js) theo số đo của chính mô hình:
// tay trái nắm chuôi (gripIK) giải IK theo độ dài tay của rig (khớp lúc chạy = khung gắn của mô hình, không còn tay mặc định
// 0,34 + 0,36 của tư thế WC01), tay phải đại kiếm giải lại mỗi khung theo số đo đó (anim-wc01.js fitArms: cổ tay trong tầm với,
// điểm nắm trong tầm tay trái, cả thanh gươm (núm chuôi … mũi, hai bàn tay) tránh lưới mặt của mẫu (headShape: mũ, mặt, cổ, râu) — kiểm trên số đo
// thật của H31, lính Tự do LINH_r01 / LINH_r24 đọc từ tệp nướng), đế giày theo rig.foot (thân GLB: meta.foot — trước đây lưới lơ lửng 3–5 cm vì IK đặt đế khối 0,08 dưới cổ chân). Rig
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
const { makeRig, LEG, headOf } = await import("../js/battle/models.js");
const { parseHKM } = await import("../js/battle/glb.js");
const { RigMotion } = await import("../js/battle/rig-motion.js");
const A = await import("../js/battle/anim.js");
const W1 = await import("../js/battle/anim-wc01.js");
const { HERO_ANIM } = await import("../js/battle/hero-anim.js");
const { driveQuat } = await import("../js/battle/rig-helpers.js");

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

console.log("Lưới đầu (anim-wc01.js headShape, fitGeo)");
t("headShape: đỉnh có xương nặng nhất là đầu, trừ khớp đầu, mỗi vị trí một lần; shell = trung vị khoảng cách tâm sọ; không đỉnh đầu → null", () => {
  const hp = [0, 1.6, 0], c = [hp[0] + W1.FIT.skull[0], hp[1] + W1.FIT.skull[1], hp[2] + W1.FIT.skull[2]], pos = [], si = [], sw = [];
  const put = (p, b, w = 255) => { pos.push(...p); si.push(b, 1, 0, 0); sw.push(w, 255 - w, 0, 0); };
  for (const r of [0.1, 0.12, 0.15, 0.2, 0.3]) put([c[0] + r, c[1], c[2]], 2);
  put([c[0] + 0.15, c[1], c[2]], 2);
  put([c[0], c[1] - 0.01, c[2]], 1);
  put([c[0] + 0.05, c[1], c[2]], 2, 100);
  const r = W1.headShape(Float32Array.from(pos), Uint8Array.from(si), Uint8Array.from(sw), 2, hp);
  assert.ok(Math.abs(r.shell - 0.15) < 1e-6, `vỏ ${r.shell}`);
  assert.equal(r.pts.length, 15);
  assert.ok(Math.abs(r.pts[0] - 0.1) < 1e-6 && Math.abs(r.pts[1] - W1.FIT.skull[1]) < 1e-6);
  assert.equal(W1.headShape(new Float32Array(3), new Uint8Array(4), Uint8Array.from([255, 0, 0, 0]), 2, hp).pts, null);
});
t("headShape có xương cổ: thêm đỉnh mà đầu + cổ nặng ≥ nửa trong |x| ≤ FIT.nx quanh khớp đầu (cổ, râu theo thân, cổ áo); vai, đỉnh xa, đỉnh nhẹ thì không; shell vẫn chỉ từ đỉnh theo đầu", () => {
  const hp = [0, 1.6, 0], pos = [], si = [], sw = [];
  const put = (p, idx, w) => { pos.push(...p); si.push(...idx); sw.push(...w); };
  put([0, 1.75, 0.1], [2, 0, 0, 0], [255, 0, 0, 0]);              // đầu
  put([0, 1.57, 0.1], [1, 3, 2, 0], [115, 90, 50, 0]);            // râu: thân nặng nhất, cổ + đầu 140 / 255
  put([0.05, 1.55, 0], [3, 1, 0, 0], [200, 55, 0, 0]);            // cổ
  put([0.25, 1.55, 0], [3, 1, 0, 0], [200, 55, 0, 0]);            // đầu vai (ngoài FIT.nx)
  put([0, 1.5, 0.1], [1, 3, 0, 0], [200, 55, 0, 0]);              // ngực: cổ 55 / 255
  const r = W1.headShape(Float32Array.from(pos), Uint8Array.from(si), Uint8Array.from(sw), 2, hp, 3);
  assert.equal(r.pts.length, 9);
  assert.ok(Math.abs(r.pts[4] - (1.57 - 1.6)) < 1e-6 && Math.abs(r.pts[7] - (1.55 - 1.6)) < 1e-6);
  const c = [hp[0] + W1.FIT.skull[0], hp[1] + W1.FIT.skull[1], hp[2] + W1.FIT.skull[2]];
  assert.ok(Math.abs(r.shell - Math.hypot(0 - c[0], 1.75 - c[1], 0.1 - c[2])) < 1e-6, `vỏ ${r.shell}`);
  assert.equal(W1.headShape(Float32Array.from(pos), Uint8Array.from(si), Uint8Array.from(sw), 2, hp).pts.length, 3);
});
t("handPts: đỉnh theo bàn tay phải trong khung bàn tay (ma trận gắn nghịch đảo), ngoài lõi nắm tay quanh cán (> 0,03), mỗi ô FIT.hc một đỉnh", () => {
  const inv = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.3, -1.0, -0.1, 1], pos = [], si = [], sw = [];
  const put = (p, b) => { pos.push(...p); si.push(b, 0, 0, 0); sw.push(255, 0, 0, 0); };
  put([0.3, 1.0, 0.1], 8);                                         // ở cổ tay: lõi nắm tay
  put([0.3, 0.9, 0.12], 8); put([0.304, 0.902, 0.121], 8);         // đầu ngón và một đỉnh cùng ô
  put([0.37, 0.95, 0.1], 8);                                       // đốt tay bên cạnh
  put([0.3, 0.8, 0.1], 7);                                         // cẳng tay: xương khác
  const r = W1.handPts(Float32Array.from(pos), Uint8Array.from(si), Uint8Array.from(sw), 8, inv);
  assert.equal(r.length, 6);
  assert.ok(Math.abs(r[0]) < 1e-6 && Math.abs(r[1] + 0.1) < 1e-6 && Math.abs(r[2] - 0.02) < 1e-6, `ngón ${Array.from(r.slice(0, 3))}`);
  assert.ok(Math.abs(r[3] - 0.07) < 1e-6 && Math.abs(r[4] + 0.05) < 1e-6);
  assert.equal(W1.handPts(Float32Array.from(pos), Uint8Array.from(si), Uint8Array.from(sw), 3, inv), null);
});
t("fitGeo: lưới đầu + núm chuôi vào số đo; không lưới đầu thì vỏ tâm sọ như cũ (sr = max(FIT.sr, vỏ + FIT.hm))", () => {
  const rig = makeRig({ weapon: "daikiem" });
  rig.p.elR.position.set(0, -0.25, 0); rig.p.handR.position.set(0, -0.22, 0.01);
  const pts = new Float32Array([0, 0.1, 0.1]);
  const g = W1.fitGeo(rig.p, { guard: 0.07, tip: 1.14, butt: -0.41 }, { shell: 0.157, pts });
  assert.equal(g.pts, pts); assert.equal(g.butt, -0.41); assert.deepEqual(g.blade, [0.07, 1.14]);
  assert.ok(Math.abs(g.sr - (0.157 + W1.FIT.hm)) < 1e-9);
  assert.equal(W1.fitGeo(rig.p, null, null).sr, W1.FIT.sr);
  assert.equal(W1.fitGeo(rig.p, null, null).pts, null);
});

// Số đo thật của thân GLB (meta.rest trong tệp nướng: vai, khuỷu, cổ tay, cổ — khung cha) và gươm GLB (chắn tay, mũi).
const MD = new URL("../assets/models/", import.meta.url);
const hkm = (rel) => { const b = readFileSync(new URL(rel, MD)); return parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const DKM = hkm("wpn/daikiem.hkm"), DK = DKM.meta;
// như models.js lane(): chắn tay, mũi, núm chuôi, mút chắn tay
const BLADE = { guard: DK.guard ?? 0.07, tip: DK.hi[2], butt: DK.lo[2], gp: W1.guardPts(DKM.geos.body.attributes.position.array) };
// Như makeRig với thân GLB: khớp theo meta.rest, gươm GLB, lưới đầu từ lưới thân (models.js headOf).
function glbRig(id) {
  const b = readFileSync(new URL(`char/${id}.hkm`, MD)), M = parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const r = M.meta.rest, rig = makeRig({ weapon: "daikiem" });
  for (const k of ["shL", "elL", "handL", "shR", "elR", "handR", "head"]) rig.p[k].position.set(r[k][0], r[k][1], r[k][2]);
  rig.dyn.blade = BLADE; rig.dyn.head = headOf(M);
  return rig;
}
// Lưới mặt (headShape: đỉnh theo đầu cùng cổ, râu, cổ áo; cứng theo khung đầu) → trục gươm: khoảng cách nhỏ nhất tới đoạn chuôi (núm …
// chắn tay: hai bàn tay) và tới cả thanh (núm … mũi), đơn vị rig.
function headGap(rig) {
  const P = rig.dyn.head.pts, mh = rig.p.head.matrixWorld, m = rig.p.handR.matrixWorld, s = rig.scale;
  const seg = (z0, z1) => { const a = new THREE.Vector3(0, 0, z0).applyMatrix4(m), ab = new THREE.Vector3(0, 0, z1).applyMatrix4(m).sub(a); return [a, ab]; };
  const H = seg(BLADE.butt, BLADE.guard), S = seg(BLADE.butt, BLADE.tip), q = new THREE.Vector3();
  const d = ([a, ab]) => { const t = Math.max(0, Math.min(1, q.clone().sub(a).dot(ab) / ab.lengthSq())); return a.clone().addScaledVector(ab, t).distanceTo(q) / s; };
  let hand = 9, sword = 9;
  for (let i = 0; i < P.length; i += 3) { q.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(mh); hand = Math.min(hand, d(H)); sword = Math.min(sword, d(S)); }
  return { hand, sword };
}
// Khung chuyển giữa đòn hai tay và một tay (0,5 ≤ grip < 1, vd Binh Thư vào / ra): gripIK trộn tay trái với tay buông của tư thế theo
// kênh grip — rig khối cũng hụt chừng đó; thân GLB không hụt hơn rig khối quá 1 cm.
// Lưới mặt (mũ, mặt, cổ, râu) cách trục cả thanh gươm ≥ 0,055 (nửa bản lưỡi 0,047 + khe: lưỡi không xuyên mũ), cách đoạn chuôi (hai bàn
// tay) ≥ 0,055; khung mà cổ tay gập thêm cho mũi khỏi cắm đất (rig-motion.js fixBlades, lộn né: góc cổ tay khác lời giải fitArms) chỉ cần
// ≥ 0,047 — đất trước, lưỡi vẫn không cắt vào lưới. Soát lần 2: lính Tự do LINH_r01 hai tay cách mặt 0,5–0,6 cm, chuôi 1,8 cm (chuôi trong
// miệng); vành mũ LINH_r24, cánh mũ H31 sượt lưỡi 0,4–0,8 cm — trước đó chỉ đo lưỡi với quả cầu quanh tâm sọ.
t("thân GLB thật (H31, lính Tự do LINH_r01 / LINH_r24): mọi đòn WC01, u = 0…0,95 — tay trái tới điểm nắm (≤ 1 cm) khi grip = 1 (khung chuyển ≤ rig khối + 1 cm), lưới mặt cách cả thanh gươm và hai bàn tay ≥ 0,055", () => {
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
      const hg = headGap(rig), bent = Math.abs(W1.fitArms(pose, m.fit, {}).handRx - rig.p.handR.rotation.x) > 1e-3;
      if (hg.sword < (bent ? 0.047 : 0.055)) bad.push(`${id} ${k}@${u.toFixed(2)} gươm cách lưới mặt ${hg.sword.toFixed(3)} (chuôi ${hg.hand.toFixed(3)}${bent ? ", cổ tay gập theo đất" : ""})`);
    }
  }
  assert.ok(!bad.length, `${bad.length} khung: ${bad.slice(0, 14).join("; ")}`);
});
// Gọi liên tục như rig-motion.js (cùng đối tượng ra, dt > 0), bước u 0,01 qua mọi đòn WC01: khuỷu phải không nhảy > 0,22 m giữa hai bước
// khi khuỷu tư thế đi < 0,05 m, lưỡi sắc (trục y bàn tay) không quay hơn tư thế quá 100° — bàn tay không lật. Đo đợt soát 19a lần 2 với
// bản 18ce9b8: khuỷu lính Tự do nhảy 0,25–0,36 m (N1, DN, CT: phía khuỷu cổ tay gập 150–190°), bàn tay lật 180° (31 khung / 60 khung một
// giây; gọi rời từng khung nay 82).
t("fitArms gọi liên tục (thân GLB thật): khuỷu không nhảy, bàn tay không lật giữa hai bước u 0,01", () => {
  const bad = [], ref = makeRig({ weapon: "daikiem" });
  const frame = (rig, q) => {
    rig.p.shR.rotation.set(q.shRx, q.shRy, q.shRz); rig.p.elR.rotation.set(q.elRx, 0, 0); rig.p.handR.rotation.set(q.handRx, 0, q.handRz);
    rig.root.updateMatrixWorld(true);
    const T = rig.p.torso.matrixWorld.clone().invert();
    return { el: wpos(rig.p.elR).applyMatrix4(T), E: new THREE.Vector3(0, 1, 0).transformDirection(rig.p.handR.matrixWorld).transformDirection(T) };
  };
  for (const id of ["H31", "LINH_r01", "LINH_r24"]) {
    const rig = glbRig(id), g = W1.fitGeo(rig.p, BLADE, rig.dyn.head), o = {};
    for (const [k, f] of Object.entries(W1.HERO_ANIM_WC01)) {
      let prev = null;
      for (let i = 0; i <= 100; i++) {
        const p = f(i / 100), F = frame(rig, W1.fitArms(p, g, o, i ? 1 / 60 : 0)), Z = frame(ref, p);
        if (prev) {
          const de = F.el.distanceTo(prev.F.el), de0 = Z.el.distanceTo(prev.Z.el), dr = (F.E.angleTo(prev.F.E) - Z.E.angleTo(prev.Z.E)) * 180 / Math.PI;
          if (de > 0.22 && de0 < 0.05) bad.push(`${id} ${k}@${(i / 100).toFixed(2)} khuỷu nhảy ${de.toFixed(2)} m`);
          if (dr > 100) bad.push(`${id} ${k}@${(i / 100).toFixed(2)} bàn tay lật ${dr.toFixed(0)}°`);
        }
        prev = { F, Z };
      }
    }
  }
  assert.ok(!bad.length, `${bad.length} bước: ${bad.slice(0, 12).join("; ")}`);
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

// Đường tách tam giác cầu (human.mjs splitBridges: đỉnh song sinh cùng vị trí gắn, mỗi bản theo một phía) không được hở khi hai phía
// rời nhau: OFF_tuong (đợt 19a soát lần 2) tách tay khỏi vạt áo, gầm, ult hở 0,25–0,68 m — tay, cổ tay áo lơ lửng cạnh đầu. Da tính như
// glb.js (khớp rig khối đặt theo meta.rest, xương phụ theo bộ dẫn), tư thế đặc trưng của lab (đứng, gầm, Tuyệt Kỹ, chém nặng, quét, C1,
// chạy), mỗi cặp đỉnh song sinh hở ≤ 3 cm. Tệp giữ bản cũ (catalog keep, 15 khớp) không có đường tách.
console.log("Đường tách tam giác cầu (đỉnh song sinh)");
const SIGN = [["idle", 0, (u) => A.idle(0)], ["roar", 0.5, (u) => A.roar(u)], ["ult", 0.3, (u) => A.heavyChop(u / 0.45 * 0.5, 0.9)],
  ["ult", 0.7, (u) => A.spin((u - 0.45) / 0.55, 2)], ["heavy", 0.45, (u) => A.heavyChop(u, 0.4, false)], ["sweep", 0.4, (u) => A.sweep(u)],
  ["C1", 0.4, (u) => HERO_ANIM.C1(u)], ["run", 0.25, (u) => A.run(u * 2 * Math.PI, 1, 0.95)], ["dodge", 0.5, (u) => A.dodgeRoll(u)]];
const PAR15 = { hips: null, torso: "hips", head: "torso", shL: "torso", elL: "shL", handL: "elL", shR: "torso", elR: "shR", handR: "elR",
  hipL: "hips", kneeL: "hipL", ankleL: "kneeL", hipR: "hips", kneeR: "hipR", ankleR: "kneeR" };
// Ma trận thế giới mỗi xương của meta.bones (khớp: rig.p; xương phụ: cha × (gốc meta.rest, bộ dẫn của góc cục bộ khớp nguồn))
function boneWorld(rig, meta) {
  const W = {}, o = [0, 0, 0, 0], q = new THREE.Quaternion(), pp = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const n of meta.bones) {
    if (!meta.parent?.[n]) { W[n] = rig.p[n].matrixWorld; continue; }
    const [src, kind, share] = meta.drive[n], loc = new THREE.Matrix4().copy(rig.p[PAR15[src]].matrixWorld).invert().multiply(rig.p[src].matrixWorld);
    loc.decompose(pp, q, sc); driveQuat(kind, share, q.x, q.y, q.z, q.w, o);
    const r = meta.rest[n];
    W[n] = new THREE.Matrix4().multiplyMatrices(rig.p[meta.parent[n]].matrixWorld, new THREE.Matrix4().compose(new THREE.Vector3(r[0], r[1], r[2]), new THREE.Quaternion(o[0], o[1], o[2], o[3]), new THREE.Vector3(1, 1, 1)));
  }
  return meta.bones.map((n, i) => new THREE.Matrix4().multiplyMatrices(W[n], new THREE.Matrix4().fromArray(meta.inv, i * 16)));
}
t("tệp nướng thân GLB: đỉnh song sinh của đường tách hở ≤ 3 cm ở 9 tư thế đặc trưng (đứng, gầm, Tuyệt Kỹ ×2, chém nặng, quét, C1, chạy, né)", () => {
  const IDX = JSON.parse(readFileSync(new URL("index.json", MD), "utf8")), bad = [], seen = [];
  for (const id of Object.keys(IDX).filter((k) => k.startsWith("char/")).map((k) => k.slice(5)).sort()) {
    const b = readFileSync(new URL(`char/${id}.hkm`, MD)), M = parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)), meta = M.meta;
    const A3 = M.geos.body.attributes, P = A3.position.array, SI = A3.skinIndex.array, SW = A3.skinWeight.array, n = P.length / 3;
    const at = new Map(), pairs = [];
    for (let v = 0; v < n; v++) { const k = `${Math.round(P[v * 3] * 2000)},${Math.round(P[v * 3 + 1] * 2000)},${Math.round(P[v * 3 + 2] * 2000)}`; (at.get(k) || at.set(k, []).get(k)).push(v); }
    const sameSkin = (a, c) => { for (let k = 0; k < 4; k++) if (SI[a * 4 + k] !== SI[c * 4 + k] || Math.abs(SW[a * 4 + k] - SW[c * 4 + k]) > 2) return false; return true; };
    for (const vs of at.values()) for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) if (!sameSkin(vs[i], vs[j])) pairs.push([vs[i], vs[j]]);
    if (!pairs.length) continue;
    seen.push(`${id} ${pairs.length}`);
    const rig = makeRig({ weapon: "dao" }), m = new RigMotion(rig);
    for (const k of Object.keys(PAR15)) if (k !== "hips" && meta.rest[k]) rig.p[k].position.set(...meta.rest[k]);
    const v = new THREE.Vector3(), w = new THREE.Vector3(), skin = (B, i, out) => {
      out.set(0, 0, 0);
      for (let k = 0; k < 4; k++) { const wt = SW[i * 4 + k] / 255; if (wt) out.addScaledVector(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(B[SI[i * 4 + k]]), wt); }
      return out;
    };
    let worst = 0, where = "";
    for (const [mode, u, f] of SIGN) {
      for (let s = 0; s < 3; s++) step(rig, m, f(u));
      const B = boneWorld(rig, meta), a = new THREE.Vector3(), c = new THREE.Vector3();
      for (const [x, y] of pairs) { const d = skin(B, x, a).distanceTo(skin(B, y, c)) / rig.scale; if (d > worst) { worst = d; where = `${mode}@${u}`; } }
    }
    if (worst > 0.03) bad.push(`${id}: ${pairs.length} cặp, hở ${worst.toFixed(3)} m ở ${where}`);
  }
  assert.ok(!bad.length, bad.join("; "));
  if (seen.length) console.log("       có đường tách: " + seen.join(", "));
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
