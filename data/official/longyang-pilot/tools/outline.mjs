import { readFile } from "node:fs/promises";
for (const id of process.argv.slice(2)) {
  const r = JSON.parse(
    await readFile(
      new URL(`../sources/${id}.extracted.json`, import.meta.url),
      "utf8",
    ),
  );
  console.log(id, JSON.stringify(r.fields ?? {}));
  for (const [i, p] of r.paragraphs.entries())
    console.log(`${i}: ${p.length > 130 ? p.slice(0, 130) + "…" : p}`);
}
