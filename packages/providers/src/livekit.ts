import { AgentDispatchClient, SipCallError, SipClient } from "livekit-server-sdk";
import { z } from "zod";

import type { ToolResult } from "@steward/contracts";
import { canContact, type ControlledContact } from "@steward/db";

import { ProviderActionAuditor, type ProviderOutcome } from "./audit.js";

const outboundCallDataSchema = z.object({
  callId: z.string().min(1),
  dispatchId: z.string().min(1),
  participantIdentity: z.string().min(1),
  roomName: z.string().min(1),
  vendorId: z.string().min(1),
  sipAnswered: z.literal(true),
  quoteStatus: z.literal("not-collected"),
}).strict();

export type OutboundCallData = z.infer<typeof outboundCallDataSchema>;

export interface CreateSipParticipantRequest {
  trunkId: string;
  number: string;
  roomName: string;
  participantIdentity: string;
  participantName: string;
  waitUntilAnswered: true;
}

export interface SipParticipantReceipt {
  participantId: string;
  participantIdentity: string;
}

export interface AgentDispatchReceipt {
  dispatchId: string;
}

export interface LiveKitSipTransport {
  dispatchAgent(request: {
    roomName: string;
    incidentId: string;
    incidentGoal?: string;
    vendorId: string;
  }): Promise<AgentDispatchReceipt>;
  createSipParticipant(request: CreateSipParticipantRequest): Promise<SipParticipantReceipt>;
}

export interface LiveKitSipTransportConfig {
  livekitUrl: string;
  apiKey: string;
  apiSecret: string;
  agentName: string;
}

export class LiveKitServerSipTransport implements LiveKitSipTransport {
  readonly #client: SipClient;
  readonly #dispatchClient: AgentDispatchClient;
  readonly #agentName: string;

  public constructor(config: LiveKitSipTransportConfig) {
    const host = config.livekitUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    this.#client = new SipClient(host, config.apiKey, config.apiSecret);
    this.#dispatchClient = new AgentDispatchClient(host, config.apiKey, config.apiSecret);
    this.#agentName = config.agentName;
  }

  public async dispatchAgent(request: {
    roomName: string;
    incidentId: string;
    incidentGoal?: string;
    vendorId: string;
  }) {
    const existing = await this.#dispatchClient.listDispatch(request.roomName);
    const current = existing.find((dispatch) => dispatch.agentName === this.#agentName);
    if (current !== undefined) return { dispatchId: current.id };
    const dispatch = await this.#dispatchClient.createDispatch(
      request.roomName,
      this.#agentName,
      {
        metadata: JSON.stringify({
          incidentId: request.incidentId,
          channel: "vendor-call",
          vendorId: request.vendorId,
          ...(request.incidentGoal === undefined ? {} : { incidentGoal: request.incidentGoal }),
        }),
      },
    );
    return { dispatchId: dispatch.id };
  }

  public async createSipParticipant(request: CreateSipParticipantRequest) {
    const participant = await this.#client.createSipParticipant(
      request.trunkId,
      request.number,
      request.roomName,
      {
        participantIdentity: request.participantIdentity,
        participantName: request.participantName,
        waitUntilAnswered: request.waitUntilAnswered,
      },
    );
    return {
      participantId: participant.participantId,
      participantIdentity: participant.participantIdentity,
    };
  }
}

export interface LiveKitTelephonyProviderConfig {
  outboundTrunkId: string;
}

export interface CreateOutboundVendorCallInput {
  incidentId: string;
  operationId: string;
  idempotencyKey: string;
  vendorId: string;
  vendorName: string;
  incidentGoal?: string;
  contact: ControlledContact;
}

function normalizeSipError(error: unknown): ProviderOutcome<never> {
  if (error instanceof SipCallError) {
    const code = error.sipStatusCode;
    if (code === 408 || code === 480) {
      return {
        status: "timeout",
        error: { code: "SIP_NO_ANSWER", safeMessage: "The vendor did not answer the call.", retryable: true },
      };
    }
    if (code === 486 || code === 603) {
      return {
        status: "failure",
        error: { code: "SIP_CALL_DECLINED", safeMessage: "The vendor declined or was busy.", retryable: true },
      };
    }
    return {
      status: "failure",
      error: { code: "SIP_TRUNK_FAILURE", safeMessage: "The outbound call could not be connected.", retryable: code !== undefined && code >= 500 },
    };
  }
  return {
    status: "failure",
    error: { code: "LIVEKIT_REQUEST_FAILED", safeMessage: "LiveKit did not return a confirmed call result.", retryable: true },
  };
}

export class LiveKitTelephonyProvider {
  public constructor(
    private readonly config: LiveKitTelephonyProviderConfig,
    private readonly transport: LiveKitSipTransport,
    private readonly auditor: ProviderActionAuditor,
  ) {}

  public async createOutboundVendorCall(
    input: CreateOutboundVendorCallInput,
  ): Promise<ToolResult<OutboundCallData>> {
    const vendorId = z.string().trim().min(1).max(200).parse(input.vendorId);
    if (!canContact(input.contact)) {
      return this.auditor.run({
        ...input,
        provider: "livekit",
        operation: "create-outbound-vendor-call",
        requestSummary: { vendorId, contactId: input.contact.id },
        dataSchema: outboundCallDataSchema,
        execute: async () => ({
          status: "failure",
          error: {
            code: "CONTACT_NOT_VERIFIED",
            safeMessage: "This vendor contact is not verified for calling.",
            retryable: false,
          },
        }),
      });
    }

    const roomName = `steward-vendor-${input.incidentId}-${input.operationId}`.slice(0, 200);
    const participantIdentity = `vendor-${vendorId}-${input.operationId}`.slice(0, 200);
    return this.auditor.run({
      ...input,
      provider: "livekit",
      operation: "create-outbound-vendor-call",
      requestSummary: { vendorId, contactId: input.contact.id, roomName },
      dataSchema: outboundCallDataSchema,
      execute: async () => {
        try {
          const dispatch = await this.transport.dispatchAgent({
            roomName,
            incidentId: input.incidentId,
            ...(input.incidentGoal === undefined ? {} : { incidentGoal: input.incidentGoal }),
            vendorId,
          });
          const receipt = await this.transport.createSipParticipant({
            trunkId: this.config.outboundTrunkId,
            number: input.contact.phoneE164,
            roomName,
            participantIdentity,
            participantName: input.vendorName,
            waitUntilAnswered: true,
          });
          return {
            status: "success",
            data: {
              callId: receipt.participantId,
              dispatchId: dispatch.dispatchId,
              participantIdentity: receipt.participantIdentity,
              roomName,
              vendorId,
              sipAnswered: true,
              quoteStatus: "not-collected",
            },
            evidenceRefs: [`livekit-call:${receipt.participantId}`],
          };
        } catch (error) {
          return normalizeSipError(error);
        }
      },
    });
  }
}
