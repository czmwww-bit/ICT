// 只为现有本机项目账号新增一个独立恢复测试库；root密码隐藏输入且不保存。
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFile, appendFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
const name = process.env.DB_RESTORE_TEST_NAME || `${process.env.DB_NAME}_restore_test`;
if (
  !/^[A-Za-z0-9_]+_restore_test$/.test(name) ||
  name === process.env.DB_NAME ||
  name === process.env.DB_TEST_NAME
)
  throw new Error('恢复库名须独立且以_restore_test结尾');
if (!['127.0.0.1', 'localhost'].includes(process.env.DB_HOST) || process.env.DB_TLS !== 'false')
  throw new Error('此准备命令仅用于已有的本机开发配置');
async function main() {
  if (process.argv.includes('--check')) {
    console.log(
      JSON.stringify({
        database: name,
        action: '新建空恢复库，仅授权现有项目维护账号；不覆盖已有库，不改密码',
        writes: false,
      }),
    );
    return;
  }
  const env = await readFile('.env', 'utf8');
  const app = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  let account;
  try {
    const [r] = await app.query('SELECT CURRENT_USER() AS account');
    account = r[0].account;
  } finally {
    await app.end();
  }
  const match = /^(silver_dev_[a-f0-9]+)@(localhost|127\.0\.0\.1)$/.exec(account);
  if (!match) throw new Error('仅为setup:local建立的本机项目账号授权');
  if (!process.stdin.isTTY)
    throw new Error('请在自己的PowerShell终端执行，隐藏输入root密码；不要将密码发到聊天。');
  const output = new Writable({
    write(_chunk, _enc, done) {
      done();
    },
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  process.stdout.write('请输入本机MySQL root密码（隐藏输入，回车结束）：');
  let password;
  try {
    password = await new Promise((resolve, reject) => {
      reader.once('SIGINT', () => reject(new Error('已取消')));
      reader.question('', resolve);
    });
  } finally {
    reader.close();
    process.stdout.write('\n');
  }
  if (!password) throw new Error('密码为空，未操作');
  const root = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: 'root',
    password,
  });
  try {
    const [r] = await root.query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',
      [name],
    );
    if (r.length && !process.env.DB_RESTORE_TEST_NAME)
      throw new Error('目标库已存在但未登记配置，停止以保护现有数据');
    if (r.length) {
      const [tables] = await root.query(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=?',
        [name],
      );
      if (tables.length) throw new Error('恢复库已有表，未清空');
    } else
      await root.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`);
    await root.query(
      `GRANT SELECT,INSERT,UPDATE,CREATE,ALTER,INDEX,REFERENCES,TRIGGER,DROP ON \`${name}\`.* TO ?@?`,
      match.slice(1),
    );
    if (!/^DB_RESTORE_TEST_NAME=/m.test(env))
      await appendFile('.env', `\n# 独立空恢复验证库，不用于业务\nDB_RESTORE_TEST_NAME=${name}\n`);
    console.log('独立恢复库已准备，配置已追加到被Git忽略的.env；root密码未保存。');
  } finally {
    await root.end();
  }
}
main().catch((e) => {
  console.error(e.sql ? `数据库准备未完成（${e.code}），未清理任何已有库。` : e.message);
  process.exitCode = 1;
});
