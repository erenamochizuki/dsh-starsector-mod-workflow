# com.fs.starfarer.api.impl.campaign.fleets

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 42 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| AutoDespawnScript | class | implements EveryFrameScript |
| BaseGenerateFleetOfficersPlugin | class | implements GenerateFleetOfficersPlugin |
| BaseLimitedFleetManager | class | implements EveryFrameScript, FleetEventListener |
| BaseRouteFleetManager | class | implements EveryFrameScript, RouteFleetSpawner |
| CustomFleets | class | — |
| DefaultFleetInflater | class | implements FleetInflater, AutofitPluginDelegate |
| DefaultFleetInflaterParams | class | — |
| DisposableAggroAssignmentAI | class | implements EveryFrameScript |
| DisposableFleetManager | class | extends PlayerVisibleFleetManager |
| DisposableLuddicPathFleetManager | class | extends DisposableFleetManager |
| DisposablePirateFleetManager | class | extends DisposableFleetManager |
| EconomyFleetAssignmentAI | class | extends RouteFleetAssignmentAI |
| EconomyFleetRouteManager | class | extends BaseRouteFleetManager implements FleetEventListener |
| FleetFactory | class | — |
| FleetFactoryV3 | class | — |
| FleetParams | class | — |
| FleetParamsV3 | class | — |
| GenerateFleetOfficersPlugin | interface | extends GenericPlugin |
| LuddicPathFleetManager | class | extends BaseLimitedFleetManager |
| MercAssignmentAIV2 | class | extends RouteFleetAssignmentAI |
| MercFleetManagerV2 | class | extends BaseRouteFleetManager |
| PatrolAssignmentAI | class | implements EveryFrameScript |
| PatrolAssignmentAIV2 | class | implements EveryFrameScript |
| PatrolAssignmentAIV4 | class | extends RouteFleetAssignmentAI implements FleetActionTextProvider |
| PatrolFleetManager | class | extends BaseCampaignEventListener implements EveryFrameScript |
| PatrolFleetManagerV2 | class | extends BaseCampaignEventListener implements |
| PersonalFleetHoracioCaden | class | extends PersonalFleetScript |
| PersonalFleetOxanaHyder | class | extends PersonalFleetScript |
| PersonalFleetScript | class | implements EveryFrameScript, FleetEventListener |
| PilgrimageFleetAssignmentAI | class | extends RouteFleetAssignmentAI |
| PilgrimageFleetRouteManager | class | extends BaseRouteFleetManager implements FleetEventListener |
| PirateFleetManager | class | extends BaseLimitedFleetManager |
| PlayerVisibleFleetManager | class | extends BaseLimitedFleetManager |
| RouteLocationCalculator | class | — |
| RouteManager | class | implements FleetEventListener |
| SDFBase | class | extends PersonalFleetScript |
| SDFHegemony | class | extends SDFBase |
| SDFLeague | class | extends SDFBase |
| SDFLuddicChurch | class | extends SDFBase |
| SDFTriTachyon | class | extends SDFBase |
| SeededFleetManager | class | implements FleetEventListener, EveryFrameScript |
| SourceBasedFleetManager | class | implements FleetEventListener, EveryFrameScript |
