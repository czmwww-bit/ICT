// 仅在开始确认空的独立_test库运行。技术审核事件不代表真实政策人工审核。
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool, config, rows, migrate } from '../src/db.js';
import { parseBatch } from '../src/model.js';
import { importBatch, history, publish } from '../src/store.js';
import { findCandidates, getClause } from '../src/query.js';
const originalName = process.env.DB_NAME!;
const testName = process.env.DB_TEST_NAME;
assert.ok(testName && /^[A-Za-z0-9_]+_test$/.test(testName), '必须配置独立_test数据库');
assert.notEqual(testName, originalName);
assert.ok(['127.0.0.1', 'localhost', '::1'].includes(config().host), '本工具只验证本机独立测试库');
const main = await pool();
const owned = [
  'evidence_publications',
  'evidence_versions',
  'evidence_heads',
  'evidence_batches',
  'evidence_regions',
  'evidence_import_lock',
  'evidence_migrations',
];
const canonical = (value: unknown): string =>
  value instanceof Date
    ? JSON.stringify(value.toISOString())
    : Array.isArray(value)
      ? `[${value.map(canonical).join(',')}]`
      : value && typeof value === 'object'
        ? `{${Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
            .join(',')}}`
        : JSON.stringify(value);
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
async function digest(db: Awaited<ReturnType<typeof pool>>) {
  const result: Record<string, unknown> = {};
  for (const t of owned) {
    const data = await rows(db, `SELECT * FROM ${t}`);
    result[t] = { count: data.length, hash: hash(data.map(canonical).sort().join('\n')) };
  }
  return result;
}
const before = await digest(main);
process.env.DB_NAME = testName!;
const db = await pool(),
  guard = await db.getConnection();
const lockName = `evidence-test:${hash(testName!).slice(0, 32)}`;
const checks: { name: string; passed: boolean; details: unknown }[] = [];
let locked = false,
  error: string | null = null,
  cleaned = false;
async function check(name: string, fn: () => Promise<unknown>) {
  try {
    const details = await fn();
    checks.push({ name, passed: true, details: details ?? null });
  } catch (e) {
    checks.push({ name, passed: false, details: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
try {
  const [lock] = await rows<{ acquired: number }>(guard, 'SELECT GET_LOCK(?,0) AS acquired', [
    lockName,
  ]);
  assert.equal(lock?.acquired, 1);
  locked = true;
  await check('独立测试库起始为空，不清空已有库', async () => {
    assert.equal((await rows(db, 'SHOW TABLES')).length, 0);
  });
  await check('空库迁移及重复迁移', async () => {
    await migrate(db);
    await migrate(db);
    assert.equal((await rows(db, 'SHOW TABLES')).length, 7);
    assert.equal((await rows(db, 'SELECT * FROM evidence_migrations')).length, 2);
  });
  const raw = await readFile('../data/official/longyang-pilot/batch.draft.json', 'utf8');
  const b = parseBatch(JSON.parse(raw));
  // 只修改内存测试副本的核对字段，正式草稿文件始终未核对。
  for (const d of b.documents) {
    d.checkedAt = '2026-11-16';
    d.checkedBy = '隔离技术验证（非人工政策审核）';
  }
  await check('真实草稿批次dry-run不写入', async () => {
    const s = await digest(db),
      p = await importBatch(db, b, { dryRun: true });
    assert.equal(p.errors, 0);
    assert.equal(p.added, 103);
    assert.deepEqual(await digest(db), s);
    return { added: p.added, errors: p.errors };
  });
  await check('13文件90条款在隔离库导入及重复幂等', async () => {
    const p = await importBatch(db, b),
      again = await importBatch(db, b);
    assert.equal(p.errors, 0);
    assert.equal(p.added, 103);
    assert.equal(again.unchanged, 103);
    assert.equal((await rows(db, 'SELECT * FROM evidence_versions')).length, 103);
    return { firstAdded: p.added, repeatUnchanged: again.unchanged };
  });
  await check('三事项全部草稿默认查询为空', async () => {
    for (const matterId of [
      'HIGH_AGE_ALLOWANCE',
      'ECONOMIC_ELDERLY_SERVICE',
      'DISABILITY_CARE_CONSUMPTION',
    ])
      assert.equal(
        (await findCandidates(db, { matterId, regionCode: '530502', asOf: '2026-11-16' })).length,
        0,
      );
  });
  await check('一条坏关联阻止整批写入', async () => {
    const s = await digest(db);
    const bad = structuredClone(b);
    bad.documents = [{ ...b.documents[0]!, id: 'PILOT_VALID_TEMP' }];
    bad.clauses = [{ ...b.clauses[0]!, id: 'PILOT_INVALID_TEMP', documentId: 'MISSING_DOCUMENT' }];
    const p = await importBatch(db, bad);
    assert.ok(p.errors > 0);
    assert.deepEqual(await digest(db), s);
    return p.messages;
  });
  await check('真实SQL中途错误回滚全部资料及批次', async () => {
    await db.query(
      "ALTER TABLE evidence_versions ADD CONSTRAINT pilot_sql_rollback CHECK (id <> 'PILOT_SQL_FAIL')",
    );
    try {
      const s = await digest(db);
      const failed = structuredClone(b);
      failed.clauses = [];
      failed.documents = [
        { ...b.documents[0]!, id: 'PILOT_SQL_GOOD' },
        { ...b.documents[0]!, id: 'PILOT_SQL_FAIL' },
      ];
      await assert.rejects(importBatch(db, failed), /pilot_sql_rollback/);
      assert.deepEqual(await digest(db), s);
    } finally {
      await db.query('ALTER TABLE evidence_versions DROP CHECK pilot_sql_rollback');
    }
  });
  await check('更新保留旧版本，不自动审核', async () => {
    const c = structuredClone(b.clauses.find((c) => c.id === 'YN_GLT_ELIGIBILITY')!);
    c.version = 2;
    c.expectedVersion = 1;
    c.locator += '（仅隔离测试定位）';
    assert.equal(
      (
        await importBatch(db, {
          schemaVersion: 1,
          actor: '隔离技术测试',
          reason: '历史追溯验证',
          regions: [],
          documents: [],
          clauses: [c],
        })
      ).modified,
      1,
    );
    assert.equal((await history(db, 'clause', c.id)).versions.length, 2);
    assert.equal((await getClause(db, c.id)).length, 0);
  });
  const actor = '隔离技术测试（非政策人工审核）',
    reason = '仅测试查询与发布机制，成功后清理本轮创建表';
  for (const id of [
    'YN_GLT_2024_113',
    'LY_GLT_LUJIANG_2023',
    'CN_CONSUMPTION_LAUNCH_2026',
    'LY_CONSUMPTION_GUIDE_2026',
  ])
    await publish(db, 'document', id, 1, actor, reason);
  for (const id of [
    'YN_GLT_ELIGIBILITY',
    'LY_GLT_LUJIANG_2023_OBJECT',
    'CN_CONSUMPTION_LAUNCH_2026_START',
    'LY_CONSUMPTION_GUIDE_2026_CONTACT',
  ])
    await publish(db, 'clause', id, 1, actor, reason);
  await check('显式国家/省/市/区/乡祖先匹配，不向下混入', async () => {
    const args = { matterId: 'HIGH_AGE_ALLOWANCE', asOf: '2026-11-16' };
    const district = await findCandidates(db, { ...args, regionCode: '530502' }),
      town = await findCandidates(db, { ...args, regionCode: 'LY_LUJIANG' }),
      other = await findCandidates(db, { ...args, regionCode: 'LY_XIYI' });
    assert.ok(district.some((c) => c.clause.id === 'YN_GLT_ELIGIBILITY'));
    assert.ok(!district.some((c) => c.clause.id === 'LY_GLT_LUJIANG_2023_OBJECT'));
    assert.ok(town.some((c) => c.clause.id === 'LY_GLT_LUJIANG_2023_OBJECT'));
    assert.ok(!other.some((c) => c.clause.id === 'LY_GLT_LUJIANG_2023_OBJECT'));
    assert.equal(
      (await getClause(db, 'YN_GLT_ELIGIBILITY'))[0]!.clause.version,
      1,
      '待审核2版不遮蔽已选1版',
    );
  });
  await check('指定日期排除未来开始，国家级适用关系显式', async () => {
    const args = { matterId: 'DISABILITY_CARE_CONSUMPTION', regionCode: '530502' };
    const has = (list: Awaited<ReturnType<typeof findCandidates>>) =>
      list.some((c) => c.clause.id === 'CN_CONSUMPTION_LAUNCH_2026_START');
    assert.equal(has(await findCandidates(db, { ...args, asOf: '2025-12-31' })), false);
    assert.equal(has(await findCandidates(db, { ...args, asOf: '2026-01-01' })), true);
  });
  await check('PDF原文/官网/准确文件版本及未知施行需核对', async () => {
    const r = (await getClause(db, 'LY_CONSUMPTION_GUIDE_2026_CONTACT'))[0]!;
    assert.ok(r.source.quote.includes('0875-2229150'));
    assert.ok(r.source.locator.includes('PDF第7页'));
    assert.equal(r.source.url, 'https://www.longyang.gov.cn/info/3485/14111319.htm');
    assert.equal(r.source.documentVersion, 1);
    assert.equal(r.timeStatus, 'needs_review');
    return r.source;
  });
  await check('仅清理本轮空库中创建的7张表，保留数据库', async () => {
    const tables = (await rows<Record<string, string>>(db, 'SHOW TABLES')).map(
      (r) => Object.values(r)[0]!,
    );
    assert.deepEqual(tables.sort(), [...owned].sort(), '发现外来表则不清理');
    for (const t of owned) await db.query(`DROP TABLE \`${t}\``);
    assert.equal((await rows(db, 'SHOW TABLES')).length, 0);
    cleaned = true;
  });
} catch (e) {
  error = e instanceof Error ? e.message : String(e);
  process.exitCode = 1;
} finally {
  if (locked) await guard.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
  guard.release();
  await db.end();
  process.env.DB_NAME = originalName;
  const after = await digest(main);
  await main.end();
  const mainUnchanged = canonical(before) === canonical(after);
  if (!mainUnchanged) process.exitCode = 1;
  const report = {
    executedAt: new Date().toISOString(),
    scope: '本机空_test库，真实资料草稿的临时技术副本；不代表人工政策审核',
    checks,
    passed: !error && mainUnchanged,
    passedChecks: checks.filter((c) => c.passed).length,
    totalChecks: checks.length,
    error,
    testTablesCleaned: cleaned,
    projectDatabaseUnchanged: mainUnchanged,
    projectBefore: before,
    projectAfter: after,
  };
  await writeFile(
    '../data/official/longyang-pilot/isolated-db-report.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await writeFile(
    '../data/official/longyang-pilot/ISOLATED_DB_REPORT.md',
    '# 隔离MySQL实际验证\n\n' +
      `执行时间：${report.executedAt}。${report.passedChecks}/${report.totalChecks}项通过；项目库摘要不变：${mainUnchanged}；本轮测试表清理：${cleaned}。\n\n仅在起始为空的_test库导入103份版本，技术审核事件不表示政策人工审核。没有修改正式草稿的checkedAt/By，没有向项目库导入或发布。失败则保留测试现场，不清空已有数据。\n\n` +
      checks.map((c) => `- ${c.passed ? '通过' : '失败'}：${c.name}`).join('\n') +
      `\n\n错误：${error ?? '无'}。详见isolated-db-report.json。\n`,
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      checks: report.passedChecks,
      total: report.totalChecks,
      testTablesCleaned: cleaned,
      projectDatabaseUnchanged: mainUnchanged,
      error,
    }),
  );
}
