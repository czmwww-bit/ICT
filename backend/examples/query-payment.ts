import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { withPaymentPreview } from './payment-preview.js';
import { findPaymentRecords, paymentRecordInputSchema } from '../src/payment-records.js';
const { values } = parseArgs({
  options: {
    isolated: { type: 'boolean' },
    month: { type: 'string' },
    region: { type: 'string' },
    matter: { type: 'string', default: 'HIGH_AGE_ALLOWANCE' },
    'age-band': { type: 'string', default: '100_PLUS' },
    date: { type: 'string', default: '2026-11-19' },
    out: { type: 'string' },
  },
});
if (!values.isolated)
  throw new Error('资料待审核，演示必须 --isolated；正式发布后由成员②调用 findPaymentRecords');
const input = paymentRecordInputSchema.parse({
  matterId: values.matter,
  regionCode: values.region,
  recordMonth: values.month,
  ageBandCode: values['age-band'],
  asOf: values.date,
});
const report = await withPaymentPreview((db) => findPaymentRecords(db, input));
if (values.out) {
  await writeFile(
    values.out,
    JSON.stringify({ executedAt: new Date().toISOString(), input, ...report }, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      report: values.out,
      monthly: report.result.monthly.length,
      periodContext: report.result.periodContext.length,
      unresolvedPeriod: report.result.unresolvedPeriod.length,
    }),
  );
} else console.log(JSON.stringify({ input, ...report }, null, 2));
