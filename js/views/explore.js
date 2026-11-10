// 探索：章節清單。第一章是 IC 設計，其他章節在相鄰環節完成「認識」後解鎖。
// 網址：#/explore（清單）、#/explore/intro（全景開場）、#/explore/ic-design（章節）
import { esc } from "../util.js";

const STATE_TEXT = { locked: "🔒 尚未解鎖", soon: "內容製作中", open: "可以開始", started: "進行中", done: "✓ 完成" };

export function mountExplore(root, ctx, initial) {
  function list() {
    const items = ctx.chapterList();
    root.innerHTML = `
      <div class="view-head"><div><h1>探索</h1>
        <p class="muted">從 IC 設計出發，一章一章往相鄰的環節走。完成一章的「認識」，相鄰的環節就會解鎖。</p></div></div>
      <ol class="chapter-list">
        ${items.map((c, i) => `
          <li class="chapter-item is-${c.state} zone-${esc(c.zone)}">
            <span class="ch-no">${i + 1}</span>
            <div class="ch-body">
              <p class="ch-name">${esc(c.name)} <span class="en">${esc(c.nameEn)}</span></p>
              <p class="muted small">${c.state === "locked" ? `先完成相鄰環節：${esc(c.neighbors.join("、"))}` : esc(STATE_TEXT[c.state])}</p>
            </div>
            ${c.state === "locked" || c.state === "soon" ? `<span class="ch-state muted small">${esc(STATE_TEXT[c.state])}</span>`
              : `<a class="btn" href="#/explore/${esc(c.id)}">${c.state === "done" ? "複習" : c.state === "started" ? "繼續" : "開始"}</a>`}
          </li>`).join("")}
      </ol>`;
  }

  function placeholder(title, text) {
    root.innerHTML = `
      <div class="view-head"><div><p><a href="#/explore">← 探索</a></p><h1>${esc(title)}</h1></div></div>
      <section class="panel"><p>${esc(text)}</p></section>`;
  }

  function render(p) {
    const id = p[0];
    if (!id) return list();
    if (id === "intro") return placeholder("全景開場", "全景開場在第一階段的步驟 4 製作。");
    const n = ctx.nodeById[id];
    if (!n) return list();
    placeholder(n.name, "章節內容在第一階段的步驟 5 製作（IC 設計）。");
  }

  render(initial);
  const off = ctx.onState(() => { if (!location.hash.split("/")[2]) list(); });
  return { update: render, unmount: off };
}
