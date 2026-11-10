// 啟動：讀取 data/ 的資料，建立共用的 ctx，再依網址切換五個頁面。
// 網址格式：#/today、#/explore/ic-design、#/hq/foundry/tsmc、#/events/<事件代碼>、#/me
// 舊網址（#foundry、#foundry/tsmc）會自動轉到研究總部，之前分享出去的連結不會壞。
import { makeGlossifier, showTerm, hideTerm, termPopOpen, termPopEl } from "./glossary.js";
import { makeT } from "./card.js";
import { makeGame, rankBadge } from "./game.js";
import { load, state, onChange } from "./state.js";
import { esc } from "./util.js";
import { mountToday } from "./views/today.js";
import { mountExplore } from "./views/explore.js";
import { mountHQ } from "./views/hq.js";
import { mountEvents } from "./views/events.js";
import { mountMe } from "./views/me.js";

const VIEWS = { today: mountToday, explore: mountExplore, hq: mountHQ, events: mountEvents, me: mountMe };
const viewEl = document.getElementById("view");
const hudEl = document.getElementById("hud");
let ctx;
let current = { name: null, inst: null };

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}`);
  return res.json();
}
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

// ---- 網址 → 頁面 ----
function parse() {
  let h = decodeURIComponent(location.hash.slice(1));
  if (h && !h.startsWith("/")) {
    // 舊網址：#foundry/tsmc → #/hq/foundry/tsmc
    if (ctx.nodeById[h.split("/")[0]]) { location.replace(`#/hq/${h}`); return null; }
    h = "";
  }
  const [name, ...params] = h.split("/").filter(Boolean);
  return { name: VIEWS[name] ? name : "today", params };
}

function route() {
  const r = parse();
  if (!r) return;
  hideTerm();
  if (current.name !== r.name) {
    current.inst?.unmount?.();
    viewEl.innerHTML = "";
    current = { name: r.name, inst: VIEWS[r.name](viewEl, ctx, r.params) };
    window.scrollTo(0, 0);
  } else {
    current.inst?.update?.(r.params);
  }
  document.querySelectorAll(".tabbar a").forEach((a) => {
    if (a.dataset.view === r.name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

// ---- 頁首：連續天數與段位 ----
function renderHud() {
  const sn = ctx.game.streakNow();
  const st = ctx.game.standing();
  hudEl.innerHTML = `
    <a class="hud-chip streak${sn.doneToday ? " is-lit" : ""}" href="#/me" title="${sn.doneToday ? "今天已完成" : "今天還沒完成"}">
      <span aria-hidden="true">🔥</span><b>${sn.count}</b><span class="sr-only"> 天連續學習</span></a>
    <a class="hud-chip rank" href="#/me" style="--rank:${esc(st.tier.rank.color)}">
      ${rankBadge(st.tier, "sm")}<span class="hud-rank-label">${esc(st.tier.label)}</span><b>🏆 ${st.trophies}</b></a>`;
}

// ---- 章節：解鎖與進度 ----
function buildChapters(index) {
  // 相鄰環節：nodes.json 的上下游互相指到
  const adj = Object.fromEntries(ctx.nodes.map((n) => [n.id, new Set()]));
  for (const n of ctx.nodes) {
    for (const it of [...(n.upstream || []), ...(n.downstream || [])]) {
      if (it.node && adj[it.node]) { adj[n.id].add(it.node); adj[it.node].add(n.id); }
    }
  }
  const knowDone = (id) => Boolean(state().chapters[id]?.parts?.know);
  const chapterState = (id) => {
    const c = index.chapters.find((x) => x.node === id);
    if (!c) return "soon";
    const unlocked = id === index.start || [...adj[id]].some(knowDone);
    if (!unlocked) return "locked";
    if (!c.file) return "soon";
    const parts = state().chapters[id]?.parts || {};
    if (parts.final) return "done";
    if (Object.keys(parts).length) return "started";
    return "open";
  };
  ctx.chapterIndex = index;
  ctx.chapterState = chapterState;
  ctx.chapterList = () => index.chapters.map((c) => {
    const n = ctx.nodeById[c.node];
    return { id: n.id, name: n.name, nameEn: n.nameEn, zone: n.zone, file: c.file, state: chapterState(n.id),
      neighbors: [...adj[n.id]].map((id) => ctx.nodeById[id].name) };
  });
  ctx.completedNodes = () => index.chapters.filter((c) => state().chapters[c.node]?.parts?.final).map((c) => c.node);
  ctx.nextChapter = () => {
    const list = ctx.chapterList();
    const c = list.find((x) => x.state === "started") || list.find((x) => x.state === "open");
    if (!c) return null;
    return { ...c, started: c.state === "started", stateLabel: c.state === "started" ? "上次學到一半，接著往下" : "新的一章已經解鎖" };
  };
  ctx.chapterLink = (nodeId) => {
    const s = chapterState(nodeId);
    if (s === "locked" || s === "soon") return "";
    return `<p class="read-row"><a class="btn primary" href="#/explore/${esc(nodeId)}">到探索章節學這一環</a></p>`;
  };
}

// ---- 術語解釋框：全站統一處理 ----
document.addEventListener("click", (e) => {
  const termBtn = e.target.closest("[data-term]");
  if (termBtn && !termPopEl()?.contains(termBtn)) {
    const t = ctx?.glossaryById[termBtn.dataset.term];
    if (t) showTerm(termBtn, t, ctx);
    return;
  }
  if (!termPopOpen()) return;
  const pop = termPopEl();
  if (pop.contains(e.target)) {
    const b = e.target.closest("button");
    if (b?.hasAttribute("data-term-close")) hideTerm();
    else if (b?.dataset.gotoNode) ctx.nav(`/hq/${b.dataset.gotoNode}`);
    return;
  }
  hideTerm();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && termPopOpen()) { e.stopPropagation(); hideTerm(); } }, true);
window.addEventListener("resize", hideTerm);

async function main() {
  try {
    const [nodesData, companies, sources, glossary, config, chapterIndex, events, metrics] = await Promise.all([
      loadJSON("data/nodes.json"), loadJSON("data/companies.json"), loadJSON("data/sources.json"),
      loadJSON("data/glossary.json"), loadJSON("data/game.json"), loadJSON("data/chapters/index.json"),
      loadJSON("data/events.json"), loadJSON("data/metrics.json"),
    ]);
    load();
    ctx = {
      zones: nodesData.zones,
      nodes: nodesData.nodes,
      companies, glossary, events, metrics, config,
      zoneById: byId(nodesData.zones),
      nodeById: byId(nodesData.nodes),
      companyById: byId(companies),
      sourceById: byId(sources),
      glossaryById: byId(glossary),
      glossify: makeGlossifier(glossary),
      game: makeGame(config),
      state,
      onState: onChange,
      nav: (path) => { location.hash = "#" + path; },
      activeEvents: () => {
        const now = Date.now();
        return events.filter((e) => now - new Date(e.date).getTime() < (e.activeDays || 30) * 864e5);
      },
    };
    ctx.textify = () => makeT(ctx);
    buildChapters(chapterIndex);
    renderHud();
    onChange(renderHud);
    window.addEventListener("hashchange", route);
    route();
  } catch (err) {
    viewEl.innerHTML = `<p class="error">資料載入失敗：${esc(err.message)}。請用 <code>node tools/serve.mjs</code> 開啟，不要直接雙擊 HTML。</p>`;
    console.error(err);
  }
}

main();
