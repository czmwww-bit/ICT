import assert from 'node:assert/strict';
import type { Pool } from 'mysql2/promise';
import type { Batch } from './model.js';
import { showCandidates, showClause } from './query-view.js';
import { ancestorCodes, snapshot } from './query.js';
export type RetrievalCase = {
  id: string;
  phase: string;
  description: string;
  matterId?: string;
  regionCode?: string;
  asOf?: string;
  idQuery?: string;
  version?: number;
  status: string;
  references: string[];
  age?: number;
};
export async function evaluateRetrieval(db: Pool, cases: RetrievalCase[], phase: string) {
  const results = [];
  for (const c of cases.filter((c) => c.phase === phase)) {
    const actual = c.idQuery
      ? await showClause(db, c.idQuery, c.version)
      : await showCandidates(db, {
          matterId: c.matterId!,
          regionCode: c.regionCode!,
          asOf: c.asOf!,
        });
    const ids = actual.candidates.map((h) => `${h.clause.id}@${h.clause.version}`).sort(),
      expected = [...c.references].sort();
    const s = await snapshot(db);
    const checks = [
      {
        name: 'status',
        pass: actual.status === c.status,
        reason: `期望${c.status}，实际${actual.status}`,
      },
      {
        name: 'exact_hits_and_versions',
        pass: JSON.stringify(ids) === JSON.stringify(expected),
        reason: `期望${expected.join(',')}，实际${ids.join(',')}`,
      },
      {
        name: 'no_unreviewed_data',
        pass: actual.candidates.every(
          (h) =>
            h.publication.decision === 'approved' && h.sourcePublication.decision === 'approved',
        ),
        reason: '不得返回未审核的条款或来源版本',
      },
      {
        name: 'region_and_time',
        pass: actual.candidates.every(
          (h) =>
            c.idQuery ||
            (h.clause.regionCodes.some((code) =>
              ancestorCodes(s.regions, c.regionCode!).has(code),
            ) &&
              (!h.clause.effectiveFrom || h.clause.effectiveFrom <= c.asOf!) &&
              (!h.clause.effectiveTo || c.asOf! <= h.clause.effectiveTo)),
        ),
        reason: '不得混入错误地区/记录时间范围',
      },
      {
        name: 'source_locator_integrity',
        pass: actual.candidates.every(
          (h) =>
            Boolean(h.source.url && h.source.locator && h.document.publisher) &&
            h.document.originalText.includes(h.clause.quote),
        ),
        reason: '来源文件版本与准确原文定位须一致',
      },
    ];
    results.push({
      id: c.id,
      description: c.description,
      phase,
      knownAge: c.age ?? null,
      expectedStatus: c.status,
      actualStatus: actual.status,
      expected,
      actual: ids,
      checks,
      manualReview: {
        status: 'pending',
        adviceSupported: null,
        ageQualificationCorrect: null,
        note: '技术审核夹具，只核验资料检索。年龄资格、建议正确性和引用支持结论由②③人工复核。',
      },
    });
  }
  return results;
}
export function corpusCompleteness(batch: Batch) {
  const n = batch.clauses.length;
  const metrics = {
    source: 0,
    quoteLocator: 0,
    region: 0,
    effectiveFromKnown: 0,
    effectiveToKnown: 0,
  };
  for (const c of batch.clauses) {
    const d = batch.documents.find((d) => d.id === c.documentId && d.version === c.documentVersion);
    if (d?.sourceUrl && d.publisher && d.title) metrics.source++;
    if (d?.originalText.includes(c.quote) && c.locator) metrics.quoteLocator++;
    if (
      c.regionCodes.length &&
      c.regionCodes.every((code) => batch.regions.some((r) => r.code === code))
    )
      metrics.region++;
    if (c.effectiveFrom) metrics.effectiveFromKnown++;
    if (c.effectiveTo) metrics.effectiveToKnown++;
  }
  return Object.fromEntries(
    Object.entries(metrics).map(([name, numerator]) => [
      name,
      {
        numerator,
        denominator: n,
        unknown: n - numerator,
        note: name.startsWith('effective')
          ? '未知日期单列，不推断，也不当成无期限'
          : '结构完整性不代替原文真实性及语义人工审核',
      },
    ]),
  );
}
