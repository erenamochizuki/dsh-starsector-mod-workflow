package sscore;

/**
 * 界面默认值（HOUSE 规范）：颜色是 0xRRGGBB，字号/间距按 1024x700 基准。
 * 预览与游戏共用这一份，避免“预览好看、实机变样”。
 */
public final class Tokens {
    private Tokens() {
    }

    public static final int BG = 0x0B131B;
    public static final int PANEL = 0x101C26;
    public static final int BORDER = 0x27414F;
    public static final int TEXT = 0xD6DEE6;
    public static final int DIM = 0x8A98A6;
    public static final int GOLD = 0xE8C87A;
    public static final int DANGER = 0xD86060;
    public static final int OK = 0x70C090;

    public static final float FONT_L = 25f;
    public static final float FONT_M = 22f;
    public static final float FONT_S = 19f;

    public static final float GAP_XS = 4f;
    public static final float GAP_S = 8f;
    public static final float GAP_M = 12f;
    public static final float GAP_L = 20f;

    public static final float BTN_H = 32f;
    public static final float BTN_H_SMALL = 28f;
    public static final float ROW_H = 24f;
    public static final float PAD_PANEL = 8f;

    /** 线性混色，t=0 取 a，t=1 取 b。 */
    public static int mix(int a, int b, float t) {
        float k = Math.max(0f, Math.min(1f, t));
        int r = Math.round(((a >> 16) & 0xFF) * (1f - k) + ((b >> 16) & 0xFF) * k);
        int g = Math.round(((a >> 8) & 0xFF) * (1f - k) + ((b >> 8) & 0xFF) * k);
        int bl = Math.round((a & 0xFF) * (1f - k) + (b & 0xFF) * k);
        return (r << 16) | (g << 8) | bl;
    }

    /** 加 alpha 通道，便于 GL 直接取 0xAARRGGBB。 */
    public static int withAlpha(int rgb, int alpha) {
        return ((alpha & 0xFF) << 24) | (rgb & 0xFFFFFF);
    }
}
