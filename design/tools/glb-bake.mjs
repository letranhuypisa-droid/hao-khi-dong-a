// design/tools/glb-bake.mjs — nướng GLB Meshy (design/glb/) thành tài nguyên game (game/assets/models/): nhân vật gắn sẵn trọng
// số theo 15 khớp rig, lính đám đông theo bộ khớp instanced, vũ khí theo khung tay, ngựa. Định dạng .hkm (bake/io.mjs) + WebP.
//   cd design/tools && npm i
//   node design/tools/glb-bake.mjs [char|kit|wpn|env|all] [--only H35,DV_GIAO] [--raw <thư mục GLB môi trường, mặc định design/glb/_raw/moi-truong/>]
// Không cần mạng, không tốn credit: chỉ đọc design/glb/*.glb đã có trong repo. env: vật tĩnh của cảnh (bake/env.mjs, catalog ENV) từ GLB
// Hunyuan3D thả ở design/<mã>.glb (ngoài git) → assets/models/env/; thiếu tệp gốc thì bỏ qua mã đó, giữ bản nướng cũ.
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const threeUrl = pathToFileURL(join(ROOT, "game/vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
const { CHARS, WEAPONS, KIT_LIST, ENV } = await import("./bake/catalog.mjs");
const { bakeEnv } = await import("./bake/env.mjs");
const { bakeKit, bakeHorseKit, sampleColors } = await import("./bake/kit.mjs");
const { bakeWeapon } = await import("./bake/wpn.mjs");
const { bakeChar } = await import("./bake/char.mjs");
const { writeHKM, writeTexture, writeRaw, rawImage } = await import("./bake/io.mjs");

const args = process.argv.slice(2), what = args[0] || "all";
const only = (() => { const i = args.indexOf("--only"); return i >= 0 ? args[i + 1].split(",") : null; })();
const RAW = (() => { const i = args.indexOf("--raw"); return i >= 0 ? resolve(args[i + 1]) : join(ROOT, "design/glb/_raw/moi-truong"); })();
const OUT = join(ROOT, "game/assets/models");
const man = JSON.parse(readFileSync(join(ROOT, "design/glb/manifest.json"), "utf8"));
const INDEX = join(OUT, "index.json");
let index = {}; try { index = JSON.parse(readFileSync(INDEX, "utf8")); } catch (_) {}
const size = (f) => statSync(f).size;

if (what === "char" || what === "all") {
  for (const [code, c] of Object.entries(CHARS)) {
    if (only && !only.includes(code)) continue;
    if (c.keep) { console.log(`· ${code.padEnd(14)} giữ bản nướng ${c.keep} (catalog keep: GLB cần làm lại)`); continue; }
    const src = join(ROOT, c.src || man[code].path), t0 = Date.now();      // c.src: GLB ngoài manifest Meshy (vd Hunyuan3D / Krea, design/glb/_raw/)
    const r = await bakeChar(src, { ...c, name: code });
    const hkm = join(OUT, "char", code + ".hkm"), tex = join(OUT, "char", code + ".webp");
    writeHKM(hkm, { ...r.meta, tex: code + ".webp" }, { body: r.mesh });
    await writeRaw(tex, r.image, c.tex);
    index["char/" + code] = { kind: "char", file: `char/${code}.hkm`, tex: `char/${code}.webp`, tris: r.tris, bytes: size(hkm) + size(tex) };
    console.log(`✓ ${code.padEnd(14)} ${r.tris} tg (gốc ${r.trisBefore}) · ${((size(hkm) + size(tex)) / 1024).toFixed(0)} KB · vai ×${r.meta.scale} · tay ${r.how.L} / ${r.how.R}${r.cut ? ` · cắt ${r.cut} tg` : ""}${r.split?.cut ? ` · tách cầu ${r.split.cut} tg` : ""} · ${Date.now() - t0} ms${r.warnings.length ? " · " + r.warnings.join("; ") : ""}`);
  }
}
if (what === "wpn" || what === "all") {
  for (const [id, c] of Object.entries(WEAPONS)) {
    if (only && !only.includes(id)) continue;
    const r = await bakeWeapon(join(ROOT, man[c.src].path), c);
    const hkm = join(OUT, "wpn", id + ".hkm"), tex = join(OUT, "wpn", id + ".webp");
    writeHKM(hkm, { ...r.meta, tex: id + ".webp" }, { body: r.mesh });
    await writeTexture(tex, r.image, 256);
    index["wpn/" + id] = { kind: "wpn", file: `wpn/${id}.hkm`, tex: `wpn/${id}.webp`, tris: r.tris, bytes: size(hkm) + size(tex) };
    console.log(`✓ ${id.padEnd(14)} ${r.tris} tg (gốc ${r.trisBefore}) · ${((size(hkm) + size(tex)) / 1024).toFixed(0)} KB · ${JSON.stringify(r.meta.lo)} → ${JSON.stringify(r.meta.hi)}`);
  }
}
if (what === "kit" || what === "all") {
  for (const [code, c] of Object.entries(KIT_LIST)) {
    if (only && !only.includes(code)) continue;
    if (c.keep) { console.log(`· ${code.padEnd(8)} giữ bản nướng ${c.keep} (catalog keep: GLB cần làm lại)`); continue; }
    const t0 = Date.now();
    const weapons = [];
    for (const w of c.weapons) {
      const W = WEAPONS[w.id], bw = await bakeWeapon(join(ROOT, man[W.src].path), W), img = await rawImage(bw.image);
      weapons.push({ ...w, full: bw.raw, img, col: sampleColors(bw.raw.uv, img), head: bw.meta.head });
    }
    const body = join(ROOT, c.src || man[code].path);                       // c.src: GLB ngoài manifest Meshy (Hunyuan3D, design/glb/_raw/nhan-vat/<mã>_hunyuan.glb)
    const r = c.horse ? await bakeHorseKit(join(ROOT, man[c.horse].path), body, { ...c, weapons, name: code })
      : await bakeKit(body, { ...c, weapons, name: code });
    const hkm = join(OUT, "kit", code + ".hkm"), tex = join(OUT, "kit", code + ".webp");
    writeHKM(hkm, { ...r.meta, tex: code + ".webp" }, Object.fromEntries(r.lods.map((m, i) => ["lod" + i, m])));
    await writeRaw(tex, r.image, c.horse ? 1024 : 512);
    const tris = r.lods.map((m) => m.index.a.length / 3);
    index["kit/" + code] = { kind: "kit", file: `kit/${code}.hkm`, tex: `kit/${code}.webp`, tris: tris[0], lods: tris, bytes: size(hkm) + size(tex) };
    console.log(`✓ ${code.padEnd(8)} LOD ${tris.join(" / ")} tg · ${((size(hkm) + size(tex)) / 1024).toFixed(0)} KB${r.split ? ` · tách cầu ${r.split} tg trước khi buông tay` : ""} · ${Date.now() - t0} ms${r.info ? " · ngựa " + JSON.stringify(r.info, (k, v) => (typeof v === "number" ? +v.toFixed(3) : v)) : ""}${r.warnings.length ? " · " + r.warnings.join("; ") : ""}`);
  }
}
if (what === "env" || what === "all") {
  for (const [code, c] of Object.entries(ENV)) {
    if (only && !only.includes(code)) continue;
    const src = join(RAW, code + ".glb");
    if (!existsSync(src)) { console.log(`· ${code.padEnd(24)} không có ${src}: giữ bản nướng cũ`); continue; }
    const t0 = Date.now(), r = await bakeEnv(src, c);
    const hkm = join(OUT, "env", code + ".hkm"), tex = r.image ? join(OUT, "env", code + ".webp") : null;
    writeHKM(hkm, { ...r.meta, ...(tex ? { tex: code + ".webp" } : {}) }, Object.fromEntries(r.lods.map((m, i) => ["lod" + i, m])));
    if (tex) await writeRaw(tex, r.image, c.tex);
    const bytes = size(hkm) + (tex ? size(tex) : 0);
    index["env/" + code] = { kind: "env", file: `env/${code}.hkm`, ...(tex ? { tex: `env/${code}.webp` } : {}), tris: r.tris[0], lods: r.tris, bytes };
    console.log(`✓ ${code.padEnd(24)} LOD ${r.tris.join(" / ")} tg (gốc ${r.trisBefore}) · ${(bytes / 1024).toFixed(0)} KB · ×${r.meta.scale} · ${r.meta.lo.join(",")} → ${r.meta.hi.join(",")} · ${Date.now() - t0} ms`);
  }
}
writeFileSync(INDEX, JSON.stringify(Object.fromEntries(Object.entries(index).sort()), null, 1) + "\n");
