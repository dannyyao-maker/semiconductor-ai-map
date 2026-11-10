// 搜尋：找環節、公司、術語，中英文都可以。選中結果後交給 onPick 處理。
import { esc } from "./util.js";

const norm = (s) => String(s || "").toLowerCase().replace(/[\s\-–（）()／/,.、]/g, "");

export function setupSearch(input, list, ctx, onPick) {
  // 建立搜尋索引：每筆資料把所有名稱接成一串，方便比對
  const items = [
    ...ctx.nodes.map((n) => ({ kind: "環節", id: n.id, label: n.name, sub: n.nameEn, keys: [n.name, n.nameEn, n.id] })),
    ...ctx.companies.map((c) => ({ kind: "公司", id: c.id, label: c.name, sub: c.nameEn, keys: [c.name, c.nameEn, c.id] })),
    ...ctx.glossary.map((t) => ({ kind: "術語", id: t.id, label: t.term, sub: t.en, keys: [t.term, t.en, ...t.aliases] })),
    ...(ctx.metrics || []).map((m) => ({ kind: "指標", id: m.id, label: m.name, sub: m.en, keys: [m.name, m.en, m.abbr, m.id] })),
  ].map((it) => ({ ...it, hay: it.keys.map(norm) }));

  let results = [];
  let active = -1;

  function score(it, q) {
    let best = 0;
    for (const h of it.hay) {
      if (h === q) best = Math.max(best, 3);
      else if (h.startsWith(q)) best = Math.max(best, 2);
      else if (h.includes(q)) best = Math.max(best, 1);
    }
    return best;
  }

  function render() {
    if (!results.length) {
      list.innerHTML = input.value.trim() ? `<li class="search-empty">找不到「${esc(input.value.trim())}」</li>` : "";
      list.hidden = !input.value.trim();
      input.setAttribute("aria-expanded", String(!list.hidden));
      return;
    }
    list.innerHTML = results.map((r, i) => `
      <li role="option" id="sr-${i}" class="search-item${i === active ? " is-active" : ""}" aria-selected="${i === active}" data-i="${i}">
        <span class="search-kind">${r.kind}</span>
        <span class="search-label">${esc(r.label)}</span>
        <span class="en">${esc(r.sub)}</span>
      </li>`).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", active >= 0 ? `sr-${active}` : "");
  }

  function update() {
    const q = norm(input.value);
    results = q ? items.map((it) => ({ it, s: score(it, q) })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s).slice(0, 8).map((x) => x.it) : [];
    active = results.length ? 0 : -1;
    render();
  }

  function pick(i) {
    const r = results[i];
    if (!r) return;
    close();
    input.blur();
    onPick(r);
  }

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }

  input.addEventListener("input", update);
  input.addEventListener("focus", () => { if (input.value.trim()) update(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && results.length) { e.preventDefault(); active = (active + 1) % results.length; render(); }
    else if (e.key === "ArrowUp" && results.length) { e.preventDefault(); active = (active - 1 + results.length) % results.length; render(); }
    else if (e.key === "Enter") { e.preventDefault(); pick(active); }
    else if (e.key === "Escape") { e.stopPropagation(); input.value = ""; close(); input.blur(); }
  });
  // 用 mousedown 而不是 click，避免輸入框先失去焦點、清單先關掉
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("[data-i]");
    if (li) { e.preventDefault(); pick(Number(li.dataset.i)); }
  });
  input.addEventListener("blur", () => setTimeout(close, 150));
}
