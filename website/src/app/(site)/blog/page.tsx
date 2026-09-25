import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import styles from './blog.module.css';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Technical notes and sourcing guidance for thermostat buyers. Content planned for a later phase.',
};

/**
 * Blog —— 本阶段只建立页面框架（按需求第十六条）。
 * 刻意不放任何「示例文章」：没有写好的内容就先留空框架，
 * 不用占位文章把站点撑起来。
 */
const PLANNED = [
  {
    topic: 'How to read a thermostat OE number',
    audience: 'Importers and counter staff',
    status: 'Planned',
  },
  {
    topic: 'How the source data describes thermostat variants (insert, housing, assembly)',
    audience: 'Buyers comparing offers',
    status: 'Planned',
  },
  {
    topic: 'Opening temperature: why the same housing comes in several ratings',
    audience: 'Technical buyers',
    status: 'Planned',
  },
  {
    topic: 'Building a sourcing list that gets a fast, accurate quotation',
    audience: 'New importers',
    status: 'Planned',
  },
  {
    topic: 'Why one OE number can map to more than one aftermarket part number',
    audience: 'Distributors',
    status: 'Planned',
  },
  {
    topic: 'Cooling system failure patterns and what they mean for warranty claims',
    audience: 'Aftermarket distributors',
    status: 'Planned',
  },
];

export default function BlogPage() {
  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Technical notes for thermostat buyers"
        lead="This section is a framework for now. We are not publishing articles until they are written by someone who can stand behind the technical content."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Blog' }]}
      />

      <section className="section">
        <div className="container">
          <div className={`notice noticeInfo ${styles.note}`}>
            <strong>Framework only — no articles published yet.</strong> Per the current project
            phase, we are not generating bulk SEO articles or AI-written blog content. The topics
            below are the ones buyers actually ask about; they will be written one at a time, with
            technical review, in a later phase.
          </div>

          <h2 className="h2" style={{ marginTop: 36, marginBottom: 20 }}>Planned topics</h2>

          <ul className={styles.list}>
            {PLANNED.map((p, i) => (
              <li key={p.topic} className={styles.item}>
                <span className={styles.index}>{String(i + 1).padStart(2, '0')}</span>
                <div className={styles.itemBody}>
                  <h3 className="h4">{p.topic}</h3>
                  <p className={styles.meta}>
                    <span className={styles.audience}>For: {p.audience}</span>
                    <span className="badge badgeMuted">{p.status}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className={styles.placeholder}>
            <h2 className="h3">What is still needed before this section goes live</h2>
            <ul>
              <li>A named author or reviewer for technical content</li>
              <li>Editorial standard: what Bowen will and will not claim</li>
              <li>Photography of real parts to illustrate the articles</li>
              <li>Decision on whether the blog is English-only or multilingual</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`container ${styles.ctaInner}`}>
          <div>
            <h2 className="h2">Have a technical question now?</h2>
            <p>Ask us directly — we answer fitment and specification questions by email.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/contact" className="btn btnOutline btnLg">Contact us</Link>
            <Link href="/oe-search" className="btn btnPrimary btnLg">Search by OE</Link>
          </div>
        </div>
      </section>
    </>
  );
}
