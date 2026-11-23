// 技术预览仅使用现有空_test库，绝不修改资料原JSON或项目库。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { pool, migrate } from '../src/db.js';
import { parseBatch, type Batch } from '../src/model.js';
import { importBatch, publish } from '../src/store.js';
import { findCandidates } from '../src/query.js';
import { evidenceDigest, canonical } from '../src/backup.js';
import { withEmptyTestDatabase } from '../src/test-sandbox.js';
export const supplementRoot = '../data/official/longyang-pilot/supplement-2026-11-19/';
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export async function withPaymentPreview<T>(run: (db: Pool, batch: Batch) => Promise<T>) {
  const raw = await readFile(supplementRoot + 'batch.draft.json', 'utf8');
  const manifest = JSON.parse(await readFile(supplementRoot + 'manifest.json', 'utf8'));
  assert.equal(hash(raw), manifest.batchSha256);
  assert.equal(
    hash(await readFile('../data/official/longyang-pilot/batch.draft.json', 'utf8')),
    manifest.sourceMainBatchSha256,
  );
  const batch = parseBatch(JSON.parse(raw));
  const acquisition = JSON.parse(await readFile(supplementRoot + 'acquisition.json', 'utf8'));
  let sourceFilesVerified = 0,
    sourceTextsVerified = 0;
  for (const source of acquisition.records) {
    if (source.rawFile) {
      assert.equal(hash(await readFile(supplementRoot + source.rawFile, 'utf8')), source.sha256);
      sourceFilesVerified++;
    }
    if (source.textFile) {
      assert.equal(
        hash(await readFile(supplementRoot + source.textFile, 'utf8')),
        source.textSha256,
      );
      sourceTextsVerified++;
    }
  }
  const metadata = JSON.parse(await readFile(supplementRoot + 'document-metadata.json', 'utf8'));
  for (const m of metadata) {
    const d = batch.documents.find((d) => d.id === m.documentId)!;
    assert.equal(hash(d.originalText), m.acquisition.textSha256);
    assert.equal(d.sourceUrl, m.acquisition.url);
  }
  const project = await pool();
  try {
    const before = await evidenceDigest(project);
    const result = await withEmptyTestDatabase(async (db) => {
      await migrate(db);
      const prepared = structuredClone(batch);
      assert.ok(
        prepared.documents.every((d) => d.reviewStatus === 'draft' && d.checkedBy === null),
      );
      for (const d of prepared.documents) {
        d.checkedBy = '隔离金额记录技术预览，非政策审核';
        d.checkedAt = '2026-11-19';
      }
      const imported = await importBatch(db, prepared);
      assert.equal(imported.errors, 0);
      const draft = await findCandidates(db, {
        matterId: 'HIGH_AGE_ALLOWANCE',
        regionCode: '530502',
        asOf: '2026-11-19',
      });
      assert.equal(draft.length, 0);
      const repeated = await importBatch(db, prepared);
      assert.equal(repeated.unchanged, batch.documents.length + batch.clauses.length);
      for (const d of prepared.documents)
        await publish(
          db,
          'document',
          d.id,
          d.version,
          '隔离技术标签',
          '仅测试发布事件，不代表政策审核',
        );
      for (const c of prepared.clauses)
        await publish(
          db,
          'clause',
          c.id,
          c.version,
          '隔离技术标签',
          '仅测试发布事件，不代表政策审核',
        );
      return { draftExcluded: true, imported, repeated, result: await run(db, batch) };
    });
    assert.equal(canonical(before), canonical(await evidenceDigest(project)));
    assert.equal(
      hash(await readFile(supplementRoot + 'batch.draft.json', 'utf8')),
      manifest.batchSha256,
    );
    return {
      scope: 'isolated_technical_preview',
      humanPolicyApproved: false,
      projectDatabaseUnchanged: true,
      testTablesCleaned: true,
      batchSha256: manifest.batchSha256,
      sourceFilesVerified,
      sourceTextsVerified,
      ...result,
    };
  } finally {
    await project.end();
  }
}
