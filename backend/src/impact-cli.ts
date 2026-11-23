import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pool } from './db.js';
import { parseBatch } from './model.js';
import { readImpactCases } from './impact-cases.js';
import { runImpactPreview } from './impact-preview.js';
import { impactMarkdown } from './impact-report.js';
const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    cases: { type: 'string' },
    'demo-baseline': { type: 'string' },
    out: { type: 'string', default: '../reports/local/policy-impact' },
    date: { type: 'string' },
  },
});
const out = values.out!;
let errorArtifactAllowed = false;
async function main() {
  if (!values.file || !values.cases)
    throw new Error('需要 --file 待审核批次JSON --cases 查询用例JSON');
  const protectedFiles = [values.file, values.cases, values['demo-baseline']]
    .filter((f): f is string => !!f)
    .map((f) => path.resolve(f));
  const samePath = (a: string, b: string) =>
    process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  for (const dest of [out + '.json', out + '.md', out + '.error.json'])
    if (protectedFiles.some((f) => samePath(f, path.resolve(dest))))
      throw new Error('报告路径不可覆盖输入资料');
  errorArtifactAllowed = true;
  const inputs = await Promise.all(
    protectedFiles.map(async (file) => ({
      file,
      sha256: createHash('sha256')
        .update(await readFile(file))
        .digest('hex'),
    })),
  );
  const batch = parseBatch(JSON.parse(await readFile(values.file, 'utf8')), values.file),
    suite = await readImpactCases(values.cases);
  const demoBaseline = values['demo-baseline']
    ? parseBatch(
        JSON.parse(await readFile(values['demo-baseline'], 'utf8')),
        values['demo-baseline'],
      )
    : undefined;
  const date =
    values.date ??
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  const db = await pool();
  try {
    const report = {
      ...(await runImpactPreview(db, { batch, suite, demoBaseline, previewDate: date })),
      inputs,
    };
    for (const input of inputs)
      if (
        createHash('sha256')
          .update(await readFile(input.file))
          .digest('hex') !== input.sha256
      )
        throw new Error('预览期间输入文件变化，请重试');
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out + '.json', JSON.stringify(report, null, 2) + '\n');
    await writeFile(out + '.md', impactMarkdown(report));
    console.table(
      report.results.map((r: any) => ({
        用例: r.id,
        更新前: r.before.executed
          ? r.before.hits.map((h: any) => h.id + '@' + h.version).join(',') || '无'
          : '需补参数',
        模拟发布后: r.after.executed
          ? r.after.hits.map((h: any) => h.id + '@' + h.version).join(',') || '无'
          : '需补参数',
        变化: !r.before.executed ? '需确认参数' : r.diff.changed ? '有变化' : '无变化',
        待核: r.pending.length,
      })),
    );
    console.log(
      JSON.stringify({
        summary: report.summary,
        report: out + '.md',
        sourceDatabaseUnchanged: report.sourceDatabaseUnchanged,
        mode: report.mode,
      }),
    );
    if (report.summary.expectationFailures) process.exitCode = 1;
  } finally {
    await db.end();
  }
}
try {
  await main();
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  if (errorArtifactAllowed) {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(
      out + '.error.json',
      JSON.stringify(
        {
          executedAt: new Date().toISOString(),
          status: 'failed',
          message,
          notice: '本次失败不能当作无影响或通过，既有同名成功报告不代表本次结果',
        },
        null,
        2,
      ) + '\n',
    );
  }
  console.error(message);
  process.exitCode = 1;
}
