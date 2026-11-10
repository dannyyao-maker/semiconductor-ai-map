// 圖示庫：全部是自己畫的 SVG（不用表情符號，因為每支手機的表情符號長得不一樣）。
// 用法：ic("flame") → 一段 <svg>；顏色跟著文字顏色（currentColor），大小用 CSS 的 --ic 控制。
// mascot("happy") → 吉祥物「小晶」（斜方塊晶片）。

// 線條圖示：24×24 格，線寬 2，圓頭
const LINE = {
  path: `<circle cx="7" cy="6" r="2.6"/><circle cx="17" cy="12" r="2.6"/><circle cx="7" cy="18" r="2.6"/><path d="M8.6 7.7l6.8 2.7M15.4 13.6l-6.8 2.7"/>`,
  map: `<path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>`,
  dumbbell: `<path d="M6.5 7.5v9M3.5 10v4M17.5 7.5v9M20.5 10v4M6.5 12h11"/>`,
  shield: `<path d="M12 3l7.5 2.8v5.6c0 4.7-3.1 8.1-7.5 9.6-4.4-1.5-7.5-4.9-7.5-9.6V5.8z"/>`,
  user: `<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.9-3.7 3.9-5.7 7.5-5.7s6.6 2 7.5 5.7"/>`,
  trophy: `<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5a3 3 0 0 0 3 3M17 6h3v1.5a3 3 0 0 1-3 3M12 14v3.5M8.5 20h7M10 17.5h4"/>`,
  siren: `<path d="M7 18v-5a5 5 0 0 1 10 0v5"/><path d="M5 18h14v2.5H5zM12 3v2.5M4.5 6.5l1.8 1.8M19.5 6.5l-1.8 1.8"/>`,
  book: `<path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13.5"/>`,
  search: `<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>`,
  bolt: `<path d="M13 3L5.5 13.5H11L10 21l8-11h-5.5z"/>`,
  hourglass: `<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.200 4 5.300 4 8.500S8 16.300 8 20.500M16 3.500c0 4.200-4 5.300-4 8.500s4 4.300 4 8.500"/>`,
  download: `<path d="M12 4v11M7.5 11.5L12 16l4.5-4.5M5 20h14"/>`,
  upload: `<path d="M12 16V5M7.5 8.5L12 4l4.5 4.5M5 20h14"/>`,
  trash: `<path d="M5 7h14M10 7V4.5h4V7M7 7l.8 12.500h8.400L17 7M10.500 11v5M13.500 11v5"/>`,
  back: `<path d="M14.5 5L7.5 12l7 7"/>`,
  play: `<path d="M8 5.5v13l11-6.500z" fill="currentColor"/>`,
  target: `<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1" fill="currentColor"/>`,
  flag: `<path d="M6 21V4M6 5h11l-2.500 4L17 13H6"/>`,
  clock: `<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>`,
  question: `<circle cx="12" cy="12" r="8.500"/><path d="M9.500 9.500a2.500 2.500 0 1 1 3.500 2.300c-.700.400-1 .900-1 1.700M12 16.800v.1"/>`,
  cross: `<path d="M6.500 6.500l11 11M17.500 6.500l-11 11" stroke-width="3"/>`,
  more: `<circle cx="6" cy="12" r="1.600" fill="currentColor"/><circle cx="12" cy="12" r="1.600" fill="currentColor"/><circle cx="18" cy="12" r="1.600" fill="currentColor"/>`,
  // 關卡圖示（依章節的主題）
  bulb: `<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.500 10.900c.700.600 1 1.300 1 2.100h5c0-.800.300-1.500 1-2.100A6 6 0 0 0 12 3z"/>`,
  swap: `<path d="M4 9h13M13.500 5.500L17 9l-3.500 3.500M20 15H7M10.500 11.500L7 15l3.500 3.500"/>`,
  chart: `<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>`,
  people: `<circle cx="9" cy="8.500" r="3"/><circle cx="17" cy="9.500" r="2.200"/><path d="M3.500 19c.6-3 2.800-4.500 5.500-4.500S13.900 16 14.500 19M15 14.800c2.500-.4 4.800.8 5.500 4"/>`,
  castle: `<path d="M4 20V6h3v2.500h2.500V6h5v2.500H17V6h3v14zM10 20v-4.500a2 2 0 0 1 4 0V20"/>`,
  percent: `<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.300"/><circle cx="17" cy="17" r="2.300"/>`,
  warning: `<path d="M12 4l9 16H3z"/><path d="M12 10v4.500M12 17.500v.1"/>`,
  globe: `<circle cx="12" cy="12" r="8.500"/><path d="M3.500 12h17M12 3.500c2.500 2.500 3.500 5.500 3.500 8.500S14.500 18 12 20.500C9.500 18 8.500 15 8.500 12S9.500 6 12 3.500z"/>`,
  // 單元圖示（11 個環節）
  chip: `<rect x="7" y="7" width="10" height="10" rx="2"/><rect x="10" y="10" width="4" height="4" rx=".6" fill="currentColor"/><path d="M9.500 3.500V7M14.500 3.500V7M9.500 17v3.500M14.500 17v3.500M3.500 9.500H7M3.500 14.500H7M17 9.500h3.500M17 14.500h3.500"/>`,
  factory: `<path d="M3.500 20V10l5 3V10l5 3V7.500H17V20zM6.500 16.500h2M11 16.500h2M16 11V4.500"/>`,
  box: `<path d="M12 3.500l8 4v9l-8 4-8-4v-9zM4 7.500l8 4 8-4M12 11.500v9"/>`,
  gear: `<circle cx="12" cy="12" r="3"/><path d="M12 3.500V6M12 18v2.500M3.500 12H6M18 12h2.500M6 6l1.800 1.800M16.200 16.200L18 18M18 6l-1.800 1.800M7.800 16.200L6 18"/>`,
  db: `<ellipse cx="12" cy="6" rx="7" ry="2.800"/><path d="M5 6v6c0 1.500 3 2.800 7 2.800s7-1.300 7-2.800V6M5 12v6c0 1.500 3 2.800 7 2.800s7-1.300 7-2.800v-6"/>`,
  chipai: `<rect x="6" y="6" width="12" height="12" rx="2.500"/><path d="M12.800 8.500L9.800 12.500h2.400L11.200 15.500l3-4h-2.400z" fill="currentColor" stroke="none"/><path d="M9.500 3v3M14.500 3v3M9.500 18v3M14.500 18v3M3 9.500h3M3 14.500h3M18 9.500h3M18 14.500h3"/>`,
  server: `<rect x="4" y="4" width="16" height="6" rx="1.500"/><rect x="4" y="14" width="16" height="6" rx="1.500"/><path d="M7.500 7h.1M7.500 17h.1M12 7h5M12 17h5"/>`,
  building: `<path d="M5 20V8l7-4 7 4v12zM9 20v-5h6v5M9 11h.1M12 11h.1M15 11h.1"/>`,
  cloud: `<path d="M7 18.500a4 4 0 0 1-.500-7.900 5.500 5.500 0 0 1 10.600-.8A4.500 4.500 0 0 1 17 18.500z"/>`,
  spark: `<path d="M12 3.500c.8 4.200 2.300 5.700 6.500 6.500-4.200.8-5.700 2.300-6.500 6.500-.8-4.200-2.300-5.700-6.500-6.500C9.700 9.200 11.200 7.700 12 3.500zM18.500 15.500c.3 1.600.9 2.200 2.500 2.500-1.600.3-2.200.9-2.500 2.500-.3-1.600-.9-2.200-2.500-2.500 1.600-.3 2.200-.9 2.500-2.500z"/>`,
  phone: `<rect x="7" y="3" width="10" height="18" rx="2.500"/><path d="M11 18h2"/>`,
};

// 實心圖示
const FILL = {
  flame: `<path d="M12.600 2.500c.5 3-1.200 4.600-2.700 6.200C8.400 10.300 7 11.800 7 14.300 7 17.500 9.200 20 12 20s5-2.500 5-5.600c0-1.800-.8-3.300-1.700-4.400-.3 1.200-1 2-1.900 2.300.5-2.700-.2-6.700-.8-9.800z"/>`,
  star: `<path d="M12 3l2.700 5.900 6.300.7-4.700 4.300 1.300 6.300L12 17.200l-5.600 3 1.300-6.300L3 9.600l6.300-.7z"/>`,
  coin: `<circle cx="12" cy="12" r="9"/>`,
};

/** 圖示。name 是上面的名字；size 是像素（預設 24） */
export function ic(name, size) {
  const style = size ? ` style="--ic:${size}px"` : "";
  if (FILL[name]) return `<svg class="ic ic-${name}" viewBox="0 0 24 24" fill="currentColor"${style} aria-hidden="true" focusable="false">${FILL[name]}</svg>`;
  const body = LINE[name] || LINE.question;
  return `<svg class="ic ic-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${style} aria-hidden="true" focusable="false">${body}</svg>`;
}

// 每個環節的單元圖示
export const UNIT_ICON = {
  "ic-design": "chip", foundry: "factory", packaging: "box", equipment: "gear", memory: "db",
  "ai-chip": "chipai", "ai-server": "server", datacenter: "building", cloud: "cloud", model: "spark", "ai-app": "phone",
};
// 章節裡每一節的關卡圖示（依節的代碼）
export const LEVEL_ICON = {
  what: "bulb", money: "swap", market: "chart", players: "people", moat: "castle", profit: "percent", issues: "warning",
  case: "trophy", journey: "globe", metrics: "percent",
};
export const unitIcon = (nodeId) => UNIT_ICON[nodeId] || "chip";
export const levelIcon = (sectionId, isMatch) => (isMatch ? "trophy" : LEVEL_ICON[sectionId] || "bulb");

/**
 * 吉祥物「小晶」：一顆斜斜的方塊晶片，畫風參考荒野亂鬥（粗黑邊、純色塊、低彩度）。
 * 座標量自本人畫的原圖（1254×1254）：眼睛是純黑的大圓點、右眼比較大比較低、鼻子在兩眼中間偏下。
 * mood：idle（生氣，原圖，會眨眼）、happy、sad、cheer（閉眼笑）、sleepy、wow。col：blue（預設）、green、clay、plum。
 */
const INK = "#0f1520", NOSE = "#b36b00";
const M_OUT = "M430 152 L915 218 Q965 228 1000 270 L1048 330 Q1070 360 1068 395 L1020 740 L990 925 Q985 960 940 1010 L880 1050 Q850 1068 815 1065 L320 1000 Q275 992 245 950 L215 905 Q165 850 168 810 L240 300 Q250 260 290 225 L345 180 Q385 148 430 152Z";
const M_FACE = "M455 278 L870 337 Q910 345 935 375 L950 395 Q962 420 957 460 L895 860 Q885 905 840 925 L805 948 L370 893 Q325 887 300 850 L285 815 Q277 790 282 760 L342 365 Q350 330 385 305 L405 285 Q425 275 455 278Z";
const mPin = (cx, cy, gold) => `<g transform="rotate(7 ${cx} ${cy})"><rect x="${cx - 48}" y="${cy - 62}" width="96" height="124" rx="40" fill="${INK}"/><rect x="${cx - 26}" y="${cy - 40}" width="62" height="80" rx="16" fill="${gold}"/></g>`;
const mBrow = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>`;
const mDots = (ry1, ry2, rx1 = 108, rx2 = 112) => `<g class="m-eyes"><ellipse cx="437" cy="${680 + (112 - ry1)}" rx="${rx1}" ry="${ry1}" fill="${INK}"/><ellipse cx="766" cy="${745 + (115 - ry2)}" rx="${rx2}" ry="${ry2}" fill="${INK}"/></g>`;
const mArc = (d, w = 44) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/>`;
const M_FACES = {
  idle: mBrow("M510 520 Q550 548 582 580") + mBrow("M672 608 Q725 586 772 564") + mDots(112, 115),
  happy: mBrow("M380 545 Q440 500 500 545") + mBrow("M700 600 Q770 555 840 600") + mDots(100, 103),
  sad: mBrow("M385 560 Q450 560 505 515") + mBrow("M700 585 Q770 620 840 660") + mDots(108, 110, 104, 108),
  cheer: mArc("M345 710 Q437 600 530 710") + mArc("M672 770 Q766 660 860 770"),
  sleepy: mArc("M333 700 Q437 760 540 700", 40) + mArc("M660 765 Q766 825 872 765", 40),
  wow: mBrow("M390 520 Q440 490 500 520") + mBrow("M700 550 Q770 520 830 555") + mDots(86, 90, 82, 86),
};
const M_COLORS = {
  blue: { rim: "#587fa9", face: "#cde7f0", gold: "#d6a545" },
  green: { rim: "#6aa186", face: "#f7ead7", gold: "#e0a931" },
  clay: { rim: "#c98a66", face: "#f8e8d2", gold: "#e0b24a" },
  plum: { rim: "#8a84b8", face: "#ebe7f6", gold: "#e0b24a" },
};
export function mascot(mood = "idle", size = 96, col = "blue") {
  const c = M_COLORS[col] || M_COLORS.blue;
  return `<svg class="mascot mascot-${mood}" viewBox="60 90 1100 1050" width="${size}" height="${Math.round(size * 1050 / 1100)}" role="img" aria-label="小晶" focusable="false">
    <path d="${M_OUT}" fill="#000" opacity=".2" transform="translate(22 32)"/>
    ${mPin(213, 457, c.gold)}${mPin(188, 655, c.gold)}${mPin(1055, 572, c.gold)}${mPin(1022, 778, c.gold)}
    <path d="${M_OUT}" fill="${INK}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
    <path d="${M_OUT}" fill="${c.rim}" transform="translate(620 610) scale(.915) translate(-620 -610)"/>
    <path d="${M_FACE}" fill="${c.face}" stroke="${c.face}" stroke-width="6" stroke-linejoin="round"/>
    ${M_FACES[mood] || M_FACES.idle}
    <path d="M588 742 L525 822 L634 832Z" fill="${NOSE}" stroke="${NOSE}" stroke-width="14" stroke-linejoin="round"/>
  </svg>`;
}

// 段位徽章中間的圖案（白色實心）：每個段位一個形狀
const RANK_GLYPH = {
  bronze: `<path d="M12 3l7 4v10l-7 4-7-4V7z"/>`,
  silver: `<path d="M12 3l8 9-8 9-8-9z"/>`,
  gold: FILL.star,
  diamond: `<path d="M6 4h12l4 6-10 11L2 10z"/>`,
  mythic: `<path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z"/>`,
  legendary: FILL.flame,
  masters: `<path d="M3 8l4.500 4L12 5l4.500 7L21 8l-2 11H5z"/>`,
  pro: `<path d="M12 2l2.200 4.800L19 7.500l-3.500 3.600.8 5L12 13.600 7.700 16.100l.8-5L5 7.500l4.800-.7z"/><path d="M6 20.500h12" stroke="currentColor" stroke-width="2.500" stroke-linecap="round"/>`,
};
export const rankGlyph = (id) => `<svg class="rg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${RANK_GLYPH[id] || RANK_GLYPH.bronze}</svg>`;
