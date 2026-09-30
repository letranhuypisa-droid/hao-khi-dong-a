// battle/input.js — bàn phím + chuột, tay cầm (Gamepad API, ánh xạ standard), cảm ứng (15.8).
// pressed: phím cạnh của khung (xoá ở endFrame). held (tính lại mỗi poll): c = đang giữ C (K, chuột phải, Y tay cầm, nút C
// cảm ứng — tụ lực đại kiếm WC01, C3 giữ để kéo dài), interact = đang giữ Tương tác (X, RT, nút ngữ cảnh cảm ứng "interact").
// Đợt 9: skill2 = T / D-pad trái / nút cảm ứng "skill2" (ô kỹ năng 2 của H31: Binh Thư Yếu Lược); interact = X (giữ).

const KEYMAP = {
  KeyJ: "n", KeyK: "c", Space: "dodge", KeyL: "block", ShiftLeft: "block", ShiftRight: "block",
  KeyE: "skill", KeyU: "skill", KeyT: "skill2", KeyX: "interact", KeyR: "ult", KeyI: "ult", KeyF: "tpc", KeyQ: "lock", KeyG: "kesach",
  Tab: "cmd", KeyM: "map", Escape: "pause", KeyP: "pause",
  Digit1: "cmd1", Digit2: "cmd2", Digit3: "cmd3", Digit4: "cmd4", KeyZ: "cmdSwap",
  Enter: "next", NumpadEnter: "next",           // màn Huấn luyện: sang bài / bỏ qua
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); this.pressed = {}; this.held = {};
    this.moveX = 0; this.moveY = 0; this.camDX = 0; this.camDY = 0;
    this.touch = false; this.stick = { x: 0, y: 0 }; this.touchHeld = {};
    this.padPrev = []; this.enabled = true; this.mouseC = false;
    this.onKey = (e) => {
      if (!this.enabled) return;
      const down = e.type === "keydown";
      if (["Tab", "Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
      if (down) { if (!this.keys.has(e.code)) { const a = KEYMAP[e.code]; if (a) this.pressed[a] = true; } this.keys.add(e.code); }
      else this.keys.delete(e.code);
      this.touch = false;
    };
    this.onMouse = (e) => {
      if (!this.enabled || e.pointerType === "touch") return;
      if (e.type === "pointerdown") {
        if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
        if (e.button === 0) this.pressed.n = true;
        if (e.button === 2) { this.pressed.c = true; this.mouseC = true; }
        if (e.button === 1) this.pressed.lock = true;
        this.touch = false;
      } else if (e.type === "pointerup" && e.button === 2) this.mouseC = false;
    };
    this.onMove = (e) => {
      if (document.pointerLockElement === canvas) { this.camDX += e.movementX; this.camDY += e.movementY; }
    };
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    canvas.addEventListener("pointerdown", this.onMouse);
    window.addEventListener("pointerup", this.onMouse);          // thả chuột phải ở đâu cũng nhả C (tụ lực)
    window.addEventListener("mousemove", this.onMove);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.onBlur = () => { this.keys.clear(); this.touchHeld = {}; this.stick.x = this.stick.y = 0; this.mouseC = false; };
    window.addEventListener("blur", this.onBlur);
  }

  dispose() {
    window.removeEventListener("keydown", this.onKey); window.removeEventListener("keyup", this.onKey);
    window.removeEventListener("mousemove", this.onMove); window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("pointerup", this.onMouse);
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  // Lớp cảm ứng gọi vào đây.
  touchButton(name, down) {
    this.touch = true;
    if (down && !this.touchHeld[name]) this.pressed[name] = true;
    this.touchHeld[name] = down;
  }
  setStick(x, y) { this.touch = true; this.stick.x = x; this.stick.y = y; }
  touchCam(dx, dy) { this.touch = true; this.camDX += dx; this.camDY += dy; }

  poll() {
    const k = this.keys;
    let mx = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    let my = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    if (k.has("ArrowLeft")) this.camDX -= 9;
    if (k.has("ArrowRight")) this.camDX += 9;
    if (Math.abs(this.stick.x) + Math.abs(this.stick.y) > 0.05) { mx = this.stick.x; my = this.stick.y; }
    let block = k.has("KeyL") || k.has("ShiftLeft") || k.has("ShiftRight") || !!this.touchHeld.block;
    let cmdHeld = k.has("Tab") || !!this.touchHeld.cmd;
    let heldC = k.has("KeyK") || this.mouseC || !!this.touchHeld.c, heldI = k.has("KeyX") || !!this.touchHeld.interact;

    // tay cầm: A=0 Né, B=1 Tuyệt Kỹ, X=2 N, Y=3 C, LB=4 Kỹ năng, RB=5 Đỡ, LT=6 Mệnh Lệnh, RT=7 khóa,
    // Back=8 bản đồ, Start=9 tạm dừng, D-pad lên=12 Tổng Phản Công, D-pad phải=15 Kế Sách, D-pad trái=14 kỹ năng 2; trong vòng
    // lệnh: D-pad chọn lệnh. Giữ Y = giữ C (tụ lực), giữ RT = giữ Tương tác (RT vẫn bấm khóa như cũ — B20 cần tách, xem báo cáo).
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = (i) => !!p.buttons[i]?.pressed, edge = (i) => b(i) && !this.padPrev[i];
      const ax = (i) => (Math.abs(p.axes[i] || 0) > 0.18 ? p.axes[i] : 0);
      if (ax(0) || ax(1)) { mx = ax(0); my = -ax(1); this.touch = false; }
      this.camDX += ax(2) * 14; this.camDY += ax(3) * 8;
      const ring = b(6);
      if (edge(0)) this.pressed.dodge = true;
      if (edge(1)) this.pressed.ult = true;
      if (edge(2)) this.pressed.n = true;
      if (edge(3)) this.pressed.c = true;
      if (edge(4)) this.pressed[ring ? "cmdSwap" : "skill"] = true;
      if (edge(5)) this.pressed.block = true;
      if (edge(7)) { this.pressed.lock = true; this.pressed.interact = true; }
      if (edge(8)) this.pressed.map = true;
      if (edge(9)) this.pressed.pause = true;
      if (edge(12)) this.pressed[ring ? "cmd1" : "tpc"] = true;
      if (edge(15)) this.pressed[ring ? "cmd2" : "kesach"] = true;
      if (edge(13) && ring) this.pressed.cmd3 = true;
      if (edge(14)) this.pressed[ring ? "cmd4" : "skill2"] = true;
      block = block || b(5); cmdHeld = cmdHeld || ring; heldC = heldC || b(3); heldI = heldI || b(7);
      this.padPrev = p.buttons.map((x) => x.pressed);
      break;
    }
    const len = Math.hypot(mx, my); if (len > 1) { mx /= len; my /= len; }
    this.moveX = mx; this.moveY = my; this.block = block; this.cmdHeld = cmdHeld;
    this.held.c = heldC; this.held.interact = heldI;
    return this;
  }

  endFrame() { this.pressed = {}; this.camDX = 0; this.camDY = 0; }
}
