import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getSiteFacts } from '@/lib/db';
import styles from './quality.module.css';

export const metadata: Metadata = {
  title: 'Quality',
  description: 'Bowen quality management: IATF 16949, ISO 14001 and ISO 45001, with inspection and testing in house.',
};

const SYSTEMS = [
  {
    name: 'IATF 16949',
    full: 'Quality management system for automotive production',
    body: 'Covers the automotive production and relevant service parts organisation. Scope is stated on the certificate; it is not extended to products outside that scope.',
  },
  {
    name: 'ISO 14001',
    full: 'Environmental management system',
    body: 'Covers environmental aspects of the manufacturing site and its processes.',
  },
  {
    name: 'ISO 45001',
    full: 'Occupational health and safety management system',
    body: 'Covers occupational health and safety management across the manufacturing operation.',
  },
];

const CONTROLS = [
  { title: 'Incoming inspection', body: 'Purchased components that affect function are checked against drawing before entering the line.' },
  { title: 'In-process inspection', body: 'Dimensional and visual checks between production batches, recorded against the batch.' },
  { title: 'Opening-temperature test', body: 'Thermostats are verified at their rated opening temperature before release.' },
  { title: 'Sealing / leak test', body: 'Sealing function checked so the part performs in a pressurised cooling system.' },
  { title: 'Final inspection', body: 'Appearance, marking and packing checked before goods are released to the warehouse.' },
  { title: 'Traceability', body: 'Test results are linked to the production batch, so supplied parts can be traced back.' },
];

export default function QualityPage() {
  const c = getSiteFacts().company;

  return (
    <>
      <PageHero
        eyebrow="Quality"
        title="Certified systems, honest scope"
        lead="Bowen operates three management systems. A certificate states a scope — we publish that scope and do not apply it to products it does not cover."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Quality' }]}
        cta={
          <>
            <Link href="/factory" className="btn btnOutline">See the factory</Link>
            <Link href="/rfq" className="btn btnPrimary">Request a Quote</Link>
          </>
        }
      />

      <section className="section">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Management systems</span>
            <h2 className="h2">Three certificates</h2>
          </div>

          <div className={styles.systemGrid}>
            {SYSTEMS.map((s) => (
              <article key={s.name} className={styles.systemCard}>
                <div className={styles.systemHead}>
                  <span className={styles.systemMark} aria-hidden="true">✓</span>
                  <div>
                    <h3 className="h3">{s.name}</h3>
                    <p className={styles.systemFull}>{s.full}</p>
                  </div>
                </div>
                <p className={styles.systemBody}>{s.body}</p>
              </article>
            ))}
          </div>

          <div className={`notice noticeWarn ${styles.scopeNote}`}>
            <strong>Certificate scope and registration numbers are not published yet.</strong> We are
            collecting the certificate copies and their exact scope statements from Bowen&apos;s
            quality department. Until then we deliberately state only the standard names
            ({c.certifications.join(', ')}) and not a scope we cannot evidence.
          </div>
        </div>
      </section>

      <section className="section sectionAlt">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Inspection &amp; testing</span>
            <h2 className="h2">What is checked, and where</h2>
            <p className="lead">
              Inspection happens at six points between goods-in and packing. Which checks apply
              depends on the product family.
            </p>
          </div>

          <ul className={styles.controlGrid}>
            {CONTROLS.map((c2, i) => (
              <li key={c2.title} className={styles.control}>
                <span className={styles.controlNum}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className="h4">{c2.title}</h3>
                <p>{c2.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className={styles.twoCol}>
            <div>
              <span className="eyebrow">Test equipment</span>
              <h2 className="h2">Metrology and test benches</h2>
              <p className="lead">
                Dimensional checks use calibrated instruments; opening-temperature verification uses
                dedicated test benches. Calibration status is maintained on a planned cycle.
              </p>
              <div className={styles.placeholderNote}>
                <strong>Placeholder — pending confirmation from the quality department:</strong>
                <ul>
                  <li>Equipment list with model and measurement range</li>
                  <li>Calibration cycle and traceability standard</li>
                  <li>Test bench photographs</li>
                  <li>Typical inspection report format sent with shipments</li>
                </ul>
                <p>These will be published with real equipment data rather than generic descriptions.</p>
              </div>
            </div>

            <div className={styles.sideBox}>
              <h3 className="h4">Supplier quality documents</h3>
              <p>
                Importers and distributors usually need a document pack before onboarding a supplier.
                Tell us which documents you require and we will prepare them.
              </p>
              <ul className={styles.docList}>
                <li>Certificate copies</li>
                <li>Inspection report format</li>
                <li>Material declarations where applicable</li>
                <li>Packaging specification</li>
              </ul>
              <Link href="/contact" className="btn btnGhost btnSm">Request the document pack</Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`container ${styles.ctaInner}`}>
          <div>
            <h2 className="h2">Supplier audit or sample order first?</h2>
            <p>Both are normal. Send your requirements and we will scope it with the quality team.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/contact" className="btn btnOutline btnLg">Contact us</Link>
            <Link href="/rfq" className="btn btnPrimary btnLg">Request a Quote</Link>
          </div>
        </div>
      </section>
    </>
  );
}
