# dsh-starsector-mod-workflow

[![CI](https://github.com/erenamochizuki/dsh-starsector-mod-workflow/actions/workflows/ci.yml/badge.svg)](https://github.com/erenamochizuki/dsh-starsector-mod-workflow/actions/workflows/ci.yml)

把 Codex skill `starsector-mod-workflow`（Starsector / Moci mod 开发工作流）移植成的 **DeepSeek Harness 插件**。

一个包同时提供两件事：

1. **skill**：把 `starsector-mod-workflow` 注册进 DSH 的 skill 目录（含 `REF/`、`KIT/`、`API/`、`Script/` 等全部资源文件），并在展示给模型的正文末尾追加一节 **DSH 运行环境**，把 Codex 专有的命令写法与交互式提问工具换成 DSH 的用法。
2. **tool**：注册 `starsector_moci` 工具，直接执行捆绑的 moci CLI（`doctor` / `compile` / `build` / `verify` / `sync` / `api-src` / `api-grep` / `find-class` / `javap` / `logscan` / `templates` / `new` / `preview` / `help`）以及本地教程检索（`tutorial`），自动带上绑定文件、工作目录和 Node 路径。

---

## 环境要求

| 项目 | 要求 |
|---|---|
| DeepSeek Harness | `>= 0.2.0-rc.2`（桌面版自带，无需单独安装） |
| Node.js | `>= 18`；未显式配置时插件会自动探测 DSH 自带运行时或当前进程 |
| 操作系统 | Windows 10/11（moci CLI 的构建、同步、日志路径等流程依赖 Windows / PowerShell） |
| Starsector 工程 | 一个 Moci 风格的源码工程：`pom.xml` + `MociShipPack/mod_info.json`（`id = moci_shippack`） |

插件本身是纯 JS，无安装期依赖；`assets/` 里的 CLI 只依赖 Node 内置模块。

## 安装

### 方式一：DSH 插件管理器（推荐）

打开 DSH 的插件/市场界面，在「包名或自定义安装源」输入：

```
github:erenamochizuki/dsh-starsector-mod-workflow
```

确认后重启 DeepSeek Harness。插件声明了 `dsh.bundle.patch`，安装后会在 profile 的 `dsh.profile.bundles` 里启用。

> DSH 的插件市场卡片只列 `awesome-dsh-plugin` 收录的源；未被收录时请用上面的自定义安装源，或下面的 CLI。

### 方式二：命令行

```bash
dsh plugin --profile desktop add github:erenamochizuki/dsh-starsector-mod-workflow
```

`--profile` 用你实际使用的 profile（桌面版通常是 `desktop`）。装完后确认该 profile 的 `package.json` 满足两点：

```jsonc
{
  "dependencies": {
    "dsh-starsector-mod-workflow": "github:erenamochizuki/dsh-starsector-mod-workflow"
  },
  "dsh": {
    "profile": {
      "bundles": ["...", "dsh-starsector-mod-workflow"] // 已由插件管理器自动追加时无需手改
    }
  }
}
```

**需要重启 DeepSeek Harness 才会生效**：profile 的 bundle 在启动时组合，运行中的进程不会热加载新 bundle。重启后：

- 模型看到的 skill 列表里会出现 `starsector-mod-workflow`；
- 工具列表里会出现 `starsector_moci`。

### 方式三：预构建 tarball

从 [Releases](https://github.com/erenamochizuki/dsh-starsector-mod-workflow/releases) 下载 `dsh-starsector-mod-workflow-1.0.0.tgz`，然后：

```bash
dsh plugin --profile desktop add ./dsh-starsector-mod-workflow-1.0.0.tgz
```

### 从源码安装（开发用）

```bash
git clone https://github.com/erenamochizuki/dsh-starsector-mod-workflow.git
dsh plugin --profile desktop add /absolute/path/to/dsh-starsector-mod-workflow
```

## 绑定 Moci 工程

moci CLI 通过一个 `moci.json` 定位工程、游戏与工具链。默认查找顺序：

`config.binding` → 环境变量 `SSMOD_CONFIG` → `%CODEX_HOME%\starsector-projects\moci.json` → `%USERPROFILE%\.codex\starsector-projects\moci.json`

最小可用的绑定文件（路径按你的机器替换；相对路径相对 `moci.json` 所在目录解析）：

```jsonc
{
  "profile": "moci-maven",
  "projectRoot": "D:/path/to/Moci",
  "sourceRoot": "D:/path/to/Moci/src",
  "mod": "D:/path/to/Moci/MociShipPack",
  "gameRoot": "D:/path/to/Starsector",
  "gameMod": "D:/path/to/Starsector/mods/你的mod目录",
  "jdkHome": "C:/Program Files/Java/jdk-17",
  "jdk": "C:/Program Files/Java/jdk-17",
  "maven": "C:/apache-maven-3.8.8/bin/mvn.cmd",
  "buildArtifact": "D:/path/to/Moci/target/moci-1.0-SNAPSHOT.jar",
  "workRoot": "D:/path/to/Moci/.work/MociShipPack",
  "apiSourceRoots": ["D:/path/to/Moci/starfarer.api"],
  "autoDeployJar": false,
  "autoUpdateWorkspaceJar": true,
  "autoSyncResources": false,
  "gameSyncRequiresApproval": true,
  "resourceSyncMode": "explicit-current-task-file-list"
}
```

- `profile` 必须是 `moci-maven`。
- 没绑定 `gameRoot` / `gameMod` 也能离线编译，`build`/`sync` 的游戏同步部分不可用。
- 绑定文件是**你的本机配置**，不属于本仓库，也不应该提交。

## 配置（全部可选）

在 profile 的 `cordis.patch.yml` 里给该条目加 `config` 即可覆盖：

```yaml
- id: starsector-mod-workflow
  name: dsh-starsector-mod-workflow
  config:
    binding: D:/path/to/moci.json
    node: C:/path/to/node/node.exe
```

| 键 | 默认值 | 说明 |
|---|---|---|
| `binding` | 见上面的解析顺序 | moci 工程绑定文件 `moci.json` 的绝对路径 |
| `node` | 自动探测 | 运行 CLI 的 Node 可执行文件（需 >= 18） |
| `assetRoot` | 包内 `assets/starsector-mod-workflow` | 捆绑 skill 目录，可指向外部副本 |
| `tool` | `true` | 设为 `false` 时只注册 skill、不注册工具 |

Node 探测顺序：`config.node` → `DSH_MOCI_NODE` → `~/.dsh/dsh-runtimes/*/dependencies/node/bin/node` → 当前可执行文件（Electron 时补 `ELECTRON_RUN_AS_NODE=1`）。解析出的绑定路径会以 `SSMOD_CONFIG` 传给子进程（moci CLI 原生支持该变量）。

## 用法

模型侧：

```
starsector_moci({ command: "doctor" })
starsector_moci({ command: "compile" })
starsector_moci({ command: "build" })
starsector_moci({ command: "verify", args: ["--file", "data/hullmods/Foo.java"] })
starsector_moci({ command: "api-src", args: ["ShipAPI"] })
starsector_moci({ command: "tutorial", args: ["search", "--exact", "EveryFrameCombatPlugin"] })
```

- `args` 是原样追加到命令后面的参数数组；`--file` 使用**工程相对路径**（CLI 自己换算到 `projectRoot`）。
- 工作目录默认是绑定工程的 `projectRoot`，可用 `cwd` 覆盖。
- 超时：`compile` 600s、`build` 900s、`sync` 300s，其余 300s；可用 `timeoutSec` 覆盖（上限 1800s）。
- 任何写游戏目录的操作（`sync`，或 `build --game-approved`）按 skill 规则必须先由模型用 `ask_user_question` 拿到用户明确的「是」，插件不会替你加这个开关。

手工调用也可以，等价于：

```bash
node "<包目录>/assets/starsector-mod-workflow/Script/moci.mjs" doctor
```

## 捆绑的 skill 包含什么

`assets/starsector-mod-workflow/` 是 `starsector-mod-workflow` skill 的完整发行版，主要入口：

| 路径 | 内容 |
|---|---|
| `SKILL.md` / `WORKFLOW.md` | 工作流总则与命令入口 |
| `REF/` | 环境、性能、UI、战役内存、Janino、教程库等参考 |
| `API/` | 本地 API 索引与按包分组的方法说明 |
| `KIT/` | 配方与骨架模板 |
| `GATE/`、`VERIFY/` | 数据校验与回归脚本 |
| `Script/` | moci CLI 与教程检索实现（`Script/moci.mjs`、`Script/tutorial.mjs` 等） |
| `PACKAGE.json`、`SHA256SUMS.txt` | 版本信息与全量文件哈希 |

完整性校验（在 skill 目录内）：

```bash
# Git Bash / WSL / Linux
sha256sum -c SHA256SUMS.txt
```

```powershell
# PowerShell
Get-Content SHA256SUMS.txt | ForEach-Object {
  $hash, $path = $_ -split '  ', 2
  if ((Get-FileHash $path -Algorithm SHA256).Hash -ne $hash.ToUpper()) { Write-Host "BAD $path"; exit 1 }
}
"ok"
```

## 与 Codex 版的差异

移植只改「模型看到的那一层」，skill 包本体保持原结构：

- `SKILL.md` 正文原样保留，末尾追加 **DSH 运行环境** 一节：命令入口改用 `starsector_moci`、不再 `cd` 到 skill 根、收尾确认改用 `ask_user_question`、未安装的配套 skill（`starsector-moci-shipbuilding` / `starsector-rules-writing`）跳过。
- 绑定文件不再依赖 Codex 目录约定（仍兼容），改用上面四种来源解析。
- **参考文档已脱敏**：原包里的个人绝对路径替换为占位符（`<工程根>`、`<游戏根>`、`<技能根>`、`<JDK 目录>`、`<用户目录>`、`<本机路径>`），`SHA256SUMS.txt` / `PACKAGE.json` 已按脱敏后的文件重新计算。文档里的路径一律以绑定文件字段为准。

## 已知限制

- Codex 侧的两个配套 skill（`starsector-moci-shipbuilding`、`starsector-rules-writing`）没有一并移植；DSH 里若未单独安装，专项规则不可用。
- `Script/` 内部仍会调用 `powershell.exe`（Windows PowerShell 5.1）做个别检查，与 DSH 的 pwsh 7 并存，不影响使用。
- 本地教程资料库需要工程内 `tools/knowledge/starsector` 索引且依赖 `git`；缺失时 `tutorial` 会失败，属于原包行为。
- 没有 `moci.json` 绑定或 JDK/Maven 不可用时，`doctor` 会明确报出缺失项；插件本身仍可正常安装与加载。

## 测试

```bash
npm test                        # 或分别运行：
node test/smoke.mjs             # 假 ctx：注册面 + skill 内容 + 工具结构 + 真实跑 templates
node test/binding-override.mjs  # 真实 CLI：SSMOD_CONFIG 覆盖生效、坏 profile 被拒绝
```

机器上没有 `moci.json` 时，两个测试自动改用临时 fixture 工程（`test/fixture.mjs`），因此可以直接在 CI 上运行；有真实绑定时会额外断言 `doctor` 通过。

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 在 Node 18/20/22 上跑 `npm test`。

## 卸载

用插件管理器移除，或：

```bash
dsh plugin --profile desktop remove dsh-starsector-mod-workflow
```

再重启 DSH（插件管理器会同时从 `dsh.profile.bundles` 中移除；手工安装的话记得自己删掉这两个条目）。

## 许可

[MIT](LICENSE)。捆绑的 skill 包来自原作者的上游发行版，脱敏与 DSH 适配部分的改动同样以 MIT 发布；上游声明与第三方资料以各自文件中的说明为准。
