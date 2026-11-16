// 仅验证评测工具，禁止被生产 server.ts 引用。
import { createServer } from 'node:http';
import type { Case, Catalog } from '../src/evaluation.js';
export async function startMock(cases: Case[], catalog: Catalog) {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body),
      c = cases.find((c) => c.input.text === input.text)!;
    if (c.id === 'DEMO_E12') {
      res.writeHead(500).end('mock error');
      return;
    }
    if (c.id === 'DEMO_E13') {
      setTimeout(() => {
        if (!res.destroyed) res.end('{}');
      }, 350);
      return;
    }
    const actual = {
      status: c.expected.status,
      question: c.expected.questionKey
        ? { key: c.expected.questionKey, text: c.expected.nextStep }
        : undefined,
      nextStep: c.expected.nextStep,
      reason: '【模拟响应】资料需人工核对',
      materials: c.expected.materials,
      sources: c.expected.references.map((r) => ({
        ...catalog.get(`${r.clauseId}@${r.version}`),
        clauseId: r.clauseId,
        clauseVersion: r.version,
      })),
    };
    if (c.id === 'DEMO_E11' && actual.sources[0])
      actual.sources[0].quote = '【模拟错误】该引文不在原文中';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(actual));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('mock listen failed');
  return {
    url: `http://127.0.0.1:${address.port}/api/guide`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    },
  };
}
