import { readFile, writeFile, mkdir } from 'node:fs/promises';
async function writeTemplate(file, content) {
  try {
    await writeFile(file, content, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}
const batch = JSON.parse(await readFile('../data/demo/batch.json', 'utf8'));
const spec = [
  [
    '完整本地通知',
    'ready',
    null,
    ['DEMO_C2'],
    ['身份证', '示例登记表'],
    '携带身份证和示例登记表到示例窗口提交申请',
  ],
  ['缺少办理地区', 'need_info', 'region', [], [], '请补充办理区县'],
  ['缺少影响结论的年龄条件', 'need_info', 'age', [], [], '请问申请人年龄'],
  ['邻区通知不能直接适用', 'needs_review', null, [], [], '向办理地社区核实适用规定'],
  [
    '有明确替代依据的旧条款',
    'ready',
    null,
    ['DEMO_C2'],
    ['身份证', '示例登记表'],
    '按修订条款准备材料',
  ],
  [
    '新旧关系尚未确认',
    'needs_review',
    null,
    ['DEMO_C2', 'DEMO_C3'],
    [],
    '请社区确认新旧关系与生效时间',
  ],
  [
    '官网资料与无来源通知存在冲突',
    'needs_review',
    null,
    ['DEMO_C2'],
    [],
    '请社区确认无来源通知的真实性及是否调整受理渠道',
  ],
  ['通知引用未审核资料', 'needs_review', null, [], [], '等待官方资料人工核对'],
  ['超出资料覆盖范围', 'needs_review', null, [], [], '向当地社区索取适用资料'],
  [
    '缺少办理时间地点依据或通知落款',
    'needs_review',
    null,
    ['DEMO_C3'],
    [],
    '请社区确认日期、时间和地点',
  ],
  [
    '引用不能支持建议（工具自测注入错误）',
    'ready',
    null,
    ['DEMO_C2'],
    ['身份证', '示例登记表'],
    '核对引用是否支持建议',
  ],
  ['接口错误（工具自测注入HTTP500）', 'needs_review', null, [], [], '提示重试，不能当作政策结果'],
  ['接口超时（工具自测延迟）', 'needs_review', null, [], [], '保留输入并提示重试'],
];
const current = batch.clauses[1].quote,
  unknown = batch.clauses[2].quote;
const texts = [
  `${current} 我今年82岁，户籍在示例甲区，下一步怎样申请？`,
  `${current} 我想申请，但还没说准备在哪个区办理。`,
  `${current} 我户籍在示例甲区，还没有填写年龄。`,
  `${current} 我住在示例乙区，户籍也在示例乙区，能照甲区通知办理吗？`,
  `${batch.clauses[0].quote} 这是一张旧通知，现在是2026年11月16日，材料仍只带身份证吗？`,
  `${unknown} 这份无日期通知是后来发的吗？是否已经调整修订通知的要求？`,
  `${current} 另收到一张没有日期和官网来源的通知，声称社区窗口已停止受理，只能找私人中介。这两份说法冲突，请核实。`,
  '【虚构、尚未审核的草稿通知】据称示例甲区新增一项未核实服务，只需要提供银行账户就能领款。尚无人工核对的官方文件。可以照做吗？',
  `${current} 我办理地与户籍在尚未建立资料的示例丙区，请告诉我当地要求。`,
  `${unknown} 截图没有落款、日期和具体地址。我指的是这张通知里的咨询事项，哪天、去哪一个窗口？`,
  `${current} 请给我有原文依据的下一步，不要添加原文没有的福利或动作。`,
  `${current} 请核验。（评测工具模拟后端返回HTTP500）`,
  `${current} 请核验。（评测工具模拟后端超时）`,
];
const cases = spec.map(([description, status, questionKey, refs, materials, nextStep], i) => ({
  id: `DEMO_E${String(i + 1).padStart(2, '0')}`,
  group: 'demo',
  description: `【虚构】${description}`,
  input: {
    text: texts[i],
    region: i === 1 ? null : i === 3 ? 'DEMO_B' : i === 8 ? 'DEMO_OUTSIDE' : 'DEMO_A',
    answers:
      i === 2
        ? { householdRegion: 'DEMO_A' }
        : { age: 82, householdRegion: i === 3 ? 'DEMO_B' : i === 8 ? 'DEMO_OUTSIDE' : 'DEMO_A' },
  },
  imagePath: null,
  asOf: '2026-11-16',
  expected: {
    status,
    questionKey,
    nextStep,
    materials,
    references: refs.map((clauseId) => ({ clauseId, version: 1 })),
    forbidden: ['保证审批通过', ...(i === 9 ? ['每周一上午九点', '真实社区服务中心'] : [])],
  },
  humanVerified: 'pending',
}));
await mkdir('../eval/demo', { recursive: true });
await mkdir('../eval/real', { recursive: true });
await mkdir('../eval/holdout', { recursive: true });
await writeFile(
  '../eval/demo/cases.json',
  JSON.stringify({ version: 'demo-v1', cases }, null, 2) + '\n',
);
// 保留后续人工补入的真实案例、留出集和OCR清单。
for (const group of ['real', 'holdout'])
  await writeTemplate(
    `../eval/${group}/cases.json`,
    JSON.stringify({ version: `${group}-unpopulated`, cases: [] }, null, 2) + '\n',
  );
await writeTemplate(
  '../eval/ocr-manifest.template.json',
  JSON.stringify(
    {
      version: 'ocr-unpopulated',
      executed: false,
      cases: [],
      fields: [
        'id',
        'imagePath',
        'sourceConsent',
        'expectedText',
        'criticalRegionDateFields',
        'actualText',
        'failureReason',
        'humanReview',
      ],
    },
    null,
    2,
  ) + '\n',
);
