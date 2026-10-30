package {{PACKAGE}};

import com.fs.starfarer.api.EveryFrameScript;
import com.fs.starfarer.api.Global;

/**
 * {{NAME}}
 *
 * 存档数据的注册与结算骨架：只在跨日/跨月时改状态，不每帧刷 UI。
 * 读档后由 modplugin 重新注册；注册前必须判重。
 */
public class {{CLASS}} implements EveryFrameScript {

    public static final String KEY = "${{ID}}_state";
    public static final String LAST_DAY = "${{ID}}_last_day";

    private boolean done = false;

    @Override
    public boolean isDone() {
        return done;
    }

    @Override
    public boolean runWhilePaused() {
        return false;
    }

    @Override
    public void advance(float amount) {
        if (done) return;

        float days = Global.getSector().getClock().convertToDays(amount);
        long today = Global.getSector().getClock().getDay();

        Object last = Global.getSector().getMemoryWithoutUpdate().get(LAST_DAY);
        if (last instanceof Long && (Long) last == today) return;

        Global.getSector().getMemoryWithoutUpdate().set(LAST_DAY, today);

        // FILL: 这里做一次每日结算；需要每月再按 getMonth() 分一层，别用计时器猜。
        settleDay();
    }

    /** FILL: 每日一次的结算；方法保持幂等，读档重放也不会多发奖励。 */
    private void settleDay() {
        // 例：Global.getSector().getMemoryWithoutUpdate().set(KEY + "_counter", 0);
    }
}
