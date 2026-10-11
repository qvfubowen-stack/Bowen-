import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductVisual } from '@/components/ProductVisual';
import { AddToRfq } from '@/components/AddToRfq';
import { extractDisplacements } from '@/lib/engine-code';
import { applicationOeText, applicationOeTokens, applicationTextEn } from '@/lib/application-display';
import { productImageAlt, productImageSrc } from '@/lib/media';
import { getDisplayApplications, getProductById, getPublishedProducts } from '@/lib/db';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import { breadcrumbSchema, jsonLdScriptProps, productSchema } from '@/lib/structured-data';
import styles from './detail.module.css';

export const dynamicParams = true;

export async function generateStaticParams() {
  const products = await getPublishedProducts();
  return products.map((p) => ({ id: p.product_id }));
}

/**
 * 每个产品的 metadata。
 * 规则（Phase 5）：
 *   - title 里只放 Bowen No. 与产品类型，**不堆 OE 号**；
 *   - description 里放合理数量的主要 OE 参考（最多 4 个）与"下单前确认适配"的口径；
 *   - 不出现任何内部字段（工作表名、审核状态、证据路径），也不为没有资料的产品编造车型。
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const product = await getProductById(decoded);
  if (!product) return { title: 'Product not found', robots: { index: false, follow: false } };

  const apps = await getDisplayApplications(product.product_id);
  const oeReferences = [...new Set(apps.flatMap((a) => applicationOeTokens(a.oe_tokens)))].slice(0, 4);
  const typeLabel = product.product_type
    ? product.product_type.replace(/([a-z])([A-Z])/g, '$1 $2')
    : null;

  const description = [
    `Bowen No. ${product.bowen_no}${typeLabel ? ` — ${typeLabel}` : ''} from Qufu Bowen Auto Parts Manufacturing Co., Ltd.`,
    oeReferences.length ? `Cross-referenced OE numbers: ${oeReferences.join(', ')}.` : '',
    product.searchable_application_count > 0
      ? `${product.searchable_application_count} recorded vehicle application${product.searchable_application_count === 1 ? '' : 's'} in our product data.`
      : '',
    'Confirm fitment with Bowen before ordering.',
  ].filter(Boolean).join(' ');

  const image = productImageSrc(product.product_id);

  return {
    title: `Bowen ${product.bowen_no} — ${product.product_type ?? 'Automotive part'}`,
    description,
    alternates: canonicalFor(`/products/${product.product_id}`),
    openGraph: {
      type: 'website',
      url: absoluteUrl(`/products/${product.product_id}`),
      title: `Bowen ${product.bowen_no} — ${product.product_type ?? 'Automotive part'}`,
      description,
      ...(image
        ? { images: [{ url: image, alt: productImageAlt(product.bowen_no, product.product_name_en) }] }
        : {}),
    },
    twitter: {
      card: 'summary',
      title: `Bowen ${product.bowen_no}`,
      description,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Phase 4.1：仓储层只返回「公开产品」（状态允许 + 未 blocked + 有可靠主图），
  // 无可靠主图的产品在这里直接 404，不会显示 fallback 占位图。
  const product = await getProductById(decodeURIComponent(id));
  if (!product) notFound();

  const applications = await getDisplayApplications(product.product_id);
  const typeLabel = product.product_type
    ? product.product_type.replace(/([a-z])([A-Z])/g, '$1 $2')
    : 'Type pending review';

  const imageSrc = productImageSrc(product.product_id);
  if (!imageSrc) notFound();

  const productPath = `/products/${product.product_id}`;
  const oeReferences = [...new Set(applications.flatMap((a) => applicationOeTokens(a.oe_tokens)))];

  // 结构化数据：只写有据可查的字段（无价格、无库存、无评分、无评论、无 GTIN）
  const productLd = productSchema({
    product_id: product.product_id,
    bowen_no: product.bowen_no,
    product_type: product.product_type,
    product_name_en: product.product_name_en,
    image_path: imageSrc,
    oe_references: oeReferences.slice(0, 6),
    path: productPath,
    application_count: product.searchable_application_count,
  });

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    ...(product.product_type ? [{ name: typeLabel, path: `/products?type=${encodeURIComponent(product.product_type)}` }] : []),
    { name: `Bowen ${product.bowen_no}`, path: productPath },
  ];
  const breadcrumbLd = breadcrumbSchema(crumbs);

  return (
    <>
      <script {...jsonLdScriptProps([productLd, breadcrumbLd])} />

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
            <ProductVisual
              src={imageSrc}
              alt={productImageAlt(product.bowen_no, product.product_name_en)}
              label={product.product_name_en}
              size="lg"
              priority
            />
          </div>

          <div className={styles.infoCol}>
            <div className={styles.badges}>
              <span className="badge badgeType">{typeLabel}</span>
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
            </dl>
          </div>

          <div className={styles.rfqCol}>
            {/* 只把客户端组件真正需要的字段传过去：
                props 会进入页面 HTML 的 RSC payload，内部审计字段不能外露 */}
            <AddToRfq
              product={{
                product_id: product.product_id,
                bowen_no: product.bowen_no,
                product_type: product.product_type,
              }}
              applications={applications.map((a) => ({
                application_id: a.application_id,
                oe_tokens: applicationOeTokens(a.oe_tokens),
                application_en: applicationTextEn(a.vehicle_application_raw),
              }))}
            />
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
                One row per product record. The OE reference and the vehicle/application summary in a
                row stay together, so their relationship is preserved.
                Multiple OE numbers for one Bowen product are normal — we do not rank them into main
                or secondary references.
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
                    <th scope="col">Opening Temperature</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => {
                    const disp = extractDisplacements(a.vehicle_application_raw);
                    const applicationEn = applicationTextEn(a.vehicle_application_raw);
                    const oeText = applicationOeText(a.oe_tokens);
                    return (
                      <tr key={a.application_id}>
                        <td className="oeCell">{oeText || <span className="muted">No OE recorded</span>}</td>
                        <td>
                          {applicationEn}
                          {disp.length > 0 && (
                            <span className={styles.disp}>Displacement in text: {disp.join(' / ')}</span>
                          )}
                        </td>
                        <td className="nowrap">
                          {a.opening_temperature_c?.length
                            ? a.opening_temperature_c.map((t) => `${t} °C`).join(' / ')
                            : <span className="muted">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.legend}>
            <h3 className="h4">Reading this table</h3>
            <ul>
              <li>
                <strong>OE Reference</strong> — each searchable OE reference associated with this
                application record.
              </li>
              <li>
                <strong>Vehicle / Application</strong> — an English application summary that keeps
                model and engine codes intact. Please confirm fitment with us before ordering.
              </li>
              <li>
                <strong>Opening Temperature</strong> — shown only where the source record states it.
              </li>
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
