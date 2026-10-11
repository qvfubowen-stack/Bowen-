import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getDatasetStats, getSiteFacts } from '@/lib/db';
import { companyImage } from '@/lib/media';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About Bowen',
  description:
    'Qufu Bowen Auto Parts Manufacturing Co., Ltd. develops, manufactures and supplies automotive components: thermostats, temperature sensors and vehicle switches.',
  alternates: canonicalFor('/about'),
  openGraph: { url: absoluteUrl('/about'), title: 'About Bowen | Bowen', type: 'website' },
};

export default async function AboutPage() {
  const facts = await getSiteFacts();
  const c = facts.company;
  const stats = await getDatasetStats();

  const factoryBuildings = companyImage('factory-buildings.jpg');
  const assemblyWorkshop = companyImage('assembly-workshop.jpg');

  return (
    <>
      <PageHero
        eyebrow="About"
        title="A thermostat factory, not a trading catalogue"
        lead={`${c.legal_name_en} develops, manufactures and supplies automotive components, combining product research with in-house production and technical service.`}
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
              <h2 className="h2">Manufacturing automotive components since {c.since_year}</h2>
              <p className={styles.legalName}>
                {c.legal_name_en} <span>· {c.legal_name_zh}</span>
              </p>

              <div className={styles.prose}>
                <p>
                  {c.legal_name_en} was established in {c.since_year} and expanded its operations
                  with the construction of a factory in {c.factory_built_year}. The site covers a{' '}
                  {c.manufacturing_base_m2.toLocaleString('en-US')} m² company site area, including a{' '}
                  {c.production_workshop_m2.toLocaleString('en-US')} m² production workshop and more
                  than {c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m² of
                  temperature-controlled workshop space.
                </p>
                <p>
                  Our technology centre and dedicated R&amp;D team support a product range serving a
                  wide variety of vehicle models. Production equipment includes automated assembly
                  systems designed and developed in house, across{' '}
                  {c.production_equipment_count}+ pieces of production equipment.
                </p>
                <p>
                  Development work is ongoing rather than one-off: {c.rd_projects} independently
                  developed projects, {c.patents} patents and {c.software_copyrights} software
                  copyrights are recorded in Bowen company materials. Development covers automotive
                  components as well as automated production equipment.
                </p>
              </div>

              {factoryBuildings && (
                <figure className={styles.media}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={factoryBuildings.src}
                    alt={factoryBuildings.alt}
                    className={styles.mediaImg}
                    loading="lazy"
                    decoding="async"
                  />
                  <figcaption>
                    {factoryBuildings.caption}
                    <span className={styles.credit}>
                      Source: Bowen company profile
                    </span>
                  </figcaption>
                </figure>
              )}

              <div className={styles.audienceNote}>
                <strong>Who we work with</strong>
                <ul>
                  <li>Manufacturers</li>
                  <li>Distributors</li>
                </ul>
                <p>
                  Bowen works with manufacturers and distributors, supported by professional sales and
                  technical service teams. Product selection is application-specific: tell our team the
                  vehicle model, part reference and technical requirements.
                </p>
              </div>
            </div>

            <aside className={styles.side}>
              <div className={styles.figures}>
                <Figure value={String(c.since_year)} label="Established" />
                <Figure value={String(c.factory_built_year)} label="Factory built" />
                <Figure value={`${c.rd_projects}`} label="R&D projects" />
                <Figure value={`${c.patents}`} label="Patents" />
              </div>

              <div className={styles.dbCard}>
                <h3 className="h4">Our product data</h3>
                <p>
                  The product database behind this site is built from the company product tables, row
                  by row. Only products with a verified product photograph are published here; the
                  rest stay in the internal database until a photograph is confirmed.
                </p>
                <dl className={styles.dbStats}>
                  <div><dt>Products published</dt><dd>{stats.productCount}</dd></div>
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
            <span className="eyebrow">Product range</span>
            <h2 className="h2">What Bowen makes</h2>
            <p className="lead">
              The product portfolio covers thermostats, temperature sensors and vehicle switches for a
              wide range of vehicle models.
            </p>
          </div>

          <ul className={styles.rangeGrid}>
            {c.product_range.map((item) => (
              <li key={item} className={styles.rangeItem}>
                <span className={styles.rangeMark} aria-hidden="true">&#10003;</span>
                {item}
              </li>
            ))}
          </ul>

          <p className={styles.rangeNote}>
            Product selection is application-specific. Discuss the vehicle model, part reference and
            technical requirements with our team.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.twoCol}>
            <div>
              <span className="eyebrow">Manufacturing</span>
              <h2 className="h2">Research and production under one roof</h2>
              <div className={styles.prose}>
                <p>
                  The production site brings together machining, component assembly and dedicated work
                  areas for automotive parts production, alongside supporting storage areas. Automated
                  assembly is an important part of the manufacturing capability, and the equipment
                  includes assembly systems developed in house.
                </p>
                <p>
                  Machining, assembly, adjustment and testing equipment support automotive component
                  production. Dedicated stations bring adjustment and testing into the production
                  environment, and the factory also uses automatic riveting and rubber plug assembly
                  equipment.
                </p>
                <p>
                  Management system certification covers thermostat manufacturing. The IATF
                  16949:2016 certificate has a stated scope ({c.public_certification_standards.join(', ')}
                  ), which we publish in full rather than stretch.
                </p>
              </div>

              <div className={styles.linkRow}>
                <Link href="/factory" className="btn btnNavy btnSm">See the factory</Link>
                <Link href="/quality" className="btn btnGhost btnSm">Quality &amp; certificates</Link>
              </div>
            </div>

            {assemblyWorkshop && (
              <figure className={styles.media}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assemblyWorkshop.src}
                  alt={assemblyWorkshop.alt}
                  className={styles.mediaImg}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  {assemblyWorkshop.caption}
                  <span className={styles.credit}>
                    Source: Bowen company profile
                  </span>
                </figcaption>
              </figure>
            )}
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
              body="We publish what our records actually say. Where a figure is not confirmed, the page omits it instead of filling the gap."
            />
            <Value
              title="OE references kept as found"
              body="OE numbers are stored exactly as recorded and matched on a normalized key. We never rank them into main or secondary references."
            />
            <Value
              title="Fixed scope, stated plainly"
              body="The IATF 16949 certificate excludes clause 8.3 product design. We print that exclusion rather than describe the certificate as covering design."
            />
            <Value
              title="Quotations on request"
              body="Price and availability depend on the product family and order mix, so they are quoted per enquiry rather than guessed at."
            />
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`container ${styles.ctaInner}`}>
          <div>
            <h2 className="h2">Talk to us about your thermostat programme</h2>
            <p>Send an OE number or a full sourcing list, whichever is easier.</p>
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
