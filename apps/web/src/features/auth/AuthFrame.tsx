import type { ReactNode } from "react";
import { House, Newspaper, ShieldCheck } from "lucide-react";
import styles from "./Access.module.css";

export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className={styles.access}>
      <section
        className={`${styles.identity} ${styles.authIdentity}`}
        aria-label="Bellefort Estates"
      >
        <div className={styles.brand}>
          <img
            className={`${styles.officialLogo} ${styles.authLogoWhite}`}
            src="/brand/bellefort-logo-white.png"
            alt="Bellefort Estates"
            width="479"
            height="212"
          />
          <img
            className={`${styles.officialLogo} ${styles.authLogoLight}`}
            src="/brand/bellefort-logo.png"
            alt="Bellefort Estates"
            width="479"
            height="212"
          />
        </div>
        <div>
          <p className="eyebrow">YOUR HOME. YOUR COMMUNITY.</p>
          <p className={styles.identityTitle}>A little closer to home.</p>
          <p>One place for your household and your neighborhood.</p>
          <div className={styles.highlights}>
            <span>
              <House size={24} />
              Your household
            </span>
            <span>
              <Newspaper size={24} />
              Community updates
            </span>
            <span>
              <ShieldCheck size={24} />
              Member access
            </span>
          </div>
        </div>
        <p className="small">Bellefort Estates · Bacoor, Cavite</p>
      </section>
      <section className={styles.panel}>
        <div className={styles.card}>{children}</div>
      </section>
    </main>
  );
}
