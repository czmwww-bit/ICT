import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { nextOperation } from '../src/operation-guide.js';
const root = '../data/official/yunnan-medical-insurance/';
const flow = JSON.parse(await readFile(root + 'operation-guide/family-query.flow.json', 'utf8'));
const navigation = JSON.parse(await readFile(root + 'navigation.entries.json', 'utf8'));
const input = (pageTitle: string, visibleTexts: string[], recognitionStatus = 'ok') => ({
  taskId: flow.id,
  pageTitle,
  visibleTexts,
  recognitionStatus,
});
test('5张已提供截图观察：每次一个动作，查询入口不变成绑定或解绑', () => {
  const expected: Record<string, string> = {
    USER_YB_HOME_0926: 'HOME',
    USER_YB_BIND_FORM_0926: 'WRONG_BIND_FORM',
    USER_YB_ELDER_TOP_0932: 'ELDER_TOP',
    USER_YB_ELDER_MIDDLE_0932: 'ELDER_QUERY_VISIBLE',
    USER_YB_ELDER_BOTTOM_0932: 'ELDER_BOTTOM',
  };
  for (const shot of navigation.screenshots) {
    const result = nextOperation(
      flow,
      input(shot.pageTitle, shot.visibleLabels ?? shot.visibleInputLabels ?? []),
    );
    assert.equal(result.pageId, expected[shot.id]);
    assert.ok(!Array.isArray(result.nextStep));
    assert.equal(result.automaticTapEnabled, false);
    assert.equal(result.bindingResult, 'unknown');
    assert.notEqual(result.nextStep.targetLabel, '解除绑定');
  }
});
test('未知、标题缺失、只看到绑定按钮或OCR不确定均回退，不猜结果', () => {
  for (const i of [
    input('未知页面', ['个人账户共济查询和解绑']),
    input('', ['个人账户共济查询和解绑']),
    input('长者专区', ['个人账户共济绑定']),
    input('共济查询结果', ['绑定成功']),
    input('长者专区', ['个人账户共济查询和解绑'], 'uncertain'),
    { ...input('长者专区', ['个人账户共济查询和解绑']), taskId: 'UNBIND' },
  ]) {
    const r = nextOperation(flow, i);
    assert.equal(r.status, 'needs_screenshot_or_task');
    assert.equal(r.nextStep.targetLabel, null);
    assert.equal(r.bindingResult, 'unknown');
  }
});
test('按钮已可见时优先直接查看；文字换行兼容，模糊别名不自动点', () => {
  const r = nextOperation(
    flow,
    input('长者专区', ['个人参保信息查询', '参保缴费信息查询', '个人账户共济\n查询和解绑']),
  );
  assert.equal(r.pageId, 'ELDER_QUERY_VISIBLE');
  assert.equal(r.nextStep.type, 'tap');
  assert.equal(r.nextStep.targetLabel, '个人账户共济查询和解绑');
  assert.equal(r.expectedAfter?.confirmed, false);
  assert.equal(
    nextOperation(flow, input('长者专区', ['个人账户共济授权记录查询'])).status,
    'needs_screenshot_or_task',
  );
});
