// tests/hints.test.mjs — giải thích thuật ngữ ngay lúc gặp (đợt 11): bảng thuật ngữ một nguồn (data/glossary.js), bộ gợi ý lần đầu
// (battle/hints.js: hàng đợi, giãn cách, ưu tiên, cờ đã xem lưu trong save), luật khi nào đến hạn từng gợi ý, và những chỗ HUD / tên đòn
// liên quan ("Sĩ Khí", "Phá thế" ≠ "Phá Thế" ≠ "Phá Trận"). Thuần, chạy trong Node:
//   node hao-khi-viet/game/tests/hints.test.mjs
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { GLOSS, CONCEPT_ORDER } from "../js/data/glossary.js";
import { HINTS, createHints, hintsDue, createHintDriver } from "../js/battle/hints.js";
import { HERO, HAO_KHI, SIM, DEFENSE, DIFFICULTY, BROKEN_SEC, BROKEN_MULT, KITS, AI } from "../js/data/tuning.js";
import { SKILLS } from "../js/data/heroes.js";
import { WEAPON_CLASSES } from "../js/data/weapon-classes.js";
import { fmtKeys } from "../js/data/controls.js";
import { movesGuideHTML } from "../js/ui/guide.js";
import { MOVE_INFO } from "../js/data/moves-info.js";
import { MOVE_INFO_WC01 } from "../js/data/moves-wc01.js";
import { skillBarHTML, frontRowHTML } from "../js/battle/hud.js";
import * as P from "../js/meta/progress.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}
const ICONS = fileURLToPath(new URL("../assets/icons", import.meta.url));
const vn = (x) => String(x).replace(".", ",");

console.log("Bảng thuật ngữ (một nguồn cho thẻ Doanh trại và gợi ý)");
t("mỗi thuật ngữ có tên, câu dài và icon có thật trong assets/icons", () => {
  for (const [id, g] of Object.entries(GLOSS)) {
    assert.ok(g.name && g.long, id);
    assert.ok(existsSync(join(ICONS, g.icon + ".webp")), id + ": icon " + g.icon);
  }
  for (const id of CONCEPT_ORDER) assert.ok(GLOSS[id], "CONCEPT_ORDER có id lạ: " + id);
  for (const id of ["siKhi", "guongDay", "phaThe"]) assert.ok(CONCEPT_ORDER.includes(id), id + " phải có trong thẻ Trong trận");
});
t("Gượng dậy: câu dài lấy số từ tuning (Sinh lực hồi, bất tử, Hào Khí trừ) và nêu số lượt từng độ khó", () => {
  const g = GLOSS.guongDay.long;
  for (const v of [`${Math.round(HERO.revive.hp * 100)}%`, `${HERO.revive.invuln} s`, String(-HAO_KHI.src.reviveUsed)]) assert.ok(g.includes(v), v + " ∉ " + g);
  for (const d of DIFFICULTY) assert.ok(g.includes(d.name), d.name + " ∉ " + g);
  assert.match(g, /thua/);
});
t("Sĩ Khí: câu dài nêu thang 0–100, dải mạnh / yếu và ngưỡng vỡ cánh lấy từ SIM", () => {
  const g = GLOSS.siKhi.long, hi = SIM.skBands[0], lo = SIM.skBands[SIM.skBands.length - 1];
  for (const v of ["0–100", String(hi[0]), vn(hi[1]), vn(lo[1]), String(SIM.collapseSK), String(SIM.collapseHold), String(SIM.skDrift)]) assert.ok(g.includes(v), v + " ∉ " + g);
});
t("Phá Thế: nói thanh vàng, Vỡ Thế (thời gian, sát thương nhận thêm), và tách khỏi Phá Trận / Phá khiên", () => {
  const g = GLOSS.phaThe.long;
  for (const v of [vn(BROKEN_SEC), `${Math.round((BROKEN_MULT - 1) * 100)}%`, "Phá Trận", "Phá khiên"]) assert.ok(g.includes(v), v + " ∉ " + g);
});
t("Đòn viền đỏ: nói vòng lớn dần cho đầy, cửa sổ phản đòn, khóa hụt và luật tiến độ chiếm về 0", () => {
  const g = GLOSS.doDo.long;
  for (const v of [vn(DEFENSE.redTelegraph), vn(DEFENSE.parryWindow), vn(DEFENSE.counterLockout)]) assert.ok(g.includes(v), v + " ∉ " + g);
  assert.match(g, /đầy/); assert.match(g, /về 0/);
});
t("Cung kỵ (đợt 12a): câu dài và câu ngắn lấy tầm bắn, ngưỡng lùi từ tuning; dạy Né rồi chém / Phá Trận; nằm trong thẻ Trong trận", () => {
  const g = GLOSS.cungKy, back = KITS.NG_KY.range * AI.kite;
  for (const v of [String(KITS.NG_KY.range), String(back), "Né", "Phá Trận"]) assert.ok(g.long.includes(v), v + " ∉ " + g.long);
  for (const v of [String(back), "{dodge}", "{skill}", "lao tới"]) assert.ok(g.short.includes(v), v + " ∉ " + g.short);
  assert.ok(!/{/.test(g.long), "câu dài không có {token} phím");
  assert.ok(CONCEPT_ORDER.includes("cungKy"));
});
t("Cửa ngõ (đợt 12c): nói doanh trại là nguồn viện binh, vệt đỏ trên bản đồ nhỏ, chiếm / vỡ trận thì đóng; có thẻ Trong trận và gợi ý lần đầu", () => {
  const g = GLOSS.cuaNgo;
  for (const v of ["Doanh trại", "viện binh", "bản đồ nhỏ"]) assert.ok(g.long.includes(v), v + " ∉ long");
  assert.match(g.long, /vỡ trận/); assert.match(g.long, /đóng cửa ngõ/);
  assert.ok(g.short.includes("cửa ngõ") && g.short.includes("viện binh") && !/{[^}]*}/.test(g.short.replace(/{[a-z:A-Z]+}/g, "")));
  assert.ok(CONCEPT_ORDER.includes("cuaNgo"));
  const H = createHints({ seen: {} }); assert.equal(H.offer("cuaNgo", {}, 0), true);
  const h = H.next(0); assert.equal(h.id, "cuaNgo"); assert.equal(h.text, GLOSS.cuaNgo.short);
});
t("thẻ 'Trong trận' của bảng đòn lấy thẳng từ GLOSS (một nguồn)", () => {
  const html = movesGuideHTML({ dev: 0 });
  for (const id of CONCEPT_ORDER) { assert.ok(html.includes(GLOSS[id].name), GLOSS[id].name); assert.ok(html.includes(GLOSS[id].long), id); }
  assert.ok(!movesGuideHTML({ dev: 0, compact: true }).includes(GLOSS.siKhi.long), "bảng gọn trong tạm dừng không kèm thẻ khái niệm");
});

console.log("\nTên đòn và nhãn không đụng độ");
t("C1 không còn tên 'Phá thế' (dễ lẫn thanh Phá Thế); 'Phá Trận' chỉ là kỹ năng E của H35", () => {
  const nm = (info) => Object.entries(info).map(([k, v]) => [k, v.name]);
  for (const info of [MOVE_INFO, MOVE_INFO_WC01]) for (const [k, n] of nm(info)) assert.ok(!/^phá thế$/i.test(n), `${k}: ${n}`);
  assert.equal(MOVE_INFO.C1.name, "Phá khiên");
  assert.deepEqual(nm(MOVE_INFO).filter(([, n]) => n === "Phá Trận").map(([k]) => k), ["skill"]);
  assert.ok(!/phá thế/i.test(MOVE_INFO_WC01.C1.text), MOVE_INFO_WC01.C1.text);
});
t("ô C trên HUD mặc định gọi theo tên đòn (C1 Phá khiên), không gõ tay", () => {
  const html = skillBarHTML(true);
  assert.ok(html.includes("C1 Phá khiên") && !/Phá thế/.test(html), html.slice(0, 300));
});
t("bảng mặt trận ghi 'Sĩ Khí 61|39' thay cho 'SK 61|39' trần", () => {
  const f = { q: { ta: [60, 40], dich: [70] }, sk: { ta: 61.4, dich: 38.6 }, order: null, general: { alive: true } };
  const row = frontRowHTML({ id: "A" }, f, { heroFront: "A" });
  assert.match(row, /Sĩ Khí 61\|39/); assert.ok(!/>SK /.test(row), row);
  assert.match(row, /class="front here"/);
  assert.match(frontRowHTML({ id: "B" }, f, { heroFront: "A" }), /class="front"/);
});

console.log("\nBộ gợi ý lần đầu");
t("mỗi gợi ý hiện đúng một lần; cờ ghi thẳng vào đối tượng seen (chính là save.hints); id lạ bị bỏ", () => {
  const seen = {}, H = createHints({ seen });
  assert.equal(H.offer("khongCo", {}, 0), false);
  assert.equal(H.offer("guongDay", { n: 1 }, 0), true);
  assert.equal(H.offer("guongDay", { n: 1 }, 0), false);                 // đã xếp hàng, không xếp đôi
  const a = H.next(0); assert.equal(a.id, "guongDay"); assert.match(a.text, /Gượng dậy/); assert.ok(a.T > 0);
  assert.equal(seen.guongDay, true);
  assert.equal(H.offer("guongDay", { n: 1 }, 20), false);                // đã xem
  assert.equal(H.next(20), null);
});
t("hai gợi ý cách nhau ít nhất gap giây; cái ưu tiên cao hiện trước", () => {
  const H = createHints({ seen: {} });
  H.offer("siKhi", {}, 0); H.offer("guongDay", { n: 1 }, 0);
  assert.equal(H.next(0).id, "guongDay");
  assert.equal(H.next(5), null);
  assert.equal(H.next(9.1).id, "siKhi");
});
t("gợi ý chờ quá ttl thì bỏ mà chưa tính là đã xem; điều kiện còn thì được xếp lại", () => {
  const seen = {}, H = createHints({ seen });
  H.offer("siKhi", {}, 0); assert.equal(H.next(0).id, "siKhi");
  H.offer("guongDay", { n: 1 }, 1);
  assert.equal(H.next(8), null);
  assert.equal(seen.guongDay, undefined);
  assert.equal(H.offer("guongDay", { n: 1 }, 8.5), true);
  assert.equal(H.next(9.2).id, "guongDay");
});
t("tắt gợi ý: không xếp hàng, không đánh dấu đã xem; bật lại thì xếp được", () => {
  let on = false; const seen = {}, H = createHints({ seen, enabled: () => on });
  assert.equal(H.offer("siKhi", {}, 0), false); assert.equal(H.next(0), null); assert.deepEqual(seen, {});
  on = true; assert.equal(H.offer("siKhi", {}, 1), true);
});
t("siKhiThap đánh dấu luôn siKhi đã xem (đã giải thích Sĩ Khí rồi); onSeen gọi mỗi lần hiện để lưu save", () => {
  let saved = 0; const seen = {}, H = createHints({ seen, onSeen: () => saved++ });
  H.offer("siKhiThap", { id: "B", n: 22 }, 0);
  const h = H.next(0);
  assert.match(h.text, /cánh B/); assert.match(h.text, /22/);
  assert.equal(seen.siKhi, true); assert.equal(seen.siKhiThap, true); assert.equal(saved, 1);
  assert.equal(H.offer("siKhi", {}, 30), false);
});

console.log("\nKhi nào đến hạn");
const base = () => ({
  t: 10, battle: "B15",
  hero: { id: "H35", alive: true, hpFrac: 1, revives: 1, revive: { hp: 0.5, invuln: 3 }, charge: false, sk1: "phaTran", sk2: null, ready1: true, ready2: false },
  used: { skill: false, skill2: false }, pressed: {}, fronts: [{ id: "A", ta: 50, dich: 50 }, { id: "B", ta: 50, dich: 50 }],
  target: null, redRing: false, officerNear: false,
});
const mod = (o = {}) => { const s = base(); for (const k of Object.keys(o)) s[k] = k === "hero" ? { ...s.hero, ...o.hero } : o[k]; return s; };
const h31 = (o = {}) => mod({ battle: "B20", fronts: null, ...o, hero: { id: "H31", charge: true, sk1: "hichTuongSi", sk2: "binhThu", ready1: true, ready2: true, ...(o.hero || {}) } });
const ids = (s) => hintsDue(s).map((x) => x.id).sort();
t("ảnh chụp bình thường thì chưa gợi ý nào", () => assert.deepEqual(ids(base()), []));
t("guongDay: Sinh lực dưới 35% mà còn lượt; hết lượt, đã gục hoặc còn khỏe thì không", () => {
  assert.deepEqual(ids(mod({ hero: { hpFrac: 0.3 } })), ["guongDay"]);
  assert.deepEqual(ids(mod({ hero: { hpFrac: 0.3, revives: 0 } })), []);
  assert.deepEqual(ids(mod({ hero: { hpFrac: 0.3, alive: false } })), []);
  assert.deepEqual(ids(mod({ hero: { hpFrac: 0.5 } })), []);
  const d = hintsDue(mod({ hero: { hpFrac: 0.3, revives: 2 } }))[0];
  assert.equal(d.info.n, 2); assert.equal(d.info.hp, 0.5); assert.equal(d.info.invuln, 3);
});
t("doDo: vòng đỏ gần tướng; phaThe: mục tiêu HUD có thanh Phá Thế (lính thì không)", () => {
  assert.deepEqual(ids(mod({ redRing: true })), ["doDo"]);
  assert.deepEqual(ids(mod({ target: { poiseMax: 100 } })), ["phaThe"]);
  assert.deepEqual(ids(mod({ target: { poiseMax: 0 } })), []);
});
t("siKhi: một cánh lệch từ 10 điểm khỏi 50 (ta hoặc địch), hoặc sau 40 s; B20 (HUD không hiện Sĩ Khí) thì không bao giờ", () => {
  assert.deepEqual(ids(mod({ fronts: [{ id: "A", ta: 61, dich: 50 }, { id: "B", ta: 50, dich: 50 }] })), ["siKhi"]);
  assert.deepEqual(ids(mod({ fronts: [{ id: "A", ta: 50, dich: 38 }] })), ["siKhi"]);
  assert.deepEqual(ids(mod({ fronts: [{ id: "A", ta: 55, dich: 45 }] })), []);
  assert.deepEqual(ids(mod({ t: 41 })), ["siKhi"]); assert.deepEqual(ids(mod({ t: 39 })), []);
  assert.deepEqual(ids(mod({ t: 99, fronts: null, battle: "B20" })), []);
});
t("siKhiThap: Sĩ Khí cánh TA dưới 25 (không tính cánh địch), nêu cánh thấp nhất", () => {
  const d = hintsDue(mod({ fronts: [{ id: "A", ta: 40, dich: 10 }, { id: "B", ta: 22, dich: 50 }] })).find((x) => x.id === "siKhiThap");
  assert.deepEqual(d.info, { id: "B", n: 22 });
  assert.ok(!hintsDue(mod({ fronts: [{ id: "A", ta: 40, dich: 10 }] })).some((x) => x.id === "siKhiThap"));
  assert.ok(!hintsDue(mod({ fronts: [{ id: "A", ta: 25, dich: 50 }] })).some((x) => x.id === "siKhiThap"));
});
t("kyLui (đợt 12a): cung kỵ lùi giữ tầm kéo dài từ 3 s mới nhắc; ngắn hơn hoặc ảnh chụp cũ không có kiteT thì im", () => {
  assert.deepEqual(ids(mod({ kiteT: 3 })), ["kyLui"]);
  assert.deepEqual(ids(mod({ kiteT: 2.9 })), []);
  assert.deepEqual(ids(mod({ kiteT: 0 })), []);
  assert.deepEqual(ids(base()), []);
});
t("tuLuc: lần đầu bấm C bằng tướng có tụ lực (đại kiếm); H35 hoặc không bấm thì không", () => {
  assert.deepEqual(ids(h31({ pressed: { c: true } })), ["tuLuc"]);
  assert.deepEqual(ids(mod({ pressed: { c: true } })), []);
  assert.deepEqual(ids(h31({ pressed: {} })), []);
});
t("hich: H31 sau 30 s mà E sẵn sàng và chưa dùng; dùng rồi, chưa tới 30 s hoặc đang hồi thì không", () => {
  assert.deepEqual(ids(h31({ t: 31 })), ["hich"]);
  assert.deepEqual(ids(h31({ t: 20 })), []);
  assert.deepEqual(ids(h31({ t: 31, used: { skill: true, skill2: false } })), []);
  assert.deepEqual(ids(h31({ t: 31, hero: { ready1: false } })), []);
  assert.deepEqual(ids(mod({ t: 99 })).includes("hich"), false);
});
t("binhThu: H31 có sĩ quan gần, T sẵn sàng và chưa dùng T", () => {
  assert.deepEqual(ids(h31({ officerNear: true })), ["binhThu"]);
  assert.deepEqual(ids(h31({ officerNear: false })), []);
  assert.deepEqual(ids(h31({ officerNear: true, used: { skill: false, skill2: true } })), []);
  assert.deepEqual(ids(h31({ officerNear: true, hero: { ready2: false } })), []);
});

console.log("\nChữ gợi ý");
t("gợi ý lấy số từ tuning, kỹ năng, lớp vũ khí — không gõ tay", () => {
  const g = HINTS.guongDay.text({ n: 1, hp: HERO.revive.hp, invuln: HERO.revive.invuln });
  for (const v of [`${Math.round(HERO.revive.hp * 100)}%`, `${HERO.revive.invuln} s`, String(-HAO_KHI.src.reviveUsed), "1 lần"]) assert.ok(g.includes(v), v + " ∉ " + g);
  const s = HINTS.siKhi.text({});
  for (const v of ["80", "1,2", "0,7", String(SIM.collapseSK), String(SIM.collapseHold)]) assert.ok(s.includes(v), v + " ∉ " + s);
  assert.ok(HINTS.phaThe.text({}).includes(vn(BROKEN_SEC)));
  const tl = HINTS.tuLuc.text({}), ch = WEAPON_CLASSES.WC01.traits.charge;
  for (const v of [...ch.levels.map(vn), ...ch.mult.slice(1).map(vn)]) assert.ok(tl.includes(v), v + " ∉ " + tl);
  const hi = HINTS.hich.text({}), H = SKILLS.hichTuongSi;
  for (const v of [`${H.channel} s`, String(H.siKhi), `${Math.round(H.allyAtk * 100)}%`, `${H.dur} s`]) assert.ok(hi.includes(v), v + " ∉ " + hi);
  const bt = HINTS.binhThu.text({}), B = SKILLS.binhThu;
  for (const v of [`${Math.round(B.dmgPct * 100)}%`, `${B.mark} s`]) assert.ok(bt.includes(v), v + " ∉ " + bt);
});
t("mọi chữ gợi ý dùng token phím hợp lệ: đổi theo cả ba thiết bị không còn { }", () => {
  const sample = { n: 1, hp: 0.5, invuln: 3, id: "B" };
  for (const id of Object.keys(HINTS)) for (const dev of [0, 1, 2]) {
    const s = fmtKeys(HINTS[id].text(sample), dev);
    assert.ok(s.length > 20 && !/[{}]|undefined|NaN/.test(s), id + "/" + dev + ": " + s);
  }
});
t("gợi ý ghi đúng phím của từng thiết bị (bàn phím / cảm ứng / tay cầm)", () => {
  const p = HINTS.phaThe.text({});
  assert.match(fmtKeys(p, 0), /K hoặc chuột phải/); assert.match(fmtKeys(p, 1), /nút C/); assert.match(fmtKeys(p, 2), /\bY\b/);
  assert.match(fmtKeys(HINTS.hich.text({}), 0), /\bE\b/); assert.match(fmtKeys(HINTS.binhThu.text({}), 0), /\bT\b/);
  assert.match(fmtKeys(HINTS.siKhiThap.text({ id: "B", n: 20 }), 0), /Tab/);
});
t("mọi gợi ý có độ ưu tiên, thời gian hiện và hạn chờ hợp lệ", () => {
  for (const [id, h] of Object.entries(HINTS)) { assert.ok(h.prio > 0 && h.T >= 5 && h.ttl > 0, id); assert.equal(typeof h.text, "function", id); }
});

console.log("\nBộ gợi ý gắn vào vòng lặp trận (ctx giả)");
function fakeCtx(o = {}) {
  const log = [];
  const ctx = {
    battle: { id: o.battle || "B15" },
    hero: { id: "H35", alive: true, hp: 100, maxHp: 100, revives: 1, x: 0, z: 0, lock: null, chargeTrait: null,
      def: { revive: { hp: 0.5, invuln: 3 }, skills: { sk1: "phaTran" } }, skillReady: () => true, ...(o.hero || {}) },
    units: o.units || [], fx: { teles: o.teles || [] },
    sim: { fronts: o.fronts ?? { A: { sk: { ta: 50, dich: 50 } }, B: { sk: { ta: 50, dich: 50 } } } },
    hud: { nearestOfficer: () => o.target ?? null },
    director: { over: false, say: (text, T, kind) => log.push({ text, T, kind }) },
  };
  return { ctx, log };
}
const run = (dr, sec, inp = { pressed: {} }) => { for (let i = 0; i < Math.round(sec / 0.1); i++) dr.update(0.1, inp); };
t("Sinh lực tụt dưới 35%: sau một nhịp có đúng một dòng 'tip' về Gượng dậy, lưu cờ, rồi không lặp", () => {
  const { ctx, log } = fakeCtx(); const seen = {}; let saved = 0;
  const dr = createHintDriver(ctx, { seen, enabled: () => true, onSeen: () => saved++ });
  run(dr, 2); assert.equal(log.length, 0);
  ctx.hero.hp = 30; run(dr, 2);
  assert.equal(log.length, 1); assert.equal(log[0].kind, "tip"); assert.match(log[0].text, /Gượng dậy/);
  assert.equal(seen.guongDay, true); assert.equal(saved, 1);
  run(dr, 20); assert.equal(log.filter((x) => /Gượng dậy/.test(x.text)).length, 1);
});
t("sự kiện chiemNgat (đòn đỏ trúng lúc đang chiếm) hiện ngay một dòng nói tiến độ về 0", () => {
  const { ctx, log } = fakeCtx(); const dr = createHintDriver(ctx, { seen: {}, enabled: () => true });
  dr.event("chiemNgat"); dr.update(0.1, { pressed: {} });
  assert.equal(log.length, 1); assert.match(log[0].text, /tiến độ chiếm/); assert.match(log[0].text, /về 0/);
});
t("vòng đỏ ở gần tướng → gợi ý doDo; vòng đỏ xa thì không; Tuyệt Kỹ (big) không tính", () => {
  const near = { unit: { x: 3, z: 0, alive: true, dead: false }, big: false }, far = { unit: { x: 60, z: 0, alive: true, dead: false }, big: false }, ult = { unit: { x: 3, z: 0, alive: true, dead: false }, big: true };
  let c = fakeCtx({ teles: [far, ult] }), dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true }); run(dr, 3); assert.equal(c.log.length, 0);
  c = fakeCtx({ teles: [near] }); dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true }); run(dr, 1);
  assert.equal(c.log.length, 1); assert.match(c.log[0].text, /Vòng đỏ/);
});
const rider = (o = {}) => ({ side: "dich", alive: true, state: "move", role: "zone", K: { mounted: true, ranged: true }, kiting: true, x: 8, z: 0, ...o });
const withCrowd = (c, agents) => { c.ctx.crowd = { agents, hittable: (a) => a.alive && a.state !== "dead" && a.role !== "actor" }; return c; };
t("cung kỵ thật lùi giữ tầm gần tướng liên tục 3 s → một dòng 'tip' dạy Né / Phá Trận, rồi không lặp", () => {
  const c = withCrowd(fakeCtx(), [rider()]), seen = {}, dr = createHintDriver(c.ctx, { seen, enabled: () => true });
  run(dr, 2); assert.equal(c.log.length, 0);
  run(dr, 2); assert.equal(c.log.length, 1); assert.equal(c.log[0].kind, "tip"); assert.match(c.log[0].text, /Cung kỵ/); assert.match(c.log[0].text, /{dodge}/);
  assert.equal(seen.kyLui, true); run(dr, 30); assert.equal(c.log.length, 1);
});
t("tắt gợi ý rồi bật lại giữa trận: đồng hồ lùi giữ tầm tính lại từ 0 (không nhắc ngay vì dồn thời gian lúc tắt)", () => {
  const c = withCrowd(fakeCtx(), [rider()]); let on = false;
  const dr = createHintDriver(c.ctx, { seen: {}, enabled: () => on });
  run(dr, 20); on = true; run(dr, 1.5); assert.equal(c.log.length, 0, "mới bật 1,5 s");
  run(dr, 2); assert.equal(c.log.length, 1);
});
t("cung kỵ lùi bị ngắt quãng (hết lùi, xa tướng, lính diễn, bộ binh) thì đồng hồ về 0, không nhắc", () => {
  const a = rider(), c = withCrowd(fakeCtx(), [a]), dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true });
  run(dr, 2); a.kiting = false; run(dr, 1); a.kiting = true; run(dr, 2); assert.equal(c.log.length, 0, "đứt quãng làm lại từ đầu");
  for (const [mod2, why] of [[{ x: 30 }, "xa tướng"], [{ role: "actor" }, "lính diễn không trúng đòn"], [{ K: { mounted: false, ranged: true } }, "cung thủ bộ"], [{ side: "ta" }, "quân ta"]]) {
    const c2 = withCrowd(fakeCtx(), [rider(mod2)]), d2 = createHintDriver(c2.ctx, { seen: {}, enabled: () => true }); run(d2, 8);
    assert.equal(c2.log.length, 0, why);
  }
});
t("sĩ quan có thanh Phá Thế hiện trong khung mục tiêu → phaThe; lính (không thanh) thì im", () => {
  let c = fakeCtx({ target: { poiseMax: 0 } }), dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true }); run(dr, 2); assert.equal(c.log.length, 0);
  c = fakeCtx({ target: { poiseMax: 120 } }); dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true }); run(dr, 1);
  assert.equal(c.log.length, 1); assert.match(c.log[0].text, /Phá Thế/);
});
t("B15: Sĩ Khí cánh ta xuống dưới 25 → cảnh báo, và siKhi không nhắc lại sau đó", () => {
  const { ctx, log } = fakeCtx({ fronts: { A: { sk: { ta: 50, dich: 50 } }, B: { sk: { ta: 22, dich: 50 } } } }); const seen = {};
  const dr = createHintDriver(ctx, { seen, enabled: () => true }); run(dr, 30);
  assert.equal(log.length, 1); assert.match(log[0].text, /cánh B/); assert.equal(seen.siKhi, true);
});
t("B20 (không hiện Sĩ Khí): im về Sĩ Khí dù số có thấp, kể cả sau 60 s", () => {
  const { ctx, log } = fakeCtx({ battle: "B20", fronts: { A: { sk: { ta: 5, dich: 90 } } } }); const dr = createHintDriver(ctx, { seen: {}, enabled: () => true });
  run(dr, 60); assert.equal(log.length, 0);
});
t("đại kiếm bấm C lần đầu → gợi ý tụ lực ngay (cạnh bấm không bị bỏ lỡ); H35 bấm C thì im", () => {
  const h = { id: "H31", chargeTrait: { levels: [0.4, 0.8] }, def: { revive: { hp: 0.5, invuln: 3 }, skills: { sk1: "hichTuongSi", sk2: "binhThu" } } };
  let c = fakeCtx({ battle: "B20", hero: h }), dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true });
  dr.update(0.016, { pressed: { c: true } });
  assert.equal(c.log.length, 1); assert.match(c.log[0].text, /tụ lực/);
  c = fakeCtx({ battle: "B20" }); dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true }); dr.update(0.016, { pressed: { c: true } });
  assert.equal(c.log.length, 0);
});
t("H31: sau 30 s chưa bấm E → nhắc Hịch; bấm E trước đó thì không nhắc", () => {
  const h = { id: "H31", chargeTrait: { levels: [0.4, 0.8] }, def: { revive: { hp: 0.5, invuln: 3 }, skills: { sk1: "hichTuongSi", sk2: "binhThu" } } };
  let c = fakeCtx({ battle: "B20", hero: h }), dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true }); run(dr, 29); assert.equal(c.log.length, 0);
  run(dr, 3); assert.equal(c.log.length, 1); assert.match(c.log[0].text, /Hịch Tướng Sĩ/);
  c = fakeCtx({ battle: "B20", hero: h }); dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true });
  dr.update(0.1, { pressed: { skill: true } }); run(dr, 40); assert.equal(c.log.filter((x) => /Hịch/.test(x.text)).length, 0);
});
t("tắt gợi ý hoặc trận đã hết: im lặng, không đánh dấu đã xem", () => {
  let c = fakeCtx(); c.ctx.hero.hp = 20; const seen = {};
  let dr = createHintDriver(c.ctx, { seen, enabled: () => false }); run(dr, 5); dr.event("chiemNgat"); run(dr, 1);
  assert.equal(c.log.length, 0); assert.deepEqual(seen, {});
  c = fakeCtx(); c.ctx.hero.hp = 20; c.ctx.director.over = true; dr = createHintDriver(c.ctx, { seen: {}, enabled: () => true }); run(dr, 5);
  assert.equal(c.log.length, 0);
});
t("bật / tắt giữa trận có hiệu lực ngay (đọc enabled mỗi lần)", () => {
  const { ctx, log } = fakeCtx(); ctx.hero.hp = 20; let on = false; const dr = createHintDriver(ctx, { seen: {}, enabled: () => on });
  run(dr, 3); assert.equal(log.length, 0); on = true; run(dr, 3); assert.equal(log.length, 1);
});

t("tắt rồi bật lại: đồng hồ gợi ý vẫn chạy lúc tắt (không bắt chờ thêm giãn cách); đã bấm E lúc tắt thì không nhắc Hịch", () => {
  const { ctx, log } = fakeCtx(); ctx.hero.hp = 20; let on = true; const dr = createHintDriver(ctx, { seen: {}, enabled: () => on });
  run(dr, 1); assert.equal(log.length, 1);                                  // Gượng dậy hiện lúc ~0,3 s
  on = false; run(dr, 12); on = true;                                       // tắt 12 s: giãn cách 9 s đã trôi qua
  dr.event("chiemNgat"); run(dr, 0.5);
  assert.ok(log.some((x) => /tiến độ chiếm/.test(x.text)), JSON.stringify(log.map((x) => x.text.slice(0, 24))));
  const h = { id: "H31", chargeTrait: { levels: [0.4, 0.8] }, def: { revive: { hp: 0.5, invuln: 3 }, skills: { sk1: "hichTuongSi", sk2: "binhThu" } } };
  const c2 = fakeCtx({ battle: "B20", hero: h }); let on2 = false; const d2 = createHintDriver(c2.ctx, { seen: {}, enabled: () => on2 });
  d2.update(0.1, { pressed: { skill: true } }); run(d2, 40); on2 = true; run(d2, 3);
  assert.equal(c2.log.filter((x) => /Hịch/.test(x.text)).length, 0);
});

console.log("\nBản lưu");
t("newSave có hints rỗng và settings.hints bật; migrate bản lưu cũ thêm hints, giữ cờ đã có, không dùng chung đối tượng", () => {
  const s = P.newSave(); assert.deepEqual(s.hints, {}); assert.equal(s.settings.hints, true);
  const old = { v: 1, hero: { level: 3 }, settings: { touch: "off" } };
  const m = P.migrate(old); assert.deepEqual(m.hints, {}); assert.equal(m.settings.hints, true); assert.equal(m.settings.touch, "off");
  const raw = { ...old, hints: { siKhi: true } }, m2 = P.migrate(raw);
  assert.deepEqual(m2.hints, { siKhi: true }); assert.notEqual(m2.hints, raw.hints);
  assert.equal(P.migrate({ ...old, settings: { hints: false } }).settings.hints, false);
});

console.log("\n" + pass + " đạt, " + fail + " trượt");
process.exit(fail ? 1 : 0);
