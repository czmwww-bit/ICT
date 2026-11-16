// 公开官方资料取证：只归档，不连接资料库。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const modules = new URL(
  "../../../../reports/local/source-tools/node_modules/",
  import.meta.url,
);
const cheerio = await import(new URL("cheerio/dist/esm/index.js", modules));
await mkdir(new URL("sources/", root), { recursive: true });
const list = [
  ["A1", 1, "https://longyang.gov.cn/info/4225/6273009.htm"],
  ["A2", 2, "https://www.longyang.gov.cn/info/27605/13673399.htm"],
  ["A3", 3, "https://www.hhgj.gov.cn/info/13101/546351.htm"],
  ["A4", 4, "https://www.longyang.gov.cn/info/4580/14016319.htm"],
  ["A5", 5, "https://www.longyang.gov.cn/info/4285/13576989.htm"],
  ["B6-pdf", 6, "https://ynmz.yn.gov.cn/uploads/downfile/169811076519676.pdf"],
  ["B6-web", 6, "https://shidian.gov.cn/info/4123/3441703.htm"],
  ["B7", 7, "https://www.longyang.gov.cn/info/4263/13685269.htm"],
  [
    "B8-province",
    8,
    "https://ynmz.yn.gov.cn/zwgk/zcwj/qtzcwj/202604/t20260414_3820299.html",
  ],
  ["B8-reprint", 8, "https://cxshb.gov.cn/info/27157/607032.htm"],
  ["C9", 9, "https://app.www.gov.cn/govdata/gov/202507/23/533344/article.html"],
  [
    "C10",
    10,
    "https://www.bypc.gov.cn/zfxxgk/bmdwxzjd/xzjd/zzljdbsc/fdzdgknr/ylfw/art/2026/art_538e0b3d98f9454d884ec276e45858a7.html",
  ],
  ["C11", 11, "https://ynmz.yn.gov.cn/cms/qitazhengcewenjian/11991.html"],
  ["C12", 12, "https://longyang.gov.cn/info/4077/14132879.htm"],
  ["C13", 13, "https://www.longyang.gov.cn/info/3485/14111319.htm"],
];
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function save(file, bytes) {
  try {
    const old = await readFile(new URL(file, root));
    if (hash(old) !== hash(bytes))
      throw new Error("已有快照不同，拒绝覆盖：" + file);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await writeFile(new URL(file, root), bytes, { flag: "wx" });
  }
}
async function get(id, url, referer) {
  const record = {
    id,
    url,
    retrievedAt: new Date().toISOString(),
    retrievedDate: "2026-11-16",
    status: "failed",
  };
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        ...(referer ? { Referer: referer } : {}),
      },
      signal: AbortSignal.timeout(25000),
    });
    record.httpStatus = response.status;
    record.finalUrl = response.url;
    record.contentType = response.headers.get("content-type");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error("HTTP " + response.status);
    const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
    record.file = `sources/${id}.${pdf ? "pdf" : "html"}`;
    record.bytes = bytes.length;
    record.sha256 = hash(bytes);
    await save(record.file, bytes);
    record.status = "retrieved";
    record.format = pdf ? "pdf" : "html";
    if (!pdf) {
      const $ = cheerio.load(bytes.toString("utf8"));
      record.title =
        $('meta[name="ArticleTitle"]').attr("content") ||
        $("title").text().trim();
      record.attachments = [
        ...new Set(
          $("a[href]")
            .toArray()
            .map((a) => ({ href: $(a).attr("href"), text: $(a).text() }))
            .filter(
              (a) =>
                /\.pdf|virtual_attach_file|_download|downfile/i.test(a.href) ||
                /\.pdf/i.test(a.text),
            )
            .map((a) => new URL(a.href.replaceAll("&amp;", "&"), url).href),
        ),
      ];
    }
  } catch (e) {
    record.error = e.message;
    record.cause = e.cause?.code ?? null;
  }
  return record;
}
const old = JSON.parse(
  await readFile(
    new URL("../../longyang-allowance/retrieval.direct.json", import.meta.url),
    "utf8",
  ),
);
const mapping = {
  A1: "longyang-2021",
  A3: "gejiu-attachment-page",
  A4: "longyang-2025",
};
const results = await Promise.all(
  list.map(async ([id, item, url]) => {
    let r;
    if (mapping[id]) {
      const source = old.sources.find((s) => s.id === mapping[id]);
      const file = `../longyang-allowance/sources/${mapping[id]}.html`;
      r = { ...source, id, item, file, reusedSnapshot: true, format: "html" };
    } else r = { ...(await get(id, url)), item };
    console.log(
      JSON.stringify({
        id,
        status: r.status,
        http: r.httpStatus,
        bytes: r.bytes,
        attachments: r.attachments,
      }),
    );
    return r;
  }),
);
const attachments = [];
for (const r of results.filter((r) => r.attachments?.length)) {
  for (const [i, url] of r.attachments.entries()) {
    if (r.id === "A3") {
      const oldPdf = JSON.parse(
        await readFile(
          new URL(
            "../../longyang-allowance/retrieval.attachment.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      attachments.push({
        ...oldPdf,
        id: "A3-attachment-1",
        item: 3,
        file: "../longyang-allowance/sources/yn-notice-2024-113.pdf",
        format: "pdf",
        reusedSnapshot: true,
      });
      continue;
    }
    const a = {
      ...(await get(`${r.id}-attachment-${i + 1}`, url, r.url)),
      item: r.item,
      parentId: r.id,
    };
    attachments.push(a);
    console.log(
      JSON.stringify({
        attachment: a.id,
        status: a.status,
        http: a.httpStatus,
        bytes: a.bytes,
        format: a.format,
      }),
    );
  }
}
await writeFile(
  new URL("acquisition.json", root),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      date: "2026-11-16",
      sources: results,
      attachments,
    },
    null,
    2,
  ) + "\n",
);
