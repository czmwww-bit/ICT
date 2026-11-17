import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  checkSources,
  listTasks,
  resolveTask,
  parsePage,
  registrySchema,
} from '../src/source-monitor.js';
const html = (body: string, date = '2026-01-01', extra = '') =>
  `<nav>${Math.random()}</nav><meta name="PubDate" content="${date}"><article><p>${body}</p>${extra}</article>`;

test('必须有附件的来源即使正文哈希未变，首次缺失也不能标无变化', async () => {
  const s = await setup();
  await writeFile(
    s.registryFile,
    JSON.stringify({ schemaVersion: 1, sources: [{ ...s.source, attachmentRequired: true }] }),
  );
  const fetcher = (async () => new Response(html('政策原文'))) as typeof fetch;
  for (let i = 0; i < 2; i++)
    assert.equal((await checkSources({ ...s, fetcher })).results[0]!.status, 'attachment_missing');
  assert.equal((await listTasks(s.directory)).length, 1);
});

test('正文外官方附件列表需显式选择，7份Word通过独立附件选择器发现', () => {
  const s = registrySchema.parse({
    schemaVersion: 1,
    sources: [
      {
        id: 'C11',
        documentId: 'YN_CONSUMPTION_2026_4',
        url: 'https://example.invalid/policy',
        format: 'html',
        selector: 'article',
        attachmentSelector: '.dtl-txt > span a[href]',
      },
    ],
  }).sources[0]!;
  const links = Array.from(
    { length: 7 },
    (_, i) => `<a href="/virtual_attach_file.vsb?id=${i}">${i + 1}.官方附件.doc</a>`,
  ).join('');
  const page = parsePage(
    `<nav><a href="/navigation.doc">导航</a></nav><div class="dtl-txt"><article><p>政策正文</p></article><span>${links}</span></div>`,
    s,
  );
  assert.equal(page.attachmentUrls.length, 7);
  assert.equal(page.body, '政策正文');
  assert.ok(
    page.attachmentUrls.every((u) =>
      u.startsWith('https://example.invalid/virtual_attach_file.vsb'),
    ),
  );
});

test('PDF解析失败与文件无变化分别呈现，不能把正文核对计作成功', async () => {
  const s = await setup(),
    bytes = Buffer.from('%PDF-1.4\nmock parser failure');
  const file = path.join(s.dir, 'original.pdf');
  await writeFile(file, bytes);
  await writeFile(
    s.registryFile,
    JSON.stringify({
      schemaVersion: 1,
      sources: [{ ...s.source, format: 'pdf', baseline: { file } }],
    }),
  );
  const report = await checkSources({
    ...s,
    fetcher: (async () => new Response(bytes)) as typeof fetch,
    pdfText: async () => {
      throw new Error('cannot parse');
    },
  });
  assert.equal(report.results[0]!.status, 'parse_failed');
  assert.equal(report.results[0]!.contentStatus, 'unchanged');
  assert.equal(report.results[0]!.attachmentText![0]!.textStatus, 'extraction_failed_hash_only');
  assert.ok(report.results[0]!.rawHash);
  assert.equal((await listTasks(s.directory)).length, 0);
});
async function setup() {
  const root = path.resolve('../reports/local/monitor-unit');
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(path.join(root, 'case-')),
    baseline = path.join(dir, 'original.html'),
    registryFile = path.join(dir, 'registry.json'),
    directory = path.join(dir, 'runtime');
  await writeFile(baseline, html('政策原文'));
  const source = {
    id: 'MOCK_SOURCE',
    documentId: 'DEMO_D1',
    url: 'https://example.invalid/notice',
    format: 'html',
    selector: 'article',
    baseline: { file: baseline },
    declaredEffectiveFrom: null,
  };
  await writeFile(registryFile, JSON.stringify({ schemaVersion: 1, sources: [source] }));
  return { dir, directory, registryFile, source };
}
test('更新检查忽略导航变化；正文变更保留完整增删，重复及并发不重复建任务', async () => {
  const s = await setup();
  let text = html('政策原文');
  const fetcher = (async () => new Response(text)) as typeof fetch;
  assert.equal((await checkSources({ ...s, fetcher })).results[0]!.status, 'unchanged');
  text = html('修改后的政策原文');
  const r = await checkSources({ ...s, fetcher });
  assert.equal(r.results[0]!.status, 'changed');
  const task = (await listTasks(s.directory))[0]!;
  assert.equal(task.status, 'pending_review');
  assert.ok(task.diff.removed.includes('政策原文'));
  assert.ok(task.diff.added.includes('修改后的政策原文'));
  assert.equal(task.policyEffectivity.declaredEffectiveFrom, null);
  assert.equal((await checkSources({ ...s, fetcher })).results[0]!.status, 'unchanged');
  assert.equal((await listTasks(s.directory)).length, 1);
  text = html('再次修改');
  const concurrent = await Promise.allSettled([
    checkSources({ ...s, fetcher }),
    checkSources({ ...s, fetcher }),
  ]);
  assert.equal(concurrent.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await listTasks(s.directory)).length, 2);
  await assert.rejects(
    resolveTask(
      s.directory,
      task.id,
      { decision: 'published', actor: '测试', reason: '尚未发布', documentVersion: 2 },
      async () => false,
    ),
    /须先/,
  );
  await resolveTask(
    s.directory,
    task.id,
    { decision: 'published', actor: '隔离测试', reason: '关联已发布测试版本', documentVersion: 2 },
    async () => true,
  );
  assert.equal((await listTasks(s.directory)).find((t) => t.id === task.id)!.events.length, 1);
  text = html('政策原文');
  await checkSources({ ...s, fetcher });
  text = html('修改后的政策原文');
  await checkSources({ ...s, fetcher });
  assert.equal(
    (await listTasks(s.directory)).length,
    4,
    '回退后再次变化是新事件，不复用过去已经完成的任务',
  );
});
test('PDF附件哈希/正文变化与附件缺失分别记录，缺失重复检查保持幂等', async () => {
  const s = await setup(),
    pdf = path.join(s.dir, 'original.pdf'),
    link = '<a href="file.pdf">通知.pdf</a>';
  await writeFile(pdf, '%PDF-old');
  await writeFile(path.join(s.dir, 'original.html'), html('政策原文', '2026-01-01', link));
  s.source.baseline = {
    file: path.join(s.dir, 'original.html'),
    attachments: [{ url: 'https://example.invalid/file.pdf', file: pdf }],
  } as typeof s.source.baseline;
  await writeFile(
    s.registryFile,
    JSON.stringify({ schemaVersion: 1, sources: [{ ...s.source, attachmentRequired: true }] }),
  );
  let pdfBytes = '%PDF-new',
    page = html('政策原文', '2026-01-01', link);
  const fetcher = (async (url: string | URL | Request) =>
    new Response(String(url).endsWith('.pdf') ? pdfBytes : page)) as typeof fetch;
  const extract = async (b: Buffer) => (b.toString().includes('old') ? '旧附件正文' : '新附件正文');
  assert.equal(
    (await checkSources({ ...s, fetcher, pdfText: extract })).results[0]!.status,
    'changed',
  );
  let tasks = await listTasks(s.directory);
  assert.ok(tasks[0]!.changes.includes('attachment_changed'));
  assert.ok(tasks[0]!.diff.added.includes('新附件正文'));
  page = html('政策原文');
  assert.equal(
    (await checkSources({ ...s, fetcher, pdfText: extract })).results[0]!.status,
    'attachment_missing',
  );
  await checkSources({ ...s, fetcher, pdfText: extract });
  tasks = await listTasks(s.directory);
  assert.equal(tasks.length, 2);
  pdfBytes = '%PDF-next'; // 变量保留供用例明确附件版本。
});
test('HTTP失败、正文解析失败和附件获取失败不计作无变化', async () => {
  const s = await setup();
  assert.equal(
    (
      await checkSources({
        ...s,
        fetcher: (async () => new Response('fail', { status: 503 })) as typeof fetch,
      })
    ).results[0]!.status,
    'fetch_failed',
  );
  assert.equal(
    (
      await checkSources({
        ...s,
        fetcher: (async () => new Response('<nav>标题但无正文</nav>')) as typeof fetch,
      })
    ).results[0]!.status,
    'parse_failed',
  );
  const page = html('政策原文', '2026-01-01', '<a href="file.pdf">pdf</a>');
  assert.equal(
    (
      await checkSources({
        ...s,
        fetcher: (async (u: string | URL | Request) =>
          String(u).endsWith('.pdf')
            ? new Response('', { status: 404 })
            : new Response(page)) as typeof fetch,
      })
    ).results[0]!.status,
    'attachment_fetch_failed',
  );
  assert.equal((await listTasks(s.directory)).length, 0);
});
test('网页发布日期变化不会推断政策施行，脚本PDF地址只解析不执行', () => {
  const s = registrySchema.parse({
    schemaVersion: 1,
    sources: [
      {
        id: 'PDF',
        documentId: 'D',
        url: 'https://example.invalid/notice',
        format: 'html',
        selector: 'article',
        attachmentRequired: true,
      },
    ],
  }).sources[0]!;
  const result = parsePage(
    '<meta name="PubDate" content="2026-08-01"><article><script>showVsbpdfIframe("/x.pdf");throw Error("不应执行")</script></article>',
    s,
  );
  assert.equal(result.attachmentUrls[0], 'https://example.invalid/x.pdf');
  assert.equal(result.pagePublishedAt, '2026-08-01');
  assert.equal(result.body, '');
});
test('仅网页发布时间变化和首次取得Office附件不冒充政策生效/已证实修订', async () => {
  const s = await setup();
  await checkSources({
    ...s,
    fetcher: (async () => new Response(html('政策原文', '2026-01-02'))) as typeof fetch,
  });
  let tasks = await listTasks(s.directory);
  assert.deepEqual(tasks[0]!.changes, ['page_publication_metadata_changed']);
  assert.equal(tasks[0]!.policyEffectivity.declaredEffectiveFrom, null);
  const other = await setup(),
    link = '<a href="rules.docx">细则.docx</a>';
  await writeFile(path.join(other.dir, 'original.html'), html('政策原文', '2026-01-01', link));
  const office = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from('test-office-payload'),
  ]);
  const response = await checkSources({
    ...other,
    fetcher: (async (u: string | URL | Request) =>
      String(u).endsWith('docx')
        ? new Response(new Uint8Array(office))
        : new Response(html('政策原文', '2026-01-01', link))) as typeof fetch,
  });
  assert.equal(response.results[0]!.status, 'changed');
  tasks = await listTasks(other.directory);
  assert.ok(tasks[0]!.changes.includes('attachment_first_observed_baseline_unavailable'));
  assert.ok(!tasks[0]!.changes.includes('attachment_changed'));
  assert.equal(tasks[0]!.after.attachments[0]!.textStatus, 'not_supported_hash_only');
});
