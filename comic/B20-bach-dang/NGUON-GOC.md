# Nguồn gốc ảnh — comic chương Bạch Đằng (B20)

| Mục | Giá trị |
| --- | --- |
| Ngày sinh ảnh | 29/09/2026 |
| Công cụ | Higgsfield CLI, model `nano_banana_pro`, độ phân giải 2K |
| Người chạy | chủ tài khoản Higgsfield của dự án (qua `render.mjs`) |
| Prompt | `PROMPTS.md` (sinh từ `panels.json` bằng `node render.mjs --dump --force`) |
| Số ảnh dùng | 5 tờ nhân vật + 14 khung |
| Số lần sinh | 25 (6 ảnh bị loại, lưu ở `renders/_rejected/` kèm lý do trong tên file) |

Ảnh bị loại và lý do:
- O1, O2 bản 1: có dải trống hoặc hộp trắng ở mép trên (prompt cũ "chừa chỗ cho chữ"); O2 còn tự viết chữ "DAI VIET" lên bản đồ.
- O4 bản 1 và bản 2: lính đội mũ giáp giống quân Nguyên. Nguyên nhân: script chọn khối trang phục theo từ khóa, nên câu phủ định "no Yuan soldiers" lại kéo khối trang phục quân Nguyên vào prompt. Đã sửa bằng trường `costume` khai báo riêng cho từng khung.
- O5 bản 1: có tường thành ở cửa sông.
- K6 bản 1: lính cổ đứng lẫn với nhà khảo cổ trên một cánh đồng đỏ.

K6 bản 2 được giữ có chủ đích: hình bóng quân Trần hiện như ký ức phía trên cảnh khảo cổ.

Mọi ảnh do AI tạo: khi phát hành phải khai báo trong mục nội dung AI của Steam (xem mục 22 của GDD). Lời dẫn và lời thoại do viewer chèn, không nằm trong ảnh.
