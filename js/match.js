// 對局：個人答題（像 Duolingo 的一課），全螢幕。
// - 開局前 3 秒倒數；一局幾回合、每題幾秒，依開局時的段位（data/game.json 的 match）
// - 上方：離開、進度條（每答一題亮一格，對綠錯紅）、連對次數、本局盃數、倒數時鐘
// - 答完從下方滑出結果：對是綠色、錯是紅色，附正確答案和解析
// - 最後一題是段位能出的最難題目，盃數加倍
// - 結束後顯示「本局複習」：每一題的題目、你的答案、正確答案和解析；可以把答錯的題再練一次
import { esc } from "./util.js";
import { renderQuiz } from "./quiz.js";
import { rankBadge } from "./game.js";
import { state, save } from "./state.js";

/**
 * opts.key：對局代碼（記最佳紀錄）；opts.questions：題目陣列，或 opts.make(n) 產生 n 題；
 * opts.title：標題；opts.practice：練習模式（不倒數開場）；opts.onExit(summary)：離開時呼叫。
 */
export function runMatch(_container, ctx, opts) {
  const { key, title = "對局", onExit } = opts;
  const st = ctx.game.standing();
  const rank = st.tier.rank;
  const m = rank.match || { questions: 4, seconds: 0 };
  const sc = ctx.config.scoring || { lastMultiplier: 2 };
  const qs = opts.practice ? opts.questions : arrange(opts.questions || opts.make(m.questions), m.questions, ctx);
  const n = qs.length;
  let i = 0, right = 0, trophies = 0, combo = 0, bestCombo = 0, exited = false;
  const results = [];
  const T = ctx.textify();

  document.querySelector(".arena")?.remove();
  const arena = document.createElement("div");
  arena.className = "arena";
  arena.setAttribute("role", "dialog");
  arena.setAttribute("aria-modal", "true");
  arena.setAttribute("aria-label", title);
  arena.style.setProperty("--rank", rank.color);
  document.body.appendChild(arena);
  document.body.classList.add("arena-open");

  const close = (summary) => {
    if (exited) return;
    exited = true;
    arena.remove();
    document.body.classList.remove("arena-open");
    onExit?.(summary);
  };

  // ---- 開局倒數 ----
  arena.innerHTML = `
    <div class="arena-intro">
      ${rankBadge(st.tier, "hero")}
      <p class="intro-title">${esc(title)}</p>
      <p class="intro-meta">${esc(st.tier.label)}・${m.seconds ? `每題 ${m.seconds} 秒` : "不計時"}・${n} 題${opts.practice ? "・練習不計盃" : ""}</p>
      <p class="intro-count">3</p>
      <button class="btn ghost" data-cancel>取消</button>
    </div>`;
  arena.querySelector("[data-cancel]").addEventListener("click", () => close(null));
  let c = 3;
  const cd = setInterval(() => {
    if (exited) return clearInterval(cd);
    c--;
    const el = arena.querySelector(".intro-count");
    if (c > 0) { el.textContent = c; el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
    else { clearInterval(cd); build(); next(); }
  }, 700);

  // ---- 答題畫面 ----
  let qEl, clockHost, segs, comboEl, cupEl;
  function build() {
    arena.innerHTML = `
      <div class="lesson-top">
        <button class="lesson-quit" aria-label="離開">✕</button>
        <ol class="lesson-progress" aria-label="進度">${qs.map((_, j) => `<li class="${j === n - 1 ? "is-final" : ""}"></li>`).join("")}</ol>
        <span class="lesson-cup" title="本局盃數">🏆 <b>0</b></span>
        <div class="lesson-clock"></div>
      </div>
      <p class="lesson-combo" aria-live="polite"></p>
      <div class="lesson-q"></div>`;
    qEl = arena.querySelector(".lesson-q");
    clockHost = arena.querySelector(".lesson-clock");
    segs = [...arena.querySelectorAll(".lesson-progress li")];
    comboEl = arena.querySelector(".lesson-combo");
    cupEl = arena.querySelector(".lesson-cup b");
    arena.querySelector(".lesson-quit").addEventListener("click", () => {
      if (confirm("確定要離開這一局嗎？已經作答的題目盃數不會退回。")) close(null);
    });
  }

  function next() {
    if (exited) return;
    if (i >= n) return end();
    const last = i === n - 1;
    segs.forEach((s, j) => s.classList.toggle("is-now", j === i));
    arena.classList.toggle("is-final", last);
    renderQuiz(qEl, qs[i], ctx, {
      seconds: m.seconds, mult: last && !opts.practice ? sc.lastMultiplier : 1, clockHost,
      continueLabel: last ? "看結果" : "繼續",
      onAnswer: (res) => {
        results.push(res);
        if (res.correct) { right++; combo++; bestCombo = Math.max(bestCombo, combo); } else combo = 0;
        if (!res.practice) trophies += res.d;
        segs[i].classList.add(res.correct ? "is-right" : "is-wrong");
        cupEl.textContent = (trophies > 0 ? "+" : "") + trophies;
        comboEl.textContent = combo >= 2 ? `🔥 連續答對 ${combo} 題` : "";
        comboEl.classList.toggle("is-on", combo >= 2);
      },
      onDone: () => { i++; next(); },
    });
  }

  function end() {
    arena.classList.remove("is-final");
    const s = state();
    s.best = s.best || {};
    if (!opts.practice && right > (s.best[key] ?? -1)) { s.best[key] = right; save(); }
    const wrong = results.filter((r) => !r.correct);
    const perfect = right === n;
    arena.innerHTML = `
      <div class="lesson-end">
        <p class="end-kicker">${perfect ? "🎉 全部答對！" : right >= n / 2 ? "👍 完成這一局" : "💪 完成這一局，看完複習再試一次"}</p>
        <dl class="end-stats">
          <div><dt>答對</dt><dd>${right}／${n}</dd></div>
          <div><dt>盃數</dt><dd class="${trophies > 0 ? "up" : trophies < 0 ? "down" : ""}">${opts.practice ? "練習" : `${trophies > 0 ? "+" : ""}${trophies}`}</dd></div>
          <div><dt>最多連對</dt><dd>${bestCombo}</dd></div>
          <div><dt>最快一題</dt><dd>${fastest(results)}</dd></div>
        </dl>
        <h2 class="review-title">本局複習</h2>
        <p class="review-hint">把剛剛的題目再看一次，答錯的特別留意。</p>
        <ol class="review">${results.map((r, j) => `
          <li class="${r.correct ? "is-right" : "is-wrong"}">
            <p class="rv-q"><span class="rv-no">${j + 1}</span>${T(r.prompt)}</p>
            ${r.correct ? `<p class="rv-a ok">✓ ${esc(r.correctText)}</p>`
              : `<p class="rv-a ng">✗ 你的答案：${r.picked ? esc(r.picked) : "時間到，沒有作答"}</p><p class="rv-a ok">✓ 正確答案：${esc(r.correctText)}</p>`}
            ${r.q.explain ? `<p class="rv-explain">${T(r.q.explain)}</p>` : ""}
          </li>`).join("")}</ol>
        <p class="actions end-actions">
          ${wrong.length ? `<button class="btn primary" data-retry>重練答錯的 ${wrong.length} 題（不計盃）</button>` : ""}
          ${opts.practice ? "" : `<button class="btn${wrong.length ? "" : " primary"}" data-again>再來一局</button>`}
          <button class="btn" data-exit>結束</button>
        </p>
      </div>`;
    arena.scrollTop = 0;
    const summary = { right, n, trophies, results };
    arena.querySelector("[data-retry]")?.addEventListener("click", () => {
      exited = true; arena.remove();
      runMatch(_container, ctx, { ...opts, practice: true, title: `重練：${title.replace(/^重練：/, "")}`, questions: wrong.map((r) => r.q), onExit: () => onExit?.(summary) });
    });
    arena.querySelector("[data-again]")?.addEventListener("click", () => { exited = true; arena.remove(); runMatch(_container, ctx, opts); });
    arena.querySelector("[data-exit]").addEventListener("click", () => close(summary));
  }
}

/** 排題目：隨機抽，最後一題放目前段位能出的最難題目 */
function arrange(list, n, ctx) {
  const ok = list.filter((q) => ctx.game.difficultyUnlocked(q.difficulty || 1));
  const pool = (ok.length ? ok : list).map((q) => [Math.random(), q]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
  if (pool.length <= 1) return pool.slice(0, n);
  const hardest = pool.reduce((a, b) => ((b.difficulty || 1) > (a.difficulty || 1) ? b : a), pool[0]);
  return [...pool.filter((q) => q !== hardest).slice(0, n - 1), hardest];
}

function fastest(results) {
  const t = results.filter((r) => r.correct && r.timeLeft != null).map((r) => r.seconds - r.timeLeft);
  return t.length ? `${Math.min(...t).toFixed(1)} 秒` : "—";
}
