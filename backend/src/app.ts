import express from 'express';
import { timingSafeEqual } from 'node:crypto';
type Options = {
  adminToken?: string;
  getDetails?: () => Promise<unknown>;
  log?: (entry: { event: string; code: string }) => void;
};
export function createFoundationApp(checkDatabase: () => Promise<unknown>, options: Options = {}) {
  if (options.adminToken && (options.adminToken.length < 24 || /^<.*>$/.test(options.adminToken)))
    throw new Error('ADMIN_STATUS_TOKEN需替换为至少24字符的真实管理令牌');
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) =>
    res.json({ status: 'ok', service: 'evidence-foundation', businessGuideAvailable: false }),
  );
  app.get('/readyz', async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: 'ready' });
    } catch (error) {
      (options.log ?? console.error)({
        event: 'database_readiness_failed',
        code:
          typeof (error as { code?: string }).code === 'string'
            ? (error as { code: string }).code
            : 'DATABASE_NOT_READY',
      });
      res.status(503).json({ status: 'not_ready' });
    }
  });
  if (options.adminToken && options.getDetails)
    app.get('/internal/evidence/status', async (req, res) => {
      const actual = Buffer.from(req.headers.authorization ?? ''),
        expected = Buffer.from('Bearer ' + options.adminToken);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        res.status(401).json({ status: 'unauthorized' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      try {
        res.json(await options.getDetails!());
      } catch (error) {
        (options.log ?? console.error)({
          event: 'internal_status_failed',
          code:
            typeof (error as { code?: string }).code === 'string'
              ? (error as { code: string }).code
              : 'STATUS_UNAVAILABLE',
        });
        res.status(503).json({ status: 'unavailable' });
      }
    });
  return app;
}
