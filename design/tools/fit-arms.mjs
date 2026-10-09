// design/tools/fit-arms.mjs — đo khớp ghi tay (catalog fix) cho GLB A-pose tay thẳng (Hunyuan3D) bằng mặt cắt ngang (bake/fit-arms.mjs).
//   node design/tools/fit-arms.mjs H35h                 mẫu trong catalog.mjs (src, tris, cut lấy ở đó; có fix thì in thêm độ lệch)
//   node design/tools/fit-arms.mjs duong/dan.glb [tris]  GLB bất kỳ (tris mặc định 9000, như nhân vật người chơi)
// Thêm khoá=số để đổi tham số ARM_FIT (bake/fit-arms.mjs), vd upX=1 upZ=1: tay thẳng (không nếp gập khuỷu).
// In khối FIX_… dán vào catalog.mjs; xem tay trong lab (lab.html?view=rigs) rồi mới nướng. Không cần mạng.
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const threeUrl = pathToFileURL(join(ROOT, "game/vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const { CHARS } = await import("./bake/catalog.mjs");
const { readGLB } = await import("./bake/io.mjs");
const { cutBoxes, normPt } = await import("./bake/human.mjs");
const { fitArms } = await import("./bake/fit-arms.mjs");

const argv = process.argv.slice(2), prm = Object.fromEntries(argv.filter((a) => /^\w+=[-\d.]+$/.test(a)).map((a) => a.split("=")).map(([k, v]) => [k, +v]));
const [arg, trisArg] = argv.filter((a) => !a.includes("="));
if (!arg) { console.error("dùng: node design/tools/fit-arms.mjs <mã trong catalog | đường dẫn .glb> [tris]"); process.exit(1); }
const c = CHARS[arg], file = c ? join(ROOT, c.src || "") : resolve(arg), name = c ? arg : basename(arg, ".glb");
if (c && !c.src) { console.error(`${arg}: mẫu Meshy (không có src) — bộ dò geodesic lo, công cụ này dành cho GLB ngoài manifest`); process.exit(1); }
const g0 = cutBoxes(await readGLB(file, +trisArg || c?.tris || 9000), c?.cut), g = g0.g, N = normPt(g0.bounds, 1.9), P = new Float32Array(g.pos.length);
for (let i = 0; i < P.length; i += 3) P.set(N(g.pos[i], g.pos[i + 1], g.pos[i + 2]), i);
const r = fitArms(P, g.idx, { name, prm });
const f3 = (a) => `[${a.map((x) => x.toFixed(3)).join(", ")}]`, v = r.fix;
for (const sd of ["L", "R"]) { const i = r.info[sd]; if (i) console.log(`// tay ${sd}: nắm đấm từ y ${i.yb.toFixed(2)}, tách thân tới ${i.armTop.toFixed(2)}, ${i.levels} mặt cắt, rộng ${i.width.toFixed(3)}, hướng ${f3(i.dir)}`); }
for (const w of r.warnings) console.log("// cảnh báo: " + w);
console.log(`const FIX_${name.toUpperCase()} = {\n  shL: ${f3(v.shL)}, elL: ${f3(v.elL)}, handL: ${f3(v.handL)},\n  shR: ${f3(v.shR)}, elR: ${f3(v.elR)}, handR: ${f3(v.handR)},\n  neck: ${v.neck.toFixed(3)},\n};`);
if (c?.fix) {
  let worst = 0, at = "";
  for (const k of Object.keys(v)) [].concat(v[k]).forEach((x, i) => { const d = Math.abs(x - [].concat(c.fix[k] ?? x)[i]); if (d > worst) { worst = d; at = `${k}[${"xyz"[i]}]`; } });
  console.log(`// so với catalog fix: lệch lớn nhất ${worst.toFixed(3)} (${at})`);
}
