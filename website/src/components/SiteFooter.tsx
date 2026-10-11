import Link from 'next/link';
import styles from './SiteFooter.module.css';

/** 页脚需要的公司资料子集（全部来自公司资料唯一权威来源） */
export interface FooterCompanyFacts {
  legal_name_en: string;
  legal_name_zh: string;
  email: string;
  tel_display: string;
  tel_href: string;
  since_year: number;
  /** 已由业务方确认可对外公开的街道地址 */
  address_en: string;
  domestic_marketplace_url: string;
  domestic_marketplace_label: string;
  domestic_marketplace_note: string;
}

export function SiteFooter({ company }: { company: FooterCompanyFacts }) {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brandCol}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">BW</span>
            <span>
              <strong>BOWEN</strong>
              <small>Automotive Thermostat Manufacturer</small>
            </span>
          </div>
          <p className={styles.blurb}>
            {company.legal_name_en} develops, manufactures and supplies automotive components,
            combining product research with in-house production and technical service.
          </p>
          <p className={styles.blurb}>Established in {company.since_year}, with a factory built and expanded in 2014.</p>
          <p className={styles.address}>{company.address_en}</p>
        </div>

        <nav className={styles.col} aria-label="Products">
          <h3>Products</h3>
          <ul>
            <li><Link href="/products?type=Thermostat">Thermostats</Link></li>
            <li><Link href="/products?category=temperature-sensors">Temperature Sensors</Link></li>
            <li><Link href="/products?category=automotive-switches">Automotive Switches</Link></li>
            <li><Link href="/products">All Products</Link></li>
            <li><Link href="/oe-search">OE Search</Link></li>
          </ul>
        </nav>

        <nav className={styles.col} aria-label="Company">
          <h3>Company</h3>
          <ul>
            <li><Link href="/about">About Bowen</Link></li>
            <li><Link href="/factory">Factory</Link></li>
            <li><Link href="/quality">Quality</Link></li>
          </ul>
        </nav>

        <nav className={styles.col} aria-label="Legal">
          <h3>Legal</h3>
          <ul>
            <li><Link href="/privacy">Privacy Policy</Link></li>
            <li><Link href="/terms">Terms of Use</Link></li>
          </ul>
        </nav>

        <nav className={styles.col} aria-label="Contact">
          <h3>Contact</h3>
          <ul>
            <li><Link href="/rfq">Request a Quote</Link></li>
            <li><Link href="/contact">Contact Us</Link></li>
            <li><a href={`mailto:${company.email}`}>{company.email}</a></li>
            <li><a href={`tel:${company.tel_href}`}>Tel {company.tel_display}</a></li>
          </ul>
        </nav>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>
          © {year} {company.legal_name_en}
          <span className={styles.legalZh}>{company.legal_name_zh}</span>
        </p>
      </div>

      {/* 1688 属于中国国内平台，放在页脚次要位置并明确标注，绝不当作海外官网域名 */}
      <div className={`container ${styles.marketNote}`}>
        <p>
          Domestic platform: <span>{company.domestic_marketplace_label}</span> — {company.domestic_marketplace_note}
        </p>
      </div>
    </footer>
  );
}
