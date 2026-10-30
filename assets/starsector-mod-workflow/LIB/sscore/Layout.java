package sscore;

/** 把一块区域切成行/列。除了最后一行/列，前面都严格按分配值摆放，间隔单独扣。 */
public final class Layout {
    private Layout() {
    }

    /** 等高切成 count 行，行间留 gap。 */
    public static Rect[] rows(Rect area, int count, float gap) {
        if (count <= 0) return new Rect[0];
        float[] weights = new float[count];
        for (int i = 0; i < count; i++) weights[i] = 1f;
        return rows(area, weights, gap);
    }

    /** 按权重比例切行；权重总和为 0 时退化成等高。 */
    public static Rect[] rows(Rect area, float[] weights, float gap) {
        int n = weights.length;
        Rect[] out = new Rect[n];
        if (n == 0) return out;
        float total = sum(weights);
        if (total <= 0f) {
            for (int i = 0; i < n; i++) weights[i] = 1f;
            total = n;
        }
        float usable = Math.max(0f, area.h - gap * (n - 1));
        float y = area.y;
        for (int i = 0; i < n; i++) {
            float h = usable * weights[i] / total;
            out[i] = new Rect(area.x, y, area.w, h);
            y += h + gap;
        }
        return out;
    }

    /** 按权重比例切列；权重总和为 0 时退化成等宽。 */
    public static Rect[] cols(Rect area, float[] weights, float gap) {
        int n = weights.length;
        Rect[] out = new Rect[n];
        if (n == 0) return out;
        float total = sum(weights);
        if (total <= 0f) {
            for (int i = 0; i < n; i++) weights[i] = 1f;
            total = n;
        }
        float usable = Math.max(0f, area.w - gap * (n - 1));
        float x = area.x;
        for (int i = 0; i < n; i++) {
            float w = usable * weights[i] / total;
            out[i] = new Rect(x, area.y, w, area.h);
            x += w + gap;
        }
        return out;
    }

    /** 等宽切成 count 列。 */
    public static Rect[] cols(Rect area, int count, float gap) {
        if (count <= 0) return new Rect[0];
        float[] weights = new float[count];
        for (int i = 0; i < count; i++) weights[i] = 1f;
        return cols(area, weights, gap);
    }

    private static float sum(float[] a) {
        float s = 0f;
        for (float v : a) s += v;
        return s;
    }
}
