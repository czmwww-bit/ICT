import { z } from 'zod';
import type { Region } from './model.js';
import { ancestorCodes } from './query.js';
const status = z.enum(['ready', 'need_info', 'needs_review']);
export const suiteSchema = z
  .object({
    version: z.string(),
    cases: z.array(
      z.object({
        id: z.string(),
        group: z.enum(['demo', 'real', 'holdout']),
        description: z.string(),
        input: z.object({
          text: z.string(),
          region: z.string().nullable(),
          answers: z.record(z.string(), z.unknown()),
        }),
        imagePath: z.string().nullable(),
        asOf: z.string(),
        expected: z.object({
          status,
          questionKey: z.string().nullable(),
          nextStep: z.string(),
          materials: z.array(z.string()),
          references: z.array(
            z.object({ clauseId: z.string(), version: z.number().int().positive() }),
          ),
          forbidden: z.array(z.string()),
        }),
        humanVerified: z.enum(['pending', 'confirmed', 'rejected']),
      }),
    ),
  })
  .superRefine((suite, context) => {
    const ids = new Set<string>();
    suite.cases.forEach((c, index) => {
      if (ids.has(c.id))
        context.addIssue({ code: 'custom', path: ['cases', index, 'id'], message: '案例编号重复' });
      ids.add(c.id);
    });
  });
export type Case = z.infer<typeof suiteSchema>['cases'][number];
export type Check = { name: string; status: 'pass' | 'fail' | 'not_executed'; reason: string };
export type Catalog = Map<
  string,
  { quote: string; url: string; title: string; applicableRegionCodes: string[] }
>;
export function catalogEntry(
  source: { quote: string; url: string; title: string },
  regionCodes: string[],
  regions: Region[],
) {
  return {
    quote: source.quote,
    url: source.url,
    title: source.title,
    applicableRegionCodes: regions
      .filter((r) => regionCodes.some((code) => ancestorCodes(regions, r.code).has(code)))
      .map((r) => r.code),
  };
}
export function checkOutput(c: Case, actual: unknown, catalog: Catalog): Check[] {
  const a = actual as Record<string, unknown> | null;
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, reason: string) =>
    checks.push({ name, status: ok ? 'pass' : 'fail', reason: ok ? '' : reason });
  add(
    'status',
    a?.status === c.expected.status,
    `期望 ${c.expected.status}，实际 ${a?.status ?? '<缺失>'}`,
  );
  const q = a?.question as Record<string, unknown> | undefined;
  add(
    'required_fields',
    Boolean(
      a &&
      status.safeParse(a.status).success &&
      (a.status === 'ready'
        ? typeof a.nextStep === 'string' &&
          a.nextStep.trim() &&
          Array.isArray(a.materials) &&
          Array.isArray(a.sources) &&
          a.sources.length > 0
        : a.status === 'need_info'
          ? typeof q?.key === 'string' && typeof q?.text === 'string' && q.text.trim()
          : typeof a.reason === 'string' &&
            a.reason.trim() &&
            typeof a.nextStep === 'string' &&
            a.nextStep.trim()),
    ),
    '响应缺少本状态必需字段',
  );
  if (c.expected.questionKey)
    add(
      'question',
      q?.key === c.expected.questionKey && typeof q?.text === 'string' && Boolean(q.text.trim()),
      `缺少追问 ${c.expected.questionKey}`,
    );
  if (c.expected.materials.length) {
    // 只核对材料项的名称，不能把引文/说明中的材料文字计为已提供。
    const names = Array.isArray(a?.materials)
      ? a.materials.flatMap((value: unknown) => {
          if (typeof value === 'string') return [value.trim()];
          if (value && typeof value === 'object') {
            const item = value as Record<string, unknown>;
            const name = typeof item.name === 'string' ? item.name : item.text;
            if (typeof name === 'string') return [name.trim()];
          }
          return [];
        })
      : [];
    add(
      'materials',
      c.expected.materials.every((x) => names.includes(x.trim())),
      '缺少必要材料名称（名称一致仍需人工核验建议语义）',
    );
  }
  const sources = Array.isArray(a?.sources) ? (a.sources as Record<string, unknown>[]) : [];
  if (a?.status === 'ready')
    add(
      'region_match',
      Boolean(c.input.region) &&
        sources.length > 0 &&
        sources.every(
          (s) =>
            s &&
            catalog
              .get(`${s.clauseId}@${s.clauseVersion}`)
              ?.applicableRegionCodes.includes(c.input.region!),
        ),
      'ready引用的资料未覆盖办理地区，或缺少可核验的办理地区',
    );
  if (c.expected.references.length || sources.length) {
    const valid =
      sources.length > 0 &&
      sources.every((s) => {
        if (!s || typeof s !== 'object') return false;
        const known = catalog.get(`${s.clauseId}@${s.clauseVersion}`);
        return known && s.quote === known.quote && s.url === known.url && s.title === known.title;
      });
    add('citation_validity', valid, '引用编号、版本、原文、标题或链接与资料目录不匹配');
    add(
      'expected_citations',
      c.expected.references.every((r) =>
        sources.some((s) => s?.clauseId === r.clauseId && s?.clauseVersion === r.version),
      ),
      '缺少预期条款版本',
    );
  }
  const serialized = JSON.stringify(a ?? {});
  add(
    'forbidden_claims',
    !c.expected.forbidden.some((x) => serialized.includes(x)),
    '出现不应给出的断言',
  );
  return checks;
}
export const automaticMetrics = [
  'status',
  'required_fields',
  'region_match',
  'question',
  'materials',
  'citation_validity',
  'expected_citations',
  'forbidden_claims',
];
export function applicableMetrics(c: Case) {
  return [
    'status',
    'required_fields',
    ...(c.expected.status === 'ready' ? ['region_match'] : []),
    ...(c.expected.questionKey ? ['question'] : []),
    ...(c.expected.materials.length ? ['materials'] : []),
    ...(c.expected.references.length ? ['citation_validity', 'expected_citations'] : []),
    'forbidden_claims',
  ];
}
export async function callGuide(url: string, c: Case, timeoutMs: number) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(c.input),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
