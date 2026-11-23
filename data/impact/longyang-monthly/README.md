# 隆阳按月资料更新演示输入

复用已归档的保山市民政局2月及9月真实统计记录，保留原稳定编号、官网、月份和`monthly_statistics`类型。未添加提标生效日或补发差额结论，全部仍待审核。

- `baseline.demo.json`：2月350元/月记录，只允许在隔离库模拟发布作为演示基线。
- `update.draft.json`：本次预览的9月1000元/月记录。
- `queries.json`：6个固定用例，包含演示基线的完整前后预期。
- `queries.current.json`：完全相同的查询参数，去掉演示基线预期，供真实项目当前状态比较。
- `provenance.json`：原资料批次、来源、月份、SHA256及未确认事项。此处不是第二份正式资料，应按原资料流程维护，勿在生产库重复建档。

从backend运行`npm.cmd run demo:impact`，报告`reports/policy-impact-longyang.md`。完整用法见[影响预览说明](../../../docs/POLICY_IMPACT_PREVIEW.md)。
