// tests/terrain-tex.test.mjs — chi tiết bề mặt địa hình (battle/terrain-tex.js, texture Poly Haven dirt + rocky_terrain nén bằng tools/bake-terrain-tex.py):
// (1) bốn tệp texture đúng chỗ, WebP 512 px, nhẹ; (2) vật liệu giữ màu đỉnh + phẳng, chưa nạp texture thì uTexOn = 0, ?notex / Node không nạp; (3) bản vá shader khớp các
// khối của three (chunk còn đúng tên: nâng three mà đổi tên là báo ngay), mọi biến dùng ở khối pháp tuyến đã khai ở khối màu, uniform đủ; (4) world.js gán trọng số đất / đá
// cho từng tam giác: đỉnh gò đá nặng đá, đường nặng đất, cỏ gần 0, vết bánh xe đất hoàn toàn, mọi giá trị trong [0, 1]; sân Võ trường nặng đất ở giữa, cỏ ngoài nhẹ.
//   node game/tests/terrain-tex.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, statSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };   // như env.test.mjs: dựng cờ bằng canvas giả
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: pathToFileURL(join(here, "../vendor/three/three.module.js")).href, shortCircuit: true } : next(s, c)) });
const THREE = await import("three");
const TT = await import("../js/battle/terrain-tex.js");
const W = await import("../js/battle/world.js");
const G = await import("../js/battle/ground.js");
const { FRONTS } = await import("../js/data/battle-b15.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}

console.log("Texture địa hình");
t("bốn tệp assets/terrain/*.webp: WebP 512 px, tổng ≤ 600 KB", () => {
  let total = 0;
  for (const f of ["dirt_d", "dirt_n", "rock_d", "rock_n"]) {
    const p = join(here, `../assets/terrain/${f}.webp`), b = readFileSync(p);
    assert.equal(b.toString("latin1", 0, 4), "RIFF", f); assert.equal(b.toString("latin1", 8, 12), "WEBP", f);
    // VP8 (lossy): khung 10 byte, cỡ 14 bit ở byte 26–29 của tệp (sau "VP8 " + kích thước + thẻ khung 3 byte + mã bắt đầu 3 byte)
    assert.equal(b.toString("latin1", 12, 16), "VP8 ", f + " nén có mất mát");
    const w = b.readUInt16LE(26) & 0x3fff, h = b.readUInt16LE(28) & 0x3fff;
    assert.deepEqual([w, h], [512, 512], f);
    total += statSync(p).size;
  }
  assert.ok(total <= 600 * 1024, "tổng " + total);
});
t("hằng trung bình màu: dương, nhỏ hơn 1 (tuyến tính), đất và đá cùng bậc", () => {
  for (const m of [TT.DIRT_MEAN, TT.ROCK_MEAN]) assert.ok(m.length === 3 && m.every((v) => v > 0.02 && v < 0.5), JSON.stringify(m));
  assert.ok(TT.TILE.dirt > 1 && TT.TILE.rock > TT.TILE.dirt && TT.TILE.dirtFar > TT.TILE.dirt);
});

console.log("Vật liệu và shader");
const loaded = await TT.loadTerrainTextures();
t("terrainMaterial: Lambert màu đỉnh + phẳng như cũ; chưa nạp texture (Node) thì uTexOn = 0; tuỳ chọn polygonOffset đi qua", () => {
  const m = TT.terrainMaterial({ polygonOffset: true, polygonOffsetFactor: -1 });
  assert.ok(m instanceof THREE.MeshLambertMaterial); assert.equal(m.vertexColors, true); assert.equal(m.flatShading, true);
  assert.equal(m.polygonOffset, true); assert.equal(m.polygonOffsetFactor, -1);
  const U = m.userData.terrainTex; assert.equal(U.uTexOn.value, 0); assert.equal(U.uDirtD.value, null);
  assert.equal(loaded, null, "Node không nạp texture");
  assert.equal(m.customProgramCacheKey(), TT.terrainMaterial().customProgramCacheKey());
});
const frag = THREE.ShaderLib.lambert.fragmentShader, vert = THREE.ShaderLib.lambert.vertexShader;
t("three: shader Lambert còn các khối mà bản vá bám vào (common, begin_vertex, color_fragment, normal_fragment_maps) và pháp tuyến đến trước", () => {
  for (const c of ["common", "begin_vertex"]) assert.ok(vert.includes(`#include <${c}>`), "vertex " + c);
  for (const c of ["common", "color_fragment", "normal_fragment_begin", "normal_fragment_maps"]) assert.ok(frag.includes(`#include <${c}>`), "fragment " + c);
  assert.ok(frag.indexOf("<color_fragment>") < frag.indexOf("<normal_fragment_begin>") && frag.indexOf("<normal_fragment_begin>") < frag.indexOf("<normal_fragment_maps>"));
});
const patched = () => {
  const m = TT.terrainMaterial(), sh = { uniforms: {}, vertexShader: vert, fragmentShader: frag };
  m.onBeforeCompile(sh); return { sh, U: m.userData.terrainTex };
};
t("bản vá: khai aSplat / vWPos, thêm uniform, thay đúng một lần mỗi khối; khối màu đứng trước khối pháp tuyến", () => {
  const { sh, U } = patched();
  for (const u of ["uDirtD", "uDirtN", "uRockD", "uRockN", "uTexOn", "uTile", "uStr", "uNStr"]) { assert.ok(sh.uniforms[u], u); assert.equal(sh.uniforms[u], U[u], u + " cùng đối tượng"); assert.ok(sh.fragmentShader.includes(u), u + " có trong shader"); }
  assert.ok(sh.vertexShader.includes("attribute vec2 aSplat;") && sh.vertexShader.includes("vSplat = aSplat;") && sh.vertexShader.includes("vWPos ="));
  assert.equal(sh.fragmentShader.split("#include <normal_fragment_maps>").length, 1, "khối pháp tuyến cũ đã được thay hẳn");
  assert.equal(sh.fragmentShader.split("#include <color_fragment>").length, 2, "khối màu vẫn còn một lần");
  const iColor = sh.fragmentShader.indexOf("vec2 tP ="), iNormal = sh.fragmentShader.indexOf("vec3 tNt ="), iBegin = sh.fragmentShader.indexOf("#include <normal_fragment_begin>");
  assert.ok(iColor > 0 && iColor < iBegin && iBegin < iNormal, "tP khai trước, pháp tuyến dùng sau normal_fragment_begin");
  for (const v of ["tKd", "tKr", "tP"]) assert.ok(sh.fragmentShader.indexOf(`${v} =`) < iNormal || sh.fragmentShader.indexOf(`float ${v}`) < iNormal || sh.fragmentShader.indexOf(`vec2 ${v}`) < iNormal, v + " khai trước khối pháp tuyến");
  const open = (sh.fragmentShader.match(/\{/g) || []).length, close = (sh.fragmentShader.match(/\}/g) || []).length;
  assert.equal(open, close, "ngoặc nhọn cân");
});
t("khi chưa nạp texture (uTexOn = 0) pháp tuyến giữ phẳng (0, 0, 1): sampler rỗng đọc 0 không được lật mặt xuống", () => {
  const { sh } = patched();
  assert.ok(/tNd = mix\(vec3\(0\.0, 0\.0, 1\.0\), texture2D\(uDirtN/.test(sh.fragmentShader) && /tNr = mix\(vec3\(0\.0, 0\.0, 1\.0\), texture2D\(uRockN/.test(sh.fragmentShader));
  assert.ok(sh.fragmentShader.includes("* uTexOn"), "độ mạnh nhân uTexOn");
});
t("splatAttribute: xen kẽ (đất, đá) theo đỉnh", () => {
  const a = TT.splatAttribute([0.1, 0.2, 0.3], [0.9, 0.8, 0.7]);
  assert.equal(a.itemSize, 2); assert.deepEqual(Array.from(a.array).map((v) => +v.toFixed(2)), [0.1, 0.9, 0.2, 0.8, 0.3, 0.7]);
});

console.log("Trọng số đất / đá của địa hình");
const scene = new THREE.Scene(), world = W.buildWorld(scene, { shadows: false });
const geo = world.terrain.geometry, pos = geo.attributes.position, spl = geo.attributes.aSplat;
t("địa hình Hàm Tử: có aSplat đủ cỡ, mọi giá trị trong [0, 1], phẳng trên từng tam giác (cả vết bánh xe)", () => {
  assert.ok(spl && spl.itemSize === 2 && spl.count === pos.count, "aSplat khớp số đỉnh");
  for (let i = 0; i < spl.array.length; i++) assert.ok(spl.array[i] >= 0 && spl.array[i] <= 1, `giá trị ${i} = ${spl.array[i]}`);
  for (let i = 0; i + 2 < pos.count; i += 3) for (let c = 0; c < 2; c++) assert.ok(spl.array[i * 2 + c] === spl.array[(i + 1) * 2 + c] && spl.array[i * 2 + c] === spl.array[(i + 2) * 2 + c], `tam giác ${i / 3} không phẳng`);
  assert.ok(world.terrain.material.userData.terrainTex, "địa hình dùng terrainMaterial");
});
// trọng số tại điểm (x, z): tam giác gần nhất theo tâm
function weightAt(x, z) {
  let best = 1e9, w = [0, 0];
  for (let i = 0; i + 2 < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3, cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3, d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < best) { best = d; w = [spl.array[i * 2], spl.array[i * 2 + 1]]; }
  }
  return w;
}
t("gò đá có trọng số đá cao ở giữa và 0 ở xa; đường chiến có trọng số đất cao; đồng cỏ gần 0 đất và 0 đá", () => {
  const k = G.ZONES.knolls[0];
  assert.ok(weightAt(k.x, k.z)[1] > 0.5, "tâm gò đá " + weightAt(k.x, k.z));
  assert.equal(weightAt(k.x + k.r * 2.5, k.z)[1], 0, "xa gò");
  for (const f of Object.values(FRONTS)) assert.ok(weightAt(140, f.laneZ)[0] >= 0.7, `đường làn z=${f.laneZ}: ${weightAt(140, f.laneZ)}`);
  const grass = weightAt(120, 140);   // dải nam gần làng, ngoài ruộng / đường: cỏ
  assert.ok(grass[1] === 0 && grass[0] < 0.75, "cỏ " + grass);
  // phần lớn tam giác (cỏ) có đất < 0.5; phần nhỏ có đất > 0.5 (đường, mái lũy, đáy hào, nền đồn)
  let hi = 0, rock = 0; const n = pos.count / 3;
  for (let i = 0; i < n; i++) { if (spl.array[i * 6] > 0.5) hi++; if (spl.array[i * 6 + 1] > 0.3) rock++; }
  assert.ok(hi / n > 0.02 && hi / n < 0.6, "tỉ lệ đất nặng " + (hi / n).toFixed(3));
  assert.ok(rock / n > 0.001 && rock / n < 0.1, "tỉ lệ đá " + (rock / n).toFixed(4));
});
t("vết bánh xe (dải dán thêm cuối lưới) đất hoàn toàn", () => {
  const n = pos.count; let ruts = 0;
  for (let i = n - 1; i >= 0 && ruts < 60; i--) { if (spl.array[i * 2] === 1 && spl.array[i * 2 + 1] === 0) ruts++; else if (ruts) break; }
  assert.ok(ruts >= 12, "đếm được " + ruts + " đỉnh vết bánh xe ở cuối lưới");
});
t("Võ trường (buildArena): nền đất nện ở giữa nặng đất, ngoài bãi cỏ nhẹ", () => {
  const sc = new THREE.Scene(); W.buildArena(sc, { shadows: false });
  const m = sc.children.find((o) => o.isMesh && o.geometry.attributes.aSplat && o.material.userData.terrainTex);
  assert.ok(m, "có mặt đất dùng terrainMaterial");
  const p = m.geometry.attributes.position, s = m.geometry.attributes.aSplat;
  const at = (x, z) => { let best = 1e9, w = 0; for (let i = 0; i + 2 < p.count; i += 3) { const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, d = (cx - x) ** 2 + (cz - z) ** 2; if (d < best) { best = d; w = s.array[i * 2]; } } return w; };
  assert.ok(at(3, 3) >= 0.85, "giữa sân " + at(3, 3)); assert.ok(at(80, 80) < 0.2, "ngoài bãi " + at(80, 80));
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
