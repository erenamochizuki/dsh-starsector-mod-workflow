package {{PACKAGE}};

import java.util.List;

import com.fs.starfarer.api.combat.BaseEveryFrameCombatPlugin;
import com.fs.starfarer.api.combat.CombatEngineAPI;
import com.fs.starfarer.api.input.InputEventAPI;

/**
 * {{NAME}}
 *
 * 武器每帧效果骨架：只拿到引擎与时间，不假设帧率。
 * 真正的触发条件写在 SPEC 的"行为"里，这里用注释标出唯一入口。
 */
public class {{CLASS}} extends BaseEveryFrameCombatPlugin {

    private CombatEngineAPI engine;
    private float elapsed = 0f;

    /** FILL: 触发间隔（秒）；0 表示每帧。 */
    private static final float INTERVAL = 0.1f;

    @Override
    public void init(CombatEngineAPI engine) {
        this.engine = engine;
    }

    @Override
    public void advance(float amount, List<InputEventAPI> events) {
        if (engine == null || engine.isPaused()) return;

        elapsed += amount;
        if (elapsed < INTERVAL) return;
        elapsed = 0f;

        // FILL: 这里做一次效果。需要"每发弹"就用射弹上的挂钩，不要遍历全引擎弹体。
    }
}
