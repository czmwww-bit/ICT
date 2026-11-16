import { parseArgs } from 'node:util';
import { pool } from './db.js';
import { backupEvidence, restoreEvidence } from './backup.js';
import { monitorDirectory } from './operations.js';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' }, manifest: { type: 'string' } },
});
try {
  if (positionals[0] === 'backup') {
    if (!values.out) throw new Error('需要--out全新备份目录');
    const db = await pool();
    try {
      const m = await backupEvidence(db, values.out, monitorDirectory());
      console.log(
        JSON.stringify(
          {
            status: 'backed_up',
            manifest: values.out + '/manifest.json',
            tables: m.tables,
            archiveFiles: m.archives.length,
          },
          null,
          2,
        ),
      );
    } finally {
      await db.end();
    }
  } else if (positionals[0] === 'restore') {
    if (!values.manifest || !process.env.DB_RESTORE_TEST_NAME)
      throw new Error('需要--manifest及DB_RESTORE_TEST_NAME，先运行setup:restore');
    console.log(
      JSON.stringify(
        await restoreEvidence(values.manifest, process.env.DB_RESTORE_TEST_NAME),
        null,
        2,
      ),
    );
  } else throw new Error('命令：backup/restore');
} catch (e) {
  console.error(JSON.stringify({ status: 'error', message: (e as Error).message }));
  process.exitCode = 1;
}
