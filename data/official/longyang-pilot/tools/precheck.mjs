// 从backend目录运行；只调用validate、import --dry-run以及SELECT。不会执行实际导入/发布。
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
const root = new URL("../", import.meta.url);
const { pool, rows } = await import("../../../../backend/dist/src/db.js");
const db = await pool();
const canonical = (v) =>
  v instanceof Date
    ? JSON.stringify(v.toISOString())
    : Array.isArray(v)
      ? `[${v.map(canonical).join(",")}]`
      : v && typeof v === "object"
        ? `{${Object.entries(v)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
            .join(",")}}`
        : JSON.stringify(v);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const tables = [
  "evidence_migrations",
  "evidence_regions",
  "evidence_versions",
  "evidence_heads",
  "evidence_batches",
  "evidence_publications",
  "evidence_import_lock",
];
async function snapshot() {
  const result = {};
  for (const table of tables) {
    const data = await rows(db, `SELECT * FROM ${table}`);
    result[table] = {
      count: data.length,
      digest: hash(data.map(canonical).sort().join("\n")),
    };
  }
  return result;
}
function run(args) {
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", ...args],
    { encoding: "utf8", timeout: 30000, windowsHide: true },
  );
  return {
    command: `node --import tsx src/cli.ts ${args.join(" ")}`,
    exitCode: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
    error: r.error?.message ?? null,
  };
}
try {
  const before = await snapshot();
  const file = "../data/official/longyang-pilot/batch.draft.json";
  const validation = run(["validate", "--file", file]);
  const dryRun = run(["import", "--file", file, "--dry-run"]);
  const after = await snapshot();
  const unchanged = canonical(before) === canonical(after);
  const batch = JSON.parse(
    await readFile(new URL("batch.draft.json", root), "utf8"),
  );
  const passed =
    validation.exitCode === 0 && dryRun.exitCode === 0 && unchanged;
  const report = {
    executedAt: new Date().toISOString(),
    batchSha256: hash(await readFile(new URL("batch.draft.json", root))),
    documents: batch.documents.length,
    clauses: batch.clauses.length,
    validation,
    dryRun,
    before,
    after,
    databaseUnchanged: unchanged,
    passed,
    humanPolicyReview:
      "完整审核待执行；2026-11-17部分事实反馈见review-followup-2026-11-17/review-receipt.json，技术通过不等于审核发布",
    imported: false,
    published: false,
  };
  await writeFile(
    new URL("precheck.json", root),
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(
    new URL("PRECHECK.md", root),
    `# 首批资料实际预检查\n\n执行时间：${report.executedAt}（UTC）；获取日期按Asia/Shanghai为2026-11-16。\n\n- 文件数：${batch.documents.length}；条款数：${batch.clauses.length}。\n- 独立校验退出码：${validation.exitCode}。\n- 数据库dry-run退出码：${dryRun.exitCode}。\n- 7张表行数及内容摘要前后相同：${unchanged}。\n- 未执行实际导入或发布；本批记录仍只存在于文件。\n- 人工原文、语义、区划及后续变更核对：待执行。\n\n实际dry-run输出：\n\n\`\`\`json\n${dryRun.stdout?.trim()}\n\`\`\`\n\n详细命令、错误流、批次哈希及表摘要见precheck.json。修改JSON后必须重新预检查，旧报告不代表修改后的版本。\n`,
  );
  console.log(
    JSON.stringify(
      {
        passed,
        databaseUnchanged: unchanged,
        validationExit: validation.exitCode,
        dryRunExit: dryRun.exitCode,
        plan: dryRun.stdout ? JSON.parse(dryRun.stdout) : null,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
} finally {
  await db.end();
}
