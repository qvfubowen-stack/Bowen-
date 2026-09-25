import fs from 'node:fs';
const pr = JSON.parse(fs.readFileSync('data/derived/v2/products.json', 'utf8'));
const ap = JSON.parse(fs.readFileSync('data/derived/v2/product-applications.json', 'utf8'));
const oe = JSON.parse(fs.readFileSync('data/derived/v2/product-oe-search-index.json', 'utf8'));
const st = JSON.parse(fs.readFileSync('data/derived/v2/stats.json', 'utf8'));

console.log('products:', pr.length);
console.log('products with >=2 OE:', pr.filter((p) => p.distinct_oe_count >= 2).length);
console.log('max distinct OE:', Math.max(...pr.map((p) => p.distinct_oe_count)), 'on', pr.find((p) => p.distinct_oe_count === Math.max(...pr.map((x) => x.distinct_oe_count)))?.bowen_no);
const oeTokens = ap.reduce((s, a) => s + a.oe_token_count, 0);
const notOe = ap.reduce((s, a) => s + (a.oe_tokens_not_oe_like_count ?? 0), 0);
console.log('OE tokens in applications:', oeTokens, '| not-OE-like tokens:', notOe, '| sum:', oeTokens);
console.log('oe index rows:', oe.length);
console.log('avg OE/product (tokens/products):', (oeTokens / pr.length).toFixed(3));
console.log('avg app/product:', (ap.length / pr.length).toFixed(3));
console.log('stats avg_oe_per_product:', st.avg_oe_per_product, 'avg_application_per_product:', st.avg_application_per_product);
console.log('prototype apps total:', st.prototype_products.reduce((s, p) => s + p.application_count, 0));

console.log('\nsection label coverage by type:');
const byLabel = {};
for (const p of pr) {
  const e = p.product_type_evidence;
  if (e?.kind === 'human_section_label') byLabel[e.raw_label] = (byLabel[e.raw_label] ?? 0) + 1;
}
console.log(JSON.stringify(byLabel, null, 1));

console.log('\nrecords for each master section:');
const masterLabels = ['节温器', '冷却水管', '温度传感器', '机油压力报警器', '热敏开关', '刹车灯开关', '倒车灯开关'];
const stg = JSON.parse(fs.readFileSync('data/derived/v2/staging-records.json', 'utf8'));
for (const l of masterLabels) {
  const recs = stg.filter((r) => r.source_sheet === '综合产品信息表' && r.section_label_raw === l);
  const rows = recs.map((r) => r.source_row);
  console.log(`  ${l.padEnd(8)} records=${String(recs.length).padStart(3)} rows ${Math.min(...rows)}–${Math.max(...rows)}`);
}
console.log('products with 2+ apps:', pr.filter((p) => p.application_count >= 2).length);
console.log('products searchable (noindex+prototype):', pr.filter((p) => ['searchable_noindex','prototype_candidate'].includes(p.status)).length);
console.log('needs_review apps:', ap.filter((a) => a.needs_review).length);
console.log('blocked apps:', ap.filter((a) => a.blocked).length);
console.log('clean apps:', ap.filter((a) => !a.blocked && !a.needs_review).length);
