import type { Pool } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { date, type Clause, type Document, type Region, type Stored } from './model.js';
import { allRegions, allVersions, publications, isApproved, type Publication } from './store.js';

export type QueryOptions = { includeDemo?: boolean; includeHistory?: boolean };
export type Snapshot = { versions: Stored[]; regions: Region[]; events: Publication[] };
export function ancestorCodes(regions: Region[], code: string): Set<string> {
  const result = new Set<string>();
  let r = regions.find((r) => r.code === code);
  while (r && !result.has(r.code)) {
    result.add(r.code);
    r = regions.find((x) => x.code === r!.parentCode);
  }
  return result;
}
function selectable(snapshot: Snapshot, options: QueryOptions) {
  let candidates = snapshot.versions.filter(
    (s) =>
      s.kind === 'clause' &&
      isApproved(s, snapshot.events) &&
      (options.includeDemo || s.data.dataset === 'official'),
  );
  if (!options.includeHistory) {
    const current = new Map<string, number>();
    // 发布事件明确切换当前版本；撤回当前版本后不静默回退到可能过时的旧版。
    for (const e of snapshot.events.filter((e) => e.kind === 'clause')) {
      if (e.decision === 'approved') current.set(e.id, e.version);
      else if (current.get(e.id) === e.version) current.delete(e.id);
    }
    candidates = candidates.filter((s) => current.get(s.data.id) === s.data.version);
  }
  return candidates;
}
export function reference(snapshot: Snapshot, s: Stored) {
  const clause = s.data as Clause;
  const source = snapshot.versions.find(
    (d) =>
      d.kind === 'document' &&
      d.data.id === clause.documentId &&
      d.data.version === clause.documentVersion,
  );
  if (!source || !isApproved(source, snapshot.events)) return null;
  const document = source.data as Document;
  const clausePublication = snapshot.events
    .filter((p) => p.kind === 'clause' && p.id === clause.id && p.version === clause.version)
    .at(-1)!;
  const sourcePublication = snapshot.events
    .filter((p) => p.kind === 'document' && p.id === document.id && p.version === document.version)
    .at(-1)!;
  return {
    clause: {
      ...clause,
      reviewStatus: 'approved' as const,
      reviewedBy: clausePublication.actor,
      reviewedAt: new Date(clausePublication.reviewed_at).toISOString().slice(0, 10),
    },
    document: {
      ...document,
      reviewStatus: 'approved' as const,
      reviewedBy: sourcePublication.actor,
      reviewedAt: new Date(sourcePublication.reviewed_at).toISOString().slice(0, 10),
    },
    clauseChecksum: s.checksum,
    documentChecksum: source.checksum,
    originalTextChecksum: createHash('sha256').update(document.originalText).digest('hex'),
    source: {
      clauseId: clause.id,
      clauseVersion: clause.version,
      documentId: document.id,
      documentVersion: document.version,
      title: document.title,
      quote: clause.quote,
      locator: clause.locator,
      url: document.sourceUrl,
    },
    relations: clause.relations,
    // 不推断未知生效时间；截至日期未知也提示核对，绝不当作永久有效。
    timeStatus:
      clause.effectiveFrom === null ? ('needs_review' as const) : ('dates_recorded' as const),
    unknownEnd: clause.effectiveTo === null,
    publication: clausePublication,
    sourcePublication,
  };
}
export function findInSnapshot(
  snapshot: Snapshot,
  input: { matterId: string; regionCode: string; asOf: string } & QueryOptions,
) {
  date.parse(input.asOf);
  const ancestors = ancestorCodes(snapshot.regions, input.regionCode);
  return selectable(snapshot, input)
    .filter((s) => {
      const c = s.data as Clause;
      return (
        c.matterId === input.matterId &&
        c.regionCodes.some((r) => ancestors.has(r)) &&
        (!c.effectiveFrom || c.effectiveFrom <= input.asOf) &&
        (!c.effectiveTo || input.asOf <= c.effectiveTo)
      );
    })
    .map((s) => reference(snapshot, s))
    .filter((s): s is NonNullable<typeof s> => s !== null);
}
export function getInSnapshot(
  snapshot: Snapshot,
  id: string,
  options: QueryOptions & { version?: number } = {},
) {
  if (
    options.version !== undefined &&
    (!Number.isSafeInteger(options.version) || options.version < 1)
  )
    throw new Error('version 必须为正整数');
  if (options.version !== undefined && !options.includeHistory)
    throw new Error('指定历史版本需 includeHistory:true');
  return selectable(snapshot, options)
    .filter(
      (s) =>
        s.data.id === id && (options.version === undefined || s.data.version === options.version),
    )
    .map((s) => reference(snapshot, s))
    .filter((s): s is NonNullable<typeof s> => s !== null);
}
// 一次一致性读避免跨两次查询混用发布状态。仅供后端内部调用，无维护 HTTP 接口。
export async function snapshot(db: Pool): Promise<Snapshot> {
  const c = await db.getConnection();
  try {
    await c.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const result = {
      versions: await allVersions(c),
      regions: await allRegions(c),
      events: await publications(c),
    };
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
export async function findCandidates(db: Pool, input: Parameters<typeof findInSnapshot>[1]) {
  return findInSnapshot(await snapshot(db), input);
}
export async function getClause(
  db: Pool,
  id: string,
  options: Parameters<typeof getInSnapshot>[2] = {},
) {
  return getInSnapshot(await snapshot(db), id, options);
}
export async function clauseHistory(db: Pool, id: string, options: QueryOptions = {}) {
  return getClause(db, id, { ...options, includeHistory: true });
}
