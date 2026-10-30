package {{PACKAGE}};

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.campaign.CampaignFleetAPI;
import com.fs.starfarer.api.impl.campaign.abilities.BaseAbilityPlugin;

/**
 * {{NAME}}
 *
 * 能力按钮的完整流程：可用性 → 冷却 → 生效 → 冷却回落。
 * 数值全部来自 SPEC；不要在这里写第二套冷却逻辑。
 */
public class {{CLASS}} extends BaseAbilityPlugin {

    /** FILL: 冷却天数，与 SPEC 数值要求一致。 */
    private static final float COOLDOWN_DAYS = 30f;

    private float cooldownLeft = 0f;

    @Override
    public void activate() {
        if (isOnCooldown()) return;
        super.activate();

        CampaignFleetAPI fleet = Global.getSector().getPlayerFleet();
        if (fleet == null) return;

        // FILL: 能力真正做的事。只改舰队/星区状态，不开界面。
        fleet.getMemoryWithoutUpdate().set("${{ID}}_used", true);

        setCooldownLeft(COOLDOWN_DAYS);
    }

    @Override
    public void advance(float amount) {
        super.advance(amount);
        if (cooldownLeft > 0f) {
            cooldownLeft = Math.max(0f, cooldownLeft - amount);
        }
    }

    @Override
    public float getCooldownFraction() {
        if (cooldownLeft <= 0f) return 0f;
        return Math.min(1f, cooldownLeft / COOLDOWN_DAYS);
    }

    @Override
    public void setCooldownLeft(float days) {
        cooldownLeft = Math.max(0f, days);
    }

    @Override
    public float getCooldownLeft() {
        return cooldownLeft;
    }
}
