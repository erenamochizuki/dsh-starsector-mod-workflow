# 规则命令（dialog-rule）

rules.csv 需要一个自定义命令来改状态/给选项。

## 步骤
1. node Script\new.mjs dialog-rule <mod> --id <snake_id> --name "<中文名>"
2. settings.json 的 ruleCommandPackages 加包名
3. rules.csv 写一行调用该类与参数
4. 验收：走到该规则时命令执行，失败分支可走

## 坑
- 包名没注册，rules.csv 命中不到类
- execute 返回 true 但实际没做事，后续分支误判
- 在命令里弹新对话，栈里出现两个 dialog

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
