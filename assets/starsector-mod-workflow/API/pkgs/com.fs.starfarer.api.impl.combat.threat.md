# com.fs.starfarer.api.impl.combat.threat

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 36 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| AttackSwarmPhaseModeScript | class | extends BaseEveryFrameCombatPlugin |
| BaseEnergyLashActivatedSystem | class | extends BaseShipSystemScript implements EnergyLashActivatedSystem |
| BaseFragmentMissileEffect | class | implements OnFireEffectPlugin, EveryFrameWeaponEffectPlugin, FragmentWeapon |
| ConstructionSwarmSystemAI | class | implements ShipSystemAIScript |
| ConstructionSwarmSystemScript | class | extends BaseShipSystemScript |
| DevouringSwarmMissileEffect | class | extends BaseFragmentMissileEffect implements OnHitEffectPlugin |
| DisplacerGlowScript | class | extends BaseEnergyLashActivatedSystem |
| DisposableThreatFleetManager | class | extends DisposableFleetManager implements CurrentLocationChangedListener |
| EnergyLashActivatedSystem | interface | — |
| EnergyLashSystemAI | class | implements ShipSystemAIScript |
| EnergyLashSystemScript | class | extends BaseShipSystemScript |
| ExtractionProtocolSystemScript | class | extends BaseEnergyLashActivatedSystem |
| FragmentCoordinatorHullmod | class | extends BaseHullMod |
| FragmentSwarmHullmod | class | extends BaseHullMod |
| FragmentVolleySystemScript | class | extends BaseEnergyLashActivatedSystem implements WeaponRangeModifier |
| FragmentWeapon | interface | — |
| IncursionModeSystemScript | class | extends BaseEnergyLashActivatedSystem |
| KineticFragmentMissileEffect | class | extends BaseFragmentMissileEffect |
| NeutronTorpedoOnFireEffect | class | implements OnFireEffectPlugin |
| RoilingSwarmEffect | class | extends BaseCombatLayeredRenderingPlugin |
| SecondaryFabricatorHullmod | class | extends BaseHullMod |
| SeekerFragmentMissileEffect | class | extends BaseFragmentMissileEffect |
| SwarmLauncherEffect | class | implements OnFireEffectPlugin, EveryFrameWeaponEffectPlugin, SwarmLaunchingWeapon |
| SwarmLaunchingWeapon | interface | — |
| ThreatCombatStrategyAI | class | — |
| ThreatCombatStrategyForBothSidesPlugin | class | extends BaseEveryFrameCombatPlugin |
| ThreatFIDConfig | class | implements FIDConfigGen |
| ThreatFleetBehaviorScript | class | implements EveryFrameScript |
| ThreatHullmod | class | extends BaseHullMod |
| ThreatShipConstructionScript | class | extends BaseEveryFrameCombatPlugin |
| ThreatShipReclamationScript | class | extends BaseEveryFrameCombatPlugin |
| ThreatSwarmAI | class | implements ShipAIPlugin |
| UnstableFragmentMissileEffect | class | extends BaseFragmentMissileEffect |
| VoidblasterEffect | class | implements OnHitEffectPlugin, OnFireEffectPlugin, EveryFrameWeaponEffectPlugin, |
| VoltaicCannonEffect | class | implements OnHitEffectPlugin, OnFireEffectPlugin, EveryFrameWeaponEffectPlugin |
| VoltaicDischargeOnFireEffect | class | implements OnFireEffectPlugin, EveryFrameWeaponEffectPlugin, |
