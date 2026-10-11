import { cache } from 'react';
import Link from 'next/link';
import { OeSearchBox } from '@/components/OeSearchBox';
import { AddOeResultToRfq } from '@/components/AddOeResultToRfq';
import { searchByOe } from '@/lib/db';
import styles from './oe-search.module.css';
import { applicationOeTokens, applicationTextEn } from '@/lib/application-display';

export const metadata = {
  title: 'OE Number Search',
  description: 'Search Bowen products by OE number. Case, spaces, dashes and slashes are ignored.',
  // 功能页 + 查询结果页：始终不参与索引，也不给出 canonical 指向具体查询组合
  robots: { index: false, follow: false },
};

const getResult = cache(searchByOe);

export default async function OeSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const query = (sp.q ?? '').trim();
  const result = query ? await getResult(query) : null;

  return (
    <>
      <section className={styles.head}>
        <div className="container">
          <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/">Home</Link><span aria-hidden="true">/</span><span>OE Search</span>
          </nav>
          <h1 className="h1">Search by OE Number</h1>
          <p className={styles.lead}>
            Enter any OE reference from your sourcing list. We match it against every normalized OE
            number in the Bowen product database and show you the exact application behind the match.
          </p>
          <OeSearchBox size="large" defaultValue={query} autoFocus={!query} submitLabel="Search OE" />
        </div>
      </section>

      <section className="section sectionTight">
        <div className="container">
          {!query && (
            <div className={styles.intro}>
              <h2 className="h3">How matching works</h2>
              <div className={styles.introGrid}>
                <div className={styles.introCard}>
                  <h3 className="h4">Normalized matching</h3>
                  <p>
                    Before comparing, we strip spaces, dashes and slashes and ignore letter case.
                    <br />
                    <span className="mono">25500-35540</span> = <span className="mono">2550035540</span> ={' '}
                    <span className="mono">25500 35540</span> = <span className="mono">25500/35540</span>
                  </p>
                </div>
                <div className={styles.introCard}>
                  <h3 className="h4">What you get back</h3>
                  <p>
                    Each hit is a <strong>product + the specific application row</strong> that carries
                    your OE number — including an English vehicle/application summary,
                    so you can judge fitment yourself.
                  </p>
                </div>
                <div className={styles.introCard}>
                  <h3 className="h4">Multiple results are normal</h3>
                  <p>
                    One OE number can appear under more than one Bowen number, and one Bowen product
                    can carry many OE numbers. We show all of them instead of picking a winner.
                  </p>
                </div>
              </div>
            </div>
          )}

          {query && result && (
            <>
              <div className={styles.resultHead}>
                <div>
                  <p className={styles.queryLine}>
                    Query: <span className="mono">{result.query}</span>
                    <span className={styles.arrow} aria-hidden="true">→</span>
                    normalized: <span className="mono">{result.normalizedQuery}</span>
                  </p>
                  <p className={styles.resultCount}>
                    {result.exactHits.length > 0 ? (
                      <>
                        <strong>{result.exactHits.length}</strong> exact match
                        {result.exactHits.length === 1 ? '' : 'es'} across{' '}
                        <strong>{result.totalProducts}</strong> Bowen product
                        {result.totalProducts === 1 ? '' : 's'}
                      </>
                    ) : result.partialHits.length > 0 ? (
                      <>
                        No exact match. <strong>{result.partialHits.length}</strong> partial match
                        {result.partialHits.length === 1 ? '' : 'es'} shown below.
                      </>
                    ) : (
                      <>No match found in the current database.</>
                    )}
                  </p>
                </div>

                <div className={styles.resultBadge}>
                  {result.exactHits.length > 0 ? (
                    <span className="badge badgeOk">Exact OE Match</span>
                  ) : result.partialHits.length > 0 ? (
                    <span className="badge badgeWarn">Partial match only</span>
                  ) : (
                    <span className="badge badgeMuted">No match</span>
                  )}
                </div>
              </div>

              {result.exactHits.length === 0 && result.partialHits.length === 0 && (
                <div className={styles.noMatch}>
                  <h2 className="h3">We could not match <span className="mono">{result.query}</span></h2>
                  <p>
                    This OE number is not in the current database. That does not mean we cannot make
                    the part — send it to us with your quantities and we will check it against our
                    tooling and development list.
                  </p>
                  <div className={styles.noMatchActions}>
                    <Link href="/rfq" className="btn btnPrimary">Send this OE number to us</Link>
                    <Link href="/products" className="btn btnGhost">Browse all products</Link>
                  </div>
                </div>
              )}

              {(result.exactHits.length > 0 || result.partialHits.length > 0) && (
                <>
                  <ul className={styles.hitList}>
                    {result.hits.map((hit, i) => {
                      const publicOe = applicationOeTokens([hit.oe_number_raw])[0] ?? hit.oe_search_key;
                      return (
                      <li key={`${hit.application.application_id}-${hit.oe_search_key}-${i}`} className={styles.hit}>
                        <div className={styles.hitMain}>
                          <div className={styles.hitOe}>
                            <span className={styles.hitLabel}>Matched OE</span>
                            <span className={styles.hitOeValue}>{publicOe}</span>
                          </div>

                          <dl className={styles.hitData}>
                            <div>
                              <dt>Bowen No.</dt>
                              <dd>
                                <Link
                                  href={`/products/${encodeURIComponent(hit.product.product_id)}`}
                                  className={`mono ${styles.bowenLink}`}
                                >
                                  {hit.product.bowen_no}
                                </Link>
                              </dd>
                            </div>
                            <div>
                              <dt>Product type</dt>
                              <dd>{hit.product.product_type ?? 'Pending review'}</dd>
                            </div>
                            <div className={styles.wide}>
                              <dt>Vehicle / Application</dt>
                              <dd>
                                {applicationTextEn(hit.application.vehicle_application_raw)
                                  || <span className="muted">Not recorded for this entry — see the product page for other entries</span>}
                              </dd>
                            </div>
                            {hit.application.opening_temperature_c?.length ? (
                              <div>
                                <dt>Opening temp.</dt>
                                <dd>{hit.application.opening_temperature_c.map((t) => `${t} °C`).join(' / ')}</dd>
                              </div>
                            ) : null}
                          </dl>
                        </div>

                        <div className={styles.hitActions}>
                          <Link
                            href={`/products/${encodeURIComponent(hit.product.product_id)}`}
                            className="btn btnGhost btnSm"
                          >
                            Product detail
                          </Link>
                          <AddOeResultToRfq
                            productId={hit.product.product_id}
                            bowenNo={hit.product.bowen_no ?? ''}
                            productType={hit.product.product_type}
                            matchedOe={publicOe}
                            vehicle={applicationTextEn(hit.application.vehicle_application_raw)}
                            engine={null}
                            applicationId={hit.application.application_id}
                          />
                        </div>
                      </li>
                      );
                    })}
                  </ul>

                  {result.exactHits.length > 0 && (
                    <p className={styles.exactNote}>
                      <strong>“Exact OE Match”</strong> means your input equals a normalized OE number
                      in our database — it does not mean the OE is unique. Multiple rows are shown
                      when the same OE number is recorded under more than one Bowen product.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
