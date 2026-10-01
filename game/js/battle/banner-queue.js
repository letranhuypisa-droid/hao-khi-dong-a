// battle/banner-queue.js — hàng đợi băng chữ giữa màn của trận B15. fx.banner chỉ giữ một băng: băng mới xoá băng cũ ngay, nên
// ba băng gọi trong cùng một nhịp (khi chiếm A1: "KẾ SÁCH · CỜ ÁO TỐNG", "CHIẾM ĐỒN BẾN TRÊN", "P2 · HAI CÁNH") chỉ còn băng cuối
// trên màn. Hàng đợi này cho mỗi băng hiện ít nhất min(T, hold) giây rồi mới tới băng kế; băng cuối hiện đủ T.
// B20 có bản riêng trong director-b20.js (bq, cách nhau T + 0,6 s) và không dùng file này.
// Thuần (không DOM): show(text, color, T) do nơi dùng truyền vào; update(dt) gọi theo đồng hồ trận.

export class BannerQueue {
  constructor(show, { gap = 0.25, hold = 1.1, max = 4 } = {}) {
    this.show = show; this.gap = gap; this.hold = hold; this.max = max;
    this.q = []; this.cur = null; this.age = 0;
  }
  // bỏ băng trùng chữ đang chờ; hàng đầy thì bỏ băng chờ cũ nhất (băng mới thường quan trọng hơn).
  // low: băng phụ (Kế Sách mở cùng lúc chiếm đồn) luôn xếp sau mọi băng thường, dù đến trước.
  push(text, color, T, low = false) {
    if (this.q.some((b) => b.text === text)) return;
    if (this.q.length >= this.max) this.q.shift();
    const item = { text, color, T, low };
    const at = low ? -1 : this.q.findIndex((b) => b.low);
    if (at < 0) this.q.push(item); else this.q.splice(at, 0, item);
  }
  update(dt) {
    if (this.cur) this.age += dt;
    if (!this.q.length) return;
    if (this.cur && this.age < Math.min(this.cur.T, this.hold) + this.gap) return;
    const b = this.q.shift(); this.cur = b; this.age = 0;
    this.show(b.text, b.color, b.T);
  }
  clear() { this.q.length = 0; this.cur = null; this.age = 0; }
}
