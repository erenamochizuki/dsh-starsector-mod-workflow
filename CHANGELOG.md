# Changelog

## 1.0.0 — 2026-10-31

首次公开发布。

### 新增

- DSH 插件外壳：把 Codex skill `starsector-mod-workflow` 注册为 DSH skill，并在正文末尾追加「DSH 运行环境」小节。
- `starsector_moci` 工具：在绑定工程上执行 moci CLI（`doctor` / `compile` / `build` / `verify` / `sync` / `api-src` / `api-grep` / `find-class` / `javap` / `logscan` / `templates` / `new` / `preview`）与教程检索（`tutorial`）。
- 绑定解析：`config.binding` → `SSMOD_CONFIG` → `CODEX_HOME` → `~/.codex`；Node 路径自动探测（含 DSH 自带 runtime 与 Electron `ELECTRON_RUN_AS_NODE`）。
- GitHub Actions CI：Node 18/20/22 上跑 `npm test`。

### 变更

- 参考文档脱敏：个人绝对路径替换为 `<工程根>`、`<游戏根>`、`<技能根>`、`<JDK 目录>`、`<用户目录>`、`<本机路径>` 占位符，路径一律以 `moci.json` 字段为准。
- 按脱敏后的文件重新生成 `assets/starsector-mod-workflow/SHA256SUMS.txt` 与 `PACKAGE.json`（files / bytes / distribution 说明）。
- 测试可在无 `moci.json` 的机器（CI、新克隆）上运行：新增临时 fixture 工程，`doctor` 断言按真实绑定/夹具两种模式区分。
- `package.json` 补全公开发布元数据（repository / homepage / bugs / license / engines / keywords / test script）。

### 说明

- 捆绑的 skill 版本为 `2.0.5-moci.9`（上游 2.0.5 的 Moci 适配版）。
- 首次发布对应 tag `v1.0.0`。
