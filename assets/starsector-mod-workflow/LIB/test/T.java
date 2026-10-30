package sscore;

/** 极简断言：不引 JUnit，javac + java 就能跑。 */
public final class T {
    public static int passed;
    public static int failed;

    private T() {
    }

    public static void ok(boolean cond, String msg) {
        if (cond) {
            passed++;
        } else {
            failed++;
            System.out.println("FAIL " + msg);
        }
    }

    public static void eq(Object actual, Object expected, String msg) {
        ok(actual == null ? expected == null : actual.equals(expected),
                msg + "（期望 " + expected + "，实际 " + actual + "）");
    }

    public static void near(float actual, float expected, float eps, String msg) {
        ok(Math.abs(actual - expected) <= eps,
                msg + "（期望 " + expected + "±" + eps + "，实际 " + actual + "）");
    }

    public static void main(String[] args) {
        TestAll.run();
        System.out.println("LIB 测试：通过 " + passed + " / 失败 " + failed);
        if (failed > 0) System.exit(1);
    }
}
