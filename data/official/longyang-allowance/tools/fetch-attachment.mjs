import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const capture = JSON.parse(
  await readFile(new URL("retrieval.direct.json", root), "utf8"),
);
const page = capture.sources.find((s) => s.id === "gejiu-attachment-page");
const url = page.attachments[0];
const result = {
  url,
  landingPage: page.url,
  retrievedAt: new Date().toISOString(),
  retrievedDate: "2026-11-16",
  status: "failed",
};
try {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Referer: page.url,
      Accept: "application/pdf,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(30000),
  });
  result.httpStatus = r.status;
  result.finalUrl = r.url;
  result.contentType = r.headers.get("content-type");
  const bytes = Buffer.from(await r.arrayBuffer());
  if (!r.ok || bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new Error(
      "不是可核对PDF：HTTP " +
        r.status +
        "；响应头 " +
        bytes.subarray(0, 40).toString("utf8"),
    );
  const file = new URL("sources/yn-notice-2024-113.pdf", root);
  try {
    await writeFile(file, bytes, { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const old = await readFile(file);
    if (!old.equals(bytes)) throw new Error("已有PDF内容不同，保留原件不覆盖");
  }
  result.status = "retrieved";
  result.file = "sources/yn-notice-2024-113.pdf";
  result.bytes = bytes.length;
  result.sha256 = createHash("sha256").update(bytes).digest("hex");
} catch (e) {
  result.error = e.message;
  result.cause = e.cause?.code ?? null;
}
await writeFile(
  new URL("retrieval.attachment.json", root),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
