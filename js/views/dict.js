// 指標字典：常用財務指標的定義、公式、偏高偏低代表什麼，以及在半導體與 AI 產業的特殊情況。
// 網址：#/dict（全部）、#/dict/gross-margin（直接打開某一個指標）
import { esc } from "../util.js";
import { sourceLinks } from "../card.js";

const ORDER = ["獲利能力", "成長", "財務結構", "經營效率", "估值"];

export function mountDict(root, ctx, initial) {
  const T = () => ctx.textify();
  let filter = "";

  function card(m, open) {
    const t = T();
    const nodes = (m.related || []).map((id) => ctx.nodeById[id]).filter(Boolean);
    return `
      <details class="metric" id="m-${esc(m.id)}" ${open ? "open" : ""}>
        <summary><span class="m-name">${esc(m.name)}</span> <span class="en">${esc(m.en)}${m.abbr ? `（${esc(m.abbr)}）` : ""}</span></summary>
        <div class="m-body">
          <p class="m-formula"><span>公式</span>${esc(m.formula)}</p>
          <p><b>在看什麼：</b>${t(m.meaning)}</p>
          <p><b>偏高／偏低：</b>${t(m.highLow)}</p>
          <div class="m-semi"><span class="analogy-label">在半導體與 AI 產業</span>${t(m.semiNote)}</div>
          ${nodes.length ? `<p class="m-related">最常看這個指標的環節：${nodes.map((n) => `<a class="chip chip-node zone-${esc(n.zone)}" href="#/hq/${esc(n.id)}">${esc(n.name)}</a>`).join("")}</p>` : ""}
          ${m.sources?.length ? `<p class="claim-meta">${sourceLinks(m.sources, ctx)}</p>` : ""}
        </div>
      </details>`;
  }

  function render(p = []) {
    const openId = p[0];
    const q = filter.trim().toLowerCase();
    const list = ctx.metrics.filter((m) => !q || [m.name, m.en, m.abbr, m.category].join(" ").toLowerCase().includes(q));
    const groups = ORDER.map((c) => [c, list.filter((m) => m.category === c)]).filter(([, l]) => l.length);
    root.innerHTML = `
      <div class="view-head"><div><p><a href="#/hq">← 研究總部</a></p><h1>指標字典</h1>
        <p class="muted">${ctx.metrics.length} 個常用財務指標。不教財務基礎，只講重點，以及在半導體與 AI 產業要注意的地方。</p></div>
        <div class="search-box"><input type="search" class="dict-search" placeholder="找指標（例：EPS、毛利率、本益比）" value="${esc(filter)}" aria-label="搜尋指標"></div></div>
      ${groups.length ? groups.map(([c, l]) => `
        <section class="dict-group"><h2 class="panel-title">${esc(c)}</h2>${l.map((m) => card(m, m.id === openId || Boolean(q))).join("")}</section>`).join("")
        : `<p class="muted">找不到「${esc(filter)}」。</p>`}
      <p class="muted small">本益比等跟股價有關的數字每季更新一次，只當學習參考，不構成投資建議。</p>`;
    const input = root.querySelector(".dict-search");
    input.addEventListener("input", () => {
      filter = input.value;
      const pos = input.selectionStart;
      render([]);
      const again = root.querySelector(".dict-search");
      again.focus();
      again.setSelectionRange(pos, pos);
    });
    if (openId) requestAnimationFrame(() => root.querySelector(`#m-${CSS.escape(openId)}`)?.scrollIntoView({ block: "start" }));
  }

  render(initial);
  return { update: render };
}

/** 把指標變成「術語」，讓卡片文字裡的指標名稱也能點了看解釋 */
export function metricsAsTerms(metrics) {
  return metrics.map((m) => ({
    id: `metric:${m.id}`,
    term: m.name,
    en: m.en,
    aliases: [m.name, ...(m.abbr && m.abbr.length >= 3 ? [m.abbr] : [])],
    short: `${m.meaning} 公式：${m.formula}`,
    node: m.related?.[0],
    sources: m.sources || [],
    dictId: m.id,
  }));
}
