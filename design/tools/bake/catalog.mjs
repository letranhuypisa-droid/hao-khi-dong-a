// design/tools/bake/catalog.mjs — tệp nào nướng thế nào: ngân sách tam giác (design/systems.md §13.3: tướng người chơi ≤ 10 nghìn,
// tướng khác ≤ 6 nghìn, boss ≤ 8 nghìn), cỡ texture (người chơi 1024², còn lại 512²), khớp ghi tay khi bộ dò sai, hộp cắt phần thừa,
// chiều và chỗ cầm vũ khí.
// shoulder: độ cao vai (khung chuẩn hoá thô cao 1,9, trung bình hai bên) đã xem bằng mắt trong lab — mẫu không có khớp ghi tay phải
// có; bộ dò lệch quá 0,03 thì dừng nướng (human.mjs fitHuman: chuỗi tay tự khớp mà sai — vai rơi ở khuỷu — qua được mọi dải độ dài).
// Mẫu mới / mẫu làm lại: nướng một lần, đọc số trong lỗi, xem tay trong lab rồi ghi. fallback: true cho phép tay thay thế (đối xứng,
// tỉ lệ người) khi tay dò hỏng — chỉ ghi sau khi xem tay đó.

// Khớp ghi tay (toạ độ chuẩn hoá thô cao 1,9, đọc từ ảnh lưới; human.mjs fitHuman — trọng số tay theo chuỗi xương ghi tay) cho mẫu
// bộ dò không dựng được. Tướng Nguyên chung: hai tay buông dính vạt áo (đường đo dọc mặt lưới đi tắt qua áo).
const FIX_OFF_TUONG = {
  shL: [-0.25, 1.42, 0.0], elL: [-0.31, 1.16, 0.02], handL: [-0.31, 0.95, 0.06],
  shR: [0.25, 1.42, 0.0], elR: [0.31, 1.16, 0.02], handR: [0.31, 0.95, 0.06],
};
// Cận vệ đại đao: cánh tay áp sườn, khuỷu gập nhọn (cẳng tay giơ lên) — tâm vòng quanh khuỷu cắt góc, khuỷu dò rơi giữa cẳng tay.
// Khuỷu ở đáy chỗ gập (1,275), vai trong giáp vai (1,45), "hand" giữa lòng bàn tay như bộ dò.
const FIX_CV_DAIDAO = {
  shL: [-0.235, 1.45, -0.1], elL: [-0.28, 1.275, -0.04], handL: [-0.378, 1.431, 0.213],
  shR: [0.232, 1.45, -0.1], elR: [0.285, 1.275, -0.04], handR: [0.383, 1.438, 0.206],
};
// Nỏ binh Đại Việt (lính đám đông): cánh tay áp hẳn vào sườn — vòng đẳng mức nhập thân từ khuỷu, vai dò rơi ở khuỷu. Khuỷu ở đầu sau
// cẳng tay (1,19), vai 1,37.
const FIX_DV_NO = {
  shL: [-0.24, 1.37, -0.09], elL: [-0.27, 1.19, -0.09], handL: [-0.349, 1.175, 0.272],
  shR: [0.24, 1.37, -0.09], elR: [0.27, 1.19, -0.09], handR: [0.358, 1.175, 0.273],
};
// H35h (Hunyuan3D, nắm đấm, A-pose tay thẳng chếch ~35° so với phương thẳng đứng): đo bằng lát cắt theo độ cao trên lưới chuẩn hoá thô (tay tách khỏi thân từ
// y = 1,25, trục tay x ≈ 0,315 / 1,25 → 0,49 / 1,0). Vai ở chỗ gắn giáp vai, khuỷu ở giữa trục tay (cách vai 0,32), "hand" giữa nắm đấm. w.mirror: nách tay phải
// dính thân (15 đỉnh tách cầu, hở 0,53 m khi giơ tay), tay trái sạch — lấy trường tay trái soi gương: hết đường tách.
const FIX_H35H = {
  shL: [-0.24, 1.44, 0.11], elL: [-0.37, 1.145, 0.12], handL: [-0.49, 0.99, 0.19],
  shR: [0.24, 1.44, 0.11], elR: [0.37, 1.145, 0.12], handR: [0.49, 0.99, 0.19],
};
// Bốn tướng Hunyuan3D còn lại (A-pose tay thẳng như H35h): khớp tay do design/tools/fit-arms.mjs đo bằng mặt cắt ngang (bake/fit-arms.mjs: nắm đấm,
// hướng tay, chiều dài tay; vai ở trong giáp nên không đo được). Kiểm công cụ trên hai nguồn độc lập: H35h (FIX_H35H đo tay: vai lệch 0,02, nắm đấm 0,02;
// khuỷu đo tay thấp hơn 0,07) và X19h (bộ xương công cụ rig tự động, design/glb/_raw/X19_hunyuan_rigged.fbx: vai lệch ≤ 0,02, khuỷu ≤ 0,03, nắm đấm
// ≤ 0,025; khung thô). neck: khớp cổ đo theo vai ghi tay (human.mjs fitHuman, fix.neck — bộ dò tính cổ theo vai bộ dò nên lệch theo).
// Chạy lại: node design/tools/fit-arms.mjs <mã>.
const FIX_H31H = {
  shL: [-0.268, 1.432, -0.005], elL: [-0.354, 1.192, 0.002], handL: [-0.488, 0.985, 0.066],
  shR: [0.268, 1.432, -0.005], elR: [0.354, 1.192, 0.002], handR: [0.488, 0.985, 0.066],
  neck: 1.600,
};
const FIX_H33H = {
  shL: [-0.264, 1.437, -0.023], elL: [-0.348, 1.196, -0.012], handL: [-0.476, 0.995, 0.078],
  shR: [0.264, 1.437, -0.023], elR: [0.348, 1.196, -0.012], handR: [0.476, 0.995, 0.078],
  neck: 1.540,
};
const FIX_H40H = {
  shL: [-0.271, 1.428, 0.015], elL: [-0.353, 1.187, 0.026], handL: [-0.479, 0.985, 0.117],
  shR: [0.271, 1.428, 0.015], elR: [0.353, 1.187, 0.026], handR: [0.479, 0.985, 0.117],
  neck: 1.550,
};
const FIX_X19H = {
  shL: [-0.283, 1.421, 0.014], elL: [-0.364, 1.179, 0.028], handL: [-0.484, 0.985, 0.142],
  shR: [0.283, 1.421, 0.014], elR: [0.364, 1.179, 0.028], handR: [0.484, 0.985, 0.142],
  neck: 1.600,
};
// Mười bảy nhân vật Hunyuan3D đợt hai (ảnh gpt-image-2.5-sunburst, design/tools/ai33-img.mjs → Hunyuan3D, A-pose nắm đấm): khớp tay do design/tools/fit-arms.mjs đo
// (node design/tools/fit-arms.mjs design/glb/_raw/<mã>_hunyuan.glb <tris>). Chín nhân vật rig (LINH, OFF, CV) nướng thành mã <mã>h; tám lính đám đông (DV, NG) ở KIT_LIST.
const FIX_LINH_R01H = {
  shL: [-0.279, 1.420, -0.008], elL: [-0.351, 1.175, 0.002], handL: [-0.464, 0.965, 0.092],
  shR: [0.279, 1.420, -0.008], elR: [0.351, 1.175, 0.002], handR: [0.464, 0.965, 0.092],
  neck: 1.570,
};
const FIX_LINH_R24H = {
  shL: [-0.239, 1.378, -0.007], elL: [-0.323, 1.138, 0.004], handL: [-0.453, 0.935, 0.089],
  shR: [0.239, 1.378, -0.007], elR: [0.323, 1.138, 0.004], handR: [0.453, 0.935, 0.089],
  neck: 1.490,
};
const FIX_OFF_PHOTUONGH = {
  shL: [-0.242, 1.417, -0.023], elL: [-0.326, 1.177, -0.009], handL: [-0.449, 0.985, 0.106],
  shR: [0.242, 1.417, -0.023], elR: [0.326, 1.177, -0.009], handR: [0.449, 0.985, 0.106],
  neck: 1.550,
};
const FIX_OFF_DOITRUONGH = {
  shL: [-0.253, 1.385, 0.010], elL: [-0.323, 1.140, 0.019], handL: [-0.435, 0.925, 0.100],
  shR: [0.253, 1.385, 0.010], elR: [0.323, 1.140, 0.019], handR: [0.435, 0.925, 0.100],
  neck: 1.510,
};
const FIX_CV_KHIENH = {
  shL: [-0.239, 1.366, -0.015], elL: [-0.320, 1.124, -0.006], handL: [-0.447, 0.915, 0.068],
  shR: [0.239, 1.366, -0.015], elR: [0.320, 1.124, -0.006], handR: [0.447, 0.915, 0.068],
  neck: 1.460,
};
const FIX_CV_GIAOH = {
  shL: [-0.289, 1.426, -0.010], elL: [-0.379, 1.188, -0.002], handL: [-0.518, 0.985, 0.065],
  shR: [0.289, 1.426, -0.010], elR: [0.379, 1.188, -0.002], handR: [0.518, 0.985, 0.065],
  neck: 1.590,
};
const FIX_CV_CUNGH = {
  shL: [-0.290, 1.439, -0.001], elL: [-0.371, 1.197, 0.008], handL: [-0.496, 0.990, 0.087],
  shR: [0.290, 1.439, -0.001], elR: [0.371, 1.197, 0.008], handR: [0.496, 0.990, 0.087],
  neck: 1.610,
};
const FIX_CV_SONGDAOH = {
  shL: [-0.287, 1.442, -0.038], elL: [-0.386, 1.206, -0.034], handL: [-0.539, 1.005, -0.002],
  shR: [0.287, 1.442, -0.038], elR: [0.386, 1.206, -0.034], handR: [0.539, 1.005, -0.002],
  neck: 1.610,
};
const FIX_CV_DAIDAOH = {
  shL: [-0.248, 1.362, -0.010], elL: [-0.334, 1.122, 0.003], handL: [-0.460, 0.930, 0.113],
  shR: [0.248, 1.362, -0.010], elR: [0.334, 1.122, 0.003], handR: [0.460, 0.930, 0.113],
  neck: 1.470,
};
const FIX_DV_GIAOH = {
  shL: [-0.271, 1.452, -0.018], elL: [-0.361, 1.214, -0.008], handL: [-0.498, 1.015, 0.074],
  shR: [0.271, 1.452, -0.018], elR: [0.361, 1.214, -0.008], handR: [0.498, 1.015, 0.074],
  neck: 1.610,
};
const FIX_DV_DAOH = {
  shL: [-0.262, 1.452, 0.002], elL: [-0.350, 1.214, 0.012], handL: [-0.485, 1.015, 0.099],
  shR: [0.262, 1.452, 0.002], elR: [0.350, 1.214, 0.012], handR: [0.485, 1.015, 0.099],
  neck: 1.580,
};
const FIX_DV_NOH = {
  shL: [-0.242, 1.444, -0.015], elL: [-0.327, 1.204, -0.008], handL: [-0.462, 0.995, 0.050],
  shR: [0.242, 1.444, -0.015], elR: [0.327, 1.204, -0.008], handR: [0.462, 0.995, 0.050],
  neck: 1.590,
};
const FIX_NG_DAOH = {
  shL: [-0.269, 1.372, 0.012], elL: [-0.368, 1.137, 0.022], handL: [-0.514, 0.945, 0.104],
  shR: [0.269, 1.372, 0.012], elR: [0.368, 1.137, 0.022], handR: [0.514, 0.945, 0.104],
  neck: 1.490,
};
const FIX_NG_GIAOH = {
  shL: [-0.269, 1.415, 0.007], elL: [-0.343, 1.171, 0.018], handL: [-0.459, 0.965, 0.114],
  shR: [0.269, 1.415, 0.007], elR: [0.343, 1.171, 0.018], handR: [0.459, 0.965, 0.114],
  neck: 1.530,
};
const FIX_NG_CUNGH = {
  shL: [-0.280, 1.417, -0.006], elL: [-0.357, 1.174, -0.002], handL: [-0.482, 0.955, 0.039],
  shR: [0.280, 1.417, -0.006], elR: [0.357, 1.174, -0.002], handR: [0.482, 0.955, 0.039],
  neck: 1.570,
};
const FIX_NG_TANKH = {
  shL: [-0.286, 1.360, -0.015], elL: [-0.361, 1.117, -0.006], handL: [-0.481, 0.905, 0.072],
  shR: [0.286, 1.360, -0.015], elR: [0.361, 1.117, -0.006], handR: [0.481, 0.905, 0.072],
  neck: 1.530,
};
const FIX_NG_KYH = {
  shL: [-0.254, 1.433, -0.010], elL: [-0.338, 1.192, -0.002], handL: [-0.470, 0.985, 0.067],
  shR: [0.254, 1.433, -0.010], elR: [0.338, 1.192, -0.002], handR: [0.470, 0.985, 0.067],
  neck: 1.540,
};
// Bán kính ống quanh chuỗi tay ghi tay (human.mjs fitHuman rad, radOut; đơn vị H, mặc định [0,05, 0,04, 0,045] / [0,07, 0,07, 0,065]): tay giáp dày của
// Hunyuan3D (cẳng tay hộ tay, cánh tay trên giáp) lòi mặt trong ra ngoài ống mặc định 0,087–0,106 (khung thô) → đỉnh mặt trong theo thân, nách thành tam giác
// cầu: 17–27 tam giác tách, đường tách hở 0,6 m khi giơ tay (H31h, H33h, H40h, X19h). Mức nhỏ nhất làm hết cầu ở H31h, H33h, X19h (cầu 0); H40h còn 4 tam giác ở gáy.
const ARM_TUBE = { rad: [0.05, 0.05, 0.055], radOut: [0.07, 0.07, 0.075] };
// Ống tên H40h (char.mjs lockTorso, rigid): phần trên ống tên và mũi tên nhô cao ngang đầu bên trái cổ (x −0,32…−0,1, y 1,53…, z −0,2…−0,095 — khung gắn,
// mét; đo ở y 1,55–1,65: 150 đỉnh theo cổ / đầu, cổ thật |x| < 0,09, mũ |x| < 0,13) theo thân thuần.
const QUIVER_H40H = { lo: [-0.32, 1.53, -0.2], hi: [-0.1, 1.8, -0.095] };
// Phần thừa của mẫu Meshy cắt trước khi dò khớp, tính trọng số (human.mjs cutBoxes): tam giác có trọng tâm trong hộp { lo, hi }
// (khung chuẩn hoá thô cao 1,9 của lưới chưa cắt, như FIX_OFF_TUONG). Sừng mũ H33: phần trên 1,81 là sừng (núm mũ thấp hơn), hai bên
// |x| ≥ 0,04 trên vòm mũ (≥ 1,765), gốc sừng |x| ≥ 0,085 từ 1,715 (vòm mũ ở đó thấp hơn); X19: hai sừng |x| 0,055–0,14 trên 1,765
// (núm giữa |x| < 0,04 giữ). Bao đao DV_DAO: đoạn dưới thò ra ngoài hông trái (+x; đoạn trên áp sát mép áo, cắt thì thủng áo — giữ).
const CUT_H33 = [{ lo: [-0.16, 1.81, -0.2], hi: [0.16, 2, 0.2] }, { lo: [-0.16, 1.765, -0.2], hi: [-0.04, 1.81, 0.2] }, { lo: [0.04, 1.765, -0.2], hi: [0.16, 1.81, 0.2] },
  { lo: [-0.16, 1.715, -0.2], hi: [-0.085, 1.765, 0.2] }, { lo: [0.085, 1.715, -0.2], hi: [0.16, 1.765, 0.2] }];
const CUT_X19 = [{ lo: [-0.14, 1.765, -0.2], hi: [-0.055, 2, 0.2] }, { lo: [0.055, 1.765, -0.2], hi: [0.14, 2, 0.2] }];
const CUT_DV_DAO = [{ lo: [0.255, 0.55, -0.36], hi: [0.36, 0.85, 0.1] }];
// w: thay số trọng số mặc định (human.mjs WEIGHT_PRM) riêng mẫu — so: dời dải vai về phía tay, xc: bề ngang dải giữa hai chân theo hông,
// ky: dải đó xuống dưới gối, seam: thả đường giáp hai vùng thuần, mirror: trường tay lấy thêm tay kia soi gương — chọn theo lưới đo đợt
// 19a soát (17 rig × 26 kiểu đòn × 5 nhịp so bản gốc 35beed2): ít ô có tam giác xấu / giãn > 10 lần nhiều hơn bản gốc nhất (H35 4 → 1 ô
// / 45 → 19, giãn > 10 lần 385 → 188; H40 7 → 4, X24 14 → 2, CV_giao giãn > 10 lần 84 → 54, …). Soát lần 2: X19 (mirror) nửa dưới ống tay
// áo phải hết theo thân, không còn tam giác cầu phải tách — tấm màng tối khi giơ tay (cạnh > 0,2 m giãn > 2,5 lần) heavy 2090 → 391 cm²,
// gầm 1340 → 287, ngã 321 → 250; X20 (ky) đáy chậu hết cầu — không còn đường tách nào (đường tách hở 0,25–0,9 m khi cử động).
// keep: giữ tệp nướng của commit đó (game/assets/models), glb-bake.mjs bỏ qua mẫu — GLB cần làm lại (models.test.mjs in TODO "GLB cần
// làm lại" ở mọi mục mẫu đó còn trượt). OFF_tuong: tay buông dính vạt áo, ống tay áo rộng — tách tam giác cầu thì tay, cổ tay áo rời
// khỏi thân, hở 0,25–0,68 m ở gầm, đòn ult (đợt 19a soát lần 2); bản 35beed2 tay cứng theo thân nhưng lưới liền.
export const CHARS = {
  // Thử mô hình Hunyuan3D 3.1 (design/hunyuan-prompts.md): src = GLB ngoài manifest Meshy, mã H35h chạy song song H35 Meshy. Chưa ghi tay / vai: nướng một lần,
  // đọc số trong lỗi, xem lưới rồi ghi.
  H35h: { src: "design/glb/_raw/H35_hunyuan.glb", tris: 9000, tex: 1024, fix: FIX_H35H, w: { mirror: 1 } },
  // Cùng hạng ngân sách với bản Meshy (tướng người chơi 9000 / 1024², tướng khác 6000 / 512²); boss Toa Đô 7500 nhưng 1024² vì camera áp sát.
  H31h: { src: "design/glb/_raw/H31_hunyuan.glb", tris: 9000, tex: 1024, fix: FIX_H31H, ...ARM_TUBE },
  H33h: { src: "design/glb/_raw/H33_hunyuan.glb", tris: 6000, tex: 512, fix: FIX_H33H, ...ARM_TUBE },
  H40h: { src: "design/glb/_raw/H40_hunyuan.glb", tris: 6000, tex: 512, fix: FIX_H40H, ...ARM_TUBE, rigid: [QUIVER_H40H] },
  X19h: { src: "design/glb/_raw/X19_hunyuan.glb", tris: 7500, tex: 1024, fix: FIX_X19H, ...ARM_TUBE },
  // Đợt hai: lính Tự do, sĩ quan Nguyên, cận vệ (cùng hạng ngân sách với bản Meshy).
  LINH_r01h: { src: "design/glb/_raw/LINH_r01_hunyuan.glb", tris: 9000, tex: 1024, fix: FIX_LINH_R01H, ...ARM_TUBE },
  LINH_r24h: { src: "design/glb/_raw/LINH_r24_hunyuan.glb", tris: 9000, tex: 1024, fix: FIX_LINH_R24H, ...ARM_TUBE },
  OFF_photuongh: { src: "design/glb/_raw/OFF_photuong_hunyuan.glb", tris: 6000, tex: 512, fix: FIX_OFF_PHOTUONGH, ...ARM_TUBE },
  OFF_doitruongh: { src: "design/glb/_raw/OFF_doitruong_hunyuan.glb", tris: 5000, tex: 512, fix: FIX_OFF_DOITRUONGH, ...ARM_TUBE },
  CV_khienh: { src: "design/glb/_raw/CV_khien_hunyuan.glb", tris: 5000, tex: 512, fix: FIX_CV_KHIENH, ...ARM_TUBE },
  CV_giaoh: { src: "design/glb/_raw/CV_giao_hunyuan.glb", tris: 5000, tex: 512, fix: FIX_CV_GIAOH, ...ARM_TUBE, zs: -0.07 },
  CV_cungh: { src: "design/glb/_raw/CV_cung_hunyuan.glb", tris: 5000, tex: 512, fix: FIX_CV_CUNGH, ...ARM_TUBE, zs: 0.06, simp: { w: 2, hi: 4 } },
  CV_songdaoh: { src: "design/glb/_raw/CV_songdao_hunyuan.glb", tris: 5000, tex: 512, fix: FIX_CV_SONGDAOH, ...ARM_TUBE, simp: { w: 2, hi: 4 } },
  CV_daidaoh: { src: "design/glb/_raw/CV_daidao_hunyuan.glb", tris: 5000, tex: 512, fix: FIX_CV_DAIDAOH, ...ARM_TUBE },
  H35: { tris: 9000, tex: 1024, shoulder: 1.441, w: { so: -0.09, ky: 0.12 } },
  H31: { tris: 9000, tex: 1024, shoulder: 1.303, w: { seam: 1 } },
  LINH_r01: { tris: 9000, tex: 1024, shoulder: 1.379 },
  LINH_r24: { tris: 9000, tex: 1024, shoulder: 1.357 },
  H33: { tris: 6000, tex: 512, cut: CUT_H33, shoulder: 1.261, w: { seam: 1, so: -0.09, xc: 0.6 } },
  H40: { tris: 6000, tex: 512, shoulder: 1.334, w: { seam: 1, so: -0.09 } },
  X19: { tris: 7500, tex: 512, cut: CUT_X19, shoulder: 1.324, w: { mirror: 1, seam: 1, so: -0.07 } },
  X20: { tris: 7500, tex: 512, shoulder: 1.29, w: { ky: 0.16 } },
  X24: { tris: 7500, tex: 512, shoulder: 1.356, w: { seam: 1, so: -0.09 } },
  OFF_tuong: { tris: 6000, tex: 512, fix: FIX_OFF_TUONG, w: { seam: 1 }, keep: "35beed2" },
  OFF_photuong: { tris: 6000, tex: 512, shoulder: 1.288 },
  OFF_doitruong: { tris: 5000, tex: 512, shoulder: 1.245, w: { seam: 1, so: -0.09, xc: 0.6 } },
  CV_khien: { tris: 5000, tex: 512, shoulder: 1.39 },
  CV_giao: { tris: 5000, tex: 512, shoulder: 1.435, w: { ky: 0.08 } },
  CV_cung: { tris: 5000, tex: 512, shoulder: 1.4, w: { so: -0.09, xc: 0.6 } },
  CV_songdao: { tris: 5000, tex: 512, shoulder: 1.337 },
  CV_daidao: { tris: 5000, tex: 512, fix: FIX_CV_DAIDAO },
};

// Vũ khí: len = dài thật (m), grip = chỗ nắm tính từ đuôi (m) — design/glb-prompts.md mục G. tris theo bảng mục 1. flip: mẫu Meshy
// dựng ngược (mũi xuống) — đầu dưới là mũi. Bốn thanh kiếm, đao Meshy đều dựng mũi xuống: trước đây nướng không flip nên gốc nắm
// nằm ở mũi lưỡi, chuôi chĩa ra trước. grip đo từ núm chuôi, tay nắm ngay dưới chắn tay (mặt cắt sau flip — chuôi / chắn tay:
// songdao 0,04–0,30 / 0,32; dao 0,04–0,24 / 0,26; dao_linh 0,04–0,27 / 0,30; daikiem 0,08–0,46 / 0,48, tay trái 0,2 dưới tay
// phải vẫn trên chuôi). Đại đao: lưỡi chạy dọc nửa trên cán (0,66–2,32 tính từ đuôi, đĩa chắn tay 0,52), tay phải nắm cán dưới đĩa
// (0,40), còn 0,4 m cán sau tay. head: ghi chân đầu (giáo: chân mũi, đại đao: chân lưỡi) vào meta.head — tua treo ở đó.
export const WEAPONS = {
  songdao: { src: "WPN_songdao", type: "blade", len: 1.05, grip: 0.25, flip: true, tris: 1200 },
  daikiem: { src: "WPN_daikiem", type: "blade", len: 1.55, grip: 0.41, flip: true, tris: 1500 },
  dadao: { src: "WPN_dadao", type: "blade", len: 2.6, grip: 0.4, side: true, flip: true, head: true, tris: 1500 },
  dao: { src: "WPN_dao", type: "blade", len: 1.2, grip: 0.19, flip: true, tris: 1000 },
  dao_linh: { src: "WPN_dao_linh", type: "blade", len: 0.95, grip: 0.22, flip: true, tris: 500 },
  giao_dv: { src: "WPN_giao_dv", type: "blade", len: 3.0, grip: 0.8, head: true, tris: 600 },
  giao_ng: { src: "WPN_giao_ng", type: "blade", len: 2.8, grip: 0.8, head: true, tris: 500 },
  chuy: { src: "WPN_chuy", type: "blade", len: 1.7, grip: 0.27, tris: 800 },
  cung_viet: { src: "WPN_cung_viet", type: "bow", len: 1.45, tris: 800 },
  cung_ng: { src: "WPN_cung_ng", type: "bow", len: 1.3, tris: 500 },
  khien_tron: { src: "WPN_khien_tron_ng", type: "shield", h: 0.74, tris: 500 },
  khien_nhat: { src: "WPN_khien_nhat_dv", type: "shield", h: 0.75, tris: 500 },
  no: { src: "WPN_no", type: "crossbow", len: 0.8, grip: 0.14, tris: 700 },
  mui_ten: { src: "PROP_mui_ten", type: "arrow", len: 0.85, tris: 120 },
};

// Lính đám đông: lods = tam giác thân mỗi mức (LOD0 < 18 m, LOD1 < 40 m, LOD2 xa hơn; ngân sách design/systems.md §13.3 — lính
// LOD0 ≤ 600 điện thoại, ≤ 1.000 PC: cả người lẫn vũ khí ~550–640); vũ khí đặt trong khung cẳng tay như soldiers.js (W.*,
// SHIELD.*): p = điểm nắm, wl = tam giác vũ khí mỗi mức. Neo tua giáo = p + chân mũi đo lúc nướng (kit meta.tas → soldier-motion.js
// TAS; trước đây giáo chỉ dời +z mong chân mũi trùng neo "dài giáo − 0,79" của giáo dựng bằng code, nhưng mũi Meshy dài hơn nên tua
// treo giữa lưỡi). res: cạnh texture nướng của LOD0 (mặc định 512; kỵ binh 1024). LOD2 của vũ khí dài: giảm lưới gộp cán / lưỡi mảnh
// thành đường thẳng trước (sai số chỉ bằng bề dày) — giáo Đại Việt 12 tam giác còn 4 (mất cán, tua treo giữa trời), đao lính 12 chỉ
// còn chắn tay + chuôi: giáo 24, đao 20 (đo phủ trục dài: 87%, 99%). simp: { w } giảm lưới thân giữ trọng số cẳng tay (kit.mjs weldLOD). Giáo binh Đại Việt LOD2
// thân 100 tam giác (90: hai tay mất, người que — bóng chính diện 62% LOD0; models.test kit-bong ≥ 80%).
const HAND = -0.29;
export const KIT_LIST = {
  NG_DAO: { lods: [470, 220, 90], shoulder: 1.382, weapons: [{ id: "dao_linh", bone: "faR", p: [0, HAND, 0], wl: [80, 40, 20] }, { id: "khien_tron", bone: "faL", p: [0, -0.16, 0.14], wl: [70, 28, 10] }] },
  NG_GIAO: { lods: [470, 220, 90], shoulder: 1.305, tassel: "long", weapons: [{ id: "giao_ng", bone: "faR", p: [0, HAND, 0.09], wl: [70, 30, 12] }, { id: "khien_tron", bone: "faL", p: [0, -0.16, 0.12], s: 0.72, wl: [70, 28, 10] }] },
  NG_CUNG: { lods: [470, 220, 90], shoulder: 1.242, weapons: [{ id: "cung_ng", bone: "faL", p: [0, HAND, 0], wl: [80, 30, 12] }] },
  NG_TANK: { lods: [500, 240, 100], shoulder: 1.291, simp: { w: 1 }, weapons: [{ id: "chuy", bone: "faR", p: [0, HAND, 0], wl: [90, 40, 14] }] },
  DV_GIAO: { lods: [470, 220, 100], shoulder: 1.318, tassel: "son", weapons: [{ id: "giao_dv", bone: "faR", p: [0, HAND, 0.11], wl: [70, 30, 24] }] },
  DV_DAO: { lods: [470, 220, 90], shoulder: 1.295, cut: CUT_DV_DAO, weapons: [{ id: "dao_linh", bone: "faR", p: [0, HAND, 0], wl: [80, 40, 20] }, { id: "khien_nhat", bone: "faL", p: [0, -0.14, 0.14], wl: [70, 28, 10] }] },
  // keep (như CHARS): cẳng tay áp sườn, đưa về tay buông thì nếp khuỷu, ống tay áo thành vạt đỏ, gai ở LOD0 khi ngã, khựng — bản 35beed2 sạch
  DV_NO: { lods: [470, 220, 90], fix: FIX_DV_NO, keep: "35beed2", weapons: [{ id: "no", bone: "faR", p: [0, HAND, 0], wl: [90, 40, 14] }] },
  // kỵ binh: [tam giác ngựa, tam giác người cưỡi] mỗi mức; cung ở cẳng tay trái như BUILD.NG_KY (HAND + 0,02 của khung ngựa: −0,27)
  NG_KY: { horse: "MOUNT_ngua_nguyen", shoulder: 1.354, lods: [[440, 360], [170, 140], [70, 60]], weapons: [{ id: "cung_ng", bone: "faL", p: [0, -0.27, 0], wl: [80, 30, 12] }] },
};

// Lính đám đông Hunyuan3D (đợt hai): cùng bảng mức chi tiết, vũ khí, tua như bản Meshy (KIT_LIST ở trên), nướng từ GLB ngoài manifest, khớp tay đo bằng fit-arms.mjs.
// Mã <mã>h chạy song song bản Meshy (tệp nướng cũ còn nguyên; models.js kitOf chọn).
const HUN_KITS = { DV_GIAO: [FIX_DV_GIAOH], DV_DAO: [FIX_DV_DAOH], DV_NO: [FIX_DV_NOH, { simp: { w: 1 } }], NG_DAO: [FIX_NG_DAOH, { lods: [470, 220, 112] }], NG_GIAO: [FIX_NG_GIAOH, { lods: [455, 220, 90] }],
  NG_CUNG: [FIX_NG_CUNGH], NG_TANK: [FIX_NG_TANKH], NG_KY: [FIX_NG_KYH] };
for (const [k, [fix, over]] of Object.entries(HUN_KITS)) {
  const { shoulder, cut, keep, fix: oldFix, ...rest } = KIT_LIST[k];                // khớp, hộp cắt, mẫu giữ của Meshy không áp cho mẫu mới
  KIT_LIST[k + "h"] = { ...rest, src: `design/glb/_raw/${k}_hunyuan.glb`, fix, ...over };
}
