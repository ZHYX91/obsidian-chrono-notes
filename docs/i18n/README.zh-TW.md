# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português](README.pt-BR.md) · [Русский](README.ru-RU.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes 是 Obsidian 的日曆工作區，整合週期筆記、任務、地區假日、本機日曆事件及日期區間筆記。

## 功能特色

桌面版和 Android 版的日曆畫面：

![Chrono Notes 桌面版日曆畫面](../assets/chrono-notes-desktop-en.png)

![Chrono Notes Android 日曆畫面](../assets/chrono-notes-android-en.png)


- 提供週、月、年和世紀檢視，呈現筆記狀態、任務進度、統計與預覽。
- 支援日、週、月、季、年、年代與世紀筆記，可搭配內建範本或 Templater。
- 支援筆記間導覽、熱力圖、指定日期範圍的區間筆記，以及本機唯讀 ICS 來源。
- 可選用農曆、干支、波斯、衣索比亞、希伯來、印度與伊斯蘭曆，並顯示中國大陸和新加坡的假日。
- 可以調整 Obsidian 日期及日期時間屬性的顯示方式，不會更動 YAML 中的原始日期。

## 需求與相容性

桌面和行動裝置需使用 Obsidian 1.12.7 或更新版本。Vault 內的 ICS 檔案可跨支援平台使用；Vault 外的本機路徑僅桌面版支援。其他曆法是否可用，取決於執行環境提供的資料。

## 安裝

### 社群外掛

在 Obsidian 開啟**設定 → 第三方外掛 → 瀏覽**，搜尋 **Chrono Notes**，依序點選**安裝**及**啟用**。

### 手動安裝

從[最新版本](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest)下載 `chrono-notes-<version>.zip`，解壓縮至 `Vault/.obsidian/plugins/`。`chrono-notes/` 資料夾應包含 `main.js`、`manifest.json`、`styles.css`。重新載入 Obsidian 並啟用外掛。

### 更新

若已有 `data.json`，請備份並保留。只需替換外掛程式檔案；除非要重設偏好設定，否則不要刪除 `data.json`。

## 使用方式

先在設定中選取週期筆記類型、路徑與範本，再透過側邊欄或命令面板開啟日曆。**按一下日期只會選取，不會自動建立筆記。**按兩下或按 Enter 才會開啟或建立筆記。按右鍵可以叫出日期操作選單；當天有 ICS 事件時，選擇「查看行事曆事件」即可查看完整清單。Ctrl/Cmd 加按或滑鼠中鍵可在新分頁開啟。也可視需要啟用其他曆法、假日及本機 ICS 來源。

在觸控螢幕上，長按日期會開啟選單，可從中選擇開啟或建立日記；如果沒有出現選單，放開手指後會直接開啟或建立日記。長按週、月等週期入口，則會直接開啟對應筆記。

### 讓任務顯示在日曆中

在筆記中加入核取方塊任務，並寫上日期標記：

```markdown
- [ ] 提交週報 📅 2026-10-20
- [ ] 準備資料 🛫 2026-10-18 ⏳ 2026-10-19 📅 2026-10-20
```

`🛫` 表示開始日期，`⏳` 表示排程日期，`📅` 表示截止日期。日期使用 `YYYY-MM-DD` 格式。週檢視會列出開始、排程或截止日期落在目前顯示週次的任務。同一任務在不同日期會分別顯示；同一天的多個日期標記只顯示一筆。沒有日期的任務仍會計入所屬筆記的任務進度。

可透過週檢視中的截止日期下拉選單，將任務改到目前顯示週次的另一天；桌面版也可將截止日期任務拖到目標日期。這些操作會修改原筆記中已有的截止日期。

### 年代與世紀筆記

世紀檢視會把每個年代放在兩排、每排五年的年份旁邊。視窗較窄時，年代格會移到年份上方；側欄很窄或字級較大時，年份會改成兩欄。不屬於該世紀的年份位置會留白。進入檢視時會顯示所選年份的年代；「目前世紀」則會回到目前年代，捲動年份時頂端導覽列仍會顯示。

先在設定中啟用年代和世紀筆記，再在側邊欄切換到「世紀」。點選年代格或已啟用的世紀筆記格即可選取，按兩下或 Enter 才會開啟或建立筆記。Ctrl/Cmd 加按或滑鼠中鍵可在新分頁開啟；觸控裝置支援長按。週、月、年、世紀檢視中的周期格沿用筆記標記、任務進度與預覽。年代筆記的預設路徑為 `[diary]/DEC[s]`（例如 2020s）；世紀筆記為 `[diary]/[C]CEN`（例如 C21）。

年代按 2020–2029 這樣的範圍計算，第 21 世紀則是 2001–2100。`DEC` 和 `CEN` 是 Chrono Notes 的固定數字格式。建議選擇以年代或世紀其中一種建立資料夾，不要同時巢狀分類：2000 年代跨越 C20/C21，但其年代筆記依起始年 2000 歸在 C20。既有筆記不會自動搬移。

範本使用相同的格式，例如 `{{date:DEC[s]}}`、`{{date:[C]CEN}}`、`{{start:YYYY}}–{{end:YYYY}}`。所有週期範本都能使用起訖日期及包含首尾的 `{{days}}`。各筆記設定頁列有占位符、意義、範例及 Templater 對應語法；共用格式可到「一般 → 範本設定」查看。

### 區間筆記

先到**設定 → Chrono Notes → 區間筆記**選擇儲存資料夾。在桌面版月曆上，從開始日期拖到另一個結束日期，即可建立區間筆記；也可以從日期選單或命令面板選擇「建立區間筆記」，再填入起訖日期。新建區間至少要跨兩個日期；如果起訖日期填反，會自動按先後順序排列。

要讓既有筆記顯示為區間，請在 Markdown 檔案頂端加入以下屬性：

```yaml
---
chrono-notes: interval
start: 2026-10-18
end: 2026-10-20
---
```

日期使用完整的 `YYYY-MM-DD` 格式，開始日期不得晚於結束日期；顯示範圍包含首尾兩天。既有筆記也支援至少含小時和分鐘的完整 ISO 日期時間，以及同一天內的區間。

區間筆記必須具有有效的 `start` 和 `end` 屬性。Chrono Notes 新建立的區間筆記也會寫入 `chrono-notes: interval`，因此可以在整個 Vault 中辨識。

如果沒有 `chrono-notes` 屬性，只有位於設定的「未標記區間筆記辨識範圍」內才會被辨識；如果該屬性的值不是 `interval`，則不會被當成區間筆記。外掛不會自動改動既有筆記。

## 設定

可設定介面語言、一週從哪一天開始、日期顯示格式、路徑及範本。變更檔名使用的語言不會替現有檔案重新命名，請先檢查路徑預覽。外觀、任務、統計、區間筆記及擴充功能各有獨立設定。

## 限制

- ICS 來源為本機唯讀檔案，不會直接下載遠端日曆訂閱。每次重新整理預設最多讀取 32 個來源，超出的來源會標示為已略過。含 `RRULE` 或 `RDATE` 的重複事件目前會略過並計數，不會展開。
- ICS 檔案內的時區定義支援常見的年度夏令時間規則，以及逐一列出的時區變更日期。無效、不受支援或過於密集的定義會讓依賴該時區的事件被略過，並顯示提示。
- 尚未正式公布的假日不會預測。切換曆法只改變日曆顯示，筆記名稱、日期導覽及任務日期仍使用公曆；執行環境不支援的曆法會隱藏。
- 行動裝置的操作與版面可能因 Obsidian 版本、裝置和輸入方式而略有不同。

## 隱私與安全

外掛會讀取相關 Markdown 筆記及使用者指定的本機 ICS 檔案，以建立顯示所需的索引。資料不會上傳，也無須帳號。衍生索引儲存在裝置本機 IndexedDB，必要時可重新建立。外掛不會讀取剪貼簿；只有使用者按下「複製日期」才會寫入。

## 開發

開發需使用 Node.js 24.19.0 與 npm 11.17.0，執行 `npm ci` 及 `npm run check`。詳見[架構說明](../architecture.zh-CN.md)及[測試策略](../testing-strategy.zh-CN.md)。

## 支援

使用問題與構想可到 [Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions) 討論；可重現的問題請透過 [Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose) 回報。安全漏洞請[私下通報](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new)，切勿公開 Vault 的私人內容。

## 授權

[MIT](../../LICENSE) © ZhengYX

## 致謝

本專案受到 [Calendar](https://github.com/liamcain/obsidian-calendar-plugin) 與 [Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar) 的啟發。
