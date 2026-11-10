// 對局：把幾題計分題串成一局（仿知識王）。
// - 一局幾題、每題幾秒，依開局時的段位決定（data/game.json 的 match）
// - 答對得分，越早答分數越高；左邊是你的分數條，右邊是目標（第一次是滿分的 60%，之後是你的最佳紀錄）
// - 最後一題是段位能出的最難題目，分數和盃數都加倍
// - 盃數仍然一題一題算（見 game.js），分數只用來比快、比準
import { esc } from "./util.js";
import { renderQuiz } from "./quiz.js";
import { state, save } from "./state.js";

/**
 * container：畫對局的地方；opts.key：這個對局的代碼（記最佳紀錄用）；
 * opts.questions：題目陣列（數量不足一局時全部出），或 opts.make(n)：產生 n 題的函式；
 * opts.title：標題；opts.onExit(summary)：按「結束」時呼叫。
 */
export function runMatch(container, ctx, opts) {
  const { key, title = "對局", onExit } = opts;
  const rank = ctx.game.standing().tier.rank;
  const m = rank.match || { questions: 3, seconds: 0 };
  const sc = ctx.config.scoring || { base: 10, speed: 10, lastMultiplier: 2, targetRatio: 0.6 };
  const qs = arrange(opts.questions || opts.make(m.questions), m.questions, ctx);
  const n = qs.length;
  const maxScore = (n - 1) * (sc.base + sc.speed) + (sc.base + sc.speed) * sc.lastMultiplier;
  const best = state().best?.[key] ?? null;
  const target = best ?? Math.round(maxScore * sc.targetRatio);
  let i = 0, score = 0, right = 0, trophies = 0;
  const results = [];

  container.innerHTML = `
    <div class="match is-running">
      <div class="match-head">
        <p class="match-title">${esc(title)}</p>
        <p class="match-meta">${esc(rank.name)}・一局 ${n} 題・${m.seconds ? `每題 ${m.seconds} 秒` : "不計時"}</p>
        <ol class="match-dots">${qs.map((_, j) => `<li class="${j === n - 1 ? "is-final" : ""}">${j === n - 1 ? "×2" : j + 1}</li>`).join("")}</ol>
      </div>
      <div class="match-stage">
        <div class="sbar you" aria-label="你的分數"><b class="sbar-num">0</b><span class="sbar-track"><span class="sbar-fill"></span></span><small>你</small></div>
        <div class="match-q"></div>
        <div class="sbar target" aria-label="目標分數"><b class="sbar-num">${target}</b><span class="sbar-track"><span class="sbar-fill" style="height:${pct(target)}%"></span></span><small>${best != null ? "最佳" : "目標"}</small></div>
      </div>
    </div>`;
  const root = container.querySelector(".match");
  const qEl = root.querySelector(".match-q");
  const youFill = root.querySelector(".sbar.you .sbar-fill");
  const youNum = root.querySelector(".sbar.you .sbar-num");
  const dots = [...root.querySelectorAll(".match-dots li")];

  function pct(v) { return Math.min(100, (v / maxScore) * 100); }

  function next() {
    if (i >= n) return end();
    dots.forEach((d, j) => d.classList.toggle("is-now", j === i));
    const last = i === n - 1;
    renderQuiz(qEl, qs[i], ctx, {
      seconds: m.seconds,
      mult: last ? sc.lastMultiplier : 1,
      label: `第 ${i + 1}／${n} 題`,
      continueLabel: last ? "看結果" : "下一題",
      onAnswer: (res) => {
        const speed = res.seconds ? res.timeLeft / res.seconds : 0.5;
        const pts = res.correct ? Math.round((sc.base + sc.speed * speed) * (last ? sc.lastMultiplier : 1)) : 0;
        score += pts;
        if (res.correct) right++;
        if (!res.practice) trophies += res.d;
        results.push({ ...res, pts });
        dots[i].classList.add(res.correct ? "is-right" : "is-wrong");
        youFill.style.height = pct(score) + "%";
        youNum.textContent = score;
        if (pts) floatUp(root.querySelector(".sbar.you"), `+${pts}`);
        root.classList.toggle("is-ahead", score >= target);
      },
      onDone: () => { i++; next(); },
    });
    qEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function end() {
    root.classList.remove("is-running");
    const s = state();
    s.best = s.best || {};
    const newBest = score > (s.best[key] ?? -1);
    if (newBest) { s.best[key] = score; save(); }
    const beat = score >= target;
    qEl.innerHTML = `
      <div class="match-end ${beat ? "is-win" : "is-lose"}">
        <p class="end-kicker">${beat ? (best != null ? "打破紀錄！" : "達到目標！") : "這局沒過目標"}</p>
        <p class="end-score"><b>${score}</b> 分 <span class="muted">／滿分 ${maxScore}</span></p>
        <dl class="stats">
          <div><dt>答對</dt><dd>${right}／${n}</dd></div>
          <div><dt>盃數</dt><dd class="${trophies > 0 ? "up" : trophies < 0 ? "down" : ""}">${trophies > 0 ? "+" : ""}${trophies} 🏆</dd></div>
          <div><dt>${best != null ? "之前最佳" : "目標"}</dt><dd>${target}</dd></div>
          <div><dt>最快一題</dt><dd>${fastest(results)}</dd></div>
        </dl>
        ${newBest && best != null ? `<p class="up"><b>新的最佳紀錄：${score} 分</b></p>` : ""}
        <p class="actions"><button class="btn primary" data-again>再來一局</button><button class="btn" data-exit>結束</button></p>
      </div>`;
    qEl.querySelector("[data-again]").addEventListener("click", () => runMatch(container, ctx, opts));
    qEl.querySelector("[data-exit]").addEventListener("click", () => onExit?.({ score, right, n, trophies }));
    qEl.querySelector("[data-again]").focus({ preventScroll: true });
  }

  next();
}

/** 排題目：最後一題放目前段位能出的最難題目 */
function arrange(list, n, ctx) {
  const ok = list.filter((q) => ctx.game.difficultyUnlocked(q.difficulty || 1));
  const pool = ok.length ? ok : list;
  if (pool.length <= 1) return pool.slice(0, n);
  const take = pool.slice(0, n);
  const hardest = take.reduce((a, b) => ((b.difficulty || 1) > (a.difficulty || 1) ? b : a), take[take.length - 1]);
  return [...take.filter((q) => q !== hardest), hardest];
}

function fastest(results) {
  const t = results.filter((r) => r.correct && r.timeLeft != null).map((r) => r.seconds - r.timeLeft);
  return t.length ? `${Math.min(...t).toFixed(1)} 秒` : "—";
}

function floatUp(anchor, text) {
  const f = document.createElement("span");
  f.className = "float-pts";
  f.textContent = text;
  anchor.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}
