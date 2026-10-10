# B17 Tây Kết: kế hoạch dựng

Chương thứ tư theo thứ tự Quyển VI (VI·6, ngay sau Chương Dương). Canon: `design/canon.json` → `battles` B17, `heroes` H30 và H40, `enemies` X19 và X20.

Trạng thái: **đợt A1 (greybox) và phần boss của A2 đã dựng** trên nhánh `claude/happy-lichterman-f0e557` (2026-10-10, chưa gộp vào `main`); phần còn lại của A2, A3–A6 và mạch B chưa làm.

## Đã làm

### Gộp main (mô hình ENV) và phần rẻ của A4 (2026-10-10)

- **Gộp `main` cd6832b** vào nhánh (mô hình ENV nướng ở đất Hàm Tử, B16, B20, Võ trường): không xung đột.
- **Vết bot B15** trên nhánh sau khi gộp trùng mã băm với `main` cd6832b ở cả 6 mốc (cùng cách đo, `main` phục vụ từ `git archive`).
- **A4, phần rẻ**:
  - B17 nạp trước đất Hàm Tử cùng 3 mẫu đầm: `env` ở `data/battles.js`, danh sách `ENV_B17`.
  - Đước ở góc hai bãi lau, bè cỏ trên bãi lầy bờ bắc, lùm cây ven sông gần cửa sông (`MARSH_PROPS`): gộp một lưới, không va chạm. Chưa nạp mô hình thì bỏ.
  - Cột cờ mốc cửa sông dùng `ENV_cot_co` như B16.
- **Lệnh vẽ sau khi gộp** (đo có bóng, bot seed 1001, mỗi 5 s):
  - B17: đỉnh 162 ở giây 5, trung bình 123, 3/61 mẫu quá 150. Ở khung đỉnh, phần đất Hàm Tử là 125; phần riêng B17 là 37 (7 đơn vị lớn, vật trận, lau, gò, vật đầm).
  - Cùng cách đo sau khi gộp ENV: B15 đỉnh 206, B16 đỉnh 219 (trung bình 135). Trước khi gộp, B17 đỉnh 121.
  - Việc cần làm chung cho đất Hàm Tử, không riêng B17: gộp hoặc instancing vật ENV, bớt bóng của vật xa.
- Bot B17 sau khi gộp vẫn thắng 298 s; bot B16 528 s.

### Đợt A2, phần boss (2026-10-10, cùng nhánh)

- **`BigUnit`** (`units.js`, tùy chọn; không đặt thì như cũ, có test trong `b17-sim.test.mjs`):
  - `fate: "killed"`: về 0 Sinh lực thì tử trận. Ngã theo clip `death` đúng nhịp, nằm lại tới hết trận, không rút chạy. Gọi `director.onBossKilled`.
  - `lastStand`: Chí Tử Chiến dưới 25% Sinh lực. Công +30%; cứ 8 s một đòn bổ đất, sóng chấn r 6 m, báo trước 1 s, không đỡ được. Dùng trạng thái `"ult"` với `this.slam`, nên bot né như Tuyệt Kỹ của Toa Đô B15.
- **Toa Đô B17** đặt cả hai. Lúc tử trận: `ctx.cinematic` (camera lùi, chậm hình), băng chữ "Toa Đô tử trận"; không máu, không thủ cấp.
- **Quân Viễn Chinh** (`sim/b17.js`): từ P2, cứ 180 s Sĩ Khí cánh −10. Dưới 40 thì lính hộ tống Công −15%. Về 0 thì đội hình vỡ như phục kích.
- **Kiểm chứng**: test xanh. Bot B17 seed 1001 thắng 298 s, Chí Tử Chiến bật ở 282 s (bot hạ Toa Đô trước cú bổ đầu; cú bổ kiểm trong khung trình duyệt và test Node). Vết B15 trùng mã băm; bot B16 528 s; bot B20 thắng 168 s.
- **Chưa làm của A2**: Phá Trận Thủy Bộ (thuyền đổ bộ), Ô Mã Nhi và bến tàn quân (2 nhiệm vụ phụ còn lại), sứ giả (Kế Sách Nhỏ, bãi thứ hai), vua Nhân Tông AI với điều kiện thua, Yết Kiêu.

### Đợt A1: bản thử greybox (2026-10-10)

- **Tệp mới**:
  - `game/js/data/battle-b17.js`: tọa độ, `ROUTE`, `COLUMN`, `OUTPOSTS`, `BEDS`, `AMBUSH`, `MUD`, `PHASES`, `PAR_B17`, `KE_SACH`, `KS_ORDER`, `SIDE_MISSIONS`, `HISTORY_NOTES`.
  - `game/js/sim/b17.js`: luật thuần, `snapshotB17` / `restoreB17`, lớp phủ `overlayB17()` (`mudB17`, `moundDh`).
  - `game/js/battle/director-b17.js`, `game/js/battles/b17.js`.
  - `game/js/data/comic-b17.js`, `suquan-b17.js`: rỗng.
  - `game/tests/b17-sim.test.mjs`: 17 mục, gồm dựng world B17 thật trong Node rồi gỡ.
- **Móc dùng chung** (đều tùy chọn; không đặt thì B15, B16, B20 như cũ):
  - `ground.js setOverlay({ mud, dh, mounds })`. `setTerrain` và `battle.js resetGround` gỡ lớp phủ; `battles/b17.js dispose` cũng gỡ.
  - `terrain-rules.js speedFactor(…, mounted)` và `TERRAIN.mudMounted` (kỵ chậm gấp đôi trong bùn). `crowd.js` chỉ truyền khi trận có lớp phủ bùn.
  - `perchNear` xét thêm gò của lớp phủ.
  - `BigUnit.march = { x, z, v }`: đi theo cánh, không ra đòn, vẫn nhận đòn (khác `script`).
  - `world.terrain`: lưới mặt đất, để B17 tô màu đầm.
- **Đăng ký và chỗ cứng theo Chương**: `data/battles.js` (R 16, `ownHero`, `wip`, `noComic`, heroes H30 H40, playable H35, models X19 X20 H31 H38), `main.js` (LEAD, COMIC_INFO), `meta/chapter.js` (`strict`), `css/lobby.css` (ảnh tạm O4, D3 của B15), `debug.js`.
- **Lối chơi**: xem dòng "B17 Tây Kết" của `game/README.md`.
- **Khác kế hoạch**:
  - Tốc cánh 1,8 m/s chứ không phải 1,1. Lần đo bot đầu: hạ đủ 3 đồn lúc ~100 s thì cánh chỉ còn 0,56 m/s, tới bãi tây ở phút 7, bot đứng chờ ~5 phút.
  - Toa Đô "tử trận" lúc đầu mượn nhánh ngã của sĩ quan (`BigUnit.dead`); phần boss của A2 (trên) thay bằng `fate: "killed"`.
  - Chỉ có Kế Sách Lớn; nhiệm vụ phụ chỉ có "Phục kích thành công" (2 nhiệm vụ phụ còn lại cần Ô Mã Nhi và thuyền, đợt A2).
  - Ghi chú "ai giết Toa Đô" mang nhãn Chính sử: nó nói về điều sử ghi, không phải chuyện game đặt ra.
- **Kiểm chứng**:
  - `node game/tools/run-tests.mjs` xanh.
  - Bot B17 Quân sĩ, seed 1001: thắng 296 s (4:56), không tải lại. P3 mở ở 252 s, Toa Đô đổ trong ~30 s.
  - Lệnh vẽ tối đa đo được 121 (trần 150).
  - Vết bot B15 (seed 1001, 6 mốc tới 252 s): trùng mã băm `__state()` và lính với bản trước móc. Phải xoá save trước mỗi lượt, vì cờ gợi ý đã xem làm đổi `msgs`.
  - Bot B16 vẫn thắng (528 s).
- **Việc còn thấy khi đo**:
  - Bot hạ 3 đồn quá nhanh (~100 s) rồi đứng chờ ~2,5 phút ở chỗ chờ phục kích. Đợt A2 lấp khoảng này (sứ giả, thuyền đổ bộ, Yết Kiêu).
  - Toa Đô đổ nhanh (~30 s ở R 16); Chí Tử Chiến (A2) sẽ kéo dài.

## Canon tóm tắt

- **Sử**: Toa Đô không biết Thoát Hoan đã rút, kéo quân về Tây Kết (Khoái Châu) định ra biển. Quân Trần đánh tan, Toa Đô tử trận. Vua Nhân Tông cởi áo ngự sai khâm liệm ông. Ô Mã Nhi và tàn quân chạy ra biển.
- **Tướng chơi được**:
  - H30 Trần Nhân Tông, lớp WC12 Quạt & bút.
  - H40 Nguyễn Khoái, lớp WC09 Cung.
- **Đồng minh AI**: H31 Hưng Đạo vương ở bản doanh, H38 Yết Kiêu và H39 Dã Tượng (cả hai Tương truyền).
- **Địch**: X19 Toa Đô (boss, **bị giết**) và X20 Ô Mã Nhi (giữ bến tàn quân).
- **Kế Sách**:
  - Lớn: Phục kích bãi lau.
  - Nhỏ: Hỏi kế Quốc công.
  - Quyết sách ★ là Phục kích bãi lau.
- **Thua** khi:
  - tướng người chơi gục;
  - vua Nhân Tông gục (khi chơi Nguyễn Khoái, vua là tướng AI chỉ huy cánh chính);
  - Toa Đô tới mốc cửa sông.
- **Khác**:
  - Tổng Phản Công: Chuẩn 25 s.
  - Trận chuẩn dài 24 phút.
  - Bản đồ "Sông", biến thể lầy.
- **Nhạy cảm**:
  - Không có cảnh chém đầu, không hiện thủ cấp.
  - Cảnh áo ngự là điểm nhấn danh dự của phe địch.
  - Không gán công giết Toa Đô cho ai.
  - Cảnh hỏi kế ở mở màn là Hư cấu về bối cảnh (việc hỏi kế thật ghi năm 1287).

## Quyết định chính (đề xuất)

1. **Tướng chơi: H40 Nguyễn Khoái, dựng lớp Cung WC09.**
   - Mô hình H40h đã bake, có sẵn cung `cung_viet` ở tay trái và ống tên.
   - WC09 thuộc P1 – R1 và phục vụ 3 tướng: H32 Trần Quang Khải (B16 đang "sắp có"), H40, và H48 (U1).
   - Canon có sẵn nhánh "chơi Nguyễn Khoái, vua là AI", nên trận đứng được với một tướng chơi.
   - H30 để "sắp có", như H32 ở B16. Lý do: WC12 cần vẽ vùng/đường trên mặt đất, bẫy, mô hình vua và quạt/bút, tức nặng hơn WC09.
2. **Tướng tạm trong lúc chờ WC09: H35 của người chơi** (`ownHero`, như B16).
   - Mục đích: Chương chơi thử được sớm để người dùng góp ý.
   - Khi H40 xong thì bỏ H35 khỏi B17, vì H35 không có mặt ở Tây Kết theo canon.
3. **Bản đồ: dựng trên đất Hàm Tử** như B16.
   - Tây Kết và Hàm Tử cùng vùng Khoái Châu.
   - B20 không hợp: cửa biển 1,2 km, đồi cao, nước sâu, lớp thủy chiến gắn chặt với địa hình B20.
   - Thêm một **lớp bùn và gò bật/tắt được**. Khi tắt, B15 phải giữ nguyên từng byte.
4. **Hai mạch làm song song**, mỗi mạch một worktree:
   - Mạch A: Chương (luật, đạo diễn, bản đồ, nội dung).
   - Mạch B: lớp Cung WC09 và H40 chơi được.
   - Tệp chung dễ đụng nhau: `main.js`, `debug.js`, `data/battles.js`. Gộp mạch A trước, mạch B sau.
5. **Boss "bị giết"**: thêm nhánh tùy chọn trong `BigUnit`.
   - Hiện mọi `tier: "tuong"` về 0 Sinh lực đều rút chạy (`units.js:407`).
   - Thêm Chí Tử Chiến. B15 và B20 không đặt cờ nên không đổi.
6. **Đăng ký trận**: R 16 cố định (+3 sau B16, như thang R1), Trận nhanh, `wip`, `noComic` cho tới khi có comic.

## Bố cục bản đồ (đề xuất, chỉnh khi đo)

Trục của B15: x từ tây sang đông 0–600, z từ bắc xuống nam −200…200. Sông chạy dọc mép bắc (z < −168) rồi vòng mép đông (x > 588). Cửa biển là góc đông bắc.

| Điểm | Vị trí | Dùng lại |
|---|---|---|
| Bản doanh Hưng Đạo vương (H31, AI đứng yên) | HQ_TA (34, 0) | Bản doanh B15 |
| Điểm xuất phát cánh Toa Đô | (120, −75) trên đường A | — |
| Đồn 1 | A1 (210, −75) | Đồn có tường B15 |
| Đồn 2 | A2 (335, −75) | Doanh trại có tường B15 |
| Bãi lau tây | x 370–440, hai bên đường A | Lau dựng kiểu B16 (`director-b16.js:193`) |
| Đồn 3 | Cổng A3 của Hàm Tử quan (462, −75): chiếm vòng ở cổng | Cổng B15 |
| Bãi lau đông | x 495–555, z −95…−145 | Lau dựng kiểu B16 |
| Bến tàn quân (Ô Mã Nhi) | khoảng (530, −172), cạnh 7 thuyền lớn có sẵn | Thuyền B15 (`world.js:417`) |
| Mốc cửa sông | khoảng (588, −160): cờ và vòng | Mới |
| Sứ giả (Kế Sách Nhỏ) | làng (172, 144) → bản doanh | Làng B15 |

- **Lộ trình cánh Toa Đô**: đường A → A1 → A2 → bãi lau tây → cổng A3 → bãi lau đông → mốc cửa sông. Dài khoảng 490 m.
- **Lớp bùn**:
  - Ngoài đường và gò, trong vùng đầm (dải bờ bắc, hai bãi lau, quanh bến), chậm 25%; kỵ binh chậm 50%.
  - Mặt đường đê (đường A) không chậm. Vì vậy cánh Toa Đô đi đường đê nhanh hơn người chơi lội đầm.
- **Gò**:
  - Mỗi bãi lau có 3 gò thấp (cao 1,2–1,8 m, bán kính 5–7 m), làm đấu trường boss "nước ngang gối, 3 gò".
  - Cung binh trên gò được thêm tầm qua luật có sẵn `terrain-rules.js:50` (+12% mỗi mét, trần 25%). Gò cao khoảng 1,7 m cho chừng +20% như canon.
  - `perchNear` phải biết các gò mới.
- **Ngân sách vẽ**:
  - B15 đang 128 lệnh vẽ, trần T2 là 150, nên B17 thêm tối đa khoảng 20.
  - Lau, gò, vũng nước gộp lưới hoặc dùng instancing.
  - Màu đầm đổi bằng màu đỉnh của mặt đất trong vùng đầm, trả lại khi gỡ trận.

## Luật

### Cánh Toa Đô hành quân (Mở Đường Ra Biển)

- **Trạng thái thuần** `col.s`: quãng đường đã đi trên lộ trình, theo mẫu `along`/`routeLen` của xe húc B16 (`sim/b16.js:13-24`).
- **Thành phần cánh**:
  - Toa Đô (BigUnit X19, cần chế độ "hành quân mà vẫn đánh được"; `BigUnit.script` hiện miễn đòn).
  - 2 sĩ quan.
  - Khoảng 30 lính hiện hình đi theo vị trí lệch quanh điểm đầu cánh.
  - Giữ danh sách lính dạng `{a, id}` (bẫy crowd tái dùng lính chết, xem B16).
- **Tốc độ cơ bản** (đề xuất): khoảng 1,1 m/s, nên không bị cản thì tới cửa sông sau chừng 7:30.
  - Mỗi đồn ta chiếm: × 0,8 (canon).
  - Toa Đô giao chiến với tướng ta: cánh dừng, nhưng tối đa 20 s mỗi lần rồi lại đẩy tiếp.
  - Hồi giao chiến 30 s. Nhờ vậy người chơi không giam được cánh mãi.
- **Từ lúc đội hình vỡ** (phục kích thành công) **hoặc Toa Đô dưới 50%**: ông từ chối rút, lên gò gần nhất cố thủ, và cánh thôi đi.
- **HUD**:
  - thanh "đường ra biển" có vạch 3 đồn và 2 bãi lau, như thanh của B20 (`hud-b20.js:232`);
  - dấu trên bản đồ nhỏ và nét đứt lộ trình, như B16.
- **Tới mốc cửa sông là thua.**

### Ba đồn

- A1, A2 dùng vòng chiếm và quân đồn trú như B15 (`garrison.js`, `fortRoute`). Đồn 3 là vòng ở cổng A3.
- **Chiếm đồn trước khi cánh đi qua**: cánh phải đánh xuyên qua. Đề xuất: đồn ta giữ chặn cánh 15 s, rồi lính đồn rút ra.
- **Chiếm sau khi cánh đã qua**: vẫn tính nhiệm vụ và vẫn × 0,8.
- Hạ đủ 3 đồn là nhiệm vụ chính, tính điểm. Thắng trận chỉ cần hạ Toa Đô.

### Phục kích bãi lau (Kế Sách Lớn)

- **P1**: chọn 1 trong 2 bãi lau bằng `hud.picker` ở bản doanh. Hết 60 s mà chưa chọn thì mặc định bãi tây.
- **Hai cánh phục binh**, mỗi cánh khoảng 10 lính, nhận lệnh qua vòng Mệnh Lệnh như dân binh B16 (`director-b16.js:345`): Giữ vững, Xung trận, Theo ta, Gọi tiếp viện.
- **Điều kiện (canon)**:
  1. Cả 2 cánh đang "Giữ vững" trong vùng.
  2. Tướng ta ở ngoài 40 m cho tới lúc Toa Đô vào vùng.
  3. Bấm Lệnh Kế Sách (G) trong 30 s.
- **Cần nút kích thật**. B16 chấm Kế Sách tự động và không dùng `trigger()`. Đề xuất: giữ máy trạng thái trong `sim/b17.js` (thuần, test được); `director.keSach.trigger` chỉ đặt cờ `inp.ksPress`.
- **Thành công**:
  - +20 Hào Khí;
  - cánh Toa Đô −40 Sĩ Khí;
  - đội hình vỡ: một nửa lính hộ tống tán loạn;
  - Toa Đô mất lượt đổ bộ Phá Trận Thủy Bộ.
- **Thất bại**: tướng ở trong 40 m lúc Toa Đô vào (lộ phục binh), cánh không giữ vững, hoặc hết cửa sổ. Khi đó phục binh vẫn đánh nhưng không có thưởng.
  - Còn cơ hội ở bãi thứ hai nếu Kế Sách Nhỏ đã xong.
  - Kế Sách thành công tối đa 1 lần mỗi trận.

### Hỏi kế Quốc công (Kế Sách Nhỏ)

- **Khi chơi Nguyễn Khoái (và H35 tạm)**: hộ tống sứ giả từ làng (172, 144) về bản doanh.
  - Sứ giả chỉ đi khi tướng ở trong 15 m, như xe húc B16.
  - 2 toán lính Nguyên chặn đường.
  - Phải xong trước khi phục kích nổ.
  - Cái giá: kéo tướng khỏi đường A khoảng 90 s, nên đổi lấy ít thời gian chiếm đồn.
- **Khi chơi Nhân Tông (sau này)**: kỹ năng "Hỏi Kế Quốc Công" dùng trước phục kích.
- **Thưởng**: +10 Hào Khí, và bãi lau thứ hai có thêm phục binh (2 cánh nữa), tức là có lần phục kích thứ hai.

### Toa Đô (X19)

- **Mô hình** X19h có sẵn, lớp EWC02.
- **Quân Viễn Chinh**: cứ 3 phút, cánh −10 Sĩ Khí.
  - Sĩ Khí cánh hiện trên HUD.
  - Đề xuất: dưới 40 thì lính hộ tống Công −15%; về 0 thì đội hình vỡ như khi phục kích.
- **Phá Trận Thủy Bộ**: cứ 30 s, 2 thuyền đổ bộ ở điểm bờ gần tướng ta nhất.
  - Canon là 15 lính mô phỏng mỗi thuyền; game hiện khoảng 5 lính mỗi thuyền, tùy trần crowd.
  - Dùng `landBoat` của `kesach.js` hoặc nhóm thuyền kiểu B16.
  - Mất khi phục kích thành công.
- **Chí Tử Chiến** (dưới 25%, tùy chọn mới trong `BigUnit`):
  - không rút, Công +30%;
  - cứ 8 s một đòn đại phủ bổ xuống tạo sóng chấn r 6 m, viền đỏ, báo trước 1 s, không đỡ được.
- **Bị giết** (`fate: "killed"`, tùy chọn mới):
  - ngã bằng clip `death` có sẵn trong `clips.json`;
  - không máu me, không thủ cấp, camera lùi xa;
  - băng chữ "Toa Đô tử trận".
- **Khóa Sinh lực khi đang hành quân**: nếu bị đánh lúc cánh còn đi, chặn ở 50% cho tới khi ông "đứng lại". Cách này giữ đúng thứ tự pha.

### Ô Mã Nhi và bến tàn quân

- **Ô Mã Nhi** (X20, mô hình có sẵn) giữ bến với khoảng 12 lính.
- **Thuyền rời bến**: cứ 60 s một thuyền chở tàn quân rời bến chạy ra cửa sông.
  - Nhiệm vụ phụ canon: không để thuyền nào qua mốc.
  - Với H35 tạm: đốt thuyền lúc còn neo (đứng sát 2,5 s, như B16).
  - Với H40: bắn chìm thuyền, kéo thuyền bằng Móc Tên, chặn bằng Chặn Dòng.
- **Đuổi Ô Mã Nhi** (Sinh lực về 0, ông xuống thuyền rút theo nhánh rút sẵn có) trước một mốc giờ:
  - canon: phút 20 ở Trận chuẩn;
  - Trận nhanh: đề xuất 8:00.
  - Đuổi xong thì bến thôi xuất thuyền.
- **P4**: dù chưa bị đuổi, ông cũng bỏ bến ra biển. Có một khung comic chèn khi có comic.

### Đồng minh

- **H31 Hưng Đạo vương**:
  - đứng ở bản doanh, mô hình H31h;
  - giao việc ở P1 và là đích của sứ giả.
- **H30 Nhân Tông** (khi chơi H40 hoặc H35 tạm):
  - dẫn cánh chính khoảng 16 lính, tự đánh đồn chưa chiếm gần nhất;
  - dưới 30% thì lui về bản doanh, hồi trong 40 s rồi quay lại. Lý do: vua gục là thua, phải tránh thua oan.
  - Chưa có mô hình: mượn `OFF_photuongh` đổi áo vàng (như B16 mượn `OFF_tuong` cho Thoát Hoan), cho tới khi bake H30.
- **H38 Yết Kiêu** (Tương truyền, mô hình H38h):
  - 2 lần trồi lên từ lạch bên sườn cánh Toa Đô, hạ vài lính và đục 1 thuyền đổ bộ;
  - băng chữ có nhãn Tương truyền.
- **H39 Dã Tượng**: hoãn (chưa có mô hình người, chưa có voi). Chỉ nhắc trong thẻ Sử quán.

### Pha, par và nhiệm vụ phụ

| Pha | Kích hoạt | Việc | Par Trận nhanh (đề xuất) |
|---|---|---|---|
| P1 Bàn kế ở bản doanh | Mở màn | Chọn bãi lau; có thể đi đón sứ giả | 60 s |
| P2 Đường ra biển | Toa Đô bắt đầu hành quân | Hạ 3 đồn; đối phó thuyền đổ bộ; Yết Kiêu quấy rối | 240 s |
| P3 Bãi lau | Toa Đô vào vùng phục kích đã chọn | Cửa sổ Kế Sách 30 s | 90 s |
| P4 Chí tử chiến | Toa Đô đứng lại (đội hình vỡ hoặc dưới 50%) | Đánh boss trên gò; Chí Tử Chiến dưới 25%; Ô Mã Nhi bỏ bến | 180 s |
| P5 Áo ngự | Toa Đô bị hạ | Dẹp tàn quân quanh đấu trường (≤ 8) hoặc chờ 20 s rồi thắng | 30 s |

- **Tổng par Trận nhanh**: 10:00. Đo lại bằng bot như B16.
- **Nhiệm vụ chính**:
  1. Chặn cánh Toa Đô.
  2. Hạ 3 đồn.
  3. Hạ Toa Đô.
- **Nhiệm vụ phụ**:
  1. Phục kích thành công ở ít nhất 1 bãi lau.
  2. Đuổi Ô Mã Nhi trước mốc giờ.
  3. Không thuyền nào qua mốc cửa sông.
- **Màn kết quả**: `cLabel` "Đồn, bãi lau, bến".
- **Tải lại đầu pha** như B16. Phải lưu: `col.s`, Sĩ Khí cánh, đồn đã chiếm, bãi đã chọn, trạng thái Kế Sách, số thuyền đã qua mốc, trạng thái Ô Mã Nhi.

## Mạch A: Chương

### A1. Bản thử greybox

- **Tệp mới**:
  - `data/battle-b17.js`: tọa độ, `PHASES`, `PAR_B17`, `KE_SACH`, `KS_ORDER`, `SIDE_MISSIONS`, `HISTORY_NOTES`.
  - `sim/b17.js`: luật thuần (cánh hành quân, đồn, phục kích, cửa sông, pha), có `snapshotB17`/`restoreB17`.
  - `battle/director-b17.js`
  - `battles/b17.js`: `buildWorld(scene, {forts: true})` rồi ẩn vòng và cờ tuyến như B16.
  - `comic-b17.js`, `suquan-b17.js`: rỗng.
- **Lớp bùn và gò bật/tắt** trong `ground.js` (ví dụ `setOverlay({mud, dh})`).
  - Thêm tham số kỵ binh cho `speedFactor`.
  - Gỡ trận phải xóa lớp phủ, vì `ground` là trạng thái cấp module.
- **Đăng ký**:
  - Thẻ đặt sau B16, trước B20 (`BATTLE_ORDER`).
  - R 16, `ownHero`, `wip`, `noComic`.
  - `heroes: ["H30", "H40"]`, `playable: ["H35"]` (tạm).
  - `models: ["X19", "X20", "H31", "H38"]`.
- **Chỗ cứng theo Chương**: `main.js` (LEAD, COMIC_INFO), `meta/chapter.js` (`strict`: thẻ Kế Sách chỉ mở khi thành công), `css/lobby.css` (ảnh thẻ tạm), `debug.js` (bot `battle.debug.objective`).
- **Bot**:
  - đi chiếm đồn đi trước cánh;
  - ra khỏi 40 m lúc Toa Đô gần bãi;
  - bấm G, đánh boss, lên gò.
- **Đủ khi**: bot thắng một lượt Quân sĩ, và mọi test xanh.

### A2. Boss, bến, đồng minh

- `BigUnit` thêm `fate: "killed"`, Chí Tử Chiến và chế độ hành quân đánh được. Cả ba tùy chọn, có test chứng minh B15 và B20 không đổi.
- Phá Trận Thủy Bộ, Quân Viễn Chinh, Sĩ Khí cánh.
- Ô Mã Nhi, thuyền rời bến, bộ đếm qua mốc cửa sông.
- Sứ giả (Kế Sách Nhỏ) và bãi thứ hai có phục binh.
- Vua AI (mô hình mượn) với điều kiện thua; Yết Kiêu quấy rối.

### A3. Nội dung chữ

- **Ít nhất 8 thẻ Sử quán**, mỗi thẻ ghi rõ nhãn (Chính sử, Tương truyền, Hư cấu):
  - Tây Kết;
  - Toa Đô (sử Nguyên ghi ông tử trận khi rút; truy tặng thụy Tương Mẫn);
  - áo ngự;
  - Nguyễn Khoái và quân Thánh Dực;
  - Hưng Đạo vương ở Tây Kết, theo một số tài liệu hiện đại;
  - Ô Mã Nhi chạy ra biển;
  - Yết Kiêu, Dã Tượng (Tương truyền);
  - "Ai giết Toa Đô: sử không ghi".
- **Ít nhất 10 câu Quiz**, qua `lintQuiz`. Tất cả `review: "draft"`.
- **Test nhạy cảm** (như B16 kiểm chữ "Hồ"):
  - chữ trong trận không có "thủ cấp", "chém đầu";
  - khẩu hiệu thích trên tay năm 1285 chứa từ miệt thị, nên chỉ được nhắc trong Sử quán, không hiện trong trận (canon H30).

### A4. Hình

- **Gộp nhánh ENV trước** (`claude/glb-copy-check-ee5bad`, commit fbd1c8a; fast-forward được từ `main` 6cff030). Sau đó thay đồ giả bằng GLB `ENV_*`:
  - thuyền: `ENV_thuyen_song_nguyen`, `ENV_chien_thuyen_nguyen`;
  - bến: `ENV_ben_go`, `ENV_cau_tau_*`, `ENV_toi_neo`;
  - đồn: `ENV_thap_canh_nguyen`, `ENV_rao_coc`;
  - đầm: `ENV_be_co`, `ENV_co_dung`, `ENV_duoc`, `ENV_lum_cay_ven_song`.
  - Lau và gò vẫn dựng bằng code: chưa có GLB.
- **H30**: bake từ GLB Hunyuan khi người dùng tạo xong (ảnh tham chiếu đã có: `design/glb/_raw/img/best/H30.png`). Làm theo công thức `fit-arms` + catalog + `models.test`.
- **Mốc cửa sông**: cờ, vòng, sóng nhẹ.

### A5. Chuyển sang H40 và cân bằng (sau B2)

- `playable: ["H40"]`, bỏ H35 khỏi B17, bot nhánh tầm xa.
- Đo par bằng bot: nhiều seed, các độ khó Dân binh, Quân sĩ, Tướng quân, Nguyên soái.
- Chỉnh tốc cánh, giờ dừng giao chiến, máu Toa Đô, cỡ toán đổ bộ.

### A6. Comic (cần khóa API ai33 của người dùng)

- Mở chương (Hư cấu: hỏi kế ở bản doanh), khung chèn "Ô Mã Nhi ra biển", kết chương (Chính sử: áo ngự, không hiện thủ cấp).
- Thêm `council` để có màn Hiến kế (Quyết sách: ★ Phục kích bãi lau; Đánh chặn trực diện trên sông khi Toa Đô xuống thuyền; Để Toa Đô ra biển, dồn quân đuổi Thoát Hoan).
- Gắn `panels` vào thẻ và Quiz, rồi bỏ `noComic`.

## Mạch B: lớp Cung WC09, H40 chơi được

Đặc tả: `design/systems.md` §4.4 (WC09: MV 0,68 · tốc 1,2, Phá Thế 0,6, tầm N 25 m, bắn khi di chuyển, loạt 5 tên) và §3.3 (ngắm tầm xa). Tiền lệ là cách WC01 được thêm lên trên WC03; danh sách tệp ở dưới.

### B1. Lõi lớp (lớn)

- **Dữ liệu**:
  - `weapon-classes.js`: thêm WC09.
  - `data/moves-wc09.js`: bảng đòn và `MOVE_INFO`.
  - `heroes.js`: thêm H40, gồm `cls`, `rig`, `moves`, `stats` theo canon (Công 3, Thủ 3, Tốc 3, Tầm 5, Thống Suất 3).
- **Bảng đòn đề xuất**:
  - N1–N5: bắn đơn nhanh. N6: tỏa 3 tên.
  - C1: tên nặng phá khiên. C2: đá hoặc quất cung hất tung rồi lùi.
  - C3: giữ để bắn liên thanh. C4: mưa tên quanh mình r 5 m.
  - C5: tên xuyên hàng. C6: mưa tên vùng r 6 m tại mục tiêu.
  - DN: lộn lùi bắn. DC: né rồi tên nặng.
  - DQ: bắn sát mặt sĩ quan vỡ thế. CT: quất cung rồi bắn sát.
- **Tên bay thật**:
  - Thêm cách tính đòn "tia" có số xuyên và trễ theo thời gian bay trong `hero.js applyHits`. Hiện chỉ có nón, vòng, đường lướt, và trúng ngay.
  - Dùng lại bộ vẽ tên của `crowd.js` (`fireArrow`, instancing 200) và mẫu "đòn hẹn giờ" của `guard.js:253`.
- **Ngắm**:
  - Tự nhắm theo nón ±30° tới 25 m, gồm cả lính thường. Hiện tự nhắm chỉ 6,5 m, khóa chỉ nhắm BigUnit.
  - PC: tâm ngắm giữa màn; giữ chuột phải (C) để ngắm chính xác.
- **Khí Lực**: nới bán kính giao chiến cho lớp tầm xa (hiện 12 m, nên cung thủ ở 25 m không tích được).
- **Hoạt ảnh thủ tục**:
  - Mở rộng `A.shoot` thành kéo, ngắm, buông.
  - Bắn khi chạy cần tách thân trên khỏi thân dưới (mức vừa).
  - Thêm tên cầm tay (`wpn/mui_ten.hkm` có sẵn nhưng chưa dùng).
- **Tệp chạm theo tiền lệ WC01**: `hero.js`, `hero-anim.js`, `anim-wc09.js` (mới), `moves-info.js`, `controls.js` (nhãn), `hints.js`, `ui/guide.js`, `lab.js`, `riglab/bake.js`, `debug.js` (bot tầm xa), `hud.js`, `css/game.css`, `main.js` (nút hướng dẫn).
- **Test**: `wc09.test.mjs` (DPS gần 1,3 MV/s, xuyên, thời gian bay, nón ngắm), `hero-def.test.mjs`.

### B2. Kỹ năng H40

- **Tên Xuyên Hàng**: 5 tên nặng, 30 m, mỗi tên xuyên 4. Mục tiêu thứ 4 bị ghim 1,5 s (lính: dùng `stun` có sẵn; BigUnit: cần trạng thái mới).
- **Chặn Dòng Dụ Địch**: phao chặn 15 m trong 15 s. Dùng lại cảnh phao của B20 và `Boat.stop()`. Cần móc đạo diễn mới.
- **Thánh Dực Dũng Nghĩa** (nội tại): cần móc chạy nội tại. Hiện `hero.js` chưa chạy nội tại nào.
- **Tuyệt Kỹ Móc Tên Trói Thuyền**: kéo 10 m và trói 4 s một thuyền, hoặc một tướng trong 35 m; boss mất 50% Phá Thế.
  - Cần hệ trạng thái cho BigUnit (ghim, trói, kéo), mức vừa.
  - Cắt máy 2 s kiểu "lướt theo đòn". Hiện chưa có hệ mẫu camera; làm riêng như các Tuyệt Kỹ khác.
- **Đặc tính chỉ huy Thánh Dực Quân** (cung, nỏ ta +20% tầm): đưa vào cánh phục binh B17.

### B3. Clip bắn cung từ Mixamo

- Gói cung dài trên Mixamo: kéo, ngắm, giật, đi và đi ngang khi ngắm.
- Người dùng tự đăng nhập trong khung trình duyệt; tôi chỉ bấm tải.
- Rồi `bake-clips.mjs` (Blender không màn hình) → `clip-moves` cho WC09. Kiểm trượt chân như clip chạy (`clips.test.mjs`).
- Sau B3 thì H32 Trần Quang Khải chỉ còn thiếu mô hình để chơi được ở B16.

## Việc cần người dùng

1. **Gộp nhánh ENV** `claude/glb-copy-check-ee5bad` vào `main` (fast-forward). Cần trước A4.
2. **Tạo GLB Hunyuan cho H30** từ ảnh có sẵn. H39 và voi chiến để sau.
3. **Đăng nhập Mixamo** trong khung trình duyệt khi tới B3.
4. **Khóa API ai33** khi tới A6 (khóa không được lưu).

## Test và tiêu chí xong

- `tests/b17-sim.test.mjs`:
  - tốc cánh và × 0,8 mỗi đồn; trần dừng giao chiến;
  - đủ 3 điều kiện phục kích, cửa sổ 30 s, G;
  - Kế Sách Nhỏ mở bãi thứ hai;
  - dưới 50% đứng lại, Chí Tử Chiến dưới 25%, bị giết thì sang P5;
  - tới mốc thì thua; bộ đếm thuyền qua mốc; mốc giờ Ô Mã Nhi;
  - lưu và nạp; tất định; `lintQuiz`; chữ nhạy cảm.
- `tests/battles.test.mjs`: mục B17, par = `PAR_B17`.
- **Test lớp bùn**:
  - tắt thì độ cao và bùn của B15 không đổi;
  - gỡ trận thì xóa lớp phủ (vào B15 sau B17 vẫn sạch);
  - kỵ binh chậm 50%.
- **Vết bot B15**: cùng seed, `Date.now` và `Math.random` ghim, mã băm `__state()` trùng bản trước. Kiểm trong khung trình duyệt; `shot.mjs` quá chậm.
- **Bot B16** vẫn thắng.
- **Lệnh vẽ**: B17 ≤ 150 ở T2.
- **Toàn bộ test**: `node game/tools/run-tests.mjs` xanh.

## Rủi ro

- **Người chơi giam cánh Toa Đô**: đã chặn bằng trần dừng 20 s và hồi 30 s. Vẫn cần bot thử cách "bám boss từ đầu".
- **Trần crowd**: cùng lúc có cánh hành quân, 3 đồn trú, đổ bộ, 2–4 cánh phục binh, cánh vua, bến. Phải đo; có thể chỉ hiện hình lính gần tướng như B15.
- **Lớp bùn rò sang B15**, vì `ground` là trạng thái module: có test riêng.
- **Cung thủ thủ tục trông cứng**: nên kéo B3 (Mixamo) lên sớm nếu B1 nhìn chưa được.
- **Tiếng Việt và khoảng trắng tệp**: các tệp lẫn CRLF và LF. Ghi đúng kiểu dòng cũ của từng tệp (README, `main.js`, `hero.js`, `units.js` dùng CRLF).

## Lưu ý

- Không đổi `buildWorld`, `director.js`, `sim/front.js` của B15. Mọi móc dùng chung chỉ là tùy chọn.
- Danh sách lính của director giữ `{a, id}` và kiểm `a.id === id`.
- Viết script vá vào tệp tạm bằng công cụ Write, không dùng heredoc có dấu backtick.
- Nhân Tông dẫn cánh chính là Hư cấu về cơ chế (canon cho phép khi chơi Nguyễn Khoái); ghi trong `HISTORY_NOTES`.
