// 消费成员②已识别的标题/文字；不读取图片、不识别意图、不点击或提交。
import { z } from 'zod';

const stepSchema = z.object({
  id: z.string(),
  pageTitle: z.string(),
  requiredTexts: z.array(z.string()).min(1),
  priority: z.number(),
  pageName: z.string(),
  evidenceIds: z.array(z.string()).min(1),
  action: z.object({
    type: z.enum(['tap', 'scroll_down', 'scroll_up']),
    targetLabel: z.string().nullable(),
    instruction: z.string(),
  }),
  expectedAfter: z.object({
    title: z.string().nullable(),
    confirmed: z.literal(false),
    check: z.string(),
  }),
});
export const flowSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  version: z.number().int().positive(),
  reviewStatus: z.literal('pending'),
  deviceWalkthroughCompleted: z.literal(false),
  imageRecognitionImplemented: z.literal(false),
  states: z.array(stepSchema).min(1),
  wrongPage: z.object({
    pageTitle: z.string(),
    instruction: z.string(),
    action: z.literal('ask_user_to_go_back'),
  }),
  fallback: z.object({ instruction: z.string(), action: z.literal('request_screenshot_or_task') }),
});
export const observationSchema = z
  .object({
    taskId: z.string().max(100),
    pageTitle: z.string().max(100),
    visibleTexts: z.array(z.string().max(200)).max(100),
    recognitionStatus: z.enum(['ok', 'uncertain']),
  })
  .strict();
export type PageObservation = z.infer<typeof observationSchema>;
const normalize = (s: string) => s.replace(/\s+/gu, '');

export function nextOperation(rawFlow: unknown, rawObservation: unknown) {
  const flow = flowSchema.parse(rawFlow),
    input = observationSchema.parse(rawObservation);
  const base = {
    flowId: flow.id,
    flowVersion: flow.version,
    reviewStatus: flow.reviewStatus,
    deviceWalkthroughCompleted: false,
    automaticTapEnabled: false,
    bindingResult: 'unknown',
  };
  const fallback = (reason: string) => ({
    ...base,
    status: 'needs_screenshot_or_task',
    reason,
    pageId: null,
    evidenceIds: [] as string[],
    nextStep: {
      type: flow.fallback.action,
      targetLabel: null,
      instruction: flow.fallback.instruction,
    },
    expectedAfter: null,
  });
  if (input.taskId !== flow.id) return fallback('unsupported_task');
  if (input.recognitionStatus !== 'ok') return fallback('recognition_uncertain');
  const title = normalize(input.pageTitle);
  if (title === normalize(flow.wrongPage.pageTitle))
    return {
      ...base,
      status: 'wrong_page',
      reason: 'binding_form_is_not_query',
      pageId: 'WRONG_BIND_FORM',
      evidenceIds: ['USER_YB_BIND_FORM_0926'],
      nextStep: {
        type: flow.wrongPage.action,
        targetLabel: null,
        instruction: flow.wrongPage.instruction,
      },
      expectedAfter: null,
    };
  const texts = new Set(input.visibleTexts.map(normalize));
  const matches = flow.states
    .filter(
      (s) =>
        normalize(s.pageTitle) === title && s.requiredTexts.every((t) => texts.has(normalize(t))),
    )
    .sort((a, b) => b.priority - a.priority);
  if (!matches.length) return fallback('unknown_page_or_missing_anchors');
  if (matches[1]?.priority === matches[0]!.priority) return fallback('ambiguous_page');
  const state = matches[0]!;
  return {
    ...base,
    status: 'step_available_pending_device_review',
    reason: null,
    pageId: state.id,
    pageName: state.pageName,
    evidenceIds: state.evidenceIds,
    nextStep: state.action,
    expectedAfter: state.expectedAfter,
  };
}
