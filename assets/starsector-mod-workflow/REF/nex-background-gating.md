# Nexerelin 人物背景：显示与可选是两个开关

适用版本：**Nexerelin 0.12.2**，游戏 0.98a-RC8。结论在 `exerelin/campaign/backgrounds/BaseCharacterBackground.java`（jar 内嵌源码）。

## 两个方法，别混用

| 方法 | 管什么 | 返回 false 的后果 |
|---|---|---|
| `shouldShowInSelection(factionSpec, factionConfig)` | 条目是否出现在列表里 | 根本不显示 |
| `canBeSelected(factionSpec, factionConfig)` | 条目能否点击选择 | 显示但灰掉，并调用 `canNotBeSelectedReason` 给原因 |

默认实现两个都返回 `true`（`BaseCharacterBackground.java:35` 与 `:39`）。所以**只覆写 `shouldShowInSelection` 并不会锁住任何东西**，条目照样能点。

## 证据

- 默认值：`jar:ExerelinCore.jar!exerelin/campaign/backgrounds/BaseCharacterBackground.java:35`、`:39`。
- 永远显示、从不锁：`jar:ExerelinCore.jar!exerelin/campaign/backgrounds/HeavyDebtBackground.java:16`（只覆写 show，返回 true）。
- 本仓库的正确写法：`data\scripts\apstart\ap_BgBeneficiary.java:40`（始终显示）、`:75`（`canBeSelected` 返回 `!isLocked()`）、`:88`（`canNotBeSelectedReason` 说明原因）、`:82`（锁定时标题降级）。

## `$nex_customStart` 的生命周期

1. 选额外开局：`jar:ExerelinCore.jar!com/fs/starfarer/api/impl/campaign/rulecmd/newgame/Nex_NGCCustomStart.java:68` 写 `memoryMap.get(MemKeys.LOCAL).set("$nex_customStart", startId)`。
2. 进背景页：同一个 local memory 里能读到，所以 `canBeSelected` 可以据此锁定。
3. 返回列表：同文件 `:81` `unset("$nex_customStart")`。
4. 最终确认：`Nex_NGCFinalize.java:25` 会读它判断 tutorial 开局。

它只在角色创建对话框的 local memory 里，不要到 sector memory 找（见 `REF\campaign-memory-scopes.md`）。

## 写一个带条件的背景：清单

- [ ] `shouldShowInSelection` 返回 true（除非确定不希望它出现）。
- [ ] `canBeSelected` 里做真正的锁：条件不满足返回 false。
- [ ] 同时覆写 `canNotBeSelectedReason`，否则玩家只看到灰条不知道为什么。
- [ ] 锁定时把 `getTitle` 改成带“已锁定”的占位，避免看起来像 bug。
- [ ] 条件来源写进 `FACTS.md`：哪个键、哪个 memory、哪一行。
- [ ] 不要复制 Nex 源码进 mod；引用 jar 内条目即可。

## 自查命令

```powershell
node Script\find-class.mjs BaseCharacterBackground
node Script\javap.mjs exerelin.campaign.backgrounds.BaseCharacterBackground
```
