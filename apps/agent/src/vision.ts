import { llm } from "@livekit/agents";
import type { VisionRequest } from "@steward/contracts";
import { randomUUID } from "node:crypto";

import {
  type ContractEventPublisher,
  VISION_RESPONSE_TOPIC,
} from "./events.js";

export type VisionResponseStatus = "accepted" | "declined" | "failed";

export interface VisionResponse {
  requestId: string;
  status: VisionResponseStatus;
  mediaRef?: string;
}

const systemActor = { kind: "system" as const, component: "agent" as const };

export class VisionCoordinator {
  readonly #pending = new Map<string, VisionRequest>();
  #cameraAuthorized = false;

  constructor(
    private readonly events: ContractEventPublisher,
    private readonly onResponse?: (
      response: VisionResponse,
      request: VisionRequest,
    ) => Promise<void>,
  ) {}

  get cameraAuthorized(): boolean {
    return this.#cameraAuthorized;
  }

  async request(input: {
    question: string;
    explanation: string;
    requestedEvidence: "live-camera" | "photo";
  }, operationId: string = randomUUID()): Promise<VisionRequest> {
    const createdAt = new Date();
    await this.events.incident({
      version: 1,
      type: "tool.started",
      incidentId: this.events.incidentId,
      eventId: randomUUID(),
      occurredAt: createdAt.toISOString(),
      actor: systemActor,
      payload: {
        operationId,
        provider: "livekit",
        operation: "request_visual_help",
      },
    });
    const request: VisionRequest = {
      version: 1,
      id: randomUUID(),
      incidentId: this.events.incidentId,
      question: input.question.trim(),
      explanation: input.explanation.trim(),
      requestedEvidence: input.requestedEvidence,
      status: "pending",
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 2 * 60_000).toISOString(),
    };

    this.#pending.set(request.id, request);
    await this.events.incident({
      version: 1,
      type: "vision.requested",
      incidentId: this.events.incidentId,
      eventId: randomUUID(),
      occurredAt: request.createdAt,
      actor: systemActor,
      payload: { request },
    });
    await this.events.vision(request);
    await this.events.voice({
      version: 1,
      incidentId: this.events.incidentId,
      state: "camera-requested",
      safeLabel: "Camera permission requested",
      occurredAt: request.createdAt,
    });
    await this.events.incident({
      version: 1,
      type: "tool.completed",
      incidentId: this.events.incidentId,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      actor: systemActor,
      payload: {
        result: {
          version: 1,
          incidentId: this.events.incidentId,
          operationId,
          provider: "livekit",
          operation: "request_visual_help",
          status: "success",
          startedAt: createdAt.toISOString(),
          completedAt: new Date().toISOString(),
          data: { requestId: request.id, status: "pending" },
          evidenceRefs: [],
        },
      },
    });
    return request;
  }

  async handleData(topic: string | undefined, payload: Uint8Array): Promise<boolean> {
    if (topic !== VISION_RESPONSE_TOPIC) return false;

    const response = parseVisionResponse(payload);
    const request = this.#pending.get(response.requestId);
    if (request === undefined) {
      throw new Error("Vision response does not match an active request");
    }
    this.#pending.delete(response.requestId);
    this.#cameraAuthorized = response.status === "accepted";

    await this.events.incident({
      version: 1,
      type: "vision.permission.updated",
      incidentId: this.events.incidentId,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      actor: systemActor,
      payload: {
        requestId: response.requestId,
        status: response.status,
      },
    });
    await this.onResponse?.(response, request);
    return true;
  }
}

export function parseVisionResponse(payload: Uint8Array): VisionResponse {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(payload)) as unknown;
  } catch {
    throw new Error("Vision response must be valid JSON");
  }

  if (!value || typeof value !== "object") {
    throw new Error("Vision response must be an object");
  }
  const record = value as Record<string, unknown>;
  const requestId = record["requestId"];
  const status = record["status"];
  const mediaRef = record["mediaRef"];
  if (typeof requestId !== "string" || !requestId.trim()) {
    throw new Error("Vision response requires requestId");
  }
  if (status !== "accepted" && status !== "declined" && status !== "failed") {
    throw new Error("Vision response has an invalid status");
  }
  if (mediaRef !== undefined && (typeof mediaRef !== "string" || !mediaRef.trim())) {
    throw new Error("Vision response mediaRef must be a non-empty string");
  }
  return {
    requestId,
    status,
    ...(typeof mediaRef === "string" ? { mediaRef } : {}),
  };
}

export function createVisionRequestTool(vision: VisionCoordinator) {
  return llm.tool({
    name: "request_visual_help",
    description:
      "Ask the guest for optional camera or photo evidence only when a specific visual observation would materially reduce uncertainty. This sends a permission request; it does not grant access and does not mean an image was received.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["question", "explanation", "requestedEvidence"],
      properties: {
        question: {
          type: "string",
          minLength: 1,
          description:
            "An open diagnostic question about what is visible, without assuming the object or outcome.",
        },
        explanation: {
          type: "string",
          minLength: 1,
          description: "A concise guest-facing reason the evidence would help.",
        },
        requestedEvidence: {
          type: "string",
          enum: ["live-camera", "photo"],
        },
      },
    },
    onDuplicate: "reject",
    execute: async (input, options) => {
      const request = await vision.request({
        question: String(input.question),
        explanation: String(input.explanation),
        requestedEvidence:
          input.requestedEvidence === "photo" ? "photo" : "live-camera",
      }, options.toolCallId);
      return {
        status: "pending",
        requestId: request.id,
        safeMessage:
          "The guest has been asked for optional visual evidence. Wait for their response and do not claim camera access yet.",
      };
    },
  });
}
