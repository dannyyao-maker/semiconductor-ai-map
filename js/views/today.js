// 今天（首頁）：下一步該做什麼、段位、連續天數、進行中的事件。
import { esc } from "../util.js";
import { rankCardHTML, streakCardHTML } from "../ui.js";

export function mountToday(root, ctx) {
  function render() {
    const s = ctx.state();
    const next = ctx.nextChapter();
    const events = ctx.activeEvents();
    const first = !s.onboarded;
    root.innerHTML = `
      <div class="view-head"><div><h1>今天</h1><p class="muted">${esc(ctx.game.dayKey())}</p></div></div>
      <div class="today-grid">
        <section class="panel hero">
          ${first ? `
            <p class="kicker">第一次來？</p>
            <h2>先花 3 分鐘看全景</h2>
            <p>你每天用的 ChatGPT，背後有 11 個產業環節在賺錢。先看一遍錢怎麼流，不考試、不用記。</p>
            <a class="btn primary" href="#/explore/intro">開始全景開場</a>` : next ? `
            <p class="kicker">繼續學習</p>
            <h2>${esc(next.name)} <span class="en">${esc(next.nameEn)}</span></h2>
            <p>${esc(next.stateLabel)}</p>
            <a class="btn primary" href="#/explore/${esc(next.id)}">${next.started ? "繼續這一章" : "開始這一章"}</a>` : `
            <p class="kicker">目前的章節都完成了</p>
            <h2>回研究總部複習</h2>
            <a class="btn primary" href="#/hq">打開研究總部</a>`}
        </section>
        <section class="panel">${rankCardHTML(ctx, { compact: true })}</section>
        <section class="panel">${streakCardHTML(ctx)}</section>
        <section class="panel">
          <h2 class="panel-title">🚨 進行中的事件</h2>
          ${events.length ? `<ul class="plain">${events.map((ev) => `
            <li><a href="#/events/${esc(ev.id)}">${esc(ev.title)}</a> <span class="muted small">${esc(ev.date)}</span></li>`).join("")}</ul>`
            : `<p class="muted">目前沒有進行中的事件。有重大事件時，這裡會出現任務。</p>`}
        </section>
      </div>`;
  }
  render();
  const off = ctx.onState(render);
  return { update: render, unmount: off };
}
