import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool, migrate, rows } from '../src/db.js';
import { parseBatch } from '../src/model.js';
import { importBatch, publish, history } from '../src/store.js';
import { getClause, findCandidates } from '../src/query.js';
test(
  '真实 MySQL：空库、事务、幂等、独立发布、历史查询',
  { skip: !process.env.DB_TEST_NAME || process.env.DB_TEST_NAME.includes('<') },
  async () => {
    const name = process.env.DB_TEST_NAME!;
    assert.match(name, /^[A-Za-z0-9_]+_test$/, '只允许独立 _test 数据库');
    process.env.DB_NAME = name;
    const db = await pool();
    const guard = await db.getConnection();
    const lockName = `evidence-test:${createHash('sha256').update(name).digest('hex').slice(0, 32)}`;
    let ownsLock = false;
    try {
      const [lock] = await rows<{ acquired: number }>(guard, 'SELECT GET_LOCK(?,0) AS acquired', [
        lockName,
      ]);
      assert.equal(lock?.acquired, 1, '此测试库正被另一轮测试使用');
      ownsLock = true;
      assert.equal(
        (await rows(db, 'SHOW TABLES')).length,
        0,
        '请使用独立空测试库；脚本不会清空任何已有库',
      );
      await migrate(db);
      await migrate(db);
      assert.equal((await rows(db, 'SELECT * FROM evidence_migrations')).length, 2);
      const b = parseBatch(JSON.parse(await readFile('../data/demo/batch.json', 'utf8')));
      assert.equal((await importBatch(db, b, { allowDemo: true })).added, 6);
      assert.equal((await importBatch(db, b, { allowDemo: true })).unchanged, 6);
      assert.equal((await rows(db, 'SELECT * FROM evidence_versions')).length, 6);
      assert.equal((await getClause(db, 'DEMO_C1', { includeDemo: true })).length, 0);
      for (const d of b.documents)
        await publish(db, 'document', d.id, 1, '集成测试', '示例文件核对');
      for (const c of b.clauses) await publish(db, 'clause', c.id, 1, '集成测试', '示例条款核对');
      assert.equal((await getClause(db, 'DEMO_C1')).length, 0);
      assert.equal(
        (await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!.source.url,
        b.documents[0]!.sourceUrl,
      );
      assert.equal(
        (
          await findCandidates(db, {
            matterId: 'DEMO_ALLOWANCE',
            regionCode: 'DEMO_A_TOWN',
            asOf: '2026-11-16',
            includeDemo: true,
          })
        ).length,
        3,
      );
      assert.equal(
        (
          await findCandidates(db, {
            matterId: 'DEMO_ALLOWANCE',
            regionCode: 'DEMO_B',
            asOf: '2026-11-16',
            includeDemo: true,
          })
        ).length,
        0,
      );
      const update = parseBatch(
        JSON.parse(await readFile('../data/demo/update-clause.json', 'utf8')),
      );
      assert.equal((await importBatch(db, update, { allowDemo: true })).modified, 1);
      assert.equal((await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!.clause.version, 1);
      await publish(db, 'clause', 'DEMO_C1', 2, '集成测试', '发布定位更正');
      assert.equal((await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!.clause.version, 2);
      assert.equal(
        (await getClause(db, 'DEMO_C1', { includeDemo: true, includeHistory: true, version: 1 }))
          .length,
        1,
      );
      assert.equal((await history(db, 'clause', 'DEMO_C1')).versions.length, 2);
      await assert.rejects(
        publish(db, 'clause', 'DEMO_C1', 1, '集成测试', '陈旧版本审核'),
        /allow-rollback/,
      );
      await publish(db, 'clause', 'DEMO_C1', 2, '集成测试', '撤回错误版本', 'rejected');
      assert.equal((await getClause(db, 'DEMO_C1', { includeDemo: true })).length, 0);
      await publish(db, 'clause', 'DEMO_C1', 1, '集成测试', '明确恢复旧快照', 'approved', true);
      assert.equal((await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!.clause.version, 1);
      const raceA = structuredClone(update),
        raceB = structuredClone(update);
      for (const r of [raceA, raceB]) {
        r.clauses[0]!.version = 3;
        r.clauses[0]!.expectedVersion = 2;
      }
      raceA.clauses[0]!.locator = '并发校对A';
      raceB.clauses[0]!.locator = '并发校对B';
      const races = await Promise.all([
        importBatch(db, raceA, { allowDemo: true }),
        importBatch(db, raceB, { allowDemo: true }),
      ]);
      assert.equal(races.filter((p) => p.errors === 0).length, 1);
      assert.equal(races.filter((p) => p.errors > 0).length, 1);
      // official仅用于这个独立空测试库中的合成夹具，URL为保留示例域名；绝不写项目库。
      const official = parseBatch(JSON.parse(JSON.stringify(b).replaceAll('DEMO_', 'QA_')));
      for (const region of official.regions) region.dataset = 'official';
      for (const document of official.documents) {
        document.dataset = 'official';
        document.title = '【隔离测试，非真实政策】' + document.title;
        document.sourceUrl = 'https://example.org/role3-isolated-test/' + document.id;
      }
      for (const clause of official.clauses) clause.dataset = 'official';
      assert.equal((await importBatch(db, official)).added, 6);
      const formalInput = { matterId: 'QA_ALLOWANCE', regionCode: 'QA_A', asOf: '2026-11-16' };
      assert.equal((await findCandidates(db, formalInput)).length, 0, '正式数据的草稿不得查询');
      await publish(db, 'document', 'QA_D1', 1, '隔离测试程序', '合成夹具，非真实政策审核');
      await publish(db, 'clause', 'QA_C1', 1, '隔离测试程序', '合成夹具，非真实政策审核');
      const formal = await findCandidates(db, formalInput);
      assert.equal(formal.length, 1);
      assert.equal(formal[0]!.source.documentVersion, 1);
      assert.equal(formal[0]!.source.quote, official.clauses[0]!.quote);
      assert.equal(formal[0]!.document.publisher, official.documents[0]!.publisher);
      assert.equal((await findCandidates(db, { ...formalInput, asOf: '2025-12-31' })).length, 0);
      assert.equal((await findCandidates(db, { ...formalInput, asOf: '2026-12-31' })).length, 1);
      assert.equal((await findCandidates(db, { ...formalInput, asOf: '2027-01-01' })).length, 0);
      assert.equal(
        (await getClause(db, 'DEMO_C3', { includeDemo: true }))[0]!.timeStatus,
        'needs_review',
      );
      await publish(db, 'document', 'QA_D2', 1, '隔离测试程序', '较新发布日期不自动撤销旧条款');
      assert.equal((await findCandidates(db, formalInput)).length, 1);
      await publish(db, 'document', 'QA_D1', 1, '隔离测试程序', '撤回来源文件测试', 'rejected');
      assert.equal(
        (await findCandidates(db, formalInput)).length,
        0,
        '撤回来源的条款不得进入正式查询',
      );
      const closed = await pool();
      await closed.end();
      await assert.rejects(findCandidates(closed, formalInput), /closed/i);
      await assert.rejects(getClause(closed, 'QA_C1'), /closed/i);
      const invalid = structuredClone(b);
      invalid.clauses[0]!.documentId = 'MISSING';
      assert.ok((await importBatch(db, invalid, { allowDemo: true })).errors);
      const before = (await rows(db, 'SELECT * FROM evidence_versions')).length;
      const batchesBefore = (await rows(db, 'SELECT * FROM evidence_batches')).length;
      // CHECK在第二条写入时产生真实SQL错误，不需要SUPER或修改全局日志配置。
      await db.query(
        "ALTER TABLE evidence_versions ADD CONSTRAINT evidence_test_failure CHECK (id <> 'DEMO_FAIL')",
      );
      try {
        const failure = structuredClone(b);
        failure.clauses = [];
        failure.documents = [
          { ...b.documents[0]!, id: 'DEMO_GOOD' },
          { ...b.documents[0]!, id: 'DEMO_FAIL' },
        ];
        failure.regions.push({
          code: 'DEMO_ROLLBACK',
          name: '【虚构】回滚测试区',
          parentCode: 'DEMO_CITY',
          dataset: 'demo',
        });
        await assert.rejects(
          importBatch(db, failure, { allowDemo: true }),
          /evidence_test_failure/,
        );
        assert.equal((await rows(db, 'SELECT * FROM evidence_versions')).length, before);
        assert.equal((await rows(db, 'SELECT * FROM evidence_batches')).length, batchesBefore);
        assert.equal(
          (await rows(db, "SELECT * FROM evidence_regions WHERE code='DEMO_ROLLBACK'")).length,
          0,
        );
        assert.equal(
          (await rows(db, "SELECT * FROM evidence_heads WHERE id='DEMO_GOOD'")).length,
          0,
        );
      } finally {
        await db.query('ALTER TABLE evidence_versions DROP CHECK evidence_test_failure');
      }
      const ownedTables = [
        'evidence_publications',
        'evidence_versions',
        'evidence_heads',
        'evidence_batches',
        'evidence_regions',
        'evidence_import_lock',
        'evidence_migrations',
      ];
      const tables = (await rows<Record<string, string>>(db, 'SHOW TABLES')).map(
        (row) => Object.values(row)[0]!,
      );
      assert.deepEqual(
        [...tables].sort(),
        [...ownedTables].sort(),
        '发现非本测试创建的表，保留现场，不清理',
      );
      // 开始时已确认空库；成功后仅移除本次建立的表，保留数据库供重复验证。
      for (const table of ownedTables) await db.query(`DROP TABLE \`${table}\``);
      assert.equal((await rows(db, 'SHOW TABLES')).length, 0);
    } finally {
      if (ownsLock) await guard.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {});
      guard.release();
      await db.end();
    }
  },
);
