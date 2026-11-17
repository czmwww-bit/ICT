// 离线提取本轮归档的正文与附件，不执行宏、不把提取成功当成人工审核。
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { load } from "../../../../backend/node_modules/cheerio/dist/esm/index.js";
const root = new URL("../review-followup-2026-11-17/", import.meta.url),
  require = createRequire(
    new URL(
      "../../../../reports/local/source-tools/package.json",
      import.meta.url,
    ),
  );
const WordExtractor = require("word-extractor"),
  extractor = new WordExtractor();
const hash = (b) => createHash("sha256").update(b).digest("hex");
const acquisition = JSON.parse(
  await readFile(new URL("acquisition.json", root), "utf8"),
);
for (const s of acquisition.sources.filter((s) => s.status === "retrieved")) {
  const $ = load(await readFile(new URL(s.file, root), "utf8"));
  const selectors = [
    '[id^="vsb_content_"]',
    "#vsb_content",
    ".v_news_content",
    ".m-4.content",
  ];
  const selector = selectors.find((k) => $(k).length);
  if (!selector) {
    s.textStatus = "selector_not_found";
    continue;
  }
  const node = $(selector).first().clone();
  node.find("script,style").remove();
  const paragraphs = node
    .find("p,tr")
    .toArray()
    .filter((e) => !$(e).parentsUntil(selector).is("p,tr"))
    .map((e) => $(e).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const body = paragraphs.length
    ? paragraphs.join("\n\n")
    : node.text().replace(/\s+/g, " ").trim();
  s.bodyFile = "sources/" + s.id + ".txt";
  s.bodySelector = selector;
  await writeFile(new URL(s.bodyFile, root), body + "\n");
  s.bodySha256 = hash(await readFile(new URL(s.bodyFile, root)));
  s.textStatus = "extracted";
  if (s.id.startsWith("BS-"))
    s.longyangRows = node
      .find("tr")
      .toArray()
      .map((e) =>
        $(e)
          .find("th,td")
          .toArray()
          .map((c) => $(c).text().trim()),
      )
      .filter((row) => row.some((c) => c === "隆阳区"));
  if (s.id === "C11-honghe-review")
    s.attachmentContainerHints = $("a[href]")
      .toArray()
      .filter((e) => /^7\..*实施细则\.doc/.test($(e).text().trim()))
      .map((e) =>
        $(e)
          .parents()
          .slice(0, 4)
          .toArray()
          .map((p) => ({
            tag: p.tagName,
            id: $(p).attr("id"),
            class: $(p).attr("class"),
          })),
      );
}
for (const a of acquisition.attachments.filter(
  (a) => a.status === "retrieved",
)) {
  try {
    const document = await extractor.extract(
      fileURLToPath(new URL(a.file, root)),
    );
    const text = document.getBody();
    a.textFile = "sources/" + a.id + ".txt";
    await writeFile(new URL(a.textFile, root), text);
    a.textSha256 = hash(await readFile(new URL(a.textFile, root)));
    a.textStatus = "extracted_pending_human_review";
    a.extraction = {
      tool: "word-extractor",
      version: "1.0.4",
      license: "MIT",
      noMacrosExecuted: true,
      locator: "按提取文本段落定位；未推定Word分页，原件待人工检查",
    };
  } catch (e) {
    a.textStatus = "failed";
    a.textError = e.message;
  }
}
await writeFile(
  new URL("acquisition.json", root),
  JSON.stringify(acquisition, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      sources: acquisition.sources.map(
        ({ id, textStatus, longyangRows, attachmentContainerHints }) => ({
          id,
          textStatus,
          longyangRows,
          attachmentContainerHints,
        }),
      ),
      attachments: acquisition.attachments.map(
        ({ id, textStatus, textFile }) => ({ id, textStatus, textFile }),
      ),
    },
    null,
    2,
  ),
);
