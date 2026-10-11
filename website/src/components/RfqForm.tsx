'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRfq } from './rfq-context';
import { OeSearchBox } from './OeSearchBox';
import { TURNSTILE_ENABLED, TurnstileWidget } from './TurnstileWidget';
import {
  buildRfqSubmitBody,
  readContactFromForm,
  validateRfq,
  type RfqContact,
} from '@/lib/rfq-payload';
import styles from './RfqForm.module.css';
import { applicationTextEn } from '@/lib/application-display';

interface ProductLite {
  product_id: string;
  bowen_no: string | null;
  product_type: string | null;
  vehicle_application_raw: string;
  first_oe: string | null;
  /** 该产品的第一条 application —— 从 URL 快捷进入时用来保留 application 级关联 */
  first_application_id: string | null;
}

const COUNTRIES = [
  'United States', 'Germany', 'United Kingdom', 'France', 'Italy', 'Spain', 'Netherlands',
  'Poland', 'Turkey', 'Russia', 'United Arab Emirates', 'Saudi Arabia', 'Egypt', 'South Africa',
  'Brazil', 'Mexico', 'Chile', 'Argentina', 'Australia', 'India', 'Thailand', 'Vietnam',
  'Malaysia', 'Indonesia', 'Japan', 'South Korea', 'Other',
];

/** 服务端字段名 → 表单控件名（少数几个不一致的集中在这里映射） */
const SERVER_TO_FORM_FIELD: Record<string, string> = {
  whatsapp_phone: 'whatsapp',
};

interface RfqApiSuccess {
  ok: true;
  inquiry_id: string;
  inquiry_number: string;
  message: string;
  notice?: string;
}

interface RfqApiFailure {
  ok: false;
  code: string;
  message: string;
  field_errors?: Record<string, string>;
}

type RfqApiResponse = RfqApiSuccess | RfqApiFailure;

export function RfqForm({
  preselect,
  products,
  contactEmail,
}: {
  preselect?: string;
  products: ProductLite[];
  /** 公司联系邮箱（来自 site-facts，避免在页面里重复硬编码） */
  contactEmail: string;
}) {
  const { lines, addLine, removeLine, updateLine, clear, ready } = useRfq();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [listErrors, setListErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<RfqApiSuccess | null>(null);
  /** Turnstile token；未配置验证码时始终为 null */
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  /** 自增值 → 让 Turnstile widget 重置（提交失败后允许重新验证） */
  const [turnstileReset, setTurnstileReset] = useState(0);
  /** 成功页展示用：提交时表单里的真实值（数据只留在浏览器里，不来自服务端回显） */
  const [submittedContact, setSubmittedContact] = useState<RfqContact | null>(null);

  const preselected = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  /**
   * 表单出现的时间戳，用于服务端"最短填写耗时"反垃圾检查。
   * 只在浏览器端赋值：SSR 阶段保持 null，避免服务端渲染与客户端不一致。
   */
  const formStartedAt = useRef<number | null>(null);
  if (formStartedAt.current === null && typeof window !== 'undefined') {
    formStartedAt.current = Date.now();
  }

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
        vehicle: applicationTextEn(p.vehicle_application_raw),
        engine: null,
        application_id: p.first_application_id,
      });
    }
    preselected.current = true;
  }, [ready, preselect, products, addLine]);

  const totalItems = lines.length;

  function currentSourcePage(): string {
    if (typeof window === 'undefined') return '/rfq';
    try {
      return `${window.location.pathname}${window.location.search}`;
    } catch {
      return '/rfq';
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return; // 防重复点击

    const form = e.currentTarget;
    const contact = readContactFromForm(form);
    const next = validateRfq(contact, totalItems);
    setErrors(next);
    setListErrors([]);
    setServerError(null);
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0];
      form.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }

    // 配置了 Turnstile 时必须先拿到 token；拿不到就不提交（服务端也会再校验一次）
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setErrors({ turnstile: 'Please complete the verification check before sending.' });
      return;
    }

    setSubmitting(true);
    const elapsedMs = formStartedAt.current ? Date.now() - formStartedAt.current : 0;
    const body = buildRfqSubmitBody(
      contact,
      lines.map((l) => ({
        product_id: l.product_id,
        bowen_no: l.bowen_no,
        product_type: l.product_type,
        matched_oe: l.matched_oe,
        vehicle: l.vehicle,
        application_id: l.application_id,
        quantity: l.quantity,
        remark: l.remark,
      })),
      { sourcePage: currentSourcePage(), elapsedMs, turnstileToken },
    );

    try {
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as RfqApiResponse | null;

      if (!data || data.ok !== true) {
        const failure = (data ?? null) as RfqApiFailure | null;
        const fieldErrors: Record<string, string> = {};
        const extra: string[] = [];
        for (const [key, message] of Object.entries(failure?.field_errors ?? {})) {
          if (key.startsWith('items')) {
            extra.push(message);
            continue;
          }
          fieldErrors[SERVER_TO_FORM_FIELD[key] ?? key] = message;
        }
        setErrors(fieldErrors);
        setListErrors(extra);
        setServerError(
          failure?.message
          ?? 'We could not send your enquiry just now. Please try again in a moment.',
        );
        // Turnstile 的 token 是一次性的：提交失败后必须重置，否则客户再也提交不成功
        if (TURNSTILE_ENABLED) {
          setTurnstileToken(null);
          setTurnstileReset((n) => n + 1);
        }
        setSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // 提交成功：记录询价号，并清空 RFQ 列表（表单输入在成功页不再需要）
      setSubmittedContact(contact);
      setResult(data);
      setErrors({});
      setListErrors([]);
      setServerError(null);
      clear();
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSubmitting(false);
      if (TURNSTILE_ENABLED) {
        setTurnstileToken(null);
        setTurnstileReset((n) => n + 1);
      }
      setServerError(
        `We could not reach the server. Please check your connection and try again, or email ${contactEmail} directly.`,
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /* ------------------------------------------------------------------ 成功页 */
  if (result) {
    return (
      <div className={styles.success} data-testid="rfq-success">
        <span className={styles.successIcon} aria-hidden="true">✓</span>
        <h2 className="h2">Enquiry received</h2>
        {/*
          成功页文案只陈述**可验证的事实**：询价已记录、并给出询价号。
          刻意不声称"邮件已发送 / 销售团队已收到 / 会收到确认邮件" ——
          服务端允许"已保存但邮件发送失败"（此时会带 notice 返回），
          无条件声称已发送会误导客户。
        */}
        <p className={styles.successLead} data-testid="rfq-success-lead">
          Thank you. Your enquiry has been recorded. Our sales team will reply by email.
        </p>

        <p className={styles.inquiryNumber}>
          <span>Inquiry Number</span>
          <strong className="mono" data-testid="rfq-inquiry-number">{result.inquiry_number}</strong>
        </p>

        {result.notice && (
          <div className={`notice noticeWarn ${styles.successNotice}`} data-testid="rfq-notice">
            {result.notice}
          </div>
        )}

        <div className={styles.contactSummary}>
          <h3 className="h4">Sent from</h3>
          <dl className={styles.contactList}>
            <div><dt>Name</dt><dd>{submittedContact?.name ?? '—'}</dd></div>
            <div><dt>Company</dt><dd>{submittedContact?.company ?? '—'}</dd></div>
            <div><dt>Country</dt><dd>{submittedContact?.country ?? '—'}</dd></div>
            <div><dt>Email</dt><dd className="mono">{submittedContact?.email ?? '—'}</dd></div>
          </dl>
          <p className={styles.contactHint}>
            Keep the inquiry number above for reference. If your sourcing list is long, you can email
            it to <a href={`mailto:${contactEmail}`}>{contactEmail}</a> and quote this number.
          </p>
        </div>

        <div className={styles.successActions}>
          <button
            type="button"
            className="btn btnGhost"
            onClick={() => {
              setResult(null);
              setSubmittedContact(null);
              window.scrollTo({ top: 0 });
            }}
          >
            Start a new RFQ
          </button>
          <Link href="/products" className="btn btnNavy">Continue browsing</Link>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------------------- 表单 */
  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
      ref={formRef}
      data-testid="rfq-form"
    >
      {serverError && (
        <div className={`notice noticeWarn ${styles.formNotice}`} role="alert" data-testid="rfq-error">
          <strong>Not sent.</strong> {serverError}
        </div>
      )}
      {listErrors.length > 0 && (
        <ul className={styles.listErrors}>
          {listErrors.map((m) => <li key={m}>{m}</li>)}
        </ul>
      )}

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
                      <dt>Vehicle / Application</dt>
                      <dd>{l.vehicle || '—'}</dd>
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
                        maxLength={60}
                      />
                    </label>
                    <label>
                      <span>Remark</span>
                      <input
                        className="input"
                        value={l.remark}
                        onChange={(e) => updateLine(i, { remark: e.target.value })}
                        placeholder="optional"
                        maxLength={240}
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
          <Field label="Name" name="name" required error={errors.name} autoComplete="name" maxLength={120} />
          <Field label="Company" name="company" required error={errors.company} autoComplete="organization" maxLength={160} />
          <div className="field">
            <label className="label" htmlFor="country">Country<span className="req">*</span></label>
            <select id="country" name="country" className="select" defaultValue="">
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.country && <span className={styles.error} id="country-error">{errors.country}</span>}
          </div>
          <Field label="Email" name="email" type="email" required error={errors.email} autoComplete="email" maxLength={200} />
          <Field label="WhatsApp / Phone" name="whatsapp" type="tel" error={errors.whatsapp} autoComplete="tel" maxLength={60} />
          <Field label="Website (optional)" name="website" error={errors.website} autoComplete="url" maxLength={300} />
        </div>

        {/*
          honeypot：真实用户看不到也 Tab 不到；机器人自动填满所有输入框时会被服务端拒绝。
          服务端字段名见 src/lib/rfq/constants.ts 的 HONEYPOT_FIELD。
        */}
        <div className={styles.honeypot} aria-hidden="true">
          <label htmlFor="fax">Fax number</label>
          <input id="fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
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
            maxLength={5000}
            placeholder={
              'Paste your sourcing list here — OE numbers, Bowen numbers, quantities, target price.\n'
              + 'Example:\n2550035540 x 300\n4711306950 x 500\n9091603092 x 200'
            }
            rows={7}
          />
          {errors.message && <span className={styles.error} id="message-error">{errors.message}</span>}
          <span className="hint">
            Pasting a list here is the fastest route. One OE number per line works fine.
          </span>
          {/*
            Phase 5.1：原来的文件选择框已删除。
            它此前既不真实上传、也不进入 API 与邮件，却要求客户"回复确认邮件并附上文件"，
            这条流程实际上无法完成。这里改为给出两条确实可行的路径。
          */}
          <p className={styles.longListHint} data-testid="rfq-long-list-hint">
            For long sourcing lists, paste the key OE numbers in the message field or email the file
            directly to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </div>

        <div className={styles.consentBlock}>
          <label className={styles.consent}>
            <input
              type="checkbox"
              name="consent"
              aria-describedby={errors.consent ? 'consent-error' : undefined}
            />
            <span>
              I have read the Privacy Policy and agree that Bowen may use the details I entered to
              answer this enquiry.
            </span>
          </label>
          <p className={styles.consentLinks}>
            Read the <Link href="/privacy">Privacy Policy</Link> and the <Link href="/terms">Terms of Use</Link>.
          </p>
          {errors.consent && <span className={styles.error} id="consent-error">{errors.consent}</span>}
        </div>

        {/* Turnstile：未配置 NEXT_PUBLIC_TURNSTILE_SITE_KEY 时组件返回 null，不显示也不加载任何外部脚本 */}
        <TurnstileWidget
          onToken={setTurnstileToken}
          resetSignal={turnstileReset}
        />
        {errors.turnstile && (
          <span className={styles.error} data-testid="turnstile-error">{errors.turnstile}</span>
        )}
      </section>

      <div className={styles.submitRow}>
        <button
          type="submit"
          className="btn btnPrimary btnLg"
          disabled={submitting}
          data-testid="rfq-submit"
        >
          {submitting ? 'Sending…' : 'Send RFQ'}
        </button>
        <p className={styles.submitNote}>
          {submitting
            ? 'Sending your enquiry — please keep this page open.'
            : 'We use your details only to answer this enquiry and never publish them. Our sales team will reply by email.'}
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
  label, name, type = 'text', required, error, autoComplete, maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  error?: string;
  autoComplete?: string;
  maxLength?: number;
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
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && <span className={styles.error} id={`${name}-error`}>{error}</span>}
    </div>
  );
}
