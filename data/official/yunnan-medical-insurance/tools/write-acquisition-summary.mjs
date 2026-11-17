// 从实际采集记录生成目录；不改来源原件或政策数据。
import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  a = JSON.parse(await readFile(new URL("acquisition.json", root), "utf8"));
let md =
  "# 官方资料实际获取记录\n\n采集日期：2026-11-17。HTTP原件获取、文字提取和人工审核是不同状态。省医保局部分旧PHP链接404，已从新站官方栏目发现并归档本批新地址；不把搜索缓存当作原文。\n\n|载体|文件/主题|网页日期|正文状态|素材数|官网链接|\n|---|---|---|---|---|---|\n";
for (const s of a.records) {
  let status =
    s.status === "partial"
      ? "原图已取得，未自动提取完整文字"
      : s.status === "retrieved"
        ? "正文已提取，待人工核对"
        : "获取/解析失败";
  if (["YB07", "YB08"].includes(s.id)) status += "；另存选录视觉转写";
  if (s.id === "YB21") status += "；旧年度仅归档，不入主批次";
  md +=
    "|" +
    [
      s.id,
      s.title,
      s.pagePublishedAt ?? "未知",
      status,
      s.assets.filter((x) => x.status === "retrieved").length,
      "[来源](" + s.url + ")",
    ].join("|") +
    "|\n";
}
md +=
  "\n21份原始HTML及59份素材哈希实际匹配，其中39份为正文图片/附件，20份为页面图标，不当政策证据。49份官方栏目索引另在sources/indexes，只用于发现新地址，不当政策全文。\n\nYB02首次选择器未命中，原HTML保存后已用#content-txt-1修正并取得32段正文/7图；初次失败仍记在extractionAttempts。YB07/YB08为图片通知，文字选录由助手看原图后转写，金额/日期/按钮必须再人工复核。YB18官方docx/xlsx已取得，Word只读提取7500段，未渲染页面/表格。\n\n用户5张截图在聊天内，仅保存观察记录，未取得原始图片文件路径，不冒充官方原件。语音和智能问答未实际体验。\n\n获取日志：acquisition.json；日期/机关/缺口：document-metadata.json；图像转写：image-review.json；技术核对：verification.json。\n";
await writeFile(new URL("ACQUISITION.md", root), md);
console.log(
  JSON.stringify({
    written: "ACQUISITION.md",
    sourceRows: a.records.length,
    encoding: "UTF-8",
  }),
);
