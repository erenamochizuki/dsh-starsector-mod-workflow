# com.fs.starfarer.api.impl.campaign.intel

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 26 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| AnalyzeEntityIntelCreator | class | implements GenericMissionCreator |
| AnalyzeEntityMissionIntel | class | extends BaseMissionIntel |
| BaseEventManager | class | implements EveryFrameScript |
| BaseIntelPlugin | class | implements IntelInfoPlugin, CallableEvent, EveryFrameScript, CommSnifferReadableIntel |
| BaseMissionIntel | class | extends BaseIntelPlugin |
| FactionCommissionIntel | class | extends BaseMissionIntel implements EveryFrameScript, |
| FactionCommissionPlugin | interface | extends EconomyTickListener |
| FactionHostilityIntel | class | extends BaseIntelPlugin |
| FactionHostilityManager | class | extends BaseEventManager |
| GenericMissionManager | class | extends BaseEventManager |
| GensHannanMachinations | class | extends BaseIntelPlugin |
| LuddicChurchImmigrationDeal | class | extends BaseIntelPlugin |
| MessageIntel | class | extends BaseIntelPlugin |
| NewMessagesIntel | class | extends BaseIntelPlugin |
| PerseanLeagueMembership | class | extends BaseIntelPlugin implements EconomyTickListener, CommissionEndedListener |
| PersonBountyIntel | class | extends BaseIntelPlugin implements EveryFrameScript, FleetEventListener |
| PersonBountyManager | class | extends BaseEventManager |
| ProcurementMissionCreator | class | implements GenericMissionCreator |
| ProcurementMissionIntel | class | extends BaseMissionIntel |
| PromoteOfficerIntel | class | extends BaseIntelPlugin |
| SindrianDiktatFuelDeal | class | extends BaseIntelPlugin implements EconomyTickListener |
| SurveyPlanetIntelCreator | class | implements GenericMissionCreator |
| SurveyPlanetMissionIntel | class | extends BaseMissionIntel implements SurveyPlanetListener |
| SystemBountyIntel | class | extends BaseIntelPlugin implements EveryFrameScript, FleetEventListener |
| SystemBountyManager | class | extends BaseEventManager |
| TriTachyonDeal | class | extends BaseIntelPlugin implements EconomyUpdateListener |
