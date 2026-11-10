// 檢查 data/event-sources.json 裡「enabled: true」的來源，找出有沒有新的文件，寫進 inbox/new-items.json。
// 只用 Node.js 內建功能，不需要任何金鑰。這支工具只負責「找新東西」，不判斷哪些算重大事件。
//
// 用法：
//   node tools/watch-sources.mjs                    檢查所有開啟的來源（只看上次檢查之後的新文件）
//   node tools/watch-sources.mjs --since=2026-10-01 從指定日期開始看（忽略上次檢查的紀錄）
//   node tools/watch-sources.mjs --only=sec-tsm     只檢查某幾個來源（用逗號分隔代號）
//   node tools/watch-sources.mjs --dry              只列出，不更新「已看過」的紀錄
//
// 「已看過」的紀錄存在 tools/watch-state.json，這樣同一份文件不會被重複處理。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").split("=")[1];
const dry = args.includes("--dry");
const only = opt("only")?.split(",");
const UA = { "User-Agent": "SemiMapStudentProject research-bot@example.org" };
const BROWSER_UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36", Accept: "application/rss+xml,application/xml,text/xml,*/*" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJSON = (f, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(root, f), "utf8")); } catch { return fallback; } };
const day = (d) => new Date(d).toISOString().slice(0, 10);

const cfg = readJSON("data/event-sources.json", { sources: [], rules: {} });
const statePath = "tools/watch-state.json";
const state = readJSON(statePath, { lastRun: null, seen: {} });
const lookback = cfg.rules?.defaultLookbackDays ?? 14;
const maxItems = cfg.rules?.maxItemsPerSource ?? 10;
const since = opt("since") || (state.lastRun ? day(state.lastRun) : day(Date.now() - lookback * 864e5));

const items = [];
const problems = [];

// ---- 美國證券交易委員會（SEC）：公司申報 ----
let tickerMap;
async function secItems(src) {
  const { ticker, forms } = src.params;
  tickerMap ||= await (await fetch("https://www.sec.gov/files/company_tickers.json", { headers: UA })).json();
  const co = Object.values(tickerMap).find((x) => x.ticker === ticker);
  if (!co) throw new Error(`找不到股票代號 ${ticker}`);
  await sleep(300);
  const sub = await (await fetch(`https://data.sec.gov/submissions/CIK${String(co.cik_str).padStart(10, "0")}.json`, { headers: UA })).json();
  const r = sub.filings.recent;
  const out = [];
  for (let i = 0; i < r.form.length && out.length < maxItems; i++) {
    if (!forms.includes(r.form[i]) || r.filingDate[i] < since) continue;
    const folder = `https://www.sec.gov/Archives/edgar/data/${co.cik_str}/${r.accessionNumber[i].replace(/-/g, "")}/`;
    const exhibits = [];
    if (r.form[i] === "6-K" || r.form[i] === "8-K") {
      await sleep(300);
      const idx = await fetch(`${folder}index.json`, { headers: UA }).then((x) => x.json()).catch(() => null);
      for (const f of idx?.directory?.item || []) {
        if (/\.(htm|html)$/i.test(f.name) && f.name !== r.primaryDocument[i] && !/index/i.test(f.name)) exhibits.push(folder + f.name);
      }
    }
    out.push({
      key: `sec:${r.accessionNumber[i]}`, date: r.filingDate[i], kind: "官方申報",
      title: `${co.title}（${ticker}）${r.form[i]}${r.items?.[i] ? `，項目 ${r.items[i]}` : ""}：${r.primaryDocument[i]}`,
      form: r.form[i], items: r.items?.[i] || "", url: folder + r.primaryDocument[i], exhibits,
    });
  }
  return out;
}

// ---- 美國聯邦公報（Federal Register）：政府公告（例如出口管制）----
async function frItems(src) {
  const { agency, terms = [""], types = [] } = src.params;
  const seen = new Map();
  for (const term of terms) {
    const q = new URLSearchParams({ per_page: String(maxItems), order: "newest" });
    q.append("conditions[agencies][]", agency);
    q.append("conditions[publication_date][gte]", since);
    if (term) q.append("conditions[term]", term);
    const FR_TYPE = { "Rule": "RULE", "Proposed Rule": "PRORULE", "Notice": "NOTICE" };
    for (const t of types) if (FR_TYPE[t]) q.append("conditions[type][]", FR_TYPE[t]);
    await sleep(300);
    const j = await (await fetch(`https://www.federalregister.gov/api/v1/documents.json?${q}`, { headers: UA })).json();
    for (const d of j.results || []) if (!seen.has(d.document_number)) seen.set(d.document_number, d);
  }
  return [...seen.values()].slice(0, maxItems).map((d) => ({
    key: `fr:${d.document_number}`, date: d.publication_date, kind: "政府公告",
    title: `${d.type}：${d.title}`, url: d.html_url, exhibits: d.pdf_url ? [d.pdf_url] : [],
  }));
}

// ---- RSS／Atom：媒體與研究機構的新聞（二手來源）----
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/<[^>]+>/g, "").trim();
const tag = (s, t) => { const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? decode(m[1]) : ""; };
async function rssItems(src) {
  const { url, keywords = [] } = src.params;
  const xml = await (await fetch(url, { headers: BROWSER_UA, signal: AbortSignal.timeout(20000) })).text();
  const blocks = xml.match(/<(item|entry)[ >][\s\S]*?<\/\1>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const title = tag(b, "title");
    const link = tag(b, "link") || (b.match(/<link[^>]+href="([^"]+)"/i) || [])[1] || "";
    const date = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated");
    const d = date ? new Date(date) : null;
    if (d && !isNaN(d) && day(d) < since) continue;
    if (keywords.length && !keywords.some((k) => title.toLowerCase().includes(k.toLowerCase()))) continue;
    out.push({ key: `rss:${tag(b, "guid") || link}`, date: d && !isNaN(d) ? day(d) : "", kind: "新聞", title, url: link, exhibits: [] });
    if (out.length >= maxItems) break;
  }
  return out;
}

const HANDLERS = { sec: secItems, "federal-register": frItems, rss: rssItems };

const active = cfg.sources.filter((s) => s.enabled && (!only || only.includes(s.id)));
console.log(`檢查 ${active.length} 個來源，從 ${since} 之後的新文件\n`);
for (const src of active) {
  try {
    const found = await HANDLERS[src.kind](src);
    const fresh = found.filter((x) => !state.seen[x.key]);
    for (const x of fresh) items.push({ source: src.id, sourceName: src.name, type: src.type, nodes: src.nodes, ...x });
    console.log(`✓ ${src.id.padEnd(24)} 找到 ${found.length} 筆，其中 ${fresh.length} 筆沒看過`);
  } catch (err) {
    problems.push({ source: src.id, error: err.message });
    console.log(`✗ ${src.id.padEnd(24)} 失敗：${err.message}`);
  }
}

items.sort((a, b) => b.date.localeCompare(a.date));
fs.mkdirSync(path.join(root, "inbox"), { recursive: true });
fs.writeFileSync(path.join(root, "inbox/new-items.json"), JSON.stringify({ checkedAt: new Date().toISOString(), since, items, problems }, null, 2));

console.log(`\n共 ${items.length} 筆新文件（已存到 inbox/new-items.json）`);
for (const x of items) {
  console.log(`\n[${x.date}] ${x.type}｜${x.sourceName}\n  ${x.title}\n  ${x.url}`);
  for (const e of x.exhibits.slice(0, 4)) console.log(`  附件：${e}`);
}
if (problems.length) console.log(`\n有 ${problems.length} 個來源失敗，下次再試。`);

if (!dry) {
  for (const x of items) state.seen[x.key] = x.date;
  state.lastRun = new Date().toISOString();
  fs.writeFileSync(path.join(root, statePath), JSON.stringify(state, null, 2) + "\n");
}
