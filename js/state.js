// 學習進度：全部存在瀏覽器的 localStorage，不需要帳號。
// 換電腦或清除瀏覽資料會消失，所以「我的」頁面提供匯出、匯入。
import { store } from "./util.js";

const KEY = "semimap.game";

const blank = () => ({
  v: 1,
  trophies: 0,          // 目前盃數
  peak: 0,              // 曾經達到的最高盃數（決定「不會掉出的大段位」）
  reviews: {},          // 間隔複習：{ 題目代碼: { box（第幾格）, due（下次複習日）, last, lapses（答錯次數） } }
  answers: {},          // 計分題的第一次作答：{ 題目代碼: { ok, at, d（加減的盃數） } }
  history: [],          // 每次加減盃數的紀錄：{ at, qid, d, t（之後的盃數） }
  streak: { count: 0, last: null, doubleDay: null }, // 連續天數；doubleDay＝盃數加倍的那一天
  chapters: {},         // 章節進度：{ 環節代碼: { parts: { know: true, ... }, at } }
  events: {},           // 事件任務：{ 事件代碼: { done: true, at } }
  best: {},             // 各個對局的最佳分數：{ 對局代碼: 分數 }
  onboarded: false,     // 看過全景開場了沒
});

let s = blank();
const listeners = new Set();

export function load() {
  const saved = store.get(KEY, null);
  s = saved && saved.v === 1 ? { ...blank(), ...saved } : blank();
  return s;
}

export const state = () => s;

export function save() {
  store.set(KEY, s);
  listeners.forEach((f) => f(s));
}

/** 進度有變動時通知（例如頁首的盃數和火焰） */
export function onChange(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export const exportJSON = () => JSON.stringify(s, null, 1);

export function importJSON(text) {
  const o = JSON.parse(text);
  if (!o || typeof o !== "object" || o.v !== 1 || typeof o.trophies !== "number") throw new Error("這不是這個 App 匯出的進度檔");
  s = { ...blank(), ...o };
  save();
}

export function reset() {
  s = blank();
  save();
}
