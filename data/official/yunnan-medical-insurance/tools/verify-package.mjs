// 核对来源、字段、路径和开发案例的技术一致性，不替代政策/界面实机审核。
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  parseBatch,
  validateLinks,
} from "../../../../backend/dist/src/model.js";
import { suiteSchema } from "../../../../backend/dist/src/evaluation.js";
const root = new URL("../", import.meta.url),
  json = async (f) => JSON.parse(await readFile(new URL(f, root), "utf8")),
  hash = (b) => createHash("sha256").update(b).digest("hex");
const bytes = await readFile(new URL("batch.draft.json", root)),
  batch = parseBatch(JSON.parse(bytes)),
  acq = await json("acquisition.json"),
  meta = await json("document-metadata.json"),
  review = await json("review-items.json"),
  nav = await json("navigation.entries.json");
assert.deepEqual(validateLinks(batch), []);
assert.equal(batch.documents.length, 20);
assert.equal(batch.clauses.length, 50);
assert.ok(
  [...batch.documents, ...batch.clauses].every(
    (r) =>
      r.reviewStatus === "draft" &&
      r.reviewedBy === null &&
      r.reviewedAt === null,
  ),
);
assert.ok(
  batch.documents.every((d) => d.checkedBy === null && d.checkedAt === null),
);
let rawPages = 0,
  assets = 0,
  contentAssets = 0;
for (const r of acq.records) {
  if (r.file) {
    assert.equal(hash(await readFile(new URL(r.file, root))), r.sha256);
    rawPages++;
  }
  for (const a of r.assets.filter((a) => a.status === "retrieved")) {
    assert.equal(hash(await readFile(new URL(a.file, root))), a.sha256);
    assets++;
    if (a.role !== "page_decoration_not_policy_evidence") contentAssets++;
  }
  if (r.textSha256)
    assert.equal(hash(await readFile(new URL(r.textFile, root))), r.textSha256);
}
assert.equal(review.length, 50);
for (const c of batch.clauses) {
  const r = review.find((r) => r.clauseId === c.id),
    d = batch.documents.find(
      (d) => d.id === c.documentId && d.version === c.documentVersion,
    );
  assert.equal(c.quote, r.quote);
  assert.equal(c.locator, r.locator);
  assert.ok(d.originalText.includes(c.quote));
  assert.ok(meta.some((m) => m.documentId === d.id));
}
assert.equal(nav.entries.length, 2);
assert.deepEqual(nav.entries[0].path, ["普通首页", "个人账户共济绑定"]);
assert.deepEqual(nav.entries[1].path, [
  "首页关怀模式",
  "长者专区",
  "个人账户共济查询和解绑",
]);
assert.ok(nav.entries[1].readonlyGuard.queryRequestIsNotUnbindConsent);
for (const e of nav.entries) {
  for (const ref of e.officialReferences)
    assert.ok(
      batch.clauses.some(
        (c) => c.id === ref.clauseId && c.version === ref.version,
      ),
    );
  for (const step of e.steps) {
    assert.ok(
      ["tap", "scroll_down", "explain", "ask_for_result_summary"].includes(
        step.action,
      ),
    );
    assert.notEqual(step.targetLabel, "解除绑定");
  }
}
assert.ok(
  nav.screenshots.every(
    (s) => s.sourceType === "user_screenshot" && s.rawFile === null,
  ),
);
assert.equal(nav.originalAppExperience.intelligentQAndAActuallyTried, false);
assert.equal(nav.originalAppExperience.voiceActuallyTried, false);
const suite = suiteSchema.parse(
  JSON.parse(
    await readFile(
      new URL("../../../eval/real/yunnan-medical-development.cases.json", root),
      "utf8",
    ),
  ),
);
assert.equal(suite.cases.length, 16);
assert.ok(
  suite.cases.every((c) => c.group === "real" && c.humanVerified === "pending"),
);
for (const c of suite.cases)
  for (const ref of c.expected.references)
    assert.ok(
      batch.clauses.some(
        (r) => r.id === ref.clauseId && r.version === ref.version,
      ),
    );
assert.ok(
  batch.clauses
    .filter((c) => c.documentId === "BS_YB_SERVICE_INTERVIEW_2026")
    .every((c) => c.regionCodes.length === 1 && c.regionCodes[0] === "530500"),
);
assert.ok(
  !batch.clauses
    .filter((c) => c.documentId === "YN_YB_APP_GUIDE_2024")
    .some((c) => c.quote.includes("2018947")),
  "不将玉溪地方电话抽为全省/保山渠道",
);
const formal = batch.clauses.find(
  (c) => c.id === "YN_YB_FAMILY_POLICY_PURPOSE",
);
assert.equal(formal.effectiveFrom, "2024-11-01");
assert.equal(
  batch.documents.find((d) => d.id === formal.documentId).publishedAt,
  "2024-09-11",
);
assert.equal(
  meta.find((m) => m.documentId === formal.documentId).signedAt,
  "2024-09-01",
);
const guide = await json("sources/YB18-guide.paragraphs.json");
assert.equal(guide.length, 7500);
const img = await json("image-review.json");
assert.equal(img.status, "pending");
assert.equal(img.originalPolicyApproved, false);
const metrics = {
  source: batch.clauses.filter((c) =>
    batch.documents.some(
      (d) => d.id === c.documentId && d.sourceUrl && d.publisher,
    ),
  ).length,
  quoteAndLocator: batch.clauses.filter((c) => c.quote && c.locator).length,
  regions: batch.clauses.filter((c) => c.regionCodes.length).length,
  effectiveFromKnown: batch.clauses.filter((c) => c.effectiveFrom !== null)
    .length,
  effectiveToKnown: batch.clauses.filter((c) => c.effectiveTo !== null).length,
};
const report = {
  executedAt: new Date().toISOString(),
  passed: true,
  documents: 20,
  clauses: 50,
  rawPagesVerified: rawPages,
  assetFilesVerified: assets,
  contentAssets,
  officialWordParagraphs: 7500,
  reviewRowsVerified: 50,
  navigationEntries: 2,
  userScreenshotObservations: nav.screenshots.length,
  userScreenshotOriginalsArchived: 0,
  developmentCases: 16,
  manualAdviceReview: 16,
  imported: false,
  published: false,
  batchSha256: hash(bytes),
  completeness: Object.fromEntries(
    Object.entries(metrics).map(([k, n]) => [
      k,
      {
        numerator: n,
        denominator: batch.clauses.length,
        unknown: batch.clauses.length - n,
      },
    ]),
  ),
  checks: [
    "严格模型及关联",
    "全部待审且无核对人",
    "21入口原始HTML及素材哈希",
    "50条原文/定位/文件版本",
    "两条截图入口与只读查询边界",
    "截图不冒充官方政策或已归档原件",
    "16例格式与支持版本",
    "省/市地区及地方电话隔离",
    "落款发布施行与年度分开",
    "Word只读段落与长图待核状态",
  ],
};
await writeFile(
  new URL("verification.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
