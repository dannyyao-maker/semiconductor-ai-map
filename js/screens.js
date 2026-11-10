// 章節裡的各種畫面：情境（story）、探索選擇（choice）、數字重點（stat）、排名長條（bars）、
// 公司對比（compare）、上下游（flow）。格式見 data/README.md。計分題（quiz）由 quiz.js 處理。
import { esc } from "./util.js";
import { sourceLinks } from "./card.js";
import { chartHTML, bindCharts, CHART_TYPES } from "./charts.js";

// 全景開場的路線順序：從設計一路走到 AI 應用
export const JOURNEY = ["ic-design", "equipment", "foundry", "memory", "packaging", "ai-chip", "ai-server", "datacenter", "cloud", "model", "ai-app"];

/**
 * 把一張畫面畫進 el。ready() 在使用者可以按「下一步」時呼叫
 * （探索選擇要先選一個，其他畫面馬上可以）。
 */
export function renderScreen(el, s, ctx, ready) {
  const T = ctx.textify();
  const src = s.sources?.length ? `<p class="claim-meta">${sourceLinks(s.sources, ctx)}</p>` : "";
  let html = "";
  if (s.type === "story") {
    html = `${s.node ? chainStrip(ctx, s.node) : ""}
      <div class="scr-story">${s.speaker ? `<p class="scr-speaker">${esc(s.speaker)}</p>` : ""}<p class="scr-text">${T(s.text)}</p></div>${src}`;
  } else if (s.type === "choice") {
    html = `<p class="scr-prompt">${T(s.prompt)}</p>
      <div class="scr-choices">${s.options.map((o, i) => `<button class="scr-choice" data-i="${i}">${esc(o.label)}</button>`).join("")}</div>
      <div class="scr-reveal" aria-live="polite"></div>
      <p class="hint">探索題：選哪個都不扣分，看看每個選項的說明。</p>`;
  } else if (s.type === "stat") {
    html = `<p class="scr-title">${T(s.title)}</p>
      <dl class="scr-stat">${s.items.map((it) => `<div><dt>${esc(it.label)}</dt><dd><b>${T(it.value)}</b>${it.note ? `<span>${T(it.note)}</span>` : ""}</dd></div>`).join("")}</dl>${src}`;
  } else if (s.type === "bars") {
    const max = Math.max(...s.items.map((it) => it.value));
    html = `<p class="scr-title">${esc(s.title)}</p>
      <ol class="scr-bars">${s.items.map((it, i) => `<li class="${it.tw ? "is-tw" : ""}" style="--w:${(it.value / max) * 100}%;--d:${i * 60}ms">
        <span class="bar-label">${i + 1}. ${esc(it.label)}${it.tw ? ` <small>台灣</small>` : ""}</span>
        <span class="bar-track"><span class="bar-fill"></span></span>
        <span class="bar-value">${esc(it.note || it.value.toLocaleString())}</span></li>`).join("")}</ol>${src}`;
  } else if (s.type === "compare") {
    const cos = s.companies.map((id) => ctx.companyById[id]);
    html = `<p class="scr-title">${esc(s.title)}</p>
      <div class="scr-compare">${cos.map((c, ci) => `<div class="cmp-card">
        <p class="cmp-name">${esc(c.name)} <span class="en">${esc(c.nameEn)}</span></p>
        <dl>${s.rows.map((r) => `<dt>${esc(r.label)}</dt><dd>${T(r.values[ci])}</dd>`).join("")}</dl>
        <a class="small" href="#/hq/${esc(c.segments[0])}/${esc(c.id)}">看公司小卡 →</a></div>`).join("")}</div>${src}`;
  } else if (s.type === "flow") {
    html = `<p class="scr-title">${esc(s.title)}</p>
      <ol class="scr-flow">${s.steps.map((st) => `<li class="${st.node && st.node === (s.here || "ic-design") ? "is-here" : ""}">
        <b>${esc(st.label)}</b><span>${T(st.note || "")}</span></li>`).join("")}</ol>
      <p class="hint">東西由上往下做出來，錢由下往上付回去。</p>`;
  }
  if (CHART_TYPES.includes(s.type)) html = chartHTML(s, T) + src;
  el.innerHTML = `<div class="scr scr-type-${esc(s.type)}">${html}</div>`;
  if (CHART_TYPES.includes(s.type)) bindCharts(el);

  if (s.type === "choice") {
    const rev = el.querySelector(".scr-reveal");
    el.querySelector(".scr-choices").addEventListener("click", (e) => {
      const b = e.target.closest(".scr-choice");
      if (!b) return;
      el.querySelectorAll(".scr-choice").forEach((x) => x.classList.toggle("is-picked", x === b));
      const o = s.options[Number(b.dataset.i)];
      rev.innerHTML = `<div class="reveal-box"><p>${T(o.reveal)}</p>${o.sources?.length || s.sources?.length ? `<p class="claim-meta">${sourceLinks(o.sources || s.sources, ctx)}</p>` : ""}</div>`;
      ready();
    });
  } else ready();
}

/** 全景開場上方的路線條：目前這一站亮起來，走過的站變實心 */
export function chainStrip(ctx, nodeId) {
  const at = JOURNEY.indexOf(nodeId);
  return `<ol class="chain" aria-label="產業鏈路線">${JOURNEY.map((id, i) => {
    const n = ctx.nodeById[id];
    const cls = nodeId === "all" ? "is-lit" : i === at ? "is-now" : i < at ? "is-past" : "";
    return `<li class="${cls} zone-${esc(n.zone)}" title="${esc(n.name)}"><span>${esc(n.name)}</span></li>`;
  }).join("")}</ol>`;
}
