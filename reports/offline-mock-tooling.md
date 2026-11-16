# 评测记录：offline-mock-tooling

代码：f36688d6c67a011139c3d12e434ff30562e7a45c+dirty；测试集：demo-v1

资料哈希：0f010e0b65e8e42d8d7ad4967c788dae71bd74e3e643410b8dbfd2c8e1bb8412


自动检查仅核验格式与目录一致性；建议正确性和引用支持关系全部待人工复核。离线目录不证明数据库已发布。
分母为该指标实际执行的检查数；未执行单列；不适用的指标不建立检查项；0/0 不表示通过。

demo: 案例 13，检查通过 52，失败 1，未执行 6，人工复核 13
- status: 11/11；失败 0；未执行 2
- required_fields: 11/11；失败 0；未执行 2
- region_match: 3/3；失败 0；未执行 0
- question: 2/2；失败 0；未执行 0
- materials: 3/3；失败 0；未执行 0
- citation_validity: 5/6；失败 1；未执行 0
- expected_citations: 6/6；失败 0；未执行 0
- forbidden_claims: 11/11；失败 0；未执行 2
- transport: 0/0；失败 0；未执行 0

real: 案例 0，检查通过 0，失败 0，未执行 0，人工复核 0
- status: 0/0；失败 0；未执行 0
- required_fields: 0/0；失败 0；未执行 0
- region_match: 0/0；失败 0；未执行 0
- question: 0/0；失败 0；未执行 0
- materials: 0/0；失败 0；未执行 0
- citation_validity: 0/0；失败 0；未执行 0
- expected_citations: 0/0；失败 0；未执行 0
- forbidden_claims: 0/0；失败 0；未执行 0
- transport: 0/0；失败 0；未执行 0

holdout: 案例 0，检查通过 0，失败 0，未执行 0，人工复核 0
- status: 0/0；失败 0；未执行 0
- required_fields: 0/0；失败 0；未执行 0
- region_match: 0/0；失败 0；未执行 0
- question: 0/0；失败 0；未执行 0
- materials: 0/0；失败 0；未执行 0
- citation_validity: 0/0；失败 0；未执行 0
- expected_citations: 0/0；失败 0；未执行 0
- forbidden_claims: 0/0；失败 0；未执行 0
- transport: 0/0；失败 0；未执行 0

| 案例 | 检查 | 结果 | 原因 |
|---|---|---|---|
| DEMO_E01 | status | pass |  |
| DEMO_E01 | required_fields | pass |  |
| DEMO_E01 | materials | pass |  |
| DEMO_E01 | region_match | pass |  |
| DEMO_E01 | citation_validity | pass |  |
| DEMO_E01 | expected_citations | pass |  |
| DEMO_E01 | forbidden_claims | pass |  |
| DEMO_E02 | status | pass |  |
| DEMO_E02 | required_fields | pass |  |
| DEMO_E02 | question | pass |  |
| DEMO_E02 | forbidden_claims | pass |  |
| DEMO_E03 | status | pass |  |
| DEMO_E03 | required_fields | pass |  |
| DEMO_E03 | question | pass |  |
| DEMO_E03 | forbidden_claims | pass |  |
| DEMO_E04 | status | pass |  |
| DEMO_E04 | required_fields | pass |  |
| DEMO_E04 | forbidden_claims | pass |  |
| DEMO_E05 | status | pass |  |
| DEMO_E05 | required_fields | pass |  |
| DEMO_E05 | materials | pass |  |
| DEMO_E05 | region_match | pass |  |
| DEMO_E05 | citation_validity | pass |  |
| DEMO_E05 | expected_citations | pass |  |
| DEMO_E05 | forbidden_claims | pass |  |
| DEMO_E06 | status | pass |  |
| DEMO_E06 | required_fields | pass |  |
| DEMO_E06 | citation_validity | pass |  |
| DEMO_E06 | expected_citations | pass |  |
| DEMO_E06 | forbidden_claims | pass |  |
| DEMO_E07 | status | pass |  |
| DEMO_E07 | required_fields | pass |  |
| DEMO_E07 | citation_validity | pass |  |
| DEMO_E07 | expected_citations | pass |  |
| DEMO_E07 | forbidden_claims | pass |  |
| DEMO_E08 | status | pass |  |
| DEMO_E08 | required_fields | pass |  |
| DEMO_E08 | forbidden_claims | pass |  |
| DEMO_E09 | status | pass |  |
| DEMO_E09 | required_fields | pass |  |
| DEMO_E09 | forbidden_claims | pass |  |
| DEMO_E10 | status | pass |  |
| DEMO_E10 | required_fields | pass |  |
| DEMO_E10 | citation_validity | pass |  |
| DEMO_E10 | expected_citations | pass |  |
| DEMO_E10 | forbidden_claims | pass |  |
| DEMO_E11 | status | pass |  |
| DEMO_E11 | required_fields | pass |  |
| DEMO_E11 | materials | pass |  |
| DEMO_E11 | region_match | pass |  |
| DEMO_E11 | citation_validity | fail | 引用编号、版本、原文、标题或链接与资料目录不匹配 |
| DEMO_E11 | expected_citations | pass |  |
| DEMO_E11 | forbidden_claims | pass |  |
| DEMO_E12 | status | not_executed | 未提供业务接口或该案例的离线实际输出 |
| DEMO_E12 | required_fields | not_executed | 未提供业务接口或该案例的离线实际输出 |
| DEMO_E12 | forbidden_claims | not_executed | 未提供业务接口或该案例的离线实际输出 |
| DEMO_E13 | status | not_executed | 未提供业务接口或该案例的离线实际输出 |
| DEMO_E13 | required_fields | not_executed | 未提供业务接口或该案例的离线实际输出 |
| DEMO_E13 | forbidden_claims | not_executed | 未提供业务接口或该案例的离线实际输出 |
