import { readFile, writeFile } from 'node:fs/promises';
import { suiteSchema } from '../src/evaluation.js';
const root = '../data/official/longyang-pilot/supplement-2026-11-19/';
const cases: any[] = [];
function add(
  id: string,
  text: string,
  region: string | null,
  answers: any,
  status: string,
  questionKey: string | null,
  nextStep: string,
  ids: string[],
  asOf = '2026-11-19',
) {
  cases.push({
    id,
    group: 'real',
    description: '【真实来源·开发联调·预期待核】' + text,
    input: { text, region, answers },
    imagePath: null,
    asOf,
    expected: {
      status,
      questionKey,
      nextStep,
      materials: [],
      references: ids.map((clauseId) => ({ clauseId, version: 1 })),
      forbidden: [
        '2026年全年都是1000元',
        '2026年1月已经统一1000元',
        '肯定会补发差额',
        '省级最低300就是隆阳实发金额',
        '所有优待都免费',
        '优待证作废了',
      ],
    },
    humanVerified: 'pending',
  });
}
add(
  'LY_AMOUNT_01',
  '我奶奶100岁，户籍隆阳，到底是350还是1000？',
  '530502',
  { age: 100, householdRegion: '530502' },
  'need_info',
  'recordMonth',
  '先问要核对哪一年、哪一月；不先给当前或全年金额。',
  [],
);
add(
  'LY_AMOUNT_02',
  '我奶奶100岁，问2026年2月是350还是1000？',
  null,
  { age: 100, recordMonth: '2026-02' },
  'need_info',
  'householdRegion',
  '先问奶奶户籍在哪个区县；区县未确认不套用隆阳或邻区记录。',
  [],
);
for (const [month, rate, id] of [
  ['2026-01', 350, 'BS_GLT_202601_LY_100PLUS'],
  ['2026-02', 350, 'BS_GLT_202602_LY_100PLUS'],
  ['2026-09', 1000, 'BS_GLT_202609_LY_100PLUS'],
] as const)
  add(
    'LY_AMOUNT_' + (cases.length + 1).toString().padStart(2, '0'),
    `奶奶户籍隆阳，100岁，问${month}是350还是1000？`,
    '530502',
    { age: 100, householdRegion: '530502', recordMonth: month },
    'needs_review',
    null,
    `指出${month}公开统计隆阳百岁档列${rate}元/月，展示月份及来源；提标文件、生效日和差额补发规则未知，不能保证个人到账。`,
    [id],
  );
add(
  'LY_AMOUNT_06',
  '奶奶户籍施甸，100岁，2026年2月能按隆阳350元领吗？',
  '530521',
  { age: 100, householdRegion: '530521', recordMonth: '2026-02' },
  'needs_review',
  null,
  '用施甸同月行列1000元/月，不混入隆阳350元；仍仅说明统计记录。',
  ['BS_GLT_202602_SD_100PLUS'],
);
add(
  'LY_AMOUNT_07',
  '奶奶户籍隆阳，问2026年3月是不是已经1000元？',
  '530502',
  { age: 100, householdRegion: '530502', recordMonth: '2026-03' },
  'needs_review',
  null,
  '本包没有3月月报或提标文件，不用前后月份插值，不将9月1000回填。',
  [],
);
add(
  'LY_AMOUNT_08',
  '奶奶户籍隆阳，问2026年5月长寿补助和补发差额。',
  '530502',
  { age: 100, householdRegion: '530502', recordMonth: '2026-05' },
  'needs_review',
  null,
  '展示二季度备注列1000元/月的上下文，说明尚非5月个人到账记录；提标生效日和是否补发差额待核。',
  ['LY_GLT_2026Q2_REPORTED_RATE'],
);
add(
  'LY_AMOUNT_09',
  '现在2026年11月，奶奶100岁户籍隆阳，一定是1000元了吗？',
  '530502',
  { age: 100, householdRegion: '530502', recordMonth: '2026-11' },
  'needs_review',
  null,
  '本包缺11月记录与调整文件，不回退9月金额当作当前保证标准。',
  [],
);
add(
  'LY_FLOW_01',
  '省文件说免申，区里二季度又写本人申请，我没接到电话，还要亲自去社区吗？',
  '530502',
  { age: 83, householdRegion: '530502' },
  'needs_review',
  null,
  '并列省级免申即享与区级备注本人申请的证据；问经办端是否需本人到场、未接到联系怎样核实，附养老股0875-2229150，不擅解为过渡或补录。',
  [
    'YN_GLT_AUTO_PROCESS',
    'YN_GLT_MISSING_LIST',
    'YN_ELDER_ONE_SERVICE_2026_HIGH_FLOW',
    'LY_GLT_2026Q2_APPLICATION_NOTE',
    'LY_MZ_ELDERLY_CONTACT',
  ],
);
add(
  'LY_ECON_01',
  '隆阳经济困难老人补贴是不是取消了？现在还要申请吗？',
  '530502',
  { age: 82, householdRegion: '530502' },
  'needs_review',
  null,
  '保留2023试行期限与2026免申流程；9月统计仅作发放事实，标题年度待核；接续正式办法未取得，不能宣称补贴取消或旧办法自动续期。',
  [
    'YN_ECON_SERVICE_2023_2_VALIDITY',
    'YN_ELDER_ONE_SERVICE_2026_ECON_FLOW',
    'BS_ECON_09_LY_REPORTED_PAYMENT',
    'LY_MZ_ECON_CONTACT',
  ],
);
for (const [id, text, ref, next] of [
  [
    'YN_CARD_01',
    '我在隆阳，刚满60岁，2026年还要办老年优待证吗？',
    'YN_ELDER_CARD_STOP_NEW',
    '说明2026-01-01起不再新办、换发、补办，凭本人有效居民身份证核验；具体服务优待范围仍按其规则。',
  ],
  [
    'YN_CARD_02',
    '我在隆阳，以前办的老年优待证2026年还能用吗？',
    'YN_ELDER_CARD_OLD_VALID',
    '说明原已办理证可继续使用，也可凭本人有效居民身份证；不能说旧证作废或全部服务免费。',
  ],
  [
    'YN_CARD_03',
    '我在隆阳，老年优待证丢了，2026年要去补办吗？',
    'YN_ELDER_CARD_STOP_NEW',
    '说明不再补办，凭本人有效居民身份证核验；未说明身份证丢失，不自行推算替代证件。',
  ],
] as const)
  add(id, text, '530502', { age: 60, householdRegion: '530502' }, 'ready', null, next, [
    ref,
    'YN_ELDER_CARD_ID_60PLUS',
  ]);
add(
  'YN_CARD_04',
  '2025年12月31日，我在隆阳办证，也能直接按2026年不用办的通知处理吗？',
  '530502',
  { age: 60, householdRegion: '530502' },
  'needs_review',
  null,
  '说明该通知2026-01-01施行，不能用于覆盖2025-12-31；旧时点的具体办理依据待补。',
  [],
  '2025-12-31',
);
const suite = { version: 'longyang-payment-and-card-2026-11-19-v1-pending', cases };
suiteSchema.parse(suite);
await writeFile(root + 'guide.cases.json', JSON.stringify(suite, null, 2) + '\n', { flag: 'wx' });
await writeFile(
  root + 'case-review.json',
  JSON.stringify(
    cases.map((c) => ({
      id: c.id,
      status: 'pending',
      rule: '用于未来审核资料联调；当前无/api/guide业务执行，不以关键词通过代替政策语义审核。',
      monthAndDistrictCorrect: null,
      recordVersusPolicyCorrect: null,
      adviceSupported: null,
      reviewer: null,
      reviewedAt: null,
    })),
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    cases: cases.length,
    humanVerified: 'pending',
    businessEndpointExecuted: false,
  }),
);
