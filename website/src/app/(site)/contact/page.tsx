import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import styles from './contact.module.css';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact Bowen for thermostat enquiries, quotations and supplier documentation.',
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Contact Bowen"
        lead="For quotations, supplier onboarding or technical questions about a thermostat, use the channels below. Sourcing lists are best sent through the RFQ form so every line is captured."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]}
      />

      <section className="section">
        <div className="container">
          <div className={styles.grid}>
            <article className={styles.card}>
              <h2 className="h3">Sales &amp; quotations</h2>
              <p className={styles.cardBody}>
                OE numbers, sourcing lists, price and lead-time enquiries.
              </p>
              <dl className={styles.details}>
                <div>
                  <dt>Email</dt>
                  <dd><a href="mailto:sales@bowen-thermostat.com">sales@bowen-thermostat.com</a></dd>
                </div>
                <div>
                  <dt>Best route</dt>
                  <dd><Link href="/rfq">RFQ form — attach your list</Link></dd>
                </div>
                <div>
                  <dt>Response time</dt>
                  <dd>Normally within one working day</dd>
                </div>
              </dl>
            </article>

            <article className={styles.card}>
              <h2 className="h3">Technical &amp; quality</h2>
              <p className={styles.cardBody}>
                Fitment confirmation, drawings, test reports and supplier documentation packs.
              </p>
              <dl className={styles.details}>
                <div>
                  <dt>Email</dt>
                  <dd><a href="mailto:quality@bowen-thermostat.com">quality@bowen-thermostat.com</a></dd>
                </div>
                <div>
                  <dt>Documents</dt>
                  <dd><Link href="/quality">Quality &amp; certificates</Link></dd>
                </div>
                <div>
                  <dt>Factory visits</dt>
                  <dd><Link href="/contact">Arrange via sales</Link></dd>
                </div>
              </dl>
            </article>

            <article className={`${styles.card} ${styles.cardWide}`}>
              <h2 className="h3">Find a part before you write</h2>
              <p className={styles.cardBody}>
                Most enquiries can be answered faster by looking the part up yourself. Search by OE
                number, Bowen number, vehicle make or engine and you will see the application behind
                each match.
              </p>
              <div className={styles.quickLinks}>
                <Link href="/oe-search" className="btn btnNavy btnSm">Search by OE number</Link>
                <Link href="/products?type=Thermostat" className="btn btnGhost btnSm">Browse thermostats</Link>
                <Link href="/products" className="btn btnGhost btnSm">All products</Link>
              </div>
            </article>

            <article className={`${styles.card} ${styles.cardPlaceholder}`}>
              <h2 className="h3">Company details — pending</h2>
              <p className={styles.cardBody}>
                The following are not published yet because they have not been confirmed from Bowen
                company records. They will be added before the site goes live.
              </p>
              <ul className={styles.pendingList}>
                <li>Full registered company name and address</li>
                <li>Telephone and WhatsApp business numbers</li>
                <li>WeChat / alternative messaging IDs</li>
                <li>Business hours and time zone</li>
                <li>Map and factory location details</li>
              </ul>
              <p className={styles.pendingNote}>
                The email addresses shown above are placeholders used by this prototype and must be
                replaced with the real mailboxes before launch.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`container ${styles.ctaInner}`}>
          <div>
            <h2 className="h2">Send Your OE Number or Sourcing List</h2>
            <p>The RFQ form captures every line, so nothing gets lost between emails.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/rfq" className="btn btnPrimary btnLg">Request a Quote</Link>
          </div>
        </div>
      </section>
    </>
  );
}
