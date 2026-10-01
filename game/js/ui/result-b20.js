// ui/result-b20.js — phần riêng của màn kết quả trận Bạch Đằng (đợt 9, D5): sáu nhiệm vụ chính theo pha, bốn nhiệm vụ
// phụ, ba Kế Sách Lớn với trạng thái, và số liệu khúc sông (mốc cọc, thuyền hộ vệ, thuyền nhẹ, hạm đội vào bãi, mắc cạn,
// Thoát vây). main.js nạp lười qua BATTLES.B20.resultUI() rồi chèn giữa bảng điểm và bảng thưởng. Chỉ dựng chuỗi HTML
// (như ui/guide.js); phần tính hàng thuần, chạy được trong node (tests/chapter-b20.test.mjs).
//
// Kết quả trận (director-b20 buildResult) — dạng của B15 (battle/director.js buildResult) cộng:
//   battle: "B20", missionsTotal: 6, sideTotal: 4, eventNames: {}, parSec (tùy chọn; thiếu thì BATTLES.B20.par)
//   main: [bool ×6]            nhiệm vụ chính theo pha P1…P6 (thiếu: mainDone pha đầu coi như xong)
//   side: { S_SCOUT, S_STAKES3, S_X24, S_NOEXIT: bool }   (thiếu: S_STAKES3 suy từ mốc cọc, còn lại chưa xong)
//   river: riverResult(st)     (sim/river.js: keSach{}, markers{M1..M3}, escape, escapeFull, escorts{total,down,captured,
//                               sunk}, flotillaLost, reachShare, strandShare, kRank, intel)
//   keSachList                 như B15 [{id, state, name, word, got, hk, why?}]; thiếu thì lấy river.keSach
//   bossesMet: ["X24","X20"]   boss đã ra trận (bossMet chỉ bật khi Ô Mã Nhi xuất hiện — meta/chapter.js battleUnlockKeys)
//   captured: { X24, X20 }     (tùy chọn) bắt sống ai; phaseTimes: [giây ×6] (tùy chọn) thời gian từng pha
// Xếp hạng: main.js truyền kLost = river.kRank === false vào scoreBattle (mất trọn điểm K khi chỉ 50% hạm đội mắc cạn).

import { PHASES, SIDE_MISSIONS, KE_SACH, KS_ORDER, LIGHT_BOATS, STAKES, BOSSES } from "../data/battle-b20.js";
import { KS_STATE_WORD } from "../sim/river.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pctOf = (v) => `${Math.round((v || 0) * 100)}%`;
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const MARKER_WORD = { hidden: "chưa mở", active: "đã mở", exposed: "bị lộ" };

// Nhiệm vụ chính (một mỗi pha, tên + mục tiêu từ PHASES) và phụ (SIDE_MISSIONS), cờ xong theo kết quả trận.
export function missionRows(res) {
  const r = res.river || {};
  const main = PHASES.map((p, i) => ({
    id: p.id, name: p.name, goal: p.goal,
    done: Array.isArray(res.main) ? !!res.main[i] : i < (res.mainDone || 0),
    time: Array.isArray(res.phaseTimes) && res.phaseTimes[i] > 0 ? res.phaseTimes[i] : null,
  }));
  const derived = { S_STAKES3: r.markersActive === STAKES.length, S_X24: !!res.captured?.X24 };
  const side = SIDE_MISSIONS.map((m) => ({ id: m.id, name: m.name, done: res.side ? !!res.side[m.id] : !!derived[m.id] }));
  return { main, side, mainDone: main.filter((m) => m.done).length, sideDone: side.filter((m) => m.done).length };
}

// Ba Kế Sách Lớn theo thứ tự trận (KS_ORDER), trạng thái từ keSachList hoặc river.keSach; Kế Sách chưa mở ghi "Khóa".
export function keSachRows(res) {
  const src = res.keSachList || Object.values(res.river?.keSach || {});
  const by = Object.fromEntries(src.map((k) => [k.id, k]));
  return KS_ORDER.filter((id) => KE_SACH[id].modes.includes(res.mode || "nhanh")).map((id) => {
    const k = by[id] || { state: "khoa" };
    return { id, name: k.name || KE_SACH[id].name, state: k.state, word: k.word || KS_STATE_WORD[k.state] || k.state,
      got: Math.round(k.got || 0), hk: k.hk ?? KE_SACH[id].hk, why: k.why || null, text: KE_SACH[id].text, label: KE_SACH[id].label };
  });
}

// Số liệu khúc sông từ riverResult: [{ k, v, note?, cls? }] (v là HTML đã escape).
// opts.council: Hiến kế của lần vào trận (ghi vì sao có Tình báo sớm).
export function riverRows(res, { council = null } = {}) {
  const r = res.river;
  if (!r) return [];
  const out = [];
  const mk = STAKES.map((s) => { const st = r.markers?.[s.id] || "hidden"; return `<span class="rb-chip m-${esc(st)}">${esc(s.id)} ${MARKER_WORD[st] || esc(st)}</span>`; }).join(" ");
  out.push({ k: "Mốc cọc", v: `${mk} <small>${r.markersActive ?? 0}/${STAKES.length} mở${r.markersExposed ? ` · ${r.markersExposed} bị lộ` : ""}</small>` });
  const e = r.escorts || {};
  out.push({ k: "Thuyền hộ vệ bị hạ", v: `${e.down ?? 0}/${e.total ?? 0}${e.down ? ` <small>chiếm ${e.captured ?? 0} · đục chìm ${e.sunk ?? 0}</small>` : ""}` });
  out.push({ k: "Thuyền nhẹ mất ở pha 1", v: `${r.flotillaLost ?? 0}/${LIGHT_BOATS.n}${(r.flotillaLost ?? 0) > LIGHT_BOATS.lossMax ? ` <small class="bad">quá ${LIGHT_BOATS.lossMax} thuyền</small>` : ""}` });
  out.push({ k: "Hạm đội vào bãi cọc", v: pctOf(r.reachShare) });
  out.push({ k: "Hạm đội mắc cạn", v: `${pctOf(r.strandShare)}${r.kRank === false ? ` <small class="bad">mất điểm Kế Sách (cần Kích hoạt bãi cọc và Con nước)</small>` : ""}`, cls: r.kRank === false ? "bad" : "" });
  out.push({ k: "Thoát vây", v: `${Math.round(r.escape ?? 0)}/100${r.escapeFull ? ` <small class="bad">đầy — hạm đội thoát vây</small>` : ""}` });
  out.push({ k: "Tình báo sớm", v: r.intel ? `có${council?.historical ? " <small>Hiến kế trùng lựa chọn của người xưa</small>" : council?.replay ? " <small>chơi lại</small>" : ""}` : "không" });
  return out;
}

const tick = (ok) => `<i class="rb-tick ${ok ? "ok" : "no"}" aria-label="${ok ? "xong" : "chưa"}">${ok ? "✓" : "✕"}</i>`;
const LCLS = { "Chính sử": "cs", "Tương truyền": "tt", "Hư cấu": "hc" };

// Phần chèn vào màn kết quả. opts.council: { picked, historical } của lần Hiến kế trước trận (dấu "Kế đã định").
export function resultB20HTML(res, { council = null } = {}) {
  const M = missionRows(res), K = keSachRows(res), R = riverRows(res, { council });
  const planned = !!council?.historical;
  const boss = (id) => BOSSES[id]?.name || id;
  const caught = Object.entries(res.captured || {}).filter(([, v]) => v).map(([id]) => boss(id));
  return `
    <div class="card rb20"><h3>Sáu pha theo con nước</h3>
      <div class="grid2">
        <div><h4>Nhiệm vụ chính · ${M.mainDone}/${M.main.length}</h4><ol class="rb-list">${M.main.map((m) => `<li class="${m.done ? "ok" : ""}">${tick(m.done)}<div><b>${esc(m.id)} · ${esc(m.name)}</b><small>${esc(m.goal)}${m.time ? ` · ${mmss(m.time)}` : ""}</small></div></li>`).join("")}</ol></div>
        <div><h4>Nhiệm vụ phụ · ${M.sideDone}/${M.side.length}</h4><ul class="rb-list">${M.side.map((m) => `<li class="${m.done ? "ok" : ""}">${tick(m.done)}<div><b>${esc(m.name)}</b></div></li>`).join("")}</ul>
          ${caught.length ? `<p class="small">Bắt sống: ${caught.map(esc).join(", ")} <span class="label cs">Chính sử</span></p>` : ""}</div>
      </div>
    </div>
    <div class="grid2 rb20">
      <div class="card"><h3>Kế Sách Lớn · ${K.filter((k) => k.state === "thanhcong").length}/${K.length}</h3>
        <ul class="rb-ks">${K.map((k) => `<li class="ks-${esc(k.state)}"><div class="rb-ksh"><b>${esc(k.name)}</b><span class="rb-state">${esc(k.word)}</span></div>
          <small>${k.state === "thatbai" && k.why ? esc(k.why) + " · " : ""}Hào Khí gốc +${k.got}/${k.hk}${planned ? ` · <em class="rb-plan">Kế đã định</em>` : ""} <span class="label ${LCLS[k.label] || "cs"}">${esc(k.label)}</span></small></li>`).join("")}</ul>
      </div>
      <div class="card"><h3>Khúc sông</h3>${R.length ? `<table class="stat">${R.map((x) => `<tr class="${x.cls || ""}"><td>${esc(x.k)}</td><td>${x.v}</td></tr>`).join("")}</table>` : `<p class="small">Không có số liệu khúc sông.</p>`}</div>
    </div>`;
}
// tên chung main.js gọi (BATTLES[id].resultUI → module.resultHTML)
export const resultHTML = resultB20HTML;
