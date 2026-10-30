# 武器每帧效果（weapon-effect）

武器每帧持续行为（光效、周期性伤害、状态累积）。单次命中优先用 weapon 的 script。

## 步骤
1. node Script\new.mjs weapon-effect <mod> --id <snake_id> --name "<中文名>"
2. 在目标 .wpn 顶层加 "everyFrameEffect":"<fqcn>"
3. 填 advance 里的触发条件与效果
4. 验收：开火后效果按 INTERVAL 触发，暂停时不触发

## 坑
- 每帧遍历全引擎弹体，用射弹自带挂钩
- 不判 isPaused，暂停时还在结算
- 用帧数当时间，高帧率下触发频率翻倍

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
