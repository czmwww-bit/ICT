import { readFile, writeFile } from 'node:fs/promises';
import { nextOperation } from '../src/operation-guide.js';
const root = '../data/official/yunnan-medical-insurance/';
const flow = JSON.parse(await readFile(root + 'operation-guide/family-query.flow.json', 'utf8'));
const nav = JSON.parse(await readFile(root + 'navigation.entries.json', 'utf8'));
const expected: Record<string, [string, string]> = {
  USER_YB_HOME_0926: ['HOME', 'tap'],
  USER_YB_BIND_FORM_0926: ['WRONG_BIND_FORM', 'ask_user_to_go_back'],
  USER_YB_ELDER_TOP_0932: ['ELDER_TOP', 'scroll_down'],
  USER_YB_ELDER_MIDDLE_0932: ['ELDER_QUERY_VISIBLE', 'tap'],
  USER_YB_ELDER_BOTTOM_0932: ['ELDER_BOTTOM', 'scroll_up'],
};
const inputs = nav.screenshots.map((s: any) => ({
  id: s.id,
  input: {
    taskId: flow.id,
    pageTitle: s.pageTitle,
    visibleTexts: s.visibleLabels ?? s.visibleInputLabels ?? [],
    recognitionStatus: 'ok',
  },
  expectedPage: expected[s.id]?.[0],
  expectedAction: expected[s.id]?.[1],
}));
inputs.push({
  id: 'UNKNOWN_SCREEN',
  input: JSON.parse(await readFile(root + 'operation-guide/unknown.observation.json', 'utf8')),
  expectedPage: null,
  expectedAction: 'request_screenshot_or_task',
});
const results = inputs.map((s: any) => {
  const actual = nextOperation(flow, s.input);
  const checks = [
    { name: 'page', pass: actual.pageId === s.expectedPage },
    {
      name: 'one_action',
      pass: actual.nextStep.type === s.expectedAction && !Array.isArray(actual.nextStep),
    },
    {
      name: 'read_only_and_no_result_guess',
      pass:
        actual.automaticTapEnabled === false &&
        actual.bindingResult === 'unknown' &&
        actual.nextStep.targetLabel !== '解除绑定',
    },
  ];
  return { observationId: s.id, checks, actual, deviceReview: 'pending' };
});
const checks = results.flatMap((r: any) => r.checks);
const report = {
  executedAt: new Date().toISOString(),
  inputMode: 'transcribed_chat_screenshot_observations',
  imageRecognitionExecuted: false,
  originalScreenshotFilesAvailable: false,
  deviceWalkthroughCompleted: false,
  summary: {
    cases: results.length,
    checks: checks.length,
    passed: checks.filter((c: any) => c.pass).length,
    failed: checks.filter((c: any) => !c.pass).length,
  },
  results,
};
await writeFile(root + 'operation-guide/verification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary));
if (report.summary.failed) process.exitCode = 1;
