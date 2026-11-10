// 事件：進行中的事件任務，和過去的事件檔案。任務的內容在第一階段的步驟 8 製作。
import { esc } from "../util.js";

export function mountEvents(root, ctx, initial) {
  function render(p) {
    const ev = p[0] && ctx.events.find((e) => e.id === p[0]);
    if (ev) {
      root.innerHTML = `
        <div class="view-head"><div><p><a href="#/events">← 事件</a></p><h1>${esc(ev.title)}</h1><p class="muted">${esc(ev.date)}</p></div></div>
        <section class="panel"><p>${esc(ev.summary || "")}</p><p class="muted">事件任務的畫面在步驟 8 製作。</p></section>`;
      return;
    }
    const active = ctx.activeEvents();
    const archived = ctx.events.filter((e) => !active.includes(e));
    const li = (e) => `<li><a href="#/events/${esc(e.id)}">${esc(e.title)}</a> <span class="muted small">${esc(e.date)}${ctx.state().events[e.id]?.done ? "・✓ 已完成" : ""}</span></li>`;
    root.innerHTML = `
      <div class="view-head"><div><h1>事件</h1><p class="muted">重大事件發生時，這裡會出現任務：狀況簡報 → 地圖導覽 → 3 題。</p></div></div>
      <section class="panel"><h2 class="panel-title">🚨 進行中</h2>
        ${active.length ? `<ul class="plain">${active.map(li).join("")}</ul>` : `<p class="muted">目前沒有進行中的事件。</p>`}</section>
      <section class="panel"><h2 class="panel-title">事件檔案</h2>
        ${archived.length ? `<ul class="plain">${archived.map(li).join("")}</ul>` : `<p class="muted">還沒有歸檔的事件。</p>`}</section>`;
  }
  render(initial);
  return { update: render };
}
