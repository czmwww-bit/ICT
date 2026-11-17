// backend目录运行。业务接口未接入时显式留空目标，记录未执行，不发送用户信息。
import { spawnSync } from "node:child_process";
import { writeFile, readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  checks = [];
const unit = spawnSync(
  process.execPath,
  ["node_modules/tsx/dist/cli.mjs", "--test", "test/*.test.ts"],
  { encoding: "utf8", windowsHide: true },
);
checks.push({
  name: "existing_unit_and_http_tests",
  exitCode: unit.status,
  passed: unit.status === 0,
  stdout: unit.stdout,
  stderr: unit.stderr,
});
const args = [
  "--import",
  "tsx",
  "src/evaluate.ts",
  "--cases",
  "../eval/real/yunnan-medical-development.cases.json",
  "--catalog",
  "../data/official/yunnan-medical-insurance/batch.draft.json",
  "--out",
  "../data/official/yunnan-medical-insurance/business-evaluation-not-executed",
];
const business = spawnSync(process.execPath, args, {
  encoding: "utf8",
  windowsHide: true,
  env: { ...process.env, EVAL_URL: "" },
});
checks.push({
  name: "business_endpoint_not_connected",
  exitCode: business.status,
  expectedExitCode: 2,
  passed: business.status === 2,
  stdout: business.stdout,
  stderr: business.stderr,
});
const report = {
  executedAt: new Date().toISOString(),
  node: process.version,
  passed: checks.every((c) => c.passed),
  checks,
  scope:
    "工具检查通过不表示业务答案准确率；业务目标留空，指南语义和原小程序体验仍待人工核对",
};
await writeFile(
  new URL("technical-checks.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      passed: report.passed,
      unitTests: unit.stdout?.match(/tests\s+(\d+)/)?.[1],
      businessNativeExit: business.status,
      business: business.stdout ? JSON.parse(business.stdout) : null,
    },
    null,
    2,
  ),
);
if (!report.passed) process.exitCode = 1;
