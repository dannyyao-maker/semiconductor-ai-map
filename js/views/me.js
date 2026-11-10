// 我的：段位、連續天數、段位之路、學習統計、匯出／匯入進度。
// 網址加上 ?dev（例如 index.html?dev#/me）會出現測試工具：直接設定盃數、模擬昨天有學習。
import { esc, toast } from "../util.js";
import { rankCardHTML, streakCardHTML, rankRoadHTML, setupRankRoad } from "../ui.js";
import { runMatch } from "../match.js";
import { exportJSON, importJSON, reset, state, save } from "../state.js";

const COUNTRY = { TW: "台灣", US: "美國", KR: "韓國", CN: "中國", JP: "日本", NL: "荷蘭" };
const DEV = new URLSearchParams(location.search).has("dev");

export function mountMe(root, ctx) {
  function render() {
    const s = ctx.state();
    const st = ctx.game.standing();
    const scored = Object.values(s.answers);
    const ok = scored.filter((a) => a.ok).length;
    root.innerHTML = `
      <div class="view-head"><div><h1>我的</h1><p class="muted">進度只存在這個瀏覽器裡，換電腦前記得匯出。</p></div></div>
      <div class="me-grid">
        <section class="panel">${rankCardHTML(ctx)}</section>
        <section class="panel">${streakCardHTML(ctx)}</section>
        <section class="panel wide road-panel">
          <h2 class="panel-title">段位之路</h2>
          <p class="muted small">左右滑動看每個段位。越往上，答對加得越少、答錯扣得越多、作答時間越短；到過的大段位不會掉出去。</p>
          ${rankRoadHTML(ctx)}
        </section>
        <section class="panel">
          <h2 class="panel-title">學習統計</h2>
          <dl class="stats">
            <div><dt>計分題</dt><dd>${scored.length} 題</dd></div>
            <div><dt>答對率</dt><dd>${scored.length ? Math.round((ok / scored.length) * 100) + "%" : "—"}</dd></div>
            <div><dt>完成章節</dt><dd>${ctx.completedNodes().length}／${ctx.nodes.length}</dd></div>
            <div><dt>最高盃數</dt><dd>${s.peak}</dd></div>
          </dl>
        </section>
        <section class="panel wide drill-panel">
          <h2 class="panel-title">練習對局：公司歸位</h2>
          <p class="muted small">暫時的練習區，先感受對局的節奏。題目從現有的 41 家公司自動產生：這家公司屬於哪個環節？最後一題盃數加倍，結束後有本局複習。</p>
          <div class="drill"></div>
        </section>
        <section class="panel wide install-panel">${installHTML()}</section>
        <section class="panel wide">
          <h2 class="panel-title">進度備份</h2>
          <p class="actions">
            <button class="btn" data-act="export">匯出進度檔</button>
            <label class="btn">匯入進度檔<input type="file" accept="application/json,.json" data-act="import" hidden></label>
            <button class="btn danger" data-act="reset">全部重來</button>
          </p>
        </section>
        ${DEV ? `
        <section class="panel wide dev">
          <h2 class="panel-title">測試工具（網址有 ?dev 才會出現）</h2>
          <p class="actions">
            ${[0, 300, 750, 1350, 2100, 3000, 4200, 5700].map((n) => `<button class="btn" data-dev-trophies="${n}">設為 ${n} 盃</button>`).join("")}
          </p>
          <p class="actions">
            <button class="btn" data-dev="yesterday">模擬「昨天有學習」（連續 N 天）</button>
            <button class="btn" data-dev="clear-answers">清除作答紀錄（題目可以重新計分）</button>
          </p>
        </section>` : ""}
      </div>`;
    setupRankRoad(root, ctx);
    drill();
  }

  // ---- 段位試玩：公司 → 環節 ----
  function drill() {
    const box = root.querySelector(".drill");
    if (!box) return;
    const m = ctx.game.standing().tier.rank.match || {};
    box.innerHTML = `<p class="actions"><button class="btn primary" data-start-match>開始一局（${m.questions} 題・${m.seconds ? m.seconds + " 秒" : "不計時"}）</button></p>`;
    box.querySelector("[data-start-match]").addEventListener("click", () =>
      runMatch(box, ctx, { key: "drill.seg", title: "練習對局：公司歸位", make: (n) => makeDrills(ctx, n), onExit: () => render() }));
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
      if (p) { p.prompt(); await p.userChoice.catch(() => {}); window.__installPrompt = null; render(); }
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
      toast(`已模擬：到昨天為止連續 ${s.streak.count} 天`);
    } else if (b.dataset.dev === "clear-answers") {
      state().answers = {};
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

  const onInstall = () => { const p = root.querySelector(".install-panel"); if (p) p.innerHTML = installHTML(); };
  window.addEventListener("installready", onInstall);
  render();
  const off = ctx.onState(() => {
    // 對局進行中不要重畫，只更新段位卡和連續天數卡
    if (root.querySelector(".match")) refreshCards();
    else render();
  });
  function refreshCards() {
    const panels = root.querySelectorAll(".me-grid > .panel");
    panels[0].innerHTML = rankCardHTML(ctx);
    panels[1].innerHTML = streakCardHTML(ctx);
  }
  return { unmount: () => { off(); window.removeEventListener("installready", onInstall); } };
}

/** 出 n 題「這家公司屬於哪個環節」，優先出還沒答過的公司，同一局不重複 */
function makeDrills(ctx, n) {
  const answered = ctx.state().answers;
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
  const fresh = shuffle(ctx.companies.filter((c) => !answered[`drill.seg.${c.id}`]));
  const old = shuffle(ctx.companies.filter((c) => answered[`drill.seg.${c.id}`]));
  return [...fresh, ...old].slice(0, n).map((c) => makeDrill(ctx, c));
}

function makeDrill(ctx, c) {
  const right = ctx.nodeById[c.segments[0]];
  const others = ctx.nodes.filter((n) => !c.segments.includes(n.id)).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [right, ...others].sort(() => Math.random() - 0.5);
  const segs = c.segments.map((id) => ctx.nodeById[id]?.name).filter(Boolean).join("、");
  return {
    id: `drill.seg.${c.id}`,
    prompt: `${c.name}（${c.nameEn}）屬於哪個環節？`,
    options: options.map((n) => n.name),
    answer: options.indexOf(right),
    explain: `${c.name}${COUNTRY[c.country] ? `（${COUNTRY[c.country]}）` : ""}：${c.oneLiner}
所屬環節：${segs}。`,
    sources: c.sources,
  };
}

/** 安裝到手機：依裝置顯示步驟；Android Chrome 可以一鍵安裝 */
function installHTML() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const secure = location.protocol === "https:" || location.hostname === "localhost";
  let body;
  if (standalone) body = `<p class="ok-note">✓ 你正在用 App 模式。第一次連線時，內容會存進手機，之後沒網路也能用。</p>`;
  else if (window.__installPrompt) body = `<p>可以直接安裝：像 App 一樣有自己的圖示、全螢幕打開。</p><p class="actions"><button class="btn primary" data-act="install">📲 安裝 App</button></p>`;
  else if (ios) body = `<ol class="install-steps"><li>用 <b>Safari</b> 打開這個網址（用 Chrome 或 LINE 內建瀏覽器不行）。</li><li>點畫面下方的「分享」按鈕（方框加向上箭頭）。</li><li>往下找到「<b>加入主畫面</b>」，按「新增」。</li></ol>`;
  else body = `<ol class="install-steps"><li>用 <b>Chrome</b> 打開這個網址。</li><li>點右上角的「⋮」選單。</li><li>選「<b>安裝應用程式</b>」或「<b>加到主畫面</b>」。</li></ol>`;
  return `<h2 class="panel-title">📲 安裝到手機</h2>
    ${body}
    <p class="muted small">${secure ? "" : "目前不是 https 網址，瀏覽器可能不提供安裝。"}安裝後第一次連線會把內容存進手機，沒網路也能學習；事件和內容更新需要連線才會取得最新版。<br>
    <b>注意：</b>加到主畫面後是一個全新的空間，原本在瀏覽器裡的進度不會自動帶過去，請先在瀏覽器「匯出進度檔」，再到 App 裡「匯入」。</p>`;
}
