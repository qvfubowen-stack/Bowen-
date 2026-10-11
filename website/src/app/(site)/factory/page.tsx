import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getSiteFacts } from '@/lib/db';
import { factoryImage, type SiteImage } from '@/lib/media';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import styles from './factory.module.css';

export const metadata: Metadata = {
  title: 'Factory',
  description:
    'Inside the Bowen factory: production workshop, machining workshop, component assembly, automated assembly equipment and testing.',
  alternates: canonicalFor('/factory'),
  openGraph: { url: absoluteUrl('/factory'), title: 'Factory | Bowen', type: 'website' },
};

/** 工厂环境（宣传手册 P5） */
const WORKSHOPS: { file: string; title: string; body: string }[] = [
  {
    file: 'production-workshop.jpg',
    title: 'Production workshop',
    body: 'Production workshop with defined aisles and workstations.',
  },
  {
    file: 'machining-workshop.jpg',
    title: 'Machining workshop',
    body: 'Machining area within the production site.',
  },
  {
    file: 'component-assembly-workshop.jpg',
    title: 'Component assembly workshop',
    body: 'Component assembly work area for automotive parts production.',
  },
];

/** 生产设备（宣传手册 P6–P7） */
const EQUIPMENT: { file: string; title: string; body: string }[] = [
  {
    file: 'cnc-machining-equipment.jpg',
    title: 'CNC machining equipment',
    body: 'CNC machining equipment supporting the machining side of production.',
  },
  {
    file: 'automatic-assembly-machine-20-series.jpg',
    title: '20 series automatic assembly machine',
    body: 'Dedicated equipment supports assembly operations for different component series.',
  },
  {
    file: 'automatic-assembly-machine-211-series.jpg',
    title: '211 series automatic assembly machine',
    body: 'Assembly systems designed and developed in house.',
  },
  {
    file: 'automatic-assembly-machine-24-series.jpg',
    title: '24 series automatic assembly machine',
    body: 'Automated assembly is an important part of the manufacturing capability.',
  },
  {
    file: 'rubber-plug-assembly-machine.jpg',
    title: 'Rubber plug automatic assembly machine',
    body: 'The factory uses rubber plug assembly equipment.',
  },
  {
    file: 'automatic-riveting-machine.jpg',
    title: 'Automatic riveting machine',
    body: 'The factory also uses automatic riveting equipment.',
  },
];

/** Production flow —— 四道工序，标题由守卫测试固定，不得改成产品类别 */
const STAGES = [
  {
    n: '01',
    title: 'Machining',
    body: 'Machining work takes place on the production workshop floor, on dedicated CNC machining equipment.',
    points: ['CNC machining equipment in the machining workshop', 'Machining and assembly equipment base of 100+ pieces'],
  },
  {
    n: '02',
    title: 'Assembly',
    body: 'Component assembly is carried out in a dedicated assembly workshop, alongside dedicated work areas for automotive parts production.',
    points: ['Component assembly workshop', 'Dedicated work areas for automotive parts'],
  },
  {
    n: '03',
    title: 'Automated Assembly',
    body: 'Automated assembly is an important part of the manufacturing capability, using assembly systems developed in house.',
    points: ['20 series automatic assembly machine', '211 series automatic assembly machine', '24 series automatic assembly machine'],
  },
  {
    n: '04',
    title: 'Testing',
    body: 'Integrated adjustment and testing machines bring adjustment and testing into the production environment, together with a dedicated thermostat life test bench.',
    points: ['211 series sensing element adjustment and testing machine', '20 and 24 series sensing element adjustment and testing machine', 'Thermostat life test bench'],
  },
];

function lookup(file: string): SiteImage | null {
  return factoryImage(file);
}

export default async function FactoryPage() {
  const c = (await getSiteFacts()).company;

  return (
    <>
      <PageHero
        eyebrow="Factory"
        title="Inside the Bowen factory"
        lead="Bowen's facilities bring together machining, component assembly and dedicated work areas for automotive parts production. Every photograph on this page is taken from the Bowen company profile."
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
            <Stat value={`${c.since_year}`} label="Established" />
            <Stat value={`${c.factory_built_year}`} label="Factory built" />
            <Stat value={`${c.manufacturing_base_m2.toLocaleString('en-US')} m²`} label="Company site area" />
            <Stat value={`${c.production_workshop_m2.toLocaleString('en-US')} m²`} label="Production workshop" />
            <Stat
              value={`${c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m²+`}
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

      {/* ---------------- 工厂环境 ---------------- */}
      <section className="section sectionAlt">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Factory environment</span>
            <h2 className="h2">Inside the factory</h2>
            <p className="lead">
              The production site combines workshop space with supporting storage areas, including more
              than {c.temperature_controlled_workshop_m2.toLocaleString('en-US')} m² of
              temperature-controlled workshop space.
            </p>
          </div>

          <ul className={styles.photoGrid}>
            {WORKSHOPS.map((w) => {
              const img = lookup(w.file);
              if (!img) return null;
              return (
                <li key={w.file} className={styles.photoCard}>
                  <figure className={styles.photoFigure}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.alt} className={styles.photoImg} loading="lazy" decoding="async" />
                  </figure>
                  <div className={styles.photoBody}>
                    <h3 className="h4">{w.title}</h3>
                    <p>{w.body}</p>
                    <span className={styles.credit}>Source: Bowen company profile</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------------- 生产工序 ---------------- */}
      <section className="section">
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

      {/* ---------------- 设备 ---------------- */}
      <section className="section sectionAlt">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Production equipment</span>
            <h2 className="h2">Equipment for key operations</h2>
            <p className="lead">
              The equipment base supports both machining and assembly, with dedicated machines for
              specific production operations.
            </p>
          </div>

          <ul className={styles.equipGrid}>
            {EQUIPMENT.map((e) => {
              const img = lookup(e.file);
              if (!img) return null;
              return (
                <li key={e.file} className={styles.equipCard}>
                  <figure className={styles.equipFigure}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.alt} className={styles.equipImg} loading="lazy" decoding="async" />
                  </figure>
                  <div className={styles.equipBody}>
                    <h3 className="h4">{e.title}</h3>
                    <p>{e.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className={styles.equipNote}>
            More than {c.production_equipment_count} pieces of production equipment support our
            operations, alongside in-house equipment development — see{' '}
            <Link href="/quality">inspection and testing</Link> for the adjustment and testing
            machines.
          </p>
        </div>
      </section>

      {/* ---------------- 参观 / 审核 ---------------- */}
      <section className="section">
        <div className={`container ${styles.visitRow}`}>
          <div className={styles.visitBox}>
            <h3 className="h4">Visit or audit</h3>
            <p>
              Customer audits and factory visits can be arranged. Tell us the scope of your audit and
              the product families involved and we will coordinate with the quality department.
            </p>
            <Link href="/contact" className="btn btnGhost btnSm">Arrange a visit</Link>
          </div>

          <div className={styles.visitBox}>
            <h3 className="h4">Equipment on this page</h3>
            <p>
              Every machine shown here is one Bowen records in its own company profile, with the
              manufacturer&apos;s caption kept as published. Nothing on this page is a stock image or a
              representative machine.
            </p>
            <Link href="/quality" className="btn btnGhost btnSm">Inspection &amp; testing</Link>
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
