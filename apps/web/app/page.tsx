import Link from "next/link";

import { SceneShell } from "../components/landing/scene-shell";
import styles from "./landing.module.css";

function StewardMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className={`${styles.landing} landing-theme`}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link className={styles.brand} href="/" aria-label="Steward home">
          <StewardMark />
          <span>Steward</span>
        </Link>
        <Link className={styles.navLink} href="/guest?access=valid&fixture=resolved">
          Guest access
        </Link>
      </nav>

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Property care, in motion</p>
          <h1 id="landing-title">Every signal, carried through.</h1>
          <p className={styles.summary}>
            Steward listens, coordinates the right action, and closes the loop with evidence.
          </p>
          <Link className={styles.primaryAction} href="/guest?access=demo-entry&fixture=resolved">
            Open guest demo
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className={styles.sceneRegion}>
          <SceneShell />
          <div className={styles.sceneLabels} aria-hidden="true">
            <span className={styles.signalLabel}>Guest signal</span>
            <span className={styles.stewardLabel}>Steward</span>
            <span className={styles.actionLabel}>Action</span>
            <span className={styles.evidenceLabel}>Evidence</span>
          </div>
        </div>

        <p className={styles.storyNote}>
          An illustrative system view. Each real incident follows its own evidence.
        </p>
      </section>
    </main>
  );
}
