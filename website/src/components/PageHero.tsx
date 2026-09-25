import Link from 'next/link';
import styles from './PageHero.module.css';

export function PageHero({
  eyebrow,
  title,
  lead,
  crumbs,
  cta,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  crumbs: { label: string; href?: string }[];
  cta?: React.ReactNode;
}) {
  return (
    <section className={styles.hero}>
      <div className="container">
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`} className={styles.crumbItem}>
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <span className={styles.sep} aria-hidden="true">/</span>}
            </span>
          ))}
        </nav>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title}>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
        {cta && <div className={styles.cta}>{cta}</div>}
      </div>
    </section>
  );
}
