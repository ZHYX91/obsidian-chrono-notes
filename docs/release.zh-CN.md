---
source_language: zh-CN
translation_status: source
---
精确 Vault 单独授权，并保留 `data.json`。
# Chrono Notes — 发布流程

本文定义 Chrono Notes 的可重复发布流程。源码检查、Candidate Bundle、真实 Obsidian 验收、
GitHub 发布与正式 Vault 部署是彼此独立的证据和授权边界。

## 边界

普通 tag push 不触发发布。commit、push、tag、workflow dispatch、GitHub Release 与正式 Vault
部署必须分别授权；任何本地检查都不隐含远端写入。

## 版本与源码

`manifest.json`、`package.json`、`package-lock.json` 与 `versions.json` 必须绑定同一规范
`x.y.z` 版本、最低 Obsidian 版本和精确 commit/tree。发布前运行 `npm run release:check`，并要求
工作树干净；同名版本 tag 只能不存在或已指向该提交。

## Candidate Bundle v3

vendored release-core `2.0.0` 通过薄 adapter 创建唯一 Candidate Bundle v3。Bundle 绑定源码、
构建工具链、core/config/workflow、产品 payload、场景合同及 fixture 哈希，并包含 `main.js`、
`manifest.json`、`styles.css`、`chrono-notes-x.y.z.zip`、`SHA256SUMS` 与
`candidate-bundle.json`。不存在第二份 receipt、envelope 或兼容候选对象。

## 产品验收

必须对同一 Bundle 完成桌面与 Android 模拟器验收，覆盖周期导航、模板创建、时区与节假日
边界、命令以及 imperative tabbed settings。Android 真机和 iOS 不在发布验收范围内；场景
定义与 fixture 由本仓库 `acceptance/product-scenarios.json` 持有。

## 独立工作流

生成并签入的 standalone workflow 只接受显式 `workflow_dispatch`。只读 verify job 在精确
commit 上执行一次独立安装与一次完整 `release:check`，重建并 source-verify Bundle；下游
publish job 下载同一 artifact 后只做 transport verification，不恢复或信任 `dist`。

## 发布与核验

便携 acceptance closure 本身不授权发布；单独 authorization 必须绑定同一 Bundle 与 closure。
首次 mutation 前 workflow 深度校验两份记录、运行 `--verify-tag` 等价的标签门禁并执行只读
preflight。公共 Release 恰好包含前三个 loose assets 与版本 ZIP；`SHA256SUMS` 和
`candidate-bundle.json` 只属于私有 Bundle。发布后必须回读全部托管字节和 provenance。

## 失败、回退与部署

既有同 tag Release 只有在元数据、四个资产字节与 provenance 完全一致时才是零写 no-op；
任何差异都失败，不覆盖或修补既有 Release。需要修复时发布新版本。正式 Vault 部署仍需对
精确 Vault 单独授权，并保留 `data.json`。
