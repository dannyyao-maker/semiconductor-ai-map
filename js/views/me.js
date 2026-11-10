// 我的：段位、連續天數、段位之路、學習統計、匯出／匯入進度。
// 網址加上 ?dev（例如 index.html?dev#/me）會出現測試工具：直接設定盃數、模擬昨天有學習。
import { esc, toast } from "../util.js";
import { rankBadge } from "../game.js";
import { rankCardHTML, streakCardHTML } from "../ui.js";
import { renderQuiz } from "../quiz.js";
import { exportJSON, importJSON, reset, state, save } from "../state.js";

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
        <section class="panel">
          <h2 class="panel-title">學習統計</h2>
          <dl class="stats">
            <div><dt>計分題</dt><dd>${scored.length} 題</dd></div>
            <div><dt>答對率</dt><dd>${scored.length ? Math.round((ok / scored.length) * 100) + "%" : "—"}</dd></div>
            <div><dt>完成章節</dt><dd>${ctx.completedNodes().length}／${ctx.nodes.length}</dd></div>
            <div><dt>最高盃數</dt><dd>${s.peak}</dd></div>
          </dl>
        </section>
        <section class="panel drill-panel">
          <h2 class="panel-title">段位試玩：公司歸位</h2>
          <p class="muted small">暫時的練習區，讓你先感受加減盃數。題目從現有的 41 家公司自動產生：這家公司屬於哪個環節？</p>
          <div class="drill"></div>
        </section>
        <section class="panel wide">
          <h2 class="panel-title">段位之路</h2>
          <p class="muted small">越往上，答對加得越少、答錯扣得越多；到過的大段位不會掉出去。</p>
          <ol class="road">
            ${ctx.game.tiers.map((t) => `
              <li class="${t.index === st.tier.index ? "is-current" : ""}${s.trophies >= t.from ? " is-reached" : ""}">
                ${rankBadge(t, "sm")}
                <span class="road-label">${esc(t.label)}</span>
                <span class="road-from">${t.from}+</span>
                <span class="road-rule">+${t.rank.win}／${t.rank.loss ? "−" + t.rank.loss : "0"}</span>
              </li>`).join("")}
          </ol>
        </section>
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
    drill();
  }

  // ---- 段位試玩：公司 → 環節 ----
  function drill() {
    const box = root.querySelector(".drill");
    if (!box) return;
    renderQuiz(box, makeDrill(ctx), ctx, { continueLabel: "下一題", onDone: () => render() });
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.act === "export") {
      const blob = new Blob([exportJSON()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `semimap-progress-${ctx.game.dayKey()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
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

  render();
  const off = ctx.onState(() => {
    // 作答中不要重畫，避免解說被洗掉；按「下一題」時才重畫
    if (!root.querySelector(".quiz.is-answered")) render();
    else refreshCards();
  });
  function refreshCards() {
    const panels = root.querySelectorAll(".me-grid > .panel");
    panels[0].innerHTML = rankCardHTML(ctx);
    panels[1].innerHTML = streakCardHTML(ctx);
  }
  return { unmount: off };
}

/** 隨機出一題「這家公司屬於哪個環節」，優先出還沒答過的公司 */
function makeDrill(ctx) {
  const answered = ctx.state().answers;
  const fresh = ctx.companies.filter((c) => !answered[`drill.seg.${c.id}`]);
  const pool = fresh.length ? fresh : ctx.companies;
  const c = pool[Math.floor(Math.random() * pool.length)];
  const right = ctx.nodeById[c.segments[0]];
  const others = ctx.nodes.filter((n) => !c.segments.includes(n.id)).sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [right, ...others].sort(() => Math.random() - 0.5);
  const segs = c.segments.map((id) => ctx.nodeById[id]?.name).filter(Boolean).join("、");
  return {
    id: `drill.seg.${c.id}`,
    prompt: `${c.name}（${c.nameEn}）屬於哪個環節？`,
    options: options.map((n) => n.name),
    answer: options.indexOf(right),
    explain: `${c.name}：${c.oneLiner}（所屬環節：${segs}）`,
    sources: c.sources,
  };
}
