import type { ImpactReport, ImpactHit } from './impact-preview.js';
const escape = (s: unknown) =>
  String(s ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ');
const list = (hits: ImpactHit[]) =>
  hits.length
    ? hits
        .map(
          (h) =>
            `${h.id}@${h.version}${h.clause.paymentRecord ? `（${h.clause.paymentRecord.amountYuanPerPersonMonth ?? '未知'}元/人·月，${h.clause.paymentRecord.fromMonth ?? '期间待核'}）` : ''}`,
        )
        .join('；')
    : '无命中';
const assumptionLabel = (a: { stage: string; documentId: string; fields: string[] }) =>
  `${a.stage} ${a.documentId}: ${a.fields.join('/')}`;
export function impactMarkdown(report: ImpactReport) {
  const rows = report.results.map(
    (r: any) =>
      `|${escape(r.id + ' ' + r.description)}|${escape(r.before.executed ? list(r.before.hits) : '未查询：需补参数')}|${escape(r.after.executed ? list(r.after.hits) : '未查询：需补参数')}|${escape(r.reasons.join('；'))}|${escape(r.pending.join('；') || '未发现额外字段缺口；政策语义仍需人工审核')}|`,
  );
  const details = report.results.map((r: any) => {
    const versionChanges =
      r.diff.versionChanged.map((v: any) => `${v.id} ${v.before}→${v.after}`).join('；') || '无';
    const causes =
      r.causes
        .map(
          (c: any) =>
            `- ${c.clauseId}：触发资料${c.trigger ? JSON.stringify(c.trigger) : '见前后来源'}；字段${c.fields.join('、') || '命中集合变化'}`,
        )
        .join('\n') || '无资料变化';
    const hitDetails = (hits: ImpactHit[]) =>
      hits
        .map(
          (h) =>
            `#### ${h.id}@${h.version}\n\n类别：${h.category}；事项：${h.clause.matterId}；地区：${h.clause.regionCodes.join('、')}；政策适用时间：${h.clause.effectiveFrom ?? '未知'}至${h.clause.effectiveTo ?? '未知'}。\n\n来源：${h.document.id}@${h.document.version}，${h.document.publisher}，[${h.document.title}](${h.source.url})；网页公开${h.document.publishedAt ?? '未知'}；位置：${h.source.locator}\n\n关键字段：\n\n\`\`\`json\n${JSON.stringify({ paymentRecord: h.clause.paymentRecord ?? null, population: h.clause.population, conditions: h.clause.conditions, actions: h.clause.actions, materials: h.clause.materials, channels: h.clause.channels, contacts: h.clause.contacts, schedule: h.clause.schedule, location: h.clause.location, relations: h.clause.relations }, null, 2)}\n\`\`\`\n\n原文：\n\n${h.source.quote
              .split('\n')
              .map((s) => (s ? '> ' + s.trimEnd() : '>'))
              .join('\n')}\n`,
        )
        .join('\n') || '无命中。';
    return `## ${r.id} ${r.description}\n\n查询参数（两边完全相同）：\n\n\`\`\`json\n${JSON.stringify(r.before.parameters, null, 2)}\n\`\`\`\n\n变化：新增${r.diff.added.join('、') || '无'}；减少${r.diff.removed.join('、') || '无'}；版本${versionChanges}。\n\n${causes}\n\n待确认：${r.pending.join('；') || '政策语义仍需人工核实'}\n\n### 更新前\n\n${hitDetails(r.before.hits)}\n### 模拟发布后\n\n${hitDetails(r.after.hits)}\n`;
  });
  return `# 政策更新影响预览\n\n运行时间：${report.executedAt}\n\n模式：${report.mode === 'demo_augmented_project_snapshot' ? '演示基线：项目当前快照＋显式指定的隔离夹具，不是真实审核发布状态' : '项目库当前快照，未额外注入演示基线'}。当前项目快照中已审核正式条款版本数：${report.currentOfficialApprovedClauses}。\n\n测试集：${report.suiteVersion}；基线指纹：${report.currentSnapshotSha256}。\n\n范围：${report.scope}。此预览不判断个人资格、政策结论、提标或补发差额。\n\n${report.summary.cases}个用例，变化${report.summary.changed}，无变化${report.summary.unchanged}；实际执行${report.summary.executedQueryPairs}对查询，缺参数${report.summary.needsParameters}，预期校验失败${report.summary.expectationFailures}。\n\n正式项目库7表逐行摘要前后一致：${report.sourceDatabaseUnchanged}；隔离表成功清理：${report.testTablesCleaned}。迁移、导入和发布都只在隔离库执行。\n\n假定核对字段：${report.assumptions.length ? report.assumptions.map(assumptionLabel).join('；') : '无'}。这些只是隔离预览标签，不代表人工审核；相同旧版本缺少核对字段时会停止，不覆写。\n\n|用例|更新前命中|模拟发布后命中|变化原因|待确认项|\n|---|---|---|---|---|\n${rows.join('\n')}\n\n${details.join('\n')}\n`;
}
