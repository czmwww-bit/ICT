// 仅采集公开来源并归档；不连接数据库、不审核或发布。
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = new URL("../sources/", import.meta.url);
await mkdir(root, { recursive: true });
const sources = [
  ["longyang-2021", "https://longyang.gov.cn/info/4225/6273009.htm"],
  ["longyang-2025", "https://www.longyang.gov.cn/info/4580/14016319.htm"],
  ["gejiu-attachment-page", "https://www.hhgj.gov.cn/info/13101/546351.htm"],
  [
    "yunnan-original-notice",
    "https://ynmz.yn.gov.cn/cms/qitazhengcewenjian/10884.html",
  ],
  [
    "yunnan-region-codes",
    "https://ynmz.yn.gov.cn/index.php/cms/gongshigonggao/12323.html",
  ],
];
const sha = (value) => createHash("sha256").update(value).digest("hex");
async function save(filename, bytes) {
  const path = new URL(filename, root);
  try {
    const old = await readFile(path);
    if (sha(old) !== sha(bytes))
      throw new Error("已有采集文件内容不同，保留原件，停止覆盖：" + filename);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await writeFile(path, bytes, { flag: "wx" });
  }
  return fileURLToPath(path);
}
const results = await Promise.all(
  sources.map(async ([id, url]) => {
    const entry = {
      id,
      url,
      retrievedAt: new Date().toISOString(),
      retrievedDate: "2026-11-16",
      method: "direct-https",
      status: "failed",
    };
    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "text/html,application/pdf;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(22000),
      });
      entry.httpStatus = r.status;
      entry.finalUrl = r.url;
      entry.contentType = r.headers.get("content-type");
      const bytes = Buffer.from(await r.arrayBuffer());
      if (!r.ok) throw new Error("HTTP " + r.status);
      const html = new TextDecoder("utf-8").decode(bytes);
      if (!html.includes("</html>"))
        throw new Error("响应不是完整HTML，不能当正文存档");
      entry.file = await save(id + ".html", bytes);
      entry.bytes = bytes.length;
      entry.sha256 = sha(bytes);
      entry.status = "retrieved";
      entry.attachments = [
        ...html.matchAll(
          /href\s*=\s*["']([^"']*(?:\.pdf|virtual_attach_file|_download)[^"']*)["']/gi,
        ),
      ].map((m) => new URL(m[1].replaceAll("&amp;", "&"), r.url).href);
      const marker = html.indexOf("v_news_content");
      entry.bodySample =
        marker >= 0 ? html.slice(Math.max(0, marker - 80), marker + 100) : null;
    } catch (e) {
      entry.error = e.message;
      entry.cause = e.cause?.code ?? null;
    }
    console.log(JSON.stringify(entry));
    return entry;
  }),
);
await writeFile(
  new URL("../retrieval.direct.json", import.meta.url),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), sources: results },
    null,
    2,
  ) + "\n",
);
