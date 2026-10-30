package {{PACKAGE}};

import com.fs.starfarer.api.combat.BaseHullMod;
import com.fs.starfarer.api.combat.MutableShipStatsAPI;
import com.fs.starfarer.api.combat.ShipAPI;
import com.fs.starfarer.api.combat.ShipAPI.HullSize;

/**
 * {{NAME}}
 *
 * 只做一件事：给装上的舰船加一条可验证的属性修正。
 * 多余的钩子先不要写，等 SPEC 里的行为条目真的需要再加。
 */
public class {{CLASS}} extends BaseHullMod {

    /** FILL: 修正幅度；数字必须与 SPEC 数值要求一致。 */
    private static final float BONUS = 10f;

    @Override
    public void applyEffectsBeforeShipCreation(HullSize hullSize, MutableShipStatsAPI stats, String id) {
        // FILL: 换成 SPEC 要求的那条属性；一条船插只改一条，便于定位。
        stats.getFluxDissipation().modifyPercent(id, BONUS);
    }

    @Override
    public String getDescriptionParam(int index, HullSize hullSize) {
        // 描述里的 {%s} 按这里的顺序填；返回 null 表示该占位没有参数。
        if (index == 0) return Math.round(BONUS) + "%";
        return null;
    }

    @Override
    public boolean isApplicableToShip(ShipAPI ship) {
        // FILL: 需要限制舰体/已有插件时在这里返回 false，并让 getUnapplicableReason 说清原因。
        return true;
    }

    @Override
    public String getUnapplicableReason(ShipAPI ship) {
        // FILL: 与 isApplicableToShip 的每个 false 分支一一对应；都允许时返回 null。
        return null;
    }
}
