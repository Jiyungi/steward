import { VendorConsole } from "./vendor-console";

export default function VendorDemoPage() {
  return (
    <main className="operate-shell narrow-operate">
      <header className="operate-header">
        <div>
          <h1>Quote the job</h1>
          <p>Record what you can provide.</p>
        </div>
        <span className="status-chip">Demo</span>
      </header>
      <VendorConsole />
    </main>
  );
}
