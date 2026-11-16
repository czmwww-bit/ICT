// 仅用于重建虚构开发夹具；正常导入流程不调用此脚本。
import { mkdir, writeFile } from 'node:fs/promises';
async function writeTemplate(file, content) {
  try {
    await writeFile(file, content, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
const ev = (text) => ({ text, quote: text, locator: '示例第一段' });
const original =
  '【虚构开发样例，非真实政策】示例甲区的示例高龄服务面向年满80周岁且户籍在示例甲区的老人。自2026年1月1日起实施，至2026年12月31日止。请携带身份证，到示例甲区社区窗口提交申请。办理时间为工作日上午，地点为示例社区一号窗口。';
const document = {
  id: 'DEMO_D1',
  version: 1,
  expectedVersion: 0,
  dataset: 'demo',
  reviewStatus: 'draft',
  reviewedBy: null,
  reviewedAt: null,
  regionCodes: ['DEMO_A'],
  title: '【虚构】示例甲区高龄服务通知',
  publisher: '【虚构】示例甲区机构',
  sourceUrl: 'https://example.invalid/DEMO_D1',
  publishedAt: '2025-12-01',
  originalText: original,
  originalPath: null,
  checkedAt: '2026-11-16',
  checkedBy: '示例维护人',
  effectiveFrom: null,
  effectiveTo: null,
  effectiveFromEvidence: null,
  effectiveToEvidence: null,
};
const clause = {
  id: 'DEMO_C1',
  version: 1,
  expectedVersion: 0,
  dataset: 'demo',
  reviewStatus: 'draft',
  reviewedBy: null,
  reviewedAt: null,
  regionCodes: ['DEMO_A'],
  documentId: 'DEMO_D1',
  documentVersion: 1,
  matterId: 'DEMO_ALLOWANCE',
  matterName: '【虚构】示例高龄服务',
  quote: original,
  locator: '示例第一段',
  population: ev('年满80周岁且户籍在示例甲区的老人'),
  conditions: ev('年满80周岁且户籍在示例甲区'),
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
  effectiveFromEvidence: ev('自2026年1月1日起实施'),
  effectiveToEvidence: ev('至2026年12月31日止'),
  actions: [ev('提交申请')],
  materials: [ev('身份证')],
  channels: [ev('社区窗口')],
  contacts: null,
  schedule: ev('工作日上午'),
  location: ev('示例社区一号窗口'),
  relations: [],
};
const regions = [
  { code: 'DEMO_CITY', name: '【虚构】示例市', parentCode: null, dataset: 'demo' },
  { code: 'DEMO_A', name: '【虚构】示例甲区', parentCode: 'DEMO_CITY', dataset: 'demo' },
  { code: 'DEMO_A_TOWN', name: '【虚构】示例甲街道', parentCode: 'DEMO_A', dataset: 'demo' },
  { code: 'DEMO_B', name: '【虚构】示例乙区', parentCode: 'DEMO_CITY', dataset: 'demo' },
];
const batch = {
  schemaVersion: 1,
  actor: '示例维护人',
  reason: '建立虚构开发夹具，不用于正式业务',
  regions,
  documents: [document],
  clauses: [clause],
};
const revision = structuredClone(batch);
revision.reason = '示例：仅校正条款定位，文件原文与其他条款不变';
revision.documents = [];
revision.clauses[0] = {
  ...clause,
  version: 2,
  expectedVersion: 1,
  locator: '示例第一段（已复核定位）',
};
const relationText =
  '【虚构开发样例】示例甲区的示例高龄服务面向年满80周岁且户籍在示例甲区的老人。自2026年7月1日起，示例修订条款替代示例条款DEMO_C1，申请改为携带身份证和示例登记表到示例甲区社区窗口提交申请。办理时间为工作日上午，地点为示例社区一号窗口。';
const d2 = {
  ...document,
  id: 'DEMO_D2',
  title: '【虚构】示例修订通知',
  publishedAt: '2026-06-01',
  originalText: relationText,
  sourceUrl: 'https://example.invalid/DEMO_D2',
};
const c2 = {
  ...clause,
  id: 'DEMO_C2',
  documentId: 'DEMO_D2',
  quote: relationText,
  locator: '示例修订第一段',
  population: ev('年满80周岁且户籍在示例甲区的老人'),
  conditions: ev('年满80周岁且户籍在示例甲区'),
  effectiveFrom: '2026-07-01',
  effectiveTo: null,
  effectiveFromEvidence: ev('自2026年7月1日起'),
  effectiveToEvidence: null,
  actions: [ev('提交申请')],
  materials: [ev('身份证'), ev('示例登记表')],
  channels: [ev('社区窗口')],
  schedule: ev('工作日上午'),
  location: ev('示例社区一号窗口'),
  relations: [
    {
      type: 'replaces',
      targetClauseId: 'DEMO_C1',
      targetVersion: 1,
      evidence: ev('示例修订条款替代示例条款DEMO_C1'),
    },
  ],
};
const d3 = {
  ...document,
  id: 'DEMO_D3',
  title: '【虚构】日期不明的示例通知',
  originalText: '【虚构开发样例】示例甲区可以到社区窗口咨询申请。',
  sourceUrl: 'https://example.invalid/DEMO_D3',
  publishedAt: null,
};
const c3 = {
  ...clause,
  id: 'DEMO_C3',
  documentId: 'DEMO_D3',
  quote: d3.originalText,
  population: null,
  conditions: null,
  effectiveFrom: null,
  effectiveTo: null,
  effectiveFromEvidence: null,
  effectiveToEvidence: null,
  actions: [ev('咨询申请')],
  materials: null,
  channels: [ev('社区窗口')],
  schedule: null,
  location: null,
};
batch.documents.push(d2, d3);
batch.clauses.push(c2, c3);
await mkdir('../data/demo', { recursive: true });
await mkdir('../data/official', { recursive: true });
await writeFile('../data/demo/batch.json', JSON.stringify(batch, null, 2) + '\n');
await writeFile('../data/demo/update-clause.json', JSON.stringify(revision, null, 2) + '\n');
// 正式模板可能已由队友填写，重建demo时不覆盖它。
await writeTemplate(
  '../data/official/batch.template.json',
  JSON.stringify(
    {
      schemaVersion: 1,
      actor: '<人工核对人>',
      reason: '<导入原因>',
      regions: [],
      documents: [],
      clauses: [],
    },
    null,
    2,
  ) + '\n',
);
