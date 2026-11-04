// 從美國證券交易委員會（SEC）查詢、下載公司的官方申報文件。只用 Node.js 內建功能。
//
// 用法：
//   node tools/sec-fetch.cjs TSM NVDA              下載最新年報（10-K 或 20-F）
//   node tools/sec-fetch.cjs TSM --form=6-K --list  只列出最近的 6-K（外國公司的季報、新聞稿），不下載
//   node tools/sec-fetch.cjs MU --form=10-Q         下載最新的季報（美國公司）
//   node tools/sec-fetch.cjs TSM --since=2026-10-01 --list   只列出某日期之後的申報（判斷「有沒有新資料」）
//
// 下載的檔案存到 sources/sec/（不會上傳 GitHub），sources/sec/index.json 記錄每份文件的網址與日期。
// 注意：6-K 的主文件常常只是封面，真正的內容在附件（EX-99）；用 --list 會一起列出附件網址。
const fs = require("fs");
const path = require("path");
const UA = { "User-Agent": "SemiMapStudentProject research-bot@example.org" };
const args = process.argv.slice(2);
const opt = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || "").split("=")[1];
const forms = opt("form") ? [opt("form")] : ["10-K", "20-F"];
const since = opt("since") || "";
const listOnly = args.includes("--list");
const tickers = args.filter((a) => !a.startsWith("--"));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "sources", "sec");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (url) => (await fetch(url, { headers: UA })).json();

(async () => {
  const map = await getJSON("https://www.sec.gov/files/company_tickers.json");
  const byTicker = Object.fromEntries(Object.values(map).map((x) => [x.ticker, x]));
  const index = [];
  for (const t of tickers) {
    const co = byTicker[t];
    if (!co) { console.log(t, "找不到這個股票代號"); continue; }
    await sleep(300);
    const r = (await getJSON(`https://data.sec.gov/submissions/CIK${String(co.cik_str).padStart(10, "0")}.json`)).filings.recent;
    const hits = r.form.map((f, i) => i).filter((i) => forms.includes(r.form[i]) && r.filingDate[i] >= since);
    if (!hits.length) { console.log(t, `沒有${since ? ` ${since} 之後的` : ""} ${forms.join("/")}`); continue; }
    const folder = (i) => `https://www.sec.gov/Archives/edgar/data/${co.cik_str}/${r.accessionNumber[i].replace(/-/g, "")}/`;

    if (listOnly) {
      for (const i of hits.slice(0, 10)) {
        console.log(`${t} ${r.form[i]} 申報日 ${r.filingDate[i]}  ${folder(i)}${r.primaryDocument[i]}`);
        await sleep(300);
        // 列出附件，找出真正的內容（例如 EX-99.1 新聞稿）
        const idx = await getJSON(`${folder(i)}index.json`).catch(() => null);
        for (const f of idx?.directory?.item || []) {
          if (/\.(htm|html|pdf)$/i.test(f.name) && f.name !== r.primaryDocument[i] && !/index/i.test(f.name)) console.log(`    附件：${folder(i)}${f.name}`);
        }
      }
      continue;
    }

    const i = hits[0];
    const url = folder(i) + r.primaryDocument[i];
    await sleep(300);
    const res = await fetch(url, { headers: UA });
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${t}-${r.form[i]}-${r.filingDate[i]}.htm`);
    fs.writeFileSync(file, buf);
    index.push({ ticker: t, name: co.title, form: r.form[i], filed: r.filingDate[i], period: r.reportDate[i], url, file: path.relative(root, file).split(path.sep).join("/") });
    console.log(`${t} ${r.form[i]} 申報日 ${r.filingDate[i]}（HTTP ${res.status}，${buf.length} bytes）→ ${path.relative(root, file)}`);
  }
  if (index.length) {
    const idxFile = path.join(outDir, "index.json");
    const old = fs.existsSync(idxFile) ? JSON.parse(fs.readFileSync(idxFile, "utf8")) : [];
    fs.writeFileSync(idxFile, JSON.stringify([...old.filter((o) => !index.some((n) => n.url === o.url)), ...index], null, 2));
  }
})();
