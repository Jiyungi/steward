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
          <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.sceneRegion}>
          <SceneShell />
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            <span aria-hidden="true" />
            Property care, in motion
          </p>
          <h1 id="landing-title">Every signal, carried through.</h1>
          <p className={styles.summary}>
            Steward coordinates the right action and closes the loop with evidence.
          </p>
          <Link className={styles.primaryAction} href="/guest?access=demo-entry&fixture=resolved">
            Open guest demo
            <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <p className={styles.storyNote}>
          Illustrative system view <span aria-hidden="true">·</span> Move to inspect
        </p>
      </section>
    </main>
  );
}
