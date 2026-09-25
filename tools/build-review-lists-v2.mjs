#!/usr/bin/env node
/**
 * Phase 2.5 — 人工参考清单（只生成，不改数据库）
 * ===========================================================================
 * 1) review/shared-oe-across-products.xlsx
 *    同一个 normalized OE 对应多个不同 Bowen No. 的情况。
 *    业务规则：这些记录全部保留，不删除、不合并、不自动判定谁正确。
 *    本文件仅供以后人工参考，不阻止 Prototype 开发。
 *
 * 2) review/product-type-unconfirmed.xlsx
 *    没有任何人工类型标签的产品清单（product_type = null）。
 *    程序不猜，等业务方批量确认后回填。
 *
 * 用法：node tools/build-review-lists-v2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeXlsx, STYLE } from './lib/xlsx-writer.mjs';
import { PRODUCT_TYPES } from './config/product-types.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data/derived/v2');
const REVIEW = path.join(ROOT, 'review');

const read = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const products = read('products.json');
const apps = read('product-applications.json');
const shared = read('shared-oe-across-products.json');
const stats = read('stats.json');

const productById = new Map(products.map((p) => [p.product_id, p]));
const appById = new Map(apps.map((a) => [a.application_id, a]));

fs.mkdirSync(REVIEW, { recursive: true });

// =====================================================================
// 1. 共享 OE 清单
// =====================================================================
{
  const rows = [];
  for (const s of shared) {
    for (const bowen of s.bowen_nos) {
      const pid = `BW-${bowen.toUpperCase()}`;
      const p = productById.get(pid);
      const hits = s.applications.filter((a) => a.product_id === pid);
      for (const h of hits) {
        const app = appById.get(h.application_id);
        rows.push([
          s.oe_search_key,
          s.oe_numbers_raw.join(' / '),
          s.product_count,
          bowen,
          p?.product_type ?? '(类型待确认)',
          p?.product_type_source ?? '',
          app?.oe_numbers_raw ?? '',
          app?.vehicle_application_raw ?? '',
          h.source_sheet,
          { v: h.source_row, type: 'number' },
        ]);
      }
    }
  }

  writeXlsx(path.join(REVIEW, 'shared-oe-across-products.xlsx'), [
    {
      name: '填表说明',
      title: '共享 OE 参考清单（填表说明）',
      autoFilter: false,
      columns: [{ title: '项目', width: 26 }, { title: '说明', width: 100 }],
      rows: [
        ['这个文件是做什么的', '同一个标准化 OE 号出现在多个不同 Bowen No. 上。业务规则：这些记录全部保留，不删除、不合并、不自动判定谁正确。'],
        ['要处理什么', '本阶段不需要填。仅作以后人工核对参考（可能是同一零件多个 Bowen 编号，也可能是一方录错）。'],
        ['是否阻止开发', '不阻止。网站 Prototype 与 OE 搜索正常开发，搜索命中多个产品时会把每一个都列出来。'],
        ['OE 标准化规则', '忽略大小写、空格、短横线、斜线。例：25500-35540 = 2550035540 = 25500 35540 = 25500/35540'],
        ['数据来源', 'data/derived/v2/shared-oe-across-products.json（可重新生成）'],
        ['统计', `共 ${shared.length} 个 OE 出现在多个 Bowen No. 上，展开 ${rows.length} 行`],
        ['对应数据库字段', 'oe_number_normalized（搜索键）/ oe_number_raw（展示用，保留原文）'],
      ],
    },
    {
      name: '共享OE清单',
      title: '同一个 OE 对应多个 Bowen No.（全部保留，不删除不合并）',
      notes: ['按 product_count 从多到少排列。'],
      freeze: { row: 4, col: 0 },
      autoFilter: true,
      columns: [
        { title: 'OE 标准化键', width: 18 },
        { title: 'OE 原始写法', width: 26 },
        { title: '涉及 Bowen 数', width: 12 },
        { title: 'Bowen No.', width: 12 },
        { title: '产品类型', width: 20 },
        { title: '类型来源', width: 20 },
        { title: '该记录 OE 原文', width: 44 },
        { title: '该记录车型原文', width: 44 },
        { title: '来源工作表', width: 16 },
        { title: '来源行', width: 9 },
      ],
      rows,
    },
  ]);
  console.log(`review/shared-oe-across-products.xlsx — ${shared.length} 个 OE / ${rows.length} 行`);
}

// =====================================================================
// 2. 类型待确认清单
// =====================================================================
{
  const unconfirmed = products.filter((p) => !p.product_type);
  const typeOptions = Object.keys(PRODUCT_TYPES);

  const rows = unconfirmed.map((p) => {
    const pApps = apps.filter((a) => a.product_id === p.product_id);
    return [
      p.bowen_no ?? '(编号无法读出)',
      p.unresolved_bowen_cell_raw ?? '',
      p.product_id,
      p.source_sheets.join(' / '),
      { v: p.application_count, type: 'number' },
      { v: p.distinct_oe_count, type: 'number' },
      pApps.slice(0, 6).map((a) => a.oe_numbers_raw).join(' | '),
      pApps.slice(0, 3).map((a) => a.vehicle_application_raw).join(' | '),
      p.status,
      '',
      '',
    ];
  });

  writeXlsx(path.join(REVIEW, 'product-type-unconfirmed.xlsx'), [
    {
      name: '填表说明',
      title: '产品类型待确认清单（填表说明）',
      autoFilter: false,
      columns: [{ title: '项目', width: 26 }, { title: '说明', width: 100 }],
      rows: [
        ['这个文件是做什么的', '这些产品在 Excel 里找不到任何人工产品类型标签，程序按规则不猜，全部留空。等业务方确认后回填。'],
        ['为什么会有这些产品', '它们只在车型系列表或辅助表（工作表1 天博编号对照表）出现，而综合产品信息表的对应 Bowen 分类里没有它们。'],
        ['怎么填', '在「人工确认类型」列用下拉菜单选择。选完把文件放回 review/ 目录并告知，我会回填数据库。'],
        ['颜色约定', '🔵 表头（别动）｜🟡 手工填写｜🟢 下拉选择'],
        ['重要', '这些产品已经入库、可搜索，只是没有被网站正式分类展示。类型留空不会阻断已确认产品的上线。'],
        ['统计', `共 ${unconfirmed.length} 个产品类型待确认，占全部 ${products.length} 个产品的 ${((unconfirmed.length / products.length) * 100).toFixed(1)}%`],
      ],
    },
    {
      name: '类型待确认产品',
      title: `产品类型待确认清单（${unconfirmed.length} 个）— 程序未做任何猜测`,
      notes: ['「人工确认类型」列有下拉菜单。确认值会被归一化：Automotive Thermostat / Thermostat Insert / Thermostat Assembly → Thermostat'],
      freeze: { row: 3, col: 2 },
      autoFilter: true,
      columns: [
        { title: 'Bowen No.', width: 18 },
        { title: 'Bowen 单元格原文', width: 30 },
        { title: 'product_id', width: 18 },
        { title: '出现的工作表', width: 28 },
        { title: 'application 数', width: 13 },
        { title: 'OE 数', width: 8 },
        { title: 'OE 原文（前 6 条记录）', width: 46 },
        { title: '车型原文（前 3 条）', width: 46 },
        { title: '当前状态', width: 18 },
        { title: '人工确认类型', width: 24, style: STYLE.MANUAL_LIST },
        { title: '备注', width: 30, style: STYLE.MANUAL },
      ],
      rows,
      validations: [{
        sqref: `J4:J${3 + rows.length + 100}`,
        values: typeOptions,
        promptTitle: '请选择产品类型',
        prompt: '只能选词典里的 canonical 类型；节温器的四种写法统一选 Thermostat',
      }],
    },
  ]);
  console.log(`review/product-type-unconfirmed.xlsx — ${unconfirmed.length} 个产品`);
}

// =====================================================================
// 3. 错位待复核清单
// =====================================================================
{
  const flagged = apps.filter((a) => a.needs_review);
  const rows = flagged.map((a) => [
    a.bowen_no,
    a.product_id,
    a.source_sheet,
    { v: a.source_row, type: 'number' },
    a.source_cell_refs.bowen,
    a.bowen_cell_raw,
    a.bowen_overflow_raw ?? '',
    a.oe_numbers_raw,
    a.vehicle_application_raw,
    a.verification_status,
    a.misalignment_notes.join(' ; '),
  ]);

  writeXlsx(path.join(REVIEW, 'row-misalignment-v2.xlsx'), [
    {
      name: '填表说明',
      title: '字段错位待复核清单（Phase 2.5）',
      autoFilter: false,
      columns: [{ title: '项目', width: 26 }, { title: '说明', width: 100 }],
      rows: [
        ['这个文件是做什么的', 'Bowen No. 单元格里混进了尺寸 / 温度 / 说明文字（例如 "3029  92°"）。程序已把编号读出来，错位内容原样保留在备注列。'],
        ['为什么不自动修复', '项目铁律：不猜、不自动修复、不自动合并。程序只负责标出来。'],
        ['是否阻断', '不阻断。这些产品的编号可读，其他工作表里通常还有同一编号的干净记录，所以产品仍可上线。'],
        ['已阻断的记录', `Bowen No. 完全读不出来的记录共 ${stats.misalignment_unreadable_records} 条，已 blocked，不进入网站任何入口（见 data/derived/v2/staging-records.json 的 blocked=true 记录）。`],
        ['统计', `本清单 ${flagged.length} 条；另有 ${stats.misalignment_unreadable_records} 条已阻断。`],
      ],
    },
    {
      name: '错位待复核',
      title: `字段错位待复核（${flagged.length} 条）— 原始内容全部保留`,
      freeze: { row: 3, col: 0 },
      autoFilter: true,
      columns: [
        { title: 'Bowen No.', width: 12 },
        { title: 'product_id', width: 16 },
        { title: '来源工作表', width: 18 },
        { title: '来源行', width: 9 },
        { title: '单元格', width: 10 },
        { title: 'Bowen 单元格原文', width: 40 },
        { title: '错位溢出内容', width: 30 },
        { title: 'OE 原文', width: 40 },
        { title: '车型原文', width: 40 },
        { title: '校验状态', width: 26 },
        { title: '命中规则', width: 60 },
      ],
      rows,
    },
  ]);
  console.log(`review/row-misalignment-v2.xlsx — ${flagged.length} 条`);
}

console.log('\n完成。以上文件仅供人工参考，不修改数据库。');
