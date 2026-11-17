// 医保资料只在本机隔离空库做技术演示；原JSON和项目库不导入/发布。
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { initialize, migrate, pool } from '../src/db.js';
import { parseBatch, date } from '../src/model.js';
import { importBatch, publish } from '../src/store.js';
import { findCandidates, getClause } from '../src/query.js';
import { withEmptyTestDatabase } from '../src/test-sandbox.js';
import { canonical, evidenceDigest } from '../src/backup.js';
const { values } = parseArgs({
  options: {
    isolated: { type: 'boolean' },
    matter: { type: 'string', default: 'YB_FAMILY_QUERY' },
    region: { type: 'string', default: '530502' },
    date: { type: 'string', default: '2026-11-17' },
    id: { type: 'string' },
    version: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!values.isolated) throw Error('医保资料待人工审核；请明确--isolated，不能用演示发布项目库');
date.parse(values.date);
if (values.version && (!Number.isSafeInteger(Number(values.version)) || Number(values.version) < 1))
  throw Error('版本必须为正整数');
const project = await pool();
try {
  const before = await evidenceDigest(project);
  const result = await withEmptyTestDatabase(async (db) => {
    await initialize();
    await migrate(db);
    const raw = JSON.parse(
      await readFile('../data/official/yunnan-medical-insurance/batch.draft.json', 'utf8'),
    );
    const batch = parseBatch(structuredClone(raw));
    assert.ok(batch.documents.every((d) => d.reviewStatus === 'draft' && d.checkedBy === null));
    for (const d of batch.documents) {
      d.checkedBy = '隔离技术预览，非政策审核';
      d.checkedAt = '2026-11-17';
    }
    assert.equal((await importBatch(db, batch)).errors, 0);
    assert.equal(
      (
        await findCandidates(db, {
          matterId: values.matter!,
          regionCode: values.region!,
          asOf: values.date!,
        })
      ).length,
      0,
      '草稿不得进入正式查询',
    );
    assert.equal(
      (await importBatch(db, batch)).unchanged,
      batch.documents.length + batch.clauses.length,
      '重复导入幂等',
    );
    for (const d of batch.documents)
      await publish(db, 'document', d.id, 1, '技术演示', '隔离库临时审核事件，不表示真实政策审核');
    for (const c of batch.clauses)
      await publish(db, 'clause', c.id, 1, '技术演示', '隔离库临时审核事件，不表示真实政策审核');
    const checks: { name: string; passed: boolean }[] = [
      { name: 'draft_excluded', passed: true },
      { name: 'duplicate_import_idempotent', passed: true },
    ];
    const verify = (name: string, passed: boolean) => {
      assert.ok(passed, name);
      checks.push({ name, passed });
    };
    const lookup = (matterId: string, regionCode: string, asOf: string) =>
      findCandidates(db, { matterId, regionCode, asOf });
    const local = await lookup('YB_FAMILY_QUERY', '530502', '2026-11-17');
    verify(
      'explicit_ancestor_scope',
      local.some((h) => h.clause.id === 'BS_YB_FAMILY_QUERY_RECORDS') &&
        local.some((h) => h.clause.id === 'YN_YB_FAMILY_QUERY_ENTRY'),
    );
    verify(
      'neighbor_excludes_baoshan_evidence',
      !(await lookup('YB_FAMILY_QUERY', '530400', '2026-11-17')).some(
        (h) => h.clause.id === 'BS_YB_FAMILY_QUERY_RECORDS',
      ),
    );
    verify(
      'unknown_region_empty',
      (await lookup('YB_FAMILY_QUERY', 'UNKNOWN_REGION', '2026-11-17')).length === 0,
    );
    for (const [asOf, expected] of [
      ['2024-10-31', false],
      ['2024-11-01', true],
    ] as const)
      verify(
        'formal_effective_' + asOf,
        (await lookup('YB_FAMILY_BINDING', '530502', asOf)).some(
          (h) => h.clause.id === 'YN_YB_FAMILY_POLICY_PURPOSE',
        ) === expected,
      );
    for (const [asOf, expected] of [
      ['2026-10-09', false],
      ['2026-10-10', true],
      ['2027-01-31', true],
      ['2027-02-01', false],
    ] as const)
      verify(
        'payment_window_' + asOf,
        (await lookup('YB_RESIDENT_PAYMENT', '530502', asOf)).some(
          (h) => h.clause.id === 'YN_YB_PAYMENT_2027_WINDOW',
        ) === expected,
      );
    verify(
      'exact_reference_version',
      (await getClause(db, 'BS_YB_FAMILY_QUERY_RECORDS', { version: 1, includeHistory: true }))[0]
        ?.clause.version === 1,
    );
    verify(
      'absent_version_empty',
      (await getClause(db, 'BS_YB_FAMILY_QUERY_RECORDS', { version: 2, includeHistory: true }))
        .length === 0,
    );
    verify(
      'unknown_effective_date_flag',
      local.some((h) => h.timeStatus === 'needs_review'),
    );
    const hits = values.id
      ? await getClause(db, values.id, {
          version: values.version ? Number(values.version) : undefined,
          includeHistory: values.version !== undefined,
        })
      : await findCandidates(db, {
          matterId: values.matter!,
          regionCode: values.region!,
          asOf: values.date!,
        });
    const metadata = JSON.parse(
      await readFile('../data/official/yunnan-medical-insurance/document-metadata.json', 'utf8'),
    ) as { documentId: string; warnings: string[] }[];
    const nav = JSON.parse(
      await readFile('../data/official/yunnan-medical-insurance/navigation.entries.json', 'utf8'),
    ) as { entries: { matterId: string }[] };
    return {
      integrityChecks: checks,
      status: !hits.length
        ? 'no_match'
        : hits.some((h) => h.timeStatus === 'needs_review')
          ? 'needs_review'
          : 'matched',
      dataOnly: true,
      input: {
        matter: values.matter,
        region: values.region,
        date: values.date,
        id: values.id,
        version: values.version,
      },
      count: hits.length,
      candidates: hits.map((h) => ({
        ...h,
        reviewWarnings: metadata.find((m) => m.documentId === h.document.id)?.warnings ?? [],
      })),
      pendingNavigationHints: nav.entries.filter((e) => e.matterId === values.matter),
      note: '候选不是资格或办理结果。截图入口和术语解释仍待实机/人工核对，不能把入口存在当成已绑定。',
    };
  });
  assert.equal(
    canonical(before),
    canonical(await evidenceDigest(project)),
    '项目库前后摘要必须相同',
  );
  const report = {
    scope: 'isolated_technical_preview',
    humanPolicyApproved: false,
    projectDatabaseUnchanged: true,
    testTablesCleaned: true,
    result,
  };
  if (values.out) {
    await writeFile(values.out, JSON.stringify(report, null, 2) + '\n');
    console.log(
      JSON.stringify({
        report: values.out,
        status: result.status,
        count: result.count,
        projectDatabaseUnchanged: true,
      }),
    );
  } else console.log(JSON.stringify(report, null, 2));
} finally {
  await project.end();
}
