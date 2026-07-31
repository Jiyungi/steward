import { NextResponse } from "next/server";

import { getIncidentStore, getServiceClient } from "../../../../lib/server/database";
import { apiError } from "../../../../lib/server/http";

export async function GET() {
  try {
    const { data: incidentRow, error } = await getServiceClient()
      .from("incidents")
      .select("snapshot")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) throw error;
    const incident = incidentRow?.snapshot ?? null;
    if (incident === null || typeof incident !== "object" || !("id" in incident) || !("propertyId" in incident)) {
      return NextResponse.json({ incident: null, events: [], vendors: [], evidence: [], payments: [], operations: [], quotes: [] });
    }
    const incidentId = String(incident.id);
    const [events, vendors, evidenceResult, paymentResult, operationResult, quoteResult] = await Promise.all([
      getIncidentStore().listEvents(incidentId),
      getIncidentStore().listApprovedVendors(String(incident.propertyId)),
      getServiceClient().from("evidence_records").select("id,kind,summary,verified_by,created_at").eq("incident_id", incidentId).order("created_at"),
      getServiceClient().from("payments").select("payment,webhook_verified_at").eq("incident_id", incidentId).order("created_at"),
      getServiceClient().from("provider_operations").select("operation_id,provider,operation,status,normalized_result,started_at,completed_at").eq("incident_id", incidentId).order("started_at"),
      getServiceClient().from("vendor_quotes").select("quote").eq("incident_id", incidentId).order("created_at"),
    ]);
    if (evidenceResult.error !== null) throw evidenceResult.error;
    if (paymentResult.error !== null) throw paymentResult.error;
    if (operationResult.error !== null) throw operationResult.error;
    if (quoteResult.error !== null) throw quoteResult.error;
    const safeVendors = await Promise.all(vendors.map(async (vendor) => {
      const contact = await getIncidentStore().getControlledContact(vendor.contactId);
      return {
        id: vendor.id,
        name: vendor.name,
        priority: vendor.priority,
        serviceCategories: vendor.serviceCategories,
        contact: contact === null ? null : {
          id: contact.id,
          label: contact.label,
          phoneLast4: contact.phoneE164.slice(-4),
          verificationStatus: contact.verificationStatus,
        },
      };
    }));
    return NextResponse.json({
      incident,
      events,
      vendors: safeVendors,
      evidence: evidenceResult.data ?? [],
      payments: paymentResult.data ?? [],
      operations: operationResult.data ?? [],
      quotes: (quoteResult.data ?? []).map((row) => row.quote),
    });
  } catch (error) {
    return apiError(error);
  }
}
