# 成员③开发与验证记录

## 2026-11-17云南医保资料与陪伴操作素材

用户选定老人常用参保查询、缴费入口、家庭共济、异地备案，并补充普通首页/关怀模式截图，强调理解业务和每次一个步骤。本轮新建独立医保资料包，未改养老主草稿、未覆盖已有检索报告改动，未改手机端/OCR/业务判断。

实际保存21官方HTML、59素材（39正文图片/附件、20页面图标）及49官方栏目索引。省医保局旧PHP入口404，新站官方栏目可直接获取新地址；迁移URL日期不当作网页发布日期。玉溪指南初次选择器未命中，读取已存HTML后修正并完整取32段/7图，失败经过保留。两份2027长图已逐片查看，选录转写待人工核对；旧2026纯图仅存档。2026经办指南docx/xlsx完整获取，Word只读提取7500段、未渲染，不凭表格扁平文本推定勾选材料或分页。

按现有schemaVersion=1编排20文件/50条款、10事项，全部draft且checked/reviewed字段为空。保留近亲属/共济与医保身份、亲情账户与跨省钱包、参保登记与税务缴费、保障年度与缴费日期等边界；日期/流程/版本缺口进入核对表，不替②做资格或冲突取舍。导航素材有两条用户要求的入口、5张截图观察、术语解释、只读查询边界；结果页未知，截图原始文件未本地归档，原问答/语音未体验。口语查绑定只是人工标注，不宣称已实现意图理解。

实际验证：现有严格校验0错误；MySQL只读dry-run新增70/修改0/无变化0/错误0，项目7表前后摘要不变。26项既有单元/HTTP测试通过，TypeScript和构建通过。新增示例复用核心findCandidates/getClause及空_test库：14项草稿隔离、重复导入、祖先/邻区、未知地区、生效/缴费窗口、准确版本检查通过，返回2条候选及1条准确引用，项目库未变且测试表清理；技术审核仅写入隔离内存副本，不是政策审批。医保包10类来源/哈希/定位/路径/案例一致性核对通过；YB12真实更新检查unchanged，使用独立检查目录，不改旧账本。

16例真实来源开发情景全pending，既有评测器实际读取，无guide目标，109项全部未执行、0通过/0失败、16例语义待核；不表示准确率通过或原小程序能力已测。技术报告、预检查、隔离查询及评测输出均在新医保目录。交接见YUNNAN_MEDICAL_HANDOFF.md；云端、队友机器、手机端、原问答/语音及真实政策审批仍待完成。

## 2026-11-17用户核对接续

开始时仅reports/longyang-retrieval.json/md存在用户未提交改动，保留不覆盖。已读README/setup/交接及原模型/校验/发布流程；本轮不导入或发布。用户反馈记为部分事实确认，不填审核人/日期。两段聊天正文独立保存，第一段与现有红河正文去空白后仅一处半角/全角逗号不同；第二段是政策解读，不能认定正式PDF已补齐。解读27条、施甸26条差异单列，地方调整和政策接续依据继续待核。

实际获取5个官方HTML（红河、保山1/2/8月、施甸）、红河7份Word附件，12份原件及12份提取文本哈希匹配；省厅方案URL和经济困难PDF重试均404。7份Word用隔离目录word-extractor1.0.4离线提取，无宏执行，未渲染页码。附件7第二至第九条中7项按完整条文保留为候选，尚未进入主导入JSON。三个月统计隆阳行350/350/1000单列，不回填全年；落款2026-01-14、省厅公开2026-01-27、红河转载2026-02-28分开，印发日仍未知。

修复来源检查器漏掉正文外附件的问题：显式attachmentSelector，仍限制附件格式，不扩大到导航；旧运行账本首次取得附件哈希标基线不足，不认定正式政策修改。另修复正文哈希相同但必需附件缺失时可能误报unchanged的问题。新增2项回归，26项单元/HTTP测试通过、0失败，TypeScript及构建成功，原始命令输出见本轮technical-checks.json。用独立SOURCE_CHECK_DIR实际复查红河正文/7附件，unchanged，未建立变更任务；未改旧运行账本。

主batch.draft.json与HEAD字节完全相同，13文件/90条仍draft；15条收到部分反馈，90条JSON/MD/CSV问题按稳定编号逐条校验，原文、审核人/日期/决定等其余列不变。附件原件/文本、用户文本、候选定位、日期及月份金额的8类检查实际通过，见[接续verification.json](../data/official/longyang-pilot/review-followup-2026-11-17/verification.json)。现有validate及数据库dry-run继续执行并保存真实结果，见主资料目录precheck.json；不代表完成政策人工审核。既有检索报告、业务判断与手机模块未修改，云端和业务联调不在本轮执行。

## 接续完善：查询演示、更新检查、边界评测及备份恢复

2026-11-16。本轮从`role3/longyang-evidence-v0.1.0`、提交`f36688d6c67a011139c3d12e434ff30562e7a45c`的干净工作区开始；当前改动尚未提交，报告标dirty。下面原“尚无Git/正式目录为空/备份未执行”等描述是较早任务的现场记录，以本节接续结果为准。

实际环境：Windows PowerShell、Node24.21.0/npm11.19.0、MySQL8.0.46/MySQL80。本轮没有改迁移文件或增加数据库框架；新增cheerio1.2.0与pdfjs-dist6.5.438用于来源检查，建议Node22.13以上22.x或Node24。依赖按锁文件重新安装117包，审计0漏洞；npm仍提示esbuild安装脚本未列allowScripts、传递依赖whatwg-encoding弃用，未阻碍实际构建/测试，没有为此升级其它依赖。

功能与职责：保留原findCandidates/getClause，补CLI展示、准确版本查询及人工缺项；source-registry登记16载体/13文件，手动检查正文/附件、哈希与差异、并发锁/幂等任务、人工任务事件；更新不自动发布。增加受令牌保护的内部状态，生产Nginx拒绝/internal/。原生备份/恢复只处理资料7表和受限归档，不代替整库/云灾备；无手机页面/OCR/资格判断实现。

|实际执行|结果与范围|
|---|---|
|初始`npm test`、`npm run test:db`|原16项测试及1个真实MySQL集成流程通过，0跳过，随后才补回归测试|
|`npm.cmd ci --cache ../.npm-cache`|清洁安装成功，未更换包管理器|
|最终`npm.cmd run verify`|9项命令检查全部符合预期；TypeScript/构建通过，24项单元及HTTP测试通过；真实MySQL集成1流程通过、0跳过；mock故意失败/业务未接/离线缺输出按退出1/2识别，不把这些算业务通过|
|`npm.cmd run demo:query -- --isolated ...`两个实际实现调用|按事项/地区/日期返回25条候选、needs_review；按YN_GLT_ELIGIBILITY@1返回1条准确引用；输出保存query-real-candidates/reference.json，humanPolicyApproval=false；项目正式库仍未发布|
|`npm.cmd run data:update:check -- --out ../reports/source-check-all.json`|实际16入口：14 unchanged，2 fetch_failed/404（B6-pdf、C11）。A3扫描PDF记录no_text_layer，C13文字层实际提取；没有真实新增政策变更任务，不把404推断失效|
|`npm.cmd run eval:retrieval`|16例、80/80项技术检查通过，失败0/未执行0；16例建议/资格语义仍待人工核对；检索报告单独保存|
|`npm.cmd run demo:workflow`|独立空_test库执行init/migrate、103版本导入/重复幂等、正式筛选隔离、历史与局部版本、模拟HTTP正文变更→差异→草稿→发布→新引用全过程通过；项目7表前后摘要一致|
|同一workflow的原生备份恢复|7表摘要/行数全相同，113资料版本、21审核事件；13份原件、9份来源检查记录哈希一致，历史和DEMO_C2明确替代关系有效；源/恢复库只清理本轮自建表，项目库不动。先验证临时独立mysqld实例，后使用用户准备的独立_restore_test库复测成功|
|`npm.cmd run eval:boundaries`|30例真实来源开发情景，194项自动检查全未执行、0通过/0失败、30例人工复核；Node原生退出2已独立捕获验证，codeVersion为真实提交+dirty。无/api/guide，不声称系统准确率已验证|
|`npm.cmd run check:service`|最终构建启动：healthz200、readyz200、guide404、内部状态未授权401/授权200，5/5检查通过，进程结束关闭|
|Compose格式解析|更新生产Compose通过Prettier YAML解析；当前无Docker/Nginx，不声称镜像、配置展开或容器启动通过|

新增回归实际覆盖：正文无变化/变化、导航噪声、附件哈希/文字、首次附件缺旧基线、附件缺失、HTTP/解析/下载失败区分、PDF解析失败不能被文件无变化掩盖、重复/并发和内容回退后再变化、发布时间不推断生效、未发布不能提前关闭任务、内部接口鉴权/503/脱敏日志、恢复库名/SQL哈希/切库语句保护。PDF扫描无文本层与解析异常分别记录。

发现并修复：原生mysqldump的默认导入LOCK TABLES使最小权限恢复账号失败；改为--skip-add-locks，不扩大权限。确认失败只留下本轮创建的一张空迁移表后移除该表再复测，恢复成功；没有清空既有资料。Windows临时凭证文件原只读ACL会妨碍删除，改当前所有者F且不继承，完成删除；临时mysqld跳过名称解析影响root本机登录，已在自建实例修正且关闭，没有修改MySQL80服务。评测器旧Git读取因安全目录报错误记not-a-git，现仅显式信任当前工作区根并记录dirty；新增业务包装器取消整体固定180秒截止，由现有逐例超时负责，保证大批超时也能完成逐例报告。

真实资料状态：源JSON仍13文件/90条draft，checked/reviewed未伪填；项目库7个开发版本、0正式版本。本轮没有对真实政策执行导入或发布。完整性分子/分母：来源90/90、引文定位90/90、地区90/90、生效日已知34/90（未知56）、结束日已知0/90（未知90）。未知不当作无期限。省/地方金额、瓦渡申请与免申冲突、经济困难试行期限及2026征求意见后正式接续等仍待人工原件核对。

入口：[维护与演示](MEMBER_3_OPERATIONS.md)、[交接](HANDOFF_MEMBER_3.md)、[流程JSON](../reports/member3-workflow.json)、[统一验证](../reports/verification.json)、[业务未执行](../reports/longyang-boundaries-business.md)。原件/SQL/临时运行快照留reports/local，不提交真实.env和备份。队友机器独立安装与guide/OCR/手机联调、Docker镜像/Nginx/HTTPS、RDS TLS和云端备份切换尚未验证；未创建收费资源或提供虚构线上地址。

日期：2026-11-16（Asia/Shanghai）。报告内时间戳使用ISO UTC，便于不同环境比较。本记录只描述实际完成和实际运行，不把可执行脚本等同于数据库或云端已验收。

## 最新专项审查

本轮依照用户的六项检查要求完成审查，详细结果见[ROLE_3_AUDIT.md](ROLE_3_AUDIT.md)与[结构化报告](../reports/role3-audit.json)。修复非法历史版本静默为空、材料子串误判、空集评测成功、重复案例ID、超时配置误分类、密码占位误判，并补全环境模板/忽略规则/交接字段。没有升级依赖或改写队友业务。新增6项测试，当前15项单元/HTTP/CLI测试和1个真实MySQL集成流程通过，0失败、0跳过。项目库复测前后内容哈希相同；没有清空业务库。

下文保留开发过程说明；其中较早的9项测试记录是审查前基线，当前数量及修复以本节和最新专项报告为准。真实官方资料、队友业务、Docker与云端仍未完成验收，未执行项不记作通过。

初轮修正：`verify` 原先先打印 MySQL 的退出码成功，再在报告里改标 skipped，终端容易误读。现已在打印前识别跳过状态。初轮缺数据库时确实跳过；用户安装并初始化后，当前已完成真实SQL测试，最新状态为pass且skipped=0。

安装后的环境进展：用户已通过官方安装器完成MySQL Server 8.0.46配置，MySQL80为Running，并在自己的终端完成setup:local。专用账号连接、项目及测试库、迁移/资料管理和真实SQL测试均已验证。root密码未交给聊天或保存到项目；.env只保存本地专用维护账号，未写入报告。当前项目库已保留3份虚构文件、3条条款（含DEMO_C1的1/2版本），默认正式查询仍为空。

## 初始检查

- 读取根目录README.md、README_SETUP.md；未找到AGENTS.md。目录只有两份项目说明、码道工具数据、安装包及debug.log。
- 没有前后端业务代码、根项目package.json、ORM或迁移工具。`.codeartsdoer/package.json`属于码道插件依赖，未当作业务工程复用或修改。
- `git status --short`初次与交付复查均返回not a git repository：这里尚未初始化Git，不能虚构分支、提交SHA或未提交差异。没有执行git init/clean/reset，也没有删除原有文件。
- 实际环境Node v24.21.0、npm11.19.0；工程最低Node22.12，生产镜像选Node22。当前Node24构建通过，不代表Node22镜像已构建成功。
- 未发现mysql/mysqld/docker命令或MySQL服务；本地127.0.0.1:3306实测ECONNREFUSED。没有已有数据库配置或云账号参数。

## 实现范围

- 精简TypeScript工程，npm及锁文件；mysql2直连，一个数据库访问层，没有并行引入ORM框架。
- 两个可重入SQL迁移、结构迁移账本和SQL文件校验；显式区域树；文件/条款不可覆盖版本；导入批次及独立发布审核事件。
- 完整JSON字段、真实日期、引用/区域/版本关系校验；维护CLI；数据库dry-run、事务导入、幂等、乐观版本检查、事务锁；发布、撤回和显式旧版恢复保护。
- 内部查询函数按事项/地区/日期筛选，原文与官网来源、来源文件版本、历史及明确关系返回；正式查询隔离草稿和demo，未知生效日期返回needs_review。
- 3份虚构文件/3条条款、单条定位更新批次、空正式模板、JSON Schema与中文字段说明。没有联网抓取后自动审核的政策。
- 13条虚构评测案例、实际HTTP调用入口、离线读取、独立mock故障注入、JSON/Markdown报告、人工复核栏、代码/资料/测试集版本元数据。真实与留出集分开，当前为空。
- 本轮按五个参考仓库重新核对取舍，沿用既有mysql2迁移账本和Node评测；新增ready引用的显式地区覆盖检查、空引用失败检查、可重复本地夹具准备命令和真实服务就绪检查。访问失败的例子及API尝试如实记录在REFERENCES.md。
- 最小Express健康基础服务，不实现/api/guide或/api/ocr；本地MySQL Compose、生产多阶段Dockerfile、RDS专用Compose、Nginx及HTTPS位置、备份恢复和回退说明。
- 指定参考仓库的实际阅读及访问限制记录在REFERENCES.md。未复制完整第三方项目，未采购或创建云资源。

## 实际执行

`npm install`初次因默认缓存目录无写权限失败；改用工作区`.npm-cache`后安装成功。检查发现初选Zod3存在npm公告漏洞，已升级至Zod4.6.7兼容系列并适配API；最终lock重装和审计通过。未通过管理员权限绕过缓存限制。

以下是实际运行结果，原始输出保存在[verification.txt](../reports/verification.txt)，结构化结果保存在[verification.json](../reports/verification.json)：

| 检查 | 实际结果与范围 |
|---|---|
| npm ci --cache ../.npm-cache | 通过，按锁文件重装依赖 |
| npm run check | 通过，TypeScript无错误 |
| npm test | 9项通过，0失败；纯逻辑/本地HTTP工具测试，与下面真实MySQL集成测试分别统计 |
| npm run build | 通过，生成backend/dist；验证的是基础资料服务工程，不包含尚不存在的前端/OCR/业务指南 |
| data:validate --file ../data/demo/batch.json | 3份文件、3条条款、0错误 |
| eval --mock | 实际启动独立回环HTTP模拟服务；13例，63项自动检查通过、3项预设失败、6项因接口错误未执行，13例语义待人工复核；退出1符合自测预期 |
| eval（无EVAL_URL） | 13例的72个适用检查全部未执行、0通过；退出2；不是系统准确率报告 |
| eval --results ../eval/demo/actual.mock.json | 从上次实际mock输出读取；52项检查通过、1项坏引文失败、6项缺结果未执行，标记offline-mock-tooling，退出1 |
| npm run test:db（verify中执行） | 真实MySQL8.0.46中1个集成流程通过，0失败、0跳过；含初始化、幂等、发布/撤回、并发与真实SQL中途失败回滚 |
| data:demo -- --allow-demo | 本机项目库的9个资料准备/核验步骤通过；迁移、dry-run无写入、重复导入、独立发布、版本历史、地区/日期与来源验证；报告local-database.json/md |
| check:service | 真实构建产物启动后healthz200、readyz200、guide404，结束关闭进程；报告local-service.json |
| eval --mock --catalog-db --include-demo | 实际读取已发布数据库目录，工具模拟仍识别3个预设失败；不代表真实业务准确率；报告mock-database-tooling.json/md |
| Compose YAML解析 | Prettier解析两个Compose文件成功；未运行Docker Compose config或容器 |
| npm audit --json | 当前安装依赖0漏洞；这是执行时的审计结果，不是未来漏洞保证 |
| Git复查 | 仍未初始化，无提交版本；评测报告codeVersion为not-a-git-repository |

9项单元/HTTP测试覆盖：字段/日期错误定位；坏引用与区域循环；重复导入计划、陈旧版本及禁止直接审核；草稿/demo隔离；上下级和邻区；日期边界/未知时间/原文链接；版本发布与撤回不静默回退；错误引文/空引用/500/超时；ready引用地区的上级覆盖与邻区拒绝；基础服务healthz200、数据库未就绪503和未实现guide404。其中一项测试包含多个断言，9不是政策案例数量。

真实SQL测试另外在独立空_test库执行：重复迁移、重复导入无新增、草稿与demo正式查询隔离、引用及历史、明确发布/撤回、不允许静默旧版覆盖、两个并发版本只有一个成功。临时CHECK约束使批内第二条版本写入发生真实SQL错误，随后核对版本、批次、区域与工作指针均无部分残留。测试不需要SUPER或改服务器全局配置；成功只移除开始确认空库后本轮创建的7张表，测试库保留为空以便重跑；异常或外来表则保留现场。用户项目库及其他数据库不被清理。

`npm run verify`把这些命令统一执行并保存报告：它会断言mock失败恰好来自DEMO_E11/E12/E13、未接业务接口时所有适用检查均标未执行，以及离线故障被识别。该工具流程通过不能解释为业务评测通过。退出码1/2的含义见EVALUATION.md。

模拟报告：[mock-tooling.md](../reports/mock-tooling.md)、[JSON](../reports/mock-tooling.json)。逐条预设失败原因为：DEMO_E11引文与目录不匹配、DEMO_E12 HTTP500、DEMO_E13超时。实际业务未执行报告：[business-not-executed.md](../reports/business-not-executed.md)。所有real/holdout指标分母为0。

## 尚未执行，不能据此宣称通过

| 项目 | 阻碍与下一步 |
|---|---|
| 真实政策资料的查询与语义 | 本地虚构夹具及MySQL查询已通过；尚无经人工核对的正式政策，不能将开发数据测试记为政策准确率 |
| Dockerfile构建、Compose config/up、Nginx HTTPS、备份恢复演练 | 当前无Docker及实际证书/服务；配置与命令已交付，但未运行，需安装Docker或在ECS执行 |
| 实际/api/guide与OCR、手机联调 | 等待②业务接口与①前端；使用真实脱敏通知、结果及留出集，人工复核引用语义 |
| 真实政策准确性 | 试点未定，正式目录为空；由③收集官网原文，②③确认字段和预期后单独审核发布 |
| ECS/RDS部署 | 待区域、VPC/子网/安全组、规格预算、实例、数据库账号、CA、域名/HTTPS证书、前后端产物和必要云服务配置；没有线上地址 |

收费资源创建必须另由你确认实际规格、用途与当时价格，当前没有执行采购。备份恢复及云端步骤也仅是准备文档，不是恢复成功记录。

## 隆阳区高龄津贴首批采集（2026-11-16）

- 用户指定2021历史说明、2025政策解读、个旧官方附件页均HTTP200；从附件页实际下载云民发〔2024〕113号8页PDF（487919字节），原始SHA-256为`1009162b5b7eb69affac7a818dd16a4581a247413bdf8cc81a9715f00e3f3c97`。每页均成功渲染并目视比对，PDF无文本层；采用网页辅助编排的扫描转写，仍待用户逐字核对，不宣称人工审核/OCR实测通过。
- 额外补充访问的两个省民政厅页面HTTP404，URL和错误完整保存在`data/official/longyang-allowance/provenance.json`，未把搜索摘要充当已获取原文。
- 按现有schemaVersion=1生成2份文件、16条draft条款及3级显式区域定义，另存2021的3段历史参考；没有给2021网页整篇填写被替代/失效关系。明确废止的两个文号保留原文，未取得旧条款时不伪造relations目标。
- 省级金额与隆阳地方金额区分；地方金额、电话、具体地点、特殊账户细则未知。机关、网页发布日期、落款2024-11-19、印发2024-11-20和施行2025-01-01分别记录。
- 对日期证据校验做最小兼容修复：条款日期可引用同一固定文件版本的其他章节（通知第八部分统一施行日期），不再要求所有日期句重复写入每条引文；条件等一般字段的证据仍限本条引文。新增1项回归测试覆盖合法跨章节日期、伪造日期引文及条件越界。

实际运行：

| 命令/检查 | 结果 |
|---|---|
| `node data/official/longyang-allowance/tools/prepare-draft.mjs`（项目根目录） | 生成草稿、来源元数据、历史归档、中文MD/CSV核对表；重跑拒绝覆盖现有草稿 |
| `npm.cmd run data:validate -- --file ../data/official/longyang-allowance/batch.draft.json`（backend） | 2份文件、16条条款，0错误 |
| `npm.cmd run check`、`npm.cmd test`、`npm.cmd run build`（backend） | TypeScript与构建成功；16项测试通过，0失败、0跳过 |
| `node ../data/official/longyang-allowance/tools/precheck.mjs`（backend，调用现有validate/import --dry-run） | 校验及数据库dry-run退出0；计划新增18、修改0、无变化0、错误0；7表前后行数及内容摘要相同 |
| `npm.cmd run data:query -- --matter HIGH_AGE_ALLOWANCE --region 530502 --date 2026-11-16` | 返回`[]`，符合未导入/未发布状态 |

本轮没有执行实际政策导入、任何审核发布、云端操作。现有项目库中原有样例保持原样。批次预检查原始输出、哈希和数据库摘要见`data/official/longyang-allowance/precheck.json`；人工待核对项见同目录`REVIEW_CHECKLIST.md`。本轮不是政策准确率验收，也未穷尽2026年后续调整。需要用户补充的地方标准/249号等详见核对表。

## 隆阳三事项扩展13项来源（2026-11-16，接续任务）

交付目录`data/official/longyang-pilot/`。复用首批2文件/16条款的18份快照（逐份checksum一致），没有重复建113号实体；旧目录继续保留作来源归档，新批次为后续统一导入入口。2021/2023历史材料现按模型编成待审核条款，身份和不发布为当前依据的门槛另存metadata；不擅自新增政策失效日或替代关系。

实际取得：指定13项中12项主体全文已得，第6项因省厅PDF404属于部分获取，但施甸政府文字版26条完整取得；第11项省厅旧路径404，已取得红河州政府云民发〔2026〕4号完整转载，替代来源及原入口保留关联。第13项从HTML脚本字符串参数获得7页PDF，有文字层；7页均渲染并目视比对，保留原始逐页文字和规范化文本。113号继续复用已归档8页扫描原件；未知数字/排版、日期和来源待人工核准，没有真实OCR接口测试。

正文拆分为13文件/90条款：高龄34、经济困难服务21、养老消费35；业务文件数分别6/3/5，其中2026一件事同时涉及前两个事项，所以按业务计文件数相加不是全局去重数。所有official记录仍draft且checkedBy/At、reviewedBy/At未伪填。6个区域定义含CN国家父级和两个项目内部乡镇键；不把内部键说成国家行政编码。

8组冲突/时效事项单列：瓦渡主动申请与免申即享、省级最低标准与地方旧350、试行办法三年有效期与2026接续、经济困难申请流程调整、既有评估三种时间口径、评估完成即可领券简写、机构服务整30天边界，以及额外取得的保山2026年8月统计表百岁1000与旧地方350差异。统计表只作变化线索，没有用它填当前规范性金额。2026年9月征求意见之后的正式办法/续期原件未核实取得，不作不存在结论，征求意见线索没有进入正式政策批次。

实际运行及证据：

| 检查 | 结果 |
|---|---|
| collect/fetch-extra/inspect-html/extract-pdf | 实际HTTP结果、失败原因、获取时间、正文/附件路径见acquisition.json；17份原始载体快照SHA-256匹配，B8省厅/转载正文去空白后相同 |
| data:validate，data:import --dry-run（既有CLI） | 13文件/90条款、0关联错误；新增计划103、修改0、无变化0、错误0，项目7表摘要前后不变；见precheck.json |
| `npm.cmd run check`、`npm.cmd test`、`npm.cmd run build` | TypeScript及构建通过；16项单元/HTTP/CLI测试通过，0失败、0跳过 |
| `node --import tsx scripts/verify-pilot.ts` | 真实本机空_test库12/12项通过；迁移/重复迁移、103版本导入及重复无新增、草稿隔离、坏关联拒绝、真实SQL中途失败回滚、历史、祖先区域/日期/PDF来源查询；成功仅清理本轮7张表，保留空库，项目库摘要不变。见isolated-db-report.json |
| `node ../data/official/longyang-pilot/tools/verify-package.mjs` | 7类资料包一致性检查通过；90条核对表与batch引文/定位一致，18份原编号快照相同，18例格式及支持条款存在，原件哈希一致；见package-validation.json |
| `node ../data/official/longyang-pilot/tools/check-evaluator.mjs` | 既有评测器实际读入18例real开发情景（不是用户真实办事记录，全部预期待人工核对）；业务端点显式留空，117项适用检查全未执行、0通过/0失败，18例语义待复核；评测退出2符合未执行预期，不是系统准确率。报告reports/longyang-development-not-executed.json/md |
| Git状态 | 仍not a git repository，未初始化或清理Git |

隔离验证中的核对字段仅改内存副本，技术审核事件只写入隔离库且已随测试表清理，**不表示真实政策已人工审核**。项目库没有导入或发布本批数据；正式草稿文件、核对人/日期保持待审。18例用于开发联调，holdout未加入案例，guide/OCR/手机端/云端仍未联调或部署。没有新建收费资源、修改业务判断、升级业务依赖。

交接入口：[优先核对总览](../data/official/longyang-pilot/REVIEW_OVERVIEW.md)、[资料运行及逐条发布命令](../data/official/longyang-pilot/README.md)、[13项获取表](../data/official/longyang-pilot/ACQUISITION.md)。
# 2026-11-18 核心联调包与医保下一步素材

阅读README、README_SETUP、成员③交接、ROLE_3_AUDIT和现有导入/查询/隔离流程。工作区开始仅两份longyang-retrieval报告有未提交修改，本轮未覆盖、暂存或推送它们。未改成员①页面、成员②OCR/业务逻辑及原13文件90条款。

- 从原资料选3文件10条款，保留待审状态、原编号、原文和日期；manifest固定主批次及5份输入文件校验值。6业务题＋4地区/日期对照，准确原文和定位见integration-core/CASE_REVIEW.md。
- 真实MySQL空_test库运行迁移、草稿排除10/10、重复导入无变化13/13、临时技术发布、10题60项检索检查，最终60/60。首次邻区状态预期误写needs_review，实际8条省级条款日期均有记录，已修正为matched并复跑通过；未修改政策内容或查询实现。项目库7表摘要不变，测试表已清理。指南接口0/6执行，41项未执行，6题建议/资格语义待人工核验。
- 共济查询操作包记录首页、长者专区上/中/下及误入绑定表单；5张聊天截图观察是3个页面标题，不是5个页面。给出一个动作、未实测的期望画面和未知画面回退；新模块只适配已识别文字，不做图片识别、任务语义判断或自动点击。6例18项通过，保存known-demo/fallback-demo/verification三个真实输出。
- 实际命令：基线npm.cmd test（26通过）；新增后npm.cmd test（29通过）；npm.cmd run check及build通过；data:validate对子集3/10报0错误；test:longyang-core -- --isolated退出0；test:operation退出0；两条demo:operation退出0；原eval读取核心6题、EVAL_URL留空，原生退出2，报告业务未执行而非通过。
- 尚未执行：小程序实机点击、原智能问答/语音体验、结果页解释、图片OCR端到端、队友机器复现、云端部署。本轮未重跑备份恢复，既有演练记录保留；无新收费资源。全部真实政策仍待人工审核。当前未收到本轮提交/推送要求，代码保留在工作区。
