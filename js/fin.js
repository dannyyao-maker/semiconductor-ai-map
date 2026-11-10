// 財報數字：圖表和題目用 "fin": "代碼" 指到 data/financials.json，載入時把數字填進去。
// 這樣同一個數字只寫一次，圖和題目不會對不上。純函式，網站和檢查工具共用。
//   時間序列（折線圖）：fin 可以是一個或多個代碼（共用同一組 x 軸），每個代碼變成一條線。
//   分類項目（重點數字卡、正負長條、堆疊條）：fin 是一個代碼，項目直接複製。

function apply(s, fin) {
  const ids = [].concat(s.fin);
  const ds = ids.map((id) => {
    const d = fin.series[id];
    if (!d) throw new Error(`financials.json 找不到 ${id}`);
    return d;
  });
  if (ds[0].items) s.items = JSON.parse(JSON.stringify(ds[0].items));
  else {
    s.x = s.x || ds[0].x;
    s.series = ds.map((d) => ({ label: d.label, values: d.values, ...(d.range ? { range: d.range } : {}), ...(d.labelPos ? { labelPos: d.labelPos } : {}) }));
  }
  s.sources = s.sources || [...new Set(ds.flatMap((d) => d.sources))];
  delete s.fin;
}

/** 走訪章節（或事件）的所有畫面與題目的 visual，把 fin 填進去 */
export function resolveFin(node, fin) {
  if (Array.isArray(node)) node.forEach((x) => resolveFin(x, fin));
  else if (node && typeof node === "object") {
    if (node.fin) apply(node, fin);
    for (const v of Object.values(node)) if (v && typeof v === "object") resolveFin(v, fin);
  }
  return node;
}
