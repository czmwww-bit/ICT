# 实际查阅的第三方参考

查阅日期：2026-11-16。以下只借鉴结构和工作流，未复制完整仓库或第三方实现代码；运行依赖通过npm及锁文件管理。代码为本项目编写，未将上游代码/素材改名后收入项目，因此当前没有需要随源代码重分发的摘录。后续如复制第三方实现，须额外保留其版权、许可证及来源，不以本表代替许可证要求。

本轮按当前README、backend/package.json和已有实现再次复核上述来源。当前已有mysql2迁移账本、资料事务模块和Node评测脚本，因此继续沿用，不再并行安装Umzug/Sequelize或Promptfoo平台。数据库现已接通，相关本地实测状态见DEVELOPMENT_LOG.md，不能沿用初轮“尚无数据库”的结论。

| 来源与实际读取位置 | 采用的部分与取舍 |
|---|---|
| [awesome-compose样例README](https://github.com/docker/awesome-compose/blob/master/react-express-mysql/README.md)、[compose.yaml](https://github.com/docker/awesome-compose/blob/master/react-express-mysql/compose.yaml)、[backend/Dockerfile](https://github.com/docker/awesome-compose/blob/master/react-express-mysql/backend/Dockerfile) | 已读取服务连接、数据卷、构建及健康检查示例。采用独立本地库服务、持久卷及镜像探针；生产只连RDS。未照搬其MariaDB、过时镜像版本、调试端口或前端开发服务器。 |
| [Umzug README](https://github.com/sequelize/umzug/blob/main/README.md) 的 Minimal Example、Custom Storage、Running/List migrations；[examples索引](https://github.com/sequelize/umzug/tree/main/examples) | 已读README内嵌迁移及存储示例、执行账本和排序方式。当前无ORM，只有两份初始SQL，采用mysql2加小型迁移账本、哈希及串行锁，不引入Sequelize。后续迁移复杂时可用Umzug自定义storage承接账本。未声称安装或运行Umzug。 |
| [Promptfoo README](https://github.com/promptfoo/promptfoo/blob/main/README.md)、[HTTP接口与POST/断言示例](https://www.promptfoo.dev/docs/providers/http/)、[测试案例及外部JSON](https://www.promptfoo.dev/docs/configuration/test-cases/)、[输出格式示例](https://www.promptfoo.dev/docs/configuration/outputs/) | 已读取。采用HTTP目标配置、案例/断言分离、逐条结果和JSON导出结构。当前业务接口未完成，精简Node脚本即可满足要求；不安装完整Promptfoo、不把关键词断言当语义审核。HTTP错误/超时单列，模拟与真实结果分开。 |
| [AdminJS README](https://github.com/SoftwareBrothers/adminjs/blob/master/README.md)、[Express集成示例](https://docs.adminjs.co/installation/plugins/express)、[SQL适配器](https://docs.adminjs.co/installation/adapters/sql)、[自定义操作](https://docs.adminjs.co/basics/action) | 已读取。首轮不加入管理后台。所查SQL适配文档只列PostgreSQL，不能据此宣称直接兼容本项目mysql2；若以后引入管理页面，需评估MySQL适配，并将导入/发布包装为调用现有事务模块的自定义操作。禁用直接覆盖版本的默认CRUD，另做身份与授权。 |
| [changedetection.io README](https://github.com/dgtlmoon/changedetection.io/blob/master/README.md) 的过滤/通知、JSON API Monitoring、API Support | 已读取。仅记录后续思路：对已登记的官网URL设置正文选择器、定期变化检测和哈希，变化通知进入人工待核对清单。核对后生成草稿新版本再发布；不把网页变化自动判成政策替代或直接更新已发布资料。本轮未部署监测服务。 |

访问限制：Umzug `examples/3-raw-sql` 目录及尝试的README/index.ts原始地址返回cache miss，GitHub contents API不可访问；已读的内容限于README内嵌示例与examples目录索引，未声称读到该子目录实现。Promptfoo尝试的 `examples/http-provider/promptfooconfig.yaml` 原始地址也返回cache miss，因此使用可访问的官方HTTP及案例文档中的示例。

本轮另通过GitHub contents API尝试读取Umzug该子目录及Promptfoo examples索引，均为网络fetch失败，未获得额外示例正文；五个仓库README及表中官方专题文档可以访问。没有将子目录访问失败扩大为“整个仓库不可访问”。

## 实现位置与验证边界

| 参考方向 | 本项目落地 | 验证状态 |
|---|---|---|
| Compose服务连接和持久化 | deploy/compose.local.yaml；本地仅暴露127.0.0.1，命名卷保存MySQL数据 | YAML解析通过；缺Docker，Compose config/up及容器持久化仍待验证；当前已用原生MySQL实测资料模块 |
| 开发与生产分开 | backend/Dockerfile多阶段构建、生产依赖及普通用户；compose.production.yaml只有RDS连接，不启动生产MySQL；Nginx静态前端与同域/api | Node构建、真实MySQL就绪HTTP探针通过；Docker镜像、Nginx与华为云运行待验证 |
| 迁移执行记录 | src/db.ts与migrations；结构文件哈希/迁移锁/evidence_migrations；政策资料另用versions/batches/publications | 真实空测试库初始化、重复迁移及导入更新通过；当前未引入Umzug或第二个数据库框架 |
| HTTP评测与报告 | src/evaluation.ts、evaluate.ts、eval目录；EVAL_URL目标、追问key、ready引用地区覆盖、材料、引文及禁止断言；JSON/Markdown输出 | 本地mock、离线和数据库发布目录适配均实际运行；业务guide仍不存在，真实政策语义待人工核验 |
| AdminJS后续管理 | 继续使用JSON/CLI导入、history、publish函数；后续页面用自定义操作调用同一事务层 | 未安装后台；不能把本项目mysql2连接直接当作所查PostgreSQL SQL适配器。后续应评估自定义Resource，或团队统一采用的受支持适配层 |
| 官网变化检测 | 后续只对登记的sourceUrl监测正文及附件哈希，保存旧/新快照和差异，生成待核对任务，再导入draft并人工publish | 仅方案，未建立监测服务、Webhook或自动发消息；变更不自动等同于替代/失效 |

AdminJS后续设计中，原始快照的默认edit/delete/bulkDelete应设置isAccessible=false，不能只隐藏按钮；发布、撤回、历史查看都由服务端身份授权及既有事务函数执行。该判断依据上面实际读取的Action文档，当前没有创建面板或绕过审批的管理接口。

网页监测后续交接字段建议为稳定文件id、sourceUrl、观察时间、旧/新正文哈希、归档及diff位置、人工处理状态。机器只能提出候选变化；由核对人确认来源、日期和受影响条款，填写actor/reason后生成资料新版本；只有明确原文支持时才填写replaces/amends/terminates关系。当前未引入相关运行依赖。

数据库实现与云端步骤另核对：

- [MySQL GET_LOCK](https://dev.mysql.com/doc/refman/8.0/en/locking-functions.html)：迁移锁在事务结束后仍需显式释放。
- [MySQL隐式提交](https://dev.mysql.com/doc/refman/8.0/en/implicit-commit.html)：DDL不作为可整体回滚的内容导入事务。
- [华为云RDS连接排查](https://support.huaweicloud.com/rds-mysql_faq/rds_faq_0218.html)：核对ECS/RDS同区域同VPC、内网及SSL连接步骤。

没有从网络抓取后自动审核任何办事政策。试点区县尚未确定，正式资料模板保持为空，等待团队提供可追溯原文并人工核对。
# 本轮官方资料来源（2026-11-16）

隆阳三事项的实际获取结果、原始URL、失败状态与哈希见[data/official/longyang-pilot/acquisition-status.json](../data/official/longyang-pilot/acquisition-status.json)，后续检索见[research-log.json](../data/official/longyang-pilot/research-log.json)。13项正文中第6项指定省厅PDF404但施甸文字全文已得；第11项省厅旧路径404，采用红河州政府云民发〔2026〕4号全文转载，同一文件未重复建实体。第13项从HTML的showVsbpdfIframe字符串参数获取7页官方PDF，未执行网站脚本。

省级文件及政府发布/转载原文作为证据归档，不复制网站应用代码。部分PDF的排版空白规范化与扫描转写方法、人工待复核状态均记录，未把搜索摘要当取得原件。2026年9月征求意见后的正式文件未核实取得，草案仅保留元数据线索；保山2026年8月金额统计表作为额外变化线索存档，不擅自升格为规范性调整依据。

