# Nguồn gốc ảnh — comic chương Hàm Tử (B15)

| Mục | Giá trị |
| --- | --- |
| Ngày sinh ảnh | 29/09/2026 |
| Công cụ | Higgsfield CLI, model `nano_banana_pro`, độ phân giải 2K |
| Người chạy | chủ tài khoản Higgsfield của dự án (qua `_tool/render.mjs`) |
| Prompt | `PROMPTS.md` (sinh từ `panels.json` + `_shared/bible.json` bằng `node _tool/render.mjs B15-ham-tu --dump --force`) |
| Số ảnh dùng | 4 tờ nhân vật mới (Trần Quốc Toản, Trần Nhật Duật, Triệu Trung, Toa Đô — lưu ở `_shared/refs/`, dùng chung các chương) + 15 khung |
| Số lần sinh | 24 (5 ảnh bị loại, 1 lần lỗi mạng 520 khi tải ảnh tham chiếu lên) |

Ảnh bị loại và lý do (`renders/_rejected/`):
- O5, D1 bản 1: có ô trống hoặc dải đen phía trên. Nguyên nhân là câu prompt cũ "để trống phần trên cho chữ".
- D2 bản 1: AI tự vẽ một ô lời dẫn tiếng Anh sai chính tả. Đã bỏ mọi chữ "lettering/caption" khỏi prompt và đổi câu mở của khối STYLE thành "A single full-bleed illustration" (xem `_tool/render.mjs`).
- D2 bản 2: giữ phần cảnh chính, cắt bỏ dải khung phụ phía trên (bản trước khi cắt lưu kèm).
- K3 bản 1: sông đỏ thẫm dễ đọc thành máu. Đã sinh lại với nước vàng nhạt, xanh ngọc.

Ảnh đã chỉnh tay: K5 cắt viền đen và chỉ vàng do AI tự vẽ; D2 cắt dải khung phụ.

Chữ Hán trên cờ (破強敵報皇恩) không nằm trong ảnh. Ảnh chỉ vẽ cờ đỏ có 6 ô vàng trống; viewer vẽ chữ đè lên (trường `signs` trong `panels.json`). Nhờ vậy chữ luôn đúng nét, và đổi chữ không phải sinh lại ảnh.

Mọi ảnh do AI tạo: khi phát hành phải khai báo trong mục nội dung AI của Steam (xem mục 22 của GDD).
