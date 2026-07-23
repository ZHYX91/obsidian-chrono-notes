---
source_language: zh-CN
translation_status: source
---

# 当前仓库入口

## 恢复现场

1. 先查看当前工作树、`git status`、最近提交和本轮用户请求；未提交改动默认属于用户，不覆盖或回滚。
2. 阅读仓库根目录 `AGENTS.md`，再按任务选择[产品需求](product-requirements.zh-CN.md)、[架构说明](architecture.zh-CN.md)、[UX 规范](ux-spec.zh-CN.md)和[测试策略](testing-strategy.zh-CN.md)。
3. 功能范围以[功能对等清单](feature-parity.zh-CN.md)为准，当前验证与发布缺口见[当前状态](current-progress.zh-CN.md)。
4. 相邻旧项目只读；不得从本仓库修改，也不得恢复旧项目的平行 Manager 或重复 Vault 读取。

## 常用命令

- `pnpm dev`：开发监听构建。
- `pnpm typecheck`：严格 TypeScript 检查。
- `pnpm test`：完整 Vitest。
- `pnpm check`：格式、类型、测试、生产构建和产物契约。
- `pnpm release:check`：自动代码门禁、双时区、快速基准和节假日门禁。
- `pnpm bench:large`：10,000 篇大型确定性基准。
- `pnpm size`：生产构建、预算余量、依赖包和最大输入明细。

## 当前边界

- 日历入口先注册，布局就绪后后台启动 NoteIndex 与首次 ICS 刷新；独立 readiness 协议负责把未知路径标为 indexing，并在 ready 前阻止创建。
- 每个发布候选必须完成完整自动门禁和变更相关的真实宿主回归；最低/当前 Obsidian 完整矩阵、真实移动端、Profiler、长任务和 heap 按测试策略中的风险条件触发，自动测试不能替代已声明的真实证据。
- 年度节假日数据只接受一手来源；不得预测尚未官方发布的安排。
- 修改配对稳定文档时，中英文必须同步更新或明确标记翻译过期。
