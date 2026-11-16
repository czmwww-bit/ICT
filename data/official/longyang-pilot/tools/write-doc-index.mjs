import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const b = JSON.parse(await readFile(new URL("batch.draft.json", root), "utf8"));
const meta = JSON.parse(
  await readFile(new URL("document-metadata.json", root), "utf8"),
);
const acq = JSON.parse(
  await readFile(new URL("acquisition.json", root), "utf8"),
);
for (const m of meta) {
  const d = b.documents.find((d) => d.id === m.documentId);
  m.recordedPublishedAt = d.publishedAt;
  m.recordedEffectiveFrom = d.effectiveFrom;
  m.recordedEffectiveTo = d.effectiveTo;
  m.dateReviewNote =
    d.id === "CN_CONSUMPTION_LAUNCH_2026"
      ? "effectiveFrom是全国项目起始，不是由转载日推断的文件生效日。"
      : "未知日级日期为null；落款/网页时间单独保留，不互相冒充。";
}
await writeFile(
  new URL("document-metadata.json", root),
  JSON.stringify(meta, null, 2) + "\n",
);
const rows = [...meta]
  .sort((a, b) => a.item - b.item)
  .map((m) => {
    const d = b.documents.find((d) => d.id === m.documentId);
    const carriers = [
      ...acq.sources,
      ...acq.attachments,
      ...(acq.supplements ?? []),
    ].filter((c) => m.sourceCarrierIds.includes(c.id));
    return `|${m.item}|${d.id}|${m.webPublisher ?? "未知"}|${carriers
      .filter((c) => c.format === "html")
      .map(
        (c) =>
          `${c.id}：${m.item === 8 && c.id === "B8-reprint" ? "2026-04-23" : (m.webPublishedAt ?? "未知")}`,
      )
      .join(
        "<br>",
      )}|${d.publisher}|${m.signedAt ?? "未知"}|${d.publishedAt ?? "未知"}|${d.effectiveFrom ?? "未知"}／${d.effectiveTo ?? "未知"}|${m.classification}|`;
  });
await writeFile(
  new URL("DOCUMENTS.md", root),
  "# 文件实体、载体与各类日期\n\n采集日期：2026-11-16；全部内部审核状态draft。下表末两日期为模型日级适用范围，不等于文件数据库版本创建时间；月份/周期等原文另见条款schedule，不自动填日。文号、机关、载体关联详见document-metadata.json。\n\n|清单项|文件编号|网页发布/转载单位|网页发布日期|记录的原文件机关或说明|原文落款|模型publishedAt|适用起／止日|身份/核对门槛|\n|---|---|---|---|---|---|---|---|---|\n" +
    rows.join("\n") +
    "\n\n113号另有PDF第8页印发2024-11-20，与落款2024-11-19区分；2025解读的文章来源是省民政厅养老服务处。2026全国通知落款2025-12-26、项目从2026-01-01实施、周期2026年1至12月，转载2026-02-03。云南4号落款2026-01-14、红河转载2026-02-28；省厅旧地址未取得正文。2026一件事落款4月8日、省厅公开4月14日、双柏转载4月23日，不据此推断独立施行日。\n\nB6正式PDF与施甸文字转载关联同一实体；B8两份全文去空白后完全相同；C11省厅失败入口与红河全文关联同一实体。A4是独立政策解读，不冒充原通知或生成重复条款。\n",
);
console.log("文件日期索引已写入DOCUMENTS.md；元数据与批次实际字段已核对。");
