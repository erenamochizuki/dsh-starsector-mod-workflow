# Moci 工程环境与发布范围

核对日期：2026-10-24。工程绑定在 `moci.json`（默认 `%CODEX_HOME%\starsector-projects\moci.json` 或 `~/.codex/starsector-projects/moci.json`），该文件不随 skill 包分发。

下表描述 Moci 参考工程的目录布局。**具体位置一律以绑定文件为准**：`moci.json` 里的路径可以是绝对路径，也可以是相对绑定文件所在目录的相对路径；不要假定任何固定盘符或用户名。

| 项目 | 绑定字段 / 相对位置 |
|---|---|
| 源码工程 | `projectRoot`（含 `pom.xml`） |
| Maven Java 源码 | `sourceRoot`，默认工程 `src/` |
| mod 运行时 Java 源码 | `mod`（`MociShipPack`）下的 `data/hullmods/`、`data/shipsystems/scripts/` 等，保持原位置 |
| 原版运行时 Java 源码 | `<gameRoot>/starsector-core/data/` |
| 中文资源发布包 | `mod`（工程 `MociShipPack/`） |
| 英文发布包 | 工程 `MociShipPack_EN/`，按需处理 |
| 构建产物 | `buildArtifact`，默认工程 `target/moci-1.0-SNAPSHOT.jar` |
| 工作区 JAR | `<mod>/jars/MociShipPack.jar` |
| 游戏根目录 | `gameRoot` |
| 游戏主 mod | `gameMod`，通常是 `<gameRoot>/mods/<主 mod 目录>` |
| 游戏 JAR | `<gameMod>/jars/MociShipPack.jar` |
| JDK | `jdkHome` / `jdk`（需 Java 17） |
| Maven | `maven`（`mvn` 或 `mvn.cmd` 的完整路径） |
| 缓存/发布备份 | `workRoot`，默认工程 `.work/MociShipPack/` |

游戏版本按两个 mod_info.json 确认为 0.98，不凭上游说明断言精确 RC 版本。

## 配置与调用

主入口 `Script/moci.mjs`；默认读 `%CODEX_HOME%\starsector-projects\moci.json`（`CODEX_HOME` 缺省为 `~/.codex`）。`SSMOD_CONFIG` 可指定独立项目配置，用于隔离测试。Java、源代码、资源、游戏、构建产物与备份路径均从配置读取；脚本不写死盘符。

旧脚本的配置发现还支持当前目录向上查找 `.work/config.json`；推荐只建立一个用户配置，避免全局环境与工程目录两份绑定漂移。若有人手动增加 `.work` 配置，先检查是否遮蔽了用户绑定。

## 默认发布行为

参考默认：优先修改工程 `MociShipPack` 中的发布版本，任何同步到游戏主 mod（`gameMod`，如 `<游戏根>/mods/<主 mod 目录>`）的操作都先询问。这是建议的工作流默认值，实际以用户当次授权为准。

`src/` Java 修改后默认 Maven `clean package` 并更新 `MociShipPack/jars/MociShipPack.jar`；散放 Java 与其他资源先改 `MociShipPack` 原文件。`build` 默认只更新工作区，`sync` 默认只展示清单。准备好文件与验证结果后，展示具体清单和游戏目标，获得用户对本次范围的明确确认后，才加 `--game-approved` 执行游戏同步。

参考绑定设置 `autoUpdateWorkspaceJar=true`、`autoDeployJar=false`、`autoSyncResources=false`、`gameSyncRequiresApproval=true`。旧的自动同步字段不能代替当前确认要求。工作区更新可离线完成；游戏正在运行时不能向游戏发布，保留工作区结果，退出后重新确认/执行本次同步，不擅自关闭游戏。仅修改 skill 时不发布 mod。

CSV、舰船/武器配置、音频、贴图及运行时 Java 均按本次已确认的清单选择性同步。先用 `moci.mjs sync --file MociShipPack/data/...` 查看计划，多个文件重复传 `--file`；确认后传 `--game-approved`。保留游戏其他文件，删除与整包镜像不能混入。JAR 发布与资源发布分别报告，任务开始前已有的无关改动不能混入本次发布。

## 参考资料适用范围

上游 KIT、LIB、API、REF 保留作参考。Moci 确实混用 JAR 和运行时源码，但不能把上游的 Janino 版本、固定 `data/scripts` 路径、离线编译命令或原作者环境当成当前工程事实。原作者 mod、DSH 审批、固定 SPEC 与 sscore 规定不构成当前工程要求。Moci 专项规则分别由另外两个已安装 skill 提供；本 skill 不覆盖它们。
