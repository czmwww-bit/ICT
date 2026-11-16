# 成员③：维护、查询演示与恢复演练

2026-11-16。本机Windows、Node24.21.0、npm11.19.0、MySQL8.0.46。建议Node22.13以上的22.x或Node24。以下PowerShell命令均在`D:\ICT\backend`执行；队友克隆后换成自己的仓库路径。真实凭证仅在已忽略的.env中。

## 先分清资料状态

`data/official/longyang-pilot/batch.draft.json`有13文件、90条款，全部待审核（高龄34、经济困难服务21、养老消费35）。原JSON的核对人/日期仍为空；项目库只保留原开发样例，正式资料版本数0。先看[优先核对总览](../data/official/longyang-pilot/REVIEW_OVERVIEW.md)，再核对逐条原文。

`demo:query`、`eval:retrieval`和`demo:workflow`仅在独立空DB_TEST_NAME中导入内存副本，写入明确标记的技术审核事件；成功后只清理本轮创建的7张表，保留空库。它们不修改项目库、不修改真实JSON，也不表示政策已人工审核。已有表、并发运行或错误时停止并保留现场，不会自动清空库。测试与演示应依次执行。

## 三条直接运行的命令

已有本机.env时：

```powershell
Set-Location D:\ICT\backend
# 查询真实来源草稿的隔离技术演示
npm.cmd run demo:query -- --isolated --matter HIGH_AGE_ALLOWANCE --region 530502 --date 2026-11-16
# 手动检查辛街乡已登记的官方页面
npm.cmd run data:update:check -- --source A4
# 对实际MySQL查询执行16例、80项技术检查
npm.cmd run eval:retrieval
```

前两项的正式库只读查询/准确版本示例：

```powershell
npm.cmd run data:show -- --matter HIGH_AGE_ALLOWANCE --region 530502 --date 2026-11-16
npm.cmd run demo:query -- --isolated --id YN_GLT_ELIGIBILITY --version 1
# 真实资料人工发布以后，可以使用项目库：
npm.cmd run data:show -- --id YN_GLT_ELIGIBILITY --version 1
npm.cmd run data:history -- --kind clause --id YN_GLT_ELIGIBILITY
```

实际隔离输出存于`reports/query-real-candidates.json`和`query-real-reference.json`。正式查询当前返回`not_published`；未知编号/无匹配返回`no_match`，未知区域返回`region_unknown`（尚无正式库区域时优先提示未发布），非隆阳地区返回`outside_pilot`，候选有未知生效日期返回`needs_review`，已知时间范围命中返回`matched`。这些都是**资料状态**，不能冒充guide的ready/need_info/needs_review。数据库连接错误和非法日期抛错/退出1，不包装成“无资料”。

事项编码：`HIGH_AGE_ALLOWANCE`、`ECONOMIC_ELDERLY_SERVICE`、`DISABILITY_CARE_CONSUMPTION`；办理地`530502`为隆阳区，省/市为`530000/530500`，全国根为`CN`。匹配显式祖先链，不匹配邻区；乡镇内部键见资料包说明，不能伪称国家行政编码。`--date`为业务希望核对的适用日，ISO `YYYY-MM-DD`；effectiveTo含当天，不以发布日期推定生效或替代。年龄和户籍/常住条件由②判断。

每个候选保留原`clause/document/source`、准确版本、三个内容校验值、发布时间审核事件、关系证据和timeStatus；展示层另给`applicableRegions/time/unknownFields/needsVerification/reviewQuestions`。`unknownFields`表示本条未记录，可能需关联其他条款，不能自行补全。未确认结束日期不表示永久有效；人工问题来自已有review-items，读取失败会明确报错，缺文件明确标不可用。

## 官方来源手动检查

清单：`data/official/longyang-pilot/source-registry.json`，16个载体入口关联13个文件实体，含同文件转载/附件备用入口。稳定sourceId与documentId分开。baseline指向已保存原件，不能随意把新正文改写为旧基线。新登记页面若无旧基线，标first_seen；首次取得原先未下载的附件不能认定已修订。

```powershell
# 全部检查：出现404等会退出1，但其余来源仍继续检查并落盘
npm.cmd run data:update:check -- --out ../reports/source-check-all.json
npm.cmd run data:updates
npm.cmd run data:updates -- --task <上一步任务ID>
npm.cmd run data:status
```

默认运行账本在`reports/local/source-monitor/`（已忽略），可用SOURCE_CHECK_DIR更改到持久目录。含内容寻址blobs、正文/附件快照、state、checks、pending_review任务及人工处理events。`--out`只是导出的检查摘要，不是账本存储位置。检查会获取HTML正文及PDF/Office附件；指定正文选择器，去除导航、脚本和阅读量。不会执行网页脚本，PDF参数只作为字符串解析。正文选择器失效、HTTP失败、附件下载失败、附件缺失分别记parse_failed/fetch_failed/attachment_fetch_failed/attachment_missing，均不计作无变化。

PDF有文字层时提取正文，否则保留文件哈希和no_text_layer，等待人工看原件，不假装已做OCR；Office附件目前只比较文件哈希。正文/附件变化留新快照、完整增删及逐行配对差异。配对的modified只辅助阅读，不等于政策语义修订。网页发布时间元数据单独记录；页面修改时间、文件公布时间与政策生效时间分别保留，后两者须人工核准，检测不产生政策生效/废止结论。

以目录锁阻止同时检查/审阅，以哈希、前后状态和代次避免重复快照/任务；同一变更重复运行不会重复建任务，恢复旧内容后再次变化属于新观察事件。附件缺失不会推进健康基线。进程异常遗留`.lock`时，先查看owner.json并确认对应检查进程已结束，备份目录后只移除该锁；不要在运行时强删锁或state。

本轮真实全量检查：16入口，14无变化，2个HTTP404（B6-pdf省厅PDF、C11省厅旧URL），没有实际新变化任务。B6-web和C11-honghe替代载体仍保留；404不能推断政策失效。[检查报告](../reports/source-check-all.json)记录获取时间、哈希及失败，原资料包的获取记录不覆盖。

## 变化→对比→审核→新版查询

直接演练完整流程：

```powershell
npm.cmd run demo:workflow
```

它实际启动回环HTTP模拟页面，在隔离库使用DEMO_D1/DEMO_C1：保存无变化基线→页面新增明确标记的虚构“示例回执”→保存差异待审→重复检查仅一任务→通过原import生成v2草稿→查询仍v1→原publish发布文件v2和条款v2→关联待审任务→查询返回v2准确原文，旧版可显式读取、未改条款仍v1→备份恢复核对。真实政策只用于技术检索，不伪造官方发生修改的事实。

真实来源发生变化后，由维护人逐字核对任务before/after及原件，按既有格式准备单独更新JSON；只递增受影响的文件/条款版本，填写expectedVersion、actor/reason、checkedBy/At及准确quote/locator。未改条款继续引用原文件版本，不为整篇统一改版；只有原文依据才填关系及日期。

```powershell
# UPDATE.json是人工整理的更新批次路径，ACTOR/REASON用真实核对信息替换
npm.cmd run data:import -- --file ../data/official/UPDATE.json --dry-run
npm.cmd run data:import -- --file ../data/official/UPDATE.json
npm.cmd run data:publish -- --kind document --id DOCUMENT_ID --version 2 --actor ACTOR --reason REASON
npm.cmd run data:publish -- --kind clause --id CLAUSE_ID --version 2 --actor ACTOR --reason REASON
npm.cmd run data:updates -- --resolve TASK_ID --decision published --version 2 --actor ACTOR --reason REASON
npm.cmd run data:show -- --id CLAUSE_ID --version 2
```

真实ID和版本必须按任务和库内版本替换，不要直接批量发布当前90条草稿。published任务只能关联已审核的同一documentId/version，不能绕过import/publish；这个检查证明存在审核版本，**原文变化与该版本是否相符仍须操作者确认**。只发布文件不等于条款已发布。确认只是无关页面编辑时用`--decision dismissed`并记录原因，不导入政策版本。任务关闭事件重复执行留人工审计事件；机器重复检查不会重复生成任务。资料误发布按已有rejected/allow-rollback流程，不删旧版本。

## 评测与实际分母

`eval:retrieval`用16例固定预期实际查询MySQL，80项检查分别核对状态、精确条款/版本、无未审核条款及来源、地区日期、原文来源定位。覆盖施行前后/发布日期不同、未知日期、邻区/试点以外、未审核、局部草稿/发布、精确历史版本。年龄79/80/99/100只验证能够取得相应年龄条件原文，不在③执行资格判断。

语料完整性：来源/原文定位/地区各90/90；有生效日期34/90（56未知），有结束日期0/90（90未知）。未知单独展示，不猜测截止时间。数据库只读结果与人工政策结论分开统计。

30例真实来源业务开发情景在`eval/real/longyang-boundaries.cases.json`，包括户籍/常住、地方与省级标准、历史/免申、冲突、未审核、依据不足、达龄前后和项目周期。每例带支持版本和人工待核对状态；原18例文件保留，holdout仍为空。

```powershell
# 未配置EVAL_URL时，退出2且明确未执行，不会计为通过
npm.cmd run eval:boundaries
# ②接口就绪后，设置完整URL再运行同一命令（不要把令牌放URL）
$env:EVAL_URL = 'http://127.0.0.1:3000/api/guide'
npm.cmd run eval:boundaries
Remove-Item Env:EVAL_URL
```

本轮无guide接口，业务报告30例、194项全部未执行，0通过/0失败、30例人工复核。异常、超时和缺输出由现有评测器逐例记录，不能缩小分母。精确引文、字段和编号自动检查通过仍不能证明建议受到原文支持；manualReview/adviceSupported必须由②③复核。[检索报告](../reports/longyang-retrieval.md)、[业务未执行报告](../reports/longyang-boundaries-business.md)分别保存，mock/real/holdout不混算。

## 独立运行与备份恢复

当前机器已完成setup，保留.env；新机器才按HANDOFF执行setup:local或自行建立项目库和独立空_test库。依赖安装→类型/测试/构建→`demo:workflow`会通过现有init/migrate、导入、重复导入、查询、历史、更新及恢复完整走一遍。队友机器实际运行结果仍待队友确认。

```powershell
npm.cmd ci --cache ../.npm-cache
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run test:db
npm.cmd run demo:workflow
npm.cmd run check:service
```

全流程优先使用.env中DB_RESTORE_TEST_NAME指定的**另一个空_restore_test库**；不接受项目库、源_test库或已有表的库。未配置时可使用已安装mysqld启动临时实例（全新数据目录、动态127.0.0.1端口、随机进程内密码、不注册/修改服务，结束关闭且只删除自建数据目录）。没有现成mysqld也没有恢复库，则恢复标未执行/退出2，不能声称恢复通过。

可选`npm.cmd run setup:restore`交互输入本机root密码，为已有本地维护账号新建并授权第三个_restore_test库，把库名写入忽略的.env；root密码不保存。它不自动删除数据库，DDL失败保留现场。已有恢复库不用重做setup。

独立备份/恢复命令：

```powershell
# 目录必须全新；备份项目库，不写项目政策数据
npm.cmd run data:backup -- --out ../reports/local/manual-backup-001
# 需要先准备DB_RESTORE_TEST_NAME；此命令恢复后保留测试库供人工查询
npm.cmd run data:restore -- --manifest ../reports/local/manual-backup-001/manifest.json
```

依赖MySQL原生mysql/mysqldump客户端，Windows默认查找MySQL Server 8.0安装目录；其它位置设置MYSQL_BIN/MYSQLDUMP_BIN绝对路径。mysqldump仅转储本模块7表并在维护锁下取得一致快照；SQL、7表逐表行数/内容摘要、资料originalPath原件和检查账本一起备份。原件归档仅限data/official目录，按哈希校验；不是整台机器/账号权限/其它业务表备份。需要整个资料目录、配置和镜像的灾备另见DEPLOYMENT。

客户端密码不进命令行，临时配置文件Unix600、Windows仅当前所有者权限，完成立即删除；备份在已忽略目录仍应按敏感资料保管并另做加密/异地副本。恢复前验证SQL和原件哈希、拒绝切库语句；通过原生二进制流恢复，避免PowerShell5重编码中文。DDL不能整体事务回滚，失败只保留新空目标的现场，不重试覆盖业务库。原件及检查记录恢复到备份目录的restored-archives/restored-source-monitor，先人工比对再考虑切换，不覆盖当前资料。

全流程脚本成功后核对7表全量摘要、文件/条款版本、审核状态、历史和明确修订关系、原件13份及更新记录9份，再只移除自己在两个空库创建的表；项目库前后摘要必须一致。SQL/原件实际备份保存在reports/local/workflows下，仓库报告不包含密码。生产RDS实例恢复、账户授权与云端切换尚未演练。

## 运行状态与部署

`/healthz`仍表示进程存活，`/readyz`实际访问数据库，不可用返回503。`data:status`供本地维护查看应用/数据库、最近一次资料检查时间及失败数、最近正式发布时间、数据库未审核/拒绝记录数、待审更新任务。未导入JSON不计入数据库待审数量。

设置不少于24字符的随机ADMIN_STATUS_TOKEN后，内部`/internal/evidence/status`使用Bearer令牌；默认不注册。未授权401，数据库/账本读取失败503，日志仅事件与错误码，不回传连接配置或异常原文。Nginx明确拒绝/internal/，生产后端不暴露主机端口；开发管理端经私网/受控终端访问，令牌不能交给手机前端。

Docker镜像新增SOURCE_CHECK_DIR持久目录，生产Compose只读挂载记录卷，维护容器读写同卷；仍只连接RDS，不启动生产MySQL。容器/Nginx/RDS/CA和HTTPS仍待实机验证，命令见DEPLOYMENT。未添加管理页面、定时任务、完整监测服务或业务判断后端。
