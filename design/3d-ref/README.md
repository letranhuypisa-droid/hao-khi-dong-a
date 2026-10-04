# Ảnh tham chiếu dựng 3D (thử Hunyuan3D)

Mỗi ảnh là **một nhân vật / một người lính** cắt từ khung comic có sẵn của game (`game/assets/comic/`), để đưa vào công cụ ảnh → 3D như Hunyuan3D. Cắt bằng trình duyệt (canvas) từ bản WebP, phóng cạnh dài lên tối thiểu 768 px khi khung gốc nhỏ, lưu JPEG q92. Thư mục `design/` không nằm trong bản dựng Netlify, nên các ảnh này không lên web game.

Prompt để vẽ thêm ảnh hợp dựng 3D (một người / một vật, nền trơn, tay chữ A): `PROMPTS-LINH.md` (lính), `PROMPTS-TUONG.md` (tướng
thời Trần: Đại Việt, quân Tống lưu vong, Mông Cổ / Nguyên), `PROMPTS-MOI-TRUONG.md` (thuyền, công trình, đạo cụ, cây đá).

**Bản Meshy (chữ → 3D) của các prompt này** nằm ở `design/glb-prompts.md`, đúng khuôn mà `design/tools/meshy.mjs` đọc và gửi lên Meshy:
prompt ở đây là prompt vẽ ảnh (Nano Banana, rồi Image to 3D), dài khoảng 1.400 ký tự, cầm binh khí, nên công cụ không dùng được.

| Ở đây | Ở `glb-prompts.md` |
| --- | --- |
| `PROMPTS-TUONG.md`: H31, H33, H34, H35, H38, H39, H40, X19, X20, X24, DT, PT | Mục A1–A7, B1–B6 (DT = `OFF_doitruong`, PT = `OFF_photuong`) |
| `PROMPTS-TUONG.md`: H27–H30, H32, H36, H37, TT, X16–X18, X21–X23, X25 | Mục A8–A15, B7–B13: tay không, POSE v2, người cưỡi ngựa (X16, X21) đứng A-pose, ngựa là tệp riêng |
| `PROMPTS-TUONG.md`: TONG (cung thủ quân Tống) | Mục C4 `DV_AOTONG` (lính đám đông), không thêm mục riêng |
| `PROMPTS-LINH.md` | Mục C, D (lính đám đông, đã tạo GLB) |
| `PROMPTS-MOI-TRUONG.md` | Mục K–O (89 mục), viết lại theo đúng kích thước và số cột buồm, mái chèo game đang dựng; chỗ lệch ghi ở từng mục |

Binh khí của tướng là tệp riêng (`glb-prompts.md` mục G); binh khí riêng của 15 tướng mới chưa có prompt (mục 0.8 của tài liệu đó).

**Nguồn:** khung comic là ảnh do AI vẽ (Nano Banana Pro qua Higgsfield, xem `game/assets/SOURCES.md` và `comic/*/NGUON-GOC.md`). Bản cắt ở đây mất phần XMP đánh dấu nội dung AI của ảnh gốc; dùng lại ở đâu thì ghi rõ là ảnh AI.

| Tệp | Ai / loại quân | Khung gốc | Ghi chú cho dựng 3D |
| --- | --- | --- | --- |
| `tuong-tran-quoc-toan-giuong-co.jpg` | Trần Quốc Toản (H35), giương cờ sáu chữ | B15 O3 | Đứng 3/4 trước, thấy toàn thân; đám gia binh phía sau dính vào, nên xóa trước |
| `tuong-tran-quoc-toan-song-dao.jpg` | Trần Quốc Toản, chạy với song đao | B15 K1 | Nhìn nghiêng, tư thế chạy; cờ đeo lưng |
| `tuong-tran-hung-dao.jpg` | Trần Hưng Đạo (H31), chỉ kiếm | B20 O3 | Toàn thân, áo giáp rõ; người do thám quỳ bên phải dính vào |
| `tuong-tran-khanh-du.jpg` | Trần Khánh Dư (H34), quỳ với đại kiếm | B20 O7 | Tư thế quỳ, nền đêm |
| `dich-toa-do.jpg` | Toa Đô (trùm B15), rìu lớn | B15 K2 | Đứng thẳng, nhìn trước — ảnh tốt nhất cho dựng 3D |
| `dich-toa-do-cuoi-ngua.jpg` | Toa Đô cưỡi ngựa (tham chiếu kỵ binh Nguyên) | B15 O4 | Người + ngựa; lính đi bộ hai bên |
| `dich-o-ma-nhi.jpg` | Ô Mã Nhi (trùm B20) | B20 K2 | Đứng thẳng, nhìn trước; vai lính Đại Việt lấn bên trái |
| `linh-nguyen-dao-thuan.jpg` | Lính Nguyên (đao thuẫn) | B15 K2 | Khung gốc nhỏ (217×489) nên hơi mờ |
| `linh-dai-viet-dao-khien-1.jpg` | Lính Đại Việt đao khiên | B20 K6 | Vẽ như bóng mờ, chân chìm trong sương |
| `linh-dai-viet-dao-khien-2.jpg` | Lính Đại Việt đao khiên | B20 K6 | Như trên |
| `linh-tong-cung-thu-trieu-trung.jpg` | Triệu Trung, cung thủ quân Tống (quân áo Tống) | B15 K1 | Toàn thân, nhìn trước; cung thủ khác dính hai bên |

Mẹo khi đưa vào Hunyuan3D:

- Công cụ tự tách nền, nhưng người đứng sát bên thường bị dính vào mô hình: xóa họ trước (tẩy bằng app chỉnh ảnh) thì mô hình sạch hơn.
- Mô hình giữ đúng tư thế trong ảnh. Muốn gắn xương (rig) để chạy hoạt ảnh thì cần ảnh đứng thẳng, tay dang chữ A/T, nền trơn — comic hiện chưa có ảnh nào như vậy.
- Nét mực dày của comic sẽ in vào texture; ảnh nhìn thẳng (Toa Đô, Ô Mã Nhi) cho mặt trước tốt nhất, mặt sau công cụ tự đoán.
- Các loại lính trong game chưa có ảnh riêng: Thương binh, Cung thủ, Lực sĩ trọng giáp, Cung kỵ của Nguyên; Giáo binh, Nỏ thủ của Đại Việt (`game/js/data/tuning.js` KITS). Prompt vẽ chúng (đứng thẳng tay chữ A, nền trơn, trang bị theo mô hình trong game): `PROMPTS-LINH.md`.

## Gắn xương cho GLB

Mở `game/rig.html` (chạy máy chủ tĩnh trong `game/`, ví dụ `python3 -m http.server`, rồi vào `/rig.html`): chọn tệp GLB → công cụ tự
gắn xương theo rig tướng của game, cho xem mô hình chạy đúng các đòn của game, rồi **Xuất GLB** (có xương và 18 clip). Mô hình để gắn
xương nên **tay không**: trong prompt, thay đoạn cầm binh khí bằng `empty open hands relaxed at his sides, no weapon`, binh khí sinh
riêng (game gắn binh khí vào xương bàn tay). Mô hình phải đứng thẳng tay chữ A, nhìn thẳng; dò sai thì dùng các thanh "Chỉnh khớp".

