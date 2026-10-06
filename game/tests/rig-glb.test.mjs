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
const { MOVES_WC01 } = await import("../js/data/moves-wc01.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}
const flat = () => 0;
const wpos = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

// Một khung: đặt tư thế, chạy chuyển động phụ (lượt đầu: dựng tức thời; o.snap: dựng lại như khung đầu), cập nhật ma trận.
function step(rig, motion, pose, o = undefined) {
  A.applyPose(rig, pose);
  rig.root.updateMatrixWorld(true);
  motion.update(1 / 60, pose, flat, o);
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
// Bảng khoảng cách của lưới mặt (anim-wc01.js distGrid, soát 19a lần 3: lan "điểm gần nhất" qua 26 ô kề thay cho rải mỗi đỉnh vào mọi ô
// trong bán kính FIT.gm — dựng mỗi rig WC01 65–104 ms): mọi nút bảng so với duyệt hết các đỉnh (cắt ở FIT.gm) — sai ≤ 1,5 mm ở nút cách
// đỉnh < 10 cm (khe lớn nhất fitArms dùng: 9 cm), ≤ 2,5 mm mọi nút. Gieo mỗi đỉnh vào 8 ô quanh nó (bản đầu) thì sai 5,7–6,7 mm.
t("headShape grid (distGrid): khoảng cách tới đỉnh gần nhất ở mọi nút bảng như duyệt hết (cắt ở FIT.gm), sai ≤ 1,5 mm trong 10 cm, ≤ 2,5 mm mọi nút", () => {
  const hp = [0, 1.6, 0], pos = [], si = [], sw = [];
  let s = 7;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 800; i++) {
    const a = rnd() * Math.PI * 2, b = Math.acos(2 * rnd() - 1), r = 0.09 + 0.03 * rnd();
    pos.push(hp[0] + r * Math.sin(b) * Math.cos(a), hp[1] + 0.12 + 1.2 * r * Math.cos(b), hp[2] + r * Math.sin(b) * Math.sin(a));
    si.push(2, 0, 0, 0); sw.push(255, 0, 0, 0);
  }
  const r = W1.headShape(Float32Array.from(pos), Uint8Array.from(si), Uint8Array.from(sw), 2, hp), G = r.grid, Q = r.pts, c = W1.FIT.gc;
  let worst = 0, near = 0;
  for (let a = 0; a < G.n[0]; a++) for (let b = 0; b < G.n[1]; b++) for (let e = 0; e < G.n[2]; e++) {
    const x = G.o[0] + a * c, y = G.o[1] + b * c, z = G.o[2] + e * c;
    let d = W1.FIT.gm;
    for (let i = 0; i < Q.length; i += 3) d = Math.min(d, Math.hypot(x - Q[i], y - Q[i + 1], z - Q[i + 2]));
    const er = Math.abs(d - G.d[(a * G.n[1] + b) * G.n[2] + e]);
    worst = Math.max(worst, er); if (d < 0.1) near = Math.max(near, er);
  }
  assert.ok(near <= 0.0015 && worst <= 0.0025, `sai lớn nhất ${(near * 1000).toFixed(2)} mm trong 10 cm, ${(worst * 1000).toFixed(2)} mm mọi nút (${G.n.join(" × ")} nút, ${Q.length / 3} đỉnh)`);
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
// Như makeRig với thân GLB: khớp theo meta.rest, gươm GLB (lưỡi, điểm fixBlades: mũi, hai mép 0,2 dưới mũi, núm — models.js), lưới đầu
// từ lưới thân (models.js headOf). M: mô hình (lưới da cho kiểm thử va chạm).
function glbRig(id, withModel = false) {
  const b = readFileSync(new URL(`char/${id}.hkm`, MD)), M = parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
  const r = M.meta.rest, rig = makeRig({ weapon: "daikiem" });
  for (const k of ["shL", "elL", "handL", "shR", "elR", "handR", "head"]) rig.p[k].position.set(r[k][0], r[k][1], r[k][2]);
  rig.dyn.blade = BLADE; rig.dyn.head = headOf(M);
  const z = BLADE.tip;
  rig.dyn.blades = [{ j: rig.p.handR, key: "handRx", pts: new Float32Array([0, 0, z, 0, 0.065, z - 0.2, 0, -0.065, z - 0.2, 0, 0, BLADE.butt]) }];
  return withModel ? { rig, M } : rig;
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
// miệng); vành mũ LINH_r24, cánh mũ H31 sượt lưỡi 0,4–0,8 cm — trước đó chỉ đo lưỡi với quả cầu quanh tâm sọ. Soát lần 3: fitArms giải
// tiếp theo khung trước (gọi rời từng mẫu chỉ còn ở khung đầu) — mỗi đòn phát như trong trận: 18 khung thế thủ trộn 0,15 rồi đòn trộn
// 0,8 mỗi khung 1/60 s (chạy 0,35, đỡ, ngã 0,4, trúng đòn 0,5, lộn né 0,6), đo ở các mẫu u = 0,05…1. Lộn né riêng (hai tay ôm chuôi khi
// cuộn người, đầu chạm đất, tư thế đặt hai bàn tay trước mặt — lời giải toàn cục cũng thiếu khe 2–9 cm; soát lần 3 chưa đạt): tay trái hụt
// ≤ 4 cm, lưới mặt ≥ 0,04 (đo: LINH_r24 hụt 3,3 cm khi gượng dậy, lưỡi cách 0,046 lúc đầu sát đất).
t("thân GLB thật (H31, lính Tự do LINH_r01 / LINH_r24): mọi đòn WC01 và đứng, chạy, đỡ, trúng đòn, lộn né, ngã phát 60 khung / giây, u = 0,05…1 — tay trái tới điểm nắm (≤ 1 cm) khi grip = 1 (khung chuyển ≤ rig khối + 1 cm), lưới mặt cách cả thanh gươm và hai bàn tay ≥ 0,055", () => {
  const bad = [], P = W1.POSES_WC01, DT = 1 / 60, DUR = { hich: 3, binhThu: 0.9, ult: 4.4 };
  const ALL = Object.fromEntries(Object.entries(W1.HERO_ANIM_WC01).map(([k, f]) => [k, [f, MOVES_WC01[k]?.dur ?? DUR[k], 0.8]]));
  Object.assign(ALL, { idle: [(u) => P.idle(u * 3), 3, 0.15], run: [(u) => P.run(u * 1.5 * 11, 1, 0.95), 1.5, 0.35], block: [() => P.block, 0.6, 0.4],
    hit: [(u) => P.hitReact(u), 0.3, 0.5], dodge: [(u) => P.dodgeRoll(u), 0.32, 0.6], down: [(u) => P.knockdown(u * 1.6), 1.6, 0.4] });
  for (const id of ["H31", "LINH_r01", "LINH_r24"]) {
    const rig = glbRig(id), m = new RigMotion(rig), ref = makeRig({ weapon: "daikiem" }), mr = new RigMotion(ref);
    for (const [k, [f, dur, kb]] of Object.entries(ALL)) {
      let pose = P.idle(0);
      for (let i = 0; i < 18; i++) { pose = A.blendPose(pose, P.idle(i * DT), 0.15); step(rig, m, pose); step(ref, mr, pose); }
      const N = Math.ceil(dur / DT);
      for (let i = 1; i <= N; i++) {
        pose = A.blendPose(pose, f(i / N), kb); step(rig, m, pose); step(ref, mr, pose);
        const u = i / N;
        if (Math.floor(u * 20 + 1e-9) === Math.floor(((i - 1) / N) * 20 + 1e-9)) continue;
        if (pose.grip >= 0.5) {
          const e = gripErr(rig).err, lim = (k === "dodge" ? 0.04 : 0.01) + (pose.grip < 0.999 ? gripErr(ref).err : 0);
          if (e > lim) bad.push(`${id} ${k}@${u.toFixed(2)} tay trái hụt ${e.toFixed(3)} (grip ${pose.grip.toFixed(2)})`);
        }
        const hg = headGap(rig), bent = Math.abs(m.fq.handRx - rig.p.handR.rotation.x) > 1e-3;
        if (hg.sword < (k === "dodge" ? 0.04 : bent ? 0.047 : 0.055)) bad.push(`${id} ${k}@${u.toFixed(2)} gươm cách lưới mặt ${hg.sword.toFixed(3)} (chuôi ${hg.hand.toFixed(3)}${bent ? ", cổ tay gập theo đất" : ""})`);
      }
    }
  }
  assert.ok(!bad.length, `${bad.length} khung: ${bad.slice(0, 14).join("; ")}`);
});
// Gọi liên tục như rig-motion.js (cùng đối tượng ra, dt > 0), bước u 0,01 qua mọi đòn WC01: khuỷu phải không nhảy > 0,22 m giữa hai bước
// khi khuỷu tư thế đi < 0,05 m, lưỡi sắc (trục y bàn tay) không quay hơn tư thế quá 100° — bàn tay không lật. Đo đợt soát 19a lần 2 với
// bản 18ce9b8: khuỷu lính Tự do nhảy 0,25–0,36 m (N1, DN, CT: phía khuỷu cổ tay gập 150–190°), bàn tay lật 180° (31 khung / 60 khung một
// giây; gọi rời từng khung nay 82). Soát lần 3: fitArms giải tiếp theo khung trước (giới hạn mỗi khung theo thời gian) — bước theo khung
// 1/60 s thật của đòn (u += 1/60 / thời lượng); bước u 0,01 với dt 1/60 (Tuyệt Kỹ: 2,6 khung tư thế trong một khung giải) thì lời giải
// tụt lại rồi đổi phía khuỷu.
t("fitArms gọi liên tục (thân GLB thật): khuỷu không nhảy, bàn tay không lật giữa hai khung 1/60 s", () => {
  const bad = [], ref = makeRig({ weapon: "daikiem" }), DUR = { hich: 3, binhThu: 0.9, ult: 4.4 };
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
      const N = Math.ceil((MOVES_WC01[k]?.dur ?? DUR[k]) * 60);
      for (let i = 0; i <= N; i++) {
        const p = f(i / N), F = frame(rig, W1.fitArms(p, g, o, i ? 1 / 60 : 0)), Z = frame(ref, p);
        if (prev) {
          const de = F.el.distanceTo(prev.F.el), de0 = Z.el.distanceTo(prev.Z.el), dr = (F.E.angleTo(prev.F.E) - Z.E.angleTo(prev.Z.E)) * 180 / Math.PI;
          if (de > 0.22 && de0 < 0.05) bad.push(`${id} ${k}@${(i / N).toFixed(3)} khuỷu nhảy ${de.toFixed(2)} m`);
          if (dr > 100) bad.push(`${id} ${k}@${(i / N).toFixed(3)} bàn tay lật ${dr.toFixed(0)}°`);
        }
        prev = { F, Z };
      }
    }
  }
  assert.ok(!bad.length, `${bad.length} bước: ${bad.slice(0, 12).join("; ")}`);
});
const PAR15 = { hips: null, torso: "hips", head: "torso", shL: "torso", elL: "shL", handL: "elL", shR: "torso", elR: "shR", handR: "elR",
  hipL: "hips", kneeL: "hipL", ankleL: "kneeL", hipR: "hips", kneeR: "hipR", ankleR: "kneeR" };
// Phát như trong trận (soát 19a lần 3): mọi đòn WC01 rồi lộn né nối nhau, 60 khung / giây, tư thế trộn như hero.js (đòn 0,8 mỗi khung,
// 18 khung thế thủ trộn 0,15 trước mỗi đòn; lộn né 0,32 s trộn 0,6), cùng một RigMotion (fitArms → fixBlades → refitArms → gripIK), song
// song rig khối cùng tư thế (đổi của chính tư thế). Mỗi khung đo trong khung thân: hướng lưỡi (trục z bàn tay phải) không quay hơn lưỡi
// rig khối quá 20°, lưỡi sắc không lật (quay > 120° mà lưỡi quay < 60°), khuỷu không đi hơn khuỷu rig khối quá 0,05 m (cho ≤ 1 / 200
// khung tới 0,1 m: khuỷu dời dần sang phía kia khi cổ tay gập quá tầm, xem armPlane); lưới da (CPU) đỉnh theo đầu và đỉnh cổ, râu, cổ
// áo (không theo đầu, tay; trên đường vai − 0,02, |x| < 0,13 quanh đầu) không vào khối gươm (từng lát 5 mm theo lưới gươm) quá 5 mm, cách
// đỉnh hai bàn tay ≥ 5 mm; lưỡi không lệch lưỡi rig khối > 90° quá 6 khung liền, không bao giờ > 120° (kẹt: tay dưới cằm, lưỡi xuyên
// ngực khi tư thế giơ gươm qua đầu). Bản 9374f70: lưỡi bật tới 89° (gồng C6, Tuyệt Kỹ, lộn né), bàn tay lật 180°, râu, cổ áo lọt chắn
// tay 3 cm, gươm vào đầu khi lộn né. Lộn né riêng (hai tay ôm chuôi khi cuộn người, đầu chạm đất — lời giải toàn cục cũng thiếu khe; soát
// lần 3 chưa đạt): gươm vào mặt, cổ ≤ 2,5 cm, bàn tay cách ≥ 3 mm (đo: LINH_r01 2,3 cm, LINH_r24 3,9 mm ở chuỗi này; chuỗi soát của
// trình duyệt: 0).
const wslab = (() => {
  const P = DKM.geos.body.attributes.position.array, I = DKM.geos.body.index.array;
  let zlo = Infinity, zhi = -Infinity; for (let i = 2; i < P.length; i += 3) { zlo = Math.min(zlo, P[i]); zhi = Math.max(zhi, P[i]); }
  const BZ = 0.005, NB = Math.ceil((zhi - zlo) / BZ) + 1, MX = new Float32Array(NB).fill(-1), MY = new Float32Array(NB).fill(-1);
  for (let t3 = 0; t3 < I.length; t3 += 3) for (const [a, b] of [[I[t3], I[t3 + 1]], [I[t3 + 1], I[t3 + 2]], [I[t3 + 2], I[t3]]]) {
    const L = Math.hypot(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]), k = Math.max(1, Math.ceil(L / 0.004));
    for (let s = 0; s <= k; s++) {
      const f = s / k, x = P[a * 3] + (P[b * 3] - P[a * 3]) * f, y = P[a * 3 + 1] + (P[b * 3 + 1] - P[a * 3 + 1]) * f, z = P[a * 3 + 2] + (P[b * 3 + 2] - P[a * 3 + 2]) * f;
      const bi = Math.min(NB - 1, Math.max(0, Math.floor((z - zlo) / BZ))); MX[bi] = Math.max(MX[bi], Math.abs(x)); MY[bi] = Math.max(MY[bi], Math.abs(y));
    }
  }
  for (let bi = 1; bi < NB; bi++) if (MX[bi] < 0) { MX[bi] = MX[bi - 1]; MY[bi] = MY[bi - 1]; }
  return (x, y, z) => {
    let dz = 0, bi;
    if (z < zlo) { dz = zlo - z; bi = 0; } else if (z > zhi) { dz = z - zhi; bi = NB - 1; } else bi = Math.min(NB - 1, Math.floor((z - zlo) / BZ));
    const dx = Math.abs(x) - MX[bi], dy = Math.abs(y) - MY[bi];
    return dz === 0 && dx <= 0 && dy <= 0 ? Math.max(dx, dy) : Math.hypot(Math.max(dx, 0), Math.max(dy, 0), dz);
  };
})();
t("WC01 nối đòn 60 khung / giây (thân GLB thật, mọi đòn + lộn né): lưỡi không bật quá tư thế 20°, bàn tay không lật, khuỷu không nhảy, gươm và hai bàn tay không vào mặt, râu, cổ, cổ áo", () => {
  const DT = 1 / 60, DUR = { hich: 3, binhThu: 0.9, ult: 4.4 }, seq = [];
  for (const k of Object.keys(W1.HERO_ANIM_WC01)) {
    for (let i = 0; i < 18; i++) seq.push([null, 0, () => W1.POSES_WC01.idle(i * DT), 0.15]);
    const f = W1.HERO_ANIM_WC01[k], N = Math.ceil((MOVES_WC01[k]?.dur ?? DUR[k]) / DT);
    for (let i = 1; i <= N; i++) seq.push([k, i / N, () => f(i / N), 0.8]);
  }
  for (let i = 0; i < 18; i++) seq.push([null, 0, () => W1.POSES_WC01.idle(i * DT), 0.15]);
  for (let i = 1; i <= 20; i++) seq.push(["dodge", i / 20, () => W1.POSES_WC01.dodgeRoll(Math.min(1, (i * DT) / 0.32)), 0.6]);
  const ARMB = new Set(["shL", "elL", "handL", "shR", "elR", "handR", "twistL", "twistR", "clavL", "clavR"]), bad = [];
  let frames = 0, elbOver = 0;
  for (const id of ["H31", "LINH_r01", "LINH_r24"]) {
    const { rig, M } = glbRig(id, true), ref = makeRig({ weapon: "daikiem" }), m = new RigMotion(rig), mr = new RigMotion(ref), meta = M.meta;
    const B3 = M.geos.body.attributes, P = B3.position.array, SI = B3.skinIndex.array, SW = B3.skinWeight.array, SWD = SW instanceof Uint8Array ? 255 : 1;
    const bind = (n) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(meta.inv, meta.bones.indexOf(n) * 16).invert());
    const hb = bind("head"), shY = (bind("shL").y + bind("shR").y) / 2, face = [], fist = [];
    for (let i = 0; i < P.length / 3; i++) {
      let q = 0; for (let k = 1; k < 4; k++) if (SW[i * 4 + k] > SW[i * 4 + q]) q = k;
      const d = meta.bones[SI[i * 4 + q]];
      if (d === "head" || (!ARMB.has(d) && P[i * 3 + 1] > shY - 0.02 && Math.abs(P[i * 3] - hb.x) < 0.13)) face.push(i);
      if (d === "handR" || d === "handL") fist.push(i);
    }
    const skin = (Ms, i) => {
      let x = 0, y = 0, z = 0; const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
      for (let k = 0; k < 4; k++) { const w = SW[i * 4 + k] / SWD; if (!w) continue; const e = Ms[SI[i * 4 + k]].elements; x += w * (e[0] * px + e[4] * py + e[8] * pz + e[12]); y += w * (e[1] * px + e[5] * py + e[9] * pz + e[13]); z += w * (e[2] * px + e[6] * py + e[10] * pz + e[14]); }
      return [x, y, z];
    };
    const ax = (r) => {
      const T = r.p.torso.matrixWorld.clone().invert();
      return { z: new THREE.Vector3(0, 0, 1).transformDirection(r.p.handR.matrixWorld).transformDirection(T), y: new THREE.Vector3(0, 1, 0).transformDirection(r.p.handR.matrixWorld).transformDirection(T),
        eR: wpos(r.p.elR).applyMatrix4(T), eL: wpos(r.p.elL).applyMatrix4(T) };
    };
    let pg = W1.POSES_WC01.idle(0), prev = null, dvRun = 0;
    for (const [k, u, f, kb] of seq) {
      pg = A.blendPose(pg, f(), kb);
      step(rig, m, pg); step(ref, mr, pg);
      const a = ax(rig), b = ax(ref);
      if (prev && k) {
        frames++;
        const at = (`${id} ${k}@${u.toFixed(3)}`), deg = (p, q) => (p.angleTo(q) * 180) / Math.PI;
        const tz = deg(a.z, prev.a.z) - deg(b.z, prev.b.z), ty = deg(a.y, prev.a.y), el = Math.max(a.eR.distanceTo(prev.a.eR) - b.eR.distanceTo(prev.b.eR), a.eL.distanceTo(prev.a.eL) - b.eL.distanceTo(prev.b.eL));
        if (tz > 20) bad.push(`${at} lưỡi quay hơn tư thế ${tz.toFixed(0)}°`);
        const dv = deg(a.z, b.z); dvRun = dv > 90 ? dvRun + 1 : 0;
        if (dv > 120 || dvRun > 6) bad.push(`${at} lưỡi lệch tư thế ${dv.toFixed(0)}° (${dvRun} khung liền > 90°)`);
        if (ty > 120 && deg(a.z, prev.a.z) < 60) bad.push(`${at} bàn tay lật ${ty.toFixed(0)}°`);
        if (el > 0.05) elbOver++;
        if (el > 0.1) bad.push(`${at} khuỷu nhảy ${el.toFixed(2)} m hơn tư thế`);
        // va chạm: chỉ khi gươm / bàn tay gần đầu
        const hd = wpos(rig.p.head), hw = wpos(rig.p.handR), m4 = rig.p.handR.matrixWorld, tip = new THREE.Vector3(0, 0, BLADE.tip).applyMatrix4(m4), butt = new THREE.Vector3(0, 0, BLADE.butt).applyMatrix4(m4);
        const seg = tip.clone().sub(butt), tt = Math.max(0, Math.min(1, hd.clone().sub(butt).dot(seg) / seg.lengthSq()));
        if (butt.clone().addScaledVector(seg, tt).distanceTo(hd) < 0.75 || hw.distanceTo(hd) < 0.6 || wpos(rig.p.handL).distanceTo(hd) < 0.6) {
          const Ms = boneWorld(rig, meta), inv = m4.clone().invert().elements, F = face.map((i) => skin(Ms, i));
          let worst = 9;
          for (const [x, y, z] of F) worst = Math.min(worst, wslab(inv[0] * x + inv[4] * y + inv[8] * z + inv[12], inv[1] * x + inv[5] * y + inv[9] * z + inv[13], inv[2] * x + inv[6] * y + inv[10] * z + inv[14]));
          if (worst < (k === "dodge" ? -0.025 : -0.005)) bad.push(`${at} gươm vào mặt / cổ ${(-worst * 100).toFixed(1)} cm`);
          let fd = 9;
          for (const i of fist) { const p = skin(Ms, i); for (const q of F) { const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (d < fd) fd = d; } }
          if (fd < (k === "dodge" ? 0.003 : 0.005)) bad.push(`${at} bàn tay sát mặt / cổ ${(fd * 1000).toFixed(1)} mm`);
        }
      }
      prev = { a, b };
    }
  }
  if (elbOver > frames / 200) bad.unshift(`khuỷu nhảy > 0,05 m hơn tư thế ở ${elbOver} / ${frames} khung`);
  const kinds = ["lưỡi quay", "lưỡi lệch", "bàn tay lật", "khuỷu nhảy", "gươm vào", "bàn tay sát"].map((k) => `${k} ${bad.filter((s) => s.includes(k)).length}`);
  assert.ok(!bad.length, `${kinds.join(", ")} — ${bad.slice(0, 12).join("; ")}`);
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
