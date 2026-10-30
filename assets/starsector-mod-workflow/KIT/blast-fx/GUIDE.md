# 大范围爆炸特效（贴图分层 + 纯数学时间轴）（blast-fx）

一次性大范围爆炸（导弹/鱼雷命中、近炸引信），要“白闪 → 火球 → 光针 → 冲击波环”的完整链条，且不需要准备任何美术素材（默认走原版 graphics/fx）。

## 步骤
1. node Script\new.mjs blast-fx <mod> --id <snake_id> --name "<中文名>"（一个文件里同时有伤害、时间轴、渲染层）
2. 先改 // FILL: 那几个数：RADIUS（伤害半径）、DAMAGE、EMP；VISUAL_SCALE 保持 1.0 = 火球边缘正压在伤害圈上
3. 在武器 .proj 的 onHitEffect 填类名；近炸时在自己的 fuze 逻辑里调 <CLASS>.detonate(engine, source, loc, <CLASS>.visualRadius())
4. 节奏先对照 Timeline 的六个时间点：白闪 0.12s 内结束、火球 0.20s 冲到满径、0.45s 开始缩、光针 0.34s 才出现、三环 0.50/0.62/0.74s 接力
5. 有自制贴图时只改 Fx 的 SPRITE_* 常量，png 放 graphics/fx/，不要动渲染代码
6. 验收：命中即爆、视觉半径与伤害圈吻合、游戏暂停时特效停住、低帧率下不闪烁

## 坑
- 只调 getSprite 不先 loadTexture → textureId=0，整层静默不画（现象：只有粒子、没有火球）
- addLayeredRenderingPlugin 之后不 init(host) → 视口裁剪拿不到位置，一帧都不画
- render 里不用 try/catch → 一层抛异常带崩整场渲染，表现为画面全黑只剩 UI
- 在 render 里 Math.random() 生成角度 → 每帧跳变，看起来在闪（随机值要在构造时生成）
- 把 setSize 的世界单位再乘 getViewMult() → 半径大 2.25 倍，铺满屏幕
- 视觉半径按伤害半径的 2 倍做 → 玩家以为打不到（900su 伤害圈配 1800su 视觉，实测被评“太大太大”）
- 纯加法叠薄贴图（alpha 均值 0.14 的 explosion3）→ 星空透出来，火球像纱；要用一层正常混合的密实垫层
- 一个配方只产出一个文件：想分成多个类只能做成嵌套类

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
