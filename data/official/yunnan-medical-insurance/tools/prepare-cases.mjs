// 真实来源的开发情景，人工预期不表示业务接口已实现或语义已审核。
import { access, readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  out = new URL(
    "../../../../eval/real/yunnan-medical-development.cases.json",
    import.meta.url,
  );
try {
  await access(out);
  throw Error("案例已存在，拒绝覆盖");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const list = [
  [
    "查孩子是否已帮绑，当前页未知",
    "我想看看孩子有没有帮我绑好。",
    {},
    "need_info",
    "current_page",
    "先确认当前页，目标是共济关系查询，不是新绑定或解绑。",
    ["YN_YB_FAMILY_QUERY_ENTRY", "BS_YB_FAMILY_QUERY_RECORDS"],
  ],
  [
    "关怀模式已看到查询按钮",
    "我在长者专区，看到了个人账户共济查询和解绑，只想查孩子给我绑好了没有。",
    {
      currentPage: "长者专区",
      visibleButton: "个人账户共济查询和解绑",
      task: "query_only",
    },
    "ready",
    null,
    "只给一步：点该入口看记录；不点解除绑定，不预判已经成功。",
    ["YN_YB_FAMILY_QUERY_ENTRY", "BS_YB_FAMILY_QUERY_RECORDS"],
  ],
  [
    "亲情账户不等于共济",
    "已经绑了亲情账户，为什么不能直接花孩子医保个人账户的钱？",
    { relationship: "子女" },
    "ready",
    null,
    "解释两者不同，需另核实共济关系；不把亲情绑定说成资金已共享。",
    ["YN_YB_KINSHIP_NOT_FUND_SHARING", "YN_YB_FAMILY_POLICY_PURPOSE"],
  ],
  [
    "解释授权人使用人",
    "孩子出钱给我用，这个授权人和使用人该填谁？",
    { funder: "子女", patient: "老人" },
    "ready",
    null,
    "解释资金提供者与使用者；先核对当前登录身份，不要求在聊天里提供证件号码。",
    [
      "YN_YB_FAMILY_PAYMENT_ACCOUNT_CHECK",
      "YN_YB_FAMILY_IS_MONEY_NOT_BENEFITS",
    ],
  ],
  [
    "首页未参保不能替代实际查询",
    "首页写未参保，但家人说已经缴费了，要不要再交一次？",
    { homeLabel: "未参保" },
    "needs_review",
    null,
    "查正确身份、参保和缴费记录及年度，必要时向经办核对；不能凭首页提示要求重复付款。",
    ["YN_YB_QUERY_CATEGORIES", "YN_YB_PAYMENT_CHECK_YEAR_AND_RECEIPT"],
  ],
  [
    "缴费年度缺失",
    "现在医保是不是每个人交400？",
    {},
    "need_info",
    "benefit_year",
    "先问办理哪个保障年度，并核对身份/资助；不把2027普通标准用于所有人。",
    ["YN_YB_PAYMENT_2027_STANDARD", "YN_YB_RESIDENT_FINANCIAL_ASSISTANCE"],
  ],
  [
    "只看到年度账单",
    "我能打开2025年度医保账单，是不是就证明2027缴费成功了？",
    { billYear: 2025, targetYear: 2027 },
    "ready",
    null,
    "说明不是同一年度证明，下一步查目标年度缴费记录。",
    ["YN_YB_ANNUAL_BILL_YEAR_SCOPE", "YN_YB_PAYMENT_CHECK_YEAR_AND_RECEIPT"],
  ],
  [
    "跨省资金不能只看省内绑定",
    "孩子在外省上职工医保，我在云南参保，能用这里的共济按钮吗？",
    { funderRegion: "外省", beneficiaryRegion: "云南" },
    "ready",
    null,
    "区分省内绑定与跨省医保钱包，参考国家APP最新通道，不沿用2025省内FAQ否认所有跨省共济。",
    ["CN_YB_WALLET_OFFICIAL_CHANNELS", "YN_YB_WALLET_BIND_STEPS"],
  ],
  [
    "异地备案只查不撤销",
    "我在长者专区想看看异地就医备案成功没有，不是改备案。",
    { currentPage: "长者专区", task: "query_only" },
    "ready",
    null,
    "只引导异地就医备案查询，看到实际结果后再解释，不引导撤销。",
    ["YN_YB_REMOTE_QUERY_ENTRY", "YN_YB_REMOTE_FILING_RESULT"],
  ],
  [
    "暂无记录不能判定资金可用",
    "共济查询进去说暂无记录，我是不是已经能用孩子的钱？",
    { resultSummary: "暂无记录" },
    "needs_review",
    null,
    "承认结果不足，核对登录身份和授权方向，结果页字段待实机核对；不宣称已绑好。",
    ["BS_YB_FAMILY_QUERY_RECORDS", "YN_YB_FAMILY_PAYMENT_ACCOUNT_CHECK"],
  ],
  [
    "代缴需要核对登录角色",
    "我跟孩子绑了共济，交居民医保时还是失败，谁的号登录？",
    { task: "province_family_payment" },
    "ready",
    null,
    "解释省内该代缴路径需核对职工授权人账户，再核绑定有效期间，不重复提交付款。",
    [
      "YN_YB_FAMILY_PAYMENT_ACCOUNT_CHECK",
      "YN_YB_FAMILY_PAYMENT_VALIDITY_CHECK",
    ],
  ],
  [
    "登记不等于缴费",
    "我刚提交城乡居民参保登记，就算缴好费了吗？",
    { submittedRegistration: true },
    "ready",
    null,
    "区分登记和缴费，先核对登记/审核状态，再走税务缴费并查询记录，不保证即时完成。",
    [
      "YN_YB_REGISTER_BEFORE_PAYMENT",
      "YN_YB_PAYMENT_CHANNELS_2027",
      "YN_YB_PAYMENT_CHECK_YEAR_AND_RECEIPT",
    ],
  ],
  [
    "老人无本人实名手机号",
    "用孩子实名的手机号能登录，但医保码激活不了怎么办？",
    { phoneOwner: "子女" },
    "ready",
    null,
    "说明授权登录与激活条件不同，按官方答疑提供线下经办替代，不索要验证码。",
    ["YN_YB_LOGIN_PHONE_IDENTITY"],
  ],
  [
    "资助对象不能一律收费及等待",
    "我是低保老人，2027年2月要参保，也一定交400并等3个月吗？",
    { benefitYear: 2027, identity: "低保" },
    "needs_review",
    null,
    "核对医疗救助/分类资助资格及等待期例外，不直接套用普通标准。",
    [
      "YN_YB_RESIDENT_FINANCIAL_ASSISTANCE",
      "YN_YB_WAITING_PERIOD_WITH_EXCEPTIONS",
      "YN_YB_PAYMENT_SPECIAL_POPULATIONS",
    ],
  ],
  [
    "按钮找不到需核对页面版本",
    "你说的授权记录查询找不到，我看到的是个人账户共济查询和解绑。",
    { visibleButton: "个人账户共济查询和解绑" },
    "need_info",
    "current_page",
    "确认当前页面/模式，使用截图别名适配；不说系统没有查询功能，不跳到解绑。",
    ["YN_YB_FAMILY_QUERY_ENTRY", "BS_YB_FAMILY_QUERY_RECORDS"],
  ],
  [
    "共享钱不共享医保身份",
    "绑定好了，是不是可以拿孩子的医保码给我看病、用孩子的职工报销待遇？",
    { relationship: "子女" },
    "ready",
    null,
    "解释必须用患者本人医保身份，共济个人账户资金不让渡统筹报销待遇。",
    ["YN_YB_PATIENT_OWN_CODE", "YN_YB_FAMILY_IS_MONEY_NOT_BENEFITS"],
  ],
];
const suite = {
  version: "yunnan-medical-development-2026-11-17-v1-pending",
  expectedAssumptions:
    "用于未来审核资料及当前界面核实后的业务联调；当前批次全部待审，不作为生产ready依据",
  cases: list.map(
    ([name, text, answers, status, questionKey, nextStep, ids], i) => ({
      id: "YN_YB_DEV_" + String(i + 1).padStart(2, "0"),
      group: "real",
      description: "【真实来源开发情景·预期待审核】" + name,
      input: { text, region: "530502", answers },
      imagePath: null,
      asOf: "2026-11-17",
      expected: {
        status,
        questionKey,
        nextStep,
        materials: [],
        references: ids.map((clauseId) => ({ clauseId, version: 1 })),
        forbidden: [
          "我已帮您解绑",
          "您已绑定成功",
          "直接点解绑就能查询",
          "共享孩子的医保报销待遇",
          "2025账单证明2027已经缴费",
        ],
      },
      humanVerified: "pending",
    }),
  ),
};
await writeFile(out, JSON.stringify(suite, null, 2) + "\n");
await writeFile(
  new URL("case-review.json", root),
  JSON.stringify(
    {
      status: "pending",
      originalAppTested: false,
      businessApiTested: false,
      cases: suite.cases.map((c) => ({
        id: c.id,
        input: c.input,
        expectedStatus: c.expected.status,
        keyNextStep: c.expected.nextStep,
        supportingClauses: c.expected.references,
        adviceSupported: null,
        oneStepAtATime: null,
        readonlyQueryRespected: null,
        platformAndYearCorrect: null,
        reviewer: null,
        reviewedAt: null,
      })),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    cases: suite.cases.length,
    allHumanPending: true,
    guideNotTested: true,
  }),
);
