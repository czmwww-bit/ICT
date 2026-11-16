// 一次性资料编排工具；只写本目录文件，不连接数据库，不导入或发布。
import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const save = async (p, value) =>
  writeFile(
    new URL(p, root),
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
  );
try {
  await access(new URL("batch.draft.json", root));
  throw new Error("草稿已存在，拒绝覆盖人工修改；请直接编辑JSON及核对表。");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const web = await read("sources/longyang-2025.extracted.json");
const old = await read("sources/longyang-2021.extracted.json");
const p = [...web.paragraphs];
// 第六部分PDF为“社会保障卡匹配”，网页解读缩写成“社保卡匹配”；正式转写以PDF为准。
p[26] = p[26].replace('社保卡匹配', '社会保障卡匹配');
const issuers = [
  "云南省民政厅",
  "云南省公安厅",
  "云南省财政厅",
  "云南省人力资源和社会保障厅",
  "云南省卫生健康委员会",
  "国家金融监督管理总局云南监管局",
];
const docId = "YN_GLT_2024_113";
const currentUrl = "https://www.hhgj.gov.cn/info/13101/546351.htm";
const webUrl = "https://www.longyang.gov.cn/info/4580/14016319.htm";
const oldUrl = "https://longyang.gov.cn/info/4225/6273009.htm";
// PDF为扫描件。以下正文借助2025网页文字编排后逐页目视比对；仍须人工逐字核验。
// 保留正文用字，合并扫描换行、数字与汉字间排版空白；连字符/括号统一网页形式。
const pdfText =
  [
    ...issuers,
    "文件",
    "云民发〔2024〕113号",
    "关于开展高龄津贴“免申即享”工作的通知",
    "各州（市）民政局、公安局、财政局、人力资源社会保障局、卫生健康委，各金融监管分局：",
    ...p.slice(1, 34),
    "附件：资金兑付短信模版",
    ...issuers,
    "2024年11月19日",
    "（此件主动公开）",
    "附件",
    "资金兑付短信模版",
    "发放津贴短信模版：“您好！您的尾号XXXX的个人账户，于XX年XX月XX日收到XX县（市、区）民政局XX年XX月老年人高龄津贴XX元，发放周期为按月，这是党和政府的惠民惠农政策”。",
    "云南省民政厅办公室",
    "2024年11月20日印发",
  ].join("\n\n") + "\n";
await save("sources/yn-notice-2024-113.transcription.txt", pdfText);
const base = {
  version: 1,
  expectedVersion: 0,
  dataset: "official",
  reviewStatus: "draft",
  reviewedBy: null,
  reviewedAt: null,
  regionCodes: ["530000"],
};
const ev = (text, quote, locator) => ({ text, quote, locator });
const dateEvidence = ev(
  "2025-01-01",
  "本通知自2025年1月1日起施行。",
  "扫描PDF第6页，八、其他事项首句",
);
const docBase = {
  ...base,
  publishedAt: null,
  checkedAt: null,
  checkedBy: null,
  effectiveFrom: null,
  effectiveTo: null,
  effectiveFromEvidence: null,
  effectiveToEvidence: null,
};
const documents = [
  {
    ...docBase,
    id: docId,
    title: "关于开展高龄津贴“免申即享”工作的通知（云民发〔2024〕113号）",
    publisher: issuers.join("、"),
    sourceUrl: currentUrl,
    originalText: pdfText,
    originalPath:
      "data/official/longyang-allowance/sources/yn-notice-2024-113.pdf",
    effectiveFrom: "2025-01-01",
    effectiveFromEvidence: dateEvidence,
  },
  {
    ...docBase,
    id: "LY_GLT_INTERPRETATION_2025",
    title: p[0],
    publisher: web.fields["发文机构"],
    sourceUrl: webUrl,
    publishedAt: web.fields["日期"],
    originalText: await readFile(
      new URL("sources/longyang-2025.txt", root),
      "utf8",
    ),
    originalPath: "data/official/longyang-allowance/sources/longyang-2025.html",
  },
];
const rows = [];
function clause(suffix, name, quote, locator, fields, question) {
  const c = {
    ...base,
    id: `YN_GLT_${suffix}`,
    documentId: docId,
    documentVersion: 1,
    matterId: "HIGH_AGE_ALLOWANCE",
    matterName: "高龄津贴",
    quote,
    locator,
    population: null,
    conditions: null,
    effectiveFrom: "2025-01-01",
    effectiveTo: null,
    effectiveFromEvidence: dateEvidence,
    effectiveToEvidence: null,
    actions: null,
    materials: null,
    channels: null,
    contacts: null,
    schedule: null,
    location: null,
    relations: [],
    ...fields,
  };
  rows.push({ c, name, question });
  return c;
}
let loc = "扫描PDF第1—2页，一、发放对象";
clause(
  "ELIGIBILITY",
  "发放对象与年龄依据",
  p[3],
  loc,
  {
    population: ev(
      "具有云南省户籍且年满80周岁及以上（含年满80周岁当月）的老年人。",
      p[3],
      loc,
    ),
    conditions: ev(p[3], p[3], loc),
  },
  "核对年龄及户籍条件；身份证/户口簿是年龄认定依据，不推断为现行必须线下提交的申请材料。",
);
loc = "扫描PDF第2页，二、发放标准";
const rateQuote = p.slice(4, 9).join("\n\n");
clause(
  "PROVINCIAL_RATES",
  "省级标准（不是隆阳区地方实发金额）",
  rateQuote,
  loc,
  {
    conditions: ev(p[5], p[5], loc),
    actions: [
      ev(
        "省级标准：80-99周岁，每人每月50元；100周岁及以上，每人每月300元。地方不得低于省级标准、不得少于省级年龄补助层次。",
        rateQuote,
        loc,
      ),
    ],
  },
  "隆阳区现行各档地方金额未知；需地方文件后方可补充。核对PDF数字、连接号与网页转写。",
);
loc = "扫描PDF第2页，三、发放形式";
clause(
  "MONTHLY_PAYMENT",
  "按月发放、符合条件当月起算及社保卡入账",
  p[10],
  loc,
  {
    actions: [ev(p[10], p[10], loc)],
    schedule: ev(
      "按月发放；新增或适用标准调整从符合条件当月开始按月计算。",
      p[10],
      loc,
    ),
    channels: [
      ev(
        "通过云南省惠民惠农财政资金“一卡通”管理平台发至本人社会保障卡。",
        p[10],
        loc,
      ),
    ],
  },
  "具体到账日未给出；不得据此承诺某日到账或对历史欠款作无限期补发解释。",
);
loc = "扫描PDF第2—3页，四、发放程序（一）免于申报第一段";
clause(
  "AUTO_PROCESS",
  "免申请、信息推送与分级核实审核",
  p.slice(12, 15).join("\n\n"),
  loc,
  {
    actions: [ev(p[14], p[14], loc)],
    schedule: ev(
      "当年每季度首月推送下一季度年满80周岁老年人基础信息。",
      p[14],
      loc,
    ),
  },
  "免去申请不等于免资格核实；佐证材料由经办人员提交，不转写成老人统一必交材料清单。",
);
loc = "扫描PDF第3页，四（一）第二段";
clause(
  "MISSING_LIST",
  "未在核查范围的人员信息补录",
  p[15],
  loc,
  {
    conditions: ev(
      "不在核查范围，但户籍地在辖区范围内且下一季度即将年满80周岁。",
      p[15],
      loc,
    ),
    actions: [ev(p[15], p[15], loc)],
  },
  "原文规定村（社区）与乡镇工作人员核查补录；未明确个人补录申请表、受理地址或联系电话。",
);
loc = "扫描PDF第3页，四（二）动态核查";
clause(
  "DYNAMIC_CHECK",
  "至少每3个月动态核查",
  p[17],
  loc,
  {
    population: ev("已享受高龄津贴的老年人。", p[17], loc),
    actions: [ev(p[17], p[17], loc)],
    schedule: ev("至少每3个月进行一次核查。", p[17], loc),
  },
  "核查方式可包括电话、视频、上门、邻里访问，不据此要求所有老人每季度亲自到场。",
);
loc = "扫描PDF第3—4页，四（三）1.暂时无法取得联系";
clause(
  "UNREACHABLE",
  "失联暂停、恢复补发与跨年限制",
  p[19],
  loc,
  {
    conditions: ev("核查期间无法取得联系。", p[19], loc),
    actions: [ev(p[19], p[19], loc)],
    schedule: ev(
      "跨年时自完成信息核查认证当年1月起补发；暂停期间至少每3个月核查。",
      p[19],
      loc,
    ),
  },
  "完整保留补发的跨年限制；不是永久失去资格，也不是对全部往年补发作承诺。",
);
loc = "扫描PDF第4页，四（三）2.户籍确认";
clause(
  "HOUSEHOLD_SEPARATION",
  "人户分离时由户籍地核实发放",
  p[20],
  loc,
  {
    population: ev("人户分离的老年人。", p[20], loc),
    actions: [
      ev(
        "户籍地乡镇或村（社区）通过电话或其他方式核实，户籍地根据确认信息发放。",
        p[20],
        loc,
      ),
    ],
  },
  "居住地不直接等于待遇办理地；不能仅凭人在隆阳居住判定由隆阳发放。",
);
clause(
  "HOUSEHOLD_MOVE",
  "跨县户籍迁移、次月停发及起发",
  p[20],
  loc,
  {
    conditions: ev("迁移户籍；涉及迁出、迁入县级行政区域。", p[20], loc),
    actions: [
      ev("迁入地与迁出地县级民政部门对接比对，避免漏发或重发。", p[20], loc),
    ],
    schedule: ev(
      "户籍迁出次月起停止；迁入新的县级行政区域次月起开始。",
      p[20],
      loc,
    ),
  },
  "核对次月规则及迁出迁入日期，保留跨地对接以免漏发重发，不推断同县迁移也停发。",
);
loc = "扫描PDF第4页，四（三）3.去世";
clause(
  "DEATH",
  "死亡信息核查与停发手续",
  p[21],
  loc,
  {
    conditions: ev("发现老年人去世。", p[21], loc),
    actions: [ev(p[21], p[21], loc)],
    schedule: ev("死亡之日起3个月内办理完成停发手续。", p[21], loc),
  },
  "3个月是办理停发手续期限；不能解释为去世后仍有3个月新增待遇。死亡后应发未发款另见特殊事项。",
);
loc = "扫描PDF第4—5页，五（一）严格控制特殊备案和特殊补贴对象发放";
clause(
  "SPECIAL_ACCOUNT",
  "无法办理或激活社保卡的特殊账户处理",
  p[23],
  loc,
  {
    conditions: ev(
      "确因无法办理身份证、死亡后仍有补助应发、不能配合的失智或重度精神病患者等情形，无法办理社保卡并激活金融账户。",
      p[23],
      loc,
    ),
    actions: [ev(p[23], p[23], loc)],
  },
  "云财农〔2022〕249号未取得，特殊补贴所需材料及账户细则待补；不能泛化成任意亲属可直接代领。",
);
clause(
  "PROXY_PAYMENT",
  "代领备案、本人才益与自愿原则",
  p[23],
  loc,
  {
    actions: [
      ev(
        "代领纳入特殊账户维护模块、人员信息标注并备案，须本人自愿且资金始终由享受补贴人员享受，并按249号规定执行。",
        p[23],
        loc,
      ),
    ],
  },
  "代领授权、证明、办理渠道需249号及当地依据；本条不是无条件代领许可。",
);
loc = "扫描PDF第5页，五（二）积极协调社会保障卡办理及使用";
clause(
  "CARD_ACTIVATION",
  "申办社保卡及开通金融功能",
  p[24],
  loc,
  {
    population: ev("未办理社保卡或未开通金融功能的老年人。", p[24], loc),
    actions: [
      ev(
        "引导、督促、帮助老年人到人力资源社会保障部门、银行申办并激活社会保障卡。",
        p[24],
        loc,
      ),
    ],
    channels: [ev("人力资源社会保障部门、银行。", p[24], loc)],
  },
  "未指定银行网点、地址、电话、办理时间与开户材料；不能拿网站通用联系电话冒充本事项电话。",
);
clause(
  "HOME_CARD",
  "行动不便老人社保卡上门办理协调",
  p[24],
  loc,
  {
    population: ev("行动不便的高龄老年人。", p[24], loc),
    actions: [
      ev("当地民政部门协调人力资源社会保障部门、银行上门办理。", p[24], loc),
    ],
  },
  "需要补充隆阳可预约的经办点、电话和安排；未给出上门服务承诺时限。",
);
loc = "扫描PDF第5页，六、职责分工";
clause(
  "DUTIES",
  "经办职责与信息交叉比对",
  p[26],
  loc,
  {
    actions: [ev(p[26], p[26], loc)],
  },
  "县级民政资格审定，乡镇组织实施，村（社区）宣传提醒；参加养老保险基础信息用于比对，不新增参保资格门槛。",
);
loc = "扫描PDF第6—7页，八、其他事项";
clause(
  "EFFECT_AND_REPEAL",
  "施行日期与明确废止的两个文件",
  p[33],
  loc,
  {
    actions: [
      ev(
        "自2025-01-01施行；原文明确废止云民办〔2009〕12号、云民发〔2022〕71号。",
        p[33],
        loc,
      ),
    ],
  },
  "尚无两个旧文件的原文/条款版本，relations保持空；不虚构目标编号，不标记2021网页整篇失效。",
);
const batch = {
  schemaVersion: 1,
  actor: "成员③资料整理（AI辅助，待人工核对）",
  reason:
    "首批隆阳区高龄津贴官方来源草稿；省级标准、历史参考及地方缺口分别标记；本轮只做预检查，不导入不发布。",
  regions: [
    { code: "530000", name: "云南省", parentCode: null, dataset: "official" },
    {
      code: "530500",
      name: "保山市",
      parentCode: "530000",
      dataset: "official",
    },
    {
      code: "530502",
      name: "隆阳区",
      parentCode: "530500",
      dataset: "official",
    },
  ],
  documents,
  clauses: rows.map((r) => r.c),
};
await save("batch.draft.json", batch);
const historic = {
  archiveOnly: true,
  importableBatch: false,
  currentQueryEligible: false,
  reviewStatus: "pending_human_review",
  reason:
    "历史网页未提供独立施行/失效日期，现有模型没有历史参考专用过滤标志。单独归档，不混入当前候选，也不伪造失效日期。",
  title: old.paragraphs[0],
  sourceUrl: oldUrl,
  sourceFile: "sources/longyang-2021.html",
  webPublisher: old.fields["发文机构"],
  webPublishedAt: old.fields["日期"],
  originalIssuers: null,
  originalDocumentNumber: null,
  effectiveFrom: null,
  effectiveTo: null,
  acquiredDate: "2026-11-16",
  ageThreshold: null,
  localAmounts: null,
  replacementBy2024Notice: null,
  references: old.paragraphs.slice(1).map((quote, i) => ({
    referenceId: [
      "LY_HIST_2021_APPLY",
      "LY_HIST_2021_ONLINE",
      "LY_HIST_2021_OFFLINE",
    ][i],
    quote,
    locator: `2021网页正文第${i + 2}段（含标题为第1段）`,
    questions: [
      "当地户口的具体地域范围、年龄门槛及原政策文号未明，不借用2024通知补全。",
      "线上申请渠道是2021历史描述，不作为2025起现行申请要求。",
      "身份证、户口本仅保留为2021线下申请原文，不移入现行免申即享材料清单。",
    ][i],
    reviewedBy: null,
    reviewedAt: null,
    decision: null,
  })),
};
await save("historical-reference.json", historic);
const direct = await read("retrieval.direct.json");
const attachment = await read("retrieval.attachment.json");
const evidenceFiles = [
  "sources/longyang-2021.html",
  "sources/longyang-2021.txt",
  "sources/longyang-2025.html",
  "sources/longyang-2025.txt",
  "sources/gejiu-attachment-page.html",
  "sources/yn-notice-2024-113.pdf",
  "sources/yn-notice-2024-113.transcription.txt",
];
const checksums = [];
for (const path of evidenceFiles) {
  const bytes = await readFile(new URL(path, root));
  checksums.push({
    path,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const manifest = {
  collectedDate: "2026-11-16",
  timezone: "Asia/Shanghai",
  status: "draft_not_imported_not_published",
  humanReviewedBy: null,
  humanReviewedAt: null,
  scope: "省级通用条款供隆阳区试点核对；隆阳地方待遇标准及经办细节未补齐。",
  specifiedSources: direct.sources
    .slice(0, 3)
    .map((s) => ({ ...s, file: `sources/${s.id}.html` })),
  attachment,
  checksums,
  sourceMetadata: [
    {
      id: "longyang-2021",
      webPublisher: old.fields["发文机构"],
      webPublishedAt: old.fields["日期"],
      originalIssuers: null,
      originalDocumentNumber: null,
      effectiveFrom: null,
      effectiveTo: null,
      treatment: "仅历史归档，不在batch.draft.json中",
    },
    {
      id: "longyang-2025",
      documentId: "LY_GLT_INTERPRETATION_2025",
      webPublisher: web.fields["发文机构"],
      webPublishedAt: web.fields["日期"],
      creditedSource: "云南省民政厅养老服务处",
      originalIssuers: issuers,
      underlyingDocumentNumber: "云民发〔2024〕113号",
      underlyingEffectiveFrom: "2025-01-01",
      interpretationOwnEffectiveFrom: null,
      treatment: "辅助核对文献，不复制生成重复条款",
    },
    {
      id: "gejiu-attachment-page",
      webPublisher: "个旧市民政局",
      webPublishedAt: "2024-12-04",
      webIndex: "gjsmmz/2024-00010",
      pageValidityLabel: "有效（网页标注，不代替人工审核）",
      treatment: "省级文件的官方转载/附件入口，不代表个旧地方金额",
    },
    {
      id: docId,
      originalIssuers: issuers,
      originalDocumentNumber: "云民发〔2024〕113号",
      signedAt: "2024-11-19",
      signedAtLocator: "PDF第7页落款",
      printedAt: "2024-11-20",
      printedAtLocator: "PDF第8页印发栏",
      originalPublicReleaseAt: null,
      publishedAtMapping:
        "导入文件publishedAt=null：原文件公开发布日期未知；不以落款/印发/个旧网页发布日期代替。",
      effectiveFrom: "2025-01-01",
      effectiveFromLocator: "PDF第6页八、其他事项",
      effectiveTo: null,
    },
  ],
  transcription: {
    status: "pending_human_review",
    method:
      "PDF无文本层，8页全部渲染目视比对；借助2025解读正文编排，不是自动OCR实测或人工签字核验。",
    normalization: [
      "合并扫描换行和排版空格",
      "数字、括号及年龄范围连接号沿用网页字符形式",
      "跨页段落合并，签章位置按正文阅读顺序列出署名；未复制印章图案为文字",
    ],
    authoritativeArtifact: "sources/yn-notice-2024-113.pdf",
    pageImages: "sources/pdf-pages/page-01.png 至 page-08.png",
    originalTextFile: "sources/yn-notice-2024-113.transcription.txt",
    warning:
      "精确原文以扫描件为准；请逐条核对转写、标点、数字。纸面排版未声称逐字节复刻。",
  },
  regionTree: {
    codes: ["530000", "530500", "530502"],
    reviewStatus: "待人工核对编码及上下级",
    provinceClauseScope:
      "530000，显式祖先关系用于隆阳530502查询；不以转载网页的个旧市地域替代原文云南省范围。",
    failedSupplement: direct.sources.find((s) => s.id === "yunnan-region-codes")
      ?.url,
  },
  amounts: {
    scope: "省级发放标准",
    basisClauseId: "YN_GLT_PROVINCIAL_RATES",
    provincialBands: [
      { ages: "80-99周岁", yuanPerPersonPerMonth: 50 },
      { ages: "100周岁及以上", yuanPerPersonPerMonth: 300 },
    ],
    longyangLocalBands: null,
    localBasis: null,
  },
  externalRevisions: [
    {
      sourceClauseId: "YN_GLT_EFFECT_AND_REPEAL",
      type: "explicit_document_repeal",
      targetDocumentNumbers: ["云民办〔2009〕12号", "云民发〔2022〕71号"],
      quote: p[33],
      targetOriginalsAcquired: false,
      mappedTargetClauseIds: [],
      historical2021ArticleWhollyRepealed: null,
    },
  ],
  missingNotDownloaded: [
    "隆阳区现行地方发放标准及其施行/调整文件",
    "云财农〔2022〕249号原文及特殊对象所需材料",
    "云民办〔2009〕12号、云民发〔2022〕71号原文（若需逐条建立历史关系）",
    "隆阳区具体经办点、咨询电话、社保卡/上门办理渠道的官方依据",
    "2026核对时是否存在113号后续调整的当地或省级正式文件",
  ],
  optionalFetchFailures: direct.sources.filter((s) => s.status === "failed"),
  unknownFields: [
    "隆阳地方各档实发金额",
    "具体到账日",
    "具体受理地址与工作时段",
    "经办联系电话",
    "特殊账户材料细则",
    "2021原政策编号及适用年龄门槛",
    "现行通知失效日期及获取日之后变动",
  ],
};
await save("provenance.json", manifest);
const header = `# 隆阳区高龄津贴：首批人工核对表\n\n整理日期：2026-11-16。**待审核；未导入、未发布；技术预检查不等于政策正确性审核。**\n\n先看本表，再对照 [省级通知原始扫描件](sources/yn-notice-2024-113.pdf)；逐条原文以扫描件为准。网页文字及PDF排版合并转写均已归档。人工核对人、日期和结论留空，不以AI整理或获取日期代替。\n\n## 来源与日期（先核对）\n\n| 来源 | 网页发文机构 | 网页发布日期 | 原文件机关与其他日期 | 用途 |\n|---|---|---|---|---|\n| [2021说明](${oldUrl}) | 隆阳区西邑乡人民政府 | 2021-05-05 | 原文件机关/文号/施行日期未明 | 仅历史参考，独立归档，不进入现行导入批次 |\n| [2025解读](${webUrl}) | 隆阳区辛街乡人民政府 | 2025-08-18 | 文章来源为省民政厅养老服务处，不等于该乡镇制发省级通知 | 辅助核对文件，无重复条款 |\n| [省级通知附件页](${currentUrl}) | 个旧市民政局 | 2024-12-04 | 原文件由六部门联合制发（见下） | 附件为省级原文件，不是个旧地方标准 |\n\n原文件：**云民发〔2024〕113号**。六部门：${issuers.join("、")}。PDF第7页落款 **2024-11-19**；第8页印发 **2024-11-20**；第6页施行 **2025-01-01**。原文件公开发布日期未能确定，正式文件记录publishedAt=null；网页各自发布日期单独保存。\n\n### 发布前必须确认\n\n- [ ] 对照PDF核准六部门、文号、落款/印发/施行日期及全部条款转写。扫描排版空格、换行及连接号有规范化处理。\n- [ ] 核准云南省530000 → 保山市530500 → 隆阳区530502的编码与上下级。通知适用云南户籍范围，不因个旧转载而限定为个旧。\n- [ ] **金额仅是文件所述省级标准**，隆阳区地方实际各档标准及依据仍为空；不能生成当地实发金额结论。\n- [ ] 核查截至2026-11-16有无后续正式调整；本轮只整理用户指定三项，尚未穷尽后续变更。\n- [ ] 确认2021申请文章仅历史参考；不把它整体标为被替代/失效，不把旧申请材料移入现行流程。\n- [ ] 两个明确废止文件原文未取得，暂不构造旧条款id和relations。云财农〔2022〕249号细则未取得。\n- [ ] 与成员②确认事项编码HIGH_AGE_ALLOWANCE；金额/联系信息不足由②按场景提示核实，不把候选条款等同于资格审批。\n\n## 现行候选条款：16条（全部draft）\n\n来源文件编号统一为YN_GLT_2024_113@1；来源官网为[个旧官方附件页](${currentUrl})，每条另有准确PDF页码。起始日期2025-01-01均引用第6页“八、其他事项”；终止日期未知。人口、条件、动作有证据才填，材料/具体地点/电话未知保持null。\n\n`;
let checklist = header;
for (const { c, name, question } of rows) {
  const fields = Object.fromEntries(
    ["population", "conditions", "actions", "schedule", "channels"]
      .filter((k) => c[k] !== null)
      .map((k) => [
        k,
        Array.isArray(c[k]) ? c[k].map((e) => e.text).join("；") : c[k].text,
      ]),
  );
  checklist += `### ${c.id}｜${name}\n\n- 定位：${c.locator}。\n- 整理结果：${Object.entries(
    fields,
  )
    .map(([k, v]) => `${k}：${v}`)
    .join(
      "；",
    )}\n- 待确认：${question}\n- 人工核对人：____；日期：____；结论：□通过 □修改后再审 □不发布；备注：____\n\n对应原文（未截断）：\n\n${c.quote
    .split("\n")
    .map((l) => "> " + l)
    .join("\n")}\n\n`;
}
checklist +=
  "## 2021历史参考（3项，不是待发布条款）\n\n以下编号是归档段落编号，不能传给getClause，未写入batch.draft.json。原网页与提取文本保留，既不伪造失效日期，也不进入当前免申即享候选。\n\n";
for (const r of historic.references)
  checklist += `### ${r.referenceId}\n\n定位：${r.locator}。[来源](${oldUrl})\n\n> ${r.quote}\n\n待确认：${r.questions}\n\n核对人：____；日期：____；备注：____\n\n`;
checklist += `## 尚缺资料与下载情况\n\n指定的3个网页及8页PDF已全部下载，见provenance.json、retrieval.*.json中的获取时间和SHA-256。两项额外省民政厅页面请求失败（HTTP404；不是用户指定入口），链接与失败记录保存在provenance.json.optionalFetchFailures，未采用其搜索摘要冒充原文。\n\n尚未提供/获取的补充资料（并非本次附件下载失败）：\n\n${manifest.missingNotDownloaded.map((x) => "- " + x).join("\n")}\n\n## 核对后操作\n\n见本目录README.md的分步命令。先修改草稿及checkedAt/checkedBy，保留draft和空审核字段，重新validate与dry-run；再由你明确执行导入及独立发布。历史参考不发布。本轮不执行任何导入/发布。\n`;
await save("REVIEW_CHECKLIST.md", checklist);
const csvEscape = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
const csvRows = [
  [
    "条款编号",
    "类别",
    "整理结果",
    "原文",
    "定位",
    "来源链接",
    "待确认问题",
    "核对人",
    "核对日期",
    "结论",
    "备注",
  ],
  ...rows.map(({ c, name, question }) => [
    c.id,
    name,
    JSON.stringify(
      Object.fromEntries(
        ["population", "conditions", "actions", "schedule", "channels"]
          .filter((k) => c[k] !== null)
          .map((k) => [k, c[k]]),
      ),
    ),
    c.quote,
    c.locator,
    currentUrl,
    question,
    "",
    "",
    "",
    "",
  ]),
  ...historic.references.map((r) => [
    r.referenceId,
    "仅历史归档（不导入）",
    "不作为现行申请依据",
    r.quote,
    r.locator,
    oldUrl,
    r.questions,
    "",
    "",
    "",
    "",
  ]),
];
// BOM供Windows Excel直接识别中文；CSV只用于人工核对，不是导入源。
await save(
  "REVIEW_CHECKLIST.csv",
  "\ufeff" +
    csvRows.map((row) => row.map(csvEscape).join(",")).join("\r\n") +
    "\r\n",
);
console.log(
  JSON.stringify({
    documents: documents.length,
    clauses: rows.length,
    historicalReferences: historic.references.length,
    status: "draft_only",
  }),
);
