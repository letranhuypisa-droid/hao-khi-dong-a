// ui/quiz.js — Quiz chương (GDD 22.6): một sử quan trong Trướng hỏi tướng quân. Không bắt buộc, không tính giờ, sai
// không bị phạt; màn cuối không hiện điểm kiểu "x/5", chỉ ghi "Sử quan đã ghi" kèm thẻ vừa mở. Mỗi câu có giải
// thích, nhãn sử liệu và "Xem lại khung" mở đúng khung comic rồi quay về câu hỏi.
//
//   runQuiz({ items, comic, settings, onAnswer(item, right), onFinish() → [thẻ mới], onSeen }) → Promise<{ answered }>

import { optionOrder } from "../meta/chapter.js";
import { readComic } from "./comic.js";

const LCLS = { "Chính sử": "cs", "Tương truyền": "tt", "Hư cấu": "hc" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function runQuiz({ items, comic, settings = {}, onAnswer, onFinish, onSeen, onSettings }) {
  return new Promise((resolve) => {
    const box = document.createElement("div"); box.className = "quizbox";
    document.body.appendChild(box);
    document.activeElement?.blur?.();             // Enter không kích lại nút "Hỏi sử quan" nằm sau lớp phủ
    let qi = 0, answered = 0, state = null, closed = false;

    const head = `<div class="quiz-head"><div class="seal">Sử</div><div><h2>Trướng · Sử quan hỏi chuyện</h2>
      <p class="small">Không tính điểm, không trừ gì. Câu chưa đúng sẽ được hỏi lại sau một Chương. <span class="label hc">Hư cấu</span> vai sử quan</p></div></div>`;

    function draw() {
      if (qi >= items.length) return end();
      const it = items[qi];
      if (!state) state = { order: optionOrder(it), picked: null, seq: [] };
      const done = state.picked !== null;
      const opts = state.order.map((oi, k) => {
        const txt = esc(it.options[oi]);
        let cls = "";
        if (it.type === "timeline") {
          const pos = state.seq.indexOf(oi);
          return `<button data-o="${oi}" class="${pos >= 0 ? "picked" : ""}" ${done || pos >= 0 ? "disabled" : ""}><span class="n">${pos >= 0 ? pos + 1 : "·"}</span>${txt}</button>`;
        }
        if (done) cls = oi === it.answer ? "right" : oi === state.picked ? "wrong" : "";
        return `<button data-o="${oi}" class="${cls}" ${done ? "disabled" : ""}>${it.type === "truefalse" ? "" : `<span class="n">${k + 1}</span>`}${txt}</button>`;
      }).join("");
      const right = done && (it.type === "timeline" ? state.seq.every((v, i) => v === i) : state.picked === it.answer);
      const hint = it.type === "timeline" ? `<p class="small">Chạm lần lượt từ sự việc xảy ra trước nhất.${state.seq.length && !done ? ` <a data-a="reset">Chọn lại</a>` : ""}</p>` : "";
      const timelineRes = done && it.type === "timeline"
        ? `<ol class="small" style="margin:8px 0 0 18px">${it.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>` : "";
      const hasPanel = it.panel && comic.panels[it.panel];
      box.innerHTML = `<div class="quiz-in">${head}
        <p class="small">Sử quan hỏi · câu ${qi + 1}</p>
        <div class="quiz-q">${esc(it.q.vi)}</div>${hint}
        <div class="quiz-opts${it.type === "truefalse" ? " tf" : ""}">${opts}</div>
        ${done ? `<div class="quiz-why"><b>${right ? "Tướng quân nói đúng." : it.type === "timeline" ? "Chưa đúng thứ tự." : "Chưa đúng."}</b> ${esc(it.why.vi)}
          <span class="label ${LCLS[it.label] || "hc"}">${esc(it.label)}</span>${hasPanel ? ` · <a data-a="see">Xem lại khung</a>` : ""}${timelineRes}</div>` : ""}
        <div class="quiz-nav"><button data-a="quit">Để sau</button>${done ? `<button class="primary" data-a="next">${qi + 1 < items.length ? "Câu tiếp" : "Xong"}</button>` : "<span></span>"}</div>
      </div>`;
      box.querySelectorAll("[data-o]").forEach((b) => (b.onclick = () => pick(Number(b.dataset.o))));
      box.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => act(b.dataset.a)));
    }
    function pick(oi) {
      const it = items[qi];
      if (state.picked !== null) return;
      if (it.type === "timeline") {
        if (state.seq.includes(oi)) return;
        state.seq.push(oi);
        if (state.seq.length === it.options.length) { state.picked = -1; grade(state.seq.every((v, i) => v === i)); }
      } else { state.picked = oi; grade(oi === it.answer); }
      draw();
    }
    function grade(right) { answered++; onAnswer?.(items[qi], right); }
    async function act(a) {
      if (a === "next") { qi++; state = null; draw(); }
      else if (a === "reset") { state.seq = []; draw(); }
      else if (a === "quit") finish();
      else if (a === "see") {
        const it = items[qi];
        box.style.visibility = "hidden";
        await readComic(comic, { ids: [it.panel], single: true, title: "Xem lại khung", closeLabel: "Về câu hỏi", settings, onSeen, onSettings });
        box.style.visibility = "";
      }
    }
    function end() {
      const cards = onFinish?.() || [];
      box.innerHTML = `<div class="quiz-in quiz-end">${head}
        <p class="brush">Sử quan đã ghi.</p>
        <p class="small">Tạ tướng quân. Những điều tướng quân còn nhớ chưa kỹ, lần sau sử quan xin hỏi lại.</p>
        ${cards.length ? `<p>Sử quán mở thẻ mới:</p><div class="unlocked">${cards.map((c) => `<div class="sq-card new"><b>${esc(c.title)}</b><small><span class="label ${LCLS[c.label]}">${esc(c.label)}</span>Chuyện bên lề</small></div>`).join("")}</div>` : ""}
        <div class="row center"><button class="primary" data-a="close">Về Doanh trại</button></div></div>`;
      box.querySelector("[data-a=close]").onclick = () => finish();
    }
    const onKey = (e) => {
      if (closed || box.style.visibility === "hidden") return;
      const it = items[qi];
      if (it && state && state.picked === null && /^[1-4]$/.test(e.key)) { e.preventDefault(); const oi = state.order[Number(e.key) - 1]; if (oi !== undefined) pick(oi); }
      else if (e.key === "Enter") { e.preventDefault(); box.querySelector("[data-a=next],[data-a=close]")?.click(); }
      else if (e.key === "Escape") { e.preventDefault(); finish(); }
    };
    function finish() {
      if (closed) return; closed = true;
      removeEventListener("keydown", onKey);
      box.remove();
      resolve({ answered, completed: qi >= items.length });
    }
    addEventListener("keydown", onKey);
    draw();
  });
}
