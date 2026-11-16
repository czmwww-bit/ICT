# 准确性评测与工具自测

使用精简 Node/TypeScript 脚本，借鉴 Promptfoo 的 HTTP 请求、案例断言与结果导出结构，未安装整个评测平台。本模块不生成业务答案。

## 案例与接口

`eval/demo/cases.json` 有13条**虚构开发案例**：完整本地通知、缺办理地、缺年龄、邻区、明确替代、关系未确认、资料冲突、未审核、覆盖范围外、缺日期/落款或时间地点依据、引用不支持建议、HTTP500、超时。最后三项在独立 mock 中注入故障，不会增加生产 `/api/guide`。

真实业务接口按 README：`POST /api/guide`，JSON请求 `{text,region,answers}`。`region` 的实际值需①②③确认，夹具使用 DEMO 区域编码；`asOf` 仅是评测案例的人工语境，不额外改变 README 的请求协议，模拟通知已写明日期。若②增加查询日期字段，应共同修改适配层。

每例包含 id/group/description、输入文字与可空 imagePath、办理地区与已知条件、预期状态/追问key/关键下一步/材料/引用版本/禁止断言、人工核对状态。所有虚构预期的 `humanVerified` 均 pending，不能充作政策正确率基准。`real` 与 `holdout` 目录独立，当前为空，不虚构真实政策和留出截图。

评测采用的响应字段：

- ready：非空 nextStep、materials数组、非空sources数组。
- need_info：question.key、非空question.text，预期追问按key核验。
- needs_review：非空reason和nextStep（向社区确认的动作或问句）。若②用其他字段，先在 `evaluation.ts` 映射，不替换业务判断。
- sources 每项含 clauseId、clauseVersion、title、quote、url，需与资料目录对应；成员②可直接取查询结果的 source。

## 执行

在 `backend` 目录：

```powershell
# 仅验证评测工具，预设3个失败，预期退出码1
npm.cmd run eval -- --mock --out ../reports/mock-tooling

# 没有业务接口：生成未执行报告，预期退出码2
npm.cmd run eval -- --out ../reports/business-not-executed

# 接入②的实际服务，整个 /api/guide URL 由环境变量指定
$env:EVAL_URL = 'http://127.0.0.1:3000/api/guide'
$env:EVAL_TIMEOUT_MS = '10000'
npm.cmd run eval -- --catalog-db --cases ../eval/real/cases.json --out ../reports/real-business
Remove-Item Env:EVAL_URL

# 读取已有的实际响应；模板见 eval/offline-results.template.json
npm.cmd run eval -- --results ../eval/offline-results.template.json --out ../reports/offline
```

离线文件格式 `{provenance,outputs:{案例编号:实际响应}}`；provenance 为 actual-business、mock-tooling 或 unverified。离线结果不能同时设置 EVAL_URL。缺少的案例输出一律未执行；JSON null、空对象和错误结构不能通过必要字段检查。

默认用 `data/demo/batch.json` 作目录，只验证编号/原文一致性，报告 `catalogApprovalVerified=false`，不宣称草稿已发布。正式评测应使用 `--catalog-db`，在一致性快照中读取数据库真实审核事实和已审核引用；正式查询默认排除示例。要在开发库评测示例可明确加 `--catalog-db --include-demo`。不连接数据库时，也可以用 `--catalog ../data/official/实际批次.json` 做离线目录核对，但报告仍不会证明发布状态。

## 指标及分母

报告输出 `.json`（实际输入输出、错误、逐项断言、元数据及人工复核栏）和 `.md`（便于逐项阅读）。JSON记录代码提交版本（无Git为 not-a-git-repository）、资料目录或数据库快照SHA-256、测试集版本及SHA-256。文件目录哈希不冒充数据库发布版本。

每个 demo/real/holdout 组独立统计：

| 指标 | 自动核验范围 |
|---|---|
| transport | HTTP 成功取得 JSON；500、断网、JSON解析失败、超时为失败 |
| status | 与 ready/need_info/needs_review 预期一致 |
| required_fields | 该状态必须字段及非空要求 |
| region_match | ready的引用资料按显式区域树覆盖办理地区；下级可用上级条款，邻区不匹配。needs_review可引用异地材料说明差异，不据此判错 |
| question | 需要追问时 key 与预期一致且问题文字非空 |
| materials | 逐项比较标准材料名，兼容字符串、{name}或资料证据{text}；说明/quote中出现材料名不能算已提供；名称一致仍需人工核验语义 |
| citation_validity | 资料目录中的编号+版本，及原文、标题、链接精确一致 |
| expected_citations | 必须引用的条款版本齐全 |
| forbidden_claims | 没有出现明确禁止的断言字符串 |

每个指标给出 numerator/denominator/failed/notExecuted；分母是该指标**实际执行数**，未执行单列，不适用项不建立检查。0/0不表示通过。HTTP故障记 transport失败，业务断言因无输出记未执行，不会计入通过。总pass/fail是检查项数，不是通过案例数，更不是系统准确率。真实及留出集为空时分母0，必须补数据后才有结论。

需要人工核验的内容：每条建议是否正确、引用是否真正支持结论、原文条件是否遗漏、日期解释是否准确，以及预期本身是否经专家核对。报告中的 `manualReview.adviceCorrect/citationSupportsConclusion/notes` 待填写；关键词/精确引用存在都不能替代人工语义审核。建议由②③共同复核，保存签名和日期，不在脚本里写死“审核通过”。

当前已实测数据库目录路径：`npm.cmd run eval -- --mock --catalog-db --include-demo --out ../reports/mock-database-tooling`，报告catalogApprovalVerified=true仅证明目录来自真实数据库的审核事件，mode仍为mock-tooling、所有数据仍是demo，不能换算真实政策准确率。地区指标也只核验引文的行政覆盖，不判断户籍资格或办理条件。

退出码：0=已执行的自动检查全部通过且无未执行；1=检查失败或脚本配置错误；2=没有失败但存在未执行。模拟报告始终 mode=mock-tooling；离线结果保留其provenance，不得把模拟响应记为真实系统准确率。

空测试集也返回退出码2，并在JSON notices及Markdown写明“测试集为空”；0/0不能被当作评测成功。重复案例编号会在cases.索引.id处报错。EVAL_TIMEOUT_MS必须为正整数毫秒，配置错误在发起请求前失败，不冒充业务接口超时。材料名称字段需②③共同确认统一词表，评测不猜同义词或材料是否真正适用于用户。

OCR仅交付 `eval/ocr-manifest.template.json`；真实脱敏截图、人工转写、关键日期/区划误字标准和②的OCR接口均待提供。
