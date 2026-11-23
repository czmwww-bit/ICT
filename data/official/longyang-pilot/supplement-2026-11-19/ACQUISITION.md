# 实际获取结果

原件HTML、获取时刻、SHA256、正文选择器和合并单元格记录见acquisition.json。正文提取曾因选择器失配失败，修正后8份全文可读；原件字节未改，解析过程保留在extractionAttempts。保山Excel转HTML尾部空单元格在派生文本中裁掉，原表单元格含rowspan/colspan保留。机构页合并了多个正文栏，不能只采第一栏总机。

|来源编号|实际状态|HTTP|网页公开时间|地址|
|---|---|---|---|---|
|BS-202601|full_text_retrieved|200|2026-02-08 09:00|[来源](https://www.baoshan.gov.cn/info/6126/10335854.htm)|
|BS-202602|full_text_retrieved|200|2026-03-08 10:15|[来源](https://baoshan.gov.cn/info/6126/10352984.htm)|
|BS-202608|full_text_retrieved|200|2026-09-03 16:07|[来源](https://www.baoshan.gov.cn/info/6126/10396644.htm)|
|BS-202609|full_text_retrieved|200|2026-10-08 10:22|[来源](https://www.baoshan.gov.cn/info/6126/10409514.htm)|
|LY-2026Q2|full_text_retrieved|200|2026-06-23 15:19|[来源](https://www.longyang.gov.cn/info/2861/14118239.htm)|
|LY-MZ-CONTACT|full_text_retrieved|200|未知|[来源](https://longyang.gov.cn/xxgk/bm/lyqmzj/fdzdgknr/zzjg.htm)|
|BS-ECON-202609|full_text_retrieved|200|2026-10-08 10:25|[来源](https://www.baoshan.gov.cn/info/6126/10409524.htm)|
|YN-ELDER-CARD-PRIMARY|fetch_failed|404|未知|[来源](https://ynmz.yn.gov.cn/cms/qitazhengcewenjian/11904.html)|
|HH-ELDER-CARD-INDEX|index_archived|200|未知|[来源](https://www.hh.gov.cn/zfxxgk/fdzdgknr/zdmsxx/ylfw.htm)|
|YN-ECON-CURRENT-INDEX|redirect_page_only|200|未知|[来源](https://ynmz.yn.gov.cn/zwgk/zcwj/)|
|HH-ELDER-CARD-REPRINT|full_text_retrieved|200|2026-01-22 16:56|[来源](https://www.hh.gov.cn/info/30361/1236862.htm)|

省厅优待证旧地址实际返回404；红河州官方全文转载已取得。省厅政策目录入口返回meta Refresh跳转壳，未当作完整目录。公开搜索只用于发现来源，未将搜索摘要装作下载原文。
