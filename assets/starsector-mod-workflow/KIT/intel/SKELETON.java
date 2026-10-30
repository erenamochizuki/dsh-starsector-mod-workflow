package {{PACKAGE}};

import com.fs.starfarer.api.campaign.comm.IntelInfoPlugin;
import com.fs.starfarer.api.impl.campaign.intel.BaseIntelPlugin;
import com.fs.starfarer.api.ui.TooltipMakerAPI;

/**
 * {{NAME}}
 *
 * 情报条目骨架：图标 / 列表行 / 正文三段，别在 advance 里刷新界面。
 */
public class {{CLASS}} extends BaseIntelPlugin {

    @Override
    public String getIcon() {
        // FILL: 40x40 图标路径；确认文件真实存在。
        return "graphics/icons/intel/important.png";
    }

    @Override
    public String getSmallDescriptionTitle() {
        return "{{NAME}}";
    }

    @Override
    public void createIntelInfo(TooltipMakerAPI info, IntelInfoPlugin.ListInfoMode mode) {
        // 情报列表里的一行；保持一句话，不要换行。
        info.addPara(getSmallDescriptionTitle(), 0f);
    }

    @Override
    public void createSmallDescription(TooltipMakerAPI info, float width, float height) {
        // FILL: 正文；用 width 控制换行，不要手写像素坐标。
        info.addPara("等待填写正文。", 10f);
    }
}
