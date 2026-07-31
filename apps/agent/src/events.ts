import {
  incidentEventSchema,
  type IncidentEvent,
  visionRequestSchema,
  type VisionRequest,
  voiceStatusEventSchema,
  type VoiceStatusEvent,
} from "@steward/contracts";

export const AGENT_STATUS_TOPIC = "steward.agent-status.v1";
export const VOICE_STATUS_TOPIC = AGENT_STATUS_TOPIC;
export const INCIDENT_EVENT_TOPIC = "steward.incident-event.v1";
export const VISION_REQUEST_TOPIC = "steward.vision-request.v1";
export const VISION_RESPONSE_TOPIC = "steward.vision-response.v1";

export interface TranscriptStatusMessage {
  version: 1;
  type: "transcript";
  incidentId: string;
  turnId: string;
  role: "user" | "assistant";
  text: string;
  isFinal: boolean;
  occurredAt: string;
}

export interface EventTransport {
  publish(topic: string, payload: Uint8Array): Promise<void>;
}

export interface LiveKitRoomLike {
  localParticipant?: {
    publishData(
      data: Uint8Array,
      options: { reliable?: boolean; topic?: string },
    ): Promise<void>;
  };
}

export class LiveKitEventTransport implements EventTransport {
  readonly #pending: Array<{ topic: string; payload: Uint8Array }> = [];

  constructor(private readonly room: LiveKitRoomLike) {}

  async publish(topic: string, payload: Uint8Array): Promise<void> {
    const participant = this.room.localParticipant;
    if (!participant) {
      this.#pending.push({ topic, payload });
      return;
    }
    await participant.publishData(payload, { reliable: true, topic });
  }

  async flush(): Promise<void> {
    const participant = this.room.localParticipant;
    if (!participant) return;

    const pending = this.#pending.splice(0);
    for (const item of pending) {
      await participant.publishData(item.payload, {
        reliable: true,
        topic: item.topic,
      });
    }
  }
}

export class MemoryEventTransport implements EventTransport {
  readonly published: Array<{ topic: string; payload: unknown }> = [];

  async publish(topic: string, payload: Uint8Array): Promise<void> {
    this.published.push({
      topic,
      payload: JSON.parse(new TextDecoder().decode(payload)) as unknown,
    });
  }
}

export class ContractEventPublisher {
  readonly #encoder = new TextEncoder();

  constructor(
    readonly incidentId: string,
    private readonly transport: EventTransport,
    private readonly persistIncidentEvent?: (event: IncidentEvent) => Promise<void>,
  ) {}

  async voice(event: VoiceStatusEvent): Promise<void> {
    const validated = voiceStatusEventSchema.parse(event);
    if (validated.incidentId !== this.incidentId) {
      throw new Error("Voice status incident does not match publisher incident");
    }
    await this.transport.publish(
      AGENT_STATUS_TOPIC,
      this.#encoder.encode(JSON.stringify({ type: "voice-status", ...validated })),
    );
  }

  async transcript(message: TranscriptStatusMessage): Promise<void> {
    if (message.incidentId !== this.incidentId) {
      throw new Error("Transcript incident does not match publisher incident");
    }
    if (!message.turnId.trim() || !message.text.trim()) {
      throw new Error("Transcript requires a turnId and text");
    }
    if (!Number.isFinite(Date.parse(message.occurredAt))) {
      throw new Error("Transcript occurredAt must be an ISO timestamp");
    }
    await this.transport.publish(
      AGENT_STATUS_TOPIC,
      this.#encoder.encode(JSON.stringify(message)),
    );
  }

  async vision(request: VisionRequest): Promise<void> {
    const validated = visionRequestSchema.parse(request);
    if (validated.incidentId !== this.incidentId) {
      throw new Error("Vision request incident does not match publisher incident");
    }
    await this.transport.publish(
      VISION_REQUEST_TOPIC,
      this.#encoder.encode(JSON.stringify(validated)),
    );
  }

  async incident(event: IncidentEvent): Promise<void> {
    const validated = incidentEventSchema.parse(event);
    if (validated.incidentId !== this.incidentId) {
      throw new Error("Incident event does not match publisher incident");
    }
    await this.persistIncidentEvent?.(validated);
    await this.transport.publish(
      INCIDENT_EVENT_TOPIC,
      this.#encoder.encode(JSON.stringify(validated)),
    );
  }
}
