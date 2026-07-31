import Link from "next/link";

// INTEGRATION HANDOFF: this is only a Person 1 runtime placeholder.
// Person 2 owns `/` and must replace this entire file with the 3D landing page.
export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-intro">
        <p className="context-line">Voice-first incident operations</p>
        <h1>Steward stays with the problem until there is proof.</h1>
        <p>
          Call from a phone or start in the browser. Steward troubleshoots, contacts approved vendors,
          acts inside budget, and records what actually happened.
        </p>
        <div className="action-row">
          <Link href="/voice" className="button button-primary">Start a voice session</Link>
          <Link href="/owner/demo" className="button button-secondary">Open owner control</Link>
        </div>
      </section>
      <aside className="proof-loop" aria-label="Steward incident loop">
        <ol>
          <li><span>01</span><strong>Listen</strong><small>One active incident goal</small></li>
          <li><span>02</span><strong>Act</strong><small>Real tools and approved contacts</small></li>
          <li><span>03</span><strong>Verify</strong><small>Evidence before resolution</small></li>
        </ol>
      </aside>
    </main>
  );
}
