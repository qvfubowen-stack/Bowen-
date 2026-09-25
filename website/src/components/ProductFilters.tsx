'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './ProductFilters.module.css';

interface Props {
  typeOptions: { value: string; label: string; count: number }[];
  categories: { category: string; labelEn: string; productCount: number }[];
  makes: { make: string; productCount: number }[];
}

const ENGINE_SUGGESTIONS = ['EA111', 'EA211', 'EA888', '4G6', '476ZQA', '2RZ', '4JJ1', 'MR20', 'G4KE'];

export function ProductFilters({ typeOptions, categories, makes }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const [q, setQ] = useState(params.get('q') ?? '');
  const [type, setType] = useState(params.get('type') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? '');
  const [make, setMake] = useState(params.get('make') ?? '');
  const [engine, setEngine] = useState(params.get('engine') ?? '');

  // URL 变化时同步（浏览器前进/后退、从页脚链接跳进来）
  useEffect(() => { setQ(params.get('q') ?? ''); }, [params]);
  useEffect(() => { setType(params.get('type') ?? ''); }, [params]);
  useEffect(() => { setCategory(params.get('category') ?? ''); }, [params]);
  useEffect(() => { setMake(params.get('make') ?? ''); }, [params]);
  useEffect(() => { setEngine(params.get('engine') ?? ''); }, [params]);

  function apply(next?: Partial<{ q: string; type: string; category: string; make: string; engine: string }>) {
    const values = { q, type, category, make, engine, ...next };
    const sp = new URLSearchParams();
    if (values.q.trim()) sp.set('q', values.q.trim());
    if (values.type) sp.set('type', values.type);
    if (values.category) sp.set('category', values.category);
    if (values.make) sp.set('make', values.make);
    if (values.engine) sp.set('engine', values.engine);
    const qs = sp.toString();
    router.push(qs ? `/products?${qs}` : '/products');
  }

  function reset() {
    setQ(''); setType(''); setCategory(''); setMake(''); setEngine('');
    router.push('/products');
  }

  const activeCount = [q, type, category, make, engine].filter(Boolean).length;

  return (
    <form className={styles.panel} onSubmit={(e) => { e.preventDefault(); apply(); }}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Search &amp; filter</h2>
        {activeCount > 0 && (
          <button type="button" className={styles.reset} onClick={reset}>
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <div className="field">
        <label className="label" htmlFor="f-q">OE Number or Bowen No.</label>
        <input
          id="f-q"
          className={`input ${styles.mono}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="2550035540 or 3005"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="hint">Spaces, dashes and slashes are ignored.</span>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-type">Product type</label>
        <select id="f-type" className="select" value={type} onChange={(e) => { setType(e.target.value); apply({ type: e.target.value }); }}>
          <option value="">All types</option>
          {typeOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label} ({t.count})</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-category">Category</label>
        <select id="f-category" className="select" value={category} onChange={(e) => { setCategory(e.target.value); apply({ category: e.target.value }); }}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category}>{c.labelEn} ({c.productCount})</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-make">Vehicle make</label>
        <select id="f-make" className="select" value={make} onChange={(e) => { setMake(e.target.value); apply({ make: e.target.value }); }}>
          <option value="">All makes</option>
          {makes.map((m) => (
            <option key={m.make} value={m.make}>{m.make} ({m.productCount})</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="label" htmlFor="f-engine">Engine / application</label>
        <input
          id="f-engine"
          className={`input ${styles.mono}`}
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          placeholder="EA111, 4G6, 476ZQA…"
          autoComplete="off"
          list="engine-suggestions"
        />
        <datalist id="engine-suggestions">
          {ENGINE_SUGGESTIONS.map((e) => <option key={e} value={e} />)}
        </datalist>
      </div>

      <div className={styles.actions}>
        <button type="submit" className="btn btnNavy btnBlock">Apply filters</button>
      </div>
    </form>
  );
}
