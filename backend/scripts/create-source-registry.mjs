// 已登记来源的配置初次生成；不覆盖人工调整。
import { readFile, writeFile, access } from 'node:fs/promises';
const root = new URL('../../data/official/longyang-pilot/', import.meta.url),
  out = new URL('source-registry.json', root);
try {
  await access(out);
  throw new Error('来源登记已存在，拒绝覆盖');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const acquisition = JSON.parse(await readFile(new URL('acquisition.json', root), 'utf8')),
  metadata = JSON.parse(await readFile(new URL('document-metadata.json', root), 'utf8'));
const all = [
    ...acquisition.sources,
    ...acquisition.attachments,
    ...(acquisition.supplements ?? []),
  ],
  sources = [];
for (const s of [...acquisition.sources, ...(acquisition.supplements ?? [])].filter(
  (s) => s.item !== 0 && !s.id.endsWith('-pdf'),
)) {
  const m = metadata.find((m) => m.sourceCarrierIds.includes(s.id));
  if (!m) continue;
  let selector = '.newswen';
  try {
    const e = JSON.parse(await readFile(new URL(`sources/${s.id}.extracted.json`, root), 'utf8'));
    selector = e.selector;
  } catch {}
  const attachments =
    s.id === 'A3'
      ? [all.find((a) => a.id === 'A3-attachment-1')]
      : s.id === 'C13'
        ? [all.find((a) => a.id === 'C13-pdf')]
        : [];
  sources.push({
    id: s.id,
    documentId: m.documentId,
    url: s.url,
    format: 'html',
    selector,
    attachmentRequired: attachments.length > 0,
    excludeSelectors: ['.click', '.view-count', '.content-page'],
    ...(s.file
      ? {
          baseline: {
            file: s.file,
            attachments: attachments.filter(Boolean).map((a) => ({ url: a.url, file: a.file })),
          },
        }
      : {}),
    declaredEffectiveFrom: m.recordedEffectiveFrom ?? null,
  });
}
const failedPdf = acquisition.sources.find((s) => s.id === 'B6-pdf');
sources.push({
  id: 'B6-pdf',
  documentId: 'YN_ECON_SERVICE_2023_2',
  url: failedPdf.url,
  format: 'pdf',
  declaredEffectiveFrom: '2023-04-01',
});
await writeFile(out, JSON.stringify({ schemaVersion: 1, sources }, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    sources: sources.length,
    file: 'data/official/longyang-pilot/source-registry.json',
  }),
);
