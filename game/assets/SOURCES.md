# Nguồn asset

Toàn bộ asset trong thư mục này được sinh bằng Higgsfield CLI ngày 29/09/2026 (tài khoản của người dùng). Lệnh và prompt đầy đủ nằm trong `../tools/render-assets.sh`.

| File | Model | Ghi chú |
| --- | --- | --- |
| `fx/slash.webp` | GPT Image 2, nền trong suốt, 1k → 512 px | vệt chém |
| `fx/spark.webp` | GPT Image 2 → 256 px | tia lửa khi trúng đòn |
| `fx/smoke.webp` | GPT Image 2 → 256 px | bụi, khói |
| `fx/ring.webp` | GPT Image 2 → 512 px | sóng xung kích |
| `fx/redring.webp` | GPT Image 2 → 512 px | vòng báo đòn viền đỏ, Tuyệt Kỹ boss |
| `fx/fire.webp` | GPT Image 2 → 256 px | lửa (cổng vỡ, đuốc) |
| `fx/embers.webp` | GPT Image 2 → 256 px | tàn lửa Tổng Phản Công |
| `fx/seal.webp` | GPT Image 2 → 512 px | mặt trống đồng (HUD Hào Khí, màn mở Tổng Phản Công) |
| `music/hub.m4a` | Sonilo Music, 120 s | nhạc Doanh trại |
| `music/battle.m4a` | Sonilo Music, 150 s | nhạc trận |
| `music/boss.m4a` | Sonilo Music, 120 s | nhạc P4 Toa Đô và Tổng Phản Công |
| `music/victory.m4a` | Sonilo Music, 30 s | khúc thắng trận |

## Đợt 7 (30/09/2026)

Sinh bằng Higgsfield CLI, lệnh và prompt trong `../tools/render-assets-2.sh`; hậu kỳ `../tools/post-assets-2.py`.

| Thư mục | Model | Ghi chú |
| --- | --- | --- |
| `icons/*.webp` (22) | GPT Image 2, medium, 1k → 192 px WebP q86 | icon chiêu thức, kỹ năng, lệnh; cùng một câu tả phong cách sơn mài (nền then đen, vàng thếp, son đỏ) |
| `sfx/*.wav` (37), `sfx/*.m4a` (8, gồm 2 vòng nền) | Seed Audio 1.0, WAV 44,1 kHz → mono 32 kHz | cắt khoảng lặng đầu (ngưỡng theo từng tiếng, chọn tiếng đầu hoặc tiếng to nhất), cắt độ dài, tắt dần, chuẩn hoá đỉnh −1 dBFS; tiếng ngắn giữ WAV 16-bit (không có khoảng đệm đầu của AAC), tiếng dài hơn 2,5 s mã AAC 96 kbps; hai vòng nền (`ambience`, `fire`) nối đuôi vào đầu 1 s để lặp liền |

Đợt đầu của `hitheavy`, `fall`, `warn`, một bản `bow` ra tiếng ù kéo dài hoặc lên chậm, đã sinh lại với prompt "một tiếng rồi im" (phần `sfx2` của kịch bản); `hurt` không dùng. Số dư tài khoản giảm khoảng 84 credit cho cả đợt (258,8 → 174,4), gồm cả bản thử chất lượng và các lần sinh lại.

Icon Tuyệt Kỹ vẽ bàn tay bóp quả cam: gợi chuyện Trần Quốc Toản bóp nát quả cam ở hội nghị Bình Than (Chính sử, Toàn thư q.5 — như comic B15 khung O2 và canon H35); hình vẽ là Hư cấu.

Hậu kỳ đợt đầu: ảnh thu nhỏ bằng Pillow (LANCZOS) rồi lưu WebP q88. Nhạc mã hóa lại AAC 96 kbps bằng ffmpeg, fade vào 1,2 s và fade ra 2 s để lặp không bị giật.

Mặt trống đồng là hình vẽ gợi Đông Sơn, không chép hoa văn của một hiện vật cụ thể (nhãn Hư cấu).

## Comic B15 trong game (đợt 8)

| Thư mục | Nguồn | Ghi chú |
| --- | --- | --- |
| `comic/B15/*.avif`, `*.webp` (13 khung của biến thể VS: O1–O5, D2, D3, K1–K6) | Nano Banana Pro 2K qua Higgsfield CLI, sinh ngày 29/09/2026 cho comic chương mẫu (xem `hao-khi-viet/comic/B15-ham-tu/NGUON-GOC.md`: prompt, ảnh bị loại, ảnh chỉnh tay) | `tools/bake-comic.py`: cắt 2,5% mỗi cạnh (viền khung AI tự vẽ), cắt đúng tỉ lệ khung, thu về cạnh dài 1552 px, lọc lacquer v1 (bản numpy của bộ lọc SVG trong viewer mẫu + lớp giấy dó), AVIF q52 (2,79 MB cả Chương) + WebP q76 dự phòng. Mỗi ảnh có XMP `DigitalSourceType = compositeWithTrainedAlgorithmicMedia` và mô tả nguồn (sha256 ảnh gốc) — dấu nhận biết nội dung AI máy đọc được (GDD 22.7) |

Ảnh không có chữ. Lời dẫn, bóng thoại, nhãn sử liệu và sáu chữ 破強敵報皇恩 trên cờ do engine vẽ đè từ dữ liệu. Khung K1 thêm chữ trên cờ ngày 30/09/2026 (trước chỉ có sáu ô vàng trống): cờ nghiêng, hai ô cuối khuất sau đầu người lính nên chỉ vẽ bốn chữ đầu.

## Mô hình 3D (02/10/2026)

| Thư mục | Nguồn | Ghi chú |
| --- | --- | --- |
| `models/char/*` (17 nhân vật), `models/kit/*` (8 kiểu lính đám đông), `models/wpn/*` (14 vũ khí, mũi tên) | Meshy API (khoá API của người dùng), mẫu gốc trong `design/glb/` (prompt, mã task, model từng tệp: `design/glb/manifest.json`) | `design/tools/glb-bake.mjs`: chuẩn hoá cỡ, hướng; dò khớp và gắn trọng số da theo rig của game; giảm lưới theo ngân sách (design/systems.md §13.3); lính đám đông 3 mức chi tiết, mức gần trải UV lại bằng xatlas và nướng texture riêng, mức xa tô màu đỉnh; texture WebP q82. Định dạng `.hkm` (lưới nhị phân, đọc bằng `js/battle/glb.js`) |

Tệp tạo bằng gói Meshy trả phí thuộc người tạo; nếu là gói miễn phí thì theo CC BY 4.0 — ghi công: mô hình 3D tạo bằng Meshy (meshy.ai).

| Thư mục | Nguồn | Ghi chú |
| --- | --- | --- |
| `models/char/H35h`, `H31h`, `H33h`, `H40h`, `X19h` (mô hình mặc định của năm tướng, đợt 2026-10-08) | Hunyuan3D 3.1 (tạo qua Krea / trang Hunyuan, từ ảnh tham chiếu dựng bằng model ảnh; prompt ở `design/hunyuan-prompts.md`); GLB gốc ở `design/glb/_raw/` (ngoài git) | Nướng như trên (`design/tools/glb-bake.mjs`, khớp tay đo bằng `design/tools/fit-arms.mjs`). Bản Meshy cũ cùng tướng (`models/char/H35`, `H31`, `H33`, `H40`, `X19`) còn trong thư mục để so sánh. **Chưa xác nhận:** điều khoản sử dụng và ghi công của dịch vụ đã dùng tạo mô hình (Hunyuan3D / Krea, gói của người dùng) — cần kiểm trước khi phát hành. |
| `models/char/LINH_r01h`, `LINH_r24h`, `OFF_photuongh`, `OFF_doitruongh`, `CV_khienh`, `CV_giaoh`, `CV_cungh`, `CV_songdaoh`, `models/kit/DV_GIAOh`, `DV_DAOh`, `DV_NOh`, `NG_DAOh`, `NG_GIAOh`, `NG_CUNGh`, `NG_TANKh`, `NG_KYh` (đợt 2026-10-08, mô hình mặc định của lính Tự do, sĩ quan, cận vệ và lính đám đông) | Hunyuan3D từ ảnh tham chiếu sinh bằng model ảnh `gpt-image-2.5-sunburst` qua dịch vụ ai33 (`design/tools/ai33-img.mjs`; prompt ở `design/hunyuan-prompts.md`); GLB gốc ở `design/glb/_raw/<mã>_hunyuan.glb` (ngoài git) | Nướng như trên (`glb-bake.mjs char` / `kit`, khớp tay `fit-arms.mjs`). Bản Meshy cũ cùng mã (không có chữ `h`) còn trong thư mục. **Chưa xác nhận:** điều khoản sử dụng và ghi công của model ảnh (qua bên thứ ba) và của Hunyuan3D — cần kiểm trước khi phát hành. |
| `models/env/*` (84 vật môi trường: thuyền, công trình, đạo cụ cảnh, cây, đá, núi, thú, hai ngựa và tám đạo cụ bản tĩnh; đợt 2026-10-10) | Hunyuan3D từ prompt môi trường của `design/glb-prompts.md` (mục H, I, K–O), người dùng tạo và thả ở `design/<mã>.glb` ngày 2026-10-09 (ngoài git) | `glb-bake.mjs env` (`design/tools/bake/env.mjs`): phóng về cột "Kích thước thật", giảm lưới (một hoặc hai mức), màu texture nướng thành màu phẳng theo mặt; cổng Hàm Tử, nhà bạt chỉ huy, khán đài giữ texture 1024 trải lại. **Chưa xác nhận:** điều khoản sử dụng và ghi công của Hunyuan3D — cần kiểm trước khi phát hành. |
