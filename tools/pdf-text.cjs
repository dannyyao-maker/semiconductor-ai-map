// 從 PDF 取出文字（簡易版），只用 Node.js 內建功能，不用另外安裝。
// 用法：node tools/pdf-text.cjs sources/檔名.pdf   → 產生同名的 .txt
// 限制：只適用於「文字型」PDF（例如法說會逐字稿）；掃描圖片或特殊字型編碼的 PDF 會讀不出來，
//       這時請改用網頁版資料，或把需要的段落複製貼給 Claude Code。
const fs = require("fs");
const zlib = require("zlib");
const file = process.argv[2];
const buf = fs.readFileSync(file);
const bin = buf.toString("latin1");

// 1. 找出所有壓縮過的內容串流（stream）並解壓縮
const streams = [];
const re = /(?<!end)stream\r?\n/g; // 注意不要誤抓到 "endstream"
let m;
while ((m = re.exec(bin))) {
  const start = m.index + m[0].length;
  const end = bin.indexOf("endstream", start);
  if (end < 0) break;
  const raw = buf.subarray(start, end);
  try { streams.push(zlib.inflateSync(raw).toString("latin1")); }
  catch { try { streams.push(zlib.inflateSync(raw.subarray(0, raw.length - 1)).toString("latin1")); } catch {} }
  re.lastIndex = end;
}

// 2. 讀取字型的 ToUnicode 對照表（把 PDF 內部字碼換成真正的字）
const cmap = {};
for (const s of streams) {
  if (!s.includes("beginbfchar") && !s.includes("beginbfrange")) continue;
  for (const b of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
    for (const p of b[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) cmap[p[1].toUpperCase()] = hexToStr(p[2]);
  for (const b of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
    for (const p of b[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16), base = parseInt(p[3], 16), w = p[1].length;
      for (let c = lo; c <= hi && c - lo < 5000; c++) cmap[c.toString(16).toUpperCase().padStart(w, "0")] = String.fromCodePoint(base + c - lo);
    }
}
function hexToStr(h) { let s = ""; for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return s; }
function decodeHex(h) {
  h = h.toUpperCase();
  for (const w of [4, 2]) {
    if (h.length % w) continue;
    let out = "", ok = true;
    for (let i = 0; i < h.length; i += w) { const k = h.slice(i, i + w); if (cmap[k] === undefined) { ok = false; break; } out += cmap[k]; }
    if (ok) return out;
  }
  return "";
}
function decodeLiteral(s) {
  s = s.replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "", t: " ", b: "", f: "", "(": "(", ")": ")", "\\": "\\" }[c]))
       .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
  return s;
}

// 3. 從頁面內容取出文字指令（Tj、TJ），遇到換行指令就換行
let text = "";
for (const s of streams) {
  if (!/\b(Tj|TJ)\b/.test(s)) continue;
  for (const t of s.matchAll(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|(\((?:[^)\\]|\\.)*\)|<[0-9A-Fa-f]+>)\s*Tj|(T\*|Td|TD|ET)\b/g)) {
    if (t[3]) { text += t[3] === "ET" ? "\n" : " "; continue; }
    const parts = t[1] !== undefined ? [...t[1].matchAll(/\((?:[^)\\]|\\.)*\)|<[0-9A-Fa-f]+>|-?\d+(\.\d+)?/g)].map((x) => x[0]) : [t[2]];
    for (const p of parts) {
      if (p.startsWith("(")) text += decodeLiteral(p.slice(1, -1));
      else if (p.startsWith("<")) text += decodeHex(p.slice(1, -1));
      else if (Number(p) < -200) text += " ";
    }
  }
}
text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
const out = file.replace(/\.pdf$/i, "") + ".txt";
fs.writeFileSync(out, text);
console.log(`取出 ${text.length} 字 → ${out}`);
console.log(text.slice(0, 600));
