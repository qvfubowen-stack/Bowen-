# qfbowen.com 现有官网资产迁移审计

> **Phase 3.5 交付物** · 生成时间 2026-09-26T02:18:08.042Z · 来源站点 `http://www.qfbowen.com`

**本次审计的目标**：从公司现有国内展示站 `www.qfbowen.com` 中提取**可复用的真实素材**，
用于正在开发的海外 B2B 独立站。

**本次审计不做的事**：

- ❌ 不用旧站代码替换 Next.js 项目 —— 现有 Bowen Website Prototype 仍是技术底座
- ❌ 不修改任何现有 Prototype 文件（见 TEST 7，`website/` 目录零改动）
- ❌ 不自动把任何中文内容上线到英文站
- ❌ 不绕过登录、验证码或任何访问权限；只抓公开页面（见 TEST 2）

---

## 一、直接回答需求书的 12 个问题

| # | 问题 | 结论 |
|---|---|---|
| 1 | 共抓到多少页面 | **943 个公开页面** |
| 2 | 共发现多少图片 | **875 个素材 URL**，全部为图片（成功下载 870 张；4 张在旧站本身已是 404 死链；1 张为验证码图片，按合规要求不下载） |
| 3 | 产品图片多少 | **783 张**（按"被产品页引用"归类，不是按上传路径——见下方说明） |
| 4 | 工厂图片多少 | **9 张**（厂房厂貌 + 生产设备栏目） |
| 5 | 证书图片多少 | **6 张**（荣誉资质栏目下的证书扫描件） |
| 6 | 成功匹配到 Bowen 产品的图片 | **274 张**（覆盖 **223 个当前产品**；旧站 546 个产品页有编号可直接对应） |
| 7 | 多少需要人工确认 | **520 张**产品图片需人工确认（另有全部公司/证书类素材同样待确认） |
| 8 | 哪些内容值得迁移 | 见 [第四节](#四d-产品图片匹配结果) 与 [第六节](#六e-公司素材映射建议) |
| 9 | 哪些内容不建议迁移 | 见 [第八节第 9 条](#9-哪些内容不建议迁移) |
| 10 | Prototype 建议替换哪些占位内容 | 见 [第九节](#九对现有-prototype-的建议不立即执行) |
| 11 | 旧站代码是否值得复用 | **不值得复用**，见 [第十节](#十旧站代码是否值得复用结论不值得) |
| 12 | 下一步资产迁移建议 | 见 [第十一节](#十一下一步资产迁移建议) |

> ⚠️ **一句话总结**：旧站有真实可用的**产品照片、工厂照片和证书图片**，
> 但 520 张产品图因旧站页面本身没写编号而**无法自动对应**产品，必须人工确认。
> 旧站代码、HTTP 协议、国内联系方式与营销文案**一律不建议迁移**。

---

## 二、A. 抓取范围与方法

| 项目 | 值 |
|---|---|
| 站点根地址 | `http://www.qfbowen.com` |
| 成功抓取页面 | **943** |
| 抓取尝试次数 | 342 |
| 跳过/失败 | 0（旧站自定义 404 页不计入） |
| 发现的素材 URL | 875 |
| 服务器 | text/html; Charset=utf-8 · Microsoft-IIS/10.0 · ASP.NET（AspCms 建站系统） |
| 页面编码 | UTF-8（`charset=utf-8`，实测无乱码） |

**抓取到的页面构成（按栏目）**：

| 栏目类型 | 页面数 |
|---|---|
| 产品（product） | 928 |
| 其它（other） | 6 |
| 公司介绍（company） | 3 |
| 联系方式（contact） | 2 |
| 工厂/设备（factory） | 2 |
| 证书/荣誉（certificate） | 1 |
| 新闻（news） | 1 |

**抓取边界（硬编码在爬虫里）**：

- 只发送 GET 请求，不携带 Cookie、不提交任何表单（`/gbook` 留言页只读、绝不写入）
- 明确排除 `/admin`、`/manage`、`/login`、`/search`、`/Templates`、`/upLoad` 等路径
- 并发 3、每请求间隔 220ms、失败最多重试 3 次 —— 避免影响旧站正常访问
- 遇到 HTTP 404 的自定义错误页直接丢弃，不当作页面收录

**记录到的字段**（每个页面）：URL、Page Title、Meta Description、Meta Keywords、H1/H2/H3、
主要正文、图片 URL、视频、PDF/下载、canonical、robots meta、引用资源、外链、国内站特征信标。

---

## 三、B / C. 素材下载与资产清单

### 下载结果

| 目录 | 文件数 | 说明 |
|---|---|---|
| `data/legacy-site/images/products/` | 783 | 产品图（被产品页引用） |
| `data/legacy-site/images/factory/` | 9 | 工厂 / 设备 / 厂房 |
| `data/legacy-site/images/certificates/` | 6 | 证书 / 荣誉扫描件 |
| `data/legacy-site/images/company/` | 2 | 公司外景 / 企业文化图 |
| `data/legacy-site/images/other/` | 70 | 模板装饰件、首页混合内容、全站 Banner、图标 |
| `data/legacy-site/documents/` | 0 | PDF / Office 下载文件 |
| **合计** | **870** | 共 64.7 MB |

> ⚠️ **旧站没有任何 PDF、Office 文档或视频**（下载结果里 documents = 0、videos = 0）。
> 也就是说旧站**无法提供**英文样本册、检测报告、证书 PDF 等文件类素材 —— 这类素材需要公司另行提供。

下载未成功 5 个：其中 **4 个是旧站自身的 404 死链**（页面引用了不存在的图片），
**1 个是验证码图片**（`/inc/checkcode.asp`，按"不绕过访问控制"的要求不下载）。
逐条清单见 `downloads.json` 的 `assets` 字段。

### ⚠️ 分类方法上的一个重要事实

旧站把**所有**上传图片都塞进同一个 `/upLoad/product/month_XXXX/` 目录 —— 
产品图、证书扫描件、厂房照片、甚至公司照片全在里面。因此：

- ❌ **不能**用 URL 路径判断一张图是产品图还是证书图
- ✅ 本审计改用**"这张图被哪一类页面引用"**作为主证据（并用文件名特征与实测尺寸识别装饰件）

**保留策略**：每个文件都保留了**原始文件名**；同名不同 URL 时加 URL 哈希前缀，
并且 `assets.json` 里同时记录了 `asset_url`（原始 URL）与 `source_url`（它出现在哪个页面），可完整回溯。

### assets.json 资产清单

路径：`data/legacy-site/assets.json`，包含需求书要求的全部字段：

```
source_url, asset_url, local_file, asset_type, page_title, page_category, possible_bowen_no, possible_product_name, reuse_status
```

**reuse_status 分布**：

| reuse_status | 数量 | 含义 |
|---|---|---|
| `auto_match` | 274 | 旧站页面写明的编号在当前数据库唯一命中，可自动对应 |
| `review_required` | 567 | 证据不足或有歧义，必须人工确认 |
| `not_recommended` | 29 | 不建议迁移（模板装饰、图标、二维码等） |

**图片格式与尺寸分布**（技术审计视角）：

| 格式 | 数量 |
|---|---|
| jpeg | 829 |
| png | 41 |

| 宽度区间 | 数量 |
|---|---|
| 300-799 | 25 |
| <300 | 40 |
| >=1600 | 11 |
| 800-1199 | 790 |
| 1200-1599 | 4 |

平均文件大小 76 KB；宽度 ≥1600px 的有 11 张。

---

## 四、D. 产品图片匹配结果

### 匹配依据（严格按需求书优先级）

1. **Bowen No.** —— 旧站产品页规格表里的「博文编号」列（2024 年新建的产品页有这个表）
2. 产品编号
3. **OE Number** —— 规格表里的「OEM号码」列
4. 产品标题
5. 原网页 URL

### 自动化红线的执行情况

> **禁止只根据图片外观猜产品。** 程序只承认两类证据，其余一律 `review_required`，绝不自动绑定：

- ✅ 旧站页面**明确写明**博文编号，且在冻结数据库中**唯一命中** → `auto_match`
- ✅ 旧站页面写明的 OEM 号码在数据库中**唯一命中**一个产品 → `auto_match`
- ⛔ 一个 OE 命中多个产品（数据库里确实存在 **125 个共享 OE**）→ `review_required`
- ⛔ 页面没有编号、只有中文标题与车型 → `review_required`

### 匹配结果

| 旧站产品页的匹配情况 | 页面数 |
|---|---|
| 博文编号唯一命中 | 546 |
| 页面没有任何编号信息（待人工对应） | 263 |
| OEM 号码唯一命中 | 2 |
| 博文编号在数据库中不存在（待确认） | 2 |
| **合计** | **813** |

| 指标 | 数量 |
|---|---|
| 旧站产品详情页 | 813 |
| 其中有规格表 | 552 |
| 其中写明博文编号 | 550 |
| 其中只有 OEM 号码 | 0 |
| **完全没有编号信息** | **263** |
| 成功对应到当前产品的旧站页面 | **546** |
| 产品图片总数（去重后） | 794 |
| ✅ 自动匹配（有编号证据） | **274** |
| ⚠️ 需人工确认 | **520** |
| 自动匹配覆盖的不同产品数 | 223 |

> **为什么"匹配到产品的页面数"（546）大于"自动匹配的图片数"（274）？
> 因为旧站把同一个产品在「产品中心」和「系列产品」两个栏目下重复发布，
> 两条记录指向同一张图和同一个博文编号。按"一张图 + 一个产品"去重后，
> 546 条页面记录收敛为 **274 张不同图片 / 223 个不同产品**。
> 这是旧站自身的重复发布问题，不是匹配遗漏。

### 自动匹配到的产品（可自动绑定的部分）

| 旧站页面 | 旧站博文编号 | 旧站 OEM | 匹配方式 | product_id | 产品英文名 |
|---|---|---|---|---|---|
| [813](http://www.qfbowen.com/content/?813.html) | 3033--1 | 6338018 / 96984104 / 55578419 / 25193684 | bowen_no | `BW-3033--1` | Thermostat 3033--1 |
| [814](http://www.qfbowen.com/content/?814.html) | 3033-z | 25192228 / 96984103 | bowen_no | `BW-3033-Z` | Thermostat 3033-z |
| [815](http://www.qfbowen.com/content/?815.html) | 3524 | 96988257 / 25192923 / 25199831 | bowen_no | `BW-3524` | Thermostat 3524 |
| [816](http://www.qfbowen.com/content/?816.html) | 3520 | 1338031 / 1338251 / 55565336 / 55579010 | bowen_no | `BW-3520` | Thermostat 3520 |
| [817](http://www.qfbowen.com/content/?817.html) | 3032 | 96282726 / 9022107 / 820437 | bowen_no | `BW-3032` | Thermostat 3032 |
| [818](http://www.qfbowen.com/content/?818.html) | 3026 | 93386678 / 90411948 / 92062728 / 9046678 | bowen_no | `BW-3026` | Thermostat 3026 |
| [819](http://www.qfbowen.com/content/?819.html) | 3029 | CAC4801306020 / 036121113B / 1635905 / 1 | bowen_no | `BW-3029` | Thermostat 3029 |
| [820](http://www.qfbowen.com/content/?820.html) | 3652 | 12622410 / 12615097 / 1338007 / 1338008 | bowen_no | `BW-3652` | Thermostat 3652 |
| [821](http://www.qfbowen.com/content/?821.html) | 3066 | 9025192 / 23872649 / 23876059 | bowen_no | `BW-3066` | Thermostat 3066 |
| [822](http://www.qfbowen.com/content/?822.html) | 1022 | 01R44792R01 | bowen_no | `BW-1022` | Temperature Sensor 1022 |
| [823](http://www.qfbowen.com/content/?823.html) | 1050B | F01R064963 | bowen_no | `BW-1050B` | Temperature Sensor 1050B |
| [824](http://www.qfbowen.com/content/?824.html) | 1070 | 90510850 / 1342569 / 3439088 / 4772216 / | bowen_no | `BW-1070` | Temperature Sensor 1070 |
| [825](http://www.qfbowen.com/content/?825.html) | 2016 | 55354325 / 90534902 / 1252555 / 1252573 | bowen_no | `BW-2016` | Oil Pressure Warning Switch 2016 |
| [826](http://www.qfbowen.com/content/?826.html) | 2019 | 9475021030 / 9475021000 / 9052869AA | bowen_no | `BW-2019` | Oil Pressure Warning Switch 2019 |
| [827](http://www.qfbowen.com/content/?827.html) | 5006 | 9001352 | bowen_no | `BW-5006` | Brake Light Switch 5006 |
| [828](http://www.qfbowen.com/content/?828.html) | 5015 | 8450857 / 24515036 | bowen_no | `BW-5015` | Brake Light Switch 5015 |
| [829](http://www.qfbowen.com/content/?829.html) | 6016 | 90482454 / 71739582 / 90245033 / 7174544 | bowen_no | `BW-6016` | Reverse Light Switch 6016 |
| [830](http://www.qfbowen.com/content/?830.html) | 6018 | 95028604 / 4803447 / 4818663 / 96628655 | bowen_no | `BW-6018` | Reverse Light Switch 6018 |
| [831](http://www.qfbowen.com/content/?831.html) | 3097 | 12635761 / 12685781 / 1338406 / 2503185 | bowen_no | `BW-3097` | Thermostat 3097 |
| [832](http://www.qfbowen.com/content/?832.html) | 303317 | 55575048 | bowen_no | `BW-303317` | Thermostat 303317 |
| [833](http://www.qfbowen.com/content/?833.html) | 3147 | 24105060 | bowen_no | `BW-3147` | Thermostat 3147 |
| [834](http://www.qfbowen.com/content/?834.html) | 3009 | LCAR / 96460002 / 9022108 | bowen_no | `BW-3009` | Thermostat 3009 |
| [835](http://www.qfbowen.com/content/?835.html) | 3010 | 93235636 / 7083256 / 92089884 / 93275736 | bowen_no | `BW-3010` | Thermostat 3010 |
| [836](http://www.qfbowen.com/content/?836.html) | 3523 | 96940086 / 25193412 | bowen_no | `BW-3523` | Thermostat 3523 |
| [837](http://www.qfbowen.com/content/?837.html) | 3008 | 24507563 / TX0563 / 12559269 / 35899 / 1 | bowen_no | `BW-3008` | Thermostat 3008 |
| [838](http://www.qfbowen.com/content/?838.html) | 3653 | 12651113 / 92249137 / 12638893 / 1257286 | bowen_no | `BW-3653` | Thermostat 3653 |
| [839](http://www.qfbowen.com/content/?839.html) | 1021 | 6238236 / TS1007512B1 / 01R43039R01 / 01 | bowen_no | `BW-1021` | Temperature Sensor 1021 |
| [840](http://www.qfbowen.com/content/?840.html) | 1045 | 0280130105 | bowen_no | `BW-1045` | Temperature Sensor 1045 |
| [841](http://www.qfbowen.com/content/?841.html) | 1055 | 0005425118 / MN960160 / 0003118V002 / 24 | bowen_no | `BW-1055` | Temperature Sensor 1055 |
| [842](http://www.qfbowen.com/content/?842.html) | 1073 | 9023791 | bowen_no | `BW-1073` | Temperature Sensor 1073 |
| [843](http://www.qfbowen.com/content/?843.html) | 2017 | 1252570 / 1252572 / 1252562 / 4803551 / | bowen_no | `BW-2017` | Oil Pressure Warning Switch 2017 |
| [844](http://www.qfbowen.com/content/?844.html) | 2042 | 9023793 | bowen_no | `BW-2042` | Oil Pressure Warning Switch 2042 |
| [845](http://www.qfbowen.com/content/?845.html) | 5007 | 9001353 | bowen_no | `BW-5007` | Brake Light Switch 5007 |
| [846](http://www.qfbowen.com/content/?846.html) | 6012 | 24459626 / 1239252 | bowen_no | `BW-6012` | Reverse Light Switch 6012 |
| [847](http://www.qfbowen.com/content/?847.html) | 6017 | 9068034 | bowen_no | `BW-6017` | Reverse Light Switch 6017 |
| [848](http://www.qfbowen.com/content/?848.html) | 3057 | 1306100XEC01 | bowen_no | `BW-3057` | Thermostat 3057 |
| [849](http://www.qfbowen.com/content/?849.html) | 3069 | 1306100XEG26 / 1306100EG01 / 1306100E16 | bowen_no | `BW-3069` | Thermostat 3069 |
| [850](http://www.qfbowen.com/content/?850.html) | 3584 | 1306025XEB02 | bowen_no | `BW-3584` | Thermostat 3584 |
| [851](http://www.qfbowen.com/content/?851.html) | 3021 | 4651306950 / SMD313946 / 2550011200 | bowen_no | `BW-3021` | Thermostat 3021 |
| [852](http://www.qfbowen.com/content/?852.html) | 3005 | WV56TB / SMD337408E / SMW252165E / MD158 | bowen_no | `BW-3005` | Thermostat 3005 |
| [853](http://www.qfbowen.com/content/?853.html) | 3068 | 1306950BB / 493Q1306010 / 1306100E02 / 1 | bowen_no | `BW-3068` | Thermostat 3068 |
| [854](http://www.qfbowen.com/content/?854.html) | 3843 | 4E0121113 | bowen_no | `BW-3843` | Thermostat 3843 |
| [855](http://www.qfbowen.com/content/?855.html) | 3585 | 1306015XEB02 | bowen_no | `BW-3585` | Thermostat 3585 |
| [856](http://www.qfbowen.com/content/?856.html) | 3051 | 4G22D41306010 / LF479Q11306100A / D22A13 | bowen_no | `BW-3051` | Thermostat 3051 |
| [857](http://www.qfbowen.com/content/?857.html) | 3022 | 1306010G01 / 100010345 / 476Q251306950B | bowen_no | `BW-3022` | Thermostat 3022 |
| [858](http://www.qfbowen.com/content/?858.html) | 3027 | LJ474QE2-1306010B / 94581899 / 17670A80D | bowen_no | `BW-3027` | Thermostat 3027 |
| [859](http://www.qfbowen.com/content/?859.html) | 3004--4 | 1306010A01 / H150131000 / 1306010B01 / 1 | bowen_no | `BW-3004--4` | Thermostat 3004--4 |
| [860](http://www.qfbowen.com/content/?860.html) | 35106 | 1306010A02 | bowen_no | `BW-35106` | Thermostat 35106 |
| [861](http://www.qfbowen.com/content/?861.html) | 3545 | 1306010B05 | bowen_no | `BW-3545` | Thermostat 3545 |
| [862](http://www.qfbowen.com/content/?862.html) | 1034 | 0280130037 / 12621288158 / 1626473 / 004 | bowen_no | `BW-1034` | Temperature Sensor 1034 |
| [863](http://www.qfbowen.com/content/?863.html) | 2018 | 465Q-3810950 / 465Q3810950 | bowen_no | `BW-2018` | Oil Pressure Warning Switch 2018 |
| [864](http://www.qfbowen.com/content/?864.html) | 5009 | F3-3504030 / F33504030 / B3781120 | bowen_no | `BW-5009` | Brake Light Switch 5009 |
| [865](http://www.qfbowen.com/content/?865.html) | 3024 | 4621306950 / XY13060100-462Q10 / LJ462Q- | bowen_no | `BW-3024` | Thermostat 3024 |
| [866](http://www.qfbowen.com/content/?866.html) | 3048 | 1306010A01 | bowen_no | `BW-3048` | Thermostat 3048 |
| [867](http://www.qfbowen.com/content/?867.html) | 3546 | 1306010B09 | bowen_no | `BW-3546` | Thermostat 3546 |
| [868](http://www.qfbowen.com/content/?868.html) | 35126 | 1306010B02 / 1306010B02BA / 1306010B02BB | bowen_no | `BW-35126` | Thermostat 35126 |
| [869](http://www.qfbowen.com/content/?869.html) | 35125 | 1306010B08 | bowen_no | `BW-35125` | Thermostat 35125 |
| [870](http://www.qfbowen.com/content/?870.html) | 1041 | — | bowen_no | `BW-1041` | Temperature Sensor 1041 |
| [871](http://www.qfbowen.com/content/?871.html) | 2024 | MR479Q0206000 / 4G183757100 / LJ479QE238 | bowen_no | `BW-2024` | Oil Pressure Warning Switch 2024 |
| [874](http://www.qfbowen.com/content/?874.html) | 3013 | SMD315301 | bowen_no | `BW-3013` | Thermostat 3013 |
| [876](http://www.qfbowen.com/content/?876.html) | 1028 | LJ486QE1-3808010 / LJ486QE13808010 / 471 | bowen_no | `BW-1028` | Temperature Sensor 1028 |
| [877](http://www.qfbowen.com/content/?877.html) | 1051 | 05269870AB / SMD177572 | bowen_no | `BW-1051` | Temperature Sensor 1051 |
| [880](http://www.qfbowen.com/content/?880.html) | 3074 | MW252050E / MN176384E / MN176384 / 10412 | bowen_no | `BW-3074` | Thermostat 3074 |
| [881](http://www.qfbowen.com/content/?881.html) | 3527 | SMW350262 | bowen_no | `BW-3527` | Thermostat 3527 |
| [882](http://www.qfbowen.com/content/?882.html) | 1027 | 471QIL1300800B / 东安三菱471发动机 | bowen_no | `BW-1027` | Temperature Sensor 1027 |
| [883](http://www.qfbowen.com/content/?883.html) | 1030 | 476Q-4D-1300800 / 476Q4D1300800 | bowen_no | `BW-1030` | Temperature Sensor 1030 |
| [884](http://www.qfbowen.com/content/?884.html) | 2020 | S1258A002 / 471Q3810950 | bowen_no | `BW-2020` | Oil Pressure Warning Switch 2020 |
| [885](http://www.qfbowen.com/content/?885.html) | 6010 | BS1537298001 / QR5232729500 / QR523-3729 | bowen_no | `BW-6010` | Reverse Light Switch 6010 |
| [886](http://www.qfbowen.com/content/?886.html) | 3059 | 10548074 | bowen_no | `BW-3059` | Thermostat 3059 |
| [887](http://www.qfbowen.com/content/?887.html) | 3015 | PEM100990 / 19302P5TG00 / 19302P5TG01 / | bowen_no | `BW-3015` | Thermostat 3015 |
| [888](http://www.qfbowen.com/content/?888.html) | 3041 | THM200001 | bowen_no | `BW-3041` | Thermostat 3041 |
| [889](http://www.qfbowen.com/content/?889.html) | 3525 | 10548074 | bowen_no | `BW-3525` | Thermostat 3525 |
| [890](http://www.qfbowen.com/content/?890.html) | 2041 | 71000042 | bowen_no | `BW-2041` | Oil Pressure Warning Switch 2041 |
| [892](http://www.qfbowen.com/content/?892.html) | 3040 | 10013853 | bowen_no | `BW-3040` | Thermostat 3040 |
| [893](http://www.qfbowen.com/content/?893.html) | 35020 | 10097468 / 10190710 | bowen_no | `BW-35020` | Thermostat 35020 |
| [894](http://www.qfbowen.com/content/?894.html) | 1037 | 10026418 / 13621433076 / 1433076 / 23017 | bowen_no | `BW-1037` | Temperature Sensor 1037 |
| [895](http://www.qfbowen.com/content/?895.html) | 3004--1 | S00012485 | bowen_no | `BW-3004--1` | Thermostat 3004--1 |
| [896](http://www.qfbowen.com/content/?896.html) | 3507 | 16031-31010 / 1603131010 | bowen_no | `BW-3507` | Thermostat 3507 |
| [897](http://www.qfbowen.com/content/?897.html) | 3072 | 19301RAF003 / 19301RAF004 | bowen_no | `BW-3072` | Thermostat 3072 |
| [898](http://www.qfbowen.com/content/?898.html) | 3515 | 19301RAAA01 / 19301RAAA02 / 19301R40A02 | bowen_no | `BW-3515` | Thermostat 3515 |
| [899](http://www.qfbowen.com/content/?899.html) | 3069（3076） | 9091603092 / 9091603093 / 9091603123 / 9 | oe_number_unique | `BW-3076` | Thermostat 3076 |
| [901](http://www.qfbowen.com/content/?901.html) | 3061 | 19300PDAE01 / 0619359B306 / WV52BC / 193 | bowen_no | `BW-3061` | Thermostat 3061 |
| [903](http://www.qfbowen.com/content/?903.html) | 3550 | 9091603097 / 9091603118 / 9091603119 / 9 | bowen_no | `BW-3550` | Thermostat 3550 |
| [904](http://www.qfbowen.com/content/?904.html) | 3598 | 9091603148 | bowen_no | `BW-3598` | Thermostat 3598 |
| [905](http://www.qfbowen.com/content/?905.html) | 3503 | 2550035540 / 2550037200 | bowen_no | `BW-3503` | Thermostat 3503 |
| [906](http://www.qfbowen.com/content/?906.html) | 30101 | 1338F5 / 9661331580 / 1096283 / XS7Q8575 | bowen_no | `BW-30101` | Thermostat 30101 |
| [907](http://www.qfbowen.com/content/?907.html) | 1026 | 3922038020 / 3922038010 | bowen_no | `BW-1026` | Temperature Sensor 1026 |
| [908](http://www.qfbowen.com/content/?908.html) | 5016 | 938103K000 | bowen_no | `BW-5016` | Thermostat 5016 |
| [909](http://www.qfbowen.com/content/?909.html) | 3517 | 1603131020 | bowen_no | `BW-3517` | Thermostat 3517 |
| [910](http://www.qfbowen.com/content/?910.html) | 3073 | J1534014 / 862019178 / 8542912 / 19301PN | bowen_no | `BW-3073` | Thermostat 3073 |
| [911](http://www.qfbowen.com/content/?911.html) | 30523 | 2120031U13 / 212004W01B / 2120031U1B / 7 | bowen_no | `BW-30523` | Thermostat 30523 |
| [912](http://www.qfbowen.com/content/?912.html) | 3011 | 2550027000 / 2550023010 / 2550023001 / 2 | bowen_no | `BW-3011` | Thermostat 3011 |
| [913](http://www.qfbowen.com/content/?913.html) | 3064 | WV54BN82 / 212000C810 / 212000C811 / 212 | bowen_no | `BW-3064` | Thermostat 3064 |
| [914](http://www.qfbowen.com/content/?914.html) | 3065 | 212306N20A / 212303RC0A / 21230EL00A / 2 | bowen_no | `BW-3065` | Thermostat 3065 |
| [915](http://www.qfbowen.com/content/?915.html) | 3500 | 90916C3009 / 9091603154 / 9091603156 | bowen_no | `BW-3500` | Thermostat 3500 |
| [916](http://www.qfbowen.com/content/?916.html) | 3565 | 255002B000 / 255002B400 / 255002B001 | bowen_no | `BW-3565` | Thermostat 3565 |
| [917](http://www.qfbowen.com/content/?917.html) | 3025 | 1767076G00 / 2550002550 / W44DX88 / 1767 | bowen_no | `BW-3025` | Thermostat 3025 |
| [918](http://www.qfbowen.com/content/?918.html) | 3023 | 13060100E0100 / 21200AA030 / 21200AA071 | bowen_no | `BW-3023` | Thermostat 3023 |
| [919](http://www.qfbowen.com/content/?919.html) | 1019 | DC00644980 / 8942202020 / 9636777180 / 1 | bowen_no | `BW-1019` | Temperature Sensor 1019 |
| [920](http://www.qfbowen.com/content/?920.html) | 1069 | 9422-22030 / WG066 / W30003823180A | bowen_no | `BW-1069` | Temperature Sensor 1069 |
| [921](http://www.qfbowen.com/content/?921.html) | 5018 | 938103K000 | bowen_no | `BW-5018` | Brake Light Switch 5018 |
| [922](http://www.qfbowen.com/content/?922.html) | 3003 | 3721306020 / 9004833077 / 9004833078 / 9 | bowen_no | `BW-3003` | Thermostat 3003 |
| [923](http://www.qfbowen.com/content/?923.html) | 3012 | 3711306030 / E4G161306020 / 4G161306020 | bowen_no | `BW-3012` | Thermostat 3012 |
| [924](http://www.qfbowen.com/content/?924.html) | 3017 | BC6UE0A9081 | bowen_no | `BW-3017` | Thermostat 3017 |
| [925](http://www.qfbowen.com/content/?925.html) | 3514 | E4T151306110 | bowen_no | `BW-3514` | Thermostat 3514 |
| [926](http://www.qfbowen.com/content/?926.html) | 35066 | F4J16-1306110 / F4J161306110 | bowen_no | `BW-35066` | Thermostat 35066 |
| [927](http://www.qfbowen.com/content/?927.html) | 1015 | A113808030 | bowen_no | `BW-1015` | Temperature Sensor 1015 |
| [930](http://www.qfbowen.com/content/?930.html) | 1046 | S11-3617011EA / S113617011EA | bowen_no | `BW-1046` | Temperature Sensor 1046 |
| [931](http://www.qfbowen.com/content/?931.html) | 2009 | A113810011 / A11-381001 | bowen_no | `BW-2009` | Oil Pressure Warning Switch 2009 |
| [932](http://www.qfbowen.com/content/?932.html) | 2011 | S11-3810010 / S113810010 | bowen_no | `BW-2011` | Oil Pressure Warning Switch 2011 |
| [935](http://www.qfbowen.com/content/?935.html) | 3004 | 481H1306020 / 481H1306010 | bowen_no | `BW-3004` | Thermostat 3004 |
| [936](http://www.qfbowen.com/content/?936.html) | 3019 | 371QA1306020 / JL3G1003650094 / 10360500 | bowen_no | `BW-3019` | Thermostat 3019 |
| [938](http://www.qfbowen.com/content/?938.html) | 35065 | D4G15B-1306110 / D4G15B1306110 | bowen_no | `BW-35065` | Thermostat 35065 |
| [942](http://www.qfbowen.com/content/?942.html) | 1050A | A15-3617011 / A153617011 | bowen_no | `BW-1050A` | Temperature Sensor 1050A |
| [943](http://www.qfbowen.com/content/?943.html) | 2010 | A11-3810010BB / A113810010BB | bowen_no | `BW-2010` | Oil Pressure Warning Switch 2010 |
| [945](http://www.qfbowen.com/content/?945.html) | 2317 | A11-3810010BC / A113810010BC | bowen_no | `BW-2317` | Oil Pressure Warning Switch 2317 |
| [946](http://www.qfbowen.com/content/?946.html) | 6003 | 020945415A / UMB10003 / 002945515A / 002 | bowen_no | `BW-6003` | Reverse Light Switch 6003 |
| [952](http://www.qfbowen.com/content/?952.html) | 3831A | 01653961 / 01659446 | bowen_no | `BW-3831A` | Thermostat 3831A |
| [958](http://www.qfbowen.com/content/?958.html) | 3831 | 1016050726 | bowen_no | `BW-3831` | Thermostat 3831 |
| [959](http://www.qfbowen.com/content/?959.html) | 3020 | LF7015170 / 4M5G8575FC / 1302167 / 13557 | bowen_no | `BW-3020` | Thermostat 3020 |
| [960](http://www.qfbowen.com/content/?960.html) | 3252A | 55224021 / 1538707 / 1580532 / 55180041 | bowen_no | `BW-3252A` | Thermostat 3252A |
| [961](http://www.qfbowen.com/content/?961.html) | 33910 | LF7015170 / 4M5G8575FC / 1302167 / 13557 | bowen_no | `BW-33910` | Thermostat 33910 |
| [965](http://www.qfbowen.com/content/?965.html) | 3203 | 1089796 / 1148164 / 1313546 / 3S6G8575A2 | bowen_no | `BW-3203` | Thermostat 3203 |
| [966](http://www.qfbowen.com/content/?966.html) | 1038 | 1089854 / XS6F-12A648-BA / XS6F12A648BA | bowen_no | `BW-1038` | Temperature Sensor 1038 |
| [967](http://www.qfbowen.com/content/?967.html) | 2028 | 3818020-37K / 3818020 | bowen_no | `BW-2028` | Oil Pressure Warning Switch 2028 |
| [968](http://www.qfbowen.com/content/?968.html) | 1040 | 3L8A-12A648-BA / 3L8A12A648BA | bowen_no | `BW-1040` | Temperature Sensor 1040 |
| [969](http://www.qfbowen.com/content/?969.html) | 2029 | 98AB92278AA / 330029 / 3M519278AB / 3818 | bowen_no | `BW-2029` | Oil Pressure Warning Switch 2029 |
| [971](http://www.qfbowen.com/content/?971.html) | 2103 | 483Q-18501 / 483Q18501 / 3782080G01 / Z6 | bowen_no | `BW-2103` | Oil Pressure Warning Switch 2103 |
| [972](http://www.qfbowen.com/content/?972.html) | 3016 | S13069010-37K / L32715170A / 8541308 / L | bowen_no | `BW-3016` | Thermostat 3016 |
| [973](http://www.qfbowen.com/content/?973.html) | 3522 | BM5G9K478BB / 1827900 | bowen_no | `BW-3522` | Thermostat 3522 |
| [974](http://www.qfbowen.com/content/?974.html) | 35650 | 5653258 / 5603485 / FR3Z8575A | bowen_no | `BW-35650` | Thermostat 35650 |
| [975](http://www.qfbowen.com/content/?975.html) | 3077 | BYD4831306020 / 479Q15171 / 483Q15171 / | bowen_no | `BW-3077` | Thermostat 3077 |
| [976](http://www.qfbowen.com/content/?976.html) | 3094 | 4M5G8575ZB / 96MM8575A1A / 96MM8575BE / | bowen_no | `BW-3094` | Thermostat 3094 |
| [977](http://www.qfbowen.com/content/?977.html) | 31510 | 1001993 / 1086282 / 6169774 / 89FF8575AA | bowen_no | `BW-31510` | Thermostat 31510 |
| [979](http://www.qfbowen.com/content/?979.html) | 1039 | XU3F-12A648-AA / XU3F12A648AA | bowen_no | `BW-1039` | Temperature Sensor 1039 |
| [981](http://www.qfbowen.com/content/?981.html) | 1047 | 1338C1 / 9632562480 / 9632562080 / 13426 | bowen_no | `BW-1047` | Temperature Sensor 1047 |
| [982](http://www.qfbowen.com/content/?982.html) | 1002 | 06A919501 / 06A919501A / 1100736 / 01354 | bowen_no | `BW-1002` | Temperature Sensor 1002 |
| [983](http://www.qfbowen.com/content/?983.html) | 2033 | 1J0919081 / FA01-32230 / FA0132230 | bowen_no | `BW-2033` | Oil Pressure Warning Switch 2033 |
| [984](http://www.qfbowen.com/content/?984.html) | 2191 | LJ469QE2-3810010 / LJ469QE23810010 / 410 | bowen_no | `BW-2191` | Oil Pressure Warning Switch 2191 |
| [985](http://www.qfbowen.com/content/?985.html) | 3038 | 06H121005S / 06H121111K / 06H121026CQ | bowen_no | `BW-3038` | Thermostat 3038 |
| [986](http://www.qfbowen.com/content/?986.html) | 3336 | 04E121121F / 04E121042H / 04E109111L | bowen_no | `BW-3336` | Thermostat 3336 |
| [987](http://www.qfbowen.com/content/?987.html) | 303401 | 03C121026AP / 03C121111AK | bowen_no | `BW-303401` | Thermostat 303401 |
| [988](http://www.qfbowen.com/content/?988.html) | 3086 | 032121111AP / 032121111AN / 032121111BG | bowen_no | `BW-3086` | Thermostat 3086 |
| [989](http://www.qfbowen.com/content/?989.html) | 3085 | 06E121111AL / 06E121111AD | bowen_no | `BW-3085` | Thermostat 3085 |
| [990](http://www.qfbowen.com/content/?990.html) | 3082 | 06D121111G | bowen_no | `BW-3082` | Thermostat 3082 |
| [992](http://www.qfbowen.com/content/?992.html) | 3842 | 04E121113F / 04E121113B / 04E121113N | bowen_no | `BW-3842` | Thermostat 3842 |
| [993](http://www.qfbowen.com/content/?993.html) | 3816 | 03C121113J | bowen_no | `BW-3816` | Thermostat 3816 |
| [994](http://www.qfbowen.com/content/?994.html) | 3001 | 056121113D / 86203787 / 030121113B / 068 | bowen_no | `BW-3001` | Thermostat 3001 |
| [995](http://www.qfbowen.com/content/?995.html) | 3080 | 078121113F | bowen_no | `BW-3080` | Thermostat 3080 |
| [996](http://www.qfbowen.com/content/?996.html) | 3310 | 06J121113A / 06J121113C | bowen_no | `BW-3310` | Thermostat 3310 |
| [997](http://www.qfbowen.com/content/?997.html) | 1001 | 059919501A / 1100619 / 1124770 / XM218A5 | bowen_no | `BW-1001` | Temperature Sensor 1001 |
| [998](http://www.qfbowen.com/content/?998.html) | 1003 | 357919501A / 6U0919501B / 1669948 / 95VW | bowen_no | `BW-1003` | Temperature Sensor 1003 |
| [999](http://www.qfbowen.com/content/?999.html) | 1008 | 251919501A / 251919501D / 1669949 / 95VW | bowen_no | `BW-1008` | Temperature Sensor 1008 |
| [1000](http://www.qfbowen.com/content/?1000.html) | 2003 | 06A919081B / 037919081B | bowen_no | `BW-2003` | Oil Pressure Warning Switch 2003 |
| [1001](http://www.qfbowen.com/content/?1001.html) | 2005 | 06A919081A / 06A919081D / 06A919081E / 0 | bowen_no | `BW-2005` | Oil Pressure Warning Switch 2005 |
| [1002](http://www.qfbowen.com/content/?1002.html) | 2007 | 06A919081F / P700000322 | bowen_no | `BW-2007` | Oil Pressure Warning Switch 2007 |
| [1003](http://www.qfbowen.com/content/?1003.html) | 2032 | 06E919081C | bowen_no | `BW-2032` | Oil Pressure Warning Switch 2032 |
| [1004](http://www.qfbowen.com/content/?1004.html) | 2035 | 06H919081A | bowen_no | `BW-2035` | Oil Pressure Warning Switch 2035 |
| [1005](http://www.qfbowen.com/content/?1005.html) | 2037 | 06D919081B | bowen_no | `BW-2037` | Oil Pressure Warning Switch 2037 |
| [1006](http://www.qfbowen.com/content/?1006.html) | 4002 | 321959481D / 191959481A / 191959481C | bowen_no | `BW-4002` | Thermal Switch 4002 |
| [1007](http://www.qfbowen.com/content/?1007.html) | 4004 | A11-1305011 / A111305011 / 1H0959481B / | bowen_no | `BW-4004` | Thermal Switch 4004 |
| [1008](http://www.qfbowen.com/content/?1008.html) | 5001 | 322945515 | bowen_no | `BW-5001` | Brake Light Switch 5001 |
| [1009](http://www.qfbowen.com/content/?1009.html) | 6001 | 084941521 / 014919361 | bowen_no | `BW-6001` | Reverse Light Switch 6001 |
| [1011](http://www.qfbowen.com/content/?1011.html) | 30116 | 06L121111H / 06L121111G / 06L121111F / 0 | bowen_no | `BW-30116` | Thermostat 30116 |
| [1012](http://www.qfbowen.com/content/?1012.html) | 3083 | 06B121111D / 06B121111G / 06B121111H / 0 | bowen_no | `BW-3083` | Thermostat 3083 |
| [1013](http://www.qfbowen.com/content/?1013.html) | 303402 | 03C121111T / 03C121111AM / 03C121111P / | bowen_no | `BW-303402` | Thermostat 303402 |
| [1014](http://www.qfbowen.com/content/?1014.html) | 3084 | 06E121111G / 06E121111H | bowen_no | `BW-3084` | Thermostat 3084 |
| [1015](http://www.qfbowen.com/content/?1015.html) | 3037 | 06B121111M / 06F121111G | bowen_no | `BW-3037` | Thermostat 3037 |
| [1016](http://www.qfbowen.com/content/?1016.html) | 3081 | 06F121111H / 06F121111J / 06F121111F | bowen_no | `BW-3081` | Thermostat 3081 |
| [1017](http://www.qfbowen.com/content/?1017.html) | 3535 | 07K121115C | bowen_no | `BW-3535` | Thermostat 3535 |
| [1018](http://www.qfbowen.com/content/?1018.html) | 3841 | 04E121113G / 04E121113C | bowen_no | `BW-3841` | Thermostat 3841 |
| [1019](http://www.qfbowen.com/content/?1019.html) | 3087 | 06E121161R / 06E121168 / 06E121168B / 6E | bowen_no | `BW-3087` | Thermostat 3087 |
| [1020](http://www.qfbowen.com/content/?1020.html) | 3002 | 050121113C / 06B121113A / GTS298 / 13380 | bowen_no | `BW-3002` | Thermostat 3002 |
| [1021](http://www.qfbowen.com/content/?1021.html) | 3516 | 03H121113 / 03H121113A / 03H121113B | bowen_no | `BW-3516` | Thermostat 3516 |
| [1022](http://www.qfbowen.com/content/?1022.html) | 3533 | 03L121111AE | bowen_no | `BW-3533` | Thermostat 3533 |
| [1024](http://www.qfbowen.com/content/?1024.html) | 1004 | 1J0919379A | bowen_no | `BW-1004` | Temperature Sensor 1004 |
| [1025](http://www.qfbowen.com/content/?1025.html) | 1013 | 8Z0820535 | bowen_no | `BW-1013` | Temperature Sensor 1013 |
| [1026](http://www.qfbowen.com/content/?1026.html) | 2004 | 028919081E / 1094738 / 95VW9278DA | bowen_no | `BW-2004` | Oil Pressure Warning Switch 2004 |
| [1027](http://www.qfbowen.com/content/?1027.html) | 2006 | 06A919081E / 06A919081A / 06A919081D / 0 | bowen_no | `BW-2006` | Oil Pressure Warning Switch 2006 |
| [1028](http://www.qfbowen.com/content/?1028.html) | 2008 | 038919081C / 038919081H / 038919081K / 0 | bowen_no | `BW-2008` | Oil Pressure Warning Switch 2008 |
| [1030](http://www.qfbowen.com/content/?1030.html) | 2036 | 038919081H | bowen_no | `BW-2036` | Oil Pressure Warning Switch 2036 |
| [1031](http://www.qfbowen.com/content/?1031.html) | 5003 | 1C0945511A | bowen_no | `BW-5003` | Brake Light Switch 5003 |
| [1032](http://www.qfbowen.com/content/?1032.html) | 4003 | 8D0959481B | bowen_no | `BW-4003` | Thermal Switch 4003 |
| [1033](http://www.qfbowen.com/content/?1033.html) | 4005 | 1J0959481A / 820035 | bowen_no | `BW-4005` | Thermal Switch 4005 |
| [1034](http://www.qfbowen.com/content/?1034.html) | 5002 | 191945515 / 1044350 / 191945515A / 19194 | bowen_no | `BW-5002` | Brake Light Switch 5002 |
| [1035](http://www.qfbowen.com/content/?1035.html) | 6002 | 084941521 / 014919361 | bowen_no | `BW-6002` | Reverse Light Switch 6002 |
| [1036](http://www.qfbowen.com/content/?1036.html) | 6004 | 02T945415 / 02K945415C / 02K945415D / 02 | bowen_no | `BW-6004` | Reverse Light Switch 6004 |
| [1037](http://www.qfbowen.com/content/?1037.html) | 3056 | 10120201820000 | bowen_no | `BW-3056` | Thermostat 3056 |
| [1038](http://www.qfbowen.com/content/?1038.html) | 3541 | 10120202040000 | bowen_no | `BW-3541` | Thermostat 3541 |
| [1041](http://www.qfbowen.com/content/?1041.html) | 3055 | 1500060117 / 10120201610000 | bowen_no | `BW-3055` | Thermostat 3055 |
| [1042](http://www.qfbowen.com/content/?1042.html) | 3058 | 10120202010000 | bowen_no | `BW-3058` | Thermostat 3058 |
| [1043](http://www.qfbowen.com/content/?1043.html) | 3654--3 | 9810916980 | bowen_no | `BW-3654--3` | Thermostat 3654--3 |
| [1045](http://www.qfbowen.com/content/?1045.html) | 3251 | 1338039 / 1338154 / 1338275 / 1769079J50 | bowen_no | `BW-3251` | Thermostat 3251 |
| [1047](http://www.qfbowen.com/content/?1047.html) | 3288 | 60812410 / 60602148 | bowen_no | `BW-3288` | Thermostat 3288 |
| [1048](http://www.qfbowen.com/content/?1048.html) | 3569 | 12518611289 | bowen_no | `BW-3569` | Thermostat 3569 |
| [1052](http://www.qfbowen.com/content/?1052.html) | 2014 | DC00038680 / DC00038681 | bowen_no | `BW-2014` | Oil Pressure Warning Switch 2014 |
| [1053](http://www.qfbowen.com/content/?1053.html) | 5013 | 9670430580 / 453470 / 9804869480 | bowen_no | `BW-5013` | Brake Light Switch 5013 |
| [1054](http://www.qfbowen.com/content/?1054.html) | 6005 | 96040821 | bowen_no | `BW-6005` | Reverse Light Switch 6005 |
| [1055](http://www.qfbowen.com/content/?1055.html) | 6007 | 225742 / 225753 / 320056F901 / 963387568 | bowen_no | `BW-6007` | Reverse Light Switch 6007 |
| [1056](http://www.qfbowen.com/content/?1056.html) | 3655 | 1336CC | bowen_no | `BW-3655` | Thermostat 3655 |
| [1057](http://www.qfbowen.com/content/?1057.html) | 30102 | 8200772985 / 4408334 / 7700872544 / 7700 | bowen_no | `BW-30102` | Thermostat 30102 |
| [1058](http://www.qfbowen.com/content/?1058.html) | 3252 | 6338022 / 1769084E50 / 1769086J00 / 4708 | bowen_no | `BW-3252` | Thermostat 3252 |
| [1059](http://www.qfbowen.com/content/?1059.html) | 3253 | 6338039 / 1338020 / 55194271 / 55202373 | bowen_no | `BW-3253` | Thermostat 3253 |
| [1060](http://www.qfbowen.com/content/?1060.html) | 3289 | 60816681 / 60816317 / 46790294 | bowen_no | `BW-3289` | Thermostat 3289 |
| [1061](http://www.qfbowen.com/content/?1061.html) | 3568 | 12517646145 / 9804315380 | bowen_no | `BW-3568` | Thermostat 3568 |
| [1062](http://www.qfbowen.com/content/?1062.html) | 1020 | 9636777280 / 9631000880 / 133897 / 1338A | bowen_no | `BW-1020` | Temperature Sensor 1020 |
| [1063](http://www.qfbowen.com/content/?1063.html) | 1053 | 96131470 / 1920K9 / 30010 / 9613147080 / | bowen_no | `BW-1053` | Temperature Sensor 1053 |
| [1064](http://www.qfbowen.com/content/?1064.html) | 1052 | 1338F3 / 1338F8 / 96566364 / 13627535068 | bowen_no | `BW-1052` | Temperature Sensor 1052 |
| [1065](http://www.qfbowen.com/content/?1065.html) | 2015 | 133C5 / 9631846480 / SU00100591 / 165828 | bowen_no | `BW-2015` | Oil Pressure Warning Switch 2015 |
| [1066](http://www.qfbowen.com/content/?1066.html) | 5020 | 9818232480 / 9670430580 / 453470 / 36376 | bowen_no | `BW-5020` | Brake Light Switch 5020 |
| [1067](http://www.qfbowen.com/content/?1067.html) | 6006 | 9662906680 | bowen_no | `BW-6006` | Reverse Light Switch 6006 |
| [1068](http://www.qfbowen.com/content/?1068.html) | 6008 | 225752 / 225743 / 225759 / 3761073J01 / | bowen_no | `BW-6008` | Reverse Light Switch 6008 |
| [1071](http://www.qfbowen.com/content/?1071.html) | 3067 | 476ZQA1306020 | bowen_no | `BW-3067` | Thermostat 3067 |
| [1072](http://www.qfbowen.com/content/?1072.html) | 3060 | 476ZQA21306100 | bowen_no | `BW-3060` | Thermostat 3060 |
| [1074](http://www.qfbowen.com/content/?1074.html) | 31054 | 472QA1306100 | bowen_no | `BW-31054` | Thermostat 31054 |
| [1075](http://www.qfbowen.com/content/?1075.html) | 3536 | 487ZQA1306010 | bowen_no | `BW-3536` | Thermostat 3536 |
| [1078](http://www.qfbowen.com/content/?1078.html) | 3576 | 476ZQA-6-1306100-D1 / 476ZQA61306100D1 / | bowen_no | `BW-3576` | Thermostat 3576 |
| [1079](http://www.qfbowen.com/content/?1079.html) | 3537 | 476ZQC1306100 | bowen_no | `BW-3537` | Thermostat 3537 |
| [1082](http://www.qfbowen.com/content/?1082.html) | 1031 | 476ZQA3611100 / 476ZQA-3611100 / F01R00K | bowen_no | `BW-1031` | Temperature Sensor 1031 |
| [1083](http://www.qfbowen.com/content/?1083.html) | 1049 | BYD471ZQA3611100 / 04E919501C | bowen_no | `BW-1049` | Temperature Sensor 1049 |
| [1085](http://www.qfbowen.com/content/?1085.html) | 1168 | 471QTHA1300800 / 1026604GE | bowen_no | `BW-1168` | Temperature Sensor 1168 |
| [1087](http://www.qfbowen.com/content/?1087.html) | 2038 | 476ZQA-3611600 / 476ZQA3611600 | bowen_no | `BW-2038` | Oil Pressure Warning Switch 2038 |
| [1089](http://www.qfbowen.com/content/?1089.html) | 6015 | 5T14-4112010 / 5T144112010 | bowen_no | `BW-6015` | Reverse Light Switch 6015 |

### 为什么有这么多需要人工确认

旧站 813 个产品详情页里，只有 550 个写了「博文编号」，
263 个页面**既没有博文编号也没有 OEM 号码** —— 只有一张详情图和一个中文产品名（例如多个页面标题都是「节温器」）。
在这种情况下，任何"看起来像"的判断都是在猜，因此程序全部标为 `review_required`。

### 人工确认表

路径：**`review/legacy-product-image-mapping.xlsx`**（4 个工作表）

| 工作表 | 内容 |
|---|---|
| 填表说明 | 怎么填、颜色约定、红线说明 |
| 图片匹配审核 | 794 张图片逐张核对（含人工确认列 + 下拉菜单） |
| 按旧站页面汇总 | 813 个旧站页面汇总 |
| 无编号页面 | 263 个无任何编号的页面，优先人工处理 |

🟡 黄色列 = 手工填写 ｜ 🟢 绿色列 = 下拉选择 ｜ 🔴 红色标记 = `auto_match` 重点抽查项

---

## 五、E. 公司素材映射建议

> **只做映射建议，不替换任何网页。**

| 目标页面 | 当前状态 | 建议来源素材 | 注意事项 |
|---|---|---|---|
| **Home** | 首页为纯文字/SVG 版式，无真实照片 | 8 个候选素材 | 首页 Hero 目前是文字型设计，直接塞旧站 Banner 会破坏版式与英文可读性。 |
| **Factory** | 四个工序（Machining/Assembly/Automated Assembly/Testing）全部为纯文字，无工序照片 | 12 个候选素材 | 需逐张确认照片与"该工序"是否真的一致——不得为了让版面好看而错误标注工序。 |
| **Quality** | 体系与证书区块为占位，等待质量部门确认 | 6 个候选素材 | 证书必须逐张核对有效期与适用范围；已过期证书严禁上站（见 content_review 的 Outdated 判定）。 |
| **About Bowen** | 公司事实（2009 年建厂、10000㎡ 等）来自公司资料，配图为空 | 6 个候选素材 | 旧站公司简介文字为国内营销腔调，只能作为事实核对来源，不可直译。 |
| **Contact** | 邮箱为占位；公司注册信息、电话、地址、地图均标注 pending | 2 个候选素材 | 旧站电话 0537-4598999、地址「曲阜市东开发区台湾工业园创业大道新竹路」属国内渠道，英文站是否公开需业务方决定，不得默认沿用。 |

### 逐页说明

#### Home

- **目标页面**：`http://localhost:3000/ (website/src/app/(site)/page.tsx)`
- **现状**：首页为纯文字/SVG 版式，无真实照片
- **建议**：首页目前完全没有真实照片。产品实拍图与公司照片是最缺的内容 —— 首页的产品橱窗区块最需要它。
- **注意**：首页 Hero 目前是文字型设计，直接塞旧站 Banner 会破坏版式与英文可读性。
- **候选素材**（前 8 个）：
  - `images/products/202404020933343079.jpg` (800x800) — 被「product」类页面引用
  - `images/products/202404020933558469.jpg` (800x800) — 被「product」类页面引用
  - `images/products/202404020934149213.jpg` (800x800) — 被「product」类页面引用
  - `images/products/202404020934313371.jpg` (800x800) — 被「product」类页面引用
  - `images/products/202404020934514370.jpg` (800x800) — 被「product」类页面引用
  - `images/products/202404020935087577.jpg` (800x800) — 被「product」类页面引用
  - `images/company/about.jpg` (757x584) — 被「company」类页面引用
  - `images/company/qywh.jpg` (757x662) — 被「company」类页面引用

#### Factory

- **目标页面**：`http://localhost:3000/factory (website/src/app/(site)/factory/page.tsx)`
- **现状**：四个工序（Machining/Assembly/Automated Assembly/Testing）全部为纯文字，无工序照片
- **建议**：旧站「厂房厂貌」与「生产设备」栏目照片正是这里缺的内容，建议按四个工序挑选对应照片。
- **注意**：需逐张确认照片与"该工序"是否真的一致——不得为了让版面好看而错误标注工序。
- **候选素材**（前 8 个）：
  - `images/factory/sb01.jpg` (1260x715) — 被「factory」类页面引用
  - `images/factory/sb02.jpg` (1259x709) — 被「factory」类页面引用
  - `images/factory/sb03.jpg` (1259x707) — 被「factory」类页面引用
  - `images/factory/sb04.jpg` (1260x708) — 被「factory」类页面引用
  - `images/factory/202404150944108021.jpg` (500x368) — 被「factory」类页面引用（同时被 product / factory 类页面引用，按最具体类别归类）
  - `images/factory/202404150944471217.jpg` (500x368) — 被「factory」类页面引用（同时被 product / factory 类页面引用，按最具体类别归类）
  - `images/factory/202404150945192944.jpg` (500x368) — 被「factory」类页面引用（同时被 product / factory 类页面引用，按最具体类别归类）
  - `images/factory/202504191355167075.jpg` (500x368) — 被「factory」类页面引用（同时被 product / factory 类页面引用，按最具体类别归类）

#### Quality

- **目标页面**：`http://localhost:3000/quality (website/src/app/(site)/quality/page.tsx)`
- **现状**：体系与证书区块为占位，等待质量部门确认
- **建议**：旧站「荣誉资质」的证书图片可作为 IATF 16949 / ISO 14001 / ISO 45001 之外的补充材料来源。
- **注意**：证书必须逐张核对有效期与适用范围；已过期证书严禁上站（见 content_review 的 Outdated 判定）。
- **候选素材**（前 6 个）：
  - `images/certificates/202504191331422372.jpg` (424x600) — 被「certificate」类页面引用（同时被 product / certificate 类页面引用，按最具体类别归类）
  - `images/certificates/20250419133239795.jpg` (424x600) — 被「certificate」类页面引用（同时被 product / certificate 类页面引用，按最具体类别归类）
  - `images/certificates/202504191333133860.jpg` (424x600) — 被「certificate」类页面引用（同时被 product / certificate 类页面引用，按最具体类别归类）
  - `images/certificates/202504191334188886.jpg` (424x600) — 被「certificate」类页面引用（同时被 product / certificate 类页面引用，按最具体类别归类）
  - `images/certificates/202504191334365239.jpg` (424x600) — 被「certificate」类页面引用（同时被 product / certificate 类页面引用，按最具体类别归类）
  - `images/certificates/202601310937157572.jpg` (424x600) — 被「certificate」类页面引用（同时被 product / certificate 类页面引用，按最具体类别归类）

#### About Bowen

- **目标页面**：`http://localhost:3000/about (website/src/app/(site)/about/page.tsx)`
- **现状**：公司事实（2009 年建厂、10000㎡ 等）来自公司资料，配图为空
- **建议**：公司外景、厂区照片适合用于 About 页增强真实感。
- **注意**：旧站公司简介文字为国内营销腔调，只能作为事实核对来源，不可直译。
- **候选素材**（前 6 个）：
  - `images/company/about.jpg` (757x584) — 被「company」类页面引用
  - `images/company/qywh.jpg` (757x662) — 被「company」类页面引用
  - `images/other/1228493bc9f61702686af8bcb0d2e294d3e10d97.jpg` (328x378) — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认
  - `images/other/1ea39182691eeeaa3ee8dd052ecb14d927993420.jpg` (328x378) — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认
  - `images/other/20db42ebf68dd4b5e79c2d70aa2217de49a716f2.png` (52x52) — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
  - `images/other/29bd402d621f3a6e512d4e31f121735ddaa03757.jpg` (328x378) — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认

#### Contact

- **目标页面**：`http://localhost:3000/contact (website/src/app/(site)/contact/page.tsx)`
- **现状**：邮箱为占位；公司注册信息、电话、地址、地图均标注 pending
- **建议**：旧站可提供"注册公司全称"等可核对事实；地图/二维码类素材不建议使用。
- **注意**：旧站电话 0537-4598999、地址「曲阜市东开发区台湾工业园创业大道新竹路」属国内渠道，英文站是否公开需业务方决定，不得默认沿用。
- **候选素材**（前 2 个）：
  - `images/company/about.jpg` (757x584) — 被「company」类页面引用
  - `images/company/qywh.jpg` (757x662) — 被「company」类页面引用

### 明确不建议迁移的公司素材

共 29 个。原因：模板装饰、图标、二维码、加载图等对英文站无价值或会带来品牌风险。

- `images/other/20db42ebf68dd4b5e79c2d70aa2217de49a716f2.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
- `images/other/3328b91bf1b7d8fbf14f988b3dee09257137ff31.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
- `images/other/3aff84d27fc39a1ac619d343d759613d4ec34097.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
- `images/other/8330df25a3358139108af7bf0e9146a3db3321b8.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
- `images/other/8f14b6336d0f706d8eae661f73a72b2170a251d6.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
- `images/other/94d639b6d5b1ed7a637ce5a9ed36a23886c1c0cd.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 40x40（≤64px），属图标/项目符号类装饰件
- `images/other/a1e5ea5850461d616e95c94e9bda00d4525f4ad7.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
- `images/other/a421f87c146ee699bf0f020d41f3dcd8590adaea.png` — 仅出现在首页。首页是混合内容页（Banner/产品橱窗/公司图/图标混杂），无法可靠判定用途，需人工确认；实测尺寸 52x52（≤64px），属图标/项目符号类装饰件
- `images/other/banner01.jpg` — 文件名特征显示为装饰/图标/二维码/栏目 Banner 类模板素材（banner01.jpg），英文站不应原样沿用
- `images/other/banner02.jpg` — 文件名特征显示为装饰/图标/二维码/栏目 Banner 类模板素材（banner02.jpg），英文站不应原样沿用

---

## 六、F. 内容质量审核

对全部 943 个抓取页面逐页做了内容质量判定。

| 分类 | 页面数 | 说明 |
|---|---|---|
| 可直接复用（语言中立的技术数据） | 552 | 语言中立的技术数据（编号/温度），可直接使用 |
| 需英文重写 | 390 | 中文文案需人工重写为英文，不能直译 |
| 已过时 | 0 | 含过期信息（发布时间过久或证书失效） |
| 仅适用于国内市场 | 0 | 国内平台链接 / 备案号 / 国内电话地址 |
| 不可使用 | 1 | 绝对化宣传、模板缺陷、无实质内容 |

### 特别检查项（需求书指定）

#### ① 站点级问题：全站页脚/模板样板（**每一页都有**）

> 旧站的页脚与侧栏模板把下列内容注入到**全部 943 个页面**。
> 它们不是某一页的内容，而是"整站都带着"的问题 —— 迁移时只要不照搬模板即可一次性消除。

| 检查项 | 命中页面数 | 占比 | 判定 |
|---|---|---|---|
| 夸张营销语 | 943 / 943 | **100%** | Needs English rewrite |
| 国内平台链接 | 943 / 943 | **100%** | Domestic-market only |
| 国内备案信息 | 943 / 943 | **100%** | Domestic-market only |
| 旧联系方式（国内电话） | 943 / 943 | **100%** | Domestic-market only |
| 旧地址（中文国内地址） | 943 / 943 | **100%** | Domestic-market only |
| 无法证明的数据/模糊表述 | 943 / 943 | **100%** | Needs English rewrite |
| 留言板/低价值页 | 943 / 943 | **100%** | Do not use |

#### ② 页面自身的问题（已剔除上面这些全站样板）

| 检查项 | 命中页面数 |
|---|---|
| 夸张营销语 | 0 |
| 绝对化宣传 | 1 |
| 国内平台链接 | 0 |
| 国内备案信息 | 0 |
| 旧联系方式（国内电话） | 0 |
| 旧地址 | 0 |
| 无法证明的数据 | 0 |
| 已过时（发布时间/证书有效期） | 0 |
| 模板未渲染占位符 | 0 |

**命中绝对化宣传的页面**（需在英文站改写成事实型表达）：

- [http://www.qfbowen.com/about/?57.html](http://www.qfbowen.com/about/?57.html) —— 命中样本：完美

**发布时间分布**（判断旧站维护活跃度）：

| 发布年份 | 页面数 |
|---|---|
| 2025 | 5 |
| 2024 | 808 |
| (无发布时间) | 130 |

> 说明：两遍法：先统计全部命中，再剔除"出现在 ≥50% 页面上的样板文字"（旧站页脚模板把 ICP 备案、国内固话、留言入口注入到每一页），最后只依据"页面自身内容"给出单一结论。站点级问题单独列在 site_wide_findings 中，不重复计入每一页。

### 旧站在用的公司联系方式（供业务方核对，**不直接搬上英文站**）

| 项目 | 旧站公开值 |
|---|---|
| 公司中文全称 | 曲阜市博文汽车零部件制造有限公司 |
| 电话 | 0537-4598999 |
| 邮箱 | qfbowen@126.com |
| 地址 | 曲阜市东开发区台湾工业园创业大道新竹路 |
| 联系人 | 关经理 |
| ICP 备案号 | 鲁ICP备2024083789号-1 |

> 这些是**国内渠道**信息。英文站是否公开固话/中文地址，需要业务方决定；
> 其中"公司中文全称"可作为注册主体事实核对来源。

### 逐页审核明细

<details>
<summary>点击展开全部 943 个页面的判定（含命中样本）</summary>

| 页面 | 栏目 | 判定 | 原因 | 命中样本 |
|---|---|---|---|---|
| [home](http://www.qfbowen.com/) | home | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [about_1](http://www.qfbowen.com/about/?1.html) | about-profile | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [about_57](http://www.qfbowen.com/about/?57.html) | about-culture | 不可使用 | 绝对化宣传 | 完美 |
| [about_6](http://www.qfbowen.com/about/?6.html) | contact | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [about_84](http://www.qfbowen.com/about/?84.html) | equipment | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1000](http://www.qfbowen.com/content/?1000.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1001](http://www.qfbowen.com/content/?1001.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1002](http://www.qfbowen.com/content/?1002.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1003](http://www.qfbowen.com/content/?1003.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1004](http://www.qfbowen.com/content/?1004.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1005](http://www.qfbowen.com/content/?1005.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1006](http://www.qfbowen.com/content/?1006.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1007](http://www.qfbowen.com/content/?1007.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1008](http://www.qfbowen.com/content/?1008.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1009](http://www.qfbowen.com/content/?1009.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1010](http://www.qfbowen.com/content/?1010.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1011](http://www.qfbowen.com/content/?1011.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1012](http://www.qfbowen.com/content/?1012.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1013](http://www.qfbowen.com/content/?1013.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1014](http://www.qfbowen.com/content/?1014.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1015](http://www.qfbowen.com/content/?1015.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1016](http://www.qfbowen.com/content/?1016.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1017](http://www.qfbowen.com/content/?1017.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1018](http://www.qfbowen.com/content/?1018.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1019](http://www.qfbowen.com/content/?1019.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1020](http://www.qfbowen.com/content/?1020.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1021](http://www.qfbowen.com/content/?1021.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1022](http://www.qfbowen.com/content/?1022.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1023](http://www.qfbowen.com/content/?1023.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1024](http://www.qfbowen.com/content/?1024.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1025](http://www.qfbowen.com/content/?1025.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1026](http://www.qfbowen.com/content/?1026.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1027](http://www.qfbowen.com/content/?1027.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1028](http://www.qfbowen.com/content/?1028.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1029](http://www.qfbowen.com/content/?1029.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1030](http://www.qfbowen.com/content/?1030.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1031](http://www.qfbowen.com/content/?1031.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1032](http://www.qfbowen.com/content/?1032.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1033](http://www.qfbowen.com/content/?1033.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1034](http://www.qfbowen.com/content/?1034.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1035](http://www.qfbowen.com/content/?1035.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1036](http://www.qfbowen.com/content/?1036.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1037](http://www.qfbowen.com/content/?1037.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1038](http://www.qfbowen.com/content/?1038.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1039](http://www.qfbowen.com/content/?1039.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1040](http://www.qfbowen.com/content/?1040.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1041](http://www.qfbowen.com/content/?1041.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1042](http://www.qfbowen.com/content/?1042.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1043](http://www.qfbowen.com/content/?1043.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1044](http://www.qfbowen.com/content/?1044.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1045](http://www.qfbowen.com/content/?1045.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1046](http://www.qfbowen.com/content/?1046.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1047](http://www.qfbowen.com/content/?1047.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1048](http://www.qfbowen.com/content/?1048.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1049](http://www.qfbowen.com/content/?1049.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1050](http://www.qfbowen.com/content/?1050.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1051](http://www.qfbowen.com/content/?1051.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1052](http://www.qfbowen.com/content/?1052.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1053](http://www.qfbowen.com/content/?1053.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1054](http://www.qfbowen.com/content/?1054.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1055](http://www.qfbowen.com/content/?1055.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1056](http://www.qfbowen.com/content/?1056.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1057](http://www.qfbowen.com/content/?1057.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1058](http://www.qfbowen.com/content/?1058.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1059](http://www.qfbowen.com/content/?1059.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1060](http://www.qfbowen.com/content/?1060.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1061](http://www.qfbowen.com/content/?1061.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1062](http://www.qfbowen.com/content/?1062.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1063](http://www.qfbowen.com/content/?1063.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1064](http://www.qfbowen.com/content/?1064.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1065](http://www.qfbowen.com/content/?1065.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1066](http://www.qfbowen.com/content/?1066.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1067](http://www.qfbowen.com/content/?1067.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1068](http://www.qfbowen.com/content/?1068.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1069](http://www.qfbowen.com/content/?1069.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1070](http://www.qfbowen.com/content/?1070.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1071](http://www.qfbowen.com/content/?1071.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1072](http://www.qfbowen.com/content/?1072.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1073](http://www.qfbowen.com/content/?1073.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1074](http://www.qfbowen.com/content/?1074.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1075](http://www.qfbowen.com/content/?1075.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1076](http://www.qfbowen.com/content/?1076.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1077](http://www.qfbowen.com/content/?1077.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1078](http://www.qfbowen.com/content/?1078.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1079](http://www.qfbowen.com/content/?1079.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1080](http://www.qfbowen.com/content/?1080.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1081](http://www.qfbowen.com/content/?1081.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1082](http://www.qfbowen.com/content/?1082.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1083](http://www.qfbowen.com/content/?1083.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1084](http://www.qfbowen.com/content/?1084.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1085](http://www.qfbowen.com/content/?1085.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1086](http://www.qfbowen.com/content/?1086.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1087](http://www.qfbowen.com/content/?1087.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1088](http://www.qfbowen.com/content/?1088.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1089](http://www.qfbowen.com/content/?1089.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1090](http://www.qfbowen.com/content/?1090.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1091](http://www.qfbowen.com/content/?1091.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1092](http://www.qfbowen.com/content/?1092.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1093](http://www.qfbowen.com/content/?1093.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1094](http://www.qfbowen.com/content/?1094.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1095](http://www.qfbowen.com/content/?1095.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1096](http://www.qfbowen.com/content/?1096.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1097](http://www.qfbowen.com/content/?1097.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1098](http://www.qfbowen.com/content/?1098.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1099](http://www.qfbowen.com/content/?1099.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1100](http://www.qfbowen.com/content/?1100.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1101](http://www.qfbowen.com/content/?1101.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1102](http://www.qfbowen.com/content/?1102.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1103](http://www.qfbowen.com/content/?1103.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1104](http://www.qfbowen.com/content/?1104.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1105](http://www.qfbowen.com/content/?1105.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1106](http://www.qfbowen.com/content/?1106.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1107](http://www.qfbowen.com/content/?1107.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1108](http://www.qfbowen.com/content/?1108.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1109](http://www.qfbowen.com/content/?1109.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1110](http://www.qfbowen.com/content/?1110.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1111](http://www.qfbowen.com/content/?1111.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1112](http://www.qfbowen.com/content/?1112.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1113](http://www.qfbowen.com/content/?1113.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1114](http://www.qfbowen.com/content/?1114.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1115](http://www.qfbowen.com/content/?1115.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1116](http://www.qfbowen.com/content/?1116.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1117](http://www.qfbowen.com/content/?1117.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1118](http://www.qfbowen.com/content/?1118.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1119](http://www.qfbowen.com/content/?1119.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1120](http://www.qfbowen.com/content/?1120.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1121](http://www.qfbowen.com/content/?1121.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1122](http://www.qfbowen.com/content/?1122.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1123](http://www.qfbowen.com/content/?1123.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1124](http://www.qfbowen.com/content/?1124.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1125](http://www.qfbowen.com/content/?1125.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1126](http://www.qfbowen.com/content/?1126.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1127](http://www.qfbowen.com/content/?1127.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1128](http://www.qfbowen.com/content/?1128.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1129](http://www.qfbowen.com/content/?1129.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1130](http://www.qfbowen.com/content/?1130.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1131](http://www.qfbowen.com/content/?1131.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1132](http://www.qfbowen.com/content/?1132.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1133](http://www.qfbowen.com/content/?1133.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1134](http://www.qfbowen.com/content/?1134.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1135](http://www.qfbowen.com/content/?1135.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1136](http://www.qfbowen.com/content/?1136.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1137](http://www.qfbowen.com/content/?1137.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1138](http://www.qfbowen.com/content/?1138.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1139](http://www.qfbowen.com/content/?1139.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1140](http://www.qfbowen.com/content/?1140.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1141](http://www.qfbowen.com/content/?1141.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1142](http://www.qfbowen.com/content/?1142.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1143](http://www.qfbowen.com/content/?1143.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1144](http://www.qfbowen.com/content/?1144.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1145](http://www.qfbowen.com/content/?1145.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1146](http://www.qfbowen.com/content/?1146.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1147](http://www.qfbowen.com/content/?1147.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1148](http://www.qfbowen.com/content/?1148.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1149](http://www.qfbowen.com/content/?1149.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1150](http://www.qfbowen.com/content/?1150.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1151](http://www.qfbowen.com/content/?1151.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1152](http://www.qfbowen.com/content/?1152.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1153](http://www.qfbowen.com/content/?1153.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1154](http://www.qfbowen.com/content/?1154.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1155](http://www.qfbowen.com/content/?1155.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1156](http://www.qfbowen.com/content/?1156.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1157](http://www.qfbowen.com/content/?1157.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1158](http://www.qfbowen.com/content/?1158.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1159](http://www.qfbowen.com/content/?1159.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1160](http://www.qfbowen.com/content/?1160.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1161](http://www.qfbowen.com/content/?1161.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1162](http://www.qfbowen.com/content/?1162.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1163](http://www.qfbowen.com/content/?1163.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1164](http://www.qfbowen.com/content/?1164.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1165](http://www.qfbowen.com/content/?1165.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1166](http://www.qfbowen.com/content/?1166.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1167](http://www.qfbowen.com/content/?1167.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1168](http://www.qfbowen.com/content/?1168.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1169](http://www.qfbowen.com/content/?1169.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1170](http://www.qfbowen.com/content/?1170.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1171](http://www.qfbowen.com/content/?1171.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1172](http://www.qfbowen.com/content/?1172.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1173](http://www.qfbowen.com/content/?1173.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1174](http://www.qfbowen.com/content/?1174.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1175](http://www.qfbowen.com/content/?1175.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1176](http://www.qfbowen.com/content/?1176.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1177](http://www.qfbowen.com/content/?1177.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1178](http://www.qfbowen.com/content/?1178.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1179](http://www.qfbowen.com/content/?1179.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1180](http://www.qfbowen.com/content/?1180.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1181](http://www.qfbowen.com/content/?1181.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1182](http://www.qfbowen.com/content/?1182.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1183](http://www.qfbowen.com/content/?1183.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1184](http://www.qfbowen.com/content/?1184.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1185](http://www.qfbowen.com/content/?1185.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1186](http://www.qfbowen.com/content/?1186.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1187](http://www.qfbowen.com/content/?1187.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1188](http://www.qfbowen.com/content/?1188.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1189](http://www.qfbowen.com/content/?1189.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1190](http://www.qfbowen.com/content/?1190.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1191](http://www.qfbowen.com/content/?1191.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1192](http://www.qfbowen.com/content/?1192.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1193](http://www.qfbowen.com/content/?1193.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1194](http://www.qfbowen.com/content/?1194.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1195](http://www.qfbowen.com/content/?1195.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1196](http://www.qfbowen.com/content/?1196.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1197](http://www.qfbowen.com/content/?1197.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1198](http://www.qfbowen.com/content/?1198.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1199](http://www.qfbowen.com/content/?1199.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1200](http://www.qfbowen.com/content/?1200.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1201](http://www.qfbowen.com/content/?1201.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1202](http://www.qfbowen.com/content/?1202.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1203](http://www.qfbowen.com/content/?1203.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1204](http://www.qfbowen.com/content/?1204.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1205](http://www.qfbowen.com/content/?1205.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1206](http://www.qfbowen.com/content/?1206.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1207](http://www.qfbowen.com/content/?1207.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1208](http://www.qfbowen.com/content/?1208.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1209](http://www.qfbowen.com/content/?1209.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1210](http://www.qfbowen.com/content/?1210.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1211](http://www.qfbowen.com/content/?1211.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1212](http://www.qfbowen.com/content/?1212.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1213](http://www.qfbowen.com/content/?1213.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1214](http://www.qfbowen.com/content/?1214.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1215](http://www.qfbowen.com/content/?1215.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1216](http://www.qfbowen.com/content/?1216.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1217](http://www.qfbowen.com/content/?1217.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1218](http://www.qfbowen.com/content/?1218.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1219](http://www.qfbowen.com/content/?1219.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1220](http://www.qfbowen.com/content/?1220.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1221](http://www.qfbowen.com/content/?1221.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1222](http://www.qfbowen.com/content/?1222.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1223](http://www.qfbowen.com/content/?1223.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1224](http://www.qfbowen.com/content/?1224.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1225](http://www.qfbowen.com/content/?1225.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1226](http://www.qfbowen.com/content/?1226.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1227](http://www.qfbowen.com/content/?1227.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1228](http://www.qfbowen.com/content/?1228.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1229](http://www.qfbowen.com/content/?1229.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1230](http://www.qfbowen.com/content/?1230.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1231](http://www.qfbowen.com/content/?1231.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1232](http://www.qfbowen.com/content/?1232.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1233](http://www.qfbowen.com/content/?1233.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1234](http://www.qfbowen.com/content/?1234.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1235](http://www.qfbowen.com/content/?1235.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1236](http://www.qfbowen.com/content/?1236.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1237](http://www.qfbowen.com/content/?1237.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1238](http://www.qfbowen.com/content/?1238.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1239](http://www.qfbowen.com/content/?1239.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1240](http://www.qfbowen.com/content/?1240.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1241](http://www.qfbowen.com/content/?1241.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1242](http://www.qfbowen.com/content/?1242.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1243](http://www.qfbowen.com/content/?1243.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1244](http://www.qfbowen.com/content/?1244.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1245](http://www.qfbowen.com/content/?1245.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1246](http://www.qfbowen.com/content/?1246.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1247](http://www.qfbowen.com/content/?1247.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1248](http://www.qfbowen.com/content/?1248.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1249](http://www.qfbowen.com/content/?1249.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1250](http://www.qfbowen.com/content/?1250.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1251](http://www.qfbowen.com/content/?1251.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1252](http://www.qfbowen.com/content/?1252.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1253](http://www.qfbowen.com/content/?1253.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1254](http://www.qfbowen.com/content/?1254.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1255](http://www.qfbowen.com/content/?1255.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1256](http://www.qfbowen.com/content/?1256.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1257](http://www.qfbowen.com/content/?1257.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1258](http://www.qfbowen.com/content/?1258.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1259](http://www.qfbowen.com/content/?1259.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1260](http://www.qfbowen.com/content/?1260.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1261](http://www.qfbowen.com/content/?1261.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1262](http://www.qfbowen.com/content/?1262.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1263](http://www.qfbowen.com/content/?1263.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1264](http://www.qfbowen.com/content/?1264.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1265](http://www.qfbowen.com/content/?1265.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1266](http://www.qfbowen.com/content/?1266.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1267](http://www.qfbowen.com/content/?1267.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1268](http://www.qfbowen.com/content/?1268.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1269](http://www.qfbowen.com/content/?1269.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1270](http://www.qfbowen.com/content/?1270.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1271](http://www.qfbowen.com/content/?1271.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1272](http://www.qfbowen.com/content/?1272.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1273](http://www.qfbowen.com/content/?1273.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1274](http://www.qfbowen.com/content/?1274.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1275](http://www.qfbowen.com/content/?1275.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1276](http://www.qfbowen.com/content/?1276.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1277](http://www.qfbowen.com/content/?1277.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1278](http://www.qfbowen.com/content/?1278.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1279](http://www.qfbowen.com/content/?1279.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1280](http://www.qfbowen.com/content/?1280.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1281](http://www.qfbowen.com/content/?1281.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1282](http://www.qfbowen.com/content/?1282.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1283](http://www.qfbowen.com/content/?1283.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1284](http://www.qfbowen.com/content/?1284.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1285](http://www.qfbowen.com/content/?1285.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1286](http://www.qfbowen.com/content/?1286.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1287](http://www.qfbowen.com/content/?1287.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1288](http://www.qfbowen.com/content/?1288.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1289](http://www.qfbowen.com/content/?1289.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1290](http://www.qfbowen.com/content/?1290.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1291](http://www.qfbowen.com/content/?1291.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1292](http://www.qfbowen.com/content/?1292.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1293](http://www.qfbowen.com/content/?1293.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1294](http://www.qfbowen.com/content/?1294.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1295](http://www.qfbowen.com/content/?1295.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1296](http://www.qfbowen.com/content/?1296.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1297](http://www.qfbowen.com/content/?1297.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1298](http://www.qfbowen.com/content/?1298.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1299](http://www.qfbowen.com/content/?1299.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1300](http://www.qfbowen.com/content/?1300.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1301](http://www.qfbowen.com/content/?1301.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1302](http://www.qfbowen.com/content/?1302.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1303](http://www.qfbowen.com/content/?1303.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1304](http://www.qfbowen.com/content/?1304.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1305](http://www.qfbowen.com/content/?1305.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1306](http://www.qfbowen.com/content/?1306.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1307](http://www.qfbowen.com/content/?1307.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1308](http://www.qfbowen.com/content/?1308.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1309](http://www.qfbowen.com/content/?1309.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1310](http://www.qfbowen.com/content/?1310.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1311](http://www.qfbowen.com/content/?1311.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1312](http://www.qfbowen.com/content/?1312.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1313](http://www.qfbowen.com/content/?1313.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1314](http://www.qfbowen.com/content/?1314.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1315](http://www.qfbowen.com/content/?1315.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1316](http://www.qfbowen.com/content/?1316.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1317](http://www.qfbowen.com/content/?1317.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1318](http://www.qfbowen.com/content/?1318.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1319](http://www.qfbowen.com/content/?1319.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1320](http://www.qfbowen.com/content/?1320.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1321](http://www.qfbowen.com/content/?1321.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1322](http://www.qfbowen.com/content/?1322.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1323](http://www.qfbowen.com/content/?1323.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1324](http://www.qfbowen.com/content/?1324.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1325](http://www.qfbowen.com/content/?1325.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1326](http://www.qfbowen.com/content/?1326.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1327](http://www.qfbowen.com/content/?1327.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1328](http://www.qfbowen.com/content/?1328.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1329](http://www.qfbowen.com/content/?1329.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1330](http://www.qfbowen.com/content/?1330.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1331](http://www.qfbowen.com/content/?1331.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1332](http://www.qfbowen.com/content/?1332.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1333](http://www.qfbowen.com/content/?1333.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1334](http://www.qfbowen.com/content/?1334.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1335](http://www.qfbowen.com/content/?1335.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1336](http://www.qfbowen.com/content/?1336.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1337](http://www.qfbowen.com/content/?1337.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1338](http://www.qfbowen.com/content/?1338.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1339](http://www.qfbowen.com/content/?1339.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1340](http://www.qfbowen.com/content/?1340.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1341](http://www.qfbowen.com/content/?1341.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1342](http://www.qfbowen.com/content/?1342.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1343](http://www.qfbowen.com/content/?1343.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1344](http://www.qfbowen.com/content/?1344.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1345](http://www.qfbowen.com/content/?1345.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1346](http://www.qfbowen.com/content/?1346.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1347](http://www.qfbowen.com/content/?1347.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1348](http://www.qfbowen.com/content/?1348.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1349](http://www.qfbowen.com/content/?1349.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1350](http://www.qfbowen.com/content/?1350.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1351](http://www.qfbowen.com/content/?1351.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1352](http://www.qfbowen.com/content/?1352.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1353](http://www.qfbowen.com/content/?1353.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1354](http://www.qfbowen.com/content/?1354.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1355](http://www.qfbowen.com/content/?1355.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1356](http://www.qfbowen.com/content/?1356.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1357](http://www.qfbowen.com/content/?1357.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1358](http://www.qfbowen.com/content/?1358.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1359](http://www.qfbowen.com/content/?1359.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1360](http://www.qfbowen.com/content/?1360.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1361](http://www.qfbowen.com/content/?1361.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1362](http://www.qfbowen.com/content/?1362.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1363](http://www.qfbowen.com/content/?1363.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1364](http://www.qfbowen.com/content/?1364.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_1365](http://www.qfbowen.com/content/?1365.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1366](http://www.qfbowen.com/content/?1366.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1368](http://www.qfbowen.com/content/?1368.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1369](http://www.qfbowen.com/content/?1369.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1370](http://www.qfbowen.com/content/?1370.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1371](http://www.qfbowen.com/content/?1371.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1372](http://www.qfbowen.com/content/?1372.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1373](http://www.qfbowen.com/content/?1373.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1374](http://www.qfbowen.com/content/?1374.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1375](http://www.qfbowen.com/content/?1375.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_1376](http://www.qfbowen.com/content/?1376.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_557](http://www.qfbowen.com/content/?557.html) | content-unknown | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_558](http://www.qfbowen.com/content/?558.html) | content-unknown | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_559](http://www.qfbowen.com/content/?559.html) | content-unknown | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_560](http://www.qfbowen.com/content/?560.html) | content-unknown | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_561](http://www.qfbowen.com/content/?561.html) | content-unknown | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_562](http://www.qfbowen.com/content/?562.html) | content-unknown | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_563](http://www.qfbowen.com/content/?563.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_564](http://www.qfbowen.com/content/?564.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_565](http://www.qfbowen.com/content/?565.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_566](http://www.qfbowen.com/content/?566.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_567](http://www.qfbowen.com/content/?567.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_568](http://www.qfbowen.com/content/?568.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_569](http://www.qfbowen.com/content/?569.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_570](http://www.qfbowen.com/content/?570.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_571](http://www.qfbowen.com/content/?571.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_572](http://www.qfbowen.com/content/?572.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_573](http://www.qfbowen.com/content/?573.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_574](http://www.qfbowen.com/content/?574.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_575](http://www.qfbowen.com/content/?575.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_576](http://www.qfbowen.com/content/?576.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_577](http://www.qfbowen.com/content/?577.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_578](http://www.qfbowen.com/content/?578.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_579](http://www.qfbowen.com/content/?579.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_580](http://www.qfbowen.com/content/?580.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_581](http://www.qfbowen.com/content/?581.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_582](http://www.qfbowen.com/content/?582.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_583](http://www.qfbowen.com/content/?583.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_584](http://www.qfbowen.com/content/?584.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_585](http://www.qfbowen.com/content/?585.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_586](http://www.qfbowen.com/content/?586.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_587](http://www.qfbowen.com/content/?587.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_588](http://www.qfbowen.com/content/?588.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_589](http://www.qfbowen.com/content/?589.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_590](http://www.qfbowen.com/content/?590.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_591](http://www.qfbowen.com/content/?591.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_592](http://www.qfbowen.com/content/?592.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_593](http://www.qfbowen.com/content/?593.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_594](http://www.qfbowen.com/content/?594.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_595](http://www.qfbowen.com/content/?595.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_596](http://www.qfbowen.com/content/?596.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_597](http://www.qfbowen.com/content/?597.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_598](http://www.qfbowen.com/content/?598.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_599](http://www.qfbowen.com/content/?599.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_600](http://www.qfbowen.com/content/?600.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_601](http://www.qfbowen.com/content/?601.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_602](http://www.qfbowen.com/content/?602.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_603](http://www.qfbowen.com/content/?603.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_604](http://www.qfbowen.com/content/?604.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_605](http://www.qfbowen.com/content/?605.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_606](http://www.qfbowen.com/content/?606.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_607](http://www.qfbowen.com/content/?607.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_608](http://www.qfbowen.com/content/?608.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_609](http://www.qfbowen.com/content/?609.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_610](http://www.qfbowen.com/content/?610.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_611](http://www.qfbowen.com/content/?611.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_612](http://www.qfbowen.com/content/?612.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_613](http://www.qfbowen.com/content/?613.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_614](http://www.qfbowen.com/content/?614.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_615](http://www.qfbowen.com/content/?615.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_616](http://www.qfbowen.com/content/?616.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_617](http://www.qfbowen.com/content/?617.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_618](http://www.qfbowen.com/content/?618.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_619](http://www.qfbowen.com/content/?619.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_620](http://www.qfbowen.com/content/?620.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_621](http://www.qfbowen.com/content/?621.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_622](http://www.qfbowen.com/content/?622.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_623](http://www.qfbowen.com/content/?623.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_624](http://www.qfbowen.com/content/?624.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_625](http://www.qfbowen.com/content/?625.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_626](http://www.qfbowen.com/content/?626.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_627](http://www.qfbowen.com/content/?627.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_628](http://www.qfbowen.com/content/?628.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_629](http://www.qfbowen.com/content/?629.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_630](http://www.qfbowen.com/content/?630.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_631](http://www.qfbowen.com/content/?631.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_632](http://www.qfbowen.com/content/?632.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_633](http://www.qfbowen.com/content/?633.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_634](http://www.qfbowen.com/content/?634.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_635](http://www.qfbowen.com/content/?635.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_636](http://www.qfbowen.com/content/?636.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_637](http://www.qfbowen.com/content/?637.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_638](http://www.qfbowen.com/content/?638.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_639](http://www.qfbowen.com/content/?639.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_640](http://www.qfbowen.com/content/?640.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_641](http://www.qfbowen.com/content/?641.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_642](http://www.qfbowen.com/content/?642.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_643](http://www.qfbowen.com/content/?643.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_644](http://www.qfbowen.com/content/?644.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_645](http://www.qfbowen.com/content/?645.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_646](http://www.qfbowen.com/content/?646.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_647](http://www.qfbowen.com/content/?647.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_648](http://www.qfbowen.com/content/?648.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_649](http://www.qfbowen.com/content/?649.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_650](http://www.qfbowen.com/content/?650.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_651](http://www.qfbowen.com/content/?651.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_652](http://www.qfbowen.com/content/?652.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_653](http://www.qfbowen.com/content/?653.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_654](http://www.qfbowen.com/content/?654.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_655](http://www.qfbowen.com/content/?655.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_656](http://www.qfbowen.com/content/?656.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_657](http://www.qfbowen.com/content/?657.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_658](http://www.qfbowen.com/content/?658.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_659](http://www.qfbowen.com/content/?659.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_660](http://www.qfbowen.com/content/?660.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_661](http://www.qfbowen.com/content/?661.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_662](http://www.qfbowen.com/content/?662.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_663](http://www.qfbowen.com/content/?663.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_664](http://www.qfbowen.com/content/?664.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_665](http://www.qfbowen.com/content/?665.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_666](http://www.qfbowen.com/content/?666.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_667](http://www.qfbowen.com/content/?667.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_668](http://www.qfbowen.com/content/?668.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_669](http://www.qfbowen.com/content/?669.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_670](http://www.qfbowen.com/content/?670.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_671](http://www.qfbowen.com/content/?671.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_672](http://www.qfbowen.com/content/?672.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_673](http://www.qfbowen.com/content/?673.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_674](http://www.qfbowen.com/content/?674.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_675](http://www.qfbowen.com/content/?675.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_676](http://www.qfbowen.com/content/?676.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_677](http://www.qfbowen.com/content/?677.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_678](http://www.qfbowen.com/content/?678.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_679](http://www.qfbowen.com/content/?679.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_680](http://www.qfbowen.com/content/?680.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_681](http://www.qfbowen.com/content/?681.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_682](http://www.qfbowen.com/content/?682.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_683](http://www.qfbowen.com/content/?683.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_684](http://www.qfbowen.com/content/?684.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_685](http://www.qfbowen.com/content/?685.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_686](http://www.qfbowen.com/content/?686.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_687](http://www.qfbowen.com/content/?687.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_688](http://www.qfbowen.com/content/?688.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_689](http://www.qfbowen.com/content/?689.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_690](http://www.qfbowen.com/content/?690.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_691](http://www.qfbowen.com/content/?691.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_692](http://www.qfbowen.com/content/?692.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_693](http://www.qfbowen.com/content/?693.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_694](http://www.qfbowen.com/content/?694.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_695](http://www.qfbowen.com/content/?695.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_696](http://www.qfbowen.com/content/?696.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_697](http://www.qfbowen.com/content/?697.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_698](http://www.qfbowen.com/content/?698.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_699](http://www.qfbowen.com/content/?699.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_700](http://www.qfbowen.com/content/?700.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_701](http://www.qfbowen.com/content/?701.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_702](http://www.qfbowen.com/content/?702.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_703](http://www.qfbowen.com/content/?703.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_704](http://www.qfbowen.com/content/?704.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_705](http://www.qfbowen.com/content/?705.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_706](http://www.qfbowen.com/content/?706.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_707](http://www.qfbowen.com/content/?707.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_708](http://www.qfbowen.com/content/?708.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_709](http://www.qfbowen.com/content/?709.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_710](http://www.qfbowen.com/content/?710.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_711](http://www.qfbowen.com/content/?711.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_712](http://www.qfbowen.com/content/?712.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_713](http://www.qfbowen.com/content/?713.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_714](http://www.qfbowen.com/content/?714.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_715](http://www.qfbowen.com/content/?715.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_716](http://www.qfbowen.com/content/?716.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_717](http://www.qfbowen.com/content/?717.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_718](http://www.qfbowen.com/content/?718.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_719](http://www.qfbowen.com/content/?719.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_720](http://www.qfbowen.com/content/?720.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_721](http://www.qfbowen.com/content/?721.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_722](http://www.qfbowen.com/content/?722.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_723](http://www.qfbowen.com/content/?723.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_724](http://www.qfbowen.com/content/?724.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_725](http://www.qfbowen.com/content/?725.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_726](http://www.qfbowen.com/content/?726.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_727](http://www.qfbowen.com/content/?727.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_728](http://www.qfbowen.com/content/?728.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_729](http://www.qfbowen.com/content/?729.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_730](http://www.qfbowen.com/content/?730.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_731](http://www.qfbowen.com/content/?731.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_732](http://www.qfbowen.com/content/?732.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_733](http://www.qfbowen.com/content/?733.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_734](http://www.qfbowen.com/content/?734.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_735](http://www.qfbowen.com/content/?735.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_736](http://www.qfbowen.com/content/?736.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_737](http://www.qfbowen.com/content/?737.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_738](http://www.qfbowen.com/content/?738.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_739](http://www.qfbowen.com/content/?739.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_740](http://www.qfbowen.com/content/?740.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_741](http://www.qfbowen.com/content/?741.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_742](http://www.qfbowen.com/content/?742.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_743](http://www.qfbowen.com/content/?743.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_744](http://www.qfbowen.com/content/?744.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_745](http://www.qfbowen.com/content/?745.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_746](http://www.qfbowen.com/content/?746.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_747](http://www.qfbowen.com/content/?747.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_748](http://www.qfbowen.com/content/?748.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_749](http://www.qfbowen.com/content/?749.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_750](http://www.qfbowen.com/content/?750.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_751](http://www.qfbowen.com/content/?751.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_752](http://www.qfbowen.com/content/?752.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_753](http://www.qfbowen.com/content/?753.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_754](http://www.qfbowen.com/content/?754.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_755](http://www.qfbowen.com/content/?755.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_756](http://www.qfbowen.com/content/?756.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_757](http://www.qfbowen.com/content/?757.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_758](http://www.qfbowen.com/content/?758.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_759](http://www.qfbowen.com/content/?759.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_760](http://www.qfbowen.com/content/?760.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_761](http://www.qfbowen.com/content/?761.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_762](http://www.qfbowen.com/content/?762.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_763](http://www.qfbowen.com/content/?763.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_764](http://www.qfbowen.com/content/?764.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_765](http://www.qfbowen.com/content/?765.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_766](http://www.qfbowen.com/content/?766.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_767](http://www.qfbowen.com/content/?767.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_768](http://www.qfbowen.com/content/?768.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_769](http://www.qfbowen.com/content/?769.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_770](http://www.qfbowen.com/content/?770.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_771](http://www.qfbowen.com/content/?771.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_772](http://www.qfbowen.com/content/?772.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_773](http://www.qfbowen.com/content/?773.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_774](http://www.qfbowen.com/content/?774.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_775](http://www.qfbowen.com/content/?775.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_776](http://www.qfbowen.com/content/?776.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_777](http://www.qfbowen.com/content/?777.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_778](http://www.qfbowen.com/content/?778.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_779](http://www.qfbowen.com/content/?779.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_780](http://www.qfbowen.com/content/?780.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_781](http://www.qfbowen.com/content/?781.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_782](http://www.qfbowen.com/content/?782.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_783](http://www.qfbowen.com/content/?783.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_784](http://www.qfbowen.com/content/?784.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_785](http://www.qfbowen.com/content/?785.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_786](http://www.qfbowen.com/content/?786.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_787](http://www.qfbowen.com/content/?787.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_788](http://www.qfbowen.com/content/?788.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_789](http://www.qfbowen.com/content/?789.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_790](http://www.qfbowen.com/content/?790.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_791](http://www.qfbowen.com/content/?791.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_792](http://www.qfbowen.com/content/?792.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_793](http://www.qfbowen.com/content/?793.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_794](http://www.qfbowen.com/content/?794.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_795](http://www.qfbowen.com/content/?795.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_796](http://www.qfbowen.com/content/?796.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_797](http://www.qfbowen.com/content/?797.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_798](http://www.qfbowen.com/content/?798.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_799](http://www.qfbowen.com/content/?799.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_800](http://www.qfbowen.com/content/?800.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_801](http://www.qfbowen.com/content/?801.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_802](http://www.qfbowen.com/content/?802.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_803](http://www.qfbowen.com/content/?803.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_804](http://www.qfbowen.com/content/?804.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_805](http://www.qfbowen.com/content/?805.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_806](http://www.qfbowen.com/content/?806.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_807](http://www.qfbowen.com/content/?807.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_808](http://www.qfbowen.com/content/?808.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_809](http://www.qfbowen.com/content/?809.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_810](http://www.qfbowen.com/content/?810.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_811](http://www.qfbowen.com/content/?811.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_812](http://www.qfbowen.com/content/?812.html) | product-detail | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [content_813](http://www.qfbowen.com/content/?813.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_814](http://www.qfbowen.com/content/?814.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_815](http://www.qfbowen.com/content/?815.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_816](http://www.qfbowen.com/content/?816.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_817](http://www.qfbowen.com/content/?817.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_818](http://www.qfbowen.com/content/?818.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_819](http://www.qfbowen.com/content/?819.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_820](http://www.qfbowen.com/content/?820.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_821](http://www.qfbowen.com/content/?821.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_822](http://www.qfbowen.com/content/?822.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_823](http://www.qfbowen.com/content/?823.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_824](http://www.qfbowen.com/content/?824.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_825](http://www.qfbowen.com/content/?825.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_826](http://www.qfbowen.com/content/?826.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_827](http://www.qfbowen.com/content/?827.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_828](http://www.qfbowen.com/content/?828.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_829](http://www.qfbowen.com/content/?829.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_830](http://www.qfbowen.com/content/?830.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_831](http://www.qfbowen.com/content/?831.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_832](http://www.qfbowen.com/content/?832.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_833](http://www.qfbowen.com/content/?833.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_834](http://www.qfbowen.com/content/?834.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_835](http://www.qfbowen.com/content/?835.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_836](http://www.qfbowen.com/content/?836.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_837](http://www.qfbowen.com/content/?837.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_838](http://www.qfbowen.com/content/?838.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_839](http://www.qfbowen.com/content/?839.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_840](http://www.qfbowen.com/content/?840.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_841](http://www.qfbowen.com/content/?841.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_842](http://www.qfbowen.com/content/?842.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_843](http://www.qfbowen.com/content/?843.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_844](http://www.qfbowen.com/content/?844.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_845](http://www.qfbowen.com/content/?845.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_846](http://www.qfbowen.com/content/?846.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_847](http://www.qfbowen.com/content/?847.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_848](http://www.qfbowen.com/content/?848.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_849](http://www.qfbowen.com/content/?849.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_850](http://www.qfbowen.com/content/?850.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_851](http://www.qfbowen.com/content/?851.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_852](http://www.qfbowen.com/content/?852.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_853](http://www.qfbowen.com/content/?853.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_854](http://www.qfbowen.com/content/?854.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_855](http://www.qfbowen.com/content/?855.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_856](http://www.qfbowen.com/content/?856.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_857](http://www.qfbowen.com/content/?857.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_858](http://www.qfbowen.com/content/?858.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_859](http://www.qfbowen.com/content/?859.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_860](http://www.qfbowen.com/content/?860.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_861](http://www.qfbowen.com/content/?861.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_862](http://www.qfbowen.com/content/?862.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_863](http://www.qfbowen.com/content/?863.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_864](http://www.qfbowen.com/content/?864.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_865](http://www.qfbowen.com/content/?865.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_866](http://www.qfbowen.com/content/?866.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_867](http://www.qfbowen.com/content/?867.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_868](http://www.qfbowen.com/content/?868.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_869](http://www.qfbowen.com/content/?869.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_870](http://www.qfbowen.com/content/?870.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_871](http://www.qfbowen.com/content/?871.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_872](http://www.qfbowen.com/content/?872.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_873](http://www.qfbowen.com/content/?873.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_874](http://www.qfbowen.com/content/?874.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_875](http://www.qfbowen.com/content/?875.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_876](http://www.qfbowen.com/content/?876.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_877](http://www.qfbowen.com/content/?877.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_878](http://www.qfbowen.com/content/?878.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_879](http://www.qfbowen.com/content/?879.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_880](http://www.qfbowen.com/content/?880.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_881](http://www.qfbowen.com/content/?881.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_882](http://www.qfbowen.com/content/?882.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_883](http://www.qfbowen.com/content/?883.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_884](http://www.qfbowen.com/content/?884.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_885](http://www.qfbowen.com/content/?885.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_886](http://www.qfbowen.com/content/?886.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_887](http://www.qfbowen.com/content/?887.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_888](http://www.qfbowen.com/content/?888.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_889](http://www.qfbowen.com/content/?889.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_890](http://www.qfbowen.com/content/?890.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_891](http://www.qfbowen.com/content/?891.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_892](http://www.qfbowen.com/content/?892.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_893](http://www.qfbowen.com/content/?893.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_894](http://www.qfbowen.com/content/?894.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_895](http://www.qfbowen.com/content/?895.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_896](http://www.qfbowen.com/content/?896.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_897](http://www.qfbowen.com/content/?897.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_898](http://www.qfbowen.com/content/?898.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_899](http://www.qfbowen.com/content/?899.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_900](http://www.qfbowen.com/content/?900.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_901](http://www.qfbowen.com/content/?901.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_902](http://www.qfbowen.com/content/?902.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_903](http://www.qfbowen.com/content/?903.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_904](http://www.qfbowen.com/content/?904.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_905](http://www.qfbowen.com/content/?905.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_906](http://www.qfbowen.com/content/?906.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_907](http://www.qfbowen.com/content/?907.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_908](http://www.qfbowen.com/content/?908.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_909](http://www.qfbowen.com/content/?909.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_910](http://www.qfbowen.com/content/?910.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_911](http://www.qfbowen.com/content/?911.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_912](http://www.qfbowen.com/content/?912.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_913](http://www.qfbowen.com/content/?913.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_914](http://www.qfbowen.com/content/?914.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_915](http://www.qfbowen.com/content/?915.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_916](http://www.qfbowen.com/content/?916.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_917](http://www.qfbowen.com/content/?917.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_918](http://www.qfbowen.com/content/?918.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_919](http://www.qfbowen.com/content/?919.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_920](http://www.qfbowen.com/content/?920.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_921](http://www.qfbowen.com/content/?921.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_922](http://www.qfbowen.com/content/?922.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_923](http://www.qfbowen.com/content/?923.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_924](http://www.qfbowen.com/content/?924.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_925](http://www.qfbowen.com/content/?925.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_926](http://www.qfbowen.com/content/?926.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_927](http://www.qfbowen.com/content/?927.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_928](http://www.qfbowen.com/content/?928.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_929](http://www.qfbowen.com/content/?929.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_930](http://www.qfbowen.com/content/?930.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_931](http://www.qfbowen.com/content/?931.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_932](http://www.qfbowen.com/content/?932.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_933](http://www.qfbowen.com/content/?933.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_934](http://www.qfbowen.com/content/?934.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_935](http://www.qfbowen.com/content/?935.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_936](http://www.qfbowen.com/content/?936.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_937](http://www.qfbowen.com/content/?937.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_938](http://www.qfbowen.com/content/?938.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_939](http://www.qfbowen.com/content/?939.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_940](http://www.qfbowen.com/content/?940.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_941](http://www.qfbowen.com/content/?941.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_942](http://www.qfbowen.com/content/?942.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_943](http://www.qfbowen.com/content/?943.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_944](http://www.qfbowen.com/content/?944.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_945](http://www.qfbowen.com/content/?945.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_946](http://www.qfbowen.com/content/?946.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_947](http://www.qfbowen.com/content/?947.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_948](http://www.qfbowen.com/content/?948.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_949](http://www.qfbowen.com/content/?949.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_950](http://www.qfbowen.com/content/?950.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_951](http://www.qfbowen.com/content/?951.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_952](http://www.qfbowen.com/content/?952.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_953](http://www.qfbowen.com/content/?953.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_954](http://www.qfbowen.com/content/?954.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_955](http://www.qfbowen.com/content/?955.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_956](http://www.qfbowen.com/content/?956.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_957](http://www.qfbowen.com/content/?957.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_958](http://www.qfbowen.com/content/?958.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_959](http://www.qfbowen.com/content/?959.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_960](http://www.qfbowen.com/content/?960.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_961](http://www.qfbowen.com/content/?961.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_962](http://www.qfbowen.com/content/?962.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_963](http://www.qfbowen.com/content/?963.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_964](http://www.qfbowen.com/content/?964.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_965](http://www.qfbowen.com/content/?965.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_966](http://www.qfbowen.com/content/?966.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_967](http://www.qfbowen.com/content/?967.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_968](http://www.qfbowen.com/content/?968.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_969](http://www.qfbowen.com/content/?969.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_970](http://www.qfbowen.com/content/?970.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_971](http://www.qfbowen.com/content/?971.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_972](http://www.qfbowen.com/content/?972.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_973](http://www.qfbowen.com/content/?973.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_974](http://www.qfbowen.com/content/?974.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_975](http://www.qfbowen.com/content/?975.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_976](http://www.qfbowen.com/content/?976.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_977](http://www.qfbowen.com/content/?977.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_978](http://www.qfbowen.com/content/?978.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_979](http://www.qfbowen.com/content/?979.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_980](http://www.qfbowen.com/content/?980.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_981](http://www.qfbowen.com/content/?981.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_982](http://www.qfbowen.com/content/?982.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_983](http://www.qfbowen.com/content/?983.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_984](http://www.qfbowen.com/content/?984.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_985](http://www.qfbowen.com/content/?985.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_986](http://www.qfbowen.com/content/?986.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_987](http://www.qfbowen.com/content/?987.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_988](http://www.qfbowen.com/content/?988.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_989](http://www.qfbowen.com/content/?989.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_990](http://www.qfbowen.com/content/?990.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_991](http://www.qfbowen.com/content/?991.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_992](http://www.qfbowen.com/content/?992.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_993](http://www.qfbowen.com/content/?993.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_994](http://www.qfbowen.com/content/?994.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_995](http://www.qfbowen.com/content/?995.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_996](http://www.qfbowen.com/content/?996.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_997](http://www.qfbowen.com/content/?997.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_998](http://www.qfbowen.com/content/?998.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [content_999](http://www.qfbowen.com/content/?999.html) | product-detail | 可直接复用（语言中立的技术数据） | 页面主体是规格表（OE 号码 / 博文编号 / 技术参数），编号与温度属语言中立数据，可直接迁移；中文车型名需另做英文对照 | — |
| [gbook_14_1](http://www.qfbowen.com/gbook/?14_1.html) | guestbook | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_10_1](http://www.qfbowen.com/list/?10_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_1](http://www.qfbowen.com/list/?2_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_10](http://www.qfbowen.com/list/?2_10.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_11](http://www.qfbowen.com/list/?2_11.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_12](http://www.qfbowen.com/list/?2_12.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_13](http://www.qfbowen.com/list/?2_13.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_14](http://www.qfbowen.com/list/?2_14.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_15](http://www.qfbowen.com/list/?2_15.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_16](http://www.qfbowen.com/list/?2_16.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_17](http://www.qfbowen.com/list/?2_17.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_18](http://www.qfbowen.com/list/?2_18.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_19](http://www.qfbowen.com/list/?2_19.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_2](http://www.qfbowen.com/list/?2_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_20](http://www.qfbowen.com/list/?2_20.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_21](http://www.qfbowen.com/list/?2_21.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_22](http://www.qfbowen.com/list/?2_22.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_23](http://www.qfbowen.com/list/?2_23.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_24](http://www.qfbowen.com/list/?2_24.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_25](http://www.qfbowen.com/list/?2_25.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_26](http://www.qfbowen.com/list/?2_26.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_27](http://www.qfbowen.com/list/?2_27.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_28](http://www.qfbowen.com/list/?2_28.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_29](http://www.qfbowen.com/list/?2_29.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_3](http://www.qfbowen.com/list/?2_3.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_30](http://www.qfbowen.com/list/?2_30.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_31](http://www.qfbowen.com/list/?2_31.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_32](http://www.qfbowen.com/list/?2_32.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_33](http://www.qfbowen.com/list/?2_33.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_4](http://www.qfbowen.com/list/?2_4.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_5](http://www.qfbowen.com/list/?2_5.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_6](http://www.qfbowen.com/list/?2_6.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_7](http://www.qfbowen.com/list/?2_7.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_8](http://www.qfbowen.com/list/?2_8.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_2_9](http://www.qfbowen.com/list/?2_9.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_3_1](http://www.qfbowen.com/list/?3_1.html) | certificates-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_4_1](http://www.qfbowen.com/list/?4_1.html) | news-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_47_1](http://www.qfbowen.com/list/?47_1.html) | factory-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_48_1](http://www.qfbowen.com/list/?48_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_48_2](http://www.qfbowen.com/list/?48_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_48_3](http://www.qfbowen.com/list/?48_3.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_48_4](http://www.qfbowen.com/list/?48_4.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_49_1](http://www.qfbowen.com/list/?49_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_49_2](http://www.qfbowen.com/list/?49_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_50_1](http://www.qfbowen.com/list/?50_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_51_1](http://www.qfbowen.com/list/?51_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_51_2](http://www.qfbowen.com/list/?51_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_1](http://www.qfbowen.com/list/?58_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_10](http://www.qfbowen.com/list/?58_10.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_11](http://www.qfbowen.com/list/?58_11.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_12](http://www.qfbowen.com/list/?58_12.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_13](http://www.qfbowen.com/list/?58_13.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_14](http://www.qfbowen.com/list/?58_14.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_15](http://www.qfbowen.com/list/?58_15.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_16](http://www.qfbowen.com/list/?58_16.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_17](http://www.qfbowen.com/list/?58_17.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_18](http://www.qfbowen.com/list/?58_18.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_2](http://www.qfbowen.com/list/?58_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_3](http://www.qfbowen.com/list/?58_3.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_4](http://www.qfbowen.com/list/?58_4.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_5](http://www.qfbowen.com/list/?58_5.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_6](http://www.qfbowen.com/list/?58_6.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_7](http://www.qfbowen.com/list/?58_7.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_8](http://www.qfbowen.com/list/?58_8.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_58_9](http://www.qfbowen.com/list/?58_9.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_59_1](http://www.qfbowen.com/list/?59_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_59_2](http://www.qfbowen.com/list/?59_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_60_1](http://www.qfbowen.com/list/?60_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_61_1](http://www.qfbowen.com/list/?61_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_62_1](http://www.qfbowen.com/list/?62_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_63_1](http://www.qfbowen.com/list/?63_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_64_1](http://www.qfbowen.com/list/?64_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_64_2](http://www.qfbowen.com/list/?64_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_64_3](http://www.qfbowen.com/list/?64_3.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_65_1](http://www.qfbowen.com/list/?65_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_65_2](http://www.qfbowen.com/list/?65_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_66_1](http://www.qfbowen.com/list/?66_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_66_2](http://www.qfbowen.com/list/?66_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_1](http://www.qfbowen.com/list/?67_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_10](http://www.qfbowen.com/list/?67_10.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_11](http://www.qfbowen.com/list/?67_11.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_2](http://www.qfbowen.com/list/?67_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_3](http://www.qfbowen.com/list/?67_3.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_4](http://www.qfbowen.com/list/?67_4.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_5](http://www.qfbowen.com/list/?67_5.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_6](http://www.qfbowen.com/list/?67_6.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_7](http://www.qfbowen.com/list/?67_7.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_8](http://www.qfbowen.com/list/?67_8.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_67_9](http://www.qfbowen.com/list/?67_9.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_68_1](http://www.qfbowen.com/list/?68_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_69_1](http://www.qfbowen.com/list/?69_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_70_1](http://www.qfbowen.com/list/?70_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_71_1](http://www.qfbowen.com/list/?71_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_71_2](http://www.qfbowen.com/list/?71_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_72_1](http://www.qfbowen.com/list/?72_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_72_2](http://www.qfbowen.com/list/?72_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_73_1](http://www.qfbowen.com/list/?73_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_74_1](http://www.qfbowen.com/list/?74_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_74_2](http://www.qfbowen.com/list/?74_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_74_3](http://www.qfbowen.com/list/?74_3.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_74_4](http://www.qfbowen.com/list/?74_4.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_75_1](http://www.qfbowen.com/list/?75_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_75_2](http://www.qfbowen.com/list/?75_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_76_1](http://www.qfbowen.com/list/?76_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_77_1](http://www.qfbowen.com/list/?77_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_77_2](http://www.qfbowen.com/list/?77_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_78_1](http://www.qfbowen.com/list/?78_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_78_2](http://www.qfbowen.com/list/?78_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_79_1](http://www.qfbowen.com/list/?79_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_8_1](http://www.qfbowen.com/list/?8_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_8_2](http://www.qfbowen.com/list/?8_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_80_1](http://www.qfbowen.com/list/?80_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_81_1](http://www.qfbowen.com/list/?81_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_82_1](http://www.qfbowen.com/list/?82_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_83_1](http://www.qfbowen.com/list/?83_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_83_2](http://www.qfbowen.com/list/?83_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_83_3](http://www.qfbowen.com/list/?83_3.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_9_1](http://www.qfbowen.com/list/?9_1.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |
| [list_9_2](http://www.qfbowen.com/list/?9_2.html) | products-list | 需英文重写 | 页面为中文正文，需人工重写为英文，页面自身未发现高风险表述 | — |

</details>

---

## 七、G. 技术审计（只用于了解旧站）

### 页面与规模

| 项目 | 值 |
|---|---|
| 页面总数 | 943 |
| HTML 总字节 | 9.52 MB |
| 平均每页 HTML | 10.3 KB |

### 移动端表现

| 项目 | 值 |
|---|---|
| 有 viewport meta 的页面 | **0 / 943** |
| 无 viewport 的页面 | 943 |
| 含媒体查询的 CSS | 5 / 11（抽查） |

> 🔴 **旧站没有任何页面声明 viewport**，移动端属于"缩小版桌面站"，不可作为移动体验参考。

### 图片

| 项目 | 值 |
|---|---|
| 图片数 | 870 |
| 图片总大小 | 64.7 MB |
| 平均大小 | 76 KB |
| 宽度 ≥1600px | 11 |

最大的 10 张图（"来源页面类别"是它出现在哪类页面；"复用状态"才是能否上英文站）：

| 文件 | 尺寸 | 大小 | 来源页面类别 | 复用状态 |
|---|---|---|---|---|
| `images/other/nyb06.jpg` | 1920x460 | 699 KB | certificate | not_recommended |
| `images/other/banner03.jpg` | 1920x700 | 636 KB | company | not_recommended |
| `images/factory/sb03.jpg` | 1259x707 | 574 KB | factory | review_required |
| `images/other/banner02.jpg` | 1920x700 | 553 KB | company | not_recommended |
| `images/factory/sb02.jpg` | 1259x709 | 524 KB | factory | review_required |
| `images/other/nyb07.jpg` | 1920x460 | 493 KB | factory | not_recommended |
| `images/factory/sb01.jpg` | 1260x715 | 475 KB | factory | review_required |
| `images/other/nyb05.jpg` | 1920x460 | 452 KB | product | not_recommended |
| `images/other/f382bf5e_nyb05.jpg` | 1920x460 | 452 KB | product | not_recommended |
| `images/other/ee09eb2d4e83c256fd5962623b28621d689d81b0.jpg` | 960x548 | 451 KB | other | review_required |

### URL 结构

| 形态 | 说明 |
|---|---|
| `/` | 首页 |
| `/list/?{栏目ID}_{页码}.html` | 栏目/分页列表 |
| `/content/?{内容ID}.html` | 详情页（产品/证书/新闻同构） |
| `/about/?{栏目ID}.html` | 单页（关于/文化/联系/设备） |
| `/gbook/?{ID}_{页码}.html` | 在线留言 |

URL 以数字 ID 为主，无关键词语义，且中英文站点未来需重新设计 URL 结构（旧站 URL 不可继承）。

### Meta / SEO 文件

| 项目 | 值 |
|---|---|
| 有 Title | 943 / 943 |
| 有 Description | 129 / 943 |
| Description 是未渲染模板占位符 | 814 |
| 有 H1 | 943 / 943 |
| H1 多于 1 个的页面 | 819 |
| 重复 Title | 73 |
| `rel=canonical` | **0**（全站未设置 rel=canonical） |
| `robots.txt` | HTTP **404**（不存在） |
| `sitemap.xml` | HTTP **404**（不存在） |

示例 Title（注意关键词堆砌）：

- `汽车配件生产厂家_热敏开关厂家_温度传感器厂家-曲阜市博文汽车零部件制造有限公司`
- `关于我们-汽车配件生产厂家_热敏开关厂家_温度传感器厂家-曲阜市博文汽车零部件制造有限公司`
- `企业文化-汽车配件生产厂家_热敏开关厂家_温度传感器厂家-曲阜市博文汽车零部件制造有限公司`
- `联系我们-汽车配件生产厂家_热敏开关厂家_温度传感器厂家-曲阜市博文汽车零部件制造有限公司`

### HTTPS

| 探测目标 | 结果 |
|---|---|
| `www.qfbowen.com:443` | **TLS_ERROR ECONNRESET** |
| `qfbowen.com:443` | **TLS_ERROR ECONNRESET** |
| HTTP → HTTPS 跳转 | **无**（HTTP 直接返回 200） |

> HTTP 直接返回 200，不做 HTTPS 跳转；443 端口 TCP 可连但 TLS 握手被重置，HTTPS 不可用。

### 页面加载资源

| 项目 | 值 |
|---|---|
| 独立 CSS 文件 | 11 |
| 独立静态 JS 文件 | 7 |
| 每页一个的访问计数脚本 | 1640 |
| CSS 总字节 | 619 KB |
| JS 总字节 | 150 KB |

静态资源共 11 个 CSS + 7 个 JS（Bootstrap + jQuery + Owl Carousel + animate.css/WOW.js）。另有 1640 个"每页一个"的访问计数脚本（/inc/AspCms_Visits.asp?id=N），旧站因此无法有效利用浏览器缓存，属于典型的老旧 AspCms 实现。本审计只统计这些计数脚本，未逐个下载。

### 统计与第三方脚本

| 项目 | 页面数 |
|---|---|
| 百度统计 | 1 |
| Google Analytics | 0 |
| 1688 平台链接 | 943 |
| ICP 备案号 | 943 |

外链（前 20）：

- https://shop06j405838w5f9.1688.com/
- http://beian.miit.gov.cn/

---

## 八、值得迁移 vs 不建议迁移

### 8. 哪些旧站内容值得迁移

| 优先级 | 内容 | 规模 | 去向 |
|---|---|---|---|
| 🥇 最高 | **产品实拍图** | 783 张（其中 274 张已可自动对应产品） | 产品详情页 / 产品卡（替换现在的 "Photo pending" 占位） |
| 🥈 高 | **工厂与设备照片** | 9 张 | Factory 页四个工序配图 |
| 🥈 高 | **证书 / 荣誉图片** | 6 张 | Quality 页（逐张核对有效期后） |
| 🥉 中 | **公司外景 / 厂区照片** | 2 张 | About / Home 增强真实感 |
| 🥉 中 | **产品技术数据**（OE 号、适用车型、温度） | 552 个页面有规格表 | 英文站产品数据结构（语言中立，可直接用） |
| ⚪ 低 | 公司注册主体事实（中文全称） | 1 处 | Contact 页核对用 |

### 9. 哪些内容不建议迁移

| 内容 | 原因 |
|---|---|
| **旧站代码 / 模板 / CSS / JS** | IIS + ASP.NET(AspCms)、表格布局、jQuery + Bootstrap + Owl Carousel，与 Next.js 15 技术栈完全冲突 |
| **中文营销文案** | 国内腔调，直译不可信；需按英文 B2B 习惯重写 |
| **绝对化宣传用语** | 命中 1 个页面，海外合规与可信度双重风险 |
| **国内平台链接**（1688 / 阿里巴巴 / 百度） | 对海外采购商无意义 |
| **ICP 备案号** | 只在中国大陆适用 |
| **国内固话 / 中文地址** | 海外客户无法拨打；地址需英文规范格式 |
| **含中文字的 Banner / 宣传图** | 必须重做英文版，不能原样上站 |
| **模板装饰件、图标、二维码、加载图** | 无价值或带来品牌风险 |
| **过时内容** | 0 个页面命中发布时间过久或证书有效期已过 |
| **未渲染的模板占位符内容** | 旧站模板缺陷（如 `[about:desc]`），内容本身无效 |
| **HTTPS / HTTP 头配置方式** | 旧站 HTTPS 不可用，无任何可借鉴价值 |

---

## 九、对现有 Prototype 的建议（**不立即执行**）

> 以下只是建议。本阶段**没有修改** Prototype 的任何文件（TEST 7 已验证）。

### 现状：Prototype 目前没有任何真实照片

检查 `website/` 目录后确认：

- `website/public/` 目录**不存在** —— 站点没有任何图片资源
- `ProductVisual.tsx` 在产品无图时渲染一个 "Photo pending" 的 SVG 占位符
- 三个页面上明确标注了占位（Placeholder）

### 建议替换的占位内容

| # | 位置 | 现在的占位 | 建议用旧站素材替换为 | 前置条件 |
|---|---|---|---|---|
| 1 | `website/src/components/ProductVisual.tsx` | 全站产品的 "Photo pending" SVG 圆环 | 旧站产品实拍图 | 先完成 `review/legacy-product-image-mapping.xlsx` 人工确认 |
| 2 | `website/src/app/(site)/factory/page.tsx` | 四个工序（Machining / Assembly / Automated Assembly / Testing）**纯文字无图** | 旧站「厂房厂貌」「生产设备」照片 | 逐张确认照片确实对应所标工序 |
| 3 | `website/src/app/(site)/quality/page.tsx` | "Placeholder — pending confirmation from the quality department" | 旧站「荣誉资质」证书图片 | **必须**先核对证书有效期与适用范围 |
| 4 | `website/src/app/(site)/contact/page.tsx` | "Company details — pending"：公司注册信息、电话、地址、地图 | 旧站可提供注册公司全称等事实 | 需业务方决定国内联系方式是否对海外公开 |
| 5 | `website/src/app/(site)/page.tsx`（首页） | 文字 + SVG 版式，无照片 | 公司外景 / 厂区照片 | 含中文的 Banner 必须重做 |
| 6 | `website/src/app/(site)/about/page.tsx` | 公司事实齐全，配图为空 | 公司外景 / 厂区照片 | 中文简介只能作事实核对，不可直译 |

### 建议的实施顺序（等业务方确认后另行立项）

1. 业务方完成 `review/legacy-product-image-mapping.xlsx` 中的人工确认
2. 把确认后的产品图压缩、转 WebP/AVIF，放入 `website/public/products/`
3. 只更新 `website/src/data/` 的数据集（`image` 字段），**不改页面组件逻辑**
4. Factory / Quality / About 的图片接入单独做一轮，逐张确认后再替换

---

## 十、旧站代码是否值得复用？——结论：不值得

**结论：一行都不建议复用。** 只复用"素材和事实"，不复用"代码和架构"。

### 客观依据

| 维度 | 旧站实际情况 | 与新站的关系 |
|---|---|---|
| 服务端 | Microsoft-IIS/10.0 + ASP.NET，建站系统 AspCms | 新站是 Next.js 15 + TypeScript，技术栈完全不同 |
| HTML 结构 | 1 个页面**连 `<html>` 标签都没有**；943 个页面无 `lang` 属性 | 结构本身有缺陷 |
| 布局方式 | 0 个页面使用表格布局，943 个页面大量内联样式 | 与响应式 CSS Module 方案冲突 |
| 前端库 | Bootstrap(943页)、animate.css(943页)、WOW.js(943页)、jQuery(939页)、Owl Carousel(931页)、Baidu Analytics(1页) | 老旧依赖，与 React 无互补性 |
| 移动端 | 0 个页面声明 viewport | 无任何移动端方案可借鉴 |
| URL 设计 | 全部是数字 ID（`/content/?925.html`），无语义、无多语言前缀 | 新站要 /en /zh /es，旧 URL 不可继承 |
| SEO | 无 canonical、无 robots.txt、无 sitemap.xml，Title 关键词堆砌 | 新站必须从零建立 SEO 体系 |
| 协议 | HTTPS 不可用 | 新站必须全程 HTTPS |
| 模板质量 | 814 个页面残留未渲染占位符 `[about:desc]`、`[about:keyword]`、`[cimages:title]`、`[content:keyword]`、`[content:desc]` | 说明站点维护质量不高 |

### 但旧站有三样东西必须保留下来

1. **真实素材**：产品照片、工厂照片、证书图片（已全部下载到 `data/legacy-site/`）
2. **事实数据**：产品规格表里的 OE 号、适用车型、温度参数（语言中立）
3. **产品与页面的对应关系**：哪个产品对应哪张图，这层关系是人工审核表的输入

---

## 十一、H. 多语言迁移规划

### 目标结构

| 语言 | 路径 | 本阶段是否实施 |
|---|---|---|
| 英文 | `/en/`（默认） | ✅ **只做这个** |
| 中文 | `/zh/` | ⏸ 预留结构，不实施 |
| 西班牙文 | `/es/` | ⏸ 预留结构，不实施 |

### 中文旧站内容的定位

> 中文旧站内容仅作为英文撰写的参考与事实核对来源，不作为可直接发布的文案。

> **禁止机器翻译直接上线；所有英文必须人工撰写或人工校订后方可发布。**

依据：旧站正文含大量国内营销语与绝对化用语，直译会同时触发合规与可信度问题（见 content_review）。

### 建议的实现方式

| 项目 | 建议 |
|---|---|
| 路由 | /en/（默认）, /zh/, /es/ —— Next.js App Router 的 [locale] 动态段 |
| 重定向 | 根路径 / 按 Accept-Language 302 到 /en/，并保留显式语言切换 |
| hreflang / canonical | 每个页面输出 en / zh / es / x-default 的 hreflang 与 canonical 互指 |
| 内容模型 | 产品数据（Products/Applications/OE）与文案分离：数据一套，文案按语言多份 |
| 缺失语言兜底 | zh/es 未完成前，对应语言返回 404 或 "coming soon"，绝不回落到英文内容（避免重复内容） |

### 素材的多语言处理

- **图片**：图片素材与语言无关，可共用；但含中文字的图片（Banner/宣传图）必须重做
- **文档**：PDF 证书/样本需按语言分版本，中文版不进英文站

---

## 十二、下一步资产迁移建议

### 业务方需要做的事（按优先级）

| # | 事项 | 为什么必须由人来做 |
|---|---|---|
| 1 | 填写 **`review/legacy-product-image-mapping.xlsx`**（520 张待确认） | 旧站页面没写编号，程序无法核对，只能人工对应 |
| 2 | 核对证书有效期 | 已过期证书不能上站，程序只能标记不能裁决 |
| 3 | 决定国内联系方式是否对海外公开 | 涉及公司对外口径，不是技术问题 |
| 4 | 确认工厂照片与工序的对应关系 | 标错工序等于向客户提供错误信息 |
| 5 | 提供英文公司名与英文地址 | 英文站必需，旧站只有中文 |

### 我可以接着做的事（等确认后）

| # | 事项 | 说明 |
|---|---|---|
| 1 | 图片工程化处理 | 压缩、裁剪、转 WebP/AVIF、生成多尺寸响应式图 |
| 2 | 把确认后的图片接入 Prototype | 只改 `website/src/data/` 的 `image` 字段，不动组件逻辑 |
| 3 | 补齐 Factory / Quality / About 配图 | 按人工确认的对应关系逐张接入 |
| 4 | 英文文案撰写 | 以旧站中文内容为事实来源，按英文 B2B 习惯重写（不用机翻） |
| 5 | 多语言结构落地 | 引入 `[locale]` 动态段，先只实现 `en` |

### 本阶段的硬性边界（已遵守）

| 禁令 | 状态 |
|---|---|
| 用旧站代码替换 Next.js 项目 | ❌ 未做 |
| 修改现有 Prototype | ❌ 未做（TEST 7 已验证 `website/` 零改动） |
| 把中文内容自动上线英文站 | ❌ 未做 |
| 机器人翻译内容 | ❌ 未做 |
| 绕过登录 / 验证码 / 访问权限 | ❌ 未做（只抓公开页面） |
| 提交任何表单 | ❌ 未做（只读 GET） |
| 无编号证据就自动绑定产品图 | ❌ 未做（TEST 4 已验证） |

---

## 附录 A：本阶段产物清单

| 文件 / 目录 | 内容 |
|---|---|
| `data/legacy-site/crawl/html/` | 943 个页面的原始 HTML |
| `data/legacy-site/crawl/pages.json` | 每页的 Title / Description / H1 / 正文 / 图片 / 链接 / 信标 |
| `data/legacy-site/crawl/probes.json` | robots.txt、sitemap.xml、响应头探测结果 |
| `data/legacy-site/images/{products,factory,certificates,company,other}/` | 870 张图片 |
| `data/legacy-site/documents/` | 0 个文档 |
| `data/legacy-site/downloads.json` | 每个文件的下载结果、尺寸、SHA-256 |
| `data/legacy-site/legacy-products.json` | 旧站产品页结构化字段（规格表解析结果） |
| `data/legacy-site/product-image-matching.json` | 图片匹配结论 + 完整证据链 |
| **`data/legacy-site/assets.json`** | **需求书要求的资产清单**（875 条） |
| `data/legacy-site/legacy-site-audit.json` | 技术审计 + 内容审核 + 映射建议 + 多语言规划 |
| **`review/legacy-product-image-mapping.xlsx`** | **业务方人工确认表** |
| **`docs/qfbowen-legacy-site-audit.md`** | **本报告** |

## 附录 B：工具链（纯 Node.js，零第三方依赖）

| 脚本 | 作用 |
|---|---|
| `tools/legacy/lib/http.mjs` | 代理感知的 HTTP 客户端（重试 / 超时 / 限速 / 并发池） |
| `tools/legacy/lib/html.mjs` | HTML 解析（Meta / 标题 / 链接 / 图片 / 附件 / 视频 / 正文 / 信标） |
| `tools/legacy/lib/classify.mjs` | 页面与素材分类规则（单一事实来源） |
| `tools/legacy/lib/media.mjs` | 图片头部解析（真实格式 + 宽高 + SHA-256） |
| `tools/legacy/lib/match.mjs` | 产品图片匹配规则（含"禁止猜"红线） |
| `tools/legacy/crawl-legacy-site.mjs` | A：抓取公开页面 |
| `tools/legacy/download-legacy-assets.mjs` | B：下载公开素材 |
| `tools/legacy/build-legacy-asset-manifest.mjs` | C：生成 assets.json |
| `tools/legacy/extract-legacy-products.mjs` | D 前置：解析产品规格表 |
| `tools/legacy/match-legacy-product-images.mjs` | D：匹配 + 生成人工审核 XLSX |
| `tools/legacy/audit-legacy-site.mjs` | E/F/G/H：综合审计 |
| `tools/legacy/verify-legacy-audit.mjs` | 验收测试 |
| `tools/legacy/build-legacy-audit-report.mjs` | I：生成本报告 |

## 附录 C：复现命令

```bash
# 依赖 Node.js（本项目用 v24.9.0 验证），无需安装任何第三方包
node tools/legacy/crawl-legacy-site.mjs            # A 抓取（约 20 分钟，旧站较慢）
node tools/legacy/download-legacy-assets.mjs       # B 下载素材
node tools/legacy/extract-legacy-products.mjs      # 解析产品规格表
node tools/legacy/match-legacy-product-images.mjs  # D 匹配 + 人工审核表
node tools/legacy/build-legacy-asset-manifest.mjs  # C assets.json
node tools/legacy/audit-legacy-site.mjs            # E/F/G/H 综合审计
node tools/legacy/build-legacy-audit-report.mjs    # I 生成报告
node tools/legacy/verify-legacy-audit.mjs          # 验收测试
```

> 环境说明：本机通过 `127.0.0.1:10090` 代理访问外网，Node 需 `NODE_USE_ENV_PROXY=1`
> （已在 `lib/http.mjs` 内自动设置）。旧站 HTTPS 在本机与代理链路上均握手失败，
> 已用 Node 的 OpenSSL 独立验证（`tls_probes`），确认是旧站自身问题。
