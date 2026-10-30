# com.fs.starfarer.api.impl.campaign.intel.events

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 50 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| BaseEventFactor | class | implements EventFactor |
| BaseEventIntel | class | extends BaseIntelPlugin implements EconomyTickListener |
| BaseFactorTooltip | class | implements TooltipCreator |
| BaseHostileActivityCause2 | class | implements HostileActivityCause2 |
| BaseHostileActivityFactor | class | extends BaseEventFactor implements HostileActivityFactor |
| BaseOneTimeFactor | class | extends BaseEventFactor |
| CommerceBountyManager | class | implements EveryFrameScript |
| DiktatFuelBonusScript | class | — |
| DisposableHostileActivityFleetManager | class | extends DisposableFleetManager |
| EstablishedPolityScript | class | implements EconomyUpdateListener |
| EventFactor | interface | — |
| HABlowbackFactor | class | extends BaseEventFactor |
| HAColonyDefensesFactor | class | extends BaseEventFactor |
| HADefensiveMeasuresFactor | class | extends BaseEventFactor |
| HAHersperusTacBombardmentFactor | class | extends BaseOneTimeFactor |
| HAKazeronTacBombardmentFactor | class | extends BaseOneTimeFactor |
| HALuddicPathDealFactor | class | extends BaseOneTimeFactor |
| HAPatherBaseDestroyedFactor | class | extends BaseOneTimeFactor |
| HAPirateBaseDestroyedFactor | class | extends BaseOneTimeFactor |
| HAPirateKingDealFactor | class | extends BaseOneTimeFactor |
| HAShipsDestroyedFactor | class | extends BaseOneTimeFactor |
| HAShipsDestroyedFactorHint | class | extends HAShipsDestroyedFactor |
| HegemonyAICoresActivityCause | class | extends BaseHostileActivityCause2 |
| HegemonyHostileActivityFactor | class | extends BaseHostileActivityFactor implements InspectionEndedListener |
| HostileActivity | class | extends BaseMarketConditionPlugin |
| HostileActivityCause | interface | — |
| HostileActivityCause2 | interface | — |
| HostileActivityEventIntel | class | extends BaseEventIntel implements EconomyUpdateListener, FleetEventListener |
| HostileActivityFactor | interface | — |
| HostileActivityManager | class | implements EveryFrameScript |
| KantasProtectionOneTimeFactor | class | extends BaseOneTimeFactor |
| KantasProtectionPirateActivityCause2 | class | extends BaseHostileActivityCause2 |
| KantasWrathPirateActivityCause2 | class | extends BaseHostileActivityCause2 |
| LuddicChurchHostileActivityFactor | class | extends BaseHostileActivityFactor implements |
| LuddicChurchStandardActivityCause | class | extends BaseHostileActivityCause2 |
| LuddicPathAgreementHostileActivityCause2 | class | extends BaseHostileActivityCause2 |
| LuddicPathHostileActivityFactor | class | extends BaseHostileActivityFactor implements PatherCellListener, FGIEventListener |
| PerseanLeagueHostileActivityFactor | class | extends BaseHostileActivityFactor implements |
| PiracyRespiteScript | class | implements EconomyUpdateListener |
| PirateBasePirateActivityCause2 | class | extends BaseHostileActivityCause2 |
| PirateHostileActivityFactor | class | extends BaseHostileActivityFactor implements FGIEventListener |
| RemnantHostileActivityFactor | class | extends BaseHostileActivityFactor |
| RemnantNexusActivityCause | class | extends BaseHostileActivityCause2 |
| SindrianDiktatHostileActivityFactor | class | extends BaseHostileActivityFactor |
| SindrianDiktatStandardActivityCause | class | extends BaseHostileActivityCause2 |
| StandardLuddicPathActivityCause2 | class | extends BaseHostileActivityCause2 |
| StandardPerseanLeagueActivityCause | class | extends BaseHostileActivityCause2 |
| StandardPirateActivityCause2 | class | extends BaseHostileActivityCause2 |
| TriTachyonHostileActivityFactor | class | extends BaseHostileActivityFactor |
| TriTachyonStandardActivityCause | class | extends BaseHostileActivityCause2 |
