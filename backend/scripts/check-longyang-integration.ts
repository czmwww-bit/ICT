import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { pool, migrate } from '../src/db.js';
import { parseBatch } from '../src/model.js';
import { importBatch, publish } from '../src/store.js';
import { findCandidates, getClause, ancestorCodes } from '../src/query.js';
import { canonical, evidenceDigest } from '../src/backup.js';
import { withEmptyTestDatabase } from '../src/test-sandbox.js';
const { values } = parseArgs({ options: { isolated: { type: 'boolean' } } });
if (!values.isolated) throw new Error('仅允许显式 --isolated；不在正式库导入或审核');
const root = '../data/official/longyang-pilot/integration-core/';
const manifest = JSON.parse(await readFile(root + 'manifest.json', 'utf8'));
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
for (const [file, expected] of Object.entries(manifest.files))
  assert.equal(
    hash(await readFile(root + file, 'utf8')),
    expected,
    '固定测试文件哈希不一致：' + file,
  );
assert.equal(
  hash(await readFile('../data/official/longyang-pilot/batch.draft.json', 'utf8')),
  manifest.sourceBatchSha256,
);
const batch = parseBatch(JSON.parse(await readFile(root + 'batch.draft.json', 'utf8')));
const suite = JSON.parse(await readFile(root + 'query.cases.json', 'utf8'));
const metadata = JSON.parse(await readFile(root + 'document-metadata.json', 'utf8'));
const technical = '隔离联调技术标签，不是政策审核';
const project = await pool();
try {
  const before = await evidenceDigest(project);
  const result = await withEmptyTestDatabase(async (db) => {
    await migrate(db);
    const prepared = structuredClone(batch);
    assert.ok(prepared.documents.every((d) => d.reviewStatus === 'draft' && d.checkedBy === null));
    assert.ok(prepared.clauses.every((c) => c.reviewStatus === 'draft'));
    for (const d of prepared.documents) {
      d.checkedBy = technical;
      d.checkedAt = '2026-11-18';
    }
    const imported = await importBatch(db, prepared);
    assert.equal(imported.errors, 0);
    for (const c of suite.cases)
      assert.equal((await findCandidates(db, c.query)).length, 0, '草稿隔离');
    const repeated = await importBatch(db, prepared);
    assert.equal(repeated.unchanged, 13);
    for (const d of prepared.documents)
      await publish(db, 'document', d.id, d.version, technical, '仅本次测试库技术事件');
    for (const c of prepared.clauses)
      await publish(db, 'clause', c.id, c.version, technical, '仅本次测试库技术事件');
    const results = [];
    for (const c of suite.cases) {
      const hits = await findCandidates(db, c.query);
      const actual = hits.map((h) => h.clause.id + '@' + h.clause.version).sort();
      const status = !hits.length
        ? 'no_match'
        : hits.some((h) => h.timeStatus === 'needs_review')
          ? 'needs_review'
          : 'matched';
      const exactReferences = [];
      for (const ref of c.supportingReferences) {
        const found = await getClause(db, ref.clauseId, {
          version: ref.version,
          includeHistory: true,
        });
        exactReferences.push(...found);
      }
      const ancestors = ancestorCodes(prepared.regions, c.query.regionCode);
      const checks = [
        {
          name: 'exact_candidates_and_versions',
          pass: canonical(actual) === canonical(c.expectedCandidateReferences),
        },
        {
          name: 'query_state',
          pass: status === c.expectedQueryStatus,
          expected: c.expectedQueryStatus,
          actual: status,
        },
        {
          name: 'region_and_date',
          pass: hits.every(
            (h) =>
              h.clause.regionCodes.some((r) => ancestors.has(r)) &&
              (!h.clause.effectiveFrom || h.clause.effectiveFrom <= c.query.asOf) &&
              (!h.clause.effectiveTo || h.clause.effectiveTo >= c.query.asOf),
          ),
        },
        {
          name: 'review_and_dataset_filter',
          pass: hits.every(
            (h) =>
              h.publication.decision === 'approved' &&
              h.sourcePublication.decision === 'approved' &&
              h.clause.dataset === 'official',
          ),
        },
        {
          name: 'exact_reference_count',
          pass: exactReferences.length === c.supportingReferences.length,
        },
        {
          name: 'source_quote_locator_version',
          pass: [...hits, ...exactReferences].every(
            (h) =>
              Boolean(h.source.url && h.source.locator) &&
              h.document.originalText.includes(h.source.quote) &&
              h.clause.documentVersion === h.document.version &&
              batch.clauses.some((raw) => raw.id === h.clause.id && raw.quote === h.source.quote),
          ),
        },
      ].map((x) => ({ ...x, failureReason: x.pass ? null : '与固定预期不符，检查实际候选与证据' }));
      results.push({
        id: c.id,
        input: c.input,
        query: c.query,
        expected: c.expectedCandidateReferences,
        actual,
        status,
        checks,
        candidates: hits,
        supportingEvidence: exactReferences,
        reviewWarnings: metadata.map((m: any) => ({
          documentId: m.documentId,
          note: m.dateReviewNote,
          publicationGate: m.publicationGate,
        })),
        guideEvaluation: {
          status: 'not_executed',
          reason: '尚未接入成员② /api/guide',
          expected: c.expectedGuide,
        },
        manualReview: {
          status: 'pending',
          adviceSupported: null,
          eligibilityCorrect: null,
          reviewer: null,
        },
      });
    }
    return { imported, repeated, draftExclusionChecks: suite.cases.length, results };
  });
  assert.equal(canonical(before), canonical(await evidenceDigest(project)), '项目库摘要变化');
  const checks = result.results.flatMap((r) => r.checks);
  const report = {
    executedAt: new Date().toISOString(),
    codeVersion: execFileSync('git', ['-c', 'safe.directory=D:/ICT', 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim(),
    codeWorkingTree: '含本轮未提交脚本；不将HEAD冒充最终交付版本',
    manifestSha256: hash(await readFile(root + 'manifest.json', 'utf8')),
    suiteVersion: suite.version,
    scope: 'isolated_technical_preview',
    humanPolicyApproved: false,
    projectDatabaseUnchanged: true,
    testTablesCleaned: true,
    summary: {
      cases: result.results.length,
      automatic: {
        passed: checks.filter((c) => c.pass).length,
        total: checks.length,
        failed: checks.filter((c) => !c.pass).length,
      },
      guide: { executed: 0, notExecuted: 6 },
      manualReviewPending: 6,
    },
    ...result,
  };
  await writeFile(root + 'query-report.json', JSON.stringify(report, null, 2) + '\n');
  const rows = result.results.map(
    (r) =>
      `|${r.id}|${r.query.regionCode}|${r.query.asOf}|${r.actual.length}|${r.checks.every((c) => c.pass) ? '通过' : '失败'}|`,
  );
  await writeFile(
    root + 'QUERY_REPORT.md',
    `# 隆阳核心联调实测\n\n时间：${report.executedAt}。隔离技术预览，不是政策审核或指南准确率。\n\n自动检查 ${report.summary.automatic.passed}/${checks.length}，失败 ${report.summary.automatic.failed}；草稿排除 ${result.draftExclusionChecks}/${suite.cases.length}；重复导入无变化 ${result.repeated.unchanged}/13。项目库摘要不变，测试表已清理。\n\n|案例|地区|日期|候选数|检索检查|\n|---|---|---|---|---|\n${rows.join('\n')}\n\n6题 /api/guide 未执行，6题建议与资格均待人工复核。逐题准确原文、来源、版本、定位见 query-report.json。历史引用按编号单独读取，不等于对当前办理地有效。\n`,
  );
  console.log(JSON.stringify(report.summary));
  const reviewSections = result.results
    .filter((r) => r.input)
    .map((r) => {
      const expected = suite.cases.find((c: any) => c.id === r.id);
      const evidence = r.supportingEvidence.map(
        (h) =>
          `- ${h.clause.id}@${h.clause.version}；${h.source.locator}；[${h.document.title}](${h.source.url})\n\n${h.source.quote
            .split('\n')
            .map((s) => (s ? '> ' + s.trimEnd() : '>'))
            .join('\n')}`,
      );
      return `## ${r.id}\n\n输入：${r.input.text}\n\n地区：${r.query.regionCode}；查询日：${r.query.asOf}。\n\n固定候选：${expected.expectedCandidateReferences.join('、')}。\n\n建议预期（待核）：${expected.expectedGuide.nextStep}\n\n状态预期（待核）：${expected.expectedGuide.status}。\n\n${evidence.join('\n\n')}\n\n人工核对：未核对；建议有依据 □；资格判断正确 □；核对人/日期：待填。\n`;
    });
  await writeFile(
    root + 'CASE_REVIEW.md',
    '# 核心六题与准确原文\n\n只记录开发联调预期，不表示审核通过。候选集是事项/地区/日期的全部候选，支持引用是人工选择的子集；旧通知按编号取原文，不冒充当前适用政策。\n\n' +
      reviewSections.join('\n'),
  );
  if (checks.some((c) => !c.pass)) process.exitCode = 1;
} finally {
  await project.end();
}
