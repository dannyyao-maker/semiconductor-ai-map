// 在官方文件（HTML）裡找關鍵字，印出前後文，用來對照原句。
// 用法：node tools/find-text.cjs sources/sec/TSM-20-F-2026-04-16.htm "dedicated foundry" [前後字數=200] [最多筆數=5]
// 關鍵字可以用正規表示式（regular expression），例如 "CoWoS|3DFabric"。
// 第一次會把 HTML 轉成純文字存成 .txt，之後搜尋會比較快。
const fs = require("fs");
const [file, pat, ctxArg, maxArg] = process.argv.slice(2);
const cache = file + ".txt";
let text;
if (fs.existsSync(cache)) text = fs.readFileSync(cache, "utf8");
else {
  text = fs.readFileSync(file, "utf8")
    .replace(/<ix:header>[\s\S]*?<\/ix:header>/gi, " ")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&#[0-9]+;/g, " ")
    .replace(/\s+/g, " ");
  fs.writeFileSync(cache, text);
}
const ctx = Number(ctxArg) || 200, max = Number(maxArg) || 5;
const re = new RegExp(pat, "gi");
let m, n = 0;
while ((m = re.exec(text)) && n < max) {
  console.log(`--- @${m.index}: …${text.slice(Math.max(0, m.index - ctx), m.index + ctx)}…`);
  n++;
}
console.log(`(共找到 ${[...text.matchAll(re)].length} 筆，顯示 ${n} 筆；全文 ${text.length} 字)`);
