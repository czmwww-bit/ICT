import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { runImpactPreview } from '../src/impact-preview.js';
import { pool, rows } from '../src/db.js';
import { evidenceDigest, canonical } from '../src/backup.js';
import { parseBatch } from '../src/model.js';
const root = '../data/impact/longyang-monthly/';
test('真实MySQL影响预览：版本、日期、地区、失败清理和项目库7表无写入', async () => {
  const db = await pool();
  const before = await evidenceDigest(db);
  const checks: { name: string; passed: boolean }[] = [];
  const verify = (name: string, ok: boolean) => {
    assert.ok(ok, name);
    checks.push({ name, passed: true });
  };
  try {
    const baseline = JSON.parse(await readFile(root + 'baseline.demo.json', 'utf8'));
    const update = JSON.parse(await readFile(root + 'update.draft.json', 'utf8'));
    const original = parseBatch(
      JSON.parse(
        await readFile(
          '../data/official/longyang-pilot/supplement-2026-11-19/batch.draft.json',
          'utf8',
        ),
      ),
    );
    const febV2 = structuredClone(baseline.clauses[0]);
    febV2.version = 2;
    febV2.expectedVersion = 1;
    febV2.locator += '（仅隔离技术定位校对，不代表政策变更）';
    const cardId = 'YN_ELDER_ID_REPLACES_CARD_2025_5';
    const proposed = {
      ...update,
      documents: [...update.documents, ...original.documents.filter((d) => d.id === cardId)],
      clauses: [
        ...update.clauses,
        febV2,
        ...original.clauses.filter((c) => c.documentId === cardId),
      ],
    };
    const common = {
      queryType: 'payment',
      matterId: 'HIGH_AGE_ALLOWANCE',
      regionCode: '530502',
      recordMonth: '2026-02',
      ageBandCode: '100_PLUS',
      asOf: '2026-11-19',
    };
    const suite = {
      version: 'impact-technical-regression-v1',
      cases: [
        {
          id: 'version',
          ...common,
          expectedBefore: ['BS_GLT_202602_LY_100PLUS@1'],
          expectedAfter: ['BS_GLT_202602_LY_100PLUS@2'],
        },
        { id: 'neighbor', ...common, regionCode: '530521', expectedBefore: [], expectedAfter: [] },
        {
          id: 'before_date',
          matterId: 'ELDERLY_PREFERENTIAL_CREDENTIAL',
          regionCode: '530502',
          asOf: '2025-12-31',
          expectedBefore: [],
          expectedAfter: [],
        },
        {
          id: 'on_date',
          matterId: 'ELDERLY_PREFERENTIAL_CREDENTIAL',
          regionCode: '530502',
          asOf: '2026-01-01',
          expectedBefore: [],
          expectedAfter: [
            'YN_ELDER_CARD_STOP_NEW@1',
            'YN_ELDER_CARD_OLD_VALID@1',
            'YN_ELDER_CARD_ID_60PLUS@1',
          ],
        },
        {
          id: 'missing_month',
          ...common,
          recordMonth: null,
          expectedBefore: [],
          expectedAfter: [],
        },
      ],
    };
    const preview = await runImpactPreview(db, {
      batch: proposed,
      suite,
      demoBaseline: baseline,
      previewDate: '2026-11-19',
    });
    verify('same_parameters_and_expected_hits', preview.summary.expectationFailures === 0);
    verify(
      'stable_id_version_change',
      preview.results[0].diff.versionChanged[0].before === 1 &&
        preview.results[0].diff.versionChanged[0].after === 2,
    );
    verify(
      'neighbor_isolation',
      preview.results[1].diff.changed === false && preview.results[1].after.hits.length === 0,
    );
    verify('effective_day_before_excluded', preview.results[2].after.hits.length === 0);
    verify('effective_day_included', preview.results[3].after.hits.length === 3);
    verify('current_snapshot_exactly_replayed', preview.baselineReplayVerified === true);
    verify(
      'missing_month_not_counted_as_query_or_pass',
      preview.summary.executedQueryPairs === 4 &&
        preview.summary.needsParameters === 1 &&
        preview.results[4].expectations.every((e: any) => e.status === 'not_executed'),
    );
    verify('successful_test_tables_cleaned', preview.testTablesCleaned === true);
    verify('source_digest_unchanged_success', preview.sourceDatabaseUnchanged === true);
    const invalid = structuredClone(update);
    invalid.clauses[0].quote = '不在来源文件中的非法原文';
    await assert.rejects(
      runImpactPreview(db, {
        batch: invalid,
        suite,
        demoBaseline: baseline,
        previewDate: '2026-11-19',
      }),
      /导入校验失败/,
    );
    verify('invalid_batch_reports_failure', true);
    const testDb = await pool(true, process.env.DB_TEST_NAME!);
    try {
      verify('invalid_batch_test_tables_cleaned', (await rows(testDb, 'SHOW TABLES')).length === 0);
    } finally {
      await testDb.end();
    }
    const testName = process.env.DB_TEST_NAME;
    try {
      process.env.DB_TEST_NAME = process.env.DB_NAME;
      await assert.rejects(
        runImpactPreview(db, {
          batch: update,
          suite,
          demoBaseline: baseline,
          previewDate: '2026-11-19',
        }),
        /需要不同于项目库/,
      );
      verify('refuse_source_as_isolation_database', true);
    } finally {
      if (testName === undefined) delete process.env.DB_TEST_NAME;
      else process.env.DB_TEST_NAME = testName;
    }
    verify(
      'source_digest_unchanged_after_failures',
      canonical(before) === canonical(await evidenceDigest(db)),
    );
    const report = {
      executedAt: new Date().toISOString(),
      checks,
      passed: checks.length,
      failed: 0,
      versionFixture: '仅修改定位的技术校对版本，原政策金额未改',
      sourceDatabaseUnchanged: true,
      preview,
    };
    await mkdir('../reports/local', { recursive: true });
    await writeFile(
      '../reports/policy-impact-verification.json',
      JSON.stringify(report, null, 2) + '\n',
    );
  } finally {
    await db.end();
  }
});
