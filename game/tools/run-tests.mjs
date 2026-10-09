// tools/run-tests.mjs — chạy mọi tests/*.test.mjs và tests/run.mjs, mỗi tệp một tiến trình, in một dòng cho mỗi tệp (đạt / trượt / thời gian).
//   node game/tools/run-tests.mjs [chuỗi lọc tên tệp]
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../tests"), filter = process.argv[2] || "";
const files = readdirSync(dir).filter((f) => f.endsWith(".mjs") && f.includes(filter)).sort();
let bad = 0;
for (const f of files) {
  const t0 = Date.now(), r = spawnSync(process.execPath, [join(dir, f)], { encoding: "utf8", timeout: 280000, maxBuffer: 1 << 28 });
  const out = (r.stdout || "") + (r.stderr || ""), tail = out.trim().split("\n").slice(-1)[0].slice(0, 120);
  const ok = r.status === 0;
  if (!ok) { bad++; console.log(`FAIL ${f} (${((Date.now() - t0) / 1000).toFixed(1)} s) :: ${tail}`); for (const l of out.split("\n").filter((x) => /FAIL/.test(x)).slice(0, 6)) console.log("     " + l.slice(0, 200)); }
  else console.log(`ok   ${f} (${((Date.now() - t0) / 1000).toFixed(1)} s) :: ${tail}`);
}
console.log(bad ? `\n${bad} tệp trượt` : "\nmọi tệp đạt");
process.exit(bad ? 1 : 0);
