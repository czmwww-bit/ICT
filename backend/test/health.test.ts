import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFoundationApp } from '../src/app.js';
test('基础服务健康、数据库未就绪503、业务接口保持未实现', async () => {
  const app = createFoundationApp(async () => {
    throw new Error('数据库不可用');
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const a = server.address();
  if (!a || typeof a === 'string') throw new Error('未监听');
  const base = `http://127.0.0.1:${a.port}`;
  try {
    assert.equal((await fetch(base + '/healthz')).status, 200);
    assert.equal((await fetch(base + '/readyz')).status, 503);
    assert.equal((await fetch(base + '/api/guide', { method: 'POST' })).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});
