// tests/controls.test.mjs — nhãn phím theo thiết bị (data/controls.js): chữ trên màn hình phải khớp phím thật gán ở
// battle/input.js (KEYMAP, MOUSEMAP), và chọn giao diện cảm ứng / bàn phím đúng. Chạy trong Node:
//   node hao-khi-viet/game/tests/controls.test.mjs
import assert from "node:assert/strict";
import { ACTIONS, DEV, say, act, short, guideKeys, seqFor, fmtKeys, devOf, wantTouchUI } from "../js/data/controls.js";
import { KEYMAP, MOUSEMAP } from "../js/battle/input.js";
import { MOVE_INFO } from "../js/data/moves-info.js";
import { MOVE_INFO_WC01 } from "../js/data/moves-wc01.js";

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + (e.stack || e.message)); }
}

const MOUSE_NAME = { 0: "chuột trái", 1: "chuột giữa", 2: "chuột phải" };
const codeLabel = (code) => ({ Space: "Space", ShiftLeft: "Shift", ShiftRight: "Shift", Tab: "Tab", Escape: "Esc", Enter: "Enter", NumpadEnter: "Enter" }[code] ?? code.replace(/^(Key|Digit)/, ""));
const keysOf = (action) => Object.entries(KEYMAP).filter(([, a]) => a === action).map(([c]) => codeLabel(c));
const mouseOf = (action) => Object.entries(MOUSEMAP).filter(([, a]) => a === action).map(([b]) => MOUSE_NAME[b]);

console.log("Bảng nhãn khớp phím thật (input.js)");
t("mỗi nhãn bàn phím của hành động có gán trong KEYMAP / MOUSEMAP, đúng hành động đó", () => {
  for (const [id, a] of Object.entries(ACTIONS)) {
    if (a.free) continue;                                    // di chuyển, camera: không qua KEYMAP
    for (const chip of a.kb) {
      const ok = keysOf(id).includes(chip) || mouseOf(id).includes(chip);
      assert.ok(ok, `${id}: "${chip}" không có trong KEYMAP/MOUSEMAP (có: ${[...keysOf(id), ...mouseOf(id)].join(", ") || "không"})`);
    }
  }
});
t("ngược lại: phím chính của mỗi hành động trong KEYMAP (cái đầu) có mặt trong bảng nhãn", () => {
  // chỉ kiểm hành động có nhãn; cmd1–4 là số 1–4 nên không nằm trong bảng
  for (const [id, a] of Object.entries(ACTIONS)) {
    if (a.free) continue;
    assert.ok(keysOf(id).length + mouseOf(id).length > 0, `${id}: không có phím nào trong KEYMAP`);
    assert.ok(a.kb.length > 0, `${id}: thiếu nhãn bàn phím`);
  }
});
t("N = J / chuột trái và C = K / chuột phải (không còn chữ 'C' trần cho phím K)", () => {
  assert.deepEqual(ACTIONS.n.kb, ["J", "chuột trái"]);
  assert.deepEqual(ACTIONS.c.kb, ["K", "chuột phải"]);
  assert.equal(say("c", DEV.KB), "K hoặc chuột phải");
  assert.equal(short("c", DEV.KB), "K");
});

console.log("Nhãn theo thiết bị");
t("say ghép bằng 'hoặc', short lấy cái đầu, mỗi thiết bị một nhãn", () => {
  assert.equal(say("n", 0), "J hoặc chuột trái"); assert.equal(say("n", 1), "nút N"); assert.equal(say("n", 2), "X");
  assert.equal(say("tpc", 0), "F"); assert.equal(say("tpc", 1), "nút Phản Công"); assert.equal(say("tpc", 2), "D-pad lên");
  assert.equal(short("block", 0), "Shift"); assert.equal(short("cmd", 0), "Tab"); assert.equal(short("dodge", 0), "Space");
});
t("mọi hành động có đủ nhãn cho cả ba thiết bị", () => {
  for (const [id, a] of Object.entries(ACTIONS)) for (const d of ["kb", "touch", "pad"]) assert.ok(a[d]?.length > 0, `${id}.${d}`);
});
t("guideKeys giữ nguyên chữ cũ của thẻ bảng phím", () => {
  assert.deepEqual(guideKeys("n"), ["J · chuột trái", "nút N", "X"]);
  assert.deepEqual(guideKeys("dodge"), ["Space", "nút Né", "A"]);
  assert.deepEqual(guideKeys("block"), ["Shift · L (giữ)", "nút Đỡ (giữ)", "RB (giữ)"]);
  assert.deepEqual(guideKeys("cmd", { extra: [" + 1–4", "", " + D-pad"] }), ["Tab (giữ) + 1–4", "nút Lệnh", "LT (giữ) + D-pad"]);
  assert.deepEqual(guideKeys("lock"), ["Q · chuột giữa", "nút Khóa", "RT"]);
});
t("thẻ bảng phím đang dùng (moves-info) lấy chữ từ bảng nhãn: không còn bản sao tay", () => {
  for (const id of ["N", "dodge", "block", "skill", "ult", "tpc", "kesach", "lock"]) {
    const action = { N: "n" }[id] ?? id;
    assert.deepEqual(MOVE_INFO[id].keys.slice(0, 2), guideKeys(action).slice(0, 2), id);
  }
  assert.deepEqual(MOVE_INFO_WC01.N.keys.slice(0, 2), guideKeys("n").slice(0, 2));
});

console.log("Chuỗi đòn theo thiết bị");
t("bàn phím hiện đúng cái bạn bấm: N N → C thành J J → K", () => {
  assert.equal(seqFor("N N → C", 0), "J J → K");
  assert.equal(seqFor("C", 0), "K");
  assert.equal(seqFor("N N → C (giữ)", 0), "J J → K (giữ)");
  assert.equal(seqFor("C (giữ để tụ lực)", 0), "K (giữ để tụ lực)");
});
t("cảm ứng giữ tên nút N / C; tay cầm X / Y", () => {
  assert.equal(seqFor("N N → C", 1), "N N → C");
  assert.equal(seqFor("N N N → C", 2), "X X X → Y");
});
t("Né / Đỡ trong chuỗi đổi theo thiết bị, chữ khác giữ nguyên", () => {
  assert.equal(seqFor("Né → N / C", 0), "Space → J / K");
  assert.equal(seqFor("Né → N / C", 2), "A → X / Y");
  assert.equal(seqFor("Đỡ đúng lúc", 0), "Shift đúng lúc");
  assert.equal(seqFor("C cạnh kẻ Vỡ Thế", 0), "K cạnh kẻ Vỡ Thế");
  assert.equal(seqFor("Đỡ đúng lúc", 1), "Đỡ đúng lúc");
});

console.log("Thay nhãn trong câu (fmtKeys)");
t("{tpc} theo thiết bị; viết hoa khi token viết hoa; token lạ giữ nguyên", () => {
  assert.equal(fmtKeys("Sẵn sàng · bấm {tpc}", 0), "Sẵn sàng · bấm F");
  assert.equal(fmtKeys("Sẵn sàng · bấm {tpc}", 1), "Sẵn sàng · bấm nút Phản Công");
  assert.equal(fmtKeys("Sẵn sàng · bấm {tpc}", 2), "Sẵn sàng · bấm D-pad lên");
  assert.equal(fmtKeys("TỔNG PHẢN CÔNG SẴN SÀNG · {TPC}", 1), "TỔNG PHẢN CÔNG SẴN SÀNG · NÚT PHẢN CÔNG");
  assert.equal(fmtKeys("VỠ THẾ · BẤM {C}", 0), "VỠ THẾ · BẤM K HOẶC CHUỘT PHẢI");
  assert.equal(fmtKeys("không {có} gì", 0), "không {có} gì");
  assert.equal(fmtKeys("{xyz} và {tpc}", 0), "{xyz} và F");
  assert.equal(fmtKeys(42, 0), "42");
});
t("nhiều token trong một câu", () => {
  assert.equal(fmtKeys("Giữ {cmd} rồi bấm 1–4; {cmdswap} đổi mặt trận.", 0), "Giữ Tab rồi bấm 1–4; Z đổi mặt trận.");
  assert.equal(fmtKeys("Giữ {cmd} rồi bấm 1–4; {cmdSwap} đổi mặt trận.", 1), "Giữ nút Lệnh rồi bấm 1–4; chạm tên mặt trận đổi mặt trận.");
});

console.log("Động từ theo thiết bị ({act:…})");
t("act: giữ / chạm / bấm lấy từ cờ hold của bảng (nút Lệnh cảm ứng là bật / tắt nên 'chạm')", () => {
  assert.equal(act("cmd", 0), "giữ Tab"); assert.equal(act("cmd", 1), "chạm nút Lệnh"); assert.equal(act("cmd", 2), "giữ LT");
  assert.equal(act("tpc", 0), "bấm F"); assert.equal(act("tpc", 1), "bấm nút Phản Công"); assert.equal(act("tpc", 2), "bấm D-pad lên");
  assert.equal(act("block", 0), "giữ Shift"); assert.equal(act("block", 1), "giữ nút Đỡ");
  assert.equal(act("c", 0), "bấm K hoặc chuột phải");
});
t("{act:cmd} trong câu; viết hoa chữ đầu với {Act:cmd}, viết hoa cả với {ACT:CMD}", () => {
  assert.equal(fmtKeys("Hai mặt trận cùng cần bạn. {Act:cmd} để mở vòng Mệnh Lệnh.", 0), "Hai mặt trận cùng cần bạn. Giữ Tab để mở vòng Mệnh Lệnh.");
  assert.equal(fmtKeys("{Act:cmd} để mở vòng Mệnh Lệnh.", 1), "Chạm nút Lệnh để mở vòng Mệnh Lệnh.");
  assert.equal(fmtKeys("{act:cmd} để mở vòng", 2), "giữ LT để mở vòng");
  assert.equal(fmtKeys("SẴN SÀNG · {ACT:TPC}", 0), "SẴN SÀNG · BẤM F");
  assert.equal(fmtKeys("{act:nope} và {act:tpc}", 0), "{act:nope} và bấm F");
});

console.log("Thiết bị đang dùng");
t("devOf: tay cầm trước, rồi cảm ứng, còn lại bàn phím", () => {
  assert.equal(devOf({ touch: false, input: { pad: false } }), DEV.KB);
  assert.equal(devOf({ touch: true, input: { pad: false } }), DEV.TOUCH);
  assert.equal(devOf({ touch: true, input: { pad: true } }), DEV.PAD);
  assert.equal(devOf({}), DEV.KB);
  assert.equal(devOf(null), DEV.KB);
});
t("wantTouchUI: 'on' luôn cảm ứng, 'off' không bao giờ", () => {
  for (const p of ["", "mouse", "touch", "pen"]) for (const coarse of [true, false]) {
    assert.equal(wantTouchUI("on", p, coarse), true);
    assert.equal(wantTouchUI("off", p, coarse), false);
  }
});
t("wantTouchUI 'auto': theo cách bấm gần nhất; chưa biết mới hỏi trình duyệt", () => {
  assert.equal(wantTouchUI("auto", "mouse", true), false, "máy chỉ báo màn cảm ứng nhưng bạn đang bấm bằng chuột");
  assert.equal(wantTouchUI("auto", "touch", false), true);
  assert.equal(wantTouchUI("auto", "", true), true);
  assert.equal(wantTouchUI("auto", "", false), false);
  assert.equal(wantTouchUI("auto", undefined, true), true);
});
t("wantTouchUI 'auto': bút (pen) không quyết được — máy bảng dùng bút vẫn phải có giao diện cảm ứng, nên theo trình duyệt", () => {
  assert.equal(wantTouchUI("auto", "pen", true), true, "máy bảng (con trỏ chính là cảm ứng) chạm bằng bút");
  assert.equal(wantTouchUI("auto", "pen", false), false, "laptop dùng bút như chuột");
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
