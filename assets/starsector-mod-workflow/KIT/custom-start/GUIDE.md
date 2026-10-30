# 开局定制（custom-start）

改开局：给船、给钱、改起始位置。

## 步骤
1. node Script\new.mjs custom-start <mod> --id <snake_id> --name "<中文名>"
2. mod_info.json 的 modPlugin 指向该类（已有则合并）
3. onNewGame 里给船/货/钱，variant id 必须存在
4. 验收：新开一档，舰队与货物符合 SPEC

## 坑
- 又写一个 modPlugin，两个都加载但只有一个生效
- variant id 拼错，开局直接报错
- 在 onGameLoad 里发奖励，每次读档都发一次

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
