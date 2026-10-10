// tests/coaotong.test.mjs — Cung thủ áo Tống của Kế Sách "Cờ áo Tống" (B15): quân Triệu Trung đổ bộ là mười hai cung thủ kit DV_AOTONG (khăn xanh ngọc, áo hổ phách, cung Việt;
// kit/DV_AOTONGh nướng từ GLB Hunyuan3D), không còn giáo binh nhuộm hổ phách. Kiểu lính chỉ sinh có chủ ý (w 0), luôn dùng bản Hunyuan3D, Crowd dựng được cả khi chưa nạp mô hình,
// cung thủ bắn thật vào địch.
//   node game/tests/coaotong.test.mjs
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const threeUrl = pathToFileURL(join(here, "../vendor/three/three.module.js")).href;
registerHooks({ resolve: (s, c, next) => (s === "three" ? { url: threeUrl, shortCircuit: true } : next(s, c)) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => ({ width: 0 })), set: (o, k, v) => ((o[k] = v), true) }) }) };

const T = await import("../js/data/tuning.js");
const M = await import("../js/battle/models.js");
const { KE_SACH } = await import("../js/data/battle-b15.js");
const { KeSachManager } = await import("../js/battle/kesach.js");
const { Crowd } = await import("../js/battle/crowd.js");
const { makeRng } = await import("../js/core/rng.js");
const { KIT_WEAPON } = await import("../js/battle/soldier-motion.js");
const THREE = await import(threeUrl);
const INDEX = JSON.parse(readFileSync(new URL("../assets/models/index.json", import.meta.url), "utf8"));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 4).join("\n       ")); }
}

console.log("Kiểu lính DV_AOTONG");
t("khai báo: phe ta (GIAO_DV), bắn xa tầm 14 m, w 0 nên pickKit không bao giờ chọn nó; tổng w của GIAO_DV vẫn 1", () => {
  const K = T.KITS.DV_AOTONG;
  assert.equal(K.unit, "GIAO_DV"); assert.ok(K.ranged && K.range === 14 && K.windup > 0); assert.equal(K.w, 0);
  for (let i = 0; i <= 20000; i++) assert.notEqual(T.pickKit("GIAO_DV", i === 20000 ? 0.9999999999999999 : i / 20000), "DV_AOTONG", "u = " + i / 20000);
  assert.ok(Math.abs(T.KITS_OF.GIAO_DV.reduce((s, k) => s + T.KITS[k].w, 0) - 1) < 1e-9);
  assert.equal(T.pickKit("GIAO_DV", 0.9999999999999999), "DV_NO", "kiểu dự phòng là kiểu cuối có w > 0, không phải DV_AOTONG");
});
t("tư thế bắn cung như cung thủ Nguyên (KIT_WEAPON), mô hình luôn là bản Hunyuan3D kit/DV_AOTONGh, kể cả ?rigmodel=meshy; tệp đã nướng và nằm trong danh sách nạp trước", () => {
  assert.equal(KIT_WEAPON.DV_AOTONG, "cung");
  assert.equal(M.kitOf("DV_AOTONG"), "DV_AOTONGh"); assert.ok(M.kitFiles().includes("DV_AOTONGh"));
  assert.ok(INDEX["kit/DV_AOTONGh"] && INDEX["kit/DV_AOTONGh"].lods.length === 3, "chưa nướng kit/DV_AOTONGh");
  M.useMeshy();
  assert.equal(M.kitOf("DV_AOTONG"), "DV_AOTONGh", "bản Meshy không có: vẫn Hunyuan3D");
  assert.equal(M.kitOf("DV_GIAO"), "DV_GIAO", "kiểu có bản Meshy thì ?rigmodel=meshy trả về Meshy");
});

console.log("Crowd và Kế Sách");
const mkCtx = (extra = {}) => {
  const hero = { x: -200, z: 0, y: 0, alive: true, hp: 1e6, maxHp: 1e6, state: "free", yaw: 0, giap: 50, move: "N1", st: 0, dur: 1, swingId: 0, hits: 0, receiveHit() { this.hits++; } };
  const ctx = { R: 1, rng: makeRng(7), diff: T.DIFFICULTY[1], hero, units: [], clock: 0, openGates: {}, world: { colliders: [], gates: {}, bases: {} }, fx: null, audio: { play() {} }, ...extra };
  ctx.crowd = new Crowd(new THREE.Scene(), ctx);          // không nạp mô hình: mọi kiểu dựng bằng code (BUILD) — DV_AOTONG phải có bản dự phòng
  return ctx;
};
t("Crowd dựng được khi chưa nạp mô hình (BUILD.DV_AOTONG dự phòng) và sinh được cung thủ áo Tống", () => {
  const ctx = mkCtx(), a = ctx.crowd.spawn({ side: "ta", unit: "GIAO_DV", kit: "DV_AOTONG", role: "zone", front: "A", x: 0, z: 0 });
  assert.equal(a.kit, "DV_AOTONG"); assert.equal(a.K, T.KITS.DV_AOTONG); assert.ok(ctx.crowd.meshes.DV_AOTONG);
  ctx.crowd.update(1 / 30);
});
// Bốn cung thủ cùng kiểu đứng cách một khiên binh địch đứng yên 9 m, 12 s: số loạt tên thật và máu địch mất. DV_AOTONG có số liệu của DV_NO nên phải bắn ngang nó.
const volley = (kit) => {
  const ctx = mkCtx(), crowd = ctx.crowd;
  const e = crowd.spawn({ side: "dich", unit: "KHIEN_NG", kit: "NG_DAO", role: "zone", front: "A", x: 9, z: 0 }); e.speed = 0.01;
  for (let i = 0; i < 4; i++) crowd.spawn({ side: "ta", unit: "GIAO_DV", kit, role: "zone", front: "A", x: -1 - i, z: i - 1.5 });
  let fired = 0; const orig = crowd.fireArrow.bind(crowd);
  crowd.fireArrow = (a, tg, fake) => { if (a.kit === kit && !fake) fired++; orig(a, tg, fake); };
  const hp0 = e.hp;
  for (let i = 0; i < 12 * 30; i++) { ctx.clock += 1 / 30; crowd.update(1 / 30); }
  return { fired, lost: e.state === "dead" || !e.alive ? hp0 : hp0 - e.hp };
};
t("cung thủ áo Tống bắn thật vào địch cách 9 m (có tên bay, địch mất máu) và ngang nỏ thủ DV_NO cùng số liệu", () => {
  const a = volley("DV_AOTONG"), n = volley("DV_NO");
  assert.ok(a.fired >= 3, "loạt tên của cung thủ áo Tống: " + a.fired);
  assert.ok(a.lost > 0, "địch chưa mất máu");
  assert.ok(a.fired >= n.fired * 0.5 && a.fired <= n.fired * 2, `áo Tống ${a.fired} loạt, nỏ thủ ${n.fired} loạt`);
});
t("landBoat: thuyền cập bến thả đúng effect.troops cung thủ áo Tống, phe ta, cánh A, không nhuộm màu; quân cánh A +effect.qTa", () => {
  const ctx = mkCtx({ stats: { mods: {}, legionMult: 1 }, sim: { fronts: { A: { q: { ta: { GIAO_DV: 100 } } } } }, director: { say() {}, hk() {} }, storyEvent() {} });
  const ks = new KeSachManager(ctx, "nhanh"), k = ks.get("coAoTong"), def = KE_SACH.coAoTong;
  assert.ok(k, "Kế Sách Cờ áo Tống có trong chế độ Trận nhanh");
  const before = ctx.crowd.agents.length;
  ks.landBoat(k, { landed: false, name: "Thuyền quân Triệu Trung 1", x: def.landing.x, z: def.landing.z });
  const news = ctx.crowd.agents.slice(before);
  assert.equal(news.length, def.effect.troops);
  for (const a of news) {
    assert.equal(a.kit, "DV_AOTONG"); assert.equal(a.side, "ta"); assert.equal(a.role, "zone"); assert.equal(a.front, "A");
    assert.ok(!a.tint, "còn nhuộm màu hổ phách");
    assert.ok(Math.abs(a.x - def.landing.x) <= 6 && Math.abs(a.z - def.landing.z) <= 3);
  }
  assert.equal(ctx.sim.fronts.A.q.ta.GIAO_DV, 100 + def.effect.qTa);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
