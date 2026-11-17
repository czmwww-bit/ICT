# 先核对这份：隆阳试点资料

**2026-11-16整理；13份文件、90条条款均待审核。项目库未导入、未发布。**

**2026-11-17接续核对**：你的反馈已记录为“部分事实核对”，不等于整批审核通过。两段用户正文、3个月金额统计和红河7份Word附件见[本轮核对回执](review-followup-2026-11-17/README.md)。主导入JSON及13文件/90条款编号、版本、审核字段保持原样；附件7另列7项待核对候选，尚未编入主导入批次。

1. 先看 [13项获取结果](ACQUISITION.md) 与 [文件机关/日期表](DOCUMENTS.md)。第6项正式PDF失败，文字版全文已得；第11项省厅旧链接失败，红河政府全文已得。113号8页PDF和流程7页PDF均已归档。
2. 优先核对下表；再在 [CSV逐条核对表](REVIEW_CHECKLIST.csv) 中填写人名、日期、意见。需要看完整原文及结构化字段时，打开 [90条核对表](REVIEW_CHECKLIST.md)。CSV不是导入文件。
3. 核对后按 [README操作命令](README.md) 修改JSON、重新预检查，再由你选择条款发布。历史、冲突和时效未确认条款不要批量发布。

| 优先级 | 核对问题 | 条款/证据 |
|---|---|---|
| 1 | 已确认省级最低300元；隆阳2026年1月、2月统计350元，8月统计1000元。按地区/月保留，不能把1000回填全年；调整文件和施行日仍缺 | YN_GLT_PROVINCIAL_RATES；LY_GLT_WADU_2025_LOCAL_RATES；本轮BS-202601、BS-202602、BS-202608 |
| 2 | 已确认2023-04-01施行、有效三年；2026年4月仍有免申流程。“原试行办法的接续依据待核实”，不能推断补贴取消 | YN_ECON_SERVICE_2023_2_VALIDITY；YN_ELDER_ONE_SERVICE_2026_ECON_FLOW；research-log.json |
| 3 | 已确认流程口径不一致；过渡、补录、网页未更新均只是待验证解释，未构造替代关系 | LY_GLT_WADU_2025_APPLICATION；YN_GLT_AUTO_PROCESS；YN_ELDER_ONE_SERVICE_2026_HIGH_FLOW |
| 4 | 省方案印发前12个月与保山解读2025年内不能合并；国家2024年7月以来本次用户尚未完成原文核验，继续待核 | CN_CONSUMPTION_LAUNCH_2026_ASSESS_DATA；YN_CONSUMPTION_2026_4_ASSESS；BS_CONSUMPTION_INTERPRETATION_2026_ASSESS |
| 5 | “评估完成即可领券”简写不能覆盖中度以上、年龄/常住和三类排除条件 | LY_CONSUMPTION_GUIDE_2026_ASSESS；YN_CONSUMPTION_2026_4_OBJECT |
| 6 | 消费券首月不足5个工作日改次月、当月使用次月失效、个人自付及暂定比例 | YN_CONSUMPTION_2026_4_VOUCHER、RATES、LTC；LY_CONSUMPTION_GUIDE_2026_CONSUME |
| 7 | 原件数字、落款/印发/网页日期、代办按钮与电话 | 113号PDF第6—8页；流程PDF第1—2、7页；DOCUMENTS.md |
| 8 | 国家、省、市、区、乡显式范围；历史资料不发布为当前依据 | CN→530000→530500→530502→LY_LUJIANG/LY_XIYI；document-metadata.json |
| 9 | 红河7份Word附件本轮全部获取并提取；附件7已纳入核对，尚未入主批次。核对年龄未重写、首月发券简写和长护险评估转换 | 本轮attachment-review.json及sources/C11-attachment-7.doc、txt |
| 10 | 落款2026-01-14、省厅网页2026-01-27、红河转载2026-02-28分开；印发日未单独确证，不能用公开或转载日计算12个月 | document-metadata.json；本轮review-receipt.json；省厅日期为用户核对并见官方检索索引，实时抓取仍404 |
| 11 | 用户经济困难补贴文字是政策解读，不代替404正式PDF；解读称27条，施甸末条26条，待原件核准 | 本轮USER-B6-interpretation.txt及B6-web；原PDF仍待补 |

获取日期不等于人工核对日期；不要自动填写checkedBy/checkedAt。技术校验通过只表示格式和关联可用。18例预期均pending，详见 [案例表](CASES.md)，实际业务接口评测尚未执行。最终留出集没有使用这些案例。
