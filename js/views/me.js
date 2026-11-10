// 我的：吉祥物、連續天數、四個數字、功能列（字典、備份、安裝、重來）。
// 網址加上 ?dev（例如 index.html?dev#/me）會出現測試工具：直接設定盃數、模擬昨天有學習。
import { toast } from "../util.js";
import { ic, mascot } from "../icons.js";
import { exportJSON, importJSON, reset, state, save } from "../state.js";

const DEV = new URLSearchParams(location.search).has("dev");

export function mountMe(root, ctx) {
  function render() {
    const s = ctx.state();
    const sn = ctx.game.streakNow();
    const scored = Object.values(s.answers);
    const ok = scored.filter((a) => a.ok).length;
    const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const next = (ctx.config.streak?.milestones || []).find((m) => m.days > sn.count);
    root.innerHTML = `
      <div class="me">
        <div class="me-hero${sn.doneToday ? " is-lit" : ""}">
          ${mascot(sn.doneToday ? "happy" : "idle", 130)}
          <div class="me-streak" aria-label="連續 ${sn.count} 天">${ic("flame")}<b>${sn.count}</b></div>
          ${next ? `<div class="me-goal" aria-label="再 ${next.days - sn.count} 天加倍">${ic("flame")}<i>${next.days}</i><span>×2</span></div>` : ""}
          ${sn.double ? `<div class="me-double">${ic("bolt")}×2</div>` : ""}
        </div>
        <ul class="me-stats">
          <li>${ic("target")}<b>${scored.length}</b></li>
          <li>${ic("check")}<b>${scored.length ? Math.round((ok / scored.length) * 100) + "%" : "—"}</b></li>
          <li>${ic("flag")}<b>${ctx.completedNodes().length}</b></li>
          <li>${ic("trophy")}<b>${s.peak}</b></li>
        </ul>
        <div class="me-list">
          <a class="me-row" href="#/dict">${ic("book")}<span>指標字典</span><i>›</i></a>
          <button class="me-row" type="button" data-act="export">${ic("download")}<span>匯出進度</span></button>
          <label class="me-row">${ic("upload")}<span>匯入進度</span><input type="file" accept="application/json,.json" data-act="import" hidden></label>
          ${standalone ? "" : `<button class="me-row" type="button" data-act="install">${ic("phone")}<span>安裝到手機</span></button>`}
          <button class="me-row is-danger" type="button" data-act="reset">${ic("trash")}<span>全部重來</span></button>
        </div>
        ${DEV ? `
        <div class="me-dev">
          <p>${[0, 300, 750, 1350, 2100, 3000, 4200, 5700].map((n) => `<button type="button" data-dev-trophies="${n}">${n}</button>`).join("")}</p>
          <p><button type="button" data-dev="yesterday">昨天有學習</button><button type="button" data-dev="clear-answers">清除作答</button><button type="button" data-dev="stale">快忘了</button><button type="button" data-dev="day+1">快轉 +1 天</button><button type="button" data-dev="day0">回到今天</button></p>
        </div>` : ""}
        <p class="me-foot">學習用途・附來源・不構成投資建議　<a href="https://github.com/dannyyao-maker/semiconductor-ai-map">GitHub</a></p>
      </div>`;
  }

  /** 安裝教學：用底部抽屜，步驟用圖示和很短的字 */
  function installSheet() {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const steps = ios
      ? [["download", "Safari 的「分享」"], ["path", "加入主畫面"], ["check", "新增"]]
      : [["more", "Chrome 右上角 ⋮"], ["phone", "安裝應用程式"], ["check", "安裝"]];
    const wrap = document.createElement("div");
    wrap.className = "sheet-backdrop";
    wrap.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="安裝到手機">
        <ol class="sheet-steps">${steps.map(([i, t]) => `<li>${ic(i)}<span>${t}</span></li>`).join("")}</ol>
        <p class="sheet-warn">${ic("warning")}<span>安裝後是新的空間：先在這裡「匯出進度」，再到 App 裡「匯入」。</span></p>
        <button class="sheet-ok" type="button" aria-label="知道了">${ic("check")}</button>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest(".sheet-ok")) close(); });
    wrap.querySelector(".sheet-ok").focus();
  }

  root.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.act === "export") {
      const blob = new Blob([exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `semimap-progress-${ctx.game.dayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (b.dataset.act === "install") {
      const p = window.__installPrompt;
      if (p) { p.prompt(); await p.userChoice.catch(() => {}); window.__installPrompt = null; render(); } else installSheet();
    } else if (b.dataset.act === "reset") {
      if (confirm("確定要清除所有進度嗎？盃數、連續天數、章節進度都會歸零，而且無法復原。")) { reset(); toast("已清除所有進度"); }
    } else if (b.dataset.devTrophies) {
      const s = state();
      s.trophies = Number(b.dataset.devTrophies);
      s.peak = s.trophies;
      save();
    } else if (b.dataset.dev === "yesterday") {
      const s = state();
      const y = new Date(Date.now() - 864e5);
      s.streak = { count: (s.streak.count || 0) + 1, last: ctx.game.dayKey(y), doubleDay: null };
      save();
      toast(`到昨天為止連續 ${s.streak.count} 天`);
    } else if (b.dataset.dev === "clear-answers") {
      state().answers = {};
      save();
    } else if (b.dataset.dev === "day+1" || b.dataset.dev === "day0") {
      ctx.game.setDevShift(b.dataset.dev === "day0" ? 0 : ctx.game.devShift() + 1);
      save();
      toast(`測試日期：今天 +${ctx.game.devShift()} 天（${ctx.game.dayKey()}）`);
    } else if (b.dataset.dev === "stale") {
      const s = state();
      s.chapters["ic-design"] = { sections: { "know.what": true, "know.money": true, "know.market": true }, parts: { know: true }, at: Date.now() - 9 * 864e5 };
      save();
    }
  });
  root.addEventListener("change", async (e) => {
    if (e.target.dataset.act !== "import") return;
    const file = e.target.files[0];
    if (!file) return;
    try { importJSON(await file.text()); toast("已匯入進度"); }
    catch (err) { toast(`匯入失敗：${err.message}`); }
  });

  const onInstall = () => render();
  window.addEventListener("installready", onInstall);
  render();
  const off = ctx.onState(render);
  return { unmount: () => { off(); window.removeEventListener("installready", onInstall); } };
}
