> 上游历史迁移资料。当前 Moci 适配代码与配置不能直接用原包覆盖；完整上游备份保存在用户 Codex backups/skills 目录。

# 从 0.4.x 换到 2.0：替换与回滚

本项目不做安装器，也不做并行双版本。替换就是“归档 → 清空 → 放入”。

## 2.0.4 → 2.0.5

打包与安装改成「包内零本机路径」，**无目录迁移**：

- 新增 `Script\lib\redact.mjs` 与 `Script\local-roots.json`（后者不进包）。`pack.mjs` 把 `.md/.json/.txt` 里的本机根换成 `<游戏根>`、`<mod 目录>`、`<用户目录>`、`<JDK 目录>`、`<技能源目录>`，其余带盘符的绝对路径换成 `<本机路径>`；代码文件命中本机根即中止打包并打印行号。
- `PACKAGE.json` 新增 `redaction` 段：占位符名、改动文件数、替换次数。
- `doctor --info` 打印当前绑定；`--jdk <JDK 目录>` 现在写进 `.work\config.json`，不再只影响当次探测。
- `Script\lib\sources.mjs` 删掉写死的回退盘符：找不到 `starfarer.api.zip` 时直接报错并提示先绑定。
- 升级：`replace.mjs` 照常替换。已在用的 `.work\config.json` 不必重写，建议补一次 `doctor --jdk <你的 JDK 目录>` 和 `doctor --info` 核对。

## 2.0.3 → 2.0.4

只改 SPEC 段名与文档文风，**无目录迁移**：

- SPEC 两段标题改为「数值要求」与「界面要求」。解析点在三处：`GATE\rules\r7-spec.mjs` 的段正则、`Script\lib\task.mjs` 的 `section(text, '数值要求')`、`Script\preview.mjs` 的线框段正则。
- 2.0.3 及更早生成的任务：`node Script\spec.mjs --check` 会报缺少数值段，把该段标题改成「数值要求」后重新 `--approve`；数值行内容不动时，其余产物不受影响。
- 全仓 Markdown、脚本注释与 KIT 骨架注释按 `spec-skill-creator` 的词表清理；`INDEX.md` 由 `Script\gen-index.mjs` 重新生成。

## 2.0.2 → 2.0.3

工作产物统一搬到 `<mods>\.work\`，**skill 目录零写入**：

- 布局：`<mods>\.work\config.json`（绑定）、`<mods>\.work\cache\`（共享缓存）、`<mods>\.work\<mod目录名>\{cache,tasks,distill,harvest,note,backups,reports,verify}\`。
- **`data.json` 取消**。首次绑定：`node Script\doctor.mjs --game <游戏根> --mod <mod 目录>`；旧 `data.json` 会被自动读入并迁移，随后删除。
- `req/spec/plan/distill/note/harvest/wrapup/probe/logscan/clean` 全部改从 `.work` 读写；任务 id 直接传裸 id（`node Script\distill.mjs <id>`）。
- 旧的 skill 根 `TASKS/DISTILL/HARVEST` 会在 doctor 绑定后自动搬进 `.work\<mod>\`；旧的 `{backup}\note` 需手动拷到 `<mods>\.work\<mod>\note\`（参考工程已迁移）。
- `replace.mjs` 不再写 `data.json`；替换不会碰 `.work`。
- 打包/替换继续排除 `.work`、任务、草稿、案例。

## 2.0.1 → 2.0.2

新增「案例蒸馏」入口，**无数据迁移**：

- 新命令 `node Script\distill.mjs <id>`。
- 可追加资产：`--recipe`（配方草稿）、`--block`（纯逻辑草稿）、`--ref`（REF 骨架）、`--link 类型=路径`（登记已落地资产）；已有案例单会被追加，不会被覆盖。
- 校验：`node Script\distill.mjs --check`，源文件哈希漂移标 stale，台账路径不在标 W。
- `wrapup` 在任务没有案例记录时提示一次（W，不阻塞）。
- 任务/案例/草稿原先在 skill 根的 `TASKS\`、`DISTILL\`、`HARVEST\`，2.0.3 起统一进 `.work`。

## 2.0.0 → 2.0.1

只改文档、命令表与小工具，**无数据迁移**：

- `SKILL.md` 的 L1 从旧 `VERIFY\` 路径改回 `Script\compile.mjs`；WORKFLOW/FACTS 同步。
- 新增 `docs-lint`、`find-class`、`javap`、`decompile`、`clean`、`probe` 等工具与命令表分类。
- `doctor` 现在额外打印“包内文件数 + `PACKAGE.json` 的 sha256”。
- 升级：用 `replace.mjs` 照常替换即可。

## 换之前

```powershell
# 1. 看旧目录里有没有你自己的东西（doctor 会把非框架文件列出来）
node Script\doctor.mjs --root "旧的 starsector-mod-workflow 目录"

# 2. 先预演，不动文件
node Script\replace.mjs --target "<旧目录>" --backup "<归档根>" --dry-run
```

`--backup` 不写时，归档落在旧目录旁边的 `.skill-archive\<名字>-<时间戳>\`。

## 换

```powershell
node Script\replace.mjs --target "<旧目录>" --backup "<归档根>"
```

它会：

1. 整目录原样归档（含你的自定义文件），写 `archive.json`（来源版本、非框架文件清单）；
2. 清空旧目录；
3. 放入本构建（跳过 `data.json`、`TASKS\`、`HARVEST\`、`DISTILL\`、`_*`）；
4. 在目标目录跑 `doctor.mjs`，不通过就报回滚路径。
   绑定在 `<mods>\.work\config.json`，替换不碰它；旧目录里的 `data.json` 随归档保留，新目录不再生成。

`<mods>\.work\<mod>\note\` 不随 skill 走，替换不会动它。

## 回滚

```powershell
# 清空目标后，把归档内容放回
Copy-Item "<归档根>\<名字>-<时间戳>\*" "<旧目录>" -Recurse -Force
```

## 换之后

- **新开对话**：skill 的 SKILL.md 只在会话启动时加载，旧对话不会自动换脑。
- 跑一遍自检：`node Script\doctor.mjs`，应显示 `版本：2.0.4 结构：v2 / schema 2 … 结论：ok`。
- 旧状态里如果还有 `CASES\` / `SS_INDEX.md` / `manifest.json`，doctor 会报残留；它们只应存在于归档里。

## 2.0 不再随包的东西

| 旧目录 | 现在 |
|---|---|
| `SS_INDEX.md` 手写索引 | `INDEX.md` 由 `Script\gen-index.mjs` 生成 |
| `CASES\` 散文案例 | `REF\` 带 `文件:行` + `KIT\` 可编译配方 |
| `CHECK\modcheck.mjs` 串行检查 | `GATE\rules\` 规则 + baseline |
| `DB\` 反编译源码 | `api-src` / `api-grep` 直接读 `starfarer.api.zip` |
| `TPL\` 模板 | 配方未覆盖的内容类型，用到再建 |
| `install.mjs` | `replace.mjs`（归档/清空/放入/迁移），不做安装器 |
