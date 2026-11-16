# 成员③开发与验证记录

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
