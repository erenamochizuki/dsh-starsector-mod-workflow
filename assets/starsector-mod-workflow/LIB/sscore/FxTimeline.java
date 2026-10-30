package sscore;

/**
 * 分阶段特效的时间轴：白闪 / 火球 / 光针 / 冲击波环 / 余温云。
 *
 * <p>只算数值，不画、不掷骰、不依赖游戏类，所以可以脱离游戏单测与出帧图。
 * 半径一律是「相对 R 的倍率」，调用方乘上自己的 R；时间单位是秒。
 *
 * <p>典型用法：
 * <pre>
 * Stage flash = new Stage(0.00f, 0.03f, 0.03f, 0.12f, 0.49f, 0.40f, 0.55f);
 * float a = flash.alpha(t);          // 0.55 → 0
 * float r = flash.radius(t) * R;     // 贴图半径
 * </pre>
 */
public final class FxTimeline {

    private FxTimeline() {
    }

    // ---------------- 数学 ----------------

    public static float clamp01(float v) {
        return v < 0f ? 0f : (v > 1f ? 1f : v);
    }

    /** 平滑阶跃：0→1 且两端导数为 0，用它做所有插值。 */
    public static float smooth(float k) {
        k = clamp01(k);
        return k * k * (3f - 2f * k);
    }

    /** t 在 [a,b] 里的归一化位置；b<=a 时视为阶跃。 */
    public static float ramp(float t, float a, float b) {
        if (b <= a) return t >= b ? 1f : 0f;
        return clamp01((t - a) / (b - a));
    }

    /** 0→1→0 的包络：a→b 升起、c→d 落回。 */
    public static float envelope(float t, float a, float b, float c, float d) {
        return smooth(ramp(t, a, b)) * (1f - smooth(ramp(t, c, d)));
    }

    /** 两个 0xRRGGBB 之间线性插值（四舍五入，与 Tokens.mix 一致）。 */
    public static int mixColor(int c0, int c1, float k) {
        k = clamp01(k);
        int r = (int) (((c0 >> 16) & 0xFF) + (((c1 >> 16) & 0xFF) - ((c0 >> 16) & 0xFF)) * k + 0.5f);
        int g = (int) (((c0 >> 8) & 0xFF) + (((c1 >> 8) & 0xFF) - ((c0 >> 8) & 0xFF)) * k + 0.5f);
        int b = (int) ((c0 & 0xFF) + ((c1 & 0xFF) - (c0 & 0xFF)) * k + 0.5f);
        return (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
    }

    private static int clampByte(int v) {
        return v < 0 ? 0 : (v > 255 ? 255 : v);
    }

    /**
     * 色表取色：pos 必须递增，pos[0]<=k<=pos[last]；越界自动夹到两端。
     * 火球从白热走到暗红就是一张这样的表。
     */
    public static int colorAt(float[] pos, int[] colors, float k) {
        if (pos == null || colors == null || pos.length == 0 || pos.length != colors.length) {
            throw new IllegalArgumentException("pos/colors 必须等长且非空");
        }
        k = clamp01(k);
        for (int i = 0; i < pos.length - 1; i++) {
            if (k <= pos[i + 1]) {
                float span = pos[i + 1] - pos[i];
                float f = span <= 0f ? 1f : (k - pos[i]) / span;
                return mixColor(colors[i], colors[i + 1], smooth(f));
            }
        }
        return colors[colors.length - 1];
    }

    // ---------------- 一层特效 ----------------

    /**
     * 一层：in 开始出现 → peak 最亮 → hold 保持 → end 归零；半径同时从 r0 平滑到 r1。
     * 不变量 in &lt;= peak &lt;= hold &lt; end，构造时就校验，别让写错的参数变成"什么都不显示"。
     */
    public static final class Stage {
        public final float in;
        public final float peak;
        public final float hold;
        public final float end;
        public final float r0;
        public final float r1;
        public final float alpha0;

        public Stage(float in, float peak, float hold, float end, float r0, float r1, float alpha0) {
            if (in < 0f) throw new IllegalArgumentException("in < 0");
            if (peak < in) throw new IllegalArgumentException("peak < in");
            if (hold < peak) throw new IllegalArgumentException("hold < peak");
            if (end <= hold) throw new IllegalArgumentException("end <= hold");
            if (alpha0 < 0f || alpha0 > 1f) throw new IllegalArgumentException("alpha0 不在 0..1");
            this.in = in;
            this.peak = peak;
            this.hold = hold;
            this.end = end;
            this.r0 = r0;
            this.r1 = r1;
            this.alpha0 = alpha0;
        }

        /** 整体推迟 start 秒、生命周期不变：三圈冲击波就是同一个 Stage 挪三个起点。 */
        public Stage delayed(float start) {
            if (start < 0f) throw new IllegalArgumentException("start < 0");
            return new Stage(in + start, peak + start, hold + start, end + start, r0, r1, alpha0);
        }

        public boolean active(float t) {
            return t >= in && t < end;
        }

        public float alpha(float t) {
            if (t < in || t >= end) return 0f;
            return alpha0 * smooth(ramp(t, in, peak)) * (1f - smooth(ramp(t, hold, end)));
        }

        public float radius(float t) {
            return r0 + (r1 - r0) * smooth(ramp(t, in, end));
        }
    }

    // ---------------- 火球专用：先涨后缩 ----------------

    /**
     * 火球半径：一出现就是 rStart（不在 0 慢慢长大，否则像"凭空冒出一个点"），
     * growEnd 冲到 1.0，保持到 shrinkStart，再缩到 rShrink 且停在 end。
     */
    public static float growShrinkRadius(float t, float growEnd, float shrinkStart, float end,
                                         float rStart, float rShrink) {
        if (t <= 0f) return rStart;
        if (t < growEnd) return rStart + (1f - rStart) * smooth(ramp(t, 0f, growEnd));
        if (t < shrinkStart) return 1f;
        return 1f + (rShrink - 1f) * smooth(ramp(t, shrinkStart, end));
    }

    /** 火球透明度：快速淡入，到 shrinkStart 后一路淡出到 0。 */
    public static float bodyAlpha(float t, float fadeIn, float shrinkStart, float end) {
        if (t < 0f || t >= end) return 0f;
        return smooth(ramp(t, 0f, fadeIn)) * (1f - smooth(ramp(t, shrinkStart, end)));
    }
}
