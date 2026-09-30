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

Icon Tuyệt Kỹ vẽ bàn tay bóp quả cam: gợi chuyện Trần Quốc Toản bóp nát quả cam ở hội nghị Bình Than (Tương truyền, chép trong sử cũ); hình vẽ là Hư cấu.

Hậu kỳ đợt đầu: ảnh thu nhỏ bằng Pillow (LANCZOS) rồi lưu WebP q88. Nhạc mã hóa lại AAC 96 kbps bằng ffmpeg, fade vào 1,2 s và fade ra 2 s để lặp không bị giật.

Mặt trống đồng là hình vẽ gợi Đông Sơn, không chép hoa văn của một hiện vật cụ thể (nhãn Hư cấu).
