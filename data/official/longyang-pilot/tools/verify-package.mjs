import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  parseBatch,
  validateLinks,
  checksum,
} from "../../../../backend/dist/src/model.js";
import { suiteSchema } from "../../../../backend/dist/src/evaluation.js";
const root = new URL("../", import.meta.url),
  read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const batch = parseBatch(await read("batch.draft.json"));
assert.deepEqual(validateLinks(batch), []);
assert.equal(batch.documents.length, 13);
assert.equal(batch.clauses.length, 90);
const records = [...batch.documents, ...batch.clauses];
assert.ok(
  records.every(
    (r) =>
      r.reviewStatus === "draft" &&
      r.reviewedBy === null &&
      r.reviewedAt === null,
  ),
);
assert.ok(
  batch.documents.every((d) => d.checkedBy === null && d.checkedAt === null),
);
const sourceItems = await read("review-items.json");
assert.equal(sourceItems.length, 90);
for (const item of sourceItems) {
  const c = batch.clauses.find((c) => c.id === item.clauseId);
  assert.ok(c);
  assert.equal(c.quote, item.quote);
  assert.equal(c.documentId, item.documentId);
  assert.equal(c.locator, item.locator);
}
const old = parseBatch(await read("../longyang-allowance/batch.draft.json"));
for (const record of [...old.documents, ...old.clauses]) {
  const current = records.find((r) => r.id === record.id);
  assert.ok(current);
  assert.equal(
    checksum(current),
    checksum(record),
    "复用稳定编号的文件/条款快照不同：" + record.id,
  );
}
const suite = suiteSchema.parse(
  await readFile(
    new URL("../../../eval/real/longyang-development.cases.json", root),
    "utf8",
  ).then(JSON.parse),
);
assert.equal(suite.cases.length, 18);
assert.ok(
  suite.cases.every((c) => c.humanVerified === "pending" && c.group === "real"),
);
for (const c of suite.cases)
  for (const ref of c.expected.references)
    assert.ok(
      batch.clauses.some(
        (r) => r.id === ref.clauseId && r.version === ref.version,
      ),
    );
const acq = await read("acquisition.json"),
  metadata = await read("document-metadata.json");
assert.equal(new Set(metadata.map((m) => m.documentId)).size, 13);
const carriers = [
  ...acq.sources,
  ...acq.attachments,
  ...(acq.supplements ?? []),
];
for (const d of batch.documents) {
  const m = metadata.find((m) => m.documentId === d.id);
  assert.ok(m);
  assert.ok(
    m.sourceCarrierIds.some((id) =>
      carriers.some((s) => s.id === id && s.status === "retrieved"),
    ),
  );
}
const hash = (b) => createHash("sha256").update(b).digest("hex");
for (const s of carriers.filter((s) => s.status === "retrieved"))
  assert.equal(
    hash(await readFile(new URL(s.file, root))),
    s.sha256,
    "原件哈希变化：" + s.id,
  );
const report = {
  executedAt: new Date().toISOString(),
  passed: true,
  documents: 13,
  clauses: 90,
  cases: 18,
  reusedVersionSnapshots: old.documents.length + old.clauses.length,
  checks: [
    "既有模型类型及关联校验",
    "全部记录draft且无人为审核字段",
    "90项核对表逐条对应",
    "18个上批编号及快照完全复用",
    "18例格式/版本/支持条款存在",
    "13实体均有成功获取的官方载体",
    "所有成功归档原件哈希匹配",
  ],
  batchSha256: hash(await readFile(new URL("batch.draft.json", root))),
  documentContentHashes: batch.documents.map((d) => ({
    id: d.id,
    version: d.version,
    recordChecksum: checksum(d),
    originalTextSha256: hash(d.originalText),
  })),
  manualPolicySemantics: "pending",
  businessEvaluation: "not_executed",
};
await writeFile(
  new URL("package-validation.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: report.passed,
    checks: report.checks.length,
    documents: 13,
    clauses: 90,
    cases: 18,
    reusedVersionSnapshots: 18,
  }),
);
