import 'dotenv/config';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export type SQL = Pool | PoolConnection;
export async function rows<T = Record<string, unknown>>(
  db: SQL,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const [r] = await db.query<RowDataPacket[]>(sql, values);
  return r as T[];
}
export function config() {
  for (const key of ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_TLS']) {
    if (!process.env[key] || /^<[^>]+>$/.test(process.env[key]!))
      throw new Error(`请配置 ${key}，参见 backend/.env.example`);
  }
  const port = Number(process.env.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('DB_PORT 必须为有效端口');
  if (!/^[A-Za-z0-9_]+$/.test(process.env.DB_NAME!))
    throw new Error('DB_NAME 仅允许字母数字下划线');
  if (!['true', 'false'].includes(process.env.DB_TLS!))
    throw new Error('DB_TLS 必须是 true 或 false');
  return {
    host: process.env.DB_HOST!,
    port,
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    connectTimeout: 5000,
    charset: 'utf8mb4',
  };
}
export async function pool(withDatabase = true, databaseName?: string): Promise<Pool> {
  const c = config();
  if (databaseName && !/^[A-Za-z0-9_]+$/.test(databaseName)) throw new Error('数据库名无效');
  if (
    process.env.DB_TLS === 'true' &&
    (!process.env.DB_SSL_CA || /^<.*>$/.test(process.env.DB_SSL_CA))
  )
    throw new Error('启用TLS需配置 DB_SSL_CA 为真实CA证书路径');
  const ssl =
    process.env.DB_TLS === 'true'
      ? { ca: await readFile(process.env.DB_SSL_CA!, 'utf8'), rejectUnauthorized: true }
      : undefined;
  return mysql.createPool({
    ...c,
    database: withDatabase ? (databaseName ?? c.database) : undefined,
    ssl,
    connectionLimit: 5,
  });
}
export async function initialize() {
  const db = await pool(false);
  try {
    await db.query(
      `CREATE DATABASE IF NOT EXISTS \`${config().database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
    );
  } finally {
    await db.end();
  }
}
export async function migrate(db: Pool) {
  const c = await db.getConnection();
  try {
    const [lock] = await rows<{ acquired: number }>(
      c,
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':evidence-migrate'), 15) AS acquired",
    );
    if (lock?.acquired !== 1) throw new Error('迁移锁获取失败');
    await c.query(
      'CREATE TABLE IF NOT EXISTS evidence_migrations (name VARCHAR(200) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB',
    );
    const dir = path.resolve('migrations');
    for (const name of (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
      const sql = await readFile(path.join(dir, name), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      const [old] = await rows<{ checksum: string }>(
        c,
        'SELECT checksum FROM evidence_migrations WHERE name=?',
        [name],
      );
      if (old) {
        if (old.checksum !== hash) throw new Error(`已执行迁移被修改: ${name}`);
        continue;
      }
      // MySQL DDL 隐式提交；迁移采用可重入 DDL，成功后才记录，不能冒充事务回滚。
      for (const statement of sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await c.query(statement);
      await c.query('INSERT INTO evidence_migrations(name,checksum) VALUES (?,?)', [name, hash]);
    }
  } finally {
    await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':evidence-migrate'))").catch(() => {});
    c.release();
  }
}
export async function transaction<T>(
  db: Pool,
  work: (c: PoolConnection) => Promise<T>,
): Promise<T> {
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    // 单行串行化维护操作，包含首次新增；配合 expectedVersion 防止陈旧批次覆盖。
    const lock = await rows(c, 'SELECT id FROM evidence_import_lock WHERE id=1 FOR UPDATE');
    if (!lock.length) throw new Error('资料迁移未完成：缺少事务锁行');
    const result = await work(c);
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
