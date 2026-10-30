package {{PACKAGE}};

import java.util.List;
import java.util.Map;

import com.fs.starfarer.api.campaign.InteractionDialogAPI;
import com.fs.starfarer.api.campaign.rules.MemoryAPI;
import com.fs.starfarer.api.impl.campaign.rulecmd.BaseCommandPlugin;
import com.fs.starfarer.api.util.Misc.Token;

/**
 * {{NAME}}
 *
 * 规则命令骨架：参数从 params 读，结果写 memory，返回 true/false 决定分支。
 * 不要在命令里直接弹新对话；要跳转就返回 false 让 rules.csv 走下一步。
 */
public class {{CLASS}} extends BaseCommandPlugin {

    @Override
    public boolean execute(String ruleId, InteractionDialogAPI dialog, List<Token> params, Map<String, MemoryAPI> memoryMap) {
        // FILL: 参数校验；缺参数时返回 false 并让 rules.csv 的失败分支处理。
        if (params.isEmpty()) return false;

        MemoryAPI memory = getEntityMemory(memoryMap);

        String arg = params.get(0).getString(memoryMap);
        if (arg == null || arg.isEmpty()) return false;

        // FILL: 真正效果；需要持久化就写 memory，不要只改局部变量。
        memory.set("${{ID}}_done", true);

        return true;
    }
}
