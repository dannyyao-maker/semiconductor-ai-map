// 段位解鎖：這個段位開始，有什麼新東西。不手寫第二份：從 game.json（題目難度、每局題數與秒數）
// 和章節資料（minRank 的關卡，例如財報看圖）自動算出，之後改段位或新增關卡，提示會跟著變。
import { ic, levelIcon } from "./icons.js";
import { esc } from "./util.js";

/** 每個段位解鎖的項目：{ rankId: [{ kind: "diff"｜"part", level?, icon?, label }] } */
export async function rankUnlocks(ctx) {
  if (ctx._unlocks) return ctx._unlocks;
  const out = Object.fromEntries(ctx.game.ranks.map((r) => [r.id, []]));
  for (const d of ctx.config.difficulty?.levels || []) {
    if (d.level > 1 && out[d.minRank]) out[d.minRank].push({ kind: "diff", level: d.level, label: `${d.name}題` });
  }
  const seen = new Set();
  for (const c of ctx.chapterIndex.chapters) {
    if (!c.file) continue;
    const ch = await ctx.loadChapter(c.node);
    for (const p of ch.parts) {
      if (!p.minRank || seen.has(p.id) || !out[p.minRank]) continue;
      seen.add(p.id);
      out[p.minRank].push({ kind: "part", icon: levelIcon(p.sections[0].id), label: p.name });
    }
  }
  return (ctx._unlocks = out);
}

/** 一個解鎖項目的小標籤：圖示（難度用星星）加很短的名稱 */
export const unlockChip = (u) => u.kind === "diff"
  ? `<span class="uc is-diff">${ic(u.level >= 3 ? "lvl2" : "lvl1")}<b>${esc(u.label)}</b></span>`
  : `<span class="uc">${ic(u.icon)}<b>${esc(u.label)}</b></span>`;

/** 這個段位每局的題數與秒數（不計時用 ∞） */
export const matchChip = (rank) => {
  const m = rank.match || {};
  return `<span class="uc is-match" title="每局題數與每題秒數">${ic("question")}<b>${m.questions}</b>${ic("clock")}<b>${m.seconds || "∞"}</b></span>`;
};
