import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseBatch, validateLinks } from '../src/model.js';

test('条款日期依据可定位同一文件其他章节，其他字段仍限本条引用', async () => {
  const batch = parseBatch(JSON.parse(await readFile('../data/demo/batch.json', 'utf8')));
  const clause = batch.clauses[0]!;
  const doc = batch.documents.find((d) => d.id === clause.documentId)!;
  const quote = '本通知自2026年1月1日起施行。';
  doc.originalText += `\n八、其他事项\n${quote}`;
  clause.effectiveFrom = '2026-01-01';
  clause.effectiveFromEvidence = { text: '2026-01-01', quote, locator: '八、其他事项' };
  assert.ok(!clause.quote.includes(quote));
  assert.deepEqual(validateLinks(batch), []);

  clause.effectiveFromEvidence.quote = '另一文件才有的日期';
  assert.ok(validateLinks(batch).some((e) => e.includes('effectiveFromEvidence.quote')));
  clause.effectiveFromEvidence.quote = quote;
  clause.conditions = { text: '不能当作资格条件', quote, locator: '八、其他事项' };
  assert.ok(validateLinks(batch).some((e) => e.includes('conditions.quote')));
});
