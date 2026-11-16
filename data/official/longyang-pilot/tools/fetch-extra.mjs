// 用显式清单补抓替代官方来源/脚本中的附件URL，不执行页面脚本。
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("acquisition.json", root), "utf8"),
);
const tasks = JSON.parse(await readFile(process.argv[2], "utf8"));
manifest.supplements ??= [];
for (const task of tasks) {
  const r = {
    ...task,
    retrievedAt: new Date().toISOString(),
    retrievedDate: "2026-11-16",
    status: "failed",
  };
  try {
    const response = await fetch(task.url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        ...(task.referer ? { Referer: task.referer } : {}),
      },
      signal: AbortSignal.timeout(25000),
    });
    r.httpStatus = response.status;
    r.finalUrl = response.url;
    r.contentType = response.headers.get("content-type");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok) throw new Error("HTTP " + response.status);
    r.format = bytes.subarray(0, 5).toString() === "%PDF-" ? "pdf" : "html";
    r.file = `sources/${task.id}.${r.format}`;
    r.bytes = bytes.length;
    r.sha256 = createHash("sha256").update(bytes).digest("hex");
    try {
      const old = await readFile(new URL(r.file, root));
      if (createHash("sha256").update(old).digest("hex") !== r.sha256)
        throw new Error("已存在快照不同，拒绝覆盖");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      await writeFile(new URL(r.file, root), bytes, { flag: "wx" });
    }
    r.status = "retrieved";
  } catch (e) {
    r.error = e.message;
  }
  manifest.supplements = manifest.supplements.filter((s) => s.id !== r.id);
  manifest.supplements.push(r);
  console.log(JSON.stringify(r));
}
await writeFile(
  new URL("acquisition.json", root),
  JSON.stringify(manifest, null, 2) + "\n",
);
