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
} from "../types.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Deterministic store for unit tests. It intentionally refuses to initialize in
 * non-test environments so production code cannot silently lose persistence.
 */
export class InMemoryIncidentStore implements IncidentStore {
  readonly #incidents = new Map<string, IncidentSnapshot>();
  readonly #events = new Map<string, OrderedIncidentEvent[]>();
  readonly #operations = new Map<string, ProviderOperation>();
  readonly #operationKeys = new Map<string, string>();
  readonly #contacts = new Map<string, ControlledContact>();
  readonly #vendors = new Map<string, ApprovedVendor>();
  readonly #quotes = new Map<string, VendorQuote>();
  readonly #payments = new Map<string, PaymentRecord>();
  readonly #paymentKeys = new Map<string, string>();
  readonly #stripeEvents = new Set<string>();
  readonly #evidence = new Map<string, EvidenceRecord>();
  #sequence = 0;

  public constructor() {
    if (process.env["NODE_ENV"] !== "test" && process.env["VITEST"] !== "true") {
      throw new Error("InMemoryIncidentStore is test-only");
    }
  }

  public async createIncident(snapshotInput: IncidentSnapshot, createdEventInput: IncidentEvent) {
    const snapshot = incidentSnapshotSchema.parse(snapshotInput);
    const createdEvent = incidentEventSchema.parse(createdEventInput);
    if (createdEvent.type !== "incident.created" || createdEvent.incidentId !== snapshot.id) {
      throw new Error("createIncident requires a matching incident.created event");
    }
    if (this.#incidents.has(snapshot.id)) throw new Error(`Incident ${snapshot.id} already exists`);
    this.#incidents.set(snapshot.id, clone(snapshot));
    await this.appendEvent(createdEvent);
    return clone(snapshot);
  }

  public async getIncident(incidentId: string) {
    const incident = this.#incidents.get(incidentId);
    return incident === undefined ? null : clone(incident);
  }

  public async appendEvent(eventInput: IncidentEvent) {
    const event = incidentEventSchema.parse(eventInput);
    if (!this.#incidents.has(event.incidentId)) throw new Error(`Incident ${event.incidentId} does not exist`);
    const timeline = this.#events.get(event.incidentId) ?? [];
    if (timeline.some((item) => item.event.eventId === event.eventId)) {
      throw new Error(`Event ${event.eventId} already exists`);
    }
    const ordered = { sequence: ++this.#sequence, event: clone(event) };
    timeline.push(ordered);
    this.#events.set(event.incidentId, timeline);
    return clone(ordered);
  }

  public async listEvents(incidentId: string) {
    return clone(this.#events.get(incidentId) ?? []);
  }

  public async beginOperation(input: BeginOperationInput) {
    if (!this.#incidents.has(input.incidentId)) throw new Error(`Incident ${input.incidentId} does not exist`);
    if (input.idempotencyKey !== undefined) {
      const existingId = this.#operationKeys.get(input.idempotencyKey);
      if (existingId !== undefined) return clone(this.#operations.get(existingId)!);
    }
    if (this.#operations.has(input.operationId)) throw new Error(`Operation ${input.operationId} already exists`);
    const operation: ProviderOperation = {
      operationId: input.operationId,
      incidentId: input.incidentId,
      provider: input.provider,
      operation: input.operation,
      status: "unknown",
      idempotencyKey: input.idempotencyKey ?? null,
      requestSummary: clone(input.requestSummary ?? {}),
      result: null,
      startedAt: input.startedAt,
      completedAt: null,
    };
    this.#operations.set(operation.operationId, operation);
    if (operation.idempotencyKey !== null) this.#operationKeys.set(operation.idempotencyKey, operation.operationId);
    return clone(operation);
  }

  public async completeOperation(operationId: string, resultInput: ToolResult) {
    const result = toolResultSchema.parse(resultInput);
    const operation = this.#operations.get(operationId);
    if (operation === undefined) throw new Error(`Operation ${operationId} does not exist`);
    if (result.operationId !== operationId || result.incidentId !== operation.incidentId) {
      throw new Error("Operation result identity mismatch");
    }
    const completed: ProviderOperation = {
      ...operation,
      status: result.status,
      result: clone(result),
      completedAt: result.completedAt,
    };
    this.#operations.set(operationId, completed);
    return clone(completed);
  }

  public async getOperationByIdempotencyKey(idempotencyKey: string) {
    const operationId = this.#operationKeys.get(idempotencyKey);
    if (operationId === undefined) return null;
    return clone(this.#operations.get(operationId)!);
  }

  public async upsertControlledContact(contact: ControlledContact) {
    this.#contacts.set(contact.id, clone(contact));
    return clone(contact);
  }

  public async getControlledContact(contactId: string) {
    const contact = this.#contacts.get(contactId);
    return contact === undefined ? null : clone(contact);
  }

  public async listApprovedVendors(propertyId: string, serviceCategory?: string) {
    return [...this.#vendors.values()]
      .filter(
        (vendor) =>
          vendor.propertyId === propertyId &&
          vendor.active &&
          (serviceCategory === undefined || vendor.serviceCategories.includes(serviceCategory)),
      )
      .sort((a, b) => a.priority - b.priority)
      .map(clone);
  }

  public async saveApprovedVendor(vendor: ApprovedVendor) {
    if (!this.#contacts.has(vendor.contactId)) throw new Error(`Contact ${vendor.contactId} does not exist`);
    this.#vendors.set(`${vendor.propertyId}:${vendor.id}`, clone(vendor));
    return clone(vendor);
  }

  public async saveVendorQuote(quoteInput: VendorQuote) {
    const quote = vendorQuoteSchema.parse(quoteInput);
    this.#quotes.set(`${quote.incidentId}:${quote.vendorId}:${quote.sourceCallId}`, clone(quote));
    return clone(quote);
  }

  public async savePayment(paymentInput: PaymentRecord) {
    const payment = paymentRecordSchema.parse(paymentInput);
    const existingId = this.#paymentKeys.get(payment.idempotencyKey);
    if (existingId !== undefined && existingId !== payment.id) return clone(this.#payments.get(existingId)!);
    this.#payments.set(payment.id, clone(payment));
    this.#paymentKeys.set(payment.idempotencyKey, payment.id);
    return clone(payment);
  }

  public async getPaymentByIdempotencyKey(idempotencyKey: string) {
    const id = this.#paymentKeys.get(idempotencyKey);
    return id === undefined ? null : clone(this.#payments.get(id)!);
  }

  public async getPaymentByProviderId(providerPaymentId: string) {
    const payment = [...this.#payments.values()].find((candidate) => candidate.providerPaymentId === providerPaymentId);
    return payment === undefined ? null : clone(payment);
  }

  public async recordProcessedStripeEvent(eventId: string, _eventType: string, _processedAt: string) {
    if (this.#stripeEvents.has(eventId)) return false;
    this.#stripeEvents.add(eventId);
    return true;
  }

  public async addEvidence(evidence: EvidenceRecord) {
    if (!this.#incidents.has(evidence.incidentId)) throw new Error(`Incident ${evidence.incidentId} does not exist`);
    this.#evidence.set(evidence.id, clone(evidence));
    return clone(evidence);
  }

  public async hasEvidenceRefs(incidentId: string, evidenceRefs: string[]) {
    return evidenceRefs.length > 0 && evidenceRefs.every((ref) => this.#evidence.get(ref)?.incidentId === incidentId);
  }

  public async resolveIncident(incidentId: string, outcomeInput: VerifiedOutcome, eventInput: IncidentEvent) {
    const outcome = verifiedOutcomeSchema.parse(outcomeInput);
    const event = incidentEventSchema.parse(eventInput);
    const current = this.#incidents.get(incidentId);
    if (current === undefined) throw new Error(`Incident ${incidentId} does not exist`);
    if (event.type !== "incident.resolved" || event.incidentId !== incidentId) {
      throw new Error("resolveIncident requires a matching incident.resolved event");
    }
    if (outcome.evidenceRefs.length === 0) throw new Error("Incident closure requires evidence");
    for (const ref of outcome.evidenceRefs) {
      const evidence = this.#evidence.get(ref);
      if (evidence === undefined || evidence.incidentId !== incidentId) {
        throw new Error(`Missing incident evidence ${ref}`);
      }
    }
    const resolved = incidentSnapshotSchema.parse({
      ...current,
      state: "resolved",
      outcome,
      pendingOperations: [],
      updatedAt: outcome.verifiedAt,
    });
    this.#incidents.set(incidentId, clone(resolved));
    await this.appendEvent(event);
    return clone(resolved);
  }
}

export function createInMemoryIncidentStore(): InMemoryIncidentStore {
  return new InMemoryIncidentStore();
}
