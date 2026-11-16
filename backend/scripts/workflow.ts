import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import { pool, initialize, migrate, rows } from '../src/db.js';
import { parseBatch } from '../src/model.js';
import {
  importBatch,
  publish,
  history,
  allVersions,
  publications,
  isApproved,
} from '../src/store.js';
import { getClause, findCandidates, snapshot } from '../src/query.js';
import {
  checkSources,
  listTasks,
  resolveTask,
  sha256,
  monitorStatus,
} from '../src/source-monitor.js';
import { operationsStatus } from '../src/operations.js';
import { backupEvidence, restoreEvidence, evidenceDigest, canonical } from '../src/backup.js';
import { withEmptyTestDatabase, evidenceTables } from '../src/test-sandbox.js';
import {
  evaluateRetrieval,
  corpusCompleteness,
  type RetrievalCase,
} from '../src/retrieval-evaluation.js';
import { startRestoreEngine } from './restore-engine.js';
const onlyQueries = process.argv.includes('--queries-only');
const project = await pool(),
  before = await evidenceDigest(project);
await mkdir('../reports/local/workflows', { recursive: true });
const directory = await mkdtemp(path.resolve('../reports/local/workflows/run-'));
const stages: { name: string; status: string; details: unknown }[] = [],
  retrieval: Awaited<ReturnType<typeof evaluateRetrieval>> = [];
let error: string | null = null,
  restore: { status: string; [key: string]: unknown } = {
    status: onlyQueries ? 'not_requested' : 'not_executed',
  },
  cleaned = false;
const raw = await readFile('../data/official/longyang-pilot/batch.draft.json', 'utf8'),
  originalBatch = parseBatch(JSON.parse(raw));
const suite = JSON.parse(await readFile('../eval/query/longyang-retrieval.json', 'utf8')) as {
  version: string;
  cases: RetrievalCase[];
};
const technical = '隔离技术测试，不代表政策人工审核';
try {
  await withEmptyTestDatabase(async (db) => {
    // 实际执行已有初始化CLI；子进程只继承独立测试库名，不在报告回显连接配置。
    const init = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'init'], {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env },
      timeout: 30000,
    });
    assert.equal(init.status, 0, init.stderr);
    await migrate(db);
    stages.push({
      name: '独立环境初始化/迁移',
      status: 'pass',
      details: { command: 'node --import tsx src/cli.ts init', exitCode: init.status },
    });
    const b = structuredClone(originalBatch);
    for (const d of b.documents) {
      d.checkedBy = technical;
      d.checkedAt = '2026-11-16';
    }
    b.regions.push({
      code: '530521',
      name: '施甸县（隔离区域验证）',
      parentCode: '530500',
      dataset: 'official',
    });
    assert.equal((await importBatch(db, b)).added, 103);
    assert.equal((await importBatch(db, b)).unchanged, 103);
    retrieval.push(...(await evaluateRetrieval(db, suite.cases, 'draft')));
    const docIds = ['YN_GLT_2024_113', 'CN_CONSUMPTION_LAUNCH_2026', 'LY_CONSUMPTION_GUIDE_2026'];
    const clauseIds = [
      'YN_GLT_ELIGIBILITY',
      'YN_GLT_PROVINCIAL_RATES',
      'YN_GLT_MONTHLY_PAYMENT',
      'YN_GLT_HOUSEHOLD_SEPARATION',
      'YN_GLT_UNREACHABLE',
      'CN_CONSUMPTION_LAUNCH_2026_START',
      'CN_CONSUMPTION_LAUNCH_2026_CYCLE',
      'LY_CONSUMPTION_GUIDE_2026_CONTACT',
    ];
    for (const id of docIds) await publish(db, 'document', id, 1, technical, '隔离技术审核事件');
    for (const id of clauseIds) await publish(db, 'clause', id, 1, technical, '隔离技术审核事件');
    retrieval.push(...(await evaluateRetrieval(db, suite.cases, 'current')));
    const eligibility = structuredClone(b.clauses.find((c) => c.id === 'YN_GLT_ELIGIBILITY')!);
    eligibility.version = 2;
    eligibility.expectedVersion = 1;
    eligibility.locator += '（仅隔离校对版本测试，不是政策修改）';
    assert.equal(
      (
        await importBatch(db, {
          schemaVersion: 1,
          actor: technical,
          reason: '只校对一条定位',
          regions: [],
          documents: [],
          clauses: [eligibility],
        })
      ).modified,
      1,
    );
    retrieval.push(...(await evaluateRetrieval(db, suite.cases, 'partial_draft')));
    await publish(db, 'clause', eligibility.id, 2, technical, '仅隔离定位版本测试');
    retrieval.push(...(await evaluateRetrieval(db, suite.cases, 'partial_published')));
    assert.equal((await history(db, 'clause', eligibility.id)).versions.length, 2);
    stages.push({
      name: '真实条款检索/日期地区/局部版本边界',
      status: retrieval.every((r) => r.checks.every((c) => c.pass)) ? 'pass' : 'fail',
      details: {
        cases: retrieval.length,
        sourceStatus: '仅在隔离库技术审核，真实JSON与项目库未发布',
      },
    });
    const demo = parseBatch(JSON.parse(await readFile('../data/demo/batch.json', 'utf8')));
    demo.clauses.push({ ...structuredClone(demo.clauses[0]!), id: 'DEMO_UNCHANGED' });
    assert.equal((await importBatch(db, demo, { allowDemo: true })).added, 7);
    for (const d of demo.documents) await publish(db, 'document', d.id, 1, technical, '虚构夹具');
    for (const c of demo.clauses) await publish(db, 'clause', c.id, 1, technical, '虚构夹具');
    assert.equal(
      (
        await findCandidates(db, {
          matterId: 'DEMO_ALLOWANCE',
          regionCode: 'DEMO_A',
          asOf: '2026-11-16',
        })
      ).length,
      0,
      '默认排除demo',
    );
    assert.equal((await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!.clause.version, 1);
    const ended = await findCandidates(db, {
      matterId: 'DEMO_ALLOWANCE',
      regionCode: 'DEMO_A',
      asOf: '2027-01-01',
      includeDemo: true,
    });
    assert.ok(!ended.some((c) => c.clause.id === 'DEMO_C1'), '明确结束日之后排除');
    stages.push({
      name: '样例导入/查询/历史及明确结束日',
      status: 'pass',
      details: {
        defaultExcludesDemo: true,
        versions: (await history(db, 'clause', 'DEMO_C1')).versions.length,
      },
    });
    if (onlyQueries) return;
    const doc = demo.documents[0]!,
      clause = demo.clauses[0]!,
      delta = '\n【模拟网页变更】新增材料：示例回执。',
      newQuote = clause.quote + delta;
    const newText = doc.originalText.replace(clause.quote, newQuote);
    let current = doc.originalText;
    const toHtml = (text: string) =>
      '<article><p>' +
      text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;') +
      '</p></article>';
    const server = createServer((_req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(toHtml(current));
    });
    server.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', r));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('模拟服务未监听');
    const url = `http://127.0.0.1:${address.port}/notice`,
      monitor = path.join(directory, 'source-monitor'),
      registryFile = path.join(directory, 'mock-registry.json'),
      baseline = path.join(directory, 'baseline.html');
    try {
      await writeFile(baseline, toHtml(current));
      await writeFile(
        registryFile,
        JSON.stringify({
          schemaVersion: 1,
          sources: [
            {
              id: 'DEMO_SOURCE',
              documentId: doc.id,
              url,
              format: 'html',
              selector: 'article',
              baseline: { file: baseline },
            },
          ],
        }),
      );
      assert.equal(
        (await checkSources({ directory: monitor, registryFile })).results[0]!.status,
        'unchanged',
      );
      current = newText;
      const changed = await checkSources({ directory: monitor, registryFile });
      assert.equal(changed.results[0]!.status, 'changed');
      const taskId = changed.results[0]!.taskId!;
      assert.equal(
        (await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!.clause.version,
        1,
        '检查变化不会自动发布',
      );
      await checkSources({ directory: monitor, registryFile });
      assert.equal((await listTasks(monitor)).length, 1);
      const next = parseBatch({
        schemaVersion: 1,
        actor: technical,
        reason: '模拟来源变化，非真实政策',
        regions: [],
        documents: [{ ...doc, version: 2, expectedVersion: 1, originalText: newText }],
        clauses: [
          {
            ...clause,
            version: 2,
            expectedVersion: 1,
            documentVersion: 2,
            quote: newQuote,
            materials: [
              ...(clause.materials ?? []),
              { text: '示例回执', quote: '新增材料：示例回执。', locator: '【模拟更新】新增行' },
            ],
          },
        ],
      });
      assert.equal((await importBatch(db, next, { allowDemo: true })).modified, 2);
      assert.equal(
        (await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!.clause.version,
        1,
        '新草稿不遮蔽旧版',
      );
      const verify = async (t: { documentId: string }, version: number) => {
        const vs = await allVersions(db),
          ev = await publications(db);
        return vs.some(
          (v) =>
            v.kind === 'document' &&
            v.data.id === t.documentId &&
            v.data.version === version &&
            isApproved(v, ev),
        );
      };
      await assert.rejects(
        resolveTask(
          monitor,
          taskId,
          {
            decision: 'published',
            actor: technical,
            reason: '提前标完成应失败',
            documentVersion: 2,
          },
          verify,
        ),
      );
      await publish(db, 'document', doc.id, 2, technical, '模拟原文核对');
      await publish(db, 'clause', clause.id, 2, technical, '模拟条款核对');
      await resolveTask(
        monitor,
        taskId,
        {
          decision: 'published',
          actor: technical,
          reason: '关联已发布的模拟来源版本',
          documentVersion: 2,
        },
        verify,
      );
      const after = (await getClause(db, 'DEMO_C1', { includeDemo: true }))[0]!;
      assert.equal(after.clause.version, 2);
      assert.equal(after.source.documentVersion, 2);
      assert.ok(after.source.quote.includes('示例回执'));
      assert.equal(
        (await getClause(db, 'DEMO_UNCHANGED', { includeDemo: true }))[0]!.clause.version,
        1,
      );
      assert.equal((await history(db, 'clause', 'DEMO_C1')).versions.length, 2);
      assert.equal(
        (
          await getClause(db, 'DEMO_C1', { includeDemo: true, includeHistory: true, version: 1 })
        )[0]!.clause.version,
        1,
      );
      stages.push({
        name: '模拟官方网页变化→差异→草稿→技术审核→新版查询',
        status: 'pass',
        details: {
          sourceIsMock: true,
          taskId,
          oldVersion: 1,
          newVersion: 2,
          unmodifiedClauseVersion: 1,
          diff: (await listTasks(monitor))[0]!.diff,
          newSource: after.source,
          pendingAfter: (await monitorStatus(monitor)).pendingSourceUpdates,
        },
      });
      const backupDir = path.join(directory, 'backup');
      try {
        const manifest = await backupEvidence(db, backupDir, monitor);
        stages.push({
          name: 'MySQL原生备份及原件/更新检查记录备份',
          status: 'pass',
          details: {
            manifest: path.join(backupDir, 'manifest.json'),
            tables: manifest.tables,
            archives: manifest.archives.length,
            runtimeFiles: manifest.runtimeFiles.length,
          },
        });
        let engine: Awaited<ReturnType<typeof startRestoreEngine>> | undefined;
        if (!process.env.DB_RESTORE_TEST_NAME) {
          try {
            engine = await startRestoreEngine(directory);
          } catch (e) {
            restore = {
              status: 'not_executed',
              reason:
                '没有独立恢复库，临时实例也不可用：' +
                (e as Error).message +
                '；可运行setup:restore准备。',
            };
          }
        }
        try {
          if (process.env.DB_RESTORE_TEST_NAME) {
            const target = process.env.DB_RESTORE_TEST_NAME;
            restore = await restoreEvidence(path.join(backupDir, 'manifest.json'), target);
            const restored = await pool(true, target);
            try {
              assert.equal(canonical(await evidenceDigest(restored)), canonical(manifest.tables));
              const result = (await getClause(restored, 'DEMO_C1', { includeDemo: true }))[0]!;
              assert.equal(result.clause.version, 2);
              assert.equal(result.source.documentVersion, 2);
              assert.equal((await history(restored, 'clause', 'DEMO_C1')).versions.length, 2);
              assert.equal(
                (await getClause(restored, 'DEMO_C2', { includeDemo: true }))[0]!.relations[0]!
                  .targetClauseId,
                'DEMO_C1',
              );
              assert.equal((await getClause(restored, 'YN_GLT_ELIGIBILITY'))[0]!.clause.version, 2);
              assert.equal(
                (await operationsStatus(restored, path.join(backupDir, 'restored-source-monitor')))
                  .pendingSourceUpdates,
                0,
              );
              const actual = (await rows<Record<string, string>>(restored, 'SHOW TABLES'))
                .map((r) => Object.values(r)[0]!)
                .sort();
              assert.deepEqual(actual, [...evidenceTables].sort(), '恢复库存在外来表则保留现场');
              for (const t of evidenceTables) await restored.query(`DROP TABLE \`${t}\``);
              restore.targetTestTablesCleaned = true;
              restore.targetScope = engine?.scope ?? 'configured_independent_restore_test';
            } finally {
              await restored.end();
            }
          }
        } finally {
          await engine?.close();
        }
        stages.push({
          name: '另一个空库恢复、版本/状态/关系/原件及更新记录一致',
          status: restore.status === 'restored' ? 'pass' : 'not_executed',
          details: restore,
        });
      } catch (e) {
        restore = { status: 'failed', error: e instanceof Error ? e.message : String(e) };
        stages.push({ name: '备份恢复', status: 'fail', details: restore });
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
  cleaned = true;
} catch (e) {
  error = e instanceof Error ? e.message : String(e);
}
const after = await evidenceDigest(project);
await project.end();
const technicalPassed =
  error === null &&
  canonical(before) === canonical(after) &&
  retrieval.length === suite.cases.length &&
  retrieval.every((r) => r.checks.every((c) => c.pass)) &&
  !stages.some((s) => s.status === 'fail');
const passed = technicalPassed && (onlyQueries || restore.status === 'restored');
let commit = 'unknown',
  dirty = true;
try {
  const gitArgs = ['-c', `safe.directory=${path.resolve('..').replaceAll('\\', '/')}`];
  commit = execFileSync('git', [...gitArgs, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  dirty = Boolean(
    execFileSync('git', [...gitArgs, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim(),
  );
} catch {}
const checks = retrieval.flatMap((r) => r.checks),
  report = {
    executedAt: new Date().toISOString(),
    mode: onlyQueries ? 'retrieval-only-isolated' : 'isolated-full-workflow',
    sourceHumanApproved: false,
    projectDatabaseUnchanged: canonical(before) === canonical(after),
    sourceTestTablesCleaned: cleaned,
    passed,
    technicalPassed,
    executionStatus: !technicalPassed ? 'failed' : passed ? 'passed' : 'partial',
    error,
    codeVersion: { commit, dirty },
    dataVersion: sha256(raw),
    testSetVersion: suite.version,
    workDirectory: directory,
    stages,
    corpusCompleteness: corpusCompleteness(originalBatch),
    retrieval: {
      cases: retrieval.length,
      checksPassed: checks.filter((c) => c.pass).length,
      checksFailed: checks.filter((c) => !c.pass).length,
      checksExpected: suite.cases.length * 5,
      checksNotExecuted: (suite.cases.length - retrieval.length) * 5,
      manualAdviceReview: suite.cases.length,
      results: retrieval,
    },
    restore,
  };
const prefix = onlyQueries ? '../reports/longyang-retrieval' : '../reports/member3-workflow';
await writeFile(prefix + '.json', JSON.stringify(report, null, 2) + '\n');
await writeFile(
  prefix + '.md',
  '# 成员③实际运行报告\n\n' +
    `模式：${report.mode}；执行时间：${report.executedAt}。真实政策人工审核：未完成。项目库未变：${report.projectDatabaseUnchanged}；源测试表已清理：${cleaned}。\n\n` +
    '|阶段|结果|\n|---|---|\n' +
    stages.map((s) => `|${s.name}|${s.status}|`).join('\n') +
    `\n\n检索技术检查${report.retrieval.checksPassed}/${report.retrieval.checksExpected}通过，失败${report.retrieval.checksFailed}，未执行${report.retrieval.checksNotExecuted}；${suite.cases.length}例建议/年龄资格语义仍待人工核对。年龄案例只验证能取得含年龄条件的条款，不在资料层判资格。\n\n语料完整性：\n\n` +
    Object.entries(report.corpusCompleteness)
      .map(([k, v]) => `- ${k}：${v.numerator}/${v.denominator}；未知${v.unknown}。${v.note}`)
      .join('\n') +
    '\n\n|案例|实际命中|失败原因|\n|---|---|---|\n' +
    retrieval
      .map(
        (r) =>
          `|${r.id} ${r.description}|${r.actual.join(',')}|${
            r.checks
              .filter((c) => !c.pass)
              .map((c) => c.reason)
              .join('；') || '无'
          }|`,
      )
      .join('\n') +
    `\n\n恢复：${JSON.stringify(restore)}\n\n错误：${error ?? '无'}。源码版本dirty=${dirty}，不是已提交代码完全一致的声明。运行细节见JSON。\n`,
);
console.log(
  JSON.stringify(
    {
      passed,
      error,
      projectDatabaseUnchanged: report.projectDatabaseUnchanged,
      sourceTestTablesCleaned: cleaned,
      retrievalPassed: report.retrieval.checksPassed,
      retrievalExpected: report.retrieval.checksExpected,
      restore: restore.status,
      report: prefix,
    },
    null,
    2,
  ),
);
if (!technicalPassed) process.exitCode = 1;
else if (!passed) process.exitCode = 2;
