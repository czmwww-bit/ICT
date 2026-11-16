import { readFile, writeFile, access } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const out = new URL(
  "../../../../eval/real/longyang-development.cases.json",
  import.meta.url,
);
try {
  await access(out);
  throw new Error("案例已存在，拒绝覆盖人工预期。");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const batch = JSON.parse(
  await readFile(new URL("batch.draft.json", root), "utf8"),
);
const cases = [],
  manual = [];
function add(
  id,
  description,
  text,
  answers,
  status,
  nextStep,
  ids,
  questionKey = null,
  materials = [],
  region = "530502",
  notes = "预期仅为人工核对草稿，未调用成员②接口。",
) {
  for (const cid of ids)
    if (!batch.clauses.some((c) => c.id === cid))
      throw new Error("案例条款不存在：" + cid);
  cases.push({
    id,
    group: "real",
    description: "【真实来源·开发联调·预期待核对】" + description,
    input: { text, region, answers },
    imagePath: null,
    asOf: "2026-11-16",
    expected: {
      status,
      questionKey,
      nextStep,
      materials,
      references: ids.map((clauseId) => ({ clauseId, version: 1 })),
      forbidden: [
        "保证审批通过",
        "所有补贴都免申请",
        "消费券可以提现",
        "当前隆阳百岁标准已确定为350元",
      ],
    },
    humanVerified: "pending",
  });
  manual.push({
    id,
    status: "pending_human_review",
    developmentOnly: true,
    holdout: false,
    notes,
    expectedSources: ids.map((clauseId) => ({
      clauseId,
      clauseVersion: 1,
      documentId: batch.clauses.find((c) => c.id === clauseId).documentId,
      documentVersion: 1,
    })),
    additionalEvidenceUrls: [],
    adviceCorrect: null,
    citationSupportsConclusion: null,
    reviewedBy: null,
    reviewedAt: null,
  });
}
add(
  "LY_REAL_DEV_01",
  "旧申请说明问当前流程",
  "我看到2021年说不申请不发高龄津贴，现在83岁，户籍在隆阳，还要带材料去申请吗？",
  { age: 83, householdRegion: "530502" },
  "needs_review",
  "说明2021是历史流程，列出免申与地方告知差异，请社区核实当前认证/补录安排。",
  [
    "LY_GLT_HISTORY_2021_APPLY",
    "YN_GLT_AUTO_PROCESS",
    "LY_GLT_WADU_2025_APPLICATION",
  ],
);
add(
  "LY_REAL_DEV_02",
  "即将80岁尚未联系",
  "我户籍在隆阳，明年第一季度满80岁，社区还没联系，要怎么核对？",
  { householdRegion: "530502", turns80Quarter: "2027-Q1" },
  "ready",
  "联系户籍地村（社区）核查是否在推送名单，遗漏由工作人员核实补录；不承诺资格审批或2027未核实标准。",
  ["YN_GLT_AUTO_PROCESS", "YN_GLT_MISSING_LIST"],
);
add(
  "LY_REAL_DEV_03",
  "人户分离",
  "我82岁，现在住隆阳，想问高龄津贴应找哪里。",
  { age: 82, residenceRegion: "530502" },
  "need_info",
  "先确认户籍所在区县，不能把居住地当作户籍办理地。",
  ["YN_GLT_HOUSEHOLD_SEPARATION"],
  "householdRegion",
);
add(
  "LY_REAL_DEV_04",
  "跨县迁移日期不足",
  "我85岁，户籍从施甸迁入隆阳，高龄津贴什么时候开始由这里发？",
  { age: 85, fromRegion: "530521", toRegion: "530502" },
  "need_info",
  "询问迁出/迁入登记日期，提示两地民政对接比对，依原文次月起发停发规则核实。",
  ["YN_GLT_HOUSEHOLD_MOVE"],
  "moveDate",
);
add(
  "LY_REAL_DEV_05",
  "金融功能未开通",
  "我84岁，隆阳户籍，已在高龄津贴名单，但社保卡金融功能没开通。",
  {
    age: 84,
    householdRegion: "530502",
    inAllowanceList: true,
    cardFinancialActivated: false,
  },
  "ready",
  "由经办人员引导联系社保卡服务部门/银行开通金融功能；行动不便可请民政协调上门。",
  ["YN_GLT_CARD_ACTIVATION", "YN_GLT_HOME_CARD"],
);
add(
  "LY_REAL_DEV_06",
  "失联后跨年恢复",
  "我已享受高龄津贴，去年失联暂停，今年11月完成核查认证，可以把去年全补吗？",
  { allowancePaused: true, verifiedDate: "2026-11-02", pausedSince: "2025-08" },
  "ready",
  "原文跨年补发自完成认证当年的1月份起，向经办人员核对补发明细，不承诺全补往年。",
  ["YN_GLT_UNREACHABLE"],
);
add(
  "LY_REAL_DEV_07",
  "经济困难对象及时效",
  "我83岁，云南户籍，是低保老人，2026年11月还能按三年前办法办服务补贴吗？",
  { age: 83, householdProvince: "530000", economicStatus: "低保" },
  "needs_review",
  "说明2026一件事对象及免申流程；试行三年有效期与新规接续未核实，向民政确认现行依据。",
  [
    "YN_ECON_SERVICE_2023_2_OBJECT",
    "YN_ECON_SERVICE_2023_2_VALIDITY",
    "YN_ELDER_ONE_SERVICE_2026_ECON_FLOW",
  ],
);
add(
  "LY_REAL_DEV_08",
  "缺经济条件",
  "我81岁，隆阳户籍，想问经济困难老年人服务补贴。",
  { age: 81, householdRegion: "530502" },
  "need_info",
  "询问是否为低保或分散供养特困对象，年龄不能代替经济身份。",
  ["YN_ELDER_ONE_SERVICE_2026_ECON_FLOW"],
  "economicStatus",
);
add(
  "LY_REAL_DEV_09",
  "家属代办消费补贴",
  "妈妈72岁常住隆阳，统一评估为中度失能，没有享受列明的三类排除待遇；我能帮她申请养老消费券吗？",
  {
    age: 72,
    residenceRegion: "530502",
    assessmentLevel: "中度失能",
    exclusions: false,
    proxyRelation: "子女",
  },
  "ready",
  "按自愿原则代办民政通注册和实名认证，录入老人信息并上传身份证正反面照片，提交申请等待审核。",
  [
    "YN_CONSUMPTION_2026_4_OBJECT",
    "YN_CONSUMPTION_2026_4_PROXY",
    "LY_CONSUMPTION_GUIDE_2026_APPLY_PROXY",
  ],
  null,
  ["身份证正反面照片"],
);
add(
  "LY_REAL_DEV_10",
  "未评估先预约",
  "我70岁常住隆阳，还没做过能力评估，想先知道消费补贴从哪开始。",
  { age: 70, residenceRegion: "530502", assessmentCompleted: false },
  "ready",
  "先通过民政通预约备案机构能力评估；评估结论与审核符合后才可发券，不承诺评估完一定有补贴。",
  ["YN_CONSUMPTION_2026_4_OBJECT", "LY_CONSUMPTION_GUIDE_2026_ASSESS"],
);
add(
  "LY_REAL_DEV_11",
  "消费券期限及核销",
  "我通过审核拿到了2026年11月养老服务消费券，想留到12月用或取现金，行吗？",
  { voucherMonth: "2026-11", eligibilityApproved: true },
  "ready",
  "原文当月发放当月使用、次月失效；在符合要求机构接受服务后核销，仍支付个人自付部分，不能据此承诺提现。",
  ["YN_CONSUMPTION_2026_4_VOUCHER", "LY_CONSUMPTION_GUIDE_2026_CONSUME"],
);
add(
  "LY_REAL_DEV_12",
  "排除情形",
  "我住隆阳，已是中度失能，正在享受特困人员供养救助，还能再领养老消费券吗？",
  {
    residenceRegion: "530502",
    assessmentLevel: "中度失能",
    receivesSpecialPoorSupport: true,
  },
  "needs_review",
  "展示不得重复纳入的明确范围，请经办部门确认现享待遇和衔接，不能承诺重复领取。",
  ["YN_CONSUMPTION_2026_4_OBJECT"],
);
add(
  "LY_REAL_DEV_13",
  "新旧文件流程冲突",
  "瓦渡乡2025说填申请审批表，另一个通知说高龄津贴免申即享，到底还要不要交？",
  { householdRegion: "530502", age: 86 },
  "needs_review",
  "保留双方原文及日期，联系隆阳民政/社区确认当前资格认证、遗漏补录与旧网页更新情况。",
  [
    "LY_GLT_WADU_2025_APPLICATION",
    "YN_GLT_AUTO_PROCESS",
    "YN_ELDER_ONE_SERVICE_2026_HIGH_FLOW",
  ],
);
add(
  "LY_REAL_DEV_14",
  "试点以外",
  "我住上海，有中度失能评估，能照隆阳的流程和机构名录领吗？",
  { residenceRegion: "310000", assessmentLevel: "中度失能" },
  "needs_review",
  "说明试点资料与当地实施细节不同，咨询上海当地经办，不把试点资料不足判断成无资格。",
  ["CN_CONSUMPTION_LAUNCH_2026_START"],
  null,
  [],
  "310000",
);
add(
  "LY_REAL_DEV_15",
  "既有评估时间冲突",
  "我2024年9月评为中度失能，现在常住隆阳，2026还要重新评估吗？",
  {
    assessmentDate: "2024-09-10",
    assessmentLevel: "中度失能",
    residenceRegion: "530502",
  },
  "needs_review",
  "列明2024年7月以来、印发前12个月及保山2025年内口径，请县级民政确认既有结果可否直接对接。",
  [
    "CN_CONSUMPTION_LAUNCH_2026_ASSESS_DATA",
    "YN_CONSUMPTION_2026_4_ASSESS",
    "BS_CONSUMPTION_INTERPRETATION_2026_ASSESS",
  ],
);
add(
  "LY_REAL_DEV_16",
  "缺地区",
  "我想申请养老服务消费补贴，已经80岁。",
  { age: 80 },
  "need_info",
  "先确认常住办理地区，再查对应实施办法。",
  [],
  "region",
  [],
  null,
);
add(
  "LY_REAL_DEV_17",
  "地方百岁金额不一致",
  "我100岁，隆阳户籍，2025告知说350元，但又看到2026保山统计表1000元，当前到底是多少？",
  { age: 100, householdRegion: "530502" },
  "needs_review",
  "分别展示省级300、地方旧网页350和2026统计线索；补调整正式文件及实施日期，不直接选金额。",
  ["YN_GLT_PROVINCIAL_RATES", "LY_GLT_WADU_2025_LOCAL_RATES"],
);
manual
  .at(-1)
  .additionalEvidenceUrls.push(
    "https://www.baoshan.gov.cn/info/6126/10396644.htm",
  );
add(
  "LY_REAL_DEV_18",
  "操作简写不能支持资格",
  "隆阳流程说能力评估完成即可领券，我刚评为轻度失能，也能直接领吗？",
  { residenceRegion: "530502", assessmentLevel: "轻度失能" },
  "needs_review",
  "指出流程简写不能覆盖中度以上及排除条件，请经办解释，不给出轻度也一定可领的建议。",
  ["LY_CONSUMPTION_GUIDE_2026_ASSESS", "YN_CONSUMPTION_2026_4_OBJECT"],
);
const suite = {
  version: "longyang-real-development-2026-11-16-v1-pending",
  cases,
};
await writeFile(out, JSON.stringify(suite, null, 2) + "\n");
await writeFile(
  new URL("case-review.json", root),
  JSON.stringify(
    {
      developmentOnly: true,
      holdout: false,
      sourceReviewStatus: "all_pending",
      cases: manual,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  new URL("CASES.md", root),
  "# 真实来源开发联调案例（不是最终留出集）\n\n18例，全部预期pending，先供②③联合核对。来源是实际官方资料，用户情景是编写的开发输入，不是真实个人办事记录。正式业务接口未完成，未执行准确率评测。\n\n|编号|覆盖|预期状态|关键动作|支持条款|\n|---|---|---|---|\n" +
    cases
      .map(
        (c) =>
          `|${c.id}|${c.description}|${c.expected.status}|${c.expected.nextStep}|${c.expected.references.map((r) => r.clauseId).join(", ")}|`,
      )
      .join("\n") +
    "\n\n可运行案例：eval/real/longyang-development.cases.json；人工语义/来源版本核对：case-review.json。第17例另引用已获取的统计表线索，不当正式金额依据。humanVerified确认前不能作为已审核金标；所有来源仍draft。本轮无真实guide结果，不能计算系统准确率。\n",
);
console.log(
  JSON.stringify({
    cases: cases.length,
    humanVerified: "pending",
    group: "real",
    holdout: false,
  }),
);
