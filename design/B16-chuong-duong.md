# B16 Chương Dương: kế hoạch dựng

Chương thứ ba theo thứ tự Quyển VI (VI·5, ngay sau Hàm Tử). Canon: `design/canon.json` → `battles` B16, `heroes` H32 và H35, `enemies` X18.

## Đã làm

### Đợt 1: bản thử greybox (2026-10-10, commit 4ea4db2)

- **Dựng tạm trên đất Hàm Tử** (cách của chế độ Tự do):
  - Bờ bắc là bến Chương Dương.
  - Khu có tường phía đông đứng thay kinh thành Thăng Long: B3 là cổng nam, A3 là cổng đông.
- **Tệp**:
  - `game/js/sim/b16.js`: luật thuần.
  - `game/js/battle/director-b16.js`
  - `game/js/battles/b16.js`
  - `game/js/data/battle-b16.js`
  - `game/js/data/comic-b16.js`, `suquan-b16.js`
- **Đăng ký trận**: `ownHero` (H35 của người chơi), R 13 cố định, Trận nhanh.
- **Lối chơi**: 5 pha (dân binh, đánh úp bến, cổng nam, Thoát Hoan, điện chính) và 2 Kế Sách. Chi tiết ở dòng "B16 Chương Dương" của `game/README.md`.

### Đợt 2, 3, 4 (văn bản), 6 (2026-10-10, commit c2fa490, 0644aca)

- **Báo động bến** xảy ra khi:
  - tướng bước lên đê;
  - lính canh thấy tướng: 14 m ngoài lau sậy, chỉ 3,5 m trong lau sậy;
  - hoặc thuyền đầu tiên bốc cháy.
  - Cửa sổ Kế Sách Đánh úp tính từ lúc báo động.
- **Hai kho quân nhu**: 12 s sau báo động, lính cầm đuốc chạy tới đốt kho. Nhãn chỉ đường trỏ vào họ. Giữ được cả hai kho là một nhiệm vụ phụ.
- **Đoạt Giáo**: quân giữ bến chia 7 đội, cộng 4 cặp lính canh. Hạ hết người một đội là tước đội đó; đủ 10 đội là một nhiệm vụ phụ. Nhiệm vụ phụ nay theo canon: 3 làng, Đoạt Giáo, kho.
- **Phản công bến**: 60 s sau khi chiếm bến, 12 lính đổ bộ.
  - Sức giữ bến tụt tối đa 1,5 mỗi giây, nên mất bến không dưới 60 s. Về 0 là thua (canon).
  - 8 dân binh tự ở lại giữ bến.
  - Giữ đủ 90 s hoặc dẹp hết lính phản công là xong.
- **Vương Kỳ Trấn Nam** (đợt 3):
  - 3 cờ ở rìa sân điện. Còn cờ đứng thì Thoát Hoan không xuống dưới 50% Sinh lực, qua `BigUnit.floorPct` (tùy chọn, trận khác không đặt).
  - Lần đầu chạm sàn, Thoát Hoan gọi hộ vệ (Hộ Vệ Hoàng Tử).
  - Cờ chém bằng đòn của tướng qua móc tùy chọn `director.strikeables?()` trong `hero.js`.
- **Thẻ Sử quán**: Kế Sách chỉ mở thẻ khi thành công, như B20.
- **Nội dung văn bản** (đợt 4):
  - 9 thẻ Sử quán, trong đó có bài "Tụng giá hoàn kinh sư" kèm bản dịch nghĩa trung tính. Chữ "Hồ" chỉ có trong thẻ này; có test kiểm.
  - 11 câu Quiz, qua `lintQuiz`.
  - Tất cả mang `review: "draft"`.
- **Cân bằng** (đợt 6):
  - Đo bot: Quân sĩ 554 s và 594 s; Tướng quân 622 s kèm 2 lần tải lại.
  - Par các pha nay là 150 / 210 / 240 / 90 / 30, tổng 12:00.
- **Kiểm vết bot B15**: cùng seed, cùng `Date.now`/`Math.random`. Ảnh chụp `__state()` 132 s đầu của bản đợt 1 và bản này trùng mã băm. Các móc dùng chung không đổi B15.

## Còn lại

- **Comic** mở chương, kết chương, khung "Tụng giá hoàn kinh":
  - `comic/B16-chuong-duong/panels.json`, tranh từ ai33 (cần khóa API của người dùng; khóa không được lưu), rồi `tools/bake-comic.py`.
  - Khi có comic: gắn `panels` vào thẻ và câu Quiz.
- **Mô hình**:
  - H32 Trần Quang Khải: Hunyuan, lớp cung WC09 (bảng đòn, hoạt ảnh), kỹ năng "Đoạt Giáo Chương Dương", "Loạt Tên Bến Sông", Tuyệt Kỹ "Tụng Giá Hoàn Kinh". Khi có, bỏ cánh mô phỏng ở cổng đông.
  - X18 Thoát Hoan: mô hình riêng; hiện mượn `OFF_tuong`.
- **Bản đồ** Đồng bằng có module cổng thành, qua `ground.setBattleTerrain` như B20. Làng, bến, thuyền dùng các GLB `ENV_*` khi có chế độ bake `env`.
- **Canon chưa làm**:
  - Vương Kỳ cho quân Nguyên trong 40 m Thủ +15%.
  - "Sĩ Khí cánh ở bến ảnh hưởng tốc chiếm cổng".
  - Hai phó tướng giữ bến hiện chỉ là sĩ quan thường.
- **Cân bằng thêm**:
  - Đo thêm seed và độ khó Dân binh, Nguyên soái.
  - Bot chưa gọi làng thứ ba và chưa giữ kho, nên hai nhiệm vụ phụ đó chưa đo được.

## Lưu ý

- Không đổi `buildWorld`, `director.js`, `sim/front.js` của B15: vết bot B15 phải giữ nguyên từng byte.
- Id cổng giữ A3/B3 vì `world.js` dựng cổng theo BASES của B15.
- Thoát Hoan đích thân giữ thành là Hư cấu, đã ghi trong `HISTORY_NOTES` và thẻ X18.
