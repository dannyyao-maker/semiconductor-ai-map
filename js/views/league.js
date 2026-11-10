// 段位：一頁固定、不上下滑。左右滑動換段位（像翻卡片），整頁是目前這個段位的顏色。
// 畫面只有：大徽章、段位名稱、三階小點、盃數進度。沒有規則說明，也沒有白色方框。
import { esc } from "../util.js";
import { ic } from "../icons.js";
import { rankBadge } from "../game.js";
import { rankUnlocks, unlockChip, matchChip } from "../unlocks.js";

const ROMAN = ["I", "II", "III"];

export function mountLeague(root, ctx) {
  const st0 = ctx.game.standing();
  let idx = st0.tier.ri;
  root.classList.add("bleed");
  document.documentElement.classList.add("no-scroll");

  function slide(r, i, st, un) {
    const isCur = i === st.tier.ri;
    const past = i < st.tier.ri;
    const start = r.tiers[0];
    const ti = isCur ? st.tier.ti : (past ? r.tiers.length - 1 : 0);
    let status;
    if (isCur) {
      // 整條進度條＝這個段位需要的全部盃數；兩條細線把它分成三階（到 1/3 是 II、2/3 是 III、滿了就是下一個段位）
      const base = r.tiers[0], top = ctx.game.ranks[i + 1]?.tiers[0];
      const pct = top ? Math.round(Math.min(1, Math.max(0, (st.trophies - base) / (top - base))) * 100) : 100;
      const ticks = top ? r.tiers.slice(1).map((t) => `<i class="lg-tick" style="left:${((t - base) / (top - base)) * 100}%"></i>`).join("") : "";
      status = `<div class="lg-now"><b class="lg-num">${ic("trophy")}${st.trophies}</b>
        ${top ? `<div class="lg-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span>${ticks}</div><span class="lg-to">${ic("shield")}<b>${top}</b></span>` : ""}</div>`;
    } else if (past) status = `<div class="lg-now"><span class="lg-done">${ic("check")}</span></div>`;
    else status = `<div class="lg-now"><b class="lg-num is-lock">${ic("lock")}${start}</b></div>`;
    return `<section class="lg-slide${i === idx ? " is-active" : ""}" data-i="${i}" aria-label="${esc(r.name)}">
      <div class="lg-badge">${rankBadge({ rank: r, ti, label: r.name }, "hero")}</div>
      <h2 class="lg-name">${esc(r.name)}</h2>
      ${status}
      <div class="lg-unlocks${i > st.tier.ri ? " is-future" : ""}">${matchChip(r)}${(un[r.id] || []).map(unlockChip).join("")}</div>
    </section>`;
  }

  function paint() {
    const r = ctx.game.ranks[idx];
    const lg = root.querySelector(".lg");
    lg.style.setProperty("--rank", r.color);
    lg.style.setProperty("--rank2", r.color2 || r.color);
    root.querySelectorAll(".lg-dots i").forEach((d, i) => d.classList.toggle("is-on", i === idx));
    root.querySelectorAll(".lg-slide").forEach((s, i) => s.classList.toggle("is-active", i === idx));
    root.querySelector(".lg-prev").disabled = idx === 0;
    root.querySelector(".lg-next").disabled = idx === ctx.game.ranks.length - 1;
  }

  function go(i, smooth = true) {
    const track = root.querySelector(".lg-track");
    idx = Math.max(0, Math.min(ctx.game.ranks.length - 1, i));
    track.scrollTo({ left: idx * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
    paint();
  }

  let un = ctx._unlocks || {}, alive = true;
  function render() {
    const st = ctx.game.standing();
    const ranks = ctx.game.ranks;
    root.innerHTML = `
      <div class="lg" role="group" aria-roledescription="段位輪播" aria-label="段位">
        <div class="lg-track">${ranks.map((r, i) => slide(r, i, st, un)).join("")}</div>
        <button type="button" class="lg-arrow lg-prev" aria-label="上一個段位">${ic("back")}</button>
        <button type="button" class="lg-arrow lg-next" aria-label="下一個段位">${ic("back")}</button>
        <div class="lg-dots" aria-hidden="true">${ranks.map((r, i) => `<i class="${i < st.tier.ri ? "is-past" : ""}${i === st.tier.ri ? " is-cur" : ""}"></i>`).join("")}</div>
      </div>`;
    const track = root.querySelector(".lg-track");
    let raf = 0;
    track.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (i !== idx) { idx = i; paint(); }
      });
    }, { passive: true });
    paint();
    track.scrollLeft = idx * track.clientWidth;
  }

  root.addEventListener("click", (e) => {
    if (e.target.closest(".lg-prev")) go(idx - 1);
    else if (e.target.closest(".lg-next")) go(idx + 1);
  });
  const onKey = (e) => { if (e.key === "ArrowLeft") go(idx - 1); else if (e.key === "ArrowRight") go(idx + 1); };
  const onResize = () => go(idx, false);
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize);

  render();
  rankUnlocks(ctx).then((u) => { un = u; if (alive) render(); });
  const off = ctx.onState(render);
  return { unmount: () => { alive = false; off(); root.classList.remove("bleed"); document.documentElement.classList.remove("no-scroll"); window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); } };
}
