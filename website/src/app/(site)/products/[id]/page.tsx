import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductVisual } from '@/components/ProductVisual';
import { AddToRfq } from '@/components/AddToRfq';
import { extractDisplacements, extractEngineCodes } from '@/lib/engine-code';
import { getDisplayApplications, getProductById, getPublishedProducts } from '@/lib/db';
import styles from './detail.module.css';

export const dynamicParams = true;

export async function generateStaticParams() {
  const products = await getPublishedProducts();
  return products.map((p) => ({ id: p.product_id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(decodeURIComponent(id));
  if (!product) return { title: 'Product not found' };
  return {
    title: `Bowen ${product.bowen_no} — ${product.product_type ?? 'Product'}`,
    description: `OE references and vehicle applications for Bowen No. ${product.bowen_no}.`,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(decodeURIComponent(id));
  if (!product) notFound();

  // blocked / draft 产品不对外展示
  if (product.blocked || product.status === 'draft' || product.status === 'blocked') notFound();

  const applications = await getDisplayApplications(product.product_id);
  const typeLabel = product.product_type
    ? product.product_type.replace(/([a-z])([A-Z])/g, '$1 $2')
    : 'Type pending review';

  return (
    <>
      <div className={styles.crumbsBar}>
        <div className="container">
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/">Home</Link><span aria-hidden="true">/</span>
            <Link href="/products">Products</Link><span aria-hidden="true">/</span>
            {product.product_type && (
              <>
                <Link href={`/products?type=${encodeURIComponent(product.product_type)}`}>{typeLabel}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <span className="mono">Bowen {product.bowen_no}</span>
          </nav>
        </div>
      </div>

      <section className={`section sectionTight`}>
        <div className={`container ${styles.top}`}>
          <div className={styles.visualCol}>
            <ProductVisual src={product.image} label={product.product_name_en} size="lg" />
            <p className={styles.visualNote}>
              Product photo not yet available in the source data. Drawing placeholder shown.
            </p>
          </div>

          <div className={styles.infoCol}>
            <div className={styles.badges}>
              <span className="badge badgeType">{typeLabel}</span>
              {product.product_subtype === null && product.product_type && (
                <span className="badge badgeMuted">Subtype: not used in V1</span>
              )}
              {product.prototype_rank && (
                <span className="badge badgeOk">Prototype candidate #{product.prototype_rank}</span>
              )}
            </div>

            <h1 className={styles.title}>
              Bowen No. <span className="mono">{product.bowen_no}</span>
            </h1>
            <p className={styles.subtitle}>{product.product_name_en}</p>

            <dl className={styles.specs}>
              <div>
                <dt>Product type</dt>
                <dd>{product.product_type ?? 'Pending human review'}</dd>
              </div>
              <div>
                <dt>OE references</dt>
                <dd>{product.distinct_oe_count}</dd>
              </div>
              <div>
                <dt>Applications</dt>
                <dd>{product.searchable_application_count}</dd>
              </div>
              {product.opening_temperatures_c.length > 0 && (
                <div>
                  <dt>Opening temperature</dt>
                  <dd>{product.opening_temperatures_c.map((t) => `${t} °C`).join(' / ')}</dd>
                </div>
              )}
              <div>
                <dt>Source sheets</dt>
                <dd className={styles.sheetList}>{product.source_sheets.join(', ')}</dd>
              </div>
            </dl>

            <div className={styles.typeNote}>
              <strong>How this classification was made</strong>
              <p>{product.product_type_evidence?.note ?? 'No human classification evidence recorded.'}</p>
              {product.product_type_evidence?.raw_label && (
                <p className={styles.evidenceLine}>
                  Source label: <span className="mono">{product.product_type_evidence.raw_label}</span>
                  {product.product_type_evidence.source_sheet && (
                    <> · {product.product_type_evidence.source_sheet}
                      {product.product_type_evidence.source_row ? ` row ${product.product_type_evidence.source_row}` : ''}</>
                  )}
                  {product.product_type_evidence.inherited_from_bowen_no && (
                    <> · inherited from Bowen {product.product_type_evidence.inherited_from_bowen_no}</>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className={styles.rfqCol}>
            <AddToRfq product={product} applications={applications} />
          </div>
        </div>
      </section>

      {/* ---------------- OE References & Vehicle Applications ---------------- */}
      <section className="section sectionTight">
        <div className="container">
          <div className={styles.tableHead}>
            <div>
              <h2 className="h2">OE References &amp; Vehicle Applications</h2>
              <p className={styles.tableLead}>
                One row per source record. The OE reference and the vehicle/engine application in a
                row come from the same original Excel row, so the relationship between them is
                preserved. Multiple OE numbers for one Bowen product are normal — we do not rank
                them into main or secondary references.
              </p>
            </div>
            <span className={styles.tableCount}>{applications.length} rows</span>
          </div>

          {applications.length === 0 ? (
            <p className={styles.noRows}>
              No displayable application rows for this product. Contact us with your OE number and we
              will confirm fitment manually.
            </p>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <caption className="srOnly">
                  OE references and vehicle applications for Bowen No. {product.bowen_no}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">OE Reference</th>
                    <th scope="col">Vehicle / Application</th>
                    <th scope="col">Engine codes in text</th>
                    <th scope="col">Opening Temperature</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => {
                    const engines = extractEngineCodes(a.vehicle_application_raw);
                    const disp = extractDisplacements(a.vehicle_application_raw);
                    return (
                      <tr key={a.application_id}>
                        <td className="oeCell">{a.oe_numbers_raw || <span className="muted">No OE recorded</span>}</td>
                        <td>
                          {a.vehicle_application_raw || <span className="muted">Not recorded in source</span>}
                          {disp.length > 0 && (
                            <span className={styles.disp}>Displacement: {disp.join(' / ')}</span>
                          )}
                        </td>
                        <td>
                          {engines.length > 0 ? (
                            <span className={styles.engineTags}>
                              {engines.map((e) => <code key={e}>{e}</code>)}
                            </span>
                          ) : (
                            <span className="muted">No engine code written in the source text</span>
                          )}
                        </td>
                        <td className="nowrap">
                          {a.opening_temperature_c?.length
                            ? a.opening_temperature_c.map((t) => `${t} °C`).join(' / ')
                            : <span className="muted">—</span>}
                        </td>
                        <td className={styles.sourceCell}>
                          {a.source_sheet} · row {a.source_row}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {product.needs_review_application_count > 0 && (
            <div className={`notice noticeWarn ${styles.reviewNotice}`}>
              <strong>{product.needs_review_application_count} source record(s) held back from this table.</strong>{' '}
              In those rows the Bowen No. cell contains extra specification text (for example a
              temperature next to the part number). The Bowen number is readable, but we are
              reviewing the row before publishing it. The original text is preserved in our database.
            </div>
          )}

          <div className={styles.legend}>
            <h3 className="h4">Reading this table</h3>
            <ul>
              <li><strong>OE Reference</strong> — every reference exactly as recorded in the source sheet. Copied text is searchable as-is.</li>
              <li><strong>Vehicle / Application</strong> — the application field exactly as recorded. We do not split it into invented make/model pairs, because the source does not state that mapping.</li>
              <li><strong>Engine codes in text</strong> — engine-like codes <em>found inside</em> the application text above (uppercase letters plus digits). These are shown so you can scan faster; the authoritative value is always the original text in the previous column.</li>
              <li><strong>Source</strong> — the worksheet and row the record came from, so any line can be traced back.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={`container ${styles.ctaInner}`}>
          <div>
            <h2 className="h2">Need this part in volume?</h2>
            <p>Send your OE number or sourcing list and we will reply with Bowen numbers and availability.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link href="/rfq" className="btn btnPrimary btnLg">Request a Quote</Link>
            <Link href="/products" className="btn btnOutline btnLg">Back to products</Link>
          </div>
        </div>
      </section>
    </>
  );
}
