import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { date, recordMonth } from './model.js';

const references = z.array(z.string().regex(/^[A-Za-z0-9_-]+@[1-9]\d*$/));
// 沿用eval/query的扁平字段；不从自然语言自动推断月份、户籍地或事项。
export const impactSuiteSchema = z
  .object({
    version: z.string().min(1),
    cases: z
      .array(
        z
          .object({
            id: z.string().min(1),
            description: z.string().default(''),
            queryType: z.enum(['candidates', 'payment', 'clause']).optional(),
            matterId: z.string().min(1).optional(),
            regionCode: z.string().min(1).nullable().optional(),
            asOf: date.optional(),
            recordMonth: recordMonth.nullable().optional(),
            ageBandCode: z.string().min(1).optional(),
            idQuery: z.string().min(1).optional(),
            version: z.number().int().positive().optional(),
            expectedBefore: references.optional(),
            expectedAfter: references.optional(),
            references: references.optional(),
          })
          .passthrough(),
      )
      .min(1, '影响预览至少需要一个用例'),
  })
  .passthrough()
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    s.cases.forEach((c, i) => {
      if (ids.has(c.id))
        ctx.addIssue({ code: 'custom', path: ['cases', i, 'id'], message: '案例编号重复' });
      ids.add(c.id);
    });
  });
export type ImpactSuite = z.infer<typeof impactSuiteSchema>;
export type ImpactCase = ImpactSuite['cases'][number];
export async function readImpactCases(file: string) {
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const result = impactSuiteSchema.safeParse(raw);
  if (!result.success)
    throw new Error(
      result.error.issues.map((i) => `${file}: ${i.path.join('.')}: ${i.message}`).join('\n'),
    );
  return result.data;
}
