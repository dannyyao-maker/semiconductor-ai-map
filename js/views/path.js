// 闖關：像 Duolingo 的路徑，但畫成「晶片上的電路走線」。
// 一個單元（環節）一段路，每一關是走線上的一個接點；走過的走線通電發光（金色），還沒到的是暗的。
// 完成一個單元，下一個單元解鎖。只有目前這一關有「開始」泡泡。
import { esc } from "../util.js";
import { ic, unitIcon, levelIcon, mascot, rankGlyph } from "../icons.js";
import { rankBadge } from "../game.js";
import { state, save } from "../state.js";

const W = 360;          // 走線畫布的寬（SVG 座標），實際寬度跟著螢幕縮放
const STEP = 112;       // 兩關之間的距離
const TOP = 112;
const XS = [180, 126, 96, 126, 180, 234, 264, 234]; // 每一關的左右位置，連起來是一條蛇形走線

/** 一個單元要畫的所有關卡，以及每一關的狀態 */
async function buildUnits(ctx) {
  const rank = ctx.game.standing().tier;
  const rankOk = (min) => !min || ctx.game.tiers.length && rank.ri >= ctx.game.ranks.findIndex((r) => r.id === min);
  const units = [];

  const intro = await ctx.loadChapter("intro");
  units.push({ id: "intro", node: null, name: "", icon: "globe", zone: "semi", route: () => "#/explore/intro", soon: false,
    levels: [{ key: "intro.journey", title: intro.title.replace(/^全景開場：/, ""), icon: "globe", required: true }] });

  for (const c of ctx.chapterIndex.chapters) {
    const n = ctx.nodeById[c.node];
    const u = { id: c.node, node: n, name: n.name, icon: unitIcon(c.node), zone: n.zone, soon: !c.file, levels: [] };
    if (c.file) {
      const ch = await ctx.loadChapter(c.node);
      for (const p of ch.parts) for (const s of p.sections) {
        u.levels.push({ key: `${p.id}.${s.id}`, title: s.title, icon: levelIcon(s.id, s.match), required: rankOk(p.minRank), rankLock: !rankOk(p.minRank), minRank: p.minRank, rankColor: ctx.game.ranks.find((r) => r.id === p.minRank)?.color });
      }
    }
    units.push(u);
  }

  // 狀態：依序走，第一個沒完成的是「目前」，之後都還沒解鎖
  let found = false;
  for (const u of units) {
    const done = state().chapters[u.id]?.sections || {};
    for (const l of u.levels) {
      l.done = Boolean(done[l.key]);
      if (l.done) l.state = "done";
      else if (l.rankLock) l.state = "rank";
      else if (!found) { l.state = "current"; found = true; u.hasCurrent = true; }
      else l.state = "locked";
    }
    u.doneCount = u.levels.filter((l) => l.done).length;
    u.complete = u.levels.length > 0 && u.levels.every((l) => l.done || l.rankLock);
  }
  return units;
}

const pos = (i) => [XS[i % XS.length], TOP + i * STEP];

/** 一個單元的走線：暗的底線＋通電的金線（走到目前這一關為止） */
function traceSVG(levels, H) {
  const cur = levels.findIndex((l) => l.state === "current");
  const lit = cur === -1 ? (levels.every((l) => l.done || l.rankLock) ? levels.length - 1 : -1) : cur;
  const seg = (i) => {
    const [x0, y0] = pos(i - 1), [x1, y1] = pos(i), dy = STEP * 0.55;
    return `M${x0} ${y0} C${x0} ${y0 + dy} ${x1} ${y1 - dy} ${x1} ${y1}`;
  };
  let base = "", glow = "";
  for (let i = 1; i < levels.length; i++) { base += seg(i); if (i <= lit) glow += seg(i); }
  return `<svg class="trace-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <path class="tr-base" d="${base}"/><path class="tr-core" d="${base}"/>
    ${glow ? `<path class="tr-lit" d="${glow}"/><path class="tr-flow" d="${glow}"/>` : ""}
  </svg>`;
}

function unitHTML(u, idx, justKey) {
  const zone = `z-${u.zone}`;
  const total = u.levels.length;
  const banner = (cls = "") => `
    <header class="unit-banner ${zone} ${cls}">
      <span class="ub-icon">${ic(u.icon)}</span>
      <b class="ub-name">${esc(u.name || "全景")}</b>
      ${total ? `<span class="ub-pips" aria-label="${u.doneCount}／${total}">${u.levels.map((l) => `<i class="${l.done ? "is-on" : ""}"></i>`).join("")}</span>` : `<span class="ub-soon">${ic("lock")}</span>`}
      ${u.node ? `<a class="ub-book" href="#/hq/${esc(u.id)}" aria-label="${esc(u.name)}環節卡">${ic("book")}</a>` : ""}
    </header>`;
  if (u.soon) return `<section class="unit is-soon ${zone}" id="unit-${esc(u.id)}">${banner("is-soon")}</section>`;

  const n = u.levels.length;
  const H = TOP + (n - 1) * STEP + 130;
  const curI = u.levels.findIndex((l) => l.state === "current");
  const mI = curI === -1 ? n - 1 : curI;
  const [mx, my] = pos(mI);
  const mascotLeft = mx > 180;
  const nodes = u.levels.map((l, i) => {
    const [x, y] = pos(i);
    const cls = ["lv", `is-${l.state}`, l.key === justKey ? "is-just" : "", i === n - 1 ? "is-final" : ""].filter(Boolean).join(" ");
    const href = u.id === "intro" ? "#/explore/intro" : `#/explore/${u.id}/${l.key}`;
    const bubble = l.state === "current" ? `<span class="lv-bubble" style="left:${(x / W) * 100}%;top:${y - 82}px"><i>${ic("play")}</i><b>${esc(l.title)}</b></span>` : "";
    return `${bubble}<button class="${cls}" type="button" data-href="${esc(href)}" data-state="${l.state}" style="left:${(x / W) * 100}%;top:${y}px" aria-label="${esc(l.title)}${l.state === "done" ? "（完成）" : l.state === "locked" ? "（鎖住）" : ""}">
      <span class="lv-face">${ic(l.state === "locked" || l.state === "rank" ? l.icon : l.icon)}</span>
      ${l.state === "done" ? `<i class="lv-check">${ic("check")}</i>` : l.state === "rank" ? `<i class="lv-rank" style="--rank:${esc(l.rankColor || "#888")}" data-rank="${esc(l.minRank)}">${rankGlyph(l.minRank)}</i>` : l.state === "locked" ? `<i class="lv-lock">${ic("lock")}</i>` : ""}
      ${i === n - 1 ? "" : ""}</button>`;
  }).join("");
  const mood = u.complete ? "cheer" : "idle";
  return `<section class="unit ${zone}${u.complete ? " is-complete" : ""}" id="unit-${esc(u.id)}" data-i="${idx}">
    ${banner()}
    <div class="trace" style="height:${H}px">
      ${traceSVG(u.levels, H)}
      ${nodes}
      <div class="trace-mascot" style="top:${my - 44}px;${mascotLeft ? "left:2%" : "right:2%"}">${mascot(mood, 84)}</div>
    </div>
  </section>`;
}

export function mountPath(root, ctx) {
  let alive = true;
  root.classList.add("bleed");
  let units = [];

  async function draw() {
    try { units = await buildUnits(ctx); } catch (e) { root.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
    if (!alive) return;
    const jd = state().justDone;
    const recent = jd && Date.now() - jd.at < 30000 ? jd : null;
    root.innerHTML = `<div class="path">${units.map((u, i) => unitHTML(u, i, recent?.key === undefined ? null : `${recent.key}`)).join("")}</div>`;
    // 「剛完成」的那一關要播動畫：要比對單元，避免不同單元同名的關卡
    if (recent) {
      root.querySelectorAll(".lv.is-just").forEach((el) => { if (el.closest(".unit")?.id !== `unit-${recent.unit}`) el.classList.remove("is-just"); });
    }
    // 捲到目前這一關
    requestAnimationFrame(() => {
      const target = root.querySelector(".lv.is-just") || root.querySelector(".lv.is-current") || root.querySelector(".unit:last-child");
      target?.scrollIntoView({ block: "center", behavior: recent ? "smooth" : "auto" });
    });
    // 完成整個單元：慶祝一下（一次）
    if (recent) {
      const u = units.find((x) => x.id === recent.unit);
      state().justDone = null;
      save();
      if (u?.complete && recent.finalOfUnit) setTimeout(() => celebrate(u), 900);
    }
  }

  function celebrate(u) {
    const next = units[units.indexOf(u) + 1];
    const wrap = document.createElement("div");
    wrap.className = `cele z-${u.zone}`;
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", `${u.name}單元完成`);
    wrap.innerHTML = `
      <div class="cele-confetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>
      <div class="cele-body">
        ${mascot("cheer", 150)}
        <div class="cele-unit">${ic(u.icon)}<span class="cele-check">${ic("check")}</span></div>
        ${next ? `<div class="cele-next">${ic("lock")}<i>›</i>${ic(next.icon)}</div>` : ""}
        <button class="cele-go" type="button" aria-label="繼續">${ic("play")}</button>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector(".cele-go").addEventListener("click", close);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelector(".cele-go").focus();
  }

  /** 點到被段位鎖住的關卡：在它上方短暫顯示「段位徽章＋名稱＋鎖」 */
  function showRankTip(lv, rankId) {
    root.querySelectorAll(".rank-tip").forEach((t) => t.remove());
    const tier = ctx.game.tiers.find((t) => t.rank.id === rankId && t.ti === 0);
    if (!tier) return;
    const tip = document.createElement("div");
    tip.className = "rank-tip";
    tip.style.left = `${lv.offsetLeft}px`;
    tip.style.top = `${lv.offsetTop}px`;
    tip.style.setProperty("--rank", tier.rank.color);
    tip.innerHTML = `${rankBadge(tier, "sm")}<b>${esc(tier.rank.name)}</b>${ic("lock")}`;
    lv.parentElement.appendChild(tip);
    setTimeout(() => tip.remove(), 2200);
  }

  root.addEventListener("click", (e) => {
    const lv = e.target.closest(".lv");
    if (lv) {
      if (lv.dataset.state === "locked" || lv.dataset.state === "rank") {
        lv.classList.remove("shake"); void lv.offsetWidth; lv.classList.add("shake");
        const rid = lv.querySelector(".lv-rank")?.dataset.rank;
        if (rid) showRankTip(lv, rid);
        return;
      }
      location.hash = lv.dataset.href;
      return;
    }
    const b = e.target.closest(".lv-bubble");
    if (b) {
      const cur = root.querySelector(".lv.is-current");
      if (cur) location.hash = cur.dataset.href;
    }
  });

  draw();
  const off = ctx.onState(() => { /* 進度更新由上課頁負責；回到闖關時會重畫 */ });
  return { update: () => draw(), unmount: () => { alive = false; off(); root.classList.remove("bleed"); } };
}
