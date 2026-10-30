# 原生控件页面（screen-native）

页面只需要文字、按钮、滚动条，优先这条路，别自绘。

## 步骤
1. node Script\new.mjs screen-native <mod> --id <snake_id> --name "<中文名>"
2. createCustomDialog 里用 createUIElement + TooltipMakerAPI 排版
3. 选项用 addButton，回调在 advance 里消费一次
4. 打开：dialog.showCustomDialog(w, h, new <Class>())
5. 验收：滚动、确认、取消、Esc 都正常

## 坑
- 用像素坐标判断点击（原生控件已经帮你做了）
- 忘记 updateUIElementSizeAndMakeItProcessInput，按钮点不到
- 在按钮回调里直接写存档，取消后也生效

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
