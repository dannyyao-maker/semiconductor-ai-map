// 新手導覽：第一次進站顯示 4 個步驟，之後可以從頁首的「導覽」按鈕重看。
import { store } from "./util.js";

const KEY = "semimap.tourDone";
const STEPS = [
  {
    title: "歡迎！這是一張產業鏈地圖",
    body: "從左到右是價值流動的方向：半導體做出晶片 → 組成 AI 伺服器、放進資料中心 → 雲端和模型公司把它變成賺錢的 AI 服務。三種顏色代表三大區塊。",
  },
  {
    title: "點一個環節，打開環節卡",
    body: "每張環節卡回答商業上最重要的問題：這個環節在做什麼、跟誰買賣、怎麼賺錢、議價能力強不強，以及現在遇到的問題和熱門話題。",
  },
  {
    title: "點代表公司，看它橫跨哪些環節",
    body: "在環節卡裡點公司名稱，會打開公司小卡，地圖上也會加亮這家公司參與的所有環節。例如台積電同時在晶圓代工和封測。",
  },
  {
    title: "看懂標籤、術語和來源",
    body: "虛線底線的詞是專有名詞，點一下看白話解釋。每條內容都有狀態標籤（待查證、待審核、已審核）和來源連結，可以點開原始文件。讀懂一張卡就按「我讀懂了」，地圖會幫你打勾。",
  },
];

export function setupTour(button) {
  button.addEventListener("click", () => openTour(0));
  // 網址加上 ?notour 可以不顯示導覽（拍截圖用）
  if (!store.get(KEY, false) && !location.search.includes("notour")) openTour(0);
}

function openTour(i) {
  document.getElementById("tour")?.remove();
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  const wrap = document.createElement("div");
  wrap.id = "tour";
  wrap.className = "tour-backdrop";
  wrap.innerHTML = `
    <div class="tour-box" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <p class="tour-step">導覽 ${i + 1} / ${STEPS.length}</p>
      <h2 id="tour-title">${s.title}</h2>
      <p>${s.body}</p>
      <div class="tour-actions">
        <button class="tour-skip" data-tour="skip">${last ? "" : "跳過導覽"}</button>
        <span>
          ${i > 0 ? `<button class="tour-btn ghost" data-tour="prev">上一步</button>` : ""}
          <button class="tour-btn" data-tour="${last ? "done" : "next"}">${last ? "開始使用" : "下一步"}</button>
        </span>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const primary = wrap.querySelector(`[data-tour="${last ? "done" : "next"}"]`);
  primary.focus();

  const finish = () => { store.set(KEY, true); wrap.remove(); };
  wrap.addEventListener("click", (e) => {
    const a = e.target.closest("[data-tour]")?.dataset.tour;
    if (a === "next") openTour(i + 1);
    else if (a === "prev") openTour(i - 1);
    else if (a === "done" || a === "skip") finish();
    else if (e.target === wrap) finish();
  });
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.stopPropagation(); finish(); }
    // 讓 Tab 鍵只在導覽框裡面移動
    if (e.key === "Tab") {
      const f = [...wrap.querySelectorAll("button")].filter((b) => b.textContent.trim());
      const idx = f.indexOf(document.activeElement);
      if (e.shiftKey && idx <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && idx === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
}
