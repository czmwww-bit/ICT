import { parseArgs } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db.js';
import { showCandidates, showClause, annotateReviewNotes } from './query-view.js';
import { checkSources, listTasks, resolveTask } from './source-monitor.js';
import { operationsStatus, monitorDirectory } from './operations.js';
import { allVersions, publications, isApproved } from './store.js';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    matter: { type: 'string' },
    region: { type: 'string' },
    date: { type: 'string' },
    id: { type: 'string' },
    version: { type: 'string' },
    'include-demo': { type: 'boolean' },
    registry: { type: 'string', default: '../data/official/longyang-pilot/source-registry.json' },
    source: { type: 'string' },
    task: { type: 'string' },
    resolve: { type: 'string' },
    decision: { type: 'string' },
    actor: { type: 'string' },
    reason: { type: 'string' },
    out: { type: 'string' },
  },
});
async function main() {
  const command = positionals[0],
    directory = monitorDirectory();
  let result: unknown;
  if (command === 'check') {
    result = await checkSources({
      directory,
      registryFile: values.registry!,
      sourceId: values.source,
      timeoutMs: Number(process.env.SOURCE_TIMEOUT_MS ?? 15000),
    });
    const r = result as Awaited<ReturnType<typeof checkSources>>;
    if (r.results.some((s) => !['unchanged', 'changed', 'first_seen'].includes(s.status)))
      process.exitCode = 1;
  } else if (command === 'updates') {
    if (values.resolve) {
      if (
        !['dismissed', 'published'].includes(values.decision ?? '') ||
        !values.actor ||
        !values.reason
      )
        throw new Error(
          'resolve需要decision dismissed|published、actor、reason；published另需version',
        );
      const db = values.decision === 'published' ? await pool() : null;
      try {
        result = await resolveTask(
          directory,
          values.resolve,
          {
            decision: values.decision as 'dismissed' | 'published',
            actor: values.actor,
            reason: values.reason,
            documentVersion: values.version ? Number(values.version) : undefined,
          },
          db
            ? async (task, version) => {
                const versions = await allVersions(db),
                  events = await publications(db);
                return versions.some(
                  (v) =>
                    v.kind === 'document' &&
                    v.data.id === task.documentId &&
                    v.data.version === version &&
                    isApproved(v, events),
                );
              }
            : undefined,
        );
      } finally {
        await db?.end();
      }
    } else {
      const tasks = await listTasks(directory);
      result = values.task
        ? (tasks.find((t) => t.id === values.task) ?? { status: 'not_found' })
        : tasks.map((t) => ({
            id: t.id,
            sourceId: t.sourceId,
            documentId: t.documentId,
            status: t.status,
            changes: t.changes,
            detectedAt: t.detectedAt,
          }));
    }
  } else {
    const db = await pool();
    try {
      if (command === 'status') result = await operationsStatus(db, directory);
      else if (command === 'show') {
        if (values.id)
          result = await annotateReviewNotes(
            await showClause(db, values.id, values.version ? Number(values.version) : undefined),
          );
        else {
          if (!values.matter || !values.region || !values.date)
            throw new Error('show需要matter、region、date，或id及可选version');
          result = await annotateReviewNotes(
            await showCandidates(db, {
              matterId: values.matter,
              regionCode: values.region,
              asOf: values.date,
              includeDemo: values['include-demo'],
            }),
          );
        }
      } else throw new Error('命令：show/check/updates/status');
    } finally {
      await db.end();
    }
  }
  if (values.out) {
    await mkdir(path.dirname(values.out), { recursive: true });
    await writeFile(values.out, JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => {
  console.error(
    JSON.stringify({
      status: 'error',
      code: typeof e.code === 'string' ? e.code : 'MAINTENANCE_FAILED',
      message: e.sql ? '数据库操作失败，请查看本地日志/连接配置' : e.message,
    }),
  );
  process.exitCode = String(e.message).includes('SOURCE_CHECK_BUSY') ? 2 : 1;
});
