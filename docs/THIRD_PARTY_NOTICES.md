# 新增解析依赖说明

通过npm安装依赖，未复制上游实现到src；完整版本、传递依赖、来源和校验见backend/package-lock.json。镜像使用npm ci --omit=dev，保留包携带的LICENSE/NOTICE，不剥除许可证。

|依赖|锁定版本|许可证|实际读取位置|用途|
|---|---|---|---|---|
|cheerio|1.2.0|MIT；Copyright (c) 2022 The Cheerio contributors|node_modules/cheerio/LICENSE、package.json|提取登记页面正文和附件链接|
|pdfjs-dist|6.5.438|Apache-2.0|node_modules/pdfjs-dist/LICENSE、package.json、types|提取PDF文字层，不冒充OCR|

上述路径均位于backend。完整许可证随npm包保留；以后以其它方式分发库时，应保留完整许可证及上游NOTICE（如有）并遵守适用条款。官方政策HTML/PDF作为来源证据归档并记录来源、获取日及哈希，没有复制政府网页应用代码。
