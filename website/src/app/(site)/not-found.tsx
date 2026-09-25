import Link from 'next/link';
import { OeSearchBox } from '@/components/OeSearchBox';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <section className={styles.wrap}>
      <div className={`container ${styles.inner}`}>
        <span className={styles.code}>404</span>
        <h1 className="h1">This page or product is not available</h1>
        <p className={styles.lead}>
          The link may be out of date, or the product may be held back from the public catalogue
          while its source data is being verified. Search by OE number instead — or send us the
          number directly.
        </p>
        <div className={styles.search}>
          <OeSearchBox size="compact" submitLabel="Search OE" mode="oe" />
        </div>
        <div className={styles.actions}>
          <Link href="/products" className="btn btnOutline">Browse all products</Link>
          <Link href="/rfq" className="btn btnPrimary">Request a Quote</Link>
        </div>
      </div>
    </section>
  );
}
