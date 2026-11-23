# 隆阳金额、流程与优待凭证补充（2026-11-19，全部待审核）

先看本页，再打开[20条原文核对表](REVIEW_CHECKLIST.md)。主13文件/90条款字节不变；此包复用3文件7条款，新增8文件13条款，共11文件20条款。**正式项目库未导入、未发布**；只在空测试库追加技术发布事件做查询验证。

## 优先核对：奶奶100岁，350还是1000

|原文范围|地区、原文年龄档|公开记录中的金额|条款编号|原始来源|
|---|---|---|---|---|
|2026年1月|隆阳区，“100周岁以上”|350元/月|BS_GLT_202601_LY_100PLUS|[市级月报](https://www.baoshan.gov.cn/info/6126/10335854.htm)|
|2026年2月|隆阳区，“100周岁以上”|350元/月|BS_GLT_202602_LY_100PLUS|[市级月报](https://baoshan.gov.cn/info/6126/10352984.htm)|
|2026年8月|隆阳区，“100周岁以上”|1000元/月|BS_GLT_202608_LY_100PLUS|[市级月报](https://www.baoshan.gov.cn/info/6126/10396644.htm)|
|2026年9月|隆阳区，“100周岁以上”|1000元/月|BS_GLT_202609_LY_100PLUS|[市级月报](https://www.baoshan.gov.cn/info/6126/10409514.htm)|
|2026年第二季度（4—6月）|隆阳区，备注“100周岁以上”|备注列1000元/月|LY_GLT_2026Q2_REPORTED_RATE|[区级季度明细](https://www.longyang.gov.cn/info/2861/14118239.htm)|
|2026年2月，对照用|施甸县，“100周岁以上”|1000元/月|BS_GLT_202602_SD_100PLUS|同一市级2月表的施甸行|

这些是发放统计或季度公开备注，不是地方提标文件。**提标文件、确切生效日、补发差额规则未知**；不把9月1000回填成1月或全年，不推算3月或当前11月。季度备注独立放`periodContext`，不能当作5月个人到账证明。省级最低300元仍按原文件条款另存，不替代地方实发记录。原表“100周岁以上”统一映射`100_PLUS`，原用语保留、映射仍待人工确认。

第一条业务验收题：`LY_AMOUNT_01`，输入“我奶奶100岁，户籍隆阳，到底是350还是1000？”；**预期先问哪一年、哪一月**，`question.key=recordMonth`。下一题缺户籍区县时，预期追问`householdRegion`。追问和回答由成员②实现，本模块只提供资料筛选与预期，尚未执行业务接口。

## 流程冲突与电话

省级113号文件写免申即享，2026年省级“一件事”通知说明主动联系、资格认证和免申流程；区级二季度备注仍写“经本人申请”。两边原文保留，来源类型分别标正式文件/转载、发放明细备注，**没有建立无依据的替代或废止关系**。

具体待问：“我还需要本人到社区吗？”“一直没接到联系，如何核实是否在名单内？”“是资格核实，还是需要另行申请？”“1000元何月调整，是否补发差额，有什么文件？”不把“过渡、补录、网页未更新”等解释写成事实。

隆阳区民政局[组织机构页](https://longyang.gov.cn/xxgk/bm/lyqmzj/fdzdgknr/zzjg.htm)内设机构（五）公布老龄工作和养老服务股电话 **0875-2229150**。已归档真实HTML、原文和位置；本轮没有拨打，不记录服务时限或答复。高龄与经济困难补贴分别提供同一业务股室的可追溯联系条款。

## 经济困难补贴的地方证据

取得[市级9月统计](https://www.baoshan.gov.cn/info/6126/10409524.htm)：隆阳行列2555人、50元/人·月、资金合计127750元；三项资金来源列不当成个人领取金额。**标题只写“9月”，公开时间是2026-10-08，未明确统计年份**。保留`fromMonth/toMonth:null`并进入`unresolvedPeriod`，暂不据公开年补成`2026-09`。该表未列年龄档，用`UNSPECIFIED`，对象条件另查政策原文。

2023试行办法的“三年有效期”、2026年4月8日省级免申流程分别沿用原编号和原文。接续正式办法仍未核实取得；本轮只做有限检索，目录入口还返回跳转壳，不能宣称新文件不存在、补贴取消或旧办法自动续期。检索范围见`research-log.json`。

## 新事项：老年优待凭证

事项编码`ELDERLY_PREFERENTIAL_CREDENTIAL`。省厅旧入口实际返回404；已取得[红河州政府全文转载](https://www.hh.gov.cn/info/30361/1236862.htm)，三个条款保留完整引言，分别用于新办、旧证及凭有效身份证核验。

- 原文件落款：2025-12-13；红河网页公开：2026-01-22；施行：2026-01-01。
- 原省厅网页公开候选为2025-12-17，仅检索结果支持，原网页未下载，放在元数据待核项中，不冒充落款或施行日期。
- 自2026-01-01起不再新办、换发、补办；原已办理的证可继续使用；全省年满60周岁及以上凭本人有效居民身份证核验相关优待。具体优惠仍依对应业务规则，不保证所有服务免费。
- 原文明确废止两个旧文件，但本库没有其准确条款实体，先在文件元数据记录被提及文号，不造条款替代关系。转载末尾机构文字、旧文件文号排版也请逐字核对。

三道口语题和施行前一天的反例已放`guide.cases.json`；`ready`是**未来人工审核后**的预期，不表示当前待审核资料可用于生产回答。

## 实测与运行

实际结果：原29项加新增5项，共34测试通过；类型检查、构建通过；已有CLI校验0错误，dry-run计划新增31、修改0、错误0，前后项目库7表摘要相同。隔离库21/21检查通过，重复导入无变化31/31，成功清理本轮7张测试表。11份HTTP响应HTML（含失败页/目录）、8份正文及8份新文件的正文对应关系均核验哈希。新来源清单的9月高龄统计实时更新检查返回unchanged，独立监测目录未改原账本。15道业务题85项未执行，15道人工语义核对待做，不能称为系统准确率。

```powershell
Set-Location D:\ICT\backend
# 已安装依赖并准备.env/空_test库；新机器见成员③主交接说明，项目库先执行db:migrate
npm.cmd run test:payment -- --isolated
npm.cmd run demo:payment -- --isolated --month 2026-02 --region 530502
npm.cmd run demo:payment -- --isolated --month 2026-09 --region 530502
```

最后两条命令实际运行过，保存结果为`demo-february.json`、`demo-september.json`；返回准确版本、原文、位置、官网及记录月份。CLI仅技术预览，缺月份或地区时明确失败，不猜最新金额；老人交互的追问由②接住。

该归档演示的`--date`默认固定为`2026-11-19`以便复现，不代表运行当天；核对其他政策适用日请显式传入。资料更新监测继续用既有命令和本包`source-registry.json`，不要将失败的省厅链接标为已取得全文。

### 成员②调用

```typescript
import { findPaymentRecords } from './src/payment-records.js';
const evidence = await findPaymentRecords(db, {
  matterId: 'HIGH_AGE_ALLOWANCE',
  regionCode: '530502', // 此金额任务须先确认户籍区县，不拿常住地代替
  recordMonth: '2026-02',
  ageBandCode: '100_PLUS',
  asOf: '2026-11-19' // 政策适用范围筛选日，不是发放月份，也不是历史数据库快照
});
// evidence.monthly：准确月报；periodContext：季度备注；unresolvedPeriod：统计年度未知
```

参数必填，不接受缺月时默认最新；结果不是资格、保证到账或业务ready。季度和未知期不能混入月报数组；同月多个证据都保留，由②判断冲突。此函数不查询提标规范性文件，两个调整/补差字段返回null不代表全库必然没有其他政策，须另检索正式政策依据。

需要一起交接`model.ts`新增可选`paymentRecord`、`payment-records.ts`、该批次、元数据及15例测试题。沿用原JSON版本表，无新增SQL表或迁移；不含该字段的旧记录哈希保持不变。旧版严格校验器会拒绝新字段，队友需一起同步模型。原`findCandidates/getClause`签名不变，取完整政策/原文仍用原函数。

②接口完成后设置实际地址，再调用原评测器；使用同一独立资料环境，待审核数据只能技术联调：

```powershell
$env:EVAL_URL = 'http://127.0.0.1:3000/api/guide'
npm.cmd run eval -- --cases ../data/official/longyang-pilot/supplement-2026-11-19/guide.cases.json --catalog ../data/official/longyang-pilot/supplement-2026-11-19/batch.draft.json --out ../reports/local/payment-guide
```

## 人工核对后导入和发布

先在本包另存`batch.reviewed.json`，逐项核对，在副本的文件中填写真实`checkedBy/checkedAt`。所有记录仍保持draft、reviewedBy/reviewedAt为null。不要改原快照、manifest和已固定的联调包。

```powershell
npm.cmd run data:validate -- --file ../data/official/longyang-pilot/supplement-2026-11-19/batch.reviewed.json
npm.cmd run data:import -- --file ../data/official/longyang-pilot/supplement-2026-11-19/batch.reviewed.json --dry-run
# 预检查通过且人工确认后
npm.cmd run data:import -- --file ../data/official/longyang-pilot/supplement-2026-11-19/batch.reviewed.json
# 下面只举已核准9月记录的发布示例，审核人/原因须填写真实内容；先文件后条款
npm.cmd run data:publish -- --kind document --id BS_GLT_202609 --version 1 --actor '<实际审核人>' --reason '<已核对的范围和原文>'
npm.cmd run data:publish -- --kind clause --id BS_GLT_202609_LY_100PLUS --version 1 --actor '<实际审核人>' --reason '<仅核准2026年9月隆阳百岁档公开记录>'
```

不要一次批量批准所有条款。复用实体如已在库中被更新，版本检查会拒绝覆盖，先核对当前版本，使用原版本维护流程或去除不需修改的相同记录，不能绕过expectedVersion。CLI/文档示例不代表本轮执行过正式导入或发布。
