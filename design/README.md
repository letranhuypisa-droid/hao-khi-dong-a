# Canon thiết kế — Hào Khí Việt / Nam Quốc Sơn Hà

Dữ liệu gốc mà GDD (Claude Doc) và bản thử `hao-khi-viet/game/` dựa vào. Tài liệu đầy đủ:
https://claude.ai/code/artifact/595279b7-86be-4dc9-a6b7-1a8f39fbc8ce

| File | Nội dung |
| --- | --- |
| `canon.json` | Canon gộp: 9 thời đại, 56 tướng (H01–H56), 35 tướng địch (X01–X35), 30 trận (B01–B30), màn Chronicle, tướng dự bị, 180 nguồn đã mở, câu hỏi mở |
| `canon-G1.json` … `canon-G4.json` | Nguồn của `canon.json`, chia theo nhóm thời đại (G1: E1–E4, G2: E5 + E7, G3: E6 Nhà Trần, G4: E8 + E9) — sửa ở đây rồi gộp lại |
| `canon-summary.md` | Bảng tóm tắt tướng, trận, tướng địch, phân bổ lớp vũ khí, nguồn |
| `systems.md` | Luật hệ thống v1.3 (13 phần: chỉ số, input, moveset, Quân ta, Hào Khí, Kế Sách, bậc địch, progression, cấu trúc màn, cài đặt & ngân sách web) |

Mọi chi tiết lịch sử trong canon gắn nhãn **Chính sử / Tương truyền / Hư cấu**; niên đại, tên người và việc ai có mặt ở trận nào đã qua hai vòng kiểm chứng bằng nguồn mở (xem trường `sources`).

## Sửa canon

```bash
node hao-khi-viet/design/tools/merge.cjs   # gộp canon-G*.json → canon.json + canon-summary.md
node hao-khi-viet/design/tools/check.cjs   # kiểm tham chiếu, dải ID, luật L1–L14; phải ra errs = 0
```

`.cjs` vì `package.json` gốc khai `"type": "module"`. 8 cảnh báo còn lại (debut sớm hơn trận chơi được đầu tiên) là có chủ ý.
