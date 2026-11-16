import { load } from 'cheerio';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
const fileRef = z.string().min(1);
const sourceSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  documentId: z.string(),
  url: z
    .string()
    .url()
    .refine((u) => /^https?:/.test(u)),
  format: z.enum(['html', 'pdf']),
  selector: z.string().optional(),
  excludeSelectors: z.array(z.string()).default([]),
  attachmentRequired: z.boolean().default(false),
  baseline: z
    .object({
      file: fileRef,
      attachments: z.array(z.object({ url: z.string().url(), file: fileRef })).default([]),
    })
    .optional(),
  declaredEffectiveFrom: z.string().nullable().default(null),
});
export const registrySchema = z
  .object({ schemaVersion: z.literal(1), sources: z.array(sourceSchema) })
  .superRefine((v, c) => {
    const ids = new Set();
    for (const [i, s] of v.sources.entries()) {
      if (ids.has(s.id))
        c.addIssue({ code: 'custom', path: ['sources', i, 'id'], message: '重复来源编号' });
      ids.add(s.id);
      if (s.format === 'html' && !s.selector)
        c.addIssue({
          code: 'custom',
          path: ['sources', i, 'selector'],
          message: 'HTML必须指定正文选择器',
        });
    }
  });
export type RegisteredSource = z.infer<typeof sourceSchema>;
export type MonitorOptions = {
  directory: string;
  registryFile: string;
  sourceId?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  pdfText?: (bytes: Buffer) => Promise<string | null>;
};
export const sha256 = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const clean = (text: string) =>
  text
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export function parsePage(html: string, s: RegisteredSource) {
  const $ = load(html),
    node = $(s.selector!).first().clone();
  if (!node.length) throw new Error('正文选择器未命中');
  // 只解析字符串，绝不执行官网脚本；iframe中的PDF地址按明确模式读取。
  const attachmentUrls = [
    ...new Set(
      [
        ...node
          .find('a[href]')
          .toArray()
          .map((e) => $(e).attr('href')!)
          .filter((h) => /\.(?:pdf|docx?|xlsx?)(?:[?#]|$)|virtual_attach_file|_download/i.test(h)),
        ...[...html.matchAll(/showVsbpdfIframe\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1]!),
        ...$('.xxgk-con a[href]')
          .toArray()
          .filter((e) => /\.pdf/i.test($(e).text()))
          .map((e) => $(e).attr('href')!),
      ].map((u) => new URL(u.replaceAll('&amp;', '&'), s.url).href),
    ),
  ].filter((u) => /^https?:/.test(u));
  node.find(['script', 'style', 'noscript', ...s.excludeSelectors].join(',')).remove();
  const elements = node
    .find('p,h1,h2,h3,li,tr')
    .toArray()
    .filter((e) => !$(e).parentsUntil(s.selector!).is('p,li,tr'));
  const lines = elements.map((e) => clean($(e).text())).filter(Boolean);
  const body = lines.length ? lines.join('\n') : clean(node.text());
  if (!body && !attachmentUrls.length && !s.attachmentRequired)
    throw new Error('正文为空，且没有可用附件链接');
  const pagePublishedAt =
    $('meta[name="PubDate"],meta[name="pubdate"]').first().attr('content') ?? null;
  return { body, attachmentUrls, pagePublishedAt };
}
export function compareLines(before: string, after: string) {
  const a = before.split('\n'),
    b = after.split('\n');
  // 试点正文短小；大文件降级整段差异，避免无界LCS内存。
  if (a.length * b.length > 500000)
    return { added: [after], removed: [before], modified: [{ before, after }], truncated: false };
  const dp = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const added: string[] = [],
    removed: string[] = [];
  let i = 0,
    j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (j < b.length && (i === a.length || dp[i]![j + 1]! >= dp[i + 1]![j]!))
      added.push(b[j++]!);
    else removed.push(a[i++]!);
  }
  return {
    added,
    removed,
    modified: removed
      .slice(0, Math.min(removed.length, added.length))
      .map((text, k) => ({ before: text, after: added[k]! })),
    truncated: false,
  };
}
export async function pdfText(bytes: Buffer): Promise<string | null> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n),
        c = await p.getTextContent();
      pages.push(c.items.map((i) => ('str' in i ? i.str : '')).join(''));
    }
    return clean(pages.join('\n')) || null;
  } finally {
    await task.destroy();
  }
}
type Attachment = {
  url: string;
  hash: string;
  blob: string | null;
  text: string | null;
  textStatus: string;
  format?: string;
};
type Observation = {
  fingerprint: string;
  body: string;
  bodyHash: string;
  rawHash: string;
  blob: string | null;
  attachments: Attachment[];
  pagePublishedAt: string | null;
  generation?: number;
};
export type UpdateTask = {
  id: string;
  sourceId: string;
  documentId: string;
  status: 'pending_review' | 'dismissed' | 'published';
  detectedAt: string;
  before: Observation;
  after: Observation;
  diff: ReturnType<typeof compareLines>;
  changes: string[];
  pageChangeDetectedAt: string;
  documentPublication: { observedPageDate: string | null; status: 'needs_review' };
  policyEffectivity: { declaredEffectiveFrom: string | null; status: 'not_inferred_from_page' };
  events: {
    at: string;
    actor: string;
    reason: string;
    decision: string;
    documentVersion?: number;
  }[];
};
export type CheckResult = {
  sourceId: string;
  status: string;
  checkedAt: string;
  taskId?: string;
  fingerprint?: string;
  error?: string;
  httpStatus?: number;
  attachmentErrors?: unknown[];
  rawHash?: string;
  bodyHash?: string;
  rawSnapshot?: string;
  contentStatus?: string;
  attachmentText?: { url: string; hash: string; textStatus: string }[];
};
async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}
async function atomic(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = file + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await rename(temp, file);
}
async function blob(directory: string, bytes: Buffer, ext: string) {
  const hash = sha256(bytes),
    file = path.posix.join('blobs', hash + '.' + ext);
  await mkdir(path.join(directory, 'blobs'), { recursive: true });
  try {
    await writeFile(path.join(directory, file), bytes, { flag: 'wx' });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
  }
  return { hash, file };
}
export async function withMonitorLock<T>(directory: string, work: () => Promise<T>) {
  await mkdir(directory, { recursive: true });
  const root = path.resolve(directory),
    lock = path.join(root, '.lock');
  try {
    await mkdir(lock);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error('SOURCE_CHECK_BUSY：已有检查或审核运行；不会重复建立任务');
    throw e;
  }
  try {
    await writeFile(
      path.join(lock, 'owner.json'),
      JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
    );
    return await work();
  } finally {
    if (path.dirname(path.resolve(lock)) !== root) throw new Error('检查锁路径越界');
    await rm(lock, { recursive: true });
  }
}
export async function listTasks(directory: string) {
  const dir = path.join(directory, 'tasks');
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  return Promise.all(
    files
      .filter((f) => /^[a-f0-9]{64}\.json$/.test(f))
      .sort()
      .map(async (f) => (await readJson<UpdateTask>(path.join(dir, f)))!),
  );
}
export async function monitorStatus(directory: string) {
  const last = await readJson<{ completedAt: string; results: CheckResult[] }>(
    path.join(directory, 'last-check.json'),
  );
  const tasks = await listTasks(directory);
  return {
    lastCheckAt: last?.completedAt ?? null,
    lastCheckFailedSources:
      last?.results.filter((r) => !['unchanged', 'changed', 'first_seen'].includes(r.status))
        .length ?? 0,
    pendingSourceUpdates: tasks.filter((t) => t.status === 'pending_review').length,
  };
}
export async function checkSources(options: MonitorOptions) {
  const registry = registrySchema.parse(JSON.parse(await readFile(options.registryFile, 'utf8'))),
    base = path.dirname(path.resolve(options.registryFile));
  const selected = registry.sources.filter((s) => !options.sourceId || s.id === options.sourceId);
  if (!selected.length) throw new Error('来源编号不存在');
  const timeout = options.timeoutMs ?? 15000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120000)
    throw new Error('来源超时须为1—120000毫秒');
  const get = options.fetcher ?? fetch,
    extract = options.pdfText ?? pdfText;
  return withMonitorLock(options.directory, async () => {
    const results: CheckResult[] = [];
    async function download(url: string, referer?: string) {
      const response = await get(url, {
        headers: {
          'User-Agent': 'SilverEvidenceSourceCheck/0.1',
          ...(referer ? { Referer: referer } : {}),
        },
        signal: AbortSignal.timeout(timeout),
      });
      if (!response.ok)
        throw Object.assign(new Error(`HTTP ${response.status}`), { httpStatus: response.status });
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 20 * 1024 * 1024) throw new Error('来源超过20MiB检查上限');
      return buffer;
    }
    async function attach(bytes: Buffer, url: string, save: boolean): Promise<Attachment> {
      const format =
        bytes.subarray(0, 5).toString() === '%PDF-'
          ? 'pdf'
          : bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
            ? 'office-zip'
            : bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
              ? 'office-ole'
              : null;
      if (!format) throw new Error('附件不是支持的PDF/Office文件，不能把错误页当原件');
      let text = null,
        textStatus = format === 'pdf' ? 'no_text_layer' : 'not_supported_hash_only';
      if (format === 'pdf')
        try {
          text = await extract(bytes);
          textStatus = text ? 'extracted' : 'no_text_layer';
        } catch {
          textStatus = 'extraction_failed_hash_only';
        }
      const stored = save
        ? await blob(options.directory, bytes, format === 'pdf' ? 'pdf' : 'office')
        : null;
      return { url, hash: sha256(bytes), blob: stored?.file ?? null, text, textStatus, format };
    }
    function observation(
      bytes: Buffer,
      body: string,
      attachments: Attachment[],
      pagePublishedAt: string | null,
      rawBlob: string | null,
    ): Observation {
      const bodyHash = sha256(body),
        fingerprint = sha256(
          JSON.stringify({
            bodyHash,
            attachments: attachments.map((a) => a.hash).sort(),
            pagePublishedAt,
          }),
        );
      return {
        fingerprint,
        body,
        bodyHash,
        rawHash: sha256(bytes),
        blob: rawBlob,
        attachments,
        pagePublishedAt,
      };
    }
    for (const s of selected) {
      const checkedAt = new Date().toISOString();
      let phase = 'fetch_failed',
        rawRecord: { hash: string; file: string } | undefined;
      try {
        const bytes = await download(s.url),
          raw = await blob(options.directory, bytes, s.format);
        rawRecord = raw;
        phase = 'parse_failed';
        const page =
          s.format === 'html'
            ? parsePage(bytes.toString('utf8'), s)
            : { body: '', attachmentUrls: [s.url], pagePublishedAt: null };
        const errors: { url: string; error: string }[] = [],
          attachments: Attachment[] = [];
        for (const url of page.attachmentUrls) {
          try {
            attachments.push(
              await attach(s.format === 'pdf' ? bytes : await download(url, s.url), url, true),
            );
          } catch (e) {
            errors.push({ url, error: e instanceof Error ? e.message : String(e) });
          }
        }
        if (errors.length) {
          results.push({
            sourceId: s.id,
            status: 'attachment_fetch_failed',
            checkedAt,
            attachmentErrors: errors,
            rawHash: raw.hash,
            rawSnapshot: raw.file,
            bodyHash: sha256(page.body),
          });
          continue;
        }
        const stateFile = path.join(options.directory, 'state', s.id + '.json');
        let previous = await readJson<Observation>(stateFile),
          attachmentBaselineUnavailable = false;
        if (!previous && s.baseline) {
          const old = await readFile(path.resolve(base, s.baseline.file));
          const oldPage =
            s.format === 'html'
              ? parsePage(old.toString('utf8'), s)
              : { body: '', pagePublishedAt: null, attachmentUrls: [] };
          attachmentBaselineUnavailable =
            oldPage.attachmentUrls.length > s.baseline.attachments.length;
          const originalAttachments = [];
          for (const a of s.baseline.attachments)
            originalAttachments.push(
              await attach(await readFile(path.resolve(base, a.file)), a.url, true),
            );
          if (s.format === 'pdf' && !originalAttachments.length)
            originalAttachments.push(await attach(old, s.url, true));
          const oldBlob = await blob(options.directory, old, s.format);
          previous = observation(
            old,
            oldPage.body,
            originalAttachments,
            oldPage.pagePublishedAt,
            oldBlob.file,
          );
        }
        const attachmentMissing = Boolean(
          (s.attachmentRequired && !attachments.length) ||
          (previous && previous.attachments.length > attachments.length),
        );
        const current = observation(bytes, page.body, attachments, page.pagePublishedAt, raw.file);
        const extractionFailed = attachments.some(
          (a) => a.textStatus === 'extraction_failed_hash_only',
        );
        const quality = {
          attachmentText: attachments.map(({ url, hash, textStatus }) => ({
            url,
            hash,
            textStatus,
          })),
          ...(extractionFailed ? { error: 'PDF正文提取失败；保留文件哈希及原件，须人工核对' } : {}),
        };
        current.generation = previous?.generation ?? 0;
        if (previous?.fingerprint === current.fingerprint) {
          results.push({
            sourceId: s.id,
            status: extractionFailed ? 'parse_failed' : 'unchanged',
            contentStatus: 'unchanged',
            ...quality,
            checkedAt,
            fingerprint: current.fingerprint,
            rawHash: raw.hash,
            rawSnapshot: raw.file,
            bodyHash: current.bodyHash,
          });
          await atomic(stateFile, current);
          continue;
        }
        const before = previous ?? observation(Buffer.alloc(0), '', [], null, null);
        current.generation = (before.generation ?? 0) + 1;
        const id = sha256(
            s.id +
              ':' +
              (before.generation ?? 0) +
              ':' +
              before.fingerprint +
              ':' +
              current.fingerprint,
          ),
          taskFile = path.join(options.directory, 'tasks', id + '.json');
        const changes = [
          ...(before.bodyHash !== current.bodyHash ? ['page_body_changed'] : []),
          ...(JSON.stringify(before.attachments.map((a) => a.hash).sort()) !==
          JSON.stringify(current.attachments.map((a) => a.hash).sort())
            ? [
                attachmentBaselineUnavailable || !previous
                  ? 'attachment_first_observed_baseline_unavailable'
                  : 'attachment_changed',
              ]
            : []),
          ...(attachmentMissing ? ['attachment_missing'] : []),
          ...(before.pagePublishedAt !== current.pagePublishedAt
            ? ['page_publication_metadata_changed']
            : []),
        ];
        const textBefore =
            before.body + '\n' + before.attachments.map((a) => a.text ?? '').join('\n'),
          textAfter = current.body + '\n' + current.attachments.map((a) => a.text ?? '').join('\n');
        const task: UpdateTask = {
          id,
          sourceId: s.id,
          documentId: s.documentId,
          status: 'pending_review',
          detectedAt: checkedAt,
          before,
          after: current,
          diff: compareLines(textBefore, textAfter),
          changes,
          pageChangeDetectedAt: checkedAt,
          documentPublication: { observedPageDate: page.pagePublishedAt, status: 'needs_review' },
          policyEffectivity: {
            declaredEffectiveFrom: s.declaredEffectiveFrom,
            status: 'not_inferred_from_page',
          },
          events: [],
        };
        if (!(await readJson(taskFile))) await atomic(taskFile, task);
        const snapshotFile = path.join(
          options.directory,
          'snapshots',
          s.id,
          current.fingerprint + '.json',
        );
        if (!(await readJson(snapshotFile))) await atomic(snapshotFile, current);
        if (!attachmentMissing) await atomic(stateFile, current);
        results.push({
          sourceId: s.id,
          status: attachmentMissing
            ? 'attachment_missing'
            : extractionFailed
              ? 'parse_failed'
              : previous
                ? 'changed'
                : 'first_seen',
          contentStatus: previous ? 'changed' : 'first_seen',
          ...quality,
          checkedAt,
          fingerprint: current.fingerprint,
          taskId: id,
          rawHash: raw.hash,
          rawSnapshot: raw.file,
          bodyHash: current.bodyHash,
        });
      } catch (e) {
        results.push({
          sourceId: s.id,
          status: phase,
          checkedAt,
          error: e instanceof Error ? e.message : String(e),
          httpStatus: (e as { httpStatus?: number }).httpStatus,
          rawHash: rawRecord?.hash,
          rawSnapshot: rawRecord?.file,
        });
      }
    }
    const report = {
      id: randomUUID(),
      startedFor: selected.map((s) => s.id),
      completedAt: new Date().toISOString(),
      results,
    };
    await atomic(path.join(options.directory, 'checks', report.id + '.json'), report);
    await atomic(path.join(options.directory, 'last-check.json'), report);
    return report;
  });
}
export async function resolveTask(
  directory: string,
  id: string,
  input: {
    decision: 'dismissed' | 'published';
    actor: string;
    reason: string;
    documentVersion?: number;
  },
  verifyPublication?: (task: UpdateTask, version: number) => Promise<boolean>,
) {
  if (!/^[a-f0-9]{64}$/.test(id) || !input.actor.trim() || !input.reason.trim())
    throw new Error('任务、操作者及原因必须有效');
  return withMonitorLock(directory, async () => {
    const file = path.join(directory, 'tasks', id + '.json'),
      task = await readJson<UpdateTask>(file);
    if (!task) throw new Error('更新任务不存在');
    if (
      input.decision === 'published' &&
      (!Number.isSafeInteger(input.documentVersion) ||
        input.documentVersion! < 1 ||
        !verifyPublication ||
        !(await verifyPublication(task, input.documentVersion!)))
    )
      throw new Error('须先用已有import/publish流程发布准确来源文件版本，再关联更新任务');
    task.events.push({
      at: new Date().toISOString(),
      actor: input.actor,
      reason: input.reason,
      decision: input.decision,
      documentVersion: input.documentVersion,
    });
    task.status = input.decision;
    await atomic(file, task);
    return task;
  });
}
