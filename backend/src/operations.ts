import type { Pool } from 'mysql2/promise';
import path from 'node:path';
import { snapshot } from './query.js';
import { isApproved } from './store.js';
import { monitorStatus } from './source-monitor.js';
export const monitorDirectory = () =>
  path.resolve(process.env.SOURCE_CHECK_DIR || '../reports/local/source-monitor');
export async function operationsStatus(db: Pool, directory = monitorDirectory()) {
  const s = await snapshot(db),
    heads = new Map<string, (typeof s.versions)[number]>();
  for (const v of s.versions) {
    const k = v.kind + ':' + v.data.id;
    if (!heads.has(k) || heads.get(k)!.data.version < v.data.version) heads.set(k, v);
  }
  const latestDecision = (v: (typeof s.versions)[number]) =>
    s.events
      .filter((e) => e.kind === v.kind && e.id === v.data.id && e.version === v.data.version)
      .at(-1)?.decision;
  const pending = [...heads.values()].filter((v) => latestDecision(v) === undefined);
  const last = s.events
    .filter(
      (e) =>
        e.decision === 'approved' &&
        s.versions.some(
          (v) =>
            v.kind === e.kind &&
            v.data.id === e.id &&
            v.data.version === e.version &&
            v.data.dataset === 'official',
        ),
    )
    .at(-1);
  return {
    application: 'available',
    database: 'connected',
    ...(await monitorStatus(directory)),
    lastSuccessfulOfficialPublicationAt: last?.reviewed_at ?? null,
    versions: s.versions.length,
    officialVersions: s.versions.filter((v) => v.data.dataset === 'official').length,
    pendingDatabaseRecords: {
      official: pending.filter((v) => v.data.dataset === 'official').length,
      demo: pending.filter((v) => v.data.dataset === 'demo').length,
    },
    rejectedDatabaseRecords: [...heads.values()].filter((v) => latestDecision(v) === 'rejected')
      .length,
    note: '仅统计本库及指定检查目录；未导入的JSON草稿不计入数据库待审数量。',
  };
}
