import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  incidentEventSchema,
  incidentSnapshotSchema,
  paymentRecordSchema,
  toolResultSchema,
  vendorQuoteSchema,
  verifiedOutcomeSchema,
  type IncidentEvent,
  type IncidentSnapshot,
  type PaymentRecord,
  type ToolResult,
  type VendorQuote,
  type VerifiedOutcome,
} from "@steward/contracts";

import type {
  ApprovedVendor,
  BeginOperationInput,
  ControlledContact,
  EvidenceRecord,
  IncidentStore,
  OrderedIncidentEvent,
  ProviderOperation,
} from "./types.js";

type DbRow = Record<string, unknown>;

function requireData<T>(data: T | null, error: { message: string } | null, action: string): T {
  if (error !== null) throw new Error(`${action} failed: ${error.message}`);
  if (data === null) throw new Error(`${action} returned no data`);
  return data;
}

function mapContact(row: DbRow): ControlledContact {
  return {
    id: String(row["id"]),
    phoneE164: String(row["phone_e164"]),
    label: String(row["label"]),
    verificationStatus: row["verification_status"] as ControlledContact["verificationStatus"],
    organizerControlled: Boolean(row["organizer_controlled"]),
    verifiedAt: row["verified_at"] === null ? null : String(row["verified_at"]),
    createdAt: String(row["created_at"]),
    updatedAt: String(row["updated_at"]),
  };
}

function mapVendor(row: DbRow): ApprovedVendor {
  const vendor = row["vendors"] as DbRow | null;
  if (vendor === null) throw new Error("Approved vendor row is missing its vendor record");
  return {
    id: String(vendor["id"]),
    propertyId: String(row["property_id"]),
    contactId: String(vendor["controlled_contact_id"]),
    name: String(vendor["name"]),
    serviceCategories: vendor["service_categories"] as string[],
    priority: Number(row["priority"]),
    policyNotes: row["policy_notes"] === null ? null : String(row["policy_notes"]),
    active: Boolean(vendor["active"]),
  };
}

function mapOperation(row: DbRow): ProviderOperation {
  return {
    operationId: String(row["operation_id"]),
    incidentId: String(row["incident_id"]),
    provider: row["provider"] as ProviderOperation["provider"],
    operation: String(row["operation"]),
    status: row["status"] as ProviderOperation["status"],
    idempotencyKey: row["idempotency_key"] === null ? null : String(row["idempotency_key"]),
    requestSummary: (row["request_summary"] ?? {}) as Record<string, unknown>,
    result: row["normalized_result"] === null ? null : toolResultSchema.parse(row["normalized_result"]),
    startedAt: String(row["started_at"]),
    completedAt: row["completed_at"] === null ? null : String(row["completed_at"]),
  };
}

export interface SupabaseIncidentStoreConfig {
  url: string;
  secretKey: string;
}

export function createSupabaseServiceClient(config: SupabaseIncidentStoreConfig): SupabaseClient {
  if (!config.secretKey.startsWith("sb_secret_") && !config.secretKey.startsWith("eyJ")) {
    throw new Error("Supabase IncidentStore requires a server-only secret/service role key");
  }
  return createClient(config.url, config.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export class SupabaseIncidentStore implements IncidentStore {
  public constructor(private readonly client: SupabaseClient) {}

  public async createIncident(snapshotInput: IncidentSnapshot, createdEventInput: IncidentEvent) {
    const snapshot = incidentSnapshotSchema.parse(snapshotInput);
    const createdEvent = incidentEventSchema.parse(createdEventInput);
    if (createdEvent.type !== "incident.created" || createdEvent.incidentId !== snapshot.id) {
      throw new Error("createIncident requires a matching incident.created event");
    }
    const { error } = await this.client.from("incidents").insert({
      id: snapshot.id,
      property_id: snapshot.propertyId,
      booking_id: snapshot.bookingId,
      guest_session_id: snapshot.guestSessionId,
      goal: snapshot.goal,
      state: snapshot.state,
      risk: snapshot.risk,
      budget_currency: snapshot.budget.currency,
      authorized_minor: snapshot.budget.authorizedMinor,
      spent_minor: snapshot.budget.spentMinor,
      selected_vendor_id: snapshot.selectedVendorId,
      snapshot,
      updated_at: snapshot.updatedAt,
    });
    if (error !== null) throw new Error(`create incident failed: ${error.message}`);
    await this.appendEvent(createdEvent);
    return snapshot;
  }

  public async getIncident(incidentId: string) {
    const { data, error } = await this.client.from("incidents").select("snapshot").eq("id", incidentId).maybeSingle();
    if (error !== null) throw new Error(`get incident failed: ${error.message}`);
    return data === null ? null : incidentSnapshotSchema.parse((data as DbRow)["snapshot"]);
  }

  public async appendEvent(eventInput: IncidentEvent) {
    const event = incidentEventSchema.parse(eventInput);
    const existing = await this.getIncident(event.incidentId);
    if (existing === null) throw new Error(`Incident ${event.incidentId} does not exist`);
    const { data, error } = await this.client
      .from("incident_events")
      .insert({
        event_id: event.eventId,
        incident_id: event.incidentId,
        event_type: event.type,
        actor: event.actor,
        payload: event.payload,
        occurred_at: event.occurredAt,
      })
      .select("sequence")
      .single();
    const row = requireData(data as DbRow | null, error, "append event");
    return { sequence: Number(row["sequence"]), event };
  }

  public async listEvents(incidentId: string) {
    const { data, error } = await this.client
      .from("incident_events")
      .select("sequence,event_id,incident_id,event_type,actor,payload,occurred_at")
      .eq("incident_id", incidentId)
      .order("sequence", { ascending: true });
    if (error !== null) throw new Error(`list events failed: ${error.message}`);
    return ((data ?? []) as DbRow[]).map((row) => ({
      sequence: Number(row["sequence"]),
      event: incidentEventSchema.parse({
        version: 1,
        incidentId: row["incident_id"],
        eventId: row["event_id"],
        occurredAt: row["occurred_at"],
        actor: row["actor"],
        type: row["event_type"],
        payload: row["payload"],
      }),
    }));
  }

  public async beginOperation(input: BeginOperationInput) {
    if (input.idempotencyKey !== undefined) {
      const existing = await this.getOperationByIdempotencyKey(input.idempotencyKey);
      if (existing !== null) return existing;
    }
    const { data, error } = await this.client
      .from("provider_operations")
      .insert({
        operation_id: input.operationId,
        incident_id: input.incidentId,
        provider: input.provider,
        operation: input.operation,
        status: "unknown",
        idempotency_key: input.idempotencyKey ?? null,
        request_summary: input.requestSummary ?? {},
        started_at: input.startedAt,
      })
      .select("*")
      .single();
    return mapOperation(requireData(data as DbRow | null, error, "begin operation"));
  }

  public async completeOperation(operationId: string, resultInput: ToolResult) {
    const result = toolResultSchema.parse(resultInput);
    if (result.operationId !== operationId) throw new Error("Operation result ID mismatch");
    const { data, error } = await this.client
      .from("provider_operations")
      .update({ status: result.status, normalized_result: result, completed_at: result.completedAt })
      .eq("operation_id", operationId)
      .select("*")
      .single();
    return mapOperation(requireData(data as DbRow | null, error, "complete operation"));
  }

  public async getOperationByIdempotencyKey(idempotencyKey: string) {
    const { data, error } = await this.client
      .from("provider_operations")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (error !== null) throw new Error(`get operation failed: ${error.message}`);
    return data === null ? null : mapOperation(data as DbRow);
  }

  public async upsertControlledContact(contact: ControlledContact) {
    const { data, error } = await this.client
      .from("controlled_contacts")
      .upsert({
        id: contact.id,
        phone_e164: contact.phoneE164,
        label: contact.label,
        verification_status: contact.verificationStatus,
        organizer_controlled: contact.organizerControlled,
        verified_at: contact.verifiedAt,
        created_at: contact.createdAt,
        updated_at: contact.updatedAt,
      })
      .select("*")
      .single();
    return mapContact(requireData(data as DbRow | null, error, "upsert contact"));
  }

  public async getControlledContact(contactId: string) {
    const { data, error } = await this.client.from("controlled_contacts").select("*").eq("id", contactId).maybeSingle();
    if (error !== null) throw new Error(`get contact failed: ${error.message}`);
    return data === null ? null : mapContact(data as DbRow);
  }

  public async listApprovedVendors(propertyId: string, serviceCategory?: string) {
    let query = this.client
      .from("approved_vendors")
      .select("property_id,priority,policy_notes,vendors!inner(id,name,service_categories,controlled_contact_id,active)")
      .eq("property_id", propertyId)
      .eq("vendors.active", true)
      .order("priority", { ascending: true });
    if (serviceCategory !== undefined) query = query.contains("vendors.service_categories", [serviceCategory]);
    const { data, error } = await query;
    if (error !== null) throw new Error(`list approved vendors failed: ${error.message}`);
    return ((data ?? []) as unknown as DbRow[]).map(mapVendor);
  }

  public async saveApprovedVendor(vendor: ApprovedVendor) {
    const { error: vendorError } = await this.client.from("vendors").upsert({
      id: vendor.id,
      controlled_contact_id: vendor.contactId,
      name: vendor.name,
      service_categories: vendor.serviceCategories,
      active: vendor.active,
    });
    if (vendorError !== null) throw new Error(`save vendor failed: ${vendorError.message}`);
    const { error } = await this.client.from("approved_vendors").upsert({
      property_id: vendor.propertyId,
      vendor_id: vendor.id,
      priority: vendor.priority,
      policy_notes: vendor.policyNotes,
    });
    if (error !== null) throw new Error(`approve vendor failed: ${error.message}`);
    return vendor;
  }

  public async saveVendorQuote(quoteInput: VendorQuote) {
    const quote = vendorQuoteSchema.parse(quoteInput);
    const { error } = await this.client.from("vendor_quotes").upsert({
      incident_id: quote.incidentId,
      vendor_id: quote.vendorId,
      source_call_id: quote.sourceCallId,
      quote,
    });
    if (error !== null) throw new Error(`save quote failed: ${error.message}`);
    return quote;
  }

  public async savePayment(paymentInput: PaymentRecord) {
    const payment = paymentRecordSchema.parse(paymentInput);
    const { error } = await this.client.from("payments").upsert({
      id: payment.id,
      incident_id: payment.incidentId,
      vendor_id: payment.vendorId,
      provider_payment_id: payment.providerPaymentId,
      currency: payment.currency,
      amount_minor: payment.amountMinor,
      status: payment.status,
      idempotency_key: payment.idempotencyKey,
      test_mode: payment.testMode,
      payment,
      webhook_verified_at: payment.evidenceRefs.some((ref) => ref.startsWith("stripe-event:"))
        ? payment.updatedAt
        : null,
      updated_at: payment.updatedAt,
    });
    if (error !== null) throw new Error(`save payment failed: ${error.message}`);
    return payment;
  }

  public async getPaymentByIdempotencyKey(idempotencyKey: string) {
    const { data, error } = await this.client.from("payments").select("payment").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error !== null) throw new Error(`get payment failed: ${error.message}`);
    return data === null ? null : paymentRecordSchema.parse((data as DbRow)["payment"]);
  }

  public async getPaymentByProviderId(providerPaymentId: string) {
    const { data, error } = await this.client.from("payments").select("payment").eq("provider_payment_id", providerPaymentId).maybeSingle();
    if (error !== null) throw new Error(`get payment failed: ${error.message}`);
    return data === null ? null : paymentRecordSchema.parse((data as DbRow)["payment"]);
  }

  public async recordProcessedStripeEvent(eventId: string, eventType: string, processedAt: string) {
    const { error } = await this.client.from("processed_stripe_events").insert({
      event_id: eventId,
      event_type: eventType,
      processed_at: processedAt,
    });
    if (error === null) return true;
    if (error.code === "23505") return false;
    throw new Error(`record Stripe event failed: ${error.message}`);
  }

  public async addEvidence(evidence: EvidenceRecord) {
    const { error } = await this.client.from("evidence_records").insert({
      id: evidence.id,
      incident_id: evidence.incidentId,
      kind: evidence.kind,
      summary: evidence.summary,
      submitted_by: evidence.submittedBy,
      verified_by: evidence.verifiedBy,
      created_at: evidence.createdAt,
    });
    if (error !== null) throw new Error(`add evidence failed: ${error.message}`);
    return evidence;
  }

  public async hasEvidenceRefs(incidentId: string, evidenceRefs: string[]) {
    if (evidenceRefs.length === 0) return false;
    const { data, error } = await this.client
      .from("evidence_records")
      .select("id")
      .eq("incident_id", incidentId)
      .in("id", evidenceRefs);
    if (error !== null) throw new Error(`check evidence failed: ${error.message}`);
    return new Set(((data ?? []) as DbRow[]).map((row) => String(row["id"]))).size === new Set(evidenceRefs).size;
  }

  public async resolveIncident(incidentId: string, outcomeInput: VerifiedOutcome, eventInput: IncidentEvent) {
    const outcome = verifiedOutcomeSchema.parse(outcomeInput);
    const event = incidentEventSchema.parse(eventInput);
    if (event.type !== "incident.resolved" || event.incidentId !== incidentId) {
      throw new Error("resolveIncident requires a matching incident.resolved event");
    }
    const { data, error } = await this.client.rpc("resolve_incident_with_evidence", {
      target_incident_id: incidentId,
      verified_outcome: outcome,
      resolution_event: event,
    });
    return incidentSnapshotSchema.parse(requireData(data, error, "resolve incident"));
  }
}
