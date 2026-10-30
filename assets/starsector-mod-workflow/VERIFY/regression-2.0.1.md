# 2.0.1 发布回归（只查 skill 自身）

这份清单只针对 skill 的入口/工具/文档；**mod 的行为问题不在这里**（写进该 mod 的 `{backup}\note\bug`）。

每条都要贴命令与输出，不写“应该没问题”。

## R1 文档里不再有旧编译路径

```powershell
Get-ChildItem -Recurse -Include *.md,*.mjs |
  Where-Object { $_.FullName -notmatch '\\VERIFY\\|\\dist\\|_archived|\\TASKS\\|\\HARVEST\\' } |
  Select-String -SimpleMatch 'VERIFY\compile'
# 期望：无输出（0 行）
```

## R2 doctor 自检

```powershell
node Script\doctor.mjs
# 期望：版本：2.0.1  结构：v2 / schema 2 … 结论：ok
```

## R3 照 SKILL 首屏真跑一遍

```powershell
node Script\doctor.mjs --env          # 已绑定且缓存可写时：环境结论：ok
node Script\api-src.mjs ShipSystemStatsScript --lines 1-5
node Script\compile.mjs "<游戏根>\mods\阿斯特·法罗斯基金会"
# 期望：编译 E=0；不出现“命令不存在”
```

说明：未绑定 `data.json` 时 `--env` 会有 5 条“未绑定”W，属正常；已绑定但游戏目录只读时只会剩 1 条“缓存目录不可写”W，把 `data.json.cacheDir` 指到可写盘即可清零。

## R4 文档死链

```powershell
node Script\docs-lint.mjs
# 期望：扫描 N 个文档 / 结论：全部存在
```

## R5 打包后自检

```powershell
node Script\pack.mjs
# 解压 dist 里的 zip 到临时目录，然后：
node Script\doctor.mjs --root <解压目录>\starsector-mod-workflow
# 期望：版本：2.0.1 … 包：N 个文件  PACKAGE.json sha256:<12 位> … 结论：ok
```

## R6 替换链未回归

```powershell
node Script\replace-selftest.mjs
# 期望：全部通过
```
