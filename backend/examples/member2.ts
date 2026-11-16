import { pool } from '../src/db.js';
import { findCandidates, getClause } from '../src/query.js';
const db = await pool();
try {
  console.log(
    '候选条款',
    JSON.stringify(
      await findCandidates(db, {
        matterId: 'DEMO_ALLOWANCE',
        regionCode: 'DEMO_A',
        asOf: '2026-11-16',
        includeDemo: true,
      }),
      null,
      2,
    ),
  );
  console.log(
    '引用原文',
    JSON.stringify(await getClause(db, 'DEMO_C1', { includeDemo: true }), null, 2),
  );
} finally {
  await db.end();
}
