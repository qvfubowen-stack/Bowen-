import Link from 'next/link';
import type { Product } from '@/lib/types';
import { ProductVisual } from './ProductVisual';
import styles from './ProductCard.module.css';

export function ProductCard({ product }: { product: Product }) {
  const typeLabel = product.product_type
    ? product.product_type.replace(/([a-z])([A-Z])/g, '$1 $2')
    : null;

  return (
    <article className={styles.card}>
      <Link href={`/products/${encodeURIComponent(product.product_id)}`} className={styles.visualLink}>
        <ProductVisual label={product.product_name_en} />
      </Link>

      <div className={styles.body}>
        <div className={styles.badges}>
          {typeLabel && <span className="badge badgeType">{typeLabel}</span>}
          {product.prototype_rank && (
            <span className="badge badgeOk">Prototype #{product.prototype_rank}</span>
          )}
        </div>

        <h3 className={styles.title}>
          <Link href={`/products/${encodeURIComponent(product.product_id)}`}>
            Bowen No. {product.bowen_no}
          </Link>
        </h3>

        <dl className={styles.meta}>
          <div>
            <dt>OE references</dt>
            <dd>{product.distinct_oe_count}</dd>
          </div>
          <div>
            <dt>Applications</dt>
            <dd>{product.searchable_application_count}</dd>
          </div>
          <div>
            <dt>Source sheets</dt>
            <dd>{product.source_sheet_count}</dd>
          </div>
        </dl>

        {product.opening_temperatures_c.length > 0 && (
          <p className={styles.temps}>
            <span>Opening temp.</span>{' '}
            {product.opening_temperatures_c.map((t) => `${t}°C`).join(' / ')}
          </p>
        )}

        <div className={styles.actions}>
          <Link
            href={`/products/${encodeURIComponent(product.product_id)}`}
            className="btn btnGhost btnSm"
          >
            View details
          </Link>
          <Link href={`/rfq?product=${encodeURIComponent(product.product_id)}`} className="btn btnNavy btnSm">
            Add to RFQ
          </Link>
        </div>
      </div>
    </article>
  );
}
