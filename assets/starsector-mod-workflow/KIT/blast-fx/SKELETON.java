package {{PACKAGE}};

import java.awt.Color;
import java.util.EnumSet;

import org.lwjgl.util.vector.Vector2f;

import com.fs.starfarer.api.Global;
import com.fs.starfarer.api.combat.BaseCombatLayeredRenderingPlugin;
import com.fs.starfarer.api.combat.CombatEngineAPI;
import com.fs.starfarer.api.combat.CombatEngineLayers;
import com.fs.starfarer.api.combat.CombatEntityAPI;
import com.fs.starfarer.api.combat.DamageType;
import com.fs.starfarer.api.combat.DamagingProjectileAPI;
import com.fs.starfarer.api.combat.MissileAPI;
import com.fs.starfarer.api.combat.OnHitEffectPlugin;
import com.fs.starfarer.api.combat.ShipAPI;
import com.fs.starfarer.api.combat.ViewportAPI;
import com.fs.starfarer.api.combat.listeners.ApplyDamageResultAPI;
import com.fs.starfarer.api.graphics.SpriteAPI;

/**
 * 大范围爆炸特效骨架：伤害一次结算 + 分层贴图自绘（白闪 → 火球 → 白核 → 光针 → 冲击波环 → 余温云）。
 *
 * <p>为什么不是一个类一个职责：配方要能一次落到单个文件，所以把「时间轴」「渲染层」做成嵌套类。
 * 分别拆出去也可以，但那样就不能用 new.mjs 一次生成了。
 *
 * <p>三个要点，缺一个就"看不见"：
 * <ol>
 *   <li>未加载的动态贴图先 loadTexture 再 getSprite；已预加载素材无需重复加载；</li>
 *   <li>addLayeredRenderingPlugin 返回宿主后设置位置；init(host) 由引擎注册流程调用，不手动重复调用；</li>
 *   <li>渲染异常按类型处理并限频记录；修改 GL 状态时必须在 finally 中恢复。</li>
 * </ol>
 *
 * <p>全部贴图默认指向原版 {@code graphics/fx}，不准备任何素材也能跑；换成自己的图时只改
 * {@link Fx} 里 loadSprite 的名字。
 */
public class {{CLASS}} implements OnHitEffectPlugin {

    // ==================== 数值要求（先填这里，再调视觉） ====================

    /** 伤害半径（su）：玩家看到的火球边缘应当落在这里。 */
    public static final float RADIUS = 900f;                    // FILL: 你的爆炸半径
    /** 视觉缩放：1.0 = 火球边缘正好压在伤害圈上。 */
    public static final float VISUAL_SCALE = 1f;                // FILL: 想让视觉比伤害大/小就改这个
    /** 中心满伤范围。 */
    public static final float FULL_RADIUS = 100f;
    /** 边缘伤害衰减到多少。 */
    public static final float EDGE_FALLOFF = 0.1f;
    /** 单舰总伤害（按抛物线随距离衰减）。 */
    public static final float DAMAGE = 9000f;                   // FILL: 你的伤害
    /** 单舰总 EMP。 */
    public static final float EMP = 1000f;                      // FILL: 你的 EMP
    /** true = 连友军一起炸；发射舰本身始终免疫。 */
    public static final boolean DAMAGE_FRIENDLIES = true;

    /** 爆炸音效音量缩放。 */
    private static final float SOUND_VOLUME = 0.5f;

    /** 视觉半径 R。 */
    public static float visualRadius() {
        return RADIUS * VISUAL_SCALE;
    }

    // ==================== 入口 ====================

    @Override
    public void onHit(DamagingProjectileAPI projectile, CombatEntityAPI target,
                      Vector2f point, boolean shieldHit, ApplyDamageResultAPI damageResult,
                      CombatEngineAPI engine) {
        if (engine == null || point == null) {
            return;
        }
        detonate(engine, projectile.getSource(), new Vector2f(point), visualRadius());
    }

    /** 近炸/定时引爆用：在任意位置立刻起爆，不需要物理命中。 */
    public static void detonate(CombatEngineAPI engine, CombatEntityAPI source, Vector2f loc, float radius) {
        if (engine == null || loc == null) {
            return;
        }
        applyBlastDamage(engine, source, loc);
        Fx.spawn(engine, loc, radius);
        playBoomSound(engine, loc);
    }

    // ==================== 伤害 ====================

    /** 抛物线衰减：FULL_RADIUS 内 100%，到 RADIUS 降到 EDGE_FALLOFF。 */
    private static float falloff(float dist) {
        if (dist <= FULL_RADIUS) {
            return 1f;
        }
        if (dist >= RADIUS) {
            return 0f;
        }
        float x = (dist - FULL_RADIUS) / (RADIUS - FULL_RADIUS);
        return 1f - (1f - EDGE_FALLOFF) * x * x;
    }

    private static void applyBlastDamage(CombatEngineAPI engine, CombatEntityAPI source, Vector2f loc) {
        float maxR2 = RADIUS * RADIUS;
        for (ShipAPI target : engine.getShips()) {
            if (!target.isAlive() || target.isShuttlePod() || target.isPiece() || target == source) {
                continue;
            }
            if (!DAMAGE_FRIENDLIES && source != null && target.getOwner() == source.getOwner()) {
                continue;
            }
            Vector2f tl = target.getLocation();
            float dx = tl.x - loc.x;
            float dy = tl.y - loc.y;
            float dist2 = dx * dx + dy * dy;
            if (dist2 >= maxR2) {
                continue;
            }
            float k = falloff((float) Math.sqrt(dist2));
            if (k <= 0f) {
                continue;
            }
            // 每舰打 5 个点、每点 0.2 倍：单点伤害过大会被单次结算截断。
            // 取样点只影响特效位置，衰减只看舰船到爆心的距离。
            float shipR = target.getCollisionRadius();
            for (int j = 0; j < 5; j++) {
                float ang = (float) (Math.random() * 6.2831855f);
                float rr = shipR * 0.9f * (float) Math.sqrt(Math.random());
                Vector2f p = new Vector2f(tl.x + (float) Math.cos(ang) * rr, tl.y + (float) Math.sin(ang) * rr);
                engine.applyDamage(target, p, 0.2f * DAMAGE * k, DamageType.HIGH_EXPLOSIVE,
                        0.2f * EMP * k, true, false, source, true);
            }
        }
        // 小行星与导弹只吃 10%，否则一颗弹能清空一整片弹幕
        for (CombatEntityAPI rock : engine.getAsteroids()) {
            hitIfInside(engine, source, loc, rock, 0.1f);
        }
        for (MissileAPI msl : engine.getMissiles()) {
            hitIfInside(engine, source, loc, msl, 0.1f);
        }
    }

    /** 点在半径内就打 10% 伤害；返回是否命中（供外面统计）。 */
    private static boolean hitIfInside(CombatEngineAPI engine, CombatEntityAPI source, Vector2f loc,
                                       CombatEntityAPI target, float scale) {
        Vector2f tl = target.getLocation();
        float dx = tl.x - loc.x;
        float dy = tl.y - loc.y;
        if (dx * dx + dy * dy >= RADIUS * RADIUS) {
            return false;
        }
        float k = falloff((float) Math.sqrt(dx * dx + dy * dy));
        if (k <= 0f) {
            return false;
        }
        engine.applyDamage(target, tl, scale * DAMAGE * k, DamageType.HIGH_EXPLOSIVE, 0f,
                true, false, source, false);
        return true;
    }

    private static void playBoomSound(CombatEngineAPI engine, Vector2f loc) {
        ViewportAPI vp = engine.getViewport();
        float dist = vp == null ? 0f : (float) Math.hypot(loc.x - vp.getCenter().x, loc.y - vp.getCenter().y);
        // FILL: 换成你自己的音效 key（sounds.json），或整段删掉
        String key = dist <= 3000f ? "explosion_large" : "explosion_large_far";
        float ref = dist <= 3000f ? 2000f : 4000f;
        float vol = ref / Math.max(ref, dist) * SOUND_VOLUME;
        Global.getSoundPlayer().playUISound(key, 1f, vol);
    }

    // ==================== 时间轴（纯数学，不碰游戏类） ====================

    /**
     * 所有倍率都相对视觉半径 R；所有时间都是秒。要改节奏只改这里的常量。
     * 这段可以整块抄到离线脚本里出帧图预览，不需要启动游戏。
     */
    static final class Timeline {

        /** 总时长：比最后一层散尽稍长一点，留一帧余量。 */
        static final float LIFETIME = 1.05f;

        // ① 白闪
        static final float FLASH_HOLD_END = 0.030f;
        static final float FLASH_END = 0.120f;
        static final float FLASH_R = 0.49f;
        static final float FLASH_ALPHA = 0.55f;

        // ② 火球
        static final float BODY_R_START = 0.55f;
        static final float BODY_GROW_END = 0.20f;
        static final float BODY_SHRINK_START = 0.45f;
        static final float BODY_SHRINK_R = 0.45f;
        static final float BODY_END = 0.90f;
        static final float BODY_FADE_IN = 0.04f;
        static final float[] BODY_COLOR_POS = {0.00f, 0.05f, 0.12f, 0.20f, 0.32f, 0.50f, 0.72f, 1.00f};
        static final int[] BODY_COLOR = {
                0xFFFFFA, 0xFFFAD7, 0xFFEBA5, 0xFFC86E, 0xFF9646, 0xEB6937, 0xB44830, 0x6E2D28
        };

        // ②b 白核
        static final float CORE_R0 = 0.085f;
        static final float CORE_R1 = 0.0375f;
        static final float CORE_ALPHA = 0.55f;
        static final float CORE_HOLD = 0.34f;
        static final float CORE_END = 0.60f;

        // ③ 散射光针：火球色彩走完约 75% 才出
        static final float SPIKE_IN = 0.34f;
        static final float SPIKE_PEAK = 0.42f;
        static final float SPIKE_HOLD = 0.52f;
        static final float SPIKE_END = 0.80f;
        static final float SPIKE_R0 = 0.111f;
        static final float SPIKE_R1 = 1.40f;
        static final float SPIKE_TURN = 0.62f;
        static final float SPIKE_SPIN = 11f;

        // ④ 冲击波环：光针之后接力
        static final int RING_COUNT = 3;
        static final float[] RING_START = {0.50f, 0.62f, 0.74f};
        static final float RING_DUR = 0.46f;
        static final float RING_R0 = 0.111f;
        static final float RING_R1 = 1.20f;
        static final float RING_ALPHA0 = 0.38f;

        // ⑤ 余温云
        static final float PINK_IN = 0.40f;
        static final float PINK_PEAK = 0.72f;
        static final float PINK_END = 1.05f;
        static final float PINK_R0 = 0.70f;
        static final float PINK_R1 = 0.90f;
        static final float PINK_PEAK_ALPHA = 0.42f;

        static final int COLOR_WHITE = 0xFFFFFF;
        static final int COLOR_PINK = 0xFF96B4;
        static final int COLOR_RING_COOL = 0xFF90AC;

        // 工具
        static float clamp01(float v) {
            return v < 0f ? 0f : (v > 1f ? 1f : v);
        }

        static float smooth(float k) {
            k = clamp01(k);
            return k * k * (3f - 2f * k);
        }

        static float ramp(float t, float a, float b) {
            return b <= a ? (t >= b ? 1f : 0f) : clamp01((t - a) / (b - a));
        }

        /** 0→1 的包络：a→b 升起，c→d 落回。 */
        static float envelope(float t, float a, float b, float c, float d) {
            return smooth(ramp(t, a, b)) * (1f - smooth(ramp(t, c, d)));
        }

        /** 两个 int 颜色之间线性插值（四舍五入）。 */
        static int mixColor(int c0, int c1, float k) {
            k = clamp01(k);
            int r = (int) (((c0 >> 16) & 0xFF) + (((c1 >> 16) & 0xFF) - ((c0 >> 16) & 0xFF)) * k + 0.5f);
            int g = (int) (((c0 >> 8) & 0xFF) + (((c1 >> 8) & 0xFF) - ((c0 >> 8) & 0xFF)) * k + 0.5f);
            int b = (int) ((c0 & 0xFF) + ((c1 & 0xFF) - (c0 & 0xFF)) * k + 0.5f);
            return (clampB(r) << 16) | (clampB(g) << 8) | clampB(b);
        }

        static int clampB(int v) {
            return v < 0 ? 0 : (v > 255 ? 255 : v);
        }

        // ① 白闪
        static float flashAlpha(float t) {
            return (t < 0f || t >= FLASH_END) ? 0f
                    : FLASH_ALPHA * (1f - smooth(ramp(t, FLASH_HOLD_END, FLASH_END)));
        }

        static float flashRadius(float t) {
            return FLASH_R * (1f - 0.25f * smooth(ramp(t, 0f, FLASH_END)));
        }

        // ② 火球：一出现就 0.55R，0.20 秒冲到 1.0R，保持到 0.45 秒再缩到 0.45R
        static float bodyRadius(float t) {
            if (t <= 0f) {
                return BODY_R_START;
            }
            if (t < BODY_GROW_END) {
                return BODY_R_START + (1f - BODY_R_START) * smooth(ramp(t, 0f, BODY_GROW_END));
            }
            if (t < BODY_SHRINK_START) {
                return 1f;
            }
            return 1f + (BODY_SHRINK_R - 1f) * smooth(ramp(t, BODY_SHRINK_START, BODY_END));
        }

        static float bodyAlpha(float t) {
            if (t < 0f || t >= BODY_END) {
                return 0f;
            }
            return smooth(ramp(t, 0f, BODY_FADE_IN)) * (1f - smooth(ramp(t, BODY_SHRINK_START, BODY_END)));
        }

        static int bodyColor(float t) {
            float k = clamp01(t / BODY_END);
            for (int i = 0; i < BODY_COLOR_POS.length - 1; i++) {
                if (k <= BODY_COLOR_POS[i + 1]) {
                    float f = (k - BODY_COLOR_POS[i]) / (BODY_COLOR_POS[i + 1] - BODY_COLOR_POS[i]);
                    return mixColor(BODY_COLOR[i], BODY_COLOR[i + 1], smooth(f));
                }
            }
            return BODY_COLOR[BODY_COLOR.length - 1];
        }

        // ②b 白核
        static float coreRadius(float t) {
            return CORE_R0 + (CORE_R1 - CORE_R0) * smooth(ramp(t, 0.06f, CORE_END));
        }

        static float coreAlpha(float t) {
            return (t < 0f || t >= CORE_END) ? 0f
                    : CORE_ALPHA * smooth(ramp(t, 0f, 0.03f)) * (1f - smooth(ramp(t, CORE_HOLD, CORE_END)));
        }

        // ③ 光针
        static float spikeAlpha(float t) {
            return envelope(t, SPIKE_IN, SPIKE_PEAK, SPIKE_HOLD, SPIKE_END);
        }

        static float spikeRadius(float t) {
            return SPIKE_R0 + (SPIKE_R1 - SPIKE_R0) * smooth(ramp(t, SPIKE_IN, SPIKE_END));
        }

        static float spikeAngle(float t) {
            return SPIKE_SPIN * t;
        }

        static float spikeColorMix(float t) {
            return smooth(ramp(t, SPIKE_IN, SPIKE_TURN));
        }

        // ④ 冲击波环
        static float ringAlpha(float t, int i) {
            if (i < 0 || i >= RING_COUNT) {
                return 0f;
            }
            float s = RING_START[i];
            if (t < s || t >= s + RING_DUR) {
                return 0f;
            }
            float k = (t - s) / RING_DUR;
            return RING_ALPHA0 * smooth(clamp01(k / 0.25f)) * (1f - smooth(ramp(k, 0.25f, 1f)));
        }

        static float ringRadius(float t, int i) {
            if (i < 0 || i >= RING_COUNT) {
                return 0f;
            }
            float s = RING_START[i];
            return RING_R0 + (RING_R1 - RING_R0) * smooth(clamp01((t - s) / RING_DUR));
        }

        static float ringColorMix(float t, int i) {
            return (i < 0 || i >= RING_COUNT) ? 0f
                    : smooth(ramp(t, RING_START[i], RING_START[i] + RING_DUR * 0.7f));
        }

        // ⑤ 余温云
        static float pinkAlpha(float t) {
            if (t < PINK_IN || t >= PINK_END) {
                return 0f;
            }
            return PINK_PEAK_ALPHA * smooth(ramp(t, PINK_IN, PINK_PEAK))
                    * (1f - smooth(ramp(t, PINK_PEAK + 0.08f, PINK_END)));
        }

        static float pinkRadius(float t) {
            return PINK_R0 + (PINK_R1 - PINK_R0) * smooth(ramp(t, PINK_IN, PINK_END));
        }

        static boolean isExpiredAt(float t) {
            return t >= LIFETIME;
        }

        private Timeline() {
        }
    }

    // ==================== 渲染层 ====================

    /**
     * 分层贴图自绘。画序（底→顶）：余温云 → 火球（实心垫层 + 两张加法） → 白核 → 光针 → 冲击波环 → 白闪。
     *
     * <p>贴图名默认全是原版素材；换自制图只改 SPRITE_* 常量（png 放 graphics/fx/）。
     */
    static final class Fx extends BaseCombatLayeredRenderingPlugin {

        /** 低于这个透明度就不画。 */
        static final float MIN_ALPHA = 0.004f;

        /** FILL: 改成你自己的贴图名（不带目录与扩展名）；留原版名字就不用准备素材。 */
        static final String SPRITE_BODY = "explosion3";        // 火球主体（柔和烟团）
        static final String SPRITE_BODY_DENSE = "explosion1";  // 火球实心垫层（致密）
        static final String SPRITE_FLASH = "explosion5";       // 白闪（径向光）
        static final String SPRITE_CORE = "fog_circle2";       // 白核（实心圆盘）
        static final String SPRITE_SPIKES = "explosion0";      // 散射光针（星芒）
        static final String SPRITE_RING = "explosion_ring0";   // 冲击波环
        static final String SPRITE_PINK = "explosion4";        // 余温云

        private static final Color PINK_RIM = new Color(196, 58, 92);
        private static final Color PINK_MID = new Color(253, 132, 152);
        private static final Color PINK_HOT = new Color(255, 176, 190);
        private static final Color SPARK_HOT = new Color(255, 236, 205);
        private static final Color SPARK_PINK = new Color(255, 150, 180);
        private static final Color HAZE_PINK = new Color(200, 55, 85);

        private final CombatEngineAPI engine;
        private final Vector2f loc;
        private final float radius;
        private float elapsed;

        private final SpriteAPI body;
        private final SpriteAPI bodyDense;
        private final SpriteAPI flash;
        private final SpriteAPI core;
        private final SpriteAPI spikes;
        private final SpriteAPI ring;
        private final SpriteAPI pink;

        private final float[] cloudAngle = {rand(-40f, 40f), rand(-40f, 40f), rand(-40f, 40f)};
        private final float driftAngle = rand(0f, 6.2831853f);
        private final float driftAmp = rand(0.05f, 0.13f);

        private boolean warnedMissing;
        private boolean loggedFirstRender;
        private boolean loggedError;

        private Fx(CombatEngineAPI engine, Vector2f loc, float radius) {
            this.engine = engine;
            this.loc = loc;
            this.radius = radius;
            this.body = loadSprite(SPRITE_BODY);
            this.bodyDense = loadSprite(SPRITE_BODY_DENSE);
            this.flash = loadSprite(SPRITE_FLASH);
            this.core = loadSprite(SPRITE_CORE);
            this.spikes = loadSprite(SPRITE_SPIKES);
            this.ring = loadSprite(SPRITE_RING);
            this.pink = loadSprite(SPRITE_PINK);
        }

        /** 在 loc 生成一次完整特效。 */
        static void spawn(CombatEngineAPI engine, Vector2f loc, float radius) {
            if (engine == null || loc == null || radius <= 1f) {
                return;
            }
            Fx fx = new Fx(engine, new Vector2f(loc), radius);
            fx.emitParticles();
            // 设置裁剪中心；引擎稍后负责调用 init(host)，这里不重复初始化。
            CombatEntityAPI host = engine.addLayeredRenderingPlugin(fx);
            if (host == null) {
                Global.getLogger(Fx.class).warn("[blast-fx] addLayeredRenderingPlugin 返回 null，自绘层不会显示");
                return;
            }
            if (host.getLocation() != null) {
                host.getLocation().set(loc.x, loc.y);
            }
        }

        /**
         * 取贴图：<b>先</b> loadTexture 预热，<b>再</b> getSprite。
         * mod 的 graphics/fx 与原版同名目录合并，所以原版素材也能按这条路取。
         */
        static SpriteAPI loadSprite(String name) {
            String path = "graphics/fx/" + name + ".png";
            try {
                Global.getSettings().loadTexture(path);
            } catch (Throwable ignored) {
                // 文件缺失也继续，下面统一判断
            }
            SpriteAPI sprite = null;
            try {
                sprite = Global.getSettings().getSprite(path);
            } catch (Throwable ignored) {
                // 同上
            }
            if (texId(sprite) <= 0) {
                try {
                    SpriteAPI alt = Global.getSettings().getSprite("fx", name);
                    if (texId(alt) > texId(sprite)) {
                        sprite = alt;
                    }
                } catch (Throwable ignored) {
                    // 忽略
                }
            }
            return sprite;
        }

        static int texId(SpriteAPI s) {
            if (s == null) {
                return -1;
            }
            try {
                return s.getTextureId();
            } catch (Throwable t) {
                return -2;
            }
        }

        static float rand(float min, float max) {
            return (float) (Math.random() * (max - min) + min);
        }

        static Color mix(int rgb, int rgb2, float k) {
            return new Color(Timeline.mixColor(rgb, rgb2, Timeline.clamp01(k)));
        }

        /** 一次性粒子：飞溅碎片 + 星云底 + 慢速余烬。贴图坏了也有东西可看。 */
        private void emitParticles() {
            for (int i = 0; i < 36; i++) {
                float ang = rand(0f, 6.2831853f);
                float speed = rand(700f, 1200f);
                Vector2f vel = new Vector2f((float) Math.cos(ang) * speed, (float) Math.sin(ang) * speed);
                engine.addSmoothParticle(loc, vel, rand(14f, 30f) * 1.4f, 0.85f, rand(0.5f, 0.9f), SPARK_HOT);
                engine.addHitParticle(loc, new Vector2f(vel.x * 0.7f, vel.y * 0.7f),
                        rand(16f, 36f) * 1.2f, 0.85f, rand(0.3f, 0.7f), SPARK_PINK);
            }
            for (int i = 0; i < 3; i++) {
                float k = 1f - i * 0.16f;
                engine.addNebulaParticle(loc, new Vector2f(), radius * 0.42f * k,
                        1.05f, 0.2f, 0.60f, 1.4f - i * 0.3f, HAZE_PINK);
            }
            for (int i = 0; i < 12; i++) {
                float ang = rand(0f, 6.2831853f);
                float speed = rand(120f, 260f);
                engine.addSmoothParticle(loc,
                        new Vector2f((float) Math.cos(ang) * speed, (float) Math.sin(ang) * speed),
                        rand(20f, 45f) * 1.6f, 0.7f, rand(0.8f, 1.3f), new Color(255, 170, 190, 110));
            }
        }

        /** 画一层：把贴图缩放成半径 R×mult 的方形叠上去。贴图为空/未进显存时静默跳过。 */
        private void draw(SpriteAPI sprite, float mult, float alpha, Color tint, float angle,
                          float offX, float offY, boolean additive) {
            if (sprite == null || alpha <= MIN_ALPHA || mult <= 0f) {
                return;
            }
            if (texId(sprite) <= 0) {
                if (!warnedMissing) {
                    warnedMissing = true;
                    Global.getLogger(Fx.class).warn("[blast-fx] 有贴图未进显存，该层跳过");
                }
                return;
            }
            float size = 2f * radius * mult;
            if (size < 1f) {
                return;
            }
            sprite.setSize(size, size);
            sprite.setColor(tint);
            sprite.setAlphaMult(Timeline.clamp01(alpha));
            sprite.setAngle(angle);
            if (additive) {
                sprite.setAdditiveBlend();
            } else {
                sprite.setNormalBlend();
            }
            sprite.renderAtCenter(loc.x + offX, loc.y + offY);
        }

        @Override
        public void render(CombatEngineLayers layer, ViewportAPI viewport) {
            try {
                if (!loggedFirstRender) {
                    loggedFirstRender = true;
                    Global.getLogger(Fx.class).info("[blast-fx] first render R=" + radius
                            + " hasEntity=" + (getEntity() != null) + " loc=" + loc.x + "," + loc.y);
                }
                float t = elapsed;

                // ① 余温云（最底层）
                float pa = Timeline.pinkAlpha(t);
                if (pa > MIN_ALPHA) {
                    float pr = Timeline.pinkRadius(t);
                    float drift = driftAmp * radius * t;
                    float ox = (float) Math.cos(driftAngle) * drift;
                    float oy = (float) Math.sin(driftAngle) * drift;
                    draw(pink, pr * 1.00f, pa * 0.35f, PINK_RIM, cloudAngle[0], ox, oy, true);
                    draw(pink, pr * 0.80f, pa * 0.55f, PINK_MID, cloudAngle[1], ox * 0.7f, oy * 0.7f, true);
                    draw(pink, pr * 0.58f, pa * 0.65f, PINK_HOT, cloudAngle[2], ox * 0.4f, oy * 0.4f, true);
                }

                // ② 火球：实心垫层用正常混合（否则星空透出来），上面两张加法提亮
                float ba = Timeline.bodyAlpha(t);
                if (ba > MIN_ALPHA) {
                    float br = Timeline.bodyRadius(t);
                    int col = Timeline.bodyColor(t);
                    draw(bodyDense, br * 1.04f, ba * 0.95f, mix(col, 0x000000, 0.22f), 0f, 0f, 0f, false);
                    draw(body, br * 1.00f, ba * 0.95f, new Color(col), 0f, 0f, 0f, true);
                    draw(body, br * 0.86f, ba * 0.55f, mix(col, 0xFFFFFF, 0.18f), 17f, 0f, 0f, true);
                }

                // ③ 白核
                float ca = Timeline.coreAlpha(t);
                if (ca > MIN_ALPHA) {
                    draw(core, Timeline.coreRadius(t), ca, Color.WHITE, 0f, 0f, 0f, true);
                }

                // ④ 散射光针：从中心 100su 起，缓慢旋转，白→粉
                float sa = Timeline.spikeAlpha(t);
                if (sa > MIN_ALPHA) {
                    draw(spikes, Timeline.spikeRadius(t), sa,
                            mix(Timeline.COLOR_WHITE, Timeline.COLOR_PINK, Timeline.spikeColorMix(t)),
                            Timeline.spikeAngle(t), 0f, 0f, true);
                }

                // ⑤ 冲击波环：三圈错开，同样从中心起
                for (int i = 0; i < Timeline.RING_COUNT; i++) {
                    float a = Timeline.ringAlpha(t, i);
                    if (a <= MIN_ALPHA) {
                        continue;
                    }
                    draw(ring, Timeline.ringRadius(t, i), a,
                            mix(Timeline.COLOR_WHITE, Timeline.COLOR_RING_COOL, Timeline.ringColorMix(t, i)),
                            0f, 0f, 0f, true);
                }

                // ⑥ 白闪：画在最上面
                draw(flash, Timeline.flashRadius(t), Timeline.flashAlpha(t), Color.WHITE, 0f, 0f, 0f, true);
            } catch (Throwable t2) {
                // 限次报告本模板的渲染错误；这不能替代 GL 状态恢复。
                if (!loggedError) {
                    loggedError = true;
                    Global.getLogger(Fx.class).error("[blast-fx] render 异常，本层已降级", t2);
                }
            }
        }

        @Override
        public void advance(float amount) {
            if (engine != null && engine.isPaused()) {
                return;
            }
            if (amount > 0f) {
                elapsed += amount;
            }
        }

        @Override
        public boolean isExpired() {
            return Timeline.isExpiredAt(elapsed);
        }

        @Override
        public void cleanup() {
            // SpriteAPI 由设置缓存持有，不要在这里释放
        }

        @Override
        public EnumSet<CombatEngineLayers> getActiveLayers() {
            return EnumSet.of(CombatEngineLayers.ABOVE_PARTICLES);
        }

        /** 撑大渲染半径：返回 0 或太小会被视口裁剪整层裁掉。 */
        @Override
        public float getRenderRadius() {
            return radius * 4f + 4000f;
        }
    }
}
