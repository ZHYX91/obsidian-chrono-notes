---
source_language: zh-CN
translation_status: source
---

# 当前状态

## 实现状态

- 旧项目功能范围已经在当前实现中闭合，具体能力见[功能对等清单](feature-parity.zh-CN.md)。
- NoteIndex 是 Vault 笔记事实的唯一所有者；任务日期、区间和日历查询使用增量投影与结构共享。
- 月、周、年三种日历视图、五类周期笔记、任务、区间、三语历法/节假日和本地 ICS 均已接入当前数据主干。
- 设置页使用原生 Obsidian API；路径候选共享可释放目录并限制为排名最高的 100 项。
- 月/周区间溢出通过可访问的 `+N` 按钮打开当前周隐藏项，条目保持新标签打开语义。
- 插件先完成 UI 与宿主入口注册，布局就绪后后台启动 NoteIndex 和首次 ICS 刷新；索引 readiness 继续阻止未知路径被误建。
- 周期笔记删除与创建失败回滚使用 Obsidian 回收站接口；英文历法和中国大陆节假日不再残留中文名称。

## 当前自动验证

- `pnpm check` 通过，包括源码格式、严格类型、完整 Vitest、生产构建和产物 smoke/size 契约。
- UTC 与 `America/New_York` 时区测试通过。
- 1,000 与 10,000 篇确定性基准通过；live create/modify 批次保持每终态路径一次读取，快速 32 路批次一次发布。
- 冷月装饰基准保持在十几毫秒量级，不再重复触发同语言的 lunar 全局消息更新。
- production `main.js` 低于 1,000,000 B 门禁；明细输出预算余量、相对基线增量和依赖包聚合，精确大小以当前 `pnpm release:check` 输出为准。
- 年度节假日门禁通过；中国大陆下一年仅在一手来源确认官方安排尚未发布时以带来源警告的 `unavailable` 状态继续。
- 隔离桌面 Vault 已复验英文/简体中文月视图、ICS、日记状态、任务进度与班休标记共存；Android 模拟器已复验月/周/年视图、窄屏英文历法、区间/任务、周期选择器返回行为及无横向溢出。

## 当前发布状态

当前候选产物具备自动发布门禁并完成桌面与 Android 模拟器验收，但不能把模拟器等同于真实设备。仍需补齐：

1. 最低支持 Obsidian 1.12.7 与执行时最新稳定桌面版的完整重载和行为矩阵；
2. 真实移动设备上的安全区、周期 Note Navbar、触摸、横竖屏和软键盘矩阵；
3. 真实宿主 1,000/10,000 篇 Vault 的 Profiler、最长主线程任务和 heap 证据。

完整执行口径见[测试策略](testing-strategy.zh-CN.md#人工发布门禁)。

## 文档入口

- [产品需求](product-requirements.zh-CN.md)
- [架构说明](architecture.zh-CN.md)
- [UX 规范](ux-spec.zh-CN.md)
- [测试策略](testing-strategy.zh-CN.md)
- [功能对等清单](feature-parity.zh-CN.md)
