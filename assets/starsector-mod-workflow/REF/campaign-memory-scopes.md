# 战役内存：先确认上下文和所有者

依据：0.98 本地 API 的 RuleBasedInteractionDialogPluginImpl.updateMemory、NewGameDialogPluginImpl.init、Misc.Token.getVarNameAndMemory；引擎 Memory。不要把角色创建时的映射推广到普通战役对话。

## 普通实体／人物对话

| 前缀 | 标准 RuleBasedInteractionDialogPluginImpl 的来源 |
|---|---|
| 裸 $key / local | 默认是交互目标实体的 memory；进入 activePerson 人物上下文后改为该人物的 memory |
| $global.key | sector memory |
| $player.key | sector.getCharacterData().getMemory()；并非玩家舰队或 playerPerson 的 memory |
| $market.key | 目标有关联市场时的市场 memory |
| $entity.key | activePerson 上下文中保留的目标实体 memory；普通实体上下文不保证存在这个映射 |
| $faction.key | 交互目标势力的 memory；无势力时插件创建空 memory |
| $personFaction.key | activePerson 的势力 memory；无人时移除此槽位 |
| $sourceMarket.key | 目标 memory 的来源市场标志解析成功时，对应市场的 memory |

local 代表上下文，并不代表临时或自动随对话关闭而删除。人物、实体、市场上的值可能随存档保留；寿命还取决于所有者及过期时间。每个命令优先使用收到的 memoryMap，不自行拼一个假定相同的 Map。

未知作用域不能当作安全失败：Misc.Token 在找不到前缀对应 memory 时会回退 LOCAL，并保留完整变量名。先检查 memoryMap 实际键，避免把 $entity.key 误读成 local 上的同名键。

## 新建角色对话

NewGameDialogPluginImpl 用新建角色流程的 entity memory 作为 LOCAL，从中取 $characterData；GLOBAL 由工厂单独 createMemory()，并非普通战役的 sector memory。角色创建的键不能直接假定在进入游戏后的 sector 中存在。跨流程传值应明确在什么生命周期回调转存、何时清理。

Nex 自定义开局键、界面映射和存档迁移依赖具体版本，核对本地 Nex 插件后再使用。上游其他 mod 的 ap_* 实例不是 Moci 实测证据。Java 泛型是否需要显式转换以当前编译器和声明为准，不强制把所有 Map.get 都 cast。

## 过期与刷新

- MemoryAPI.set(key, value) 不设置到期时间，并会取消该键原有的过期设置；不要每帧这样覆盖一个原本有限时的键。
- set(key, value, expire) 的 expire 按游戏天计算。0 不是立即 unset：可能在暂停期间继续存在，到下一次有效推进才清除；需要立即删除时调用 unset。
- getMemory() 可能刷新事实；getMemoryWithoutUpdate() 不主动刷新。编写事实更新回调时使用传入的 memory，避免再次触发同一刷新路径。
- 长期状态写在明确的存档所有者上；短期状态显式设置期限或在退出时清理。测试普通实体、人物对话、返回菜单、读档和暂停后继续这几种情况。
