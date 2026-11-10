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

/** 答錯過的題目代碼 */
export function wrongIds() {
  return Object.entries(state().answers).filter(([, a]) => !a.ok).map(([id]) => id);
}

/** 把答錯過的題目找回來（公司題重新產生；章節題和事件題從資料檔找） */
export async function wrongQuestions(ctx) {
  const ids = wrongIds();
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
