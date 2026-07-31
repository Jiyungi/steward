import { describe, expect, it, vi } from "vitest";

import {
  incidentEventSchema,
  incidentSnapshotSchema,
  validIncidentSnapshot,
  vendorQuoteSchema,
  type IncidentSnapshot,
} from "@steward/contracts";
import { createInMemoryIncidentStore } from "@steward/db/testing";
import type { ApprovedVendor, ControlledContact } from "@steward/db";

import {
  A1MobileProvider,
  ApprovedVendorDirectory,
  LiveKitTelephonyProvider,
  ProviderActionAuditor,
  StripePaymentProvider,
  StripeSdkTransport,
  StripeWebhookVerifier,
  type A1MobileTransport,
  type CreateStripePaymentIntentRequest,
  type LiveKitSipTransport,
  type StripePaymentIntentReceipt,
  type StripeTransport,
  type StripeWebhookReceipt,
} from "../src/index.js";

const NOW = "2030-01-15T18:00:00.000Z";

const verifiedContact: ControlledContact = {
  id: "contact-1",
  phoneE164: "+14155550123",
  label: "Demo vendor",
  verificationStatus: "verified",
  organizerControlled: false,
  verifiedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
};

const unverifiedContact: ControlledContact = {
  ...verifiedContact,
  id: "contact-unverified",
  phoneE164: "+14155550124",
  verificationStatus: "pending",
  verifiedAt: null,
};

function createdEvent(snapshot: IncidentSnapshot) {
  return incidentEventSchema.parse({
    version: 1,
    incidentId: snapshot.id,
    eventId: `event-created-${snapshot.id}`,
    occurredAt: snapshot.updatedAt,
    actor: { kind: "system", component: "agent" },
    type: "incident.created",
    payload: { snapshot },
  });
}

async function setup(snapshot: IncidentSnapshot = validIncidentSnapshot) {
  const store = createInMemoryIncidentStore();
  await store.createIncident(snapshot, createdEvent(snapshot));
  return { store, auditor: new ProviderActionAuditor(store) };
}

describe("a1mobile provider", () => {
  it("blocks an unverified SMS recipient before transport", async () => {
    const { store, auditor } = await setup();
    const post = vi.fn<A1MobileTransport["post"]>();
    const provider = new A1MobileProvider({ post }, auditor);
    const result = await provider.sendSms({
      incidentId: validIncidentSnapshot.id,
      operationId: "sms-unverified",
      idempotencyKey: "sms-unverified-key",
      contact: unverifiedContact,
      body: "A concise incident update.",
    });
    expect(result.status).toBe("failure");
    expect(result.error?.code).toBe("CONTACT_NOT_VERIFIED");
    expect(post).not.toHaveBeenCalled();
    expect((await store.listEvents(validIncidentSnapshot.id)).map(({ event }) => event.type)).toEqual([
      "incident.created", "tool.started", "tool.completed",
    ]);
  });

  it("deduplicates SMS sends and never claims delivery", async () => {
    const { store, auditor } = await setup();
    const post = vi.fn<A1MobileTransport["post"]>().mockResolvedValue({
      status: 202,
      body: { id: "raw-message-1", delivery_status: "delivered", secret_field: "must-not-leak" },
    });
    const provider = new A1MobileProvider({ post }, auditor);
    const first = await provider.sendSms({
      incidentId: validIncidentSnapshot.id,
      operationId: "sms-1",
      idempotencyKey: "incident-1:sms:guest-update",
      contact: verifiedContact,
      body: "Your vendor call is starting now.",
    });
    const second = await provider.sendSms({
      incidentId: validIncidentSnapshot.id,
      operationId: "sms-2",
      idempotencyKey: "incident-1:sms:guest-update",
      contact: verifiedContact,
      body: "Your vendor call is starting now.",
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(first.data).toEqual({ providerMessageId: "raw-message-1", accepted: true, deliveryStatus: "unknown" });
    expect(second.operationId).toBe("sms-1");
    expect(JSON.stringify(first)).not.toContain("secret_field");
    expect((await store.listEvents(validIncidentSnapshot.id))).toHaveLength(3);
  });

  it("normalizes OTP request and confirmation without exposing the code", async () => {
    const { auditor } = await setup();
    const post = vi.fn<A1MobileTransport["post"]>().mockResolvedValue({ status: 200, body: { ok: true } });
    const provider = new A1MobileProvider({ post }, auditor);
    const request = await provider.requestPhoneVerification({
      incidentId: validIncidentSnapshot.id,
      operationId: "otp-request",
      idempotencyKey: "otp-request-key",
      phoneE164: verifiedContact.phoneE164,
    });
    const confirm = await provider.confirmPhoneVerification({
      incidentId: validIncidentSnapshot.id,
      operationId: "otp-confirm",
      idempotencyKey: "otp-confirm-key",
      phoneE164: verifiedContact.phoneE164,
      code: "123456",
    });
    expect(request.data?.verificationRequested).toBe(true);
    expect(confirm.data?.verified).toBe(true);
    expect(JSON.stringify(confirm)).not.toContain("123456");
  });
});

describe("vendor ordering and telephony", () => {
  it("returns approved vendors in priority order without external discovery", async () => {
    const { store } = await setup();
    await store.upsertControlledContact(verifiedContact);
    const vendors: ApprovedVendor[] = [
      { id: "vendor-2", propertyId: "property-1", contactId: verifiedContact.id, name: "Second", serviceCategories: ["locksmith"], priority: 20, policyNotes: null, active: true },
      { id: "vendor-1", propertyId: "property-1", contactId: verifiedContact.id, name: "First", serviceCategories: ["locksmith"], priority: 10, policyNotes: null, active: true },
    ];
    await Promise.all(vendors.map((vendor) => store.saveApprovedVendor(vendor)));
    const search = vi.fn().mockResolvedValue([]);
    const directory = new ApprovedVendorDirectory(store, { search });
    const result = await directory.findCandidates("property-1", "locksmith");
    expect(result.source).toBe("approved");
    expect(result.vendors.map(({ id }) => id)).toEqual(["vendor-1", "vendor-2"]);
    expect(search).not.toHaveBeenCalled();
  });

  it("treats SIP answer as answered, never as a quote or booking", async () => {
    const { auditor } = await setup();
    const dispatchAgent = vi.fn<LiveKitSipTransport["dispatchAgent"]>().mockResolvedValue({
      dispatchId: "dispatch-1",
    });
    const createSipParticipant = vi.fn<LiveKitSipTransport["createSipParticipant"]>().mockResolvedValue({
      participantId: "call-1",
      participantIdentity: "vendor-1-call",
    });
    const provider = new LiveKitTelephonyProvider(
      { outboundTrunkId: "ST_test" },
      { dispatchAgent, createSipParticipant },
      auditor,
    );
    const result = await provider.createOutboundVendorCall({
      incidentId: validIncidentSnapshot.id,
      operationId: "call-operation-1",
      idempotencyKey: "incident-1:call:vendor-1",
      vendorId: "vendor-1",
      vendorName: "Vendor One",
      contact: verifiedContact,
    });
    expect(result.status).toBe("success");
    expect(result.data?.sipAnswered).toBe(true);
    expect(result.data?.quoteStatus).toBe("not-collected");
    expect(result.data?.dispatchId).toBe("dispatch-1");
    expect(dispatchAgent).toHaveBeenCalledWith(expect.objectContaining({
      incidentId: validIncidentSnapshot.id,
      vendorId: "vendor-1",
    }));
    expect(createSipParticipant).toHaveBeenCalledWith(expect.objectContaining({ waitUntilAnswered: true }));
    expect(JSON.stringify(result)).not.toMatch(/booked|accepted quote/i);
  });

  it("blocks an unverified call before creating a SIP participant", async () => {
    const { auditor } = await setup();
    const dispatchAgent = vi.fn<LiveKitSipTransport["dispatchAgent"]>();
    const createSipParticipant = vi.fn<LiveKitSipTransport["createSipParticipant"]>();
    const provider = new LiveKitTelephonyProvider(
      { outboundTrunkId: "ST_test" },
      { dispatchAgent, createSipParticipant },
      auditor,
    );
    const result = await provider.createOutboundVendorCall({
      incidentId: validIncidentSnapshot.id,
      operationId: "call-unverified",
      idempotencyKey: "incident-1:call:unverified",
      vendorId: "vendor-unverified",
      vendorName: "Unverified Vendor",
      contact: unverifiedContact,
    });
    expect(result.error?.code).toBe("CONTACT_NOT_VERIFIED");
    expect(dispatchAgent).not.toHaveBeenCalled();
    expect(createSipParticipant).not.toHaveBeenCalled();
  });
});

class FakeStripeTransport implements StripeTransport {
  public createCalls = 0;
  public receipt: StripePaymentIntentReceipt = {
    id: "pi_test_1",
    status: "succeeded",
    livemode: false,
    failureCode: null,
  };
  public webhook: StripeWebhookReceipt | Error = {
    id: "evt_test_1",
    type: "payment_intent.succeeded",
    createdAt: "2030-01-15T18:05:00.000Z",
    paymentIntentId: "pi_test_1",
    paymentStatus: "succeeded",
    livemode: false,
    incidentId: "incident-payment",
  };

  public async createPaymentIntent(_request: CreateStripePaymentIntentRequest) {
    this.createCalls += 1;
    return this.receipt;
  }

  public constructWebhookEvent() {
    if (this.webhook instanceof Error) throw this.webhook;
    return this.webhook;
  }
}

function paymentSnapshot(authorizedMinor = 20_000) {
  return incidentSnapshotSchema.parse({
    ...validIncidentSnapshot,
    id: "incident-payment",
    selectedVendorId: "vendor-1",
    budget: { currency: "USD", authorizedMinor, spentMinor: 0 },
  });
}

function quote(amountMinor = 12_500) {
  return vendorQuoteSchema.parse({
    version: 1,
    incidentId: "incident-payment",
    vendorId: "vendor-1",
    sourceCallId: "call-quote-1",
    currency: "USD",
    amountMinor,
    availability: "available",
    arrivalWindow: null,
    scope: "Complete the agreed repair.",
    conditions: [],
    guarantee: null,
    unresolvedFields: [],
    evidenceRefs: ["evidence-quote"],
  });
}

describe("Stripe payment and webhook", () => {
  it("refuses to initialize the production transport with a live key", () => {
    expect(() => new StripeSdkTransport({ secretKey: "sk_live_forbidden" })).toThrow("test-mode");
  });

  it("enforces budget and evidence before transport", async () => {
    const incident = paymentSnapshot(10_000);
    const { store, auditor } = await setup(incident);
    const transport = new FakeStripeTransport();
    const provider = new StripePaymentProvider(transport, store, auditor);
    const result = await provider.createPayment({
      incident,
      operationId: "payment-over-budget",
      quote: quote(12_500),
      prepaymentEvidenceRefs: [],
    });
    expect(result.status).toBe("failure");
    expect(result.error?.code).toBe("BUDGET_EXCEEDED");
    expect(transport.createCalls).toBe(0);
  });

  it("creates one test payment for duplicate requests but does not resolve the incident", async () => {
    const incident = paymentSnapshot();
    const { store, auditor } = await setup(incident);
    await store.addEvidence({
      id: "evidence-prepay",
      incidentId: incident.id,
      kind: "call-record",
      summary: "Vendor agreed to the quote.",
      submittedBy: "agent",
      verifiedBy: "tool",
      createdAt: NOW,
    });
    const transport = new FakeStripeTransport();
    const provider = new StripePaymentProvider(transport, store, auditor);
    const request = { incident, operationId: "payment-1", quote: quote(), prepaymentEvidenceRefs: ["evidence-prepay"] };
    const first = await provider.createPayment(request);
    const second = await provider.createPayment({ ...request, operationId: "payment-2" });
    expect(first.status).toBe("success");
    expect(first.data?.testMode).toBe(true);
    expect(first.data?.evidenceRefs).toEqual([]);
    expect(second.operationId).toBe("payment-1");
    expect(transport.createCalls).toBe(1);
    expect((await store.getIncident(incident.id))?.state).toBe("diagnosing");
  });

  it("rejects live-mode payment receipts", async () => {
    const incident = paymentSnapshot();
    const { store, auditor } = await setup(incident);
    await store.addEvidence({ id: "evidence-prepay", incidentId: incident.id, kind: "call-record", summary: "Agreement", submittedBy: "agent", verifiedBy: "tool", createdAt: NOW });
    const transport = new FakeStripeTransport();
    transport.receipt = { ...transport.receipt, livemode: true };
    const result = await new StripePaymentProvider(transport, store, auditor).createPayment({
      incident,
      operationId: "payment-live",
      quote: quote(),
      prepaymentEvidenceRefs: ["evidence-prepay"],
    });
    expect(result.status).toBe("failure");
    expect(result.error?.code).toBe("STRIPE_LIVE_MODE_REJECTED");
  });

  it("verifies raw webhook signatures through the transport and deduplicates event IDs", async () => {
    const incident = paymentSnapshot();
    const { store, auditor } = await setup(incident);
    await store.addEvidence({ id: "evidence-prepay", incidentId: incident.id, kind: "call-record", summary: "Agreement", submittedBy: "agent", verifiedBy: "tool", createdAt: NOW });
    const transport = new FakeStripeTransport();
    await new StripePaymentProvider(transport, store, auditor).createPayment({
      incident,
      operationId: "payment-webhook",
      quote: quote(),
      prepaymentEvidenceRefs: ["evidence-prepay"],
    });
    const verifier = new StripeWebhookVerifier(transport, store, auditor, "whsec_test");
    const first = await verifier.verifyAndRecord({
      incidentId: incident.id,
      operationId: "webhook-1",
      idempotencyKey: "webhook-delivery-1",
      rawBody: "{\"id\":\"evt_test_1\"}",
      signature: "valid-signature",
    });
    const duplicate = await verifier.verifyAndRecord({
      incidentId: incident.id,
      operationId: "webhook-2",
      idempotencyKey: "webhook-delivery-2",
      rawBody: "{\"id\":\"evt_test_1\"}",
      signature: "valid-signature",
    });
    expect(first.data).toMatchObject({ duplicate: false, matchedPayment: true });
    expect(duplicate.data).toMatchObject({ duplicate: true });
    expect((await store.getPaymentByProviderId("pi_test_1"))?.evidenceRefs).toEqual(["stripe-event:evt_test_1"]);
  });

  it("rejects a bad webhook signature without changing payment state", async () => {
    const incident = paymentSnapshot();
    const { store, auditor } = await setup(incident);
    const transport = new FakeStripeTransport();
    transport.webhook = new Error("bad signature details must not leak");
    const result = await new StripeWebhookVerifier(transport, store, auditor, "whsec_test").verifyAndRecord({
      incidentId: incident.id,
      operationId: "webhook-invalid",
      idempotencyKey: "webhook-invalid-key",
      rawBody: "mutated-body",
      signature: "bad-signature",
    });
    expect(result.status).toBe("failure");
    expect(result.error?.code).toBe("INVALID_STRIPE_SIGNATURE");
    expect(JSON.stringify(result)).not.toContain("bad signature details");
  });
});
