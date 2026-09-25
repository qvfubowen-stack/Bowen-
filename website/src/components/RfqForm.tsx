'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRfq } from './rfq-context';
import { OeSearchBox } from './OeSearchBox';
import styles from './RfqForm.module.css';

interface ProductLite {
  product_id: string;
  bowen_no: string | null;
  product_type: string | null;
  vehicle_application_raw: string;
  first_oe: string | null;
}

const COUNTRIES = [
  'United States', 'Germany', 'United Kingdom', 'France', 'Italy', 'Spain', 'Netherlands',
  'Poland', 'Turkey', 'Russia', 'United Arab Emirates', 'Saudi Arabia', 'Egypt', 'South Africa',
  'Brazil', 'Mexico', 'Chile', 'Argentina', 'Australia', 'India', 'Thailand', 'Vietnam',
  'Malaysia', 'Indonesia', 'Japan', 'South Korea', 'Other',
];

export function RfqForm({
  preselect,
  products,
}: {
  preselect?: string;
  products: ProductLite[];
}) {
  const { lines, addLine, removeLine, updateLine, clear, ready, count } = useRfq();
  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const preselected = useRef(false);

  // 支持 /rfq?product=BW-3005 直接带入（产品卡片的「Add to RFQ」链接）
  useEffect(() => {
    if (!ready || !preselect || preselected.current) return;
    const p = products.find((x) => x.product_id === preselect);
    if (p) {
      addLine({
        product_id: p.product_id,
        bowen_no: p.bowen_no ?? '',
        product_type: p.product_type,
        matched_oe: p.first_oe,
        vehicle: p.vehicle_application_raw || null,
        engine: p.vehicle_application_raw || null,
        application_id: null,
      });
    }
    preselected.current = true;
  }, [ready, preselect, products, addLine]);

  const totalItems = lines.length;

  function validate(form: HTMLFormElement) {
    const data = new FormData(form);
    const next: Record<string, string> = {};
    const name = String(data.get('name') ?? '').trim();
    const company = String(data.get('company') ?? '').trim();
    const country = String(data.get('country') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    if (!name) next.name = 'Please enter your name.';
    if (!company) next.company = 'Please enter your company name.';
    if (!country) next.country = 'Please select your country.';
    if (!email) next.email = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) next.email = 'That email address does not look valid.';
    if (!message && totalItems === 0 && !fileName) {
      next.message = 'Add at least one product, upload a sourcing list, or describe what you need.';
    }
    return next;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = validate(e.currentTarget);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0];
      e.currentTarget.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }
    // 原型阶段：不真正发送邮件，只把完整的数据流展示出来证明流程跑通
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const payloadPreview = useMemo(() => ({
    contact: {
      name: '(from form)',
      company: '(from form)',
      country: '(from form)',
      email: '(from form)',
      whatsapp_phone: '(from form)',
    },
    items: lines.map((l) => ({
      product_id: l.product_id,
      bowen_no: l.bowen_no,
      product_type: l.product_type,
      matched_oe: l.matched_oe,
      vehicle: l.vehicle,
      engine: l.engine,
      application_id: l.application_id,
      quantity: l.quantity || null,
    })),
    sourcing_list_file: fileName,
  }), [lines, fileName]);

  if (submitted) {
    return (
      <div className={styles.success}>
        <span className={styles.successIcon} aria-hidden="true">✓</span>
        <h2 className="h2">Request prepared</h2>
        <p className={styles.successLead}>
          This is a prototype — nothing was emailed. On the production site this payload would be
          sent to Bowen sales and a confirmation email returned to you.
        </p>

        <div className={styles.payloadHead}>
          <h3 className="h4">Data that would be transmitted</h3>
          <button type="button" className="btn btnGhost btnSm" onClick={() => { setSubmitted(false); }}>
            Back to the form
          </button>
        </div>
        <pre className={styles.payload}>{JSON.stringify(payloadPreview, null, 2)}</pre>

        <div className={styles.successActions}>
          <button
            type="button"
            className="btn btnGhost"
            onClick={() => { clear(); setFileName(null); setSubmitted(false); window.scrollTo({ top: 0 }); }}
          >
            Start a new RFQ
          </button>
          <Link href="/products" className="btn btnNavy">Continue browsing</Link>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* ---------- RFQ 明细 ---------- */}
      <section className={styles.block}>
        <header className={styles.blockHead}>
          <h2 className="h3">1 · Your RFQ list</h2>
          <span className={styles.blockCount}>
            {totalItems} {totalItems === 1 ? 'line' : 'lines'}
          </span>
        </header>

        {totalItems === 0 ? (
          <div className={styles.emptyList}>
            <p>
              No products added yet. Use <strong>Add to RFQ</strong> on any product or search result,
              or just paste your numbers in the message below.
            </p>
            <div className={styles.emptyActions}>
              <Link href="/products" className="btn btnGhost btnSm">Browse products</Link>
              <Link href="/oe-search" className="btn btnGhost btnSm">Search by OE</Link>
            </div>
          </div>
        ) : (
          <ul className={styles.lineList}>
            {lines.map((l, i) => (
              <li key={`${l.product_id}-${l.matched_oe}-${l.application_id}-${i}`} className={styles.line}>
                <div className={styles.lineData}>
                  <div className={styles.lineTop}>
                    <span className={styles.lineBowen}>Bowen No. {l.bowen_no || '—'}</span>
                    {l.product_type && <span className="badge badgeType">{l.product_type}</span>}
                  </div>
                  <dl className={styles.lineFields}>
                    <div>
                      <dt>Matched OE</dt>
                      <dd className="mono">{l.matched_oe ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Vehicle</dt>
                      <dd>{l.vehicle || '—'}</dd>
                    </div>
                    <div>
                      <dt>Engine</dt>
                      <dd>{l.engine || '—'}</dd>
                    </div>
                  </dl>
                  <div className={styles.lineInputs}>
                    <label>
                      <span>Quantity</span>
                      <input
                        className="input"
                        value={l.quantity}
                        onChange={(e) => updateLine(i, { quantity: e.target.value })}
                        placeholder="e.g. 500 pcs"
                      />
                    </label>
                    <label>
                      <span>Remark</span>
                      <input
                        className="input"
                        value={l.remark}
                        onChange={(e) => updateLine(i, { remark: e.target.value })}
                        placeholder="optional"
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeLine(i)}
                  aria-label={`Remove Bowen ${l.bowen_no} from RFQ`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {totalItems > 0 && (
          <p className={styles.clearLine}>
            <button type="button" className={styles.linkBtn} onClick={clear}>Clear the whole list</button>
          </p>
        )}
      </section>

      {/* ---------- 联系信息 ---------- */}
      <section className={styles.block}>
        <header className={styles.blockHead}>
          <h2 className="h3">2 · Your details</h2>
        </header>

        <div className={styles.grid2}>
          <Field label="Name" name="name" required error={errors.name} autoComplete="name" />
          <Field label="Company" name="company" required error={errors.company} autoComplete="organization" />
          <div className="field">
            <label className="label" htmlFor="country">Country<span className="req">*</span></label>
            <select id="country" name="country" className="select" defaultValue="">
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.country && <span className={styles.error}>{errors.country}</span>}
          </div>
          <Field label="Email" name="email" type="email" required error={errors.email} autoComplete="email" />
          <Field label="WhatsApp / Phone" name="whatsapp" type="tel" error={errors.whatsapp} autoComplete="tel" />
          <Field label="Website (optional)" name="website" error={errors.website} autoComplete="url" />
        </div>
      </section>

      {/* ---------- 需求描述 ---------- */}
      <section className={styles.block}>
        <header className={styles.blockHead}>
          <h2 className="h3">3 · What you need</h2>
        </header>

        <div className="field">
          <label className="label" htmlFor="message">Message</label>
          <textarea
            id="message"
            name="message"
            className="textarea"
            placeholder={
              'Paste your sourcing list here — OE numbers, Bowen numbers, quantities, target price.\n'
              + 'Example:\n2550035540 x 300\n4711306950 x 500\n9091603092 x 200'
            }
            rows={7}
          />
          {errors.message && <span className={styles.error}>{errors.message}</span>}
          <span className="hint">
            Pasting a list here is the fastest route. One OE number per line works fine.
          </span>
        </div>

        <div className={styles.upload}>
          <label className="label" htmlFor="sourcing-list">Upload sourcing list (optional)</label>
          <input
            id="sourcing-list"
            name="sourcing_list"
            type="file"
            className={styles.file}
            accept=".xlsx,.xls,.csv,.pdf,.txt,.doc,.docx"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <span className="hint">
            Excel, CSV, PDF or Word. Up to 10 MB. {/* 原型阶段：文件不会被上传或存储 */}
            Prototype only — the file is not uploaded or stored.
          </span>
          {fileName && <p className={styles.fileName}>Selected: {fileName}</p>}
        </div>

        <label className={styles.consent}>
          <input type="checkbox" name="consent" defaultChecked />
          <span>Send me the quotation and follow-up about this enquiry.</span>
        </label>
      </section>

      <div className={styles.submitRow}>
        <button type="submit" className="btn btnPrimary btnLg">Send RFQ</button>
        <p className={styles.submitNote}>
          Prototype: submitting will not send an email. It shows the exact data payload that the
          production form would transmit.
        </p>
      </div>

      <div className={styles.altSearch}>
        <span>Need to check one more OE number first?</span>
        <OeSearchBox size="compact" tone="light" placeholder="OE number" submitLabel="Find" mode="oe" />
      </div>
    </form>
  );
}

function Field({
  label, name, type = 'text', required, error, autoComplete,
}: {
  label: string; name: string; type?: string; required?: boolean; error?: string; autoComplete?: string;
}) {
  return (
    <div className="field">
      <label className="label" htmlFor={name}>
        {label}{required && <span className="req">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input"
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && <span className={styles.error} id={`${name}-error`}>{error}</span>}
    </div>
  );
}
