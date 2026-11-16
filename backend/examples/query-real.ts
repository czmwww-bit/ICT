import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { initialize, migrate } from '../src/db.js';
import { parseBatch } from '../src/model.js';
import { importBatch, publish } from '../src/store.js';
import { showCandidates, showClause, annotateReviewNotes } from '../src/query-view.js';
import { withEmptyTestDatabase } from '../src/test-sandbox.js';
const { values } = parseArgs({
  options: {
    isolated: { type: 'boolean' },
    matter: { type: 'string', default: 'HIGH_AGE_ALLOWANCE' },
    region: { type: 'string', default: '530502' },
    date: { type: 'string', default: '2026-11-16' },
    id: { type: 'string' },
    version: { type: 'string' },
  },
});
if (!values.isolated)
  throw new Error('真实资料尚未人工审核；演示请明确--isolated，正式库用data:show');
try {
  const result = await withEmptyTestDatabase(async (db) => {
    await initialize();
    await migrate(db);
    const batch = parseBatch(
      JSON.parse(await readFile('../data/official/longyang-pilot/batch.draft.json', 'utf8')),
    );
    for (const d of batch.documents) {
      d.checkedBy = '隔离演示，非人工政策审核';
      d.checkedAt = '2026-11-16';
    }
    const plan = await importBatch(db, batch);
    if (plan.errors) throw new Error(plan.messages.join('\n'));
    // 只有临时库追加技术审核事件；源JSON及项目库均不改。
    for (const d of batch.documents)
      await publish(db, 'document', d.id, 1, '隔离演示', '不代表真实资料人工审核');
    for (const c of batch.clauses)
      await publish(db, 'clause', c.id, 1, '隔离演示', '不代表真实资料人工审核');
    return annotateReviewNotes(
      await (values.id
        ? showClause(db, values.id, values.version ? Number(values.version) : undefined)
        : showCandidates(db, {
            matterId: values.matter!,
            regionCode: values.region!,
            asOf: values.date!,
          })),
    );
  });
  console.log(
    JSON.stringify(
      {
        scope: 'isolated_technical_preview',
        humanPolicyApproval: false,
        projectDatabaseWritten: false,
        testTablesCleaned: true,
        result,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
}
