package {{PACKAGE}};

import com.fs.starfarer.api.impl.campaign.econ.impl.BaseIndustry;

/**
 * {{NAME}}
 *
 * 殖民地产业骨架：只有 apply/unapply 一对出入口。
 * 产业等级、供需、建筑需求都从 SPEC 的数值要求来；不要按市场大小临时乘系数。
 */
public class {{CLASS}} extends BaseIndustry {

    @Override
    public void apply() {
        // 注意：BaseIndustry 没有替你实现 apply()，所以不能调 super.apply()。
        // FILL: 声明产出/需求；每条都要能在 unapply 里按同一个 key 撤掉。
        // getSupply("ore").getQuantity().modifyFlat(getModId(), 2, "{{NAME}}");
    }

    @Override
    public void unapply() {
        super.unapply();

        // FILL: 与 apply 成对撤销；缺一条就会在拆除后留下幽灵产能。
        // getSupply("ore").getQuantity().unmodifyFlat(getModId());
    }

    @Override
    public String getCurrentImage() {
        // FILL: 产业图标路径；确认文件真实存在。
        return "graphics/industry/{{ID}}.png";
    }
}
