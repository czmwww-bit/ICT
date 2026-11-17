// 只抓取官方栏目索引以发现迁移后的原文地址；不把搜索摘要写成政策正文。
import { mkdir, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "../../../../backend/node_modules/cheerio/dist/esm/index.js";
const root = new URL("../", import.meta.url);
try {
  await access(new URL("discovery.json", root));
  throw Error("索引发现已归档，拒绝重跑覆盖检索记录");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await mkdir(new URL("sources/indexes/", root), { recursive: true });
const sections = [
  ["news", "https://ylbz.yn.gov.cn/xwdt/ybyw/", 34],
  ["policy", "https://ylbz.yn.gov.cn/zfxxgk/zcwj/qtwj/", 10],
  ["interpretation", "https://ylbz.yn.gov.cn/zfxxgk/fdzdgknr/zcjd/", 5],
];
const jobs = sections.flatMap(([id, base, n]) =>
  Array.from({ length: n }, (_, i) => ({
    id: id + "-" + i,
    url: base + (i ? "index_" + i + ".html" : ""),
  })),
);
const results = [],
  matches = [];
const pattern =
  /共济|小程序|医保账单|异地就医|参保.*缴费|参保长效|办事指南|亲情账户|医保钱包/;
async function work(job) {
  const row = { ...job, fetchedAt: new Date().toISOString() };
  try {
    const r = await fetch(job.url, { signal: AbortSignal.timeout(12000) });
    row.httpStatus = r.status;
    if (!r.ok) throw Error("HTTP " + r.status);
    const b = Buffer.from(await r.arrayBuffer()),
      $ = load(b.toString("utf8"));
    row.file = "sources/indexes/" + job.id + ".html";
    row.sha256 = createHash("sha256").update(b).digest("hex");
    await writeFile(new URL(row.file, root), b, { flag: "wx" });
    for (const a of $("a[href]").toArray()) {
      const title = $(a).text().replace(/\s+/g, " ").trim(),
        href = $(a).attr("href");
      if (pattern.test(title) && /\.html(?:$|[?#])/.test(href)) {
        const url = new URL(href, job.url).href;
        if (!matches.some((x) => x.url === url))
          matches.push({ title, url, indexFile: row.file });
      }
    }
  } catch (e) {
    row.error = e.message;
  }
  results.push(row);
}
let cursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < jobs.length) await work(jobs[cursor++]);
  }),
);
const report = {
  searchedAt: new Date().toISOString(),
  purpose: "官方新站迁移地址发现，索引不是已获取的政策全文",
  results,
  matches,
};
await writeFile(
  new URL("discovery.json", root),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      indexes: results.length,
      success: results.filter((r) => !r.error).length,
      matches,
    },
    null,
    2,
  ),
);
