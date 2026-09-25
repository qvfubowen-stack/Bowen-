import Link from 'next/link';
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
import styles from './home.module.css';

export default async function HomePage() {
  const facts = await getSiteFacts();
  const stats = await getDatasetStats();
  const categories = await getCategorySummaries();
  const makes = await getMakeSummaries();
  const featured = (await getPublishedProducts()).filter((p) => p.prototype_rank).slice(0, 6);
  const thermostats = categories.find((c) => c.category === 'thermostats');
  const c = facts.company;

  return (
    <>
      {/* ============================================================
          SCREEN 1 — HERO
          ============================================================ */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <span className={styles.heroEyebrow}>
              Since {c.since_year} · IATF 16949 · ISO 14001 · ISO 45001
            </span>
            <h1 className={styles.heroTitle}>
              Automotive Thermostat<br />Manufacturer
            </h1>
            <p className={styles.heroLead}>
              Bowen engineers and manufactures thermostats for passenger cars and light commercial
              vehicles. We supply importers, wholesalers and aftermarket distributors — not end
              consumers.
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
              Search by OE number, Bowen No., vehicle or engine application. Every result shows the
              exact matching application, not just a part number.
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
            <FactCard value={`${c.manufacturing_base_m2.toLocaleString('en-US')} m²`} label="Manufacturing base" />
            <FactCard value={`${c.production_workshop_m2.toLocaleString('en-US')} m²`} label="Production workshop" />
            <FactCard
              value={`${c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m²`}
              label="Temperature-controlled workshop"
            />
            <FactCard value={`${c.production_equipment_count}+`} label="Production equipment" />
            <FactCard value={String(c.since_year)} label="Manufacturing since" />
          </ul>
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
              references and vehicle/engine applications recorded at row level.
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
            <h2 className="h2">Find the right thermostat by vehicle make or engine</h2>
            <p className="lead">
              Vehicle makes and engines below are taken from the applications recorded in our
              product database — the same rows that power OE search.
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
              <h2 className="h2">Four ways to find a Bowen part</h2>
              <p className="lead">
                Send us your sourcing list or look it up yourself. Either way you get the matched
                application — OE, vehicle and engine together — not an isolated part number.
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
                  title="By Vehicle"
                  body="Filter products by vehicle make and model to see everything we make for that platform."
                />
                <Way
                  n="4"
                  title="By Engine"
                  body="Engine codes such as EA111, 4G6 or 476ZQA are recorded per application row and are searchable."
                />
              </ul>
            </div>

            <aside className={styles.explainAside}>
              <div className={styles.explainCard}>
                <h3 className="h4">What an OE result actually tells you</h3>
                <dl className={styles.answerList}>
                  <div><dt>Matched OE</dt><dd className="mono">2550035540</dd></div>
                  <div><dt>Bowen No.</dt><dd className="mono">3503</dd></div>
                  <div><dt>Vehicle</dt><dd>Hyundai NF Sonata 2.7</dd></div>
                  <div><dt>Engine</dt><dd>G6EA</dd></div>
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
                <span>application records, each keeping its own OE ↔ engine row</span>
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
              body={`${c.production_equipment_count}+ production equipment across the ${c.production_workshop_m2.toLocaleString('en-US')} m² production workshop.`}
            />
            <Process
              n="02"
              title="Assembly"
              body="Assembly uses controlled tooling and torque parameters on dedicated stations."
            />
            <Process
              n="03"
              title="Automated Assembly"
              body={`Automated assembly cells in the ${c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m² temperature-controlled workshop.`}
            />
            <Process
              n="04"
              title="Testing"
              body="Opening-temperature and sealing verification before packing, with results traceable to the production batch."
            />
          </ol>

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
              <h2 className="h2">Certified management systems, defined scope</h2>
              <p className="lead">
                Bowen operates under three management systems. Each certificate has a stated scope;
                we do not extend a certificate to products it does not cover.
              </p>

              <ul className={styles.certList}>
                {c.certifications.map((cert) => (
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
                Certificate scope and registration numbers are being collected from Bowen&apos;s
                quality department and will be published with the certificate copies.
              </p>
            </div>

            <div className={styles.qualityCards}>
              <QualityCard
                title="Incoming inspection"
                body="Critical purchased components are checked against drawing before they enter the production line."
              />
              <QualityCard
                title="Opening-temperature testing"
                body="Every thermostat type is verified at its rated opening temperature before release."
              />
              <QualityCard
                title="Traceability"
                body="Production batch and test result are linked, so a supplied part can be traced back."
              />
              <QualityCard
                title="In-house metrology"
                body="Dimensional checks with calibrated instruments in the temperature-controlled workshop."
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
              These are live records from our product data — every OE reference and vehicle
              application is traceable to a source row.
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
              Paste a single OE number or upload your full sourcing list. We reply with Bowen
              numbers, applications and availability — normally within one working day.
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
