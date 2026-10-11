#!/usr/bin/env node
/**
 * 生成业务决定文件 data/raw/business-decisions-v3.json
 * ===========================================================================
 * 本文件把业务方本轮的**人工决定**固化为机器可读的 Source of Truth。
 * 所有决定都来自业务方原话，程序不做任何补充推断。
 *
 * 用法：node tools/build-business-decisions-v3.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = path.join(ROOT, 'data/derived/_type-form-groups.json');
const FORM = path.join(ROOT, 'review/product-type-unconfirmed.xlsx');
const OUT = path.join(ROOT, 'data/raw/business-decisions-v3.json');

const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const groups = JSON.parse(fs.readFileSync(GROUPS, 'utf8'));

const confirmed = groups.plain.map((r) => String(r.bowen_cell_A).trim());
/** Bowen → 表单行号（用于证据可回溯） */
const confirmedFormRows = Object.fromEntries(
  groups.plain.map((r) => [String(r.bowen_cell_A).trim(), r.row]),
);
const discarded = groups.yellow.map((r) => ({
  product_id: String(r.product_id_C).trim(),
  bowen_cell_raw: r.bowen_cell_raw_B == null ? null : String(r.bowen_cell_raw_B),
  form_row: r.row,
}));

if (confirmed.length !== 40) throw new Error(`期望 40 个未标黄产品，实际 ${confirmed.length}`);
if (discarded.length !== 30) throw new Error(`期望 30 个标黄产品，实际 ${discarded.length}`);

const decisions = {
  schema: 'bowen-business-decisions/v3',
  decided_at: '2026-09-25',
  decided_by: '业务方（人工决定）',
  note:
    '本文件是业务方人工决定的唯一记录。程序只执行这里写明的决定，'
    + '不做任何补充推断；product_type 仍然只来自人工。',

  // ---------------------------------------------------------------- 产品类型复核
  product_type_review: {
    source_form: 'review/product-type-unconfirmed.xlsx',
    source_form_sha256: sha256(FORM),
    how_marked:
      '业务方在该表内用黄色填充（#FFFF00）标出要求舍弃的部分；未标黄部分为确认保留。',
    reviewed_at: '2026-09-25',
    business_statement:
      '「那70个产品类型的表我审阅过了，类型都是节温器，但是把我标黄的部分舍弃掉，不要再出现在产品库里」',
    confirmed_product_type: 'Thermostat',
    confirmed_bowen_nos: confirmed,
    confirmed_count: confirmed.length,
    confirmed_form_rows: confirmedFormRows,
    discarded: discarded,
    discarded_count: discarded.length,
    discard_reason: 'business_marked_yellow_discard',
    discard_effect: '这些产品及其 application 整体移出产品库（不是隐藏，而是不生成）',
  },

  // ---------------------------------------------------------------- 图片复核
  image_review: {
    reviewed_at: '2026-09-25',
    D1_bowen_unreadable_14: {
      business_answer: '编号读不出的部分先忽略',
      decision: 'ignore_for_now',
      effect: '本轮不处理；这 14 张图片保持原状，归属待定',
    },
    D2_row_without_bowen_7: {
      business_answer: '记录行但没编号的类别都是节温器',
      decision: 'product_type_is_thermostat',
      note:
        '业务方确认这些行属于节温器品类。但程序仍未取得这些行的 Bowen No.，'
        + '因此**不生成产品、不做归属**（不猜）。待业务方补编号后再归位。',
      effect: '仅记录品类；图片归属不变',
    },
    D3_not_in_database_5: {
      business_answer: '已入库',
      decision: 'include_in_library',
      bowen_nos: ['38169', '38298', '3932', '32603', '32748-1'],
      note:
        '业务方表示这 5 个编号应视为已入库。核对结果：**它们当前并不在产品库中**'
        + '（Phase 2.5 把「整行只有编号、没有 OE 也没有车型」的辅助表行作为天博编号孤立行排除）。'
        + '按业务方意图，本轮把它们补入产品库，使对应图片可归位。'
        + '它们的 product_type 没有人工标签，因此保持 null + review_required（不猜）。',
      unexclude_cell_refs: [
        '工作表1!D12', '工作表1!D13', '工作表1!D51', '工作表1!D151',
      ],
      unexclude_split_from_cell: { cell_ref: '工作表1!D154', take_token: '32748-1' },
    },
    D4_unresolved_5: {
      business_answer: '确认删除',
      decision: 'exclude_from_library',
      note:
        '业务方确认这 5 张无法映射的图片从产品图片集里删除（不进入产品库、不进入网站）。'
        + '其中 IMG-0780 依 D6 单独处理（先裁剪保留），因此实际删除 4 张。',
      explicit_exception: ['IMG-0780'],
      effective_exclusions: ['IMG-0723', 'IMG-0787', 'IMG-0797', 'IMG-0798'],
      effect: '这些图片不再导出到 product-images/，也不出现在任何产品下',
    },
    D5_IMG_0723: {
      business_answer: '忽略这个产品',
      decision: 'exclude_from_library',
      note:
        '该图是内部系统页面截图，含内部进价/售价。业务方决定忽略，不再出现在任何产品下。',
      effect: '与 D4 的删除一致',
    },
    D6_IMG_0780: {
      business_answer: '先裁剪',
      decision: 'crop_then_keep',
      note:
        '该图是手机截图（含状态栏与相册 UI），业务方要求先裁剪掉界面部分。'
        + '裁剪后保留；因仍无产品归属，保持 unresolved（不猜），并记录已裁剪。',
      crop: { mode: 'trim_ui_frame' },
      effect: '生成一张裁剪后的图片，替代原图用于后续使用',
    },
    D7_watermark: {
      business_answer: '水印保留，这是我们公司商标',
      decision: 'keep_watermark',
      note:
        '**重要更正**：程序此前把图片上的「GXN」水印描述为「第三方品牌水印」，'
        + '业务方确认 GXN 是本公司商标，应保留，不得去除。'
        + '因此水印不构成风险项，也不需要处理。',
      effect: '图片水印保持原样；相关风险说明作废',
    },
    D8_casual_photos: {
      business_answer: '保留',
      decision: 'keep',
      note: '业务方决定保留随手拍照片（如 IMG-0793），不做重拍要求。',
      effect: '这些图片保留在原集合中',
    },
    D9_main_image: {
      business_answer: '主图你自己选择',
      decision: 'assign_deterministic_rule',
      rule: {
        description:
          '同一 Bowen 有多张图时，按以下优先级选主图（确定性、可复现，不依赖人工）：',
        priority: [
          '1. 来源工作表 = 综合产品信息表（主目录优先）',
          '2. 其次按系列工作表在 Excel 中的顺序（sheet_index 升序）',
          '3. 同一工作表内按锚点行号升序',
          '4. 仍相同则按 media_part 名称的字典序',
        ],
        tie_break: 'media_part 字典序',
      },
      effect: '为每个产品的多张图片计算 primary_image 标记',
    },
  },

  // ---------------------------------------------------------------- 其它说明
  other_notes: {
    capacity_and_lead_time: {
      business_answer: '产能/标准交期什么的先不做了',
      decision: 'not_pursued',
      effect: 'Factory 页的产能/交期 placeholder 不再作为待补项推进',
    },
    company_info_source: {
      business_answer: '关于邮箱地址，公司全称等，请阅读博文公司宣传手册，里面都有',
      decision: 'extract_from_brochure',
      extracted_to: 'docs/company-info-from-brochure.md',
    },
  },
};

fs.writeFileSync(OUT, JSON.stringify(decisions, null, 1), 'utf8');
console.log(`已写出 ${path.relative(ROOT, OUT)}`);
console.log(`  确认类型（Thermostat）: ${confirmed.length} 个`);
console.log(`  舍弃                   : ${discarded.length} 个`);
console.log(`  补入库                 : ${decisions.image_review.D3_not_in_database_5.bowen_nos.length} 个`);
console.log(`  图片删除               : ${decisions.image_review.D4_unresolved_5.effective_exclusions.length} 张（IMG-0780 例外，裁剪保留）`);
