---
source_language: zh-CN
translation_status: source
---
精确 Vault 单独授权，并保留 `data.json`。
# Chrono Notes — 发布流程

本文定义 Chrono Notes 的可重复发布流程。源码检查、Candidate Bundle、真实 Obsidian 验收、
GitHub 发布与正式 Vault 部署是彼此独立的证据和授权边界。

## 边界

获授权的稳定版本 tag push 触发发布。也可在同一 tag 上手动派发，选择只验证或发布，两种入口共用工作流。宿主验收可选；发布不会部署到 Vault。

## 版本与源码

`manifest.json`、`package.json`、`package-lock.json` 与 `versions.json` 必须绑定同一规范
`x.y.z` 版本、最低 Obsidian 版本和精确 commit/tree。发布前运行 `npm run release:check`，并要求
工作树干净；同名版本 tag 只能不存在或已指向该提交。

## Candidate Bundle v3

vendored release-core `3.0.1` 通过薄 adapter 创建唯一 Candidate Bundle v3。Bundle 绑定源码、
构建工具链、core/config/workflow、产品 payload、场景合同及 fixture 哈希，并包含 `main.js`、
`manifest.json`、`styles.css`、`chrono-notes-x.y.z.zip`、`SHA256SUMS` 与
`candidate-bundle.json`。不存在第二份 receipt、envelope 或兼容候选对象。

## 可选产品验收

可对同一 Bundle 开展桌面与 Android 模拟器验收，覆盖周期导航、模板创建、时区与节假日
边界、命令以及 imperative tabbed settings。Android 真机和 iOS 不在发布验收范围内；场景
定义与 fixture 由本仓库 `acceptance/product-scenarios.json` 持有。

## 独立工作流

tag push 与手动派发共用构建、发布和发布后验证任务。只读构建任务生成并验证 Bundle；发布任务下载同一固定资产，不重复构建，在写入前验证事件、tag、提交和 Bundle 摘要。手动 verify 模式不执行发布。

## 发布与核验

Actions 为四个公开资产生成 SLSA 构建证明。发布器核对其源码、tag 和工作流，创建草稿，下载并检查全部草稿资产，然后正式发布 immutable Release。独立任务再检查已发布资产。公开附件仅为三个松散文件和版本 ZIP；Bundle 元数据保留在 CI artifact 中。GitHub 发布结果与 Community Directory 审核结果分别记录。

## 失败、回退与部署

既有同 tag Release 只有在元数据、四个资产字节与 provenance 完全一致时才是零写 no-op；
任何差异都失败，不覆盖或修补既有 Release。需要修复时发布新版本。正式 Vault 部署仍需对
精确 Vault 单独授权，并保留 `data.json`。
