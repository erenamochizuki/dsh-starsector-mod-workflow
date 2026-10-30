# Moci 工作台索引

本索引为 Moci 适配版入口；上游 gen-index 会覆盖路由，因此在 Moci 绑定下禁用。完整操作规则见 SKILL.md 和 WORKFLOW.md。

## 当前入口

Script/moci.mjs：doctor、compile、build、verify、sync、api-src、api-grep、find-class、javap、logscan、templates、new、preview。运行 help 看简表。

doctor/compile/verify/logscan/new/wrapup/find-class/javap/probe 的原脚本入口也已转接 Moci。req/spec/plan/gen-index 在 Moci 配置下明确拒绝；其他上游维护脚本不属于日常流程，修改 skill/打包迁移时先检查它们的假设。

- 环境与配置：[REF/moci-environment.md](REF/moci-environment.md)
- Moci 核实事实：[FACTS.md](FACTS.md)
- 教程资料库：[REF/moci-tutorial-library.md](REF/moci-tutorial-library.md)，skill 说明不足时优先检索；工具 Script/tutorial.mjs 支持 search/read/status/index
- 教程补充检查：[REF/moci-tutorial-checklist.md](REF/moci-tutorial-checklist.md)，覆盖状态所有权、Intel、文件读写、可选依赖与渲染边界
- 编程性能：[REF/moci-performance.md](REF/moci-performance.md)，用于每帧回调、网格范围查询、数值计算、分配与缓存
- 势力音乐：[REF/moci-faction-music.md](REF/moci-faction-music.md)，用于音乐替换、8 类用途映射、曲库登记与选择性同步
- UI：[REF/ui-routes.md](REF/ui-routes.md)、[REF/ui-dialog.md](REF/ui-dialog.md)、[REF/ui-native-controls.md](REF/ui-native-controls.md)、[REF/ui-input.md](REF/ui-input.md)、[REF/ui-lifecycle.md](REF/ui-lifecycle.md)
- 特效：[REF/fx-layered-render.md](REF/fx-layered-render.md)
- 战役作用域：[REF/campaign-memory-scopes.md](REF/campaign-memory-scopes.md)
- Nex 背景：[REF/nex-background-gating.md](REF/nex-background-gating.md)，需核对本地依赖版本
- JAR 与运行时源码：[REF/janino-and-classloaders.md](REF/janino-and-classloaders.md)，说明 Moci 两种加载方式与验证边界

## 模板与积木

KIT/ 保留 14 类模板：ability、beam-effect、blast-fx、custom-start、dialog-rule、faction、hullmod、industry-colony、intel、monthly-store、screen-layout、screen-native、shipsystem、weapon-effect。

用 moci.mjs templates 查看产物；moci.mjs new 负责改为 Moci 路径与类名前缀。模板 GUIDE/PATCH 中的旧生成命令与 Janino 路径不适用于当前工程；代码语义、数值和接口仍需核对。

LIB/sscore/ 保留纯逻辑与 UI 参考积木；按需要借用，不默认全量复制。API/ 是上游静态索引，成员签名以当前本地源码与 JAR 为准。

## 验证边界

Moci 静态检查不采用旧 R1–R8 的强制架构与审批规则。Maven、静态接线、自动测试、实机验证分别报告。Script/moci-selftest.mjs 在独立临时工程测试发布、回滚、源码定位与生成路径。
