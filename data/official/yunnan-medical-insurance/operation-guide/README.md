# 个人账户共济查询：当前页面的下一步

本包把既有截图观察转换为可调用的步骤资料。只做“看看家人是否已经帮我绑定”这一项，成员②选定任务并识别截图文字后调用；不新增 OCR、意图判断、政策结论或自动操作。

**当前完成的是可独立测试的文字适配原型。没有接入手机，未完成实机全流程，不具备3—5个已走通页面的验收条件。** 五张聊天图记录的是三个页面标题（首页、绑定表单、长者专区），其中长者专区有三个滚动位置，不能称作五个页面。原图未取得本地文件路径，演示输入是按截图转录的观察记录，不能计作图片识别准确率。

|当前画面|准确辨认文字|一次只做一件事|下一画面怎样核对|
|---|---|---|---|
|云南医保首页|标题“云南医保”，同时见“个人账户共济绑定”和“关怀模式”|点“关怀模式”|用户报告通往长者专区，完整跳转未实测；若有中间菜单就补图|
|长者专区上部|标题“长者专区”，同时见“个人参保信息查询”和“参保缴费信息查询”|向下滑一点|看见“个人账户共济查询和解绑”，不按固定次数滑动|
|查询入口可见|标题“长者专区”，完整按钮“个人账户共济查询和解绑”|点该入口，先看记录|结果页未取得，必须补图，不猜成功或失败|
|长者专区下部|标题“长者专区”，同时见“药品目录查询”和“经办机构查询”|向上滑一点|重新看见目标按钮再继续|
|误入绑定表单|标题“个人账户共济绑定”|说明走错，提示返回上一页|不填表、不新建绑定|
|不认识/文字不确定|标题缺失、锚点不足、未知别名、结果页未登记|请补脱敏截图或重选任务|不猜按钮，不解释尚未看到的结果|

`family-query.flow.json`保留每个画面的证据编号、辨认锚点、动作和未确认的点击结果。匹配只去除换行和空格；同名按钮出现在别的页面不匹配。目标已经可见时优先点目标，不继续向下滑。每个输出仅一个`nextStep`，始终`automaticTapEnabled:false`和`bindingResult:unknown`。

## 本机演示（PowerShell）

```powershell
Set-Location D:\ICT\backend
# 长者专区上部：应提示向下滑
npm.cmd run demo:operation -- --observation USER_YB_ELDER_TOP_0932
# 目标可见：应提示点“个人账户共济查询和解绑”
npm.cmd run demo:operation -- --observation USER_YB_ELDER_MIDDLE_0932
# 一次识别失败回退
npm.cmd run demo:operation -- --input ../data/official/yunnan-medical-insurance/operation-guide/unknown.observation.json
# 重跑5张截图观察和1次未知画面，保存 verification.json
npm.cmd run test:operation
```

其他已有图编号：`USER_YB_HOME_0926`、`USER_YB_ELDER_BOTTOM_0932`、`USER_YB_BIND_FORM_0926`。

成员②提供以下**已识别的文字JSON**，不要传整张图或姓名、证件号等值给此模块：

```json
{
  "taskId": "YN_YB_READONLY_FAMILY_QUERY",
  "pageTitle": "长者专区",
  "visibleTexts": ["个人账户共济查询和解绑"],
  "recognitionStatus": "ok"
}
```

```typescript
import { nextOperation } from './src/operation-guide.js';
// flow = 读取 family-query.flow.json；observation = ②的标题/文字适配结果。
const step = nextOperation(flow, observation);
```

`step_available_pending_device_review`是步骤素材状态，不是业务接口的`ready`；`wrong_page`提示返回；`needs_screenshot_or_task`要求补图或重选。此模块不识别老人意图，②仍需把“孩子帮我绑好没有”选择为只读查询任务。旧版本按钮别名保留在原导航资料中，本原型不据模糊近似自动点选。

## 还缺什么才能验收完整任务

1. 由本人/队友在手机上验证首页到长者专区的真实跳转，保留脱敏截图及时间。
2. 点击查询入口后取得结果页；记录授权/被授权、空记录、错误提示的实际字段，确认一次完整只读查询。
3. 在下面的记录中填写亲测结果，再审核新版本。未核对前不能把`confirmed`改成true，也不能把“有记录”直接当成当前可支付。

|动作|实测日期/机型/小程序版本|点击前后截图本地位置|实际标题和提示|是否相符|核对人|
|---|---|---|---|---|---|
|首页进入关怀模式|未执行|待补|待补|未核对|待填|
|找到并进入查询|未执行|待补|待补|未核对|待填|
|只读结果解释|未执行|待补|待补|未核对|待填|
|未知画面回退|仅文字夹具已验证|unknown.observation.json|请求补图/重选|技术验证，非实机|见技术报告|

原平台智能问答和语音仍按上级目录`EXPERIENCE_CHECKLIST.md`实际体验后记录；不能由本原型推断原功能做不到什么。
