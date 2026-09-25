import Link from 'next/link';
import styles from './SiteFooter.module.css';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brandCol}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">BW</span>
            <span>
              <strong>BOWEN</strong>
              <small>Thermostat Manufacturing</small>
            </span>
          </div>
          <p className={styles.blurb}>
            Automotive thermostat manufacturer since 2009. Supplying importers, wholesalers and
            aftermarket distributors worldwide.
          </p>
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
            <li><Link href="/blog">Blog</Link></li>
          </ul>
        </nav>

        <nav className={styles.col} aria-label="Contact">
          <h3>Contact</h3>
          <ul>
            <li><Link href="/rfq">Request a Quote</Link></li>
            <li><Link href="/contact">Contact Us</Link></li>
            <li><a href="mailto:sales@bowen-thermostat.com">sales@bowen-thermostat.com</a></li>
          </ul>
        </nav>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>© {year} Bowen. All rights reserved.</p>
        <p className={styles.phase}>
          UI Prototype — Phase 3 · Not published · No index
        </p>
      </div>
    </footer>
  );
}
