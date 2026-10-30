# Moci 势力音乐

用于新增或替换势力主题、交互与战斗音乐。当前绑定游戏 0.98 的音乐选择逻辑于 2026-10-24 核对；更换游戏版本后按实际源码重新确认。

## 三处接线

- MociShipPack/data/world/factions/<势力 ID>.faction：music 对象把场景映射到音乐集 ID。
- MociShipPack/data/config/sounds.json：music 对象登记音乐集，每个集为曲目数组；曲目包含 file、source、volume、randomStart 等字段。
- MociShipPack/sounds/moci/music/：当前项目的势力音乐资源目录；source 与 file 拼接后须能找到实际文件。

一个音乐集可含多首曲目，不同用途也可共用一个音乐集。下面的 8 类是用途，不是最多只能使用 8 首音乐。

| faction.music 键 | 用途 |
|---|---|
| theme | 势力主题 |
| market_friendly | 友好市场交互 |
| market_neutral | 中立市场交互 |
| market_hostile | 敌对市场交互 |
| encounter_friendly | 友好舰队遭遇 |
| encounter_neutral | 中立舰队遭遇 |
| encounter_hostile | 敌对舰队遭遇 |
| music_combat_set | 与该势力作为对手的舰队进入战斗 |

敌对遭遇的音乐不会自动成为战斗音乐。设置势力专属战斗曲使用 music_combat_set，不是 combat 或 battle。不要覆盖全局 music_combat 曲库来实现某一势力的需求，否则会影响其他战斗。

## 当前音乐选择逻辑

依据工程 starfarer.api/com/fs/starfarer/api/impl/MusicPlayerPluginImpl.java，并与绑定游戏 starsector-core/starfarer.api.zip 中同名源码核对：

- 常规市场和舰队交互按实际关系/遭遇状态选择对应键；剧情、任务或实体的指定音乐可优先覆盖，不能保证仅改 faction 就覆盖所有特殊场景。
- 常规战斗先检查对方舰队的 $combatMusicSetId；未指定时读取对方势力 music.music_combat_set，再回落到全局 music_combat。不是玩家属于该势力就能改变所有战斗音乐。
- 音乐插件来自当前 settings 的 musicPlugin。其他 mod 若替换插件或主动播放音乐，需核对实际优先级，不能擅自移除别人的配置。

## 实施与核对

先确认势力 ID/名称、原音乐集是否被别处共用，以及用户对两首或多首音频的顺序要求。第一首日常、第二首敌对/战斗这类请求，可把 theme、友好/中立市场和遭遇分给第一首，把两个 hostile 场景和 music_combat_set 分给第二首；以用户当次要求为准。

保留原始音频来源。替换旧曲前备份，使用稳定的资源名，不只把随机下载文件名当作曲库 ID。核对实际容器与编码；.ogg 扩展名本身不证明内部是 Vorbis，不要直接把其他格式改扩展名。当前两首尼尔加资源已核对为 Ogg Vorbis、44.1 kHz、双声道；新素材仍需重新检查。符合要求时直接复制，避免无必要的重编码。

sounds.json 采用游戏允许的注释与尾逗号格式；使用适用的解析方式，编辑时保留其他声音登记。音量与起播行为沿用原有设置或用户要求，不把某次使用的 0.35 当作所有音乐的统一值。登记中的 source 是资源目录，file 是文件名，避免重复拼目录或大小写/拼写不一致。

完成后核对 faction 的每个音乐 ID 均已登记，登记中的音频文件存在，复制内容与用户指定来源一致，其他势力/音效登记未被意外修改。当前 moci.mjs verify 不覆盖这些音乐接线和音频解码，不能用它的未检查结果宣称验证通过。配置/文件检查与进游戏试听分别说明；试听关注友好/敌对交互、进入战斗的切换、音量和曲尾衔接。

只改音乐及配置通常不需要构建 Java JAR。优先修改 MociShipPack 中的 faction、sounds.json 和音频，不直接替换游戏副本。用 moci.mjs sync --file <工程相对路径> 重复列出本次文件，默认只生成计划；向用户展示清单、验证结果和游戏目标并询问。确认本次范围后才加 --game-approved 执行备份与同步，保留游戏其他文件。核对发布收据及哈希，不启动或关闭游戏来绕过运行状态检查。

## 尼尔加实例

当前势力 ID 为 Moci_NergalHeavyIndustries。2026-10-24 的分配为：

- Nergalbgm：sounds/moci/music/Nergalbgm.ogg，来自用户提供的 1025310170.ogg；用于 theme 和友好/中立市场及遭遇。
- Nergal_combat：sounds/moci/music/Nergal_combat.ogg，来自用户提供的 66670835.ogg；用于 market_hostile、encounter_hostile、music_combat_set。

这是已完成修改的实例，当时已修改 MociShipPack 并按旧偏好同步游戏；不是要求未来任务重新替换或固定采用这两首。用户随后改为游戏同步必须先询问，今后按新偏好执行。收尾按 SKILL.md 末尾清单规则列出实际改动文件及同步状态。
