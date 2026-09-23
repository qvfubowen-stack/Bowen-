# 原始记录数量 vs 产品数量对照

原始记录行数(含 Sheet1 补充表): 970
  - 主目录 Product Information: 385
  - 品牌/车型目录 14 张表: 308
  - 补充表 Sheet1: 277
产品数(按 Bowen No. 聚合): 466
不重复 Bowen No.: 459
OE 明细行: 2364  不重复 OE(严格): 2211  宽松匹配键: 2211
车型品牌关系: 552  不重复品牌: 87
发动机代码行: 316  不重复: 1
原始车型片段(去重): 509

## 分层
- PUBLISHED: 72  (15.5%)
- SEARCHABLE_BUT_NOINDEX: 300  (64.4%)
- DRAFT: 94  (20.2%)

## OE 每产品分布
- 0: 17
- 1: 126
- 2-3: 130
- 4-5: 63
- 6+: 130
- max: 57

## 来源分布（产品数，一个产品可能来自多表）
- Product Information: 375
- Sheet1: 225
- Volkswagen: 48
- GM: 37
- Peugeot and Citroen: 36
- Japanese Vehicles: 26
- Chery: 25
- Ford: 24
- BMW and Mercedes-Benz: 24
- BYD: 20
- Changan: 15
- Mitsubishi: 14
- Geely and Haval: 12
- Roewe and MG: 10
- Great Wall and Haval: 9
- Trumpchi: 5

## 字段完整率
| 字段 | 已填 | 总数 | 完整率 | 说明 |
|---|---|---|---|---|
| product_id | 466 | 466 | 100.0% |  |
| product_type | 0 | 466 | 0.0% | 必须先人工确认/补录，本阶段不允许自动填充 |
| product_name_en | 0 | 466 | 0.0% | 必须先人工确认/补录，本阶段不允许自动填充 |
| bowen_no | 459 | 466 | 98.5% |  |
| status | 466 | 466 | 100.0% |  |
| oe_number_raw | 449 | 466 | 96.4% |  |
| oe_number_normalized | 449 | 466 | 96.4% |  |
| vehicle_make | 317 | 466 | 68.0% |  |
| vehicle_model | 0 | 466 | 0.0% | 必须先人工确认/补录，本阶段不允许自动填充 |
| engine_code | 142 | 466 | 30.5% |  |
| engine_displacement | 114 | 466 | 24.5% |  |
| application_notes | 384 | 466 | 82.4% |  |
| opening_temperature_c | 250 | 466 | 53.6% |  |
| dimensions | 97 | 466 | 20.8% |  |
| housing_type | 0 | 466 | 0.0% | 必须先人工确认/补录，本阶段不允许自动填充 |
| source_sheet | 466 | 466 | 100.0% |  |
| source_row | 466 | 466 | 100.0% |  |
| source_version | 466 | 466 | 100.0% |  |
| fitment_confidence | 466 | 466 | 100.0% |  |
| searchable | 372 | 466 | 79.8% |  |
| indexable | 0 | 466 | 0.0% | 必须先人工确认/补录，本阶段不允许自动填充 |
| last_verified_at | 0 | 466 | 0.0% | 必须先人工确认/补录，本阶段不允许自动填充 |
| verified_by | 0 | 466 | 0.0% | 必须先人工确认/补录，本阶段不允许自动填充 |

平均核心字段完整率: 60.6%
平均增强字段完整率: 12.9%
平均每产品 OE 数: 5.07

## 异常与治理清单
{
  "ignored_garbage_cells": 0,
  "duplicate_oe_cells_removed": 2,
  "bowen_anomalies": 43,
  "oe_ambiguous_splits": 1621,
  "oe_kept_whole_needs_review": 45,
  "oe_oversized_dropped": 26,
  "oe_nonstandard_dropped": 24,
  "supplement_app_column_is_oem": 39,
  "tianbo_field_present": 73,
  "records_with_oem_but_no_bowen": 6,
  "records_with_bowen_but_no_oem": 19
}

## Bowen 重复分层
{
  "raw_bowen_repeated": 303,
  "bowen_oe_conflict_across_sheets": 162,
  "bowen_variant_family": 18
}

### 跨表重复 Top 20
| Bowen No. | 出现在几个表 | 表 |
|---|---|---|
| 3001 | 3 | Product Information | Volkswagen | Sheet1 |
| 3002 | 3 | Product Information | Volkswagen | Sheet1 |
| 3003 | 2 | Product Information | Chery |
| 3004 | 2 | Product Information | Chery |
| 3005 | 6 | Product Information | BYD | Geely and Haval | Great Wall and Haval | Mitsubishi | Sheet1 |
| 3006 | 3 | Product Information | Peugeot and Citroen | Sheet1 |
| 3007 | 3 | Product Information | Peugeot and Citroen | Sheet1 |
| 300701 | 3 | Product Information | Peugeot and Citroen | Sheet1 |
| 3008 | 3 | Product Information | GM | Sheet1 |
| 3009 | 3 | Product Information | GM | Sheet1 |
| 3010 | 3 | Product Information | GM | Sheet1 |
| 3011 | 3 | Product Information | Japanese Vehicles | Sheet1 |
| 3012 | 2 | Product Information | Chery |
| 3013 | 3 | Product Information | Mitsubishi | Sheet1 |
| 3014 | 2 | Product Information | Sheet1 |
| 3015 | 3 | Product Information | Roewe and MG | Sheet1 |
| 3016 | 3 | Product Information | Ford | Sheet1 |
| 3017 | 3 | Product Information | Geely and Haval | Chery |
| 3019 | 5 | Product Information | BYD | Geely and Haval | Chery | Sheet1 |
| 3020 | 3 | Product Information | Ford | Sheet1 |

### OE 集合跨表冲突 Top 20
- 3001: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 19 个）；Product Information 缺少 14 个；Volkswagen 缺少 14 个；Sheet1 缺少 5 个
- 3002: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 12 个）；Product Information 缺少 7 个；Volkswagen 缺少 7 个；Sheet1 缺少 5 个
- 3003: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 4 个）；Product Information 缺少 3 个
- 3005: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 57 个）；Product Information 缺少 44 个；BYD 缺少 42 个；Geely and Haval 缺少 42 个；Great Wall and Haval 缺少 42 个；Mitsubishi 缺少 56 个；Sheet1 缺少 13 个
- 3006: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 6 个）；Product Information 缺少 1 个；Peugeot and Citroen 缺少 1 个；Sheet1 缺少 5 个
- 3007: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 7 个）；Product Information 缺少 1 个；Peugeot and Citroen 缺少 2 个；Sheet1 缺少 6 个
- 300701: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 7 个）；Product Information 缺少 3 个；Peugeot and Citroen 缺少 3 个；Sheet1 缺少 4 个
- 3008: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 13 个）；Product Information 缺少 8 个；GM 缺少 8 个；Sheet1 缺少 5 个
- 3009: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 3 个）；Product Information 缺少 1 个；GM 缺少 1 个；Sheet1 缺少 2 个
- 3010: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 6 个）；Product Information 缺少 1 个；GM 缺少 1 个；Sheet1 缺少 5 个
- 3011: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 14 个）；Product Information 缺少 10 个；Japanese Vehicles 缺少 14 个；Sheet1 缺少 4 个
- 3013: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 2 个）；Product Information 缺少 1 个；Mitsubishi 缺少 1 个；Sheet1 缺少 1 个
- 3014: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 2 个）；Product Information 缺少 1 个；Sheet1 缺少 1 个
- 3015: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 6 个）；Roewe and MG 缺少 1 个；Sheet1 缺少 5 个
- 3016: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 25 个）；Product Information 缺少 17 个；Ford 缺少 19 个；Sheet1 缺少 9 个
- 3019: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 12 个）；Product Information 缺少 5 个；BYD 缺少 6 个；Geely and Haval 缺少 7 个；Chery 缺少 7 个；Sheet1 缺少 7 个
- 3020: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 20 个）；Product Information 缺少 4 个；Ford 缺少 14 个；Sheet1 缺少 16 个
- 3021: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 5 个）；Product Information 缺少 2 个；Great Wall and Haval 缺少 2 个；Mitsubishi 缺少 2 个；Ford 缺少 2 个；Sheet1 缺少 3 个
- 3022: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 3 个）；Product Information 缺少 1 个
- 3023: 同一 Bowen No. 在不同工作表登记的 OE 不一致（并集 11 个）；Product Information 缺少 5 个；Japanese Vehicles 缺少 5 个；Sheet1 缺少 6 个

### Bowen 变体族全部
- 基础号 3004 (6 个): 3004 | 3004--33503 | 3004-1 | 3004-3 | 3004-4 | 3004-5
- 基础号 3033 (4 个): 3033 | 3033--1 | 3033-Z | 3033-Z138*95*251
- 基础号 3041 (4 个): 3041 | 3041-1 | 3041-2 | 3041-2(3003)SEALINGRING
- 基础号 3654 (4 个): 3654 | 3654--2 | 3654-1 | 3654-3
- 基础号 3002 (3 个): 3002 | 3002-1 | 3002-DQ
- 基础号 3003 (3 个): 3003 | 3003-1 | 3003-3
- 基础号 3665 (3 个): 3665 | 3665-1 | 3665-188℃
- 基础号 3011 (2 个): 3011 | 3011-23565
- 基础号 3016 (2 个): 3016 | 3016-82
- 基础号 3021 (2 个): 3021 | 3021-1
- 基础号 3056 (2 个): 3056 | 3056-1
- 基础号 32748 (2 个): 32748-132748-2 | 32748-2
- 基础号 33561 (2 个): 33561 | 33561-1
- 基础号 33663 (2 个): 33663 | 33663-1
- 基础号 35063 (2 个): 35063 | 35063-1
- 基础号 3565 (2 个): 3565 | 3565-2
- 基础号 3655 (2 个): 3655 | 3655-2
- 基础号 3905 (2 个): 3905 | 3905-1

## OE 重复
{
  "oe_shared_across_products": 136
}

### 被多个产品共用最多的 OE Top 25
| OE(标准化) | 产品数 | Bowen No. |
|---|---|---|
| LF7015170 | 3 | 3020 | 33910 | 3548 |
| 4M5G8575FC | 3 | 3020 | 33910 | 3548 |
| 1302167 | 3 | 3020 | 33910 | 3548 |
| 1355791 | 3 | 3020 | 33910 | 3548 |
| 30711785 | 3 | 3020 | 33910 | 3548 |
| 31251245 | 3 | 3020 | 33910 | 3548 |
| 21200AA072 | 3 | 3023 | 3069 | 38282  88° |
| 96984104 | 3 | 3033 | 3033--1 | 3033-z |
| 55578419 | 3 | 3033 | 3033--1 | 3033-z |
| 25199828 | 3 | 3033 | 3033--1 | 3033-z |
| 2550035540 | 3 | 3004-3 | 3004-5 | 3503 |
| 2550035530 | 3 | 3004-3 | 3004-5 | 3503 |
| 1X4Z8575B | 3 | 3203 | 32138 | 33663-1 |
| 8974357940 | 3 | 35116 | 35116(Deben) | 403229 |
| 938103K000 | 3 | 5016 | 5016B | 5018 |

## OE 解析问题明细
- 单个空格推断拆分（已拆，标记待确认）: 1621
- 保留整段待人工确认（混有品牌名等非 OE 片段）: 45
- 归一化后过长被剔除: 26
- 不标准被剔除: 24
- 版面重复单元格被剔除: 2

### 保留整段待确认明细
- Product Information!I16 [mixed_oe_and_non_oe_tokens] tokens=5: 24564633 9052864 24101266 1634187785 Suzuki
- Product Information!I28 [mixed_oe_and_non_oe_tokens] tokens=29: 9091603046 TOYOTA 9091603060 TOYOTA 9091603082 TOYOTA 9091603090 TOYOTA 9091603109 TOYOTA 212004M500 NISSAN WV48B-76.5 2120077A60 NISSAN 1N0315171 MAZ
- Product Information!C56 [mixed_oe_and_non_oe_tokens] tokens=8: A130050JX0101 1731000 1723001 1723006 1723008 1723008 Non-STT B000003STT
- Product Information!C73 [mixed_oe_and_non_oe_tokens] tokens=10: 0022031675 1102000915 4738161 61673540 51064020034 51064020043 0032037375 0032037875 251899 2555
- Product Information!C107 [mixed_oe_and_non_oe_tokens] tokens=10: 34078 1601479128 699180 39108 49108 31831 455778 7031639 XXT49108 68148113AA(Assembly)4892312AB
- Product Information!I111 [mixed_oe_and_non_oe_tokens] tokens=40: 19300PDA01 0619359B306 WV52BC 19300PJ7004 19300PM3003 19301PZA305 5860003490 473QA1306020 8AF315171 8AF615171 GTS275 1014944100 17210000 1723001 17230
- Product Information!I146 [mixed_oe_and_non_oe_tokens] tokens=6: DC00644980 8942202020 9636777180 1338A7 133888 96368023 9628454680
- Product Information!C149 [mixed_oe_and_non_oe_tokens] tokens=5: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Product Information!C195 [mixed_oe_and_non_oe_tokens] tokens=5: 9818232480    453470  3637699  3647106
- BYD!C9 [mixed_oe_and_non_oe_tokens] tokens=5: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Mitsubishi!C3 [mixed_oe_and_non_oe_tokens] tokens=61: WV56TB SMD337408E SMW252165E MD158570 2551042100 1136000156 1023779300 LFB479Q1306100A 1014944100 9091603075 9091603084 9091603129 471Q1306950 S1026L2
- Mitsubishi!I6 [mixed_oe_and_non_oe_tokens] tokens=5: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Chery!I8 [mixed_oe_and_non_oe_tokens] tokens=5: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Japanese Vehicles!J6 [mixed_oe_and_non_oe_tokens] tokens=6: 2550027000 2550023010 2550023001 2551042010 255104A700 2550026100（88
- Japanese Vehicles!C7 [mixed_oe_and_non_oe_tokens] tokens=2: 9091603046 000
- Japanese Vehicles!C7 [mixed_oe_and_non_oe_tokens] tokens=2: 9091603069 000
- Japanese Vehicles!C7 [mixed_oe_and_non_oe_tokens] tokens=2: 9091603090 000
- Japanese Vehicles!C7 [mixed_oe_and_non_oe_tokens] tokens=2: DAIHATSU 9091603115
- Sheet1!B21 [mixed_oe_and_non_oe_tokens] tokens=3: 9004833091(Different sealing ring)
- Sheet1!B37 [no_oe_like_token] tokens=3: Assembly OE No
- Sheet1!B39 [no_oe_like_token] tokens=3: Assembly OE No
- Sheet1!B40 [no_oe_like_token] tokens=3: Assembly OE No
- Sheet1!B86 [mixed_oe_and_non_oe_tokens] tokens=3: RT-1227(OE number unconfirmed)
- Sheet1!B96 [mixed_oe_and_non_oe_tokens] tokens=4: 1427919 Assembly OE No
- Sheet1!B98 [no_oe_like_token] tokens=3: Assembly OE No
- Sheet1!B99 [no_oe_like_token] tokens=3: Assembly OE No
- Sheet1!B177 [no_oe_like_token] tokens=3: 5 157 411
- Sheet1!B203 [no_oe_like_token] tokens=3: 13 38 246
- Sheet1!B203 [no_oe_like_token] tokens=3: 13 38 369
- Sheet1!B219 [mixed_oe_and_non_oe_tokens] tokens=3: LR121420(Assembly OE No.)
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=2: BOSCH: 0280130107
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=2: FIAT: 7770239
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=2: GMC: 90410792
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=4: HONDA: 37870-PDF-E00 / 37870-PDF-E01
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=6: OPEL: 1338451 / 90410792 / 90510183
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=6: RENAULT: 6000581611 / 6001538842 / 7702218698
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=2: SAAB: 90510183
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=4: VAUXHALL: 90410792 / 90510183
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=8: CHEVROLET: 03439088 / 90410792 / 90510183 / 93358883
- Sheet1!B252 [mixed_oe_and_non_oe_tokens] tokens=4: DACIA: 6000581611 / 6001538842

### 过长被剔除明细
- Product Information!I16 len=39: 24564633 9052864 24101266 1634187785 Suzuki
- Product Information!I28 len=223: 9091603046 TOYOTA 9091603060 TOYOTA 9091603082 TOYOTA 9091603090 TOYOTA 9091603109 TOYOTA 212004M500 NISSAN WV48B-76.5 2120077A60 NISSAN 1N0315171 MAZ
- Product Information!C56 len=64: A130050JX0101 1731000 1723001 1723006 1723008 1723008 Non-STT B000003STT
- Product Information!C73 len=87: 0022031675 1102000915 4738161 61673540 51064020034 51064020043 0032037375 0032037875 251899 2555
- Product Information!C107 len=84: 34078 1601479128 699180 39108 49108 31831 455778 7031639 XXT49108 68148113AA(Assembly)4892312AB
- Product Information!I111 len=396: 19300PDA01 0619359B306 WV52BC 19300PJ7004 19300PM3003 19301PZA305 5860003490 473QA1306020 8AF315171 8AF615171 GTS275 1014944100 17210000 1723001 17230
- Product Information!I146 len=60: DC00644980 8942202020 9636777180 1338A7 133888 96368023 9628454680
- Product Information!C149 len=39: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Product Information!C195 len=30: 9818232480    453470  3637699  3647106
- BYD!C9 len=39: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Mitsubishi!C3 len=593: WV56TB SMD337408E SMW252165E MD158570 2551042100 1136000156 1023779300 LFB479Q1306100A 1014944100 9091603075 9091603084 9091603129 471Q1306950 S1026L2
- Mitsubishi!I6 len=39: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Chery!I8 len=39: 471QIL1300800B Dongan Mitsubishi 471 Engine
- Japanese Vehicles!J6 len=62: 2550027000 2550023010 2550023001 2551042010 255104A700 2550026100（88
- Sheet1!B21 len=30: 9004833091(Different sealing ring)
- Sheet1!B35 len=53: 1767085C00/1634187180/9091603029/9091603034/8AG415171
- Sheet1!B35 len=75: TH705088/0K01315171/0K01C1517YA/0K1315171/0K20115171A/0K24715171/0K2C015171
- Sheet1!B48 len=60: 05184651AF/05184655AD/902852/SK902852/DG0714525/823203/34774
- Sheet1!B164 len=39: 5011456AA/5015090AA/5015090AB/5015708AA
- Sheet1!B186 len=41: 037121113/08966483/1338061/75067/90412604
- Sheet1!B252 len=28: HONDA: 37870-PDF-E00 / 37870-PDF-E01
- Sheet1!B252 len=29: OPEL: 1338451 / 90410792 / 90510183
- Sheet1!B252 len=39: RENAULT: 6000581611 / 6001538842 / 7702218698
- Sheet1!B252 len=44: CHEVROLET: 03439088 / 90410792 / 90510183 / 93358883
- Sheet1!B252 len=26: DACIA: 6000581611 / 6001538842
- Sheet1!B252 len=30: DELPHI: STD00003 / TS10271 / WC10096

### 不标准被剔除明细
- Product Information!I8 [normalized_too_short(4)]: LCAR
- Product Information!C117 [normalized_too_short(2)]: 71
- Product Information!C117 [normalized_too_short(2)]: 76
- Product Information!C117 [normalized_too_short(2)]: 82
- Mitsubishi!C6 [normalized_too_short(4)]: 3026
- GM!I6 [normalized_too_short(4)]: LCAR
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: TOYOTA
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: TOYOTA
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: TOYOTA
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: TOYOTA
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: TOYOTA
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: NISSAN
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: NISSAN
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: MAZDA
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: HONDA
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: DAIHATSU
- Japanese Vehicles!C7 [no_digit_likely_brand_name]: DAIHATSU
- Sheet1!B19 [normalized_too_short(3)]: 13H
- Sheet1!B37 [no_digit_likely_brand_name]: Assembly OE No
- Sheet1!B39 [no_digit_likely_brand_name]: Assembly OE No
- Sheet1!B40 [no_digit_likely_brand_name]: Assembly OE No
- Sheet1!B98 [no_digit_likely_brand_name]: Assembly OE No
- Sheet1!B99 [no_digit_likely_brand_name]: Assembly OE No
- Sheet1!B252 [normalized_too_short(4)]: ST51

## Bowen No. 异常明细
- Product Information!E20 [bowen_no_nonstandard_chars] raw="3033-z  138*95*251" -> "3033-z  138*95*251" note=""
- Product Information!K55 [bowen_no_nonstandard_chars] raw="3520  120*85*90" -> "3520  120*85*90" note=""
- Product Information!K56 [bowen_no_nonstandard_chars] raw="3522  15*14*8.5" -> "3522  15*14*8.5" note=""
- Product Information!K107 [bowen_no_nonstandard_chars] raw="3919(35401)" -> "3919(35401)" note=""
- Product Information!K115 [bowen_no_nonstandard_chars] raw="35059 
F059" -> "35059  F059" note=""
- Product Information!E120 [bowen_no_nonstandard_chars] raw="30302(3334 Sealing ring)" -> "30302(3334 Sealing ring)" note=""
- Product Information!K122 [bowen_no_nonstandard_chars] raw="3929(3019 Sealing ring)" -> "3929(3019 Sealing ring)" note=""
- Product Information!K125 [bowen_no_nonstandard_chars] raw="35116(Deben)" -> "35116(Deben)" note=""
- Product Information!E129 [bowen_no_nonstandard_chars] raw="3041-2(3003) Sealing ring" -> "3041-2(3003) Sealing ring" note=""
- BMW and Mercedes-Benz!E4 [bowen_no_contained_description] raw="3511 With small pipe" -> "3511" note="With small pipe"
- BMW and Mercedes-Benz!K4 [bowen_no_contained_description] raw="Without small pipe" -> "" note="Without small pipe"
- BMW and Mercedes-Benz!E5 [bowen_no_contained_description] raw="3579 With small pipe" -> "3579" note="With small pipe"
- BMW and Mercedes-Benz!K5 [bowen_no_contained_description] raw="3588 Without small pipe" -> "3588" note="Without small pipe"
- Mitsubishi!E6 [bowen_no_nonstandard_chars] raw="3004--3  3503" -> "3004--3  3503" note=""
- Japanese Vehicles!E6 [bowen_no_nonstandard_chars] raw="3069（3076）" -> "3069（3076）" note=""
- Sheet1!D9 [bowen_no_nonstandard_chars] raw="3011-2
3565" -> "3011-2 3565" note=""
- Sheet1!D20 [bowen_no_nonstandard_chars] raw="3029  92°" -> "3029  92°" note=""
- Sheet1!D24 [bowen_no_nonstandard_chars] raw="3035(3403 Sealing ring)" -> "3035(3403 Sealing ring)" note=""
- Sheet1!D30 [bowen_no_nonstandard_chars] raw="3665-1
88℃" -> "3665-1 88℃" note=""
- Sheet1!D58 [bowen_no_nonstandard_chars] raw="3064 Plastic housing" -> "3064 Plastic housing" note=""
- Sheet1!D59 [bowen_no_nonstandard_chars] raw="3064
77℃" -> "3064 77℃" note=""
- Sheet1!D61 [bowen_no_nonstandard_chars] raw="L907(Insert only)" -> "L907(Insert only)" note=""
- Sheet1!D70 [bowen_no_nonstandard_chars] raw="3653 Assembly OE No." -> "3653 Assembly OE No." note=""
- Sheet1!D71 [bowen_no_nonstandard_chars] raw="3556  77°" -> "3556  77°" note=""
- Sheet1!D75 [bowen_no_nonstandard_chars] raw="3011
88°" -> "3011 88°" note=""
- Sheet1!D77 [bowen_no_nonstandard_chars] raw="3583 Aluminum housing" -> "3583 Aluminum housing" note=""
- Sheet1!D79 [bowen_no_nonstandard_chars] raw="Same dimensions as 3025. Original valve seat has 3 notches. Sealing ring has 3 locating features on the inner circumference and a locating feature on the outer circumference." -> "Same dimensions as 3025. Original valve seat has 3 notches. Sealing ring has 3 locating features on the inner circumference and a locating feature on the outer circumference." note=""
- Sheet1!D84 [bowen_no_nonstandard_chars] raw="33655A
33655B" -> "33655A 33655B" note=""
- Sheet1!D96 [bowen_no_nonstandard_chars] raw="Thermostat insert No.:31052" -> "Thermostat insert No.:31052" note=""
- Sheet1!D98 [bowen_no_nonstandard_chars] raw="Thermostat insert No.:3130" -> "Thermostat insert No.:3130" note=""
- Sheet1!D99 [bowen_no_nonstandard_chars] raw="Insert: 211 insert" -> "Insert: 211 insert" note=""
- Sheet1!D107 [bowen_no_nonstandard_chars] raw="3025(Different sealing ring)" -> "3025(Different sealing ring)" note=""
- Sheet1!D108 [bowen_no_nonstandard_chars] raw="3094(Sealing ring without locating protrusions)" -> "3094(Sealing ring without locating protrusions)" note=""
- Sheet1!D110 [bowen_no_nonstandard_chars] raw="3025 88°" -> "3025 88°" note=""
- Sheet1!D127 [bowen_no_nonstandard_chars] raw="3565  88°" -> "3565  88°" note=""
- Sheet1!D130 [bowen_no_nonstandard_chars] raw="31016
Insert only" -> "31016 Insert only" note=""
- Sheet1!D154 [bowen_no_nonstandard_chars] raw="32748-1
32748-2" -> "32748-1 32748-2" note=""
- Sheet1!D176 [bowen_no_nonstandard_chars] raw="3150(3086 Insert)" -> "3150(3086 Insert)" note=""
- Sheet1!D182 [bowen_no_nonstandard_chars] raw="3528 (borrowed part)" -> "3528 (borrowed part)" note=""
- Sheet1!D236 [bowen_no_nonstandard_chars] raw="37603(Tianbo) Non-electronic" -> "37603(Tianbo) Non-electronic" note=""
- Sheet1!D245 [bowen_no_nonstandard_chars] raw="Same specifications as 3014
Different appearance and structure" -> "Same specifications as 3014 Different appearance and structure" note=""
- Sheet1!D251 [bowen_no_nonstandard_chars] raw="38282  88°" -> "38282  88°" note=""
- Sheet1!D273 [bowen_no_nonstandard_chars] raw="3033 Sealing ring" -> "3033 Sealing ring" note=""

## 第一批推荐上线清单
数量: 72  分数区间: 56 ~ 86

| # | Bowen No. | OE数 | 车型品牌 | 温度 | 尺寸 | 产品类型建议 | 来源 |
|---|---|---|---|---|---|---|---|
| 1 | 3005 | 57 | SAIC-GM-Wuling | Mitsubishi | Great Wall | Geely | Haval | B | 76.5 | 82 | D1=56mm | d2=28mm | A=43mm | Thermostat (unconfirmed) | Product Information | BYD | Geely and Haval | Great Wall and Haval | Mitsubishi | Sheet1 |
| 2 | 3064 | 52 | Nissan | 82 | D1=54.5mm | d2=28mm | A=34mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Sheet1 |
| 3 | 3061A | 25 | Dongfeng | Honda | 78 | D1=52mm | d2=28mm | A=35mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 4 | 3069 | 20 | Zhejiang Gonow | Great Wall | Haval | 76.5 | 82 | D1=56mm | d2=28mm | A=36.5mm | Thermostat (unconfirmed) | Product Information | Geely and Haval | Great Wall and Haval | Sheet1 |
| 5 | 3008 | 13 | Buick | 90 | D1=44mm | d2=23.4mm | A=33mm | Thermostat (unconfirmed) | Product Information | GM | Sheet1 |
| 6 | 3066 | 8 | SAIC-GM | SAIC-GM-Wuling | Lifan | 82 | D1=44mm | Thermostat (unconfirmed) | Product Information | GM | Sheet1 |
| 7 | 3503 | 8 | Hyundai | Changan | 76.5 | 82 | D1=64mm | d2=28mm | A=45mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Sheet1 |
| 8 | 3051 | 49 | Shenyang Xinguang | Mianyang Xinchen | SAIC-GM-Wuling | Grea | 76.5 | 82 | D1=48mm | d2=28mm | A=33mm | Thermostat (unconfirmed) | Product Information | Geely and Haval | Great Wall and Haval | Japanese Vehicles | Sheet1 |
| 9 | 3077 | 31 | Haima | FAW | 82 | D1=52mm | d2=28mm | A=40mm | Thermostat (unconfirmed) | Product Information | Ford | Sheet1 |
| 10 | 3025 | 30 | Changhe Suzuki | 82 | 87 | D1=44mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Sheet1 |
| 11 | 3076 | 20 | Shenyang Xinguang | Mianyang Xinchen | Toyota | 76.5 | 82 | D1=56mm | d2=28mm | A=33.5mm | Thermostat (unconfirmed) | Product Information | BMW and Mercedes-Benz | Japanese Vehicles | Sheet1 |
| 12 | 3027 | 15 | SAIC-GM-Wuling | Changan | Dongan | Haima | DFSK | 82 | 88 | 91 | 92 | D1=44mm | Thermostat (unconfirmed) | Product Information | Changan | Sheet1 |
| 13 | 3019 | 12 | Geely | BYD | 82 | D1=52mm | d2=33mm | A=50mm | Thermostat (unconfirmed) | Product Information | BYD | Geely and Haval | Chery | Sheet1 |
| 14 | 3074 | 12 | Shenyang Mitsubishi | Brilliance | Haima | 82 | 87 | D1=52mm | Thermostat (unconfirmed) | Product Information | Mitsubishi | Sheet1 |
| 15 | 3023 | 11 | Dongfeng | DFSK | 82 | D1=56mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Sheet1 |
| 16 | 3583 | 10 | Cadillac | 86 | D1=56mm | d2=40mm | A=50mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 17 | 3550 | 8 | Mianyang Xinchen | Toyota | 82 | D1=60mm | d2=30mm | A=41mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Sheet1 |
| 18 | 3094 | 22 | Ford | 82 | D1=48mm | Thermostat (unconfirmed) | Product Information | Ford | Sheet1 |
| 19 | 31515 | 22 | Dongfeng | Foton | 82 | D1=58mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 20 | 3061 | 20 | BYD | Honda | 78 | 82 | D1=52mm | d2=28mm | A=35mm | Thermostat (unconfirmed) | Product Information | BYD | Japanese Vehicles |
| 21 | 3065 | 14 | Nissan | 95 | D1=52mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Sheet1 |
| 22 | 33663 | 14 | Ford | 71 | 87 | D1=61mm | d2=34.5mm | A=40.5mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 23 | 3068 | 13 | Mianyang Xinchen | Jiangling | Great Wall | Haval | Ford | 76 | 82 | D1=54mm | d2=22mm | A=33mm | Thermostat (unconfirmed) | Product Information | Geely and Haval | Great Wall and Haval | Ford | Sheet1 |
| 24 | 3004-3 | 49 | Mitsubishi | Changfeng | 82 | D1=64mm | d2=30mm | A=43mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 25 | 30101 | 28 | Peugeot | Citroen | Toyota | Ford | Fiat | 88 | D1=52mm | d2=28mm | A=33mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Ford | Peugeot and Citroen | Sheet1 |
| 26 | 31605 | 24 | BMW | 80 | D1=67mm | d2=35mm | A=25.5mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 27 | 3080 | 22 | Mercedes-Benz | BMW | Volkswagen | 82 | 88 | D1=67mm | d2=35mm | A=25.5mm | Thermostat (unconfirmed) | Product Information | Volkswagen | Sheet1 |
| 28 | 3150 | 22 | Dongfeng Peugeot Citroen | 89 | D1=54mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 29 | 3665-1 | 21 | Land Rover | Hyundai | Nissan | Volvo | Ford | Kia | Isuzu | | 82 | 88 | D1=54mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 30 | 3035 | 20 | Cowin | Lifan | BMW | 91 | D1=46mm | Thermostat (unconfirmed) | Product Information | BMW and Mercedes-Benz | Sheet1 |
| 31 | 3001 | 19 | Hongqi | 79 | 81 | D1=54mm | d2=33mm | A=32mm | Thermostat (unconfirmed) | Product Information | Volkswagen | Sheet1 |
| 32 | 3029 | 19 | Chery | 87 | D1=48mm | Thermostat (unconfirmed) | Product Information | Chery | GM | Sheet1 |
| 33 | 31510 | 19 | Mazda | Ford | 88 | D1=52mm | d2=35mm | A=33mm | Thermostat (unconfirmed) | Product Information | Ford | Sheet1 |
| 34 | 3203 | 19 | Ford | 82 | D1=54mm | d2=35mm | A=40mm | Thermostat (unconfirmed) | Product Information | Ford | Sheet1 |
| 35 | 30102 | 17 | Renault | 89 | D1=50mm | Thermostat (unconfirmed) | Product Information | Peugeot and Citroen | Sheet1 |
| 36 | 31604-1 | 13 | Volkswagen | 87 | D1=67mm | d2=35mm | A=25.5mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 37 | 3002 | 12 | Volkswagen | Audi | 82 | 87 | D1=54mm | Thermostat (unconfirmed) | Product Information | Volkswagen | Sheet1 |
| 38 | 3028 | 12 | Nissan | 82 | D1=54.5mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 39 | 33119 | 12 | Ford | 90 | D1=60.8mm | d2=33.1mm | A=44mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 40 | 33662 | 11 | Chrysler | Jeep | 95 | D1=63mm | d2=35mm | A=38.5mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 41 | 3582 | 11 | Chevrolet | Cadillac | 86 | D1=54mm | d2=40mm | A=47mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 42 | 3041-2 | 7 | Toyota | 82 | D1=52mm | d2=30mm | A=33mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 43 | 3004-4 | 5 | Changan | 78 | 88 | D1=64mm | d2=30mm | A=45.9mm | Thermostat (unconfirmed) | Product Information | Changan | Sheet1 |
| 44 | 3021 | 5 | SAIC-GM-Wuling | Dongan | Shenyang Mitsubishi | Mitsubishi | 82 | 88 | D1=52mm | Thermostat (unconfirmed) | Product Information | Great Wall and Haval | Mitsubishi | Ford | Sheet1 |
| 45 | 3334 | 6 | Isuzu | 85 | D1=54mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 46 | 33910 | 6 | Mazda | Ford | 82 | 89 | d2=29mm | A=47mm | Thermostat (unconfirmed) | Product Information | Ford |
| 47 | 3003 | 4 | Chery | Cowin | 85 | D1=52mm | d2=28mm | A=33mm | Thermostat (unconfirmed) | Product Information | Chery |
| 48 | 3004-1 | 4 | Maxus | 82 | D1=64mm | d2=29mm | A=37mm | Thermostat (unconfirmed) | Product Information | Roewe and MG | Sheet1 |
| 49 | 3167--1 | 4 | Land Rover | 82 | 88 | D1=67mm | d2=35mm | A=45mm | Thermostat (unconfirmed) | Product Information | BMW and Mercedes-Benz |
| 50 | 3555 | 4 | Hongqi | FAW | 90.5 | D1=46mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 51 | 3022 | 3 | Dongan Mitsubishi | Changan | 71 | 82 | 88 | D1=50mm | Thermostat (unconfirmed) | Product Information | Changan | Mitsubishi |
| 52 | 3310 | 5 | Volkswagen | Skoda | Audi | SEAT | FAW | 95 | D1=53mm | d2=23mm | A=38.7mm | Thermostat (unconfirmed) | Product Information | Volkswagen | Sheet1 |
| 53 | 3500 | 4 | GAC Toyota | FAW Toyota | Toyota | 78 | D1=46mm | Thermostat (unconfirmed) | Product Information | Japanese Vehicles | Sheet1 |
| 54 | 3041-2(3003) Sealing ring | 6 | Toyota | 88 | D1=52mm | d2=30mm | A=33mm | Thermostat (unconfirmed) | Product Information |
| 55 | 3012 | 3 | Chery | Cowin | 82 | D1=52mm | d2=33mm | A=50mm | Thermostat (unconfirmed) | Product Information | Chery |
| 56 | 3024 | 3 | SAIC-GM-Wuling | Changan | Dongan | Buick | 70 | 82 | 92 | D1=52mm | Thermostat (unconfirmed) | Product Information | Changan |
| 57 | 3004 | 2 | Chery | 87 | D1=64mm | d2=30mm | A=43mm | Thermostat (unconfirmed) | Product Information | Chery |
| 58 | 33075-2 | 4 | Ford | 50 | D1=48mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 59 | 38241 | 4 | Chrysler | Dodge | Jeep | 77 | D1=54mm | d2=28mm | A=37mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 60 | 35116(Deben) | 4 | Isuzu | 85 | D1=64mm | d2=28mm | A=40mm | Thermostat (unconfirmed) | Product Information |
| 61 | 3054 | 3 | JAC | 82 | D1=54mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 62 | 3369 | 2 | Hyundai | Kia | 82 | D1=48mm | d2=28mm | A=32mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 63 | 3556 | 2 | Dongfeng | 82 | D1=56mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 64 | 30302(3334 Sealing ring) | 2 | Toyota | 76 | D1=54mm | d2=28mm | A=34mm | Thermostat (unconfirmed) | Product Information |
| 65 | 3013 | 2 | Brilliance | Mitsubishi | 82 | D1=56mm | d2=28mm | A=43mm | Thermostat (unconfirmed) | Product Information | Mitsubishi | Sheet1 |
| 66 | 3014 | 2 | JAC | 82 | D1=54mm | d2=28mm | A=43mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 67 | 3340 | 2 | Isuzu | 82 | D1=54mm | d2=30mm | A=32mm | Thermostat (unconfirmed) | Product Information | Sheet1 |
| 68 | 38282 | 3 | Subaru | 77 | 88 | D1=56mm | Thermostat (unconfirmed) | Product Information |
| 69 | 3090 | 2 | JAC | 82 | D1=54mm | d2=28mm | A=33mm | Thermostat (unconfirmed) | Product Information |
| 70 | 3905 | 2 | Foton | 88 | D1=64mm | d2=35mm | A=52mm | Thermostat (unconfirmed) | Product Information |
| 71 | 3905-1 | 2 | Foton | 82 | D1=64mm | d2=35mm | A=52mm | Thermostat (unconfirmed) | Product Information |
| 72 | 33743 | 2 | Hyundai | 82 | D1=54mm | d2=28mm | A=34mm | Thermostat (unconfirmed) | Product Information |

## 全部车型品牌（推导结果）
Audi, BMW, BYD, Beijing Hyundai, Brilliance, Buick, Cadillac, Changan, Changan Ford, Changfeng, Changhe Suzuki, Chery, Chevrolet, Chrysler, Citroen, Cowin, DFSK, Daewoo, Delphi, Dodge, Dongan, Dongan Mitsubishi, Dongfeng, Dongfeng Peugeot Citroen, FAW, FAW Mazda, FAW Toyota, Fiat, Ford, Foton, GAC FCA, GAC Toyota, GAC Trumpchi, GMC, Geely, Great Wall, Haima, Haval, Hawtai, Honda, Hongqi, Huaihai, Hyundai, Infiniti, Isuzu, JAC, Jeep, Jiangling, Kia, Lancia, Land Rover, Landwind, Lexus, Lifan, Lincoln, MG, Maxus, Mazda, Mercedes-Benz, Mianyang Xinchen, Mitsubishi, Nissan, Opel, Peugeot, Porsche, Renault, Roewe, SAIC, SAIC-GM, SAIC-GM-Wuling, SEAT, Shanghai Maple, Shenyang Mitsubishi, Shenyang Xinguang, Skoda, Soueast, SsangYong, Subaru, Suzuki, Toyota, UAES, Volkswagen, Volvo, WEY, Xiali, Zhejiang Gonow, Zotye
