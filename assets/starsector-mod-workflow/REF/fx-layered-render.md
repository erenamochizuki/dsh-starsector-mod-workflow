# 战斗分层渲染与特效

按需求选引擎粒子、SpriteAPI 自绘或 OpenGL／着色器；不存在固定三种方法或固定性能排序。优先复用 Moci 现有渲染工具，批量、透明叠加、像素填充和状态切换都可能成为瓶颈。

## 注册与初始化

0.98 引擎的 CombatEngine.addLayeredRenderingPlugin 创建 CustomCombatEntity 并排队注册；实体初始化时由引擎调用 plugin.init(entity)。不要在添加后手动重复 init。若覆写 init，应调用 super.init(entity)，把依赖宿主的初始化放在该回调中。

添加方法返回不表示 init 已完成；调用方可以立即设置返回宿主的位置：

```java
MyFx fx = new MyFx();
CombatEntityAPI host = engine.addLayeredRenderingPlugin(fx);
if (host != null) host.getLocation().set(location);
```

getRenderRadius() 应覆盖相对宿主的最大绘制范围，包括运动偏移、旋转后矩形的边界与光晕。半径过小会提前裁剪；盲目加几千单位会增加屏外绘制。模板的保守常数是待调整示例，不能当通用公式。通过 getActiveLayers 选择层并验证遮挡顺序、镜头边缘及宿主位置。

## 素材与坐标

SettingsAPI.getSprite(filename) 的文档要求文件已加载。尚未加载的动态素材先 loadTexture；通过 settings graphics 等已加载的素材不必每帧重载。类别／键形式只能查询实际登记的键，不能假定路径名对应同名类别键。缺失时有限次报告并跳过该层。

战斗 SpriteAPI 的尺寸通常使用世界坐标；不要无条件乘 viewport.getViewMult()。以屏幕像素为目标的 UI／特效应按当前投影换算并实测缩放。不存在固定缩放倍率。

## 状态、时间与清理

- 修改 GL 矩阵、混合、纹理、程序、VAO/VBO/SSBO 等状态时，用 finally 确保恢复；异常捕获不能替代状态恢复。按具体错误处理并限频记录，不把吞掉所有 Throwable 作为规则。
- advance 使用 amount 推进寿命、速度和生成预算，按效果要求处理暂停；不要依赖 render 调用次数推进动画或做游戏伤害。
- SpriteAPI 实例的颜色、透明度、尺寸等是可变状态；共享实例需明确所有权或每次完整设置，避免串色串尺寸。
- 自建 GPU 资源需在有效 GL 上下文释放；GL30/GL43 等功能先检查硬件能力并提供降级方案。编译成功不能证明显卡支持或渲染正确。
- 特效的视觉范围与实际命中判定分别核对；美术光晕可以超出伤害半径，但不能误导玩法。按对象数、寿命、绘制面积与过度绘制评估性能。

验证：素材加载、层级、镜头缩放与边缘裁剪、暂停、多个实例、正常过期、离开战斗、能力不足时降级。代码编译与上述实机项目分开报告。

来源：本地 BaseCombatLayeredRenderingPlugin、SettingsAPI；绑定游戏 starfarer_obf.jar 的 CombatEngine 和 CustomCombatEntity.init 字节码。教程补充见第 8、20 章，入口见 moci-tutorial-checklist.md。
