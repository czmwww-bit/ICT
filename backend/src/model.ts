import { z } from 'zod';
import { createHash } from 'node:crypto';

export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v);
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, '必须是真实的 YYYY-MM-DD 日期');
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const text = z.string().trim().min(1);
const rawText = z
  .string()
  .min(1)
  .refine((v) => v.trim().length > 0, '原文不能为空白');
const code = z.string().min(1).max(64);
export const regionSchema = z
  .object({
    code,
    name: text.max(200),
    parentCode: code.nullable(),
    dataset: z.enum(['official', 'demo']),
  })
  .strict();
const evidence = z.object({ text: rawText, quote: rawText, locator: text }).strict();
const base = {
  id,
  version: z.number().int().positive(),
  expectedVersion: z.number().int().nonnegative(),
  dataset: z.enum(['official', 'demo']),
  reviewStatus: z.enum(['draft', 'approved', 'rejected']),
  reviewedBy: text.nullable(),
  reviewedAt: date.nullable(),
  regionCodes: z.array(code).min(1),
};
export const documentSchema = z
  .object({
    ...base,
    title: text,
    publisher: text,
    sourceUrl: z
      .string()
      .url()
      .refine((v) => /^https?:\/\//.test(v)),
    publishedAt: date.nullable(),
    originalText: rawText,
    originalPath: text.nullable(),
    checkedAt: date.nullable(),
    checkedBy: text.nullable(),
    effectiveFrom: date.nullable(),
    effectiveTo: date.nullable(),
    effectiveFromEvidence: evidence.nullable(),
    effectiveToEvidence: evidence.nullable(),
  })
  .strict();
export const clauseSchema = z
  .object({
    ...base,
    documentId: id,
    documentVersion: z.number().int().positive(),
    matterId: id,
    matterName: text,
    quote: rawText,
    locator: text,
    population: evidence.nullable(),
    conditions: evidence.nullable(),
    effectiveFrom: date.nullable(),
    effectiveTo: date.nullable(),
    effectiveFromEvidence: evidence.nullable(),
    effectiveToEvidence: evidence.nullable(),
    actions: z.array(evidence).nullable(),
    materials: z.array(evidence).nullable(),
    channels: z.array(evidence).nullable(),
    contacts: z.array(evidence).nullable(),
    schedule: evidence.nullable(),
    location: evidence.nullable(),
    relations: z.array(
      z
        .object({
          type: z.enum(['replaces', 'amends', 'terminates']),
          targetClauseId: id,
          targetVersion: z.number().int().positive(),
          evidence,
        })
        .strict(),
    ),
  })
  .strict();
export const batchSchema = z
  .object({
    schemaVersion: z.literal(1),
    actor: text.max(200),
    reason: text,
    regions: z.array(regionSchema),
    documents: z.array(documentSchema),
    clauses: z.array(clauseSchema),
  })
  .strict();
export type Batch = z.infer<typeof batchSchema>;
export type Document = z.infer<typeof documentSchema>;
export type Clause = z.infer<typeof clauseSchema>;
export type Region = z.infer<typeof regionSchema>;
export type RecordData = Document | Clause;
export type Kind = 'document' | 'clause';
export type Stored = { kind: Kind; data: RecordData; checksum: string; batchId?: string };
export function payload(data: RecordData) {
  const { expectedVersion: _ignored, ...rest } = data;
  return rest;
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.entries(v)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
export function checksum(data: RecordData): string {
  return createHash('sha256')
    .update(canonical(payload(data)))
    .digest('hex');
}

// 此校验也用于数据库已有版本，跨文件关联必须在同一批或库中可解析。
export function validateLinks(
  batch: Batch,
  existing: Stored[] = [],
  existingRegions: Region[] = [],
): string[] {
  const errors: string[] = [];
  const regions = new Map(existingRegions.map((r) => [r.code, r]));
  for (const r of batch.regions) {
    if (regions.has(r.code) && JSON.stringify(regions.get(r.code)) !== JSON.stringify(r))
      errors.push(`regions.${r.code}: 区域编码已存在且定义不同`);
    regions.set(r.code, r);
  }
  const seenRegion = new Set<string>();
  for (const r of batch.regions) {
    if (seenRegion.has(r.code)) errors.push(`regions.${r.code}: 重复编码`);
    seenRegion.add(r.code);
  }
  for (const r of regions.values()) {
    const seen = new Set<string>();
    let cursor: Region | undefined = r;
    while (cursor) {
      if (seen.has(cursor.code)) {
        errors.push(`regions.${r.code}.parentCode: 循环`);
        break;
      }
      seen.add(cursor.code);
      if (cursor.parentCode && !regions.has(cursor.parentCode))
        errors.push(`regions.${r.code}.parentCode: 未知父区域`);
      const parent: Region | undefined = cursor.parentCode
        ? regions.get(cursor.parentCode)
        : undefined;
      if (parent && parent.dataset !== r.dataset)
        errors.push(`regions.${r.code}.parentCode: 数据集不一致`);
      cursor = parent;
    }
  }
  const records = new Map(
    existing.map((s) => [`${s.kind}:${s.data.id}:${s.data.version}`, s.data]),
  );
  const seen = new Set<string>();
  for (const [kind, list] of [
    ['document', batch.documents],
    ['clause', batch.clauses],
  ] as const)
    for (const r of list) {
      const key = `${kind}:${r.id}`;
      if (seen.has(key)) errors.push(`${key}: 批内编号重复`);
      seen.add(key);
      records.set(`${key}:${r.version}`, r);
      if (
        r.dataset === 'official' &&
        (r.id.startsWith('DEMO_') ||
          r.regionCodes.some((code) => code.startsWith('DEMO_')) ||
          (kind === 'document' && new URL((r as Document).sourceUrl).hostname.endsWith('.invalid')))
      )
        errors.push(`${key}.dataset: 示例编号、区域或保留域名不可用作正式资料`);
      if (kind === 'document') {
        const d = r as Document;
        if (d.effectiveFrom && d.effectiveTo && d.effectiveFrom > d.effectiveTo)
          errors.push(`${key}.effectiveTo: 早于生效日期`);
        for (const [v, e] of [
          ['effectiveFrom', 'effectiveFromEvidence'],
          ['effectiveTo', 'effectiveToEvidence'],
        ] as const) {
          if (Boolean(d[v]) !== Boolean(d[e]))
            errors.push(`${key}.${e}: 日期和依据必须同时提供或同时为空`);
          if (d[e] && !d.originalText.includes(d[e]!.quote))
            errors.push(`${key}.${e}.quote: 不在文件原文内`);
        }
      }
      for (const c of r.regionCodes) {
        if (!regions.has(c)) errors.push(`${key}.regionCodes: 未知区域 ${c}`);
        else if (regions.get(c)!.dataset !== r.dataset)
          errors.push(`${key}.regionCodes: 区域数据集不一致 ${c}`);
      }
      if (
        r.reviewStatus === 'approved' &&
        (!r.reviewedBy || !r.reviewedAt || (kind === 'document' && !(r as Document).checkedAt))
      )
        errors.push(`${key}.reviewStatus: 审核需姓名、审核日期和文件核对日期`);
    }
  for (const c of batch.clauses) {
    const key = `clause:${c.id}`;
    const d = records.get(`document:${c.documentId}:${c.documentVersion}`) as Document | undefined;
    if (!d)
      errors.push(
        `${key}.documentVersion: 找不到所属文件版本 ${c.documentId}@${c.documentVersion}`,
      );
    else {
      if (d.dataset !== c.dataset) errors.push(`${key}.dataset: 与文件不一致`);
      if (!d.originalText.includes(c.quote)) errors.push(`${key}.quote: 文件原文中找不到引用`);
      if (c.reviewStatus === 'approved' && d.reviewStatus !== 'approved')
        errors.push(`${key}.reviewStatus: 来源文件版本未审核`);
      const ancestors = (a: string, target: string): boolean => {
        const visited = new Set<string>();
        let r = regions.get(target);
        while (r && !visited.has(r.code)) {
          if (r.code === a) return true;
          visited.add(r.code);
          r = r.parentCode ? regions.get(r.parentCode) : undefined;
        }
        return false;
      };
      for (const r of c.regionCodes)
        if (!d.regionCodes.some((a) => ancestors(a, r)))
          errors.push(`${key}.regionCodes: 超出文件区域 ${r}`);
    }
    if (c.effectiveFrom && c.effectiveTo && c.effectiveFrom > c.effectiveTo)
      errors.push(`${key}.effectiveTo: 早于生效日期（结束日期含当天）`);
    for (const [v, e] of [
      ['effectiveFrom', 'effectiveFromEvidence'],
      ['effectiveTo', 'effectiveToEvidence'],
    ] as const) {
      if (Boolean(c[v]) !== Boolean(c[e]))
        errors.push(`${key}.${e}: 日期与原文依据必须同时提供或同时为 null`);
      // 统一施行/废止日期可位于同一文件的其他章节，仍须绑定准确文件版本。
      if (c[e] && d && !d.originalText.includes(c[e]!.quote))
        errors.push(`${key}.${e}.quote: 不在所属文件版本原文内`);
    }
    const fields = [
      'population',
      'conditions',
      'schedule',
      'location',
      'actions',
      'materials',
      'channels',
      'contacts',
    ] as const;
    for (const field of fields) {
      const value = c[field];
      const items = Array.isArray(value) ? value : value ? [value] : [];
      for (const e of items)
        if (!c.quote.includes(e.quote)) errors.push(`${key}.${field}.quote: 不在条款引用内`);
    }
    for (const rel of c.relations) {
      const target = records.get(`clause:${rel.targetClauseId}:${rel.targetVersion}`) as
        Clause | undefined;
      if (!target || target.id === c.id || target.dataset !== c.dataset)
        errors.push(`${key}.relations: 目标不存在、自引用或跨数据集`);
      if (!c.quote.includes(rel.evidence.quote))
        errors.push(`${key}.relations.evidence.quote: 不在条款引用内`);
    }
  }
  return errors;
}
export function parseBatch(value: unknown, file = '<input>'): Batch {
  const result = batchSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      result.error.issues.map((e) => `${file}: ${e.path.join('.')}: ${e.message}`).join('\n'),
    );
  return result.data;
}
