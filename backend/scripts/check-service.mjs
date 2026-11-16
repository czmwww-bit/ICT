// 启动已构建的基础服务，连接真实数据库检查就绪状态，结束后关闭进程。
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

async function main() {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  const child = spawn(process.execPath, ['dist/src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let startupError;
  child.once('error', (error) => {
    startupError = error;
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const stopped = new Promise((resolve) => child.once('exit', resolve));
  try {
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error('基础服务启动失败：' + output);
      try {
        const r = await fetch(`http://127.0.0.1:${port}/healthz`, {
          signal: AbortSignal.timeout(1000),
        });
        if (r.ok) {
          healthy = true;
          break;
        }
      } catch {}
      await delay(100);
    }
    assert.ok(healthy, '基础服务未在限定时间内启动；请先build并检查数据库配置');
    const checks = [];
    for (const [route, method, expected] of [
      ['/healthz', 'GET', 200],
      ['/readyz', 'GET', 200],
      ['/api/guide', 'POST', 404],
    ]) {
      const r = await fetch(`http://127.0.0.1:${port}${route}`, {
        method,
        signal: AbortSignal.timeout(5000),
      });
      assert.equal(r.status, expected, `${route}状态不符`);
      checks.push({ route, method, expected, actual: r.status, status: 'pass' });
    }
    await mkdir('../reports', { recursive: true });
    await writeFile(
      '../reports/local-service.json',
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          checks,
          scope: '真实Node基础服务及MySQL就绪；没有实现业务guide',
        },
        null,
        2,
      ) + '\n',
    );
    console.log(JSON.stringify({ checks, report: '../reports/local-service.json' }, null, 2));
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([stopped, delay(5000)]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
