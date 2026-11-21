import type { Metadata } from "next";
import styles from "./maintenance.module.css";

export const metadata: Metadata = {
  title: "Temporarily unavailable | Did Hamza Play?",
  description: "Did Hamza Play? is temporarily unavailable while maintenance is underway.",
  robots: { index: false, follow: false }
};

export default function MaintenancePage() {
  return (
    <main className={`${styles.page} ${styles.hamza}`}>
      <div className={styles.shell}>
        <section className={styles.card} aria-labelledby="maintenance-heading">
          <p className={styles.brand}>
            DID <span className={styles.brandAccent}>HAMZA</span> PLAY?
          </p>

          <div className={styles.status}>
            <span className={styles.statusDot} aria-hidden="true" />
            Maintenance mode
          </div>

          <div className={styles.iconWrap} aria-hidden="true">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
              <path d="M14.7 6.3a5 5 0 0 0-6.6 6.6l-4.8 4.8a2 2 0 0 0 2.8 2.8l4.8-4.8a5 5 0 0 0 6.6-6.6l-3 3-3.1-3.1 3.3-2.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="m15.8 15.8 3.4 3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </div>

          <h1 id="maintenance-heading" className={styles.heading}>
            Temporarily unavailable
          </h1>
          <p className={styles.description}>
            This site is temporarily offline while we carry out maintenance or resolve a technical issue.
            The site will be available again once the work is complete.
          </p>
          <p className={styles.note}>Please check back later.</p>
        </section>

        <footer className={styles.footer}>Did Hamza Play?</footer>
      </div>
    </main>
  );
}
