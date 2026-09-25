'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './OeSearchBox.module.css';

interface Props {
  /** 首页/侧栏用 large，头部用 compact */
  size?: 'compact' | 'large';
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
  /** 直接跳到 Products 列表（按 OE 搜索）而不是 OE Search 结果页 */
  mode?: 'oe' | 'products';
  autoFocus?: boolean;
  /** dark = 放在深色背景上；light = 放在白色/浅色卡片上 */
  tone?: 'dark' | 'light';
}

const EXAMPLES = ['2550035540', '4711306950', '056121113D', '9091603092'];

export function OeSearchBox({
  size = 'large',
  defaultValue = '',
  placeholder = 'Enter OE Number — e.g. 2550035540 or 25500-35540',
  submitLabel = 'Search OE',
  mode = 'oe',
  autoFocus = false,
  tone = 'dark',
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function go(q: string) {
    const query = q.trim();
    if (!query) return;
    router.push(
      mode === 'oe'
        ? `/oe-search?q=${encodeURIComponent(query)}`
        : `/products?q=${encodeURIComponent(query)}`,
    );
  }

  return (
    <div
      className={[
        styles.wrap,
        size === 'large' ? styles.large : styles.compact,
        tone === 'light' ? styles.light : styles.dark,
      ].join(' ')}
    >
      <form
        className={styles.form}
        onSubmit={(e) => { e.preventDefault(); go(value); }}
        role="search"
      >
        <label className="srOnly" htmlFor={`oe-input-${size}`}>OE Number</label>
        <input
          id={`oe-input-${size}`}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          inputMode="search"
        />
        <button type="submit" className={styles.button}>{submitLabel}</button>
      </form>

      {size === 'large' && (
        <p className={styles.examples}>
          <span className={styles.examplesLabel}>Try a real OE from our database:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className={styles.example} onClick={() => { setValue(ex); go(ex); }}>
              {ex}
            </button>
          ))}
        </p>
      )}

      <p className={styles.hint}>
        Spaces, dashes and slashes are ignored — <span className="mono">25500-35540</span>,{' '}
        <span className="mono">2550035540</span>, <span className="mono">25500 35540</span> and{' '}
        <span className="mono">25500/35540</span> all find the same part.
      </p>
    </div>
  );
}
