# 教程补充检查表（0.98）

仅在任务涉及相应主题时读取，不要求一次实现所有条目。教程仓库是学习资料；不执行其安装／检查脚本，也不把它的 AGENTS、Gradle 工程或依赖版本当作 Moci 规范。Moci 环境、用户规则和本地实际 API 优先。

来源：[StarsectorNihilismGuidance 固定版本](https://github.com/1847905557/StarsectorNihilismGuidance/tree/4a382a4227ab4d2cac749cbfa4ed8965bfe99b8b/docs)，2026-10-24 下载。仓库 README 面向 0.98a-RC8；在线站点首页仍显示 0.95.1a，不能混用两个版本的结论。此清单概括核对方法，不保证教程全部示例已编译或实机测试。

## 数值与战斗生命周期（第 8、9 章）

- HullModEffect 文档指出同一效果对象在应用会话中共享；每船计时、目标、缓存等可变状态放在船的 customData／listener 等明确所有者上。不要把实例字段默认当每船状态。
- beforeShipCreation、afterShipCreation、advanceInCampaign、advanceInCombat 有不同职责；装配面板与战役刷新可能以 amount=0 调用。重复回调不得重复发奖励、注册监听器或累积属性。
- MutableStat 的合成是 (base + base * percent / 100 + flat) * mult，不是先加 flat 再算百分比。例如 base=100、flat=20、percent=50、mult=2 得 340；percent=-100 不一定清零 flat。
- 同一个 source ID 的 modify 会更新该条修改，不是每帧加一层。撤销自己的 source ID；不要用无参 unmodify 清掉其他系统。注意不同 MutableStat／MutableStatWithTempMods 等实际类型的差别。
- 系统 .system → ship_systems.csv → ship_data.csv 接线见 KIT/shipsystem；runScriptWhileIdle 开启后在 apply 的 idle/cooldown 路径也要处理清理。
- 武器、弹体、光束和舰船 AI 的回调按实际事件使用；暂停、死亡、战斗退出、多实体同时存在与对象失效必须考虑。性能细节继续读 moci-performance.md；教程不替代现有网格和平方距离规则。

## 战役、舰队、市场与人物（第 3、4、10—13 章）

- 核对对象属于 star system、hyperspace 还是当前 location；坐标、轨道焦点、实体／市场／人物 ID 不混用。新增世界只在正确的新档阶段生成；载入回调去重，兼容旧档单独设计。
- 舰队成员、variant 与 stats 是不同对象。改 variant 前处理共享对象与来源，装回后重新取得当前对象；模块、战机的关联见造船 skill 的 ship-data-contracts.md。
- 添加市场、子市场、工业、商品或技能同时检查登记、适用性与生命周期回调。不要只因 UI 有显示就宣称经济、维护、访问权限或效果已生效。需要时核对 vanilla 同类实现及经济刷新时机。

## 脚本、Intel、酒吧与任务（第 14、15 章）

- addIntel 不自动 addScript；需要定时推进时注册同一个实例。BaseIntelPlugin 优先覆写 advanceImpl 以保留基类结束计时。
- 普通脚本／监听器是否持久化、临时注册是否读档重挂、重复注册与移除分别验证；不要在每次 onGameLoad 盲目新增。
- isDone、isEnded、shouldRemoveIntel、监听器移除并不等价。任务领取、失败、成功、重复交互、存档读取和已失效目标都需有收尾路径；奖励操作防重复。
- 酒吧事件先核对 creator 的可用性、实例创建、接受／拒绝与重新出现规则，再决定事件与任务对象之间的所有权。

## Rules 与内存（第 16 章）

使用专项 starsector-rules-writing；内存表见 campaign-memory-scopes.md。重点：条件命令避免副作用、script 返回 false 不会中止后续命令、评分最高并列会随机选择、菜单选项有独立处理阶段、自定义命令包需登记而调用用简单类名。local 不等于临时 memory。

## 文件读取、存档与配置（第 7、17 章）

- 区分 mod 只读资源、合并配置、common 跨存档数据与 sector 存档数据。不同 loadCSV／loadJSON／getMergedJSON 等方法的参数含义与合并方式逐个查 SettingsAPI，不把一个读取器的 modId 或文件名规则推广到其他读取器。
- 公共设置用命名空间、默认值与版本迁移；保留未知字段，损坏数据需报告并按具体策略恢复，不能默认覆盖用户文件。不要在 advance/render 热路径读写磁盘或保存。
- CSV、规则表、.ship/.wpn 与普通 JSON 的语法／合并规则不同；验证器的支持边界要说明。配置校验不证明 Java、Janino 或游戏行为已通过。

## 依赖库与渲染（第 18—20 章）

- LazyLib、GraphicsLib、MagicLib、LunaLib、Nexerelin、BoxUtil 仅在任务需要且项目已有／获授权时使用；不因教程有章节就引入新依赖。教程标注版本与本地 mod_info／JAR 分别核对。
- 可选依赖先用实际 mod ID 判断可用性，将直接引用其类的实现隔离到适当桥接类；仅加 if 检查不必然避免类加载时链接失败。分别测试依赖存在／缺失两条路径。
- 着色器、实例化与 SSBO 先检查 GL 能力和资源清理，评估提交与填充开销，不承诺一定提速。详细渲染规则见 fx-layered-render.md；编译、硬件支持和实机效果分别说明。

## 音频（第 5 章）

音乐继续以 moci-faction-music.md 为主；核对 sounds 登记、faction 的用途映射、播放接口及真实音频编码。友好／中立／敌对交互、遭遇与战斗音乐不是同一个切换时机。8 类用途不等于最多只能有 8 首曲目。
