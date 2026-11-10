// 練習題的來源：從公司資料自動產生「這家公司屬於哪個環節」，以及把答錯過的題目找回來重練。
import { state } from "./state.js";

const COUNTRY = { TW: "台灣", US: "美國", KR: "韓國", CN: "中國", JP: "日本", NL: "荷蘭" };
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/** 一題：這家公司屬於哪個環節？ */
export function makeDrill(ctx, c) {
  const right = ctx.nodeById[c.segments[0]];
  const others = shuffle(ctx.nodes.filter((n) => !c.segments.includes(n.id))).slice(0, 3);
  const options = shuffle([right, ...others]);
  const segs = c.segments.map((id) => ctx.nodeById[id]?.name).filter(Boolean).join("、");
  return {
    id: `drill.seg.${c.id}`,
    prompt: `${c.name}（${c.nameEn}）屬於哪個環節？`,
    options: options.map((n) => n.name),
    answer: options.indexOf(right),
    explain: `${c.name}${COUNTRY[c.country] ? `（${COUNTRY[c.country]}）` : ""}：${c.oneLiner}\n所屬環節：${segs}。`,
    sources: c.sources,
  };
}

/** 出 n 題，優先出還沒答過的公司，同一局不重複 */
export function makeDrills(ctx, n) {
  const answered = state().answers;
  const fresh = shuffle(ctx.companies.filter((c) => !answered[`drill.seg.${c.id}`]));
  const old = shuffle(ctx.companies.filter((c) => answered[`drill.seg.${c.id}`]));
  return [...fresh, ...old].slice(0, n).map((c) => makeDrill(ctx, c));
}

/** 目前答錯、還沒答對過的題目代碼 */
export const wrongIds = (ctx) => ctx.game.missedIds();

/** 每天複習最多幾題 */
export const DAILY_MAX = 10;

/**
 * 今天的複習清單（題目代碼）：
 * ① 答錯、還沒答對過的　② 「快忘了」環節裡答過的題（每個環節最多 2 題）　③ 其他到期的題（逾期最久的先）
 */
export function dailyIds(ctx, max = DAILY_MAX) {
  const game = ctx.game;
  const due = game.dueIds();
  const wrong = due.filter((id) => game.reviewEntry(id).box === 0);
  const rest = due.filter((id) => game.reviewEntry(id).box !== 0);
  const extras = [];
  for (const { n } of ctx.staleNodes()) {
    const mine = Object.keys(state().answers).filter((id) => id.startsWith(n.id + ".") && !due.includes(id))
      .sort((a, b) => (game.reviewEntry(a).due < game.reviewEntry(b).due ? -1 : 1));
    extras.push(...mine.slice(0, 2));
  }
  return [...new Set([...wrong, ...extras, ...rest])].slice(0, max);
}

/** 把題目代碼變回題目（公司題重新產生；章節題和事件題從資料檔找）。找不到的略過 */
export async function questionsByIds(ctx, ids) {
  if (!ids.length) return [];
  const byId = {};
  for (const ev of ctx.events) for (const q of ev.questions || []) byId[q.id] = q;
  const need = ids.some((id) => !id.startsWith("drill.") && !byId[id]);
  if (need) {
    for (const c of ctx.chapterIndex.chapters) {
      if (!c.file) continue;
      const ch = await ctx.loadChapter(c.node);
      for (const p of ch.parts) for (const s of p.sections) for (const x of s.screens) if (x.type === "quiz") byId[x.id] = x;
    }
  }
  const out = [];
  for (const id of ids) {
    if (id.startsWith("drill.seg.")) { const c = ctx.companyById[id.slice(10)]; if (c) out.push(makeDrill(ctx, c)); }
    else if (byId[id]) out.push(byId[id]);
  }
  return out;
}

export const wrongQuestions = (ctx) => questionsByIds(ctx, wrongIds(ctx));
export const dailyQuestions = (ctx) => questionsByIds(ctx, dailyIds(ctx));
