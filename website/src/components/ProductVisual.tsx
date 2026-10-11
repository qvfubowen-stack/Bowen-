import styles from './ProductVisual.module.css';

/**
 * 产品视觉组件
 * ---------------------------------------------------------------------------
 * 只显示真实主图（tools/lib/publication-gate.mjs 选出的可靠主图）。
 *
 * Phase 4.1：没有可靠主图的产品**不会**进入网站数据集，
 * 因此占位图分支在公开页面实际上不可达；这里保留一个纯图形兜底，
 * 只为防御「数据被手工改坏」这一种情况，并且不写任何占位文案
 * （客户不该看到「本产品无图」这类内部说明）。
 */
export function ProductVisual({
  src,
  alt,
  label,
  size = 'md',
  priority = false,
}: {
  src?: string | null;
  /** 真实图片的 alt 文本（应包含 Bowen No. + 已核实产品名） */
  alt?: string;
  /** fallback 时用于 aria-label 的名称 */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
}) {
  if (src) {
    return (
      <div className={`${styles.visual} ${styles[size]} ${styles.hasPhoto}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? label ?? 'Bowen product photo'}
          className={styles.img}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      </div>
    );
  }

  return (
    <div
      className={`${styles.visual} ${styles[size]} ${styles.placeholder}`}
      role="img"
      aria-label={label ? `${label} — product photo` : 'Bowen product photo'}
    >
      <svg viewBox="0 0 120 120" className={styles.svg} aria-hidden="true">
        <circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        <circle cx="60" cy="60" r="28" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <circle cx="60" cy="60" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="60" cy="60" r="4" fill="currentColor" opacity="0.6" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={60 + Math.cos(a) * 40}
              y1={60 + Math.sin(a) * 40}
              x2={60 + Math.cos(a) * 46}
              y2={60 + Math.sin(a) * 46}
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.4"
            />
          );
        })}
      </svg>
    </div>
  );
}
