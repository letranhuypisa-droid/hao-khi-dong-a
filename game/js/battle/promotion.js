// battle/promotion.js — lính diễn (actor, KHÔNG trúng đòn) nào thành lính thật (zone, trúng đòn). THUẦN: không three, không rng; tests/promotion.test.mjs.
//
// Luật cũ (director.js updateZone bước 2): lính diễn trong ZONE.radius quanh tướng thành lính thật theo thứ tự gần nhất trước, tới trần
// ZONE.enemies địch / ZONE.allies ta (đếm lính thật trong ZONE.countR). Hậu quả đo ở đợt 12: trần địch đầy ~57% trận, lính diễn đứng
// cạnh tướng suốt — cung kỵ nằm khối sau cùng nên bị chọn sau cùng — và đòn chém xuyên qua họ; 26–43% thời gian cung kỵ trong 12 m
// là không đánh được, ở dải đầu tuyến pha 1 là 38–46%.
// Luật thêm (caps.nearR): lính địch SÁT tướng (d < nearR) vẫn thành lính thật khi trần mềm đã đầy, tới caps.forcedMax người "bị ép" cùng lúc (trần
// riêng, không tính chung với quân đồn trú: bản đầu tính chung trần cứng 42 nên khi đánh đồn — 30–36 lính đồn trú — chỉ còn chừa 6 chỗ). Hạn mức ưu tiên
// KỴ BINH (đứng khối sau cùng nên hay bị bỏ lại, và là con người chơi thấy "sát bên mà chém không trúng"), rồi gần nhất. Không đặt nearR thì ra đúng
// kết quả luật cũ (kể cả thứ tự khi khoảng cách bằng nhau: sắp ổn định theo thứ tự mảng, để vết bot không đổi).
//
//   actors  [{ x, z, side, dead?, mounted? | K.mounted }]  lính diễn ứng viên (người gọi lọc role "actor" và chưa ngã)
//   hero    { x, z }
//   real    { dich, ta, forced? }    số lính thật đang trong ZONE.countR quanh tướng. dich KHÔNG gồm lính đã thành thật nhờ luật sát tướng
//                                    (forced): chúng không chiếm chỗ của trần mềm, cũng không cản việc sinh quân đồn trú / khối quân ở tuyến
//                                    (director.js updateZone dùng chính số này); forced chỉ tính vào trần forcedMax.
//   caps    { radius, enemies, allies, nearR?, forcedMax? }
// → { promote: [actor] (theo thứ tự nên xử lý; gồm cả forced), forced: [actor] (những lính thành thật nhờ luật sát tướng), blocked: { dich, ta } }

export function pickPromotions(actors, hero, real, caps) {
  const R2 = caps.radius * caps.radius;
  const near = [];
  for (const a of actors) {
    if (a.dead) continue;
    const d2 = (a.x - hero.x) ** 2 + (a.z - hero.z) ** 2;
    if (d2 < R2) near.push([a, d2]);
  }
  near.sort((p, q) => p[1] - q[1]);
  const n = { dich: real.dich, ta: real.ta }, forcedMax = caps.forcedMax ?? 0;
  const nearR2 = caps.nearR ? caps.nearR * caps.nearR : 0;
  const promote = [], forced = [], blocked = { dich: 0, ta: 0 };
  let forcedN = real.forced || 0;                                  // lính bị ép đang có + vừa ép trong lần xét này
  const rest = [];                                                 // lính địch sát tướng mà trần mềm đã đầy
  for (const [a, d2] of near) {
    const cap = a.side === "dich" ? caps.enemies : caps.allies;
    if (n[a.side] < cap) { promote.push(a); n[a.side]++; continue; }
    if (a.side === "dich" && d2 < nearR2) rest.push([a, d2]); else blocked[a.side]++;
  }
  const mounted = (a) => (a.mounted ?? a.K?.mounted ? 1 : 0);
  rest.sort((p, q) => mounted(q[0]) - mounted(p[0]) || p[1] - q[1]);
  for (const [a] of rest) {
    if (forcedN < forcedMax) { promote.push(a); forced.push(a); forcedN++; } else blocked.dich++;
  }
  return { promote, forced, blocked };
}

// Đợt 15b — đòn CỦA NGƯỜI CHƠI chạm lính diễn phe địch thì người đó thành lính thật ngay và nhận đòn (crowd.strikeable / crowd.enlist, gọi từ hero.js,
// hero-skills.js). Luật trên chỉ chạy theo nhịp 0,25 s của director.updateZone và tới hạn mức forcedMax, nên còn lọt: đứng sâu trong khối thì hạn mức đầy,
// hàng sau bước lên lấp chỗ; Phá Trận lao 9–11 m giữa hai nhịp — chém xuyên người trong đội hình.
// enemyActor(a): lính diễn phe địch còn đứng (đòn của tướng chạm được). Lính diễn phe ta không bao giờ bị đòn của tướng đổi.
export function enemyActor(a) {
  return !!a && a.role === "actor" && a.side === "dich" && a.alive !== false && a.state !== "dead";
}
// enlistActor(a): đổi trường đúng như nhánh "ép" (forced) của director.updateZone — zone, bỏ thẻ, hết hành quân, mang cờ forced (tính vào hạn mức ép trong
// ZONE.forcedKeepR, không chiếm trần mềm; tướng đi xa > 45 m thì updateZone bước 1 trả về lính diễn như mọi lính ép); nhát chém GIẢ dở dang thì bỏ.
// → true nếu đã đổi; không phải lính diễn địch còn đứng thì không đụng, trả false.
export function enlistActor(a) {
  if (!enemyActor(a)) return false;
  a.role = "zone"; a.token = false; a.march = false; a.forced = true;
  if (a.fake) { a.windup = 0; a.fake = false; }
  return true;
}
