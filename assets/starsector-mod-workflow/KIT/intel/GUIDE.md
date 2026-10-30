# 情报条目（intel）

用 BaseIntelPlugin 提供列表与正文。addIntel 管理情报显示，不自动把该实例注册为战役 EveryFrameScript。

## 步骤

1. 使用 Moci 的 Script/moci.mjs new intel 预览并按需生成骨架。
2. 确认图标资源存在，在 createIntelInfo 写列表摘要，在 createSmallDescription 写正文。
3. 只创建一个实例并 addIntel(instance)。若需要 advanceImpl、倒计时或 endAfterDelay 的时间推进，再 addScript(instance)，两处必须是同一实例；纯静态情报不必注册推进脚本。
4. 推进逻辑优先覆写 advanceImpl，保留 BaseIntelPlugin.advance 的结束计时。结束、列表移除和额外监听器清理分别核对。
5. 实测显示、正文、暂停、倒计时结束、离开／重入以及存档读取；endAfterDelay 后的标记结束不一定等于立即从列表消失，还取决于 shouldRemoveIntel 等策略。

## 生命周期

普通 sector 脚本随存档保存时，不应每次 onGameLoad 再重复添加；临时脚本／监听器在载入时按设计重挂并去重。移除 Intel 不应被当作所有脚本与监听器已自动释放的保证。

不要每帧重建 UI 或反复新增 Intel。按事件发送更新，按需要保留历史记录。详细检查项见 REF/moci-tutorial-checklist.md（主 skill 目录）。
