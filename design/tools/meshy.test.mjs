// design/tools/meshy.test.mjs — kiểm meshy.mjs không cần mạng, không tốn credit: đọc design/glb-prompts.md (cả CRLF), mục K–P,
// tệp môi trường env_, bộ chọn, POSE v2, mục làm lại _v2, lệnh list --hash; và mọi mã trong design/glb/manifest.json giữ nguyên
// băm prompt (băm đổi thì `run` mặc định mua lại mẫu đó và ghi đè GLB).
//   node design/tools/meshy.test.mjs
// Nhập meshy.mjs như thư viện: tệp đó chỉ chạy lệnh khi là tệp chính (import.meta.main, Node ≥ 24.2).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");
if (typeof import.meta.main !== "boolean") { console.log("cần Node ≥ 24.2 (import.meta.main)\n0 đạt, 1 trượt"); process.exit(1); }
const { loadAssets, apiPrompt, hash, setOf, POSE, POSE2 } = await import("./meshy.mjs");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}

const DOC = join(ROOT, "design/glb-prompts.md");
const md = readFileSync(DOC, "utf8");
const man = JSON.parse(readFileSync(join(ROOT, "design/glb/manifest.json"), "utf8"));
const codes = (list) => list.map((a) => a.code);
const STYLE = "Stylized low-poly game asset, realistic proportions, crisp bevelled edges, flat hand-painted lacquer colors, clear silhouette.";

// Tài liệu nhỏ dựng tay: dòng bảng 8 cột + mục "### X0 · MÃ · tên" có khối PROMPT.
const row = (no, code, file, group, tris = "1–2k") => `| ${no} | ${code} | \`${file}\` | tên ${code} | ${group} | ${tris} | — | — |`;
const sec = (id, code, prompt, note = "") => `### ${id} · ${code} · tên ${code}\n\nGhi chú.\n\nPROMPT (dán thẳng):\n\`\`\`text\n${prompt}\n\`\`\`\n\n- **Kỹ thuật**: ${note}\n`;
const doc = (rows, secs) => `# Thử\n\n| # | Mã | Tệp | Tên | Nhóm | Tam giác | Cao | Đi kèm |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\n## X. Mục\n\n${secs.join("\n")}\n## Hết\n`;
const person = (d) => `${d} ${POSE2} ${STYLE}`;
const thing = (d) => `${d} Isolated single object. ${STYLE}`;

// Đọc lỗi thì trả mảng rỗng mang lỗi, để từng phép kiểm báo trượt riêng thay vì dừng cả tệp.
const tryLoad = (m) => { try { return loadAssets(m); } catch (e) { return Object.assign([], { err: e }); } };

console.log("Đọc tài liệu");
const all = tryLoad();
t("tài liệu trong cây làm việc (CRLF trên Windows) đọc được, ít nhất 63 mục", () => { assert.ok(!all.err, all.err?.message); assert.ok(all.length >= 63, `${all.length} mục`); });
t("CRLF và LF cho cùng mã, cùng băm", () => {
  const lf = loadAssets(md.replace(/\r\n/g, "\n")), cr = loadAssets(md.replace(/\r?\n/g, "\r\n"));
  assert.deepEqual(cr.map((a) => a.code + " " + hash(a)), lf.map((a) => a.code + " " + hash(a)));
});
t("mọi mã trong manifest (40 mẫu đã tạo) giữ nguyên băm", () => {
  const bad = Object.entries(man).filter(([c, m]) => { const a = all.find((x) => x.code === c); return !a || hash(a) !== m.hash; }).map(([c]) => c);
  assert.ok(Object.keys(man).length >= 40, `manifest ${Object.keys(man).length} mã`);
  assert.deepEqual(bad, []);
});
t("bộ can (mặc định của run) vẫn đúng 40 mã đã có trong manifest", () => {
  const can = codes(setOf(all, "can"));
  assert.equal(new Set(can).size, 40);
  assert.deepEqual(can.filter((c) => !man[c]), []);
});
t("khối POSE cũ và POSE v2 ở mục 2.2 khớp đúng chuỗi công cụ nhận", () => {
  const s22 = md.replace(/\r\n/g, "\n").split("\n### 2.2 ")[1].split("\n### 2.3 ")[0];
  assert.ok(s22.includes("```text\n" + POSE + "\n```"), "thiếu khối POSE cũ");
  assert.ok(s22.includes("```text\n" + POSE2 + "\n```"), "thiếu khối POSE v2");
  assert.ok(POSE2.startsWith("A-pose,"));
});

console.log("Mục K–P, tệp môi trường env_");
const ENV = doc([row(70, "ENV_thuyen_x", "env_thuyen-x.glb", "K", "3–6k")], [sec("K1", "ENV_thuyen_x", thing("Wooden boat 10 m long."), "Symmetry: bật.")]);
t("mục K1 · ENV_… đọc được, tệp env_ vào thư mục moi-truong, không phải người", () => {
  const [a] = loadAssets(ENV);
  assert.equal(a.sec, "K1"); assert.equal(a.kind, "moi-truong"); assert.equal(a.person, false); assert.equal(a.sym, "on");
  assert.equal(a.tris, 4500); assert.equal(a.file, "env_thuyen-x.glb");
});
t("môi trường: bản API chỉ rút gọn STYLE, không chèn câu chặn vũ khí", () => {
  const [a] = loadAssets(ENV), p = apiPrompt(a);
  assert.equal(p.length, a.prompt.length - 30); assert.ok(!/Unarmed/.test(p));
});
for (const L of "LMNOP") t(`đầu mục chữ ${L} cũng đọc được`, () => {
  assert.equal(loadAssets(doc([row(71, "ENV_y", "env_y.glb", L)], [sec(L + "3", "ENV_y", thing("Rock."))]))[0].sec, L + "3");
});
t("tiền tố tệp lạ: báo lỗi ngay lúc đọc tài liệu (trước khi gửi gì lên Meshy)", () => {
  assert.throws(() => loadAssets(doc([row(72, "ENV_z", "boat_z.glb", "K")], [sec("K2", "ENV_z", thing("Boat."))])), /tiền tố/);
});
t("mã ENV_ phải đi với tệp env_", () => {
  assert.throws(() => loadAssets(doc([row(73, "ENV_z", "prop_z.glb", "K")], [sec("K2", "ENV_z", thing("Boat."))])), /env_/);
  assert.throws(() => loadAssets(doc([row(73, "PROP_z", "env_z.glb", "M")], [sec("M2", "PROP_z", thing("Box."))])), /env_/);
});

console.log("Bộ chọn");
const SETDOC = doc([
  row(80, "H35", "char_H35_tran-quoc-toan.glb", "A", "10–20k"),
  row(81, "WPN_x", "wpn_x.glb", "G"),
  row(82, "DAN_NAM", "unit_DAN_NAM.glb", "J", "1,5–3k"),
  row(83, "PROP_non_la", "prop_non-la.glb", "H", "300–600"),
  row(84, "ENV_thuyen_x", "env_thuyen-x.glb", "K"),
  row(85, "MOUNT_trau", "mount_trau.glb", "I", "4–8k"),
  row(86, "ENV_co_trang", "env_co-trang.glb", "O", "300–800"),
  row(87, "ENV_cay_y", "env_cay-y.glb", "N"),
  row(88, "H33_v2", "char_H33_tran-nhat-duat_v2.glb", "A", "10–20k"),
  row(89, "H27", "char_H27_tran-thai-tong.glb", "A", "10–20k"),
  row(90, "TT", "char_TT_trieu-trung.glb", "A", "10–20k"),
  row(91, "X16", "char_X16_ngot-luong-hop-thai.glb", "B", "10–20k"),
  row(92, "DAN_NAM_v2", "unit_DAN_NAM_v2.glb", "J", "1,5–3k"),
], [
  sec("A1", "H35", person("General.")), sec("G1", "WPN_x", thing("Sword.")), sec("J1", "DAN_NAM", person("Peasant.")),
  sec("H5", "PROP_non_la", thing("Hat.")), sec("K1", "ENV_thuyen_x", thing("Boat.")), sec("O1", "MOUNT_trau", thing("Buffalo.")),
  sec("O2", "ENV_co_trang", thing("Egret.")), sec("N1", "ENV_cay_y", thing("Tree.")), sec("P1", "H33_v2", person("General.")),
  sec("A8", "H27", person("King.")), sec("A9", "TT", person("Song officer.")), sec("B7", "X16", person("Mongol marshal.")),
  sec("P2", "DAN_NAM_v2", person("Peasant.")),
]);
const sa = tryLoad(SETDOC);
t("thieu: dân làng, nón lá, trâu, thú mục O (không gồm mục làm lại _v2)", () => assert.deepEqual(codes(setOf(sa, "thieu")), ["DAN_NAM", "PROP_non_la", "MOUNT_trau", "ENV_co_trang"]));
t("thieu trên tài liệu thật gồm DAN_*, DV_AOTONG, quang gánh, tay nải, ống tên", () => {
  const th = codes(setOf(all, "thieu"));
  for (const c of ["DAN_NAM", "DAN_NU", "DAN_TRE", "DV_AOTONG", "PROP_quang_ganh", "PROP_tay_nai", "PROP_ong_ten"]) assert.ok(th.includes(c), c);
  assert.deepEqual(th.filter((c) => man[c]), []);
});
t("moi-truong: mọi mã ENV_", () => assert.deepEqual(codes(setOf(sa, "moi-truong")), ["ENV_thuyen_x", "ENV_co_trang", "ENV_cay_y"]));
t("lam-lai: mọi mã _vN", () => assert.deepEqual(codes(setOf(sa, "lam-lai")), ["H33_v2", "DAN_NAM_v2"]));
t("tuong-moi: tướng có tên (H.., X.., TT) chưa thuộc bộ can", () => assert.deepEqual(codes(setOf(sa, "tuong-moi")), ["H27", "TT", "X16"]));
t("tuong-moi trên tài liệu thật: H34, H38, H39, không có tướng đã tạo", () => {
  const tm = codes(setOf(all, "tuong-moi"));
  for (const c of ["H34", "H38", "H39"]) assert.ok(tm.includes(c), c);
  assert.deepEqual(tm.filter((c) => man[c]), []);
});
t("tat-ca: 40 mã can trước, rồi mọi mục khác, không trùng", () => {
  const ta = codes(setOf(all, "tat-ca"));
  assert.deepEqual(ta.slice(0, 40), codes(setOf(all, "can"))); assert.equal(ta.length, all.length); assert.equal(new Set(ta).size, ta.length);
});
t("tên bộ lạ: không trả danh sách", () => assert.equal(setOf(all, "khong-co"), undefined));

console.log("POSE v2");
t("POSE v2: bản API ngắn hơn, giữ \"A-pose,\" nên câu chặn vũ khí vẫn chèn ngay trước", () => {
  const [a] = loadAssets(doc([row(93, "H27", "char_H27_tran-thai-tong.glb", "A", "10–20k")], [sec("A8", "H27", person("Vietnamese king, 13th century, black silk cap."))]));
  const p = apiPrompt(a);
  assert.ok(!p.includes(POSE2), "POSE v2 chưa được rút gọn");
  assert.match(p, /Unarmed: no sword, scabbard or weapon on the body\. No horns, no cape\. A-pose, /);
  assert.ok(/straight arms 45° down/.test(p) && /elbows straight/.test(p) && /fingers together/.test(p));
  assert.ok(!/No helmet/.test(p), "có cap thì không thêm No helmet");
});
t("POSE cũ vẫn đổi sang bản API cũ (mục đã tạo không đổi chữ)", () => {
  const h35 = all.find((a) => a.code === "H35");
  assert.ok(h35.prompt.includes(POSE));
  assert.ok(apiPrompt(h35).includes("No horns, no cape. A-pose, arms angled down away from the body, open empty hands, feet shoulder-width, facing front."));
});
t("prompt người không có \"A-pose,\" (vd. \"A-pose:\") → lỗi lúc đọc, vì câu chặn sẽ không được chèn", () => {
  assert.throws(() => loadAssets(doc([row(94, "H27", "char_H27_x.glb", "A", "10–20k")], [sec("A8", "H27", `King. ${POSE2.replace("A-pose,", "A-pose:")} ${STYLE}`)])), /A-pose,/);
});

console.log("Làm lại _v2: không ghi đè tệp cũ");
t("H33_v2 → char_H33_tran-nhat-duat_v2.glb, cùng thư mục nhân vật, khác tệp H33", () => {
  const a = sa.find((x) => x.code === "H33_v2");
  assert.equal(a.file, "char_H33_tran-nhat-duat_v2.glb"); assert.equal(a.kind, "nhan-vat"); assert.equal(a.person, true);
  assert.notEqual(a.file, all.find((x) => x.code === "H33").file);
});
t("_v2 giữ quy tắc riêng của mã gốc: H31_v2 texture 2048, ngựa _v2 đối xứng bật", () => {
  const v = loadAssets(doc([row(95, "H31_v2", "char_H31_tran-hung-dao_v2.glb", "A", "10–20k"), row(96, "MOUNT_ngua_nguyen_v2", "mount_ngua-nguyen_v2.glb", "I", "4–8k")],
    [sec("P3", "H31_v2", person("Old general.")), sec("P4", "MOUNT_ngua_nguyen_v2", thing("Horse."))]));
  assert.equal(v[0].tex, 2048); assert.equal(v[1].sym, "on"); assert.match(v[1].negative, /rider, person$/);
});
t("mã _v2 mà tệp không có hậu tố _v2 → lỗi (sẽ ghi đè tệp cũ)", () => {
  assert.throws(() => loadAssets(doc([row(97, "H33_v2", "char_H33_tran-nhat-duat.glb", "A", "10–20k")], [sec("P1", "H33_v2", person("General."))])), /_v2\.glb.*ghi đè/);
});
t("hai mục cùng một tệp → lỗi", () => {
  assert.throws(() => loadAssets(doc([row(98, "ENV_a", "env_a.glb", "K"), row(99, "ENV_b", "env_a.glb", "K")], [sec("K1", "ENV_a", thing("A.")), sec("K2", "ENV_b", thing("B."))])), /trùng/);
});

console.log("Lệnh list (không mạng)");
const cli = (...a) => spawnSync(process.execPath, [join(here, "meshy.mjs"), ...a], { cwd: ROOT, encoding: "utf8", env: { ...process.env, MESHY_API_KEY: "", MESHY_API_KEY_FILE: "" } });
t("list --hash: mỗi mã một dòng mã, băm, độ dài API, tam giác; 40/40 mã đã tạo khớp manifest", () => {
  const r = cli("list", "--hash");
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.split(/\r?\n/).filter((l) => /^\S+\s+[0-9a-f]{10}\s/.test(l));
  assert.equal(lines.length, 40);
  for (const l of lines) {
    const [, code, h, len, tris] = l.match(/^(\S+)\s+([0-9a-f]{10})\s+(\d+) ký tự\s+(\d+) tg/);
    const a = all.find((x) => x.code === code);
    assert.equal(h, man[code].hash, code); assert.equal(+len, apiPrompt(a).length, code); assert.equal(+tris, a.tris, code);
    assert.match(l, /= manifest/);
  }
  assert.match(r.stdout, /40\/40 mã đã có trong manifest giữ nguyên băm/);
});
t("list --set tat-ca chạy được, mỗi mục một dòng", () => {
  const r = cli("list", "--set", "tat-ca");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.split(/\r?\n/).filter((l) => /^\s*\d+a?\s/.test(l)).length, all.length);
});
t("--set lạ: báo đủ tên các bộ", () => {
  const r = cli("list", "--set", "khong-co");
  assert.notEqual(r.status, 0);
  for (const s of ["thu", "can", "thieu", "moi-truong", "lam-lai", "tuong-moi", "tat-ca"]) assert.ok(r.stderr.includes(s), s);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
