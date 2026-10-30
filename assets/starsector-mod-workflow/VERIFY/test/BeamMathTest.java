import data.scripts.weapons.ap_beam_math;

/** L3：光束纯几何的行为测试（不依赖游戏运行时）。 */
public class BeamMathTest {

    private static int pass;
    private static int fail;

    private static void check(String name, boolean ok) {
        if (ok) {
            pass++;
            System.out.println("  ✓ " + name);
        } else {
            fail++;
            System.out.println("  ✗ " + name);
        }
    }

    public static void main(String[] args) {
        check("零相位、t=0 时螺旋偏移为 0", Math.abs(ap_beam_math.helixOffset(0f, 24f, 3f, 0f)) < 0.001f);
        check("相位 1/4 圈时达到幅值", Math.abs(ap_beam_math.helixOffset(0f, 24f, 3f, 0.25f) - 24f) < 0.001f);
        check("相位 3/4 圈时达到负幅值", Math.abs(ap_beam_math.helixOffset(0f, 24f, 3f, 0.75f) + 24f) < 0.001f);
        check("沿长度推进一圈回到同值", Math.abs(
                ap_beam_math.helixOffset(0.1f, 24f, 3f, 0f) - ap_beam_math.helixOffset(0.1f + 1f / 3f, 24f, 3f, 0f)) < 0.5f);
        check("两端淡出为 0", ap_beam_math.taper(0f) < 0.001f && ap_beam_math.taper(1f) < 0.001f);
        check("中段淡出为 1", Math.abs(ap_beam_math.taper(0.5f) - 1f) < 0.001f);
        check("clamp01 夹边界", ap_beam_math.clamp01(-3f) == 0f && ap_beam_math.clamp01(3f) == 1f && ap_beam_math.clamp01(0.4f) == 0.4f);

        System.out.println("BeamMathTest：通过 " + pass + " / 失败 " + fail);
        if (fail > 0) {
            System.exit(1);
        }
    }
}
