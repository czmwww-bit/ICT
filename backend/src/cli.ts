import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pool, initialize, migrate } from './db.js';
import { parseBatch, validateLinks, type Kind } from './model.js';
import { importBatch, history, publish } from './store.js';
import { findCandidates, getClause } from './query.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'dry-run': { type: 'boolean' },
    'allow-demo': { type: 'boolean' },
    'include-demo': { type: 'boolean' },
    'include-history': { type: 'boolean' },
    'allow-rollback': { type: 'boolean' },
    file: { type: 'string' },
    kind: { type: 'string' },
    id: { type: 'string' },
    version: { type: 'string' },
    actor: { type: 'string' },
    reason: { type: 'string' },
    decision: { type: 'string' },
    matter: { type: 'string' },
    region: { type: 'string' },
    date: { type: 'string' },
  },
});
async function main() {
  const command = positionals[0];
  if (command === 'validate' || command === 'import') {
    const file = values.file;
    if (!file) throw new Error('请指定 --file JSON路径');
    const batch = parseBatch(JSON.parse(await readFile(file, 'utf8')), file);
    if (command === 'validate') {
      const errors = validateLinks(batch);
      const result = {
        file,
        documents: batch.documents.length,
        clauses: batch.clauses.length,
        errors: errors.length,
        messages: errors,
      };
      console.log(JSON.stringify(result, null, 2));
      if (errors.length) process.exitCode = 1;
      return;
    }
    const db = await pool();
    try {
      const result = await importBatch(db, batch, {
        dryRun: values['dry-run'],
        allowDemo: values['allow-demo'],
      });
      console.log(JSON.stringify({ file, ...result }, null, 2));
      if (result.errors) process.exitCode = 1;
    } finally {
      await db.end();
    }
    return;
  }
  if (command === 'init') {
    await initialize();
    console.log('数据库初始化完成');
    return;
  }
  const db = await pool();
  try {
    if (command === 'migrate') {
      await migrate(db);
      console.log('迁移完成');
      return;
    }
    if (command === 'publish') {
      if (
        !['document', 'clause'].includes(values.kind ?? '') ||
        !values.id ||
        !values.version ||
        !values.actor ||
        !values.reason
      )
        throw new Error('publish 需要 --kind document|clause --id --version --actor --reason');
      const decision = values.decision ?? 'approved';
      if (!['approved', 'rejected'].includes(decision)) throw new Error('无效 decision');
      console.log(
        JSON.stringify(
          await publish(
            db,
            values.kind as Kind,
            values.id,
            Number(values.version),
            values.actor,
            values.reason,
            decision as 'approved' | 'rejected',
            values['allow-rollback'],
          ),
          null,
          2,
        ),
      );
      return;
    }
    if (command === 'history') {
      if (!values.id || !['document', 'clause'].includes(values.kind ?? ''))
        throw new Error('history 需要 --kind document|clause --id');
      console.log(JSON.stringify(await history(db, values.kind as Kind, values.id), null, 2));
      return;
    }
    if (command === 'query') {
      const options = {
        includeDemo: values['include-demo'],
        includeHistory: values['include-history'],
      };
      if (values.id) {
        console.log(
          JSON.stringify(
            await getClause(db, values.id, {
              ...options,
              version: values.version ? Number(values.version) : undefined,
            }),
            null,
            2,
          ),
        );
        return;
      }
      if (!values.matter || !values.region || !values.date)
        throw new Error('query 需要 --matter --region --date 或 --id');
      console.log(
        JSON.stringify(
          await findCandidates(db, {
            ...options,
            matterId: values.matter,
            regionCode: values.region,
            asOf: values.date,
          }),
          null,
          2,
        ),
      );
      return;
    }
    throw new Error('命令: init migrate validate import publish query history');
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
