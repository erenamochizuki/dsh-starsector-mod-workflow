# com.fs.starfarer.api.impl.campaign.events

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 16 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| BaseEventPlugin | class | implements CampaignEventPlugin, CampaignEventListener |
| CivilDisorder | class | extends BaseEventPlugin |
| CoreEventProbabilityManager | class | extends BaseCampaignEventListener implements EveryFrameScript |
| FactionHostilityEvent | class | extends BaseEventPlugin |
| FleetLogEvent | class | extends BaseEventPlugin |
| FoodShortageEvent | class | extends BaseEventPlugin |
| InvestigationEvent | class | extends BaseEventPlugin |
| InvestigationEventCommSniffer | class | extends InvestigationEvent |
| InvestigationEventGoodRepWithOther | class | extends BaseEventPlugin |
| InvestigationEventSmugglingV2 | class | extends BaseEventPlugin |
| OfficerManagerEvent | class | extends BaseEventPlugin implements CallableEvent, ColonyInteractionListener, EveryFrameScript |
| PriceUpdate | class | implements PriceUpdatePlugin |
| RecentUnrestEvent | class | extends BaseEventPlugin |
| RepTrackerEvent | class | extends BaseEventPlugin |
| TestEvent | class | extends BaseEventPlugin |
| TradeInfoUpdateEvent | class | extends BaseEventPlugin |
