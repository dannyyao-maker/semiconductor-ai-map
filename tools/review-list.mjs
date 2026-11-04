// 從 data/ 產生「審核清單.md」，方便一張一張讀內容、標記要改的地方。
// 用法：在專案資料夾執行 `node tools/review-list.mjs`
// 內容要改請改 data/（或請 Claude Code 改），再重新產生清單。已打勾的項目會保留。
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const nodesData = JSON.parse(await readFile(root + "data/nodes.json", "utf8"));
const companies = JSON.parse(await readFile(root + "data/companies.json", "utf8"));
const nodeById = Object.fromEntries(nodesData.nodes.map((n) => [n.id, n]));
const companyById = Object.fromEntries(companies.map((c) => [c.id, c]));

// 讀舊清單，記下已經打勾（[x]）的代碼
let checked = new Set();
try {
  const old = await readFile(root + "審核清單.md", "utf8");
  for (const m of old.matchAll(/\[x\] `([a-z0-9.-]+)`/gi)) checked.add(m[1]);
} catch {}

const tick = (id) => `${checked.has(id) ? "[x]" : "[ ]"} \`${id}\``;
const flow = (items) =>
  items.map((it) => `  - ${it.node ? `［${nodeById[it.node].name}］` : ""}${it.text || ""}`).join("\n");
const claims = (items, key) =>
  items.map((it, i) => `- ${tick(`${key}.${i + 1}`)} ${it.text}（${it.status}，asOf ${it.asOf}）`).join("\n");

function nodeSection(n) {
  const b = n.business;
  const rows = n.companies.map((id) => companyById[id]).map((c) => {
    const segs = c.segments.map((s) => nodeById[s].name).join("、");
    // 跨環節的公司只在第一個環節詳列，其他環節標「見某環節」
    if (c.segments[0] !== n.id) return `| \`${c.id}\` | ${c.name} | ${segs} | 見「${nodeById[c.segments[0]].name}」 | | |`;
    return `| ${tick(c.id)} | ${c.name} ${c.nameEn} | ${segs} | ${c.oneLiner} | ${c.moat} | ${c.risks} |`;
  });
  return `
## ${n.name}（${n.nameEn}）\`${n.id}\`

- ${tick(`${n.id}.oneLiner`)} **一句話定位**：${n.oneLiner}
- ${tick(`${n.id}.analogy`)} **白話比喻**：${n.analogy}
- ${tick(`${n.id}.upstream`)} **上游（跟誰買）**
${flow(n.upstream)}
- ${tick(`${n.id}.downstream`)} **下游（賣給誰）**
${flow(n.downstream)}
- ${tick(`${n.id}.business`)} **怎麼賺錢**
  - 商業模式：${b.model}
  - 利潤高低：${b.margin}
  - 議價能力：${b.bargainingPower}

**當前問題**

${claims(n.issues, `${n.id}.issues`)}

**熱門話題**

${claims(n.topics, `${n.id}.topics`)}

**代表公司**（${n.companies.length} 家）

| 審／代碼 | 公司 | 橫跨環節 | 一句話定位 | 護城河 | 主要風險 |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}
`;
}

let md = `# 審核清單

由 \`node tools/review-list.mjs\` 從 \`data/\` 自動產生。內容文字請不要直接改這份檔案，改了也會被下次產生的清單蓋掉；只有打勾會保留。

## 怎麼審核

1. 一次讀一個區塊（3–4 張卡）就好。讀過、沒問題的項目，把 \`[ ]\` 改成 \`[x]\`。
2. 有問題的地方，在對話裡告訴 Claude Code「代碼＋要怎麼改」，例如：
   - \`foundry.issues.2\` 太籠統，改成講關稅
   - \`tsmc\` 的護城河補上客戶信任
   - \`memory.analogy\` 看不懂
3. 也可以直接問問題，例如「HBM 為什麼只有少數廠商做得出來？」，弄懂再決定要不要改。
4. Claude Code 改完 \`data/\` 後會重新產生這份清單，被改過的項目請再看一次。

進度：已打勾 ${checked.size} 項。
`;

for (const z of nodesData.zones) {
  md += `\n---\n\n# ${z.name}（${z.nameEn}）\n`;
  for (const n of nodesData.nodes.filter((x) => x.zone === z.id)) md += nodeSection(n);
}

await writeFile(root + "審核清單.md", md);
console.log(`已產生 審核清單.md：${nodesData.nodes.length} 個環節、${companies.length} 家公司，已打勾 ${checked.size} 項`);
