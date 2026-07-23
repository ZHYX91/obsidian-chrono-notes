# Chrono Notes（时序笔记）

Chrono Notes 是一个面向 Obsidian 周期笔记工作流的日历插件，整合周期笔记、可选历法扩展、地区节假日、任务、统计和区间笔记。

## 界面截图

<table>
  <thead>
    <tr>
      <th>PC</th>
      <th>Android</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td width="70%"><img src="https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-desktop-en.png" alt="Chrono Notes 桌面端区间笔记与月历"></td>
      <td width="30%"><img src="https://raw.githubusercontent.com/ZHYX91/obsidian-chrono-notes/main/docs/assets/chrono-notes-android-en.png" alt="Chrono Notes Android 月历"></td>
    </tr>
  </tbody>
</table>

## 功能特性

- 年、月、周三种日历视图；
- 日、周、月、季度、年五类周期笔记；
- 中国农历与干支历法扩展，包括节气和传统节日；
- 中国大陆和新加坡节假日扩展；
- 任务、统计、热力图、区间笔记、模板和预览；
- 本地只读 ICS 日历来源；
- 英文、简体中文和繁体中文界面。

日历信息和插件设置都保留在 Vault 内。Chrono Notes 不要求账号，也不会把日历和笔记数据发送到远程服务。

## 开始使用

1. 在 Chrono Notes 设置中启用需要的周期笔记类型，并确认路径格式；
2. 从侧边栏图标或命令面板打开日历；
3. 按需启用历法、节假日扩展或添加本地 ICS 来源；
4. 选择日期以打开或创建对应周期笔记。

## 限制

- ICS 来源是本地只读文件，插件不直接抓取远程日历订阅；
- 节假日可用范围取决于已核验的官方数据，尚未发布的未来安排会显示为不可用，不使用预测数据；
- 部分移动端交互与布局细节受 Obsidian 应用和设备输入栈影响。

## 手动安装

从[最新版本](https://github.com/ZHYX91/obsidian-chrono-notes/releases/latest)下载 `chrono-notes-<version>.zip`，解压到 `Vault/.obsidian/plugins/`。压缩包已经包含 `chrono-notes/` 目录和三个插件文件。重新加载 Obsidian 后，在第三方插件中启用 Chrono Notes。

## 开发

```bash
pnpm install
pnpm check
```

开发环境需要 Node.js 22.13 及以上的 22.x 版本，或 Node.js 24 及更高版本，以及 pnpm 11.7.0。架构与测试细节见[开发者文档](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/architecture.zh-CN.md)。问题与功能建议可提交到 [GitHub Issues](https://github.com/ZHYX91/obsidian-chrono-notes/issues)。

## English

See the [English README](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/README.md).
