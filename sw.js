// Service Worker：讓網站可以離線使用。
// 白話：第一次連線時，把整個 App（程式、資料、圖示）存進手機；之後沒網路也打得開。
// 有網路時一律先抓最新版（改了內容馬上看到），網路慢或斷線才用存起來的舊版。
// 要更新快取的版本號時，改下面的 VERSION；新增檔案時，把路徑加進 SHELL。
const VERSION = "v8";
const CACHE = `semimap-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "css/style.css", "css/app.css", "css/arena.css", "css/charts.css", "css/ui.css",
  "js/app.js", "js/card.js", "js/charts.js", "js/drills.js", "js/fin.js", "js/game.js", "js/glossary.js", "js/icons.js", "js/map.js", "js/match.js",
  "js/quiz.js", "js/screens.js", "js/search.js", "js/state.js", "js/unlocks.js", "js/util.js",
  "js/views/dict.js", "js/views/events.js", "js/views/explore.js", "js/views/hq.js", "js/views/league.js", "js/views/me.js", "js/views/path.js", "js/views/practice.js",
  "data/nodes.json", "data/companies.json", "data/sources.json", "data/glossary.json", "data/game.json",
  "data/events.json", "data/metrics.json", "data/financials.json", "data/chapters/index.json", "data/chapters/intro.json",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 章節檔案從章節清單讀出來，之後新增章節不用改這支程式
    let chapters = [];
    try {
      const res = await fetch("data/chapters/index.json", { cache: "no-store" });
      chapters = (await res.json()).chapters.map((c) => c.file).filter(Boolean).map((f) => `data/chapters/${f}`);
    } catch { /* 離線安裝失敗就略過，之後瀏覽時會再快取 */ }
    // 一個一個存：某個檔案抓不到，不會讓整個安裝失敗
    await Promise.allSettled([...SHELL, ...chapters].map((url) => cache.add(new Request(url, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("semimap-") && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // 只處理自己網站的 GET 請求；外部來源連結、其他網站一律不碰
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NETWORK_TIMEOUT_MS);
    const res = await fetch(req, { signal: ctrl.signal, cache: "no-cache" });
    clearTimeout(timer);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (hit) return hit;
    return new Response("目前沒有網路，而且這個檔案還沒存進手機。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
