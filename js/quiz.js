// 一題計分題：先出現題目 → 閱讀後出現四個選項 → 上方圓形時鐘開始倒數（青銅不計時）。
// 選完：對的格子變綠、選錯的格子變紅，下方附精簡解析和來源；時間到算答錯。
// 第一次作答才計分；段位升降時跳出提示。通常由 match.js 一局一局串起來。
import { esc } from "./util.js";
import { rankBadge } from "./game.js";
import { sourceLinks } from "./card.js";

const LETTERS = ["A", "B", "C", "D", "E"];
const RING = 2 * Math.PI * 26; // 時鐘圓圈的周長

/**
 * 在 container 裡畫一題。q 的格式見 data/README.md 的「題目」。
 * opts.seconds：作答秒數（0＝不計時）；opts.mult：答對的倍數（最後一題 2）；
 * opts.onAnswer(res)：作答當下呼叫（給分數條用）；opts.onDone(res)：按「繼續」時呼叫。
 */
export function renderQuiz(container, q, ctx, opts = {}) {
  const { seconds = 0, mult = 1, label = "", onAnswer, onDone, continueLabel = "繼續" } = opts;
  const T = ctx.textify();
  const prior = ctx.state().answers[q.id];
  const pv = ctx.game.preview(mult);
  const rm = ctx.config.readMs || { perChar: 60, min: 1200, max: 3500 };
  const readMs = Math.max(rm.min, Math.min(rm.max, String(q.prompt).length * rm.perChar));

  const stake = prior
    ? `<span class="stake practice">練習：已作答過，不計盃數</span>`
    : `<span class="stake">答對 <b class="up">+${pv.win}</b> 🏆　答錯 <b class="down">${pv.loss ? "−" + pv.loss : "不扣"}</b></span>`;

  container.innerHTML = `
    <div class="quiz is-reading${mult > 1 ? " is-final" : ""}" data-qid="${esc(q.id)}">
      <div class="quiz-top">
        <span class="quiz-label">${esc(label)}</span>
        <span class="clock${seconds ? "" : " is-untimed"}" role="timer" aria-label="剩下秒數">
          <svg viewBox="0 0 60 60" aria-hidden="true"><circle class="clock-bg" cx="30" cy="30" r="26"/>
            <circle class="clock-fg" cx="30" cy="30" r="26" stroke-dasharray="${RING}" stroke-dashoffset="0"/></svg>
          <b>${seconds || "∞"}</b></span>
        ${stake}
      </div>
      ${mult > 1 ? `<p class="final-banner">🔥 最後一題・最難的題目・分數和盃數 ×${mult}</p>` : ""}
      <p class="quiz-prompt">${T(q.prompt)}</p>
      <div class="quiz-read" aria-hidden="true"><span></span></div>
      <div class="quiz-options" role="group" aria-label="選項">
        ${q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}" disabled style="--d:${i * 70}ms">
          <span class="opt-letter">${LETTERS[i]}</span><span class="opt-text">${esc(o)}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join("")}
      </div>
      <div class="quiz-feedback" aria-live="polite"></div>
    </div>`;

  const box = container.querySelector(".quiz");
  const readBar = box.querySelector(".quiz-read span");
  const clockEl = box.querySelector(".clock");
  const clockNum = clockEl.querySelector("b");
  const ring = clockEl.querySelector(".clock-fg");
  let tick = null, start = 0, done = false;

  // 第 1 段：閱讀（細條從左長到右）
  readBar.style.transition = `width ${readMs}ms linear`;
  requestAnimationFrame(() => requestAnimationFrame(() => { readBar.style.width = "100%"; }));
  const readTimer = setTimeout(reveal, readMs);

  // 第 2 段：出現選項，時鐘開始倒數
  function reveal() {
    if (!box.isConnected) return;
    box.classList.replace("is-reading", "is-open");
    box.querySelector(".quiz-read").hidden = true;
    box.querySelectorAll(".quiz-opt").forEach((b) => { b.disabled = false; });
    box.querySelector(".quiz-opt")?.focus({ preventScroll: true });
    start = Date.now();
    if (!seconds) return;
    tick = setInterval(() => {
      if (!box.isConnected) return clearInterval(tick);
      const leftMs = Math.max(0, seconds * 1000 - (Date.now() - start));
      ring.style.strokeDashoffset = String(RING * (1 - leftMs / (seconds * 1000)));
      clockNum.textContent = Math.ceil(leftMs / 1000);
      box.classList.toggle("is-hurry", leftMs <= 3000);
      if (leftMs <= 0) finish(-1);
    }, 100);
  }

  function finish(pick) {
    if (done) return;
    done = true;
    clearTimeout(readTimer);
    clearInterval(tick);
    const used = start ? (Date.now() - start) / 1000 : seconds;
    const timeLeft = seconds ? Math.max(0, seconds - used) : null;
    const timeout = pick === -1;
    const correct = pick === q.answer;
    // 先標成「已作答」再計分：計分會通知頁面更新，頁面看到這個標記就不會把結果洗掉
    box.classList.remove("is-reading", "is-open", "is-hurry");
    box.classList.add("is-answered", correct ? "was-right" : "was-wrong");
    const res = { ...ctx.game.answer(q.id, correct, mult), timeout, timeLeft, seconds, mult };
    box.querySelectorAll(".quiz-opt").forEach((b, i) => {
      b.disabled = true;
      if (i === q.answer) { b.classList.add("is-correct"); b.querySelector(".opt-mark").textContent = "✓"; }
      else if (i === pick) { b.classList.add("is-wrong"); b.querySelector(".opt-mark").textContent = "✗"; }
      else b.classList.add("is-dim");
    });
    onAnswer?.(res);
    box.querySelector(".quiz-feedback").innerHTML = feedbackHTML(q, res, ctx, T, continueLabel);
    const cont = box.querySelector("[data-continue]");
    cont.addEventListener("click", () => onDone?.(res));
    cont.focus({ preventScroll: true });
    if (res.tierUp || res.tierDown || res.milestone) celebrate(res, ctx);
  }

  box.querySelector(".quiz-options").addEventListener("click", (e) => {
    const btn = e.target.closest(".quiz-opt");
    if (btn && !btn.disabled) finish(Number(btn.dataset.i));
  });
}

function feedbackHTML(q, res, ctx, T, continueLabel) {
  let score;
  if (res.practice) score = `<span class="score muted">練習：不加減盃數</span>`;
  else if (res.d > 0) score = `<span class="score up">+${res.d} 🏆${res.mult > 1 || res.double ? "（加倍）" : ""}</span>`;
  else if (res.d < 0) score = `<span class="score down">−${-res.d} 🏆</span>`;
  else score = `<span class="score muted">${res.floored ? "已到段位底線，不再往下掉" : "青銅不扣盃"}</span>`;
  const streak = res.streakUp ? `<span class="score streak">🔥 連續 ${res.streak} 天</span>` : "";
  const title = res.timeout ? "⏱ 時間到" : res.correct ? "✓ 答對了" : "✗ 答錯了";
  const right = !res.correct ? `<p class="fb-answer">正確答案：<b>${esc(q.options[q.answer])}</b></p>` : "";
  return `
    <p class="fb-title ${res.correct ? "ok" : "ng"}">${title} ${score} ${streak}</p>
    ${right}
    ${q.explain ? `<div class="fb-explain"><span class="fb-label">解析</span>${T(q.explain)}</div>` : ""}
    ${q.sources?.length ? `<p class="claim-meta">${sourceLinks(q.sources, ctx)}</p>` : ""}
    <button class="btn primary" data-continue>${esc(continueLabel)}</button>`;
}

/** 升級、降級、連續天數里程碑的提示框 */
export function celebrate(res, ctx) {
  const t = res.after;
  let title = "", body = "";
  if (res.rankUp) {
    const m = t.rank.match || {};
    title = `晉級 ${t.rank.name}！`;
    body = `之後一局 ${m.questions} 題${m.seconds ? `、每題 ${m.seconds} 秒` : ""}；答對加 ${t.rank.win} 盃、答錯扣 ${t.rank.loss} 盃，而且不會再掉回 ${res.before.rank.name}。`;
  } else if (res.tierUp) { title = `升到 ${t.label}`; body = `繼續答對，往 ${ctx.game.standing().next?.label || "頂點"} 前進。`; }
  else if (res.tierDown) { title = `掉到 ${t.label}`; body = "沒關係，看完解析，下次就記住了。"; }
  if (res.milestone) {
    title = title ? `${title}　🔥 ${res.milestone.days} 天` : `🔥 連續 ${res.milestone.days} 天！`;
    body = (body ? body + "\n" : "") + res.milestone.label;
  }
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `
    <div class="modal celebrate ${res.tierDown ? "is-down" : ""}" style="--rank:${esc(t.rank.color)}" role="dialog" aria-modal="true" aria-labelledby="cel-title">
      ${rankBadge(t, "xl")}
      <h2 id="cel-title">${esc(title)}</h2>
      ${body.split("\n").map((p) => `<p>${esc(p)}</p>`).join("")}
      <button class="btn primary" data-close-modal>好</button>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.closest("[data-close-modal]")) close(); });
  wrap.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  wrap.querySelector("[data-close-modal]").focus();
}
