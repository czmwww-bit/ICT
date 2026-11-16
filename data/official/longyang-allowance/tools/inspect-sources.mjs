// 本地取证辅助依赖仅在reports/local/source-tools，未加入业务package.json。
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const modules = new URL(
  "../../../../reports/local/source-tools/node_modules/",
  import.meta.url,
);
const cheerio = await import(new URL("cheerio/dist/esm/index.js", modules));
const canvasModule = await import(new URL("@napi-rs/canvas/index.js", modules));
const canvas = canvasModule.default ?? canvasModule;
globalThis.DOMMatrix = canvas.DOMMatrix;
globalThis.ImageData = canvas.ImageData;
globalThis.Path2D = canvas.Path2D;
const pdfjs = await import(new URL("pdfjs-dist/legacy/build/pdf.mjs", modules));
const root = new URL("../", import.meta.url);
for (const id of ["longyang-2021", "longyang-2025"]) {
  const html = await readFile(new URL(`sources/${id}.html`, root), "utf8"),
    $ = cheerio.load(html);
  const paragraphs = $("div.m-4.content p")
    .toArray()
    .map((p) =>
      $(p)
        .text()
        .replace(/\u00a0/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const fields = {};
  $("dl.reference").each((_index, dl) => {
    const key = $(dl).find("dt").text().replace(/\s+/g, "");
    if (key !== "浏览量") fields[key] = $(dl).find("dd").text().trim();
  });
  await writeFile(
    new URL(`sources/${id}.txt`, root),
    paragraphs.join("\n\n") + "\n",
  );
  await writeFile(
    new URL(`sources/${id}.extracted.json`, root),
    JSON.stringify(
      {
        fields,
        paragraphs,
        method:
          "DOM中div.m-4.content各p文字；解码HTML实体，首尾空白去除，段间空行保留",
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify({ id, fields, paragraphs: paragraphs.length }));
}
{
  const html = await readFile(new URL('sources/gejiu-attachment-page.html', root), 'utf8');
  const $ = cheerio.load(html);
  const fields = {};
  $('ul.xxgk-info li').each((_i, li) => {
    fields[$(li).find('.t').text().trim()] = $(li).find('.c').text().trim();
  });
  const title = $('.xxgk-tit h1').text().trim();
  const paragraphs = $('#vsb_content p').toArray().map(p => $(p).text().trim()).filter(Boolean);
  await writeFile(new URL('sources/gejiu-attachment-page.extracted.json', root), JSON.stringify({ title, fields, paragraphs, method: 'DOM中ul.xxgk-info元数据及#vsb_content p正文' }, null, 2) + '\n');
  await writeFile(new URL('sources/gejiu-attachment-page.txt', root), [title, ...paragraphs].join('\n\n') + '\n');
  console.log(JSON.stringify({ id: 'gejiu-attachment-page', fields, paragraphs: paragraphs.length }));
}
if (process.argv.includes('--html-only')) process.exit(0);
const task = pdfjs.getDocument({
  data: new Uint8Array(
    await readFile(new URL("sources/yn-notice-2024-113.pdf", root)),
  ),
  useSystemFonts: true,
  wasmUrl: fileURLToPath(new URL("pdfjs-dist/wasm/", modules)).replaceAll(
    "\\",
    "/",
  ),
});
const pdf = await task.promise;
await mkdir(new URL("sources/pdf-pages/", root), { recursive: true });
const pages = [];
for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
  const page = await pdf.getPage(pageNumber),
    content = await page.getTextContent();
  const text = content.items.map((item) => item.str ?? "").join("\n");
  const viewport = page.getViewport({ scale: 1.7 });
  const bitmap = canvas.createCanvas(
    Math.ceil(viewport.width),
    Math.ceil(viewport.height),
  );
  await page.render({
    canvasContext: bitmap.getContext("2d"),
    canvas: bitmap,
    viewport,
  }).promise;
  await writeFile(
    new URL(
      `sources/pdf-pages/page-${String(pageNumber).padStart(2, "0")}.png`,
      root,
    ),
    bitmap.toBuffer("image/png"),
  );
  pages.push({ page: pageNumber, text });
  console.log(
    JSON.stringify({ pdfPage: pageNumber, textCharacters: text.length }),
  );
}
await writeFile(
  new URL("sources/pdf-extraction.json", root),
  JSON.stringify(
    {
      pages: pdf.numPages,
      extraction: "pdfjs文本层，是否有文字需逐页核对",
      pageTexts: pages,
    },
    null,
    2,
  ) + "\n",
);
await task.destroy();
