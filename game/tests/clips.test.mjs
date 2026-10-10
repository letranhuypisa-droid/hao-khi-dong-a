// tests/clips.test.mjs — bộ chuyển xương (tools/retarget.mjs): pose biết trước → FK trên rig game thật (models.js makeRig) → vị trí khớp
// → solvePose → phải ra đúng pose ban đầu (mọi kênh của rig game đều biểu diễn được nên khứ hồi phải khít), và dựng lại rig bằng pose
// giải được thì từng khớp nằm đúng chỗ cũ.
//   node game/tests/clips.test.mjs
import { registerHooks } from "node:module";
import assert from "node:assert/strict";

const threeUrl = new URL("../vendor/three/three.module.js", import.meta.url).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const THREE = await import("three");
const { makeRig } = await import("../js/battle/models.js");
const { RigMotion } = await import("../js/battle/rig-motion.js");
const A = await import("../js/battle/anim.js");
const { solvePose, newState, KEYS, HIPS_Y } = await import("../tools/retarget.mjs");
const C = await import("../js/battle/clips.js");
const ikMod = await import("../js/battle/ik.js");
const { readFileSync } = await import("node:fs");
const CLIPS_JSON = JSON.parse(readFileSync(new URL("../assets/anim/clips.json", import.meta.url), "utf8"));

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}

// Vị trí khớp của rig đã đặt pose, theo đúng vai trò bộ giải cần (hệ trục rig = hệ trục game).
function jointsOf(rig) {
  rig.root.updateMatrixWorld(true);
  const w = (o, x = 0, y = 0, z = 0) => o.localToWorld(new THREE.Vector3(x, y, z));
  const p = rig.p;
  const P = { hips: w(p.hips), spine: w(p.torso), neck: w(p.torso, 0, 0.52, 0),
    headUp: w(p.head, 0, 1, 0).sub(w(p.head)).normalize() };
  for (const s of ["L", "R"]) P[s] = { arm: w(p["sh" + s]), fore: w(p["el" + s]), hand: w(p["hand" + s]), mid: w(p["hand" + s], 0, -0.1, 0),
    thigh: w(p["hip" + s]), shin: w(p["knee" + s]), foot: w(p["ankle" + s]) };
  return P;
}
const dist = (a, b) => a.distanceTo(b);

const rig = makeRig({});
const POSE = A.P({
  rootX: 0.12, hipsYaw: 0.4, rootZ: -0.08, hipsY: -0.1, torsoX: 0.3, torsoY: -0.35, torsoZ: 0.1, headX: -0.2,
  shRx: -0.9, shRy: 0.3, shRz: 0.25, elRx: -1.3, handRx: 0.4, handRz: 0.1,
  shLx: 0.5, shLy: -0.2, shLz: -0.4, elLx: -0.7, handLx: -0.3, handLz: -0.15,
  hipRx: -0.7, hipRz: 0.15, kneeRx: 1.1, hipLx: 0.4, hipLz: -0.1, kneeLx: 0.5,
});

console.log("Bộ chuyển xương (tools/retarget.mjs)");
t("hông cao HIPS_Y khớp rig game", () => assert.equal(HIPS_Y, makeRig({}).p.hips.position.y));
t("khứ hồi: pose → khớp → pose, mọi kênh khít", () => {
  A.applyPose(rig, POSE);
  const got = solvePose(jointsOf(rig), newState());
  for (const k of KEYS) assert.ok(Math.abs(got[k] - POSE[k]) < 2e-4, `${k}: ${got[k]} ≉ ${POSE[k]}`);
});
t("dựng lại rig từ pose giải được: khuỷu, cổ tay, gối, cổ chân đúng chỗ cũ", () => {
  A.applyPose(rig, POSE);
  const P0 = jointsOf(rig);
  const solved = A.zeroPose(); Object.assign(solved, solvePose(P0, newState()));
  A.applyPose(rig, solved);
  const P1 = jointsOf(rig);
  for (const s of ["L", "R"]) for (const j of ["fore", "hand", "shin", "foot"]) assert.ok(dist(P0[s][j], P1[s][j]) < 1e-3, `${s}.${j} lệch ${dist(P0[s][j], P1[s][j])}`);
});
t("khuỷu duỗi thẳng: không NaN, giữ mặt phẳng gập của khung trước", () => {
  const st = newState();
  const seq = [-1.2, -0.6, -0.2, -0.02, 0, -0.02, -0.3].map((el) => A.P({ ...POSE, elRx: el, elLx: el }));
  for (const p of seq) {
    A.applyPose(rig, p);
    const got = solvePose(jointsOf(rig), st);
    for (const k of KEYS) assert.ok(Number.isFinite(got[k]), `${k} = ${got[k]}`);
    assert.ok(Math.abs(got.elRx - p.elRx) < 2e-3, `elRx ${got.elRx} ≉ ${p.elRx}`);
  }
});
t("tư thế mặc định (mọi góc 0) giải ra mọi góc 0", () => {
  A.applyPose(rig, A.zeroPose());
  const got = solvePose(jointsOf(rig), newState());
  for (const k of KEYS) assert.ok(Math.abs(got[k]) < 1e-4, `${k} = ${got[k]}`);
});

console.log("\nClip nướng sẵn (assets/anim/clips.json) và clips.js");
t("kênh của clips.json trùng KEYS của bộ giải, mỗi clip đủ n × kênh số hữu hạn", () => {
  assert.deepEqual(CLIPS_JSON.keys, KEYS);
  for (const [name, c] of Object.entries(CLIPS_JSON.clips)) {
    assert.equal(c.data.length, c.n * KEYS.length, name);
    assert.ok(c.data.every(Number.isFinite), name + " có NaN");
  }
});
t("có đủ clip game cần: walk, jog, idle, hitChest, roll, death", () => {
  for (const n of ["walk", "jog", "idle", "hitChest", "roll", "death"]) assert.ok(CLIPS_JSON.clips[n], n);
});
t("clip chạy bộ: tốc độ chân trụ walk < jog; hai clip cùng pha (trộn theo tốc độ không ma); không còn sprint trong dữ liệu", () => {
  const c = CLIPS_JSON.clips;
  assert.ok(c.walk.speed < c.jog.speed, `${c.walk.speed} ${c.jog.speed}`);
  assert.equal(c.sprint, undefined, "sprint trượt chân ≥ 22% ở mọi tốc độ nên đã bỏ");
  // pha của đùi R: khung có hipRx nhỏ nhất (đùi vung ra trước nhất), tính theo phần vòng; hai clip lệch ≤ 15% vòng
  const k = KEYS.indexOf("hipRx"), nk = KEYS.length;
  const phase = (n) => { const d = c[n].data, N = c[n].n; let best = 0; for (let i = 0; i < N; i++) if (d[i * nk + k] < d[best * nk + k]) best = i; return best / N; };
  const lag = (a, b) => { const x = Math.abs(phase(a) - phase(b)); return Math.min(x, 1 - x); };
  assert.ok(lag("walk", "jog") <= 0.15, `walk ↔ jog lệch ${(lag("walk", "jog") * 100).toFixed(0)}% vòng`);
});
t("nhịp chạy: locoRate tăng theo tốc độ (kể cả nhanh hơn jog: tăng nhịp, không đổi clip); jog nguyên chất mất đúng dur giây một vòng", () => {
  C.setClips(CLIPS_JSON);
  let prev = 0;
  for (const v of [0.5, 1, 2, 3.5, 5, 6.5, 8, 10]) { const r = C.locoRate(v); assert.ok(r > prev, `v=${v}: ${r} ≤ ${prev}`); prev = r; }
  const j = CLIPS_JSON.clips.jog; near(C.locoRate(j.speed), (2 * Math.PI) / j.dur, 1e-3, "jog");
});
t("kiểu chạy (tameRun): ngực ngả ≤ 0,3 rad và vặn thân ≤ 0,25 rad ở mọi pha, mọi tốc độ (clip gốc ngả tới 0,5 rad, vặn tới ±0,73)", () => {
  C.setClips(CLIPS_JSON);
  for (const sp of [4, 4.5, 5.4, 6.75, 9]) {          // từ RUN_CLIP_MIN (3,6 × cỡ rig): dưới đó là bản thủ tục (thân ngả 0,32 theo thiết kế cũ)
    const g = A.gait(sp, 1.08);
    for (let ph = 0; ph < 12.6; ph += 0.2) {
      const p = A.run(ph, 1, g.stride);
      assert.ok(p.rootX + p.torsoX <= 0.3 + 1e-6, `sp=${sp} ph=${ph.toFixed(1)}: ngực ${(p.rootX + p.torsoX).toFixed(2)}`);
      assert.ok(Math.abs(p.torsoY) <= 0.25, `sp=${sp} ph=${ph.toFixed(1)}: vặn ${p.torsoY.toFixed(2)}`);
    }
  }
});
t("chân trụ không trượt quá nhiều trên đất (rig khối, RigMotion): trung vị ≤ 20% tốc độ thân ở 1,5 / 2 / 4,2 / 6,75 m/s (clip nước rút cũ ≈ 21–39%; trộn walk + jog ở tốc độ thấp ≈ 31–39%; thủ tục ≈ 9–15%)", () => {
  C.setClips(CLIPS_JSON);
  for (const speed of [1.5, 2, 4.2, 6.75]) {
    const rig = makeRig({ weapon: "dao" }), m = new RigMotion(rig), dt = 1 / 60;
    let phase = 0, z = 0, pose = A.zeroPose(), prev = null; const sl = [];
    for (let i = 0; i < 300; i++) {
      const g = A.gait(speed, rig.scale); phase += dt * g.rate; z += speed * dt;
      pose = A.blendPoseQ(pose, A.run(phase, 1, g.stride), 0.35); A.applyPose(rig, pose);
      rig.root.position.set(0, 0, z); rig.root.updateMatrixWorld(true); m.update(dt, pose, () => 0); rig.root.updateMatrixWorld(true);
      const f = ["L", "R"].map((s) => rig.p["ankle" + s].getWorldPosition(new THREE.Vector3()));
      if (prev && i > 60) for (let k = 0; k < 2; k++) { const low = Math.min(f[0].y, f[1].y); if (f[k].y < low + 0.04 && f[k].y < 0.16) sl.push(Math.abs((f[k].z - prev[k].z) / dt)); }
      prev = f;
    }
    sl.sort((a, b) => a - b);
    const med = sl[Math.floor(sl.length / 2)] / speed;
    assert.ok(med <= 0.2, `v=${speed}: trượt trung vị ${(med * 100).toFixed(0)}%`);
  }
});
t("có clip: A.gait / A.run / A.idle / A.hitReact / A.dodgeRoll / A.knockdown trả số hữu hạn ở mọi pha, tốc độ", () => {
  C.setClips(CLIPS_JSON);
  const finite = (p, tag) => { for (const k in p) if (typeof p[k] === "number") assert.ok(Number.isFinite(p[k]), `${tag}.${k} = ${p[k]}`); };
  for (const sp of [0.3, 1, 2.5, 4, 6.75, 9]) {
    const g = A.gait(sp, 1.05);
    for (let ph = 0; ph < 20; ph += 0.37) finite(A.run(ph, 1, g.stride), `run sp=${sp} ph=${ph}`);
  }
  for (let tt = 0; tt < 8; tt += 0.31) finite(A.idle(tt), "idle");
  for (let u = 0; u <= 1; u += 0.05) { finite(A.hitReact(u), "hit"); finite(A.dodgeRoll(u), "roll"); }
  for (let u = 0; u <= 4; u += 0.2) finite(A.knockdown(u), "down");
});
t("không có clip (chưa tải / ?noclips): A.gait, A.run, A.hitReact trả đúng hoạt ảnh thủ tục", () => {
  C.setClips(null);
  assert.equal(C.clipsReady(), false);
  const g = A.gait(6.75, 1.05); assert.ok(g.stride > 0.3 && g.stride <= 1.05, "stride thủ tục " + g.stride);
  const r = A.run(1.2, 1, g.stride); assert.ok(Math.abs(r.hipRx) > 0.05 && r.torsoX > 0.3);
  assert.equal(A.hitReact(0).torsoX, A.GUARD.torsoX);
});
t("idle có clip giữ hướng thế thủ (hông, thân quay như GUARD, lệch vài độ), vẫn có chuyển động", () => {
  C.setClips(CLIPS_JSON);
  let lo = Infinity, hi = -Infinity;
  for (let tt = 0; tt < 5; tt += 0.1) {
    const p = A.idle(tt);
    assert.ok(Math.abs(p.hipsYaw - A.GUARD.hipsYaw) < 0.12 && Math.abs(p.torsoY - A.GUARD.torsoY) < 0.12, `t=${tt}: yaw ${p.hipsYaw} / ${p.torsoY}`);
    lo = Math.min(lo, p.kneeLx); hi = Math.max(hi, p.kneeLx);
  }
  assert.ok(hi - lo > 0.005, "gối đứng yên hẳn");
});
t("hitReact có clip: đầu và cuối về đúng thế thủ, giữa giật người hơn 0,25 rad ở thân hoặc đầu", () => {
  C.setClips(CLIPS_JSON);
  for (const u of [0, 1]) for (const k of ["torsoX", "headX", "hipsY", "shRx"]) near(A.hitReact(u)[k], A.GUARD[k], 1e-6, `u=${u} ${k}`);
  let peak = 0; for (let u = 0; u <= 1; u += 0.02) { const p = A.hitReact(u); peak = Math.max(peak, Math.abs(p.torsoX - A.GUARD.torsoX), Math.abs(p.headX - A.GUARD.headX)); }
  assert.ok(peak > 0.25, "giật quá nhẹ: " + peak);
});
t("lăn né có clip lăn đủ một vòng; ngã có clip nằm hẳn xuống", () => {
  C.setClips(CLIPS_JSON);
  const end = A.dodgeRoll(1).rootX, wrap = end - 2 * Math.PI * Math.round(end / (2 * Math.PI));
  assert.ok(Math.abs(end) > 5.5 && Math.abs(wrap) < 0.6, `rootX cuối ${end}`);
  const d = A.knockdown(1.5); assert.ok(d.rootX < -1.0 && d.hipsY < -0.5, `nằm: rootX ${d.rootX} hipsY ${d.hipsY}`);
  assert.ok(Math.abs(A.knockdown(0).hipsY) < 0.15, "bắt đầu đứng");
});
C.setClips(null);


console.log("\nĐòn dựng từ clip (clip-moves.js) và ngã / đứng dậy");
const HA = await import("../js/battle/hero-anim.js");
const CM = await import("../js/battle/clip-moves.js");
const { MOVES } = await import("../js/data/tuning.js");
t("có clip: đòn N1 bắt đầu và kết thúc đúng thế thủ; tại mốc sát thương tay đúng tư thế clip lúc vung nhanh nhất", () => {
  C.setClips(CLIPS_JSON);
  const hit = MOVES.N1.hits[0];
  for (const u of [0, 1]) for (const k of ["torsoY", "hipsY", "shRx", "kneeLx", "handRx"]) near(HA.HERO_ANIM.N1(u)[k], A.GUARD[k], 1e-6, `u=${u} ${k}`);
  const want = A.zeroPose(); C.sampleT("swordA", CLIPS_JSON.clips.swordA.strike, want);
  const got = HA.HERO_ANIM.N1(hit);
  for (const k of ["torsoY", "shRx", "shRy", "elRx", "hipLx", "kneeRx"]) near(got[k], want[k], 1e-5, "N1@hit " + k);
  near(got.handRx, want.handRx + CM.HAND_BIAS, 1e-5, "cổ tay + độ lệch lưỡi");
});
t("N2 là bản lật trái-phải của N1 (cùng clip, mirror) ở mốc sát thương", () => {
  C.setClips(CLIPS_JSON);
  const u = MOVES.N1.hits[0], a = HA.HERO_ANIM.N1(u), b = HA.HERO_ANIM.N2(u);
  near(b.shLx, a.shRx, 1e-5, "vai"); near(b.elLx, a.elRx, 1e-5, "khuỷu"); near(b.kneeLx, a.kneeRx, 1e-5, "gối"); near(b.torsoY, -a.torsoY, 1e-5, "xoay thân");
});
t("đòn không có spec (N6, C2…) và mọi đòn khi không có clip giữ nguyên hàm khung khoá cũ", () => {
  C.setClips(CLIPS_JSON);
  assert.deepEqual(HA.HERO_ANIM.N6(0.4), A.spin(0.4, 1.25));
  assert.deepEqual(HA.HERO_ANIM.C2(0.4), A.uppercut(0.4));
  C.setClips(null);
  assert.deepEqual(HA.HERO_ANIM.N1(0.3), A.slash(0.3, 1, 0));
  assert.deepEqual(HA.HERO_ANIM.N2(0.3), A.slash(0.3, -1, 0));
  assert.deepEqual(HA.HERO_ANIM.DC(0.3), A.dash(0.3));
  assert.deepEqual(HA.HERO_ANIM.N5(0.4), A.scissor(0.4));
  assert.deepEqual(HA.HERO_ANIM.C1(0.4), A.doubleChop(0.4));
  assert.deepEqual(HA.HERO_ANIM.DQ(0.4), A.doubleChop(0.4));
});
// Nhát kiếm Haley Tuffles (mocap iPi Soft, nướng từ anim-src/haley): N5 ← hySide2, C1 ← hyFront, DQ ← hyDown.
const HALEY_MOVES = { N5: "hySide2", C1: "hyFront", DQ: "hyDown" };
t("clip Haley (hySide2, hyFront, hyDown): tay phải vung, không lặp, cú chém nằm trong clip, đủ khung hữu hạn", () => {
  for (const name of new Set(Object.values(HALEY_MOVES))) {
    const c = CLIPS_JSON.clips[name];
    assert.ok(c, name + " có trong clips.json");
    assert.equal(c.hand, "R", name + " tay vung"); assert.equal(c.loop, false, name + " không lặp");
    assert.ok(c.strike > c.start && c.strike < c.dur - 0.3, `${name}: strike ${c.strike} nằm giữa start ${c.start} và cuối clip ${c.dur}`);
    assert.equal(c.data.length, c.n * CLIPS_JSON.keys.length, name + " đủ n × kênh");
    assert.ok(c.data.every(Number.isFinite), name + " số hữu hạn");
  }
});
t("đòn Haley của H35 (N5, C1, DQ): đầu / cuối đúng thế thủ, mốc sát thương đúng tư thế clip lúc chém, không clip thì về khung khoá cũ", () => {
  C.setClips(CLIPS_JSON);
  for (const [k, name] of Object.entries(HALEY_MOVES)) {
    for (const u of [0, 1]) for (const key of ["torsoY", "hipsY", "shRx", "kneeLx", "handRx"]) near(HA.HERO_ANIM[k](u)[key], A.GUARD[key], 1e-6, `${k} u=${u} ${key}`);
    const want = A.zeroPose(); C.sampleT(name, CLIPS_JSON.clips[name].strike, want);
    const got = HA.HERO_ANIM[k](MOVES[k].hits[0]);
    for (const key of ["torsoY", "shRx", "shRy", "elRx", "hipLx", "kneeRx"]) near(got[key], want[key], 1e-5, `${k}@hit ${key}`);
    near(got.handRx, want.handRx + CM.HAND_BIAS, 1e-5, k + " cổ tay + độ lệch lưỡi");
  }
});
t("đòn Haley của H35: tốc độ phát clip 1–3× (lấy đà dài ~1 s của mocap không bị bóp vào 0,2–0,5 s), trước và sau cú chém xấp xỉ nhau (even)", () => {
  for (const [k, name] of Object.entries(HALEY_MOVES)) {
    const spec = HA.CLIP_SPECS[k], c = CLIPS_JSON.clips[name], hit = MOVES[k].hits[0], dur = MOVES[k].dur;
    const t0 = spec.t0 ?? 0, before = (c.strike - t0) / (hit * dur);
    const t1 = Math.min(c.dur, c.strike + ((c.strike - t0) / (hit * dur)) * (1 - hit) * dur), after = (t1 - c.strike) / ((1 - hit) * dur);
    assert.ok(before >= 1 && before <= 3, `${k}: tốc độ trước chém ${before.toFixed(2)}×`);
    assert.ok(Math.abs(after - before) < 0.05 || t1 === c.dur, `${k}: tốc độ sau chém ${after.toFixed(2)}× so với trước ${before.toFixed(2)}×`);
  }
});
t("mọi đòn của HERO_ANIM trả số hữu hạn ở mọi u, có clip và không có", () => {
  for (const on of [true, false]) {
    C.setClips(on ? CLIPS_JSON : null);
    for (const k of HA.HERO_MOVE_LIST) for (let u = 0; u <= 1.0001; u += 0.05) for (const [key, v] of Object.entries(HA.HERO_ANIM[k](Math.min(1, u)))) if (typeof v === "number") assert.ok(Number.isFinite(v), `${k}@${u} ${key}=${v}`);
  }
});
// Vỡ Thế (sĩ quan / boss, A.stagger): thân, đầu, chân từ clip khuỵu gối của Motifect (mtKnees, mocap AI), tay vẫn thủ tục.
const ARM_KEYS = ["shRx", "shRy", "shRz", "elRx", "handRx", "handRz", "shLx", "shLy", "shLz", "elLx", "handLx", "handLz"];
t("clip mtKnees (Motifect): không lặp, hông hạ ≥ 0,4 (khuỵu gối), giữ yên ở cuối clip, số hữu hạn", () => {
  const c = CLIPS_JSON.clips.mtKnees, nk = CLIPS_JSON.keys.length, hy = CLIPS_JSON.keys.indexOf("hipsY");
  assert.ok(c, "mtKnees có trong clips.json"); assert.equal(c.loop, false); assert.equal(c.data.length, c.n * nk); assert.ok(c.data.every(Number.isFinite));
  let lo = 0; for (let i = 0; i < c.n; i++) lo = Math.min(lo, c.data[i * nk + hy]);
  assert.ok(lo <= -0.4, "hông hạ " + lo);
  let move = 0; for (let i = c.n - 6; i < c.n; i++) for (let k = 0; k < nk; k++) move = Math.max(move, Math.abs(c.data[i * nk + k] - c.data[(i - 1) * nk + k]));
  assert.ok(move < 0.03, "6 khung cuối còn động " + move);
});
t("Vỡ Thế có clip: thân, đầu, chân khác khung khoá (khuỵu sâu hơn); tay và cổ tay y hệt bản thủ tục, cán dài vẫn chống đất", () => {
  for (const long of [false, true]) for (const tt of [0.3, 1, 3]) {
    C.setClips(CLIPS_JSON); const on = A.stagger(tt, long);
    C.setClips(null); const off = A.stagger(tt, long);
    for (const k of ARM_KEYS) near(on[k], off[k], 1e-9, `long=${long} t=${tt} ${k}`);
    if (tt === 3) { assert.ok(on.hipsY < off.hipsY - 0.15, `hông ${on.hipsY} so với ${off.hipsY}`); assert.ok(on.kneeLx > off.kneeLx + 0.5, "gối gập sâu hơn"); }
  }
});
t("Vỡ Thế không clip (?noclips): đúng khung khoá cũ (xốc ngửa rồi gục: hông −0,3 ở cuối)", () => {
  C.setClips(null);
  near(A.stagger(3.4).hipsY, -0.3, 0.03, "hông"); near(A.stagger(3.4).torsoX, 0.5, 0.06, "thân gập");
});
t("A.stagger trả số hữu hạn ở mọi t (0 – 4 s), có clip và không có, cán dài hay không", () => {
  for (const on of [true, false]) { C.setClips(on ? CLIPS_JSON : null); for (const long of [false, true]) for (let tt = 0; tt <= 4; tt += 0.1) for (const [k, v] of Object.entries(A.stagger(tt, long))) if (typeof v === "number") assert.ok(Number.isFinite(v), `${tt} ${k}`); }
});
t("downPose: null khi không có clip hoặc đối số hỏng; có clip thì ngã nằm rồi cuối là đứng dậy gần thế đứng", () => {
  C.setClips(null); assert.equal(A.downPose(0.3, 1.1), null);
  C.setClips(CLIPS_JSON);
  assert.equal(A.downPose(NaN, 1.1), null); assert.equal(A.downPose(0.3, 0), null);
  const lying = A.downPose(0.5, 1.1), end = A.downPose(1.1, 1.1);
  assert.ok(lying.rootX < -1.0 && lying.hipsY < -0.5, `nằm: rootX ${lying.rootX} hipsY ${lying.hipsY}`);
  assert.ok(Math.abs(end.hipsY) < 0.12 && Math.abs(end.rootX) < 0.3, `cuối: hipsY ${end.hipsY} rootX ${end.rootX}`);
  for (let el = 0; el <= 1.1; el += 0.05) for (const [k, v] of Object.entries(A.downPose(el, 1.1))) if (typeof v === "number") assert.ok(Number.isFinite(v), `${el} ${k}`);
});
C.setClips(null);


console.log("\nChất lượng dữ liệu clip nướng");
t("không clip nào có góc Euler hông / thân / vai nhảy ≥ 2,5 rad giữa hai khung liền nhau (nhảy nghiệm gần gimbal làm tay quay vòng)", () => {
  const nk = KEYS.length, eul = ["rootX", "hipsYaw", "rootZ", "torsoX", "torsoY", "torsoZ", "shLx", "shLy", "shLz", "shRx", "shRy", "shRz"].map((k) => KEYS.indexOf(k));
  for (const [name, c] of Object.entries(CLIPS_JSON.clips)) for (let i = 1; i < c.n; i++) for (const k of eul) {
    const d = Math.abs(c.data[i * nk + k] - c.data[(i - 1) * nk + k]);
    assert.ok(d < 2.5, `${name} khung ${i} ${KEYS[k]} nhảy ${d.toFixed(2)} rad`);
  }
});
t("clip đòn (aim): hông ở lúc vung quay về phía trước (≤ 0,8 rad); hipsYaw trong ±π (trừ đoạn xoay vòng đầu swordC, swordCombo — N4 chỉ dùng từ 0,5 s)", () => {
  const nk = KEYS.length, ky = KEYS.indexOf("hipsYaw");
  for (const name of ["attack", "swordA", "swordB", "swordC", "swordCombo", "swordDash", "hook"]) {
    const c = CLIPS_JSON.clips[name], si = Math.round((c.strike / c.dur) * (c.n - 1));
    assert.ok(Math.abs(c.data[si * nk + ky]) <= 0.8, `${name}: hông lúc vung ${c.data[si * nk + ky].toFixed(2)}`);
    if (name === "swordC" || name === "swordCombo") continue;
    for (let i = 0; i < c.n; i++) assert.ok(Math.abs(c.data[i * nk + ky]) <= Math.PI, `${name} khung ${i}: hipsYaw ${c.data[i * nk + ky].toFixed(2)}`);
  }
});
t("mọi đòn ghép clip của H35: hipsYaw không vượt ±π ở bất kỳ u nào (blendPose nội suy hipsYaw thẳng)", () => {
  C.setClips(CLIPS_JSON);
  for (const k of ["N1", "N2", "N3", "N4", "DN", "DC", "CT"]) for (let u = 0; u <= 1.0001; u += 0.02) {
    const y = HA.HERO_ANIM[k](Math.min(1, u)).hipsYaw;
    assert.ok(Math.abs(y) <= Math.PI, `${k}@${u.toFixed(2)} hipsYaw ${y.toFixed(2)}`);
  }
  C.setClips(null);
});


console.log("\nTrộn theo phép quay (anim.js blendPoseQ)");
const qOf = (order, a, b, c) => { const e = new THREE.Euler(a, b, c, order); return new THREE.Quaternion().setFromEuler(e); };
const rotErr = (p, q, kind) => {            // góc lệch (rad) giữa phép quay của khớp trong tư thế p và quaternion q
  const e = kind === "sh" ? qOf("YXZ", p.shRx, p.shRy, p.shRz) : kind === "torso" ? qOf("XYZ", p.torsoX, p.torsoY, p.torsoZ) : qOf("XYZ", p.rootX, p.spin + p.hipsYaw, p.rootZ);
  return 2 * Math.acos(Math.min(1, Math.abs(e.dot(q))));
};
t("blendPoseQ: t = 0 và t = 1 trả đúng nguồn / đích (như blendPose)", () => {
  const a = A.P({ shRx: -0.4, shRy: 0.3, torsoY: 0.2 }), b = A.P({ shRx: -1.2, shRy: -0.5, torsoY: -0.4, rootX: 0.3 });
  assert.deepEqual(A.blendPoseQ(a, b, 0), A.blendPose(a, b, 0)); assert.deepEqual(A.blendPoseQ(a, b, 1), A.blendPose(a, b, 1));
});
t("blendPoseQ gần blendPose khi hai tư thế gần nhau (đổi từng khung trong trận không đổi cảm giác)", () => {
  let worst = 0, seed = 20261008;                                                        // chuỗi ngẫu nhiên cố định: trước đây Math.random, lệch tối đa lúc 0,036 làm test đỏ ngẫu nhiên
  const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 200; i++) {
    const r = () => (rnd() - 0.5), a = A.P({ shRx: -1 + r(), shRy: r(), shRz: r(), shLx: r(), shLy: r(), torsoX: r() * 0.6, torsoY: r() * 0.6, hipsYaw: r() * 0.5, rootX: r() * 0.3 });
    const b = { ...a }; for (const k of ["shRx", "shRy", "shRz", "shLx", "torsoX", "torsoY", "hipsYaw", "rootX"]) b[k] += r() * 0.15;
    const t = 0.15 + rnd() * 0.7, p = A.blendPose(a, b, t), q = A.blendPoseQ(a, b, t);
    for (const k of Object.keys(p)) if (typeof p[k] === "number") worst = Math.max(worst, Math.abs(p[k] - q[k]));
  }
  assert.ok(worst < 0.03, "lệch tối đa " + worst);
});
t("blendPoseQ: hai cách viết góc khác của cùng một hướng thì mọi t đều ra cùng hướng (blendPose thì sai)", () => {
  const alt = (y, x, z) => [y + Math.PI, Math.PI - x, z + Math.PI];             // YXZ: (y, x, z) → bộ ba thay thế
  const a = A.P({ shRx: -0.2, shRy: 0.5, shRz: -0.8 }), [y2, x2, z2] = alt(0.5, -0.2, -0.8), b = A.P({ shRx: x2 - 2 * Math.PI, shRy: y2 + 2 * Math.PI, shRz: z2 - 4 * Math.PI });
  const q0 = qOf("YXZ", -0.2, 0.5, -0.8);
  let badOld = 0;
  for (const tt of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    assert.ok(rotErr(A.blendPoseQ(a, b, tt), q0, "sh") < 1e-4, `t=${tt}`);
    badOld = Math.max(badOld, rotErr(A.blendPose(a, b, tt), q0, "sh"));
  }
  assert.ok(badOld > 0.5, "blendPose cũ lẽ ra phải sai ở đây: " + badOld);
});
t("blendPoseQ: hông lộn nguyên vòng (rootX 2π) và xoay nhiều vòng (spin) vẫn đi đường ngắn nhất, không quét ngược", () => {
  const a = A.P({ rootX: 0 }), b = A.P({ rootX: 2 * Math.PI + 0.1 }), c = A.P({ spin: -2 * Math.PI * 1.25 });
  for (const tt of [0.2, 0.5, 0.8]) {
    const p = A.blendPoseQ(a, b, tt), ang = Math.abs(qOf("XYZ", p.rootX, p.spin + p.hipsYaw, p.rootZ).w);
    assert.ok(2 * Math.acos(Math.min(1, ang)) < 0.12, `rootX t=${tt}`);
    const s = A.blendPoseQ(a, c, tt), w = 2 * Math.acos(Math.min(1, Math.abs(qOf("XYZ", s.rootX, s.spin + s.hipsYaw, s.rootZ).w)));
    assert.ok(w <= Math.PI / 2 + 1e-6, `spin t=${tt}: ${w}`);          // mọi t nằm trong nửa vòng quanh 0 (−1,25 vòng ≡ −90°)
  }
});
t("đòn ghép clip (H35): đầu / cuối đòn trộn từ / về thế thủ không quét tay quá π so với thế thủ ở bất kỳ u nào", () => {
  C.setClips(CLIPS_JSON);
  for (const k of ["N1", "N2", "N3", "N4", "DN", "DC", "CT"]) for (let u = 0; u <= 1.0001; u += 0.02) {
    const p = HA.HERO_ANIM[k](Math.min(1, u));
    for (const s of ["L", "R"]) {
      const q = qOf("YXZ", p["sh" + s + "x"], p["sh" + s + "y"], p["sh" + s + "z"]), g = qOf("YXZ", A.GUARD["sh" + s + "x"], A.GUARD["sh" + s + "y"], A.GUARD["sh" + s + "z"]);
      assert.ok(2 * Math.acos(Math.min(1, Math.abs(q.dot(g)))) < Math.PI + 1e-6);
    }
  }
  C.setClips(null);
});


console.log("\nH31 đại kiếm: chuỗi N dựng từ clip gươm hai tay");
const W1T = await import("../js/battle/anim-wc01.js");
const { MOVES_WC01 } = await import("../js/data/moves-wc01.js");
t("N1–N6 của H31 có clip: đầu / cuối đòn đúng thế thủ WC01; giữa đòn tay giải theo gươm, grip = 1, không thẻ bảng, số hữu hạn", () => {
  C.setClips(CLIPS_JSON);
  for (const k of ["N1", "N2", "N3", "N4", "N5", "N6"]) {
    for (const u of [0, 1]) { const p = W1T.HERO_ANIM_WC01[k](u); for (const key of ["shRx", "shRy", "shRz", "elRx", "handRx", "shLx", "torsoY", "hipsYaw", "hipsY", "kneeLx"]) near(p[key], W1T.GUARD[key], 1e-6, `${k} u=${u} ${key}`); }
    const mid = W1T.HERO_ANIM_WC01[k](MOVES_WC01[k].hits[0]);
    assert.equal(mid.grip, 1, k + " grip"); assert.equal(mid.fk, undefined, k + " thẻ bảng");
    for (let u = 0; u <= 1.0001; u += 0.02) for (const [key, v] of Object.entries(W1T.HERO_ANIM_WC01[k](Math.min(1, u)))) if (typeof v === "number") assert.ok(Number.isFinite(v), `${k}@${u.toFixed(2)} ${key}`);
  }
  C.setClips(null);
});
t("H31 không clip (?noclips): N1–N6 giữ khung khoá cũ, mang thẻ bảng lời giải tay (fk = tên đòn)", () => {
  C.setClips(null);
  for (const k of ["N1", "N2", "N3", "N4", "N5", "N6"]) assert.equal(W1T.HERO_ANIM_WC01[k](0.3).fk, k);
  for (const k of ["C1", "C2", "C3", "C4", "DN", "DC", "DQ", "CT"]) assert.equal(W1T.HERO_ANIM_WC01[k](0.3).fk, k);       // đòn khác không đổi ở cả hai chế độ
  C.setClips(CLIPS_JSON);
  for (const k of ["C1", "C2", "C3", "C4", "DN", "DC", "DQ", "CT"]) assert.equal(W1T.HERO_ANIM_WC01[k](0.3).fk, k);
  C.setClips(null);
});
t("clip gươm hai tay: tay giải theo gươm — hai bàn tay cách nhau đúng GRIP dọc lưỡi trong khung thân (gần như mọi khung)", () => {
  // tay phải W, tay trái G = W − GRIP·D: dùng FK cùng IK của anim-wc01 để kiểm lại: cổ tay trái giải ra phải nằm cách cổ tay phải ≈ GRIP
  const { armFK } = ikMod;
  const sh = (s) => (s === "R" ? W1T.SH.R : W1T.SH.L);
  let worst = 0, n = 0;
  for (const name of ["gsIdle", "gsSlash1", "gsSlash3", "gsHilt"]) {
    const c = CLIPS_JSON.clips[name], nk = KEYS.length, ix = (k) => KEYS.indexOf(k);
    for (let i = 0; i < c.n; i += 2) {
      const g = (k) => c.data[i * nk + ix(k)], out = [0, 0, 0, 0, 0, 0];
      armFK(g("shRx"), g("shRy"), g("shRz"), g("elRx") - W1T.ARM.off, W1T.ARM.L1, W1T.ARM.L2, out);
      const R = [sh("R")[0] + out[3], sh("R")[1] + out[4], sh("R")[2] + out[5]];
      armFK(g("shLx"), g("shLy"), g("shLz"), g("elLx") - W1T.ARM.off, W1T.ARM.L1, W1T.ARM.L2, out);
      const L = [sh("L")[0] + out[3], sh("L")[1] + out[4], sh("L")[2] + out[5]];
      worst = Math.max(worst, Math.abs(Math.hypot(R[0] - L[0], R[1] - L[1], R[2] - L[2]) - W1T.GRIP)); n++;
    }
  }
  assert.ok(worst < 0.06, `khoảng cách hai bàn tay lệch GRIP tới ${worst.toFixed(3)} m (${n} khung)`);
});


console.log("\nPhối hợp tay chân khi chạy");
t("chạy: tay ĐỐI BÊN với chân (tay phải ~ chân phải tương quan âm), vai vặn cùng chiều tay, hông quay ngược chiều vai — cả bản clip lẫn thủ tục", () => {
  const corr = (a, b) => { const n = a.length, ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n; let c = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; } return c / Math.sqrt(da * db); };
  for (const [label, clips, sp] of [["clip", true, 6.75], ["thủ tục", false, 3]]) {
    C.setClips(clips ? CLIPS_JSON : null);
    const g = A.gait(sp, 1.08), rows = Array.from({ length: 72 }, (_, i) => A.run((i / 72) * Math.PI * 2, 1, g.stride)), col = (k) => rows.map((p) => p[k]);
    const armLeg = corr(col("shRx"), col("hipRx")), shoulderArm = corr(col("torsoY"), col("shRx")), pelvis = corr(col("hipsYaw"), col("torsoY"));
    assert.ok(armLeg < -0.5, `${label}: tay phải ~ chân phải ${armLeg.toFixed(2)} (dương = cùng bên, lê bước)`);
    assert.ok(shoulderArm > 0.5, `${label}: vai ~ tay phải ${shoulderArm.toFixed(2)} (âm = vai và tay đánh nhau)`);
    assert.ok(pelvis < -0.5, `${label}: hông ~ vai ${pelvis.toFixed(2)}`);
  }
  C.setClips(null);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
