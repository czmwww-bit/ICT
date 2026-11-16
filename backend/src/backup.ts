// 复用MySQL官方客户端；只备份本模块7表，只允许恢复到另一空_restore_test库。
import { spawn, execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, mkdtemp, rm, access, readdir } from 'node:fs/promises';
import { userInfo } from 'node:os';
import path from 'node:path';
import type { Pool } from 'mysql2/promise';
import { config, pool, rows, transaction } from './db.js';
import { evidenceTables } from './test-sandbox.js';
import { sha256 } from './source-monitor.js';
import { withMonitorLock } from './source-monitor.js';
export function canonical(v: unknown): string {
  return v instanceof Date
    ? JSON.stringify(v.toISOString())
    : Array.isArray(v)
      ? `[${v.map(canonical).join(',')}]`
      : v && typeof v === 'object'
        ? `{${Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
            .join(',')}}`
        : JSON.stringify(v);
}
export async function evidenceDigest(db: Pool) {
  const result: Record<string, { rows: number; sha256: string }> = {};
  for (const table of evidenceTables) {
    const data = await rows(db, `SELECT * FROM ${table}`);
    result[table] = { rows: data.length, sha256: sha256(data.map(canonical).sort().join('\n')) };
  }
  return result;
}
async function binary(name: 'mysql' | 'mysqldump') {
  const env = process.env[name === 'mysql' ? 'MYSQL_BIN' : 'MYSQLDUMP_BIN'];
  if (env) return env;
  if (process.platform === 'win32') {
    const standard = path.join(
      process.env.ProgramFiles ?? 'C:/Program Files',
      'MySQL',
      'MySQL Server 8.0',
      'bin',
      name + '.exe',
    );
    try {
      await access(standard);
      return standard;
    } catch {}
  }
  return name;
}
function option(value: string) {
  return (
    '"' +
    value
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('\n', '\\n')
      .replaceAll('\r', '\\r') +
    '"'
  );
}
async function credentials<T>(work: (file: string) => Promise<T>) {
  const root = path.resolve('../reports/local/mysql-credentials');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, 'one-use-')),
    file = path.join(dir, 'client.cnf'),
    c = config();
  try {
    await writeFile(
      file,
      [
        '[client]',
        `host=${option(c.host)}`,
        `port=${c.port}`,
        `user=${option(c.user)}`,
        `password=${option(c.password)}`,
        process.env.DB_TLS === 'true' ? 'ssl-mode=VERIFY_IDENTITY' : 'ssl-mode=DISABLED',
        ...(process.env.DB_TLS === 'true' ? [`ssl-ca=${option(process.env.DB_SSL_CA!)}`] : []),
        'default-character-set=utf8mb4',
        '',
      ].join('\n'),
      { flag: 'wx', mode: 0o600 },
    );
    if (process.platform === 'win32') {
      const owner =
        execFileSync('whoami', [], { encoding: 'utf8', windowsHide: true }).trim() ||
        userInfo().username;
      execFileSync('icacls', [file, '/inheritance:r', '/grant:r', owner + ':(F)'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    }
    return await work(file);
  } finally {
    await rm(file, { force: true });
    if (path.dirname(path.resolve(dir)) !== root) throw new Error('临时凭证目录越界');
    await rm(dir, { recursive: true });
  }
}
async function client(executable: string, args: string[], input?: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
    let error = '';
    child.stderr.on('data', (d) => {
      if (error.length < 8000) error += String(d);
    });
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              `MYSQL_CLIENT_FAILED (${code})：${error.replaceAll(config().password, '[REDACTED]')}`,
            ),
          ),
    );
    if (input) {
      const stream = createReadStream(input);
      stream.on('error', reject);
      child.stdin.on('error', (e) => {
        if ((e as NodeJS.ErrnoException).code !== 'EPIPE') reject(e);
      });
      stream.pipe(child.stdin);
    } else child.stdin.end();
  });
}
type Manifest = {
  schemaVersion: 1;
  sourceDatabase: string;
  createdAt: string;
  dumpFile: string;
  dumpSha256: string;
  tables: Awaited<ReturnType<typeof evidenceDigest>>;
  archives: { relativePath: string; sha256: string; backupFile: string }[];
  runtimeFiles: { path: string; sha256: string }[];
};
export async function backupEvidence(db: Pool, directory: string, sourceDirectory?: string) {
  const target = path.resolve(directory);
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(target); // 已有目录拒绝覆盖。
  const [identity] = await rows<{ name: string }>(db, 'SELECT DATABASE() AS name');
  const dumpFile = path.join(target, 'evidence.sql');
  return transaction(db, async () => {
    const before = await evidenceDigest(db);
    await credentials((file) =>
      binary('mysqldump').then((exe) =>
        client(exe, [
          `--defaults-extra-file=${file}`,
          '--single-transaction',
          '--skip-lock-tables',
          '--skip-add-locks', // 恢复到独立空库无需LOCK TABLES权限。
          '--no-tablespaces',
          '--set-gtid-purged=OFF',
          '--hex-blob',
          `--result-file=${dumpFile}`,
          identity!.name,
          ...[...evidenceTables].reverse(),
        ]),
      ),
    );
    const after = await evidenceDigest(db);
    if (canonical(before) !== canonical(after)) throw new Error('备份期间源数据变化，备份未完成');
    const archives: Manifest['archives'] = [],
      archiveRoot = path.resolve('../data/official');
    const versions = await rows<{ payload: string | { originalPath?: string } }>(
      db,
      "SELECT payload FROM evidence_versions WHERE kind='document'",
    );
    for (const row of versions) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      if (!payload.originalPath) continue;
      const file = path.resolve('..', payload.originalPath),
        rel = path.relative(archiveRoot, file);
      if (rel.startsWith('..') || path.isAbsolute(rel))
        throw new Error('原件路径超出官方归档目录，停止备份');
      const bytes = await readFile(file),
        hash = sha256(bytes),
        backupFile = 'archives/' + hash;
      await mkdir(path.join(target, 'archives'), { recursive: true });
      await writeFile(path.join(target, backupFile), bytes);
      if (!archives.some((a) => a.relativePath === rel.replaceAll('\\', '/')))
        archives.push({ relativePath: rel.replaceAll('\\', '/'), sha256: hash, backupFile });
    }
    const runtimeFiles: Manifest['runtimeFiles'] = [];
    if (sourceDirectory)
      await withMonitorLock(sourceDirectory, async () => {
        async function copy(relative: string) {
          const file = path.join(sourceDirectory!, relative);
          let stat;
          try {
            stat = await readdir(file, { withFileTypes: true });
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
            if ((e as NodeJS.ErrnoException).code === 'ENOTDIR') {
              const bytes = await readFile(file),
                dest = path.join(target, 'source-monitor', relative);
              await mkdir(path.dirname(dest), { recursive: true });
              await writeFile(dest, bytes);
              runtimeFiles.push({ path: relative.replaceAll('\\', '/'), sha256: sha256(bytes) });
              return;
            }
            throw e;
          }
          for (const entry of stat) {
            if (entry.isSymbolicLink()) throw new Error('检查缓存中有符号链接，停止备份');
            await copy(path.join(relative, entry.name));
          }
        }
        for (const name of ['blobs', 'state', 'tasks', 'checks', 'snapshots', 'last-check.json'])
          await copy(name);
      });
    const manifest: Manifest = {
      schemaVersion: 1,
      sourceDatabase: identity!.name,
      createdAt: new Date().toISOString(),
      dumpFile: 'evidence.sql',
      dumpSha256: sha256(await readFile(dumpFile)),
      tables: before,
      archives,
      runtimeFiles,
    };
    await writeFile(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', {
      flag: 'wx',
    });
    return manifest;
  });
}
export async function restoreEvidence(manifestFile: string, targetName: string) {
  if (
    !/^[A-Za-z0-9_]+_restore_test$/.test(targetName) ||
    [process.env.DB_NAME, process.env.DB_TEST_NAME].includes(targetName)
  )
    throw new Error('恢复只允许不同于项目库及源测试库的_restore_test库');
  const directory = path.dirname(path.resolve(manifestFile)),
    manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Manifest;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.sourceDatabase === targetName ||
    manifest.dumpFile !== 'evidence.sql'
  )
    throw new Error('备份清单或源/目标库无效');
  const dumpFile = path.join(directory, manifest.dumpFile),
    bytes = await readFile(dumpFile);
  if (sha256(bytes) !== manifest.dumpSha256) throw new Error('备份文件哈希不符，停止恢复');
  if (/^\s*(?:USE\s+|(?:CREATE|DROP)\s+DATABASE\b)/im.test(bytes.toString('utf8')))
    throw new Error('备份含库切换指令，停止恢复');
  const db = await pool(true, targetName);
  let guard: Awaited<ReturnType<Pool['getConnection']>> | undefined,
    locked = false;
  try {
    guard = await db.getConnection();
    const [lock] = await rows<{ ok: number }>(guard, 'SELECT GET_LOCK(?,0) AS ok', [
      'restore:' + targetName,
    ]);
    if (lock?.ok !== 1) throw new Error('恢复库正在使用');
    locked = true;
    if ((await rows(db, 'SHOW TABLES')).length) throw new Error('恢复目标不是空库，拒绝覆盖');
    await credentials((file) =>
      binary('mysql').then((exe) =>
        client(
          exe,
          [`--defaults-extra-file=${file}`, '--binary-mode', `--database=${targetName}`],
          dumpFile,
        ),
      ),
    );
    const actual = await evidenceDigest(db);
    if (canonical(actual) !== canonical(manifest.tables))
      throw new Error('恢复后表行数/内容摘要不同，保留现场');
    const restoredFiles = path.join(directory, 'restored-archives');
    await mkdir(restoredFiles);
    for (const a of manifest.archives) {
      if (!/^archives\/[a-f0-9]{64}$/.test(a.backupFile)) throw new Error('归档清单路径无效');
      const data = await readFile(path.join(directory, a.backupFile));
      if (sha256(data) !== a.sha256) throw new Error('归档原件哈希不符');
      const dest = path.resolve(restoredFiles, a.relativePath);
      if (path.relative(restoredFiles, dest).startsWith('..')) throw new Error('归档恢复路径越界');
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, data, { flag: 'wx' });
    }
    const restoredMonitor = path.join(directory, 'restored-source-monitor');
    await mkdir(restoredMonitor);
    for (const r of manifest.runtimeFiles ?? []) {
      const relative = r.path.split('/');
      if (relative.includes('..') || path.isAbsolute(r.path))
        throw new Error('检查记录恢复路径越界');
      const data = await readFile(path.join(directory, 'source-monitor', r.path));
      if (sha256(data) !== r.sha256) throw new Error('检查记录备份哈希不符');
      const dest = path.join(restoredMonitor, r.path);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, data, { flag: 'wx' });
    }
    return {
      status: 'restored',
      tablesVerified: actual,
      archiveFilesVerified: manifest.archives.length,
      runtimeFilesVerified: manifest.runtimeFiles?.length ?? 0,
      sourceDatabase: manifest.sourceDatabase,
      targetDatabase: targetName,
    };
  } finally {
    if (locked)
      await guard!.query('SELECT RELEASE_LOCK(?)', ['restore:' + targetName]).catch(() => {});
    guard?.release();
    await db.end();
  }
}
