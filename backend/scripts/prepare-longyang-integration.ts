import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseBatch, validateLinks } from '../src/model.js';
const source = '../data/official/longyang-pilot/';
const dest = source + 'integration-core/';
await mkdir(dest, { recursive: true });
try {
  await access(dest + 'manifest.json');
  throw new Error('固定测试包已存在；请创建新版本，不能静默覆盖');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const sourceRaw = await readFile(source + 'batch.draft.json', 'utf8');
const original = parseBatch(JSON.parse(sourceRaw));
const suite = JSON.parse(await readFile('../eval/real/longyang-development.cases.json', 'utf8'));
const guideCases = suite.cases.slice(0, 6).map((c: any) => ({ ...c, asOf: '2026-11-18' }));
const selected = new Set<string>([
  'YN_GLT_ELIGIBILITY',
  ...guideCases.flatMap((c: any) => c.expected.references.map((r: any) => r.clauseId)),
]);
const clauses = original.clauses.filter((c) => selected.has(c.id));
const documents = original.documents.filter((d) =>
  clauses.some((c) => c.documentId === d.id && c.documentVersion === d.version),
);
const batch = parseBatch({
  ...original,
  actor: '成员③联调包准备，非政策审核',
  reason: '固定版本核心场景待审子集',
  regions: [
    ...original.regions,
    { code: '530521', name: '施甸县（邻区查询对照）', parentCode: '530500', dataset: 'official' },
  ],
  documents,
  clauses,
});
assert.deepEqual(validateLinks(batch), []);
assert.equal(clauses.length, 10);
const provincial = [
  'YN_GLT_ELIGIBILITY',
  'YN_GLT_AUTO_PROCESS',
  'YN_GLT_MISSING_LIST',
  'YN_GLT_UNREACHABLE',
  'YN_GLT_HOUSEHOLD_SEPARATION',
  'YN_GLT_HOUSEHOLD_MOVE',
  'YN_GLT_CARD_ACTIVATION',
  'YN_GLT_HOME_CARD',
];
// 独立写定预期集合，不调用检索函数生成“期望”。相关性选择仍由成员②负责。
const local = [...provincial, 'LY_GLT_WADU_2025_APPLICATION'];
const key = (id: string) => id + '@1';
const cases = guideCases.map((c: any) => ({
  id: c.id,
  description: c.description,
  input: c.input,
  query: { matterId: 'HIGH_AGE_ALLOWANCE', regionCode: '530502', asOf: '2026-11-18' },
  expectedCandidateReferences: local.map(key).sort(),
  expectedQueryStatus: 'needs_review',
  supportingReferences: c.expected.references,
  expectedGuide: c.expected,
  humanVerified: 'pending',
}));
for (const [id, region, asOf, refs] of [
  ['CORE_NEIGHBOR', '530521', '2026-11-18', provincial],
  ['CORE_UNKNOWN_REGION', 'UNKNOWN_REGION', '2026-11-18', []],
  ['CORE_BEFORE_EFFECT', '530502', '2024-12-31', ['LY_GLT_WADU_2025_APPLICATION']],
  ['CORE_HISTORICAL_SCOPE', 'LY_XIYI', '2026-11-18', [...local, 'LY_GLT_HISTORY_2021_APPLY']],
] as const)
  cases.push({
    id,
    description: '资料过滤技术对照，非办理结论',
    input: null,
    query: { matterId: 'HIGH_AGE_ALLOWANCE', regionCode: region, asOf },
    expectedCandidateReferences: refs.map(key).sort(),
    expectedQueryStatus: !refs.length
      ? 'no_match'
      : id === 'CORE_NEIGHBOR'
        ? 'matched'
        : 'needs_review',
    supportingReferences: [],
    expectedGuide: null,
    humanVerified: 'pending',
  });
const reviews = JSON.parse(await readFile(source + 'review-items.json', 'utf8')).filter((r: any) =>
  selected.has(r.clauseId),
);
const metadata = JSON.parse(await readFile(source + 'document-metadata.json', 'utf8')).filter(
  (d: any) => documents.some((x) => x.id === d.documentId),
);
const files: Record<string, unknown> = {
  'batch.draft.json': batch,
  'query.cases.json': { version: 'longyang-core-2026-11-18-v1-pending', cases },
  'guide.cases.json': { version: 'longyang-core-guide-2026-11-18-v1-pending', cases: guideCases },
  'review-items.json': reviews,
  'document-metadata.json': metadata,
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const fileHashes: Record<string, string> = {};
for (const [name, data] of Object.entries(files)) {
  const raw = JSON.stringify(data, null, 2) + '\n';
  await writeFile(dest + name, raw, { flag: 'wx' });
  fileHashes[name] = hash(raw);
}
await writeFile(
  dest + 'manifest.json',
  JSON.stringify(
    {
      version: 'longyang-core-2026-11-18-v1-pending',
      sourceBatch: '../batch.draft.json',
      sourceBatchSha256: hash(sourceRaw),
      files: fileHashes,
      documents: documents.length,
      clauses: clauses.length,
      queryCases: cases.length,
      guideCases: guideCases.length,
      humanPolicyApproved: false,
      guideEndpointExecuted: false,
      scopeNote:
        '历史依据显式按编号读取；候选筛选不执行用户资格、语义相关性或政策优先级判断。原始文件位置相对于backend运行目录。',
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    directory: dest,
    documents: documents.length,
    clauses: clauses.length,
    queryCases: cases.length,
    guideCases: guideCases.length,
  }),
);
