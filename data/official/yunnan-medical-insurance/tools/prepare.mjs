// 人工编排有出处的资料；不执行资格判断或发布，不覆盖已有待审批次。
import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  json = async (f) => JSON.parse(await readFile(new URL(f, root), "utf8")),
  save = async (f, v) =>
    writeFile(
      new URL(f, root),
      typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n",
    );
try {
  await access(new URL("batch.draft.json", root));
  throw Error("批次已存在，拒绝覆盖人工修改");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const acq = await json("acquisition.json"),
  word = await json("sources/YB18-guide.paragraphs.json"),
  documents = [],
  clauses = [],
  metadata = [],
  review = [];
const matters = {
  YB_APP_LOGIN: "云南医保登录及身份核对",
  YB_ENROLLMENT_QUERY: "医保参保及缴费信息查询",
  YB_RESIDENT_ENROLLMENT: "城乡居民医保参保登记",
  YB_RESIDENT_PAYMENT: "城乡居民医保缴费",
  YB_FAMILY_BINDING: "医保个人账户省内共济绑定",
  YB_FAMILY_QUERY: "医保个人账户共济查询",
  YB_KINSHIP_ACCOUNT: "医保亲情账户",
  YB_REMOTE_FILING: "异地就医备案及查询",
  YB_WALLET_CROSS_PROVINCE: "医保钱包跨省共济",
  YB_ELDERLY_HELP: "医保关怀模式及人工帮办",
};
const common = {
  version: 1,
  expectedVersion: 0,
  dataset: "official",
  reviewStatus: "draft",
  reviewedBy: null,
  reviewedAt: null,
};
const sourceMap = new Map(),
  docMap = new Map();
for (const s of acq.records.filter((s) => s.id !== "YB21")) {
  const regions =
    s.id === "YB16" ? ["CN"] : s.id === "YB17" ? ["530500"] : ["530000"];
  let originalText;
  if (["YB07", "YB08"].includes(s.id))
    originalText = await readFile(
      new URL("sources/" + s.id + ".visual-transcription.txt", root),
      "utf8",
    );
  else originalText = await readFile(new URL(s.textFile, root), "utf8");
  if (s.id === "YB18")
    originalText +=
      "\n\n【官方附件2文字节选，未据此推断表格勾选或页码】\n" +
      word
        .filter(
          (p) =>
            (p.index >= 507 && p.index <= 514) ||
            (p.index >= 1502 && p.index <= 1509) ||
            (p.index >= 1543 && p.index <= 1560),
        )
        .map((p) => p.text)
        .join("\n\n");
  const publisher = ["YB03", "YB05"].includes(s.id)
    ? "云南省人民政府办公厅"
    : s.id === "YB02"
      ? "玉溪市医疗保障局"
      : s.id === "YB16"
        ? "国家医疗保障局"
        : s.id === "YB17"
          ? "保山市医疗保障局（官方访谈答复）"
          : s.id === "YB18"
            ? "云南省医疗保障局办公室"
            : "云南省医疗保障局（发布或转载）";
  const doc = {
    ...common,
    id: s.documentId,
    title: s.title,
    publisher,
    sourceUrl: s.url,
    publishedAt: s.pagePublishedAt?.slice(0, 10) || null,
    originalText,
    originalPath: "data/official/yunnan-medical-insurance/" + s.file,
    checkedAt: null,
    checkedBy: null,
    effectiveFrom: null,
    effectiveTo: null,
    effectiveFromEvidence: null,
    effectiveToEvidence: null,
    regionCodes: regions,
  };
  documents.push(doc);
  sourceMap.set(s.id, s);
  docMap.set(s.id, doc);
  const raw = await json("sources/" + s.id + ".extracted.json");
  const m = {
    documentId: doc.id,
    sourceId: s.id,
    classification: s.classification,
    webPublisher:
      s.id === "YB02"
        ? "玉溪市医疗保障局"
        : s.id === "YB16"
          ? "国家医疗保障局"
          : s.id === "YB17"
            ? "保山市人民政府网站"
            : "云南省医疗保障局",
    webPublishedAt: doc.publishedAt,
    sourceLabel: s.contentSource,
    originalIssuer: publisher,
    signedAt:
      s.id === "YB03"
        ? "2024-09-01"
        : s.id === "YB05"
          ? "2024-12-23"
          : s.id === "YB18"
            ? "2026-11-10"
            : null,
    effectiveFrom: s.id === "YB03" ? "2024-11-01" : null,
    effectiveTo: null,
    contentHash: createHash("sha256").update(originalText).digest("hex"),
    rawHash: s.sha256,
    sourceAssets: s.assets,
    manualReviewStatus: "pending",
    webDateNotTakenFromUrl: true,
    warnings: [],
    paragraphs: raw.paragraphs,
  };
  if (s.id === "YB02")
    m.warnings.push(
      "省级平台操作由玉溪官方指南提供；玉溪各县电话不能用于保山，2024界面需和用户当前截图分别核对。",
    );
  if (["YB07", "YB08"].includes(s.id)) {
    m.originalTextRepresentation =
      "selected_assistant_visual_transcription_pending_human_verification";
    m.warnings.push(
      "主体为官方长图，原图已全量归档；文本只选录相关板块，金额、日期及按钮待逐字人工核对。",
    );
  }
  if (s.id === "YB08")
    m.warnings.push(
      "第②步第二个缴费按钮印字待复核，不作为自动导航标签；普通缴费标准不能覆盖特殊人员资助，缴费年度与操作日期分开。",
    );
  if (s.id === "YB11")
    m.warnings.push(
      "仅解释2025省内共济代缴路径；不能用其中跨省不可用的片段否认2026跨省医保钱包。",
    );
  if (s.id === "YB13")
    m.warnings.push(
      "FAQ中仅举父母配偶子女的片段不是完整近亲属清单；其他业务含未来调整提示，本批不抽取其生育报销结论。",
    );
  if (s.id === "YB17")
    m.warnings.push(
      "保山答复只作当地来源；其旧医保钱包转账步骤不代替2026-11的新操作手册。",
    );
  if (s.id === "YB18") {
    m.adaptationDeadline = "2027-01-01";
    m.sourceParts = [
      { file: s.file, role: "印发通知" },
      ...s.assets.filter((a) => a.kind === "attachment"),
    ];
    m.warnings.push(
      "附件2只读OOXML提取7500个非空段，未渲染；表格/复选框/流程图不得只凭扁平文本推定必填材料、受理层级或分页。要求2027-01-01前调整，不等于当前所有页面已同步。",
    );
  }
  if (s.id === "YB19")
    m.warnings.push("2025年度账单不是2026/2027参保或缴费成功证明。");
  if (s.id === "YB16")
    m.warnings.push(
      "全国功能进度是截至2026-10-20的快照；预计年底实现的功能不视为当前已全部实现。",
    );
  metadata.push(m);
}
const E = (text, quote, locator) => ({ text, quote, locator });
function portion(source, start, end) {
  const doc = docMap.get(source),
    i = doc.originalText.indexOf(start);
  if (i < 0) throw Error(source + "起点不存在：" + start);
  const j = end
    ? doc.originalText.indexOf(end, i + start.length)
    : doc.originalText.length;
  if (j < 0) throw Error(source + "终点不存在：" + end);
  return doc.originalText.slice(i, j).trim();
}
function para(source, start, end = start) {
  const ps = metadata.find((m) => m.sourceId === source).paragraphs;
  return ps.slice(start - 1, end).join("\n\n");
}
function add(id, source, matter, quote, locator, options = {}) {
  const doc = docMap.get(source);
  if (!quote || !doc.originalText.includes(quote))
    throw Error("原文关联失败：" + id);
  const c = {
    ...common,
    id,
    documentId: doc.id,
    documentVersion: 1,
    matterId: matter,
    matterName: matters[matter],
    quote,
    locator,
    population: null,
    conditions: null,
    effectiveFrom: null,
    effectiveTo: null,
    effectiveFromEvidence: null,
    effectiveToEvidence: null,
    actions: null,
    materials: null,
    channels: null,
    contacts: null,
    schedule: null,
    location: null,
    relations: [],
    regionCodes: doc.regionCodes,
  };
  if (options.kind === "action") c.actions = [E(quote, quote, locator)];
  if (options.kind === "condition") c.conditions = E(quote, quote, locator);
  if (options.kind === "channel") c.channels = [E(quote, quote, locator)];
  if (source === "YB03") {
    const q = portion(source, "第二十三条", "关联链接：");
    c.effectiveFrom = "2024-11-01";
    c.effectiveFromEvidence = E("2024-11-01", q, "第六章 第二十三条");
  }
  if (options.window) {
    const [from, to] = options.window;
    c.effectiveFrom = from;
    c.effectiveTo = to;
    c.effectiveFromEvidence = E(from, quote, locator);
    c.effectiveToEvidence = E(to, quote, locator);
    c.schedule = E(quote, quote, locator);
  }
  clauses.push(c);
  review.push({
    clauseId: id,
    documentId: doc.id,
    sourceId: source,
    matterId: matter,
    quote,
    locator,
    status: "pending_human_review",
    fieldEvidence: options.kind ?? null,
    dateMeaning: options.window
      ? "缴费操作窗口，非待遇保障期或文件统一施行日"
      : source === "YB03"
        ? "原文明确施行日"
        : "生效时间未知；不由网页日期推定",
    question:
      options.question ??
      "核对原文、适用人群/参保统筹区、页面版本及后续调整；不据此自动认定资格或操作结果。",
  });
}
add(
  "YN_YB_LOGIN_TAX_ID_ERROR",
  "YB01",
  "YB_APP_LOGIN",
  para("YB01", 1, 6),
  "网页问题1及完整处理步骤",
  { kind: "action" },
);
add(
  "YN_YB_LOGIN_PHONE_IDENTITY",
  "YB01",
  "YB_APP_LOGIN",
  para("YB01", 7, 8),
  "网页问题2",
  { kind: "condition" },
);
add(
  "YN_YB_LOGIN_PHONE_CHANGE",
  "YB01",
  "YB_APP_LOGIN",
  para("YB01", 9, 11),
  "网页问题3及两种方式",
  { kind: "action" },
);
add(
  "YN_YB_QUERY_CATEGORIES",
  "YB02",
  "YB_ENROLLMENT_QUERY",
  para("YB02", 5),
  "一（一）个人医保信息查询",
  { kind: "channel" },
);
add(
  "YN_YB_FAMILY_QUERY_ENTRY",
  "YB02",
  "YB_FAMILY_QUERY",
  para("YB02", 6),
  "一（二）门诊共济专栏",
  { kind: "channel" },
);
add(
  "YN_YB_ENROLLMENT_ENTRY",
  "YB02",
  "YB_RESIDENT_ENROLLMENT",
  para("YB02", 7),
  "一（三）参保/停保登记",
  { kind: "channel" },
);
add(
  "YN_YB_REMOTE_QUERY_ENTRY",
  "YB02",
  "YB_REMOTE_FILING",
  para("YB02", 8),
  "一（四）异地备案",
  { kind: "channel" },
);
add(
  "YN_YB_APP_OPEN_AND_MORE",
  "YB02",
  "YB_ENROLLMENT_QUERY",
  para("YB02", 16, 19),
  "三（一）—（四）使用方法",
  { kind: "action" },
);
add(
  "YN_YB_FAMILY_POLICY_POPULATION",
  "YB03",
  "YB_FAMILY_BINDING",
  portion("YB03", "第三条", "第四条"),
  "第一章 第三条",
  { kind: "condition" },
);
add(
  "YN_YB_FAMILY_POLICY_PURPOSE",
  "YB03",
  "YB_FAMILY_BINDING",
  portion("YB03", "第十条", "第四章"),
  "第三章 第十条及两项用途",
  { kind: "condition" },
);
add(
  "YN_YB_FAMILY_POLICY_EFFECTIVE",
  "YB03",
  "YB_FAMILY_BINDING",
  portion("YB03", "第二十三条", "关联链接："),
  "第六章 第二十三条",
  {
    question:
      "只确认2021暂行办法文号废止；未取得旧条款准确版本，不构造整批条款替代关系。",
  },
);
add(
  "YN_YB_FAMILY_CLOSE_RELATIVES",
  "YB04",
  "YB_FAMILY_BINDING",
  portion("YB04", "（三）关于“扩共济”", "（四）关于“优服务”"),
  "三（三）扩共济",
  { kind: "condition" },
);
add(
  "YN_YB_ENROLLMENT_GENERAL_POLICY",
  "YB05",
  "YB_RESIDENT_ENROLLMENT",
  portion("YB05", "（一）完善参保政策", "（二）落实居民医保筹资政策"),
  "一（一）完善参保政策",
  { kind: "condition" },
);
add(
  "YN_YB_RESIDENT_FINANCIAL_ASSISTANCE",
  "YB05",
  "YB_RESIDENT_PAYMENT",
  portion("YB05", "（二）落实居民医保筹资政策", "（三）落实职工医保缴费政策"),
  "一（二）筹资及分类资助",
  { kind: "condition" },
);
add(
  "YN_YB_WAITING_PERIOD_WITH_EXCEPTIONS",
  "YB05",
  "YB_RESIDENT_PAYMENT",
  portion("YB05", "（六）实施居民断保约束", "三、提升服务质效"),
  "二（六）断保约束整段，含全部例外",
  { kind: "condition" },
);
add(
  "YN_YB_ENROLLMENT_ONE_SERVICE",
  "YB05",
  "YB_RESIDENT_ENROLLMENT",
  portion("YB05", "（九）提升医保服务能力", "（十）改善群众就医体验"),
  "三（九）登记缴费联办",
  { kind: "action" },
);
add(
  "YN_YB_PAYMENT_2027_WINDOW",
  "YB07",
  "YB_RESIDENT_PAYMENT",
  portion("YB07", "居民医保参保集中征缴期为", "个人缴费标准为"),
  "原图上部 集中征缴期（视觉转写待核）",
  { window: ["2026-10-10", "2027-01-31"] },
);
add(
  "YN_YB_PAYMENT_2027_STANDARD",
  "YB07",
  "YB_RESIDENT_PAYMENT",
  portion("YB07", "个人缴费标准为"),
  "原图上部 缴费及财政补助（视觉转写待核）",
  {
    question:
      "400元/不低于724元只对应图示2027年度通常标准，不能覆盖医疗救助、资助等特殊身份或其他年度。",
  },
);
add(
  "YN_YB_PAYMENT_2027_LATE_AND_EXCEPTIONS",
  "YB08",
  "YB_RESIDENT_PAYMENT",
  portion("YB08", "非集中征缴期：①", "缴费方式"),
  "原图 缴费标准 非集中征缴期（视觉转写）",
  {
    question:
      "须和缴费特别提醒中的特殊群体例外及上位断保条款一起核对，不一律设置等待期。",
  },
);
add(
  "YN_YB_PAYMENT_CHANNELS_2027",
  "YB08",
  "YB_RESIDENT_PAYMENT",
  portion("YB08", "1.支付宝缴费渠道", "下面以"),
  "原图 缴费方式1—4（视觉转写待核）",
  { kind: "channel" },
);
add(
  "YN_YB_PAYMENT_CHECK_YEAR_AND_RECEIPT",
  "YB08",
  "YB_RESIDENT_PAYMENT",
  portion("YB08", "③填入并确认参保人信息", "缴费特别提醒"),
  "原图 缴费示例③—⑥（视觉转写待核）",
  { kind: "action" },
);
add(
  "YN_YB_REGISTER_BEFORE_PAYMENT",
  "YB08",
  "YB_RESIDENT_ENROLLMENT",
  portion("YB08", "1、首次参保", "2、新生儿"),
  "原图 缴费特别提醒1（视觉转写待核）",
  { kind: "condition" },
);
add(
  "YN_YB_PAYMENT_SPECIAL_POPULATIONS",
  "YB08",
  "YB_RESIDENT_PAYMENT",
  portion("YB08", "2、新生儿"),
  "原图 缴费特别提醒2完整例外（视觉转写待核）",
  { kind: "condition" },
);
add(
  "YN_YB_KINSHIP_NOT_FUND_SHARING",
  "YB09",
  "YB_KINSHIP_ACCOUNT",
  para("YB09", 1, 9),
  "亲情账户与共济区别，含两项完整定义",
  { kind: "condition" },
);
add(
  "YN_YB_KINSHIP_ALIPAY_FACE_HELP",
  "YB09",
  "YB_KINSHIP_ACCOUNT",
  para("YB09", 11),
  "温馨提示：支付宝及刷脸终端",
  { kind: "action" },
);
add(
  "YN_YB_PATIENT_OWN_CODE",
  "YB10",
  "YB_KINSHIP_ACCOUNT",
  portion("YB10", "温馨提醒："),
  "文末 温馨提醒完整段",
  { kind: "condition" },
);
add(
  "YN_YB_FAMILY_IS_MONEY_NOT_BENEFITS",
  "YB10",
  "YB_FAMILY_BINDING",
  portion("YB10", "家庭共济：钱袋子共享", "医保钱包：跨省共济新选择"),
  "家庭共济完整章节",
  { kind: "condition" },
);
add(
  "YN_YB_FAMILY_PAYMENT_ACCOUNT_CHECK",
  "YB11",
  "YB_RESIDENT_PAYMENT",
  portion("YB11", "一、确认缴费人员信息", "二、检查账户共济绑定信息"),
  "常见问题排查一",
  { kind: "action" },
);
add(
  "YN_YB_FAMILY_PAYMENT_VALIDITY_CHECK",
  "YB11",
  "YB_RESIDENT_PAYMENT",
  portion("YB11", "二、检查账户共济绑定信息", "三、检查参保状态是否发生变化"),
  "常见问题排查二",
  { kind: "condition" },
);
add(
  "YN_YB_FAMILY_PAYMENT_PROVINCE_SCOPE",
  "YB11",
  "YB_RESIDENT_PAYMENT",
  portion("YB11", "四、确认被绑定人是否符合条件", "五、如何寻求进一步帮助"),
  "常见问题排查四；仅此省内代缴渠道",
  {
    kind: "condition",
    question:
      "此文2025省内路径的跨省不可用表述不用于否认2026医保钱包；账户状态与跨省渠道需区分。",
  },
);
add(
  "YN_YB_REMOTE_FILING_START",
  "YB12",
  "YB_REMOTE_FILING",
  portion("YB12", "第一步：开始备案", "第二步：提交备案信息并签字确认"),
  "第一步",
  { kind: "action" },
);
add(
  "YN_YB_REMOTE_FILING_FORM",
  "YB12",
  "YB_REMOTE_FILING",
  portion("YB12", "第二步：提交备案信息并签字确认", "第三步：查询个人备案信息"),
  "第二步完整含小提示",
  { kind: "action" },
);
add(
  "YN_YB_REMOTE_FILING_RESULT",
  "YB12",
  "YB_REMOTE_FILING",
  portion("YB12", "第三步：查询个人备案信息"),
  "第三步 查询个人备案信息",
  {
    kind: "action",
    question:
      "只查结果不引导撤销；需要修改/撤销时由本人明确提出并核对当前有效性。",
  },
);
add(
  "YN_YB_REMOTE_HELP_CHANNELS",
  "YB13",
  "YB_REMOTE_FILING",
  portion("YB13", "三、怎么办理备案手续？", "五、备案是选“市”还是选“医院”？"),
  "三、四：渠道、老人帮办及手机操作",
  { kind: "channel" },
);
add(
  "YN_YB_REMOTE_VALIDITY_AND_CHANGE",
  "YB13",
  "YB_REMOTE_FILING",
  portion("YB13", "八、备案有效期多久？", "十、"),
  "八、九：有效期及变更",
  { kind: "condition" },
);
add(
  "YN_YB_WALLET_BIND_STEPS",
  "YB14",
  "YB_WALLET_CROSS_PROVINCE",
  portion("YB14", "一、共济关系绑定", "二、共济额度设置"),
  "国家医保服务平台APP 一、绑定",
  { kind: "action" },
);
add(
  "YN_YB_WALLET_QUERY_RECORDS",
  "YB14",
  "YB_WALLET_CROSS_PROVINCE",
  portion("YB14", "三、共济记录及消费记录查询", "四、共济关系解绑"),
  "三、共济及消费记录查询",
  { kind: "action" },
);
add(
  "YN_YB_WALLET_LIMIT_WARNING",
  "YB14",
  "YB_WALLET_CROSS_PROVINCE",
  portion("YB14", "注意：共济额度设置后不可撤销", "图2-6"),
  "二、共济额度设置 注意事项",
  { kind: "condition" },
);
add(
  "YN_YB_WALLET_TAX_PAYMENT_2027",
  "YB15",
  "YB_RESIDENT_PAYMENT",
  docMap.get("YB15").originalText.trim(),
  "步骤1—7完整操作，云南省电子税务局",
  {
    kind: "action",
    question:
      "本指南示例年度2027，不自动替用户选择年度；医保钱包/跨省支付不与省内个人账户支付按钮混用。",
  },
);
add(
  "CN_YB_WALLET_ELIGIBILITY",
  "YB16",
  "YB_WALLET_CROSS_PROVINCE",
  portion(
    "YB16",
    "二、哪些人之间可以进行个人账户跨省共济？",
    "三、医保钱包2.0",
  ),
  "第二问完整对象条件",
  { kind: "condition" },
);
add(
  "CN_YB_WALLET_AVAILABLE_SCOPE_SNAPSHOT",
  "YB16",
  "YB_WALLET_CROSS_PROVINCE",
  portion("YB16", "三、医保钱包2.0", "四、医保钱包1.0"),
  "第三问功能状态及时间限制完整段",
  {
    question:
      "截至2026-10-20快照；预期2026年底的异地使用功能尚不能写成已实现，需核对被共济人使用地。",
  },
);
add(
  "CN_YB_WALLET_OFFICIAL_CHANNELS",
  "YB16",
  "YB_WALLET_CROSS_PROVINCE",
  portion(
    "YB16",
    "五、个人账户跨省共济现在能通过哪些途径",
    "七、个人账户共济给省外参保的近亲属",
  ),
  "第五、六问完整渠道",
  { kind: "channel" },
);
add(
  "CN_YB_WALLET_ELDER_NO_PHONE",
  "YB16",
  "YB_WALLET_CROSS_PROVINCE",
  portion(
    "YB16",
    "九、老人和孩子没有手机如何使用医保钱包？",
    "十、不了解医保钱包",
  ),
  "第九问",
  { kind: "action" },
);
add(
  "BS_YB_FAMILY_BIND_HOME",
  "YB17",
  "YB_FAMILY_BINDING",
  portion("YB17", "绑定可以通过", "同时也可以点击"),
  "共济问题答复内 省内绑定子段",
  { kind: "action" },
);
add(
  "BS_YB_FAMILY_QUERY_RECORDS",
  "YB17",
  "YB_FAMILY_QUERY",
  portion("YB17", "同时也可以点击", "跨省就医可以使用"),
  "共济问题答复内 授权记录/被授权记录子段",
  {
    kind: "action",
    question:
      "用户当前截图为个人账户共济查询和解绑；官方访谈按钮名为授权记录查询，作为版本别名保存。结果页字段尚需实机验证。",
  },
);
add(
  "YN_YB_SERVICE_STANDARD_AND_ADAPTATION",
  "YB18",
  "YB_ELDERLY_HELP",
  para("YB18", 3, 7),
  "印发通知一—四及调整期限完整段",
  {
    question:
      "2027-01-01前完成适配不等于全部功能已经更新。只读附件未渲染，材料表复选框需人工核对。",
  },
);
add(
  "YN_YB_CATALOG_QUERY_DESCRIPTION",
  "YB18",
  "YB_ENROLLMENT_QUERY",
  word
    .filter((p) => p.index >= 1502 && p.index <= 1509)
    .map((p) => p.text)
    .join("\n\n"),
  "附件2 十一 参保人员参保信息查询，OOXML非空段1502—1509",
  {
    question:
      "只取事项描述/条件纯文本，不依据未渲染表格推定材料必填。新版实际承接情况待经办确认。",
  },
);
add(
  "YN_YB_CATALOG_RESIDENT_ENROLLMENT",
  "YB18",
  "YB_RESIDENT_ENROLLMENT",
  word
    .filter((p) => p.index >= 507 && p.index <= 514)
    .map((p) => p.text)
    .join("\n\n"),
  "附件2 四 城乡居民参保登记，OOXML非空段507—514",
  { kind: "condition" },
);
add(
  "YN_YB_ANNUAL_BILL_YEAR_SCOPE",
  "YB19",
  "YB_ENROLLMENT_QUERY",
  docMap.get("YB19").originalText.trim(),
  "2025年度账单介绍及入口完整段",
  {
    kind: "action",
    question:
      "历史年度账单不能证明当前参保正常或2027缴费已成功；入口文字可能随年度变化。",
  },
);
add(
  "YN_YB_CARE_MODE_AND_HUMAN_HELP",
  "YB20",
  "YB_ELDERLY_HELP",
  portion("YB20", "用心用情“优服务”", "▌来源："),
  "适老化、关怀模式、在线客服及视频办完整段",
  { kind: "channel" },
);
const regions = [
  { code: "CN", name: "中国", parentCode: null, dataset: "official" },
  { code: "530000", name: "云南省", parentCode: "CN", dataset: "official" },
  { code: "530500", name: "保山市", parentCode: "530000", dataset: "official" },
  { code: "530502", name: "隆阳区", parentCode: "530500", dataset: "official" },
  { code: "530400", name: "玉溪市", parentCode: "530000", dataset: "official" },
];
await save("batch.draft.json", {
  schemaVersion: 1,
  actor: "成员③资料整理（待人工核对）",
  reason: "云南医保老人常用业务与操作指南首批资料；不代办不发布",
  regions,
  documents,
  clauses,
});
await save(
  "document-metadata.json",
  metadata.map(({ paragraphs, ...m }) => m),
);
await save("review-items.json", review);
await save("matters.json", matters);
await save("source-registry.json", {
  schemaVersion: 1,
  sources: acq.records
    .filter((s) => s.id !== "YB21" && !["YB07", "YB08"].includes(s.id))
    .map((s) => ({
      id: s.id,
      documentId: s.documentId,
      url: s.url,
      format: "html",
      selector: s.selector,
      excludeSelectors: ["script", "style", ".qrcode"],
      baseline: {
        file: s.file,
        attachments: s.assets
          .filter((a) => a.kind === "attachment" && a.status === "retrieved")
          .map((a) => ({ url: a.url, file: a.file })),
      },
      declaredEffectiveFrom: s.id === "YB03" ? "2024-11-01" : null,
    })),
});
await save("image-review.json", {
  status: "pending",
  reviewedBy: null,
  originalPolicyApproved: false,
  items: ["YB07", "YB08"].map((id) => ({
    sourceId: id,
    file: "sources/assets/" + id + "-01.jpg",
    transcription: "sources/" + id + ".visual-transcription.txt",
    method: "assistant_visual_reading_of_all_crops",
    normalization: "保留选录板块文字；段落/空白规范化，不冒充完整原图OCR",
    uncertainties:
      id === "YB08"
        ? [
            "第②步第二个缴费按钮字样待核，不用于导航匹配",
            "特殊资助对象与等待期例外须同时核对",
          ]
        : ["财政补助是不低于724元，不能说个人缴费724元"],
  })),
  imageOnlyNotImported: ["YB21"],
  sourceMonitorLimitation:
    "现有监测只比较正文/PDF/Office；纯图片指南另按原图哈希人工核对，不注册为已监测全文。",
});
let md =
  "# 云南医保首批条款核对表\n\n全部待审核、未导入发布。原文位置基于保存的提取段落，Word页码未知，图片转写待逐字核对。\n\n";
for (const r of review)
  md += `## ${r.clauseId}\n\n事项：${matters[r.matterId]}；文件：${r.documentId}@1；位置：${r.locator}。\n\n${r.quote
    .split("\n")
    .map((l) => "> " + l)
    .join(
      "\n",
    )}\n\n日期含义：${r.dateMeaning}。\n\n待核对：${r.question}\n\n核对人：____；日期：____；决定：□通过 □修改 □不发布。\n\n`;
await save("REVIEW_CHECKLIST.md", md);
console.log(
  JSON.stringify({
    documents: documents.length,
    clauses: clauses.length,
    matters: Object.keys(matters).length,
    allDraft: true,
    imported: false,
    published: false,
  }),
);
