import { pool, rows } from './db.js';
import { createFoundationApp } from './app.js';
const db = await pool();
const app = createFoundationApp(async () => {
  const result = await rows(
    db,
    "SELECT id FROM evidence_import_lock WHERE id=1 AND EXISTS (SELECT 1 FROM evidence_migrations WHERE name='002_publications.sql')",
  );
  if (!result.length) throw new Error('缺少导入锁行');
});
const server = app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0', () =>
  console.log('基础健康服务已启动，/api/guide 等待成员②实现'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close(() => {
      void db.end().then(() => process.exit(0));
    });
  });
