// tools/inspect-glb.mjs — liệt kê clip (tên, thời lượng) và cây xương của một GLB, để chọn clip cho bake-clips.mjs.
//   node game/tools/inspect-glb.mjs tệp.glb
import fs from "node:fs";
const f = process.argv[2];
const b = fs.readFileSync(f);
const jl = b.readUInt32LE(12);
const j = JSON.parse(b.slice(20, 20 + jl).toString("utf8"));
console.log("nodes", j.nodes.length, "skins", (j.skins||[]).length, "anims", (j.animations||[]).length, "meshes", (j.meshes||[]).length);
const anims = j.animations.map(a => {
  let dur = 0;
  for (const s of a.samplers) { const acc = j.accessors[s.input]; dur = Math.max(dur, acc.max?.[0] ?? 0); }
  return `${a.name} ${dur.toFixed(2)}s ch=${a.channels.length}`;
});
console.log(anims.join("\n"));
if (j.skins?.length) {
  const sk = j.skins[0];
  console.log("joints", sk.joints.length);
  const parent = {};
  j.nodes.forEach((n, i) => (n.children || []).forEach(c => parent[c] = i));
  const depth = i => parent[i] === undefined ? 0 : 1 + depth(parent[i]);
  for (const jn of sk.joints) { const n = j.nodes[jn]; console.log("  ".repeat(Math.min(depth(jn), 12)) + n.name, n.translation ? n.translation.map(v=>+v.toFixed(3)) : "", n.rotation ? "rot" : ""); }
}
