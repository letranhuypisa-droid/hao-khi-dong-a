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

Hậu kỳ: ảnh thu nhỏ bằng Pillow (LANCZOS) rồi lưu WebP q88. Nhạc mã hóa lại AAC 96 kbps bằng ffmpeg, fade vào 1,2 s và fade ra 2 s để lặp không bị giật.

Mặt trống đồng là hình vẽ gợi Đông Sơn, không chép hoa văn của một hiện vật cụ thể (nhãn Hư cấu).
