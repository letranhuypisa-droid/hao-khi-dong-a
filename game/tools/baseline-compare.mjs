// tools/baseline-compare.mjs <thư-mục-cũ> <thư-mục-mới> [mode] [diff] — so hai bộ kết quả của baseline-b15.mjs (cùng seed): min / trung vị / trung bình / max từng chỉ số, chênh lệch,
// và thời gian từng seed. Xem tools/baseline-b15.mjs về cách chạy và mức nhiễu (SD ~42 s: chỉ tin chênh lệch trung bình từ ~35 s với 10 seed).
import { readdirSync, readFileSync } from "node:fs";
const [dirA, dirB, mode = "nhanh", diff = "quansi"] = process.argv.slice(2);
if (!dirA || !dirB) { console.error("cách dùng: node game/tools/baseline-compare.mjs <thư-mục-cũ> <thư-mục-mới> [nhanh|chuan] [danbinh|quansi|tuongquan|nguyensoai|truyenky]"); process.exit(2); }
const load = (dir) => Object.fromEntries(readdirSync(dir).filter((f) => f.startsWith(`b15-${mode}-${diff}-`) && f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8"))).map((r) => [r.seed, r]));
const A = load(dirA), B = load(dirB);
const seeds = Object.keys(A).filter((s) => B[s]).map(Number).sort((a, b) => a - b);
const sum = (o) => Object.values(o || {}).reduce((x, y) => x + y, 0);
const E = (r, pred) => sum(Object.fromEntries(Object.entries(r.spawn || {}).filter(([k]) => pred(k))));
const M = [
  ["timeSec", (r) => r.timeSec], ["P1", (r) => r.phaseDur[0]], ["P2", (r) => r.phaseDur[1]], ["P3", (r) => r.phaseDur[2]], ["P4", (r) => r.phaseDur[3]],
  ["minHp%", (r) => r.minHp * 100], ["KO", (r) => r.ko], ["retry", (r) => r.retries], ["deaths", (r) => r.deaths],
  ["spawn E all", (r) => E(r, (k) => k.startsWith("E:"))], ["E actor", (r) => E(r, (k) => k === "E:actor")], ["E zone", (r) => r.spawn["E:zone"] || 0], ["E garrison", (r) => r.spawn["E:garrison"] || 0],
  ["tCap>=30 s", (r) => r.tCapEnemies], ["avg real<=45m", (r) => r.enemies45Avg], ["max real<=45m", (r) => r.enemies45Max],
  ["mounted ACTOR<12m s", (r) => r.mt.tActMNear12], ["any ACTOR<12m s", (r) => r.mt.tActNear12], ["mounted ACTOR<9m s", (r) => r.mt.tActMNear9 ?? null], ["any ACTOR<9m s", (r) => r.mt.tActNear9 ?? null], ["mounted-s<9m unhittable %", (r) => (r.mt.mSecAct9 != null ? 100 * r.mt.mSecAct9 / Math.max(1e-9, r.mt.mSecAct9 + r.mt.mSecReal9) : null)], ["mounted ACTOR<6m s", (r) => r.mt.tActMNear6 ?? null], ["any ACTOR<6m s", (r) => r.mt.tActNear6 ?? null], ["mounted-s<6m unhittable %", (r) => (r.mt.mSecAct6 != null ? 100 * r.mt.mSecAct6 / Math.max(1e-9, r.mt.mSecAct6 + r.mt.mSecReal6) : null)], ["mounted ACTOR<25m s", (r) => r.mt.tActMNear25],
  ["ringBlk A1", (r) => r.ring.A1?.tBlocked || 0], ["ringBlk A2", (r) => r.ring.A2?.tBlocked || 0], ["garReleased", (r) => r.garReleased],
  ["hintGarT s", (r) => r.hintGarT || 0],
  ["gar outside% A1", (r) => (r.ring.A1 && r.ring.A1.tBlocked ? 100 * r.ring.A1.outCountSum / Math.max(1e-9, r.ring.A1.outCountSum + r.ring.A1.inCountSum) : null)],
  ["gar maxOut m", (r) => Math.max(r.ring.A1?.maxOutDist || 0, r.ring.A2?.maxOutDist || 0)],
  ["blocked w/ >=1 out% A1", (r) => (r.ring.A1 && r.ring.A1.tBlocked ? 100 * r.ring.A1.tOutside / r.ring.A1.tBlocked : null)],
];
const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (x) => (x == null || Number.isNaN(x) ? "  -  " : Number(x).toFixed(1).padStart(7));
if (!seeds.length) { console.error(`không có seed chung giữa hai thư mục cho ${mode}/${diff} (nhầm thứ tự mode / diff?)`); process.exit(1); }
console.log(`n=${seeds.length} seeds=${seeds.join(",")} won base ${seeds.filter((s) => A[s].won).length} new ${seeds.filter((s) => B[s].won).length}`);
console.log("metric".padEnd(24) + "| base: min    med   mean    max |  new: min    med   mean    max | Δmean   Δmed");
for (const [name, fn] of M) {
  const a = seeds.map((s) => fn(A[s])).filter((x) => x != null), b = seeds.map((s) => fn(B[s])).filter((x) => x != null);
  if (!a.length || !b.length) continue;
  console.log(name.padEnd(24) + "|" + [Math.min(...a), med(a), mean(a), Math.max(...a)].map(f).join("") + " |" + [Math.min(...b), med(b), mean(b), Math.max(...b)].map(f).join("") + " |" + f(mean(b) - mean(a)) + f(med(b) - med(a)));
}
console.log("\nper-seed timeSec  base → new (P1/P2/P3/P4 new)");
for (const s of seeds) console.log(String(s).padEnd(6) + f(A[s].timeSec) + " →" + f(B[s].timeSec) + "   " + B[s].phaseDur.map((x) => (x == null ? "-" : x.toFixed(0))).join("/") + `  won=${B[s].won} KO ${A[s].ko}→${B[s].ko} tActM12 ${A[s].mt.tActMNear12.toFixed(0)}→${B[s].mt.tActMNear12.toFixed(0)}`);
