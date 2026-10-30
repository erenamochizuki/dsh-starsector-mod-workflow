# com.fs.starfarer.api.combat

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 76 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| AdmiralAIConfig | class | — |
| AdmiralAIPlugin | interface | — |
| AmmoTrackerAPI | interface | — |
| ArmorGridAPI | interface | — |
| AssignmentTargetAPI | interface | — |
| AutofireAIPlugin | interface | — |
| BaseCombatLayeredRenderingPlugin | class | implements CombatLayeredRenderingPlugin |
| BaseEveryFrameCombatPlugin | class | implements EveryFrameCombatPlugin |
| BaseHullMod | class | implements HullModEffect |
| BattleCreationContext | class | — |
| BattleObjectiveAPI | interface | extends CombatEntityAPI, AssignmentTargetAPI |
| BattleObjectiveEffect | interface | — |
| BeamAPI | interface | — |
| BeamEffectPlugin | interface | — |
| BeamEffectPluginWithReset | interface | extends BeamEffectPlugin |
| BoundsAPI | interface | — |
| CollisionClass | enum | — |
| CollisionGridAPI | interface | — |
| CombatAssignmentType | enum | — |
| CombatAsteroidAPI | interface | extends CombatEntityAPI |
| CombatEngineAPI | interface | — |
| CombatEngineLayers | enum | — |
| CombatEnginePlugin | interface | — |
| CombatEntityAPI | interface | — |
| CombatFleetManagerAPI | interface | — |
| CombatLayeredRenderingPlugin | interface | — |
| CombatNebulaAPI | interface | — |
| CombatReadinessPlugin | interface | — |
| CombatTaskManagerAPI | interface | — |
| CombatUIAPI | interface | — |
| DamageAPI | interface | — |
| DamageType | enum | — |
| DamagingProjectileAPI | interface | extends CombatEntityAPI |
| DeployedFleetMemberAPI | interface | extends AssignmentTargetAPI |
| DroneLauncherShipSystemAPI | interface | — |
| EmpArcEntityAPI | interface | extends CombatEntityAPI |
| EngagementResultAPI | interface | — |
| EngineSlotAPI | interface | — |
| EveryFrameCombatPlugin | interface | extends CombatEnginePlugin |
| EveryFrameWeaponEffectPlugin | interface | — |
| EveryFrameWeaponEffectPluginWithAdvanceAfter | interface | extends EveryFrameWeaponEffectPlugin |
| FighterLaunchBayAPI | interface | — |
| FighterWingAPI | interface | — |
| FluxTrackerAPI | interface | — |
| FogOfWarAPI | interface | — |
| GuidedMissileAI | interface | — |
| HullModEffect | interface | — |
| HullModFleetEffect | interface | — |
| MissileAIPlugin | interface | — |
| MissileAPI | interface | extends DamagingProjectileAPI |
| MissileRenderDataAPI | interface | — |
| MutableShipStatsAPI | interface | — |
| MutableStat | class | — |
| MutableStatWithTempMods | class | extends MutableStat |
| OnFireEffectPlugin | interface | — |
| OnHitEffectPlugin | interface | — |
| PhaseCloakSystemAPI | interface | — |
| ProximityExplosionEffect | interface | — |
| ProximityFuseAIAPI | interface | — |
| ShieldAPI | interface | — |
| ShipAIConfig | class | implements Cloneable |
| ShipAIPlugin | interface | — |
| ShipAPI | interface | extends CombatEntityAPI |
| ShipCommand | enum | — |
| ShipEngineControllerAPI | interface | — |
| ShipHullSpecAPI | interface | extends WithSourceMod |
| ShipSystemAIScript | interface | — |
| ShipSystemAPI | interface | — |
| ShipSystemSpecAPI | interface | extends WithSourceMod |
| ShipVariantAPI | interface | — |
| ShipwideAIFlags | class | — |
| StatBonus | class | — |
| ViewportAPI | interface | — |
| WeaponAPI | interface | — |
| WeaponEffectPluginWithInit | interface | — |
| WeaponGroupAPI | interface | — |
