import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const cheerio = await import(
  new URL(
    "../../../../reports/local/source-tools/node_modules/cheerio/dist/esm/index.js",
    import.meta.url,
  )
);
const manifest = JSON.parse(
  await readFile(new URL("acquisition.json", root), "utf8"),
);
for (const r of [...manifest.sources, ...(manifest.supplements ?? [])].filter(
  (r) => r.status === "retrieved" && r.format === "html",
)) {
  const $ = cheerio.load(await readFile(new URL(r.file, root), "utf8"));
  const fields = {};
  $("meta[name]").each((_i, e) => {
    const n = $(e).attr("name");
    if (/Title|PubDate|ContentSource|Author|Description/i.test(n))
      fields[n] = $(e).attr("content");
  });
  $("dl.reference").each(
    (_i, e) =>
      (fields[$(e).find("dt").text().trim()] = $(e).find("dd").text().trim()),
  );
  $("ul.xxgk-info li").each(
    (_i, e) =>
      (fields[$(e).find(".t").text().trim()] = $(e).find(".c").text().trim()),
  );
  $(".tiemmv1").each(
    (_i, e) =>
      (fields[$(e).find(".tiemmv1a").text().trim()] = $(e)
        .find(".tiemmv1b")
        .text()
        .trim()),
  );
  const selectors = [
    "div.m-4.content",
    "#vsb_content",
    "#vsb_content_500",
    '[id^="vsb_content_"]',
    ".newswen",
    ".v_news_content",
    ".TRS_Editor",
    "#UCAP-CONTENT",
    "#zoom",
    "#zoomcon",
    "#artibody",
    ".article-content",
    "#content_div",
    ".detail-content",
    ".text",
    "article",
  ];
  const candidates = selectors
    .filter((s) => $(s).length)
    .map((s) => ({ selector: s, chars: $(s).first().text().length }));
  const chosen = candidates.find((s) => s.chars > 60) ?? candidates[0];
  let node = chosen ? $(chosen.selector).first().clone() : $("body").clone();
  node.find("script,style,noscript").remove();
  let paragraphs = node
    .find("p,li,h1,h2,h3,tr")
    .toArray()
    .filter((e) => !$(e).parentsUntil(node).is("p,li,tr"))
    .map((e) =>
      $(e)
        .text()
        .replace(/\u00a0/g, " ")
        .trim(),
    )
    .filter(Boolean);
  if (paragraphs.length < 2)
    paragraphs = node
      .text()
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  const text = paragraphs.join("\n\n") + "\n";
  const extracted = {
    id: r.id,
    sourceUrl: r.url,
    title:
      fields.ArticleTitle ??
      fields.pageTitle ??
      $("h1").first().text().trim() ??
      r.title,
    fields,
    selector: chosen?.selector ?? "body_fallback_REVIEW",
    paragraphs,
  };
  await writeFile(
    new URL(`sources/${r.id}.extracted.json`, root),
    JSON.stringify(extracted, null, 2) + "\n",
  );
  await writeFile(new URL(`sources/${r.id}.txt`, root), text);
  console.log(
    JSON.stringify({
      id: r.id,
      fields,
      candidates,
      paragraphs: paragraphs.length,
      chars: text.length,
      first: paragraphs[0]?.slice(0, 85),
      last: paragraphs.at(-1)?.slice(0, 100),
    }),
  );
}
