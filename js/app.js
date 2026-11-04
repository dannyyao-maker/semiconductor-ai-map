// 啟動：讀取 data/ 的資料，串起地圖與卡片。
// 目前開的卡片記在網址最後面（例如 #foundry 或 #foundry/tsmc），所以可以直接分享某一張卡的連結。
import { renderMap, highlightMap } from "./map.js";
import { nodeCardHTML, companyCardHTML } from "./card.js";

const mapEl = document.getElementById("map");
const cardEl = document.getElementById("card");
const mobileQuery = window.matchMedia("(max-width: 720px)");
let ctx;

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}`);
  return res.json();
}

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

// 讀網址，決定現在要顯示哪一張卡
function parseHash() {
  const [nodeId, companyId] = decodeURIComponent(location.hash.slice(1)).split("/");
  const node = ctx.nodeById[nodeId] || null;
  const company = node && ctx.companyById[companyId] || null;
  return { node, company };
}

function go(hash) {
  if (location.hash.slice(1) === hash) return render();
  if (hash) location.hash = hash;
  else history.pushState(null, "", location.pathname + location.search);
  render();
}

function render() {
  const { node, company } = parseHash();
  if (!node) {
    cardEl.hidden = true;
    document.body.classList.remove("card-open");
    highlightMap(mapEl, {});
    return;
  }
  cardEl.innerHTML = company ? companyCardHTML(company, node, ctx) : nodeCardHTML(node, ctx);
  cardEl.hidden = false;
  cardEl.scrollTop = 0;
  document.body.classList.add("card-open");
  highlightMap(mapEl, { selected: node.id, companySegments: company?.segments });
  cardEl.querySelector("h2")?.focus({ preventScroll: true });
}

function drawMap() {
  renderMap(mapEl, ctx, {
    mobile: mobileQuery.matches,
    onSelect: (id) => go(id),
    onBackground: () => go(""),
  });
  render();
}

// 卡片裡的按鈕：關閉、跳到別的環節、打開公司小卡
cardEl.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.hasAttribute("data-close")) go("");
  else if (t.dataset.gotoNode) go(t.dataset.gotoNode);
  else if (t.dataset.company) go(`${parseHash().node.id}/${t.dataset.company}`);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !cardEl.hidden) go("");
});

async function main() {
  try {
    const [nodesData, companies, sources] = await Promise.all([
      loadJSON("data/nodes.json"),
      loadJSON("data/companies.json"),
      loadJSON("data/sources.json"),
    ]);
    ctx = {
      zones: nodesData.zones,
      nodes: nodesData.nodes,
      zoneById: byId(nodesData.zones),
      nodeById: byId(nodesData.nodes),
      companyById: byId(companies),
      sourceById: byId(sources),
    };
    drawMap();
    window.addEventListener("hashchange", render);
    window.addEventListener("popstate", render);
    mobileQuery.addEventListener("change", drawMap);
  } catch (err) {
    mapEl.innerHTML = `<p class="error">資料載入失敗：${err.message}。請用 <code>node tools/serve.mjs</code> 開啟，不要直接雙擊 HTML。</p>`;
  }
}

main();
