// 啟動：讀取 data/ 的資料，串起地圖、卡片、搜尋、術語、已讀進度和導覽。
// 目前開的卡片記在網址最後面（例如 #foundry 或 #foundry/tsmc），所以可以直接分享某一張卡的連結。
import { renderMap, highlightMap, markRead } from "./map.js";
import { nodeCardHTML, companyCardHTML } from "./card.js";
import { makeGlossifier, showTerm, hideTerm, termPopOpen, termPopEl } from "./glossary.js";
import { setupSearch } from "./search.js";
import { setupTour } from "./tour.js";
import { store, toast } from "./util.js";

const mapEl = document.getElementById("map");
const cardEl = document.getElementById("card");
const progressBtn = document.getElementById("progress");
const mobileQuery = window.matchMedia("(max-width: 720px)");
const READ_KEY = "semimap.read";
let ctx;

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}`);
  return res.json();
}

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

// ---- 已讀進度（存在瀏覽器） ----
const readIds = () => store.get(READ_KEY, []).filter((id) => ctx.nodeById[id]);
function toggleRead(id) {
  const ids = readIds();
  const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  store.set(READ_KEY, next);
  toast(next.includes(id) ? `已標記「${ctx.nodeById[id].name}」為讀懂了` : `已取消「${ctx.nodeById[id].name}」的標記`);
  updateProgress();
  render();
}
function updateProgress() {
  const ids = readIds();
  progressBtn.textContent = `已讀 ${ids.length}／${ctx.nodes.length}`;
  progressBtn.title = "點一下複製已讀清單，可以貼給 Claude Code 更新審核狀態";
  markRead(mapEl, ids);
}
async function copyProgress() {
  const ids = readIds();
  if (!ids.length) return toast("還沒有標記任何環節。讀懂一張卡後，按卡片最下面的「我讀懂了」。");
  const text = `我讀懂了這些環節：${ids.map((id) => `${ctx.nodeById[id].name}（${id}）`).join("、")}`;
  try { await navigator.clipboard.writeText(text); toast("已複製已讀清單，貼給 Claude Code 就能更新審核狀態"); }
  catch { toast(text); }
}

// ---- 卡片與網址 ----
function parseHash() {
  const [nodeId, companyId] = decodeURIComponent(location.hash.slice(1)).split("/");
  const node = ctx.nodeById[nodeId] || null;
  const company = (node && ctx.companyById[companyId]) || null;
  return { node, company };
}

function go(hash) {
  hideTerm();
  if (location.hash.slice(1) === hash) return render();
  if (hash) location.hash = hash;
  else { history.pushState(null, "", location.pathname + location.search); render(); }
}

function render() {
  const { node, company } = parseHash();
  if (!node) {
    cardEl.hidden = true;
    document.body.classList.remove("card-open");
    highlightMap(mapEl, {});
    return;
  }
  const scroll = cardEl.dataset.showing === location.hash ? cardEl.scrollTop : 0;
  cardEl.innerHTML = company ? companyCardHTML(company, node, ctx) : nodeCardHTML(node, ctx);
  cardEl.hidden = false;
  cardEl.scrollTop = scroll;
  cardEl.dataset.showing = location.hash;
  document.body.classList.add("card-open");
  highlightMap(mapEl, { selected: node.id, companySegments: company?.segments });
  if (!scroll) cardEl.querySelector("h2")?.focus({ preventScroll: true });
}

function drawMap() {
  renderMap(mapEl, ctx, {
    mobile: mobileQuery.matches,
    onSelect: (id) => go(id),
    onBackground: () => go(""),
  });
  updateProgress();
  render();
}

// 卡片裡的按鈕：關閉、跳到別的環節、打開公司小卡、術語、已讀
cardEl.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.term) return showTerm(t, ctx.glossaryById[t.dataset.term], ctx);
  if (t.hasAttribute("data-close")) go("");
  else if (t.dataset.gotoNode) go(t.dataset.gotoNode);
  else if (t.dataset.company) go(`${parseHash().node.id}/${t.dataset.company}`);
  else if (t.dataset.read) toggleRead(t.dataset.read);
});

// 術語解釋框裡的按鈕，以及點外面關閉
document.addEventListener("click", (e) => {
  if (!termPopOpen()) return;
  const pop = termPopEl();
  const t = e.target.closest("button");
  if (pop.contains(e.target)) {
    if (t?.hasAttribute("data-term-close")) hideTerm();
    else if (t?.dataset.gotoNode) go(t.dataset.gotoNode);
    return;
  }
  if (!t?.dataset.term) hideTerm();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (termPopOpen()) hideTerm();
  else if (!cardEl.hidden) go("");
});
window.addEventListener("resize", hideTerm);
cardEl.addEventListener("scroll", hideTerm, { passive: true });

async function main() {
  try {
    const [nodesData, companies, sources, glossary] = await Promise.all([
      loadJSON("data/nodes.json"),
      loadJSON("data/companies.json"),
      loadJSON("data/sources.json"),
      loadJSON("data/glossary.json"),
    ]);
    ctx = {
      zones: nodesData.zones,
      nodes: nodesData.nodes,
      companies,
      glossary,
      zoneById: byId(nodesData.zones),
      nodeById: byId(nodesData.nodes),
      companyById: byId(companies),
      sourceById: byId(sources),
      glossaryById: byId(glossary),
      glossify: makeGlossifier(glossary),
      isRead: (id) => readIds().includes(id),
    };
    drawMap();
    progressBtn.addEventListener("click", copyProgress);
    setupSearch(document.getElementById("search"), document.getElementById("search-results"), ctx, (r) => {
      if (r.kind === "環節") go(r.id);
      else if (r.kind === "公司") go(`${ctx.companyById[r.id].segments[0]}/${r.id}`);
      else showTerm(document.getElementById("search"), ctx.glossaryById[r.id], ctx);
    });
    setupTour(document.getElementById("tour-btn"));
    window.addEventListener("hashchange", render);
    window.addEventListener("popstate", render);
    mobileQuery.addEventListener("change", drawMap);
  } catch (err) {
    mapEl.innerHTML = `<p class="error">資料載入失敗：${err.message}。請用 <code>node tools/serve.mjs</code> 開啟，不要直接雙擊 HTML。</p>`;
    console.error(err);
  }
}

main();
