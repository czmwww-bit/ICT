import { readFile, writeFile, access } from 'node:fs/promises';
const out = '../eval/real/longyang-boundaries.cases.json';
try {
  await access(out);
  throw new Error('边界案例已存在，拒绝覆盖人工预期');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const suite = JSON.parse(await readFile('../eval/real/longyang-development.cases.json', 'utf8'));
const source = suite.cases[0];
function add(id, description, text, answers, status, nextStep, ids) {
  suite.cases.push({
    id,
    group: 'real',
    description: '【真实来源·边界开发·预期待人工核对】' + description,
    input: { text, region: '530502', answers },
    imagePath: null,
    asOf: '2026-11-16',
    expected: {
      status,
      questionKey: null,
      nextStep,
      materials: [],
      references: ids.map((clauseId) => ({ clauseId, version: 1 })),
      forbidden: [...source.expected.forbidden, '发布日期就是生效日期', '79岁自动符合80岁条件'],
    },
    humanVerified: 'pending',
  });
}
add(
  'LY_BOUNDARY_19',
  '达龄前',
  '我隆阳户籍，79岁，下个月满80，本月能按80岁高龄津贴规则发吗？',
  { age: 79, turns80Month: '2026-12', householdRegion: '530502' },
  'ready',
  '展示含满80当月规则，核对达龄月份，不把79岁认作满足80岁条件，不承诺到账日。',
  ['YN_GLT_ELIGIBILITY', 'YN_GLT_MONTHLY_PAYMENT'],
);
add(
  'LY_BOUNDARY_20',
  '达龄当月',
  '我本月满80岁，云南户籍，村里已核实名单，想核对从哪月起算高龄津贴。',
  { age: 80, turns80Month: '2026-11', householdRegion: '530502', listVerified: true },
  'ready',
  '依据符合条件当月起算条款核对本月明细，实际发放由经办审核，不承诺固定到账日。',
  ['YN_GLT_ELIGIBILITY', 'YN_GLT_MONTHLY_PAYMENT'],
);
add(
  'LY_BOUNDARY_21',
  '99岁省级档',
  '只问云民发113号省级标准：99岁是哪档？不问隆阳实发金额。',
  { age: 99, questionScope: 'provincial_standard' },
  'ready',
  '按原文件80-99岁每人每月50元的省级档说明，地方实际标准另核。',
  ['YN_GLT_PROVINCIAL_RATES'],
);
add(
  'LY_BOUNDARY_22',
  '100岁省级档',
  '我今年100岁，只想核对113号里省级金额，不想把它当隆阳当前实发额。',
  { age: 100, questionScope: 'provincial_standard' },
  'ready',
  '按文件省级100及以上每人每月300元说明；隆阳旧350及2026统计线索不能直接据此取舍。',
  ['YN_GLT_PROVINCIAL_RATES', 'LY_GLT_WADU_2025_LOCAL_RATES'],
);
add(
  'LY_BOUNDARY_23',
  '网页发布与施行不同',
  '个旧附件页2024年12月4日公开，是否从12月4日就按113号免申即享？',
  { noticePagePublished: '2024-12-04' },
  'ready',
  '说明网页公开与文件2025-01-01施行分别记录，不能从转载日推断政策起始。',
  ['YN_GLT_EFFECT_AND_REPEAL'],
);
add(
  'LY_BOUNDARY_24',
  '施行前查询',
  '我要核对2024年12月31日在隆阳的办理方式，能把113号免申当成已生效依据吗？',
  { queryDate: '2024-12-31', householdRegion: '530502' },
  'needs_review',
  '113号尚未到明确施行日，不作当时现行依据；当时完整地方文件尚待补。',
  ['YN_GLT_EFFECT_AND_REPEAL', 'LY_GLT_HISTORY_2021_APPLY'],
);
add(
  'LY_BOUNDARY_25',
  '施行日起查询',
  '按113号规定，自2025年1月1日免申即享还需核实资格吗？',
  { queryDate: '2025-01-01', householdRegion: '530502', age: 82 },
  'ready',
  '施行日起仍按信息核查与县级审核确定发放资格；免申请不等于免核实。',
  ['YN_GLT_EFFECT_AND_REPEAL', 'YN_GLT_AUTO_PROCESS'],
);
add(
  'LY_BOUNDARY_26',
  '省级最低与地方网页分层',
  '我看见省级百岁300和瓦渡2025年350，请确认不能当成同一个标准。',
  { age: 100, householdRegion: '530502' },
  'needs_review',
  '分别说明层级与来源，补隆阳当前调整文件后再给当地实发结论。',
  ['YN_GLT_PROVINCIAL_RATES', 'LY_GLT_WADU_2025_LOCAL_RATES'],
);
add(
  'LY_BOUNDARY_27',
  '高龄户籍与消费补贴常住不同',
  '我四川户籍、70岁常住隆阳，中度失能，没有三类排除待遇，是否因不是云南户籍不能申请消费补贴？',
  {
    age: 70,
    householdProvince: '510000',
    residenceRegion: '530502',
    assessmentLevel: '中度失能',
    exclusions: false,
  },
  'ready',
  '展示消费补贴云南常住认定条款，不套用高龄津贴云南户籍80岁门槛；常住认定材料按经办核准。',
  ['YN_CONSUMPTION_2026_4_OBJECT', 'YN_CONSUMPTION_2026_4_PROXY'],
);
add(
  'LY_BOUNDARY_28',
  '草稿不能当审核依据',
  '网页已经下载就表示你们资料库已经审核可以保证办理吗？',
  { documentDownloaded: true },
  'needs_review',
  '下载、资料人工审核和资格审批是不同步骤；当前真实资料待审核，不生成保证性结论。',
  [],
);
add(
  'LY_BOUNDARY_29',
  '部分修改缺原文',
  '有人说只修改了失联补发条款，其他高龄规则不变。只有转述，没有新文件，能直接替换吗？',
  { claimedPartialChange: '失联补发', newOfficialText: null },
  'needs_review',
  '保留原条款和其他条款，补正式修订原文、影响范围和日期；不自动构造替代或失效关系。',
  ['YN_GLT_UNREACHABLE', 'YN_GLT_ELIGIBILITY'],
);
add(
  'LY_BOUNDARY_30',
  '项目周期后',
  '2027年1月还能凭2026通知继续领同样的消费券吗？',
  { queryDate: '2027-01-01', residenceRegion: '530502' },
  'needs_review',
  '原文实施周期为2026年1至12月，未取得续行依据，不能把未知文件失效日当项目永久有效。',
  ['CN_CONSUMPTION_LAUNCH_2026_CYCLE', 'YN_CONSUMPTION_2026_4_PERIOD'],
);
suite.version = 'longyang-real-boundaries-2026-11-16-v1-pending';
await writeFile(out, JSON.stringify(suite, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ file: out, cases: suite.cases.length, humanVerified: 'all_pending' }));
