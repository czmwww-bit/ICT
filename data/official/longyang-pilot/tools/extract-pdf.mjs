import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const modules = new URL(
  "../../../../reports/local/source-tools/node_modules/",
  import.meta.url,
);
const canvasModule = await import(new URL("@napi-rs/canvas/index.js", modules));
const canvas = canvasModule.default ?? canvasModule;
globalThis.DOMMatrix = canvas.DOMMatrix;
globalThis.ImageData = canvas.ImageData;
globalThis.Path2D = canvas.Path2D;
const pdfjs = await import(new URL("pdfjs-dist/legacy/build/pdf.mjs", modules));
const manifest = JSON.parse(
  await readFile(new URL("acquisition.json", root), "utf8"),
);
for (const r of [
  ...manifest.sources,
  ...manifest.attachments,
  ...(manifest.supplements ?? []),
].filter(
  (r) => r.format === "pdf" && r.status === "retrieved" && !r.reusedSnapshot,
)) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(await readFile(new URL(r.file, root))),
    useSystemFonts: true,
    wasmUrl: fileURLToPath(new URL("pdfjs-dist/wasm/", modules)).replaceAll(
      "\\",
      "/",
    ),
    cMapUrl: fileURLToPath(new URL("pdfjs-dist/cmaps/", modules)).replaceAll(
      "\\",
      "/",
    ),
    cMapPacked: true,
    standardFontDataUrl: fileURLToPath(
      new URL("pdfjs-dist/standard_fonts/", modules),
    ).replaceAll("\\", "/"),
  });
  const pdf = await task.promise,
    pages = [];
  await mkdir(new URL(`sources/${r.id}-pages/`, root), { recursive: true });
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n),
      content = await page.getTextContent();
    const lines = [];
    let lastY = null;
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = Math.round(item.transform[5] * 10) / 10;
      if (lastY !== null && Math.abs(y - lastY) > 2) lines.push("\n");
      lines.push(item.str);
      if (item.hasEOL) lines.push("\n");
      lastY = y;
    }
    const text = lines
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    pages.push({ page: n, text });
    const viewport = page.getViewport({ scale: 1.6 }),
      bitmap = canvas.createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
    await page.render({
      canvas: bitmap,
      canvasContext: bitmap.getContext("2d"),
      viewport,
    }).promise;
    await writeFile(
      new URL(
        `sources/${r.id}-pages/page-${String(n).padStart(2, "0")}.png`,
        root,
      ),
      bitmap.toBuffer("image/png"),
    );
    console.log(
      JSON.stringify({
        id: r.id,
        page: n,
        characters: text.length,
        preview: text.slice(0, 180),
      }),
    );
  }
  await writeFile(
    new URL(`sources/${r.id}.extracted.json`, root),
    JSON.stringify(
      {
        method: "PDFJS文字层，合并同一基线文字，保留分页；逐页图片待人工核对",
        pages,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    new URL(`sources/${r.id}.txt`, root),
    pages.map((p) => `【PDF第${p.page}页】\n${p.text}`).join("\n\n") + "\n",
  );
  await task.destroy();
}
