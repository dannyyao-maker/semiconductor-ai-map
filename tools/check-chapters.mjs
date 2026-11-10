// 檢查章節內容：格式、來源代碼是否存在、題目代碼是否重複、答案位置是否合理。
// 用法：node tools/check-chapters.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const sources = new Set(read("data/sources.json").map((s) => s.id));
const nodes = new Set(read("data/nodes.json").nodes.map((n) => n.id));
const companies = new Set(read("data/companies.json").map ? read("data/companies.json").map((c) => c.id) : read("data/companies.json").companies.map((c) => c.id));
const idx = read("data/chapters/index.json");
const errors = [], seen = new Map();
let quizCount = 0;
const err = (f, m) => errors.push(`${f}：${m}`);

function walk(file, screen, where) {
  for (const s of screen.sources || []) if (!sources.has(s)) err(file, `${where} 找不到來源 ${s}`);
  if (screen.type === "quiz") {
    quizCount++;
    if (seen.has(screen.id)) err(file, `題目代碼重複：${screen.id}（也出現在 ${seen.get(screen.id)}）`);
    seen.set(screen.id, file);
    if (!Number.isInteger(screen.answer) || screen.answer < 0 || screen.answer >= screen.options.length) err(file, `${screen.id} 答案位置不合理`);
    if (new Set(screen.options).size !== screen.options.length) err(file, `${screen.id} 選項重複`);
    if (!screen.explain) err(file, `${screen.id} 沒有解說`);
    if (![1, 2, 3].includes(screen.difficulty)) err(file, `${screen.id} 難度要是 1、2、3`);
    if (!(screen.sources || []).length) err(file, `${screen.id} 沒有來源`);
  }
  if (screen.type === "choice") for (const o of screen.options) for (const s of o.sources || []) if (!sources.has(s)) err(file, `${where} 選項來源 ${s} 不存在`);
  if (screen.type === "flow") for (const st of screen.steps) if (st.node && !nodes.has(st.node)) err(file, `${where} 流程環節 ${st.node} 不存在`);
  if (screen.type === "compare") for (const c of screen.companies) if (!companies.has(c)) err(file, `${where} 公司 ${c} 不存在`);
  if (screen.type === "line") for (const s of screen.series) if (s.values.length !== screen.x.length) err(file, `${where} 折線圖點數和 x 軸不一致`);
}
for (const c of idx.chapters) {
  if (!c.file) continue;
  const f = `data/chapters/${c.file}`;
  const ch = read(f);
  if (ch.node !== c.node) err(f, `node 是 ${ch.node}，清單是 ${c.node}`);
  const ids = ch.parts.map((p) => p.id).join(",");
  if (ids !== "know,compare,final") err(f, `parts 順序不對：${ids}`);
  for (const p of ch.parts) for (const sec of p.sections) sec.screens.forEach((s, i) => walk(f, s, `${p.id}.${sec.id}[${i}]`));
}
for (const e of read("data/events.json").events || []) for (const q of e.questions || []) { if (seen.has(q.id)) err("events.json", `題目代碼重複：${q.id}`); seen.set(q.id, "events.json"); }
console.log(`檢查了 ${idx.chapters.filter((c) => c.file).length} 章、${quizCount} 道章節計分題`);
if (errors.length) { console.log("發現問題：\n" + errors.join("\n")); process.exit(1); } else console.log("全部通過");
