# Hào Khí Việt — LUẬT HỆ THỐNG (Systems Canon) — v1.3

> Phạm vi: bộ luật và con số khởi điểm mà mọi mục GDD khác phải dùng thống nhất. Đây là **giá trị khởi điểm cho prototype**, sẽ chỉnh qua playtest. Khi chỉnh, sửa tại tài liệu này trước rồi mới lan sang mục khác.
> Trụ cột số 1: **"Quân ta" + Hào Khí**. Mọi hệ thống bên dưới phải trả lời được câu hỏi: "hành động này của người chơi làm trận chiến chung thay đổi thế nào?"
> v1.0 đã sửa theo 3 báo cáo phản biện (combat, mobile/tech, tầm nhìn sản phẩm). **v1.1** áp các quyết định L1–L14 của thiết kế chính sau vòng canon (mỹ thuật low poly, 8 lớp R1, hướng dẫn B12/B13, khung Tổng Phản Công, cinematic Tuyệt Kỹ, khung thưởng Kế Sách, thang chỉ số, phân bổ lính hiển thị). **v1.2** áp hướng **comic + Quiz**: chiến dịch Sử Ký chia 9 Quyển, 30 Chương; comic thay tranh sơn mài chuyển động 2.5D ở mọi cảnh cốt truyện; Quyết sách trước trận và Quiz sau trận (§12.6); sửa chia hồi R1 (§12.5) và 3 suất cinematic 3D riêng của R1 (§4.5). **v1.3** chốt engine (L14): three.js, chạy trên web; thêm hai hạng iOS, ngân sách bộ nhớ web, phát hiện hạng máy trong trình duyệt, tự hạ theo thời gian khung (§5.3, §12.3, §13). Các thay đổi và các issue bị bác được ghi ở **Nhật ký quyết định** cuối file.
> Engine: **three.js r186** (L14, chốt 29/09/2026), JavaScript ES module không build step. R1 vẽ bằng **WebGLRenderer (WebGL2)** trên mọi nền tảng; WebGPURenderer chỉ là thử nghiệm cho PC sau VS. Đóng gói Steam bằng Electron, iOS bằng Capacitor, Android bằng Trusted Web Activity (TWA). Chi tiết hiện thực ở GDD, tab "Mục 15 · Kỹ thuật (web)". Luật và con số gameplay không phụ thuộc engine.

**Bảng thuật ngữ** (dùng đúng chữ và viết hoa như sau trong mọi tài liệu và trong game; không dùng "Musou" hay "Dynasty Warriors" ở bất kỳ chữ nào người chơi thấy)

| Thuật ngữ | Nghĩa ngắn | Mục |
|---|---|---|
| **Khí Lực** | Thanh cá nhân của tướng người chơi, chia vạch × 100 điểm; tiêu 1 vạch để tung Tuyệt Kỹ | §1 |
| **Tuyệt Kỹ** | Chiêu tối thượng của **một tướng** (bất tử khi ra đòn, có cinematic template §4.5). **Không cộng Hào Khí** | §4.1, §4.5 |
| **Hào Khí** | Thanh **toàn quân** Đại Việt, điểm 0–100 (không ghi %); đầy 100 thì kích được Tổng Phản Công | §6 |
| **Tổng Phản Công** | Đợt tiến công toàn quân có thời hạn (chuẩn 25 s, biến thể 20–30 s), người chơi chủ động kích | §6.4 |
| **Sĩ Khí** | Tinh thần **từng cánh quân** (mặt trận), cả hai phe; **điểm 0–100**, không phải % | §5.1 |
| **Kế Sách** | Mưu lược gắn địa hình/lịch sử của trận, quy mô Nhỏ hoặc Lớn; không có hồi chiêu | §7 |
| **Mệnh Lệnh** | 8 lệnh cho cánh quân qua vòng radial (Tiến công, Giữ vững, Rút về tập hợp…) | §5.4 |
| **Cứ Điểm** | Điểm chiếm được trên bản đồ: đồn, doanh trại, cổng, kho lương, bến thuyền, tháp canh | §5.2 |
| **Phá Thế** | Thanh chịu đòn của tướng địch (đội trưởng trở lên); đầy thanh → Vỡ Thế → Đòn Quyết | §2.4 |
| **Lính mô phỏng** | Quân số Q trừu tượng của mỗi phe trên mỗi mặt trận; quyết định kết quả trận, **không phụ thuộc cài đặt** | §5.3 |
| **Lính hiển thị** | Hình nhân vẽ trên màn hình, đại diện cho lính mô phỏng; số lượng theo mức cài đặt | §13.1 |
| **Vùng chiến đấu** | Hình tròn r 25 m quanh tướng người chơi: luôn 30 địch + tối đa 20 quân ta ở mọi mức cài đặt | §13.1 |
| **Sử Ký** | Tên chế độ chiến dịch chính (GDD mục 13.2): 9 Quyển (thời đại), 30 Chương (trận chính) | §12.5, §12.6 |
| **Sử quán** | Kho thẻ sử liệu có nhãn và nơi đọc lại comic; không dùng "Sử Ký" cho kho thẻ | §11.4, §12.6 |
| **Quyết sách** | Chọn 1 trong 3 chiến lược trước trận; 1 là cách người xưa đã làm. **Không đổi** trận, Kế Sách hay khung Hào Khí | §12.6 |

**Nhãn sử liệu** (L9): mọi chi tiết (sự kiện, câu nói, binh khí, chiến công, kết cục) mang đúng một trong ba nhãn **Chính sử / Tương truyền / Hư cấu**. Chi tiết chỉ có ở một phía vẫn ghi Chính sử, kèm ghi chú "chỉ có ở sử Việt" hoặc "chỉ có ở sử Nguyên". **"Hỗn hợp"** không phải nhãn chi tiết: nó chỉ là nhãn tóm tắt ở cấp tướng, dùng khi danh tính có trong chính sử nhưng phần lớn chiến công gắn với tướng trong game mang nhãn Tương truyền (hiện có H38 Yết Kiêu, H39 Dã Tượng).

**Kết cục boss `defeatMeans`** (L12): boss không bị "hạ" trái với sử. Mỗi boss có đúng một giá trị ∈ {**bị giết**, **bị bắt**, **rút chạy**, **tạm lui**, **giảng hòa**, **tử thủ**}; cách thể hiện trong gameplay ở §8.

**Quy ước**
- Số: dấu chấm phân nghìn (1.500), dấu phẩy thập phân (0,8) trong văn bản. Trong khối mã dùng dấu chấm thập phân (`0.8`) cho lập trình viên.
- Thời gian tính bằng giây (s) theo **đồng hồ trận**: dừng khi tạm dừng, chạy ×0,2 khi mở vòng Mệnh Lệnh. Logic chiến đấu của tướng chạy **tick cố định 60 Hz trên mọi nền tảng**; mọi thời lượng ghi bằng giây hoặc ms, không ghi bằng khung. Input được chấm theo **dấu thời gian của sự kiện input**, không theo khung hiển thị. Vì vậy 30 fps và 60 fps có cùng i-frame và cùng cửa sổ phản đòn.
- `g(L) = 1 + 0,1 × (L − 1)` là **hệ số cấp chuẩn** dùng chung cho tướng ta và địch. Cấp kỹ thuật tối đa là 50, `g(50) = 5,9`. Trần cấp thực tế theo đợt phát hành ở §11.1.
- `E(R) = 1 + 0,015 × (R − 1)` là **hệ số trang bị kỳ vọng** ở cấp đề xuất R của trận (R = 25 → 1,36). `S(R) = g(R) × E(R)` là **hệ số tiến độ**, nhân vào HP của mọi bậc địch có thanh Phá Thế, công trình và máy công thành. Lý do: thời gian hạ mục tiêu giữ nguyên khi người chơi đúng tiến độ trang bị.
- Thang canon 1–5: `cong` = Công, `thu` = Thủ, `toc` = Tốc, `tam` = **Tầm** (tầm với, bán kính đòn), `thongSuat` = Thống Suất. Ký hiệu `s` = giá trị thang (1–5).
- **Vùng chiến đấu** = hình tròn r 25 m quanh tướng người chơi. Mọi phép tính ảnh hưởng tới kết quả trận (KO, trừ quân số, Hào Khí, xếp hạng) chỉ dùng những gì xảy ra trong vùng này, và nội dung của vùng này **giống hệt nhau ở mọi mức cài đặt** (§13.1).

---

## 1. Thuật ngữ & tài nguyên trong trận

| Tài nguyên | Thang | Thuộc về | Tăng | Giảm | Hiển thị | Lý do |
|---|---|---|---|---|---|---|
| **Sinh lực** | 0 – HP tối đa (1.400–2.200 ở cấp 1) | Tướng người chơi, tướng AI, ngựa | Nắm cơm +25%, Thang thuốc Nam +60%, **chiếm bất kỳ Cứ Điểm nào +15%**, kỹ năng hồi | Trúng đòn | Góc trên-trái, thanh xanh lá dài; số chỉ hiện trên PC | Tách "máu tướng" khỏi "sức quân" để người chơi không nhầm cá nhân với toàn quân. |
| **Khí Lực** | Vạch × 100 điểm; 2 vạch (cấp 1) → 3 vạch (cấp 12) → 4 vạch (cấp 25) | Tướng người chơi | +0,2/đòn trúng (tính tối đa 3 mục tiêu/lượt vung), +0,25/KO, +0,5 cho mỗi 1% Sinh lực mất, phản đòn +10 (đội trưởng trở lên) / +2 (lính, tinh nhuệ), hạ đội trưởng / phó tướng / tướng trở lên +5 / +10 / +20; Sinh lực < 20% → tự hồi +1/s | Tung Tuyệt Kỹ (−1 vạch) | Ngay dưới Sinh lực, các vạch vàng kim; vạch đầy nhấp sáng | Nạp khoảng 1,4 điểm/s khi giao chiến, tức ~1 vạch/60–70 s → **1–2 Tuyệt Kỹ mỗi pha**, đủ "đã" mà không át kỹ năng. |
| **Hào Khí** | 0–100 **điểm**, mốc 25/50/75/100; kèm "Hào Khí dư" 0–30 | Toàn quân Đại Việt (một thanh/trận) | §6.1 | §6.2 | Giữa-trên màn hình, thanh ngang dài có 4 vạch mốc, hoa văn trống đồng; nháy khi đạt mốc | Đặt trung tâm màn hình vì đây là trụ cột số 1. |
| **Sĩ Khí** | 0–100 **điểm** mỗi **cánh quân** (mặt trận), cả phe ta và phe địch. Mọi thay đổi ghi bằng điểm ("+15 Sĩ Khí"), không ghi "%" | Từng mặt trận | §5.1 | §5.1 | Minimap: vạch nhỏ cạnh biểu tượng mặt trận; bản đồ lớn: thanh đầy đủ; cảnh báo chữ khi < 20 | Người chơi cần thấy "cánh nào đang yếu" để quyết định chạy đi đâu. |
| **KO** | Số nguyên | Tướng người chơi | +1 mỗi địch bị tướng người chơi hạ **trong vùng chiến đấu** (mọi bậc) | Không | Dưới thanh Hào Khí (giữa-trên), số gọn; mốc 100/500/1.000 có hiệu ứng chữ | Phản hồi nhanh cảm giác "một địch trăm"; chỉ chiếm một phần nhỏ trong xếp hạng (§12.1). |
| **Công trạng** | 0–100 = điểm xếp hạng `Diem` (§12.1) | Người chơi | Mục tiêu, tướng hạ, Kế Sách, giữ Sĩ Khí… | Gượng dậy, tải lại checkpoint | Trong trận: dòng chữ nổi "+Công trạng" nhỏ; kết thúc: bảng xếp hạng | Một đại lượng duy nhất để thưởng việc "chỉ huy tốt", không chỉ "chém nhiều". |
| **Quân số (mô phỏng)** | Số nguyên theo mặt trận/Cứ Điểm | Mỗi phe | Hồi quân từ doanh trại, đợt tiếp viện, lượt tiếp viện ta, chiếm doanh trại | Tổn thất mô phỏng, trừ quân từ tướng người chơi | Bản đồ lớn: "Ta 1.240 / Địch 2.100" theo từng mặt trận | Quân số là thực tại của trận; lính hiển thị chỉ là đại diện (§5.3, §13). |

**Màu minimap chuẩn**: xanh dương = quân Đại Việt · đỏ = địch · vàng = tiếp viện ta (chưa nhập cánh) · trắng = Cứ Điểm trung lập · cam = mục tiêu nhiệm vụ · tím = điểm Kế Sách. Chế độ mù màu thêm hình dạng: ta ● tròn, địch ▲ tam giác, tiếp viện ◆ kim cương, Kế Sách ✦. Lý do: giữ đúng quy ước màu người dùng đặt, bổ sung hình dạng cho khả năng tiếp cận.

**HUD tổng**: trên-trái (Sinh lực, Khí Lực, chân dung, ô ngựa) · giữa-trên (Hào Khí; "Con nước" ở màn sông; ngay dưới là KO và thông báo sự kiện, tối đa 2 dòng) · trên-phải (minimap 3 cỡ; tiến độ Kế Sách ngay dưới minimap) · dưới-phải (cụm nút chiến đấu, §3.2) · dưới-trái (Mệnh Lệnh gần nhất, lượt tiếp viện còn lại) · tâm-dưới (thanh Sinh lực + Phá Thế của mục tiêu khóa). Mọi phần tử nằm trong safe area của thiết bị.

---

## 2. Chỉ số tướng & công thức chiến đấu

### 2.1 Quy đổi thang 1–5 → số thật

| Thang `s` | Công cấp 1 → 50 | Sinh lực cấp 1 → 50 | Giáp cấp 1 → 50 | Tốc: di chuyển (m/s) · tốc đánh | Tầm: hệ số tầm đòn/bán kính | Thống Suất: bán kính hào quang · buff Công quân ta · hệ số Sĩ Khí · CD Mệnh Lệnh · thân binh |
|---|---|---|---|---|---|---|
| 1 | 80 → 472 | 1.400 → 8.260 | 40 → 236 | 5,75 · ×0,95 | ×0,95 | 12 m · +2% · ×1,0 · ×1,00 · 6 |
| 2 | 100 → 590 | 1.600 → 9.440 | 50 → 295 | 6,00 · ×1,00 | ×1,00 | 14 m · +4% · ×1,1 · ×0,96 · 8 |
| 3 | 120 → 708 | 1.800 → 10.620 | 60 → 354 | 6,25 · ×1,05 | ×1,05 | 16 m · +6% · ×1,2 · ×0,92 · 10 |
| 4 | 140 → 826 | 2.000 → 11.800 | 70 → 413 | 6,50 · ×1,10 | ×1,10 | 18 m · +8% · ×1,3 · ×0,88 · 12 |
| 5 | 160 → 944 | 2.200 → 12.980 | 80 → 472 | 6,75 · ×1,15 | ×1,15 | 20 m · +10% · ×1,4 · ×0,84 · 14 |

```
Cong(L)  = (60 + 20*s) * g(L)
HP(L)    = (1200 + 200*s) * g(L)
Giap(L)  = (30 + 10*s) * g(L)
TocDiChuyen = 5.5 + 0.25*s          // không tăng theo cấp
TocDanh     = 0.90 + 0.05*s         // nhân vào tốc độ phát animation
Tam         = 0.90 + 0.05*s         // nhân tầm với & bán kính AoE cận chiến; KHÔNG nhân tầm bắn của WC08/WC09/WC13 (chỉ nhân bán kính nổ)
ThongSuat: banKinh = 10 + 2*s ; buffCong = 2%*s ; heSoSiKhi = 0.9 + 0.1*s ; cdLenh = 1.04 - 0.04*s ; thanBinh = 4 + 2*s
Ngựa: 11 m/s, xung phong 14 m/s (mọi tướng; chuồng ngựa chỉ đổi độ bền & CD gọi)
```
Lý do: Tốc và Tầm không tăng theo cấp để cảm giác điều khiển ổn định suốt game. Thang Tầm được nén (0,95–1,15) vì Tầm nhân vào bán kính, nên diện tích đòn chênh theo bình phương (tối đa ≈ 1,47 lần giữa s = 1 và s = 5). Công/Thủ tăng theo cùng `g(L)` với địch nên cân bằng giữ nguyên.

**Ngân sách chỉ số (L8)**: tổng 5 chỉ số (thang 1–5) của mọi tướng chơi được nằm trong **15–19**. Hướng dẫn phân bổ: 16–17 là mức thường; 18–19 dành cho tướng vai trò Commander (Thống Suất ≥ 4) hoặc tướng lớp có ràng buộc nặng (WC16: không xuống voi, không vào địa hình hẹp); 15 cho tướng chuyên biệt một việc (lặn, tầm xa, hộ vệ). Lý do: Thống Suất tác động lên quân ta chứ không lên DPS cá nhân, nên tướng chỉ huy được phép tổng cao hơn mà không lấn át tướng chiến đấu; dải 15–19 đủ để các tướng khác nhau rõ rệt mà không có tướng nào vượt trội mọi mặt. Roster canon hiện có 2 tướng ngoài dải (xem Nhật ký quyết định, "Việc canon cần sửa theo v1.1").

**Vai trò → ràng buộc thang** (vai trò có thể kép, ví dụ Heavy/Commander):

| Vai trò | Ràng buộc | Mẫu |
|---|---|---|
| Commander (chỉ huy) | Thống Suất ≥ 4; Tuyệt Kỹ thường có quân ta tham gia (§6.4) | Trần Hưng Đạo, Lý Thường Kiệt, Quang Trung |
| Heavy | Công ≥ 4, Tốc ≤ 2 | Trần Hưng Đạo |
| Assassin / Speed | Tốc 5, Thủ ≤ 2 | Trần Quốc Toản |
| AoE / Spear | Tầm ≥ 4 | Lý Thường Kiệt |
| Berserker / Cavalry | Công 5, Thủ ≤ 3 | Quang Trung |
| Strategist (mưu sĩ) | Thống Suất ≥ 4, Công ≤ 3 | tướng lớp WC12 |

### 2.2 Sát thương

```
satThuong = Cong_ke_cong * MV * heSoGiap * chiMang * khacChe * doKho * rand(0.95, 1.05)
heSoGiap  = 1 - Giap_muc_tieu / (Giap_muc_tieu + 120 * g(L_ke_cong))
chiMang   = 1.5 nếu trúng chí mạng, ngược lại 1.0
khacChe   = 1.5 (khắc) | 1.0 | 0.75 (bị khắc)   // chỉ giữa các binh chủng, §9
doKho     = hệ số độ khó §10 (chỉ áp cho đòn của địch)
Mục tiêu đang Vỡ Thế: ×1.5 ; đòn đánh lén sau lưng (WC14): ×2.0 ; trong Tổng Phản Công: tướng người chơi ×1.2
Cong_ke_cong của tướng người chơi = Cong(L) * (1 + bậc binh khí% + 0.06 * mức rèn)   // §11.3, tối đa ×1.8
```
- **MV (motion value)**: hệ số của từng đòn, bảng chuẩn ở §4.2. Có **hai thước đo DPS** (đo khi đã tính hit-stop, thời gian nạp và mọi thưởng có điều kiện ở mức trung bình):
  - DPS đơn mục tiêu: cận chiến **1,6 MV/s**, tầm xa (WC08, WC09, WC13) **1,3 MV/s**, ±10%.
  - DPS đám đông, đo trên cụm chuẩn 12 lính trong r 4 m: cận chiến **8 MV·mục tiêu/s**, tầm xa **6**, ±15%.
- **Giáp**: với địch cùng cấp, giáp 60 giảm ~33% sát thương ở mọi cấp (vì hằng số K tăng cùng `g(L)`).
- **Kiểm tra nhanh** (cấp 1, Công 120, lớp trung bình): lính thường (HP 120, giáp 20) chết sau 2 đòn thường. Tướng địch (HP 4.200, giáp 60) chịu ~128 DPS; tính cả Vỡ Thế, Đòn Quyết và kỹ năng thì hạ trong **20–25 s**.

**Đòn của địch** (MV nhân với Công của bậc §8 và hệ số độ khó §10):

| Bậc | MV đòn thường · nhịp | Đòn viền đỏ | Ghi chú |
|---|---|---|---|
| Lính thường | 1,0 · 1 đòn/2,5 s mỗi thẻ tấn công | — | Chỉ lính giữ thẻ mới được đánh (§10) |
| Tinh nhuệ | 1,2 · 1 đòn/2 s | — | |
| Đội trưởng | 1,5 · 1 đòn/2 s | MV 3 | |
| Phó tướng / Tướng | 1,2 · 1 đòn/1,6 s | MV 4 | |
| Tuyệt Kỹ tướng địch | MV 8, viền đỏ | báo trước 1,0 s | |

Mục tiêu kiểm định (độ khó Thường, người chơi Thủ 3 đứng yên không đỡ): 3 thẻ lính hạ người chơi sau ~55–60 s (~27 sát thương/đòn); một tướng địch cùng cấp hạ người chơi sau ~20–25 s.

### 2.3 Chí mạng

| Nguồn | Tỉ lệ | Ghi chú |
|---|---|---|
| Cơ bản | 5% | ×1,5 sát thương |
| Cây kỹ năng + ô Khắc binh khí | tối đa +25% (tổng trần **30%**) | Lý do: trần thấp để chí mạng là "gia vị", không thay thế Phá Thế. |
| Phản đòn thành công | 100% | Thưởng kỹ năng đọc đòn. |
| Đòn Quyết (khi địch Vỡ Thế) | 100% | §2.4. |

### 2.4 Phá Thế (thanh chịu đòn của tướng địch)

- Chỉ bậc **Đội trưởng trở lên** có thanh Phá Thế (§8). Lính thường luôn bị khựng; tinh nhuệ chỉ khựng khi trúng đòn có MV ≥ 1,2.
- Mỗi đòn gây `phaThe = 20 × MV_sau_hệ_số_lớp × heSoPhaTheLop` (hệ số lớp ở §4.4; đòn C nhân thêm ×1,5; phản đòn ×3). **MV dùng ở đây là MV đã nhân hệ số MV của lớp.** Vì mọi lớp cùng DPS 1,6 MV/s, Phá Thế/s ≈ 32 × heSoPhaTheLop: Song đao ~22/s, lớp trung bình ~32/s, Đại kiếm ~48/s, Rìu ~50/s. Một tướng (thanh 600) bị phá thế sau ~12 s với Đại kiếm và ~27 s với Song đao.
- Không bị trúng 3 s → thanh hồi 15%/s.
- Đầy thanh → **Vỡ Thế**: choáng 4 s (Đại tướng/Chủ soái 3 s), nhận sát thương ×1,5, hiện nút **Đòn Quyết** (MV 8, chắc chắn chí mạng, cảnh quay 1,2 s không máu me). Sau mỗi lần Vỡ Thế, thanh tối đa +20% (cộng dồn tới +60%).
- Lý do: tạo nhịp "ép – phá – dứt điểm" cho trận đấu tướng, và cho lớp nặng (Đại kiếm, Rìu) một vai trò rõ ràng.

### 2.5 Hit-stop (khựng)

| Loại đòn | Hit-stop | Rung camera |
|---|---|---|
| Đánh thường N1–N5 | 33 ms | Không |
| N6, C1–C5 | 67 ms | Nhẹ 0,1 s |
| C6, kỹ năng kết | 100 ms | Vừa 0,2 s |
| Làm Vỡ Thế / Đòn Quyết | 167 ms | Mạnh 0,3 s |
| Đòn cuối Tuyệt Kỹ | 200 ms | Mạnh 0,4 s |

Luật:
- Hit-stop tính theo ms, hiển thị tối thiểu 1 khung. Tính **một lần mỗi lượt vung**, không cộng theo số mục tiêu. Đòn đa đòn (C3 và các chiêu tương tự): mỗi nhịp khựng 17 ms, riêng nhịp cuối tính theo bảng.
- Hit-stop chỉ áp cho người đánh và mục tiêu chính; đám đông vẫn chuyển động. Để người chơi không bị phạt vì khựng giữa vòng vây: khi hit-stop ≥ 100 ms, **đồng hồ đòn tấn công của mọi địch trong r 6 m cũng dừng** trong cùng khoảng thời gian.
- Bộ đệm input 0,15 s cho mọi nút, nên bấm trong lúc khựng không bị mất.
- Tốc độ animation của từng lớp được hiệu chỉnh sao cho đạt đúng DPS chuẩn **khi đo có hit-stop** (lớp nhiều đòn như Song đao bị khựng nhiều hơn nên animation nhanh hơn tương ứng).
- Có thanh trượt cường độ 0–100% trong cài đặt; cường độ chỉ đổi phần hiển thị, không đổi đồng hồ chiến đấu.

---

## 3. Bộ input chuẩn

### 3.1 Danh sách hành động chuẩn (mã hành động dùng trong code)

| Mã | Hành động | Ghi chú |
|---|---|---|
| A_MOVE / A_CAM | Di chuyển / camera | |
| A_N | Đánh thường | Chuỗi N1–N6 |
| A_C | Đánh mạnh | Nhánh C1–C6 |
| A_DODGE | Né / lướt | i-frame 0,25 s; tối đa 2 lần liên tiếp rồi hồi 0,4 s |
| A_GUARD | Đỡ (giữ) | Lần nhấn đầu đúng lúc = phản đòn (§4.1) |
| A_SK1–A_SK3 | 3 ô kỹ năng | |
| A_ULT | Tuyệt Kỹ | Tiêu 1 vạch Khí Lực |
| A_RALLY | Tổng Phản Công | Chỉ khi Hào Khí = 100; phải **giữ** (§3.2); bỏ qua mọi lệnh kích trong 1 s đầu sau khi Hào Khí chạm 100 |
| A_STRATAGEM | Lệnh Kế Sách | Chỉ khi một Kế Sách ở trạng thái Sẵn sàng (§7) |
| A_ORDER | Vòng Mệnh Lệnh (giữ) | Đồng hồ trận chạy ×0,2 khi vòng mở; tâm vòng = HỦY |
| A_ORDER_QUICK | Lặp Mệnh Lệnh gần nhất | Chỉ với Tiến công, Giữ vững, Theo ta, Tập trung mục tiêu, Đổi trận thế |
| A_HORSE | Gọi / lên / xuống ngựa | |
| A_LOCK | Khóa mục tiêu / đổi mục tiêu | Ưu tiên bậc cao nhất trong 15 m |
| A_INTERACT | Tương tác (giữ) | Chiếm Cứ Điểm, cứu tướng, mở cổng, đốt kho, lên/xuống thuyền, đục thuyền |
| A_MAP / A_PAUSE | Bản đồ lớn / tạm dừng | Bản đồ lớn cho phép ra lệnh theo mặt trận |

Không có nút nhảy. Lý do: bỏ nhảy cắt ~20% animation mỗi lớp và đơn giản hóa bố cục cảm ứng; hất tung/đánh trên không vẫn có qua đòn C2.

**Luật cử chỉ chung** (mọi chế độ cảm ứng): "giữ" tính từ 0,25 s; "vuốt" = di chuyển ≥ 8 mm trong ≤ 0,2 s; "chạm nhanh" < 0,2 s.

### 3.2 Bố cục mặc định (đều đổi phím được)

| Hành động | PC (bàn phím + chuột) | Gamepad (nhãn Xbox) | Cảm ứng |
|---|---|---|---|
| Di chuyển | WASD | Cần trái | Joystick nổi nửa trái (trừ dải 16 mm sát mép trái dành cho nút cờ và nút ngựa) |
| Camera | Chuột | Cần phải | Vuốt vùng trống nửa phải; tùy chọn Camera tự xoay (§3.3) |
| Đánh thường | Chuột trái | X | Nút N Ø 16 mm, góc phải-dưới |
| Đánh mạnh | Chuột phải | Y | Nút C Ø 12 mm, trên-trái nút N |
| Né | Space | A | Nút Né Ø 12 mm, dưới-trái nút N (hoặc vuốt từ nút N) |
| Đỡ / phản | Shift (giữ) | RB (giữ) | Nút khiên Ø 11 mm, bên phải nút N |
| Kỹ năng 1/2/3 | 1 / 2 / 3 | LB giữ + X / Y / A | 3 nút Ø 11 mm trên cung r 30 mm quanh tâm N |
| Tuyệt Kỹ | Q | B | Nút Ø 13 mm ở đỉnh cung kỹ năng, viền vàng theo số vạch |
| Tổng Phản Công | G (giữ 0,3 s) | D-pad xuống (giữ 0,5 s, có vòng nạp) | Ô ngữ cảnh (giữ 0,5 s), viền vàng nhấp nháy 1 Hz; hoặc giữ 0,5 s trên thanh Hào Khí |
| Lệnh Kế Sách | F | D-pad phải | Ô ngữ cảnh |
| Vòng Mệnh Lệnh | V (giữ, rê chuột chọn) | LT (giữ, cần phải chọn theo hướng) | Giữ nút cờ → vòng mở tại điểm cố định, kéo theo hướng để chọn |
| Lặp lệnh gần nhất | B | D-pad trái | Chạm nhanh nút cờ |
| Ngựa | Z | D-pad lên | Nút ngựa Ø 9 mm cạnh nút cờ |
| Khóa mục tiêu | Chuột giữa (cuộn để đổi) | R3 (gạt cần phải để đổi) | Chạm trực tiếp tướng/đội trưởng trên màn (vùng chạm nới 12 mm); chạm thanh mục tiêu = đổi sang mục tiêu bậc cao kế tiếp trong 15 m; vuốt xuống trên thanh = bỏ khóa; tự khóa khi tướng địch vào 12 m và chưa có mục tiêu |
| Tương tác | E (giữ) | RT (giữ) | Ô ngữ cảnh, hoặc tự động (Tự tương tác, §3.3) |
| Bản đồ / tạm dừng | M / Esc | View / Menu | Chạm minimap / nút ☰ |

**Cụm nút phải trên cảm ứng**: tối đa 8 nút cố định (N, C, Né, Đỡ, SK1–3, Tuyệt Kỹ) + **1 ô ngữ cảnh** Ø 13 mm bên trái nút N, tất cả nằm trong cung bán kính 55 mm tính từ góc phải-dưới (sau khi trừ safe area). Khoảng cách giữa hai nút ≥ 2 mm; nút phụ tối thiểu Ø 9 mm. Ô ngữ cảnh hiển thị theo ưu tiên: **Lệnh Kế Sách** (vì có cửa sổ hạn giờ) > **Tổng Phản Công** > **Tương tác**. Khi Tổng Phản Công bị che bởi Kế Sách, người chơi vẫn kích được bằng cách giữ trên thanh Hào Khí.

**Vòng Mệnh Lệnh** (mọi nền tảng): 8 lệnh xếp theo 8 hướng × 45°; **tâm = HỦY** (thả ở tâm hoặc trả cần phải về giữa là hủy). Trên cảm ứng, vòng luôn mở tại điểm cố định (x = 30% chiều rộng, y = 50% chiều cao), chọn theo hướng kéo, vùng chết 6 mm, bán kính hiển thị 20 mm, ô Ø 9 mm, tên lệnh hiện phía trên vòng. "Gọi tiếp viện" và "Rút về tập hợp" luôn phải chọn qua vòng, không lặp bằng chạm nhanh.

### 3.3 Trợ giúp cảm ứng & khả năng tiếp cận

| Tùy chọn | Mức | Tác dụng | Mặc định |
|---|---|---|---|
| **Tự nhắm** | Tắt / Nhẹ / Mạnh | Nhẹ: xoay tối đa 30° về địch trong 6 m. Mạnh: chọn mục tiêu trong nón ±45° theo hướng joystick, tầm 10 m; joystick trung tính thì chọn địch gần nhất; chỉ ưu tiên tướng khi tướng đang được khóa | Cảm ứng: Mạnh; gamepad: Nhẹ; PC: Tắt |
| **Tự combo** | Tắt / Bật | Giữ N: với đám đông chạy N1 → N2 → N3 → C4 (quét vòng) → lặp. Mục tiêu khóa là đội trưởng trở lên: N1 → N2 → C3 (đa đòn) → N1…N5 → C6 khi thanh Phá Thế ≥ 70% | Cảm ứng: Bật |
| **Chế độ một tay** | Tắt / Bật (tay phải hoặc tay trái) | Bỏ joystick. Chạm N = đánh (theo Tự combo); giữ N = tự tiến tới mục tiêu gần nhất trong 12 m kèm tự combo; C là nút riêng; vuốt từ N = Né theo hướng vuốt. Nút cờ, nút ngựa và Tuyệt Kỹ dời sang cụm của tay đang dùng (đối xứng khi chọn tay trái). Vòng Mệnh Lệnh mở tại ngón cái và chỉ có 4 lệnh: Tiến công, Giữ vững, Theo ta, Gọi tiếp viện. Camera tự bám | Tắt |
| Tự tương tác | Tắt / Bật | Đứng trong vùng Cứ Điểm là tự chiếm, không cần giữ | Cảm ứng: Bật |
| Camera tự xoay | Tắt / Nhẹ / Mạnh | Nhẹ: xoay theo hướng chạy sau 0,8 s không vuốt, giữ mục tiêu khóa trong khung | Cảm ứng: Nhẹ; khác: Tắt |
| Ngắm tầm xa (WC08, WC09, WC13) | — | Cảm ứng/gamepad: N bắn tự nhắm vào mục tiêu gần nhất trong nón ±30° theo hướng joystick (không có thì theo hướng camera); giữ C = ngắm tay, kéo ngón phải lệch tâm tối đa ±15°. PC: hướng bắn = tâm màn (tâm ngắm hiện khi cầm lớp tầm xa), giữ chuột phải = ngắm chính xác | — |
| Bố cục nút | Kéo thả, lưu 3 bố cục | | |
| Cỡ nút / độ mờ | 80–130% / 40–100% | | 100% / 70% |
| Cỡ chữ phụ đề | 80–150% | | 100% |
| Rung haptic | 0–100% | | 50% |

Luật: mọi trợ giúp **không làm giảm Công trạng hay xếp hạng**. Lý do: người chơi di động cần chơi được bằng một ngón mà không bị phạt, và kết quả trận vẫn do quyết định chỉ huy chứ không do độ khéo tay.

---

## 4. Khung moveset cho mỗi lớp vũ khí

### 4.1 Cấu trúc chung (mọi lớp WC01–WC16)

| Thành phần | Nội dung | Luật |
|---|---|---|
| Chuỗi thường N1–N6 | 6 đòn, N6 là đòn kết | Có thể hủy vào Né từ N1–N5 ở khung "hủy" (cuối 30% animation) |
| Đòn mạnh C1–C6 | C1 = C từ đứng yên; Cn = sau N(n−1) bấm C | Vai trò cố định: **C1 phá đỡ/phá khiên · C2 hất tung · C3 đa đòn (giữ để kéo dài) · C4 quét vòng · C5 xuyên hàng/lao · C6 kết liễu vùng lớn** |
| Đòn lướt | Né → N (lướt chém) ; Né → C (lướt mạnh) | Dùng để xuyên đội hình, thoát vây |
| Trên ngựa | N ngựa (4 đòn trái/phải) · C ngựa (xung phong 3 s, 14 m/s, húc văng) · Tuyệt Kỹ trên ngựa | **3 bộ ngựa dùng chung theo tay cầm**: một tay, hai tay/cán dài, tầm xa. Lý do: tái sử dụng animation (16 lớp chỉ cần 3 bộ). WC16 không có bộ ngựa (đã trên voi). |
| Ô kỹ năng 1 | **Kỹ năng đặc trưng** của tướng, cố định (ví dụ: Hịch Tướng Sĩ, Phá Trận, Nam Quốc Sơn Hà) | CD 20–40 s. Kỹ năng **hiệu lệnh toàn quân** (Hịch Tướng Sĩ, Nam Quốc Sơn Hà): +15 Sĩ Khí mọi cánh ta, Công quân ta +10% trong 20 s, CD 40 s |
| Ô kỹ năng 2–3 | Chọn từ **6 kỹ năng lớp** mở ở cấp 1/4/8/12/18/25 | CD 8–25 s. Ô 3 mở ở cấp 8 |
| Tuyệt Kỹ | Thường (mặt đất) · Trên ngựa (dùng chung theo tay cầm) · **Tuyệt Kỹ Hào Khí** (§6.4) | Bất tử toàn thời gian; tổng MV 20 (mặt đất), 16 (ngựa), 35 (Hào Khí). Mỗi Tuyệt Kỹ thường trừ **20 Q** địch của mặt trận (§5.3). **Không cộng Hào Khí** (§6.4). Tướng Commander: MV của tướng 16 + thân binh và 1 đội 20 lính hiển thị cùng xung phong/bắn một loạt trong 4 s (đội này nằm trong trần 20 quân ta của vùng chiến đấu, §13.1). Cinematic theo §4.5 |
| Né | Lăn/bước, i-frame 0,25 s | Không tốn tài nguyên |
| Đỡ | Chặn 100% đòn trước mặt (120°) từ lính & tinh nhuệ; 70% từ đội trưởng trở lên; đòn **viền đỏ** không đỡ được, phải né | Đỡ lâu không bị vỡ (không có thanh thể lực) |
| Phản đòn | **Lần nhấn Đỡ đầu tiên** trong cửa sổ trước khi trúng (§10; cảm ứng +0,05 s) | MV 3, chắc chắn chí mạng, Phá Thế ×3. Khí Lực +10 (đội trưởng trở lên) / +2 (lính, tinh nhuệ). Chống bấm liên tục: nhấn lại Đỡ trong 0,5 s sau lần trước thì không có cửa sổ; phản đòn hụt khóa phản đòn 0,4 s |

### 4.2 Bảng MV chuẩn (lớp "trung bình", trước khi nhân hệ số lớp)

| Đòn | N1 | N2 | N3 | N4 | N5 | N6 | C1 | C2 | C3 | C4 | C5 | C6 | Lướt N / C | Đòn Quyết |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MV | 0,8 | 0,8 | 0,9 | 1,0 | 1,1 | 1,6 | 1,8 | 1,2 | 0,5×5 | 3,0 (r 5 m) | 3,2 (dài 8 m) | 4,5 (r 6 m) | 1,0 / 2,0 | 8,0 |

Mỗi lớp nhân MV với `hệ số MV` và tốc độ animation với `hệ số tốc`. Cận chiến: `hệ số MV × hệ số tốc ≈ 1,0` (1,6 MV/s). Tầm xa: ≈ 0,81 (1,3 MV/s, tính cả nạp đạn).

### 4.3 Số animation cần cho 1 lớp

| Nhóm | Số clip | Dùng chung? |
|---|---|---|
| N1–N6 | 6 | Riêng lớp |
| C1–C6 (C3 có vào/lặp/ra, C6 có 2 đoạn) | 9 | Riêng lớp |
| Đòn lướt N/C | 2 | Riêng lớp |
| 6 kỹ năng lớp | 6 | Riêng lớp |
| Thế thủ, đỡ trúng, phản đòn, rút/cất vũ khí | 4 | Riêng lớp |
| **Cộng riêng lớp** | **27** | |
| Di chuyển, né, trúng đòn, ngã, dậy, tương tác, chiếm, ra lệnh | ~24 | Chung theo 3 tay cầm |
| Bộ ngựa (N×4, C, TK ngựa, lên/xuống, trúng) | 9 | Chung theo 3 tay cầm |
| **Riêng tướng**: kỹ năng đặc trưng, Tuyệt Kỹ, dáng chiến thắng, giới thiệu | 4 | Tuyệt Kỹ Hào Khí tái dùng clip Tuyệt Kỹ + camera + quân ta |
| **Lớp địch rút gọn (EWC01–EWC06)** | ~12 | N1–N4, C1, C4, C5, 2 kỹ năng, 1 Tuyệt Kỹ, thế thủ, trúng đòn. EWC06 dùng chung rig và clip với WC16; EWC01 dùng bộ ngựa tầm xa |

→ Một lớp WC mới ≈ **27 clip**; một tướng mới trên lớp có sẵn ≈ **4 clip**; một lớp địch EWC ≈ 12 clip. Lý do: đây là đòn bẩy để đạt 50+ tướng với ngân sách indie.
**Tướng địch mang lớp WC chưa tới lượt sản xuất** (ví dụ Mộc Thạnh, Vương Thông dùng WC11 ở U1 trong khi WC11 thuộc P3 – U2): dùng **bản rút gọn ~12 clip** của lớp đó theo khung EWC; bản đầy đủ 27 clip làm khi lớp tới lượt và dùng lại các clip rút gọn.

### 4.4 Đặc trưng 16 lớp & ưu tiên sản xuất

| Lớp | Hệ số MV · tốc | Phá Thế × | Tầm N (m) | Điểm khác biệt (1 dòng) | Ưu tiên |
|---|---|---|---|---|---|
| WC01 Đại kiếm | 1,35 · 0,75 | 1,5 | 3,5 | Giữ C để tụ lực 3 cấp; siêu giáp khi vung; C6 phá giáp (bỏ qua 30% giáp) | **P0 – VS** |
| WC02 Kiếm & khiên mây | 1,0 · 1,0 | 1,0 | 2,5 | Đỡ 360° trong 0,5 s đầu; cửa sổ phản đòn ×1,5; khiên chặn tên khi di chuyển | **P1 – R1** |
| WC03 Song đao | 0,7 · 1,3 (+ thưởng tốc TB 10%) | 0,7 | 2,2 | Né → N lướt xuyên không giới hạn; mỗi 10 hit +2% tốc đánh (tối đa +20%; cân bằng theo mức trung bình +10%) | **P0 – VS** |
| WC04 Thương/giáo | 1,0 · 1,0 | 1,0 | 4,0 | Đâm xuyên tới 5 mục tiêu trên một hàng; C4 quét vòng r 6 m; khắc kỵ ×1,2 thêm | **P1 – R1** |
| WC05 Trường đao | 1,15 · 0,87 | 1,2 | 4,5 | Quét cung 180°; đòn trên ngựa ×1,2 | P3 – U2 |
| WC06 Côn | 0,85 · 1,18 | 1,1 | 3,5 | Tung hứng: +20% sát thương lên mục tiêu đang trên không; đánh vòng 360° | P2 – U1 |
| WC07 Rìu đồng/búa | 1,3 · 0,78 | 1,6 | 2,8 | Bỏ qua 50% giáp của khiên binh; đòn C gây Chấn 1,5 s | P2 – U1 |
| WC08 Nỏ | 0,75 · 1,08 | 0,8 | 22 | Tên xuyên 3 mục tiêu; đặt tối đa 3 nỏ bẫy tự bắn; ngắm khóa | P2 – U1 |
| WC09 Cung | 0,68 · 1,2 | 0,6 | 25 | Bắn khi di chuyển; loạt 5 tên; tên lửa gây cháy (×2 lên máy công thành, voi) | **P1 – R1** |
| WC10 Roi & xích | 0,9 · 1,1 | 0,9 | 6,0 | Kéo: tướng bị kéo lại gần, lính bị gom thành cụm | P4 – U4 |
| WC11 Cờ lệnh | 0,9 · 1,1 | 0,9 | 3,5 | Cắm cờ: vùng r 10 m trong 20 s, quân ta +15% Công, Sĩ Khí cánh +0,3/s; CD 30 s; tối đa 1 cờ mỗi cánh | P3 – U2 |
| WC12 Quạt & bút | 0,85 · 1,15 | 0,8 | 8,0 | Nét bút thành chiêu (vẽ vùng/đường); đặt bẫy; CD Mệnh Lệnh ×0,7 | **P1 – R1** |
| WC13 Hỏa khí | 1,1 · 0,9 (hiệu dụng ≈ 0,81 tính cả nạp) | 1,0 | 20 | Băng 6 phát, nạp 1,5 s; nổ vùng r 4 m; đòn gần bằng báng | P2 – U1 |
| WC14 Đoản đao & lặn | 0,75 · 1,33 | 0,8 | 2,0 | Lặn trong vùng nước kịch bản (§5.8); đục thuyền; đánh sau lưng ×2 | **P0 – VS** |
| WC15 Trống đồng | 0,8 · 1,25 (cân bằng giả định 60% nhịp đúng) | 0,9 | r 6 sóng | Nhịp 100 BPM: bấm đúng nhịp +30% hiệu ứng; sóng âm AoE; buff ta/giảm Công địch | P2 – U1 |
| WC16 Voi chiến | 1,2 · 0,72 | 1,8 | 4,0 | Chiến đấu trên voi, không xuống; Sinh lực ×1,5 (bù bằng DPS thấp hơn chuẩn ~14%), di chuyển ×0,7; giẫm AoE, húc xuyên; không vào địa hình hẹp/thuyền | **P1 – R1** |

**Thứ tự sản xuất (L3)**: **P0 – VS (3 lớp)** WC01, WC03, WC14 → **P1 – R1 (+5 lớp, R1 = 8 lớp)** WC02, WC04, WC09, WC12, WC16 → **P2 – U1 (+5)** WC06, WC07, WC08, WC13, WC15 → **P3 – U2 (+2)** WC05, WC11 → **P4 – U4 (+1)** WC10. U3 (Lý + Ngô–Tiền Lê) **không cần lớp mới**: mọi lớp của E4, E5 đã có từ các đợt trước.

**Trần R1 nâng từ 6 lên 8 lớp.** Bảng "lớp → đợt cần đầu tiên → tướng dùng" (theo roster canon; tướng in nghiêng = chỉ có ở Chronicle):

| Lớp | Ưu tiên | Đợt cần đầu tiên | Tướng dùng trong đợt đó | Tướng dùng ở đợt sau |
|---|---|---|---|---|
| WC01 Đại kiếm | P0 | VS | H31 Trần Hưng Đạo, H34 Trần Khánh Dư | H25 Đặng Dung, H41 Lê Lợi (U1); H16 Lê Hoàn (U3) |
| WC03 Song đao | P0 | VS | H35 Trần Quốc Toản | H45 Đinh Lễ (U1) |
| WC14 Đoản đao & lặn | P0 | VS | H38 Yết Kiêu | H07 Lê Chân, H11 Triệu Quang Phục (U4) |
| WC02 Kiếm & khiên mây | P1 | R1 | H27 Trần Thái Tông, H29 Lê Phụ Trần | H24 Đặng Tất, H43 Lê Lai (U1); H17 Phạm Cự Lạng (U3); H06 Phùng Thị Chính (U4) |
| WC04 Thương/giáo | P1 | R1 | H28 Trần Thủ Độ, H36 Trần Bình Trọng, H37 Phạm Ngũ Lão | H46 Lê Sát (U1); H54 Trần Quang Diệu (U2); H15 Ngô Quyền, H18 Lý Thường Kiệt (U3) |
| WC09 Cung | P1 | R1 | H32 Trần Quang Khải, H40 Nguyễn Khoái | H48 Lưu Nhân Chú (U1) |
| WC12 Quạt & bút | P1 | R1 | H30 Trần Nhân Tông, H33 Trần Nhật Duật | H42 Nguyễn Trãi (U1); H55 Ngô Thì Nhậm (U2); H21 Lý Kế Nguyên (U3) |
| WC16 Voi chiến | P1 | R1 | H39 Dã Tượng | H53 Bùi Thị Xuân (U2); H04 Trưng Trắc, H09 Bà Triệu (U4) |
| WC06 Côn | P2 | U1 | H44 Nguyễn Chích | *H03 Thánh Gióng*, *H13 Phùng Hưng* (U4) |
| WC07 Rìu đồng/búa | P2 | U1 | H49 Nguyễn Xí | H19 Tông Đản (U3); H02 Cao Lỗ, *H12 Mai Thúc Loan* (U4) |
| WC08 Nỏ | P2 | U1 | H47 Trần Nguyên Hãn | H20 Thân Cảnh Phúc (U3); H01 An Dương Vương (U4) |
| WC13 Hỏa khí | P2 | U1 | H23 Hồ Nguyên Trừng | H56 Đô đốc Long (U2) |
| WC15 Trống đồng | P2 | U1 | H26 Giản Định Đế | H52 Nguyễn Lữ (U2); H08 Thánh Thiên (U4) |
| WC05 Trường đao | P3 | U2 | H50 Quang Trung | H22 Hoằng Chân (U3); *H10 Lý Nam Đế* (U4) |
| WC11 Cờ lệnh | P3 | U2 | *H51 Nguyễn Nhạc* | *H14 Dương Đình Nghệ* (U3) |
| WC10 Roi & xích | P4 | U4 | H05 Trưng Nhị | — |

Lý do: thứ tự bám đúng "đợt cần đầu tiên", nên không lớp nào làm sớm hơn nhu cầu. VS chứng minh luật "tướng mới trên lớp có sẵn ≈ 4 clip" bằng hai tướng cùng WC01 (Trần Hưng Đạo, Trần Khánh Dư) khác kỹ năng, Tuyệt Kỹ và binh khí. R1 nhận 8 lớp cho 14 tướng H27–H40 (~1,75 tướng/lớp) vì ba lớp WC02 (ván thuyền che vua của Lê Phụ Trần — Chính sử), WC12 (mưu sĩ điều phối Kế Sách) và WC16 (voi của Dã Tượng — Tương truyền) gắn trực tiếp với sự tích và bản sắc nhà Trần; bù lại WC05 dời sang U2 vì không tướng Trần nào dùng. Chi phí R1: 8 lớp × 27 = 216 clip lớp + 14 tướng × 4 = 56 clip riêng + 3 lớp địch × 12 = 36 clip, cộng rig voi (§13.3) đưa từ U2 lên R1. Lớp địch R1 chỉ cần EWC01 (Cung kỵ), EWC02 (Kích/đại phủ), EWC04 (Mã tấu kỵ) cho quân Mông–Nguyên; các lớp EWC khác làm theo đợt mở rộng.

### 4.5 Quy ước cinematic Tuyệt Kỹ (L6)

| Loại | Thời lượng | Cách dựng | Đồng hồ trận | Giới hạn số lượng |
|---|---|---|---|---|
| **Template** (mặc định cho mọi Tuyệt Kỹ) | 2–3 s | Camera cắt cảnh trong engine chạy **đè lên clip Tuyệt Kỹ gameplay**; dùng lại animation lớp + VFX có sẵn; chỉ khác tư thế riêng của tướng, 1 VFX đặc trưng và âm thanh. **4 mẫu camera** dùng chung: (1) xoáy quanh tướng, (2) hạ góc thấp, (3) lướt theo đòn, (4) toàn cảnh chiến trường. Không gắn địa điểm, chạy được trên mọi bản đồ | **Không dừng**: camera chỉ là trình bày, thời điểm trúng đòn giống hệt khi tắt cinematic | Không giới hạn |
| **Riêng (bespoke 3D)** | ≤ 6 s | Cảnh 3D dựng riêng trong engine, chỉ dành cho Tuyệt Kỹ; không dùng cho cảnh cốt truyện (cảnh cốt truyện là comic, §12.6) | Dừng (như cảnh mở Tổng Phản Công), bỏ qua được; chỉ phát lần đầu mỗi trận, các lần sau dùng template | **R1 tối đa 3**; mỗi đợt sau (U1–U4) **tối đa 2** |

- **3 suất của R1 (chốt v1.2, theo canon)**: Tuyệt Kỹ **H31** Trần Hưng Đạo "Bạch Đằng Quyết Chiến", **H35** Trần Quốc Toản "Bóp Nát Quân Thù", **H38** Yết Kiêu "Dây Nút Rút Chuỗi"; ba tướng phủ đủ 3 lớp P0 của VS (WC01, WC03, WC14). Cảnh mở B15 và kết B20 là **comic** (§12.6), không tính suất. Cảnh kết trận trong engine (camera kéo xa) ≤ 10 s cũng không tính suất.
- **Lá cờ sáu chữ** của Trần Quốc Toản ("Phá cường địch, báo hoàng ân") mang nhãn **Chính sử** (Toàn thư chép hơn nghìn gia binh và cờ sáu chữ), thống nhất với canon H35 (kỹ năng "Cờ Sáu Chữ", quote, Tuyệt Kỹ). Chuyện bóp nát quả cam ở Bình Than cũng là Chính sử; cách dàn dựng trong cinematic (gia binh xông lên sau cờ) là Hư cấu.
- Tuyệt Kỹ Hào Khí (§6.4) dùng cùng template, thêm mẫu camera (4) để thấy toàn quân xung phong.
- Cảnh "đặc thù" (dân binh, voi, thuyền) thể hiện bằng spawn gameplay có sẵn, không dựng riêng.
- Cài đặt "Cinematic Tuyệt Kỹ: Đầy đủ / Rút gọn 1 s / Tắt" chỉ đổi camera, không đổi sát thương hay thời lượng bất tử.
- **Tuyệt Kỹ hiệu ứng toàn bản đồ** (tác động tới thực thể ngoài mặt trận người chơi đang đứng): **tối đa 2 tướng mỗi thời đại**. Phần hiệu ứng ngoài mặt trận đang đứng chỉ được là buff/hồi phục cho phe ta hoặc thay đổi Sĩ Khí (tính bằng điểm); không đổi chủ Cứ Điểm, không trừ Q, không đẩy tuyến ở mặt trận khác. Lý do: giữ Tổng Phản Công là khoảnh khắc toàn quân duy nhất làm đổi thế trận trên mọi mặt trận.
- Lý do chung: cinematic riêng là hạng mục đắt nhất tính theo giây; template cho phép 50+ tướng có Tuyệt Kỹ "ra dáng" mà chi phí mỗi tướng chỉ là 1 tư thế + 1 VFX.

---

## 5. Quân ta

### 5.1 Sĩ Khí (mỗi cánh quân, cả hai phe)

**Đơn vị (L8)**: Sĩ Khí là **điểm trên thang 0–100**, kẹp trong [0, 100]. Mọi thay đổi cộng/trừ **điểm tuyệt đối** và ghi dạng "+15 Sĩ Khí", "−20 Sĩ Khí"; không dùng "%". Nếu một hiệu ứng thật sự cần thay đổi tương đối thì ghi dạng hệ số: "Sĩ Khí ×0,8". Dữ liệu canon còn ghi "±x% Sĩ Khí" được đọc là **±x điểm** cho tới khi tổ cân bằng sửa nguồn.

| Dải | Tên | Công / Thủ quân trong cánh | Hệ số mô phỏng `m_SK` | Hệ quả hành vi |
|---|---|---|---|---|
| 0–19 | Tan vỡ | −30% / −20% | ×0,70 | Lính hiển thị bỏ chạy về Cứ Điểm gần; địch chiếm Cứ Điểm của cánh nhanh ×1,5; báo động đỏ |
| 20–39 | Nao núng | −15% / −10% | ×0,85 | Không tự tiến; chỉ giữ |
| 40–59 | Vững | 0 | ×1,00 | Tuân lệnh bình thường |
| 60–79 | Hăng hái | +10% / +5% | ×1,10 | Tự tiến tới Cứ Điểm kế tiếp nếu không có lệnh |
| 80–100 | Quyết chiến | +20% / +10% | ×1,20 | Tự tiến; nuôi Hào Khí (§6) |

| Sự kiện | Δ Sĩ Khí cánh | Ghi chú |
|---|---|---|
| Khởi đầu trận | 50 (kịch bản được đặt 30–70) | |
| Chiếm Cứ Điểm trong cánh (kể cả mở/phá cổng) | +15 (doanh trại +20) | Phe mất Cứ Điểm −15 (doanh trại −20) |
| Hạ tướng/phó tướng địch trong cánh | +10 / +5 | Phe địch cánh đó −10 / −5 |
| Tướng ta trong cánh bị hạ | −25 | |
| Cứu tướng thành công | +15 | |
| Tướng người chơi có mặt trong cánh | +1 mỗi 5 s × hệ số Thống Suất | |
| Kỹ năng hiệu lệnh toàn quân | +15 mọi cánh ta | §4.1 |
| Kho lương của phe bị đốt | −20 toàn bộ cánh phe đó | |
| Trôi tự nhiên | về 50 với tốc độ 1 điểm/10 s | Lý do: không để cánh bị bỏ quên khóa cứng ở 0 hoặc 100. |

### 5.2 Cứ Điểm

**Luật chiếm chung**
- Mỗi Cứ Điểm có **quân đồn trú G** (lính mô phỏng). G là một phần của Q mặt trận: hạ một lính đồn trú trừ 1 khỏi cả G và Q (tinh nhuệ trừ 3), chỉ trừ một lần. Trừ quân đồn trú không tính vào trần trừ quân của tướng (§5.3) vì G nhỏ (≤ 80).
- Khi G = 0 → **trấn thủ** xuất hiện (nếu loại có trấn thủ), không sinh thêm lính trong vòng chiếm. Hạ trấn thủ → đứng/giữ Tương tác trong vòng tròn chiếm để lấy Cứ Điểm. Lính còn lại bị đẩy khỏi vòng khi người chơi bắt đầu chiếm.
- Trúng đòn chỉ **tạm dừng** tiến độ chiếm 0,5 s, không reset. Riêng đòn viền đỏ reset tiến độ.
- Chiếm bất kỳ Cứ Điểm nào: tướng người chơi hồi +15% Sinh lực. Phe mô phỏng cũng chiếm được (§5.3).

| Loại | G (Thường) | Trấn thủ | Thời gian chiếm | Khi ta chiếm | Khi mất |
|---|---|---|---|---|---|
| Đồn | 40 | Đội trưởng | 3 s | Điểm hồi sinh lính của cánh | Cánh lùi tuyến |
| Doanh trại | 80 | Phó tướng | 5 s | Ta +50 Q ngay; ta +1 lượt tiếp viện; thành điểm xuất tiếp viện và nguồn hồi quân; địch mất nguồn hồi quân và các đợt tiếp viện còn lại của doanh trại đó | Như trên, đảo phe |
| Cổng | HP 4.000 × S(R) (công trình; cổng ta 6.000 × S(R)) | — | — | Mở lối vào vòng trong; toàn bộ cánh +15 Sĩ Khí | Địch tràn vào vòng trong |
| Kho lương | 30 | Đội trưởng | 5 s để đốt/chiếm | Đốt: địch −20 Sĩ Khí toàn quân, hồi quân địch ×0,5 trong 120 s. Chiếm: ta nhận vật phẩm hồi Sinh lực | Ta chịu hiệu ứng tương tự |
| Bến thuyền | 50 | Đội trưởng | 5 s | Mở thuyền cho tướng (§5.8); tiếp viện đường thủy; địch mất các đợt tiếp viện còn lại của bến | Địch đổ bộ tại bến |
| Tháp canh | 20 (cung tinh nhuệ) | — | 3 s | Lộ minimap r 60 m; tắt mưa tên của tháp | Vùng đó mất tầm nhìn |

**Phá cổng** — ba cách, cùng khả thi ở mọi cấp:
- Tướng tự phá: sát thương lên cổng = `Công × MV / 3`, bỏ qua giáp → ~60 s.
- **Máy công thành ta** gây `200 × S(R)`/s → ~20 s nếu hộ tống thành công.
- Chiếm Cứ Điểm "cửa phụ" bên trong → nhắm ~45 s.

Lý do: cách nhanh nhất là hộ tống máy công thành, buộc người chơi làm việc cùng quân ta, nhưng người chơi không bao giờ bị kẹt.

### 5.3 Quân số trừu tượng & mô phỏng mặt trận

- Mỗi trận có 2–5 **mặt trận** (Trận nhanh: 2–3), cách nhau 150–300 m (15–30 s cưỡi ngựa). Mỗi mặt trận là một chuỗi Cứ Điểm và có **tuyến** `x ∈ [0,1]` (0 = bản doanh ta, 1 = bản doanh địch).
- Mỗi phe trên mỗi mặt trận giữ `Q[loại binh]` (quân số). Quy mô tham chiếu toàn trận: ta 3.000–6.000, địch 5.000–12.000. **Tỉ lệ F_địch/F_ta của mỗi mặt trận lúc mở trận phải nằm trong 0,8–1,5.** Phe thủ trong công sự nhận `diaHinh = 0,6` để bù chênh lệch quân số.
- **Tick mô phỏng = 1 s**, cố định, xác định (seed theo trận) → cùng hành động cho cùng kết quả trên mọi cấu hình.

```
// mỗi tick, mỗi mặt trận f, phe A đối phe B
F_A[i] = Q_A[i] * c[i] * khac(i, B) * m_SK(SK_A) * m_KS_A * m_lenh_A * m_TPC_A * (1 + min(0.3, 0.1 * soTuongAI_A))
F_A    = Σ_i F_A[i]
tonThat_A = SIM_LOSS_K * Σ_j F_B[j] * diaHinh_A * mThu_A * (tranThe_A == KhienThu && j ∈ {Cung/Nỏ} ? 0.5 : 1)   // người/giây
Q_A[i]  -= tonThat_A * Q_A[i] / Q_A * (bị khắc ? 1.25 : 1.0)
hoiQuan_A = SIM_REGEN * Q0_A * min(2, soDoanhTrai_A_trong_mat_tran) * m_luong_A   // người/giây, Q_A không vượt Q0_A
Q_A[i]  += hoiQuan_A * Q_A[i] / Q_A
x_f     += SIM_LINE_V * (F_ta - F_dich) / (F_ta + F_dich) * (Mũi dùi ? 1.5 : 1) * (TPC ? 3 : 1)   // "Giữ vững": phe đó không tiến
mỗi 10 tick: SK_A += 5 * (F_A - F_B) / (F_A + F_B)
Cứ Điểm nằm tại tuyến: G -= 0.5 * SIM_LOSS_K * F_tấn_công mỗi tick (công sự giảm nửa);
  G = 0 → Đồn/Tháp/Kho tự đổi chủ; Doanh trại/Cổng/Bến cần có tướng (AI hoặc người chơi) đứng chiếm.
Sụp đổ cánh: Q < 15% Q0 hoặc SK < 10 trong 15 s → mất Cứ Điểm gần nhất, tuyến lùi 0.1.

// Giá trị mặc định
SIM_LOSS_K = 0.0005 ; SIM_REGEN = 0.0002 ; SIM_LINE_V = 0.006
m_KS = 1 (không có Kế Sách) ; m_lenh = 1 | Tiến công 1.15 | Mũi dùi 1.1 ; m_TPC = 1 | 1.4 trong Tổng Phản Công (phe ta)
mThu = 1 | Tiến công 1.1 | Giữ vững 0.8 ; diaHinh = 1 | công sự 0.6
m_luong = 1 ; ×0.5 khi kho lương bị đốt (120 s) ; ×0.5 vĩnh viễn sau Đánh tiếp vận ; sàn 0.25
```

**Tiếp viện của địch**: mỗi doanh trại hoặc bến thuyền địch còn giữ thả **1 đợt 150 quân mỗi 180 s** vào mặt trận của nó, tối đa **4 đợt mỗi điểm** (kịch bản chỉnh được; Trận nhanh: 100 quân mỗi 120 s). Mất điểm đó thì mất các đợt còn lại. Đợt tiếp viện địch hiện đỏ trên minimap.

**Kiểm tra nhịp**: mặt trận 1.000 đối 1.000 cân bằng mất ~0,5 người/s mỗi phe, trận 20 phút mất ~45% quân. Ở tỉ lệ 1,5 : 1 không có người chơi, phe yếu tan sau ~27 phút. Hồi quân của 1 doanh trại (Q0 = 1.000) là 0,2 người/s, bù ~40% tổn thất nền.

**Tướng người chơi là biến số thật**
- Lính thường và tinh nhuệ bị tướng người chơi hạ trong vùng chiến đấu trừ Q địch **theo lượt vung**: mỗi lượt vung trừ `min(số lính bị hạ, 3)` (tinh nhuệ tính 3). Tổng trừ từ nguồn này có **trần 1,5 Q/s** (trung bình trượt 10 s).
- Ngoài trần, cộng thêm: hạ đội trưởng −10 Q, phó tướng −30, tướng −60 (kèm Sĩ Khí §5.1); mỗi Tuyệt Kỹ thường −20 Q; Tuyệt Kỹ Hào Khí −10% Q địch của mặt trận người chơi đang đứng (trần 300).
- Vì vùng chiến đấu luôn có đúng 30 địch ở mọi mức cài đặt (§13.1), trần 1,5 Q/s đạt được như nhau trên mọi cấu hình.
- Ngoài vùng chiến đấu, lính hiển thị chỉ "diễn" kết quả mô phỏng (ngã đúng lúc mô phỏng trừ quân).
- Với tổn thất nền ~0,5 người/s, tướng người chơi (1,5 Q/s) **tăng tốc độ tan rã của cánh địch mình đang đứng khoảng ×4** (0,5 → 2,0 người/s). Lý do: đây là con số hiện thực hóa "mình đang xoay chuyển cả trận chiến", nhưng tướng vẫn không một mình quét sạch được mặt trận vì còn hồi quân và tiếp viện địch.

**Kiểm thử tự động bắt buộc**: cùng seed và cùng chuỗi input ghi sẵn, chạy ở Thấp và ở Cực đại phải cho Q, tuyến, Hào Khí và điểm xếp hạng **giống hệt nhau**.

**Tính xác định trên web (v1.3)**: bao cả Worker mô phỏng lẫn vùng chiến đấu, vì vùng là nơi sinh KO và lượt vung trừ Q.
- Vùng chiến đấu chạy **bước cố định 1/60 s** bằng bộ tích lũy, độc lập với `requestAnimationFrame`: 30 fps là 2 bước mỗi khung; tối đa 4 bước rồi bỏ phần dư (chống xoáy chết). Input lượng tử theo số bước.
- Không dùng hàm Math siêu việt (`sin`, `atan2`, `exp`, `pow`) trong mô phỏng và vùng, vì độ chính xác phụ thuộc trình duyệt, hệ điều hành và CPU. PRNG có seed, Q là số nguyên, lượng giác qua bảng tra. Hình học trúng đòn chỉ dùng tích vô hướng và bình phương khoảng cách; nón so với cos ngưỡng lấy từ bảng.
- **Vector vàng**: 20 file (seed + chuỗi input ghi theo số bước → vết Q, tuyến, Hào Khí, KO theo tick) phải khớp tuyệt đối trên Chromium, WebKit và Gecko, ở Tùy chỉnh 50, Thấp và Cực đại, ở 30 lẫn 60 fps. Mô-đun mô phỏng và vùng chạy được trong Node để CI kiểm không cần trình duyệt.

### 5.4 Mệnh Lệnh (vòng 8 ô, đồng hồ trận ×0,2 khi mở)

| Ô | Lệnh | Tác dụng (lên cánh đang đứng hoặc cánh chọn trên bản đồ lớn) | CD gốc | Hệ số mô phỏng |
|---|---|---|---|---|
| 1 | **Tiến công** | Cánh tiến tới Cứ Điểm/điểm đánh dấu; tướng AI chuyển trạng thái Tiến công | 20 s | `m_lenh` 1,15; `mThu` 1,1 |
| 2 | **Giữ vững** | Dừng tiến, lập tuyến tại chỗ | 20 s | `mThu` 0,8; tuyến phe này không tiến |
| 3 | **Theo ta** | Thân binh + 1 đội 30 quân mô phỏng của cánh bám tướng người chơi (hiển thị tối đa 12 trong vùng chiến đấu, §13.1) | 10 s | — |
| 4 | **Tập trung mục tiêu** | Mọi quân ta trong 30 m ưu tiên mục tiêu đang khóa (tướng/máy công thành/cổng) | 30 s | Sát thương lên mục tiêu ×1,3 |
| 5 | **Bắn yểm trợ** | Cung/nỏ của cánh bắn một loạt vào vùng r 12 m | 45 s | MV 0,5 × 6 đợt lên mọi địch trong vùng |
| 6 | **Gọi tiếp viện** | §5.6 | 90 s + tốn 1 lượt | — |
| 7 | **Rút về tập hợp** | Cánh lui về Cứ Điểm gần nhất; sau 10 s hồi +10 Sĩ Khí và 5% quân số | 60 s | Không tổn thất khi đang rút |
| 8 | **Đổi trận thế** | Luân phiên: Khiên thủ (tổn thất từ Cung/Nỏ ×0,5) ↔ Mũi dùi (`m_lenh` 1,1, tốc tuyến ×1,5) | 30 s | theo trận thế |
| Tâm | **HỦY** | — | — | — |

Lệnh Kế Sách **không** nằm trong vòng; có nút riêng (§3.2).
CD thực = CD gốc × hệ số Thống Suất × (0,75 khi Hào Khí ≥ 75) × các giảm CD khác (WC12, cây kỹ năng), **sàn 0,5 × CD gốc**. Lý do: 8 hướng vừa một vòng radial trên cảm ứng; lệnh tác động vào mô phỏng để người chơi thấy kết quả trên bản đồ, không chỉ trên màn hình.

### 5.5 AI tướng đồng minh

| Trạng thái | Vào khi | Làm gì |
|---|---|---|
| Trấn giữ | Mặc định / lệnh Giữ vững | Đứng tại Cứ Điểm được giao, đánh địch trong 20 m |
| Tiến công | Lệnh Tiến công, Sĩ Khí ≥ 60, hoặc Tổng Phản Công | Dẫn cánh tới Cứ Điểm kế tiếp, chiếm như người chơi (thời gian ×1,5) |
| Hỗ trợ | Tướng người chơi trong 30 m đang đánh tướng địch | Đánh cùng mục tiêu, không cướp Đòn Quyết |
| Bị vây (SOS) | Sinh lực < 40% **và** F_địch/F_ta của cánh ≥ 1,2 | Phát sự kiện "Tướng ta bị vây" (§5.7) nếu bộ điều phối còn suất; thủ, hồi chậm |
| Rút lui | Sinh lực = 0 | Rời trận (không chết), cánh −25 Sĩ Khí; quay lại sau 180 s tại doanh trại nếu còn |

**Mô phỏng Sinh lực tướng AI ở xa**: tướng AI cách người chơi > 60 m được mô phỏng trừu tượng. Mỗi giây Sinh lực mất `0,02 × HP_max × max(0, F_địch/F_ta − 0,8)`, chỉ khi tuyến đang nằm ở Cứ Điểm tướng đó giữ. Điều kiện SOS không đếm lính hiển thị. Khi người chơi tới gần (≤ 60 m), sinh ra 15 lính vây theo Q.

Luật: tướng đồng minh sát thương ×0,5 lên tướng địch và không bao giờ tự hạ Đại tướng/Chủ soái. Tử trận lịch sử của tướng ta chỉ kể trong comic (kết chương hoặc khung comic chèn, §12.6), không diễn trong gameplay. Lý do: AI phải "giữ được mặt trận" nhưng chiến công chính luôn dành cho người chơi.

### 5.6 Tiếp viện ta (quân vàng)

| Tham số | Giá trị | Lý do |
|---|---|---|
| Lượt tiếp viện mỗi trận | 2 (kịch bản 1–3); +1 mỗi doanh trại/bến thuyền chiếm được, tối đa 4 lượt tồn | Tài nguyên hiếm để lệnh gọi tiếp viện là một quyết định. |
| Thời gian tới | 20 s từ lúc gọi | Có độ trễ để người chơi phải dự đoán. |
| Quy mô | 300 quân mô phỏng + 1 phó tướng AI (tiếp viện kịch bản có thể kèm tướng có tên) | Đủ lật một cánh cân bằng. |
| Điểm xuất | Doanh trại/bến thuyền ta gần mặt trận được chọn nhất | |
| Hiển thị | Vàng trên minimap trong 60 s hoặc tới khi nhập cánh → chuyển xanh | Giữ đúng quy ước màu của người dùng. |

### 5.7 Sự kiện động (Chiến cục)

**Bộ điều phối**: tối đa **2 sự kiện bắt buộc** đang mở cùng lúc, cách nhau ≥ 45 s. Hai sự kiện đồng thời phải nằm ở hai mặt trận cách nhau ≥ 150 m. SOS vượt hạn mức thì không hiện thành sự kiện; tướng đó mất Sinh lực chậm ×0,5 cho tới khi có suất trống. Mọi sự kiện có thông báo chữ + giọng + mũi tên cam.

**Giao việc cho quân** (áp cho mọi sự kiện có ghi "Giao được"): nếu người chơi ra Mệnh Lệnh "Tiến công" hoặc "Gọi tiếp viện" tới cánh có sự kiện, hạn giờ ×1,5; sự kiện tự thành công nếu F_ta/F_địch của cánh ≥ 1,0 lúc hết giờ. Thành công theo cách này chỉ nhận 50% Hào Khí và Sĩ Khí. Lý do: hai sự kiện cùng lúc trở thành lựa chọn "tự đi hay giao cho quân", không phải hình phạt.

| Sự kiện | Kích hoạt | Hạn giờ | Thành công | Thất bại | Giao được | Hành động người dùng phủ |
|---|---|---|---|---|---|---|
| Tướng ta bị vây | AI vào SOS | 75 s | Hạ đội trưởng vây trong 15 m → +6 Hào Khí, +15 Sĩ Khí | Tướng rút lui, −5 Hào Khí, −25 Sĩ Khí | Có | **Cứu tướng** |
| Cổng ta bị công | Máy công thành địch tới cổng | Tới khi cổng hết HP: 6.000 × S(R) ÷ 100 × S(R)/s = **60 s** | Phá máy → +5 Hào Khí | Cổng vỡ: −10 Hào Khí, địch tràn vào | Có | **Phá máy công thành** |
| Máy công thành địch xuất hiện | Kịch bản/mô phỏng | 90 s | Phá (HP 3.000 × S(R), giáp 0, ~12–15 s với tướng người chơi) → +5 Hào Khí | Như trên | Có | **Phá máy công thành** |
| Hộ tống | Kịch bản: xe lương / máy công thành ta / quân chủ lực / thuyền | Theo đường (tốc 3 m/s, dừng khi địch trong 8 m) | Tới đích → +4 Hào Khí, hiệu ứng theo loại (ví dụ máy công thành phá cổng) | Đoàn bị phá: −8 Hào Khí | Không | **Hộ tống quân**, **phá cổng** |
| Kho lương cháy | Địch đánh kho ta / ta tới kho địch | 60 s | Dập (giữ Tương tác 4 s, 3 điểm lửa) hoặc đốt kho địch | Hiệu ứng kho lương §5.2 | Không | **Đánh chiếm doanh trại/kho** |
| Phục binh địch | Người chơi vào vùng kịch bản | — | Hạ phó tướng phục binh → +3 Hào Khí | — | Không | |
| Địch đổ bộ | Bến thuyền địch còn hoạt động | 90 s | Chiếm bến trước khi đủ 3 đợt → +6 Hào Khí (như chiếm bến) | +1 cánh địch mới | Có | **Chiếm cứ điểm** |
| Tướng địch khiêu chiến | Sĩ Khí cánh địch ≥ 70 | 60 s | Đánh tay đôi (quân hai bên đứng xem) → +8 Hào Khí | Cánh ta −10 Sĩ Khí | Không | |
| Cứ Điểm bị phản công | Mô phỏng: địch dồn quân tới Cứ Điểm ta vừa chiếm | 60 s | Giữ → +3 Hào Khí | Mất Cứ Điểm | Có | **Ra lệnh cho quân** (Giữ vững), **gọi tiếp viện** |

### 5.8 Thuyền & thủy chiến (bản tối giản cho indie)

| Tham số | Giá trị |
|---|---|
| Điều khiển | Người chơi **không lái** thuyền. Thuyền chạy trên spline kịch bản, không mô phỏng lực nổi. |
| Lên/xuống thuyền | Giữ A_INTERACT 1 s khi cách ≤ 4 m (clip trèo 0,8 s) |
| Thuyền nhẹ ta | 8 m/s; chở tướng + 10 lính; mở tại bến thuyền ta |
| Chiến thuyền địch | HP 5.000 × S(R); 40 Q; trấn thủ là đội trưởng. Là **Cứ Điểm di động**: hạ trấn thủ rồi giữ Tương tác 3 s để chiếm (tính như Đồn: +3 Hào Khí) |
| Thuyền lương địch | HP 2.000 × S(R); phá/đốt tính vào Kế Sách "Đánh tiếp vận" |
| Mắc cạn | Tốc 0; quân trên thuyền mất 1 Sĩ Khí/s; lên boong đánh trực tiếp được |
| Đục thuyền (WC14) | Giữ Tương tác 3 s tại điểm đánh dấu ở mạn → thuyền mất 50% HP; đục 2 lần = chìm |
| Lặn (WC14) | Chỉ trong vùng nước kịch bản. Camera **luôn ở trên mặt nước**; tướng hiện là bóng tối mờ + vệt bọt dưới lớp nước depth-fade; không có post-process dưới nước. AI chỉ phát hiện tướng khi tướng trồi lên hoặc ở trong 3 m quanh thuyền |
| Lính trên thuyền | Tính vào ngân sách lính (§13.1) |

---

## 6. Hào Khí

### 6.1 Nguồn tăng

| Nguồn | + Hào Khí | Ghi chú |
|---|---|---|
| Hạ đội trưởng / phó tướng / tướng / đại tướng | +1 / +2 / +5 / +10 | Chủ soái kết thúc trận nên không tính |
| Chiếm đồn, tháp canh, chiến thuyền địch | +3 | |
| Chiếm doanh trại, bến thuyền (kể cả chặn đổ bộ) | +6 | |
| Mở/phá cổng địch | +5 | |
| Đốt kho lương địch | +6 | |
| Cứu tướng đồng minh | +6 | |
| Phá máy công thành địch | +5 | |
| Hạ phó tướng phục binh (sự kiện) | +3 | Không cộng thêm +2 của phó tướng |
| Hộ tống thành công / giữ Cứ Điểm bị phản công | +4 / +3 | "Cứu đồng đội" dạng đội quân |
| Hoàn thành nhiệm vụ phụ / nhiệm vụ chính của pha | +4 / +8 | |
| Kế Sách thành công (nhỏ / lớn) | +10 / +20 | Là **trần** của mọi thưởng Hào Khí từ Kế Sách đó, kể cả thưởng lẻ (§7) |
| Tướng địch khiêu chiến – thắng | +8 | |
| Giữ Sĩ Khí cao *(thụ động)* | +0,05/s cho mỗi cánh ta ở dải Quyết chiến (≥ 80), trần +0,15/s | ~3 điểm/phút/cánh |
| Mốc KO mỗi 100 *(thụ động)* | +2 | Trần +10 mỗi trận để KO không phải con đường chính |
| Phản đòn tướng trở lên | +1 | Tối đa 3 lần cho mỗi tướng địch |

**Không có trong bảng**: Tuyệt Kỹ và kỹ năng không cộng Hào Khí trực tiếp (§6.4). Hào Khí chỉ đến gián tiếp khi Tuyệt Kỹ hạ tướng hoặc giúp chiếm Cứ Điểm, tính theo đúng dòng tương ứng ở trên.
Hệ số: × độ khó (§10); Trận nhanh ×1,3. Mục tiêu nhịp: **Tổng Phản Công 1–2 lần/trận chuẩn**, lần đầu vào khoảng phút 8–12. Giá trị khởi điểm trận: **0** (kịch bản đặt 0–30).

**Ngân sách Hào Khí tham chiếu cho trận chuẩn 18 phút** (người thiết kế màn dùng để kiểm tra):

| Nhóm | Giả định | Điểm |
|---|---|---|
| Cứ Điểm | 8 đồn/tháp, 2 doanh trại/bến, 1 cổng, 1 kho | 24 + 12 + 5 + 6 = 47 |
| Hạ tướng các bậc | 15 đội trưởng, 6 phó tướng, 4 tướng, 1 đại tướng | 15 + 12 + 20 + 10 = 57 |
| Sự kiện | 2 cứu tướng, 1 máy công thành, 1 hộ tống, 1 giữ Cứ Điểm | 12 + 5 + 4 + 3 = 24 |
| Nhiệm vụ | 4 chính, 3 phụ | 32 + 12 = 44 |
| Kế Sách | 1 lớn, 1 nhỏ | 30 |
| Thụ động + KO + phản đòn | | ~18 |
| **Tổng** | | **~220 (~12/phút)** → Tổng Phản Công lần 1 ~phút 8, lần 2 ~phút 15 |

### 6.2 Nguồn giảm

| Nguồn | − Hào Khí |
|---|---|
| Tướng ta bị hạ (rút lui) | −5 (qua sự kiện bị vây) / −8 (bị hạ không qua sự kiện) |
| Mất đồn, tháp / doanh trại, bến | −5 / −10 |
| Cổng ta bị phá | −10 |
| Kho lương ta cháy | −10 |
| Hộ tống thất bại / nhiệm vụ thất bại | −8 |
| Tướng người chơi dùng Gượng dậy | −15 |
| **Suy giảm theo thời gian** | Không có **nguồn tăng chủ động** nào trong 45 s → −1 mỗi 5 s, **không tụt dưới mốc gần nhất đã đạt (25/50/75)** |

Nguồn tăng chủ động = Cứ Điểm, hạ tướng các bậc, sự kiện, nhiệm vụ, Kế Sách, khiêu chiến, phản đòn tướng. Nguồn thụ động (Giữ Sĩ Khí cao, mốc KO) **không** reset bộ đếm 45 s.
Lý do: suy giảm nhẹ ép người chơi luôn hành động; mốc khóa làm tiến độ không "trôi mất" vì đi đường dài. Chỉ sự kiện xấu mới kéo tụt qua mốc.

### 6.3 Mốc

| Mốc | Tên | Hiệu ứng toàn quân ta |
|---|---|---|
| 25 | Dấy khí | Công quân ta +5% |
| 50 | Hừng hực | Sĩ Khí mọi cánh trôi về 60 thay vì 50 |
| 75 | Sục sôi | Thân binh +50% (phần vượt trần hiển thị chỉ tồn tại trong mô phỏng, §13.1); CD Mệnh Lệnh ×0,75 |
| 100 | Tổng Phản Công sẵn sàng | A_RALLY sáng; Hào Khí khóa ở 100 (không suy giảm) tới khi kích hoạt. Điểm kiếm thêm vào **Hào Khí dư** (tối đa 30); nếu ôm quá 90 s thì Hào Khí dư ngừng tích |

### 6.4 Tổng Phản Công (TPC) & quan hệ với Tuyệt Kỹ

| Tham số | Giá trị |
|---|---|
| Kích hoạt | Người chơi chủ động giữ A_RALLY (không tự kích). Lý do: chọn thời điểm **và vị trí** là quyết định chỉ huy |
| Thời lượng | **Chuẩn 25 s** hiệu lực (sau cảnh mở đầu); biến thể theo màn 20–30 s (bảng biến thể bên dưới). Kéo dài: +1 s cho mỗi 3 điểm Hào Khí dư, cộng các nguồn khác (nút đỉnh nhánh Thống +5 s, kỹ năng/Tuyệt Kỹ tướng, Kế Sách của màn); **tổng kéo dài từ mọi nguồn tối đa +10 s** → một lần Tổng Phản Công dài tối đa 40 s |
| Cảnh mở đầu | 2,5 s, thời gian trận dừng, bỏ qua được: góc thấp tướng giơ binh khí → lia qua hàng quân ta → tiếng trống trận ba hồi + tù và + đồng thanh hô "Quyết chiến!". Trong cảnh này được phép hiển thị số lính ×2 và thêm 2 dải hàng quân nền dạng impostor phía sau (không ảnh hưởng mô phỏng vì trận đang dừng). Trận nhanh rút còn 1,5 s |
| Lính hiển thị | Hò reo, giơ vũ khí, đồng loạt tiến theo mũi tên hướng Cứ Điểm địch gần nhất; hiệu ứng cờ bay |
| Khi kích | Mọi mặt trận ta: tuyến +0,05 ngay. **Mặt trận người chơi đang đứng**: tuyến thêm +0,15, và mọi Cứ Điểm địch nằm tại tuyến có G < 50% đổi chủ ngay. Mọi cánh địch Sĩ Khí −20 |
| Trong thời lượng (bản chuẩn) | Mọi cánh ta: Sĩ Khí = max(hiện tại, 90), khóa ≥ 80; `m_TPC` = 1,4; tốc tuyến ×3; mọi tướng AI chuyển Tiến công. Tổng dịch chuyển ở mặt trận người chơi ~0,3–0,4 (1–2 Cứ Điểm) |
| Tướng người chơi | Công +20%, Khí Lực hồi ×2, **Tuyệt Kỹ đầu tiên trong TPC là Tuyệt Kỹ Hào Khí và miễn phí** |
| Kết thúc | Hào Khí về **25** (giữ mốc Dấy khí), sau đó cộng Hào Khí đã kiếm trong lúc TPC; Hào Khí dư về 0; dư âm 30 s: Sĩ Khí các cánh ta +10 |
| Âm nhạc | Chuyển lớp nhạc cao trào (stem trống + dàn dây), giảm 50% âm lượng tiếng lính thường |

**Tuyệt Kỹ Hào Khí**: phiên bản mở rộng Tuyệt Kỹ của tướng — bán kính ×1,5, tổng MV 35, **toàn cánh xung phong**, trừ 10% Q địch của mặt trận người chơi đang đứng (trần 300).
**Tuyệt Kỹ thường** của tướng Commander giữ bản sắc "gọi quân" người dùng đã đặt: tướng + thân binh + 1 đội 20 lính cùng ra đòn (§4.1). Bản Hào Khí là phiên bản toàn quân.
Tên kỹ năng giữ nguyên tên người dùng đặt:
- "Bạch Đằng Quyết Chiến" (Trần Hưng Đạo): bản thường gọi thân binh cùng tổng công kích; bản Hào Khí là cảnh toàn quân tổng công kích.
- "Phá Tống" (Lý Thường Kiệt): bản thường có một loạt mưa tên; bản Hào Khí thêm đại quân.
- "Ngọc Hồi – Đống Đa" (Quang Trung): cưỡi voi/ngựa xuyên chiến trường; bản Hào Khí có cả kỵ binh cùng xung phong.

Hai thanh **không** chuyển đổi cho nhau: Khí Lực là của tướng, Hào Khí là của toàn quân. **Tuyệt Kỹ không cộng Hào Khí** (L6), kể cả Tuyệt Kỹ Hào Khí; Tổng Phản Công không nạp Khí Lực ngoài mức "Khí Lực hồi ×2" ở bảng trên. Lý do: tách rõ "sức một người" và "khí thế cả quân" — đúng trụ cột; nếu Tuyệt Kỹ nạp Hào Khí, người chơi sẽ tối ưu bằng chém đám đông thay vì chỉ huy.

**Khung biến thể theo màn (L7)**

Luật chung cho mọi biến thể — **không đổi**: kích bằng giữ A_RALLY khi Hào Khí = 100; cảnh mở 2,5 s; tướng người chơi Công +20%, Khí Lực hồi ×2, Tuyệt Kỹ đầu tiên là Tuyệt Kỹ Hào Khí miễn phí; kết thúc Hào Khí về 25. Biến thể **chỉ được đổi**: thời lượng gốc (trong 20–30 s), hiệu ứng "Khi kích" và "Trong thời lượng" lên mô phỏng, lính hiển thị và cảnh mở. Mọi nguồn kéo dài vẫn chung trần +10 s. Mỗi màn dùng đúng một biến thể; dữ liệu trận ghi `tpcVariant`.

| Biến thể | Dùng ở | Thời lượng gốc | Khác bản chuẩn |
|---|---|---|---|
| **Chuẩn** | Mọi trận thắng theo sử không khai báo biến thể | 25 s | — |
| **Yểm Hộ** | Trận **thua / cầm cự / rút lui theo sử** (outcome "Thua"): B02, B04, B05, B12, B14, B23; B21 dùng bản con "Đa Bang" | 25 s (20–30) | Xem định nghĩa bên dưới |
| Áp mạn | B19 Vân Đồn | 25 s | Mọi thuyền nhẹ AI của ta đồng loạt nhận lệnh Áp mạn; thuyền lương địch bị áp mạn dừng lại; không đẩy tuyến trên bộ |
| Hai vách núi | B26 Chi Lăng – Mã Yên | 25 s | Toàn bộ phục binh hai vách xuất kích cùng lúc thay cho "tuyến +0,15"; cánh địch trong hẻm Sĩ Khí −30 |

**Định nghĩa Yểm Hộ** (dùng khi kết cục lịch sử là thua hoặc rút; **không bao giờ làm đổi kết cục lịch sử**):
- Khi kích: mọi cánh ta phản kích, đẩy địch lùi 30 m (tuyến mặt trận người chơi +0,05; các mặt trận khác giữ nguyên tuyến); cánh địch đang truy kích Sĩ Khí −30 và dừng truy (hoặc đợt công kế tiếp bị hoãn) 30 s.
- Trong thời lượng: `m_TPC` = 1,4 cho phe ta nhưng **tuyến phe ta không vượt quá vị trí lúc kích + 0,05** (không chiếm lại được Cứ Điểm đã mất; không có "Cứ Điểm G < 50% đổi chủ ngay"); quân và dân đang rút +50% tốc độ; tướng AI chuyển sang Hỗ trợ đoàn rút thay vì Tiến công.
- Kết thúc: các cánh tự trở về Mệnh Lệnh trước đó (thường là Rút về tập hợp hoặc Giữ vững); bản "Đa Bang" (B21) thêm: đoàn đang rút miễn truy kích 20 s.
- Xếp hạng của các trận này đo quân, dân và tướng được bảo toàn (định nghĩa M, Q của trận), nên Yểm Hộ dùng đúng lúc là cách chính để đạt hạng S.
- Chronicle "What if?" của một trận thua có thể đổi sang biến thể Chuẩn (§12.4).
Lý do: người dùng muốn Tổng Phản Công luôn là khoảnh khắc đỉnh; ở trận thua theo sử, đỉnh đó là "cứu được quân" chứ không phải "lật ngược sử".

---

## 7. Khung Kế Sách

**Định nghĩa**: Kế Sách là mưu lược gắn địa hình/lịch sử của từng trận, biểu diễn bằng máy trạng thái `Khóa → Khả dụng → Chuẩn bị → Sẵn sàng → Cửa sổ → Kết quả`. Mỗi trận có 1 Kế Sách lớn (bắt buộc hoặc quyết định thắng thua) và 0–3 Kế Sách nhỏ (tùy chọn).

```
KeSach {
  id, loai, quyMo: "nho"|"lon",
  dieuKien[]   // cờ trạng thái trận: Cứ Điểm sở hữu, pha, đồng hồ con nước, vị trí địch
  hanhDong[]   // việc người chơi phải làm: tương tác tại điểm, hộ tống, hạ trấn thủ, giữ vùng
  cuaSo { thoiLuong, canhBaoTruoc: 10 }   // giây
  phanThuong { haoKhi: 10|20, thuongLe[] , siKhi, hieuUngMoPhong, congTrang }   // haoKhi = trần theo quyMo
  thatBai { hieuUng, coTheThuLai: bool, thuLaiSau: giây, gayThua: bool }   // gayThua mặc định false
  // KHÔNG có trường hồi chiêu (cooldown)
}
```

**Luật thưởng & hồi chiêu (L5)**
- **Khung Hào Khí**: Kế Sách **Nhỏ +10**, **Lớn +20** (giá trị gốc, trước hệ số chung của §6.1: độ khó, Trận nhanh ×1,3, nút "Hào Khí nhận +5%"). Không có quy mô thứ ba.
- **Thưởng lẻ**: Kế Sách được chia thưởng theo tiến độ (ví dụ +3 mỗi thuyền lương bị phá, +4 mỗi làng sơ tán). Các thưởng lẻ **cộng dồn nhưng tổng không vượt mức quy mô** (+10 hoặc +20). Khi Kế Sách thành công, phần còn thiếu được cộng nốt để đủ mức; khi thất bại, giữ phần thưởng lẻ đã nhận. Các nguồn chung của §6.1 (hạ tướng, chiếm Cứ Điểm…) xảy ra trong lúc làm Kế Sách vẫn tính riêng như bình thường.
- **Không có hồi chiêu**: Kế Sách dùng theo máy trạng thái và điều kiện của trận, không có CD và không chịu hệ số giảm CD (Thống Suất, mốc 75, WC12). `thuLaiSau` là thời gian kịch bản dựng lại điều kiện sau khi thất bại, không phải hồi chiêu. Mỗi Kế Sách thành công tối đa 1 lần mỗi trận, trừ khi kịch bản khai báo khác.
- **commandTrait** của tướng (và nút cây kỹ năng nhánh Mưu) **chỉ tăng hiệu quả** Kế Sách: cửa sổ dài hơn, hiệu ứng mô phỏng mạnh hơn, chuẩn bị nhanh hơn, lộ thông tin. Không được cộng Hào Khí vượt khung, không thêm lượt dùng.
Lý do: một khung duy nhất giữ ngân sách Hào Khí §6.1 kiểm tra được; thưởng lẻ vẫn cho phản hồi tức thời mà không phá trần.

| Loại | Điều kiện | Hành động | Cửa sổ | Phần thưởng (tham chiếu) | Ví dụ lịch sử (nhãn) |
|---|---|---|---|---|---|
| **Cọc** | Có bãi cọc trên sông; hạm đội địch trong vùng | Giữ 3 điểm mốc cọc (hạ đội canh, Tương tác 5 s mỗi điểm) | 120 s | Lớn: thuyền địch trong vùng không di chuyển được khi triều rút; thủy binh địch `c ×0,3` | Bạch Đằng 938, 1288 — Chính sử |
| **Thủy triều** | Đồng hồ "Con nước" (100% → 0% trong 180 s) | Giữ hạm đội địch trong vùng tới lúc nước ròng: thanh "Thoát vây" của địch (0–100) tăng 0,5/s cho mỗi thuyền chỉ huy còn hoạt động, giảm 15 mỗi khi đục chìm/đốt một thuyền hộ vệ; chạm 100 = hỏng | Theo con nước; báo trước 30 s | Lớn: thuyền mắc cạn, lên boong đánh trực tiếp được | Bạch Đằng 1288 — Chính sử |
| **Phục kích** | Địch đi qua vùng hẹp (hẻm, rừng, khúc sông) | Ra lệnh cánh ẩn nấp (Giữ vững trong vùng phục), tướng người chơi ở ngoài 40 m để không lộ, tới khi địch vào vùng; bấm Lệnh Kế Sách | 30 s sau khi địch vào | Lớn: cánh địch Sĩ Khí −40, bị khắc toàn bộ trong 60 s | Chi Lăng 1427 — Chính sử |
| **Hỏa công** | Gió thuận (cờ gió trên HUD) + vật dễ cháy (thuyền kết, kho, trại) | Mang/đặt 3 mồi lửa hoặc hộ tống thuyền lửa | 60 s gió thuận | Nhỏ/lớn: sát thương vùng liên tục, địch trong vùng Sĩ Khí −20 | theo trận — gắn nhãn khi dùng |
| **Nghi binh** | Có cánh địch chủ lực bám theo người chơi | **Đánh rồi rút**: đánh tiên phong địch để nạp thanh "Khiêu khích" (+2 mỗi KO, +15 khi phá thế một phó tướng; đầy 100), rồi rút qua 3 mốc trong 90 s. Không được hạ tướng địch chỉ huy (đòn đánh chặn tướng đó ở 10% Sinh lực) | 90 s (pha rút) | Lớn: địch tiến vào vùng Kế Sách kế tiếp; cánh địch khác mất tướng chỉ huy tạm thời | Pha 1 Bạch Đằng (dụ vào sâu) — Chính sử |
| **Trá hàng / trá hòa** | Kịch bản ngoại giao trong trận | Hộ tống sứ giả tới trại địch; giữ Sĩ Khí cánh ≥ 40 trong thời gian đàm phán | 90 s | Nhỏ: địch ngừng tiến 90 s, ta hồi 10% quân số | Lam Sơn hòa hoãn 1423 — Chính sử (khắc họa trung tính) |
| **Vườn không nhà trống** | Trận thủ, địch tiến vào kinh thành/làng bỏ trống | Sơ tán kho lương (hộ tống 2 đoàn) trước khi địch tới | 150 s | Lớn: địch mất tiếp tế — mỗi 60 s ở vùng bỏ trống −10 Sĩ Khí, `c ×0,9` cộng dồn tới ×0,6 | Nhà Trần 1258, 1285 — Chính sử |
| **Đánh tiếp vận** | Đoàn lương/thuyền lương địch có lộ trình | Chặn và phá ≥ 60% đoàn trước khi tới đích | Theo lộ trình (~120 s) | Lớn: `m_luong` địch ×0,5 vĩnh viễn (mọi mặt trận), Sĩ Khí −15 | Vân Đồn, đông 1287–1288 (Trần Khánh Dư) — Chính sử |

**Cách báo cho người chơi** (theo thứ tự tăng dần):
1. **Khả dụng**: biểu tượng ✦ tím trên minimap + dòng thoại quân sư 1 câu ("Nước sắp ròng, giữ chúng trong bãi cọc!").
2. **Chuẩn bị**: thanh tiến độ ngay dưới minimap, liệt kê 1–3 việc cần làm.
3. **Sẵn sàng**: trống 3 hồi, ô ngữ cảnh (cảm ứng) / nút Kế Sách (F, D-pad phải) nhấp nháy.
4. **Cửa sổ**: vòng đếm ngược viền tím; 10 s cuối chuyển đỏ.
5. **Kết quả**: cảnh quay 3–6 s (bỏ qua được), thẻ chữ "Kế Sách thành công/thất bại", thẻ sử liệu mở trong Sử quán (có nhãn Chính sử/Tương truyền/Hư cấu).

Lần đầu gặp mỗi loại: thẻ hướng dẫn 1 màn hình, dừng trận. Lý do: Kế Sách là bản sắc Việt của game — phải đọc được trong 2 giây dù đang giữa đám đông.

**Ánh xạ Bạch Đằng 1288 (B20)** — màn trình diễn của VS; người chơi cầm Trần Hưng Đạo, Trần Khánh Dư hoặc Yết Kiêu (Trần Quốc Toản không có mặt):

| Pha | Nội dung | Luật |
|---|---|---|
| 1 | Nghi binh "đánh rồi rút" | Mở màn vẫn được chém |
| 2 | Chuỗi sự kiện động: hạ các đơn vị hộ vệ hạm đội | Dùng bộ điều phối §5.7 |
| 3 | Cọc | **Không có trạng thái thua** |
| 4 | Thủy triều (Con nước + thanh Thoát vây) | **Không có trạng thái thua** |
| 5 | Mắc cạn: thuyền địch thành Cứ Điểm di động (§5.8) | Pha 3 và 4 đều thành công → 100% thuyền trong vùng mắc cạn; hỏng bất kỳ pha nào → chỉ 50% mắc cạn và mất điểm K |
| 6 | Tổng Phản Công → Tuyệt Kỹ Hào Khí → cinematic "Bạch Đằng đại thắng" | Vào Pha 6, kịch bản **đặt Hào Khí = 100** và khóa, dù người chơi đã dùng TPC trước đó; nhắc giữ A_RALLY. Nếu tướng đang chơi không phải Trần Hưng Đạo: cảnh 2,5 s Trần Hưng Đạo (AI) truyền lệnh, rồi người chơi tung Tuyệt Kỹ Hào Khí của tướng mình. Cinematic kết luôn có Trần Hưng Đạo |

Ở B20, người chơi chỉ thua khi tướng người chơi gục (hết Sinh lực và hết Gượng dậy).

---

## 8. Bậc địch

HP/Công/Giáp gốc của **lính thường**: `HP = 120 × g(R)`, `Công = 40 × g(R)`, `Giáp = 20 × g(R)`; R = cấp đề xuất của trận. Lính thường và tinh nhuệ dùng `g(R)`. **Các bậc có thanh Phá Thế** dùng `HP = 120 × hệ số bậc × S(R)`.

| Bậc | HP × (cấp 1) | Công × | Giáp × | Phá Thế | Thời gian hạ mục tiêu* | Hành vi | Xuất hiện | Đối thoại |
|---|---|---|---|---|---|---|---|---|
| Lính thường | ×1 (120) | ×1 | ×1 | Không (luôn khựng) | 2 đòn | Vây; tối đa N lính đánh cùng lúc theo **thẻ tấn công** (§10); đòn chậm có báo trước 0,6 s | Theo đội 10–20 từ Cứ Điểm/tuyến | Hô chung theo phe (tiếng gốc của phe, có phụ đề) |
| Tinh nhuệ | ×3 (360) | ×1,5 | ×1,5 | Không; chỉ khựng khi MV ≥ 1,2 | 4–6 đòn | Đỡ đòn thường 30%; phối hợp 3–5 con | Theo nhóm 3–5 quanh đội trưởng/tướng | Không |
| Đội trưởng | ×6 (720) | ×2 | ×2 | 100 | ~5 s | Có 1 đòn viền đỏ; buff lính quanh +10% | Trấn thủ Đồn/Kho/Bến/chiến thuyền; dẫn đội | 1 câu khi bị hạ (tên chức, không tên riêng) |
| Phó tướng | ×12 (1.440) | ×3 | ×3 | 300 | ~10 s | 2 đòn đặc biệt + 1 viền đỏ; né khi bị combo dài | Trấn thủ Doanh trại; phục binh; tiếp viện địch | Tên + chức trên thanh; 1 câu xuất trận |
| Tướng | ×35 (4.200) | ×4 | ×3 | 600 | 20–25 s | Bộ chiêu lớp (đầy đủ nếu lớp WC, rút gọn nếu lớp EWC, §4.3) + 1 kỹ năng riêng; dùng Tuyệt Kỹ 1 lần khi Sinh lực < 50% | Có tên lịch sử (X-ID), xuất hiện theo kịch bản hoặc khiêu chiến | Thẻ giới thiệu 2 s (tên, chữ Hán, nhãn sử liệu); 2–3 câu trong trận |
| Đại tướng (boss) | ×100 (12.000) | ×5 | ×4 | 1.000 × 2 pha | 60–75 s | 2 pha (đổi chiêu ở 50%); gọi cận vệ; có đòn phạm vi dùng địa hình | Cuối pha lớn; có cảnh vào trận ≤ 10 s | Thoại mở, thoại chuyển pha, thoại kết thúc có danh dự |
| Chủ soái | ×150 (18.000) | ×6 | ×4 | 1.200 × 3 pha | ~110 s | 3 pha; pha 3 chỉ mở khi mục tiêu kịch bản/Kế Sách xong; thường không đánh tới chết mà rút lui/bị bắt | Trận cuối hoặc đỉnh chiến dịch | Như đại tướng + dòng tổng kết trận |

\* Người chơi **đúng tiến độ trang bị** (Công binh khí ≈ E(R)), cấp tương ứng, lớp trung bình, độ khó Thường.
**Luật ngân sách**: tổng thời gian đấu tướng các bậc trong một trận ≤ ~25% par. Với trận chuẩn tham chiếu (15 đội trưởng, 6 phó tướng, 4 tướng, 1 đại tướng) là ~4,9 phút / 18 phút ≈ 27%; người thiết kế màn giảm bớt đội trưởng nếu vượt.

**Kết cục tướng địch theo sử liệu**: tướng thường bị hạ trong gameplay = "rút khỏi trận". Boss (đại tướng, chủ soái, và tướng giữ vai boss của trận) **không bao giờ bị hạ trái với sử** (L12): mỗi boss có `defeatMeans` và thanh Sinh lực/Phá Thế của boss chỉ dẫn tới đúng kết cục đó.

| `defeatMeans` | Thể hiện trong gameplay | Ví dụ canon |
|---|---|---|
| **bị giết** | Đánh hạ ở pha cuối → boss ngã khuỵu, màn hình chuyển; cái chết chỉ nói trong comic/thẻ Sử quán, không hình ảnh xử tử hay máu | X07 Lưu Hoằng Tháo (B07), X19 Toa Đô (B17) |
| **bị bắt** | Vỡ Thế ở pha cuối + Đòn Quyết = bị quân ta vây và hạ vũ khí; không trói, không quỳ, không hạ nhục | X20 Ô Mã Nhi (B20), X30 Thôi Tụ (B27) |
| **rút chạy** | Sinh lực xuống ngưỡng pha cuối → cận vệ mở đường, boss rút; tính là hạ boss khi xét thắng | X18 Thoát Hoan (B16, B18), X23 Trương Văn Hổ (B19) |
| **tạm lui** | Không hạ được; đánh tới ngưỡng kịch bản (ví dụ 50%) → đợt công của boss dừng, có thể kích sự kiện kế tiếp | X14 Trương Phụ (B21) |
| **giảng hòa** | Đạt mục tiêu kịch bản (thường là Kế Sách lớn) → boss nhận giảng hòa và rút quân; thanh Sinh lực khóa ở ngưỡng | X10 Quách Quỳ (B10) |
| **tử thủ** | Boss lui vào nội thành/công sự khi tới ngưỡng; màn kết khi boss rút vào, không dựng cảnh tiếp theo | X09 Tô Giám (B09) |

- Ở trận thua theo sử (B12, B14…), boss chỉ bị đẩy lùi trong một pha (ví dụ Ô Mã Nhi ở B14: thuyền quay đầu), không bị hạ; điều kiện thắng của màn là bảo toàn quân/dân (§6.4 Yểm Hộ, §12.2).
- Không có cảnh xử tử, không máu, không hạ nhục. Người Việt theo địch/cầu viện ngoại bang (Trần Ích Tắc, Lê Chiêu Thống, Nguyễn Ánh) được khắc họa trung lập, **không làm tướng/boss chiến đấu** (quyết định #6). Không dùng từ miệt thị trong thoại, UI hay tên đơn vị. Lý do: đối thủ có danh dự làm chiến thắng có giá trị hơn.

---

## 9. 8 binh chủng chuẩn

Chỉ số tương đối so với "Giáo binh = 1,0". `c` là hệ số chất lượng trong mô phỏng (§5.3).

| Binh chủng | HP | Công | Tầm | Tốc | Giáp | `c` mô phỏng | Vai trò | Khắc (×1,5) | Bị khắc (×0,75) |
|---|---|---|---|---|---|---|---|---|---|
| Khiên binh | 1,3 | 0,8 | 1,0 | 0,9 | 1,5 | 1,0 | Giữ tuyến, chắn tên | Cung/Nỏ | Kỵ, Tượng |
| Giáo binh | 1,0 | 1,0 | 1,5 | 1,0 | 1,0 | 1,0 | Chống xung phong | Kỵ | Cung/Nỏ |
| Cung/Nỏ binh | 0,7 | 1,0 (tầm xa) | 8,0 | 1,0 | 0,6 | 0,9 | Sát thương tầm xa, bắn yểm trợ | Giáo, Tượng (tên lửa) | Khiên, Kỵ |
| Kỵ binh | 1,4 | 1,2 | 1,3 | 1,8 | 1,0 | 1,4 | Xung phong, đánh sườn | Khiên, Cung/Nỏ | Giáo, Tượng |
| Tượng binh | 6,0 | 2,5 | 1,5 | 0,8 | 2,0 | 3,0 (mỗi Q = 1 voi + tốp lính) | Phá tuyến, gây hoảng | Kỵ, Khiên | Cung/Nỏ (tên lửa), Hỏa công |
| Thủy binh | 0,9 | 1,0 | 1,0 | 1,2 (trên nước) | 0,8 | 1,0 trên nước / 0,6 trên cạn | Chiến thuyền, đổ bộ | Mọi binh chủng khi họ ở trên nước | Kế Sách Cọc/Thủy triều |
| Công binh / máy công thành | 0,6 (lính) · máy HP 3.000 × S(R) | 0,5 lên quân · lên công trình: máy ta 200 × S(R)/s, máy địch 100 × S(R)/s | 1,0 / 30 (máy bắn) | 0,6 | 0,5 | 0,5 | Phá cổng, công thành | Cổng, Cứ Điểm | Mọi binh chủng đánh gần, tướng |
| Tinh nhuệ / cận vệ | 2,0 | 1,5 | 1,0 | 1,2 | 1,8 | 1,6 | Bảo vệ tướng | — | — (không khắc, không bị khắc) |

Sát thương công trình bất đối xứng có chủ đích: máy địch chậm hơn để người chơi có ~60 s phản ứng (§5.7).

**Vòng khắc chế chính** (4 binh chủng bộ, dễ nhớ): **Giáo → Kỵ → Khiên → Cung/Nỏ → Giáo**. Kỵ khắc Khiên vì đánh sườn khi khiên chậm xoay; Khiên khắc Cung/Nỏ vì chặn tên. Tượng binh là "quân chủ bài" ngoài vòng, bị khắc bởi tên lửa và hỏa công. Lý do: vòng 4 đủ để lệnh "đổi trận thế"/đưa cánh nào đi đâu có ý nghĩa mà không cần bảng tra.

Trong mô phỏng, khắc chế áp `khac(i,B)` = trung bình có trọng số theo tỉ lệ binh chủng phe B (1,3 khi khắc, 0,8 khi bị khắc — nhẹ hơn hệ số chiến đấu trực tiếp để tránh cánh quân bị xóa sổ). Nâng cấp quân đoàn (§11.4) nhân vào HP/Công/`c`.

---

## 10. Độ khó (5 mức)

| Tham số | Dân binh (Dễ) | Quân sĩ (Thường) | Tướng quân (Khó) | Nguyên soái (Rất khó) | Truyền Kỳ |
|---|---|---|---|---|---|
| HP địch × | 0,7 | 1,0 | 1,3 | 1,7 | 2,2 |
| Công địch × | 0,5 | 1,0 | 1,6 | 2,4 | 3,5 |
| Phá Thế địch × | 0,7 | 1,0 | 1,2 | 1,4 | 1,6 |
| Thẻ tấn công (lính đánh cùng lúc) | 2 | 3 | 4 | 6 | 8 |
| Cửa sổ phản đòn (PC/gamepad) | 0,25 s | 0,15 s | 0,12 s | 0,10 s | 0,08 s |
| Cửa sổ phản đòn (cảm ứng, +0,05 s, sàn 0,10 s) | 0,30 s | 0,20 s | 0,17 s | 0,15 s | 0,13 s |
| Báo trước đòn viền đỏ (PC/gamepad) | 0,9 s | 0,6 s | 0,5 s | 0,4 s | 0,3 s |
| Báo trước đòn viền đỏ (cảm ứng, sàn 0,45 s) | 0,9 s | 0,6 s | 0,5 s | 0,45 s | 0,45 s |
| `c` địch trong mô phỏng × | 0,85 | 1,0 | 1,1 | 1,2 | 1,3 |
| Hào Khí nhận × | 1,3 | 1,0 | 1,0 | 0,9 | 0,8 |
| Hạn giờ sự kiện động × | 1,5 | 1,0 | 0,9 | 0,8 | 0,7 |
| Gượng dậy (hồi 50% Sinh lực, bất tử 3 s) | 2 | 1 | 0 | 0 | 0 |
| Cấp địch | R | R | R | R + 3 | min(trần cấp của đợt, R + 15) |
| Thưởng EXP/tiền × | 0,8 | 1,0 | 1,2 | 1,5 | 2,0 |
| Tự nhắm/tự combo | Mặc định bật | Tùy | Tùy | Tùy | Tùy |

Luật:
- Xếp hạng S/A/B/C tính cùng công thức ở mọi độ khó (§12.1).
- Đổi độ khó giữa trận chỉ theo hướng giảm, và chỉ ở checkpoint.
- **Truyền Kỳ** mở sau khi hoàn thành chiến dịch của đợt đó. Mỗi trận đã chơi được chơi lại ở Truyền Kỳ; đây là nội dung cuối game của mỗi đợt phát hành.
- Cấp địch **không tự co giãn** theo cấp tướng. Tùy chọn "Đồng bộ cấp" (tắt mặc định) chỉ có ở Võ trường và Chronicle.
- Lý do: Dễ là chế độ "kể sử" cho người chơi phổ thông/học sinh; cảm ứng được bù độ trễ để người chơi di động không bị phạt vì phần cứng.

---

## 11. Progression

### 11.1 Cấp & EXP

| Tham số | Giá trị | Lý do |
|---|---|---|
| Cấp tối đa kỹ thuật | 50 | Khớp `g(L)`. |
| **Trần cấp theo đợt** | R1 = 35 · U1 = 40 · U2 = 45 · U3/U4 = 50 | Mỗi đợt có chỗ để lớn lên mà không cần cày 2 triệu EXP ở R1. |
| EXP lên cấp | `EXP_next(L) = 50 × L² + 250` (cấp 1: 300 · 10: 5.250 · 20: 20.250 · 30: 45.250 · 49: 120.300; tổng 1→50: 2.033.500) | Đường cong bậc hai dễ đọc, dễ chỉnh. |
| EXP một trận | `2 × EXP_next(R)` × xếp hạng (S 1,5 · A 1,25 · B 1,0 · C 0,8) × độ khó; Trận nhanh ×0,6. Ở Truyền Kỳ, R = cấp địch thực tế | ~2–3 cấp/trận quanh cấp đề xuất R. |
| Vượt cấp | Tướng cao hơn R + 5 → EXP ×0,5 | Chống cày trận dễ. |
| Tướng không xuất trận | 30% EXP trận ("Hậu doanh luyện quân"); **50%** nếu tướng thuộc chiến dịch đang chơi | Cho phép đổi tướng không bị bỏ xa. |
| Tướng bắt buộc/giới hạn theo kịch bản | Được nâng tối thiểu lên cấp R − 2 khi vào trận (không trừ EXP của ai) | Ví dụ B15 bản VS khóa Trần Quốc Toản (Trần Nhật Duật là đồng minh AI), B15 bản R1 cho chọn một trong hai (L13); B20 chỉ cho 3 tướng. |
| Tướng mới mở | Cấp khởi điểm = trung bình 3 tướng cao nhất − 5 | Mở rộng (U1–U4) chơi ngay được. |
| Cấp đề xuất R1 | B12 → B20: 1 → 25 (Hàm Tử B15 ≈ 10, Bạch Đằng B20 ≈ 25) | Cuối cốt truyện R1 tướng chính ở ~cấp 27. Mở rộng dùng dải 20–50, **R cố định mỗi trận**. |

### 11.2 Điểm kỹ năng & cây kỹ năng

- Nguồn: 1 điểm/cấp + 1 điểm cho lần đầu đạt S mỗi trận chính với tướng đó + Chronicle (1 điểm lần đầu hạng A và 1 điểm lần đầu hạng S mỗi kịch bản, tối đa 6 trong R1).
- **Trong R1**: cuối cốt truyện một tướng chính có ~**33–40 điểm** (~45–50% cây); tối đa R1 (cấp 35 + mọi hạng S + Chronicle) = 34 + 9 + 6 = **49 điểm** (~65% cây). Cả cây **75** điểm hoàn tất ở các bản mở rộng → phải chọn. Tẩy điểm miễn phí ở doanh trại.
- Cây: **3 nhánh × 8 nút + 1 nút đỉnh mỗi nhánh = 27 nút**. Mỗi nhánh 4 tầng × 2 nút; giá nút tầng 1/2/3/4 = 1/2/3/4 điểm; đỉnh = 5 điểm, yêu cầu **15 điểm trong nhánh và cấp 20** → mỗi tướng R1 mở được 1 đỉnh.

| Nhánh | Ví dụ nút (tầng 1 → 4) | Nút đỉnh (ví dụ) |
|---|---|---|
| **Võ** (chiến đấu cá nhân) | +5% Công · +5% chí mạng · Phá Thế +15% · cửa sổ phản đòn +0,05 s · hồi Khí Lực khi Vỡ Thế · +10% sát thương Tuyệt Kỹ · C6 thêm sóng · né để lại tàn ảnh | Tuyệt Kỹ tiêu 1 vạch có 25% hoàn 50 Khí Lực |
| **Thống** (quân ta) | +2 thân binh · hào quang +3 m · CD Mệnh Lệnh ×0,9 · tiếp viện +100 quân · tướng AI +15% Sinh lực · Sĩ Khí cánh có mặt +1/5 s thêm · Giữ vững `mThu` thêm −0,1 · lượt tiếp viện +1 | Tổng Phản Công kéo dài +5 s |
| **Mưu** (Kế Sách & Hào Khí) | Hào Khí nhận +5% · cửa sổ Kế Sách +10% · lộ phục binh trên minimap · đốt kho nhanh 40% · chiếm Cứ Điểm nhanh 30% · mốc 25 thưởng +2% Công · Kế Sách lớn: hiệu ứng mô phỏng kéo dài +20% · suy giảm Hào Khí chậm 50% | Bắt đầu mỗi trận với Hào Khí +15 |

Kỹ năng lớp (ô 2–3) mở theo cấp 1/4/8/12/18/25, không tốn điểm. Khí Lực tăng vạch theo cấp (§1), không nằm trong cây. Lý do: cái bắt buộc phải có không được nằm trong cây — cây chỉ để định hình phong cách.

### 11.3 Binh khí & rèn

| Bậc | Công binh khí (cộng vào hệ số) | Ô Khắc | Nguồn |
|---|---|---|---|
| 1 Thường | +0% | 0 | Mặc định |
| 2 Tinh | +10% | 0 | Rơi ở trận cấp 5+, rèn |
| 3 Bảo | +20% | 1 | Rơi đội trưởng/phó tướng, rèn |
| 4 Danh | +35% | 1 | Rơi tướng/đại tướng, thử thách |
| 5 Truyền thế | +50% | 2 | Binh khí riêng của tướng (nhiệm vụ riêng; ví dụ gươm Thuận Thiên của Lê Lợi — Tương truyền) |

- Công thực = `Cong(L) × (1 + bậc% + 0,06 × mức rèn)`, **cộng** chứ không nhân; tối đa ×1,8.
- Rèn +1 → **+5**, mỗi mức +6%. Chi phí mức n: `400 × n²` Tiền + `5 × n` Tinh thiết (+5 tổng 22.000 Tiền, 75 Tinh thiết). **Không có tỉ lệ thất bại**. Lý do: tránh cảm giác may rủi, hợp tính giáo dục.
- Ô Khắc (chọn 1 dòng/ô): Phá giáp +10% · Chí mạng +5% · Hồi sức (hồi 1% Sinh lực mỗi 20 KO) · Chấn (đòn C có 10% gây choáng) · Tốc đánh +5% · Nuôi Sĩ Khí (+1 Sĩ Khí cánh mỗi 30 KO) · Khí Lực +10%.

### 11.4 Quân đoàn & doanh trại (hub)

| Hạng mục | Cấp | Hiệu ứng | Chi phí |
|---|---|---|---|
| 8 binh chủng (§9) | 1–5 | Mỗi cấp trên 1: lính hiển thị HP/Công +8%; `c` mô phỏng +3% (cấp 5: +32% / +12%) | Lên cấp n: `150 × n²` Quân công (1 → 5 tổng 8.100 mỗi binh chủng) |
| Thân binh | 1–5 | Đổi loại (khiên → tinh nhuệ → kỵ), +1 đòn phối hợp | `500 × cấp` Quân công |
| Doanh trại | 1–3 | 1 Trướng soái (bản đồ chiến dịch, Chronicle) · 2 Lò rèn + Luyện binh trường (quân đoàn) · 3 Võ trường (luyện tập, thử thách thời gian, Đồng bộ cấp) | `2.000 × cấp` Tiền |
| **Sử quán** | — | Thẻ sử liệu có nhãn, mục "Comic" đọc lại theo Quyển/Chương, Đấu trường Sử quán (§12.6); **mở miễn phí** theo tiến độ cốt truyện (sau B12), không khóa sau tiền | — |
| Chuồng ngựa | 1–3 | Ngựa dùng chung; cấp mở ngựa bền hơn (HP ngựa 30% → 50% HP tướng) và gọi nhanh hơn (CD 20 → 10 s) | `1.500 × cấp` Tiền |

### 11.5 Tiền tệ (tối đa 3) — thu nhập tham chiếu

| Tiền tệ | Kiếm từ (mỗi trận) | Tham chiếu trận chuẩn | Tiêu vào |
|---|---|---|---|
| **Tiền** (quan tiền) | `60 × Diem × (1 + 0,05 × (R − 1))` × thưởng độ khó; rương Cứ Điểm | ~4.500–10.000 | Rèn, doanh trại, chuồng ngựa, tẩy Khắc |
| **Tinh thiết** | Tướng 2, đại tướng 6, đốt kho 3; thử thách | ~15–20 | Nâng bậc & rèn binh khí |
| **Quân công** | `2 × tổng Hào Khí kiếm được (kể cả dư) + 150 × số Kế Sách thành công + 5 × Sĩ Khí trung bình` | ~1.000–1.100 | Quân đoàn, thân binh |

Kiểm tra vòng lặp: nâng cả 8 binh chủng lên cấp 5 cần ~64.800 Quân công ≈ 60 trận; R1 (9 trận chính + chơi lại, Truyền Kỳ, Chronicle) đạt khoảng một nửa. Rèn một binh khí lên +5 ≈ 3–4 trận Tiền.
**Không gacha, không bán tiền tệ bằng tiền thật**: tướng mở bằng tiến độ chiến dịch/mở rộng đã mua; mọi thứ trong game kiếm được bằng chơi. Lý do: phù hợp quyết định #9 và tính giáo dục lịch sử. "Quân công" gắn với Hào Khí để phần thưởng nuôi đúng trụ cột.

---

## 12. Cấu trúc màn chuẩn

| Thành phần | Trận chuẩn (PC / điện thoại chọn) | Trận nhanh (mặc định điện thoại) |
|---|---|---|
| Thời lượng | 15–25 phút (par 18); trận cao trào như B20: 25–30 phút (par 25) | 8–12 phút (par 10); B20: 12–15 (par 13) |
| Mặt trận | 2–5 | 2–3 (gộp cánh phụ) |
| Pha | 3–6 | 2–4 (pha phụ thành sự kiện tùy chọn); Bạch Đằng giữ đủ 6 pha, rút ngắn từng pha |
| Sự kiện động | Theo điều phối §5.7 | Số lượng ×0,5, hạn giờ ×1,2 |
| Hào Khí | ×1,0 | ×1,3 |
| Kế Sách | Đủ | Kế Sách lớn giữ nguyên, cửa sổ ×0,75, bỏ Kế Sách nhỏ tùy chọn |
| Tiếp viện địch | 150 quân/180 s | 100 quân/120 s |
| KO par (KO trong vùng chiến đấu) | 800 | 400 |
| Thưởng | ×1,0 | ×0,6 (theo phút ≈ ngang Trận chuẩn) |
| Tiến độ cốt truyện | Có | Có (hai chế độ đều mở khóa trận tiếp theo) |

Nhịp màn chuẩn: Comic mở chương và Quyết sách (§12.6, bỏ qua được) → Pha 1..n (mỗi pha 1 mục tiêu chính + 0–2 phụ) → Đỉnh (đại tướng/chủ soái hoặc Kế Sách lớn) → Cảnh kết trong engine ≤ 10 s → Comic kết chương → thẻ Sử quán → Quiz chương (không bắt buộc).

**Map nền & bố cục**: R1 dùng **4 map nền** theo canon: Đồng bằng (B12, B16; có module cổng thành), Sông (B13, B14, B15, B17), Rừng núi (B18), Cửa sông/biển (B19, B20). Mỗi trận là một bố cục Cứ Điểm + mặt trận đặt trên map nền. Chronicle và Võ trường dùng bố cục **sinh theo seed** (vị trí Cứ Điểm, loại binh, hướng gió) trên cùng map nền. Lý do: đáp ứng quy mô indie "3–5 map + chiến trường procedural".

**Hướng dẫn (L4)**:

| Bản build | Trận | Dạy gì | Ghi chú |
|---|---|---|---|
| **VS** | **B15 Hàm Tử – bản VS** | **Toàn bộ**: di chuyển, chiến đấu, Mệnh Lệnh, Cứu tướng, Kế Sách, Tuyệt Kỹ, Hào Khí, Tổng Phản Công; tối đa 1 thẻ hướng dẫn mỗi pha | Chơi H35 Trần Quốc Toản (khóa), H33 Trần Nhật Duật là đồng minh AI (L13); tướng dựng sẵn cấp 10, 3 ô kỹ năng, cây kỹ năng phân bổ sẵn, khóa rèn và doanh trại, kỹ năng mở dần; kịch bản đảm bảo Hào Khí ≥ 90 ở pha boss để dạy Tổng Phản Công |
| VS | B20 Bạch Đằng | Không có hướng dẫn mới; thẻ nhắc cho Cọc, Thủy triều, lặn/đục thuyền (WC14) | Dựng sẵn cấp 25 cho cả 3 tướng (H31, H34, H38) |
| **R1** | **B12 Bình Lệ Nguyên** (17/1/1258) | Di chuyển, chiến đấu, **Mệnh Lệnh** — trọng tâm "rút lui có trật tự" (Rút về tập hợp, Giữ vững) | Lần chơi đầu **ẩn thanh Hào Khí**; Kế Sách lớn "Lui binh có trật tự" được trình bày như mục tiêu Mệnh Lệnh, chưa hiện thẻ Kế Sách. Tổng Phản Công – Yểm Hộ chỉ bật khi chơi lại B12 sau B13 |
| **R1** | **B13 Đông Bộ Đầu** (đêm 28–29/1/1258) | **Kế Sách, Hào Khí, Tổng Phản Công** | Thanh Hào Khí xuất hiện từ đầu màn; Kế Sách lớn "Dạ tập lâu thuyền" là thẻ Kế Sách đầu tiên; boss Ngột Lương Hợp Thai ở pha cuối là lần kích Tổng Phản Công đầu tiên |
| R1 | B15 Hàm Tử – bản R1 | Không có hướng dẫn; chỉ thẻ nhắc cho hệ thống lần đầu gặp (Cứu tướng) | Chơi H35 **hoặc** H33, tướng không chọn thành đồng minh AI (L13); độ khó theo chiến dịch, mở toàn bản đồ, Toa Đô đủ 2 pha |

- Bản build R1 **không** dùng B15 bản VS làm khúc dạo đầu; B15 bản VS chỉ có trong build VS (và có thể giữ làm bản demo).
- Bộ cờ hướng dẫn tách khỏi dữ liệu trận để bật/tắt theo bản build; dữ liệu trận có trường `variant` (VS / R1) để pipeline không lấy nhầm danh sách tướng chơi được.
Lý do: R1 dàn hướng dẫn qua hai trận đầu để trận thua có chủ đích B12 chỉ phải dạy một ý (rút lui có trật tự là một quyết định chỉ huy), còn trụ cột Hào Khí được dạy ở trận thắng đầu tiên B13, nơi Tổng Phản Công có nghĩa trọn vẹn.

### 12.1 Xếp hạng

```
Diem = 35*M + 15*T + 20*Q + 20*C + 10*K            // mỗi thành phần 0..1 ; Công trạng = Diem
M = 0.6 (mục tiêu chính) + 0.4 * tỉ lệ nhiệm vụ phụ hoàn thành
T = 1 nếu thời gian <= par; giảm tuyến tính về 0 tại 2*par
Q = 0.5 * clamp((SiKhiTrungBinhCacCanh - 30) / 50, 0, 1) + 0.5 * tỉ lệ tướng ta không bị hạ
C = 0.5 * min(1, KO / KO_par) + 0.5 * (tướng địch đã hạ / tổng tướng địch)     // KO trong vùng chiến đấu
K = Kế Sách thành công / tổng Kế Sách (trận không có Kế Sách: dồn 10 điểm vào M)
Trừ: 5 điểm mỗi lần Gượng dậy; 5 điểm mỗi lần tải lại checkpoint; 5 điểm mỗi lần tiếp tục sau crash từ lần thứ 2 (§12.3)
```
| Hạng | Điểm |
|---|---|
| S | ≥ 85 |
| A | 70–84 |
| B | 50–69 |
| C | < 50 (vẫn thắng) |

Lý do: 65% điểm (M + Q + K) thưởng việc hoàn thành mục tiêu, chỉ huy và giữ quân ta, chỉ 20% cho chém giết — đúng trụ cột "Quân ta".

### 12.2 Thắng / thua

| Thắng (một trong, theo kịch bản) | Thua (bất kỳ) |
|---|---|
| Đạt kết cục `defeatMeans` của boss mục tiêu (§8: bị giết, bị bắt, rút chạy, tạm lui, giảng hòa, tử thủ) | Tướng người chơi hết Sinh lực và hết Gượng dậy |
| Hoàn thành Kế Sách lớn + mục tiêu pha cuối | Chủ tướng phe ta (nếu kịch bản có, ví dụ tướng AI chỉ huy bản doanh) bị hạ |
| Giữ bản doanh tới hết giờ (trận thủ) | Mất bản doanh ta |
| Trận thua theo sử: đưa đủ quân/dân/đoàn thuyền về điểm rút hoặc cầm cự đủ thời gian kịch bản | |
| | Hộ tống bắt buộc thất bại / Kế Sách lớn có `gayThua = true` thất bại (chỉ dùng khi kịch bản không có đường lui; **B20 không dùng**, §7) |
| | Quá 60 phút (Trận chuẩn) / 30 phút (Trận nhanh) |

### 12.3 Checkpoint & gián đoạn trên điện thoại

- **Checkpoint tự động**: đầu mỗi pha, khi Kế Sách lớn vào Sẵn sàng, trước đại tướng/chủ soái. Lưu ảnh chụp đầy đủ mô phỏng (Q, SK, tuyến, Cứ Điểm, Hào Khí, Hào Khí dư, Khí Lực, đồng hồ, seed). Thua → chọn "Về checkpoint" (−5 điểm xếp hạng) hoặc "Đánh lại từ đầu".
- **Mất tiêu điểm** (cuộc gọi, thông báo, chuyển ứng dụng hoặc tab; trên web là `visibilitychange` sang ẩn hoặc `pagehide`, app Capacitor thêm sự kiện `appStateChange`): **tạm dừng ngay**, ghi đồng bộ vào `sessionStorage` một cờ nhỏ (đã ẩn, tick t) rồi thử ghi ảnh chụp gần nhất đang có ở luồng chính (≤ 2 ms); không gọi sang Worker, vì trên iOS Worker và giao dịch IndexedDB có thể bị treo ngay khi tab bị đẩy nền. Để luôn có ảnh chụp mới, Worker mô phỏng đẩy ảnh chụp về luồng chính mỗi 10 tick (chuyển quyền buffer), luồng chính ghi IndexedDB mỗi 15 s và ở checkpoint, Tổng Phản Công, hạ boss. Quay lại: đếm ngược 3 s + 1 s chậm ×0,5. Mở lại mà thấy cờ "đã ẩn" thì coi là mất tiêu điểm: tiếp tục từ ảnh chụp mới nhất, **không trừ điểm**, kể cả khi hệ điều hành đã đóng tab hoặc ứng dụng (mở lại được trong 24 giờ).
- **Ảnh chụp định kỳ** (IndexedDB mỗi 15 s; v1.2 là 30 s) chỉ dùng khi ứng dụng bị crash, tức mở lại mà không có cờ "đã ẩn": lần đầu trong trận không trừ, từ lần thứ 2 trừ 5 điểm như tải checkpoint. Lý do: không phạt gián đoạn ngoài tầm kiểm soát, nhưng chặn việc vuốt tắt ứng dụng để lùi trận.
- Mô phỏng xác định + ảnh chụp < 256 KB để lưu nhanh trên thiết bị yếu.

### 12.4 Chronicle "What if?"

| Tham số | Luật |
|---|---|
| Nơi truy cập | Chỉ ở **Trướng soái** (doanh trại cấp 1). Sử quán chỉ chứa thẻ sử liệu và comic đọc lại. Hiến kế khác ở Quyết sách (§12.6) làm màn "What if?" tương ứng hiện trước trong danh sách; điều kiện mở giữ nguyên |
| Mở khóa | Một kịch bản mở khi trận gốc đạt hạng A |
| Cấu trúc | Mỗi kịch bản đổi 1–3 biến: tướng còn sống, Cứ Điểm/Q ban đầu, Hào Khí khởi điểm, Kế Sách có/không. Dùng lại map nền, bố cục sinh theo seed và cùng mô phỏng |
| Nhãn | Kịch bản "What if?" luôn gắn nhãn **"Hư cấu"** trên thẻ vào trận (màn Chronicle tướng C01–C06: xem bên dưới); kết màn bằng thẻ **"Sử thật"** tóm tắt diễn biến thật (có nhãn Chính sử/Tương truyền) |
| Thưởng | 1 điểm kỹ năng lần đầu hạng A + 1 điểm lần đầu hạng S mỗi kịch bản (tối đa 6 trong R1); Tiền/Quân công như trận thường |
| Ràng buộc | Không vượt phạm vi lịch sử của game (không vào thế kỷ XIX); không có trận nào chống quân của người Việt theo địch hay cầu viện ngoại bang; tuân nguyên tắc nhạy cảm (quyết định #6) |

Ba kịch bản R1:
1. **"Trần Quốc Toản không tử trận ở 1285"** — cho phép Trần Quốc Toản xuất trận ở B20 (chỉ trong Chronicle).
2. **"Nếu Thoát Hoan giữ được Thăng Long và đoàn thuyền lương không bị chặn ở Vân Đồn"** — thay cho câu "quân Nguyên chiếm được Thăng Long", vì trên thực tế quân Nguyên–Mông đã chiếm Thăng Long nhiều lần (1258, 1285, 1288) rồi phải rút (Chính sử).
3. **"Nếu bãi cọc Bạch Đằng bị lộ"** — B20 không có Kế Sách Cọc; phải thắng bằng Hỏa công và Đánh tiếp vận.

**Màn Chronicle tướng C01–C06** (L10, L11): sáu tướng chỉ có ở Chronicle có màn chính thức, **dùng lại map nền sẵn có** của thời đại, không thêm vào 30 trận chính. Nhãn theo nội dung, không mặc định "Hư cấu": C01 là **Huyền sử** (nhãn Tương truyền, trình bày như "chuyện kể bên lửa trại"); C02–C06 dựng quanh sự kiện có trong sử, chi tiết dựng thêm gắn Hư cấu. Mở khi hoàn thành chiến dịch của thời đại đó; thưởng như kịch bản "What if?".

| Mã | Tướng | Màn | Đợt |
|---|---|---|---|
| C01 | H03 Thánh Gióng | Phù Đổng (chuyện kể bên lửa trại) | U4 |
| C02 | H10 Lý Nam Đế | Vạn Xuân khai quốc | U4 |
| C03 | H12 Mai Thúc Loan | Hắc Đế ở Vạn An | U4 |
| C04 | H13 Phùng Hưng | Vây phủ Tống Bình | U4 |
| C05 | H14 Dương Đình Nghệ | Đại La 931 | U3 |
| C06 | H51 Nguyễn Nhạc | Ba anh em cùng ra Bắc | U2 |

Tướng dự bị cho cập nhật (chưa có màn, chưa vào roster): Trần Thánh Tông, Đỗ Hành (nhà Trần), Chiêu Văn (nhà Lý).

Kịch bản Quang Trung (U2): **"Quang Trung không mất năm 1792"** — chiến dịch giả định trên map E9, đối thủ chỉ là quân Thanh (chuyện Quang Trung đòi đất Lưỡng Quảng là Tương truyền, dùng làm cớ kịch bản); mốc giả định kết thúc trước năm 1800; không có trận nào với quân Nguyễn Ánh. Rút từ "sống thêm 20 năm" để không chạm thế kỷ XIX.

### 12.5 Bản đồ chiến dịch dạng nút

- Mỗi thời đại là một bản đồ; mỗi hồi là một cụm nút. **Nút chính** = trận B-ID; **nút phụ** = thử thách hoặc Chronicle; **nút hub** = Doanh trại.
- Thắng một nút chính (mọi hạng) mở các nút kề. Nút phụ mở khi trận liên quan đạt hạng B (Chronicle: hạng A, §12.4).
- R1 (E6): **Hồi 1** (1258: B12–B13) → **Hồi 2** (1285: B14–B18, gồm B15 Hàm Tử và B18 Vạn Kiếp – sông Sách, kết thúc cuộc kháng chiến lần hai) → **Hồi 3** (1287–1288: B19–B20, kết ở Bạch Đằng ngày 9/4/1288). Chia hồi theo năm của canon (`battle.act`); B18 diễn ra khoảng tháng 6–7/1285. Hoàn thành Hồi 3 mở Chronicle R1, Truyền Kỳ R1 và nút liên kết sang các bản mở rộng đã mua.
- Bản mở rộng thêm bản đồ thời đại riêng; mọi bản đồ nối vào một "Dòng sử" chung theo thứ tự thời gian (E1 → E9).
- Mỗi bản đồ thời đại là một **Quyển**, mỗi nút chính là một **Chương** (§12.6).

### 12.6 Quyển, Chương, comic, Quiz (v1.2)

Chiến dịch **Sử Ký** chia **9 Quyển** (mỗi thời đại E1–E9 là Quyển I–IX, đánh số theo dòng thời gian, không theo đợt phát hành) và **30 Chương chính** (mỗi trận B01–B30 là một Chương, ID Chương trùng ID trận). Màn Chronicle C01–C08 là **Chương phụ**; kịch bản "What if?" không phải Chương. Đặc tả chi tiết (bố cục đọc, quy trình ảnh, pháp lý AI, đo lường) ở GDD mục 22; mục này chỉ giữ luật và con số mà các mục khác phải dùng.

**Dữ liệu**: mỗi trận có `battle.chapter = {quyen, chuong, quyetSach}`. `quyen` = ID thời đại; `chuong` = thứ tự chơi trong Quyển (Quyển V: B09 → B11 → B10). `quyetSach = {lichSu, khac, danhDau?, mien?}`: `lichSu` = tên Kế Sách Lớn chính của trận (đúng tên trong `keSach`), `khac` = 2 kế khác ngắn, có thể nghĩ tới lúc đó (nhãn Hư cấu), `danhDau` = các Kế Sách được đánh dấu khi chọn đúng nếu nhiều hơn một (B20: 3 Kế Sách Lớn; B26: Cầu gãy – bùn lầy + Thua giả), `mien` = khi nào không có Quyết sách (`lanDau`: B12, B13 lần chơi đầu; `VS`: B15 bản VS).

**Luồng một Chương** (Chơi lại và Truyền Kỳ không tự phát comic; sa bàn có nút "Xem comic"):

| # | Bước | Khối lượng | Thời lượng | Bắt buộc |
|---|---|---|---|---|
| 1 | Comic mở chương (phần Tình thế, rồi phần Chủ soái quyết sau bước 2) | 6–10 khung | 60–90 s | Không, bỏ qua được |
| 2 | **Quyết sách**: chọn 1 trong 3 chiến lược; 1 là cách người xưa đã làm | 3 thẻ | Không giới hạn | Có (trừ Chương miễn) |
| 3 | Sa bàn, chọn tướng và quân; **Trận** | — | Theo §12 | Có |
| 4 | Cảnh kết trận trong engine: camera kéo xa thấy toàn chiến trường | — | ≤ 10 s | Không |
| 5 | Xếp hạng, thưởng (§12.1) | — | — | Tự động |
| 6 | Comic kết chương: kết quả, hệ quả lịch sử, người xưa đã làm gì | 4–8 khung | 40–60 s | Không, bỏ qua được |
| 7 | Mở thẻ Sử quán | — | — | Tự động |
| 8 | Quiz chương | 3–5 câu | 1–2 phút | Không |
| 9 | Bản đồ chiến dịch (§12.5) | — | — | — |

- **Comic Quyển**: mỗi Quyển có comic mở và kết Quyển, cộng lại **10–14 khung**. Ở Chương cuối Quyển, comic kết chương gộp với kết Quyển, tổng ≤ 10 khung. Lần chơi đầu R1 phải cầm quân sớm: comic mở Quyển VI ≤ 4 khung (≤ 40 s) và comic mở B12 ≤ 4 khung. Chương phụ Chronicle: khoảng 8 khung (mở + kết), không có Quyết sách.
- **Nhịp truyện giữa trận** (sứ giả đến, thuyền vua khuất vào sương, tin tướng tử trận): **khung comic chèn** 1–2 khung, tối đa 2 lần mỗi trận, dừng đồng hồ trận, bỏ qua được; hoặc cảnh ngắn trong engine bằng camera và spawn có sẵn. Không có tranh động 2.5D.
- **Khối lượng** (ước lượng ban đầu): 30 Chương × ~14 khung + 9 Quyển × ~12 + 8 Chronicle × ~8 ≈ 600 khung; ~60 tờ nhân vật (56 tướng + tướng địch chính). GDD 22.4 tính lại 650–700 khung và ~135 tờ khi cộng What if, khung đáp lời Quyết sách và nhân vật phụ; phải đo lại trên Chương mẫu B20.

**Luật Quyết sách**

| Trường hợp | Trận | Kế Sách | Thêm |
|---|---|---|---|
| Chọn **đúng cách lịch sử** | Như cũ | Kế Sách chính (và các Kế Sách trong `danhDau`) mang dấu **Kế đã định** trên bản đồ lớn và minimap từ đầu trận | **Tình báo sớm**: lộ tuyến tiến của địch ngay từ sa bàn |
| Chọn **cách khác** | Như cũ | Không có dấu; người chơi tự tìm Kế Sách qua quân sư và tháp canh như thường | Comic kết chương giải thích người xưa đã làm gì; mở trước màn "What if?" tương ứng trong Chronicle nếu có |

- Quyết sách **không đổi khung thưởng Hào Khí** (Kế Sách Nhỏ +10, Lớn +20, §7), Hào Khí khởi điểm, luật xếp hạng hay độ khó ở cả hai nhánh. Tình báo sớm chỉ đưa trước thông tin mà quân sư, tháp canh hoặc thẻ tình báo vốn sẽ báo, không thêm thông tin mới. Nghiệm thu bằng playtest: tỉ lệ hạng S của hai nhánh chênh ≤ 5 điểm phần trăm.
- Vị trí thẻ lịch sử xáo mỗi lần; trước khi chọn, không thẻ nào ghi "cách người xưa", và comic phần Tình thế không lộ phương án lịch sử. Chơi lại: thẻ lịch sử mang dấu "Người xưa chọn" và cả hai nhánh nhận tình báo sớm.
- Chương miễn Quyết sách: B12, B13 ở lần chơi đầu (hai trận hướng dẫn, §12), B15 bản VS, mọi Chương phụ Chronicle. Quyết sách đầu tiên của R1 ở B14 (bản VS: B20), kèm 1 thẻ hướng dẫn 1 màn hình.

**Hiển thị comic**

| Thuộc tính | Điện thoại (nằm ngang) | PC |
|---|---|---|
| Mặc định | Đọc từng khung, lia/phóng nhẹ | Xem nguyên trang |
| Lật | Chạm nửa phải → khung sau; nửa trái → khung trước | Phím mũi tên, Space, chuột; tay cầm A/B |
| Bỏ qua | Luôn được; đọc lại trong Sử quán | Như điện thoại, phím Esc |

- Comic = khung tĩnh + chuyển động nhẹ: lia, phóng, parallax 2 lớp, chữ hiệu ứng. Cài đặt "Rung và nháy" tắt lia, phóng và rung.
- **Ảnh không chứa chữ**. Lời dẫn, bóng thoại và chữ hiệu ứng do engine dựng từ dữ liệu vi/en, đúng dấu tiếng Việt. Lời dẫn mang nhãn Chính sử / Tương truyền / Hư cấu; lời thoại mặc định Hư cấu, trừ câu có nguồn.
- Ảnh do người vận hành AI sinh (Higgsfield, Nano Banana Pro 2K) theo style bible chung, rồi được người chỉnh tay, lọc thống nhất trong engine (nét mực, giảm dải màu 7 bậc, kéo màu sơn mài, giấy dó), xếp trang và vẽ chữ; cố vấn sử duyệt từng khung; mỗi ảnh có nhật ký prompt, model, ngày, người chạy. Khai báo nội dung AI (Steam, luật Việt Nam) và căn cứ tác quyền ở GDD 22.7. Chương mẫu: `hao-khi-viet/comic/B20-bach-dang/`.

**Quiz**

| Tham số | Luật |
|---|---|
| Ngân hàng | ~400 câu: 10–15 câu mỗi Chương chính, mỗi lượt rút 3–5 câu; Chương phụ Chronicle chỉ hỏi thẻ "Sử thật" |
| Dạng | Trắc nghiệm 4 lựa chọn · Đúng/sai · Xếp dòng thời gian · Chấm vị trí trên sa bàn · Nối tướng – trận · "Ai nói câu này" (chỉ câu có nguồn) |
| Mỗi câu | Giải thích + nhãn sử liệu + liên kết "Xem lại khung". Dữ liệu để đáp án đúng ở vị trí 0; engine **xáo vị trí** khi hiển thị (Đúng/sai giữ thứ tự) |
| Nội dung | Chỉ hỏi điều người chơi đã gặp (khung comic đã xem, trận đã đánh, thẻ Sử quán đã mở). Không hỏi điểm còn tranh cãi, trừ câu dạy về chính sự tranh cãi (cờ `contested`) |
| Sai | **Không phạt**. Câu sai vào hàng ôn, quay lại sau 1–3 Chương (lặp lại ngắt quãng) |
| Thưởng | Thẻ Sử quán, trang phục, danh hiệu, khung chân dung. **Không thưởng sức mạnh**: không EXP, Tiền, Tinh thiết, Quân công, điểm kỹ năng hay chỉ số |
| Chế độ | Quiz chương · Đấu trường Sử quán (tính giờ, có bản không tính giờ) · Câu hỏi mỗi ngày · Gói lớp học (giáo viên chọn Quyển, xuất kết quả; ngoại tuyến) |
| Duyệt | Cố vấn sử duyệt 100% câu trước khi phát hành |

**Đo lường**: tỉ lệ bỏ qua comic, thời gian đọc mỗi khung, tỉ lệ làm Quiz, tỉ lệ đúng lần 1 / lần 2 (ôn), tỉ lệ chọn đúng Quyết sách; chi tiết ở GDD 22.8.

Lý do: comic rẻ và dễ sửa hơn tranh động 2.5D, đọc được trên điện thoại, và là nơi kể phần sử mà trận không kể được. Quyết sách và Quiz biến kiến thức thành lựa chọn và phần ôn tập, nhưng không cho sức mạnh, để người bỏ qua vẫn chơi công bằng.

---

## 13. Cài đặt & ngân sách hiệu năng

### 13.1 Số lính hiển thị (ĐÃ CHỐT — giữ nguyên số)

| Mức | Số lính hiển thị tối đa | Nền tảng | Mặc định cho |
|---|---|---|---|
| Thấp | 100 | Điện thoại, PC | Điện thoại T1 (yếu) |
| Vừa | 200 | Điện thoại, PC | Điện thoại T2 (tầm trung) |
| Cao | 400 | Điện thoại, PC | Điện thoại T3 (flagship); PC theo benchmark |
| Rất cao | 800 | Điện thoại T3, PC | PC theo benchmark |
| Cực đại | 1.500 | **Chỉ PC** | PC theo benchmark |
| Tùy chỉnh | 50–2.500 | PC 50–2.500; điện thoại T1 50–200, T2 50–400, T3 50–800 | — |

**Hai hạng iOS trên web (v1.3)**: trình duyệt và WKWebView trên iPhone có trần bộ nhớ thấp hơn app native nhiều lần (§13.3), nên iPhone không dùng T1–T3 mà dùng hai hạng riêng. Năm mức và công thức phân bổ bên dưới giữ nguyên.

| Hạng | Máy | Mặc định | Tùy chỉnh | Cao 400 | Rất cao, Cực đại |
|---|---|---|---|---|---|
| iOS-sàn | iPhone SE 3, màn 375 × 667 CSS px | Thấp 100, cũng là trần | 50–100 | Không | Không |
| iOS-chuẩn | iPhone 12 trở lên | Vừa 200 nếu benchmark đạt, chưa đạt thì Thấp 100 | 50–200; 50–400 sau benchmark | Chỉ qua Tùy chỉnh, khi benchmark p95 ≤ 28 ms | Không |

**Ngoại lệ tạm**: iPhone T3 (A16+) theo bảng trên mặc định Cao 400. Trên web, mặc định là Vừa 200 cho tới khi benchmark iOS đạt, rồi trả về Cao 400. Lý do là trần bộ nhớ tab, không phải đổi số đã chốt.

**Vùng chiến đấu cố định ở mọi mức** (kể cả Tùy chỉnh 50):
- Trong r 25 m quanh tướng người chơi luôn có **đúng 30 địch** (nếu Q cho phép).
- Quân ta chiến đấu trong vùng do mô phỏng quyết định và **tối đa 20** ở mọi mức: thân binh hiển thị = min(thân binh, 8), đội "Theo ta" hiển thị 12, phần còn lại lấy từ lính cánh theo tỉ lệ Q. Thân binh vượt trần hiển thị chỉ tồn tại trong mô phỏng (cộng vào Q cánh).
- Chỉ lính trong vùng chiến đấu mới tấn công hoặc bị tính trúng đòn của tướng người chơi. Lính ngoài vùng là "lính diễn".
- Hệ quả: KO, trừ Q, Hào Khí và xếp hạng **không đổi theo cấu hình** (quyết định #8), có kiểm thử tự động ở §5.3.

**Phân bổ lính hiển thị theo tỉ lệ từ mô phỏng** (ngoài vùng chiến đấu)

```
N      = số lính hiển thị tối đa của mức (100 / 200 / 400 / 800 / 1500 / Tùy chỉnh)
B_vung = 50                     // 30 địch + tối đa 20 quân ta, cố định mọi mức
B_con  = N - B_vung             // ngân sách cho mọi thứ ngoài vùng chiến đấu (Tùy chỉnh 50 → 0)

r (tỉ lệ mức) = Thấp 0.20 | Vừa 0.35 | Cao 0.60 | Rất cao 1.00 | Cực đại 1.00
  Tùy chỉnh: nội suy tuyến tính theo N qua các mốc (100, 0.20) (200, 0.35) (400, 0.60) (800, 1.00);
             N < 100 → 0.20 * N / 100 ; N ≥ 800 → 1.00

tranMuc_w   = B_con * trongSo_w / Σ trongSo    // trọng số cánh: cánh người chơi đang đứng (vành 25–60 m) = 2,
                                               //                cánh khác trong tầm nhìn = 1, ngoài tầm nhìn = 0
phan_p      = clamp(Q_w,p / (Q_w,ta + Q_w,dich), 0.3, 0.7)      // chia trần cánh cho hai phe theo tỉ lệ Q
hienThi_w,p = max(6, min(tranMuc_w * phan_p, round(Q_w,p * r)))  // Q_w,p = lính mô phỏng của phe p trong cánh w
```
- **Lính hiển thị của một cánh = min(trần mức, Q cánh × tỉ lệ mức)**, tối thiểu **6 hình nhân mỗi cánh (mỗi phe) trong tầm nhìn**. Nếu B_con không đủ cho mức tối thiểu 6 ở mọi cánh, cánh xa nhất chuyển sang chỉ hiện trên minimap trước. Ở Tùy chỉnh 50, B_con = 0: cả ngân sách dành cho vùng chiến đấu, các cánh khác chỉ hiện trên minimap.
- Mỗi phe tối thiểu 30% trần của cánh (kẹp `phan_p`), để cánh sắp vỡ vẫn thấy được địch/ta.
- Khi Q cánh giảm, số hình nhân giảm theo (hình nhân "ngã" đúng lúc mô phỏng trừ quân, §5.3), nên người chơi nhìn thấy cánh nào đang hao.
- **Lính do kỹ năng, Tuyệt Kỹ, tiếp viện gọi ra** đều là lính mô phỏng: phần nằm trong vùng chiến đấu đi theo trần 20 quân ta (cố định mọi mức); phần ngoài vùng hiển thị `max(6, round(số mô phỏng × r))` và lấy từ B_con. Sức chiến đấu luôn tính theo số mô phỏng.
- **Thuyền hiển thị** theo cùng nguyên tắc: tối đa 24 (Thấp) / 40 (Vừa) / 60 (Cao trở lên) thuyền dựng hình, phần còn lại là impostor ở xa; hạm đội vẫn tính theo số mô phỏng.
- Kiểm tra nhanh: mặt trận 1.000 ta / 1.200 địch, mức Vừa (N = 200, B_con = 150, r = 0,35): Q × r = 350 / 420 vượt trần, nên cánh người chơi (trọng số 2 trên tổng 3 nếu có thêm một cánh khác trong tầm nhìn) nhận ~100 suất chia theo tỉ lệ Q hai phe (~45 ta / ~55 địch), cánh kia ~50 suất. Ở Rất cao (B_con = 750), cánh người chơi nhận ~500 suất.
Lý do: một công thức duy nhất cho mọi nguồn lính (cánh, kỹ năng, tiếp viện, thuyền) nên mức cài đặt chỉ đổi mật độ hình ảnh; tỉ lệ ta/địch trên màn hình luôn phản ánh đúng tỉ lệ Q, là thông tin chỉ huy người chơi cần.

**Đơn vị ngoài ngân sách lính** (có trần riêng):

| Đơn vị | Trần trong khung hình (điện thoại) | Ghi chú |
|---|---|---|
| Tướng skinned | 6 | Tướng người chơi ≤ 10 nghìn tam giác (PC ≤ 15 nghìn); tướng khác ≤ 6 nghìn (PC ≤ 10 nghìn) (§13.3); ≤ 60 xương; 2 xương/đỉnh ở T1 |
| Boss, kỳ hạm, cổng thành | 2 boss + 1 kỳ hạm + 1 cổng ở LOD0 | ≤ 8 nghìn tam giác (PC ≤ 15 nghìn) |
| Thuyền thường | ≤ 12 thuyền LOD0 (≤ 3 nghìn tam giác), phần còn lại LOD1 ≤ 800 tam giác, vẽ instanced; tổng thuyền dựng hình 24 / 40 / 60 theo mức (§13.1) | Lính trên thuyền tính vào ngân sách lính |
| Máy công thành | 6 | ≤ 1.500 tam giác (PC ≤ 3.000) |
| Voi | 12; mỗi con tính = 5 lính vào ngân sách | LOD0 ≤ 8 nghìn (PC ≤ 15 nghìn) cho tối đa 3 con gần nhất; phần còn lại LOD1 ≤ 1.500 (PC ≤ 3.000) |

- **Lính mô phỏng không phụ thuộc cài đặt** → kết quả trận không đổi theo cấu hình. Đổi số lính hiển thị được **giữa trận**.
- Mục tiêu FPS: điện thoại 30; flagship tùy chọn 60 (khi bật 60 fps, số lính hiển thị tự giới hạn ở 200); có thêm 40 fps cho màn ≥ 120 Hz. PC 60 (tùy chọn không giới hạn). iOS ở Low Power Mode khóa `requestAnimationFrame` ở 30 fps, nên 60 fps trên iPhone không hứa được.
- **Phát hiện hạng máy** (v1.3): trình duyệt không cho biết tên SoC, nên danh sách chip chỉ đặt trần; benchmark chỉ được giữ hoặc hạ.
  - Android: chuỗi UA rút gọn của Chrome thay model bằng "K". Đọc model qua `navigator.userAgentData.getHighEntropyValues(['model'])` (chỉ Chromium); không có thì đoán SoC từ chuỗi GPU (ví dụ Mali-G57 MC2 là Helio G99); không được nữa thì dựa hẳn vào benchmark.
  - Bộ nhớ: `navigator.deviceMemory` làm tròn xuống lũy thừa 2 và không phải trình duyệt nào cũng có. Báo 2 trở xuống → tối đa T1; báo 4 → không đặt trần, vì máy 6 GB cũng báo 4.
  - iPhone, iPad: coi là iOS cả khi `navigator.platform === 'MacIntel'` và `navigator.maxTouchPoints > 1` (Safari iPad báo UA của Mac). GPU chỉ báo "Apple GPU", nên chia theo màn: 375 × 667 CSS px là iOS-sàn, còn lại iOS-chuẩn.
  - Benchmark lần đầu: điện thoại 15 s, PC 20 s, cảnh 200 lính, chạy sau lần chạm đầu tiên. Điện thoại: p95 khung > 40 ms thì hạ 1 hạng, không thấp hơn T1. PC: chọn mức cao nhất có p95 ≤ 15 ms. Máy lạ: p95 ≤ 33 ms → T2; ≤ 40 ms → T1; còn lại T1 với Tùy chỉnh 50.
  - Khóa khung: nếu khoảng cách khung dồn quanh 33,3 ms trong khi CPU mỗi khung dưới 10 ms (iframe khác origin trước lần chạm đầu, iOS Low Power Mode), coi là đang bị khóa: không hạ hạng, đánh dấu "chạy lại sau". Kết quả lưu theo máy, chạy lại được trong Cài đặt.

### 13.2 Tùy chọn đồ họa khác

| Tùy chọn | Điện thoại | PC | Mặc định T2 / PC chuẩn |
|---|---|---|---|
| Tỉ lệ render | 50–100% của kích thước CSS × min(DPR, 2); iOS-sàn min(DPR, 1,5) | 50–200%; FSR 1 viết lại bằng shader là tùy chọn sau R1 | 75% / 100% |
| Giới hạn FPS | 30 / 40 (màn ≥ 120 Hz) / 60 (T3); iOS Low Power Mode khóa 30 | 30 / 60 / 120 / theo màn | 30 / 60 |
| Bóng | Tắt / Thấp (chỉ tướng); lính luôn có **blob shadow**: 1 `InstancedMesh` quad dưới chân cho mọi lính, 1 draw (v1.3: shader lính không tự vẽ được vệt tối lên mặt đất) | Thấp / Vừa / Cao (bóng lính gần) | Thấp / Vừa |
| Khoảng cách chuyển impostor | 60–80 m | 90–150 m | 60 m / 120 m |
| Hiệu ứng hạt | Thấp / Vừa | Thấp / Vừa / Cao | Thấp / Cao |
| Nước | Phẳng + normal map + depth-fade từ heightmap | + cubemap nướng theo trận; SSR sau R1, chỉ ở đường WebGPU | — / cubemap |
| Cỏ cây | Thấp / Vừa | Thấp → Cực | Thấp / Cao |
| Khử răng cưa | Tắt / FXAA / MSAA 2× / MSAA 4×; T1 và iOS-sàn chỉ Tắt hoặc FXAA | MSAA 4× / FXAA / SMAA; TAA sau R1, chỉ ở đường WebGPU | MSAA 2× / MSAA 4× |
| Hậu kỳ (bloom nửa độ phân giải, color grade) | Bật/Tắt | Bật + DoF cảnh kết trận | T1 Tắt, T2+ Bật / Bật |
| Tự hạ theo thời gian khung (§13.4) | Bật/Tắt | — | Bật |
| Tiết kiệm pin | Bật: render 60%, số lính −1 mức, hậu kỳ Tắt, UI cập nhật 10 Hz | — | Tắt |
| Rung / hit-stop / lắc camera | 0–100% | 0–100% | 100% |

Luật kỹ thuật (v1.3):
- Bỏ STP, DLSS, XeSS: trình duyệt không có các công nghệ này. Shader lính **bắt buộc có pass motion vector** (lấy mẫu khung trước từ texture animation) trước khi bật TAA, để đám đông không bị bóng ma; TAA để sau R1, chỉ ở đường WebGPU.
- Backend R1: **WebGL2 trên mọi nền tảng**, kể cả iPhone đã có WebGPU. WebGPU bật cho Electron và Chrome PC sau VS khi benchmark nhanh hơn ≥ 15%. Mọi iOS (Safari và app) giữ WebGL2 cho tới khi benchmark G1 chứng minh WebGPU vừa không chậm hơn vừa không tốn bộ nhớ hơn quá 10%.
- WebGPU v1 chỉ nhận sampleCount 1 hoặc 4, nên khi chạy WebGPU, MSAA 2× đổi thành 4× hoặc FXAA.
- Tối thiểu: Android 10 + Chrome có WebGL2; iOS/iPadOS 16.4+ (import map); Chrome, Edge, Samsung Internet hiện hành; Firefox 108+.

### 13.3 Ngân sách hiệu năng

| Hạng mục | T1 Yếu | T2 Tầm trung | T3 Flagship | PC chuẩn |
|---|---|---|---|---|
| Máy nghiệm thu | Helio G99 / SD 6 Gen 1, 4–6 GB | SD 7s Gen 2 / SD 7 Gen 1–3 / Dimensity 7200 / Exynos 1380–1480 | SD 8 Gen 2+ / Dimensity 9200+ | i5-10400 + GTX 1660 Super/RX 5600 XT, 16 GB, 1080p (Cực đại tham chiếu RTX 3070) |
| Mức mặc định | Thấp 100 · render 65% · 30 fps · bóng Tắt · hậu kỳ Tắt | Vừa 200 · render 75% · 30 fps | Cao 400 · render 85% · 30 fps | Cao 400 · 60 fps |
| Luồng chính | ≤ 20 ms | ≤ 18 ms | ≤ 18 ms (≤ 10 ms ở 60 fps) | ≤ 10 ms |
| — vùng chiến đấu (≤ 50 lính: AI, thẻ tấn công, trúng đòn; ≤ 2 ms mỗi bước 1/60 s) | ≤ 4 ms mỗi khung | ≤ 4 ms | ≤ 4 ms | ≤ 3 ms (≤ 5 ms Cực đại) |
| — nhận tin từ Worker (≤ 0,2 ms mỗi tick mô phỏng) và nội suy lính diễn | ≤ 1 ms | ≤ 1 ms | ≤ 1 ms | ≤ 0,5 ms |
| Worker sim, ngoài luồng chính (ước lượng) | ≤ 5 ms mỗi tick | như T1 | như T1 | như T1 |
| Worker crowd, ngoài luồng chính (ước lượng) | ≤ 6 ms mỗi lượt | như T1 | như T1 | như T1 |
| — animation tướng / UI / vật lý / âm thanh | 2 / 1,5 / 1 / 0,5 ms | như T1 | như T1 | — |
| Render thread | ≤ 12 ms | ≤ 10 ms | ≤ 10 ms | ≤ 8 ms |
| GPU | ≤ 22 ms (~65% khung, chừa cho nhiệt) | ≤ 22 ms | ≤ 22 ms | ≤ 14 ms |
| Draw call / đổi shader (gồm bóng + UI) | ≤ 100 / ≤ 60 | ≤ 150 / ≤ 80 | ≤ 200 / ≤ 100 | ≤ 1.200 ở mọi mức số lính |
| Tam giác toàn cảnh (gồm pass bóng) | ≤ 200 nghìn | ≤ 300 nghìn | ≤ 450 nghìn | ≤ 1,5 triệu |
| Hạt sống / overdraw TB | ≤ 500 / ≤ 2,5× | ≤ 800 / ≤ 2,5× | ≤ 1.200 / ≤ 2,5× | ≤ 5.000 |
| Tổng bộ nhớ tab (ước lượng, v1.3) | ≤ 700 MB | ≤ 900 MB | ≤ 1,2 GB | ≤ 2 GB |
| JS heap (ước lượng) | ≤ 150 MB | ≤ 150 MB | ≤ 150 MB | ≤ 400 MB |
| Texture trên GPU, gồm bộ đệm render (ước lượng) | ≤ 250 MB | ≤ 250 MB | ≤ 250 MB | ≤ 1 GB |
| Âm thanh đã giải mã (ước lượng) | ≤ 30 MB | ≤ 30 MB | ≤ 30 MB | ≤ 80 MB |
| Texture animation lính | ≤ 4 MB | ≤ 4 MB | ≤ 4 MB | ≤ 8 MB |
| VAT theo đỉnh (vật không xương: cờ, buồm, cọc gãy) | ≤ 16 MB | ≤ 16 MB | ≤ 16 MB | ≤ 32 MB |
| Ảnh chụp trận | < 256 KB | < 256 KB | < 256 KB | < 256 KB |

**Hai hạng iOS (v1.3)**. Căn cứ duy nhất có số đo: Lapcat, trên iOS 26.2, trang Safari chết ở khoảng 100 MB (iPhone SE 3) và 200 MB (iPad 8), đo bằng cấp phát chuỗi JS. Mọi số dưới đây là ước lượng; trần chính thức lấy bằng 60–70% điểm chết đo ở **thang bộ nhớ ngày 1–5** của prototype (JS heap, texture WebGL, ảnh DOM, tách riêng; SE 3 và iPhone 12; Safari và app Capacitor).

| Hạng mục | iOS-sàn | iOS-chuẩn |
|---|---|---|
| Máy nghiệm thu | iPhone SE 3 (A15, 4 GB) | iPhone 12 (A14, 4 GB) trở lên |
| Mức mặc định | Thấp 100 · render 65% · 30 fps · không MSAA | Vừa 200 sau benchmark, chưa đạt thì Thấp 100 · render 75% · 30 fps |
| Luồng chính / GPU | ≤ 18 / ≤ 22 ms | ≤ 18 / ≤ 22 ms |
| Draw call / tam giác toàn cảnh | ≤ 100 / ≤ 200 nghìn | ≤ 150 / ≤ 300 nghìn |
| Hạt sống / overdraw TB | ≤ 500 / ≤ 2,5× | ≤ 800 / ≤ 2,5× |
| Tổng bộ nhớ tab | ≤ 150 MB | ≤ 300 MB |
| JS heap | ≤ 40 MB | ≤ 60 MB |
| Texture trên GPU (trong đó bộ đệm render) | ≤ 60 MB (≤ 20 MB) | ≤ 120 MB (≤ 30 MB) |
| Âm thanh đã giải mã | ≤ 10 MB | ≤ 20 MB |
| Texture xương lính / VAT vật không xương | ≤ 4 / ≤ 16 MB | ≤ 4 / ≤ 16 MB |

Vì sao tính bộ đệm render: iPhone 12 có ~2,96 Mpx thật; render 75% ở DPR 3 còn ~1,67 Mpx, MSAA 4× cho màu RGBA8 + depth24s8 tốn ~53 MB, cộng target hậu kỳ HalfFloat ~13 MB (ước lượng tính tay). Vì vậy gốc tỉ lệ render là kích thước CSS × min(DPR, 2). Comic trên web-iOS giữ tối đa 3 ảnh đã giải nén, giải phóng khi lật.

**Tải và gói asset (v1.3)**: tải lần đầu ≤ 20 MB, tới menu và comic mở Chương đầu của bản đang dựng (VS: B15; R1: Quyển VI + B12). Gói mỗi Chương (map, lính, comic) ≤ 80 MB (PC ≤ 200 MB, có texture HD). Comic mỗi Chương ≤ 3 MB (AVIF, cạnh dài ≤ 1552 px, ảnh không chứa chữ). Lần đầu tới lúc chạm được ≤ 10 s trên 4G (ước lượng), lần sau ≤ 3 s, PC ≤ 5 s.

Texture 3D giao dạng **KTX2 (Basis Universal)**: UASTC cho tướng và normal map, ETC1S cho địa hình và UI; KTX2Loader chuyển mã sang ASTC, ETC hoặc BC theo GPU lúc chạy. **Texture bảng màu lính** (§13.6) để PNG không nén, lọc point, không mip để màu không lem. Mesh glTF nén `EXT_meshopt_compression` (gltfpack), không dùng Draco. Nhạc/thoại stream qua phần tử audio. Mỗi Chương là một gói nạp qua kho asset chung `loadChapter(id)`: web, PWA, TWA dùng Service Worker + Cache Storage; Electron đọc file trong thư mục cài; app iOS đóng sẵn Chương trong gói app, vì Service Worker không chạy trên scheme `capacitor://`. Giải phóng hết khi rời trận.

**Ngân sách tam giác theo loại (low poly, L1)**

| Loại | Điện thoại | PC | Ghi chú |
|---|---|---|---|
| Lính LOD0 | ≤ 600 | ≤ 1.000 | < 15 m (PC < 25 m), điện thoại tối đa 40 con |
| Lính LOD1 | ≤ 250 | ≤ 400 | 15–30 m (PC 25–70 m) |
| Lính LOD2 | ≤ 100 | ≤ 150 | 30–60 m (PC 70–120 m), dùng chung texture xương |
| Impostor "hàng quân nền" | 2 tam giác/lính | như điện thoại | > 60 m (PC > 120 m): 1 tư thế đứng/đi, 4 hướng, atlas ≤ 4 MB, vẽ trong pass opaque bằng alpha-clip |
| Tướng người chơi | ≤ 10 nghìn | ≤ 15 nghìn | Texture vẽ tay 1.024² (PC 2.048²); vải/cờ/dải lụa chuyển động phụ |
| Tướng khác (ta, địch) | ≤ 6 nghìn | ≤ 10 nghìn | Texture vẽ tay 512² (PC 1.024²) |
| Boss, voi, kỳ hạm, cổng thành | ≤ 8 nghìn | ≤ 15 nghìn | Chi tiết hơn tướng thường để đọc được vai trò từ xa |
| Thuyền thường | LOD0 ≤ 3 nghìn · LOD1 ≤ 800 | như điện thoại | §13.1 |

**Kiểm tra tam giác toàn cảnh** (trường hợp xấu: màn sông, mức mặc định của từng hạng):

| Thành phần | T1 · Thấp 100 | T2 · Vừa 200 | T3 · Cao 400 | PC · Cực đại 1.500 |
|---|---|---|---|---|
| Lính | ~40 nghìn | ~50 nghìn | ~80 nghìn | ~330 nghìn |
| 6 tướng | 40 nghìn | 40 nghìn | 40 nghìn | 65 nghìn |
| Boss + voi + kỳ hạm | ~16 nghìn | ~16 nghìn | ~24 nghìn | ~45 nghìn |
| Thuyền (24 / 40 / 60 / 60) | ~46 nghìn | ~58 nghìn | ~74 nghìn | ~120 nghìn |
| Địa hình + đạo cụ faceted | ~50 nghìn | ~60 nghìn | ~80 nghìn | ~300 nghìn |
| Pass bóng (T1 tắt; điện thoại chỉ tướng + boss; PC Cao có lính gần) | 0 | ~50 nghìn | ~60 nghìn | ~450 nghìn |
| **Tổng / trần** | **~190 / 200 nghìn** | **~275 / 300 nghìn** | **~360 / 450 nghìn** | **~1,3 / 1,5 triệu** |

Lý do hạ trần (v1.0: 250 nghìn / 400 nghìn / 700 nghìn / 3 triệu): low poly giảm tải đỉnh, nhưng trần phải bám nhu cầu thật để không ai tiêu phần dư vào chi tiết thừa. Nút thắt trên điện thoại vẫn là **CPU** (AI, animation, trúng đòn) và **fill-rate** (hạt trong suốt, bóng), nên các trần luồng chính, hạt và overdraw ở bảng trên **giữ nguyên**, không nới theo mức giảm tam giác.

**Đường render đám đông** (quyết định #7: GPU instancing + animation nướng vào texture):
- Lính vẽ bằng `InstancedBufferGeometry` của three.js với bộ đệm instance tự đóng gói **32 B mỗi lính**: vec4 float32 (x, y, z, hướng) + 8 giá trị half (clip A, thời điểm A, clip B, thời điểm B, trọng số crossfade, bảng màu, hàng, dự phòng); ma trận dựng trong vertex shader. `InstancedMesh` chuẩn tốn 64 B chỉ riêng ma trận nên không dùng cho lính. Mỗi lô = (lưới × LOD × pass), cấp phát dung lượng cố định, mỗi khung chỉ đổi `instanceCount`; 1.450 lính × 32 B ≈ 46 KB mỗi lần tải lên. "8 lưới" là số lưới lính có mặt cùng lúc trong một trận, tính cả hai phe.
- **Số draw call của lính không phụ thuộc số lính**: điện thoại 1 pass → 8 × 3 + 3 impostor + 1 blob = **28 draw**; PC thêm pass bóng lính gần → ≤ 8 × 3 × 2 + 3 + 1 = **52 draw**, trong trần 1.200. (v1.3 sửa mâu thuẫn cũ: trần 48 ghi 2 pass trong khi điện thoại chỉ cần 1.) Chia trần 100 draw của T1 (đề xuất): lính, impostor, blob 28; tướng, boss, voi 20; thuyền 6; địa hình và đạo cụ 18; nước 2; VFX 10; UI 12; dự phòng 4.
- Animation lính dùng **texture animation theo xương** (L2: ma trận xương nướng sẵn, skinning trong vertex shader, 2 xương/đỉnh ở T1–T2). Layout theo đúng rig encoding của three-vat (v1.3): mỗi xương là một slot 2 texel RGBA32F (xoay, dịch, scale đều), mỗi khung nướng một hàng; bộ binh 24 xương × 600 khung = 0,46 MB, kỵ 48 xương 0,92 MB, voi 32 xương 0,61 MB, tổng **~2,0 MB**, dùng chung cho mọi lưới/phe/LOD cùng bộ xương. Trạng thái phát của từng lính (clip, thời điểm bắt đầu, tốc độ, crossfade) nằm trong playback texture, chỉ ghi khi đổi clip. Nướng một lần bằng CLI trong Node, không nướng lúc chạy. Nội suy giữa khung là P1, chỉ làm khi 30 khung/s nướng bị giật. Đây chính là dạng "animation nướng vào texture + GPU instancing" của quyết định #7. **VAT theo đỉnh chỉ dùng cho vật không xương** (cờ, buồm, cọc gãy), vì VAT theo đỉnh cho 8 lưới × ~730 đỉnh × 600 khung cần khoảng 35–56 MB tùy cách mã hóa (ước lượng, v1.3; v1.2 ghi ~110–150 MB), gấp 17–28 lần texture xương. Lưới low poly không đổi lựa chọn này: số khung và số xương mới là thứ quyết định kích thước texture xương, không phải số đỉnh.
- Mỗi phe dùng **một texture bảng màu chung** cho mọi lưới lính (§13.6); biến thể màu từng lính là offset hàng bảng màu theo instance, không thêm vật liệu, nên không tăng draw call.
- **3 bộ xương, tổng 34 clip**:
  - Bộ binh 20 clip: đứng, đi, chạy, 3 đòn, đỡ, trúng đòn, ngã, dậy, hò reo, bỏ chạy + bắn cung (ngắm/bắn/nạp gộp 1 chuỗi), nỏ bắn, giơ khiên đi, đâm giáo, chèo thuyền, đứng thuyền chao, rơi nước, trèo mạn.
  - Kỵ 8 clip (người + ngựa nướng chung): đứng, đi, phi, chém trái, chém phải, xung phong, trúng, ngã ngựa.
  - Voi 6 clip (P1, R1: cần cho H39 Dã Tượng và tượng binh, dùng chung rig với WC16).
  - VS chỉ cần bộ binh 20 clip + kỵ 8 clip. Mọi phe dùng chung, khác nhau ở lưới/texture bảng màu.
- **AI lính theo LOD**: < 20 m điều hướng đầy đủ + thẻ tấn công; 20–60 m đi theo đội hình/flow field của đội; > 60 m chỉ cập nhật vị trí theo tuyến mô phỏng (4 Hz). Lý do: CPU di động là nút cổ chai thật; low poly không đổi điều này nên vẫn cần dữ liệu theo cột (typed array) chạy trong Web Worker cho đám đông. Vùng chiến đấu (≤ 50 lính) chạy trên luồng chính để đòn của tướng trúng trong cùng khung với input; lính diễn chạy trong Worker crowd và chịu được trễ 1 khung.

**Hiện thực web (L14 đã chốt three.js, v1.3)**: luật và ngân sách ở trên giữ nguyên; phần hiện thực như sau.

| Nhu cầu | Hiện thực |
|---|---|
| Vẽ đám đông, draw call không theo số lính | `InstancedBufferGeometry` 32 B mỗi lính, lô (lưới × LOD × pass) cấp phát cố định |
| Texture animation theo xương | GLSL qua `ShaderMaterial` hoặc `onBeforeCompile`, theo nhánh GLSL của three-vat; TSL chỉ khi bật WebGPU sau VS |
| Đám đông, mô phỏng trên luồng phụ | Worker sim (1 Hz, theo seed) + Worker crowd (4–30 Hz theo khoảng cách); `postMessage` với ArrayBuffer chuyển quyền, hai bộ đệm luân phiên. Không dùng `SharedArrayBuffer` ở R1, kể cả Electron, nên không cần COOP/COEP. WASM SIMD chỉ khi profiler chứng minh cần |
| Import trong Worker | Import map không áp cho Worker: mã trong `worker/` chỉ import đường dẫn tương đối, không import three; toán vector tự viết trên typed array; CI quét bare specifier |
| Tự hạ theo nhiệt | Trình duyệt không có API nhiệt: theo p95 thời gian khung (§13.4) |
| Nạp theo Chương, nén texture | glTF + meshopt + KTX2 (Basis Universal); kho asset `loadChapter(id)` |
| Mất tiêu điểm (§12.3) | `visibilitychange` / `pagehide` + cờ `sessionStorage`; app Capacitor thêm `appStateChange` |
| Mất context | Bắt `webglcontextlost`, dựng lại cảnh từ ảnh chụp trận |
| Biên dịch shader | `renderer.compileAsync(scene, camera)` trong lúc comic mở Chương đang chạy |
| Rủi ro riêng | Bộ nhớ tab iOS (§13.3); WebGLRenderer bị three.js bỏ dần (vendor cố định r186, dự phòng Babylon.js 9 cho riêng tầng render); WebGPU trong WKWebView chưa xác nhận |

### 13.4 Nhiệt, pin & nghiệm thu dài hạn

- **Tự hạ theo thời gian khung** (v1.3; trình duyệt không có API nhiệt): hạ 1 bậc khi p95 khung > 40 ms (mục tiêu 30 fps) hoặc > 20 ms (60 fps) suốt 10 s; nâng lại sau 60 s dưới ngưỡng. Sau 10 phút chơi đầu, nếu thang đã tới bậc 3 thì hạ mức mặc định 1 bậc và báo một dòng trong Cài đặt; HUD hiện cảnh báo P5 khi thang lên bậc 3. Thang hạ theo thứ tự: render −10%/bậc tới 60% → hạt Thấp → bóng Tắt → số lính hiển thị −1 mức → khóa 30 fps nếu đang 60. **Không bao giờ đổi mô phỏng hay vùng chiến đấu.**
- **Soak test** (điều kiện nghiệm thu cho mỗi hạng): chạy B20 Trận chuẩn 30 phút ở 25 °C; từ phút 20 FPS trung vị ≥ 29 và p95 khung ≤ 45 ms; nhiệt vỏ ≤ 43 °C; pin ≤ 15%/30 phút (T2). Đo bộ nhớ ở phút 25 của B20 bằng Safari Web Inspector (iOS), Chrome DevTools qua gỡ lỗi từ xa (Android) và Xcode Instruments (app Capacitor). Web-iOS thêm: không crash tab và không mất context trong 30 phút; giết tab ở phút 20 rồi kiểm trận được khôi phục.

### 13.5 Phạm vi prototype 90 ngày

Sprint 2 tuần; sprint 1–2 = ngày 1–28.

| Giai đoạn | Nội dung | Mốc ĐI/DỪNG |
|---|---|---|
| **Sprint 1–2 (ngày 1–28): bài test art low poly** (song song với đám đông) | Cảnh **bến Hàm Tử** (một góc bến + mặt sông + bờ lau, địa hình faceted, bầu trời sơn mài); **1 tướng** (H35 Trần Quốc Toản, WC03, 1 bộ N1–N3 + chạy); **3 loại lính** (giáo binh Đại Việt, khiên binh và cung kỵ Nguyên), mỗi phe 1 texture bảng màu; **400 lính** trên màn. Làm **2 kiểu shading** trên cùng lưới: (A) **mặc định theo L1** — nhân vật bóng mịn + toon ramp + viền sáng vàng kim, địa hình faceted; (B) **đối chứng** — toàn bộ faceted/flat, không viền | Chọn kiểu theo tiêu chí §13.6; kiểu được chọn phải đạt ≥ 30 fps, p95 ≤ 40 ms ở 400 lính trên **SD 7s Gen 2 (Chrome)**; 200 lính ≥ 30 fps kèm soak 15 phút không crash tab trên **iPhone 12** (Safari và app Capacitor); 100 lính trên **iPhone SE 3**; 400 lính trên iPhone 12 chỉ để đo, không phải điều kiện đạt; nếu cả hai trượt → giữ kiểu rẻ hơn và hạ LOD0 lính trước khi đi tiếp |
| Ngày 1–30 (rủi ro kỹ thuật) | Thang bộ nhớ ngày 1–5 (SE 3, iPhone 12); A/B WebGLRenderer với WebGPURenderer({ forceWebGL: true }) chốt trước ngày 14; đám đông texture ma trận xương + `InstancedBufferGeometry`, Worker sim + Worker crowd, flow field, thẻ tấn công, vùng chiến đấu cố định | 200 lính ≥ 30 fps (p95 ≤ 40 ms) liên tục 15 phút trên iPhone 12 và SD 7s Gen 2; 100 lính trên Helio G99 |
| Ngày 31–60 (vòng chiến đấu) | 1 lớp WC03 (Trần Quốc Toản): N1–N6, C1–C4, Né, Đỡ/phản, 1 kỹ năng, 1 Tuyệt Kỹ; 4 bậc địch (lính, tinh nhuệ, đội trưởng, tướng); bố cục cảm ứng + gamepad | Playtest nội bộ: đạt DPS chuẩn ±10%; phản đòn khả thi trên cảm ứng 30 fps |
| Ngày 61–90 (trụ cột "Quân ta") | Map xám 2 mặt trận × 3 Cứ Điểm (đồn, doanh trại, cổng); mô phỏng 1 Hz + Sĩ Khí + Hào Khí + Tổng Phản Công; vòng 4 lệnh; 2 sự kiện động (tướng bị vây, Cứ Điểm bị phản công); cài đặt số lính/render/FPS | Kiểm thử "cùng seed cho cùng kết quả" ở Tùy chỉnh 50, Thấp và Cực đại, ở 30 và 60 fps, trên Chromium, WebKit, Gecko (§5.3); người chơi thử nói được "mình đã xoay chuyển mặt trận" |
| **Ngoài prototype** (thuộc mốc VS, tháng 4–9) | Ngựa, thuyền/nước/lặn, Kế Sách, 2 lớp P0 còn lại, progression/rèn/tiền tệ, độ khó ngoài Thường | — |

Engine đã chốt (L14, 29/09/2026): three.js. Trượt mốc chỉ tính trên máy và mức mà §13.1 cho phép, kể cả hai hạng iOS. Nếu mốc ngày 28 trượt vì renderer, tầng render chuyển sang Babylon.js 9 bằng một file vendor đóng gói sẵn một lần; hai Worker và vùng chiến đấu giữ nguyên vì chúng không gọi API đồ họa.

### 13.6 Định hướng mỹ thuật low poly (L1)

**Một câu**: *low poly có phân cấp, phối màu sơn mài.* Hình khối gọn để nhẹ máy và đọc rõ giữa đám đông; chiều sâu thẩm mỹ đến từ bảng màu, ánh sáng và hoa văn chứ không từ số đa giác.

| Tầng | Mức chi tiết | Shading | Texture | Chuyển động phụ |
|---|---|---|---|---|
| Lính | Rất low poly (LOD0 ≤ 600 / ≤ 1.000; LOD1 ≤ 250 / ≤ 400; LOD2 ≤ 100 / ≤ 150; xa hơn impostor) | Bóng mịn + toon ramp như tướng nhưng không viền (kiểu A); chuyển sang faceted (kiểu B) chỉ khi bài test chọn B | **1 texture bảng màu dùng chung mỗi phe**, UV đặt vào ô màu; biến thể màu theo instance | Không (chỉ texture animation theo xương) |
| Tướng | Low–mid poly (tướng người chơi ≤ 10 nghìn / ≤ 15 nghìn; tướng khác ≤ 6 nghìn / ≤ 10 nghìn) | Bóng mịn + toon ramp + **viền sáng vàng kim** | Vẽ tay | **Vải, cờ, dải lụa** chuyển động phụ (xương phụ hoặc VAT) để tướng nổi bật giữa đám lính |
| Boss, voi, thuyền lớn, cổng thành | Chi tiết hơn tướng thường (≤ 8 nghìn / ≤ 15 nghìn; thuyền thường ≤ 3 nghìn) | Như tướng | Vẽ tay, dùng lại hoa văn | Cờ, buồm (VAT theo đỉnh) |
| Địa hình, đá, nước | Faceted | Phẳng theo mặt; nước faceted + depth-fade | Bảng màu + decal hoa văn | Nước, lau sậy (shader) |

- **Bảng màu**: son đỏ, vàng kim, đen, nâu làm chủ đạo (màu sơn mài); phe ta và phe địch phân biệt bằng sắc độ + hình dáng (mũ, cờ, khiên) chứ không chỉ bằng màu, khớp quy ước minimap xanh/đỏ/vàng và chế độ mù màu (§1).
- **Hoa văn Đông Sơn** (trống đồng: vòng tròn đồng tâm, chim Lạc, răng cưa) dùng cho UI, khung HUD, decal trên khiên/cờ/thuyền.
- **Bầu trời** vẽ như tranh sơn mài (skybox vẽ tay, lớp vàng kim và đen), không dùng skybox chụp ảnh.
- **Hội thoại trong trận**: chân dung 2D vẽ tay. **Cảnh cốt truyện**: comic sơn mài (biến thể Đông Hồ cho cảnh Tương truyền), khung tĩnh + chuyển động nhẹ, lời dẫn có thể lồng tiếng (§12.6); thay hẳn tranh sơn mài chuyển động 2.5D. **Không làm animation khuôn mặt** 3D. Cinematic 3D riêng chỉ cho Tuyệt Kỹ, theo trần §4.5.
- **Tham khảo cách làm**: Bad North (đám đông đơn giản đọc rõ), Absolver (hình khối gọn, vải chuyển động), Sable (màu phẳng, viền). **Tránh** tông ngộ nghĩnh kiểu Totally Accurate Battle Simulator: tỉ lệ cơ thể người thật (khoảng 1 : 7), không đầu to, không vật lý ragdoll hài hước — hợp nguyên tắc tôn trọng đối thủ và không gore.
- **Giới hạn hiệu năng không đổi theo low poly**: nút thắt trên điện thoại là CPU (AI, animation, trúng đòn) và fill-rate (hạt trong suốt, bóng). Vì vậy: vẫn dùng dữ liệu theo cột (typed array) chạy trong Web Worker cho đám đông; **bóng giả dạng vệt tròn** cho lính; VFX ưu tiên lưới opaque/alpha-clip, hạt trong suốt giữ trong trần hạt và overdraw ở §13.3.

**Tiêu chí chọn kiểu shading ở bài test art sprint 1–2** (§13.5), chấm trên máy T2, cảnh 400 lính:

| Tiêu chí | Cách đo | Ngưỡng đạt |
|---|---|---|
| Hiệu năng | FPS trung vị / p95 khung, 15 phút | ≥ 30 fps, p95 ≤ 40 ms |
| Nhận ra tướng | Ảnh chụp màn hình, 10 người xem 0,5 s, chỉ vị trí tướng người chơi | ≥ 8/10 đúng |
| Phân biệt phe | Cùng ảnh, chỉ ra hai phe ở vùng giáp trận, cả chế độ mù màu | ≥ 8/10 đúng |
| Đọc được trên màn nhỏ | Xem trên điện thoại 6 inch ở render 75% | Không lẫn lính với nền; viền/tương phản đủ ở cả cảnh sông |
| Cảm giác "sơn mài", nghiêm trang | Khảo sát 1–5 với nhóm thử (không có câu hỏi dẫn dắt) | Trung bình ≥ 3,5; không quá 2/10 người mô tả là "ngộ nghĩnh" hay "đồ chơi" |
| Chi phí sản xuất | Giờ công cho 1 lính + 1 tướng mỗi kiểu | Kiểu được chọn không đắt hơn kiểu kia quá 25% |

Kiểu A giữ làm hướng chính trừ khi trượt ngưỡng hiệu năng hoặc thua kiểu B ở ≥ 2 tiêu chí đọc hình. Kết quả chốt vào tài liệu này (v1.x) trước ngày 31.

---

**Hằng số tham chiếu nhanh** (dùng cho code prototype):

```
LEVEL_MAX = 50 ; LEVEL_CAP = {R1:35, U1:40, U2:45, U3:50, U4:50}
g(L) = 1 + 0.1*(L-1) ; E(R) = 1 + 0.015*(R-1) ; S(R) = g(R)*E(R)
COMBAT_TICK_HZ = 60 ; INPUT_BUFFER = 0.15
KHI_LUC_PER_BAR = 100 ; BARS = {1:2, 12:3, 25:4} ; KL_HIT = 0.2 (max 3 target) ; KL_KO = 0.25 ; KL_PARRY = {officer:10, grunt:2}
HAO_KHI_START = 0 ; HAO_KHI_MILESTONES = [25,50,75,100] ; HK_DECAY_IDLE = 45 ; HK_OVERFLOW_MAX = 30 ; HK_OVERFLOW_HOLD = 90
RALLY_DURATION = 25 ; RALLY_VARIANT_RANGE = [20, 30] ; RALLY_EXT_MAX = 10 (mọi nguồn cộng dồn) ; RALLY_RESET_TO = 25 ; RALLY_LINE_ALL = 0.05 ; RALLY_LINE_PLAYER = 0.15 ; M_TPC = 1.4 ; RALLY_HOLD = {PC:0.3, pad:0.5, touch:0.5} ; RALLY_ARM_DELAY = 1.0
YEM_HO = {push_m:30, line_player:0.05, pursuer_SK:-30, pursuit_pause:30, retreat_speed:1.5, capture:false}
KE_SACH_HK = {nho:10, lon:20} (trần gồm thưởng lẻ) ; KE_SACH_CD = none ; ULT_HAO_KHI = 0
ULT_CINE = {template:[2,3], camera_presets:4, bespoke_max_s:6, bespoke_cap:{R1:3, U:2}} ; MAPWIDE_ULT_PER_ERA = 2
STAT_TOTAL = [15, 19] ; SI_KHI_UNIT = điểm 0..100 (không %)
R1_WEAPON_CLASSES = 8 ; VS_CLASSES = [WC01, WC03, WC14] ; R1_ENEMY_CLASSES = [EWC01, EWC02, EWC04]
SI_KHI_START = 50 ; SIM_TICK = 1.0 ; SIM_LOSS_K = 0.0005 ; SIM_REGEN = 0.0002 ; SIM_LINE_V = 0.006
ENEMY_WAVE = 150 ; ENEMY_WAVE_CD = 180 ; ENEMY_WAVE_MAX_PER_SITE = 4 ; FRONT_RATIO_START = [0.8, 1.5]
PLAYER_Q_CAP = 1.5 (Q/s, trượt 10 s) ; PLAYER_Q_PER_SWING = 3 ; ULT_Q = 20 ; RALLY_ULT_Q = 0.10 (trần 300)
COMBAT_ZONE_R = 25 ; COMBAT_ZONE_ENEMY = 30 ; COMBAT_ZONE_ALLY_MAX = 20
DPS_MELEE = 1.6 ; DPS_RANGED = 1.3 ; CROWD_DPS = {melee:8, ranged:6}
POISE_PER_MV = 20 ; BREAK_STUN = 4.0
CRIT_BASE = 0.05 ; CRIT_CAP = 0.30 ; CRIT_MULT = 1.5
DODGE_IFRAME = 0.25 ; PARRY_WINDOW_NORMAL = 0.15 ; PARRY_TOUCH_BONUS = 0.05 ; PARRY_TOUCH_MIN = 0.10 ; PARRY_REPRESS_LOCK = 0.5 ; PARRY_MISS_LOCK = 0.4 ; TELEGRAPH_TOUCH_MIN = 0.45
HORSE_SPEED = 11 ; HORSE_CHARGE = 14
GATE_HP = 4000*S(R) (ta 6000*S(R)) ; SIEGE_HP = 3000*S(R) ; SIEGE_DPS = {ta:200*S(R), dich:100*S(R)} ; HERO_VS_GATE = Cong*MV/3
ORDER_CD_FLOOR = 0.5
TROOP_CAP = {Thap:100, Vua:200, Cao:400, RatCao:800, CucDai:1500, Custom:{PC:[50,2500], T1:[50,200], T2:[50,400], T3:[50,800]}}
TROOP_RATIO = {Thap:0.20, Vua:0.35, Cao:0.60, RatCao:1.00, CucDai:1.00, Custom:nội suy} ; TROOP_MIN_PER_WING = 6 ; ZONE_BUDGET = 50
SHIP_DISPLAY = {Thap:24, Vua:40, CaoTroLen:60}
TRIS_SOLDIER = {LOD0:{mobile:600, PC:1000}, LOD1:{mobile:250, PC:400}, LOD2:{mobile:100, PC:150}}
TRIS_HERO = {player:{mobile:10000, PC:15000}, other:{mobile:6000, PC:10000}} ; TRIS_BIG = {mobile:8000, PC:15000} ; TRIS_SHIP_LOD0 = 3000
TRIS_SCENE = {T1:200000, T2:300000, T3:450000, PC:1500000}
```

---

## Nhật ký quyết định

### v1.2 → v1.3 (L14 chốt engine web, 29/09/2026)

| # | Quyết định | Mục đã sửa | Thay đổi |
|---|---|---|---|
| W1 | L14: three.js r186, JavaScript ES module không build step; WebGLRenderer (WebGL2) cho R1 trên mọi nền tảng, WebGPURenderer thử nghiệm cho PC sau VS; Steam qua Electron, iOS qua Capacitor, Android qua TWA | Đầu file, §13.2, §13.3 | Bỏ bảng hai cột Unity/web, thay bằng bảng "Hiện thực web" một cột; tối thiểu Android 10 + Chrome WebGL2, iOS 16.4+, Firefox 108+ |
| W2 | Đường render đám đông | §13.2, §13.3 | `InstancedBufferGeometry` 32 B mỗi lính thay BRG/indirect; blob shadow là 1 draw riêng; điện thoại 28 draw, PC 52 draw; sửa mâu thuẫn trần 48 (ghi 2 pass trong khi điện thoại chỉ cần 1) |
| W3 | Animation texture theo rig encoding của three-vat | §13.3 | 2 texel RGBA32F mỗi xương, playback texture; tổng ~2,0 MB (v1.2: ~350 KB mỗi bộ xương); VAT theo đỉnh ~35–56 MB (v1.2: ~110–150 MB); nướng một lần bằng CLI Node |
| W4 | Ngân sách web | §13.3 | Tổng bộ nhớ tab thay "bộ nhớ ứng dụng": Android T1/T2/T3 ≤ 700 MB / 900 MB / 1,2 GB, PC ≤ 2 GB; thêm JS heap, texture GPU, âm thanh giải mã, Worker sim ≤ 5 ms, Worker crowd ≤ 6 ms (ước lượng); tải đầu ≤ 20 MB, gói Chương ≤ 80 MB (PC ≤ 200 MB), comic ≤ 3 MB; KTX2 + meshopt thay ASTC + Addressables |
| W5 | Hai hạng iOS | §13.1, §13.3 | iOS-sàn (SE 3): tab ≤ 150 MB, Thấp 100 cũng là trần; iOS-chuẩn (iPhone 12+): tab ≤ 300 MB, Vừa 200 sau benchmark. Số iOS là ước lượng tới khi có thang bộ nhớ ngày 1–5 |
| W5a | **Ngoại lệ tạm** cho iPhone T3 trên web | §13.1 | Mặc định Vừa 200 thay Cao 400 cho tới khi benchmark iOS đạt, rồi trả về Cao 400. Lý do là trần bộ nhớ tab, không phải đổi số đã chốt ở §13.1 |
| W6 | Phát hiện hạng máy trong trình duyệt | §13.1 | Model Android qua `userAgentData` (UA rút gọn thành "K"); `deviceMemory` báo ≤ 2 → T1, báo 4 không đặt trần; iPad báo UA Mac; iOS chia theo kích thước màn; benchmark sau lần chạm đầu; nhận diện khóa khung 30 fps |
| W7 | Tự hạ theo thời gian khung thay API nhiệt | §13.2, §13.4 | Bỏ Adaptive Performance; p95 > 40 ms (30 fps) hoặc > 20 ms (60 fps) suốt 10 s thì hạ 1 bậc, nâng lại sau 60 s; thang hạ giữ nguyên |
| W8 | Tùy chọn đồ họa trên web | §13.2 | Bỏ STP, DLSS, XeSS; SSR và TAA sau R1, chỉ đường WebGPU; nước PC dùng cubemap nướng; MSAA 2× đổi thành 4× khi chạy WebGPU; iOS Low Power Mode khóa 30 fps |
| W9 | Mất tiêu điểm trên web | §12.3 | `visibilitychange`/`pagehide` + cờ `sessionStorage`; Worker đẩy ảnh chụp mỗi 10 tick, luồng chính ghi IndexedDB mỗi 15 s (v1.2: 30 s); có cờ "đã ẩn" thì không trừ điểm |
| W10 | Tính xác định giữa trình duyệt | §5.3 | Bao cả vùng chiến đấu; bước cố định 1/60 s; không hàm Math siêu việt; vector vàng trên Chromium, WebKit, Gecko ở 30 và 60 fps |
| W11 | Prototype | §13.5 | Mốc 400 lính trên SD 7s Gen 2, 200 trên iPhone 12, 100 trên SE 3; thang bộ nhớ ngày 1–5; A/B renderer trước ngày 14; dự phòng Babylon.js 9 cho tầng render |

### v1.1 → v1.2 (hướng comic + Quiz, 29/09/2026)

| # | Quyết định | Mục đã sửa | Thay đổi |
|---|---|---|---|
| C1 | Sử Ký = 9 Quyển, 30 Chương chính; Chronicle C01–C08 là Chương phụ | **§12.6 (mới)**, §12.5, bảng thuật ngữ | Trường `battle.chapter` {quyen, chuong, quyetSach}; thêm thuật ngữ Sử Ký, Sử quán, Quyết sách |
| C2 | Comic thay tranh sơn mài chuyển động 2.5D ở mọi cảnh cốt truyện | §4.5, §5.5, §8, §12, §13.2, §13.6 | Luồng Chương 9 bước; mở chương 6–10 khung / 60–90 s, kết chương 4–8 khung / 40–60 s, Quyển 10–14 khung; cảnh kết trận trong engine ≤ 10 s; nhịp truyện giữa trận = khung comic chèn (≤ 2 mỗi trận) |
| C3 | 3 suất cinematic 3D riêng R1 = Tuyệt Kỹ H31, H35, H38 | §4.5 | Bỏ đề xuất "mở B15" và "kết B20" (nay là comic); bespoke không chuyển sang tranh 2.5D |
| C4 | Cờ sáu chữ "Phá cường địch, báo hoàng ân" là Chính sử | §4.5 | Sửa nhãn "Tương truyền" cũ cho khớp canon H35 (Toàn thư) |
| C5 | Quyết sách không đổi khung Hào Khí | §12.6 | Chọn đúng: dấu Kế đã định + tình báo sớm (lộ tuyến tiến); chọn khác: trận như cũ, comic kết chương giải thích, mở trước What if; miễn ở B12/B13 lần đầu, B15 VS, Chronicle |
| C6 | Quiz không thưởng sức mạnh | §12.6, §11.4 | ~400 câu, 3–5 câu mỗi lượt, 6 dạng, không phạt, lặp lại ngắt quãng 1–3 Chương, cố vấn duyệt 100%, đáp án xáo vị trí |
| C7 | Sửa chia hồi R1 | §12.5 | B18 Vạn Kiếp (1285) thuộc Hồi 2: Hồi 1 = B12–B13, Hồi 2 = B14–B18, Hồi 3 = B19–B20. Canon `battle.act` vốn đúng |
| C8 | Thuật ngữ | Bảng thuật ngữ, §11.4 | Sử Ký = chế độ chiến dịch (GDD 13.2); Sử quán = kho thẻ. 13 chỗ canon dùng "Sử Ký" nghĩa kho thẻ đã đổi thành "thẻ Sử quán" |

#### Việc canon đã làm theo v1.2
- Mọi cảnh cốt truyện "tranh động", "cutscene", "tranh vẽ tĩnh", "cinematic" (ngoài Tuyệt Kỹ) đổi thành comic mở/kết chương, comic kết Quyển hoặc khung comic chèn; B15 mở màn và B20 kết màn là comic. "codex" đổi thành Sử quán.
- 30 trận có `chapter`; `quyetSach.lichSu` là Kế Sách Lớn chính; 2 lựa chọn khác mang nhãn Hư cấu, chờ cố vấn sử duyệt cùng ~87–90 thẻ Quyết sách.
- tools/check.js kiểm thêm: không còn cách gọi cảnh cũ, không còn "Sử Ký" nghĩa kho thẻ, chapter đủ và đúng khóa, số chương liên tục, lichSu là Kế Sách Lớn có thật, Chương miễn đúng B12/B13/B15, nhãn cờ sáu chữ.
- Câu hỏi mở: GDD 22.2 tính 29 Chương có Quyết sách (87 thẻ) nhưng canon có quyetSach cho 30 trận (B12, B13 chỉ miễn lần đầu); cần chốt B12 có Quyết sách khi chơi lại không.

### v1.0 → v1.1 (quyết định L1–L14 của thiết kế chính sau vòng canon)

| # | Quyết định | Mục đã sửa | Thay đổi |
|---|---|---|---|
| L1 | Mỹ thuật "low poly có phân cấp, phối màu sơn mài" | §13.1, §13.3, **§13.6 (mới)**, §13.5 | Ngân sách tam giác mới theo tầng (lính LOD0 1.500 → 600 điện thoại, 4.000 → 1.000 PC; LOD1 500 → 250 / 1.200 → 400; LOD2 150–200 → 100 / 400 → 150; tướng người chơi 20 nghìn → 10 nghìn / 15 nghìn; tướng khác 8 nghìn → 6 nghìn / 10 nghìn; boss, voi, kỳ hạm, cổng ≤ 8 nghìn / ≤ 15 nghìn; thuyền LOD0 4 nghìn → 3 nghìn). Trần toàn cảnh 250 nghìn / 400 nghìn / 700 nghìn / 3 triệu → **200 nghìn / 300 nghìn / 450 nghìn / 1,5 triệu**, kèm bảng kiểm tra. Texture bảng màu dùng chung mỗi phe. Trần CPU, hạt, overdraw giữ nguyên |
| L2 | Lính: texture animation theo xương; VAT theo đỉnh chỉ cho vật không xương | §13.3 | Giữ và ghi rõ; thêm lý do low poly không đổi lựa chọn |
| L3 | R1 = 8 lớp; thứ tự P0–P4 mới | §4.4, §4.3, §13.3 | Trần R1 6 → **8**; bảng lớp → đợt cần đầu tiên → tướng; WC05 dời P1 → P3 (U2); WC02, WC12, WC16 lên P1 (R1); WC06, WC07, WC08, WC15 lên P2 (U1); WC11 xuống P3 (U2); WC10 xuống P4 (U4). Rig voi từ U2 lên R1. Tướng địch mang lớp WC chưa tới lượt dùng bản rút gọn ~12 clip |
| L4 | Hướng dẫn R1 ở B12 + B13; VS ở B15 | §12 | Sửa nhầm "B12 (Đông Bộ Đầu)": B12 = Bình Lệ Nguyên, B13 = Đông Bộ Đầu; bảng phân bổ theo bản build |
| L5 | Kế Sách +10 / +20, thưởng lẻ không vượt mức; không hồi chiêu; commandTrait chỉ tăng hiệu quả | §7, §6.1, §11.2 | Luật thưởng lẻ; bỏ nút cây "Kế Sách lớn +5 Hào Khí", thay bằng "hiệu ứng mô phỏng kéo dài +20%" |
| L6 | Tuyệt Kỹ không cộng Hào Khí; quy ước cinematic | **§4.5 (mới)**, §4.1, §6.1, §6.4 | Template 2–3 s, 4 mẫu camera; bespoke ≤ 6 s (R1 ≤ 3, mỗi đợt sau ≤ 2); ≤ 2 Tuyệt Kỹ toàn bản đồ mỗi thời đại |
| L7 | Tổng Phản Công chuẩn 25 s, biến thể 20–30 s, kéo dài tổng ≤ +10 s | §6.4 | Khung biến thể, định nghĩa Yểm Hộ, bảng Chuẩn / Yểm Hộ / Áp mạn / Hai vách núi |
| L8 | Sĩ Khí = điểm 0–100; tổng chỉ số 15–19 | §1, §5.1, §2.1 | Luật đơn vị; dải 15–17 → **15–19** |
| L9, L12 | Nhãn sử liệu; `defeatMeans` | Đầu file, §8, §12.2 | Bảng thuật ngữ, quy ước nhãn, bảng thể hiện 6 kết cục boss; điều kiện thắng theo `defeatMeans` |
| L10, L11 | Thánh Gióng là Huyền sử; C01–C06; tướng dự bị | §12.4 | Bảng C01–C06 dùng lại map sẵn có, nhãn theo nội dung |
| L13 | B15 có bản VS và bản R1 | §11.1, §12 | Trường `variant` trong dữ liệu trận |
| L14 | Engine chưa chốt (v1.3: đã chốt three.js, xem W1) | Đầu file, §13.3, §13.4, §13.5 | Trình bày Unity 6 LTS (khuyến nghị) và web (thay thế) song song |
| — | Phân bổ lính hiển thị theo tỉ lệ từ mô phỏng | §13.1 | `hienThi = max(6, min(trần mức, Q × tỉ lệ mức))`, tỉ lệ 0,20 / 0,35 / 0,60 / 1,00; khớp vùng chiến đấu 30 + 20; thuyền hiển thị 24 / 40 / 60 |
| — | Bảng thuật ngữ | Đầu file | 12 thuật ngữ, cấm "Musou"/"Dynasty Warriors" trong chữ người chơi thấy |

#### Việc canon cần sửa theo v1.1 (chuyển cho nhóm canon)
- Tổng chỉ số ngoài dải 15–19: **H18 Lý Thường Kiệt = 20** (hạ 1), **H38 Yết Kiêu = 14** (nâng 1).
- Thưởng Hào Khí vượt khung: B08 "hạ Hầu Nhân Bảo +40" (boss chủ soái kết thúc trận, không cộng Hào Khí, §6.1); B10 và B22 Kế Sách "+15" → gắn quy mô rồi dùng +10 / +20; mọi "+3 mỗi thuyền, +4 mỗi làng…" chuyển thành thưởng lẻ trong trần.
- Sĩ Khí ghi "%" (ví dụ H41 "+15% Sĩ Khí", H42 "−20% Sĩ Khí", B08 "−30% Sĩ Khí") → ghi bằng điểm.
- B15.specialMechanic: bản VS không còn là "khúc dạo đầu" của chiến dịch R1; thêm trường `variant`/`playableVS`.
- B12: Tổng Phản Công – Yểm Hộ chỉ bật khi chơi lại (sau B13); ghi `tpcVariant` cho B02, B04, B05, B12, B14, B19, B21, B23, B26.
- Tướng địch lớp WC ở U1 trước khi lớp tới lượt: X13 Mộc Thạnh, X28 Vương Thông (WC11) → bản rút gọn 12 clip (§4.3).
- Hiệu ứng kéo dài Tổng Phản Công (H10 +5 s, H51 +5 s, Kế Sách B10/B22 +10 s) cộng chung trần +10 s.
- Tuyệt Kỹ toàn bản đồ: E3 có H10; E8 có H41, H42 (đủ trần 2). Kiểm các thời đại khác khi viết Tuyệt Kỹ.

### v0.1 → v1.0

Nguồn: **[C]** = báo cáo combat, **[M]** = báo cáo mobile/tech, **[P]** = báo cáo tầm nhìn sản phẩm.

#### A. Đã chấp nhận (tóm tắt)
- Vi phạm quyết định #8 [C][M][P]: vùng chiến đấu r 25 m cố định 30 địch + ≤ 20 quân ta ở mọi mức; trừ Q theo lượt vung (≤ 3) với trần 1,5 Q/s; kiểm thử tự động cùng seed (§5.3, §13.1).
- Mô phỏng [C][P]: `SIM_LOSS_K` 0,0015 → 0,0005; tỉ lệ mở trận 0,8–1,5; công sự 0,6; thêm hồi quân, `m_luong`, tiếp viện địch; `mThu`/trận thế vào công thức; mặc định `m_KS`, `m_lenh`.
- Tướng AI [C]: SOS và Sinh lực ở xa tính trừu tượng theo tỉ lệ F.
- Sự kiện động [C]: tốc ngựa, khoảng cách mặt trận, giao việc cho quân, hạn mức SOS.
- Bậc địch [C]: HP phó tướng/tướng/đại tướng/chủ soái ×12/×35/×100/×150; E(R); bảng sát thương địch; ngân sách thời gian đấu tướng.
- Hào Khí [C][P]: khởi điểm 0, giảm các nguồn, ngân sách tham chiếu; TPC đẩy tuyến tức thì + `m_TPC` + chọn vị trí; reset về 25; Hào Khí dư; nguồn thụ động không reset suy giảm; thêm nguồn thiếu.
- Điều khiển [C][M][P]: bỏ LB+RB; TPC phải giữ và có độ trễ 1 s; Kế Sách có nút riêng, tâm radial = HỦY; bố cục cảm ứng 8 + 1; radial vị trí cố định; chế độ một tay viết lại; Tự combo sửa theo luật Cn; khóa mục tiêu cảm ứng; nón tự nhắm; ngắm tầm xa.
- Phản đòn [C][M]: chống bấm liên tục; Khí Lực theo bậc; trần Hào Khí từ phản đòn; chấm theo dấu thời gian input, tick 60 Hz; bù cảm ứng.
- Hit-stop [C][M]: tính theo ms; dừng đồng hồ đòn địch r 6 m; hiệu chỉnh DPS có hit-stop; quy tắc đa đòn.
- Cổng/máy công thành [C][P]: nhân S(R); tướng ~60 s, máy ta ~20 s, cổng ta bị công 60 s.
- Tiến độ [C][M][P]: trần cấp theo đợt; điểm kỹ năng R1 33–40 (tối đa 49); nút đỉnh cấp 20; kỹ năng lớp và vạch Khí Lực dời về dải R1; bỏ co giãn cấp địch; tướng bắt buộc nâng R − 2; Hậu doanh 50%; Truyền Kỳ mở sau chiến dịch.
- Kinh tế [C][P]: thu nhập ba tiền tệ; chi phí quân đoàn; Sử quán miễn phí; rèn không thất bại; Công trạng = Diem.
- DPS [C][P]: hai thước đo; tầm xa 1,3 MV/s; thang Tầm nén; Tầm không nhân tầm bắn; WC16 MV 1,2; WC03/WC15/WC13 cân bằng theo trung bình.
- Phá Thế [C][P]: MV sau hệ số lớp; sửa tham chiếu §4.3 → §4.4.
- Khí Lực [C][P]: giảm tốc nạp, giữ mục tiêu 1–2 Tuyệt Kỹ/pha.
- Cờ lệnh & sàn CD [C][P]; luật chiếm không reset khi trúng đòn [C]; thống nhất hồi Sinh lực và Sĩ Khí cổng [C][P].
- Bạch Đằng [C][P]: Nghi binh "đánh rồi rút"; Pha 3–4 không có trạng thái thua; thanh Thoát vây; Pha 6 đặt Hào Khí = 100; đường cho tướng không phải Trần Hưng Đạo.
- Hướng dẫn [C][P]: VS dựng sẵn; R1 hướng dẫn ở B12 (v1.1: tách B12 + B13).
- Thêm §5.8 Thuyền, §12.4 Chronicle, §12.5 Bản đồ chiến dịch, luật map nền + bố cục theo seed [P]; Tuyệt Kỹ Commander có quân ta; kỹ năng hiệu lệnh toàn quân; bảng vai trò → thang [P].
- Sản xuất [P][M]: VS 3 lớp P0; R1 tối đa 6 lớp (v1.1: nâng lên 8); lớp địch rút gọn ~12 clip; WC14 lặn không có camera dưới nước.
- Hiệu năng [M]: 3 hạng máy + ngân sách đầy đủ; bộ nhớ máy 4 GB; BRG/indirect (v1.3: `InstancedBufferGeometry`), draw call không theo số lính; LOD2 thay impostor gần; blob shadow; MSAA thay FXAA; motion vector; DLSS/XeSS sau R1 (v1.3: bỏ); ngân sách hạt; trần đơn vị ngoài ngân sách; phát hiện hạng máy + benchmark; tùy chọn truy cập; nhiệt/pin + soak test; ảnh chụp khi mất tiêu điểm chống lợi dụng; cảnh mở TPC ở mức Thấp; phạm vi prototype 90 ngày (đặt tại §13.5 để giữ đủ 13 phần).

#### B. Bác bỏ hoặc sửa khác đề xuất

| # | Issue | Nguồn | Quyết định | Lý do |
|---|---|---|---|---|
| 1 | Vùng lõi r 8 m luôn có 16 địch, cài đặt chỉ quyết định vành 8–25 m | [C] | **Thay** bằng vùng chiến đấu r 25 m cố định 30 địch [M] + trần trừ Q [P] | Một con số duy nhất dễ kiểm thử hơn. Nếu vành 8–25 m đổi theo cài đặt thì đòn tầm xa và C5 (dài 8 m) vẫn trúng số mục tiêu khác nhau, nên vẫn vi phạm #8. |
| 2 | `SIM_REGEN = 0.0008`, tiếp viện địch 200 quân/150 s | [C] | **Sửa**: 0,0002; 150 quân/180 s, tối đa 4 đợt/điểm | Với K = 0,0005, hồi 0,0008 × Q0 mỗi doanh trại (0,8 người/s ở Q0 = 1.000, 1,6 với 2 doanh trại) lớn hơn tổn thất nền 0,5 người/s, nên mặt trận không bao giờ hao. Tiếp viện không giới hạn đợt làm tướng người chơi vô nghĩa khi chưa chiếm được doanh trại. |
| 3 | Hồi quân = 0,5 người/s × số doanh trại | [P] | **Sửa** như mục 2 | Cùng lý do: vượt tổn thất nền sau khi hạ K. |
| 4 | Tuyệt Kỹ trừ 25 Q, Tuyệt Kỹ Hào Khí trừ 60 Q (issue 1) và Tuyệt Kỹ Commander trừ 15 Q (issue 6) | [P] | **Thống nhất**: Tuyệt Kỹ thường −20 Q; Tuyệt Kỹ Hào Khí −10% Q mặt trận (trần 300) | Hai issue của cùng báo cáo mâu thuẫn nhau; 60 Q quá nhỏ so với khoảnh khắc đỉnh của trụ cột (~5% một mặt trận 1.200). |
| 5 | Tướng lên cổng `Công × MV / 5` (~100 s), máy ta `150 × g(L)`/s | [P] | **Bác**, dùng số của [C]: `/3` (~60 s), máy ta 200 × S(R)/s (~20 s) | 100 s đứng chém cổng quá dài cho hack & slash; tỉ lệ 3 : 1 giữa tự phá và hộ tống máy vẫn đủ để hộ tống là cách tối ưu. |
| 6 | Giữ VAT ≤ 48 MB bằng cách nén clip kỵ/voi xuống 15 fps | [P] | **Bác**, dùng texture animation theo xương [M] | Tính toán của [M] cho thấy VAT theo đỉnh vượt ngân sách ngay cả với bộ binh (~110–150 MB cho 8 lưới × 2 LOD); nén khung không đủ bù. Texture xương vẫn nằm trong quyết định #7 (GPU instancing + animation nướng vào texture). |
| 7 | Truyền Kỳ: cấp địch = max(cấp tướng, R + 10) | [P] | **Bác**, dùng min(trần cấp của đợt, R + 15) [C] | Công thức max(cấp tướng, …) lại là co giãn theo người chơi, đúng lỗi [C] đã chỉ ra ở luật co giãn cũ: lên cấp không làm tướng mạnh hơn. |
| 8 | R1 chỉ 4 độ khó, Truyền Kỳ dời sang U1 | [P] | **Bác** | Truyền Kỳ là nội dung cuối game duy nhất của R1 [C]. Nó chỉ là bộ tham số trên các trận có sẵn, chi phí QA thấp. |
| 9 | Rèn +1 → +10 giữ 3%/mức, trần ×1,65 | [P] | **Sửa**: rèn +1 → +5, 6%/mức, không thất bại, trần ×1,8 | Giữ ý giảm tải của [P] (ít mức hơn, bỏ may rủi) nhưng vẫn giữ tổng +30% từ rèn để E(R) tới R = 50 (1,735) còn đạt được. |
| 10 | Nút đỉnh yêu cầu cấp 25 | [M][P] | **Sửa**: cấp 20 [C] | Tướng phụ nhận Hậu doanh 50% chỉ đạt ~cấp 20–22 ở B20; cấp 25 khiến nhiều tướng R1 không mở được đỉnh. |
| 11 | Tổng Phản Công = giữ D-pad phải | [C] | **Sửa**: giữ D-pad xuống [M][P] | D-pad phải dành cho Lệnh Kế Sách; D-pad trái (lặp lệnh) và lên (ngựa) đã dùng. |
| 12 | Một tay: "chạm đúp N = C" [C]; "giữ N 0,3 s = C" [P] | [C][P] | **Bác**, C là nút riêng [M] | "Giữ N" đã dùng cho tự tiến + tự combo; chạm đúp N xung đột với chạm liên tục khi đánh thường. |
| 13 | Tổng Phản Công là vòng bao quanh nút Tuyệt Kỹ | [P] | **Bác**, dùng ô ngữ cảnh [M] | Vùng chạm chồng lên Tuyệt Kỹ, dễ kích nhầm cả hai thứ. |
| 14 | Một tay: Tự combo chuyển sang "chạm liên tục" | [P] | **Bác** | Chạm liên tục ép người chơi một ngón bấm liên tục; mặc định giữ N = tự combo phù hợp hơn với mục tiêu trợ giúp. |
| 15 | Thân binh hiển thị ở Thấp 6, Theo ta 10; ở Vừa 10/15; ở Cao đủ số | [P] | **Sửa**: quân ta trong vùng chiến đấu ≤ 20 ở **mọi** mức | Số quân ta chiến đấu thay đổi theo cài đặt sẽ đổi số địch bị hạ quanh tướng, tức vi phạm quyết định #8. |
| 16 | Tùy chỉnh < 100: 30 địch + 15 quân ta | [M] | **Sửa**: 30 + tối đa 20, giống mọi mức | Cùng lý do mục 15. |
| 17 | Tùy chỉnh trên điện thoại 50–800 cho mọi máy | [P] | **Sửa**: theo hạng T1/T2/T3 [M] | Máy T1 ở 800 lính sẽ vỡ ngân sách nhiệt và bộ nhớ. |
| 18 | Khí Lực +15 mỗi lần hạ đội trưởng trở lên | [P] | **Sửa**: +5 / +10 / +20 theo bậc | Với ~15 đội trưởng mỗi trận, +15 thêm ~2 vạch/trận, đi ngược chính mục tiêu giảm nhịp nạp của [P]. |
| 19 | DPS tầm xa 1,35 MV/s | [P] | **Sửa**: 1,3 [C], kèm thước đo DPS đám đông | Chênh lệch nhỏ; chọn một con số và bổ sung thước đo đám đông mà [C] đề xuất. |
| 20 | Chronicle Quang Trung "giới hạn ở 1792" | [P] | **Sửa**: mốc giả định kết thúc trước 1800 | Giới hạn đúng năm 1792 xóa mất ý tưởng gốc "sống lâu hơn". Trước 1800 vẫn không chạm thế kỷ XIX (quyết định #4), và vẫn không có trận với quân Nguyễn Ánh (quyết định #6). |
| 21 | "Thư khố Chronicle" thay Doanh trại cấp 4 | [C] | **Bác** | Doanh trại rút còn 3 cấp [P]; Chronicle đặt ở Trướng soái (cấp 1) nên không cần công trình riêng. |
| 22 | Đặt phạm vi prototype thành mục 14 riêng | [M] | **Sửa**: đặt ở §13.5 | Yêu cầu giữ đủ 13 phần; nội dung giữ nguyên. |
| 23 | Bộ đệm input 10 khung | [C] | **Sửa**: 0,15 s [M] | Thời lượng tính bằng giây theo tick 60 Hz; 0,15 s ≈ 9 khung, tương đương. |
| 24 | WC04 "đâm xuyên tới 8 mục tiêu" (v0.1) | [C] | **Sửa thêm**: 5 mục tiêu | Không phải đề xuất trực tiếp; hệ quả của thước đo DPS đám đông [C] (8 mục tiêu vượt 8 MV·mục tiêu/s ±15%). |
