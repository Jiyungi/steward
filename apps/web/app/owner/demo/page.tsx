import { OwnerConsole } from "./owner-console";

export default function OwnerDemoPage() {
  return (
    <main className="operate-shell">
      <header className="operate-header">
        <div>
          <p className="context-line">Owner control</p>
          <h1>One incident.<br />Every action visible.</h1>
          <p>Enroll a controlled phone, contact the approved vendor, and see what Steward can honestly verify.</p>
        </div>
        <span className="status-chip">Demo rails</span>
      </header>
      <OwnerConsole />
    </main>
  );
}
