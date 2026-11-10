// 圖表：折線圖、正負長條圖、堆疊條（占比）、影響矩陣、重點數字。純 SVG／HTML，不用任何套件。
// 規則（依 dataviz 準則）：一個座標軸、2px 線、≥8px 圓點加白色外圈、格線細實線、
// 只標終點／最高點的數字、兩條以上的線一定有圖例、每張圖都附「數據表」、顏色不是唯一的辨識方式（有 ▲▼ 和文字）。
import { esc } from "./util.js";

// 顏色：藍（系列 1）、橘（系列 2）。受惠＝藍、受壓＝橘；避開紅綠，因為台股紅漲綠跌，容易看反。
const S = ["#2a78d6", "#eb6834"];
const RAMP = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"]; // 依序由深到淺（有序）
const OTHER = "#c3c2b7";
const INK = "#0b0b0b";

const num = (v, dec = 0) => Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/** 色塊裡的文字：白色或近黑，取對比比較高的那個 */
const inkOn = (hex) => (1.05 / (lum(hex) + 0.05) >= (lum(hex) + 0.05) / (lum(INK) + 0.05) ? "#fff" : INK);

const head = (s) => `<figcaption class="ch-cap"><b>${esc(s.title)}</b>${s.subtitle ? `<span>${esc(s.subtitle)}</span>` : ""}</figcaption>`;

/** 共用的「數據表」：每張圖都有，給看不清楚圖、用讀屏軟體的人 */
function tableHTML(cols, rows) {
  return `<details class="ch-table"><summary>看數據表</summary><div class="ch-table-wrap"><table>
    <thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}

// ---------- 折線圖 ----------
function lineChart(s) {
  const W = 360, H = 250, L = 42, R = 18, T = 22, B = 44;
  const n = s.x.length;
  const px = (i) => L + 14 + (W - L - R - 28) * (n === 1 ? 0 : i / (n - 1));
  const py = (v) => T + (H - T - B) * (1 - (v - s.yMin) / (s.yMax - s.yMin));
  const dec = s.dec ?? 0, suf = s.suffix || "";
  const fv = (v) => `${num(v, dec)}${suf}`;
  const ff = s.forecastFrom ?? n;
  let g = "";
  for (let v = s.yMin; v <= s.yMax + 1e-9; v += s.yStep) {
    g += `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${py(v)}" y2="${py(v)}"/><text class="ch-tick" x="${L - 6}" y="${py(v) + 3.5}" text-anchor="end">${num(v, s.tickDec ?? 0)}${suf}</text>`;
  }
  const xl = s.x.map((t, i) => {
    const [a, b] = String(t).split("\n");
    return `<text class="ch-xl${i >= ff ? " is-fc" : ""}" x="${px(i)}" y="${H - B + 17}" text-anchor="middle">${esc(a)}${b ? `<tspan x="${px(i)}" dy="13">${esc(b)}</tspan>` : ""}</text>`;
  }).join("");
  let body = "";
  s.series.forEach((se, k) => {
    const col = S[k];
    const pts = se.values.map((v, i) => [px(i), py(v)]);
    const solid = pts.slice(0, Math.min(ff, n));
    if (se.range) body += `<line class="ch-range" x1="${px(se.range.i)}" x2="${px(se.range.i)}" y1="${py(se.range.lo)}" y2="${py(se.range.hi)}" stroke="${col}"/>`;
    body += `<polyline class="ch-line" points="${solid.map((p) => p.join(",")).join(" ")}" stroke="${col}"/>`;
    if (ff < n) body += `<polyline class="ch-line is-dash" points="${pts.slice(ff - 1).map((p) => p.join(",")).join(" ")}" stroke="${col}"/>`;
    const max = se.values.indexOf(Math.max(...se.values));
    const labelAt = new Set([0, n - 1, max]);
    se.values.forEach((v, i) => {
      body += `<circle class="ch-dot${i >= ff ? " is-fc" : ""}" cx="${pts[i][0]}" cy="${pts[i][1]}" r="4.5" style="--c:${col}"/>`;
      if (!labelAt.has(i)) return;
      const below = se.labelPos === "below";
      const txt = se.range && i === se.range.i ? `${num(se.range.lo, dec)}–${num(se.range.hi, dec)}${suf}` : fv(v);
      const last = i === n - 1;
      body += `<text class="ch-val" x="${last ? pts[i][0] + 10 : pts[i][0]}" y="${pts[i][1] + (below ? 20 : -11)}" text-anchor="${last ? "end" : "middle"}">${esc(txt)}</text>`;
    });
  });
  const hits = s.x.map((_, i) => `<rect class="ch-hit" x="${px(i) - (W - L - R) / (n - 1) / 2}" y="${T - 10}" width="${(W - L - R) / (n - 1)}" height="${H - T - B + 20}" data-i="${i}"/>`).join("");
  const tips = s.x.map((t, i) => `<b>${esc(String(t).replace("\n", " "))}</b>` + s.series.map((se, k) => {
    const r = se.range && se.range.i === i;
    return `<span><i style="background:${S[k]}"></i>${esc(se.label)}　${r ? `${num(se.range.lo, dec)}–${num(se.range.hi, dec)}（中位 ${num(se.values[i], dec)}）` : num(se.values[i], dec)}${esc(suf)}${i >= ff ? "（公司財測）" : ""}</span>`;
  }).join(""));
  const aria = `${s.title}。` + s.x.map((t, i) => `${String(t).replace("\n", " ")}：` + s.series.map((se) => `${se.label} ${fv(se.values[i])}`).join("，")).join("；");
  const legend = s.series.length > 1 || ff < n
    ? `<ul class="ch-legend">${s.series.length > 1 ? s.series.map((se, k) => `<li><i class="lg-line" style="background:${S[k]}"></i>${esc(se.label)}</li>`).join("") : ""}${ff < n ? `<li><i class="lg-dot"></i>空心圓點＝公司財測（不是實績）</li>` : ""}</ul>` : "";
  return `<figure class="ch ch-line-wrap" data-w="${W}" data-xs="${s.x.map((_, i) => px(i).toFixed(1)).join(",")}" data-tips='${esc(JSON.stringify(tips))}'>
    ${head(s)}${legend}
    <div class="ch-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${g}<line class="ch-base" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>${xl}
      <line class="ch-guide" y1="${T - 8}" y2="${H - B}" hidden/>${body}${hits}</svg><div class="ch-tip" hidden></div></div>
    ${s.yLabel ? `<p class="ch-unit">${esc(s.yLabel)}</p>` : ""}
    ${tableHTML(["期間", ...s.series.map((se) => `${se.label}${suf ? `（${suf}）` : ""}`)], s.x.map((t, i) => [String(t).replace("\n", " "), ...s.series.map((se) => (se.range && se.range.i === i ? `${num(se.range.lo, dec)}–${num(se.range.hi, dec)}（財測）` : num(se.values[i], dec)))]))}
  </figure>`;
}

// ---------- 正負長條圖（例如季增率）----------
function dbars(s) {
  const vals = s.items.map((it) => it.value);
  const mn = Math.min(0, ...vals), mx = Math.max(0, ...vals), span = mx - mn;
  const lo = mn < 0 ? mn - span * 0.28 : 0, hi = mx + span * 0.28;
  const pct = (v) => ((v - lo) / (hi - lo)) * 100;
  const zero = pct(0);
  const dec = s.dec ?? 0;
  const rows = s.items.map((it) => {
    const w = (Math.abs(it.value) / (hi - lo)) * 100;
    const pos = it.value >= 0;
    const label = `${pos ? "+" : "−"}${num(Math.abs(it.value), dec)}${s.suffix || "%"}`;
    return `<li data-tip="${esc(`${it.label}：${s.valueName || "變化"} ${label}${it.share != null ? `；占比 ${it.share}%` : ""}`)}" tabindex="0">
      <span class="db-label">${esc(it.label)}${it.share != null ? `<small>占 ${it.share}%</small>` : ""}</span>
      <span class="db-track"><i class="db-zero" style="left:${zero}%"></i>
        <span class="db-bar ${pos ? "pos" : "neg"}" style="${pos ? `left:${zero}%` : `left:${zero - w}%`};width:${w}%"></span>
        <b class="db-val" style="${pos ? `left:calc(${zero + w}% + 6px)` : `right:calc(${100 - (zero - w)}% + 6px)`}">${pos ? "▲" : "▼"} ${esc(label)}</b></span></li>`;
  }).join("");
  const aria = `${s.title}。` + s.items.map((it) => `${it.label} ${it.value > 0 ? "+" : ""}${it.value}${s.suffix || "%"}`).join("，");
  return `<figure class="ch ch-dbars">${head(s)}
    <ul class="ch-legend"><li><i class="lg-sq" style="background:${S[0]}"></i>增加</li><li><i class="lg-sq" style="background:${S[1]}"></i>減少</li></ul>
    <ol class="db-rows" role="img" aria-label="${esc(aria)}">${rows}</ol><div class="ch-tip" hidden></div>
    ${tableHTML(["項目", s.valueName || "變化", ...(s.items.some((i) => i.share != null) ? ["占比"] : [])], s.items.map((it) => [it.label, `${it.value > 0 ? "+" : ""}${num(it.value, dec)}${s.suffix || "%"}`, ...(it.share != null ? [`${it.share}%`] : [])]))}
  </figure>`;
}

// ---------- 堆疊條（一個整體分成幾塊）----------
function segbar(s) {
  let k = 0;
  const items = s.items.map((it) => ({ ...it, color: it.other ? OTHER : RAMP[k++] }));
  const total = items.reduce((a, b) => a + b.value, 0);
  const segs = items.map((it) => `<span class="seg" style="flex:${it.value} 1 0;background:${it.color};color:${inkOn(it.color)}" data-tip="${esc(`${it.label}：${it.value}%${it.note ? `（${it.note}）` : ""}`)}" tabindex="0"><b>${num(it.value)}%</b></span>`).join("");
  const aria = `${s.title}。` + items.map((it) => `${it.label} ${it.value}%`).join("，");
  return `<figure class="ch ch-seg">${head(s)}
    <div class="seg-bar" role="img" aria-label="${esc(aria)}">${segs}</div>
    <ul class="ch-legend seg-legend">${items.map((it) => `<li><i class="lg-sq" style="background:${it.color}"></i>${esc(it.label)}</li>`).join("")}</ul><div class="ch-tip" hidden></div>
    ${s.footnote ? `<p class="ch-unit">${esc(s.footnote)}</p>` : ""}
    ${tableHTML(["項目", "占比"], items.map((it) => [it.label, `${num(it.value)}%`]))}
  </figure>`;
}

// ---------- 影響矩陣 ----------
const DIR = { "+": { cls: "pos", icon: "▲", word: "受惠" }, "-": { cls: "neg", icon: "▼", word: "受壓" }, "0": { cls: "zero", icon: "●", word: "中性" } };
function matrix(s, T) {
  const t = T || ((x) => esc(x));
  const rows = s.rows.map((r) => `
    <div class="mx-row"><div class="mx-rh">${r.node ? `<a href="#/hq/${esc(r.node)}">${esc(r.label)}</a>` : esc(r.label)}${r.sub ? `<small>${esc(r.sub)}</small>` : ""}</div>
      ${r.cells.map((c, i) => {
        const d = c.d ? DIR[c.d] : null;
        return `<div class="mx-cell ${d ? `dir-${d.cls}` : "dir-note"}" data-col="${esc(s.columns[i])}">
          ${d ? `<span class="mx-dir"><i>${d.icon}</i>${d.word}</span>` : ""}<p>${t(c.text)}</p>${c.infer ? `<span class="mx-infer">推論</span>` : ""}</div>`;
      }).join("")}</div>`).join("");
  const aria = `${s.title}。` + s.rows.map((r) => `${r.label}：` + r.cells.map((c, i) => `${s.columns[i]}${c.d ? DIR[c.d].word : ""} ${c.text}`).join("；")).join("。");
  return `<figure class="ch ch-matrix">${head(s)}
    <div class="mx" role="table" aria-label="${esc(aria)}">
      <div class="mx-row mx-head"><div></div>${s.columns.map((c) => `<div class="mx-ch">${esc(c)}</div>`).join("")}</div>${rows}</div>
    <ul class="ch-legend"><li><span class="mx-dir dir-pos"><i>▲</i>受惠</span></li><li><span class="mx-dir dir-neg"><i>▼</i>受壓</span></li><li><span class="mx-dir dir-zero"><i>●</i>中性／沒提到</span></li><li><span class="mx-infer">推論</span>＝來源沒有直接說，是依邏輯推出來的</li></ul>
  </figure>`;
}

// ---------- 重點數字 ----------
function kpi(s) {
  return `<figure class="ch ch-kpi">${s.title ? head(s) : ""}<div class="kpi-row">${s.items.map((it) => `
    <div class="kpi"><span class="kpi-l">${esc(it.label)}</span><b class="kpi-v">${esc(it.value)}</b>
      ${it.delta ? `<span class="kpi-d">${it.dir === "down" ? "▼" : it.dir === "up" ? "▲" : "●"} ${esc(it.delta)}</span>` : ""}</div>`).join("")}</div></figure>`;
}

/** 依 type 畫出圖表。T 是把文字加上術語連結的函式（可省略） */
export function chartHTML(spec, T) {
  if (spec.type === "line") return lineChart(spec);
  if (spec.type === "dbars") return dbars(spec);
  if (spec.type === "segbar") return segbar(spec);
  if (spec.type === "matrix") return matrix(spec, T);
  if (spec.type === "kpi") return kpi(spec);
  return "";
}
export const CHART_TYPES = ["line", "dbars", "segbar", "matrix", "kpi"];

/** 圖表畫進頁面之後呼叫：折線圖的游標提示、長條的提示、堆疊條放不下的數字隱藏 */
export function bindCharts(root) {
  root.querySelectorAll(".ch-seg .seg").forEach((seg) => {
    const b = seg.querySelector("b");
    b.style.visibility = b.offsetWidth + 10 > seg.clientWidth ? "hidden" : "visible";
  });
  // 折線圖：手指或滑鼠移到哪一欄，就顯示那一期所有的數字
  root.querySelectorAll(".ch-line-wrap").forEach((fig) => {
    const svg = fig.querySelector("svg"), tip = fig.querySelector(".ch-tip"), guide = fig.querySelector(".ch-guide");
    const W = Number(fig.dataset.w), xs = fig.dataset.xs.split(",").map(Number), tips = JSON.parse(fig.dataset.tips);
    const show = (e) => {
      const r = svg.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W;
      let i = 0;
      xs.forEach((v, j) => { if (Math.abs(v - x) < Math.abs(xs[i] - x)) i = j; });
      guide.setAttribute("x1", xs[i]); guide.setAttribute("x2", xs[i]); guide.hidden = false;
      tip.innerHTML = tips[i]; tip.hidden = false;
      const pct = (xs[i] / W) * 100;
      tip.style.left = `${Math.min(78, Math.max(22, pct))}%`;
    };
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerdown", show);
    svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { tip.hidden = true; guide.hidden = true; } });
  });
  // 長條、堆疊條：點一下或停留，顯示完整說明
  root.querySelectorAll(".ch-dbars, .ch-seg").forEach((fig) => {
    const tip = fig.querySelector(".ch-tip");
    if (!tip) return;
    const open = (el) => {
      tip.textContent = el.dataset.tip;
      tip.hidden = false;
      const fr = fig.getBoundingClientRect(), er = el.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max(er.left - fr.left + er.width / 2, 70), fr.width - 70)}px`;
      tip.style.top = `${er.top - fr.top - 8}px`;
    };
    fig.querySelectorAll("[data-tip]").forEach((el) => {
      el.addEventListener("pointerenter", () => open(el));
      el.addEventListener("focus", () => open(el));
      el.addEventListener("click", () => open(el));
      el.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") tip.hidden = true; });
    });
  });
}
