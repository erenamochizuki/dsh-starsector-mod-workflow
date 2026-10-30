# 存档数据与结算（monthly-store）

需要跨日/跨月结算的状态（次数、产出、事件计时）。

## 步骤
1. node Script\new.mjs monthly-store <mod> --id <snake_id> --name "<中文名>"
2. modplugin 里 addScript，先 findScript 判重
3. settleDay 保持幂等，读档重放不重复发
4. 验收：过一天只结算一次，读档不重复

## 坑
- 每次 onGameLoad 都 addScript，脚本越叠越多
- 用浮点累加天数，长时间游戏后漂移
- 把最后一次结算日写成对象，读档后类型对不上

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
