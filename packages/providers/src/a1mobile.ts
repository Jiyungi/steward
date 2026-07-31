import { z } from "zod";

import type { ToolResult } from "@steward/contracts";
import { canContact, type ControlledContact } from "@steward/db";

import { ProviderActionAuditor, type ProviderOutcome } from "./audit.js";

const e164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/);

const verificationRequestDataSchema = z.object({
  phoneLast4: z.string().regex(/^\d{4}$/),
  verificationRequested: z.literal(true),
}).strict();

const verificationConfirmationDataSchema = z.object({
  phoneLast4: z.string().regex(/^\d{4}$/),
  verified: z.literal(true),
}).strict();

const smsDataSchema = z.object({
  providerMessageId: z.string().min(1).nullable(),
  accepted: z.literal(true),
  deliveryStatus: z.literal("unknown"),
}).strict();

export type VerificationRequestData = z.infer<typeof verificationRequestDataSchema>;
export type VerificationConfirmationData = z.infer<typeof verificationConfirmationDataSchema>;
export type SmsSendData = z.infer<typeof smsDataSchema>;

export interface A1MobileTransportResponse {
  status: number;
  body: unknown;
}

export interface A1MobileTransport {
  post(path: string, body: Record<string, string>): Promise<A1MobileTransportResponse>;
}

export interface A1MobileProviderConfig {
  baseUrl: string;
  teamKey: string;
  timeoutMs?: number;
}

export class FetchA1MobileTransport implements A1MobileTransport {
  readonly #baseUrl: string;
  readonly #teamKey: string;
  readonly #timeoutMs: number;

  public constructor(config: A1MobileProviderConfig) {
    this.#baseUrl = config.baseUrl.replace(/\/$/, "");
    this.#teamKey = config.teamKey;
    this.#timeoutMs = config.timeoutMs ?? 8_000;
  }

  public async post(path: string, body: Record<string, string>) {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Team-Key": this.#teamKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    let responseBody: unknown = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }
    return { status: response.status, body: responseBody };
  }
}

interface BaseActionInput {
  incidentId: string;
  operationId: string;
  idempotencyKey: string;
}

export interface RequestPhoneVerificationInput extends BaseActionInput {
  phoneE164: string;
}

export interface ConfirmPhoneVerificationInput extends BaseActionInput {
  phoneE164: string;
  code: string;
}

export interface SendSmsInput extends BaseActionInput {
  contact: ControlledContact;
  body: string;
}

function safeHttpError(status: number): ProviderOutcome<never> {
  return {
    status: status === 408 || status === 504 ? "timeout" : "failure",
    error: {
      code: status === 429 ? "A1_RATE_LIMITED" : "A1_REQUEST_REJECTED",
      safeMessage: "a1mobile did not accept the request.",
      retryable: status === 408 || status === 429 || status >= 500,
    },
  };
}

function pickString(body: unknown, keys: string[]): string | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

export class A1MobileProvider {
  public constructor(
    private readonly transport: A1MobileTransport,
    private readonly auditor: ProviderActionAuditor,
  ) {}

  public async requestPhoneVerification(input: RequestPhoneVerificationInput): Promise<ToolResult<VerificationRequestData>> {
    const phone = e164Schema.parse(input.phoneE164);
    return this.auditor.run({
      ...input,
      provider: "a1mobile",
      operation: "request-phone-verification",
      requestSummary: { phoneLast4: phone.slice(-4) },
      dataSchema: verificationRequestDataSchema,
      execute: async () => {
        const response = await this.transport.post("/api/verified-numbers", { phone });
        if (response.status < 200 || response.status >= 300) return safeHttpError(response.status);
        return { status: "success", data: { phoneLast4: phone.slice(-4), verificationRequested: true } };
      },
    });
  }

  public async confirmPhoneVerification(input: ConfirmPhoneVerificationInput): Promise<ToolResult<VerificationConfirmationData>> {
    const phone = e164Schema.parse(input.phoneE164);
    const code = z.string().regex(/^\d{4,8}$/).parse(input.code);
    return this.auditor.run({
      ...input,
      provider: "a1mobile",
      operation: "confirm-phone-verification",
      requestSummary: { phoneLast4: phone.slice(-4) },
      dataSchema: verificationConfirmationDataSchema,
      execute: async () => {
        const response = await this.transport.post("/api/verified-numbers/confirm", { phone, code });
        if (response.status < 200 || response.status >= 300) return safeHttpError(response.status);
        return { status: "success", data: { phoneLast4: phone.slice(-4), verified: true } };
      },
    });
  }

  public async sendSms(input: SendSmsInput): Promise<ToolResult<SmsSendData>> {
    const body = z.string().trim().min(1).max(480).parse(input.body);
    if (!canContact(input.contact)) {
      return this.auditor.run({
        ...input,
        provider: "a1mobile",
        operation: "send-sms",
        requestSummary: { contactId: input.contact.id, bodyCharacters: body.length },
        dataSchema: smsDataSchema,
        execute: async () => ({
          status: "failure",
          error: {
            code: "CONTACT_NOT_VERIFIED",
            safeMessage: "This contact is not verified for messaging.",
            retryable: false,
          },
        }),
      });
    }
    const phone = e164Schema.parse(input.contact.phoneE164);
    return this.auditor.run({
      ...input,
      provider: "a1mobile",
      operation: "send-sms",
      requestSummary: { contactId: input.contact.id, bodyCharacters: body.length },
      dataSchema: smsDataSchema,
      execute: async () => {
        const response = await this.transport.post("/api/sms", { to: phone, body });
        if (response.status < 200 || response.status >= 300) return safeHttpError(response.status);
        return {
          status: "success",
          data: {
            providerMessageId: pickString(response.body, ["message_id", "id"]),
            accepted: true,
            deliveryStatus: "unknown",
          },
        };
      },
    });
  }
}
