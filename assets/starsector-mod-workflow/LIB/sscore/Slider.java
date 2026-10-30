package sscore;

/** 数值滑块：只管值、步进、夹紧和把手位置；输入由 InputRouter/调用方驱动。 */
public final class Slider {
    private final float min;
    private final float max;
    private final float step;
    private float value;

    public Slider(float min, float max, float step) {
        if (max < min) throw new IllegalArgumentException("max < min");
        if (step <= 0f) throw new IllegalArgumentException("step <= 0");
        this.min = min;
        this.max = max;
        this.step = step;
        this.value = min;
    }

    public float min() {
        return min;
    }

    public float max() {
        return max;
    }

    public float step() {
        return step;
    }

    public float value() {
        return value;
    }

    /** 设值：先对齐到步进，再夹到 [min,max]。 */
    public void setValue(float v) {
        float snapped = min + Math.round((v - min) / step) * step;
        this.value = Math.max(min, Math.min(max, snapped));
    }

    /** 按步进加减一格；到边界返回 false，方便调用方决定是否播音效。 */
    public boolean nudge(int direction) {
        float before = value;
        setValue(value + direction * step);
        return value != before;
    }

    /** 0..1 位置，用于画轨道与把手。 */
    public float fraction() {
        if (max == min) return 0f;
        return (value - min) / (max - min);
    }

    /** 按拖动位置（0..1）设值。 */
    public void setFraction(float f) {
        float clamped = Math.max(0f, Math.min(1f, f));
        setValue(min + clamped * (max - min));
    }

    /** 把手矩形：轨道横坐标 trackX、宽 trackW，把手宽 knobW，高度垂直居中于 track。 */
    public Rect knob(Rect track, float knobW) {
        float cx = track.x + track.w * fraction();
        float kx = Math.max(track.x, Math.min(track.x + track.w - knobW, cx - knobW / 2f));
        return new Rect(kx, track.y, knobW, track.h);
    }
}
