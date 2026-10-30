# 两个 dialog 接口：先选路线，再写代码

来源：`starfarer.api.zip`（用 `node Script\api-src.mjs <类名>` 复核）。
本笔记只记“怎么选、怎么连”，成员签名以源码为准。

## 1. 两条路线

| 路线 | 入口 | 实现接口 | 适用 | 游戏给什么 |
|---|---|---|---|---|
| **native** | `showCustomDialog(w, h, delegate)` | `CustomDialogDelegate` | 表单、选项、确认框、少量原生控件 | 自带确认/取消按钮、Esc、回调 |
| **visual** | `showCustomVisualDialog(w, h, delegate)` | `CustomVisualDialogDelegate` | 自绘面板、每帧交互、列表+滚动+拖拽 | 只给你面板与每帧回调，输入自己处理 |

`native` 想放复杂自绘内容，仍要 `getCustomPanelPlugin()` 返回插件；只是外壳由游戏管。
`visual` 想放原生控件，用 `CustomPanelAPI.createUIElement` + `wrapTooltipWithBox`（见 `ui-native-controls.md`）。

两个接口**没有继承关系**，不能互传：

```
InteractionDialogAPI.java:60   void showCustomDialog(float w, float h, CustomDialogDelegate delegate);
InteractionDialogAPI.java:106  void showCustomVisualDialog(float w, float h, CustomVisualDialogDelegate delegate);
```

反例：旧案例 `C11.md:44` 把 `CustomVisualDialogDelegate` 实例传给 `showCustomDialog`，类型不成立。

## 2. native 侧

```
CustomDialogDelegate.java:14  void createCustomDialog(CustomPanelAPI panel, CustomDialogCallback callback);
CustomDialogDelegate.java:20  boolean hasCancelButton();
CustomDialogDelegate.java:21  String getConfirmText();
CustomDialogDelegate.java:22  String getCancelText();
CustomDialogDelegate.java:23  void customDialogConfirm();
CustomDialogDelegate.java:24  void customDialogCancel();
CustomDialogDelegate.java:25  CustomUIPanelPlugin getCustomPanelPlugin();
CustomDialogDelegate.java:11  void dismissCustomDialog(int option);   // 0 确认，1 取消
```

- 写 `BaseCustomDialogDelegate`（`campaign/BaseCustomDialogDelegate.java`）省空实现，只覆写用到的。
- 确认/取消文案走 `getConfirmText()` / `getCancelText()`，不要自己在面板里再画一套按钮。
- `hasCancelButton()` 为 false 时 Esc 仍会触发 `customDialogCancel()`（源码注释 `CustomDialogDelegate.java:17`）。

## 3. visual 侧

```
CustomVisualDialogDelegate.java:11  void init(CustomPanelAPI panel, DialogCallbacks callbacks);
CustomVisualDialogDelegate.java:12  CustomUIPanelPlugin getCustomPanelPlugin();
CustomVisualDialogDelegate.java:13  float getNoiseAlpha();
CustomVisualDialogDelegate.java:14  void advance(float amount);
CustomVisualDialogDelegate.java:15  void reportDismissed(int option);
CustomVisualDialogDelegate.java:8   void dismissDialog();          // DialogCallbacks
CustomVisualDialogDelegate.java:9   FaderUtil getPanelFader();     // DialogCallbacks
```

- `getCustomPanelPlugin()` 返回的面板插件负责 `render*` 与 `processInput`（见 `ui-input.md`）。
- 收尾只做一次：`callbacks.dismissDialog()` → 游戏回调 `reportDismissed(option)`。
- 官方示例：`SwordOfEventide.java:194/202`、`EventTestPluginImpl.java:164/168`（均 1024×700）。

## 4. 尺寸

官方调用用 `1024 × 700`。设计稿（如 1500×900）不能直接当参数：先按面板逻辑宽高布局，再让 `Layout` 按实际 `PositionAPI` 缩放。
不要把 1500/900 写进代码常量；在 SPEC 里写“目标宽高比”，由布局层算。

## 5. 选择判据（写进 SPEC）

- 需要游戏标准确认/取消按钮、Esc、少量原生控件 → native。
- 需要全屏自绘、列表滚动、拖拽、每帧动画 → visual。
- 两者都要 → visual + `createUIElement` 组合原生控件；别混用两个 delegate。
