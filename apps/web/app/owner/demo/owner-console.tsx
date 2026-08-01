"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Vendor {
  id: string;
  name: string;
  priority: number;
  contact: null | { id: string; label: string; phoneLast4: string; verificationStatus: string };
}

interface OwnerSnapshot {
  incident: null | {
    id: string;
    goal: string;
    state: string;
    risk: string;
    budget: { currency: string; authorizedMinor: number; spentMinor: number };
    outcome: unknown | null;
  };
  events: Array<{ sequence: number; event: { type: string; occurredAt: string; payload: Record<string, unknown> } }>;
  vendors: Vendor[];
  evidence: Array<{ id: string; kind: string; summary: string; verified_by: string | null; created_at: string }>;
  payments: Array<{ payment: { id: string; amountMinor: number; currency: string; status: string }; webhook_verified_at: string | null }>;
  operations: Array<{ operation_id: string; provider: string; operation: string; status: string; normalized_result: unknown; started_at: string; completed_at: string | null }>;
  quotes: Array<{ vendorId: string; amountMinor: number | null; currency: string; availability: string; unresolvedFields: string[] }>;
}

const EMPTY: OwnerSnapshot = { incident: null, events: [], vendors: [], evidence: [], payments: [], operations: [], quotes: [] };

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T & {
    error?: { message?: string };
    result?: { error?: { safeMessage?: string } };
  };
  if (!response.ok) {
    throw new Error(
      body.result?.error?.safeMessage ??
      body.error?.message ??
      "The action could not be completed.",
    );
  }
  return body;
}

function newActionKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    "incident.created": "Incident opened",
    "tool.started": "Tool action started",
    "tool.completed": "Tool action completed",
    "vision.requested": "Camera requested",
    "vision.permission.updated": "Camera choice recorded",
    "evidence.recorded": "Evidence recorded",
    "vendor.call.started": "Vendor call started",
    "vendor.quote.recorded": "Vendor quote recorded",
    "payment.started": "Test payment started",
    "payment.updated": "Payment updated",
    "incident.resolved": "Resolution verified",
  };
  return labels[type] ?? type.replaceAll(".", " ");
}

export function OwnerConsole() {
  const [snapshot, setSnapshot] = useState<OwnerSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [demoEmail, setDemoEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("Demo vendor");
  const [code, setCode] = useState("");
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await jsonRequest<OwnerSnapshot>("/api/owner/demo", { cache: "no-store" }));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Timeline could not load." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const verifiedVendor = useMemo(
    () => snapshot.vendors.find((vendor) => vendor.contact?.verificationStatus === "verified") ?? null,
    [snapshot.vendors],
  );
  const latestQuote = snapshot.quotes.at(-1) ?? null;

  async function initializeDemo() {
    setBusy("initialize"); setNotice(null);
    try {
      const guest = await jsonRequest<{ session: { id: string } }>("/api/guest/demo-session", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: demoEmail }),
      });
      await jsonRequest("/api/incidents", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ guestSessionId: guest.session.id, goal: "Judge-created live property incident", authorizedMinor: 25000 }),
      });
      setNotice({ kind: "ok", text: "Demo incident created. You can now verify a controlled vendor phone." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Demo incident could not be created." });
    } finally { setBusy(null); }
  }

  async function requestOtp() {
    if (snapshot.incident === null) return;
    setBusy("otp-request"); setNotice(null);
    try {
      const phoneE164 = phone.replace(/[\s()-]/g, "");
      const body = await jsonRequest<{ contactId: string; phoneLast4: string }>("/api/a1/verification/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ incidentId: snapshot.incident.id, phoneE164, label, idempotencyKey: newActionKey("verify-request") }),
      });
      setPendingContactId(body.contactId);
      setNotice({ kind: "ok", text: `a1mobile accepted the OTP request for the number ending ${body.phoneLast4}.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "OTP request failed." });
    } finally { setBusy(null); }
  }

  async function confirmOtp() {
    if (snapshot.incident === null || pendingContactId === null) return;
    setBusy("otp-confirm"); setNotice(null);
    try {
      await jsonRequest("/api/a1/verification/confirm", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ incidentId: snapshot.incident.id, contactId: pendingContactId, code, idempotencyKey: newActionKey("verify-confirm") }),
      });
      setNotice({ kind: "ok", text: "Phone verified and saved as this property’s first approved demo vendor." });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Verification failed." });
    } finally { setBusy(null); }
  }

  async function runAction(kind: "sms" | "call" | "payment") {
    if (snapshot.incident === null || verifiedVendor === null) return;
    setBusy(kind); setNotice(null);
    const url = `/api/incidents/${encodeURIComponent(snapshot.incident.id)}/actions/${kind}`;
    const payload = kind === "sms"
      ? { contactId: verifiedVendor.contact!.id, idempotencyKey: newActionKey("sms") }
      : kind === "call"
        ? { vendorId: verifiedVendor.id, idempotencyKey: newActionKey("call") }
        : { vendorId: verifiedVendor.id };
    try {
      const response = await jsonRequest<{ verification?: string; result: { status: string; data?: { callId?: string } } }>(url, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const text = kind === "sms"
        ? "a1mobile accepted the incident update. Delivery remains unknown until confirmed by the recipient."
        : kind === "call"
          ? "The controlled vendor answered. This does not mean they accepted the job; record their live quote next."
          : "Stripe accepted the test payment. Steward is waiting for the signed webhook before calling it verified.";
      setNotice({ kind: "ok", text: `${text} (${response.result.status})` });
      await refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : `${kind} failed.` });
      await refresh();
    } finally { setBusy(null); }
  }

  return (
    <div className="operate-grid">
      <div>
        {snapshot.incident === null ? (
          <section className="section-block">
            <h2>Initialize the demo</h2>
            <p>This creates a temporary judge session and a real persisted incident. It does not pretend an Airbnb booking exists.</p>
            <div className="inline-fields">
              <label className="field-stack"><span>Judge email</span><input type="email" value={demoEmail} onChange={(event) => setDemoEmail(event.target.value)} placeholder="judge@example.com" /></label>
              <button className="button button-primary" type="button" onClick={initializeDemo} disabled={busy !== null || demoEmail === ""}>Create incident</button>
            </div>
          </section>
        ) : (
          <>
            <section className="section-block">
              <h2>Verify your phone</h2>
              <div className="field-stack">
                <label>Vendor name<input value={label} onChange={(event) => setLabel(event.target.value)} /></label>
                <div className="inline-fields">
                  <label>Phone number (+country code)<input type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 415 555 0123" /></label>
                  <button className="button button-primary" type="button" onClick={requestOtp} disabled={busy !== null || !/^\+[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""))}>Text me a code</button>
                </div>
                {pendingContactId !== null ? (
                  <div className="inline-fields">
                    <label>Code from the phone<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} /></label>
                    <button className="button button-primary" type="button" onClick={confirmOtp} disabled={busy !== null || !/^\d{4,8}$/.test(code)}>Confirm number</button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="section-block">
              <h2>Call the vendor</h2>
              <div className="approved-row">
                <div>
                  <strong>{verifiedVendor?.name ?? "No verified vendor yet"}</strong>
                  <span>{verifiedVendor?.contact ? `Verified ·•••• ${verifiedVendor.contact.phoneLast4}` : "Complete phone verification to enable actions"}</span>
                </div>
                <span className="priority-label">Priority {verifiedVendor?.priority ?? "—"}</span>
              </div>
              <div className="action-row spaced-actions">
                <button className="button button-secondary" type="button" onClick={() => runAction("sms")} disabled={busy !== null || verifiedVendor === null}>Send real SMS</button>
                <button className="button button-secondary" type="button" onClick={() => runAction("call")} disabled={busy !== null || verifiedVendor === null}>Call vendor</button>
                <button className="button button-primary" type="button" onClick={() => runAction("payment")} disabled={busy !== null || latestQuote?.amountMinor == null || latestQuote.availability !== "available"}>Pay quote in Stripe test mode</button>
              </div>
            </section>

            <section className="section-block">
              <h2>Incident timeline</h2>
              <p>{loading ? "Loading recorded events…" : `${snapshot.events.length} persisted events, in order.`}</p>
              <ol className="timeline">
                {[...snapshot.events].reverse().map(({ sequence, event }) => (
                  <li key={`${sequence}-${event.type}`}>
                    <span className="timeline-marker" aria-hidden="true" />
                    <div><strong>{eventLabel(event.type)}</strong><p>Recorded as {event.type}</p></div>
                    <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>

      <aside>
        <section className="section-block incident-brief">
          <h2>Current incident</h2>
          <div className="metric-line"><span>State</span><strong>{snapshot.incident?.state ?? "Not started"}</strong></div>
          <div className="metric-line"><span>Risk</span><strong>{snapshot.incident?.risk ?? "Unknown"}</strong></div>
          <div className="metric-line"><span>Budget</span><strong>{snapshot.incident ? `$${(snapshot.incident.budget.authorizedMinor / 100).toFixed(2)}` : "—"}</strong></div>
          <div className="metric-line"><span>Evidence</span><strong>{snapshot.evidence.length}</strong></div>
          <div className="metric-line"><span>Resolution</span><strong>{snapshot.incident?.outcome ? "Verified" : "Not verified"}</strong></div>
        </section>
        {latestQuote !== null ? (
          <section className="section-block">
            <h2>Latest live quote</h2>
            <div className="metric-line"><span>Amount</span><strong>{latestQuote.amountMinor === null ? "Missing" : `$${(latestQuote.amountMinor / 100).toFixed(2)}`}</strong></div>
            <div className="metric-line"><span>Availability</span><strong>{latestQuote.availability}</strong></div>
            <p className="unresolved">Unresolved: {latestQuote.unresolvedFields.join(", ") || "none"}</p>
          </section>
        ) : null}
        {snapshot.payments.map(({ payment, webhook_verified_at: verifiedAt }) => (
          <section className="section-block" key={payment.id}>
            <h2>Payment</h2>
            <div className="metric-line"><span>Stripe state</span><strong>{payment.status}</strong></div>
            <div className="metric-line"><span>Signed webhook</span><strong>{verifiedAt ? "Verified" : "Waiting"}</strong></div>
          </section>
        ))}
        {notice !== null ? <div className={`notice${notice.kind === "error" ? " error" : ""}`} role="status">{notice.text}</div> : null}
      </aside>
    </div>
  );
}
