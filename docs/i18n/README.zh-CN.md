# Chrono Notes

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [עברית](README.he.md) · [አማርኛ](README.am.md) · [हिन्दी](README.hi.md)

Chrono Notes 是一个 Obsidian 日历插件，帮你按日期整理日记、周记等周期笔记，并在同一处查看任务、节假日、统计和跨多天的笔记。

## 功能特性

先看看桌面版和 Android 版的日历界面：

![Chrono Notes 桌面版日历工作区](../assets/chrono-notes-desktop-en.png)

![Chrono Notes Android 日历工作区](../assets/chrono-notes-android-en.png)

- 世纪视图按年代分组，直接浏览年份、创建或打开周期笔记；
- 年、月、周三种日历视图，集中呈现笔记状态、任务、节假日、本地 ICS 事件和区间笔记；
- 日、周、月、季度、年、年代和世纪七类周期笔记，支持内置模板或 Templater 模板；
- 周期笔记上方的导航栏可以打开相邻笔记、更大周期的笔记、所选日期和日历；
- 中国农历与干支历法扩展，包括节气和传统节日；
- 太阳希吉拉历、埃塞俄比亚历、希伯来历、印度国定历（萨迦历）、伊斯兰民用历和乌姆库拉历扩展；
- 中国大陆和新加坡节假日扩展；
- 任务、统计、月/年热力图、笔记预览、任务完成状态切换和截止日期调整；
- 通过日期范围拖选创建区间笔记，并支持跨周布局、模板和可搜索的区间笔记列表；
- 本地只读 ICS 日历来源；
- 自定义 Obsidian 日期与日期时间属性的显示方式，不改动保存的值或原有编辑控件，也可从日期属性打开对应日记；
- 16 种语言的界面和使用说明；阿拉伯语、波斯语与希伯来语支持从右到左布局。

笔记和插件设置仍保存在 Obsidian 笔记库中。Chrono Notes 只会读取你选定的本地 ICS 日历文件，不会上传这些文件。为了让日历打开得更快，它会在本机 IndexedDB 中保存一份可随时重建的笔记索引；索引不会写进笔记库，也不会发送到网络。不需要注册账号。

## 使用要求与兼容性

- 支持桌面端和移动端的 Obsidian 1.12.7 或更高版本；
- 笔记库内的本地 ICS 文件可在受支持平台使用；笔记库外的本地文件路径仅支持电脑端；
- 可选的非公历历法依赖 Obsidian 运行环境提供的历法数据，不可用时会安全隐藏。

## 安装

### 社区插件（推荐）

在 Obsidian 中打开**设置 → 第三方插件 → 浏览**，搜索 **Chrono Notes**，点击**安装**并**启用**。也可以先打开 [Chrono Notes 社区插件页面](https://obsidian.md/plugins?id=chrono-notes)。通过社区插件市场安装，无需自己解压 ZIP。

### 手动安装

从[最新版本](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest)下载 `chrono-notes-<version>.zip`，解压到 `Vault/.obsidian/plugins/`。压缩包包含 `chrono-notes/` 目录及其中的 `main.js`、`manifest.json` 和 `styles.css`。重新加载 Obsidian 后，在第三方插件中启用 Chrono Notes。

### 升级

如果存在 `Vault/.obsidian/plugins/chrono-notes/data.json`，请先备份并保留。只替换 `main.js`、`manifest.json` 和 `styles.css`；只有在明确希望重置全部插件偏好时才删除 `data.json`。

## 使用

主日历、月份选择器和日期弹窗始终使用公历。切换界面语言会改变月份名称和数字的显示方式，不会切换历法；需要其他历法信息时，请单独选择历法扩展。

**添加 ICS 来源之前：** Chrono Notes 只读取本地日历文件，不订阅远程日历，也不会展开带 `RRULE` 或 `RDATE` 的重复事件。跳过的事件会计数提示，因此依赖重复规则的日历可能显示不全；Vault 外的来源路径仅支持桌面端。

**初次使用：** 先在 Chrono Notes 设置中选择要使用的周期笔记类型和保存路径，再从侧边栏图标打开日历。单击日期只会选中，双击或按 Enter 打开或创建笔记。手机上长按日期，打开菜单后选择打开或创建日记。仅选中日期不会自动新增笔记。

1. 在 Chrono Notes 设置中启用需要的周期笔记类型，并确认路径格式；
2. 从侧边栏图标或命令面板打开日历；
3. 按需启用历法、节假日扩展或添加本地 ICS 来源；
4. 单击日期只会选择；双击或按 Enter 打开或创建对应周期笔记。右键打开日期菜单；当天存在 ICS 事件时，可通过“查看日历事件”查看完整列表。手机上长按日期可打开菜单；如果没有弹出菜单，松手后会直接打开或创建日记。长按周、月等周期入口则直接打开对应笔记。

### 让任务显示在日历中

在笔记中添加复选框任务，并写上日期标记：

```markdown
- [ ] 提交周报 📅 2026-10-20
- [ ] 准备资料 🛫 2026-10-18 ⏳ 2026-10-19 📅 2026-10-20
```

`🛫` 表示开始日期，`⏳` 表示计划日期，`📅` 表示截止日期。日期使用 `YYYY-MM-DD` 格式。周视图显示开始、计划或截止日期落在本周的任务。同一任务在不同日期会分别显示，同一天的多个日期标记合并显示。没有日期的任务仍计入所属笔记的任务进度。

在周视图中，可以通过截止日期下拉框把任务改到本周另一天；电脑端也可将截止日期任务拖到目标日期。这些操作会修改原笔记中已有的截止日期。

### 年代与世纪笔记

世纪视图左侧年代格跨两行，右侧每行五年。窄屏时年代格移到上方；侧栏很窄或字号较大时，年份改为两列。世纪之外的年份保留空位。进入视图时定位到所选年份的年代，“当前世纪”返回当前年代。年份滚动时，顶部导航保持可见。

在设置中启用两类笔记后，右栏切换到“世纪”，通过左侧年代格访问年代笔记，已启用的世纪笔记也有对应入口。视图标签保留“周、月、年、世纪”。周期格与年视图共用笔记圆点、任务进度、选中和预览：单击选择，双击或 Enter 打开或创建笔记，Ctrl/Cmd 单击或中键在新标签打开，触屏支持长按。通过视图切换按钮浏览所选周期。年代默认为 `[diary]/DEC[s]`（2020s），世纪默认为 `[diary]/[C]CEN`（C21）。

年代按 2020–2029 划分，第 21 世纪为 2001–2100。`DEC` 与 `CEN` 是 Chrono Notes 扩展，固定输出数字。建议选择世纪或年代作为目录分组：2000s 跨越 C20/C21，年代笔记本身按首年 2000 归入 C20。现有笔记不会自动移动。

模板沿用相同格式：`{{date:DEC[s]}}`、`{{date:[C]CEN}}`、`{{start:YYYY}}–{{end:YYYY}}`。所有周期模板均支持起止日期与包含首尾的 `{{days}}`；周期笔记与区间笔记设置页分别列出适用占位符、含义、示例及 Templater 对应写法；“常规 → 模板设置”说明通用语法与默认格式。

### 区间笔记

先在**设置 → Chrono Notes → 区间笔记**中选择保存目录。电脑端可在月历上从开始日期拖到另一个结束日期，创建区间笔记；也可以从日期菜单或命令面板选择“创建区间笔记”，再填写起止日期。新建区间至少跨两个日期；开始日期晚于结束日期时，会自动交换两者。

要让已有笔记显示为区间，请在 Markdown 文件顶部添加以下属性：

```yaml
---
chrono-notes: interval
start: 2026-10-18
end: 2026-10-20
---
```

日期使用完整的 `YYYY-MM-DD` 格式，开始日期不能晚于结束日期，显示范围包含首尾两天。已有笔记也支持至少包含小时和分钟的完整 ISO 日期时间，以及同一天内的区间。

区间笔记必须包含有效的 `start` 和 `end` 属性。Chrono Notes 新建的区间笔记还会写入
`chrono-notes: interval`，并在整个笔记库中识别。未设置 `chrono-notes` 属性的笔记仅在设置的
未标记区间笔记识别范围内识别；该属性为其他值时不识别。插件不会自动修改现有笔记。

## 设置

常规设置提供使用指南和报告问题入口。修改历法或节假日扩展后，当前设置页签仍保持可见，键盘焦点留在刚操作的控件上。

设置覆盖周期笔记路径和模板、历法与节假日扩展、任务与统计显示、本地 ICS 来源、区间笔记，以及 Obsidian 日期与日期时间属性的显示方式。插件设置保存在 `data.json` 中；笔记内容和属性仍保留在笔记库内。

## 限制

- ICS 来源是本地只读文件，插件不直接抓取远程日历订阅；默认每次刷新最多读取 32 个已配置来源，超出的来源会明确报告为已省略；当前会跳过并计数带 `RRULE`/`RDATE` 的重复事件，而不会展开其重复实例。时区定义无效或不受支持的事件也会跳过并报告；
- 节假日可用范围取决于已核验的官方数据，尚未发布的未来安排会显示为不可用，不使用预测数据；
- 切换历法只改变日历显示；笔记命名、日期导航和任务日期仍按公历计算，Obsidian 运行环境不支持的历法扩展会隐藏；
- 不同手机、平板、Obsidian 版本和输入方式的操作体验与布局可能略有差异。

## 隐私与安全

Chrono Notes 会获取 Markdown 文件列表并读取相关笔记，用于显示笔记状态、日历、任务、统计和路径建议，也会读取你选定的本地 ICS 文件。它不上传笔记、任务、日历或 ICS 数据，也不要求账号。笔记索引保存在本机 IndexedDB 中，可以从笔记重新生成，不参与笔记库同步。只有你选择“复制日期”后，插件才会把格式化日期写入系统剪贴板；它从不读取剪贴板。

## 开发

开发环境严格要求 Node.js 24.19.0 和 npm 11.17.0。

```bash
npm ci
npm run check
npm exec playwright -- install chromium
npm run test:browser
```

开发者参考文档：

- [产品需求](../product-requirements.zh-CN.md)
- [交互规范](../ux-spec.zh-CN.md)
- [架构说明](../architecture.zh-CN.md)
- [测试策略](../testing-strategy.zh-CN.md)
- [变更日志](../../CHANGELOG.md)
- [贡献指南](../../CONTRIBUTING.md)
- [安全策略](../../SECURITY.md)

## 支持

- [Q&A](https://github.com/ZHYX91/obsidian-chrono-notes/discussions/categories/q-a)：使用和配置问题。
- [Ideas](https://github.com/ZHYX91/obsidian-chrono-notes/discussions/categories/ideas)：尚待讨论的功能与工作流想法。
- [Show and tell](https://github.com/ZHYX91/obsidian-chrono-notes/discussions/categories/show-and-tell)：技巧、工作流和参考实现。
- 可复现缺陷和明确的功能建议请使用结构化的 [GitHub Issue 表单](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose)；
- 安全漏洞只能通过 GitHub 的[私人漏洞报告](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new)提交，详细要求见[安全策略](https://github.com/ZHYX91/obsidian-chrono-notes/security/policy)。

不要在公开页面发布真实的 Vault 路径、笔记或任务内容、日历或 ICS 数据、源地址、凭据及个人信息。

## 许可证

[MIT](../../LICENSE) © ZhengYX

## 致谢

Chrono Notes 受到以下项目的启发：

- Liam Cain：[Calendar](https://github.com/liamcain/obsidian-calendar-plugin)
- 纳米级尘埃（a-nano-dust）：[Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar)
