// battle/fort.js — đồn có tường và hai cổng (Cứ Điểm loại "don" ở B15): bố cục, vật va chạm, đường đi qua cổng. THUẦN: không three, không DOM, không rng;
// tests/fort.test.mjs. Số ở data/battle-b15.js FORT.
//
// Vì sao: vòng cọc cũ của đồn (world.js palisade) chỉ để nhìn — không có vật va chạm, lính đồn trú chạy xuyên qua cọc ra ngoài vòng, tản khắp bãi nên rất khó hạ hết
// (garrison.js "b ngoài đồn"). Đồn thật: tường khép kín, hai cổng trên tim đường (cổng trước phía tây — phía quân ta tới; cổng sau phía đông), mọi vật va chạm là đoạn
// thẳng có bề dày như tường Hàm Tử quan (ground.js collide). Lính, sĩ quan, tướng không xuyên tường được; lính không tìm đường nên fortRoute cho một điểm trung gian
// (trước cổng, qua cổng, hoặc vòng qua góc) khi đường thẳng tới đích bị tường chặn.
// fortCamBoxes: hộp 2D cho camera (battle.js camBoxes) để tướng đứng sát tường phía trong không bị cọc che.
//
// Hệ toạ độ như B15: x tây → đông (đường tim), z bắc → nam; (cx, cz) là tâm Cứ Điểm. Tường nằm trên hình chữ nhật tim (cx ± wx, cz ± wz), wx = hw + wall, wz = hh + wall.

// Mặc định cho thử nghiệm (data/battle-b15.js FORT ghi số thật): hw, hh nửa bề rộng bên trong theo x, z (vòng chiếm bán kính 10 lọt vào), wall nửa dày tường, gate bề rộng cổng.
export const FORT_DEFAULT = { hw: 12.5, hh: 11, wall: 0.9, gate: 7 };

// Điểm trung gian: đứng trước / sau cổng cách tim cổng bao nhiêu m, hành lang thẳng hàng với cổng (lệch ngang tối đa), điểm đón trong cổng.
const GATE_IN = 3.2, GATE_OUT = 3.2, FRONT = 7, CORR = 2.4, ALONG_IN = 5.5, ALONG_OUT = 8, INNER = 4;

// { id, cx, cz, hw, hh, wall, gate, wx, wz, gates: [{ id, x, z, side }] (side −1 cổng trước phía tây, +1 cổng sau phía đông), segs (đoạn tường), corners (chân tháp góc),
//   bound (hộp ngoài của tường) }.
export function fortLayout(id, cx, cz, cfg = FORT_DEFAULT) {
  const { hw, hh, wall, gate } = { ...FORT_DEFAULT, ...cfg }, wx = hw + wall, wz = hh + wall, g2 = gate / 2;
  const gates = [{ id: id + ":W", x: cx - wx, z: cz, side: -1 }, { id: id + ":E", x: cx + wx, z: cz, side: 1 }];
  const segs = [
    { x0: cx - wx, z0: cz - wz, x1: cx + wx, z1: cz - wz, side: "N" }, { x0: cx - wx, z0: cz + wz, x1: cx + wx, z1: cz + wz, side: "S" },
    { x0: cx - wx, z0: cz - wz, x1: cx - wx, z1: cz - g2, side: "W" }, { x0: cx - wx, z0: cz + g2, x1: cx - wx, z1: cz + wz, side: "W" },
    { x0: cx + wx, z0: cz - wz, x1: cx + wx, z1: cz - g2, side: "E" }, { x0: cx + wx, z0: cz + g2, x1: cx + wx, z1: cz + wz, side: "E" },
  ];
  const corners = [[cx - wx, cz - wz], [cx + wx, cz - wz], [cx - wx, cz + wz], [cx + wx, cz + wz]];
  return { id, cx, cz, hw, hh, wall, gate: gate, wx, wz, gates, segs, corners, bound: { x0: cx - wx - wall, x1: cx + wx + wall, z0: cz - wz - wall, z1: cz + wz + wall } };
}

// Vật va chạm cho world.colliders (đoạn thẳng dày r như ground.js pushOut): sáu đoạn tường (đầu tròn bán kính tường chặn luôn trụ cổng), bốn chân tháp góc (đoạn rất ngắn).
export function fortColliders(L, tower = 1.9) {
  const out = L.segs.map((s) => ({ x0: s.x0, z0: s.z0, x1: s.x1, z1: s.z1, r: L.wall }));
  for (const [x, z] of L.corners) out.push({ x0: x, z0: z, x1: x + 0.01, z1: z, r: tower });
  return out;
}

// Hộp 2D cho camera (battle.js camBoxes, B15 wallBoxes): cần camera cắt hộp thì camera kéo về phía tướng tới trước mặt tường và nâng lên, nhìn chếch xuống qua đầu tướng — tướng
// đứng sát tường phía trong thì camera không còn nằm ngoài tường, nhìn qua hàng cọc cao 2,9 m. Sáu đoạn tường (nửa dày wall + pad, đúng tới mép cổng) và bốn chân tháp góc; hai cổng để trống.
export function fortCamBoxes(L, pad = 0.2, tower = 2.1) {
  const hw = L.wall + pad, out = [];
  for (const s of L.segs) {
    const along = s.side === "N" || s.side === "S", dx = along ? 0 : hw, dz = along ? hw : 0;          // bề dày chỉ nới theo chiều ngang đoạn tường
    out.push({ x0: Math.min(s.x0, s.x1) - dx, x1: Math.max(s.x0, s.x1) + dx, z0: Math.min(s.z0, s.z1) - dz, z1: Math.max(s.z0, s.z1) + dz, gate: null, open: false });
  }
  for (const [x, z] of L.corners) out.push({ x0: x - tower, x1: x + tower, z0: z - tower, z1: z + tower, gate: null, open: false });
  return out;
}

// Trong tường (hình chữ nhật tim, nới pad m)? Đứng giữa dày tường chỗ cổng: nửa phía trong tính là trong.
export const insideFort = (L, x, z, pad = 0) => Math.abs(x - L.cx) < L.wx + pad && Math.abs(z - L.cz) < L.wz + pad;

// Đoạn (a → b) có cắt hình chữ nhật không (Liang–Barsky)?
function segHitsRect(ax, az, bx, bz, x0, z0, x1, z1) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, ax - x0) && clip(dx, x1 - ax) && clip(-dz, az - z0) && clip(dz, z1 - az) && t0 <= t1;
}

// Điểm ngoài tường, đi từ A (ngoài) tới W (ngoài): thẳng được thì W, không thì ra một góc (bốn góc lệch ra ngoài), góc cho đường ngắn nhất không cắt tường.
function avoid(L, ax, az, wx, wz) {
  const b = L.bound;
  if (!segHitsRect(ax, az, wx, wz, b.x0, b.z0, b.x1, b.z1)) return [wx, wz];
  const o = L.wall + 2.8, cs = [[b.x0 - 2, b.z0 - 2], [b.x1 + 2, b.z0 - 2], [b.x0 - 2, b.z1 + 2], [b.x1 + 2, b.z1 + 2]].map(([x, z]) => [x, z, o]);
  let best = null, bd = Infinity;
  for (const [x, z] of cs) {
    const free1 = !segHitsRect(ax, az, x, z, b.x0, b.z0, b.x1, b.z1), free2 = !segHitsRect(x, z, wx, wz, b.x0, b.z0, b.x1, b.z1);
    const d = Math.hypot(x - ax, z - az) + Math.hypot(x - wx, z - wz) + (free1 ? 0 : 80) + (free2 ? 0 : 80);
    if (d < bd) { bd = d; best = [x, z]; }
  }
  return best;
}

// A trong, B ngoài (ia) hoặc A ngoài, B trong: qua cổng gần nhất (tổng đường ngắn nhất).
function viaGate(L, ia, ax, az, bx, bz) {
  let g = null, best = Infinity;
  for (const q of L.gates) { const d = Math.hypot(q.x - ax, q.z - az) + Math.hypot(q.x - bx, q.z - bz); if (d < best) { best = d; g = q; } }
  const s = g.side, lat = Math.abs(az - L.cz), along = (ax - g.x) * s;            // along > 0: phía ngoài tim cổng
  if (ia) {
    if (lat <= CORR && along >= -ALONG_IN) return [g.x + s * GATE_OUT, L.cz];     // thẳng hàng với cổng: bước ra
    return [g.x - s * INNER, L.cz];                                                // chưa thẳng hàng: tới điểm đón trong cổng
  }
  if (lat <= CORR && along >= -2 && along <= ALONG_OUT) return [g.x - s * GATE_IN, L.cz];   // thẳng hàng trước cổng: bước vào
  return avoid(L, ax, az, g.x + s * FRONT, L.cz);                                  // còn xa: tới trước cổng (vòng qua góc nếu tường chắn)
}

function routeOne(L, ax, az, bx, bz) {
  const ia = insideFort(L, ax, az), ib = insideFort(L, bx, bz);
  if (ia && ib) return null;
  const b = L.bound;
  if (!segHitsRect(ax, az, bx, bz, b.x0, b.z0, b.x1, b.z1)) return null;           // đường thẳng không chạm đồn
  if (ia !== ib) { const w = viaGate(L, ia, ax, az, bx, bz); return { x: w[0], z: w[1] }; }
  const w = avoid(L, ax, az, bx, bz);
  return w[0] === bx && w[1] === bz ? null : { x: w[0], z: w[1] };
}

// forts: mảng bố cục (world.forts). → { x, z } điểm trung gian cần đi tới trước, hoặc null (đi thẳng tới đích được).
export function fortRoute(forts, ax, az, bx, bz) {
  if (!forts) return null;
  for (let i = 0; i < forts.length; i++) {
    const L = forts[i], b = L.bound;
    // loại nhanh: cả hai điểm cách hộp ngoài > 60 m cùng một phía
    if ((ax < b.x0 - 60 && bx < b.x0 - 60) || (ax > b.x1 + 60 && bx > b.x1 + 60) || (az < b.z0 - 60 && bz < b.z0 - 60) || (az > b.z1 + 60 && bz > b.z1 + 60)) continue;
    const w = routeOne(L, ax, az, bx, bz);
    if (w) return w;
  }
  return null;
}

// Đồn nào (nếu có) chứa điểm (x, z), nới pad m.
export function fortAt(forts, x, z, pad = 0) {
  if (forts) for (let i = 0; i < forts.length; i++) if (insideFort(forts[i], x, z, pad)) return forts[i];
  return null;
}

// Đẩy một chỗ đứng ra khỏi đồn (lính diễn ở tuyến không va chạm; đội hình tuyến chạy ngang đồn thì đứng lẫn vào tường): trong hộp ngoài của đồn nới pad m thì dời ra mép
// phía side (−1 tây, +1 đông). jit (0…1, theo id lính): rải thêm ra xa mép để các hàng không chồng đúng một chỗ.
export function nudgeOut(forts, x, z, side, jit = 0, pad = 1.5) {
  if (forts) for (let i = 0; i < forts.length; i++) {
    const F = forts[i];
    if (Math.abs(x - F.cx) < F.wx + F.wall + pad && Math.abs(z - F.cz) < F.wz + F.wall + pad) {
      const edge = side < 0 ? F.cx - F.wx - F.wall - pad - 1 : F.cx + F.wx + F.wall + pad + 1;
      return [edge + side * jit * 6, z];
    }
  }
  return [x, z];
}
