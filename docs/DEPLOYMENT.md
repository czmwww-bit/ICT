# 本地与华为云部署

目前只交付资料模块与 Express 基础健康服务；前端、OCR和`/api/guide`均待①②完成。没有云账号参数，未创建收费资源，未执行真实云部署。Docker配置是可审查的部署准备，当前机器没有Docker，镜像构建及Compose启动待验证。

本地进展：原生MySQL8.0.46已完成真实空库迁移、事务导入、并发冲突及版本历史测试；基础Node服务实测healthz/readyz均200。Compose文件已通过YAML解析，不能等同于Docker Compose运行验证。当前本机已有3306服务，若另启本地Compose请改用其他主机端口。完整实测证据见reports/verification.json、local-database.json与local-service.json。

## 配置边界

| 文件 | 使用位置 |
|---|---|
| backend/.env.example → backend/.env | 本地Node：DB_HOST/PORT/NAME/USER/PASSWORD/TLS及可选SSL_CA；端口应为整数，名称只用字母数字下划线 |
| deploy/.env.example → deploy/.env | 本地Compose：MYSQL_DATABASE/USER/PASSWORD/ROOT_PASSWORD/PORT |
| deploy/production.env.example | ECS应用环境，实际存放 `/opt/silver/secrets/production.env`，权限600 |
| deploy/compose.env.example | Compose镜像版本、应用env位置、RDS CA、前端构建目录及HTTPS证书目录 |

所有模板连接值均为占位，不能直接运行。运行参数用环境变量优先于 `.env`；工作目录固定为 backend，迁移文件位于该目录 migrations 下。DB_TLS=true 时必须提供真实RDS CA文件，TLS验证不关闭；本地开发可false。EVAL_URL和EVAL_TIMEOUT_MS仅用于评测，URL是完整接口路径。DB_TEST_NAME仅允许以 `_test` 结尾的独立空库。PORT在生产填写3000，与镜像就绪探针和Nginx约定一致。

真实凭证、`.env.*`、`*.env`、pem证书和数据库备份不应提交Git。`.env.example`是例外模板；Docker构建上下文也排除这些真实环境文件。`.codeartsdoer`是原工具数据，不属于本模块。生产运行账号只授 SELECT；导入/发布使用单独维护账号（SELECT/INSERT/UPDATE），迁移账号额外需 CREATE/ALTER/INDEX/REFERENCES；隔离集成测试需CREATE/ALTER/DROP等权限，不要求TRIGGER或SUPER。通过RDS控制台按真实库名最小授权，不将管理账号给业务服务。

backend/.env.example列出了DB连接及可选PORT、EVAL_URL、EVAL_TIMEOUT_MS；可选项默认注释，不要把尚未填写的接口占位值激活。PORT默认3000，评测默认超时10000ms（mock工具自测默认100ms）。RDS CA应对镜像内node用户可读，环境文件与HTTPS私钥仍按各自权限保管。

## 本地数据库和Node

Windows PowerShell的完整命令顺序见 HANDOFF_MEMBER_3.md。也可使用已经安装的MySQL 8.0，与最终RDS选型统一。Compose仅暴露127.0.0.1端口，命名卷 `mysql-data` 保存数据；`down`保留卷，禁止在保留数据时使用 `down -v`。首次初始化后的密码/库名修改不会自动改动已有卷内容，应通过MySQL管理操作调整。

```powershell
Set-Location D:\ICT
docker compose --env-file deploy/.env -f deploy/compose.local.yaml config
docker compose --env-file deploy/.env -f deploy/compose.local.yaml up -d --wait
Set-Location backend
npm.cmd ci --cache ../.npm-cache
npm.cmd run db:migrate
npm.cmd run build
npm.cmd start
# 另一个终端
Invoke-RestMethod http://127.0.0.1:3000/healthz
Invoke-RestMethod http://127.0.0.1:3000/readyz
```

`healthz`只表示进程存活；`readyz`实际查询迁移后的锁表及锁行，不就绪返回503；二者都不表示OCR或指南功能已就绪。业务HTTP接口不存在时返回404。Compose MySQL探针用实际应用账号执行SELECT 1，而不只检查TCP端口。

## ECS＋RDS控制台待补参数

1. 确认资源券、区域、MySQL引擎小版本（脚本面向8.0）、ECS操作系统和CPU架构、应用镜像版本。ECS和RDS采用同区域、同VPC的内网连接。填写VPC/子网ID、ECS内网地址、安全组ID和RDS内网主机/端口。
2. RDS创建正式业务数据库、只读业务账号、维护账号和迁移账号，设置可用空间、备份保留期、备份窗口和恢复目标。获取CA证书，记录SSL启用状态，配置DB_TLS和DB_SSL_CA。
3. 安全组：RDS数据库端口仅允许ECS所在安全组或指定内网IP；ECS对用户开放443（80仅跳转/证书验证），SSH仅管理员来源，不公开3000、3306、9229等端口。网络ACL/路由也需允许内网连接。
4. 准备域名及DNS、HTTPS证书fullchain/privkey、前端dist路径。成员①提供实际构建命令和静态产物；②提供实际业务Express入口、OCR/模型服务区域与后端凭证、/api/guide行为及错误处理。
5. 正式资料经人工审核后导入，完成真实案例和手机端验收。记录镜像/代码/资料版本、测试报告及实际域名；当前没有可声称已上线的URL。

没有购买资源。任何后续采购前，由你在华为云价格计算器确认ECS vCPU/内存/系统盘/EIP带宽、RDS规格/主备/存储/备份、计费方式与资源券后再批准；本交付不填写未核实价格或自动创建实例。

内网及SSL排查依据：[华为云RDS连接失败排查](https://support.huaweicloud.com/rds-mysql_faq/rds_faq_0218.html)。部署前再核对控制台可用规格和当前文档。

## 生产构建与数据库侧验证

从项目根目录构建基础镜像；不启动Vite开发服务器或Node调试模式：

```bash
docker build -t silver-evidence:review-1 backend
```

镜像使用Node22、多阶段TypeScript构建、生产依赖、node普通用户和/readyz健康检查。生产Compose**没有MySQL服务**；ECS使用RDS。迁移和导入不随业务容器启动自动执行，避免所有副本争用或获得维护权限。

在ECS准备应用环境、仅维护账号使用的 `/opt/silver/secrets/maintenance.env`，CA放 `/opt/silver/secrets/rds-ca.pem`，审核后的资料放 `/opt/silver/data`。环境文件中的数据库参数相同，账号按用途区分。Linux ECS 可先用维护镜像完成数据库验证：

```bash
docker run --rm --env-file /opt/silver/secrets/maintenance.env -v /opt/silver/secrets/rds-ca.pem:/run/certs/rds-ca.pem:ro silver-evidence:review-1 node dist/src/cli.js migrate
docker run --rm --env-file /opt/silver/secrets/maintenance.env -v /opt/silver/secrets/rds-ca.pem:/run/certs/rds-ca.pem:ro -v /opt/silver/data:/data:ro silver-evidence:review-1 node dist/src/cli.js import --file /data/official.json --dry-run
# 确认dry-run后同一命令去掉 --dry-run；文件和条款逐条由人工执行publish
```

发布命令形式：`node dist/src/cli.js publish --kind document --id <实际编号> --version <版本> --actor <审核人> --reason <核对说明>`；条款把kind改为clause。可重复执行迁移和相同批次导入；发布是审计事件，每次明确操作均留痕。

配置 `/opt/silver/secrets/compose.env`（参考deploy/compose.env.example），APP_IMAGE填写已构建的版本标签，APP_ENV_FILE指向只读业务账号配置；使用本次实际项目目录中的Compose：

```bash
docker compose --env-file /opt/silver/secrets/compose.env -f deploy/compose.production.yaml config
docker compose --env-file /opt/silver/secrets/compose.env -f deploy/compose.production.yaml up -d backend --wait
```

基础服务健康通过后仍需等待①②交付；不要把这一步当作完整产品部署。②把业务路由挂入同一个Express app，继续复用数据库池和资料函数。①的React/Vite目录当前不存在，不能虚构其 `npm run build` 已通过；接入后补充真实前端构建命令并将其dist交给Nginx。

完整应用齐备时修改 `deploy/nginx.conf` 域名、证书文件，确认FRONTEND_DIST/HTTPS_CERT_DIR指向真实路径，然后启用 `--profile web up -d --wait`。Nginx保留/api路径前缀，同域反代到backend:3000；HTTPS证书和前端产物缺失前不要启用web profile。Docker Compose会提前展开env，因此即使只运行backend，也应把compose.env中的镜像、CA及环境文件占位替换完整。

## 备份与恢复

RDS先配置自动备份；生产每次结构迁移及重要资料更新前额外手动备份，并实际演练恢复到**新实例/新库**。ECS数据备份还需包含附件归档、资料JSON、审核记录、镜像版本与配置（凭证单独保管）。mysqldump示例面向有足够权限的备份账号，将密码放外部600权限的MySQL配置文件，避免出现在命令行：

```bash
mysqldump --defaults-extra-file=/opt/silver/secrets/backup.cnf --single-transaction --routines --triggers --set-gtid-purged=OFF --result-file=/opt/silver/backups/before-update.sql ACTUAL_DB_NAME
# 恢复到已建立的独立新库，先停止维护写入；不要覆盖正在使用的正式库
mysql --defaults-extra-file=/opt/silver/secrets/backup.cnf RESTORE_DB_NAME -e 'source /opt/silver/backups/before-update.sql'
```

Windows本地Compose备份避免PowerShell5.1管道改写UTF-8。可先在容器内生成文件，再用docker cp复制，SQL不通过PowerShell文本重定向：

```powershell
Set-Location D:\ICT
$mysqlContainer = docker compose --env-file deploy/.env -f deploy/compose.local.yaml ps -q mysql
docker exec -it $mysqlContainer mysqldump -uroot -p --single-transaction --set-gtid-purged=OFF --result-file=/tmp/silver-backup.sql ACTUAL_DB_NAME
docker cp "${mysqlContainer}:/tmp/silver-backup.sql" ./silver-backup.sql
# 用备份副本恢复到另建的独立库，先由管理员创建 RESTORE_DB_NAME
docker cp ./silver-backup.sql "${mysqlContainer}:/tmp/silver-restore.sql"
docker exec -it $mysqlContainer mysql -uroot -p RESTORE_DB_NAME
# 进入mysql后执行：source /tmp/silver-restore.sql;
```

`-p` 会交互询问密码，不把密码写进命令行。ACTUAL_DB_NAME/RESTORE_DB_NAME均须替换为准确库名。备份文件不提交仓库（正式操作请移至受保护备份目录并加密）；恢复后检查迁移账本、版本数量、发布记录、哈希、真实条款查询和样例隔离，再由人工切换连接。账号/授权不在单库资料备份范围内，另行维护。

## 更新失败和回退

导入校验失败不写入；写入途中SQL失败整批回滚，不要清表补救，先修复批次并dry-run。DDL失败可能已创建部分表，保留现场和日志：当前初始迁移可重入；已执行文件不修改，后续迁移需向前修复或使用已验证备份，不能许诺DDL事务整体回滚。

资料误发布：用 `publish ... --decision rejected --actor ... --reason ...` 撤回准确版本；撤回当前条款不自动回退旧版。需要恢复旧快照时明确重新发布其版本、添加 `--allow-rollback` 并记录依据；如果来源文件撤回，依赖它的条款也不会被正式查询返回。业务应用更新前记录APP_IMAGE旧标签、备份和迁移兼容性；使用新标签重建/更新容器，若健康失败将APP_IMAGE改回旧标签并重新up。数据库不能盲目跟随应用降级，先核验旧应用与新结构兼容；当前迁移均为新增表。
