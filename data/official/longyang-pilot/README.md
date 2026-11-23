# 隆阳区三事项：13项官方来源待审核批次

2026-11-17已接收用户的部分事实核对，并补取红河7份Word附件及1/2/8月统计：[本轮回执及附件核对入口](review-followup-2026-11-17/README.md)。13文件/90条主草稿及审核状态不变；附件7仅另存7项待核对候选，尚未进入主导入批次。原省厅两处404仍如实保留，用户政策解读不等于正式PDF原件补齐。

先打开 [REVIEW_OVERVIEW.md](REVIEW_OVERVIEW.md)。本轮**项目数据库没有导入或发布任何真实政策**；只有文件草稿、只读预检查以及起始为空的隔离_test库技术验证。

## 已交付

- `batch.draft.json`：现有schemaVersion=1；13份文件、90条条款全部official/draft，checkedBy/At及reviewedBy/At均未伪填；事项分别为高龄34条、经济困难服务21条、养老消费35条。
- `acquisition.json`、`acquisition-status.json`、`sources/`：实际下载结果、失败状态、时间、URL、原始HTML/PDF和提取正文；[获取表](ACQUISITION.md)。17个原始载体快照哈希已核验（包括复用旧批次原件及一份额外统计表），不是17份独立政策。
- `document-metadata.json`、`DOCUMENTS.md`：机关/转载单位、各类日期、事项与资料身份、同一文件多载体映射。B6的PDF入口/文字版、B8原发/转载、C11失效旧地址/红河转载各只建一个实体。
- `review-items.json`、`REVIEW_CHECKLIST.{md,csv}`：逐条编号、结构化结果、完整引文、位置、状态、问题与人工意见栏。CSV有UTF-8 BOM，可用Excel填写；它不是导入模板。
- `conflicts.json`、`CONFLICTS.md`、`research-log.json`：8组冲突/时效核对项及后续检索范围；2026年9月草案仅元数据线索，不当现行政策，不伪造未获取的全文。
- `eval/real/longyang-development.cases.json`（项目根目录）：18例真实来源的编写情景，预期全部pending；`case-review.json`记录支持版本和人工语义核对。不是最终留出集，也不是真实用户个案。
- `PRECHECK.md/precheck.json`、`ISOLATED_DB_REPORT.md/isolated-db-report.json`：实际预检查及隔离库记录；`artifact-checksums.json`含批次哈希、多载体正文比较及重复引文组。

省级正式文件`YN_GLT_2024_113`、2025解读`LY_GLT_INTERPRETATION_2025`及原16个条款编号复用上批草稿。旧目录的来源原件继续复用，不复制/删除；**后续导入使用本13项批次，不同时导入旧2文件批次**。本批给省节点补上CN国别父节点；旧批次原来省为根，二者区域定义不可同时注册。项目库当前没有这些正式区域或文件，dry-run已实际确认无冲突；若别的环境已注册不同父级，需先核对区域迁移，不能覆盖。

`CN`为ISO国别码；530000/530500/530502为省市区编码；`LY_LUJIANG`和`LY_XIYI`为项目内部稳定乡镇键，不冒充国家乡镇编码。历史潞江条款只保守匹配该镇，不能向整个隆阳区扩大；祖先关系仍须人工核准。

## 本机预检查顺序（PowerShell，可现在运行）

沿用已有backend/.env，不覆盖、不再setup。以下不写项目资料：

```powershell
Set-Location D:\ICT\backend
npm.cmd run data:validate -- --file ../data/official/longyang-pilot/batch.draft.json
npm.cmd run data:import -- --file ../data/official/longyang-pilot/batch.draft.json --dry-run
npm.cmd run check
npm.cmd test
npm.cmd run build
node ../data/official/longyang-pilot/tools/precheck.mjs
```

当前实际结果：格式/关联0错误；dry-run新增103（13文件+90条款）、修改0、无变化0、错误0。6个区域定义另在regions数组，不计入103份资料记录。7张项目表的行数和内容摘要前后完全相同。

隔离库验证命令（DB_TEST_NAME必须配置为与DB_NAME不同、开始无表的本机_test库）：

```powershell
node --import tsx scripts/verify-pilot.ts
```

实际12/12项通过：迁移、dry-run、103份版本导入与幂等、默认草稿隔离、非法关联整批拒绝、SQL中途故障回滚、历史版本、地区/国家祖先及日期/来源查询。临时内存副本补技术核对字段、在隔离库追加测试审核事件，**不代表原政策经人工审核**。成功只清理本次空库创建的7张表，保留空数据库；已有表或失败则停止并保留现场。不会清空项目库。

## 你人工核对后才执行

1. 先在核对表逐条记录意见，确认来源、效力、字段和缺口。修改JSON的真实导入人`actor`及原因；只为实际核过的文件填写`checkedBy/checkedAt`。新记录仍version=1/expectedVersion=0，reviewStatus保持draft，reviewedBy/At保持null。
2. 重新validate和dry-run。技术通过不能代替你决定哪些条款可发布。历史2021/2023、瓦渡冲突、三年期限、地方当前金额等未确认条款保留草稿；已有模型没有可发布的“仅历史资料”过滤标记，**不要把它们发布成当前依据**。
3. 明确确认后，使用现有命令导入（本轮未执行）：

```powershell
npm.cmd run data:import -- --file ../data/official/longyang-pilot/batch.draft.json
```

4. 独立发布先文件、后准确条款。例如你确认113号发放对象后：

```powershell
$reviewerName = Read-Host '实际人工审核人姓名'
$reviewReason = Read-Host '核对依据、适用范围和发布原因'
npm.cmd run data:publish -- --kind document --id YN_GLT_2024_113 --version 1 --actor $reviewerName --reason $reviewReason
npm.cmd run data:publish -- --kind clause --id YN_GLT_ELIGIBILITY --version 1 --actor $reviewerName --reason $reviewReason
```

其余条款按核对结果逐条替换id发布，禁止全批自动发布。保留完整冲突证据而不是删除不一致文件；确有原文支持的旧条款关联，待取得旧文件后再追加新版本。内容变化后遵守expectedVersion/version检查，不能覆盖已导入快照。

## 成员②调用与联调

使用同一后端中的`findCandidates/getClause`，字段形状见docs/HANDOFF_MEMBER_3.md。matterId分别为`HIGH_AGE_ALLOWANCE`、`ECONOMIC_ELDERLY_SERVICE`、`DISABILITY_CARE_CONSUMPTION`；办理地`530502`。所有标识需②③共同确认，不改guide的text/region/answers草案。

```powershell
# 当前项目库仍应为空候选；需对应条款人工发布后才返回
npm.cmd run data:query -- --matter HIGH_AGE_ALLOWANCE --region 530502 --date 2026-11-16
npm.cmd run data:query -- --matter ECONOMIC_ELDERLY_SERVICE --region 530502 --date 2026-11-16
npm.cmd run data:query -- --matter DISABILITY_CARE_CONSUMPTION --region 530502 --date 2026-11-16
npm.cmd run data:query -- --id LY_CONSUMPTION_GUIDE_2026_CONTACT
```

TypeScript（在backend源码内复用连接池）：

```typescript
import { pool } from './db.js';
import { findCandidates, getClause } from './query.js';
const db = await pool();
try {
  const candidates = await findCandidates(db, {
    matterId: 'DISABILITY_CARE_CONSUMPTION', regionCode: '530502', asOf: '2026-11-16'
  });
  const evidence = await getClause(db, 'LY_CONSUMPTION_GUIDE_2026_CONTACT');
  console.log(candidates.map(c => c.source), evidence);
} finally { await db.end(); }
```

`source`含准确条款/文件编号和版本、quote、locator及官网入口url，`document`含完整文本、publisher及originalPath。省级原文的落款/印发/各转载日期在本资料包的`document-metadata.json`（复用113号详细来源见旧目录provenance）；不强塞未定义字段进业务模型。

重要边界：资料层返回证据和时间完整性，不选择冲突政策、不判断个人资格。未知日级生效/失效日期仍null，月份及实施周期保留原文schedule；例如全国项目2026年1至12月是项目期，不擅自写成通知整体废止日。不能把unknownEnd解释为永久有效，也不能仅依查询返回即认定2027仍可领取。省级金额、旧地方网页金额、2026统计线索需分层核准；三个事项的户籍/常住、免申/申请、经济/评估条件不可交叉套用。

## 评测命令

```powershell
# 验证案例入口及“业务未执行”统计（显式不向真实接口请求）
node ../data/official/longyang-pilot/tools/check-evaluator.mjs
# ②的接口完成、预期经共同核对后再设置真实地址
$env:EVAL_URL = 'http://127.0.0.1:3000/api/guide'
npm.cmd run eval -- --cases ../eval/real/longyang-development.cases.json --catalog ../data/official/longyang-pilot/batch.draft.json --out ../reports/longyang-guide
```

当前报告`reports/longyang-development-not-executed.{json,md}`：18例、117个适用自动检查均未执行，0通过/0失败，18例语义待人工复核；评测器退出2是未执行，不是通过。`check-evaluator`只确认它正确读入案例并按未执行记账，自身退出0。设置EVAL_URL后才是真的业务HTTP评测，失败/超时继续单列。JSON目录能用于开发核对，但不证明这些资料已审核；`--catalog-db`只读取已发布目录，待人工发布后再用。最终留出集保持独立，未使用这18例。

## 工具和附件说明

tools为公开资料采集与初次编排工具；不新增业务依赖、OCR或管理后台。取证辅助依赖仅在已忽略的reports/local/source-tools；复现安装命令见旧资料包README。`prepare.mjs`、`prepare-cases.mjs`拒绝覆盖已有草稿/预期；人工开始核对后直接维护JSON和核对表，不重跑初次编排工具。

113号扫描件无文本层，已逐页渲染，借助网页进行规范化转写，保留原PDF；“社会保障卡匹配”按扫描件保留，不用解读缩写替换。流程7页PDF有文字层，保留逐页原始文本、图片和去排版空白的normalized文本；第1—2、7页的数字、流程及电话已比对图像，仍须人工复核。第3—6页的服务机构申报资质材料已全文归档，本批以老人办理相关条款为重点，**不把机构材料列为老人必交材料**。两个PDF不代表真实OCR接口测试通过。

本轮无云端部署、采购或前端/OCR/guide业务改动。真实服务接口、人工政策审核及云端仍待后续。
# 2026-11-19补充入口

金额分月记录、区级“本人申请”与免申流程对照、官方咨询电话及老年优待凭证新事项见[supplement-2026-11-19](supplement-2026-11-19/README.md)。该包新增8文件13条款，复用后11文件20条款，单独待审、未发布；本目录原13文件90条款及核心联调包不改。新查询示例`npm.cmd run demo:payment -- --isolated --month 2026-02 --region 530502`，运行位置backend。
