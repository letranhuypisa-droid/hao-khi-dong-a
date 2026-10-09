// meta/save.js — lưu hồ sơ tiến độ.
//
// GDD 15.10 chốt IndexedDB + navigator.storage.persist() và nút xuất/nhập file. Bản thử dùng
// localStorage cho gọn (hồ sơ < 10 KB) nhưng giữ đủ nút xuất/nhập, vì Safari xoá storage của
// trang chưa cài sau 7 ngày không tương tác.

import { migrate, newSave } from "./progress.js";

const KEY = "hkda:save:v1";

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : newSave();
  } catch (_) {
    return newSave();
  }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch (_) { return false; }
}

export function exportSave(save) {
  const blob = new Blob([JSON.stringify(save, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `hao-khi-dong-a-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function importSave(file) {
  return file.text().then((t) => migrate(JSON.parse(t)));
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch (_) { /* không có storage thì thôi */ }
  return newSave();
}
