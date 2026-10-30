# 战役能力（ability）

需要一个可点的战役按钮，按下后改变战役状态（舰队/星区/记忆），并带冷却。

## 步骤
1. node Script\new.mjs ability <mod> --id <snake_id> --name "<中文名>"
2. 填 SKELETON 里 1 处 FILL：activate() 的效果
3. 把 24x24 图标放进 mod，路径与 abilities.csv 的 icon 列一致
4. modplugin 里 addAbility("<id>")（只加一次，读档判重）
5. 验收：按钮出现 → 点击生效 → 冷却条从满回落到 0

## 坑
- 冷却算了两次：csv 的 activationCooldown 与本类 COOLDOWN_DAYS 只留一个
- 在 activate() 里开对话框：改成 pressButton() 或另起规则
- 忘记 addAbility，csv 有行但按钮不出现

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
