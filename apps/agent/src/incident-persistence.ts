import { createHash, randomUUID } from "node:crypto";

import {
  incidentSnapshotSchema,
  type IncidentEvent,
  type IncidentSnapshot,
} from "@steward/contracts";
import {
  createSupabaseServiceClient,
  SupabaseIncidentStore,
  type EvidenceRecord,
} from "@steward/db";

const DEMO_OWNER_ID = "owner_demo";
const DEMO_PROPERTY_ID = "property_demo";

export class AgentIncidentPersistence {
  readonly #client;
  readonly #store;

  constructor(config: { url: string; secretKey: string }) {
    this.#client = createSupabaseServiceClient(config);
    this.#store = new SupabaseIncidentStore(this.#client);
  }

  async ensureIncident(input: {
    incidentId: string;
    participantIdentity: string;
    incidentGoal?: string;
    guestExpiryDays: number;
  }): Promise<IncidentSnapshot> {
    const existing = await this.#store.getIncident(input.incidentId);
    if (existing !== null) return existing;

    const now = new Date();
    await this.#ensureDemoProperty(now.toISOString());
    const sessionId = `voice_guest_${createHash("sha256")
      .update(input.participantIdentity)
      .digest("hex")
      .slice(0, 24)}`;
    const expiresAt = new Date(now.getTime() + input.guestExpiryDays * 86_400_000).toISOString();
    const { error: sessionError } = await this.#client.from("demo_guest_sessions").upsert({
      id: sessionId,
      property_id: DEMO_PROPERTY_ID,
      email_hash: createHash("sha256").update(`voice:${input.participantIdentity}`).digest("hex"),
      verified_at: now.toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
    });
    if (sessionError !== null) throw new Error(`Voice session persistence failed: ${sessionError.message}`);

    const snapshot = incidentSnapshotSchema.parse({
      version: 1,
      id: input.incidentId,
      propertyId: DEMO_PROPERTY_ID,
      bookingId: null,
      guestSessionId: sessionId,
      goal: input.incidentGoal?.trim() || "Caller connected; the property incident has not been described yet.",
      state: "reported",
      risk: "unknown",
      budget: { currency: "USD", authorizedMinor: 25000, spentMinor: 0 },
      activeHypotheses: [],
      pendingOperations: [],
      selectedVendorId: null,
      outcome: null,
      updatedAt: now.toISOString(),
    });
    const event: IncidentEvent = {
      version: 1,
      type: "incident.created",
      incidentId: snapshot.id,
      eventId: randomUUID(),
      occurredAt: now.toISOString(),
      actor: { kind: "system", component: "agent" },
      payload: { snapshot },
    };
    return this.#store.createIncident(snapshot, event);
  }

  async persist(event: IncidentEvent): Promise<void> {
    if (event.type === "voice.turn.received") await this.#adoptFirstReportedGoal(event);
    if (event.type === "evidence.recorded") {
      const evidence: EvidenceRecord = {
        id: event.payload.evidenceRef,
        incidentId: event.incidentId,
        kind: event.payload.kind,
        summary: event.payload.summary,
        submittedBy: "livekit-agent",
        verifiedBy: event.payload.kind === "video-frame" ? "agent-vision" : "tool",
        createdAt: event.occurredAt,
      };
      await this.#store.addEvidence(evidence);
    }
    await this.#store.appendEvent(event);
  }

  async #ensureDemoProperty(now: string): Promise<void> {
    const { error: ownerError } = await this.#client.from("owners").upsert({
      id: DEMO_OWNER_ID,
      identity_id: null,
      display_name: "Steward demo owner",
      default_currency: "USD",
      updated_at: now,
    });
    if (ownerError !== null) throw new Error(`Demo owner persistence failed: ${ownerError.message}`);
    const { error: propertyError } = await this.#client.from("properties").upsert({
      id: DEMO_PROPERTY_ID,
      owner_id: DEMO_OWNER_ID,
      name: "Harbor House",
      address: { label: "Demo property", private: true },
      timezone: "America/Los_Angeles",
      operational_policy: { currency: "USD", authorizedMinor: 25000 },
      updated_at: now,
    });
    if (propertyError !== null) throw new Error(`Demo property persistence failed: ${propertyError.message}`);
  }

  async #adoptFirstReportedGoal(event: Extract<IncidentEvent, { type: "voice.turn.received" }>): Promise<void> {
    const current = await this.#store.getIncident(event.incidentId);
    if (current === null || !current.goal.startsWith("Caller connected;")) return;
    const updated = incidentSnapshotSchema.parse({
      ...current,
      goal: event.payload.transcript.slice(0, 2_000),
      state: "triaging",
      updatedAt: event.occurredAt,
    });
    const { error } = await this.#client.from("incidents").update({
      goal: updated.goal,
      state: updated.state,
      snapshot: updated,
      updated_at: updated.updatedAt,
    }).eq("id", updated.id);
    if (error !== null) throw new Error(`Incident goal persistence failed: ${error.message}`);
  }
}
