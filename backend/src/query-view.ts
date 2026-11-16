// 查询演示只解释资料范围与缺项，不输出用户资格或业务ready结论。
import type { Pool } from 'mysql2/promise';
import { snapshot, findInSnapshot, getInSnapshot, ancestorCodes, type Snapshot } from './query.js';
import { readFile } from 'node:fs/promises';
type Input = { matterId: string; regionCode: string; asOf: string; includeDemo?: boolean };
export function explainCandidates(s: Snapshot, input: Input) {
  const hits = findInSnapshot(s, input);
  const registered = s.regions.some((r) => r.code === input.regionCode);
  const pilot = ancestorCodes(s.regions, input.regionCode).has('530502');
  const officialPublished = s.events.some(
    (e) =>
      e.decision === 'approved' &&
      s.versions.some(
        (v) =>
          v.kind === e.kind &&
          v.data.id === e.id &&
          v.data.version === e.version &&
          v.data.dataset === 'official',
      ),
  );
  const status = !registered
    ? !officialPublished && !input.includeDemo
      ? 'not_published'
      : 'region_unknown'
    : !pilot && !input.includeDemo
      ? 'outside_pilot'
      : !hits.length
        ? !officialPublished && !input.includeDemo
          ? 'not_published'
          : 'no_match'
        : hits.some((h) => h.timeStatus === 'needs_review')
          ? 'needs_review'
          : 'matched';
  const messages = {
    not_published: '本库尚无可用的正式审核资料/对应区域登记；不能据此判断用户无资格。',
    region_unknown: '办理地区编码未在本库登记，不能做地区适用判断。',
    outside_pilot: '办理地区超出隆阳试点；即使存在上级通用候选，也需核对当地实施资料。',
    no_match: '此事项、地区和日期下没有可用的审核条款；草稿及未发布版本不会返回。',
    needs_review: '返回候选中有未知生效日期，请核对；候选命中不表示资格已满足。',
    matched: '已返回符合地区和记录时间范围的审核候选；资格和冲突由业务后端判断。',
  };
  return {
    status,
    message: messages[status],
    input,
    count: hits.length,
    candidates: hits.map((h) => present(s, h)),
    dataOnly: true,
  };
}
function present(s: Snapshot, h: NonNullable<ReturnType<typeof getInSnapshot>[number]>) {
  const unknownFields = (
    [
      'population',
      'conditions',
      'materials',
      'schedule',
      'location',
      'channels',
      'contacts',
    ] as const
  ).filter((k) => h.clause[k] === null);
  return {
    ...h,
    applicableRegions: h.clause.regionCodes.map((code) => ({
      code,
      name: s.regions.find((r) => r.code === code)?.name ?? null,
    })),
    time: {
      effectiveFrom: h.clause.effectiveFrom,
      effectiveTo: h.clause.effectiveTo,
      endInclusive: true,
      timeStatus: h.timeStatus,
    },
    unknownFields,
    needsVerification: [
      ...(h.timeStatus === 'needs_review' ? ['生效日期未知'] : []),
      ...(h.unknownEnd ? ['结束日期未知，不表示永久有效'] : []),
      ...(unknownFields.length ? ['列出的字段只表示本条未记录，可能需要关联其他条款'] : []),
    ],
  };
}
export async function showCandidates(db: Pool, input: Input) {
  return explainCandidates(await snapshot(db), input);
}
export async function showClause(db: Pool, id: string, version?: number) {
  const s = await snapshot(db),
    hits = getInSnapshot(s, id, { version, includeHistory: version !== undefined });
  return {
    status: hits.length
      ? hits.some((h) => h.timeStatus === 'needs_review')
        ? 'needs_review'
        : 'matched'
      : 'no_match',
    message: hits.length
      ? '返回准确版本的审核证据，不代表用户资格判断。'
      : '编号不存在或该版本尚未发布；没有返回可用审核证据。',
    id,
    version: version ?? null,
    count: hits.length,
    candidates: hits.map((h) => present(s, h)),
    dataOnly: true,
  };
}
export async function annotateReviewNotes<
  T extends { candidates: { clause: { id: string }; needsVerification: string[] }[] },
>(report: T) {
  let notes: { clauseId: string; question: string }[];
  try {
    notes = JSON.parse(await readFile('../data/official/longyang-pilot/review-items.json', 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
      return { ...report, reviewNotesStatus: 'not_available' };
    throw new Error('人工核对索引读取失败，未将其伪装为空索引');
  }
  return {
    ...report,
    reviewNotesStatus: 'loaded_pending_questions_not_approval',
    candidates: report.candidates.map((c) => ({
      ...c,
      reviewQuestions: notes.filter((n) => n.clauseId === c.clause.id).map((n) => n.question),
    })),
  };
}
