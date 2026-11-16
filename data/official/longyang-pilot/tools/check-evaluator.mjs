// 验证本批案例可被现有评测器读取；显式留空目标，不向任何真实业务接口请求。
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
const r = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "src/evaluate.ts",
    "--cases",
    "../eval/real/longyang-development.cases.json",
    "--catalog",
    "../data/official/longyang-pilot/batch.draft.json",
    "--out",
    "../reports/longyang-development-not-executed",
  ],
  {
    encoding: "utf8",
    env: { ...process.env, EVAL_URL: "" },
    timeout: 30000,
    windowsHide: true,
  },
);
const report = JSON.parse(
  await readFile("../reports/longyang-development-not-executed.json", "utf8"),
);
const passed =
  r.status === 2 &&
  report.mode === "not-executed" &&
  report.results.length === 18 &&
  report.results.every((c) =>
    c.checks.every((check) => check.status === "not_executed"),
  );
await writeFile(
  "../data/official/longyang-pilot/evaluator-tooling-check.json",
  JSON.stringify(
    {
      executedAt: new Date().toISOString(),
      passed,
      expectedExit: 2,
      actualExit: r.status,
      mode: report.mode,
      groups: report.groups,
      stdout: r.stdout,
      stderr: r.stderr,
      businessEvaluationExecuted: false,
      report: "reports/longyang-development-not-executed.json",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      toolingCheckPassed: passed,
      actualExit: r.status,
      mode: report.mode,
      real: report.groups.real,
      businessEvaluationExecuted: false,
    },
    null,
    2,
  ),
);
if (!passed) process.exitCode = 1;
