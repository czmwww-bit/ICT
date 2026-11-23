import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseBatch, checksum, validateLinks, type Stored } from '../src/model.js';
import { paymentRecordsInSnapshot } from '../src/payment-records.js';
import { findInSnapshot, type Snapshot } from '../src/query.js';
import type { Publication } from '../src/store.js';
const root = '../data/official/longyang-pilot/supplement-2026-11-19/';
const raw = JSON.parse(await readFile(root + 'batch.draft.json', 'utf8')),
  batch = parseBatch(raw);
const versions: Stored[] = [
  ...batch.documents.map((data) => ({ kind: 'document' as const, data, checksum: checksum(data) })),
  ...batch.clauses.map((data) => ({ kind: 'clause' as const, data, checksum: checksum(data) })),
];
const events: Publication[] = versions.map((v, i) => ({
  sequence_id: i + 1,
  kind: v.kind,
  id: v.data.id,
  version: v.data.version,
  decision: 'approved',
  actor: '单元技术夹具，非政策审核',
  reason: '仅验证过滤',
  reviewed_at: '2026-11-19',
}));
const snapshot: Snapshot = { versions, regions: batch.regions, events };
const input = {
  matterId: 'HIGH_AGE_ALLOWANCE',
  regionCode: '530502',
  recordMonth: '2026-01',
  ageBandCode: '100_PLUS',
  asOf: '2026-11-19',
};
test('月度记录按月份和区县读取，不用最新月份覆盖旧月或邻区', () => {
  for (const [month, rate] of [
    ['2026-01', 350],
    ['2026-02', 350],
    ['2026-08', 1000],
    ['2026-09', 1000],
  ] as const) {
    const r = paymentRecordsInSnapshot(snapshot, { ...input, recordMonth: month });
    assert.equal(r.monthly.length, 1);
    assert.equal(r.monthly[0]!.clause.paymentRecord!.amountYuanPerPersonMonth, rate);
    assert.equal(r.monthly[0]!.clause.effectiveFrom, null);
  }
  assert.equal(
    paymentRecordsInSnapshot(snapshot, { ...input, regionCode: '530521', recordMonth: '2026-02' })
      .monthly[0]!.clause.paymentRecord!.amountYuanPerPersonMonth,
    1000,
  );
  for (const month of ['2026-03', '2026-11'])
    assert.equal(
      paymentRecordsInSnapshot(snapshot, { ...input, recordMonth: month }).monthly.length,
      0,
    );
  assert.equal(
    paymentRecordsInSnapshot(snapshot, { ...input, regionCode: 'UNKNOWN_REGION' }).monthly.length,
    0,
  );
});
test('季度备注与月报分开，未知统计年度保留待核，不拿公开年补齐', () => {
  const may = paymentRecordsInSnapshot(snapshot, { ...input, recordMonth: '2026-05' });
  assert.equal(may.monthly.length, 0);
  assert.equal(may.periodContext.length, 1);
  const econ = paymentRecordsInSnapshot(snapshot, {
    ...input,
    matterId: 'ECONOMIC_ELDERLY_SERVICE',
    ageBandCode: 'UNSPECIFIED',
    recordMonth: '2026-09',
  });
  assert.equal(econ.monthly.length, 0);
  assert.equal(econ.unresolvedPeriod.length, 1);
  assert.equal(econ.unresolvedPeriod[0]!.clause.paymentRecord!.recipientCount, 2555);
  assert.equal(econ.unresolvedPeriod[0]!.clause.paymentRecord!.amountYuanPerPersonMonth, 50);
});
test('月份参数必填、合法且不默认最新；未审核的记录不进入查询', () => {
  for (const month of [undefined, '', '2026-13', '2026-9'])
    assert.throws(() =>
      paymentRecordsInSnapshot(snapshot, { ...input, recordMonth: month as string }),
    );
  assert.equal(paymentRecordsInSnapshot({ ...snapshot, events: [] }, input).monthly.length, 0);
  const clauseEvents = events.filter((e) => e.kind === 'clause');
  assert.equal(
    paymentRecordsInSnapshot({ ...snapshot, events: clauseEvents }, input).monthly.length,
    0,
  );
});
test('新增可选字段不改旧条款校验值；发放月不可伪填生效日，依据可定位', async () => {
  const oldRaw = JSON.parse(
    await readFile('../data/official/longyang-pilot/batch.draft.json', 'utf8'),
  );
  const old = parseBatch(oldRaw);
  for (let i = 0; i < old.clauses.length; i++) {
    assert.equal(Object.hasOwn(old.clauses[i]!, 'paymentRecord'), false);
    assert.equal(checksum(old.clauses[i]!), checksum(oldRaw.clauses[i]));
  }
  const changed = structuredClone(raw);
  const c = changed.clauses.find((x: any) => x.paymentRecord);
  c.effectiveFrom = '2026-01-01';
  c.effectiveFromEvidence = c.paymentRecord.periodEvidence;
  assert.ok(validateLinks(parseBatch(changed)).some((e) => e.includes('发放记录不可填作')));
  c.effectiveFrom = null;
  c.effectiveFromEvidence = null;
  c.paymentRecord.evidence.quote = '不存在的原文';
  assert.ok(
    validateLinks(parseBatch(changed)).some((e) => e.includes('paymentRecord.evidence.quote')),
  );
  c.paymentRecord.fromMonth = '2026-02';
  c.paymentRecord.toMonth = '2026-01';
  assert.throws(() => parseBatch(changed), /toMonth/);
});
test('优待凭证生效日与转载日分开，施行前不返回后续条款', () => {
  const query = { matterId: 'ELDERLY_PREFERENTIAL_CREDENTIAL', regionCode: '530502' };
  assert.equal(findInSnapshot(snapshot, { ...query, asOf: '2025-12-31' }).length, 0);
  const hits = findInSnapshot(snapshot, { ...query, asOf: '2026-01-01' });
  assert.equal(hits.length, 3);
  assert.ok(
    hits.every(
      (h) => h.document.publishedAt === '2026-01-22' && h.clause.effectiveFrom === '2026-01-01',
    ),
  );
});
