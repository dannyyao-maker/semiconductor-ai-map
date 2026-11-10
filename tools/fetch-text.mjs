// 把一個網址的內容下載成純文字，存到 sources/texts/<來源代號>.txt，給 check-event 對照數字用。
// 網頁（HTML）和純文字直接轉；PDF 會用 tools/pdf-text.cjs 取文字（只適用文字型 PDF）。
// 用法：node tools/fetch-text.mjs <網址> <來源代號>
//   例：node tools/fetch-text.mjs https://www.sec.gov/Archives/edgar/data/.../a1q26e.htm tsmc-1q26
// 來源代號要和 data/sources.json 裡的 id 一樣。sources/ 不會上傳 GitHub（著作權）。
// 有些網站（例如台積電新聞稿網站）會擋程式連線，改用 SEC 上的同一份文件，或手動存成 sources/texts/<代號>.txt。
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const [url, id] = process.argv.slice(2);
  if (!url || !id) return fail("用法：node tools/fetch-text.mjs <網址> <來源代號>", 1);
  const outDir = path.join(root, "sources", "texts");
  fs.mkdirSync(outDir, { recursive: true });
  const gov = /sec\.gov|federalregister|govinfo/.test(url);
  const headers = { "User-Agent": gov ? "SemiMapStudentProject research-bot@example.org" : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let res, buf;
  try {
    res = await fetch(url, { headers, redirect: "follow", signal: ctrl.signal });
    if (!res.ok) return fail(`下載失敗：HTTP ${res.status}（有些網站會擋程式連線；改用 SEC 的同一份文件，或手動存檔放進 sources/texts/）`, 2);
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    return fail(`下載失敗：${e.name === "AbortError" ? "逾時" : e.message}`, 2);
  } finally {
    clearTimeout(timer);
  }

  const type = res.headers.get("content-type") || "";
  let text;
  if (/pdf/i.test(type) || buf.slice(0, 4).toString() === "%PDF") {
    const pdf = path.join(outDir, `${id}.pdf`);
    fs.writeFileSync(pdf, buf);
    execFileSync("node", [path.join(root, "tools", "pdf-text.cjs"), pdf], { stdio: "ignore" });
    text = fs.readFileSync(pdf.replace(/\.pdf$/, ".txt"), "utf8");
    fs.rmSync(pdf);
  } else {
    text = buf.toString("utf8")
      .replace(/<ix:header>[\s\S]*?<\/ix:header>/gi, " ")
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "'")
      .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&#[0-9]+;/g, " ");
  }
  text = text.replace(/\s+/g, " ").trim();
  // 網站擋程式時，會回傳「請證明你是人類」之類的頁面；這種內容絕對不能當原文存起來
  if (text.length < 6000 && /captcha|request access|access denied|are you (a )?robot|verify you are human|enable javascript|just a moment|automated scraping|unusual traffic/i.test(text.slice(0, 4000))) {
    return fail(`下載到的是「擋機器人」的頁面，不是原文（開頭：${text.slice(0, 80)}…）。改用官方提供的 PDF／API 網址，或手動存檔。`, 3);
  }
  const file = path.join(outDir, `${id}.txt`);
  fs.writeFileSync(file, text);
  console.log(`✓ ${id}：${text.length} 字 → ${path.relative(root, file)}`);
  if (text.length < 500) console.log("⚠ 文字很少，可能是掃描檔或需要登入；請確認內容。");
}

function fail(msg, code) { console.error(msg); process.exitCode = code; }
await main();
