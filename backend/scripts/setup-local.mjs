// 仅连接本机；root密码只在当前进程内使用，不写文件、不打印。
import mysql from 'mysql2/promise';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { access, open } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const alreadyExists = async (path) => {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};

async function readPassword() {
  if (!process.stdin.isTTY) throw new Error('请在自己的PowerShell终端中运行，以便隐藏密码输入。');
  const mutedOutput = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const reader = createInterface({ input: process.stdin, output: mutedOutput, terminal: true });
  process.stdout.write('请输入刚设置的本机MySQL root密码（输入不显示字符，输完按回车）：');
  try {
    const password = await new Promise((resolve, reject) => {
      reader.once('SIGINT', () => reject(new Error('已取消，未继续建库。')));
      reader.question('', resolve);
    });
    if (!password) throw new Error('未输入密码，已停止。');
    return password;
  } finally {
    reader.close();
    process.stdout.write('\n');
  }
}

async function main() {
  if (process.argv.includes('--check')) {
    console.log(
      JSON.stringify(
        {
          host: '127.0.0.1',
          port: 3306,
          action: '新建随机后缀项目库、空_test库及专用本地维护账号；不修改已有库或账号',
          envPath,
          existingEnv: await alreadyExists(envPath),
          writes: false,
          note: '这里只检查初始化计划；没有连接或修改MySQL。',
        },
        null,
        2,
      ),
    );
    return;
  }
  if (await alreadyExists(envPath))
    throw new Error(
      'backend/.env已存在，为保留已有配置已停止。请继续使用现有配置，不要重复初始化。',
    );

  const suffix = randomBytes(5).toString('hex');
  const database = `silver_local_${suffix}`;
  const testDatabase = `${database}_test`;
  const user = `silver_dev_${suffix}`;
  const password = randomBytes(24).toString('hex');
  const rootPassword = await readPassword();
  let connection;
  let envFile;
  try {
    connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: rootPassword,
      connectTimeout: 5000,
      charset: 'utf8mb4',
    });
    // 只允许全新、随机命名的项目资源；不复用未知库，不重设已有账号密码。
    const [existingDatabases] = await connection.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?,?)',
      [database, testDatabase],
    );
    const [existingUsers] = await connection.query('SELECT User FROM mysql.user WHERE User=?', [
      user,
    ]);
    if (existingDatabases.length || existingUsers.length)
      throw new Error('随机项目名称已存在，未修改现有资源；请重新运行。');

    // 先保留配置，若后续DDL失败，可用此文件核对部分完成状态；不自动删库或覆盖配置。
    envFile = await open(envPath, 'wx', 0o600);
    await envFile.writeFile(
      [
        '# 本机开发维护账号；仅有以下两个项目库的权限。root密码未保存。',
        '# 生产环境请按部署说明使用独立只读业务账号。',
        'DB_HOST=127.0.0.1',
        'DB_PORT=3306',
        `DB_NAME=${database}`,
        `DB_USER=${user}`,
        `DB_PASSWORD=${password}`,
        'DB_TLS=false',
        `DB_TEST_NAME=${testDatabase}`,
        '# test:db要求空测试库；成功后只清理本轮创建的表，可重复运行，失败则保留现场。',
        '',
      ].join('\n'),
      'utf8',
    );
    await envFile.close();
    envFile = undefined;

    // MySQL建库/授权是DDL，不能整体回滚；所有名称仅为本次新生成的本机资源。
    for (const name of [database, testDatabase]) {
      await connection.query(
        `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
      );
    }
    await connection.query("CREATE USER ?@'localhost' IDENTIFIED BY ?", [user, password]);
    for (const name of [database, testDatabase]) {
      await connection.query(
        `GRANT SELECT,INSERT,UPDATE,CREATE,ALTER,INDEX,REFERENCES,TRIGGER,DROP ON \`${name}\`.* TO ?@'localhost'`,
        [user],
      );
    }
    const projectConnection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      database,
      user,
      password,
      connectTimeout: 5000,
    });
    try {
      await projectConnection.query('SELECT 1');
    } finally {
      await projectConnection.end();
    }
    console.log('本地初始化完成，已验证项目账号可以连接。');
    console.log(`项目库：${database}`);
    console.log(`空测试库：${testDatabase}`);
    console.log(`配置已保存：${envPath}（已被Git忽略）`);
    console.log('root密码没有保存。接下来可以执行数据库迁移和首次集成测试。');
  } finally {
    await envFile?.close();
    await connection?.end();
  }
}

main().catch((error) => {
  // 不输出整个mysql错误对象，防止其中的SQL或连接配置带出密码。
  const knownCodes = {
    ER_ACCESS_DENIED_ERROR: 'root账号登录失败，请确认刚设置的密码。',
    ECONNREFUSED: '无法连接本机3306端口，请检查MySQL80服务。',
    EEXIST: '.env已存在，未覆盖。',
  };
  console.error(
    knownCodes[error.code] ??
      (error.sql ? `数据库初始化未完成（${error.code}）；请保留.env并联系排查。` : error.message),
  );
  process.exitCode = 1;
});
