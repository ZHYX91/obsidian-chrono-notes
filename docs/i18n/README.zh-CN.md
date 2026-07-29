# Chrono Notes Calendar

[English](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.zh-CN.md)

Chrono Notes Calendar 是一个面向 Obsidian 周期笔记工作流的日历插件，整合周期笔记、可选历法扩展、地区节假日、任务、统计和区间笔记。

## 界面截图

### 周期笔记导航

无需离开笔记，即可切换相邻周期笔记、跳转到上级周期或返回日历。

![Chrono Notes Calendar 周期笔记导航与月历](https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-navigation-en.png)

### 日历工作区

在月历中集中查看笔记状态、任务、本地 ICS 事件、节假日和区间笔记。

![Chrono Notes Calendar 桌面端区间笔记与月历](https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-desktop-en.png)

### Android

同一套日历工作区会适配触控操作和窄屏布局。

<p align="center">
  <img src="https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-android-en.png" alt="Chrono Notes Calendar Android 月历" width="360">
</p>

## 功能特性

- 年、月、周三种日历视图，集中呈现笔记状态、任务、节假日、本地 ICS 事件和区间笔记；
- 日、周、月、季度、年五类周期笔记，支持内置模板或 Templater 模板；
- Note Navbar 支持在相邻笔记、上级周期、所选日期和日历工作区之间导航；
- 中国农历与干支历法扩展，包括节气和传统节日；
- 太阳希吉拉历、埃塞俄比亚历、希伯来历、印度国定历（萨迦历）、伊斯兰民用历和乌姆库拉历扩展；
- 中国大陆和新加坡节假日扩展；
- 任务、统计、月/年热力图、笔记预览、任务完成状态切换和截止日期调整；
- 通过日期范围拖选创建区间笔记，并支持跨周布局、模板和可搜索的区间笔记列表；
- 本地只读 ICS 日历来源；
- 可配置 Obsidian 日期与日期时间属性的显示格式，同时保持 ISO YAML、原生分段编辑和可选的日记打开功能；
- 英文、简体中文、繁体中文、阿拉伯语、波斯语、希伯来语、阿姆哈拉语和印地语界面，并为相应语言提供从右到左布局。

源笔记和插件设置都保留在 Vault 内。只读 ICS 来源既可以是 Vault 文件，也可以是用户明确配置的桌面本地路径；插件不会上传这些文件。Chrono Notes Calendar 只会在设备本地 IndexedDB 中保存派生的 NoteIndex 缓存；该缓存不会写入 Vault，也不会发送到远程服务。插件不要求账号。

## 开始使用

1. 在 Chrono Notes Calendar 设置中启用需要的周期笔记类型，并确认路径格式；
2. 从侧边栏图标或命令面板打开日历；
3. 按需启用历法、节假日扩展或添加本地 ICS 来源；
4. 选择日期以打开或创建对应周期笔记。

## 限制

- ICS 来源是本地只读文件，插件不直接抓取远程日历订阅；
- 节假日可用范围取决于已核验的官方数据，尚未发布的未来安排会显示为不可用，不使用预测数据；
- 非公历历法只是由运行环境 Unicode 历法数据驱动的显示扩展；公历始终是笔记路径、导航和索引锚点，不受运行环境支持的扩展会安全隐藏；
- 部分移动端交互与布局细节受 Obsidian 应用和设备输入栈影响。

## 手动安装

从[最新版本](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest)下载 `chrono-notes-<version>.zip`，解压到 `Vault/.obsidian/plugins/`。压缩包已经包含 `chrono-notes/` 目录和三个插件文件。重新加载 Obsidian 后，在第三方插件中启用 Chrono Notes Calendar。

## 开发

```bash
pnpm install
pnpm check
```

开发环境需要 Node.js 22.13 及以上的 22.x 版本，或 Node.js 24 及更高版本，以及 pnpm 11.7.0。架构与测试细节见[开发者文档](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/architecture.zh-CN.md)。

一般问题、使用帮助与体验反馈可在 [GitHub Discussions](https://github.com/ZHYX91/obsidian-chrono-notes/discussions) 中交流；可复现缺陷和明确的功能建议请使用结构化的 [GitHub Issue 表单](https://github.com/ZHYX91/obsidian-chrono-notes/issues/new/choose)。安全漏洞只能通过 GitHub 的[私人漏洞报告](https://github.com/ZHYX91/obsidian-chrono-notes/security/advisories/new)提交，详细要求见[安全策略](https://github.com/ZHYX91/obsidian-chrono-notes/security/policy)。不要在公开页面发布真实的 Vault 路径、笔记或任务内容、日历或 ICS 数据、源地址、凭据及个人信息。

## 致谢

Chrono Notes Calendar 受到以下项目的启发：

- Liam Cain：[Calendar](https://github.com/liamcain/obsidian-calendar-plugin)
- 纳米级尘埃（a-nano-dust）：[Dust Calendar](https://github.com/a-nano-dust/dust-obsidian-calendar)
