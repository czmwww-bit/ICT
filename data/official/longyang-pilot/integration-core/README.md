# 隆阳核心资料联调包 v1（全部待审核）

从原13文件/90条款中固定3份文件、10条条款，稳定编号和原文不变。覆盖旧通知、达龄未联系、人户分离、户籍迁移、社保卡未开金融功能、恢复联系六题。原主资料及正式库不改；这里不是第二套正式资料，应单独在空测试库运行。

先打开 **CASE_REVIEW.md**：逐题包含输入、固定候选编号、建议预期、支持条款、原文、页码/段落和官网链接。`query-report.json`保存真实MySQL结果；`QUERY_REPORT.md`是摘要。

## 文件与口径

- `batch.draft.json`：3文件10条款，所有审核字段仍待审核。`originalPath`保留原载体位置，相对于backend运行目录；领取整个仓库，不要只拷此文件夹。
- `manifest.json`：主批次和本包输入文件SHA256、测试集版本。脚本先校验哈希，变化时停止，要求新建版本，不能悄悄套用旧预期。
- `query.cases.json`：6业务输入＋4技术对照。每题`query`是成员②能直接调用的事项、地区、日期；`expectedCandidateReferences`是固定全候选集合。
- `guide.cases.json`：沿用现有评测格式的6道待人工复核题，用于②接口接好后的开发验收，不是最终留出集。
- `review-items.json`、`document-metadata.json`：继承原文核对问题及文件日期、范围限制，不能略过。

**检索不按问题语义筛选。** 六题同事项、同地区、同日期，出现相同9条候选是预期；②再决定该引用哪些、是否追问和如何回答。`supportingReferences`是人工预期依据，未获政策审核。2021年西邑乡文章用`getClause`显式取原版本作为历史证据，不会因为按编号取到就变成隆阳全区当前适用政策。2025瓦渡网页与省级免申流程口径不一致，证据两边都保留。

`matched`仅表示返回候选的起始日期已有记录，不是用户有资格、政策已人工审核或资料覆盖全市；`needs_review`表示至少一个候选起始日未知；未知结束日也单独提示，不推断永久有效。邻区施甸对照只应命中8条省级资料，不应命中隆阳网页；2025施行前的对照仍可能返回日期未知的地方网页，不能当作该网页在当时已经生效。

## 重跑（Windows PowerShell）

```powershell
Set-Location D:\ICT\backend
# 首次克隆时，按锁文件安装；已有.env不要覆盖
npm.cmd ci --cache ..\.npm-cache
# 首次本机未准备数据库时运行setup:local，按隐藏提示输入root密码；已有配置不用重复运行
# npm.cmd run setup:local
# 新机器的项目库先准备空表结构；已有迁移会跳过，不导入正式资料
npm.cmd run db:migrate
npm.cmd run test:longyang-core -- --isolated
```

要求本机MySQL及`.env`中的DB_TEST_NAME是与项目库不同的空`_test`库。复用既有`withEmptyTestDatabase`：已有表则停止，不清空；成功仅清理本轮7张测试表。脚本验证迁移、草稿排除、重复导入、临时技术发布、逐题查询及主库前后摘要。技术发布不等于真实政策审核，JSON和项目库仍待审。6道业务题加4个对照，共10题60项检查来自真实查询；队友需在自己的机器上重跑确认，当前不能替他们签验收。

成员②可直接使用：

```typescript
const candidates = await findCandidates(db, {
  matterId: 'HIGH_AGE_ALLOWANCE', regionCode: '530502', asOf: '2026-11-18'
});
const historyEvidence = await getClause(db, 'LY_GLT_HISTORY_2021_APPLY', {
  version: 1, includeHistory: true
});
```

函数来自原`src/query.ts`，数据库生命周期由②现有服务统一管理。隔离脚本结束后表已清理，不能再拿同一个空库调用；如需保持联调库，另准备人工管理的专用库并按现有导入、审核命令执行，不能把测试脚本改成写正式库。

接口接好后调用现有评测器（先设真实地址），资料若仍未审核，结果只能作为隔离技术联调：

```powershell
$env:EVAL_URL = 'http://127.0.0.1:3000/api/guide'
npm.cmd run eval -- --cases ../data/official/longyang-pilot/integration-core/guide.cases.json --catalog ../data/official/longyang-pilot/integration-core/batch.draft.json --out ../reports/local/longyang-core-business
```

当前/API未接入，6题业务结果均未执行。自动状态、材料和引文检查与政策语义人工复核分开统计；不能用检索60/60作为系统准确率。
