# 输入：事件驱动，不轮询

来源：`starfarer.api.zip`。用 `node Script\api-src.mjs InputEventAPI`、`CustomUIPanelPlugin` 复核。

## 1. 接口说明（源码注释要点）

`CustomUIPanelPlugin.java:32-42`：

- 每帧事件列表里**几乎总有一个 mouse move**。
- 被处理的事件要 `consume()`。
- mouse move 一般**不要**消费。
- 处理循环必须先跳过已消费事件（`isConsumed()`）。
- **访问已消费事件的数据会抛异常。**

## 2. InputEventAPI 常用方法

```
InputEventAPI.java:11  boolean isConsumed();
InputEventAPI.java:12  void consume();
InputEventAPI.java:21  boolean isLMBDownEvent();
InputEventAPI.java:24  boolean isLMBUpEvent();
InputEventAPI.java:27  boolean isMouseMoveEvent();
InputEventAPI.java:28  boolean isMouseScrollEvent();
InputEventAPI.java:4   int getEventValue();   // 滚轮/按键值
InputEventAPI.java:5   int getX();
InputEventAPI.java:6   int getY();
InputEventAPI.java:15  boolean isMouseEvent();
InputEventAPI.java:16  boolean isKeyboardEvent();
InputEventAPI.java:30  boolean isShiftDown();  // 还有 ctrl/alt
```

## 3. 正确骨架

```java
public void processInput(List<InputEventAPI> events) {
    if (p == null) return;
    for (InputEventAPI e : events) {
        if (e.isConsumed()) continue;
        if (e.isMouseMoveEvent()) {
            mouseX = e.getX();
            mouseY = e.getY();
            continue;                     // 不消费移动
        }
        if (!p.containsEvent(e)) continue; // 事件在面板外，交还给游戏
        if (e.isLMBDownEvent()) { onDown(e.getX(), e.getY()); e.consume(); }
        else if (e.isMouseScrollEvent()) { onWheel(e.getEventValue()); e.consume(); }
    }
}
```

依据：`ExampleCustomUIPanel.java:36-53`（跳过已消费、mouse move、`p.containsEvent`）。
`PositionAPI.java:16 boolean containsEvent(InputEventAPI event)`。

## 4. 拖拽

- 按下记 `dragStartX/Y` 与当前值；移动只更新；抬起清状态。
- 抬起事件可能落在面板外：拖拽中不要用 `containsEvent` 拦 LMB up，先判断 `dragging`。
- 不消费 mouse move，否则面板外的悬停/提示会失灵。

## 5. 反例（Moci mod）

- `ap_PrisonUI.java:92` `Mouse.isButtonDown(...)`、`:192` `Mouse.getDWheel()` 在 `advance()` 里轮询；
  `:249-251` 注释自认“全部动作走 advance 里的鼠标轮询”，`:254-256` `processInput` 空实现。
- `ap_ExchangeUI.java:392/444/475/483` 同类。
- 后果：多面板/对话打开时输入穿透、滚轮同时滚两层、无法被上层消费。

规则：`Mouse`/`Keyboard` 只允许出现在 `LIB` 的 `inputrouter` 内部；业务代码一律走事件。

## 6. 坐标

- 事件坐标是屏幕坐标；面板位置由 `PositionAPI`（`getX/Y/Width/Height`）给。
- 不要假设左上原点；用 `containsEvent`、`inTL` 系列定位，别手算翻转。
