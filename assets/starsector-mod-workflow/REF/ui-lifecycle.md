# visual dialog 生命周期

来源：`starfarer.api.zip` 的 `DuelDialogDelegate`（83 行）与 `SwordOfEventide` 调用点。

## 1. 时序

```
dialog.showCustomVisualDialog(w, h, delegate)
        │  InteractionDialogAPI.java:106
        ▼
delegate.init(panel, callbacks)         CustomVisualDialogDelegate.java:11
        │  callbacks.getPanelFader().setDurationOut(...)
        ▼
每帧：delegate.advance(amount)          :14
      plugin.renderBelow/render(alpha)  CustomUIPanelPlugin
      plugin.processInput(events)       :42
        │  需要收尾时：
        ├─ callbacks.getPanelFader().fadeOut()
        └─ 淡出完成 → callbacks.dismissDialog()        :8
        ▼
delegate.reportDismissed(option)        :15   ← 唯一结算点
```

官方实现：`DuelDialogDelegate.java:36-47`（init）、`:51-63`（advance 里等 `endDelay`、fadeOut、`isFadedOut()` 后 dismiss、`finished` 防重入）、`:64-80`（reportDismissed）。

## 2. 规矩

1. **结算只写一次**，放在 `reportDismissed(int option)`。`option` 是调用方传的值（官方示例里常为 0）。
2. `dismissDialog()` 只能触发一次：用 `boolean finished`（`DuelDialogDelegate.java:16/52/59`）。
3. 淡出用 `callbacks.getPanelFader()`：先 `setDurationOut(2f)`，再 `fadeOut()`，`isFadedOut()` 为真才 dismiss。不设时长会“咔”地消失。
4. `reportDismissed` 可能在没有 memoryMap 的测试路径被调用（`DuelDialogDelegate.java:68` 注释），先判空。
5. `advance()` 只做状态推进与收尾判断；绘制在 `render*()`；不要把重计算塞进每帧。
6. 不要在 `reportDismissed` 里再弹一个新 dialog（重入）；把“下一步”交给调用方（rule 命令/对话选项）。

## 3. 与 Moci 俘虏页的对应

- 打开：能力按钮 → `showCustomVisualDialog(w, h, delegate)`。
- 每帧：`advance()` 里滑块的拖动应迁移到 `processInput` 的事件；`advance` 只做缓动/计时。
- 确认/取消：按钮只设结果字段，然后 `dismissDialog()`；真正扣好感、给通缉、清俘虏在 `reportDismissed`。
- 若 UI 要“先淡出再结算”，别在 `advance` 里直接改存档（可能重复触发）。

## 4. 检查清单（交接给 GATE）

- [ ] `getCustomPanelPlugin()` 非空且返回同一实例。
- [ ] `init` 里设置了 fader 时长。
- [ ] dismiss 有防重入。
- [ ] `reportDismissed` 判空 memoryMap。
- [ ] 结算无重复（点两次确认只扣一次）。
