// Post-build audit of the v2 database: distributions, spot checks, anomaly review.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'data/derived/v2';
const read = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));

const products = read('products.json');
const apps = read('product-applications.json');
const oe = read('product-oe-search-index.json');
const staging = read('staging-records.json');
const stats = read('stats.json');
const shared = read('shared-oe-across-products.json');

const line = (s) => console.log('\n' + '='.repeat(78) + '\n' + s + '\n' + '='.repeat(78));

line('1. 类型分布');
console.log(JSON.stringify(stats.product_type_counts, null, 1));
console.log('来源分布:', JSON.stringify(stats.product_type_source_counts, null, 1));
console.log('状态分布:', JSON.stringify(stats.status_counts, null, 1));

line('2. 未确认类型的产品样本（前 15）');
for (const p of products.filter((x) => x.product_type === null).slice(0, 15)) {
  console.log(`  ${p.bowen_no.padEnd(10)} src=${p.product_type_source} sheets=${p.source_sheets.join('/')} apps=${p.application_count} oe=${p.distinct_oe_count}`);
}

line('3. 已确认类型的产品样本（前 10）');
for (const p of products.filter((x) => x.product_type !== null).slice(0, 10)) {
  console.log(`  ${p.bowen_no.padEnd(10)} ${String(p.product_type).padEnd(26)} src=${p.product_type_source.padEnd(22)} sheets=${p.source_sheets.join('/')} apps=${p.application_count} oe=${p.distinct_oe_count}`);
}

line('4. blocked 产品全部清单');
for (const p of products.filter((x) => x.blocked)) {
  console.log(`  ${p.bowen_no.padEnd(10)} status=${p.status.padEnd(20)} reasons=${p.blocked_reasons.length}`);
  for (const r of p.blocked_reasons.slice(0, 2)) console.log(`       ${r}`);
}
const blockedNotBlocked = products.filter((p) => p.blocked && p.status !== 'blocked');
console.log(`\n  blocked=true 但 status!=blocked 的产品数（部分记录可用）: ${blockedNotBlocked.length}`);
for (const p of blockedNotBlocked) console.log(`    ${p.bowen_no} status=${p.status} 可用apps=${p.searchable_application_count}/${p.application_count}`);

line('5. Prototype 20 个产品');
for (const p of stats.prototype_products) {
  console.log(`  #${String(p.rank).padStart(2)} ${p.bowen_no.padEnd(9)} apps=${String(p.application_count).padStart(2)} (可用${p.searchable_application_count}) OE=${String(p.distinct_oe_count).padStart(2)} 表=${p.source_sheets.join('/')} score=${p.completeness_score}`);
}

line('6. 抽查 Bowen 3005 的 applications（OE↔车型 行级关系）');
const a3005 = apps.filter((a) => a.bowen_no === '3005');
console.log(`  applications: ${a3005.length}`);
for (const a of a3005.slice(0, 5)) {
  console.log(`   ${a.application_id} sheet=${a.source_sheet} row=${a.source_row}`);
  console.log(`      OE raw: ${String(a.oe_numbers_raw).slice(0, 110).replace(/\n/g, ' ⏎ ')}`);
  console.log(`      OE k  : ${a.oe_number_normalized.slice(0, 8).join(', ')}${a.oe_number_normalized.length > 8 ? ' …(' + a.oe_number_normalized.length + ')' : ''}`);
  console.log(`      VEHL  : ${String(a.vehicle_application_raw).slice(0, 110)}`);
  console.log(`      TEMP  : ${JSON.stringify(a.opening_temperature_c)}`);
}

line('7. OE 标准化抽查');
const probe = ['25500-35540', '2550035540', '25500 35540', '25500/35540'];
for (const p of probe) {
  const k = p.toUpperCase().replace(/[\u3000\s]/g, '').replace(/[-‐‑‒–—―]/g, '').replace(/[/\\]/g, '').replace(/[^A-Z0-9.]/g, '');
  const hit = oe.filter((e) => e.oe_search_key === k);
  console.log(`  "${p}" → key=${k} 命中 ${hit.length} 条${hit.length ? ' → ' + hit.map((h) => h.bowen_no).join(', ') : ''}`);
}

line('8. 共享 OE 抽查');
console.log(`  总数 ${shared.length}，前 8：`);
for (const s of shared.slice(0, 8)) {
  console.log(`   ${s.oe_search_key.padEnd(16)} → ${s.product_count} 个 Bowen: ${s.bowen_nos.join(', ')}`);
}

line('9. 一致性自检');
const productIds = new Set(products.map((p) => p.product_id));
const orphanApps = apps.filter((a) => !productIds.has(a.product_id));
const orphanOe = oe.filter((e) => !productIds.has(e.product_id));
console.log(`  products=${products.length} apps=${apps.length} oeIndex=${oe.length}`);
console.log(`  孤立 application: ${orphanApps.length}  孤立 OE 索引: ${orphanOe.length}`);
console.log(`  staging=${staging.length} 未聚合记录: ${staging.filter((r) => !r.bowen_no).length}`);
const blockedInOe = oe.filter((e) => apps.find((a) => a.application_id === e.application_id)?.blocked);
console.log(`  blocked application 出现在 OE 索引中: ${blockedInOe.length}`);
const blockedInPrototype = products.filter((p) => p.status === 'prototype_candidate' && p.blocked);
console.log(`  blocked 产品进入 prototype: ${blockedInPrototype.length}`);
const nullTypeWithVerified = products.filter((p) => p.product_type === null && p.product_type_verified);
console.log(`  类型为空但标记 verified: ${nullTypeWithVerified.length}`);
const typeWithUnverified = products.filter((p) => p.product_type !== null && !p.product_type_verified);
console.log(`  类型非空但未 verified: ${typeWithUnverified.length}`);
