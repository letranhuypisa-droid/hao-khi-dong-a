# Hào Khí Đông A — bản thử B15 Hàm Tử (PROTO)

Game hành động Nam Quốc Sơn Hà, quyển Nhà Trần. Bản này dựng theo tab **Đặc tả prototype (mục 21)** và **Mục 15 · Kỹ thuật (web)** của GDD, cộng phần tiến triển ở mục 12 (GDD để phần đó cho VS; bản này làm sớm theo yêu cầu).

Engine: three.js r186.1 (vendor trong `vendor/three/`), JavaScript ES module thuần, không build step.

## Chạy

```bash
node tools/dev-server.mjs 8942
```

Mở `http://localhost:8942/hao-khi-viet/game/`. Thêm `?debug` để có `window.__hk`, `__bot`, `__state` và `__hk.advance(giây, bot)` (tua trận không cần khung hình).

Xem hoạt ảnh lính và tướng theo từng trạng thái: mở `http://localhost:8942/hao-khi-viet/game/lab.html` (chỉ dùng khi phát triển; tham số ở đầu `js/lab.js`).

Kiểm thử phần thuần (mô phỏng, Hào Khí, tiến triển, kiểu lính):

```bash
node hao-khi-viet/game/tests/run.mjs
```

## Có gì

| Phần | Nội dung | Nguồn GDD |
| --- | --- | --- |
| Bản đồ | Bến Hàm Tử 600 × 400 m, sông Hồng mép bắc và mép đông, 2 mặt trận cách 150 m, bản doanh, 2 đồn, 2 doanh trại, Hàm Tử quan có 2 cổng, bãi cát cho boss | 21.2 (bố cục Hư cấu) |
| Cảnh | Màu đất theo nhiễu (cỏ tươi, cỏ khô, đất trống, đầm ven sông, đất cháy quanh trại Nguyên); ruộng lúa bậc thềm có bờ, ô ngập nước, mạ, lúa chín; lũy tre quanh làng, cây đa đầu làng, cau; 4 gò đá giữa hai mặt trận; cỏ, hoa dại; bến gỗ, thuyền nan; giáo cắm, khiên rơi, tên cắm, xe hỏng dọc làn; lều cháy, hòm, thùng, khói ở trại Nguyên; núi xa, mây. Cột cờ che camera thì tự mờ | Hư cấu (scenery.js) |
| Tướng | H35 Trần Quốc Toản, song đao WC03: N1–N6, C1–C4 (C5 mở ở cấp 5, C6 ở cấp 10), Lướt N/C, Né 0,25 s, Đỡ 120°, phản đòn, Phá Trận 3 lần lao, Tuyệt Kỹ "Bóp Nát Quân Thù", Đòn Quyết khi Vỡ Thế, Gượng dậy | 3, 21.6 |
| Địch | Lính, tinh nhuệ, Đội trưởng, Phó tướng, Toa Đô (rút chạy khi hết Sinh lực); khiên binh và cung kỵ; thẻ tấn công theo độ khó; đòn viền đỏ báo trước 0,6 s | 11.1, 21.6 |
| Kiểu lính | Khiên binh Nguyên chia thành Đao thuẫn (đao + khiên tròn), Thương binh (tầm 2,5 m), Cung thủ bộ (bắn 16 m) và Lực sĩ trọng giáp (chùy lang nha, máu ×3, đòn nặng cắt được đòn của tướng, đòn N không đẩy lùi được). Giáo binh Đại Việt chia thành Giáo binh, Đao khiên, Nỏ thủ. Mô phỏng 1 Hz vẫn chỉ biết binh chủng | 21.5 (mở rộng) |
| AI | Lính có thẻ tấn công chia góc vây quanh tướng (có người đánh sườn, đánh lưng), lính chờ đứng thành vòng thưa; khiên binh đỡ đòn N trúng trước mặt; lính nhảy lùi khi tướng gồng đòn nặng; cung thủ lùi giữ tầm; lực sĩ lao húc (trúng thì tướng ngã); vỡ trận khi sĩ quan chết, khi tướng tung Tuyệt Kỹ, khi tướng hạ ≥ 6 lính trong 4 s; thân binh ưu tiên kẻ đang đánh tướng. Sĩ quan gầm thị uy khi phát hiện tướng, đi vòng thăm dò, bắt lỗi lúc tướng hồi đòn/vừa né, chuyển sang đòn viền đỏ khi tướng cứ đứng đỡ, lùi né khi bị dồn 3 đòn | ĐỀ XUẤT (AI trong tuning.js) |
| Hoạt ảnh | Lính có khớp (hông, thân, tay trên, cẳng tay, đùi, cẳng chân; kỵ binh có 4 chân ngựa): bước chân theo quãng đi, thế thủ theo vũ khí, báo trước → đánh → hồi thế, trúng đòn ngả theo hướng, hất tung lộn người, nằm rồi chống dậy, 4 kiểu ngã. Tướng: đòn dựng bằng khung khoá (gồng → chém → theo đà → hồi), cổ tay lật lưỡi đao, bước chân khi chém, lộn khi né, vệt lưỡi đao | 21.4 (thủ tục) |
| Quân ta | Mô phỏng 1 Hz theo công thức 4.2, Sĩ Khí, tuyến, sụp đổ cánh, tiếp viện hai phe; vùng chiến đấu r 25 m (30 địch + 20 ta); lính diễn ở tuyến theo số lính hiển thị | 4, 15.2 |
| Chỉ huy | 4 Mệnh Lệnh (Tiến công, Giữ vững, Theo ta, Gọi tiếp viện), đồng hồ trận ×0,2 khi mở vòng; 2 sự kiện động (Cứ Điểm bị phản công, Tướng ta bị vây) có thể tự làm hoặc giao cho quân | 4.5, 4.8, 21.2 |
| Hào Khí | Nguồn tăng/giảm, mốc 25/50/75/100, suy giảm sau 45 s, Hào Khí dư, Tổng Phản Công 25 s, Tuyệt Kỹ Hào Khí | 5, 21.6 |
| Pha | P1 chiếm A1 → P2 chiếm A2 → P3 phá cổng → P4 Toa Đô; checkpoint đầu pha; thua khi hết Gượng dậy, mất bản doanh, quá 30 phút | 21.2 |
| Tiến triển | Cấp 1–35 theo EXP_next = 50L² + 250; cây kỹ năng 27 nút (3 nhánh, 1 nút đỉnh); binh khí bậc Thường → Danh, rèn +1…+5, ô Khắc 7 dòng, Đúc thép; quân đoàn (giáo binh, thân binh); Doanh trại 3 cấp; 3 tiền tệ | 12 |
| Vật phẩm | Cơm nắm, Rượu thuốc, Túi quân lương, Cờ lệnh, Rương Cứ Điểm; rơi cố định theo điều kiện, không ngẫu nhiên | 4.4, 12.12 |
| Kế Sách | "Cờ áo Tống" (Lớn +20, Chính sử): hộ tống 2 thuyền quân Triệu Trung cập bến, bấm G → cánh Nguyên hoang mang. "Mũi tên thư" (Nhỏ +10, Tương truyền, chỉ Trận chuẩn): 3 bó tên ở làng → Nguyễn Khoái → bắn thư vào doanh trại. Máy trạng thái Khóa → Khả dụng → Sẵn sàng → Kết quả, không hồi chiêu | 5.6, 5.7, hồ sơ B15 |
| Chế độ | Trận nhanh (par 10, Hào Khí ×1,3, thưởng ×0,6, 1 Kế Sách, cửa sổ ×0,75) và Trận chuẩn (par 15, thưởng ×1, 2 Kế Sách) | 13.7, 5.6 |
| Võ trường | Doanh trại cấp 3: Luyện tập (chọn bậc địch), Đua KO bến Hàm Tử (180 s, 150/220/300), Thử thách thời gian theo seed, Seed tuần (tuần ISO giờ VN); Đồng bộ cấp; bảng điểm cục bộ; huy chương 5/10/15 Tinh thiết; 4 tuần Vàng → binh khí Danh | 13.5, 12.9 |
| Xếp hạng | Diem = 35M + 15T + 20Q + 20C + 10K (K = Kế Sách); S ≥ 85, A 70–84, B 50–69 | 2.3, 5.6 |
| Asset | 8 ảnh hiệu ứng (GPT Image 2, nền trong suốt) và 4 bài nhạc (Sonilo Music) sinh bằng Higgsfield CLI — xem assets/SOURCES.md, tools/render-assets.sh | — |
| Điều khiển | Bàn phím + chuột, tay cầm (Gamepad API), cảm ứng | 15.8 |

## Đề xuất của bản thử (GDD chưa chốt số)

Những chỗ dưới đây là số bản thử tự đặt, ghi `ĐỀ XUẤT BẢN THỬ` trong code; cần thiết kế chính duyệt:

- Thời lượng từng đòn WC03 (chọn để DPS đơn mục tiêu ≈ 1,6 MV/s ở ×1,0); Phá Thế = 14 × MV.
- Hệ số Sĩ Khí theo 5 dải; cánh vỡ trận tập hợp lại ở Sĩ Khí 25.
- Cung kỵ dùng thẻ tấn công riêng (≈ 2/3 số thẻ cận chiến).
- Cổng Hàm Tử quan có 30 "quân giữ cổng".
- Lính vây đánh tướng đồng minh chỉ gây 0,2 sát thương; có lệnh ở mặt trận thì quân ta hạ một lính của toán mỗi 2,5 s.
- Liên hoàn WC03: mỗi 10 đòn trúng thì +4% tốc đánh trong 6 s, tối đa 3 tầng.
- C5, C6 mở theo cấp tướng (5 và 10).
- Kế Sách: vị trí đường thuyền và bến, 3 toán giữ bờ, máu thuyền 1.500, +80 quân Triệu Trung cho cánh A, cửa sổ 40 s, dựng lại sau 60 s; làng và vị trí bó tên (Hư cấu); "2 đội phụ trợ" = 24 người.
- Trận chuẩn: par 15 phút, KO par 600.
- Võ trường: ước lượng thời gian bố cục, Vàng ≤ 0,75 ×, Bạc ≤ 1,05 × ước lượng; Đua KO chạy trên sân tập thay vì từ checkpoint B15.
- Thua vẫn nhận 25% EXP.
- Nguồn rơi vật phẩm trong trận.
- Kiểu lính (KITS trong `tuning.js`): tỉ lệ trong binh chủng, hệ số máu/công/giáp/tốc, tầm chém, tầm bắn, thời gian báo trước. Lực sĩ máu ×3, công ×1,6, tốc ×0,72; đòn N của tướng chỉ làm khựng, đòn có knock ≥ 5 hoặc hất tung mới làm bật. Kiểu lính chọn theo băm id, không ăn vào chuỗi rng của trận.
- Tên của cung thủ, nỏ thủ trúng lính thường tính như đòn cận chiến giữa hai đám lính (×0,8 cho quân ta, ×0,6 cho địch). Trước đây tên nhắm lính thường không gây sát thương.
- AI (khối `AI` trong `tuning.js`): tỉ lệ đỡ khiên 30% (đao thuẫn, đao khiên), 15% (thương binh), đỡ xong nhận 25% sát thương, nghỉ 1,4 s; nhảy lùi 20% (lính thường), 45% (tinh nhuệ); cung thủ lùi khi tướng dưới 40% tầm bắn; lực sĩ húc 5–11 m, ×2,6 tốc, 0,9 s, hồi 8 s, sát thương ×1,25; vỡ trận 2,5–4,5 s trong 22 m quanh sĩ quan chết, 12 m quanh Tuyệt Kỹ. Sĩ quan lùi né 40% khi trúng 3 đòn trong 1,5 s, hồi 5 s; đứng đỡ quá 1,2 s thì sĩ quan chuyển sang đòn viền đỏ.
- Bộ đệm input: phím bấm lúc đang ra đòn được giữ tới khi đòn kế được phép (bấm dồn), ngoài ra giữ 0,15 s.

## Khác với mục 15

- Lính vẽ bằng `InstancedMesh` skinned: 10 khúc thân gộp một lưới, ma trận khớp tính trên CPU rồi đọc từ texture float trong vertex shader (gần với hướng three-vat của mục 15, nhưng hoạt ảnh vẫn thủ tục, chưa có clip nướng). Mỗi kiểu lính một lượt vẽ. Lính xa tướng hơn 40 m chỉ tính lại tư thế mỗi 3 khung. Cả trận khoảng 120 lượt vẽ, 470 nghìn tam giác (kể cả lượt đổ bóng) trên máy phát triển.
- Mô phỏng chạy trên luồng chính, chưa tách Worker.
- Vùng chiến đấu dùng `Math.sin` và `Math.hypot`, nên chưa xác định từng bit giữa các trình duyệt. Mô phỏng 1 Hz thì xác định (có kiểm thử).
- Lưu bằng localStorage, có nút xuất/nhập file, thay cho IndexedDB.
- SFX tổng hợp bằng Web Audio; nhạc nền là file stream qua phần tử audio.
- Chưa có: thuyền cho tướng, ngựa, benchmark hạng máy, comic trong trận; nút Mưu "Đốt kho" chưa có tác dụng vì B15 không có kho lương.
