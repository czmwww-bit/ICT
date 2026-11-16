# 先核对这份：隆阳试点资料

**2026-11-16整理；13份文件、90条条款均待审核。项目库未导入、未发布。**

1. 先看 [13项获取结果](ACQUISITION.md) 与 [文件机关/日期表](DOCUMENTS.md)。第6项正式PDF失败，文字版全文已得；第11项省厅旧链接失败，红河政府全文已得。113号8页PDF和流程7页PDF均已归档。
2. 优先核对下表；再在 [CSV逐条核对表](REVIEW_CHECKLIST.csv) 中填写人名、日期、意见。需要看完整原文及结构化字段时，打开 [90条核对表](REVIEW_CHECKLIST.md)。CSV不是导入文件。
3. 核对后按 [README操作命令](README.md) 修改JSON、重新预检查，再由你选择条款发布。历史、冲突和时效未确认条款不要批量发布。

| 优先级 | 核对问题 | 条款/证据 |
|---|---|---|
| 1 | 地方百岁金额：旧网页350、2026统计1000、省级300不能混用。补当前调整文件和生效日期 | YN_GLT_PROVINCIAL_RATES；LY_GLT_WADU_2025_LOCAL_RATES；sources/FOLLOWUP_BS_202608.table.json |
| 2 | 经济困难服务补贴试行三年有效期如何接续？9月征求意见后正式文件尚未核实取得，不能将草案作为现行依据 | YN_ECON_SERVICE_2023_2_VALIDITY；YN_ELDER_ONE_SERVICE_2026_ECON_FLOW；research-log.json |
| 3 | 瓦渡主动申请与省级免申即享差异，是否过渡/补录或网页未更新 | LY_GLT_WADU_2025_APPLICATION；YN_GLT_AUTO_PROCESS；YN_ELDER_ONE_SERVICE_2026_HIGH_FLOW |
| 4 | 已有评估的2024年7月以来、印发前12个月、2025年内三个口径 | CN_CONSUMPTION_LAUNCH_2026_ASSESS_DATA；YN_CONSUMPTION_2026_4_ASSESS；BS_CONSUMPTION_INTERPRETATION_2026_ASSESS |
| 5 | “评估完成即可领券”简写不能覆盖中度以上、年龄/常住和三类排除条件 | LY_CONSUMPTION_GUIDE_2026_ASSESS；YN_CONSUMPTION_2026_4_OBJECT |
| 6 | 消费券首月不足5个工作日改次月、当月使用次月失效、个人自付及暂定比例 | YN_CONSUMPTION_2026_4_VOUCHER、RATES、LTC；LY_CONSUMPTION_GUIDE_2026_CONSUME |
| 7 | 原件数字、落款/印发/网页日期、代办按钮与电话 | 113号PDF第6—8页；流程PDF第1—2、7页；DOCUMENTS.md |
| 8 | 国家、省、市、区、乡显式范围；历史资料不发布为当前依据 | CN→530000→530500→530502→LY_LUJIANG/LY_XIYI；document-metadata.json |

获取日期不等于人工核对日期；不要自动填写checkedBy/checkedAt。技术校验通过只表示格式和关联可用。18例预期均pending，详见 [案例表](CASES.md)，实际业务接口评测尚未执行。最终留出集没有使用这些案例。
