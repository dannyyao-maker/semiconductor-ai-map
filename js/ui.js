// 幾個頁面共用的畫面元件：段位卡、連續天數卡。
import { esc } from "./util.js";
import { rankBadge } from "./game.js";

/** 段位卡：徽章、盃數、到下一階的進度條 */
export function rankCardHTML(ctx, { compact = false } = {}) {
  const st = ctx.game.standing();
  const pv = ctx.game.preview();
  const r = st.tier.rank;
  const pct = Math.round(st.progress * 100);
  return `
    <div class="rank-card${compact ? " compact" : ""}" style="--rank:${esc(r.color)}">
      ${rankBadge(st.tier, compact ? "lg" : "xl")}
      <div class="rank-info">
        <p class="rank-name">${esc(st.tier.label)} <span class="en">${esc(r.en)}</span></p>
        <p class="rank-trophies">🏆 <b>${st.trophies}</b> 盃</p>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="到下一階的進度">
          <span style="width:${pct}%"></span></div>
        <p class="muted small">${st.next ? `再 ${st.toNext} 盃升到 ${esc(st.next.label)}` : "已經是最高段位"}
          ・答對 +${pv.win}　答錯 ${pv.loss ? "−" + pv.loss : "不扣"}</p>
      </div>
    </div>`;
}

/** 連續天數卡 */
export function streakCardHTML(ctx) {
  const sn = ctx.game.streakNow();
  const next = (ctx.config.streak?.milestones || []).find((m) => m.days > sn.count);
  const status = sn.doneToday
    ? "今天已經完成，火焰保住了"
    : sn.count ? "今天還沒完成任何一題計分題，過了午夜就會歸零" : "完成一題計分題，點燃第一天";
  return `
    <div class="streak-card${sn.doneToday ? " is-lit" : ""}">
      <span class="flame" aria-hidden="true">🔥</span>
      <div>
        <p class="streak-count"><b>${sn.count}</b> 天連續學習</p>
        <p class="muted small">${status}${next ? `・再 ${next.days - sn.count} 天：${esc(next.label.split("：")[1] || next.label)}` : ""}</p>
        ${sn.double ? `<p class="double">今天答對的盃數加倍！</p>` : ""}
      </div>
    </div>`;
}

/**
 * 段位之路：每個大段位一張卡，可以左右滑動（電腦用左右箭頭）。
 * 卡片下方是這個段位的進度條，標出 I、II、III 三階的起始盃數；目前所在的段位會標出「你在這裡」。
 */
export function rankRoadHTML(ctx) {
  const trophies = ctx.state().trophies;
  const ranks = ctx.game.ranks;
  const cur = ctx.game.tierOf(trophies).ri;
  const ROMAN = ["I", "II", "III"];
  const slides = ranks.map((r, ri) => {
    const start = r.tiers[0];
    const end = ranks[ri + 1]?.tiers[0] ?? null;
    const state = ri < cur ? "done" : ri === cur ? "current" : "locked";
    const pct = end == null ? (trophies >= start ? 100 : 0) : Math.max(0, Math.min(1, (trophies - start) / (end - start))) * 100;
    const pos = (v) => (end == null ? 0 : ((v - start) / (end - start)) * 100);
    const ticks = r.tiers.map((t, ti) => `
      <span class="tick${trophies >= t ? " is-reached" : ""}" style="left:${pos(t)}%">
        <span class="tick-dot">${trophies >= t ? "✓" : ""}</span>
        <span class="tick-label">${r.tiers.length > 1 ? ROMAN[ti] : ""}<small>${t}</small></span></span>`).join("");
    return `
      <li class="road-slide is-${state}" style="--rank:${r.color}" data-ri="${ri}" aria-label="${r.name}${state === "current" ? "（目前段位）" : ""}">
        <div class="road-emblem">${rankBadge({ rank: r, ti: null, label: r.name }, "hero")}</div>
        <p class="road-name">${r.name} <span>${r.en}</span></p>
        <p class="road-rule">答對 +${r.win}　答錯 ${r.loss ? "−" + r.loss : "不扣"}　${r.match?.seconds ? `${r.match.seconds} 秒` : "不計時"}・${r.match?.questions || ""} 回合</p>
        <div class="road-bar">
          <div class="road-fill" style="width:${pct}%"></div>
          ${ticks}
          ${end != null ? `<span class="tick tick-end" style="left:100%"><span class="tick-label"><small>${end}</small></span></span>` : ""}
          ${state === "current" ? `<span class="road-you" style="left:${end == null ? 4 : pct}%">你在這裡・${trophies} 盃</span>` : ""}
        </div>
        <p class="road-state">${state === "done" ? "✓ 已通過" : state === "current" ? (end == null ? "已經是最高段位" : `再 ${end - trophies} 盃晉級 ${ranks[ri + 1].name}`) : `從 ${start} 盃開始`}</p>
      </li>`;
  }).join("");
  return `
    <div class="road-wrap">
      <button class="road-nav prev" data-road="-1" aria-label="上一個段位">‹</button>
      <ol class="road-track" tabindex="0" aria-label="段位之路，可以左右滑動">${slides}</ol>
      <button class="road-nav next" data-road="1" aria-label="下一個段位">›</button>
    </div>
    <div class="road-dots" aria-hidden="true">${ranks.map((r, ri) => `<span class="${ri === cur ? "is-current" : ""}" style="--rank:${r.color}" data-ri="${ri}"></span>`).join("")}</div>`;
}

/** 段位之路的互動：一開始捲到目前的段位；箭頭換頁；下方圓點跟著亮 */
export function setupRankRoad(root, ctx) {
  const track = root.querySelector(".road-track");
  if (!track) return;
  const slides = [...track.children];
  const dots = [...root.querySelectorAll(".road-dots span")];
  const cur = ctx.game.tierOf(ctx.state().trophies).ri;
  const go = (i, smooth = true) => {
    const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
    track.scrollTo({ left: s.offsetLeft, behavior: smooth ? "smooth" : "auto" });
  };
  const at = () => slides.reduce((best, sl, i) => (Math.abs(sl.offsetLeft - track.scrollLeft) < Math.abs(slides[best].offsetLeft - track.scrollLeft) ? i : best), 0);
  requestAnimationFrame(() => go(cur, false));
  root.querySelectorAll("[data-road]").forEach((b) => b.addEventListener("click", () => go(at() + Number(b.dataset.road))));
  dots.forEach((d) => d.addEventListener("click", () => go(Number(d.dataset.ri))));
  track.addEventListener("scroll", () => {
    const i = at();
    dots.forEach((d, j) => d.classList.toggle("is-on", j === i));
  }, { passive: true });
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(at() + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(at() - 1); }
  });
}
