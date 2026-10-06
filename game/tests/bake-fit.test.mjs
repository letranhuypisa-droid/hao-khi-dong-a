// tests/bake-fit.test.mjs — đợt 19a: công cụ nướng trên GLB thật (design/glb), cần design/tools/node_modules (npm ci); không có thì bỏ qua.
// (1) Bộ dò tay (design/tools/bake/human.mjs fitHuman) không nhận chuỗi tay sai một cách im lặng: ba mẫu bộ dò không dựng đúng (cần khớp
// ghi tay trong catalog.mjs) mà bỏ khớp ghi tay thì dừng nướng vì lỗi tay (không phải lỗi khác), và vai bộ dò tự thấy lệch vai khớp ghi
// tay quá 0,03 (khung thô) — phép so độ cao vai vẫn bắt được nếu ai nới dải độ dài tay (CV_daidao trượt dải cẳng tay chỉ 1 mm: 0,179 /
// 0,18) — OFF_tuong (tay buông dính vạt áo), CV_daidao (khuỷu gập nhọn), DV_NO (cánh tay áp sườn: vai dò rơi ở khuỷu, 1,237 thay vì 1,37).
// (2) Lính đám đông: dáng gốc → tư thế nghỉ (kit.mjs kitBody: tay buông; riderBody: ngồi ngựa) không kéo tam giác nào thành gai.
// (3) weights15 không chia cho 0 khi phần góc lưng / cổ là 0 hay 1 (báo lỗi rõ).
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
const { fitHuman, cutBoxes, bounds, normPt, bindSkeleton, bindHelpers, weights15 } = await B("human.mjs");
const { landmarks } = await B("landmarks.mjs");
const man = JSON.parse(readFileSync(join(ROOT, "design/glb/manifest.json"), "utf8"));

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 3).join("\n       ")); }
}

console.log("Bộ dò tay (human.mjs fitHuman) trên GLB thật, bỏ khớp ghi tay");
const ARM_ERR = /không dựng được|không dò được vai|vai dò ở|chưa ghi độ cao vai|sau khi thay vẫn sai/;
for (const [code, c, kit] of [["OFF_tuong", CHARS.OFF_tuong, false], ["CV_daidao", CHARS.CV_daidao, false], ["DV_NO", KIT_LIST.DV_NO, true]]) {
  await t(`${code} không khớp ghi tay: dừng nướng vì lỗi tay, vai bộ dò lệch vai khớp ghi tay > 0,03 cả hai bên`, async () => {
    const cg = cutBoxes(await readGLB(join(ROOT, man[code].path), kit ? Infinity : c.tris), c.cut);
    const shoulder = (c.fix.shL[1] + c.fix.shR[1]) / 2;
    let F = null, err = null;
    try { F = fitHuman(cg.g.pos, cg.g.idx, { shY: kit ? 1.43 : 1.48, fix: null, box: cg.bounds, name: code, kit, shoulder }); } catch (e) { err = e; }
    if (!err) throw new Error(`nhận tay ${F.how.L} / ${F.how.R}, vai thô ${((F.J.shL[1] + F.J.shR[1]) / 2 / F.s).toFixed(3)} (khớp ghi tay ${shoulder.toFixed(3)})`);
    if (!ARM_ERR.test(err.message)) throw new Error(`dừng vì lỗi khác: ${err.message}`);
    const N = normPt(cg.bounds || bounds(cg.g.pos), 1.9), P = new Float32Array(cg.g.pos.length);
    for (let i = 0; i < P.length; i += 3) P.set(N(cg.g.pos[i], cg.g.pos[i + 1], cg.g.pos[i + 2]), i);
    const lm = landmarks(P, cg.g.idx, 1.9), dy = ["L", "R"].map((sd) => (lm.info.arm[sd]?.A ? lm.info.arm[sd].A.sh[1] - shoulder : null));
    for (const d of dy) if (d != null && Math.abs(d) <= 0.03) throw new Error(`vai bộ dò lệch ${d.toFixed(3)} (≤ 0,03): chỉ phép thử độ dài tay chặn được`);
    console.log(`       ${err.message.slice(0, 110)}…; vai bộ dò lệch ${dy.map((d) => (d == null ? "—" : d.toFixed(3))).join(" / ")}`);
  });
}

// Lính đám đông: dáng gốc → tư thế nghỉ bộ khúc (kit.mjs kitBody: tay buông; riderBody: người cưỡi ngồi) không được kéo tam giác nào
// thành gai — phép đo tư thế lính (so với lưới nghỉ) không thấy gai nằm sẵn trong lưới nghỉ. Gai: giãn > 4 lần và cạnh nghỉ > 0,12 m.
// DV_NO (cẳng tay áp sườn: đặt tay buông kéo nếp khuỷu, nách 4,7–12,7 lần) giữ bản nướng cũ (catalog keep) — bỏ qua, in TODO; NG_KY
// người cưỡi trước đây đế giày theo đùi (vạt áo kéo c về phía hông): 13 tam giác 0,3–0,49 m.
const { kitBody, riderBody, KIT_SH } = await B("kit.mjs");
const spikes = (S, V, idx) => {
  const L = (A, p, q) => Math.hypot(A[p * 3] - A[q * 3], A[p * 3 + 1] - A[q * 3 + 1], A[p * 3 + 2] - A[q * 3 + 2]);
  let bad = 0, worst = 1, len = 0, n4 = 0;
  for (let i = 0; i < idx.length; i += 3) {
    let e = 1, l1 = 0;
    for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) { const a = idx[i + p], b = idx[i + q], l0 = L(S, a, b); l1 = Math.max(l1, L(V, a, b)); if (l0 > 1e-5) e = Math.max(e, L(V, a, b) / l0); }
    if (e > 4) { n4++; len = Math.max(len, l1); if (l1 > 0.12) bad++; } worst = Math.max(worst, e);
  }
  return { bad, worst, len, n4 };
};
console.log("Tư thế nghỉ lính đám đông (kit.mjs kitBody, riderBody)");
for (const code of ["NG_DAO", "NG_GIAO", "NG_CUNG", "NG_TANK", "DV_GIAO", "DV_DAO", "DV_NO", "NG_KY"]) {
  const c = KIT_LIST[code];
  if (c.keep) { console.log(`  bỏ qua (TODO GLB cần làm lại, giữ bản ${c.keep}) ${code}: tư thế nghỉ`); continue; }
  await t(`${code}${c.horse ? " (người cưỡi)" : ""}: không gai (tam giác giãn > 4 lần so với mẫu gốc, cạnh > 0,12 m)`, async () => {
    const cg = cutBoxes(await readGLB(join(ROOT, man[code].path), Infinity), c.cut);
    const F = fitHuman(cg.g.pos, cg.g.idx, { shY: KIT_SH, fix: c.fix, box: cg.bounds, name: code, kit: true, shoulder: c.shoulder, fallback: c.fallback });
    const R = c.horse ? { ...riderBody(F), idx: cg.g.idx } : kitBody(F, cg.g.idx, cg.g.uv), r = spikes(R.S, R.V, R.idx);
    if (r.bad) throw new Error(`${r.bad} gai (giãn > 4 lần, cạnh > 0,12 m; tối đa ${r.worst.toFixed(1)} lần, cạnh dài nhất ${r.len.toFixed(2)} m)`);
    console.log(`       giãn tối đa ${r.worst.toFixed(2)} lần${r.n4 ? ` (${r.n4} tam giác > 4 lần, cạnh ≤ ${r.len.toFixed(2)} m)` : ""}${R.cut ? `, tách ${R.cut} tam giác cầu` : ""}`);
  });
}

console.log("Trọng số (human.mjs weights15)");
await t("phần góc lưng / cổ 0 hay 1 (xương phụ không quay / quay hết): báo lỗi rõ, không ra NaN", async () => {
  const c = CHARS.X24, cg = cutBoxes(await readGLB(join(ROOT, man.X24.path), c.tris), c.cut);
  const F = fitHuman(cg.g.pos, cg.g.idx, { shY: 1.48, box: cg.bounds, name: "X24", shoulder: c.shoulder });
  const Y = { hips: 0.92, torso: 0.96, hipOff: 0.02, thigh: 0.45, shin: 0.4, knee: 0.45, ankle: 0.05 }, HB = bindHelpers(bindSkeleton(F, Y));
  const W = weights15(F, Y, {}, HB);
  if (W.some((x) => !Number.isFinite(x))) throw new Error("trọng số NaN với phần góc mặc định");
  for (const [k, v] of [["spine", 0], ["spine", 1], ["neck", 0], ["neck", 1]]) {
    const d = { ...HB.drive, [k]: [HB.drive[k][0], HB.drive[k][1], v] };
    let err = null; try { weights15(F, Y, {}, { ...HB, drive: d }); } catch (e) { err = e; }
    if (!err || !/phần góc lưng \/ cổ/.test(err.message)) throw new Error(`${k} = ${v}: ${err ? err.message : "không báo lỗi"}`);
  }
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
