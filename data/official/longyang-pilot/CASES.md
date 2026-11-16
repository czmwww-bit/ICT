# 真实来源开发联调案例（不是最终留出集）

18例，全部预期pending，先供②③联合核对。来源是实际官方资料，用户情景是编写的开发输入，不是真实个人办事记录。正式业务接口未完成，未执行准确率评测。

|编号|覆盖|预期状态|关键动作|支持条款|
|---|---|---|---|
|LY_REAL_DEV_01|【真实来源·开发联调·预期待核对】旧申请说明问当前流程|needs_review|说明2021是历史流程，列出免申与地方告知差异，请社区核实当前认证/补录安排。|LY_GLT_HISTORY_2021_APPLY, YN_GLT_AUTO_PROCESS, LY_GLT_WADU_2025_APPLICATION|
|LY_REAL_DEV_02|【真实来源·开发联调·预期待核对】即将80岁尚未联系|ready|联系户籍地村（社区）核查是否在推送名单，遗漏由工作人员核实补录；不承诺资格审批或2027未核实标准。|YN_GLT_AUTO_PROCESS, YN_GLT_MISSING_LIST|
|LY_REAL_DEV_03|【真实来源·开发联调·预期待核对】人户分离|need_info|先确认户籍所在区县，不能把居住地当作户籍办理地。|YN_GLT_HOUSEHOLD_SEPARATION|
|LY_REAL_DEV_04|【真实来源·开发联调·预期待核对】跨县迁移日期不足|need_info|询问迁出/迁入登记日期，提示两地民政对接比对，依原文次月起发停发规则核实。|YN_GLT_HOUSEHOLD_MOVE|
|LY_REAL_DEV_05|【真实来源·开发联调·预期待核对】金融功能未开通|ready|由经办人员引导联系社保卡服务部门/银行开通金融功能；行动不便可请民政协调上门。|YN_GLT_CARD_ACTIVATION, YN_GLT_HOME_CARD|
|LY_REAL_DEV_06|【真实来源·开发联调·预期待核对】失联后跨年恢复|ready|原文跨年补发自完成认证当年的1月份起，向经办人员核对补发明细，不承诺全补往年。|YN_GLT_UNREACHABLE|
|LY_REAL_DEV_07|【真实来源·开发联调·预期待核对】经济困难对象及时效|needs_review|说明2026一件事对象及免申流程；试行三年有效期与新规接续未核实，向民政确认现行依据。|YN_ECON_SERVICE_2023_2_OBJECT, YN_ECON_SERVICE_2023_2_VALIDITY, YN_ELDER_ONE_SERVICE_2026_ECON_FLOW|
|LY_REAL_DEV_08|【真实来源·开发联调·预期待核对】缺经济条件|need_info|询问是否为低保或分散供养特困对象，年龄不能代替经济身份。|YN_ELDER_ONE_SERVICE_2026_ECON_FLOW|
|LY_REAL_DEV_09|【真实来源·开发联调·预期待核对】家属代办消费补贴|ready|按自愿原则代办民政通注册和实名认证，录入老人信息并上传身份证正反面照片，提交申请等待审核。|YN_CONSUMPTION_2026_4_OBJECT, YN_CONSUMPTION_2026_4_PROXY, LY_CONSUMPTION_GUIDE_2026_APPLY_PROXY|
|LY_REAL_DEV_10|【真实来源·开发联调·预期待核对】未评估先预约|ready|先通过民政通预约备案机构能力评估；评估结论与审核符合后才可发券，不承诺评估完一定有补贴。|YN_CONSUMPTION_2026_4_OBJECT, LY_CONSUMPTION_GUIDE_2026_ASSESS|
|LY_REAL_DEV_11|【真实来源·开发联调·预期待核对】消费券期限及核销|ready|原文当月发放当月使用、次月失效；在符合要求机构接受服务后核销，仍支付个人自付部分，不能据此承诺提现。|YN_CONSUMPTION_2026_4_VOUCHER, LY_CONSUMPTION_GUIDE_2026_CONSUME|
|LY_REAL_DEV_12|【真实来源·开发联调·预期待核对】排除情形|needs_review|展示不得重复纳入的明确范围，请经办部门确认现享待遇和衔接，不能承诺重复领取。|YN_CONSUMPTION_2026_4_OBJECT|
|LY_REAL_DEV_13|【真实来源·开发联调·预期待核对】新旧文件流程冲突|needs_review|保留双方原文及日期，联系隆阳民政/社区确认当前资格认证、遗漏补录与旧网页更新情况。|LY_GLT_WADU_2025_APPLICATION, YN_GLT_AUTO_PROCESS, YN_ELDER_ONE_SERVICE_2026_HIGH_FLOW|
|LY_REAL_DEV_14|【真实来源·开发联调·预期待核对】试点以外|needs_review|说明试点资料与当地实施细节不同，咨询上海当地经办，不把试点资料不足判断成无资格。|CN_CONSUMPTION_LAUNCH_2026_START|
|LY_REAL_DEV_15|【真实来源·开发联调·预期待核对】既有评估时间冲突|needs_review|列明2024年7月以来、印发前12个月及保山2025年内口径，请县级民政确认既有结果可否直接对接。|CN_CONSUMPTION_LAUNCH_2026_ASSESS_DATA, YN_CONSUMPTION_2026_4_ASSESS, BS_CONSUMPTION_INTERPRETATION_2026_ASSESS|
|LY_REAL_DEV_16|【真实来源·开发联调·预期待核对】缺地区|need_info|先确认常住办理地区，再查对应实施办法。||
|LY_REAL_DEV_17|【真实来源·开发联调·预期待核对】地方百岁金额不一致|needs_review|分别展示省级300、地方旧网页350和2026统计线索；补调整正式文件及实施日期，不直接选金额。|YN_GLT_PROVINCIAL_RATES, LY_GLT_WADU_2025_LOCAL_RATES|
|LY_REAL_DEV_18|【真实来源·开发联调·预期待核对】操作简写不能支持资格|needs_review|指出流程简写不能覆盖中度以上及排除条件，请经办解释，不给出轻度也一定可领的建议。|LY_CONSUMPTION_GUIDE_2026_ASSESS, YN_CONSUMPTION_2026_4_OBJECT|

可运行案例：eval/real/longyang-development.cases.json；人工语义/来源版本核对：case-review.json。第17例另引用已获取的统计表线索，不当正式金额依据。humanVerified确认前不能作为已审核金标；所有来源仍draft。本轮无真实guide结果，不能计算系统准确率。
