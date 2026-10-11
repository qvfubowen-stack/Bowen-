import Link from 'next/link';
import type { Metadata } from 'next';
import { OeSearchBox } from '@/components/OeSearchBox';
import { ProductCard } from '@/components/ProductCard';
import { MakeExplorer } from '@/components/MakeExplorer';
import {
  getCategorySummaries,
  getDatasetStats,
  getMakeSummaries,
  getPublishedProducts,
  getSiteFacts,
} from '@/lib/db';
import { companyImage, factoryImage } from '@/lib/media';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import styles from './home.module.css';

export const metadata: Metadata = {
  title: 'Automotive Thermostat Manufacturer',
  description:
    'Bowen manufactures automotive thermostats, temperature sensors and vehicle switches in Qufu, '
    + 'Shandong. Search by OE number or Bowen No., review recorded vehicle applications and send a '
    + 'request for quotation.',
  alternates: canonicalFor('/'),
  openGraph: {
    url: absoluteUrl('/'),
    title: 'Bowen — Automotive Thermostat Manufacturer',
    description: 'Search by OE number or Bowen No., review recorded vehicle applications and request a quotation.',
    type: 'website',
  },
};

export default async function HomePage() {
  const facts = await getSiteFacts();
  const stats = await getDatasetStats();
  const categories = await getCategorySummaries();
  const makes = await getMakeSummaries();
  const featured = (await getPublishedProducts()).filter((p) => p.prototype_rank).slice(0, 6);
  const thermostats = categories.find((c) => c.category === 'thermostats');
  const c = facts.company;

  // 真实工厂照片（来源：宣传手册）
  const factoryHero = companyImage('factory-buildings.jpg');
  const floorPhotos = [
    factoryImage('production-workshop.jpg'),
    factoryImage('machining-workshop.jpg'),
    factoryImage('automatic-assembly-machine-24-series.jpg'),
    factoryImage('thermostat-life-test-bench.jpg'),
  ].filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <>
      {/* ============================================================
          SCREEN 1 — HERO
          ============================================================ */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <span className={styles.heroCompany}>
              {c.legal_name_en}
            </span>
            <h1 className={styles.heroTitle}>
              Automotive Thermostat<br />Manufacturer
            </h1>
            <p className={styles.heroLead}>
              Bowen develops, manufactures and supplies automotive components — thermostats,
              temperature sensors and vehicle switches. Established in {c.since_year}, with a factory
              built and expanded in {c.factory_built_year}. We work with manufacturers and
              distributors, not end consumers.
            </p>

            <div className={styles.heroSearch}>
              <OeSearchBox size="large" />
            </div>

            <div className={styles.heroCtas}>
              <Link href="/products?type=Thermostat" className="btn btnOutline btnLg">
                Browse Thermostats
              </Link>
              <Link href="/rfq" className="btn btnPrimary btnLg">
                Request a Quote
              </Link>
            </div>
          </div>

          <div className={styles.heroFacts}>
            <div className={styles.heroFactGrid}>
              <Fact value={`${stats.distinctOeCount.toLocaleString('en-US')}+`} label="Cross-referenced OE numbers" />
              <Fact value={String(stats.publishedCount)} label="Products searchable now" />
              <Fact value={`${makes.length}`} label="Vehicle makes covered" />
              <Fact value={`${c.rd_projects}`} label="R&D projects" />
            </div>
            <p className={styles.heroNote}>
              Search by OE number, Bowen No. or the vehicle/application text recorded in our product
              data. Every result shows the exact matching application, not just a part number.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          SCREEN 2 — MANUFACTURING FACTS
          ============================================================ */}
      <section className={`section sectionAlt ${styles.facts}`}>
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Manufacturing</span>
            <h2 className="h2">A manufacturing base built for thermostat production</h2>
            <p className="lead">
              Numbers below come from Bowen company materials. No estimated or rounded-up figures.
            </p>
          </div>

          <ul className={styles.factGrid}>
            <FactCard value={`${c.manufacturing_base_m2.toLocaleString('en-US')} m²`} label="Company site area" />
            <FactCard value={`${c.production_workshop_m2.toLocaleString('en-US')} m²`} label="Production workshop" />
            <FactCard
              value={`${c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m²+`}
              label="Temperature-controlled workshop"
            />
            <FactCard value={`${c.production_equipment_count}+`} label="Production equipment" />
            <FactCard value={String(c.since_year)} label="Established" />
          </ul>

          {factoryHero && (
            <figure className={styles.factoryFigure}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={factoryHero.src}
                alt={factoryHero.alt}
                className={styles.factoryFigureImg}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                {factoryHero.caption}
                <span className={styles.credit}>Source: Bowen company profile</span>
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      {/* ============================================================
          SCREEN 3 — PRODUCT CATEGORIES (thermostats first)
          ============================================================ */}
      <section className="section">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Product categories</span>
            <h2 className="h2">Thermostats first — everything else supports the cooling system</h2>
            <p className="lead">
              Thermostats are Bowen&apos;s core line. The remaining categories are offered where our
              data fully supports them; we do not publish empty or thin categories.
            </p>
          </div>

          <div className={styles.categoryGrid}>
            {categories.map((cat) => {
              const primary = cat.category === 'thermostats';
              return (
                <article
                  key={cat.category}
                  className={`${styles.categoryCard} ${primary ? styles.categoryPrimary : ''}`}
                >
                  <div className={styles.categoryHead}>
                    <h3 className="h3">{cat.labelEn}</h3>
                    <span className={styles.categoryCount}>{cat.productCount} products</span>
                  </div>
                  <p className={styles.categoryDesc}>{cat.description}</p>

                  {cat.subcategories && (
                    <ul className={styles.subList}>
                      {cat.subcategories.map((s) => (
                        <li key={s.key}>
                          <Link href={`/products?category=${cat.category}&sub=${s.key}`}>
                            {s.labelEn}
                            <span>{s.productCount}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className={styles.categoryActions}>
                    <Link
                      href={primary ? '/products?type=Thermostat' : `/products?category=${cat.category}`}
                      className={primary ? 'btn btnNavy btnSm' : 'btn btnGhost btnSm'}
                    >
                      {primary ? 'Browse thermostats' : 'View category'}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {thermostats && (
            <p className={styles.categoryFootnote}>
              Thermostat line: <strong>{thermostats.productCount}</strong> products, each with OE
              references and vehicle/application records kept at row level.
            </p>
          )}
        </div>
      </section>

      {/* ============================================================
          SCREEN 4 — FIND BY APPLICATION
          ============================================================ */}
      <section className={`section sectionAlt`}>
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Find by application</span>
            <h2 className="h2">Find the right thermostat by vehicle make</h2>
            <p className="lead">
              The vehicle makes below are taken from the applications recorded in our product
              database — the same rows that power OE search. Chinese and English spellings of the
              same brand are counted once.
            </p>
          </div>

          <MakeExplorer makes={makes} />
        </div>
      </section>

      {/* ============================================================
          SCREEN 5 — OE SEARCH EXPLANATION
          ============================================================ */}
      <section className="section">
        <div className="container">
          <div className={styles.explainGrid}>
            <div>
              <span className="eyebrow">OE search</span>
              <h2 className="h2">Three ways to find a Bowen part</h2>
              <p className="lead">
                Send us your sourcing list or look it up yourself. Either way you get the matched
                application — the OE reference together with the vehicle/application text — not an
                isolated part number.
              </p>

              <ul className={styles.wayList}>
                <Way
                  n="1"
                  title="By OE Number"
                  body="Type any OE reference. Case, spaces, dashes and slashes are ignored, so 25500-35540 and 2550035540 find the same part."
                />
                <Way
                  n="2"
                  title="By Bowen No."
                  body="If you already buy from us, enter the Bowen number printed on your packing list or quotation."
                />
                <Way
                  n="3"
                  title="By Vehicle Make or Application Text"
                  body="Filter by vehicle make, or search the vehicle/application field exactly as it is recorded in our product data."
                />
              </ul>
            </div>

            <aside className={styles.explainAside}>
              <div className={styles.explainCard}>
                <h3 className="h4">What an OE result actually tells you</h3>
                <dl className={styles.answerList}>
                  <div><dt>Matched OE</dt><dd className="mono">2550035540</dd></div>
                  <div><dt>Bowen No.</dt><dd className="mono">3503</dd></div>
                  <div><dt>Application (as recorded)</dt><dd>Hyundai NF Sonata 2.7</dd></div>
                  <div><dt>Product type</dt><dd>Thermostat</dd></div>
                </dl>
                <p className={styles.explainNote}>
                  Example layout — every result links straight to the product detail page.
                </p>
              </div>

              <div className={styles.explainStat}>
                <strong>{stats.distinctOeCount.toLocaleString('en-US')}</strong>
                <span>normalized OE numbers in the current database</span>
              </div>
              <div className={styles.explainStat}>
                <strong>{stats.applicationCount.toLocaleString('en-US')}</strong>
                <span>application records, each keeping its own OE ↔ application row</span>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ============================================================
          SCREEN 6 — FACTORY
          ============================================================ */}
      <section className={`section sectionDark`}>
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Factory</span>
            <h2 className="h2">From machining to automated assembly</h2>
            <p className="lead">
              Thermostat production runs through four stages in house — machining, assembly,
              automated assembly and testing.
            </p>
          </div>

          <ol className={styles.processList}>
            <Process
              n="01"
              title="Machining"
              body={`CNC machining equipment in the ${c.production_workshop_m2.toLocaleString('en-US')} m² production workshop, part of a ${c.production_equipment_count}+ piece equipment base.`}
            />
            <Process
              n="02"
              title="Assembly"
              body="Component assembly in a dedicated assembly workshop, alongside dedicated work areas for automotive parts production."
            />
            <Process
              n="03"
              title="Automated Assembly"
              body={`In-house developed assembly systems, including 20, 211 and 24 series automatic assembly machines, in the ${c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m²+ temperature-controlled workshop.`}
            />
            <Process
              n="04"
              title="Testing"
              body="Integrated adjustment and testing machines plus a dedicated thermostat life test bench bring testing into the production environment."
            />
          </ol>

          {floorPhotos.length > 0 && (
            <ul className={styles.floorGrid}>
              {floorPhotos.map((img) => (
                <li key={img.src} className={styles.floorItem}>
                  <figure className={styles.floorFigure}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.alt} className={styles.floorImg} loading="lazy" decoding="async" />
                  </figure>
                  <span className={styles.floorCaption}>{img.caption}</span>
                </li>
              ))}
            </ul>
          )}

          <div className={styles.processCta}>
            <Link href="/factory" className="btn btnOutline">See the factory</Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          SCREEN 7 — QUALITY
          ============================================================ */}
      <section className="section">
        <div className="container">
          <div className={styles.qualityGrid}>
            <div>
              <span className="eyebrow">Quality</span>
              <h2 className="h2">Certified management system, defined scope</h2>
              <p className="lead">
                Bowen manufactures thermostats under a certified automotive quality management system.
                The certificate states a scope, and we publish that scope in full rather than
                extending it to products it does not cover.
              </p>

              <ul className={styles.certList}>
                {c.public_certification_standards.map((cert) => (
                  <li key={cert}>
                    <span className={styles.certMark} aria-hidden="true">✓</span>
                    <div>
                      <strong>{cert}</strong>
                      <small>Management system certification</small>
                    </div>
                  </li>
                ))}
              </ul>

              <p className={styles.qualityNote}>
                Certificate number, scope and dates are published in full on the{' '}
                <Link href="/quality">quality page</Link>, together with the certificate original and
                the clause 8.3 product design exclusion.
              </p>
            </div>

            <div className={styles.qualityCards}>
              <QualityCard
                title="Certificate scope"
                body="The IATF 16949:2016 certificate covers the manufacture of thermostats. Clause 8.3 product design is excluded from that scope, and we state the exclusion wherever the certificate is described."
              />
              <QualityCard
                title="Adjustment and testing equipment"
                body="The factory equipment includes integrated adjustment and testing machines for the sensing elements, shown on the quality page with the equipment photographs."
              />
              <QualityCard
                title="Thermostat life test bench"
                body="A dedicated thermostat life test bench is part of the in-house testing equipment recorded in the company materials."
              />
              <QualityCard
                title="Document pack on request"
                body="Certificate copies, inspection report formats and packaging specifications are prepared on request for importers and distributors."
              />
            </div>
          </div>
          <div className={styles.qualityCta}>
            <Link href="/quality" className="btn btnGhost">Quality in detail</Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          SCREEN 8 — R&D
          ============================================================ */}
      <section className={`section sectionAlt`}>
        <div className="container">
          <div className="sectionHead sectionHeadCenter">
            <span className="eyebrow">Research &amp; development</span>
            <h2 className="h2">Engineering depth behind the product range</h2>
          </div>

          <ul className={styles.rdGrid}>
            <FactCard value={String(c.rd_projects)} label="R&D projects" big />
            <FactCard value={String(c.patents)} label="Patents" big />
            <FactCard value={String(c.software_copyrights)} label="Software copyrights" big />
          </ul>

          <p className={styles.rdNote}>
            Figures as reported in Bowen company materials. Certificate and patent lists are
            available on request.
          </p>
        </div>
      </section>

      {/* ============================================================
          SCREEN 9 — FEATURED (real prototype products)
          ============================================================ */}
      <section className="section">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Product database</span>
            <h2 className="h2">Real products from the current Bowen database</h2>
            <p className="lead">
              These are live records from our product data — each OE reference and
              vehicle/application text is published exactly as it is recorded.
            </p>
          </div>

          <div className="grid grid3">
            {featured.map((p) => <ProductCard key={p.product_id} product={p} />)}
          </div>

          <div className={styles.featuredCta}>
            <Link href="/products" className="btn btnGhost">Browse all products</Link>
          </div>
        </div>
      </section>

      {/* ============================================================
          SCREEN 9b — RFQ CTA
          ============================================================ */}
      <section className={styles.rfqCta}>
        <div className={`container ${styles.rfqCtaInner}`}>
          <div>
            <h2 className="h2">Send Your OE Number or Sourcing List</h2>
            <p className={styles.rfqCtaLead}>
              Paste a single OE number or your full sourcing list. We reply with Bowen numbers,
              applications and availability.
            </p>
          </div>
          <div className={styles.rfqCtaActions}>
            <Link href="/rfq" className="btn btnPrimary btnLg">Request a Quote</Link>
            <Link href="/contact" className="btn btnOutline btnLg">Contact us</Link>
          </div>
        </div>
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ 子组件 */

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.fact}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function FactCard({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <li className={`${styles.factCard} ${big ? styles.factCardBig : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </li>
  );
}

function Way({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className={styles.way}>
      <span className={styles.wayNum}>{n}</span>
      <div>
        <h3 className="h4">{title}</h3>
        <p>{body}</p>
      </div>
    </li>
  );
}

function Process({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className={styles.process}>
      <span className={styles.processNum}>{n}</span>
      <h3 className="h3">{title}</h3>
      <p>{body}</p>
    </li>
  );
}

function QualityCard({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.qualityCard}>
      <h3 className="h4">{title}</h3>
      <p>{body}</p>
    </div>
  );
}
