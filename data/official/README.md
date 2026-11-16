# 正式资料待录入

这里保留空批次模板；隆阳三事项13项来源已整理为[待审核批次](longyang-pilot/README.md)，尚未导入项目库、未发布，不表示人工核对已完成。先看[优先核对表](longyang-pilot/REVIEW_OVERVIEW.md)。原[首批高龄来源](longyang-allowance/README.md)继续归档并被新批次复用，后续只用新批次作为导入入口。不要把 demo 改成 official 用于展示。

1. 小组先确定一个试点区县、事项编码、当地官方区划编码和上下级。
2. 从发布机关官网保存原文、附件、链接、发布日期。扫描件需人工核对文字转写及页码。
3. 按 `../../docs/DATA_MODEL.md` 及 `../batch.schema.json` 填写文件与条款；可参考 demo 的字段形状，但不得复用虚构内容。
4. 没有原文支持的日期、条件、材料、联系方式和新旧关系写 null；保留原始条件文字。
5. 填写 checkedAt/checkedBy，reviewStatus 保持 draft，reviewedAt/reviewedBy 为 null。文件与条款新编号均从版本 1、expectedVersion 0 开始。
6. 先 validate，再连接测试库 dry-run，正式导入后按文件、条款顺序单独人工审核发布。

需要补齐：官方正文或附件、真实来源链接、发布机关及发布日期、适用地区及官方区划依据、生效/失效及修订原文、申请条件与办理信息、核对人和核对日期。缺失内容不阻止保存为草稿，但会影响人工发布判断。
