// 地圖：階段 0 先用清單確認資料讀得到；階段 1 改成可點擊的 SVG 流向圖。
export function renderMap(container, { zones, nodes }) {
  container.innerHTML = zones.map((z) => `
    <div class="zone zone-${z.id}">
      <h2>${z.name} <span class="en">${z.nameEn}</span></h2>
      <ol start="${nodes.find((n) => n.zone === z.id).order}">
        ${nodes.filter((n) => n.zone === z.id).map((n) => `<li>${n.name} <span class="en">${n.nameEn} · ${n.id}</span></li>`).join("")}
      </ol>
    </div>`).join("");
}
