import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getSiteFacts } from '@/lib/db';
import styles from './factory.module.css';

export const metadata: Metadata = {
  title: 'Factory',
  description: 'Bowen thermostat production: machining, assembly, automated assembly and testing.',
};

const STAGES = [
  {
    n: '01',
    title: 'Machining',
    body: 'Thermostat bodies, flanges and housings are machined in house on the production workshop floor.',
    points: ['Dimensional control on critical mating surfaces', 'Tooling maintained on a planned schedule', 'In-process checks between batches'],
  },
  {
    n: '02',
    title: 'Assembly',
    body: 'Wax-element assembly on dedicated stations, with the sealing and seating geometry controlled.',
    points: ['Controlled torque and press parameters', 'Component traceability by batch', 'Dedicated stations for different housing designs'],
  },
  {
    n: '03',
    title: 'Automated Assembly',
    body: 'Automated assembly cells handle repeatable high-volume work in the temperature-controlled workshop.',
    points: ['Consistent cycle-to-cycle output', 'Reduced handling variation', 'Stable environment for close-tolerance work'],
  },
  {
    n: '04',
    title: 'Testing',
    body: 'Opening-temperature and sealing verification before packing, with results linked to the production batch.',
    points: ['Opening temperature verified per type', 'Sealing / leak checks', 'Batch-linked test records'],
  },
];

export default async function FactoryPage() {
  const c = (await getSiteFacts()).company;

  return (
    <>
      <PageHero
        eyebrow="Factory"
        title="Thermostat manufacturing, start to finish"
        lead="Bowen produces thermostats in house across four stages. Everything below describes how the plant is organised — we publish capacity and lead-time figures only once the production department confirms them."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Factory' }]}
        cta={
          <>
            <Link href="/quality" className="btn btnOutline">Quality systems</Link>
            <Link href="/rfq" className="btn btnPrimary">Request a Quote</Link>
          </>
        }
      />

      <section className="section">
        <div className="container">
          <div className={styles.stats}>
            <Stat value={`${c.since_year}`} label="Manufacturing since" />
            <Stat value={`${c.manufacturing_base_m2.toLocaleString('en-US')} m²`} label="Manufacturing base" />
            <Stat value={`${c.production_workshop_m2.toLocaleString('en-US')} m²`} label="Production workshop" />
            <Stat
              value={`${c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m²`}
              label="Temperature-controlled workshop"
            />
            <Stat value={`${c.production_equipment_count}+`} label="Production equipment" />
          </div>
          <p className={styles.statsNote}>
            Figures taken from Bowen company materials. They describe the site, not a specific
            product line.
          </p>
        </div>
      </section>

      <section className="section sectionAlt">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Production flow</span>
            <h2 className="h2">Four stages, one plant</h2>
          </div>

          <ol className={styles.stages}>
            {STAGES.map((s) => (
              <li key={s.n} className={styles.stage}>
                <span className={styles.stageNum}>{s.n}</span>
                <div className={styles.stageBody}>
                  <h3 className="h3">{s.title}</h3>
                  <p>{s.body}</p>
                  <ul className={styles.stagePoints}>
                    {s.points.map((p) => <li key={p}>{p}</li>)}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.twoCol}>
            <div>
              <span className="eyebrow">Capacity &amp; lead time</span>
              <h2 className="h2">What we publish now — and what we do not</h2>
              <p className="lead">
                Annual capacity, standard lead time and MOQ are commercial figures that change with
                product family and order mix. Rather than publish a number that only fits one
                scenario, we quote them per enquiry.
              </p>

              <div className={styles.placeholderNote}>
                <strong>Placeholder — pending confirmation from the production department:</strong>
                <ul>
                  <li>Annual thermostat production capacity</li>
                  <li>Standard lead time by product family</li>
                  <li>Minimum order quantity by product family</li>
                  <li>Packaging and container loading specification</li>
                </ul>
                <p>
                  These are deliberately left out rather than estimated. They will be filled in once
                  the factory supplies the confirmed numbers.
                </p>
              </div>
            </div>

            <div className={styles.sideBox}>
              <h3 className="h4">Visit or audit</h3>
              <p>
                Customer audits and factory visits can be arranged. Tell us the scope of your audit and
                the product families involved and we will coordinate with the quality department.
              </p>
              <Link href="/contact" className="btn btnGhost btnSm">Arrange a visit</Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`container ${styles.ctaInner}`}>
          <div>
            <h2 className="h2">Looking for a thermostat supplier with its own plant?</h2>
            <p>Send your sourcing list and we will come back with Bowen numbers and a quotation.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/rfq" className="btn btnPrimary btnLg">Request a Quote</Link>
            <Link href="/products" className="btn btnOutline btnLg">Browse products</Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.stat}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
