# data/：網站內容資料

網站只讀這裡的 JSON 檔。改內容不用改程式。

## 審核狀態（status）

`待查證`（Claude Code 用一般知識寫的底稿）→ `待審核`（已對過來源、附連結與 asOf）→ `已審核`（本人讀過並確認）

## nodes.json：環節

- `zones`：三大區塊（`semi`、`ai-hw`、`ai-sw`）
- `nodes`：11 個環節，`id` 是固定代碼，之後的滑卡、事件模擬都用它接上來，**不要改**

| 欄位 | 意思 |
| --- | --- |
| `oneLiner` | 一句話定位 |
| `analogy` | 白話比喻 |
| `upstream` / `downstream` | 上游與下游（環節代碼或文字） |
| `companies` | 代表公司代碼（對應 companies.json） |
| `business` | 怎麼賺錢：`model` 商業模式、`margin` 利潤高低、`bargainingPower` 議價能力 |
| `issues` | 當前問題，每條 `{ text, sources: [來源代碼], asOf, status }` |
| `topics` | 熱門話題，格式同上 |
| `reading` | 延伸閱讀（來源代碼） |

## companies.json：公司

每家 `{ id, name, nameEn, country, segments: [環節代碼], oneLiner, moat（護城河）, risks（主要風險）, sources, asOf, status }`

## sources.json：來源

每筆 `{ id, publisher, title, url, asOf, type（法說會／報告／新聞稿…）}`

---

# 學習 App 的資料（2026-11-10 起）

學習 App 新增五種資料。前四種是內容，照固定格式填寫，程式就會自動顯示；第五種是遊戲規則的設定。

## chapters/：探索章節

`chapters/index.json` 是章節清單：`start` 是第一章（`ic-design`），其他章節在**相鄰環節**完成「認識」之後解鎖。相鄰的意思是 `nodes.json` 裡 `upstream`／`downstream` 有互相指到。`file` 是 `null` 表示內容還沒做。

每一章一個檔案，例如 `chapters/ic-design.json`。`chapters/intro.json` 是 3 分鐘的全景開場（只有 `story` 畫面，`node` 標出目前在產業鏈的哪一站，`all` 表示全部亮起）。

章節的 `final` 部分設定 `"match": true`，裡面的題目會以對局方式進行（見 game.json）。章節內容的狀態（`status`）一樣是 `待審核`，本人讀過後改成 `已審核`。

| 欄位 | 意思 |
| --- | --- |
| `node` | 對應的環節代碼 |
| `title`、`tagline` | 章節名稱、一句話介紹 |
| `parts` | 章節的四個部分，依序是 `know`（認識）、`compare`（比較）、`finance`（財報）、`final`（章末個案） |

每個部分 `{ id, name, minRank, sections }`：`minRank` 是需要的最低段位（例如財報部分是 `gold`），不需要就不寫。`sections` 依模板分成 9 個主題：

| 部分 | 主題代碼 | 主題 |
| --- | --- | --- |
| know | `what`、`money`、`market` | 在做什麼、錢怎麼流、市場多大 |
| compare | `players`、`moat`、`profit`、`issues` | 誰是玩家、憑什麼贏、怎麼賺錢、現在的挑戰 |
| finance | `metrics` | 關鍵財報指標 |
| final | `case` | 章末個案 |

每個主題 `{ id, title, screens }`，`screens` 是一張一張的畫面。畫面的種類（`type`）：

| type | 用途 | 欄位 | 計分 |
| --- | --- | --- | --- |
| `story` | 情境、說明 | `speaker`（說話的人，可省略）、`text`、`sources` | 否 |
| `choice` | 探索選擇，選了看說明 | `prompt`、`options: [{ label, reveal }]` | 否 |
| `stat` | 數字重點 | `title`、`items: [{ label, value, note }]`、`sources` | 否 |
| `bars` | 排名長條圖 | `title`、`unit`、`items: [{ label, value, note, tw（台灣公司標色） }]`、`sources` | 否 |
| `kpi` | 重點數字卡 | `title`、`items: [{ label, value, delta, dir: up／down }]`、`sources` | 否 |
| `line` | 折線圖 | `title`、`subtitle`、`x`（\n 換行）、`series: [{ label, values, range: {i, lo, hi}, labelPos }]`、`forecastFrom`（從第幾點起是財測，畫虛線＋空心點）、`yMin`／`yMax`／`yStep`、`dec`、`suffix`、`yLabel`、`sources` | 否 |
| `dbars` | 正負長條圖（例如季增率） | `title`、`valueName`、`items: [{ label, value, share }]`、`sources` | 否 |
| `segbar` | 堆疊條（一個整體分成幾塊） | `title`、`items: [{ label, value, other, note }]`（`other: true` 用灰色）、`footnote`、`sources` | 否 |
| `matrix` | 影響矩陣 | `title`、`columns`、`rows: [{ node, label, sub, cells: [{ d: +／-／0 或省略, text, infer }] }]`、`sources` | 否 |
| `compare` | 公司對比表 | `title`、`companies: [公司代碼]`、`rows: [{ label, values: [] }]`、`sources` | 否 |
| `flow` | 錢怎麼流 | `title`、`steps: [{ label, node, note }]` | 否 |
| `quiz` | 計分題 | 見下方「題目」 | 是 |

## 題目（quiz）

`{ type: "quiz", id, difficulty, prompt, options: [文字], answer: 正確選項的位置（從 0 開始）, explain, sources }`

- `id` 全站不能重複，例如 `ic-design.case.1`。
- `difficulty`：1 基礎、2 進階、3 高階。段位不到的難度不會出現（見 `game.json`）。
- `explain` 一定要寫：答錯又沒有解說，學習效果很差。
- 同一題只有第一次作答會加減盃數，之後再答是練習。

## events.json：事件任務

每個事件：

| 欄位 | 意思 |
| --- | --- |
| `id`、`date`、`title` | 代碼、發生日期、標題 |
| `summary` | 一句話說明 |
| `origin` | `官方` 或 `二手` |
| `status` | `自動整理・待審核`、`待審核`、`已審核`；二手來源的草稿不放在這個檔案 |
| `nodes` | 需要先懂的環節（沒學過的會附 30 秒速覽） |
| `impacts` | `[{ node, effect: "+" / "-" / "0", reason }]`：地圖上的綠燈（受惠）、紅燈（受害）、灰色（影響不大） |
| `briefing` | 狀況簡報，格式同章節的 `screens`（不含 quiz） |
| `matrix` | 影響矩陣（畫面格式見上表，`type: "matrix"`），在地圖導覽之後顯示 |
| `questions` | 3 題，格式同「題目」；題目可以加 `visual`（一個圖表畫面，例如折線圖），做成「看圖題」 |
| `conclusion` | 結案時的一句話局勢總結 |
| `sources` | 來源代碼 |
| `activeDays` | 在首頁顯示幾天（預設 30），之後移到事件檔案 |

## metrics.json：指標字典

每個指標 `{ id, name, en, abbr, category, formula, meaning, highLow, semiNote, related }`：

| 欄位 | 意思 |
| --- | --- |
| `category` | 獲利能力、成長、財務結構、經營效率、估值 |
| `formula` | 公式 |
| `meaning` | 這個指標在看什麼（不教財務基礎，只講重點） |
| `highLow` | 偏高、偏低通常代表什麼 |
| `semiNote` | 半導體與 AI 產業的常見範圍與特殊情況 |
| `related` | 最常看這個指標的環節代碼 |

## financials.json：公司財報數字（之後新增）

每家公司、每一期的指標數字，只用官方財報，附來源和期間。本益比這類跟股價有關的數字，每季更新一次並標日期。

## game.json：段位與遊戲規則

- `ranks`：8 個段位。`tiers` 是每一階的起始盃數；`win`／`loss` 是在這個段位答對加、答錯扣的盃數；`match` 是這個段位一局幾回合（`questions`）、每題幾秒（`seconds`，0＝不計時，青銅不計時）；`icon` 是徽章上的符號。
- `scoring`：每局最後一題是段位能出的最難題目，盃數乘以 `lastMultiplier`。對局是個人答題（像 Duolingo 的一課）：上方進度條對綠錯紅，答完從下方滑出結果和解析，結束後有「本局複習」，可以把答錯的題再練一次（不計盃）。
- `readMs`：先出現題目、閱讀幾秒後才出現選項；選項出現時開始倒數，時間到算答錯。
- 盃數不會掉出已經達到的大段位（例如到過黃金，最低就是黃金 I 的起始盃數）。
- `difficulty`：每個題目難度需要的最低段位。
- `streak`：連續天數。當天完成至少一題計分題才算一天，以台灣時間午夜為界，斷一天就歸零；`milestones` 是連續天數的獎勵（目前是當天答對盃數加倍）。

## 學習進度存在哪裡

全部存在瀏覽器的 localStorage（`semimap.game`），不需要帳號。換電腦或清除瀏覽資料會消失，所以「我的」頁面可以匯出、匯入進度。

## 圖表的規則

- 數字只用官方來源；從官方數字推算出來的，要在 `note` 或 `footnote` 寫明（例如「由 100% 減去 79% 推得」）。
- 財測（公司預估）不是實績：折線圖用虛線和空心圓點標示，並附區間。
- 顏色：受惠＝藍、受壓＝橘，都附 ▲▼ 和文字。不用紅綠，因為台股紅漲綠跌，容易看反。
- 每張圖都附「看數據表」，也能點／停留看每個數字。
