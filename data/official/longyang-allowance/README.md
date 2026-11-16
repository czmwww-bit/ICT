# 隆阳区高龄津贴首批来源草稿

获取日期：2026-11-16（Asia/Shanghai）。**只完成采集、待审核整理和预检查，未导入、未发布。**

先打开 [REVIEW_CHECKLIST.md](REVIEW_CHECKLIST.md)，对照 [原始8页PDF](sources/yn-notice-2024-113.pdf)。可在 [CSV核对表](REVIEW_CHECKLIST.csv) 填写意见（UTF-8 BOM，适合Excel；CSV是核对表，不是导入源）。

## 文件与边界

| 文件 | 用途 |
|---|---|
| `batch.draft.json` | 现有schemaVersion=1格式：3个正式区域定义、2份待审核文件、16条待审核条款；不是已审核政策 |
| `historical-reference.json` | 2021年3段历史申请说明；归档专用，不能作为batch导入，也不是可查询的现行条款 |
| `provenance.json` | 网页/原文件机关、各类日期、下载SHA-256、转写方法、地方金额缺口、外部废止范围 |
| `retrieval.direct.json` / `retrieval.attachment.json` | 实际HTTP获取时间、地址、状态、附件记录；原始采集日志 |
| `sources/*.html`、`*.txt` | 原网页与正文提取；原HTML不改写，TXT去除网页导航与排版空白 |
| `sources/yn-notice-2024-113.pdf` | 个旧官方页面附件原件，8页扫描件，SHA-256记录在provenance中 |
| `sources/yn-notice-2024-113.transcription.txt` | AI辅助、网页文字辅助编排的扫描件转写；已目视比对，未人工逐字签字核准 |
| `sources/pdf-pages/` / `sources/pdf-extraction.json` | 原PDF逐页渲染及无文本层的实际检查记录 |
| `PRECHECK.md` / `precheck.json` | 实际validate、数据库dry-run、前后7表行数及内容摘要；对应批次SHA-256 |

三项指定来源均成功获取。两项额外的省民政厅页面HTTP404，完整链接在`provenance.json.optionalFetchFailures`；没有用搜索摘要冒充原文。仍需要补充的地方标准及其他文件见核对表，属于未提供/未取得的资料，并非上述PDF下载失败。

## 日期、来源和历史处理

- 省级正式文件编号：`YN_GLT_2024_113`，文号云民发〔2024〕113号。六部门、落款2024-11-19、印发2024-11-20分别记录；个旧转载网页发布日期2024-12-04不充当原文件公开日期。原文件`publishedAt=null`，施行日期2025-01-01有第6页原文依据。
- 2025隆阳政策解读：`LY_GLT_INTERPRETATION_2025`，网页发文机构隆阳区辛街乡人民政府，发布日期2025-08-18；文章来源省民政厅养老服务处。该网页本身的独立施行日期未知，不把网页发布日期当作省级政策施行日期。它作为辅助来源存档，不再生成一套重复条款。
- 2021网页发文机构隆阳区西邑乡人民政府，发布日期2021-05-05。未标原始政策文号、明确施行/失效时间和年龄门槛。现有模型没有“仅历史参考”的正式查询过滤字段，因此单独归档，不伪造失效日期、不混入当前批次。
- 第八部分明确废止云民办〔2009〕12号、云民发〔2022〕71号。两个文件原件和旧条款未取得，`relations=[]`；外部文件废止的原文保存在`YN_GLT_EFFECT_AND_REPEAL`及provenance，不虚构旧条款目标、不推断整篇2021网页失效。
- 金额为**省级**80–99周岁50元/人/月、100周岁及以上300元/人/月。条款保留“省级”及地方不得低于/少于的限定，隆阳地方各档实发标准仍为null，等待地方依据。

## 先执行预检查（可重复，无导入）

在现有配置可连接本地MySQL的情况下：

```powershell
Set-Location D:\ICT\backend
npm.cmd run data:validate -- --file ../data/official/longyang-allowance/batch.draft.json
npm.cmd run data:import -- --file ../data/official/longyang-allowance/batch.draft.json --dry-run
```

如需重新生成前后表摘要及预检查报告，使用已构建的现有模块：

```powershell
npm.cmd run build
node ../data/official/longyang-allowance/tools/precheck.mjs
```

该工具只执行SELECT和现有CLI的validate/import --dry-run，绝不执行无dry-run的导入、发布或迁移。它会更新本目录预检查报告。已有.env继续使用，不覆盖密码或重新setup。

## 你人工核对完成后再执行（本轮没有执行）

1. 逐条填写核对表，确认扫描转写、区划、原文解释及缺口。在`batch.draft.json`中修正需要修改的内容。记录真实导入人的`actor`和原因；将每份拟发布文件的`checkedBy`、`checkedAt`填写为实际人工核对人、YYYY-MM-DD日期，**不要自动把采集日期当人工核对日期**。
2. `reviewStatus`继续为`draft`，`reviewedBy/reviewedAt`继续为null。新记录版本为1/expectedVersion为0。未实际导入前的编辑不需要递增版本；导入后变更必须走新版本。
3. 重新执行上面的validate和dry-run，有错误先修正。地方金额等未知值不能擅自补齐；是否允许在保留缺口的情况下发布省级通用条款由审核人决定。
4. 明确确认资料后执行实际导入：

```powershell
npm.cmd run data:import -- --file ../data/official/longyang-allowance/batch.draft.json
```

5. 使用**现有**独立审核发布命令，先发布来源文件，再逐条发布你确认可发布的条款。例如第一条发放对象（审核人和原因替换为实际内容后执行）：

```powershell
$reviewerName = Read-Host '请输入实际审核人姓名'
$reviewReason = Read-Host '请输入核对依据及发布原因'
npm.cmd run data:publish -- --kind document --id YN_GLT_2024_113 --version 1 --actor $reviewerName --reason $reviewReason
npm.cmd run data:publish -- --kind clause --id YN_GLT_ELIGIBILITY --version 1 --actor $reviewerName --reason $reviewReason
```

其余条款用核对表中的准确编号逐条发布，避免未确认的特殊事项或金额被整批误发布。2025辅助文件可在单独确认后用`--kind document --id LY_GLT_INTERPRETATION_2025`发布；本批条款均绑定省级原文件，不依赖辅助文件的发布。`historical-reference.json`不导入、不发布。

## 给成员②的调用

继续使用现有`findCandidates/getClause`，不新增业务接口或判断逻辑。事项编码暂定`HIGH_AGE_ALLOWANCE`（②③需确认）；办理地区`530502`，通过显式省→市→区祖先链读取省级条款。

```powershell
# 审核发布前应为空；本轮未写入，不应有本批正式候选
npm.cmd run data:query -- --matter HIGH_AGE_ALLOWANCE --region 530502 --date 2026-11-16
# 下面仅在发放对象条款完成发布后才有结果
npm.cmd run data:query -- --id YN_GLT_ELIGIBILITY
```

返回字段形状保持`docs/HANDOFF_MEMBER_3.md`约定。`source.url`指向官方附件入口，`document.originalPath`是归档PDF相对项目根目录的位置，`clause.locator`精确到扫描页和章节，`document.originalText`是待逐字核对的规范化转写。获取/落款/印发/网页日期和历史归档意见见provenance，不冒充模型内不存在的字段。材料/具体受理地点/电话没有原文依据时为null；不能由免申即享推断“不需核实任何条件”。

## 采集辅助工具

本目录tools为资料整理工具，不是后台服务，不加入业务依赖。

- `fetch-sources.mjs`、`fetch-attachment.mjs`：公共官方来源HTTP获取，保存时间/状态/哈希。重新抓取可能改变采集日志；当前已取得的证据无需重下载。不要覆盖正在审核的来源快照。
- `inspect-sources.mjs`：提取HTML正文、检查PDF文本层并渲染8页；辅助依赖独立放在已忽略的`reports/local/source-tools`，本次业务package.json及锁文件未改。
- `prepare-draft.mjs`：初次编排转写/草稿/核对表；已有batch时拒绝覆盖，人工核对期间不再运行。
- `precheck.mjs`：使用已构建模块做只读预检查，无需额外依赖。

如需在新机器复现网页提取和PDF渲染，先在项目根目录安装仅采集用依赖：

```powershell
npm.cmd install --prefix ./reports/local/source-tools --cache ./.npm-cache pdfjs-dist @napi-rs/canvas cheerio
node ./data/official/longyang-allowance/tools/inspect-sources.mjs
```

扫描件无文本层，不代表OCR失败，亦不代表通过真实OCR测试。本轮不新增OCR、不发布政策、不配置云资源。
