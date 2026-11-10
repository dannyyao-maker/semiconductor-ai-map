// 啟動：讀取 data/ 的資料，建立共用的 ctx，再依網址切換頁面。
// 網址格式：#/path（闖關）、#/hq（地圖）、#/practice（練習）、#/league（段位）、#/me（我的）
//          #/explore/ic-design/know.what（上課）、#/events/<事件代碼>、#/dict
// 舊網址會自動轉址：#/today、#/explore → 闖關；#foundry/tsmc → 地圖。之前分享出去的連結不會壞。
import { makeGlossifier, showTerm, hideTerm, termPopOpen, termPopEl } from "./glossary.js";
import { makeT } from "./card.js";
import { makeGame, rankBadge } from "./game.js";
import { load, state, onChange } from "./state.js";
import { esc } from "./util.js";
import { ic } from "./icons.js";
import { mountPath } from "./views/path.js";
import { mountExplore } from "./views/explore.js";
import { mountHQ } from "./views/hq.js";
import { mountEvents } from "./views/events.js";
import { mountMe } from "./views/me.js";
import { mountDict, metricsAsTerms } from "./views/dict.js";
import { mountPractice } from "./views/practice.js";
import { resolveFin } from "./fin.js";
import { mountLeague } from "./views/league.js";

const VIEWS = { path: mountPath, explore: mountExplore, hq: mountHQ, events: mountEvents, me: mountMe, dict: mountDict, practice: mountPractice, league: mountLeague };
// 每個頁面的標題、屬於哪個分頁、要不要有返回鍵
const META = {
  path: { title: "闖關", tab: "path" },
  hq: { title: "地圖", tab: "hq" },
  practice: { title: "練習", tab: "practice" },
  league: { title: "段位", tab: "league" },
  me: { title: "我的", tab: "me" },
  events: { title: "事件", tab: "hq", back: "#/hq" },
  dict: { title: "指標字典", tab: "hq", back: "#/hq" },
  explore: { title: "", tab: "path", back: "#/path" },
};
const TABS = [
  { id: "path", icon: "path", label: "闖關" },
  { id: "hq", icon: "map", label: "地圖" },
  { id: "practice", icon: "dumbbell", label: "練習" },
  { id: "league", icon: "shield", label: "段位" },
  { id: "me", icon: "user", label: "我的" },
];
const viewEl = document.getElementById("view");
const hudEl = document.getElementById("hud");
const titleEl = document.getElementById("page-title");
const backEl = document.getElementById("top-back");
const dockEl = document.getElementById("dock");
let ctx;
let current = { name: null, inst: null, params: [] };

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
  let [name, ...params] = h.split("/").filter(Boolean);
  if (!name || name === "today" || (name === "explore" && !params.length)) { name = "path"; params = []; }
  // 只有章節總覽（沒有指定哪一關）也回到闖關
  if (name === "explore" && params.length === 1 && params[0] !== "intro") { name = "path"; params = []; }
  return { name: VIEWS[name] ? name : "path", params };
}

function route() {
  const r = parse();
  if (!r) return;
  hideTerm();
  if (current.name !== r.name) {
    current.inst?.unmount?.();
    viewEl.innerHTML = "";
    current = { name: r.name, inst: VIEWS[r.name](viewEl, ctx, r.params), params: r.params };
    window.scrollTo(0, 0);
  } else {
    current.params = r.params;
    current.inst?.update?.(r.params);
  }
  // 上課、做事件任務時全螢幕：把頁首和分頁列藏起來，專心看內容
  const focus = (r.name === "explore" && r.params.length >= 1) || (r.name === "events" && r.params[1] === "play");
  document.body.classList.toggle("focus", focus);
  renderChrome();
}

// ---- 頁首、分頁列 ----
function pendingEvents() {
  return ctx.activeEvents().filter((e) => !state().events[e.id]?.done).length;
}

function renderChrome() {
  if (!ctx) return;
  const meta = META[current.name] || META.path;
  titleEl.textContent = meta.title;
  backEl.hidden = !meta.back;
  if (meta.back) backEl.href = meta.back;
  document.title = meta.title ? `${meta.title}・半導體 × AI` : "半導體 × AI 產業學習";
  renderHud();
  renderDock(meta.tab);
}

function renderHud() {
  if (!ctx) return;
  if (current.name === "hq") {
    const n = pendingEvents();
    hudEl.innerHTML = `
      <button class="icon-btn" type="button" data-ui="search" aria-label="搜尋">${ic("search")}</button>
      <a class="icon-btn" href="#/dict" aria-label="指標字典">${ic("book")}</a>
      <a class="icon-btn${n ? " is-alert" : ""}" href="#/events" aria-label="事件任務${n ? `，${n} 個待處理` : ""}">${ic("siren")}${n ? `<i class="dot">${n}</i>` : ""}</a>`;
    return;
  }
  const sn = ctx.game.streakNow();
  const st = ctx.game.standing();
  hudEl.innerHTML = `
    <a class="chip chip-flame${sn.doneToday ? " is-lit" : ""}" href="#/me" aria-label="連續 ${sn.count} 天">${ic("flame")}<b>${sn.count}</b></a>
    <a class="chip chip-rank" href="#/league" style="--rank:${esc(st.tier.rank.color)}" aria-label="${esc(st.tier.label)}，${st.trophies} 盃">${rankBadge(st.tier, "sm")}<b>${st.trophies}</b></a>`;
}

function renderDock(active) {
  const stale = ctx.staleNodes().length;
  const ev = pendingEvents();
  dockEl.innerHTML = TABS.map((t) => {
    const badge = t.id === "hq" && ev ? `<i class="dot"></i>` : t.id === "practice" && (stale || ctx.game.dueIds().length) ? `<i class="dot"></i>` : "";
    return `<a href="#/${t.id}" data-tab="${t.id}" aria-label="${t.label}"${t.id === active ? ' aria-current="page"' : ""}>
      <span class="dock-ic">${ic(t.icon)}${badge}</span><span class="dock-label">${t.label}</span></a>`;
  }).join("");
}

// 地圖頁的搜尋圖示在頁首，所以用事件通知地圖頁
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ui='search']");
  if (b) window.dispatchEvent(new Event("ui:search"));
});

// ---- 章節：一個單元接一個單元，完成才解鎖下一個 ----
function buildChapters(index) {
  const order = index.chapters.map((c) => c.node);
  const cache = {};
  /** 載入章節內容（全景開場代碼是 intro） */
  ctx.loadChapter = async (id) => {
    if (cache[id]) return cache[id];
    const file = id === "intro" ? "intro.json" : index.chapters.find((c) => c.node === id)?.file;
    if (!file) return null;
    const res = await fetch(`data/chapters/${file}`);
    if (!res.ok) throw new Error(`讀不到章節 ${file}`);
    return (cache[id] = resolveFin(await res.json(), ctx.fin));
  };
  ctx.chapterIndex = index;
  ctx.chapterOrder = order;
  // locked 還沒解鎖｜soon 內容製作中｜open 可以開始｜started 進行中｜done 完成
  const chapterState = (id) => {
    const i = order.indexOf(id);
    const c = index.chapters[i];
    if (!c || !c.file) return "soon";
    if (i > 0 && !state().chapters[order[i - 1]]?.parts?.final) return "locked";
    const pr = state().chapters[id] || {};
    if (pr.parts?.final) return "done";
    if (Object.keys(pr.sections || {}).length) return "started";
    return "open";
  };
  ctx.chapterState = chapterState;
  ctx.completedNodes = () => order.filter((id) => state().chapters[id]?.parts?.final);
  // 地圖用：每個環節的學習狀態
  const STALE_DAYS = 7;
  ctx.nodeProgress = (id) => {
    const pr = state().chapters[id] || {};
    const known = Boolean(pr.parts?.know);
    const lastAt = Math.max(pr.at || 0, pr.reviewAt || 0) || null;
    const days = lastAt ? Math.floor((Date.now() - lastAt) / 864e5) : null;
    return { known, done: Boolean(pr.parts?.final), lastAt, days, stale: known && days != null && days >= STALE_DAYS };
  };
  ctx.staleNodes = () => ctx.nodes.map((n) => ({ n, p: ctx.nodeProgress(n.id) })).filter((x) => x.p.stale).sort((a, b) => b.p.days - a.p.days);
  // 環節卡最上方：沒學過→速覽；學過→速複習（用圖示和很短的字）
  ctx.nodeBanner = (nodeId) => {
    const p = ctx.nodeProgress(nodeId);
    if (!p.known) {
      return `<div class="node-banner is-fog"><span class="nb-ic">${ic("lock")}</span>
        <a class="nb-btn" href="#/explore/${esc(nodeId)}/review">${ic("bolt")}速覽</a></div>`;
    }
    return `<div class="node-banner ${p.stale ? "is-stale" : "is-known"}">
      <span class="nb-ic">${ic(p.stale ? "hourglass" : "check")}</span>${p.days != null ? `<span class="nb-days">${p.days === 0 ? "今天" : `${p.days} 天前`}</span>` : ""}
      <a class="nb-btn" href="#/explore/${esc(nodeId)}/review">${ic("bolt")}複習</a></div>`;
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
    const [nodesData, companies, sources, glossary, config, chapterIndex, events, metrics, fin] = await Promise.all([
      loadJSON("data/nodes.json"), loadJSON("data/companies.json"), loadJSON("data/sources.json"),
      loadJSON("data/glossary.json"), loadJSON("data/game.json"), loadJSON("data/chapters/index.json"),
      loadJSON("data/events.json"), loadJSON("data/metrics.json"), loadJSON("data/financials.json"),
    ]);
    load();
    // 指標字典裡的指標也當成術語：卡片文字裡的「毛利率」「EPS」可以點了看解釋（和既有術語重複的別名不加）
    const taken = new Set(glossary.flatMap((t) => t.aliases));
    const terms = [...glossary, ...metricsAsTerms(metrics).map((t) => ({ ...t, aliases: t.aliases.filter((x) => !taken.has(x)) })).filter((t) => t.aliases.length)];
    ctx = {
      zones: nodesData.zones,
      nodes: nodesData.nodes,
      companies, glossary, events: resolveFin(events, fin), metrics, config, fin,
      zoneById: byId(nodesData.zones),
      nodeById: byId(nodesData.nodes),
      companyById: byId(companies),
      sourceById: byId(sources),
      glossaryById: byId(terms),
      glossify: makeGlossifier(terms),
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
    ctx.pendingEvents = pendingEvents;
    buildChapters(chapterIndex);
    onChange(() => { renderHud(); renderDock((META[current.name] || META.path).tab); });
    window.addEventListener("hashchange", route);
    route();
  } catch (err) {
    viewEl.innerHTML = `<p class="error">資料載入失敗：${esc(err.message)}。請用 <code>node tools/serve.mjs</code> 開啟，不要直接雙擊 HTML。</p>`;
    console.error(err);
  }
}

main();

// ---- 可安裝的網頁 App（PWA）----
// 瀏覽器（Android Chrome）覺得可以安裝時會丟出這個事件；先存起來，等使用者在「我的」按安裝
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); window.__installPrompt = e; window.dispatchEvent(new Event("installready")); });
window.addEventListener("appinstalled", () => { window.__installPrompt = null; window.dispatchEvent(new Event("installready")); });
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((err) => console.warn("離線功能沒有啟用：", err)));
}
