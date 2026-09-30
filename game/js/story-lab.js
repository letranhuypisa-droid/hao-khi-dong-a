// story-lab.js — phòng thử màn Chương (chỉ dùng khi phát triển): mở riêng Hiến kế (ui/council.js) hoặc comic
// (ui/comic.js) của B20 để xem và chụp màn hình, không cần vào trận.
//
//   story-lab.html?view=council[&tut][&replay][&lang=en][&seed=3][&pick=A][&step=reply|decree]
//   story-lab.html?view=comic&part=open|decree|close[&council=A][&mode=page|panel][&lang=en]
//
// pick / step bấm hộ để chụp từng bước; council=A điền bóng thoại D1 theo kế đã chọn (applyCouncil).
// window.__story: { result, comic } cho kịch bản chụp (tools/shot.mjs).

import { COMIC_B20 } from "./data/comic-b20.js";
import { runCouncil, applyCouncil } from "./ui/council.js";
import { readComic } from "./ui/comic.js";

const q = new URLSearchParams(location.search);
const view = q.get("view") || "council", lang = q.get("lang") === "en" ? "en" : "vi";
const settings = { comicLang: lang, comicMode: q.get("mode") || undefined, motion: !q.has("still") };
const log = (s) => (document.getElementById("log").textContent = s);
let seed = Number(q.get("seed") || 1) * 2654435761 >>> 0;   // mulberry32: seed nhỏ vẫn cho số đầu trải đều
const rng = () => { seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
window.__story = { result: null, comic: COMIC_B20 };

if (view === "council") {
  const p = runCouncil({ council: COMIC_B20.council, comic: COMIC_B20, settings, rng, tutorial: q.has("tut"), replay: q.has("replay"),
    marks: ["Nghi binh lúc triều lên", "Kích hoạt bãi cọc", "Con nước"] });
  const pick = q.get("pick"), step = q.get("step");
  if (pick) setTimeout(() => {
    document.querySelector("[data-c=tutok]")?.click();
    document.querySelector(`[data-k="${pick}"]`)?.click();
    if (step === "decree") document.querySelector("[data-c=next]")?.click();
  }, 600);
  p.then((r) => { window.__story.result = r; log("Kết quả: " + JSON.stringify(r)); });
} else {
  const part = q.get("part") || "open";
  const comic = q.get("council") ? applyCouncil(COMIC_B20, q.get("council")) : COMIC_B20;
  window.__story.comic = comic;
  readComic(comic, { ids: comic[part], title: `${comic.chapter.title[lang]} · ${part}`, settings })
    .then((r) => { window.__story.result = r; log("Comic: " + JSON.stringify(r)); });
}
