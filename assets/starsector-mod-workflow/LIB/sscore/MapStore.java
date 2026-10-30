package sscore;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** 内存版 Store：单测与预览用，也可作为读档后的镜像。 */
public final class MapStore implements Store {
    private final Map<String, Object> data = new LinkedHashMap<String, Object>();

    private Object raw(String key) {
        return data.get(key);
    }

    @Override
    public int getInt(String key, int def) {
        Object o = raw(key);
        return o instanceof Number ? ((Number) o).intValue() : def;
    }

    @Override
    public void setInt(String key, int v) {
        data.put(key, Integer.valueOf(v));
    }

    @Override
    public float getFloat(String key, float def) {
        Object o = raw(key);
        return o instanceof Number ? ((Number) o).floatValue() : def;
    }

    @Override
    public void setFloat(String key, float v) {
        data.put(key, Float.valueOf(v));
    }

    @Override
    public boolean getBool(String key, boolean def) {
        Object o = raw(key);
        return o instanceof Boolean ? ((Boolean) o).booleanValue() : def;
    }

    @Override
    public void setBool(String key, boolean v) {
        data.put(key, Boolean.valueOf(v));
    }

    @Override
    public String getString(String key, String def) {
        Object o = raw(key);
        return o instanceof String ? (String) o : def;
    }

    @Override
    public void setString(String key, String v) {
        data.put(key, v);
    }

    @Override
    public boolean has(String key) {
        return data.containsKey(key);
    }

    @Override
    public void remove(String key) {
        data.remove(key);
    }

    @Override
    public Set<String> keys() {
        return data.keySet();
    }
}
