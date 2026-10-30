# 殖民地产业（industry-colony）

新增殖民地产业（产出/需求/建筑要求）。

## 步骤
1. node Script\new.mjs industry-colony <mod> --id <snake_id> --name "<中文名>"
2. apply 里声明 supply/demand，unapply 里逐条撤销
3. 把 industry id 接到市场/建筑数据
4. 验收：建成后有产出，拆除后市场数值归零

## 坑
- 调 super.apply()（BaseIndustry 没实现它）
- unapply 漏撤一条，拆除后幽灵产能
- 需求超过市场等级允许，产业永远亏损

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
