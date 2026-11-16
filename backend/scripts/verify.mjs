import { spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const npmCLI = process.env.npm_execpath;
if (!npmCLI) throw new Error('请通过 npm run verify 调用');
const logs = [];
function run(label, args, expected = 0, allowSkip = false) {
  const p = spawnSync(process.execPath, [npmCLI, ...args], { encoding: 'utf8', timeout: 60000 });
  const output = (p.stdout ?? '') + (p.stderr ?? '');
  const status =
    p.status !== expected ? 'fail' : allowSkip && output.includes('# SKIP') ? 'skipped' : 'pass';
  logs.push({ label, args, exitCode: p.status, expectedExitCode: expected, status, output });
  console.log(`${label}: ${status} (exit ${p.status}, expected ${expected})`);
  if (status === 'fail') console.log(output);
  return logs.at(-1);
}
run('TypeScript', ['run', 'check']);
run('Unit and HTTP tooling tests', ['test']);
run('Build', ['run', 'build']);
run('Standalone data validation', [
  'run',
  'data:validate',
  '--',
  '--file',
  '../data/demo/batch.json',
]);
run(
  'Mock evaluator with intentional failures',
  ['run', 'eval', '--', '--mock', '--out', '../reports/mock-tooling'],
  1,
);
run(
  'Business evaluation not executed',
  ['run', 'eval', '--', '--out', '../reports/business-not-executed'],
  2,
);
const mock = JSON.parse(await readFile('../reports/mock-tooling.json', 'utf8'));
const pending = JSON.parse(await readFile('../reports/business-not-executed.json', 'utf8'));
assert.equal(mock.mode, 'mock-tooling');
assert.equal(mock.results.length, 13);
assert.deepEqual(
  mock.results.filter((r) => r.checks.some((c) => c.status === 'fail')).map((r) => r.id),
  ['DEMO_E11', 'DEMO_E12', 'DEMO_E13'],
);
assert.equal(pending.mode, 'not-executed');
assert.ok(pending.results.every((r) => r.checks.every((c) => c.status === 'not_executed')));
await writeFile(
  '../eval/demo/actual.mock.json',
  JSON.stringify(
    {
      provenance: 'mock-tooling',
      outputs: Object.fromEntries(
        mock.results.filter((r) => r.actual !== null).map((r) => [r.id, r.actual]),
      ),
    },
    null,
    2,
  ) + '\n',
);
run(
  'Offline evaluation of actual mock responses',
  [
    'run',
    'eval',
    '--',
    '--results',
    '../eval/demo/actual.mock.json',
    '--out',
    '../reports/offline-mock-tooling',
  ],
  1,
);
const last = run(
  'MySQL integration test (may skip without DB_TEST_NAME)',
  ['run', 'test:db'],
  0,
  true,
);
run('Dependency audit', ['audit', '--json', '--cache', '../.npm-cache']);
const tools = Object.fromEntries(
  ['docker', 'mysql'].map((command) => {
    const candidates =
      command === 'mysql' && process.platform === 'win32'
        ? [command, 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe']
        : [command];
    let p;
    for (const candidate of candidates) {
      p = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 5000 });
      if (p.status === 0) break;
    }
    return [
      command,
      { available: p.status === 0, version: p.status === 0 ? p.stdout.trim() : null },
    ];
  }),
);
await mkdir('../reports', { recursive: true });
const report = {
  date: new Date().toISOString(),
  node: process.version,
  checks: logs,
  tools,
  limitations: [
    ...(last.status === 'skipped'
      ? ['Database integration skipped: DB_TEST_NAME not configured']
      : []),
    'Docker compose/image runtime is outside this verification script',
    'Business HTTP evaluation and OCR evaluation are outside this tooling self-check',
    'Huawei cloud deployment is outside this verification script',
  ],
};
await writeFile('../reports/verification.json', JSON.stringify(report, null, 2) + '\n');
await writeFile(
  '../reports/verification.txt',
  logs.map((l) => `${l.label}: ${l.status}\n${l.output}`).join('\n') + '\n',
);
if (logs.some((l) => l.status === 'fail')) process.exitCode = 1;
