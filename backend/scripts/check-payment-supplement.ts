import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { withPaymentPreview, supplementRoot as root } from '../examples/payment-preview.js';
import { findPaymentRecords } from '../src/payment-records.js';
import { findCandidates, getClause } from '../src/query.js';
import { importBatch } from '../src/store.js';
import { pool } from '../src/db.js';
import { evidenceDigest, canonical } from '../src/backup.js';
import { parseBatch } from '../src/model.js';
const { values } = parseArgs({ options: { isolated: { type: 'boolean' } } });
if (!values.isolated) throw new Error('请明确 --isolated，拒绝改正式库');
const commands = [];
const project = await pool();
let unchanged = false;
try {
  const before = await evidenceDigest(project);
  for (const command of ['validate', 'import']) {
    const args = [
      '--import',
      'tsx',
      'src/cli.ts',
      command,
      '--file',
      root + 'batch.draft.json',
      ...(command === 'import' ? ['--dry-run'] : []),
    ];
    const p = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true });
    commands.push({
      command: 'node ' + args.join(' '),
      exitCode: p.status,
      output: p.stdout,
      error: p.stderr,
    });
    if (p.status !== 0) throw new Error('现有CLI预检查失败，未执行隔离导入');
  }
  const dry = await importBatch(
    project,
    parseBatch(JSON.parse(await readFile(root + 'batch.draft.json', 'utf8'))),
    { dryRun: true },
  );
  unchanged = canonical(before) === canonical(await evidenceDigest(project));
  await writeFile(
    root + 'precheck.json',
    JSON.stringify(
      {
        executedAt: new Date().toISOString(),
        commands,
        plan: dry,
        databaseUnchanged: unchanged,
        imported: false,
        published: false,
      },
      null,
      2,
    ) + '\n',
  );
  if (!unchanged || dry.errors) throw new Error('只读预检查未通过');
} finally {
  await project.end();
}
const checks: { name: string; passed: boolean; expected?: unknown; actual?: unknown }[] = [];
const report = await withPaymentPreview(async (db) => {
  const observations = [];
  const base = {
    matterId: 'HIGH_AGE_ALLOWANCE',
    regionCode: '530502',
    recordMonth: '2026-01',
    ageBandCode: '100_PLUS',
    asOf: '2026-11-19',
  };
  for (const [region, month, expectedRate] of [
    ['530502', '2026-01', 350],
    ['530502', '2026-02', 350],
    ['530502', '2026-08', 1000],
    ['530502', '2026-09', 1000],
    ['530521', '2026-02', 1000],
    ['530502', '2026-03', null],
    ['530502', '2026-11', null],
    ['UNKNOWN_REGION', '2026-09', null],
  ] as const) {
    const result = await findPaymentRecords(db, {
      ...base,
      regionCode: region,
      recordMonth: month,
    });
    const actual = result.monthly.map((h) => h.clause.paymentRecord!.amountYuanPerPersonMonth);
    const expected = expectedRate === null ? [] : [expectedRate];
    checks.push({
      name: region + '_' + month,
      passed: canonical(actual) === canonical(expected),
      expected,
      actual,
    });
    checks.push({
      name: 'source_and_period_' + region + '_' + month,
      passed: result.monthly.every(
        (h) =>
          h.clause.paymentRecord!.fromMonth === month &&
          h.clause.paymentRecord!.toMonth === month &&
          h.clause.effectiveFrom === null &&
          h.document.originalText.includes(h.source.quote) &&
          Boolean(h.source.locator && h.source.url) &&
          h.clause.regionCodes.includes(region),
      ),
    });
    observations.push({ input: { ...base, regionCode: region, recordMonth: month }, result });
  }
  const may = await findPaymentRecords(db, { ...base, recordMonth: '2026-05' });
  checks.push({
    name: 'quarterly_is_context_not_monthly',
    passed: may.monthly.length === 0 && may.periodContext.length === 1,
  });
  const econ = await findPaymentRecords(db, {
    ...base,
    matterId: 'ECONOMIC_ELDERLY_SERVICE',
    ageBandCode: 'UNSPECIFIED',
    recordMonth: '2026-09',
  });
  checks.push({
    name: 'unknown_statistical_year_retained',
    passed: econ.monthly.length === 0 && econ.unresolvedPeriod.length === 1,
  });
  for (const [day, count] of [
    ['2025-12-31', 0],
    ['2026-01-01', 3],
  ] as const) {
    const actual = await findCandidates(db, {
      matterId: 'ELDERLY_PREFERENTIAL_CREDENTIAL',
      regionCode: '530502',
      asOf: day,
    });
    checks.push({
      name: 'card_effective_' + day,
      passed: actual.length === count,
      expected: count,
      actual: actual.length,
    });
  }
  const flowIds = [
    'YN_GLT_AUTO_PROCESS',
    'LY_GLT_2026Q2_APPLICATION_NOTE',
    'LY_MZ_ELDERLY_CONTACT',
  ];
  const flowEvidence = [];
  for (const id of flowIds)
    flowEvidence.push(...(await getClause(db, id, { version: 1, includeHistory: true })));
  checks.push({
    name: 'conflicting_flow_evidence_and_official_contact',
    passed:
      flowEvidence.length === 3 &&
      flowEvidence.some((h) => h.clause.contacts?.some((e) => e.text.includes('0875-2229150'))),
  });
  return { observations, quarterlyContext: may, unresolvedPeriod: econ, flowEvidence };
});
const files = [
  'src/model.ts',
  'src/query.ts',
  'src/payment-records.ts',
  'scripts/check-payment-supplement.ts',
];
const codeHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (f) => [
      f,
      createHash('sha256')
        .update(await readFile(f))
        .digest('hex'),
    ]),
  ),
);
const final = {
  executedAt: new Date().toISOString(),
  codeHashes,
  precheckDatabaseUnchanged: unchanged,
  ...report,
  checks,
  summary: {
    passed: checks.filter((c) => c.passed).length,
    total: checks.length,
    failed: checks.filter((c) => !c.passed).length,
  },
  businessGuideEvaluation: 'not_executed',
  manualPolicyReview: 'pending',
};
await writeFile(root + 'isolated-report.json', JSON.stringify(final, null, 2) + '\n');
console.log(
  JSON.stringify({
    summary: final.summary,
    projectDatabaseUnchanged: report.projectDatabaseUnchanged,
    testTablesCleaned: report.testTablesCleaned,
  }),
);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
