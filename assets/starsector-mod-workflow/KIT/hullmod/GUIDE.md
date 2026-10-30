# 船插（hullmod）

给装上的舰船加一条属性修正，或拒绝某些舰体。

## 步骤
1. node Script\new.mjs hullmod <mod> --id <snake_id> --name "<中文名>"
2. 改 applyEffectsBeforeShipCreation 里的那一条属性
3. 改 getDescriptionParam 的返回值，与描述里的 {%s} 一一对应
4. 换图标并确认 hull_mods.csv 的 sprite 列路径存在
5. 验收：装上/卸下数值对称，描述不留 {%s}

## 坑
- 描述里的 {%s} 数量多于 getDescriptionParam 提供的参数，界面会显示空
- isApplicableToShip 返回 false 但 getUnapplicableReason 返回 null
- 一条船插改三条属性，出问题无法定位是哪条

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
