package {{PACKAGE}};

import com.fs.starfarer.api.campaign.BaseCustomUIPanelPlugin;
import com.fs.starfarer.api.campaign.CustomUIPanelPlugin;
import com.fs.starfarer.api.campaign.CustomVisualDialogDelegate;
import com.fs.starfarer.api.ui.CustomPanelAPI;

/**
 * {{NAME}}
 *
 * 自绘页面骨架：构建放在 init，输入结算放在 advance，关闭后的数据写回放在 reportDismissed。
 * 不要重写 processInput 再自己判命中；事件消费交给 sscore.InputRouter。
 */
public class {{CLASS}} extends BaseCustomUIPanelPlugin implements CustomVisualDialogDelegate {

    private CustomPanelAPI panel;
    private CustomVisualDialogDelegate.DialogCallbacks callbacks;
    private boolean dismissed = false;

    @Override
    public void init(CustomPanelAPI panel, DialogCallbacks callbacks) {
        this.panel = panel;
        this.callbacks = callbacks;

        // FILL: 只在这里建一次控件/登记命中区；尺寸来自 SPEC，不要散落魔法数。
    }

    @Override
    public CustomUIPanelPlugin getCustomPanelPlugin() {
        return this;
    }

    @Override
    public float getNoiseAlpha() {
        return 0.5f;
    }

    @Override
    public void advance(float amount) {
        super.advance(amount);
        if (dismissed) return;

        // FILL: 每帧最多结算一次输入（拖动/滚轮/键盘）；结果写回状态，不直接改存档。
    }

    @Override
    public void reportDismissed(int option) {
        dismissed = true;
        // FILL: 确认（0）/取消（1）后的持久化；这里只写一次。
    }
}
