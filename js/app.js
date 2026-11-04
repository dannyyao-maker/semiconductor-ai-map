// 啟動：讀取 data/ 的資料，交給地圖與環節卡。
import { renderMap } from "./map.js";

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`讀不到 ${path}`);
  return res.json();
}

async function main() {
  const mapEl = document.getElementById("map");
  try {
    const [nodes, companies, sources] = await Promise.all([
      loadJSON("data/nodes.json"),
      loadJSON("data/companies.json"),
      loadJSON("data/sources.json"),
    ]);
    renderMap(mapEl, nodes);
    window.__data = { nodes, companies, sources }; // 方便除錯
  } catch (err) {
    mapEl.innerHTML = `<p>資料載入失敗：${err.message}。請用 <code>node tools/serve.mjs</code> 開啟，不要直接雙擊 HTML。</p>`;
  }
}

main();
