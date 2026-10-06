// design/tools/meshy.test.mjs — kiểm meshy.mjs không cần mạng, không tốn credit: đọc design/glb-prompts.md (cả CRLF), mục K–P,
// tệp môi trường env_, bộ chọn, POSE v2, mục làm lại _v2, lệnh list --hash; và mọi mã trong design/glb/manifest.json giữ nguyên
// băm prompt (băm đổi thì `run` mặc định mua lại mẫu đó và ghi đè GLB). Soát cả nội dung mục môi trường K–O của tài liệu thật:
// độ dài (tài liệu ≤ 630, API ≤ 600), khối STYLE, dải tam giác ≥ 300, kích thước thật, không xin chữ, dẫn chỗ code; nón lá, trâu.
// Mục P làm lại (15 mã _v2: đúng tệp, nhóm, POSE v2, sửa đúng chỗ lệch), 15 tướng mới từ design/3d-ref (tay không, POSE v2,
// tài liệu ≤ 565, API ≤ 600), mục người chưa tạo đều dùng POSE v2, mục 0.8 "Còn phải tạo" có lệnh và credit từng lượt.
// Lỗi tài liệu bắt khi đọc (trùng mã dòng bảng hay mục ###, mục không dòng bảng, dải tam giác sai, Symmetry hai chiều, khối POSE
// biến thể); bộ tuy-chon; chặn run mua lại mẫu đã xong khi băm đổi (guardRun), list --hash trả mã lỗi, --redo cất tệp cũ;
// và các chỗ sửa sau soát (boong, cột, cán cờ thuyền; chữ cấp bậc ở tướng mới; mũ lông chóp ngắn; tường Việt; bánh xe nan).
// Soát vòng 2: run chặn cả lưới đã mua mà băm đổi, list --hash ghi riêng dòng ấy; tên tệp tiền tố + mã + .glb; mã _v2 có mã gốc,
// đúng tệp, cùng nhóm; --only bỏ mã trùng; run --set tat-ca bỏ LINH_r2; "tùy chọn" hai cách bỏ dấu; trần tam giác trong game bằng
// số code (đầu mục K, design/tools/scene-tris.mjs); cỡ chông, lầu và cột thuyền, bè, cò; mũ một chóp cứng; Symmetry ghi rõ.
// Soát vòng 3: kiểm đối số trước mọi lệnh (--x=y, cờ lạ, cờ thiếu giá trị), dải tam giác (chữ sau số, trần 30k, sàn 300), POST
// không gửi lại khi lỗi mạng hay 5xx, --redo cất tệp sau khi đọc được credit, câu báo mã đã mua cả texture; boong thuyền hộ vệ,
// kỳ hạm; chông chỉ có chông; lều Võ trường hình thoi; màu đỉnh gần trắng cho vật nhuộm instance; câu phủ định, mặt đất; đại đao.
//   node design/tools/meshy.test.mjs
// Nhập meshy.mjs như thư viện: tệp đó chỉ chạy lệnh khi là tệp chính (import.meta.main, Node ≥ 24.2).
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, "../..");
if (typeof import.meta.main !== "boolean") { console.log("cần Node ≥ 24.2 (import.meta.main)\n0 đạt, 1 trượt"); process.exit(1); }
const { loadAssets, apiPrompt, hash, setOf, pick, POSE, POSE2, guardRun, hashRows, setAsideRaw, checkArgs, shouldRetry } = await import("./meshy.mjs");

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
  row(79, "H33", "char_H33_tran-nhat-duat.glb", "A", "10–20k"),
  row(89, "H27", "char_H27_tran-thai-tong.glb", "A", "10–20k"),
  row(90, "TT", "char_TT_trieu-trung.glb", "A", "10–20k"),
  row(91, "X16", "char_X16_ngot-luong-hop-thai.glb", "B", "10–20k"),
  row(92, "DAN_NAM_v2", "unit_DAN_NAM_v2.glb", "J", "1,5–3k"),
], [
  sec("A1", "H35", person("General.")), sec("G1", "WPN_x", thing("Sword.")), sec("J1", "DAN_NAM", person("Peasant.")),
  sec("H5", "PROP_non_la", thing("Hat.")), sec("K1", "ENV_thuyen_x", thing("Boat.")), sec("O1", "MOUNT_trau", thing("Buffalo.")),
  sec("O2", "ENV_co_trang", thing("Egret.")), sec("N1", "ENV_cay_y", thing("Tree.")), sec("P1", "H33_v2", person("General.")),
  sec("A8", "H27", person("King.")), sec("A9", "TT", person("Song officer.")), sec("B7", "X16", person("Mongol marshal.")),
  sec("P2", "DAN_NAM_v2", person("Peasant.")), sec("A3", "H33", person("General.")),
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
const OPTDOC = doc([row(80, "WPN_x", "wpn_x.glb", "G"), row(81, "ENV_thuyen_x", "env_thuyen-x.glb", "K"), row(82, "ENV_long_x", "env_long-x.glb", "K", "3–5k"),
  row(83, "H35", "char_H35_tran-quoc-toan.glb", "A", "10–20k")],
  [sec("G9", "WPN_x", thing("Axe.")), sec("K1", "ENV_thuyen_x", thing("Boat.")), sec("K10", "ENV_long_x", thing("Dragon boat.")).replace("tên ENV_long_x", "Long thuyền (tuỳ chọn)"),
    sec("A1", "H35", person("General."))]);
const oa = tryLoad(OPTDOC);
t("moi-truong bỏ mục môi trường ghi \"(tuỳ chọn)\" ở đầu mục; tuy-chon = mục không thuộc bộ nào khác cộng các mục đó", () => {
  assert.deepEqual(codes(setOf(oa, "moi-truong")), ["ENV_thuyen_x"]);
  assert.deepEqual(codes(setOf(oa, "tuy-chon")), ["WPN_x", "ENV_long_x"]);
});
t("tuy-chon trên tài liệu thật: 12 mục tuỳ chọn và 3 mục môi trường tuỳ chọn; không có LINH_r2 (còn khối POSE cũ), không trùng bộ khác", () => {
  const tc = codes(setOf(all, "tuy-chon"));
  assert.deepEqual([...tc].sort(), ["WPN_daiphu", "WPN_quat", "WPN_daikiem_vandon", "WPN_doandao", "WPN_duisat", "WPN_moc_voi", "PROP_co_lung", "PROP_cape",
    "PROP_banh_voi", "PROP_giap_voi", "MOUNT_ngua_tuong", "MOUNT_voi_chien", "ENV_long_thuyen", "ENV_mieu", "ENV_day_nui_xa"].sort());
  const mt = codes(setOf(all, "moi-truong"));
  assert.ok(!mt.includes("ENV_long_thuyen") && !mt.includes("ENV_mieu") && !mt.includes("ENV_day_nui_xa"));
  assert.equal(mt.length + 3, all.filter((a) => a.code.startsWith("ENV_")).length);
});

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
  const v = loadAssets(doc([row(95, "H31_v2", "char_H31_tran-hung-dao_v2.glb", "A", "10–20k"), row(96, "MOUNT_ngua_nguyen_v2", "mount_ngua-nguyen_v2.glb", "I", "4–8k"),
    row(2, "H31", "char_H31_tran-hung-dao.glb", "A", "10–20k"), row(29, "MOUNT_ngua_nguyen", "mount_ngua-nguyen.glb", "I", "4–8k")],
    [sec("P3", "H31_v2", person("Old general.")), sec("P4", "MOUNT_ngua_nguyen_v2", thing("Horse.")), sec("A2", "H31", person("Old general.")), sec("I1", "MOUNT_ngua_nguyen", thing("Horse."))]));
  assert.equal(v[0].tex, 2048); assert.equal(v[1].sym, "on"); assert.match(v[1].negative, /rider, person$/);
});
t("mã _v2 mà tệp không có hậu tố _v2 → lỗi (sẽ ghi đè tệp cũ)", () => {
  assert.throws(() => loadAssets(doc([row(97, "H33_v2", "char_H33_tran-nhat-duat.glb", "A", "10–20k")], [sec("P1", "H33_v2", person("General."))])), /_v2\.glb.*ghi đè/);
});
t("hai mục cùng một tệp → lỗi", () => {
  assert.throws(() => loadAssets(doc([row(98, "ENV_a", "env_a.glb", "K"), row(99, "ENV_b", "env_a.glb", "K")], [sec("K1", "ENV_a", thing("A.")), sec("K2", "ENV_b", thing("B."))])), /trùng/);
});

console.log("Lỗi tài liệu bắt ngay khi đọc (chép mục làm _v2, _v3 dễ sót)");
const one = (rows, secs) => () => loadAssets(doc(rows, secs));
t("hai dòng bảng cùng mã (chép dòng mà quên đổi mã) → lỗi, không lặng lẽ lấy dòng sau", () => {
  assert.throws(one([row(60, "H35", "char_H35_a.glb", "A", "10–20k"), row(61, "H35", "char_H35_a_v2.glb", "A", "10–20k")], [sec("A1", "H35", person("General."))]), /H35: trùng mã/);
});
t("hai mục ### cùng mã (chép mục mà quên đổi mã) → lỗi, không lặng lẽ thay prompt", () => {
  assert.throws(one([row(60, "H35", "char_H35_a.glb", "A", "10–20k")], [sec("A1", "H35", person("General.")), sec("P9", "H35", person("Other general."))]), /H35: hai mục ###/);
});
t("mục có PROMPT mà không có dòng bảng (xoá dòng, hoặc dòng thiếu cột) → lỗi", () => {
  assert.throws(one([row(60, "ENV_a", "env_a.glb", "K")], [sec("K1", "ENV_a", thing("A.")), sec("K2", "ENV_b", thing("B."))]), /ENV_b: có mục PROMPT nhưng không có dòng bảng/);
  const seven = "| 61 | ENV_b | `env_b.glb` | tên | K | 1–2k | — |";
  assert.throws(one([row(60, "ENV_a", "env_a.glb", "K"), seven], [sec("K1", "ENV_a", thing("A.")), sec("K2", "ENV_b", thing("B."))]), /ENV_b: có mục PROMPT/);
});
t("dải tam giác: dấu phân cách nghìn, đơn vị lẫn, lo > hi, lo < 300, hi > 30k → lỗi; 0,5–1,5k nhận; 100–300 chỉ nhận ở PROP_mui_ten (đã tạo)", () => {
  for (const bad of ["1,000–2,000", "500–2k", "800–300", "100–200", "100–400", "1–40k"])
    assert.throws(one([row(60, "ENV_a", "env_a.glb", "K", bad)], [sec("K1", "ENV_a", thing("A."))]), /dải tam giác/, bad);
  assert.equal(loadAssets(doc([row(60, "ENV_a", "env_a.glb", "K", "0,5–1,5k")], [sec("K1", "ENV_a", thing("A."))]))[0].tris, 1500);
  assert.throws(one([row(60, "PROP_x", "prop_x.glb", "H", "100–300")], [sec("H9", "PROP_x", thing("Arrow."))]), /dải tam giác/);
  assert.equal(loadAssets(doc([row(60, "PROP_mui_ten", "prop_mui-ten.glb", "H", "100–300")], [sec("H3", "PROP_mui_ten", thing("Arrow."))]))[0].tris, 300);
});
t("dải tam giác: chữ đứng sau số (\"300–600 khối\") không bị đọc thành k (nghìn); \"1–2k tam giác\" vẫn là nghìn", () => {
  const [a] = loadAssets(doc([row(60, "ENV_a", "env_a.glb", "K", "300–600 khối")], [sec("K1", "ENV_a", thing("A."))]));
  assert.deepEqual(a.range, [300, 600]); assert.equal(a.tris, 600);
  assert.deepEqual(loadAssets(doc([row(60, "ENV_a", "env_a.glb", "K", "1–2k tam giác")], [sec("K1", "ENV_a", thing("A."))]))[0].range, [1000, 2000]);
});
t("mục ghi cả Symmetry bật lẫn tắt → lỗi (không lặng lẽ chọn tắt)", () => {
  assert.throws(one([row(60, "ENV_a", "env_a.glb", "K")], [sec("K1", "ENV_a", thing("A."), "Symmetry: bật. Nếu lệch thì thử Symmetry: tắt.")]), /Symmetry/);
});
t("prompt người phải có nguyên khối POSE hoặc POSE v2 (biến thể như \"45 °\" thì bản API dài, giữ cả mouth closed)", () => {
  assert.throws(one([row(60, "H27", "char_H27_x.glb", "A", "10–20k")], [sec("A8", "H27", `King. ${POSE2.replace("45°", "45 °")} ${STYLE}`)]), /POSE/);
});
t("mọi mục trong tài liệu thật: bản API ≤ 600 ký tự (run từ chối bản dài hơn)", () => {
  assert.ok(!all.err && all.length > 0);
  assert.deepEqual(all.filter((a) => apiPrompt(a).length > 600).map((a) => `${a.code} ${apiPrompt(a).length}`), []);
});
t("trâu MOUNT_trau: negative không có chữ horns (prompt xin sừng); ngựa vẫn chặn sừng", () => {
  const tr = all.find((a) => a.code === "MOUNT_trau"), ng = all.find((a) => a.code === "MOUNT_ngua_nguyen");
  assert.ok(tr && !/horns/.test(tr.negative), tr?.negative); assert.match(ng.negative, /horns/);
});

console.log("Chặn mua lại mẫu đã có (run), list --hash");
const gd = tryLoad(doc([row(60, "H35", "char_H35_a.glb", "A", "10–20k"), row(61, "X19", "char_X19_a.glb", "B", "10–20k")], [sec("A1", "H35", person("General.")), sec("B1", "X19", person("Mongol."))]));
t("run: mẫu đã xong (done) mà băm khác manifest → dừng, nêu mã, chỉ --redo", () => {
  const [h35] = gd;
  assert.throws(() => guardRun([h35], { H35: { status: "done", hash: "0000000000" } }), /H35[\s\S]*--redo/);
  assert.deepEqual([...guardRun([h35], { H35: { status: "done", hash: "0000000000" } }, "H35")], ["H35"]);
  assert.equal(guardRun([h35], { H35: { status: "done", hash: hash(h35) } }).size, 0);
  assert.equal(guardRun([h35], { H35: { status: "luoi", hash: "0000000000" } }).size, 0, "mới có lưới thì sửa prompt rồi dựng lại là bình thường");
});
t("run: --redo mã không nằm trong danh sách chạy → dừng (nếu không, mã đó mất khỏi manifest)", () => {
  assert.throws(() => guardRun([gd[0]], {}, "X19"), /X19[\s\S]*không nằm trong/);
});
t("list --hash: hashRows đếm mã có trong manifest và mã giữ băm (khác thì lệnh trả mã lỗi)", () => {
  const [h35, x19] = gd;
  assert.deepEqual((({ same, had }) => ({ same, had }))(hashRows([h35, x19], { H35: { status: "done", hash: hash(h35) } })), { same: 1, had: 1 });
  const r = hashRows([h35, x19], { H35: { status: "done", hash: "0000000000", path: "p" }, X19: { status: "done", hash: hash(x19) } });
  assert.deepEqual([r.same, r.had], [1, 2]); assert.match(r.lines[0], /≠ manifest 0000000000/); assert.match(r.lines[1], /= manifest/);
});
t("--redo: tệp gốc và ảnh lưới cũ cùng băm được đổi tên sang .cu-<giờ> (không xoá), để run tải lại và sheet không hiện lưới cũ", () => {
  const dir = mkdtempSync(join(tmpdir(), "meshy-test-"));
  try {
    const base = "abc-char_H35_a";
    writeFileSync(join(dir, base + ".glb"), "g"); writeFileSync(join(dir, base + "-luoi.png"), "p");
    assert.equal(setAsideRaw(dir, base, "T1"), 2);
    assert.deepEqual(readdirSync(dir).sort(), [base + "-luoi.cu-T1.png", base + ".cu-T1.glb"].sort());
    assert.ok(!existsSync(join(dir, base + ".glb")));
    assert.equal(setAsideRaw(dir, base, "T2"), 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

console.log("Sửa sau soát vòng 2: lưới đã mua, tên tệp, mã _v2, --only, tat-ca, tuỳ chọn");
t("run: lưới đã mua (có preview_id, chưa tô texture) mà băm đổi → dừng, nói rõ lưới đã trả tiền, chỉ --redo", () => {
  const [h35] = gd;
  for (const status of ["luoi", "texture-dang", "loi", "het-credit"])
    assert.throws(() => guardRun([h35], { H35: { status, preview_id: "x", hash: "0123456789" } }), /lưới[\s\S]*H35[\s\S]*--redo/, status);
  assert.deepEqual([...guardRun([h35], { H35: { status: "luoi", preview_id: "x", hash: "0123456789" } }, "H35")], ["H35"]);
  assert.equal(guardRun([h35], { H35: { status: "het-credit", hash: "0123456789" } }).size, 0, "chưa mua lưới (hết credit trước khi gửi) thì dựng theo prompt mới");
});
t("list --hash: dòng lưới đã mua theo băm cũ ghi khác dòng mẫu đã xong, không in đường dẫn; mục chưa mua lưới không tính", () => {
  const [h35, x19] = gd;
  const r = hashRows([h35, x19], { H35: { status: "luoi", preview_id: "x", hash: "0123456789" }, X19: { status: "het-credit", hash: "0123456789" } });
  assert.match(r.lines[0], /≠ manifest 0123456789: lưới đã mua theo băm cũ; run dừng, làm lại thì --redo/);
  assert.ok(!/ghi đè|undefined/.test(r.lines[0]), r.lines[0]);
  assert.match(r.lines[1], /chưa tạo/); assert.deepEqual([r.same, r.had], [0, 1]);
});
t("tên tệp phải là tiền tố + mã + .glb (thiếu .glb thì ảnh lưới ghi đè vào chỗ tệp gốc)", () => {
  for (const f of ["env_qua", "env_qua.png", "env_qua .glb"])
    assert.throws(one([row(60, "ENV_qua", f, "O", "300–600")], [sec("O4", "ENV_qua", thing("Crow."))]), /tên tệp/, f);
});
t("mã _v2: phải có dòng mã gốc, tệp = tệp gốc + _v2, cùng nhóm", () => {
  const base = row(3, "H33", "char_H33_tran-nhat-duat.glb", "A", "10–20k"), bs = sec("A3", "H33", person("General."));
  assert.throws(one([row(60, "H33_v2", "unit_H33_v2.glb", "A", "10–20k"), base], [sec("P1", "H33_v2", person("General.")), bs]), /H33_v2[\s\S]*tệp gốc/);
  assert.throws(one([row(60, "H33x_v2", "char_H33x_v2.glb", "A", "10–20k"), base], [sec("P1", "H33x_v2", person("General.")), bs]), /H33x_v2[\s\S]*không có dòng mã gốc/);
  assert.throws(one([row(60, "H33_v2", "char_H33_tran-nhat-duat_v2.glb", "B", "10–20k"), base], [sec("P1", "H33_v2", person("General.")), bs]), /H33_v2[\s\S]*nhóm/);
  assert.equal(loadAssets(doc([row(60, "H33_v2", "char_H33_tran-nhat-duat_v2.glb", "A", "10–20k"), base], [sec("P1", "H33_v2", person("General.")), bs])).length, 2);
});
t("--only bỏ mã trùng (hai worker cùng mua một mẫu), mã lạ báo lỗi", () => {
  assert.deepEqual(codes(pick(all, { only: "ENV_qua, ENV_qua,MOUNT_trau" })), ["ENV_qua", "MOUNT_trau"]);
  assert.throws(() => pick(all, { only: "ENV_khong_co" }), /ENV_khong_co/);
});
t("run --set tat-ca không gồm LINH_r2 (còn khối POSE cũ); list vẫn gồm; --only LINH_r2 vẫn chạy được", () => {
  assert.ok(!codes(pick(all, { set: "tat-ca", run: true })).includes("LINH_r2"));
  assert.ok(codes(pick(all, { set: "tat-ca" })).includes("LINH_r2"));
  assert.deepEqual(codes(pick(all, { only: "LINH_r2", run: true })), ["LINH_r2"]);
  assert.deepEqual(codes(pick(all, {})), codes(setOf(all, "can")));
  assert.throws(() => pick(all, { set: "khong-co" }), /tuy-chon/);
});
t("đầu mục ghi \"tùy chọn\" (ù + y) cũng là tuỳ chọn", () => {
  const d = doc([row(81, "ENV_thuyen_x", "env_thuyen-x.glb", "K"), row(82, "ENV_long_x", "env_long-x.glb", "K", "3–5k")],
    [sec("K1", "ENV_thuyen_x", thing("Boat.")), sec("K10", "ENV_long_x", thing("Dragon boat.")).replace("tên ENV_long_x", "Long thuyền (tùy chọn)")]);
  assert.deepEqual(codes(setOf(loadAssets(d), "moi-truong")), ["ENV_thuyen_x"]);
});

console.log("Soát vòng 3: đối số, gửi lại, cất tệp, câu báo");
const bad = (argv) => { try { checkArgs(argv); return null; } catch (e) { return e.message; } };
t("checkArgs: --x=y, cờ lạ hay gõ sai, cờ thiếu giá trị (cuối dòng hoặc giá trị là cờ khác), cờ lặp, đối số rời, lệnh lạ → lỗi", () => {
  for (const argv of [["list", "--set=moi-truong"], ["list", "--sett", "x"], ["list", "--only"], ["list", "--only", "--hash"], ["list", "--dry"],
    ["run", "--stage=luoi"], ["run", "--stages", "luoi"], ["run", "--set", "lam-lai", "--model-mt"], ["run", "--model-mt=meshy-5"],
    ["run", "--model-mt", "meshy5"], ["run", "--jobs", "0"], ["run", "--jobs", "ba"], ["run", "--set", "can", "--set", "thieu"], ["run", "moi-truong"],
    ["sheet", "--set", "thieu", "ra.png"], ["sheet", "ra.png", "--cols", "x"], ["post", "--hash"], ["balance", "--set", "can"], ["runn"], ["--set", "can"]])
    assert.ok(bad(argv), `nhận nhầm: ${argv.join(" ")}`);
  assert.match(bad(["list", "--set=moi-truong"]), /--set=moi-truong/); assert.match(bad(["run", "--stages", "luoi"]), /--stages/);
  assert.match(bad(["run", "--set", "lam-lai", "--model-mt"]), /--model-mt/);
});
t("checkArgs: các dạng lệnh trong mục 0.8 và README đều nhận", () => {
  for (const argv of [[], ["list"], ["list", "--set", "tat-ca", "--hash"], ["list", "--only", "ENV_ky_ham_nguyen", "--prompt"], ["balance"],
    ["run", "--set", "thieu", "--stage", "luoi", "--model-linh", "meshy-5", "--model-vk", "meshy-5"], ["run", "--only", "WPN_dadao_v2", "--stage", "luoi", "--model-vk", "meshy-5"],
    ["run", "--only", "A,B", "--redo", "A", "--stage", "luoi", "--model-mt", "latest", "--jobs", "2", "--dry"], ["run", "--model", "meshy-6"],
    ["sheet", "design/glb/_raw/luot4-luoi.png", "--set", "moi-truong", "--cols", "10", "--size", "200"], ["sheet", "--only", "H35"],
    ["post", "--only", "H35"], ["post", "--set", "can"]])
    assert.equal(bad(argv), null, argv.join(" "));
});
t("lệnh list: --set=… , cờ gõ sai, --only thiếu mã → thoát mã 2, không in danh sách", () => {
  for (const argv of [["--set=moi-truong"], ["--sett", "x"], ["--only"]]) {
    const r = spawnSync(process.execPath, [join(here, "meshy.mjs"), "list", ...argv], { cwd: ROOT, encoding: "utf8", env: { ...process.env, MESHY_API_KEY: "", MESHY_API_KEY_FILE: "" } });
    assert.equal(r.status, 2, argv.join(" ")); assert.equal(r.stdout.trim(), "", argv.join(" "));
  }
});
t("shouldRetry: GET gửi lại khi lỗi mạng, 429, 5xx; POST (lưới, texture, có trả tiền) chỉ gửi lại khi 429", () => {
  assert.equal(typeof shouldRetry, "function");
  for (const s of [undefined, 429, 500, 503]) assert.equal(shouldRetry("GET", s), true, `GET ${s}`);
  assert.equal(shouldRetry("GET", 404), false); assert.equal(shouldRetry("POST", 429), true);
  for (const s of [undefined, 500, 502, 400]) assert.equal(shouldRetry("POST", s), false, `POST ${s}`);
});
t("run --redo: cất tệp cũ trong _raw/ chỉ sau khi đọc được credit (balance lỗi thì manifest và tệp vẫn khớp)", () => {
  const src = readFileSync(join(here, "meshy.mjs"), "utf8"), m = src.slice(src.indexOf("async function main("));
  const b = m.indexOf("let left = await balance()"), s = m.indexOf("setAsideRaw(RAW");
  assert.ok(b > 0 && s > 0, "không thấy let left = await balance() hay setAsideRaw trong main()"); assert.ok(s > b, "setAsideRaw chạy trước balance() của run");
});
t("chặn mua lại: mã đã mua cả texture (refine_id) mà băm đổi → câu báo nói lưới và texture, không nói \"chưa tô texture\"", () => {
  const [h35] = gd, m = { H35: { status: "loi", preview_id: "x", refine_id: "y", hash: "0123456789" } };
  assert.throws(() => guardRun([h35], m), (e) => /lưới và texture/.test(e.message) && !/chưa tô texture/.test(e.message));
  assert.match(hashRows([h35], m).lines[0], /lưới và texture đã mua theo băm cũ/);
});
t("mọi mục chưa tạo ghi Symmetry rõ (không còn auto); LINH_r2 bật như áo LINH_r24", () => {
  assert.deepEqual(all.filter((a) => !man[a.code] && a.sym === "auto").map((a) => a.code), []);
  assert.equal(all.find((a) => a.code === "LINH_r2").sym, "on");
});

console.log("Tài liệu thật: môi trường K–O, thú, nón lá");
const env = all.err ? [] : all.filter((a) => /^[K-O]/.test(a.sec));
const bodies = md.replace(/\r\n/g, "\n").normalize("NFC").split("\n### ").filter((s) => /^[K-O]\d+ · /.test(s)).map((s) => s.split("\n## ")[0]);
t("mỗi mục K, L, M, N, O có mục; bộ moi-truong không rỗng, mọi mã ENV_ nằm ở K–O", () => {
  for (const L of "KLMNO") assert.ok(env.some((a) => a.sec[0] === L), `mục ${L} trống`);
  const mt = setOf(all, "moi-truong");
  assert.ok(mt.length > 0); assert.deepEqual(mt.filter((a) => !/^[K-O]/.test(a.sec)).map((a) => a.code), []);
});
t("mọi mục K–O: prompt tài liệu ≤ 630, bản API ≤ 600, kết thúc bằng STYLE, có \"Isolated single object\"", () => {
  assert.ok(env.length > 0);
  const bad = env.filter((a) => a.prompt.length > 630 || apiPrompt(a).length > 600 || !a.prompt.endsWith(STYLE) || !/isolated single object/i.test(a.prompt));
  assert.deepEqual(bad.map((a) => `${a.code} ${a.prompt.length}/${apiPrompt(a).length}`), []);
});
t("mọi mục K–O: dải tam giác từ 300 trở lên, tam giác mục tiêu nằm trong dải", () => {
  assert.ok(env.length > 0);
  assert.deepEqual(env.filter((a) => a.range[0] < 300 || a.range[0] > a.range[1] || a.tris < a.range[0] || a.tris > a.range[1]).map((a) => a.code), []);
});
t("mọi mục K–O ghi kích thước thật (m, cm) trong prompt", () => {
  assert.ok(env.length > 0);
  assert.deepEqual(env.filter((a) => !/\d+(\.\d+)?\s?c?m\b/.test(a.prompt)).map((a) => a.code), []);
});
t("không mục K–O nào xin chữ: text, letters, writing chỉ đi sau \"no\" (cờ, chữ, bia do code vẽ)", () => {
  assert.ok(env.length > 0);
  const asks = (p) => /\b(text|letters?|lettering|writing|calligraphy|inscriptions?)\b/i.test(p.replace(/\bno (text|letters|lettering|writing|calligraphy|inscriptions?)\b/gi, ""));
  assert.deepEqual(env.filter((a) => asks(a.prompt)).map((a) => a.code), []);
});
t("thuyền (mục K) ghi no water, no people; công trình (mục L) ghi no people", () => {
  assert.ok(env.length > 0);
  const bad = env.filter((a) => (a.sec[0] === "K" && !/no water/i.test(a.prompt)) || (/^[KL]/.test(a.sec) && !/no people/i.test(a.prompt)));
  assert.deepEqual(bad.map((a) => a.code), []);
});
t("mỗi mục K–O dẫn chỗ game dùng (tệp:dòng), trừ mục tuỳ chọn chưa có trong game", () => {
  assert.ok(bodies.length > 0);
  const bad = bodies.filter((b) => !/(tuỳ|tùy)\s*chọn/.test(b.split("\n")[0]) && !/`[\w./-]+\.(js|mjs|json|md):\d+/.test(b)).map((b) => b.split("\n")[0]);
  assert.deepEqual(bad, []);
});
t("nón lá rời PROP_non_la: mục H, prop_non-la.glb, 84 cm × 22 cm như models.js", () => {
  const a = all.find((x) => x.code === "PROP_non_la");
  assert.ok(a, "chưa có PROP_non_la"); assert.equal(a.sec[0], "H"); assert.equal(a.file, "prop_non-la.glb"); assert.equal(a.kind, "dao-cu");
  assert.match(a.prompt, /84 cm/); assert.match(a.prompt, /22 cm/);
});
t("trâu MOUNT_trau ở mục O, đối xứng bật; cò, quạ ở mục O; bộ thieu gồm cả mục O", () => {
  const a = all.find((x) => x.code === "MOUNT_trau");
  assert.ok(a, "chưa có MOUNT_trau"); assert.equal(a.sec[0], "O"); assert.equal(a.sym, "on"); assert.equal(a.kind, "thu-cuoi");
  const o = env.filter((x) => x.sec[0] === "O").map((x) => x.code), th = codes(setOf(all, "thieu"));
  assert.ok(o.length >= 3, o.join(" ")); for (const c of o) assert.ok(th.includes(c), c);
});

console.log("Tài liệu thật: làm lại (mục P), tướng mới, mục 0.8 còn phải tạo");
const P_CODES = ["H33_v2", "X19_v2", "OFF_photuong_v2", "X20_v2", "DV_DAO_v2", "DV_GIAO_v2", "DV_NO_v2", "LINH_r01_v2", "CV_giao_v2", "CV_cung_v2",
  "CV_songdao_v2", "WPN_giao_dv_v2", "WPN_dadao_v2", "OFF_doitruong_v2", "OFF_tuong_v2"];
const NEW_GEN = ["H27", "H28", "H29", "H30", "H32", "H36", "H37", "TT", "X16", "X17", "X18", "X21", "X22", "X23", "X25"];
const get = (c) => all.find((x) => x.code === c) || { code: c, prompt: "", missing: true };
const missing = (list) => list.filter((c) => get(c).missing);
t("mục P: đủ 15 mã làm lại; tệp _v2 cạnh tệp gốc, cùng nhóm, dải tam giác, thư mục với mã gốc đã tạo; bộ lam-lai đúng 15 mã", () => {
  assert.deepEqual(missing(P_CODES), []);
  for (const c of P_CODES) {
    const a = get(c), b = get(c.replace(/_v2$/, ""));
    assert.equal(a.sec[0], "P", c); assert.ok(man[b.code], `${b.code} chưa có trong manifest`);
    assert.equal(a.file, b.file.replace(/\.glb$/, "_v2.glb"), c); assert.equal(a.group, b.group, c); assert.equal(a.kind, b.kind, c);
    assert.deepEqual(a.range, b.range, c);
  }
  assert.deepEqual(codes(setOf(all, "lam-lai")).sort(), [...P_CODES].sort());
});
t("mục P: người viết bằng POSE v2, tài liệu ≤ 565, API ≤ 600 kể cả câu chặn; vũ khí ≤ 550 / ≤ 600, vật đứng một mình", () => {
  assert.deepEqual(missing(P_CODES), []);
  const bad = P_CODES.map(get).filter((a) => a.person
    ? !a.prompt.includes(POSE2) || a.prompt.includes(POSE) || a.prompt.length > 565 || apiPrompt(a).length > 600 || !/Unarmed:/.test(apiPrompt(a))
    : a.prompt.length > 550 || apiPrompt(a).length > 600 || !a.prompt.endsWith(STYLE) || !/isolated single object/i.test(a.prompt));
  assert.deepEqual(bad.map((a) => `${a.code} ${a.prompt.length}/${apiPrompt(a).length}`), []);
});
t("mục P sửa đúng chỗ lệch: mũ không sừng, mũ lông trống, đầu trần khăn đỏ, đầu trần khăn then (nón gộp khi nướng), giáo một lưỡi, lưỡi đại đao thẳng cán", () => {
  assert.deepEqual(missing(P_CODES), []);
  const p = (c) => get(c).prompt, bad = [];
  const want = (c, ok, why) => { if (!ok) bad.push(`${c}: ${why}`); };
  // một chi tiết cứng, đếm được trên đỉnh mũ (chóp nón ngắn); tua, chùm lông code dựng (mục 0.3); không chữ drum (ra mặt trống da, đinh)
  want("H33_v2", /bowl/i.test(p("H33_v2")) && /one short vermilion cone on the top centre/.test(p("H33_v2")) && !/spike|horn|crest|tassel/i.test(p("H33_v2")), "mũ bát vàng, một chóp son ngắn như mutuong, không tua");
  want("X19_v2", /cylindrical brown fur hat/i.test(p("X19_v2")) && /gold cone/i.test(p("X19_v2")) && !/spike|drum/i.test(p("X19_v2")), "mũ lông trụ thẳng, một chóp vàng ngắn");
  want("OFF_photuong_v2", /cylindrical brown fur hat/i.test(p("OFF_photuong_v2")) && /silver-grey cone/i.test(p("OFF_photuong_v2")) && !/spike|crown|crest|drum/i.test(p("OFF_photuong_v2")), "mũ lông trụ thẳng, chóp xám bạc, không mào");
  want("X20_v2", /cylindrical brown fur hat/i.test(p("X20_v2")) && /one short gold cone on the top centre/.test(p("X20_v2")) && !/spike|plume|drum/i.test(p("X20_v2")) && /heavy/i.test(p("X20_v2")) && /pauldrons|shoulder plates/i.test(p("X20_v2")), "mũ lông, một chóp vàng, không chùm lông (code dựng), giáp nặng");
  for (const c of ["DV_DAO_v2", "LINH_r01_v2", "CV_giao_v2", "CV_cung_v2", "CV_songdao_v2"])
    want(c, !/\b(hat|helmet|cap)\b/i.test(p(c)) && /bare head/i.test(p(c)) && /red (cloth )?(head)?band|vermilion cloth band/i.test(p(c)) && apiPrompt(get(c)).includes("No helmet."), "đầu trần buộc khăn đỏ (nón lá gắn bằng code)");
  // Meshy chưa dựng được nón lá vành rộng lần nào (6/6): thân đầu trần, nón gộp vào bộ lính khi nướng (mục P)
  for (const c of ["DV_GIAO_v2", "DV_NO_v2"])
    want(c, /bare head/i.test(p(c)) && /black cloth band/i.test(p(c)) && !/\b(hat|helmet|cap|non la)\b/i.test(p(c)) && apiPrompt(get(c)).includes("No helmet."), "đầu trần khăn then, không xin nón");
  for (const c of ["CV_giao_v2", "CV_songdao_v2"]) want(c, /smooth-shaven/i.test(p(c)), "mặt trẻ cạo nhẵn (bản cũ ra râu, tóc bạc)");
  want("WPN_giao_dv_v2", /\bone flat leaf-shaped\b/i.test(p("WPN_giao_dv_v2")) && !/four-sided/i.test(p("WPN_giao_dv_v2")), "một lưỡi lá dẹt");
  want("WPN_dadao_v2", /one straight line/i.test(p("WPN_dadao_v2")), "lưỡi và cán thẳng hàng");
  want("OFF_doitruong_v2", /onion-shaped/i.test(p("OFF_doitruong_v2")) && /scale cuirass/i.test(p("OFF_doitruong_v2")), "giữ mũ và giáp vảy của FIX đã dựng đúng");
  // bản cũ: tay buông dính vạt áo, ống tay rộng — rig không tách được tay (game giữ bản nướng 35beed2)
  want("OFF_tuong_v2", /close-fitting sleeves/i.test(p("OFF_tuong_v2")) && /hanging straight/i.test(p("OFF_tuong_v2")) && /one short gold cone on the top centre/.test(p("OFF_tuong_v2"))
    && !/spike|drum/i.test(p("OFF_tuong_v2")), "ống tay bó, vạt áo buông thẳng, một chóp vàng ngắn");
  assert.deepEqual(bad, []);
});
t("mục P: đồ lệch một bên giữ Symmetry tắt (DV_NO_v2, CV_cung_v2, WPN_dadao_v2); áo cân hai bên bật", () => {
  assert.deepEqual(missing(P_CODES), []);
  assert.deepEqual(["DV_NO_v2", "CV_cung_v2", "WPN_dadao_v2"].filter((c) => get(c).sym !== "off"), []);
  assert.deepEqual(["H33_v2", "X19_v2", "OFF_photuong_v2", "X20_v2", "DV_DAO_v2", "DV_GIAO_v2", "LINH_r01_v2", "CV_giao_v2", "CV_songdao_v2", "OFF_doitruong_v2", "OFF_tuong_v2"]
    .filter((c) => get(c).sym !== "on"), []);
});
t("15 tướng mới (design/3d-ref/PROMPTS-TUONG.md): mục A/B, tệp char_<mã>_<tên>.glb, 10–20k, POSE v2, tài liệu ≤ 565, API ≤ 600, chưa có trong manifest", () => {
  assert.deepEqual(missing(NEW_GEN), []);
  const bad = NEW_GEN.map(get).filter((a) => !/^[AB]\d+$/.test(a.sec) || !new RegExp(`^char_${a.code}_[a-z-]+\\.glb$`).test(a.file) || a.range[0] !== 10000 || a.range[1] !== 20000
    || !a.prompt.includes(POSE2) || a.prompt.length > 565 || apiPrompt(a).length > 600 || man[a.code] || a.kind !== "nhan-vat");
  assert.deepEqual(bad.map((a) => `${a.code} ${a.sec} ${a.file} ${a.prompt.length}/${apiPrompt(a).length}`), []);
});
t("tướng mới tay không: prompt không xin binh khí, khiên, cờ, quạt, bút (binh khí là tệp riêng)", () => {
  assert.deepEqual(missing(NEW_GEN), []);
  const arms = /\b(holding|held|sword|saber|spear|lance|halberd|glaive|bow|shield|banner|flag|fan|brush|drum)\b/i;
  assert.deepEqual(NEW_GEN.filter((c) => arms.test(get(c).prompt)), []);
});
t("tuong-moi = H34, H38, H39 và 15 tướng mới; mọi mục người chưa tạo viết bằng POSE v2 (trừ LINH_r2 dựng từ prompt LINH_r24 đã tạo)", () => {
  assert.deepEqual(codes(setOf(all, "tuong-moi")).sort(), ["H34", "H38", "H39", ...NEW_GEN].sort());
  const old = all.filter((a) => a.person && !man[a.code] && a.code !== "LINH_r2" && !a.prompt.includes(POSE2));
  assert.deepEqual(old.map((a) => a.code), []);
});
t("mục 0.8 Còn phải tạo: trước bảng mục 1; có lệnh run --stage luoi, sheet, run tô texture; credit từng đợt; bộ thieu, moi-truong, lam-lai, tuong-moi", () => {
  const s = md.replace(/\r\n/g, "\n"), i = s.indexOf("\n### 0.8 "), j = s.indexOf("\n## 1. ");
  assert.ok(i > 0 && i < j, "thiếu mục 0.8 trước mục 1");
  const s08 = s.slice(i, j);
  for (const w of ["--stage luoi", "meshy.mjs sheet", "credit", "--set thieu", "--set moi-truong", "--set lam-lai", "--set tuong-moi", "--set tuy-chon"]) assert.ok(s08.includes(w), w);
  assert.ok(/run --set lam-lai(?! --stage)/.test(s08), "thiếu lệnh tô texture (run không có --stage)");
  for (let i = 1; i <= 6; i++) assert.ok(s08.includes(`# Lượt ${i}`), `thiếu lệnh lượt ${i}`);
  assert.ok(!/# Đợt \d/.test(s08), "lượt tạo trong 0.8 không gọi là đợt (trùng chữ đợt của mục 0.4 và đợt 19)");
});

console.log("Tài liệu thật: sửa sau soát (đợt 19b)");
const P = (c) => get(c).prompt;
t("thuyền K1–K6: prompt ghi chiều cao boong, lầu, cột để giữ tỉ lệ boong đi được của HULLS (Meshy chỉ giữ tỉ lệ)", () => {
  const want = { ENV_chien_thuyen_nguyen: ["2.6 m", "14.5 m"], ENV_ky_ham_nguyen: ["3 m", "6 m"], ENV_thuyen_ho_ve: ["1.8 m", "3.3 m"], ENV_thuyen_do_luong: ["0.8 m", "5.4 m"],
    ENV_thuyen_chien_tran: ["0.7 m"], ENV_thuyen_tong: ["6 m"] };
  const bad = Object.entries(want).flatMap(([c, ws]) => ws.filter((w) => !P(c).includes(w)).map((w) => `${c} thiếu ${w}`));
  assert.deepEqual(bad, []);
});
t("thuyền: không nhắc cán cờ, kể cả để cấm (cán cờ code giữ, đặt đúng flagAt); thuyền có cột tả đỉnh cột trơn; K8, K9 tắt đối xứng", () => {
  const ships = ["ENV_chien_thuyen_nguyen", "ENV_ky_ham_nguyen", "ENV_thuyen_ho_ve", "ENV_thuyen_do_luong", "ENV_thuyen_chien_tran"];
  assert.deepEqual(ships.filter((c) => /flagpole/i.test(P(c))), []);
  assert.deepEqual(ships.slice(0, 4).filter((c) => !/bare mast tops?/i.test(P(c))), []);
  assert.deepEqual(["ENV_thuyen_mui", "ENV_thung_cau"].filter((c) => get(c).sym !== "off"), []);
});
t("tướng mới không có chữ kéo về vương miện, áo rồng, cầm cung hay dáng thủ lĩnh man rợ; H28 không giáp buộc dây kiểu samurai", () => {
  assert.deepEqual(NEW_GEN.filter((c) => /\b(emperor|imperial|prince|archer|veteran|brocade)\b/i.test(P(c))), []);
  assert.ok(!/lacing/i.test(P("H28")));
});
t("mũ lông X19_v2, OFF_photuong_v2: một chóp ngắn ở chính giữa như mũ code, không quả cầu (núm mũ quan nhà Thanh)", () => {
  assert.match(P("X19_v2"), /one short gold cone on the top centre/); assert.match(P("OFF_photuong_v2"), /one short silver-grey cone on the top centre/);
  assert.ok(!/ball/.test(P("X19_v2") + P("OFF_photuong_v2")));
});
t("tường, cổng Hàm Tử ghi Việt, không merlon kiểu thành châu Âu; xe lương bánh nan; trống trận giá 1,1 m không dùi", () => {
  assert.match(P("ENV_tuong_dat"), /Vietnamese/); assert.ok(!/merlon/i.test(P("ENV_tuong_dat"))); assert.match(P("ENV_cong_ham_tu"), /Vietnamese/);
  for (const c of ["ENV_xe_luong", "ENV_xe_luong_vo"]) { assert.match(P(c), /spoked/, c); assert.ok(!/solid plank wheel/.test(P(c)), c); }
  assert.match(P("ENV_trong_tran"), /1\.1 m tall two-post/); assert.ok(!/drumstick/.test(P("ENV_trong_tran")));
});
t("cây không có chữ nghề \"leaf cards\", xin không đế; không dùng \"hôm nay\" (viết \"hiện nay\", \"nay\")", () => {
  assert.deepEqual(env.filter((a) => /leaf cards/.test(a.prompt)).map((a) => a.code), []);
  assert.deepEqual(env.filter((a) => a.sec[0] === "N" && /tree|bamboo|palm|banana|grove/i.test(a.prompt) && !/no ground base/.test(a.prompt)).map((a) => a.code), []);
  assert.ok(!md.includes("hôm nay"));
});

console.log("Tài liệu thật: sửa sau soát vòng 2 (đợt 19b)");
const mdN = md.replace(/\r\n/g, "\n").normalize("NFC");
const body = (c) => { const s = mdN.split("\n### ").find((b) => b.split("\n")[0].includes(` · ${c} · `)); return s ? s.split("\n## ")[0] : ""; };
const tableRow = (c) => mdN.split("\n").find((l) => l.includes(`| ${c} |`)) || "";
const tech = (c) => (body(c).match(/\n- \*\*Kỹ thuật\*\*:[^\n]*/) || [""])[0];
t("trần trong game của vật lặp = số tam giác code đo trên bản gốc (B20 120.730, B15, Võ trường); cao hơn chỉ khi có LOD gần, xa", () => {
  const want = { ENV_lum_cay_ven_song: ["≤ 80"], ENV_duoc: ["≤ 96"], ENV_lau_say: ["≤ 12", "≤ 24"], ENV_coc_bach_dang: ["≤ 25"], ENV_coc_gay: ["≤ 29"],
    ENV_da_a: ["≤ 20", "≤ 36"], ENV_da_b: ["≤ 20", "≤ 36"], ENV_da_c: ["≤ 20", "≤ 36"], ENV_nui_da_a: ["≤ 233"], ENV_nui_da_b: ["≤ 464"], ENV_nui_da_c: ["≤ 269"],
    ENV_cay_tan_tron: ["≤ 60", "≤ 40"], ENV_cay_gao: ["≤ 60"], ENV_khom_chuoi: ["≤ 80"], ENV_cum_cau: ["2.760"], ENV_be_co: ["≤ 390"], ENV_go_chan_song: ["≤ 70"],
    ENV_phao_moc: ["≤ 62"], ENV_tuong_dat: ["≤ 60"], ENV_cu_ma: ["≤ 150"], ENV_cau_tau_nhip: ["≤ 67"], ENV_cau_tau_dau: ["≤ 426"], ENV_choi_tranh: ["≤ 116"],
    ENV_gia_cheo: ["≤ 84"], ENV_thung_cau: ["≤ 32"], ENV_thap_canh_tran: ["≤ 560"], ENV_nha_bat_chi_huy: ["≤ 300"], ENV_leu_tran: ["≤ 20"], ENV_trong_tran: ["≤ 152"],
    ENV_gia_binh_khi: ["≤ 156"], ENV_hom_go: ["≤ 24"], ENV_toi_neo: ["≤ 172"] };
  const bad = Object.entries(want).flatMap(([c, ws]) => ws.filter((w) => !tech(c).includes(w)).map((w) => `${c} thiếu "${w}"`));
  assert.deepEqual(bad, []);
  const K = body("ENV_chien_thuyen_nguyen").length ? mdN.split("\n## K. ")[1].split("\n### K1 ")[0] : "";
  for (const w of ["120.730", "8.553", "LOD", "không được tăng", "scene-tris.mjs"]) assert.ok(K.includes(w), `đầu mục K thiếu ${w}`);
  const s08 = mdN.slice(mdN.indexOf("\n### 0.8 "), mdN.indexOf("\n## 1. "));
  assert.ok((s08.match(/scene-tris\.mjs/g) || []).length >= 2, "lượt 2 và 4 phải đếm tam giác cảnh trước và sau");
  assert.ok(existsSync(join(ROOT, "design/tools/scene-tris.mjs")), "thiếu design/tools/scene-tris.mjs");
});
t("chông M9 Ø 3,2 m như code (0,66 × bán kính hố), prompt không dùng chữ Punji", () => {
  assert.match(tableRow("ENV_ho_chong"), /\| Ø 3,2 m/); assert.match(P("ENV_ho_chong"), /3\.2 m wide/); assert.match(P("ENV_ho_chong"), /^Bamboo spike trap/); assert.ok(!/punji/i.test(md));
});
t("K1, K2 ghi lầu và cột theo code (lầu một phần tư / một phần ba sau, nóc 5,2 m, cột 10 / 6,5 / 19 m)", () => {
  for (const w of ["aft quarter", "5.2 m", "10 m", "6.5 m", "14.5 m"]) assert.ok(P("ENV_chien_thuyen_nguyen").includes(w), `K1 thiếu ${w}`);
  for (const w of ["aft third", "19 m", "6 m"]) assert.ok(P("ENV_ky_ham_nguyen").includes(w), `K2 thiếu ${w}`);
  assert.match(mdN.split("\n## K. ")[1].split("\n### K1 ")[0], /0,26[\s\S]*0,33/);
});
t("bè M3 bảy cây tre trải đều bề rộng 6 m; cò O2 cao khoảng 1 m; phao M32 đuôi nheo 1,6 m", () => {
  assert.match(P("ENV_be_co"), /spaced evenly across the 6 m width/); assert.match(P("ENV_co_dung"), /about 1 m tall/); assert.match(tableRow("ENV_co_dung"), /\| cao 1,05 m/);
  assert.match(P("ENV_phao_moc"), /1\.6 m long/);
});
t("góc nghiêng cọc lũy M6, M8 tính từ phương thẳng đứng; ụ chắn tường L3 ở giữa mặt tường; lều Võ trường ghi hệ số", () => {
  assert.match(P("ENV_coc_luy_nguyen"), /20 degrees from vertical/); assert.match(P("ENV_coc_tre_tran"), /35 degrees from vertical/);
  assert.match(P("ENV_tuong_dat"), /along the middle of the top/); assert.match(body("ENV_leu_tran"), /1,45[\s\S]*2,2[\s\S]*1,33/);
});
t("rào L4 ở B20, Võ trường đặt từng cọc theo chỗ code (0,8 m, 1,34 m); lều L8 không viền chàm (trại đổi chủ)", () => {
  assert.match(body("ENV_rao_coc"), /0,8 m/); assert.match(body("ENV_rao_coc"), /1,34 m/); assert.ok(!/indigo/i.test(P("ENV_leu_vuong_nguyen")));
});
t("thúng K9 màu dầu rái ghi đề xuất và có trong bảng 2.5; vật code không mục riêng gồm ván, xích, cầu lên thuyền, mây, cán cờ B20", () => {
  assert.match(body("ENV_thung_cau"), /\(đề xuất\)/); assert.match(mdN.split("### 2.5 ")[1].split("### 2.6 ")[0], /thúng/);
  const M = mdN.split("\n## M. ")[1].split("\n| # |")[0];
  for (const w of ["naval.js", "xích", "Mây", "scenery-b20.js:499"]) assert.ok(M.includes(w), `đầu mục M thiếu ${w}`);
});
t("xe lương vỡ M19 nghiêng khoảng 15°, giữ càng; cổng L1 mái ngói đất nung nâu sẫm; DV_NO_v2 không chữ padded", () => {
  assert.ok(!/on its side|snapped/.test(P("ENV_xe_luong_vo"))); assert.match(P("ENV_xe_luong_vo"), /15 degrees/); assert.match(P("ENV_xe_luong_vo"), /intact central draw pole/);
  assert.match(P("ENV_cong_ham_tu"), /dark brown terracotta tile roof/); assert.ok(!/grey tile/.test(P("ENV_cong_ham_tu")));
  assert.ok(!/padded/i.test(P("DV_NO_v2")));
});
t("tướng mới: mũ không chữ kéo về vương miện, mũ cánh chuồn, mào (gold ornament, chancellor, tassel, spike, plume)", () => {
  assert.deepEqual(NEW_GEN.filter((c) => /gold ornament|chancellor|scholarly|poet|tassel|\bspike|plume/i.test(P(c))), []);
  for (const c of ["H27", "H30"]) assert.match(P(c), /gold pin/, c);
});
t("Symmetry ghi rõ ở H34, H39, dân làng (bật) và quang gánh, ống tên rời (tắt)", () => {
  assert.deepEqual(["H34", "H39", "DAN_NAM", "DAN_NU", "DAN_TRE", "PROP_tay_nai"].filter((c) => get(c).sym !== "on"), []);
  assert.deepEqual(["PROP_quang_ganh", "PROP_ong_ten"].filter((c) => get(c).sym !== "off"), []);
});
t("POSE v2 (ngón khép) được miễn ở mục 0.3, 0.7 và danh sách kiểm tra; đầu mục K theo thứ tự lượt của 0.8", () => {
  for (const l of mdN.split("\n").filter((l) => /ngón hơi xoè|Ngón tay rời nhau/.test(l) && !l.startsWith("A-pose") && !l.includes("Character turnaround"))) assert.match(l, /POSE v2/, l);
  assert.ok(!mdN.includes("Nên chạy `run --set moi-truong --stage luoi` trước"));
  assert.ok(!/finial/.test(body("X18"))); assert.ok(!mdN.includes("N10, ("));
});

console.log("Tài liệu thật: sửa sau soát vòng 3 (đợt 19b)");
const Khead = mdN.includes("\n## K. ") ? mdN.split("\n## K. ")[1].split("\n### K1 ")[0] : "";
const Mhead = mdN.includes("\n## M. ") ? mdN.split("\n## M. ")[1].split("\n| # |")[0] : "";
const s08v3 = mdN.slice(mdN.indexOf("\n### 0.8 "), mdN.indexOf("\n## 1. "));
const luot = (n) => (s08v3.split("```bash")[1] || "").split("\n# Lượt ").find((b) => b.startsWith(`${n}.`) || b.startsWith(`${n}\n`) || b.startsWith(`${n} `)) || "";
t("K3 thuyền hộ vệ: lầu một phần tư sau, nóc 3,3 m tính từ mớn nước, cột chính 10 m giữa thân, cột mũi 6,5 m; đo ở lượt thử, giữ texture", () => {
  for (const w of ["aft quarter", "3.3 m above the waterline", "10 m above the deck", "6.5 m foremast near the bow"]) assert.ok(P("ENV_thuyen_ho_ve").includes(w), `K3 thiếu ${w}`);
  for (const w of ["0,11", "0,27", "0,21", "+5,6", "0,167", "0,56", "−13,7", "11,1"]) assert.ok(Khead.includes(w), `đầu mục K thiếu ${w}`);
  assert.match(Khead, /giữ texture: [^\n.]*thuyền hộ vệ/);
  assert.match(luot(3), /ENV_thuyen_ho_ve/); assert.match(tableRow("ENV_thuyen_ho_ve"), /0,27 thân/);
});
t("K2 kỳ hạm: mặt lầu 6 m tính từ mớn nước, cầu thang dài từ giữa thân, đình ở cuối mặt lầu, nóc đình 11 m trên mớn nước; thân nâu sương gió, đầu đao cong nhẹ", () => {
  const p = P("ENV_ky_ham_nguyen");
  for (const w of ["6 m above the waterline", "long central stair", "rear of the terrace", "11 m above the waterline", "gently curved eaves", "Weathered brown hull"]) assert.ok(p.includes(w), `K2 thiếu ${w}`);
  assert.ok(!/upturned|Dark brown hull/.test(p));
});
t("M9 chông: mẫu chỉ có chông; hai tấm phên (một vắt miệng hố, một nằm ngoài hố) giữ code", () => {
  assert.ok(!/\bmat\b/i.test(P("ENV_ho_chong"))); assert.match(body("ENV_ho_chong"), /hai tấm phên[^\n]*giữ code/);
});
t("L11 lều Võ trường: 14 lều; chóp code co trước khi xoay nên đáy là hình thoi 6,4 × 9,6 m, mẫu cố ý nướng thành chữ nhật 4,5 × 6,8 m", () => {
  const b = body("ENV_leu_tran");
  assert.ok(!/16 lều/.test(b)); assert.match(b, /14 lều/); assert.match(b, /hình thoi/); assert.match(b, /6,4 × 9,6/); assert.match(b, /chữ nhật 4,5 × 6,8/);
});
t("lưới trắng nhuộm bằng màu instance (đá, lau B20, khiên rơi): bước nướng ghi màu đỉnh gần trắng; mỗi InstancedMesh khiên một mẫu", () => {
  for (const c of ["ENV_lau_say", "ENV_da_a", "ENV_da_b", "ENV_da_c"]) assert.match(tech(c), /gần trắng/, c);
  assert.match(Mhead, /khiên rơi[^\n]*gần trắng/); assert.match(Mhead, /mỗi InstancedMesh một mẫu khiên/);
});
t("bảng 2.5: hàng đồng #7a5a2a chỉ cho vạc lửa; trống đồng có hàng riêng ghi màu code #6a5a3a", () => {
  const T = mdN.split("### 2.5 ")[1].split("### 2.6 ")[0], dong = T.split("\n").find((l) => l.includes("`#7a5a2a`")) || "";
  assert.ok(dong && !/trống/.test(dong), dong); assert.match(T, /trống đồng[^\n]*#6a5a3a/);
});
t("L17 đầu bến là tấm sàn chữ nhật, không kèm lối cầu (lối cầu là L16)", () => {
  assert.match(P("ENV_cau_tau_dau"), /^Rectangular pier-head platform 6 m wide and 4 m deep/); assert.ok(!/T-shaped wooden pier head/.test(P("ENV_cau_tau_dau")));
});
t("vật code không mục riêng gồm phên đan kè, cọc chân kè, cọc và ván dưới hào, cục đất lở, vạch bắn Võ trường", () => {
  for (const w of ["phên đan kè", "cọc chân kè", "dưới hào", "cục đất lở", "vạch bắn"]) assert.ok(Mhead.includes(w), w);
});
t("P13 đại đao: tả lưỡi trước cán; ghi đúng lịch sử model; lượt 2 dựng lưới đại đao bằng meshy-5 trước", () => {
  assert.match(P("WPN_dadao_v2"), /^One big curved single-edged grey steel glaive blade/);
  assert.ok(!/meshy-5 từng mất lưỡi/.test(mdN)); assert.match(body("WPN_dadao_v2"), /latest[^\n.]*cây gậy/);
  assert.match(luot(2), /run --only WPN_dadao_v2 --stage luoi --model-vk meshy-5/);
});
t("thứ tự lượt: lượt 2 làm lại (chỉ cần lượt 1), lượt 3 mười mục môi trường thử, lượt 4 phần còn lại", () => {
  assert.match(luot(2), /--set lam-lai/); assert.ok(!/ENV_/.test(luot(2)));
  assert.match(luot(3), /ENV_ky_ham_nguyen/); assert.equal((luot(3).match(/--only (\S+) --stage luoi/) || ["", ""])[1].split(",").length, 10);
  assert.match(luot(4), /--set moi-truong/);
  assert.match(s08v3, /\| 2 \| `lam-lai`/); assert.match(s08v3, /\| 3 \| 10 mục môi trường thử/);
});
t("DAN_NAM mở câu đầu bằng Bare head; lượt 1 dựng lưới DAN_NAM bằng latest cùng DV_AOTONG", () => {
  assert.match(P("DAN_NAM"), /Bare head: black hair bun/); assert.match(luot(1), /run --only DV_AOTONG,DAN_NAM --stage luoi/);
});
t("không nhắc vật chỉ để cấm khi câu tả đã đủ: mũ sắt cọc, tượng miếu, ngói nhà bạt, cửa cổng", () => {
  assert.ok(!/iron cap/.test(P("ENV_coc_bach_dang"))); assert.match(P("ENV_coc_bach_dang"), /bare wooden four-sided point/);
  assert.ok(!/statue/i.test(P("ENV_mieu"))); assert.match(P("ENV_mieu"), /bare plain stone altar table/);
  assert.ok(!/tiles/i.test(P("ENV_nha_bat_chi_huy"))); assert.ok(!/no doors/.test(P("ENV_cong_ham_tu")));
});
t("đạo cụ, công trình không phải địa hình: không tả mặt đất, có no ground", () => {
  const c8 = ["ENV_ho_chong", "ENV_trong_tran", "ENV_xe_luong_vo", "ENV_bia_rom", "ENV_xac_ngua", "ENV_leu_tran", "ENV_khan_dai", "ENV_dai_chi_huy",
    "ENV_leu_tron", "ENV_leu_vuong_nguyen", "ENV_leu_luong", "ENV_khung_leu_chay", "ENV_trong_dong", "ENV_bia_da"]; // mọi lều, trống, bia (đầu mục K)
  assert.deepEqual(c8.filter((c) => !/no ground/.test(P(c)) || /on the ground|above the ground|reaching the ground|training ground/.test(P(c))), []);
});
t("chữ màu, chất liệu lệch thời (mục chưa tạo): không brass, khaki, turban, canvas, sampan, light black; trống đồng 14 cánh như Ngọc Lũ; K8 tên thuyền mui", () => {
  assert.deepEqual(all.filter((a) => !man[a.code] && /brass|khaki|turban|canvas|sampan|light black/i.test(a.prompt)).map((a) => a.code), []);
  assert.match(P("ENV_trong_dong"), /fourteen-pointed star/); assert.match(tableRow("ENV_thuyen_mui"), /\| Thuyền mui ở bến \|/);
});
t("ghi chú: A8 dẫn mục P3, B13 nối Đường Ngột với Đảng Hạng; 3d-ref README đếm K–O là 89 mục môi trường cộng trâu", () => {
  assert.match(body("H27"), /\(mục P3, suy luận\)/); assert.match(body("X25"), /Đường Ngột \(Đảng Hạng, Tangut\)/);
  assert.match(readFileSync(join(ROOT, "design/3d-ref/README.md"), "utf8"), /89 mục môi trường, cộng trâu/);
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
  for (const s of ["thu", "can", "thieu", "moi-truong", "lam-lai", "tuong-moi", "tuy-chon", "tat-ca"]) assert.ok(r.stderr.includes(s), s);
});

console.log(`\n${pass} đạt, ${fail} trượt`);
process.exit(fail ? 1 : 0);
