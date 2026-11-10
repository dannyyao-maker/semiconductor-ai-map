// 事件任務的自動檢查：事件上線前一定要通過。
// 白話：事件裡寫的每一個數字，都要在它引用的「原始文件」裡找得到；找不到的不能上線。
//
// 檢查內容：
//   1. 格式：欄位齊全、環節代碼和來源代碼存在、題目答案沒有超出選項、圖表資料長度對得上
//   2. 來源：官方事件只能引用官方來源；二手事件至少要兩個獨立發布者，且不能把傳聞當事實
//   3. 數字：文字、重點數字、圖表裡的每個數字，要在引用的原文裡找得到
//      （原文放在 sources/texts/<來源代號>.txt，用 tools/fetch-text.mjs 下載）
//      自己推算出來的數字（例如 100% 減去 79%）要寫進事件的 derived，並說明怎麼算，檢查會列出來給你看。
//
// 用法：
//   node tools/check-event.mjs                         檢查 data/events.json 裡全部事件
//   node tools/check-event.mjs --id=tsmc-3q26-call     只檢查一個事件
//   node tools/check-event.mjs --file=drafts/x.json    檢查一個草稿檔
//   node tools/check-event.mjs --file=drafts/x.json --publish   通過的事件，加進 data/events.json 上線
//
// 結論有兩種：auto（通過所有檢查，可以直接上線）、reject（有錯誤，不能上線）。
// 官方來源和常被引用的二手來源（研究機構、主流媒體）都可以自動上線；二手來源的標準比較嚴：
// 至少兩個獨立發布者、原文要抓得到、數字要對得上，而且不能把傳聞當成事實。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const asJSON = args.includes("--json");
const publish = args.includes("--publish");
const textsDir = path.join(root, opt("texts") || "sources/texts");
const readJSON = (f) => JSON.parse(fs.readFileSync(path.isAbsolute(f) ? f : path.join(root, f), "utf8"));

const nodes = new Set(readJSON("data/nodes.json").nodes.map((n) => n.id));
const sources = Object.fromEntries(readJSON("data/sources.json").map((s) => [s.id, s]));
const SCREENS = new Set(["story", "kpi", "line", "dbars", "segbar", "matrix", "stat", "bars", "compare", "flow", "choice"]);
const AUTO_STATUS = "自動整理・待審核";

// ---------- 走訪事件裡的所有文字與數字 ----------
/** 取出所有「讀者會看到的文字」，並標出位置。題目的錯誤選項（干擾項）故意不放進來。 */
function collectStrings(ev) {
  const out = [];
  const add = (where, v) => { if (typeof v === "string" && v.trim()) out.push({ where, text: v }); };
  const spec = (where, s) => {
    for (const k of ["title", "subtitle", "text", "speaker", "yLabel", "footnote", "prompt", "explain", "valueName"]) add(`${where}.${k}`, s[k]);
    (s.items || []).forEach((it, i) => { for (const k of ["label", "value", "delta", "note"]) add(`${where}.items[${i}].${k}`, it[k]); });
    (s.rows || []).forEach((r, i) => (r.cells || []).forEach((c, j) => add(`${where}.rows[${i}].cells[${j}]`, c.text)));
  };
  for (const k of ["title", "summary", "conclusion"]) add(k, ev[k]);
  ev.briefing?.forEach((s, i) => spec(`briefing[${i}]`, s));
  if (ev.matrix) spec("matrix", ev.matrix);
  ev.impacts?.forEach((x, i) => add(`impacts[${i}].reason`, x.reason));
  ev.questions?.forEach((q, i) => {
    add(`questions[${i}].prompt`, q.prompt); add(`questions[${i}].explain`, q.explain);
    add(`questions[${i}].correct`, q.options?.[q.answer]);
    if (q.visual) spec(`questions[${i}].visual`, q.visual);
  });
  return out;
}

/** 圖表裡的數字：{ where, n, scales } scales 是容許的單位換算（例如「億美元」是原文「十億美元」的 10 倍） */
function collectChartNumbers(ev) {
  const out = [];
  const one = (where, s) => {
    const sc = /億/.test(`${s.title || ""}${s.subtitle || ""}${s.yLabel || ""}`) ? [1, 10] : [1];
    if (s.type === "line") (s.series || []).forEach((se, k) => {
      se.values.forEach((v, i) => { if (!(se.range && se.range.i === i)) out.push({ where: `${where}.series[${k}].values[${i}]`, n: v, scales: sc }); });
      if (se.range) for (const e of ["lo", "hi"]) out.push({ where: `${where}.series[${k}].range.${e}`, n: se.range[e], scales: sc });
    });
    if (s.type === "dbars") (s.items || []).forEach((it, i) => { out.push({ where: `${where}.items[${i}].value`, n: Math.abs(it.value), scales: [1] }); if (it.share != null) out.push({ where: `${where}.items[${i}].share`, n: it.share, scales: [1] }); });
    if (s.type === "segbar") (s.items || []).forEach((it, i) => out.push({ where: `${where}.items[${i}].value`, n: it.value, scales: [1] }));
  };
  ev.briefing?.forEach((s, i) => one(`briefing[${i}]`, s));
  ev.questions?.forEach((q, i) => q.visual && one(`questions[${i}].visual`, q.visual));
  return out;
}

// ---------- 從文字裡找數字 ----------
function tokens(text) {
  const t = text
    .replace(/\d{4}-\d{2}-\d{2}/g, " ")           // 日期
    .replace(/\d?[1-4]Q\d{2}|FY\d{2,4}/gi, " ")   // 3Q26 這類期間
    .replace(/[×x]\s?\d+/g, " ");                  // ×2 倍數
  const out = [];
  for (const m of t.matchAll(/(\d[\d,]*(?:\.\d+)?)/g)) {
    const raw = m[1].replace(/,/g, "");
    const n = Number(raw);
    const dec = (raw.split(".")[1] || "").length;
    if (!dec && n >= 1990 && n <= 2035) continue;  // 年份
    if (!dec && n <= 10) continue;                  // 「5 張」「3 題」這類小整數
    if (n === 100) continue;
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 8);
    out.push({ raw, n, dec, scales: /億/.test(after) ? [1, 10] : [1] });
  }
  return out;
}

const nums = new Map(); // 來源代號 → 原文裡出現過的所有數字
function sourceNumbers(id) {
  if (nums.has(id)) return nums.get(id);
  const f = path.join(textsDir, `${id}.txt`);
  if (!fs.existsSync(f)) { nums.set(id, null); return null; }
  const set = new Set();
  for (const m of fs.readFileSync(f, "utf8").matchAll(/\d[\d,]*(?:\.\d+)?/g)) set.add(Number(m[0].replace(/,/g, "")));
  nums.set(id, [...set]);
  return nums.get(id);
}
const found = (n, dec, scales, pool) => pool.some((m) => scales.some((s) => Number((m * s).toFixed(dec)) === n));

// ---------- 主要檢查 ----------
function check(ev) {
  const errors = [], warnings = [], info = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);

  // 1. 格式
  for (const k of ["id", "date", "title", "summary", "origin", "status", "conclusion"]) if (!ev[k] || typeof ev[k] !== "string") err(`缺少欄位：${k}`);
  if (ev.date && !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) err(`date 格式要是 YYYY-MM-DD：${ev.date}`);
  if (ev.date && new Date(ev.date) > new Date(Date.now() + 864e5)) err("date 是未來的日期");
  if (!["官方", "二手"].includes(ev.origin)) err(`origin 只能是「官方」或「二手」：${ev.origin}`);
  if (!Array.isArray(ev.nodes) || !ev.nodes.length) err("nodes 要列出需要先懂的環節");
  (ev.nodes || []).forEach((n) => nodes.has(n) || err(`nodes 裡有不存在的環節代碼：${n}`));
  if (!Array.isArray(ev.impacts) || ev.impacts.length < 2) err("impacts 至少要 2 個環節");
  (ev.impacts || []).forEach((x, i) => {
    nodes.has(x.node) || err(`impacts[${i}].node 不存在：${x.node}`);
    ["+", "-", "0"].includes(x.effect) || err(`impacts[${i}].effect 只能是 + - 0`);
    x.reason || err(`impacts[${i}] 缺少 reason`);
  });
  if (!Array.isArray(ev.briefing) || ev.briefing.length < 3) err("briefing 至少要 3 張");
  (ev.briefing || []).forEach((s, i) => {
    SCREENS.has(s.type) || err(`briefing[${i}].type 不支援：${s.type}`);
    chartShape(`briefing[${i}]`, s, err);
  });
  if (ev.matrix) chartShape("matrix", ev.matrix, err);
  if (!Array.isArray(ev.questions) || ev.questions.length !== 3) err("questions 要剛好 3 題");
  const qids = new Set();
  (ev.questions || []).forEach((q, i) => {
    const w = `questions[${i}]`;
    if (!/^event\./.test(q.id || "")) err(`${w}.id 要以 event. 開頭`);
    if (qids.has(q.id)) err(`${w}.id 重複：${q.id}`); qids.add(q.id);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 5) err(`${w}.options 要有 2–5 個`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length || 0)) err(`${w}.answer 超出選項範圍`);
    if (!q.explain) err(`${w} 缺少 explain（答錯沒有解析，學習效果很差）`);
    if (![1, 2, 3].includes(q.difficulty)) err(`${w}.difficulty 要是 1、2、3`);
    if (!q.sources?.length) err(`${w} 缺少 sources`);
    if (q.visual) chartShape(`${w}.visual`, q.visual, err);
  });

  // 2. 來源
  const cited = new Set(ev.sources || []);
  const grab = (o) => { if (o && typeof o === "object") { if (Array.isArray(o.sources)) o.sources.forEach((s) => cited.add(s)); Object.values(o).forEach(grab); } };
  grab(ev.briefing); grab(ev.matrix); grab(ev.questions);
  if (!cited.size) err("沒有引用任何來源");
  for (const id of cited) sources[id] || err(`來源代碼不存在於 data/sources.json：${id}`);
  const known = [...cited].map((id) => sources[id]).filter(Boolean);
  if (ev.origin === "官方") {
    const bad = known.filter((s) => s.type !== "官方");
    if (bad.length) err(`標成「官方」的事件只能引用官方來源，但引用了：${bad.map((s) => `${s.id}（${s.type}）`).join("、")}`);
  } else if (ev.origin === "二手") {
    const pubs = new Set(known.map((s) => s.publisher));
    if (pubs.size < 2) err("二手來源的事件至少要有兩個獨立的發布者，或追到官方原始資料");
  }

  // 3. 數字要在原文找得到
  const pools = [...cited].map((id) => ({ id, pool: sourceNumbers(id) }));
  const missingText = pools.filter((p) => !p.pool).map((p) => p.id);
  for (const id of missingText) (sources[id]?.type === "官方" ? err : warn)(`找不到來源原文 sources/texts/${id}.txt（先用 tools/fetch-text.mjs 下載）`);
  const pool = pools.flatMap((p) => p.pool || []);
  // derived：有寫 at（位置）的，只在那個位置算推算；沒寫 at 的，原文找不到時才算推算
  const derivedList = (ev.derived || []).map((d) => ({ n: Number(String(d.value).replace(/,/g, "")), why: d.why, at: d.at }));
  let checked = 0, viaDerived = 0;
  const miss = [];
  const verify = (where, n, dec, scales) => {
    checked++;
    const here = derivedList.find((d) => d.n === n && d.at?.includes(where));
    if (here) { viaDerived++; info.push(`推算：${where} 的 ${n} ＝ ${here.why}`); return; }
    if (found(n, dec, scales, pool)) return;
    const any = derivedList.find((d) => d.n === n && !d.at);
    if (any) { viaDerived++; info.push(`推算：${where} 的 ${n} ＝ ${any.why}`); return; }
    miss.push(`${where}：${n}`);
  };
  if (pool.length) {
    for (const { where, text } of collectStrings(ev)) for (const t of tokens(text)) verify(where, t.n, t.dec, t.scales);
    for (const c of collectChartNumbers(ev)) verify(c.where, c.n, (String(c.n).split(".")[1] || "").length, c.scales);
  }
  if (!pool.length) err("沒有任何來源原文可以對照數字，所以不能證明事件裡的數字是對的");
  const uniq = [...new Set(miss)];
  uniq.forEach((m) => err(`數字在原文找不到：${m}（找不到就不能上線；如果是自己推算的，請寫進 derived 並說明怎麼算）`));
  info.push(`檢查了 ${checked} 個數字，${checked - viaDerived - miss.length} 個在原文找到，${viaDerived} 個是標明的推算，${miss.length} 個找不到`);

  // 傳聞不能當事實寫：要改成「某某媒體報導」並找到第二個獨立來源，或直接不寫
  const rumor = /據傳|傳聞|未經證實|消息人士稱|rumou?r|unconfirmed|allegedly/i;
  for (const { where, text } of collectStrings(ev)) if (rumor.test(text)) err(`${where} 出現傳聞用語，不能當成事實寫：「${text.match(rumor)[0]}」`);
  const verdict = errors.length ? "reject" : "auto";
  return { id: ev.id, verdict, errors, warnings, info };
}

/** 圖表資料的形狀：長度對得上、範圍合理 */
function chartShape(where, s, err) {
  if (s.type === "line") {
    if (!s.series?.length || !Array.isArray(s.x)) return err(`${where}：折線圖需要 x 和 series`);
    s.series.forEach((se, k) => {
      if (se.values?.length !== s.x.length) err(`${where}.series[${k}]：數值個數（${se.values?.length}）和 x 軸（${s.x.length}）不一樣`);
      if (se.values?.some((v) => typeof v !== "number")) err(`${where}.series[${k}]：values 要都是數字`);
      if (se.values?.some((v) => v < s.yMin || v > s.yMax)) err(`${where}.series[${k}]：有數值超出 yMin–yMax`);
    });
    if (!(s.yMin < s.yMax) || !(s.yStep > 0)) err(`${where}：yMin／yMax／yStep 設定不合理`);
  } else if (s.type === "dbars" || s.type === "segbar") {
    if (!s.items?.length || s.items.some((it) => typeof it.value !== "number")) err(`${where}：items 要有數字 value`);
    if (s.type === "segbar") { const t = (s.items || []).reduce((a, b) => a + b.value, 0); if (Math.abs(t - 100) > 1) err(`${where}：堆疊條合計是 ${t}，應該是 100`); }
  } else if (s.type === "matrix") {
    if (s.columns?.length !== 3) err(`${where}：矩陣要有 3 個欄位`);
    (s.rows || []).forEach((r, i) => { if (r.cells?.length !== s.columns?.length) err(`${where}.rows[${i}]：格子數和欄位數不一樣`); (r.node && !nodes.has(r.node)) && err(`${where}.rows[${i}].node 不存在：${r.node}`); });
  }
}

// ---------- 執行 ----------
let events;
const file = opt("file");
if (file) events = [readJSON(file)];
else {
  events = readJSON("data/events.json");
  if (opt("id")) events = events.filter((e) => e.id === opt("id"));
}
if (!events.length) { console.error("找不到要檢查的事件"); process.exitCode = 1; }

const reports = events.map(check);
if (asJSON) console.log(JSON.stringify(reports, null, 2));
else for (const r of reports) {
  const icon = { auto: "✅", reject: "❌" }[r.verdict];
  console.log(`\n${icon} ${r.id}　結論：${r.verdict}${{ auto: "（通過所有檢查，可以直接上線）", reject: "（有錯誤，不能上線）" }[r.verdict]}`);
  r.info.forEach((m) => console.log(`   · ${m}`));
  r.warnings.forEach((m) => console.log(`   ⚠ ${m}`));
  r.errors.forEach((m) => console.log(`   ✗ ${m}`));
}
if (reports.some((r) => r.verdict === "reject")) process.exitCode = 1;

// ---------- 上線：只有通過檢查的事件，才會加進 data/events.json ----------
if (publish) {
  if (!file) { console.error("--publish 要搭配 --file=草稿檔"); process.exitCode = 1; }
  else {
    const r = reports[0];
    if (r.verdict !== "auto") { console.error(`\n不能上線：結論是 ${r.verdict}。`); process.exitCode = 1; }
    else {
      const ev = { ...events[0], status: AUTO_STATUS };
      const target = path.join(root, "data/events.json");
      const all = readJSON("data/events.json").filter((e) => e.id !== ev.id);
      all.unshift(ev);
      all.sort((a, b) => b.date.localeCompare(a.date));
      fs.writeFileSync(target, JSON.stringify(all, null, 2) + "\n");
      console.log(`\n已加進 data/events.json（狀態：${AUTO_STATUS}）。`);
    }
  }
}
