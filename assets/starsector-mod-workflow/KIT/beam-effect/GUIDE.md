# 光束自绘（BeamEffectPlugin）（beam-effect）

光束外观要脱离原版贴图的“直筒+滚动”，做螺旋/电弧/亮芯；伤害仍交给原生 beam。

## 步骤
1. node Script\new.mjs beam-effect <mod> --id <snake_id> --name "<中文名>"
2. 在目标 .wpn 末尾加 "beamEffect":"<fqcn>"（specClass 必须是 beam）
3. 按原图调 AMP/PITCH/SPEED 与四个颜色，先把外晕调对再加细节
4. 先只留光晕+亮芯跑通，再逐层加螺旋、电弧
5. 验收：开火即有、关火即灭、炮口与命中点不断裂

## 坑
- 亮度没降到 0.03 以下就 continue，关火后粒子残留
- 每帧按固定数量发粒子（应按 RATE*amount 累积），高帧率下爆量
- 用 GL 画而不是引擎粒子，暂停/换分辨率后错位
- 忘记在 .wpn 里挂 beamEffect，脚本编过但不执行

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
