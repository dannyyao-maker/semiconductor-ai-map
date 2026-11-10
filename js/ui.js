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
