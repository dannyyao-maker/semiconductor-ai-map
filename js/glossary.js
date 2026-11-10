// 術語：在卡片文字裡自動標出專有名詞，點了顯示白話解釋。
import { esc } from "./util.js";

/** 建立「標術語」的函式。同一張卡片裡，每個術語只標第一次出現的地方，避免畫面太亂。 */
export function makeGlossifier(glossary) {
  const pairs = glossary
    .flatMap((t) => t.aliases.map((a) => [a, t.id]))
    .sort((a, b) => b[0].length - a[0].length);
  const idByAlias = Object.fromEntries(pairs);
  const pattern = pairs
    .map(([a]) => {
      const s = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // 英文縮寫前後不能緊接英文字母，避免把 CAPEX 裡的 API 誤標
      return /^[A-Za-z0-9-]+$/.test(a) ? `(?<![A-Za-z])${s}(?![A-Za-z])` : s;
    })
    .join("|");
  const re = new RegExp(pattern, "g");
  /** text 必須是已經跳脫過的 HTML 文字；used 是這張卡已經標過的術語 */
  return (text, used) =>
    text.replace(re, (m) => {
      const id = idByAlias[m];
      if (!id || used.has(id)) return m;
      used.add(id);
      return `<button type="button" class="term" data-term="${id}">${m}</button>`;
    });
}

let pop;
/** 在術語旁邊顯示解釋框 */
export function showTerm(anchor, term, ctx) {
  hideTerm();
  pop = document.createElement("div");
  pop.className = "term-pop";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", `${term.term} 的解釋`);
  const node = term.node && ctx.nodeById[term.node];
  const srcs = (term.sources || []).map((id) => ctx.sourceById[id]).filter(Boolean);
  pop.innerHTML = `
    <button class="close" data-term-close aria-label="關閉解釋">×</button>
    <p class="term-title">${esc(term.term)} <span class="en">${esc(term.en)}</span></p>
    <p>${esc(term.short)}</p>
    ${term.dictId ? `<p class="term-node"><a href="#/dict/${esc(term.dictId)}">在指標字典看更多 →</a></p>` : ""}
    ${node ? `<p class="term-node">相關環節：<button class="link" data-goto-node="${esc(node.id)}">${esc(node.name)}</button></p>` : ""}
    ${srcs.length ? `<p class="src-links">來源：${srcs.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a>`).join("、")}</p>` : ""}`;
  document.body.appendChild(pop);
  // 放在術語下方；超出畫面就改放上方，並且不超出左右邊界
  const r = anchor.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  pop.style.width = w + "px";
  const left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
  pop.style.left = left + "px";
  const h = pop.offsetHeight;
  const below = r.bottom + 8;
  pop.style.top = (below + h > window.innerHeight - 12 ? Math.max(12, r.top - h - 8) : below) + "px";
  pop.querySelector("[data-term-close]").focus({ preventScroll: true });
}

export function hideTerm() {
  pop?.remove();
  pop = null;
}

export const termPopOpen = () => Boolean(pop);
export const termPopEl = () => pop;
