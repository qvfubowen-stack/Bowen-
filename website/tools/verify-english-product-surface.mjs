#!/usr/bin/env node
/** Verify that every public product route exposes English-only product information. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const HAN = /[\p{Script=Han}]/u;
const INTERNAL = /Source sheets?|source_sheet|How this classification was made|工作表\s*\d|综合产品信息表|审核表|Prototype candidate|Subtype:\s*not used/i;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ids = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'src', 'data', 'products.json'), 'utf8'))
  .map((p) => p.product_id);
const routes = [
  '/products',
  '/oe-search?q=25500-35540',
  '/rfq?product=BW-3005',
  ...ids.map((id) => `/products/${encodeURIComponent(id)}`),
];

let failures = 0;
for (const route of [...new Set(routes)]) {
  const res = await fetch(BASE + route);
  const html = await res.text();
  const main = (html.match(/<main[\s\S]*<\/main>/) ?? [html])[0]
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ');
  const chinese = HAN.test(main);
  const internal = INTERNAL.test(main);
  if (res.status !== 200 || chinese || internal) {
    failures++;
    console.log(`FAIL ${route} HTTP ${res.status} chinese=${chinese} internal=${internal}`);
  } else {
    if (route === '/products' || route.startsWith('/oe-search') || route.startsWith('/rfq')) {
      console.log(`PASS ${route}`);
    }
  }
}

if (failures) {
  console.log(`\nFAIL ${failures}`);
  process.exit(1);
}
console.log(`\nPASS ${[...new Set(routes)].length} routes (${ids.length} product pages) — product information is English-only and internal source labels are absent.`);
