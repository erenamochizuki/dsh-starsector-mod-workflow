---
name: starsector-mod-workflow
description: Develop, debug, and validate Moci Starsector Java features, UI, effects, campaign systems, and mod data using its existing Maven/JAR and loose runtime Java sources. Use the Moci profile for API lookup, compilation, packaging, and selective deployment. Combine with specialized Starsector skills for hull/weapon configuration or rules.csv dialogs.
---

# Starsector 工作台 · Moci 适配版

沿用当前 Moci 工程。先读工程根的 WORKSPACE.md 和本次涉及的代码/数据；路径与发布规则见 [REF/moci-environment.md](REF/moci-environment.md)。工程实际文件与用户要求优先于上游模板中的假设。

## 分工

- 通用 Java、UI、特效、战役系统、构建与排错：使用本 skill。
- 新机体、.ship/.wpn、部件帧、变形、槽位同步：同时读 starsector-moci-shipbuilding。
- rules.csv 对话、任务选项、触发器与 Java rulecmd：同时读 starsector-rules-writing。
- 三个 skill 互补；本 skill 不接管专项规则，也不把其他参考 mod 当成 Moci 主项目。

## 工程约定

- Moci 同时使用 src/Maven/JAR 和 mod 目录中的运行时 Java 源码。新增复杂 Java 默认进入 src/；修改已有脚本时保留其原位置，例如 MociShipPack/data/hullmods/ 和 data/shipsystems/scripts/，不得为迎合 Maven 擅自搬移或删除。
- src/ 使用绑定的 JDK 17 和 Maven；mod 中散放的 Java 由游戏运行时加载。原版也有 starsector-core/data/ 下的源码。按实际 package 和顶层类声明识别类，不能只搜 src、JAR 或 data/scripts，也不能只从文件名推断类名。
- 中文发布包为默认目标；英文包与扩展 mod 只有用户明确要求时才处理。其他参考源码、lib、lib97 不随任务整理或改写。
- 优先修改工程 MociShipPack 中的发布版本；配置、音频、贴图与散放 Java 不直接改游戏副本。src/ Java 仍在 src 修改，构建后更新 MociShipPack/jars/MociShipPack.jar。游戏目录只是可选部署目标。
- 本地 API 查询优先使用 starfarer.api/ 与游戏 API 源码包；依赖签名以 pom.xml 的实际依赖为准。遇到接口不确定时先核对源码或 javap。
- 保留项目现有显式开关。不得用 Global.getSettings().isDevMode() 或 ENABLE_DEBUG_LOGS || devMode 控制关键逻辑、关键日志或排查可见性。

## 编程性能约定

涉及 advance/render、武器/船插/AI、多实体范围检测时，先读 [REF/moci-performance.md](REF/moci-performance.md)，并核对工程 src/data/scripts/util/Moci_Util.java 的现有实现。

- 优先减少查询对象数和调用频率。局部范围检测优先复用 Moci_Util 的适用 Grid 查询；大范围查询比较网格与列表遍历，不假定网格总更快。命中/开火事件优先用对应回调。
- 只判断范围或比较远近时用平方距离；需要真实距离、归一化或原有衰减公式时才开方。同一非零除数在循环中重复使用时可预计算倒数，保留精度与整数语义，不机械替换除法。
- 非即时逻辑可按经过时间分时更新并错开实例；碰撞、拦截等不能因降频漏判。粒子按时间累计，避免随帧率增加负担。
- 热路径减少临时向量、列表和重复查询；缓存按实体/战斗生命周期管理，处理失效和清理；日志按事件或限频输出。
- 优化保留原有目标类型、阵营、存活、碰撞边界和生效时序。复用工具不等于工具已经最优；用实际场景判断收益，未测量时不宣称提速比例。

## 数值边界与引擎卡死

战斗中的“未响应”先按主线程被异常数值拖入超长/无限循环来排查，不要只按性能不足处理。跨 mod 的物理属性可以改变引擎内部循环的工作量：例如质量或转动惯量被写成极小但非零的值时，`力 / 质量`、`力矩 / 惯量` 会得到极大的角加速度；继续传入朝向归一化、转速或位置 API 后，可能触发引擎内部的重复减法循环。已知风险形态包括 `while (angle > 周期) angle -= 周期` 一类没有迭代上限的归一化；本地 0.98 反编译的 `Ship.setFacing` 使用的是 `> 360`/`-= 360`，其他版本或调用点可能是 180 等不同周期，不能把常数差异当成安全性证明。传入 `Infinity` 时条件甚至不会变假。

- 读取外部 mod 或数据提供的质量、惯量、力、力矩、速度、转速和角度时，先检查 `Float.isFinite`、符号和合理下限；“不等于 0”不等于安全。除法、乘法、归一化和单位向量计算后再次检查有限性与幅度，异常值应跳过本次物理操作并限频记录对象、武器/弹体 ID、来源 mod 和原始数值。
- 调用 `setFacing`、`setTurnRate`、角速度/施力/位置等引擎入口前，必须保证参数是有限值且已压到合理范围。角度归一化优先用 `% 360`/等价的常数时间实现并处理 `NaN`/无穷；不要为处理任意大角度写无上限的 `while`。确需循环时加明确的迭代上限和异常降级。
- 静态检查重点搜索 `mass`/`inertia` 除法、`torque`/`force` 合成、`setFacing` 前的角度计算，以及 `while (angle...`、`while (value...` 的重复加减。对 `0`、极小正数、负数、`Float.MAX_VALUE`、`Infinity` 和 `NaN` 做针对性测试；组合 mod 时至少保留一个会提供异常边界值的场景。
- 游戏无响应且没有异常日志时，优先抓取复现期间的 JFR 或 JVM 线程栈，确认游戏线程是否长期停在同一个归一化/数学调用；日志缺失不能证明没有异常。记录复现时的对象 ID、属性值、来源 mod 和栈顶方法，再用禁用 mod 的二分法缩小责任范围。机器性能不同只会改变“多久卡住”，不能作为数值安全的证据。

## 实施与验证

根据复杂度选择流程，详见 [WORKFLOW.md](WORKFLOW.md)。小修直接处理；复杂系统按需在 docs/ 写设计与验收。用户已授权的工作持续推进，不强制创建 REQ/SPEC/BUILD、审批哈希或每项一条单元测试。缺失信息确实影响实现时再询问。

Moci 的工具入口是本 skill 目录下的 Script/moci.mjs；从工程目录运行时使用脚本的绝对路径。先用 doctor 核对环境；未改 src/ 的任务通常不必重新打包。

| 命令 | 用途 |
|---|---|
| node Script/moci.mjs doctor | 核对工程、JDK、Maven、依赖与发布目标 |
| node Script/moci.mjs compile | 仅 Maven 编译，用于中途验证 |
| node Script/moci.mjs build | Maven clean package，然后只更新 MociShipPack 的工作区 JAR |
| node Script/moci.mjs build --dry-run | 查看将使用的路径和发布目标，不写文件 |
| node Script/moci.mjs build --no-deploy | 按本次要求仅打包到 target |
| node Script/moci.mjs verify --file <工程相对路径> | 核对指定数据文件的类引用与受支持的 CSV 结构 |
| node Script/moci.mjs sync --file <工程相对路径> [--file ...] | 生成拟同步游戏的清单；在任务收尾统一确认是否执行 |
| node Script/moci.mjs build/sync ... --game-approved | 仅在任务收尾得到用户明确“是”后使用；不是自行授权的开关 |
| node Script/moci.mjs api-src <类名> | 查本地 API 源码；另有 api-grep、find-class、javap |
| node Script/moci.mjs logscan | 把游戏日志中的栈帧定位到工程、mod 或原版的实际源码 |
| node Script/moci.mjs templates | 查看可借用的代码模板 |
| node Script/moci.mjs new <模板> --id <id> | 预览按 Moci 路径生成的骨架；实现任务需要时加 --write |

src/ Java 修改完成后默认执行 build，更新工作区 JAR。2026-10-24 用户已将发布偏好改为“工作区优先，游戏同步在收尾统一询问”，此前默认自动同步游戏的授权不再沿用。任何游戏目录写入，包括 JAR、配置、音频、贴图和运行时源码，都先完成本次任务的全部修改、验证、构建和同步清单整理；期间不要因为单个步骤或中间产物单独询问。到收尾时必须调用 Codex 的交互式提问工具发送一个只有“是”“否”两个选项的问题，不得只在普通最终文字里写问题。优先使用当前模式可用的阻塞式 `functions.request_user_input`；如果当前模式只提供 `functions.request_user_input_async`，调用后不要立即发送最终回复或结束回合：保持问题挂起并等待用户答复，必要时用不超过 60 秒的 `clock.sleep` 分段等待，新消息到达后再继续。异步工具返回 `accepted`、排队或工具调用成功状态都不代表用户选择；只有用户明确回复“是”才可传 `--game-approved` 执行，收到“否”、工具未显示、工具状态不明或尚未收到答复时都保留工作区结果，不写入游戏目录。新增范围重新核对，不能以用户要求修改 mod 或历史自动同步偏好代替这次最终选择。

修改 mod 中已有的运行时 Java，先改 MociShipPack 中的文件，按需结合适用的运行时编译检查验证；如需写入游戏实测，放到任务收尾时与其他游戏目录写入合并为一次最终选择。Maven compile/build 不编译这部分源码；verify 找到类声明也不代表运行时编译成功。两种源码都改时分别准备工作区 JAR 与本次源码清单。细节见 [REF/janino-and-classloaders.md](REF/janino-and-classloaders.md)。

任务开始时识别已有未提交改动；拟同步只使用本次明确修改且获确认的资源清单，不把其他未完成改动一起发布。确认后仍核对 mod ID、游戏运行状态，备份并校验哈希；保留游戏目录其他文件，不执行整包镜像或删除。游戏运行或目标不匹配时停止游戏同步，保留工作区结果并说明。不要把同步 JAR 说成已发布所有资源。

verify 在 src、主 mod 的 data/com 目录、绑定游戏原版 data 目录和 Maven 依赖中核对类引用，是有限的静态检查，不包含 Java 语法编译、行为测试、游戏实测，也不推断类加载优先级。根据本次改动运行相关已有测试；收尾说明实际验证范围和待实机验收的步骤。

## 收尾文件清单

凡本次实际新增、修改、替换、重命名或删除文件，无论是 mod 内容还是 skill 本身，最终回复末尾都附“本次文件变更”清单，方便用户逐项核对。

- 每项写明变更类型、文件路径及简短用途；现存文件使用绝对路径的可点击链接，重命名列旧路径与新路径，已删除文件列原路径。
- 根据本次实际操作列出文件，不把任务开始前已有的无关修改混入。清单较长时按源码、配置、音频/贴图等分组，仍保留逐文件路径。
- JAR 构建产物与游戏部署副本说明发布状态和目标目录；同路径结构的同步副本可与工作区文件关联说明，避免重复长清单。未同步、部分完成或失败要明确标出，不能把计划当成完成。
- 自动备份、临时文件与缓存可合并给出目录或发布收据；用户需要核对的正式文件以及本次更新的 skill 文档/元数据逐项列出。没有文件变更时，无需虚构清单。

## 教程资料库检索

本 skill 及相关参考不足以解决问题、缺少接线例子或机制不明确时，优先搜索[本地教程资料库](REF/moci-tutorial-library.md)，再扩大到其他资料。入口是通用 skill 的 Script/tutorial.mjs，支持中文主题、API／类名与章节定位。找到后读取原文和配套示例，并用当前本地 API／实际文件核实；用户指定其他来源时按用户要求处理。

已知 API／字段名时可用 search --exact；搜索返回片段后，用 read <chunkId> 读取完整内容，必要时加 --context 查看父级前提。结果保留原文行号、来源哈希、教程版本声明与提交；检索不代表本地 API 已验证，不能仅凭预览写代码。

## 教程与补充检查

涉及新主题或检查生命周期、数值合成、存档、可选依赖时，按需读 [REF/moci-tutorial-checklist.md](REF/moci-tutorial-checklist.md)。教程提供主题与检查项，具体 API 和加载语义仍以绑定游戏及实际项目为准。

## 资产与旧工具

工具与素材索引见 [INDEX.md](INDEX.md)。UI 工作按需读 REF/ui-*.md；特效工作读 REF/fx-layered-render.md。KIT 与 LIB 是可改写的参考：优先复用 Moci 的现有实现，不强制引入 sscore、固定模板或重写已有架构。

势力音乐的新增、替换、敌对交互与战斗分配，先读 [REF/moci-faction-music.md](REF/moci-faction-music.md)，同时核对 faction、sounds.json 和音频文件；敌对遭遇与进入战斗是独立的音乐用途。

原版 req/spec/plan 的审批流水线不用于 Moci；原版 new/compile/verify/logscan/doctor/wrapup 等入口在 Moci 绑定下会转接或明确拒绝不支持的操作。不要绕开配置运行旧入口以满足上游闸门。包里的旧环境与 Janino 经验不得直接当作 Moci 实测结论。
