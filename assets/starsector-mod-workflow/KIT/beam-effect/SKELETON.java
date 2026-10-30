package {{PACKAGE}};

import com.fs.starfarer.api.combat.BeamAPI;
import com.fs.starfarer.api.combat.BeamEffectPlugin;
import com.fs.starfarer.api.combat.CombatEngineAPI;
import org.lwjgl.util.vector.Vector2f;

import java.awt.Color;
import java.util.Random;

/**
 * 光束自绘骨架：原生 beam 负责伤害/穿透/音效，本脚本只加视觉效果。
 *
 * 挂载：.wpn 的 "beamEffect" 字段指向本类；R3 闸门会检查类是否存在。
 * 为什么要自绘：原版 beam 贴图只能拉伸/滚动，做螺旋、电弧这类造型做不到。
 *
 * 四层结构（按需删减，删层时同步删字段与累计器）：
 * 1) 外晕：宽而淡的平滑粒子；
 * 2) 主体线：沿 t 横向偏移的细粒子；
 * 3) 分叉/电弧：两侧短枝，随机抖动；
 * 4) 亮芯：白→主题色的窄亮柱。
 */
public class {{CLASS}} implements BeamEffectPlugin {

    /** 亮芯粒子/秒 */
    private static final float CORE_RATE = 80f;
    /** 主体线粒子/秒 */
    private static final float SPIRAL_RATE = 120f;
    /** 电弧/秒 */
    private static final float ARC_RATE = 30f;
    /** 外晕粒子/秒 */
    private static final float HALO_RATE = 60f;

    /** 横向幅值（像素） */
    private static final float AMP = 24f;
    /** 绕一圈的长度（螺距） */
    private static final float PITCH = 240f;
    /** 相位流速（像素/秒） */
    private static final float SPEED = 300f;
    /** 外晕尺寸 */
    private static final float HALO_SIZE = 64f;
    /** 低于此亮度不画（beam 关闭时会降到 0） */
    private static final float MIN_BRIGHTNESS = 0.03f;

    private static final Color HALO = new Color(255, 140, 50, 46);
    private static final Color SPIRAL = new Color(255, 176, 96, 210);
    private static final Color ARC = new Color(255, 150, 70, 220);
    private static final Color CORE = new Color(255, 245, 235, 235);

    private final Random rnd = new Random(0x5EEDL);
    /** 相位累计（圈） */
    private float phase;
    private float coreAcc;
    private float spiralAcc;
    private float arcAcc;
    private float haloAcc;

    @Override
    public void advance(float amount, CombatEngineAPI engine, BeamAPI beam) {
        if (engine == null || beam == null || engine.isPaused()) {
            return;
        }
        if (beam.getBrightness() < MIN_BRIGHTNESS) {
            return;
        }
        Vector2f from = beam.getFrom();
        Vector2f to = beam.getTo();
        if (from == null || to == null) {
            return;
        }
        float dx = to.x - from.x;
        float dy = to.y - from.y;
        float len = (float) Math.sqrt(dx * dx + dy * dy);
        if (len < 1f) {
            return;
        }
        // 单位方向与左法线
        float ux = dx / len;
        float uy = dy / len;
        float nx = -uy;
        float ny = ux;

        phase += amount * (SPEED / PITCH);
        // 整条光束绕 len/PITCH 圈
        float turns = len / PITCH;
        float bright = beam.getBrightness();

        haloAcc += amount * HALO_RATE;
        while (haloAcc >= 1f) {
            haloAcc -= 1f;
            float t = rnd.nextFloat();
            float off = (rnd.nextFloat() - 0.5f) * AMP * 1.6f;
            emit(engine, from, ux, uy, nx, ny, len, t, off, HALO_SIZE, 0.30f * bright, 0.055f, HALO, true);
        }

        spiralAcc += amount * SPIRAL_RATE;
        while (spiralAcc >= 1f) {
            spiralAcc -= 1f;
            float t = rnd.nextFloat();
            float base = helixOffset(t, AMP, turns, phase);
            float fade = taper(t);
            // 双股：第二股差半圈
            float off = rnd.nextBoolean() ? base : -base;
            emit(engine, from, ux, uy, nx, ny, len, t, off, 9f, 0.55f * fade * bright, 0.075f, SPIRAL, false);
        }

        arcAcc += amount * ARC_RATE;
        while (arcAcc >= 1f) {
            arcAcc -= 1f;
            float t = 0.1f + rnd.nextFloat() * 0.8f;
            float side = rnd.nextBoolean() ? 1f : -1f;
            float off = side * (AMP + rnd.nextFloat() * 18f);
            float fade = taper(t);
            emit(engine, from, ux, uy, nx, ny, len, t, off, 5f, 0.5f * fade * bright, 0.05f, ARC, false);
        }

        coreAcc += amount * CORE_RATE;
        while (coreAcc >= 1f) {
            coreAcc -= 1f;
            float t = rnd.nextFloat();
            float off = (rnd.nextFloat() - 0.5f) * 8f;
            float fade = taper(t);
            emit(engine, from, ux, uy, nx, ny, len, t, off, 13f, 0.85f * fade * bright, 0.05f, CORE, false);
        }
    }

    /** 沿光束 t 处的横向偏移：正弦，t 用 0..1，turns 是整条光束圈数。 */
    static float helixOffset(float t, float amp, float turns, float phase) {
        float a = (float) (2.0 * Math.PI) * (t * turns + phase);
        return amp * (float) Math.sin(a);
    }

    /** 两端 8% 线性淡出，避免束根/命中点突然断开。 */
    static float taper(float t) {
        float fade = 0.08f;
        if (t < fade) {
            return t / fade;
        }
        if (t > 1f - fade) {
            return (1f - t) / fade;
        }
        return 1f;
    }

    /** 沿光束 t 处、横向 off 像素发一个粒子。smooth=true 用柔化粒子。 */
    private static void emit(CombatEngineAPI engine, Vector2f from, float ux, float uy,
                             float nx, float ny, float len, float t, float off,
                             float size, float brightness, float duration, Color color, boolean smooth) {
        float x = from.x + ux * len * t + nx * off;
        float y = from.y + uy * len * t + ny * off;
        Vector2f loc = new Vector2f(x, y);
        Vector2f vel = new Vector2f(0f, 0f);
        if (smooth) {
            engine.addSmoothParticle(loc, vel, size, brightness, duration, color);
        } else {
            engine.addHitParticle(loc, vel, size, brightness, duration, color);
        }
    }
}
