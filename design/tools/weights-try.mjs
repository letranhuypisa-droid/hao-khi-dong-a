// design/tools/weights-try.mjs — thử tham số nướng một nhân vật của catalog.mjs (w, rad, radOut, simp, zs, tris…) trong bộ nhớ, in phần trọng số mỗi khớp (% số đỉnh, như
// game/tests/models.test.mjs (b): vai ≥ 2%, khuỷu ≥ 0,85%, bàn tay ≥ 0,5%) và số tam giác tách: không ghi tệp, nhanh hơn nướng + chạy test mỗi lần thử.
//   node design/tools/weights-try.mjs CV_songdaoh '{"w":{"so":-0.09}}' '{"tris":6500}' '{"simp":{"w":2,"hi":4}}' …
// Số in ra tính trên lưới trước khi trải UV (đỉnh ít hơn tệp nướng ~20–30%), nên phần trăm cao hơn test một chút: để dư 0,3 điểm.
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: pathToFileURL(join(ROOT, "game/vendor/three/three.module.js")).href, shortCircuit: true } : next(s, c)) });
const { CHARS } = await import("./bake/catalog.mjs");
const { charMesh } = await import("./bake/char.mjs");
const CORE = ["hips", "torso", "head", "shL", "elL", "handL", "shR", "elR", "handR", "hipL", "kneeL", "ankleL", "hipR", "kneeR", "ankleR"];
const SHARE_OF = { spine: "torso", clavL: "torso", clavR: "torso", twistL: "elL", twistR: "elR" };
const [code, ...ovs] = process.argv.slice(2), c = CHARS[code];
for (const o of ovs.length ? ovs : ["{}"]) {
  const ov = JSON.parse(o), opt = { ...c, ...ov, w: { ...(c.w || {}), ...(ov.w || {}) }, name: code };
  const M = await charMesh(join(ROOT, c.src), opt), n = M.pos.length / 3, B = M.bones, S = Object.fromEntries(B.map((b) => [b, 0]));
  for (let v = 0; v < n; v++) for (let q = 0; q < 4; q++) { const w = M.sw[v * 4 + q] / 255; if (w > 0) S[SHARE_OF[B[M.si[v * 4 + q]]] || B[M.si[v * 4 + q]]] += w; }
  console.log(o.padEnd(46), n + " đỉnh ·", ["head", "shL", "elL", "handL", "shR", "elR", "handR"].map((b) => `${b} ${((S[b] / n) * 100).toFixed(1)}`).join(" · "), "· tách", M.split?.cut ?? 0);
}
