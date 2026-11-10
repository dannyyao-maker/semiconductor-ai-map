// 研究總部：產業鏈地圖＋環節卡、公司小卡。隨時回來複習用。
// 網址：#/hq、#/hq/foundry、#/hq/foundry/tsmc
import { renderMap, highlightMap, markRead } from "../map.js";
import { nodeCardHTML, companyCardHTML } from "../card.js";
import { hideTerm, showTerm } from "../glossary.js";
import { setupSearch } from "../search.js";

export function mountHQ(root, ctx, initial) {
  root.innerHTML = `
    <div class="view-head">
      <div><h1>研究總部</h1><p class="muted">產業鏈全貌。忘了哪一環，點進去複習。</p>
        <p class="hq-links"><a class="btn" href="#/dict">📖 指標字典</a></p></div>
      <div class="search-box">
        <input id="search" type="search" placeholder="搜尋環節、公司、術語（例：台積、HBM）" autocomplete="off"
          role="combobox" aria-label="搜尋環節、公司或術語" aria-controls="search-results" aria-expanded="false" aria-autocomplete="list">
        <ul id="search-results" class="search-results" role="listbox" aria-label="搜尋結果" hidden></ul>
      </div>
    </div>
    <div class="layout">
      <section class="map" aria-label="產業鏈地圖"></section>
      <aside class="card" aria-labelledby="card-title" hidden></aside>
    </div>`;
  const mapEl = root.querySelector(".map");
  const cardEl = root.querySelector(".card");
  const mobileQuery = window.matchMedia("(max-width: 720px)");
  let params = initial;
  let showing = "";

  const go = (path) => ctx.nav(path ? `/hq/${path}` : "/hq");

  function render() {
    const node = ctx.nodeById[params[0]] || null;
    const company = (node && ctx.companyById[params[1]]) || null;
    if (!node) {
      cardEl.hidden = true;
      document.body.classList.remove("card-open");
      highlightMap(mapEl, {});
      showing = "";
      return;
    }
    const key = params.join("/");
    const scroll = showing === key ? cardEl.scrollTop : 0;
    cardEl.innerHTML = company ? companyCardHTML(company, node, ctx) : nodeCardHTML(node, ctx);
    cardEl.hidden = false;
    cardEl.scrollTop = scroll;
    showing = key;
    document.body.classList.add("card-open");
    highlightMap(mapEl, { selected: node.id, companySegments: company?.segments });
    if (!scroll) cardEl.querySelector("h2")?.focus({ preventScroll: true });
  }

  function draw() {
    renderMap(mapEl, ctx, { mobile: mobileQuery.matches, onSelect: (id) => go(id), onBackground: () => go("") });
    markRead(mapEl, ctx.completedNodes());
    render();
  }

  // 卡片裡的按鈕：關閉、跳到別的環節、打開公司小卡（術語由 app.js 統一處理）
  cardEl.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || t.dataset.term) return;
    if (t.hasAttribute("data-close")) go("");
    else if (t.dataset.gotoNode) go(t.dataset.gotoNode);
    else if (t.dataset.company) go(`${params[0]}/${t.dataset.company}`);
  });
  cardEl.addEventListener("scroll", hideTerm, { passive: true });

  const onKey = (e) => { if (e.key === "Escape" && !cardEl.hidden && !document.querySelector(".term-pop")) go(""); };
  document.addEventListener("keydown", onKey);
  mobileQuery.addEventListener("change", draw);

  setupSearch(root.querySelector("#search"), root.querySelector("#search-results"), ctx, (r) => {
    if (r.kind === "環節") go(r.id);
    else if (r.kind === "公司") go(`${ctx.companyById[r.id].segments[0]}/${r.id}`);
    else if (r.kind === "指標") ctx.nav(`/dict/${r.id}`);
    else showTerm(root.querySelector("#search"), ctx.glossaryById[r.id], ctx);
  });

  draw();

  return {
    update(p) { params = p; render(); },
    unmount() {
      document.removeEventListener("keydown", onKey);
      mobileQuery.removeEventListener("change", draw);
      document.body.classList.remove("card-open");
      hideTerm();
    },
  };
}
