package sscore;

/**
 * 事件路由：按下时查 HitMap 记住目标，拖动/抬起始终发给同一个目标。
 * 游戏侧只需把 InputEventAPI/Mouse 事件翻译成 Event，然后判断 isConsumed() 再转发，
 * 不要在 advance() 里轮询鼠标。
 */
public final class InputRouter {

    public static final int MOVE = 0;
    public static final int DOWN = 1;
    public static final int UP = 2;
    public static final int WHEEL = 3;

    /** 与游戏解耦的输入事件。 */
    public static final class Event {
        public final int type;
        public final float x, y;
        public final int wheel;

        public Event(int type, float x, float y, int wheel) {
            this.type = type;
            this.x = x;
            this.y = y;
            this.wheel = wheel;
        }

        public static Event move(float x, float y) {
            return new Event(MOVE, x, y, 0);
        }

        public static Event down(float x, float y) {
            return new Event(DOWN, x, y, 0);
        }

        public static Event up(float x, float y) {
            return new Event(UP, x, y, 0);
        }

        public static Event wheel(float x, float y, int delta) {
            return new Event(WHEEL, x, y, delta);
        }
    }

    /** 回调；id 一定是当前命中目标，不会是 null。 */
    public interface Handler {
        void press(String id, float x, float y);

        void drag(String id, float x, float y, float dx, float dy);

        void release(String id, float x, float y);

        void wheel(String id, float x, float y, int delta);
    }

    private final HitMap map;
    private final Handler handler;
    private String pressed;
    private float lastX, lastY;

    public InputRouter(HitMap map, Handler handler) {
        this.map = map;
        this.handler = handler;
    }

    public String pressed() {
        return pressed;
    }

    public void handle(Event e) {
        if (e == null) return;
        if (e.type == DOWN) {
            pressed = map.hit(e.x, e.y);
            lastX = e.x;
            lastY = e.y;
            if (pressed != null) handler.press(pressed, e.x, e.y);
        } else if (e.type == MOVE) {
            if (pressed != null) handler.drag(pressed, e.x, e.y, e.x - lastX, e.y - lastY);
            lastX = e.x;
            lastY = e.y;
        } else if (e.type == UP) {
            if (pressed != null) {
                handler.release(pressed, e.x, e.y);
                pressed = null;
            }
        } else if (e.type == WHEEL) {
            String id = map.hit(e.x, e.y);
            if (id != null) handler.wheel(id, e.x, e.y, e.wheel);
        }
    }
}
