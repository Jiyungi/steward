import { llm } from "@livekit/agents";
import type { DatabaseConfig, ProviderConfig } from "@steward/config";
import {
  incidentSnapshotSchema,
  vendorQuoteSchema,
  type IncidentEvent,
  type VendorQuote,
} from "@steward/contracts";
import {
  createSupabaseServiceClient,
  SupabaseIncidentStore,
  type ApprovedVendor,
} from "@steward/db";
import { traceToolCall } from "@steward/observability";
import {
  A1MobileProvider,
  ApprovedVendorDirectory,
  FetchA1MobileTransport,
  LiveKitServerSipTransport,
  LiveKitTelephonyProvider,
  ProviderActionAuditor,
  StripePaymentProvider,
  StripeSdkTransport,
} from "@steward/providers";
import { createHash, randomUUID } from "node:crypto";

import { HumanSpeechController, withHumanWait, type SpeechRisk } from "./speech-controller.js";
import type { VoiceChannel } from "./turn-tracing.js";

interface QuoteInput {
  amountMinor?: number;
  availability: "available" | "unavailable" | "unknown";
  arrivalStartsAt?: string;
  arrivalEndsAt?: string;
  scope?: string;
  conditions: string[];
  guarantee?: string;
}

interface OperationResultRow {
  normalized_result: unknown;
}

function safeVendor(vendor: ApprovedVendor) {
  return {
    id: vendor.id,
    name: vendor.name,
    serviceCategories: vendor.serviceCategories,
    priority: vendor.priority,
    policyNotes: vendor.policyNotes,
  };
}

export class AgentActionRuntime {
  readonly #client;
  readonly #store;
  readonly #directory;
  readonly #a1;
  readonly #telephony;
  readonly #payments;

  constructor(
    private readonly incidentId: string,
    database: DatabaseConfig,
    provider: ProviderConfig,
  ) {
    this.#client = createSupabaseServiceClient({
      url: database.NEXT_PUBLIC_SUPABASE_URL,
      secretKey: database.SUPABASE_SECRET_KEY,
    });
    this.#store = new SupabaseIncidentStore(this.#client);
    const auditor = new ProviderActionAuditor(this.#store);
    this.#directory = new ApprovedVendorDirectory(this.#store);
    this.#a1 = new A1MobileProvider(
      new FetchA1MobileTransport({
        baseUrl: provider.A1MOBILE_BASE_URL,
        teamKey: provider.A1MOBILE_TEAM_KEY,
      }),
      auditor,
    );
    this.#telephony = new LiveKitTelephonyProvider(
      { outboundTrunkId: provider.LIVEKIT_SIP_OUTBOUND_TRUNK_ID },
      new LiveKitServerSipTransport({
        livekitUrl: provider.LIVEKIT_URL,
        apiKey: provider.LIVEKIT_API_KEY,
        apiSecret: provider.LIVEKIT_API_SECRET,
        agentName: provider.LIVEKIT_AGENT_NAME,
      }),
      auditor,
    );
    this.#payments = new StripePaymentProvider(
      new StripeSdkTransport({ secretKey: provider.STRIPE_SECRET_KEY }),
      this.#store,
      auditor,
    );
  }

  async listApprovedVendors(serviceCategory: string) {
    const incident = await this.#requireIncident();
    const candidates = await this.#directory.findCandidates(
      incident.propertyId,
      serviceCategory.trim().toLowerCase(),
    );
    return {
      source: candidates.source,
      vendors: candidates.vendors.map(safeVendor),
      externalDiscoveryEnabled: false,
    };
  }

  async sendApprovedVendorSms(vendorId: string, message: string, operationId: string) {
    const { vendor, contact } = await this.#requireApprovedVendor(vendorId);
    const idempotencyKey = `sms:${this.incidentId}:${vendor.id}:${createHash("sha256")
      .update(message.trim())
      .digest("hex")
      .slice(0, 20)}`;
    return this.#a1.sendSms({
      incidentId: this.incidentId,
      operationId,
      idempotencyKey,
      contact,
      body: message,
    });
  }

  async callApprovedVendor(vendorId: string, operationId: string) {
    const incident = await this.#requireIncident();
    const { vendor, contact } = await this.#requireApprovedVendor(vendorId);
    const result = await this.#telephony.createOutboundVendorCall({
      incidentId: this.incidentId,
      operationId,
      idempotencyKey: `call:${this.incidentId}:${vendor.id}`,
      vendorId: vendor.id,
      vendorName: vendor.name,
      incidentGoal: incident.goal,
      contact,
    });
    if (result.status === "success" && result.data !== undefined) {
      const evidenceRef = `livekit-call:${result.data.callId}`;
      if (!(await this.#store.hasEvidenceRefs(this.incidentId, [evidenceRef]))) {
        await this.#store.addEvidence({
          id: evidenceRef,
          incidentId: this.incidentId,
          kind: "call-record",
          summary: "LiveKit confirmed that the controlled vendor answered; acceptance and quote details remain separate facts.",
          submittedBy: "livekit-sip",
          verifiedBy: "tool",
          createdAt: result.completedAt,
        });
        await this.#store.appendEvent({
          version: 1,
          incidentId: this.incidentId,
          eventId: `evt-${randomUUID()}`,
          occurredAt: result.completedAt,
          actor: { kind: "system", component: "agent" },
          type: "vendor.call.started",
          payload: { vendorId: vendor.id, callId: result.data.callId },
        });
      }
    }
    return result;
  }

  async recordVendorQuote(vendorId: string, input: QuoteInput): Promise<VendorQuote> {
    const incident = await this.#requireIncident();
    await this.#requireApprovedVendor(vendorId);
    const callId = await this.#latestAnsweredCallId(vendorId);
    const arrivalWindow = input.arrivalStartsAt !== undefined && input.arrivalEndsAt !== undefined
      ? { startsAt: input.arrivalStartsAt, endsAt: input.arrivalEndsAt }
      : null;
    const unresolvedFields = [
      ...(input.amountMinor === undefined ? ["amount"] : []),
      ...(input.availability === "unknown" ? ["availability"] : []),
      ...(arrivalWindow === null ? ["arrivalWindow"] : []),
      ...(input.scope === undefined ? ["scope"] : []),
      ...(input.guarantee === undefined ? ["guarantee"] : []),
    ];
    const quote = vendorQuoteSchema.parse({
      version: 1,
      incidentId: this.incidentId,
      vendorId,
      sourceCallId: callId,
      currency: "USD",
      amountMinor: input.amountMinor ?? null,
      availability: input.availability,
      arrivalWindow,
      scope: input.scope ?? null,
      conditions: input.conditions,
      guarantee: input.guarantee ?? null,
      unresolvedFields,
      evidenceRefs: [`livekit-call:${callId}`],
    });
    await this.#store.saveVendorQuote(quote);
    const now = new Date().toISOString();
    const nextState = quote.availability === "available" ? "scheduled" : incident.state;
    const updated = incidentSnapshotSchema.parse({
      ...incident,
      selectedVendorId: quote.availability === "available" ? vendorId : incident.selectedVendorId,
      state: nextState,
      updatedAt: now,
    });
    const { error } = await this.#client.from("incidents").update({
      selected_vendor_id: updated.selectedVendorId,
      state: updated.state,
      snapshot: updated,
      updated_at: now,
    }).eq("id", this.incidentId);
    if (error !== null) throw new Error(`Quote state persistence failed: ${error.message}`);
    const events: IncidentEvent[] = [{
      version: 1,
      incidentId: this.incidentId,
      eventId: `evt-${randomUUID()}`,
      occurredAt: now,
      actor: { kind: "system", component: "agent" },
      type: "vendor.quote.recorded",
      payload: { quote },
    }];
    if (quote.availability === "available") {
      events.push({
        version: 1,
        incidentId: this.incidentId,
        eventId: `evt-${randomUUID()}`,
        occurredAt: now,
        actor: { kind: "system", component: "agent" },
        type: "vendor.selected",
        payload: { vendorId, quoteSourceCallId: callId },
      });
    }
    for (const event of events) await this.#store.appendEvent(event);
    return quote;
  }

  async payLatestQuote(vendorId: string, operationId: string) {
    const incident = await this.#requireIncident();
    const { data, error } = await this.#client
      .from("vendor_quotes")
      .select("quote")
      .eq("incident_id", this.incidentId)
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error !== null) throw new Error(`Quote lookup failed: ${error.message}`);
    if (data === null) throw new Error("No recorded quote exists for that approved vendor.");
    const quote = vendorQuoteSchema.parse(data.quote);
    const result = await this.#payments.createPayment({
      incident,
      operationId,
      quote,
      prepaymentEvidenceRefs: quote.evidenceRefs,
    });
    return {
      ...result,
      verification: result.status === "success" ? "awaiting-signed-webhook" : "not-verified",
    };
  }

  async #requireIncident() {
    const incident = await this.#store.getIncident(this.incidentId);
    if (incident === null) throw new Error("The active incident no longer exists.");
    return incident;
  }

  async #requireApprovedVendor(vendorId: string) {
    const incident = await this.#requireIncident();
    const vendors = await this.#store.listApprovedVendors(incident.propertyId);
    const vendor = vendors.find((candidate) => candidate.id === vendorId);
    if (vendor === undefined) throw new Error("That vendor is not approved for this property.");
    const contact = await this.#store.getControlledContact(vendor.contactId);
    if (contact === null) throw new Error("The approved vendor has no controlled contact.");
    return { vendor, contact };
  }

  async #latestAnsweredCallId(vendorId: string): Promise<string> {
    const { data, error } = await this.#client
      .from("provider_operations")
      .select("normalized_result")
      .eq("incident_id", this.incidentId)
      .eq("operation", "create-outbound-vendor-call")
      .eq("status", "success")
      .order("completed_at", { ascending: false })
      .limit(10);
    if (error !== null) throw new Error(`Vendor call lookup failed: ${error.message}`);
    for (const row of (data ?? []) as OperationResultRow[]) {
      const result = row.normalized_result as { data?: { vendorId?: unknown; callId?: unknown } } | null;
      if (result?.data?.vendorId === vendorId && typeof result.data.callId === "string") return result.data.callId;
    }
    throw new Error("No matching answered controlled call exists for this vendor quote.");
  }
}

export interface AgentActionService {
  listApprovedVendors(serviceCategory: string): Promise<unknown>;
  sendApprovedVendorSms(vendorId: string, message: string, operationId: string): Promise<unknown>;
  callApprovedVendor(vendorId: string, operationId: string): Promise<unknown>;
  recordVendorQuote(vendorId: string, input: QuoteInput): Promise<unknown>;
  payLatestQuote(vendorId: string, operationId: string): Promise<unknown>;
}

export function createAgentActionTools(options: {
  runtime: AgentActionService;
  channel: VoiceChannel;
  vendorId?: string;
  speech: HumanSpeechController;
  speak: (text: string) => void;
}): llm.FunctionTool[] {
  const run = async <T>(input: {
    name: string;
    label: string;
    operationId: string;
    toolInput: unknown;
    risk?: SpeechRisk;
    execute: () => Promise<T>;
  }): Promise<T> => traceToolCall({
    name: input.name,
    input: input.toolInput,
    run: () => withHumanWait({
      operationId: input.operationId,
      safeLabel: input.label,
      ...(input.risk === undefined ? {} : { risk: input.risk }),
      controller: options.speech,
      speak: options.speak,
      execute: input.execute,
    }),
  });

  if (options.channel === "vendor-call") {
    return [llm.tool({
      name: "record_vendor_quote",
      description: "Record only the service facts the vendor actually stated on this controlled live call. Preserve every missing fact as unresolved. Call this once before ending the vendor conversation.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["availability", "conditions"],
        properties: {
          amountMinor: { type: "integer", minimum: 0, description: "Total quoted US cents. Omit when the vendor did not state a price." },
          availability: { type: "string", enum: ["available", "unavailable", "unknown"] },
          arrivalStartsAt: { type: "string", description: "ISO timestamp for the start of the stated arrival window. Omit if unknown." },
          arrivalEndsAt: { type: "string", description: "ISO timestamp for the end of the stated arrival window. Omit if unknown." },
          scope: { type: "string", description: "Work the vendor explicitly included. Omit if unclear." },
          conditions: { type: "array", items: { type: "string" }, maxItems: 20 },
          guarantee: { type: "string", description: "Guarantee the vendor explicitly stated. Omit if none was stated." },
        },
      },
      onDuplicate: "reject",
      execute: async (input, context) => {
        if (options.vendorId === undefined) throw new Error("The vendor identity is missing from this controlled room.");
        return run({
          name: "record-vendor-quote",
          label: "recording the vendor quote",
          operationId: context.toolCallId,
          toolInput: input,
          execute: () => options.runtime.recordVendorQuote(options.vendorId!, {
            ...(typeof input.amountMinor === "number" ? { amountMinor: input.amountMinor } : {}),
            availability: input.availability === "available" || input.availability === "unavailable" ? input.availability : "unknown",
            ...(typeof input.arrivalStartsAt === "string" ? { arrivalStartsAt: input.arrivalStartsAt } : {}),
            ...(typeof input.arrivalEndsAt === "string" ? { arrivalEndsAt: input.arrivalEndsAt } : {}),
            ...(typeof input.scope === "string" ? { scope: input.scope } : {}),
            conditions: Array.isArray(input.conditions) ? input.conditions.map(String) : [],
            ...(typeof input.guarantee === "string" ? { guarantee: input.guarantee } : {}),
          }),
        });
      },
    })];
  }

  return [
    llm.tool({
      name: "find_approved_vendors",
      description: "Find property-approved vendors for the current incident before any external search. This never exposes a phone number.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["serviceCategory"],
        properties: { serviceCategory: { type: "string", minLength: 1 } },
      },
      onDuplicate: "reject",
      execute: async (input, context) => run({
        name: "find-approved-vendors",
        label: "the approved vendor list",
        operationId: context.toolCallId,
        toolInput: input,
        execute: () => options.runtime.listApprovedVendors(String(input.serviceCategory)),
      }),
    }),
    llm.tool({
      name: "send_approved_vendor_sms",
      description: "Send an incident-derived update only to a property-approved, verified controlled vendor. Acceptance is not delivery and must not be described as delivery.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["vendorId", "message"],
        properties: {
          vendorId: { type: "string", minLength: 1 },
          message: { type: "string", minLength: 1, maxLength: 480 },
        },
      },
      onDuplicate: "reject",
      execute: async (input, context) => run({
        name: "send-approved-vendor-sms",
        label: "the vendor message request",
        operationId: context.toolCallId,
        toolInput: { vendorId: input.vendorId, messageCharacters: String(input.message).length },
        execute: () => options.runtime.sendApprovedVendorSms(String(input.vendorId), String(input.message), context.toolCallId),
      }),
    }),
    llm.tool({
      name: "call_approved_vendor",
      description: "Call one property-approved verified vendor in an isolated LiveKit room. An answered call is not job acceptance and does not contain a quote until the vendor states one.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["vendorId"],
        properties: { vendorId: { type: "string", minLength: 1 } },
      },
      onDuplicate: "reject",
      execute: async (input, context) => run({
        name: "call-approved-vendor",
        label: "the approved vendor call",
        operationId: context.toolCallId,
        toolInput: input,
        execute: () => options.runtime.callApprovedVendor(String(input.vendorId), context.toolCallId),
      }),
    }),
    llm.tool({
      name: "pay_recorded_vendor_quote",
      description: "Create an autonomous Stripe test payment only for the selected approved vendor's real recorded quote, inside the remaining owner-authorized budget and with call evidence. Success still requires a signed webhook and never resolves the incident.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["vendorId"],
        properties: { vendorId: { type: "string", minLength: 1 } },
      },
      onDuplicate: "reject",
      execute: async (input, context) => run({
        name: "pay-recorded-vendor-quote",
        label: "the payment confirmation",
        risk: "critical",
        operationId: context.toolCallId,
        toolInput: input,
        execute: () => options.runtime.payLatestQuote(String(input.vendorId), context.toolCallId),
      }),
    }),
  ];
}
