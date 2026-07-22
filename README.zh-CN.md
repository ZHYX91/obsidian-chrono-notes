# Chrono Notes（时序笔记）

Chrono Notes 是一个面向 Obsidian 周期笔记工作流的日历插件，整合周期笔记、中国农历、地区节假日、任务、统计和区间笔记。

> 当前状态：功能对等与发布加固的仓库内实现已完成；本轮全仓库审计修复已通过自动发布门禁，最新产物已复制并逐文件校验到主 Vault 与本地隔离 Vault。磁盘部署不等于 Obsidian 显式重载、真实设备通过或正式发布；中国大陆 2027 官方节假日安排尚未发布，门禁会保留 `unavailable` 并发出警告，不使用预测数据。

## 产品范围

- 年、月、周三种视图；
- 日、周、月、季度、年五类周期笔记；
- 中国农历扩展，包括农历日期、节气和传统节日；
- 中国大陆和新加坡节假日扩展；
- 任务、统计、热力图、区间笔记、模板、预览和本地只读 ICS；
- 英文、简体中文、繁体中文界面。

详细内容见[产品需求](docs/product-requirements.zh-CN.md)、[架构说明](docs/architecture.zh-CN.md)和[功能对等清单](docs/feature-parity.zh-CN.md)。

## 开发

```bash
pnpm install
pnpm check
pnpm dev
```

开发环境需要 Node.js 20、22 或 24 及更高版本，以及 pnpm 11.7.0；该范围与测试运行器声明的引擎支持一致。插件最低 Obsidian app 版本为 1.12.7；开发使用精确固定的 Obsidian API typings 1.12.3，二者用途不同且不要求补丁号相同。

`pnpm check` 会执行源码格式门禁、严格类型检查、完整 Vitest、生产构建和产物契约。`pnpm release:check` 还会运行 UTC/DST 时区测试、1,000 篇快速基准和当前年/下一年节假日覆盖检查：当年缺失、下一年已发布但未补齐或一手来源未核验会阻断；下一年经核验尚未官方发布时警告通过。10,000 篇基准使用 `pnpm bench:large`；生产插件包输出到 `dist/chrono-notes/`。真实最低/当前 Obsidian、真实移动端、Profiler 与 heap 按[测试策略中的人工发布门禁](docs/testing-strategy.zh-CN.md#人工发布门禁)执行。

## English

See [README.md](README.md).
