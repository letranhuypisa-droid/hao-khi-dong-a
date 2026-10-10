// tests/voice.test.mjs — lồng tiếng (đợt 16): dữ liệu lời thoại khớp tệp trên đĩa và khớp chiêu / tướng của game; động cơ battle/voice.js
// (ưu tiên, thời gian chờ, mỗi tướng địch một lần, hạ nhạc / hiệu ứng kể cả với Music thật, tắt tiếng, dispose, không động vào Math.random của mô phỏng).
//   node game/tests/voice.test.mjs
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { VOICE_CAST, VOICE_LINES, VOICE_BY_ID, voiceLinesFor } from "../js/data/voice.js";
import { HEROES, SKILLS } from "../js/data/heroes.js";
import { Voice } from "../js/battle/voice.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 4).join("\n       ")); }
}
const root = fileURLToPath(new URL("../", import.meta.url));
const LABELS = ["Chính sử", "Tương truyền", "Hư cấu"];

console.log("Dữ liệu lời thoại (data/voice.js)");
t("mỗi dòng có tệp assets/voice/<id>.m4a, id không trùng, người nói có trong dàn giọng", () => {
  const seen = new Set();
  for (const l of VOICE_LINES) {
    assert.ok(!seen.has(l.id), "trùng " + l.id); seen.add(l.id);
    assert.ok(existsSync(root + `assets/voice/${l.id}.m4a`), "thiếu tệp " + l.id);
    assert.ok(VOICE_CAST[l.who]?.tts?.startsWith("elevenlabs_"), "chưa có giọng cho " + l.who);
    assert.ok(l.id.startsWith(l.who + "-" + l.on + "-"), "id không theo quy ước người-chiêu-số: " + l.id);
  }
  assert.equal(VOICE_LINES.length, Object.keys(VOICE_BY_ID).length);
});
t("tổng dung lượng giọng ≤ 1 MB (ngân sách tải đợt đầu, design/systems.md §13.3), mỗi tệp ≤ 40 KB", () => {
  let total = 0;
  for (const l of VOICE_LINES) { const b = statSync(root + `assets/voice/${l.id}.m4a`).size; assert.ok(b <= 40 * 1024, `${l.id} ${b} B`); total += b; }
  assert.ok(total <= 1024 * 1024, total + " B");
});
t("mọi dòng có nhãn Chính sử / Tương truyền / Hư cấu; chỉ hai câu có nguồn là Chính sử", () => {
  for (const l of VOICE_LINES) assert.ok(LABELS.includes(l.label), l.id);
  assert.deepEqual(VOICE_LINES.filter((l) => l.label === "Chính sử").map((l) => l.id).sort(), ["H31-hichTuongSi-1", "H35-bopNat-1"]);
});
t("tướng ta nói tiếng Việt (không có zh); tướng địch nói tiếng Trung (zh là chữ Hán) kèm phụ đề Việt", () => {
  for (const l of VOICE_LINES) {
    if (VOICE_CAST[l.who].lang === "zh") { assert.match(l.zh, /^[一-鿿，。？！、…]+$/, l.id); assert.ok(l.text.length > 3, l.id); }
    else assert.equal(l.zh, undefined, l.id);
  }
});
t("lời của tướng ta ứng với chiêu có thật của đúng tướng đó; mỗi chiêu ≥ 2 dòng", () => {
  for (const [hid, H] of Object.entries(HEROES)) {
    if (!VOICE_CAST[hid]) continue;
    const ids = [H.skills.sk1, H.skills.sk2, H.skills.ult].filter(Boolean);
    for (const l of VOICE_LINES.filter((x) => x.who === hid)) assert.ok(ids.includes(l.on) && SKILLS[l.on], `${l.id}: ${hid} không có chiêu ${l.on}`);
  }
  for (const [hid, ons] of Object.entries({ H35: ["phaTran", "bopNat"], H40: ["tenXuyenHang", "chanDong", "mocTen"], H31: ["hichTuongSi", "binhThu", "bachDang"] }))
    for (const on of ons) assert.ok(voiceLinesFor(hid, on).length >= 2, hid + " " + on);
});
t("tướng địch: Toa Đô B15 + B17, Ô Mã Nhi B17 + B20, Phàn Tiếp B20, Thoát Hoan B16", () => {
  const key = (w, o) => voiceLinesFor(w, o).length;
  for (const [w, o] of [["X19", "b15"], ["X19", "b17"], ["X20", "b17"], ["X20", "b20"], ["X24", "b20"], ["X18", "b16"]]) assert.ok(key(w, o) >= 1, w + " " + o);
});
t("chữ không có cảnh chém đầu, \"thủ cấp\", tiếng lóng miệt thị (cùng luật b17 / b20-content)", () => {
  const BAD = /thủ cấp|chém đầu|bêu đầu|đầu lâu|\bthát\b|sát thát/i;
  for (const l of VOICE_LINES) assert.ok(!BAD.test(l.text), l.id);
});
t("không hard-code tên phím (key-strings): chữ không có \"(R)\", \"bấm F\"…", () => {
  for (const l of VOICE_LINES) assert.ok(!/\([A-Z]\)|bấm [A-Z]\b/.test(l.text), l.id);
});

console.log("\nĐộng cơ giọng (battle/voice.js)");
// Audio giả: ctx chạy, nguồn phát giả ghi lại (log.srcs) và kết thúc bằng end() như src.onended của trình duyệt; duck ghi mức
function fake({ state = "running", music = null } = {}) {
  const log = { started: [], duck: [], stopped: [], subs: [], musicDuck: [], srcs: [] };
  const node = () => ({ connect(n) { return n || this; }, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, pan: { value: 0 } });
  const ctx = { state, currentTime: 0,
    createBufferSource() { const n = node(); n.start = () => { log.started.push(n.buffer); log.srcs.push(n); }; n.stop = () => log.stopped.push(n.buffer); return n; },
    createGain: node, createStereoPanner: node };
  const audio = { ctx, voiceBus: node(), master: node(), listener: { x: 0, z: 0, yaw: 0 }, vol: 0.9,
    setVoiceVolume(v) { this.vv = v; }, duck(l) { log.duck.push(l); } };
  music ||= { duck(f) { log.musicDuck.push(f); } };
  const v = new Voice(audio, { music, say: (text, T, kind) => log.subs.push({ text, T, kind }), volume: 0.9 });
  for (const l of VOICE_LINES) v.ready.set(l.id, { duration: 2, _id: l.id });
  const end = () => log.srcs.at(-1)?.onended?.();                  // lời phát hết theo giờ âm thanh
  return { v, log, ctx, audio, end };
}
const orig = Math.random;
const noRandom = () => { Math.random = () => { throw new Error("Voice không được gọi Math.random"); }; };
const restore = () => { Math.random = orig; };

t("tướng ta tung chiêu: phát đúng dòng của chiêu, hạ nhạc + hiệu ứng, phụ đề có nhãn và tên", () => {
  const { v, log } = fake(); noRandom();
  try {
    assert.equal(v.skill("H35", "phaTran"), true);
    assert.equal(log.started.length, 1);
    assert.ok(VOICE_BY_ID[log.started[0]._id].on === "phaTran");
    assert.deepEqual(log.duck, [0.5]); assert.deepEqual(log.musicDuck, [0.45]);
    assert.match(log.subs[0].text, /Trần Quốc Toản/); assert.match(log.subs[0].text, /label hc/); assert.equal(log.subs[0].kind, "info");
  } finally { restore(); }
});
t("lời chiêu thường có thời gian chờ 3,2 s; xoay vòng qua các dòng (không ngẫu nhiên); Tuyệt Kỹ không bị chờ chặn", () => {
  const { v, log, end } = fake();
  assert.equal(v.skill("H35", "phaTran"), true);
  end(); assert.equal(v.cur, null);                              // hết lời
  v.update(1); assert.equal(v.skill("H35", "phaTran"), false);   // còn trong 3,2 s chờ
  v.update(3); assert.equal(v.skill("H35", "phaTran"), true); end();
  v.update(5); assert.equal(v.skill("H35", "phaTran"), true); end();
  assert.deepEqual(log.started.map((b) => b._id), ["H35-phaTran-1", "H35-phaTran-2", "H35-phaTran-3"]);
  assert.equal(v.skill("H35", "bopNat", true), true);             // vừa tung chiêu thường xong vẫn hô được Tuyệt Kỹ
});
t("dòng bị chặn (còn lời khác đang nói) không bị bỏ sót: lần sau vẫn là dòng chưa phát", () => {
  const { v, log, end } = fake();
  assert.equal(v.skill("H31", "bachDang", true), true);
  assert.equal(v.skill("H31", "binhThu"), false);                 // chặn bởi Tuyệt Kỹ đang nói
  end(); v.update(0);
  assert.equal(v.skill("H31", "binhThu"), true);
  assert.equal(log.started.at(-1)._id, "H31-binhThu-1");
});
t("Tuyệt Kỹ không bị chiêu thường cắt; lời giáp mặt cắt lời chiêu thường; hết lời thì thả nhạc và hiệu ứng", () => {
  const { v, log, end } = fake();
  assert.equal(v.skill("H31", "bachDang", true), true);
  assert.equal(v.skill("H31", "binhThu"), false);
  assert.equal(v.meet("X20", "b20"), false);                     // prio meet (2) < ult (3): không cắt
  end(); assert.equal(v.cur, null); assert.deepEqual(log.duck.at(-1), 1); assert.deepEqual(log.musicDuck.at(-1), 1);
  assert.equal(v.skill("H31", "binhThu"), true);
  assert.equal(v.meet("X20", "b20"), true);                      // cắt lời chiêu thường
  assert.equal(log.stopped.length, 1);
  assert.deepEqual(log.duck.slice(-2), [0.5, 0.5]);              // cắt để nói lời khác: không thả rồi hạ lại (nhạc không nhấp nhô)
});
t("lời bị cắt rồi kết thúc muộn (onended của nguồn cũ) không thả nhạc đang hạ cho lời mới", () => {
  const { v, log } = fake();
  v.skill("H31", "binhThu"); const first = log.srcs[0];
  v.meet("X20", "b20");                                          // cắt lời đầu
  first.onended?.();                                             // trình duyệt báo nguồn cũ đã dừng
  assert.notEqual(v.cur, null); assert.deepEqual(log.duck.at(-1), 0.5);
});
t("tướng địch giáp mặt: mỗi (tướng, chương) một lần mỗi trận; phụ đề ghi tiếng Trung + bản dịch, kiểu \"bad\"; không Math.random", () => {
  const { v, log, end } = fake(); noRandom();
  try {
    const u = { x: 30, z: 0 };
    assert.equal(v.meet("X19", "b15", u), true);
    end();
    assert.equal(v.meet("X19", "b15", u), false);
    assert.equal(v.meet("X19", "b17", u), true);                 // chương khác: nói lại
    assert.match(log.subs[0].text, /Toa Đô/); assert.match(log.subs[0].text, /tiếng Trung/); assert.equal(log.subs[0].kind, "bad");
    assert.equal(v.meet("X99", "b15"), false);                   // không có lời
  } finally { restore(); }
});
t("tắt giọng (âm lượng 0), ctx chưa chạy, dòng chưa giải mã: không phát, không phụ đề, không lỗi", () => {
  const a = fake(); a.v.setVolume(0);
  assert.equal(a.v.skill("H35", "bopNat", true), false); assert.equal(a.v.meet("X18", "b16"), false); assert.equal(a.log.subs.length, 0);
  assert.equal(a.audio.vv, 0);
  const b = fake({ state: "suspended" }); assert.equal(b.v.skill("H35", "bopNat", true), false);
  const c = fake(); c.v.ready.clear(); assert.equal(c.v.skill("H35", "bopNat", true), false); assert.equal(c.log.subs.length, 0);
  const d = new Voice(null); assert.equal(d.skill("H35", "bopNat"), false);   // không có Audio (thử nghiệm / Node)
});
t("rời trận khi đang nói: dispose() thả hiệu ứng và nhạc ra (không kẹt ở mức hạ)", () => {
  const { v, log } = fake();
  v.skill("H35", "bopNat", true); assert.deepEqual(log.duck.at(-1), 0.5);
  v.dispose();
  assert.deepEqual(log.duck.at(-1), 1); assert.deepEqual(log.musicDuck.at(-1), 1); assert.equal(v.cur, null); assert.equal(v.ready.size, 0);
});
t("chiêu không có lời (H34, Tự do…) và người lạ: bỏ qua im lặng", () => {
  const { v, log } = fake();
  assert.equal(v.skill("H34", "khoiThan"), false); assert.equal(v.skill(undefined, undefined), false); assert.equal(log.started.length, 0);
});
t("preload chỉ nạp lời của tướng ra trận và tướng địch của chương (chỉ định đúng id)", () => {
  const { v } = fake(); const asked = [];
  v.load = (id) => { asked.push(id); return Promise.resolve(null); };
  v.preload("H40", "B17");
  assert.deepEqual(asked.sort(), VOICE_LINES.filter((l) => l.who === "H40" || l.on === "b17").map((l) => l.id).sort());
  asked.length = 0; v.preload("H35", null);
  assert.deepEqual(asked.sort(), VOICE_LINES.filter((l) => l.who === "H35").map((l) => l.id).sort());
});

console.log("\nHạ nhạc với Music thật (core/music.js)");
// Music thật + <audio> giả (như music.test.mjs): hạ, thả, hạ lại liền nhau thì fade cũ bị huỷ, mức cuối đúng; bài mới vào theo mức đang hạ.
globalThis.window = { addEventListener() {} };
globalThis.Audio = class { constructor(src) { this.src = src; this.paused = true; this.volume = 1; this.loop = false; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } };
const { Music } = await import("../js/core/music.js");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ta(name, fn) { try { await fn(); pass++; console.log("  ok  " + name); } catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message).split("\n").slice(0, 4).join("\n       ")); } }
await ta("hạ nhạc, thả, hạ lại ngay (lời kế tiếp): mức cuối là mức đã hạ, không nhạc bật lại giữa lời", async () => {
  const m = new Music(0.5); m.play("battle", { fade: 0.05 }); await sleep(120);
  assert.ok(Math.abs(m.cur.volume - 0.5) < 0.01);
  m.duck(0.45, 0.15); await sleep(30);
  m.duck(1, 0.5);                                                // lời hết
  m.duck(0.45, 0.15);                                            // lời kế tiếp bắt đầu trong 0,5 s
  await sleep(700);
  assert.ok(Math.abs(m.cur.volume - 0.5 * 0.45) < 0.01, "volume " + m.cur.volume);
  m.duck(1, 0.2); await sleep(350);
  assert.ok(Math.abs(m.cur.volume - 0.5) < 0.01, "volume " + m.cur.volume);
});
await ta("bài mới (vd nhạc boss ở Tổng Phản Công) bắt đầu khi đang hạ thì vào theo mức đã hạ; setVolume giữ mức hạ", async () => {
  const m = new Music(0.5); m.play("battle", { fade: 0.05 }); await sleep(120);
  m.duck(0.45, 0.05); await sleep(120);
  m.play("boss", { fade: 0.1 }); await sleep(300);
  assert.ok(Math.abs(m.cur.volume - 0.5 * 0.45) < 0.01, "volume " + m.cur.volume);
  m.setVolume(0.8); assert.ok(Math.abs(m.cur.volume - 0.8 * 0.45) < 0.01);
  m.duck(1, 0.05); await sleep(150); assert.ok(Math.abs(m.cur.volume - 0.8) < 0.01);
});

console.log("\n" + pass + " đạt, " + fail + " trượt");
process.exit(fail ? 1 : 0);
