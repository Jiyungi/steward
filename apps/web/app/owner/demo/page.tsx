import Link from "next/link";

import { StewardLogo } from "../../../components/steward-logo";
import { OwnerConsole } from "./owner-console";

export default function OwnerDemoPage() {
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Steward home">
          <StewardLogo markClassName="wordmark-logo" />
        </Link>
        <nav aria-label="Demo navigation">
          <Link href="/demo">All demos</Link>
          <Link href="/owner/demo" aria-current="page">Vendor call</Link>
        </nav>
        <span className="system-state"><span aria-hidden="true" />Live demo</span>
      </header>
      <main className="operate-shell">
        <header className="operate-header">
          <div>
            <h1>Vendor negotiation</h1>
            <p>Verify your number, answer Steward's call, and give a real quote.</p>
          </div>
          <span className="status-chip">Demo</span>
        </header>
        <OwnerConsole />
      </main>
    </>
  );
}
