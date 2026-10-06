// tests/bake-fit.test.mjs — đợt 19a: bộ dò tay của công cụ nướng (design/tools/bake/human.mjs fitHuman) không nhận chuỗi tay sai một
// cách im lặng: ba mẫu bộ dò không dựng đúng (cần khớp ghi tay trong catalog.mjs) mà bỏ khớp ghi tay thì phải dừng nướng — OFF_tuong
// (tay buông dính vạt áo), CV_daidao (khuỷu gập nhọn), DV_NO (cánh tay áp sườn: vai dò rơi ở khuỷu 1,237 thay vì 1,37, qua mọi dải độ
// dài — chỉ phép so độ cao vai đã xem bằng mắt bắt được). Đọc GLB thật (design/glb) nên cần design/tools/node_modules (npm ci); không
// có thì bỏ qua.
//   node game/tests/bake-fit.test.mjs
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
if (!existsSync(join(ROOT, "design/tools/node_modules/@gltf-transform/core"))) {
  console.log("bỏ qua: chưa có design/tools/node_modules (cd design/tools && npm ci)\n\n0 đạt, 0 trượt");
  process.exit(0);
}
const threeUrl = pathToFileURL(join(ROOT, "game/vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const B = (f) => import(pathToFileURL(join(ROOT, "design/tools/bake", f)).href);
const { CHARS, KIT_LIST } = await B("catalog.mjs");
const { readGLB } = await B("io.mjs");
const { fitHuman, cutBoxes } = await B("human.mjs");
const man = JSON.parse(readFileSync(join(ROOT, "design/glb/manifest.json"), "utf8"));

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}

console.log("Bộ dò tay (human.mjs fitHuman) trên GLB thật, bỏ khớp ghi tay");
for (const [code, c, kit] of [["OFF_tuong", CHARS.OFF_tuong, false], ["CV_daidao", CHARS.CV_daidao, false], ["DV_NO", KIT_LIST.DV_NO, true]]) {
  await t(`${code} không khớp ghi tay: dừng nướng (vai catalog = vai khớp ghi tay)`, async () => {
    const cg = cutBoxes(await readGLB(join(ROOT, man[code].path), kit ? Infinity : c.tris), c.cut);
    const shoulder = (c.fix.shL[1] + c.fix.shR[1]) / 2;
    let F = null, err = null;
    try { F = fitHuman(cg.g.pos, cg.g.idx, { shY: kit ? 1.43 : 1.48, fix: null, box: cg.bounds, name: code, kit, shoulder }); } catch (e) { err = e; }
    if (!err) throw new Error(`nhận tay ${F.how.L} / ${F.how.R}, vai thô ${((F.J.shL[1] + F.J.shR[1]) / 2 / F.s).toFixed(3)} (khớp ghi tay ${shoulder.toFixed(3)})`);
    console.log("       " + err.message);
  });
}

// Lính đám đông: dáng gốc → tư thế nghỉ bộ khúc (kit.mjs kitBody: tay buông) không được kéo tam giác nào thành gai — phép đo tư thế lính
// (so với lưới nghỉ) không thấy gai nằm sẵn trong lưới nghỉ. DV_NO trước đây: cẳng tay áp sườn, đặt tay buông kéo 49 tam giác cẳng tay
// + thân thành gai đỏ 0,3–0,55 m dọc ống tay (giãn 13–36 lần) ở mọi tư thế. Gai: giãn > 4 lần và cạnh nghỉ > 0,3 m — nếp trong khuỷu
// gập 90° duỗi thẳng thì giãn 4–6 lần một cách tự nhiên (cạnh ≤ 0,26 m), không tính.
const { kitBody, KIT_SH } = await B("kit.mjs");
console.log("Tư thế nghỉ lính đám đông (kit.mjs kitBody)");
for (const code of ["NG_DAO", "NG_GIAO", "NG_CUNG", "NG_TANK", "DV_GIAO", "DV_DAO", "DV_NO"]) {
  await t(`${code}: không gai (tam giác giãn > 4 lần so với mẫu gốc, cạnh > 0,3 m)`, async () => {
    const c = KIT_LIST[code], cg = cutBoxes(await readGLB(join(ROOT, man[code].path), Infinity), c.cut);
    const F = fitHuman(cg.g.pos, cg.g.idx, { shY: KIT_SH, fix: c.fix, box: cg.bounds, name: code, kit: true, shoulder: c.shoulder, fallback: c.fallback });
    const R = kitBody(F, cg.g.idx, cg.g.uv), L = (A, p, q) => Math.hypot(A[p * 3] - A[q * 3], A[p * 3 + 1] - A[q * 3 + 1], A[p * 3 + 2] - A[q * 3 + 2]);
    let bad = 0, worst = 1, len = 0, n4 = 0;
    for (let i = 0; i < R.idx.length; i += 3) {
      let e = 1, l1 = 0;
      for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) { const a = R.idx[i + p], b = R.idx[i + q], l0 = L(R.S, a, b); l1 = Math.max(l1, L(R.V, a, b)); if (l0 > 1e-5) e = Math.max(e, L(R.V, a, b) / l0); }
      if (e > 4) { n4++; len = Math.max(len, l1); if (l1 > 0.3) bad++; } worst = Math.max(worst, e);
    }
    if (bad) throw new Error(`${bad} gai (giãn > 4 lần, cạnh > 0,3 m; tối đa ${worst.toFixed(1)} lần, cạnh dài nhất ${len.toFixed(2)} m)`);
    console.log(`       giãn tối đa ${worst.toFixed(2)} lần${n4 ? ` (${n4} tam giác > 4 lần, cạnh ≤ ${len.toFixed(2)} m)` : ""}${R.cut ? `, tách ${R.cut} tam giác cầu` : ""}`);
  });
}

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
