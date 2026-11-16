// 复用既有HTTP/离线评测器；未设置EVAL_URL则报告未执行并保留退出码2。
import { spawnSync } from 'node:child_process';
const args = [
  '--import',
  'tsx',
  'src/evaluate.ts',
  '--cases',
  '../eval/real/longyang-boundaries.cases.json',
  '--catalog',
  '../data/official/longyang-pilot/batch.draft.json',
  '--out',
  '../reports/longyang-boundaries-business',
  ...process.argv.slice(2),
];
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env },
  windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
