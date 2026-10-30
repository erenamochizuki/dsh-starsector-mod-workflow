# 原生控件放进面板：TooltipMakerAPI 组合法

来源：`starfarer.api.zip`。复核命令：`node Script\api-src.mjs CustomPanelAPI`、`TooltipMakerAPI`、`CodexCustomEntryExample`。

## 1. 五步

官方做法（`CodexCustomEntryExample.java:75-90` 起）：

```java
TooltipMakerAPI text = panel.createUIElement(width, 0, false); // 0 高 + false：按内容撑高
text.setParaFont("..."); // 或 setParaFontDefault / setParaSmallInsignia
text.addPara("第一段", 0f);
text.addPara("%s 与 %s", 10f, hl, "甲", "乙"); // highlights 按 %s 顺序传
panel.updateUIElementSizeAndMakeItProcessInput(text);
UIPanelAPI box = panel.wrapTooltipWithBox(text);   // 加背景框并让内部控件可交互
panel.addComponent(box).inTL(0, 0);               // 放进父面板左上
```

- `createUIElement(float width, float height, boolean withScroller)`（`CustomPanelAPI.java:11`）：高度传 0 表示由内容决定；`withScroller=true` 才有滚动条。
- `updateUIElementSizeAndMakeItProcessInput(TooltipMakerAPI)`（`:27`）：必须调，否则控件不接收输入。
- `wrapTooltipWithBox(...)` 三个重载（`:23-25`），可传边距与颜色。
- `addComponent(UIComponentAPI)`（`UIPanelAPI.java:5`）返回 `PositionAPI`，用 `inTL/inTR/inBL/inBR`（`PositionAPI.java:20-27`）定位。

## 2. 常用控件

| 方法 | 位置 |
|---|---|
| `LabelAPI addTitle(String)` | `TooltipMakerAPI.java:79` |
| `LabelAPI addTitle(String, Color)` | `:114` |
| `LabelAPI addPara(String, float pad)` | `:89` |
| `LabelAPI addPara(String str, Color color, float pad)` | `:90` |
| `LabelAPI addPara(String format, float pad, Color hl, String... highlights)` | `:88` |
| `LabelAPI addPara(String format, float pad, Color color, Color hl, String... highlights)` | `:198` |
| `LabelAPI addSectionHeading(String, Alignment, float)` | `:91` |
| `void addImage(String spriteName, float pad)` | `:117` |
| `void addImage(String, float w, float h, float pad)` | `:211` |
| `ButtonAPI addButton(String text, Object data, float w, float h, float pad)` | `:203` |
| `void addCustom(UIComponentAPI, float pad)` | `:209` |
| `UIComponentAPI addSpacer(float height)` | `:227` |

## 3. 坑

- `addPara` 的 highlights 是**替换 `%s` 的参数**，不是富文本；参数个数与 `%s` 不一致会错位。
- 自定义面板里放了 `createUIElement` 后，父面板 `processInput` 里的事件判断要避开控件区域；否则按钮点不到、列表误拖。
- 高度 0 只在 `updateUIElementSizeAndMakeItProcessInput` 之后才可靠；先量后排版会得到 0。
- 换行与宽度由 `TooltipMakerAPI` 管；不要自己按字符数折断中文（`textfit` 负责测量，但原生控件优先）。
- 原生控件路线**不需要** `getCustomPanelPlugin()` 返回非空，除非同面板还有自绘内容。

## 4. 何时不用

- 整页都要自绘（俘虏页三栏 + 24 项列表 + 拖拽滑块）→ 自绘，别拼原生。
- 只需要几个按钮/一段说明 → native dialog 或本方法，别自己画按钮。
