# 政策更新影响预览

发布前，用同一份当前项目快照、同一组参数跑更新前/后。只比较资料查询，不生成办事卡、不判资格，不推断提标或补发。

## 先运行隆阳演示

已有backend依赖、`.env`、已迁移的项目库和不同的空`DB_TEST_NAME`（本机`_test`库）时：

```powershell
Set-Location D:\ICT\backend
npm.cmd run demo:impact
```

终端显示简表，并生成：

- `reports/policy-impact-longyang.md`：人工查看，含要求的五列总览及逐题原文、关键字段、时间、来源和触发资料。
- `reports/policy-impact-longyang.json`：逐题参数、增减、版本/字段变化、来源、假定核对字段、项目库前后7表摘要及输入SHA256。

**当前项目库尚无已发布的正式隆阳资料。** 演示使用真实2月资料，但只在隔离库假定发布为基线，再模拟发布9月；报告明确标记`demo_augmented_project_snapshot`，不能当作真实审核状态。两个原始统计来源、金额和发放月份在`data/impact/longyang-monthly/provenance.json`中。

|演示用例|更新前|模拟发布后|结果|
|---|---|---|---|
|2月|2月条款v1，350元/月|相同条款v1，350元/月|不变|
|9月|未命中|新增9月条款v1，1000元/月|新增，带9月官网来源|
|没说月份|不查询|不查询|需确认年份和月份，不拿一条记录回答当前标准|
|施甸、无关事项|未命中|仍未命中|不变，仅说明这些实跑参数|
|3月|未命中|仍未命中|不从9月倒推3月|

6个用例，5对真实查询；新增影响1例、不变4例、缺参数1例。缺参不计为无影响，也不计作预期通过。提标文件、生效日期和差额补发规则仍待核实。

## 预览真实当前项目库

不传`--demo-baseline`，就完全采用当前项目库的审核状态，不额外注入2月：

```powershell
npm.cmd run data:impact -- --file ../data/impact/longyang-monthly/update.draft.json --cases ../data/impact/longyang-monthly/queries.current.json --date 2026-11-19 --out ../reports/policy-impact-current
```

此命令已实际执行。当前真实基线没有2月已发布记录，所以2月前后均为空；不能拿演示基线结果冒充真实状态。生产资料审核后，改成自己的待审核批次和查询用例即可，`--out`指定报告前缀。

用例沿用`eval/query`的扁平字段，增加`queryType`、`recordMonth`、`ageBandCode`和可选前后预期：

```json
{
  "version": "my-impact-v1",
  "cases": [
    {
      "id": "FEB",
      "description": "核对隆阳2月百岁档",
      "queryType": "payment",
      "matterId": "HIGH_AGE_ALLOWANCE",
      "regionCode": "530502",
      "asOf": "2026-11-19",
      "recordMonth": "2026-02",
      "ageBandCode": "100_PLUS",
      "expectedBefore": ["BS_GLT_202602_LY_100PLUS@1"],
      "expectedAfter": ["BS_GLT_202602_LY_100PLUS@1"]
    }
  ]
}
```

- `payment`调用原`findPaymentRecords`；月份必须明确，null表示待确认。区县参数由调用方按任务确认，金额任务不以常住地代替户籍地。
- `candidates`调用原`findCandidates`，使用matterId/regionCode/asOf；不自动按问题语义筛选。
- `clause`使用`idQuery`及可选version调用原`getClause`。指定版本时显式读取已审核历史；未指定只取当前发布版本。
- 不写queryType时按idQuery、月份/年龄档字段推断查询类型；仍不从description提取业务参数。payment缺asOf时使用本次捕获的预览日期，两边始终相同并写入报告；其他查询缺日期则标待补参数。
- 可选`expectedBefore/expectedAfter`是完整的`编号@版本`集合；沿用的`references`可作为更新后预期。预期顺序不影响结果，未执行的查询不算通过。原用例带phase时不会自动筛选phase，需事先选择本轮要跑的用例。

## 运行保护与发布约束

1. 项目库只SELECT及一致性快照读取。克隆全部版本、区域和审核事件，包含工作草稿，但实际查询继续默认排除草稿/样例。克隆后验证内容指纹；模拟前/后复用同一隔离基线。
2. 隔离使用原`withEmptyTestDatabase`：仅本机、项目库与`_test`库必须不同、开始必须空库，成功仅清理本轮7表。有外来表则停止，不清空。迁移失败留下不完整现场时明确报错，不自动删未知表。
3. 新更新使用原`planImport/importBatch/publish`。文件先于条款发布，版本冲突、坏关联、无依据日期等照常拒绝；不因发布日期较新自动使旧条款失效。
4. 新文件未填checkedAt/checkedBy时，仅在内存副本假定完成核对，报告列明，输入文件不变。**已入库的相同版本**欠核对字段时停止，按原规则准备新版本，不篡改旧载荷绕过发布检查。
5. 正式项目库7表（包括版本、审核、历史批次、指针）前后逐行摘要比较。若有并发维护导致变化，停止并要求核对重试，不将变化擅自归因于本工具。隔离复制用单独批次审计标记，不是正式备份恢复的审计还原。
6. 任一查询失败、校验失败或隔离不可用，命令非0退出；报告路径检查通过后记录`<out>.error.json`，不包装成“无资料/无影响”。缺必要命令参数或报告路径本身非法时只输出错误，避免覆盖输入。旧同名成功报告不表示本次成功，检查时间和失败文件。

按稳定条款编号对比；命中顺序与审核人/审核时间戳不纳入依据内容比较。新增、减少、版本变化、条件/材料/适用时间/来源等字段变化分别记录。减少的条款如因新版本不再满足条件，会在JSON的`updatedButOutsideQuery`保留更新后证据，不能只显示“消失”。判断范围限于本轮实际执行的用例。

## 实测

```powershell
npm.cmd test
npm.cmd run test:impact
npm.cmd run check
npm.cmd run build
```

新增顺序、增减、版本、来源、缺月份和用例校验测试。MySQL集成流程检查版本v1→v2（仅定位技术校对，金额不改）、施行前一天/当日、邻区、缺参计数、非法批次清理、拒绝把源库用作隔离库，以及失败后源库摘要。详细结果在`reports/policy-impact-verification.json`。

原政策资料仍待人工审核，成员②业务回答、队友机器及华为云未在此功能中验证。此命令目前要求同一台本机MySQL的项目库和空测试库，不直接对RDS执行模拟发布。

2026-11-19实际结果：`npm.cmd test`39/39通过；`test:impact`1个真实MySQL集成流程、内部13项检查通过；2项独立CLI失败/输入保护检查通过（`reports/policy-impact-cli-verification.json`）；check和build通过。演示、真实当前快照两种模式均执行并生成报告，正式库7表摘要不变。缺月份在两边均标未执行，不计作无影响或预期通过。
