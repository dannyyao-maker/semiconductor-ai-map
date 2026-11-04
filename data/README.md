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
