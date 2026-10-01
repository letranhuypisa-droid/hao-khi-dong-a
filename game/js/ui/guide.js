// ui/guide.js — bảng hướng dẫn có icon: đòn đánh, phòng thủ, kỹ năng, chỉ huy, các khái niệm của trận.
// Dùng ở thẻ Huấn luyện (Doanh trại), bảng tạm dừng, màn Huấn luyện. Chỉ dựng chuỗi HTML.
// hero (đợt 9): id tướng ("H35" mặc định — bảng như cũ, "H31" đại kiếm + Hịch Tướng Sĩ + Binh Thư + Bạch Đằng Quyết Chiến).

import { MOVE_INFO, ICON, moveInfoOf } from "../data/moves-info.js";
import { guideKeys, seqFor, short } from "../data/controls.js";
import { GLOSS, CONCEPT_ORDER } from "../data/glossary.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kbd = (s) => s.split(" · ").map((k) => `<kbd>${esc(k)}</kbd>`).join("");

// dev: 0 bàn phím, 1 cảm ứng, 2 tay cầm
export function card(id, dev = 0, extraKey = "", info = MOVE_INFO) {
  const m = info[id];
  const key = m.keys ? kbd(m.keys[dev] || m.keys[0]) : m.seq ? kbd(seqFor(m.seq, dev)) : extraKey ? kbd(extraKey) : "";
  return `<div class="gcard"><img src="${ICON(m.icon)}" alt=""><div><b>${esc(m.name)}</b>${key}<small>${esc(m.text)}</small></div></div>`;
}

// Khái niệm của trận (không có phím riêng): icon mượn của lệnh gần nghĩa nhất. Chữ lấy từ data/glossary.js (cùng nguồn với gợi ý lần đầu
// giữa trận, battle/hints.js; con số lấy từ tuning.js). Đợt 11 thêm Sĩ Khí, Gượng dậy và gộp Phá Thế với Vỡ Thế.
const CONCEPTS = CONCEPT_ORDER.map((id) => ({ icon: GLOSS[id].icon, name: GLOSS[id].name, text: GLOSS[id].long }));

// "N", "C" là tên hai nút đánh; dòng này nói rõ phím thật để người chơi bàn phím không đi tìm phím C.
const bindNote = (dev) => (dev === 1 ? `<p class="gbind">N và C là hai nút đánh ở góc phải màn hình.</p>`
  : `<p class="gbind"><kbd>N</kbd> = ${kbd(guideKeys("n")[dev])} <span>·</span> <kbd>C</kbd> = ${kbd(guideKeys("c")[dev])}</p>`);
const padNote = (wc01) => { const P = (a) => short(a, 2);
  return `Tay cầm: ${P("n")} đòn N · ${P("c")} đòn C${wc01 ? " (giữ để tụ lực)" : ""} · ${P("dodge")} né · ${P("block")} đỡ · ${P("skill")} ${wc01 ? "Hịch Tướng Sĩ" : "Phá Trận"}${wc01 ? ` · ${P("skill2")} Binh Thư` : ""} · ${P("ult")} Tuyệt Kỹ · ${P("cmd")} giữ = Mệnh Lệnh · ${P("tpc")} Tổng Phản Công · ${P("kesach")} Kế Sách. `; };

export function movesGuideHTML({ dev = 0, compact = false, hero = "H35" } = {}) {
  const I = moveInfoOf(hero), wc01 = I !== MOVE_INFO, c = (k) => card(k, dev, "", I);
  const mv = guideKeys("move")[dev];
  const cam = dev === 0 ? "chuột (bấm vào màn để khóa chuột) · ← →" : guideKeys("cam")[dev];
  return `<div class="guide${compact ? " compact" : ""}">
    <h4>Di chuyển</h4>
    <div class="gcards">
      <div class="gcard"><img src="${ICON("dash")}" alt=""><div><b>Chạy</b>${kbd(mv)}<small>Đòn đánh tự xoay về địch gần nhất theo hướng bạn đang đẩy.</small></div></div>
      <div class="gcard"><img src="${ICON("lock")}" alt=""><div><b>Camera</b>${kbd(cam)}<small>Đứng yên một lúc thì camera tự xoay theo hướng chạy.</small></div></div>
      ${c("lock")}
    </div>
    <h4>Đòn đánh · ${wc01 ? "đại kiếm" : "song đao"}</h4>
    ${bindNote(dev)}
    <div class="gcards">${["N", "C1", "C2", "C3", "C4", "C5", "C6", "D", "DQ", "CT"].map(c).join("")}</div>
    <h4>Phòng thủ và kỹ năng</h4>
    <div class="gcards">${["dodge", "block", "skill", ...(I.skill2 ? ["skill2"] : []), "ult", "tpc"].map(c).join("")}</div>
    <h4>Chỉ huy</h4>
    <div class="gcards">${["cmd", "tiencong", "giuvung", "theota", "tiepvien", "kesach"].map((k) => card(k, dev)).join("")}</div>
    ${compact ? "" : `<h4>Trong trận</h4><div class="gcards">${CONCEPTS.map((c) => `<div class="gcard"><img src="${ICON(c.icon)}" alt=""><div><b>${c.name}</b><small>${c.text}</small></div></div>`).join("")}</div>`}
    <p class="small">${dev === 2 ? "" : padNote(wc01)}M bản đồ lớn · Esc tạm dừng.</p>
  </div>`;
}
