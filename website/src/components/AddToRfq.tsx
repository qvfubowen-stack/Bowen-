'use client';

import { useState } from 'react';
import type { Product, ProductApplication } from '@/lib/types';
import { useRfq } from './rfq-context';
import { OeSearchBox } from './OeSearchBox';
import styles from './AddToRfq.module.css';

/**
 * 「Add to RFQ」——自动带入 product_id / Bowen No. / Matched OE / Vehicle / Engine。
 * 用户可以先选定要询价的具体 application（一行），再决定数量。
 */
export function AddToRfq({
  product,
  applications,
}: {
  product: Product;
  applications: ProductApplication[];
}) {
  const { addLine, lines } = useRfq();
  const [selected, setSelected] = useState<string>(applications[0]?.application_id ?? '');
  const [quantity, setQuantity] = useState('');
  const [added, setAdded] = useState(false);

  const app = applications.find((a) => a.application_id === selected) ?? null;
  const matchedOe = app ? pickOe(app) : null;

  const already = lines.some(
    (l) => l.product_id === product.product_id && (l.application_id ?? null) === (app?.application_id ?? null),
  );

  function add() {
    addLine({
      product_id: product.product_id,
      bowen_no: product.bowen_no ?? '',
      product_type: product.product_type,
      matched_oe: matchedOe,
      vehicle: app?.vehicle_application_raw || null,
      engine: app?.engine_application ?? app?.vehicle_application_raw ?? null,
      application_id: app?.application_id ?? null,
      quantity,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2600);
  }

  return (
    <div className={styles.box}>
      <h2 className={styles.title}>Add to RFQ</h2>
      <p className={styles.sub}>
        Select the OE reference you need. Your RFQ will carry the Bowen No., the matched OE and the
        vehicle/engine application.
      </p>

      {applications.length > 0 && (
        <div className="field">
          <label className="label" htmlFor="rfq-app">OE reference / application</label>
          <select
            id="rfq-app"
            className="select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {applications.map((a) => {
              const oe = pickOe(a);
              return (
                <option key={a.application_id} value={a.application_id}>
                  {oe ?? '(no OE token)'} — {truncate(a.vehicle_application_raw || 'application not recorded', 56)}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div className="field">
        <label className="label" htmlFor="rfq-qty">Quantity (optional)</label>
        <input
          id="rfq-qty"
          className="input"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="e.g. 500 pcs / 1 container"
        />
      </div>

      <div className={styles.preview}>
        <div><span>Bowen No.</span><strong className="mono">{product.bowen_no}</strong></div>
        <div><span>Matched OE</span><strong className="mono">{matchedOe ?? '—'}</strong></div>
        <div><span>Vehicle / Engine</span><strong>{app?.vehicle_application_raw || '—'}</strong></div>
      </div>

      <button type="button" className="btn btnPrimary btnBlock" onClick={add} disabled={already && added}>
        {added ? '✓ Added to RFQ' : already ? 'Update RFQ item' : 'Add to RFQ'}
      </button>

      <p className={styles.or}>or</p>
      <OeSearchBox size="compact" tone="light" placeholder="Check another OE number" submitLabel="Search" mode="oe" />
    </div>
  );
}

/** 取该 application 的第一个 OE token 作为「Matched OE」展示 */
export function pickOe(a: ProductApplication): string | null {
  if (a.oe_tokens?.length) return a.oe_tokens[0];
  const m = a.oe_numbers_raw?.trim().match(/^\S+/);
  return m ? m[0] : null;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
