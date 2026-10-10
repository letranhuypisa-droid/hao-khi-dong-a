// design/tools/scene-tris.mjs — đếm tam giác cảnh tĩnh của B15 (buildWorld), Võ trường (buildArena), B20 (addSceneryB20),
// để so trước và sau khi đưa mẫu môi trường Meshy vào game (đầu mục K của design/glb-prompts.md: B20 ≤ ~120 nghìn, B15 không
// tăng). Đếm mọi lưới ba hàm ấy dựng, cả vật đang ẩn (cọc, phao chặn luồng B20): B15 và Võ trường gồm cả mặt đất, B20 chỉ có
// cảnh (địa hình, nước ở world-b20); không có lính, thuyền B20. Kịch bản của game/tools/shot.mjs (Chrome headless), cần máy chủ
// tĩnh ở gốc repo:
//   node game/tools/shot.mjs design/tools/scene-tris.mjs --port <cổng>
// In tổng mỗi cảnh, rồi từng lưới ≥ 40 tam giác: tam giác mỗi bản × số bản, tên, màu, cỡ khối hình (nhận ra vật nào).
// Số đo trên bản gốc trước đợt 19 (cùng cách đếm): B15 472.254, Võ trường 57.000, B20 120.730 (b20-statics 8.553).
//
// Chạy thẳng bằng Node (không cần trình duyệt): dựng ba cảnh trên THREE.Scene với document giả, đếm cùng cách, một lần khi chưa nạp mô hình
// môi trường (khối code) và một lần đã nạp mọi env/*.hkm từ đĩa (glb.js putModel), in tổng hai bên và chênh từng lưới:
//   node design/tools/scene-tris.mjs [--rows] [--only B15,Arena,B20]
export default async (p) => {
  await p.go("/game/?debug");
  await p.wait(2500);
  const r = await p.eval(`(async () => {
    const THREE = await import('three');
    const W = await import('/game/js/battle/world.js');
    const S = await import('/game/js/battle/scenery-b20.js');
    const dump = (scene) => {
      const rows = []; let total = 0;
      scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry, per = (g.index ? g.index.count : g.attributes.position.count) / 3, n = o.isInstancedMesh ? o.count : 1;
        total += per * n; g.computeBoundingBox();
        const b = g.boundingBox, m = Array.isArray(o.material) ? o.material[0] : o.material;
        rows.push({ name: o.name || '', per: Math.round(per), n, tris: Math.round(per * n), vis: o.visible, col: m?.color ? '#' + m.color.getHexString() : '',
          sz: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((v) => +v.toFixed(2)) });
      });
      return { total: Math.round(total), rows: rows.sort((a, b) => b.tris - a.tris) };
    };
    const out = {};
    { const sc = new THREE.Scene(); W.buildWorld(sc, { shadows: false }); out['B15'] = dump(sc); }
    { const sc = new THREE.Scene(); W.buildArena(sc, { shadows: false }); out['Võ trường'] = dump(sc); }
    { const sc = new THREE.Scene(); S.addSceneryB20(sc, { colliders: [] }, { shadows: false }); out['B20'] = dump(sc); }
    return out;
  })()`);
  for (const [k, v] of Object.entries(r)) {
    console.log(`\n== ${k}: ${v.total} tam giác, ${v.rows.length} lưới`);
    for (const x of v.rows.filter((x) => x.tris >= 40))
      console.log(`${String(x.per).padStart(7)} × ${String(x.n).padStart(4)} = ${String(x.tris).padStart(7)}${x.vis ? "" : " (ẩn)"}  ${x.name} ${x.col} ${JSON.stringify(x.sz)}`);
  }
  console.log(`\nTổng: ${Object.entries(r).map(([k, v]) => `${k} ${v.total}`).join(", ")}`);
};

// ---- chạy bằng Node -------------------------------------------------------------------------------------------------------
import { pathToFileURL as _url, fileURLToPath as _path } from "node:url";
if (process.argv[1] && import.meta.url === _url(process.argv[1]).href) {
  const { registerHooks } = await import("node:module"), { dirname, join } = await import("node:path"), { readFileSync } = await import("node:fs");
  const root = join(dirname(_path(import.meta.url)), "../.."), game = join(root, "game");
  const threeUrl = _url(join(game, "vendor/three/three.module.js")).href;
  registerHooks({ resolve: (sp, c, next) => (sp === "three" ? { url: threeUrl, shortCircuit: true } : next(sp, c)) });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };
  const THREE = await import(threeUrl), mod = (f) => import(_url(join(game, "js", f)).href);
  const [Gl, W, S] = await Promise.all([mod("battle/glb.js"), mod("battle/world.js"), mod("battle/scenery-b20.js")]);
  const index = JSON.parse(readFileSync(join(game, "assets/models/index.json"), "utf8"));
  const ids = Object.keys(index).filter((k) => k.startsWith("env/"));
  const setEnv = (on) => { for (const k of ids) { if (!on) { Gl.putModel(k, null); continue; } const b = readFileSync(join(game, "assets/models", index[k].file)); Gl.putModel(k, Gl.parseHKM(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))); } };
  const args = process.argv.slice(2), rowsOn = args.includes("--rows"), only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : ["B15", "Arena", "B20"];
  const dump = (scene) => {
    const rows = new Map(); let total = 0, far = 0;
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry, per = (g.index ? g.index.count : g.attributes.position.count) / 3, n = o.isInstancedMesh ? o.count : 1, L = o.parent?.isLOD ? o.parent.levels : null;
      if (!L || L[L.length - 1].object === o) far += per * n;                       // THREE.LOD: tổng "gần" đếm mức đầu, tổng "xa" mức cuối
      if (L && L[0].object !== o) return;
      total += per * n;
      const key = (o.name || o.parent?.name || "(không tên)") + (o.isInstancedMesh ? " ×" + o.count : "");
      rows.set(key, (rows.get(key) || 0) + per * n);
    });
    return { total: Math.round(total), far: Math.round(far), rows };
  };
  const build = { B15: (sc) => W.buildWorld(sc, { shadows: false, forts: true }), Arena: (sc) => W.buildArena(sc, { shadows: false }), B20: (sc) => S.addSceneryB20(sc, { colliders: [] }, { shadows: false }) };
  for (const k of only) {
    const r = [false, true].map((on) => { setEnv(on); const sc = new THREE.Scene(); build[k](sc); return dump(sc); });
    const d = (v) => (v >= 0 ? "+" : "") + v;
    console.log(`== ${k}: code ${r[0].total} · mô hình ${r[1].total} (${d(r[1].total - r[0].total)})${r[1].far !== r[1].total ? ` · mọi LOD ở mức xa ${r[1].far} (${d(r[1].far - r[0].total)})` : ""}`);
    if (rowsOn) for (const key of new Set([...r[0].rows.keys(), ...r[1].rows.keys()])) {
      const a = Math.round(r[0].rows.get(key) || 0), b = Math.round(r[1].rows.get(key) || 0);
      if (a !== b || a >= 2000) console.log(`   ${String(a).padStart(7)} → ${String(b).padStart(7)}  ${key}`);
    }
  }
}
