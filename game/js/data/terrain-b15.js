// data/terrain-b15.js — địa hình và dấu chiến trận trên hai làn đánh B15 (toàn bộ Hư cấu).
//
// Toạ độ mét như battle-b15.js: làn A ở z = −75 (bến trên), làn B ở z = 75 (bến dưới), mặt đường
// |z − laneZ| < 9. Hai làn không soi gương nhau để người chơi nhận ra mình đang ở làn nào.
//
// Theo chiều tiến quân ta (tây → đông):
//   x 135–145   ụ đất quân ta (lũy thấp hai bên đường, chừa lối đi)
//   x 230–292   bãi giằng co: hố đất, hố ngập nước, hố chông, xác ngựa, rào ruộng gãy
//   x ≈ 288     hàng cự mã (ngựa gỗ chông) đổ nghiêng trước hào
//   x ≈ 295     hào trước lũy Nguyên (đáy bùn), có lối đất đắp chỗ đường đi và chỗ lũy vỡ
//   x ≈ 300     chiến lũy Nguyên (đất đắp cao 1,5 m, cọc nhọn trên đỉnh, vỡ hai đoạn)
//   gò cao hai bên làn (cung thủ đứng được), phía Nguyên có gò sau lũy
//   x ≈ 440     cự mã trước cổng Hàm Tử quan; x ≈ 453 hào thành (chừa cầu đất trước hai cổng)
//
// a, b: hai đầu đường tim của lũy/hào/rào. gaps: đoạn vỡ theo tham số t ∈ [0, 1] dọc a → b.
// Lũy: h cao, crest nửa bề rộng đỉnh, slope bề rộng mái. Hào: depth sâu, bottom nửa bề rộng đáy.
// Hố: r bán kính miệng, d sâu; kind "dat" hố đất, "ngap" hố ngập nước, "chong" hố chông.

export const LANE_TERRAIN = {
  berms: [
    // ụ đất quân ta (thấp, chừa đường)
    { id: "UTA_A1", lane: "A", kind: "u_ta", a: [140, -101], b: [143, -86], h: 0.9, crest: 0.6, slope: 1.8, gaps: [] },
    { id: "UTA_A2", lane: "A", kind: "u_ta", a: [143, -64], b: [140, -49], h: 0.9, crest: 0.6, slope: 1.8, gaps: [] },
    { id: "UTA_B1", lane: "B", kind: "u_ta", a: [234, 49], b: [236, 63], h: 0.9, crest: 0.6, slope: 1.8, gaps: [] },
    { id: "UTA_B2", lane: "B", kind: "u_ta", a: [236, 87], b: [234, 101], h: 0.9, crest: 0.6, slope: 1.8, gaps: [] },
    // chiến lũy Nguyên trước Doanh trại (A2, B2): vỡ chỗ đường đi và một đoạn nữa
    { id: "LUY_A", lane: "A", kind: "luy_nguyen", a: [302, -106], b: [298, -44], h: 1.5, crest: 0.9, slope: 2.4, gaps: [[0.42, 0.58], [0.79, 0.855]] },
    { id: "LUY_B", lane: "B", kind: "luy_nguyen", a: [303, 44], b: [299, 106], h: 1.5, crest: 0.9, slope: 2.4, gaps: [[0.42, 0.58], [0.16, 0.23]] },
  ],
  ditches: [
    // hào trước lũy (phía tây, phía quân ta tới); lối đất đắp chỗ lũy vỡ
    { id: "HAO_A", lane: "A", kind: "hao_luy", a: [297.5, -106], b: [293.5, -44], depth: 1.0, bottom: 1.2, slope: 1.3, gaps: [[0.41, 0.59], [0.78, 0.865]] },
    { id: "HAO_B", lane: "B", kind: "hao_luy", a: [298.5, 44], b: [294.5, 106], depth: 1.0, bottom: 1.2, slope: 1.3, gaps: [[0.41, 0.59], [0.15, 0.24]] },
    // hào thành trước tường tây Hàm Tử quan, chừa cầu đất trước hai cổng (z = ±75)
    { id: "HAO_T1", lane: null, kind: "hao_thanh", a: [453, -164], b: [453, -86], depth: 1.1, bottom: 1.4, slope: 1.4, gaps: [] },
    { id: "HAO_T2", lane: null, kind: "hao_thanh", a: [453, -64], b: [453, 64], depth: 1.1, bottom: 1.4, slope: 1.4, gaps: [] },
    { id: "HAO_T3", lane: null, kind: "hao_thanh", a: [453, 86], b: [453, 146], depth: 1.1, bottom: 1.4, slope: 1.4, gaps: [] },
  ],
  pits: [
    { x: 246, z: -82, r: 3.2, d: 1.1, kind: "dat" }, { x: 255, z: -68, r: 2.4, d: 0.9, kind: "chong" }, { x: 271, z: -88, r: 3.0, d: 1.0, kind: "ngap" },
    { x: 279, z: -71, r: 2.4, d: 1.0, kind: "dat" }, { x: 288, z: -95, r: 3.4, d: 1.2, kind: "ngap" }, { x: 236, z: -58, r: 2.6, d: 0.9, kind: "chong" },
    { x: 262, z: 83, r: 3.0, d: 1.1, kind: "ngap" }, { x: 246, z: 67, r: 2.6, d: 1.0, kind: "dat" }, { x: 274, z: 68, r: 2.3, d: 0.8, kind: "chong" },
    { x: 283, z: 92, r: 3.3, d: 1.2, kind: "dat" }, { x: 268, z: 99, r: 2.4, d: 0.9, kind: "chong" }, { x: 281, z: 78, r: 2.2, d: 0.8, kind: "ngap" },
  ],
  // gò cao hai bên làn: phía ta trước lũy, phía Nguyên sau lũy (cung thủ Nguyên đứng trên gò bắn xuống)
  // Hai gò sau lũy dời ra tây bắc / tây nam khỏi doanh trại A2, B2 (có tường, tâm x 335, z ∓75; tường tây cách tâm 17,8 m): gò cũ (320, −93) / (322, 93) nằm ngay chân tháp góc.
  mounds: [
    { x: 262, z: -59, r: 9, h: 1.8 }, { x: 311, z: -101, r: 7, h: 2.0 }, { x: 186, z: -97, r: 7, h: 1.4 },
    { x: 256, z: 58, r: 9, h: 1.6 }, { x: 311, z: 101, r: 7, h: 2.2 }, { x: 190, z: 98, r: 7, h: 1.3 },
  ],
  // rào: "rao_ruong" rào tre ruộng vườn ven đường (gãy nhiều đoạn), "cu_ma" ngựa gỗ chông của quân Nguyên.
  // Cọc nhọn trên đỉnh lũy Nguyên lấy theo berms (kind "luy_nguyen"), không liệt kê ở đây.
  fences: [
    { lane: "A", kind: "rao_ruong", a: [152, -88], b: [196, -89], gaps: [[0.18, 0.26], [0.55, 0.62]] },
    { lane: "A", kind: "rao_ruong", a: [228, -90], b: [244, -89], gaps: [[0.4, 0.55]] },
    { lane: "A", kind: "rao_ruong", a: [150, -62], b: [197, -61], gaps: [[0.3, 0.36], [0.7, 0.8]] },
    { lane: "A", kind: "rao_ruong", a: [226, -60], b: [240, -61], gaps: [] },
    { lane: "A", kind: "cu_ma", a: [287, -100], b: [287, -82], gaps: [[0.4, 0.6]] },
    { lane: "A", kind: "cu_ma", a: [287, -68], b: [287, -50], gaps: [] },
    { lane: "A", kind: "cu_ma", a: [440, -92], b: [440, -80], gaps: [] },
    { lane: "A", kind: "cu_ma", a: [440, -70], b: [440, -58], gaps: [[0.5, 0.7]] },
    { lane: "B", kind: "rao_ruong", a: [152, 88], b: [197, 89], gaps: [[0.25, 0.33], [0.66, 0.75]] },
    { lane: "B", kind: "rao_ruong", a: [226, 90], b: [246, 89], gaps: [[0.5, 0.62]] },
    { lane: "B", kind: "rao_ruong", a: [150, 61], b: [196, 60], gaps: [[0.4, 0.5]] },
    { lane: "B", kind: "rao_ruong", a: [240, 63], b: [290, 62], gaps: [[0.2, 0.3], [0.62, 0.7]] },
    { lane: "B", kind: "cu_ma", a: [288, 50], b: [288, 68], gaps: [[0.3, 0.5]] },
    { lane: "B", kind: "cu_ma", a: [288, 82], b: [288, 100], gaps: [] },
    { lane: "B", kind: "cu_ma", a: [440, 62], b: [440, 70], gaps: [] },
    { lane: "B", kind: "cu_ma", a: [440, 80], b: [440, 92], gaps: [[0.3, 0.45]] },
  ],
  // xác ngựa chết trận (ry: hướng thân). rider: có xác lính / yên cương rơi cạnh
  horses: [
    { x: 232, z: -70, ry: 0.4 }, { x: 251, z: -90, ry: 2.1 }, { x: 266, z: -77, ry: -1.0 }, { x: 284, z: -84, ry: 1.3, rider: true },
    { x: 292, z: -62, ry: 2.8 }, { x: 207, z: -94, ry: 0.2 }, { x: 428, z: -68, ry: -0.6 }, { x: 435.5, z: -87, ry: 1.9, rider: true },
    { x: 245, z: 79, ry: 1.1 }, { x: 258, z: 93, ry: -0.5 }, { x: 271, z: 58, ry: 2.4 }, { x: 286, z: 70, ry: 0.9, rider: true },
    { x: 291, z: 97, ry: -2.0 }, { x: 309, z: 52, ry: 1.6 }, { x: 430, z: 82, ry: 0.7 }, { x: 444, z: 64, ry: -1.4, rider: true },
  ],
};
