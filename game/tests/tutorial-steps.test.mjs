// tests/tutorial-steps.test.mjs — màn Huấn luyện (đợt 11): điều kiện qua bài hiện trong thẻ, đếm bài, thứ tự thuật ngữ, nút bỏ qua.
// Phần dữ liệu và luật của các bài nằm ở data/tutorial-steps.js (thuần, không THREE) nên kiểm được trong Node:
//   node hao-khi-viet/game/tests/tutorial-steps.test.mjs
import assert from "node:assert/strict";
import { STEPS, DRILL_COUNT, SKIP_AFTER, CAM_TURN, isDrill, freshStats, cUsed, progressOf, doneOf, passLine, goalLine,
  tutorialProgress, exitLine, skipOffer, parryHint } from "../js/data/tutorial-steps.js";
import { DEFENSE } from "../js/data/tuning.js";
import { ARENA_MODES } from "../js/meta/arena.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

// Giám đốc giả: chỉ có những gì chữ và điều kiện của các bài đọc (ctx.hero, ctx.touch / input.pad để chọn thiết bị, st, mk, cSet).
const fakeD = (dev = 0, o = {}) => ({
  ctx: { touch: dev === 1, input: { pad: dev === 2 }, hero: { x: 0, z: 0, lock: null, state: "free", ...(o.hero || {}) } },
  st: { ...freshStats(), ...(o.st || {}) }, mk: o.mk === undefined ? { x: 10, z: -6 } : o.mk,
  cSet() { return cUsed(this.st); },
});
const step = (id) => STEPS.find((S) => S.id === id);
const drills = STEPS.filter(isDrill);
const vn = (x) => String(x).replace(".", ",");

console.log("Đếm bài: thông báo thoát và bảng dùng cùng một số");
t("có 11 bài tập; DRILL_COUNT lấy từ danh sách chứ không gõ tay", () => {
  assert.equal(drills.length, 11);
  assert.equal(DRILL_COUNT, drills.length);
});
t("thẻ Võ trường ở Doanh trại nói đúng số bài tập", () => {
  assert.ok(ARENA_MODES.huanluyen.text.startsWith(`${DRILL_COUNT} bài tập`), ARENA_MODES.huanluyen.text);
});
t("tiêu đề bài tập đánh số liền 1..11 theo đúng thứ tự", () => {
  drills.forEach((S, j) => assert.match(S.title, new RegExp("^Bài " + (j + 1) + " · "), S.title));
});
t("tutorialProgress: giới thiệu, từng bài tập, thẻ ghi nhớ, thẻ cuối", () => {
  assert.deepEqual(tutorialProgress(STEPS, 0), { k: 0, n: 11, where: "intro" });
  drills.forEach((S, j) => assert.deepEqual(tutorialProgress(STEPS, STEPS.indexOf(S)), { k: j + 1, n: 11, where: "drill" }, S.id));
  const notes = STEPS.filter((S) => !isDrill(S) && S.id !== "intro" && !S.final);
  assert.ok(notes.length >= 3, "có các thẻ ghi nhớ");
  for (const S of notes) assert.deepEqual(tutorialProgress(STEPS, STEPS.indexOf(S)), { k: 11, n: 11, where: "notes" }, S.id);
  assert.deepEqual(tutorialProgress(STEPS, STEPS.length - 1), { k: 11, n: 11, where: "end" });
});
t("exitLine: không còn ghi tổng 16 mục như thông báo cũ", () => {
  const at = (i) => exitLine(tutorialProgress(STEPS, i));
  assert.equal(at(0), "Đã rời huấn luyện trước khi vào bài 1.");
  assert.equal(at(3), "Đã rời huấn luyện ở bài 3 / 11.");
  assert.match(at(STEPS.findIndex((S) => S.id === "cmd")), /11 \/ 11/);
  assert.match(at(STEPS.length - 1), /11 \/ 11/);
  for (let i = 0; i < STEPS.length; i++) assert.ok(!/16/.test(at(i)), at(i));
});

console.log("\nĐiều kiện qua bài: một danh sách cho thẻ, thanh tiến độ và dòng mục tiêu");
t("mọi bài tập có conds, thẻ ghi nhớ thì không", () => {
  for (const S of STEPS) assert.equal(typeof S.conds === "function", isDrill(S), S.id);
  assert.equal(typeof step("intro").conds, "undefined");
});
t("bài mới vào: chưa điều kiện nào xong, tiến độ 0, mỗi điều kiện có chữ nói và nhãn", () => {
  for (const S of drills) {
    const cs = S.conds(fakeD());
    assert.ok(cs.length >= 1, S.id);
    assert.equal(doneOf(cs), false, S.id); assert.equal(progressOf(cs), 0, S.id);
    for (const c of cs) { assert.ok(c.of >= 1 && c.n === 0, S.id); assert.ok(c.say && c.label, S.id); }
  }
});
const WIN = {
  move: { hero: { x: 10, z: -6 } }, cam: { st: { camTurn: CAM_TURN } }, n: { st: { kills: 3, maxN: 4 } },
  c: { st: { moves: new Set(["C1", "C3", "C4"]) } }, dodge: { st: { dodges: 2, moves: new Set(["DN"]) } }, block: { st: { blocks: 3 } },
  parry: { st: { parries: 1 } }, break: { st: { moves: new Set(["DQ"]) } }, skill: { st: { skills: 2, skillHits: 4 } },
  ult: { st: { ult: true } }, lock: { hero: { lock: {} } },
};
t("đủ điều kiện thì bài xong và tiến độ 1 (mười một bài)", () => {
  assert.deepEqual(Object.keys(WIN).sort(), drills.map((S) => S.id).sort());
  for (const S of drills) { const cs = S.conds(fakeD(0, WIN[S.id])); assert.equal(doneOf(cs), true, S.id); assert.equal(progressOf(cs), 1, S.id); }
});
t("Bài 3: đủ 3 lính mà chưa tới N4 thì chưa qua; thẻ nói rõ cần chuỗi tới N4", () => {
  const cs = step("n").conds(fakeD(0, { st: { kills: 3, maxN: 3 } }));
  assert.equal(doneOf(cs), false); assert.equal(progressOf(cs), 0.5);
  assert.equal(passLine(cs), "Qua bài khi: hạ 3 lính tập và đánh một chuỗi liền tới nhát N4.");
  assert.equal(goalLine(cs), "Hạ lính 3/3 · Chuỗi tới N4 ✗");
  assert.equal(goalLine(step("n").conds(fakeD(0, { st: { kills: 1, maxN: 4 } }))), "Hạ lính 1/3 · Chuỗi tới N4 ✓");
});
t("Bài 5 cần 2 lần né và 1 Lướt chém; Bài 9 cần 2 lần lao và 4 lính trúng — thẻ nói đủ", () => {
  assert.match(passLine(step("dodge").conds(fakeD())), /né 2 lần.*Lướt chém/);
  assert.match(passLine(step("skill").conds(fakeD())), /lao 2 lần.*4 lính/);
  const half = step("skill").conds(fakeD(0, { st: { skills: 2, skillHits: 0 } }));
  assert.equal(doneOf(half), false); assert.equal(progressOf(half), 0.5);
});
t("Bài 8 hai nấc (Vỡ Thế rồi Đòn Quyết), Bài 10 hai nấc (dùng rồi chém cho hết)", () => {
  const broke = step("break").conds(fakeD(0, { st: { broke: true } }));
  assert.equal(progressOf(broke), 0.5); assert.equal(doneOf(broke), false);
  assert.equal(doneOf(step("break").conds(fakeD(0, { st: { officerKilled: true } }))), true);
  const mid = step("ult").conds(fakeD(0, { st: { ult: true }, hero: { state: "ult" } }));
  assert.equal(progressOf(mid), 0.5); assert.equal(doneOf(mid), false);
});
t("Bài 2 ngưỡng nửa vòng: dòng mục tiêu hiện phần trăm, thẻ không hứa 'một vòng'", () => {
  const S = step("cam");
  assert.match(goalLine(S.conds(fakeD(0, { st: { camTurn: CAM_TURN / 2 } }))), /Xoay camera 50%/);
  assert.match(passLine(S.conds(fakeD())), /nửa vòng/);
  assert.ok(!/một vòng/.test(passLine(S.conds(fakeD())) + S.text(fakeD())));
});
t("Bài 4 ghi những đòn C đã dùng; chỉ đếm C1–C6", () => {
  assert.deepEqual([...cUsed({ moves: new Set(["N1", "C1", "C3", "DC", "DQ", "C6"]) })].sort(), ["C1", "C3", "C6"]);
  const cs = step("c").conds(fakeD(0, { st: { moves: new Set(["C1", "N2"]) } }));
  assert.match(goalLine(cs), /C1.*1\/3/);
});
t("progressOf là trung bình tỉ lệ từng điều kiện, chặn ở 1; doneOf cần đủ mọi điều kiện", () => {
  assert.equal(progressOf([{ n: 1, of: 2 }, { n: 2, of: 2 }]), 0.75);
  assert.equal(progressOf([{ n: 9, of: 2 }]), 1);
  assert.equal(doneOf([{ n: 2, of: 2 }, { n: 0, of: 1 }]), false);
  assert.equal(progressOf([]), 0);
});

console.log("\nBài 7: lời đúng với code, báo hụt");
t("chữ nói vòng đỏ lớn dần cho ĐẦY lúc cú bổ rơi; cửa sổ, khóa, báo trước lấy từ DEFENSE", () => {
  const txt = step("parry").text(fakeD(0));
  assert.ok(/vừa đầy/.test(txt) && !/khép lại/.test(txt), txt);
  for (const v of [DEFENSE.redTelegraph, DEFENSE.parryWindow, DEFENSE.counterLockout]) assert.ok(txt.includes(vn(v)), vn(v) + " ∉ " + txt);
  assert.ok(step("parry").text(fakeD(1)).includes(vn(DEFENSE.parryWindowTouch)), "cảm ứng có cửa sổ riêng");
});
t("parryHint: bấm sớm → 'Sớm quá', hụt khi chưa có vòng đỏ → 'Hụt', hết cue thì về mẹo, phản đòn xong thì im", () => {
  const miss = { ...freshStats(), parryMiss: 1, missT: 2, missRed: true };
  assert.match(parryHint(miss, 0), /Sớm quá/); assert.match(parryHint(miss, 0), /Shift/);
  assert.match(parryHint(miss, 1), /nút Đỡ/);
  assert.match(parryHint({ ...miss, missRed: false }, 0), /Hụt/);
  assert.equal(parryHint(freshStats(), 0), null);
  assert.match(parryHint({ ...freshStats(), redSeen: 3 }, 0), /Mẹo/);
  assert.equal(parryHint({ ...freshStats(), redSeen: 3, parries: 1 }, 0), null);
  assert.equal(typeof step("parry").hint, "function");
});

console.log("\nThứ tự thẻ và thuật ngữ");
t("thẻ ghi nhớ xếp: Mệnh Lệnh → Cứ Điểm và Kế Sách → Hào Khí → Xong; bài tập đứng trước", () => {
  assert.deepEqual(STEPS.map((S) => S.id), ["intro", "move", "cam", "n", "c", "dodge", "block", "parry", "break", "skill", "ult", "lock", "cmd", "base", "hk", "end"]);
});
const TERMS = ["Cứ Điểm", "Kế Sách", "Hào Khí", "Tổng Phản Công", "Mệnh Lệnh", "Phá Thế", "Vỡ Thế", "Đòn Quyết", "Khí Lực", "Tuyệt Kỹ", "Phá Trận"];
const textOf = (S) => [0, 1, 2].map((dev) => S.title + " " + S.text(fakeD(dev))).join(" ");
t("thuật ngữ chỉ xuất hiện từ thẻ định nghĩa nó trở đi (không dùng trước khi giải thích)", () => {
  const defAt = {}; STEPS.forEach((S, i) => (S.defines || []).forEach((w) => (defAt[w] ??= i)));
  const bad = [];
  for (const w of TERMS) {
    const first = STEPS.findIndex((S) => textOf(S).includes(w));
    if (first < 0) continue;
    if (defAt[w] === undefined) bad.push(`"${w}" xuất hiện ở ${STEPS[first].id} mà không thẻ nào ghi defines`);
    else if (first < defAt[w]) bad.push(`"${w}" dùng ở ${STEPS[first].id} trước thẻ định nghĩa ${STEPS[defAt[w]].id}`);
  }
  assert.deepEqual(bad, []);
});
t("thẻ Cứ Điểm nói luật chiếm bị đòn viền đỏ ngắt (trước đây không chỗ nào nói)", () => {
  assert.match(step("base").text(fakeD(0)), /viền đỏ.*về 0/);
});
t("Bài 2 không mượn icon 'Khóa mục tiêu': icon khóa chỉ xuất hiện từ Bài 11", () => {
  const first = STEPS.findIndex((S) => (S.icons || []).includes("lock"));
  assert.equal(STEPS[first].id, "lock");
  assert.deepEqual(step("cam").icons, []);
});
t("chữ của mọi thẻ đổi đúng theo cả ba thiết bị: không còn { } hay undefined; giới thiệu nói đúng số bài", () => {
  for (const dev of [0, 1, 2]) for (const S of STEPS) { const txt = S.text(fakeD(dev)); assert.ok(!/[{}]|undefined|NaN/.test(txt), S.id + ": " + txt); }
  assert.match(step("intro").text(fakeD(0)), new RegExp(DRILL_COUNT + " bài"));
});

console.log("\nBỏ qua bài kẹt");
t("skipOffer: cảm ứng có nút, bàn phím và tay cầm có dòng nhắc; chỉ sau SKIP_AFTER giây, chưa xong, bài tập", () => {
  const o = (dev, stepT, completed = false, drill = true) => skipOffer({ drill, dev, stepT, completed });
  assert.equal(SKIP_AFTER, 25);
  assert.equal(o(1, SKIP_AFTER + 1), "button");
  assert.equal(o(0, SKIP_AFTER + 1), "hint"); assert.equal(o(2, SKIP_AFTER + 1), "hint");
  assert.equal(o(1, SKIP_AFTER - 1), null); assert.equal(o(0, SKIP_AFTER), null);
  assert.equal(o(1, SKIP_AFTER + 1, true), null);
  assert.equal(o(1, SKIP_AFTER + 1, false, false), null);       // thẻ ghi nhớ đã có nút Tiếp
});

console.log("\nTrạng thái bài mới");
t("freshStats: đủ trường cho mọi điều kiện, có chỗ cho cue phản đòn, mỗi lần một đối tượng riêng", () => {
  const a = freshStats(), b = freshStats();
  for (const k of ["kills", "maxN", "dodges", "blocks", "parries", "redSeen", "skills", "skillHits", "camTurn", "parryMiss", "missT"]) assert.equal(a[k], 0, k);
  for (const k of ["broke", "officerKilled", "ult", "missRed"]) assert.equal(a[k], false, k);
  assert.notEqual(a.moves, b.moves);
});

console.log("\n" + pass + " đạt, " + fail + " trượt");
process.exit(fail ? 1 : 0);
