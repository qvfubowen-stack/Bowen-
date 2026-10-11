'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { MakeSummary } from '@/lib/types';
import styles from './MakeExplorer.module.css';

const INITIAL = 12;

export function MakeExplorer({ makes }: { makes: MakeSummary[] }) {
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.trim().toUpperCase();
    if (!q) return makes;
    return makes.filter((m) => m.make.toUpperCase().includes(q));
  }, [makes, filter]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL);

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <label className="srOnly" htmlFor="make-filter">Filter vehicle makes</label>
        <input
          id="make-filter"
          className={styles.filter}
          placeholder="Filter makes — e.g. Volkswagen, Toyota, 大众"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoComplete="off"
        />
        <span className={styles.count}>
          {filtered.length} of {makes.length} makes
        </span>
      </div>

      {visible.length === 0 ? (
        <p className={styles.empty}>
          No make matches “{filter}”. Clear the filter or search by OE number instead.
        </p>
      ) : (
        <ul className={styles.grid}>
          {visible.map((m) => (
            <li key={m.make} className={styles.item}>
              <Link href={`/products?make=${encodeURIComponent(m.make)}`} className={styles.link}>
                <span className={styles.makeName}>{m.make}</span>
                <span className={styles.makeMeta}>{m.productCount} products</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > INITIAL && (
        <div className={styles.more}>
          <button type="button" className="btn btnGhost btnSm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer' : `Show all ${filtered.length} makes`}
          </button>
        </div>
      )}
    </div>
  );
}
