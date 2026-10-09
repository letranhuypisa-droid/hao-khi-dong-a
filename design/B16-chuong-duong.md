# B16 Chương Dương: kế hoạch dựng

Chương thứ ba theo thứ tự Quyển VI (VI·5, ngay sau Hàm Tử). Canon: `design/canon.json` → `battles` B16, `heroes` H32 và H35, `enemies` X18.

## Đã làm: đợt 1, bản thử greybox (2026-10-10)

- **Dựng tạm trên đất Hàm Tử** (cách của chế độ Tự do):
  - Bờ bắc là bến Chương Dương.
  - Khu có tường phía đông đứng thay kinh thành Thăng Long: B3 là cổng nam, A3 là cổng đông.
  - Bản đồ "Đồng bằng + module cổng thành" của canon chưa dựng.
- **Tệp**:
  - `game/js/data/battle-b16.js`: dữ liệu, toạ độ, pha, Kế Sách, ghi chú sử.
  - `game/js/sim/b16.js`: luật thuần.
  - `game/js/battle/director-b16.js`: sinh lính, vật, HUD, điểm lưu.
  - `game/js/battles/b16.js`: BattleDef, bản đồ nhỏ, bot.
  - `game/js/data/comic-b16.js`, `suquan-b16.js`: rỗng.
- **Test**: `game/tests/b16-sim.test.mjs` (18 mục). `battles.test.mjs` có thêm mục danh mục B16.
- **Luật và lối chơi**: 5 pha (dân binh, đánh úp bến, cổng nam, Thoát Hoan, điện chính) và 2 Kế Sách. Chi tiết ở dòng "B16 Chương Dương" của `game/README.md`.
- **Đã kiểm**: bot thắng một lượt Quân sĩ trong 7:26.

## Còn lại, theo đợt

### Đợt 2: luật cho đủ canon

- Kế Sách Đánh úp bến:
  - Đi lối lau sậy (`REEDS`) thì không báo động.
  - Đi đường đê (`DYKE`) hoặc bị lính canh thấy thì báo động.
  - Hiện tại: tới gần bến là báo động.
- Hai kho quân nhu trên bến: quân Nguyên tự đốt sau khi báo động (nhiệm vụ phụ canon "không để kho bị đốt").
- Đoạt Giáo: tước vũ khí 10 đội lính giữ bến (nhiệm vụ phụ canon). Cần gắn thẻ đội cho lính.
- Mất bến sau khi đã chiếm thì thua (canon). Cần thêm một đợt phản công vào bến trong P3.
- Thứ tự mở thẻ Sử quán: theo luật của B20 (chỉ khi Kế Sách thành công) hay B15 (thành hay bại đều mở). Sửa ở `meta/chapter.js battleUnlockKeys`.

### Đợt 3: Thoát Hoan đủ cơ chế

- 3 Vương Kỳ Trấn Nam quanh sân điện:
  - Cờ còn đứng thì quân Nguyên trong 40 m Thủ +15%.
  - Phá đủ 3 cờ thì mất khiên vương giả.
- Bản rút gọn 2 pha: dưới 50% Sinh lực thì gọi hộ vệ và rút vào giữa đội hình.
- Phá cờ cần đòn đánh được vào vật: móc tùy chọn `director.strikeables?()` trong `hero.js` sau vòng lặp cổng. B15 và B20 không có móc này nên vết bot không đổi.

### Đợt 4: nội dung

- Comic mở chương, kết chương, khung "Tụng giá hoàn kinh": `comic/B16-chuong-duong/panels.json`, sinh tranh bằng ai33 như B15 và B20, rồi `tools/bake-comic.py`.
- ≥ 8 thẻ Sử quán và ≥ 10 câu Quiz, sau đó bỏ miễn trừ "Chương đang dựng" trong `tests/battles.test.mjs`.
- Bài thơ có chữ "Hồ": chỉ xuất hiện trong thẻ Sử quán, kèm bản dịch nghĩa trung tính, không đọc trong trận (canon `sensitivity`).

### Đợt 5: hình và mô hình

- H32 Trần Quang Khải: mô hình Hunyuan, lớp cung WC09 (bảng đòn, hoạt ảnh), 3 kỹ năng và Tuyệt Kỹ "Tụng Giá Hoàn Kinh".
- X18 Thoát Hoan: mô hình riêng. Hiện mượn `OFF_tuong`.
- Bản đồ Đồng bằng có module cổng thành (dùng lại ở E8), qua `ground.setBattleTerrain` như B20. Làng, bến, thuyền neo dùng các GLB `ENV_*` đã có ở `design/` khi có chế độ bake `env`.

### Đợt 6: cân bằng

- Đo nhiều seed và nhiều độ khó bằng bot.
- Par từng pha.
- Cỡ toán lính, độ bền cổng, máu Thoát Hoan. Ở lượt đo đầu, P4 chỉ ~30 s: quá nhanh.

## Lưu ý

- Không đổi `buildWorld`, `director.js`, `sim/front.js` của B15: vết bot B15 phải giữ nguyên từng byte.
- Id cổng giữ A3/B3 vì `world.js` dựng cổng theo BASES của B15.
- Thoát Hoan đích thân giữ thành là Hư cấu, đã ghi trong `HISTORY_NOTES`.
