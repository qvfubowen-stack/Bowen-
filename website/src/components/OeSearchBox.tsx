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
      {/*
        注意：这里刻意不使用 <form>。
        本组件会被嵌进别的表单里（例如 RFQ 页的「再查一个 OE」区块），
        而 HTML 不允许 <form> 嵌套 <form> —— 嵌套会导致
        "In HTML, <form> cannot be a descendant of <form>" 并让整页 hydration 失败。
        因此改用 role="search" + 手动处理 Enter 键，语义与可访问性保持等价。
      */}
      <div className={styles.form} role="search">
        <label className="srOnly" htmlFor={`oe-input-${size}`}>OE Number</label>
        <input
          id={`oe-input-${size}`}
          className={styles.input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go(value);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus={autoFocus}
          spellCheck={false}
          inputMode="search"
        />
        <button type="button" className={styles.button} onClick={() => go(value)}>
          {submitLabel}
        </button>
      </div>

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
