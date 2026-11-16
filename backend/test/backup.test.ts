import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { restoreEvidence } from '../src/backup.js';
import { sha256 } from '../src/source-monitor.js';
test('恢复拒绝非独立库名、校验值变化及库切换SQL，验证前不连接目标库', async () => {
  await assert.rejects(restoreEvidence('missing.json', 'production'), /只允许/);
  await mkdir('../reports/local/backup-unit', { recursive: true });
  const dir = await mkdtemp(path.resolve('../reports/local/backup-unit/case-')),
    manifest = path.join(dir, 'manifest.json');
  const base = {
    schemaVersion: 1,
    sourceDatabase: 'source_test',
    dumpFile: 'evidence.sql',
    dumpSha256: 'bad',
    tables: {},
    archives: [],
    runtimeFiles: [],
  };
  await writeFile(path.join(dir, 'evidence.sql'), 'SELECT 1;');
  await writeFile(manifest, JSON.stringify(base));
  await assert.rejects(restoreEvidence(manifest, 'isolated_restore_test'), /哈希不符/);
  const sql = 'USE other_database;\nCREATE TABLE malicious(id INT);';
  await writeFile(path.join(dir, 'evidence.sql'), sql);
  await writeFile(manifest, JSON.stringify({ ...base, dumpSha256: sha256(sql) }));
  await assert.rejects(restoreEvidence(manifest, 'isolated_restore_test'), /库切换/);
});
