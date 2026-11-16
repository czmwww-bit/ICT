import express from 'express';
export function createFoundationApp(checkDatabase: () => Promise<unknown>) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) =>
    res.json({ status: 'ok', service: 'evidence-foundation', businessGuideAvailable: false }),
  );
  app.get('/readyz', async (_req, res) => {
    try {
      await checkDatabase();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'not_ready' });
    }
  });
  return app;
}
