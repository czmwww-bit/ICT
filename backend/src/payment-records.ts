import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { date, recordMonth } from './model.js';
import { findCandidates, findInSnapshot, type Snapshot } from './query.js';
export const paymentRecordInputSchema = z
  .object({
    matterId: z.string().min(1),
    regionCode: z.string().min(1),
    recordMonth,
    ageBandCode: z.string().min(1),
    asOf: date,
  })
  .strict();
export type PaymentRecordInput = z.infer<typeof paymentRecordInputSchema>;
function selectRecords(
  hits: Awaited<ReturnType<typeof findCandidates>>,
  input: PaymentRecordInput,
) {
  const matching = hits.filter(
    (h) =>
      h.clause.paymentRecord &&
      h.clause.paymentRecord.ageBandCode === input.ageBandCode &&
      h.clause.paymentRecord.fromMonth !== null &&
      h.clause.paymentRecord.toMonth !== null &&
      h.clause.paymentRecord.fromMonth <= input.recordMonth &&
      h.clause.paymentRecord.toMonth >= input.recordMonth,
  );
  return {
    requestedMonth: input.recordMonth,
    regionCode: input.regionCode,
    ageBandCode: input.ageBandCode,
    monthly: matching.filter((h) => h.clause.paymentRecord!.kind === 'monthly_statistics'),
    periodContext: matching.filter((h) => h.clause.paymentRecord!.kind === 'quarterly_disclosure'),
    unresolvedPeriod: hits.filter(
      (h) =>
        h.clause.paymentRecord?.ageBandCode === input.ageBandCode &&
        h.clause.paymentRecord.fromMonth === null,
    ),
    policyAdjustmentEffectiveDate: null,
    retroactiveDifferenceRule: null,
    warning:
      '只返回所问月份记录和明确的季度上下文，不外推全年标准，不判断个人资格、提标生效日或是否补发。缺少月报不回退到最近金额。',
  };
}
export function paymentRecordsInSnapshot(snapshot: Snapshot, input: PaymentRecordInput) {
  const parsed = paymentRecordInputSchema.parse(input);
  return selectRecords(findInSnapshot(snapshot, parsedQuery(parsed)), parsed);
}
const parsedQuery = (input: PaymentRecordInput) => ({
  matterId: input.matterId,
  regionCode: input.regionCode,
  asOf: input.asOf,
});
export async function findPaymentRecords(db: Pool, input: PaymentRecordInput) {
  const parsed = paymentRecordInputSchema.parse(input);
  return selectRecords(await findCandidates(db, parsedQuery(parsed)), parsed);
}
