import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseBatch, validateLinks } from '../src/model.js';
import { impactSuiteSchema } from '../src/impact-cases.js';
const source = '../data/official/longyang-pilot/supplement-2026-11-19/';
const dest = '../data/impact/longyang-monthly/';
await mkdir(dest, { recursive: true });
try {
  await access(dest + 'provenance.json');
  throw new Error('演示输入已存在，请另建版本，不能覆盖固定用例');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const raw = await readFile(source + 'batch.draft.json', 'utf8'),
  batch = parseBatch(JSON.parse(raw));
const subset = (id: string) => {
  const c = batch.clauses.find((c) => c.id === id)!;
  assert.ok(c);
  const d = batch.documents.find((d) => d.id === c.documentId)!;
  const b = {
    schemaVersion: 1 as const,
    actor: '成员③影响预览演示，非人工审核',
    reason: '复用官方月报，仅隔离技术发布',
    regions: batch.regions,
    documents: [d],
    clauses: [c],
  };
  assert.deepEqual(validateLinks(b), []);
  return b;
};
const baseline = subset('BS_GLT_202602_LY_100PLUS'),
  update = subset('BS_GLT_202609_LY_100PLUS');
assert.equal(baseline.clauses[0]!.paymentRecord!.amountYuanPerPersonMonth, 350);
assert.equal(update.clauses[0]!.paymentRecord!.amountYuanPerPersonMonth, 1000);
const common = {
  queryType: 'payment',
  matterId: 'HIGH_AGE_ALLOWANCE',
  regionCode: '530502',
  asOf: '2026-11-19',
  ageBandCode: '100_PLUS',
};
const suite = {
  version: 'longyang-monthly-impact-v1-pending',
  cases: [
    {
      id: 'FEB',
      description: '2月记录在加入9月后仍为350',
      ...common,
      recordMonth: '2026-02',
      expectedBefore: ['BS_GLT_202602_LY_100PLUS@1'],
      expectedAfter: ['BS_GLT_202602_LY_100PLUS@1'],
    },
    {
      id: 'SEP',
      description: '9月新增1000的月度来源',
      ...common,
      recordMonth: '2026-09',
      expectedBefore: [],
      expectedAfter: ['BS_GLT_202609_LY_100PLUS@1'],
    },
    {
      id: 'MISSING_MONTH',
      description: '奶奶100岁，350还是1000？需确认年月',
      ...common,
      recordMonth: null,
      expectedBefore: [],
      expectedAfter: [],
    },
    {
      id: 'OTHER_COUNTY',
      description: '非隆阳：施甸2月命中不变',
      ...common,
      regionCode: '530521',
      recordMonth: '2026-02',
      expectedBefore: [],
      expectedAfter: [],
    },
    {
      id: 'OTHER_MATTER',
      description: '无关事项命中不变',
      ...common,
      matterId: 'ECONOMIC_ELDERLY_SERVICE',
      recordMonth: '2026-09',
      expectedBefore: [],
      expectedAfter: [],
    },
    {
      id: 'MARCH_NO_INFERENCE',
      description: '未覆盖3月，不从9月倒推',
      ...common,
      recordMonth: '2026-03',
      expectedBefore: [],
      expectedAfter: [],
    },
  ],
};
impactSuiteSchema.parse(suite);
const live = {
  ...suite,
  version: 'longyang-monthly-impact-current-v1',
  cases: suite.cases.map(({ expectedBefore, expectedAfter, ...c }) => c),
};
const hashes: Record<string, string> = {};
for (const [file, data] of Object.entries({
  'baseline.demo.json': baseline,
  'update.draft.json': update,
  'queries.json': suite,
  'queries.current.json': live,
})) {
  const text = JSON.stringify(data, null, 2) + '\n';
  hashes[file] = createHash('sha256').update(text).digest('hex');
  await writeFile(dest + file, text, { flag: 'wx' });
}
await writeFile(
  dest + 'provenance.json',
  JSON.stringify(
    {
      sourceBatch: source + 'batch.draft.json',
      sourceBatchSha256: createHash('sha256').update(raw).digest('hex'),
      files: hashes,
      baseline: '仅在隔离环境假定审核发布2月官方记录，不是真实项目库已发布状态',
      sources: [
        {
          documentId: baseline.documents[0]!.id,
          url: baseline.documents[0]!.sourceUrl,
          period: '2026-02',
          type: 'monthly_statistics',
        },
        {
          documentId: update.documents[0]!.id,
          url: update.documents[0]!.sourceUrl,
          period: '2026-09',
          type: 'monthly_statistics',
        },
      ],
      policyAdjustmentEffectiveDate: null,
      retroactiveDifferenceRule: null,
      humanPolicyApproved: false,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify({ directory: dest, cases: suite.cases.length }));
