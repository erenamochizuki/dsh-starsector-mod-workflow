package sscore;

/** 轴对齐矩形：布局、命中、滑块轨道都复用它。坐标原点在左上，右/下边界不含。 */
public final class Rect {
    public final float x, y, w, h;

    public Rect(float x, float y, float w, float h) {
        if (w < 0f || h < 0f) throw new IllegalArgumentException("宽高不能为负：" + w + "x" + h);
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    public float right() {
        return x + w;
    }

    public float bottom() {
        return y + h;
    }

    /** 屏幕坐标判断：左/上含，右/下不含，避免相邻矩形在公共边上双命中。 */
    public boolean contains(float px, float py) {
        return px >= x && px < right() && py >= y && py < bottom();
    }

    /** 四边同时向内收 d；收成负数时夹到 0。 */
    public Rect inset(float d) {
        return new Rect(x + d, y + d, Math.max(0f, w - 2f * d), Math.max(0f, h - 2f * d));
    }

    public boolean overlaps(Rect o) {
        return x < o.right() && o.x < right() && y < o.bottom() && o.y < bottom();
    }

    /** 交集；不相交时返回空矩形（宽高为 0），不返回 null。 */
    public Rect intersect(Rect o) {
        float nx = Math.max(x, o.x);
        float ny = Math.max(y, o.y);
        float nr = Math.min(right(), o.right());
        float nb = Math.min(bottom(), o.bottom());
        return new Rect(nx, ny, Math.max(0f, nr - nx), Math.max(0f, nb - ny));
    }

    public boolean isEmpty() {
        return w <= 0f || h <= 0f;
    }

    @Override
    public String toString() {
        return "Rect(" + x + "," + y + "," + w + "," + h + ")";
    }
}
