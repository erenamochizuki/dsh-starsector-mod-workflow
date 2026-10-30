# com.fs.starfarer.api.impl.campaign.abilities

<!-- 由 node Script\gen-index.mjs --api 生成，请勿手改。成员签名用 api-src 查。 -->

共 21 个类型。来源：starfarer.api.zip

| 类型 | 种类 | 继承/实现 |
|---|---|---|
| BaseAbilityPlugin | class | implements AbilityPlugin, EveryFrameScript |
| BaseDurationAbility | class | extends BaseAbilityPlugin |
| BaseToggleAbility | class | extends BaseAbilityPlugin |
| DistressCallAbility | class | extends BaseDurationAbility implements RouteFleetSpawner |
| DistressCallResponseAssignmentAI | class | extends BaseAssignmentAI |
| DistressCallResponsePirateAssignmentAI | class | extends BaseAssignmentAI |
| DurationAbilityWithCost2 | class | extends BaseDurationAbility |
| EmergencyBurnAbility | class | extends BaseDurationAbility |
| FractureJumpAbility | class | extends BaseDurationAbility |
| GenerateSlipsurgeAbility | class | extends DurationAbilityWithCost2 |
| GoDarkAbility | class | extends BaseToggleAbility |
| GraviticScanAbility | class | extends BaseToggleAbility |
| GraviticScanData | class | — |
| InterdictionPulseAbility | class | extends BaseDurationAbility |
| RemoteSurveyAbility | class | extends BaseDurationAbility |
| ReversePolarityToggle | class | extends ToggleAbilityWithCost |
| ScavengeAbility | class | extends BaseDurationAbility |
| SensorBurstAbility | class | extends BaseDurationAbility |
| SustainedBurnAbility | class | extends BaseToggleAbility |
| ToggleAbilityWithCost | class | extends BaseToggleAbility |
| TransponderAbility | class | extends BaseToggleAbility |
