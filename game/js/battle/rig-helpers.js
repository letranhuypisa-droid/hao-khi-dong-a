// battle/rig-helpers.js — xương phụ của thân GLB (đợt 19a A4): xương chỉ lưới da GLB dùng (không có trong dữ liệu hoạt ảnh, không có
// ở rig khối, mô phỏng không đọc), quay theo một khớp nguồn của rig tướng (models.js makeRig) một phần góc:
//   · spine (lưng): con của hông, cùng gốc với khớp thân, nửa góc thân — bụng, ngực dưới xoắn, gập dần (hông – lưng – thân mỗi cặp
//     chỉ lệch nửa góc) thay vì trộn thẳng hông + thân;
//   · neck (cổ): con của thân, cùng gốc với khớp cổ (đầu), nửa góc đầu;
//   · clavL / clavR (xương đòn): con của thân, gốc ở đầu xương ức (ngang vai), 15% phần tay giơ quá ngang vai (giơ ngang hay ra trước
//     đều tính), quay quanh trục z (trước ↔ sau) của thân cho đầu ngoài nhấc lên — bắp vai, cơ thang nhấc lên theo tay giơ cao thay vì
//     gập nếp; tay dưới ngang vai (đứng, chạy, chém ngang) đứng yên. Đợt 19a soát: trước đây quay quanh trục của vung — giơ ra trước
//     thì trục đó song song xương đòn, đầu vai không nhấc chút nào (vai gập ở đòn bổ C1, C2, nằm ngã); phần 0,25 → 0,15: lưới đo 17 rig
//     × 26 kiểu × 5 nhịp, 12 / 17 rig ít ô xấu hơn bản gốc hơn;
//   · twistL / twistR (xoắn cẳng tay): con của khuỷu, giữa cẳng tay, nửa phần xoắn của bàn tay quanh trục cẳng tay — cổ tay không
//     thắt như giấy gói kẹo.
// Thuần (không three): bake (design/tools/bake/human.mjs: khung gắn của xương phụ = bộ dẫn áp vào khung gắn của khớp nguồn) và glb.js
// (lúc chạy: bộ dẫn đặt góc mỗi khung, sau tư thế + IK, trước khi vẽ) dùng chung. Cha, khớp nguồn, cách quay, phần góc ghi vào tệp
// nướng (meta.parent, meta.drive) nên lúc chạy theo đúng số của lần nướng.
// Xương đòn theo vung đều (30% vung của vai từ tay buông, như bản thiết kế đầu) đo ở đợt 19a A4 tệ hơn không có xương đòn: tam giác xấu
// 17 rig × 9 tư thế lab 3,32 → 3,76%, vùng vai 7 rig ở C1 729 → 977 — tay mẫu lúc gắn giơ 14–90° nên xương đòn gắn sẵn 4–27°, tay buông
// lúc đứng thì đỉnh vai (cách gốc xương đòn 0,17–0,27 m) bị kéo xuống mà khớp vai đứng yên (khớp vai không là con của xương đòn: hoạt
// ảnh giữ nguyên). Chỉ nhấc khi tay quá ngang vai: 3,32% (sau A3: 3,37%), riêng đòn bổ C1, C2 tăng (vai nhấc, cơ thang giãn).

// Trục xương: y cục bộ (tay, cẳng tay buông theo −y lúc góc 0; khung gắn của tay quay đúng như vậy, human.mjs bindSkeleton).
export const HELPERS = {
  spine:  { parent: "hips",  src: "torso", kind: "all",   share: 0.5 },
  neck:   { parent: "torso", src: "head",  kind: "all",   share: 0.5 },
  clavL:  { parent: "torso", src: "shL",   kind: "liftL", share: 0.15 },
  clavR:  { parent: "torso", src: "shR",   kind: "liftR", share: 0.15 },
  twistL: { parent: "elL",   src: "handL", kind: "twist", share: 0.5 },
  twistR: { parent: "elR",   src: "handR", kind: "twist", share: 0.5 },
};
export const HELPER_NAMES = Object.keys(HELPERS);
export const LIFT0 = Math.PI / 2;             // "lift": góc tay (so với buông thẳng) bắt đầu nhấc xương đòn — ngang vai

// Bộ dẫn: quaternion cục bộ của khớp nguồn (x, y, z, w — quy ước three) → góc cục bộ của xương phụ, ghi out[0…3]. q = vung · xoắn
// (xoắn quanh trục xương y, làm trước; vung là phép quay ngắn nhất từ (0, −1, 0) tới hướng xương, trục nằm ngang trong khung cha).
// kind "all": slerp(đơn vị, q, share); "twist": slerp(đơn vị, xoắn, share); "liftL" / "liftR": quay quanh trục z của khung cha một góc
// ∓ / ± share × max(0, góc vung − LIFT0) (đầu ngoài xương đòn trái −x / phải +x nhấc lên). q, −q như nhau (lấy nửa cầu w ≥ 0: đường
// ngắn). Vung 180° (y = w = 0, xoắn không xác định): xoắn = đơn vị, vung = q.
export function driveQuat(kind, share, x, y, z, w, out) {
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  if (kind !== "all") {
    const n = Math.sqrt(y * y + w * w);
    if (kind === "twist") {
      if (n < 1e-9) { x = 0; y = 0; z = 0; w = 1; } else { x = 0; y /= n; z = 0; w /= n; }
    } else {
      let e = Math.PI;
      if (n >= 1e-9) { const ax = (w * x + y * z) / n, az = (w * z - x * y) / n; e = 2 * Math.atan2(Math.sqrt(ax * ax + az * az), n); }
      const a = share * Math.max(0, e - LIFT0) * (kind === "liftL" ? -1 : 1);
      out[0] = 0; out[1] = 0; out[2] = Math.sin(a / 2); out[3] = Math.cos(a / 2);
      return out;
    }
  }
  const s = Math.sqrt(x * x + y * y + z * z);
  if (s < 1e-12) { out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 1; return out; }
  const a = Math.atan2(s, w) * share, k = Math.sin(a) / s;           // nửa góc × phần
  out[0] = x * k; out[1] = y * k; out[2] = z * k; out[3] = Math.cos(a);
  return out;
}
