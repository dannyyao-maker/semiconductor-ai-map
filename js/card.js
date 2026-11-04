// 環節卡與公司小卡：把 data/ 的內容排成卡片。

const COUNTRY = { TW: "台灣", US: "美國", KR: "韓國", CN: "中國", JP: "日本", NL: "荷蘭" };

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const statusTag = (status) =>
  status ? `<span class="status status-${esc(status)}" title="內容狀態">${esc(status)}</span>` : "";

function section(title, en, body) {
  return `<section class="card-section"><h3>${title} <span class="en">${en}</span></h3>${body}</section>`;
}

// 上下游：有對應環節的項目做成可點的連結
function flowList(items, ctx) {
  if (!items?.length) return `<p class="empty">尚未填寫</p>`;
  return `<ul class="flow-list">${items.map((it) => {
    const node = it.node && ctx.nodeById[it.node];
    const label = node
      ? `<button class="link" data-goto-node="${esc(node.id)}">${esc(node.name)}</button>`
      : "";
    return `<li>${label}${label && it.text ? "：" : ""}${esc(it.text || "")}</li>`;
  }).join("")}</ul>`;
}

// 當前問題、熱門話題：每條附狀態與資料時間點
// 來源連結：每個來源顯示成一個小連結，滑過去看完整標題
function sourceLinks(ids, ctx) {
  const list = (ids || []).map((id) => ctx.sourceById[id]).filter(Boolean);
  if (!list.length) return "";
  return `<span class="src-links">來源：${list.map((s) =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title)}（${esc(s.asOf)}）">${esc(s.publisher)}${s.type === "官方" ? "" : `<small>·${esc(s.type)}</small>`}</a>`).join("、")}</span>`;
}

function claimList(items, ctx) {
  if (!items?.length) return `<p class="empty">尚未填寫</p>`;
  return `<ul class="claim-list">${items.map((it) => `
    <li><span class="claim-text">${esc(it.text)}</span>
      <span class="claim-meta">${statusTag(it.status)}${it.asOf ? `<span class="asof">asOf ${esc(it.asOf)}</span>` : ""}${sourceLinks(it.sources, ctx)}</span></li>`).join("")}</ul>`;
}

function companyChips(ids, ctx) {
  const list = (ids || []).map((id) => ctx.companyById[id]).filter(Boolean);
  if (!list.length) return `<p class="empty">尚未填寫</p>`;
  const groups = [
    ["台灣", list.filter((c) => c.country === "TW")],
    ["國際", list.filter((c) => c.country !== "TW")],
  ].filter(([, l]) => l.length);
  return groups.map(([label, l]) => `
    <div class="chip-group"><span class="chip-label">${label}</span>
      ${l.map((c) => `<button class="chip" data-company="${esc(c.id)}">${esc(c.name)}<span class="en">${esc(c.nameEn)}</span></button>`).join("")}
    </div>`).join("");
}

function header(zone, title, en, status, extra = "") {
  return `
    <header class="card-header">
      ${extra}
      <div class="card-kicker zone-${esc(zone.id)}">${esc(zone.name)}</div>
      <h2 id="card-title" tabindex="-1">${esc(title)} <span class="en">${esc(en)}</span></h2>
      ${statusTag(status)}
      <button class="close" data-close aria-label="關閉卡片">×</button>
    </header>`;
}

/** 環節卡 */
export function nodeCardHTML(node, ctx) {
  const zone = ctx.zoneById[node.zone];
  if (!node.oneLiner) {
    return header(zone, node.name, node.nameEn, "") + `
      <div class="card-body"><div class="placeholder">
        <p><strong>內容準備中</strong></p>
        <p>這個環節的環節卡會在階段 2 補上。目前完成的示範卡：</p>
        <p>${ctx.nodes.filter((n) => n.oneLiner).map((n) => `<button class="chip" data-goto-node="${esc(n.id)}">${esc(n.name)}</button>`).join("")}</p>
      </div></div>`;
  }
  const b = node.business || {};
  return header(zone, node.name, node.nameEn, node.status) + `
    <div class="card-body">
      <p class="lead">${esc(node.oneLiner)}</p>
      ${node.analogy ? `<div class="analogy"><span class="analogy-label">白話比喻</span>${esc(node.analogy)}</div>` : ""}
      ${section("上游與下游", "Upstream & Downstream", `
        <div class="flow"><div><h4>跟誰買（上游）</h4>${flowList(node.upstream, ctx)}</div>
        <div><h4>賣給誰（下游）</h4>${flowList(node.downstream, ctx)}</div></div>`)}
      ${section("代表公司", "Key Players", companyChips(node.companies, ctx) + `<p class="hint">點公司名稱，看它橫跨哪些環節</p>`)}
      ${section("怎麼賺錢", "Business Model", `
        <dl class="biz">
          <dt>商業模式</dt><dd>${esc(b.model || "尚未填寫")}</dd>
          <dt>利潤高低</dt><dd>${esc(b.margin || "尚未填寫")}</dd>
          <dt>議價能力</dt><dd>${esc(b.bargainingPower || "尚未填寫")}</dd>
        </dl>`)}
      ${section("當前問題", "Current Challenges", claimList(node.issues, ctx))}
      ${section("熱門話題", "Hot Topics", claimList(node.topics, ctx))}
      ${section("延伸閱讀", "Further Reading", node.reading?.length
        ? `<ul>${node.reading.map((id) => ctx.sourceById[id]).filter(Boolean).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>（${esc(s.publisher)}，${esc(s.asOf)}）</li>`).join("")}</ul>`
        : `<p class="empty">階段 3 用法說會、產業報告查證後補上來源連結。</p>`)}
    </div>`;
}

/** 公司小卡 */
export function companyCardHTML(company, fromNode, ctx) {
  const zone = ctx.zoneById[ctx.nodeById[company.segments[0]].zone];
  const back = fromNode
    ? `<button class="back link" data-goto-node="${esc(fromNode.id)}">← 回到「${esc(fromNode.name)}」</button>`
    : "";
  return header(zone, company.name, company.nameEn, company.status, back) + `
    <div class="card-body">
      <p class="company-country">${esc(COUNTRY[company.country] || company.country)}</p>
      <p class="lead">${esc(company.oneLiner)}</p>
      ${section("橫跨的環節", "Segments", `<p>${company.segments.map((id) => ctx.nodeById[id]).filter(Boolean)
        .map((n) => `<button class="chip chip-node zone-${esc(n.zone)}" data-goto-node="${esc(n.id)}">${esc(n.name)}</button>`).join("")}</p>
        <p class="hint">地圖上加亮的就是這家公司參與的環節</p>`)}
      ${section("護城河", "Moat", `<p>${esc(company.moat)}</p>`)}
      ${section("主要風險", "Key Risks", `<p>${esc(company.risks)}</p>`)}
      ${company.sources?.length ? `<p class="claim-meta">${sourceLinks(company.sources, ctx)}</p>` : ""}
      ${company.asOf ? `<p class="asof">asOf ${esc(company.asOf)}</p>` : ""}
    </div>`;
}
