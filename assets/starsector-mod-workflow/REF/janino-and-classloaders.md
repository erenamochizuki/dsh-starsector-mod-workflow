# Moci 的 JAR 与运行时 Java 源码

Moci 混用两种交付方式。源码在什么目录，决定应执行什么检查和发布；不要为了统一工具链搬移已有脚本。

| 源码来源 | 当前检查与发布方式 |
|---|---|
| 工程 src/ | JDK 17 + Maven 编译，build 默认更新工作区 JAR；游戏同步先询问 |
| MociShipPack/data/ 下的运行时 Java | 先修改原路径文件，sync --file 查看计划；确认后才向游戏同步，运行时编译/加载另行验证 |
| 绑定游戏 starsector-core/data/ 下的原版 Java | 用于查询原版实现与核对配置引用；不随 Moci 任务发布 |

Moci 实际例子包括 data/hullmods/Moci_weapon_overload.java、data/shipsystems/scripts/Moci_Fastturndrive.java，以及原版 data/shipsystems/scripts/AmmoFeedStats.java。运行时源码不局限于 data/scripts/。

## 类引用与编译是不同的检查

find-class、verify、logscan 会查 src、主 mod 的 data/com 目录、原版 data 目录，并按实际 package 与顶层类声明建立索引。文件名大小写不能替代类声明，例如 Moci_Easytobreak.java 声明的是 Moci_EasyToBreak。

verify 找到对应声明只证明有源码来源，不证明该源码的语法、依赖或游戏加载正确。Maven compile/build 也不会编译 mod 目录中的散放源码。修改这部分源码时，先核对当前游戏的编译器与依赖，再选择适用检查；若只做静态检查，必须明确尚未验证运行时编译。不要套用上游声称的 Janino 版本、命令或“E=0”交付判据。

## 同名来源与排查

同名类可能来自源码或多个 JAR。查到文件不说明游戏实际选中了哪一份；当前工具也不推断加载优先级。行为与改动不符时，先核对配置引用、部署后的源码/JAR 和依赖，不直接删除类或强行迁移源码。

find-class 可帮助定位源码与 Maven 依赖中的类；javap 只查看已有字节码的签名，无法反汇编尚未运行时编译的源码，也不能证明游戏加载了哪个版本。需要核对主 mod 自带 JAR 或其他未纳入 Maven 的依赖时，另行明确检查对应文件。

修改 mod 运行时 Java 先改 MociShipPack 原文件，使用 sync --file MociShipPack/data/.../Example.java 查看清单；先询问用户，确认本次范围后才加 --game-approved 同步游戏，保留其他文件。同时改了 src/ 时，build 默认只更新工作区 JAR；游戏发布另外确认，并分别报告验证范围。
