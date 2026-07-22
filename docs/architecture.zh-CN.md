---
source_language: zh-CN
translation_status: source
---

# 架构说明

## 1. 架构目标

新架构优先保证数据只有一个所有者、解析口径一致、外部边界可替换、异步结果不会倒退，以及核心规则可以脱离 Obsidian 测试。

当前插件 ID 为 `chrono-notes`，产物目录为 `dist/chrono-notes/`。相邻旧项目只作为只读需求、算法和回归样例来源，不属于运行时依赖，不接收本仓库修改，也不承担已发布版本兼容；产品范围以当前需求与功能对等清单为准。

## 2. 分层

```text
app            插件生命周期、注册和依赖装配
core           纯领域模型、解析、日期与统计算法
features       用例、控制器、索引和查询快照
adapters       Obsidian Vault/Workspace/DOM 与外部系统
ui             React 日历视图和原生设置 UI
shared         插件内部设置、i18n 和小型公共类型
```

依赖只能朝核心方向：UI 和 adapter 可以依赖 feature/core，core 不得依赖 Obsidian、React 或具体存储。

## 3. 笔记数据主干

```text
Vault create/modify/rename/delete
              ↓
       ObsidianNoteSource
              ↓
           NoteIndex
              ↓
      parseNoteDocument()
              ↓
          ParsedNote
              ↓
      selectors / React hooks
```

`NoteIndex` 是笔记存在性、内容状态、frontmatter、预览、任务和统计的唯一来源。任何视图不得直接读取 Vault，也不得将 `hasNote` 与另一套统计缓存拼接。

### 3.1 数据契约

- `NoteSource` 只暴露 Markdown 相对路径枚举、完整文本读取和归一化事件订阅，不泄露 `TFile` 或 Vault。
- `ParsedNote` 把路径、结构化 frontmatter、解析错误、预览、任务和统计与一次 `parseNoteDocument()` 的结果聚合为递归冻结值，不能为任何派生字段另起读取通道。YAML 根节点必须是 mapping；语法错误、类型错误和别名展开上限作为笔记内解析错误保留，不得误报为 Vault 读取失败。任务只从规范化正文提取，并保留原文件行号与旧项目的 Tasks emoji 日期标记语义。
- 区间笔记解析也是 `ParsedNote` 的派生字段。只有同时存在且符合严格语法的 `start`/`end` 才产生冻结区间：边界必须是完整补零的 ISO 公历日期 `YYYY-MM-DD`，或以该日期开头、至少包含小时和分钟的完整 ISO 日期时间；单独时间、缩减精度的年/月、基本格式日期、序数日期和 ISO 周日期一律拒绝。日期与日期时间均保留原值、是否含时间、规范日期键和稳定排序值，天数按首尾日期包含计算。同日范围有效；缺失、非字符串、无效值或反向范围产生笔记内 `NoteIntervalError`，不建立独立 Manager 缓存，也不把整篇笔记误报为 Vault 读取失败。
- `NoteIndexSnapshot` 使用单调递增版本和冻结的路径记录。`parsed`、`error` 与查询时派生的 `missing` 是互斥状态，旧快照在新事件后仍保持不变。
- `NoteIndex` 在初始扫描前订阅事件，避免启动窗口漏掉文件变化。去重后的初始路径先一次性预留逐路径修订号，再由默认 16 个 worker 受限并发读取；`ObsidianNoteSource` 使用 `Vault.cachedRead()`，但读取结果仍须通过路径修订号与生命周期校验。所有初始结果先进入独立 staging，全部成功或显式失败后才与已经发布的 live entries 原子合并并一次通知；扫描期间的 live 事件立即推进修订号，但普通 create/modify 先进入 microtask 事件归约与读取完成批次，不得夹带尚未越过边界的初始结果。delete 与 rename 仍是即时公开失效屏障：旧路径先从公开快照移除，再排队处理最终路径。生命周期编号阻止 stop 或重新启动前的未完成读取迟到提交，卸载时同时停止订阅并丢弃 staging、pending intent 与 pending commit。若订阅、路径枚举或初始化内部抛错，启动事务必须撤销 active/lifecycle、来源订阅、队列、进行中读取、staging、逐路径修订与投影，使同一实例可以干净重试。

## 4. 并发、身份与缓存契约

- 监听 create、modify、rename、delete。
- 同一路径、同一生命周期和同一修订只允许一个可复用的进行中读取；初始读取并发默认上限为 16。
- 每个路径维护修订号，整个索引维护生命周期编号；计算提交前必须同时验证路径修订与生命周期仍是最新。
- 普通 create/modify 在一个 microtask 内按路径归约为最终 `read` 意图，每个终态路径至多发起一次读取。每个归约批次持有独立 live batch token；受限读槽只覆盖读取与解析，计算完成后立即释放，调用方的 `refresh()` promise 则继续等待权威发布。首个完成项安排一个可取消、可注入的有界 macrotask checkpoint：checkpoint 前全部完成只发布一次；存在慢项时先发布已完成项，剩余项全部稳定后再进行至多一次最终发布。stop/restart 必须取消 checkpoint 并使旧 batch 失效。delete/rename 是例外的即时屏障，必须先使旧路径从公开快照消失，不能等待慢读取或普通批次。
- live read 先生成规范 `ParsedNoteDocument`；若 body、frontmatter 原文、BOM、换行、正文起始行和内容状态均未改变，则复用已发布 entry，跳过 YAML、区间、任务、预览与统计派生，也不增加公开版本或通知订阅者。读取错误恢复和 rename 强制完整解析。
- 读取失败产生显式错误快照，不继续伪装成旧数据。
- NoteIndex 仅在调用方显式注入诊断 sink 时读取时钟并记录路径列举、读取、文档/领域解析、初始/实时提交、快照物化和 listener 通知样本；正常插件装配不启用诊断，也不记录路径或正文。诊断时钟或 sink 写入失败必须 fail-open，只停用该实例后续诊断，不能改变快照、发布、listener 或 refresh 完成语义。8/16/32 确定性矩阵固定算法边界，默认 16 仍须由真实桌面/移动端长任务与 heap 验收复核。
- 设置变化通过依赖标签定向失效，不进行无差别全库重算。
- Markdown 与非 Markdown 之间的扩展名重命名分别归一化为 delete 或 create，避免旧路径残留。
- `NoteIndexSnapshot.taskDates` 与 `NoteIndexSnapshot.intervals` 是 NoteIndex 独占维护的增量、不可变子快照；initial 与 live publication 都把该批最终逐路径贡献一次交给 `replaceBatch()`，任务投影只复制并排序受影响 bucket 一次，区间投影只在整批贡献替换完成后统一排序一次，避免逐文件反复复制。只有对应领域贡献真实变化时才更换自身 revision/identity；无变化批次保留既有 bucket、数组和子快照身份。它们不是独立 Manager，也不拥有第二份 Vault 事实。

## 5. 命令与查询分离

- 查询侧由 NoteIndex 和其他只读索引提供不可变快照。
- 命令侧由用例处理创建、打开、模板、任务改期和区间笔记写入。
- 命令完成后依赖 Vault 事件更新查询状态；必要时可进行受控的乐观更新。

周期笔记命令通过 `PeriodicNoteFilePort`、`PeriodicNoteTemplatePort` 和 `PeriodicNoteWorkspacePort` 隔离外部副作用。每个命令实例按规范目标路径协调正在进行的创建：同路径并发请求只创建和填充一次，等待者返回 `created: false`，但各自保留打开 target，并在共享主文件完成后独立执行其请求的 cascade。失败会传播给等待者并清理协调项以允许重试；主笔记模板失败仍必须删除本次新建文件。级联笔记逐项失败、逐项回滚并继续后续周期；文件已经成功写入后若仅打开视图失败，不得删除用户文件。命令侧不直接写入 `NoteIndex`，查询状态只由 Vault 事件推进。

区间笔记创建由 `IntervalNoteCommands` 负责反向日期归一化、至少两日校验、确定性路径、已有文件打开、确认和最小 Markdown 写入。命令实例按确定性路径协调正在进行的创建，同路径并发请求只写入一次，等待者返回 `created: false` 且仍按各自 target 打开；失败后移除协调项以允许重试。文件端口只负责存在性、父目录和原子创建，工作区复用统一打开端口；成功写入后若打开失败同样不得删除用户内容。日期右键 adapter 只启动输入 Modal，最终仍调用该用例，不能直接操作 Vault。

区间查询直接消费单个 `NoteIndexSnapshot.intervals` 子快照中的稳定排序冻结数组，按区间目录、自定义目录或整个 Vault 过滤；普通非区间笔记不参与扫描。NoteIndex 按路径增量移除/加入区间贡献，并保持开始 epoch、结束 epoch、标题和路径全序；目录匹配必须使用完整路径段。显式时区偏移可能使 epoch 顺序与本地 `dateKey` 顺序相反，因此窗口过滤和泳道分配不得按本地日期提前终止；普通月视图每周的结构共享依赖必须覆盖实际泳道迭代中截至最后一个本周相关项的完整数组前缀。pure feature 布局先在可见时间窗内按包含首尾的日期重叠贪心分配稳定泳道，不重叠区间复用最低可用泳道；路径的确定性哈希映射到固定八色分类索引。普通月 selector 一次覆盖 core 生成的完整 4–6 周边界窗口，使同一区间跨周保留泳道和颜色，再生成列截断、前后延续、泳道上限和隐藏标题；热力月 selector 不访问 `NoteIndexSnapshot.intervals`、不执行区间筛选或泳道分配，并为每周返回冻结空区间布局。周查询继续复用普通区间布局函数。普通月与周 React 共享渲染这些冻结段并通过统一工作区端口打开路径；不得恢复旧 `IntervalNoteManager`、视图私有日期索引或两套条带算法。

区间列表继续消费上述冻结结果，并由纯 feature selector 完成标题/路径不区分大小写搜索、与当前月/年相交的范围筛选和升降序稳定排序。原生 Modal 的 `useSyncExternalStore` 只从 NoteIndex 返回稳定的 `intervals` 子快照，并另行订阅区间扫描范围设置修订号；普通非区间笔记或仅持久化设置变化不会唤醒列表。列表打开和创建仍经统一工作区与命令端口，不维护手动刷新缓存。

模板端口按设置显式选择内置引擎或 Templater。内置引擎只支持文档化的 `date/time/title` 占位符；Templater adapter 在目标文件创建后调用 Templater，并注入冻结的 `tp_calendar` 目标周期上下文。Templater 不可用或执行失败时抛出明确错误，不允许静默回退到内置引擎。

周期日期使用不含时区和时间的 `LocalDate` 领域值。core 统一拥有严格补零的日期键解析/格式化、相等/排序、非法民用日期拒绝和无宿主时区漂移的 UTC 格式化桥；日、周、月、季、年都先归一化到唯一锚点，路径格式化、路径反向识别、导航和模板上下文必须复用这些 canonical helper。`isSamePeriod()` 只比较 `getPeriodAnchor()` 产生的 canonical 锚点，并显式接收周起始规则。独立 `calendar-week` core 以 ISO 周一为周年/周号参考；周日起始只把该周边界向前扩一天，不能改用所选周日自身的 ISO 身份。它统一提供周身份、动态 52/53 周枚举、跨年边界、按周选择和按周年选择；后两者保留相对周首的星期偏移，W53 进入 52 周年份时夹到 W52。Luxon 仅封装在 core 的日期算法与 pattern 兼容实现中，不作为 UI 或 adapter 的数据类型。系统时钟读取隔离在 shared 的本地日期时钟中，以本地年/月/日而非 UTC 日期产生今日值并计算下一个本地午夜。日历 root 通过 `useLocalToday()` 在午夜重新同步，页面从后台恢复可见时再校准一次；呈现层再以该值和 core `isSamePeriod()` 即时派生统一的 `is-current-period`，今日标记和依赖今日的逾期查询随之更新，但不重置用户当前选择或导航上下文。current 状态不进入 month/week/year query、NoteIndex/ICS 快照、任何缓存或设置；周期选择器和迷你日历保留各自独立的状态实现。

## 6. UI 状态

- React reducer 只维护当前日期、选中对象和视图类型等界面状态。
- Vault 派生数据使用外部 store 快照和 `useSyncExternalStore`。
- 设置页使用 Obsidian 原生 Setting API，不强制 React。

共享的 `selectCalendarDay()` 以一个无时区 `LocalDate`、单个 `NoteIndexSnapshot` 和单个 `IcsEventIndexSnapshot` 生成冻结 `CalendarDay`：它在统一周期笔记状态、预览与 `ParsedNote.statistics` 之上，附加历法扩展、地区节假日/调休标记、当日的完整 ICS 事件数组和可选热力指标。月查询先由 core 生成与目标月相交的 4–6 个完整周，再返回按周嵌套的 `weeks[]`；每周包含周起点、周历年/周号、一份 `weeklyNote`、七个 `CalendarDay` 派生日格和按模式决定的区间布局，根查询同时显式保留 NoteIndex 与 ICS 快照版本。普通月模式生成真实区间布局，热力月模式则保留同一递归冻结结构但使用空区间布局，且不读取区间投影。周查询复用同一 `CalendarDay` 生成七日详细模型，不建立月专用 ICS 投影、视图级存在性缓存或重复的任务摘要。完整 ICS 数组始终留在查询模型和无障碍文本中，呈现组件才按容器密度决定可见摘要数。React 只渲染该模型，共享指示器按 `todoAnnotationMode` 处理任务进度，单元格不查询 Vault 或文件。月视图把语义 selection 与日期 roving tab stop 分离：可见所选日优先，其次是可见今日，再回退到本月第一个或首个可用日期；热力模式的隐藏外月格不参与，因而周/月选择或跨查询选择仍始终只留下一个可见日期 tab stop。周号的 ArrowRight 把日粒度选择与焦点一起移到该周第一个可用日期。悬浮/焦点预览延迟后通过 portal 渲染，根据锚点和视口纯计算定位，并在滚动或缩放时重定位；关闭预览设置时不再调度 tooltip，并立即清理待触发 timer、活动 portal 和 ARIA 关联。年度预览只在热力模式且设置开启时启用；关闭设置、切到概览或切换年份都会取消 timer 与活动 portal，渲染门禁阻止旧 tooltip 短暂复现。

周查询在共享七个 `CalendarDay` 之外，从同一 NoteIndex 快照一次附加规范周起止、weekly 状态、日期任务和区间周段。任务只读取 `taskDates.byDate` 的七个目标日期 bucket，不遍历全部 notes；NoteIndex 在单文件提交时按 due/scheduled/start 增量更新贡献，同一任务同一日期合并 date kinds，并以日期、路径和源行稳定排序。逾期仍在查询时只由未完成任务的有效 due date 相对动态 today 计算，scheduled/start 不得单独制造逾期。React 渲染的七日顺序为状态/调休标记、星期、日期、历法扩展、节假日和 ICS。七日概览使用带可访问名称的原生按钮选择组，每个按钮以 `aria-pressed` 表达选中日期；该组件没有 ARIA grid 所需的行结构或 roving focus，因此不得伪装成 `grid/gridcell`。区间甘特在七个日按钮之后以独立的正常流 sibling section 绘制；它不位于日格内部，交互条仍是日按钮之外的独立按钮，既不产生嵌套交互控件，也不复制区间列表。无区间时不渲染空文案，仅在可创建时保留紧凑创建入口；无任务时保留标题与零计数，不再增加第二层空状态段落。只有自身 due 分组中的任务实例可改期：桌面可拖入七日格，任务行同时提供包含本周七天的原生 select 作为键盘与触摸等价入口；两者都调用同一任务命令并等待 Vault 事件，不能在组件中直接写 Vault。

任务勾选和 due 改期由 `TaskCommands` 隔离。pure core 先按 `path + line + 完整任务身份` 在最新原文中重新解析目标行，只局部替换 checkbox 或已有 due 标记，并保留 LF、CRLF、CR 和混合换行；行缺失或身份变化必须拒绝。Obsidian 文件端口使用 `Vault.process` 在一次原子处理内获取最新内容、校验和改写，命令不直接突变 NoteIndex。来源跳转由工作区端口打开 Markdown 并定位、滚动到原始行。

热力图分级是纯 core 规则：字数、链接数和标签数使用正整数设置步长，任务完成率固定每 25% 一级，所有维度统一限制为 0–4 级。共享日 selector 可从同一 `ParsedNote.statistics` 生成冻结的值与等级；缺失、读取错误和未配置路径明确为零值。React 月视图只切换渲染模式，热力图模式隐藏跨月格内容与交互，通过 ARIA 和预览保留维度、原始值和等级，并且不挂载 `MonthIntervalStrip`；普通月模式仍保留完整区间甘特。月与年查询消费同一个持久化 `statisticDisplayDimension` 和步长；工具栏在各自开关开启时渲染同一个维度选择与 0–4 图例结构，月图例复用月格强调色阶，年图例复用年度绿色色阶。周视图不实例化热力工具。

年视图把概览与热力图拆为两个 selector，两者都只接收一个 `NoteIndexSnapshot`。概览只生成四个季度、十二个月的周期笔记状态，不创建 365/366 个每日热力格；热力模式才生成全年每日统计值、预览和错误状态。月/季路径、笔记状态和 `ParsedNote.statistics` 都来自同一快照并冻结在所选结果中，React 不按季度或日期发起额外读取。年度概览按季度分段并复用共享任务指示器，任务 ARIA 不受可见标注模式影响；年度热力图复用 core 的四维度分级。每个月的热力 grid 暴露七个 `row`，每日 `gridcell` 实际归属对应行，同时用显式 grid row/column 保持按列填充的视觉几何；因此方向键按视觉轴移动：Left/Right 为前后七天，Up/Down 为前后一天。已渲染且属于当前显示年的选中日是唯一 roving tab stop；无此选择时只有 1 月 1 日临时回退，跨显示年的旧选择不能让整年失去 tab stop。UI 初始渲染前两个季度，其余季度保留稳定高度占位，并由 `IntersectionObserver` 以相邻季度作为 overscan 逐段唤醒；键盘跨季度移动也显式扩展同一窗口。“本月”动作把选择规范化为当前年的 `{ month, day: 1 }` 月锚点；YearView 挂载目标季度后只处理一次对应滚动，避免后续观察器更新反复抢回滚动位置。

历法扩展由 core `CalendarOverlayProvider` 接受 `LocalDate` 与显示 locale，返回拆分后的结构日期、可选事件、交接类型和完整无障碍文本。feature 层维护显式、冻结、按产品顺序排列的静态注册表；设置与共享日 selector 只使用 provider ID，不运行时扫描模块。`CalendarDay` 按两个有序槽位生成递归冻结的 `calendarOverlays`，与 `holidayRegions` 完全独立，因此月、周可复用同一结果。中国农历 provider 使用 `lunar-typescript` 同步计算月日、闰月、节气与传统节日，结构日期不会被事件覆盖；干支 provider 平日输出日柱，交节日输出新月柱并保留完整年/月/日柱。core 的 caller-owned `LunarDateContext` 封装一次公历到农历的基础转换，农历与干支的 from-context 入口共享它；直接 registry 同时选择两种 overlay 时也只为该日期创建一次 context，不建立模块全局缓存。第三方库的全局语言切换封装在独立 core 适配层中，只围绕单次同步调用切换并在 `finally` 恢复。旧项目按模块长期存活、职责混杂的 LRU/Manager 缓存不迁移；新的 `CalendarDecorationCache` 只缓存与笔记/ICS 无关的冻结装饰，并分为最终组合、单一 overlay provider、单一 holiday-region provider 和按日期的 lunar context 四层 LRU。最终组合 key 包含日期、规范 locale 和两类有序槽位，provider key 只包含日期、规范 locale 与单个 provider ID，context key 只包含日期；因此切换槽位组合可复用 provider 结果和同日基础转换，同时保持选择顺序与对象身份。四层各自使用相同的默认 2048 上限，由单个已挂载日历视图拥有并在卸载时一起清空；`size` 只表示最终组合层。底层 provider 仍可脱离缓存纯测试。

中国大陆节假日由独立 core provider 读取 `lunar-typescript` 的法定放假与补班数据，返回冻结的地区假日、调休标记和显式数据覆盖状态。普通工作日与数据未覆盖年份不得使用同一语义表示；繁体名称在 provider 边界完成映射。共享日 selector 仅在 `holidayRegions` 包含 `cn` 时附加大陆元数据，与 `calendarOverlays` 无关；React 只显示 `CalendarDay` 结果中的 `休/班` 标记、无障碍名称和预览元信息，不直接调用节假日库。

新加坡公共假日由独立 core provider 读取随插件发布的年度快照；2026 数据核对自 [Singapore Ministry of Manpower](https://www.mom.gov.sg/newsroom/press-releases/2025/0616-public-holidays-for-2026)，2027 数据核对自[同部门的 2027 年公告](https://www.mom.gov.sg/newsroom/press-releases/2026/0618-public-holidays-for-2027)，并包含周日假日后的星期一公共假日。provider 返回三语冻结值和显式覆盖状态，不产生中国大陆式补班标记。feature 层用显式静态节假日注册表统一两个 provider，并把三个有序 `holidayRegions` 槽位映射为冻结的名称、调休元数据和语义化 `work / rest / holiday` 标记；补班优先于槽位顺序，普通标记按槽位顺序选择。React 使用当前 translator 把唯一语义标记映射为简体/繁体 `班 / 休 / 公假` 或英文 `Work / Off / PH`，不硬编码 provider、本地地区语言或运行时扫描模块。

外部 ICS 不进入 NoteIndex，也不伪装成 Vault 笔记。core 使用 `ical.js` 解析 RFC 5545 组件、折叠行和转义文本，再由 Luxon 按明确显示时区归一化 UTC、IANA TZID 和浮动时间。全天结束保持排他语义；只有 `DTEND` 与 `DURATION` 同时缺失时才按开始类型补默认结束。显式结束无效、不晚于开始、与开始的全天/定时类型不一致，或 duration 无效、非正、与全天事件不兼容时，整个 `VEVENT` 计入 invalid 并跳过，不能静默修补；同时给出 `DTEND` 与 `DURATION` 也无效。取消事件先于 recurrence 统计排除，因此带 RRULE/RDATE 的 cancelled 事件不计 recurring；其余 recurrence 规则明确计数并跳过。独立 `IcsEventIndex` 从只读来源端口构建冻结日期索引，按来源保留成功或错误状态，只在同一请求修订内复用同来源读取；跨修订的同源刷新立即发起全新读取，并在读取完成、解析开始前再次校验请求修订，从而阻止旧刷新内容覆盖新设置、停用或重新启用状态。索引把状态 `version` 与事件 `contentVersion` 分开：refreshing、refreshedAt 或诊断变化可推进状态而不改变内容身份；ready 结果逐日期做语义比较，未变日期复用原 bucket，全部事件相同时复用整个 `eventsByDate` 且不推进 `contentVersion`。`stop()` 幂等释放订阅与完整事件映射，并使迟到刷新失效；卸载期间不再向 listener 发布空状态。共享 `CalendarDay` selector 以日期键直接引用一个 ICS 索引快照中的完整、稳定排序事件数组，月、周查询只依赖内容身份，不再各自分割或重建事件集合。呈现层才决定折叠：月格在常规密度最多显示三条，窄/粗指针布局可全部收起；周格的宽/中/窄三档分别显示最多三条/一条/零条，并按可见数计算 `+N`。日期格的无障碍名称不受折叠影响，仍保留全部标题、来源和跨日状态。Obsidian adapter 只负责 Vault 文件、桌面绝对路径和桌面 Vault 相对路径读取；Vault 相对来源在文件缓存尚未就绪时必须优先通过 adapter 读取，桌面文件系统模块只可在本地路径分支经 Obsidian 提供的 CommonJS `require` 加载，不得让浏览器动态 `import()` 进入产物。视图与设置不得直接读取本地文件。

Obsidian `ItemView` 只负责 React root 生命周期和插件用例桥接。每个已挂载日历在任一时刻拥有一个 request-bound、view-scoped `CalendarQueryStore`：month/week/year 请求在构造时复制并冻结，渲染阶段的 `getSnapshot()` 不得改写已提交订阅使用的请求；请求变化时构造候选 store，只有 React 提交后才替换并释放旧 store，因此推测渲染不能造成 tearing 或漏通知。store 订阅 NoteIndex 与独立 IcsEventIndex，但只保留该请求的最近输入与输出；普通月与周请求的依赖比较包含可见路径 entry、七日 task buckets、相关 interval 子快照和 ICS 日期 bucket 引用，热力月请求则明确排除 interval 依赖，因此纯区间变化不会唤醒该视图；未受影响的 day/week/month/quarter 继续结构共享。无订阅者时，若 NoteIndex 与 ICS 的快照对象 identity 均未改变，`getSnapshot()` 直接复用当前查询快照，不重新收集依赖；来源通知遇到相同输入 identity 也不求值。`useSyncExternalStore` 只有在当前查询结果 identity 真实变化时才唤醒 React；发布者遍历通知开始时的 listener 快照，使回调中的订阅增删只影响下一次发布。切换视图才计算新活动模型，关闭视图即释放 store，不建立按历史 revision 增长的缓存。设置保存以“上次成功持久化快照 → 本次快照”计算影响，只定向刷新 calendar、Navbar、interval list 或 ICS；区间列表 revision 只在其依赖真实变化时推进，首次引导、确认偏好等持久化字段不会无差别刷新全部视图。

运行时 i18n 位于 shared 层，不依赖 Obsidian 或 React。简体中文目录是类型安全 message key 的权威来源，英文和繁体中文目录都必须以完整 `Record` 在编译期覆盖相同 key；运行时不接受依赖缺失消息回退的 partial catalog。`auto` 根据系统 locale 的中文脚本/地区区分简繁，其他未知语言回退英文。translator 负责参数插值和基于 `Intl.PluralRules` 的计数形式，三套目录还必须保留逐消息相同的占位符集合；日期、月份和数字格式继续交给 `Intl`。组件不得新增分散的 locale 分支或自行维护消息表。

Note Navbar 的 feature selector 只接受文件路径、`intervals` 子快照和周期/区间设置。只有已启用周期规则的完整反向路径匹配才能生成冻结上下文；前后与上级目标复用统一周期锚点，上级目标不仅跳过未启用或空 pattern 的类型，也跳过目标路径无法 `format → parse` 往返的配置，避免呈现不可打开的上级入口。周记/月记相关区间从同一增量区间投影按周期边界相交筛选。Obsidian manager 按 `WorkspaceLeaf` 管理挂载表，以每个周期 `MarkdownView` 公开的 `contentEl` 为稳定锚点，在它前方挂载独立 React root，并监听 active-leaf-change、layout-change、file-open、Vault rename 与定向设置变化；父级 mounted class 与容器在重挂载、叶关闭、设置关闭或文件移出完整周期路径时一并清理，侧边栏获得焦点不会删除仍打开的 Markdown 挂载。Navbar 作为 `flex: 0 0 auto` 的正文外工具条，后续 `view-content` 以可收缩 flex item 保持编辑/阅读区滚动；仅 phone 的 floating-nav/auto-full-screen 模式复用宿主 `--view-header-top-offset + --view-header-height` 把 Navbar 放到固定原生头下方，并归零宿主的外层顶部占位、恢复普通 Markdown 内距与不透明顶部 mask，避免重复 safe-area/header 留白。普通手机、平板和桌面不额外叠加 `env(safe-area-inset-top)`。组件的 `useSyncExternalStore` 只返回稳定 interval 子快照，普通非区间笔记变化不会重渲染 Navbar，也不读取 Vault。呈现层用三列对称 CSS grid 把前后/选日与可选上级周期组成整体居中的导航组，把打开日历保留在末列；窄容器只收起上级文字，不创建第二套 DOM 或命令路径。

日期选择由 pure feature 模型验证 `LocalDate`、月份移动和旧版四种文本格式，并复用 core 的 4–6 周边界月网格。React 迷你日历只维护显示月份、焦点和提交锁；标题行把前月、固定宽度年月入口、后月和今天组成居中操作组，日期 grid 声明六个固定高度数据行轨道，但只渲染模型实际提供的边界周，因此弹窗高度稳定且不会制造完全无关的周。Obsidian Modal 将选中日期回调给主日历导航请求或周期笔记命令；主视图的全局日期跳转仍切换到目标月，Navbar 以同一 Modal 打开当前类型笔记。主周视图不经过该 Modal，而由纯周模型驱动互斥的周历年/周 Popover；选择只更新当前日期、月上下文和日粒度选择，不修改视图类型。命令面板的迷你日历和直接跳转继续复用原链路，不解析路径或读取 Vault。

日期右键菜单先由 feature 层根据配置与 NoteIndex 存在状态生成冻结 action 模型，再由 Obsidian adapter 映射为 `Menu`、剪贴板和 `Notice`。adapter 显式使用 Obsidian 的 HTML 菜单模式（`setUseNativeMenu(false)`），保证当前桌面版中菜单、分组和图标可见。React 只传递日期与快照状态；打开/创建仍调用周期笔记命令，菜单不得直接读写 Vault。

## 7. 设置

设置结构带 `schemaVersion`；当前 schema v15 使用 `confirmPeriodicNoteCreation` 与 `confirmIntervalNoteCreation` 分别表达周期笔记和区间笔记的创建确认，删除共享的 `confirmBeforeCreate`，不把旧值翻译为任一新开关。schema v14 使用 `showNoteIndicators: boolean` 表达可见状态，已删除 `indicatorPosition` 运行时字段和校验器，且不把旧位置值翻译为新开关；schema v10–v13 依次加入季度命名、字体模式/固定因子、任务标注和 Properties 日期接管。`calendarOverlays` 归一化只接受静态注册表中的 ID，保持首次出现顺序、去重并截取最多两项；设置 UI 用两个有序下拉槽位排除另一槽已选项。`holidayRegions` 同样只保留已知静态 provider ID、首次顺序与前三项，设置 UI 使用“地区 1 / 2 / 3”三个中性有序槽位、排除重复并在清空前槽后自动前移。非法枚举回退，因子取整并夹在 `0–20`，布尔字段只接受真实布尔值。加载流程是“读取原始数据 → 按版本迁移 → 校验归一化 → 生成运行时设置”；最终归一化丢弃已删除字段。缺失、非法或早于 v1 的版本按 v1 处理，未来版本只复制原始数据而不由旧迁移器降级。未发布且使用不同插件 ID 的 My Calendar 扁平设置不属于自动迁移输入。保存设置后按字段差异触发定向 effect。

周期路径设置只持久化既有 `pattern` 与 `templatePath`，不引入派生文件夹字段。pure UI helper 先识别未引号包裹的常见 Moment token，再用 core 的 `formatPeriodicNotePath()` 与 `parsePeriodicNotePath()` 生成带具体原因的 `empty / invalid / valid` 冻结预览；除明确的 Obsidian 格式纠错外，设置提示与实际索引识别保持同源。Obsidian 原生输入建议只枚举 Vault 文件夹元数据或 `getMarkdownFiles()` 返回的路径：文件夹选择按规范 Luxon 字面量转义后写回同一 pattern 并保留文件名格式，模板选择写回完整 Markdown 路径。该 UI adapter 不读取文件内容、不解析笔记，也不形成 NoteIndex 之外的笔记状态来源。

日期属性打开日记由 pure ISO 日期输入解析器与 Obsidian 捕获阶段适配器组成。适配器仅在设置开启、日记已配置、主键点击命中 `.metadata-properties` 内日期类型属性的打开图标且输入值有效时阻止原事件，并把日期与默认/新标签目标交给统一周期笔记命令。Properties 中的 Wiki/Markdown 链接、正文链接、非日期属性、非主键、未配置日记和非法日期全部透传。适配器不读取 Vault，也不建立第二份笔记状态。

## 8. CSS

月视图把每个周序号按钮作为独立格渲染，其四角统一使用与日期格相同的 `5px` 圆角；不再保留旧连续周轨道仅左侧圆角、右侧直角的形状。年概览的月/季度状态叠加层固定在 `top: 4px`，在不改变入口格高或标签几何中心的前提下，与标签形成约 `2px` 可见间距。

日历状态由共享 `CalendarNoteIndicator` 呈现，月、周、年消费者只传入规范化的 `showNoteIndicators` 和 `none / color / hole` 任务标注。关闭显示时组件不挂载；`none` 回退到笔记状态符号；未完成任务的 `color` 使用警示色实轨，`hole` 使用警示色空心轨道；全部完成统一使用成功色。任务完成比例由同一组件一次夹取并写入横向 fill 宽度；完成数/总数保留在数据属性与上层 ARIA，不恢复格内分数文本。月日格标题保持两层结构：顶部 accessory grid 左侧放状态/进度、右侧放唯一地区标记，下一行日期号占满宽度并居中。周序号与年概览的月/季度入口则把状态放在顶部绝对叠加层，标签始终相对整个按钮居中；周记或相应月/季笔记未配置、进入热力图或关闭状态显示时，叠加层不挂载，也不保留空状态行。其余日格内容进入纵向文档流，顺序固定为历法扩展、按地区分组的节假日名称、ICS。日格只保留一个紧凑的通用基础最小高度；节假日名称与 ICS 均使用内容驱动的自动行，不存在时不预留专属空块，有更多可见内容时只让所属周统一自然增高。单个历法扩展使用居中的单列，两个扩展在常规宽度使用等宽双列，在日历容器约 `460px` 以下改为单列堆叠；选择数量不改变字号。月网格在周索引与日期之间使用显式 spacer 列；每个周块横跨外层月网格、建立同列 subgrid，并定义日期内容轨与区间轨。普通月模式下，周序号、spacer 和七个日期按钮的背景与边框跨越两轨，日期按钮内部内容只占第一轨；区间甘特在第二轨正常参与布局，位于日期内容中的 ICS 之后、日期按钮下边框之前。其容器与日按钮所在行是 sibling，交互条仍为日按钮之外的独立按钮，绝不能嵌套。没有区间时甘特不挂载，第二轨折叠为 `0`；一个或多个泳道只撑高所属周块，其他周保持各自高度。热力月模式不挂载 `MonthIntervalStrip`、区间按钮或 `+N` 行，日期内容跨越该周块的可用轨道并保持居中。实现不得使用绝对 overlay、估算的日期格底部留白或平行高度函数来模拟区间空间。每个普通月可见泳道仍是独立且互不重叠的交互按钮行，细视觉线由行内伪元素垂直居中绘制；可选 `+N` 行、行间距与底部呼吸空间均由正常流自然计入周块高度。精细指针使用更紧凑的泳道节奏，粗指针则保留更大的可操作行，且不增加彼此重叠的透明命中层。月区间线把稳定分类色向主题前景色校正。

普通月 strip 通过 `subgrid` 直接继承七个日期列及常规 `6px`、`≤360px` 时 `4px` 的列间距；周甘特也与七日概览使用同一组 `6px / 4px` 间距，因此所有支持密度下的区间条都与日期列精确对齐。月甘特渲染器必须先显式生成完整的 `visibleLaneCount` 行轨，再追加可选的溢出轨；这样某个裁剪周即使只有较低泳道的延续段，也不会把该段坍缩到第一条视觉泳道。

主日历日期与周期控件统一使用 `is-current-period`，current、selected 与键盘 focus 是彼此正交的呈现状态。月日格、周日格、周序号、年视图月/季度入口和年热力日格的 current 都由不参与布局与命中的伪元素绘制贴格子内缘的 `1px` 中性内边框；默认框色由 `text-normal` 与透明色混合，月/年热力等级 3–4 改用基于 `text-on-accent` 的高对比框色。current 不改变控件背景、文字颜色、字重或装饰。selected 由另一不参与布局与命中的层绘制位于格子边界之外的 `2px` 强调色外框，键盘 focus 再位于 selected 外侧作为独立最外层；三态可同时存在而不互相覆盖语义。格间 gap 为外框保留真实空间，外框不得以 inset、内描边或缩进伪装。插件作用域为 calendar、Navbar 与区间列表内的原生 button/select 统一补上可见 `:focus-visible` 外框，日格则继续使用自己的最外层伪元素焦点环，避免宿主主题清除 box-shadow 后焦点消失或出现双环。普通月日格的这些透明命中框线伪元素使用高于区间 strip 的专用绘制层，而日按钮本身不建立隔离堆叠上下文、也不整体抬到 strip 之上；因此框线保持连续，又不会抢走区间按钮的命中。月区间预览/端点和周任务 drop target 等临时态取得视觉优先级并抑制 current 内边框，selected 与 focus 框线仍保持独立。精确日控件输出 `aria-current="date"`，周/月/季周期控件输出 `aria-current="true"`；选择语义仍由对应的 `aria-selected` 或 `aria-pressed` 独立表达。主月网格、周七日概览和年概览在常规宽度使用 `6px` 单元间距，在 `≤360px` 时统一收紧为 `4px`；普通月日格内部内容使用 `3px` 间距，周日格详细内容使用 `2px` 间距和 `1px` 顶部留白，年热力小格常规使用 `4px` 间距、`≤360px` 时使用 `3px`。热力月日格让主内容跨越周块可用轨道，以零内部间距在水平与垂直方向居中日期号，因此缺少区间条时不会留下偏移或空轨。该主网格规则不直接复用于周期选择器或迷你日历。周期选择器在自身作用域内以 `.is-current` 的强调文字色和 `aria-current` 表达 current，不渲染圆点；`.is-selected` 只绘制 `2px` 内描边并配合 `aria-pressed`，不设置选择文字色或背景；`:focus-visible` 使用独立外描边，current 与 selected 可叠加。月份的 current 由本年与所浏览年份共同约束，周号的 current 由当前 ISO 周年与所浏览周年共同约束。迷你日历保留独立实现。跨月普通格只弱化内部内容与静态底色，交互状态不继承该透明度。

季度名称由 pure UI formatter 从归一化 `quarterNameMode` 和 translator 生成；数字模式复用运行时语言目录，中文模式固定映射 `1–4 → 春/夏/秋/冬`。年视图概览、年热力图季度标题和月选择器共享该 formatter，路径、周期锚点和 Note Navbar 标签不受外观设置影响。

日历根节点持有 header/normal/small/micro 四级字体变量。`follow-obsidian` 直接引用 Obsidian UI token；`follow-widget` 仅通过 `≤360 px`、中间和 `≥720 px` container query 三档切换，避免连续视口缩放；`immutable` 由 pure helper 把规范化 `0–20` 因子映射为固定像素变量。周视图额外用三档容器密度渲染同一 DOM：宽档显示完整星期和最多三条 ICS，中档显示短星期和一条 ICS，窄档使用最窄星期/日期并收起详细内容；状态/调休、选择、今日和完整 ARIA 语义在三档中不丢失。周选择弹层自身建立 inline-size container：默认三列，在小于 `360px` 时只切为两列，不缩小字体或删除范围；键盘列数由同一阈值的 `ResizeObserver` 结果驱动。弹层只为 52/53 个周项创建一次本地格式器与冻结展示项，并用受限高度滚动，不进入 NoteIndex 或日历查询缓存。

源样式按 feature 拆分，生产构建合并为一个 `styles.css`。所有选择器以 `chrono-notes-` 或插件根节点为作用域，避免污染其他插件；状态规则必须绑定具体日历控件类，不得新增无插件作用域的全局 `.is-current-period` 或 `.is-selected` 选择器。

## 9. 复用旧项目的规则

旧项目只提供需求、算法和回归样例。可以迁移纯日期算法、节假日数据和经过验证的解析器，但不得照搬分散 Manager 缓存、旧 CSS 结构或重复文件读取路径。

## 10. 性能与就绪边界

`lunar-typescript` 的语言作用域只包围同步调用。目标语言与当前语言相同时不得触发库的全量消息更新；操作内部即使改写全局语言或抛错，`finally` 仍须按需恢复进入作用域前的语言，且作用域绝不跨越 `await`。

设置页显示期间由一个可释放的共享路径目录持有按路径预排序的文件夹与 Markdown 文件元数据。Vault create/delete/rename 只标记目录失效，下次查询再重建；modify 不触发。空查询直接截取候选上限，模糊查询扫描全部候选以保持 Obsidian 排名，但只用有界 top-K 结构选择实际建议，不对全部命中排序。隐藏设置页时注销 Vault 监听并清空目录。

正常日历查询仍以完整初始 NoteIndex 就绪为前提，因为空快照的 `missing` 语义不能表达“尚未索引”。任何渐进启动改造都必须先引入独立、稳定、可订阅的 readiness 状态，并在 ready 前阻止会把未知状态当成不存在的普通选择器与创建命令；只取消插件启动中的 `await` 不构成安全优化。
