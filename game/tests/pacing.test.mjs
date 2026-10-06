// tests/pacing.test.mjs — nhịp bước cố định và nội suy khi vẽ (đợt 19c, battle/pacing.js). Dãy dấu giờ rAF giả (lưới vsync, lệch ±0,3 ms, làm
// tròn 0,1 ms như Chrome, khung giật): màn 60 Hz đúng một bước mỗi khung (cả sau khung chạm trần 4 bước, lưới lệch pha, màn 59,94 Hz), 30 Hz
// hai bước, 90/120/144 Hz không khung hai bước, giờ trận bám giờ thật; chế độ tua (advance) giữ y hệt bộ tích lũy cũ từng bit (tất định);
// giờ vẽ tăng đều; nội suy góc; chụp / nội suy / trả TRS của rig (trả đúng từng bit, không đụng Euler, dịch chuyển thì không trượt);
// chỗ camera nhắm (View.pos): vị trí mô phỏng khi chưa có bước / α = 1, lùi theo đoạn gốc rig đã đi khi α < 1.
//   node game/tests/pacing.test.mjs
import assert from "node:assert/strict";
import { STEP, MAX_STEPS, PHASE, SNAP_D, Pacer, lerpYaw, RigSnap } from "../js/battle/pacing.js";
import { View } from "../js/battle/view.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}

// Dấu giờ rAF (ms): khung i ở i·chu kỳ + lệch ngẫu nhiên không cộng dồn (±j ms), làm tròn 0,1 ms. late[i] = ms dời lưới từ khung i trở đi
// (khung trễ — bội chu kỳ: lỡ vsync; lẻ: VRR / dấu giờ lệch pha).
function stamps(hz, n, { j = 0, seed = 7, late = {} } = {}) {
  let s = seed >>> 0; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const per = 1000 / hz, out = []; let shift = 0;
  for (let i = 1; i <= n; i++) { if (late[i]) shift += late[i]; out.push(Math.round((i * per + shift + (rnd() - 0.5) * 2 * j) * 10) / 10); }
  return out;
}
// Chạy như frame() của battle.js: dt = (now − last)/1000 kẹp [0; 0,1], cộng × tốc, chạy bước. Trả số bước, α, giờ vẽ từng khung.
function drive(P, ts, { scale = () => 1, live = true } = {}) {
  let last = 0, clock = 0, wall = 0; const steps = [], alpha = [], rt = [], add = [];
  ts.forEach((now, i) => {
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; wall += dt;
    const k = scale(i); P.begin(dt, k, live); let n = 0;
    while (P.next()) { n++; clock += STEP; }
    P.end();
    steps.push(n); alpha.push(P.alpha); rt.push(clock - (1 - P.alpha) * STEP); add.push(dt * k);
  });
  return { steps, alpha, rt, add, clock, wall };
}
const share = (a, f) => a.filter(f).length / a.length;
const bad1 = (steps, from = 0, to = steps.length) => { const b = []; for (let i = from; i < to; i++) if (steps[i] !== 1) b.push(i); return b; };

console.log("Bước cố định ở màn 60 Hz");
t("60 Hz lệch ±0,3 ms: mọi khung đúng một bước (bản cũ: 1/4 khung 0 bước, 1/4 khung 2 bước)", () => {
  for (const seed of [1, 7, 99]) {
    const { steps } = drive(new Pacer(), stamps(60, 6000, { j: 0.3, seed }));
    const b = bad1(steps);
    assert.equal(b.length, 0, `seed ${seed}: ${b.length} khung lệch (0 bước ${share(steps, (s) => s === 0) * 100}%), đầu tiên ở ${b[0]}`);
  }
});
t("60 Hz lệch ±0,05 ms và không lệch: mọi khung đúng một bước", () => {
  for (const j of [0, 0.05]) { const { steps } = drive(new Pacer(), stamps(60, 3000, { j })); assert.equal(bad1(steps).length, 0, `±${j} ms`); }
});
t("khung giật chạm trần 4 bước (100 ms, 166 ms): chỉ bỏ phần thừa, pha về giữa bước — khung ngay sau lại một bước", () => {
  const per = 1000 / 60, late = { 1000: 5 * per, 3000: 9 * per };
  const { steps } = drive(new Pacer(), stamps(60, 5000, { j: 0.3, late }));
  assert.equal(steps[999], MAX_STEPS); assert.equal(steps[2999], MAX_STEPS);
  const b = bad1(steps).filter((i) => i !== 999 && i !== 2999);
  assert.equal(b.length, 0, `khung lệch sau khung giật: ${b.slice(0, 8)}`);
});
t("khung trễ lỡ 1–2 vsync (33, 50 ms): đúng 2, 3 bước rồi lại một bước", () => {
  const per = 1000 / 60, late = { 800: per, 1600: 2 * per };
  const { steps } = drive(new Pacer(), stamps(60, 2400, { j: 0.3, late }));
  assert.equal(steps[799], 2); assert.equal(steps[1599], 3);
  assert.equal(bad1(steps).filter((i) => i !== 799 && i !== 1599).length, 0);
});
t("lưới vsync lệch pha (±0,5 chu kỳ: VRR, dấu giờ lệch): khoá pha đưa về một bước mỗi khung trong ≤ 60 khung", () => {
  const per = 1000 / 60, at = [1500, 3000, 4500, 6000], late = { 1500: 0.5 * per, 3000: 0.47 * per, 4500: -0.5 * per, 6000: 0.52 * per };
  for (const seed of [3, 11]) {
    const { steps } = drive(new Pacer(), stamps(60, 7500, { j: 0.3, seed, late }));
    for (let k = 0; k < at.length; k++) {
      const b = bad1(steps, at[k] - 1 + 60, at[k + 1] ? at[k + 1] - 1 : steps.length);
      assert.equal(b.length, 0, `seed ${seed}, sau khung ${at[k]}: còn ${b.length} khung lệch (đầu ${b[0]})`);
    }
    assert.ok(share(steps, (s) => s !== 1) < 0.005, `seed ${seed}: ${share(steps, (s) => s !== 1)}`);
  }
});
t("59,94 / 60,03 / 59,5 Hz (trôi pha): ≥ 99,9% khung một bước", () => {
  for (const hz of [59.94, 60.03, 59.5]) {
    const { steps } = drive(new Pacer(), stamps(hz, 20000, { j: 0.3 }));
    assert.ok(share(steps, (s) => s === 1) >= 0.999, `${hz} Hz: ${(share(steps, (s) => s === 1) * 100).toFixed(2)}%`);
  }
});
t("30 Hz lệch ±0,3 ms: mọi khung đúng hai bước", () => {
  const { steps } = drive(new Pacer(), stamps(30, 3000, { j: 0.3 }));
  assert.equal(steps.filter((s) => s !== 2).length, 0, `${steps.filter((s) => s !== 2).length} khung khác 2 bước`);
});

console.log("Màn 90/120/144 Hz, giờ trận");
t("90 / 120 / 144 Hz lệch ±0,3 ms: không khung nào quá một bước, tỉ lệ khung không bước = 1 − 60/Hz", () => {
  for (const hz of [90, 120, 144]) {
    const { steps } = drive(new Pacer(), stamps(hz, 8000, { j: 0.3 }));
    assert.equal(Math.max(...steps), 1, `${hz} Hz`);
    const z = share(steps, (s) => s === 0);
    assert.ok(Math.abs(z - (1 - 60 / hz)) < 0.01, `${hz} Hz: ${z}`);
  }
});
t("giờ trận bám giờ thật: 10 phút ở 90/120/144 Hz lệch < 1 µs; 60 / 59,94 Hz (khoá pha) lệch nhịp ≤ 0,2%", () => {
  for (const hz of [90, 120, 144]) {
    const P = new Pacer(), r = drive(P, stamps(hz, hz * 600, { j: 0.3 }));
    assert.ok(Math.abs(r.clock + P.acc - STEP / 2 - r.wall) < 1e-6, `${hz} Hz: ${r.clock + P.acc - STEP / 2 - r.wall}`);
  }
  for (const hz of [60, 59.94]) {
    const r = drive(new Pacer(), stamps(hz, hz * 600, { j: 0.3 }));
    assert.ok(Math.abs(r.clock / r.wall - 1) <= 0.002, `${hz} Hz: nhịp ${r.clock / r.wall}`);
  }
});
t("α trong [0; 1]; giờ vẽ (giờ trận − (1 − α)·STEP) tăng đúng dt × tốc: 120, 144 Hz, chậm hình ×0,25 / ×0,4, vòng lệnh ×0,2 ở 60 Hz", () => {
  const cases = [[120, () => 1], [144, () => 1], [60, () => 0.25], [60, () => 0.4], [60, () => 0.2], [90, (i) => (i % 400 < 100 ? 0.25 : 1)]];
  for (const [hz, scale] of cases) {
    const r = drive(new Pacer(), stamps(hz, 3000, { j: 0.3 }), { scale });
    assert.ok(r.alpha.every((a) => a >= 0 && a <= 1), `${hz} Hz: α ngoài [0;1]`);
    let worst = 0;
    for (let i = 1; i < r.rt.length; i++) worst = Math.max(worst, Math.abs(r.rt[i] - r.rt[i - 1] - r.add[i]));
    // khoá pha chỉ chạy khi dt × tốc ≈ bội STEP (90 Hz ×1 sau chậm hình thì không): sai lệch ≤ một lần chỉnh pha
    assert.ok(worst <= PHASE.max + 1e-9, `${hz} Hz: giờ vẽ lệch ${worst * 1000} ms một khung`);
  }
});
t("60 Hz: giờ vẽ tăng mỗi khung đúng dt (± một lần chỉnh pha ≤ 0,2 ms)", () => {
  const r = drive(new Pacer(), stamps(60, 3000, { j: 0.3 }));
  let worst = 0;
  for (let i = 1; i < r.rt.length; i++) worst = Math.max(worst, Math.abs(r.rt[i] - r.rt[i - 1] - r.add[i]));
  assert.ok(worst <= PHASE.max + 1e-9, `lệch ${worst * 1000} ms`);
});

console.log("Chế độ tua (advance) — tất định");
// Bộ tích lũy cũ của battle.js (trước đợt 19c), chép nguyên văn để so
function oldLoop(seq) {
  let acc = 0; const out = [];
  for (const { dt, scale, brk } of seq) {
    acc += dt * scale; let steps = 0;
    while (acc >= STEP && steps < 4) { acc -= STEP; steps++; if (brk && steps === brk) break; }
    if (steps === 4) acc = 0;
    out.push([steps, acc]);
  }
  return out;
}
t("tua giữ y hệt bộ tích lũy cũ: cùng số bước, cùng acc từng bit (dt 1/30, dt ngẫu nhiên, chậm hình, hit-stop cắt ngang)", () => {
  let s = 12345; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const scales = [1, 1, 1, 0.2, 0.25, 0.4, 0.3, 0];
  for (let run = 0; run < 6; run++) {
    const seq = [];
    for (let i = 0; i < 4000; i++) seq.push({ dt: run < 2 ? 1 / 30 : Math.min(0.1, rnd() * 0.12), scale: scales[Math.floor(rnd() * scales.length)], brk: rnd() < 0.05 ? 1 + Math.floor(rnd() * 3) : 0 });
    const ref = oldLoop(seq), P = new Pacer();
    seq.forEach(({ dt, scale, brk }, i) => {
      P.begin(dt, scale, false); let n = 0;
      while (P.next()) { n++; if (brk && n === brk) break; }
      P.end();
      assert.equal(n, ref[i][0], `lượt ${run} khung ${i}: số bước`);
      assert.ok(Object.is(P.acc, ref[i][1]), `lượt ${run} khung ${i}: acc ${P.acc} ≠ ${ref[i][1]}`);
    });
  }
});
t("reset() không đụng chế độ tua; khung thật đầu tiên đặt pha giữa bước", () => {
  const P = new Pacer(); P.reset(); assert.equal(P.acc, 0);
  P.begin(0, 1, false); P.end(); assert.equal(P.acc, 0);
  P.begin(0, 1, true); P.end(); assert.equal(P.acc, STEP / 2);
  P.begin(STEP * 0.3, 1, true); P.end(); P.reset(); assert.equal(P.acc, STEP / 2);
});
t("hit-stop cắt ngang vòng bước (acc còn ≥ STEP): α = 1; khung hit-stop sau vẫn chạy phần còn như cũ", () => {
  const P = new Pacer();
  P.begin(0, 1, true); P.end();
  P.begin(2.6 * STEP, 1, true); assert.ok(P.next()); P.end();          // cắt sau bước đầu
  assert.ok(P.acc >= STEP); assert.equal(P.alpha, 1);
  P.begin(1 / 60, 0, true); let n = 0; while (P.next()) { n++; break; } P.end();
  assert.equal(n, 1);
});

console.log("Nội suy góc, TRS của rig");
t("lerpYaw đi đường ngắn qua ±π", () => {
  const a = Math.PI - 0.1, b = -Math.PI + 0.1, m = lerpYaw(a, b, 0.5);
  assert.ok(Math.abs(Math.abs(m) - Math.PI) < 1e-12, `${m}`);
  assert.ok(Math.abs(lerpYaw(0.2, 0.6, 0.25) - 0.3) < 1e-12);
  assert.equal(lerpYaw(1.3, 2.1, 0), 1.3); assert.ok(Math.abs(lerpYaw(1.3, 2.1, 1) - 2.1) < 1e-12);
});
// nút giả cùng tên trường với Object3D của three (quaternion lưu ở _x … _w; rotation là Euler riêng)
const node = (x = 0, kids = []) => ({ position: { x, y: 0, z: 0 }, quaternion: { _x: 0, _y: 0, _z: 0, _w: 1 }, scale: { x: 1, y: 1, z: 1 },
  rotation: { _x: 0.11, _y: -0.22, _z: 0.33 }, children: kids });
const yawQ = (n, y) => { n.quaternion._x = 0; n.quaternion._y = Math.sin(y / 2); n.quaternion._z = 0; n.quaternion._w = Math.cos(y / 2); };
const qYaw = (n) => 2 * Math.atan2(n.quaternion._y, n.quaternion._w);
const dump = (n) => [n.position.x, n.position.y, n.position.z, n.quaternion._x, n.quaternion._y, n.quaternion._z, n.quaternion._w, n.scale.x, n.scale.y, n.scale.z, n.rotation._x, n.rotation._y, n.rotation._z];
t("nội suy cả cây: gốc dời 0,1 m, khớp con quay 0,4 rad, tỉ lệ 1 → 0 — α 0,25 ra đúng 1/4, quaternion chuẩn hoá", () => {
  const arm = node(0.3), root = node(5, [node(0, [arm])]);
  const S = new RigSnap(); S.capture(root, true, 1);
  root.position.x = 5.1; yawQ(arm, 0.4); arm.scale.x = 0;              // một bước mô phỏng
  assert.equal(S.apply(0.25), true);
  assert.ok(Math.abs(root.position.x - 5.025) < 1e-12);
  assert.ok(Math.abs(qYaw(arm) - 0.1) < 2e-3, `${qYaw(arm)}`);
  const q = arm.quaternion; assert.ok(Math.abs(q._x ** 2 + q._y ** 2 + q._z ** 2 + q._w ** 2 - 1) < 1e-12);
  assert.ok(Math.abs(arm.scale.x - 0.75) < 1e-12);
  S.restore();
});
t("trả lại đúng từng bit (−0, số lẻ), không đụng góc Euler (rotation)", () => {
  const a = node(0.1), root = node(-0, [a]);
  root.position.y = 1 / 3; a.position.z = -0; yawQ(a, 0.7); a.scale.y = 1.0000000000000002;
  const S = new RigSnap(); S.capture(root, true, 1);
  root.position.x = 0.123456789; yawQ(a, -0.3); a.position.z = 1e-300; a.rotation._y = 0.987654321;
  const before = [dump(root), dump(a)];
  S.apply(0.6); S.restore();
  const after = [dump(root), dump(a)];
  for (let i = 0; i < 2; i++) for (let k = 0; k < before[i].length; k++) assert.ok(Object.is(before[i][k], after[i][k]), `nút ${i} số ${k}: ${before[i][k]} → ${after[i][k]}`);
  const r2 = node(-0); const S2 = new RigSnap(); S2.capture(r2, true, 1); S2.apply(0.5); S2.restore();
  assert.ok(Object.is(r2.position.x, -0));
});
t("ghi hai lần liền (chưa trả) rồi trả: vẫn đúng từng bit giá trị hiện tại", () => {
  const a = node(0.4), root = node(1, [a]);
  const S = new RigSnap(); S.capture(root, true, 1);
  root.position.x = 1.3; yawQ(a, 0.9);
  const before = [dump(root), dump(a)];
  S.apply(0.5); S.apply(0.25); S.restore();
  const after = [dump(root), dump(a)];
  for (let i = 0; i < 2; i++) for (let k = 0; k < before[i].length; k++) assert.ok(Object.is(before[i][k], after[i][k]), `nút ${i} số ${k}`);
});
t("quaternion q rồi −q (cùng hướng): đi đường ngắn, không quay vòng", () => {
  const a = node(), root = node(0, [a]); yawQ(a, 0.5);
  const S = new RigSnap(); S.capture(root, true, 1);
  const q = a.quaternion; q._x = -q._x; q._y = -q._y; q._z = -q._z; q._w = -q._w;
  S.apply(0.5);
  assert.ok(Math.abs(Math.abs(qYaw(a)) - 0.5) < 1e-9 || Math.abs(Math.abs(qYaw(a)) - (2 * Math.PI - 0.5)) < 1e-9, `${qYaw(a)}`);
  S.restore();
});
t(`gốc dời quá ${SNAP_D} m trong một bước (dịch chuyển, hồi sinh, nạp checkpoint): không nội suy, vẽ ngay chỗ mới`, () => {
  const a = node(0.2), root = node(10, [a]);
  const S = new RigSnap(); S.capture(root, true, 1);
  root.position.x = 10 + SNAP_D + 0.01; yawQ(a, 1);
  assert.equal(S.apply(0.5), false);
  assert.equal(root.position.x, 10 + SNAP_D + 0.01); assert.ok(Math.abs(qYaw(a) - 1) < 1e-12);
  S.restore();
  assert.equal(root.position.x, 10 + SNAP_D + 0.01);
});
t("nút gắn thêm giữa bước không bị ghi; nút đã gỡ vẫn được trả đúng", () => {
  const a = node(1), root = node(0, [a]);
  const S = new RigSnap(); S.capture(root, true, 1);
  const b = node(7); root.children = [b]; a.position.x = 2; b.position.x = 9;
  S.apply(0.5);
  assert.equal(b.position.x, 9); assert.equal(a.position.x, 1.5);
  S.restore(); assert.equal(a.position.x, 2);
});
t("chụp nông (deep = false): chỉ gốc; rootAt cho vị trí gốc nội suy (camera, mặt trời) mà không ghi gì", () => {
  const a = node(0.5), root = node(2, [a]);
  const S = new RigSnap(); S.capture(root, false, 3);
  root.position.x = 2.4; root.position.y = 0.2; a.position.x = 1.5;
  const o = {}; S.rootAt(0.5, o);
  assert.ok(Math.abs(o.x - 2.2) < 1e-12 && Math.abs(o.y - 0.1) < 1e-12 && o.z === 0);
  assert.equal(root.position.x, 2.4);
  S.apply(0.5); assert.equal(a.position.x, 1.5); assert.ok(Math.abs(root.position.x - 2.2) < 1e-12);
  S.restore(); assert.equal(root.position.x, 2.4);
  root.position.x = 2 + SNAP_D * 2; S.rootAt(0.5, o); assert.equal(o.x, 2 + SNAP_D * 2);   // dịch chuyển: không nội suy
});

// View.pos: chỗ camera, mặt trời nhắm (battle.js, arena.js) — vị trí mô phỏng của tướng lùi theo đoạn gốc rig đã đi trong bước cuối
const hero = (x, z, rx = x, rz = z) => ({ x, y: 0.25, z, rig: { root: node(rx, []) } });
const place = (h) => { h.rig.root.position.x = h.x; h.rig.root.position.y = h.y; h.rig.root.position.z = h.z; };
t("View.pos khi chưa có bước nào (khung đầu chạy 0 bước): vị trí mô phỏng, không phải gốc rig còn ở chỗ dựng", () => {
  const h = hero(0, 8); h.rig.root.position.x = 72; h.rig.root.position.z = -32;    // Võ trường: tướng dựng ở chỗ B15 rồi mới đặt vào sân
  const V = new View(), o = {};
  V.frame(0.5, 0); V.pos(h, o);
  assert.deepEqual([o.x, o.y, o.z], [0, 0.25, 8]);
});
t("View.pos α = 1 (tua bằng advance, hit-stop): đúng vị trí mô phỏng từng bit như trước đợt 19c", () => {
  const h = hero(1 / 3, -0.1), V = new View(), ctx = { hero: h, units: [] }, o = {};
  V.capture(ctx); h.x += 0.123456789; h.z -= 1e-9; place(h);
  V.frame(1, 1); V.pos(h, o);
  assert.ok(Object.is(o.x, h.x) && Object.is(o.y, h.y) && Object.is(o.z, h.z), JSON.stringify(o));
});
t("View.pos α < 1: lùi (1 − α) đoạn gốc đã đi trong bước; gốc chưa đặt lại (director dời tướng sau bước) vẫn lấy vị trí mô phỏng", () => {
  const h = hero(2, 0), V = new View(), ctx = { hero: h, units: [] }, o = {};
  V.capture(ctx); h.x = 2.4; place(h);
  V.frame(0.25, 1); V.pos(h, o);
  assert.ok(Math.abs(o.x - 2.1) < 1e-12 && o.z === 0, JSON.stringify(o));
  h.x = 5; h.z = 1;                                                     // dời thẳng (captureShot B20), rig chưa place
  V.pos(h, o);
  assert.ok(Math.abs(o.x - 4.7) < 1e-12 && o.z === 1, JSON.stringify(o));
  V.capture(ctx); h.x = 30; place(h); V.frame(0.5, 2); V.pos(h, o);   // gốc dời quá SNAP_D trong một bước: vẽ ngay chỗ mới
  assert.equal(o.x, 30);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
