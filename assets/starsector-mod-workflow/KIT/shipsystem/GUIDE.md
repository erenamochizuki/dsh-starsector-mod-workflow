# 舰船系统（shipsystem）

此骨架示范 STAT_MOD 属性加成，不代表舰船系统只能修改属性。复杂武器行为可由系统控制并与武器效果协作，先核对现有实现。

## 步骤

1. 使用 Moci 的 Script/moci.mjs new shipsystem 预览骨架，按主 skill 的路径与命名规则生成。
2. 修改 BONUS 和 apply/unapply；按设计决定是否使用 effectLevel 渐变，及时撤销本系统自己的 modifier ID。
3. 在 data/shipsystems/ship_systems.csv 登记或核对系统 ID、时长、冷却、耗散等字段；data/shipsystems/<id>.system 的 statsScript 指向实际类。
4. 在 data/hulls/ship_data.csv 的 system id 列绑定普通 F 系统；防御系统核对 defense id 列。不要向 .ship/.variant 凭空添加 systemId。
5. 验收进入、持续、退出、冷却和中断状态；核对不同舰体、暂停、死亡及自身 modifier 的清理。

## 生命周期

默认推进路径在非生效状态调用 unapply；如果启用 runScriptWhileIdle，正常 idle/cooldown 推进也可能调用 apply，不能只依赖 unapply 收尾。按 state/effectLevel 在 apply 内明确恢复状态，并核对当前引擎实现。

## 相关

骨架见 SKELETON.java，配置骨架见 SYSTEM.json；recipe.json 提供接线提醒。src Java 编译和工作区 JAR 更新遵循主 skill；仅改配置无需重新打包 Java。游戏写入仍需先确认本次范围。
