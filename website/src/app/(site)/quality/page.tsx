import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getSiteFacts } from '@/lib/db';
import { certificateImage, factoryImage } from '@/lib/media';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import styles from './quality.module.css';

export const metadata: Metadata = {
  title: 'Quality',
  description:
    'Bowen automotive quality management system: IATF 16949:2016 (NQA, certificate 0513244) covering the manufacture of thermostats, with the certificate scope and the clause 8.3 exclusion stated in full.',
  alternates: canonicalFor('/quality'),
  openGraph: { url: absoluteUrl('/quality'), title: 'Quality | Bowen', type: 'website' },
};

/** 检验与测试设备（宣传手册 P8）—— 只写图片与手册能直接证明的内容 */
const TEST_EQUIPMENT = [
  {
    file: 'sensing-element-test-machine-211-series.jpg',
    title: '211 series sensing element adjustment and testing machine',
  },
  {
    file: 'sensing-element-test-machine-20-24-series.jpg',
    title: '20 and 24 series sensing element adjustment and testing machine',
  },
  {
    file: 'thermostat-life-test-bench.jpg',
    title: 'Thermostat life test bench',
  },
];

export default async function QualityPage() {
  const facts = await getSiteFacts();
  const c = facts.company;
  // Phase 4.1 业务规则：只有存在证书图片的认证才公开展示。
  // 因此这里用 is_public 过滤，而不是把 certifications_detail 全部铺出来。
  const publicCertifications = (facts.certifications_detail ?? []).filter((x) => x.is_public);
  const honors = (facts.honors ?? []).filter((h) => h.is_public);
  const iatf = publicCertifications.find((x) => x.standard.startsWith('IATF'));
  const iatfImage = iatf?.image ? certificateImage(iatf.image.split('/').pop()!) : null;

  return (
    <>
      <PageHero
        eyebrow="Quality"
        title="Certified system, stated scope"
        lead="A certificate states a scope. We publish that scope in full and do not apply it to products it does not cover."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Quality' }]}
        cta={
          <>
            <Link href="/factory" className="btn btnOutline">See the factory</Link>
            <Link href="/rfq" className="btn btnPrimary">Request a Quote</Link>
          </>
        }
      />

      {/* ---------------- 管理体系（只展示有证书图片的认证） ---------------- */}
      <section className="section">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Management system</span>
            <h2 className="h2">Certificate and scope</h2>
            <p className="lead">
              Registration numbers, scope and dates below are taken from the certificate itself.
            </p>
          </div>

          <div className={styles.systemGrid}>
            {publicCertifications.map((s) => (
              <article key={s.standard} className={styles.systemCard}>
                <div className={styles.systemHead}>
                  <span className={styles.systemMark} aria-hidden="true">✓</span>
                  <div>
                    <h3 className="h3">{s.standard}</h3>
                    <p className={styles.systemFull}>{s.system}</p>
                  </div>
                </div>

                <dl className={styles.certMeta}>
                  <div>
                    <dt>Scope</dt>
                    <dd>{s.scope}</dd>
                  </div>
                  {s.scope_exclusion && (
                    <div>
                      <dt>Excluded</dt>
                      <dd className={styles.exclusion}>{s.scope_exclusion}</dd>
                    </div>
                  )}
                  {s.certification_body && (
                    <div>
                      <dt>Certification body</dt>
                      <dd>{s.certification_body}</dd>
                    </div>
                  )}
                  {s.iatf_certificate_no && (
                    <div>
                      <dt>IATF certificate no.</dt>
                      <dd className="mono">{s.iatf_certificate_no}</dd>
                    </div>
                  )}
                  {s.nqa_certificate_no && (
                    <div>
                      <dt>NQA certificate no.</dt>
                      <dd className="mono">{s.nqa_certificate_no}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Issue date</dt>
                    <dd>{s.issue_date}</dd>
                  </div>
                  <div>
                    <dt>Expiry date</dt>
                    <dd>{s.expiry_date}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 证书原件 ---------------- */}
      {iatf && iatfImage && (
        <section className="section sectionAlt">
          <div className="container">
            <div className={styles.certRow}>
              <figure className={styles.certFigure}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={iatfImage.src}
                  alt={iatfImage.alt}
                  className={styles.certImg}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  {iatfImage.caption}
                  <span className={styles.credit}>
                    Source: Bowen company profile
                  </span>
                </figcaption>
              </figure>

              <div className={styles.certCopy}>
                <span className="eyebrow">Certificate original</span>
                <h2 className="h2">What the certificate actually says</h2>
                <p className="lead">
                  The certificate is reproduced on this page so the scope and the exclusion can be read
                  directly rather than taken on trust.
                </p>
                <ul className={styles.certPoints}>
                  <li>Applicable to: <strong>the manufacture of thermostats</strong>.</li>
                  <li>
                    Registered against the provisions of <strong>{iatf.standard}</strong>, with{' '}
                    <strong>clause 8.3 product design justifiably excluded</strong>.
                  </li>
                  <li>Assessed and registered by NQA, United Kingdom.</li>
                  <li>Registration is monitored by NQA and subject to ongoing surveillance.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------------- 测试设备 ---------------- */}
      <section className="section">
        <div className="container">
          <div className="sectionHead">
            <span className="eyebrow">Test equipment</span>
            <h2 className="h2">Adjustment and testing equipment</h2>
            <p className="lead">
              The factory equipment includes integrated adjustment and testing machines, together with
              a dedicated thermostat life test bench. Dedicated stations bring adjustment and testing
              into the production environment. The photographs below are the equipment recorded in the
              Bowen company profile.
            </p>
          </div>

          <ul className={styles.testGrid}>
            {TEST_EQUIPMENT.map((t) => {
              const img = factoryImage(t.file);
              if (!img) return null;
              return (
                <li key={t.file} className={styles.testCard}>
                  <figure className={styles.testFigure}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.src} alt={img.alt} className={styles.testImg} loading="lazy" decoding="async" />
                  </figure>
                  <div className={styles.testBody}>
                    <h3 className="h4">{t.title}</h3>
                    <span className={styles.credit}>
                      Source: Bowen company profile
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ---------------- 资质荣誉 ---------------- */}
      {honors.length > 0 && (
        <section className="section sectionAlt">
          <div className="container">
            <div className="sectionHead">
              <span className="eyebrow">Qualifications &amp; honors</span>
              <h2 className="h2">Corporate qualifications and recognition</h2>
              <p className="lead">
                Registration numbers are read from the documents reproduced in the Bowen company
                profile. Where a document is a public list rather than a certificate, it is described
                as a public list.
              </p>
            </div>

            <ul className={styles.honorGrid}>
              {honors.map((h) => {
                const img = h.image ? certificateImage(h.image.split('/').pop()!) : null;
                return (
                  <li key={h.name} className={styles.honorCard}>
                    {img && (
                      <figure className={styles.honorFigure}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.src} alt={img.alt} className={styles.honorImg} loading="lazy" decoding="async" />
                      </figure>
                    )}
                    <div className={styles.honorBody}>
                      <span className={styles.honorKind}>
                        {h.document_kind === 'public_list' ? 'Public list' : 'Certificate'}
                      </span>
                      <h3 className="h4">{h.name}</h3>
                      <p className={styles.honorZh}>{h.name_zh}</p>
                      <dl className={styles.honorMeta}>
                        {h.certificate_no && (
                          <div><dt>Certificate no.</dt><dd className="mono">{h.certificate_no}</dd></div>
                        )}
                        {h.entry_no && (
                          <div><dt>List entry no.</dt><dd className="mono">{h.entry_no}</dd></div>
                        )}
                        {h.issue_date && (
                          <div><dt>{h.document_kind === 'public_list' ? 'Published' : 'Issued'}</dt><dd>{h.issue_date}</dd></div>
                        )}
                        {h.validity && <div><dt>Validity</dt><dd>{h.validity}</dd></div>}
                      </dl>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ---------------- 文件包 ---------------- */}
      <section className="section">
        <div className={`container ${styles.docRow}`}>
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

          <div className={styles.sideBox}>
            <h3 className="h4">Scope is stated, not stretched</h3>
            <p>
              The management system certification covers the manufacture of thermostats. Clause 8.3
              product design is excluded from the IATF 16949 certification scope, and we state that
              exclusion wherever the certificate is described.
            </p>
            <p className={styles.docNote}>
              Standards published on this site: {c.public_certification_standards.join(', ')}.
            </p>
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
