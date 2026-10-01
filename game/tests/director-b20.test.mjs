// tests/director-b20.test.mjs — bố trí của director B20 (battle/director-b20.js, đợt 9 pha D2): làn dọc sông (tra độ dài cung theo
// x), đội hình hạm đội (đủ thành phần, neo trong khúc cọc, không đè bè cỏ, kỳ hạm cạnh M2), vòng tuần hộ vệ (không chạm làn hạm
// đội, không cắt ngang sông, đủ nước), chỗ đậu đoàn thuyền nhẹ, làn áp mạn của thuyền tiên phong không xuyên thuyền khác.
// Phần 2 (D2b): làn thoát ra cửa sông của hộ vệ đợt hai (né bãi lộ / cụm Phàn Tiếp, không đâm thân thuyền neo, qua bãi cọc để
// mắc cọc được), chỗ áp mạn của cụm Liên Hoàn, số boss.
//   node hao-khi-viet/game/tests/director-b20.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const { lanePath, laneS, patrolLoop, PAR_B20, fleeDz, fleeZonesFor, fleePath, clusterSlot } = await import("../js/battle/director-b20.js");
const { Track, HULLS } = await import("../js/battle/boats.js");
const B = await import("../js/data/battle-b20.js");
const { bedHeight } = await import("../js/data/terrain-b20.js");
const { TIDE_Y, zc, RAFT } = await import("../js/data/river-b20.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} ≉ ${b} (±${tol})`);
const F = B.FORMATION;
const dzOf = (x, z) => z - zc(x);

console.log("Làn dọc sông");
t("laneS: điểm trên làn ở độ dài cung laneS(x) có hoành độ x (sai ≤ 0,05 m), lệch dz đúng", () => {
  for (const dz of [-36, -16, 0, 16, 36]) {
    const tr = new Track(lanePath(dz));
    for (const x of [-250, 40, 333.3, 470, 655, 800, 1180]) { const p = tr.at(laneS(tr, x)); near(p.x, x, 0.05, `dz ${dz}`); near(dzOf(p.x, p.z), dz, 0.05); }
  }
});
t("par B20 = 780 s (canon 13 phút)", () => assert.equal(PAR_B20, 780));

console.log("Hạm đội");
t("đội hình: 24 thuyền đúng thành phần canon (1 kỳ hạm, 1 thuyền Phàn Tiếp, 6 hộ vệ, 16 chiến thuyền), id không trùng", () => {
  const ids = F.ships.map((s) => s[0]); assert.equal(new Set(ids).size, 24);
  const c = { flagship: 0, escort: 0, junk: 0 }; for (const [, type] of F.ships) c[type]++;
  assert.equal(c.flagship, B.FLEET.composition.flagship); assert.equal(c.escort, B.FLEET.composition.escort);
  assert.equal(c.junk, B.FLEET.composition.junk + B.FLEET.composition.command);
  assert.ok(ids.includes("PT") && ids.includes("FS"));
});
// thân thuyền (không kể hộ vệ đã tách đội) khi đầu hạm đội neo ở FLEET.stopX
const anchored = F.ships.filter(([, type]) => type !== "escort").map(([id, type, row, lane]) => ({ id, type, x: B.FLEET.stopX - F.rowGap * row, dz: F.lanes[lane], H: HULLS[type] }));
t("neo ở pha 2–3: khối thuyền trong khúc cọc (x 480–820), kỳ hạm cạnh M2, thuyền Phàn Tiếp cạnh kỳ hạm", () => {
  for (const s of anchored) assert.ok(s.x - s.H.len / 2 >= B.RIVER.reach.x0 - 5 && s.x + s.H.len / 2 <= B.RIVER.reach.x1, `${s.id} x ${s.x}`);
  const fs = anchored.find((s) => s.id === "FS"), pt = anchored.find((s) => s.id === "PT"), m2 = B.STAKES.find((s) => s.id === "M2");
  assert.ok(Math.abs(fs.x - m2.x) <= 15, "kỳ hạm cạnh M2"); assert.ok(Math.hypot(fs.x - pt.x, fs.dz - pt.dz) <= 40, "Phàn Tiếp cạnh kỳ hạm");
});
t("không thuyền nào đè bè cỏ (cách mép bè ≥ 5 m theo ngang sông) — người chơi mở mốc, đò cập bè được", () => {
  for (const s of anchored) for (const m of B.STAKES) {
    if (Math.abs(s.x - m.x) > s.H.len / 2 + RAFT.w / 2) continue;
    assert.ok(Math.abs(s.dz) - s.H.beam / 2 - RAFT.d / 2 >= 5, `${s.id} đè bè ${m.id}`);
  }
});
t("mỗi mốc cọc có thuyền neo trong khuôn bãi (để bãi đã mở giữ được thuyền ở pha 4–5)", () => {
  for (const m of B.STAKES) assert.ok(anchored.some((s) => Math.abs(s.x - m.x) <= m.along / 2 && Math.abs(s.dz) <= m.across / 2), m.id);
});

console.log("Hộ vệ, đoàn thuyền nhẹ");
const O = B.ESCORT_OPS;
t("vòng tuần hộ vệ: cùng phía làn xuất phát, không chạm làn ngoài của hạm đội (≥ 3 m), đủ nước lúc triều 50%", () => {
  const outer = Math.max(...F.lanes.map(Math.abs)) + HULLS.flagship.beam / 2;
  for (const [id, , , lane] of F.ships.filter((s) => s[1] === "escort")) {
    const st = O.stations[id]; assert.ok(st, id);
    assert.equal(Math.sign(F.lanes[lane]), st[2], `${id}: vòng tuần phía bên kia sông`);
    for (const p of patrolLoop(st)) {
      assert.ok(Math.abs(dzOf(p.x, p.z)) - HULLS.escort.beam / 2 >= outer + 3 - 1e-9, `${id} sát làn hạm đội`);
      assert.ok(TIDE_Y(50) - bedHeight(p.x, p.z) >= HULLS.escort.draft + 0.3, `${id} cạn ở ${p.x.toFixed(0)}`);
    }
  }
});
t("chỗ đậu đoàn thuyền nhẹ (pha 2+): ngoài vòng tuần hộ vệ, còn nổi tới khi cọc nhô (30%; nước ròng thì nằm trên bùn như mọi thuyền trong khúc cọc)", () => {
  const loopOut = O.dz[1] + HULLS.escort.beam / 2;
  for (const [x, dz] of [B.FLOTILLA.hold.lead, ...B.FLOTILLA.hold.boats]) {
    assert.ok(Math.abs(dz) - HULLS.lead.beam / 2 >= loopOut + 2, `chỗ đậu ${x},${dz} sát vòng tuần`);
    assert.ok(TIDE_Y(B.TIDE.strandAt) - bedHeight(x, zc(x) + dz) >= HULLS.lead.draft + 0.3, `chỗ đậu ${x},${dz} cạn`);
  }
});
t("thuyền tiên phong áp mạn theo làn kề thuyền đích, không xuyên thân thuyền nhẹ khác (cách ≥ 1 m)", () => {
  const slots = [[0, 0, HULLS.lead], ...B.FLOTILLA.slots.map(([dx, dz]) => [dx, dz, HULLS.light])];
  const vb = HULLS.scout.beam / 2;
  for (const [, dz0, H] of slots) {
    const sg = dz0 > 0 ? -1 : 1, dzA = dz0 - sg * (H.beam / 2 + vb + B.VANGUARD.gap);
    for (const [, dz, H2] of slots) if (dz !== dz0) assert.ok(Math.abs(dz - dzA) - H2.beam / 2 - vb >= 1, `làn áp mạn ${dzA} xuyên thuyền ở dz ${dz}`);
  }
});

console.log("Pha 4–6 (D2b)");
const E = B.EBB_OPS, C = B.CLUSTER;
// thân thuyền neo lúc pha 4: đội hình ở FLEET.stopX, J8 dạt sát mạn thuyền chỉ huy, J12 tiến lên thế chỗ (cụm Liên Hoàn)
const pt0 = anchored.find((s) => s.id === "PT");
const n1 = clusterSlot({ x: pt0.x, z: pt0.dz, yaw: Math.PI / 2, beam: pt0.H.beam }, { x: pt0.x, z: 36, beam: HULLS.junk.beam });
const p4ships = anchored.map((s) => (s.id === "J8" ? { ...s, dz: n1.z } : s.id === "J12" ? { ...s, x: pt0.x } : s));
const clusterZone = [pt0.x - pt0.H.len / 2 - E.avoid, pt0.x + pt0.H.len / 2 + E.avoid, 1];
t("làn thoát: ngoài vùng né |dz| = lane, trong vùng né laneOut, vùng một phía chỉ đẩy phía đó; liền mạch (bước 1 m lệch ≤ 1,5 m)", () => {
  assert.equal(fleeDz(300, 1), E.lane); assert.equal(fleeDz(300, -1), -E.lane);
  const Z = [[600, 700, 1]];
  assert.equal(fleeDz(650, 1, Z), E.laneOut); assert.equal(fleeDz(650, -1, Z), -E.lane);
  assert.equal(fleeDz(650, -1, [[600, 700, 0]]), -E.laneOut);
  let prev = fleeDz(500, 1, Z); for (let x = 501; x < 800; x++) { const v = fleeDz(x, 1, Z); assert.ok(Math.abs(v - prev) <= 1.5, `x ${x}`); prev = v; }
});
t("hộ vệ đợt hai: 8 chỗ xuất phát, chạy tới quá cửa sông; làn không đâm thân thuyền neo (khe ≥ 2 m), kể cả cụm Phàn Tiếp, bãi lộ", () => {
  assert.equal(E.starts.length, B.FLEET.escorts[1]);
  const eb = HULLS.escort.beam / 2;
  const ex = (id) => { const m = B.STAKES.find((q) => q.id === id); return [m.x - m.along / 2 - E.avoid, m.x + m.along / 2 + E.avoid, 0]; };
  for (const zones of [[clusterZone], [clusterZone, ex("M2")], [clusterZone, ex("M1"), ex("M3")]]) for (const [x0, side] of E.starts) {
    const P = fleePath(x0, zc(x0) + fleeDz(x0, side, fleeZonesFor(x0, side, zones)), side, zones);
    assert.ok(P[P.length - 1].x >= B.MAP.exitX, "chưa tới cửa sông");
    for (const p of P) for (const s of p4ships) {
      if (Math.abs(p.x - s.x) > s.H.len / 2 + HULLS.escort.len / 2) continue;
      const gap = Math.abs(dzOf(p.x, p.z) - s.dz) - s.H.beam / 2 - eb;
      assert.ok(gap >= 2, `hộ vệ xuất phát ${x0} đâm ${s.id} ở x ${p.x.toFixed(0)} (khe ${gap.toFixed(1)})`);
    }
  }
});
t("làn thoát (không né) nằm trong khuôn bãi cọc: hộ vệ chạy qua bãi đã mở lúc nước 30% thì mắc cọc; chỗ xuất phát đủ nước lúc 50%", () => {
  for (const m of B.STAKES) assert.ok(E.lane <= m.across / 2, m.id);
  for (const [x, side] of E.starts) assert.ok(TIDE_Y(50) - bedHeight(x, zc(x) + fleeDz(x, side, fleeZonesFor(x, side, [clusterZone]))) >= HULLS.escort.draft + 0.3, `xuất phát ${x} cạn`);
});
t("cụm Liên Hoàn: J8 sát mạn thuyền chỉ huy đúng khe gap, cùng hướng; J12 (làn +36) cách J8 ≥ 2 m; cả cụm cạn lúc nước ròng", () => {
  near(Math.abs(n1.z - pt0.dz) - pt0.H.beam / 2 - HULLS.junk.beam / 2, C.gap, 1e-9); near(n1.x, pt0.x, 1e-9);
  assert.ok(36 - n1.z - HULLS.junk.beam >= 2);
  for (const dz of [pt0.dz, n1.z, 36]) assert.ok(TIDE_Y(0) - bedHeight(pt0.x, zc(pt0.x) + dz) < HULLS.junk.draft, `dz ${dz} không cạn lúc nước ròng`);
  assert.deepEqual(C.ids, ["J8", "J12"]);
});
t("boss: Ô Mã Nhi Đại tướng (HP 12000, Phá Thế 1000 × 2 tầng), khóa lầu 10% < khóa boong 50%; Phàn Tiếp xích dưới 50%, khóa 25%", () => {
  const X20 = B.BOSSES.X20, X24 = B.BOSSES.X24, O = B.BOSS_OPS;
  assert.equal(X20.hp, 12000); assert.equal(X20.poise, 1000); assert.equal(X20.poisePhases, 2); assert.equal(X20.defeatMeans, "bị bắt");
  assert.ok(X20.hpLockPct < O.X20.deckLockPct); assert.ok(O.X24.lockPct < X24.chainAtPct);
  assert.equal(O.X20.guards.length, 3); for (const n of O.X20.guards) assert.ok(n >= 3 && n <= 5, "nhóm 3–5");
  assert.ok(O.afterCapture + O.outroSec <= 10, "cảnh kết ≤ 10 s");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exit(1);
