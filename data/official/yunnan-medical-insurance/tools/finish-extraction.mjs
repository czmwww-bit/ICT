// 修复正文选择器；保留初次失败记录。附件仅按原始类型命名，不改内容。
import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "../../../../backend/node_modules/cheerio/dist/esm/index.js";
const root = new URL("../", import.meta.url),
  hash = (b) => createHash("sha256").update(b).digest("hex"),
  a = JSON.parse(await readFile(new URL("acquisition.json", root), "utf8"));
const s = a.records.find((s) => s.id === "YB02");
s.extractionAttempts = [
  {
    at: s.retrievedAt,
    status: s.status,
    error: s.error,
    phase: "initial_selector",
  },
];
const $ = load(await readFile(new URL(s.file, root), "utf8")),
  node = $("#content-txt-1").clone();
if (!node.length) throw Error("玉溪正文定位失败");
node.find("script,style").remove();
const paragraphs = node
  .find("p,tr")
  .toArray()
  .filter((e) => !$(e).parentsUntil("#content-txt-1").is("p,tr"))
  .map((e) => $(e).text().replace(/\s+/g, " ").trim())
  .filter(Boolean);
s.selector = "#content-txt-1";
s.status = "retrieved";
delete s.error;
s.textStatus = "extracted_pending_human_review";
s.pagePublishedAt = $('meta[name="PubDate"]').attr("content") ?? "2024-09-02";
s.contentSource = "玉溪市医疗保障局";
s.textFile = "sources/YB02.txt";
const text = paragraphs.join("\n\n") + "\n";
await writeFile(new URL(s.textFile, root), text);
s.textSha256 = hash(text);
const urls = [
  ...new Set(
    node
      .find("img[src]")
      .toArray()
      .map((e) => new URL($(e).attr("src"), s.url).href),
  ),
];
for (const [i, url] of urls.entries()) {
  const asset = {
    url,
    kind: "image",
    retrievedAt: new Date().toISOString(),
    status: "failed",
  };
  try {
    const r = await fetch(url, {
      headers: { Referer: s.url },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw Error("HTTP " + r.status);
    const b = Buffer.from(await r.arrayBuffer()),
      ext = b[0] === 0xff ? "jpg" : b[0] === 0x89 ? "png" : null;
    if (!ext) throw Error("不是支持的图片");
    asset.file =
      "sources/assets/YB02-" + String(i + 1).padStart(2, "0") + "." + ext;
    await writeFile(new URL(asset.file, root), b);
    asset.sha256 = hash(b);
    asset.bytes = b.length;
    asset.status = "retrieved";
  } catch (e) {
    asset.error = e.message;
  }
  s.assets.push(asset);
}
await writeFile(
  new URL("sources/YB02.extracted.json", root),
  JSON.stringify(
    {
      id: s.id,
      sourceUrl: s.url,
      title: s.title,
      fields: { PubDate: s.pagePublishedAt, ContentSource: s.contentSource },
      selector: s.selector,
      paragraphs,
      assets: s.assets,
    },
    null,
    2,
  ) + "\n",
);
for (const r of a.records) {
  for (const asset of r.assets) {
    if (/annex-download|fileTypeImages/.test(asset.url))
      asset.role = "page_decoration_not_policy_evidence";
    if (
      asset.status === "retrieved" &&
      asset.file.endsWith(".zip") &&
      /\.(docx|xlsx)(?:$|[?#])/i.test(asset.url)
    ) {
      const ext = asset.url.match(/\.(docx|xlsx)(?:$|[?#])/i)[1].toLowerCase(),
        dest = asset.file.replace(/\.zip$/, "." + ext);
      await rename(new URL(asset.file, root), new URL(dest, root));
      asset.file = dest;
      asset.format = ext;
    }
  }
  const file = new URL("sources/" + r.id + ".extracted.json", root);
  try {
    const e = JSON.parse(await readFile(file, "utf8"));
    e.assets = r.assets;
    await writeFile(file, JSON.stringify(e, null, 2) + "\n");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
await writeFile(
  new URL("acquisition.json", root),
  JSON.stringify(a, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    YB02: s.status,
    paragraphs: paragraphs.length,
    images: s.assets.length,
    officialAttachments: a.records
      .find((s) => s.id === "YB18")
      .assets.filter((a) => a.kind === "attachment")
      .map((a) => a.file),
  }),
);
