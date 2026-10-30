package sscore;

import java.util.Arrays;
import java.util.List;
import java.util.Random;

/** 13 个积木的行为测试；每个积木至少覆盖边界与错误路径。 */
public final class TestAll {
    private TestAll() {
    }

    public static void run() {
        rect();
        layout();
        textFit();
        slider();
        listView();
        hitMap();
        inputRouter();
        daily();
        weighted();
        money();
        store();
        tokens();
        uiKit();
        fxTimeline();
    }

    private static void rect() {
        Rect r = new Rect(0, 0, 10, 10);
        T.ok(r.contains(0, 0), "Rect 左上角命中");
        T.ok(!r.contains(10, 5), "Rect 右边界不含");
        T.ok(!r.contains(5, 10), "Rect 下边界不含");
        T.ok(!r.contains(-1, 5), "Rect 左外不命中");
        T.eq(r.inset(2).toString(), "Rect(2.0,2.0,6.0,6.0)", "Rect 内缩");
        T.eq(new Rect(0, 0, 10, 10).intersect(new Rect(5, 5, 10, 10)).toString(), "Rect(5.0,5.0,5.0,5.0)", "Rect 交集");
        T.ok(new Rect(0, 0, 5, 5).intersect(new Rect(10, 10, 5, 5)).isEmpty(), "不相交时交集为空");
        T.ok(new Rect(0, 0, 10, 10).overlaps(new Rect(9, 9, 2, 2)), "相邻重叠");
        T.ok(!new Rect(0, 0, 10, 10).overlaps(new Rect(10, 0, 5, 5)), "贴边不算重叠");
    }

    private static void layout() {
        Rect[] rows = Layout.rows(new Rect(0, 0, 100, 100), 2, 10);
        T.eq(rows.length, 2, "Layout 行数");
        T.near(rows[0].h, 45f, 0.001f, "Layout 行高 = (100-10)/2");
        T.near(rows[1].y, 55f, 0.001f, "Layout 第二行起点");
        T.near(rows[1].bottom(), 100f, 0.001f, "Layout 行填满区域");

        Rect[] cols = Layout.cols(new Rect(0, 0, 100, 50), new float[]{1, 2}, 10);
        T.near(cols[0].w, 30f, 0.001f, "Layout 列权重 1");
        T.near(cols[1].w, 60f, 0.001f, "Layout 列权重 2");
        T.near(cols[1].x, 40f, 0.001f, "Layout 第二列起点");

        Rect[] zero = Layout.rows(new Rect(0, 0, 10, 10), 0, 4);
        T.eq(zero.length, 0, "Layout 0 行");
    }

    private static void textFit() {
        TextFit.Measurer m = new TextFit.Measurer() {
            @Override
            public float width(String s) {
                return s.length() * 10f;
            }
        };
        List<String> lines = TextFit.wrap("abcdef", 30f, m);
        T.eq(lines, Arrays.asList("abc", "def"), "TextFit 按宽度折行");

        List<String> punct = TextFit.wrap("abc，def", 30f, m);
        T.eq(punct.get(0), "abc，", "标点不落在行首");
        T.eq(punct.get(1), "def", "标点后继续折行");

        List<String> hard = TextFit.wrap("a\nb", 30f, m);
        T.eq(hard, Arrays.asList("a", "b"), "TextFit 保留显式换行");

        T.eq(TextFit.ellipsize("abcdef", 35f, m), "ab…", "TextFit 省略号");
        T.eq(TextFit.ellipsize("abc", 30f, m), "abc", "不超宽不加省略号");

        List<String> clamped = TextFit.clamp(Arrays.asList("aaa", "bbbbbb", "ccc"), 2, 30f, m);
        T.eq(clamped, Arrays.asList("aaa", "bb…"), "TextFit 行数上限");
    }

    private static void slider() {
        Slider s = new Slider(0f, 24f, 1f);
        T.near(s.value(), 0f, 0.001f, "Slider 默认最小值");
        s.setValue(10.4f);
        T.near(s.value(), 10f, 0.001f, "Slider 步进对齐");
        T.ok(s.nudge(-1), "Slider 可减小");
        T.near(s.value(), 9f, 0.001f, "Slider 减一格");
        s.setValue(-5f);
        T.near(s.value(), 0f, 0.001f, "Slider 下夹紧");
        T.ok(!s.nudge(-1), "到底返回 false");
        s.setValue(99f);
        T.near(s.value(), 24f, 0.001f, "Slider 上夹紧");
        T.near(s.fraction(), 1f, 0.001f, "Slider 满值比例");

        s.setFraction(0.5f);
        T.near(s.value(), 12f, 0.001f, "Slider 按比例设值");

        Rect track = new Rect(0, 0, 240, 10);
        Rect knob = s.knob(track, 20f);
        T.near(knob.x, 110f, 0.001f, "Slider 把手居中");
        s.setValue(0f);
        T.near(s.knob(track, 20f).x, 0f, 0.001f, "Slider 把手左边界");
        s.setValue(24f);
        T.near(s.knob(track, 20f).x, 220f, 0.001f, "Slider 把手右边界");
    }

    private static void listView() {
        ListView lv = new ListView(10, 3);
        T.eq(lv.maxScroll(), 7, "ListView 最大滚动");
        T.eq(lv.scrollBy(100), 7, "ListView 滚到底");
        T.eq(lv.scroll(), 7, "ListView 滚动位置");
        T.eq(lv.scrollBy(5), 0, "ListView 已在底部");

        lv.select(0);
        T.eq(lv.scroll(), 0, "ListView 选首行回顶");
        lv.select(9);
        T.eq(lv.scroll(), 7, "ListView 选末行到底");
        T.eq(lv.selected(), 9, "ListView 选中行");
        lv.select(4);
        T.eq(lv.scroll(), 4, "ListView 选中行滚入视口");

        lv.select(3);
        T.eq(lv.scroll(), 3, "ListView 向上滚入视口");
        T.eq(lv.rowAt(0f, 24f), 3, "ListView 视口首行");
        T.eq(lv.rowAt(100f, 24f), -1, "ListView 空白处返回 -1");

        lv.setRowCount(2);
        T.eq(lv.scroll(), 0, "ListView 行数变少回顶");
        T.eq(lv.selected(), 1, "ListView 选中行被夹住");
        lv.selectNext();
        T.eq(lv.selected(), 1, "ListView 末行再向下不动");
    }

    private static void hitMap() {
        HitMap map = new HitMap();
        map.put("底", new Rect(0, 0, 10, 10), 0);
        map.put("顶", new Rect(0, 0, 10, 10), 1);
        T.eq(map.hit(5, 5), "顶", "HitMap 取更高层");
        T.eq(map.hitAll(5, 5), Arrays.asList("顶", "底"), "HitMap 自底向上列出");
        T.eq(map.hit(50, 50), null, "HitMap 空白返回 null");
        T.eq(map.size(), 2, "HitMap 条目数");
    }

    private static void inputRouter() {
        HitMap map = new HitMap();
        map.put("btn", new Rect(0, 0, 10, 10), 0);
        final StringBuilder log = new StringBuilder();
        InputRouter.Handler h = new InputRouter.Handler() {
            @Override
            public void press(String id, float x, float y) {
                log.append("P:").append(id).append(' ');
            }

            @Override
            public void drag(String id, float x, float y, float dx, float dy) {
                log.append("D:").append(id).append(':').append(Math.round(dx)).append(',')
                        .append(Math.round(dy)).append(' ');
            }

            @Override
            public void release(String id, float x, float y) {
                log.append("R:").append(id).append(' ');
            }

            @Override
            public void wheel(String id, float x, float y, int delta) {
                log.append("W:").append(id).append(':').append(delta).append(' ');
            }
        };
        InputRouter router = new InputRouter(map, h);
        router.handle(InputRouter.Event.down(5, 5));
        router.handle(InputRouter.Event.move(7, 8));
        router.handle(InputRouter.Event.up(7, 8));
        router.handle(InputRouter.Event.move(1, 1));
        router.handle(InputRouter.Event.down(50, 50));
        router.handle(InputRouter.Event.up(50, 50));
        router.handle(InputRouter.Event.wheel(5, 5, 120));
        T.eq(log.toString(), "P:btn D:btn:2,3 R:btn W:btn:120 ", "InputRouter 按下-拖动-抬起-滚轮");
        T.eq(router.pressed(), null, "InputRouter 抬起后无按下目标");
    }

    private static void daily() {
        Daily d = new Daily();
        T.ok(d.allow("审问", 1, 2), "Daily 首次允许");
        d.use("审问", 1);
        d.use("审问", 1);
        T.eq(d.used("审问", 1), 2, "Daily 当日计数");
        T.ok(!d.allow("审问", 1, 2), "Daily 达到上限");
        T.eq(d.remaining("审问", 1, 2), 0, "Daily 剩余 0");
        T.eq(d.used("审问", 2), 0, "Daily 跨日清零");
        T.ok(d.allow("审问", 2, 2), "Daily 次日恢复");
        d.setUsed("审问", 3, 5);
        T.eq(d.used("审问", 3), 5, "Daily 读档恢复");
    }

    private static void weighted() {
        Weighted<String> w = new Weighted<String>(new Random(42L));
        w.add("甲", 1, 2);
        w.add("乙", 3, -1);
        w.add("零", 0, -1);
        for (int i = 0; i < 100; i++) w.pick();
        T.eq(w.picked("甲"), 2, "Weighted 单目标封顶");
        T.eq(w.picked("乙"), 98, "Weighted 其余次数给未封顶项");
        T.eq(w.picked("零"), 0, "Weighted 权重 0 不命中");

        Weighted<String> all = new Weighted<String>(new Random(7L));
        all.add("a", 1, 1);
        all.add("b", 1, 1);
        T.ok(!all.exhausted(), "Weighted 初始可抽");
        all.pick();
        all.pick();
        T.eq(all.pick(), null, "Weighted 抽空返回 null");
        T.ok(all.exhausted(), "Weighted 抽空标记");
    }

    private static void money() {
        T.eq(Money.credits(0), "0", "Money 零");
        T.eq(Money.credits(999), "999", "Money 三位");
        T.eq(Money.credits(1234567), "1,234,567", "Money 千分位");
        T.eq(Money.credits(-1500), "-1,500", "Money 负数");
        T.eq(Money.shortCredits(9999), "9,999", "Money 万以下原样");
        T.eq(Money.shortCredits(10000), "1.0万", "Money 万");
        T.eq(Money.shortCredits(19999), "1.9万", "Money 万一位小数");
        T.eq(Money.shortCredits(100000000L), "1.0亿", "Money 亿");
        T.eq(Money.percent(0.875f), "88%", "Money 百分比四舍五入");
        T.eq(Money.percent(1.2f), "100%", "Money 百分比上夹");
        T.eq(Money.date(206, 5, 24), "Cycle 206 · 5月24日", "Money 日期");
    }

    private static void store() {
        Store s = new MapStore();
        T.eq(s.getInt("n", 7), 7, "Store 缺省 int");
        s.setInt("n", 42);
        T.eq(s.getInt("n", 7), 42, "Store 读 int");
        s.setFloat("f", 4.5f);
        T.near(s.getFloat("f", 0f), 4.5f, 0.001f, "Store 读 float");
        s.setBool("b", true);
        T.ok(s.getBool("b", false), "Store 读 bool");
        T.eq(s.getString("s", "x"), "x", "Store 缺省 string");
        s.setString("s", "中文");
        T.eq(s.getString("s", "x"), "中文", "Store 读 string");
        T.ok(s.has("n"), "Store has");
        s.remove("n");
        T.ok(!s.has("n"), "Store remove");
        T.eq(s.keys().size(), 3, "Store keys");
    }

    private static void fxTimeline() {
        FxTimeline.Stage flash = new FxTimeline.Stage(0f, 0.03f, 0.03f, 0.12f, 0.49f, 0.40f, 0.55f);
        T.near(flash.alpha(-0.01f), 0f, 1e-6f, "Stage 起点前无 alpha");
        T.near(flash.alpha(0.03f), 0.55f, 1e-6f, "Stage 峰值 alpha");
        T.near(flash.alpha(0.12f), 0f, 1e-6f, "Stage 结束归零");
        T.ok(!flash.active(0.12f), "Stage 到 end 即失活");
        T.ok(flash.active(0.01f), "Stage 中间活跃");
        T.near(flash.radius(0f), 0.49f, 1e-6f, "Stage 半径起点");
        T.near(flash.radius(0.12f), 0.40f, 1e-6f, "Stage 半径终点");

        FxTimeline.Stage late = flash.delayed(0.5f);
        T.near(late.alpha(0.53f), 0.55f, 1e-6f, "delayed 整体平移");
        T.near(late.end, 0.62f, 1e-6f, "delayed 终点平移");

        // 峰值之前 alpha 单调不减：避免"闪两下"
        boolean monotone = true;
        float prev = -1f;
        for (int i = 0; i <= 30; i++) {
            float a = flash.alpha(i / 1000f);
            if (a < prev - 1e-6f) monotone = false;
            prev = a;
        }
        T.ok(monotone, "Stage 升段单调不减");

        T.near(FxTimeline.growShrinkRadius(0f, 0.2f, 0.45f, 0.9f, 0.55f, 0.45f), 0.55f, 1e-6f, "火球起始半径");
        T.near(FxTimeline.growShrinkRadius(0.3f, 0.2f, 0.45f, 0.9f, 0.55f, 0.45f), 1f, 1e-6f, "火球保持满径");
        T.near(FxTimeline.growShrinkRadius(0.9f, 0.2f, 0.45f, 0.9f, 0.55f, 0.45f), 0.45f, 1e-6f, "火球收缩到终点半径");
        T.near(FxTimeline.bodyAlpha(0f, 0.04f, 0.45f, 0.9f), 0f, 1e-6f, "火球 0 秒透明");
        T.near(FxTimeline.bodyAlpha(0.9f, 0.04f, 0.45f, 0.9f), 0f, 1e-6f, "火球结束透明");
        T.ok(FxTimeline.bodyAlpha(0.2f, 0.04f, 0.45f, 0.9f) > 0.9f, "火球中段接近满不透明");

        float[] pos = {0f, 0.5f, 1f};
        int[] colors = {0x000000, 0xFF0000, 0xFFFFFF};
        T.eq(FxTimeline.colorAt(pos, colors, 0f), 0x000000, "色表起点");
        T.eq(FxTimeline.colorAt(pos, colors, 1f), 0xFFFFFF, "色表终点");
        T.eq(FxTimeline.colorAt(pos, colors, 0.25f), 0x800000, "色表段内插值");
        T.eq(FxTimeline.mixColor(0x000000, 0xFFFFFF, 2f), 0xFFFFFF, "混色越界夹紧");
        T.eq(FxTimeline.envelope(0f, 0f, 0.2f, 0.4f, 0.6f), 0f, "包络起点为 0");
        T.ok(FxTimeline.envelope(0.3f, 0f, 0.2f, 0.4f, 0.6f) > 0.9f, "包络平台接近 1");
        T.eq(FxTimeline.envelope(0.6f, 0f, 0.2f, 0.4f, 0.6f), 0f, "包络终点为 0");

        boolean threw = false;
        try {
            new FxTimeline.Stage(0.5f, 0.1f, 0.2f, 0.3f, 1f, 1f, 1f);
        } catch (IllegalArgumentException e) {
            threw = true;
        }
        T.ok(threw, "Stage 参数乱序要报错");
        threw = false;
        try {
            FxTimeline.colorAt(new float[]{0f}, new int[]{0, 1}, 0f);
        } catch (IllegalArgumentException e) {
            threw = true;
        }
        T.ok(threw, "色表长度不一致要报错");
    }

    private static void tokens() {
        T.eq(Tokens.mix(0x000000, 0xFFFFFF, 0.5f), 0x808080, "Tokens 混色");
        T.eq(Tokens.mix(Tokens.BG, Tokens.BG, 1f), Tokens.BG, "Tokens 混色端点");
        T.eq(Tokens.withAlpha(0x123456, 0xFF), 0xFF123456, "Tokens alpha");
        T.eq(Tokens.GOLD, 0xE8C87A, "Tokens 金色常量");
    }

    private static void uiKit() {
        T.eq(UiKit.title("  查看俘虏 "), "查看俘虏", "UiKit 标题去空格");
        T.eq(UiKit.notice("24 种均为即死"), "· 24 种均为即死", "UiKit 提示前缀");
        T.eq(UiKit.confirm("确认处决", 3), "确认处决 3", "UiKit 带数量按钮");
        T.eq(UiKit.confirm("确认处决", 0), "确认处决", "UiKit 无数量按钮");
        T.eq(UiKit.empty("俘虏"), "（暂无俘虏）", "UiKit 空态");
        T.eq(UiKit.counter("俘虏", 3), "俘虏 · 3", "UiKit 计数行");
        T.eq(UiKit.labeled("赎回费用", "12,000"), "赎回费用：12,000", "UiKit 金额行");
    }
}
