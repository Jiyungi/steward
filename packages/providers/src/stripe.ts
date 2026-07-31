import Stripe from "stripe";
import { z } from "zod";

import {
  paymentRecordSchema,
  type IncidentSnapshot,
  type PaymentRecord,
  type ToolResult,
  type VendorQuote,
} from "@steward/contracts";
import type { IncidentStore } from "@steward/db";

import { ProviderActionAuditor } from "./audit.js";

export type StripePaymentState =
  | "pending"
  | "requires-action"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export interface CreateStripePaymentIntentRequest {
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  incidentId: string;
  vendorId: string;
  purpose: string;
}

export interface StripePaymentIntentReceipt {
  id: string;
  status: StripePaymentState;
  livemode: boolean;
  failureCode: string | null;
}

export interface StripeWebhookReceipt {
  id: string;
  type: string;
  createdAt: string;
  paymentIntentId: string;
  paymentStatus: StripePaymentState;
  livemode: boolean;
  incidentId: string | null;
}

export interface StripeTransport {
  createPaymentIntent(request: CreateStripePaymentIntentRequest): Promise<StripePaymentIntentReceipt>;
  constructWebhookEvent(rawBody: string | Buffer, signature: string, webhookSecret: string): StripeWebhookReceipt;
}

export interface StripeSdkTransportConfig {
  secretKey: string;
  paymentMethod?: string;
}

function mapStripeStatus(status: Stripe.PaymentIntent.Status): StripePaymentState {
  switch (status) {
    case "succeeded": return "succeeded";
    case "processing": return "processing";
    case "canceled": return "canceled";
    case "requires_action":
    case "requires_capture":
    case "requires_confirmation": return "requires-action";
    case "requires_payment_method": return "failed";
  }
}

export class StripeSdkTransport implements StripeTransport {
  readonly #stripe: Stripe;
  readonly #paymentMethod: string;

  public constructor(config: StripeSdkTransportConfig) {
    if (!config.secretKey.startsWith("sk_test_") && !config.secretKey.startsWith("sk_sandbox_")) {
      throw new Error("Steward only permits Stripe test-mode secret keys");
    }
    this.#stripe = new Stripe(config.secretKey, { maxNetworkRetries: 2 });
    this.#paymentMethod = config.paymentMethod ?? "pm_card_visa";
  }

  public async createPaymentIntent(request: CreateStripePaymentIntentRequest) {
    const intent = await this.#stripe.paymentIntents.create(
      {
        amount: request.amountMinor,
        currency: request.currency.toLowerCase(),
        confirm: true,
        payment_method: this.#paymentMethod,
        automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        description: request.purpose,
        metadata: { incident_id: request.incidentId, vendor_id: request.vendorId },
      },
      { idempotencyKey: request.idempotencyKey },
    );
    return {
      id: intent.id,
      status: mapStripeStatus(intent.status),
      livemode: intent.livemode,
      failureCode: intent.last_payment_error?.code ?? null,
    };
  }

  public constructWebhookEvent(rawBody: string | Buffer, signature: string, webhookSecret: string) {
    const event = this.#stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    if (!event.type.startsWith("payment_intent.")) throw new Error("Unsupported Stripe event type");
    const intent = event.data.object as Stripe.PaymentIntent;
    return {
      id: event.id,
      type: event.type,
      createdAt: new Date(event.created * 1_000).toISOString(),
      paymentIntentId: intent.id,
      paymentStatus: mapStripeStatus(intent.status),
      livemode: intent.livemode,
      incidentId: intent.metadata["incident_id"] ?? null,
    };
  }
}

export interface CreatePaymentInput {
  incident: IncidentSnapshot;
  operationId: string;
  quote: VendorQuote;
  prepaymentEvidenceRefs: string[];
}

function paymentGateError(input: CreatePaymentInput, evidencePresent: boolean) {
  const { incident, quote } = input;
  if (quote.incidentId !== incident.id) return ["INCIDENT_MISMATCH", "The quote does not belong to this incident."] as const;
  if (incident.selectedVendorId !== quote.vendorId) return ["VENDOR_NOT_SELECTED", "The quoted vendor is not selected."] as const;
  if (quote.availability !== "available" || quote.amountMinor === null) {
    return ["QUOTE_NOT_AGREED", "The vendor has not provided an available, priced quote."] as const;
  }
  if (quote.amountMinor > incident.budget.authorizedMinor - incident.budget.spentMinor) {
    return ["BUDGET_EXCEEDED", "The vendor payment exceeds the remaining autonomous budget."] as const;
  }
  if (!evidencePresent) return ["PREPAYMENT_EVIDENCE_MISSING", "Required pre-payment evidence is missing."] as const;
  return null;
}

export class StripePaymentProvider {
  public constructor(
    private readonly transport: StripeTransport,
    private readonly store: IncidentStore,
    private readonly auditor: ProviderActionAuditor,
  ) {}

  public async createPayment(input: CreatePaymentInput): Promise<ToolResult<PaymentRecord>> {
    const idempotencyKey = `payment:${input.incident.id}:${input.quote.vendorId}:${input.quote.sourceCallId}`;
    const evidencePresent = await this.store.hasEvidenceRefs(input.incident.id, input.prepaymentEvidenceRefs);
    const gateError = paymentGateError(input, evidencePresent);

    return this.auditor.run({
      incidentId: input.incident.id,
      operationId: input.operationId,
      idempotencyKey,
      provider: "stripe",
      operation: "create-vendor-payment",
      requestSummary: {
        vendorId: input.quote.vendorId,
        amountMinor: input.quote.amountMinor,
        currency: input.quote.currency,
        evidenceCount: input.prepaymentEvidenceRefs.length,
      },
      dataSchema: paymentRecordSchema,
      execute: async () => {
        if (gateError !== null) {
          return {
            status: "failure",
            error: { code: gateError[0], safeMessage: gateError[1], retryable: false },
          };
        }
        const amountMinor = input.quote.amountMinor!;
        const receipt = await this.transport.createPaymentIntent({
          amountMinor,
          currency: input.quote.currency,
          idempotencyKey,
          incidentId: input.incident.id,
          vendorId: input.quote.vendorId,
          purpose: `Steward incident ${input.incident.id} vendor payment`,
        });
        if (receipt.livemode) {
          return {
            status: "failure",
            error: { code: "STRIPE_LIVE_MODE_REJECTED", safeMessage: "Only test-mode payments are allowed.", retryable: false },
          };
        }

        const now = new Date().toISOString();
        const payment = paymentRecordSchema.parse({
          version: 1,
          id: `pay-${input.operationId}`,
          incidentId: input.incident.id,
          vendorId: input.quote.vendorId,
          provider: "stripe",
          providerPaymentId: receipt.id,
          currency: input.quote.currency,
          amountMinor,
          status: receipt.status,
          idempotencyKey,
          testMode: true,
          createdAt: now,
          updatedAt: now,
          evidenceRefs: [],
          ...(receipt.status === "failed"
            ? { error: { code: receipt.failureCode ?? "PAYMENT_FAILED", safeMessage: "Stripe did not complete the test payment.", retryable: false } }
            : {}),
        });
        await this.store.savePayment(payment);
        if (receipt.status === "failed" || receipt.status === "canceled") {
          return {
            status: "failure",
            data: payment,
            error: { code: receipt.failureCode ?? "PAYMENT_NOT_COMPLETED", safeMessage: "Stripe did not complete the test payment.", retryable: false },
          };
        }
        return {
          status: receipt.status === "succeeded" ? "success" : "partial",
          data: payment,
        };
      },
    });
  }
}

const webhookResultSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  duplicate: z.boolean(),
  matchedPayment: z.boolean(),
  paymentStatus: z.enum(["pending", "requires-action", "processing", "succeeded", "failed", "canceled"]),
}).strict();

export type StripeWebhookResult = z.infer<typeof webhookResultSchema>;

export interface VerifyStripeWebhookInput {
  incidentId: string;
  operationId: string;
  idempotencyKey: string;
  rawBody: string | Buffer;
  signature: string;
}

export class StripeWebhookVerifier {
  public constructor(
    private readonly transport: StripeTransport,
    private readonly store: IncidentStore,
    private readonly auditor: ProviderActionAuditor,
    private readonly webhookSecret: string,
  ) {
    if (!webhookSecret.startsWith("whsec_")) throw new Error("A Stripe webhook signing secret is required");
  }

  public async verifyAndRecord(input: VerifyStripeWebhookInput): Promise<ToolResult<StripeWebhookResult>> {
    return this.auditor.run({
      incidentId: input.incidentId,
      operationId: input.operationId,
      idempotencyKey: input.idempotencyKey,
      provider: "stripe",
      operation: "verify-payment-webhook",
      requestSummary: { rawBodyBytes: Buffer.byteLength(input.rawBody), signaturePresent: input.signature.length > 0 },
      dataSchema: webhookResultSchema,
      actor: { kind: "system", component: "webhook" },
      execute: async () => {
        let event: StripeWebhookReceipt;
        try {
          event = this.transport.constructWebhookEvent(input.rawBody, input.signature, this.webhookSecret);
        } catch {
          return {
            status: "failure",
            error: { code: "INVALID_STRIPE_SIGNATURE", safeMessage: "The Stripe webhook signature is invalid.", retryable: false },
          };
        }
        if (event.livemode || event.incidentId !== input.incidentId) {
          return {
            status: "failure",
            error: { code: "STRIPE_EVENT_REJECTED", safeMessage: "The Stripe event does not match this test incident.", retryable: false },
          };
        }
        const payment = await this.store.getPaymentByProviderId(event.paymentIntentId);
        if (payment === null) {
          return {
            status: "partial",
            data: {
              eventId: event.id,
              eventType: event.type,
              duplicate: false,
              matchedPayment: false,
              paymentStatus: event.paymentStatus,
            },
          };
        }

        const firstProcessing = await this.store.recordProcessedStripeEvent(event.id, event.type, event.createdAt);
        if (!firstProcessing) {
          return {
            status: "success",
            data: {
              eventId: event.id,
              eventType: event.type,
              duplicate: true,
              matchedPayment: true,
              paymentStatus: event.paymentStatus,
            },
          };
        }

        const evidenceRef = `stripe-event:${event.id}`;
        await this.store.addEvidence({
          id: evidenceRef,
          incidentId: input.incidentId,
          kind: "tool-result",
          summary: `Verified Stripe event ${event.type}`,
          submittedBy: "stripe-webhook",
          verifiedBy: "tool",
          createdAt: event.createdAt,
        });
        const updated = paymentRecordSchema.parse({
          ...payment,
          status: event.paymentStatus,
          updatedAt: event.createdAt,
          evidenceRefs: [...new Set([...payment.evidenceRefs, evidenceRef])],
          ...(event.paymentStatus === "failed"
            ? { error: { code: "PAYMENT_FAILED", safeMessage: "Stripe reported that the test payment failed.", retryable: false } }
            : { error: undefined }),
        });
        await this.store.savePayment(updated);
        return {
          status: "success",
          data: {
            eventId: event.id,
            eventType: event.type,
            duplicate: false,
            matchedPayment: true,
            paymentStatus: event.paymentStatus,
          },
          evidenceRefs: [evidenceRef],
        };
      },
    });
  }
}
