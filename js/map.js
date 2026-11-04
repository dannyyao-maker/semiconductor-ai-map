// 地圖：讀 nodes.json，畫成可以點擊的 SVG。
// 電腦版：三大區塊由左到右，箭頭表示價值流向；手機版：三大區塊由上往下直排。

const SVG = "http://www.w3.org/2000/svg";
const W = 136; // 節點寬
const H = 60;  // 節點高

// 電腦版座標（viewBox 1280 × 430）
const DESKTOP = {
  width: 1280,
  height: 430,
  zones: {
    semi: { x: 16, w: 540 },
    "ai-hw": { x: 572, w: 328 },
    "ai-sw": { x: 916, w: 348 },
  },
  nodes: {
    "ic-design": [40, 96], equipment: [40, 316],
    foundry: [214, 96], memory: [214, 316],
    packaging: [392, 206],
    "ai-chip": [592, 96], "ai-server": [672, 206], datacenter: [752, 316],
    cloud: [936, 316], model: [1016, 206], "ai-app": [1096, 96],
  },
  edges: [
    ["ic-design", "foundry"], ["equipment", "foundry"], ["equipment", "memory"],
    ["foundry", "packaging"], ["memory", "packaging"], ["packaging", "ai-chip"],
    ["ai-chip", "ai-server"], ["ai-server", "datacenter"], ["datacenter", "cloud"],
    ["cloud", "model"], ["model", "ai-app"],
  ],
};

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// 手機版座標：每個區塊一段，節點兩欄排列
function mobileLayout(zones, nodes) {
  const layout = { width: 360, zones: {}, nodes: {}, edges: [], arrows: [] };
  const colX = [16, 192];
  const nw = 152, gap = 12;
  let y = 8;
  zones.forEach((z, zi) => {
    const list = nodes.filter((n) => n.zone === z.id).sort((a, b) => a.order - b.order);
    const rows = Math.ceil(list.length / 2);
    const h = 40 + rows * (H + gap) + 4;
    layout.zones[z.id] = { x: 4, w: 352, y, h };
    list.forEach((n, i) => {
      layout.nodes[n.id] = [colX[i % 2], y + 40 + Math.floor(i / 2) * (H + gap), nw];
    });
    y += h;
    if (zi < zones.length - 1) { layout.arrows.push(y + 14); y += 28; }
  });
  layout.height = y + 4;
  return layout;
}

function edgePath(a, b) {
  const [ax, ay, aw = W] = a, [bx, by] = b;
  if (bx - ax > aw * 0.75) {
    // 水平連線：右邊中點 → 左邊中點
    const x1 = ax + aw, y1 = ay + H / 2, x2 = bx - 6, y2 = by + H / 2;
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  }
  // 垂直連線：上下相接
  const down = by > ay;
  const x1 = ax + aw / 2, y1 = down ? ay + H : ay;
  const x2 = bx + aw / 2, y2 = down ? by - 6 : by + H + 6;
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

/**
 * 畫地圖。onSelect(nodeId) 在點節點時呼叫；onBackground() 在點空白處時呼叫。
 */
export function renderMap(container, { zones, nodes }, { mobile, onSelect, onBackground }) {
  const L = mobile ? mobileLayout(zones, nodes) : DESKTOP;
  container.innerHTML = "";
  const svg = el("svg", {
    viewBox: `0 0 ${L.width} ${L.height}`,
    class: "map-svg" + (mobile ? " is-mobile" : ""),
    role: "group",
    "aria-label": "半導體 × AI 產業鏈地圖，共 11 個環節",
  }, container);

  const defs = el("defs", {}, svg);
  const marker = el("marker", { id: "arrow", viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" }, defs);
  el("path", { d: "M0,0 L10,5 L0,10 z", class: "arrow-head" }, marker);

  // 點空白處關閉卡片
  const bg = el("rect", { x: 0, y: 0, width: L.width, height: L.height, class: "map-bg" }, svg);
  bg.addEventListener("click", onBackground);

  // 區塊底色與標題
  zones.forEach((z) => {
    const zl = L.zones[z.id];
    const zy = zl.y ?? 8, zh = zl.h ?? L.height - 16;
    const g = el("g", { class: `zone zone-${z.id}` }, svg);
    el("rect", { x: zl.x, y: zy, width: zl.w, height: zh, rx: 14, class: "zone-bg" }, g);
    const t = el("text", { x: zl.x + 16, y: zy + 28, class: "zone-title" }, g);
    t.textContent = z.name;
    const te = el("tspan", { class: "zone-title-en", dx: 8 }, t);
    te.textContent = z.nameEn;
    g.addEventListener("click", onBackground);
  });

  // 連線（電腦版）或區塊之間的向下箭頭（手機版）
  const edges = el("g", { class: "edges" }, svg);
  for (const [a, b] of L.edges) {
    el("path", { d: edgePath(L.nodes[a], L.nodes[b]), class: "edge", "marker-end": "url(#arrow)", "data-from": a, "data-to": b }, edges);
  }
  for (const ay of L.arrows || []) {
    el("path", { d: `M180,${ay - 12} L180,${ay + 8}`, class: "edge", "marker-end": "url(#arrow)" }, edges);
  }

  // 節點
  for (const n of nodes) {
    const [x, y, w = W] = L.nodes[n.id];
    const hasContent = Boolean(n.oneLiner);
    const g = el("g", {
      class: `node zone-${n.zone}` + (hasContent ? " has-content" : ""),
      "data-id": n.id,
      transform: `translate(${x},${y})`,
      tabindex: 0,
      role: "button",
      "aria-label": `${n.name} ${n.nameEn}` + (hasContent ? "" : "（內容準備中）"),
    }, svg);
    el("rect", { width: w, height: H, rx: 10, class: "node-box" }, g);
    const t1 = el("text", { x: w / 2, y: 27, class: "node-name" }, g);
    t1.textContent = n.name;
    const t2 = el("text", { x: w / 2, y: 45, class: "node-en" }, g);
    t2.textContent = n.nameEn;
    const pick = (e) => { e.stopPropagation(); onSelect(n.id); };
    g.addEventListener("click", pick);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(e); } });
  }
}

/** 更新地圖上的加亮狀態：選到的環節、公司橫跨的環節。 */
export function highlightMap(container, { selected, companySegments }) {
  const svg = container.querySelector("svg");
  if (!svg) return;
  svg.classList.toggle("has-selection", Boolean(selected) && !companySegments);
  svg.classList.toggle("has-company", Boolean(companySegments));
  svg.querySelectorAll(".node").forEach((g) => {
    const id = g.dataset.id;
    g.classList.toggle("is-selected", id === selected);
    g.classList.toggle("is-company", Boolean(companySegments?.includes(id)));
    g.setAttribute("aria-pressed", id === selected ? "true" : "false");
  });
  svg.querySelectorAll(".edge[data-from]").forEach((p) => {
    const on = selected && !companySegments && (p.dataset.from === selected || p.dataset.to === selected);
    p.classList.toggle("is-active", Boolean(on));
  });
}
