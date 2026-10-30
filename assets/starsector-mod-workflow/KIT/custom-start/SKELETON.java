package {{PACKAGE}};

import com.fs.starfarer.api.BaseModPlugin;
import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.campaign.CampaignFleetAPI;

/**
 * {{NAME}} 的开局定制。
 *
 * onNewGame 在星区生成后调用一次；只加"每个新档都该有"的东西。
 * 不要在这里读档状态（此时还没有存档），也不要在 onGameLoad 里重复发奖励。
 */
public class {{CLASS}} extends BaseModPlugin {

    @Override
    public void onNewGame() {
        CampaignFleetAPI fleet = Global.getSector().getPlayerFleet();
        if (fleet == null) return;

        // FILL: 船/货/钱；variant id 必须真实存在，找不到会在开局报错而不是静默跳过。
        fleet.getFleetData().addFleetMember("{{ID}}_start");

        // FILL: 需要的话再给钱；数值与 SPEC 一致。
        fleet.getCargo().getCredits().add(50000);
    }
}
