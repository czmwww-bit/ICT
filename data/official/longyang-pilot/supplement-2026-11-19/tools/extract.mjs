import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "../../../../../backend/node_modules/cheerio/dist/esm/index.js";
const root = new URL("../", import.meta.url),
  file = new URL("acquisition.json", root);
const acquisition = JSON.parse(await readFile(file, "utf8"));
const normalize = (s) => s.replace(/\s+/g, " ").trim();
const hash = (s) => createHash("sha256").update(s).digest("hex");
for (const r of acquisition.records.filter(
  (r) =>
    r.status === "body_parse_failed" || r.tables || r.id === "LY-MZ-CONTACT",
)) {
  const raw = await readFile(new URL(r.rawFile, root));
  if (hash(raw) !== r.sha256) throw new Error("原件哈希不一致 " + r.id);
  const $ = load(raw.toString("utf8"));
  const selector =
    r.id === "LY-MZ-CONTACT"
      ? '[id^="vsb_content_"]'
      : ["#vsb_content", ".m-4.content"].find((s) => $(s).length);
  if (!selector) continue;
  const body =
    r.id === "LY-MZ-CONTACT"
      ? $("<div>").append(
          $(selector)
            .filter((i, e) => !$(e).parents(selector).length)
            .clone(),
        )
      : $(selector).first().clone();
  body.find("script,style").remove();
  r.extractionAttempts = [
    ...(r.extractionAttempts ?? []),
    {
      status: r.status,
      reason:
        r.error ??
        "保留初次结果；去除Excel转换表格尾部空单元格、合并机构页分栏正文",
    },
    { status: "full_text_retrieved", selector, at: new Date().toISOString() },
  ];
  r.selector = selector;
  r.tables = body
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
  const rowText = (tr) => {
    const cells = $(tr)
      .children("th,td")
      .toArray()
      .map((td) => normalize($(td).text()));
    while (cells.at(-1) === "") cells.pop();
    return cells.join(" | ");
  };
  const blocks = body
    .find("p,table,h1,h2,h3")
    .toArray()
    .filter((e) => $(e).parentsUntil(body).filter("p,table").length === 0)
    .map((e) =>
      $(e).is("table")
        ? $(e).find("tr").toArray().map(rowText).filter(Boolean).join("\n")
        : normalize($(e).text()),
    )
    .filter(Boolean);
  const text = r.title + "\n\n" + blocks.join("\n\n") + "\n";
  r.textFile = "sources/" + r.id + ".txt";
  r.textSha256 = hash(text);
  r.status = "full_text_retrieved";
  delete r.error;
  await writeFile(new URL(r.textFile, root), text);
}
const redirect = acquisition.records.find(
  (r) => r.id === "YN-ECON-CURRENT-INDEX",
);
if (redirect) {
  redirect.status = "redirect_page_only";
  redirect.error =
    "HTTP 200返回meta Refresh跳转，尚未取得目录正文，不作完整检索结论";
}
await writeFile(file, JSON.stringify(acquisition, null, 2) + "\n");
console.log(
  JSON.stringify(
    acquisition.records.map((r) => ({
      id: r.id,
      status: r.status,
      rows: r.tables?.[0]?.rows?.length,
    })),
  ),
);
