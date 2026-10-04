// design/tools/scene-tris.mjs — đếm tam giác cảnh tĩnh của B15 (buildWorld), Võ trường (buildArena), B20 (addSceneryB20),
// để so trước và sau khi đưa mẫu môi trường Meshy vào game (đầu mục K của design/glb-prompts.md: B20 ≤ ~120 nghìn, B15 không
// tăng). Đếm mọi lưới ba hàm ấy dựng, cả vật đang ẩn (cọc, phao chặn luồng B20): B15 và Võ trường gồm cả mặt đất, B20 chỉ có
// cảnh (địa hình, nước ở world-b20); không có lính, thuyền B20. Kịch bản của game/tools/shot.mjs (Chrome headless), cần máy chủ
// tĩnh ở gốc repo:
//   node game/tools/shot.mjs design/tools/scene-tris.mjs --port <cổng>
// In tổng mỗi cảnh, rồi từng lưới ≥ 40 tam giác: tam giác mỗi bản × số bản, tên, màu, cỡ khối hình (nhận ra vật nào).
// Số đo trên bản gốc trước đợt 19 (cùng cách đếm): B15 472.254, Võ trường 57.000, B20 120.730 (b20-statics 8.553).
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
