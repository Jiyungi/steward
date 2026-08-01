import type { Metadata } from "next";
import Link from "next/link";

import { StewardLogo } from "../../components/steward-logo";
import styles from "./demo.module.css";

export const metadata: Metadata = {
  title: "Live demo",
  description: "Try Steward as a guest or receive a real vendor call.",
};

export default function DemoPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Demo navigation">
        <Link className={styles.brand} href="/" aria-label="Steward home">
          <StewardLogo markClassName={styles.mark} />
        </Link>
        <Link className={styles.back} href="/">Back home</Link>
      </nav>

      <section className={styles.intro} aria-labelledby="demo-title">
        <h1 id="demo-title">Try Steward live.</h1>
        <p>Choose which side of the incident you want to experience.</p>
      </section>

      <div className={styles.choices}>
        <section className={styles.choice}>
          <div>
            <h2>Guest support</h2>
            <p>Report a property problem by voice and share your camera only if Steward asks.</p>
          </div>
          <Link className={styles.primaryAction} href="/voice">Start guest call</Link>
        </section>

        <section className={styles.choice}>
          <div>
            <h2>Vendor negotiation</h2>
            <p>Verify your phone, receive a real call from Steward, and give a live quote.</p>
          </div>
          <Link className={styles.secondaryAction} href="/owner/demo">Use my phone</Link>
        </section>
      </div>
    </main>
  );
}
