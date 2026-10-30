package sscore;

import java.util.ArrayList;
import java.util.List;

/** 命中登记：同一位置按层号取最上层，层号相同取后登记的（后画的在上面）。 */
public final class HitMap {
    private static final class Entry {
        final String id;
        final Rect rect;
        final int layer;

        Entry(String id, Rect rect, int layer) {
            this.id = id;
            this.rect = rect;
            this.layer = layer;
        }
    }

    private final List<Entry> entries = new ArrayList<Entry>();

    public void clear() {
        entries.clear();
    }

    public void put(String id, Rect rect, int layer) {
        entries.add(new Entry(id, rect, layer));
    }

    public String hit(float x, float y) {
        Entry best = null;
        for (Entry e : entries) {
            if (!e.rect.contains(x, y)) continue;
            if (best == null || e.layer >= best.layer) best = e;
        }
        return best == null ? null : best.id;
    }

    /** 该点命中的所有 id，按层从下到上。 */
    public List<String> hitAll(float x, float y) {
        List<String> out = new ArrayList<String>();
        int guard = entries.size() + 1;
        while (guard-- > 0) {
            Entry best = null;
            for (Entry e : entries) {
                if (!e.rect.contains(x, y)) continue;
                if (out.contains(e.id)) continue;
                if (best == null || e.layer > best.layer) best = e;
            }
            if (best == null) break;
            out.add(best.id);
        }
        return out;
    }

    public int size() {
        return entries.size();
    }
}
