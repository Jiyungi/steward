import { NextResponse } from "next/server";

import { getServiceClient } from "../../../../lib/server/database";
import { DEMO_OWNER_ID } from "../../../../lib/server/demo";
import { apiError } from "../../../../lib/server/http";

export interface OwnerIncidentRow {
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

export interface OwnerIncidentsResponse {
  needsAttention: OwnerIncidentRow[];
  handling: OwnerIncidentRow[];
  resolved: OwnerIncidentRow[];
  totals: { open: number; spentMinor: number; authorizedMinor: number; currency: string };
}

function needsAttention(row: OwnerIncidentRow): boolean {
  if (row.state === "escalated" || row.state === "failed") return true;
  if (row.risk === "high" || row.risk === "emergency") return true;
  return row.budget.authorizedMinor > 0 && row.budget.spentMinor >= row.budget.authorizedMinor;
}

function verifiedOutcome(snapshot: unknown, evidenceIds: Set<string>): boolean {
  if (snapshot === null || typeof snapshot !== "object" || !("outcome" in snapshot)) return false;
  const outcome = snapshot.outcome;
  if (outcome === null || typeof outcome !== "object" || !("evidenceRefs" in outcome)) return false;
  const refs = outcome.evidenceRefs;
  return Array.isArray(refs) && refs.length > 0 && refs.every((ref) => evidenceIds.has(String(ref)));
}

export async function GET() {
  try {
    const client = getServiceClient();
    const { data: propertyRows, error: propertyError } = await client
      .from("properties")
      .select("id,name")
      .eq("owner_id", DEMO_OWNER_ID);
    if (propertyError !== null) throw propertyError;
    const properties = propertyRows ?? [];
    if (properties.length === 0) {
      return NextResponse.json({
        needsAttention: [],
        handling: [],
        resolved: [],
        totals: { open: 0, spentMinor: 0, authorizedMinor: 0, currency: "USD" },
      } satisfies OwnerIncidentsResponse);
    }

    const propertyNames = new Map(properties.map((property) => [String(property.id), String(property.name)]));
    const propertyIds = [...propertyNames.keys()];
    const { data: incidentRows, error } = await client
      .from("incidents")
      .select("id,property_id,goal,state,risk,budget_currency,authorized_minor,spent_minor,snapshot,created_at,updated_at")
      .in("property_id", propertyIds)
      .order("updated_at", { ascending: false });
    if (error !== null) throw error;
    const incidents = incidentRows ?? [];
    if (incidents.length === 0) {
      const empty: OwnerIncidentsResponse = {
        needsAttention: [],
        handling: [],
        resolved: [],
        totals: { open: 0, spentMinor: 0, authorizedMinor: 0, currency: "USD" },
      };
      return NextResponse.json(empty);
    }

    const incidentIds = incidents.map((row) => String(row.id));
    const [evidenceResult, eventResult] = await Promise.all([
      client.from("evidence_records").select("id,incident_id").in("incident_id", incidentIds),
      client.from("incident_events").select("incident_id,event_type,occurred_at,sequence").in("incident_id", incidentIds),
    ]);
    if (evidenceResult.error !== null) throw evidenceResult.error;
    if (eventResult.error !== null) throw eventResult.error;

    const evidenceCounts = new Map<string, number>();
    const evidenceIds = new Map<string, Set<string>>();
    for (const evidence of evidenceResult.data ?? []) {
      const incidentId = String(evidence.incident_id);
      evidenceCounts.set(incidentId, (evidenceCounts.get(incidentId) ?? 0) + 1);
      const ids = evidenceIds.get(incidentId) ?? new Set<string>();
      ids.add(String(evidence.id));
      evidenceIds.set(incidentId, ids);
    }

    const latestEvents = new Map<string, { type: string; occurredAt: string; sequence: number }>();
    for (const event of eventResult.data ?? []) {
      const incidentId = String(event.incident_id);
      const sequence = Number(event.sequence);
      const current = latestEvents.get(incidentId);
      if (current !== undefined && current.sequence >= sequence) continue;
      latestEvents.set(incidentId, { type: String(event.event_type), occurredAt: String(event.occurred_at), sequence });
    }

    const rows: OwnerIncidentRow[] = incidents
      .map((incident) => {
        const id = String(incident.id);
        const propertyId = String(incident.property_id);
        const latestEvent = latestEvents.get(id);
        const state = String(incident.state);
        return {
          id,
          goal: String(incident.goal),
          state,
          risk: String(incident.risk),
          propertyId,
          propertyName: propertyNames.get(propertyId) ?? propertyId,
          budget: {
            currency: String(incident.budget_currency),
            authorizedMinor: Number(incident.authorized_minor),
            spentMinor: Number(incident.spent_minor),
          },
          evidenceCount: evidenceCounts.get(id) ?? 0,
          latestEvent: latestEvent === undefined ? null : { type: latestEvent.type, occurredAt: latestEvent.occurredAt },
          outcomeVerified: state === "resolved" && verifiedOutcome(incident.snapshot, evidenceIds.get(id) ?? new Set()),
          createdAt: String(incident.created_at),
          updatedAt: String(incident.updated_at),
        };
      })
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

    const response: OwnerIncidentsResponse = {
      needsAttention: [],
      handling: [],
      resolved: [],
      totals: { open: 0, spentMinor: 0, authorizedMinor: 0, currency: rows[0]?.budget.currency ?? "USD" },
    };
    for (const row of rows) {
      if (row.state === "resolved") {
        response.resolved.push(row);
        continue;
      }
      if (needsAttention(row)) {
        response.needsAttention.push(row);
      } else {
        response.handling.push(row);
      }
      response.totals.open += 1;
      response.totals.spentMinor += row.budget.spentMinor;
      response.totals.authorizedMinor += row.budget.authorizedMinor;
    }
    return NextResponse.json(response);
  } catch (error) {
    return apiError(error);
  }
}
