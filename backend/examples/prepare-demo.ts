// 本地开发夹具的准备与实测，不处理真实政策或用户资格。
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pool, config, migrate, rows } from '../src/db.js';
import { parseBatch, type Kind } from '../src/model.js';
import { importBatch, allVersions, publications, publish, history } from '../src/store.js';
import { findCandidates, getClause } from '../src/query.js';

async function main() {
  if (!process.argv.includes('--allow-demo'))
    throw new Error('这是虚构夹具初始化，请明确指定 --allow-demo');
  const connection = config();
  if (
    !['127.0.0.1', 'localhost'].includes(connection.host) ||
    !connection.database.startsWith('silver_local_') ||
    connection.database.endsWith('_test')
  )
    throw new Error('该演示脚本只用于setup:local创建的本地项目库');
  const batch = parseBatch(JSON.parse(await readFile('../data/demo/batch.json', 'utf8')));
  const update = parseBatch(JSON.parse(await readFile('../data/demo/update-clause.json', 'utf8')));
  assert.ok(
    [...batch.documents, ...batch.clauses, ...update.clauses].every((r) => r.dataset === 'demo'),
  );
  const db = await pool();
  const checks: { name: string; status: 'pass'; details: unknown }[] = [];
  const record = (name: string, details: unknown) => checks.push({ name, status: 'pass', details });
  try {
    await migrate(db);
    await migrate(db);
    record('迁移可重复执行', await rows(db, 'SELECT name FROM evidence_migrations ORDER BY name'));
    const before = (await allVersions(db)).length;
    const plan = await importBatch(db, batch, { allowDemo: true, dryRun: true });
    assert.equal(plan.errors, 0);
    assert.equal((await allVersions(db)).length, before);
    record('预检查不写入', plan);
    const imported = await importBatch(db, batch, { allowDemo: true });
    assert.equal(imported.errors, 0);
    const count = (await allVersions(db)).length;
    const repeat = await importBatch(db, batch, { allowDemo: true });
    assert.equal(repeat.errors, 0);
    assert.equal(repeat.unchanged, 6);
    assert.equal((await allVersions(db)).length, count);
    record('导入与重复导入幂等', { imported, repeat, versions: count });
    const publishDemo = async (kind: Kind, id: string, version: number) => {
      const event = (await publications(db))
        .filter((e) => e.kind === kind && e.id === id && e.version === version)
        .at(-1);
      if (event?.decision === 'rejected')
        throw new Error(`${id}@${version}已明确撤回，请人工处理，演示脚本不会自动恢复`);
      if (!event)
        await publish(
          db,
          kind,
          id,
          version,
          '开发样例核对',
          '虚构开发夹具演示，不代表真实政策审核',
        );
    };
    for (const d of batch.documents) await publishDemo('document', d.id, 1);
    for (const c of batch.clauses) await publishDemo('clause', c.id, 1);
    record('演示文件和条款独立发布', { documents: 3, clauses: 3, dataset: 'demo' });
    const updated = await importBatch(db, update, { allowDemo: true });
    assert.equal(updated.errors, 0);
    await publishDemo('clause', 'DEMO_C1', 2);
    const old = await getClause(db, 'DEMO_C1', {
      includeDemo: true,
      includeHistory: true,
      version: 1,
    });
    const current = await getClause(db, 'DEMO_C1', { includeDemo: true });
    assert.equal(old[0]!.clause.version, 1);
    assert.equal(current[0]!.clause.version, 2);
    record('条款更新与历史保留', { update: updated, oldVersion: 1, currentVersion: 2 });
    const input = { matterId: 'DEMO_ALLOWANCE', regionCode: 'DEMO_A', asOf: '2026-11-16' };
    const candidates = await findCandidates(db, { ...input, includeDemo: true });
    assert.equal(candidates.length, 3);
    assert.equal((await findCandidates(db, input)).length, 0);
    record('默认正式查询排除样例', { formalCount: 0, demoCount: 3 });
    assert.equal(
      (await findCandidates(db, { ...input, includeDemo: true, regionCode: 'DEMO_A_TOWN' })).length,
      3,
    );
    assert.equal(
      (await findCandidates(db, { ...input, includeDemo: true, regionCode: 'DEMO_B' })).length,
      0,
    );
    record('行政区祖先与邻区筛选', { descendant: 3, neighbor: 0 });
    assert.equal(
      (await findCandidates(db, { ...input, includeDemo: true, asOf: '2027-01-01' })).length,
      2,
    );
    assert.equal(candidates.find((c) => c.clause.id === 'DEMO_C3')!.timeStatus, 'needs_review');
    record('日期筛选及未知日期提示', { afterRecordedEndCount: 2, unknownStart: 'needs_review' });
    assert.equal(
      candidates.find((c) => c.clause.id === 'DEMO_C2')!.relations[0]!.targetClauseId,
      'DEMO_C1',
    );
    assert.ok(
      candidates.every(
        (c) => c.source.quote && c.source.url.startsWith('https://example.invalid/'),
      ),
    );
    record('原文、来源版本和明确修订关系', {
      sources: candidates.map((c) => c.source),
      relationTarget: 'DEMO_C1@1',
    });
    const report = {
      generatedAt: new Date().toISOString(),
      server: (await rows<{ version: string }>(db, 'SELECT VERSION() AS version'))[0]!.version,
      database: connection.database,
      dataset: 'demo',
      checks,
      candidates,
      clauseHistory: await history(db, 'clause', 'DEMO_C1'),
    };
    await mkdir('../reports', { recursive: true });
    await writeFile('../reports/local-database.json', JSON.stringify(report, null, 2) + '\n');
    await writeFile(
      '../reports/local-database.md',
      [
        '# 本地资料库实际验证',
        '',
        `MySQL ${report.server}；数据库 ${report.database}；全部数据为虚构demo。`,
        '',
        ...checks.map((c) => `- 通过：${c.name}`),
        '',
        '逐条详情、原文来源及版本历史见 local-database.json；这不是业务指南准确率报告。',
      ].join('\n') + '\n',
    );
    console.log(
      JSON.stringify(
        {
          database: connection.database,
          checks: checks.map((c) => ({ name: c.name, status: c.status })),
          sources: candidates.map((c) => ({
            id: c.clause.id,
            version: c.clause.version,
            url: c.source.url,
          })),
          report: '../reports/local-database.json',
        },
        null,
        2,
      ),
    );
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
