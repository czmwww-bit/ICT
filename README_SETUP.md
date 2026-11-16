# 银龄办事通 · 软件安装与华为云开发指南

面向组内三名成员，按 Windows + VS Code 编写。角色和接口定义见 [README.md](README.md)。本文件是建项指南，代码仓库初始化后由各负责人补充实际启动命令和部署地址。

## 先弄清赛题对开发地点和工具的要求

| 事项 | 已查到的信息 | 本组做法 |
|---|---|---|
| 报名赛题 | 第十一届华为 ICT 大赛创新赛赛题一为“基于华为云产品打造 AI 创新应用” | 选题落在社区养老办事，华为云服务用于真实业务 |
| 开发与上线 | 公开赛题解读写明使用华为云码道代码智能体开发，结合已有智能体、Skills 关联云服务，并在华为云上部署供在线运行 | 在本机用码道开发和调试，开发期间接入真实云服务，最后部署到华为云 |
| 具体选型 | 公开解读举例有 RDS、Redis；报名后台的正式任务书及附件决定具体要求 | 本组拟用 OCR 识字、RDS 保存办事依据、ECS 运行应用。由队伍接口人核对指定 Skill、部署方式和提交材料，再确定最终配置 |

高校通知可确认赛题名称，细则来自公开转载的赛题解读。本组尚待核对报名后台正式附件。工具安装记录、开发提交和部署记录可用来说明实际用法。[高校报名通知及官方报名入口](https://chuangxin.dlut.edu.cn/info/1020/16867.htm) · [赛题一公开解读](https://www.10100.com/article/152896034)

## 第一天在电脑上装什么

| 软件或账号 | 谁准备 | 安装方法与用途 |
|---|---|---|
| VS Code | 三人 | 已安装可直接使用。华为官方当前快速入门列出的最低版本为 1.95.3。在“帮助 → 关于”查看版本。[下载 VS Code](https://code.visualstudio.com/download) |
| 华为云码道插件 | 三人按本组方案安装 | VS Code 按 Ctrl + Shift + X，搜索 **CodeArts Agent**，安装后点侧栏码道图标，按提示登录华为账号。用于写代码、解释工程、生成测试及调用相关技能。[官方安装图解](https://support.huaweicloud.com/qs-codeartsagent/codeartsagent_qs_0002.html) |
| Node.js 与 npm | 三人 | 项目使用 React、Vite、Express。建议全组统一 Node 22.x 的较新补丁版，至少 22.12。安装 Node 时包含 npm。[Node.js 下载](https://nodejs.org/en/download) · [Vite 版本要求](https://vite.dev/guide/) |
| Git | 三人 | 用于克隆、提交和合并。由一人创建共享仓库并邀请其余成员；可沿用 Gitee。[Git for Windows](https://git-scm.com/downloads/win) |
| MySQL Community Server | ③本地验证时安装；②按需 | 建议选与最终 RDS 兼容的 MySQL 版本。③用它验证建表、导入及查询；①可以用共同样例先开发。[MySQL 下载](https://dev.mysql.com/downloads/mysql/) |
| 数据库图形客户端 | ②③按需 | 喜欢图形界面可装 DBeaver Community，命令行也可以完成建库和查询。[DBeaver 下载](https://dbeaver.io/download/) |

打开新的 VS Code 终端（PowerShell），分别运行：

```powershell
node -v
npm -v
git --version
```

三行能输出对应版本后，用 VS Code 打开项目文件夹。在码道窗口输入“请查看当前项目的两份 README，概括成员③要交付哪些数据”。能收到基于文档内容的回复，即可开始用码道协作。若找不到插件，先检查搜索词、编辑器版本和扩展市场连接。

React、TypeScript、Vite 和 Express 由项目的 npm 依赖安装。建立仓库时由①②分别初始化前后端并提交 package.json、锁文件和启动脚本；其余成员克隆同一仓库，在对应目录运行 npm ci，再用 npm run 查看已有脚本。若仓库目前只有两份 README，先完成工程初始化。

## 在哪里开发、在哪里开服务

| 地点 | 负责成员 | 做什么 | 怎么知道跑通了 |
|---|---|---|---|
| 自己电脑的 VS Code | ①②③ | 写页面、业务接口、SQL 和导入脚本，用码道完成实际开发任务 | 本地页面能从测试数据生成办事卡 |
| 华为云控制台和 API Explorer | ② | 开通通用文字识别，选定区域，用一张脱敏通知调试，再由后端用 SDK/API 调用 | 能看到后台真实返回的文字，并在前端修改错字。[OCR 在线调试](https://support.huaweicloud.com/usermanual-ocr/ocr_08_0006.html) |
| 华为云 RDS 控制台 | ③ | 创建 MySQL 实例、业务数据库和应用账号，用本地验证过的脚本导入官方资料 | 后端能按试点地区及事项查到条款，并读出原文链接。[RDS 文档](https://support.huaweicloud.com/rds/) |
| 华为云计算资源 | ③牵头，①②配合 | 建议将构建后的前端与 Node 后端部署到同一台 ECS。ECS 与 RDS 选同区域、同一虚拟私有云，后端通过内网连库 | 换一部手机、用移动网络访问演示网址，上传截图后能查看真实结果。[ECS 文档](https://support.huaweicloud.com/ecs/) |

码道供开发者使用；老人打开手机网页时，截图由应用后端提交给 OCR。办事卡若接入云上大模型，由②按队伍获配的模型服务配置推理接口，输入已经检索到的原文，③核对输出能否逐条追溯。首轮可以先用模板生成可测的办事卡。

**Skills 怎么落到项目里？** 队伍接口人先从赛题资料找到配套智能体或技能说明。③可以选择“配置业务后端到云端的部署”作为实际任务，在码道按对应说明调用工具，核对生成的部署配置，运行部署并记录结果。华为也提供 CodeArts Deploy 工具链插件与码道集成的说明；具体采用哪个 Skill 以正式赛题材料和账号实际可用项为准。[码道与部署服务集成说明](https://support.huaweicloud.com/usermanual-deployman/deployman_hlp_4004.html)

## 成员③的第一轮操作

1. **先做数据样例。** 选定候选区县，从官方页面取一份资料。在表格里把文件、原文段落、适用条件和来源链接对应起来，交给②确认字段。初期可以完全在本地做。
2. **验证数据可以复用。** 编写建表和导入脚本。新建空库后运行一次能还原样例，同一批资料重复导入不会新增重复条款。更新条款时保留旧版本和生效范围。用一条查询演示“给定事项及地区，返回原文和出处”。
3. **与②交接。** 提供建表脚本、脱敏样例、字段说明及期望结果。约定数据库连接参数由后端环境变量读取，例如 DB_HOST、DB_PORT、DB_NAME、DB_USER、DB_PASSWORD。仓库只提交占位模板，真实密码和云凭证由各自的授权环境配置。
4. **准备真实云资源。** 队伍接口人核对资源券、适用产品、区域和费用后再开通。建议由③维护一套共享测试环境，成员按角色获得访问权限。本地测试用本地库，云端后端用 RDS 内网地址。
5. **完成上线验收。** 把①的前端构建产物和②的后端部署到云端，配置面向手机的 HTTPS 地址。前端通过同域 /api 访问后端，OCR 凭证留在后端。用未参与开发的手机跑通一次完整输入和一次缺资料追问，把部署版本、地址及测试结果交给全组。

**第一次碰头时的完成标志**：①能展示一张手机办事卡，②能说明生成这张卡需要哪些输入，③能指出卡片上每条建议对应哪段官方原文。三人共同确认这一个案例后，再扩展第二项服务。

## 当前可执行入口（成员③）

```powershell
Set-Location backend
npm.cmd ci --cache ../.npm-cache
npm.cmd run check
npm.cmd test
npm.cmd run build
npm.cmd run data:validate -- --file ../data/demo/batch.json
```

数据库配置、导入发布、调用示例及Windows操作顺序见 [HANDOFF_MEMBER_3](docs/HANDOFF_MEMBER_3.md)；本地Compose、ECS/RDS、Nginx、备份与回退见 [部署说明](docs/DEPLOYMENT.md)。数据库及云端命令需先准备真实环境参数，执行状态以 [开发记录](docs/DEVELOPMENT_LOG.md) 为准。
