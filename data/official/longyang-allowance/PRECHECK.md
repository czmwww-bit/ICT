# 首批资料实际预检查

执行时间：2026-11-16T05:37:57.926Z（UTC）；获取日期按Asia/Shanghai为2026-11-16。

- 文件数：2；条款数：16。
- 独立校验退出码：0。
- 数据库dry-run退出码：0。
- 7张表行数及内容摘要前后相同：true。
- 未执行实际导入或发布；本批记录仍只存在于文件。
- 人工原文、语义、区划及后续变更核对：待执行。

实际dry-run输出：

```json
{
  "file": "../data/official/longyang-allowance/batch.draft.json",
  "added": 18,
  "modified": 0,
  "unchanged": 0,
  "errors": 0,
  "details": [
    {
      "kind": "document",
      "id": "YN_GLT_2024_113",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "document",
      "id": "LY_GLT_INTERPRETATION_2025",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_ELIGIBILITY",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_PROVINCIAL_RATES",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_MONTHLY_PAYMENT",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_AUTO_PROCESS",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_MISSING_LIST",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_DYNAMIC_CHECK",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_UNREACHABLE",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_HOUSEHOLD_SEPARATION",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_HOUSEHOLD_MOVE",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_DEATH",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_SPECIAL_ACCOUNT",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_PROXY_PAYMENT",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_CARD_ACTIVATION",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_HOME_CARD",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_DUTIES",
      "version": 1,
      "action": "added"
    },
    {
      "kind": "clause",
      "id": "YN_GLT_EFFECT_AND_REPEAL",
      "version": 1,
      "action": "added"
    }
  ],
  "messages": []
}
```

详细命令、错误流、批次哈希及表摘要见precheck.json。修改JSON后必须重新预检查，旧报告不代表修改后的版本。
