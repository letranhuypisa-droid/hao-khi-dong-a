// tests/terrain-b20.test.mjs — địa hình khúc sông Bạch Đằng (data/terrain-b20.js) trong Node.
//   node hao-khi-viet/game/tests/terrain-b20.test.mjs
import assert from "node:assert/strict";
import {
  TIDE, TIDE_Y, zc, hw, bedHeight, bedHeightExact, bedHeightLin, depthAt, riverMask, tribAt, inReach, stakeFieldAt,
  waterDist, mudAt, waveY, TERRAIN_B20, WADE_MAX, TRIBS, tribPoint, HQ_PAD, gridAxis, ensureLut, LUT_INFO,
} from "../js/data/terrain-b20.js";
import { RIVER, STAKE_FIELDS, STAKE_TOP } from "../js/data/river-b20.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
const B = TERRAIN_B20.bounds;
// điểm gần cửa lạch (xoáy sâu hơn bãi cạn một chút, cố ý): loại khỏi phép thử độ sâu bãi cạn
const nearMouth = (x, z) => TRIBS.some((tr) => Math.hypot(x - tr.x0, z - tr.z0) < 45);

console.log("Con nước, hằng số");
t("TIDE_Y: 0% = −1,6 m, 100% = +1,4 m, kẹp ngoài 0..100", () => {
  near(TIDE_Y(0), -1.6, 1e-9); near(TIDE_Y(100), 1.4, 1e-9); near(TIDE_Y(50), -0.1, 1e-9);
  near(TIDE_Y(-20), TIDE.low, 1e-9); near(TIDE_Y(140), TIDE.high, 1e-9);
});
t("WADE_MAX 0,9 m; TERRAIN_B20 đủ trường cho ground.js", () => {
  assert.equal(WADE_MAX, 0.9);
  for (const k of ["id", "height", "bare", "mud", "waterDist", "bounds", "clamp", "gridSpans"]) assert.ok(k in TERRAIN_B20, k);
  assert.equal(TERRAIN_B20.id, "B20"); assert.equal(TERRAIN_B20.height, bedHeight);
  assert.deepEqual(TERRAIN_B20.bounds, { minX: -200, maxX: 1320, minZ: -300, maxZ: 300 });
  assert.deepEqual(TERRAIN_B20.clamp, { x0: -60, x1: 1240, z0: -240, z1: 240 });
});

console.log("Liền mạch");
t("không vách > 1,5 m trên bước 2 m (hàm giải tích, toàn bản đồ, lưới 2 m)", () => {
  let worst = 0, at = null;
  for (let x = B.minX; x < B.maxX - 2; x += 2) for (let z = B.minZ; z < B.maxZ - 2; z += 2) {
    const h = bedHeightExact(x, z), d = Math.max(Math.abs(bedHeightExact(x + 2, z) - h), Math.abs(bedHeightExact(x, z + 2) - h));
    if (d > worst) { worst = d; at = [x, z]; }
  }
  assert.ok(worst <= 1.5, `bậc ${worst.toFixed(2)} m tại ${at}`);
});
t("bảng (Catmull-Rom) cũng không vách > 1,5 m trên bước 2 m, lệch pha 1 m", () => {
  let worst = 0;
  for (let x = B.minX + 1; x < B.maxX - 3; x += 2) for (let z = B.minZ + 1; z < B.maxZ - 3; z += 2) {
    const h = bedHeight(x, z); worst = Math.max(worst, Math.abs(bedHeight(x + 2, z) - h), Math.abs(bedHeight(x, z + 2) - h));
  }
  assert.ok(worst <= 1.5, `bậc ${worst.toFixed(2)} m`);
});
t("bờ bùn: mép lòng ≈ −1,9, đỉnh bờ ≈ +2,2 sau 14 m (theo pháp tuyến bờ), dốc nhất ≤ 0,65 m/m", () => {
  for (const x of [100, 300, 540, 600, 700, 900]) for (const side of [-1, 1]) {
    const q = tribAt(x, zc(x) + side * hw(x)); if (q && q.ad < q.hw + 45) continue;           // cửa lạch: bờ vòng theo lạch
    const k = 1 / Math.hypot(1, (zc(x + 0.5) - zc(x - 0.5)) + side * (hw(x + 0.5) - hw(x - 0.5)));   // bờ xiên
    const at = (e) => bedHeightExact(x, zc(x) + side * (hw(x) + e / k));
    near(at(0), -1.9, 0.02, `mép x ${x} bờ ${side}`);
    const top = at(14); assert.ok(top >= 2.19 && top <= 2.3, `đỉnh bờ x ${x} bờ ${side}: ${top.toFixed(3)}`);   // gợn dải bờ bắt đầu từ e 10
    let s = 0; for (let e = 0; e < 14; e += 0.5) s = Math.max(s, (at(e + 0.5) - at(e)) / (0.5 / k));
    assert.ok(s <= 0.65, `dốc bờ ${s.toFixed(2)} m/m tại x ${x} bờ ${side}`);
  }
});

console.log("Độ sâu theo con nước");
t("khúc cọc (x 480–820, |z − zc| < hw − 12): triều cao sâu 3,0–4,0 m, triều ròng 0,3–0,7 m (lội được, thuyền mắc)", () => {
  let lo = 9, hi = -9, lo0 = 9, hi0 = -9;
  for (let x = 480; x <= 820; x += 3) for (let d = -(hw(x) - 12); d <= hw(x) - 12; d += 3) {
    const z = zc(x) + d; if (nearMouth(x, z)) continue;
    const h = depthAt(x, z, 100), l = depthAt(x, z, 0);
    lo = Math.min(lo, h); hi = Math.max(hi, h); lo0 = Math.min(lo0, l); hi0 = Math.max(hi0, l);
  }
  assert.ok(lo >= 3.0 && hi <= 4.0, `triều cao ${lo.toFixed(2)}..${hi.toFixed(2)}`);
  assert.ok(lo0 >= 0.3 && hi0 <= 0.7, `triều ròng ${lo0.toFixed(2)}..${hi0.toFixed(2)}`);
  assert.ok(hi0 < WADE_MAX, "bãi cạn lội được khi triều ròng");
});
t("lòng sâu ngoài khúc cọc: triều ròng giữa dòng vẫn sâu ≥ 2,5 m (thuyền lớn đi được), triều cao ≥ 5,5 m", () => {
  for (const x of [-150, 0, 150, 300, 400, 900, 1000, 1100, 1200, 1300]) for (const d of [-20, 0, 20]) {
    assert.ok(depthAt(x, zc(x) + d, 0) >= 2.5, `x ${x} d ${d}: ${depthAt(x, zc(x) + d, 0).toFixed(2)}`);
    assert.ok(depthAt(x, zc(x) + d, 100) >= 5.5, `x ${x} d ${d}`);
  }
});
t("khúc cọc hoà về lòng sâu trong 40 m ở hai đầu (inReach 0 → 1)", () => {
  near(inReach(430), 0, 1e-9); near(inReach(480), 1, 1e-9); near(inReach(650), 1, 1e-9); near(inReach(820), 1, 1e-9); near(inReach(870), 0, 1e-9);
  assert.ok(inReach(460) > 0 && inReach(460) < 1);
  // đáy giữa dòng đi từ −4,6 lên −2,1 êm (không bậc > 0,3 m mỗi 2 m)
  let prev = bedHeight(400, zc(400));
  for (let x = 402; x <= 900; x += 2) { const h = bedHeight(x, zc(x)); assert.ok(Math.abs(h - prev) < 0.3, `x ${x}`); prev = h; }
});
t("bờ và đất liền khô cả khi triều cao; dải bờ +2,2..+3,0", () => {
  for (let x = -150; x <= 1300; x += 25) for (const side of [-1, 1]) {
    const z = zc(x) + side * (hw(x) + 20);
    if (TRIBS.some((tr) => { const q = tribAt(x, z); return q && q.ad < q.hw + 30; })) continue;
    if (Math.abs(z) > 290) continue;
    const y = bedHeight(x, z); assert.ok(depthAt(x, z, 100) < -0.5, `x ${x} bờ ${side}: y ${y.toFixed(2)}`);
    if (Math.hypot(x - HQ_PAD.x, z - HQ_PAD.z) > HQ_PAD.r + HQ_PAD.blend) assert.ok(y >= 2.15 && y <= 3.05, `dải bờ x ${x} bờ ${side}: ${y.toFixed(2)}`);
  }
});
t("đồi rừng / đá vôi: đất cách bờ ≥ 150 m cao trung bình ≥ 18 m, cao nhất ≤ 70 m", () => {
  let sum = 0, n = 0, mx = 0;
  for (let x = 0; x <= 1000; x += 10) for (const side of [-1, 1]) {
    const z = zc(x) + side * (hw(x) + 160); if (Math.abs(z) > 295) continue;
    const q = tribAt(x, z); if (q && q.ad < q.hw + 110) continue;
    const y = bedHeight(x, z); sum += y; n++; mx = Math.max(mx, y);
  }
  assert.ok(n > 50 && sum / n >= 18, `trung bình ${(sum / n).toFixed(1)} m (${n} điểm)`);
  for (let x = B.minX; x <= B.maxX; x += 8) for (let z = B.minZ; z <= B.maxZ; z += 8) mx = Math.max(mx, bedHeight(x, z));
  assert.ok(mx <= 70, `cao nhất ${mx.toFixed(1)}`);
});
t("gò bản doanh (x 600, zc − 125): phẳng (±0,05 m trong bán kính 20 m), cao ≥ 6 m, khô", () => {
  const P = HQ_PAD; near(P.x, 600, 0); near(P.z, zc(600) - 125, 1e-9);
  for (let a = 0; a < 6.28; a += 0.5) for (const r of [0, 10, 20]) {
    const y = bedHeight(P.x + r * Math.cos(a), P.z + r * Math.sin(a)); near(y, P.y, 0.05, `r ${r}`);
  }
  assert.ok(P.y >= 6);
});

console.log("Bãi cọc");
t("ba mốc M1/M2/M3 nằm trên bãi cạn, đúng khuôn 70 × 60 m quanh tâm dòng", () => {
  for (const f of STAKE_FIELDS) {
    assert.equal(stakeFieldAt(f.x, zc(f.x)), f.id);
    assert.equal(stakeFieldAt(f.x + 34, zc(f.x + 34) + 29), f.id);
    assert.equal(stakeFieldAt(f.x - 34, zc(f.x - 34) - 29), f.id);
    assert.equal(stakeFieldAt(f.x, zc(f.x) + 31), null);
    assert.equal(stakeFieldAt(f.x + 36, zc(f.x + 36)), null);
    assert.equal(inReach(f.x - 35), 1); assert.equal(inReach(f.x + 35), 1);
    for (let dx = -35; dx <= 35; dx += 5) for (let dz = -30; dz <= 30; dz += 5) {
      const x = f.x + dx, z = zc(x) + dz, y = bedHeight(x, z);
      assert.ok(y >= -2.35 && y <= -1.85, `${f.id} (${dx},${dz}): đáy ${y.toFixed(2)}`);
      // cọc dài nhất (đỉnh = đáy + STAKE_TOP.max) chìm ≥ 0,5 m khi triều cao; ngắn nhất (đáy + STAKE_TOP.min) nhô khi triều ròng
      assert.ok(TIDE_Y(100) - (y + STAKE_TOP.max) >= 0.5, `${f.id} cọc lộ khi triều cao`);
      assert.ok(TIDE_Y(0) - (y + STAKE_TOP.min) < 0, `${f.id} cọc không lộ khi triều ròng`);
    }
  }
  assert.equal(stakeFieldAt(300, zc(300)), null);
});

console.log("Nhánh sông");
t("ba lạch Chanh (bắc, x 430), Rút (nam, x 620), Giá (bắc, x 820): cửa ở đúng bờ, hướng như hợp đồng", () => {
  const byId = Object.fromEntries(TRIBS.map((tr) => [tr.id, tr]));
  assert.deepEqual(Object.keys(byId).sort(), ["chanh", "gia", "rut"]);
  assert.equal(byId.chanh.mouthX, 430); assert.equal(byId.rut.mouthX, 620); assert.equal(byId.gia.mouthX, 820);
  assert.ok(byId.chanh.z0 < zc(430) && byId.gia.z0 < zc(820) && byId.rut.z0 > zc(620));   // bắc = z âm
  assert.ok(byId.chanh.dx < 0 && byId.chanh.dz < 0, "Chanh tây bắc");
  assert.ok(byId.rut.dx > 0 && byId.rut.dz > 0, "Rút đông nam");
  assert.ok(byId.gia.dx > 0 && byId.gia.dz < 0, "Giá đông bắc");
});
t("mỗi lạch nối liền sông cái: dọc tim lạch từ cuối ra cửa rồi vào giữa dòng đáy ≤ −2,4 m, luôn có nước ở 50% con nước", () => {
  for (const tr of TRIBS) {
    for (let s = tr.len; s >= -20; s -= 2) {
      const p = tribPoint(tr, s), y = bedHeight(p.x, p.z);
      assert.ok(y <= -2.4, `${tr.id} s ${s}: đáy ${y.toFixed(2)}`);
      assert.ok(depthAt(p.x, p.z, 50) > 2, `${tr.id} s ${s}`);
      assert.ok(riverMask(p.x, p.z) > 0.99, `${tr.id} s ${s} mask`);
    }
    // đi tiếp từ cửa lạch thẳng vào tâm dòng: vẫn ngập
    const m = tribPoint(tr, -20), n = 20;
    for (let k = 0; k <= n; k++) { const x = m.x + (tr.x0 - m.x) * 0, z = m.z + (zc(m.x) - m.z) * k / n; assert.ok(depthAt(x, z, 50) > 1.5, `${tr.id} ra giữa dòng ${k}`); }
  }
});
t("lạch: đáy −2,6 m giữa lạch (60–120 m trong lạch, chỗ thuyền phục), triều ròng vẫn sâu ~1 m", () => {
  for (const tr of TRIBS) for (let s = 30; s <= 140; s += 10) {
    const p = tribPoint(tr, s); near(bedHeight(p.x, p.z), -2.6, 0.05, `${tr.id} s ${s}`);
    near(depthAt(p.x, p.z, 0), 1.0, 0.06);
  }
});
t("tribAt: đúng lạch, t theo quãng dọc lạch, d lệch ngang có dấu; xa lạch → null", () => {
  for (const tr of TRIBS) {
    const p = tribPoint(tr, 90), q = tribAt(p.x, p.z);
    assert.equal(q.id, tr.id); near(q.t, 0.6, 1e-6); near(q.d, 0, 1e-6);
    const r = tribPoint(tr, 90, 8), qr = tribAt(r.x, r.z); assert.equal(qr.id, tr.id); near(qr.d, 8, 1e-6);
  }
  assert.equal(tribAt(100, zc(100)), null);
  assert.equal(tribAt(600, -280), null);
});

console.log("Vùng nước, bùn, sóng");
t("waterDist âm trong nước, dương trên bờ; riverMask 1 giữa dòng và trong lạch, 0 trên đồi", () => {
  for (const x of [0, 300, 650, 1000, 1200]) {
    assert.ok(waterDist(x, zc(x)) < -50); near(riverMask(x, zc(x)), 1, 1e-9);
    const zb = zc(x) - hw(x) - 40; if (!tribAt(x, zb)) { assert.ok(waterDist(x, zb) > 20, `x ${x}`); near(riverMask(x, zb), 0, 1e-9); }
  }
  // đường nước triều cao: waterDist ≈ 0 ở chỗ đáy = +1,4 (sai < 1 m) trên bờ không xiên
  for (const x of [100, 300, 700]) {
    let z = zc(x) + hw(x); while (bedHeightExact(x, z) < TIDE.high) z += 0.05;
    assert.ok(Math.abs(waterDist(x, z)) < 1, `x ${x}: ${waterDist(x, z).toFixed(2)}`);
  }
});
t("mud: 1 trên bãi bùn triều (dưới mức triều cao), 0 trên dải bờ và đồi", () => {
  near(mudAt(650, zc(650), 0), 1, 1e-9);
  near(mudAt(300, zc(300) + hw(300) + 6, 50), 1, 1e-9);
  near(mudAt(300, zc(300) - hw(300) - 25, 50), 0, 1e-9);
  near(mudAt(HQ_PAD.x, HQ_PAD.z, 0), 0, 1e-9);
});
t("waveY: lặng sát bờ (sâu 0), biên độ ≤ 0,3 m ngoài dòng", () => {
  near(waveY(10, 20, 3.3, 0), 0, 1e-12);
  let mx = 0; for (let k = 0; k < 2000; k++) mx = Math.max(mx, Math.abs(waveY(k * 1.7, k * 0.9, k * 0.13, 5)));
  assert.ok(mx > 0.1 && mx <= 0.3, `biên độ ${mx}`);
});

console.log("Lưới địa hình, bảng tra");
t("gridSpans phủ đúng khung bản đồ, liền mạch, bước 2 m ở hai dải bờ bùn, ≤ 12 m giữa lòng; ≤ 110 nghìn tam giác", () => {
  for (const [ax, lo, hi] of [["x", B.minX, B.maxX], ["z", B.minZ, B.maxZ]]) {
    const S = TERRAIN_B20.gridSpans[ax];
    assert.equal(S[0][0], lo); assert.equal(S[S.length - 1][1], hi);
    for (let k = 1; k < S.length; k++) assert.equal(S[k][0], S[k - 1][1]);
    for (const s of S) assert.ok(s[2] >= 2 && s[2] <= 12);
  }
  const xs = gridAxis(TERRAIN_B20.gridSpans.x), zs = gridAxis(TERRAIN_B20.gridSpans.z);
  // bờ bùn (bắc và nam, x ≤ 880) nằm trong dải z bước 2 m
  const fine = TERRAIN_B20.gridSpans.z.filter((s) => s[2] === 2);
  for (let x = -60; x <= 880; x += 5) for (const side of [-1, 1]) for (const e of [0, 7, 14]) {
    const z = zc(x) + side * (hw(x) + e); assert.ok(fine.some((s) => z >= s[0] && z <= s[1]), `bờ x ${x} bờ ${side} e ${e}: z ${z.toFixed(1)}`);
  }
  const tris = (xs.length - 1) * (zs.length - 1) * 2;
  assert.ok(tris <= 110000, `${tris} tam giác`);
});
t("bảng 2 m (Catmull-Rom) lệch hàm giải tích < 0,05 m (lưới lệch pha dày + quanh cửa lạch)", () => {
  let worst = 0, at = null;
  const probe = (x, z) => { const e = Math.abs(bedHeight(x, z) - bedHeightExact(x, z)); if (e > worst) { worst = e; at = [x.toFixed(1), z.toFixed(1)]; } };
  for (let x = B.minX + 0.37; x < B.maxX; x += 1.13) for (let z = B.minZ + 0.29; z < B.maxZ; z += 0.97) probe(x, z);
  for (const tr of TRIBS) for (let s = -40; s <= tr.len + 60; s += 0.7) for (let l = -70; l <= 70; l += 0.9) { const p = tribPoint(tr, s, l); probe(p.x, p.z); }
  assert.ok(worst < 0.05, `lệch ${worst.toFixed(3)} m tại ${at}`);
  // bản song tuyến rẻ hơn: lệch vừa phải (< 0,12 m)
  let wl = 0; for (let x = B.minX + 0.37; x < B.maxX; x += 2.13) for (let z = B.minZ + 0.29; z < B.maxZ; z += 1.97) wl = Math.max(wl, Math.abs(bedHeightLin(x, z) - bedHeightExact(x, z)));
  assert.ok(wl < 0.12, `song tuyến lệch ${wl.toFixed(3)}`);
});
t("ngoài khung bảng: rơi về hàm giải tích, không NaN", () => {
  near(bedHeight(-400, zc(-400)), bedHeightExact(-400, zc(-400)), 1e-9);
  near(bedHeight(1500, 350), bedHeightExact(1500, 350), 1e-9);
  assert.ok(Number.isFinite(bedHeight(B.maxX, B.maxZ)) && Number.isFinite(bedHeight(B.minX, B.minZ)));
});
// Máy bận (nhiều Chrome headless chạy song song) làm số đo dao động gấp 3–5 lần: đo tới 12 lượt, lấy lượt nhanh nhất.
t("hiệu năng: 1e6 lần bedHeight < 150 ms (lượt nhanh nhất trong ≤ 12; bảng dựng trước)", () => {
  ensureLut();
  let best = 1e9, acc = 0;
  for (let r = 0; r < 12 && best >= 150; r++) {
    const t0 = performance.now();
    for (let i = 0; i < 1e6; i++) acc += bedHeight(-150 + (i % 1400) * 0.93, -280 + (i * 7 % 560) * 0.97);
    best = Math.min(best, performance.now() - t0);
  }
  assert.ok(Number.isFinite(acc));
  console.log(`       (1e6 lần: ${best.toFixed(1)} ms; dựng bảng ${LUT_INFO.nx}×${LUT_INFO.nz}: ${LUT_INFO.ms.toFixed(0)} ms)`);
  assert.ok(best < 150, `${best.toFixed(1)} ms`);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
