package sscore;

import java.util.HashMap;
import java.util.Map;

/**
 * 每日次数：key 是能力/事件名，day 是游戏内的绝对天数（Cycle*365+月日 之类调用方算）。
 * 跨日自动清零，存档只需要存 counts/days 两张表。
 */
public final class Daily {
    private final Map<String, Integer> counts = new HashMap<String, Integer>();
    private final Map<String, Integer> days = new HashMap<String, Integer>();

    /** 当天已用次数；换天视为 0（不清表，读写时判断）。 */
    public int used(String key, int day) {
        Integer d = (Integer) days.get(key);
        if (d == null || d.intValue() != day) return 0;
        Integer c = (Integer) counts.get(key);
        return c == null ? 0 : c.intValue();
    }

    public int remaining(String key, int day, int max) {
        return Math.max(0, max - used(key, day));
    }

    public boolean allow(String key, int day, int max) {
        return used(key, day) < max;
    }

    /** 记一次；调用方应先用 allow() 判断。 */
    public void use(String key, int day) {
        if (!allow(key, day, Integer.MAX_VALUE)) return;
        counts.put(key, used(key, day) + 1);
        days.put(key, day);
    }

    /** 读档恢复：直接设当天已用次数。 */
    public void setUsed(String key, int day, int n) {
        days.put(key, day);
        counts.put(key, Math.max(0, n));
    }

    public void clear() {
        counts.clear();
        days.clear();
    }
}
