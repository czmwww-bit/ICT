// 只供显式CLI演示/集成测试：开始空库才运行，成功只清理本轮创建表。
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { config, pool, rows } from './db.js';
export const evidenceTables = [
  'evidence_publications',
  'evidence_versions',
  'evidence_heads',
  'evidence_batches',
  'evidence_regions',
  'evidence_import_lock',
  'evidence_migrations',
];
export async function withEmptyTestDatabase<T>(work: (db: Pool) => Promise<T>) {
  const original = process.env.DB_NAME,
    name = process.env.DB_TEST_NAME;
  assert.ok(
    name && /^[A-Za-z0-9_]+_test$/.test(name) && name !== original,
    '需要不同于项目库的独立_test库',
  );
  assert.ok(['127.0.0.1', 'localhost', '::1'].includes(config().host), '演示工具只用于本机测试库');
  process.env.DB_NAME = name;
  const db = await pool();
  let guard: Awaited<ReturnType<Pool['getConnection']>> | undefined,
    owns = false;
  const lock = 'evidence-test:' + createHash('sha256').update(name!).digest('hex').slice(0, 32);
  try {
    guard = await db.getConnection();
    const [r] = await rows<{ acquired: number }>(guard, 'SELECT GET_LOCK(?,0) AS acquired', [lock]);
    assert.equal(r?.acquired, 1, '测试库正忙');
    owns = true;
    assert.equal((await rows(db, 'SHOW TABLES')).length, 0, '测试库已有表，停止，不清空');
    const result = await work(db);
    const actual = (await rows<Record<string, string>>(db, 'SHOW TABLES'))
      .map((r) => Object.values(r)[0]!)
      .sort();
    assert.deepEqual(actual, [...evidenceTables].sort(), '发现外来表，保留现场');
    for (const table of evidenceTables) await db.query(`DROP TABLE \`${table}\``);
    return result;
  } finally {
    if (owns) await guard!.query('SELECT RELEASE_LOCK(?)', [lock]).catch(() => {});
    guard?.release();
    await db.end();
    if (original === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = original;
  }
}
