# 成员③交接

云南医保的新资料与截图入口见[专门交接](YUNNAN_MEDICAL_HANDOFF.md)。`demo:medical -- --isolated`复用原查询/导入/发布模块，仅在空测试库技术演示；20文件/50条款仍待审。两条入口与口语问法素材不冒充②的业务判断，也不证明原小程序问答/语音已体验。

2026-11-17接续核对见[回执](../data/official/longyang-pilot/review-followup-2026-11-17/README.md)：用户两段文字及部分事实反馈已归档，红河7份Word附件全部获取、附件7列7项核对候选。主13文件/90条款及审核字段不变，未导入/发布。已区分落款、省厅公开、转载及未知印发日；金额按1/2/8月分别保留。省厅原PDF仍404，政策解读不顶替原件；27/26条差异待核。检查器新增可选attachmentSelector发现正文外附件；Office线上仍按哈希，离线提取文本不代表审核。

工程最初只有项目说明；现已有 `backend` 资料模块、最小Express健康服务及Git版本。原 README 约定的 `/api/ocr`、`/api/guide` 仍由②实现，①的页面未改动。2026-11-16新增的来源检查、隔离演示、评测及备份恢复见[维护与演示](MEMBER_3_OPERATIONS.md)，新命令继续复用原导入、发布和查询模块。

## 本地顺序（PowerShell）

如果已经通过Windows安装器装好本机MySQL、端口为3306，而且 `backend/.env` 尚不存在，可先在backend运行 `npm.cmd run setup:local`。终端会隐藏输入并询问本机root密码，自动新建随机后缀的项目库、空_test库和仅获这两个库权限的本地维护账号，生成已被Git忽略的.env。root密码不保存、不发送到聊天。该命令不覆盖已有.env，不修改既有库和账号；建库授权属于DDL，若中途失败保留配置供核对，不自动删库。随后可执行迁移与test:db，无需再启动Compose。初始化脚本的计划检查为 `npm.cmd run setup:local -- --check`，不连接数据库。

当前本机已完成上述初始化、MySQL8.0.46真实测试及样例发布。已有.env请直接使用，不要重新复制模板或重复setup。现在可以运行：

```powershell
Set-Location D:\ICT\backend
npm.cmd run verify
npm.cmd run data:demo -- --allow-demo
npm.cmd run examples
npm.cmd run check:service
```

data:demo仅允许setup创建的本机silver_local_项目库及虚构数据，复用既有导入/发布模块，生成reports/local-database.json及Markdown实测记录；若遇到已明确撤回的样例版本会停止，不自动恢复。check:service启动已构建的基础Node服务并检查真实数据库就绪，完成后关闭进程，报告位于reports/local-service.json。

先做不需要数据库的检查：

```powershell
Set-Location D:\ICT\backend
npm.cmd ci --cache ..\.npm-cache
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run data:validate -- --file ../data/demo/batch.json
npm.cmd run eval -- --mock --out ../reports/mock-tooling
npm.cmd run eval -- --out ../reports/business-not-executed
```

模拟评测故意包含坏引文、HTTP500和超时，退出码 1 是工具识别预设失败；未接业务接口的评测退出码 2，不能记为通过。两份报告分别是 `reports/mock-tooling.{json,md}` 和 `reports/business-not-executed.{json,md}`。

以下是使用Docker的替代路径，尚未实测。当前已使用原生MySQL，无需再启动Compose；若两者同时使用，给Compose配置不同主机端口（如3307），避免占用现有3306。

```powershell
Set-Location D:\ICT
Copy-Item deploy/.env.example deploy/.env
# 修改 deploy/.env 为本地库名、用户名、自设密码与端口，如 3306
docker compose --env-file deploy/.env -f deploy/compose.local.yaml up -d --wait
Set-Location backend
Copy-Item .env.example .env
# 修改 backend/.env：本地127.0.0.1、上述端口/库名/用户/密码，DB_TLS=false
npm.cmd run db:migrate
npm.cmd run data:import -- --file ../data/demo/batch.json --dry-run --allow-demo
npm.cmd run data:import -- --file ../data/demo/batch.json --allow-demo
npm.cmd run data:import -- --file ../data/demo/batch.json --allow-demo
```

Compose 已创建 MYSQL_DATABASE；若使用自行安装的 MySQL 且库还未建，可用具有 CREATE DATABASE 权限的配置执行 `npm.cmd run db:init`，再 migrate。应用账号不必具有建库权限。

样例也必须先经明确发布才可查询。以下审核人及原因为开发演示标签，不表示真实政策审核：

```powershell
foreach ($docId in @('DEMO_D1','DEMO_D2','DEMO_D3')) {
  npm.cmd run data:publish -- --kind document --id $docId --version 1 --actor '示例审核人' --reason '虚构夹具演示'
}
foreach ($clauseId in @('DEMO_C1','DEMO_C2','DEMO_C3')) {
  npm.cmd run data:publish -- --kind clause --id $clauseId --version 1 --actor '示例审核人' --reason '虚构夹具演示'
}
npm.cmd run examples
npm.cmd run data:query -- --matter DEMO_ALLOWANCE --region DEMO_A --date 2026-11-16 --include-demo
npm.cmd run data:query -- --id DEMO_C1
# 上一条正式查询应为空，样例不会因审核发布而进入正式结果
npm.cmd run data:import -- --file ../data/demo/update-clause.json --dry-run --allow-demo
npm.cmd run data:import -- --file ../data/demo/update-clause.json --allow-demo
npm.cmd run data:publish -- --kind clause --id DEMO_C1 --version 2 --actor '示例审核人' --reason '复核定位变更'
npm.cmd run data:history -- --kind clause --id DEMO_C1
npm.cmd run data:history -- --kind document --id DEMO_D1
npm.cmd run data:query -- --id DEMO_C1 --version 1 --include-history --include-demo
```

`validate` 是无数据库的完整批次校验：必须包含被引用的文件与条款。部分更新批次须使用 `data:import --dry-run`，由数据库补齐关联；dry-run 不改任何持久数据。导入新增/修改/无变化及具体错误以输出为准，校验失败整批不写入。版本冲突须人工合并后递增版本，不能覆写旧快照。

数据库集成验收使用另一个**空**的 `_test` 数据库，在 MySQL/Compose 管理终端创建并授测试账号该库权限，再在 backend/.env 设置 DB_TEST_NAME。测试拒绝已有表，不删除数据库；成功只清理本轮创建的表：

```powershell
npm.cmd run test:db
```

该测试在MySQL8.0.16+用临时CHECK约束制造第二条写入的真实SQL失败，验证批次、区域、版本及指针全部回滚，账号需CREATE/ALTER/DROP等测试库权限，无需SUPER或修改全局日志配置。开始时必须为空库；成功后仅清理本次创建的7张表，保留空库以便重复运行。若发现外来表或执行失败则保留现场，不清空已有库。缺DB_TEST_NAME时明确跳过。当前实际测试已通过，记录见DEVELOPMENT_LOG.md与reports。

## 成员②调用

模块在同一个 Node 后端进程内使用，不需要启动第二套业务服务。将 `src/db.ts`、`model.ts`、`store.ts`、`query.ts` 保留在 backend 内，沿用 package.json 与锁文件。可直接运行的完整例子是 `backend/examples/member2.ts`。

```typescript
import { pool } from './db.js';
import { findCandidates, getClause } from './query.js';
const db = await pool(); // 在②的进程中复用一份池，服务停止时 db.end()
const candidates = await findCandidates(db, {
  matterId: '实际事项编码', regionCode: '实际办理地编码', asOf: '2026-11-16'
});
const references = await getClause(db, '实际条款编号');
```

每个候选返回 `clause`（条件及办理字段、准确版本）、`document`（完整原文、发布机关、发布日、官网地址）、`source`（可交给①的引用）、`clauseChecksum/documentChecksum/originalTextChecksum` 三个SHA-256、`relations`、`timeStatus`、`unknownEnd`、`publication`与`sourcePublication`两个实际审核事件。`source` 字段形状如下（虚构；quote位置是说明文字，实际查询返回完整原文）：

```json
{"clauseId":"DEMO_C1","clauseVersion":1,"documentId":"DEMO_D1","documentVersion":1,"title":"【虚构】示例甲区高龄服务通知","quote":"完整原文，实际返回不省略","locator":"示例第一段","url":"https://example.invalid/DEMO_D1"}
```

`timeStatus=needs_review` 表示生效日期未知；`dates_recorded` 仅表示记录了起始日期；`unknownEnd=true` 表示未确认结束日，不能宣称永久有效。关系仅是原文证据，资料层不据此自动取消目标条款。默认只返回当前明确发布版本；`includeHistory:true` 才读已审核的历史快照，`version` 必须搭配此参数。管理人员用 CLI history 才能看到草稿及撤回历史。查询日期只做记录范围筛选，不能把日期内候选等同于资格符合。

有效查询的空数组仅表示“此筛选范围内没有可用的审核资料”，不能据此判断事项不存在或用户不符合条件。非法日期/版本和数据库故障会抛错，②应按参数错误或服务故障处理，不得统一转换成空资料或业务成功。version必须是正整数，未知编号仍正常返回空数组。原接口字段及函数参数保持兼容。

行政区匹配只向上找祖先：市级条款可匹配下属区县，甲区可匹配甲街道，不能匹配乙区，也不能把甲区条款用于整个市。没有注册的编码返回空候选。没有足够证据时由②决定追问或向社区核实；同事项多条候选均返回，不替②判断冲突、适用人群或领取资格。

| README 接口概念 | 资料模块映射与②的责任 |
|---|---|
| guide请求 text | 保留给②识别事项，③不解析通知 |
| guide请求 region | ②将地名/前端选择映射为稳定 regionCode；不能直接用文字做模糊区县匹配 |
| guide请求 answers | ②用于资格及条件判断，③不处理 |
| 返回 sources | ②可使用 candidate.source，已有 title/quote/url 与条款及文件版本 |
| 返回 materials | 条款 materials 是证据项数组；②选取适用材料并生成给①的列表，保留条款关联 |
| ready/need_info/needs_review | ②生成；timeStatus 只是资料时间完整性，不能直接冒充整个业务结论 |

双方需确认事项编码、试点区划树、生效/失效日含义、段落定位、材料字段、sources 中的 clauseVersion/url 命名、needs_review 的 reason/nextStep 字段。现有仓库没有既存代码接口，故没有改写旧接口；该映射就是对 README 草案的适配。

## 首批真实来源草稿（2026-11-16，尚未发布）

隆阳区高龄津贴的3个指定官方入口及8页省级通知PDF已归档，见[data/official/longyang-allowance](../data/official/longyang-allowance/README.md)。请先阅读[人工核对表](../data/official/longyang-allowance/REVIEW_CHECKLIST.md)。现行候选为2份文件/16条条款，全部draft；2021申请说明单独历史归档，不进入现行批次。

事项编码暂定`HIGH_AGE_ALLOWANCE`、办理区`530502`，候选条款地域为省级`530000`并通过显式祖先链匹配。金额只记省级标准，隆阳地方实发金额与本地经办信息待补；②不能把省级条款直接说成已核实的隆阳实际金额。原文件的落款、印发、转载网页日期及政策施行日期分别保存在provenance；原文件公开日期未知，不用转载日代替。

独立校验和真实本地库dry-run均通过（新增计划18、修改0、无变化0、错误0），前后7表行数与内容摘要相同。**没有实际导入/发布**，正式查询仍为空，不代表业务不办理。后续人工核对、导入和逐条审核发布命令见该目录README，禁止将采集时间冒充checkedAt。日期证据校验做了兼容修正：可引用同一固定文件版本的其他章节；一般条件/材料仍须来自本条引文。

日期约定中effectiveTo含当天；若原文写“自某日废止”，须共同确认最后适用日与原文依据后录入，不能直接把发布日期或废止公告日当作最后适用日。文件整体日期也不自动替代每一条条款的日期，需人工核对受影响条款。

## 评测与剩余交付

2026-11-16进一步整理隆阳三事项13项来源，现以[本批交付入口](../data/official/longyang-pilot/README.md)为准。先看[优先核对表](../data/official/longyang-pilot/REVIEW_OVERVIEW.md)。13文件/90条款全部draft，三个事项分别34/21/35条，未导入项目库或发布；上批113号及16条款编号/快照复用。2021/2023历史、2025主动申请冲突、试行三年期限、2026统计金额1000与旧350差异都保留待审，不能直接当现行结论。

本批对应`eval/real/longyang-development.cases.json`的18例为真实来源的编写开发情景，humanVerified全部pending，不是最终留出集；`case-review.json`保留版本及人工语义复核。既有评测器已实际读取，业务未接入，117项检查未执行、0通过/0失败，18例待人工复核。真实业务报告仍不是准确率通过。

新增事项编码`ECONOMIC_ELDERLY_SERVICE`、`DISABILITY_CARE_CONSUMPTION`，高龄沿用`HIGH_AGE_ALLOWANCE`；办理区530502。完整查询、逐条发布及评测命令见本批README。区域树补CN国家根，乡镇内部键与国家行政编码分开说明；本批替代未导入的旧批次作导入入口，不同时导入两个区域定义不同的草稿。结构和query函数返回字段保持兼容。

`eval/demo/cases.json` 含13例；`eval/real/longyang-development.cases.json`保留原18例，新增`longyang-boundaries.cases.json`共30例真实来源编写情景，全部待人工核对。`eval/query/longyang-retrieval.json`另含16例检索技术案例，不能当作业务答案准确率。`eval/holdout`仍为空，留出集后续独立准备。`eval/ocr-manifest.template.json`只是OCR清单，不表示OCR已测。详见 EVALUATION.md。

交给②：`backend/src/{model,db,store,query}.ts`、`backend/examples/member2.ts`、迁移、package.json与锁文件、DATA_MODEL.md、eval目录以及本说明。交给①：README 接口约定与 source 字段映射；真实办事卡联调仍依赖②。

上云步骤及缺少的控制台配置见 DEPLOYMENT.md。当前没有云账号参数、ECS/RDS实例、域名、证书，也没有真实前端和业务服务；没有采购资源、上线地址或系统准确率结论。

## 本轮交接补充

- 正式查询：`npm.cmd run data:show -- --matter HIGH_AGE_ALLOWANCE --region 530502 --date 2026-11-16`。当前诚实返回`not_published`，项目库没有正式政策；不代表老人无资格。
- 两个可运行的真实来源示例：`npm.cmd run demo:query -- --isolated --matter HIGH_AGE_ALLOWANCE --region 530502 --date 2026-11-16`；`npm.cmd run demo:query -- --isolated --id YN_GLT_ELIGIBILITY --version 1`。只在空_test库技术发布并在成功后清理，原JSON仍draft。实际输出见`reports/query-real-candidates.json`与`query-real-reference.json`。
- ②继续使用`findCandidates`和`getClause`，返回字段未变。展示层`query-view.ts`额外解释状态、地区名、时间缺项、人工核对问题，`dataOnly=true`。事项/地区/日期语义及异常处理沿用上文；时间未知与试点以外不能被直接映射为业务ready。
- 来源检查入口`data:update:check`、差异入口`data:updates`；检查记录和待审任务是文件账本，与MySQL迁移账本、政策版本账本分开。关闭任务不等于发布条款；必须先走原import/publish。详见维护文档。
- 交给②的新增文件：`src/query-view.ts`、`src/operations.ts`、`examples/query-real.ts`、来源登记清单、`eval/query`和`eval/real/longyang-boundaries.cases.json`及实际报告。仍需整个backend依赖及原核心模块，不能只拷贝单个脚本。
- ②需确认guide的question.key、sources.clauseId/clauseVersion、materials及异常字段，并逐条人工核对关键建议。①②的机器独立安装、OCR/guide及手机端联调尚未执行；当前本机的隔离验证不能代替队友签收。
