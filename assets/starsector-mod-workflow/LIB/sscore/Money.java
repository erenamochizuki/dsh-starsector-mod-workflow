package sscore;

/** 数字格式化：金额千分位、万/亿缩写、百分比、游戏日期。中文界面统一走这里。 */
public final class Money {
    private Money() {
    }

    /** 1234567 → "1,234,567"；负数保留符号。 */
    public static String credits(long v) {
        boolean neg = v < 0;
        String digits = Long.toString(neg ? -v : v);
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < digits.length(); i++) {
            if (i > 0 && (digits.length() - i) % 3 == 0) sb.append(',');
            sb.append(digits.charAt(i));
        }
        return neg ? "-" + sb : sb.toString();
    }

    /** 1.234 万/亿缩写，保留一位小数；不足一万用千分位。 */
    public static String shortCredits(long v) {
        long abs = Math.abs(v);
        String sign = v < 0 ? "-" : "";
        if (abs >= 100000000L) return sign + oneDecimal(abs / 10000000L) + "亿";
        if (abs >= 10000L) return sign + oneDecimal(abs / 1000L) + "万";
        return credits(v);
    }

    private static String oneDecimal(long tenths) {
        long whole = tenths / 10;
        long frac = tenths % 10;
        return frac == 0 ? whole + ".0" : whole + "." + frac;
    }

    /** 0.875 → "88%"；负数夹到 0，超过 1 夹到 100%。 */
    public static String percent(float ratio) {
        float r = Math.max(0f, Math.min(1f, ratio));
        return Math.round(r * 100f) + "%";
    }

    /** (206, 5, 24) → "Cycle 206 · 5月24日"。 */
    public static String date(int cycle, int month, int day) {
        return "Cycle " + cycle + " · " + month + "月" + day + "日";
    }
}
