// 归档官方HTML、正文、正文图片/附件。失败单列；不连接业务库。
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "../../../../backend/node_modules/cheerio/dist/esm/index.js";
const root = new URL("../", import.meta.url),
  base = "https://ylbz.yn.gov.cn/";
try {
  await access(new URL("acquisition.json", root));
  throw Error("本批采集已完成，拒绝覆盖；后续变化请用检查命令另存快照");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await mkdir(new URL("sources/assets/", root), { recursive: true });
const sources = [
  [
    "YB01",
    "YN_YB_LOGIN_FAQ_2026",
    "xwdt/ybyw/202611/t20261117_4384621.html",
    "login_faq",
  ],
  [
    "YB02",
    "YN_YB_APP_GUIDE_2024",
    "https://www.yuxi.gov.cn/yxszfxxgk/bszn/20240902/1558169.html",
    "platform_guide",
  ],
  [
    "YB03",
    "YN_YB_FAMILY_POLICY_2024",
    "zfxxgk/zcwj/qtwj/202409/t20240911_1795837.html",
    "formal_policy",
  ],
  [
    "YB04",
    "YN_YB_FAMILY_EXPLANATION_2024",
    "zfxxgk/fdzdgknr/zcjd/202409/t20240911_1796491.html",
    "policy_explanation",
  ],
  [
    "YB05",
    "YN_YB_ENROLLMENT_POLICY_2024",
    "zfxxgk/zcwj/qtwj/202412/t20241225_1796079.html",
    "formal_policy",
  ],
  [
    "YB06",
    "YN_YB_ENROLLMENT_EXPLANATION_2025",
    "zfxxgk/fdzdgknr/zcjd/202502/t20250208_1796559.html",
    "policy_explanation",
  ],
  [
    "YB07",
    "YN_YB_RESIDENT_PAYMENT_2027",
    "xwdt/ybyw/202610/t20261009_4345107.html",
    "annual_payment_notice",
  ],
  [
    "YB08",
    "YN_YB_RESIDENT_PAYMENT_DIAGRAM_2027",
    "xwdt/ybyw/202610/t20261010_4345108.html",
    "image_guide",
  ],
  [
    "YB09",
    "YN_YB_FAMILY_VS_KINSHIP_2025",
    "xwdt/ybyw/202508/t20250826_1821066.html",
    "concept_guide",
  ],
  [
    "YB10",
    "YN_YB_THREE_ACCOUNTS_2026",
    "xwdt/ybyw/202605/t20260527_3636232.html",
    "concept_guide",
  ],
  [
    "YB11",
    "YN_YB_FAMILY_PAYMENT_FAQ_2025",
    "xwdt/ybyw/202511/t20251104_3636603.html",
    "channel_specific_faq",
  ],
  [
    "YB12",
    "YN_YB_REMOTE_FILING_GUIDE_2026",
    "xwdt/ybyw/202604/t20260407_3636353.html",
    "platform_guide",
  ],
  [
    "YB13",
    "YN_YB_REMOTE_FAQ_2026",
    "xwdt/ybyw/202607/t20260701_3636184.html",
    "policy_faq",
  ],
  [
    "YB14",
    "YN_YB_WALLET_BIND_GUIDE_2026",
    "xwdt/ybyw/202611/t20261104_4380760.html",
    "cross_province_guide",
  ],
  [
    "YB15",
    "YN_YB_WALLET_PAYMENT_GUIDE_2026",
    "xwdt/ybyw/202611/t20261102_4379208.html",
    "cross_province_guide",
  ],
  [
    "YB16",
    "CN_YB_WALLET_QA_2026",
    "https://www.nhsa.gov.cn/art/2026/10/21/art_14_23191.html",
    "national_time_snapshot",
  ],
  [
    "YB17",
    "BS_YB_SERVICE_INTERVIEW_2026",
    "https://baoshan.gov.cn/info/29666/10402284.htm",
    "local_official_interview",
  ],
  [
    "YB18",
    "YN_YB_SERVICE_CATALOG_2026",
    "zfxxgk/zcwj/qtwj/202611/t20261116_4384459.html",
    "official_service_catalog",
  ],
  [
    "YB19",
    "YN_YB_ANNUAL_BILL_2025",
    "xwdt/ybyw/202601/t20260107_3636533.html",
    "year_specific_guide",
  ],
  [
    "YB20",
    "YN_YB_ELDERLY_SUPPORT_2025",
    "xwdt/ybyw/202512/t20251222_3636547.html",
    "official_service_description",
  ],
  [
    "YB21",
    "YN_YB_PAYMENT_GUIDE_2026",
    "xwdt/ybyw/202510/t20251011_1821218.html",
    "previous_benefit_year_guide",
  ],
];
const hash = (b) => createHash("sha256").update(b).digest("hex");
async function save(file, bytes) {
  try {
    const old = await readFile(new URL(file, root));
    if (hash(old) !== hash(bytes))
      throw Error("归档已存在且内容不同，不覆盖：" + file);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await writeFile(new URL(file, root), bytes, { flag: "wx" });
  }
}
async function download(url, referer) {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 SilverEvidenceResearch/0.1",
      ...(referer ? { Referer: referer } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok)
    throw Object.assign(Error("HTTP " + r.status), { httpStatus: r.status });
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > 20 * 1024 * 1024)
    throw Error("超过20MiB，仅记录待人工获取");
  return {
    bytes,
    contentType: r.headers.get("content-type"),
    finalUrl: r.url,
    httpStatus: r.status,
  };
}
const records = [];
async function work([id, documentId, path, classification]) {
  const url = new URL(path, base).href,
    record = {
      id,
      documentId,
      url,
      classification,
      retrievedAt: new Date().toISOString(),
      retrievedDate: "2026-11-17",
      status: "failed",
      policyReviewed: false,
      assets: [],
    };
  try {
    const r = await download(url);
    Object.assign(record, {
      httpStatus: r.httpStatus,
      contentType: r.contentType,
      finalUrl: r.finalUrl,
      file: "sources/" + id + ".html",
      bytes: r.bytes.length,
      sha256: hash(r.bytes),
    });
    await save(record.file, r.bytes);
    const $ = load(r.bytes.toString("utf8"));
    const fields = Object.fromEntries(
      $("meta[name]")
        .toArray()
        .map((e) => [$(e).attr("name"), $(e).attr("content") ?? ""]),
    );
    record.title = (
      fields.ArticleTitle ||
      $("h1").first().text() ||
      $("title").text()
    )
      .replace(/\s+/g, " ")
      .trim();
    record.pagePublishedAt = fields.PubDate ?? null;
    record.contentSource = fields.ContentSource ?? null;
    const selectors = [
      ".acticle-content .TRS_Editor",
      ".acticle-content .Custom_UnionStyle",
      ".acticle-content",
      "#zoom",
      "#vsb_content",
      '[id^="vsb_content_"]',
      ".v_news_content",
      ".TRS_Editor",
    ];
    record.selector = selectors.find((k) => $(k).length) ?? null;
    if (!record.selector) throw Error("正文选择器未命中，原始HTML已归档");
    const node = $(record.selector).first().clone();
    node
      .find("script,style,noscript,.attachment,.article-files,.qrcode,.share")
      .remove();
    const paragraphs = node
      .find("p,h1,h2,h3,li,tr")
      .toArray()
      .filter((e) => !$(e).parentsUntil(record.selector).is("p,li,tr"))
      .map((e) => $(e).text().replace(/\s+/g, " ").trim())
      .filter((t) => t && !/^(附件下载|扫一扫在手机打开当前页)$/.test(t));
    record.textStatus = paragraphs.length
      ? "extracted_pending_human_review"
      : "image_or_attachment_only";
    record.textFile = "sources/" + id + ".txt";
    const text = paragraphs.join("\n\n") + "\n";
    await save(record.textFile, Buffer.from(text));
    record.textSha256 = hash(text);
    const images = node
      .find("img")
      .toArray()
      .map((e) => $(e).attr("src") || $(e).attr("data-src"))
      .filter(Boolean)
      .map((p) => new URL(p, url).href)
      .filter((u) => !u.startsWith("data:"));
    const attachments = $(
      ".acticle-content a[href],.download a[href],.attachment a[href],#vsb_content a[href]",
    )
      .toArray()
      .map((e) => ({ href: $(e).attr("href"), title: $(e).text().trim() }))
      .filter((a) =>
        /\.(pdf|docx?|xlsx?|zip)(?:$|[?#])|virtual_attach_file/i.test(a.href),
      )
      .map((a) => ({ url: new URL(a.href, url).href, title: a.title }));
    const assets = [...new Set(images)]
      .map((url) => ({ url, kind: "image" }))
      .concat(attachments.map((a) => ({ ...a, kind: "attachment" })));
    for (const [i, a] of assets.entries()) {
      const asset = {
        ...a,
        retrievedAt: new Date().toISOString(),
        status: "failed",
      };
      try {
        const result = await download(a.url, url);
        const b = result.bytes;
        let ext =
          b.subarray(0, 5).toString() === "%PDF-"
            ? "pdf"
            : b
                  .subarray(0, 8)
                  .equals(
                    Buffer.from([
                      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
                    ]),
                  )
              ? "doc"
              : b.subarray(0, 2).toString() === "PK"
                ? "zip"
                : b[0] === 0x89 && b[1] === 0x50
                  ? "png"
                  : b[0] === 0xff && b[1] === 0xd8
                    ? "jpg"
                    : b.subarray(0, 3).toString() === "GIF"
                      ? "gif"
                      : null;
        if (!ext) throw Error("载体不是支持的原件格式，未把错误页当附件");
        asset.file =
          "sources/assets/" +
          id +
          "-" +
          String(i + 1).padStart(2, "0") +
          "." +
          ext;
        asset.sha256 = hash(b);
        asset.bytes = b.length;
        asset.contentType = result.contentType;
        await save(asset.file, b);
        asset.status = "retrieved";
      } catch (e) {
        asset.error = e.message;
      }
      record.assets.push(asset);
    }
    await save(
      "sources/" + id + ".extracted.json",
      Buffer.from(
        JSON.stringify(
          {
            id,
            sourceUrl: url,
            title: record.title,
            fields,
            selector: record.selector,
            paragraphs,
            assets: record.assets,
          },
          null,
          2,
        ) + "\n",
      ),
    );
    record.status = paragraphs.length ? "retrieved" : "partial";
  } catch (e) {
    record.error = e.message;
    record.httpStatus ??= e.httpStatus;
  }
  records.push(record);
}
let next = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (next < sources.length) await work(sources[next++]);
  }),
);
records.sort((a, b) => a.id.localeCompare(b.id));
const legacy = [];
for (const id of [4698, 6131, 5710]) {
  const url = "https://ylbz.yn.gov.cn/index.php?c=show&id=" + id;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    legacy.push({
      url,
      httpStatus: r.status,
      checkedAt: new Date().toISOString(),
      note: "旧址状态，不作为新文件或政策失效依据",
    });
  } catch (e) {
    legacy.push({ url, error: e.message });
  }
}
const report = {
  collectedAt: new Date().toISOString(),
  date: "2026-11-17",
  scope: "云南医保老人常用功能；原文与UI截图观察分开",
  policyReviewed: false,
  imported: false,
  published: false,
  records,
  legacy,
};
await writeFile(
  new URL("acquisition.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      records: records.map(
        ({ id, title, status, textStatus, error, assets }) => ({
          id,
          title,
          status,
          textStatus,
          error,
          assets: assets.length,
          assetFailures: assets.filter((a) => a.status === "failed").length,
        }),
      ),
      legacy,
    },
    null,
    2,
  ),
);
