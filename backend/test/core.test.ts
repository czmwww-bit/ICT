import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseBatch, validateLinks, checksum, type Stored, type Clause } from '../src/model.js';
import { planImport, type Publication } from '../src/store.js';
import { findInSnapshot, getInSnapshot, type Snapshot } from '../src/query.js';
import {
  suiteSchema,
  checkOutput,
  callGuide,
  catalogEntry,
  type Catalog,
} from '../src/evaluation.js';
import { startMock } from './mock-guide.js';
const batch = parseBatch(JSON.parse(await readFile('../data/demo/batch.json', 'utf8')));
const versions: Stored[] = [
  ...batch.documents.map((data) => ({ kind: 'document' as const, data, checksum: checksum(data) })),
  ...batch.clauses.map((data) => ({ kind: 'clause' as const, data, checksum: checksum(data) })),
];
const events: Publication[] = versions.map((s, i) => ({
  sequence_id: i + 1,
  kind: s.kind,
  id: s.data.id,
  version: s.data.version,
  decision: 'approved',
  actor: '工具测试',
  reason: '仅单元夹具',
  reviewed_at: '2026-11-16',
}));
const snapshot: Snapshot = { versions, regions: batch.regions, events };
test('样例完整校验与日期、字段错误定位', () => {
  assert.deepEqual(validateLinks(batch), []);
  assert.throws(
    () =>
      parseBatch(
        { ...batch, documents: [{ ...batch.documents[0], publishedAt: '2026-02-30' }] },
        'bad.json',
      ),
    /bad.json: documents.0.publishedAt/,
  );
  assert.throws(
    () => parseBatch({ ...batch, clauses: [{ ...batch.clauses[0], contacts: 'x' }] }),
    /clauses.0.contacts/,
  );
});
test('引用、区域、替代依据均可追溯，禁止坏关联', () => {
  const b = structuredClone(batch);
  b.clauses[0]!.documentId = 'UNKNOWN';
  b.clauses[1]!.relations[0]!.evidence.quote = '无依据';
  b.regions[0]!.parentCode = 'DEMO_A';
  assert.ok(validateLinks(b).some((e) => e.includes('documentVersion')));
  assert.ok(validateLinks(b).some((e) => e.includes('relations.evidence')));
  assert.ok(validateLinks(b).some((e) => e.includes('循环')));
});
test('导入计划幂等、陈旧版本冲突、新版本一律待审核', () => {
  assert.equal(planImport(batch, versions, batch.regions, true).unchanged, 6);
  const b = structuredClone(batch);
  b.clauses[0]!.locator = '改变';
  assert.ok(planImport(b, versions, batch.regions, true).errors);
  const p = structuredClone(batch);
  p.documents[0]!.reviewStatus = 'approved';
  assert.ok(planImport(p, [], [], true).messages.some((e) => e.includes('独立审核')));
  assert.ok(planImport(batch, [], [], false).messages.some((e) => e.includes('--allow-demo')));
});
test('默认隔离样例、草稿、拒绝版本，显式地区祖先匹配', () => {
  const input = { matterId: 'DEMO_ALLOWANCE', regionCode: 'DEMO_A', asOf: '2026-11-16' };
  assert.equal(findInSnapshot(snapshot, input).length, 0);
  assert.equal(
    findInSnapshot({ ...snapshot, events: [] }, { ...input, includeDemo: true }).length,
    0,
  );
  assert.equal(findInSnapshot(snapshot, { ...input, includeDemo: true }).length, 3);
  assert.equal(
    findInSnapshot(snapshot, { ...input, regionCode: 'DEMO_A_TOWN', includeDemo: true }).length,
    3,
  );
  assert.equal(
    findInSnapshot(snapshot, { ...input, regionCode: 'DEMO_B', includeDemo: true }).length,
    0,
  );
  assert.equal(
    findInSnapshot(snapshot, { ...input, regionCode: 'DEMO_CITY', includeDemo: true }).length,
    0,
  );
  assert.equal(
    findInSnapshot(snapshot, { ...input, regionCode: 'UNKNOWN', includeDemo: true }).length,
    0,
  );
});
test('日期边界、未知日期与原文链接；保留相互冲突证据', () => {
  const input = { matterId: 'DEMO_ALLOWANCE', regionCode: 'DEMO_A', includeDemo: true };
  assert.equal(findInSnapshot(snapshot, { ...input, asOf: '2026-12-31' }).length, 3);
  assert.equal(findInSnapshot(snapshot, { ...input, asOf: '2027-01-01' }).length, 2);
  const c = getInSnapshot(snapshot, 'DEMO_C3', { includeDemo: true })[0]!;
  assert.equal(c.timeStatus, 'needs_review');
  assert.equal(c.source.url, 'https://example.invalid/DEMO_D3');
  assert.ok(c.source.quote.includes('虚构'));
  assert.equal(
    getInSnapshot(snapshot, 'DEMO_C2', { includeDemo: true })[0]!.relations[0]!.targetClauseId,
    'DEMO_C1',
  );
});
test('后续草稿不遮蔽已发布版本，历史版本需显式读取', () => {
  const c = structuredClone(batch.clauses[0]!) as Clause;
  c.version = 2;
  c.expectedVersion = 1;
  const s: Snapshot = {
    ...snapshot,
    versions: [...versions, { kind: 'clause', data: c, checksum: checksum(c) }],
  };
  assert.equal(getInSnapshot(s, c.id, { includeDemo: true })[0]!.clause.version, 1);
  s.events = [...events, { ...events[0]!, kind: 'clause', id: c.id, version: 2, sequence_id: 99 }];
  assert.equal(getInSnapshot(s, c.id, { includeDemo: true })[0]!.clause.version, 2);
  assert.equal(getInSnapshot(s, c.id, { includeDemo: true, includeHistory: true }).length, 2);
  assert.throws(() => getInSnapshot(s, c.id, { version: 1, includeDemo: true }), /includeHistory/);
  s.events.push({ ...s.events.at(-1)!, sequence_id: 100, decision: 'rejected' });
  assert.equal(getInSnapshot(s, c.id, { includeDemo: true }).length, 0, '撤回不静默回退旧版本');
  s.events.push({
    ...events.find((e) => e.kind === 'clause' && e.id === c.id)!,
    sequence_id: 101,
    reason: '明确恢复旧版本',
  });
  assert.equal(getInSnapshot(s, c.id, { includeDemo: true })[0]!.clause.version, 1);
});
test('评测 HTTP 自测识别错误引用、500 和超时', async () => {
  const suite = suiteSchema.parse(JSON.parse(await readFile('../eval/demo/cases.json', 'utf8')));
  const catalog: Catalog = new Map(
    batch.clauses.map((c) => {
      const d = batch.documents.find((d) => d.id === c.documentId)!;
      return [
        `${c.id}@1`,
        catalogEntry(
          { quote: c.quote, url: d.sourceUrl, title: d.title },
          c.regionCodes,
          batch.regions,
        ),
      ];
    }),
  );
  const mock = await startMock(suite.cases, catalog);
  try {
    const good = await callGuide(mock.url, suite.cases[0]!, 1000);
    assert.ok(checkOutput(suite.cases[0]!, good, catalog).every((c) => c.status === 'pass'));
    assert.equal(
      checkOutput(suite.cases[0]!, { ...good, sources: [] }, catalog).find(
        (c) => c.name === 'citation_validity',
      )!.status,
      'fail',
      '缺少引用不能算引文核验通过',
    );
    const bad = await callGuide(mock.url, suite.cases[10]!, 1000);
    assert.ok(
      checkOutput(suite.cases[10]!, bad, catalog).some(
        (c) => c.name === 'citation_validity' && c.status === 'fail',
      ),
    );
    await assert.rejects(callGuide(mock.url, suite.cases[11]!, 1000), /HTTP 500/);
    await assert.rejects(callGuide(mock.url, suite.cases[12]!, 50));
  } finally {
    await mock.close();
  }
});

test('评测按显式区域树核验ready引用，邻区不能计为匹配', async () => {
  const suite = suiteSchema.parse(JSON.parse(await readFile('../eval/demo/cases.json', 'utf8')));
  const c = structuredClone(suite.cases[0]!);
  const clause = batch.clauses[1]!,
    document = batch.documents[1]!;
  const entry = catalogEntry(
    { quote: clause.quote, url: document.sourceUrl, title: document.title },
    clause.regionCodes,
    batch.regions,
  );
  const catalog: Catalog = new Map([[`${clause.id}@1`, entry]]);
  const actual = {
    status: 'ready',
    nextStep: '按示例条款提交申请',
    materials: ['身份证', '示例登记表'],
    sources: [{ clauseId: clause.id, clauseVersion: 1, ...entry }],
  };
  c.input.region = 'DEMO_A_TOWN';
  assert.equal(
    checkOutput(c, actual, catalog).find((c) => c.name === 'region_match')!.status,
    'pass',
  );
  c.input.region = 'DEMO_B';
  assert.equal(
    checkOutput(c, actual, catalog).find((c) => c.name === 'region_match')!.status,
    'fail',
  );
});
