package sscore;

/** 界面文案拼装：统一标题、提示、空态、计数、金额行的写法。 */
public final class UiKit {
    private UiKit() {
    }

    public static String title(String t) {
        return t == null ? "" : t.trim();
    }

    /** 底部提示行统一加“· ”前缀。 */
    public static String notice(String s) {
        return s == null || s.length() == 0 ? "" : "· " + s;
    }

    /** 确认按钮：有数量时带上数量。 */
    public static String confirm(String verb, int n) {
        return n > 0 ? verb + " " + n : verb;
    }

    /** 空态："（暂无俘虏）"。 */
    public static String empty(String what) {
        return "（暂无" + what + "）";
    }

    /** 计数行："俘虏 · 3"。 */
    public static String counter(String label, int n) {
        return label + " · " + n;
    }

    /** 金额行："赎回费用：12,000"。 */
    public static String labeled(String label, String value) {
        return label + "：" + value;
    }
}
