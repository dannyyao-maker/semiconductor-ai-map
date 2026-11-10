// 段位：整頁是目前（或你點選）那個段位的顏色。大徽章、三階小點、盃數進度條，下方一排段位可以點。
// 規則只用圖示和數字：答對加幾盃、答錯扣幾盃、每題幾秒、一局幾題。沒有說明文字，也沒有白色方框。
import { esc } from "../util.js";
import { ic } from "../icons.js";
import { rankBadge } from "../game.js";

const ROMAN = ["I", "II", "III"];

export function mountLeague(root, ctx) {
  let sel = ctx.game.standing().tier.ri;
  root.classList.add("bleed");

  function render() {
    const st = ctx.game.standing();
    const ranks = ctx.game.ranks;
    const r = ranks[sel];
    const isCur = sel === st.tier.ri;
    const past = sel < st.tier.ri;
    const m = r.match || {};
    const start = r.tiers[0];
    const end = ranks[sel + 1]?.tiers[0] ?? null;
    const tier = isCur ? st.tier : ctx.game.tierOf(start);
    const pips = r.tiers.length > 1
      ? `<ol class="lg-pips">${r.tiers.map((t, i) => `<li class="${past || (isCur && st.trophies >= t) ? "is-on" : ""}${isCur && st.tier.ti === i ? " is-now" : ""}">${ROMAN[i]}</li>`).join("")}</ol>` : "";
    // 目前段位：進度條；沒到的段位：鎖頭和需要的盃數；過了的段位：勾
    let status;
    if (isCur) {
      const pct = Math.round(st.progress * 100);
      status = `<div class="lg-now"><b class="lg-num">${ic("trophy")}${st.trophies}</b>
        ${st.next ? `<div class="lg-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div><span class="lg-to">${ic("shield")}<b>${st.next.from}</b></span>` : ""}</div>`;
    } else if (past) status = `<div class="lg-now"><span class="lg-done">${ic("check")}</span></div>`;
    else status = `<div class="lg-now"><b class="lg-num is-lock">${ic("lock")}${start}</b></div>`;

    root.innerHTML = `
      <div class="lg" style="--rank:${esc(r.color)};--rank2:${esc(r.color2 || r.color)}">
        <div class="lg-hero">
          <div class="lg-badge">${rankBadge({ rank: r, ti: isCur ? st.tier.ti : (past ? r.tiers.length - 1 : 0), label: r.name }, "hero")}</div>
          <h2 class="lg-name">${esc(r.name)}</h2>
          ${pips}
          ${status}
          <ul class="lg-rules" aria-label="${esc(r.name)}的規則">
            <li class="ok" title="答對">${ic("check")}<b>+${r.win}</b></li>
            <li class="ng" title="答錯">${ic("cross")}<b>${r.loss ? "−" + r.loss : "0"}</b></li>
            <li title="每題秒數">${ic("clock")}<b>${m.seconds || "∞"}</b></li>
            <li title="一局題數">${ic("question")}<b>${m.questions || "?"}</b></li>
          </ul>
        </div>
        <div class="lg-strip" role="tablist" aria-label="段位">
          ${ranks.map((x, i) => `<button type="button" role="tab" aria-selected="${i === sel}" aria-label="${esc(x.name)}" class="lg-chip${i === sel ? " is-sel" : ""}${i === st.tier.ri ? " is-cur" : ""}${i > st.tier.ri ? " is-far" : ""}" data-i="${i}" style="--rank:${esc(x.color)}">
            ${rankBadge({ rank: x, ti: i === st.tier.ri ? st.tier.ti : 0, label: x.name }, "md")}</button>`).join("")}
        </div>
      </div>`;
    root.querySelector(".lg-chip.is-sel")?.scrollIntoView({ inline: "center", block: "nearest" });
  }

  root.addEventListener("click", (e) => {
    const b = e.target.closest(".lg-chip");
    if (!b) return;
    sel = Number(b.dataset.i);
    render();
  });

  render();
  const off = ctx.onState(render);
  return { unmount: () => { off(); root.classList.remove("bleed"); } };
}
