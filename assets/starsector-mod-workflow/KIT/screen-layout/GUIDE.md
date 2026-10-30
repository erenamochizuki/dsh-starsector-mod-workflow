# 自绘页面（screen-layout）

原生控件做不到的构图（三栏、自绘列表、拖拽滑块）才用。

## 步骤
1. node Script\new.mjs screen-layout <mod> --id <snake_id> --name "<中文名>"
2. init 里只建一次控件，命中区用 sscore.HitMap 登记
3. advance 里把输入结算成状态（拖动/滚轮/键盘）
4. reportDismissed 里写回结果，确认与取消分开
5. 验收：拖动跟手、滚轮不越界、Esc 可退出

## 坑
- 自己写 processInput 再手判命中，和 HitMap 两套坐标
- 在 render 里改状态，帧率不同结果不同
- 尺寸散落魔法数，换个分辨率就错位

## 相关
- 骨架：`SKELETON.java`（含 `// FILL:` 的行就是要改的地方）
- 接线：`recipe.json` 的 `wiring`；数值以 `SPEC.md` 的数值要求为准
- 通用规则见 `SKILL.md` 与 `WORKFLOW.md`
