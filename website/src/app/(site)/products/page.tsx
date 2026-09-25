import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ProductCard } from '@/components/ProductCard';
import { ProductFilters } from '@/components/ProductFilters';
import { OeSearchBox } from '@/components/OeSearchBox';
import { getCategorySummaries, getMakeSummaries, getProductTypeOptions, listProducts } from '@/lib/db';
import styles from './products.module.css';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Search Bowen thermostats and cooling parts by OE number, Bowen No., product type, vehicle make or engine.',
};

const PAGE_SIZE = 12;

interface SearchParams {
  q?: string;
  type?: string;
  category?: string;
  make?: string;
  engine?: string;
  sub?: string;
  page?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const result = listProducts({
    q: sp.q ?? '',
    type: sp.type ?? '',
    make: sp.make ?? '',
    engine: sp.engine ?? '',
    page,
    pageSize: PAGE_SIZE,
  });

  const typeOptions = getProductTypeOptions();
  const categories = getCategorySummaries();
  const makes = getMakeSummaries();

  // category 与 sub 是展示层筛选（listProducts 只按 type/make/engine/q 过滤）
  let items = result.items;
  if (sp.category) {
    const cat = categories.find((c) => c.category === sp.category);
    if (cat) {
      items = items.filter((p) => p.website_category === sp.category);
      if (sp.sub) items = items.filter((p) => p.switch_subcategory === sp.sub);
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const hasFilters = Boolean(sp.q || sp.type || sp.category || sp.make || sp.engine);

  return (
    <>
      <section className={styles.head}>
        <div className="container">
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/">Home</Link><span aria-hidden="true">/</span><span>Products</span>
          </nav>
          <h1 className="h1">Products</h1>
          <p className={styles.lead}>
            Search by OE number or Bowen No., then narrow by product type, vehicle make or engine
            application. Every result is a real record from the Bowen product database.
          </p>
          <div className={styles.headSearch}>
            <OeSearchBox size="compact" placeholder="Search OE Number or Bowen No." submitLabel="Search" mode="products" />
          </div>
        </div>
      </section>

      <section className="section sectionTight">
        <div className={`container ${styles.layout}`}>
          <aside className={styles.sidebar}>
            <Suspense fallback={<div className={styles.filterSkeleton}>Loading filters…</div>}>
              <ProductFilters typeOptions={typeOptions} categories={categories} makes={makes} />
            </Suspense>
          </aside>

          <div className={styles.results}>
            <div className={styles.resultsHead}>
              <p className={styles.count}>
                <strong>{result.total}</strong> {result.total === 1 ? 'product' : 'products'}
                {sp.q ? <> matching <span className="mono">{sp.q}</span></> : null}
              </p>
              {hasFilters && (
                <Link href="/products" className={styles.clearInline}>Clear filters</Link>
              )}
            </div>

            {items.length === 0 ? (
              <div className={styles.empty}>
                <h2 className="h3">No products match this search</h2>
                <p>
                  Try a different OE number, clear a filter, or send us the number directly — we may
                  still be able to source it.
                </p>
                <div className={styles.emptyActions}>
                  <Link href="/products" className="btn btnGhost btnSm">Reset filters</Link>
                  <Link href="/rfq" className="btn btnPrimary btnSm">Send us your list</Link>
                </div>
              </div>
            ) : (
              <div className={styles.grid}>
                {items.map((p) => <ProductCard key={p.product_id} product={p} />)}
              </div>
            )}

            {totalPages > 1 && (
              <nav className={styles.pager} aria-label="Pagination">
                {Array.from({ length: totalPages }).slice(0, 12).map((_, i) => {
                  const n = i + 1;
                  const params = new URLSearchParams();
                  for (const [k, v] of Object.entries(sp)) if (v && k !== 'page') params.set(k, String(v));
                  if (n > 1) params.set('page', String(n));
                  const href = params.toString() ? `/products?${params}` : '/products';
                  return (
                    <Link
                      key={n}
                      href={href}
                      className={n === page ? styles.pageActive : styles.page}
                      aria-current={n === page ? 'page' : undefined}
                    >
                      {n}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
