// 事件：進行中的事件任務和事件檔案。
// 一個任務：① 警報（任務頁）→ ② 狀況簡報 → ③ 地圖導覽（綠＝受惠、紅＝受害、灰＝影響不大）→ ④ 3 題 → ⑤ 結案
// 網址：#/events（清單）、#/events/<代碼>（任務頁）、#/events/<代碼>/play（開始任務）
import { esc, toast } from "../util.js";
import { state, save } from "../state.js";
import { renderScreen } from "../screens.js";
import { renderQuiz } from "../quiz.js";
import { renderMap } from "../map.js";
import { sourceLinks } from "../card.js";

const EFFECT = { "+": { cls: "pos", label: "受惠", icon: "▲" }, "-": { cls: "neg", label: "受壓", icon: "▼" }, "0": { cls: "zero", label: "影響不大", icon: "●" } };

export function mountEvents(root, ctx, initial) {
  const done = (id) => Boolean(state().events[id]?.done);

  function list() {
    const active = ctx.activeEvents();
    const archived = ctx.events.filter((e) => !active.includes(e));
    const li = (e) => `<li class="event-item${done(e.id) ? " is-done" : ""}"><a href="#/events/${esc(e.id)}">
      <span class="ev-date">${esc(e.date)}</span><b>${esc(e.title)}</b>
      <span class="muted small">${done(e.id) ? "✓ 已結案" : "待處理"}・${esc(e.origin)}來源</span></a></li>`;
    root.innerHTML = `
      <div class="view-head"><div><h1>事件</h1><p class="muted">重大事件發生時，這裡會出現任務：狀況簡報 → 地圖導覽 → 3 題 → 結案。</p></div></div>
      <section class="panel"><h2 class="panel-title">🚨 進行中</h2>
        ${active.length ? `<ul class="plain event-list">${active.map(li).join("")}</ul>` : `<p class="muted">目前沒有進行中的事件。</p>`}</section>
      <section class="panel"><h2 class="panel-title">事件檔案</h2>
        ${archived.length ? `<ul class="plain event-list">${archived.map(li).join("")}</ul>` : `<p class="muted">還沒有歸檔的事件。</p>`}</section>`;
  }

  function brief(ev) {
    const pre = ev.nodes.map((id) => ({ n: ctx.nodeById[id], known: ctx.nodeProgress(id).known })).filter((x) => x.n);
    root.innerHTML = `
      <div class="view-head"><div><p><a href="#/events">← 事件</a></p>
        <p class="ev-alert">🚨 重大事件・${esc(ev.date)}</p><h1>${esc(ev.title)}</h1>
        <p><span class="status status-${esc(ev.status.replace(/・.*/, ""))}">${esc(ev.status)}</span> <span class="muted small">${esc(ev.origin)}來源</span></p></div></div>
      <section class="panel">
        <p class="lead">${ctx.textify()(ev.summary)}</p>
        <p class="muted small">任務流程：狀況簡報（${ev.briefing.length} 張，含圖表）→ 地圖導覽 → ${ev.matrix ? "影響矩陣 → " : ""}${ev.questions.length} 題（含看圖題）→ 結案，大約 5–8 分鐘。</p>
        <h2 class="panel-title">需要先懂的環節</h2>
        <ul class="prereq">${pre.map(({ n, known }) => `<li>${known ? "✓" : "○"} ${esc(n.name)}
          ${known ? `<span class="muted small">學過了</span>` : `<a class="btn" href="#/explore/${esc(n.id)}/review">30 秒速覽</a>`}</li>`).join("")}</ul>
        <p class="actions"><a class="btn primary" href="#/events/${esc(ev.id)}/play">${done(ev.id) ? "重看任務" : "開始任務"}</a></p>
        ${ev.sources?.length ? `<p class="claim-meta">${sourceLinks(ev.sources, ctx)}</p>` : ""}
      </section>`;
  }

  function play(ev) {
    // 把任務攤平成一連串的步驟
    const steps = [
      ...ev.briefing.map((s) => ({ kind: "screen", s, label: "狀況簡報" })),
      { kind: "map", label: "地圖導覽" },
      ...(ev.matrix ? [{ kind: "screen", s: ev.matrix, label: "影響矩陣" }] : []),
      ...ev.questions.map((q) => ({ kind: "quiz", q, label: "考考你" })),
      { kind: "end", label: "結案" },
    ];
    root.innerHTML = `
      <div class="player">
        <div class="player-head">
          <a class="player-back" href="#/events/${esc(ev.id)}" aria-label="離開">✕</a>
          <div class="player-title"><p class="muted small">🚨 事件任務</p><p><b>${esc(ev.title)}</b></p></div>
        </div>
        <div class="player-progress"><span></span></div>
        <p class="step-label muted small"></p>
        <div class="player-stage panel"></div>
        <div class="player-nav"><button class="btn" data-prev>上一步</button><button class="btn primary" data-next disabled>下一步</button></div>
      </div>`;
    const stage = root.querySelector(".player-stage");
    const bar = root.querySelector(".player-progress span");
    const label = root.querySelector(".step-label");
    const nav = root.querySelector(".player-nav");
    const next = root.querySelector("[data-next]");
    const prev = root.querySelector("[data-prev]");
    let i = 0;

    const show = () => {
      const st = steps[i];
      bar.style.width = `${((i + 1) / steps.length) * 100}%`;
      label.textContent = `${st.label}（${i + 1}／${steps.length}）`;
      prev.disabled = i === 0;
      next.disabled = true;
      next.textContent = "下一步";
      nav.hidden = false;
      if (st.kind === "screen") renderScreen(stage, st.s, ctx, () => { next.disabled = false; });
      else if (st.kind === "map") { mapStep(stage, ev); next.disabled = false; }
      else if (st.kind === "quiz") {
        nav.hidden = true;
        const m = ctx.game.standing().tier.rank.match || {};
        renderQuiz(stage, st.q, ctx, { seconds: m.seconds || 0, label: "考考你", continueLabel: "下一步", onDone: () => step() });
      } else {
        const first = !done(ev.id);
        state().events[ev.id] = { done: true, at: Date.now() };
        save();
        stage.innerHTML = `
          <div class="scr"><p class="scr-speaker">結案</p><p class="scr-text">${ctx.textify()(ev.conclusion)}</p>
          ${impactList(ev)}</div>`;
        next.textContent = "回到事件";
        next.disabled = false;
        if (first) toast("✓ 事件結案，已存進事件檔案");
      }
      stage.scrollIntoView({ block: "nearest" });
    };
    const step = () => { if (i < steps.length - 1) { i++; show(); } else ctx.nav("/events"); };
    next.addEventListener("click", step);
    prev.addEventListener("click", () => { if (i > 0) { i--; show(); } });
    show();
  }

  // 地圖導覽：受影響的環節亮綠燈或紅燈，點一下看原因
  function mapStep(el, ev) {
    el.innerHTML = `
      <p class="scr-title">這件事影響了哪些環節？</p>
      <p class="hint">藍色（▲）是受惠、橘色（▼）是受壓、灰色（●）是影響不大。點地圖或下方的項目，看原因。</p>
      <div class="event-map"></div>
      <div class="impact-reason" aria-live="polite"></div>
      ${impactList(ev, true)}`;
    const mapEl = el.querySelector(".event-map");
    const reason = el.querySelector(".impact-reason");
    const byNode = Object.fromEntries(ev.impacts.map((x) => [x.node, x]));
    const pick = (id) => {
      const imp = byNode[id];
      const n = ctx.nodeById[id];
      mapEl.querySelectorAll(".node").forEach((g) => g.classList.toggle("is-picked", g.dataset.id === id));
      el.querySelectorAll(".impact-list li").forEach((li) => li.classList.toggle("is-picked", li.dataset.node === id));
      reason.innerHTML = imp
        ? `<div class="reveal-box impact-${EFFECT[imp.effect].cls}"><p><b>${EFFECT[imp.effect].icon} ${esc(n.name)}：${EFFECT[imp.effect].label}</b></p><p>${ctx.textify()(imp.reason)}</p></div>`
        : `<div class="reveal-box"><p><b>${esc(n.name)}</b>：這次事件沒有直接提到。</p></div>`;
    };
    renderMap(mapEl, ctx, { mobile: window.matchMedia("(max-width: 720px)").matches, onSelect: pick, onBackground: () => {} });
    mapEl.querySelector("svg").classList.add("has-impacts");
    mapEl.querySelectorAll(".node").forEach((g) => {
      const imp = byNode[g.dataset.id];
      g.classList.add(imp ? `impact-${EFFECT[imp.effect].cls}` : "impact-none");
    });
    el.querySelectorAll(".impact-list li").forEach((li) => li.addEventListener("click", () => pick(li.dataset.node)));
    pick(ev.impacts[0].node);
  }

  function impactList(ev, clickable = false) {
    return `<ul class="impact-list${clickable ? " is-clickable" : ""}">${ev.impacts.map((x) => {
      const e = EFFECT[x.effect];
      return `<li class="impact-${e.cls}" data-node="${esc(x.node)}"><span class="imp-dot">${e.icon}</span><b>${esc(ctx.nodeById[x.node]?.name || x.node)}</b><span>${e.label}</span></li>`;
    }).join("")}</ul>`;
  }

  function render(p = []) {
    const ev = p[0] && ctx.events.find((e) => e.id === p[0]);
    if (!ev) return list();
    if (p[1] === "play") return play(ev);
    brief(ev);
  }
  render(initial);
  return { update: render };
}
