package {{PACKAGE}};

import com.fs.starfarer.api.campaign.CustomDialogDelegate;
import com.fs.starfarer.api.campaign.CustomUIPanelPlugin;
import com.fs.starfarer.api.ui.CustomPanelAPI;
import com.fs.starfarer.api.ui.TooltipMakerAPI;

/**
 * {{NAME}}
 *
 * 原生控件页面：文字与按钮都交给引擎排版，自己不算坐标。
 * 确认/取消由对话框统一处理，逻辑分别落在 customDialogConfirm / customDialogCancel。
 */
public class {{CLASS}} implements CustomDialogDelegate {

    @Override
    public void createCustomDialog(CustomPanelAPI panel, CustomDialogCallback callback) {
        // FILL: 把 600x400 换成 SPEC 里的尺寸；withScroller=true 让正文自动滚。
        TooltipMakerAPI text = panel.createUIElement(600f, 400f, true);

        text.addPara("{{NAME}}", 10f);
        // FILL: 需要可点选项时用 text.addButton("文本", 回调对象, 宽, 高, 0f)，
        // 回调对象在 advance 里用 isChecked() 消费一次；不要用像素坐标判断命中。
        text.addPara("等待填写内容。", 5f);

        panel.updateUIElementSizeAndMakeItProcessInput(text);
    }

    @Override
    public boolean hasCancelButton() {
        return true;
    }

    @Override
    public String getConfirmText() {
        return "确定";
    }

    @Override
    public String getCancelText() {
        return "取消";
    }

    @Override
    public void customDialogConfirm() {
        // FILL: 确认后的持久化；只在这里写一次，不要在按钮回调里重复写。
    }

    @Override
    public void customDialogCancel() {
        // FILL: 取消时清理临时状态。
    }

    @Override
    public CustomUIPanelPlugin getCustomPanelPlugin() {
        // 纯原生控件页面不需要额外插件。
        return null;
    }
}
