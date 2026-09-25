import type { Metadata } from 'next';
import Link from 'next/link';
import { RfqForm } from '@/components/RfqForm';
import { getDisplayApplications, getPublishedProducts } from '@/lib/db';
import styles from './rfq.module.css';

export const metadata: Metadata = {
  title: 'Request a Quote',
  description: 'Send your OE numbers or sourcing list to Bowen and receive Bowen numbers, applications and availability.',
};

export default async function RfqPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const sp = await searchParams;

  // 只把必要字段传给客户端组件，避免把整个数据库发到浏览器。
  // first_application_id 必须带上：从 /rfq?product=... 进入时，
  // 这条 application 关联会直接写进 RFQ payload（不能丢）。
  const published = await getPublishedProducts();
  const products = await Promise.all(
    published.map(async (p) => {
      const apps = await getDisplayApplications(p.product_id);
      return {
        product_id: p.product_id,
        bowen_no: p.bowen_no,
        product_type: p.product_type,
        vehicle_application_raw: apps[0]?.vehicle_application_raw ?? '',
        first_oe: apps[0]?.oe_tokens?.[0] ?? null,
        first_application_id: apps[0]?.application_id ?? null,
      };
    }),
  );

  return (
    <>
      <section className={styles.head}>
        <div className="container">
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/">Home</Link><span aria-hidden="true">/</span><span>Request a Quote</span>
          </nav>
          <h1 className="h1">Send Your OE Number or Sourcing List</h1>
          <p className={styles.lead}>
            Add parts from the catalogue or paste your list straight in. We reply with Bowen numbers,
            the matching applications and availability — normally within one working day.
          </p>
        </div>
      </section>

      <section className="section sectionTight">
        <div className={`container ${styles.layout}`}>
          <div className={styles.formCol}>
            <RfqForm preselect={sp.product} products={products} />
          </div>

          <aside className={styles.sideCol}>
            <div className={styles.sideCard}>
              <h2 className="h4">What happens next</h2>
              <ol className={styles.steps}>
                <li><span>1</span><div><strong>We read your list</strong><p>Every OE number is matched against our normalized OE index.</p></div></li>
                <li><span>2</span><div><strong>We confirm fitment</strong><p>You get Bowen numbers with the vehicle and engine application for each line.</p></div></li>
                <li><span>3</span><div><strong>We quote</strong><p>Price, MOQ and lead time per line, with the option to quote mixed containers.</p></div></li>
              </ol>
            </div>

            <div className={styles.sideCard}>
              <h2 className="h4">Useful to include</h2>
              <ul className={styles.tips}>
                <li>OE numbers, one per line</li>
                <li>Quantities per reference</li>
                <li>Vehicle or engine if you are unsure of the OE</li>
                <li>Target price and packaging requirements</li>
                <li>Destination port</li>
              </ul>
            </div>

            <div className={`notice noticeInfo ${styles.sideNote}`}>
              <strong>Prototype note.</strong> This form does not send email yet. Submitting shows the
              exact payload the production form would transmit, so the data flow can be verified
              end to end.
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
