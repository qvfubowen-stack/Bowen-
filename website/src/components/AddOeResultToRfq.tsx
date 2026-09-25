'use client';

import { useState } from 'react';
import { useRfq } from './rfq-context';
import styles from './AddOeResultToRfq.module.css';

/** OE 搜索结果页的「加入 RFQ」按钮：直接带入匹配到的 OE 与对应 application */
export function AddOeResultToRfq(props: {
  productId: string;
  bowenNo: string;
  productType: string | null;
  matchedOe: string;
  vehicle: string | null;
  engine: string | null;
  applicationId: string | null;
}) {
  const { addLine, lines } = useRfq();
  const [added, setAdded] = useState(false);

  const already = lines.some(
    (l) => l.product_id === props.productId && l.matched_oe === props.matchedOe
      && (l.application_id ?? null) === (props.applicationId ?? null),
  );

  function add() {
    addLine({
      product_id: props.productId,
      bowen_no: props.bowenNo,
      product_type: props.productType,
      matched_oe: props.matchedOe,
      vehicle: props.vehicle,
      engine: props.engine,
      application_id: props.applicationId,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2400);
  }

  return (
    <button
      type="button"
      className={`btn btnNavy btnSm ${styles.btn}`}
      onClick={add}
      data-added={added || undefined}
    >
      {added ? '✓ Added' : already ? 'In RFQ' : 'Add to RFQ'}
    </button>
  );
}
