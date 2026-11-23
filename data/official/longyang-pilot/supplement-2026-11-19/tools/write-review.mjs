import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const read = async (f) => JSON.parse(await readFile(new URL(f, root), "utf8"));
const batch = await read("batch.draft.json"),
  meta = await read("document-metadata.json"),
  acquisition = await read("acquisition.json");
const originals = await read("../review-items.json"),
  newReviews = await read("review-items.json");
const refs = [
  ...originals.filter((r) => batch.clauses.some((c) => c.id === r.clauseId)),
  ...newReviews,
];
const sources = meta.map((m) => ({
  id: m.sourceId,
  documentId: m.documentId,
  url: m.acquisition.url,
  format: "html",
  selector:
    m.sourceId === "LY-MZ-CONTACT" ? "#vsb_content_4" : m.acquisition.selector,
  baseline: { file: m.acquisition.rawFile },
  declaredEffectiveFrom: m.policyEffectiveFrom ?? null,
}));
await writeFile(
  new URL("source-registry.json", root),
  JSON.stringify({ schemaVersion: 1, sources }, null, 2) + "\n",
);
const sections = batch.clauses.map((c) => {
  const doc = batch.documents.find((d) => d.id === c.documentId),
    review = refs.find((r) => r.clauseId === c.id);
  return `## ${c.id}@${c.version}\n\n文件：${doc.id}@${doc.version}；${doc.publisher}；[${doc.title}](${doc.sourceUrl})\n\n事项：${c.matterId}；地区：${c.regionCodes.join("、")}；网页公开：${doc.publishedAt ?? "未知"}；政策生效：${c.effectiveFrom ?? "未知"}。\n\n位置：${c.locator}\n\n整理结果：\n\n\`\`\`json\n${JSON.stringify(c.paymentRecord ?? { actions: c.actions, contacts: c.contacts }, null, 2)}\n\`\`\`\n\n原文：\n\n${c.quote
    .split("\n")
    .map((s) => (s ? "> " + s.trimEnd() : ">"))
    .join(
      "\n",
    )}\n\n待确认：${review?.question ?? "继承原待审核问题，须对照主核对表。"}\n\n核对状态：待审核；核对人：待填；日期：待填；结论：待填。\n`;
});
await writeFile(
  new URL("REVIEW_CHECKLIST.md", root),
  "# 金额、流程与优待凭证人工核对表\n\n11文件20条款含复用3文件7条款；新增8文件13条款。全部待审核，未向项目库导入/发布。先看README中的金额与冲突总览，再逐条对照。\n\n" +
    sections.join("\n"),
);
const acquisitionRows = acquisition.records.map(
  (r) =>
    `|${r.id}|${r.status}|${r.httpStatus ?? "未知"}|${r.webPublishedAt ?? "未知"}|[来源](${r.url})|`,
);
await writeFile(
  new URL("ACQUISITION.md", root),
  "# 实际获取结果\n\n原件HTML、获取时刻、SHA256、正文选择器和合并单元格记录见acquisition.json。正文提取曾因选择器失配失败，修正后8份全文可读；原件字节未改，解析过程保留在extractionAttempts。保山Excel转HTML尾部空单元格在派生文本中裁掉，原表单元格含rowspan/colspan保留。机构页合并了多个正文栏，不能只采第一栏总机。\n\n|来源编号|实际状态|HTTP|网页公开时间|地址|\n|---|---|---|---|---|\n" +
    acquisitionRows.join("\n") +
    "\n\n省厅优待证旧地址实际返回404；红河州官方全文转载已取得。省厅政策目录入口返回meta Refresh跳转壳，未当作完整目录。公开搜索只用于发现来源，未将搜索摘要装作下载原文。\n",
);
await writeFile(
  new URL("research-log.json", root),
  JSON.stringify(
    {
      searchedOn: "2026-11-19",
      scope: "有限关键词检索及已列来源下载；不是全网/全省文件有效性审计",
      queries: [
        'site.ynmz.yn.gov.cn "经济困难老年人服务补贴实施办法" "2026" "印发"',
        'site.ynmz.yn.gov.cn "经济困难老年人服务补贴实施办法" "征求意见"',
        'site.longyang.gov.cn "长寿补助" "1000" "提标"',
        'site.baoshan.gov.cn "隆阳" "长寿补助" "提标"',
      ],
      findings: [
        {
          topic: "地方提标",
          result:
            "取得按月统计及二季度备注，尚未取得直接规定隆阳提标生效日期与补差规则的正式调整文件",
          status: "needs_review",
        },
        {
          topic: "经济困难办法接续",
          result:
            "取得既有2026年4月8日一件事通知与公开统计；本次仍未取得9月征求意见后的正式修订文本，不断言不存在、不推断取消或自动续期",
          status: "needs_review",
        },
        {
          topic: "优待凭证",
          originalUrl:
            "https://ynmz.yn.gov.cn/cms/qitazhengcewenjian/11904.html",
          originalLiveStatus: "HTTP 404",
          officialReprint: meta.find(
            (m) => m.documentId === "YN_ELDER_ID_REPLACES_CARD_2025_5",
          ).acquisition.url,
          result:
            "转载全文明确2026-01-01施行、新办换发补办停止、原证可继续使用，仍待人工审核；无旧文条款实体时不制造关系指向",
        },
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    reviewClauses: sections.length,
    registeredSources: sources.length,
    acquisitionRecords: acquisition.records.length,
  }),
);
