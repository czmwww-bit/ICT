import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseBatch, validateLinks, type Clause, type Document } from '../src/model.js';
const root = '../data/official/longyang-pilot/supplement-2026-11-19/';
try {
  await access(root + 'batch.draft.json');
  throw new Error('补充批次已存在；请新建版本，不覆盖已整理记录');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const mainRaw = await readFile('../data/official/longyang-pilot/batch.draft.json', 'utf8');
const main = parseBatch(JSON.parse(mainRaw));
const acquisition = JSON.parse(await readFile(root + 'acquisition.json', 'utf8'));
const reuse = [
  'YN_GLT_PROVINCIAL_RATES',
  'YN_GLT_AUTO_PROCESS',
  'YN_GLT_MISSING_LIST',
  'YN_ELDER_ONE_SERVICE_2026_HIGH_FLOW',
  'YN_ELDER_ONE_SERVICE_2026_ECON_FLOW',
  'YN_ECON_SERVICE_2023_2_VALIDITY',
  'YN_ECON_SERVICE_2023_2_OBJECT',
];
const clauses: Clause[] = main.clauses.filter((c) => reuse.includes(c.id));
const documents: Document[] = main.documents.filter((d) =>
  clauses.some((c) => c.documentId === d.id),
);
const metadata: any[] = [],
  reviewItems: any[] = [];
const bySource = new Map<string, any>(acquisition.records.map((r: any) => [r.id, r]));
const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const evidence = (text: string, quote: string, locator: string) => ({ text, quote, locator });
const identity = {
  version: 1,
  expectedVersion: 0,
  dataset: 'official' as const,
  reviewStatus: 'draft' as const,
  reviewedBy: null,
  reviewedAt: null,
};
async function addDoc(
  sourceId: string,
  id: string,
  publisher: string,
  regions: string[],
  extra: any = {},
) {
  const source = bySource.get(sourceId);
  assert.equal(source?.status, 'full_text_retrieved', sourceId + '未取得全文');
  const text = await readFile(root + source.textFile, 'utf8');
  assert.equal(hash(text), source.textSha256);
  const doc: Document = {
    ...identity,
    id,
    title: source.title,
    publisher,
    sourceUrl: source.url,
    regionCodes: regions,
    publishedAt: source.webPublishedAt?.slice(0, 10) ?? null,
    originalText: text,
    originalPath: root + source.rawFile,
    checkedAt: null,
    checkedBy: null,
    effectiveFrom: null,
    effectiveTo: null,
    effectiveFromEvidence: null,
    effectiveToEvidence: null,
  };
  documents.push(doc);
  metadata.push({
    documentId: id,
    sourceId,
    sourceType: extra.sourceType ?? 'payment_statistics',
    webPublisher: extra.webPublisher ?? publisher,
    originalIssuer: publisher,
    signedAt: null,
    originalPublicReleaseAt: null,
    webPublishedAt: doc.publishedAt,
    policyEffectiveFrom: null,
    policyEffectiveTo: null,
    acquisition: source,
    reviewStatus: 'pending',
    ...extra,
  });
  return doc;
}
function addClause(
  doc: Document,
  id: string,
  matterId: string,
  quote: string,
  locator: string,
  question: string,
  extra: Partial<Clause> = {},
) {
  assert.ok(doc.originalText.includes(quote), id + '引用原文不连续');
  const c: Clause = {
    ...identity,
    id,
    documentId: doc.id,
    documentVersion: 1,
    matterId,
    matterName:
      matterId === 'HIGH_AGE_ALLOWANCE'
        ? '高龄津贴与长寿补助'
        : matterId === 'ECONOMIC_ELDERLY_SERVICE'
          ? '经济困难老年人服务补贴'
          : '老年优待凭证',
    regionCodes: ['530502'],
    quote,
    locator,
    population: null,
    conditions: null,
    effectiveFrom: null,
    effectiveTo: null,
    effectiveFromEvidence: null,
    effectiveToEvidence: null,
    actions: null,
    materials: null,
    channels: null,
    contacts: null,
    schedule: null,
    location: null,
    relations: [],
    ...extra,
  };
  clauses.push(c);
  reviewItems.push({
    documentId: doc.id,
    clauseId: id,
    version: 1,
    matterId,
    structured: extra,
    quote,
    locator,
    sourceUrl: doc.sourceUrl,
    reviewStatus: 'pending',
    question,
    reviewer: null,
    reviewedAt: null,
  });
  return c;
}
const rateQuestion =
  '仅说明该月/季度公开发放记录。地方提标文件、确切生效日和补发差额规则未知，不扩展为全年或当前保证金额。原表“100周岁以上”与100岁档的标准化映射待人工核对。';
for (const [sourceId, docId, month, expectedRate] of [
  ['BS-202601', 'BS_GLT_202601', '2026-01', 350],
  ['BS-202602', 'BS_GLT_202602', '2026-02', 350],
  ['BS-202608', 'BS_GLT_202608', '2026-08', 1000],
  ['BS-202609', 'BS_GLT_202609', '2026-09', 1000],
] as const) {
  const d = await addDoc(sourceId, docId, '保山市民政局', ['530500']);
  const source = bySource.get(sourceId),
    table = source.tables[0];
  for (const [region, label, suffix] of [
    ['530502', '隆阳区', 'LY'],
    ...(month === '2026-02' ? [['530521', '施甸县', 'SD']] : []),
  ] as string[][]) {
    const row = table.rows.find((r: any) => r.cells[0]?.text === label);
    assert.ok(row);
    const cells = row.cells.map((c: any) => c.text);
    assert.equal(Number(cells[6]), region === '530502' ? expectedRate : 1000);
    const locator = `正文表1第${row.row}行“${label}”，结合表头“发放标准（元/月）/100周岁以上”；完整行和合并单元格见acquisition.json`;
    addClause(
      d,
      `${docId}_${suffix}_100PLUS`,
      'HIGH_AGE_ALLOWANCE',
      d.originalText,
      locator,
      rateQuestion,
      {
        regionCodes: [region!],
        paymentRecord: {
          kind: 'monthly_statistics',
          fromMonth: month,
          toMonth: month,
          periodEvidence: evidence(month, d.title, '网页标题'),
          ageBandCode: '100_PLUS',
          ageBandLabel: '100周岁以上（原表用语）',
          amountYuanPerPersonMonth: Number(cells[6]),
          recipientCount: Number(cells[3]),
          totalPaidYuan: Number(cells[9]),
          evidence: evidence(
            `${label}，百岁档，${cells[6]}元/人·月`,
            cells.slice(0, 11).join(' | '),
            locator,
          ),
        },
      },
    );
  }
}
const q2 = await addDoc('LY-2026Q2', 'LY_GLT_2026Q2_DISCLOSURE', '隆阳区民政局', ['530502'], {
  sourceType: 'quarterly_disclosure',
});
const note = bySource.get('LY-2026Q2').tables[0].rows[1].cells.at(-1).text;
addClause(
  q2,
  'LY_GLT_2026Q2_REPORTED_RATE',
  'HIGH_AGE_ALLOWANCE',
  q2.originalText,
  '正文表1，第二季度备注及四、五、六月行',
  rateQuestion,
  {
    paymentRecord: {
      kind: 'quarterly_disclosure',
      fromMonth: '2026-04',
      toMonth: '2026-06',
      periodEvidence: evidence(
        '2026年第二季度（4—6月），季度公开备注',
        q2.title,
        '网页标题及表内月份',
      ),
      ageBandCode: '100_PLUS',
      ageBandLabel: '100周岁以上（备注原文）',
      amountYuanPerPersonMonth: 1000,
      recipientCount: null,
      totalPaidYuan: null,
      evidence: evidence('备注列1000元/月；不是提标文件或单月到账凭证', note, '表1备注'),
    },
  },
);
addClause(
  q2,
  'LY_GLT_2026Q2_APPLICATION_NOTE',
  'HIGH_AGE_ALLOWANCE',
  note,
  '正文表1备注',
  '“经本人申请”与省级免申即享流程口径不一致。是否需亲自到社区、未接到联系如何核实？不得自行解释为过渡/补录/网页未更新。',
  { actions: [evidence('备注中的办理流程原文，待与免申即享文件共同核对', note, '正文表1备注')] },
);
const org = await addDoc('LY-MZ-CONTACT', 'LY_MZ_ORGANIZATION', '隆阳区民政局', ['530502'], {
  sourceType: 'organization_directory',
});
const contactQuote = org.originalText.match(
  /（五）老龄工作和养老服务股。[\s\S]*?电话：[\s\S]*?2229150/,
)?.[0];
assert.ok(contactQuote);
for (const [id, matter] of [
  ['LY_MZ_ELDERLY_CONTACT', 'HIGH_AGE_ALLOWANCE'],
  ['LY_MZ_ECON_CONTACT', 'ECONOMIC_ELDERLY_SERVICE'],
])
  addClause(
    org,
    id!,
    matter!,
    contactQuote,
    '内设机构（五）老龄工作和养老服务股及其电话',
    '官网业务股室联系方式，非已接通/人工答复记录；公开日期未知，咨询前复核是否仍使用此号码。',
    {
      contacts: [
        evidence(
          '隆阳区民政局老龄工作和养老服务股：0875-2229150',
          contactQuote,
          '内设机构（五）及其电话',
        ),
      ],
    },
  );
const econ = await addDoc(
  'BS-ECON-202609',
  'BS_ECON_09_PUBLISHED_20261008',
  '保山市民政局',
  ['530500'],
  {
    periodLabel: '9月',
    periodYear: null,
    periodYearIssue: '标题只写9月，公开2026-10-08；不能直接把公开年份当作统计年份，待人工核实。',
  },
);
const econRow = bySource
  .get('BS-ECON-202609')
  .tables[0].rows.find((r: any) => r.cells[0]?.text === '隆阳区');
const econCells = econRow.cells.map((c: any) => c.text);
assert.equal(Number(econCells[4]), 2555);
assert.equal(Number(econCells[5]), 50);
assert.equal(Number(econCells[9]), 127750);
addClause(
  econ,
  'BS_ECON_09_LY_REPORTED_PAYMENT',
  'ECONOMIC_ELDERLY_SERVICE',
  econ.originalText,
  `正文表1第${econRow.row}行“隆阳区”及两层表头`,
  '标题只写9月、未注明年份；2026为网页公开年份。统计所属年度待核，不能自动作为2026全年标准、现行办法或个人资格依据。表内未列年龄档。',
  {
    paymentRecord: {
      kind: 'monthly_statistics',
      fromMonth: null,
      toMonth: null,
      periodEvidence: evidence('9月；统计年度未知', '9月', '网页标题'),
      ageBandCode: 'UNSPECIFIED',
      ageBandLabel: '原表未列年龄档',
      amountYuanPerPersonMonth: 50,
      recipientCount: 2555,
      totalPaidYuan: 127750,
      evidence: evidence(
        '隆阳区2555人，50元/人·月，总资金127750元；资金来源列不当作个人金额',
        econCells.join(' | '),
        `表1第${econRow.row}行及表头`,
      ),
    },
  },
);
const card = await addDoc(
  'HH-ELDER-CARD-REPRINT',
  'YN_ELDER_ID_REPLACES_CARD_2025_5',
  '云南省老龄工作委员会办公室',
  ['530000'],
  {
    sourceType: 'formal_notice_reprint',
    webPublisher: '红河哈尼族彝族自治州人民政府网站',
    signedAt: '2025-12-13',
    originalSourceUrl: bySource.get('YN-ELDER-CARD-PRIMARY').url,
    originalSourceFetchStatus: 'HTTP 404',
    originalReleaseCandidate: '2025-12-17，仅检索结果支持，原网页未取得；不填原文件publishedAt',
    policyEffectiveFrom: '2026-01-01',
    repealedDocumentNumbers: ['云老办〔2007〕19号', '云老龄办发〔2021〕3号'],
  },
);
const effect = card.originalText.match(/本通知自2026年1月1日起施行。/)?.[0];
assert.ok(effect);
card.effectiveFrom = '2026-01-01';
card.effectiveFromEvidence = evidence('2026-01-01', effect, '四、其他事项');
const cardIntro = card.originalText.split('\n\n').find((p) => p.includes('决定自2026年1月1日起'))!;
assert.ok(cardIntro);
for (const [id, topic] of [
  ['YN_ELDER_CARD_STOP_NEW', '不再新办、换发和补办'],
  ['YN_ELDER_CARD_OLD_VALID', '原已办理的证可继续使用'],
  ['YN_ELDER_CARD_ID_60PLUS', '年满60周岁可凭有效居民身份证核验'],
])
  addClause(
    card,
    id!,
    'ELDERLY_PREFERENTIAL_CREDENTIAL',
    cardIntro,
    '通知引言完整段落',
    '保留省级范围和2026-01-01边界；不推断所有服务免费、异地专用乘车卡免办或身份证丢失时的替代材料。',
    {
      regionCodes: ['530000'],
      effectiveFrom: '2026-01-01',
      effectiveFromEvidence: evidence('2026-01-01', effect, '四、其他事项'),
      actions: [evidence(topic!, cardIntro, '引言')],
      population:
        id === 'YN_ELDER_CARD_ID_60PLUS'
          ? evidence('全省年满60周岁及以上，凭本人有效居民身份证', cardIntro, '引言')
          : null,
    },
  );
const batch = parseBatch({
  schemaVersion: 1,
  actor: '成员③资料补充，待人工审核',
  reason: '按月份保留发放记录、流程口径冲突和优待凭证时间边界',
  regions: [
    ...main.regions,
    { code: '530521', name: '施甸县', parentCode: '530500', dataset: 'official' },
  ],
  documents,
  clauses,
});
assert.deepEqual(validateLinks(batch), []);
await writeFile(root + 'batch.draft.json', JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' });
await writeFile(root + 'document-metadata.json', JSON.stringify(metadata, null, 2) + '\n', {
  flag: 'wx',
});
await writeFile(root + 'review-items.json', JSON.stringify(reviewItems, null, 2) + '\n', {
  flag: 'wx',
});
await writeFile(
  root + 'manifest.json',
  JSON.stringify(
    {
      sourceMainBatchSha256: hash(mainRaw),
      documents: documents.length,
      clauses: clauses.length,
      reusedDocuments: 3,
      reusedClauses: reuse.length,
      newDocuments: metadata.length,
      newClauses: reviewItems.length,
      reviewStatus: 'pending',
      importedToProject: false,
      published: false,
      batchSha256: hash(await readFile(root + 'batch.draft.json')),
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    documents: documents.length,
    clauses: clauses.length,
    newDocuments: metadata.length,
    newClauses: reviewItems.length,
  }),
);
