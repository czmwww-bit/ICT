// 一次性接续用户核对意见。只维护来源/核对侧资料，不改政策导入JSON或审核字段。
import { readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  folder = "review-followup-2026-11-17/";
const read = async (f) => JSON.parse(await readFile(new URL(f, root), "utf8"));
const save = async (f, x) =>
  writeFile(new URL(f, root), JSON.stringify(x, null, 2) + "\n");
const hash = (b) => createHash("sha256").update(b).digest("hex");
try {
  await access(new URL(folder + "review-receipt.json", root));
  throw Error("接续意见已处理，拒绝覆盖人工修改");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const batchBytes = await readFile(new URL("batch.draft.json", root)),
  batch = JSON.parse(batchBytes),
  acq = await read(folder + "acquisition.json");
const feedback = [
  {
    id: "LOCAL_RATES",
    clauses: ["YN_GLT_PROVINCIAL_RATES", "LY_GLT_WADU_2025_LOCAL_RATES"],
    confirmed:
      "省级113号最低300元，隆阳2026年1月/2月统计350元、8月统计1000元。省级标准与各月地方统计分开保留。",
    pending:
      "调整文件和施行日期仍缺；1000元不能回填全年，统计表不充当规范性调整依据。",
  },
  {
    id: "ECON_SUCCESSION",
    clauses: [
      "YN_ECON_SERVICE_2023_2_VALIDITY",
      "YN_ELDER_ONE_SERVICE_2026_ECON_FLOW",
    ],
    confirmed:
      "试行原文写2023-04-01施行、有效期三年；2026年4月通知仍明确该项补贴免申即享。",
    pending:
      "原试行办法的接续依据待核实；不能推断补贴已经取消，也不能据此认定旧办法全篇续期。",
  },
  {
    id: "APPLICATION_CONFLICT",
    clauses: [
      "LY_GLT_WADU_2025_APPLICATION",
      "YN_GLT_AUTO_PROCESS",
      "YN_ELDER_ONE_SERVICE_2026_HIGH_FLOW",
    ],
    confirmed: "瓦渡2025主动申请与后续免申即享原文并存，流程口径不一致。",
    pending:
      "过渡、补录、网页未更新均只是待验证解释；需确认具体业务、时期和适用范围，不能自动标旧网页失效。",
  },
  {
    id: "ASSESSMENT_PERIOD",
    clauses: [
      "CN_CONSUMPTION_LAUNCH_2026_ASSESS_DATA",
      "YN_CONSUMPTION_2026_4_ASSESS",
      "BS_CONSUMPTION_INTERPRETATION_2026_ASSESS",
    ],
    confirmed:
      "省方案为通知印发前12个月内，保山解读为2025年内，不能合并成同一条件。",
    pending:
      "国家2024年7月以来口径本次用户尚未完成原文核验；落款/省厅公开/转载日期分开，印发日未单独确证，不能用转载日计算12个月。",
  },
  {
    id: "ELIGIBILITY_AND_VOUCHER",
    clauses: [
      "LY_CONSUMPTION_GUIDE_2026_ASSESS",
      "YN_CONSUMPTION_2026_4_OBJECT",
      "YN_CONSUMPTION_2026_4_VOUCHER",
      "YN_CONSUMPTION_2026_4_RATES",
      "YN_CONSUMPTION_2026_4_LTC",
    ],
    confirmed:
      "评估完成不等于自动符合资格，仍需年龄、云南常住、中度以上等级及排除条件；首次5个工作日、当月使用次月失效有正文依据。",
    pending:
      "保留首月最后一个工作日不足5日的例外；附件7的简写不能覆盖正文细节，关键建议仍需审核。",
  },
];
const items = await read("review-items.json");
let updated = 0;
for (const r of items) {
  const fs = feedback.filter((f) => f.clauses.includes(r.clauseId));
  if (!fs.length) continue;
  const old = r.question;
  const extra = fs
    .map((f) => `【2026-11-17用户核对反馈】${f.confirmed}待确认：${f.pending}`)
    .join(" ");
  r.question = old + " " + extra;
  r.reviewFeedback = {
    receivedDate: "2026-11-17",
    receipt: folder + "review-receipt.json",
    issues: fs.map((f) => f.id),
    status: "partial_facts_confirmed_full_policy_approval_pending",
    reviewerName: null,
  };
  updated++;
}
const metadata = await read("document-metadata.json"),
  m = metadata.find((m) => m.documentId === "YN_CONSUMPTION_2026_4");
m.reviewFollowup = folder + "review-receipt.json";
m.attachmentsReview = folder + "attachment-review.json";
m.signedAt = "2026-01-14";
m.issuedAt = null;
m.provinceWebPublishedAt = "2026-01-27";
m.provinceWebDateProvenance = {
  sourceUrl: "https://ynmz.yn.gov.cn/cms/qitazhengcewenjian/11991.html",
  status: "user_confirmed_and_official_search_index_seen_live_http404",
  notOriginalIssuanceDate: true,
};
m.reprintWebPublishedAt = "2026-02-28";
m.dateReviewNote =
  "落款2026-01-14、省厅网页2026-01-27、红河转载2026-02-28分别记录。省厅日期为用户核对并见官方检索索引，实时抓取仍404。未单独取得印发日，印发前12个月不按转载日或公开日计算。";
metadata.find((m) => m.documentId === "YN_ECON_SERVICE_2023_2").reviewFollowup =
  folder + "review-receipt.json";
const registry = await read("source-registry.json"),
  s = registry.sources.find((s) => s.id === "C11-honghe");
s.attachmentSelector = ".dtl-txt > span a[href]";
s.attachmentRequired = true;
s.baseline = {
  file: folder + "sources/C11-honghe-review.html",
  attachments: acq.attachments
    .filter((a) => a.status === "retrieved")
    .map((a) => ({ url: a.url, file: folder + a.file })),
};
s.baselineCapturedDate = "2026-11-17";
s.baselineNote =
  "本轮首次归档附件，建立技术基线；不是政策新修订或审核通过。旧2026-11-16快照继续保留。";
const text7 = await readFile(
  new URL(folder + "sources/C11-attachment-7.txt", root),
  "utf8",
);
const lines = text7
  .split(/\r?\n/)
  .map((x) => x.trim())
  .filter(Boolean);
const topics = [
  ["OBJECT", "第二条", "适用对象及排除"],
  ["SERVICES", "第三条", "服务范围及30天边界"],
  ["RATES", "第五条", "暂定抵扣、评估券与长护险衔接"],
  ["CYCLE", "第六条", "项目周期"],
  ["PROCEDURE", "第七条", "个人/代办、评估、发券、核销及结算"],
  ["PROVIDERS", "第八条", "机构要求"],
  ["PROVIDER_APPLICATION", "第九条", "机构申报及材料"],
];
const candidates = topics.map(([id, prefix, topic]) => {
  const start = lines.findIndex((x) => x.startsWith(prefix));
  if (start < 0) throw Error("附件7条号缺失：" + prefix);
  let end = start + 1;
  while (
    end < lines.length &&
    !/^第[一二三四五六七八九十百]+[条章]/.test(lines[end])
  )
    end++;
  return {
    reviewItemId: "YN_CONSUMPTION_2026_4_ATT7_" + id,
    parentDocumentId: "YN_CONSUMPTION_2026_4",
    sourceAttachmentId: "C11-attachment-7",
    topic,
    locator: "附件7 " + prefix + "；提取文本非空段" + (start + 1) + "—" + end,
    quote: lines.slice(start, end).join("\n"),
    regionCodes: ["530000"],
    matterId: "DISABILITY_CARE_CONSUMPTION",
    reviewStatus: "draft",
    reviewedBy: null,
    reviewedAt: null,
    importReady: false,
    pending:
      "只作附件核对候选，不是已导入条款，不绑定正文v1为附件准确版本；待逐字校对后按原流程编制版本。",
  };
});
const userTexts = [];
for (const [file, related, identity] of [
  ["USER-C11.txt", "YN_CONSUMPTION_2026_4", "用户提供的省方案正文"],
  [
    "USER-B6-interpretation.txt",
    "YN_ECON_SERVICE_2023_2",
    "用户提供的政策解读，非缺失PDF原件",
  ],
]) {
  const bytes = await readFile(new URL(folder + "sources/" + file, root));
  userTexts.push({
    file: "sources/" + file,
    sha256: hash(bytes),
    relatedDocumentId: related,
    identity,
    receivedDate: "2026-11-17",
    sourceType: "user_chat_text",
    downloadedOriginal: false,
    normalization:
      "聊天正文保留用字，空白和段落换行整理为LF；非原网页/附件字节副本",
    policyReviewed: false,
  });
}
const user = await readFile(
  new URL(folder + "sources/USER-C11.txt", root),
  "utf8",
);
const original = JSON.parse(
  await readFile(new URL("sources/C11-honghe.extracted.json", root), "utf8"),
).paragraphs;
const begin = original.findIndex((p) => p.startsWith("为深入贯彻落实"));
const end = original.findIndex((p, i) => i > begin && p === "附件：");
const official = original.slice(begin, end < 0 ? undefined : end).join("");
const normalize = (t) => t.replace(/\s+/g, "");
const bodyComparison = {
  normalization: "移除标题和空白；不合并日期/资格条件",
  normalizedBodyEquals:
    normalize(user.split("\n").slice(1).join("\n")) === normalize(official),
  note: "只核对正文一致性，不是原件下载或人工政策审批。",
};
await save(folder + "attachment-review.json", {
  parentDocumentId: "YN_CONSUMPTION_2026_4",
  status: "pending_human_review",
  attachments: acq.attachments,
  candidates,
  reviewConcerns: [
    "附件7第二条未重写60周岁门槛，必须连同方案正文阅读，不能当作不受年龄限制。",
    "正文首发券明确当月最后一个工作日，附件7简写不足5个工作日，不合并或删减例外。",
    "附件7长期护理保险评估转换需保留原文等级及县级确认，不推断所有享受长护险者必然具备资格。",
    "Word文本按条号/段落定位，未渲染原件，不虚构页码。",
  ],
});
await save(folder + "review-receipt.json", {
  receivedDate: "2026-11-17",
  recordedAt: new Date().toISOString(),
  reviewerName: null,
  feedbackSource: "用户本次聊天核对结果",
  approvalScope: "部分事实核对；全部政策仍待审核、未导入未发布",
  feedback,
  userTexts,
  bodyComparison,
  dateFacts: {
    signedAt: "2026-01-14",
    provinceWebPublishedAt: "2026-01-27",
    reprintWebPublishedAt: "2026-02-28",
    issuedAt: null,
    provinceWebLiveStatus: 404,
  },
  unresolved: [
    "原经济困难补贴PDF仍缺；解读不替代原件。",
    "解读称27条，施甸转载末条为26条，待正式PDF核准。",
    "2026年9月征求意见后的新办法或续期正式依据未核实取得。",
    "国家2024年7月以来口径本次用户未完成原文核验。",
  ],
  updatedReviewItems: updated,
  mainBatchSha256: hash(batchBytes),
  mainBatchUnchanged: true,
  documents: batch.documents.length,
  clauses: batch.clauses.length,
  imported: false,
  published: false,
});
await save("review-items.json", items);
await save("document-metadata.json", metadata);
await save("source-registry.json", registry);
await (await import("./sync-review-questions.mjs")).syncReviewQuestions();
if (
  hash(await readFile(new URL("batch.draft.json", root))) !== hash(batchBytes)
)
  throw Error("主草稿意外变化");
console.log(
  JSON.stringify(
    {
      updatedReviewItems: updated,
      attachments: acq.attachments.length,
      attachmentReviewCandidates: candidates.length,
      bodyComparison,
      mainBatchUnchanged: true,
      imported: false,
      published: false,
    },
    null,
    2,
  ),
);
