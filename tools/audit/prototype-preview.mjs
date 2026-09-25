import fs from 'node:fs';
const stats = JSON.parse(fs.readFileSync('data/derived/v2/stats.json', 'utf8'));
const site = JSON.parse(fs.readFileSync('website/src/data/products.json', 'utf8'));
const siteApps = JSON.parse(fs.readFileSync('website/src/data/applications.json', 'utf8'));
const siteOe = JSON.parse(fs.readFileSync('website/src/data/oe-index.json', 'utf8'));

console.log('=== Prototype 20 ===');
for (const p of stats.prototype_products) {
  console.log(` #${String(p.rank).padStart(2)} ${p.bowen_no.padEnd(9)} apps=${String(p.application_count).padStart(2)} OE=${String(p.distinct_oe_count).padStart(2)} 表=${p.source_sheets.join('/')} score=${p.completeness_score}`);
}
console.log('\nprototype product ids:', site.length, 'apps:', siteApps.length, 'oe rows:', siteOe.length);
console.log('\n=== 站点数据集里的产品类型分布 ===');
const tc = {};
for (const p of site) tc[p.product_type] = (tc[p.product_type] ?? 0) + 1;
console.log(JSON.stringify(tc));

console.log('\n=== 一个产品详情页需要的数据（第一项） ===');
const p0 = site[0];
console.log(JSON.stringify({ bowen_no: p0.bowen_no, type: p0.product_type, status: p0.status, apps: p0.application_count }, null, 1));
const a0 = siteApps.filter((a) => a.product_id === p0.product_id);
for (const a of a0) {
  console.log(`  ${a.application_id} | OE原文="${String(a.oe_numbers_raw).replace(/\n/g, ' ').slice(0, 70)}" | 车型="${String(a.vehicle_application_raw).slice(0, 60)}" | 温度=${JSON.stringify(a.opening_temperature_c)} | ${a.source_sheet}#${a.source_row}`);
}

console.log('\n=== 全站分类统计（website category → 产品数） ===');
const wc = {};
for (const p of site) wc[p.website_category] = (wc[p.website_category] ?? 0) + 1;
console.log(JSON.stringify(wc, null, 1));

console.log('\n=== 完整数据库里各网站分类可展示产品数（searchable_noindex + prototype） ===');
const all = JSON.parse(fs.readFileSync('data/derived/v2/products.json', 'utf8'));
const pub = all.filter((p) => p.status === 'searchable_noindex' || p.status === 'prototype_candidate');
const wc2 = {};
for (const p of pub) wc2[p.website_category ?? '(未分类)'] = (wc2[p.website_category ?? '(未分类)'] ?? 0) + 1;
console.log(JSON.stringify(wc2, null, 1));

console.log('\n=== 一个真实 OE 用于演示 ===');
const sample = siteOe.filter((e) => site.find((p) => p.product_id === e.product_id && p.bowen_no === '3005')).slice(0, 6);
for (const e of sample) console.log(`  raw=${e.oe_number_raw}  key=${e.oe_search_key}  bowen=${e.bowen_no}`);
