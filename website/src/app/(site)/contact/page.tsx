import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getSiteFacts } from '@/lib/db';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import styles from './contact.module.css';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact Qufu Bowen Auto Parts Manufacturing Co., Ltd. for thermostat enquiries, quotations and supplier documentation.',
  alternates: canonicalFor('/contact'),
  openGraph: { url: absoluteUrl('/contact'), title: 'Contact | Bowen', type: 'website' },
};

export default async function ContactPage() {
  const c = (await getSiteFacts()).company;

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
            {/* 公司主体信息：名称 / 邮箱 / 电话 —— 全部来自宣传手册封底 */}
            <article className={`${styles.card} ${styles.cardWide} ${styles.companyCard}`}>
              <span className="eyebrow">Company</span>
              <h2 className="h2">{c.legal_name_en}</h2>
              <p className={styles.legalZh}>{c.legal_name_zh}</p>

              <dl className={styles.details}>
                <div>
                  <dt>Address</dt>
                  <dd className={styles.address}>{c.address_en}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
                </div>
                <div>
                  <dt>Tel</dt>
                  <dd><a href={`tel:${c.tel_href}`}>{c.tel_display}</a></dd>
                </div>
                <div>
                  <dt>Best route</dt>
                  <dd><Link href="/rfq">RFQ form — send your sourcing list</Link></dd>
                </div>
              </dl>
            </article>

            <article className={styles.card}>
              <h2 className="h3">Sales &amp; quotations</h2>
              <p className={styles.cardBody}>
                OE numbers, sourcing lists, price and availability enquiries.
              </p>
              <dl className={styles.details}>
                <div>
                  <dt>Email</dt>
                  <dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
                </div>
                <div>
                  <dt>Tel</dt>
                  <dd><a href={`tel:${c.tel_href}`}>{c.tel_display}</a></dd>
                </div>
                <div>
                  <dt>Best route</dt>
                  <dd><Link href="/rfq">RFQ form — send your list</Link></dd>
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
                  <dd><a href={`mailto:${c.email}`}>{c.email}</a></dd>
                </div>
                <div>
                  <dt>Documents</dt>
                  <dd><Link href="/quality">Quality &amp; certificates</Link></dd>
                </div>
                <div>
                  <dt>Factory visits</dt>
                  <dd><Link href="/factory">Factory &amp; audits</Link></dd>
                </div>
              </dl>
            </article>

            <article className={`${styles.card} ${styles.cardWide}`}>
              <h2 className="h3">Find a part before you write</h2>
              <p className={styles.cardBody}>
                Most enquiries can be answered faster by looking the part up yourself. Search by OE
                number, Bowen number or vehicle make and you will see the application recorded behind
                each match.
              </p>
              <div className={styles.quickLinks}>
                <Link href="/oe-search" className="btn btnNavy btnSm">Search by OE number</Link>
                <Link href="/products?type=Thermostat" className="btn btnGhost btnSm">Browse thermostats</Link>
                <Link href="/products" className="btn btnGhost btnSm">All products</Link>
              </div>
            </article>

            {/* 国内平台：次要位置 + 明确标注，绝不当作海外官网域名 */}
            <article className={`${styles.card} ${styles.cardWide} ${styles.marketCard}`}>
              <h2 className="h3">Domestic marketplace</h2>
              <p className={styles.cardBody}>
                Bowen also maintains a storefront on 1688, a China domestic marketplace:
              </p>
              <p className={styles.marketUrl}>{c.domestic_marketplace_label}</p>
              <p className={styles.marketNote}>
                {c.domestic_marketplace_note} It is listed here for reference only and is not the
                website of Bowen&apos;s export business.
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
