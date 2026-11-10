// 練習：每天的複習、隨時來一局、重練答錯的題、複習快忘了的單元。全部用圖示和數字，不放說明文字。
// 每日複習用間隔複習（見 game.js）：答錯的題今天就會回來，答對的題隔 1、3、7、14、30 天再出現。
import { esc } from "../util.js";
import { ic, unitIcon, mascot } from "../icons.js";
import { rankBadge } from "../game.js";
import { runMatch } from "../match.js";
import { makeDrills, wrongIds, wrongQuestions, dailyIds, dailyQuestions } from "../drills.js";

export function mountPractice(root, ctx) {
  function render() {
    const st = ctx.game.standing();
    const m = st.tier.rank.match || { questions: 4, seconds: 0 };
    const miss = wrongIds(ctx).length;
    const daily = dailyIds(ctx).length;
    const ahead = ctx.game.upcoming(7);
    const peak = Math.max(1, ...ahead);
    const stale = ctx.staleNodes();
    root.innerHTML = `
      <div class="pr">
        ${daily ? `<button class="pr-due" type="button" data-daily aria-label="今日複習，${daily} 題">
            <span class="pr-ic">${ic("hourglass")}</span><b>${daily}</b><span class="pr-go">${ic("play")}</span></button>` : ""}
        ${ahead.some((n, i) => i > 0 && n) ? `<ol class="pr-ahead" aria-label="未來 7 天各有幾題要複習">${ahead.map((n, i) => `
          <li class="${i === 0 ? "is-today" : ""}" title="${i === 0 ? "今天" : `${i} 天後`}：${n} 題"><i style="height:${n ? 14 + Math.round((n / peak) * 86) : 0}%"></i><span>${i === 0 ? "今" : i}</span></li>`).join("")}</ol>` : ""}
        <button class="pr-start" type="button" data-start style="--rank:${esc(st.tier.rank.color)}" aria-label="開始一局">
          <span class="pr-badge">${rankBadge(st.tier, "xl")}</span>
          <span class="pr-meta"><span>${ic("clock")}<b>${m.seconds || "∞"}</b></span><span>${ic("question")}<b>${m.questions}</b></span></span>
          <span class="pr-go">${ic("play")}</span>
        </button>
        ${miss ? `<button class="pr-miss" type="button" data-miss aria-label="重練答錯的題">
            <span class="pr-ic">${ic("cross")}</span><b>${miss}</b><span class="pr-go">${ic("play")}</span></button>` : ""}
        ${stale.length ? `<ul class="pr-stale">${stale.map(({ n, p }) => `
          <li><a class="pr-row z-${esc(n.zone)}" href="#/explore/${esc(n.id)}/review" aria-label="${esc(n.name)}，${p.days} 天沒複習">
            <span class="pr-uic">${ic(unitIcon(n.id))}</span><b>${esc(n.name)}</b>
            <span class="pr-days">${ic("hourglass")}${p.days}</span><span class="pr-bolt">${ic("bolt")}</span></a></li>`).join("")}</ul>` : ""}
        ${!miss && !daily && !stale.length ? `<div class="pr-empty">${mascot("happy", 110)}<span class="pr-empty-ok">${ic("check")}</span></div>` : ""}
      </div>`;
  }

  root.addEventListener("click", async (e) => {
    if (e.target.closest("[data-start]")) {
      runMatch(root, ctx, { key: "drill.seg", title: "練習", make: (n) => makeDrills(ctx, n), onExit: render });
    } else if (e.target.closest("[data-daily]")) {
      const qs = await dailyQuestions(ctx);
      if (qs.length) runMatch(root, ctx, { key: "drill.daily", title: "今日複習", practice: true, questions: qs, onExit: render });
    } else if (e.target.closest("[data-miss]")) {
      const qs = await wrongQuestions(ctx);
      if (qs.length) runMatch(root, ctx, { key: "drill.wrong", title: "重練", practice: true, questions: qs, onExit: render });
    }
  });

  render();
  const off = ctx.onState(() => { if (!document.querySelector(".arena")) render(); });
  return { unmount: off };
}
