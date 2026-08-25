---
source_language: zh-CN
translation_status: source
---

# 发布流程

## 1. 目的与边界

本流程定义 Chrono Notes 稳定版本的候选、预检、发布、托管产物核验与恢复边界。它是维护者操作契约，不表示任何版本已经发布，也不授权在普通或生产 Vault 中部署。

发布使用数字稳定版本 `x.y.z`。源代码检查、候选产物、GitHub 托管产物、Obsidian 宿主验收和生产 Vault 部署是相互独立的证据层；前一层通过不能替代后一层。

## 2. 版本一致性

发布前必须选择一个新的精确版本 `x.y.z`，并保证下列位置完全一致：

- `manifest.json` 的 `version`；
- `package.json` 的 `version`；
- `versions.json` 中该版本对应的最低 Obsidian 版本；
- 待创建的数字 Git 标签；
- `dist/manifest.json`；
- 手工安装归档名 `chrono-notes-x.y.z.zip`。

`.node-version` 与 `package.json` 固定 Node.js 版本，`package.json` 固定 npm 版本。不得用不同版本运行发布门禁。`CHANGELOG.md` 中没有对应本地标签的版本只能保留在 `Unreleased`；源清单已经前移不等于该版本已经发布。

运行 `node scripts/check-release-version.mjs "x.y.z"` 验证版本契约；省略参数时检查 `manifest.json` 中的版本。检查器会核验 manifest、package、package-lock.json 与 `versions.json`。本地同版本标签不存在时允许继续；若已存在，则必须精确解析到 `HEAD`，因此 `npm run release:check` 不会放行复用其他提交上的标签。版本必须严格高于既有已发布版本；远端同名标签必须不存在。预检还必须确认候选提交是当前远端默认分支 HEAD，且上一项已发布 Release 是候选提交的祖先。

## 3. 精确候选

候选只能由一个已确定的提交和一次 workflow attempt 生成。准备阶段使用冻结依赖安装并运行完整发布门禁：

```sh
npm ci
npm run release:check
node scripts/release-assets.mjs archive --version "x.y.z"
```

标准候选恰好包含 `main.js`、`manifest.json`、`styles.css` 和 `chrono-notes-x.y.z.zip`。归档内部只包含前三项可安装资产，并且其字节必须与 loose assets 相同。准备阶段为四项资产生成 `SHA256SUMS`，并把候选 artifact 的 ID、名称、服务端 digest、workflow run、attempt 与 release commit 绑定；发布阶段不得重新构建或混用另一轮产物。

若同标签 immutable Release 已存在，只有在标签提交、四项附件名称和字节、provenance 全部精确一致时才接受 no-op。任何差异都必须改用新版本，不能覆盖既有稳定 Release。

## 4. 只读预检

创建标签前，从远端默认分支的精确候选提交手工触发 Release workflow 的 `workflow_dispatch`，输入计划版本。预检只读并必须完成：

1. 版本、运行时和冻结 lockfile 契约；
2. `npm run release:check` 全部门禁；
3. 确定性手工安装归档；
4. workflow event、checkout、远端默认分支 HEAD 三者提交一致；
5. 远端没有同名标签；
6. 已发布版本序列与 release notes 基线合法。

保存 workflow run URL、run ID/attempt、候选提交 SHA、版本和完整门禁结果。只读预检通过后仍未产生标签或 Release。

## 5. 发布

只有预检证据经过复核后，维护者才可在同一精确提交创建并推送数字版本标签。标签 push 触发 Release workflow：verify job 在只读权限下重建、验证并上传精确候选；仅当同标签 Release 明确不存在时，publish job 才获得写权限。

publish job 必须重新验证远端标签解析到准备阶段提交，下载同一 workflow attempt 的候选，验证 artifact 元数据、服务端 digest、安全路径、文件集合、`SHA256SUMS`、归档内容和候选 manifest 版本，然后为四项资产生成 provenance attestation。最后创建非 draft、非 prerelease 的 immutable GitHub Release。

不要手工替换附件、移动标签或重跑一次不同构建来“修复”已经发布的同一版本。发布失败时先保留证据并判断写边界是否已经跨越。

## 6. 托管字节与哈希核对

发布后不能只检查 workflow 绿色状态。必须从 GitHub Release 重新查询和下载托管对象，并核对：

- Release 为 immutable、非 draft、非 prerelease；
- 附件集合恰好为 `main.js`、`manifest.json`、`styles.css`、`chrono-notes-x.y.z.zip`，没有缺失或重复；
- 每项托管附件与准备阶段候选逐字节相同，保存 SHA-256；
- 每项 attestation 绑定本仓库 Release workflow、数字标签 ref 和精确 release commit；
- 远端标签在发布后仍解析到同一 release commit；
- ZIP 中三个安装资产与对应 loose assets 逐字节相同。

托管核验完成前只能称为“发布写入已尝试”或“workflow 已完成”，不能称为已验证发布。

## 7. 回滚与恢复

稳定标签和 immutable Release 不允许覆盖、移动或删除来回滚。发现缺陷后：

1. 停止进一步部署，保留失败 workflow、候选哈希、托管对象和宿主证据；
2. 判断标签、Release、attestation 与附件中哪些已经公开；
3. 在默认分支修复并通过完整门禁；
4. 使用严格递增的新版本执行全新预检和发布；
5. 在 release notes 或安全公告中说明受影响版本与替代版本。

生产 Vault 回滚是另一项明确授权的操作。执行前记录当前安装资产并备份，替换时只处理 `main.js`、`manifest.json` 和 `styles.css`，保留插件 `data.json`，复制后重新计算安装字节哈希。GitHub Release 的恢复证据不能代替 Vault 数据保护和宿主重启验收。

## 8. 证据分层

每次发布记录至少区分以下状态：

- **源码证据**：提交 SHA、工作树状态、版本文件、`npm run release:check` 输出；
- **候选证据**：workflow run/attempt、artifact ID 与 digest、四项 SHA-256、归档内部一致性；
- **发布证据**：标签解析、Release 状态、托管附件集合、下载后字节与 attestation；
- **宿主证据**：隔离 Vault 中的安装、启动和关键行为；
- **生产部署证据**：经授权 Vault 的部署前备份、`data.json` 保留、安装后哈希和重启验收；
- **人工/设备证据**：桌面、模拟器或物理设备上的明确验收结果。

报告中必须列出未执行或未验证的层级。不得用本地测试、构建成功、截图或版本显示替代托管字节、真实宿主或生产部署证据。
