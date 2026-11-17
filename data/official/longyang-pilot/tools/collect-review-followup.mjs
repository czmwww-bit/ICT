// 接续归档用户核对线索；不改旧快照、不连接资料库、不执行审核发布。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "../../../../backend/node_modules/cheerio/dist/esm/index.js";
const root = new URL("../review-followup-2026-11-17/", import.meta.url);
await mkdir(new URL("sources/", root), { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function save(file, bytes) {
  const url = new URL(file, root);
  try {
    const old = await readFile(url);
    if (hash(old) !== hash(bytes))
      throw Error("拒绝覆盖不同的已归档快照：" + file);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await writeFile(url, bytes, { flag: "wx" });
  }
}
async function get(id, url, extension = "html", referer) {
  const record = {
    id,
    url,
    retrievedAt: new Date().toISOString(),
    retrievedDate: "2026-11-17",
    status: "failed",
  };
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "SilverEvidenceReview/0.1",
        ...(referer ? { Referer: referer } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    record.httpStatus = r.status;
    record.finalUrl = r.url;
    record.contentType = r.headers.get("content-type");
    if (!r.ok) throw Error("HTTP " + r.status);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (
      extension === "doc" &&
      !bytes
        .subarray(0, 8)
        .equals(
          Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        ) &&
      !bytes.subarray(0, 2).equals(Buffer.from("PK"))
    )
      throw Error("下载结果不是Word原件");
    record.file = "sources/" + id + "." + extension;
    record.bytes = bytes.length;
    record.sha256 = hash(bytes);
    record.status = "retrieved";
    await save(record.file, bytes);
    return { record, bytes };
  } catch (e) {
    record.error = e.message;
    return { record };
  }
}
const sourceList = [
  ["C11-honghe-review", "https://www.hh.gov.cn/info/29601/1243252.htm"],
  [
    "C11-province-recheck",
    "https://ynmz.yn.gov.cn/cms/qitazhengcewenjian/11991.html",
  ],
  [
    "B6-pdf-recheck",
    "https://ynmz.yn.gov.cn/uploads/downfile/169811076519676.pdf",
    "pdf",
  ],
  ["BS-202601", "https://www.baoshan.gov.cn/info/6126/10335854.htm"],
  ["BS-202602", "https://baoshan.gov.cn/info/6126/10352984.htm"],
  ["BS-202608", "https://www.baoshan.gov.cn/info/6126/10396644.htm"],
  ["B6-shidian-review", "https://www.shidian.gov.cn/info/4123/3441703.htm"],
];
const sources = [],
  attachments = [];
for (const [id, url, extension] of sourceList) {
  const { record, bytes } = await get(id, url, extension);
  sources.push(record);
  if (!bytes || extension === "pdf") continue;
  const $ = load(bytes.toString("utf8"));
  const node = $('[id^="vsb_content_"]').first();
  const body = node.length ? node : $(".v_news_content").first();
  record.title =
    $('meta[name="ArticleTitle"]').attr("content") || $("title").text().trim();
  record.pagePublishedAt = $('meta[name="PubDate"]').attr("content") ?? null;
  record.bodySelector = node.length
    ? '[id^="vsb_content_"]'
    : ".v_news_content";
  if (body.length) {
    body.find("script,style").remove();
    const paragraphs = body
      .find("p,tr")
      .toArray()
      .map((e) => $(e).text().replace(/\s+/g, " ").trim())
      .filter(Boolean);
    await save("sources/" + id + ".txt", paragraphs.join("\n\n") + "\n");
    record.bodyFile = "sources/" + id + ".txt";
    record.bodySha256 = hash(await readFile(new URL(record.bodyFile, root)));
    if (id.startsWith("BS-"))
      record.longyangRows = body
        .find("tr")
        .toArray()
        .map((e) => $(e).text().replace(/\s+/g, " ").trim())
        .filter((t) => t.includes("隆阳"));
  }
  if (id === "C11-honghe-review") {
    const links = $("a[href]")
      .toArray()
      .map((e) => ({
        title: $(e).text().trim(),
        url: new URL($(e).attr("href"), url).href,
        parent: $(e).parent().attr("class") ?? null,
      }))
      .filter(
        (a) => /^[1-7][.．、]/.test(a.title) && /\.docx?$/i.test(a.title),
      );
    record.attachmentLinks = links;
    for (const [index, link] of links.entries()) {
      const result = await get(
        "C11-attachment-" + (index + 1),
        link.url,
        "doc",
        url,
      );
      attachments.push({
        ...result.record,
        title: link.title,
        parentSourceId: id,
        documentId: "YN_CONSUMPTION_2026_4",
        scope: "attachment_pending_review",
        policyReviewed: false,
      });
    }
  }
}
const report = {
  schemaVersion: 1,
  collectedAt: new Date().toISOString(),
  policyReviewed: false,
  imported: false,
  published: false,
  sources,
  attachments,
};
await writeFile(
  new URL("acquisition.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      sources: sources.map(({ id, status, httpStatus, longyangRows }) => ({
        id,
        status,
        httpStatus,
        longyangRows,
      })),
      attachments: attachments.map(({ id, title, status, bytes }) => ({
        id,
        title,
        status,
        bytes,
      })),
    },
    null,
    2,
  ),
);
