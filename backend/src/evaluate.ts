import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  suiteSchema,
  checkOutput,
  callGuide,
  automaticMetrics,
  applicableMetrics,
  catalogEntry,
  type Check,
  type Catalog,
  type Case,
} from './evaluation.js';
import { parseBatch } from './model.js';
import { pool } from './db.js';
import { snapshot, getInSnapshot } from './query.js';

const { values } = parseArgs({
  options: {
    cases: { type: 'string', default: '../eval/demo/cases.json' },
    results: { type: 'string' },
    catalog: { type: 'string', default: '../data/demo/batch.json' },
    'catalog-db': { type: 'boolean' },
    'include-demo': { type: 'boolean' },
    out: { type: 'string', default: '../reports/business-not-executed' },
    mock: { type: 'boolean' },
  },
});
async function main() {
  const raw = await readFile(values.cases!, 'utf8'),
    suite = suiteSchema.parse(JSON.parse(raw));
  let catalogRaw: string, catalog: Catalog;
  if (values['catalog-db']) {
    const db = await pool();
    try {
      const s = await snapshot(db);
      catalogRaw = JSON.stringify(s);
      const ids = [...new Set(s.versions.filter((v) => v.kind === 'clause').map((v) => v.data.id))];
      catalog = new Map(
        ids
          .flatMap((id) =>
            getInSnapshot(s, id, { includeHistory: true, includeDemo: values['include-demo'] }),
          )
          .map((r) => [
            `${r.clause.id}@${r.clause.version}`,
            catalogEntry(r.source, r.clause.regionCodes, s.regions),
          ]),
      );
    } finally {
      await db.end();
    }
  } else {
    catalogRaw = await readFile(values.catalog!, 'utf8');
    const batch = parseBatch(JSON.parse(catalogRaw), values.catalog);
    catalog = new Map(
      batch.clauses.map((c) => {
        const d = batch.documents.find(
          (d) => d.id === c.documentId && d.version === c.documentVersion,
        );
        return [
          `${c.id}@${c.version}`,
          catalogEntry(
            { quote: c.quote, url: d?.sourceUrl ?? '', title: d?.title ?? '' },
            c.regionCodes,
            batch.regions,
          ),
        ];
      }),
    );
  }
  const offlineInput = values.results
    ? JSON.parse(await readFile(values.results, 'utf8'))
    : { provenance: 'unverified', outputs: {} };
  if (
    !['actual-business', 'mock-tooling', 'unverified'].includes(offlineInput.provenance) ||
    !offlineInput.outputs ||
    typeof offlineInput.outputs !== 'object' ||
    Array.isArray(offlineInput.outputs)
  )
    throw new Error(
      '离线结果需 {provenance:actual-business|mock-tooling|unverified,outputs:{案例ID:实际响应}}',
    );
  const offline: Record<string, unknown> = offlineInput.outputs;
  let mock: Awaited<ReturnType<(typeof import('../test/mock-guide.js'))['startMock']>> | undefined;
  let url = process.env.EVAL_URL;
  if (values.results && (url || values.mock))
    throw new Error('离线 --results 不能与 EVAL_URL 或 --mock 同时使用');
  const timeoutMs = Number(process.env.EVAL_TIMEOUT_MS ?? (values.mock ? 100 : 10000));
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 4294967295)
    throw new Error('EVAL_TIMEOUT_MS 必须为1至4294967295的整数毫秒');
  if (values.mock) {
    mock = await (await import('../test/mock-guide.js')).startMock(suite.cases, catalog);
    url = mock.url;
  }
  const mode = values.mock
    ? 'mock-tooling'
    : values.results
      ? `offline-${offlineInput.provenance}`
      : url
        ? 'business-http'
        : 'not-executed';
  const results: {
    id: string;
    group: Case['group'];
    description: string;
    input: Case['input'];
    expected: Case['expected'];
    humanExpectedVerified: string;
    actual: unknown;
    error: string | null;
    checks: Check[];
    manualReview: {
      status: string;
      adviceCorrect: null;
      citationSupportsConclusion: null;
      notes: string;
    };
  }[] = [];
  try {
    for (const c of suite.cases) {
      let actual: unknown = null,
        error: string | null = null,
        checks: Check[];
      if (!url && !Object.hasOwn(offline, c.id)) {
        checks = [...applicableMetrics(c), ...(values.results ? [] : ['transport'])].map(
          (name) => ({
            name,
            status: 'not_executed' as const,
            reason: '未提供业务接口或该案例的离线实际输出',
          }),
        );
      } else {
        try {
          actual = url ? await callGuide(url, c, timeoutMs) : offline[c.id];
          checks = [
            ...(url ? [{ name: 'transport', status: 'pass' as const, reason: '' }] : []),
            ...checkOutput(c, actual, catalog),
          ];
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          checks = [
            { name: 'transport', status: 'fail', reason: error },
            ...applicableMetrics(c).map((name) => ({
              name,
              status: 'not_executed' as const,
              reason: '接口错误或超时，未取得输出',
            })),
          ];
        }
      }
      results.push({
        id: c.id,
        group: c.group,
        description: c.description,
        input: c.input,
        expected: c.expected,
        humanExpectedVerified: c.humanVerified,
        actual,
        error,
        checks,
        manualReview: {
          status: 'pending',
          adviceCorrect: null,
          citationSupportsConclusion: null,
          notes: '',
        },
      });
    }
  } finally {
    await mock?.close();
  }
  let codeVersion = 'not-a-git-repository';
  try {
    codeVersion = execFileSync('git', ['rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {}
  const groups = Object.fromEntries(
    ['demo', 'real', 'holdout'].map((group) => {
      const groupResults = results.filter((r) => r.group === group),
        checks = groupResults.flatMap((r) => r.checks);
      const metrics = Object.fromEntries(
        [...automaticMetrics, 'transport'].map((name) => {
          const list = checks.filter((c) => c.name === name),
            executed = list.filter((c) => c.status !== 'not_executed');
          return [
            name,
            {
              numerator: executed.filter((c) => c.status === 'pass').length,
              denominator: executed.length,
              failed: executed.filter((c) => c.status === 'fail').length,
              notExecuted: list.length - executed.length,
            },
          ];
        }),
      );
      return [
        group,
        {
          cases: groupResults.length,
          pass: checks.filter((c) => c.status === 'pass').length,
          fail: checks.filter((c) => c.status === 'fail').length,
          notExecuted: checks.filter((c) => c.status === 'not_executed').length,
          manualReview: groupResults.length,
          metrics,
        },
      ];
    }),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    notices: suite.cases.length ? [] : ['测试集为空，未执行任何案例，不能计为通过。'],
    codeVersion,
    dataVersion: createHash('sha256').update(catalogRaw).digest('hex'),
    testSetVersion: suite.version,
    testSetHash: createHash('sha256').update(raw).digest('hex'),
    catalogSource: values['catalog-db'] ? 'database-snapshot' : values.catalog,
    catalogApprovalVerified: Boolean(values['catalog-db']),
    endpoint: url ? new URL(url).origin : null,
    groups,
    results,
  };
  await mkdir(path.dirname(values.out!), { recursive: true });
  await writeFile(`${values.out}.json`, JSON.stringify(report, null, 2) + '\n');
  const lines = [
    `# 评测记录：${mode}`,
    '',
    `代码：${codeVersion}；测试集：${suite.version}`,
    '',
    `资料哈希：${report.dataVersion}`,
    '',
    ...report.notices,
    '',
    '自动检查仅核验格式与目录一致性；建议正确性和引用支持关系全部待人工复核。离线目录不证明数据库已发布。',
    '分母为该指标实际执行的检查数；未执行单列；不适用的指标不建立检查项；0/0 不表示通过。',
    '',
    ...Object.entries(groups).flatMap(([g, s]) => [
      `${g}: 案例 ${s.cases}，检查通过 ${s.pass}，失败 ${s.fail}，未执行 ${s.notExecuted}，人工复核 ${s.manualReview}`,
      ...Object.entries(s.metrics).map(
        ([m, v]) =>
          `- ${m}: ${v.numerator}/${v.denominator}；失败 ${v.failed}；未执行 ${v.notExecuted}`,
      ),
      '',
    ]),
    '| 案例 | 检查 | 结果 | 原因 |',
    '|---|---|---|---|',
    ...results.flatMap((r) =>
      r.checks.map(
        (c) => `| ${r.id} | ${c.name} | ${c.status} | ${c.reason.replaceAll('|', '/')} |`,
      ),
    ),
  ];
  await writeFile(`${values.out}.md`, lines.join('\n') + '\n');
  console.log(
    JSON.stringify(
      {
        mode,
        groups: Object.fromEntries(
          Object.entries(groups).map(([g, { metrics: _metrics, ...summary }]) => [g, summary]),
        ),
        output: values.out,
      },
      null,
      2,
    ),
  );
  if (results.some((r) => r.checks.some((c) => c.status === 'fail'))) process.exitCode = 1;
  else if (
    !results.length ||
    results.some((r) => r.checks.some((c) => c.status === 'not_executed'))
  )
    process.exitCode = 2;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
