// 對局（仿知識王的一對一對戰）：全螢幕的對戰畫面。
// - 開局前有 3 秒倒數；一局幾回合、每題幾秒，依開局時的段位（data/game.json 的 match）
// - 對手是這個段位的電腦對手（rival）：依機率答對，作答時間隨機
// - 上方：你、刻度時鐘、對手；兩側是分數條，越早答對分數越高
// - 答錯整個畫面變紅、答對變綠；最後一題是段位能出的最難題目，分數和盃數都加倍
// - 盃數仍然一題一題算（見 game.js）；分數用來和對手比輸贏，並記錄最佳分數
import { esc } from "./util.js";
import { renderQuiz } from "./quiz.js";
import { rankBadge } from "./game.js";
import { state, save } from "./state.js";

/**
 * opts.key：對局代碼（記最佳紀錄）；opts.questions：題目陣列，或 opts.make(n) 產生 n 題；
 * opts.title：標題；opts.onExit(summary)：離開對局時呼叫。
 */
export function runMatch(_container, ctx, opts) {
  const { key, title = "對局", onExit } = opts;
  const st = ctx.game.standing();
  const rank = st.tier.rank;
  const m = rank.match || { questions: 4, seconds: 0 };
  const rival = rank.rival || { name: "電腦對手", accuracy: 0.6 };
  const sc = ctx.config.scoring || { base: 10, speed: 10, lastMultiplier: 2 };
  const qs = arrange(opts.questions || opts.make(m.questions), m.questions, ctx);
  const n = qs.length;
  const maxScore = (n - 1) * (sc.base + sc.speed) + (sc.base + sc.speed) * sc.lastMultiplier;
  const best = state().best?.[key] ?? null;
  let i = 0, you = 0, them = 0, right = 0, trophies = 0, botTimer = null, exited = false;
  const results = [];

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
    clearTimeout(botTimer);
    arena.remove();
    document.body.classList.remove("arena-open");
    onExit?.(summary);
  };

  // ---- 開局前的倒數 ----
  arena.innerHTML = `
    <div class="arena-intro">
      <p class="intro-stage">${esc(rank.en.toUpperCase())}</p>
      <p class="intro-title">${esc(title)}</p>
      <p class="intro-meta">${m.seconds ? `${m.seconds} 秒` : "不計時"}・${n} 回合</p>
      <div class="intro-vs">
        <div class="fighter">${avatar("你", rank)}<b>你</b><small>${esc(st.tier.label)}</small></div>
        <span class="vs">VS</span>
        <div class="fighter">${avatar(rival.avatar || rival.name.slice(0, 1), rank, true)}<b>${esc(rival.name)}</b><small>答對率約 ${Math.round(rival.accuracy * 100)}%</small></div>
      </div>
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
  }, 800);

  // ---- 對戰畫面 ----
  let qEl, clockHost, youFill, themFill, youNum, themNum, youCard, themCard, roundEl;
  function build() {
    arena.innerHTML = `
      <button class="arena-quit" aria-label="離開對局">✕</button>
      <div class="arena-top">
        <div class="player-card you">${avatar("你", rank)}<span>你</span><i class="mark"></i></div>
        <div class="arena-mid"><div class="arena-clock"></div><p class="arena-round"></p></div>
        <div class="player-card them">${avatar(rival.avatar || rival.name.slice(0, 1), rank, true)}<span>${esc(rival.name)}</span><i class="mark"></i></div>
      </div>
      <div class="arena-body">
        <div class="arena-bar you"><b>0</b><span class="track"><span class="fill"></span></span></div>
        <div class="arena-q"></div>
        <div class="arena-bar them"><b>0</b><span class="track"><span class="fill"></span></span></div>
      </div>`;
    qEl = arena.querySelector(".arena-q");
    clockHost = arena.querySelector(".arena-clock");
    roundEl = arena.querySelector(".arena-round");
    youFill = arena.querySelector(".arena-bar.you .fill");
    themFill = arena.querySelector(".arena-bar.them .fill");
    youNum = arena.querySelector(".arena-bar.you b");
    themNum = arena.querySelector(".arena-bar.them b");
    youCard = arena.querySelector(".player-card.you");
    themCard = arena.querySelector(".player-card.them");
    arena.querySelector(".arena-quit").addEventListener("click", () => {
      if (confirm("確定要離開這一局嗎？已經作答的題目盃數不會退回。")) close(null);
    });
  }

  const pct = (v) => Math.min(100, (v / maxScore) * 100);
  const points = (correct, speed, last) => (correct ? Math.round((sc.base + sc.speed * speed) * (last ? sc.lastMultiplier : 1)) : 0);

  function next() {
    if (exited) return;
    if (i >= n) return end();
    const last = i === n - 1;
    arena.classList.remove("is-right", "is-wrong");
    arena.classList.toggle("is-final", last);
    youCard.querySelector(".mark").className = "mark";
    themCard.querySelector(".mark").className = "mark is-thinking";
    roundEl.textContent = last ? `最後一題・×${sc.lastMultiplier}` : `第 ${i + 1}／${n} 回合`;
    // 對手：答對與否、作答時間都是隨機的
    const botRight = Math.random() < rival.accuracy;
    const botSpeed = 0.15 + Math.random() * 0.6; // 剩下 15%～75% 的時間時作答
    let botDone = false;
    const botAnswer = () => {
      if (botDone) return;
      botDone = true;
      const pts = points(botRight, m.seconds ? botSpeed : 0.5, last);
      them += pts;
      themFill.style.height = pct(them) + "%";
      themNum.textContent = them;
      themCard.querySelector(".mark").className = "mark is-answered";
      themCard.dataset.right = botRight ? "1" : "0";
      if (pts) floatUp(arena.querySelector(".arena-bar.them"), `+${pts}`);
    };

    renderQuiz(qEl, qs[i], ctx, {
      seconds: m.seconds, mult: last ? sc.lastMultiplier : 1, clockHost,
      continueLabel: last ? "看結果" : "下一回合",
      onReveal: () => {
        const ms = m.seconds ? (1 - botSpeed) * m.seconds * 1000 : 1500 + Math.random() * 4000;
        botTimer = setTimeout(botAnswer, ms);
      },
      onAnswer: (res) => {
        clearTimeout(botTimer);
        botAnswer(); // 你答完，對手如果還沒答就馬上公布
        const speed = res.seconds ? res.timeLeft / res.seconds : 0.5;
        const pts = points(res.correct, speed, last);
        you += pts;
        if (res.correct) right++;
        if (!res.practice) trophies += res.d;
        results.push({ ...res, pts });
        youFill.style.height = pct(you) + "%";
        youNum.textContent = you;
        if (pts) floatUp(arena.querySelector(".arena-bar.you"), `+${pts}`);
        arena.classList.add(res.correct ? "is-right" : "is-wrong");
        youCard.querySelector(".mark").className = `mark ${res.correct ? "is-ok" : "is-ng"}`;
        themCard.querySelector(".mark").className = `mark ${themCard.dataset.right === "1" ? "is-ok" : "is-ng"}`;
      },
      onDone: () => { i++; next(); },
    });
  }

  function end() {
    clearTimeout(botTimer);
    arena.classList.remove("is-right", "is-wrong", "is-final");
    const s = state();
    s.best = s.best || {};
    const newBest = you > (s.best[key] ?? -1);
    if (newBest) { s.best[key] = you; save(); }
    const result = you > them ? "win" : you < them ? "lose" : "draw";
    arena.classList.add(`is-${result}`);
    clockHost.innerHTML = "";
    roundEl.textContent = "對局結束";
    qEl.innerHTML = `
      <div class="match-end">
        <p class="end-kicker">${{ win: "🏆 你贏了！", lose: "這局輸了", draw: "平手" }[result]}</p>
        <p class="end-score"><b>${you}</b> <span>：</span> <b>${them}</b></p>
        <p class="end-names"><span>你</span><span>${esc(rival.name)}</span></p>
        <dl class="stats">
          <div><dt>答對</dt><dd>${right}／${n}</dd></div>
          <div><dt>盃數</dt><dd class="${trophies > 0 ? "up" : trophies < 0 ? "down" : ""}">${trophies > 0 ? "+" : ""}${trophies} 🏆</dd></div>
          <div><dt>最快一題</dt><dd>${fastest(results)}</dd></div>
          <div><dt>最佳分數</dt><dd>${Math.max(you, best ?? 0)}${newBest && best != null ? "（新紀錄）" : ""}</dd></div>
        </dl>
        <p class="actions"><button class="btn primary" data-again>再來一局</button><button class="btn" data-exit>結束</button></p>
      </div>`;
    qEl.querySelector("[data-again]").addEventListener("click", () => { exited = true; arena.remove(); runMatch(_container, ctx, opts); });
    qEl.querySelector("[data-exit]").addEventListener("click", () => close({ you, them, right, n, trophies, result }));
    qEl.querySelector("[data-again]").focus({ preventScroll: true });
  }
}

function avatar(text, rank, rival = false) {
  return `<span class="avatar${rival ? " rival" : ""}" style="--rank:${esc(rank.color)}">${esc(text)}</span>`;
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

function floatUp(anchor, text) {
  const f = document.createElement("span");
  f.className = "float-pts";
  f.textContent = text;
  anchor.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}
