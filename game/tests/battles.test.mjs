// tests/battles.test.mjs — lõi nhiều trận (đợt 9, C1): móc mặt đất của ground.js (setBattleTerrain / setDecks /
// setWaterLevel), danh mục trận data/battles.js, ngân hàng thẻ theo Chương của meta/chapter.js. Chạy trong Node:
//   node hao-khi-viet/game/tests/battles.test.mjs
import assert from "node:assert/strict";
import * as G from "../js/battle/ground.js";
import { BATTLES, BATTLE_ORDER, loadChapterMeta } from "../js/data/battles.js";
import * as C from "../js/meta/chapter.js";
import { TERRAIN_B20 } from "../js/data/terrain-b20.js";
import { ATMO, ATMO_B15 } from "../js/battle/atmosphere.js";

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const newSave = () => ({ chapters: {}, cards: {}, quiz: { done: 0, answered: {}, review: [] } });

console.log("Mặt đất nhiều trận (ground.js)");
const h0 = G.heightAt, c0 = G.collide, m0 = G.mudAt, w0 = G.waterDist;
const pts = [[72, -32], [228, -2], [300, 40], [461, 60], [540, -175], [20, 150], [590, -195]];
const snap = () => pts.map(([x, z]) => [G.heightAt(x, z), G.mudAt(x, z), G.waterDist(x, z), G.bareHeightAt(x, z), G.analyticHeightAt(x, z)]);
await t("mặc định (B15): waterLevel = −∞, surfaceY = heightAt, không đổi hàm sau khi đặt rồi bỏ địa hình khác", () => {
  G.setTerrain("map");
  const before = snap();
  assert.equal(G.waterLevel(), -Infinity);
  for (const [x, z] of pts) assert.equal(G.surfaceY(x, z), G.heightAt(x, z));
  G.setBattleTerrain({ height: () => 5, clamp: { x0: 0, x1: 10, z0: 0, z1: 10 } });
  G.setDecks({ heightAt: () => 9 }); G.setWaterLevel(() => 7);
  assert.notEqual(G.heightAt, h0);
  G.setBattleTerrain(null); G.setDecks(null); G.setWaterLevel(null);
  assert.equal(G.heightAt, h0); assert.equal(G.collide, c0); assert.equal(G.mudAt, m0); assert.equal(G.waterDist, w0);
  assert.deepEqual(snap(), before);
});
await t("setTerrain (Võ trường / Hàm Tử) bỏ luôn địa hình, boong, nước của trận khác", () => {
  G.setBattleTerrain({ height: () => 5, clamp: { x0: 0, x1: 10, z0: 0, z1: 10 } }); G.setWaterLevel(() => 3);
  G.setTerrain("arena");
  assert.equal(G.battleTerrain(), null); assert.equal(G.waterLevel(), -Infinity);
  assert.equal(G.heightAt(0, 0), 0.3);                                   // sân Võ trường phẳng 0,3 m
  G.setTerrain("map");
  assert.equal(G.heightAt, h0);
});
await t("địa hình B20: heightAt / mudAt / waterDist theo T, boong trước mặt đất (NaN → đất), surfaceY = max(đất, nước)", () => {
  const T = { ...TERRAIN_B20, clamp: TERRAIN_B20.clamp };
  G.setBattleTerrain(T);
  assert.equal(G.laneFeaturesOn(), false);
  for (const [x, z] of [[600, -90], [650, 10], [100, 30]]) {
    assert.equal(G.heightAt(x, z), TERRAIN_B20.height(x, z));
    assert.equal(G.mudAt(x, z), TERRAIN_B20.mud(x, z));
    assert.equal(G.waterDist(x, z), TERRAIN_B20.waterDist(x, z));
  }
  G.setDecks({ heightAt: (x, z) => (x > 640 && x < 660 ? 2.5 : NaN) });
  assert.equal(G.heightAt(650, 10), 2.5);
  assert.equal(G.heightAt(600, 10), TERRAIN_B20.height(600, 10));
  G.setWaterLevel(() => 1.4);
  assert.equal(G.waterLevel(), 1.4);
  assert.equal(G.surfaceY(600, 10), Math.max(TERRAIN_B20.height(600, 10), 1.4));   // giữa sông: mặt nước
  assert.equal(G.surfaceY(600, -110), TERRAIN_B20.height(600, -110));               // trên bờ cao: mặt đất
  G.setTerrain("map");
});
await t("collide trên địa hình khác: kẹp theo T.clamp, collideExtra nhận vật đang đi (tham số 6), tường vẫn đẩy", () => {
  let seen = null;
  G.setBattleTerrain({ height: () => 0, clamp: { x0: -60, x1: 1240, z0: -240, z1: 240 },
    collideExtra: (x, z, r, o) => { seen = o; return z > 100 ? [x, 100] : null; } });
  const world = { colliders: [{ x0: 0, z0: -5, x1: 0, z1: 5, r: 0.5 }], gates: {} };
  const o = { id: "tướng" };
  assert.deepEqual(G.collide(world, 2000, -500, 0.4, {}, o), [1240, -240]);
  assert.equal(seen, o);
  assert.deepEqual(G.collide(world, 50, 150, 0.4, {}), [50, 100]);
  const [x] = G.collide(world, 0.3, 0, 0.4, {});                              // trong tường dày 0,5 + bán kính 0,4
  assert.ok(x >= 0.9 - 1e-9, "tường không đẩy: " + x);
  G.setTerrain("map");
  // B15: collide như cũ (kẹp bờ sông Hàm Tử)
  assert.deepEqual(G.collide({ colliders: [], gates: {} }, -50, 300, 0.4, {}), [4, 196]);
});

console.log("\nDanh mục trận, thẻ theo Chương, trời theo pha");
await t("danh mục: B15 (thang R, H35) và B20 (R 25 cố định, H31 chơi được, H34/H38 sắp có, chỉ Trận nhanh, đang dựng)", () => {
  assert.deepEqual(BATTLE_ORDER, ["B15", "B16", "B20"]);
  const A = BATTLES.B15, B = BATTLES.B20;
  assert.equal(A.ladder, true); assert.deepEqual(A.heroes, ["H35"]);
  assert.equal(A.result.missionsTotal, 4); assert.equal(A.result.sideTotal, 2);
  assert.equal(B.fixedR, 25); assert.deepEqual(B.preset, { level: 25 }); assert.deepEqual(B.modes, ["nhanh"]);
  assert.deepEqual(B.heroes, ["H31", "H34", "H38"]); assert.deepEqual(B.playable, ["H31"]); assert.equal(B.wip, true);
  for (const id of BATTLE_ORDER) for (const k of ["load", "comic", "suquan", "notes"]) assert.equal(typeof BATTLES[id][k], "function", id + "." + k);
});
await t("danh mục: B16 bản thử (R 13 cố định, H35 của người chơi, H32 sắp có, chỉ Trận nhanh, par = tổng par pha)", async () => {
  const B = BATTLES.B16, D = await import("../js/data/battle-b16.js");
  assert.equal(B.fixedR, 13); assert.equal(B.preset, undefined); assert.equal(B.ownHero, true); assert.equal(B.wip, true);
  assert.deepEqual(B.heroes, ["H32", "H35"]); assert.deepEqual(B.playable, ["H35"]); assert.deepEqual(B.modes, ["nhanh"]);
  assert.equal(B.par.nhanh, D.PAR_B16);
  assert.equal(B.result.missionsTotal, D.PHASES.length); assert.equal(B.result.sideTotal, D.SIDE_MISSIONS.length);
  assert.deepEqual(await B.marks(), ["Đánh úp bến thuyền", "Dân binh các lộ"]);
});
await t("nội dung Chương nạp lười: comic, thẻ, Quiz của B15 và B20; ghi chú màn nạp trận", async () => {
  for (const id of BATTLE_ORDER) {
    const M = await loadChapterMeta(id);
    assert.equal(M.comic.chapter.id, id);
    if (BATTLES[id].wip && !M.cards.length) {            // Chương đang dựng chưa có nội dung (B16 bản thử): chỉ cần rỗng đúng dạng + ghi chú màn nạp
      assert.deepEqual([M.comic.open, M.comic.close, M.quiz], [[], [], []], id);
      assert.ok((await BATTLES[id].notes()).length >= 3, id + " ghi chú");
      continue;
    }
    assert.ok(M.cards.length >= 8 && M.cards.every((c) => c.chapter === id), id + " thẻ");
    assert.ok(M.quiz.length >= 10 && M.quiz.every((q) => q.chapter === id), id + " quiz");
    assert.ok(M.groups.length >= 6, id + " nhóm thẻ");
    const notes = await BATTLES[id].notes();
    assert.ok(notes.length >= 3 && notes.every((n) => n.label && n.text), id + " ghi chú");
  }
  assert.ok((await loadChapterMeta("B20")).comic.council, "B20 có Hiến kế");
});
await t("thẻ theo Chương: B15 có sẵn; B20 chỉ mở sau khi đăng ký ngân hàng; không mở thẻ Chương khác", async () => {
  const s = newSave();
  assert.deepEqual(C.unlockCards(s, "B20", ["chapterOpen"], 1), []);           // chưa đăng ký
  const M = await loadChapterMeta("B20");
  C.registerCards("B20", M.cards);
  const got = C.unlockCards(s, "B20", ["chapterOpen"], 2);
  assert.ok(got.length >= 1 && got.every((id) => M.cardById[id].chapter === "B20"), got.join());
  assert.ok(!Object.keys(s.cards).some((id) => id.startsWith("B15")));
  const b15 = C.unlockCards(s, "B15", ["chapterOpen"], 3);
  assert.ok(b15.length >= 1 && b15.every((id) => !M.cardById[id]));
  const keys = C.battleUnlockKeys({ won: true, bossMet: true, keSachList: [{ id: "kichCoc", state: "thanhcong" }] });
  assert.deepEqual(keys, ["bossMet", "keSach:kichCoc", "firstWin"]);
  assert.ok(C.unlockCards(s, "B20", keys, 4).includes("B20-baicoc"));
});
await t("trời B15 lấy qua ATMO_B15 (đúng bảng ATMO), pha kẹp trong bảng", () => {
  assert.equal(ATMO_B15.presets, ATMO); assert.equal(typeof ATMO_B15.buildSources, "function"); assert.equal(typeof ATMO_B15.sourceWant, "function");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
if (fail) process.exitCode = 1;
