package sscore;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * 带权抽取 + 单目标封顶。权重 0 的条目永不命中；cap<0 表示不限次。
 * 随机源从外部传入，测试可固定种子复现。
 */
public final class Weighted<T> {
    private static final class Option<T> {
        final T item;
        final int weight;
        final int cap;
        int picked;

        Option(T item, int weight, int cap) {
            this.item = item;
            this.weight = weight;
            this.cap = cap;
        }

        boolean available() {
            return weight > 0 && (cap < 0 || picked < cap);
        }
    }

    private final Random rng;
    private final List<Option<T>> options = new ArrayList<Option<T>>();

    public Weighted(Random rng) {
        if (rng == null) throw new IllegalArgumentException("rng == null");
        this.rng = rng;
    }

    public void add(T item, int weight, int cap) {
        if (weight < 0) throw new IllegalArgumentException("weight < 0");
        options.add(new Option<T>(item, weight, cap));
    }

    public int picked(T item) {
        for (Option<T> o : options) if (o.item.equals(item)) return o.picked;
        return 0;
    }

    public boolean exhausted() {
        return availableWeight() <= 0;
    }

    public int availableWeight() {
        int total = 0;
        for (Option<T> o : options) if (o.available()) total += o.weight;
        return total;
    }

    /** 抽一个；全部不可用时返回 null。 */
    public T pick() {
        int total = availableWeight();
        if (total <= 0) return null;
        int roll = rng.nextInt(total);
        for (Option<T> o : options) {
            if (!o.available()) continue;
            if (roll < o.weight) {
                o.picked++;
                return o.item;
            }
            roll -= o.weight;
        }
        return null;
    }
}
