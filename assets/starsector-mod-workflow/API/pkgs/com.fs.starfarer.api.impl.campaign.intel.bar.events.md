# com.fs.starfarer.api.impl.campaign.intel.bar.events

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 37 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| BarEventManager | class | implements EveryFrameScript |
| BaseBarEvent | class | implements PortsideBarEvent |
| BaseBarEventCreator | class | implements GenericBarEventCreator |
| BaseBarEventIntel | class | extends BaseIntelPlugin implements PortsideBarEvent |
| BaseBarEventWithPerson | class | extends BaseBarEvent |
| BaseGetCommodityBarEvent | class | extends BaseBarEvent |
| CorruptPLClerkSuppliesBarEvent | class | extends BaseGetCommodityBarEvent |
| CorruptPLClerkSuppliesBarEventCreator | class | extends BaseBarEventCreator |
| DeliveryBarEvent | class | extends BaseGetCommodityBarEvent |
| DeliveryBarEventCreator | class | extends BaseBarEventCreator |
| DeliveryFailureConsequences | class | implements EveryFrameScript, FleetEventListener |
| DeliveryMissionIntel | class | extends BaseMissionIntel |
| DiktatLobsterBarEvent | class | extends BaseGetCommodityBarEvent |
| DiktatLobsterBarEventCreator | class | extends BaseBarEventCreator |
| LuddicCraftBarEvent | class | extends BaseGetCommodityBarEvent |
| LuddicCraftBarEventCreator | class | extends BaseBarEventCreator |
| LuddicFarmerBarEvent | class | extends BaseGetCommodityBarEvent |
| LuddicFarmerBarEventCreator | class | extends BaseBarEventCreator |
| LuddicPathBaseBarEvent | class | extends BaseBarEventWithPerson |
| MercsOnTheRunBarEvent | class | extends BaseGetCommodityBarEvent |
| MercsOnTheRunBarEventCreator | class | extends BaseBarEventCreator |
| PirateBaseRumorBarEvent | class | extends BaseBarEvent |
| PlanetaryShieldBarEvent | class | extends BaseBarEventWithPerson |
| PlanetaryShieldBarEventCreator | class | extends BaseBarEventCreator |
| PlanetaryShieldIntel | class | extends BaseIntelPlugin |
| QuartermasterCargoSwapBarEvent | class | extends BaseGetCommodityBarEvent |
| QuartermasterCargoSwapBarEventCreator | class | extends BaseBarEventCreator |
| ScientistAICoreBarEvent | class | extends BaseGetCommodityBarEvent |
| ScientistAICoreBarEventCreator | class | extends BaseBarEventCreator |
| ScientistAICoreIntel | class | extends BaseIntelPlugin |
| SpecBarEventCreator | class | extends BaseBarEventCreator |
| TriTachLoanBarEvent | class | extends BaseGetCommodityBarEvent |
| TriTachLoanBarEventCreator | class | extends BaseBarEventCreator |
| TriTachLoanIncentiveScript | class | implements EveryFrameScript |
| TriTachLoanIntel | class | extends BaseIntelPlugin |
| TriTachMajorLoanBarEvent | class | extends TriTachLoanBarEvent |
| TriTachMajorLoanBarEventCreator | class | extends BaseBarEventCreator |
