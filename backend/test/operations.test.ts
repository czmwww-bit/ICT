import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFoundationApp } from '../src/app.js';
test('内部状态默认不暴露；令牌保护且数据库失败只返回明确503，日志不含异常正文', async () => {
  const logs: unknown[] = [];
  let reads = 0;
  const token = 'test-token-for-internal-status-0123456789';
  const app = createFoundationApp(async () => {}, {
    adminToken: token,
    getDetails: async () => {
      reads++;
      throw Object.assign(new Error('password=不得泄露'), { code: 'ECONNREFUSED' });
    },
    log: (r) => logs.push(r),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('未监听');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(url + '/internal/evidence/status')).status, 401);
    assert.equal(reads, 0);
    const r = await fetch(url + '/internal/evidence/status', {
      headers: { Authorization: 'Bearer ' + token },
    });
    assert.equal(r.status, 503);
    assert.equal(JSON.stringify(logs).includes('不得泄露'), false);
    assert.equal((await fetch(url + '/readyz')).status, 200);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
  const disabled = createFoundationApp(async () => {}),
    s = disabled.listen(0, '127.0.0.1');
  await new Promise<void>((r) => s.once('listening', r));
  const a = s.address();
  if (!a || typeof a === 'string') throw new Error();
  try {
    assert.equal((await fetch(`http://127.0.0.1:${a.port}/internal/evidence/status`)).status, 404);
  } finally {
    s.closeAllConnections();
    await new Promise<void>((r) => s.close(() => r()));
  }
});
