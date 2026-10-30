# 势力数据（faction）

新增一个势力（颜色、名称、旗帜、关系）。

## 步骤
1. node Script\new.mjs faction <mod> --id <snake_id> --name "<中文名>"
2. 补 logo/crest 两张图，确认路径存在
3. 开局关系放 modplugin 的 onNewGame
4. 验收：势力出现在情报页，关系值符合 SPEC

## 坑
- 缺 logo/crest，界面空白但不报错
- 关系写死在静态初始化，重载后叠加
- showInIntelTab 开了但没有任何市场/情报

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
