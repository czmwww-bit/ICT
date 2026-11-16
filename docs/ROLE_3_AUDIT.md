# 成员③模块检查报告

检查日期：2026-11-16，Asia/Shanghai。

接续改进：当前已有Git及真实来源草稿；下文“无Git/仅开发样例”等是前轮检查记录。本轮新增手动来源检查、准确版本演示、检索边界及原生备份恢复，实际结果见[member3-workflow.json](../reports/member3-workflow.json)、[source-check-all.json](../reports/source-check-all.json)及[维护说明](MEMBER_3_OPERATIONS.md)。真实政策仍未人工发布，guide/OCR/手机和ECS/RDS待联调。

**总体判断：资料技术模块可以交接，仍待正式资料、成员①②业务联调和云端验证，尚不具备完整产品上线验收条件。** 本轮发现的问题已做小范围修复并复测；没有重写手机端、OCR或业务判断，没有升级依赖，没有新建收费资源或覆盖线上资料。

完整结构化记录：[role3-audit.json](../reports/role3-audit.json)；原始测试输出：[verification.txt](../reports/verification.txt)；命令结果：[role3-command-checks.json](../reports/role3-command-checks.json)。

## 1. 环境、范围及职责

- 已阅读README.md、README_SETUP.md、HANDOFF_MEMBER_3.md及ROLE_3_HANDOFF.md，检查src/test/examples/scripts/migrations、data/eval、部署文件与说明。未找到AGENTS.md。
- Windows PowerShell，Node24.21.0、npm11.19.0、MySQL8.0.46；MySQL80运行。Docker、Nginx不可用，没有提供ECS/RDS连接参数、域名或证书。
- 根目录及backend的git status均报not a git repository，无法给出分支、提交SHA或队友未提交差异；未初始化/重置/清理Git，按现有文件做定点修改。代码文件哈希记录在JSON报告中。
- 当前只有资料后端和基础健康服务，没有React/Vite前端，也没有/api/ocr、/api/guide。成员③覆盖资料结构、数据库、导入/更新/发布、历史、查询、评测工具和部署准备。
- 没有发现对成员②业务判断的重复实现。区域树、时间范围、审核过滤属于资料筛选；资格、人群条件、新旧政策取舍、追问和答案由②处理。评测的人工预期仅作为测试输入，不生成生产办事卡。

## 2. 发现并修复的问题

| 问题与影响 | 修复及验证 |
|---|---|
| 历史版本参数NaN、0、负数或小数可能返回空数组，掩盖参数错误 | query.ts显式要求正整数；新增非法参数与无效日期测试 |
| 材料检查对整个JSON做子串搜索，“无需身份证”或quote字段可能被计作材料齐全 | evaluation.ts逐项核验材料名，兼容字符串、name和text对象；否定说明/无关引文不再凑数；相关回归测试通过 |
| 空测试集以0退出，易误判为已评测成功 | evaluate.ts空集输出notices和退出码2；实际调用空real案例文件验证 |
| 重复案例id造成离线映射和报告歧义 | suiteSchema按cases.索引.id拒绝重复编号；新增测试 |
| 非法EVAL_TIMEOUT_MS被逐例算作接口故障 | 请求前校验为正整数毫秒，配置错误明确失败；新增CLI测试 |
| DB_PASSWORD含小于号时被误判成未配置 | 仅识别完整占位字符串，保留合法特殊字符；新增配置测试 |
| 环境模板遗漏可选PORT、EVAL_URL和EVAL_TIMEOUT_MS；具名前缀的production.env没有被忽略 | 补注释模板；.gitignore和.dockerignore补*.env，避免把真实配置加入提交/构建上下文 |
| 交接说明少列originalTextChecksum、sourcePublication；部署说明仍提TRIGGER权限 | 对照实际返回补齐三个哈希和两个审核事件，修正隔离测试权限说明；参数和返回字段未改名 |

材料检查只是标准名称覆盖，不代替材料适用性或建议语义判断。新增校验不修改成员②的业务请求协议，实际联调仍需约定材料名称与字段映射。

## 3. 实际运行及保护措施

| 命令/检查 | 结果 |
|---|---|
| npm.cmd ci --cache ../.npm-cache | 按现有锁文件重装成功，未升级依赖；审计0漏洞。esbuild安装脚本提示未阻断实际构建 |
| npm.cmd run verify | 所有工具检查符合预期；内含check、test、build、资料校验、mock/离线评测、test:db及audit |
| npm.cmd test | 15项通过、0失败、0跳过；比检查前新增6项针对性测试 |
| npm.cmd run test:db | 1个真实MySQL集成流程通过、0失败、0跳过；在隔离空_test库验证多项事务及查询行为 |
| npm.cmd run db:init / db:migrate | 现有项目库的幂等初始化及迁移成功；空表初始化另在测试库实际执行 |
| data:import --file ../data/demo/batch.json --dry-run --allow-demo | 0错误、6项无变化；不更改项目资料 |
| data:query（事项＋地区＋日期／条款id）、data:history、examples | 均实际执行成功，返回原文、文件与条款版本、来源及历史 |
| eval --cases ../eval/real/cases.json --out ../reports/empty-real-audit | 测试集为空，明确提示未执行，退出2；不能记为真实业务评测通过 |
| npm.cmd run check:service | 真实构建产物启动后healthz200、readyz200、guide404；结束后关闭测试进程 |
| Prettier --check 两个Compose YAML | 语法解析/格式检查通过；不是Docker Compose或Nginx运行验证 |

MySQL流程实测：重复导入无新增；草稿与demo正式查询隔离；单条更新历史保留；两个并发版本只能一个成功；临时CHECK约束让批内第二条写入失败，区域、批次、版本和工作指针全部回滚。额外使用仅存在于隔离库、明确标“非真实政策”的official合成夹具验证正式分支、来源撤回、未来/失效时间及中文往返；没有把这些夹具加入项目资料库。关闭连接池后的两类查询均抛错，没有包装成空资料或成功。

测试只在开始确认空的_test库创建临时表；成功后仅移除本次创建的7张测试表，不删除数据库，不清空任何已有业务库。遇到已有表、外来表或失败时保留现场。

复测前后项目库的全部7张表内容摘要完全一致，仍为2条迁移、4个区域、2个导入批次、6个当前实体、7份版本、7条发布事件；测试库最终为空。两次SHA-256均为 `ebb65c69df91c11aa9a35e31c780d4213a8f01009d741b99921d6fd961b0dff7`。证据：[role3-data-preservation.json](../reports/role3-data-preservation.json)。

## 4. 数据、评测和部署结论

| 范围 | 已验证 | 尚未验证/影响 |
|---|---|---|
| 来源 | 文件包含publisher/sourceUrl/originalText，条款quote/locator固定关联准确文件版本；原文子串与三个哈希可追溯 | 正式资料目录只有空模板；现有3份文件和3条条款均为demo，链接example.invalid不是真实官网；没有对真实政策作联网核验或真实性结论 |
| 日期与未知值 | 区分publishedAt与条款起止日期；未知条件/日期保留null；未来生效、结束日含当天、结束后过滤、未知生效needs_review均实测；较新发布日期不自动撤销旧条款 | effectiveTo含当天、文件整体日期不自动继承等录入约定需②③共同确认；原文日期解释和受影响条款范围仍须人工核对 |
| 审核与关系 | 导入仅draft；独立发布事件；来源撤回后相关条款不进入正式查询；明确替代关系带原文及目标版本；旧快照不覆盖 | 存在关系不表示资料层已作政策取舍；需②结合证据判断，不能据“更晚发布”直接认定替代 |
| 评测 | 13个开发案例含完整/旧/邻区/信息不足/冲突/未审核/接口故障；实际HTTP mock与离线输出都比较；错误、缺结果与未执行单列；指标有分子/分母；demo/real/holdout分组 | 所有人工预期humanVerified仍pending；real和holdout为空，建议正确性及引文支持关系均未完成真实人工复核；没有系统准确率结论 |
| 查询 | 事项/地区/条款编号、显式父区域和邻区、日期、来源/版本；有效无资料返回[]；非法参数与数据库失败抛错 | []只表示没有可用审核资料，不是用户无资格；查询返回候选，不负责资格判断或冲突消解 |
| 配置 | 业务连接均来自环境变量；检查范围内无真实硬编码口令。真实配置仅在backend/.env，值没有回显；Windows绝对路径仅为本地客户端探测/文档示例，未用于生产连接 | 当前没有Git历史，不能审计过去提交；正式共享前需核对忽略规则与提交内容。本地.env是开发维护账号，生产应另用只读账号 |
| 部署 | Node构建和原生MySQL/服务就绪通过；本地Compose有卷和就绪检查；生产Compose不带MySQL服务，Nginx保留/api前缀、前端静态目录和HTTPS位置 | 无Docker/Nginx：镜像、Node22容器、Compose启动/卷恢复、nginx -t未验证；无云账号：RDS/TLS/VPC/安全组/HTTPS/备份恢复未验证；缺①②产物，不能检查完整前后端上线 |

## 5. 成员②交接与兼容调用

交付 `backend/src/{model,db,store,query}.ts`、`backend/migrations`、package.json与package-lock.json、`backend/examples/member2.ts`、DATA_MODEL.md、HANDOFF_MEMBER_3.md及eval目录。复用同一个业务后端进程和连接池，不另起指南服务。

在backend/src中的调用形状（开发例子，正式调用删除includeDemo并使用真实编码）：

```typescript
import { pool } from './db.js';
import { findCandidates, getClause } from './query.js';
const db = await pool();
try {
  const candidates = await findCandidates(db, {
    matterId: 'DEMO_ALLOWANCE', regionCode: 'DEMO_A',
    asOf: '2026-11-16', includeDemo: true
  });
  const references = await getClause(db, 'DEMO_C1', { includeDemo: true });
  console.log(candidates.map(c => c.source), references);
} finally { await db.end(); }
```

实际返回包含clause、document、source、clauseChecksum、documentChecksum、originalTextChecksum、relations、timeStatus、unknownEnd、publication、sourcePublication。source包含clauseId/clauseVersion/documentId/documentVersion/title/quote/locator/url；发布机关在document.publisher。当前DEMO_C1默认返回条款2版、来源文件1版；条款1版须includeHistory:true并指定version:1。完整原文返回样例及修改前后快照可查role3-command-checks.json。

②保留README的text/region/answers请求；将地区名映射为regionCode，再决定事项检索与条件判断。双方需确认事项/区划编码、sources版本与url字段、materials标准名、日期含义及needs_review的reason/nextStep映射。①、②真实模块均待联调。

## 6. 下一步顺序

1. 确定试点区县、事项与官方区划树，补充发布机关官网正文/附件、原始链接、发布及生效/失效依据、核对人和核对日期。
2. 与队友确认共享Git仓库，将本模块在其既有后端约定内合入；先用examples验证资料调用，统一编码与返回字段。
3. 按正式模板整理draft，依次validate、dry-run、import，人工核对后先发布文件再发布条款；不要把demo改标签后当正式政策。
4. 等②提供真实/api/guide及①前端，补真实与独立留出案例；设置EVAL_URL后执行评测并填写人工语义复核，检查服务错误与追问交互。
5. 准备可用Docker环境、前后端产物、ECS/RDS同区域同VPC参数、最小权限账号、CA、域名和证书；先验证镜像/代理/备份恢复，再核对规格费用并经你确认后创建收费资源和上线。
