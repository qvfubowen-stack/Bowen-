'use client';

import Link from 'next/link';
import { useRfq } from './rfq-context';
import styles from './RfqBar.module.css';

/** 底部悬浮的 RFQ 汇总条：产品页「Add to RFQ」后立即出现，明确告诉用户已带入什么 */
export function RfqBar() {
  const { count, lines, ready } = useRfq();
  if (!ready || count === 0) return null;

  const last = lines[lines.length - 1];

  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <div className={`container ${styles.inner}`}>
        <div className={styles.info}>
          <span className={styles.count}>{count}</span>
          <span className={styles.text}>
            <strong>{count === 1 ? 'item' : 'items'} in your RFQ list</strong>
            {last && (
              <small>
                Last added: Bowen {last.bowen_no}
                {last.matched_oe ? ` · OE ${last.matched_oe}` : ''}
                {last.vehicle ? ` · ${truncate(last.vehicle, 46)}` : ''}
              </small>
            )}
          </span>
        </div>
        <div className={styles.actions}>
          <Link href="/rfq" className="btn btnPrimary btnSm">Review &amp; Request Quote</Link>
        </div>
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
