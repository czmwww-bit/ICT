import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { parseBatch, validateLinks, date, checksum, type Stored } from '../src/model.js';
import { findInSnapshot, getInSnapshot, type Snapshot } from '../src/query.js';
import { suiteSchema, checkOutput, catalogEntry, type Catalog } from '../src/evaluation.js';
import { config } from '../src/db.js';

const batch = parseBatch(JSON.parse(await readFile('../data/demo/batch.json', 'utf8')));
const versions: Stored[] = [
  ...batch.documents.map((data) => ({ kind: 'document' as const, data, checksum: checksum(data) })),
  ...batch.clauses.map((data) => ({ kind: 'clause' as const, data, checksum: checksum(data) })),
];
const snapshot: Snapshot = {
  versions,
  regions: batch.regions,
  events: versions.map((s, i) => ({
    sequence_id: i + 1,
    kind: s.kind,
    id: s.data.id,
    version: 1,
    decision: 'approved',
    actor: '隔离夹具',
    reason: '非真实政策',
    reviewed_at: '2026-11-16',
  })),
};

test('导入校验拒绝重复编号和无效日期，保留未知值及中文原文', () => {
  const duplicate = structuredClone(batch);
  duplicate.documents.push(structuredClone(duplicate.documents[0]!));
  duplicate.regions.push(structuredClone(duplicate.regions[0]!));
  const errors = validateLinks(duplicate);
  assert.ok(errors.some((e) => e.includes('批内编号重复')));
  assert.ok(errors.some((e) => e.includes('重复编码')));
  assert.equal(date.parse('2024-02-29'), '2024-02-29');
  assert.throws(() => date.parse('2026-02-29'));
  assert.throws(() => date.parse('2026-13-01'));
  const stored = parseBatch(batch);
  assert.equal(stored.clauses[2]!.effectiveFrom, null);
  assert.equal(stored.clauses[2]!.conditions, null);
  assert.equal(stored.documents[0]!.originalText, batch.documents[0]!.originalText);
  const wrong = structuredClone(batch);
  wrong.clauses[0]!.effectiveTo = '2025-12-31';
  assert.ok(validateLinks(wrong).some((e) => e.includes('早于生效日期')));
});

test('查询按生效边界处理未来、失效和未知记录，不按发布日期自动替代', () => {
  const input = { matterId: 'DEMO_ALLOWANCE', regionCode: 'DEMO_A', includeDemo: true };
  const ids = (day: string) =>
    findInSnapshot(snapshot, { ...input, asOf: day }).map((c) => c.clause.id);
  assert.deepEqual(ids('2025-12-31'), ['DEMO_C3']);
  assert.deepEqual(ids('2026-01-01'), ['DEMO_C1', 'DEMO_C3']);
  assert.deepEqual(ids('2026-06-30'), ['DEMO_C1', 'DEMO_C3']);
  assert.deepEqual(ids('2026-07-01'), ['DEMO_C1', 'DEMO_C2', 'DEMO_C3']);
  assert.ok(ids('2026-12-31').includes('DEMO_C1'));
  assert.ok(!ids('2027-01-01').includes('DEMO_C1'));
  assert.equal(
    findInSnapshot(snapshot, { ...input, asOf: '2025-12-31' })[0]!.timeStatus,
    'needs_review',
  );
  assert.deepEqual(getInSnapshot(snapshot, 'MISSING', { includeDemo: true }), []);
});

test('非法历史版本参数与非法日期明确失败，不能返回成功空结果', () => {
  for (const version of [NaN, 0, -1, 1.5, Infinity])
    assert.throws(
      () =>
        getInSnapshot(snapshot, 'DEMO_C1', { includeDemo: true, includeHistory: true, version }),
      /version 必须为正整数/,
    );
  assert.throws(() =>
    findInSnapshot(snapshot, {
      matterId: 'DEMO_ALLOWANCE',
      regionCode: 'DEMO_A',
      asOf: '2026-02-30',
    }),
  );
});

test('材料名称逐项核验，说明和引文不能凑数；评测编号不能重复', async () => {
  const suite = suiteSchema.parse(JSON.parse(await readFile('../eval/demo/cases.json', 'utf8'))),
    c = suite.cases[0]!;
  const clause = batch.clauses[1]!,
    document = batch.documents[1]!;
  const entry = catalogEntry(
    { quote: clause.quote, url: document.sourceUrl, title: document.title },
    clause.regionCodes,
    batch.regions,
  );
  const catalog: Catalog = new Map([[`${clause.id}@1`, entry]]);
  const actual = {
    status: 'ready',
    nextStep: '提交申请',
    sources: [{ clauseId: clause.id, clauseVersion: 1, ...entry }],
  };
  const result = (materials: unknown) =>
    checkOutput(c, { ...actual, materials }, catalog).find((c) => c.name === 'materials')!.status;
  assert.equal(result(['无需身份证', '示例登记表']), 'fail');
  assert.equal(result([{ text: '户口簿', quote: '身份证' }, '示例登记表']), 'fail');
  assert.equal(result([{ name: '身份证' }, { text: '示例登记表' }]), 'pass');
  const duplicated = suiteSchema.safeParse({ ...suite, cases: [c, c] });
  assert.equal(duplicated.success, false);
  if (!duplicated.success) assert.deepEqual(duplicated.error.issues[0]!.path, ['cases', 1, 'id']);
});

test('CLI空评测集标未执行，字段错误带文件位置，非法超时明确报错', async () => {
  await mkdir('../reports/local', { recursive: true });
  const directory = await mkdtemp(path.join(path.resolve('../reports/local'), 'audit-cli-'));
  const env = { ...process.env };
  delete env.EVAL_URL;
  delete env.EVAL_TIMEOUT_MS;
  const run = (args: string[], extra: Record<string, string> = {}) =>
    spawnSync(process.execPath, ['--import', 'tsx', ...args], {
      encoding: 'utf8',
      env: { ...env, ...extra },
      timeout: 15000,
    });
  const out = path.join(directory, 'empty');
  const empty = run(['src/evaluate.ts', '--cases', '../eval/real/cases.json', '--out', out]);
  assert.equal(empty.status, 2, empty.stderr);
  const report = JSON.parse(await readFile(out + '.json', 'utf8'));
  assert.equal(report.results.length, 0);
  assert.ok(report.notices[0].includes('测试集为空'));
  const invalid = structuredClone(batch);
  invalid.documents[0]!.publishedAt = '2026-02-30';
  const file = path.join(directory, 'invalid.json');
  await writeFile(file, JSON.stringify(invalid));
  const validation = run(['src/cli.ts', 'validate', '--file', file]);
  assert.equal(validation.status, 1);
  assert.ok(validation.stderr.includes(file));
  assert.match(validation.stderr, /documents\.0\.publishedAt/);
  const timeout = run(['src/evaluate.ts', '--out', path.join(directory, 'timeout')], {
    EVAL_TIMEOUT_MS: '0',
  });
  assert.equal(timeout.status, 1);
  assert.match(timeout.stderr, /EVAL_TIMEOUT_MS 必须/);
});

test('合法密码中的小于号不应被误判为未填写占位符', () => {
  const values = {
    DB_HOST: '127.0.0.1',
    DB_PORT: '3306',
    DB_NAME: 'unit_config',
    DB_USER: 'unit_user',
    DB_PASSWORD: 'unit-test<symbol',
    DB_TLS: 'false',
  };
  const originals = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    assert.ok(config().password.includes('<'));
    process.env.DB_PASSWORD = '<secret>';
    assert.throws(() => config(), /请配置 DB_PASSWORD/);
  } finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
