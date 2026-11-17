// 只校验文件，不写资料库；保留真实运行结果。
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  parseBatch,
  validateLinks,
} from "../../../../backend/dist/src/model.js";
import {
  parsePage,
  registrySchema,
} from "../../../../backend/dist/src/source-monitor.js";
import { parseCsv } from "./sync-review-questions.mjs";
const root = new URL("../", import.meta.url),
  folder = "review-followup-2026-11-17/",
  hash = (x) => createHash("sha256").update(x).digest("hex");
const read = async (f) => JSON.parse(await readFile(new URL(f, root), "utf8"));
const repo = fileURLToPath(new URL("../../../../", import.meta.url)),
  gitArgs = [
    "-c",
    "safe.directory=" + repo.replaceAll("\\", "/").replace(/\/$/, ""),
  ];
const fromHead = (f) =>
  execFileSync(
    "git",
    [...gitArgs, "show", "HEAD:data/official/longyang-pilot/" + f],
    { cwd: repo, maxBuffer: 4 * 1024 * 1024 },
  );
const batchRaw = await readFile(new URL("batch.draft.json", root)),
  batch = parseBatch(JSON.parse(batchRaw)),
  receipt = await read(folder + "review-receipt.json"),
  acq = await read(folder + "acquisition.json"),
  attachmentReview = await read(folder + "attachment-review.json");
assert.deepEqual(validateLinks(batch), []);
assert.equal(hash(batchRaw), hash(fromHead("batch.draft.json")));
assert.equal(batch.documents.length, 13);
assert.equal(batch.clauses.length, 90);
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
let rawFiles = 0,
  textFiles = 0;
for (const s of [...acq.sources, ...acq.attachments].filter(
  (s) => s.status === "retrieved",
)) {
  assert.equal(hash(await readFile(new URL(folder + s.file, root))), s.sha256);
  rawFiles++;
  const file = s.textFile ?? s.bodyFile,
    value = s.textSha256 ?? s.bodySha256;
  if (file) {
    assert.equal(hash(await readFile(new URL(folder + file, root))), value);
    textFiles++;
  }
}
assert.equal(acq.attachments.length, 7);
assert.ok(
  acq.attachments.every(
    (a) =>
      a.textStatus === "extracted_pending_human_review" &&
      a.policyReviewed === false,
  ),
);
for (const u of receipt.userTexts)
  assert.equal(hash(await readFile(new URL(folder + u.file, root))), u.sha256);
const registry = registrySchema.parse(await read("source-registry.json")),
  s = registry.sources.find((s) => s.id === "C11-honghe");
const parsed = parsePage(
  await readFile(new URL(s.baseline.file, root), "utf8"),
  s,
);
assert.equal(parsed.attachmentUrls.length, 7);
assert.deepEqual(
  [...parsed.attachmentUrls].sort(),
  s.baseline.attachments.map((a) => a.url).sort(),
);
const text7 = await readFile(
    new URL(folder + "sources/C11-attachment-7.txt", root),
    "utf8",
  ),
  norm = (t) => t.replace(/\s+/g, "");
assert.equal(attachmentReview.candidates.length, 7);
for (const r of attachmentReview.candidates) {
  assert.equal(r.reviewStatus, "draft");
  assert.equal(r.importReady, false);
  assert.ok(norm(text7).includes(norm(r.quote)));
  assert.ok(r.locator.startsWith("附件7"));
}
const items = await read("review-items.json"),
  md = await readFile(new URL("REVIEW_CHECKLIST.md", root), "utf8"),
  rows = parseCsv(
    await readFile(new URL("REVIEW_CHECKLIST.csv", root), "utf8"),
  ),
  oldRows = parseCsv(fromHead("REVIEW_CHECKLIST.csv").toString("utf8"));
assert.equal(rows.length, 91);
assert.equal(items.filter((i) => i.reviewFeedback).length, 15);
for (const item of items) {
  const clause = batch.clauses.find((c) => c.id === item.clauseId);
  assert.equal(item.quote, clause.quote);
  assert.equal(item.locator, clause.locator);
  assert.equal(item.status, "pending_human_review");
  const row = rows.find((r) => r[1] === item.clauseId),
    old = oldRows.find((r) => r[1] === item.clauseId);
  assert.equal(row[10], item.question);
  assert.deepEqual(
    row.filter((_, i) => i !== 10),
    old.filter((_, i) => i !== 10),
    "不得改变核对表原文或审核字段",
  );
  const start = md.indexOf("## " + item.clauseId + "｜"),
    end = md.indexOf("\n## ", start + 3);
  assert.ok(start >= 0);
  assert.ok(
    md
      .slice(start, end < 0 ? undefined : end)
      .includes("待确认：" + item.question),
    "MD反馈必须在准确条款下",
  );
}
const meta = (await read("document-metadata.json")).find(
  (m) => m.documentId === "YN_CONSUMPTION_2026_4",
);
assert.equal(meta.signedAt, "2026-01-14");
assert.equal(meta.provinceWebPublishedAt, "2026-01-27");
assert.equal(meta.reprintWebPublishedAt, "2026-02-28");
assert.equal(meta.issuedAt, null);
for (const [id, rate] of [
  ["BS-202601", "350"],
  ["BS-202602", "350"],
  ["BS-202608", "1000"],
]) {
  const source = acq.sources.find((s) => s.id === id);
  assert.equal(source.longyangRows.length, 1);
  assert.equal(source.longyangRows[0][6], rate);
}
const original = (await read("sources/C11-honghe.extracted.json")).paragraphs,
  begin = original.findIndex((p) => p.startsWith("为深入贯彻落实")),
  end = original.findIndex((p, i) => i > begin && p === "附件：");
assert.ok(begin >= 0 && end > begin);
const official = norm(original.slice(begin, end).join("")),
  user = norm(
    (await readFile(new URL(folder + "sources/USER-C11.txt", root), "utf8"))
      .split("\n")
      .slice(1)
      .join("\n"),
  );
const differences = [];
if (official.length === user.length)
  for (let i = 0; i < official.length; i++)
    if (official[i] !== user[i])
      differences.push({
        offset: i,
        official: official[i],
        user: user[i],
        officialContext: official.slice(Math.max(0, i - 15), i + 16),
        userContext: user.slice(Math.max(0, i - 15), i + 16),
      });
receipt.bodyComparison = {
  ...receipt.bodyComparison,
  normalizedBodyEquals: official === user,
  punctuationNormalizedEquals:
    official.replace(/[，,]/g, "") === user.replace(/[，,]/g, ""),
  differences,
  note: "原文字符差异保留；仅空白/逗号规范化比较不等于审核，也不改任一原文。",
};
await writeFile(
  new URL(folder + "review-receipt.json", root),
  JSON.stringify(receipt, null, 2) + "\n",
);
const report = {
  executedAt: new Date().toISOString(),
  passed: true,
  mainBatchUnchanged: true,
  documents: 13,
  clauses: 90,
  rawFilesVerified: rawFiles,
  textFilesVerified: textFiles,
  userTextsVerified: 2,
  attachmentLinksFound: 7,
  attachmentCandidatesVerified: 7,
  reviewRowsVerified: 90,
  feedbackRows: 15,
  allDraft: true,
  imported: false,
  published: false,
  bodyComparison: receipt.bodyComparison,
  checks: [
    "主草稿及审核字段不变",
    "12份官方载体原件哈希",
    "提取文字及用户文本哈希",
    "7份附件由登记选择器发现",
    "附件7候选引文可追溯",
    "90条MD/CSV/JSON按编号一致且审核列未改",
    "落款公开转载与未知印发日区分",
    "地方月份金额分开且未回填主JSON",
  ],
};
await writeFile(
  new URL(folder + "verification.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
