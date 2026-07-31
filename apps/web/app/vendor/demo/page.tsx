import { VendorConsole } from "./vendor-console";

export default function VendorDemoPage() {
  return (
    <main className="operate-shell narrow-operate">
      <header className="operate-header">
        <div>
          <p className="context-line">Vendor handoff</p>
          <h1>Say exactly<br />what you can do.</h1>
          <p>A live quote keeps unknown fields unknown. Nothing is accepted or paid just because a call was answered.</p>
        </div>
        <span className="status-chip">Controlled demo</span>
      </header>
      <VendorConsole />
    </main>
  );
}
