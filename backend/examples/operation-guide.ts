import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { nextOperation } from '../src/operation-guide.js';
const { values } = parseArgs({
  options: {
    observation: { type: 'string' },
    input: { type: 'string' },
    out: { type: 'string' },
  },
});
if (Boolean(values.observation) === Boolean(values.input))
  throw new Error('请选择 --observation 截图观察编号 或 --input OCR适配JSON；不接受原始证件信息');
const root = '../data/official/yunnan-medical-insurance/';
const flow = JSON.parse(await readFile(root + 'operation-guide/family-query.flow.json', 'utf8'));
let input: unknown;
if (values.input) input = JSON.parse(await readFile(values.input, 'utf8'));
else {
  const navigation = JSON.parse(await readFile(root + 'navigation.entries.json', 'utf8'));
  const shot = navigation.screenshots.find((s: { id: string }) => s.id === values.observation);
  if (!shot) throw new Error('未知截图观察编号');
  input = {
    taskId: flow.id,
    pageTitle: shot.pageTitle,
    visibleTexts: shot.visibleLabels ?? shot.visibleInputLabels ?? [],
    recognitionStatus: 'ok',
  };
}
const report = {
  executedAt: new Date().toISOString(),
  inputMode: values.input ? 'recognized_text_adapter' : 'transcribed_screenshot_observation',
  imageRecognitionExecuted: false,
  result: nextOperation(flow, input),
};
if (values.out) await writeFile(values.out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
