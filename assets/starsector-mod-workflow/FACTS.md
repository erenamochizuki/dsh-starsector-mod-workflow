# Moci 已核对事实

核对日期：2026-10-24。此页记录对 Moci 参考工程的观察；更换工程或游戏版本后重新核实。

- 主工程为 src + pom.xml；pom 的 sourceDirectory 为 src，Java release 为 17。
- Moci 同时保留游戏运行时加载的 Java 源码：例如 MociShipPack/data/hullmods/Moci_weapon_overload.java 和 data/shipsystems/scripts/Moci_Fastturndrive.java。它们不属于 Maven 的 src 编译范围。
- 绑定游戏 starsector-core/data/shipsystems/scripts/ 存在 AmmoFeedStats、SensorDroneStats、FortressShieldStats 等原版源码，类引用检查不能只看工程 src 和 JAR。
- Moci_Easytobreak.java 的顶层声明为 Moci_EasyToBreak；源码索引按声明识别类名。初始检查所报的 13 项缺类均可在 mod 或原版运行时源码中找到，属于检查范围和识别方式造成的误报。
- 中文发布包 MociShipPack 的顶层 mod ID 为 moci_shippack；声明 jars/MociShipPack.jar 与 data.scripts.Moci_bounty_plugin。
- Maven 默认产物为 target/moci-1.0-SNAPSHOT.jar；当前 pom 没有自动复制到发布包或游戏的配置。
- 游戏中主 mod 顶层 ID 与中文发布包一致；不能通过搜索 dependencies 中的同名 ID 来判断主 mod，必须读取顶层字段。
- 参考环境里 Maven 3.8.8 的 PATH 默认可能指向 JDK 21；本工具通过子进程环境绑定 JDK 17，不更改系统全局环境。
- API 资料在工程 starfarer.api/、starsector-core/、vanilla_hullmods/；运行游戏另有 starsector-core/starfarer.api.zip。
- 实际游戏日志在绑定游戏的 starsector-core/starsector.log。
- 用户最新要求：优先修改 MociShipPack；src Java 修改后更新工作区 JAR。任何游戏同步先展示清单并询问，本次明确确认后执行；此前的默认自动同步偏好已被替代。
- 游戏同步保留其他文件，只发布本次已确认的 JAR/资源范围；工作区与游戏的发布状态分别报告。

本次核实依据：WORKSPACE.md、实际 pom.xml、两个目标的 mod_info.json、IDE artifact 路径、Maven -version、JDK release、API 与日志文件存在性。工程目录布局（字段名与默认相对位置）见 REF/moci-environment.md。
