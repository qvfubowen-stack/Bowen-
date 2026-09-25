import styles from './ProductVisual.module.css';

/**
 * 产品图占位。
 * ---------------------------------------------------------------------------
 * 最新版 Excel 的「图片」列是空的（没有任何产品照片），所以本阶段不展示假图片，
 * 而是用统一的工程图占位符，并明确标注「Photo pending」。
 * 原始数据一旦补上图片，把 src 传进来即可，组件会自动改成 <img>。
 */
export function ProductVisual({
  src,
  label,
  size = 'md',
}: {
  src?: string | null;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (src) {
    return (
      <div className={`${styles.visual} ${styles[size]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label ?? 'Product photo'} className={styles.img} />
      </div>
    );
  }

  return (
    <div className={`${styles.visual} ${styles[size]} ${styles.placeholder}`} role="img"
      aria-label={label ? `${label} — drawing placeholder` : 'Drawing placeholder'}>
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
      <span className={styles.flag}>Photo pending</span>
    </div>
  );
}
