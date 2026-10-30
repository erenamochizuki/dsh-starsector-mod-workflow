# 界面两条路线与线框预览

做界面前先选路线；选错会白写一遍输入与布局。

## 怎么选

| 路线 | 用什么 | 布局谁算 | 输入 | 适合 |
|---|---|---|---|---|
| `native` | `showCustomDialog` + `CustomPanelAPI.createUIElement` + `TooltipMakerAPI` | 引擎 | 引擎按钮/滚动条 | 表格、详情、按钮多的页面；不想管坐标 |
| `layout` | `showCustomVisualDialog` + `CustomUIPanelPlugin` + `sscore/layout` | 我们 | `sscore/inputrouter` | 三栏、滑块、自绘行、动态列表 |

判断标准一句话：**页面上有没有“引擎给不了的东西”**（滑块、双行行项、头像格、非标准滚动）。有 → `layout`；没有 → `native`。

生成骨架：`node Script\new.mjs screen-native <mod> --id …` 或 `screen-layout`。两者都带可编译骨架与 `// FILL:`。

## native 路线的三个调用点

1. `CustomPanelAPI panel = dialog.createCustomPanel(w, h);`
2. `TooltipMakerAPI el = panel.createUIElement(w, h, false);` 往 `el` 里 `addPara/addButton/addImage`
3. `panel.updateUIElementSizeAndMakeItProcessInput(el);` 再把 `panel.wrapTooltipWithBox(el)` 塞进一个带边框的容器，`panel.addComponent(box).inTL(0, 0)`。

顺序反了会得到零尺寸元素或不吃输入。细节见 `REF\ui-native-controls.md`。

## layout 路线的四个点

1. `CustomVisualDialogDelegate.init(CustomPanelAPI panel, DialogCallbacks cb)` 里建 `Layout`、登记区域
2. `advance(float)`：只做状态推进；拖拽/滚轮交给 `InputRouter`（它内部处理事件消费）
3. `render(float)`：只按矩形画，不 `addComponent`
4. `reportDismissed(int)`：回调 `cb.dismissDialog()`，用标志位防重入

## 线框预览

SPEC 里加一段代码块（`## 线框`），`preview.mjs` 直接出 PNG：

````
## 线框

```
size 1500 900
title "查看俘虏"
region 20 96 456 680 "俘虏 · 滚轮下滑"
row 32 130 432 84 "艾德琳·沃斯 | 理智 63" selected
line 498 130 "Cycle 206 · 5 月 24 日 · 审讯 · 理智 -8"
button 972 735 200 44 "确认处决" primary
note 24 792 700 "24 种均为即死。"
footer 24 862 "底部一行说明"
```
````

```
node Script\preview.mjs --spec TASKS\<id>\SPEC.md --out TASKS\<id>\preview.png [--annotate]
node Script\preview.mjs --layout TASKS\<id>\LAYOUT.json --out TASKS\<id>\preview.png
```

- 字体直接读游戏 `graphics/fonts/insignia25LTaa.fnt` + 图集，中文宽度与实机同源，折行可以预演。
- 只画构图：区域、行、按钮、层级、越界、文案长度。不画图标、不做像素级配色校准。
- `--annotate` 在每个区域右下角标尺寸；`--spec` 会同时写一份 `LAYOUT.json`，供 `layout` 路线或后续改图。
- 与用户给的图并排比较仍要人看；线框不用于验收“好不好看”。

## 已知差异

- 不做 kerning，逐字 `xadvance` 累加；与实机差在 1px 级。
- 不解析 `.fnt` 里的 `xoffset/yoffset` 之外的效果（描边、阴影）。
- 中文标点行首禁则未做；预览会把标点留在行首。真排版以 `sscore/textfit` 为准。
