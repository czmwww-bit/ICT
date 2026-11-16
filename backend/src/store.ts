import type { Pool } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { rows, transaction, type SQL } from './db.js';
import {
  checksum,
  parseBatch,
  payload,
  validateLinks,
  type Batch,
  type Kind,
  type RecordData,
  type Region,
  type Stored,
  type Document,
  type Clause,
} from './model.js';

type VersionRow = { kind: Kind; payload: unknown; checksum: string; batch_id: string };
export async function allVersions(db: SQL): Promise<Stored[]> {
  return (
    await rows<VersionRow>(db, 'SELECT kind,payload,checksum,batch_id FROM evidence_versions')
  ).map((r) => ({
    kind: r.kind,
    data: (typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload) as RecordData,
    checksum: r.checksum,
    batchId: r.batch_id,
  }));
}
export async function allRegions(db: SQL): Promise<Region[]> {
  return (
    await rows<{
      code: string;
      name: string;
      parent_code: string | null;
      dataset: Region['dataset'];
    }>(db, 'SELECT * FROM evidence_regions')
  ).map((r) => ({ code: r.code, name: r.name, parentCode: r.parent_code, dataset: r.dataset }));
}
export type Plan = {
  added: number;
  modified: number;
  unchanged: number;
  errors: number;
  details: { kind: Kind; id: string; version: number; action: string }[];
  messages: string[];
};
export function planImport(
  batch: Batch,
  existing: Stored[],
  regions: Region[],
  allowDemo = false,
): Plan {
  const messages = validateLinks(batch, existing, regions);
  if (!allowDemo && batch.regions.some((r) => r.dataset === 'demo'))
    messages.push('regions.dataset: 示例区域导入必须明确 --allow-demo');
  const plan: Plan = { added: 0, modified: 0, unchanged: 0, errors: 0, details: [], messages };
  for (const [kind, list] of [
    ['document', batch.documents],
    ['clause', batch.clauses],
  ] as const)
    for (const r of list) {
      const versions = existing.filter((s) => s.kind === kind && s.data.id === r.id);
      const current = versions.sort((a, b) => b.data.version - a.data.version)[0];
      const old = versions.find((s) => s.data.version === r.version);
      if (current && current.data.dataset !== r.dataset)
        messages.push(`${kind}:${r.id}.dataset: 稳定编号不允许跨数据集变更`);
      if (r.dataset === 'demo' && !allowDemo)
        messages.push(`${kind}:${r.id}.dataset: 示例导入必须明确 --allow-demo`);
      if (r.reviewStatus !== 'draft' || r.reviewedBy || r.reviewedAt)
        messages.push(`${kind}:${r.id}.reviewStatus: 导入必须为 draft，使用 publish 独立审核`);
      if (old?.checksum === checksum(r)) {
        plan.unchanged++;
        plan.details.push({ kind, id: r.id, version: r.version, action: 'unchanged' });
        continue;
      }
      if (
        old ||
        r.version !== (current?.data.version ?? 0) + 1 ||
        r.expectedVersion !== (current?.data.version ?? 0)
      )
        messages.push(
          `${kind}:${r.id}.version: 版本冲突，当前 ${current?.data.version ?? 0}，新版本须递增且 expectedVersion 匹配`,
        );
      if (current) plan.modified++;
      else plan.added++;
      plan.details.push({
        kind,
        id: r.id,
        version: r.version,
        action: current ? 'modified' : 'added',
      });
    }
  plan.errors = messages.length;
  return plan;
}
export async function importBatch(
  db: Pool,
  input: unknown,
  options: { dryRun?: boolean; allowDemo?: boolean } = {},
) {
  const batch = parseBatch(input);
  return transaction(db, async (c) => {
    const existing = await allVersions(c),
      regions = await allRegions(c);
    const plan = planImport(batch, existing, regions, options.allowDemo);
    if (plan.errors || options.dryRun) return plan;
    if (
      !plan.added &&
      !plan.modified &&
      batch.regions.every((r) => regions.some((e) => e.code === r.code))
    )
      return plan;
    const pending = batch.regions.filter((r) => !regions.some((e) => e.code === r.code));
    const inserted = new Set(regions.map((r) => r.code));
    while (pending.length) {
      const index = pending.findIndex((r) => !r.parentCode || inserted.has(r.parentCode));
      if (index < 0) throw new Error('区域关联不可解析');
      const r = pending.splice(index, 1)[0]!;
      await c.query(
        'INSERT INTO evidence_regions(code,name,parent_code,dataset) VALUES (?,?,?,?)',
        [r.code, r.name, r.parentCode, r.dataset],
      );
      inserted.add(r.code);
    }
    const batchId = randomUUID();
    await c.query('INSERT INTO evidence_batches(id,actor,reason) VALUES (?,?,?)', [
      batchId,
      batch.actor,
      batch.reason,
    ]);
    for (const item of plan.details.filter((x) => x.action !== 'unchanged')) {
      const r = (item.kind === 'document' ? batch.documents : batch.clauses).find(
        (r) => r.id === item.id,
      )!;
      const hash = checksum(r);
      await c.query(
        'INSERT INTO evidence_versions(kind,id,version,checksum,payload,batch_id,operation) VALUES (?,?,?,?,?,?,?)',
        [
          item.kind,
          r.id,
          r.version,
          hash,
          JSON.stringify(payload(r)),
          batchId,
          item.action === 'added' ? 'create' : 'update',
        ],
      );
      await c.query(
        'INSERT INTO evidence_heads(kind,id,version,checksum) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),checksum=VALUES(checksum)',
        [item.kind, r.id, r.version, hash],
      );
    }
    return { ...plan, batchId };
  });
}
export type Publication = {
  sequence_id: number;
  kind: Kind;
  id: string;
  version: number;
  decision: 'approved' | 'rejected';
  actor: string;
  reason: string;
  reviewed_at: string;
};
export async function publications(db: SQL) {
  return rows<Publication>(db, 'SELECT * FROM evidence_publications ORDER BY sequence_id');
}
export function isApproved(s: Stored, events: Publication[]) {
  return (
    events
      .filter((p) => p.kind === s.kind && p.id === s.data.id && p.version === s.data.version)
      .at(-1)?.decision === 'approved'
  );
}
export async function publish(
  db: Pool,
  kind: Kind,
  id: string,
  version: number,
  actor: string,
  reason: string,
  decision: 'approved' | 'rejected' = 'approved',
  allowRollback = false,
) {
  if (
    !actor.trim() ||
    actor.length > 200 ||
    !reason.trim() ||
    !Number.isInteger(version) ||
    version < 1
  )
    throw new Error('发布需有效版本、操作者及原因');
  return transaction(db, async (c) => {
    const versions = await allVersions(c),
      events = await publications(c);
    const s = versions.find(
      (s) => s.kind === kind && s.data.id === id && s.data.version === version,
    );
    if (!s) throw new Error('版本不存在');
    if (decision === 'approved') {
      const lastPublished = Math.max(
        0,
        ...events
          .filter((e) => e.kind === kind && e.id === id && e.decision === 'approved')
          .map((e) => e.version),
      );
      if (version < lastPublished && !allowRollback)
        throw new Error('发布旧版本必须明确 --allow-rollback，避免覆盖较新发布');
      if (kind === 'document') {
        const d = s.data as Document;
        if (!d.checkedAt || !d.checkedBy)
          throw new Error('发布文件前必须填写 checkedAt、checkedBy，错误内容需导入新版本');
      } else {
        const clause = s.data as Clause;
        const d = versions.find(
          (v) =>
            v.kind === 'document' &&
            v.data.id === clause.documentId &&
            v.data.version === clause.documentVersion,
        );
        if (!d || !isApproved(d, events)) throw new Error('必须先审核发布来源文件版本');
      }
    }
    await c.query(
      'INSERT INTO evidence_publications(kind,id,version,decision,actor,reason) VALUES (?,?,?,?,?,?)',
      [kind, id, version, decision, actor, reason],
    );
    return { kind, id, version, decision };
  });
}
export async function history(db: SQL, kind: Kind, id: string) {
  const versions = (await allVersions(db))
    .filter((s) => s.kind === kind && s.data.id === id)
    .sort((a, b) => a.data.version - b.data.version);
  const updates = await rows(
    db,
    'SELECT v.version,b.* FROM evidence_versions v JOIN evidence_batches b ON b.id=v.batch_id WHERE v.kind=? AND v.id=? ORDER BY v.version',
    [kind, id],
  );
  return {
    versions: versions.map((s, i) => ({
      ...s,
      operation: i ? 'update' : 'create',
      before: versions[i - 1]?.data ?? null,
      after: s.data,
    })),
    updates,
    publications: (await publications(db)).filter((p) => p.kind === kind && p.id === id),
  };
}
