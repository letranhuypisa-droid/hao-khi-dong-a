// Bảng so sánh ảnh đã sinh (design/tools/ai33-img.mjs) để soát nhanh các biến thể bằng mắt:
//   node design/tools/img-sheet.mjs OFF_photuong [LINH_r01 …] [--from 5]
//   node design/tools/img-sheet.mjs --overview [WPN_,PROP_] [--name tên]   ghép ảnh đã chọn (img/best/<mã>.png, tuỳ tiền tố cách nhau dấu phẩy) thành _overview*.png (quá 30 ảnh thì chia trang _1, _2 …)
//   node design/tools/img-sheet.mjs --grid [ENV_c,H3] [--new]   mọi biến thể của các mã có tiền tố (cách nhau dấu phẩy), 30 ảnh một trang, vào img/_grids/ (nhãn "MÃ #số"); --new: chỉ mã chưa có ảnh chọn
//   node design/tools/img-sheet.mjs --pick WPN_dao:2,ENV_hom_go:1      chép ảnh đã chọn vào img/best/; --pick single [tiền tố]: mã chỉ có một ảnh
// Ra design/glb/_raw/img/<mã>/sheet.png (toàn thân các biến thể cạnh nhau, đánh số) và hands.png (dải ngang tầm bàn tay của từng biến thể
// xếp chồng, để soát nắm đấm / khe nách). Dải tay lấy theo tỉ lệ chiều cao (mặc định 0,40–0,56); đổi bằng --band 0.38:0.58.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../glb/_raw/img", import.meta.url));
const argv = process.argv.slice(2);
const fi = argv.indexOf("--from");
const from = fi >= 0 ? +argv.splice(fi, 2)[1] : 1;                // chỉ lấy ảnh có số thứ tự ≥ from (xem riêng đợt sinh sau)
const bi = argv.indexOf("--band");
const [b0, b1] = bi >= 0 ? argv.splice(bi, 2)[1].split(":").map(Number) : [0.4, 0.56];
const ni = argv.indexOf("--name"), nameOpt = ni >= 0 ? argv.splice(ni, 2)[1] : "";            // tên tệp của --overview (mặc định theo tiền tố)
const oi = argv.indexOf("--overview");
if (oi >= 0) {                                                     // ảnh đã chọn trong img/best/ trên một bảng; --overview [tiền tố mã, vd WPN_ hoặc ENV_c; nhiều tiền tố cách nhau dấu phẩy]
  const pre = argv[oi + 1] && !argv[oi + 1].startsWith("--") ? argv[oi + 1] : "", pres = pre.split(",").filter(Boolean);
  const dir = path.join(ROOT, "best"), files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith("_") && (!pres.length || pres.some((p) => f.startsWith(p)))).sort();
  const W = 340, H = 510, COLS = 6, PER = 30;                      // quá 30 ảnh thì chia trang: _overview_<tiền tố>_1.png, _2.png …
  const pages = Math.max(1, Math.ceil(files.length / PER));
  for (let pg = 0; pg < pages; pg++) {
    const part = files.slice(pg * PER, (pg + 1) * PER), cells = [];
    for (const [i, f] of part.entries()) {                         // contain: không cắt ảnh khung ngang / vuông
      const lab = Buffer.from(`<svg width="${W}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="34" fill="#000b"/><text x="8" y="25" font-size="22" font-family="Arial" font-weight="bold" fill="#fff">${f.replace(/\.[a-z]+$/i, "")}</text></svg>`);
      cells.push({ input: await sharp(await sharp(path.join(dir, f)).resize({ width: W, height: H - 34, fit: "contain", background: "#2a2a2a" }).extend({ bottom: 34, background: "#2a2a2a" }).png().toBuffer()).composite([{ input: lab, top: H - 34, left: 0 }]).png().toBuffer(), left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
    }
    const outName = `_overview${nameOpt ? "_" + nameOpt : pre ? "_" + pre.replace(/_$/, "").replace(/,/g, "+").slice(0, 40) : ""}${pages > 1 ? "_" + (pg + 1) : ""}.png`;
    await sharp({ create: { width: COLS * W, height: Math.ceil(part.length / COLS) * H, channels: 3, background: "#222" } }).composite(cells).png().toFile(path.join(dir, outName));
    console.log("→", path.join(dir, outName), part.length, "ảnh");
  }
  process.exit(0);
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const gi = argv.indexOf("--grid");
if (gi >= 0) {                                                     // mọi biến thể của các mã có tiền tố, 30 ảnh một trang: _grids/<tiền tố>_<trang>.png, nhãn "MÃ #số"
  const pre = argv[gi + 1] && !argv[gi + 1].startsWith("--") ? argv[gi + 1] : "", pres = pre.split(",").filter(Boolean), onlyNew = argv.includes("--new");   // tiền tố cách nhau dấu phẩy; --new: chỉ mã chưa có ảnh chọn trong best/
  const items = [];
  for (const code of fs.readdirSync(ROOT).filter((d) => d !== "best" && d !== "_grids" && (!pres.length || pres.some((p) => d.startsWith(p))) && !(onlyNew && fs.existsSync(path.join(ROOT, "best", d + ".png"))) && fs.statSync(path.join(ROOT, d)).isDirectory()).sort())
    for (const f of fs.readdirSync(path.join(ROOT, code)).filter((f) => new RegExp(`^${code}-\\d+\\.(png|jpe?g|webp)$`).test(f)).sort()) items.push({ code, n: +f.match(/-(\d+)\./)[1], file: path.join(ROOT, code, f) });
  const W = 340, H = 400, COLS = 6, PER = 30, out = path.join(ROOT, "_grids");
  fs.mkdirSync(out, { recursive: true });
  for (let pg = 0; pg * PER < items.length; pg++) {
    const cells = [];
    for (const [i, it] of items.slice(pg * PER, (pg + 1) * PER).entries()) {
      const lab = Buffer.from(`<svg width="${W}" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="32" fill="#000b"/><text x="8" y="23" font-size="20" font-family="Arial" font-weight="bold" fill="#fff">${esc(it.code)} #${it.n}</text></svg>`);
      cells.push({ input: await sharp(await sharp(it.file).resize({ width: W, height: H - 32, fit: "contain", background: "#2a2a2a" }).extend({ bottom: 32, background: "#2a2a2a" }).png().toBuffer()).composite([{ input: lab, top: H - 32, left: 0 }]).png().toBuffer(), left: (i % COLS) * W, top: Math.floor(i / COLS) * H });
    }
    const name = `${(pre || "all").replace(/_$/, "").replace(/,/g, "+").slice(0, 40)}${onlyNew ? "_new" : ""}_${pg + 1}.png`, rows = Math.ceil(cells.length / COLS);
    await sharp({ create: { width: COLS * W, height: rows * H, channels: 3, background: "#222" } }).composite(cells).png().toFile(path.join(out, name));
    console.log("→", path.join(out, name), cells.length, "ảnh");
  }
  process.exit(0);
}
const pk = argv.indexOf("--pick");
if (pk >= 0) {                                                     // --pick MÃ:SỐ,MÃ:SỐ  chép ảnh đã chọn vào best/<mã>.png; --pick single [tiền tố]: mã chỉ có một ảnh và chưa chọn
  fs.mkdirSync(path.join(ROOT, "best"), { recursive: true });
  const spec = argv[pk + 1] || "", pre = argv[pk + 2] && !argv[pk + 2].startsWith("--") ? argv[pk + 2] : "";
  const copy = (code, n) => {
    const f = fs.readdirSync(path.join(ROOT, code)).find((x) => new RegExp(`^${code}-0*${n}\\.(png|jpe?g|webp)$`).test(x));
    if (!f) throw new Error(`không có ${code} #${n}`);
    fs.copyFileSync(path.join(ROOT, code, f), path.join(ROOT, "best", code + path.extname(f))); return f;
  };
  if (spec === "single") {
    for (const code of fs.readdirSync(ROOT).filter((d) => d !== "best" && d !== "_grids" && d.startsWith(pre) && fs.statSync(path.join(ROOT, d)).isDirectory())) {
      const fl = fs.readdirSync(path.join(ROOT, code)).filter((f) => new RegExp(`^${code}-\\d+\\.`).test(f));
      if (fl.length === 1 && !fs.readdirSync(path.join(ROOT, "best")).some((b) => b.startsWith(code + "."))) console.log(code, "←", copy(code, +fl[0].match(/-(\d+)\./)[1]));
    }
  } else for (const p of spec.split(",").filter(Boolean)) { const [c, n] = p.split(":"); console.log(c, "←", copy(c, +n)); }
  process.exit(0);
}
const codes = argv;
if (!codes.length) { console.error("Cần mã nhân vật"); process.exit(1); }

const label = (n, w) => Buffer.from(`<svg width="${w}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="44" rx="6" fill="#000a"/><text x="32" y="32" font-size="30" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${n}</text></svg>`);

for (const code of codes) {
  const dir = path.join(ROOT, code);
  if (!fs.existsSync(dir)) { console.log(code, ": chưa có thư mục ảnh"); continue; }
  const num = (f) => +f.match(/-(\d+)\.[a-z]+$/i)[1];
  const files = fs.readdirSync(dir).filter((f) => new RegExp(`^${code}-\\d+\\.(png|jpe?g|webp)$`).test(f) && num(f) >= from).sort();
  if (!files.length) { console.log(code, ": chưa có ảnh"); continue; }
  const H = 900, cells = [], bands = [], human = !/^(WPN|PROP|ENV|MOUNT)_/.test(code);   // dải tay chỉ có nghĩa với người
  for (let i = 0; i < files.length; i++) {
    const img = sharp(path.join(dir, files[i])), m = await img.metadata();
    const w = Math.round((m.width * H) / m.height);
    cells.push({ input: await sharp(await img.resize({ height: H }).toBuffer()).composite([{ input: label(num(files[i]), w), top: 6, left: 6 }]).png().toBuffer(), w });
    const top = Math.round(m.height * b0), hh = Math.round(m.height * (b1 - b0)), W = 1100, bh = Math.round((hh * W) / m.width);
    if (human) bands.push(await sharp(path.join(dir, files[i])).extract({ left: 0, top, width: m.width, height: hh }).resize({ width: W }).composite([{ input: label(num(files[i]), W), top: 4, left: 4 }]).png().toBuffer().then((b) => ({ b, h: bh })));
  }
  const COLS = 4, rows = Math.ceil(cells.length / COLS), place = [];   // tối đa 4 ảnh một hàng, hàng dưới xếp tiếp
  let tw = 0;
  for (let r = 0; r < rows; r++) { let x = 0; for (const c of cells.slice(r * COLS, (r + 1) * COLS)) { place.push({ input: c.input, left: x, top: r * H }); x += c.w; } tw = Math.max(tw, x); }
  await sharp({ create: { width: tw, height: rows * H, channels: 3, background: "#222" } }).composite(place).png().toFile(path.join(dir, "sheet.png"));
  if (human) {
    let y = 0; const th = bands.reduce((s, c) => s + c.h + 4, 0);
    await sharp({ create: { width: 1100, height: th, channels: 3, background: "#222" } }).composite(bands.map((c) => { const o = { input: c.b, left: 0, top: y }; y += c.h + 4; return o; })).png().toFile(path.join(dir, "hands.png"));
  }
  console.log(code, files.length, "ảnh →", path.join(dir, "sheet.png"), human ? "+ hands.png" : "");
}
