# 资料字段与版本规则

本模块保存证据，不判断申请人资格。当前仅有明确标记的虚构夹具，正式资料库尚无已人工核对的政策。

## 文件组织

- `data/batch.schema.json`：机器可读 JSON Schema；日期还会经过程序的真实日历校验。
- `data/official/batch.template.json`：空的正式批次模板，不包含任何政策。
- `data/demo/batch.json`：3 份虚构文件、3 条条款，覆盖明确替代关系与未知日期。
- `data/demo/update-clause.json`：仅更新一条条款的段落定位；文件和其余条款不变。需先导入初始批次。
- `backend/src/model.ts`：实际校验规则；字段不接受额外拼写，未知值必须写 `null`。

## 批次及共用字段

| 字段 | 含义 |
|---|---|
| schemaVersion | 当前为数字 1 |
| actor / reason | 本次导入操作者与修改原因，非空；不用于自动审核 |
| regions / documents / clauses | 区域、文件、条款数组；支持部分文件或部分条款更新 |
| id | 全项目稳定标识，只允许字母、数字、下划线及短横线，最长 100 字符；`DEMO_` 保留给样例 |
| version / expectedVersion | 初始为 1/0；变更为当前最大版本+1/当前最大版本；重试相同版本、相同内容为无变化 |
| dataset | `official` 或 `demo`；同一稳定编号不能跨数据集变更 |
| reviewStatus | 导入只接受 `draft`；不能通过 JSON 冒充已审核 |
| reviewedBy / reviewedAt | 导入时必须为 null；实际审核事实以发布事件为准 |
| regionCodes | 非空区域编码数组；区域名称和 parentCode 在 regions 注册 |

`regions` 每项为 `{code,name,parentCode,dataset}`。正式编码由团队按民政/统计官方区划资料人工确认，不能根据名称相似度推断上下级。父区域必须显式存在、同数据集且无环。区域编码及定义注册后不可覆盖；区划调整用新编码并人工迁移相关资料。样例采用 `DEMO_CITY/DEMO_A/DEMO_B/DEMO_A_TOWN`，不是国家行政区划编码。

## 文件字段

| 字段 | 类型及说明 |
|---|---|
| title / publisher / sourceUrl | 必填标题、发布机关、http(s)原始官网地址；官网真实性仍须人工审核 |
| publishedAt | `YYYY-MM-DD` 或 null，仅代表发布日 |
| effectiveFrom / effectiveTo | 文件整体适用起止日期或 null；与条款日期分别记录，结束日含当天 |
| effectiveFromEvidence / effectiveToEvidence | 日期非空时必须提供原文依据；不根据发布日补齐生效日 |
| originalText | 必须提供可检索的原文文本；扫描件先人工核对转写，附件不能代替待核对原文 |
| originalPath | 本地归档或附件位置，可 null；不是自动读取任意路径的指令，附件须另行持久化与备份 |
| checkedAt / checkedBy | 最近人工核对日期与核对人，可 null；发布文件前二者都必须提供 |

内部主键为 `(kind,id,version)`，稳定文件编号是 `id`。`checksum` 自动对除 expectedVersion 之外的整个快照进行 SHA-256；包括完整原文、元数据和条款内容，不需人工填哈希。它不是电子签章，也不能证明来源真实。

查询中的 documentChecksum/clauseChecksum 对应**导入时不可变快照**；查询展示的审核人、日期及状态由发布事件投影，不改写该快照或哈希。originalTextChecksum 另对原文文本直接计算 SHA-256，可供②核对原文；原文及引文不会被自动去除首尾空白。

## 条款字段

| 字段 | 类型及说明 |
|---|---|
| documentId / documentVersion | 精确固定来源文件版本；不会因文件更新自动改变旧条款的出处 |
| matterId / matterName | 稳定事项编码及名称，由②③共同确认词表 |
| quote / locator | 原文引用、章节/段落/页码；引用必须在固定版本 originalText 中逐字存在 |
| population / conditions | 适用人群、原始条件文字及其依据；未知为 null |
| actions / materials / channels / contacts | 办理动作、材料、渠道、联系方式的证据数组；未知为 null，已确认没有项目可用空数组 |
| schedule / location | 官方办理时间与地点的证据；不能推测工作日、地址和电话 |
| effectiveFrom / effectiveTo | 条款的生效/失效日期，允许未知；不是数据库版本的创建时间 |
| effectiveFromEvidence / effectiveToEvidence | 对应日期的原文证据；日期与依据必须同时为空或同时非空 |
| relations | `{type,targetClauseId,targetVersion,evidence}` 数组；type 为 replaces/amends/terminates；目标版本必须存在 |

所有证据项均为 `{text,quote,locator}`：text 是保留原始含义的字段文字，quote 是实际原文摘录，locator 定位摘录。一般字段 quote 必须逐字包含在条款 quote 中；条款的生效/失效日期依据允许定位在同一固定文件版本的其他章节（例如文末统一施行日期），仍须逐字包含在该文件原文中。文件日期依据也必须包含在文件原文中。程序不能据此断定日期解释或建议在语义上正确，审核人必须复核。条款区域不能超出所属文件区域（允许文件所在区域的下级）。

不设置根据发布日期推导的“已过期”字段。只有原文确认时填写失效日期或关系；记录关系不会自动修改目标条款，不删除冲突证据。若正式文本明确整个文件同时失效，逐条确认受影响的条款范围后更新相应条款，不能仅靠文件日期筛选替代这一步。

## 表与一致性

| 表 | 用途 |
|---|---|
| evidence_migrations | 数据库结构迁移名、SQL文件哈希、执行时间；与内容更新记录分开 |
| evidence_regions | 显式区域树；父编码有外键 |
| evidence_versions | 文件/条款不可覆盖的 JSON 快照、版本、校验值、create/update 操作类型与批次关联 |
| evidence_heads | 每个实体最新的工作版本，用于维护；不等于已发布版本 |
| evidence_batches | 导入人、修改原因、时间、批次 UUID；可连接每个版本得到修改前后内容 |
| evidence_publications | 独立审核/撤回事件、操作者、原因、时间，外键关联准确快照版本 |
| evidence_import_lock | 一行事务锁，串行化导入及发布，避免新增竞争与发布读取不一致 |

2026-11-19：条款新增可选`paymentRecord`，仅用于官方发放统计/季度公开，不用于政策金额推断。`kind`区分monthly_statistics/quarterly_disclosure；`fromMonth/toMonth`为YYYY-MM或同时null（年份未知）；`periodEvidence`保留期间原文；`ageBandCode/ageBandLabel`区分标准化档位和原表用语；`amountYuanPerPersonMonth/recipientCount/totalPaidYuan`允许未知null，`evidence`保存数值的表头/行依据。嵌套依据必须在条款原文内，统计条款的政策effectiveFrom/effectiveTo必须null，正式生效另建政策条款。旧条款未出现此字段时不补默认值，哈希不变，继续用原JSON版本表，无SQL迁移。查询入口和年月/季度口径见[金额补充交接](../data/official/longyang-pilot/supplement-2026-11-19/README.md)。

原文内容放 JSON 是为支持少量、人工维护的嵌套条款；编号、版本、审核记录仍有数据库主键和外键。跨 JSON 的文件/区域/关系一致性由同一事务内的校验器确保。维护只能走脚本；运行账号只授 SELECT。当前查询在一致性快照中读小型试点资料，再按编码筛选；资料量扩大时可增加事项/区域索引表，无需让②改变业务逻辑。

新导入永远待审核。`publish` 追加 approved 事件并明确选择该版本为当前发布版本；导入后续草稿不影响当前发布版本。撤回当前版本追加 rejected 事件，查询不静默回退；确需回退须再次明确发布旧版本、增加 `--allow-rollback` 并写明原因，避免陈旧审核覆盖较新发布。草稿、撤回版不会出现在正式查询中。发布源文件必须先于发布引用它的条款。

`history` 返回所有草稿/发布历史、before/after及发布记录，仅供内部维护。成员②的 `includeHistory:true` 仍只读已审核历史，不会绕过审核隔离。`asOf` 筛选条款的政策适用范围；它不还原“过去某一天数据库知道什么”。欲审计旧快照须显式指定版本；不同政策条款用不同稳定编号保存，不能用一条版本覆盖另一条政策。

导入先校验整批、再用 InnoDB 事务写入；SQL错误回滚版本、工作指针及更新记录。`expectedVersion` 防止陈旧批次覆盖，并发批次不一致时重读历史后人工合并。MySQL DDL 会隐式提交：迁移采用串行锁、可重入建表和已执行账本，不能声称迁移文件中的所有 DDL 可整体回滚。已执行 SQL 禁止修改，结构变化新增迁移。初始脚本仅支持普通建表 SQL，不支持包含内部分号的存储过程迁移。

当前不提供物理删除命令，保留审计历史；错误资料先撤回，再导入修正草稿。正式服务不暴露导入/发布 HTTP 接口。
