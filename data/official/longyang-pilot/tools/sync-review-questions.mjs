// 核对表按稳定条款编号同步问题，保留原文、审核人、日期和决定；不以共享文字定位。
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
export function parseCsv(text) {
  const rows = [],
    t = text.replace(/^\ufeff/, "");
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"') {
      if (quoted && t[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("CSV引号未闭合");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
export async function syncReviewQuestions() {
  const root = new URL("../", import.meta.url),
    items = JSON.parse(
      await readFile(new URL("review-items.json", root), "utf8"),
    ),
    map = new Map(items.map((r) => [r.clauseId, r]));
  let md = await readFile(new URL("REVIEW_CHECKLIST.md", root), "utf8");
  let seen = 0;
  md = md.replace(
    /(^## ([A-Z0-9_]+)｜[^\n]*\n[\s\S]*?)(?=^## |$(?![\s\S]))/gm,
    (section, _all, id) => {
      const r = map.get(id);
      if (!r) return section;
      if (!/^待确认：.*$/m.test(section)) throw Error("问题字段缺失：" + id);
      seen++;
      return section.replace(/^待确认：.*$/m, "待确认：" + r.question);
    },
  );
  if (seen !== items.length) throw Error("MD核对表条款数不一致");
  const rows = parseCsv(
    await readFile(new URL("REVIEW_CHECKLIST.csv", root), "utf8"),
  );
  for (const row of rows.slice(1)) {
    const r = map.get(row[1]);
    if (!r || row.length !== 14) throw Error("CSV编号或列数错误");
    row[10] = r.question;
  }
  if (rows.length !== items.length + 1) throw Error("CSV核对表条款数不一致");
  const esc = (x) => '"' + String(x).replaceAll('"', '""') + '"';
  await writeFile(new URL("REVIEW_CHECKLIST.md", root), md);
  await writeFile(
    new URL("REVIEW_CHECKLIST.csv", root),
    "\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n",
  );
  return { synced: seen, reviewFieldsPreserved: true };
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  console.log(JSON.stringify(await syncReviewQuestions()));
