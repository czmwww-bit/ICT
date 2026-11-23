import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { config, migrate, rows, transaction } from './db.js';
import { parseBatch, checksum, payload, date, type Batch } from './model.js';
import { importBatch, publish, planImport, isApproved } from './store.js';
import { snapshot, findCandidates, getClause, getInSnapshot, type Snapshot } from './query.js';
import { findPaymentRecords } from './payment-records.js';
import { canonical, evidenceDigest } from './backup.js';
import { withEmptyTestDatabase } from './test-sandbox.js';
import { impactSuiteSchema, type ImpactSuite, type ImpactCase } from './impact-cases.js';

type Reference = Awaited<ReturnType<typeof getClause>>[number];
export type ImpactHit = {
  id: string;
  version: number;
  category: string;
  clause: Omit<Reference['clause'], 'reviewedBy' | 'reviewedAt'>;
  source: Reference['source'];
  document: {
    id: string;
    version: number;
    title: string;
    publisher: string;
    url: string;
    publishedAt: string | null;
  };
  clauseChecksum: string;
  documentChecksum: string;
  timeStatus: string;
  unknownEnd: boolean;
};
export type ImpactResult = {
  executed: boolean;
  status: string;
  missing: string[];
  parameters: Record<string, unknown>;
  hits: ImpactHit[];
};
const normalizeHit = (h: Reference, category: string): ImpactHit => {
  const { reviewedBy: _by, reviewedAt: _at, ...clause } = h.clause;
  return {
    id: h.clause.id,
    version: h.clause.version,
    category,
    clause: {
      ...clause,
      regionCodes: [...clause.regionCodes].sort(),
    },
    source: h.source,
    document: {
      id: h.document.id,
      version: h.document.version,
      title: h.document.title,
      publisher: h.document.publisher,
      url: h.document.sourceUrl,
      publishedAt: h.document.publishedAt,
    },
    clauseChecksum: h.clauseChecksum,
    documentChecksum: h.documentChecksum,
    timeStatus: h.timeStatus,
    unknownEnd: h.unknownEnd,
  };
};
export function changedPaths(a: unknown, b: unknown, prefix = ''): string[] {
  if (canonical(a) === canonical(b)) return [];
  if (
    !a ||
    !b ||
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    Array.isArray(a) ||
    Array.isArray(b)
  )
    return [prefix || 'record'];
  const aa = a as Record<string, unknown>,
    bb = b as Record<string, unknown>;
  return [...new Set([...Object.keys(aa), ...Object.keys(bb)])]
    .sort()
    .flatMap((k) => changedPaths(aa[k], bb[k], prefix ? prefix + '.' + k : k));
}
export function compareImpact(before: ImpactResult, after: ImpactResult) {
  const left = new Map(before.hits.map((h) => [h.id, h])),
    right = new Map(after.hits.map((h) => [h.id, h]));
  if (left.size !== before.hits.length || right.size !== after.hits.length)
    throw new Error('同一结果出现重复稳定条款编号，不能无损对比');
  const added = [...right.keys()].filter((id) => !left.has(id)).sort();
  const removed = [...left.keys()].filter((id) => !right.has(id)).sort();
  const versionChanged = [...right.keys()]
    .filter((id) => left.has(id) && left.get(id)!.version !== right.get(id)!.version)
    .sort()
    .map((id) => ({ id, before: left.get(id)!.version, after: right.get(id)!.version }));
  const fieldsChanged = [...right.keys()]
    .filter((id) => left.has(id))
    .sort()
    .flatMap((id) => {
      const fields = changedPaths(left.get(id), right.get(id));
      return fields.length ? [{ id, fields }] : [];
    });
  return {
    changed: !!(
      added.length ||
      removed.length ||
      versionChanged.length ||
      fieldsChanged.length ||
      before.status !== after.status
    ),
    added,
    removed,
    versionChanged,
    fieldsChanged,
    statusChanged: before.status !== after.status,
  };
}
export async function executeImpactCase(
  db: Pool,
  c: ImpactCase,
  previewDate: string,
): Promise<ImpactResult> {
  const type =
    c.queryType ??
    (c.idQuery
      ? 'clause'
      : Object.hasOwn(c, 'recordMonth') || c.ageBandCode
        ? 'payment'
        : 'candidates');
  const parameters = {
    queryType: type,
    matterId: c.matterId,
    regionCode: c.regionCode,
    asOf: c.asOf ?? (type === 'payment' ? previewDate : undefined),
    recordMonth: c.recordMonth,
    ageBandCode: c.ageBandCode,
    idQuery: c.idQuery,
    version: c.version,
  };
  const missing: string[] = [];
  if (type === 'clause') {
    if (!c.idQuery) missing.push('idQuery');
  } else {
    if (!c.matterId) missing.push('matterId');
    if (!c.regionCode) missing.push('regionCode');
    if (!parameters.asOf) missing.push('asOf');
  }
  if (type === 'payment') {
    if (!c.recordMonth) missing.push('recordMonth');
    if (!c.ageBandCode) missing.push('ageBandCode');
  }
  if (missing.length)
    return { executed: false, status: 'needs_parameter', missing, parameters, hits: [] };
  let hits: ImpactHit[];
  if (type === 'clause')
    hits = (
      await getClause(db, c.idQuery!, c.version ? { version: c.version, includeHistory: true } : {})
    ).map((h) => normalizeHit(h, 'clause'));
  else if (type === 'payment') {
    const r = await findPaymentRecords(db, {
      matterId: c.matterId!,
      regionCode: c.regionCode!,
      asOf: parameters.asOf!,
      recordMonth: c.recordMonth!,
      ageBandCode: c.ageBandCode!,
    });
    hits = [
      ...r.monthly.map((h) => normalizeHit(h, 'monthly')),
      ...r.periodContext.map((h) => normalizeHit(h, 'period_context')),
      ...r.unresolvedPeriod.map((h) => normalizeHit(h, 'unresolved_period')),
    ];
  } else
    hits = (
      await findCandidates(db, {
        matterId: c.matterId!,
        regionCode: c.regionCode!,
        asOf: parameters.asOf!,
      })
    ).map((h) => normalizeHit(h, 'candidate'));
  hits.sort((a, b) => a.id.localeCompare(b.id));
  return {
    executed: true,
    status: hits.length ? 'matched' : 'no_match',
    missing: [],
    parameters,
    hits,
  };
}
function snapshotContent(s: Snapshot) {
  return {
    regions: [...s.regions].sort((a, b) => a.code.localeCompare(b.code)),
    versions: s.versions
      .map((v) => ({ kind: v.kind, data: v.data, checksum: v.checksum }))
      .sort((a, b) =>
        (a.kind + ':' + a.data.id + ':' + a.data.version).localeCompare(
          b.kind + ':' + b.data.id + ':' + b.data.version,
        ),
      ),
    events: s.events,
  };
}
// 仅复制读取到的原快照；不伪造发布事件。批次审计用隔离复制标签，历史载荷/版本/事件保持一致。
async function copySnapshot(db: Pool, s: Snapshot, projectName: string) {
  const [identity] = await rows<{ name: string }>(db, 'SELECT DATABASE() AS name');
  assert.ok(
    identity && identity.name === process.env.DB_TEST_NAME && identity.name !== projectName,
    '拒绝向项目库复制快照',
  );
  await transaction(db, async (c) => {
    const pending = [...s.regions],
      inserted = new Set<string>();
    while (pending.length) {
      const i = pending.findIndex((r) => !r.parentCode || inserted.has(r.parentCode));
      assert.ok(i >= 0, '当前区域树不可解析');
      const r = pending.splice(i, 1)[0]!;
      await c.query(
        'INSERT INTO evidence_regions(code,name,parent_code,dataset) VALUES (?,?,?,?)',
        [r.code, r.name, r.parentCode, r.dataset],
      );
      inserted.add(r.code);
    }
    if (s.versions.length) {
      const batchId = randomUUID();
      await c.query('INSERT INTO evidence_batches(id,actor,reason) VALUES (?,?,?)', [
        batchId,
        '影响预览快照复制',
        '仅隔离库，非真实资料维护审计',
      ]);
      for (const v of [...s.versions].sort((a, b) => a.data.version - b.data.version)) {
        assert.equal(checksum(v.data), v.checksum, '当前载荷校验值不一致');
        await c.query(
          'INSERT INTO evidence_versions(kind,id,version,checksum,payload,batch_id,operation) VALUES (?,?,?,?,?,?,?)',
          [
            v.kind,
            v.data.id,
            v.data.version,
            v.checksum,
            JSON.stringify(payload(v.data)),
            batchId,
            v.data.version === 1 ? 'create' : 'update',
          ],
        );
        await c.query(
          'INSERT INTO evidence_heads(kind,id,version,checksum) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),checksum=VALUES(checksum)',
          [v.kind, v.data.id, v.data.version, v.checksum],
        );
      }
    }
    for (const e of s.events)
      await c.query(
        'INSERT INTO evidence_publications(sequence_id,kind,id,version,decision,actor,reason,reviewed_at) VALUES (?,?,?,?,?,?,?,?)',
        [e.sequence_id, e.kind, e.id, e.version, e.decision, e.actor, e.reason, e.reviewed_at],
      );
  });
  assert.equal(
    canonical(snapshotContent(s)),
    canonical(snapshotContent(await snapshot(db))),
    '隔离快照复制不一致',
  );
}
type Assumption = { stage: string; documentId: string; fields: string[] };
async function simulateBatch(
  db: Pool,
  input: Batch,
  stage: string,
  previewDate: string,
  assumptions: Assumption[],
) {
  const current = await snapshot(db);
  const plan = planImport(input, current.versions, current.regions);
  if (plan.errors) throw new Error(stage + '导入校验失败：\n' + plan.messages.join('\n'));
  const prepared = structuredClone(input);
  for (const d of prepared.documents) {
    if (!d.checkedAt || !d.checkedBy) {
      const existing = current.versions.find(
        (v) => v.kind === 'document' && v.data.id === d.id && v.data.version === d.version,
      );
      if (existing)
        throw new Error(
          `${d.id}@${d.version}已有版本缺少checkedAt/checkedBy；需按正常流程准备新版本，预览不会覆盖旧载荷`,
        );
      const fields = [];
      if (!d.checkedAt) {
        d.checkedAt = previewDate;
        fields.push('checkedAt');
      }
      if (!d.checkedBy) {
        d.checkedBy = '隔离影响预览假定完成核对，不是人工审核';
        fields.push('checkedBy');
      }
      assumptions.push({ stage, documentId: d.id, fields });
    }
  }
  const imported = await importBatch(db, prepared);
  if (imported.errors) throw new Error(stage + '导入失败：\n' + imported.messages.join('\n'));
  // 与真实发布一致：文件先于条款；不自动撤回或按新发布日期废止旧条款。
  for (const [kind, records] of [
    ['document', prepared.documents],
    ['clause', prepared.clauses],
  ] as const)
    for (const r of records) {
      const found = current.versions.find(
        (v) => v.kind === kind && v.data.id === r.id && v.data.version === r.version,
      );
      if (found && isApproved(found, current.events)) continue;
      await publish(
        db,
        kind,
        r.id,
        r.version,
        '隔离影响预览',
        '模拟审核后查询，不代表真实政策审核',
      );
    }
  return imported;
}
function pendingItems(c: ImpactCase, before: ImpactResult, after: ImpactResult) {
  const items = new Set<string>();
  for (const f of new Set([...before.missing, ...after.missing]))
    items.add(f === 'recordMonth' ? '需要确认查询年份和月份' : `需补充查询参数${f}`);
  for (const h of [...before.hits, ...after.hits]) {
    if (h.clause.paymentRecord) {
      items.add('发放记录不等于提标文件；提标生效日期、差额补发规则待核实');
      if (h.category === 'period_context') items.add('季度公开仅为上下文，不是单月到账证明');
      if (h.category === 'unresolved_period') items.add('统计年度未确认，不能按公开年份补齐');
    } else if (h.timeStatus === 'needs_review') items.add(`${h.id}政策起始日期未知`);
    if (h.unknownEnd && !h.clause.paymentRecord) items.add(`${h.id}终止日期未知，不推断永久有效`);
    if (h.clause.relations.length) items.add(`${h.id}有条款关系，是否支持具体结论仍需人工核对`);
  }
  if (!before.hits.length && !after.hits.length && before.executed)
    items.add('本用例未命中不证明其他资料或地区没有政策');
  return [...items];
}
export type ImpactOptions = {
  batch: unknown;
  suite: unknown;
  demoBaseline?: unknown;
  previewDate: string;
};
export async function runImpactPreview(project: Pool, options: ImpactOptions) {
  const batch = parseBatch(options.batch, '更新批次');
  const suite: ImpactSuite = impactSuiteSchema.parse(options.suite);
  const demo =
    options.demoBaseline === undefined ? undefined : parseBatch(options.demoBaseline, '演示基线');
  date.parse(options.previewDate);
  const projectName = config().database;
  const [identity] = await rows<{ name: string }>(project, 'SELECT DATABASE() AS name');
  assert.equal(identity?.name, projectName, '源连接与配置项目库不一致，停止预览');
  const digestBefore = await evidenceDigest(project),
    current = await snapshot(project);
  const assumptions: Assumption[] = [];
  const baselineHash = createHash('sha256')
    .update(canonical(snapshotContent(current)))
    .digest('hex');
  let result: any, error: unknown;
  try {
    result = await withEmptyTestDatabase(async (db) => {
      await migrate(db);
      try {
        await copySnapshot(db, current, projectName);
        if (demo) await simulateBatch(db, demo, '演示基线', options.previewDate, assumptions);
        const baseline = await snapshot(db);
        const before: ImpactResult[] = [];
        for (const c of suite.cases)
          before.push(await executeImpactCase(db, c, options.previewDate));
        const plan = await simulateBatch(db, batch, '更新批次', options.previewDate, assumptions);
        const afterSnapshot = await snapshot(db);
        const results = [];
        for (const [index, c] of suite.cases.entries()) {
          const old = before[index]!,
            after = await executeImpactCase(db, c, options.previewDate),
            diff = compareImpact(old, after);
          assert.equal(
            canonical(old.parameters),
            canonical(after.parameters),
            '两边查询参数不一致',
          );
          const changedIds = [
            ...new Set([...diff.added, ...diff.removed, ...diff.fieldsChanged.map((x) => x.id)]),
          ].sort();
          const causes = changedIds.map((id) => {
            const oldHit = old.hits.find((h) => h.id === id),
              newHit = after.hits.find((h) => h.id === id);
            const outside = getInSnapshot(afterSnapshot, id)[0];
            const update = batch.clauses.find((x) => x.id === id);
            const updatedDocument = batch.documents.find(
              (d) => d.id === (newHit ?? oldHit)?.document.id,
            );
            return {
              clauseId: id,
              trigger: update
                ? {
                    kind: 'clause',
                    id: update.id,
                    version: update.version,
                    documentId: update.documentId,
                    documentVersion: update.documentVersion,
                  }
                : updatedDocument
                  ? { kind: 'document', id: updatedDocument.id, version: updatedDocument.version }
                  : null,
              fields:
                diff.fieldsChanged.find((x) => x.id === id)?.fields ??
                changedPaths(
                  oldHit?.clause,
                  (newHit ?? (outside ? normalizeHit(outside, 'outside_query') : undefined))
                    ?.clause,
                ),
              before: oldHit ?? null,
              after: newHit ?? null,
              updatedButOutsideQuery:
                !newHit && outside ? normalizeHit(outside, 'outside_query') : null,
            };
          });
          const ids = (r: ImpactResult) => r.hits.map((h) => `${h.id}@${h.version}`).sort();
          const expectedAfter = c.expectedAfter ?? c.references;
          const expectedChecks = [
            ['before', c.expectedBefore, ids(old)],
            ['after', expectedAfter, ids(after)],
          ] as const;
          results.push({
            id: c.id,
            description: c.description,
            before: old,
            after,
            diff,
            causes,
            reasons: !old.executed
              ? ['需确认查询参数，两边均未执行资料查询']
              : [
                  ...diff.added.map((id) => `新增命中${id}，由本批次关联资料模拟发布产生`),
                  ...diff.removed.map(
                    (id) => `减少命中${id}，更新后的版本或适用字段不再满足同一查询；见变更依据`,
                  ),
                  ...diff.versionChanged.map((x) => `${x.id}版本${x.before}→${x.after}`),
                  ...diff.fieldsChanged
                    .filter((x) => !diff.versionChanged.some((v) => v.id === x.id))
                    .map((x) => `${x.id}依据字段变化：${x.fields.join('、')}`),
                  ...(!diff.changed ? ['相同参数下命中编号、版本和证据字段不变'] : []),
                ],
            pending: pendingItems(c, old, after),
            expectations: expectedChecks.map(([stage, expected, actual]) => ({
              stage,
              expected: expected ?? null,
              actual,
              status:
                expected === undefined
                  ? 'not_provided'
                  : !(stage === 'before' ? old.executed : after.executed)
                    ? 'not_executed'
                    : canonical([...expected].sort()) === canonical(actual)
                      ? 'pass'
                      : 'fail',
            })),
          });
        }
        return {
          ok: true,
          results,
          plan,
          baseline: { versionCount: baseline.versions.length, eventCount: baseline.events.length },
          previewBaselineSha256: createHash('sha256')
            .update(canonical(snapshotContent(baseline)))
            .digest('hex'),
          baselineReplayVerified: true,
        };
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
    });
  } catch (e) {
    error = e;
  }
  const digestAfter = await evidenceDigest(project);
  const unchanged = canonical(digestBefore) === canonical(digestAfter);
  if (!unchanged)
    throw new Error('预览期间项目库摘要变化，不能宣称无变化；请核对是否有并发维护并重试');
  if (error)
    throw new Error(
      '无法完成隔离预览：' +
        (error instanceof Error ? error.message : String(error)) +
        '；项目库摘要不变',
    );
  if (!result.ok) throw new Error(result.message + '；项目库摘要不变，隔离测试表已清理');
  return {
    executedAt: new Date().toISOString(),
    mode: demo ? 'demo_augmented_project_snapshot' : 'current_project_snapshot',
    scope: '仅本次列出的查询用例，不是全库影响范围或政策语义审计',
    humanPolicyApproved: false,
    currentSnapshotSha256: baselineHash,
    currentSnapshotVersions: current.versions.length,
    currentOfficialApprovedClauses: current.versions.filter(
      (v) => v.kind === 'clause' && v.data.dataset === 'official' && isApproved(v, current.events),
    ).length,
    sourceDatabaseUnchanged: true,
    sourceDigestBefore: digestBefore,
    sourceDigestAfter: digestAfter,
    testTablesCleaned: true,
    suiteVersion: suite.version,
    assumptions,
    ...result,
    summary: {
      cases: result.results.length,
      changed: result.results.filter((r: any) => r.diff.changed).length,
      unchanged: result.results.filter(
        (r: any) => r.before.executed && r.after.executed && !r.diff.changed,
      ).length,
      executedQueryPairs: result.results.filter((r: any) => r.before.executed && r.after.executed)
        .length,
      needsParameters: result.results.filter((r: any) => !r.before.executed).length,
      expectationFailures: result.results
        .flatMap((r: any) => r.expectations)
        .filter((e: any) => e.status === 'fail').length,
    },
  };
}
export type ImpactReport = Awaited<ReturnType<typeof runImpactPreview>>;
