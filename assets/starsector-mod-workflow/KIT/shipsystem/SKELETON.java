package {{PACKAGE}};

import com.fs.starfarer.api.combat.MutableShipStatsAPI;
import com.fs.starfarer.api.combat.ShipAPI;
import com.fs.starfarer.api.combat.ShipSystemAPI;
import com.fs.starfarer.api.impl.combat.BaseShipSystemScript;
import com.fs.starfarer.api.plugins.ShipSystemStatsScript;

/**
 * {{NAME}}
 *
 * STAT_MOD 型系统：按 effectLevel 缩放一条属性，开/关都对称地加减修正。
 * 属性必须与 SPEC 数值要求一致；一条系统只改一条属性，便于定位。
 */
public class {{CLASS}} extends BaseShipSystemScript {

    /** FILL: 满效果时的修正幅度（0.3 = +30%）。 */
    private static final float BONUS = 0.3f;

    @Override
    public void apply(MutableShipStatsAPI stats, String id, ShipSystemStatsScript.State state, float effectLevel) {
        // FILL: 换成 SPEC 要求的那条属性；effectLevel 从 0 渐变到 1，直接乘上去。
        stats.getMaxSpeed().modifyMult(id, 1f + BONUS * effectLevel);
    }

    @Override
    public void unapply(MutableShipStatsAPI stats, String id) {
        // 与 apply 成对：apply 里 modify 的每个 key，这里都要 unmodify。
        stats.getMaxSpeed().unmodifyMult(id);
    }

    @Override
    public String getInfoText(ShipSystemAPI system, ShipAPI ship) {
        // FILL: 系统条上的短说明；不需要就返回 null。
        return null;
    }
}
