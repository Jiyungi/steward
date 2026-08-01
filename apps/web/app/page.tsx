import Link from "next/link";

import { SceneShell } from "../components/landing/scene-shell";
import { StewardLogo } from "../components/steward-logo";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <main className={`${styles.landing} landing-theme`}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link className={styles.brand} href="/" aria-label="Steward home">
          <StewardLogo markClassName={styles.mark} />
        </Link>
        <div className={styles.navLinks}>
          <Link className={styles.navLink} href="/owner">Owner workspace</Link>
          <Link className={styles.navLink} href="/vendor/demo">Vendor workspace</Link>
        </div>
      </nav>

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.sceneRegion}>
          <SceneShell />
        </div>

        <div className={styles.heroCopy}>
          <h1 id="landing-title">When something breaks, call Steward.</h1>
          <p className={styles.summary}>
            We help your guest, contact approved vendors, and follow the job through.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/voice">Try the live call</Link>
            <Link className={styles.secondaryAction} href="/owner">Open owner workspace</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
