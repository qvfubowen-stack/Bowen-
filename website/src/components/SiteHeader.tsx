'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './SiteHeader.module.css';

const NAV = [
  { href: '/products', label: 'Products' },
  { href: '/factory', label: 'Factory' },
  { href: '/quality', label: 'Quality' },
  { href: '/about', label: 'About Bowen' },
  { href: '/contact', label: 'Contact' },
];

/** 页头需要的公司资料子集（全部来自宣传手册，见 src/data/site-facts.json） */
export interface HeaderCompanyFacts {
  legal_name_en: string;
  email: string;
  tel_display: string;
  tel_href: string;
  since_year: number;
}

export function SiteHeader({ company }: { company: HeaderCompanyFacts }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [oe, setOe] = useState('');

  useEffect(() => { setOpen(false); }, [pathname]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = oe.trim();
    if (!q) return;
    router.push(`/oe-search?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className={styles.header}>
      <div className={`container ${styles.topbar}`}>
        <div className={styles.utility}>
          <span className={styles.utilityName}>{company.legal_name_en}</span>
          <span className={styles.utilityRight}>
            <a href={`tel:${company.tel_href}`}>{company.tel_display}</a>
            <span className={styles.utilitySep} aria-hidden="true">·</span>
            <a href={`mailto:${company.email}`}>{company.email}</a>
          </span>
        </div>
      </div>

      <div className={styles.mainbar}>
        <div className={`container ${styles.mainbarInner}`}>
          <Link href="/" className={styles.brand} aria-label="Bowen home">
            <span className={styles.brandMark} aria-hidden="true">BW</span>
            <span className={styles.brandText}>
              <strong>BOWEN</strong>
              <small>Automotive Thermostat Manufacturer</small>
            </span>
          </Link>

          <form className={styles.headerSearch} onSubmit={submit} role="search">
            <label className="srOnly" htmlFor="header-oe">Search by OE Number</label>
            <input
              id="header-oe"
              className={styles.headerSearchInput}
              placeholder="Search by OE Number / Bowen No."
              value={oe}
              onChange={(e) => setOe(e.target.value)}
              autoComplete="off"
              inputMode="search"
            />
            <button type="submit" className={styles.headerSearchBtn}>Search</button>
          </form>

          <div className={styles.actions}>
            <Link href="/rfq" className={`btn btnPrimary btnSm ${styles.rfqBtn}`}>Request a Quote</Link>
            <button
              type="button"
              className={styles.burger}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="srOnly">{open ? 'Close menu' : 'Open menu'}</span>
              <span className={`${styles.burgerLines} ${open ? styles.burgerOpen : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        <nav className={`container ${styles.nav}`} aria-label="Main">
          <ul className={styles.navList}>
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/');
              return (
                <li key={n.href}>
                  <Link href={n.href} className={active ? styles.navActive : undefined}>{n.label}</Link>
                </li>
              );
            })}
          </ul>
          <Link href="/products?type=Thermostat" className={styles.navCta}>Browse Thermostats</Link>
        </nav>

        {open && (
          <nav id="mobile-nav" className={styles.mobileNav} aria-label="Mobile">
            <form className={styles.mobileSearch} onSubmit={submit} role="search">
              <input
                className={styles.headerSearchInput}
                placeholder="Search by OE Number"
                value={oe}
                onChange={(e) => setOe(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className={styles.headerSearchBtn}>Go</button>
            </form>
            <ul>
              {NAV.map((n) => (
                <li key={n.href}><Link href={n.href}>{n.label}</Link></li>
              ))}
              <li><Link href="/products?type=Thermostat">Browse Thermostats</Link></li>
              <li><Link href="/rfq">Request a Quote</Link></li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
