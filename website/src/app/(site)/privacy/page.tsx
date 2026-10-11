import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/components/PageHero';
import { getSiteFacts } from '@/lib/db';
import { absoluteUrl, canonicalFor } from '@/lib/site-url';
import styles from '../legal.module.css';

const LAST_UPDATED = '26 September 2026';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Qufu Bowen Auto Parts Manufacturing Co., Ltd. collects, uses, stores and protects the '
    + 'information you send through this website, including requests for quotation.',
  alternates: canonicalFor('/privacy'),
  openGraph: { url: absoluteUrl('/privacy'), title: 'Privacy Policy | Bowen', type: 'article' },
};

export default async function PrivacyPage() {
  const c = (await getSiteFacts()).company;

  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        lead="This policy explains what we collect through this website, why we collect it, and how you can ask us to change or delete it."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Privacy Policy' }]}
      />

      <section className="section sectionTight">
        <div className="container">
          <div className={styles.legal}>
            <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>

            <div className={styles.summary}>
              <p>
                <strong>In short:</strong> we collect the contact details and sourcing information you
                type into the request-for-quotation form so that we can quote and reply. We do not sell
                your information, we do not use advertising trackers, and you can ask us to correct or
                delete what we hold.
              </p>
            </div>

            <h2 className="h2">1. Who is responsible for your information</h2>
            <p>
              This website is operated by <strong>{c.legal_name_en}</strong> ({c.legal_name_zh}),
              the manufacturer and data controller for the information described in this policy.
            </p>
            <div className={styles.contactBlock}>
              <p><strong>{c.legal_name_en}</strong></p>
              <p>{c.address_en}</p>
              <p>Email: <a href={`mailto:${c.email}`}>{c.email}</a></p>
              <p>Tel: <a href={`tel:${c.tel_href}`}>{c.tel_display}</a></p>
            </div>

            <h2 className="h2">2. What we collect</h2>
            <p>We only collect information that you choose to send us, plus a small amount of technical information needed to run the site securely.</p>
            <h3 className="h4">Information you enter in the RFQ form</h3>
            <ul>
              <li>Your name, company name and country.</li>
              <li>Your email address, and a phone or WhatsApp number if you provide one.</li>
              <li>Your website address, if you provide one.</li>
              <li>The message you write, including any sourcing list you paste into it.</li>
              <li>
                The parts you add to your RFQ list: Bowen number, product type, matched OE reference,
                recorded vehicle/application text and the quantity you enter.
              </li>
              <li>The page you were on when you submitted the enquiry.</li>
            </ul>
            <h3 className="h4">Information collected automatically</h3>
            <ul>
              <li>
                The time of submission and standard web request information (such as your browser
                user-agent string) recorded with the enquiry.
              </li>
              <li>
                We do not store your IP address in our enquiry records. To prevent automated abuse we
                may check how many enquiries arrive from one connection using a short-lived,
                keyed one-way hash of the connection address; it is held in server memory only and is
                not written to the database.
              </li>
            </ul>
            <h3 className="h4">Information stored in your own browser</h3>
            <p>
              Your RFQ list is kept in your browser&apos;s local storage so that the list survives a page
              reload. It stays on your device, is not a cookie, and is not sent to us until you submit
              the form. Clearing your browser data removes it.
            </p>

            <h2 className="h2">3. Why we use it</h2>
            <ul>
              <li>To answer your enquiry and prepare a quotation.</li>
              <li>To confirm which product and application your enquiry refers to.</li>
              <li>To keep a record of the commercial correspondence between us.</li>
              <li>To keep the website working and protect it against spam and automated abuse.</li>
            </ul>
            <p>
              We do not use your information for advertising, we do not build marketing profiles, and we
              do not sell or rent your information to anyone.
            </p>

            <h2 className="h2">4. How an RFQ is processed</h2>
            <p>
              When you submit the form, your enquiry is sent over an encrypted connection to our
              website server. The server checks the enquiry and records it in our enquiry database with
              a unique inquiry number. A notification email is then sent to our sales team containing
              the information you entered, so that sales can reply to you directly.
            </p>
            <p>
              The parts in your RFQ list are re-checked against our own published product records before
              the enquiry is stored, so that the Bowen number, OE reference and application we record are
              the ones our own data supports. If a line cannot be verified, the form asks you to add it
              again from the catalogue.
            </p>

            <h2 className="h2">5. Email delivery</h2>
            <p>
              Notification emails are delivered through a transactional email service provider acting on
              our instructions. If delivery fails, your enquiry is still stored with its inquiry number
              so that nothing you sent is lost. The confirmation page asks you to contact us directly if
              you do not receive a reply; failed notifications are not retried automatically.
            </p>
            <p>
              The RFQ form itself does not upload files. For a long sourcing list, either paste the key
              OE numbers into the message field, or email the file to{' '}
              <a href={`mailto:${c.email}`}>{c.email}</a> and quote your inquiry number. Files sent to
              that address are handled by our normal business email service.
            </p>

            <h2 className="h2">6. Where your enquiry is stored</h2>
            <p>
              Enquiry records are stored in the database that backs this website, or, where that
              database is not yet configured, in an access-controlled file on the server that runs the
              site. Access is limited to our own sales and technical staff who need it to answer your
              enquiry. The database is not readable from a browser: the website writes to it only from
              the server side.
            </p>

            <h2 className="h2">7. How long we keep it</h2>
            <p>
              We retain inquiry information only for as long as reasonably necessary to respond to the
              inquiry, maintain business records and meet applicable legal obligations. When an enquiry
              is no longer needed for those purposes we delete it. If you ask us to delete your enquiry
              earlier, we will do so unless we are required to keep a record by law.
            </p>

            <h2 className="h2">8. How we protect it</h2>
            <ul>
              <li>The site is served over HTTPS with modern security response headers.</li>
              <li>Enquiry data is written only by our server; the browser cannot read or write the enquiry table.</li>
              <li>Access to stored enquiries is restricted to staff who need it.</li>
              <li>Secrets and service credentials are held in server-side configuration and are never sent to the browser.</li>
            </ul>
            <p>
              No method of transmission or storage is completely secure. We use reasonable technical and
              organisational measures, and we limit what we collect in the first place.
            </p>

            <h2 className="h2">9. Third-party services</h2>
            <p>We keep the number of external services involved to a minimum. The categories we use are:</p>
            <ul>
              <li>A hosting provider that serves this website.</li>
              <li>A transactional email provider that delivers the enquiry notification to our sales team.</li>
              <li>A hosted database provider, where configured, that stores enquiry records.</li>
              <li>
                An optional bot-protection service on the RFQ form. It runs only if it is enabled for the
                live site, and it is used solely to distinguish human enquiries from automated ones.
              </li>
            </ul>
            <p>
              These providers process information on our instructions and only for the purposes above.
              We do not use advertising networks, social media pixels or third-party analytics trackers
              on this website.
            </p>

            <h2 className="h2">10. Your choices and rights</h2>
            <p>You can contact us at any time to:</p>
            <ul>
              <li>ask what information we hold about you and receive a copy;</li>
              <li>ask us to correct information that is wrong or incomplete;</li>
              <li>ask us to delete your enquiry and the contact details attached to it;</li>
              <li>object to a particular use of your information, or withdraw your consent.</li>
            </ul>
            <p>
              Send your request to <a href={`mailto:${c.email}`}>{c.email}</a> with enough detail for us
              to find your enquiry — the inquiry number from your confirmation screen is the quickest
              way. We will respond within a reasonable period and in accordance with applicable
              requirements.
            </p>

            <h2 className="h2">11. Children</h2>
            <p>
              This is a business-to-business website for manufacturers, importers and distributors. It is
              not directed at children and we do not knowingly collect information from them.
            </p>

            <h2 className="h2">12. Changes to this policy</h2>
            <p>
              We may update this policy when our process or the services we use change. The date at the
              top of this page always shows the current version. If a change affects how we handle an
              enquiry you have already sent, we will tell you by email.
            </p>

            <h2 className="h2">13. Contact</h2>
            <p>
              Questions about this policy, or about the information we hold, can be sent to{' '}
              <a href={`mailto:${c.email}`}>{c.email}</a> or by post to the address above. You can also
              use the <Link href="/contact">contact page</Link>.
            </p>

            <div className={styles.note}>
              <p>
                See also our <Link href="/terms">Terms of Use</Link>, which cover how the product
                information on this website may be used.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
