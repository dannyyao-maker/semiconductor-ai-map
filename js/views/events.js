// 事件：進行中的事件任務和事件檔案。
// 一個任務：① 警報（任務頁）→ ② 狀況簡報 → ③ 地圖導覽（綠＝受惠、紅＝受害、灰＝影響不大）→ ④ 3 題 → ⑤ 結案
// 網址：#/events（清單）、#/events/<代碼>（任務頁）、#/events/<代碼>/play（開始任務）
import { esc, toast } from "../util.js";
import { state, save } from "../state.js";
import { renderScreen } from "../screens.js";
import { renderQuiz } from "../quiz.js";
import { renderMap } from "../map.js";
import { sourceLinks } from "../card.js";
import { ic, unitIcon, mascot } from "../icons.js";

/** 事件狀態標籤：自動整理的事件特別標出來，並說明它通過了什麼檢查、還沒經過什麼 */
function statusTag(status) {
  if (status.startsWith("自動整理")) return `<span class="status status-auto" title="由 Claude Code 依官方文件自動整理，數字都通過「在原文找得到」的檢查；還沒有經過本人審核">🤖 ${esc(status)}</span>`;
  return `<span class="status status-${esc(status)}">${esc(status)}</span>`;
}
const EFFECT = { "+": { cls: "pos", label: "受惠", icon: "▲" }, "-": { cls: "neg", label: "受壓", icon: "▼" }, "0": { cls: "zero", label: "影響不大", icon: "●" } };

export function mountEvents(root, ctx, initial) {
  const done = (id) => Boolean(state().events[id]?.done);

  function list() {
    const active = ctx.activeEvents();
    const archived = ctx.events.filter((e) => !active.includes(e));
    const row = (e) => `<li><a class="ev-row${done(e.id) ? " is-done" : ""}" href="#/events/${esc(e.id)}">
      <span class="ev-ic">${ic(done(e.id) ? "check" : "siren")}</span>
      <span class="ev-body"><b>${esc(e.title)}</b><span class="ev-meta"><time>${esc(e.date)}</time>${e.status.startsWith("自動整理") ? `<i title="自動整理">🤖</i>` : ""}</span></span></a></li>`;
    root.innerHTML = `
      <div class="ev">
        ${active.length ? `<ul class="ev-list">${active.map(row).join("")}</ul>` : `<div class="ev-empty">${mascot("happy", 110)}<span class="pr-empty-ok">${ic("check")}</span></div>`}
        ${archived.length ? `<h2 class="ev-sub">${ic("book")}</h2><ul class="ev-list">${archived.map(row).join("")}</ul>` : ""}
      </div>`;
  }

  function brief(ev) {
    const pre = ev.nodes.map((id) => ({ n: ctx.nodeById[id], known: ctx.nodeProgress(id).known })).filter((x) => x.n);
    root.innerHTML = `
      <div class="ev ev-brief">
        <div class="evb-hero">
          <span class="evb-siren">${ic("siren")}</span>
          <h2>${esc(ev.title)}</h2>
          <p class="evb-meta"><time>${esc(ev.date)}</time>${statusTag(ev.status)}</p>
        </div>
        <p class="evb-summary">${ctx.textify()(ev.summary)}</p>
        <ul class="evb-pre" aria-label="需要先懂的環節">${pre.map(({ n, known }) => `
          <li class="${known ? "is-known" : ""} z-${esc(n.zone)}">${known ? `<span class="evb-pic">${ic(unitIcon(n.id))}<i>${ic("check")}</i></span>` : `<a class="evb-pic" href="#/explore/${esc(n.id)}/review" aria-label="${esc(n.name)} 30 秒速覽">${ic(unitIcon(n.id))}<i>${ic("bolt")}</i></a>`}<b>${esc(n.name)}</b></li>`).join("")}</ul>
        <a class="evb-go" href="#/events/${esc(ev.id)}/play" aria-label="${done(ev.id) ? "重看任務" : "開始任務"}">${ic("play")}</a>
        ${ev.sources?.length ? `<p class="claim-meta">${sourceLinks(ev.sources, ctx)}</p>` : ""}
      </div>`;
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
          <a class="player-back" href="#/events/${esc(ev.id)}" aria-label="離開">${ic("close")}</a>
          <div class="player-progress"><span></span></div>
          <span class="player-ic">${ic("siren")}</span>
        </div>
        <div class="player-stage"></div>
        <div class="player-nav"><button class="pn-prev" type="button" data-prev aria-label="上一步">${ic("back")}</button><button class="pn-next" type="button" data-next disabled aria-label="下一步">${ic("play")}</button></div>
      </div>`;
    const stage = root.querySelector(".player-stage");
    const bar = root.querySelector(".player-progress span");
    const nav = root.querySelector(".player-nav");
    const next = root.querySelector("[data-next]");
    const prev = root.querySelector("[data-prev]");
    let i = 0;

    const show = () => {
      const st = steps[i];
      bar.style.width = `${((i + 1) / steps.length) * 100}%`;
      prev.disabled = i === 0;
      next.disabled = true;
      next.innerHTML = ic("play");
      next.setAttribute("aria-label", "下一步");
      next.classList.remove("is-finish");
      nav.hidden = false;
      if (st.kind === "screen") renderScreen(stage, st.s, ctx, () => { next.disabled = false; });
      else if (st.kind === "map") { mapStep(stage, ev); next.disabled = false; }
      else if (st.kind === "quiz") {
        nav.hidden = true;
        const m = ctx.game.standing().tier.rank.match || {};
        renderQuiz(stage, st.q, ctx, { seconds: m.seconds || 0, label: "考考你", continueLabel: "繼續", onDone: () => step() });
      } else {
        state().events[ev.id] = { done: true, at: Date.now() };
        save();
        stage.innerHTML = `
          <div class="scr"><div class="evb-done">${mascot("cheer", 96)}</div><p class="scr-text">${ctx.textify()(ev.conclusion)}</p>
          ${impactList(ev)}</div>`;
        next.innerHTML = ic("check");
        next.setAttribute("aria-label", "回到事件");
        next.classList.add("is-finish");
        next.disabled = false;
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
      <p class="scr-title scr-title-ic">${ic("map")}</p>
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
