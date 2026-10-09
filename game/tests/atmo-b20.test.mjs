// tests/atmo-b20.test.mjs — khí quyển, nhạc, nền tiếng của B20 (data/atmo-b20.js) theo khuôn atmosphere.js. Chạy trong Node:
//   node hao-khi-viet/game/tests/atmo-b20.test.mjs
import assert from "node:assert/strict";
import { ATMO_B20, ATMO_B20_PRESETS, buildSourcesB20, sourceWantB20, musicB20, bedB20, wireAtmoB20, COOK_FIRES, BATTLE_SMOKE } from "../js/data/atmo-b20.js";
import { presetVec, NV, O, ATMO, ATMO_TPC, sunDir } from "../js/battle/atmosphere.js";
import { HQ_PAD, TIDE_Y, zc } from "../js/data/terrain-b20.js";
import { PHASES } from "../js/data/battle-b20.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

console.log("Bảng pha");
t("6 bảng, đủ pha của trận, id P1..P6", () => {
  assert.equal(ATMO_B20_PRESETS.length, 6); assert.equal(ATMO_B20_PRESETS.length, PHASES.length);
  ATMO_B20_PRESETS.forEach((p, i) => assert.equal(p.id, "P" + (i + 1)));
});
t("mỗi bảng có đủ trường của B15 (không NaN sau presetVec)", () => {
  const keys = Object.keys(ATMO[0]);
  for (const p of ATMO_B20_PRESETS) {
    assert.deepEqual(Object.keys(p).sort(), keys.sort(), p.id);
    const v = presetVec(p); assert.equal(v.length, NV);
    for (let i = 0; i < NV; i++) assert.ok(Number.isFinite(v[i]), `${p.id} ô ${i}`);
  }
});
t("sương đủ xa cho khúc sông 1,5 km (trừ sương sớm P1), gần < xa", () => {
  for (const p of ATMO_B20_PRESETS) {
    assert.ok(p.fogNear < p.fogFar, p.id);
    assert.ok(p.fogFar >= (p.id === "P1" ? 500 : 900), `${p.id} fogFar ${p.fogFar}`);
  }
});
t("nắng: sáng thấp phía đông → trưa cao → chiều thấp phía tây", () => {
  const el = ATMO_B20_PRESETS.map((p) => p.el), az = ATMO_B20_PRESETS.map((p) => p.az);
  assert.ok(el[0] < el[1] && el[1] < el[2] && el[2] < el[3], "sáng lên dần");
  assert.ok(el[3] > el[4] && el[4] > el[5], "chiều xuống dần");
  assert.ok(sunDir(el[0], az[0]).x > 0.9, "P1 mặt trời phía đông (+x)");
  assert.ok(sunDir(el[5], az[5]).x < -0.9, "P6 mặt trời phía tây (−x)");
  for (const p of ATMO_B20_PRESETS) assert.ok(p.el > 5 && p.el < 85, p.id);
});
t("không lửa bay (embers 0 mọi pha); cột khói giao chiến chỉ P5–P6", () => {
  for (const p of ATMO_B20_PRESETS) assert.equal(p.embers, 0, p.id);
  assert.deepEqual(ATMO_B20_PRESETS.map((p) => p.cols > 0), [false, false, false, false, true, true]);
});
t("ATMO_B20 đúng khuôn ctx.battle.atmo; lớp TPC dùng chung của B15", () => {
  assert.equal(ATMO_B20.presets, ATMO_B20_PRESETS); assert.equal(ATMO_B20.tpc, ATMO_TPC);
  assert.equal(typeof ATMO_B20.buildSources, "function"); assert.equal(typeof ATMO_B20.sourceWant, "function");
  assert.ok(ATMO_B20.glowFrom > 5, "không đèn lửa");
});

console.log("Nguồn khói, lửa");
const world = { groundY: (x, z) => (Math.abs(z - zc(x)) < 60 ? -2.1 : 8) };
const src = buildSourcesB20(world);
t("bếp nấu ở bản doanh (có lửa nhỏ) + cột khói giao chiến (fs 0: chỉ khói)", () => {
  const cook = src.filter((s) => s.kind === "cook"), fight = src.filter((s) => s.kind === "battle");
  assert.equal(cook.length, COOK_FIRES.length); assert.equal(fight.length, BATTLE_SMOKE.length);
  for (const s of cook) { assert.ok(s.fs > 0 && s.fs <= 1.2); assert.ok(Math.hypot(s.x - HQ_PAD.x, s.z - HQ_PAD.z) < 30); assert.equal(s.y, 8); }
  // cột khói giao chiến: dọc khúc cọc nhưng trên hai bờ / cửa nhánh (|dz| ≥ 80 — xa thân thuyền, không đọc thành thuyền cháy), bụi nhạt
  for (const s of fight) { assert.equal(s.fs, 0); assert.equal(s.fw, 0); assert.ok(s.x >= 460 && s.x <= 840, "dọc khúc cọc"); assert.ok(Math.abs(s.z - zc(s.x)) >= 80, "trên bờ");
    assert.equal(s.y, Math.max(8, TIDE_Y(0))); assert.ok(s.col && s.col[0] > 0.4, "màu bụi nhạt"); }
  for (const s of src) for (const k of ["kind", "id", "x", "z", "y", "h", "fs", "fw", "k", "acc", "facc", "eacc"]) assert.ok(k in s, k);
  assert.equal(new Set(src.map((s) => s.id)).size, src.length, "id không trùng");
});
t("sourceWant: bếp mọi pha; khói giao chiến 0 tới P4, có ở P5, đủ ở P6", () => {
  const cook = src.find((s) => s.kind === "cook"), f0 = src.find((s) => s.id === "fight0"), f1 = src.find((s) => s.id === "fight1");
  for (let ph = 0; ph < 6; ph++) assert.ok(sourceWantB20(cook, ph, ATMO_B20_PRESETS[ph].cols) > 0);
  for (let ph = 0; ph < 4; ph++) { assert.equal(sourceWantB20(f0, ph, 1), 0); assert.equal(sourceWantB20(f1, ph, 1), 0); }
  assert.ok(sourceWantB20(f0, 4, 0.6) > sourceWantB20(f1, 4, 0.6) && sourceWantB20(f1, 4, 0.6) > 0);
  assert.equal(sourceWantB20(f1, 5, 1), 1);
  assert.equal(sourceWantB20({ kind: "gate" }, 5, 1), 0);
});
t("world thiếu groundY vẫn dựng được (y = 0 hoặc mặt nước ròng)", () => {
  const s2 = buildSourcesB20({}); assert.equal(s2.length, src.length);
});

console.log("Nhạc, nền tiếng, nối BattleDef");
t("nhạc: trận ở P1–P5, boss ở P6 và trong Tổng Phản Công", () => {
  for (let ph = 0; ph < 5; ph++) assert.equal(musicB20({ phase: ph }, { tpc: false }), "battle");
  assert.equal(musicB20({ phase: 5 }, { tpc: false }), "boss"); assert.equal(musicB20({ phase: 2 }, { tpc: true }), "boss");
});
t("nền tiếng: dF tới địch gần nhất (lính, sĩ quan), bỏ xác và lính ta; lửa bếp chỉ gần bản doanh", () => {
  const ctx = { hero: { x: 0, z: 0 }, crowd: { agents: [{ side: "dich", state: "dead", x: 1, z: 0 }, { side: "ta", x: 2, z: 0 }, { side: "dich", x: 30, z: 40 }] },
    units: [{ side: "dich", alive: true, dead: false, x: 0, z: 20 }, { side: "dich", alive: false, x: 0, z: 1 }] };
  const b = bedB20(ctx); assert.equal(b.dF, 20); assert.equal(b.fire, 0);
  const far = bedB20({ hero: { x: 0, z: 0 }, crowd: { agents: [] }, units: [] }); assert.equal(far.dF, 140);
  const hq = bedB20({ hero: { x: HQ_PAD.x, z: HQ_PAD.z }, crowd: { agents: [] }, units: [] }); assert.ok(hq.fire > 0.1);
});
t("wireAtmoB20 đặt atmo, music, bed và trả lại def", () => {
  const def = { id: "B20", music: () => "x", bed: () => ({}) };
  assert.equal(wireAtmoB20(def), def); assert.equal(def.atmo, ATMO_B20); assert.equal(def.music, musicB20); assert.equal(def.bed, bedB20);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exitCode = 1;
