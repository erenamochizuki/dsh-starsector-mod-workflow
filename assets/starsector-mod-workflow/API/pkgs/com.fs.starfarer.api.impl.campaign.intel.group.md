# com.fs.starfarer.api.impl.campaign.intel.group

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 19 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| BaseFGAction | class | implements FGAction |
| BaseFGEventListener | class | implements FGIEventListener |
| BlockadeFGI | class | extends GenericRaidFGI |
| FGAction | interface | — |
| FGBlockadeAction | class | extends FGDurationAction implements GenericPayloadAction |
| FGBlockadePlanetAction | class | extends FGBlockadeAction |
| FGDurationAction | class | extends BaseFGAction |
| FGRaidAction | class | extends FGDurationAction implements FleetActionDelegate, GenericPayloadAction |
| FGTravelAction | class | extends BaseFGAction |
| FGWaitAction | class | extends FGDurationAction |
| FleetGroupIntel | class | extends BaseIntelPlugin implements RouteFleetSpawner |
| GenericRaidFGI | class | extends FleetGroupIntel |
| KnightsOfLuddTakeoverExpedition | class | extends BlockadeFGI implements EconomyTickListener |
| PerseanLeagueBlockade | class | extends BlockadeFGI |
| PerseanLeaguePunitiveExpedition | class | extends GenericRaidFGI |
| SindrianDiktatPunitiveExpedition | class | extends GenericRaidFGI |
| TestFleetGroupIntel | class | extends FleetGroupIntel |
| TTMercenaryAttack | class | extends GenericRaidFGI |
| TTMercenaryReversedAttack | class | extends GenericRaidFGI |
