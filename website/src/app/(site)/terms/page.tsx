import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getSiteFacts } from '@/lib/db';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import styles from '../legal.module.css';

const LAST_UPDATED = '26 September 2026';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description:
    'Terms for using the Bowen website: catalogue and product information is provided for '
    + 'procurement reference, OE numbers are cross-references, and fitment must be confirmed '
    + 'before ordering.',
  alternates: canonicalFor('/terms'),
  openGraph: { url: absoluteUrl('/terms'), title: 'Terms of Use | Bowen', type: 'article' },
};

export default async function TermsPage() {
  const c = (await getSiteFacts()).company;

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Use"
        lead="These terms apply to this website and to the product information published on it. Please read them before you use the catalogue to place an order."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Terms of Use' }]}
      />

      <section className="section sectionTight">
        <div className="container">
          <div className={styles.legal}>
            <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>

            <div className={styles.summary}>
              <p>
                <strong>In short:</strong> this website is a business-to-business product catalogue. The
                reference information is published so you can identify the part you need, but it is not a
                binding quotation and it is not a fitment guarantee. Confirm the part with us before you
                order.
              </p>
            </div>

            <h2 className="h2">1. Who these terms are between</h2>
            <p>
              This website is operated by <strong>{c.legal_name_en}</strong> ({c.legal_name_zh}). By
              using the site you accept these terms. If you do not accept them, please do not use the
              site.
            </p>

            <h2 className="h2">2. What this website is for</h2>
            <p>
              This site is provided for business and professional purchasing use: identifying Bowen
              parts, cross-referencing OE numbers, reviewing the applications recorded in our product
              data, and sending a request for quotation. It is not directed at consumers and it is not a
              retail shop.
            </p>

            <h2 className="h2">3. Product information is procurement reference material</h2>
            <p>
              Product records, Bowen numbers, product types, opening temperatures, OE references and
              vehicle/application text are published for procurement reference only. They are drawn from
              our own product records and are published as recorded.
            </p>
            <p>
              Where a field is not supported by a reliable source, it is left out or marked as available
              on request. We do not fill gaps with estimates.
            </p>

            <h2 className="h2">4. OE numbers are cross-references</h2>
            <p>
              OE numbers published on this site are cross-reference numbers used to help you identify an
              equivalent part. They are quoted as references, they remain the property of their
              respective owners, and their use here does not mean that any vehicle manufacturer
              endorses, sponsors or supplies us.
            </p>

            <h2 className="h2">5. Fitment and application must be confirmed before ordering</h2>
            <p>
              Vehicle and application information is the text recorded in our product data for each
              product record. It is not a substitute for checking the part against your own catalogue,
              your own VIN or engine data, or a physical sample.
            </p>
            <p>
              <strong>Always confirm fitment with us before ordering.</strong> We are glad to check a
              specific vehicle, engine code or OE number against our records and to send dimensions or
              photographs where we have them.
            </p>

            <h2 className="h2">6. No automatic quotation and no binding offer</h2>
            <p>
              Nothing on this website is a quotation, a price list or an offer capable of acceptance.
              This site does not display prices and does not process orders or payments.
            </p>
            <p>
              Submitting the request-for-quotation form starts a conversation. Price, minimum order
              quantity, lead time, packaging and delivery terms are only established in a separate
              written quotation or in a signed order confirmation from us.
            </p>

            <h2 className="h2">7. Images and content</h2>
            <p>
              Product photographs, factory photographs, certificate images, text and page layouts on this
              site belong to {c.legal_name_en} or are used with permission. You may view, download and
              print pages for the purpose of evaluating and purchasing our products.
            </p>
            <p>
              You may not republish our photographs or copy substantial parts of the catalogue for a
              competing commercial purpose without our written permission. Certificate and document
              images are provided for supplier evaluation and may be shared within your own organisation
              for that purpose.
            </p>

            <h2 className="h2">8. Acceptable use</h2>
            <p>When using this site you must not:</p>
            <ul>
              <li>submit false, misleading or impersonating enquiry information;</li>
              <li>send automated, bulk or spam submissions through the RFQ form;</li>
              <li>attempt to probe, scan, overload or gain unauthorised access to the site or its data;</li>
              <li>scrape the catalogue at volume, or resell or redistribute the data as a product;</li>
              <li>use the site in a way that breaks any applicable law.</li>
            </ul>
            <p>
              We may restrict or block access where we reasonably believe the site is being abused.
            </p>

            <h2 className="h2">9. Availability</h2>
            <p>
              We aim to keep the site available and accurate, but we do not promise uninterrupted access.
              We may change, correct, suspend or withdraw any part of the catalogue at any time,
              including after a product has been discontinued or a data record has been corrected.
            </p>

            <h2 className="h2">10. Limitation of liability</h2>
            <p>
              To the extent permitted by applicable law, we are not liable for indirect or consequential
              loss, loss of profit, loss of business or loss of data arising from your use of this
              website or from reliance on catalogue information without confirming fitment with us.
            </p>
            <p>
              Nothing in these terms limits liability that cannot lawfully be limited, including
              liability for death or personal injury caused by negligence, or for fraud.
            </p>

            <h2 className="h2">11. Changes to these terms</h2>
            <p>
              We may update these terms as the website develops. The date at the top of this page shows
              the current version.
            </p>

            <h2 className="h2">12. Contact</h2>
            <p>
              Questions about these terms, or about a specific part, can be sent to{' '}
              <a href={`mailto:${c.email}`}>{c.email}</a> or by post to:
            </p>
            <div className={styles.contactBlock}>
              <p><strong>{c.legal_name_en}</strong></p>
              <p>{c.address_en}</p>
              <p>Email: <a href={`mailto:${c.email}`}>{c.email}</a></p>
              <p>Tel: <a href={`tel:${c.tel_href}`}>{c.tel_display}</a></p>
            </div>

            <div className={styles.note}>
              <p>
                See also our <Link href="/privacy">Privacy Policy</Link>, which explains how we handle
                the information you send through the RFQ form.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
