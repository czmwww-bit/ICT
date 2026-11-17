// backend目录执行：复用现有CLI和7表摘要，只读dry-run，不执行实际导入/发布。
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pool } from "../../../../backend/dist/src/db.js";
import {
  canonical,
  evidenceDigest,
} from "../../../../backend/dist/src/backup.js";
const root = new URL("../", import.meta.url),
  db = await pool(),
  file = "../data/official/yunnan-medical-insurance/batch.draft.json";
function run(args) {
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", ...args],
    { encoding: "utf8", windowsHide: true, timeout: 30000 },
  );
  return {
    args,
    exitCode: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    error: r.error?.message ?? null,
  };
}
try {
  const before = await evidenceDigest(db),
    validation = run(["validate", "--file", file]),
    dryRun = run(["import", "--file", file, "--dry-run"]),
    after = await evidenceDigest(db),
    passed =
      validation.exitCode === 0 &&
      dryRun.exitCode === 0 &&
      canonical(before) === canonical(after);
  const batch = JSON.parse(
    await readFile(new URL("batch.draft.json", root), "utf8"),
  );
  const report = {
    executedAt: new Date().toISOString(),
    passed,
    documents: batch.documents.length,
    clauses: batch.clauses.length,
    validation,
    dryRun,
    before,
    after,
    databaseUnchanged: canonical(before) === canonical(after),
    imported: false,
    published: false,
    humanPolicyReview: "pending",
  };
  await writeFile(
    new URL("precheck.json", root),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      passed,
      databaseUnchanged: report.databaseUnchanged,
      plan:
        dryRun.exitCode === 0
          ? (({ added, modified, unchanged, errors }) => ({
              added,
              modified,
              unchanged,
              errors,
            }))(JSON.parse(dryRun.stdout))
          : null,
    }),
  );
  if (!passed) process.exitCode = 1;
} finally {
  await db.end();
}
