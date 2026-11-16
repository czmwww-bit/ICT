// 本机已有mysqld的临时恢复实例；全新目录、动态回环端口，不注册或修改Windows服务。
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
async function waitExit(child: ChildProcess) {
  return await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
}
export async function startRestoreEngine(parent: string) {
  const executable =
    process.env.MYSQLD_BIN ??
    (process.platform === 'win32'
      ? path.join(
          process.env.ProgramFiles ?? 'C:/Program Files',
          'MySQL',
          'MySQL Server 8.0',
          'bin',
          'mysqld.exe',
        )
      : 'mysqld');
  if (process.platform === 'win32') await access(executable);
  const root = path.resolve(parent, 'restore-engine'),
    data = path.join(root, 'data');
  await mkdir(root);
  await writeFile(
    path.join(root, 'OWNED_TEMPORARY_INSTANCE'),
    'Only this workflow created this MySQL instance.\n',
    { flag: 'wx' },
  );
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('无法分配本机恢复端口');
  const port = address.port;
  await new Promise<void>((r) => server.close(() => r()));
  const base = [
    '--no-defaults',
    `--datadir=${data}`,
    `--basedir=${path.dirname(path.dirname(executable))}`,
    '--innodb-buffer-pool-size=33554432',
    '--innodb-redo-log-capacity=67108864',
    '--performance-schema=OFF',
  ];
  let log = '';
  const capture = (child: ChildProcess) => {
    child.stdout?.on('data', (d) => (log += String(d)));
    child.stderr?.on('data', (d) => (log += String(d)));
  };
  const init = spawn(executable, [...base, '--initialize-insecure', '--console'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  capture(init);
  const code = await waitExit(init);
  await writeFile(path.join(root, 'initialize.log'), log);
  if (code !== 0) throw new Error('临时MySQL初始化失败，详见隔离目录initialize.log');
  log = '';
  const processHandle = spawn(
    executable,
    [
      ...base,
      '--console',
      `--port=${port}`,
      '--bind-address=127.0.0.1',
      '--mysqlx=OFF',
      '--skip-log-bin',
      '--max-connections=15',
    ],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  capture(processHandle);
  const stopOwned = () => {
    if (processHandle.exitCode === null && processHandle.pid) {
      if (process.platform === 'win32') {
        try {
          execFileSync('taskkill', ['/PID', String(processHandle.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
          });
        } catch {}
      } else processHandle.kill('SIGTERM');
    }
  };
  let exited = false,
    spawnError: Error | undefined;
  processHandle.once('error', (e) => {
    spawnError = e;
  });
  processHandle.once('exit', () => {
    exited = true;
  });
  let admin: mysql.Connection | undefined;
  for (let n = 0; n < 100 && !exited && !spawnError; n++) {
    try {
      admin = await mysql.createConnection({
        host: '127.0.0.1',
        port,
        user: 'root',
        password: '',
        connectTimeout: 500,
      });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  await writeFile(path.join(root, 'server-start.log'), log);
  if (!admin) {
    stopOwned();
    throw new Error('临时恢复MySQL未就绪；日志在隔离目录，没有修改现有MySQL服务');
  }
  const password = randomBytes(24).toString('hex'),
    database = 'silver_ephemeral_restore_test';
  try {
    await admin.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [password]);
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`);
  } catch (e) {
    await admin.query('SHUTDOWN').catch(() => {});
    admin.destroy();
    stopOwned();
    throw e;
  }
  const keys = [
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASSWORD',
    'DB_TLS',
    'DB_RESTORE_TEST_NAME',
  ] as const;
  const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    DB_HOST: '127.0.0.1',
    DB_PORT: String(port),
    DB_USER: 'root',
    DB_PASSWORD: password,
    DB_TLS: 'false',
    DB_RESTORE_TEST_NAME: database,
  });
  return {
    database,
    port,
    scope: 'temporary_local_mysql_instance',
    async close() {
      for (const key of keys) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
      const completed = new Promise<void>((resolve) => {
        if (exited) resolve();
        else processHandle.once('exit', () => resolve());
      });
      await admin!.query('SHUTDOWN').catch(() => {});
      admin!.destroy();
      let stopped = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        completed.then(() => {
          stopped = true;
        }),
        new Promise<void>((r) => {
          timer = setTimeout(r, 8000);
        }),
      ]);
      clearTimeout(timer);
      if (!stopped && !exited) {
        stopOwned();
        await completed;
      }
      await writeFile(path.join(root, 'server-complete.log'), log);
      if (path.dirname(path.resolve(data)) !== root || path.basename(data) !== 'data')
        throw new Error('临时数据目录越界，不清理');
      // 只移除本轮新建的临时实例数据，保留SQL备份、恢复核对报告和日志。
      await rm(data, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}
