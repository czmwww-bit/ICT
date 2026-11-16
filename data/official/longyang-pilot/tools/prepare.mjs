// 编排人工可维护的JSON；不连接数据库、不运行审核发布。已有批次拒绝覆盖。
import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const json = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const save = async (p, v) =>
  writeFile(
    new URL(p, root),
    typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n",
  );
try {
  await access(new URL("batch.draft.json", root));
  throw new Error("草稿已存在，拒绝覆盖人工修改。");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const acquisition = await json("acquisition.json");
const previous = await json("../longyang-allowance/batch.draft.json");
const oldProvenance = await json("../longyang-allowance/provenance.json");
const H = "HIGH_AGE_ALLOWANCE",
  E = "ECONOMIC_ELDERLY_SERVICE",
  C = "DISABILITY_CARE_CONSUMPTION";
const names = {
  [H]: "高龄津贴",
  [E]: "经济困难老年人服务补贴",
  [C]: "中度以上失能老年人养老服务消费补贴",
};
const base = {
  version: 1,
  expectedVersion: 0,
  dataset: "official",
  reviewStatus: "draft",
  reviewedBy: null,
  reviewedAt: null,
};
const docs = [...previous.documents],
  clauses = [...previous.clauses];
const metadata = [],
  review = [];
const bodies = new Map();
const source = (id) =>
  [
    ...acquisition.sources,
    ...acquisition.attachments,
    ...(acquisition.supplements ?? []),
  ].find((s) => s.id === id);
const evidence = (text, quote, locator) => ({ text, quote, locator });
async function doc(
  item,
  id,
  carrier,
  matter,
  regions,
  publisher,
  identity,
  status = "candidate",
  signedAt = null,
) {
  const extracted = await json(`sources/${carrier}.extracted.json`),
    s = source(carrier);
  const paragraphs = extracted.paragraphs;
  const originalText = await readFile(
    new URL(`sources/${carrier}.txt`, root),
    "utf8",
  );
  const originalPath = s.file.startsWith("../")
    ? "data/official/" + s.file.slice(3)
    : "data/official/longyang-pilot/" + s.file;
  const d = {
    ...base,
    id,
    title: extracted.title || paragraphs[0] || identity,
    publisher,
    sourceUrl: s.url,
    publishedAt: null,
    originalText,
    originalPath,
    checkedAt: null,
    checkedBy: null,
    effectiveFrom: null,
    effectiveTo: null,
    effectiveFromEvidence: null,
    effectiveToEvidence: null,
    regionCodes: regions,
  };
  if (!identity)
    d.publishedAt = (extracted.fields.PubDate ?? "").slice(0, 10) || null;
  docs.push(d);
  bodies.set(id, paragraphs);
  metadata.push({
    item,
    documentId: id,
    matterIds: [matter],
    identity: identity ?? null,
    classification: status,
    sourceCarrierIds: [carrier],
    webPublisher:
      extracted.fields["发文机构"] ?? extracted.fields.ContentSource ?? null,
    webPublishedAt: (extracted.fields.PubDate ?? "").slice(0, 10) || null,
    originalIssuers: identity ? publisher : null,
    signedAt,
    originalPublishedAt: d.publishedAt,
    effectiveFrom: null,
    effectiveTo: null,
    humanReviewedBy: null,
    humanReviewedAt: null,
    publicationGate:
      status === "historical_reference"
        ? "只导入草稿供维护/旧通知核验，不发布为当前条款"
        : "需人工逐条核准后单独发布",
  });
  return d;
}
const findDoc = (id) => docs.find((d) => d.id === id);
function part(id, start, end = start) {
  const p = bodies.get(id),
    resolve = (v) =>
      typeof v === "number" ? v : p.findIndex((t) => t.startsWith(v));
  const a = resolve(start),
    b = resolve(end);
  if (a < 0 || b < a) throw new Error(`${id}: 找不到段落 ${start} / ${end}`);
  return {
    quote: p.slice(a, b + 1).join("\n\n"),
    locator: `网页正文第${a + 1}${a === b ? "" : "—" + (b + 1)}段（按sources提取文本计）`,
    a,
    b,
  };
}
function add(
  id,
  suffix,
  topic,
  matter,
  start,
  end = start,
  field = "actions",
  question = "",
  summary = null,
) {
  const q = part(id, start, end),
    d = findDoc(id),
    clauseId = `${id}_${suffix}`;
  const c = {
    ...base,
    id: clauseId,
    documentId: id,
    documentVersion: 1,
    matterId: matter,
    matterName: names[matter],
    regionCodes: [...d.regionCodes],
    quote: q.quote,
    locator: q.locator + "；" + topic,
    population: null,
    conditions: null,
    actions: null,
    materials: null,
    channels: null,
    contacts: null,
    schedule: null,
    location: null,
    effectiveFrom: d.effectiveFrom,
    effectiveTo: d.effectiveTo,
    effectiveFromEvidence: d.effectiveFromEvidence,
    effectiveToEvidence: d.effectiveToEvidence,
    relations: [],
  };
  if (field) {
    const e = evidence(summary ?? q.quote, q.quote, c.locator);
    c[field] = ["actions", "materials", "channels", "contacts"].includes(field)
      ? [e]
      : e;
  }
  clauses.push(c);
  review.push({
    documentId: id,
    clauseId,
    topic,
    matterId: matter,
    classification:
      metadata.find((m) => m.documentId === id)?.classification ?? "candidate",
    structured: field ? { [field]: c[field] } : {},
    quote: q.quote,
    locator: c.locator,
    sourceUrl: d.sourceUrl,
    status: "pending_human_review",
    question:
      question ||
      "核对原文字句、范围与是否存在后续调整；不得仅因网页较新自动决定适用。",
    reviewedBy: null,
    reviewedAt: null,
    decision: null,
  });
  return c;
}
// 已完成批次复用准确编号与快照，不重复建立113号和2025解读文件。
metadata.push({
  item: 3,
  documentId: "YN_GLT_2024_113",
  matterIds: [H],
  identity: "云民发〔2024〕113号",
  classification: "candidate",
  sourceCarrierIds: ["A3", "A3-attachment-1"],
  ...oldProvenance.sourceMetadata.find((m) => m.id === "YN_GLT_2024_113"),
  webPublisher: "个旧市民政局",
  webPublishedAt: "2024-12-04",
  publicationGate: "原PDF转写及日期待人工审核",
});
metadata.push({
  item: 4,
  documentId: "LY_GLT_INTERPRETATION_2025",
  matterIds: [H],
  classification: "supporting_interpretation",
  sourceCarrierIds: ["A4"],
  webPublisher: "隆阳区辛街乡人民政府",
  webPublishedAt: "2025-08-18",
  originalIssuers: null,
  publicationGate: "辅助来源，不重复创建条款",
});
for (const c of clauses)
  review.push({
    documentId: c.documentId,
    clauseId: c.id,
    topic: c.locator,
    matterId: c.matterId,
    classification: "candidate",
    structured: Object.fromEntries(
      [
        "population",
        "conditions",
        "actions",
        "materials",
        "channels",
        "schedule",
        "contacts",
        "location",
      ]
        .filter((k) => c[k] !== null)
        .map((k) => [k, c[k]]),
    ),
    quote: c.quote,
    locator: c.locator,
    sourceUrl: findDoc(c.documentId).sourceUrl,
    status: "pending_human_review",
    question:
      c.id === "YN_GLT_PROVINCIAL_RATES"
        ? "只记省级标准，不能覆盖2023/2025网页所述地方350元标准；地方当前金额待区级原文件核准。"
        : "对照8页PDF逐字核对；保留2021历史身份、2025地方流程冲突及2026后续通知，勿整篇推定废止。",
    reviewedBy: null,
    reviewedAt: null,
    decision: null,
  });

await doc(
  1,
  "LY_GLT_HISTORY_2021",
  "A1",
  H,
  ["LY_XIYI"],
  "隆阳区西邑乡人民政府",
  null,
  "historical_reference",
);
add(
  "LY_GLT_HISTORY_2021",
  "APPLY",
  "2021自愿申请与四级流程",
  H,
  1,
  1,
  "actions",
  "原政策文号、年龄门槛、“当地”范围未知，仅历史测试，不作为现行主动申请依据。",
);
add(
  "LY_GLT_HISTORY_2021",
  "ONLINE",
  "2021线上渠道",
  H,
  2,
  2,
  "channels",
  "历史手机办事通渠道，不推断2026仍需自行申报。",
);
add(
  "LY_GLT_HISTORY_2021",
  "OFFLINE",
  "2021线下材料",
  H,
  3,
  3,
  "materials",
  "仅历史材料，不能迁移成免申即享必交清单。",
);
await doc(
  2,
  "LY_GLT_LUJIANG_2023",
  "A2",
  H,
  ["LY_LUJIANG"],
  "隆阳区潞江镇人民政府",
  null,
  "historical_reference",
);
add(
  "LY_GLT_LUJIANG_2023",
  "OBJECT",
  "历史发放对象",
  H,
  3,
  3,
  "population",
  "“本地”按潞江镇保守归档，真实地域边界及区级原文件待核。",
);
add(
  "LY_GLT_LUJIANG_2023",
  "LOCAL_RATES",
  "历史地方标准",
  H,
  5,
  6,
  "actions",
  "历史网页80-99岁50元、100岁及以上350元；不同于省级300元，不宣称隆阳当前金额已确认。",
);
add(
  "LY_GLT_LUJIANG_2023",
  "MATERIALS",
  "历史线下材料及办理方式",
  H,
  8,
  8,
  "materials",
  "包括省内正常社保卡及审批表；现行免申即享不得直接沿用。",
);
add(
  "LY_GLT_LUJIANG_2023",
  "PROCESS",
  "历史线上咨询及发放流程",
  H,
  9,
  10,
  "actions",
);
add(
  "LY_GLT_LUJIANG_2023",
  "LOCATION",
  "历史办理地点",
  H,
  12,
  12,
  "location",
  "没有详细地址、接待时段或电话。",
);
add(
  "LY_GLT_LUJIANG_2023",
  "PROXY",
  "行动不便亲属代办",
  H,
  13,
  13,
  "actions",
  "历史代办，不用于推断现在任意人可代领资金。",
);
await doc(
  5,
  "LY_GLT_WADU_2025",
  "A5",
  H,
  ["530502"],
  "隆阳区瓦渡乡人民政府",
  null,
  "conflicting_local_notice",
);
add(
  "LY_GLT_WADU_2025",
  "OBJECT",
  "地方告知书发放对象",
  H,
  0,
  0,
  "population",
  "“年满80周岁以上不满100”及“100周岁以上”文字边界需与省级满80/100口径共同核对，不擅自改原文。",
);
add(
  "LY_GLT_WADU_2025",
  "LOCAL_RATES",
  "地方网页所述金额与财政分担",
  H,
  1,
  1,
  "actions",
  "80-99岁50元、100及以上350元是该2025网页陈述，区级原文件及当前执行待核；省级最低标准另存。",
);
add(
  "LY_GLT_WADU_2025",
  "BASIS",
  "地方告知引用的政策依据",
  H,
  2,
  2,
  "conditions",
  "引用包括已被113号明确废止的云民办〔2009〕12号；其余地方文件未取得，不能据此认定全篇自动失效。",
);
add(
  "LY_GLT_WADU_2025",
  "APPLICATION",
  "主动申请及材料",
  H,
  4,
  4,
  "materials",
  "与113号免申即享冲突；须由隆阳民政确认特殊补录/过渡还是未更新告知，不能自行择一。",
);
add(
  "LY_GLT_WADU_2025",
  "REVIEW",
  "审核及资金拨付",
  H,
  5,
  6,
  "actions",
  "网页仅写流程，不能推算办结工作日。",
);
add(
  "LY_GLT_WADU_2025",
  "DEPARTMENT",
  "牵头单位及流程",
  H,
  7,
  8,
  "channels",
  "仅牵头区民政局，不补填网站通用电话。",
);

const econ = await doc(
  6,
  "YN_ECON_SERVICE_2023_2",
  "B6-web",
  E,
  ["530000"],
  "云南省民政厅、云南省财政厅",
  "云民规〔2023〕2号（原PDF未取得，文号需原件核准）",
  "validity_requires_review",
  "2023-03-16",
);
const eDate = part(econ.id, "第二十六条");
econ.effectiveFrom = "2023-04-01";
econ.effectiveFromEvidence = evidence(
  "2023-04-01",
  eDate.quote,
  eDate.locator + "；第二十六条",
);
metadata.find((m) => m.documentId === econ.id).sourceCarrierIds = [
  "B6-pdf",
  "B6-web",
];
add(
  econ.id,
  "OBJECT",
  "试行发放对象与经济条件",
  E,
  "第四条",
  "第四条",
  "population",
  "有效期三年且尚未确认正式接续文本，2026现行资格需结合一件事与后续文件核准。",
);
add(
  econ.id,
  "MINIMUM",
  "省级最低标准及低保收入豁免",
  E,
  "第五条",
  "在低保对象家庭",
  "actions",
  "不低于50元不是隆阳独立地方实发标准；不套用到养老消费券事项。",
);
add(
  econ.id,
  "PAYMENT_CHANNEL",
  "一卡通及社保卡银行账户",
  E,
  "第七条",
  "第七条",
  "channels",
);
add(
  econ.id,
  "REMIND",
  "提前通知提醒",
  E,
  "乡镇人民政府（街道办事处）依托",
  "乡镇人民政府（街道办事处）依托",
  "schedule",
);
add(
  econ.id,
  "APPLY",
  "历史线上线下申请及代办材料",
  E,
  "（一）线上申请",
  "老年人户籍所在地和常住",
  "actions",
  "2026一件事明确免申即享；试行主动申请部分仅保留原文，不自动构造替代或失效日。",
);
add(
  econ.id,
  "REVIEW",
  "试行审核与公示",
  E,
  "第九条",
  "（二）线下审核",
  "actions",
  "完整保留受理后3个工作日及不少于3个工作日公示，不当成现行免申流程时限。",
);
add(
  econ.id,
  "APPROVE",
  "试行复核审批及公示",
  E,
  "第十条",
  "县级民政部门收到",
  "actions",
);
add(
  econ.id,
  "CHANGE_INFO",
  "账户及电话信息变更",
  E,
  "第十一条",
  "第十一条",
  "schedule",
  "原文是7日，不改为7个工作日。",
);
add(
  econ.id,
  "START_PAY",
  "审定月起发及次月补发",
  E,
  "第十二条",
  "第十二条",
  "schedule",
);
add(
  econ.id,
  "FAILED_PAY",
  "信息错误退回与重新发放",
  E,
  "第十四条",
  "第十四条",
  "actions",
);
add(
  econ.id,
  "MOVE",
  "户籍迁出停发及迁入申请",
  E,
  "第十五条",
  "第十五条",
  "actions",
  "不要与高龄津贴迁入次月起发规则混用；2026免申后的补录方式仍待核。",
);
add(econ.id, "DYNAMIC", "动态调整", E, "第十六条", "第十六条", "actions");
add(
  econ.id,
  "DEATH",
  "死亡次月停发及报告追退",
  E,
  "第十七条",
  "未及时报告的",
  "actions",
);
add(econ.id, "NOTICE", "变更停发告知", E, "第十九条", "第十九条", "schedule");
add(
  econ.id,
  "VALIDITY",
  "施行及三年有效期",
  E,
  "第二十六条",
  "第二十六条",
  "schedule",
  "精确末日未直接写明，未自行计算失效日期；2026-11不宣称试行办法仍现行，需续期或正式新规。",
);

await doc(
  7,
  "LY_ECON_ONLINE_2023",
  "B7",
  E,
  ["530000"],
  "隆阳区丙麻乡人民政府",
  null,
  "historical_reference",
);
add("LY_ECON_ONLINE_2023", "OBJECT", "历史对象及标准", E, 1, 2, "conditions");
add(
  "LY_ECON_ONLINE_2023",
  "APPLY",
  "线上线下及异地代办",
  E,
  4,
  6,
  "channels",
  "历史操作说明，与2026免申即享区分，不能认为养老消费补贴也免申。",
);
add(
  "LY_ECON_ONLINE_2023",
  "STEPS",
  "注册填报及无需上传资料提示",
  E,
  8,
  12,
  "actions",
  "“无需上传资料”是当时小程序流程提示，不是所有养老业务都无需材料。",
);
const one = await doc(
  8,
  "YN_ELDER_ONE_SERVICE_2026",
  "B8-province",
  E,
  ["530000"],
  "云南省民政厅、云南省公安厅、云南省财政厅、云南省人力资源和社会保障厅、云南省卫生健康委员会",
  "〔2026〕—52",
  "candidate",
  "2026-04-08",
);
one.publishedAt = "2026-04-14";
metadata.find((m) => m.documentId === one.id).sourceCarrierIds = [
  "B8-province",
  "B8-reprint",
];
metadata.find((m) => m.documentId === one.id).matterIds = [H, E];
add(
  one.id,
  "GOAL_HIGH",
  "高龄津贴免申即享目标",
  H,
  "建立健全",
  "向符合条件",
  "actions",
  "未写独立施行日期，不能把4月14日或转载4月23日当成生效日。",
);
add(
  one.id,
  "GOAL_ECON",
  "经济困难服务补贴免申即享目标",
  E,
  "建立健全",
  "向符合条件",
  "actions",
);
add(
  one.id,
  "HIGH_FLOW",
  "高龄资格认证与主动联系",
  H,
  "（一）高龄津贴",
  "（一）高龄津贴",
  "actions",
  "资格认证仍须核实，不等于免条件。",
);
add(
  one.id,
  "ECON_FLOW",
  "经济困难补贴对象数据及免申发放",
  E,
  "（二）经济困难",
  "（二）经济困难",
  "conditions",
  "新通知确认低保/分散特困80及以上纳入数据和免申流程；没有明文续期试行办法的全部条款或新增金额。",
);
add(
  one.id,
  "DUTIES_HIGH",
  "高龄经办职责与社保卡协调",
  H,
  "（一）民政部门",
  "（一）民政部门",
  "actions",
);
add(
  one.id,
  "DUTIES_ECON",
  "经济困难补贴经办职责与社保卡协调",
  E,
  "（一）民政部门",
  "（一）民政部门",
  "actions",
);

const national = await doc(
  9,
  "CN_CONSUMPTION_2025_37",
  "C9",
  C,
  ["CN"],
  "民政部、财政部",
  "民发〔2025〕37号",
  "framework_reference",
  "2025-07-16",
);
add(
  national.id,
  "OBJECT",
  "国家框架补贴对象及排除情形",
  C,
  "经统一评估为中度",
  "经统一评估为中度",
  "conditions",
  "2025先行试点不包括云南；对象通用定义需结合2026全国启动，不因国家发布就认为云南从2025年7月实施。",
);
add(
  national.id,
  "SERVICES",
  "补贴项目与期限边界",
  C,
  "补贴项目包括",
  "补贴项目包括",
  "actions",
  "国家30天以上/以内与省级30天及以上有边界差异，需核对整整30天的归类。",
);
add(
  national.id,
  "FORM",
  "按自然月电子消费券",
  C,
  "补贴资金通过",
  "补贴资金通过",
  "channels",
);
add(
  national.id,
  "RATES",
  "国家框架30%—60%及长护险衔接",
  C,
  "电子消费券可以",
  "中度以上失能老年人正在享受",
  "actions",
  "具体比例额度以券和当地正式规定；不把比例区间当云南固定标准。",
);
add(
  national.id,
  "PERIOD",
  "2025试点范围及12个自然月",
  C,
  "各个地区的项目",
  "各个地区的项目",
  "schedule",
  "2026全国周期见后续通知；不由此计算云南2025起止日。",
);
add(
  national.id,
  "PROXY",
  "本人或代办人申请及线下协助",
  C,
  "中度以上失能老年人或其代办人",
  "中度以上失能老年人或其代办人",
  "actions",
);
add(
  national.id,
  "ASSESS",
  "能力评估及既往结果",
  C,
  "各地民政部门应当依据",
  "各地民政部门应当依据",
  "conditions",
  "原通知印发前12个月口径与2026全国启动2024年7月以来数据口径均保留，不能自动选择更晚网页。",
);
add(
  national.id,
  "VOUCHER",
  "消费券发放、月内使用及次月停发",
  C,
  "对经审核符合",
  "老年人因身体状况变化",
  "actions",
);
add(
  national.id,
  "REDEEM",
  "消费券核销及机构凭证",
  C,
  "中度以上失能老年人进行",
  "老年人接受机构养老服务",
  "actions",
  "机构上传的协议/票据不误写成老人申请阶段必交材料。",
);
const launch = await doc(
  10,
  "CN_CONSUMPTION_LAUNCH_2026",
  "C10",
  C,
  ["CN"],
  "民政部办公厅、财政部办公厅",
  "关于全面启动实施向中度以上失能老年人发放养老服务消费补贴项目的通知",
  "candidate",
  "2025-12-26",
);
const start = part(launch.id, "根据《民政部");
launch.effectiveFrom = "2026-01-01";
launch.effectiveFromEvidence = evidence(
  "项目全国实施起始2026-01-01",
  start.quote,
  start.locator,
);
add(
  launch.id,
  "START",
  "全国组织实施起始",
  C,
  "根据《民政部",
  "根据《民政部",
  "schedule",
  "落款2025-12-26；转载2026-02-03；实施2026-01-01，分别保存。",
);
add(
  launch.id,
  "ASSESS_DATA",
  "2024年7月以来既有评估数据对接",
  C,
  "（一）推进存量",
  "（一）推进存量",
  "conditions",
  "与云南1月14日方案印发前12个月、保山解读2025年内口径存在差异，资格确认需经办核准。",
);
add(
  launch.id,
  "CYCLE",
  "2026年1—12月实施周期",
  C,
  "（一）压实主体责任",
  "（一）压实主体责任",
  "schedule",
  "原文是12个自然月（2026年1月至12月）；未自行将通知失效日设为项目结束日，结束月及后续延续待核。",
);
const scheme = await doc(
  11,
  "YN_CONSUMPTION_2026_4",
  "C11-honghe",
  C,
  ["530000"],
  "云南省民政厅、云南省财政厅",
  "云民发〔2026〕4号",
  "candidate",
  "2026-01-14",
);
metadata.find((m) => m.documentId === scheme.id).sourceCarrierIds = [
  "C11",
  "C11-honghe",
];
add(
  scheme.id,
  "OBJECT",
  "云南常住、年龄、失能等级及排除情形",
  C,
  "经统一程序评估",
  "正在享受特困",
  "conditions",
  "常住不等于必须云南户籍；含60周岁门槛及三个不重复范围，须完整保留。",
);
add(
  scheme.id,
  "SERVICES",
  "机构长期/喘息及居家社区项目",
  C,
  "补贴覆盖居家",
  "2.居家和社区",
  "actions",
  "省级长期30天及以上/短期30天以内；与国家框架比较需人工确认。",
);
add(
  scheme.id,
  "FORM",
  "电子券实名账户及适用机构",
  C,
  "采用数字化",
  "采用数字化",
  "channels",
);
add(
  scheme.id,
  "RATES",
  "云南暂定比例、限额及评估券",
  C,
  "电子消费券可以",
  "电子消费券可以",
  "actions",
  "机构40%、居家社区50%、各每人每月最高800元；评估最高100元；暂定并可调整，须复核当前标准。",
);
add(
  scheme.id,
  "LTC",
  "长护险扣除后个人自付部分衔接",
  C,
  "与其他政策衔接",
  "与其他政策衔接",
  "conditions",
  "不是将长护险待遇全部纳入排除范围。",
);
add(
  scheme.id,
  "PERIOD",
  "2026年1月起周期及上级结束要求",
  C,
  "自2026年1月开始",
  "自2026年1月开始",
  "schedule",
  "只有月和周期，日级字段留null；与全国启动通知共同核查，不按网页转载日开算一年。",
);
add(
  scheme.id,
  "PROXY",
  "自愿申请、代办及线下协助",
  C,
  "坚持自愿申请原则",
  "坚持自愿申请原则",
  "actions",
  "该业务仍需申请，不套用高龄/经济困难服务补贴免申流程。",
);
add(
  scheme.id,
  "ASSESS",
  "统一评估、既有结果确认及争议复核",
  C,
  "各地民政部门依据",
  "各州（市）、县（市、区）民政部门应当设立",
  "conditions",
  "既有评估印发前12个月与国家2024年7月以来口径、保山2025年口径不一致；必须县级确认，不能承诺绝不重评。",
);
add(
  scheme.id,
  "VOUCHER",
  "首次发券、月末例外及当月有效",
  C,
  "对首次申请",
  "对首次申请",
  "schedule",
  "保留距离当月最后工作日不足5个工作日改次月发放的例外。",
);
add(
  scheme.id,
  "STOP",
  "情况变化报告及次月停券",
  C,
  "老年人因身体状况变化",
  "老年人因身体状况变化",
  "actions",
);
add(
  scheme.id,
  "REDEEM",
  "自主选择、自付及机构核销凭证",
  C,
  "1.自主选择",
  "3.凭证上传",
  "actions",
  "跨段的个人自付句不截断；上传凭证是机构义务。",
);
add(
  scheme.id,
  "ASSESS_COST",
  "评估费与轻度/完好费用承担",
  C,
  "由第三方专业评估机构",
  "由第三方专业评估机构",
  "conditions",
  "不能把100元理解为所有申请人无条件免费，需结合中度以上及地方统筹例外。",
);
const local = await doc(
  12,
  "BS_CONSUMPTION_INTERPRETATION_2026",
  "C12",
  C,
  ["530500"],
  "隆阳区青华街道办事处",
  null,
  "local_interpretation",
);
add(
  local.id,
  "OBJECT",
  "保山常住补贴对象",
  C,
  4,
  4,
  "population",
  "结合省级完整排除范围；来源署名为隆阳发布，不冒充两部委正式文件。",
);
add(
  local.id,
  "RATES",
  "保山解读暂定标准",
  C,
  9,
  9,
  "actions",
  "40%/50%与800元上限是比例抵扣，不是直接每月发800元现金。",
);
add(local.id, "PERIOD", "保山解读实施周期", C, 10, 10, "schedule");
add(local.id, "PROXY", "保山解读代办", C, 13, 13, "actions");
add(
  local.id,
  "ASSESS",
  "保山评估标准、费用及2025年既有评估",
  C,
  15,
  15,
  "conditions",
  "得分65-0分文字按原文保留，须核标准；2025年内口径不直接替代国家2024年7月以来口径。",
);
add(
  local.id,
  "VOUCHER",
  "保山解读券有效期与停发",
  C,
  17,
  17,
  "schedule",
  "次月失效不等于滚存或提现。",
);

// PDF文字层：原始逐页文字另存；规范化仅去排版换行/空格，页码由映射保存。
const pdf = await json("sources/C13-pdf.extracted.json");
const pdfPages = pdf.pages.map((p) => ({
  page: p.page,
  text: p.text.replace(/^—\s*\d+\s*—\s*/, "").replace(/\s+/g, ""),
}));
const pdfOriginal = pdfPages.map((p) => p.text).join("\n\n");
await save("sources/C13-pdf.normalized.txt", pdfOriginal + "\n");
const guideId = "LY_CONSUMPTION_GUIDE_2026";
const guide = {
  ...base,
  id: guideId,
  title: "中度以上失能老年人养老服务消费补贴项目申请审批流程",
  publisher: "隆阳区板桥镇人民政府（网页发布，附件未署原编制机关）",
  sourceUrl: source("C13").url,
  publishedAt: null,
  regionCodes: ["530502"],
  originalText: pdfOriginal,
  originalPath: "data/official/longyang-pilot/sources/C13-pdf.pdf",
  checkedAt: null,
  checkedBy: null,
  effectiveFrom: null,
  effectiveTo: null,
  effectiveFromEvidence: null,
  effectiveToEvidence: null,
};
docs.push(guide);
metadata.push({
  item: 13,
  documentId: guideId,
  matterIds: [C],
  classification: "local_operating_guide",
  sourceCarrierIds: ["C13", "C13-pdf"],
  webPublisher: "隆阳区板桥镇人民政府",
  webPublishedAt: "2026-05-26",
  originalIssuers: null,
  signedAt: null,
  originalPublishedAt: null,
  publicationGate: "核对PDF及平台实际流程；简写不覆盖资格排除条件",
  normalization:
    "去分页页脚和排版空白，原PDF/逐页文本均另存；引文可在normalized.txt逐字定位",
  pages: pdfPages.map((p) => ({
    page: p.page,
    first: p.text.slice(0, 35),
    last: p.text.slice(-35),
  })),
});
function pdfClause(suffix, topic, start, end, field, question) {
  const begin = pdfOriginal.indexOf(start),
    finish = end
      ? pdfOriginal.indexOf(end, begin + start.length)
      : pdfOriginal.length;
  if (begin < 0 || finish < 0) throw new Error("PDF锚点丢失：" + suffix);
  const quote = pdfOriginal.slice(begin, finish).trim();
  bodies.set(guideId, [quote]);
  const c = add(guideId, suffix, topic, C, 0, 0, field, question);
  const first = pdfPages.findIndex((p) => p.text.includes(start));
  const last = end
    ? pdfPages.findIndex((p) => p.text.includes(end))
    : pdfPages.length - 1;
  c.locator = `PDF第${first + 1}${last > first ? "—" + (last + 1) : ""}页；${topic}`;
  const r = review.at(-1);
  r.locator = c.locator;
  const es = Array.isArray(c[field]) ? c[field] : [c[field]];
  es.forEach((e) => (e.locator = c.locator));
  return c;
}
pdfClause(
  "REGISTER",
  "注册、登录和实名认证",
  "步骤1：登录平台",
  "步骤4：提交补贴申请",
  "actions",
  "人脸识别需本人配合；身份证照片用于实名认证，代办入口需按平台核准。",
);
pdfClause(
  "APPLY_PROXY",
  "申请信息、常住类型、代办与材料",
  "步骤3：实名认证",
  "步骤5：预约能力评估",
  "materials",
  "“添加代办人”是原文按钮，确认实际是添加被代办老人；仅把有原文的身份照片及信息列为材料，不自创清单。",
);
pdfClause(
  "ASSESS",
  "预约评估及领券简写",
  "步骤5：预约能力评估",
  "2.消费券使用流程",
  "actions",
  "原文“评估完成后即可领券”是简写，必须合并省级中度以上、排除情形和审核要求，不生成评估完都能领券结论。",
);
pdfClause(
  "CONSUME",
  "选择备案机构、预约、服务、核销及自付",
  "2.消费券使用流程",
  "（二）机构申报指南",
  "actions",
  "需先完成符合资格的能力评估；实际券抵扣比例/额度与自付限制仍需核准。",
);
pdfClause(
  "CONTACT",
  "隆阳区咨询渠道",
  "二、咨询及服务渠道",
  null,
  "contacts",
  "原文号码0875-2229150已从文字层与第7页图像比对；未拨打验证是否仍可接通。",
);

const regions = [
  { code: "CN", name: "中国", parentCode: null, dataset: "official" },
  { code: "530000", name: "云南省", parentCode: "CN", dataset: "official" },
  { code: "530500", name: "保山市", parentCode: "530000", dataset: "official" },
  { code: "530502", name: "隆阳区", parentCode: "530500", dataset: "official" },
  {
    code: "LY_LUJIANG",
    name: "隆阳区潞江镇",
    parentCode: "530502",
    dataset: "official",
  },
  {
    code: "LY_XIYI",
    name: "隆阳区西邑乡",
    parentCode: "530502",
    dataset: "official",
  },
];
const batch = {
  schemaVersion: 1,
  actor: "成员③资料整理（AI辅助，未人工审核）",
  reason:
    "隆阳试点13项来源，保留历史、冲突、试行有效期及多载体；本轮仅预检查和隔离技术验证，不在项目库导入发布。",
  regions,
  documents: docs,
  clauses,
};
await save("batch.draft.json", batch);
await save("document-metadata.json", metadata);
await save("review-items.json", review);
const carrierNotes = {
  6: "正文全文已取得；指定正式PDF HTTP404，原件仍待补充。",
  11: "指定省厅旧链接HTTP404；采用红河州政府完整转载，同一文件一个实体。附件清单保留，未将清单当附件正文。",
  13: "从HTML showVsbpdfIframe参数取得7页PDF，文字层完整；网页本身没有正文。",
};
const status = Array.from({ length: 13 }, (_, i) => {
  const item = i + 1,
    carriers = [
      ...acquisition.sources,
      ...acquisition.attachments,
      ...(acquisition.supplements ?? []),
    ].filter((s) => s.item === item);
  return {
    item,
    status: item === 6 ? "partial" : "full_text_acquired",
    note: carrierNotes[item] ?? "官方正文已取得（扫描原件需人工核准转写）",
    documentIds: metadata
      .filter((m) => m.item === item)
      .map((m) => m.documentId),
    carriers: carriers.map((s) => ({
      id: s.id,
      url: s.url,
      status: s.status,
      httpStatus: s.httpStatus,
      file: s.file ?? null,
      retrievedAt: s.retrievedAt,
      sha256: s.sha256 ?? null,
      error: s.error ?? null,
    })),
  };
});
await save("acquisition-status.json", status);
const conflicts = [
  [
    "CONFLICT_HIGH_APPLY",
    "免申即享与主动申请",
    "高龄津贴",
    "YN_GLT_AUTO_PROCESS",
    "LY_GLT_WADU_2025_APPLICATION",
    "瓦渡2025告知仍主动申请，且引用已被113号明确废止的2009文号。需隆阳民政确认过渡/补录或网页未更新；不整篇标废止。",
  ],
  [
    "CONFLICT_LOCAL_RATE",
    "省级最低与地方网页标准",
    "高龄津贴",
    "YN_GLT_PROVINCIAL_RATES",
    "LY_GLT_WADU_2025_LOCAL_RATES",
    "省级100岁及以上300元与地方网页350元是不同层次，不能互相覆盖；补区级规范文件及当前口径。",
  ],
  [
    "REVIEW_ECON_TERM",
    "三年有效期与2026免申即享",
    "经济困难老年人服务补贴",
    "YN_ECON_SERVICE_2023_2_VALIDITY",
    "YN_ELDER_ONE_SERVICE_2026_ECON_FLOW",
    "试行办法2023-04-01起有效三年；未取得续期或2026征求意见后正式办法，不宣布整个制度终止，也不宣称旧办法目前有效。",
  ],
  [
    "CONFLICT_ECON_FLOW",
    "试行/历史申请与2026免申流程",
    "经济困难老年人服务补贴",
    "YN_ECON_SERVICE_2023_2_APPLY",
    "YN_ELDER_ONE_SERVICE_2026_ECON_FLOW",
    "新通知明确免申流程，但未逐条废止目标文号，不构造relations；需确认迁入等特殊补录。",
  ],
  [
    "CONFLICT_ASSESS_HISTORY",
    "既有评估结果期间口径",
    "养老服务消费补贴",
    "CN_CONSUMPTION_LAUNCH_2026_ASSESS_DATA",
    "YN_CONSUMPTION_2026_4_ASSESS",
    "全国2024年7月以来；省方案印发前12个月；保山解读2025年内。需县级确认，不能直接拒绝2024年合格评估或承诺不重评。",
  ],
  [
    "CONFLICT_GUIDE_SHORT",
    "评估完成即可领券的操作简写",
    "养老服务消费补贴",
    "LY_CONSUMPTION_GUIDE_2026_ASSESS",
    "YN_CONSUMPTION_2026_4_OBJECT",
    "流程指南省略中度以上/审核/排除条件；引用完整资格条款，不能把“完成评估”等同于必定领券。",
  ],
  [
    "REVIEW_EXACT_30D",
    "机构长期与短期整30天边界",
    "养老服务消费补贴",
    "CN_CONSUMPTION_2025_37_SERVICES",
    "YN_CONSUMPTION_2026_4_SERVICES",
    "国家写30天以上/以内，省方案写30天及以上/以内；边界重叠按经办核准，保留两边用字。",
  ],
];
await save(
  "conflicts.json",
  conflicts.map(([id, title, matter, left, right, question]) => ({
    id,
    title,
    matter,
    left,
    right,
    question,
    status: "pending_human_review",
    evidence: [left, right].map((id) => {
      const c = clauses.find((c) => c.id === id);
      return {
        clauseId: id,
        quote: c.quote,
        locator: c.locator,
        url: findDoc(c.documentId).sourceUrl,
      };
    }),
  })),
);
const counts = {
  documents: docs.length,
  clauses: clauses.length,
  byMatter: Object.fromEntries(
    [H, E, C].map((m) => [
      m,
      {
        name: names[m],
        documents: metadata.filter((d) => d.matterIds.includes(m)).length,
        clauses: clauses.filter((c) => c.matterId === m).length,
      },
    ]),
  ),
};
await save("summary.json", counts);
const sha = (x) => createHash("sha256").update(x).digest("hex");
const artifacts = [];
for (const r of [
  ...acquisition.sources,
  ...acquisition.attachments,
  ...(acquisition.supplements ?? []),
].filter((r) => r.status === "retrieved")) {
  const bytes = await readFile(new URL(r.file, root));
  if (sha(bytes) !== r.sha256) throw new Error("原始文件哈希不符：" + r.id);
  artifacts.push({
    id: r.id,
    path: r.file,
    sha256: sha(bytes),
    bytes: bytes.length,
  });
}
await save("artifact-checksums.json", {
  checkedAt: new Date().toISOString(),
  artifacts,
  batchSha256: sha(await readFile(new URL("batch.draft.json", root))),
});
let md =
  "# 隆阳试点13项资料：人工核对表\n\n**待审核、未在项目库导入或发布。获取/检索日期2026-11-16；技术检查不等于人工政策审核。**\n\n先读[获取结果](ACQUISITION.md)、[冲突与时效](CONFLICTS.md)，再逐条核对。完整来源日期/发布机关/载体映射见document-metadata.json及acquisition.json。\n\n## 人工确认门槛\n\n- [ ] 2026年9月征求意见之后正式办法/续期文件是否发布；试行三年有效期如何衔接。\n- [ ] 瓦渡主动申请与免申即享、2023历史流程的适用边界。\n- [ ] 100岁及以上地方350元的区级原文件和当前标准；省级300元另存。\n- [ ] 常住/户籍、评估与排除条件不能跨三个事项混用。\n- [ ] 既有评估2024年7月以来/印发前12个月/2025年内三个口径。\n- [ ] 消费券首次月末不足5个工作日例外、当月使用次月失效、比例及个人自付限制。\n- [ ] 所有扫描转写、PDF页码、电话和注册代办按钮；电话未实拨。\n- [ ] CN为ISO国别码；6位省市区码及上下级待核，LY_LUJIANG/LY_XIYI是项目内部乡镇键，未冒充国家乡镇码。旧首批草稿省级根节点扩展为CN，本批替代未导入的旧批次作为导入入口，不同时导入两批。\n\n";
for (const r of review)
  md += `## ${r.clauseId}｜${r.topic}\n\n文件：${r.documentId}@1；事项：${names[r.matterId]}；地区：${clauses.find((c) => c.id === r.clauseId).regionCodes.join(", ")}；资料身份：${r.classification}。\n\n结构化结果：\n\n\`\`\`json\n${JSON.stringify(r.structured, null, 2)}\n\`\`\`\n\n[原文来源](${r.sourceUrl})；位置：${r.locator}。\n\n${r.quote
    .split("\n")
    .map((s) => "> " + s)
    .join(
      "\n",
    )}\n\n待确认：${r.question}\n\n状态：待核对；核对人：____；日期：____；决定：□通过 □修改 □不发布；备注：____\n\n`;
await save("REVIEW_CHECKLIST.md", md);
const esc = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
await save(
  "REVIEW_CHECKLIST.csv",
  "\ufeff" +
    [
      [
        "文件编号",
        "条款编号",
        "业务主题",
        "资料身份",
        "地区",
        "结构化结果",
        "原文",
        "原文位置",
        "来源",
        "核对状态",
        "待确认问题",
        "核对人",
        "核对日期",
        "决定",
      ],
      ...review.map((r) => [
        r.documentId,
        r.clauseId,
        names[r.matterId] + "：" + r.topic,
        r.classification,
        clauses.find((c) => c.id === r.clauseId).regionCodes.join("|"),
        JSON.stringify(r.structured),
        r.quote,
        r.locator,
        r.sourceUrl,
        r.status,
        r.question,
        "",
        "",
        "",
      ]),
    ]
      .map((row) => row.map(esc).join(","))
      .join("\r\n") +
    "\r\n",
);
await save(
  "ACQUISITION.md",
  "# 13项实际获取结果\n\n获取日期2026-11-16。全文取得指主体正文取得，未表示人工审核或全部附表已取得。原件不重复建政策实体。\n\n|编号|结果|文件编号|说明|\n|---|---|---|---|\n" +
    status
      .map(
        (s) =>
          `|${s.item}|${s.status === "partial" ? "部分获取" : "全文取得"}|${s.documentIds.join(", ")}|${s.note}|`,
      )
      .join("\n") +
    "\n\n逐载体HTTP结果、错误、下载URL、日期及哈希见acquisition-status.json；第6项正式PDF404，施甸文字版完整；第11项省厅旧链接404，红河州完整转载已取得。\n",
);
await save(
  "CONFLICTS.md",
  "# 冲突、缺口与时效（待人工核对）\n\n本表不自动决策政策效力。\n\n" +
    conflicts
      .map(
        ([id, title, matter, left, right, q]) =>
          `## ${id}｜${title}\n\n业务：${matter}。依据：${left}、${right}。\n\n${q}\n`,
      )
      .join("\n") +
    "\n## 后续正式文件检索\n\n检索日期2026-11-16。检索记录见research-log.json。2026年9月征求意见之后的正式新办法/延长试行有效期文件**未核实取得**；不能把未找到当作确定未发布。征求意见线索单列，不进入正式政策批次。2026“一件事”已取得原省厅全文，只确认其明文规定的免申流程及职责，不借此认定试行全篇续期。\n\n## 待补原件\n\n- 指定省厅经济困难服务补贴PDF（现404）；其文字版已得，仍需原件校对。\n- 2026年9月征求意见稿的官方公告/正文及此后正式文号、续期或废止依据。\n- 隆阳地方高龄标准原规范文件，以及2009/2022旧通知、云财农〔2022〕249号原文。\n- 省消费补贴方案列出的附表/实施细则未当正文取得；需按涉及场景补充附件。\n- 当前可接待的评估机构/服务机构名录、咨询电话有效性及社保卡特例细节。\n",
);
console.log(JSON.stringify(counts, null, 2));
