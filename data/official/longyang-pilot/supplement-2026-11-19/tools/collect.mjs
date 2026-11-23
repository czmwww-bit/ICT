import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "../../../../../backend/node_modules/cheerio/dist/esm/index.js";
const root = new URL("../", import.meta.url);
await mkdir(new URL("sources/", root), { recursive: true });
try {
  await access(new URL("acquisition.json", root));
  throw new Error("采集批次已存在，请新建日期批次，不覆盖快照");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const list = [
  ["BS-202601", "https://www.baoshan.gov.cn/info/6126/10335854.htm"],
  ["BS-202602", "https://baoshan.gov.cn/info/6126/10352984.htm"],
  ["BS-202608", "https://www.baoshan.gov.cn/info/6126/10396644.htm"],
  ["BS-202609", "https://www.baoshan.gov.cn/info/6126/10409514.htm"],
  ["LY-2026Q2", "https://www.longyang.gov.cn/info/2861/14118239.htm"],
  ["LY-MZ-CONTACT", "https://longyang.gov.cn/xxgk/bm/lyqmzj/fdzdgknr/zzjg.htm"],
  ["BS-ECON-202609", "https://www.baoshan.gov.cn/info/6126/10409524.htm"],
  [
    "YN-ELDER-CARD-PRIMARY",
    "https://ynmz.yn.gov.cn/cms/qitazhengcewenjian/11904.html",
  ],
  [
    "HH-ELDER-CARD-INDEX",
    "https://www.hh.gov.cn/zfxxgk/fdzdgknr/zdmsxx/ylfw.htm",
  ],
  ["YN-ECON-CURRENT-INDEX", "https://ynmz.yn.gov.cn/zwgk/zcwj/"],
];
const hash = (b) => createHash("sha256").update(b).digest("hex");
const normalize = (s) => s.replace(/\s+/g, " ").trim();
const records = [];
const queue = [...list];
for (let n = 0; n < queue.length; n++) {
  const [id, url] = queue[n];
  const r = {
    id,
    url,
    fetchedAt: new Date().toISOString(),
    status: "fetch_failed",
  };
  records.push(r);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(25000),
      headers: { "User-Agent": "Mozilla/5.0 (official evidence archival)" },
    });
    r.httpStatus = response.status;
    r.finalUrl = response.url;
    const raw = Buffer.from(await response.arrayBuffer());
    r.rawFile = "sources/" + id + ".html";
    r.sha256 = hash(raw);
    r.bytes = raw.length;
    await writeFile(new URL(r.rawFile, root), raw, { flag: "wx" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const $ = load(raw.toString("utf8"));
    r.title =
      normalize(
        $('meta[name="ArticleTitle"]').attr("content") ??
          $("h1").first().text() ??
          "",
      ) || normalize($("title").text());
    r.webPublishedAt = $('meta[name="PubDate"]').attr("content") ?? null;
    r.links = $("a[href]")
      .toArray()
      .map((e) => ({
        text: normalize($(e).text()),
        url: new URL($(e).attr("href"), response.url).href,
      }));
    let selector = [
      "#vsb_content",
      ".m-4.content",
      '[id^="vsb_content_"]',
      ".v_news_content",
      "#zoom",
      "#content",
      ".article-content",
      ".xxgk-con",
    ].find((s) => $(s).length && normalize($(s).first().text()).length > 50);
    if (id.endsWith("INDEX")) {
      r.status = "index_archived";
      if (id === "HH-ELDER-CARD-INDEX") {
        const link = r.links.find((l) =>
          l.text.includes("做好以居民身份证替代老年优待证"),
        );
        if (link) queue.push(["HH-ELDER-CARD-REPRINT", link.url]);
      }
      continue;
    }
    if (!selector) {
      r.status = "body_parse_failed";
      r.error = "未找到受支持正文选择器";
      continue;
    }
    r.selector = selector;
    const body =
      id === "LY-MZ-CONTACT"
        ? $("<div>").append(
            $(selector)
              .filter((i, e) => !$(e).parents(selector).length)
              .clone(),
          )
        : $(selector).first().clone();
    body.find("script,style").remove();
    const tables = body
      .find("table")
      .toArray()
      .map((t, i) => ({
        table: i + 1,
        rows: $(t)
          .find("tr")
          .toArray()
          .map((tr, j) => ({
            row: j + 1,
            cells: $(tr)
              .children("th,td")
              .toArray()
              .map((td) => ({
                text: normalize($(td).text()),
                colspan: Number($(td).attr("colspan") ?? 1),
                rowspan: Number($(td).attr("rowspan") ?? 1),
              })),
          })),
      }));
    const blocks = body
      .find("p,table,h1,h2,h3,h4,li")
      .toArray()
      .filter((e) => $(e).parentsUntil(body).filter("p,table,li").length === 0)
      .map((e) =>
        $(e).is("table")
          ? $(e)
              .find("tr")
              .toArray()
              .map((tr) =>
                $(tr)
                  .children("th,td")
                  .toArray()
                  .map((td) => normalize($(td).text()))
                  .join(" | "),
              )
              .join("\n")
          : normalize($(e).text()),
      )
      .filter(Boolean);
    const text =
      r.title +
      "\n\n" +
      (blocks.length ? blocks.join("\n\n") : normalize(body.text())) +
      "\n";
    r.textFile = "sources/" + id + ".txt";
    r.textSha256 = hash(text);
    r.tables = tables;
    await writeFile(new URL(r.textFile, root), text, { flag: "wx" });
    r.status = "full_text_retrieved";
  } catch (e) {
    r.error = e.message;
  }
  console.log(id, r.status, r.httpStatus ?? "");
}
await writeFile(
  new URL("acquisition.json", root),
  JSON.stringify({ executedAt: new Date().toISOString(), records }, null, 2) +
    "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify(
    records.map((r) => ({
      id: r.id,
      status: r.status,
      title: r.title,
      webPublishedAt: r.webPublishedAt,
      tables: r.tables?.length,
      bytes: r.bytes,
    })),
  ),
);
