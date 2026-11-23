import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Pool } from 'mysql2/promise';
import {
  compareImpact,
  executeImpactCase,
  type ImpactHit,
  type ImpactResult,
} from '../src/impact-preview.js';
import { impactSuiteSchema } from '../src/impact-cases.js';
import { parseBatch, checksum } from '../src/model.js';
const batch = parseBatch(
  JSON.parse(await readFile('../data/impact/longyang-monthly/baseline.demo.json', 'utf8')),
);
const clause = batch.clauses[0]!,
  document = batch.documents[0]!;
const hit: ImpactHit = {
  id: clause.id,
  version: 1,
  category: 'monthly',
  clause: { ...clause, reviewStatus: 'approved' },
  source: {
    clauseId: clause.id,
    clauseVersion: 1,
    documentId: document.id,
    documentVersion: 1,
    title: document.title,
    quote: clause.quote,
    locator: clause.locator,
    url: document.sourceUrl,
  },
  document: {
    id: document.id,
    version: 1,
    title: document.title,
    publisher: document.publisher,
    url: document.sourceUrl,
    publishedAt: document.publishedAt,
  },
  clauseChecksum: checksum(clause),
  documentChecksum: checksum(document),
  timeStatus: 'needs_review',
  unknownEnd: true,
};
const result = (hits: ImpactHit[]): ImpactResult => ({
  executed: true,
  status: hits.length ? 'matched' : 'no_match',
  missing: [],
  parameters: {},
  hits,
});
test('影响对比按稳定编号排序，命中顺序变化不算更新', () => {
  const second = { ...structuredClone(hit), id: 'SECOND', clause: { ...hit.clause, id: 'SECOND' } };
  const diff = compareImpact(result([hit, second]), result([second, hit]));
  assert.equal(diff.changed, false);
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.fieldsChanged, []);
});
test('新增、减少、同编号版本变化分别记录，字段可追溯', () => {
  const v2 = structuredClone(hit);
  v2.version = 2;
  v2.clause.version = 2;
  v2.clause.locator += '（技术定位校对）';
  const added = { ...structuredClone(hit), id: 'ADDED' },
    removed = { ...structuredClone(hit), id: 'REMOVED' };
  const diff = compareImpact(result([hit, removed]), result([v2, added]));
  assert.deepEqual(diff.added, ['ADDED']);
  assert.deepEqual(diff.removed, ['REMOVED']);
  assert.deepEqual(diff.versionChanged, [{ id: hit.id, before: 1, after: 2 }]);
  assert.ok(diff.fieldsChanged[0]!.fields.includes('clause.locator'));
});
test('来源变化也算依据变化；不把相同条款编号当成内容相同', () => {
  const updated = structuredClone(hit);
  updated.document.version = 2;
  updated.documentChecksum = 'changed';
  const diff = compareImpact(result([hit]), result([updated]));
  assert.equal(diff.changed, true);
  assert.equal(diff.versionChanged.length, 0);
  assert.ok(diff.fieldsChanged[0]!.fields.includes('document.version'));
});
test('未给月份的用例不查询、不拿一条月报回答当前统一金额', async () => {
  const db = new Proxy({} as Pool, {
    get() {
      throw new Error('不应访问数据库');
    },
  });
  const c = impactSuiteSchema.parse({
    version: 'test',
    cases: [
      {
        id: 'missing',
        queryType: 'payment',
        matterId: 'HIGH_AGE_ALLOWANCE',
        regionCode: '530502',
        recordMonth: null,
        ageBandCode: '100_PLUS',
      },
    ],
  }).cases[0]!;
  const r = await executeImpactCase(db, c, '2026-11-19');
  assert.equal(r.executed, false);
  assert.equal(r.status, 'needs_parameter');
  assert.deepEqual(r.hits, []);
  assert.deepEqual(r.missing, ['recordMonth']);
});
test('用例读取校验拒绝重复编号、空集和非法月份', () => {
  assert.throws(() => impactSuiteSchema.parse({ version: 't', cases: [] }));
  assert.throws(
    () => impactSuiteSchema.parse({ version: 't', cases: [{ id: 'same' }, { id: 'same' }] }),
    /案例编号重复/,
  );
  assert.throws(
    () => impactSuiteSchema.parse({ version: 't', cases: [{ id: 'bad', recordMonth: '2026-13' }] }),
    /recordMonth/,
  );
});
