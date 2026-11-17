# 云南医保老人常用业务资料包

先看[优先核对表](REVIEW_OVERVIEW.md)。本包服务于“理解业务、陪伴操作”，不新增手机界面、不替成员②实现意图识别/资格判断、不操作任何人的医保账户。

2026-11-17实际取得21个官方正文载体的HTML、59份素材（其中39份为正文图片/附件，其余为页面图标）；编成**20份文件、50条待审核条款、10个事项编码**。18份网页有可提取正文；2027通知和长图指南另作选录视觉转写；旧2026年度纯图只归档、未进入主批次。原养老资料及其报告保持原样。本轮不向项目库导入或发布。

## 优先使用的入口

`navigation.entries.json`独立记录用户提供的两条路径：

|入口编号|路径|目的|
|---|---|---|
|YN_YB_NORMAL_HOME_FAMILY_BIND|普通首页 → 个人账户共济绑定|进入绑定表单，先核对授权人/使用人|
|YN_YB_CARE_ELDER_FAMILY_QUERY|首页关怀模式 → 长者专区 → 个人账户共济查询和解绑|只读查询，不能把“查一下”当成解绑授权|

“我想看看孩子有没有帮我绑好”是人工标注的开发问法，指向查询共济关系；当前页未知时先问页面，不跳到新绑定，也不宣称已经绑定。到长者专区上部先给向下滑一个动作，目标已可见再给点入口一个动作。进入结果页后，只能根据实际提示再解释；当前还没有结果页截图。

官方来源中的“授权记录查询”“绑定查询和解绑”和当前截图的按钮名作为版本别名保留。5张用户截图仅保存可见字段、按钮和出处说明；原始图片在对话中，无可用本地文件路径，不伪称已归档PNG，不混为官方政策。截图“云南省省本级”是参保统筹标签，不自动等同于隆阳或全省待遇；“未参保”也不能替代实际参保/缴费核验。

`terminology`中的授权人、使用人等是根据原文编写的解释，标明不是逐字官方引文、仍待核对。成员②决定何时解释/追问，①控制每次呈现一个动作。不要把素材文件当作已经实现了业务理解能力。

## 政策和操作范围

- 参保查询：参保、缴费、个人账户及消费等查询入口；2025年度医保账单与当前参保状态分开。
- 居民登记/缴费：登记与缴费分开，2027年度通知与2026旧图分开，医保入口与税务支付页面分开。
- 省内共济：个人账户资金用途、近亲属、绑定、授权记录查询及排错；不共享医保统筹报销待遇。
- 亲情账户：代展示患者本人的医保码，不等于资金共济。
- 跨省共济：国家医保服务平台APP医保钱包、2026-11操作手册、税务端跨省支付，不照搬旧转账界面。
- 异地备案：登录/填报/查结果、老人帮办与有效期原文；查结果不自动撤销备案。
- 原有适老服务：仅归档关怀模式、客服、视频办的官方介绍。原智能问答/语音未实际体验，见[体验清单](EXPERIENCE_CHECKLIST.md)。

所有条款原文、定位、结构化字段见`batch.draft.json`与[50条人工核对表](REVIEW_CHECKLIST.md)。`document-metadata.json`区分机关、网页来源、落款、发布日期、施行日及业务年度，不能从迁移URL的日期推定发布日期。正式2024办法明确2024-11-01施行，落款2024-09-01、网页公开2024-09-11分开。2027缴费窗口是办理日期范围，不等于待遇起止日；普通金额不得覆盖资助身份。

2026版官方事项清单xlsx和办事指南docx完整归档。Word只读提取7500个非空段，未渲染；表格勾选、复选框、流程图和分页仍待人工核对。本批只取几段有清楚标题/文字的查询及登记描述，不据扁平文本推定材料必填或全部受理层级。要求2027-01-01前完成承接，不表示今天所有界面都已经更新。

## 运行与成员②调用

在backend使用原.env，不覆盖账号或再建库：

```powershell
Set-Location D:\ICT\backend
npm.cmd run data:validate -- --file ../data/official/yunnan-medical-insurance/batch.draft.json
node ../data/official/yunnan-medical-insurance/tools/precheck.mjs
npm.cmd run demo:medical -- --isolated --matter YB_FAMILY_QUERY --region 530502 --date 2026-11-17
npm.cmd run demo:medical -- --isolated --id BS_YB_FAMILY_QUERY_RECORDS --version 1
```

演示复用`query.ts`和现有导入/发布函数，仅在原有**独立空_test库**技术导入/审核内存副本，成功后只清理本轮7表；项目库摘要必须不变，源JSON继续draft。实际输出见`query-demo.json`和`reference-demo.json`：前者2条候选，后者1条准确版本，均明确humanPolicyApproved=false。演示内14项草稿、幂等、祖先/邻区、日期窗口和版本检查实际执行。

生产调用仍为同进程模块：

```typescript
const candidates = await findCandidates(db, {
  matterId: 'YB_FAMILY_QUERY', regionCode: '530502', asOf: '2026-11-17'
});
const evidence = await getClause(db, 'BS_YB_FAMILY_QUERY_RECORDS', {
  version: 1, includeHistory: true
});
```

默认正式查询只返回审核条款及审核来源。当前未发布本包，项目库正式查询为空是预期；不是“医保没这项业务”。当前`query-view.ts/data:show`仍保留隆阳养老试点提示，医保全省调用请用核心`query.ts`及本示例，②确认服务范围后再适配展示；不能把该提示当作云南医保资格结论。

`null`表示该条未结构化记录，需查原文/关联条款；不能自行补材料、金额、电话、成功状态或生效日。资料层返回候选、准确原文/版本/官网链接、timeStatus和unknownEnd；未知日期返回需核对，不表示永久有效。事项编码见`matters.json`，CN→530000→530500→530502及530400显式关联。保山访谈条款限530500及下级；玉溪平台指南不把当地电话抽成保山号码。

## 更新检查与评测

```powershell
npm.cmd run data:update:check -- --registry ../data/official/yunnan-medical-insurance/source-registry.json --source YB12
node ../data/official/yunnan-medical-insurance/tools/verify-package.mjs
node ../data/official/yunnan-medical-insurance/tools/run-checks.mjs
# ②guide接好后才设置完整EVAL_URL，调用原评测器：
npm.cmd run eval -- --cases ../eval/real/yunnan-medical-development.cases.json --catalog ../data/official/yunnan-medical-insurance/batch.draft.json --out ../reports/yunnan-medical-business
```

`source-registry.json`只登记已有正文或Office附件的18个载体。纯图指南未伪装成可监测正文，原图变更目前需人工按哈希复查；Word/xlsx线上按文件哈希，不声称已比较其表格语义。采集器拒绝覆盖不同快照；新网页变化须另存快照并人工更新。

16例为真实来源编写的开发情景、全部预期pending；不是实际用户业务记录，不是留出集。本轮无guide调用目标，109项适用检查全部未执行、0通过/0失败、16例建议人工待核。`run-checks`显式留空业务目标，是工具自测/未执行记录，不是准确率通过。接入实际结果时还须人工检查是否只给一步、是否选对业务、是否误点解绑、是否解释结果有依据。留出集后续独立准备。

## 核对后导入

本轮止于草稿及预检查。人工逐条核准来源、图片数字、场景/日期后，在副本填写真实checkedBy/checkedAt等字段，再执行：

```powershell
npm.cmd run data:import -- --file ../data/official/yunnan-medical-insurance/batch.reviewed.json --dry-run
npm.cmd run data:import -- --file ../data/official/yunnan-medical-insurance/batch.reviewed.json
# 仅对实际核准的文件及条款分别发布，不批量发布所有草稿
npm.cmd run data:publish -- --kind document --id YN_YB_APP_GUIDE_2024 --version 1 --actor REAL_REVIEWER --reason REAL_REASON
npm.cmd run data:publish -- --kind clause --id YN_YB_FAMILY_QUERY_ENTRY --version 1 --actor REAL_REVIEWER --reason REAL_REASON
```

截图入口记录不在政策数据库审核中自动生效，需另行确认当前页面。原图/附件、检索日期及限制见[获取记录](ACQUISITION.md)；实际检查见`verification.json`、`precheck.json`、`technical-checks.json`，不把实机、OCR或云端状态记为已验证。
