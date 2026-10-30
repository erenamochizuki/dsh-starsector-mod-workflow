package sscore;

import java.util.ArrayList;
import java.util.List;

/**
 * 中文折行与省略。宽度由外部 Measurer 提供，所以这里不碰任何字体/游戏 API，
 * 预览和运行时可以用同一份逻辑、不同的度量实现。
 */
public final class TextFit {

    /** 文本宽度度量。 */
    public interface Measurer {
        float width(String s);
    }

    /** 不能出现在行首的标点；故意不含左括号/左引号。 */
    private static final String NO_LINE_START = "，。！？；：、）》」』】”’%…·";

    private TextFit() {
    }

    /** 按宽度折行；显式换行保留。返回的每一行尽量不超过 maxWidth（行首标点允许溢出一点）。 */
    public static List<String> wrap(String text, float maxWidth, Measurer m) {
        List<String> out = new ArrayList<String>();
        if (text == null || text.length() == 0) return out;
        for (String para : text.split("\n", -1)) {
            out.addAll(wrapParagraph(para, maxWidth, m));
        }
        return out;
    }

    private static List<String> wrapParagraph(String s, float maxWidth, Measurer m) {
        List<String> out = new ArrayList<String>();
        if (s.length() == 0) {
            out.add("");
            return out;
        }
        StringBuilder line = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            boolean fits = m.width(line.toString() + c) <= maxWidth;
            if (fits || line.length() == 0) {
                line.append(c);
                continue;
            }
            // 放不下：行首标点跟着上一行走，其余换行。
            if (NO_LINE_START.indexOf(c) >= 0) {
                line.append(c);
                out.add(line.toString());
                line.setLength(0);
            } else {
                out.add(line.toString());
                line.setLength(0);
                line.append(c);
            }
        }
        if (line.length() > 0) out.add(line.toString());
        return out;
    }

    /** 超宽时截断并加省略号；放不下省略号时只返回“…”的一小段。 */
    public static String ellipsize(String text, float maxWidth, Measurer m) {
        if (text == null) return "";
        if (m.width(text) <= maxWidth) return text;
        String dots = "…";
        int keep = text.length();
        while (keep > 0 && m.width(text.substring(0, keep) + dots) > maxWidth) keep--;
        if (keep == 0) return m.width(dots) <= maxWidth ? dots : dots;
        return text.substring(0, keep) + dots;
    }

    /** 折行后只保留 maxLines 行，最后一行加省略号。 */
    public static List<String> clamp(List<String> lines, int maxLines, float maxWidth, Measurer m) {
        List<String> out = new ArrayList<String>();
        if (lines == null || lines.isEmpty() || maxLines <= 0) return out;
        if (lines.size() <= maxLines) return new ArrayList<String>(lines);
        for (int i = 0; i < maxLines - 1; i++) out.add(lines.get(i));
        out.add(ellipsize((String) lines.get(maxLines - 1), maxWidth, m));
        return out;
    }
}
