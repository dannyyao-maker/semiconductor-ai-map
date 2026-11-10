// 計分題：先出現題目 → 閱讀幾秒後出現四個選項 → 開始倒數（青銅不計時）。
// 選完：對的格子變綠、選錯的格子變紅，下方附精簡解析和來源；時間到算答錯。
// 第一次作答才計分；段位升降時跳出提示。
import { esc } from "./util.js";
import { rankBadge } from "./game.js";
import { sourceLinks } from "./card.js";

const LETTERS = ["A", "B", "C", "D", "E"];

/**
 * 在 container 裡畫一題。q 的格式見 data/README.md 的「題目」。
 * onDone(result) 在使用者按「繼續」時呼叫。
 */
export function renderQuiz(container, q, ctx, { onDone, continueLabel = "繼續" } = {}) {
  const T = ctx.textify();
  const prior = ctx.state().answers[q.id];
  const pv = ctx.game.preview();
  const seconds = prior ? 0 : ctx.game.standing().tier.rank.timer || 0;
  const rm = ctx.config.readMs || { perChar: 60, min: 1200, max: 3500 };
  const readMs = Math.max(rm.min, Math.min(rm.max, String(q.prompt).length * rm.perChar));

  const stake = prior
    ? `<span class="stake practice">練習題：已經作答過，不再計分</span>`
    : `<span class="stake">答對 <b class="up">+${pv.win}</b> 🏆　答錯 <b class="down">${pv.loss ? "−" + pv.loss : "不扣"}</b>${pv.double ? `　<span class="double">🔥 今天加倍</span>` : ""}</span>`;

  container.innerHTML = `
    <div class="quiz is-reading" data-qid="${esc(q.id)}">
      <p class="quiz-head"><span class="quiz-tag">計分題</span>${stake}
        ${seconds ? `<span class="quiz-clock" aria-live="off">⏱ <b>${seconds}</b> 秒</span>` : ""}</p>
      <p class="quiz-prompt">${T(q.prompt)}</p>
      <div class="quiz-timer${seconds ? "" : " is-reading-only"}" aria-hidden="true"><span></span></div>
      <div class="quiz-options" role="group" aria-label="選項">
        ${q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}" disabled style="--d:${i * 70}ms">
          <span class="opt-letter">${LETTERS[i]}</span><span class="opt-text">${T(o)}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join("")}
      </div>
      <div class="quiz-feedback" aria-live="polite"></div>
    </div>`;

  const box = container.querySelector(".quiz");
  const bar = box.querySelector(".quiz-timer span");
  const clock = box.querySelector(".quiz-clock b");
  let tick = null;
  let done = false;

  // 第 1 段：閱讀時間（進度條從左長到右）
  bar.style.transition = `width ${readMs}ms linear`;
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = "100%"; }));
  const readTimer = setTimeout(reveal, readMs);

  // 第 2 段：出現選項，開始倒數（進度條從滿縮到空）
  function reveal() {
    if (!box.isConnected) return;
    box.classList.remove("is-reading");
    box.classList.add("is-open");
    box.querySelectorAll(".quiz-opt").forEach((b) => { b.disabled = false; });
    box.querySelector(".quiz-opt")?.focus({ preventScroll: true });
    if (!seconds) { bar.parentElement.hidden = true; return; }
    bar.style.transition = "none";
    bar.style.width = "100%";
    bar.parentElement.classList.add("is-counting");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bar.style.transition = `width ${seconds}s linear`;
      bar.style.width = "0%";
    }));
    const end = Date.now() + seconds * 1000;
    tick = setInterval(() => {
      if (!box.isConnected) return clearInterval(tick);
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      clock.textContent = left;
      box.classList.toggle("is-hurry", left <= 5);
      if (left <= 0) finish(-1);
    }, 200);
  }

  function finish(pick) {
    if (done) return;
    done = true;
    clearTimeout(readTimer);
    clearInterval(tick);
    const timeout = pick === -1;
    const correct = pick === q.answer;
    // 先標成「已作答」再計分：計分會通知頁面更新，頁面看到這個標記就不會把結果洗掉
    box.classList.remove("is-reading", "is-open", "is-hurry");
    box.classList.add("is-answered", correct ? "was-right" : "was-wrong");
    const res = { ...ctx.game.answer(q.id, correct), timeout };
    bar.parentElement.hidden = true;
    if (clock) clock.parentElement.hidden = true;
    box.querySelectorAll(".quiz-opt").forEach((b, i) => {
      b.disabled = true;
      if (i === q.answer) { b.classList.add("is-correct"); b.querySelector(".opt-mark").textContent = "✓"; }
      else if (i === pick) { b.classList.add("is-wrong"); b.querySelector(".opt-mark").textContent = "✗"; }
      else b.classList.add("is-dim");
    });
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
  else if (res.d > 0) score = `<span class="score up">+${res.d} 🏆${res.double ? "（加倍）" : ""}</span>`;
  else if (res.d < 0) score = `<span class="score down">−${-res.d} 🏆</span>`;
  else score = `<span class="score muted">${res.floored ? "已到段位底線，不再往下掉" : "青銅不扣盃"}</span>`;
  const streak = res.streakUp ? `<span class="score streak">🔥 連續 ${res.streak} 天</span>` : "";
  const title = res.timeout ? "⏱ 時間到" : res.correct ? "✓ 答對了" : "✗ 答錯了";
  return `
    <p class="fb-title ${res.correct ? "ok" : "ng"}">${title} ${score} ${streak}</p>
    ${q.explain ? `<div class="fb-explain"><span class="fb-label">解析</span>${T(q.explain)}</div>` : ""}
    ${q.sources?.length ? `<p class="claim-meta">${sourceLinks(q.sources, ctx)}</p>` : ""}
    <button class="btn primary" data-continue>${esc(continueLabel)}</button>`;
}

/** 升級、降級、連續天數里程碑的提示框 */
function celebrate(res, ctx) {
  const t = res.after;
  let title = "", body = "";
  if (res.rankUp) { title = `晉級 ${t.rank.name}！`; body = `之後答對加 ${t.rank.win} 盃、答錯扣 ${t.rank.loss} 盃${t.rank.timer ? `，每題 ${t.rank.timer} 秒` : ""}，而且不會再掉回 ${res.before.rank.name}。`; }
  else if (res.tierUp) { title = `升到 ${t.label}`; body = `繼續答對，往 ${ctx.game.standing().next?.label || "頂點"} 前進。`; }
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
