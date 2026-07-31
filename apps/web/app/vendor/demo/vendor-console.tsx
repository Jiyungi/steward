"use client";

import { useEffect, useMemo, useState } from "react";

interface Snapshot {
  incident: null | { id: string; goal: string; state: string };
  vendors: Array<{ id: string; name: string; contact: null | { verificationStatus: string } }>;
  operations: Array<{ operation: string; status: string; normalized_result: null | { data?: { callId?: string; vendorId?: string } } }>;
  quotes: Array<{ vendorId: string; amountMinor: number | null; availability: string; unresolvedFields: string[] }>;
  payments: Array<{ payment: { status: string; amountMinor: number; currency: string }; webhook_verified_at: string | null }>;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "The action could not be completed.");
  return body;
}

function localInputValue(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function VendorConsole() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [amount, setAmount] = useState("");
  const [availability, setAvailability] = useState<"available" | "unavailable" | "unknown">("available");
  const [startsAt, setStartsAt] = useState(localInputValue(new Date(Date.now() + 45 * 60_000)));
  const [endsAt, setEndsAt] = useState(localInputValue(new Date(Date.now() + 105 * 60_000)));
  const [scope, setScope] = useState("");
  const [guarantee, setGuarantee] = useState("");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  async function refresh() {
    try { setSnapshot(await requestJson<Snapshot>("/api/owner/demo", { cache: "no-store" })); }
    catch (error) { setNotice({ error: true, text: error instanceof Error ? error.message : "Assignment could not load." }); }
  }

  useEffect(() => { void refresh(); }, []);

  const answeredCall = useMemo(() => snapshot?.operations.slice().reverse().find((operation) =>
    operation.operation === "create-outbound-vendor-call" && operation.status === "success" && operation.normalized_result?.data?.callId,
  ) ?? null, [snapshot]);
  const vendor = snapshot?.vendors.find((item) => item.id === answeredCall?.normalized_result?.data?.vendorId)
    ?? snapshot?.vendors.find((item) => item.contact?.verificationStatus === "verified")
    ?? null;
  const latestQuote = snapshot?.quotes.at(-1) ?? null;
  const latestPayment = snapshot?.payments.at(-1) ?? null;

  async function submitQuote() {
    if (snapshot?.incident === null || snapshot?.incident === undefined || vendor === null || answeredCall?.normalized_result?.data?.callId === undefined) return;
    setBusy(true); setNotice(null);
    const cents = amount.trim() === "" ? null : Math.round(Number(amount) * 100);
    try {
      await requestJson(`/api/incidents/${encodeURIComponent(snapshot.incident.id)}/quotes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor.id,
          sourceCallId: answeredCall.normalized_result.data.callId,
          currency: "USD",
          amountMinor: Number.isFinite(cents) ? cents : null,
          availability,
          arrivalStartsAt: startsAt === "" ? null : new Date(startsAt).toISOString(),
          arrivalEndsAt: endsAt === "" ? null : new Date(endsAt).toISOString(),
          scope: scope.trim() === "" ? null : scope,
          conditions: conditions.split("\n").map((item) => item.trim()).filter(Boolean),
          guarantee: guarantee.trim() === "" ? null : guarantee,
        }),
      });
      setNotice({ error: false, text: "Quote recorded." });
      await refresh();
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : "Quote could not be recorded." });
    } finally { setBusy(false); }
  }

  return (
    <div className="vendor-layout">
      <section className="section-block">
        <h2>{vendor?.name ?? "No controlled assignment yet"}</h2>
        <p>{snapshot?.incident?.goal ?? "Ask the owner to initialize the demo and call the verified vendor first."}</p>
        <div className="metric-line"><span>Call proof</span><strong>{answeredCall ? "Answered" : "Waiting"}</strong></div>
        <div className="metric-line"><span>Job acceptance</span><strong>{latestQuote?.availability === "available" ? "Quoted available" : "Not confirmed"}</strong></div>
        <div className="metric-line"><span>Payment</span><strong>{latestPayment ? latestPayment.payment.status : "Not started"}</strong></div>
        <div className="metric-line"><span>Signed webhook</span><strong>{latestPayment?.webhook_verified_at ? "Verified" : "Waiting"}</strong></div>
      </section>

      <section className="section-block">
        <h2>Record the live quote</h2>
        <p>Leave anything you did not confirm blank.</p>
        <div className="field-stack">
          <div className="two-fields">
            <label>Availability<select value={availability} onChange={(event) => setAvailability(event.target.value as typeof availability)}><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="unknown">Unknown</option></select></label>
            <label>Price in USD<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="125.00" /></label>
          </div>
          <div className="two-fields">
            <label>Arrival window starts<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
            <label>Arrival window ends<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
          </div>
          <label>Scope<textarea value={scope} onChange={(event) => setScope(event.target.value)} placeholder="What work is included?" /></label>
          <label>Conditions, one per line<textarea value={conditions} onChange={(event) => setConditions(event.target.value)} placeholder="Price subject to parts availability" /></label>
          <label>Guarantee<input value={guarantee} onChange={(event) => setGuarantee(event.target.value)} placeholder="Leave blank if none was stated" /></label>
          <button className="button button-primary" type="button" onClick={submitQuote} disabled={busy || answeredCall === null}>{busy ? "Recording…" : "Record quote"}</button>
        </div>
        {notice !== null ? <div className={`notice${notice.error ? " error" : ""}`} role="status">{notice.text}</div> : null}
      </section>
    </div>
  );
}
