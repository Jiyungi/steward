import { OwnerConsole } from "./owner-console";

export default function OwnerDemoPage() {
  return (
    <main className="operate-shell">
      <header className="operate-header">
        <div>
          <h1>Incident control</h1>
          <p>Phone, vendors, evidence, and payment.</p>
        </div>
        <span className="status-chip">Demo</span>
      </header>
      <OwnerConsole />
    </main>
  );
}
