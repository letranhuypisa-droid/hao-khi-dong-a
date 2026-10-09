// tests/skirmish.test.mjs — giao tranh sinh theo seed của chế độ Tự do (đợt 14a, data/skirmish.js): 6 loại nhiệm vụ, mở theo
// bậc, xác định theo seed, quy mô tăng theo bậc, mọi điểm nằm trên đất Hàm Tử ngoài tường Hàm Tử quan, địch kéo tới từ một
// hướng (cửa vào có cờ) chứ không bật ra cạnh người chơi, bảng nhiệm vụ đúng số lựa chọn của bậc. Chạy trong Node:
//   node game/tests/skirmish.test.mjs
import assert from "node:assert/strict";
import { MISSIONS, MISSION_ORDER, makeSkirmish, missionBoard, SITES } from "../js/data/skirmish.js";
import { PICKS, RANKS } from "../js/data/career.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const inMap = (p) => p && p.x >= 20 && p.x <= 450 && p.z >= -160 && p.z <= 185;   // đất trận, tây tường Hàm Tử quan (x 462), nam bờ sông (z −168)
const allPts = (s) => {
  const out = [s.site, s.entry, ...(s.points || [])];
  for (const w of s.waves || []) out.push(w.from);
  const isPt = (q) => q && typeof q === "object" && "x" in q && "z" in q;
  for (const k of ["camp", "convoy", "escort", "captives", "duel"]) if (s[k]) for (const v of Object.values(s[k])) if (isPt(v)) out.push(v); else if (Array.isArray(v)) for (const q of v) if (isPt(q)) out.push(q);
  return out.filter(Boolean);
};

console.log("Loại nhiệm vụ");
t("đúng 6 loại: Giữ đồn, Đánh úp trại, Chặn tiếp tế, Hộ tống, Cứu đồng đội, Đấu tướng", () => {
  assert.deepEqual(MISSION_ORDER.map((k) => MISSIONS[k].name), ["Giữ đồn", "Đánh úp trại", "Chặn tiếp tế", "Hộ tống", "Cứu đồng đội", "Đấu tướng"]);
  for (const k of MISSION_ORDER) { const M = MISSIONS[k]; assert.ok(M.base >= 50 && M.base <= 100, k); assert.ok(M.goal && M.how, k); assert.ok(M.minRank >= 0 && M.minRank < RANKS.length, k); }
});
t("Lính đã có ít nhất 3 loại; Đấu tướng mở từ Đội trưởng", () => {
  assert.ok(MISSION_ORDER.filter((k) => MISSIONS[k].minRank === 0).length >= 3);
  assert.equal(MISSIONS.dautuong.minRank, 2);
});

console.log("Sinh theo seed");
t("cùng seed, cùng bậc, cùng loại → giống hệt; seed khác → khác", () => {
  for (const k of MISSION_ORDER) {
    assert.deepEqual(makeSkirmish(1234, 2, k), makeSkirmish(1234, 2, k), k);
  }
  const a = JSON.stringify(makeSkirmish(1, 1, "giudon")), b = JSON.stringify(makeSkirmish(2, 1, "giudon"));
  assert.notEqual(a, b);
});
t("mọi điểm (khu, cửa vào, đợt địch, trại, đoàn xe, tù binh…) nằm trong đất trận, ngoài tường Hàm Tử quan", () => {
  for (const k of MISSION_ORDER) for (let seed = 1; seed <= 40; seed++) for (const r of [0, 2, 4]) {
    const s = makeSkirmish(seed, r, k);
    for (const p of allPts(s)) assert.ok(inMap(p), `${k} seed ${seed} bậc ${r}: (${p.x}, ${p.z})`);
  }
});
t("địch kéo tới từ cửa vào cách khu ≥ 45 m (không bật ra cạnh người chơi); người lính xuất phát cách cửa vào ≥ 40 m", () => {
  for (const k of MISSION_ORDER) for (let seed = 1; seed <= 30; seed++) {
    const s = makeSkirmish(seed, 1, k);
    const d = Math.hypot(s.entry.x - s.site.x, s.entry.z - s.site.z);
    assert.ok(d >= 45, `${k} seed ${seed}: cửa vào cách khu ${d.toFixed(0)} m`);
    assert.ok(Math.hypot(s.spawn.x - s.entry.x, s.spawn.z - s.entry.z) >= 40, `${k} seed ${seed}: chỗ xuất phát gần cửa vào`);
    for (const w of s.waves || []) assert.ok(Math.hypot(w.from.x - s.entry.x, w.from.z - s.entry.z) <= 12, `${k}: đợt địch ra từ cửa vào`);
  }
});
t("thời lượng 3–6 phút; Giữ đồn trụ 150–210 s", () => {
  for (const k of MISSION_ORDER) for (let seed = 1; seed <= 20; seed++) {
    const s = makeSkirmish(seed, 1, k);
    assert.ok(s.timeLimit >= 180 && s.timeLimit <= 360, `${k}: ${s.timeLimit}`);
    if (k === "giudon") assert.ok(s.hold >= 150 && s.hold <= 210, `giữ ${s.hold}`);
  }
});
t("quy mô tăng theo bậc: tổng lính địch và sĩ quan không giảm khi lên bậc; cấp trận R = cấp của bậc", () => {
  for (const k of MISSION_ORDER) {
    let prev = { n: 0, off: 0 };
    for (let r = MISSIONS[k].minRank; r < RANKS.length; r++) {
      const s = makeSkirmish(77, r, k), n = s.enemyTotal, off = s.officers.length;
      assert.ok(n >= prev.n && off >= prev.off, `${k} bậc ${r}: ${n} lính, ${off} sĩ quan (trước ${prev.n}, ${prev.off})`);
      assert.equal(s.R, RANKS[r].level);
      prev = { n, off };
    }
  }
});
t("Đấu tướng: có đúng một tướng địch để thách đấu, bậc theo bậc người lính (Đội trưởng → Đội trưởng địch … Tướng → Tướng địch)", () => {
  assert.equal(makeSkirmish(5, 2, "dautuong").duel.tier, "doitruong");
  assert.equal(makeSkirmish(5, 3, "dautuong").duel.tier, "photuong");
  assert.equal(makeSkirmish(5, 4, "dautuong").duel.tier, "tuong");
});
t("mỗi giao tranh 2 mục phụ, có tên", () => {
  for (const k of MISSION_ORDER) { const s = makeSkirmish(9, 2, k); assert.equal(s.side.length, 2, k); for (const x of s.side) assert.ok(x.id && x.name, k); }
});
t("khu đánh là chỗ có thật trên bản đồ Hàm Tử (tên + toạ độ)", () => {
  for (const s of Object.values(SITES)) { assert.ok(s.name && inMap(s), s.name); }
  for (const k of MISSION_ORDER) assert.ok(SITES[makeSkirmish(3, 2, k).siteId], k);
});

console.log("Bảng nhiệm vụ");
t("số lựa chọn theo bậc (1 · 2 · 2 · 3 · 3), không trùng loại, chỉ loại đã mở", () => {
  for (let r = 0; r < RANKS.length; r++) for (let n = 0; n < 20; n++) {
    const b = missionBoard(4242, n, r);
    assert.equal(b.length, PICKS[r], `bậc ${r}`);
    assert.equal(new Set(b.map((s) => s.type)).size, b.length);
    for (const s of b) assert.ok(MISSIONS[s.type].minRank <= r, `${s.type} chưa mở ở bậc ${r}`);
  }
});
t("bảng xác định theo (seed lính, số trận), đổi sau mỗi trận", () => {
  assert.deepEqual(missionBoard(11, 3, 2).map((s) => s.seed), missionBoard(11, 3, 2).map((s) => s.seed));
  assert.notDeepEqual(missionBoard(11, 3, 2).map((s) => s.seed), missionBoard(11, 4, 2).map((s) => s.seed));
});
t("qua nhiều trận, Lính gặp đủ các loại đã mở (không kẹt một loại)", () => {
  const seen = new Set(); for (let n = 0; n < 40; n++) seen.add(missionBoard(99, n, 0)[0].type);
  assert.equal(seen.size, MISSION_ORDER.filter((k) => MISSIONS[k].minRank === 0).length);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
