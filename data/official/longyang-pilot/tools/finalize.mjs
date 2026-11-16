// 首次整理后的核对索引补充；不触碰数据库，后续人工编辑请直接维护核对文件。
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url),
  read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const save = async (p, v) =>
  writeFile(
    new URL(p, root),
    typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n",
  );
const sha = (b) => createHash("sha256").update(b).digest("hex");
const b = await read("batch.draft.json");
b.documents.find((d) => d.id === "CN_CONSUMPTION_2025_37").title =
  "民政部 财政部关于实施向中度以上失能老年人发放养老服务消费补贴项目的通知";
await save("batch.draft.json", b);
const metadata = await read("document-metadata.json");
metadata.find((d) => d.documentId === "YN_CONSUMPTION_2026_4").webPublisher =
  "红河州民政局";
await save("document-metadata.json", metadata);
const cheerio = await import(
  new URL(
    "../../../../reports/local/source-tools/node_modules/cheerio/dist/esm/index.js",
    import.meta.url,
  )
);
const $ = cheerio.load(
  await readFile(new URL("sources/FOLLOWUP_BS_202608.html", root), "utf8"),
);
const rows = $("table tr")
  .toArray()
  .map((tr) =>
    $(tr)
      .children("td,th")
      .toArray()
      .map((td) => $(td).text().replace(/\s+/g, " ").trim()),
  );
const row = rows.find((r) => r[0] === "隆阳区");
if (!row || !row.includes("1000"))
  throw new Error("统计表隆阳行或1000列缺失，须人工核对");
await save("sources/FOLLOWUP_BS_202608.table.json", {
  title: "保山市2026年8月高龄津贴发放情况统计表",
  sourceUrl: "https://www.baoshan.gov.cn/info/6126/10396644.htm",
  webPublisher: "保山市民政局",
  webPublishedAt: "2026-09-03",
  reportingMonth: "2026-08",
  rows: rows.filter(
    (r) =>
      r.includes("隆阳区") ||
      r.some((x) => x.includes("发放标准") || x.includes("100周岁")),
  ),
  longyangRow: row,
  interpretation:
    "仅作为当月统计观察及后续调整线索，不是地方规范文件，不据此直接填写现行金额或调整日期",
});
const conflicts = await read("conflicts.json");
const id = "CONFLICT_LOCAL_2026_STAT";
if (!conflicts.some((c) => c.id === id))
  conflicts.push({
    id,
    title: "2026统计1000与旧地方网页350的差异",
    matter: "高龄津贴",
    status: "pending_human_review",
    question:
      "省级300、旧地方网页350、2026年8月统计1000分别保留；补发放标准调整原文件和施行日期，不直接选数。",
    evidence: [
      {
        clauseId: "LY_GLT_WADU_2025_LOCAL_RATES",
        quote: b.clauses.find((c) => c.id === "LY_GLT_WADU_2025_LOCAL_RATES")
          .quote,
      },
      {
        sourceCarrierId: "FOLLOWUP_BS_202608",
        tableRow: row,
        locator: "发放情况统计表表头与隆阳区行，100周岁以上标准列",
        url: "https://www.baoshan.gov.cn/info/6126/10396644.htm",
      },
    ],
  });
await save("conflicts.json", conflicts);
for (const file of ["CONFLICTS.md", "REVIEW_CHECKLIST.md"]) {
  let text = await readFile(new URL(file, root), "utf8");
  if (!text.includes("CONFLICT_LOCAL_2026_STAT"))
    text +=
      "\n## CONFLICT_LOCAL_2026_STAT｜优先核对地方金额\n\n[保山市2026年8月官方统计](https://www.baoshan.gov.cn/info/6126/10396644.htm)隆阳行的100周岁以上标准列为1000，与2023/2025网页350不同。原HTML、提取正文及table.json已归档；统计表不当成规范性调整文件，需补原调整文件及施行日期。不要直接认定隆阳当前实发350、1000或省级300。\n";
  await save(file, text);
}
const groups = new Map();
for (const c of b.clauses) {
  const key = c.quote.replace(/\s+/g, "");
  groups.set(key, [...(groups.get(key) ?? []), c.id]);
}
const duplicateQuotes = [...groups.values()].filter((g) => g.length > 1);
const acq = await read("acquisition.json"),
  artifacts = [];
for (const r of [
  ...acq.sources,
  ...acq.attachments,
  ...(acq.supplements ?? []),
].filter((r) => r.status === "retrieved")) {
  const bytes = await readFile(new URL(r.file, root));
  if (sha(bytes) !== r.sha256) throw new Error("原件校验值不一致：" + r.id);
  artifacts.push({
    id: r.id,
    path: r.file,
    bytes: bytes.length,
    sha256: sha(bytes),
  });
}
const left = (await read("sources/B8-province.extracted.json")).paragraphs
  .join("")
  .replace(/\s+/g, "");
const right = (await read("sources/B8-reprint.extracted.json")).paragraphs
  .join("")
  .replace(/\s+/g, "");
await save("artifact-checksums.json", {
  checkedAt: new Date().toISOString(),
  artifacts,
  batchSha256: sha(await readFile(new URL("batch.draft.json", root))),
  oneServiceCarrierTextSameIgnoringWhitespace: left === right,
  duplicateQuoteGroups: duplicateQuotes,
  duplicateQuoteExplanation:
    "同一段可拆不同主题（如户籍确认/迁移、两个事项共用职责）并完整保留上下文；不是重复政策文件，待人工逐组确认",
});
console.log(
  JSON.stringify({
    documents: b.documents.length,
    clauses: b.clauses.length,
    rawArtifactsVerified: artifacts.length,
    duplicateQuoteGroups: duplicateQuotes.length,
    oneServiceTextSameIgnoringWhitespace: left === right,
    longyangStatRow: row,
  }),
);
