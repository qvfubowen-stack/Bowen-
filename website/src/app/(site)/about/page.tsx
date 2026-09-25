import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getDatasetStats, getSiteFacts } from '@/lib/db';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About Bowen',
  description: 'Bowen is an automotive thermostat manufacturer supplying importers, wholesalers and aftermarket distributors.',
};

export default function AboutPage() {
  const c = getSiteFacts().company;
  const stats = getDatasetStats();

  return (
    <>
      <PageHero
        eyebrow="About"
        title="A thermostat factory, not a trading catalogue"
        lead="Bowen manufactures automotive thermostats and supplies the aftermarket through importers, wholesalers and distributors. Our customers buy in volume for resale — not single units."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'About Bowen' }]}
        cta={
          <>
            <Link href="/products" className="btn btnOutline">Browse products</Link>
            <Link href="/rfq" className="btn btnPrimary">Request a Quote</Link>
          </>
        }
      />

      <section className="section">
        <div className="container">
          <div className={styles.twoCol}>
            <div>
              <span className="eyebrow">Who we are</span>
              <h2 className="h2">Manufacturing thermostats since {c.since_year}</h2>
              <div className={styles.prose}>
                <p>
                  Bowen has been producing automotive thermostats since {c.since_year}. The plant
                  covers a {c.manufacturing_base_m2.toLocaleString('en-US')} m² manufacturing base,
                  including a {c.production_workshop_m2.toLocaleString('en-US')} m² production
                  workshop and a {c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m²
                  temperature-controlled workshop with {c.production_equipment_count}+ production
                  equipment.
                </p>
                <p>
                  Engineering work is ongoing rather than one-off: {c.rd_projects} R&amp;D projects,{' '}
                  {c.patents} patents and {c.software_copyrights} software copyrights are recorded in
                  Bowen company materials.
                </p>
                <p>
                  Certification covers three management systems — {c.certifications.join(', ')} — each
                  with a defined scope that we publish rather than stretch.
                </p>
              </div>

              <div className={styles.audienceNote}>
                <strong>Who we supply</strong>
                <ul>
                  <li>Aftermarket importers</li>
                  <li>Wholesale distributors</li>
                  <li>Parts dealers and buying groups</li>
                  <li>Programme and private-label buyers</li>
                </ul>
                <p>
                  We do not sell to end consumers, and we do not run a retail checkout. If you buy in
                  containers or pallet quantities, you are in the right place.
                </p>
              </div>
            </div>

            <aside className={styles.side}>
              <div className={styles.figures}>
                <Figure value={String(c.since_year)} label="Manufacturing since" />
                <Figure value={`${c.rd_projects}`} label="R&D projects" />
                <Figure value={`${c.patents}`} label="Patents" />
                <Figure value={`${c.software_copyrights}`} label="Software copyrights" />
              </div>

              <div className={styles.dbCard}>
                <h3 className="h4">Our product data</h3>
                <p>
                  The product database behind this site is built from the company product tables, row
                  by row. Nothing on a product page is invented.
                </p>
                <dl className={styles.dbStats}>
                  <div><dt>Products recorded</dt><dd>{stats.productCount}</dd></div>
                  <div><dt>Application rows</dt><dd>{stats.applicationCount.toLocaleString('en-US')}</dd></div>
                  <div><dt>Normalized OE numbers</dt><dd>{stats.distinctOeCount.toLocaleString('en-US')}</dd></div>
                  <div><dt>Searchable products</dt><dd>{stats.publishedCount}</dd></div>
                </dl>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="section sectionAlt">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">How we work</span>
            <h2 className="h2">What buyers can expect from us</h2>
          </div>

          <div className={styles.valueGrid}>
            <Value
              title="Data before adjectives"
              body="We publish what our records actually say. Where a figure is not confirmed, the page says so instead of filling the gap."
            />
            <Value
              title="OE references kept as found"
              body="OE numbers are stored exactly as recorded and matched on a normalized key. We never rank them into main or secondary references."
            />
            <Value
              title="Applications, not just part numbers"
              body="Every OE reference is tied to the application row it came from, so you can judge fitment before you quote your own customer."
            />
            <Value
              title="Quotations on request"
              body="Price, MOQ and lead time depend on the product family and order mix, so they are quoted per enquiry rather than guessed at."
            />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.placeholderBlock}>
            <span className="eyebrow">Placeholder</span>
            <h2 className="h2">Company story details still to be supplied</h2>
            <p>
              The following sections are intentionally left out until Bowen supplies the facts. Writing
              them from assumption would be worse than leaving the page shorter.
            </p>
            <ul>
              <li>Company history and milestones</li>
              <li>Number of employees by function</li>
              <li>Export markets served and years of export experience</li>
              <li>Named customer references (only with written permission)</li>
              <li>Factory and team photography</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`container ${styles.ctaInner}`}>
          <div>
            <h2 className="h2">Talk to us about your thermostat programme</h2>
            <p>Send an OE number or a full sourcing list — whichever is easier.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/rfq" className="btn btnPrimary btnLg">Request a Quote</Link>
            <Link href="/contact" className="btn btnOutline btnLg">Contact</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.figure}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <article className={styles.value}>
      <h3 className="h4">{title}</h3>
      <p>{body}</p>
    </article>
  );
}
