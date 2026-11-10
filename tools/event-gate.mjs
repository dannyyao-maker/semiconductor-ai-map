// 事件「閘門」：用程式先做完所有不需要 AI 的工作，AI 只處理真的值得做的事件，最省 token。
//   1. 呼叫 watch-sources 找新文件   2. 用規則打分數，濾掉例行公告   3. 只對高分文件下載原文，
//   4. 從原文挑出「含數字的重點句」（證據包，約 6,000 字），不用讓 AI 讀整份文件。
// 沒有值得做的事件時，只印一行「NO_EVENTS」，並把「已看過」紀錄存好；AI 看到就可以直接收工。
// 用法：node tools/event-gate.mjs [--since=日期] [--min=4] [--max=2]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.find((a) => a.startsWith(`--${n}=`)) || `=${d}`).split("=")[1];
const MIN = Number(opt("min", 4)), MAX = Number(opt("max", 2)), BUDGET = Number(opt("chars", 4500));
const node = (script, a) => execFileSync(process.execPath, [path.join(root, "tools", script), ...a], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180000 });

// 1) 找新文件（輸出很長，這裡不印，只讀 inbox/new-items.json）
try { node("watch-sources.mjs", args.filter((a) => a.startsWith("--since="))); } catch (e) { console.log("WATCH_FAILED " + String(e.message).split("\n")[0]); process.exit(0); }
const inbox = JSON.parse(fs.readFileSync(path.join(root, "inbox/new-items.json"), "utf8"));

// 2) 打分數：規則寫死，不花 token
const HOT_ZH = /營收|財測|毛利|資本支出|擴廠|設廠|出口管制|禁令|制裁|關稅|漲價|降價|缺貨|供不應求|減產|擴產|產能|併購|財報|法說|良率|訂單/;
const HOT_EN = /revenue|guidance|capex|capital expenditure|export control|entity list|advanced computing|tariff|acquisition|merger|price (increase|cut)|shortage|expansion|earnings|results/i;
const ROUTINE = /dividend|股利|股息|director|董事|proxy|prospectus|S-8|insider|Form 4|registration|exchange offer|annual meeting/i;
function score(x) {
  let s = 0;
  if (x.kind === "官方申報") {
    if (/2\.02/.test(x.items)) s += 5;
    else if (x.form === "10-Q" || x.form === "10-K") s += 4;
    else if (x.form === "6-K" && x.exhibits.length) s += /ex99|ex-99|press|release|1q|2q|3q|4q|earn|result/i.test(x.exhibits.join(" ")) ? 4 : 2;
    else if (/1\.01|2\.01|7\.01|8\.01/.test(x.items)) s += 3;
    if (ROUTINE.test(x.title)) s -= 3;
  } else if (x.kind === "政府公告") {
    s += /semiconductor|advanced computing|entity list|artificial intelligence|chips/i.test(x.title) ? 4 : 1;
    if (/^Notice/.test(x.title) && !/rule|control|license/i.test(x.title)) s -= 1;
  } else {
    s += HOT_ZH.test(x.title) || HOT_EN.test(x.title) ? 3 : 0;
    if (/\d+(\.\d+)?\s?(%|億|兆|美元|billion|million)/i.test(x.title)) s += 1;
    if (/據傳|傳出|消息人士|未經證實|rumor|reportedly/i.test(x.title)) s -= 5;
  }
  return s;
}
const ranked = inbox.items.map((x) => ({ ...x, score: score(x) })).sort((a, b) => b.score - a.score);
const hot = ranked.filter((x) => x.score >= MIN).slice(0, MAX);

// 把網站來源失敗也帶出去，但只用一行
const problems = inbox.problems.map((p) => p.source).join(",");

if (!hot.length) {
  console.log(`NO_EVENTS（新文件 ${inbox.items.length} 筆，最高分 ${ranked[0]?.score ?? 0}，門檻 ${MIN}${problems ? `；來源失敗：${problems}` : ""}）`);
  process.exit(0);
}

const split = (t) => t.replace(/\s+/g, " ").split(/(?<=[。！？])\s*|(?<=[a-z0-9)%]\.)\s+(?=[A-Z"“])/);
const SENT = /[^。.!?\n]{12,400}[。.!?]?/g;
const KEY = /(revenue|margin|guidance|capital expenditure|net income|operating|expect|increase|decrease|billion|million|%|營收|毛利|財測|資本支出|淨利|預期|成長|衰退|億|百分)/i;
function evidence(text) {
  const seen = new Set(), out = [];
  let n = 0;
  for (const s of split(text)) {
    const t = s.trim().slice(0, 320);
    if (t.length < 15 || !/d/.test(t) || !KEY.test(t) || seen.has(t)) continue;
    seen.add(t);
    if (n + t.length > BUDGET) break;
    out.push(t); n += t.length;
  }
  return out;
}
const result = [];
for (const x of hot) {
  const id = "auto-" + crypto.createHash("sha1").update(x.key).digest("hex").slice(0, 8);
  const target = (x.exhibits.find((e) => /ex99|ex-99|\.pdf$/i.test(e)) || x.exhibits[0] || x.url);
  let ev = [], note = "";
  try { node("fetch-text.mjs", [target, id]); ev = evidence(fs.readFileSync(path.join(root, "sources/texts", id + ".txt"), "utf8")); }
  catch (e) { note = "原文下載失敗或被擋：" + String(e.stdout || e.message).split("\n").find(Boolean); }
  result.push({ id, score: x.score, date: x.date, type: x.type, source: x.sourceName, title: x.title, url: x.url, textFile: `sources/texts/${id}.txt`, nodes: x.nodes, note, evidence: ev });
}
console.log(JSON.stringify({ candidates: result, skipped: ranked.length - hot.length, problems }, null, 1));
