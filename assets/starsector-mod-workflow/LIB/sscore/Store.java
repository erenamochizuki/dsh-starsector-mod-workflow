package sscore;

import java.util.Set;

/** 存档读写的最小接口；游戏侧用 MemoryAPI 适配，测试用 MapStore。 */
public interface Store {
    int getInt(String key, int def);

    void setInt(String key, int v);

    float getFloat(String key, float def);

    void setFloat(String key, float v);

    boolean getBool(String key, boolean def);

    void setBool(String key, boolean v);

    String getString(String key, String def);

    void setString(String key, String v);

    boolean has(String key);

    void remove(String key);

    Set<String> keys();
}
