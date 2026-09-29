# Hào Khí Đông A — bản thử B15 Hàm Tử (PROTO)

Game hành động Nam Quốc Sơn Hà, quyển Nhà Trần. Bản này dựng theo tab **Đặc tả prototype (mục 21)** và **Mục 15 · Kỹ thuật (web)** của GDD, cộng phần tiến triển ở mục 12 (GDD để phần đó cho VS; bản này làm sớm theo yêu cầu).

Engine: three.js r186.1 (vendor trong `vendor/three/`), JavaScript ES module thuần, không build step.

## Chạy

```bash
node tools/dev-server.mjs 8942
```

Mở `http://localhost:8942/hao-khi-viet/game/`. Thêm `?debug` để có `window.__hk`, `__bot`, `__state` và `__hk.advance(giây, bot)` (tua trận không cần khung hình).

Kiểm thử phần thuần (mô phỏng, Hào Khí, tiến triển):

```bash
node hao-khi-viet/game/tests/run.mjs
```

## Có gì

| Phần | Nội dung | Nguồn GDD |
| --- | --- | --- |
| Bản đồ | Bến Hàm Tử 600 × 400 m, sông Hồng mép bắc và mép đông, 2 mặt trận cách 150 m, bản doanh, 2 đồn, 2 doanh trại, Hàm Tử quan có 2 cổng, bãi cát cho boss | 21.2 (bố cục Hư cấu) |
| Tướng | H35 Trần Quốc Toản, song đao WC03: N1–N6, C1–C4 (C5 mở ở cấp 5, C6 ở cấp 10), Lướt N/C, Né 0,25 s, Đỡ 120°, phản đòn, Phá Trận 3 lần lao, Tuyệt Kỹ "Bóp Nát Quân Thù", Đòn Quyết khi Vỡ Thế, Gượng dậy | 3, 21.6 |
| Địch | Lính, tinh nhuệ, Đội trưởng, Phó tướng, Toa Đô (rút chạy khi hết Sinh lực); khiên binh và cung kỵ; thẻ tấn công theo độ khó; đòn viền đỏ báo trước 0,6 s | 11.1, 21.6 |
| Quân ta | Mô phỏng 1 Hz theo công thức 4.2, Sĩ Khí, tuyến, sụp đổ cánh, tiếp viện hai phe; vùng chiến đấu r 25 m (30 địch + 20 ta); lính diễn ở tuyến theo số lính hiển thị | 4, 15.2 |
| Chỉ huy | 4 Mệnh Lệnh (Tiến công, Giữ vững, Theo ta, Gọi tiếp viện), đồng hồ trận ×0,2 khi mở vòng; 2 sự kiện động (Cứ Điểm bị phản công, Tướng ta bị vây) có thể tự làm hoặc giao cho quân | 4.5, 4.8, 21.2 |
| Hào Khí | Nguồn tăng/giảm, mốc 25/50/75/100, suy giảm sau 45 s, Hào Khí dư, Tổng Phản Công 25 s, Tuyệt Kỹ Hào Khí | 5, 21.6 |
| Pha | P1 chiếm A1 → P2 chiếm A2 → P3 phá cổng → P4 Toa Đô; checkpoint đầu pha; thua khi hết Gượng dậy, mất bản doanh, quá 30 phút | 21.2 |
| Tiến triển | Cấp 1–35 theo EXP_next = 50L² + 250; cây kỹ năng 27 nút (3 nhánh, 1 nút đỉnh); binh khí bậc Thường → Danh, rèn +1…+5, ô Khắc 7 dòng, Đúc thép; quân đoàn (giáo binh, thân binh); Doanh trại 3 cấp; 3 tiền tệ | 12 |
| Vật phẩm | Cơm nắm, Rượu thuốc, Túi quân lương, Cờ lệnh, Rương Cứ Điểm; rơi cố định theo điều kiện, không ngẫu nhiên | 4.4, 12.12 |
| Xếp hạng | Diem = 35M + 15T + 20Q + 20C + 10K; S ≥ 85, A 70–84, B 50–69 | 2.3 |
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
- Thua vẫn nhận 25% EXP.
- Nguồn rơi vật phẩm trong trận.

## Khác với mục 15

- Lính vẽ bằng `InstancedMesh`, hoạt ảnh thủ tục (chưa có texture xương three-vat, chưa có clip nướng).
- Mô phỏng chạy trên luồng chính, chưa tách Worker.
- Vùng chiến đấu dùng `Math.sin` và `Math.hypot`, nên chưa xác định từng bit giữa các trình duyệt. Mô phỏng 1 Hz thì xác định (có kiểm thử).
- Lưu bằng localStorage, có nút xuất/nhập file, thay cho IndexedDB.
- Âm thanh tổng hợp bằng Web Audio, chưa có SFX thư viện.
- Chưa có: Kế Sách, thuyền, ngựa, Võ trường, benchmark hạng máy, comic trong trận.
