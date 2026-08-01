"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface OwnerIncidentRow {
  id: string;
  goal: string;
  state: string;
  risk: string;
  propertyId: string;
  propertyName: string;
  budget: { currency: string; authorizedMinor: number; spentMinor: number };
  evidenceCount: number;
  latestEvent: { type: string; occurredAt: string } | null;
  outcomeVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OwnerIncidentsResponse {
  needsAttention: OwnerIncidentRow[];
  handling: OwnerIncidentRow[];
  resolved: OwnerIncidentRow[];
  totals: { open: number; spentMinor: number; authorizedMinor: number; currency: string };
}

const EMPTY: OwnerIncidentsResponse = {
  needsAttention: [],
  handling: [],
  resolved: [],
  totals: { open: 0, spentMinor: 0, authorizedMinor: 0, currency: "USD" },
};

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? "The workspace could not be loaded.");
  }
  return body;
}

function stateLabel(state: string) {
  const labels: Record<string, string> = {
    reported: "Just reported",
    triaging: "Working out the problem",
    diagnosing: "Diagnosing the problem",
    sourcing: "Finding a vendor",
    "vendor-contacting": "Contacting a vendor",
    scheduled: "Visit scheduled",
    "verification-pending": "Verifying the fix",
    resolved: "Resolved",
    failed: "Could not be fixed",
    escalated: "Escalated to you",
  };
  return labels[state] ?? state.replaceAll("-", " ");
}

function riskLabel(risk: string) {
  const labels: Record<string, string> = {
    unknown: "Risk not known yet",
    low: "Low risk",
    medium: "Medium risk",
    high: "High risk",
    emergency: "Emergency",
  };
  return labels[risk] ?? risk.replaceAll("-", " ");
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
    "payment.started": "Payment started",
    "payment.updated": "Payment updated",
    "incident.resolved": "Resolution verified",
    "voice.turn.received": "Guest update received",
    "voice.response.started": "Steward responded",
    "voice.interrupted": "Guest interrupted Steward",
    "voice.session.started": "Call connected",
    "voice.session.ended": "Call ended",
  };
  return labels[type] ?? type.replaceAll(".", " ");
}

function money(minor: number, currency: string) {
  const amount = Number.isFinite(minor) ? minor / 100 : 0;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function budgetOf(row: OwnerIncidentRow) {
  const budget = row.budget as OwnerIncidentRow["budget"] | undefined;
  return {
    currency: typeof budget?.currency === "string" ? budget.currency : "USD",
    authorizedMinor: typeof budget?.authorizedMinor === "number" ? budget.authorizedMinor : 0,
    spentMinor: typeof budget?.spentMinor === "number" ? budget.spentMinor : 0,
  };
}

function spentLine(row: OwnerIncidentRow) {
  const budget = budgetOf(row);
  return `${money(budget.spentMinor, budget.currency)} of ${money(budget.authorizedMinor, budget.currency)}`;
}

function spentTotal(row: OwnerIncidentRow) {
  const budget = budgetOf(row);
  return money(budget.spentMinor, budget.currency);
}

function openFor(createdAt: string) {
  const started = new Date(createdAt).getTime();
  if (Number.isNaN(started)) return "Open";
  const minutes = Math.max(0, Math.round((Date.now() - started) / 60_000));
  if (minutes < 60) return `Open ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Open ${hours}h ${minutes % 60}m`;
  return `Open ${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function shortTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function rowsOf(value: unknown): OwnerIncidentRow[] {
  return Array.isArray(value) ? value as OwnerIncidentRow[] : [];
}

function normalize(body: unknown): OwnerIncidentsResponse {
  const source = (body ?? {}) as Partial<OwnerIncidentsResponse>;
  const totals = source.totals;
  return {
    needsAttention: rowsOf(source.needsAttention),
    handling: rowsOf(source.handling),
    resolved: rowsOf(source.resolved),
    totals: {
      open: typeof totals?.open === "number" ? totals.open : 0,
      spentMinor: typeof totals?.spentMinor === "number" ? totals.spentMinor : 0,
      authorizedMinor: typeof totals?.authorizedMinor === "number" ? totals.authorizedMinor : 0,
      currency: typeof totals?.currency === "string" ? totals.currency : "USD",
    },
  };
}

export function OwnerWorkspace() {
  const [snapshot, setSnapshot] = useState<OwnerIncidentsResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(normalize(await jsonRequest<OwnerIncidentsResponse>("/api/owner/incidents", { cache: "no-store" })));
      setNotice(null);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Your properties could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const { needsAttention, handling, resolved, totals } = snapshot;

  return (
    <div className="owner-stack">
      <section className="section-block owner-summary">
        <div className="metric-line"><span>Open incidents</span><strong>{totals.open}</strong></div>
        <div className="metric-line"><span>Spent</span><strong>{money(totals.spentMinor, totals.currency)}</strong></div>
        <div className="metric-line"><span>Authorized</span><strong>{money(totals.authorizedMinor, totals.currency)}</strong></div>
      </section>

      {notice !== null ? (
        <div className={`notice${notice.kind === "error" ? " error" : ""}`} role="status">
          <span>{notice.text}</span>
          {notice.kind === "error" ? (
            <button className="notice-action" type="button" onClick={() => void refresh()}>Try again</button>
          ) : null}
        </div>
      ) : null}

      <section className="section-block">
        <h2>Needs your attention</h2>
        {needsAttention.length === 0 ? (
          <p>{loading ? "Loading…" : "Nothing needs you right now."}</p>
        ) : (
          <ul className="attention-list">
            {needsAttention.map((row) => (
              <li className="attention-card" key={row.id}>
                <div className="attention-head">
                  <strong>{row.propertyName}</strong>
                  <span className="priority-label" data-risk={row.risk}>{riskLabel(row.risk)}</span>
                </div>
                <p className="attention-goal">{row.goal}</p>
                <div className="metric-line"><span>Status</span><strong>{stateLabel(row.state)}</strong></div>
                <div className="metric-line"><span>Spent</span><strong>{spentLine(row)}</strong></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-block">
        <h2>Steward is handling</h2>
        {handling.length === 0 ? (
          <p>{loading ? "Loading…" : "No open work right now."}</p>
        ) : (
          <ol className="timeline">
            {handling.map((row) => (
              <li key={row.id}>
                <span className="timeline-marker" aria-hidden="true" />
                <div>
                  <strong>{row.propertyName}</strong>
                  <p>{row.goal}</p>
                  <p className="timeline-meta">
                    <span>{stateLabel(row.state)}</span>
                    <span>{riskLabel(row.risk)}</span>
                    <span>{spentLine(row)}</span>
                    <span>{openFor(row.createdAt)}</span>
                    <span>{row.latestEvent === null ? "No activity yet" : eventLabel(row.latestEvent.type)}</span>
                  </p>
                </div>
                <time dateTime={row.latestEvent?.occurredAt ?? row.updatedAt}>
                  {shortTime(row.latestEvent?.occurredAt ?? row.updatedAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="section-block">
        <h2>Recently resolved</h2>
        {resolved.length === 0 ? (
          <p>{loading ? "Loading…" : "Nothing resolved yet."}</p>
        ) : (
          <ol className="timeline">
            {resolved.map((row) => (
              <li key={row.id}>
                <span className="timeline-marker" aria-hidden="true" />
                <div>
                  <strong>{row.propertyName}</strong>
                  <p>{row.goal}</p>
                  <p className="timeline-meta">
                    <span>{spentTotal(row)} spent</span>
                    <span>{row.evidenceCount} evidence {row.evidenceCount === 1 ? "item" : "items"}</span>
                    <span>{row.outcomeVerified ? "Outcome verified" : "Outcome not verified"}</span>
                  </p>
                </div>
                <time dateTime={row.updatedAt}>{shortDate(row.updatedAt)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Link className="demo-link" href="/owner/demo">Demo setup</Link>
    </div>
  );
}
