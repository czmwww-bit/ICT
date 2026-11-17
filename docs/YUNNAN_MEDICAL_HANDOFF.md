# 云南医保资料与操作入口交接

入口：[资料包README](../data/official/yunnan-medical-insurance/README.md)、[优先核对](../data/official/yunnan-medical-insurance/REVIEW_OVERVIEW.md)。本轮收集并编排资料，全部待审；没有重做界面或替②实现业务判断。

①②优先看`navigation.entries.json`：普通首页→个人账户共济绑定；首页关怀模式→长者专区→个人账户共济查询和解绑。用户说“我想看看孩子有没有帮我绑好”是查询意图的人工标注例子，不是新绑/解绑请求。素材按当前页列一个动作；未见结果页就追问无敏感值的提示，不宣称已绑定成功。

③提供原文/版本/来源与入口观察；②识别问题、选择证据、判断何时追问及解释结果；①呈现当前一步与语音交互。入口/术语素材不代表已实现识别模型。先按体验清单实际测试原有问答和语音，再决定补什么能力；当前没有实机体验记录。

数据：20文件/50条款、10事项、16例开发情景（全pending）。21官方HTML、59素材已归档；7500段Word只读文本未渲染。两张2027原图选录转写待核，旧2026纯图不进主批次。截图是用户观察，未伪填官网URL，也未装成已归档原件。

给②：整个backend依赖/锁文件及`src/{db,model,store,query}.ts`、本次`examples/query-medical.ts`、医保批次/元数据/入口、`eval/real/yunnan-medical-development.cases.json`与case-review。核心函数字段沿用，不另起业务服务器。注意旧`query-view.ts`的隆阳试点提示不能作为全省医保判断，医保示例直接复用核心查询。

```powershell
Set-Location D:\ICT\backend
npm.cmd run demo:medical -- --isolated --matter YB_FAMILY_QUERY --region 530502 --date 2026-11-17
npm.cmd run demo:medical -- --isolated --id BS_YB_FAMILY_QUERY_RECORDS --version 1
```

本机实测14项隔离查询/日期/版本检查通过，2条候选及1条准确版本；项目库摘要不变，源测试表成功清理。原26项单元/HTTP测试通过，类型及构建通过；预检查计划新增70、0错误。16例业务109项未执行，原问答/语音、队友机器和云端仍待验证，不当作系统准确率。

双方需确认：登录人/授权人/使用人角色、参保统筹区与行政区、普通/关怀模式、当前页及结果摘要字段；医保与税务/国家APP的跳转边界；保障年度和操作日期；只查与解绑的明确意图边界。请先补不含敏感值的结果页及实机体验记录，再逐条审核发布。
