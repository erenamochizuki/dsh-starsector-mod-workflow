package {{PACKAGE}};

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.campaign.FactionAPI;

/**
 * {{NAME}} 的运行时助手。
 *
 * 势力本体是 data/world/factions/{{ID}}.faction；这个类只做运行时的关系/颜色调整。
 * 不要在静态初始化里改全局状态，读档/重载会重复执行。
 */
public final class {{CLASS}} {

    private {{CLASS}}() {
    }

    /** 势力未加载时返回 null；调用方要自己判空。 */
    public static FactionAPI get() {
        if (Global.getSector() == null) return null;
        return Global.getSector().getFaction("{{ID}}");
    }

    /** FILL: 按 SPEC 填关系；数值 -1 敌对 … 1 友好。 */
    public static void setRelation(String otherFactionId, float value) {
        FactionAPI f = get();
        if (f == null) return;
        f.setRelationship(otherFactionId, value);
    }
}
