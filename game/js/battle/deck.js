// battle/deck.js — mặt boong đi được, gắn theo tư thế thuyền (B20 Bạch Đằng). Toán thuần, không import three:
// chạy được trong Node (tests/deck.test.mjs).
//
// Hệ cục bộ của thuyền: gốc ở đường mớn nước giữa thân, +z = mũi, x = ngang thân (hợp đồng gọi +x là mạn phải),
// y lên. Mặt đi được là các hình chữ nhật {x0,x1,z0,z1,y,sx,sz}: độ cao cục bộ h = y + sx·(lx − x0) + sz·(lz − z0)
// (sx, sz là độ dốc: cầu thang, ván bắc; y là độ cao ở góc (x0, z0)). Các mặt không chồng lên nhau theo mặt bằng
// (lầu kỳ hạm là khối đặc, mặt trên chỉ lên được qua cầu thang), nên tra độ cao chỉ cần (x, z).
// Tường {x0,x1,z0,z1,h}: khối đặc tới độ cao cục bộ h (lầu, thành lái, chân cột buồm) — người đứng thấp hơn đỉnh
// tường quá một bậc thì không đi vào. Cửa {lx,lz,r}: trong bán kính r quanh cửa, clampInside thả người ra khỏi
// boong (lên/xuống thuyền, ván bắc áp mạn).
//
// Tư thế thế giới: T(x,y,z)·Ry(yaw)·Rx(pitch)·Rz(roll) — đúng thứ tự Euler "YXZ" của three; yaw = 0 thì mũi hướng
// +z thế giới (như hero.yaw: hướng = (sin yaw, cos yaw)). pitch > 0 chúi mũi xuống, roll > 0 nâng mạn +x.
// Ma trận m[12] = ba cột ex, ey, ez rồi tịnh tiến t.

export const DECK_STEP = 0.55;   // bậc cao nhất bước qua được giữa hai mặt liền nhau (m) — ĐỀ XUẤT BẢN THỬ
export const DECK_CAP = 12;      // số boong được tra cùng lúc (R-world §4b: ≤ 12 quanh người chơi) — ĐỀ XUẤT BẢN THỬ

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
// clampInside: giữ toạ độ v trong [a + r, b − r] (mặt hẹp hơn 2r thì giữa mặt). Ngoài hàm (đợt 19c): trước đây một closure mỗi lần gọi.
const fit = (v, a, b, r) => (b - a < 2 * r ? (a + b) / 2 : clamp(v, a + r, b - r));

export function poseMatrix(m, x, y, z, yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  m[0] = cr * cy + sr * sp * sy; m[1] = sr * cp; m[2] = -cr * sy + sr * sp * cy;     // ex
  m[3] = -sr * cy + cr * sp * sy; m[4] = cr * cp; m[5] = sr * sy + cr * sp * cy;     // ey
  m[6] = cp * sy; m[7] = -sp; m[8] = cp * cy;                                        // ez
  m[9] = x; m[10] = y; m[11] = z;
  return m;
}

// Giải (lx, lz) để điểm trên mặt nghiêng r (cục bộ) chiếu đúng xuống (wx, wz) thế giới: hệ 2×2 tuyến tính vì h
// tuyến tính theo lx, lz. Ghi vào S; false khi suy biến (thuyền dựng đứng — không xảy ra).
const S = { x: 0, z: 0, h: 0 };
function solve(m, r, wx, wz) {
  const a11 = m[0] + m[3] * r.sx, a12 = m[6] + m[3] * r.sz, a21 = m[2] + m[5] * r.sx, a22 = m[8] + m[5] * r.sz;
  const b1 = wx - m[9] - m[3] * r.a, b2 = wz - m[11] - m[5] * r.a;
  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) < 1e-9) return false;
  S.x = (b1 * a22 - a12 * b2) / det; S.z = (a11 * b2 - b1 * a21) / det; S.h = r.a + r.sx * S.x + r.sz * S.z;
  return true;
}
const outside = (r, lx, lz) => { const dx = Math.max(r.x0 - lx, 0, lx - r.x1), dz = Math.max(r.z0 - lz, 0, lz - r.z1); return Math.hypot(dx, dz); };
const inRect = (r, lx, lz, pad = 0) => lx >= r.x0 - pad && lx <= r.x1 + pad && lz >= r.z0 - pad && lz <= r.z1 + pad;
const hOf = (r, lx, lz) => r.a + r.sx * lx + r.sz * lz;
const mkRect = (r) => { const sx = r.sx || 0, sz = r.sz || 0; return { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y: r.y, sx, sz, a: r.y - sx * r.x0 - sz * r.z0 }; };

const _L = { x: 0, z: 0, h: 0, i: -1, d: 0 }, _W = { x: 0, y: 0, z: 0 };

export class Deck {
  constructor({ rects = [], portals = [], walls = [] } = {}) {
    this.rects = rects.map(mkRect);
    this.portals = portals.map((p) => ({ lx: p.lx, lz: p.lz, r: p.r }));
    this.walls = walls.map((w) => ({ x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1, h: w.h }));
    this._bound();
    this.m = poseMatrix(new Float64Array(12), 0, 0, 0, 0, 0, 0);
    this.m0 = Float64Array.from(this.m);
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.pitch = 0; this.roll = 0; this.yaw0 = 0;
    this.ver = 0;              // tăng mỗi lần setPose — bộ đệm độ cao chân của lính đặt lại khi khác (R-world §4b)
    this.priority = 0;         // > 0: luôn được DeckSet.active chọn trước (boong người chơi đang đứng, kỳ hạm)
    this.boat = null;          // Boat sở hữu (boats.js gán)
  }

  get radius() { return this._R; }
  // vòng bao (mặt bằng, quanh gốc): góc xa nhất + phần lệch khi nghiêng tới ~15° (đỉnh cao nhất × 0,26)
  _bound() {
    let R = 0, top = 0;
    for (const r of this.rects) {
      for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) R = Math.max(R, Math.hypot(x, z));
      top = Math.max(top, Math.abs(r.y), Math.abs(hOf(r, r.x1, r.z1)), Math.abs(hOf(r, r.x0, r.z1)), Math.abs(hOf(r, r.x1, r.z0)));
    }
    this._R = R + top * 0.26 + 0.5;
  }
  // Thêm / đổi / bỏ mặt đi được sau khi dựng (ván dốc xuống bùn của thuyền mắc cạn, ván bắc áp mạn đổi dài theo khoảng
  // cách hai mạn). Trả mặt (đối tượng nội bộ, dùng lại cho setRect / removeRect).
  addRect(spec) { const r = mkRect(spec); this.rects.push(r); this._bound(); return r; }
  setRect(r, spec, bound = true) { Object.assign(r, mkRect({ ...r, ...spec })); if (bound) this._bound(); return r; }
  removeRect(r) { const i = this.rects.indexOf(r); if (i >= 0) { this.rects.splice(i, 1); this._bound(); } }
  addPortal(p) { const q = { lx: p.lx, lz: p.lz, r: p.r }; this.portals.push(q); return q; }
  removePortal(q) { const i = this.portals.indexOf(q); if (i >= 0) this.portals.splice(i, 1); }

  // Đặt tư thế thế giới mới; giữ tư thế cũ trong m0 để carry() tính độ dời. Lần đặt đầu không có độ dời.
  setPose(x, y, z, yaw, pitch = 0, roll = 0) {
    if (this.ver === 0) { poseMatrix(this.m0, x, y, z, yaw, pitch, roll); this.yaw0 = yaw; }
    else { this.m0.set(this.m); this.yaw0 = this.yaw; }
    poseMatrix(this.m, x, y, z, yaw, pitch, roll);
    this.x = x; this.y = y; this.z = z; this.yaw = yaw; this.pitch = pitch; this.roll = roll;
    this.ver++;
    return this;
  }

  // Độ cao thế giới của mặt đi được tại (wx, wz), NaN nếu không đứng trên boong. pad > 0: nới mép (bàn chân thò
  // qua mạn vẫn lấy mặt boong, không rơi xuống đáy sông) — điểm ngoài mép lấy độ cao ở mép gần nhất.
  // Tra KHÔNG nới trước, chỉ nới khi điểm ngoài mọi mặt (review P1-1: đứng ở boong dưới kỳ hạm sát hông cầu thang, nới
  // trước thì lấy mặt cầu thang cao hơn 2,6 m).
  heightAt(wx, wz, pad = 0) {
    const h = this._height(wx, wz, 0);
    return h === h || !(pad > 0) ? h : this._height(wx, wz, pad);
  }
  _height(wx, wz, pad) {
    const m = this.m, dx = wx - m[9], dz = wz - m[11], R = this._R + pad;
    if (dx * dx + dz * dz > R * R) return NaN;
    let best = NaN;
    for (const r of this.rects) {
      if (!solve(m, r, wx, wz) || !inRect(r, S.x, S.z, pad)) continue;
      const lx = clamp(S.x, r.x0, r.x1), lz = clamp(S.z, r.z0, r.z1), h = hOf(r, lx, lz);
      const wy = m[10] + m[1] * lx + m[4] * h + m[7] * lz;
      if (!(wy <= best)) best = wy;
    }
    return best;
  }

  contains(wx, wz, pad = 0) {
    const m = this.m, dx = wx - m[9], dz = wz - m[11], R = this._R + pad;
    if (dx * dx + dz * dz > R * R) return false;
    for (const r of this.rects) if (solve(m, r, wx, wz) && inRect(r, S.x, S.z, pad)) return true;
    return false;
  }

  // Thế giới → cục bộ trên mặt đi được: out {x, z, h, i (chỉ số mặt), d (m ra ngoài mặt đó; 0 = ở trong)}.
  // Điểm ngoài mọi mặt lấy mặt gần nhất. mm: ma trận dùng (mặc định tư thế hiện tại).
  toLocal(wx, wz, out = {}, mm = this.m) {
    out.i = -1; out.d = Infinity; out.x = 0; out.z = 0; out.h = 0;
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (!solve(mm, r, wx, wz)) continue;
      const d = outside(r, S.x, S.z);
      if (out.i < 0 || d < out.d - 1e-9 || (Math.abs(d - out.d) <= 1e-9 && S.h > out.h)) {
        out.i = i; out.d = d; out.x = S.x; out.z = S.z; out.h = S.h;
      }
    }
    return out;
  }

  // Cục bộ → thế giới trên mặt i (bỏ trống thì mặt chứa điểm, cao nhất; ngoài mọi mặt thì mặt gần nhất).
  toWorld(lx, lz, out = {}, i = -1, mm = this.m) {
    let r = this.rects[i];
    if (!r) {
      let bd = Infinity, bh = -Infinity;
      for (const q of this.rects) {
        const d = outside(q, lx, lz), h = hOf(q, lx, lz);
        if (d < bd - 1e-9 || (d <= bd + 1e-9 && h > bh)) { r = q; bd = d; bh = h; }
      }
    }
    const h = r ? hOf(r, lx, lz) : 0;
    out.x = mm[9] + mm[0] * lx + mm[3] * h + mm[6] * lz;
    out.y = mm[10] + mm[1] * lx + mm[4] * h + mm[7] * lz;
    out.z = mm[11] + mm[2] * lx + mm[5] * h + mm[8] * lz;
    return out;
  }

  // Chở theo boong: dời o {x, z, yaw?} đúng bằng độ dời của boong từ tư thế trước tới tư thế hiện tại (điểm đứng
  // yên trong hệ boong). Mỗi lần setPose chỉ chở một lần (o.dver); khi mới lên boong nên đặt o.dver = deck.ver.
  // Trả độ cao thế giới của mặt boong tại chỗ mới (NaN nếu đã chở rồi).
  carry(o) {
    if (o.dver === this.ver) return NaN;
    o.dver = this.ver;
    const L = this.toLocal(o.x, o.z, _L, this.m0);
    if (L.i < 0) return NaN;
    const W = this.toWorld(L.x, L.z, _W, L.i, this.m);
    o.x = W.x; o.z = W.z;
    if (typeof o.yaw === "number") o.yaw = wrap(o.yaw + wrap(this.yaw - this.yaw0));
    return W.y;
  }

  // Tường chặn điểm (px, pz) với người đang ở độ cao cục bộ h0?
  _wall(px, pz, h0) {
    for (const w of this.walls) if (px > w.x0 && px < w.x1 && pz > w.z0 && pz < w.z1 && h0 < w.h - DECK_STEP) return w;
    return null;
  }
  // Điểm (px, pz) đi tới được từ độ cao h0: nằm trong một mặt có độ cao chênh ≤ một bậc, không vướng tường.
  _ok(px, pz, h0) {
    if (this._wall(px, pz, h0)) return false;
    for (const r of this.rects) if (inRect(r, px, pz) && Math.abs(hOf(r, px, pz) - h0) <= DECK_STEP) return true;
    return false;
  }

  // Giữ vòng tròn bán kính r (người, lính) trong boong: không ra khỏi mép, không leo lên/rơi xuống mặt chênh quá một
  // bậc (mép lầu, hông cầu thang), không vào tường. Gần cửa thì thả (force: vẫn giữ — bước qua cửa mà ngoài kia là nước
  // sâu). Trả true nếu đã dời.
  clampInside(o, r, force = false) {
    const L = this.toLocal(o.x, o.z, _L);
    if (L.i < 0) return false;
    if (!force) for (const p of this.portals) if ((L.x - p.lx) ** 2 + (L.z - p.lz) ** 2 < p.r * p.r) return false;
    const cur = this.rects[L.i];
    let lx = L.x, lz = L.z;
    if (L.d > 0) { lx = fit(lx, cur.x0, cur.x1, r); lz = fit(lz, cur.z0, cur.z1, r); }
    else {
      const h0 = L.h;
      // bốn đầu dò: chỗ không tới được thì lùi tâm về mép mặt đang đứng (hoặc mép tường chặn)
      if (!this._ok(lx + r, lz, h0)) { const w = this._wall(lx + r, lz, h0); lx = Math.min(lx, (w ? w.x0 : cur.x1) - r); }
      if (!this._ok(lx - r, lz, h0)) { const w = this._wall(lx - r, lz, h0); lx = Math.max(lx, (w ? w.x1 : cur.x0) + r); }
      if (!this._ok(lx, lz + r, h0)) { const w = this._wall(lx, lz + r, h0); lz = Math.min(lz, (w ? w.z0 : cur.z1) - r); }
      if (!this._ok(lx, lz - r, h0)) { const w = this._wall(lx, lz - r, h0); lz = Math.max(lz, (w ? w.z1 : cur.z0) + r); }
    }
    if (lx === L.x && lz === L.z) return false;
    const W = this.toWorld(lx, lz, _W, inRect(cur, lx, lz) ? L.i : -1);
    o.x = W.x; o.z = W.z;
    return true;
  }
}

// Sổ boong cho lớp mặt đất: mỗi khung gọi active(tâm, R) quanh người chơi rồi tra heightAt / deckAt.
export class DeckSet {
  constructor(cap = DECK_CAP) { this.cap = cap; this.all = []; this.act = []; this._k = []; }
  add(d) { if (!this.all.includes(d)) this.all.push(d); return d; }
  remove(d) {
    let i = this.all.indexOf(d); if (i >= 0) this.all.splice(i, 1);
    i = this.act.indexOf(d); if (i >= 0) this.act.splice(i, 1);
  }
  // Chọn tối đa cap boong: boong có priority > 0 trước (kể cả ngoài R), rồi gần nhất (tính từ mép vòng bao). Khoá sắp
  // xếp ghi vào chính boong (d._key): không cấp phát mỗi khung (review P3).
  active(cx, cz, R = 80) {
    const k = this._k; k.length = 0;
    for (const d of this.all) {
      if (d.off) continue;
      const dist = Math.hypot(d.m[9] - cx, d.m[11] - cz) - d.radius;
      if (dist <= R || d.priority > 0) { d._key = dist - (d.priority > 0 ? 1e6 * d.priority : 0); k.push(d); }
    }
    if (k.length > 1) k.sort(byKey);
    this.act.length = 0;
    for (let i = 0; i < k.length && i < this.cap; i++) this.act.push(k[i]);
    return this.act;
  }
  // Boong có mặt đi được ở (wx, wz) trong MỌI boong (không chỉ boong đang xét) — cao nhất; bỏ qua skip và boong tắt
  // (d.off). out.h: độ cao mặt đó. Lính ở xa tướng, va chạm của lính cần tra này (active chỉ quanh tướng).
  find(wx, wz, pad = 0, skip = null, out = null) {
    let best = null, bh = -Infinity;
    for (const d of this.all) {
      if (d === skip || d.off) continue;
      const dx = wx - d.m[9], dz = wz - d.m[11], R = d._R + pad;
      if (dx * dx + dz * dz > R * R) continue;
      const h = d.heightAt(wx, wz, pad); if (h > bh) { bh = h; best = d; }
    }
    if (out) out.h = bh;
    return best;
  }
  heightAt(wx, wz, pad = 0) {
    let best = NaN;
    for (const d of this.act) { const h = d.heightAt(wx, wz, pad); if (h > best || (best !== best && h === h)) best = h; }
    return best;
  }
  deckAt(wx, wz, pad = 0) {
    let best = null, bh = -Infinity;
    for (const d of this.act) { const h = d.heightAt(wx, wz, pad); if (h > bh) { bh = h; best = d; } }
    return best;
  }
}
const byKey = (a, b) => a._key - b._key;
